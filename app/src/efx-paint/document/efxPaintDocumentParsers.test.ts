import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import { buildEfxPaintDocumentRevision } from './efxPaintDocumentRevision';
import {
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
  parsePhysicPaintRotoPhysicalDocument,
} from '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { testWebpBytes } from '../../testUtils/testWebpBytes';
import { bytesToBase64 } from '../../lib/webpBytes';

interface MutablePhotoReferenceTrack {
  id: string;
  sourceFrameRefs: string[];
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

  it('opacity does not change the canonical revision (D-12)', () => {
    const base = documentWithPhotoReference();

    const opacity05 = JSON.parse(JSON.stringify(base));
    opacity05.photoReference.opacity = 0.5;
    const opacity08 = JSON.parse(JSON.stringify(base));
    opacity08.photoReference.opacity = 0.8;
    expect(buildEfxPaintDocumentRevision(opacity08)).toBe(
      buildEfxPaintDocumentRevision(opacity05),
    );
  });

  it('throws fail-closed on missing sourceFrameRefs and negative revision (ASVS V5)', () => {
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

// ---------------------------------------------------------------------------
// 52.2-02 Task 2 (D-06, D-07, Law 1): the persisted-shape parse mode.
//
// The on-disk door selects 'reference-only', so a persisted real-key-shaped
// record — a real key OR a group override, they share one record type and one
// parser — can only exist with a validated `frames/<layerId>/<keyId>.webp`
// media reference. The runtime default is unchanged: a bytes-carrying record,
// the shape every pre-save runtime record still is, keeps parsing.
// ---------------------------------------------------------------------------

const MEDIA_DIGEST_A = 'a'.repeat(64);
const MEDIA_DIGEST_B = 'b'.repeat(64);
const FRAME_MEDIA = Object.freeze({
  relativePath: 'frames/L1/K1.webp',
  digest: MEDIA_DIGEST_A,
  width: 10,
  height: 10,
});

function mediaRealKey(keyId: string, appFrame: number, media: unknown = FRAME_MEDIA) {
  return { kind: 'real-key' as const, keyId, appFrame, payload: { frameIndex: 0, appFrame, media } };
}

function bytesRealKey(keyId: string, appFrame: number) {
  return {
    kind: 'real-key' as const,
    keyId,
    appFrame,
    payload: { frameIndex: 0, appFrame, bytes: testWebpBytes(`persisted-${keyId}`), width: 10, height: 10 },
  };
}

function physicalDocument(realKeyRecords: readonly unknown[], groupOverrideRecords?: readonly unknown[]) {
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const revision = (() => {
    try {
      return buildPhysicPaintRotoPhysicalRevision(
        realKeyRecords,
        interpolation,
        [],
        [],
        groupOverrideRecords ?? [],
      );
    } catch {
      return 'invalid-fixture-revision';
    }
  })();
  return {
    capacity: 600,
    realKeyRecords,
    ...(groupOverrideRecords !== undefined ? { groupOverrideRecords } : {}),
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision,
    incomingInterpolationBreakKeyIds: [],
  };
}

/** A finite Group whose single frame override is owned by `ovr1` at frame 5. */
function groupClip() {
  return {
    loopId: 'group-1',
    placementStart: 0,
    sourceKeyIds: ['src1'],
    repeat: 1 as number | 'infinity',
    mode: 'progressive' as const,
    syncState: 'synchronized' as const,
    provenanceState: 'attached' as const,
    phaseOrigin: 0,
    originalEndExclusive: 10,
    visibleRanges: [{ start: 0, endExclusive: 10 }],
    frameOverrides: [{ appFrame: 5, keyId: 'ovr1' }],
  };
}

function groupOverrideDocument(groupOverrideRecords: readonly unknown[]) {
  // The ordinary real keys of a PERSISTED document carry media references too,
  // so the only shape under test in the group-override cases is the override.
  const realKeyRecords = [mediaRealKey('src1', 0)];
  const loopClips = [groupClip()];
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const revision = (() => {
    try {
      return buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, loopClips, [], groupOverrideRecords);
    } catch {
      return 'invalid-fixture-revision';
    }
  })();
  return {
    capacity: 600,
    realKeyRecords,
    groupOverrideRecords,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision,
    loopClips,
    incomingInterpolationBreakKeyIds: [],
  };
}

function documentWithTrackRoto(rotoPhysical: unknown): Record<string, unknown> {
  const document = JSON.parse(JSON.stringify(createEfxPaintDocument('layer-abc'))) as Record<string, unknown> & {
    tracks: Record<string, unknown>[];
  };
  document.tracks[0].rotoPhysical = rotoPhysical;
  return document;
}

describe('persisted-shape parse mode: media references (52.2-02, D-02 / D-07)', () => {
  it('accepts a real-key record carrying a validated media reference and fabricates no bytes', () => {
    const parsed = parsePhysicPaintRotoPhysicalDocument(
      physicalDocument([mediaRealKey('k1', 0)]),
      'reference-only',
    );
    expect(parsed.realKeyRecords).toHaveLength(1);
    expect(parsed.realKeyRecords[0].payload.media).toEqual(FRAME_MEDIA);
    expect(parsed.realKeyRecords[0].payload).not.toHaveProperty('bytes');
  });

  it('keeps width/height optional on a media reference and requires positive integers when present', () => {
    const referenceOnly = { relativePath: FRAME_MEDIA.relativePath, digest: MEDIA_DIGEST_A };
    expect(() =>
      parsePhysicPaintRotoPhysicalDocument(physicalDocument([mediaRealKey('k1', 0, referenceOnly)]), 'reference-only'),
    ).not.toThrow();
    for (const dimensions of [{ width: 0, height: 10 }, { width: 10, height: -1 }, { width: 2.5, height: 10 }]) {
      expect(() =>
        parsePhysicPaintRotoPhysicalDocument(
          physicalDocument([mediaRealKey('k1', 0, { ...FRAME_MEDIA, ...dimensions })]),
          'reference-only',
        ),
      ).toThrow();
    }
  });

  const REJECTED_MEDIA_REFERENCES: ReadonlyArray<readonly [string, unknown]> = [
    ['a traversal-shaped relativePath', { ...FRAME_MEDIA, relativePath: '../escape.webp' }],
    ['an absolute relativePath', { ...FRAME_MEDIA, relativePath: '/abs/escape.webp' }],
    ['a relativePath outside the frames tree', { ...FRAME_MEDIA, relativePath: 'images/a.webp' }],
    ['a digest that is not 64 hex characters', { ...FRAME_MEDIA, digest: 'deadbeef' }],
    ['an upper-case digest', { ...FRAME_MEDIA, digest: MEDIA_DIGEST_A.toUpperCase() }],
    ['an unknown media member', { ...FRAME_MEDIA, encoding: 'webp' }],
    ['a missing digest', { relativePath: FRAME_MEDIA.relativePath }],
    ['a non-record reference', 'frames/L1/K1.webp'],
  ];

  it.each(REJECTED_MEDIA_REFERENCES)('refuses %s in persisted mode', (_label, media) => {
    expect(() =>
      parsePhysicPaintRotoPhysicalDocument(physicalDocument([mediaRealKey('k1', 0, media)]), 'reference-only'),
    ).toThrow();
  });

  it('refuses a record carrying an inline raster payload (Law 1)', () => {
    const document = physicalDocument([bytesRealKey('k1', 0)]);
    expect(() => parsePhysicPaintRotoPhysicalDocument(document)).not.toThrow();
    expect(() => parsePhysicPaintRotoPhysicalDocument(document, 'reference-only')).toThrow();
  });
});

describe('runtime payload mode stays the default (52.2-02, T-52.2-08)', () => {
  it('still accepts a bytes-only record carrying no media', () => {
    const parsed = parsePhysicPaintRotoPhysicalDocument(physicalDocument([bytesRealKey('k1', 0)]));
    expect(parsed.realKeyRecords[0].payload.bytes).toBeInstanceOf(Uint8Array);
    expect(parsed.realKeyRecords[0].payload.media).toBeUndefined();
  });

  it('accepts a media-only record and refuses a record carrying neither or both', () => {
    expect(() => parsePhysicPaintRotoPhysicalDocument(physicalDocument([mediaRealKey('k1', 0)]))).not.toThrow();

    const neither = { kind: 'real-key' as const, keyId: 'k1', appFrame: 0, payload: { frameIndex: 0, appFrame: 0 } };
    expect(() => parsePhysicPaintRotoPhysicalDocument(physicalDocument([neither]))).toThrow();
    expect(() => parsePhysicPaintRotoPhysicalDocument(physicalDocument([neither]), 'reference-only')).toThrow();

    const both = {
      kind: 'real-key' as const,
      keyId: 'k1',
      appFrame: 0,
      payload: { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('both'), media: FRAME_MEDIA },
    };
    expect(() => parsePhysicPaintRotoPhysicalDocument(physicalDocument([both]))).toThrow();
    expect(() => parsePhysicPaintRotoPhysicalDocument(physicalDocument([both]), 'reference-only')).toThrow();
  });

  it('refuses an unknown payload member in both modes', () => {
    const unknownMember = {
      kind: 'real-key' as const,
      keyId: 'k1',
      appFrame: 0,
      payload: { frameIndex: 0, appFrame: 0, media: FRAME_MEDIA, sourceFrame: 0 },
    };
    expect(() => parsePhysicPaintRotoPhysicalDocument(physicalDocument([unknownMember]))).toThrow();
    expect(() => parsePhysicPaintRotoPhysicalDocument(physicalDocument([unknownMember]), 'reference-only')).toThrow();
  });
});

describe('group overrides share the record type, parser and mode (52.2-02, D-06)', () => {
  it('accepts a group override carrying a validated media reference in persisted mode', () => {
    const document = groupOverrideDocument([mediaRealKey('ovr1', 5)]);
    const parsed = parsePhysicPaintRotoPhysicalDocument(document, 'reference-only');
    expect(parsed.groupOverrideRecords).toHaveLength(1);
    expect(parsed.groupOverrideRecords![0].payload.media).toEqual(FRAME_MEDIA);
  });

  it('refuses a group override carrying an inline raster payload in persisted mode (Law 1)', () => {
    const document = groupOverrideDocument([bytesRealKey('ovr1', 5)]);
    expect(() => parsePhysicPaintRotoPhysicalDocument(document)).not.toThrow();
    expect(() => parsePhysicPaintRotoPhysicalDocument(document, 'reference-only')).toThrow();
  });

  it('refuses a group override whose media reference escapes frames/ or whose digest is malformed', () => {
    for (const media of [
      { ...FRAME_MEDIA, relativePath: '../escape.webp' },
      { ...FRAME_MEDIA, relativePath: 'images/a.webp' },
      { ...FRAME_MEDIA, digest: 'not-a-digest' },
    ]) {
      expect(() =>
        parsePhysicPaintRotoPhysicalDocument(groupOverrideDocument([mediaRealKey('ovr1', 5, media)]), 'reference-only'),
      ).toThrow();
    }
  });

  it('moves the content revision when only a group override media digest changes', () => {
    const records = [bytesRealKey('src1', 0)];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const loopClips = [groupClip()];
    const revisionA = buildPhysicPaintRotoPhysicalRevision(
      records,
      interpolation,
      loopClips,
      [],
      [mediaRealKey('ovr1', 5, { ...FRAME_MEDIA, digest: MEDIA_DIGEST_A })],
    );
    const revisionB = buildPhysicPaintRotoPhysicalRevision(
      records,
      interpolation,
      loopClips,
      [],
      [mediaRealKey('ovr1', 5, { ...FRAME_MEDIA, digest: MEDIA_DIGEST_B })],
    );
    expect(revisionA).not.toBe(revisionB);
  });
});

describe('the shared content encoding is total over both record shapes (52.2-02)', () => {
  it('revisions and project-equality fingerprints a reference-only record set without reading payload bytes', () => {
    const records = [mediaRealKey('k1', 0)];
    expect(() =>
      buildPhysicPaintRotoPhysicalRevision(records, { enabled: false, mode: 'duplicate' }, []),
    ).not.toThrow();
    expect(() => buildPhysicPaintRotoProjectEquality(physicalDocument(records))).not.toThrow();
  });

  it('keeps the persisted allowlist free of the inline raster key while the runtime allowlist admits it', async () => {
    const model = await import('../../components/physic-paint/roto/physicsPaintRotoPhysicalModel');
    expect([...model.PHYSIC_PAINT_ROTO_PERSISTED_REAL_KEY_PAYLOAD_KEYS].sort()).toEqual([
      'appFrame',
      'frameIndex',
      'height',
      'media',
      'width',
    ]);
    expect(model.PHYSIC_PAINT_ROTO_REAL_KEY_PAYLOAD_KEYS.has('bytes')).toBe(true);
  });
});

describe('the on-disk door selects the persisted mode (52.2-02, plan 09 reads through it)', () => {
  it('accepts a layer file whose real-key records carry media references', () => {
    const parsed = parseEfxPaintDocument(documentWithTrackRoto(physicalDocument([mediaRealKey('k1', 0)])), 'reference-only');
    expect(parsed.tracks[0].rotoPhysical?.realKeyRecords[0].payload.media).toEqual(FRAME_MEDIA);
  });

  it('refuses a layer file carrying an inline raster payload in either collection (Law 1)', () => {
    const payloadBytes = { frameIndex: 0, appFrame: 0, bytes: bytesToBase64(testWebpBytes('door')), width: 10, height: 10 };
    const inlineRecord = { kind: 'real-key' as const, keyId: 'k1', appFrame: 0, payload: payloadBytes };
    expect(() =>
      parseEfxPaintDocument(documentWithTrackRoto(physicalDocument([inlineRecord])), 'reference-only'),
    ).toThrow();

    const overrideWithPayload = {
      kind: 'real-key' as const,
      keyId: 'ovr1',
      appFrame: 5,
      payload: { ...payloadBytes, appFrame: 5 },
    };
    expect(() =>
      parseEfxPaintDocument(documentWithTrackRoto(groupOverrideDocument([overrideWithPayload])), 'reference-only'),
    ).toThrow();
  });

  // The save, fingerprint, launch and transport callers hand this same parser a
  // LIVE in-memory document, whose real-key payloads carry bytes until the save
  // funnel projects them onto media references. The default mode keeps accepting
  // that document, so the on-disk refusal above cannot break a save.
  it('keeps the runtime default for a live in-memory document carrying inline payloads', () => {
    const payloadBytes = { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('live'), width: 10, height: 10 };
    const inlineRecord = { kind: 'real-key' as const, keyId: 'k1', appFrame: 0, payload: payloadBytes };
    const parsed = parseEfxPaintDocument(documentWithTrackRoto(physicalDocument([inlineRecord])));
    expect(parsed.tracks[0].rotoPhysical?.realKeyRecords[0].payload.bytes).toBeInstanceOf(Uint8Array);
  });
});
