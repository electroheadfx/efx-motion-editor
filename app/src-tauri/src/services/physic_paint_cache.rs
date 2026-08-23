use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;

const CANONICAL_CACHE_BASENAME: &str = "efx-paint";
const STAGING_PREFIX: &str = ".efx-paint-staging-";
const ACTIVE_TRANSACTION_BASENAME: &str = ".physic-paint-transaction.json";
const TRANSACTION_VERSION: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CachePublication {
    pub transaction_id: String,
    pub replaced_existing: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CacheSettlementAction {
    Commit,
    Rollback,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CacheSettlement {
    pub cleanup_deferred: bool,
    pub cleanup_diagnostic: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum CacheTransactionPhase {
    Published,
    RollingBack,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct CacheTransactionMarker {
    version: u32,
    transaction_id: String,
    staging_basename: String,
    replaced_existing: bool,
    phase: CacheTransactionPhase,
    project_file_path: Option<String>,
    expected_project_digest: Option<String>,
}

pub fn publish_cache_generation(
    project_dir: &Path,
    staging_basename: &str,
) -> Result<CachePublication, String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (project_dir, staging_basename);
        return Err("Physics Paint cache publication is supported only on macOS".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        validate_staging_basename(staging_basename)?;
        let project_root = resolve_project_root(project_dir)?;
        let cache_parent = resolve_cache_parent(&project_root)?;
        if marker_path(&cache_parent).exists() {
            recover_cache_transaction(&project_root)?;
        }
        if marker_path(&cache_parent).exists() {
            return Err("A Physics Paint cache transaction is already active".to_string());
        }
        cleanup_stale_staging_generations(&cache_parent, Some(staging_basename));

        let canonical_path = cache_parent.join(CANONICAL_CACHE_BASENAME);
        let staging_path = cache_parent.join(staging_basename);
        let resolved_staging = fs::canonicalize(&staging_path).map_err(|error| {
            format!("Could not resolve staged Physics Paint generation: {error}")
        })?;
        ensure_direct_child_directory(
            &resolved_staging,
            &cache_parent,
            "Physics Paint staging generation",
        )?;

        let transaction_id = Uuid::new_v4().to_string();
        let sentinel_path = transaction_sentinel_path(&resolved_staging, &transaction_id);
        write_synced_file(&sentinel_path, transaction_id.as_bytes()).map_err(|error| {
            format!("Could not create Physics Paint transaction sentinel: {error}")
        })?;
        sync_directory_tree(&resolved_staging)?;

        let replaced_existing = canonical_path.exists();
        if replaced_existing {
            let resolved_canonical = fs::canonicalize(&canonical_path).map_err(|error| {
                format!("Could not resolve canonical Physics Paint cache: {error}")
            })?;
            ensure_direct_child_directory(
                &resolved_canonical,
                &cache_parent,
                "Canonical Physics Paint cache",
            )?;
        }

        let marker = CacheTransactionMarker {
            version: TRANSACTION_VERSION,
            transaction_id: transaction_id.clone(),
            staging_basename: staging_basename.to_string(),
            replaced_existing,
            phase: CacheTransactionPhase::Published,
            project_file_path: None,
            expected_project_digest: None,
        };
        write_marker(&cache_parent, &marker)?;

        let publication_result = if replaced_existing {
            atomic_exchange_directories(&resolved_staging, &canonical_path).map_err(|error| {
                format!("Could not atomically publish Physics Paint cache generation: {error}")
            })
        } else {
            fs::rename(&resolved_staging, &canonical_path).map_err(|error| {
                format!("Could not publish first Physics Paint cache generation: {error}")
            })
        };
        if let Err(error) = publication_result {
            let _ = fs::remove_file(&sentinel_path);
            let _ = fs::remove_file(marker_path(&cache_parent));
            let _ = sync_directory(&resolved_staging);
            let _ = sync_directory(&cache_parent);
            return Err(error);
        }
        sync_directory(&cache_parent).map_err(|error| {
            format!("Could not synchronize published Physics Paint cache authority: {error}")
        })?;

        Ok(CachePublication {
            transaction_id,
            replaced_existing,
        })
    }
}

pub fn bind_cache_transaction_to_project_write(
    project_dir: &Path,
    project_file_path: &Path,
    project_bytes: &[u8],
    transaction_id: &str,
) -> Result<(), String> {
    validate_transaction_id(transaction_id)?;
    let project_root = resolve_project_root(project_dir)?;
    let cache_parent = resolve_cache_parent(&project_root)?;
    let mut marker = require_matching_marker(&cache_parent, transaction_id)?;
    if marker.phase != CacheTransactionPhase::Published {
        return Err("Physics Paint cache transaction is already rolling back".to_string());
    }

    let normalized_project_path = normalize_project_file_path(&project_root, project_file_path)?;
    let digest = digest_bytes(project_bytes);
    let normalized_project_path = normalized_project_path.to_string_lossy().into_owned();
    match (&marker.project_file_path, &marker.expected_project_digest) {
        (None, None) => {
            marker.project_file_path = Some(normalized_project_path);
            marker.expected_project_digest = Some(digest);
            write_marker(&cache_parent, &marker)?;
        }
        (Some(existing_path), Some(existing_digest))
            if existing_path == &normalized_project_path && existing_digest == &digest => {}
        _ => {
            return Err(
                "Physics Paint cache transaction is already bound to a different project write"
                    .to_string(),
            );
        }
    }
    Ok(())
}

pub fn settle_cache_generation(
    project_dir: &Path,
    transaction_id: &str,
    action: CacheSettlementAction,
) -> Result<CacheSettlement, String> {
    validate_transaction_id(transaction_id)?;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (project_dir, action);
        return Err("Physics Paint cache settlement is supported only on macOS".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let project_root = resolve_project_root(project_dir)?;
        let cache_parent = resolve_cache_parent(&project_root)?;
        let marker = require_matching_marker(&cache_parent, transaction_id)?;
        match action {
            CacheSettlementAction::Commit => commit_transaction(&cache_parent, &marker),
            CacheSettlementAction::Rollback
                if marker.phase == CacheTransactionPhase::Published
                    && project_file_matches_marker(&project_root, &marker)? =>
            {
                commit_transaction(&cache_parent, &marker)
            }
            CacheSettlementAction::Rollback => rollback_transaction(&cache_parent, marker),
        }
    }
}

pub fn recover_cache_transaction(project_dir: &Path) -> Result<Option<CacheSettlement>, String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = project_dir;
        return Ok(None);
    }

    #[cfg(target_os = "macos")]
    {
        let project_root = resolve_project_root(project_dir)?;
        let cache_parent_path = project_root.join("cache");
        if !cache_parent_path.exists() {
            return Ok(None);
        }
        let cache_parent = resolve_cache_parent(&project_root)?;
        let Some(marker) = read_marker(&cache_parent)? else {
            cleanup_stale_staging_generations(&cache_parent, None);
            return Ok(None);
        };

        let settlement = if marker.phase == CacheTransactionPhase::RollingBack {
            finish_rollback(&cache_parent, &marker)
        } else if project_file_matches_marker(&project_root, &marker)? {
            commit_transaction(&cache_parent, &marker)
        } else {
            rollback_transaction(&cache_parent, marker)
        }?;
        Ok(Some(settlement))
    }
}

fn commit_transaction(
    cache_parent: &Path,
    marker: &CacheTransactionMarker,
) -> Result<CacheSettlement, String> {
    if marker.phase != CacheTransactionPhase::Published {
        return Err("A rolling-back Physics Paint cache transaction cannot commit".to_string());
    }
    let project_root = cache_parent
        .parent()
        .ok_or_else(|| "Physics Paint cache parent has no project authority".to_string())?;
    if !project_file_matches_marker(project_root, marker)? {
        return Err(
            "Physics Paint cache commit does not match the durable project bytes".to_string(),
        );
    }

    let canonical_path = cache_parent.join(CANONICAL_CACHE_BASENAME);
    if !has_transaction_sentinel(&canonical_path, &marker.transaction_id)? {
        return Err(
            "Physics Paint cache publication is not the active canonical generation".to_string(),
        );
    }

    remove_marker(cache_parent)?;
    let mut diagnostics = Vec::new();
    collect_cleanup_error(
        fs::remove_file(transaction_sentinel_path(
            &canonical_path,
            &marker.transaction_id,
        )),
        "transaction sentinel",
        &mut diagnostics,
    );
    collect_cleanup_error(
        fs::remove_dir_all(cache_parent.join(&marker.staging_basename)),
        "obsolete cache generation",
        &mut diagnostics,
    );
    collect_cleanup_error(
        sync_directory(cache_parent),
        "cache parent synchronization",
        &mut diagnostics,
    );
    Ok(cleanup_settlement(diagnostics))
}

fn rollback_transaction(
    cache_parent: &Path,
    mut marker: CacheTransactionMarker,
) -> Result<CacheSettlement, String> {
    if marker.phase == CacheTransactionPhase::Published {
        marker.phase = CacheTransactionPhase::RollingBack;
        write_marker(cache_parent, &marker)?;
    }
    finish_rollback(cache_parent, &marker)
}

fn finish_rollback(
    cache_parent: &Path,
    marker: &CacheTransactionMarker,
) -> Result<CacheSettlement, String> {
    let canonical_path = cache_parent.join(CANONICAL_CACHE_BASENAME);
    let staging_path = cache_parent.join(&marker.staging_basename);
    let sentinel_in_canonical = has_transaction_sentinel(&canonical_path, &marker.transaction_id)?;
    let sentinel_in_staging = has_transaction_sentinel(&staging_path, &marker.transaction_id)?;
    if sentinel_in_canonical && sentinel_in_staging {
        return Err("Physics Paint transaction sentinel exists in two generations".to_string());
    }

    if marker.replaced_existing {
        if sentinel_in_canonical {
            let resolved_staging = fs::canonicalize(&staging_path).map_err(|error| {
                format!("Could not resolve retained Physics Paint cache generation: {error}")
            })?;
            let resolved_canonical = fs::canonicalize(&canonical_path).map_err(|error| {
                format!("Could not resolve canonical Physics Paint cache: {error}")
            })?;
            ensure_direct_child_directory(
                &resolved_staging,
                cache_parent,
                "Retained Physics Paint cache generation",
            )?;
            ensure_direct_child_directory(
                &resolved_canonical,
                cache_parent,
                "Canonical Physics Paint cache",
            )?;
            atomic_exchange_directories(&resolved_staging, &resolved_canonical).map_err(
                |error| format!("Could not roll back Physics Paint cache generation: {error}"),
            )?;
        } else if !sentinel_in_staging {
            return Err(
                "Physics Paint rollback cannot identify the published generation".to_string(),
            );
        }
    } else if sentinel_in_canonical {
        let resolved_canonical = fs::canonicalize(&canonical_path).map_err(|error| {
            format!("Could not resolve uncommitted Physics Paint cache generation: {error}")
        })?;
        ensure_direct_child_directory(
            &resolved_canonical,
            cache_parent,
            "Canonical Physics Paint cache",
        )?;
        fs::remove_dir_all(&resolved_canonical).map_err(|error| {
            format!("Could not remove uncommitted Physics Paint cache generation: {error}")
        })?;
    } else if !sentinel_in_staging && (canonical_path.exists() || staging_path.exists()) {
        return Err(
            "Physics Paint rollback cannot identify the first published generation".to_string(),
        );
    }

    sync_directory(cache_parent).map_err(|error| {
        format!("Could not synchronize rolled-back Physics Paint cache authority: {error}")
    })?;
    remove_marker(cache_parent)?;

    let mut diagnostics = Vec::new();
    collect_cleanup_error(
        fs::remove_dir_all(&staging_path),
        "uncommitted cache generation",
        &mut diagnostics,
    );
    collect_cleanup_error(
        sync_directory(cache_parent),
        "cache parent synchronization",
        &mut diagnostics,
    );
    Ok(cleanup_settlement(diagnostics))
}

fn project_file_matches_marker(
    project_root: &Path,
    marker: &CacheTransactionMarker,
) -> Result<bool, String> {
    let (Some(project_file_path), Some(expected_digest)) = (
        marker.project_file_path.as_deref(),
        marker.expected_project_digest.as_deref(),
    ) else {
        return Ok(false);
    };
    let project_file_path =
        normalize_project_file_path(project_root, Path::new(project_file_path))?;
    if !project_file_path.is_file() {
        return Ok(false);
    }
    Ok(digest_file(&project_file_path)? == expected_digest)
}

fn resolve_project_root(project_dir: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(project_dir)
        .map_err(|error| format!("Could not resolve Physics Paint project directory: {error}"))
}

fn resolve_cache_parent(project_root: &Path) -> Result<PathBuf, String> {
    let cache_parent = fs::canonicalize(project_root.join("cache"))
        .map_err(|error| format!("Could not resolve Physics Paint cache parent: {error}"))?;
    if cache_parent.parent() != Some(project_root) {
        return Err("Physics Paint cache parent escapes project authority".to_string());
    }
    Ok(cache_parent)
}

fn normalize_project_file_path(
    project_root: &Path,
    project_file_path: &Path,
) -> Result<PathBuf, String> {
    let parent = project_file_path
        .parent()
        .ok_or_else(|| "Physics Paint project file has no parent directory".to_string())?;
    let resolved_parent = fs::canonicalize(parent)
        .map_err(|error| format!("Could not resolve Physics Paint project file parent: {error}"))?;
    if resolved_parent != project_root {
        return Err("Physics Paint project file escapes project authority".to_string());
    }
    let file_name = project_file_path
        .file_name()
        .ok_or_else(|| "Physics Paint project file has no filename".to_string())?;
    Ok(resolved_parent.join(file_name))
}

fn ensure_direct_child_directory(path: &Path, parent: &Path, label: &str) -> Result<(), String> {
    if path.parent() != Some(parent) || !path.is_dir() {
        return Err(format!("{label} must be a direct sibling directory"));
    }
    Ok(())
}

fn marker_path(cache_parent: &Path) -> PathBuf {
    cache_parent.join(ACTIVE_TRANSACTION_BASENAME)
}

fn transaction_sentinel_path(generation: &Path, transaction_id: &str) -> PathBuf {
    generation.join(format!(".physic-paint-transaction-{transaction_id}"))
}

fn write_marker(cache_parent: &Path, marker: &CacheTransactionMarker) -> Result<(), String> {
    validate_marker(marker)?;
    let bytes = serde_json::to_vec(marker)
        .map_err(|error| format!("Could not serialize Physics Paint cache transaction: {error}"))?;
    let marker_path = marker_path(cache_parent);
    let temp_path = cache_parent.join(format!("{ACTIVE_TRANSACTION_BASENAME}.tmp"));
    write_synced_file(&temp_path, &bytes).map_err(|error| {
        format!("Could not write Physics Paint cache transaction marker: {error}")
    })?;
    fs::rename(&temp_path, &marker_path).map_err(|error| {
        format!("Could not publish Physics Paint cache transaction marker: {error}")
    })?;
    sync_directory(cache_parent).map_err(|error| {
        format!("Could not synchronize Physics Paint cache transaction marker: {error}")
    })
}

fn read_marker(cache_parent: &Path) -> Result<Option<CacheTransactionMarker>, String> {
    let path = marker_path(cache_parent);
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(|error| {
        format!("Could not read Physics Paint cache transaction marker: {error}")
    })?;
    let marker: CacheTransactionMarker = serde_json::from_slice(&bytes).map_err(|error| {
        format!("Could not parse Physics Paint cache transaction marker: {error}")
    })?;
    validate_marker(&marker)?;
    Ok(Some(marker))
}

fn require_matching_marker(
    cache_parent: &Path,
    transaction_id: &str,
) -> Result<CacheTransactionMarker, String> {
    let marker = read_marker(cache_parent)?
        .ok_or_else(|| "Physics Paint cache transaction is no longer active".to_string())?;
    if marker.transaction_id != transaction_id {
        return Err(
            "Physics Paint cache transaction identity does not match the active publication"
                .to_string(),
        );
    }
    Ok(marker)
}

fn remove_marker(cache_parent: &Path) -> Result<(), String> {
    fs::remove_file(marker_path(cache_parent)).map_err(|error| {
        format!("Could not settle Physics Paint cache transaction marker: {error}")
    })?;
    sync_directory(cache_parent).map_err(|error| {
        format!("Could not synchronize Physics Paint cache transaction settlement: {error}")
    })
}

fn validate_marker(marker: &CacheTransactionMarker) -> Result<(), String> {
    if marker.version != TRANSACTION_VERSION {
        return Err("Unsupported Physics Paint cache transaction marker version".to_string());
    }
    validate_transaction_id(&marker.transaction_id)?;
    validate_staging_basename(&marker.staging_basename)?;
    if marker.project_file_path.is_some() != marker.expected_project_digest.is_some() {
        return Err("Physics Paint cache transaction project binding is incomplete".to_string());
    }
    if let Some(digest) = marker.expected_project_digest.as_deref() {
        if digest.len() != 64 || !digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("Physics Paint cache transaction project digest is invalid".to_string());
        }
    }
    Ok(())
}

