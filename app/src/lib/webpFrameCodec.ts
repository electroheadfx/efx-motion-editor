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
 * Encode an RGBA buffer to WebP-lossless frame bytes via the Rust
 * `encode_webp_frame` command. Raw `Uint8Array` crosses the Tauri boundary as
 * bytes — never base64 (unlike `emitTo` JSON events).
 */
export function encodeWebpFrame(args: { rgba: Uint8Array; width: number; height: number }): Promise<Uint8Array> {
  return invoke('encode_webp_frame', { rgba: args.rgba, width: args.width, height: args.height }) as Promise<Uint8Array>;
}

/**
 * Decode WebP frame bytes back to `{ width, height, rgba }` via the Rust
 * `decode_webp_frame` command. Raw `Uint8Array` in, raw `Uint8Array` out.
 */
export function decodeWebpFrame(args: { bytes: Uint8Array }): Promise<DecodedWebpFrame> {
  return invoke('decode_webp_frame', { bytes: args.bytes }) as Promise<DecodedWebpFrame>;
}
