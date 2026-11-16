import { describe, expect, it } from 'vitest';

// Lazy loader — the schema module is loaded once and every named-export
// assertion runs against the real surface. Top-level imports of the codec
// surface would be a collection error, not a named missing-export RED.

type SerializeFn = (input: any) => any;
type ParseFn = (raw: unknown) =>
  | { ok: true; document: any }
  | { ok: false; refusal: { code: string; detail?: string } };
type ToRuntimeFn = (document: any) => any;
type IsPersistedFn = (value: unknown) => boolean;
type RowFn = (document: any, revision: string, integrity: string) => any;

interface SchemaModule {
  ROTO_SCRIPT_KIND?: unknown;
  ROTO_SCRIPT_LEGACY_ENGINE_ID?: unknown;
  ROTO_SCRIPT_ENGINE_ID_AQUARELLE?: unknown;
  ROTO_SCRIPT_EXTENSION?: unknown;
  ROTO_SCRIPT_WEBP_PREFIX?: unknown;
  serializeRotoScript?: SerializeFn;
  serializeAquarelleRotoScript?: SerializeFn;
  createPersistedRotoScript?: SerializeFn;
  parseRotoScript?: ParseFn;
  persistedRotoScriptToRuntime?: ToRuntimeFn;
  isPersistedRotoScriptV1?: IsPersistedFn;
  isPersistedRotoScriptAquarelleV1?: IsPersistedFn;
  describePersistedRotoScriptRefusal?: (value: unknown) => string | null;
  rotoScriptLibraryRow?: RowFn;
  managedRotoScriptFilename?: (id: string) => string;
}

let cached: SchemaModule | undefined;
async function loadSchema(): Promise<SchemaModule> {
  if (!cached) cached = (await import('./physicsPaintRotoScriptSchema')) as SchemaModule;
  return cached;
}

const id = '123e4567-e89b-42d3-a456-426614174000';
const webp = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAUAAAAvAAAAAAA=';
const LEGACY_KIND = 'efx-physics-paint-roto-script';
const ENVELOPE_KIND = 'efx-studio-paint-script';

// ---------------------------------------------------------------------------
// 261027-klx: watercolor-only identity (the engine-1 codec is gone)
// ---------------------------------------------------------------------------

function legacyBrushEnvelope(engineId = 'efx-physic-paint'): Record<string, unknown> {
  return {
    kind: ENVELOPE_KIND,
    schemaVersion: 1,
    engineId,
    id,
    name: 'Old Brush preset',
    createdAt: '2026-07-16T12:00:00.000Z',
    updatedAt: '2026-07-16T12:00:00.000Z',
    source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 12, width: 1920, height: 1080, background: { background: 'canvas2', grainStrength: 0.6 } },
    thumbnail: { mimeType: 'image/webp', width: 1, height: 1, quality: 0.8, dataUrl: webp },
    // The engine-1 serializer's pinned empty snapshot: a real old envelope has it.
    brushPack: { kind: 'efx-physic-paint', entries: [] },
    strokes: [{
      pts: [{ x: 1, y: 2, p: 0.5, tx: 3, ty: 4, tw: 5, tick: 0 }],
      ticks: 0,
      cuisson: 0,
      motion: null,
      brushId: 'paint',
      toolOverrides: {},
      traceSeed: 0,
      recordedOrder: 123,
      playFrame: 7,
      color: '#123456',
      engine: { tool: 'paint', color: '#123456', params: {}, mutationId: 9, timestamp: 123 },
    }],
  };
}

