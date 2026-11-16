//! Machine-level brush-texture library (quick 261116-inu / spec 04).
//!
//! Textures are a MACHINE resource, not app content and not project content:
//!
//! ```text
//! root    = <home>/.config/efx-motion/brushes/   (same convention as commands/config.rs)
//! files   = <sha256>.webp                        (content-addressed, lossless, exactly 512×512)
//! index   = catalog.json                         ({ version: 1, entries: [...] })
//! row     = one per digest                       (re-importing the same bytes selects the row)
//! ```
//!
//! TRUST BOUNDARY (T-01 / T-07): the renderer sends mask BYTES and opaque
//! DIGESTS only — never a path. Every digest crossing this boundary is
//! validated as exactly 64 lower-case hex characters before it can become a
//! filename or a map key, every filename is `format!("{digest}.webp")` inside
//! the fixed HOME-derived root, and every read/write/delete rejects a symlinked
//! target. All IO is Rust-owned (the package/cache scope law).
//!
//! ATOMICITY (T-03): every `catalog.json` rewrite goes through
//! `services::script_library::atomic_write_bytes` (create-new temp, write,
//! sync, rename, parent fsync, temp cleanup). A failed write leaves the
//! previous catalog intact.
//!
//! SINGLE-FLIGHT: write / decode / rotation / delete serialise behind one
//! mutex so two imports can never interleave a catalog rewrite.

use crate::services::efx_paint_media::digest_bytes;
use crate::services::frame_codec::{
    decode_mask_webp, encode_mask_webp, parse_webp_dimensions, BRUSH_MASK_BYTES, BRUSH_MASK_EDGE,
};
use crate::services::script_library::{atomic_write_bytes, decode_base64, reject_symlink};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock};
use tauri::ipc::{InvokeBody, Request};

/// `catalog.json`'s format version. Independent of the AQTL binary version.
pub const BRUSH_LIBRARY_CATALOG_VERSION: u32 = 1;

/// Upper bound on a readable `catalog.json` — a bounded parse (T-06).
const MAX_CATALOG_BYTES: u64 = 4 * 1024 * 1024;

/// Upper bound on an imported texture name (a catalog label, not a path).
const MAX_NAME_CHARS: usize = 200;

/// The projected-texture rotation is integer DEGREES in -180..180 everywhere
/// except the AQTL byte body (which owns hundredths of a degree).
#[allow(dead_code)] // Task 10's set-rotation command consumes the range.
pub const TEXTURE_ROTATION_MIN_DEGREES: i32 = -180;
#[allow(dead_code)]
pub const TEXTURE_ROTATION_MAX_DEGREES: i32 = 180;

/// One machine-library row. `textureRotation` is DEGREES; `rotation` is the
/// D-08 tip multiplier — different fields, never conflated.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrushLibraryEntry {
    /// Content-derived id: `wc/custom-<first 12 hex of digest>`.
    pub id: String,
    pub name: String,
    /// SHA-256 of the stored WebP bytes — the file's filename stem.
    pub digest: String,
    /// Projected-texture orientation, integer DEGREES in -180..180.
    pub texture_rotation: i32,
    pub created_at: String,
    pub tip: f64,
    pub aspect: f64,
    pub rotation: f64,
    pub size_curve: f64,
    pub scatter: f64,
    pub capacity: f64,
    pub grain: f64,
    pub wet_round: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrushLibraryCatalog {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    entries: Vec<BrushLibraryEntry>,
}

impl Default for BrushLibraryCatalog {
    fn default() -> Self {
        Self {
            version: BRUSH_LIBRARY_CATALOG_VERSION,
            entries: Vec::new(),
        }
    }
}

/// The whole library as the renderer boots: every well-formed catalog row plus
/// the ids whose stored file is unusable on THIS machine. A row with a missing,
/// symlinked or non-512x512 file stays listed in `entries` and its id appears in
/// `unavailable`, so the surfaces can render it degraded instead of dropping it
/// silently. The scan never fails: a missing or hostile catalog reads as empty
/// and every malformed row is dropped individually (T-06).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrushLibraryScanResponse {
    pub entries: Vec<BrushLibraryEntry>,
    pub unavailable: Vec<String>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrushLibraryDecodeResponse {
    /// Base64 of the 262,144 mask bytes, alpha channel only.
    pub mask_base64: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrushLibraryWriteBody {
    name: String,
    mask_base64: String,
}

/// The fixed library root. Derived HERE only — no command ever takes a path
/// from the renderer (T-07). Mirrors `commands/config.rs`'s HOME convention
/// (not the `dirs` crate, which maps to ~/Library/Application Support on macOS).
pub(crate) fn library_root() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into()))
        .join(".config/efx-motion/brushes")
}

