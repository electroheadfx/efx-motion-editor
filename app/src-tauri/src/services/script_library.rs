use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use unicode_normalization::UnicodeNormalization;
use uuid::Uuid;

pub const SCRIPT_KIND: &str = "efx-physics-paint-roto-script";
pub const SCRIPT_VERSION: u64 = 1;
pub const SCRIPT_EXTENSION: &str = ".efx-roto-script.json";
const MAX_FILE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_CANDIDATES: usize = 1_000;
const MAX_NAME_CHARS: usize = 120;
const MAX_METADATA_CHARS: usize = 256;
const MAX_BRUSHES: usize = 2_000;
const MAX_CONTINUATIONS: usize = 600;
const MAX_POINTS_PER_BRUSH: usize = 50_000;
const MAX_TOTAL_POINTS: usize = 250_000;
const MAX_THUMBNAIL_BYTES: usize = 512 * 1024;
const ACTION_TRANSACTION_SCHEMA_VERSION: u64 = 1;
const ACTION_TRANSACTIONS_DIR: &str = ".action-transactions";
const MAX_TRANSACTION_TEXT_CHARS: usize = 256;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Eq, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ActionTransactionDirection {
    Forward,
    Undo,
    Redo,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Eq, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ActionTransactionMode {
    KeepGroups,
    DeleteActionAndGroups,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActionTransactionAuthority {
    pub project_context_id: String,
    pub layer_id: String,
    pub launch_operation_id: String,
    pub action_id: String,
    pub expected_action_present: bool,
    pub expected_action_revision: String,
    pub expected_physical_revision: String,
    pub expected_physical_hash: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActionRetainedArtifactReference {
    pub command_id: String,
    pub generation: u64,
    pub action_id: String,
    pub managed_path: String,
    pub original_revision: String,
    pub integrity_sha256: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActionTransactionTarget {
    pub physical_revision: String,
    pub physical_hash: String,
    pub physical_document: Value,
    pub selected_group_id: Option<String>,
    pub cursor_app_frame: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActionTransactionPrepareRequest {
    pub token: String,
    pub command_id: String,
    pub generation: u64,
    pub operation_id: String,
    pub lease_token: String,
    pub direction: ActionTransactionDirection,
    pub mode: ActionTransactionMode,
    pub authority: ActionTransactionAuthority,
    pub impact_digest: String,
    pub retained_artifact: ActionRetainedArtifactReference,
    pub target: ActionTransactionTarget,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActionTransactionAcknowledgeRequest {
    pub token: String,
    pub command_id: String,
    pub generation: u64,
    pub operation_id: String,
    pub lease_token: String,
    pub direction: ActionTransactionDirection,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Eq, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ActionHistoryReleaseReason {
    Eviction,
    RedoBranchTruncation,
    SessionHistoryClear,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActionHistoryReleaseRequest {
    pub project_context_id: String,
    pub launch_operation_id: String,
    pub command_id: String,
    pub generation: u64,
    pub reason: ActionHistoryReleaseReason,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ActionTransactionAcknowledgeReceipt {
    schema_version: u64,
    state: String,
    token: String,
    command_id: String,
    generation: u64,
    operation_id: String,
    lease_token: String,
    direction: ActionTransactionDirection,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ActiveActionTransaction {
    schema_version: u64,
    state: String,
    #[serde(flatten)]
    request: ActionTransactionPrepareRequest,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RetainedActionArtifactMetadata {
    schema_version: u64,
    state: String,
    project_context_id: String,
    launch_operation_id: String,
    command_id: String,
    generation: u64,
    action_id: String,
    managed_path: String,
    original_revision: String,
    integrity_sha256: String,
    byte_length: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ActionHistoryReleaseReceipt {
    schema_version: u64,
    state: String,
    project_context_id: String,
    launch_operation_id: String,
    command_id: String,
    generation: u64,
    reason: ActionHistoryReleaseReason,
}

#[derive(Default)]
pub struct ScriptLibraryState {
    active: Mutex<Option<ActiveProjectAuthority>>,
    operation: Mutex<()>,
}

#[derive(Clone)]
struct ActiveProjectAuthority {
    authority: String,
    root: PathBuf,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLibraryRow {
    pub id: String,
    pub revision: String,
    pub integrity_sha256: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub source: Value,
    pub thumbnail: Value,
    pub brush_count: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLibraryDiagnostic {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLibraryScan {
    pub rows: Vec<ScriptLibraryRow>,
    pub skipped_invalid_count: usize,
    pub diagnostics: Vec<ScriptLibraryDiagnostic>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLibraryOperation {
    pub scan: ScriptLibraryScan,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub script: Option<Value>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLibraryMigration {
    pub copied: usize,
    pub deduplicated: usize,
    pub remapped: usize,
    pub skipped_invalid: usize,
    pub diagnostics: Vec<ScriptLibraryDiagnostic>,
}

impl ScriptLibraryState {
    pub fn bind(&self, root: &Path) -> Result<String, String> {
        let _operation = self
            .operation
            .lock()
            .map_err(|_| "Script operation lock poisoned".to_string())?;
        let root = canonical_saved_project_root(root)?;
        ensure_scripts_dir(&root)?;
        let authority = Uuid::new_v4().to_string();
        *self
            .active
            .lock()
            .map_err(|_| "Script authority lock poisoned".to_string())? =
            Some(ActiveProjectAuthority {
                authority: authority.clone(),
                root,
            });
        Ok(authority)
    }

    pub fn clear(&self) -> Result<(), String> {
        let _operation = self
            .operation
            .lock()
            .map_err(|_| "Script operation lock poisoned".to_string())?;
        *self
            .active
            .lock()
            .map_err(|_| "Script authority lock poisoned".to_string())? = None;
        Ok(())
    }

    fn resolve(&self, authority: &str) -> Result<PathBuf, String> {
        let active = self
            .active
            .lock()
            .map_err(|_| "Script authority lock poisoned".to_string())?;
        let active = active
            .as_ref()
            .ok_or_else(|| "No active saved project script authority".to_string())?;
        if active.authority != authority {
            return Err("Stale project script authority".to_string());
        }
        canonical_saved_project_root(&active.root)
    }

    pub fn validate_active_root(&self, root: &Path) -> Result<(), String> {
        let requested = canonical_saved_project_root(root)?;
        let active = self
            .active
            .lock()
            .map_err(|_| "Script authority lock poisoned".to_string())?;
        let active = active
            .as_ref()
            .ok_or_else(|| "No active saved project script authority".to_string())?;
        let current = canonical_saved_project_root(&active.root)?;
        if requested == current {
            Ok(())
        } else {
            Err("Source project is not the active saved project".to_string())
        }
    }

    fn with_active<T>(
        &self,
        authority: &str,
        operation: impl FnOnce(&Path) -> Result<T, String>,
    ) -> Result<T, String> {
        let _operation = self
            .operation
            .lock()
            .map_err(|_| "Script operation lock poisoned".to_string())?;
        let root = self.resolve(authority)?;
        operation(&root)
    }

    pub fn migrate_active(
        &self,
        source_root: &Path,
        destination_root: &Path,
    ) -> Result<ScriptLibraryMigration, String> {
        let _operation = self
            .operation
            .lock()
            .map_err(|_| "Script operation lock poisoned".to_string())?;
        self.validate_active_root(source_root)?;
        migrate_saved_projects(source_root, destination_root)
    }
}

pub fn scan(state: &ScriptLibraryState, authority: &str) -> Result<ScriptLibraryScan, String> {
    state.with_active(authority, scan_root)
}

pub fn load(
    state: &ScriptLibraryState,
    authority: &str,
    script_id: &str,
) -> Result<ScriptLibraryOperation, String> {
    state.with_active(authority, |root| {
        let value = read_valid_managed(root, script_id)?;
        Ok(ScriptLibraryOperation {
            scan: scan_root(root)?,
            script: Some(value),
        })
    })
}

pub fn save(
    state: &ScriptLibraryState,
    authority: &str,
    script: Value,
) -> Result<ScriptLibraryOperation, String> {
    state.with_active(authority, |root| {
        let validated = validate_document(script, None)?;
        let id = document_id(&validated)?;
        let path = managed_path(root, &id)?;
        if path.exists() {
            return Err("A script with this ID already exists".to_string());
        }
        atomic_write_json(&path, &validated, false)?;
        Ok(ScriptLibraryOperation {
            scan: scan_root(root)?,
            script: Some(validated),
        })
    })
}

pub fn rename(
    state: &ScriptLibraryState,
    authority: &str,
    script_id: &str,
    expected_revision: &str,
    name: &str,
) -> Result<ScriptLibraryOperation, String> {
    state.with_active(authority, |root| {
        let normalized = normalize_name(name)?;
        let scan = scan_root(root)?;
        if scan.rows.iter().any(|row| {
            row.id != script_id
                && row.name.nfc().collect::<String>() == normalized.nfc().collect::<String>()
        }) {
            return Err("A script with this name already exists".to_string());
        }
        let mut value = read_valid_managed(root, script_id)?;
        require_revision(&value, expected_revision)?;
        let object = value
            .as_object_mut()
            .ok_or_else(|| "Invalid script document".to_string())?;
        object.insert("name".into(), Value::String(normalized));
        object.insert("updatedAt".into(), Value::String(Utc::now().to_rfc3339()));
        let validated = validate_document(value, Some(script_id))?;
        atomic_write_json(&managed_path(root, script_id)?, &validated, true)?;
        Ok(ScriptLibraryOperation {
            scan: scan_root(root)?,
            script: Some(validated),
        })
    })
}

pub fn delete(
    state: &ScriptLibraryState,
    authority: &str,
    script_id: &str,
    expected_revision: &str,
) -> Result<ScriptLibraryOperation, String> {
    state.with_active(authority, |root| {
        let value = read_valid_managed(root, script_id)?;
        require_revision(&value, expected_revision)?;
        let path = managed_path(root, script_id)?;
        fs::remove_file(&path)
            .map_err(|error| format!("Could not delete managed script: {error}"))?;
        sync_directory(path.parent().unwrap_or(root));
        Ok(ScriptLibraryOperation {
            scan: scan_root(root)?,
            script: None,
        })
    })
}

pub fn prepare_transaction(
    state: &ScriptLibraryState,
    authority: &str,
    request: ActionTransactionPrepareRequest,
) -> Result<Value, String> {
    state.with_active(authority, |root| prepare_transaction_root(root, request))
}

pub fn discover_action_transaction(
    state: &ScriptLibraryState,
    authority: &str,
) -> Result<Option<Value>, String> {
    state.with_active(authority, |root| {
        let transactions = ensure_action_transactions_dir(root)?;
        let mut candidates = fs::read_dir(&transactions)
            .map_err(|error| format!("Could not scan Action transactions directory: {error}"))?
            .filter_map(Result::ok)
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                let token = name.strip_prefix("committed-")
                    .and_then(|value| value.strip_suffix(".json"))
                    .or_else(|| name.strip_prefix("active-").and_then(|value| value.strip_suffix(".json")))?;
                Some((name.starts_with("committed-"), token.to_string(), entry.path()))
            })
            .collect::<Vec<_>>();
        candidates.sort_by(|left, right| left.1.cmp(&right.1).then(right.0.cmp(&left.0)));
        candidates.dedup_by(|left, right| left.1 == right.1);
        candidates.retain(|(_, token, _)| !acknowledged_transaction_path(&transactions, token).map(|path| path.exists()).unwrap_or(false));
        if candidates.len() > 1 {
            return Err("Multiple unresolved Action transactions require manual recovery".to_string());
        }
        let Some((_, token, path)) = candidates.pop() else { return Ok(None); };
        Ok(Some(read_transaction_record(&path, &token, "recoverable Action transaction")?))
    })
}

pub fn transaction_status(
    state: &ScriptLibraryState,
    authority: &str,
    token: &str,
) -> Result<Value, String> {
    state.with_active(authority, |root| transaction_status_root(root, token))
}

pub fn commit_transaction(
    state: &ScriptLibraryState,
    authority: &str,
    token: &str,
) -> Result<Value, String> {
    state.with_active(authority, |root| commit_transaction_root(root, token))
}

pub fn recover_transaction(
    state: &ScriptLibraryState,
    authority: &str,
    token: &str,
) -> Result<Value, String> {
    state.with_active(authority, |root| recover_transaction_root(root, token))
}

pub fn acknowledge_transaction(
    state: &ScriptLibraryState,
    authority: &str,
    request: ActionTransactionAcknowledgeRequest,
) -> Result<Value, String> {
    state.with_active(authority, |root| {
        acknowledge_transaction_root(root, request)
    })
}

pub fn release_action_history(
    state: &ScriptLibraryState,
    authority: &str,
    request: ActionHistoryReleaseRequest,
) -> Result<Value, String> {
    state.with_active(authority, |root| release_action_history_root(root, request))
}

pub(crate) fn prepare_transaction_value(
    state: &ScriptLibraryState,
    authority: &str,
    request: Value,
) -> Result<Value, String> {
    let request = serde_json::from_value::<ActionTransactionPrepareRequest>(request)
        .map_err(|error| format!("Invalid Action transaction prepare request: {error}"))?;
    prepare_transaction(state, authority, request)
}

pub(crate) fn transaction_status_value(
    state: &ScriptLibraryState,
    authority: &str,
    token: &str,
) -> Result<Value, String> {
    transaction_status(state, authority, token)
}

pub(crate) fn commit_transaction_value(
    state: &ScriptLibraryState,
    authority: &str,
    token: &str,
) -> Result<Value, String> {
    commit_transaction(state, authority, token)
}

pub(crate) fn recover_transaction_value(
    state: &ScriptLibraryState,
    authority: &str,
    token: &str,
) -> Result<Value, String> {
    recover_transaction(state, authority, token)
}

pub(crate) fn acknowledge_transaction_value(
    state: &ScriptLibraryState,
    authority: &str,
    request: Value,
) -> Result<Value, String> {
    let request = serde_json::from_value::<ActionTransactionAcknowledgeRequest>(request)
        .map_err(|error| format!("Invalid Action transaction acknowledge request: {error}"))?;
    acknowledge_transaction(state, authority, request)
}

pub(crate) fn release_action_history_value(
    state: &ScriptLibraryState,
    authority: &str,
    request: Value,
) -> Result<Value, String> {
    let request = serde_json::from_value::<ActionHistoryReleaseRequest>(request)
        .map_err(|error| format!("Invalid Action history release request: {error}"))?;
    release_action_history(state, authority, request)
}

fn prepare_transaction_root(
    root: &Path,
    request: ActionTransactionPrepareRequest,
) -> Result<Value, String> {
    validate_prepare_request(root, &request)?;
    let transactions = ensure_action_transactions_dir(root)?;
    reject_replayed_transaction_token(&transactions, &request.token)?;
    if active_transaction_paths(&transactions)?.next().is_some() {
        return Err("Action transaction recovery is already required".to_string());
    }
    prepare_or_validate_retained_artifact(root, &transactions, &request)?;

    let record = ActiveActionTransaction {
        schema_version: ACTION_TRANSACTION_SCHEMA_VERSION,
        state: "prepared".to_string(),
        request,
    };
    let value = serde_json::to_value(&record).map_err(|error| {
        format!("Could not serialize Action transaction prepare record: {error}")
    })?;
    atomic_write_json(
        &active_transaction_path(&transactions, &record.request.token)?,
        &value,
        false,
    )?;
    Ok(value)
}

fn transaction_status_root(root: &Path, token: &str) -> Result<Value, String> {
    validate_transaction_token(token)?;
    let transactions = ensure_action_transactions_dir(root)?;
    let committed = committed_transaction_path(&transactions, token)?;
    if committed.is_file() {
        return read_transaction_record(&committed, token, "committed Action transaction");
    }
    let active = active_transaction_path(&transactions, token)?;
    if active.is_file() {
        return read_transaction_record(&active, token, "active Action transaction");
    }
    let receipt = acknowledged_transaction_path(&transactions, token)?;
    if receipt.is_file() {
        return read_json_bounded(&receipt);
    }
    Err("Unknown Action transaction token".to_string())
}

fn commit_transaction_root(root: &Path, token: &str) -> Result<Value, String> {
    validate_transaction_token(token)?;
    let transactions = ensure_action_transactions_dir(root)?;
    let active_path = active_transaction_path(&transactions, token)?;
    let committed_path = committed_transaction_path(&transactions, token)?;
    if committed_path.exists() {
        return Err("Action transaction direction is already committed".to_string());
    }
    let active_value = read_transaction_record(&active_path, token, "active Action transaction")?;
    let mut record = serde_json::from_value::<ActiveActionTransaction>(active_value)
        .map_err(|error| format!("Invalid active Action transaction record: {error}"))?;
    if record.state != "prepared" {
        return Err("Action transaction is not prepared".to_string());
    }
    let retained = read_retained_artifact(&transactions, &record.request)?;
    let action_path = managed_path(root, &record.request.authority.action_id)?;
    let tombstone = tombstone_path(&transactions, token)?;
    if tombstone.exists() {
        return Err("Action transaction tombstone already exists".to_string());
    }

    match record.request.direction {
        ActionTransactionDirection::Undo => {
            if action_path.exists() {
                return Err("Action presence changed before Undo commit".to_string());
            }
            atomic_write_bytes(&action_path, &retained, false)?;
            let restored = read_valid_managed(root, &record.request.authority.action_id)?;
            require_revision(
                &restored,
                &record.request.authority.expected_action_revision,
            )?;
        }
        ActionTransactionDirection::Forward | ActionTransactionDirection::Redo => {
            let action = read_valid_managed(root, &record.request.authority.action_id)?;
            require_revision(&action, &record.request.authority.expected_action_revision)?;
            let current_bytes = read_managed_bytes(root, &record.request.authority.action_id)?;
            if current_bytes != retained {
                return Err("Action bytes changed from retained history authority".to_string());
            }
            fs::rename(&action_path, &tombstone).map_err(|error| {
                format!("Could not move Action to transaction tombstone: {error}")
            })?;
            sync_directory(&transactions);
            if let Some(scripts) = action_path.parent() {
                sync_directory(scripts);
            }
        }
    }

    record.state = "committed".to_string();
    let committed_value = serde_json::to_value(&record)
        .map_err(|error| format!("Could not serialize committed Action transaction: {error}"))?;
    atomic_write_json(&committed_path, &committed_value, false)?;
    Ok(committed_value)
}

fn recover_transaction_root(root: &Path, token: &str) -> Result<Value, String> {
    validate_transaction_token(token)?;
    let transactions = ensure_action_transactions_dir(root)?;
    let committed_path = committed_transaction_path(&transactions, token)?;
    if committed_path.is_file() {
        let mut value =
            read_transaction_record(&committed_path, token, "committed Action transaction")?;
        value
            .as_object_mut()
            .ok_or_else(|| "Invalid committed Action transaction record".to_string())?
            .insert(
                "state".to_string(),
                Value::String("recovery-required".to_string()),
            );
        return Ok(value);
    }

    let active_path = active_transaction_path(&transactions, token)?;
    let record_value = read_transaction_record(&active_path, token, "active Action transaction")?;
    let record = serde_json::from_value::<ActiveActionTransaction>(record_value)
        .map_err(|error| format!("Invalid active Action transaction record: {error}"))?;
    restore_prepared_transaction(root, &transactions, &active_path, &record)?;
    Ok(serde_json::json!({
        "state": "recovered-prepared",
        "token": token,
        "actionPresent": record.request.authority.expected_action_present
    }))
}

fn acknowledge_transaction_root(
    root: &Path,
    request: ActionTransactionAcknowledgeRequest,
) -> Result<Value, String> {
    validate_acknowledge_request(&request)?;
    let transactions = ensure_action_transactions_dir(root)?;
    let receipt_path = acknowledged_transaction_path(&transactions, &request.token)?;
    if receipt_path.is_file() {
        let mut receipt = serde_json::from_value::<ActionTransactionAcknowledgeReceipt>(
            read_json_bounded(&receipt_path)?,
        )
        .map_err(|error| format!("Invalid Action transaction acknowledge receipt: {error}"))?;
        require_acknowledge_identity(&receipt, &request)?;
        if receipt.state == "acknowledged" {
            return acknowledge_result(&receipt, false);
        }
        if receipt.state != "cleanup-pending" {
            return Err("Invalid Action transaction acknowledge state".to_string());
        }
        cleanup_committed_transaction(&transactions, &request.token)?;
        receipt.state = "acknowledged".to_string();
        let value = serde_json::to_value(&receipt)
            .map_err(|error| format!("Could not serialize Action acknowledge receipt: {error}"))?;
        atomic_write_json(&receipt_path, &value, true)?;
        return acknowledge_result(&receipt, true);
    }

    let committed_path = committed_transaction_path(&transactions, &request.token)?;
    let committed_value = read_transaction_record(
        &committed_path,
        &request.token,
        "committed Action transaction",
    )?;
    let committed = serde_json::from_value::<ActiveActionTransaction>(committed_value)
        .map_err(|error| format!("Invalid committed Action transaction record: {error}"))?;
    if committed.state != "committed"
        || committed.request.command_id != request.command_id
        || committed.request.generation != request.generation
        || committed.request.operation_id != request.operation_id
        || committed.request.lease_token != request.lease_token
        || committed.request.direction != request.direction
    {
        return Err("Stale Action transaction acknowledge identity".to_string());
    }

    let mut receipt = ActionTransactionAcknowledgeReceipt {
        schema_version: ACTION_TRANSACTION_SCHEMA_VERSION,
        state: "cleanup-pending".to_string(),
        token: request.token.clone(),
        command_id: request.command_id,
        generation: request.generation,
        operation_id: request.operation_id,
        lease_token: request.lease_token,
        direction: request.direction,
    };
    let pending = serde_json::to_value(&receipt)
        .map_err(|error| format!("Could not serialize cleanup-pending receipt: {error}"))?;
    atomic_write_json(&receipt_path, &pending, false)?;
    cleanup_committed_transaction(&transactions, &request.token)?;
    receipt.state = "acknowledged".to_string();
    let acknowledged = serde_json::to_value(&receipt)
        .map_err(|error| format!("Could not serialize acknowledged receipt: {error}"))?;
    atomic_write_json(&receipt_path, &acknowledged, true)?;
    acknowledge_result(&receipt, true)
}

fn release_action_history_root(
    root: &Path,
    request: ActionHistoryReleaseRequest,
) -> Result<Value, String> {
    validate_history_release_request(&request)?;
    let transactions = ensure_action_transactions_dir(root)?;
    reject_active_retained_reference(&transactions, &request.command_id, request.generation)?;
    let receipt_path =
        released_history_path(&transactions, &request.command_id, request.generation)?;

    if receipt_path.is_file() {
        let mut receipt = serde_json::from_value::<ActionHistoryReleaseReceipt>(read_json_bounded(
            &receipt_path,
        )?)
        .map_err(|error| format!("Invalid Action history release receipt: {error}"))?;
        require_history_release_identity(&receipt, &request)?;
        if receipt.state == "released" {
            cleanup_retained_artifact(&transactions, &request.command_id, request.generation)?;
            return history_release_result(&receipt, false);
        }
        if receipt.state != "cleanup-pending" {
            return Err("Invalid Action history release state".to_string());
        }
        cleanup_retained_artifact(&transactions, &request.command_id, request.generation)?;
        receipt.state = "released".to_string();
        let value = serde_json::to_value(&receipt).map_err(|error| {
            format!("Could not serialize Action history release receipt: {error}")
        })?;
        atomic_write_json(&receipt_path, &value, true)?;
        return history_release_result(&receipt, true);
    }

    let metadata = read_retained_metadata(&transactions, &request.command_id, request.generation)?;
    if metadata.project_context_id != request.project_context_id
        || metadata.launch_operation_id != request.launch_operation_id
    {
        return Err("Action history release owner does not match retained authority".to_string());
    }
    verify_retained_metadata_bytes(&transactions, &metadata)?;

    let mut receipt = ActionHistoryReleaseReceipt {
        schema_version: ACTION_TRANSACTION_SCHEMA_VERSION,
        state: "cleanup-pending".to_string(),
        project_context_id: request.project_context_id,
        launch_operation_id: request.launch_operation_id,
        command_id: request.command_id,
        generation: request.generation,
        reason: request.reason,
    };
    let pending = serde_json::to_value(&receipt)
        .map_err(|error| format!("Could not serialize Action history release receipt: {error}"))?;
    atomic_write_json(&receipt_path, &pending, false)?;
    cleanup_retained_artifact(&transactions, &receipt.command_id, receipt.generation)?;
    receipt.state = "released".to_string();
    let released = serde_json::to_value(&receipt)
        .map_err(|error| format!("Could not serialize Action history release receipt: {error}"))?;
    atomic_write_json(&receipt_path, &released, true)?;
    history_release_result(&receipt, true)
}

fn validate_history_release_request(request: &ActionHistoryReleaseRequest) -> Result<(), String> {
    validate_transaction_text(&request.project_context_id, "project context ID")?;
    validate_transaction_text(&request.launch_operation_id, "launch operation ID")?;
    validate_transaction_text(&request.command_id, "history command ID")?;
    if request.generation == 0 {
        return Err("Action history generation must be positive".to_string());
    }
    Ok(())
}

fn require_history_release_identity(
    receipt: &ActionHistoryReleaseReceipt,
    request: &ActionHistoryReleaseRequest,
) -> Result<(), String> {
    if receipt.schema_version != ACTION_TRANSACTION_SCHEMA_VERSION
        || receipt.project_context_id != request.project_context_id
        || receipt.launch_operation_id != request.launch_operation_id
        || receipt.command_id != request.command_id
        || receipt.generation != request.generation
        || receipt.reason != request.reason
    {
        Err("Stale Action history release identity".to_string())
    } else {
        Ok(())
    }
}

fn reject_active_retained_reference(
    transactions: &Path,
    command_id: &str,
    generation: u64,
) -> Result<(), String> {
    for path in active_transaction_paths(transactions)? {
        reject_symlink(&path, "active Action transaction")?;
        let value = read_json_bounded(&path)?;
        let active = serde_json::from_value::<ActiveActionTransaction>(value)
            .map_err(|error| format!("Invalid active Action transaction record: {error}"))?;
        if active.request.command_id == command_id && active.request.generation == generation {
            return Err(
                "Retained Action history artifact is referenced by active recovery".to_string(),
            );
        }
    }
    Ok(())
}

fn cleanup_retained_artifact(
    transactions: &Path,
    command_id: &str,
    generation: u64,
) -> Result<(), String> {
    for (path, label) in [
        (
            retained_bytes_path(transactions, command_id, generation)?,
            "retained Action bytes",
        ),
        (
            retained_metadata_path(transactions, command_id, generation)?,
            "retained Action metadata",
        ),
    ] {
        reject_symlink(&path, label)?;
        if path.exists() {
            fs::remove_file(&path).map_err(|error| format!("Could not remove {label}: {error}"))?;
            sync_directory(transactions);
        }
    }
    Ok(())
}

fn history_release_result(
    receipt: &ActionHistoryReleaseReceipt,
    released: bool,
) -> Result<Value, String> {
    Ok(serde_json::json!({
        "state": "released",
        "projectContextId": receipt.project_context_id,
        "launchOperationId": receipt.launch_operation_id,
        "commandId": receipt.command_id,
        "generation": receipt.generation,
        "reason": receipt.reason,
        "released": released
    }))
}

fn validate_acknowledge_request(
    request: &ActionTransactionAcknowledgeRequest,
) -> Result<(), String> {
    validate_transaction_token(&request.token)?;
    validate_transaction_text(&request.command_id, "history command ID")?;
    validate_transaction_text(&request.operation_id, "operation ID")?;
    validate_transaction_text(&request.lease_token, "lease token")?;
    if request.generation == 0 {
        return Err("Action transaction generation must be positive".to_string());
    }
    Ok(())
}

fn require_acknowledge_identity(
    receipt: &ActionTransactionAcknowledgeReceipt,
    request: &ActionTransactionAcknowledgeRequest,
) -> Result<(), String> {
    if receipt.schema_version != ACTION_TRANSACTION_SCHEMA_VERSION
        || receipt.token != request.token
        || receipt.command_id != request.command_id
        || receipt.generation != request.generation
        || receipt.operation_id != request.operation_id
        || receipt.lease_token != request.lease_token
        || receipt.direction != request.direction
    {
        Err("Stale Action transaction acknowledge identity".to_string())
    } else {
        Ok(())
    }
}

fn cleanup_committed_transaction(transactions: &Path, token: &str) -> Result<(), String> {
    for (path, label) in [
        (
            tombstone_path(transactions, token)?,
            "Action transaction tombstone",
        ),
        (
            active_transaction_path(transactions, token)?,
            "active Action transaction",
        ),
        (
            committed_transaction_path(transactions, token)?,
            "committed Action transaction",
        ),
    ] {
        reject_symlink(&path, label)?;
        if path.exists() {
            fs::remove_file(&path).map_err(|error| format!("Could not remove {label}: {error}"))?;
            sync_directory(transactions);
        }
    }
    Ok(())
}

fn acknowledge_result(
    receipt: &ActionTransactionAcknowledgeReceipt,
    cleaned: bool,
) -> Result<Value, String> {
    serde_json::to_value(serde_json::json!({
        "state": "acknowledged",
        "token": receipt.token,
        "commandId": receipt.command_id,
        "generation": receipt.generation,
        "operationId": receipt.operation_id,
        "leaseToken": receipt.lease_token,
        "direction": receipt.direction,
        "cleaned": cleaned
    }))
    .map_err(|error| format!("Could not serialize acknowledge result: {error}"))
}

fn read_transaction_record(path: &Path, token: &str, label: &str) -> Result<Value, String> {
    reject_symlink(path, label)?;
    if !path.is_file() {
        return Err("Unknown Action transaction token".to_string());
    }
    let value = read_json_bounded(path)?;
    let record = serde_json::from_value::<ActiveActionTransaction>(value.clone())
        .map_err(|error| format!("Invalid {label} record: {error}"))?;
    if record.schema_version != ACTION_TRANSACTION_SCHEMA_VERSION || record.request.token != token {
        return Err("Invalid active Action transaction identity".to_string());
    }
    Ok(value)
}

fn restore_prepared_transaction(
    root: &Path,
    transactions: &Path,
    active_path: &Path,
    record: &ActiveActionTransaction,
) -> Result<(), String> {
    if record.state != "prepared" {
        return Err("Prepared recovery found an invalid transaction state".to_string());
    }
    let action_path = managed_path(root, &record.request.authority.action_id)?;
    let tombstone = tombstone_path(transactions, &record.request.token)?;
    let action_exists = action_path.exists();
    let tombstone_exists = tombstone.exists();
    match record.request.direction {
        ActionTransactionDirection::Undo => match (action_exists, tombstone_exists) {
            (false, false) => {}
            (true, false) => {
                let retained = read_retained_artifact(transactions, &record.request)?;
                let restored = read_managed_bytes(root, &record.request.authority.action_id)?;
                if restored != retained {
                    return Err(
                        "Prepared Undo recovery found ambiguous Action authority".to_string()
                    );
                }
                fs::remove_file(&action_path).map_err(|error| {
                    format!("Could not roll back prepared Undo Action restoration: {error}")
                })?;
                if let Some(scripts) = action_path.parent() {
                    sync_directory(scripts);
                }
            }
            _ => return Err("Prepared Undo transaction has ambiguous file authority".to_string()),
        },
        ActionTransactionDirection::Forward | ActionTransactionDirection::Redo => {
            match (action_exists, tombstone_exists) {
                (true, false) => {}
                (false, true) => {
                    reject_symlink(&tombstone, "Action transaction tombstone")?;
                    fs::rename(&tombstone, &action_path).map_err(|error| {
                        format!("Could not restore prepared Action transaction: {error}")
                    })?;
                    sync_directory(transactions);
                    if let Some(scripts) = action_path.parent() {
                        sync_directory(scripts);
                    }
                }
                _ => {
                    return Err(
                        "Prepared Action transaction has ambiguous file authority".to_string()
                    )
                }
            }
        }
    }
    fs::remove_file(active_path)
        .map_err(|error| format!("Could not clear prepared Action transaction: {error}"))?;
    sync_directory(transactions);
    Ok(())
}

fn recover_prepared_transactions_before_scan(root: &Path) -> Result<(), String> {
    let transactions = ensure_action_transactions_dir(root)?;
    let paths = active_transaction_paths(&transactions)?.collect::<Vec<_>>();
    for active_path in paths {
        reject_symlink(&active_path, "active Action transaction")?;
        let value = read_json_bounded(&active_path)?;
        let record = serde_json::from_value::<ActiveActionTransaction>(value)
            .map_err(|error| format!("Invalid active Action transaction record: {error}"))?;
        validate_transaction_token(&record.request.token)?;
        if committed_transaction_path(&transactions, &record.request.token)?.is_file() {
            return Err("Action transaction recovery required before ordinary scan".to_string());
        }
        restore_prepared_transaction(root, &transactions, &active_path, &record)?;
    }
    Ok(())
}

fn reconcile_retained_history_before_scan(root: &Path) -> Result<(), String> {
    let transactions = ensure_action_transactions_dir(root)?;
    let mut entries = fs::read_dir(&transactions)
        .map_err(|error| format!("Could not scan retained Action history: {error}"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name());

    for entry in entries
        .iter()
        .filter(|entry| entry.file_name().to_string_lossy().starts_with("released-"))
    {
        let path = entry.path();
        reject_symlink(&path, "Action history release receipt")?;
        if !entry
            .file_type()
            .map_err(|error| format!("Could not inspect Action history release receipt: {error}"))?
            .is_file()
        {
            return Err("Action history release receipt is not a regular file".to_string());
        }
        let mut receipt =
            serde_json::from_value::<ActionHistoryReleaseReceipt>(read_json_bounded(&path)?)
                .map_err(|error| format!("Invalid Action history release receipt: {error}"))?;
        validate_history_release_request(&ActionHistoryReleaseRequest {
            project_context_id: receipt.project_context_id.clone(),
            launch_operation_id: receipt.launch_operation_id.clone(),
            command_id: receipt.command_id.clone(),
            generation: receipt.generation,
            reason: receipt.reason,
        })?;
        if receipt.schema_version != ACTION_TRANSACTION_SCHEMA_VERSION
            || released_history_path(&transactions, &receipt.command_id, receipt.generation)?
                != path
            || (receipt.state != "cleanup-pending" && receipt.state != "released")
        {
            return Err("Invalid Action history release receipt identity".to_string());
        }
        reject_active_retained_reference(&transactions, &receipt.command_id, receipt.generation)?;
        cleanup_retained_artifact(&transactions, &receipt.command_id, receipt.generation)?;
        if receipt.state == "cleanup-pending" {
            receipt.state = "released".to_string();
            let value = serde_json::to_value(&receipt).map_err(|error| {
                format!("Could not serialize Action history release receipt: {error}")
            })?;
            atomic_write_json(&path, &value, true)?;
        }
    }

    let mut retained_entries = fs::read_dir(&transactions)
        .map_err(|error| format!("Could not scan retained Action history: {error}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().starts_with("retained-"))
        .collect::<Vec<_>>();
    retained_entries.sort_by_key(|entry| entry.file_name());
    for entry in retained_entries {
        let path = entry.path();
        reject_symlink(&path, "retained Action history artifact")?;
        if !entry
            .file_type()
            .map_err(|error| format!("Could not inspect retained Action history: {error}"))?
            .is_file()
        {
            return Err("Retained Action history artifact is not a regular file".to_string());
        }
        match path.extension().and_then(|extension| extension.to_str()) {
            Some("json") => {
                let metadata = serde_json::from_value::<RetainedActionArtifactMetadata>(
                    read_json_bounded(&path)?,
                )
                .map_err(|error| format!("Invalid retained Action metadata: {error}"))?;
                if retained_metadata_path(&transactions, &metadata.command_id, metadata.generation)?
                    != path
                {
                    return Err("Invalid retained Action history metadata path".to_string());
                }
                let metadata = read_retained_metadata(
                    &transactions,
                    &metadata.command_id,
                    metadata.generation,
                )?;
                verify_retained_metadata_bytes(&transactions, &metadata)?;
            }
            Some("action") => {
                if !path.with_extension("json").is_file() {
                    return Err("Retained Action history artifact is incomplete".to_string());
                }
            }
            _ => return Err("Ambiguous retained Action history artifact".to_string()),
        }
    }
    Ok(())
}

fn validate_prepare_request(
    root: &Path,
    request: &ActionTransactionPrepareRequest,
) -> Result<(), String> {
    validate_transaction_token(&request.token)?;
    validate_transaction_text(&request.command_id, "history command ID")?;
    validate_transaction_text(&request.operation_id, "operation ID")?;
    validate_transaction_text(&request.lease_token, "lease token")?;
    validate_transaction_text(&request.authority.project_context_id, "project context ID")?;
    validate_transaction_text(&request.authority.layer_id, "layer ID")?;
    validate_transaction_text(
        &request.authority.launch_operation_id,
        "launch operation ID",
    )?;
    validate_transaction_text(
        &request.authority.expected_action_revision,
        "expected Action revision",
    )?;
    validate_transaction_text(
        &request.authority.expected_physical_revision,
        "expected physical revision",
    )?;
    validate_transaction_text(
        &request.authority.expected_physical_hash,
        "expected physical hash",
    )?;
    validate_sha256(&request.impact_digest, "impact digest")?;
    if request.generation == 0 {
        return Err("Action transaction generation must be positive".to_string());
    }

    let action_filename = managed_filename(&request.authority.action_id)?;
    let expected_present = !matches!(request.direction, ActionTransactionDirection::Undo);
    if request.authority.expected_action_present != expected_present {
        return Err("Action presence does not match transaction direction".to_string());
    }
    let action_path = managed_path(root, &request.authority.action_id)?;
    if request.authority.expected_action_present {
        let action = read_valid_managed(root, &request.authority.action_id)?;
        require_revision(&action, &request.authority.expected_action_revision)?;
    } else if action_path.exists() {
        return Err("Action presence changed before transaction prepare".to_string());
    }

    let retained = &request.retained_artifact;
    if retained.command_id != request.command_id
        || retained.generation != request.generation
        || retained.action_id != request.authority.action_id
        || retained.managed_path != format!("scripts/{action_filename}")
        || retained.original_revision != request.authority.expected_action_revision
    {
        return Err(
            "Retained Action artifact reference does not match transaction authority".to_string(),
        );
    }
    validate_sha256(&retained.integrity_sha256, "retained Action integrity")?;

    validate_transaction_text(
        &request.target.physical_revision,
        "target physical revision",
    )?;
    validate_transaction_text(&request.target.physical_hash, "target physical hash")?;
    if !request.target.physical_document.is_object() {
        return Err("Target physical document must be an object".to_string());
    }
    let target_bytes = serde_json::to_vec(&request.target.physical_document)
        .map_err(|error| format!("Could not serialize target physical document: {error}"))?;
    if target_bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("Target physical document exceeds the size limit".to_string());
    }
    if let Some(selected_group_id) = &request.target.selected_group_id {
        validate_transaction_text(selected_group_id, "selected Group ID")?;
    }
    // WR-01: the physical hash is the recovery settlement anchor — recompute
    // the canonical project equality from the opaque physical document and
    // reject a caller-supplied hash that does not match before any retained
    // artifact or recovery anchor is persisted.
    let recomputed_hash = canonical_physical_hash(&request.target.physical_document)?;
    if recomputed_hash != request.target.physical_hash {
        return Err("Target physical hash does not match the canonical physical document".to_string());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// WR-01 canonical physical hash. The encoding mirrors
// `buildPhysicPaintRotoProjectEquality` in physicsPaintRotoPhysicalModel.ts
// byte-for-byte; the parity contract tests pin the two implementations
// together. Numbers format via Rust's shortest f64 Display, which matches
// JavaScript's `String(number)` for every value the canonical document can
// carry (bounded integers plus the [0,1] grain strength float).
// ---------------------------------------------------------------------------

fn canonical_string(value: &str) -> String {
    format!("s{}:{};", value.len(), value)
}

fn canonical_number(value: f64) -> String {
    format!("n{value};")
}

fn canonical_optional_number(value: Option<f64>) -> String {
    match value {
        Some(number) => canonical_number(number),
        None => "u;".to_string(),
    }
}

fn canonical_boolean(value: bool) -> String {
    if value {
        "1;".to_string()
    } else {
        "0;".to_string()
    }
}

fn canonical_background(value: Option<&Value>) -> Result<String, String> {
    match value {
        Some(Value::Null) | None => Ok("null;".to_string()),
        Some(Value::Object(object)) => {
            let background = object
                .get("background")
                .and_then(Value::as_str)
                .ok_or("Target physical document background is malformed")?;
            let paper_grain = object
                .get("paperGrain")
                .and_then(Value::as_str)
                .ok_or("Target physical document paperGrain is malformed")?;
            let grain_strength = object
                .get("grainStrength")
                .and_then(Value::as_f64)
                .ok_or("Target physical document grainStrength is malformed")?;
            let color = object.get("color").and_then(Value::as_str);
            let mut encoded = String::new();
            encoded.push_str(&canonical_string(background));
            encoded.push_str(&canonical_string(paper_grain));
            encoded.push_str(&canonical_number(grain_strength));
            match color {
                Some(color) => encoded.push_str(&canonical_string(color)),
                None => encoded.push_str("u;"),
            }
            Ok(encoded)
        }
        Some(_) => Err("Target physical document background must be an object or null".to_string()),
    }
}

fn canonical_records(records: &[Value]) -> Result<String, String> {
    let mut ordered: Vec<&Value> = records.iter().collect();
    ordered.sort_by(|left, right| {
        let left_id = left.get("keyId").and_then(Value::as_str).unwrap_or("");
        let right_id = right.get("keyId").and_then(Value::as_str).unwrap_or("");
        left_id.cmp(right_id)
    });
    let mut encoded = String::new();
    for record in &ordered {
        let key_id = record
            .get("keyId")
            .and_then(Value::as_str)
            .ok_or("Target physical document record keyId is malformed")?;
        let app_frame = record
            .get("appFrame")
            .and_then(Value::as_f64)
            .ok_or("Target physical document record appFrame is malformed")?;
        let payload = record
            .get("payload")
            .and_then(Value::as_object)
            .ok_or("Target physical document record payload is malformed")?;
        let frame_index = payload
            .get("frameIndex")
            .and_then(Value::as_f64)
            .ok_or("Target physical document payload frameIndex is malformed")?;
        let payload_app_frame = payload
            .get("appFrame")
            .and_then(Value::as_f64)
            .ok_or("Target physical document payload appFrame is malformed")?;
        let data_url = payload
            .get("dataUrl")
            .and_then(Value::as_str)
            .ok_or("Target physical document payload dataUrl is malformed")?;
        let width = payload.get("width").and_then(Value::as_f64);
        let height = payload.get("height").and_then(Value::as_f64);
        encoded.push_str(&canonical_string(key_id));
        encoded.push_str(&canonical_number(app_frame));
        encoded.push_str(&canonical_number(frame_index));
        encoded.push_str(&canonical_number(payload_app_frame));
        encoded.push_str(&canonical_string(data_url));
        encoded.push_str(&canonical_optional_number(width));
        encoded.push_str(&canonical_optional_number(height));
    }
    Ok(format!("{}:{encoded}", ordered.len()))
}

fn canonical_loop_clips(loop_clips: &[Value]) -> Result<String, String> {
    let mut ordered: Vec<&Value> = loop_clips.iter().collect();
    ordered.sort_by(|left, right| {
        let left_id = left.get("loopId").and_then(Value::as_str).unwrap_or("");
        let right_id = right.get("loopId").and_then(Value::as_str).unwrap_or("");
        left_id.cmp(right_id)
    });
    let mut encoded = String::new();
    for clip in &ordered {
        let loop_id = clip
            .get("loopId")
            .and_then(Value::as_str)
            .ok_or("Target physical document loop loopId is malformed")?;
        let placement_start = clip
            .get("placementStart")
            .and_then(Value::as_f64)
            .ok_or("Target physical document loop placementStart is malformed")?;
        let source_key_ids = clip
            .get("sourceKeyIds")
            .and_then(Value::as_array)
            .ok_or("Target physical document loop sourceKeyIds is malformed")?;
        let mode = clip
            .get("mode")
            .and_then(Value::as_str)
            .ok_or("Target physical document loop mode is malformed")?;
        encoded.push_str(&canonical_string(loop_id));
        encoded.push_str(&canonical_number(placement_start));
        encoded.push_str(&format!("ids:{}:", source_key_ids.len()));
        for source_key_id in source_key_ids {
            encoded.push_str(&canonical_string(
                source_key_id
                    .as_str()
                    .ok_or("Target physical document loop source key id is malformed")?,
            ));
        }
        match clip.get("repeat") {
            Some(Value::String(repeat)) if repeat == "infinity" => {
                encoded.push_str(&canonical_string("infinity"));
            }
            Some(repeat) => {
                encoded.push_str(&canonical_number(
                    repeat
                        .as_f64()
                        .ok_or("Target physical document loop repeat is malformed")?,
                ));
            }
            None => return Err("Target physical document loop repeat is missing".to_string()),
        }
        encoded.push_str(&canonical_string(mode));
        if let Some(script_id) = clip.get("scriptId").and_then(Value::as_str) {
            let motion = clip
                .get("motion")
                .and_then(Value::as_object)
                .ok_or("Target physical document loop motion is malformed")?;
            let deformation = motion
                .get("deformation")
                .and_then(Value::as_f64)
                .ok_or("Target physical document loop motion deformation is malformed")?;
            let position = motion
                .get("position")
                .and_then(Value::as_f64)
                .ok_or("Target physical document loop motion position is malformed")?;
            let override_color = clip
                .get("overrideColor")
                .and_then(Value::as_str)
                .unwrap_or("");
            encoded.push_str(&canonical_string(script_id));
            encoded.push_str(&canonical_number(deformation));
            encoded.push_str(&canonical_number(position));
            encoded.push_str(&canonical_string(override_color));
        }
        if let Some(sync_state) = clip.get("syncState").and_then(Value::as_str) {
            let provenance_state = clip
                .get("provenanceState")
                .and_then(Value::as_str)
                .ok_or("Target physical document loop provenanceState is malformed")?;
            let phase_origin = clip
                .get("phaseOrigin")
                .and_then(Value::as_f64)
                .ok_or("Target physical document loop phaseOrigin is malformed")?;
            let original_end_exclusive = clip
                .get("originalEndExclusive")
                .and_then(Value::as_f64)
                .ok_or("Target physical document loop originalEndExclusive is malformed")?;
            let visible_ranges = clip
                .get("visibleRanges")
                .and_then(Value::as_array)
                .ok_or("Target physical document loop visibleRanges is malformed")?;
            let frame_overrides = clip
                .get("frameOverrides")
                .and_then(Value::as_array)
                .ok_or("Target physical document loop frameOverrides is malformed")?;
            encoded.push_str(&canonical_string(sync_state));
            encoded.push_str(&canonical_string(provenance_state));
            encoded.push_str(&canonical_number(phase_origin));
            encoded.push_str(&canonical_number(original_end_exclusive));
            encoded.push_str(&format!("ranges:{}:", visible_ranges.len()));
            for range in visible_ranges {
                let start = range
                    .get("start")
                    .and_then(Value::as_f64)
                    .ok_or("Target physical document loop range start is malformed")?;
                let end_exclusive = range
                    .get("endExclusive")
                    .and_then(Value::as_f64)
                    .ok_or("Target physical document loop range endExclusive is malformed")?;
                encoded.push_str(&canonical_number(start));
                encoded.push_str(&canonical_number(end_exclusive));
            }
            encoded.push_str(&format!("overrides:{}:", frame_overrides.len()));
            for frame_override in frame_overrides {
                let app_frame = frame_override
                    .get("appFrame")
                    .and_then(Value::as_f64)
                    .ok_or("Target physical document loop override appFrame is malformed")?;
                let key_id = frame_override
                    .get("keyId")
                    .and_then(Value::as_str)
                    .ok_or("Target physical document loop override keyId is malformed")?;
                encoded.push_str(&canonical_number(app_frame));
                encoded.push_str(&canonical_string(key_id));
            }
        }
    }
    Ok(format!("{}:{encoded}", ordered.len()))
}

fn canonical_incoming_breaks(breaks: &[Value]) -> Result<String, String> {
    let mut ordered: Vec<&Value> = breaks.iter().collect();
    ordered.sort_by(|left, right| {
        left.as_str()
            .unwrap_or("")
            .cmp(right.as_str().unwrap_or(""))
    });
    let mut encoded = String::new();
    for break_id in &ordered {
        encoded.push_str(&canonical_string(
            break_id
                .as_str()
                .ok_or("Target physical document incoming break id is malformed")?,
        ));
    }
    Ok(format!("{}:{encoded}", ordered.len()))
}

fn hash_canonical_physical_value(source: &str) -> String {
    let mut hash: u32 = 2_166_136_261;
    for byte in source.bytes() {
        hash ^= u32::from(byte);
        hash = hash.wrapping_mul(16_777_619);
    }
    format!("{}-{:x}", source.len(), hash)
}

/// Recompute the canonical project equality fingerprint for one physical
/// document, mirroring `buildPhysicPaintRotoProjectEquality` in
/// physicsPaintRotoPhysicalModel.ts. Returns the `project-<len>-<hex>` string
/// or a closed error when the document is not a canonical physical document.
pub fn canonical_physical_hash(document: &Value) -> Result<String, String> {
    let object = document
        .as_object()
        .ok_or("Target physical document must be an object")?;
    let records = object
        .get("realKeyRecords")
        .and_then(Value::as_array)
        .ok_or("Target physical document is missing realKeyRecords")?;
    let group_overrides = object.get("groupOverrideRecords").and_then(Value::as_array);
    let interpolation = object
        .get("interpolation")
        .and_then(Value::as_object)
        .ok_or("Target physical document is missing interpolation")?;
    let loop_clips = match object.get("loopClips").and_then(Value::as_array) {
        Some(loop_clips) => loop_clips.as_slice(),
        None => &[],
    };
    let incoming_breaks = match object
        .get("incomingInterpolationBreakKeyIds")
        .and_then(Value::as_array)
    {
        Some(incoming_breaks) => incoming_breaks.as_slice(),
        None => &[],
    };
    let capacity = object
        .get("capacity")
        .and_then(Value::as_f64)
        .ok_or("Target physical document is missing capacity")?;
    let script_motion = object
        .get("scriptMotion")
        .and_then(Value::as_object)
        .ok_or("Target physical document is missing scriptMotion")?;
    let background = object.get("background");
    let selected_key_id = object.get("selectedKeyId");
    let cursor_app_frame = object
        .get("cursorAppFrame")
        .and_then(Value::as_f64)
        .ok_or("Target physical document is missing cursorAppFrame")?;

    let mut source = String::new();
    source.push_str(&format!("records:{}", canonical_records(records)?));
    if let Some(group_overrides) = group_overrides {
        if !group_overrides.is_empty() {
            source.push_str(&format!(
                "group-overrides:{}",
                canonical_records(group_overrides)?
            ));
        }
    }
    let interpolation_enabled = interpolation
        .get("enabled")
        .and_then(Value::as_bool)
        .ok_or("Target physical document interpolation enabled is malformed")?;
    let interpolation_mode = interpolation
        .get("mode")
        .and_then(Value::as_str)
        .ok_or("Target physical document interpolation mode is malformed")?;
    source.push_str(&format!(
        "interpolation:{}",
        canonical_boolean(interpolation_enabled)
    ));
    source.push_str(&format!("mode:{}", canonical_string(interpolation_mode)));
    if !loop_clips.is_empty() {
        source.push_str(&format!("loops:{}", canonical_loop_clips(loop_clips)?));
    }
    if !incoming_breaks.is_empty() {
        source.push_str(&format!(
            "incoming-breaks:{}",
            canonical_incoming_breaks(incoming_breaks)?
        ));
    }
    source.push_str(&format!("capacity:{}", canonical_number(capacity)));
    let deformation = script_motion
        .get("deformation")
        .and_then(Value::as_f64)
        .ok_or("Target physical document scriptMotion deformation is malformed")?;
    let position = script_motion
        .get("position")
        .and_then(Value::as_f64)
        .ok_or("Target physical document scriptMotion position is malformed")?;
    source.push_str(&format!(
        "motion:{}{}",
        canonical_number(deformation),
        canonical_number(position)
    ));
    source.push_str(&format!("background:{}", canonical_background(background)?));
    source.push_str(&format!(
        "selection:{}",
        match selected_key_id {
            Some(Value::Null) | None => "null;".to_string(),
            Some(selected) => canonical_string(
                selected
                    .as_str()
                    .ok_or("Target physical document selectedKeyId is malformed")?,
            ),
        }
    ));
    source.push_str(&format!("cursor:{}", canonical_number(cursor_app_frame)));

    Ok(format!("project-{}", hash_canonical_physical_value(&source)))
}

fn prepare_or_validate_retained_artifact(
    root: &Path,
    transactions: &Path,
    request: &ActionTransactionPrepareRequest,
) -> Result<(), String> {
    if released_history_path(transactions, &request.command_id, request.generation)?.exists() {
        return Err("Released Action history identity cannot be reused".to_string());
    }
    let metadata_path =
        retained_metadata_path(transactions, &request.command_id, request.generation)?;
    let bytes_path = retained_bytes_path(transactions, &request.command_id, request.generation)?;
    let metadata_exists = metadata_path.exists();
    let bytes_exist = bytes_path.exists();
    if metadata_exists != bytes_exist {
        return Err("Retained Action history artifact is incomplete".to_string());
    }
    if metadata_exists {
        read_retained_artifact(transactions, request)?;
        return Ok(());
    }
    if !matches!(request.direction, ActionTransactionDirection::Forward) {
        return Err("Retained Action history artifact was not found".to_string());
    }

    let bytes = read_managed_bytes(root, &request.authority.action_id)?;
    let integrity_sha256 = format!("{:x}", Sha256::digest(&bytes));
    if integrity_sha256 != request.retained_artifact.integrity_sha256 {
        return Err("Retained Action integrity does not match exact managed bytes".to_string());
    }
    let metadata = RetainedActionArtifactMetadata {
        schema_version: ACTION_TRANSACTION_SCHEMA_VERSION,
        state: "retained".to_string(),
        project_context_id: request.authority.project_context_id.clone(),
        launch_operation_id: request.authority.launch_operation_id.clone(),
        command_id: request.command_id.clone(),
        generation: request.generation,
        action_id: request.authority.action_id.clone(),
        managed_path: request.retained_artifact.managed_path.clone(),
        original_revision: request.retained_artifact.original_revision.clone(),
        integrity_sha256,
        byte_length: u64::try_from(bytes.len())
            .map_err(|_| "Retained Action bytes exceed the size limit".to_string())?,
    };
    atomic_write_bytes(&bytes_path, &bytes, false)?;
    let metadata_value = serde_json::to_value(&metadata)
        .map_err(|error| format!("Could not serialize retained Action metadata: {error}"))?;
    if let Err(error) = atomic_write_json(&metadata_path, &metadata_value, false) {
        let _ = fs::remove_file(&bytes_path);
        sync_directory(transactions);
        return Err(error);
    }
    Ok(())
}

fn read_retained_artifact(
    transactions: &Path,
    request: &ActionTransactionPrepareRequest,
) -> Result<Vec<u8>, String> {
    let metadata = read_retained_metadata(transactions, &request.command_id, request.generation)?;
    if metadata.project_context_id != request.authority.project_context_id
        || metadata.launch_operation_id != request.authority.launch_operation_id
        || metadata.action_id != request.authority.action_id
        || metadata.managed_path != request.retained_artifact.managed_path
        || metadata.original_revision != request.retained_artifact.original_revision
        || metadata.integrity_sha256 != request.retained_artifact.integrity_sha256
    {
        return Err("Retained Action history identity does not match transaction".to_string());
    }
    verify_retained_metadata_bytes(transactions, &metadata)
}

fn read_retained_metadata(
    transactions: &Path,
    command_id: &str,
    generation: u64,
) -> Result<RetainedActionArtifactMetadata, String> {
    let metadata_path = retained_metadata_path(transactions, command_id, generation)?;
    reject_symlink(&metadata_path, "retained Action metadata")?;
    if !metadata_path.is_file() {
        return Err("Retained Action history artifact was not found".to_string());
    }
    let metadata = serde_json::from_value::<RetainedActionArtifactMetadata>(read_json_bounded(
        &metadata_path,
    )?)
    .map_err(|error| format!("Invalid retained Action metadata: {error}"))?;
    validate_transaction_text(&metadata.project_context_id, "retained project context ID")?;
    validate_transaction_text(
        &metadata.launch_operation_id,
        "retained launch operation ID",
    )?;
    validate_transaction_text(&metadata.command_id, "retained history command ID")?;
    validate_transaction_text(&metadata.original_revision, "retained Action revision")?;
    validate_sha256(&metadata.integrity_sha256, "retained Action integrity")?;
    let expected_path = format!("scripts/{}", managed_filename(&metadata.action_id)?);
    if metadata.schema_version != ACTION_TRANSACTION_SCHEMA_VERSION
        || metadata.state != "retained"
        || metadata.command_id != command_id
        || metadata.generation != generation
        || metadata.managed_path != expected_path
        || metadata.byte_length > MAX_FILE_BYTES
    {
        return Err("Invalid retained Action history metadata identity".to_string());
    }
    Ok(metadata)
}

fn verify_retained_metadata_bytes(
    transactions: &Path,
    metadata: &RetainedActionArtifactMetadata,
) -> Result<Vec<u8>, String> {
    let bytes_path = retained_bytes_path(transactions, &metadata.command_id, metadata.generation)?;
    reject_symlink(&bytes_path, "retained Action bytes")?;
    if !bytes_path.is_file() {
        return Err("Retained Action history artifact is incomplete".to_string());
    }
    let file_metadata = fs::metadata(&bytes_path)
        .map_err(|error| format!("Could not inspect retained Action bytes: {error}"))?;
    if file_metadata.len() > MAX_FILE_BYTES || file_metadata.len() != metadata.byte_length {
        return Err("Retained Action byte length does not match metadata".to_string());
    }
    let bytes = fs::read(&bytes_path)
        .map_err(|error| format!("Could not read retained Action bytes: {error}"))?;
    let integrity_sha256 = format!("{:x}", Sha256::digest(&bytes));
    if integrity_sha256 != metadata.integrity_sha256 {
        return Err("Retained Action integrity verification failed".to_string());
    }
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Could not parse retained Action bytes: {error}"))?;
    let validated = validate_document(value, Some(&metadata.action_id))?;
    if document_revision(&validated)? != metadata.original_revision {
        return Err("Retained Action revision verification failed".to_string());
    }
    Ok(bytes)
}

fn retained_artifact_stem(command_id: &str, generation: u64) -> Result<String, String> {
    validate_transaction_text(command_id, "history command ID")?;
    if generation == 0 {
        return Err("Action transaction generation must be positive".to_string());
    }
    Ok(format!(
        "retained-{:x}-{generation}",
        Sha256::digest(command_id.as_bytes())
    ))
}

fn retained_metadata_path(
    transactions: &Path,
    command_id: &str,
    generation: u64,
) -> Result<PathBuf, String> {
    Ok(transactions.join(format!(
        "{}.json",
        retained_artifact_stem(command_id, generation)?
    )))
}

fn retained_bytes_path(
    transactions: &Path,
    command_id: &str,
    generation: u64,
) -> Result<PathBuf, String> {
    Ok(transactions.join(format!(
        "{}.action",
        retained_artifact_stem(command_id, generation)?
    )))
}

fn released_history_path(
    transactions: &Path,
    command_id: &str,
    generation: u64,
) -> Result<PathBuf, String> {
    let retained_stem = retained_artifact_stem(command_id, generation)?;
    let identity = retained_stem
        .strip_prefix("retained-")
        .ok_or_else(|| "Invalid retained Action history identity".to_string())?;
    Ok(transactions.join(format!("released-{identity}.json")))
}

fn ensure_action_transactions_dir(root: &Path) -> Result<PathBuf, String> {
    let scripts = ensure_scripts_dir(root)?;
    let transactions = scripts.join(ACTION_TRANSACTIONS_DIR);
    if transactions.exists() {
        reject_symlink(&transactions, "Action transactions directory")?;
    }
    fs::create_dir_all(&transactions)
        .map_err(|error| format!("Could not create Action transactions directory: {error}"))?;
    let canonical = fs::canonicalize(&transactions)
        .map_err(|error| format!("Could not resolve Action transactions directory: {error}"))?;
    if !canonical.starts_with(&scripts) {
        return Err("Action transactions directory escapes active project".to_string());
    }
    Ok(canonical)
}

fn validate_transaction_token(token: &str) -> Result<(), String> {
    let uuid =
        Uuid::parse_str(token).map_err(|_| "Invalid Action transaction token".to_string())?;
    if uuid.hyphenated().to_string() != token || uuid.get_version_num() != 4 {
        return Err("Action transaction token must be a canonical UUID v4".to_string());
    }
    Ok(())
}

fn active_transaction_path(transactions: &Path, token: &str) -> Result<PathBuf, String> {
    validate_transaction_token(token)?;
    Ok(transactions.join(format!("active-{token}.json")))
}

fn committed_transaction_path(transactions: &Path, token: &str) -> Result<PathBuf, String> {
    validate_transaction_token(token)?;
    Ok(transactions.join(format!("committed-{token}.json")))
}

fn tombstone_path(transactions: &Path, token: &str) -> Result<PathBuf, String> {
    validate_transaction_token(token)?;
    Ok(transactions.join(format!("tombstone-{token}{SCRIPT_EXTENSION}")))
}

fn acknowledged_transaction_path(transactions: &Path, token: &str) -> Result<PathBuf, String> {
    validate_transaction_token(token)?;
    Ok(transactions.join(format!("acknowledged-{token}.json")))
}

fn active_transaction_paths(transactions: &Path) -> Result<impl Iterator<Item = PathBuf>, String> {
    let paths = fs::read_dir(transactions)
        .map_err(|error| format!("Could not scan Action transactions directory: {error}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().starts_with("active-"))
        .map(|entry| entry.path())
        .collect::<Vec<_>>();
    Ok(paths.into_iter())
}

fn reject_replayed_transaction_token(transactions: &Path, token: &str) -> Result<(), String> {
    for name in [
        format!("active-{token}.json"),
        format!("committed-{token}.json"),
        format!("tombstone-{token}{SCRIPT_EXTENSION}"),
        format!("acknowledged-{token}.json"),
    ] {
        if transactions.join(name).exists() {
            return Err("Replayed Action transaction token".to_string());
        }
    }
    Ok(())
}

fn validate_transaction_text(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty()
        || value.chars().count() > MAX_TRANSACTION_TEXT_CHARS
        || value.chars().any(char::is_control)
    {
        Err(format!("Invalid {label}"))
    } else {
        Ok(())
    }
}

fn validate_sha256(value: &str, label: &str) -> Result<(), String> {
    if value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err(format!("Invalid {label}"))
    }
}

pub fn migrate_saved_projects(
    source_root: &Path,
    destination_root: &Path,
) -> Result<ScriptLibraryMigration, String> {
    let source_root = canonical_saved_project_root(source_root)?;
    let destination_root = canonical_saved_project_root(destination_root)?;
    let destination_scripts = ensure_scripts_dir(&destination_root)?;
    let mut result = ScriptLibraryMigration::default();
    let source_scan = scan_root(&source_root)?;
    result.skipped_invalid = source_scan.skipped_invalid_count;
    result.diagnostics.extend(source_scan.diagnostics);
    let source_scripts = source_root.join("scripts");
    if !source_scripts.exists() {
        return Ok(result);
    }
    let mut ids = source_scan
        .rows
        .into_iter()
        .map(|row| row.id)
        .collect::<Vec<_>>();
    ids.sort();
    for id in ids {
        let source = read_valid_managed(&source_root, &id)?;
        let destination_path = destination_scripts.join(managed_filename(&id)?);
        if !destination_path.exists() {
            atomic_write_json(&destination_path, &source, false)?;
            result.copied += 1;
            continue;
        }
        let destination = read_json_bounded(&destination_path)
            .ok()
            .and_then(|value| validate_document(value, Some(&id)).ok());
        if destination.as_ref() == Some(&source) {
            result.deduplicated += 1;
            continue;
        }
        let mut remapped = source.clone();
        let remapped_id = Uuid::new_v4().to_string();
        remapped
            .as_object_mut()
            .ok_or_else(|| "Invalid source script".to_string())?
            .insert("id".into(), Value::String(remapped_id.clone()));
        let remapped = validate_document(remapped, Some(&remapped_id))?;
        atomic_write_json(
            &destination_scripts.join(managed_filename(&remapped_id)?),
            &remapped,
            false,
        )?;
        result.remapped += 1;
    }
    Ok(result)
}

fn scan_root(root: &Path) -> Result<ScriptLibraryScan, String> {
    let scripts = root.join("scripts");
    if !scripts.exists() {
        return Ok(ScriptLibraryScan {
            rows: vec![],
            skipped_invalid_count: 0,
            diagnostics: vec![],
        });
    }
    recover_prepared_transactions_before_scan(root)?;
    reconcile_retained_history_before_scan(root)
        .map_err(|error| format!("retained Action history recovery required: {error}"))?;
    reject_symlink(&scripts, "scripts directory")?;
    let canonical_scripts = fs::canonicalize(&scripts)
        .map_err(|error| format!("Could not resolve scripts directory: {error}"))?;
    if !canonical_scripts.starts_with(root) {
        return Err("Scripts directory escapes active project".to_string());
    }
    let mut candidates = fs::read_dir(&canonical_scripts)
        .map_err(|error| format!("Could not scan scripts directory: {error}"))?
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .ends_with(SCRIPT_EXTENSION)
        })
        .collect::<Vec<_>>();
    candidates.sort_by_key(|entry| entry.file_name());
    let mut rows = Vec::new();
    let mut diagnostics = Vec::new();
    for entry in candidates.into_iter().take(MAX_CANDIDATES) {
        let filename = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        let result = (|| {
            reject_symlink(&path, "managed script")?;
            if !entry
                .file_type()
                .map_err(|error| error.to_string())?
                .is_file()
            {
                return Err("Managed script is not a regular file".to_string());
            }
            let expected_id = filename
                .strip_suffix(SCRIPT_EXTENSION)
                .ok_or_else(|| "Wrong managed extension".to_string())?;
            let bytes = fs::read(&path)
                .map_err(|error| format!("Could not read managed script: {error}"))?;
            if bytes.len() as u64 > MAX_FILE_BYTES {
                return Err("Managed script exceeds the size limit".to_string());
            }
            let value = serde_json::from_slice(&bytes)
                .map_err(|error| format!("Could not parse managed script: {error}"))?;
            let value = validate_document(value, Some(expected_id))?;
            row_from_document(&value, &bytes)
        })();
        match result {
            Ok(row) => rows.push(row),
            Err(message) => diagnostics.push(ScriptLibraryDiagnostic {
                code: "invalid-managed-script".into(),
                message,
                filename: Some(filename),
            }),
        }
    }
    rows.sort_by(|a, b| {
        b.created_at
            .cmp(&a.created_at)
            .then_with(|| a.id.cmp(&b.id))
    });
    Ok(ScriptLibraryScan {
        skipped_invalid_count: diagnostics.len(),
        rows,
        diagnostics,
    })
}

fn canonical_saved_project_root(root: &Path) -> Result<PathBuf, String> {
    let canonical = fs::canonicalize(root)
        .map_err(|error| format!("Could not resolve saved project root: {error}"))?;
    if !canonical.is_dir() {
        return Err("Saved project root is not a directory".to_string());
    }
    if canonical.file_name().and_then(|name| name.to_str()) == Some("temp-project") {
        return Err("Temporary projects cannot own scripts".to_string());
    }
    Ok(canonical)
}

fn ensure_scripts_dir(root: &Path) -> Result<PathBuf, String> {
    let scripts = root.join("scripts");
    if scripts.exists() {
        reject_symlink(&scripts, "scripts directory")?;
    }
    fs::create_dir_all(&scripts)
        .map_err(|error| format!("Could not create scripts directory: {error}"))?;
    let canonical = fs::canonicalize(&scripts)
        .map_err(|error| format!("Could not resolve scripts directory: {error}"))?;
    if !canonical.starts_with(root) {
        return Err("Scripts directory escapes active project".to_string());
    }
    Ok(canonical)
}

fn managed_filename(id: &str) -> Result<String, String> {
    let uuid = Uuid::parse_str(id).map_err(|_| "Invalid script ID".to_string())?;
    let canonical = uuid.hyphenated().to_string();
    if canonical != id || uuid.get_version_num() != 4 {
        return Err("Script ID must be a canonical UUID v4".to_string());
    }
    Ok(format!("{canonical}{SCRIPT_EXTENSION}"))
}

fn managed_path(root: &Path, id: &str) -> Result<PathBuf, String> {
    let scripts = ensure_scripts_dir(root)?;
    Ok(scripts.join(managed_filename(id)?))
}

fn read_managed_bytes(root: &Path, id: &str) -> Result<Vec<u8>, String> {
    let path = managed_path(root, id)?;
    reject_symlink(&path, "managed script")?;
    if !path.is_file() {
        return Err("Managed script was not found".to_string());
    }
    let canonical = fs::canonicalize(&path)
        .map_err(|error| format!("Could not resolve managed script: {error}"))?;
    if !canonical.starts_with(root.join("scripts")) {
        return Err("Managed script escapes active project".to_string());
    }
    let metadata = fs::metadata(&canonical)
        .map_err(|error| format!("Could not inspect managed script: {error}"))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err("Managed script exceeds the size limit".to_string());
    }
    fs::read(&canonical).map_err(|error| format!("Could not read managed script: {error}"))
}

fn read_valid_managed(root: &Path, id: &str) -> Result<Value, String> {
    let bytes = read_managed_bytes(root, id)?;
    let value = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Could not parse managed script: {error}"))?;
    validate_document(value, Some(id))
}

fn read_json_bounded(path: &Path) -> Result<Value, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("Could not inspect managed script: {error}"))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err("Managed script exceeds the size limit".to_string());
    }
    let bytes =
        fs::read(path).map_err(|error| format!("Could not read managed script: {error}"))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Could not parse managed script: {error}"))
}

pub(crate) fn validate_document(value: Value, expected_id: Option<&str>) -> Result<Value, String> {
    let object = value
        .as_object()
        .ok_or_else(|| "Script document must be an object".to_string())?;
    if object.get("kind").and_then(Value::as_str) != Some(SCRIPT_KIND) {
        return Err("Invalid script kind".to_string());
    }
    if object.get("schemaVersion").and_then(Value::as_u64) != Some(SCRIPT_VERSION) {
        return Err("Unsupported script schemaVersion".to_string());
    }
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing script ID".to_string())?;
    managed_filename(id)?;
    if expected_id.is_some_and(|expected| expected != id) {
        return Err("Filename and JSON script ID do not match".to_string());
    }
    normalize_name(
        object
            .get("name")
            .and_then(Value::as_str)
            .ok_or_else(|| "Missing script name".to_string())?,
    )?;
    let created_at = validate_date(object.get("createdAt"), "createdAt")?;
    let updated_at = validate_date(object.get("updatedAt"), "updatedAt")?;
    if updated_at < created_at {
        return Err("updatedAt must not precede createdAt".to_string());
    }
    validate_source(object.get("source"))?;
    validate_thumbnail(object.get("thumbnail"))?;
    validate_brushes(object.get("brushes"))?;
    Ok(value)
}

fn validate_source(value: Option<&Value>) -> Result<(), String> {
    let source = value
        .and_then(Value::as_object)
        .ok_or_else(|| "Invalid source metadata".to_string())?;
    for key in ["projectName", "layerId", "layerName"] {
        bounded_text(source.get(key), key, MAX_METADATA_CHARS)?;
    }
    for key in ["sourceFrame", "displayFrame"] {
        non_negative_integer(source.get(key), key)?;
    }
    for key in ["width", "height"] {
        positive_integer(source.get(key), key, 16_384)?;
    }
    let background = source
        .get("background")
        .and_then(Value::as_object)
        .ok_or_else(|| "Invalid background metadata".to_string())?;
    match background.get("background").and_then(Value::as_str) {
        Some("transparent" | "white" | "canvas1" | "canvas2" | "canvas3") => {}
        _ => return Err("Invalid background mode".to_string()),
    }
    bounded_text(
        background.get("paperGrain"),
        "paperGrain",
        MAX_METADATA_CHARS,
    )?;
    finite_range(background.get("grainStrength"), "grainStrength", 0.0, 1.0)?;
    if let Some(color) = background.get("color") {
        if !color.is_string() {
            return Err("Invalid background color".to_string());
        }
    }
    Ok(())
}

fn validate_thumbnail(value: Option<&Value>) -> Result<(), String> {
    let thumb = value
        .and_then(Value::as_object)
        .ok_or_else(|| "Invalid thumbnail metadata".to_string())?;
    if thumb.get("mimeType").and_then(Value::as_str) != Some("image/webp") {
        return Err("Thumbnail MIME must be image/webp".to_string());
    }
    positive_integer(thumb.get("width"), "thumbnail width", 96)?;
    positive_integer(thumb.get("height"), "thumbnail height", 64)?;
    finite_range(thumb.get("quality"), "thumbnail quality", 0.75, 0.85)?;
    let data_url = thumb
        .get("dataUrl")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing thumbnail data URL".to_string())?;
    let encoded = data_url
        .strip_prefix("data:image/webp;base64,")
        .ok_or_else(|| "Thumbnail must be a WebP data URL".to_string())?;
    let bytes = decode_base64(encoded)?;
    if bytes.len() > MAX_THUMBNAIL_BYTES {
        return Err("Thumbnail exceeds the decoded size limit".to_string());
    }
    let (actual_width, actual_height) = validate_webp_payload(&bytes)?;
    let declared_width = thumb
        .get("width")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Invalid thumbnail width".to_string())?;
    let declared_height = thumb
        .get("height")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Invalid thumbnail height".to_string())?;
    if actual_width != declared_width || actual_height != declared_height {
        return Err("Thumbnail dimensions do not match the WebP payload".to_string());
    }
    Ok(())
}

fn validate_brushes(value: Option<&Value>) -> Result<(), String> {
    let brushes = value
        .and_then(Value::as_array)
        .ok_or_else(|| "Invalid brushes".to_string())?;
    if brushes.is_empty() || brushes.len() > MAX_BRUSHES {
        return Err("Brush count is outside the supported range".to_string());
    }
    let mut total_points = 0usize;
    for brush in brushes {
        let brush = brush
            .as_object()
            .ok_or_else(|| "Invalid logical brush".to_string())?;
        total_points += validate_stroke(brush.get("primary"), false)?;
        let continuations = brush
            .get("continuations")
            .and_then(Value::as_array)
            .ok_or_else(|| "Invalid continuation list".to_string())?;
        if continuations.len() > MAX_CONTINUATIONS {
            return Err("Too many brush continuations".to_string());
        }
        for continuation in continuations {
            validate_stroke(Some(continuation), true)?;
        }
        if total_points > MAX_TOTAL_POINTS {
            return Err("Script has too many total points".to_string());
        }
    }
    Ok(())
}

fn validate_stroke(value: Option<&Value>, continuation: bool) -> Result<usize, String> {
    let stroke = value
        .and_then(Value::as_object)
        .ok_or_else(|| "Invalid stroke".to_string())?;
    match stroke.get("tool").and_then(Value::as_str) {
        Some("paint" | "erase") => {}
        _ => return Err("Invalid stroke tool".to_string()),
    }
    let points = stroke
        .get("points")
        .and_then(Value::as_array)
        .ok_or_else(|| "Invalid stroke points".to_string())?;
    if continuation {
        if !points.is_empty() {
            return Err("Continuation strokes must have zero points".to_string());
        }
    } else if points.is_empty() || points.len() > MAX_POINTS_PER_BRUSH {
        return Err("Primary stroke point count is outside the supported range".to_string());
    }
    for point in points {
        validate_point(point)?;
    }
    if continuation {
        positive_integer(stroke.get("diffusionFrames"), "diffusionFrames", 600)?;
    } else if stroke.contains_key("diffusionFrames") {
        return Err("Primary strokes cannot carry diffusionFrames".to_string());
    }
    if let Some(color) = stroke.get("color") {
        if !color.is_null()
            && !color.as_str().is_some_and(|value| {
                value.len() == 7
                    && value.starts_with('#')
                    && value[1..].chars().all(|c| c.is_ascii_hexdigit())
            })
        {
            return Err("Invalid stroke color".to_string());
        }
    }
    let params = stroke
        .get("params")
        .and_then(Value::as_object)
        .ok_or_else(|| "Invalid stroke params".to_string())?;
    for (key, min, max) in [
        ("size", 1.0, 80.0),
        ("opacity", 10.0, 100.0),
        ("pressure", 10.0, 100.0),
        ("waterAmount", 0.0, 100.0),
        ("dryAmount", 0.0, 100.0),
        ("edgeDetail", 0.0, 100.0),
        ("pickup", 0.0, 100.0),
        ("eraseStrength", 0.0, 100.0),
    ] {
        finite_range(params.get(key), key, min, max)?;
    }
    non_negative_integer(params.get("antiAlias"), "antiAlias")?;
    if params
        .get("antiAlias")
        .and_then(Value::as_u64)
        .is_none_or(|value| value > 3)
    {
        return Err("Invalid antiAlias".to_string());
    }
    non_negative_integer(stroke.get("timestamp"), "timestamp")?;
    if let Some(value) = stroke.get("hasPenInput") {
        if !value.is_boolean() {
            return Err("Invalid hasPenInput".to_string());
        }
    }
    if let Some(value) = stroke.get("playFrame") {
        non_negative_integer(Some(value), "playFrame")?;
    }
    if let Some(value) = stroke.get("physicsMode") {
        if !value.is_null() && value.as_str() != Some("local") {
            return Err("Invalid physicsMode".to_string());
        }
    }
    Ok(points.len())
}

fn validate_point(value: &Value) -> Result<(), String> {
    let point = value
        .as_object()
        .ok_or_else(|| "Invalid point".to_string())?;
    for (key, min, max) in [
        ("x", -1_000_000.0, 1_000_000.0),
        ("y", -1_000_000.0, 1_000_000.0),
        ("p", 0.0, 1.0),
        ("tx", -90.0, 90.0),
        ("ty", -90.0, 90.0),
        ("tw", -360.0, 360.0),
        ("spd", 0.0, 100_000.0),
    ] {
        finite_range(point.get(key), key, min, max)?;
    }
    Ok(())
}

fn row_from_document(value: &Value, exact_bytes: &[u8]) -> Result<ScriptLibraryRow, String> {
    let object = value
        .as_object()
        .ok_or_else(|| "Invalid script".to_string())?;
    Ok(ScriptLibraryRow {
        id: object["id"].as_str().unwrap().into(),
        revision: document_revision(value)?,
        integrity_sha256: format!("{:x}", Sha256::digest(exact_bytes)),
        name: object["name"].as_str().unwrap().into(),
        created_at: object["createdAt"].as_str().unwrap().into(),
        updated_at: object["updatedAt"].as_str().unwrap().into(),
        source: object["source"].clone(),
        thumbnail: object["thumbnail"].clone(),
        brush_count: object["brushes"].as_array().map_or(0, Vec::len),
    })
}

fn atomic_write_bytes(path: &Path, bytes: &[u8], replace: bool) -> Result<(), String> {
    if !replace && path.exists() {
        return Err("Managed artifact already exists".to_string());
    }
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("Managed artifact exceeds the size limit".to_string());
    }
    let parent = path
        .parent()
        .ok_or_else(|| "Managed artifact has no parent".to_string())?;
    reject_symlink(parent, "managed artifact directory")?;
    let temp = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("artifact"),
        Uuid::new_v4()
    ));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(|error| format!("Could not create managed artifact temp file: {error}"))?;
        file.write_all(bytes)
            .map_err(|error| format!("Could not write managed artifact temp file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("Could not sync managed artifact temp file: {error}"))?;
        drop(file);
        fs::rename(&temp, path)
            .map_err(|error| format!("Could not atomically replace managed artifact: {error}"))?;
        sync_directory(parent);
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

fn atomic_write_json(path: &Path, value: &Value, replace: bool) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("Could not serialize script: {error}"))?;
    atomic_write_bytes(path, &bytes, replace)
}

fn sync_directory(path: &Path) {
    if let Ok(directory) = File::open(path) {
        let _ = directory.sync_all();
    }
}
fn reject_symlink(path: &Path, label: &str) -> Result<(), String> {
    if path
        .symlink_metadata()
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false)
    {
        Err(format!("Symlinked {label} is not allowed"))
    } else {
        Ok(())
    }
}
fn normalize_name(value: &str) -> Result<String, String> {
    let value = value.nfc().collect::<String>().trim().to_string();
    if value.is_empty()
        || value.chars().count() > MAX_NAME_CHARS
        || value.chars().any(char::is_control)
    {
        Err("Invalid script name".into())
    } else {
        Ok(value)
    }
}
fn document_id(value: &Value) -> Result<String, String> {
    value
        .get("id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "Missing script ID".into())
}
fn document_revision(value: &Value) -> Result<String, String> {
    let bytes = serde_json::to_vec(value)
        .map_err(|error| format!("Could not compute script revision: {error}"))?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}
fn require_revision(value: &Value, expected: &str) -> Result<(), String> {
    if document_revision(value)? == expected {
        Ok(())
    } else {
        Err("Script changed externally; refresh and try again".to_string())
    }
}
fn validate_date(
    value: Option<&Value>,
    label: &str,
) -> Result<DateTime<chrono::FixedOffset>, String> {
    let parsed = value
        .and_then(Value::as_str)
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .ok_or_else(|| format!("Invalid {label}"))?;
    if parsed.timestamp_millis() < 0 || parsed.timestamp_millis() > 8_640_000_000_000_000 {
        return Err(format!("Invalid {label}"));
    }
    Ok(parsed)
}
fn bounded_text(value: Option<&Value>, label: &str, max: usize) -> Result<(), String> {
    value
        .and_then(Value::as_str)
        .filter(|v| {
            !v.trim().is_empty() && v.chars().count() <= max && !v.chars().any(char::is_control)
        })
        .map(|_| ())
        .ok_or_else(|| format!("Invalid {label}"))
}
fn finite_range(value: Option<&Value>, label: &str, min: f64, max: f64) -> Result<(), String> {
    value
        .and_then(Value::as_f64)
        .filter(|v| v.is_finite() && *v >= min && *v <= max)
        .map(|_| ())
        .ok_or_else(|| format!("Invalid {label}"))
}
fn non_negative_integer(value: Option<&Value>, label: &str) -> Result<(), String> {
    value
        .and_then(Value::as_u64)
        .filter(|v| *v <= 9_007_199_254_740_991)
        .map(|_| ())
        .ok_or_else(|| format!("Invalid {label}"))
}
fn positive_integer(value: Option<&Value>, label: &str, max: u64) -> Result<(), String> {
    value
        .and_then(Value::as_u64)
        .filter(|v| *v > 0 && *v <= max.min(9_007_199_254_740_991))
        .map(|_| ())
        .ok_or_else(|| format!("Invalid {label}"))
}
pub(crate) fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    if input.len() % 4 != 0 {
        return Err("Invalid thumbnail Base64".into());
    }
    let padding = input.bytes().rev().take_while(|byte| *byte == b'=').count();
    if padding > 2
        || input[..input.len().saturating_sub(padding)]
            .bytes()
            .any(|byte| !byte.is_ascii_alphanumeric() && byte != b'+' && byte != b'/')
        || input[..input.len().saturating_sub(padding)].contains('=')
    {
        return Err("Invalid thumbnail Base64".into());
    }
    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    let mut buffer = 0u32;
    let mut bits = 0u8;
    for byte in input.bytes().take(input.len().saturating_sub(padding)) {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return Err("Invalid thumbnail Base64".into()),
        } as u32;
        buffer = (buffer << 6) | value;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
            buffer &= (1 << bits) - 1;
        }
    }
    if bits > 0 && buffer != 0 {
        return Err("Non-canonical thumbnail Base64".into());
    }
    let expected_padding = match output.len() % 3 {
        1 => 2,
        2 => 1,
        _ => 0,
    };
    if padding != expected_padding {
        return Err("Non-canonical thumbnail Base64".into());
    }
    Ok(output)
}
pub(crate) fn validate_webp_payload(bytes: &[u8]) -> Result<(u64, u64), String> {
    if bytes.len() < 20 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WEBP" {
        return Err("Thumbnail is not a WebP payload".to_string());
    }
    let riff_size = u32::from_le_bytes(
        bytes[4..8]
            .try_into()
            .map_err(|_| "Truncated WebP RIFF header".to_string())?,
    ) as usize;
    let container_size = riff_size
        .checked_add(8)
        .ok_or_else(|| "Invalid WebP RIFF size".to_string())?;
    if container_size != bytes.len() {
        return Err("WebP RIFF length does not match the payload".to_string());
    }
    let mut offset = 12usize;
    let mut image_chunks = 0usize;
    while offset < bytes.len() {
        if bytes.len() - offset < 8 {
            return Err("Truncated WebP chunk header".to_string());
        }
        let kind = &bytes[offset..offset + 4];
        let chunk_size = u32::from_le_bytes(
            bytes[offset + 4..offset + 8]
                .try_into()
                .map_err(|_| "Truncated WebP chunk size".to_string())?,
        ) as usize;
        let data_start = offset + 8;
        let data_end = data_start
            .checked_add(chunk_size)
            .ok_or_else(|| "Invalid WebP chunk size".to_string())?;
        if data_end > bytes.len() {
            return Err("Truncated WebP chunk".to_string());
        }
        if matches!(kind, b"VP8 " | b"VP8L") {
            image_chunks += 1;
        }
        let padded_end = data_end
            .checked_add(chunk_size & 1)
            .ok_or_else(|| "Invalid WebP chunk padding".to_string())?;
        if padded_end > bytes.len() {
            return Err("Missing WebP chunk padding".to_string());
        }
        if chunk_size & 1 == 1 && bytes[data_end] != 0 {
            return Err("Invalid WebP chunk padding".to_string());
        }
        offset = padded_end;
    }
    if offset != bytes.len() || image_chunks != 1 {
        return Err("WebP must contain exactly one supported image chunk".to_string());
    }
    let reader =
        image::ImageReader::with_format(std::io::Cursor::new(bytes), image::ImageFormat::WebP);
    let image = reader
        .decode()
        .map_err(|error| format!("Thumbnail WebP could not be decoded: {error}"))?;
    Ok((u64::from(image.width()), u64::from(image.height())))
}
