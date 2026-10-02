import { describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { classifyEncodeResultShape, encodeWebpFrame } from './webpFrameCodec';

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

// 261002 B1 split-measure. `resultShape` is the transport-path proof: `array`
// means postMessage Path B (JSON number array), `arraybuffer` means the
// custom-protocol fetch Path A. The split stages name which leg owns the wall
// clock, so a wrong shape or a zeroed split would misname the block.
describe('encodeWebpFrame split-measure profile', () => {
  it('classifies each invoke result shape', () => {
    expect(classifyEncodeResultShape(new Uint8Array(4))).toBe('uint8array');
    expect(classifyEncodeResultShape(new Uint8Array(4).buffer)).toBe('arraybuffer');
    expect(classifyEncodeResultShape(WEBP_RIFF_VP8L)).toBe('array');
    expect(classifyEncodeResultShape({ nope: true })).toBe('other');
  });

  it('reports the result shape and both split legs when onProfile is passed', async () => {
    invoke.mockResolvedValueOnce(WEBP_RIFF_VP8L);
    const profiles: Array<{ invokeMs: number; toUint8Ms: number; invokeEndedAtMs: number; toUint8EndedAtMs: number; resultShape: string }> = [];

    await encodeWebpFrame({ rgba: new Uint8Array(16), width: 4, height: 4 }, (profile) => profiles.push(profile));

    expect(profiles).toHaveLength(1);
    expect(profiles[0].resultShape).toBe('array');
    expect(profiles[0].invokeMs).toBeGreaterThanOrEqual(0);
    expect(profiles[0].toUint8Ms).toBeGreaterThanOrEqual(0);
    expect(profiles[0].invokeEndedAtMs).toBeGreaterThanOrEqual(0);
    expect(profiles[0].toUint8EndedAtMs).toBeGreaterThanOrEqual(profiles[0].invokeEndedAtMs);
  });

  it('reads an ArrayBuffer result as the custom-protocol Path A shape', async () => {
    invoke.mockResolvedValueOnce(new Uint8Array(WEBP_RIFF_VP8L).buffer);
    const profiles: Array<{ resultShape: string }> = [];

    await encodeWebpFrame({ rgba: new Uint8Array(16), width: 4, height: 4 }, (profile) => profiles.push(profile));

    expect(profiles[0].resultShape).toBe('arraybuffer');
  });
});
