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
        let _operation = self.operation.lock().map_err(|_| "Script operation lock poisoned".to_string())?;
        let root = canonical_saved_project_root(root)?;
        ensure_scripts_dir(&root)?;
        let authority = Uuid::new_v4().to_string();
        *self.active.lock().map_err(|_| "Script authority lock poisoned".to_string())? = Some(ActiveProjectAuthority { authority: authority.clone(), root });
        Ok(authority)
    }

    pub fn clear(&self) -> Result<(), String> {
        let _operation = self.operation.lock().map_err(|_| "Script operation lock poisoned".to_string())?;
        *self.active.lock().map_err(|_| "Script authority lock poisoned".to_string())? = None;
        Ok(())
    }

    fn resolve(&self, authority: &str) -> Result<PathBuf, String> {
        let active = self.active.lock().map_err(|_| "Script authority lock poisoned".to_string())?;
        let active = active.as_ref().ok_or_else(|| "No active saved project script authority".to_string())?;
        if active.authority != authority { return Err("Stale project script authority".to_string()); }
        canonical_saved_project_root(&active.root)
    }

    pub fn validate_active_root(&self, root: &Path) -> Result<(), String> {
        let requested = canonical_saved_project_root(root)?;
        let active = self.active.lock().map_err(|_| "Script authority lock poisoned".to_string())?;
        let active = active.as_ref().ok_or_else(|| "No active saved project script authority".to_string())?;
        let current = canonical_saved_project_root(&active.root)?;
        if requested == current { Ok(()) } else { Err("Source project is not the active saved project".to_string()) }
    }

    fn with_active<T>(&self, authority: &str, operation: impl FnOnce(&Path) -> Result<T, String>) -> Result<T, String> {
        let _operation = self.operation.lock().map_err(|_| "Script operation lock poisoned".to_string())?;
        let root = self.resolve(authority)?;
        operation(&root)
    }

    pub fn migrate_active(&self, source_root: &Path, destination_root: &Path) -> Result<ScriptLibraryMigration, String> {
        let _operation = self.operation.lock().map_err(|_| "Script operation lock poisoned".to_string())?;
        self.validate_active_root(source_root)?;
        migrate_saved_projects(source_root, destination_root)
    }
}

pub fn scan(state: &ScriptLibraryState, authority: &str) -> Result<ScriptLibraryScan, String> {
    state.with_active(authority, scan_root)
}

pub fn load(state: &ScriptLibraryState, authority: &str, script_id: &str) -> Result<ScriptLibraryOperation, String> {
    state.with_active(authority, |root| {
        let value = read_valid_managed(root, script_id)?;
        Ok(ScriptLibraryOperation { scan: scan_root(root)?, script: Some(value) })
    })
}

pub fn save(state: &ScriptLibraryState, authority: &str, script: Value) -> Result<ScriptLibraryOperation, String> {
    state.with_active(authority, |root| {
        let validated = validate_document(script, None)?;
        let id = document_id(&validated)?;
        let path = managed_path(root, &id)?;
        if path.exists() { return Err("A script with this ID already exists".to_string()); }
        atomic_write_json(&path, &validated, false)?;
        Ok(ScriptLibraryOperation { scan: scan_root(root)?, script: Some(validated) })
    })
}

pub fn rename(state: &ScriptLibraryState, authority: &str, script_id: &str, expected_revision: &str, name: &str) -> Result<ScriptLibraryOperation, String> {
    state.with_active(authority, |root| {
        let normalized = normalize_name(name)?;
        let scan = scan_root(root)?;
        if scan.rows.iter().any(|row| row.id != script_id && row.name.nfc().collect::<String>() == normalized.nfc().collect::<String>()) {
            return Err("A script with this name already exists".to_string());
        }
        let mut value = read_valid_managed(root, script_id)?;
        require_revision(&value, expected_revision)?;
        let object = value.as_object_mut().ok_or_else(|| "Invalid script document".to_string())?;
        object.insert("name".into(), Value::String(normalized));
        object.insert("updatedAt".into(), Value::String(Utc::now().to_rfc3339()));
        let validated = validate_document(value, Some(script_id))?;
        atomic_write_json(&managed_path(root, script_id)?, &validated, true)?;
        Ok(ScriptLibraryOperation { scan: scan_root(root)?, script: Some(validated) })
    })
}

