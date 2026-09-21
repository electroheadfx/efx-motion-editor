import { describe, expect, it } from 'vitest';
import type { EfxPaintDocument, PhotoReferenceTrack } from '../../../efx-paint/document/efxPaintDocument';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { buildEfxPaintDocumentRevision } from '../../../efx-paint/document/efxPaintDocumentRevision';
import { createDocumentSyncPushGuard } from './documentSyncPushGuard';

function paperVariant(doc: EfxPaintDocument): EfxPaintDocument {
  return {
    ...doc,
    background: { ...doc.background, fallback: { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0.1 } },
  };
}

function photoReference(overrides: Partial<PhotoReferenceTrack> = {}): PhotoReferenceTrack {
  return {
    id: 'guard-photo-ref',
    sourceFrameRefs: ['guard-ref-photo-1'],
    revision: 0,
    visibleInStudio: true,
    opacity: 1,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    transformLocked: false,
    ...overrides,
  };
}

function photoVariant(doc: EfxPaintDocument, reference: PhotoReferenceTrack): EfxPaintDocument {
  return { ...doc, photoReference: reference };
}

describe('createDocumentSyncPushGuard', () => {
  it('sends the first push even when the serialize is a no-op (launch / crash-recovery mount push)', () => {
    const guard = createDocumentSyncPushGuard();
    const doc = createEfxPaintDocument('layer-x');
    // Fresh session: the mount push must go out even though nothing changed —
    // after a reload the main window may hold an older mirror.
    expect(guard.evaluate(() => doc, () => 0)).toBe(doc);
  });

  it('skips a second consecutive push when the document content is unchanged', () => {
    const guard = createDocumentSyncPushGuard();
    const doc = createEfxPaintDocument('layer-x');
    expect(guard.evaluate(() => doc, () => 0)).toBe(doc);
    expect(guard.evaluate(() => doc, () => 0)).toBeNull();
  });

  it('sends again when a real mutation changed the document content', () => {
    const guard = createDocumentSyncPushGuard();
    const doc = createEfxPaintDocument('layer-x');
    expect(guard.evaluate(() => doc, () => 0)).toBe(doc);
    // Direct mutation (setBackgroundFallback shape): the LIVE document already
    // carries the paper fallback when the scheduled push serializes it — the
    // old before/after version heuristic dropped this. Content comparison must send it.
    expect(guard.evaluate(() => paperVariant(doc), () => 0)).not.toBeNull();
  });

  it('does not produce a duplicate after a segment apply (the #3/#4 pair)', () => {
    const guard = createDocumentSyncPushGuard();
    const doc = createEfxPaintDocument('layer-x');
    // Launch mount push.
    expect(guard.evaluate(() => doc, () => 0)).toBe(doc);
    // Segment/background apply: serialize returns the changed document → sends.
    expect(guard.evaluate(() => paperVariant(doc), () => 0)).not.toBeNull();
    // The bump re-fires the immediate push effect: serialize is now the same
    // changed document → skip.
    expect(guard.evaluate(() => paperVariant(doc), () => 0)).toBeNull();
  });

  it('returns null when the serialize produces no document', () => {
    const guard = createDocumentSyncPushGuard();
    expect(guard.evaluate(() => null, () => 0)).toBeNull();
  });
});

/**
 * debug studio-reopen-empty-boot (fix A, 2026-09-21): a photo-reference
 * DISPLAY-preference change (visibility / opacity / transform) is persisted
 * content that never bumps the canonical document revision — the revision
 * excludes those fields by design (D-07 vs D-11/D-12/D-13). The guard compared
 * the bare revision, so the change was deduped child-side (never pushed) and
 * the parent's register guard skipped it too — the display choice was lost on
 * Studio close. The fingerprint now appends the display term; these pins drive
 * the guard's real `evaluate` with two documents differing ONLY in display
 * fields, plus a duplicate control proving the guard still dedupes.
 */
describe('createDocumentSyncPushGuard — photo-reference display changes', () => {
  it('sends a visibility toggle that never bumps the canonical revision', () => {
    const guard = createDocumentSyncPushGuard();
    const base = createEfxPaintDocument('layer-x');
    const visible = photoVariant(base, photoReference({ visibleInStudio: true }));
    const hidden = photoVariant(base, photoReference({ visibleInStudio: false }));

    // Root-cause precondition, asserted so a future revision widening fails
    // loudly here instead of silently re-scoping the pin: the two documents
    // share one canonical revision — the display fields are excluded by design.
    expect(buildEfxPaintDocumentRevision(visible)).toBe(buildEfxPaintDocumentRevision(hidden));

    expect(guard.evaluate(() => visible, () => 0)).toBe(visible);
    // The display-only change MUST ship (was null under the revision-only guard).
    expect(guard.evaluate(() => hidden, () => 0)).toBe(hidden);
    // Control: an unchanged re-serialize is still a duplicate and is skipped.
    expect(guard.evaluate(() => hidden, () => 0)).toBeNull();
  });

  it('sends opacity and transform changes on the same latch', () => {
    const guard = createDocumentSyncPushGuard();
    const base = photoVariant(createEfxPaintDocument('layer-x'), photoReference());
    expect(guard.evaluate(() => base, () => 0)).toBe(base);

    const faded = photoVariant(base, photoReference({ opacity: 0.4 }));
    expect(guard.evaluate(() => faded, () => 0)).toBe(faded);

    const moved = photoVariant(base, photoReference({
      opacity: 0.4,
      transform: { x: 12, y: -3, scaleX: 1.5, scaleY: 1.5, rotation: 0.25 },
    }));
    expect(guard.evaluate(() => moved, () => 0)).toBe(moved);

    // Control: after both display pushes, the same document dedupes again.
    expect(guard.evaluate(() => moved, () => 0)).toBeNull();
  });
});
