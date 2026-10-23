//! quick-261023-l35: the Studio script snapshot service.
//! quick-261023-o3n: the snapshot now lives INSIDE the `.mce` package when the
//! project is saved, so the script travels with the project instead of dying
//! with the machine's app-data cache.
//!
//! The Studio's script stores (watercolor timeline + per-frame brush groups)
//! are session-scoped module state; closing the Studio destroys the webview
//! realm and their content with it. This service persists the encoded snapshot.
//! The renderer never touches a filesystem path: it sends an opaque
//! `scriptLibraryAuthority` token that the command exchanges for the canonical
//! package root inside Rust.
//!
//! PACKAGE PATH LAW (T-261023-o3n-01):
//!   `<package>/scripts/<layerId>/<trackId>-v1.snap`
//! One folder per layer, one file per track, version in the file name AND in
//! the unchanged SNAP v1 header.
//!
//! CACHE PATH LAW (l35 — the unsaved-project / fallback leg):
//!   `<app_data_dir>/studio-script-snapshots/<projectId>/<layerId>/<trackId>-v1.snap`
//!
//! RESTORE PRECEDENCE (T-261023-o3n-03): when an authority resolves, the
//! package copy is read FIRST. The cache is consulted ONLY when the package
//! file is `Missing` (the l35 migration path for projects written before this
//! quick). A package copy that is corrupt, foreign or a newer version is
//! terminal: falling back to the cache there could resurrect a STALE script
//! that the package copy superseded, so it never happens.
//!
//! WRITE TARGET: never dual-write. A bound authority writes only the package;
//! no authority writes only the cache. A stale or unresolvable authority is
//! refused on both legs by the command — the code never guesses a path.
//!
//! Every key component is validated BEFORE any `join`: 1..=128 bytes, every
//! byte in `[A-Za-z0-9._-]`, and no leading dot (which also rules out `.` and
//! `..`). A refused component returns `Refused` before a syscall, so a crafted
//! renderer value can never escape the root.
//!
//! WRITE is atomic: a sibling temp file in the destination directory, then a
//! rename over the target (mirrors `atomic_write_bytes` in `script_library.rs`
//! and `write_atomically` in `efx_paint_media.rs`). Any failure removes the
//! temp, so a failed save never leaves a partial snapshot behind.
//!
//! READ maps an absent file to `Missing` (the silent no-op path), checks the
//! on-disk length against `STUDIO_SCRIPT_SNAPSHOT_MAX_BYTES` BEFORE reading
//! (T-261023-l35-04), and computes the digest in Rust (`sha2`).
//!
//! Failures serialize for the wire as ONE fixed label string
//! (`missing` / `refused` / `io`), exactly like `EfxPaintMediaError` — a
//! filesystem path or detail is never serialized back.

use crate::services::efx_paint_media::{digest_bytes, EfxPaintMediaIoError};
use serde::{Serialize, Serializer};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// The cache root directory below `app_data_dir`.
pub const STUDIO_SCRIPT_SNAPSHOT_ROOT_DIR: &str = "studio-script-snapshots";

/// The one format version this service names in the file name. The container
/// codec repeats the same version in its header; a newer writer is refused by
/// the decoder before anything is allocated.
pub const STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION: u32 = 1;

/// Hard ceiling on one snapshot file, checked before a write and before a read.
pub const STUDIO_SCRIPT_SNAPSHOT_MAX_BYTES: u64 = 64 * 1024 * 1024;

/// One key component: 1..=128 bytes of `[A-Za-z0-9._-]`, no leading dot.
const KEY_COMPONENT_MAX_BYTES: usize = 128;

const SNAPSHOT_EXTENSION: &str = "snap";
const TEMP_PREFIX: &str = ".studio-script-snapshot-";

/// Typed failure classes. `Missing` is the Phase 49-style silent no-op, not a
/// refusal: the first Studio session on a project simply has no snapshot yet.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StudioScriptSnapshotError {
    /// No snapshot file exists for this key.
    Missing,
    /// A key component or a size broke a rule — nothing was read or written.
    Refused,
    /// A filesystem failure that is not a rule violation.
    Io(EfxPaintMediaIoError),
}

impl StudioScriptSnapshotError {
    /// Fixed wire label — never a path or a filesystem message.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Missing => "missing",
            Self::Refused => "refused",
            Self::Io(_) => "io",
        }
    }
}