describe('watercolor-only script identity (261027-klx)', () => {
  it('exports the watercolor identity, ONE legacy literal for classification, and no engine-1 builder', async () => {
    const schema = await loadSchema();
    expect(schema.ROTO_SCRIPT_KIND).toBe(ENVELOPE_KIND);
    expect(schema.ROTO_SCRIPT_ENGINE_ID_AQUARELLE).toBe('efx-watercolor');
    // The legacy id survives ONLY to classify an old envelope as refused.
    expect(schema.ROTO_SCRIPT_LEGACY_ENGINE_ID).toBe('efx-physic-paint');
    // The retired engine-1 id constant must be deleted. Asserted by SHAPE, not
    // by name: `ROTO_SCRIPT_ENGINE_ID_AQUARELLE` is the only id constant allowed
    // to end in the engineer-id suffix, and the census gate (G3) requires the
    // retired constant's name to be absent from app/src entirely.
    expect(
      Object.keys(schema).filter((key) => key.endsWith('_ENGINE_ID')),
      'the legacy classification literal is the ONLY *_ENGINE_ID export',
    ).toEqual(['ROTO_SCRIPT_LEGACY_ENGINE_ID']);
    expect(schema.serializeRotoScript, 'the engine-1 serializer must be deleted').toBeUndefined();
    expect(schema.createPersistedRotoScript, 'the engine-1 builder must be deleted').toBeUndefined();
    expect(schema.managedRotoScriptFilename!(id)).toBe(`${id}${schema.ROTO_SCRIPT_EXTENSION}`);
  });

  it('parse of a legacy-kind fixture returns the clean-break refusal and never a script', async () => {
    const schema = await loadSchema();
    const legacy = {
      ...legacyBrushEnvelope(),
      kind: LEGACY_KIND,
    };
    const parsed = schema.parseRotoScript!(legacy);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.refusal.code).toBe('unreadable-legacy-script');
  });

  it('parse of an old Brush envelope refuses as engine-mismatch naming script engine first, target second', async () => {
    const schema = await loadSchema();
    const parsed = schema.parseRotoScript!(legacyBrushEnvelope());
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.refusal.code).toBe('engine-mismatch');
    expect(parsed.refusal.detail).toBe('efx-physic-paint:efx-watercolor');
  });

  it('parse refuses an unknown engine id and garbage with named codes', async () => {
    const schema = await loadSchema();
    const aquarelle = schema.serializeAquarelleRotoScript!(aquarelleInput());

    const unknownEngine = schema.parseRotoScript!({ ...aquarelle, engineId: 'other' });
    expect(unknownEngine.ok).toBe(false);
    if (!unknownEngine.ok) expect(unknownEngine.refusal.code).toBe('unknown-engine-id');

    // A KNOWN engine that is not this reader's codec is a mismatch, not a
    // malformed payload — the envelope parsed cleanly.
    const krita = schema.parseRotoScript!({ ...aquarelle, engineId: 'efx-krita' });
    expect(krita.ok).toBe(false);
    if (!krita.ok) {
      expect(krita.refusal.code).toBe('engine-mismatch');
      expect(krita.refusal.detail).toBe('efx-krita:efx-watercolor');
    }

    const garbage = schema.parseRotoScript!(null);
    expect(garbage.ok).toBe(false);
    if (!garbage.ok) expect(garbage.refusal.code).toBe('malformed-engine-payload');
  });

  it('never accepts a legacy Brush body relabelled with the watercolor engine id', async () => {
    const schema = await loadSchema();
    const relabelled = { ...legacyBrushEnvelope('efx-watercolor'), brushPack: { kind: 'efx-watercolor', entries: [] } };
    const parsed = schema.parseRotoScript!(relabelled);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.refusal.code).toBe('malformed-engine-payload');
  });
});

// ---------------------------------------------------------------------------
// 261018-odm: the aquarelle variant (ODM-01)
// ---------------------------------------------------------------------------

const AQUARELLE_ENGINE_ID = 'efx-watercolor';

function aquarelleStrokeEvent(overrides: Record<string, unknown> = {}): any {
  return {
    pts: [
      { x: 0.25, y: 0.75, p: 0.8, tx: 0, ty: 0, tw: 0, tick: 0 },
      { x: 0.5, y: 0.5, p: 0.9, tx: 0, ty: 0, tw: 0, tick: 1 },
      { x: 0.75, y: 0.25, p: 0.7, tx: 0, ty: 0, tw: 0, tick: 2 },
    ],
    ticks: 2,
    cuisson: 0,
    motion: null,
    brushId: 'wc/round-medium',
    toolOverrides: { tip: 1.2 },
    traceSeed: 42,
    recordedOrder: 100,
    playFrame: null,
    color: '#224466',
    engine: {
      tool: 'brush',
      color: '#224466',
      params: { size: 12, water: 50, load: 55, flow: 50, bleed: 50, dry: 50, edge: 50, granulation: 50 },
      brushId: 'wc/round-medium',
      toolOverrides: { tip: 1.2 },
      mutationId: 11,
      timestamp: 100,
    },
    ...overrides,
  };
}

function aquarelleDryEvent(overrides: Record<string, unknown> = {}): any {
  return { kind: 'dry', tick: 4, recordedOrder: 200, ...overrides };
}

