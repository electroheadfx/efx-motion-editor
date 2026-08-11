use efx_motion_editor_lib::script_library_test_support::FixtureLibrary;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

fn encode_base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let value = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        output.push(ALPHABET[((value >> 18) & 63) as usize] as char);
        output.push(ALPHABET[((value >> 12) & 63) as usize] as char);
        output.push(if chunk.len() > 1 {
            ALPHABET[((value >> 6) & 63) as usize] as char
        } else {
            '='
        });
        output.push(if chunk.len() > 2 {
            ALPHABET[(value & 63) as usize] as char
        } else {
            '='
        });
    }
    output
}

fn action_document(id: &str) -> Value {
    let webp = webp::Encoder::from_rgba(&[255, 255, 255, 255], 1, 1).encode(80.0);
    json!({
        "kind": "efx-physics-paint-roto-script",
        "schemaVersion": 1,
        "id": id,
        "name": "Action",
        "createdAt": "2026-08-11T00:00:00Z",
        "updatedAt": "2026-08-11T00:00:00Z",
        "source": {"projectName":"Project","layerId":"layer-1","layerName":"Paint","sourceFrame":0,"displayFrame":0,"width":1,"height":1,"background":{"background":"white","paperGrain":"canvas1","grainStrength":0.0}},
        "thumbnail": {"mimeType":"image/webp","width":1,"height":1,"quality":0.8,"dataUrl":format!("data:image/webp;base64,{}", encode_base64(webp.as_ref()))},
        "brushes": [{"primary":{"tool":"paint","points":[{"x":0,"y":0,"p":1,"tx":0,"ty":0,"tw":0,"spd":0}],"color":"#000000","params":{"size":1,"opacity":100,"pressure":100,"waterAmount":0,"dryAmount":0,"edgeDetail":0,"pickup":0,"eraseStrength":0,"antiAlias":0},"timestamp":0},"continuations":[]}]
    })
}

fn action_integrity(fixture: &FixtureLibrary, action_id: &str) -> String {
    let bytes = std::fs::read(
        fixture
            .scripts_root()
            .join(format!("{action_id}.efx-roto-script.json")),
    )
    .unwrap();
    format!("{:x}", Sha256::digest(bytes))
}

fn prepare_request_with_direction(
    action_id: &str,
    action_revision: &str,
    integrity_sha256: &str,
    token: &str,
    direction: &str,
) -> Value {
    let expected_action_present = direction != "undo";
    let target_suffix = if direction == "undo" {
        "before"
    } else {
        "after"
    };
    json!({
        "token": token,
        "commandId": "history-command-10",
        "generation": 1,
        "operationId": format!("{direction}-operation-1"),
        "leaseToken": format!("{direction}-lease-token-1"),
        "direction": direction,
        "mode": "keep-groups",
        "authority": {
            "projectContextId": "project-context-1",
            "layerId": "layer-1",
            "launchOperationId": "launch-1",
            "actionId": action_id,
            "expectedActionPresent": expected_action_present,
            "expectedActionRevision": action_revision,
            "expectedPhysicalRevision": if direction == "undo" { "physical-after" } else { "physical-before" },
            "expectedPhysicalHash": if direction == "undo" { "hash-after" } else { "hash-before" }
        },
        "impactDigest": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "retainedArtifact": {
            "commandId": "history-command-10",
            "generation": 1,
            "actionId": action_id,
            "managedPath": format!("scripts/{action_id}.efx-roto-script.json"),
            "originalRevision": action_revision,
            "integritySha256": integrity_sha256
        },
        "target": {
            "physicalRevision": format!("physical-{target_suffix}"),
            "physicalHash": format!("hash-{target_suffix}"),
            "physicalDocument": {"revision":format!("physical-{target_suffix}"),"realKeyRecords":[],"loopClips":[]},
            "selectedGroupId": "group-1",
            "cursorAppFrame": 18
        }
    })
}

fn prepare_request(
    fixture: &FixtureLibrary,
    action_id: &str,
    action_revision: &str,
    token: &str,
) -> Value {
    prepare_request_with_direction(
        action_id,
        action_revision,
        &action_integrity(fixture, action_id),
        token,
        "forward",
    )
}

