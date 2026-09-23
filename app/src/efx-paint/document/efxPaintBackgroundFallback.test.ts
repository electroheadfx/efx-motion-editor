import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument, type BackgroundFallback } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import { buildEfxPaintDocumentRevision, encodeCanonicalBackgroundFallback } from './efxPaintDocumentRevision';

/** Build a fresh document JSON whose background.fallback is replaced. */
function documentWithFallback(fallback: unknown): Record<string, unknown> {
  const document = JSON.parse(JSON.stringify(createEfxPaintDocument('layer-abc')));
  document.background.fallback = fallback;
  return document;
}

describe('BackgroundFallback paper mode round-trip (BKG-09)', () => {
  it('round-trips a paper fallback through JSON serialize/parse', () => {
    const document = documentWithFallback({
      mode: 'paper',
      texture: 'canvas2',
      paperGrain: true,
      grainStrength: 0.5,
    });
    const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document)));
    // 260923-bcm: the parser ALWAYS emits the normalized grain scale, so an
    // input without the member round-trips to grainScale 1.
    expect(parsed).toEqual({
      ...document,
      background: { ...document.background, fallback: { ...document.background.fallback, grainScale: 1 } },
    });
    expect(parsed.background.fallback).toMatchObject({ grainScale: 1 });
  });

  // 260923-bcm Task 1 (RED): the optional grain SCALE member on the paper
  // fallback — accepted in range, normalized to 1 when absent/invalid, and a
  // term of the canonical document revision encoder.
  it('260923-bcm: accepts an optional grainScale, normalizes absent/invalid to 1, and the encoder rotates on scale', () => {
    const scaled = documentWithFallback({
      mode: 'paper',
      texture: 'canvas2',
      paperGrain: true,
      grainStrength: 0.5,
      grainScale: 2,
    });
    const parsedScaled = parseEfxPaintDocument(JSON.parse(JSON.stringify(scaled)));
    expect(parsedScaled.background.fallback).toEqual({
      mode: 'paper', texture: 'canvas2', paperGrain: true, grainStrength: 0.5, grainScale: 2,
    });

    for (const bad of [0, -1, NaN, '2', 11]) {
      const invalid = documentWithFallback({
        mode: 'paper',
        texture: 'canvas1',
        paperGrain: true,
        grainStrength: 0.5,
        grainScale: bad,
      });
      expect(parseEfxPaintDocument(JSON.parse(JSON.stringify(invalid))).background.fallback).toMatchObject({ grainScale: 1 });
    }

    const paper = (grainScale?: number): BackgroundFallback => ({
      mode: 'paper',
      texture: 'canvas1',
      paperGrain: true,
      grainStrength: 0.45,
      ...(grainScale === undefined ? {} : { grainScale }),
    });
    expect(encodeCanonicalBackgroundFallback(paper(2))).not.toBe(encodeCanonicalBackgroundFallback(paper(1)));
    expect(encodeCanonicalBackgroundFallback(paper(2))).toBe(encodeCanonicalBackgroundFallback(paper(2)));
    expect(encodeCanonicalBackgroundFallback(paper())).toBe(encodeCanonicalBackgroundFallback(paper(1)));

    const revisionBase = buildEfxPaintDocumentRevision(documentWithFallback(paper(1)));
    expect(buildEfxPaintDocumentRevision(documentWithFallback(paper(2)))).not.toBe(revisionBase);
  });

  it('produces distinct canonical revisions for distinct paper textures and identical revisions for identical paper fallbacks', () => {
    const withCanvas1 = documentWithFallback({
      mode: 'paper',
      texture: 'canvas1',
      paperGrain: true,
      grainStrength: 0.5,
    });
    const withCanvas3 = JSON.parse(JSON.stringify(withCanvas1));
    withCanvas3.background.fallback.texture = 'canvas3';
    expect(buildEfxPaintDocumentRevision(withCanvas1)).not.toBe(buildEfxPaintDocumentRevision(withCanvas3));

    const withCanvas1Again = JSON.parse(JSON.stringify(withCanvas1));
    expect(buildEfxPaintDocumentRevision(withCanvas1)).toBe(buildEfxPaintDocumentRevision(withCanvas1Again));
  });

  it('throws at parse for a paper fallback missing paperGrain/grainStrength or with an unknown texture', () => {
    const missingMembers = documentWithFallback({ mode: 'paper', texture: 'canvas1' });
    expect(() => parseEfxPaintDocument(missingMembers)).toThrow(/paper fallback must contain/);

    const unknownTexture = documentWithFallback({
      mode: 'paper',
      texture: 'canvas9',
      paperGrain: true,
      grainStrength: 0.5,
    });
    expect(() => parseEfxPaintDocument(unknownTexture)).toThrow(/texture/);
  });
});

