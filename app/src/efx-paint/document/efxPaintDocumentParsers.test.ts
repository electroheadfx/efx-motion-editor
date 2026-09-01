import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import { buildEfxPaintDocumentRevision } from './efxPaintDocumentRevision';

interface MutablePhotoReferenceTrack {
  id: string;
  sourceFrameRefs: string[];
  mode: string;
  revision: number;
  visibleInStudio: boolean;
  opacity: number;
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  transformLocked: boolean;
  [key: string]: unknown;
}

function validPhotoReferenceTrack(): MutablePhotoReferenceTrack {
  return {
    id: 'photo-track-1',
    sourceFrameRefs: ['shot_1', 'shot_2'],
    mode: 'reference-only',
    revision: 0,
    visibleInStudio: true,
    opacity: 0.5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    transformLocked: true,
  };
}

function documentWithPhotoReference(
  track: MutablePhotoReferenceTrack = validPhotoReferenceTrack(),
): Record<string, unknown> {
  const document = JSON.parse(JSON.stringify(createEfxPaintDocument('layer-abc'))) as Record<string, unknown>;
  document.photoReference = track;
  return document;
}

describe('PhotoReferenceTrack round-trip, encoder, and fail-closed parse', () => {
  it('round-trips a valid PhotoReferenceTrack through serialize/parse (REF-05)', () => {
    const document = documentWithPhotoReference();
    const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed).toEqual(document);
  });

  it('mode changes the canonical revision; opacity does not (D-07 vs D-12)', () => {
    const base = documentWithPhotoReference();

    const referenceOnly = JSON.parse(JSON.stringify(base));
    referenceOnly.photoReference.mode = 'reference-only';
    const revealSource = JSON.parse(JSON.stringify(base));
    revealSource.photoReference.mode = 'reveal-source';
    expect(buildEfxPaintDocumentRevision(revealSource)).not.toBe(
      buildEfxPaintDocumentRevision(referenceOnly),
    );

    const opacity05 = JSON.parse(JSON.stringify(base));
    opacity05.photoReference.opacity = 0.5;
    const opacity08 = JSON.parse(JSON.stringify(base));
    opacity08.photoReference.opacity = 0.8;
    expect(buildEfxPaintDocumentRevision(opacity08)).toBe(
      buildEfxPaintDocumentRevision(opacity05),
    );
  });

  it('throws fail-closed on unknown mode, missing sourceFrameRefs, and negative revision (ASVS V5)', () => {
    expect(() =>
      parseEfxPaintDocument(documentWithPhotoReference({ ...validPhotoReferenceTrack(), mode: 'photo' })),
    ).toThrow(/mode/);

    const missingRefs = documentWithPhotoReference();
    const { sourceFrameRefs: _omitRefs, ...trackWithoutRefs } = missingRefs.photoReference as MutablePhotoReferenceTrack;
    missingRefs.photoReference = trackWithoutRefs;
    expect(() => parseEfxPaintDocument(missingRefs)).toThrow(/sourceFrameRefs/);

    expect(() =>
      parseEfxPaintDocument(documentWithPhotoReference({ ...validPhotoReferenceTrack(), revision: -1 })),
    ).toThrow(/revision/);
  });
});