#[test]
fn prepare_persists_exact_closed_recovery_payload_without_mutating_action() {
    let fixture = FixtureLibrary::new().unwrap();
    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();
    let token = Uuid::new_v4().to_string();
    let request = prepare_request(&fixture, &action_id, &revision, &token);

    let prepared = fixture.prepare_transaction(request.clone()).unwrap();
    assert_eq!(prepared["state"], "prepared");
    assert_eq!(prepared["token"], token);

    let status = fixture.transaction_status(&token).unwrap();
    assert_eq!(status["state"], "prepared");
    assert_eq!(status["direction"], "forward");
    assert_eq!(status["target"], request["target"]);
    assert_eq!(status["retainedArtifact"], request["retainedArtifact"]);
    assert_eq!(status["impactDigest"], request["impactDigest"]);
    assert_eq!(fixture.scan().unwrap().rows.len(), 1);
}

#[test]
fn prepare_rejects_stale_closed_replayed_and_conflicting_requests() {
    let fixture = FixtureLibrary::new().unwrap();
    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();

    let stale_token = Uuid::new_v4().to_string();
    let mut stale = prepare_request(&fixture, &action_id, &revision, &stale_token);
    stale["authority"]["expectedActionRevision"] = json!("stale-revision");
    assert!(fixture
        .prepare_transaction(stale)
        .unwrap_err()
        .contains("changed externally"));

    let token = Uuid::new_v4().to_string();
    let accepted = prepare_request(&fixture, &action_id, &revision, &token);
    fixture.prepare_transaction(accepted.clone()).unwrap();
    assert!(fixture.prepare_transaction(accepted).is_err());

    let conflicting = prepare_request(&fixture, &action_id, &revision, &Uuid::new_v4().to_string());
    assert!(fixture
        .prepare_transaction(conflicting)
        .unwrap_err()
        .contains("recovery"));

    let second = FixtureLibrary::new().unwrap();
    let second_id = Uuid::new_v4().to_string();
    let second_saved = second.save(action_document(&second_id)).unwrap();
    let mut unknown = prepare_request(
        &second,
        &second_id,
        &second_saved.scan.rows[0].revision,
        &Uuid::new_v4().to_string(),
    );
    unknown
        .as_object_mut()
        .unwrap()
        .insert("unexpected".into(), json!(true));
    assert!(second.prepare_transaction(unknown).is_err());
}

#[test]
fn prepare_record_is_synced_json_with_exact_target_digest() {
    let fixture = FixtureLibrary::new().unwrap();
    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();
    let token = Uuid::new_v4().to_string();
    fixture
        .prepare_transaction(prepare_request(&fixture, &action_id, &revision, &token))
        .unwrap();

    let bytes = std::fs::read(
        fixture
            .scripts_root()
            .join(".action-transactions")
            .join(format!("active-{token}.json")),
    )
    .unwrap();
    let stored: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(stored["state"], "prepared");
    assert_eq!(stored["target"]["cursorAppFrame"], 18);
    assert_eq!(format!("{:x}", Sha256::digest(&bytes)).len(), 64);
}

#[test]
fn commit_moves_action_to_hidden_tombstone_and_gates_ordinary_scan() {
    let fixture = FixtureLibrary::new().unwrap();
    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();
    let token = Uuid::new_v4().to_string();
    fixture
        .prepare_transaction(prepare_request(&fixture, &action_id, &revision, &token))
        .unwrap();

    let committed = fixture.commit_transaction(&token).unwrap();
    assert_eq!(committed["state"], "committed");
    assert!(!fixture
        .scripts_root()
        .join(format!("{action_id}.efx-roto-script.json"))
        .exists());
    assert!(fixture
        .scripts_root()
        .join(".action-transactions")
        .join(format!("tombstone-{token}.efx-roto-script.json"))
        .is_file());
    assert!(fixture
        .scripts_root()
        .join(".action-transactions")
        .join(format!("committed-{token}.json"))
        .is_file());
    assert!(fixture.scan().unwrap_err().contains("recovery required"));

    let recovery = fixture.recover_transaction(&token).unwrap();
    assert_eq!(recovery["state"], "recovery-required");
    assert_eq!(
        recovery["target"]["physicalDocument"]["revision"],
        "physical-after"
    );
    assert_eq!(recovery["token"], token);
}