fn catalog_path(root: &Path) -> PathBuf {
    root.join("catalog.json")
}

fn mask_path(root: &Path, digest: &str) -> PathBuf {
    root.join(format!("{digest}.webp"))
}

/// Exactly 64 lower-case hex characters. Anything else is refused before it
/// becomes a filename or a map key (T-01).
pub(crate) fn valid_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn library_lock() -> &'static Mutex<()> {
    static LIBRARY_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LIBRARY_LOCK.get_or_init(|| Mutex::new(()))
}

fn lock_library() -> MutexGuard<'static, ()> {
    // A poisoned lock still serialises: nothing inside the critical section
    // leaves a half-written file behind (every write is atomic).
    library_lock()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Read `catalog.json` tolerantly: missing or malformed reads as empty. The
/// scan command (Task 2) reports per-entry failures; the write path only needs
/// the list it upserts into.
fn read_catalog(root: &Path) -> BrushLibraryCatalog {
    let Ok(metadata) = fs::metadata(catalog_path(root)) else {
        return BrushLibraryCatalog::default();
    };
    if metadata.len() > MAX_CATALOG_BYTES {
        return BrushLibraryCatalog::default();
    }
    let Ok(bytes) = fs::read(catalog_path(root)) else {
        return BrushLibraryCatalog::default();
    };
    let mut catalog: BrushLibraryCatalog =
        serde_json::from_slice(&bytes).unwrap_or_else(|_| BrushLibraryCatalog::default());
    if catalog.version == 0 {
        catalog.version = BRUSH_LIBRARY_CATALOG_VERSION;
    }
    catalog
}

fn write_catalog(root: &Path, catalog: &BrushLibraryCatalog) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(catalog)
        .map_err(|error| format!("could not serialize brush library catalog: {error}"))?;
    atomic_write_bytes(&catalog_path(root), &bytes, true)
}

/// Read `catalog.json` for the SCAN path: every malformed or forged row is
/// dropped INDIVIDUALLY, never the whole list (T-06). A row whose id does not
/// derive from its digest is forged and dropped; a repeated digest keeps the
/// first row, so one content address can never list twice. The byte cap keeps
/// the parse bounded.
fn read_catalog_entries_lenient(root: &Path) -> Vec<BrushLibraryEntry> {
    let path = catalog_path(root);
    let Ok(metadata) = fs::metadata(&path) else {
        return Vec::new();
    };
    if metadata.len() > MAX_CATALOG_BYTES {
        return Vec::new();
    }
    let Ok(bytes) = fs::read(&path) else {
        return Vec::new();
    };
    let Ok(document) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        return Vec::new();
    };
    let Some(raw_entries) = document.get("entries").and_then(|value| value.as_array()) else {
        return Vec::new();
    };
    let mut entries: Vec<BrushLibraryEntry> = Vec::new();
    let mut seen_digests = std::collections::HashSet::new();
    for raw in raw_entries {
        let Ok(entry) = serde_json::from_value::<BrushLibraryEntry>(raw.clone()) else {
            continue;
        };
        if !valid_digest(&entry.digest) || entry.id != id_for_digest(&entry.digest) {
            continue;
        }
        if !seen_digests.insert(entry.digest.clone()) {
            continue;
        }
        entries.push(entry);
    }
    entries
}

/// True only for a regular (non-symlinked) file that declares exactly the
/// 512x512 mask frame. The RIFF header read allocates no pixel buffer (T-02).
fn library_file_is_usable(root: &Path, digest: &str) -> bool {
    let target = mask_path(root, digest);
    if reject_symlink(&target, "brush library file").is_err() {
        return false;
    }
    let Ok(bytes) = fs::read(&target) else {
        return false;
    };
    parse_webp_dimensions(&bytes) == Some((BRUSH_MASK_EDGE, BRUSH_MASK_EDGE))
}