pub fn delete(state: &ScriptLibraryState, authority: &str, script_id: &str, expected_revision: &str) -> Result<ScriptLibraryOperation, String> {
    state.with_active(authority, |root| {
        let value = read_valid_managed(root, script_id)?;
        require_revision(&value, expected_revision)?;
        let path = managed_path(root, script_id)?;
        fs::remove_file(&path).map_err(|error| format!("Could not delete managed script: {error}"))?;
        Ok(ScriptLibraryOperation { scan: scan_root(root)?, script: None })
    })
}

pub fn migrate_saved_projects(source_root: &Path, destination_root: &Path) -> Result<ScriptLibraryMigration, String> {
    let source_root = canonical_saved_project_root(source_root)?;
    let destination_root = canonical_saved_project_root(destination_root)?;
    let destination_scripts = ensure_scripts_dir(&destination_root)?;
    let mut result = ScriptLibraryMigration::default();
    let source_scan = scan_root(&source_root)?;
    result.skipped_invalid = source_scan.skipped_invalid_count;
    result.diagnostics.extend(source_scan.diagnostics);
    let source_scripts = source_root.join("scripts");
    if !source_scripts.exists() { return Ok(result); }
    let mut ids = source_scan.rows.into_iter().map(|row| row.id).collect::<Vec<_>>();
    ids.sort();
    for id in ids {
        let source = read_valid_managed(&source_root, &id)?;
        let destination_path = destination_scripts.join(managed_filename(&id)?);
        if !destination_path.exists() {
            atomic_write_json(&destination_path, &source, false)?;
            result.copied += 1;
            continue;
        }
        let destination = read_json_bounded(&destination_path).ok().and_then(|value| validate_document(value, Some(&id)).ok());
        if destination.as_ref() == Some(&source) {
            result.deduplicated += 1;
            continue;
        }
        let mut remapped = source.clone();
        let remapped_id = Uuid::new_v4().to_string();
        remapped.as_object_mut().ok_or_else(|| "Invalid source script".to_string())?.insert("id".into(), Value::String(remapped_id.clone()));
        let remapped = validate_document(remapped, Some(&remapped_id))?;
        atomic_write_json(&destination_scripts.join(managed_filename(&remapped_id)?), &remapped, false)?;
        result.remapped += 1;
    }
    Ok(result)
}

