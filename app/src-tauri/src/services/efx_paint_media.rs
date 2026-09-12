//! 52.2-01 (D-02, D-07, D-13): the package frame-media write/read leg.
//!
//! Two guards live here, deliberately separate and asymmetric (T-52.2-01):
//!
//! * the MEDIA lock (`resolve_package_media_path` / `resolve_package_media_write_path`)
//!   accepts exactly `frames/<layerId>/<keyId>.webp` and is never widened;
//! * the BOUND-path guard (`resolve_package_bound_path`) carries the save
//!   transaction's file set — `project.mce`, `layers/<layerId>.json` and every
//!   `frames/*.webp` entry, with the `frames/` branch delegated back to the
//!   media code path so the `.webp` rule is literally the same code.
//!
//! Every path is canonicalized level by level below the canonicalized package
//! root and re-checked with `Path::starts_with` (never a string prefix), and
//! the staging root is always derived in Rust from the package root plus a
//! validated basename — a caller can never supply a destination root. Digests
//! are computed in Rust (`sha2`) because the JS `crypto.subtle` surface is
//! unresolved under WKWebView (Assumption A1).

use serde::{Serialize, Serializer};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// D-02: the media tree at the package root.
pub const FRAME_MEDIA_ROOT: &str = "frames";
/// The package manifest basename (the save transaction's primary bound path).
pub const PACKAGE_MANIFEST_BASENAME: &str = "project.mce";
/// The per-layer sub-file root (`layers/<layerId>.json`).
pub const PACKAGE_LAYERS_ROOT: &str = "layers";
/// The Rust-owned package staging-root prefix. The staging root is ALWAYS
/// `<package>/<this prefix><uuid-charset body>`; the basename is validated
/// here and the root itself is derived in Rust (plan 05 owns its lifecycle).
pub const PACKAGE_STAGING_PREFIX: &str = ".efx-paint-package-staging-";
const MEDIA_EXTENSION: &str = "webp";
const LAYER_FILE_EXTENSION: &str = "json";
const STAGING_BASENAME_MAX_LEN: usize = 160;
const MEDIA_WRITE_TEMP_PREFIX: &str = ".efx-paint-media-";

/// Typed rejection classes. Callers must be able to distinguish "missing"
/// (Phase 49 slate) from "refused" (fail closed), which is why these are
/// separate variants rather than one error string.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EfxPaintMediaRejection {
    /// A path tried to leave the package (absolute path, `..`, backslash,
    /// NUL, or a symlink resolving outside the package root).
    PathEscape,
    /// A layer/key id is not a plain path segment.
    UnsafeId,
    /// A media path whose extension is not `.webp` (or a layer file without
    /// `.json`).
    WrongExtension,
    /// The media path exists but is not a regular file.
    NotARegularFile,
    /// The path is not in the package's bound file set.
    UnsupportedPackagePath,
    /// The media file is absent — the Phase 49 slate path, not a refusal.
    Missing,
}

impl EfxPaintMediaRejection {
    /// Fixed wire label. Never filesystem detail (T-52.2-03).
    pub fn label(self) -> &'static str {
        match self {
            Self::PathEscape => "pathEscape",
            Self::UnsafeId => "unsafeId",
            Self::WrongExtension => "wrongExtension",
            Self::NotARegularFile => "notARegularFile",
            Self::UnsupportedPackagePath => "unsupportedPackagePath",
            Self::Missing => "missing",
        }
    }
}

impl Serialize for EfxPaintMediaRejection {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.label())
    }
}

/// A filesystem failure: not a rejection class, so it never masquerades as one.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EfxPaintMediaIoError {
    pub message: String,
}

impl EfxPaintMediaIoError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    pub fn label(&self) -> &'static str {
        "io"
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EfxPaintMediaError {
    Rejected(EfxPaintMediaRejection),
    Io(EfxPaintMediaIoError),
}

impl EfxPaintMediaError {
    /// Fixed wire label — the full path is never serialized back (T-52.2-03).
    pub fn label(&self) -> &'static str {
        match self {
            Self::Rejected(rejection) => rejection.label(),
            Self::Io(error) => error.label(),
        }
    }
}

