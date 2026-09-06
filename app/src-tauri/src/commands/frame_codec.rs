use crate::services::frame_codec::{FrameCodec, WebPLosslessCodec};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecodedWebpFrame {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

#[tauri::command]
pub fn encode_webp_frame(rgba: Vec<u8>, width: u32, height: u32) -> Result<Vec<u8>, String> {
    WebPLosslessCodec.encode_rgba(&rgba, width, height)
}

#[tauri::command]
pub fn decode_webp_frame(bytes: Vec<u8>) -> Result<DecodedWebpFrame, String> {
    let (width, height, rgba) = WebPLosslessCodec.decode_rgba(&bytes)?;
    Ok(DecodedWebpFrame {
        width,
        height,
        rgba,
    })
}