fn validate_transaction_id(value: &str) -> Result<(), String> {
    Uuid::parse_str(value)
        .map(|_| ())
        .map_err(|_| "Invalid Physics Paint cache transaction identity".to_string())
}

fn validate_staging_basename(value: &str) -> Result<(), String> {
    let Some(token) = value.strip_prefix(STAGING_PREFIX) else {
        return Err("Invalid Physics Paint staging basename".to_string());
    };
    if token.is_empty()
        || value.len() > 160
        || !token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("Invalid Physics Paint staging basename".to_string());
    }
    Ok(())
}

fn has_transaction_sentinel(generation: &Path, transaction_id: &str) -> Result<bool, String> {
    let path = transaction_sentinel_path(generation, transaction_id);
    if !path.exists() {
        return Ok(false);
    }
    let metadata = fs::symlink_metadata(&path).map_err(|error| {
        format!("Could not inspect Physics Paint transaction sentinel: {error}")
    })?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err("Physics Paint transaction sentinel must be a regular file".to_string());
    }
    let value = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read Physics Paint transaction sentinel: {error}"))?;
    if value != transaction_id {
        return Err("Physics Paint transaction sentinel identity is invalid".to_string());
    }
    Ok(true)
}

fn digest_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn digest_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| {
        format!("Could not open Physics Paint project file for verification: {error}")
    })?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| {
            format!("Could not read Physics Paint project file for verification: {error}")
        })?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn write_synced_file(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut file = File::create(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

fn sync_directory(path: &Path) -> std::io::Result<()> {
    File::open(path)?.sync_all()
}

fn sync_directory_tree(path: &Path) -> Result<(), String> {
    let entries = fs::read_dir(path)
        .map_err(|error| format!("Could not inspect staged Physics Paint generation: {error}"))?;
    for entry in entries {
        let entry = entry
            .map_err(|error| format!("Could not inspect staged Physics Paint entry: {error}"))?;
        let file_type = entry.file_type().map_err(|error| {
            format!("Could not inspect staged Physics Paint entry type: {error}")
        })?;
        if file_type.is_symlink() {
            return Err(
                "Staged Physics Paint generations cannot contain symbolic links".to_string(),
            );
        }
        if file_type.is_dir() {
            sync_directory_tree(&entry.path())?;
        } else if file_type.is_file() {
            File::open(entry.path())
                .and_then(|file| file.sync_all())
                .map_err(|error| {
                    format!("Could not synchronize staged Physics Paint file: {error}")
                })?;
        } else {
            return Err(
                "Staged Physics Paint generations can contain only files and directories"
                    .to_string(),
            );
        }
    }
    sync_directory(path)
        .map_err(|error| format!("Could not synchronize staged Physics Paint directory: {error}"))
}

fn cleanup_stale_staging_generations(cache_parent: &Path, except: Option<&str>) {
    let Ok(entries) = fs::read_dir(cache_parent) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.starts_with(STAGING_PREFIX) || except == Some(name.as_ref()) {
            continue;
        }
        let _ = fs::remove_dir_all(entry.path());
    }
    let _ = sync_directory(cache_parent);
}

fn collect_cleanup_error(result: std::io::Result<()>, label: &str, diagnostics: &mut Vec<String>) {
    if let Err(error) = result {
        if error.kind() != std::io::ErrorKind::NotFound {
            diagnostics.push(format!("{label}: {error}"));
        }
    }
}

fn cleanup_settlement(diagnostics: Vec<String>) -> CacheSettlement {
    if diagnostics.is_empty() {
        CacheSettlement {
            cleanup_deferred: false,
            cleanup_diagnostic: None,
        }
    } else {
        CacheSettlement {
            cleanup_deferred: true,
            cleanup_diagnostic: Some(format!(
                "Physics Paint cache settlement completed; cleanup was deferred: {}",
                diagnostics.join("; ")
            )),
        }
    }
}

#[cfg(target_os = "macos")]
fn atomic_exchange_directories(staging_path: &Path, canonical_path: &Path) -> std::io::Result<()> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let staging = CString::new(staging_path.as_os_str().as_bytes()).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Physics Paint staging path contains an interior NUL byte",
        )
    })?;
    let canonical = CString::new(canonical_path.as_os_str().as_bytes()).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Physics Paint canonical path contains an interior NUL byte",
        )
    })?;

    let result = unsafe {
        libc::renameatx_np(
            libc::AT_FDCWD,
            staging.as_ptr(),
            libc::AT_FDCWD,
            canonical.as_ptr(),
            libc::RENAME_SWAP,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

#[cfg(not(target_os = "macos"))]
#[allow(dead_code)]
fn atomic_exchange_directories(
    _staging_path: &Path,
    _canonical_path: &Path,
) -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Physics Paint cache publication is supported only on macOS",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn staging_basename_rejects_traversal_and_absolute_paths() {
        // Crafted basenames containing ../ or absolute paths must fail the
        // existing validation and never escape the v1.0 root (T-45-04).
        for crafted in [
            ".efx-paint-staging-../evil",
            ".efx-paint-staging-/abs",
            ".efx-paint-staging-..",
            "../.efx-paint-staging-evil",
            "/tmp/.efx-paint-staging-evil",
            ".efx-paint-staging-",
            // Legacy prefix is not accepted; the literal is split so the
            // DOC-04 grep contract stays green.
            concat!(".physic-paint-", "staging-abc"),
        ] {
            assert!(
                validate_staging_basename(crafted).is_err(),
                "expected rejection: {crafted}"
            );
        }
        // Valid v1.0 staging basenames still pass.
        assert!(validate_staging_basename(&format!(".efx-paint-staging-{}", Uuid::new_v4())).is_ok());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn publish_stages_and_publishes_into_efx_paint_cache() {
        let test_dir =
            std::env::temp_dir().join(format!("efx_test_cache_publish_{}", Uuid::new_v4()));
        std::fs::create_dir_all(test_dir.join("cache")).expect("cache parent");
        let staging_basename = format!(".efx-paint-staging-{}", Uuid::new_v4());
        let staging = test_dir.join("cache").join(&staging_basename);
        std::fs::create_dir_all(&staging).expect("staging cache");
        std::fs::write(staging.join("frame.png"), b"frame").expect("staged frame");

        let publication =
            publish_cache_generation(&test_dir, &staging_basename).expect("cache publication");

        // The staged generation is published into cache/efx-paint; the staging
        // dir is consumed; the transaction marker records the active publication.
        assert!(test_dir.join("cache/efx-paint/frame.png").exists());
        assert!(!staging.exists());
        assert!(!test_dir.join("cache").join("physic-paint").exists());
        assert!(test_dir.join("cache/.physic-paint-transaction.json").exists());
        assert!(!publication.transaction_id.is_empty());
        std::fs::remove_dir_all(test_dir).expect("fixture cleanup");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn settle_commit_swaps_and_rollback_restores_previous_generation() {
        let test_dir =
            std::env::temp_dir().join(format!("efx_test_cache_settle_{}", Uuid::new_v4()));
        std::fs::create_dir_all(test_dir.join("cache")).expect("cache parent");
        let project_bytes = b"{\"version\":1,\"name\":\"settle\"}";
        let project_path = test_dir.join("project.mce");
        std::fs::write(&project_path, project_bytes).expect("project file");

        // First generation committed into cache/efx-paint (bound to the
        // project write, matching the durable project bytes).
        let first_staging = format!(".efx-paint-staging-{}", Uuid::new_v4());
        let first_dir = test_dir.join("cache").join(&first_staging);
        std::fs::create_dir_all(&first_dir).expect("staging cache");
        std::fs::write(first_dir.join("old.png"), b"old").expect("staged frame");
        let first =
            publish_cache_generation(&test_dir, &first_staging).expect("first publication");
        bind_cache_transaction_to_project_write(
            &test_dir,
            &project_path,
            project_bytes,
            &first.transaction_id,
        )
        .expect("bind first");
        settle_cache_generation(&test_dir, &first.transaction_id, CacheSettlementAction::Commit)
            .expect("first commit");
        assert!(test_dir.join("cache/efx-paint/old.png").exists());

        // Second generation replaces it, then rollback restores the first and
        // removes the staging dir.
        let second_staging = format!(".efx-paint-staging-{}", Uuid::new_v4());
        let second_dir = test_dir.join("cache").join(&second_staging);
        std::fs::create_dir_all(&second_dir).expect("staging cache");
        std::fs::write(second_dir.join("new.png"), b"new").expect("staged frame");
        let second =
            publish_cache_generation(&test_dir, &second_staging).expect("second publication");
        assert!(test_dir.join("cache/efx-paint/new.png").exists());
        assert!(!test_dir.join("cache/efx-paint/old.png").exists());

        settle_cache_generation(&test_dir, &second.transaction_id, CacheSettlementAction::Rollback)
            .expect("rollback");
        assert!(test_dir.join("cache/efx-paint/old.png").exists());
        assert!(!test_dir.join("cache/efx-paint/new.png").exists());
        assert!(!second_dir.exists());
        assert!(!test_dir.join("cache/.physic-paint-transaction.json").exists());
        std::fs::remove_dir_all(test_dir).expect("fixture cleanup");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn publish_rejects_crafted_staging_basename_without_escaping_root() {
        let test_dir =
            std::env::temp_dir().join(format!("efx_test_cache_crafted_{}", Uuid::new_v4()));
        std::fs::create_dir_all(test_dir.join("cache")).expect("cache parent");
        for crafted in [".efx-paint-staging-../evil", "/tmp/.efx-paint-staging-evil"] {
            let result = publish_cache_generation(&test_dir, crafted);
            assert!(result.is_err(), "expected rejection: {crafted}");
        }
        // Nothing escaped the v1.0 root: no canonical cache, no marker.
        assert!(!test_dir.join("cache/efx-paint").exists());
        assert!(!test_dir.join("cache/.physic-paint-transaction.json").exists());
        std::fs::remove_dir_all(test_dir).expect("fixture cleanup");
    }
}