impl Serialize for EfxPaintMediaError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.label())
    }
}

fn rejected(rejection: EfxPaintMediaRejection) -> EfxPaintMediaError {
    EfxPaintMediaError::Rejected(rejection)
}

fn io_error(message: impl Into<String>) -> EfxPaintMediaError {
    EfxPaintMediaError::Io(EfxPaintMediaIoError::new(message))
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FrameMediaWriteResult {
    /// ALWAYS the canonical package-relative path, even for a staged write.
    pub relative_path: String,
    pub digest: String,
    pub byte_length: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FrameMediaReadResult {
    pub relative_path: String,
    /// Computed from the bytes actually read — never a echoed caller value.
    pub digest: String,
    pub byte_length: u64,
    pub bytes: Vec<u8>,
}

/// The canonical media relative path for one real key, guarded by the id
/// accept-set (the Rust twin of `isSafeEfxPaintCachePath`): no empty ids, no
/// `/`, `\`, NUL, `.` or `..`.
pub fn safe_frame_media_relative_path(
    layer_id: &str,
    key_id: &str,
) -> Result<String, EfxPaintMediaError> {
    validate_media_id(layer_id)?;
    validate_media_id(key_id)?;
    Ok(format!(
        "{FRAME_MEDIA_ROOT}/{layer_id}/{key_id}.{MEDIA_EXTENSION}"
    ))
}

/// The MEDIA lock, read side: accepts exactly `frames/<layerId>/<keyId>.webp`,
/// canonicalizes the existing directory chain under the canonicalized package
/// root, requires `starts_with` the root, and refuses everything else with a
/// typed rejection. Existence is the caller's concern (`read_frame_media`
/// maps an absent leaf to `Missing`).
pub fn resolve_package_media_path(
    package_dir: &Path,
    relative: &str,
) -> Result<PathBuf, EfxPaintMediaError> {
    resolve_package_media_path_with(package_dir, relative, false)
}

/// The MEDIA lock, write side: same accept-set and root check, but creates
/// `frames/<layerId>/` first so the returned path is writable.
pub fn resolve_package_media_write_path(
    package_dir: &Path,
    relative: &str,
) -> Result<PathBuf, EfxPaintMediaError> {
    resolve_package_media_path_with(package_dir, relative, true)
}

fn resolve_package_media_path_with(
    package_dir: &Path,
    relative: &str,
    create_parent: bool,
) -> Result<PathBuf, EfxPaintMediaError> {
    validate_package_relative_path_shape(relative)?;
    let (layer_id, key_id) = parse_media_relative_path(relative)?;
    let root = canonical_package_root(package_dir)?;
    resolve_media_target(&root, layer_id, key_id, create_parent)
}

/// The save transaction's BOUND-path guard (plan 05, plan 07). Accept-set is
/// exactly `project.mce`, `layers/<layerId>.json` and
/// `frames/<layerId>/<keyId>.webp`; the `frames/` branch delegates to the
/// media code path (never a widened copy), and a symlink at the leaf is
/// refused — a bound path can never leave the package.
pub fn resolve_package_bound_path(
    package_root: &Path,
    relative: &str,
) -> Result<PathBuf, EfxPaintMediaError> {
    validate_package_relative_path_shape(relative)?;
    let root = canonical_package_root(package_root)?;
    if relative == PACKAGE_MANIFEST_BASENAME {
        return resolve_bound_leaf(&root, &[PACKAGE_MANIFEST_BASENAME]);
    }
    if relative.starts_with(&format!("{PACKAGE_LAYERS_ROOT}/")) {
        let file_name = parse_layer_relative_path(relative)?;
        return resolve_bound_leaf(&root, &[PACKAGE_LAYERS_ROOT, file_name]);
    }
    if relative.starts_with(&format!("{FRAME_MEDIA_ROOT}/")) {
        let (layer_id, key_id) = parse_media_relative_path(relative)?;
        let resolved = resolve_media_target(&root, layer_id, key_id, false)?;
        if is_symlink_leaf(&resolved) {
            return Err(rejected(EfxPaintMediaRejection::PathEscape));
        }
        return Ok(resolved);
    }
    Err(rejected(EfxPaintMediaRejection::UnsupportedPackagePath))
}

/// The Rust-owned staging-root name rule (mirrors the shipped cache
/// `validate_staging_basename`): the `.efx-paint-package-staging-` prefix plus
/// a UUID-charset body. A caller can never supply a destination root.
pub fn validate_package_staging_basename(value: &str) -> Result<(), EfxPaintMediaError> {
    let Some(token) = value.strip_prefix(PACKAGE_STAGING_PREFIX) else {
        return Err(rejected(EfxPaintMediaRejection::UnsupportedPackagePath));
    };
    if token.is_empty()
        || value.len() > STAGING_BASENAME_MAX_LEN
        || !token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(rejected(EfxPaintMediaRejection::UnsupportedPackagePath));
    }
    Ok(())
}

/// SHA-256 (64 lower-case hex chars), computed in Rust — never `crypto.subtle`.
pub fn digest_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn digest_file(path: &Path) -> Result<String, EfxPaintMediaIoError> {
    let mut file = File::open(path).map_err(|error| {
        EfxPaintMediaIoError::new(format!("Could not open the frame media file: {error}"))
    })?;
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| {
            EfxPaintMediaIoError::new(format!("Could not read the frame media file: {error}"))
        })?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

/// Atomic media write: a sibling temp file in the destination directory, then
/// a rename over the target, then a directory fsync. `relative_path` in the
/// result is ALWAYS the canonical package-relative path — with a staging
/// basename the destination is `<package>/<basename>` and the canonical tree
/// is not touched (the save path; the canonical file is reached only through
/// the plan-05 transaction's publish).
pub fn write_frame_media(
    package_dir: &Path,
    staging_basename: Option<&str>,
    layer_id: &str,
    key_id: &str,
    bytes: &[u8],
) -> Result<FrameMediaWriteResult, EfxPaintMediaError> {
    if let Some(basename) = staging_basename {
        validate_package_staging_basename(basename)?;
    }
    let relative_path = safe_frame_media_relative_path(layer_id, key_id)?;
    let root = canonical_package_root(package_dir)?;
    let destination_root = match staging_basename {
        Some(basename) => {
            let staged = root.join(basename);
            fs::create_dir_all(&staged).map_err(|error| {
                io_error(format!("Could not create the package staging root: {error}"))
            })?;
            let canonical_staging = fs::canonicalize(&staged).map_err(|error| {
                io_error(format!("Could not resolve the package staging root: {error}"))
            })?;
            if canonical_staging.parent() != Some(root.as_path()) {
                return Err(rejected(EfxPaintMediaRejection::PathEscape));
            }
            canonical_staging
        }
        None => root.clone(),
    };
    let target = resolve_media_target(&destination_root, layer_id, key_id, true)?;
    write_atomically(&target, bytes)?;
    Ok(FrameMediaWriteResult {
        relative_path,
        digest: digest_bytes(bytes),
        byte_length: bytes.len() as u64,
    })
}

/// Guarded read: the media lock, then a canonicalized leaf so the bytes can
/// only come from a regular `.webp` file that is actually inside the package.
/// The canonicalized leaf is what defeats a symlink swapped in after the write
/// (T-52.2-02): an escaping link resolves outside the root (`PathEscape`), a
/// level inside the package that is not a regular file is `NotARegularFile`,
/// and an absent leaf is `Missing` — the Phase 49 slate path, never a refusal.
pub fn read_frame_media(
    package_dir: &Path,
    relative_path: &str,
) -> Result<FrameMediaReadResult, EfxPaintMediaError> {
    let candidate = resolve_package_media_path(package_dir, relative_path)?;
    let root = canonical_package_root(package_dir)?;
    let canonical = match fs::canonicalize(&candidate) {
        Ok(canonical) => canonical,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(rejected(EfxPaintMediaRejection::Missing));
        }
        Err(error) => {
            return Err(io_error(format!(
                "Could not resolve the frame media file: {error}"
            )));
        }
    };
    if !canonical.starts_with(&root) {
        return Err(rejected(EfxPaintMediaRejection::PathEscape));
    }
    if !canonical.is_file() {
        return Err(rejected(EfxPaintMediaRejection::NotARegularFile));
    }
    if canonical.extension().and_then(|extension| extension.to_str()) != Some(MEDIA_EXTENSION) {
        return Err(rejected(EfxPaintMediaRejection::WrongExtension));
    }
    let bytes = fs::read(&canonical)
        .map_err(|error| io_error(format!("Could not read the frame media file: {error}")))?;
    Ok(FrameMediaReadResult {
        relative_path: relative_path.to_string(),
        digest: digest_bytes(&bytes),
        byte_length: bytes.len() as u64,
        bytes,
    })
}

