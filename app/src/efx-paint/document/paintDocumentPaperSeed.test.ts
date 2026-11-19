/**
 * Phase 64-21 (MED-02) — the paint-layer document's optional `paperSeed`.
 *
 * Laws under test:
 * - an ABSENT seed stays absent through parse and re-encode: no `paperSeed`
 *   key is manufactured, so an untouched pre-milestone project saves
 *   byte-identically;
 * - a PRESENT seed is exactly one finite number in the engine's `[0, 1)`
 *   band and round-trips unchanged (0 is the inclusive lower edge);
 * - anything else fails closed at parse — `null` is NOT absence, and a
 *   non-number, a non-finite number or an out-of-band value throws (never
 *   silently hydrates or clamps);
 * - the absent-seed fallback `derivePaperSeed` is the FNV-1a 32-bit law:
 *   deterministic, inside `[0, 1)`, distinct per layer id — one sheet per
 *   layer, derived not stored, so an old project replays on one
 *   deterministic grain with no migration and no document write.
 *
 * Pinned against the published FNV-1a test vectors ("a" = 0xe40c292c,
 * "foobar" = 0xbf9cf968) plus the offset-basis empty string, so any
 * algorithm drift fails here instead of silently re-rolling every sheet.
 */
import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument, derivePaperSeed } from './efxPaintDocument';
import type { EfxPaintDocument } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';

function baseDocument(): EfxPaintDocument {
  return createEfxPaintDocument('layer-paper-seed');
}

/** A factory-produced document JSON carrying exactly the given `paperSeed` value. */
function documentJsonWithPaperSeed(paperSeed: unknown): Record<string, unknown> {
  return { ...JSON.parse(JSON.stringify(baseDocument())), paperSeed };
}

/** The thrown message, or a failure when the parser unexpectedly accepted the value. */
function parseError(value: unknown): string {
  try {
    parseEfxPaintDocument(value);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected parseEfxPaintDocument to throw');
}

describe('paint-layer document paperSeed (MED-02)', () => {
  it('keeps an absent seed absent through parse and re-encode', () => {
    const document = baseDocument();
    const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document)));

    expect('paperSeed' in parsed).toBe(false);
    expect(parsed.paperSeed).toBeUndefined();
    // Byte identity: the untouched document re-encodes to the same JSON and
    // never grows a manufactured `paperSeed` key.
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(document));
    expect(JSON.stringify(parsed)).not.toContain('"paperSeed"');
  });

  it('treats an explicit undefined as absent and still manufactures nothing', () => {
    const document = baseDocument();
    const parsed = parseEfxPaintDocument({ ...JSON.parse(JSON.stringify(document)), paperSeed: undefined });

    expect('paperSeed' in parsed).toBe(false);
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(document));
  });

  it('round-trips a valid seed unchanged', () => {
    const parsed = parseEfxPaintDocument(documentJsonWithPaperSeed(0.25));

    expect(parsed.paperSeed).toBe(0.25);
    expect(JSON.parse(JSON.stringify(parsed)).paperSeed).toBe(0.25);
  });

  it('accepts the band edges: 0 inclusive, just below 1 exclusive', () => {
    expect(parseEfxPaintDocument(documentJsonWithPaperSeed(0)).paperSeed).toBe(0);
    const upper = 1 - Number.EPSILON;
    expect(parseEfxPaintDocument(documentJsonWithPaperSeed(upper)).paperSeed).toBe(upper);
  });

  it.each([
    ['a string', '0.5'],
    ['a boolean', true],
    ['an object', {}],
    ['an array', []],
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
    ['a negative seed', -0.1],
    ['minus one', -1],
    ['exactly one', 1],
    ['above one', 1.5],
  ])('rejects %s', (_label, value) => {
    const message = parseError(documentJsonWithPaperSeed(value));

    expect(message.toLowerCase()).toContain('paperseed');
  });

  it('rejects a null seed instead of coercing it to absent', () => {
    const message = parseError(documentJsonWithPaperSeed(null));

    expect(message.toLowerCase()).toContain('paperseed');
  });
});

describe('derivePaperSeed — the absent-seed fallback (MED-02)', () => {
  const CORPUS = [
    'layer-a',
    '',
    'layer-paper-seed',
    '0f0e0d0c-0b0a-4009-8007-000504030201',
    'Couche — peinture',
  ];

  it('is deterministic across calls for every layer id', () => {
    for (const id of CORPUS) {
      expect(derivePaperSeed(id), `derivePaperSeed('${id}')`).toBe(derivePaperSeed(id));
    }
  });

  it('stays inside the engine band [0, 1) for every layer id', () => {
    for (const id of CORPUS) {
      const seed = derivePaperSeed(id);
      expect(seed, `derivePaperSeed('${id}') lower bound`).toBeGreaterThanOrEqual(0);
      expect(seed, `derivePaperSeed('${id}') upper bound`).toBeLessThan(1);
    }
  });

  it('derives a distinct sheet per layer id', () => {
    const seeds = CORPUS.map((id) => derivePaperSeed(id));
    expect(new Set(seeds).size).toBe(CORPUS.length);
  });

  it('is the FNV-1a 32-bit law over UTF-16 code units, divided by 2^32', () => {
    // Published FNV-1a 32-bit test vectors — independent of this repository.
    expect(derivePaperSeed('a')).toBe(0xe40c292c / 0x100000000);
    expect(derivePaperSeed('foobar')).toBe(0xbf9cf968 / 0x100000000);
    // The empty string is the offset basis itself.
    expect(derivePaperSeed('')).toBe(0x811c9dc5 / 0x100000000);
    // A repository id, pinned as a literal (the /2^32 mapping is exact).
    expect(derivePaperSeed('layer-a')).toBe(0.2531549856066704);
  });
});
