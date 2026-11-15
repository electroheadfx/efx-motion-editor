/**
 * efxPaintBrushImport — the MAIN-realm brush-tip import handler (63-05 Task 1 /
 * D-15 / D-16 / T-63-04 / T-63-11).
 *
 * WHY THIS LIVES IN THE MAIN REALM
 *   The import surface lives in the Studio webview (D-01) while `projectStore`,
 *   the catalog, the mask registry and the stored asset bytes all live in the
 *   main window. The Studio therefore asks; this module is the ONE place the
 *   project mutation happens. The child never holds project authority.
 *
 * WHAT ONE REQUEST DOES (in this order)
 *   1. Validate the incoming mask: exactly `TIP_MASK_BYTES` (36,864) or the
 *      request is refused before any IPC call (T-63-04).
 *   2. Encode the mask through the native command, which answers with the
 *      lossless WebP bytes and their SHA-256 digest (63-02).
 *   3. In one `batch`: register the mask under its new id, append the catalog
 *      entry, remember the stored bytes, mark the project dirty. NO history
 *      entry is written — an import is not undoable (D-15).
 *   4. Publish the catalog through the injected `publishCatalog` port BEFORE
 *      answering, so the Studio receiver sees the new entry, its mask and its
 *      bytes ahead of the result event. The port is injected because the real
 *      publisher (`publishPhysicPaintBrushCatalog`) is created in task 3 and
 *      importing the bridge module here would invert the dependency edge.
 *
 * IDENTITY LAW (D-16)
 *   The id is minted by `freshCustomId()` — a monotonic counter plus a random
 *   suffix, never derived from the content. Two imports of identical bytes
 *   therefore yield two catalog rows while the content-addressed asset dedupes
 *   to one file. A re-remember of the same digest with different bytes is
 *   refused upstream in `efxPaintBrushAssets` (content addressing).
 *
 * RESULT SHAPE
 *   `{ok: true, entry}` — status and identity only. No mask and no bytes ever
 *   travel in the result: the catalog push is the one application path in the
 *   child, so a Studio whose receiver failed is visibly broken instead of
 *   silently half-populated.
 */

import { batch } from '@preact/signals';
import {
  NEUTRAL_TOOL_OVERRIDES,
  TIP_MASK_BYTES,
  registerMask,
  type AquarelleTip,
} from '@efxlab/efx-watercolor';
import { ipcEfxPaintEncodeBrushMask } from './ipc';
import { buildBrushAssetRelativePath } from './efxPaintPackage';
import { rememberBrushAsset } from './efxPaintBrushAssets';
import { addCustomBrushTip } from '../stores/aquarelleBrushCatalog';
import { projectStore } from '../stores/projectStore';

/** One import request, already decoded off the wire by the bridge listener. */
export interface EfxPaintBrushImportRequest {
  /** Correlation id minted by the Studio; answers echo it back (T-63-04). */
  readonly operationId: string;
  /** The picked file's name — becomes the catalog label. */
  readonly fileName: string;
  /** The derived 36,864-byte mask. Validated here, never trusted. */
  readonly mask: Uint8Array;
}

/** The ports one handler run needs. Task 3 supplies the real publisher. */
export interface EfxPaintBrushImportPorts {
  /**
   * Publish the whole catalog snapshot; called AFTER the mutation, BEFORE the
   * answer. Awaited when it returns a promise so the real publisher's
   * `emitTo` completes ahead of the result event (the transport ordering the
   * Studio depends on).
   *
   * An implementation MAY reject — or throw synchronously (63-12 / WR-04).
   * The publish is a notification, not part of the answer: this handler owns
   * the result, logs the failure and still reports the landed import.
   */
  readonly publishCatalog: () => void | Promise<void>;
}

/** Why one import was refused. `encode-failed` covers any native encode error. */
export type EfxPaintBrushImportRefusalReason = 'bad-mask' | 'bad-file-name' | 'encode-failed';

/** Total result — status and identity only; never mask bytes (T-63-04). */
export type EfxPaintBrushImportResult =
  | { readonly ok: true; readonly entry: AquarelleTip }
  | { readonly ok: false; readonly reason: EfxPaintBrushImportRefusalReason };

/** Monotonic per-session counter — the ordering half of the id (D-16). */
let importIdCounter = 0;

/** The freshness half of the id: random, never digest-derived (D-16). */
function randomIdSuffix(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi !== undefined && typeof cryptoApi.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    cryptoApi.getRandomValues(buffer);
    return buffer[0]!.toString(36);
  }
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Mint one catalog id: monotonic counter + random suffix, so two imports of
 * identical bytes never collide (D-16). Called exactly once per import, here —
 * the engine package derives masks only and never mints ids.
 */
export function freshCustomId(): string {
  importIdCounter += 1;
  return `wc/custom-${importIdCounter.toString(36)}-${randomIdSuffix()}`;
}

/**
 * Apply one Studio import request in the realm that owns the project.
 *
 * Total for every rejection the request can carry: a wrong-length mask, an
 * empty file name, an encode failure. Never writes a history entry (D-15).
 */
export async function applyBrushImportRequest(
  request: EfxPaintBrushImportRequest,
  ports: EfxPaintBrushImportPorts,
): Promise<EfxPaintBrushImportResult> {
  const mask = request.mask;
  if (!(mask instanceof Uint8Array) || mask.length !== TIP_MASK_BYTES) {
    return { ok: false, reason: 'bad-mask' };
  }
  const fileName = typeof request.fileName === 'string' ? request.fileName.trim() : '';
  if (fileName.length === 0) {
    return { ok: false, reason: 'bad-file-name' };
  }

  const encoded = await ipcEfxPaintEncodeBrushMask(mask);
  if (!encoded.ok) {
    return { ok: false, reason: 'encode-failed' };
  }
  const { digest, webp } = encoded.data;

  const entry: AquarelleTip = Object.freeze({
    id: freshCustomId(),
    category: 'custom' as const,
    name: fileName,
    ...NEUTRAL_TOOL_OVERRIDES,
    asset: buildBrushAssetRelativePath(digest),
  });

  // One batch: the mask must resolve before any reader observes the new entry.
  batch(() => {
    registerMask(entry.id, mask);
    addCustomBrushTip(entry);
    rememberBrushAsset(digest, webp);
    projectStore.markDirty();
  });

  // Publish BEFORE answering: the push is how the Studio gets the entry, so
  // it must reach the child ahead of the result event. 63-12 (WR-04): a
  // failed push is LOGGED, never fatal — the batch above is the commit point
  // (D-15 — an import is not undoable), and the Studio pulls a fresh snapshot
  // on its next mount, so a notification failure must not misreport a landed
  // import as a failed one.
  try {
    await ports.publishCatalog();
  } catch (error) {
    console.warn('[efxPaintBrushImport] Brush catalog publish failed', error);
  }

  return { ok: true, entry };
}
