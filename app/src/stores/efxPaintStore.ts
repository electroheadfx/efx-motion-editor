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
 * Task 2). The document must own exactly one default Paint track; runtime
 * frames become deterministic CachedFrameReference sidecar refs and the
 * physical Roto state is carried as-is. `documentRevision` bumps by one only
 * when the projected content actually changed (the fingerprint includes the
 * current docrev, so the comparison is made on the same revision).
 */
export function serializeRuntimeIntoDocument(layerId: string): EfxPaintDocument {
  const document = getDocument(layerId);
  if (!document) throw new Error(`No EFX Paint document for layer "${layerId}".`);
  if (document.tracks.length !== 1 || document.tracks[0].id !== document.activeTrackId) {
    throw new Error(`EFX Paint document for layer "${layerId}" must have exactly one default Paint track.`);
  }
  const track = document.tracks[0];
  // 46-01: serialize the ACTIVE track's runtime (single-track document guard
  // above makes track[0] the active track).
  const runtime = physicPaintStore.extractRuntimeStateForDocument(layerId, document.activeTrackId);
  const frames: Record<number, CachedFrameReference> = {};
  for (const [appFrame, frame] of runtime.frames) {
    frames[appFrame] = {
      cachePath: buildEfxPaintFrameCachePath(layerId, frame),
      width: frame.width ?? 0,
      height: frame.height ?? 0,
    };
  }
  const candidate: EfxPaintDocument = {
    ...document,
    tracks: [{ ...track, frames, rotoPhysical: runtime.rotoPhysical }],
  };
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
 * maps (Phase 45-04 Task 2). The document must own exactly one default Paint
 * track; the caller supplies the hydrated runtime frame bytes (from the
 * persistence loader) alongside the document.
 */
export function hydrateRuntimeFromDocument(
  document: EfxPaintDocument,
  frames: ReadonlyMap<number, PhysicPaintRenderedFrame>,
): void {
  if (document.tracks.length !== 1 || document.tracks[0].id !== document.activeTrackId) {
    throw new Error(`EFX Paint document for layer "${document.parentLayerId}" must have exactly one default Paint track.`);
  }
  // 46-01: hydrate into the ACTIVE track's runtime maps.
  physicPaintStore.installRuntimeStateFromDocument(document.parentLayerId, document.activeTrackId, {
    frames,
    rotoPhysical: document.tracks[0].rotoPhysical,
  });
}
