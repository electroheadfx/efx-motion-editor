import { describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { encodeWebpFrame } from './webpFrameCodec';

const WEBP_RIFF_VP8L = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c];

describe('webpFrameCodec encode boundary', () => {
  it('normalizes the macOS JSON number-array response back to a Uint8Array', async () => {
    // On macOS Tauri serializes InvokeResponseBody::Raw(Vec<u8>) through
    // format_result → serde_json::to_string, so invoke resolves to a plain
    // number array, not a Uint8Array. isWebpBytes requires instanceof
    // Uint8Array, so the un-normalized array silently fails every validator.
    invoke.mockResolvedValueOnce(WEBP_RIFF_VP8L);

    const bytes = await encodeWebpFrame({ rgba: new Uint8Array(16), width: 4, height: 4 });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual(WEBP_RIFF_VP8L);
  });

  it('passes an already-typed Uint8Array through unchanged', async () => {
    const typed = new Uint8Array(WEBP_RIFF_VP8L);
    invoke.mockResolvedValueOnce(typed);

    const bytes = await encodeWebpFrame({ rgba: new Uint8Array(16), width: 4, height: 4 });

    expect(bytes).toBe(typed);
  });

  it('normalizes an ArrayBuffer response (non-macOS Channel path)', async () => {
    invoke.mockResolvedValueOnce(new Uint8Array(WEBP_RIFF_VP8L).buffer);

    const bytes = await encodeWebpFrame({ rgba: new Uint8Array(16), width: 4, height: 4 });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual(WEBP_RIFF_VP8L);
  });
});
