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

/// The IMPORTED brush-mask edge (`TIP_MASK_EDGE` in `packages/efx-watercolor`).
/// A mask is exactly `BRUSH_MASK_EDGE²` alpha bytes — no width/height header
/// rides the renderer → native leg, so this constant IS the shape contract.
/// Deliberately NOT the procedural tip edge (192): imported masks are a
/// machine-level library, procedural tips are built at 192 and never move.
pub const BRUSH_MASK_EDGE: u32 = 512;
/// Exactly the number of alpha bytes a brush mask carries (262,144).
pub const BRUSH_MASK_BYTES: usize = (BRUSH_MASK_EDGE * BRUSH_MASK_EDGE) as usize;

/// Named refusal: the stored WebP's DECLARED dimensions are not 512×512.
pub const BRUSH_MASK_WRONG_SIZE: &str = "wrong-size";
/// Named refusal: the payload is not a decodable WebP.
pub const BRUSH_MASK_UNREADABLE: &str = "unreadable";

/// Encode one 512×512 alpha mask as a lossless WebP (D-10/D-11).
///
/// The mask bytes are the ALPHA channel; RGB is a constant 255 so the encoded
/// stream is a plain white stamp and `decode_mask_webp` can read the alpha
/// back untouched. This profile is deliberately separate from
/// `WebPLosslessCodec::encode_rgba`'s hot-path numbers: a mask is encoded
/// exactly ONCE at import and never on the save path (save copies the stored
/// bytes), so it takes the highest-effort settings instead of the frame path's
/// latency-tuned ones, and it does NOT take the trivial-payload retry (masks
/// are decoded by libwebp in Rust, never by Apple's ImageIO decoder).
pub fn encode_mask_webp(mask: &[u8]) -> Result<Vec<u8>, String> {
    if mask.len() != BRUSH_MASK_BYTES {
        return Err(format!(
            "brush mask must be exactly {BRUSH_MASK_BYTES} bytes (512x512); got {}",
            mask.len()
        ));
    }

    let mut rgba = Vec::with_capacity(BRUSH_MASK_BYTES * 4);
    for alpha in mask {
        rgba.extend_from_slice(&[255, 255, 255, *alpha]);
    }

    let mut config =
        webp::WebPConfig::new().map_err(|_| "failed to init WebP config".to_string())?;
    config.lossless = 1;
    // `exact`: keep the RGB bytes verbatim even where alpha is 0, so the
    // stored stream is the mask and nothing else.
    config.exact = 1;
    config.alpha_compression = 0;
    config.quality = 100.0;
    config.method = 6;

    webp::Encoder::from_rgba(&rgba, BRUSH_MASK_EDGE, BRUSH_MASK_EDGE)
        .encode_advanced(&config)
        .map(|memory| memory.to_vec())
        .map_err(|e| format!("WebP encode failed: {e:?}"))
}

/// The declared canvas dimensions of a WebP container, read from the container
/// HEADER alone (T-63-03). A bounded RIFF chunk walk: it never scans past
/// [`WEBP_DIMENSION_SCAN_BYTES`], so a hostile payload cannot make the guard
/// itself expensive. Returns `None` for anything it cannot parse.
///
/// Every mask decode path calls this BEFORE `decode_rgba`, so a payload
/// declaring e.g. 20000×20000 allocates no decoded buffer at all.
pub fn parse_webp_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    const WEBP_DIMENSION_SCAN_BYTES: usize = 512;
    if bytes.len() < 20 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WEBP" {
        return None;
    }

    let scan_end = bytes.len().min(WEBP_DIMENSION_SCAN_BYTES);
    let mut offset = 12usize;
    while offset.checked_add(8)? <= scan_end {
        let chunk = &bytes[offset..offset + 4];
        let chunk_size = u32::from_le_bytes([
            bytes[offset + 4],
            bytes[offset + 5],
            bytes[offset + 6],
            bytes[offset + 7],
        ]) as usize;
        let data_start = offset + 8;
        let data_end = data_start.checked_add(chunk_size)?;
        if data_end > bytes.len() {
            return None;
        }
        let read_u24 = |at: usize| -> Option<u32> {
            let window = bytes.get(at..at + 3)?;
            Some(window[0] as u32 | (window[1] as u32) << 8 | (window[2] as u32) << 16)
        };
        match chunk {
            // Extended format: the canvas size is declared 24-bit minus one.
            b"VP8X" => {
                if chunk_size < 10 {
                    return None;
                }
                let width = read_u24(data_start + 4)? + 1;
                let height = read_u24(data_start + 7)? + 1;
                return Some((width, height));
            }
            // Lossy frame: 3-byte frame tag, then the 9d 01 2a start code.
            b"VP8 " => {
                if chunk_size < 10
                    || bytes.get(data_start + 3..data_start + 6) != Some(&[0x9d, 0x01, 0x2a][..])
                {
                    return None;
                }
                let width = u16::from_le_bytes([bytes[data_start + 6], bytes[data_start + 7]])
                    as u32
                    & 0x3fff;
                let height = u16::from_le_bytes([bytes[data_start + 8], bytes[data_start + 9]])
                    as u32
                    & 0x3fff;
                return Some((width, height));
            }
            // Lossless frame: 0x2f signature, then 14-bit width and height.
            b"VP8L" => {
                if chunk_size < 5 || bytes[data_start] != 0x2f {
                    return None;
                }
                let byte = |index: usize| bytes[data_start + index] as u32;
                let width = 1 + byte(1) + ((byte(2) & 0x3f) << 8);
                let height = 1 + ((byte(2) >> 6) | (byte(3) << 2) | ((byte(4) & 0x0f) << 10));
                return Some((width, height));
            }
            _ => {}
        }
        let padded_end = data_end + (chunk_size & 1);
        if padded_end > bytes.len() || padded_end <= offset {
            return None;
        }
        offset = padded_end;
    }
    None
}

