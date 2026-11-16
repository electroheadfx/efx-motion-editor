/**
 * quick 261116-inu / spec 04 — the machine brush-library boot seam.
 *
 * Laws pinned here:
 *   1. A scan plus per-entry decode installs the WHOLE library into the store
 *      and the mask registry in one replacement.
 *   2. A row whose file is unavailable (reported by the scan or by a failed
 *      decode) stays LISTED, and its id rides `unavailableTipIds`.
 *   3. The load never rejects: a failed scan degrades to an empty catalog.
 *   4. A repeated identical load bumps no revision (compare-then-write), and
 *      one replacement publishes once.
 *
 * The library commands are mocked at the `./ipc` boundary (partial mock); the
 * catalog store and the mask registry are the REAL instances.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockScan = vi.hoisted(() => vi.fn());
const mockDecode = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

vi.mock('./ipc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ipc')>();
  return {
    ...actual,
    ipcBrushLibraryScan: mockScan,
    ipcBrushLibraryDecode: mockDecode,
    ipcBrushLibraryDelete: mockDelete,
  };
});

import {
  TIP_MASK_BYTES,
  registerMask,
  resetMaskRegistry,
  resolveMask,
} from '@efxlab/efx-watercolor';
import { deleteBrushTexture, loadBrushLibrary } from './brushLibrary';
import {
  _setBrushCatalogPublisher,
  customBrushTips,
  libraryRevision,
  libraryRowToTip,
  libraryRows,
  resetAquarelleBrushCatalog,
  unavailableTipIds,
  upsertLibraryRow,
} from '../stores/aquarelleBrushCatalog';
import type { BrushLibraryEntry } from './ipc';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

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

const ENTRY_A = libraryEntry();
const ENTRY_B = libraryEntry({
  id: `wc/custom-${DIGEST_B.slice(0, 12)}`,
  name: 'reed.jpg',
  digest: DIGEST_B,
  textureRotation: 37,
});

beforeEach(() => {
  resetAquarelleBrushCatalog();
  resetMaskRegistry();
  mockScan.mockReset();
  mockDecode.mockReset();
  mockDelete.mockReset();
  mockScan.mockResolvedValue({ ok: true, data: { entries: [ENTRY_A, ENTRY_B], unavailable: [] } });
  mockDecode.mockImplementation(async (digest: string) => ({
    ok: true as const,
    data: { mask: makeMask(digest === DIGEST_A ? 7 : 11), width: 512, height: 512 },
  }));
  mockDelete.mockResolvedValue({ ok: true, data: null });
});

afterEach(() => {
  resetAquarelleBrushCatalog();
  resetMaskRegistry();
  _setBrushCatalogPublisher(() => {});
});

describe('loadBrushLibrary — the boot replacement', () => {
  it('installs every scanned row, its tip and its registered mask', async () => {
    const published = vi.fn();
    _setBrushCatalogPublisher(published);
    const revisionBefore = libraryRevision.value;

    const result = await loadBrushLibrary();

    expect(result.loaded).toBe(2);
    expect(result.unavailable).toEqual([]);
    expect(libraryRows.value.map((row) => row.tip.id)).toEqual([ENTRY_A.id, ENTRY_B.id]);
    expect(customBrushTips.value.map((tip) => tip.name)).toEqual(['fern.png', 'reed.jpg']);
    expect(libraryRows.value[1]).toEqual({
      tip: expect.objectContaining({ id: ENTRY_B.id, category: 'custom' }),
      digest: DIGEST_B,
      textureRotation: 37,
    });
    expect(resolveMask(ENTRY_A.id)).toEqual(makeMask(7));
    expect(resolveMask(ENTRY_B.id)).toEqual(makeMask(11));
    expect(unavailableTipIds.value.size).toBe(0);
    expect(libraryRevision.value).toBe(revisionBefore + 1);
    expect(published).toHaveBeenCalledTimes(1);
  });

  it('keeps a scan-reported unavailable row listed and marks its id', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: { entries: [ENTRY_A, ENTRY_B], unavailable: [ENTRY_B.id] },
    });
    const result = await loadBrushLibrary();
    expect(result.loaded).toBe(1);
    expect(result.unavailable).toEqual([ENTRY_B.id]);
    expect(libraryRows.value).toHaveLength(2);
    expect(resolveMask(ENTRY_A.id)).toEqual(makeMask(7));
    expect(resolveMask(ENTRY_B.id)).toBeNull();
    expect(unavailableTipIds.value.has(ENTRY_B.id)).toBe(true);
    expect(mockDecode).toHaveBeenCalledTimes(1);
  });

  it('turns a failed or wrong-length decode into an unavailable id, never a throw', async () => {
    mockDecode.mockImplementation(async (digest: string) => {
      if (digest === DIGEST_A) return { ok: false as const, error: 'missing' };
      return { ok: true as const, data: { mask: new Uint8Array(3), width: 512, height: 512 } };
    });
    const result = await loadBrushLibrary();
    expect(result.loaded).toBe(0);
    expect(result.unavailable).toEqual([ENTRY_A.id, ENTRY_B.id]);
    expect(libraryRows.value).toHaveLength(2);
    expect(unavailableTipIds.value.size).toBe(2);
    expect(resolveMask(ENTRY_A.id)).toBeNull();
  });

  it('resolves with an empty catalog when the scan itself fails', async () => {
    mockScan.mockResolvedValue({ ok: false, error: 'invoke rejected' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await loadBrushLibrary();
      expect(result).toEqual({ loaded: 0, unavailable: [] });
      expect(libraryRows.value).toHaveLength(0);
      expect(mockDecode).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('does not reject when a command throws synchronously through the mock', async () => {
    mockScan.mockRejectedValue(new Error('ipc exploded'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(loadBrushLibrary()).resolves.toEqual({ loaded: 0, unavailable: [] });
    } finally {
      warn.mockRestore();
    }
  });

  it('a repeated identical load bumps no revision (compare-then-write)', async () => {
    await loadBrushLibrary();
    const revisionAfterFirst = libraryRevision.value;
    const generationAfterFirst = libraryRows.value;
    await loadBrushLibrary();
    expect(libraryRevision.value).toBe(revisionAfterFirst);
    expect(libraryRows.value).toBe(generationAfterFirst);
  });
});

describe('deleteBrushTexture — one row and one file, never a project', () => {
  it('removes exactly one row, drops its mask, flags its id and publishes once', async () => {
    await loadBrushLibrary();
    const published = vi.fn();
    _setBrushCatalogPublisher(published);
    const revisionBefore = libraryRevision.value;
    expect(libraryRows.value).toHaveLength(2);

    await expect(deleteBrushTexture(DIGEST_A)).resolves.toBe(true);

    expect(mockDelete).toHaveBeenCalledWith(DIGEST_A);
    expect(libraryRows.value.map((row) => row.tip.id)).toEqual([ENTRY_B.id]);
    expect(customBrushTips.value.map((tip) => tip.id)).toEqual([ENTRY_B.id]);
    // The deleted id's registration is the only one dropped.
    expect(resolveMask(ENTRY_A.id)).toBeNull();
    expect(resolveMask(ENTRY_B.id)).toEqual(makeMask(11));
    // A project or script saved elsewhere may still name the deleted texture:
    // it stays LISTED-but-unavailable so no surface presents it as usable.
    expect(unavailableTipIds.value.has(ENTRY_A.id)).toBe(true);
    expect(unavailableTipIds.value.has(ENTRY_B.id)).toBe(false);
    expect(libraryRevision.value, 'one bump, never two').toBe(revisionBefore + 1);
    expect(published, 'one publish, never two').toHaveBeenCalledTimes(1);
  });

  it('deleting an already-absent digest is an idempotent success that touches nothing', async () => {
    await loadBrushLibrary();
    const rowsBefore = libraryRows.value;
    const revisionBefore = libraryRevision.value;
    const published = vi.fn();
    _setBrushCatalogPublisher(published);

    await expect(deleteBrushTexture('f'.repeat(64))).resolves.toBe(true);

    // The native command still runs (its delete is idempotent too)…
    expect(mockDelete).toHaveBeenCalledWith('f'.repeat(64));
    // …but a digest this realm never listed is not a library change.
    expect(libraryRows.value).toBe(rowsBefore);
    expect(libraryRevision.value).toBe(revisionBefore);
    expect(published).not.toHaveBeenCalled();
  });

  it('a failed native delete answers false and leaves the catalog untouched', async () => {
    await loadBrushLibrary();
    mockDelete.mockResolvedValue({ ok: false, error: 'locked' });
    const rowsBefore = libraryRows.value;
    const revisionBefore = libraryRevision.value;
    const published = vi.fn();
    _setBrushCatalogPublisher(published);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(deleteBrushTexture(DIGEST_A)).resolves.toBe(false);
      expect(libraryRows.value).toBe(rowsBefore);
      expect(libraryRevision.value).toBe(revisionBefore);
      expect(resolveMask(ENTRY_A.id)).toEqual(makeMask(7));
      expect(unavailableTipIds.value.has(ENTRY_A.id)).toBe(false);
      expect(published).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('a rejected delete answers false and never rejects', async () => {
    await loadBrushLibrary();
    mockDelete.mockRejectedValue(new Error('ipc exploded'));
    const rowsBefore = libraryRows.value;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(deleteBrushTexture(DIGEST_A)).resolves.toBe(false);
      expect(libraryRows.value).toBe(rowsBefore);
      expect(resolveMask(ENTRY_A.id)).toEqual(makeMask(7));
    } finally {
      warn.mockRestore();
    }
  });

  it('re-importing the deleted bytes clears the unavailable flag again', async () => {
    await loadBrushLibrary();
    await deleteBrushTexture(DIGEST_A);
    expect(unavailableTipIds.value.has(ENTRY_A.id)).toBe(true);

    // The import path registers the mask then upserts the row: a row arriving
    // WITH a resolvable mask re-enables the chip (deleting it again would
    // otherwise leave it disabled for the whole session).
    registerMask(ENTRY_A.id, makeMask(7));
    upsertLibraryRow({
      tip: libraryRowToTip(ENTRY_A),
      digest: DIGEST_A,
      textureRotation: ENTRY_A.textureRotation,
    });

    expect(unavailableTipIds.value.has(ENTRY_A.id)).toBe(false);
    expect(libraryRows.value.map((row) => row.tip.id)).toEqual([ENTRY_B.id, ENTRY_A.id]);
  });
});