function aquarelleInput(overrides: Record<string, unknown> = {}) {
  return {
    id, name: 'Wash', createdAt: '2026-07-16T12:00:00.000Z', updatedAt: '2026-07-16T12:00:00.000Z',
    source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Water', sourceFrame: 4, displayFrame: 12, width: 1920, height: 1080, background: { background: 'canvas2', grainStrength: 0.6 } },
    thumbnail: { mimeType: 'image/webp', width: 1, height: 1, quality: 0.8, dataUrl: webp },
    events: [aquarelleStrokeEvent(), aquarelleDryEvent(), aquarelleStrokeEvent({
      recordedOrder: 300,
      pts: [{ x: 0.1, y: 0.9, p: 0.5, tx: 0, ty: 0, tw: 0, tick: 0 }],
      ticks: 1,
      engine: {
        tool: 'water',
        color: null,
        params: { size: 20, water: 80, load: 40, flow: 60, bleed: 70, dry: 30, edge: 40, granulation: 20 },
        brushId: 'wc/flat-wash',
        mutationId: 12,
        diffusionFrames: 30,
        timestamp: 300,
      },
    })],
    ...overrides,
  };
}

describe('capture-refusal diagnostics (quick 261116-inu regression)', () => {
  it('names the offending field instead of a bare "not persistable"', async () => {
    const schema = await loadSchema();
    const refused = schema.describePersistedRotoScriptRefusal!;
    expect(refused, 'the diagnostic must be exported').toBeTypeOf('function');

    const good = schema.serializeAquarelleRotoScript!(aquarelleInput({ events: [aquarelleStrokeEvent()] }));
    expect(refused(good), 'a valid capture has no reason').toBeNull();

    // A recorder change that stops writing a number names the exact param key.
    const badParam = structuredClone(good);
    badParam.strokes[0].engine.params.size = undefined;
    expect(refused(badParam)).toBe('stroke 0: engine.params.size');

    // A degree/hundredths mix-up names the rotation slot, not the whole doc.
    const badRotation = structuredClone(good);
    badRotation.strokes[0].engine.textureRotation = 3700;
    expect(refused(badRotation)).toBe('stroke 0: engine.textureRotation');

    // An empty texture id names its own slot.
    const badTexture = structuredClone(good);
    badTexture.strokes[0].engine.textureId = '';
    expect(refused(badTexture)).toBe('stroke 0: engine.textureId');

    // …and the thrown message carries the reason to the artist's log.
    expect(() => schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent({ engine: { ...aquarelleStrokeEvent().engine, params: { size: null } } })],
    }))).toThrow('Captured Roto script is not persistable (stroke 0: engine.params.size)');
  });
});

