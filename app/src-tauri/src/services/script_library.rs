use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
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
pub struct ScriptLibraryState(Mutex<Option<ActiveProjectAuthority>>);

#[derive(Clone)]
struct ActiveProjectAuthority {
    authority: String,
    root: PathBuf,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptLibraryRow {
    pub id: String,
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
        let root = canonical_saved_project_root(root)?;
        ensure_scripts_dir(&root)?;
        let authority = Uuid::new_v4().to_string();
        *self.0.lock().map_err(|_| "Script authority lock poisoned".to_string())? = Some(ActiveProjectAuthority { authority: authority.clone(), root });
        Ok(authority)
    }

    pub fn clear(&self) -> Result<(), String> {
        *self.0.lock().map_err(|_| "Script authority lock poisoned".to_string())? = None;
        Ok(())
    }

    fn resolve(&self, authority: &str) -> Result<PathBuf, String> {
        let active = self.0.lock().map_err(|_| "Script authority lock poisoned".to_string())?;
        let active = active.as_ref().ok_or_else(|| "No active saved project script authority".to_string())?;
        if active.authority != authority { return Err("Stale project script authority".to_string()); }
        Ok(active.root.clone())
    }
}

pub fn scan(state: &ScriptLibraryState, authority: &str) -> Result<ScriptLibraryScan, String> {
    scan_root(&state.resolve(authority)?)
}

pub fn load(state: &ScriptLibraryState, authority: &str, script_id: &str) -> Result<ScriptLibraryOperation, String> {
    let root = state.resolve(authority)?;
    let value = read_valid_managed(&root, script_id)?;
    Ok(ScriptLibraryOperation { scan: scan_root(&root)?, script: Some(value) })
}

pub fn save(state: &ScriptLibraryState, authority: &str, script: Value) -> Result<ScriptLibraryOperation, String> {
    let root = state.resolve(authority)?;
    let validated = validate_document(script, None)?;
    let id = document_id(&validated)?;
    let path = managed_path(&root, &id)?;
    if path.exists() { return Err("A script with this ID already exists".to_string()); }
    atomic_write_json(&path, &validated, false)?;
    Ok(ScriptLibraryOperation { scan: scan_root(&root)?, script: Some(validated) })
}

pub fn rename(state: &ScriptLibraryState, authority: &str, script_id: &str, name: &str) -> Result<ScriptLibraryOperation, String> {
    let root = state.resolve(authority)?;
    let normalized = normalize_name(name)?;
    let scan = scan_root(&root)?;
    if scan.rows.iter().any(|row| row.id != script_id && row.name.normalize_nfc() == normalized.normalize_nfc()) {
        return Err("A script with this name already exists".to_string());
    }
    let mut value = read_valid_managed(&root, script_id)?;
    let object = value.as_object_mut().ok_or_else(|| "Invalid script document".to_string())?;
    object.insert("name".into(), Value::String(normalized));
    object.insert("updatedAt".into(), Value::String(Utc::now().to_rfc3339()));
    let validated = validate_document(value, Some(script_id))?;
    atomic_write_json(&managed_path(&root, script_id)?, &validated, true)?;
    Ok(ScriptLibraryOperation { scan: scan_root(&root)?, script: Some(validated) })
}