/// The outcome of one staged layer write. The destination is always
/// `<package>/<staging basename>/layers/<layerId>.json` — the canonical
/// `layers/` tree is reached only through the transaction's publish.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PackageLayerFileWriteResult {
    pub byte_length: u64,
}

/// Write one layer sub-file into the save transaction's staging generation
/// (quick-260913-05k). The destination root is DERIVED here from the package
/// root plus the validated basename — the renderer supplies only the basename,
/// never a destination root (T-52.2-14) — and the staging tree (root and its
/// `layers/` directory) is created by this call, so the caller writes nothing
/// on the package path itself.
///
/// Every refusal is typed and happens before anything is created: the basename
/// must be a staging generation name and `layer_file` must pass the shape
/// rules plus the shared `layers/` parser, so a crafted path can neither
/// escape the package nor mint a generation.
pub fn write_package_layer_file(
    package_dir: &Path,
    staging_basename: &str,
    layer_file: &str,
    contents: &[u8],
) -> Result<PackageLayerFileWriteResult, EfxPaintMediaError> {
    validate_package_staging_basename(staging_basename)?;
    validate_package_relative_path_shape(layer_file)?;
    let file_name = parse_layer_relative_path(layer_file)?;
    let root = canonical_package_root(package_dir)?;
    let staged = root.join(staging_basename);
    fs::create_dir_all(&staged).map_err(|error| {
        io_error(format!("Could not create the package staging root: {error}"))
    })?;
    let canonical_staging = fs::canonicalize(&staged).map_err(|error| {
        io_error(format!("Could not resolve the package staging root: {error}"))
    })?;
    if canonical_staging.parent() != Some(root.as_path()) {
        return Err(rejected(EfxPaintMediaRejection::PathEscape));
    }
    let layers_dir = canonical_staging.join(PACKAGE_LAYERS_ROOT);
    fs::create_dir_all(&layers_dir).map_err(|error| {
        io_error(format!("Could not create the staged layers directory: {error}"))
    })?;
    let canonical_layers = fs::canonicalize(&layers_dir).map_err(|error| {
        io_error(format!("Could not resolve the staged layers directory: {error}"))
    })?;
    if canonical_layers.parent() != Some(canonical_staging.as_path()) {
        return Err(rejected(EfxPaintMediaRejection::PathEscape));
    }
    write_atomically(&canonical_layers.join(file_name), contents)?;
    Ok(PackageLayerFileWriteResult {
        byte_length: contents.len() as u64,
    })
}

