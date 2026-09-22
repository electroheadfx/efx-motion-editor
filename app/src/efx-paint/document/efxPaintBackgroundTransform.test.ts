/**
 * quick 260922-rd4 Task 1 — RED behavioural pins for the Background display
 * transform ("background transform with the photo-reference tool").
 *
 * Legs:
 * - (s1) sync fingerprint rotates on a background-transform-only change
 *   (the Studio close/reopen carrier — the e21/ffh drop class).
 * - (s2) save fingerprint rotates on the same A/B pair (save dedup carrier).
 * - (p1) package roundtrip preserves `background.transform` + `transformLocked`.
 * - (st1) `setBackgroundTransform` writes the field with no revision bump and
 *   no undo descriptor (display-pref idiom).
 * - (ph1) photo-reference controls — the existing setter + sync-fingerprint
 *   behaviour stays green in the same run (reuse-no-fork / photo-unchanged).
 *
 * Controls and expected RED are recorded in the plan SUMMARY; this file is
 * test-only (TDD RED first — no production behaviour exists for s1/s2/st1 yet).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from './efxPaintDocument';
import type { EfxPaintDocument, PhotoReferenceTransform } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import {
  buildEfxPaintDocumentRevision,
  buildEfxPaintDocumentSyncFingerprint,
} from './efxPaintDocumentRevision';
import { buildEfxPaintSaveFingerprint } from '../../lib/efxPaintPersistence';
import type { EfxPaintDocumentSaveInput } from '../../lib/efxPaintPersistence';
import {
  _setEfxPaintMarkDirtyCallback,
  getDocument,
  registerDocument,
  reset,
  setBackgroundTransform,
  setPhotoReferenceSource,
  setPhotoReferenceTransform,
} from '../../stores/efxPaintStore';
import {
  _setPhysicPaintMarkDirtyCallback,
  physicPaintStore,
} from '../../stores/physicPaintStore';

/** Non-identity transform used by every RED leg (the (c1) values). */
const MOVED: PhotoReferenceTransform = { x: 40, y: -20, scaleX: 1.5, scaleY: 1.5, rotation: 0 };
const IDENTITY: PhotoReferenceTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

/**
 * The A/B pair for every rotation leg: BOTH documents derive from ONE factory
 * call (shared background/track UUIDs) and differ ONLY in
 * `background.transform` — two separate factory calls would mint fresh UUIDs
 * and make every comparison vacuously unequal.
 */
function makeBackgroundTransformPair(transform: PhotoReferenceTransform): {
  identity: EfxPaintDocument;
  moved: EfxPaintDocument;
} {
  const base = createEfxPaintDocument('layer-rd4');
  return {
    identity: { ...base, background: { ...base.background, transform: { ...IDENTITY }, transformLocked: true } },
    moved: { ...base, background: { ...base.background, transform: { ...transform }, transformLocked: true } },
  };
}

/** Factory document whose background carries EXACTLY the given transform (everything else identical). */
function makeBackgroundTransformDoc(transform: PhotoReferenceTransform, transformLocked = true): EfxPaintDocument {
  const base = createEfxPaintDocument('layer-rd4');
  return {
    ...base,
    background: {
      ...base.background,
      transform: { ...transform },
      transformLocked,
    },
  };
}

/** Save-fingerprint input shape: one layer, no runtime frames (document terms only). */
function saveInputs(document: EfxPaintDocument): ReadonlyMap<string, EfxPaintDocumentSaveInput> {
  return new Map([['layer-rd4', { document, frames: new Map() }]]);
}