impl Serialize for StudioScriptSnapshotError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.label())
    }
}

fn io_error(message: impl Into<String>) -> StudioScriptSnapshotError {
    StudioScriptSnapshotError::Io(EfxPaintMediaIoError::new(message))
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SnapshotWriteResult {
    pub byte_length: u64,
    pub digest: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SnapshotReadResult {
    pub byte_length: u64,
    /// Computed from the bytes actually read, never echoed from the caller.
    pub digest: String,
    pub bytes: Vec<u8>,
}

/// The cache root for one machine: `<app_data_dir>/studio-script-snapshots`.
pub fn snapshot_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(STUDIO_SCRIPT_SNAPSHOT_ROOT_DIR)
}

/// The one file name both roots share: `<trackId>-v1.snap`.
fn snapshot_file_name(track_id: &str) -> String {
    format!("{track_id}-v{STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION}.{SNAPSHOT_EXTENSION}")
}

/// The key law (T-261023-l35-01). One component at a time; never join an
/// unvalidated string.
pub fn validate_snapshot_key_component(value: &str) -> Result<(), StudioScriptSnapshotError> {
    if value.is_empty() || value.len() > KEY_COMPONENT_MAX_BYTES {
        return Err(StudioScriptSnapshotError::Refused);
    }
    if value.starts_with('.') {
        // Also rejects "." and ".." on its own.
        return Err(StudioScriptSnapshotError::Refused);
    }
    if !value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(StudioScriptSnapshotError::Refused);
    }
    Ok(())
}

/// Resolve one snapshot path below a validated root. Every component is checked
/// first; the join only ever runs on accepted values.
pub fn resolve_snapshot_path(
    root: &Path,
    project_id: &str,
    layer_id: &str,
    track_id: &str,
) -> Result<PathBuf, StudioScriptSnapshotError> {
    validate_snapshot_key_component(project_id)?;
    validate_snapshot_key_component(layer_id)?;
    validate_snapshot_key_component(track_id)?;
    Ok(root
        .join(project_id)
        .join(layer_id)
        .join(snapshot_file_name(track_id)))
}

/// Resolve one snapshot path below the `.mce` package's `scripts/` tree.
///
/// The package root comes ONLY from `ScriptLibraryState::resolve_authority_root`
/// (canonicalized Rust-side) — never from the renderer. Layer and track are
/// validated with the same key law before any join, so a crafted value can
/// never escape the package. The project id is NOT part of the package path:
/// the package IS the project.
pub fn resolve_package_snapshot_path(
    package_root: &Path,
    layer_id: &str,
    track_id: &str,
) -> Result<PathBuf, StudioScriptSnapshotError> {
    validate_snapshot_key_component(layer_id)?;
    validate_snapshot_key_component(track_id)?;
    Ok(package_root
        .join("scripts")
        .join(layer_id)
        .join(snapshot_file_name(track_id)))
}

/// Atomic snapshot write at an ALREADY-RESOLVED target: create the key
/// directories, write a sibling temp, fsync it, rename it over the target,
/// then fsync the directory.
fn write_snapshot_at(
    target: &Path,
    bytes: &[u8],
) -> Result<SnapshotWriteResult, StudioScriptSnapshotError> {
    if bytes.len() as u64 > STUDIO_SCRIPT_SNAPSHOT_MAX_BYTES {
        return Err(StudioScriptSnapshotError::Refused);
    }
    let parent = target
        .parent()
        .ok_or(StudioScriptSnapshotError::Refused)?
        .to_path_buf();
    fs::create_dir_all(&parent).map_err(|error| {
        io_error(format!("Could not create the snapshot directory: {error}"))
    })?;
    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or(StudioScriptSnapshotError::Refused)?;
    let temp_path = parent.join(format!("{TEMP_PREFIX}{file_name}.{}.tmp", Uuid::new_v4()));
    let result = (|| -> std::io::Result<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&temp_path, target)?;
        Ok(())
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temp_path);
        return Err(io_error(format!(
            "Could not write the studio script snapshot: {error}"
        )));
    }
    // Directory fsync is best-effort: the rename already made the snapshot
    // visible, and a directory fsync failure must not turn a successful write
    // into a reported failure.
    let _ = File::open(&parent).and_then(|directory| directory.sync_all());
    Ok(SnapshotWriteResult {
        byte_length: bytes.len() as u64,
        digest: digest_bytes(bytes),
    })
}

