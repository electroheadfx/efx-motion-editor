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

describe('PhotoReferenceTrack edge cases', () => {
  it('round-trips each mode and rejects photo and empty-string modes (D-05, D-08)', () => {
    for (const mode of ['reference-only', 'reveal-source', 'masked-transform-source']) {
      const document = documentWithPhotoReference({ ...validPhotoReferenceTrack(), mode });
      const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document)));
      expect(parsed.photoReference?.mode).toBe(mode);
    }
    expect(() =>
      parseEfxPaintDocument(documentWithPhotoReference({ ...validPhotoReferenceTrack(), mode: 'photo' })),
    ).toThrow(/mode/);
    expect(() =>
      parseEfxPaintDocument(documentWithPhotoReference({ ...validPhotoReferenceTrack(), mode: '' })),
    ).toThrow(/mode/);
  });

  it('round-trips boundary opacity and rejects out-of-range/non-finite/non-number (D-12)', () => {
    for (const opacity of [0, 1]) {
      const document = documentWithPhotoReference({ ...validPhotoReferenceTrack(), opacity });
      const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document)));
      expect(parsed.photoReference?.opacity).toBe(opacity);
    }
    for (const opacity of [-0.1, 1.1]) {
      expect(() =>
        parseEfxPaintDocument(documentWithPhotoReference({ ...validPhotoReferenceTrack(), opacity })),
      ).toThrow(/opacity/);
    }
    for (const opacity of [NaN, Infinity]) {
      const document = documentWithPhotoReference();
      (document.photoReference as Record<string, unknown>).opacity = opacity;
      expect(() => parseEfxPaintDocument(document)).toThrow(/opacity/);
    }
    const nonNumber = documentWithPhotoReference();
    (nonNumber.photoReference as Record<string, unknown>).opacity = '0.5';
    expect(() => parseEfxPaintDocument(nonNumber)).toThrow(/opacity/);
  });

  it('round-trips negative scale and rotation, rejects missing rotation and non-finite x (D-13)', () => {
    const document = documentWithPhotoReference({
      ...validPhotoReferenceTrack(),
      transform: { x: 10, y: -5, scaleX: -1, scaleY: 2, rotation: 45 },
    });
    const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed.photoReference?.transform).toEqual({ x: 10, y: -5, scaleX: -1, scaleY: 2, rotation: 45 });

    const missingRotation = documentWithPhotoReference();
    (missingRotation.photoReference as Record<string, unknown>).transform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    expect(() => parseEfxPaintDocument(missingRotation)).toThrow(/transform/);

    const nonFiniteX = documentWithPhotoReference();
    (nonFiniteX.photoReference as Record<string, unknown>).transform = { x: Infinity, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    expect(() => parseEfxPaintDocument(nonFiniteX)).toThrow(/transform/);
  });

  it('revision is stable under field reordering; null photoReference parses to null (D-07)', () => {
    const document = documentWithPhotoReference();
    const canonical = buildEfxPaintDocumentRevision(document);

    const reordered = JSON.parse(JSON.stringify(document));
    const track = reordered.photoReference;
    reordered.photoReference = {
      transformLocked: track.transformLocked,
      transform: track.transform,
      opacity: track.opacity,
      visibleInStudio: track.visibleInStudio,
      revision: track.revision,
      mode: track.mode,
      sourceFrameRefs: track.sourceFrameRefs,
      id: track.id,
    };
    expect(buildEfxPaintDocumentRevision(reordered)).toBe(canonical);

    const nullDoc = JSON.parse(JSON.stringify(createEfxPaintDocument('layer-abc')));
    expect(parseEfxPaintDocument(nullDoc).photoReference).toBeNull();
    expect(buildEfxPaintDocumentRevision(nullDoc)).toBe(
      buildEfxPaintDocumentRevision(JSON.parse(JSON.stringify(nullDoc))),
    );
  });
});
