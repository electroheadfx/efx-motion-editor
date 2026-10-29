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

/// Payload-size floor below which the encode took libwebp's trivial
/// single-colour shortcut.
///
/// At `method = 0` a uniform image short-circuits to a ~34-byte VP8L stream.
/// That stream is spec-valid — libwebp's own decoder reads it back at the
/// correct dimensions — but Apple's ImageIO/WebKit decoder rejects it, so
/// every blank Roto key (a fully transparent canvas) failed to decode on the
/// parent side. Real content never lands this low: the method-1 uniform frame
/// that replaces it is ~128 bytes at Studio canvas sizes.
const TRIVIAL_SINGLE_COLOUR_PAYLOAD_FLOOR: usize = 64;

impl FrameCodec for WebPLosslessCodec {
    fn encode_rgba(&self, rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
        let mut config =
            webp::WebPConfig::new().map_err(|_| "failed to init WebP config".to_string())?;
        config.lossless = 1;
        // config_exact: preserve RGB under fully-transparent pixels (D-01).
        // `encode_lossless()` does NOT set `exact`, so we must use `encode_advanced`.
        config.exact = 1;
        config.alpha_compression = 0;
        // 261029-bks A/B (release, 1080×1920 noisy RGBA): lossless `quality`
        // and `method` trade compression EFFORT for file size — the decoded
        // pixels are identical at every setting. method 1/quality 75 took
        // 1005 ms; method 0/50 takes 90 ms (11×) at ~+43 % worst-case size.
        // Real aquarelle frames are mostly transparent, where the size delta
        // is far smaller, and the encode was ~31 % of Apply.
        config.quality = 50.0;
        config.method = 0;

        let encoder = webp::Encoder::from_rgba(rgba, width, height);
        let encode = |config: &webp::WebPConfig| {
            encoder
                .encode_advanced(config)
                .map(|memory| memory.to_vec())
                .map_err(|e| format!("WebP encode failed: {e:?}"))
        };

        let bytes = encode(&config)?;

        // Below the floor is libwebp's method-0 trivial single-colour stream,
        // which Apple's decoder rejects (see the constant's comment). Re-encode
        // at method 1, whose uniform frame Apple reads correctly; the encode is
        // negligible either way, so real content keeps the method-0 perf win.
        if bytes.len() < TRIVIAL_SINGLE_COLOUR_PAYLOAD_FLOOR {
            config.method = 1;
            return encode(&config);
        }

        Ok(bytes)
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
    fn round_trip_preserves_semi_transparent_pixel() {
        // 261001-cache3: the two tests above only use alpha 0 and 255 — the
        // exact alphas where a premultiply/un-premultiply asymmetry is the
        // IDENTITY. A codec that un-premultiplied its input would pass them
        // both and still wash every grain pixel. Alpha 71 (the keep-gate-floor
        // display byte) is the discriminating case: if encode or decode
        // premultiplies out of step, this pixel comes back brighter at the
        // same alpha — the user's "cache less dense than fresh paint".
        let codec = WebPLosslessCodec;

        let rgba = vec![
            240, 15, 200, 71,  // semi-transparent grain pixel
            240, 15, 200, 255, // opaque control (premul identity)
        ];

        let encoded = codec.encode_rgba(&rgba, 2, 1).unwrap();
        let (width, height, decoded) = codec.decode_rgba(&encoded).unwrap();

        assert_eq!(width, 2);
        assert_eq!(height, 1);
        assert_eq!(decoded.len(), 2 * 1 * 4);

        // Straight RGBA in == straight RGBA out. No premultiply step anywhere.
        assert_eq!(decoded[0], 240, "R must survive a semi-transparent round-trip");
        assert_eq!(decoded[1], 15, "G must survive a semi-transparent round-trip");
        assert_eq!(decoded[2], 200, "B must survive a semi-transparent round-trip");
        assert_eq!(decoded[3], 71, "alpha must survive a semi-transparent round-trip");
        assert_eq!(decoded[4], 240);
        assert_eq!(decoded[5], 15);
        assert_eq!(decoded[6], 200);
        assert_eq!(decoded[7], 255);
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
    fn uniform_1080x1920_frame_never_emits_the_apple_rejected_trivial_stream() {
        // Regression for the Roto key-creation window (quick 261029-bks): a
        // uniform frame encoded with method 0 collapsed to a 34-byte VP8L
        // stream that libwebp accepts but Apple's decoder rejects, so blank
        // Roto keys failed to decode on the parent side. This is the exact
        // content and size `buildBlankRotoFrame` produces.
        let codec = WebPLosslessCodec;
        let width = 1080u32;
        let height = 1920u32;
        let rgba = vec![0u8; (width * height * 4) as usize];

        let encoded = codec.encode_rgba(&rgba, width, height).unwrap();

        // (a) a well-formed RIFF/WEBP container around a simple-lossless stream.
        assert_eq!(&encoded[0..4], b"RIFF");
        assert_eq!(&encoded[8..12], b"WEBP");
        assert_eq!(&encoded[12..16], b"VP8L");
        assert_eq!(encoded[20], 0x2f, "VP8L signature byte");

        // (b) never the trivial stream again: at this size method 1 emits
        // ~128 B for a uniform frame, while the Apple-rejected one is ~34 B.
        assert!(
            encoded.len() > 64,
            "uniform {width}x{height} frame encoded to {} bytes — the method-0 \
             trivial stream is ~34 B and Apple's decoder rejects it",
            encoded.len()
        );

        // (c) the payload still round-trips at full size.
        let (decoded_width, decoded_height, decoded) = codec.decode_rgba(&encoded).unwrap();
        assert_eq!((decoded_width, decoded_height), (width, height));
        assert_eq!(decoded.len(), (width * height * 4) as usize);
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
