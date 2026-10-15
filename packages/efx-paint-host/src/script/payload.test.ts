// ============================================================
//  RED/GREEN coverage for the generic StudioScriptEnvelope<P>
//  contract and the fail-closed parseStudioScriptEnvelope
//  (HOST-02 / D-19). Type imports are erased at runtime so this
//  suite runs even when ./payload is not yet implemented; the
//  parse cases load ./parse dynamically so RED fails on an
//  assertion, not a collection error.
// ============================================================

import { describe, expect, it } from 'vitest'
import type {
  BrushPackSnapshot,
  EngineAdapter,
  EngineId,
  StudioScriptEnvelope,
  StudioScriptSource,
  StudioScriptThumbnail,
  StudioStroke,
  StudioStrokeMotion,
  StudioPoint,
} from './payload'

// ---------------------------------------------------------------------------
// Lazy loader — RED: ./parse does not exist, so parse is undefined and the
// assertion below is the intentional failure.  GREEN: the real module loads.
// ---------------------------------------------------------------------------
type ParseFn = (raw: unknown) => StudioScriptEnvelope<unknown> | null

async function loadParse(): Promise<ParseFn | undefined> {
  try {
    const mod: { parseStudioScriptEnvelope?: ParseFn } = await import('./parse')
    return mod.parseStudioScriptEnvelope
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Synthetic well-formed envelope / stroke builders
// ---------------------------------------------------------------------------

const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000'
const ISO_EARLY = '2026-01-01T00:00:00.000Z'
const ISO_LATE = '2026-01-02T00:00:00.000Z'

function makePoint(overrides: Partial<StudioPoint> = {}): StudioPoint {
  return { x: 10, y: 20, p: 0.5, tx: 0, ty: 0, tw: 0, tick: 0, ...overrides }
}

function makeMotion(overrides: Partial<StudioStrokeMotion> = {}): StudioStrokeMotion {
  return { strokeDeformation: 30, strokePosition: 10, ...overrides }
}

function makeStroke(overrides: Partial<StudioStroke<unknown>> = {}): StudioStroke<unknown> {
  return {
    pts: [makePoint(), makePoint({ tick: 1, x: 12, y: 22 })],
    ticks: 12,
    cuisson: 4,
    motion: makeMotion(),
    brushId: 'default-brush',
    toolOverrides: { opacity: 80 },
    traceSeed: 42,
    recordedOrder: 1,
    playFrame: null,
    color: null,
    engine: { opaque: true },
    ...overrides,
  }
}

function makeSource(overrides: Partial<StudioScriptSource> = {}): StudioScriptSource {
  return {
    projectName: 'Test Project',
    layerId: 'layer-1',
    layerName: 'Paint',
    sourceFrame: 0,
    displayFrame: 3,
    width: 1920,
    height: 1080,
    ...overrides,
  }
}

function makeThumbnail(overrides: Partial<StudioScriptThumbnail> = {}): StudioScriptThumbnail {
  return {
    mimeType: 'image/webp',
    width: 96,
    height: 64,
    quality: 0.8,
    dataUrl: 'data:image/webp;base64,AAAA',
    ...overrides,
  }
}

function makeBrushPack(overrides: Partial<BrushPackSnapshot> = {}): BrushPackSnapshot {
  return {
    kind: 'efx-physic-paint-brush-pack',
    entries: [],
    ...overrides,
  }
}

function makeEnvelope(
  overrides: Partial<StudioScriptEnvelope<unknown>> = {},
): StudioScriptEnvelope<unknown> {
  return {
    kind: 'efx-studio-paint-script',
    schemaVersion: 1,
    engineId: 'efx-physic-paint',
    id: VALID_UUID,
    name: 'Test Script',
    createdAt: ISO_EARLY,
    updatedAt: ISO_LATE,
    source: makeSource(),
    thumbnail: makeThumbnail(),
    brushPack: makeBrushPack(),
    strokes: [makeStroke()],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// (3) Type-level assertion — this file imports StudioStroke<unknown> and
//     EngineAdapter<unknown> from ./payload and nothing from efx-physic-paint.
//     If those types were not exported, or required engine-1, this file would
//     not compile.
// ---------------------------------------------------------------------------

describe('generic host contract compiles without engine-1 imports', () => {
  it('StudioStroke<unknown> accepts a synthetic stroke with an opaque engine slot', () => {
    const stroke: StudioStroke<unknown> = makeStroke({
      engine: { custom: 'payload', nested: { arr: [1, 2, 3] } },
      recordedOrder: 7,
      playFrame: 5,
    })
    expect(stroke.engine).toEqual({ custom: 'payload', nested: { arr: [1, 2, 3] } })
    expect(stroke.recordedOrder).toBe(7)
    expect(stroke.playFrame).toBe(5)
  })

  it('EngineAdapter<unknown> exposes the one plug-point surface', () => {
    const stub: EngineAdapter<unknown> = {
      engineId: 'efx-watercolor',
      payloadCodec: {
        serialize: (stroke: unknown) => stroke as StudioStroke<unknown>,
        parse: () => null,
      },
      setInputLocked: () => {},
      setAnimationMode: () => {},
      getStrokes: () => [],
      renderPartialStrokes: () => {},
      renderAllStrokes: () => {},
      exportCompositeCanvas: () => null as unknown as HTMLCanvasElement,
      applyStroke: () => {},
      stepTick: () => {},
      captureFrame: () => null as unknown as CanvasImageSource,
      dispose: () => {},
    }
    expect(stub.engineId).toBe('efx-watercolor')
    expect(typeof stub.payloadCodec.parse).toBe('function')
    expect(typeof stub.applyStroke).toBe('function')
    expect(typeof stub.stepTick).toBe('function')
    expect(typeof stub.captureFrame).toBe('function')
    expect(typeof stub.dispose).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// (1) + (4) Well-formed envelope round-trips shared fields and preserves the
//     opaque engine slot.
// ---------------------------------------------------------------------------

describe('parseStudioScriptEnvelope — well-formed envelope', () => {
  it('round-trips shared fields including recordedOrder and playFrame', async () => {
    const parse = await loadParse()
    expect(parse, './parse must export parseStudioScriptEnvelope').toBeTypeOf('function')
    if (!parse) return

    const enginePayload = { custom: 'data', nested: { arr: [1, 2, 3], str: 'hello' } }
    const envelope = makeEnvelope({
      strokes: [
        makeStroke({ recordedOrder: 42, playFrame: 7, engine: enginePayload }),
        makeStroke({ recordedOrder: 43, playFrame: null, engine: { other: true } }),
      ],
    })

    const parsed = parse(envelope)
    expect(parsed).not.toBeNull()
    if (!parsed) return

    expect(parsed.kind).toBe('efx-studio-paint-script')
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.engineId).toBe('efx-physic-paint')
    expect(parsed.id).toBe(VALID_UUID)
    expect(parsed.name).toBe('Test Script')
    expect(parsed.createdAt).toBe(ISO_EARLY)
    expect(parsed.updatedAt).toBe(ISO_LATE)
    expect(parsed.strokes).toHaveLength(2)

    expect(parsed.strokes[0].recordedOrder).toBe(42)
    expect(parsed.strokes[0].playFrame).toBe(7)
    expect(parsed.strokes[1].recordedOrder).toBe(43)
    expect(parsed.strokes[1].playFrame).toBeNull()
  })

  it('leaves the engine slot byte-identical (host never reads P)', async () => {
    const parse = await loadParse()
    expect(parse, './parse must export parseStudioScriptEnvelope').toBeTypeOf('function')
    if (!parse) return

    const enginePayload = { custom: 'data', nested: { arr: [1, 2, 3], str: 'hello' } }
    const envelope = makeEnvelope({
      strokes: [makeStroke({ engine: enginePayload })],
    })

    const parsed = parse(envelope)
    expect(parsed).not.toBeNull()
    if (!parsed) return

    // Same reference proves the host copied P through without inspecting or cloning it.
    expect(parsed.strokes[0].engine).toBe(enginePayload)
    expect(JSON.stringify(parsed.strokes[0].engine)).toBe(JSON.stringify(enginePayload))
  })

  it('round-trips the shared stroke shape (pts, ticks, cuisson, motion, brushId, toolOverrides, traceSeed)', async () => {
    const parse = await loadParse()
    expect(parse, './parse must export parseStudioScriptEnvelope').toBeTypeOf('function')
    if (!parse) return

    const envelope = makeEnvelope({ strokes: [makeStroke()] })
    const parsed = parse(envelope)
    expect(parsed).not.toBeNull()
    if (!parsed) return

    const stroke = parsed.strokes[0]
    expect(stroke.pts).toHaveLength(2)
    expect(stroke.pts[0].tick).toBe(0)
    expect(stroke.pts[1].tick).toBe(1)
    expect(stroke.ticks).toBe(12)
    expect(stroke.cuisson).toBe(4)
    expect(stroke.motion).toEqual({ strokeDeformation: 30, strokePosition: 10 })
    expect(stroke.brushId).toBe('default-brush')
    expect(stroke.toolOverrides).toEqual({ opacity: 80 })
    expect(stroke.traceSeed).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// (2) Named failures — each returns null without throwing.
// ---------------------------------------------------------------------------

describe('parseStudioScriptEnvelope — named failures return null', () => {
  it.each([
    [
      "wrong kind 'efx-physics-paint-roto-script'",
      (e: Record<string, unknown>) => ({ ...e, kind: 'efx-physics-paint-roto-script' }),
    ],
    [
      'schemaVersion 0',
      (e: Record<string, unknown>) => ({ ...e, schemaVersion: 0 }),
    ],
    [
      "engineId 'other-engine'",
      (e: Record<string, unknown>) => ({ ...e, engineId: 'other-engine' }),
    ],
    [
      "createdAt 'not-iso'",
      (e: Record<string, unknown>) => ({ ...e, createdAt: 'not-iso' }),
    ],
    [
      'updatedAt earlier than createdAt',
      (e: Record<string, unknown>) => ({ ...e, createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' }),
    ],
    [
      "id 'nope'",
      (e: Record<string, unknown>) => ({ ...e, id: 'nope' }),
    ],
    [
      "name '   ' (whitespace only)",
      (e: Record<string, unknown>) => ({ ...e, name: '   ' }),
    ],
    [
      'missing thumbnail',
      (e: Record<string, unknown>) => {
        const { thumbnail: _thumbnail, ...rest } = e
        return rest
      },
    ],
    [
      "strokes 'nope' (not an array)",
      (e: Record<string, unknown>) => ({ ...e, strokes: 'nope' }),
    ],
    [
      'missing source',
      (e: Record<string, unknown>) => {
        const { source: _source, ...rest } = e
        return rest
      },
    ],
    [
      'missing brushPack',
      (e: Record<string, unknown>) => {
        const { brushPack: _brushPack, ...rest } = e
        return rest
      },
    ],
    [
      'non-object raw input',
      () => 'nope' as unknown as Record<string, unknown>,
    ],
  ])('returns null on %s without throwing', async (_label, mutate) => {
    const parse = await loadParse()
    expect(parse, './parse must export parseStudioScriptEnvelope').toBeTypeOf('function')
    if (!parse) return

    const base = makeEnvelope() as unknown as Record<string, unknown>
    const bad = mutate(base)

    expect(() => parse(bad)).not.toThrow()
    expect(parse(bad)).toBeNull()
  })
})