fn scan_library_at(root: &Path) -> BrushLibraryScanResponse {
    let entries = read_catalog_entries_lenient(root);
    let unavailable: Vec<String> = entries
        .iter()
        .filter(|entry| !library_file_is_usable(root, &entry.digest))
        .map(|entry| entry.id.clone())
        .collect();
    BrushLibraryScanResponse {
        entries,
        unavailable,
    }
}

fn normalize_name(value: &str) -> Result<String, String> {
    let value = value.trim().to_string();
    if value.is_empty() || value.chars().count() > MAX_NAME_CHARS || value.chars().any(char::is_control)
    {
        return Err("invalid-name".to_string());
    }
    Ok(value)
}

/// Content-derived identity law: the same bytes resolve to the same id on every
/// machine. Supersedes D-16's per-import id minting.
fn id_for_digest(digest: &str) -> String {
    format!("wc/custom-{}", &digest[..12])
}

fn new_entry(digest: &str, name: &str) -> BrushLibraryEntry {
    BrushLibraryEntry {
        id: id_for_digest(digest),
        name: name.to_string(),
        digest: digest.to_string(),
        texture_rotation: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
        tip: 1.0,
        aspect: 1.0,
        rotation: 1.0,
        size_curve: 1.0,
        scatter: 1.0,
        capacity: 1.0,
        grain: 1.0,
        wet_round: 1.0,
    }
}

/// Write one 262,144-byte mask into the library at `root` and upsert its row.
///
/// Content addressing: an existing `<digest>.webp` whose bytes hash to the same
/// digest is left untouched; one that hashes differently is refused
/// (`digest-collision`) and never overwritten. Re-writing the same mask returns
/// the existing row and rewrites no catalog row.
fn write_library_entry_at(
    root: &Path,
    name: &str,
    mask_bytes: &[u8],
) -> Result<BrushLibraryEntry, String> {
    if mask_bytes.len() != BRUSH_MASK_BYTES {
        return Err(format!(
            "brush mask must be exactly {BRUSH_MASK_BYTES} bytes (512x512); got {}",
            mask_bytes.len()
        ));
    }
    let name = normalize_name(name)?;
    let webp = encode_mask_webp(mask_bytes)?;
    let digest = digest_bytes(&webp);

    fs::create_dir_all(root)
        .map_err(|error| format!("could not create brush library root: {error}"))?;
    reject_symlink(root, "brush library root")?;
    let target = mask_path(root, &digest);
    reject_symlink(&target, "brush library file")?;
    if target.exists() {
        let existing = fs::read(&target)
            .map_err(|error| format!("could not read existing brush library file: {error}"))?;
        if digest_bytes(&existing) != digest {
            return Err("digest-collision".to_string());
        }
    } else {
        atomic_write_bytes(&target, &webp, false)?;
    }

    let mut catalog = read_catalog(root);
    if let Some(existing) = catalog.entries.iter().find(|entry| entry.digest == digest) {
        return Ok(existing.clone());
    }
    let entry = new_entry(&digest, &name);
    catalog.entries.push(entry.clone());
    write_catalog(root, &catalog)?;
    Ok(entry)
}

fn decode_library_entry_at(
    root: &Path,
    digest: &str,
) -> Result<BrushLibraryDecodeResponse, String> {
    if !valid_digest(digest) {
        return Err("invalid-digest".to_string());
    }
    let target = mask_path(root, digest);
    reject_symlink(&target, "brush library file")?;
    let bytes = fs::read(&target).map_err(|_| "missing".to_string())?;
    // Declared-dimension gate runs BEFORE any pixel allocation (T-02).
    let mask = decode_mask_webp(&bytes)?;
    Ok(BrushLibraryDecodeResponse {
        mask_base64: encode_base64(&mask),
        width: crate::services::frame_codec::BRUSH_MASK_EDGE,
        height: crate::services::frame_codec::BRUSH_MASK_EDGE,
    })
}

fn encode_base64(bytes: &[u8]) -> String {
    crate::commands::frame_codec::encode_base64(bytes)
}