pub fn delete(state: &ScriptLibraryState, authority: &str, script_id: &str) -> Result<ScriptLibraryOperation, String> {
    let root = state.resolve(authority)?;
    let _ = read_valid_managed(&root, script_id)?;
    let path = managed_path(&root, script_id)?;
    fs::remove_file(&path).map_err(|error| format!("Could not delete managed script: {error}"))?;
    Ok(ScriptLibraryOperation { scan: scan_root(&root)?, script: None })
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

fn validate_document(value: Value, expected_id: Option<&str>) -> Result<Value, String> {
    let object = value.as_object().ok_or_else(|| "Script document must be an object".to_string())?;
    if object.get("kind").and_then(Value::as_str) != Some(SCRIPT_KIND) { return Err("Invalid script kind".to_string()); }
    if object.get("schemaVersion").and_then(Value::as_u64) != Some(SCRIPT_VERSION) { return Err("Unsupported script schemaVersion".to_string()); }
    let id = object.get("id").and_then(Value::as_str).ok_or_else(|| "Missing script ID".to_string())?;
    managed_filename(id)?;
    if expected_id.is_some_and(|expected| expected != id) { return Err("Filename and JSON script ID do not match".to_string()); }
    normalize_name(object.get("name").and_then(Value::as_str).ok_or_else(|| "Missing script name".to_string())?)?;
    validate_date(object.get("createdAt"), "createdAt")?;
    validate_date(object.get("updatedAt"), "updatedAt")?;
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
    if bytes.len() > MAX_THUMBNAIL_BYTES || bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WEBP" { return Err("Thumbnail is not a valid bounded WebP payload".to_string()); }
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
    for (key, min, max) in [("size",1.0,80.0),("opacity",10.0,100.0),("pressure",10.0,100.0),("waterAmount",0.0,100.0),("dryAmount",0.0,100.0),("edgeDetail",0.0,100.0),("pickup",0.0,100.0),("eraseStrength",0.0,100.0),("antiAlias",0.0,3.0)] { finite_range(params.get(key), key, min, max)?; }
    non_negative_integer(stroke.get("timestamp"), "timestamp")?;
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
        id: object["id"].as_str().unwrap().into(), name: object["name"].as_str().unwrap().into(),
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
fn normalize_name(value: &str) -> Result<String, String> { let value = value.trim(); if value.is_empty() || value.chars().count() > MAX_NAME_CHARS || value.chars().any(char::is_control) { Err("Invalid script name".into()) } else { Ok(value.into()) } }
fn document_id(value: &Value) -> Result<String, String> { value.get("id").and_then(Value::as_str).map(str::to_string).ok_or_else(|| "Missing script ID".into()) }
fn validate_date(value: Option<&Value>, label: &str) -> Result<(), String> { value.and_then(Value::as_str).and_then(|value| DateTime::parse_from_rfc3339(value).ok()).map(|_| ()).ok_or_else(|| format!("Invalid {label}")) }
fn bounded_text(value: Option<&Value>, label: &str, max: usize) -> Result<(), String> { value.and_then(Value::as_str).filter(|v| !v.trim().is_empty() && v.chars().count() <= max && !v.chars().any(char::is_control)).map(|_| ()).ok_or_else(|| format!("Invalid {label}")) }
fn finite_range(value: Option<&Value>, label: &str, min: f64, max: f64) -> Result<(), String> { value.and_then(Value::as_f64).filter(|v| v.is_finite() && *v >= min && *v <= max).map(|_| ()).ok_or_else(|| format!("Invalid {label}")) }
fn non_negative_integer(value: Option<&Value>, label: &str) -> Result<(), String> { value.and_then(Value::as_u64).map(|_| ()).ok_or_else(|| format!("Invalid {label}")) }
fn positive_integer(value: Option<&Value>, label: &str, max: u64) -> Result<(), String> { value.and_then(Value::as_u64).filter(|v| *v > 0 && *v <= max).map(|_| ()).ok_or_else(|| format!("Invalid {label}")) }
fn decode_base64(input: &str) -> Result<Vec<u8>, String> { let mut output=Vec::with_capacity(input.len()*3/4); let mut buffer=0u32; let mut bits=0u8; for byte in input.bytes().take_while(|b| *b!=b'=') { let value=match byte { b'A'..=b'Z'=>byte-b'A', b'a'..=b'z'=>byte-b'a'+26, b'0'..=b'9'=>byte-b'0'+52, b'+'=>62, b'/'=>63, _=>return Err("Invalid thumbnail Base64".into()) } as u32; buffer=(buffer<<6)|value; bits+=6; if bits>=8 { bits-=8; output.push((buffer>>bits) as u8); buffer&=(1<<bits)-1; } } Ok(output) }
trait NormalizeNfc { fn normalize_nfc(&self) -> String; }
impl NormalizeNfc for str { fn normalize_nfc(&self) -> String { self.to_string() } }