/// Guarded snapshot read at an ALREADY-RESOLVED target. An absent leaf is
/// `Missing` (silent no-op); an oversized or irregular leaf is `Refused`
/// BEFORE any read.
fn read_snapshot_at(target: &Path) -> Result<SnapshotReadResult, StudioScriptSnapshotError> {
    let metadata = match fs::metadata(target) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(StudioScriptSnapshotError::Missing);
        }
        Err(error) => {
            return Err(io_error(format!(
                "Could not inspect the studio script snapshot: {error}"
            )));
        }
    };
    if !metadata.is_file() || metadata.len() > STUDIO_SCRIPT_SNAPSHOT_MAX_BYTES {
        return Err(StudioScriptSnapshotError::Refused);
    }
    let bytes = fs::read(target).map_err(|error| {
        io_error(format!("Could not read the studio script snapshot: {error}"))
    })?;
    // The digest is computed from the bytes actually read, never from a
    // second open: the file could change between the two reads.
    Ok(SnapshotReadResult {
        byte_length: bytes.len() as u64,
        digest: digest_bytes(&bytes),
        bytes,
    })
}

/// Cache-leg write (unchanged l35 behaviour, thin wrapper over the shared
/// atomic writer).
pub fn write_snapshot(
    root: &Path,
    project_id: &str,
    layer_id: &str,
    track_id: &str,
    bytes: &[u8],
) -> Result<SnapshotWriteResult, StudioScriptSnapshotError> {
    let target = resolve_snapshot_path(root, project_id, layer_id, track_id)?;
    write_snapshot_at(&target, bytes)
}

/// Cache-leg read (unchanged l35 behaviour, thin wrapper over the shared
/// guarded reader).
pub fn read_snapshot(
    root: &Path,
    project_id: &str,
    layer_id: &str,
    track_id: &str,
) -> Result<SnapshotReadResult, StudioScriptSnapshotError> {
    let target = resolve_snapshot_path(root, project_id, layer_id, track_id)?;
    read_snapshot_at(&target)
}

/// Package-leg write: `<package>/scripts/<layerId>/<trackId>-v1.snap`.
pub fn write_package_snapshot(
    package_root: &Path,
    layer_id: &str,
    track_id: &str,
    bytes: &[u8],
) -> Result<SnapshotWriteResult, StudioScriptSnapshotError> {
    let target = resolve_package_snapshot_path(package_root, layer_id, track_id)?;
    write_snapshot_at(&target, bytes)
}

/// Package-leg read: `<package>/scripts/<layerId>/<trackId>-v1.snap`.
/// Test-only: production restore goes through `read_snapshot_preferring_package`,
/// which owns the package-first precedence law.
#[cfg(test)]
pub fn read_package_snapshot(
    package_root: &Path,
    layer_id: &str,
    track_id: &str,
) -> Result<SnapshotReadResult, StudioScriptSnapshotError> {
    let target = resolve_package_snapshot_path(package_root, layer_id, track_id)?;
    read_snapshot_at(&target)
}

/// Which root a restore consumed. Recorded so the precedence law is explicit
/// and testable; the wire never carries it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SnapshotSource {
    /// `<package>/scripts/<layerId>/<trackId>-v1.snap`
    Package,
    /// `<app_data_dir>/studio-script-snapshots/<projectId>/...` (l35 cache)
    Cache,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SnapshotReadOutcome {
    pub source: SnapshotSource,
    pub snapshot: SnapshotReadResult,
}

/// Read with the package-first precedence law (T-261023-o3n-03).
///
/// With a package root: read the package copy; ONLY a `Missing` package file
/// falls through to the cache (the l35 migration path). A `Refused` or `Io`
/// package read is terminal — a corrupt, foreign or newer-version package copy
/// must never cause the possibly older cache to be consumed. Without a package
/// root (unsaved project) the cache is the only leg.
pub fn read_snapshot_preferring_package(
    cache_root: &Path,
    package_root: Option<&Path>,
    project_id: &str,
    layer_id: &str,
    track_id: &str,
) -> Result<SnapshotReadOutcome, StudioScriptSnapshotError> {
    if let Some(package_root) = package_root {
        let target = resolve_package_snapshot_path(package_root, layer_id, track_id)?;
        match read_snapshot_at(&target) {
            Ok(snapshot) => {
                return Ok(SnapshotReadOutcome {
                    source: SnapshotSource::Package,
                    snapshot,
                })
            }
            Err(StudioScriptSnapshotError::Missing) => {}
            Err(error) => return Err(error),
        }
    }
    let snapshot = read_snapshot(cache_root, project_id, layer_id, track_id)?;
    Ok(SnapshotReadOutcome {
        source: SnapshotSource::Cache,
        snapshot,
    })
}

