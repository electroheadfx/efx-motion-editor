/**
 * Reactive v1.0 EFX Paint document store (Phase 45-04 Task 1).
 *
 * Mirrors the physicPaintStore conventions: a non-reactive Map keyed by
 * parent layer id, an `efxPaintVersion` counter-signal bumped on every
 * mutation, an injected project-dirty callback, and a `reset()` hook for
 * project close. Every mutation bumps the version AND fires the dirty
 * callback (MEMORY: always bump AND subscribe). No useEffect/useState —
 * signals and plain functions only (CLAUDE.md).
 *
 * Documents enter the store only after fail-closed validation by
 * `parseEfxPaintDocument` (the persistence loader owns that boundary,
 * T-45-13); the store itself never allocates IDs or normalizes input.
 */

import { signal } from '@preact/signals';
import type { CachedFrameReference, EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import { buildEfxPaintFrameCachePath, EFX_PAINT_CACHE_DIR, stableSegment } from '../lib/efxPaintPersistence';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { physicPaintStore, removeTrackRuntime, severTrackHoldReferences } from './physicPaintStore';

let _markProjectDirty: (() => void) | null = null;

/** Inject the project-dirty callback (wired by projectStore in 45-05). */
export function _setEfxPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

/** Counter-signal bumped on every document mutation (subscribe for reactivity). */
export const efxPaintVersion = signal(0);

const _documents = new Map<string, EfxPaintDocument>();

/**
 * Pending track-sidecar deletion dirs (46-05 TRK-07 D-15): layerId →
 * relative dirs under `cache/efx-paint/` registered by committed track
 * deletions. The save path (projectStore.buildEfxPaintDocuments) merges them
 * into the next save input so the sidecar removal rides the same tracked
 * transaction as the save — commit removes, rollback keeps.
 */
const _pendingTrackDeletions = new Map<string, string[]>();

/**
 * Read and clear the pending sidecar deletion dirs for one layer (46-05
 * D-15). Clearing happens on read: the next save carries exactly the
 * deletions registered before it was built — a later save has none.
 */
export function takePendingTrackDeletions(layerId: string): readonly string[] {
  const deletions = _pendingTrackDeletions.get(layerId);
  _pendingTrackDeletions.delete(layerId);
  return deletions ?? [];
}

function _notifyChange(): void {
  efxPaintVersion.value++;
  _markProjectDirty?.();
}

/**
 * Register (or replace) the v1.0 document owned by one parent layer.
 * One parent layer owns exactly one document (DOC-01).
 */
export function registerDocument(document: EfxPaintDocument): void {
  _documents.set(document.parentLayerId, document);
  _notifyChange();
}

/** Read the document for a parent layer, or null when absent. */
export function getDocument(layerId: string): EfxPaintDocument | null {
  return _documents.get(layerId) ?? null;
}

/** True when a document is registered for the parent layer. */
export function hasDocument(layerId: string): boolean {
  return _documents.has(layerId);
}

/** Remove the document for a parent layer. Returns true when one was removed. */
export function removeDocument(layerId: string): boolean {
  const removed = _documents.delete(layerId);
  if (removed) _notifyChange();
  return removed;
}

/** Read the document's active track id, or null when the document is absent. */
export function getActiveTrackId(layerId: string): string | null {
  return getDocument(layerId)?.activeTrackId ?? null;
}

/**
 * Switch the document's active track (46-03 D-04 auto-activation). Validates
 * the trackId exists in the document (fail closed otherwise — never activates
 * a foreign/unknown track), writes activeTrackId, and bumps documentRevision
 * via the 45-01 builders (activeTrackId is a docrev term, so the fingerprint
 * changes exactly when the active track does). A no-op when the track is
 * already active. Returns false when the document or track is absent.
 */
export function setActiveTrackId(layerId: string, trackId: string): boolean {
  const document = getDocument(layerId);
  if (!document) return false;
  if (!document.tracks.some((track) => track.id === trackId)) return false;
  if (document.activeTrackId === trackId) return true;
  const candidate: EfxPaintDocument = { ...document, activeTrackId: trackId };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) return true;
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return true;
}

