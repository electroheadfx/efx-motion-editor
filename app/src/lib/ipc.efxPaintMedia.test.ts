/**
 * 52.2-01 Task 2: the TS boundary contract for the package frame-media leg
 * (D-07, D-13).
 *
 * Two things are pinned here:
 *
 * 1. frame bytes cross the Tauri boundary as the raw invoke body (write) and
 *    come back decoded to a `Uint8Array` (read) — never a JSON number array;
 * 2. the two rejection classes stay distinguishable, because D-13 gives them
 *    different product behavior: a missing file is the Phase 49 slate path,
 *    while a refusal fails closed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64 } from './webpBytes';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { ipcEfxPaintReadFrameMedia, ipcEfxPaintWriteFrameMedia } from './ipc';

const FIXTURE_FRAME_BYTES = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x1e, 0x00, 0x00, 0x00, // RIFF + size
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, // WEBPVP8L (lossless)
  0x12, 0x00, 0x00, 0x00, // chunk size
  ...Array.from('efx-paint-media-fixture-1', (character) => character.charCodeAt(0)),
]);
const FIXTURE_FRAME_DIGEST = 'd4576083f9b1190198e560278f43032b400d2adf4d1dcb882d6176650e8f77e5';
const PACKAGE_DIR = '/packages/Name.mce';
const STAGING_BASENAME = '.efx-paint-package-staging-11111111-1111-4111-8111-111111111111';

function writeResponse() {
  return {
    relativePath: 'frames/L1/K1.webp',
    digest: FIXTURE_FRAME_DIGEST,
    byteLength: FIXTURE_FRAME_BYTES.length,
  };
}

function readResponse() {
  return {
    ...writeResponse(),
    bytesBase64: bytesToBase64(FIXTURE_FRAME_BYTES),
  };
}

describe('ipc package frame media (52.2-01)', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('passes the Uint8Array through as the raw invoke body and resolves the canonical path with its digest', async () => {
    invoke.mockResolvedValueOnce(writeResponse());

    const result = await ipcEfxPaintWriteFrameMedia(PACKAGE_DIR, 'L1', 'K1', FIXTURE_FRAME_BYTES);

    expect(invoke).toHaveBeenCalledTimes(1);
    const call = invoke.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
    expect(call[0]).toBe('efx_paint_write_frame_media');
    expect(call[1]).toBe(FIXTURE_FRAME_BYTES);
    expect(Array.isArray(call[1])).toBe(false);
    expect(call[2].headers).toMatchObject({ packageDir: PACKAGE_DIR, layerId: 'L1', keyId: 'K1' });
    expect(result).toEqual({
      ok: true,
      data: {
        relativePath: 'frames/L1/K1.webp',
        digest: FIXTURE_FRAME_DIGEST,
        byteLength: FIXTURE_FRAME_BYTES.length,
      },
    });
  });

  it('forwards the optional staging basename as a request header while the resolved path stays canonical', async () => {
    invoke.mockResolvedValueOnce(writeResponse());

    const result = await ipcEfxPaintWriteFrameMedia(
      PACKAGE_DIR, 'L1', 'K1', FIXTURE_FRAME_BYTES, STAGING_BASENAME,
    );

    const call = invoke.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
    expect(call[2].headers.stagingBasename).toBe(STAGING_BASENAME);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.relativePath).toBe('frames/L1/K1.webp');
    expect(result.data.relativePath).not.toContain(STAGING_BASENAME);
  });

  it('omits the staging basename header entirely for a canonical write', async () => {
    invoke.mockResolvedValueOnce(writeResponse());

    await ipcEfxPaintWriteFrameMedia(PACKAGE_DIR, 'L1', 'K1', FIXTURE_FRAME_BYTES);

    const call = invoke.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
    expect('stagingBasename' in call[2].headers).toBe(false);
  });

  it('resolves read bytes as a Uint8Array with the fixture payload, never an array of numbers', async () => {
    invoke.mockResolvedValueOnce(readResponse());

    const result = await ipcEfxPaintReadFrameMedia(PACKAGE_DIR, 'frames/L1/K1.webp');

    const call = invoke.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
    expect(call[0]).toBe('efx_paint_read_frame_media');
    expect(call[1]).toBeUndefined();
    expect(call[2].headers).toEqual({ packageDir: PACKAGE_DIR, relativePath: 'frames/L1/K1.webp' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.bytes).toBeInstanceOf(Uint8Array);
    expect(Array.isArray(result.data.bytes)).toBe(false);
    expect(Array.from(result.data.bytes)).toEqual(Array.from(FIXTURE_FRAME_BYTES));
    expect(result.data.digest).toBe(FIXTURE_FRAME_DIGEST);
  });

  it('maps a Missing rejection to the missing-media signal (the Phase 49 slate path)', async () => {
    invoke.mockRejectedValueOnce('missing');

    const result = await ipcEfxPaintReadFrameMedia(PACKAGE_DIR, 'frames/L1/K1.webp');

    expect(result).toEqual({ ok: false, error: { kind: 'missing' } });
  });

  it('maps a PathEscape rejection to the refusal signal, distinctly from missing', async () => {
    invoke.mockRejectedValueOnce('pathEscape');

    const result = await ipcEfxPaintReadFrameMedia(PACKAGE_DIR, 'frames/L1/K1.webp');

    expect(result).toEqual({ ok: false, error: { kind: 'refused', rejection: 'pathEscape' } });
    expect(result).not.toEqual({ ok: false, error: { kind: 'missing' } });
  });

  it('keeps UnsupportedPackagePath distinct from both missing and pathEscape', async () => {
    invoke.mockRejectedValueOnce('unsupportedPackagePath');

    const result = await ipcEfxPaintReadFrameMedia(PACKAGE_DIR, 'layers/L1.json');

    expect(result).toEqual({
      ok: false,
      error: { kind: 'refused', rejection: 'unsupportedPackagePath' },
    });
  });

  it('normalizes a JSON-quoted label (the macOS raw-response string quirk) and degrades unknown failures to io', async () => {
    invoke.mockRejectedValueOnce('"pathEscape"');
    const quoted = await ipcEfxPaintReadFrameMedia(PACKAGE_DIR, 'frames/L1/K1.webp');
    expect(quoted).toEqual({ ok: false, error: { kind: 'refused', rejection: 'pathEscape' } });

    invoke.mockRejectedValueOnce(new Error('boom: ENOENT reading the media file'));
    const failed = await ipcEfxPaintReadFrameMedia(PACKAGE_DIR, 'frames/L1/K1.webp');
    expect(failed).toEqual({ ok: false, error: { kind: 'io' } });
  });

  it('shares the same taxonomy on the write wrapper (UnsafeId is a refusal, not missing)', async () => {
    invoke.mockRejectedValueOnce('unsafeId');

    const result = await ipcEfxPaintWriteFrameMedia(PACKAGE_DIR, '../L1', 'K1', FIXTURE_FRAME_BYTES);

    expect(result).toEqual({ ok: false, error: { kind: 'refused', rejection: 'unsafeId' } });
  });
});
