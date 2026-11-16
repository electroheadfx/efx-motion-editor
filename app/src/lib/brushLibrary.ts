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
 * LATER TASKS
 *   `deleteBrushTexture` and `setBrushTextureRotation` join this module in the
 *   tasks that introduce their Rust commands; each runs through one
 *   single-flight chain and bumps `libraryRevision` exactly once.
 */

import { TIP_MASK_BYTES, registerMask } from '@efxlab/efx-watercolor';
import { ipcBrushLibraryDecode, ipcBrushLibraryScan } from './ipc';
import {
  libraryRowToTip,
  publishBrushCatalog,
  replaceLibraryEntries,
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