/// Read one layer sub-file back as TEXT (quick-260913-05k). The layers lock is
/// the read side of the same shared parser: exactly `layers/<layerId>.json`,
/// canonicalized level by level below the canonicalized package root and
/// re-checked with `starts_with`, so no symlink or crafted segment can widen
/// the read. An absent leaf is `Missing` — the caller keeps its own
/// missing-file copy — and an irregular one keeps the bound guard's refusals.
///
/// The text is returned as a `String`, never as bytes: a raw response body
/// degrades to a JSON number array over IPC on macOS (the same constraint the
/// frame-media read records).
pub fn read_package_layer_file(
    package_dir: &Path,
    layer_file: &str,
) -> Result<String, EfxPaintMediaError> {
    validate_package_relative_path_shape(layer_file)?;
    let file_name = parse_layer_relative_path(layer_file)?;
    let root = canonical_package_root(package_dir)?;
    let candidate = resolve_bound_leaf(&root, &[PACKAGE_LAYERS_ROOT, file_name])?;
    let canonical = match fs::canonicalize(&candidate) {
        Ok(canonical) => canonical,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(rejected(EfxPaintMediaRejection::Missing));
        }
        Err(error) => {
            return Err(io_error(format!(
                "Could not resolve the layer file: {error}"
            )));
        }
    };
    if !canonical.starts_with(&root) {
        return Err(rejected(EfxPaintMediaRejection::PathEscape));
    }
    if !canonical.is_file() {
        return Err(rejected(EfxPaintMediaRejection::NotARegularFile));
    }
    if canonical.extension().and_then(|extension| extension.to_str())
        != Some(LAYER_FILE_EXTENSION)
    {
        return Err(rejected(EfxPaintMediaRejection::WrongExtension));
    }
    let bytes = fs::read(&canonical)
        .map_err(|error| io_error(format!("Could not read the layer file: {error}")))?;
    String::from_utf8(bytes)
        .map_err(|error| io_error(format!("Could not decode the layer file as UTF-8: {error}")))
}

