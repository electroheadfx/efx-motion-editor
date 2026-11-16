/**
 * brushLibrary — the renderer's ONE orchestration seam over the machine
 * brush-texture library (quick 261116-inu / spec 04).
 *
 * WHY THIS EXISTS
 *   The library lives on disk under `~/.config/efx-motion/brushes/` and is
 *   owned by Rust. The renderer never names a path: it asks for a scan, then
 *   asks for each stored mask by DIGEST. This module is the only place those
 *   calls are sequenced, and the only place a library mutation's store
 *   replacement is orchestrated.
 *
 * BOOT LAW
 *   `loadBrushLibrary()` runs once at app start, BEFORE the first render, so
 *   every recordable/replayable stroke resolves its mask from the very first
 *   paint. It never rejects: a failed scan or a per-entry decode failure
 *   degrades to an empty (or partially unavailable) catalog and logs.
 *
 * MUTATIONS
 *   `deleteBrushTexture` (and Task 10's `setBrushTextureRotation`) replace the
 *   catalog through `replaceLibraryEntries` (compare-then-write, so a no-op
 *   touches nothing), bump `libraryRevision` exactly once and publish once.
 *   The Rust commands serialise on one native mutex; the renderer serialises
 *   nothing itself because every mutation is a single await → single replace.
 */

import {
  TIP_MASK_BYTES,
  registerMask,
  replaceMaskRegistry,
  resolveMask,
} from '@efxlab/efx-watercolor';
import { ipcBrushLibraryDecode, ipcBrushLibraryDelete, ipcBrushLibraryScan } from './ipc';
import {
  libraryRowToTip,
  libraryRows,
  publishBrushCatalog,
  replaceLibraryEntries,
  unavailableTipIds,
  type AquarelleLibraryRow,
} from '../stores/aquarelleBrushCatalog';

/** What one boot scan achieved; never a refusal — degrade, always resolve. */
export interface BrushLibraryLoadResult {
  /** Rows whose mask registered and which can paint right now. */
  readonly loaded: number;
  /** Ids listed but unusable on this machine (file missing or undecodable). */
  readonly unavailable: readonly string[];
}

/**
 * Scan the machine library, decode every usable mask, and install the whole
 * catalog into this realm's store and registry. REPLACE-ONLY: a second call
 * mirrors the disk, it never appends. Publishes once after the replacement.
 */
export async function loadBrushLibrary(): Promise<BrushLibraryLoadResult> {
  try {
    const scanned = await ipcBrushLibraryScan();
    if (!scanned.ok) {
      console.warn('[brushLibrary] library scan failed — the catalog stays empty for this session', scanned.error);
      return { loaded: 0, unavailable: [] };
    }
    const rows: AquarelleLibraryRow[] = [];
    const unavailable = new Set<string>(scanned.data.unavailable);
    let loaded = 0;
    for (const entry of scanned.data.entries) {
      rows.push({
        tip: libraryRowToTip(entry),
        digest: entry.digest,
        textureRotation: entry.textureRotation,
      });
      if (unavailable.has(entry.id)) continue;
      const decoded = await ipcBrushLibraryDecode(entry.digest);
      if (!decoded.ok || decoded.data.mask.length !== TIP_MASK_BYTES) {
        unavailable.add(entry.id);
        continue;
      }
      registerMask(entry.id, decoded.data.mask);
      loaded += 1;
    }
    replaceLibraryEntries(rows, [...unavailable]);
    publishBrushCatalog();
    return { loaded, unavailable: [...unavailable] };
  } catch (error) {
    // The boot path may never reject: rendering must not wait on the library.
    console.warn('[brushLibrary] library load failed — continuing with an empty catalog', error);
    return { loaded: 0, unavailable: [] };
  }
}

/**
 * Delete ONE texture from the machine library (quick 261116-inu / Task 6).
 *
 * Order: native delete → one compare-then-write catalog replacement (rows,
 * unavailable set, ONE `libraryRevision` bump) → the deleted id's mask leaves
 * the engine registry → ONE publish. An already-absent digest returns true
 * WITHOUT touching the store or the revision (idempotent).
 *
 * The just-deleted id stays flagged unavailable: a project or script saved
 * elsewhere may still reference it, so the surfaces must not present it as
 * usable. Re-importing the same bytes clears the flag again
 * (`upsertLibraryRow` drops it once a row resolves a mask).
 *
 * Never rejects: a transport or native failure logs and answers false.
 */
export async function deleteBrushTexture(digest: string): Promise<boolean> {
  try {
    const deleted = await ipcBrushLibraryDelete(digest);
    if (!deleted.ok) {
      console.warn('[brushLibrary] library delete failed — the catalog is unchanged', deleted.error);
      return false;
    }
    const rows = libraryRows.peek();
    const row = rows.find((entry) => entry.digest === digest);
    // Idempotent: a repeated delete is not a library change.
    if (!row) return true;

    const nextRows = rows.filter((entry) => entry.digest !== digest);
    const nextUnavailable = [...unavailableTipIds.peek()];
    if (!nextUnavailable.includes(row.tip.id)) nextUnavailable.push(row.tip.id);

    replaceLibraryEntries(nextRows, nextUnavailable);

    // Every surviving mask is kept by identity; the deleted id's registration
    // is the only one dropped.
    const remainingMasks: { id: string; mask: Uint8Array }[] = [];
    for (const entry of nextRows) {
      const mask = resolveMask(entry.tip.id);
      if (mask !== null) remainingMasks.push({ id: entry.tip.id, mask });
    }
    replaceMaskRegistry(remainingMasks);

    publishBrushCatalog();
    return true;
  } catch (error) {
    console.warn('[brushLibrary] library delete failed — the catalog is unchanged', error);
    return false;
  }
}
