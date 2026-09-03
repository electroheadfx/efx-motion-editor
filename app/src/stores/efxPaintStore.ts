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
import type { BackgroundFallback, BackgroundTrack, BlendMode, CachedFrameReference, EfxPaintDocument, FrameLoopClip, FrameLoopClipRepeat, FrameLoopClipScale, InternalPaintTrack, PhotoReferenceTrack, PhotoReferenceTransform } from '../efx-paint/document/efxPaintDocument';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import { deriveEfxPaintBackgroundResolution } from '../efx-paint/compositor/efxPaintBackgroundResolution';
import type { PhysicPaintRotoLoopResolutionContext } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import { createPhysicPaintRotoKeyId } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoLoopClip } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { RotoPaintScript } from '../components/physic-paint/roto/physicsPaintRotoScriptClipboard';
import { buildEfxPaintFrameCachePath, EFX_PAINT_CACHE_DIR, stableSegment } from '../lib/efxPaintPersistence';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../types/physicPaint';
import { bumpTrackRevision, commitRevealBake, hydrateBackgroundSourceImagesFromLibrary, hydrateReferenceSourceImagesFromLibrary, mountTrackRuntime, physicPaintStore, removeTrackRuntime, severTrackHoldReferences } from './physicPaintStore';

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

/** Max length of a Paint track display name after trimming (47-01 Task 2, ASVS V5). */
export const MAX_TRACK_NAME_LENGTH = 64;

/** Fail-closed result of a track CRUD mutation (47-01 Tasks 2/3). */
export type TrackMutationResult =
  | { readonly ok: true; readonly trackId: string }
  | { readonly ok: false; readonly error: string };

/** Track name control-character guard (ASVS V5 — reject C0 controls and DEL).
 *  Exported (47-02 Task 2) so the strip's edit-in-place rename commit reuses
 *  the exact same rejection rule fail-closed before any store call. */
export const TRACK_NAME_CONTROL_CHAR = /[\u0000-\u001f\u007f]/;

/** Next free auto-number: the first positive integer not already taken by an existing `Paint N` name (47-UI-SPEC D-02). */
function _nextPaintTrackNumber(document: EfxPaintDocument): number {
  const used = new Set<number>();
  for (const track of document.tracks) {
    const match = /^Paint (\d+)$/.exec(track.name);
    if (match) used.add(Number(match[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

/** The maximum existing track order, or -1 when the document has no tracks. */
function _maxTrackOrder(document: EfxPaintDocument): number {
  return document.tracks.reduce((max, track) => Math.max(max, track.order), -1);
}

/**
 * Project one track's runtime into the document CachedFrameReference + Roto
 * record shape (shared by duplicateTrack and commitDeleteTrack — the runtime
 * is the authority, the document carries the projection).
 */
function _projectTrackRuntime(layerId: string, trackId: string): Pick<InternalPaintTrack, 'frames' | 'rotoPhysical'> {
  const runtime = physicPaintStore.extractRuntimeStateForDocument(layerId, trackId);
  const frames: Record<number, CachedFrameReference> = {};
  for (const [appFrame, frame] of runtime.frames) {
    frames[appFrame] = {
      cachePath: buildEfxPaintFrameCachePath(layerId, trackId, frame),
      width: frame.width ?? 0,
      height: frame.height ?? 0,
    };
  }
  return { frames, rotoPhysical: runtime.rotoPhysical };
}

/**
 * Add a new Paint track to the document (47-01 Task 2, TML-02). Fail-closed on
 * an absent document. The new track gets a fresh UUID, the auto-name `Paint {N}`
 * (next free number not taken by an existing Paint track name, 47-UI-SPEC
 * D-02), and `order` 0 — 47-01 UAT: the new track lands at the TOP of the
 * track list, every existing track shifts down one order, and the tracks
 * array stays order-sorted. It is mounted into the runtime maps after the
 * document write (mountTrackRuntime never bumps revisions). `activeTrackId`
 * is left unchanged — the UI activates the returned track via
 * setActiveTrackId. Bumps documentRevision by 1 and fires _notifyChange once.
 */
export function addTrack(layerId: string): TrackMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  const trackId = crypto.randomUUID();
  const newTrack: InternalPaintTrack = {
    id: trackId,
    name: `Paint ${_nextPaintTrackNumber(document)}`,
    order: 0,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal',
    revision: 0,
    frames: {},
    rotoPhysical: null,
    loopClips: [],
  };
  const shiftedTracks = document.tracks.map((track) => ({ ...track, order: track.order + 1 }));
  const candidate: EfxPaintDocument = { ...document, tracks: [newTrack, ...shiftedTracks] };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  mountTrackRuntime(layerId, trackId);
  _notifyChange();
  return { ok: true, trackId };
}

/**
 * Rename one Paint track (47-01 Task 2, TML-02, ASVS V5). Trims the input,
 * caps it at MAX_TRACK_NAME_LENGTH, rejects empty/whitespace-only names and
 * control characters fail-closed, and is a no-op when the trimmed+capped name
 * equals the current one (no revision bump). A valid rename bumps
 * documentRevision exactly once (name is a docrev term) and fires
 * _notifyChange once.
 */
export function renameTrack(layerId: string, trackId: string, name: string): TrackMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  const track = document.tracks.find((candidate) => candidate.id === trackId);
  if (!track) return { ok: false, error: 'unknown track' };
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: 'empty track name' };
  if (TRACK_NAME_CONTROL_CHAR.test(trimmed)) return { ok: false, error: 'invalid track name' };
  const capped = trimmed.slice(0, MAX_TRACK_NAME_LENGTH);
  if (capped === track.name) return { ok: true, trackId };
  const candidate: EfxPaintDocument = {
    ...document,
    tracks: document.tracks.map((current) => (current.id === trackId ? { ...current, name: capped } : current)),
  };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) return { ok: true, trackId };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return { ok: true, trackId };
}

/**
 * Duplicate one Paint track whole (47-01 Task 2, TML-02/D-09). Deep-copies the
 * source's Paint frames, Roto real keys, and Loop Clips with fresh identities
 * through the Phase 46 copy-paste primitive — the copy is independently
 * editable with zero effect on the source (D-05). The copy's document record is
 * projected from the copy's own runtime (the runtime is the authority). The
 * name gets the ` Copy` suffix: first copy `X Copy`, then `X Copy 2`, `X Copy 3`
 * (47-UI-SPEC D-09). Fails closed with the source untouched when the copy
 * primitive rejects (e.g. an impossible Hold re-pointing, D-06).
 */
export function duplicateTrack(layerId: string, trackId: string): TrackMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  const source = document.tracks.find((candidate) => candidate.id === trackId);
  if (!source) return { ok: false, error: 'unknown track' };
  const newTrackId = crypto.randomUUID();

  mountTrackRuntime(layerId, newTrackId);
  const sourceKeyIds = physicPaintStore.getRotoRealKeyRecords(layerId, trackId).map((record) => record.keyId);
  if (sourceKeyIds.length > 0) {
    const copied = physicPaintStore.copyTrackSelection(layerId, trackId, sourceKeyIds);
    if (!copied.ok) {
      removeTrackRuntime(layerId, newTrackId);
      return { ok: false, error: `copy-failed: ${copied.reason}` };
    }
    // Paste with the payload's own anchor (delta 0): the fresh destination
    // keys land on the exact source app frames (paste selection D-09 idiom).
    const pasted = physicPaintStore.pasteTrackSelection(
      layerId, newTrackId, copied.payload, copied.payload.anchorAppFrame,
    );
    if (!pasted.ok) {
      removeTrackRuntime(layerId, newTrackId);
      return { ok: false, error: `paste-failed: ${pasted.reason}` };
    }
  }

  const copyCount = document.tracks
    .filter((candidate) => candidate.id !== trackId
      && (candidate.name === `${source.name} Copy` || candidate.name.startsWith(`${source.name} Copy `)))
    .length;
  const copyName = copyCount === 0 ? `${source.name} Copy` : `${source.name} Copy ${copyCount + 1}`;
  const projected = _projectTrackRuntime(layerId, newTrackId);
  const newTrack: InternalPaintTrack = {
    id: newTrackId,
    name: copyName,
    order: _maxTrackOrder(document) + 1,
    visible: source.visible,
    solo: source.solo,
    opacity: source.opacity,
    blendMode: source.blendMode,
    revision: source.revision,
    ...projected,
    loopClips: [],
  };
  const candidate: EfxPaintDocument = { ...document, tracks: [...document.tracks, newTrack] };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return { ok: true, trackId: newTrackId };
}