/// The shared relative-path shape rules (the Rust twin of plan 02's
/// `isSafePackageRelativePath`): no leading `/` or `\`, no `\` anywhere, no
/// NUL, no Windows drive letter or UNC prefix, no empty/`.`/`..` segment.
fn validate_package_relative_path_shape(relative: &str) -> Result<(), EfxPaintMediaError> {
    if relative.is_empty() {
        return Err(rejected(EfxPaintMediaRejection::UnsupportedPackagePath));
    }
    if relative.starts_with('/')
        || relative.starts_with('\\')
        || relative.contains('\\')
        || relative.contains('\0')
    {
        return Err(rejected(EfxPaintMediaRejection::PathEscape));
    }
    let mut segments = relative.split('/');
    if let Some(first) = segments.next() {
        if first.len() == 1 && first.ends_with(':') {
            return Err(rejected(EfxPaintMediaRejection::PathEscape));
        }
    }
    if relative
        .split('/')
        .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err(rejected(EfxPaintMediaRejection::PathEscape));
    }
    Ok(())
}

/// Parses a shape-valid relative path into `(layer_id, key_id)` for the
/// `frames/` tree, or a typed rejection: not under `frames/` at all
/// (`UnsupportedPackagePath`), not exactly `<layerId>/<keyId>.webp`
/// (`UnsupportedPackagePath`), or a non-`.webp` leaf (`WrongExtension`).
fn parse_media_relative_path(relative: &str) -> Result<(&str, &str), EfxPaintMediaError> {
    let remainder = relative
        .strip_prefix(&format!("{FRAME_MEDIA_ROOT}/"))
        .ok_or_else(|| rejected(EfxPaintMediaRejection::UnsupportedPackagePath))?;
    let segments: Vec<&str> = remainder.split('/').collect();
    if segments.len() != 2 {
        return Err(rejected(EfxPaintMediaRejection::UnsupportedPackagePath));
    }
    let key_id = segments[1]
        .strip_suffix(&format!(".{MEDIA_EXTENSION}"))
        .filter(|stem| !stem.is_empty())
        .ok_or_else(|| rejected(EfxPaintMediaRejection::WrongExtension))?;
    Ok((segments[0], key_id))
}

/// Parses a `layers/` relative path into its validated bare file name
/// (`<stem>.json`), or a typed rejection: not under `layers/` at all
/// (`UnsupportedPackagePath`), not exactly one segment below it
/// (`UnsupportedPackagePath`), or a non-`.json` leaf / an empty stem
/// (`WrongExtension`). ONE parser serves the bound-path guard and the
/// layer read/write service, so the accept-set cannot drift between them.
fn parse_layer_relative_path(relative: &str) -> Result<&str, EfxPaintMediaError> {
    let remainder = relative
        .strip_prefix(&format!("{PACKAGE_LAYERS_ROOT}/"))
        .ok_or_else(|| rejected(EfxPaintMediaRejection::UnsupportedPackagePath))?;
    let segments: Vec<&str> = remainder.split('/').collect();
    if segments.len() != 1 || segments[0].is_empty() {
        return Err(rejected(EfxPaintMediaRejection::UnsupportedPackagePath));
    }
    let stem = segments[0]
        .strip_suffix(&format!(".{LAYER_FILE_EXTENSION}"))
        .filter(|stem| !stem.is_empty());
    if stem.is_none() {
        return Err(rejected(EfxPaintMediaRejection::WrongExtension));
    }
    Ok(segments[0])
}

