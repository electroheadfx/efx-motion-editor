use crate::services::frame_codec::{FrameCodec, WebPLosslessCodec};
use serde::Serialize;
use tauri::ipc::{InvokeBody, InvokeResponseBody, Request, Response};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecodedWebpFrame {
    pub width: u32,
    pub height: u32,
    /// Base64-encoded RGBA (`width * height * 4` bytes when decoded). Never a
    /// JSON number array or a raw body: on macOS a raw response degrades to a
    /// number array (see `toUint8Array` in webpFrameCodec.ts) and a 1920×1080
    /// frame would marshal ~33 MB of JSON on the webview main thread (~3.4 s
    /// measured in the 2026-09-11 stall session). Base64 keeps this leg one
    /// flat string that the JS side decodes in tens of milliseconds.
    pub rgba_base64: String,
    /// Pure codec wall time in ms for `decode_rgba` only — excludes the base64
    /// response encode, the request-body handoff, and the response JSON
    /// serialize. Diagnostic telemetry (stall investigation 2026-09-11); the JS
    /// decoder treats a missing value as "not measured" for older payloads/mocks.
    pub codec_ms: f64,
}

const BASE64_ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Hand-rolled base64 (no crate dependency): 3-byte chunks → 4 chars, padded.
fn encode_base64(bytes: &[u8]) -> String {
    let mut output = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        output.push(BASE64_ALPHABET[((triple >> 18) & 63) as usize] as char);
        output.push(BASE64_ALPHABET[((triple >> 12) & 63) as usize] as char);
        output.push(if chunk.len() > 1 { BASE64_ALPHABET[((triple >> 6) & 63) as usize] as char } else { '=' });
        output.push(if chunk.len() > 2 { BASE64_ALPHABET[(triple & 63) as usize] as char } else { '=' });
    }
    output
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

/// Decode WebP-lossless frame bytes back to raw RGBA. The compressed bytes ride
/// the invoke body raw (mirroring `encode_webp_frame` — the typed-arg path
/// JSON-marshalled them), and the RGBA returns base64 (see `DecodedWebpFrame`).
#[tauri::command(async)]
pub fn decode_webp_frame(request: Request) -> Result<DecodedWebpFrame, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("decode_webp_frame: expected a raw byte body".to_string()),
    };
    let codec_started = std::time::Instant::now();
    let (width, height, rgba) = WebPLosslessCodec.decode_rgba(&bytes)?;
    let codec_ms = codec_started.elapsed().as_secs_f64() * 1000.0;
    Ok(DecodedWebpFrame {
        width,
        height,
        rgba_base64: encode_base64(&rgba),
        codec_ms,
    })
}