/// Decode a stored brush-mask WebP back into its 262,144 alpha bytes.
///
/// The declared-dimension gate runs FIRST (before `decode_rgba`), so an
/// oversize payload never allocates a decoded buffer; the post-decode size
/// assertion stays as the second line. Both refusals are fixed labels so the
/// batch read can map them to per-entry reasons without parsing prose.
pub fn decode_mask_webp(bytes: &[u8]) -> Result<Vec<u8>, String> {
    match parse_webp_dimensions(bytes) {
        Some((width, height))
            if width == BRUSH_MASK_EDGE && height == BRUSH_MASK_EDGE => {}
        Some(_) => return Err(BRUSH_MASK_WRONG_SIZE.to_string()),
        None => return Err(BRUSH_MASK_UNREADABLE.to_string()),
    }

    let (width, height, rgba) =
        WebPLosslessCodec.decode_rgba(bytes).map_err(|_| BRUSH_MASK_UNREADABLE.to_string())?;
    if width != BRUSH_MASK_EDGE || height != BRUSH_MASK_EDGE || rgba.len() != BRUSH_MASK_BYTES * 4 {
        return Err(BRUSH_MASK_WRONG_SIZE.to_string());
    }

    let mut mask = Vec::with_capacity(BRUSH_MASK_BYTES);
    for pixel in rgba.chunks_exact(4) {
        mask.push(pixel[3]);
    }
    Ok(mask)
}

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

    // --- Phase 63: the brush-mask codec profile (D-10/D-11, T-63-03) -------

    /// Deterministic pseudo-random mask (xorshift32) so the round trip is
    /// reproducible with no `rand` dependency — a uniform buffer would not
    /// exercise the lossless stream.
    fn probe_mask() -> Vec<u8> {
        let mut state = 0x2545_f491_u32;
        let mut mask = Vec::with_capacity(BRUSH_MASK_BYTES);
        for _ in 0..BRUSH_MASK_BYTES {
            state ^= state << 13;
            state ^= state >> 17;
            state ^= state << 5;
            mask.push((state >> 24) as u8);
        }
        mask
    }

    /// A RIFF/WEBP container whose VP8X chunk declares `width`×`height` and
    /// whose VP8L payload is garbage no decoder accepts.
    fn vp8x_header(width: u32, height: u32) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes.extend_from_slice(b"WEBP");
        bytes.extend_from_slice(b"VP8X");
        bytes.extend_from_slice(&10u32.to_le_bytes());
        bytes.push(0);
        bytes.extend_from_slice(&[0, 0, 0]);
        for value in [width - 1, height - 1] {
            bytes.extend_from_slice(&[
                (value & 0xff) as u8,
                ((value >> 8) & 0xff) as u8,
                ((value >> 16) & 0xff) as u8,
            ]);
        }
        bytes.extend_from_slice(b"VP8L");
        bytes.extend_from_slice(&4u32.to_le_bytes());
        bytes.extend_from_slice(&[0xde, 0xad, 0xbe, 0xef]);
        bytes
    }

    #[test]
    fn brush_mask_round_trip_is_byte_identical() {
        let mask = probe_mask();

        let encoded = encode_mask_webp(&mask).expect("mask encode");
        assert_eq!(
            parse_webp_dimensions(&encoded),
            Some((BRUSH_MASK_EDGE, BRUSH_MASK_EDGE))
        );

        let decoded = decode_mask_webp(&encoded).expect("mask decode");
        assert_eq!(decoded.len(), BRUSH_MASK_BYTES);
        assert_eq!(decoded, mask);
    }

    #[test]
    fn brush_mask_uniform_mask_round_trips_without_the_trivial_payload_retry() {
        // The frame path re-encodes below a 64-byte floor because Apple's
        // ImageIO rejects the trivial stream. Masks are decoded by libwebp
        // (Rust) only, so the retry is deliberately absent — a uniform stamp
        // must still round-trip.
        let mask = vec![255u8; BRUSH_MASK_BYTES];

        let encoded = encode_mask_webp(&mask).expect("mask encode");
        let decoded = decode_mask_webp(&encoded).expect("mask decode");

        assert_eq!(decoded, mask);
    }

    #[test]
    fn brush_mask_encode_refuses_a_body_that_is_not_512_squared_bytes() {
        assert!(encode_mask_webp(&[]).is_err());
        assert!(encode_mask_webp(&vec![0u8; BRUSH_MASK_BYTES - 1]).is_err());
        assert!(encode_mask_webp(&vec![0u8; BRUSH_MASK_BYTES + 1]).is_err());
    }

    #[test]
    fn brush_mask_decode_refuses_declared_dimensions_other_than_512_before_decoding() {
        // The VP8X canvas declares 20000×20000 while the payload is garbage
        // that libwebp rejects as `unreadable`. A `wrong-size` answer proves
        // the header gate ran BEFORE decode_rgba — no decoded buffer was
        // allocated for the hostile drawing.
        let hostile = vp8x_header(20_000, 20_000);
        assert_eq!(
            decode_mask_webp(&hostile),
            Err(BRUSH_MASK_WRONG_SIZE.to_string())
        );

        // A real 96×96 WebP (a frame-shaped asset) is refused the same way.
        let small = WebPLosslessCodec
            .encode_rgba(&vec![0u8; 96 * 96 * 4], 96, 96)
            .expect("frame encode");
        assert_eq!(parse_webp_dimensions(&small), Some((96, 96)));
        assert_eq!(
            decode_mask_webp(&small),
            Err(BRUSH_MASK_WRONG_SIZE.to_string())
        );

        // Garbage is a DISTINCT reason, never a mask.
        assert_eq!(
            decode_mask_webp(b"not a webp at all"),
            Err(BRUSH_MASK_UNREADABLE.to_string())
        );
    }

    #[test]
    fn brush_mask_dimension_parser_reads_every_declared_size_kind() {
        // VP8 : 3-byte frame tag, 9d 01 2a start code, 14-bit packed size.
        let mut vp8 = Vec::new();
        vp8.extend_from_slice(b"RIFF");
        vp8.extend_from_slice(&0u32.to_le_bytes());
        vp8.extend_from_slice(b"WEBP");
        vp8.extend_from_slice(b"VP8 ");
        vp8.extend_from_slice(&10u32.to_le_bytes());
        vp8.extend_from_slice(&[0, 0, 0]);
        vp8.extend_from_slice(&[0x9d, 0x01, 0x2a]);
        vp8.extend_from_slice(&320u16.to_le_bytes());
        vp8.extend_from_slice(&240u16.to_le_bytes());
        assert_eq!(parse_webp_dimensions(&vp8), Some((320, 240)));

        // VP8X: 24-bit canvas size minus one, on each axis.
        assert_eq!(
            parse_webp_dimensions(&vp8x_header(20_000, 12_345)),
            Some((20_000, 12_345))
        );

        // VP8L: what this codec actually emits.
        let mask = probe_mask();
        let encoded = encode_mask_webp(&mask).expect("mask encode");
        assert_eq!(
            parse_webp_dimensions(&encoded),
            Some((BRUSH_MASK_EDGE, BRUSH_MASK_EDGE))
        );

        // Anything the bounded walk cannot parse is `None`, never a guess.
        assert_eq!(parse_webp_dimensions(&[]), None);
        assert_eq!(parse_webp_dimensions(b"RIFF____WEBP"), None);
        assert_eq!(parse_webp_dimensions(&encoded[..20]), None);
    }
}
