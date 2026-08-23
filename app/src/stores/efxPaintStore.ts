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
import { buildEfxPaintFrameCachePath } from '../lib/efxPaintPersistence';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { physicPaintStore } from './physicPaintStore';

let _markProjectDirty: (() => void) | null = null;

/** Inject the project-dirty callback (wired by projectStore in 45-05). */
export function _setEfxPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

/** Counter-signal bumped on every document mutation (subscribe for reactivity). */
export const efxPaintVersion = signal(0);

const _documents = new Map<string, EfxPaintDocument>();

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

/** Empty the store and bump the version signal (project close hook). */
export function reset(): void {
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
