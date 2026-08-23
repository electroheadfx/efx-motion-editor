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
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';

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
