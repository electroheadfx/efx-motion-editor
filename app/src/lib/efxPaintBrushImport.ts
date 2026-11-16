/**
 * efxPaintBrushImport — the MAIN-realm brush-tip import handler (quick
 * 261116-inu / spec 04).
 *
 * WHY THIS LIVES IN THE MAIN REALM
 *   The import surface lives in the Studio webview while the machine library,
 *   its catalog store and its publisher live in the main window. The Studio
 *   therefore asks; this module is the ONE place the library mutation happens.
 *
 * WHAT ONE REQUEST DOES (in this order)
 *   1. Validate the incoming mask: exactly `TIP_MASK_BYTES` (262,144) or the
 *      request is refused before any IPC call.
 *   2. Hand the MASK BYTES to the machine library (`brush_library_write`). Rust
 *      encodes the 512×512 lossless WebP, derives the SHA-256, writes
 *      `<digest>.webp` under `~/.config/efx-motion/brushes/` and upserts the
 *      catalog row. The renderer never sees or builds a path.
 *   3. In one `batch`: register the mask under the row's id and upsert the row
 *      (tip + digest + textureRotation). NO history entry and no project dirty
 *      mark — an import is not project data any more.
 *   4. Publish the catalog through the injected `publishCatalog` port BEFORE
 *      answering, so the Studio receiver sees the new row ahead of the result.
 *
 * IDENTITY LAW (content-addressed, supersedes D-16)
 *   The id is `wc/custom-<first 12 hex of the digest>`: the same bytes resolve
 *   to the same row on every machine. Re-importing identical bytes therefore
 *   selects the existing row instead of minting a second one.
 *
 * RESULT SHAPE
 *   `{ok: true, entry}` — the tip half of the row. No mask and no bytes ever
 *   travel in the result: the catalog push is the one application path.
 */

import { batch } from '@preact/signals';
import { TIP_MASK_BYTES, registerMask, type AquarelleTip } from '@efxlab/efx-watercolor';
import { ipcBrushLibraryWrite } from './ipc';
import { libraryRowToTip, upsertLibraryRow } from '../stores/aquarelleBrushCatalog';

/** One import request, already decoded off the wire by the bridge listener. */
export interface EfxPaintBrushImportRequest {
  /** Correlation id minted by the Studio; answers echo it back (T-63-04). */
  readonly operationId: string;
  /** The picked file's name — becomes the catalog label. */
  readonly fileName: string;
  /** The derived 262,144-byte mask. Validated here, never trusted. */
  readonly mask: Uint8Array;
}

/** The ports one handler run needs. */
export interface EfxPaintBrushImportPorts {
  /**
   * Publish the whole catalog snapshot; called AFTER the mutation, BEFORE the
   * answer. Awaited when it returns a promise so the real publisher's
   * `emitTo` completes ahead of the result event.
   *
   * An implementation MAY reject — or throw synchronously. The publish is a
   * notification, not part of the answer: this handler owns the result, logs
   * the failure and still reports the landed import.
   */
  readonly publishCatalog: () => void | Promise<void>;
}

/** Why one import was refused. `library-failed` covers any native library error. */
export type EfxPaintBrushImportRefusalReason = 'bad-mask' | 'bad-file-name' | 'library-failed';

/** Total result — status and identity only; never mask bytes. */
export type EfxPaintBrushImportResult =
  | { readonly ok: true; readonly entry: AquarelleTip }
  | { readonly ok: false; readonly reason: EfxPaintBrushImportRefusalReason };

/**
 * Apply one Studio import request in the realm that owns the machine library.
 *
 * Total for every rejection the request can carry: a wrong-length mask, an
 * empty file name, a native library failure. Never writes a history entry.
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

  const written = await ipcBrushLibraryWrite(fileName, mask);
  if (!written.ok) {
    console.warn('[efxPaintBrushImport] Brush library write failed', written.error);
    return { ok: false, reason: 'library-failed' };
  }
  const row = written.data;
  const tip = libraryRowToTip(row);

  // One batch: the mask must resolve before any reader observes the new row.
  batch(() => {
    registerMask(row.id, mask);
    upsertLibraryRow({ tip, digest: row.digest, textureRotation: row.textureRotation });
  });

  // Publish BEFORE answering: the push is how the Studio gets the row, so it
  // must reach the child ahead of the result event. A failed push is LOGGED,
  // never fatal — the batch above is the commit point and the Studio pulls a
  // fresh snapshot on its next mount.
  try {
    await ports.publishCatalog();
  } catch (error) {
    console.warn('[efxPaintBrushImport] Brush catalog publish failed', error);
  }

  return { ok: true, entry: tip };
}
