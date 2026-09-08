import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';

/**
 * 52.1 (Fix A): deduplicates the child→main document sync push. The push
 * (efxPaintVersion) serializes the runtime into the document, which bumps
 * efxPaintVersion and re-fires the immediate push effect — the same document
 * then crosses the bridge a second time per gesture. The guard skips a push
 * when the serialize produced no version bump AND a push already happened this
 * session.
 *
 * The hasPushed latch keeps the FIRST push alive: after a reload (launch
 * registration, crash-recovery rehydration) the main window may hold an older
 * mirror, so the mount push must still go out even when the serialize is a
 * no-op. A pure before/after version check would skip it and strand the main
 * window on a stale document until the next real mutation.
 */
export interface DocumentSyncPushGuard {
  /**
   * Run the serialize step and decide whether the resulting document must be
   * pushed. Returns the document to send, or null when the push is a duplicate
   * and should be skipped. `readVersion` must be a non-subscribing signal read
   * (efxPaintVersion.peek()) — the push path must not create subscriptions.
   */
  evaluate(
    serialize: () => EfxPaintDocument | null,
    readVersion: () => number,
  ): EfxPaintDocument | null;
}

export function createDocumentSyncPushGuard(): DocumentSyncPushGuard {
  let hasPushed = false;
  return {
    evaluate(serialize, readVersion) {
      const before = readVersion();
      const document = serialize();
      if (!document) return null;
      const changed = readVersion() !== before;
      if (hasPushed && !changed) return null;
      hasPushed = true;
      return document;
    },
  };
}