/**
 * Reorder one Paint track (47-01 Task 2, TML-08). Rewrites only the track's
 * `order` field — never the stable UUID id and never array-position semantics;
 * the document `tracks` array is re-sorted to match the new orders. `newOrder`
 * is the resulting 0-based position of the moved track; the other orders are
 * normalized 0..N-1 so the field stays a contiguous index. A move to the track's
 * current position is a no-op (no revision bump, no _notifyChange). Otherwise
 * bumps documentRevision exactly once (order is a docrev term).
 */
export function reorderTrack(layerId: string, trackId: string, newOrder: number): TrackMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  if (!document.tracks.some((candidate) => candidate.id === trackId)) return { ok: false, error: 'unknown track' };
  const sorted = [...document.tracks].sort((a, b) => a.order - b.order);
  const fromIndex = sorted.findIndex((candidate) => candidate.id === trackId);
  if (fromIndex === newOrder) return { ok: true, trackId };
  const clamped = Math.max(0, Math.min(sorted.length - 1, Math.trunc(newOrder)));
  if (clamped === fromIndex) return { ok: true, trackId };
  const without = sorted.filter((candidate) => candidate.id !== trackId);
  without.splice(clamped, 0, sorted[fromIndex]);
  const reorderedTracks = without.map((track, index) => ({ ...track, order: index }));
  const candidate: EfxPaintDocument = { ...document, tracks: reorderedTracks };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) return { ok: true, trackId };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return { ok: true, trackId };
}

/** The main-editor BlendMode union as a lookup set (efxPaintDocument.ts:17). */
const BLEND_MODES: ReadonlySet<BlendMode> = new Set(['normal', 'screen', 'multiply', 'overlay', 'add']);

/**
 * Shared hide/solo/opacity/blend setter body (47-01 Task 3, TML-04). Follows
 * the setActiveTrackId shape — fail-closed on absent document / unknown
 * trackId, early no-op on an identical value, immutable next document,
 * `_documents.set` — but the write does NOT bump documentRevision (visible/
 * solo/opacity/blendMode are not `buildEfxPaintDocumentRevision` terms and not
 * docrev terms). Instead it calls `bumpTrackRevision` so the per-track paint +
 * roto signals and the global physicPaintVersion clock bump exactly once and
 * the track's structural cache invalidates, and fires the efxPaint dirty
 * callback exactly once via `_notifyChange`.
 */
function _setTrackDisplayProperty(
  layerId: string,
  trackId: string,
  patch: (track: InternalPaintTrack) => InternalPaintTrack,
  isChanged: (track: InternalPaintTrack) => boolean,
): TrackMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, error: 'no efx paint document' };
  const track = document.tracks.find((candidate) => candidate.id === trackId);
  if (!track) return { ok: false, error: 'unknown track' };
  if (!isChanged(track)) return { ok: true, trackId };
  const nextTrack = patch(track);
  const next: EfxPaintDocument = {
    ...document,
    tracks: document.tracks.map((current) => (current.id === trackId ? nextTrack : current)),
  };
  _documents.set(layerId, next);
  bumpTrackRevision(layerId, trackId);
  _notifyChange();
  return { ok: true, trackId };
}

/** Hide/unhide one Paint track (47-01 Task 3, TML-04). */
export function setTrackVisible(layerId: string, trackId: string, visible: boolean): TrackMutationResult {
  return _setTrackDisplayProperty(
    layerId, trackId,
    (track) => ({ ...track, visible }),
    (track) => track.visible !== visible,
  );
}

/** Arm/disarm solo on one Paint track (47-01 Task 3, TML-04). */
export function setTrackSolo(layerId: string, trackId: string, solo: boolean): TrackMutationResult {
  return _setTrackDisplayProperty(
    layerId, trackId,
    (track) => ({ ...track, solo }),
    (track) => track.solo !== solo,
  );
}

/**
 * Set one Paint track's opacity (47-01 Task 3, TML-04). Accepts 0..1 floats
 * and stores them exactly; out-of-range finite values are clamped into 0..1;
 * non-finite values are rejected fail-closed. The stored value is always in
 * 0..1.
 */
export function setTrackOpacity(layerId: string, trackId: string, opacity: number): TrackMutationResult {
  if (!Number.isFinite(opacity)) return { ok: false, error: 'invalid opacity' };
  const clamped = Math.min(1, Math.max(0, opacity));
  return _setTrackDisplayProperty(
    layerId, trackId,
    (track) => ({ ...track, opacity: clamped }),
    (track) => track.opacity !== clamped,
  );
}

