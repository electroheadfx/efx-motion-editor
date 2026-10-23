// ============================================================
//  studioScriptSnapshotTrackDelete — the rail-deletion cascade
//  (quick-261023-ors Task 3).
//
//  A committed `commitDeleteTrack` must also delete that track's
//  persisted Studio script snapshot on BOTH legs:
//    - `<package>/scripts/<layerId>/<trackId>-v1.snap` (when bound)
//    - the app-cache fallback
//  No orphaned snapshot may survive the rail, and no OTHER rail's
//  snapshot may ever be named. Reusable Scripts-library presets
//  (`*.efx-roto-script.json`) live outside this path and are never
//  read or written.
//
//  PURITY: no Preact, no Studio import. The Studio supplies the
//  ports; this factory owns the fail-closed key law and the
//  bind-before-remove order.
//
//  LAWS:
//    - No bound identity -> do nothing (never guess a key).
//    - Bound identity for another LAYER -> do nothing (the cascade
//      only belongs to the Studio's own layer).
//    - Deleted track IS the bound one -> `clearBinding()` runs
//      SYNCHRONOUSLY BEFORE the delete, so a pending debounce and
//      any in-flight restore are invalidated and a prepared save
//      cannot rewrite the deleted key.
//    - The delete is fire-and-forget, never awaited inside the
//      store call, never throws. A failure reports ONCE through the
//      existing capsule and the rail delete still commits.
// ============================================================

import type { StudioScriptSnapshotIdentity } from '../performance/studioScriptSnapshotCodec';
import type {
  StudioScriptSnapshotDeletePayload,
  StudioScriptSnapshotDeleteScope,
  StudioScriptSnapshotOperationResult,
} from './studioScriptSnapshotController';

/** The ONE failure message for a cascade that could not clean a rail. */
export function studioScriptSnapshotTrackDeleteFailureMessage(kind: string): string {
  return `The deleted rail's Studio script snapshot could not be removed (${kind}). The rail itself is deleted; the leftover snapshot is never read again.`;
}

export interface StudioScriptSnapshotTrackDeleteDeps {
  /** The controller's current binding, or null. */
  getIdentity: () => StudioScriptSnapshotIdentity | null;
  /** The LIVE opaque package capability (read at dispatch time). */
  getAuthority: () => string | null;
  /**
   * Invalidate the bound key synchronously: clear the identity ref, stop the
   * debounce and drop the controller binding.
   */
  clearBinding: () => void;
  remove: (
    identity: StudioScriptSnapshotIdentity,
    authority: string | null,
    scope: StudioScriptSnapshotDeleteScope,
  ) => Promise<StudioScriptSnapshotOperationResult<StudioScriptSnapshotDeletePayload>>;
  /** Status-capsule sink; called only on failure. */
  report: (message: string) => void;
}

/**
 * Build the `(layerId, trackId) => void` hook `commitDeleteTrack` invokes.
 * Never throws; never returns a promise (the store call stays synchronous).
 */
export function createStudioScriptSnapshotTrackDelete(
  deps: StudioScriptSnapshotTrackDeleteDeps,
): (layerId: string, trackId: string) => void {
  return (layerId, trackId) => {
    const bound = deps.getIdentity();
    // Fail closed: without a binding there is no project identity to address,
    // and a guessed key could delete another project's snapshot.
    if (!bound) return;
    // Only the Studio's own layer: another layer's tracks are out of scope.
    if (bound.layerId !== layerId) return;

    if (bound.trackId === trackId) {
      // BEFORE the delete: a pending debounce / in-flight restore / prepared
      // save for the outgoing key is invalidated here, so nothing can rewrite
      // the snapshot this cascade is about to remove.
      deps.clearBinding();
    }

    // The committed (layerId, trackId) names the file — never the binding's
    // own track when a different rail was deleted.
    const key: StudioScriptSnapshotIdentity = {
      projectId: bound.projectId,
      layerId,
      trackId,
    };
    const authority = deps.getAuthority();

    // Fire-and-forget: the store call returns immediately and the cascade can
    // never reject into it.
    void (async () => {
      let result: StudioScriptSnapshotOperationResult<StudioScriptSnapshotDeletePayload>;
      try {
        result = await deps.remove(key, authority, 'both');
      } catch {
        result = { ok: false, error: { kind: 'io' } };
      }
      if (!result.ok) deps.report(studioScriptSnapshotTrackDeleteFailureMessage(result.error.kind));
    })();
  };
}