#[test]
fn prepared_restart_recovery_restores_action_before_normal_scan() {
    let fixture = FixtureLibrary::new().unwrap();
    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();
    let token = Uuid::new_v4().to_string();
    fixture
        .prepare_transaction(prepare_request(&fixture, &action_id, &revision, &token))
        .unwrap();

    let action_path = fixture
        .scripts_root()
        .join(format!("{action_id}.efx-roto-script.json"));
    let tombstone = fixture
        .scripts_root()
        .join(".action-transactions")
        .join(format!("tombstone-{token}.efx-roto-script.json"));
    std::fs::rename(&action_path, &tombstone).unwrap();

    let scan = fixture.scan().unwrap();
    assert_eq!(scan.rows.len(), 1);
    assert!(action_path.is_file());
    assert!(!tombstone.exists());
    assert!(fixture.transaction_status(&token).is_err());
}

fn acknowledge_request(prepare: &Value) -> Value {
    json!({
        "token": prepare["token"],
        "commandId": prepare["commandId"],
        "generation": prepare["generation"],
        "operationId": prepare["operationId"],
        "leaseToken": prepare["leaseToken"],
        "direction": prepare["direction"]
    })
}

#[test]
fn acknowledge_cleans_only_active_state_and_is_exactly_idempotent() {
    let fixture = FixtureLibrary::new().unwrap();
    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();
    let token = Uuid::new_v4().to_string();
    let prepare = prepare_request(&fixture, &action_id, &revision, &token);
    fixture.prepare_transaction(prepare.clone()).unwrap();
    fixture.commit_transaction(&token).unwrap();

    let acknowledge = acknowledge_request(&prepare);
    let first = fixture
        .acknowledge_transaction(acknowledge.clone())
        .unwrap();
    assert_eq!(first["state"], "acknowledged");
    assert_eq!(first["cleaned"], true);
    assert!(!fixture
        .scripts_root()
        .join(".action-transactions")
        .join(format!("tombstone-{token}.efx-roto-script.json"))
        .exists());
    assert!(!fixture
        .scripts_root()
        .join(format!("{action_id}.efx-roto-script.json"))
        .exists());
    assert_eq!(fixture.scan().unwrap().rows.len(), 0);

    let repeated = fixture.acknowledge_transaction(acknowledge).unwrap();
    assert_eq!(repeated["state"], "acknowledged");
    assert_eq!(repeated["cleaned"], false);

    let mut stale = acknowledge_request(&prepare);
    stale["generation"] = json!(2);
    assert!(fixture.acknowledge_transaction(stale).is_err());
    assert!(fixture.prepare_transaction(prepare).is_err());
}

#[test]
fn commit_and_recovery_reject_unknown_stale_and_replayed_tokens() {
    let fixture = FixtureLibrary::new().unwrap();
    assert!(fixture
        .commit_transaction(&Uuid::new_v4().to_string())
        .is_err());
    assert!(fixture
        .recover_transaction(&Uuid::new_v4().to_string())
        .is_err());

    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();
    let token = Uuid::new_v4().to_string();
    fixture
        .prepare_transaction(prepare_request(&fixture, &action_id, &revision, &token))
        .unwrap();
    fixture.commit_transaction(&token).unwrap();
    assert!(fixture.commit_transaction(&token).is_err());
}

fn retained_history_files(fixture: &FixtureLibrary) -> Vec<std::path::PathBuf> {
    let mut files = std::fs::read_dir(fixture.scripts_root().join(".action-transactions"))
        .unwrap()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("retained-"))
        })
        .collect::<Vec<_>>();
    files.sort();
    files
}

#[test]
fn history_forward_retains_exact_action_bytes_after_acknowledge() {
    let fixture = FixtureLibrary::new().unwrap();
    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();
    let action_path = fixture
        .scripts_root()
        .join(format!("{action_id}.efx-roto-script.json"));
    let original_bytes = std::fs::read(&action_path).unwrap();
    let token = Uuid::new_v4().to_string();
    let prepare = prepare_request(&fixture, &action_id, &revision, &token);

    fixture.prepare_transaction(prepare.clone()).unwrap();
    let retained = retained_history_files(&fixture);
    assert_eq!(retained.len(), 2, "expected retained bytes plus metadata");
    let bytes_path = retained
        .iter()
        .find(|path| path.extension().and_then(|ext| ext.to_str()) == Some("action"))
        .unwrap();
    assert_eq!(std::fs::read(bytes_path).unwrap(), original_bytes);

    fixture.commit_transaction(&token).unwrap();
    fixture
        .acknowledge_transaction(acknowledge_request(&prepare))
        .unwrap();
    assert_eq!(retained_history_files(&fixture).len(), 2);
    assert!(!action_path.exists());
}