/// Write with the never-dual-write law: a bound package root receives the
/// snapshot and the cache is untouched; with no authority the cache is the
/// only destination. A failed package write is NEVER silently redirected to
/// the cache.
pub fn write_snapshot_preferring_package(
    cache_root: &Path,
    package_root: Option<&Path>,
    project_id: &str,
    layer_id: &str,
    track_id: &str,
    bytes: &[u8],
) -> Result<SnapshotWriteResult, StudioScriptSnapshotError> {
    match package_root {
        Some(package_root) => write_package_snapshot(package_root, layer_id, track_id, bytes),
        None => write_snapshot(cache_root, project_id, layer_id, track_id, bytes),
    }
}

/// Save As / Duplicate: carry every per-layer Studio script snapshot into the
/// new package (T-261023-o3n-05).
///
/// Only DIRECT layer folders whose name passes the key law are considered;
/// symlinks, plain files and invalid names are skipped silently. Inside a
/// layer folder only `<trackId>-<SNAPSHOT version>.snap` names whose track id
/// validates are copied — a different version, a foreign file, a hidden temp
/// file or a symlink is skipped. The destination path is derived ONLY from the
/// validated source names, so no file is ever merged across layers or tracks.
///
/// The bytes go through the shared guarded reader (64 MiB cap checked from
/// metadata BEFORE reading) and the shared atomic writer. Any `Io`/`Refused`
/// failure is propagated on purpose: `project_save_as_with_script_library`
/// rolls the destination package back when `migrate_active` fails, so a
/// snapshot that cannot be copied aborts the Save As instead of being silently
/// dropped.
pub fn migrate_package_snapshots(
    source_package_root: &Path,
    destination_package_root: &Path,
) -> Result<usize, StudioScriptSnapshotError> {
    let source_scripts = source_package_root.join("scripts");
    let metadata = match fs::symlink_metadata(&source_scripts) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(error) => {
            return Err(io_error(format!(
                "Could not inspect the package scripts directory: {error}"
            )))
        }
    };
    // A symlinked or non-directory `scripts/` is not a layout this service
    // writes, so there is nothing trustworthy to carry.
    if !metadata.is_dir() {
        return Ok(0);
    }
    let suffix = format!("-v{STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION}.{SNAPSHOT_EXTENSION}");
    let mut copied = 0usize;
    let layer_entries = fs::read_dir(&source_scripts).map_err(|error| {
        io_error(format!(
            "Could not scan the package scripts directory: {error}"
        ))
    })?;
    for layer_entry in layer_entries {
        let Ok(layer_entry) = layer_entry else {
            continue;
        };
        let Ok(layer_name) = layer_entry.file_name().into_string() else {
            continue;
        };
        if validate_snapshot_key_component(&layer_name).is_err() {
            continue;
        }
        let Ok(layer_type) = layer_entry.file_type() else {
            continue;
        };
        // `file_type` does not follow symlinks: a linked folder is skipped.
        if !layer_type.is_dir() {
            continue;
        }
        let layer_dir = source_scripts.join(&layer_name);
        let track_entries = fs::read_dir(&layer_dir).map_err(|error| {
            io_error(format!(
                "Could not scan a package layer script folder: {error}"
            ))
        })?;
        for track_entry in track_entries {
            let Ok(track_entry) = track_entry else {
                continue;
            };
            let Ok(file_name) = track_entry.file_name().into_string() else {
                continue;
            };
            let Some(track_id) = file_name.strip_suffix(suffix.as_str()) else {
                continue;
            };
            if validate_snapshot_key_component(track_id).is_err() {
                continue;
            }
            let Ok(file_type) = track_entry.file_type() else {
                continue;
            };
            // A symlink (or anything not a regular file) is never read/copied.
            if !file_type.is_file() {
                continue;
            }
            let snapshot = read_snapshot_at(&layer_dir.join(&file_name))?;
            let destination =
                resolve_package_snapshot_path(destination_package_root, &layer_name, track_id)?;
            write_snapshot_at(&destination, &snapshot.bytes)?;
            copied += 1;
        }
    }
    Ok(copied)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_root(tag: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "efx-studio-script-snapshot-{tag}-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("fixture root");
        root
    }

    #[test]
    fn key_law_rejects_traversal_separators_dots_and_oversized_components() {
        for crafted in [
            "",
            ".",
            "..",
            "../escape",
            "a/b",
            "a\\b",
            "a\0b",
            " leading",
            "trailing ",
            "accents-é",
            &"x".repeat(KEY_COMPONENT_MAX_BYTES + 1),
        ] {
            assert_eq!(
                validate_snapshot_key_component(crafted).unwrap_err(),
                StudioScriptSnapshotError::Refused,
                "expected refusal: {crafted:?}"
            );
        }
        assert!(validate_snapshot_key_component("project-0f9a").is_ok());
        assert!(validate_snapshot_key_component("layer_1.v2").is_ok());
        assert!(validate_snapshot_key_component(&"x".repeat(KEY_COMPONENT_MAX_BYTES)).is_ok());
    }

    #[test]
    fn resolve_path_is_the_documented_layout() {
        let root = fixture_root("layout");
        let path = resolve_snapshot_path(&root, "project-1", "layer-1", "track-1")
            .expect("valid key");
        assert_eq!(
            path,
            root.join("project-1")
                .join("layer-1")
                .join("track-1-v1.snap")
        );
        fs::remove_dir_all(root).expect("fixture cleanup");
    }

    #[test]
    fn write_then_read_round_trips_and_leaves_no_temp_sibling() {
        let root = fixture_root("round-trip");
        let bytes = b"SNP1fixture-snapshot-body";
        let write = write_snapshot(&root, "project-1", "layer-1", "track-1", bytes)
            .expect("snapshot write");
        assert_eq!(write.byte_length, bytes.len() as u64);
        assert_eq!(write.digest, digest_bytes(bytes));

        let read = read_snapshot(&root, "project-1", "layer-1", "track-1")
            .expect("snapshot read");
        assert_eq!(read.bytes, bytes);
        assert_eq!(read.digest, write.digest);

        let entries: Vec<String> = fs::read_dir(root.join("project-1/layer-1"))
            .expect("snapshot directory")
            .map(|entry| entry.expect("entry").file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries, vec!["track-1-v1.snap".to_string()]);
        fs::remove_dir_all(root).expect("fixture cleanup");
    }

    #[test]
    fn a_second_write_replaces_the_snapshot_atomically() {
        let root = fixture_root("replace");
        write_snapshot(&root, "project-1", "layer-1", "track-1", b"first")
            .expect("initial write");
        write_snapshot(&root, "project-1", "layer-1", "track-1", b"second")
            .expect("replacement write");
        let read = read_snapshot(&root, "project-1", "layer-1", "track-1")
            .expect("snapshot read");
        assert_eq!(read.bytes, b"second");
        let entries: Vec<String> = fs::read_dir(root.join("project-1/layer-1"))
            .expect("snapshot directory")
            .map(|entry| entry.expect("entry").file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries, vec!["track-1-v1.snap".to_string()]);
        fs::remove_dir_all(root).expect("fixture cleanup");
    }

    #[test]
    fn absent_read_is_missing_and_refused_keys_create_nothing() {
        let root = fixture_root("missing");
        assert_eq!(
            read_snapshot(&root, "project-1", "layer-1", "track-1").unwrap_err(),
            StudioScriptSnapshotError::Missing
        );
        assert_eq!(
            write_snapshot(&root, "project-1", "..", "track-1", b"x").unwrap_err(),
            StudioScriptSnapshotError::Refused
        );
        assert!(!root.join("project-1").exists());
        fs::remove_dir_all(root).expect("fixture cleanup");
    }

    #[test]
    fn oversized_snapshot_is_refused_before_any_read() {
        let root = fixture_root("oversized");
        let target = resolve_snapshot_path(&root, "project-1", "layer-1", "track-1")
            .expect("valid key");
        fs::create_dir_all(target.parent().expect("parent")).expect("snapshot directory");
        // Sparse file just above the cap: creating it costs no memory.
        let file = File::create(&target).expect("oversized file");
        file.set_len(STUDIO_SCRIPT_SNAPSHOT_MAX_BYTES + 1)
            .expect("set length");
        drop(file);
        assert_eq!(
            read_snapshot(&root, "project-1", "layer-1", "track-1").unwrap_err(),
            StudioScriptSnapshotError::Refused
        );
        fs::remove_dir_all(root).expect("fixture cleanup");
    }

    // --- quick-261023-o3n: the package leg -----------------------------------

    #[test]
    fn package_path_is_scripts_layer_track_v1_snap() {
        let package_root = fixture_root("package-layout");
        let path = resolve_package_snapshot_path(&package_root, "layer-1", "track-1")
            .expect("valid key");
        assert_eq!(
            path,
            package_root
                .join("scripts")
                .join("layer-1")
                .join("track-1-v1.snap")
        );
        fs::remove_dir_all(package_root).expect("fixture cleanup");
    }

    #[test]
    fn package_path_refuses_invalid_components_before_any_join() {
        let package_root = fixture_root("package-key-law");
        for crafted in [
            "",
            ".",
            "..",
            "../escape",
            "a/b",
            "a\\b",
            "a\0b",
            " leading",
            "accents-é",
            &"x".repeat(KEY_COMPONENT_MAX_BYTES + 1),
        ] {
            assert_eq!(
                resolve_package_snapshot_path(&package_root, crafted, "track-1").unwrap_err(),
                StudioScriptSnapshotError::Refused,
                "expected layer refusal: {crafted:?}"
            );
            assert_eq!(
                resolve_package_snapshot_path(&package_root, "layer-1", crafted).unwrap_err(),
                StudioScriptSnapshotError::Refused,
                "expected track refusal: {crafted:?}"
            );
        }
        // Nothing was joined, so nothing was created.
        assert!(!package_root.join("scripts").exists());
        fs::remove_dir_all(package_root).expect("fixture cleanup");
    }

    #[test]
    fn package_write_then_read_round_trips_and_leaves_no_temp_sibling() {
        let package_root = fixture_root("package-round-trip");
        let bytes = b"SNP1package-fixture-snapshot-body";
        let write = write_package_snapshot(&package_root, "layer-1", "track-1", bytes)
            .expect("package write");
        assert_eq!(write.byte_length, bytes.len() as u64);
        assert_eq!(write.digest, digest_bytes(bytes));

        let read = read_package_snapshot(&package_root, "layer-1", "track-1")
            .expect("package read");
        assert_eq!(read.bytes, bytes);
        assert_eq!(read.digest, write.digest);

        let entries: Vec<String> = fs::read_dir(package_root.join("scripts/layer-1"))
            .expect("package snapshot directory")
            .map(|entry| entry.expect("entry").file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries, vec!["track-1-v1.snap".to_string()]);
        fs::remove_dir_all(package_root).expect("fixture cleanup");
    }

    #[test]
    fn a_second_package_write_replaces_the_snapshot_atomically() {
        let package_root = fixture_root("package-replace");
        write_package_snapshot(&package_root, "layer-1", "track-1", b"first")
            .expect("initial package write");
        write_package_snapshot(&package_root, "layer-1", "track-1", b"second")
            .expect("replacement package write");
        let read = read_package_snapshot(&package_root, "layer-1", "track-1")
            .expect("package read");
        assert_eq!(read.bytes, b"second");
        let entries = fs::read_dir(package_root.join("scripts/layer-1"))
            .expect("package snapshot directory")
            .count();
        assert_eq!(entries, 1);
        fs::remove_dir_all(package_root).expect("fixture cleanup");
    }

    #[test]
    fn prefers_the_package_copy_when_both_exist() {
        let cache_root = fixture_root("prefer-cache");
        let package_root = fixture_root("prefer-package");
        write_snapshot(&cache_root, "project-1", "layer-1", "track-1", b"cache-bytes")
            .expect("cache write");
        write_package_snapshot(&package_root, "layer-1", "track-1", b"package-bytes")
            .expect("package write");

        let outcome = read_snapshot_preferring_package(
            &cache_root,
            Some(&package_root),
            "project-1",
            "layer-1",
            "track-1",
        )
        .expect("preferring read");
        assert_eq!(outcome.source, SnapshotSource::Package);
        assert_eq!(outcome.snapshot.bytes, b"package-bytes");

        fs::remove_dir_all(cache_root).expect("fixture cleanup");
        fs::remove_dir_all(package_root).expect("fixture cleanup");
    }

    #[test]
    fn falls_back_to_the_cache_only_when_the_package_copy_is_missing() {
        let cache_root = fixture_root("fallback-cache");
        let package_root = fixture_root("fallback-package");
        write_snapshot(&cache_root, "project-1", "layer-1", "track-1", b"cache-bytes")
            .expect("cache write");

        let outcome = read_snapshot_preferring_package(
            &cache_root,
            Some(&package_root),
            "project-1",
            "layer-1",
            "track-1",
        )
        .expect("fallback read");
        assert_eq!(outcome.source, SnapshotSource::Cache);
        assert_eq!(outcome.snapshot.bytes, b"cache-bytes");

        fs::remove_dir_all(cache_root).expect("fixture cleanup");
        fs::remove_dir_all(package_root).expect("fixture cleanup");
    }

    #[test]
    fn an_oversized_package_copy_is_refused_without_consuming_the_cache() {
        let cache_root = fixture_root("oversized-package-cache");
        let package_root = fixture_root("oversized-package");
        write_snapshot(&cache_root, "project-1", "layer-1", "track-1", b"cache-bytes")
            .expect("cache write");
        let target = resolve_package_snapshot_path(&package_root, "layer-1", "track-1")
            .expect("valid key");
        fs::create_dir_all(target.parent().expect("parent")).expect("package directory");
        let file = File::create(&target).expect("oversized package file");
        file.set_len(STUDIO_SCRIPT_SNAPSHOT_MAX_BYTES + 1)
            .expect("set length");
        drop(file);

        assert_eq!(
            read_snapshot_preferring_package(
                &cache_root,
                Some(&package_root),
                "project-1",
                "layer-1",
                "track-1",
            )
            .unwrap_err(),
            StudioScriptSnapshotError::Refused
        );

        fs::remove_dir_all(cache_root).expect("fixture cleanup");
        fs::remove_dir_all(package_root).expect("fixture cleanup");
    }

    #[test]
    fn writes_only_the_package_when_bound_and_only_the_cache_when_absent() {
        let cache_root = fixture_root("target-cache");
        let package_root = fixture_root("target-package");

        write_snapshot_preferring_package(
            &cache_root,
            Some(&package_root),
            "project-1",
            "layer-1",
            "track-1",
            b"package-bytes",
        )
        .expect("package-bound write");
        assert_eq!(
            read_package_snapshot(&package_root, "layer-1", "track-1")
                .expect("package read")
                .bytes,
            b"package-bytes"
        );
        assert_eq!(
            read_snapshot(&cache_root, "project-1", "layer-1", "track-1").unwrap_err(),
            StudioScriptSnapshotError::Missing
        );

        write_snapshot_preferring_package(
            &cache_root,
            None,
            "project-1",
            "layer-1",
            "track-1",
            b"cache-bytes",
        )
        .expect("cache-only write");
        assert_eq!(
            read_snapshot(&cache_root, "project-1", "layer-1", "track-1")
                .expect("cache read")
                .bytes,
            b"cache-bytes"
        );
        assert_eq!(
            read_package_snapshot(&package_root, "layer-1", "track-1")
                .expect("package read")
                .bytes,
            b"package-bytes"
        );

        fs::remove_dir_all(cache_root).expect("fixture cleanup");
        fs::remove_dir_all(package_root).expect("fixture cleanup");
    }

    #[test]
    fn authority_root_resolves_only_the_bound_capability() {
        let root = fixture_root("authority");
        let state = crate::services::script_library::ScriptLibraryState::default();
        let authority = state.bind(&root).expect("bind");
        assert_eq!(
            state
                .resolve_authority_root(&authority)
                .expect("authority root"),
            fs::canonicalize(&root).expect("canonical fixture root")
        );
        assert!(state.resolve_authority_root("unknown-token").is_err());
        state.clear().expect("clear");
        assert!(state.resolve_authority_root(&authority).is_err());
        fs::remove_dir_all(root).expect("fixture cleanup");
    }
}