describe('aquarelle script codec (261018-odm ODM-01)', () => {
  it('serializeAquarelleRotoScript emits engineId efx-watercolor with UV pts and an AquarelleStrokePayload engine slot', async () => {
    const schema = await loadSchema();
    expect(schema.ROTO_SCRIPT_ENGINE_ID_AQUARELLE, 'schema must export ROTO_SCRIPT_ENGINE_ID_AQUARELLE').toBe(AQUARELLE_ENGINE_ID);
    expect(schema.serializeAquarelleRotoScript, 'schema must export serializeAquarelleRotoScript').toBeTypeOf('function');
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
    }));
    expect(value.kind).toBe(ENVELOPE_KIND);
    expect(value.engineId).toBe(AQUARELLE_ENGINE_ID);
    expect(value.schemaVersion).toBe(1);
    expect(value.brushPack).toEqual({ kind: AQUARELLE_ENGINE_ID, entries: [] });
    const only = value.strokes[0];
    expect(only.brushId).toBe(AQUARELLE_ENGINE_ID);
    expect(only.cuisson).toBe(0);
    expect(only.motion).toBeNull();
    expect(only.pts).toEqual([
      { x: 0.25, y: 0.75, p: 0.8, tx: 0, ty: 0, tw: 0, tick: 0 },
      { x: 0.5, y: 0.5, p: 0.9, tx: 0, ty: 0, tw: 0, tick: 1 },
      { x: 0.75, y: 0.25, p: 0.7, tx: 0, ty: 0, tw: 0, tick: 2 },
    ]);
    expect(only.engine.tool).toBe('brush');
    expect(only.engine.brushId).toBe('wc/round-medium');
    expect(only.engine.params).toMatchObject({ size: 12, water: 50, load: 55 });
    expect(only.ticks).toBe(2);
    expect(only.recordedOrder).toBe(100);
  });

  it('a Dry event round-trips as a distinguished stroke entry and reconstructs to AquarelleDryEvent', async () => {
    const schema = await loadSchema();
    expect(schema.serializeAquarelleRotoScript).toBeTypeOf('function');
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleDryEvent({ tick: 9, recordedOrder: 55 })],
    }));
    expect(value.strokes).toHaveLength(1);
    const dryEntry = value.strokes[0];
    expect(dryEntry.pts).toEqual([]);
    expect(dryEntry.ticks).toBe(0);
    expect(dryEntry.cuisson).toBe(0);
    expect(dryEntry.brushId).toBe(AQUARELLE_ENGINE_ID);
    expect(dryEntry.toolOverrides).toEqual({});
    expect(dryEntry.traceSeed).toBe(0);
    expect(dryEntry.recordedOrder).toBe(55);
    expect(dryEntry.playFrame).toBeNull();
    expect(dryEntry.color).toBeNull();
    expect(dryEntry.engine).toEqual({ kind: 'dry', tick: 9, recordedOrder: 55 });

    const parsed = schema.parseRotoScript!(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const runtime = schema.persistedRotoScriptToRuntime!(parsed.document);
    expect(runtime.engineId).toBe(AQUARELLE_ENGINE_ID);
    const drys = (runtime.aquarelleEvents ?? []).filter((event: any) => event.kind === 'dry');
    expect(drys).toEqual([{ kind: 'dry', tick: 9, recordedOrder: 55 }]);
  });

  it('parseRotoScript accepts the watercolor envelope and no other engine', async () => {
    const schema = await loadSchema();
    expect(schema.parseRotoScript).toBeTypeOf('function');
    const aquarelle = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
    }));
    expect(schema.parseRotoScript!(aquarelle).ok).toBe(true);
  });

  it('the watercolor guard rejects an engine-1 tool id inside an aquarelle document', async () => {
    const schema = await loadSchema();
    expect(schema.serializeAquarelleRotoScript).toBeTypeOf('function');
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
    }));
    const poisoned = structuredClone(value) as any;
    poisoned.strokes[0].engine.tool = 'paint';
    expect(schema.isPersistedRotoScriptV1!(poisoned)).toBe(false);
    expect(schema.isPersistedRotoScriptAquarelleV1!(poisoned)).toBe(false);
  });

  it('keeps the watercolor brushPack validation', async () => {
    const schema = await loadSchema();
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({ events: [aquarelleStrokeEvent()] }));
    expect(schema.isPersistedRotoScriptAquarelleV1!(value)).toBe(true);

    const noPack = structuredClone(value) as any;
    delete noPack.brushPack;
    expect(schema.isPersistedRotoScriptAquarelleV1!(noPack)).toBe(false);

    const badEntries = structuredClone(value) as any;
    badEntries.brushPack = { kind: AQUARELLE_ENGINE_ID, entries: 'nope' };
    expect(schema.isPersistedRotoScriptAquarelleV1!(badEntries)).toBe(false);
  });

  it('persistedRotoScriptToRuntime sets engineId and aquarelleEvents from the aquarelle document', async () => {
    const schema = await loadSchema();
    expect(schema.serializeAquarelleRotoScript).toBeTypeOf('function');
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput());
    const parsed = schema.parseRotoScript!(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const runtime = schema.persistedRotoScriptToRuntime!(parsed.document);
    expect(runtime.engineId).toBe(AQUARELLE_ENGINE_ID);
    expect(runtime.aquarelleEvents).toHaveLength(3);
    expect(runtime.aquarelleEvents!.filter((event: any) => event.kind === 'dry')).toHaveLength(1);
    expect(runtime.aquarelleEvents!.filter((event: any) => event.kind !== 'dry')).toHaveLength(2);
    // One stroke group per non-Dry event, projected into pixel space.
    expect(runtime.brushes).toHaveLength(2);
    expect(runtime.brushes[0].primary.points).toHaveLength(3);
    // UV y-up 0.75 → pixel y-down (1 - 0.75) * 1080 = 270.
    expect(runtime.brushes[0].primary.points[0]).toMatchObject({ x: 0.25 * 1920, y: (1 - 0.75) * 1080 });
  });

  it('creates fresh runtime and row objects without aliasing persisted input', async () => {
    const schema = await loadSchema();
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({ events: [aquarelleStrokeEvent()] }));
    const runtime = schema.persistedRotoScriptToRuntime!(value);
    const row = schema.rotoScriptLibraryRow!(value, 'revision', 'a'.repeat(64));
    expect(runtime.brushes[0].primary.points[0]).not.toBe(value.strokes[0].pts[0]);
    expect(row.source).not.toBe(value.source);
    expect(row.thumbnail).not.toBe(value.thumbnail);
  });

  it('rotoScriptLibraryRow brushCount skips Dry markers on an aquarelle document', async () => {
    const schema = await loadSchema();
    expect(schema.serializeAquarelleRotoScript).toBeTypeOf('function');
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput());
    const row = schema.rotoScriptLibraryRow!(value, 'revision', 'a'.repeat(64));
    expect(row.brushCount).toBe(2);
  });

  it('the aquarelle round-trip keeps counts', async () => {
    const schema = await loadSchema();
    const aquarelle = schema.serializeAquarelleRotoScript!(aquarelleInput());
    const parsed = schema.parseRotoScript!(aquarelle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const runtime = schema.persistedRotoScriptToRuntime!(parsed.document);
    expect(runtime.aquarelleEvents!.filter((event: any) => event.kind === 'dry')).toHaveLength(1);
    expect(runtime.aquarelleEvents!.filter((event: any) => event.kind !== 'dry')).toHaveLength(2);
    expect(runtime.brushes).toHaveLength(2);
  });

  it('a malformed aquarelle payload refuses with malformed-engine-payload', async () => {
    const schema = await loadSchema();
    expect(schema.serializeAquarelleRotoScript).toBeTypeOf('function');
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
    }));
    const poisoned = structuredClone(value) as any;
    poisoned.strokes[0].engine.tool = 'paint';
    const parsed = schema.parseRotoScript!(poisoned);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.refusal.code).toBe('malformed-engine-payload');
  });
});

