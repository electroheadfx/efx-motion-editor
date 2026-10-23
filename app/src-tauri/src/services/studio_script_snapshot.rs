//! quick-261023-l35: the Studio script snapshot DISK CACHE.
//!
//! The Studio's script stores (watercolor timeline + per-frame brush groups)
//! are session-scoped module state; closing the Studio destroys the webview
//! realm and their content with it. This service persists the encoded snapshot
//! as an app-managed machine cache — never part of the `.mce` package, never
//! touched by the renderer.
//!
//! PATH LAW (T-261023-l35-01):
//!   `<app_data_dir>/studio-script-snapshots/<projectId>/<layerId>/<trackId>-v1.snap`
//!
//! The root is resolved ONCE in the command from `app.path().app_data_dir()`;
//! this service takes it as an argument so it is unit-testable against a temp
//! directory. Every key component is validated BEFORE any `join`: 1..=128
//! bytes, every byte in `[A-Za-z0-9._-]`, and no leading dot (which also rules
//! out `.` and `..`). A refused component returns `Refused` before a syscall,
//! so a crafted renderer value can never escape the root.
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
        .join(format!(
            "{track_id}-v{STUDIO_SCRIPT_SNAPSHOT_FORMAT_VERSION}.{SNAPSHOT_EXTENSION}"
        )))
}

/// Atomic snapshot write: create the key directories, write a sibling temp,
/// fsync it, rename it over the target, then fsync the directory.
pub fn write_snapshot(
    root: &Path,
    project_id: &str,
    layer_id: &str,
    track_id: &str,
    bytes: &[u8],
) -> Result<SnapshotWriteResult, StudioScriptSnapshotError> {
    let target = resolve_snapshot_path(root, project_id, layer_id, track_id)?;
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
        fs::rename(&temp_path, &target)?;
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

/// Guarded snapshot read. An absent leaf is `Missing` (silent no-op); an
/// oversized or irregular leaf is `Refused` BEFORE any read.
pub fn read_snapshot(
    root: &Path,
    project_id: &str,
    layer_id: &str,
    track_id: &str,
) -> Result<SnapshotReadResult, StudioScriptSnapshotError> {
    let target = resolve_snapshot_path(root, project_id, layer_id, track_id)?;
    let metadata = match fs::metadata(&target) {
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
    let bytes = fs::read(&target).map_err(|error| {
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
}