describe('BackgroundFallback White mapping gate (D-11)', () => {
  it('maps White to the solid arm with #ffffff and adds no distinct white literal', () => {
    const white = documentWithFallback({ mode: 'solid', color: '#ffffff' });
    const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(white)));
    expect(parsed).toEqual(white);

    // Allow-list assertion: the union carries exactly transparent, solid, paper —
    // a distinct 'white' literal must not exist (RESEARCH Open Q2 resolved).
    const whiteLiteral = documentWithFallback({ mode: 'white' });
    expect(() => parseEfxPaintDocument(whiteLiteral)).toThrow(/fallback.mode/);
  });
});

describe('BackgroundFallback grain edge validation (BKG-04 adjacency)', () => {
  it('round-trips grainStrength 0 and paperGrain false', () => {
    const zeroGrain = documentWithFallback({
      mode: 'paper',
      texture: 'canvas1',
      paperGrain: false,
      grainStrength: 0,
    });
    expect(parseEfxPaintDocument(JSON.parse(JSON.stringify(zeroGrain)))).toEqual(zeroGrain);
  });

  it('rejects negative, NaN, Infinity, and non-number grainStrength fail-closed', () => {
    const badValues: unknown[] = [-0.1, NaN, Infinity, '0.5'];
    for (const bad of badValues) {
      const badGrain = documentWithFallback({
        mode: 'paper',
        texture: 'canvas1',
        paperGrain: true,
        grainStrength: bad,
      });
      expect(() => parseEfxPaintDocument(badGrain)).toThrow(/grainStrength/);
    }
  });
});

describe('BackgroundFallback reserved and unknown mode rejection (D-11)', () => {
  it('rejects the reserved photo mode at parse', () => {
    const photo = documentWithFallback({ mode: 'photo' });
    expect(() => parseEfxPaintDocument(photo)).toThrow(/fallback.mode/);
  });

  it('rejects an unknown mode string at parse', () => {
    const unknown = documentWithFallback({ mode: 'striped' });
    expect(() => parseEfxPaintDocument(unknown)).toThrow(/fallback.mode/);
  });

  it('rejects a paper fallback with an extra member at parse', () => {
    const extraMember = documentWithFallback({
      mode: 'paper',
      texture: 'canvas1',
      paperGrain: true,
      grainStrength: 0.5,
      extra: true,
    });
    expect(() => parseEfxPaintDocument(extraMember)).toThrow(/paper fallback must contain/);
  });
});

describe('BackgroundFallback canonical revision stability (T-49-01-02)', () => {
  it('produces a canonical revision unchanged by JSON field reordering for a paper fallback', () => {
    const document = documentWithFallback({
      mode: 'paper',
      texture: 'canvas1',
      paperGrain: true,
      grainStrength: 0.5,
    });
    const canonical = JSON.parse(JSON.stringify(document));
    const reordered = JSON.parse(JSON.stringify({
      compositeRevision: 0,
      photoReference: null,
      background: {
        revision: 0,
        visible: true,
        fallback: { grainStrength: 0.5, paperGrain: true, texture: 'canvas1', mode: 'paper' },
        clips: [],
        id: canonical.background.id,
      },
      tracks: [{
        loopClips: [],
        rotoPhysical: null,
        frames: {},
        revision: 0,
        blendMode: 'normal',
        opacity: 1,
        solo: false,
        visible: true,
        order: 0,
        name: 'Track 1',
        id: canonical.tracks[0].id,
      }],
      activeTrackId: canonical.activeTrackId,
      documentRevision: 0,
      parentLayerId: 'layer-abc',
      version: 1,
    }));
    expect(buildEfxPaintDocumentRevision(reordered)).toBe(buildEfxPaintDocumentRevision(canonical));
  });
});
