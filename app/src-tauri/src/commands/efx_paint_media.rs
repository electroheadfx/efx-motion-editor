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
    digest_bytes, read_frame_media, write_brush_asset, write_frame_media, EfxPaintMediaError,
    EfxPaintMediaIoError, EfxPaintMediaRejection,
};
use crate::services::frame_codec::{
    decode_mask_webp, encode_mask_webp, BRUSH_MASK_BYTES, BRUSH_MASK_EDGE,
    BRUSH_MASK_UNREADABLE, BRUSH_MASK_WRONG_SIZE,
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

fn header(headers: &HeaderMap, name: &str) -> Result<String, EfxPaintMediaError> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
        .ok_or_else(|| {
            EfxPaintMediaError::Io(EfxPaintMediaIoError::new(format!(
                "efx_paint_frame_media: missing or invalid {name} header"
            )))
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
            return Err(EfxPaintMediaError::Io(EfxPaintMediaIoError::new(
                "efx_paint_write_frame_media: expected a raw byte body",
            )))
        }
    };
    let result = write_frame_media(
        &PathBuf::from(package_dir),
        staging_basename.as_deref(),
        &layer_id,
        &key_id,
        &bytes,
    )?;
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
    let result = read_frame_media(&PathBuf::from(package_dir), &relative_path)?;
    Ok(FrameMediaReadResponse {
        relative_path: result.relative_path,
        digest: result.digest,
        byte_length: result.byte_length,
        bytes_base64: encode_base64(&result.bytes),
    })
}

// --- 63-02: the brush tip pipeline's disk boundary -------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrushMaskEncodeResponse {
    /// Base64 lossless WebP, content-addressed on disk by `digest`.
    pub bytes_base64: String,
    /// SHA-256 of the WebP bytes — the asset's filename stem.
    pub digest: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrushAssetWriteResponse {
    pub relative_path: String,
    pub digest: String,
    pub byte_length: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrushMaskDecodeResponse {
    /// Base64 of the 36,864 mask bytes, alpha channel only.
    pub mask_base64: String,
    pub width: u32,
    pub height: u32,
}

fn raw_body<'a>(request: &'a Request, command: &str) -> Result<&'a [u8], EfxPaintMediaError> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes.as_slice()),
        _ => Err(EfxPaintMediaError::Io(EfxPaintMediaIoError::new(format!(
            "{command}: expected a raw byte body"
        )))),
    }
}

/// 63-02 (D-10, D-11): encodes one 36,864-byte mask into the lossless
/// brush-asset WebP profile. The body must be exactly 192×192 alpha bytes; the
/// RGBA expansion and the one-off higher-effort encode live in `frame_codec`,
/// never on the frame hot path.
#[tauri::command(async)]
pub fn efx_paint_encode_brush_mask(
    request: Request,
) -> Result<BrushMaskEncodeResponse, EfxPaintMediaError> {
    let body = raw_body(&request, "efx_paint_encode_brush_mask")?;
    encode_brush_mask_bytes(body)
}

fn encode_brush_mask_bytes(bytes: &[u8]) -> Result<BrushMaskEncodeResponse, EfxPaintMediaError> {
    if bytes.len() != BRUSH_MASK_BYTES {
        return Err(EfxPaintMediaError::Io(EfxPaintMediaIoError::new(format!(
            "efx_paint_encode_brush_mask: expected exactly {BRUSH_MASK_BYTES} mask bytes; got {}",
            bytes.len()
        ))));
    }
    let webp = encode_mask_webp(bytes)
        .map_err(|message| EfxPaintMediaError::Io(EfxPaintMediaIoError::new(message)))?;
    Ok(BrushMaskEncodeResponse {
        digest: digest_bytes(&webp),
        bytes_base64: encode_base64(&webp),
        width: BRUSH_MASK_EDGE,
        height: BRUSH_MASK_EDGE,
    })
}

/// 63-02 (T-63-05): writes one content-addressed brush asset into
/// `brushes/<sha256>.webp` (or the save transaction's staging root when
/// `stagingBasename` is supplied). The digest must equal the stem —
/// `write_brush_asset` refuses a mismatch before any IO.
#[tauri::command(async)]
pub fn efx_paint_write_brush_asset(
    request: Request,
) -> Result<BrushAssetWriteResponse, EfxPaintMediaError> {
    let headers = request.headers();
    let package_dir = header(headers, "packageDir")?;
    let relative_path = header(headers, "relativePath")?;
    let staging_basename = headers
        .get("stagingBasename")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let bytes = raw_body(&request, "efx_paint_write_brush_asset")?;
    let written = write_brush_asset(
        &PathBuf::from(package_dir),
        &relative_path,
        bytes,
        staging_basename.as_deref(),
    )?;
    Ok(BrushAssetWriteResponse {
        relative_path: written,
        digest: digest_bytes(bytes),
        byte_length: bytes.len() as u64,
    })
}