fn validate_media_id(value: &str) -> Result<(), EfxPaintMediaError> {
    if value.is_empty()
        || value.contains('/')
        || value.contains('\\')
        || value.contains('\0')
        || value == "."
        || value == ".."
    {
        return Err(rejected(EfxPaintMediaRejection::UnsafeId));
    }
    Ok(())
}

fn canonical_package_root(package_dir: &Path) -> Result<PathBuf, EfxPaintMediaError> {
    fs::canonicalize(package_dir)
        .map_err(|error| io_error(format!("Could not resolve the package directory: {error}")))
}

/// Canonicalize every existing directory level below `root`, refusing any
/// level that resolves outside the package root, then append the still-missing
/// tail. `root` must already be canonical.
fn resolve_directory_chain(
    root: &Path,
    directories: &[&str],
) -> Result<PathBuf, EfxPaintMediaError> {
    let mut resolved = root.to_path_buf();
    for directory in directories {
        let candidate = resolved.join(directory);
        match fs::canonicalize(&candidate) {
            Ok(canonical) => {
                if !canonical.starts_with(root) {
                    return Err(rejected(EfxPaintMediaRejection::PathEscape));
                }
                resolved = canonical;
            }
            Err(_) => {
                resolved = candidate;
            }
        }
    }
    Ok(resolved)
}

/// Resolve `frames/<layerId>/<keyId>.webp` under a canonical root. The leaf is
/// appended literally — it is never canonicalized here (the read path
/// re-canonicalizes and re-checks it in `read_frame_media`).
fn resolve_media_target(
    root: &Path,
    layer_id: &str,
    key_id: &str,
    create_parent: bool,
) -> Result<PathBuf, EfxPaintMediaError> {
    let parent = root.join(FRAME_MEDIA_ROOT).join(layer_id);
    if create_parent {
        fs::create_dir_all(&parent).map_err(|error| {
            io_error(format!("Could not create the frame media directory: {error}"))
        })?;
    }
    let resolved_parent = resolve_directory_chain(root, &[FRAME_MEDIA_ROOT, layer_id])?;
    Ok(resolved_parent.join(format!("{key_id}.{MEDIA_EXTENSION}")))
}

fn resolve_bound_leaf(
    root: &Path,
    components: &[&str],
) -> Result<PathBuf, EfxPaintMediaError> {
    let (directories, file_name) = components.split_at(components.len() - 1);
    let resolved_parent = resolve_directory_chain(root, directories)?;
    let resolved = resolved_parent.join(file_name[0]);
    if is_symlink_leaf(&resolved) {
        return Err(rejected(EfxPaintMediaRejection::PathEscape));
    }
    Ok(resolved)
}

fn is_symlink_leaf(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false)
}

