// ============================================================
//  codec.test.ts — aquarelle script codec + Dry ordering (56-06).
//
//  Standing pins for AQUA-05 / AQUA-06:
//    · serialize → parse round-trip deep-equals (strokes + Dry)
//    · Dry is a distinguished union member (D-16) — no pts, no
//      brush, no second events array
//    · tick quantisation (integers, never raw ms)
//    · DIFFUSION_CAP = 600 at serialize
//    · parse is total and fail-closed (malformed / unknown
//      schemaVersion → null, never throw)
//    · mixed stroke/dry replay order on (tick, recordedOrder)
//    · record → serialize → parse → replay is byte-identical
//
//  Family: determinismContract / engineAdapter / hostGenericity —
//  normal vitest .test.ts on the existing setup, no new config.
// ============================================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { hashMutationId } from '@efxlab/efx-paint-host'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import {
  AQUARELLE_SCHEMA_VERSION,
  parse,
  payloadCodec,
  serialize,
} from './codec'
import {
  comparePayloadEvents,
  isAquarelleDryEvent,
  type AquarelleDryEvent,
  type AquarellePayloadEvent,
} from './dryEvent'
import {
  DIFFUSION_CAP,
  toStudioStroke,
  type AquarelleStroke,
  type AquarelleStrokePayload,
} from './toStudioStroke'
import { createAquarelleEngineAdapter } from '../adapter/engineAdapter'

const PAYLOAD_DIR = resolve(dirname(fileURLToPath(import.meta.url)))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRuntimeStroke(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#2244aa',
    params: { size: 12, water: 50, flow: 50 },
    brushId: 'wc/round-medium',
    points: [
      { x: 20, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 28, y: 32, p: 0.6, tx: 0, ty: 0, tw: 0 },
      { x: 36, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 44, y: 32, p: 0.4, tx: 0, ty: 0, tw: 0 },
    ],
    toolOverrides: {
      tip: 1.2,
      aspect: 1,
      rotation: 1,
      sizeCurve: 1,
      scatter: 0.8,
      capacity: 1.1,
      grain: 1,
      wetRound: 0.9,
    },
    mutationId: 42,
    timestamp: 1000,
    ...overrides,
  }
}

function makeStrokeEvent(overrides: Partial<AquarelleStroke> = {}): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke(makeRuntimeStroke(overrides))
}

function makeDryEvent(tick: number, recordedOrder: number): AquarelleDryEvent {
  return { kind: 'dry', tick, recordedOrder }
}

/** Build a stroke whose ordering `ticks` equals `orderTick` (duration proxy). */
function makeStrokeWithOrderTick(orderTick: number, recordedOrder: number): StudioStroke<AquarelleStrokePayload> {
  const pointCount = orderTick + 1
  const points = Array.from({ length: pointCount }, (_, i) => ({
    x: 10 + i * 4,
    y: 32,
    p: 0.5,
    tx: 0,
    ty: 0,
    tw: 0,
  }))
  return toStudioStroke(makeRuntimeStroke({ points, timestamp: recordedOrder }))
}

function collectPayloadSources(): string {
  return readdirSync(PAYLOAD_DIR)
    .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
    .map((entry) => readFileSync(join(PAYLOAD_DIR, entry), 'utf8'))
    .join('\n')
}

// ---------------------------------------------------------------------------
// 1. toStudioStroke — tick quantisation + diffusionFrames cap (D-19)
// ---------------------------------------------------------------------------

describe('toStudioStroke tick quantisation and cap', () => {
  it('diffusionFrames=1000 clamps cuisson to DIFFUSION_CAP 600', () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ diffusionFrames: 1000 }))
    expect(stroke.cuisson).toBe(600)
    expect(stroke.cuisson).toBe(DIFFUSION_CAP)
  })

  it('diffusionFrames=0 or undefined yields cuisson === 0', () => {
    expect(toStudioStroke(makeRuntimeStroke({ diffusionFrames: 0 })).cuisson).toBe(0)
    expect(toStudioStroke(makeRuntimeStroke({ diffusionFrames: undefined })).cuisson).toBe(0)
  })

  it('pts ticks are integers (sample index), never floats or raw ms', () => {
    const stroke = toStudioStroke(makeRuntimeStroke())
    for (const [i, pt] of stroke.pts.entries()) {
      expect(Number.isInteger(pt.tick)).toBe(true)
      expect(pt.tick).toBe(i)
    }
    expect(Number.isInteger(stroke.ticks)).toBe(true)
    expect(Number.isInteger(stroke.cuisson)).toBe(true)
    expect(stroke.traceSeed).toBe(hashMutationId(42))
  })

  it('diffusionFrames > 600 clamps to 600 at serialize (engine bag + cuisson)', () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ diffusionFrames: 900 }))
    const wire = serialize(stroke)
    const parsed = parse(wire)
    expect(parsed).not.toBeNull()
    const round = parsed as StudioStroke<AquarelleStrokePayload>
    expect(round.cuisson).toBe(600)
    expect(round.engine.diffusionFrames ?? 0).toBeLessThanOrEqual(600)
  })
})