/// 63-02 (T-63-03): decodes one stored brush asset. The declared dimensions are
/// read from the WebP header BEFORE any pixel buffer is allocated, so a hostile
/// 20000×20000 payload is `wrongSize` and never reaches the decoder.
#[tauri::command(async)]
pub fn efx_paint_decode_brush_mask(
    request: Request,
) -> Result<BrushMaskDecodeResponse, EfxPaintMediaError> {
    let body = raw_body(&request, "efx_paint_decode_brush_mask")?;
    decode_brush_mask_bytes(body)
}

fn decode_brush_mask_bytes(bytes: &[u8]) -> Result<BrushMaskDecodeResponse, EfxPaintMediaError> {
    let mask = decode_mask_webp(bytes).map_err(|message| {
        EfxPaintMediaError::Rejected(match message.as_str() {
            BRUSH_MASK_WRONG_SIZE => EfxPaintMediaRejection::WrongSize,
            BRUSH_MASK_UNREADABLE => EfxPaintMediaRejection::Undecodable,
            _ => EfxPaintMediaRejection::Undecodable,
        })
    })?;
    Ok(BrushMaskDecodeResponse {
        mask_base64: encode_base64(&mask),
        width: BRUSH_MASK_EDGE,
        height: BRUSH_MASK_EDGE,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn probe_mask() -> Vec<u8> {
        let mut state = 0x2545_f491_u32;
        (0..BRUSH_MASK_BYTES)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 17;
                state ^= state << 5;
                (state & 0xff) as u8
            })
            .collect()
    }

    fn vp8x_header(width: u32, height: u32) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&0_u32.to_le_bytes());
        bytes.extend_from_slice(b"WEBP");
        bytes.extend_from_slice(b"VP8X");
        bytes.extend_from_slice(&10_u32.to_le_bytes());
        bytes.extend_from_slice(&[0, 0, 0, 0]);
        bytes.extend_from_slice(&(width - 1).to_le_bytes()[..3]);
        bytes.extend_from_slice(&(height - 1).to_le_bytes()[..3]);
        bytes
    }

    #[test]
    fn brush_mask_encode_command_refuses_a_body_that_is_not_192_squared_bytes() {
        assert!(encode_brush_mask_bytes(b"short").is_err());
        assert!(encode_brush_mask_bytes(&vec![0_u8; BRUSH_MASK_BYTES + 1]).is_err());
        let encoded = encode_brush_mask_bytes(&probe_mask()).expect("mask encode");
        assert_eq!(encoded.width, BRUSH_MASK_EDGE);
        assert_eq!(encoded.height, BRUSH_MASK_EDGE);
        assert_eq!(encoded.digest.len(), 64);
    }

    #[test]
    fn brush_mask_decode_command_refuses_a_hostile_declared_size_before_decoding() {
        let hostile = vp8x_header(20000, 20000);
        let error = decode_brush_mask_bytes(&hostile).unwrap_err();
        assert_eq!(
            error,
            EfxPaintMediaError::Rejected(EfxPaintMediaRejection::WrongSize)
        );
        let garbage = decode_brush_mask_bytes(b"not a webp at all").unwrap_err();
        assert_eq!(
            garbage,
            EfxPaintMediaError::Rejected(EfxPaintMediaRejection::Undecodable)
        );
    }

    #[test]
    fn brush_mask_command_round_trip_returns_the_same_mask_bytes() {
        let mask = probe_mask();
        let webp = encode_mask_webp(&mask).expect("mask encode");
        let encoded = encode_brush_mask_bytes(&mask).expect("encode command helper");
        assert_eq!(encoded.bytes_base64, encode_base64(&webp));
        assert_eq!(encoded.digest, digest_bytes(&webp));
        let decoded = decode_brush_mask_bytes(&webp).expect("decode command helper");
        assert_eq!(decoded.mask_base64, encode_base64(&mask));
        assert_eq!(decoded.width, BRUSH_MASK_EDGE);
        assert_eq!(decoded.height, BRUSH_MASK_EDGE);
    }
}