// ---------------------------------------------------------------------------
// quick-261115-oh9: the texture axis on the script boundary. `textureId` rides
// the opaque engine slot; the boundary guard runs the SAME present-means-a-
// non-empty-string rule as the payload codec (`isStrokeShape`), because a
// saved Roto script can meet this guard without ever calling the codec.
// ---------------------------------------------------------------------------

describe('textureId on the script engine slot (quick-261115-oh9)', () => {
  function texturedEvent(textureId: unknown): any {
    const event = aquarelleStrokeEvent();
    event.engine = { ...event.engine, textureId };
    return event;
  }

  it('a valid machine-library texture id parses', async () => {
    const schema = await loadSchema();
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [texturedEvent('wc/custom-chalk')],
    }));
    const parsed = schema.parseRotoScript!(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const runtime = schema.persistedRotoScriptToRuntime!(parsed.document);
    expect(runtime.aquarelleEvents![0].engine.textureId).toBe('wc/custom-chalk');
  });

  it('absence still parses and stays absent', async () => {
    const schema = await loadSchema();
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
    }));
    const parsed = schema.parseRotoScript!(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const runtime = schema.persistedRotoScriptToRuntime!(parsed.document);
    expect('textureId' in runtime.aquarelleEvents![0].engine).toBe(false);
  });

  it('a number or a present empty string refuses as malformed-engine-payload', async () => {
    const schema = await loadSchema();
    // The serializer shares the guard, so malformed data can only reach the
    // parse leg from disk. Serialize a valid stroke, then tamper its engine
    // slot exactly as a hand-edited or foreign script would.
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [texturedEvent('wc/custom-chalk')],
    }));
    for (const bad of [7, '', null]) {
      const tampered = structuredClone(value);
      tampered.strokes[0].engine.textureId = bad;
      const parsed = schema.parseRotoScript!(tampered);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.refusal.code).toBe('malformed-engine-payload');
    }
  });
});

// ---------------------------------------------------------------------------
// quick 261116-inu / Task 9: the rotation rides the same opaque engine slot as
// integer DEGREES in -180..180. The JSON carrier NEVER holds hundredths —
// those exist only inside the AQTL i16 byte body — so a 3700 reaching a saved
// script is out of range and refused. This is the Roto half of the anti-mixup
// law pinned in scriptTimelineCodec.test.ts (37 degrees <-> 3700 hundredths).
// ---------------------------------------------------------------------------

