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
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LIGHT } from '@efxlab/efx-watercolor';
import type { LightSettings } from '@efxlab/efx-watercolor';
import { createEfxPaintDocument } from './efxPaintDocument';
import type { EfxPaintDocument, PaintDocumentLight } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import {
  buildEfxPaintDocumentRevision,
  buildEfxPaintDocumentSyncFingerprint,
} from './efxPaintDocumentRevision';
import {
  efxPaintVersion,
  getDocument,
  registerDocument,
  reset,
} from '../../stores/efxPaintStore';
import type { BackgroundFallbackMutationResult } from '../../stores/efxPaintStore';

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

// ---------------------------------------------------------------------------
// Phase 64-05 Task 2 — the revision term and the one light mutation
// ---------------------------------------------------------------------------

type LightPatch = Partial<Record<'azimuth' | 'elevation' | 'intensity', number>>;

interface LightStoreSurface {
  setDocumentLight?: (layerId: string, patch: LightPatch) => BackgroundFallbackMutationResult;
}

/** The store writer, resolved dynamically so a missing export fails as an assertion. */
async function requireLightSetter(): Promise<
  (layerId: string, patch: LightPatch) => BackgroundFallbackMutationResult
> {
  const module = (await import('../../stores/efxPaintStore')) as unknown as LightStoreSurface;
  expect(typeof module.setDocumentLight).toBe('function');
  return module.setDocumentLight as (layerId: string, patch: LightPatch) => BackgroundFallbackMutationResult;
}

function documentWithLight(layerId: string, light: LightSettings): EfxPaintDocument {
  return { ...createEfxPaintDocument(layerId), light };
}

describe('document light revision term (MED-17)', () => {
  const BASE = createEfxPaintDocument('layer-light-rev');
  const LIT: EfxPaintDocument = { ...BASE, light: { azimuth: 200, elevation: 40, intensity: 2 } };

  it('rotates the document revision when the light changes, and only then', () => {
    const sameValue: EfxPaintDocument = { ...BASE, light: { azimuth: 200, elevation: 40, intensity: 2 } };
    const moved: EfxPaintDocument = { ...BASE, light: { azimuth: 210, elevation: 40, intensity: 2 } };

    // A present light is part of the document's content identity.
    expect(buildEfxPaintDocumentRevision(LIT)).not.toBe(buildEfxPaintDocumentRevision(BASE));
    // Equal content yields an equal revision.
    expect(buildEfxPaintDocumentRevision(sameValue)).toBe(buildEfxPaintDocumentRevision(LIT));
    // Any member change rotates it.
    expect(buildEfxPaintDocumentRevision(moved)).not.toBe(buildEfxPaintDocumentRevision(LIT));
  });

  it('rotates the sync fingerprint with the revision (no second light term)', () => {
    const moved: EfxPaintDocument = { ...BASE, light: { azimuth: 210, elevation: 40, intensity: 2 } };
    expect(buildEfxPaintDocumentSyncFingerprint(moved))
      .not.toBe(buildEfxPaintDocumentSyncFingerprint(LIT));
  });
});