/** Set one Paint track's blend mode — accepts exactly the BlendMode union (47-01 Task 3, TML-04). */
export function setTrackBlend(layerId: string, trackId: string, blendMode: BlendMode): TrackMutationResult {
  if (!BLEND_MODES.has(blendMode)) return { ok: false, error: 'invalid blend mode' };
  return _setTrackDisplayProperty(
    layerId, trackId,
    (track) => ({ ...track, blendMode }),
    (track) => track.blendMode !== blendMode,
  );
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

// ============================================================================
// Background clip CRUD document ops + fallback setter (49-02 Task 2)
// ============================================================================
//
// The five Background authoring ops funnel every UI surface (picker confirm,
// rail drag, right panel, selector) through one pure document-mutation shape
// copied from addTrack/renameTrack: validate -> build candidate by immutable
// spread -> canonical-revision idempotence compare -> single documentRevision
// bump -> single _notifyChange -> return the acceptance descriptor for the
// unified undo ledger (BKG-08, by reference, rasters already stripped — the
// document carries sidecar refs, never raster bytes).
//
// The start-collision verdict (BKG-03/D-04) derives the existing clips'
// resolved extents via the resolver projection ONLY — the store never
// pre-computes or caches effective extents (anti Pitfall 10/m2). The resolver
// is the single authority for range.truncated/partialCycle/effectiveEnd.

/** Parent-end bound for the Background resolution projection (mirrors physicPaintStore's BACKGROUND_RESOLUTION_CAPACITY). */
const BACKGROUND_RESOLUTION_CAPACITY = PHYSIC_PAINT_MAX_APPLY_FRAMES;

/** Closed rejection-reason union the UI maps to the locked English copy (49-UI-SPEC Copywriting Contract). */
export type BackgroundMutationRejectionReason =
  | 'start-collision'
  | 'invalid-repeat'
  | 'invalid-scale'
  | 'clip-not-found'
  | 'invalid-source-refs';

/** The Background edit kinds the unified ledger records (BKG-08). */
export type BackgroundEditOperationKind =
  | 'add-background-clip'
  | 'move-background-clip'
  | 'set-background-clip-repeat'
  | 'set-background-clip-scale'
  | 'resize-background-clip'
  | 'set-background-clip-source'
  | 'delete-background-clip'
  | 'set-background-fallback'
  | 'set-photo-reference-source'
  | 'clear-photo-reference'
  // 52-01 (RVL-06): the reveal rail mutations — each committed reveal op is one
  // undo-ledger entry by reference. 'reveal-create' is emitted by the create
  // mutation; 'reveal-replay'/'reveal-delete'/'reveal-span' are reserved for the
  // later plans that wire the replay/delete/span-edit surfaces.
  | 'reveal-create'
  | 'reveal-replay'
  | 'reveal-delete'
  | 'reveal-span';

/**
 * Acceptance descriptor emitted by every committed Background op (BKG-08).
 * `before`/`after` are the exact document objects by reference — undo restores
 * `before`, redo re-applies `after`; clip deletion is one undo step (D-08).
 * No-op writes emit `descriptor: null` and never reach the ledger.
 */
export interface BackgroundEditDescriptor {
  readonly operationId: string;
  readonly operationKind: BackgroundEditOperationKind;
  readonly before: EfxPaintDocument;
  readonly after: EfxPaintDocument;
}

/** Result of a Background clip mutation (add/move/repeat/delete). */
export type BackgroundClipMutationResult =
  | { readonly ok: true; readonly clipId: string; readonly descriptor: BackgroundEditDescriptor | null }
  | { readonly ok: false; readonly reason: BackgroundMutationRejectionReason };

/** Result of the Background fallback setter. */
export type BackgroundFallbackMutationResult =
  | { readonly ok: true; readonly descriptor: BackgroundEditDescriptor | null }
  | { readonly ok: false; readonly reason: BackgroundMutationRejectionReason };

/** A landing frame must be a non-negative integer (the parser's isNonNegativeInteger shape). */
function _isValidStartFrame(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** Repeat contract (BKG-04): finite integers >= 1, or { mode: 'infinite' }. */
function _isValidScale(scale: FrameLoopClipScale): boolean {
  return Number.isFinite(scale.x) && scale.x > 0 && Number.isFinite(scale.y) && scale.y > 0;
}

function _isValidRepeat(repeat: FrameLoopClipRepeat): boolean {
  if (repeat.mode === 'infinite') return true;
  return Number.isInteger(repeat.count) && repeat.count >= 1;
}

/** Linked-source contract (BKG-07): refs are non-empty library asset IDs, never empty. */
function _isValidSourceRefs(refs: readonly string[]): boolean {
  return refs.length > 0 && refs.every((ref) => typeof ref === 'string' && ref.trim().length > 0);
}

/** Fail-closed structural check of a BackgroundFallback value (T-49-02-01). */
function _isValidFallback(fallback: BackgroundFallback): boolean {
  if (fallback.mode === 'transparent') return true;
  if (fallback.mode === 'solid') return typeof fallback.color === 'string' && fallback.color.length > 0;
  if (fallback.mode === 'paper') {
    return (fallback.texture === 'canvas1' || fallback.texture === 'canvas2' || fallback.texture === 'canvas3')
      && typeof fallback.paperGrain === 'boolean'
      && typeof fallback.grainStrength === 'number'
      && Number.isFinite(fallback.grainStrength)
      && fallback.grainStrength >= 0;
  }
  return false;
}

/**
 * Shared start-collision verdict (BKG-03/D-04, symmetric for import and drag).
 * Derives the existing clips' resolved extents via the resolver projection and
 * rejects ONLY when the landing frame is strictly inside an occupied range
 * (`placementStart <= landing < effectiveEnd`). A landing exactly at the
 * previous clip's exclusive end (zero-gap adjacency) is ACCEPTED. A document
 * with zero clips accepts any landing frame >= 0. `excludeClipId` removes the
 * moved clip from the projection so a clip's own extent never blocks its move.
 * An undeterminable existing document (resolver validation throw) fails closed
 * — nothing is ever written on an unverifiable verdict.
 */
function _backgroundCollisionVerdict(
  background: BackgroundTrack,
  landingFrame: number,
  excludeClipId: string | null,
): { ok: true } | { ok: false; reason: 'start-collision' } {
  if (!_isValidStartFrame(landingFrame)) return { ok: false, reason: 'start-collision' };
  const clips = excludeClipId === null
    ? background.clips
    : background.clips.filter((clip) => clip.id !== excludeClipId);
  if (clips.length === 0) return { ok: true };
  const projection: BackgroundTrack = excludeClipId === null
    ? background
    : { ...background, clips };
  let context: PhysicPaintRotoLoopResolutionContext;
  try {
    context = deriveEfxPaintBackgroundResolution(projection, BACKGROUND_RESOLUTION_CAPACITY);
  } catch {
    return { ok: false, reason: 'start-collision' };
  }
  for (const range of context.ranges) {
    if (range.placementStart <= landingFrame && landingFrame < range.effectiveEnd) {
      return { ok: false, reason: 'start-collision' };
    }
  }
  return { ok: true };
}

/** Stable document order: clips sorted by startFrame ascending (render order). */
function _sortClipsByStartFrame(clips: readonly FrameLoopClip[]): readonly FrameLoopClip[] {
  return [...clips].sort((a, b) => a.startFrame - b.startFrame);
}

/**
 * Add one Background Loop Clip (BKG-03, D-04). Rejects fail-closed on an absent
 * document, an invalid landing frame, empty/invalid source refs, an invalid
 * repeat, or a landing strictly inside an existing clip. A clip longer than
 * the gap to the next clip commits with its data intact — interruption is a
 * resolver/render concern, never a stored-data truncation (BKG-03/D-03). The
 * new clip gets a fresh UUID and `sourceKind: 'imported-background'`; the clips
 * array is re-sorted by startFrame. Always allocates a fresh clip id — repeat
 * imports of the same refs are distinct clips (BKG-09).
 */
export function addBackgroundClip(
  layerId: string,
  input: { startFrame: number; sourceFrameRefs: readonly string[]; repeat: FrameLoopClipRepeat },
): BackgroundClipMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'clip-not-found' };
  if (!_isValidSourceRefs(input.sourceFrameRefs)) return { ok: false, reason: 'invalid-source-refs' };
  if (!_isValidRepeat(input.repeat)) return { ok: false, reason: 'invalid-repeat' };
  const verdict = _backgroundCollisionVerdict(document.background, input.startFrame, null);
  if (!verdict.ok) return verdict;
  const clipId = crypto.randomUUID();
  const newClip: FrameLoopClip = {
    id: clipId,
    startFrame: input.startFrame,
    sourceFrameRefs: Object.freeze([...input.sourceFrameRefs]),
    repeat: input.repeat,
    sourceKind: 'imported-background',
    revision: 0,
    // 49-06 (UAT round 9): a fresh clip starts at 100/100 — the image draws
    // contain-fit (no ratio deformation), centered, at its natural fit size.
    scale: Object.freeze({ x: 100, y: 100 }),
  };
  const candidate: EfxPaintDocument = {
    ...document,
    background: {
      ...document.background,
      clips: _sortClipsByStartFrame([...document.background.clips, newClip]),
    },
  };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    clipId,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'add-background-clip',
      before: document,
      after: next,
    },
  };
}

