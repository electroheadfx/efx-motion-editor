import { describe, expect, it } from 'vitest';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
import type { StudioStroke } from '@efxlab/efx-paint-host';

// Lazy loader — RED: serializeRotoScript / parseRotoScript do not exist yet, so
// the named export assertions fail intentionally. GREEN: the real module loads.
// Top-level imports of the NEW codec surface would be a collection error, not
// a named missing-export RED (tdd.md INVALID_RED).

type SerializeFn = (input: any) => any;
type ParseFn = (raw: unknown) =>
  | { ok: true; document: any }
  | { ok: false; refusal: { code: string; detail?: string } };
type CreateFn = (input: any) => any;
type ToRuntimeFn = (document: any) => any;
type IsPersistedFn = (value: unknown) => boolean;
type RowFn = (document: any, revision: string, integrity: string) => any;

interface SchemaModule {
  ROTO_SCRIPT_KIND?: unknown;
  ROTO_SCRIPT_ENGINE_ID?: unknown;
  ROTO_SCRIPT_ENGINE_ID_AQUARELLE?: unknown;
  ROTO_SCRIPT_EXTENSION?: unknown;
  serializeRotoScript?: SerializeFn;
  serializeAquarelleRotoScript?: SerializeFn;
  parseRotoScript?: ParseFn;
  createPersistedRotoScript?: CreateFn;
  persistedRotoScriptToRuntime?: ToRuntimeFn;
  isPersistedRotoScriptV1?: IsPersistedFn;
  isPersistedRotoScriptAquarelleV1?: IsPersistedFn;
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

function stroke(overrides: Partial<PaintStroke> = {}): PaintStroke {
  return {
    mutationId: 9, tool: 'paint', points: [{ x: 1, y: 2, p: 0.5, tx: 3, ty: 4, tw: 5, spd: 6 }], color: '#123456',
    params: { size: 12, opacity: 90, pressure: 80, waterAmount: 70, dryAmount: 60, edgeDetail: 50, pickup: 40, eraseStrength: 30, antiAlias: 2 },
    timestamp: 123, hasPenInput: true, playFrame: 7, physicsMode: 'local', ...overrides,
  };
}

function threePointStroke(): PaintStroke {
  return stroke({
    points: [
      { x: 1, y: 1, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
      { x: 2, y: 2, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
      { x: 3, y: 3, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
    ],
  });
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    id, name: 'Preset', createdAt: '2026-07-16T12:00:00.000Z', updatedAt: '2026-07-16T12:00:00.000Z',
    source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 12, width: 1920, height: 1080, background: { background: 'canvas2', grainStrength: 0.6 } },
    thumbnail: { mimeType: 'image/webp', width: 1, height: 1, quality: 0.8, dataUrl: webp },
    brushes: [{ primary: stroke(), continuations: [stroke({ mutationId: 10, points: [], diffusionFrames: 4 })] }],
    ...overrides,
  };
}

function engineOf(strokeValue: StudioStroke<any>): any {
  return strokeValue.engine;
}

describe('engine-1 codec on StudioScriptEnvelope (55-05 DATA-01 / D-13..D-16)', () => {
  it('schema must export serializeRotoScript and parseRotoScript', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript, 'schema must export serializeRotoScript').toBeTypeOf('function');
    expect(schema.parseRotoScript, 'schema must export parseRotoScript').toBeTypeOf('function');
  });

  it('serialize emits kind efx-studio-paint-script with engineId efx-physic-paint and an opaque engine slot', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript).toBeTypeOf('function');
    expect(schema.ROTO_SCRIPT_KIND).toBe(ENVELOPE_KIND);
    expect(schema.ROTO_SCRIPT_ENGINE_ID).toBe('efx-physic-paint');
    const value = schema.serializeRotoScript!(input({
      brushes: [{ primary: stroke({ physicsMode: 'local' }), continuations: [stroke({ mutationId: 10, points: [], diffusionFrames: 4 })] }],
    }));
    expect(value.kind).toBe(ENVELOPE_KIND);
    expect(value.engineId).toBe('efx-physic-paint');
    expect(value.schemaVersion).toBe(1);
    expect(schema.managedRotoScriptFilename!(id)).toBe(`${id}${schema.ROTO_SCRIPT_EXTENSION}`);
    const first = value.strokes[0];
    const engine = engineOf(first);
    expect(engine.tool).toBe('paint');
    expect(engine.color).toBe('#123456');
    expect(engine.params).toMatchObject({ size: 12, opacity: 90, pressure: 80 });
    expect(engine.physicsMode).toBe('local');
    expect(engine.hasPenInput).toBe(true);
    expect(engine.timestamp).toBe(123);
    expect(engine.playFrame).toBe(7);
  });

  it('FIELD-MAPPING: integer tick projection — 3-point stroke has pts tick 0/1/2, ticks 2, and no raw-ms shared timing field', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript).toBeTypeOf('function');
    const value = schema.serializeRotoScript!(input({
      brushes: [{ primary: threePointStroke(), continuations: [] }],
    }));
    const only = value.strokes[0];
    expect(only.pts.map((point: { tick: number }) => point.tick)).toEqual([0, 1, 2]);
    expect(only.ticks).toBe(2);
    expect(Number.isInteger(only.ticks)).toBe(true);
    expect(only.pts.every((point: { tick: number }) => Number.isInteger(point.tick))).toBe(true);
    expect(only.pts[0]).toMatchObject({ x: 1, y: 1, p: 1, tx: 0, ty: 0, tw: 0 });
    for (const forbidden of ['ms', 'timestamp', 'time', 'durationMs', 'elapsed', 'rawMs'] as const) {
      expect(only).not.toHaveProperty(forbidden);
    }
    expect(Number.isFinite(only.recordedOrder)).toBe(true);
    expect(only.playFrame === null || typeof only.playFrame === 'number').toBe(true);
  });

  it('FIELD-MAPPING: cuisson vs engine diffusionFrames — 30 → 30, over-cap → engine ceiling, absent → 0', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript).toBeTypeOf('function');
    const thirty = schema.serializeRotoScript!(input({
      brushes: [{ primary: stroke(), continuations: [stroke({ points: [], diffusionFrames: 30 })] }],
    }));
    expect(thirty.strokes[1].cuisson).toBe(30);
    expect(thirty.strokes[1].engine.diffusionFrames).toBe(30);

    const overCap = schema.serializeRotoScript!(input({
      brushes: [{ primary: stroke(), continuations: [stroke({ points: [], diffusionFrames: 700 })] }],
    }));
    expect(overCap.strokes[1].cuisson).toBe(600);
    expect(overCap.strokes[1].engine.diffusionFrames).toBe(600);

    const absent = schema.serializeRotoScript!(input({
      brushes: [{ primary: stroke(), continuations: [] }],
    }));
    expect(absent.strokes[0].cuisson).toBe(0);
    expect(absent.strokes[0].engine.diffusionFrames).toBeUndefined();
  });

  it('FIELD-MAPPING: strokes[] reconstruction — group(primary,[cont]) flattens and parse rebuilds the same group', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript).toBeTypeOf('function');
    expect(schema.parseRotoScript).toBeTypeOf('function');
    const value = schema.serializeRotoScript!(input({
      brushes: [{ primary: threePointStroke(), continuations: [stroke({ points: [], diffusionFrames: 4 })] }],
    }));
    expect(value.strokes).toHaveLength(2);
    expect(value.strokes[0].cuisson).toBe(0);
    expect(value.strokes[1].cuisson).toBe(4);

    const parsed = schema.parseRotoScript!(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document.strokes).toHaveLength(2);
    const runtime = schema.persistedRotoScriptToRuntime!(parsed.document);
    expect(runtime.brushes).toHaveLength(1);
    expect(runtime.brushes[0].primary.points).toHaveLength(3);
    expect(runtime.brushes[0].continuations).toHaveLength(1);
    expect(runtime.brushes[0].continuations[0].diffusionFrames).toBe(4);
  });

  it('FIELD-MAPPING: brushPack is the pinned empty snapshot and parse round-trips it', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript).toBeTypeOf('function');
    const value = schema.serializeRotoScript!(input({
      brushes: [{ primary: stroke({ physicsMode: 'local' }), continuations: [] }],
    }));
    expect(value.brushPack).toEqual({ kind: 'efx-physic-paint', entries: [] });
    const parsed = schema.parseRotoScript!(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document.brushPack).toEqual({ kind: 'efx-physic-paint', entries: [] });
  });

  it('FIELD-MAPPING: shared stroke law — motion null, brushId, toolOverrides, traceSeed, recordedOrder, playFrame', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript).toBeTypeOf('function');
    const value = schema.serializeRotoScript!(input({
      brushes: [{ primary: threePointStroke(), continuations: [] }],
    }));
    const only = value.strokes[0];
    expect(only.motion).toBeNull();
    expect(only.brushId).toBe('efx-physic-paint');
    expect(only.toolOverrides).toEqual({});
    expect(Number.isFinite(only.traceSeed)).toBe(true);
    expect(only.recordedOrder).toBe(123);
    expect(only.playFrame).toBe(7);
  });

  it('parse of a legacy-kind fixture returns the clean-break refusal and never a script', async () => {
    const schema = await loadSchema();
    expect(schema.parseRotoScript).toBeTypeOf('function');
    const legacy = {
      kind: LEGACY_KIND,
      schemaVersion: 1,
      id,
      name: 'Old',
      createdAt: '2026-07-16T12:00:00.000Z',
      updatedAt: '2026-07-16T12:00:00.000Z',
      source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 12, width: 1920, height: 1080, background: { background: 'canvas2', grainStrength: 0.6 } },
      thumbnail: { mimeType: 'image/webp', width: 1, height: 1, quality: 0.8, dataUrl: webp },
      brushes: [{ primary: stroke(), continuations: [] }],
    };
    const parsed = schema.parseRotoScript!(legacy);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.refusal.code).toBe('unreadable-legacy-script');
  });

  it('parse refuses unknown engineId and garbage with named codes', async () => {
    const schema = await loadSchema();
    expect(schema.parseRotoScript).toBeTypeOf('function');
    const base = schema.serializeRotoScript!(input({
      brushes: [{ primary: stroke({ physicsMode: 'local' }), continuations: [] }],
    }));
    const unknownEngine = schema.parseRotoScript!({ ...base, engineId: 'other' });
    expect(unknownEngine.ok).toBe(false);
    if (!unknownEngine.ok) expect(unknownEngine.refusal.code).toBe('unknown-engine-id');

    const garbage = schema.parseRotoScript!(null);
    expect(garbage.ok).toBe(false);
    if (!garbage.ok) expect(garbage.refusal.code).toBe('malformed-engine-payload');
  });

  it('preserves every current physics mode in the engine slot and runtime reconstruction', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript).toBeTypeOf('function');
    for (const physicsMode of ['local', 'last', 'all', null] as const) {
      const value = schema.serializeRotoScript!(input({
        brushes: [{ primary: stroke({ physicsMode }), continuations: [stroke({ mutationId: 10, points: [], diffusionFrames: 4 })] }],
      }));
      expect(value.strokes[0].engine.physicsMode).toBe(physicsMode);
      const parsed = schema.parseRotoScript!(value);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(schema.persistedRotoScriptToRuntime!(parsed.document).brushes[0].primary.physicsMode).toBe(physicsMode);
    }
  });

  it('creates fresh runtime and row objects without aliasing persisted input', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript).toBeTypeOf('function');
    const value = schema.serializeRotoScript!(input({
      brushes: [{ primary: stroke({ physicsMode: 'local' }), continuations: [stroke({ mutationId: 10, points: [], diffusionFrames: 4 })] }],
    }));
    const runtime = schema.persistedRotoScriptToRuntime!(value);
    const row = schema.rotoScriptLibraryRow!(value, 'revision', 'a'.repeat(64));
    expect(runtime.brushes[0].primary.points[0]).not.toBe(value.strokes[0].pts[0]);
    expect(row.source).not.toBe(value.source);
    expect(row.thumbnail).not.toBe(value.thumbnail);
  });

  it('accepts safe unknown optional fields and rejects malformed versions, dates, ids and WebP metadata', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript, 'schema must export serializeRotoScript').toBeTypeOf('function');
    expect(schema.isPersistedRotoScriptV1).toBeTypeOf('function');
    const base = schema.serializeRotoScript!(input({
      brushes: [{ primary: stroke({ physicsMode: 'local' }), continuations: [] }],
    }));
    const value = structuredClone(base) as any;
    value.futureOptional = { safe: true };
    expect(schema.isPersistedRotoScriptV1!(value)).toBe(true);
    for (const mutate of [
      (copy: any) => { copy.schemaVersion = 2; },
      (copy: any) => { copy.id = '../escape'; },
      (copy: any) => { copy.updatedAt = '2026-07-15T00:00:00Z'; },
      (copy: any) => { copy.engineId = 'other'; },
      (copy: any) => { copy.strokes[0].recordedOrder = Number.MAX_SAFE_INTEGER + 1; },
      (copy: any) => { copy.strokes[0].engine.physicsMode = 'global'; },
      (copy: any) => { copy.strokes[0].pts[0].p = 2; },
      (copy: any) => { copy.thumbnail.width = 2; },
      (copy: any) => { copy.thumbnail.dataUrl = 'data:image/png;base64,AAAA'; },
    ]) {
      const copy = structuredClone(base); mutate(copy); expect(schema.isPersistedRotoScriptV1!(copy)).toBe(false);
    }
    expect(schema.isPersistedRotoScriptV1!({ ...base, kind: LEGACY_KIND })).toBe(false);
  });

  // 260925-iy6: the engine's `|| 0` round-trip must not leak diffusionFrames: 0
  // into the persisted engine slot or the shared cuisson.
  it('drops the engine round-trip diffusionFrames: 0 so primaries stay persistable', async () => {
    const schema = await loadSchema();
    expect(schema.createPersistedRotoScript, 'schema must export createPersistedRotoScript').toBeTypeOf('function');
    expect(schema.serializeRotoScript, 'schema must export serializeRotoScript').toBeTypeOf('function');
    const value = schema.createPersistedRotoScript!(input({
      brushes: [{ primary: stroke({ diffusionFrames: 0 }), continuations: [] }],
    }));
    expect(value.strokes[0].engine).not.toHaveProperty('diffusionFrames');
    expect(value.strokes[0].cuisson).toBe(0);
    expect(schema.isPersistedRotoScriptV1!(value)).toBe(true);
  });

  // 260925-iy6: raw engine pen values must project into the shared point contract.
  it('projects raw engine pen values into the v1 point contract instead of rejecting them', async () => {
    const schema = await loadSchema();
    expect(schema.serializeRotoScript, 'schema must export serializeRotoScript').toBeTypeOf('function');
    const value = schema.createPersistedRotoScript!(input({
      brushes: [{
        primary: stroke({
          points: [{ x: 1, y: 2, p: 1.4, tx: -95, ty: 120, tw: 400, spd: 240_000 }],
          params: { size: 12, opacity: 90, pressure: 80, waterAmount: 70, dryAmount: 60, edgeDetail: 50, pickup: 40, eraseStrength: 30, antiAlias: 2.5 },
        }),
        continuations: [stroke({ mutationId: 10, points: [], diffusionFrames: 1200 })],
      }],
    }));
    expect(value.strokes[0].pts[0]).toMatchObject({ x: 1, y: 2, p: 1, tx: -90, ty: 90, tw: 360 });
    expect(value.strokes[0].engine.params.antiAlias).toBe(3);
    expect(value.strokes[1].cuisson).toBe(600);
    expect(value.strokes[1].engine.diffusionFrames).toBe(600);
    expect(schema.isPersistedRotoScriptV1!(value)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 261018-odm: dual-engine aquarelle variant (ODM-01)
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

  it('parseRotoScript accepts both engineIds and rejects a third with engine-mismatch', async () => {
    const schema = await loadSchema();
    expect(schema.parseRotoScript).toBeTypeOf('function');
    const engine1 = schema.serializeRotoScript!(input({
      brushes: [{ primary: stroke({ physicsMode: 'local' }), continuations: [] }],
    }));
    const aquarelle = schema.serializeAquarelleRotoScript!(aquarelleInput({
      events: [aquarelleStrokeEvent()],
    }));
    expect(schema.parseRotoScript!(engine1).ok).toBe(true);
    expect(schema.parseRotoScript!(aquarelle).ok).toBe(true);

    const foreign = schema.parseRotoScript!({ ...aquarelle, engineId: 'efx-krita' });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.refusal.code).toBe('engine-mismatch');
      expect(foreign.refusal.detail).toBe(`efx-krita:${schema.ROTO_SCRIPT_ENGINE_ID}`);
    }
  });

  it('isEnginePayload dispatches on the document engineId — an engine-1 tool id refuses on an aquarelle document', async () => {
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
    // One non-Dry stroke group per primary, projected into engine-1 pixel space.
    expect(runtime.brushes).toHaveLength(2);
    expect(runtime.brushes[0].primary.points).toHaveLength(3);
    // UV y-up 0.75 → pixel y-down (1 - 0.75) * 1080 = 270.
    expect(runtime.brushes[0].primary.points[0]).toMatchObject({ x: 0.25 * 1920, y: (1 - 0.75) * 1080 });
  });

  it('rotoScriptLibraryRow brushCount skips Dry markers on an aquarelle document', async () => {
    const schema = await loadSchema();
    expect(schema.serializeAquarelleRotoScript).toBeTypeOf('function');
    const value = schema.serializeAquarelleRotoScript!(aquarelleInput());
    const row = schema.rotoScriptLibraryRow!(value, 'revision', 'a'.repeat(64));
    expect(row.brushCount).toBe(2);
  });

  it('engine-1 runtime output stays equivalent to today and the aquarelle round-trip keeps counts', async () => {
    const schema = await loadSchema();
    const engine1 = schema.serializeRotoScript!(input({
      brushes: [{ primary: threePointStroke(), continuations: [stroke({ mutationId: 10, points: [], diffusionFrames: 4 })] }],
    }));
    const engine1Runtime = schema.persistedRotoScriptToRuntime!(engine1);
    expect(engine1Runtime.engineId).toBe('efx-physic-paint');
    expect(engine1Runtime.aquarelleEvents).toBeUndefined();
    expect(engine1Runtime.brushes).toHaveLength(1);
    expect(engine1Runtime.brushes[0].continuations).toHaveLength(1);

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