// ---------------------------------------------------------------------------
// 2. Round-trip — parse(serialize(x)) deep-equals x (AQUA-05)
// ---------------------------------------------------------------------------

describe('serialize → parse round-trip', () => {
  it('round-trips a stroke including toolOverrides and engine fields', () => {
    const stroke = makeStrokeEvent()
    const reparsed = parse(serialize(stroke))
    expect(reparsed).not.toBeNull()
    expect(reparsed).toEqual(stroke)
    const round = reparsed as StudioStroke<AquarelleStrokePayload>
    expect(round.toolOverrides).toEqual(stroke.toolOverrides)
    expect(round.engine.tool).toBe('brush')
    expect(round.engine.brushId).toBe('wc/round-medium')
    expect(round.engine.toolOverrides).toEqual(stroke.engine.toolOverrides)
    expect(round.traceSeed).toBe(hashMutationId(42))
  })

  it('round-trips a Dry event', () => {
    const dry = makeDryEvent(5, 2)
    const reparsed = parse(serialize(dry))
    expect(reparsed).not.toBeNull()
    expect(reparsed).toEqual(dry)
  })

  it('preserves stroke order and Dry-event order exactly (no sort, no dedupe)', () => {
    const events: AquarellePayloadEvent[] = [
      makeStrokeWithOrderTick(3, 10),
      makeDryEvent(5, 15),
      makeStrokeWithOrderTick(5, 20),
    ]
    const wireList = events.map((event) => serialize(event))
    const parsedList = wireList.map((wire) => parse(wire))
    expect(parsedList).toEqual(events)
  })
})

// ---------------------------------------------------------------------------
// 3. Dry event shape (D-16) — distinguished union member, one payload union
// ---------------------------------------------------------------------------