/**
 * Move one Background Loop Clip to a new start frame (BKG-03/D-04, drag path).
 * The collision verdict excludes the moved clip's own extent. A move to the
 * clip's current position is a no-op (no revision bump, no dirty, no undo
 * record). Rejects fail-closed on an absent document, unknown clip, invalid
 * landing frame, or a landing strictly inside another clip.
 */
export function moveBackgroundClip(
  layerId: string,
  clipId: string,
  startFrame: number,
): BackgroundClipMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'clip-not-found' };
  if (!document.background.clips.some((candidate) => candidate.id === clipId)) {
    return { ok: false, reason: 'clip-not-found' };
  }
  const verdict = _backgroundCollisionVerdict(document.background, startFrame, clipId);
  if (!verdict.ok) return verdict;
  const candidate: EfxPaintDocument = {
    ...document,
    background: {
      ...document.background,
      clips: _sortClipsByStartFrame(
        document.background.clips.map((clip) => (clip.id === clipId ? { ...clip, startFrame } : clip)),
      ),
    },
  };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) {
    return { ok: true, clipId, descriptor: null };
  }
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    clipId,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'move-background-clip',
      before: document,
      after: next,
    },
  };
}

/**
 * Set one Background Loop Clip's repeat (BKG-04). Accepts finite integers >= 1
 * and `{ mode: 'infinite' }`; 0, negative, non-integer, and non-finite counts
 * are rejected uncommitted with the prior value preserved. A same-value write
 * is a revision-stable no-op (BKG-09). A repeat change never reorders clips or
 * moves any other clip — only the edited clip's effective extent changes.
 */
export function setBackgroundClipRepeat(
  layerId: string,
  clipId: string,
  repeat: FrameLoopClipRepeat,
): BackgroundClipMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'clip-not-found' };
  if (!document.background.clips.some((candidate) => candidate.id === clipId)) {
    return { ok: false, reason: 'clip-not-found' };
  }
  if (!_isValidRepeat(repeat)) return { ok: false, reason: 'invalid-repeat' };
  const candidate: EfxPaintDocument = {
    ...document,
    background: {
      ...document.background,
      clips: _sortClipsByStartFrame(
        document.background.clips.map((clip) => (clip.id === clipId ? { ...clip, repeat } : clip)),
      ),
    },
  };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) {
    return { ok: true, clipId, descriptor: null };
  }
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    clipId,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'set-background-clip-repeat',
      before: document,
      after: next,
    },
  };
}

/**
 * Set one Background Loop Clip's draw scale (49-06 UAT round 9): the contain-fit
 * percentages (100 = the image scaled to fit the project canvas preserving its
 * aspect ratio). x and y scale independently; the right-panel Global % control
 * sets both to the same value. Rejects fail-closed on an absent document,
 * unknown clip, or non-finite/non-positive percentages. A same-value write is a
 * revision-stable no-op (BKG-09).
 */
export function setBackgroundClipScale(
  layerId: string,
  clipId: string,
  scale: FrameLoopClipScale,
): BackgroundClipMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'clip-not-found' };
  if (!document.background.clips.some((candidate) => candidate.id === clipId)) {
    return { ok: false, reason: 'clip-not-found' };
  }
  if (!_isValidScale(scale)) return { ok: false, reason: 'invalid-scale' };
  const candidate: EfxPaintDocument = {
    ...document,
    background: {
      ...document.background,
      clips: _sortClipsByStartFrame(
        document.background.clips.map((clip) =>
          clip.id === clipId ? { ...clip, scale: Object.freeze({ x: scale.x, y: scale.y }) } : clip,
        ),
      ),
    },
  };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) {
    return { ok: true, clipId, descriptor: null };
  }
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    clipId,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'set-background-clip-scale',
      before: document,
      after: next,
    },
  };
}

/**
 * Resize one Background Loop Clip's START edge (49-06 UAT round 3): the new
 * start frame AND the repeat that keeps the clip's END fixed are committed in
 * ONE atomic document mutation with a single verdict — the strip derives the
 * repeat from the resolver's cycle length (capsule-never-math: the store never
 * computes loop math, it applies the caller's repeat). The collision verdict
 * excludes the resized clip's own extent and rejects only when the new start
 * lands strictly inside another clip. A same-value write is a revision-stable
 * no-op (BKG-09).
 */
export function resizeBackgroundClip(
  layerId: string,
  clipId: string,
  startFrame: number,
  repeat: FrameLoopClipRepeat,
): BackgroundClipMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'clip-not-found' };
  if (!document.background.clips.some((candidate) => candidate.id === clipId)) {
    return { ok: false, reason: 'clip-not-found' };
  }
  if (!_isValidRepeat(repeat)) return { ok: false, reason: 'invalid-repeat' };
  const verdict = _backgroundCollisionVerdict(document.background, startFrame, clipId);
  if (!verdict.ok) return verdict;
  const candidate: EfxPaintDocument = {
    ...document,
    background: {
      ...document.background,
      clips: _sortClipsByStartFrame(
        document.background.clips.map((clip) =>
          clip.id === clipId ? { ...clip, startFrame, repeat } : clip,
        ),
      ),
    },
  };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) {
    return { ok: true, clipId, descriptor: null };
  }
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    clipId,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'resize-background-clip',
      before: document,
      after: next,
    },
  };
}

/**
 * Replace one Background Loop Clip's source refs (49-06 UAT round 7: the
 * user's "replace any image" gap). The clip keeps its id/startFrame/repeat;
 * only the source cycle changes. Bumps the clip's `revision` so the flattened
 * key's clip term rotates and the composite re-renders with the new source.
 * Rejects fail-closed on an absent document, unknown clip, or invalid refs.
 */