describe('background transform — persistence rotation (260922-rd4 Task 1 RED)', () => {
  it('(s1) a background-transform-only change rotates the sync fingerprint — the canonical revision stays put by design', () => {
    const { identity: docA, moved: docB } = makeBackgroundTransformPair(MOVED);

    // Root-cause precondition: display preferences are excluded from the
    // canonical revision (D-07 vs D-11/D-12/D-13) — asserted so a future
    // revision widening fails loudly here instead of silently re-scoping s1.
    expect(buildEfxPaintDocumentRevision(docA)).toBe(buildEfxPaintDocumentRevision(docB));

    // THE RED: today the sync fingerprint = revision + photoDisplay only, so
    // the background transform is dropped and the two fingerprints match.
    expect(buildEfxPaintDocumentSyncFingerprint(docB))
      .not.toBe(buildEfxPaintDocumentSyncFingerprint(docA));
  });

  it('(s2) a background-transform-only change rotates the save fingerprint (save dedup must not skip it)', () => {
    const { identity: docA, moved: docB } = makeBackgroundTransformPair(MOVED);

    // THE RED: today the per-layer save term = layerId + document revision
    // only — the transform-only edit dedupes as a no-op save.
    expect(buildEfxPaintSaveFingerprint('/project', saveInputs(docB)))
      .not.toBe(buildEfxPaintSaveFingerprint('/project', saveInputs(docA)));
  });

  it('(p1) the package roundtrip preserves background.transform and transformLocked', () => {
    const docB = makeBackgroundTransformDoc(MOVED, false);
    const serialized = JSON.stringify(docB);
    const roundtripped = parseEfxPaintDocument(JSON.parse(serialized));

    expect(roundtripped.background.transform).toEqual(MOVED);
    expect(roundtripped.background.transformLocked).toBe(false);
  });

  it('(ph1) photo control — the photo setter still writes its transform and the sync fingerprint still rotates on a photo display change', () => {
    const layerId = 'layer-rd4-photo';
    registerDocument(createEfxPaintDocument(layerId));
    expect(setPhotoReferenceSource(layerId, ['a']).ok).toBe(true);
    expect(setPhotoReferenceTransform(layerId, { x: 1, y: 2, scaleX: 1.5, scaleY: 0.5, rotation: 45 }).ok).toBe(true);
    expect(getDocument(layerId)!.photoReference!.transform)
      .toEqual({ x: 1, y: 2, scaleX: 1.5, scaleY: 0.5, rotation: 45 });

    // One base → the pair differs ONLY in the photo transform (the real
    // control: the photoDisplay term is what rotates the fingerprint).
    const photoBase = createEfxPaintDocument('layer-rd4-photo-fp');
    const withPhotoTransform = (transform: PhotoReferenceTransform): EfxPaintDocument => ({
      ...photoBase,
      photoReference: {
        id: 'photo-1',
        sourceFrameRefs: Object.freeze(['a']),
        revision: 0,
        visibleInStudio: true,
        opacity: 0.5,
        transform: { ...transform },
        transformLocked: true,
      },
    });
    expect(buildEfxPaintDocumentSyncFingerprint(withPhotoTransform({ x: 12, y: -3, scaleX: 1.5, scaleY: 1.5, rotation: 0.25 })))
      .not.toBe(buildEfxPaintDocumentSyncFingerprint(withPhotoTransform(IDENTITY)));
  });
});

describe('setBackgroundTransform — display-pref setter (260922-rd4 Task 1 RED)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
  });

  it('(st1) writes the field with no documentRevision bump and no undo descriptor', () => {
    const layerId = 'layer-rd4-st1';
    registerDocument(createEfxPaintDocument(layerId));
    const docBefore = getDocument(layerId)!;
    const revBefore = docBefore.documentRevision;
    const dirty = vi.fn();
    _setEfxPaintMarkDirtyCallback(dirty);

    const result = setBackgroundTransform(layerId, MOVED);

    // Display-pref contract: success carries NO descriptor — the unified undo
    // ledger only receives explicit descriptors from call sites, so a
    // descriptor-less result is the "ledger length unchanged" guarantee.
    expect(result.ok).toBe(true);
    expect('descriptor' in result).toBe(false);
    expect(getDocument(layerId)!.documentRevision).toBe(revBefore);

    // THE RED: today the inert stub validates then returns without writing —
    // the field stays at the factory identity.
    expect(getDocument(layerId)!.background.transform).toEqual(MOVED);

    // The setter still fires the single dirty notification (display-pref
    // idiom notifies exactly once on a real write).
    expect(dirty).toHaveBeenCalledTimes(1);
  });
});
