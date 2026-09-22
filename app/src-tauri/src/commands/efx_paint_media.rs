//! 52.2-01: raw-byte frame-media commands over the package `frames/` tree.
//!
//! Both commands follow the `frame_codec.rs` shape: `#[tauri::command(async)]`
//! with a `Request`, scalars in request headers, and the frame bytes as the
//! raw invoke body — never a JSON array of integers.
//!
//! Deviation from the plan's "return bytes through `tauri::ipc::Response::new`
//! with `digest`/`relative_path` as response headers": `tauri::ipc::Response`
//! (2.11.5) exposes only `new(body)` and carries no headers, so the read leg
//! returns base64 instead — mirroring `DecodedWebpFrame.rgba_base64`, whose
//! comment records why a raw response body degrades to a JSON number array on
//! macOS (~33 MB marshalling for a 1920×1080 frame).

use crate::commands::frame_codec::encode_base64;
use crate::services::efx_paint_media::{
    read_frame_media, write_frame_media, EfxPaintMediaError, EfxPaintMediaIoError,
};
use serde::Serialize;
use std::path::PathBuf;
use tauri::http::HeaderMap;
use tauri::ipc::{InvokeBody, Request};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameMediaWriteResponse {
    pub relative_path: String,
    pub digest: String,
    pub byte_length: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameMediaReadResponse {
    pub relative_path: String,
    pub digest: String,
    pub byte_length: u64,
    /// Base64-encoded WebP bytes. Never a JSON number array or a raw response
    /// body — see the module comment.
    pub bytes_base64: String,
}

/// [DEBUG-9f3c] The wire carries one fixed label by contract (T-52.2-03), so an
/// `io` failure reaches the renderer with no cause at all. stderr is a local
/// channel, not the wire: print the real message to the dev terminal.
#[cfg(debug_assertions)]
pub(crate) fn trace_media_error(error: &EfxPaintMediaError) {
    if let EfxPaintMediaError::Io(io) = error {
        eprintln!("[DEBUG-9f3c] efx-paint media io: {}", io.message);
    }
}

#[cfg(not(debug_assertions))]
pub(crate) fn trace_media_error(_error: &EfxPaintMediaError) {}

fn header(headers: &HeaderMap, name: &str) -> Result<String, EfxPaintMediaError> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
        .ok_or_else(|| {
            let error = EfxPaintMediaError::Io(EfxPaintMediaIoError::new(format!(
                "efx_paint_frame_media: missing or invalid {name} header"
            )));
            trace_media_error(&error);
            error
        })
}

/// Writes one real key's raster to `frames/<layerId>/<keyId>.webp` (or into
/// the save transaction's staging root when `stagingBasename` is supplied) and
/// returns the canonical relative path plus the Rust-computed SHA-256.
#[tauri::command(async)]
pub fn efx_paint_write_frame_media(
    request: Request,
) -> Result<FrameMediaWriteResponse, EfxPaintMediaError> {
    let headers = request.headers();
    let package_dir = header(headers, "packageDir")?;
    let layer_id = header(headers, "layerId")?;
    let key_id = header(headers, "keyId")?;
    let staging_basename = headers
        .get("stagingBasename")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => {
            let error = EfxPaintMediaError::Io(EfxPaintMediaIoError::new(
                "efx_paint_write_frame_media: expected a raw byte body",
            ));
            trace_media_error(&error);
            return Err(error);
        }
    };
    let result = write_frame_media(
        &PathBuf::from(&package_dir),
        staging_basename.as_deref(),
        &layer_id,
        &key_id,
        &bytes,
    );
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            trace_media_error(&error);
            return Err(error);
        }
    };
    Ok(FrameMediaWriteResponse {
        relative_path: result.relative_path,
        digest: result.digest,
        byte_length: result.byte_length,
    })
}

/// Reads one real key's raster back and returns the digest computed from the
/// bytes actually read (D-13). The caller compares that digest against the one
/// recorded in the layer sub-file and refuses on mismatch.
#[tauri::command(async)]
pub fn efx_paint_read_frame_media(
    request: Request,
) -> Result<FrameMediaReadResponse, EfxPaintMediaError> {
    let headers = request.headers();
    let package_dir = header(headers, "packageDir")?;
    let relative_path = header(headers, "relativePath")?;
    let result = read_frame_media(&PathBuf::from(&package_dir), &relative_path);
    let result = match result {
        Ok(result) => result,
        Err(error) => {
            trace_media_error(&error);
            return Err(error);
        }
    };
    Ok(FrameMediaReadResponse {
        relative_path: result.relative_path,
        digest: result.digest,
        byte_length: result.byte_length,
        bytes_base64: encode_base64(&result.bytes),
    })
}