export function setBackgroundClipSource(
  layerId: string,
  clipId: string,
  sourceFrameRefs: readonly string[],
): BackgroundClipMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'clip-not-found' };
  if (!document.background.clips.some((candidate) => candidate.id === clipId)) {
    return { ok: false, reason: 'clip-not-found' };
  }
  if (!_isValidSourceRefs(sourceFrameRefs)) return { ok: false, reason: 'invalid-source-refs' };
  const candidate: EfxPaintDocument = {
    ...document,
    background: {
      ...document.background,
      clips: document.background.clips.map((clip) =>
        clip.id === clipId
          ? { ...clip, sourceFrameRefs: Object.freeze([...sourceFrameRefs]), revision: clip.revision + 1 }
          : clip,
      ),
    },
  };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) {
    return { ok: true, clipId, descriptor: null };
  }
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    clipId,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'set-background-clip-source',
      before: document,
      after: next,
    },
  };
}

/**
 * Delete one Background Loop Clip (BKG-08, D-08). One undo step restores the
 * deleted clip by reference with its original id/refs/repeat. Rejects
 * fail-closed on an absent document or unknown clip.
 */
export function deleteBackgroundClip(
  layerId: string,
  clipId: string,
): BackgroundClipMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'clip-not-found' };
  if (!document.background.clips.some((candidate) => candidate.id === clipId)) {
    return { ok: false, reason: 'clip-not-found' };
  }
  const candidate: EfxPaintDocument = {
    ...document,
    background: {
      ...document.background,
      clips: document.background.clips.filter((clip) => clip.id !== clipId),
    },
  };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    clipId,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'delete-background-clip',
      before: document,
      after: next,
    },
  };
}

/**
 * Set the Background track's document fallback (BKG-05 gap law). Accepts the
 * transparent/solid/paper union; a same-value write is a revision-stable no-op
 * (BKG-09, the setRotoBackgroundMetadata idempotence lesson). Rejects
 * fail-closed on an absent document or a malformed fallback value.
 */
export function setBackgroundFallback(
  layerId: string,
  fallback: BackgroundFallback,
): BackgroundFallbackMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'clip-not-found' };
  if (!_isValidFallback(fallback)) return { ok: false, reason: 'invalid-source-refs' };
  const candidate: EfxPaintDocument = {
    ...document,
    background: { ...document.background, fallback },
  };
  if (buildEfxPaintDocumentRevision(candidate) === buildEfxPaintDocumentRevision(document)) {
    return { ok: true, descriptor: null };
  }
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'set-background-fallback',
      before: document,
      after: next,
    },
  };
}

// ============================================================================
// Photo/reference track CRUD (50-02 Task 1)
// ============================================================================
//
// The photo/reference setters funnel every UI surface (picker confirm, ghost
// overlay) through the RESEARCH Pattern 1 field-class split:
// `setPhotoReferenceSource` is a DOCUMENT MUTATION — it creates/replaces the
// track, bumps the track `revision` AND the document `documentRevision`
// counter, and records by reference on the unified ledger via
// `recordBackgroundEdit` (operation kind `'set-photo-reference-source'`).
// `setPhotoReferenceVisible`, `setPhotoReferenceOpacity`,
// `setPhotoReferenceTransform`, and `setPhotoReferenceTransformLocked` are
// DISPLAY PREFERENCES — they persist on the track but record NO undo entry and
// do NOT bump the revision counter (D-11/D-12/D-13, the
// `_setTrackDisplayProperty` vs mutation-setter split). The Phase 50
// `setPhotoReferenceMode` mutation is REMOVED entirely (52-02, D-15 clean
// break) — no vestigial mode state.

/** Closed rejection-reason union for the photo/reference setters. */
export type PhotoReferenceMutationRejectionReason =
  | 'no-document'
  | 'no-photo-reference'
  | 'invalid-source-refs'
  | 'invalid-opacity'
  | 'invalid-transform';

/** Result of a photo/reference document mutation (source replace / mode switch). */
export type PhotoReferenceMutationResult =
  | { readonly ok: true; readonly descriptor: BackgroundEditDescriptor | null }
  | { readonly ok: false; readonly reason: PhotoReferenceMutationRejectionReason };

/** Result of a photo/reference display-preference setter (no undo, no revision bump). */
export type PhotoReferenceDisplayResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: PhotoReferenceMutationRejectionReason };

/** Ordered source-ref equality (D-02: order is meaningful — frame N → refs[N]). */
function _sameSourceRefs(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((ref, index) => ref === b[index]);
}

/** Fail-closed structural check of a PhotoReferenceTransform (D-13: five finite numbers). */
function _isValidTransform(transform: PhotoReferenceTransform): boolean {
  return Number.isFinite(transform.x)
    && Number.isFinite(transform.y)
    && Number.isFinite(transform.scaleX)
    && Number.isFinite(transform.scaleY)
    && Number.isFinite(transform.rotation);
}

/**
 * Shared display-preference setter body (D-11/D-12/D-13). Follows the
 * `_setTrackDisplayProperty` shape — fail-closed on absent document / absent
 * track, early no-op on an identical value, immutable next document,
 * `_documents.set` — but the write does NOT bump documentRevision or the track
 * revision (display prefs are not `buildEfxPaintDocumentRevision` terms) and
 * records NO undo entry. It fires the efxPaint dirty callback exactly once via
 * `_notifyChange` so the ghost overlay re-renders.
 */
function _setPhotoReferenceDisplayProperty(
  layerId: string,
  patch: (track: PhotoReferenceTrack) => PhotoReferenceTrack,
  isChanged: (track: PhotoReferenceTrack) => boolean,
): PhotoReferenceDisplayResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'no-document' };
  const track = document.photoReference;
  if (!track) return { ok: false, reason: 'no-photo-reference' };
  if (!isChanged(track)) return { ok: true };
  const next: EfxPaintDocument = { ...document, photoReference: patch(track) };
  _documents.set(layerId, next);
  _notifyChange();
  return { ok: true };
}

/**
 * Set (create or replace) the photo/reference source cycle (D-03). The first
 * call creates the track with the locked defaults (visibleInStudio true,
 * opacity 0.5, transform centered, transformLocked true, revision 0); a later
 * call REPLACES the source cycle, bumping the track `revision` AND the document
 * `documentRevision` counter, and records ONE undo entry by reference. A
 * same-source write is a no-op (no revision bump, no undo). Rejects fail-closed
 * on an absent document or invalid refs.
 */
export function setPhotoReferenceSource(
  layerId: string,
  sourceFrameRefs: readonly string[],
): PhotoReferenceMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'no-document' };
  if (!_isValidSourceRefs(sourceFrameRefs)) return { ok: false, reason: 'invalid-source-refs' };

  const existing = document.photoReference;
  if (existing === null) {
    const newTrack: PhotoReferenceTrack = Object.freeze({
      id: crypto.randomUUID(),
      sourceFrameRefs: Object.freeze([...sourceFrameRefs]),
      revision: 0,
      visibleInStudio: true,
      opacity: 0.5,
      transform: Object.freeze({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }),
      transformLocked: true,
    });
    const candidate: EfxPaintDocument = { ...document, photoReference: newTrack };
    const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
    _documents.set(layerId, next);
    _notifyChange();
    return {
      ok: true,
      descriptor: {
        operationId: crypto.randomUUID(),
        operationKind: 'set-photo-reference-source',
        before: document,
        after: next,
      },
    };
  }

  if (_sameSourceRefs(existing.sourceFrameRefs, sourceFrameRefs)) {
    return { ok: true, descriptor: null };
  }
  const candidate: EfxPaintDocument = {
    ...document,
    photoReference: {
      ...existing,
      sourceFrameRefs: Object.freeze([...sourceFrameRefs]),
      revision: existing.revision + 1,
    },
  };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'set-photo-reference-source',
      before: document,
      after: next,
    },
  };
}