/**
 * Acknowledged track-deletion surface (46-05 TRK-07, D-14/D-17): the preview
 * reports the full destruction surface (frames, clips, Hold references to
 * sever, last-track flag) BEFORE any mutation; the commit refuses without the
 * explicit acknowledgement, refuses the last surviving Paint track, and
 * otherwise performs the exact per-track teardown through 46-01's
 * `removeTrackRuntime` plus a rebuilt document.
 */
export interface TrackDeletePreview {
  readonly layerId: string;
  readonly trackId: string;
  /** Real-key runtime frame count of the deleted track (D-14 dialog surface). */
  readonly frameCount: number;
  /** Loop Clip record count owned by the deleted track. */
  readonly loopClipCount: number;
  /** Number of Hold Loop Clips on surviving tracks referencing the deleted track's keyIds (D-16). */
  readonly holdReferenceCount: number;
  readonly isLastTrack: boolean;
}

/** Count every surviving track's Hold clips referencing the deleted track's keyIds. */
function _countHoldReferencesToTrack(layerId: string, trackId: string, document: EfxPaintDocument): number {
  const deletedKeyIds = new Set(
    physicPaintStore.getRotoRealKeyRecords(layerId, trackId).map((record) => record.keyId),
  );
  if (deletedKeyIds.size === 0) return 0;
  let count = 0;
  for (const survivor of document.tracks) {
    if (survivor.id === trackId) continue;
    for (const clip of physicPaintStore.getRotoPhysicalLoopClips(layerId, survivor.id)) {
      if (clip.sourceKeyIds.some((keyId) => deletedKeyIds.has(keyId))) count += 1;
    }
  }
  return count;
}

/**
 * Compute the acknowledged-deletion preview for one internal track, or null
 * when the document or the track is absent. Pure read — never mutates the
 * document or the runtime (D-14: the destruction surface is known before any
 * mutation; ASVS V4).
 */
export function requestDeleteTrack(layerId: string, trackId: string): TrackDeletePreview | null {
  const document = getDocument(layerId);
  if (!document) return null;
  if (!document.tracks.some((track) => track.id === trackId)) return null;
  return {
    layerId,
    trackId,
    frameCount: physicPaintStore.getFrames(layerId, trackId).size,
    loopClipCount: physicPaintStore.getRotoPhysicalLoopClips(layerId, trackId).length,
    holdReferenceCount: _countHoldReferencesToTrack(layerId, trackId, document),
    isLastTrack: document.tracks.length === 1,
  };
}

/**
 * Commit the acknowledged deletion of exactly one internal track (46-05
 * TRK-07). Refuses fail-closed without `acknowledged`, for an unknown track,
 * and for the last surviving Paint track (D-17 — the document always keeps at
 * least one Paint track; a refused delete writes nothing and the active track
 * never moves). A committed delete severs every surviving Hold Loop Clip
 * referencing the deleted track's keyIds (D-16, resolver answers
 * 'linked-unresolved' afterwards), tears down the track's complete runtime
 * through 46-01 `removeTrackRuntime` (frames, records, loopClips, caches,
 * selection/cursor, leases, structural memo), rebuilds the document without
 * the track re-projecting every surviving track from the runtime (the
 * runtime is the authority; the severed Hold refs stay verbatim, D-31),
 * re-points `activeTrackId` to the nearest adjacent survivor by document
 * order (the next track if any, else the previous — D-18), and fires the
 * dirty callback exactly once.
 */
