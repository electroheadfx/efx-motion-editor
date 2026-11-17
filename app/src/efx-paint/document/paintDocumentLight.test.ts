/**
 * Phase 64-05 (MED-17) — the paint-layer document's optional `light` member.
 *
 * Laws under test:
 * - an ABSENT light stays absent through parse and re-encode: no `light` key is
 *   manufactured, so an untouched pre-milestone project saves byte-identically;
 * - a PRESENT light is a frozen record of exactly azimuth, elevation and
 *   intensity, and round-trips unchanged;
 * - anything else fails closed at parse — an unknown member, a missing member,
 *   a non-finite number, an out-of-range value or `null` throws (never silently
 *   hydrates);
 * - the shape and the default are single-sourced from the engine package
 *   (`LightSettings` / `DEFAULT_LIGHT`) — the app never retypes them.
 *
 * TDD RED first: the assertions below fail against the pre-plan parser, whose
 * document allowlist rejects `light` as an unknown member. Dynamic imports are
 * avoided because every symbol used here is expected to exist on the pure model
 * module — the RED failure is the parser refusing the member, which is the
 * planned behaviour gap, not a loader fault.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIGHT } from '@efxlab/efx-watercolor';
import type { LightSettings } from '@efxlab/efx-watercolor';
import { createEfxPaintDocument } from './efxPaintDocument';
import type { EfxPaintDocument, PaintDocumentLight } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';

const VALID_LIGHT: LightSettings = { azimuth: 210, elevation: 45, intensity: 2 };

/** Structural view of the document once the optional member is admitted. */
interface DocumentWithLight extends EfxPaintDocument {
  readonly light?: LightSettings;
}

function baseDocument(): EfxPaintDocument {
  return createEfxPaintDocument('layer-light');
}

/** A factory-produced document JSON carrying exactly the given `light` value. */
function documentJsonWithLight(light: unknown): Record<string, unknown> {
  return { ...JSON.parse(JSON.stringify(baseDocument())), light };
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

describe('paint-layer document light (MED-17)', () => {
  it('keeps an absent light absent through parse and re-encode', () => {
    const document = baseDocument();
    const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document))) as DocumentWithLight;

    expect('light' in parsed).toBe(false);
    expect(parsed.light).toBeUndefined();
    // Byte identity: the untouched document re-encodes to the same JSON and
    // never grows a manufactured `light` key.
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(document));
    expect(JSON.stringify(parsed)).not.toContain('"light"');
  });

  it('round-trips a valid light unchanged and freezes it', () => {
    const parsed = parseEfxPaintDocument(documentJsonWithLight({ ...VALID_LIGHT })) as DocumentWithLight;

    expect(parsed.light).toEqual(VALID_LIGHT);
    expect(Object.isFrozen(parsed.light)).toBe(true);
    expect(JSON.parse(JSON.stringify(parsed)).light).toEqual(VALID_LIGHT);
  });

  it('rejects a light carrying an unknown member', () => {
    const message = parseError(documentJsonWithLight({ ...VALID_LIGHT, shadow: 1 }));

    expect(message.toLowerCase()).toContain('light');
    expect(message).toContain('shadow');
  });

  it.each(['azimuth', 'elevation', 'intensity'])('rejects a light missing %s', (member) => {
    const light: Record<string, number> = { ...VALID_LIGHT };
    delete light[member];
    const message = parseError(documentJsonWithLight(light));

    expect(message.toLowerCase()).toContain('light');
    expect(message).toContain(member);
  });

  it.each([
    ['azimuth', Number.NaN],
    ['azimuth', Number.POSITIVE_INFINITY],
    ['elevation', Number.NEGATIVE_INFINITY],
    ['intensity', Number.NaN],
  ])('rejects a non-finite %s', (member, value) => {
    const message = parseError(documentJsonWithLight({ ...VALID_LIGHT, [member]: value }));

    expect(message.toLowerCase()).toContain('light');
    expect(message).toContain(member);
  });

  it.each([
    ['azimuth', -1],
    ['azimuth', 360.5],
    ['elevation', -0.5],
    ['elevation', 90.5],
    ['intensity', -0.01],
    ['intensity', 4.01],
  ])('rejects an out-of-range %s (%s)', (member, value) => {
    const message = parseError(documentJsonWithLight({ ...VALID_LIGHT, [member]: value }));

    expect(message.toLowerCase()).toContain('light');
    expect(message).toContain(member);
  });

  it('rejects a null light instead of coercing it to absent', () => {
    const message = parseError(documentJsonWithLight(null));

    expect(message.toLowerCase()).toContain('light');
  });

  it('accepts the band edges the engine setter clamps to', () => {
    const parsed = parseEfxPaintDocument(
      documentJsonWithLight({ azimuth: 0, elevation: 0, intensity: 0 }),
    ) as DocumentWithLight;

    expect(parsed.light).toEqual({ azimuth: 0, elevation: 0, intensity: 0 });
    const upper = parseEfxPaintDocument(
      documentJsonWithLight({ azimuth: 360, elevation: 90, intensity: 4 }),
    ) as DocumentWithLight;
    expect(upper.light).toEqual({ azimuth: 360, elevation: 90, intensity: 4 });
  });

  it('single-sources the shape and the default from the engine package', () => {
    // The document light type IS the engine's LightSettings (structural pin).
    const structurallyEngineLight: PaintDocumentLight = VALID_LIGHT;
    const backToEngine: LightSettings = structurallyEngineLight;
    expect(backToEngine).toEqual(VALID_LIGHT);

    // The shipped default has exactly the three members and is itself a valid
    // persisted light (it round-trips through the parser's bands).
    expect(Object.keys(DEFAULT_LIGHT).sort()).toEqual(['azimuth', 'elevation', 'intensity']);
    const parsedDefault = parseEfxPaintDocument(
      documentJsonWithLight({ ...DEFAULT_LIGHT }),
    ) as DocumentWithLight;
    expect(parsedDefault.light).toEqual(DEFAULT_LIGHT);

    // A fresh document manufactures nothing; the reader's fallback IS the
    // package default — the app never retypes it.
    const fresh = baseDocument() as DocumentWithLight;
    expect('light' in fresh).toBe(false);
    expect(fresh.light ?? DEFAULT_LIGHT).toEqual(DEFAULT_LIGHT);
  });
});