/** Show/hide the photo/reference track in the Studio (D-11 — display preference). */
export function setPhotoReferenceVisible(layerId: string, visible: boolean): PhotoReferenceDisplayResult {
  return _setPhotoReferenceDisplayProperty(
    layerId,
    (track) => ({ ...track, visibleInStudio: visible }),
    (track) => track.visibleInStudio !== visible,
  );
}

/**
 * Set the photo/reference track's Studio opacity (D-12 — display preference).
 * Accepts 0..1 floats and stores them exactly; out-of-range finite values are
 * clamped into 0..1; non-finite values are rejected fail-closed.
 */
export function setPhotoReferenceOpacity(layerId: string, opacity: number): PhotoReferenceDisplayResult {
  if (!Number.isFinite(opacity)) return { ok: false, reason: 'invalid-opacity' };
  const clamped = Math.min(1, Math.max(0, opacity));
  return _setPhotoReferenceDisplayProperty(
    layerId,
    (track) => ({ ...track, opacity: clamped }),
    (track) => track.opacity !== clamped,
  );
}

/**
 * Set the photo/reference track's display transform (D-13 — display
 * preference). Rejects fail-closed on a non-finite field; a same-value write is
 * a no-op.
 */
export function setPhotoReferenceTransform(layerId: string, transform: PhotoReferenceTransform): PhotoReferenceDisplayResult {
  if (!_isValidTransform(transform)) return { ok: false, reason: 'invalid-transform' };
  return _setPhotoReferenceDisplayProperty(
    layerId,
    (track) => ({ ...track, transform: Object.freeze({ ...transform }) }),
    (track) => track.transform.x !== transform.x
      || track.transform.y !== transform.y
      || track.transform.scaleX !== transform.scaleX
      || track.transform.scaleY !== transform.scaleY
      || track.transform.rotation !== transform.rotation,
  );
}

/** Lock/unlock the photo/reference track's transform (D-13 — display preference). */
export function setPhotoReferenceTransformLocked(layerId: string, locked: boolean): PhotoReferenceDisplayResult {
  return _setPhotoReferenceDisplayProperty(
    layerId,
    (track) => ({ ...track, transformLocked: locked }),
    (track) => track.transformLocked !== locked,
  );
}

/**
 * Remove the photo/reference track entirely (D-03 remove). A DOCUMENT MUTATION —
 * sets `photoReference` back to null, bumps the document `documentRevision`
 * counter, and records ONE undo entry by reference (operation kind
 * `'clear-photo-reference'`). Undo restores the exact prior track object; redo
 * re-applies the null. Rejects fail-closed on an absent document or an already
 * absent track (no-op when there is nothing to remove).
 */
export function clearPhotoReference(layerId: string): PhotoReferenceMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'no-document' };
  if (document.photoReference === null) return { ok: false, reason: 'no-photo-reference' };
  const next: EfxPaintDocument = { ...document, photoReference: null, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'clear-photo-reference',
      before: document,
      after: next,
    },
  };
}

// ============================================================================
// Reveal rail CRUD (52-01 Task 1, D-01/D-03/D-11)
// ============================================================================
//
// The reveal rail is the 4th rail kind on the single track type: a
// `PhysicPaintRotoLoopClip`-shaped record with `railKind: 'reveal'` whose
// baked keys are the source cycle. Creating the rail IS the first bake (D-11):
// the mutation loads the library script snapshot, runs the bake commit path in
// physicPaintStore (which reads the reference via `_resolveReferenceSourceImage`
// and commits the baked `PhysicPaintRotoRealKeyRecord`s through the existing
// acknowledged physical-edit transaction), then builds the immutable next
// document with the new Loop Clip record and records ONE undo-ledger entry by
// reference (RVL-06).

/** Loads a library script snapshot by id for the reveal bake (D-10: the rail references the library script, never a copy). */
export type RevealRailScriptLoader = (scriptId: string) => Promise<RotoPaintScript | null>;

let _revealScriptLoader: RevealRailScriptLoader | null = null;

/** Inject the reveal script loader (wired from the SCRIPTS library controller). */
export function _setEfxPaintRevealScriptLoader(loader: RevealRailScriptLoader | null): void {
  _revealScriptLoader = loader;
}

/** Closed rejection-reason union for the reveal rail mutations. */
export type RevealRailMutationRejectionReason =
  | 'no-document'
  | 'no-photo-reference'
  | 'no-track'
  | 'script-loader-unavailable'
  | 'script-not-found'
  | 'invalid-variant'
  | 'invalid-span'
  | 'bake-failed'
  | 'loop-clip-failed';

/** Result of a reveal rail mutation (create/replay/delete/span). */
export type RevealRailMutationResult =
  | { readonly ok: true; readonly descriptor: BackgroundEditDescriptor | null }
  | { readonly ok: false; readonly reason: RevealRailMutationRejectionReason };

/**
 * Create a reveal rail on one track AND bake it in one action (D-11). Fail-closes
 * when the document, the photo reference, or the target track is absent (D-12
 * creation guard), when the variant is outside the locked union, when the span is
 * malformed, or when the library script cannot be loaded (D-13). The bake commit
 * path runs first (reference resolved frame-aligned, fail-closed on missing);
 * only after the keys are committed does the mutation build the next document
 * with the new `railKind: 'reveal'` Loop Clip record (sourceKeyIds = the baked
 * key ids), bump `documentRevision`, and record ONE `'reveal-create'` undo entry
 * by reference.
 */
