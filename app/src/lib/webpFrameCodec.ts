/**
 * 52.1-02 (D-07): raw-byte WebP frame codec commands over the Tauri boundary.
 * Kept in a leaf module so `rotoCanvasFrames.ts` can encode frames without
 * importing `physicsPaintBridgeTransport.ts` (which imports `physicPaintBridge.ts`,
 * which imports `physicPaintStore.ts` — a module-body cycle).
 */
import { invoke } from '@tauri-apps/api/core';
import { base64ToBytes } from './webpBytes';

/**
 * Decoded WebP frame returned by the Rust `decode_webp_frame` command.
 * `rgba` is a raw byte buffer (length `width * height * 4`), not base64 (D-07).
 */
export interface DecodedWebpFrame {
  width: number;
  height: number;
  rgba: Uint8Array<ArrayBuffer>;
  /**
   * Rust-side `decode_rgba` wall time in ms (diagnostic telemetry emitted by
   * `decode_webp_frame`). Absent on older payloads and in test mocks — treat a
   * missing value as "not measured".
   */
  codecMs?: number;
}

/**
 * Normalize a raw-codec invoke result (`encode_webp_frame`,
 * `script_library_encode_thumbnail_webp`) back to a `Uint8Array`.
 *
 * The Rust command returns `InvokeResponseBody::Raw(Vec<u8>)`, but on macOS
 * Tauri serializes a raw response through `format_result` →
 * `serde_json::to_string`, so the JS promise resolves to a plain JSON number
 * array (`[82,73,70,70,...]`) rather than a `Uint8Array`. `isWebpBytes` requires
 * `instanceof Uint8Array`, so the un-normalized array silently fails every
 * downstream frame validator. Non-macOS platforms may instead deliver an
 * `ArrayBuffer` (Channel path) or a `Uint8Array`; all three are handled.
 */
export function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return new Uint8Array(value);
  throw new Error('encode_webp_frame returned an unexpected payload shape.');
}

/**
 * Encode an RGBA buffer to WebP-lossless frame bytes via the Rust
 * `encode_webp_frame` command. Raw `Uint8Array` crosses the Tauri boundary as
 * bytes — never base64 (unlike `emitTo` JSON events).
 */
export async function encodeWebpFrame(args: { rgba: Uint8Array; width: number; height: number }): Promise<Uint8Array> {
  const result = await invoke('encode_webp_frame', args.rgba, {
    headers: { width: String(args.width), height: String(args.height) },
  });
  const bytes = toUint8Array(result);
  return bytes;
}

/**
 * Decode WebP frame bytes back to `{ width, height, rgba }` via the Rust
 * `decode_webp_frame` command. The compressed bytes cross as the raw invoke
 * body (mirroring `encodeWebpFrame`), and the RGBA returns base64 —
 * deliberately NOT a raw response body: on macOS a raw response degrades to a
 * JSON number array (see `toUint8Array`), and a 1920×1080 frame would cost
 * ~33 MB of JSON marshalling on the main thread (~3.4 s measured in the
 * 2026-09-11 stall session). Base64 keeps the leg a flat string.
 */
export async function decodeWebpFrame(args: { bytes: Uint8Array }): Promise<DecodedWebpFrame> {
  const result = await invoke('decode_webp_frame', args.bytes) as {
    width: number;
    height: number;
    rgbaBase64: string;
    codecMs?: number;
  };
  return {
    width: result.width,
    height: result.height,
    rgba: base64ToBytes(result.rgbaBase64),
    codecMs: result.codecMs,
  };
}

/**
 * Encode a canvas to WebP-lossless frame bytes via the Rust `encode_webp_frame`
 * command. Reads the one remaining synchronous `getImageData` readback, then
 * hands the raw RGBA to the Rust codec — never `toDataURL('image/webp')`, which
 * WebKit silently falls back to PNG (and Chrome emits lossy VP8, not VP8L).
 */
export async function encodeCanvasAsWebp(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not read canvas pixels for WebP encode.');
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return encodeWebpFrame({
    rgba: new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength),
    width: canvas.width,
    height: canvas.height,
  });
}
