import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import { buildEfxPaintDocumentRevision } from './efxPaintDocumentRevision';

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
    expect(parsed).toEqual(document);
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
    expect(() => parseEfxPaintDocument(missingMembers)).toThrow(/paper fallback must contain exactly/);

    const unknownTexture = documentWithFallback({
      mode: 'paper',
      texture: 'canvas9',
      paperGrain: true,
      grainStrength: 0.5,
    });
    expect(() => parseEfxPaintDocument(unknownTexture)).toThrow(/texture/);
  });
});
