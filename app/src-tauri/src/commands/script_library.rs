use crate::services::script_library::{self, ScriptLibraryMigration, ScriptLibraryOperation, ScriptLibraryScan, ScriptLibraryState};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use tauri::{command, State, WebviewWindow};

const MAIN_WINDOW_LABEL: &str = "main";

fn require_main_window(window: &WebviewWindow) -> Result<(), String> {
    if window.label() == MAIN_WINDOW_LABEL { Ok(()) } else { Err("Script library authority is owned by the main window".to_string()) }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThumbnailEncodeRequest {
    operation_id: String,
    width: u32,
    height: u32,
    quality: f32,
    rgba_base64: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailEncodeResponse {
    width: u32,
    height: u32,
    mime_type: &'static str,
    webp_base64: String,
}

#[command]
pub fn script_library_encode_thumbnail_webp(window: WebviewWindow, request: ThumbnailEncodeRequest) -> Result<ThumbnailEncodeResponse, String> {
    require_main_window(&window)?;
    encode_thumbnail_webp(request)
}

#[cfg(feature = "script-library-test-support")]
pub(crate) fn encode_thumbnail_webp_for_test(operation_id: String, width: u32, height: u32, quality: f32, rgba_base64: String) -> Result<Value, String> {
    serde_json::to_value(encode_thumbnail_webp(ThumbnailEncodeRequest { operation_id, width, height, quality, rgba_base64 })?)
        .map_err(|error| format!("Could not serialize encoded thumbnail: {error}"))
}

fn encode_thumbnail_webp(request: ThumbnailEncodeRequest) -> Result<ThumbnailEncodeResponse, String> {
    if request.operation_id.is_empty() || request.operation_id.len() > 256 || request.operation_id.bytes().any(|byte| !(0x20..=0x7e).contains(&byte)) { return Err("Invalid thumbnail operation ID".to_string()); }
    if request.width == 0 || request.width > 96 || request.height == 0 || request.height > 64 { return Err("Invalid thumbnail dimensions".to_string()); }
    if !request.quality.is_finite() || !(0.75..=0.85).contains(&request.quality) { return Err("Invalid thumbnail quality".to_string()); }
    let expected = usize::try_from(request.width).ok()
        .and_then(|width| usize::try_from(request.height).ok().and_then(|height| width.checked_mul(height)))
        .and_then(|pixels| pixels.checked_mul(4))
        .ok_or_else(|| "Invalid thumbnail RGBA dimensions".to_string())?;
    let expected_base64 = expected.div_ceil(3).checked_mul(4).ok_or_else(|| "Invalid thumbnail Base64 length".to_string())?;
    if request.rgba_base64.len() != expected_base64 { return Err("Thumbnail Base64 length does not match dimensions".to_string()); }
    let rgba = script_library::decode_base64(&request.rgba_base64)?;
    if rgba.len() != expected { return Err("Thumbnail RGBA length does not match dimensions".to_string()); }
    let encoded = webp::Encoder::from_rgba(&rgba, request.width, request.height).encode(request.quality * 100.0);
    let bytes: &[u8] = encoded.as_ref();
    if bytes.len() > 512 * 1024 { return Err("Encoded WebP exceeds the size limit".to_string()); }
    let (actual_width, actual_height) = script_library::validate_webp_payload(bytes)?;
    if actual_width != u64::from(request.width) || actual_height != u64::from(request.height) { return Err("Encoded WebP dimensions do not match the request".to_string()); }
    Ok(ThumbnailEncodeResponse {
        width: request.width,
        height: request.height,
        mime_type: "image/webp",
        webp_base64: encode_base64(bytes),
    })
}

fn encode_base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let value = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        output.push(ALPHABET[((value >> 18) & 63) as usize] as char);
        output.push(ALPHABET[((value >> 12) & 63) as usize] as char);
        output.push(if chunk.len() > 1 { ALPHABET[((value >> 6) & 63) as usize] as char } else { '=' });
        output.push(if chunk.len() > 2 { ALPHABET[(value & 63) as usize] as char } else { '=' });
    }
    output
}

#[command]
pub fn script_library_bind_saved_project(window: WebviewWindow, state: State<'_, ScriptLibraryState>, file_path: String) -> Result<String, String> {
    require_main_window(&window)?;
    let root = Path::new(&file_path).parent().ok_or_else(|| "Saved project path has no parent".to_string())?;
    state.bind(root)
}

#[command]
pub fn script_library_clear_active_project(window: WebviewWindow, state: State<'_, ScriptLibraryState>) -> Result<(), String> {
    require_main_window(&window)?;
    state.clear()
}

#[command]
pub fn script_library_scan(state: State<'_, ScriptLibraryState>, authority: String) -> Result<ScriptLibraryScan, String> {
    script_library::scan(&state, &authority)
}

#[command]
pub fn script_library_load(state: State<'_, ScriptLibraryState>, authority: String, script_id: String) -> Result<ScriptLibraryOperation, String> {
    script_library::load(&state, &authority, &script_id)
}

#[command]
pub fn script_library_save(state: State<'_, ScriptLibraryState>, authority: String, script: Value) -> Result<ScriptLibraryOperation, String> {
    script_library::save(&state, &authority, script)
}

#[command]
pub fn script_library_rename(state: State<'_, ScriptLibraryState>, authority: String, script_id: String, expected_revision: String, name: String) -> Result<ScriptLibraryOperation, String> {
    script_library::rename(&state, &authority, &script_id, &expected_revision, &name)
}

#[command]
pub fn script_library_delete(state: State<'_, ScriptLibraryState>, authority: String, script_id: String, expected_revision: String) -> Result<ScriptLibraryOperation, String> {
    script_library::delete(&state, &authority, &script_id, &expected_revision)
}

#[command]
pub fn script_library_migrate_saved_projects(window: WebviewWindow, state: State<'_, ScriptLibraryState>, source_file_path: String, destination_file_path: String) -> Result<ScriptLibraryMigration, String> {
    require_main_window(&window)?;
    let source = Path::new(&source_file_path).parent().ok_or_else(|| "Source project path has no parent".to_string())?;
    let destination = Path::new(&destination_file_path).parent().ok_or_else(|| "Destination project path has no parent".to_string())?;
    state.migrate_active(source, destination)
}