#[test]
fn history_undo_and_redo_restore_and_remove_exact_action_authority() {
    let fixture = FixtureLibrary::new().unwrap();
    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();
    let action_path = fixture
        .scripts_root()
        .join(format!("{action_id}.efx-roto-script.json"));
    let original_bytes = std::fs::read(&action_path).unwrap();
    let integrity = format!("{:x}", Sha256::digest(&original_bytes));

    let forward_token = Uuid::new_v4().to_string();
    let forward = prepare_request_with_direction(
        &action_id,
        &revision,
        &integrity,
        &forward_token,
        "forward",
    );
    fixture.prepare_transaction(forward.clone()).unwrap();
    fixture.commit_transaction(&forward_token).unwrap();
    fixture
        .acknowledge_transaction(acknowledge_request(&forward))
        .unwrap();

    let undo_token = Uuid::new_v4().to_string();
    let undo =
        prepare_request_with_direction(&action_id, &revision, &integrity, &undo_token, "undo");
    fixture.prepare_transaction(undo.clone()).unwrap();
    let undo_committed = fixture.commit_transaction(&undo_token).unwrap();
    assert_eq!(undo_committed["direction"], "undo");
    assert_eq!(
        undo_committed["target"]["physicalRevision"],
        "physical-before"
    );
    assert_eq!(std::fs::read(&action_path).unwrap(), original_bytes);
    fixture
        .acknowledge_transaction(acknowledge_request(&undo))
        .unwrap();

    let redo_token = Uuid::new_v4().to_string();
    let redo =
        prepare_request_with_direction(&action_id, &revision, &integrity, &redo_token, "redo");
    fixture.prepare_transaction(redo.clone()).unwrap();
    let redo_committed = fixture.commit_transaction(&redo_token).unwrap();
    assert_eq!(redo_committed["direction"], "redo");
    assert_eq!(
        redo_committed["target"]["physicalRevision"],
        "physical-after"
    );
    assert!(!action_path.exists());
    fixture
        .acknowledge_transaction(acknowledge_request(&redo))
        .unwrap();
    assert_eq!(retained_history_files(&fixture).len(), 2);
}

