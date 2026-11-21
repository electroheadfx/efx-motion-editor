// ============================================================
//  engineTraceSpacing — the bristle dab floor and the loop guard.
//
//  The artist (2026-11-21): "the acrylic small-brush is very slow
//  below ~30 px". `trace()` emits dabs every `radius * spacingFrac`
//  with no floor, so on a 1080-tall sheet a Size 1 Bristle Round
//  deposits a dab every ~0.40 device px — several dabs per pixel,
//  each ~9 draws. The floor caps that at one dab per device pixel
//  and multiplies exactly that dab's ink by the ratio it applied,
//  the mirror of the shipped supersampling law (which divides
//  spacing and amount by the same factor), so wash per distance is
//  unchanged.
//
//  The same pass closes a latent hang: when a pressure/width drop
//  shrinks the spacing below the carried arc length,
//  `pos += spacing - s.carry` never advances and `trace()` spins.
//
//  No WebGL2 is required: every law below is read off a real
//  `WatercolorEngine.prototype` instance whose fields are seeded by
//  hand (the `engineScriptWidth.test.ts` precedent), and the dab
//  loop is driven through `trace()` with `stampScripted` replaced
//  by a recorder. The recorder THROWS once the count passes 10 000
//  — a regression fails fast with a named error instead of hanging
//  vitest on a synchronous infinite loop.
//
//  The real-pixel proof lives in probe/small-brush (`--compare`).
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BRUSH_PRESETS, buildBrush, type Brush, type BrushPreset } from './brushes'
import { WatercolorEngine } from './Engine'

const ENGINE_SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'Engine.ts'),
  'utf8',
)

/** Load a preset by id — a missing preset is a table regression, not a skip. */
function preset(id: string): BrushPreset {
  const found = BRUSH_PRESETS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`brush preset '${id}' is missing`)
  return found
}

const BRISTLE_ROUND: Brush = buildBrush(preset('bristle-round'))
const ROUND: Brush = buildBrush(preset('round'))

// --- the shipped constants, written LITERALLY --------------------------------
//
// radius() -> brushRadius() at pressure 0, speed 0, widthFactor 1:
//   (0.011 + (0.05 - 0.011) * 0^pressureSize) * clamp(1 - 0 * speedThin) *
//   3^((size - 0.5) * 2) * 0.8
// spacingFrac('brush') = 0.14 * sqrt(0.7) / samplingScale().
// These are composed from the presets and the mapping's public constants —
// never read back off the engine — so a change to radius(), spacingFrac() or
// samplingScale() cannot satisfy a test by moving both sides.

const DH = 1080
const START_X = 0.1
const END_X = 0.2
const Y = 0.5
const MAX_DABS = 10000

const BRISTLE_MIN_RADIUS = 0.011
const BRISTLE_RADIUS_0_8 = 0.8
const BRISTLE_ROUND_SPACING = 0.14
const BRISTLE_ROUND_ASPECT = 0.7
const ROUND_SPACING = 0.3
const ROUND_ASPECT = 1

/** sizeToEngineScale's two bands for the sizes this suite uses. */
const SIZE_1 = 1 / 32
const SIZE_10 = 10 / 32
const SIZE_30 = 30 / 32
const SIZE_100 = 1 + ((100 - 80) / (800 - 80)) * (2.04795 - 1)

function sizeMult(scale: number): number {
  return Math.pow(3, (scale - 0.5) * 2)
}

/** The bristle preset's radius at pressure 0, speed 0, width factor 1. */
function bristleRadius(scale: number): number {
  return BRISTLE_MIN_RADIUS * sizeMult(scale) * BRISTLE_RADIUS_0_8
}

/** bristleSampleScale at the canonical sizes: 1x below 100, 2x at 100. */
function samplingScale(sizePx: number): number {
  return sizePx >= 100 ? 2 : 1
}

/** spacingFrac('brush') for Bristle Round at a canonical size. */
function bristleSpacingFrac(sizePx: number): number {
  return (BRISTLE_ROUND_SPACING * Math.sqrt(BRISTLE_ROUND_ASPECT)) / samplingScale(sizePx)
}

/** One device pixel in document heights. */
const FLOOR = 1 / DH

// --- prototype-created engine, fields seeded by hand ------------------------

interface StrokeLike {
  tool: 'brush' | 'water' | 'pen' | 'lift'
  x: number
  y: number
  pr: number
  speed: number
  carry: number
  travelled: number
  dx: number
  dy: number
  widthFrom: number
  widthTo: number
  pigFrom: null
  pigTo: null
}

interface RecordedDab {
  x: number
  y: number
  widthFactor: number
  colorFraction: number
  amountScale: number | undefined
}

