use std::collections::{BTreeMap, BTreeSet};

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
    fn prepare(&mut self, journal: ActiveJournal, artifact: RetainedArtifact) -> Result<(), &'static str> {
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
        self.retained.entry(journal.retained_key).or_insert(artifact);
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
        if self.active.values().any(|journal| journal.retained_key == (command_id, generation)) {
            return Err("retained artifact referenced by active recovery");
        }
        Ok(self.retained.remove(&(command_id, generation)).is_some())
    }

    fn collect_orphans(&mut self, live_commands: &BTreeSet<(&'static str, u64)>) -> usize {
        let protected = self.active.values().map(|journal| journal.retained_key).collect::<BTreeSet<_>>();
        let before = self.retained.len();
        self.retained.retain(|key, _| live_commands.contains(key) || protected.contains(key));
        before - self.retained.len()
    }

    fn ordinary_scan(&self) -> Result<(), &'static str> {
        if self.recovery_required { Err("recovery required before ordinary scan") } else { Ok(()) }
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
        Direction::Forward => (true, false, SettlementTarget { physical_revision: "physical-after-forward", physical_hash: "hash-after-forward", selected_group_id: Some("group-keep"), cursor_app_frame: 18 }),
        Direction::Undo => (false, true, SettlementTarget { physical_revision: "physical-before", physical_hash: "hash-before", selected_group_id: Some("group-attached"), cursor_app_frame: 18 }),
        Direction::Redo => (true, false, SettlementTarget { physical_revision: "physical-after-redo", physical_hash: "hash-after-redo", selected_group_id: if mode == DeleteMode::Cascade { None } else { Some("group-keep") }, cursor_app_frame: 18 }),
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
    harness.prepare(journal("forward-token", Direction::Forward, DeleteMode::KeepGroups, command_id, 1), artifact(command_id, 1)).unwrap();

    assert!(harness.ordinary_scan().is_err());
    assert!(harness.recover("forward-token").unwrap().is_none());
    assert!(harness.action_present);
    assert!(harness.retained.contains_key(&(command_id, 1)));
    assert!(harness.ordinary_scan().is_ok());

    harness.prepare(journal("redo-token", Direction::Redo, DeleteMode::Cascade, command_id, 1), artifact(command_id, 1)).unwrap();
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
    for (index, direction) in [Direction::Forward, Direction::Undo, Direction::Redo].into_iter().enumerate() {
        let token = ["forward-token", "undo-token", "redo-token"][index];
        harness.prepare(journal(token, direction, DeleteMode::KeepGroups, command_id, 2), artifact(command_id, 2)).unwrap();
        harness.commit(token).unwrap();
        let target = harness.recover(token).unwrap().unwrap();
        assert_eq!(target.physical_revision, ["physical-after-forward", "physical-before", "physical-after-redo"][index]);
        assert!(harness.acknowledge(token, direction, command_id, 2).unwrap());
        assert!(!harness.acknowledge(token, direction, command_id, 2).unwrap());
    }
}

#[test]
fn release_and_orphan_collection_protect_active_recovery_references() {
    let mut harness = TransactionHarness::default();
    harness.retained.insert(("evicted", 1), artifact("evicted", 1));
    harness.retained.insert(("redo-truncated", 2), artifact("redo-truncated", 2));
    harness.prepare(journal("active-token", Direction::Forward, DeleteMode::Cascade, "active", 3), artifact("active", 3)).unwrap();

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
        harness.retained.insert((command_id, generation), artifact(command_id, generation));
        for released in history.push((command_id, generation)) {
            assert!(harness.release(released.0, released.1).unwrap());
        }
    }
    assert_eq!(history.undo.len(), 10);
    assert!(!harness.retained.contains_key(&("command-1", 1)));

    history.undo();
    let redo_command = *history.redo.last().unwrap();
    let replacement_id = "replacement-command";
    harness.retained.insert((replacement_id, 12), artifact(replacement_id, 12));
    for released in history.push((replacement_id, 12)) {
        assert_eq!(released, redo_command);
        assert!(harness.release(released.0, released.1).unwrap());
    }
    assert!(history.redo.is_empty());

    let protected = *history.undo.last().unwrap();
    harness.prepare(
        journal("cleanup-pending-token", Direction::Forward, DeleteMode::KeepGroups, protected.0, protected.1),
        artifact(protected.0, protected.1),
    ).unwrap();
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
    let mut harness = TransactionHarness { recovery_required: true, ..TransactionHarness::default() };
    assert_eq!(harness.ordinary_scan(), Err("recovery required before ordinary scan"));
    harness.recovery_required = false;
    assert_eq!(harness.ordinary_scan(), Ok(()));
}
