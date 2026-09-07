/**
 * 52.1-02 (D-07): raw-byte WebP frame codec commands over the Tauri boundary.
 * Kept in a leaf module so `rotoCanvasFrames.ts` can encode frames without
 * importing `physicsPaintBridgeTransport.ts` (which imports `physicPaintBridge.ts`,
 * which imports `physicPaintStore.ts` — a module-body cycle).
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * Decoded WebP frame returned by the Rust `decode_webp_frame` command.
 * `rgba` is a raw byte buffer (length `width * height * 4`), not base64 (D-07).
 */
export interface DecodedWebpFrame {
  width: number;
  height: number;
  rgba: Uint8Array;
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
  return toUint8Array(result);
}

/**
 * Decode WebP frame bytes back to `{ width, height, rgba }` via the Rust
 * `decode_webp_frame` command. Raw `Uint8Array` in, raw `Uint8Array` out.
 */
export function decodeWebpFrame(args: { bytes: Uint8Array }): Promise<DecodedWebpFrame> {
  return invoke('decode_webp_frame', { bytes: args.bytes }) as Promise<DecodedWebpFrame>;
}

/**
 * Encode a canvas to WebP-lossless frame bytes via the Rust `encode_webp_frame`
 * command. Reads the one remaining synchronous `getImageData` readback, then
 * hands the raw RGBA to the Rust codec — never `toDataURL('image/webp')`, which
 * WebKit silently falls back to PNG (and Chrome emits lossy VP8, not VP8L).
 */
export async function encodeCanvasAsWebp(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not read canvas pixels for WebP encode.');
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return encodeWebpFrame({
    rgba: new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength),
    width: canvas.width,
    height: canvas.height,
  });
}