#[test]
fn history_prepare_rejects_integrity_mismatch_and_recovers_interrupted_undo() {
    let fixture = FixtureLibrary::new().unwrap();
    let action_id = Uuid::new_v4().to_string();
    let saved = fixture.save(action_document(&action_id)).unwrap();
    let revision = saved.scan.rows[0].revision.clone();
    let action_path = fixture
        .scripts_root()
        .join(format!("{action_id}.efx-roto-script.json"));
    let original_bytes = std::fs::read(&action_path).unwrap();
    let integrity = format!("{:x}", Sha256::digest(&original_bytes));

    let mut invalid = prepare_request_with_direction(
        &action_id,
        &revision,
        &integrity,
        &Uuid::new_v4().to_string(),
        "forward",
    );
    invalid["retainedArtifact"]["integritySha256"] =
        json!("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    assert!(fixture
        .prepare_transaction(invalid)
        .unwrap_err()
        .contains("integrity"));

    let forward_token = Uuid::new_v4().to_string();
    let forward = prepare_request_with_direction(
        &action_id,
        &revision,
        &integrity,
        &forward_token,
        "forward",
    );
    fixture.prepare_transaction(forward.clone()).unwrap();
    fixture.commit_transaction(&forward_token).unwrap();
    fixture
        .acknowledge_transaction(acknowledge_request(&forward))
        .unwrap();

    let undo_token = Uuid::new_v4().to_string();
    let undo =
        prepare_request_with_direction(&action_id, &revision, &integrity, &undo_token, "undo");
    fixture.prepare_transaction(undo).unwrap();
    std::fs::write(&action_path, &original_bytes).unwrap();

    assert_eq!(fixture.scan().unwrap().rows.len(), 0);
    assert!(!action_path.exists());
    assert!(fixture.transaction_status(&undo_token).is_err());
    assert_eq!(retained_history_files(&fixture).len(), 2);
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Direction {
    Forward,
    Undo,
    Redo,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum DeleteMode {
    KeepGroups,
    Cascade,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ActivePhase {
    Prepared,
    Committed,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct SettlementTarget {
    physical_revision: &'static str,
    physical_hash: &'static str,
    selected_group_id: Option<&'static str>,
    cursor_app_frame: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct RetainedArtifact {
    command_id: &'static str,
    generation: u64,
    script_id: &'static str,
    managed_path: &'static str,
    original_revision: &'static str,
    integrity_sha256: &'static str,
    original_bytes: &'static [u8],
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct ActiveJournal {
    command_id: &'static str,
    generation: u64,
    token: &'static str,
    direction: Direction,
    mode: DeleteMode,
    phase: ActivePhase,
    prior_action_present: bool,
    target_action_present: bool,
    target: SettlementTarget,
    retained_key: (&'static str, u64),
    working_tombstone: Option<&'static str>,
    committed_marker: Option<&'static str>,
}

#[derive(Default)]
struct TransactionHarness {
    action_present: bool,
    recovery_required: bool,
    retained: BTreeMap<(&'static str, u64), RetainedArtifact>,
    active: BTreeMap<&'static str, ActiveJournal>,
    acknowledged: BTreeSet<(&'static str, u64, &'static str, &'static str)>,
}

impl TransactionHarness {
    fn prepare(
        &mut self,
        journal: ActiveJournal,
        artifact: RetainedArtifact,
    ) -> Result<(), &'static str> {
        if journal.command_id.is_empty() || journal.generation == 0 || journal.token.is_empty() {
            return Err("invalid command identity");
        }
        if journal.retained_key != (artifact.command_id, artifact.generation)
            || journal.command_id != artifact.command_id
            || journal.generation != artifact.generation
        {
            return Err("retained artifact identity mismatch");
        }
        if journal.phase != ActivePhase::Prepared
            || journal.working_tombstone.is_some()
            || journal.committed_marker.is_some()
        {
            return Err("prepare must start without commit artifacts");
        }
        if self.recovery_required || self.active.contains_key(journal.token) {
            return Err("recovery already required");
        }
        if artifact.original_bytes.is_empty()
            || artifact.managed_path.contains("..")
            || artifact.integrity_sha256.len() != 64
        {
            return Err("invalid retained artifact");
        }
        self.action_present = journal.prior_action_present;
        self.retained
            .entry(journal.retained_key)
            .or_insert(artifact);
        self.active.insert(journal.token, journal);
        self.recovery_required = true;
        Ok(())
    }

    fn commit(&mut self, token: &'static str) -> Result<(), &'static str> {
        let journal = self.active.get_mut(token).ok_or("unknown token")?;
        if journal.phase != ActivePhase::Prepared {
            return Err("direction already committed");
        }
        self.action_present = journal.target_action_present;
        journal.phase = ActivePhase::Committed;
        journal.working_tombstone = Some(".history-working-tombstone");
        journal.committed_marker = Some("committed-v1");
        Ok(())
    }

    fn recover(&mut self, token: &'static str) -> Result<Option<SettlementTarget>, &'static str> {
        let journal = self.active.get(token).cloned().ok_or("unknown token")?;
        match journal.phase {
            ActivePhase::Prepared => {
                self.action_present = journal.prior_action_present;
                self.active.remove(token);
                self.recovery_required = !self.active.is_empty();
                Ok(None)
            }
            ActivePhase::Committed => {
                self.action_present = journal.target_action_present;
                Ok(Some(journal.target))
            }
        }
    }

    fn acknowledge(
        &mut self,
        token: &'static str,
        direction: Direction,
        command_id: &'static str,
        generation: u64,
    ) -> Result<bool, &'static str> {
        let key = (command_id, generation, token, direction_name(direction));
        if self.acknowledged.contains(&key) {
            return Ok(false);
        }
        let journal = self.active.get(token).ok_or("unknown token")?;
        if journal.phase != ActivePhase::Committed
            || journal.direction != direction
            || journal.command_id != command_id
            || journal.generation != generation
        {
            return Err("stale acknowledge identity");
        }
        self.active.remove(token);
        self.acknowledged.insert(key);
        self.recovery_required = !self.active.is_empty();
        Ok(true)
    }

    fn release(&mut self, command_id: &'static str, generation: u64) -> Result<bool, &'static str> {
        if self
            .active
            .values()
            .any(|journal| journal.retained_key == (command_id, generation))
        {
            return Err("retained artifact referenced by active recovery");
        }
        Ok(self.retained.remove(&(command_id, generation)).is_some())
    }

    fn collect_orphans(&mut self, live_commands: &BTreeSet<(&'static str, u64)>) -> usize {
        let protected = self
            .active
            .values()
            .map(|journal| journal.retained_key)
            .collect::<BTreeSet<_>>();
        let before = self.retained.len();
        self.retained
            .retain(|key, _| live_commands.contains(key) || protected.contains(key));
        before - self.retained.len()
    }

    fn ordinary_scan(&self) -> Result<(), &'static str> {
        if self.recovery_required {
            Err("recovery required before ordinary scan")
        } else {
            Ok(())
        }
    }
}

const fn direction_name(direction: Direction) -> &'static str {
    match direction {
        Direction::Forward => "forward",
        Direction::Undo => "undo",
        Direction::Redo => "redo",
    }
}

fn artifact(command_id: &'static str, generation: u64) -> RetainedArtifact {
    RetainedArtifact {
        command_id,
        generation,
        script_id: "123e4567-e89b-42d3-a456-426614174000",
        managed_path: "scripts/123e4567-e89b-42d3-a456-426614174000.efx-roto-script.json",
        original_revision: "action-rev-7",
        integrity_sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        original_bytes: br#"{"kind":"efx-physics-paint-roto-script","name":"Action"}"#,
    }
}

fn journal(
    token: &'static str,
    direction: Direction,
    mode: DeleteMode,
    command_id: &'static str,
    generation: u64,
) -> ActiveJournal {
    let (prior_action_present, target_action_present, target) = match direction {
        Direction::Forward => (
            true,
            false,
            SettlementTarget {
                physical_revision: "physical-after-forward",
                physical_hash: "hash-after-forward",
                selected_group_id: Some("group-keep"),
                cursor_app_frame: 18,
            },
        ),
        Direction::Undo => (
            false,
            true,
            SettlementTarget {
                physical_revision: "physical-before",
                physical_hash: "hash-before",
                selected_group_id: Some("group-attached"),
                cursor_app_frame: 18,
            },
        ),
        Direction::Redo => (
            true,
            false,
            SettlementTarget {
                physical_revision: "physical-after-redo",
                physical_hash: "hash-after-redo",
                selected_group_id: if mode == DeleteMode::Cascade {
                    None
                } else {
                    Some("group-keep")
                },
                cursor_app_frame: 18,
            },
        ),
    };
    ActiveJournal {
        command_id,
        generation,
        token,
        direction,
        mode,
        phase: ActivePhase::Prepared,
        prior_action_present,
        target_action_present,
        target,
        retained_key: (command_id, generation),
        working_tombstone: None,
        committed_marker: None,
    }
}

#[test]
fn prepared_and_committed_recovery_remain_separate_from_retained_history() {
    let mut harness = TransactionHarness::default();
    let command_id = "history-command-1";
    harness
        .prepare(
            journal(
                "forward-token",
                Direction::Forward,
                DeleteMode::KeepGroups,
                command_id,
                1,
            ),
            artifact(command_id, 1),
        )
        .unwrap();

    assert!(harness.ordinary_scan().is_err());
    assert!(harness.recover("forward-token").unwrap().is_none());
    assert!(harness.action_present);
    assert!(harness.retained.contains_key(&(command_id, 1)));
    assert!(harness.ordinary_scan().is_ok());

    harness
        .prepare(
            journal(
                "redo-token",
                Direction::Redo,
                DeleteMode::Cascade,
                command_id,
                1,
            ),
            artifact(command_id, 1),
        )
        .unwrap();
    harness.commit("redo-token").unwrap();
    let target = harness.recover("redo-token").unwrap().unwrap();
    assert_eq!(target.physical_revision, "physical-after-redo");
    assert!(!harness.action_present);
    assert!(harness.recovery_required);
}

#[test]
fn forward_undo_and_redo_have_direction_specific_targets_and_exact_acknowledge() {
    let mut harness = TransactionHarness::default();
    let command_id = "history-command-2";
    for (index, direction) in [Direction::Forward, Direction::Undo, Direction::Redo]
        .into_iter()
        .enumerate()
    {
        let token = ["forward-token", "undo-token", "redo-token"][index];
        harness
            .prepare(
                journal(token, direction, DeleteMode::KeepGroups, command_id, 2),
                artifact(command_id, 2),
            )
            .unwrap();
        harness.commit(token).unwrap();
        let target = harness.recover(token).unwrap().unwrap();
        assert_eq!(
            target.physical_revision,
            [
                "physical-after-forward",
                "physical-before",
                "physical-after-redo"
            ][index]
        );
        assert!(harness
            .acknowledge(token, direction, command_id, 2)
            .unwrap());
        assert!(!harness
            .acknowledge(token, direction, command_id, 2)
            .unwrap());
    }
}

#[test]
fn release_and_orphan_collection_protect_active_recovery_references() {
    let mut harness = TransactionHarness::default();
    harness
        .retained
        .insert(("evicted", 1), artifact("evicted", 1));
    harness
        .retained
        .insert(("redo-truncated", 2), artifact("redo-truncated", 2));
    harness
        .prepare(
            journal(
                "active-token",
                Direction::Forward,
                DeleteMode::Cascade,
                "active",
                3,
            ),
            artifact("active", 3),
        )
        .unwrap();

    assert!(harness.release("active", 3).is_err());
    assert!(harness.release("evicted", 1).unwrap());
    let live = BTreeSet::from([("active", 3)]);
    assert_eq!(harness.collect_orphans(&live), 1);
    assert!(harness.retained.contains_key(&("active", 3)));
}

#[derive(Default)]
struct HistoryOwner {
    undo: Vec<(&'static str, u64)>,
    redo: Vec<(&'static str, u64)>,
}

impl HistoryOwner {
    fn push(&mut self, command: (&'static str, u64)) -> Vec<(&'static str, u64)> {
        let mut released = self.redo.drain(..).collect::<Vec<_>>();
        self.undo.push(command);
        if self.undo.len() > 10 {
            released.push(self.undo.remove(0));
        }
        released
    }

    fn undo(&mut self) {
        if let Some(command) = self.undo.pop() {
            self.redo.push(command);
        }
    }

    fn clear(&mut self) -> Vec<(&'static str, u64)> {
        self.undo.drain(..).chain(self.redo.drain(..)).collect()
    }
}

#[test]
fn ten_level_eviction_redo_truncation_and_clear_release_only_unreferenced_artifacts() {
    let mut history = HistoryOwner::default();
    let mut harness = TransactionHarness::default();
    for generation in 1..=11 {
        let command_id = Box::leak(format!("command-{generation}").into_boxed_str());
        harness
            .retained
            .insert((command_id, generation), artifact(command_id, generation));
        for released in history.push((command_id, generation)) {
            assert!(harness.release(released.0, released.1).unwrap());
        }
    }
    assert_eq!(history.undo.len(), 10);
    assert!(!harness.retained.contains_key(&("command-1", 1)));

    history.undo();
    let redo_command = *history.redo.last().unwrap();
    let replacement_id = "replacement-command";
    harness
        .retained
        .insert((replacement_id, 12), artifact(replacement_id, 12));
    for released in history.push((replacement_id, 12)) {
        assert_eq!(released, redo_command);
        assert!(harness.release(released.0, released.1).unwrap());
    }
    assert!(history.redo.is_empty());

    let protected = *history.undo.last().unwrap();
    harness
        .prepare(
            journal(
                "cleanup-pending-token",
                Direction::Forward,
                DeleteMode::KeepGroups,
                protected.0,
                protected.1,
            ),
            artifact(protected.0, protected.1),
        )
        .unwrap();
    for released in history.clear() {
        if released == protected {
            assert!(harness.release(released.0, released.1).is_err());
        } else {
            assert!(harness.release(released.0, released.1).unwrap());
        }
    }
    assert!(harness.retained.contains_key(&protected));
}

#[test]
fn ordinary_scan_is_gated_until_recovery_finishes() {
    let mut harness = TransactionHarness {
        recovery_required: true,
        ..TransactionHarness::default()
    };
    assert_eq!(
        harness.ordinary_scan(),
        Err("recovery required before ordinary scan")
    );
    harness.recovery_required = false;
    assert_eq!(harness.ordinary_scan(), Ok(()));
}