/// Delete one library entry: remove `<root>/<digest>.webp` (a missing file is
/// fine — the row must still leave) and the matching `catalog.json` row, then
/// rewrite the catalog atomically.
///
/// The digest is validated BEFORE any path is built (T-01), a symlinked target
/// is refused (the file is never followed outside the root), and a failed
/// catalog rewrite leaves the previous `catalog.json` intact and reports the
/// failure — the row stays listed (and the next scan marks it unavailable).
fn delete_library_entry_at(root: &Path, digest: &str) -> Result<(), String> {
    if !valid_digest(digest) {
        return Err("invalid-digest".to_string());
    }
    let target = mask_path(root, digest);
    reject_symlink(&target, "brush library file")?;
    match fs::remove_file(&target) {
        Ok(()) => {}
        // A missing file still removes the row: the delete is idempotent.
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("could not remove brush library file: {error}")),
    }
    let mut catalog = read_catalog(root);
    let before = catalog.entries.len();
    catalog.entries.retain(|entry| entry.digest != digest);
    if catalog.entries.len() != before {
        write_catalog(root, &catalog)?;
    }
    Ok(())
}

/// Remove one texture from the machine library by content address.
///
/// The renderer names a DIGEST only (64 lower-case hex) — never a path. Holds
/// the same single-flight mutex as write/decode/scan so a delete can never
/// interleave a catalog rewrite with an import.
#[tauri::command(async)]
pub fn brush_library_delete(digest: String) -> Result<(), String> {
    let _guard = lock_library();
    delete_library_entry_at(&library_root(), &digest)
}

/// Encode + store one imported mask and answer with its catalog row.
#[tauri::command(async)]
pub fn brush_library_write(request: Request) -> Result<BrushLibraryEntry, String> {
    let body: BrushLibraryWriteBody = match request.body() {
        InvokeBody::Json(value) => serde_json::from_value(value.clone())
            .map_err(|error| format!("brush_library_write: invalid body: {error}"))?,
        _ => {
            return Err(
                "brush_library_write: expected a JSON body carrying {name, maskBase64}".to_string(),
            )
        }
    };
    let mask = decode_base64(&body.mask_base64)?;
    let _guard = lock_library();
    write_library_entry_at(&library_root(), &body.name, &mask)
}

/// Decode one stored mask back to its 262,144 alpha bytes.
#[tauri::command(async)]
pub fn brush_library_decode(digest: String) -> Result<BrushLibraryDecodeResponse, String> {
    let _guard = lock_library();
    decode_library_entry_at(&library_root(), &digest)
}