describe('Dry event is a distinguished payload union member (D-16)', () => {
  it("Dry event { kind: 'dry', tick } has no pts and no brush fields", () => {
    const dry = makeDryEvent(5, 2)
    expect(dry.kind).toBe('dry')
    expect(dry.tick).toBe(5)
    expect('pts' in dry).toBe(false)
    expect('brushId' in dry).toBe(false)
    expect('brush' in dry).toBe(false)
    expect('tool' in dry).toBe(false)
    expect(isAquarelleDryEvent(dry)).toBe(true)
    expect(isAquarelleDryEvent(makeStrokeEvent())).toBe(false)
  })

  it('Dry is a member of the same payload union as strokes (not a separate events array)', () => {
    const events: AquarellePayloadEvent[] = [makeDryEvent(1, 1), makeStrokeEvent()]
    expect(events).toHaveLength(2)
    expect(isAquarelleDryEvent(events[0])).toBe(true)
    expect(isAquarelleDryEvent(events[1])).toBe(false)
  })

  it('payload source has zero "events:" second-array markers (D-16)', () => {
    const source = collectPayloadSources()
    expect(/^\s*events\s*:/m.test(source)).toBe(false)
    // Word-boundary scan so prose like "unseeded RNG" never trips the pin.
    expect(/\bMath\.random\b/.test(source)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. Ordering law — total order on (tick, recordedOrder) (AQUA-05)
// ---------------------------------------------------------------------------

describe('Dry ordering (tick, recordedOrder)', () => {
  it('mixed [stroke(tick=3), dry(tick=5), stroke(tick=5)] replays stroke, dry, stroke', () => {
    const stroke3 = makeStrokeWithOrderTick(3, 10)
    const dry5 = makeDryEvent(5, 15)
    const stroke5 = makeStrokeWithOrderTick(5, 20)

    // Shuffle so a no-op comparator cannot pass by preserving input order.
    const shuffled: AquarellePayloadEvent[] = [stroke5, dry5, stroke3]
    const sorted = [...shuffled].sort(comparePayloadEvents)

    expect(sorted).toEqual([stroke3, dry5, stroke5])
  })

  it('equal ticks keep recordedOrder (total order, no unstable swap)', () => {
    const dryEarly = makeDryEvent(5, 10)
    const dryLate = makeDryEvent(5, 30)
    const strokeMid = makeStrokeWithOrderTick(5, 20)

    const shuffled: AquarellePayloadEvent[] = [dryLate, strokeMid, dryEarly]
    const sorted = [...shuffled].sort(comparePayloadEvents)
    expect(sorted).toEqual([dryEarly, strokeMid, dryLate])
  })

  it('a Dry at tick T applies after strokes with tick < T and before strokes with tick > T', () => {
    const before = makeStrokeWithOrderTick(4, 100)
    const dry = makeDryEvent(5, 200)
    const after = makeStrokeWithOrderTick(6, 300)
    const sorted = [after, dry, before].sort(comparePayloadEvents)
    expect(sorted).toEqual([before, dry, after])
  })
})

// ---------------------------------------------------------------------------
// 5. Fail-closed parse (T-56-17 / P5 / DATA-01)
// ---------------------------------------------------------------------------

describe('parse is total and fail-closed', () => {
  it('parse(malformed) returns null and never throws', () => {
    const malformed: unknown[] = [
      null,
      undefined,
      0,
      'not-json',
      [],
      {},
      { kind: 'dry' },
      { kind: 'dry', tick: 'nope', recordedOrder: 1 },
      { kind: 'dry', tick: 1.5, recordedOrder: 1 },
      { pts: 'nope' },
      { pts: [], ticks: 0, cuisson: -1 },
      { schemaVersion: AQUARELLE_SCHEMA_VERSION },
    ]
    for (const raw of malformed) {
      expect(() => parse(raw)).not.toThrow()
      expect(parse(raw)).toBeNull()
    }
  })

  it('parse(unknown schemaVersion) returns null (no dual-format reader)', () => {
    const stroke = makeStrokeEvent()
    const unknownVersion = { schemaVersion: 2, event: stroke }
    const missingVersion = { event: stroke }
    const zeroVersion = { schemaVersion: 0, event: stroke }
    expect(parse(unknownVersion)).toBeNull()
    expect(parse(missingVersion)).toBeNull()
    expect(parse(zeroVersion)).toBeNull()
  })

  it('parse accepts the exact AQUARELLE_SCHEMA_VERSION', () => {
    expect(AQUARELLE_SCHEMA_VERSION).toBe(1)
    const dry = makeDryEvent(3, 1)
    const parsed = parse({ schemaVersion: AQUARELLE_SCHEMA_VERSION, event: dry })
    expect(parsed).toEqual(dry)
  })
})

// ---------------------------------------------------------------------------
// 6. Determinism — record → serialize → parse → replay (AQUA-06)
// ---------------------------------------------------------------------------

function replayBytesFromParsed(): Uint8ClampedArray {
  const width = 64
  const height = 64
  const pixels = new Uint8ClampedArray(width * height * 4)
  const canvasRef: Record<string, unknown> = {
    width,
    height,
    getContext: (id: string) => {
      if (id !== '2d') return null
      return {
        canvas: canvasRef,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          width: w,
          height: h,
          data: pixels.slice(0, w * h * 4),
        }),
        putImageData: (imageData: { data: Uint8ClampedArray }) => {
          pixels.set(imageData.data.subarray(0, pixels.length))
        },
      }
    },
  }
  const adapter = createAquarelleEngineAdapter({
    width,
    height,
    canvas: canvasRef as unknown as HTMLCanvasElement,
  })

  const recorded = makeStrokeEvent()
  const wire = serialize(recorded)
  const parsed = parse(wire)
  expect(parsed).not.toBeNull()
  adapter.applyStroke(parsed as StudioStroke<AquarelleStrokePayload>)
  for (let tick = 0; tick <= 8; tick++) adapter.stepTick(tick)
  adapter.captureFrame()
  const copy = pixels.slice()
  adapter.dispose()
  return copy
}

describe('record → serialize → parse → replay determinism (AQUA-06)', () => {
  it('same script survives the codec and replays byte-identical pixels', () => {
    const a = replayBytesFromParsed()
    const b = replayBytesFromParsed()
    expect(a.length).toBe(b.length)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 7. payloadCodec seam (host never reads P)
// ---------------------------------------------------------------------------

describe('payloadCodec seam', () => {
  it('exposes serialize/parse matching the EngineAdapter contract', () => {
    expect(typeof payloadCodec.serialize).toBe('function')
    expect(typeof payloadCodec.parse).toBe('function')
  })

  it('serialize is total over the union (stroke and Dry) without throwing', () => {
    expect(() => serialize(makeStrokeEvent())).not.toThrow()
    expect(() => serialize(makeDryEvent(1, 1))).not.toThrow()
  })
})
