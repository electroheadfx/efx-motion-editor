// ============================================================
//  64-18 (CR-02) — the light gesture coalescer.
//
//  One slider gesture emits a continuous one-field write stream
//  through `setDocumentLight` — that stream is the ONLY light
//  state, so the live sheet keeps re-lighting during the drag.
//  The unified ledger must receive exactly ONE entry per gesture:
//  the first descriptor of the gesture carries the pre-gesture
//  document, the release document closes the span, and the
//  operation id is always fresh. A gesture that ends on the same
//  canonical light (a drag out and back, or an absent light that
//  comes back as the explicit `DEFAULT_LIGHT`) records NOTHING.
//
//  Driven over the real store primitives: the descriptors and the
//  release document are store-issued, never hand-built.
// ============================================================

import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_LIGHT } from '@efxlab/efx-watercolor';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  getDocument,
  registerDocument,
  reset as resetEfxPaintStore,
  setDocumentLight,
  type BackgroundEditDescriptor,
} from '../../../stores/efxPaintStore';
import { coalesceLightGesture } from './documentLightGesture';

afterEach(() => {
  resetEfxPaintStore();
});

/** Drive one field through the store `n` times, returning the FIRST descriptor
 *  of the gesture (its `before` is the pre-gesture document). */
function dragAzimuth(layerId: string, values: readonly number[]): BackgroundEditDescriptor | null {
  let first: BackgroundEditDescriptor | null = null;
  for (const azimuth of values) {
    const result = setDocumentLight(layerId, { azimuth });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('the light write must be accepted');
    if (first === null) first = result.descriptor;
  }
  return first;
}

describe('64-18 coalesceLightGesture', () => {
  it('coalesces a thirty-write drag into ONE descriptor spanning the pre-gesture document', () => {
    const layerId = 'layer-64-18-span';
    registerDocument(createEfxPaintDocument(layerId));
    const before = getDocument(layerId)!;
    expect(before.light).toBeUndefined();

    const values = Array.from({ length: 30 }, (_unused, step) => 100 + step);
    const first = dragAzimuth(layerId, values);
    expect(first).not.toBeNull();
    if (!first) throw new Error('the first write of the drag must emit a descriptor');

    const release = getDocument(layerId)!;
    const coalesced = coalesceLightGesture(first, release);
    expect(coalesced).not.toBeNull();
    if (!coalesced) throw new Error('a real light change must produce exactly one entry');

    // The span: the FIRST write's before, the RELEASE document.
    expect(coalesced.before).toBe(before);
    expect(coalesced.after).toBe(release);
    expect(coalesced.operationKind).toBe('set-document-light');
    // A fresh operation id — never the first write's id.
    expect(coalesced.operationId).not.toBe(first.operationId);
    expect(coalesced.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns null when a drag lands back on the pre-gesture light', () => {
    const layerId = 'layer-64-18-back';
    registerDocument(createEfxPaintDocument(layerId));
    // Establish a non-default starting light: 100 out of 200/300/100.
    const baseline = setDocumentLight(layerId, { azimuth: 100 });
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) throw new Error('baseline must be accepted');
    expect(baseline.descriptor).not.toBeNull();

    const first = dragAzimuth(layerId, [110, 140, 180, 100]);
    expect(first).not.toBeNull();
    if (!first) throw new Error('the gesture must emit its first descriptor');

    const release = getDocument(layerId)!;
    expect(release.light!.azimuth).toBe(100);
    // The document moved dozens of revisions; the LEDGER must not move.
    expect(coalesceLightGesture(first, release)).toBeNull();
  });

  it('canonicalizes an absent light and an explicit DEFAULT_LIGHT to the same gesture', () => {
    const layerId = 'layer-64-18-default';
    registerDocument(createEfxPaintDocument(layerId));
    expect(getDocument(layerId)!.light).toBeUndefined();

    // Drag away from the (absent) default, then land exactly on it.
    const first = dragAzimuth(layerId, [200, 260]);
    expect(first).not.toBeNull();
    if (!first) throw new Error('the gesture must emit its first descriptor');
    const back = setDocumentLight(layerId, { ...DEFAULT_LIGHT });
    expect(back.ok).toBe(true);
    if (!back.ok) throw new Error('the return write must be accepted');

    const release = getDocument(layerId)!;
    expect(release.light).toEqual(DEFAULT_LIGHT);
    // Absent and explicit-default render the same pixels — and record nothing.
    expect(coalesceLightGesture(first, release)).toBeNull();
  });

  it('returns null for a null first descriptor or a null release document', () => {
    const layerId = 'layer-64-18-null';
    registerDocument(createEfxPaintDocument(layerId));
    expect(coalesceLightGesture(null, getDocument(layerId) ?? null)).toBeNull();
    const first = dragAzimuth(layerId, [170]);
    expect(first).not.toBeNull();
    expect(coalesceLightGesture(first, null)).toBeNull();
  });

  it('is pure: it mints a fresh id per call and never mutates its inputs', () => {
    const layerId = 'layer-64-18-pure';
    registerDocument(createEfxPaintDocument(layerId));
    const before = getDocument(layerId)!;
    const first = dragAzimuth(layerId, [90, 130]);
    if (!first) throw new Error('the gesture must emit its first descriptor');
    const release = getDocument(layerId)!;
    const releaseLight = release.light;
    const revision = release.documentRevision;

    const one = coalesceLightGesture(first, release);
    const two = coalesceLightGesture(first, release);
    expect(one).not.toBeNull();
    expect(two).not.toBeNull();
    if (!one || !two) throw new Error('a real light change must produce an entry');
    expect(one.operationId).not.toBe(two.operationId);
    expect(one.before).toBe(before);
    expect(two.before).toBe(before);
    expect(getDocument(layerId)).toBe(release);
    expect(release.documentRevision).toBe(revision);
    expect(release.light).toBe(releaseLight);
  });
});