describe('setDocumentLight — the one light writer (MED-17)', () => {
  beforeEach(() => {
    reset();
  });

  it('returns one descriptor, one revision bump and one change notification', async () => {
    const setDocumentLight = await requireLightSetter();
    const before = createEfxPaintDocument('layer-a');
    registerDocument(before);
    const versionBefore = efxPaintVersion.value;

    const result = setDocumentLight('layer-a', { intensity: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.descriptor).not.toBeNull();
    const descriptor = result.descriptor!;
    expect(descriptor.operationKind).toBe('set-document-light');
    expect(descriptor.before).toBe(before);
    const after = getDocument('layer-a')!;
    expect(descriptor.after).toBe(after);
    expect(after.documentRevision).toBe(before.documentRevision + 1);
    expect(after.light).toEqual({
      azimuth: DEFAULT_LIGHT.azimuth,
      elevation: DEFAULT_LIGHT.elevation,
      intensity: 2,
    });
    expect(efxPaintVersion.value).toBe(versionBefore + 1);

    // The revision rotates, so every cache keyed on it misses.
    expect(buildEfxPaintDocumentRevision(after))
      .not.toBe(buildEfxPaintDocumentRevision(before));
  });

  it('treats a same-value write as a revision-stable no-op with a null descriptor', async () => {
    const setDocumentLight = await requireLightSetter();
    const before = documentWithLight('layer-same', { azimuth: 200, elevation: 40, intensity: 2 });
    registerDocument(before);
    const versionBefore = efxPaintVersion.value;

    const result = setDocumentLight('layer-same', { intensity: 2 });

    expect(result).toEqual({ ok: true, descriptor: null });
    expect(getDocument('layer-same')).toBe(before);
    expect(efxPaintVersion.value).toBe(versionBefore);
  });

  it('treats a patch with no declared field as a no-op, even when the light is absent', async () => {
    const setDocumentLight = await requireLightSetter();
    const before = createEfxPaintDocument('layer-empty-patch');
    registerDocument(before);

    const result = setDocumentLight('layer-empty-patch', {});

    expect(result).toEqual({ ok: true, descriptor: null });
    // Never inject a default light into a document that had none.
    expect(getDocument('layer-empty-patch')).toBe(before);
    expect('light' in getDocument('layer-empty-patch')!).toBe(false);
  });

  it('fails closed on a layer with no document and writes nothing', async () => {
    const setDocumentLight = await requireLightSetter();

    const result = setDocumentLight('layer-absent', { intensity: 1 });

    expect(result.ok).toBe(false);
    expect(getDocument('layer-absent')).toBeNull();
  });

  it('never touches a sibling layer document when one layer light changes', async () => {
    const setDocumentLight = await requireLightSetter();
    const layerA = createEfxPaintDocument('layer-a');
    const layerB = documentWithLight('layer-b', { azimuth: 10, elevation: 20, intensity: 3 });
    registerDocument(layerA);
    registerDocument(layerB);

    const result = setDocumentLight('layer-a', { azimuth: 300 });

    expect(result.ok).toBe(true);
    expect(getDocument('layer-b')).toBe(layerB);
    expect(getDocument('layer-b')!.light).toEqual({ azimuth: 10, elevation: 20, intensity: 3 });
  });

  it('clamps, wraps and falls back exactly as the engine setter does', async () => {
    const setDocumentLight = await requireLightSetter();
    registerDocument(createEfxPaintDocument('layer-clamp'));

    // Azimuth wraps into 0..360; elevation clamps into 0..90; intensity into 0..4.
    expect(setDocumentLight('layer-clamp', { azimuth: -30, elevation: 120, intensity: 9 }).ok).toBe(true);
    expect(getDocument('layer-clamp')!.light).toEqual({ azimuth: 330, elevation: 90, intensity: 4 });
    expect(setDocumentLight('layer-clamp', { azimuth: 400 }).ok).toBe(true);
    expect(getDocument('layer-clamp')!.light).toEqual({ azimuth: 40, elevation: 90, intensity: 4 });

    // A non-finite value falls back to the engine's DEFAULT_LIGHT field, never NaN.
    expect(setDocumentLight('layer-clamp', {
      azimuth: Number.NaN,
      elevation: Number.POSITIVE_INFINITY,
      intensity: Number.NEGATIVE_INFINITY,
    }).ok).toBe(true);
    expect(getDocument('layer-clamp')!.light).toEqual(DEFAULT_LIGHT);
  });

  it('resolves a partial patch over the current light', async () => {
    const setDocumentLight = await requireLightSetter();
    registerDocument(documentWithLight('layer-partial', { azimuth: 200, elevation: 40, intensity: 2 }));

    const result = setDocumentLight('layer-partial', { elevation: 10 });

    expect(result.ok).toBe(true);
    expect(getDocument('layer-partial')!.light).toEqual({ azimuth: 200, elevation: 10, intensity: 2 });
  });
});
