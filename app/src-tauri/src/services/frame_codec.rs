/// Codec-agnostic seam for frame byte encoding/decoding (D-02).
///
/// Frame bytes cross the Tauri boundary as raw `Uint8Array`/`ArrayBuffer` (D-07),
/// never as a base64 string. Implementations of this trait own the concrete
/// pixel format (e.g. WebP lossless with `config_exact` alpha semantics, D-01).
pub trait FrameCodec: Send + Sync {
    /// Encode an RGBA buffer (length `width * height * 4`) into frame bytes.
    fn encode_rgba(&self, rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String>;

    /// Decode frame bytes back into `(width, height, rgba)` where `rgba` has
    /// length `width * height * 4`.
    fn decode_rgba(&self, bytes: &[u8]) -> Result<(u32, u32, Vec<u8>), String>;
}

/// WebP lossless codec using libwebp `config_exact` alpha semantics (D-01).
pub struct WebPLosslessCodec;

impl FrameCodec for WebPLosslessCodec {
    fn encode_rgba(&self, rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
        let mut config =
            webp::WebPConfig::new().map_err(|_| "failed to init WebP config".to_string())?;
        config.lossless = 1;
        // config_exact: preserve RGB under fully-transparent pixels (D-01).
        // `encode_lossless()` does NOT set `exact`, so we must use `encode_advanced`.
        config.exact = 1;
        config.alpha_compression = 0;
        config.quality = 75.0;
        // 52.1 perf: lossless `method` defaults to 4 (slow, ~200-500ms/frame at
        // 1920×1080). Drop to 1 — the fastest lossless effort that still
        // compresses — so a frame change no longer stalls the UI for seconds.
        config.method = 1;

        let encoder = webp::Encoder::from_rgba(rgba, width, height);
        let memory = encoder
            .encode_advanced(&config)
            .map_err(|e| format!("WebP encode failed: {e:?}"))?;
        Ok(memory.to_vec())
    }

    fn decode_rgba(&self, bytes: &[u8]) -> Result<(u32, u32, Vec<u8>), String> {
        let img = webp::Decoder::new(bytes)
            .decode()
            .ok_or_else(|| "WebP decode failed: invalid or unsupported image".to_string())?;

        let width = img.width();
        let height = img.height();

        let rgba = if img.is_alpha() {
            img.to_vec()
        } else {
            // Expand RGB -> RGBA (alpha = 255) so callers always get 4 bytes/pixel.
            let rgb = img.to_vec();
            let mut rgba = Vec::with_capacity(rgb.len() / 3 * 4);
            for px in rgb.chunks_exact(3) {
                rgba.extend_from_slice(&[px[0], px[1], px[2], 255]);
            }
            rgba
        };

        Ok((width, height, rgba))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_preserves_rgb_under_transparent_pixel() {
        let codec = WebPLosslessCodec;

        // 2x1 image: pixel 0 is fully transparent with non-zero RGB, pixel 1 is opaque.
        let rgba = vec![
            10, 20, 30, 0, // transparent pixel whose RGB must survive (config_exact)
            200, 100, 50, 255, // opaque pixel
        ];

        let encoded = codec.encode_rgba(&rgba, 2, 1).unwrap();
        let (width, height, decoded) = codec.decode_rgba(&encoded).unwrap();

        assert_eq!(width, 2);
        assert_eq!(height, 1);
        assert_eq!(decoded.len(), 2 * 1 * 4);

        // RGB under the fully-transparent pixel is preserved (D-01 config_exact).
        assert_eq!(decoded[0], 10);
        assert_eq!(decoded[1], 20);
        assert_eq!(decoded[2], 30);
        assert_eq!(decoded[3], 0);
    }

    #[test]
    fn encode_returns_webp_riff_header() {
        let codec = WebPLosslessCodec;
        let rgba = vec![0u8; 4]; // 1x1

        let encoded = codec.encode_rgba(&rgba, 1, 1).unwrap();

        assert!(!encoded.is_empty());
        assert_eq!(&encoded[0..4], b"RIFF");
        assert_eq!(&encoded[8..12], b"WEBP");
    }

    #[test]
    fn decode_returns_dimensions_and_rgba() {
        let codec = WebPLosslessCodec;
        let rgba = vec![0u8; 2 * 2 * 4];

        let encoded = codec.encode_rgba(&rgba, 2, 2).unwrap();
        let (width, height, decoded) = codec.decode_rgba(&encoded).unwrap();

        assert_eq!(width, 2);
        assert_eq!(height, 2);
        assert_eq!(decoded.len(), 2 * 2 * 4);
    }
}
