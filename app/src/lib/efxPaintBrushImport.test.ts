/**
 * 63-05 Task 1 / TIP-01 / T-63-04 / T-63-11 — the main-realm import handler.
 *
 * Laws pinned here:
 *   1. One well-formed request becomes one catalog entry, one registered
 *      mask (identity), one remembered asset and a dirty project — and no
 *      history entry (D-15).
 *   2. The id is minted per import, never from content: two identical
 *      requests yield two ids and one remembered digest (D-16).
 *   3. A wrong-length mask is refused before any IPC call, with no catalog
 *      mutation and no publish (T-63-04).
 *   4. `publishCatalog` runs after the mutation and before the answer, and
 *      the result never carries mask or bytes.
 *
 * The encode command is mocked at the `./ipc` boundary (partial mock, so the
 * rest of the wrapper module keeps its real implementation); the catalog,
 * registry, asset cache and projectStore are the REAL instances.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEncode = vi.hoisted(() => vi.fn());

vi.mock('./ipc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ipc')>();
  return { ...actual, ipcEfxPaintEncodeBrushMask: mockEncode };
});

import { TIP_MASK_BYTES, buildBrushForStroke, resetMaskRegistry, resolveMask } from '@efxlab/efx-watercolor';
import { applyBrushImportRequest, freshCustomId } from './efxPaintBrushImport';
import { brushAssetBytes, pendingBrushAssets, resetBrushAssets } from './efxPaintBrushAssets';
import { customBrushTips, resetAquarelleBrushCatalog } from '../stores/aquarelleBrushCatalog';
import { projectStore } from '../stores/projectStore';
import { historyStore } from '../stores/historyStore';

const DIGEST_A = 'a'.repeat(64);
const WEBP_BYTES = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const PACKAGE_ROOT = '/packages/Import.mce';

function makeMask(seed: number): Uint8Array {
  const mask = new Uint8Array(TIP_MASK_BYTES);
  for (let index = 0; index < mask.length; index += 1) mask[index] = (index + seed) % 256;
  return mask;
}

function okEncode(digest = DIGEST_A, webp = WEBP_BYTES) {
  return { ok: true as const, data: { webp, digest, width: 192, height: 192 } };
}

beforeEach(() => {
  resetAquarelleBrushCatalog();
  resetBrushAssets();
  resetMaskRegistry();
  projectStore.isDirty.value = false;
  mockEncode.mockReset();
  mockEncode.mockResolvedValue(okEncode());
});

afterEach(() => {
  resetAquarelleBrushCatalog();
  resetBrushAssets();
  resetMaskRegistry();
});

describe('applyBrushImportRequest — the one mutation path', () => {
  it('lists one custom entry whose id resolves to the exact mask that was sent', async () => {
    const mask = makeMask(7);
    const published = vi.fn();
    const result = await applyBrushImportRequest(
      { operationId: 'op-1', fileName: 'fern.png', mask },
      { publishCatalog: published },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(customBrushTips.value).toHaveLength(1);
    expect(customBrushTips.value[0]).toBe(result.entry);
    expect(result.entry.category).toBe('custom');
    expect(result.entry.name).toBe('fern.png');
    expect(result.entry.asset).toBe(`brushes/${DIGEST_A}.webp`);
    expect(resolveMask(result.entry.id)).toBe(mask);
  });

  it('buildBrushForStroke(entry.id) resolves the imported footprint', async () => {
    const mask = makeMask(11);
    const result = await applyBrushImportRequest(
      { operationId: 'op-2', fileName: 'reed.jpg', mask },
      { publishCatalog: vi.fn() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const brush = buildBrushForStroke(result.entry.id);
    expect(brush.tipSize).toBe(192);
    expect(brush.tipData).toBe(mask);
  });

  it('marks the project dirty and writes no history entry', async () => {
    const historyBefore = historyStore.stack.value.length;
    const result = await applyBrushImportRequest(
      { operationId: 'op-3', fileName: 'moss.png', mask: makeMask(3) },
      { publishCatalog: vi.fn() },
    );
    expect(result.ok).toBe(true);
    expect(projectStore.isDirty.value).toBe(true);
    expect(historyStore.stack.value.length).toBe(historyBefore);
  });

  it('two identical requests yield two distinct ids and one remembered digest', async () => {
    const first = await applyBrushImportRequest(
      { operationId: 'op-4a', fileName: 'twin.png', mask: makeMask(5) },
      { publishCatalog: vi.fn() },
    );
    const second = await applyBrushImportRequest(
      { operationId: 'op-4b', fileName: 'twin.png', mask: makeMask(5) },
      { publishCatalog: vi.fn() },
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.entry.id === second.entry.id).toBe(false);
    expect(customBrushTips.value).toHaveLength(2);
    const pending = pendingBrushAssets(PACKAGE_ROOT);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.relativePath).toBe(`brushes/${DIGEST_A}.webp`);
    expect(brushAssetBytes(DIGEST_A)).toEqual(WEBP_BYTES);
  });

  it('publishes AFTER the mutation and BEFORE the answer', async () => {
    const mask = makeMask(9);
    const snapshots: Array<{ ids: string[]; pending: number }> = [];
    const published = vi.fn(() => {
      snapshots.push({
        ids: customBrushTips.value.map((tip) => tip.id),
        pending: pendingBrushAssets(PACKAGE_ROOT).length,
      });
    });
    const result = await applyBrushImportRequest(
      { operationId: 'op-5', fileName: 'sedge.png', mask },
      { publishCatalog: published },
    );
    expect(published).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.ids).toEqual([result.entry.id]);
    expect(snapshots[0]!.pending).toBe(1);
  });

  it('the result carries status and identity only — no mask and no bytes', async () => {
    const result = await applyBrushImportRequest(
      { operationId: 'op-6', fileName: 'rush.png', mask: makeMask(13) },
      { publishCatalog: vi.fn() },
    );
    expect(Object.keys(result).sort()).toEqual(['entry', 'ok']);
  });
});

// 63-12 (WR-04): the publish is a NOTIFICATION, not part of the answer. The
// mutation batch is the commit point (D-15 — an import is not undoable), so a
// failed push must never turn a landed import into a failure answer.
describe('applyBrushImportRequest — a publish failure is never the import failure (WR-04)', () => {
  it('a rejecting publish port still answers success and keeps the landed mutation', async () => {
    const mask = makeMask(17);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await applyBrushImportRequest(
        { operationId: 'op-11', fileName: 'cedar.png', mask },
        { publishCatalog: async () => { throw new Error('catalog push refused'); } },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(customBrushTips.value).toHaveLength(1);
      expect(customBrushTips.value[0]).toBe(result.entry);
      expect(resolveMask(result.entry.id)).toBe(mask);
      expect(warn.mock.calls.some((call) => String(call[0]).includes('Brush catalog publish failed'))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it('a port that throws synchronously is treated the same as a rejection', async () => {
    const mask = makeMask(19);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await applyBrushImportRequest(
        { operationId: 'op-12', fileName: 'birch.png', mask },
        { publishCatalog: () => { throw new Error('sync refusal'); } },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(customBrushTips.value).toHaveLength(1);
      expect(resolveMask(result.entry.id)).toBe(mask);
      expect(warn.mock.calls.some((call) => String(call[0]).includes('Brush catalog publish failed'))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('applyBrushImportRequest — refusals are total (T-63-04)', () => {
  it('a mask that is not 36,864 bytes is refused before any IPC or publish', async () => {
    const published = vi.fn();
    const result = await applyBrushImportRequest(
      { operationId: 'op-7', fileName: 'short.png', mask: new Uint8Array(TIP_MASK_BYTES - 1) },
      { publishCatalog: published },
    );
    expect(result).toEqual({ ok: false, reason: 'bad-mask' });
    expect(mockEncode).not.toHaveBeenCalled();
    expect(published).not.toHaveBeenCalled();
    expect(customBrushTips.value).toHaveLength(0);
  });

  it('a mask one byte above 36,864 is refused the same way (TIP-01 boundary)', async () => {
    const published = vi.fn();
    const result = await applyBrushImportRequest(
      { operationId: 'op-13', fileName: 'long.png', mask: new Uint8Array(TIP_MASK_BYTES + 1) },
      { publishCatalog: published },
    );
    expect(result).toEqual({ ok: false, reason: 'bad-mask' });
    expect(mockEncode).not.toHaveBeenCalled();
    expect(published).not.toHaveBeenCalled();
    expect(customBrushTips.value).toHaveLength(0);
  });

  it('a mask that is not a Uint8Array is refused the same way', async () => {
    const result = await applyBrushImportRequest(
      { operationId: 'op-8', fileName: 'weird.png', mask: 'not-bytes' as unknown as Uint8Array },
      { publishCatalog: vi.fn() },
    );
    expect(result).toEqual({ ok: false, reason: 'bad-mask' });
    expect(mockEncode).not.toHaveBeenCalled();
  });

  it('an empty file name is refused and nothing mutates', async () => {
    const published = vi.fn();
    const result = await applyBrushImportRequest(
      { operationId: 'op-9', fileName: '   ', mask: makeMask(2) },
      { publishCatalog: published },
    );
    expect(result).toEqual({ ok: false, reason: 'bad-file-name' });
    expect(customBrushTips.value).toHaveLength(0);
    expect(published).not.toHaveBeenCalled();
  });

  it('an encode failure is refused with a named reason, no mutation and no publish', async () => {
    mockEncode.mockResolvedValue({ ok: false, error: { kind: 'refused', rejection: 'undecodable' } });
    const published = vi.fn();
    const result = await applyBrushImportRequest(
      { operationId: 'op-10', fileName: 'broken.png', mask: makeMask(4) },
      { publishCatalog: published },
    );
    expect(result).toEqual({ ok: false, reason: 'encode-failed' });
    expect(customBrushTips.value).toHaveLength(0);
    expect(published).not.toHaveBeenCalled();
  });
});

describe('freshCustomId (D-16)', () => {
  it('mints a wc/custom- id with a counter and a random suffix, distinct every call', () => {
    const first = freshCustomId();
    const second = freshCustomId();
    expect(/^wc\/custom-[0-9a-z]+-[0-9a-z]+$/.test(first)).toBe(true);
    expect(first === second).toBe(false);
  });
});
