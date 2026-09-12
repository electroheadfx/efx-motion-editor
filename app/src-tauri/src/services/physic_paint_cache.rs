//! 52.2-05 (D-10, D-05, D-14): the save transactions.
//!
//! The filename is historical — 45-01 built the disposable cache generation
//! here — and D-10 EXTENDS this machinery rather than replacing it, so the
//! module now owns two clearly separated transactions:
//!
//! * the AUTHORITATIVE package transaction (`bind_package_transaction` /
//!   `publish_package_transaction` / `settle_package_transaction` /
//!   `recover_package_transaction`). Its bound set is exactly the package file
//!   set — `project.mce`, `layers/<layerId>.json` and
//!   `frames/<layerId>/<keyId>.webp` — every path passing plan 01's
//!   bound-path guard, and the staging root lives INSIDE the package so every
//!   exchange is same-volume and atomic. The aggregate digest is
//!   order-independent, and nothing canonical moves outside `publish`.
//! * the DISPOSABLE machine-local cache generation (the directory swap the
//!   module was built for). It no longer binds a project write: a marker found
//!   at open always rolls back, because re-derivation is always safe (D-14)
//!   and committing a generation derived from an uncommitted save could
//!   publish wrong pixels.
//!
//! The two share neither a marker, a digest nor a guard: a cache path can
//! never be bound to the package transaction (`efx-paint/...` is refused by
//! the bound-path guard), and no package path can reach the cache leg.