export async function createRevealRail(
  layerId: string,
  input: {
    trackId: string;
    scriptId: string;
    variant: 'progressive' | 'static';
    startFrame: number;
    frameCount: number;
    /** G-52-3 (D-08): the repeat law surfaced at creation — same semantics as the Paint Rail. */
    repeat?: number | 'infinity';
    /** G-52-3 (D-09): the creation-time motion wiggle feeding the bake (both variants). */
    motion?: Readonly<{ deformation: number; position: number }>;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
  },
): Promise<RevealRailMutationResult> {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'no-document' };
  if (document.photoReference === null) return { ok: false, reason: 'no-photo-reference' };
  if (!document.tracks.some((candidate) => candidate.id === input.trackId)) return { ok: false, reason: 'no-track' };
  if (input.variant !== 'progressive' && input.variant !== 'static') return { ok: false, reason: 'invalid-variant' };
  if (!Number.isInteger(input.startFrame) || input.startFrame < 0) return { ok: false, reason: 'invalid-span' };
  if (!Number.isInteger(input.frameCount) || input.frameCount < 1) return { ok: false, reason: 'invalid-span' };
  if (input.repeat !== undefined && input.repeat !== 'infinity' && (!Number.isInteger(input.repeat) || input.repeat < 1)) return { ok: false, reason: 'invalid-span' };
  if (!_revealScriptLoader) return { ok: false, reason: 'script-loader-unavailable' };
  const script = await _revealScriptLoader(input.scriptId);
  if (!script) return { ok: false, reason: 'script-not-found' };

  // Creation IS the first bake (D-11): the bake commit path reads the reference
  // via `_resolveReferenceSourceImage` (frame-aligned, null-on-missing → fail-closed)
  // and commits the baked records through the acknowledged physical-edit transaction.
  const bakeMotion = input.motion ?? { deformation: 0, position: 0 };
  const bakeResult = await commitRevealBake({
    layerId,
    trackId: input.trackId,
    script,
    frameCount: input.frameCount,
    canonicalStart: input.startFrame,
    motion: bakeMotion,
    mode: input.variant,
    signal: input.signal ?? new AbortController().signal,
    onProgress: input.onProgress,
  });
  if (!bakeResult.ok) return { ok: false, reason: 'bake-failed' };

  // The rail record: a `PhysicPaintRotoLoopClip`-shaped member of the existing
  // family, discriminated by `railKind: 'reveal'` (D-03). The baked keys are the
  // source cycle; repeat/endless rides the same mutation law as the Paint Rail
  // (D-08, G-52-3) and the motion wiggle is frozen as provenance (D-09).
  const loopClip: PhysicPaintRotoLoopClip = {
    loopId: createPhysicPaintRotoKeyId(),
    placementStart: input.startFrame,
    sourceKeyIds: bakeResult.records.map((record) => record.keyId),
    repeat: input.repeat ?? 1,
    mode: input.variant,
    railKind: 'reveal',
    scriptId: input.scriptId,
    // 43-06 provenance is all-or-nothing: scriptId requires motion + overrideColor.
    motion: { ...bakeMotion },
    overrideColor: null,
  };
  const currentLoopClips = physicPaintStore.getRotoPhysicalLoopClips(layerId, input.trackId);
  const loopResult = physicPaintStore.replaceRotoPhysicalLoopClips(layerId, input.trackId, [...currentLoopClips, loopClip]);
  if (!loopResult.ok) return { ok: false, reason: 'loop-clip-failed' };

  // Build the immutable next document: re-project the target track's runtime
  // (the runtime is the authority — the baked keys + the new Loop Clip ride the
  // rotoPhysical projection), bump documentRevision, record the undo entry.
  const candidate: EfxPaintDocument = {
    ...document,
    tracks: document.tracks.map((current) => {
      if (current.id !== input.trackId) return current;
      const rotoPhysical = physicPaintStore.extractRuntimeStateForDocument(layerId, input.trackId).rotoPhysical;
      return { ...current, rotoPhysical };
    }),
  };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'reveal-create',
      before: document,
      after: next,
    },
  };
}

/** Locate the reveal rail record + its owning track id, or null when absent. */
function _findRevealRail(
  document: EfxPaintDocument,
  layerId: string,
  loopId: string,
): { trackId: string; clip: PhysicPaintRotoLoopClip } | null {
  for (const track of document.tracks) {
    const clips = physicPaintStore.getRotoPhysicalLoopClips(layerId, track.id);
    const found = clips.find((clip) => clip.loopId === loopId && clip.railKind === 'reveal');
    if (found) return { trackId: track.id, clip: found };
  }
  return null;
}

/** Re-project one track's runtime into the document rotoPhysical projection. */
function _projectTrackRotoPhysical(layerId: string, trackId: string): Pick<InternalPaintTrack, 'rotoPhysical'> {
  return { rotoPhysical: physicPaintStore.extractRuntimeStateForDocument(layerId, trackId).rotoPhysical };
}

/**
 * Replay a reveal rail (D-05/D-11): re-bakes the rail span from the current
 * script + reference, OVERWRITING every baked key in the span (hand edits are
 * replaced — recovery is via undo, never partial refresh). One undo-ledger
 * entry (`'reveal-replay'`) restores the prior baked keys including hand edits.
 * Fail-closes when the reference was removed after creation (D-12) or the
 * library script was deleted (D-13) — no keys written, existing keys untouched.
 */
export async function replayRevealRail(
  layerId: string,
  loopId: string,
  input: { signal?: AbortSignal; onProgress?: (completed: number, total: number) => void } = {},
): Promise<RevealRailMutationResult> {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'no-document' };
  if (document.photoReference === null) return { ok: false, reason: 'no-photo-reference' };
  const rail = _findRevealRail(document, layerId, loopId);
  if (!rail) return { ok: false, reason: 'no-track' };
  if (!_revealScriptLoader) return { ok: false, reason: 'script-loader-unavailable' };
  const script = await _revealScriptLoader(rail.clip.scriptId ?? '');
  if (!script) return { ok: false, reason: 'script-not-found' };

  const frameCount = rail.clip.sourceKeyIds.length;
  const bakeResult = await commitRevealBake({
    layerId,
    trackId: rail.trackId,
    script,
    frameCount,
    canonicalStart: rail.clip.placementStart,
    motion: rail.clip.motion ?? { deformation: 0, position: 0 },
    mode: rail.clip.mode,
    signal: input.signal ?? new AbortController().signal,
    onProgress: input.onProgress,
  });
  if (!bakeResult.ok) return { ok: false, reason: 'bake-failed' };

  const updatedClip: PhysicPaintRotoLoopClip = {
    ...rail.clip,
    sourceKeyIds: bakeResult.records.map((record) => record.keyId),
  };
  const currentClips = physicPaintStore.getRotoPhysicalLoopClips(layerId, rail.trackId);
  const loopResult = physicPaintStore.replaceRotoPhysicalLoopClips(
    layerId,
    rail.trackId,
    currentClips.map((clip) => (clip.loopId === loopId ? updatedClip : clip)),
  );
  if (!loopResult.ok) return { ok: false, reason: 'loop-clip-failed' };

  const candidate: EfxPaintDocument = {
    ...document,
    tracks: document.tracks.map((current) =>
      current.id === rail.trackId ? { ...current, ..._projectTrackRotoPhysical(layerId, rail.trackId) } : current,
    ),
  };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'reveal-replay',
      before: document,
      after: next,
    },
  };
}

/**
 * Delete a reveal rail (D-06): removes the rail AND its baked keys as one unit
 * (rail, baked keys, and span move and delete together). One undo-ledger entry
 * (`'reveal-delete'`) restores the whole unit by reference.
 */
