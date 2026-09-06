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
    fn encode_rgba(&self, _rgba: &[u8], _width: u32, _height: u32) -> Result<Vec<u8>, String> {
        Ok(Vec::new())
    }

    fn decode_rgba(&self, _bytes: &[u8]) -> Result<(u32, u32, Vec<u8>), String> {
        Ok((0, 0, Vec::new()))
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