/// Scan the whole machine library at app boot. Never fails: a missing or
/// unreadable catalog reads as empty and unusable files are reported per id.
#[tauri::command(async)]
pub fn brush_library_scan() -> Result<BrushLibraryScanResponse, String> {
    let _guard = lock_library();
    Ok(scan_library_at(&library_root()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::frame_codec::{
        parse_webp_dimensions, BRUSH_MASK_EDGE, BRUSH_MASK_UNREADABLE, BRUSH_MASK_WRONG_SIZE,
    };

    fn probe_mask(seed: u32) -> Vec<u8> {
        let mut state = seed | 1;
        (0..BRUSH_MASK_BYTES)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 17;
                state ^= state << 5;
                (state >> 24) as u8
            })
            .collect()
    }

    fn scratch_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!("efx-brush-library-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).expect("scratch root");
        root
    }

    #[test]
    fn write_returns_content_derived_id_and_a_512_lossless_webp() {
        let root = scratch_root();
        let mask = probe_mask(0x9e37_79b9);
        let entry = write_library_entry_at(&root, "grain.png", &mask).expect("write");

        assert_eq!(entry.digest.len(), 64);
        assert!(valid_digest(&entry.digest));
        assert_eq!(entry.id, format!("wc/custom-{}", &entry.digest[..12]));
        assert_eq!(entry.texture_rotation, 0);
        assert_eq!(entry.name, "grain.png");

        let stored = fs::read(mask_path(&root, &entry.digest)).expect("stored file");
        assert_eq!(
            parse_webp_dimensions(&stored),
            Some((BRUSH_MASK_EDGE, BRUSH_MASK_EDGE))
        );
        let decoded = decode_mask_webp(&stored).expect("lossless decode");
        assert_eq!(decoded, mask);

        let catalog = read_catalog(&root);
        assert_eq!(catalog.version, BRUSH_LIBRARY_CATALOG_VERSION);
        assert_eq!(catalog.entries.len(), 1);
        assert_eq!(catalog.entries[0], entry);
    }

    #[test]
    fn write_refuses_a_body_that_is_not_512_squared_before_any_encode() {
        let root = scratch_root();
        assert!(write_library_entry_at(&root, "x.png", &[]).is_err());
        assert!(write_library_entry_at(&root, "x.png", &vec![0u8; BRUSH_MASK_BYTES - 1]).is_err());
        assert!(write_library_entry_at(&root, "x.png", &vec![0u8; BRUSH_MASK_BYTES + 1]).is_err());
        assert!(!catalog_path(&root).exists());
    }

    #[test]
    fn writing_the_same_bytes_twice_keeps_one_row_one_file_and_rewrites_nothing() {
        let root = scratch_root();
        let mask = probe_mask(0x2545_f491);
        let first = write_library_entry_at(&root, "first.png", &mask).expect("first write");
        let catalog_before = fs::read(catalog_path(&root)).expect("catalog before");
        let second = write_library_entry_at(&root, "second.png", &mask).expect("second write");
        let catalog_after = fs::read(catalog_path(&root)).expect("catalog after");

        assert_eq!(first, second);
        assert_eq!(first.id, second.id);
        assert_eq!(catalog_before, catalog_after);
        let catalog = read_catalog(&root);
        assert_eq!(catalog.entries.len(), 1);
        assert_eq!(fs::read_dir(&root).expect("root listing").count(), 2); // one webp + catalog
    }

    #[test]
    fn a_digest_name_holding_different_bytes_is_refused_never_overwritten() {
        let root = scratch_root();
        let mask = probe_mask(0x1234_5678);
        let entry = write_library_entry_at(&root, "a.png", &mask).expect("first write");
        let target = mask_path(&root, &entry.digest);
        fs::write(&target, b"different bytes").expect("poison file");
        let error = write_library_entry_at(&root, "a.png", &mask).unwrap_err();
        assert_eq!(error, "digest-collision");
        assert_eq!(fs::read(&target).expect("poison survives"), b"different bytes");
    }

    #[test]
    fn decode_round_trips_the_mask_and_refuses_wrong_sizes() {
        let root = scratch_root();
        let mask = probe_mask(0x0bad_f00d);
        let entry = write_library_entry_at(&root, "r.png", &mask).expect("write");
        let decoded = decode_library_entry_at(&root, &entry.digest).expect("decode");
        assert_eq!(decoded.width, BRUSH_MASK_EDGE);
        assert_eq!(decoded.height, BRUSH_MASK_EDGE);
        assert_eq!(decode_base64(&decoded.mask_base64).expect("mask base64"), mask);

        // A 191×191 and a 193×193 WebP are both `wrong-size`.
        use crate::services::frame_codec::{FrameCodec, WebPLosslessCodec};
        for edge in [BRUSH_MASK_EDGE - 1, BRUSH_MASK_EDGE + 1] {
            let rgba = vec![0u8; (edge * edge * 4) as usize];
            let small = WebPLosslessCodec
                .encode_rgba(&rgba, edge, edge)
                .expect("edge frame encode");
            let digest = format!("{:064x}", edge);
            fs::write(mask_path(&root, &digest), &small).expect("write odd file");
            assert_eq!(
                decode_library_entry_at(&root, &digest),
                Err(BRUSH_MASK_WRONG_SIZE.to_string())
            );
        }

        // Garbage is a distinct reason, never a mask.
        let garbage_digest = format!("{:064x}", 7);
        fs::write(mask_path(&root, &garbage_digest), b"not a webp at all").expect("garbage");
        assert_eq!(
            decode_library_entry_at(&root, &garbage_digest),
            Err(BRUSH_MASK_UNREADABLE.to_string())
        );
    }

    #[test]
    fn a_digest_that_is_not_64_lower_case_hex_is_refused_before_any_path_is_built() {
        let root = scratch_root();
        for bad in [
            "",
            "abc",
            "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789",
            "../0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcg",
        ] {
            assert!(!valid_digest(bad));
            assert_eq!(
                decode_library_entry_at(&root, bad),
                Err("invalid-digest".to_string())
            );
        }
        assert!(valid_digest(
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        ));
    }

    #[test]
    fn scan_tolerates_a_missing_catalog_and_returns_an_empty_library() {
        let root = scratch_root();
        let scan = scan_library_at(&root);
        assert!(scan.entries.is_empty());
        assert!(scan.unavailable.is_empty());
    }

    #[test]
    fn scan_lists_rows_whose_file_is_missing_and_marks_them_unavailable() {
        let root = scratch_root();
        let entry = write_library_entry_at(&root, "gone.png", &probe_mask(0x51ed_9a01))
            .expect("write");
        fs::remove_file(mask_path(&root, &entry.digest)).expect("remove stored file");
        let scan = scan_library_at(&root);
        assert_eq!(scan.entries, vec![entry.clone()]);
        assert_eq!(scan.unavailable, vec![entry.id]);
    }

    #[test]
    fn scan_drops_malformed_and_forged_rows_individually_keeping_valid_siblings() {
        let root = scratch_root();
        let entry = write_library_entry_at(&root, "keep.png", &probe_mask(0x0ddc_0ffe))
            .expect("write");
        let mut value: serde_json::Value =
            serde_json::from_slice(&fs::read(catalog_path(&root)).expect("catalog"))
                .expect("parse");
        let entries = value
            .get_mut("entries")
            .and_then(|array| array.as_array_mut())
            .expect("entries");
        // Malformed: every numeric field missing, so the row does not parse.
        entries.push(serde_json::json!({
            "id": "wc/custom-deadbeefdead",
            "name": "bad",
            "digest": "d".repeat(64),
        }));
        // Forged: the id does not derive from the digest.
        let mut forged = serde_json::to_value(&entry).expect("entry json");
        forged["id"] = serde_json::json!("wc/custom-000000000000");
        entries.push(forged);
        // Duplicate digest: the same content address twice keeps the first row.
        entries.push(serde_json::to_value(&entry).expect("entry json"));
        fs::write(catalog_path(&root), serde_json::to_vec(&value).expect("serialize"))
            .expect("rewrite catalog");

        let scan = scan_library_at(&root);
        assert_eq!(scan.entries, vec![entry]);
        assert!(scan.unavailable.is_empty());
    }

    #[test]
    fn scan_marks_a_wrong_size_webp_unavailable() {
        use crate::services::frame_codec::{FrameCodec, WebPLosslessCodec};
        let root = scratch_root();
        let entry = write_library_entry_at(&root, "small.png", &probe_mask(0xabc0_1234))
            .expect("write");
        let edge = BRUSH_MASK_EDGE - 1;
        let rgba = vec![0u8; (edge * edge * 4) as usize];
        let small = WebPLosslessCodec
            .encode_rgba(&rgba, edge, edge)
            .expect("edge frame encode");
        fs::write(mask_path(&root, &entry.digest), &small).expect("overwrite stored file");
        let scan = scan_library_at(&root);
        assert_eq!(scan.entries, vec![entry.clone()]);
        assert_eq!(scan.unavailable, vec![entry.id]);
    }

    #[cfg(unix)]
    #[test]
    fn scan_marks_a_symlinked_file_unavailable() {
        let root = scratch_root();
        let entry = write_library_entry_at(&root, "link.png", &probe_mask(0x5ee1_1e55))
            .expect("write");
        let target = mask_path(&root, &entry.digest);
        let elsewhere = scratch_root().join("real.webp");
        fs::rename(&target, &elsewhere).expect("move real file");
        std::os::unix::fs::symlink(&elsewhere, &target).expect("symlink stored file");
        let scan = scan_library_at(&root);
        assert_eq!(scan.entries, vec![entry.clone()]);
        assert_eq!(scan.unavailable, vec![entry.id]);
    }

    #[test]
    fn delete_removes_one_row_and_one_file_and_keeps_the_siblings() {
        let root = scratch_root();
        let kept = write_library_entry_at(&root, "keep.png", &probe_mask(0x1111_2222))
            .expect("keep write");
        let gone = write_library_entry_at(&root, "gone.png", &probe_mask(0x3333_4444))
            .expect("gone write");

        delete_library_entry_at(&root, &gone.digest).expect("delete");

        assert!(!mask_path(&root, &gone.digest).exists());
        assert!(mask_path(&root, &kept.digest).exists());
        let catalog = read_catalog(&root);
        assert_eq!(catalog.entries, vec![kept]);
    }

    #[test]
    fn delete_removes_the_row_even_when_the_file_is_already_missing() {
        let root = scratch_root();
        let entry = write_library_entry_at(&root, "lost.png", &probe_mask(0x5555_6666))
            .expect("write");
        fs::remove_file(mask_path(&root, &entry.digest)).expect("remove file behind the row");

        delete_library_entry_at(&root, &entry.digest).expect("delete");
        assert!(read_catalog(&root).entries.is_empty());
    }

    #[test]
    fn delete_of_an_absent_digest_is_an_idempotent_no_op() {
        let root = scratch_root();
        let entry = write_library_entry_at(&root, "once.png", &probe_mask(0x7777_8888))
            .expect("write");
        delete_library_entry_at(&root, &entry.digest).expect("first delete");
        let catalog_after_first = fs::read(catalog_path(&root)).expect("catalog");
        delete_library_entry_at(&root, &entry.digest).expect("second delete");
        assert_eq!(
            fs::read(catalog_path(&root)).expect("catalog"),
            catalog_after_first
        );
    }

    #[test]
    fn delete_refuses_a_digest_that_is_not_64_lower_case_hex_before_any_path_is_built() {
        let root = scratch_root();
        let entry = write_library_entry_at(&root, "safe.png", &probe_mask(0x9999_aaaa))
            .expect("write");
        for bad in [
            "",
            "abc",
            "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789",
            "../0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd",
        ] {
            assert_eq!(
                delete_library_entry_at(&root, bad),
                Err("invalid-digest".to_string())
            );
        }
        // Nothing was touched by a refused digest.
        assert!(mask_path(&root, &entry.digest).exists());
        assert_eq!(read_catalog(&root).entries, vec![entry]);
    }

    #[cfg(unix)]
    #[test]
    fn delete_refuses_a_symlinked_target_and_keeps_the_row() {
        let root = scratch_root();
        let entry = write_library_entry_at(&root, "linked.png", &probe_mask(0xbbbb_cccc))
            .expect("write");
        let target = mask_path(&root, &entry.digest);
        let elsewhere = scratch_root().join("real.webp");
        fs::rename(&target, &elsewhere).expect("move real file");
        std::os::unix::fs::symlink(&elsewhere, &target).expect("symlink stored file");

        let error = delete_library_entry_at(&root, &entry.digest).unwrap_err();
        assert!(error.contains("Symlinked"), "unexpected error: {error}");
        assert!(elsewhere.exists(), "the symlink target survives");
        assert_eq!(read_catalog(&root).entries, vec![entry]);
    }

    #[cfg(unix)]
    #[test]
    fn delete_reports_a_catalog_rewrite_failure_and_keeps_the_previous_catalog() {
        use std::os::unix::fs::PermissionsExt;
        let root = scratch_root();
        let entry = write_library_entry_at(&root, "frozen.png", &probe_mask(0xdddd_eeee))
            .expect("write");
        let catalog_before = fs::read(catalog_path(&root)).expect("catalog before");
        // The file is already gone, so the delete's unlink is a no-op; the
        // catalog rewrite into a read-only root then fails.
        fs::remove_file(mask_path(&root, &entry.digest)).expect("remove file first");
        fs::set_permissions(&root, fs::Permissions::from_mode(0o555)).expect("freeze root");

        let result = delete_library_entry_at(&root, &entry.digest);
        fs::set_permissions(&root, fs::Permissions::from_mode(0o755)).expect("thaw root");

        assert!(result.is_err(), "a failed rewrite must report, not silently pass");
        assert_eq!(
            fs::read(catalog_path(&root)).expect("catalog after"),
            catalog_before,
            "the previous catalog survives a failed rewrite"
        );
    }

    #[test]
    fn write_accepts_the_command_body_shape() {
        // The command's JSON body is `{ name, maskBase64 }`; the base64 decoder
        // is the shared strict one, so a malformed body is refused, not parsed.
        let mask = probe_mask(0xfeed_face);
        let body = format!(
            "{{\"name\":\"n.png\",\"maskBase64\":\"{}\"}}",
            crate::commands::frame_codec::encode_base64(&mask)
        );
        let parsed: BrushLibraryWriteBody = serde_json::from_str(&body).expect("body parse");
        assert_eq!(parsed.name, "n.png");
        assert_eq!(decode_base64(&parsed.mask_base64).expect("mask"), mask);
    }
}