interface EngineInternals {
  dw: number
  dh: number
  params: { size: number }
  brush: Brush
  // `scripting` is a prototype GETTER (`stroke?.pointerId === SCRIPT_POINTER`);
  // leaving `stroke` unset makes it false, so a hand-seeded engine is a
  // pointer-shaped (non-scripted) one.
  scriptScale: number
  lastDir: [number, number]
  lastAngle: number
  recordedDabs: RecordedDab[]
  trace: (
    s: StrokeLike,
    qx: number,
    qy: number,
    ex: number,
    ey: number,
    pr: number,
    vx: number,
    vy: number,
  ) => void
  stampScripted: (
    s: StrokeLike,
    x: number,
    y: number,
    pr: number,
    vx: number,
    vy: number,
    moving: number,
    dt: number,
    widthFactor: number,
    colorFraction: number,
    amountScale?: number,
  ) => void
}

/** A prototype-created engine: no WebGL2 surface, every field the laws read. */
function makeEngine(sizeScale: number, brush: Brush): EngineInternals {
  const engine = Object.create(WatercolorEngine.prototype) as unknown as EngineInternals
  engine.dw = DH
  engine.dh = DH
  engine.params = { size: sizeScale }
  engine.brush = brush
  engine.scriptScale = 1
  engine.lastDir = [1, 0]
  engine.lastAngle = 0
  engine.recordedDabs = []
  engine.stampScripted = (s, x, y, _pr, _vx, _vy, _moving, _dt, widthFactor, colorFraction, amountScale) => {
    if (engine.recordedDabs.length >= MAX_DABS) {
      throw new Error(
        `runaway dab loop: more than ${MAX_DABS} dabs recorded — trace() did not terminate`,
      )
    }
    engine.recordedDabs.push({ x, y, widthFactor, colorFraction, amountScale })
  }
  return engine
}

function makeStroke(tool: StrokeLike['tool'] = 'brush'): StrokeLike {
  return {
    tool,
    x: START_X,
    y: Y,
    pr: 0,
    speed: 0,
    carry: 0,
    travelled: 0,
    dx: 1,
    dy: 0,
    widthFrom: 1,
    widthTo: 1,
    pigFrom: null,
    pigTo: null,
  }
}

/** One straight horizontal trace of 0.1 doc = 108 device px. */
function traceStraight(engine: EngineInternals, stroke: StrokeLike, pr0: number, pr: number): void {
  stroke.pr = pr0
  engine.trace(stroke, END_X, Y, END_X, Y, pr, 0, 0)
}

/** Euclidean distance between consecutive dabs, in document heights. */
function gaps(dabs: RecordedDab[]): number[] {
  const out: number[] = []
  for (let i = 1; i < dabs.length; i += 1) {
    const a = dabs[i - 1]!
    const b = dabs[i]!
    out.push(Math.hypot(b.x - a.x, b.y - a.y))
  }
  return out
}

describe('trace() dab spacing — the bristle one-device-pixel floor', () => {
  it('floors a Size 1 Bristle Round at one device pixel and emits ~1 dab per device px', () => {
    const engine = makeEngine(SIZE_1, BRISTLE_ROUND)
    const stroke = makeStroke()
    traceStraight(engine, stroke, 0, 0)
    const dabs = engine.recordedDabs
    const travelledPx = stroke.travelled * DH

    expect(dabs.length).toBeGreaterThan(0)
    // The floor's SHAPE: one dab per device pixel of travel.
    expect(Math.abs(dabs.length - travelledPx) / travelledPx).toBeLessThan(0.05)
    // No two dabs closer than one device pixel (the shipped 0.397 px would fail).
    for (const gap of gaps(dabs)) {
      expect(gap).toBeGreaterThanOrEqual(FLOOR - 1e-12)
      expect(gap).toBeCloseTo(FLOOR, 12)
    }
  })

  it('leaves Size 30 and Size 100 on the shipped spacing with a unit amount multiplier', () => {
    const cases = [
      { scale: SIZE_30, sizePx: 30 },
      { scale: SIZE_100, sizePx: 100 },
    ]
    for (const { scale, sizePx } of cases) {
      const engine = makeEngine(scale, BRISTLE_ROUND)
      const stroke = makeStroke()
      traceStraight(engine, stroke, 0, 0)
      const expected = bristleRadius(scale) * bristleSpacingFrac(sizePx)
      // Scene sanity: this size really is ABOVE the floor (it measures the
      // inert path the byte-identity rows depend on).
      expect(expected * DH).toBeGreaterThan(1)

      expect(engine.recordedDabs.length).toBeGreaterThan(0)
      for (const gap of gaps(engine.recordedDabs)) {
        expect(gap).toBeCloseTo(expected, 12)
      }
      for (const dab of engine.recordedDabs) {
        expect(dab.amountScale).toBe(1)
      }
    }
  })

  it('keeps the shipped spacing and a unit multiplier outside the bristle scope', () => {
    // (i) a non-bristle response on tool 'brush' at Size 1
    const brushEngine = makeEngine(SIZE_1, ROUND)
    const brushStroke = makeStroke('brush')
    traceStraight(brushEngine, brushStroke, 0, 0)
    const roundSpacing = 0.011 * sizeMult(SIZE_1) * BRISTLE_RADIUS_0_8 *
      (ROUND_SPACING * Math.sqrt(ROUND_ASPECT))
    expect(brushEngine.recordedDabs.length).toBeGreaterThan(0)
    for (const gap of gaps(brushEngine.recordedDabs)) {
      expect(gap).toBeCloseTo(roundSpacing, 12)
    }
    for (const dab of brushEngine.recordedDabs) {
      expect(dab.amountScale).toBe(1)
    }

    // (ii) tool 'water' carrying the bristle brush keeps its shipped law
    // (radius()'s water branch: 1.3x at speed 0; spacingFrac has no
    // samplingScale division outside tool 'brush').
    const waterEngine = makeEngine(SIZE_1, BRISTLE_ROUND)
    const waterStroke = makeStroke('water')
    traceStraight(waterEngine, waterStroke, 0, 0)
    const waterSpacing =
      0.011 * sizeMult(SIZE_1) * BRISTLE_RADIUS_0_8 * 1.3 *
      (BRISTLE_ROUND_SPACING * Math.sqrt(BRISTLE_ROUND_ASPECT))
    expect(waterEngine.recordedDabs.length).toBeGreaterThan(0)
    for (const gap of gaps(waterEngine.recordedDabs)) {
      expect(gap).toBeCloseTo(waterSpacing, 12)
    }
    for (const dab of waterEngine.recordedDabs) {
      expect(dab.amountScale).toBe(1)
    }
  })

  it('compensates a floored Size 1 dab by exactly floor / shipped spacing', () => {
    const engine = makeEngine(SIZE_1, BRISTLE_ROUND)
    const stroke = makeStroke()
    traceStraight(engine, stroke, 0, 0)
    const shipped = bristleRadius(SIZE_1) * bristleSpacingFrac(1)
    const expected = FLOOR / shipped

    expect(engine.recordedDabs.length).toBeGreaterThan(0)
    for (const dab of engine.recordedDabs) {
      expect(dab.amountScale).toBe(expected)
    }
  })
})