describe('textureRotation on the script engine slot (quick 261116-inu)', () => {
  function rotatedEvent(textureRotation: unknown): any {
    const event = aquarelleStrokeEvent();
    event.engine = {
      ...event.engine,
      textureId: 'wc/custom-chalk',
      textureRotation,
    };
    return event;
  }

  it('accepts integer degrees across the full -180..180 range and round-trips them', async () => {
    const schema = await loadSchema();
    for (const degrees of [-180, -120, 0, 37, 180]) {
      const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
        events: [rotatedEvent(degrees)],
      }));
      const parsed = schema.parseRotoScript!(value);
      expect(parsed.ok, `degrees ${degrees}`).toBe(true);
      if (!parsed.ok) continue;
      const runtime = schema.persistedRotoScriptToRuntime!(parsed.document);
      expect(runtime.aquarelleEvents![0].engine.textureRotation).toBe(degrees);
    }
  });

  it('absence still parses and stays absent', async () => {
    const schema = await loadSchema();
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
    }));
    const parsed = schema.parseRotoScript!(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const runtime = schema.persistedRotoScriptToRuntime!(parsed.document);
    expect('textureRotation' in runtime.aquarelleEvents![0].engine).toBe(false);
  });

  it('anti-mixup: refuses 3700 hundredths and every non-integer or out-of-range value', async () => {
    const schema = await loadSchema();
    // 3700 is the encoded i16 for 37 degrees INSIDE the AQTL body — it must
    // never survive as a JSON-carrier degree value.
    for (const bad of [3700, 37.5, 181, -181, '37', null]) {
      const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
        events: [rotatedEvent(37)],
      }));
      const tampered = structuredClone(value);
      tampered.strokes[0].engine.textureRotation = bad;
      const parsed = schema.parseRotoScript!(tampered);
      expect(parsed.ok, `rotation ${String(bad)}`).toBe(false);
      if (!parsed.ok) expect(parsed.refusal.code).toBe('malformed-engine-payload');
    }
  });
});

// ---------------------------------------------------------------------------
// 63-08 / TIP-14: the inline script carrier. A script cannot point into
// another project's package, so each custom tip travels with its mask inline
// as a WebP data URL (D-14) — never an `asset` ref.
// ---------------------------------------------------------------------------

const SCRIPT_MASK_TIP_ID = 'wc/custom-script';

function scriptTip(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SCRIPT_MASK_TIP_ID,
    category: 'custom',
    name: 'Script tip',
    tip: 1, aspect: 1, rotation: 1, sizeCurve: 1, scatter: 1, capacity: 1, grain: 1, wetRound: 1,
    ...overrides,
  };
}

describe('script brush carrier (63-08 / TIP-14 / quick 261116-inu)', () => {
  it('serializes custom brush entries as METADATA: no mask carrier, no package asset ref', async () => {
    const schema = await loadSchema();
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
      brushEntries: [scriptTip()],
    }));
    expect(value.brushPack.kind).toBe(AQUARELLE_ENGINE_ID);
    expect(value.brushPack.entries).toHaveLength(1);
    const entry = value.brushPack.entries[0];
    expect(entry.id).toBe(SCRIPT_MASK_TIP_ID);
    expect('maskDataUrl' in entry).toBe(false);
    expect('asset' in entry).toBe(false);
    // The document carrying a metadata entry still parses and loads.
    expect(schema.parseRotoScript!(value).ok).toBe(true);
  });

  it('a referenced texture absent from this machine still loads — the script carries metadata only', async () => {
    const schema = await loadSchema();
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
      brushEntries: [scriptTip({ id: 'wc/custom-absent-here' })],
    }));
    const parsed = schema.parseRotoScript!(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('expected the script to parse');
    // The entry is metadata; nothing in the parse path consults a local registry.
    expect(parsed.document.brushPack.entries[0].id).toBe('wc/custom-absent-here');
  });

  it('the parser refuses every malformed script carrier entry with a named reason', async () => {
    const schema = await loadSchema();
    const base = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
      brushEntries: [scriptTip()],
    }));
    const parseWith = (mutate: (entry: any) => void) => {
      const copy = structuredClone(base) as any;
      mutate(copy.brushPack.entries[0]);
      return schema.parseRotoScript!(copy);
    };
    const refusals = [
      // The retired inline `mask` member and any package asset ref are refused.
      parseWith((entry) => { entry.mask = 'retired'; }),
      parseWith((entry) => { entry.asset = `brushes/${'a'.repeat(64)}.webp`; }),
    ];
    for (const parsed of refusals) {
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.refusal.code).toBe('malformed-engine-payload');
    }
  });

  it('refuses to serialize a script entry carrying a package asset ref', async () => {
    const schema = await loadSchema();
    expect(() => schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
      brushEntries: [scriptTip({ asset: `brushes/${'a'.repeat(64)}.webp` })],
    }))).toThrow();
  });
});
