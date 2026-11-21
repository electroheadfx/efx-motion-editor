// ============================================================
//  small-brush/probe.ts — the acrylic small-brush dab density.
//
//  The artist (2026-11-21): "the acrylic small-brush is very slow
//  below ~30 px". `trace()` emits dabs every `radius * spacingFrac`
//  with no floor, so on a 1080-tall sheet a Size 1 Bristle Round
//  deposits a dab every ~0.40 device px — several dabs per pixel,
//  each ~9 draws.
//
//  This probe paints ONE straight bristle stroke over exactly 100
//  device px of a fixed 1080x1080 sheet, at four sizes, and reports
//  per size:
//    - the dab count (patched `stamp`),
//    - `spacingPx` and `floorBinds` (the engine's own radius and
//      spacing fraction — the evidence explains itself),
//    - the transparent and pigment export digests with byte lengths.
//  Sizes 30 and 100 sit ABOVE the one-device-pixel crossover on this
//  sheet, so their rows measure an INERT floor: any engine change
//  that alters them is a regression, not a trade.
//
//  The Size 10 row is also baked twice through two independent
//  adapters — the D-20 determinism contract (first paint vs re-bake).
//
//  The instrument is FROZEN between the BEFORE and AFTER captures:
//  editing this file voids the comparison.
//
//  Scratch harness; nothing here is imported by the package.
// ============================================================

import { WatercolorEngine } from '../../src/playground/Engine'
import { MEDIUMS } from '../../src/playground/mediums'
import { PAPERS, type PaperPreset } from '../../src/playground/papers'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import {
  toStudioStroke,
  type AquarellePoint,
  type AquarelleStrokePayload,
} from '../../src/payload/toStudioStroke'

const SHEET = 1080
const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
const MUTATION_ID = 0x6d65d1
const SETTLE_TICKS = 8
const BRUSH = 'bristle-round'
const SIZES = [1, 10, 30, 100] as const
const STROKE_COLOR = '#2244aa'
const PRESSURE = 0
const START_X = 0.15
const Y = 0.5
/** Device pixels of horizontal travel — the measurement span. */
const TRAVEL_PX = 100
/** Ten equal intervals of 10 device px. */
const SAMPLES = 11
const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

interface ProbeMeta {
  gate: string
  engineHead: string
}

declare global {
  interface Window {
    __GSD_PROBE_META__?: ProbeMeta
  }
}

