import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { buildEfxPaintDocumentRevision } from '../../../efx-paint/document/efxPaintDocumentRevision';

/**
 * 52.1 (Fix A): deduplicates the child→main document sync push. The push
 * (efxPaintVersion) serializes the runtime into the document, which bumps
 * efxPaintVersion and re-fires the immediate push effect — the same document
 * then crosses the bridge a second time per gesture. The guard skips a push
 * when the serialized document CONTENT is unchanged from the last push.
 *
 * The content fingerprint is `buildEfxPaintDocumentRevision` — NOT a
 * before/after efxPaintVersion check: a direct document mutation (e.g.
 * setBackgroundFallback bumps the fallback + documentRevision OUTSIDE the
 * serialize step) left the version unchanged DURING serialize, so the old
 * version heuristic skipped every post-mount change and the main window kept a
 * stale document until the next stroke serialize. Comparing actual content
 * dedupes the re-entrant re-fire (same document) while still sending direct
 * mutations (different document).
 *
 * The null latch keeps the FIRST push alive: after a reload (launch
 * registration, crash-recovery rehydration) the main window may hold an older
 * mirror, so the mount push must still go out even when it matches nothing.
 */
export interface DocumentSyncPushGuard {
  /**
   * Run the serialize step and decide whether the resulting document must be
   * pushed. Returns the document to send, or null when the push is a duplicate
   * and should be skipped. `readVersion` is retained as a non-subscribing read
   * contract (the caller must not create subscriptions) but is no longer used
   * by the decision, which compares the serialized document content.
   */
  evaluate(
    serialize: () => EfxPaintDocument | null,
    readVersion: () => number,
  ): EfxPaintDocument | null;
}

export function createDocumentSyncPushGuard(): DocumentSyncPushGuard {
  let lastPushedFingerprint: string | null = null;
  return {
    evaluate(serialize, _readVersion) {
      const document = serialize();
      if (!document) return null;
      const fingerprint = buildEfxPaintDocumentRevision(document);
      if (lastPushedFingerprint !== null && lastPushedFingerprint === fingerprint) return null;
      lastPushedFingerprint = fingerprint;
      return document;
    },
  };
}