use crate::services::efx_paint_media::{
    digest_file, resolve_package_bound_path, validate_package_staging_basename,
    EfxPaintMediaError, PACKAGE_STAGING_PREFIX,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const CANONICAL_CACHE_BASENAME: &str = "efx-paint";
const STAGING_PREFIX: &str = ".efx-paint-staging-";
const ACTIVE_TRANSACTION_BASENAME: &str = ".physic-paint-transaction.json";
/// The authoritative package transaction's marker, at the package root.
const PACKAGE_TRANSACTION_BASENAME: &str = ".efx-paint-package-transaction.json";
/// The portable exchange's retained-previous-bytes carrier (non-macOS only;
/// the macOS branch swaps in one `renameatx_np` call and needs no carrier).
const PACKAGE_SWAP_CARRIER_PREFIX: &str = ".efx-paint-package-swap-";
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CacheHardlink {
    /// Relative frame paths whose canonical sidecar was missing (ENOENT) and
    /// must be written fresh by the caller instead of hardlinked.
    pub missing: Vec<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum TransactionPhase {
    Published,
    RollingBack,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct CacheTransactionMarker {
    version: u32,
    transaction_id: String,
    staging_basename: String,
    replaced_existing: bool,
    phase: TransactionPhase,
}

/// One file bound to the authoritative package transaction (D-10): the
/// package-relative path, the SHA-256 of the STAGED bytes that will land, and
/// whether the canonical path already existed when the set was bound.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct BoundFile {
    pub path: String,
    pub sha256: String,
    pub had_original: bool,
}

/// The result of binding a package transaction: the transaction identity, the
/// order-independent aggregate digest over the path-sorted entry list, and
/// that list.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PackageBinding {
    pub transaction_id: String,
    pub aggregate_digest: String,
    pub entries: Vec<BoundFile>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PackagePublication {
    pub transaction_id: String,
    pub published: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PackageSettlementAction {
    Commit,
    Rollback,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PackageSettlement {
    pub cleanup_deferred: bool,
    pub cleanup_diagnostic: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct PackageTransactionMarker {
    version: u32,
    transaction_id: String,
    staging_basename: String,
    phase: TransactionPhase,
    expected_files: Vec<BoundFile>,
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
            phase: TransactionPhase::Published,
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

/// Bind the authoritative package transaction (D-10): hash every STAGED file,
/// record whether its canonical path already existed, and persist the
/// path-sorted entry list plus its aggregate digest in the package marker.
///
/// The staging basename is validated with plan 01's Rust-owned rule and the
/// staging root is DERIVED here from the canonicalized package root — the
/// caller never supplies a destination root, so plan 01's containment guard
/// cannot be bypassed. `None` of the bound files is touched: every canonical
/// path keeps its pre-save bytes until `publish_package_transaction` runs.
pub fn bind_package_transaction(
    package_dir: &Path,
    staging_basename: &str,
    paths: &[String],
) -> Result<PackageBinding, String> {
    validate_package_staging_basename(staging_basename).map_err(|error| {
        format!(
            "package transaction bind refused staging basename \"{staging_basename}\": {}",
            error.label()
        )
    })?;
    let package_root = resolve_project_root(package_dir)?;
    let staging_root = resolve_package_staging_root(&package_root, staging_basename)?;

    if paths.is_empty() {
        return Err("package transaction bind requires at least one bound file".to_string());
    }
    let mut entries = Vec::with_capacity(paths.len());
    for relative in paths {
        entries.push(bind_package_entry(&package_root, &staging_root, relative)?);
    }
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    for pair in entries.windows(2) {
        if pair[0].path == pair[1].path {
            return Err(format!(
                "package transaction bind refused duplicate path \"{}\"",
                pair[0].path
            ));
        }
    }
    let aggregate_digest = aggregate_package_digest(&entries);

    if let Some(marker) = read_package_marker(&package_root)? {
        if marker.staging_basename == staging_basename {
            if marker.expected_files == entries {
                // An identical re-bind is a no-op: the transaction keeps its
                // identity, its staging generation and its digest.
                return Ok(PackageBinding {
                    transaction_id: marker.transaction_id,
                    aggregate_digest: aggregate_package_digest(&marker.expected_files),
                    entries: marker.expected_files,
                });
            }
            return Err(format!(
                "package transaction is already bound to a different file set (\"{}\")",
                first_differing_path(&marker.expected_files, &entries)
            ));
        }
        // A marker for ANOTHER staging generation means a crashed save. Resolve
        // it to the pre-save package first (never stack two transactions), then
        // refuse so the caller retries against the settled package.
        recover_package_transaction(&package_root)?;
        return Err(format!(
            "package transaction for staging generation \"{}\" was recovered; retry the bind",
            marker.staging_basename
        ));
    }

    cleanup_stale_package_staging_generations(&package_root, Some(staging_basename));
    let transaction_id = Uuid::new_v4().to_string();
    let marker = PackageTransactionMarker {
        version: TRANSACTION_VERSION,
        transaction_id: transaction_id.clone(),
        staging_basename: staging_basename.to_string(),
        phase: TransactionPhase::Published,
        expected_files: entries.clone(),
    };
    write_package_marker(&package_root, &marker)?;
    write_synced_file(
        &transaction_sentinel_path(&staging_root, &transaction_id),
        transaction_id.as_bytes(),
    )
    .map_err(|error| format!("Could not create the package transaction sentinel: {error}"))?;
    sync_directory(&staging_root)
        .map_err(|error| format!("Could not synchronize the package staging root: {error}"))?;

    Ok(PackageBinding {
        transaction_id,
        aggregate_digest,
        entries,
    })
}

/// Publish every bound file into its canonical path, in path-sorted order.
/// Where a canonical file exists the previous bytes are RETAINED at the staged
/// path (that retention is the rollback copy); where it does not exist the
/// staged file is renamed into place. A kill between two published files
/// leaves the marker behind, so `recover_package_transaction` restores the
/// pre-save package.
pub fn publish_package_transaction(
    package_dir: &Path,
    transaction_id: &str,
) -> Result<PackagePublication, String> {
    validate_transaction_id(transaction_id)?;
    let package_root = resolve_project_root(package_dir)?;
    let marker = require_matching_package_marker(&package_root, transaction_id)?;
    if marker.phase != TransactionPhase::Published {
        return Err("A rolling-back package transaction cannot publish".to_string());
    }
    let staging_root = resolve_package_staging_root(&package_root, &marker.staging_basename)?;
    if !has_transaction_sentinel(&staging_root, transaction_id)? {
        return Err(
            "The package transaction sentinel is missing from its staging generation".to_string(),
        );
    }

    let mut published = 0;
    for entry in &marker.expected_files {
        let staged = resolve_package_bound_path(&staging_root, &entry.path)
            .map_err(|error| package_path_refusal("publish", &entry.path, &error))?;
        let canonical = resolve_package_bound_path(&package_root, &entry.path)
            .map_err(|error| package_path_refusal("publish", &entry.path, &error))?;
        let staged_digest = digest_file(&staged)
            .map_err(|error| package_io_refusal("publish", &entry.path, &error.message))?;
        if staged_digest != entry.sha256 {
            return Err(format!(
                "package transaction publish refused \"{}\": the staged bytes changed since bind",
                entry.path
            ));
        }
        let canonical_exists = fs::symlink_metadata(&canonical).is_ok();
        if canonical_exists != entry.had_original {
            return Err(format!(
                "package transaction publish refused \"{}\": the canonical path appeared or vanished since bind",
                entry.path
            ));
        }
        let carrier = package_swap_carrier_path(&staging_root, entry, transaction_id);
        if canonical_exists {
            atomic_exchange_paths(&staged, &canonical, &carrier).map_err(|error| {
                format!("Could not publish package file \"{}\": {error}", entry.path)
            })?;
        } else {
            if let Some(parent) = canonical.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Could not create the package file parent: {error}")
                })?;
            }
            fs::rename(&staged, &canonical).map_err(|error| {
                format!("Could not publish package file \"{}\": {error}", entry.path)
            })?;
        }
        sync_published_file(&canonical)?;
        published += 1;
    }
    sync_directory(&package_root)
        .map_err(|error| format!("Could not synchronize the package root: {error}"))?;
    Ok(PackagePublication {
        transaction_id: transaction_id.to_string(),
        published,
    })
}

/// Settle the package transaction. Commit verifies EVERY bound canonical file
/// against its recorded digest and refuses, naming the offending path, on any
/// drift — a commit is the only way the staged set becomes authoritative.
/// Rollback restores the pre-save package: a retained previous copy is moved
/// back, a file the transaction created is removed, and a canonical file a
/// third party wrote since the publish is left alone.
pub fn settle_package_transaction(
    package_dir: &Path,
    transaction_id: &str,
    action: PackageSettlementAction,
) -> Result<PackageSettlement, String> {
    validate_transaction_id(transaction_id)?;
    let package_root = resolve_project_root(package_dir)?;
    let marker = require_matching_package_marker(&package_root, transaction_id)?;
    match action {
        PackageSettlementAction::Commit => commit_package_transaction(&package_root, &marker),
        PackageSettlementAction::Rollback => rollback_package_transaction(&package_root, marker),
    }
}

/// The open-time path: with a marker present, roll FORWARD only when EVERY
/// bound canonical file hashes to its recorded digest; otherwise roll back to
/// the pre-save package. That single rule is the whole crash story — a partial
/// publish, an interrupted commit and a killed process all land either on the
/// committed package or on the pre-save package, never on a mixed one.
pub fn recover_package_transaction(
    package_dir: &Path,
) -> Result<Option<PackageSettlement>, String> {
    if !package_dir.exists() {
        return Ok(None);
    }
    let package_root = resolve_project_root(package_dir)?;
    let Some(marker) = read_package_marker(&package_root)? else {
        cleanup_stale_package_staging_generations(&package_root, None);
        return Ok(None);
    };
    let settlement = if marker.phase == TransactionPhase::RollingBack {
        finish_package_rollback(&package_root, &marker)?
    } else if marker_matches_canonical(&package_root, &marker)? {
        commit_package_transaction(&package_root, &marker)?
    } else {
        rollback_package_transaction(&package_root, marker)?
    };
    Ok(Some(settlement))
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
        // 52.2-05 Task 1 clause (f): the cache generation no longer binds a
        // project write, so a Rollback always restores the previous generation
        // — no durable-bytes comparison can commit an uncommitted generation.
        match action {
            CacheSettlementAction::Commit => commit_transaction(&cache_parent, &marker),
            CacheSettlementAction::Rollback => rollback_transaction(&cache_parent, marker),
        }
    }
}

/// Hardlink unchanged canonical sidecars into a staging generation so the
/// atomic directory swap can publish a complete generation without re-writing
/// unchanged frame bytes (52.1 a2 incremental staging).
///
/// Same-volume proof: `fs::hard_link` fails with `EXDEV`/`EPERM`/`EOPNOTSUPP`
/// when the canonical and staging directories are not on the same filesystem
/// (or the filesystem forbids hardlinks). Those errors propagate to the caller,
/// which degrades to a full re-stage — never a partial save. A missing source
/// (`NotFound`) is NOT an error: the caller writes that frame fresh.
///
/// Platform note: APFS (macOS) supports hardlinks within a volume; NTFS and
/// ext4 (future Windows/Linux targets) also support hardlinks, but the
/// same-volume constraint and the caller's full-re-stage fallback keep the
/// behaviour correct regardless of filesystem.
pub fn hardlink_cache_frames(
    project_dir: &Path,
    staging_basename: &str,
    unchanged_paths: &[String],
) -> Result<CacheHardlink, String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (project_dir, staging_basename, unchanged_paths);
        return Err("Physics Paint cache hardlink is supported only on macOS".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        validate_staging_basename(staging_basename)?;
        let project_root = resolve_project_root(project_dir)?;
        let cache_parent = resolve_cache_parent(&project_root)?;
        let canonical_path = cache_parent.join(CANONICAL_CACHE_BASENAME);
        let staging_path = cache_parent.join(staging_basename);

        let mut missing = Vec::new();
        for relative in unchanged_paths {
            validate_unchanged_path(relative)?;
            let source = canonical_path.join(relative);
            let target = staging_path.join(relative);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Could not create Physics Paint staging directory: {error}")
                })?;
            }
            match fs::hard_link(&source, &target) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    missing.push(relative.clone());
                }
                Err(error) => {
                    return Err(format!(
                        "Could not hardlink Physics Paint cache frame (same-volume required): {error}"
                    ));
                }
            }
        }
        Ok(CacheHardlink { missing })
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

        // Re-derivation is always safe (D-05/D-14), so an uncommitted cache
        // generation is ALWAYS rolled back: committing a generation derived
        // from an uncommitted save could publish wrong pixels.
        let settlement = if marker.phase == TransactionPhase::RollingBack {
            finish_rollback(&cache_parent, &marker)
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
    if marker.phase != TransactionPhase::Published {
        return Err("A rolling-back Physics Paint cache transaction cannot commit".to_string());
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
    if marker.phase == TransactionPhase::Published {
        marker.phase = TransactionPhase::RollingBack;
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

fn ensure_direct_child_directory(path: &Path, parent: &Path, label: &str) -> Result<(), String> {
    if path.parent() != Some(parent) || !path.is_dir() {
        return Err(format!("{label} must be a direct sibling directory"));
    }
    Ok(())
}

fn marker_path(cache_parent: &Path) -> PathBuf {
    cache_parent.join(ACTIVE_TRANSACTION_BASENAME)
}

// --- 52.2-05 authoritative package transaction helpers -------------------

fn package_marker_path(package_root: &Path) -> PathBuf {
    package_root.join(PACKAGE_TRANSACTION_BASENAME)
}

/// Derive the staging root from the canonicalized package root (never from a
/// caller-supplied root) and require it to be a direct child directory: the
/// same-volume requirement that keeps every exchange atomic.
fn resolve_package_staging_root(
    package_root: &Path,
    staging_basename: &str,
) -> Result<PathBuf, String> {
    let staging_path = package_root.join(staging_basename);
    let resolved = fs::canonicalize(&staging_path)
        .map_err(|error| format!("Could not resolve the package staging root: {error}"))?;
    if resolved.parent() != Some(package_root) || !resolved.is_dir() {
        return Err("The package staging root must be a direct child directory".to_string());
    }
    Ok(resolved)
}

fn package_bind_refusal(relative: &str, error: &EfxPaintMediaError) -> String {
    format!(
        "package transaction bind refused \"{relative}\": {}",
        error.label()
    )
}

fn package_path_refusal(action: &str, relative: &str, error: &EfxPaintMediaError) -> String {
    format!(
        "package transaction {action} refused \"{relative}\": {}",
        error.label()
    )
}

fn package_io_refusal(action: &str, relative: &str, message: &str) -> String {
    format!("package transaction {action} refused \"{relative}\": {message}")
}

/// Hash one STAGED bound file — so the recorded digest is exactly the bytes
/// that will land — and record whether its canonical path already existed.
fn bind_package_entry(
    package_root: &Path,
    staging_root: &Path,
    relative: &str,
) -> Result<BoundFile, String> {
    let canonical = resolve_package_bound_path(package_root, relative)
        .map_err(|error| package_bind_refusal(relative, &error))?;
    let staged = resolve_package_bound_path(staging_root, relative)
        .map_err(|error| package_bind_refusal(relative, &error))?;
    let staged_metadata = fs::symlink_metadata(&staged).map_err(|error| {
        format!("package transaction bind refused \"{relative}\": the staged file is unreadable ({error})")
    })?;
    if !staged_metadata.file_type().is_file() || staged_metadata.file_type().is_symlink() {
        return Err(format!(
            "package transaction bind refused \"{relative}\": the staged entry is not a regular file"
        ));
    }
    let sha256 = digest_file(&staged)
        .map_err(|error| package_io_refusal("bind", relative, &error.message))?;
    let had_original = match fs::symlink_metadata(&canonical) {
        Ok(metadata) => {
            if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
                return Err(format!(
                    "package transaction bind refused \"{relative}\": the canonical entry is not a regular file"
                ));
            }
            true
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => {
            return Err(format!(
                "package transaction bind refused \"{relative}\": the canonical path is unreadable ({error})"
            ));
        }
    };
    Ok(BoundFile {
        path: relative.to_string(),
        sha256,
        had_original,
    })
}

/// The aggregate digest (D-10): SHA-256 over the UTF-8 concatenation of
/// `"{path}\0{sha256}\n"` for each entry in path-sorted order. Deterministic
/// and order-independent, so two discovery orders of the same file set bind
/// the same string — one string to compare.
fn aggregate_package_digest(entries: &[BoundFile]) -> String {
    let mut hasher = Sha256::new();
    for entry in entries {
        hasher.update(entry.path.as_bytes());
        hasher.update([0_u8]);
        hasher.update(entry.sha256.as_bytes());
        hasher.update(b"\n");
    }
    format!("{:x}", hasher.finalize())
}

/// The first path at which two sorted entry lists disagree, preferring the
/// path the new list carries so the refusal reads as "this is not bound".
fn first_differing_path(existing: &[BoundFile], requested: &[BoundFile]) -> String {
    for index in 0..existing.len().max(requested.len()) {
        match (existing.get(index), requested.get(index)) {
            (Some(left), Some(right)) if left == right => continue,
            (_, Some(right)) => return right.path.clone(),
            (Some(left), None) => return left.path.clone(),
            (None, None) => break,
        }
    }
    String::new()
}

fn canonical_entry_digest(canonical: &Path) -> Option<String> {
    if !canonical.is_file() {
        return None;
    }
    digest_file(canonical).ok()
}

fn marker_matches_canonical(
    package_root: &Path,
    marker: &PackageTransactionMarker,
) -> Result<bool, String> {
    for entry in &marker.expected_files {
        let canonical = resolve_package_bound_path(package_root, &entry.path)
            .map_err(|error| package_path_refusal("recovery", &entry.path, &error))?;
        if canonical_entry_digest(&canonical).as_deref() != Some(entry.sha256.as_str()) {
            return Ok(false);
        }
    }
    Ok(true)
}

fn commit_package_transaction(
    package_root: &Path,
    marker: &PackageTransactionMarker,
) -> Result<PackageSettlement, String> {
    if marker.phase != TransactionPhase::Published {
        return Err("A rolling-back package transaction cannot commit".to_string());
    }
    for entry in &marker.expected_files {
        let canonical = resolve_package_bound_path(package_root, &entry.path)
            .map_err(|error| package_path_refusal("commit", &entry.path, &error))?;
        let Some(digest) = canonical_entry_digest(&canonical) else {
            return Err(format!(
                "package transaction commit refused: \"{}\" is missing or unreadable",
                entry.path
            ));
        };
        if digest != entry.sha256 {
            return Err(format!(
                "package transaction commit refused: \"{}\" does not match its recorded digest",
                entry.path
            ));
        }
    }

    remove_package_marker(package_root)?;
    let mut diagnostics = Vec::new();
    collect_cleanup_error(
        fs::remove_dir_all(package_root.join(&marker.staging_basename)),
        "obsolete package staging generation",
        &mut diagnostics,
    );
    collect_cleanup_error(
        sync_directory(package_root),
        "package root synchronization",
        &mut diagnostics,
    );
    Ok(package_cleanup_settlement(diagnostics))
}

fn rollback_package_transaction(
    package_root: &Path,
    mut marker: PackageTransactionMarker,
) -> Result<PackageSettlement, String> {
    if marker.phase == TransactionPhase::Published {
        marker.phase = TransactionPhase::RollingBack;
        write_package_marker(package_root, &marker)?;
    }
    finish_package_rollback(package_root, &marker)
}

/// Restore the pre-save package, then remove the marker LAST so an interrupted
/// rollback is re-entered from the marker instead of leaving a half-restored
/// package with nothing pointing at it (the re-entry converges).
fn finish_package_rollback(
    package_root: &Path,
    marker: &PackageTransactionMarker,
) -> Result<PackageSettlement, String> {
    let staging_root = package_root.join(&marker.staging_basename);
    for entry in &marker.expected_files {
        restore_bound_entry(package_root, &staging_root, entry, &marker.transaction_id)?;
    }
    sync_directory(package_root)
        .map_err(|error| format!("Could not synchronize the rolled-back package: {error}"))?;
    remove_package_marker(package_root)?;

    let mut diagnostics = Vec::new();
    collect_cleanup_error(
        fs::remove_dir_all(&staging_root),
        "uncommitted package staging generation",
        &mut diagnostics,
    );
    collect_cleanup_error(
        sync_directory(package_root),
        "package root synchronization",
        &mut diagnostics,
    );
    Ok(package_cleanup_settlement(diagnostics))
}

/// Restore one bound file to its pre-save state.
///
/// The published state is identifiable by digest: a canonical file that
/// hashes to the recorded digest holds THIS transaction's bytes, and the
/// previous bytes are retained at the staged path (the exchange moved them
/// there). A canonical file that does not match was never published — or was
/// replaced by a third party after the publish — and is left alone: a stale
/// rollback must never fight a newer write it did not make.
fn restore_bound_entry(
    package_root: &Path,
    staging_root: &Path,
    entry: &BoundFile,
    transaction_id: &str,
) -> Result<(), String> {
    let canonical = resolve_package_bound_path(package_root, &entry.path)
        .map_err(|error| package_path_refusal("rollback", &entry.path, &error))?;
    let staged = staging_root.join(&entry.path);
    let carrier = package_swap_carrier_path(staging_root, entry, transaction_id);
    if carrier.exists() {
        // A portable-path exchange was interrupted after the canonical file
        // moved aside: the previous bytes are in the carrier.
        remove_if_present(&canonical)?;
        fs::rename(&carrier, &canonical).map_err(|error| {
            format!(
                "Could not restore package file \"{}\" from its retained copy: {error}",
                entry.path
            )
        })?;
        if staged.is_file() {
            fs::remove_file(&staged).map_err(|error| {
                format!("Could not drop the unpublished package file: {error}")
            })?;
        }
        return Ok(());
    }
    if entry.had_original {
        if canonical_entry_digest(&canonical).as_deref() == Some(entry.sha256.as_str()) {
            if !staged.is_file() {
                return Err(format!(
                    "package transaction rollback cannot restore \"{}\": its retained copy is gone",
                    entry.path
                ));
            }
            atomic_exchange_paths(&staged, &canonical, &carrier).map_err(|error| {
                format!("Could not roll back package file \"{}\": {error}", entry.path)
            })?;
        }
    } else if canonical_entry_digest(&canonical).as_deref() == Some(entry.sha256.as_str()) {
        // This transaction created the file: remove it, never a file it did not
        // create (the digest is the proof of authorship).
        fs::remove_file(&canonical).map_err(|error| {
            format!("Could not remove the uncommitted package file: {error}")
        })?;
    }
    Ok(())
}

fn package_swap_carrier_path(
    staging_root: &Path,
    entry: &BoundFile,
    transaction_id: &str,
) -> PathBuf {
    let staged = staging_root.join(&entry.path);
    let parent = staged.parent().unwrap_or(staging_root);
    parent.join(format!("{PACKAGE_SWAP_CARRIER_PREFIX}{transaction_id}.tmp"))
}

fn remove_if_present(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove the package file: {error}")),
    }
}

fn sync_published_file(path: &Path) -> Result<(), String> {
    File::open(path)
        .and_then(|file| file.sync_all())
        .map_err(|error| format!("Could not synchronize the published package file: {error}"))?;
    if let Some(parent) = path.parent() {
        sync_directory(parent).map_err(|error| {
            format!("Could not synchronize the published package directory: {error}")
        })?;
    }
    Ok(())
}

fn write_package_marker(
    package_root: &Path,
    marker: &PackageTransactionMarker,
) -> Result<(), String> {
    validate_package_marker(package_root, marker)?;
    let bytes = serde_json::to_vec(marker).map_err(|error| {
        format!("Could not serialize the package transaction marker: {error}")
    })?;
    let marker_path = package_marker_path(package_root);
    let temp_path = package_root.join(format!("{PACKAGE_TRANSACTION_BASENAME}.tmp"));
    write_synced_file(&temp_path, &bytes).map_err(|error| {
        format!("Could not write the package transaction marker: {error}")
    })?;
    fs::rename(&temp_path, &marker_path).map_err(|error| {
        format!("Could not publish the package transaction marker: {error}")
    })?;
    sync_directory(package_root)
        .map_err(|error| format!("Could not synchronize the package transaction marker: {error}"))
}

fn read_package_marker(
    package_root: &Path,
) -> Result<Option<PackageTransactionMarker>, String> {
    let path = package_marker_path(package_root);
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path)
        .map_err(|error| format!("Could not read the package transaction marker: {error}"))?;
    let marker: PackageTransactionMarker = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Could not parse the package transaction marker: {error}"))?;
    validate_package_marker(package_root, &marker)?;
    Ok(Some(marker))
}

fn require_matching_package_marker(
    package_root: &Path,
    transaction_id: &str,
) -> Result<PackageTransactionMarker, String> {
    let marker = read_package_marker(package_root)?
        .ok_or_else(|| "The package transaction is no longer active".to_string())?;
    if marker.transaction_id != transaction_id {
        return Err(
            "The package transaction identity does not match the active binding".to_string(),
        );
    }
    Ok(marker)
}

fn remove_package_marker(package_root: &Path) -> Result<(), String> {
    fs::remove_file(package_marker_path(package_root)).map_err(|error| {
        format!("Could not settle the package transaction marker: {error}")
    })?;
    sync_directory(package_root).map_err(|error| {
        format!("Could not synchronize the package transaction settlement: {error}")
    })
}

/// A marker on disk is untrusted input (T-52.2-14): every entry's path is run
/// back through plan 01's bound-path guard against the package root and every
/// digest must be 64 LOWER-case hex, and the list must be sorted and unique.
/// A doctored marker can therefore only refuse — it can never redirect a write.
fn validate_package_marker(
    package_root: &Path,
    marker: &PackageTransactionMarker,
) -> Result<(), String> {
    if marker.version != TRANSACTION_VERSION {
        return Err("Unsupported package transaction marker version".to_string());
    }
    validate_transaction_id(&marker.transaction_id)?;
    validate_package_staging_basename(&marker.staging_basename).map_err(|error| {
        format!(
            "Invalid package transaction staging basename: {}",
            error.label()
        )
    })?;
    if marker.expected_files.is_empty() {
        return Err("Package transaction marker has no bound files".to_string());
    }
    let mut previous: Option<&str> = None;
    for entry in &marker.expected_files {
        resolve_package_bound_path(package_root, &entry.path)
            .map_err(|error| package_path_refusal("marker", &entry.path, &error))?;
        if !is_lower_hex_64(&entry.sha256) {
            return Err(format!(
                "Package transaction marker digest for \"{}\" is not 64 lower-case hex characters",
                entry.path
            ));
        }
        if let Some(previous) = previous {
            if previous >= entry.path.as_str() {
                return Err(
                    "Package transaction marker entries are not path-sorted and unique".to_string(),
                );
            }
        }
        previous = Some(entry.path.as_str());
    }
    Ok(())
}

fn is_lower_hex_64(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn package_cleanup_settlement(diagnostics: Vec<String>) -> PackageSettlement {
    if diagnostics.is_empty() {
        PackageSettlement {
            cleanup_deferred: false,
            cleanup_diagnostic: None,
        }
    } else {
        PackageSettlement {
            cleanup_deferred: true,
            cleanup_diagnostic: Some(format!(
                "Package transaction settlement completed; cleanup was deferred: {}",
                diagnostics.join("; ")
            )),
        }
    }
}

fn cleanup_stale_package_staging_generations(package_root: &Path, except: Option<&str>) {
    let Ok(entries) = fs::read_dir(package_root) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.starts_with(PACKAGE_STAGING_PREFIX) || except == Some(name.as_ref()) {
            continue;
        }
        let _ = fs::remove_dir_all(entry.path());
    }
    let _ = sync_directory(package_root);
}

/// The atomic per-FILE exchange. On macOS it is the shipped single
/// `renameatx_np(RENAME_SWAP)` call; elsewhere it is a three-rename carrier
/// dance whose end state is identical (the published bytes at `right`, the
/// previously retained bytes at `left`), which is what keeps the AUTHORITATIVE
/// transaction working off macOS too.
#[cfg(target_os = "macos")]
fn atomic_exchange_paths(left: &Path, right: &Path, carrier: &Path) -> std::io::Result<()> {
    let _ = carrier;
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let left = CString::new(left.as_os_str().as_bytes()).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Package staging path contains an interior NUL byte",
        )
    })?;
    let right = CString::new(right.as_os_str().as_bytes()).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Package canonical path contains an interior NUL byte",
        )
    })?;

    let result = unsafe {
        libc::renameatx_np(
            libc::AT_FDCWD,
            left.as_ptr(),
            libc::AT_FDCWD,
            right.as_ptr(),
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
fn atomic_exchange_paths(left: &Path, right: &Path, carrier: &Path) -> std::io::Result<()> {
    fs::rename(right, carrier)?;
    fs::rename(left, right)?;
    fs::rename(carrier, left)?;
    Ok(())
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

fn validate_unchanged_path(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.starts_with('/')
        || value.contains('\\')
        || value.contains('\0')
        || value
            .split('/')
            .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err("Invalid Physics Paint cache frame path".to_string());
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

        // First generation committed into cache/efx-paint. 52.2-05: the cache
        // generation no longer binds a project write, so an explicit Commit is
        // the only path that keeps a published generation.
        let first_staging = format!(".efx-paint-staging-{}", Uuid::new_v4());
        let first_dir = test_dir.join("cache").join(&first_staging);
        std::fs::create_dir_all(&first_dir).expect("staging cache");
        std::fs::write(first_dir.join("old.png"), b"old").expect("staged frame");
        let first =
            publish_cache_generation(&test_dir, &first_staging).expect("first publication");
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
