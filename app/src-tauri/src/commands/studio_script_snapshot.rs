//! quick-261023-l35: the Studio script snapshot cache commands.
//!
//! Both commands follow the `efx_paint_media.rs` shape: `#[tauri::command(async)]`
//! with a `Request`, the key scalars in request headers, and the snapshot bytes
//! as the raw invoke body — never a JSON array of integers.
//!
//! The cache root is resolved ONCE here from `app.path().app_data_dir()` and
//! handed to the service, so the service itself stays unit-testable against a
//! temp directory and the renderer never names a filesystem path. The read leg
//! returns base64 for the same reason `efx_paint_read_frame_media` does: a raw
//! response body degrades to a JSON number array on macOS.

use crate::commands::frame_codec::encode_base64;
use crate::services::efx_paint_media::EfxPaintMediaIoError;
use crate::services::studio_script_snapshot::{
    read_snapshot, snapshot_root, write_snapshot, StudioScriptSnapshotError,
};
use serde::Serialize;
use tauri::http::HeaderMap;
use tauri::ipc::{InvokeBody, Request};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioScriptSnapshotWriteResponse {
    pub byte_length: u64,
    pub digest: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioScriptSnapshotReadResponse {
    pub byte_length: u64,
    pub digest: String,
    /// Base64-encoded SNAP v1 container. Never a raw response body.
    pub bytes_base64: String,
}

fn io_error(message: impl Into<String>) -> StudioScriptSnapshotError {
    StudioScriptSnapshotError::Io(EfxPaintMediaIoError::new(message))
}

fn header(headers: &HeaderMap, name: &str) -> Result<String, StudioScriptSnapshotError> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
        .ok_or_else(|| {
            io_error(format!(
                "studio_script_snapshot: missing or invalid {name} header"
            ))
        })
}

fn snapshot_root_for(
    app: &tauri::AppHandle,
) -> Result<std::path::PathBuf, StudioScriptSnapshotError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| io_error(format!("Could not resolve the app data directory: {error}")))?;
    Ok(snapshot_root(&app_data_dir))
}

/// Writes one key's script snapshot atomically below the machine cache root.
#[tauri::command(async)]
pub fn studio_script_snapshot_write(
    app: tauri::AppHandle,
    request: Request,
) -> Result<StudioScriptSnapshotWriteResponse, StudioScriptSnapshotError> {
    let headers = request.headers();
    let project_id = header(headers, "projectId")?;
    let layer_id = header(headers, "layerId")?;
    let track_id = header(headers, "trackId")?;
    let root = snapshot_root_for(&app)?;
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => {
            return Err(io_error(
                "studio_script_snapshot_write: expected a raw byte body",
            ))
        }
    };
    let result = write_snapshot(&root, &project_id, &layer_id, &track_id, &bytes)?;
    Ok(StudioScriptSnapshotWriteResponse {
        byte_length: result.byte_length,
        digest: result.digest,
    })
}

/// Reads one key's script snapshot back. An absent snapshot maps to the
/// `missing` label — the renderer treats that as the silent no-op first session.
#[tauri::command(async)]
pub fn studio_script_snapshot_read(
    app: tauri::AppHandle,
    request: Request,
) -> Result<StudioScriptSnapshotReadResponse, StudioScriptSnapshotError> {
    let headers = request.headers();
    let project_id = header(headers, "projectId")?;
    let layer_id = header(headers, "layerId")?;
    let track_id = header(headers, "trackId")?;
    let root = snapshot_root_for(&app)?;
    let result = read_snapshot(&root, &project_id, &layer_id, &track_id)?;
    Ok(StudioScriptSnapshotReadResponse {
        byte_length: result.byte_length,
        digest: result.digest,
        bytes_base64: encode_base64(&result.bytes),
    })
}
