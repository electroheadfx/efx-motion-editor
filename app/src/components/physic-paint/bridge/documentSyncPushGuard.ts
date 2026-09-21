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

/**
 * quick-260921-ffh: the guard DECISION of one render's push, hoisted out of
 * `pushLiveProjection` (PhysicsPaintStudio.tsx) — the closure the 260921-ffh
 * diagnosis named, and one the Studio component cannot expose to a test (it
 * cannot be mounted under vitest: Tauri window/engine deps).
 *
 * The component creates the decision ONCE PER RENDER, at the point where it
 * used to read `documentSyncPushGuardRef.current` into a render local. The
 * decision consults the REF AT DECISION TIME (not a value captured at creation):
 * the failure path re-arms the REF (`:3981`), so a retry that runs with no
 * render in between (a quiet Studio: no input, no version bump, no other signal
 * write) must decide against the guard the failure path re-armed — the guard
 * whose latch is empty — not against the guard the failed send already latched.
 *
 * Capture-at-creation was the diagnosed defect: the retry read the same content
 * as a duplicate of the FAILED push (`createDocumentSyncPushGuard` latches the
 * fingerprint BEFORE the send resolves), returned null, and the caller — which
 * clears the pending flag BEFORE the push — consumed the change with no send and
 * no re-mark, so reference selections, background keyframes and (+) tracks never
 * left the child. Reading the ref per decision restores the re-arm's reach.
 *
 * The link is pinned behaviourally in
 * `stores/efxPaintStudioOriginSync.scratch.test.ts` (quick-260921-ffh).
 */
export interface DocumentSyncPushDecision {
  /**
   * Run the serialize step and decide whether the resulting document must be
   * pushed: the document to send, or null when the push is a duplicate and must
   * be skipped. Same contract as `DocumentSyncPushGuard.evaluate`, and it must
   * be called with that guard's CURRENT value: the failure path swaps the guard
   * to keep a failed push retryable.
   */
  decide(serialize: () => EfxPaintDocument | null): EfxPaintDocument | null;
}

export function createDocumentSyncPushDecision(
  guardRef: { current: DocumentSyncPushGuard | null },
  readVersion: () => number,
): DocumentSyncPushDecision {
  return {
    decide: (serialize) => {
      const guard = guardRef.current;
      return guard === null ? null : guard.evaluate(serialize, readVersion);
    },
  };
}