function seededRandom(seed: number): () => number {
  let state = (seed | 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function withSeededMathRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random
  const rng = seededRandom(seed)
  Math.random = () => rng()
  try {
    return fn()
  } finally {
    Math.random = original
  }
}

// --- instrumentation ---------------------------------------------------------

let capturedEngine: WatercolorEngine | null = null
let dabCount = 0
/** The stroke's own arc length (document heights) after its last trace call. */
let travelledDoc = 0

const enginePrototype = WatercolorEngine.prototype as unknown as {
  setManual: (manual: boolean) => void
  stamp: (
    s: unknown,
    x: number,
    y: number,
    pr: number,
    vx: number,
    vy: number,
    moving: number,
    dt?: number,
    widthFactor?: number,
  ) => void
  trace: (s: { travelled: number }, ...args: unknown[]) => void
}
const originalSetManual = enginePrototype.setManual
enginePrototype.setManual = function patchedSetManual(this: WatercolorEngine, manual: boolean) {
  if (capturedEngine === null) capturedEngine = this
  return originalSetManual.call(this, manual)
}

// Every dab of the traced stroke goes through `stamp`; the wrapper counts and
// delegates with the same `this` and the same argument list. Wrapped ONCE.
const originalStamp = enginePrototype.stamp
enginePrototype.stamp = function patchedStamp(this: WatercolorEngine, ...args) {
  dabCount += 1
  return originalStamp.apply(this, args)
}

// The engine's own arc length: the scripted feed smooths the sample path, so
// the deposited travel is reported rather than assumed equal to the samples'.
const originalTrace = enginePrototype.trace
enginePrototype.trace = function patchedTrace(this: WatercolorEngine, s, ...args) {
  originalTrace.call(this, s, ...args)
  travelledDoc = s.travelled
}

/** The TypeScript-private members this probe reads off the real engine. */
interface EngineInternals {
  dw: number
  dh: number
  radius: (tool: string, pressure: number, speed: number, widthFactor?: number) => number
  spacingFrac: (tool: string) => number
}

// --- digests (the medium-engine FNV-1a pair) --------------------------------

function hashPixels(buffer: Uint8ClampedArray): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < buffer.length; i += 1) {
    hash ^= buffer[i]!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

interface Digest {
  readonly digest: string
  readonly byteLength: number
}

function digestCanvas(canvas: HTMLCanvasElement): Digest {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('digest: exported canvas has no 2D context')
  const buffer = new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
  return { digest: hashPixels(buffer), byteLength: buffer.length }
}

// --- scene -------------------------------------------------------------------

function acrylicParams(size: number): Record<string, number> {
  const medium = MEDIUMS.find((candidate) => candidate.id === 'acrylic')
  if (!medium) throw new Error('acrylic medium missing')
  return { size, ...medium.params }
}

/** `SAMPLES` points, evenly spaced, exactly `TRAVEL_PX` device px on a square sheet. */
function straight(pressure: number): AquarellePoint[] {
  const points: AquarellePoint[] = []
  for (let i = 0; i < SAMPLES; i += 1) {
    const t = i / (SAMPLES - 1)
    points.push({
      x: START_X + (TRAVEL_PX / SHEET) * t,
      y: Y,
      p: pressure,
      tx: 0,
      ty: 0,
      tw: 0,
    })
  }
  return points
}

interface CaseReport {
  size: number
  dabs: number
  spacingPx: number
  floorBinds: boolean
  radiusDoc: number
  /** `scriptPressure` clamps the authored 0 to 0.02 — the pressure the engine stamped. */
  stampedPressure: number
  /** The dab spacing at the stamped pressure (the number the dab count divides by). */
  spacingPxStamped: number
  /** The engine's own arc length over the stroke, in device pixels. */
  travelledPx: number
  digestTransparent: string
  digestPigment: string
  byteLength: number
}

/** `Engine.scriptPressure`'s floor: a recorded 0 is a light touch, not a zero. */
const SCRIPT_PRESSURE_FLOOR = 0.02

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function runCase(size: number): CaseReport {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  dabCount = 0
  travelledDoc = 0
  capturedEngine = null
  const adapter = withSeededMathRandom(PAPER_SEED, () =>
    createAquarelleEngineAdapter({
      width: SHEET,
      height: SHEET,
      paperPreset: COLD,
      paperStrength: PAPER_STRENGTH,
    }),
  )
  try {
    const engine = capturedEngine
    if (engine === null) throw new Error('probe never captured the adapter engine')
    const payload: AquarelleStrokePayload = {
      tool: 'brush',
      color: STROKE_COLOR,
      params: acrylicParams(size),
      brushId: BRUSH,
      points: straight(PRESSURE),
      mutationId: MUTATION_ID,
      timestamp: 0,
    }
    adapter.applyStroke(toStudioStroke(payload))
    for (let tick = 0; tick <= SETTLE_TICKS; tick += 1) adapter.stepTick(tick)
    adapter.fix()

    // The engine's own spacing law, read AFTER the stroke (params are the
    // configured ones). Speed 0 is exact for a bristle preset: speedThin = 0.
    const internals = engine as unknown as EngineInternals
    const radiusDoc = internals.radius('brush', PRESSURE, 0, 1)
    const spacingDoc = radiusDoc * internals.spacingFrac('brush')
    const spacingPx = spacingDoc * internals.dh
    // The feed clamps the authored 0 to the engine's 0.02 floor, so the
    // radius the dabs were stamped with is 7.09 % larger than at 0. Report
    // both so the dab count reconciles with the table.
    const stampedPressure = Math.min(1, Math.max(SCRIPT_PRESSURE_FLOOR, PRESSURE))
    const spacingPxStamped =
      internals.radius('brush', stampedPressure, 0, 1) * internals.spacingFrac('brush') * internals.dh

    const transparent = digestCanvas(engine.exportCanvas('transparent'))
    const pigment = digestCanvas(engine.exportCanvas('pigment'))
    if (transparent.byteLength !== pigment.byteLength) {
      throw new Error(`export byte lengths disagree at Size ${size}`)
    }
    return {
      size,
      dabs: dabCount,
      spacingPx: round4(spacingPx),
      floorBinds: spacingPx < 1,
      radiusDoc: round4(radiusDoc * 1e6) / 1e6,
      stampedPressure,
      spacingPxStamped: round4(spacingPxStamped),
      travelledPx: round4(travelledDoc * internals.dh),
      digestTransparent: transparent.digest,
      digestPigment: pigment.digest,
      byteLength: transparent.byteLength,
    }
  } finally {
    adapter.dispose()
  }
}

function run(): void {
  const meta = window.__GSD_PROBE_META__
  if (!meta || typeof meta.gate !== 'string' || typeof meta.engineHead !== 'string') {
    throw new Error('probe page is missing window.__GSD_PROBE_META__ (run it through run.mjs)')
  }
  const cases = SIZES.map((size) => runCase(size))
  // First paint vs re-bake: the Size 10 row above is the first independent
  // bake; a second fresh adapter replays the same recorded payload.
  const firstSize10 = cases.find((entry) => entry.size === 10)
  if (!firstSize10) throw new Error('the Size 10 case is missing')
  const rebakeSize10 = runCase(10)
  const paritySize10 = {
    firstDigest: firstSize10.digestTransparent,
    rebakeDigest: rebakeSize10.digestTransparent,
    equal: firstSize10.digestTransparent === rebakeSize10.digestTransparent,
  }
  const report = {
    quick: '261121-w5n',
    gate: meta.gate,
    engineHead: meta.engineHead,
    sheet: [SHEET, SHEET],
    brush: BRUSH,
    pressure: PRESSURE,
    travelPx: TRAVEL_PX,
    settleTicks: SETTLE_TICKS,
    cases,
    paritySize10,
  }
  const pre = document.getElementById('result')
  if (!pre) throw new Error('probe page is missing pre#result')
  pre.textContent = JSON.stringify(report, null, 2)
  const status = document.getElementById('status')
  if (status) status.textContent = 'DONE'
  console.log('PROBE_RESULT ' + JSON.stringify(report))
}

run()
