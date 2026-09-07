use crate::services::frame_codec::{FrameCodec, WebPLosslessCodec};
use serde::Serialize;
use tauri::ipc::{InvokeBody, InvokeResponseBody, Request, Response};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecodedWebpFrame {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

/// Encode an RGBA buffer to WebP-lossless frame bytes. The raw RGBA crosses the
/// Tauri boundary as the invoke body (never a JSON number array — a 1920×1080
/// frame would serialize to ~33 MB of JSON); `width`/`height` ride in headers.
/// 52.1 (D-07): lossless WebP encoding is CPU-heavy — `async` runs the command
/// on a thread pool instead of the main thread so a frame change never blocks
/// the IPC/UI.
#[tauri::command(async)]
pub fn encode_webp_frame(request: Request) -> Result<Response, String> {
    let headers = request.headers();
    let width: u32 = headers
        .get("width")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
        .ok_or("encode_webp_frame: missing or invalid width header")?;
    let height: u32 = headers
        .get("height")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
        .ok_or("encode_webp_frame: missing or invalid height header")?;
    let rgba = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("encode_webp_frame: expected a raw byte body".to_string()),
    };
    let encoded = WebPLosslessCodec.encode_rgba(&rgba, width, height)?;
    Ok(Response::new(InvokeResponseBody::Raw(encoded)))
}

#[tauri::command(async)]
pub fn decode_webp_frame(bytes: Vec<u8>) -> Result<DecodedWebpFrame, String> {
    let (width, height, rgba) = WebPLosslessCodec.decode_rgba(&bytes)?;
    Ok(DecodedWebpFrame {
        width,
        height,
        rgba,
    })
}
