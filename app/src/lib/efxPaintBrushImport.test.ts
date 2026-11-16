/**
 * quick 261116-inu / spec 04 — the main-realm import handler, retargeted onto
 * the machine library seam.
 *
 * Laws pinned here:
 *   1. One well-formed request writes through the library ONLY — no project
 *      asset bookkeeping, no `projectStore.markDirty()`, no history entry.
 *   2. The row is content-addressed: importing the same bytes twice resolves
 *      to ONE catalog row with one id.
 *   3. A wrong-length mask is refused before any IPC call, with no catalog
 *      mutation and no publish.
 *   4. `publishCatalog` runs after the mutation and before the answer, and
 *      the result never carries mask or bytes.
 *
 * The library command is mocked at the `./ipc` boundary (partial mock, so the
 * rest of the wrapper module keeps its real implementation); the catalog,
 * registry and projectStore are the REAL instances.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockWrite = vi.hoisted(() => vi.fn());

vi.mock('./ipc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ipc')>();
  return { ...actual, ipcBrushLibraryWrite: mockWrite };
});

import { TIP_MASK_BYTES, TIP_MASK_EDGE, buildBrushForStroke, resetMaskRegistry, resolveMask } from '@efxlab/efx-watercolor';
import { applyBrushImportRequest } from './efxPaintBrushImport';
import {
  customBrushTips,
  libraryRowFor,
  resetAquarelleBrushCatalog,
} from '../stores/aquarelleBrushCatalog';
import { projectStore } from '../stores/projectStore';
import { historyStore } from '../stores/historyStore';
import type { BrushLibraryEntry } from './ipc';

const DIGEST_A = 'a'.repeat(64);

function makeMask(seed: number): Uint8Array {
  const mask = new Uint8Array(TIP_MASK_BYTES);
  for (let index = 0; index < mask.length; index += 1) mask[index] = (index + seed) % 256;
  return mask;
}

function libraryEntry(overrides: Partial<BrushLibraryEntry> = {}): BrushLibraryEntry {
  return {
    id: `wc/custom-${DIGEST_A.slice(0, 12)}`,
    name: 'fern.png',
    digest: DIGEST_A,
    textureRotation: 0,
    createdAt: '2026-11-16T10:00:00Z',
    tip: 1,
    aspect: 1,
    rotation: 1,
    sizeCurve: 1,
    scatter: 1,
    capacity: 1,
    grain: 1,
    wetRound: 1,
    ...overrides,
  };
}

function okWrite(entry: BrushLibraryEntry = libraryEntry()) {
  return { ok: true as const, data: entry };
}

beforeEach(() => {
  resetAquarelleBrushCatalog();
  resetMaskRegistry();
  projectStore.isDirty.value = false;
  mockWrite.mockReset();
  mockWrite.mockResolvedValue(okWrite());
});

afterEach(() => {
  resetAquarelleBrushCatalog();
  resetMaskRegistry();
});

describe('applyBrushImportRequest — the one library mutation path', () => {
  it('lists one library row whose id resolves to the exact mask that was sent', async () => {
    const mask = makeMask(7);
    const published = vi.fn();
    const result = await applyBrushImportRequest(
      { operationId: 'op-1', fileName: 'fern.png', mask },
      { publishCatalog: published },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(customBrushTips.value).toHaveLength(1);
    expect(customBrushTips.value[0]).toEqual(result.entry);
    expect(result.entry.category).toBe('custom');
    expect(result.entry.name).toBe('fern.png');
    expect(result.entry.id).toBe(`wc/custom-${DIGEST_A.slice(0, 12)}`);
    expect(resolveMask(result.entry.id)).toBe(mask);
    expect(libraryRowFor(result.entry.id)).toEqual({ digest: DIGEST_A, textureRotation: 0 });
    expect(published).toHaveBeenCalledTimes(1);
  });

  it('the library command receives the mask bytes and the file name — never a path', async () => {
    const mask = makeMask(21);
    await applyBrushImportRequest(
      { operationId: 'op-2', fileName: 'reed.jpg', mask },
      { publishCatalog: vi.fn() },
    );
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWrite.mock.calls[0]![0]).toBe('reed.jpg');
    expect(mockWrite.mock.calls[0]![1]).toBe(mask);
  });

  it('a texture selection naming entry.id resolves the 512px imported footprint', async () => {
    const mask = makeMask(11);
    const result = await applyBrushImportRequest(
      { operationId: 'op-3', fileName: 'reed.jpg', mask },
      { publishCatalog: vi.fn() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const brush = buildBrushForStroke('round', { textureId: result.entry.id });
    expect(brush.tipSize).toBe(TIP_MASK_EDGE);
    expect(brush.tipData).toBe(mask);
  });

  it('does not mark the project dirty and writes no history entry', async () => {
    const historyBefore = historyStore.stack.value.length;
    const result = await applyBrushImportRequest(
      { operationId: 'op-4', fileName: 'moss.png', mask: makeMask(3) },
      { publishCatalog: vi.fn() },
    );
    expect(result.ok).toBe(true);
    expect(projectStore.isDirty.value).toBe(false);
    expect(historyStore.stack.value.length).toBe(historyBefore);
  });

  it('two identical requests resolve to ONE row with one id', async () => {
    const first = await applyBrushImportRequest(
      { operationId: 'op-5a', fileName: 'twin.png', mask: makeMask(5) },
      { publishCatalog: vi.fn() },
    );
    const second = await applyBrushImportRequest(
      { operationId: 'op-5b', fileName: 'twin.png', mask: makeMask(5) },
      { publishCatalog: vi.fn() },
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.entry.id).toBe(second.entry.id);
    expect(customBrushTips.value).toHaveLength(1);
    expect(libraryRowFor(first.entry.id)).toEqual({ digest: DIGEST_A, textureRotation: 0 });
  });

  it('carries the library row textureRotation into the store row', async () => {
    mockWrite.mockResolvedValue(okWrite(libraryEntry({ textureRotation: 37 })));
    const result = await applyBrushImportRequest(
      { operationId: 'op-6', fileName: 'tilt.png', mask: makeMask(23) },
      { publishCatalog: vi.fn() },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(libraryRowFor(result.entry.id)).toEqual({ digest: DIGEST_A, textureRotation: 37 });
    // The tip record itself carries no library-only member.
    expect('textureRotation' in result.entry).toBe(false);
    expect('digest' in result.entry).toBe(false);
  });

  it('publishes AFTER the mutation and BEFORE the answer', async () => {
    const mask = makeMask(9);
    const snapshots: string[][] = [];
    const published = vi.fn(() => {
      snapshots.push(customBrushTips.value.map((tip) => tip.id));
    });
    const result = await applyBrushImportRequest(
      { operationId: 'op-7', fileName: 'sedge.png', mask },
      { publishCatalog: published },
    );
    expect(published).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual([result.entry.id]);
  });

  it('the result carries status and identity only — no mask and no bytes', async () => {
    const result = await applyBrushImportRequest(
      { operationId: 'op-8', fileName: 'rush.png', mask: makeMask(13) },
      { publishCatalog: vi.fn() },
    );
    expect(Object.keys(result).sort()).toEqual(['entry', 'ok']);
  });
});

// The publish is a NOTIFICATION, not part of the answer. The mutation batch is
// the commit point, so a failed push must never turn a landed import into a
// failure answer.
describe('applyBrushImportRequest — a publish failure is never the import failure', () => {
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

describe('applyBrushImportRequest — refusals are total', () => {
  it('a mask that is not 262,144 bytes is refused before any IPC or publish', async () => {
    const published = vi.fn();
    const result = await applyBrushImportRequest(
      { operationId: 'op-9', fileName: 'short.png', mask: new Uint8Array(TIP_MASK_BYTES - 1) },
      { publishCatalog: published },
    );
    expect(result).toEqual({ ok: false, reason: 'bad-mask' });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(published).not.toHaveBeenCalled();
    expect(customBrushTips.value).toHaveLength(0);
  });

  it('a mask one byte above 262,144 is refused the same way', async () => {
    const published = vi.fn();
    const result = await applyBrushImportRequest(
      { operationId: 'op-13', fileName: 'long.png', mask: new Uint8Array(TIP_MASK_BYTES + 1) },
      { publishCatalog: published },
    );
    expect(result).toEqual({ ok: false, reason: 'bad-mask' });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(published).not.toHaveBeenCalled();
    expect(customBrushTips.value).toHaveLength(0);
  });

  it('a mask that is not a Uint8Array is refused the same way', async () => {
    const result = await applyBrushImportRequest(
      { operationId: 'op-14', fileName: 'weird.png', mask: 'not-bytes' as unknown as Uint8Array },
      { publishCatalog: vi.fn() },
    );
    expect(result).toEqual({ ok: false, reason: 'bad-mask' });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('an empty file name is refused and nothing mutates', async () => {
    const published = vi.fn();
    const result = await applyBrushImportRequest(
      { operationId: 'op-15', fileName: '   ', mask: makeMask(2) },
      { publishCatalog: published },
    );
    expect(result).toEqual({ ok: false, reason: 'bad-file-name' });
    expect(customBrushTips.value).toHaveLength(0);
    expect(published).not.toHaveBeenCalled();
  });

  it('a library failure is refused with a named reason, no mutation and no publish', async () => {
    mockWrite.mockResolvedValue({ ok: false as const, error: 'digest-collision' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const published = vi.fn();
      const result = await applyBrushImportRequest(
        { operationId: 'op-16', fileName: 'broken.png', mask: makeMask(4) },
        { publishCatalog: published },
      );
      expect(result).toEqual({ ok: false, reason: 'library-failed' });
      expect(customBrushTips.value).toHaveLength(0);
      expect(published).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