fn write_atomically(target: &Path, bytes: &[u8]) -> Result<(), EfxPaintMediaError> {
    let parent = target
        .parent()
        .ok_or_else(|| rejected(EfxPaintMediaRejection::PathEscape))?;
    let temp_path = parent.join(format!("{MEDIA_WRITE_TEMP_PREFIX}{}.tmp", Uuid::new_v4()));
    let write_result = (|| -> std::io::Result<()> {
        let mut file = File::create(&temp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temp_path, target)?;
        Ok(())
    })();
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temp_path);
        return Err(io_error(format!(
            "Could not write the frame media file: {error}"
        )));
    }
    File::open(parent)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| {
            io_error(format!(
                "Could not synchronize the frame media directory: {error}"
            ))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_package(tag: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("efx-paint-media-{tag}-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("fixture package directory");
        root
    }

    #[test]
    fn staging_basename_rejects_traversal_and_unknown_prefixes() {
        for crafted in [
            ".efx-paint-package-staging-../evil",
            ".efx-paint-package-staging-",
            ".efx-paint-package-staging-child/path",
            "/tmp/.efx-paint-package-staging-abs",
            ".efx-paint-staging-legacy",
            "",
        ] {
            assert!(
                validate_package_staging_basename(crafted).is_err(),
                "expected rejection: {crafted}"
            );
        }
        assert!(validate_package_staging_basename(&format!(
            "{PACKAGE_STAGING_PREFIX}{}",
            Uuid::new_v4()
        ))
        .is_ok());
    }

    #[test]
    fn media_ids_reject_path_traversal() {
        for (layer_id, key_id) in [
            ("../L1", "K1"),
            ("L1", "K1/K2"),
            ("L1", "K1\\K2"),
            ("L1\u{0}", "K1"),
            (".", "K1"),
            ("L1", ".."),
            ("", "K1"),
        ] {
            assert!(
                safe_frame_media_relative_path(layer_id, key_id).is_err(),
                "expected UnsafeId for {layer_id:?}/{key_id:?}"
            );
        }
        assert_eq!(
            safe_frame_media_relative_path("L1", "K1").expect("safe ids"),
            "frames/L1/K1.webp"
        );
    }

    #[test]
    fn media_lock_stays_locked_to_the_frames_webp_tree() {
        let package = fixture_package("lock");
        assert_eq!(
            resolve_package_media_path(&package, "layers/L1.json").unwrap_err(),
            rejected(EfxPaintMediaRejection::UnsupportedPackagePath)
        );
        assert_eq!(
            resolve_package_media_path(&package, "frames/L1/K1.png").unwrap_err(),
            rejected(EfxPaintMediaRejection::WrongExtension)
        );
        assert_eq!(
            resolve_package_media_path(&package, "../escape.webp").unwrap_err(),
            rejected(EfxPaintMediaRejection::PathEscape)
        );
        fs::remove_dir_all(package).expect("fixture cleanup");
    }

    #[test]
    fn bound_guard_refuses_everything_outside_the_transaction_file_set() {
        let package = fixture_package("bound");
        for relative in [
            "images/a.webp",
            "cache/efx-paint/a.webp",
            "scripts/x.json",
            "paint/L1/frame-000001.json",
            "../escape",
            "/absolute/path",
            "frames\\L1\\K1.webp",
            "",
        ] {
            assert!(
                resolve_package_bound_path(&package, relative).is_err(),
                "expected refusal: {relative}"
            );
        }
        fs::remove_dir_all(package).expect("fixture cleanup");
    }

    #[test]
    fn atomic_write_leaves_no_temp_sibling_and_digest_matches_disk() {
        let package = fixture_package("atomic");
        let bytes = b"RIFF\x1e\x00\x00\x00WEBPVP8L\x12\x00\x00\x00efx-paint-media-fixture-1";
        let write = write_frame_media(&package, None, "L1", "K1", bytes).expect("media write");
        assert_eq!(write.digest, digest_bytes(bytes));
        assert_eq!(
            digest_file(&package.join("frames/L1/K1.webp")).expect("file digest"),
            write.digest
        );
        let entries: Vec<String> = fs::read_dir(package.join("frames/L1"))
            .expect("media directory")
            .map(|entry| entry.expect("entry").file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries, vec!["K1.webp".to_string()]);
        fs::remove_dir_all(package).expect("fixture cleanup");
    }

    // --- quick-260913-05k: the package `layers/` IO leg ---------------------

    #[test]
    fn layer_relative_path_parser_is_the_single_shared_scheme() {
        assert_eq!(
            parse_layer_relative_path("layers/L1.json").expect("layer path"),
            "L1.json"
        );
        for crafted in [
            "layers/a/b.json",
            "layers/.json",
            "layers/L1.txt",
            "layers/L1",
            "frames/L1/K1.webp",
            "L1.json",
            "",
        ] {
            assert!(
                parse_layer_relative_path(crafted).is_err(),
                "expected refusal: {crafted}"
            );
        }
    }

    #[test]
    fn layer_file_write_creates_the_staging_tree_and_reports_the_byte_length() {
        let package = fixture_package("layer-write");
        let basename = format!("{PACKAGE_STAGING_PREFIX}{}", Uuid::new_v4());
        let contents = br#"{"version":1,"tracks":[]}"#;

        let result =
            write_package_layer_file(&package, &basename, "layers/L1.json", contents)
                .expect("layer file write");

        assert_eq!(result.byte_length, contents.len() as u64);
        assert_eq!(
            fs::read(package.join(&basename).join("layers/L1.json")).expect("staged layer file"),
            contents
        );
        // The canonical tree is never touched by a staged write: only the
        // transaction's publish may reach `layers/<layerId>.json` (D-10).
        assert!(!package.join(PACKAGE_LAYERS_ROOT).exists());
        // No temp sibling survives the atomic write.
        let entries: Vec<String> = fs::read_dir(package.join(&basename).join("layers"))
            .expect("staged layers directory")
            .map(|entry| entry.expect("entry").file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries, vec!["L1.json".to_string()]);
        fs::remove_dir_all(package).expect("fixture cleanup");
    }

    #[test]
    fn layer_file_write_refuses_crafted_paths_and_creates_nothing_outside_the_package() {
        let outer = std::env::temp_dir()
            .join(format!("efx-paint-layer-guard-{}", Uuid::new_v4()));
        let package = outer.join("Pkg.mce");
        fs::create_dir_all(&package).expect("fixture package directory");
        let basename = format!("{PACKAGE_STAGING_PREFIX}{}", Uuid::new_v4());

        // A separator beyond the `layers/` prefix and a non-json leaf are
        // unsupported/wrong-extension refusals; absolute paths, `..` traversal
        // and a path outside the `layers/` tree are refusals too.
        for crafted in [
            "layers/a/b.json",
            "layers/L1.json/../../escaped.json",
            "layers/L1.txt",
            "layers/.json",
            "frames/L1/K1.webp",
            "L1.json",
            "/absolute/L1.json",
            "../escaped.json",
            "",
        ] {
            assert!(
                write_package_layer_file(&package, &basename, crafted, b"payload").is_err(),
                "expected refusal: {crafted}"
            );
        }
        // A basename that is not a staging generation name is refused.
        assert!(write_package_layer_file(
            &package,
            ".efx-paint-staging-legacy",
            "layers/L1.json",
            b"payload"
        )
        .is_err());

        // Nothing was created outside the package root — and no staging
        // generation was minted for a refused write at all.
        let entries: Vec<String> = fs::read_dir(&outer)
            .expect("outer fixture")
            .map(|entry| entry.expect("entry").file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries, vec!["Pkg.mce".to_string()]);
        assert!(!package.join(&basename).exists());
        fs::remove_dir_all(outer).expect("fixture cleanup");
    }

    #[test]
    fn layer_file_read_returns_text_and_maps_absent_and_irregular_leaves() {
        let package = fixture_package("layer-read");
        fs::create_dir_all(package.join(PACKAGE_LAYERS_ROOT)).expect("layers directory");
        fs::write(package.join("layers/L1.json"), br#"{"ok":true}"#).expect("canonical layer file");

        assert_eq!(
            read_package_layer_file(&package, "layers/L1.json").expect("layer file read"),
            r#"{"ok":true}"#
        );
        // An absent leaf is `Missing` — the same variant the frame-media read
        // maps (the caller turns it into the "missing its layer file" copy).
        assert_eq!(
            read_package_layer_file(&package, "layers/absent.json").unwrap_err(),
            rejected(EfxPaintMediaRejection::Missing)
        );
        // A level inside the package that is not a regular file is refused.
        fs::create_dir_all(package.join("layers/L2.json")).expect("directory leaf");
        assert_eq!(
            read_package_layer_file(&package, "layers/L2.json").unwrap_err(),
            rejected(EfxPaintMediaRejection::NotARegularFile)
        );
        // The lock stays locked: the read cannot be widened to another tree,
        // and the shape guards refuse before any filesystem call.
        assert_eq!(
            read_package_layer_file(&package, "frames/L1/K1.webp").unwrap_err(),
            rejected(EfxPaintMediaRejection::UnsupportedPackagePath)
        );
        assert_eq!(
            read_package_layer_file(&package, "layers/../escape.json").unwrap_err(),
            rejected(EfxPaintMediaRejection::PathEscape)
        );
        fs::remove_dir_all(package).expect("fixture cleanup");
    }
}