export function commitDeleteTrack(
  layerId: string,
  trackId: string,
  acknowledged: boolean,
): { ok: true } | { ok: false; error: string } {
  const document = getDocument(layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  if (!document.tracks.some((track) => track.id === trackId)) return { ok: false, error: 'unknown track' };
  if (!acknowledged) return { ok: false, error: 'delete not acknowledged' };
  if (document.tracks.length === 1) return { ok: false, error: 'last-track' };

  severTrackHoldReferences(layerId, trackId);
  removeTrackRuntime(layerId, trackId);

  // 46-05 D-15: register the deleted track's sidecar directory for removal
  // in the same cache transaction as the next save. The dir (a relative
  // path under cache/efx-paint) is validated by the persistence boundary
  // before it may ride the transaction.
  const deletionDir = `${EFX_PAINT_CACHE_DIR}/${stableSegment(layerId)}/${trackId}`;
  const pending = _pendingTrackDeletions.get(layerId) ?? [];
  _pendingTrackDeletions.set(layerId, [...pending, deletionDir]);

  const deletedIndex = document.tracks.findIndex((track) => track.id === trackId);
  const remainingTracks = document.tracks.filter((track) => track.id !== trackId);
  const projectedTracks = remainingTracks.map((track) => {
    if (!physicPaintStore.hasTrackRuntime(layerId, track.id)) return track;
    const runtime = physicPaintStore.extractRuntimeStateForDocument(layerId, track.id);
    const frames: Record<number, CachedFrameReference> = {};
    for (const [appFrame, frame] of runtime.frames) {
      frames[appFrame] = {
        cachePath: buildEfxPaintFrameCachePath(layerId, track.id, frame),
        width: frame.width ?? 0,
        height: frame.height ?? 0,
      };
    }
    return { ...track, frames, rotoPhysical: runtime.rotoPhysical };
  });
  const nextActiveTrackId = document.activeTrackId === trackId
    ? projectedTracks[deletedIndex]?.id ?? projectedTracks[deletedIndex - 1]?.id ?? document.activeTrackId
    : document.activeTrackId;
  const next: EfxPaintDocument = {
    ...document,
    activeTrackId: nextActiveTrackId,
    tracks: projectedTracks,
    documentRevision: document.documentRevision + 1,
  };
  _documents.set(layerId, next);
  _notifyChange();
  return { ok: true };
}

/** Empty the store and bump the version signal (project close hook). */
export function reset(): void {
  _pendingTrackDeletions.clear();
  if (_documents.size === 0) return;
  _documents.clear();
  _notifyChange();
}

/**
 * Project one layer's runtime state into its v1.0 document (Phase 45-04
 * Task 2, 46-02 multi-track). Every Paint track of the document is projected
 * by its stable track id — never tracks[0] by index (TRK-01 base law, Pitfall
 * 1): runtime frames become CachedFrameReference sidecar refs and the physical
 * Roto state is carried as-is per track. `documentRevision` bumps by one only
 * when the projected content actually changed (the fingerprint includes the
 * current docrev, so the comparison is made on the same revision).
 */
export function serializeRuntimeIntoDocument(layerId: string): EfxPaintDocument {
  const document = getDocument(layerId);
  if (!document) throw new Error(`No EFX Paint document for layer "${layerId}".`);
  const tracks = document.tracks.map((track) => {
    const runtime = physicPaintStore.extractRuntimeStateForDocument(layerId, track.id);
    const frames: Record<number, CachedFrameReference> = {};
    for (const [appFrame, frame] of runtime.frames) {
      frames[appFrame] = {
        cachePath: buildEfxPaintFrameCachePath(layerId, track.id, frame),
        width: frame.width ?? 0,
        height: frame.height ?? 0,
      };
    }
    return { ...track, frames, rotoPhysical: runtime.rotoPhysical };
  });
  const candidate: EfxPaintDocument = { ...document, tracks };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) {
    return candidate;
  }
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return next;
}

/**
 * Install a v1.0 document's runtime state into the physicPaintStore runtime
 * maps (Phase 45-04 Task 2, 46-02 multi-track). Every Paint track of the
 * document is installed into its own runtime maps keyed by the track's stable
 * id; the caller supplies the hydrated runtime frame bytes per track (the
 * persistence loader's per-track carrier) alongside the document. Tracks with
 * no supplied frames hydrate as empty.
 */
export function hydrateRuntimeFromDocument(
  document: EfxPaintDocument,
  frames: ReadonlyMap<string, ReadonlyMap<number, PhysicPaintRenderedFrame>>,
): void {
  for (const track of document.tracks) {
    physicPaintStore.installRuntimeStateFromDocument(document.parentLayerId, track.id, {
      trackId: track.id,
      frames: frames.get(track.id) ?? new Map(),
      rotoPhysical: track.rotoPhysical,
    });
  }
}