export function deleteRevealRail(layerId: string, loopId: string): RevealRailMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'no-document' };
  const rail = _findRevealRail(document, layerId, loopId);
  if (!rail) return { ok: false, reason: 'no-track' };

  const currentClips = physicPaintStore.getRotoPhysicalLoopClips(layerId, rail.trackId);
  const loopResult = physicPaintStore.replaceRotoPhysicalLoopClips(
    layerId,
    rail.trackId,
    currentClips.filter((clip) => clip.loopId !== loopId),
  );
  if (!loopResult.ok) return { ok: false, reason: 'loop-clip-failed' };

  const keyIdSet = new Set(rail.clip.sourceKeyIds);
  const records = physicPaintStore.getRotoRealKeyRecords(layerId, rail.trackId);
  const remaining = records.filter((record) => !keyIdSet.has(record.keyId));
  const capacity = physicPaintStore.getRotoPhysicalCapacity(layerId, rail.trackId);
  const interpolation = physicPaintStore.getRotoPhysicalInterpolationState(layerId, rail.trackId);
  const recordResult = physicPaintStore.replaceRotoPhysicalRecords(layerId, rail.trackId, remaining, interpolation, capacity);
  if (!recordResult.ok) return { ok: false, reason: 'bake-failed' };

  const candidate: EfxPaintDocument = {
    ...document,
    tracks: document.tracks.map((current) =>
      current.id === rail.trackId ? { ...current, ..._projectTrackRotoPhysical(layerId, rail.trackId) } : current,
    ),
  };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'reveal-delete',
      before: document,
      after: next,
    },
  };
}

/**
 * Resize a reveal rail's span (D-07): SHORTENING deletes the baked keys now
 * outside the span (undo recovers); stretching keeps existing keys and leaves
 * the new frames empty until a voluntary Replay. One undo-ledger entry
 * (`'reveal-span'`) restores the prior span + keys by reference.
 */
export function resizeRevealRail(layerId: string, loopId: string, newEndExclusive: number): RevealRailMutationResult {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'no-document' };
  const rail = _findRevealRail(document, layerId, loopId);
  if (!rail) return { ok: false, reason: 'no-track' };
  if (!Number.isInteger(newEndExclusive) || newEndExclusive <= rail.clip.placementStart) {
    return { ok: false, reason: 'invalid-span' };
  }

  // Shorten deletes the baked keys now outside the span (D-07).
  const keyIdSet = new Set(rail.clip.sourceKeyIds);
  const records = physicPaintStore.getRotoRealKeyRecords(layerId, rail.trackId);
  const remaining = records.filter((record) => {
    if (!keyIdSet.has(record.keyId)) return true;
    return record.appFrame < newEndExclusive;
  });
  const capacity = physicPaintStore.getRotoPhysicalCapacity(layerId, rail.trackId);
  const interpolation = physicPaintStore.getRotoPhysicalInterpolationState(layerId, rail.trackId);
  const recordResult = physicPaintStore.replaceRotoPhysicalRecords(layerId, rail.trackId, remaining, interpolation, capacity);
  if (!recordResult.ok) return { ok: false, reason: 'bake-failed' };

  const survivingKeyIds = rail.clip.sourceKeyIds.filter((keyId) => remaining.some((record) => record.keyId === keyId));
  const updatedClip: PhysicPaintRotoLoopClip = { ...rail.clip, sourceKeyIds: survivingKeyIds };
  const currentClips = physicPaintStore.getRotoPhysicalLoopClips(layerId, rail.trackId);
  const loopResult = physicPaintStore.replaceRotoPhysicalLoopClips(
    layerId,
    rail.trackId,
    currentClips.map((clip) => (clip.loopId === loopId ? updatedClip : clip)),
  );
  if (!loopResult.ok) return { ok: false, reason: 'loop-clip-failed' };

  const candidate: EfxPaintDocument = {
    ...document,
    tracks: document.tracks.map((current) =>
      current.id === rail.trackId ? { ...current, ..._projectTrackRotoPhysical(layerId, rail.trackId) } : current,
    ),
  };
  const next: EfxPaintDocument = { ...candidate, documentRevision: document.documentRevision + 1 };
  _documents.set(layerId, next);
  _notifyChange();
  return {
    ok: true,
    descriptor: {
      operationId: crypto.randomUUID(),
      operationKind: 'reveal-span',
      before: document,
      after: next,
    },
  };
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
  // 49-02 Task 3 (BKG-09, Pitfall 5): async byte-warming of the background
  // source registry after registration — fire-and-forget; document
  // registration stays synchronous and pending decodes resolve conservatively
  // (null this tick, re-render on decode-complete). Registration is
  // runtime-only: no documentRevision bump, no undo record, no dirty callback.
  void hydrateBackgroundSourceImagesFromLibrary(document);
  // 50-02 Task 3 (REF-05): the parallel reference source-byte hydration — the
  // reopen path warms `_referenceSourceImages` so the ghost overlay resolves
  // the reference source frames after a project reopen. Same fire-and-forget
  // runtime-only contract as the background hydration.
  void hydrateReferenceSourceImagesFromLibrary(document);
}

/**
 * CR-01 fix (52-REVIEW / 52-VERIFICATION): re-sync the runtime store for a
 * background undo/redo restore. The four reveal mutations
 * (create/replay/delete/resize) write BOTH the document AND the runtime —
 * baked records through commitRevealBake, the rail clip through
 * replaceRotoPhysicalLoopClips. The shared 'background' undo/redo branch in
 * useRotoPhysicalEditHistory restores only the document by reference, so the
 * runtime kept rendering the orphaned rail (the Studio reads the rail list
 * from physicPaintStore.getRotoPhysicalLoopClips) and the next
 * serializeRuntimeIntoDocument re-projected the orphaned baked keys back into
 * the document — effectively undoing the undo.
 *
 * This is the track-scoped counterpart of {@link hydrateRuntimeFromDocument}:
 * it installs exactly the affected track's rotoPhysical (records + rail clips)
 * from the target document (`before` for undo, `after` for redo) into the
 * runtime with no frame bytes. The reveal baked keys are RECORD-level content
 * — their pixels ride the record payload dataUrl (inline PNG, validated by
 * `isRenderedPngDataUrl`) and the structural compositor path decodes them on
 * demand, so an empty frame-byte cache is correct and safe: the raster cache
 * is derived, never the source of truth. Installing track-scoped (never the
 * whole document) preserves other tracks' runtime records that may be ahead of
 * the document (in-flight edits not yet serialized), exactly like the physical
 * undo/redo path restores only the affected track.
 *
 * The affected track is the single track whose object identity differs between
 * `before` and `after` (the reveal mutations replace exactly one track's
 * rotoPhysical projection while every other track keeps reference identity).
 * Background entries that do not change any track's rotoPhysical (Phase 49
 * background clip edits, photo reference set/clear, background fallback) no-op
 * and return true — their undo path is untouched (BKG-08/D-08). Returns false
 * only when an affected track needs resyncing but the install fails; callers
 * fail the undo/redo closed (nothing restored, stacks untouched).
 */
export function resyncRuntimeForBackgroundEdit(
  descriptor: BackgroundEditDescriptor,
  direction: 'undo' | 'redo',
): boolean {
  const { before, after } = descriptor;
  if (before.tracks.length !== after.tracks.length) return true;
  const target = direction === 'undo' ? before : after;
  for (let index = 0; index < before.tracks.length; index += 1) {
    if (before.tracks[index] === after.tracks[index]) continue;
    const track = target.tracks[index];
    try {
      physicPaintStore.installRuntimeStateFromDocument(target.parentLayerId, track.id, {
        trackId: track.id,
        frames: new Map(),
        rotoPhysical: track.rotoPhysical,
      });
    } catch {
      return false;
    }
  }
  return true;
}