fn scan_root(root: &Path) -> Result<ScriptLibraryScan, String> {
    let scripts = root.join("scripts");
    if !scripts.exists() { return Ok(ScriptLibraryScan { rows: vec![], skipped_invalid_count: 0, diagnostics: vec![] }); }
    reject_symlink(&scripts, "scripts directory")?;
    let canonical_scripts = fs::canonicalize(&scripts).map_err(|error| format!("Could not resolve scripts directory: {error}"))?;
    if !canonical_scripts.starts_with(root) { return Err("Scripts directory escapes active project".to_string()); }
    let mut candidates = fs::read_dir(&canonical_scripts).map_err(|error| format!("Could not scan scripts directory: {error}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().ends_with(SCRIPT_EXTENSION))
        .collect::<Vec<_>>();
    candidates.sort_by_key(|entry| entry.file_name());
    let mut rows = Vec::new();
    let mut diagnostics = Vec::new();
    for entry in candidates.into_iter().take(MAX_CANDIDATES) {
        let filename = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        let result = (|| {
            reject_symlink(&path, "managed script")?;
            if !entry.file_type().map_err(|error| error.to_string())?.is_file() { return Err("Managed script is not a regular file".to_string()); }
            let expected_id = filename.strip_suffix(SCRIPT_EXTENSION).ok_or_else(|| "Wrong managed extension".to_string())?;
            let value = validate_document(read_json_bounded(&path)?, Some(expected_id))?;
            row_from_document(&value)
        })();
        match result {
            Ok(row) => rows.push(row),
            Err(message) => diagnostics.push(ScriptLibraryDiagnostic { code: "invalid-managed-script".into(), message, filename: Some(filename) }),
        }
    }
    rows.sort_by(|a, b| b.created_at.cmp(&a.created_at).then_with(|| a.id.cmp(&b.id)));
    Ok(ScriptLibraryScan { skipped_invalid_count: diagnostics.len(), rows, diagnostics })
}

fn canonical_saved_project_root(root: &Path) -> Result<PathBuf, String> {
    let canonical = fs::canonicalize(root).map_err(|error| format!("Could not resolve saved project root: {error}"))?;
    if !canonical.is_dir() { return Err("Saved project root is not a directory".to_string()); }
    if canonical.file_name().and_then(|name| name.to_str()) == Some("temp-project") { return Err("Temporary projects cannot own scripts".to_string()); }
    Ok(canonical)
}

fn ensure_scripts_dir(root: &Path) -> Result<PathBuf, String> {
    let scripts = root.join("scripts");
    if scripts.exists() { reject_symlink(&scripts, "scripts directory")?; }
    fs::create_dir_all(&scripts).map_err(|error| format!("Could not create scripts directory: {error}"))?;
    let canonical = fs::canonicalize(&scripts).map_err(|error| format!("Could not resolve scripts directory: {error}"))?;
    if !canonical.starts_with(root) { return Err("Scripts directory escapes active project".to_string()); }
    Ok(canonical)
}

fn managed_filename(id: &str) -> Result<String, String> {
    let uuid = Uuid::parse_str(id).map_err(|_| "Invalid script ID".to_string())?;
    let canonical = uuid.hyphenated().to_string();
    if canonical != id || uuid.get_version_num() != 4 { return Err("Script ID must be a canonical UUID v4".to_string()); }
    Ok(format!("{canonical}{SCRIPT_EXTENSION}"))
}

fn managed_path(root: &Path, id: &str) -> Result<PathBuf, String> {
    let scripts = ensure_scripts_dir(root)?;
    Ok(scripts.join(managed_filename(id)?))
}

fn read_valid_managed(root: &Path, id: &str) -> Result<Value, String> {
    let path = managed_path(root, id)?;
    reject_symlink(&path, "managed script")?;
    if !path.is_file() { return Err("Managed script was not found".to_string()); }
    let canonical = fs::canonicalize(&path).map_err(|error| format!("Could not resolve managed script: {error}"))?;
    if !canonical.starts_with(root.join("scripts")) { return Err("Managed script escapes active project".to_string()); }
    validate_document(read_json_bounded(&canonical)?, Some(id))
}

fn read_json_bounded(path: &Path) -> Result<Value, String> {
    let metadata = fs::metadata(path).map_err(|error| format!("Could not inspect managed script: {error}"))?;
    if metadata.len() > MAX_FILE_BYTES { return Err("Managed script exceeds the size limit".to_string()); }
    let bytes = fs::read(path).map_err(|error| format!("Could not read managed script: {error}"))?;
    serde_json::from_slice(&bytes).map_err(|error| format!("Could not parse managed script: {error}"))
}

pub(crate) fn validate_document(value: Value, expected_id: Option<&str>) -> Result<Value, String> {
    let object = value.as_object().ok_or_else(|| "Script document must be an object".to_string())?;
    if object.get("kind").and_then(Value::as_str) != Some(SCRIPT_KIND) { return Err("Invalid script kind".to_string()); }
    if object.get("schemaVersion").and_then(Value::as_u64) != Some(SCRIPT_VERSION) { return Err("Unsupported script schemaVersion".to_string()); }
    let id = object.get("id").and_then(Value::as_str).ok_or_else(|| "Missing script ID".to_string())?;
    managed_filename(id)?;
    if expected_id.is_some_and(|expected| expected != id) { return Err("Filename and JSON script ID do not match".to_string()); }
    normalize_name(object.get("name").and_then(Value::as_str).ok_or_else(|| "Missing script name".to_string())?)?;
    let created_at = validate_date(object.get("createdAt"), "createdAt")?;
    let updated_at = validate_date(object.get("updatedAt"), "updatedAt")?;
    if updated_at < created_at { return Err("updatedAt must not precede createdAt".to_string()); }
    validate_source(object.get("source"))?;
    validate_thumbnail(object.get("thumbnail"))?;
    validate_brushes(object.get("brushes"))?;
    Ok(value)
}

fn validate_source(value: Option<&Value>) -> Result<(), String> {
    let source = value.and_then(Value::as_object).ok_or_else(|| "Invalid source metadata".to_string())?;
    for key in ["projectName", "layerId", "layerName"] { bounded_text(source.get(key), key, MAX_METADATA_CHARS)?; }
    for key in ["sourceFrame", "displayFrame"] { non_negative_integer(source.get(key), key)?; }
    for key in ["width", "height"] { positive_integer(source.get(key), key, 16_384)?; }
    let background = source.get("background").and_then(Value::as_object).ok_or_else(|| "Invalid background metadata".to_string())?;
    match background.get("background").and_then(Value::as_str) { Some("transparent" | "white" | "canvas1" | "canvas2" | "canvas3") => {}, _ => return Err("Invalid background mode".to_string()) }
    bounded_text(background.get("paperGrain"), "paperGrain", MAX_METADATA_CHARS)?;
    finite_range(background.get("grainStrength"), "grainStrength", 0.0, 1.0)?;
    if let Some(color) = background.get("color") { if !color.is_string() { return Err("Invalid background color".to_string()); } }
    Ok(())
}

fn validate_thumbnail(value: Option<&Value>) -> Result<(), String> {
    let thumb = value.and_then(Value::as_object).ok_or_else(|| "Invalid thumbnail metadata".to_string())?;
    if thumb.get("mimeType").and_then(Value::as_str) != Some("image/webp") { return Err("Thumbnail MIME must be image/webp".to_string()); }
    positive_integer(thumb.get("width"), "thumbnail width", 96)?;
    positive_integer(thumb.get("height"), "thumbnail height", 64)?;
    finite_range(thumb.get("quality"), "thumbnail quality", 0.75, 0.85)?;
    let data_url = thumb.get("dataUrl").and_then(Value::as_str).ok_or_else(|| "Missing thumbnail data URL".to_string())?;
    let encoded = data_url.strip_prefix("data:image/webp;base64,").ok_or_else(|| "Thumbnail must be a WebP data URL".to_string())?;
    let bytes = decode_base64(encoded)?;
    if bytes.len() > MAX_THUMBNAIL_BYTES { return Err("Thumbnail exceeds the decoded size limit".to_string()); }
    let (actual_width, actual_height) = validate_webp_payload(&bytes)?;
    let declared_width = thumb.get("width").and_then(Value::as_u64).ok_or_else(|| "Invalid thumbnail width".to_string())?;
    let declared_height = thumb.get("height").and_then(Value::as_u64).ok_or_else(|| "Invalid thumbnail height".to_string())?;
    if actual_width != declared_width || actual_height != declared_height { return Err("Thumbnail dimensions do not match the WebP payload".to_string()); }
    Ok(())
}

fn validate_brushes(value: Option<&Value>) -> Result<(), String> {
    let brushes = value.and_then(Value::as_array).ok_or_else(|| "Invalid brushes".to_string())?;
    if brushes.is_empty() || brushes.len() > MAX_BRUSHES { return Err("Brush count is outside the supported range".to_string()); }
    let mut total_points = 0usize;
    for brush in brushes {
        let brush = brush.as_object().ok_or_else(|| "Invalid logical brush".to_string())?;
        total_points += validate_stroke(brush.get("primary"), false)?;
        let continuations = brush.get("continuations").and_then(Value::as_array).ok_or_else(|| "Invalid continuation list".to_string())?;
        if continuations.len() > MAX_CONTINUATIONS { return Err("Too many brush continuations".to_string()); }
        for continuation in continuations { validate_stroke(Some(continuation), true)?; }
        if total_points > MAX_TOTAL_POINTS { return Err("Script has too many total points".to_string()); }
    }
    Ok(())
}

fn validate_stroke(value: Option<&Value>, continuation: bool) -> Result<usize, String> {
    let stroke = value.and_then(Value::as_object).ok_or_else(|| "Invalid stroke".to_string())?;
    match stroke.get("tool").and_then(Value::as_str) { Some("paint" | "erase") => {}, _ => return Err("Invalid stroke tool".to_string()) }
    let points = stroke.get("points").and_then(Value::as_array).ok_or_else(|| "Invalid stroke points".to_string())?;
    if continuation { if !points.is_empty() { return Err("Continuation strokes must have zero points".to_string()); } }
    else if points.is_empty() || points.len() > MAX_POINTS_PER_BRUSH { return Err("Primary stroke point count is outside the supported range".to_string()); }
    for point in points { validate_point(point)?; }
    if continuation { positive_integer(stroke.get("diffusionFrames"), "diffusionFrames", 600)?; }
    else if stroke.contains_key("diffusionFrames") { return Err("Primary strokes cannot carry diffusionFrames".to_string()); }
    if let Some(color) = stroke.get("color") { if !color.is_null() && !color.as_str().is_some_and(|value| value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit())) { return Err("Invalid stroke color".to_string()); } }
    let params = stroke.get("params").and_then(Value::as_object).ok_or_else(|| "Invalid stroke params".to_string())?;
    for (key, min, max) in [("size",1.0,80.0),("opacity",10.0,100.0),("pressure",10.0,100.0),("waterAmount",0.0,100.0),("dryAmount",0.0,100.0),("edgeDetail",0.0,100.0),("pickup",0.0,100.0),("eraseStrength",0.0,100.0)] { finite_range(params.get(key), key, min, max)?; }
    non_negative_integer(params.get("antiAlias"), "antiAlias")?;
    if params.get("antiAlias").and_then(Value::as_u64).is_none_or(|value| value > 3) { return Err("Invalid antiAlias".to_string()); }
    non_negative_integer(stroke.get("timestamp"), "timestamp")?;
    if let Some(value) = stroke.get("hasPenInput") { if !value.is_boolean() { return Err("Invalid hasPenInput".to_string()); } }
    if let Some(value) = stroke.get("playFrame") { non_negative_integer(Some(value), "playFrame")?; }
    if let Some(value) = stroke.get("physicsMode") { if !value.is_null() && value.as_str() != Some("local") { return Err("Invalid physicsMode".to_string()); } }
    Ok(points.len())
}

fn validate_point(value: &Value) -> Result<(), String> {
    let point = value.as_object().ok_or_else(|| "Invalid point".to_string())?;
    for (key,min,max) in [("x",-1_000_000.0,1_000_000.0),("y",-1_000_000.0,1_000_000.0),("p",0.0,1.0),("tx",-90.0,90.0),("ty",-90.0,90.0),("tw",-360.0,360.0),("spd",0.0,100_000.0)] { finite_range(point.get(key), key, min, max)?; }
    Ok(())
}

fn row_from_document(value: &Value) -> Result<ScriptLibraryRow, String> {
    let object = value.as_object().ok_or_else(|| "Invalid script".to_string())?;
    Ok(ScriptLibraryRow {
        id: object["id"].as_str().unwrap().into(), revision: document_revision(value)?, name: object["name"].as_str().unwrap().into(),
        created_at: object["createdAt"].as_str().unwrap().into(), updated_at: object["updatedAt"].as_str().unwrap().into(),
        source: object["source"].clone(), thumbnail: object["thumbnail"].clone(), brush_count: object["brushes"].as_array().map_or(0, Vec::len),
    })
}

fn atomic_write_json(path: &Path, value: &Value, replace: bool) -> Result<(), String> {
    if !replace && path.exists() { return Err("Managed script already exists".to_string()); }
    let parent = path.parent().ok_or_else(|| "Managed script has no parent".to_string())?;
    reject_symlink(parent, "scripts directory")?;
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| format!("Could not serialize script: {error}"))?;
    if bytes.len() as u64 > MAX_FILE_BYTES { return Err("Managed script exceeds the size limit".to_string()); }
    let temp = parent.join(format!(".{}.{}.tmp", path.file_name().and_then(|value| value.to_str()).unwrap_or("script"), Uuid::new_v4()));
    let result = (|| {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|error| format!("Could not create script temp file: {error}"))?;
        file.write_all(&bytes).map_err(|error| format!("Could not write script temp file: {error}"))?;
        file.sync_all().map_err(|error| format!("Could not sync script temp file: {error}"))?;
        drop(file);
        fs::rename(&temp, path).map_err(|error| format!("Could not atomically replace script: {error}"))?;
        sync_directory(parent);
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temp); }
    result
}