describe('trace() dab loop — termination guard', () => {
  it('spends an oversized carry as one catch-up dab at the segment start', () => {
    const engine = makeEngine(SIZE_30, BRISTLE_ROUND)
    const stroke = makeStroke()
    // Far beyond any spacing this scene can produce: the shipped loop steps
    // backwards (pos goes negative) and stamps before the segment start.
    stroke.carry = 0.05
    traceStraight(engine, stroke, 0, 0)

    expect(engine.recordedDabs.length).toBeGreaterThan(0)
    expect(engine.recordedDabs.length).toBeLessThan(500)
    const first = engine.recordedDabs[0]!
    expect(first.x).toBeCloseTo(START_X, 12)
    expect(first.y).toBeCloseTo(Y, 12)
    // The trace completed: the stroke reached the segment's end.
    expect(stroke.x).toBeCloseTo(END_X, 12)
    expect(stroke.travelled).toBeCloseTo(END_X - START_X, 12)
  })

  it('finishes a sharp pressure drop (1 -> 0) without spinning', () => {
    const engine = makeEngine(SIZE_10, BRISTLE_ROUND)
    const stroke = makeStroke()
    traceStraight(engine, stroke, 1, 0)

    expect(engine.recordedDabs.length).toBeGreaterThan(0)
    expect(engine.recordedDabs.length).toBeLessThan(MAX_DABS)
    // Every dab stays inside the traced segment: a backwards step (the
    // shipped collapse) would stamp left of the start.
    for (const dab of engine.recordedDabs) {
      expect(dab.x).toBeGreaterThanOrEqual(START_X - 1e-12)
      expect(dab.x).toBeLessThanOrEqual(END_X + 1e-12)
    }
    expect(stroke.x).toBeCloseTo(END_X, 12)
  })

  it('records no dab and returns on a zero radius', () => {
    const engine = makeEngine(SIZE_10, BRISTLE_ROUND)
    const stroke = makeStroke()
    stroke.widthFrom = 0
    stroke.widthTo = 0
    traceStraight(engine, stroke, 0, 0)

    expect(engine.recordedDabs.length).toBe(0)
    expect(stroke.x).toBeCloseTo(END_X, 12)
    expect(stroke.travelled).toBeCloseTo(END_X - START_X, 12)
  })

  it('reaches the floor only through the existing bristle predicate', () => {
    // The scope is the expression processInput already uses; no third
    // predicate and no response-id literal may appear in the engine.
    expect(ENGINE_SOURCE).toContain('isBristleResponse(this.brush)')
    expect(ENGINE_SOURCE).not.toContain("'bristle-flat'")
    expect(ENGINE_SOURCE).not.toContain("'bristle-round'")
  })
})