fn sync_directory(path: &Path) { if let Ok(directory) = File::open(path) { let _ = directory.sync_all(); } }
fn reject_symlink(path: &Path, label: &str) -> Result<(), String> { if path.symlink_metadata().map(|m| m.file_type().is_symlink()).unwrap_or(false) { Err(format!("Symlinked {label} is not allowed")) } else { Ok(()) } }
fn normalize_name(value: &str) -> Result<String, String> { let value = value.nfc().collect::<String>().trim().to_string(); if value.is_empty() || value.chars().count() > MAX_NAME_CHARS || value.chars().any(char::is_control) { Err("Invalid script name".into()) } else { Ok(value) } }
fn document_id(value: &Value) -> Result<String, String> { value.get("id").and_then(Value::as_str).map(str::to_string).ok_or_else(|| "Missing script ID".into()) }
fn document_revision(value: &Value) -> Result<String, String> { let bytes = serde_json::to_vec(value).map_err(|error| format!("Could not compute script revision: {error}"))?; Ok(format!("{:x}", Sha256::digest(bytes))) }
fn require_revision(value: &Value, expected: &str) -> Result<(), String> { if document_revision(value)? == expected { Ok(()) } else { Err("Script changed externally; refresh and try again".to_string()) } }
fn validate_date(value: Option<&Value>, label: &str) -> Result<DateTime<chrono::FixedOffset>, String> { let parsed = value.and_then(Value::as_str).and_then(|value| DateTime::parse_from_rfc3339(value).ok()).ok_or_else(|| format!("Invalid {label}"))?; if parsed.timestamp_millis() < 0 || parsed.timestamp_millis() > 8_640_000_000_000_000 { return Err(format!("Invalid {label}")); } Ok(parsed) }
fn bounded_text(value: Option<&Value>, label: &str, max: usize) -> Result<(), String> { value.and_then(Value::as_str).filter(|v| !v.trim().is_empty() && v.chars().count() <= max && !v.chars().any(char::is_control)).map(|_| ()).ok_or_else(|| format!("Invalid {label}")) }
fn finite_range(value: Option<&Value>, label: &str, min: f64, max: f64) -> Result<(), String> { value.and_then(Value::as_f64).filter(|v| v.is_finite() && *v >= min && *v <= max).map(|_| ()).ok_or_else(|| format!("Invalid {label}")) }
fn non_negative_integer(value: Option<&Value>, label: &str) -> Result<(), String> { value.and_then(Value::as_u64).filter(|v| *v <= 9_007_199_254_740_991).map(|_| ()).ok_or_else(|| format!("Invalid {label}")) }
fn positive_integer(value: Option<&Value>, label: &str, max: u64) -> Result<(), String> { value.and_then(Value::as_u64).filter(|v| *v > 0 && *v <= max.min(9_007_199_254_740_991)).map(|_| ()).ok_or_else(|| format!("Invalid {label}")) }
pub(crate) fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    if input.len() % 4 != 0 { return Err("Invalid thumbnail Base64".into()); }
    let padding = input.bytes().rev().take_while(|byte| *byte == b'=').count();
    if padding > 2 || input[..input.len().saturating_sub(padding)].bytes().any(|byte| !byte.is_ascii_alphanumeric() && byte != b'+' && byte != b'/') || input[..input.len().saturating_sub(padding)].contains('=') { return Err("Invalid thumbnail Base64".into()); }
    let mut output=Vec::with_capacity(input.len()*3/4); let mut buffer=0u32; let mut bits=0u8;
    for byte in input.bytes().take(input.len().saturating_sub(padding)) { let value=match byte { b'A'..=b'Z'=>byte-b'A', b'a'..=b'z'=>byte-b'a'+26, b'0'..=b'9'=>byte-b'0'+52, b'+'=>62, b'/'=>63, _=>return Err("Invalid thumbnail Base64".into()) } as u32; buffer=(buffer<<6)|value; bits+=6; if bits>=8 { bits-=8; output.push((buffer>>bits) as u8); buffer&=(1<<bits)-1; } }
    if bits > 0 && buffer != 0 { return Err("Non-canonical thumbnail Base64".into()); }
    let expected_padding = match output.len() % 3 { 1 => 2, 2 => 1, _ => 0 };
    if padding != expected_padding { return Err("Non-canonical thumbnail Base64".into()); }
    Ok(output)
}
pub(crate) fn validate_webp_payload(bytes: &[u8]) -> Result<(u64, u64), String> {
    if bytes.len() < 20 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WEBP" { return Err("Thumbnail is not a WebP payload".to_string()); }
    let riff_size = u32::from_le_bytes(bytes[4..8].try_into().map_err(|_| "Truncated WebP RIFF header".to_string())?) as usize;
    let container_size = riff_size.checked_add(8).ok_or_else(|| "Invalid WebP RIFF size".to_string())?;
    if container_size != bytes.len() { return Err("WebP RIFF length does not match the payload".to_string()); }
    let mut offset = 12usize;
    let mut image_chunks = 0usize;
    while offset < bytes.len() {
        if bytes.len() - offset < 8 { return Err("Truncated WebP chunk header".to_string()); }
        let kind = &bytes[offset..offset + 4];
        let chunk_size = u32::from_le_bytes(bytes[offset + 4..offset + 8].try_into().map_err(|_| "Truncated WebP chunk size".to_string())?) as usize;
        let data_start = offset + 8;
        let data_end = data_start.checked_add(chunk_size).ok_or_else(|| "Invalid WebP chunk size".to_string())?;
        if data_end > bytes.len() { return Err("Truncated WebP chunk".to_string()); }
        if matches!(kind, b"VP8 " | b"VP8L") { image_chunks += 1; }
        let padded_end = data_end.checked_add(chunk_size & 1).ok_or_else(|| "Invalid WebP chunk padding".to_string())?;
        if padded_end > bytes.len() { return Err("Missing WebP chunk padding".to_string()); }
        if chunk_size & 1 == 1 && bytes[data_end] != 0 { return Err("Invalid WebP chunk padding".to_string()); }
        offset = padded_end;
    }
    if offset != bytes.len() || image_chunks != 1 { return Err("WebP must contain exactly one supported image chunk".to_string()); }
    let reader = image::ImageReader::with_format(std::io::Cursor::new(bytes), image::ImageFormat::WebP);
    let image = reader.decode().map_err(|error| format!("Thumbnail WebP could not be decoded: {error}"))?;
    Ok((u64::from(image.width()), u64::from(image.height())))
}
