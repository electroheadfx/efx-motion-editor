// ============================================================
//  Vector spine — watercolor feasibility probe (Phase 61 Wave 0).
//
//  SCRATCH HARNESS ONLY. Imports engine internals, touches no product
//  code. Runs the REAL vendored WebGL2 WatercolorEngine (the same
//  engine the live sheet and the bake replay on) in headless Chrome
//  and answers the five ROADMAP spike questions before any vector
//  data-model field is written:
//
//   1. Segment-runs vs payload-extension seam quality at segment joins.
//   2. The sampling law at 1x / 4x / 16x tick density.
//   3. The seam step metric across segment joins (8px window scan).
//   4. Dab-count cost vs stroke count at 1920x1080 / 2048x1536 /
//      3072x2304.
//   5. Byte identity of one stroke replayed twice on fresh adapters.
//
//  Plus the C-03 width evidence: the `scriptScale` clamp measured
//  alongside the `sizeMult` channel the phase will build.
//
//  Fixed seed: Math.random is pinned to a mulberry32 around engine /
//  adapter construction so the constructor's paperSeed draw is
//  deterministic. Each stroke then reseeds the engine RNG from
//  traceSeed exactly like the adapter does.
// ============================================================

import { WatercolorEngine, type Tool } from '../../src/playground/Engine'
import { DEFAULT_CANONICAL_PARAMS, toEngineParams } from '../../src/playground/params'
import { buildBrushForStroke } from '../../src/playground/brushBridge'
import { pigmentFromHex } from '../../src/playground/spectral'
import {
  toStudioStroke,
  type AquarellePoint,
  type AquarelleStrokePayload,
} from '../../src/payload/toStudioStroke'
import type { AquarelleAnchor } from '../../src/payload/vectorPath'
import { sampleVectorPath } from '../../src/vector/spine'
import { createAquarelleEngineAdapter } from '../../src/adapter/engineAdapter'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'

const HOST_DT = 1 / 60
const PAPER_SEED = 0xc0ffee
const MUTATION_ID = 0x51c0de
const STROKE_COLOR = '#1f3b73'
const BRUSH_ID = 'wc/round-medium'
const PRESSURE = 0.55

// The three-anchor path used by the digest pair and the seam A/B.
// uv is document space: y up, x spans `aspect` heights.
const SHEET_W = 1920
const SHEET_H = 1080
const JOIN_ANCHORS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0.35, y: 0.3 },
  { x: 0.5, y: 0.62 },
  { x: 0.65, y: 0.32 },
]
const DENSITIES = [1, 4, 16] as const
type Density = (typeof DENSITIES)[number]

// The cost matrix: the same compact ten-segment spine measured at the
// three sheet sizes the project already uses for memory/cost examples.
const COST_SIZES = [
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '2048x1536', width: 2048, height: 1536 },
  { label: '3072x2304', width: 3072, height: 2304 },
] as const
const COST_ANCHORS: ReadonlyArray<{ x: number; y: number }> = Array.from(
  { length: 11 },
  (_, i) => ({ x: 0.12 + (0.76 * i) / 10, y: i % 2 === 0 ? 0.42 : 0.58 }),
)

// The width arms: a vertical three-anchor stroke whose cross-section is a
// row of the capture. 512 keeps the arm cheap; both arms share it.
const WIDTH_SHEET = 512
const WIDTH_ANCHORS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0.5, y: 0.3 },
  { x: 0.5, y: 0.5 },
  { x: 0.5, y: 0.7 },
]
// Captured at the replay's close tick, like every other arm: extra settle
// ticks only grow the faint diffusion tail, which biases the measured
// radius by a constant (~2px) and compresses the observed ratio.
const WIDTH_SETTLE_TICKS = 0
const WIDTH_FACTOR = 1.8
const WIDTH_GATE = 1.7
// Four samples per anchor segment: the profile's 1.8 is read exactly at the
// middle anchor while the neighbouring samples stay on their own factors.
const WIDTH_SCENARIO_DENSITY = 4
// A 32px canonical size (engine scale 1.0) keeps the visible footprint well
// above the paper-grain noise floor, so the widest-row measurement resolves
// the factor instead of reading grain: the DEFAULT 12px footprint fluctuates
// by 2px per row, which alone compresses a true 1.8x to ~1.6x.
const WIDTH_SCENARIO_SIZE = 32

// 61-04: the per-sample width scenario replays the same vertical spine twice
// through the PUBLIC adapter, as payload anchors. The base arm stores every
// factor absent (uniform profile: the derived array is null and the feed
// passes the literal 1); the scaled arm stores the middle anchor at
// WIDTH_FACTOR. Both arms differ in nothing else, so the measured ratio is
// the width channel and only the width channel.
const WIDTH_SCENARIO_BASE_ANCHORS: readonly AquarelleAnchor[] = WIDTH_ANCHORS.map(
  (anchor) => ({ x: anchor.x, y: anchor.y, kind: 'auto' as const }),
)
const WIDTH_SCENARIO_SCALED_ANCHORS: readonly AquarelleAnchor[] = WIDTH_ANCHORS.map(
  (anchor, index) => ({
    x: anchor.x,
    y: anchor.y,
    kind: 'auto' as const,
    ...(index === 1 ? { width: WIDTH_FACTOR } : {}),
  }),
)

// --- dab counter ------------------------------------------------------------

/**
 * Count every dab the engine lays down. `stamp` is the single deposit
 * entry point (`trace` calls it once per dab), and the `round` preset
 * has `dabs: 1`, so stamps × brush.dabs is the dab count.
 */
const stampCounter = { count: 0 }
const enginePrototype = WatercolorEngine.prototype as unknown as {
  stamp: (...args: unknown[]) => unknown
}
const originalStamp = enginePrototype.stamp
enginePrototype.stamp = function patchedStamp(this: unknown, ...args: unknown[]) {
  stampCounter.count += 1
  return originalStamp.apply(this, args)
}

// --- deterministic RNG (same mulberry32 as the adapter) --------------------

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

// --- sample path ------------------------------------------------------------

/**
 * Resample a polyline of anchors uniformly by arc length (each anchor
 * segment contributes exactly `density` samples; the first anchor is
 * emitted once). At density 1 this is the recorded anchor list itself.
 */
function resampleAnchors(
  anchors: ReadonlyArray<{ x: number; y: number }>,
  density: number,
): AquarellePoint[] {
  const pts: AquarellePoint[] = []
  for (let s = 0; s < anchors.length - 1; s += 1) {
    const a = anchors[s]!
    const b = anchors[s + 1]!
    const from = s === 0 ? 0 : 1
    for (let k = from; k <= density; k += 1) {
      const t = k / density
      pts.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        p: PRESSURE,
        tx: 0,
        ty: 0,
        tw: 0,
      })
    }
  }
  return pts
}

function makeStroke(
  points: AquarellePoint[],
  mutationId = MUTATION_ID,
  anchors?: readonly AquarelleAnchor[],
  params: Readonly<Record<string, number>> = DEFAULT_CANONICAL_PARAMS,
): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color: STROKE_COLOR,
    params: { ...params },
    brushId: BRUSH_ID,
    points,
    mutationId,
    timestamp: 0,
    // 61-04: absent anchors keep the hand-painted projection byte-identical.
    ...(anchors === undefined ? {} : { anchors }),
  })
}

// --- adapter helpers --------------------------------------------------------

type Adapter = ReturnType<typeof createAquarelleEngineAdapter>

/**
 * Construct an adapter with the paper seed pinned. The engine constructor
 * draws `paperSeed` from Math.random before the adapter installs its own
 * RNG, so an unpinned constructor makes every digest meaningless.
 */
function createPinnedAdapter(width: number, height: number): Adapter {
  return withSeededMathRandom(PAPER_SEED, () =>
    createAquarelleEngineAdapter({ width, height }),
  )
}

/**
 * Drive a whole stroke through the adapter with feedDueSample's law:
 * one recorded sample, then one engine.tick per sample — never a single
 * batch call. renderPartialStrokes is the public progressive seam; each
 * call feeds exactly one more sample. The final flush tick matches
 * applyStroke's tail tick.
 */
function runStroke(adapter: Adapter, stroke: StudioStroke<AquarelleStrokePayload>): void {
  for (let i = 1; i <= stroke.pts.length; i += 1) {
    adapter.renderPartialStrokes([{ stroke, pointCount: i }])
  }
  adapter.stepTick(0)
}

function captureAdapter(adapter: Adapter): Uint8ClampedArray {
  const canvas = adapter.captureFrame() as HTMLCanvasElement
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('capture: no 2D context')
  return new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
}

// --- direct-engine rig (segment runs need scriptEnd between segments) ------

class Rig {
  readonly engine: WatercolorEngine
  now = 0

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    this.engine = withSeededMathRandom(PAPER_SEED, () => new WatercolorEngine(canvas, null, {}, [width, height]))
    this.engine.setManual(true)
    this.engine.setClock(() => this.now)
  }

  /** Replays the adapter's configure() exactly. */
  configure(stroke: StudioStroke<AquarelleStrokePayload>): void {
    const e = this.engine
    e.setParams(toEngineParams(stroke.engine.params))
    e.setBrush(buildBrushForStroke(stroke.engine.brushId))
    const hex = stroke.color ?? stroke.engine.color
    if (typeof hex === 'string' && hex.length > 0) e.setPigment(pigmentFromHex(hex))
    e.setTool(stroke.engine.tool as Tool)
    e.setRandom(seededRandom(stroke.traceSeed || 1))
  }

  begin(p: AquarellePoint, maxRadius?: number): void {
    this.now += 1000 * HOST_DT
    this.engine.scriptBegin('brush', p.x, p.y, p.p, 'Stroke', maxRadius, p.tx, p.ty)
    this.engine.tick(HOST_DT)
  }

  move(p: AquarellePoint): void {
    this.now += 1000 * HOST_DT
    this.engine.scriptMove(p.x, p.y, p.p, this.now, p.tx, p.ty)
    this.engine.tick(HOST_DT)
  }

  /** scriptEnd plus the close tick (the adapter's tail/flush tick). */
  end(): void {
    this.engine.scriptEnd()
    this.now += 1000 * HOST_DT
    this.engine.tick(HOST_DT)
  }

  settle(): void {
    this.now += 1000 * HOST_DT
    this.engine.tick(HOST_DT)
  }

  /** One continuous scripted run over every point, then an optional settle. */
  runWhole(
    points: readonly AquarellePoint[],
    options: { maxRadius?: number; settleTicks?: number } = {},
  ): void {
    if (points.length === 0) return
    this.begin(points[0]!, options.maxRadius)
    for (let i = 1; i < points.length; i += 1) this.move(points[i]!)
    this.end()
    for (let i = 0; i < (options.settleTicks ?? 0); i += 1) this.settle()
  }

  capture(): Uint8ClampedArray {
    const canvas = this.engine.exportCanvas('transparent')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('capture: no 2D context')
    return new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
  }

  destroy(): void {
    this.engine.destroy()
  }
}

/**
 * Strategy A — segment runs: one scriptBegin/scriptEnd pair per anchor
 * segment, each segment re-opening at the join point. This is the
 * no-engine-change option; scriptEnd resets the Stroke (travelled,
 * carry, direction), which is the seam hazard the A/B measures.
 */
function runSegmentRuns(
  width: number,
  height: number,
  anchors: ReadonlyArray<{ x: number; y: number }>,
  density: number,
): Uint8ClampedArray {
  const rig = new Rig(width, height)
  try {
    const stroke = makeStroke(resampleAnchors(anchors, density))
    rig.configure(stroke)
    for (let s = 0; s < anchors.length - 1; s += 1) {
      const a = anchors[s]!
      const b = anchors[s + 1]!
      const at = (t: number): AquarellePoint => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        p: PRESSURE,
        tx: 0,
        ty: 0,
        tw: 0,
      })
      rig.begin(at(0))
      for (let k = 1; k <= density; k += 1) rig.move(at(k / density))
      rig.end()
    }
    return rig.capture()
  } finally {
    rig.destroy()
  }
}

/**
 * Strategy B — payload extension: one continuous run through every join,
 * fed through the public adapter exactly like the shipped replay.
 */
function runPayloadExtension(
  width: number,
  height: number,
  anchors: ReadonlyArray<{ x: number; y: number }>,
  density: number,
): Uint8ClampedArray {
  const adapter = createPinnedAdapter(width, height)
  try {
    const stroke = makeStroke(resampleAnchors(anchors, density))
    runStroke(adapter, stroke)
    return captureAdapter(adapter)
  } finally {
    adapter.dispose()
  }
}

// --- seam metric ------------------------------------------------------------

const SEAM_WINDOW_PX = 8

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Maximum absolute per-channel difference between adjacent pixel columns
 * and rows inside an 8px window around each join, in raw 0..255 tone
 * units. The buffer is the top-down RGBA capture, so uv y-up is flipped
 * for the row index. The scan is unsigned: it measures visible step
 * magnitude, not its direction.
 */
function seamMaxChannelDelta(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  joinPointsUv: ReadonlyArray<{ x: number; y: number }>,
): number {
  const half = SEAM_WINDOW_PX
  let worst = 0
  for (const join of joinPointsUv) {
    const cx = Math.round(join.x * width)
    const cy = Math.round((1 - join.y) * height)
    const x0 = Math.max(0, cx - half)
    const x1 = Math.min(width - 1, cx + half)
    const y0 = Math.max(0, cy - half)
    const y1 = Math.min(height - 1, cy + half)
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * width + x) * 4
        const j = i + 4
        for (let c = 0; c < 4; c += 1) {
          const d = Math.abs(buffer[i + c]! - buffer[j + c]!)
          if (d > worst) worst = d
        }
      }
    }
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const i = (y * width + x) * 4
        const j = ((y + 1) * width + x) * 4
        for (let c = 0; c < 4; c += 1) {
          const d = Math.abs(buffer[i + c]! - buffer[j + c]!)
          if (d > worst) worst = d
        }
      }
    }
  }
  return worst
}

/**
 * The seam step in pixel space. A raw 0..255 tone delta is not a distance,
 * so it is converted over the scan window: a full-range (255) jump between
 * two adjacent pixels equals the 8px window span. A soft watercolour edge
 * spread across the window reads near zero; a hard discontinuity reads as
 * the window width. The raw delta is reported alongside for audit.
 */
function measureSeamStepPx(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
  joinPointsUv: ReadonlyArray<{ x: number; y: number }>,
): number {
  const raw = seamMaxChannelDelta(buffer, width, height, joinPointsUv)
  return round3((raw / 255) * SEAM_WINDOW_PX)
}

/** Pixels carrying a visible deposit (transparent export is opaque white). */
function paintedPixels(buffer: Uint8ClampedArray): number {
  let count = 0
  for (let i = 0; i < buffer.length; i += 4) {
    const r = buffer[i]!
    const g = buffer[i + 1]!
    const b = buffer[i + 2]!
    if (255 - Math.min(r, g, b) > 8) count += 1
  }
  return count
}

// --- digests ----------------------------------------------------------------

/** FNV-1a over the capture bytes — unsigned 32-bit hex. */
function hashPixels(buffer: Uint8ClampedArray): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < buffer.length; i += 1) {
    hash ^= buffer[i]!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

interface DigestRun {
  readonly digest: string
  readonly byteLength: number
}

function digestRun(
  width: number,
  height: number,
  anchors: ReadonlyArray<{ x: number; y: number }>,
  density: number,
): DigestRun {
  const adapter = createPinnedAdapter(width, height)
  try {
    const stroke = makeStroke(resampleAnchors(anchors, density))
    runStroke(adapter, stroke)
    const buffer = captureAdapter(adapter)
    return { digest: hashPixels(buffer), byteLength: buffer.length }
  } finally {
    adapter.dispose()
  }
}

// --- cost matrix ------------------------------------------------------------

interface SizeCost {
  readonly dabsPerStroke: number
  readonly msPerStroke: number
  readonly msPerSheet10: number
  readonly msPerSheet50: number
  readonly msPerSheet200: number
}

/** Deterministic per-stroke offset so a sheet accumulates distinct strokes. */
function shiftAnchors(
  anchors: ReadonlyArray<{ x: number; y: number }>,
  seed: number,
): Array<{ x: number; y: number }> {
  const rng = seededRandom(0x9e3779b9 ^ seed)
  const dx = (rng() - 0.5) * 0.05
  const dy = (rng() - 0.5) * 0.05
  const clamp = (v: number): number => Math.min(0.95, Math.max(0.05, v))
  return anchors.map((a) => ({ x: clamp(a.x + dx), y: clamp(a.y + dy) }))
}

function measureCost(
  width: number,
  height: number,
  anchors: ReadonlyArray<{ x: number; y: number }>,
  density: number,
): SizeCost {
  const points = resampleAnchors(anchors, density)
  const brushDabs = buildBrushForStroke(BRUSH_ID).dabs ?? 1

  // Warm up the shader programs before timing, then measure one stroke on
  // the same engine (a cold first stroke carries the program link cost).
  const probe = createPinnedAdapter(width, height)
  let dabsPerStroke = 0
  let msPerStroke = 0
  try {
    runStroke(probe, makeStroke(resampleAnchors(shiftAnchors(anchors, -1), density), MUTATION_ID - 1))
    stampCounter.count = 0
    const t0 = performance.now()
    runStroke(probe, makeStroke(points))
    msPerStroke = performance.now() - t0
    dabsPerStroke = stampCounter.count * brushDabs
  } finally {
    probe.dispose()
  }

  // A sheet filled with 10 / 50 / 200 strokes, cumulative checkpoints.
  const sheet = createPinnedAdapter(width, height)
  let after10 = 0
  let after50 = 0
  let after200 = 0
  try {
    runStroke(sheet, makeStroke(resampleAnchors(shiftAnchors(anchors, -2), density), MUTATION_ID - 2))
    const t0 = performance.now()
    for (let i = 0; i < 200; i += 1) {
      const stroke = makeStroke(
        resampleAnchors(shiftAnchors(anchors, i), density),
        MUTATION_ID + i,
      )
      runStroke(sheet, stroke)
      if (i === 9) after10 = performance.now() - t0
      if (i === 49) after50 = performance.now() - t0
      if (i === 199) after200 = performance.now() - t0
    }
  } finally {
    sheet.dispose()
  }

  return {
    dabsPerStroke,
    msPerStroke: round3(msPerStroke),
    msPerSheet10: round3(after10),
    msPerSheet50: round3(after50),
    msPerSheet200: round3(after200),
  }
}

// --- width arms -------------------------------------------------------------

interface WidthPixels {
  readonly widthPx: number
  readonly radiusPx: number
}

/**
 * The stroke's core width from pixels: the widest row of the middle band,
 * counted as visibly painted pixels (the transparent export is opaque
 * white, so a deposit is a drop from 255). Radius = width / 2.
 */
function measureWidthFromPixels(
  buffer: Uint8ClampedArray,
  width: number,
  height: number,
): WidthPixels {
  const top = Math.round((1 - 0.64) * height)
  const bottom = Math.round((1 - 0.36) * height)
  let widest = 0
  for (let y = top; y <= bottom; y += 1) {
    let count = 0
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const r = buffer[i]!
      const g = buffer[i + 1]!
      const b = buffer[i + 2]!
      if (255 - Math.min(r, g, b) > 8) count += 1
    }
    if (count > widest) widest = count
  }
  return { widthPx: widest, radiusPx: widest / 2 }
}

/**
 * Replay the vertical three-anchor stroke through the script path with
 * either an explicit `maxRadius` (the C-03 clamp arm) or a footprint size
 * (the `sizeMult` arm), then measure the radius from the captured pixels.
 */
function runWidthStroke(
  density: number,
  options: { size?: number; maxRadiusFactor?: number },
): WidthPixels {
  const rig = new Rig(WIDTH_SHEET, WIDTH_SHEET)
  try {
    const stroke = makeStroke(resampleAnchors(WIDTH_ANCHORS, density))
    rig.configure(stroke)
    if (typeof options.size === 'number') rig.engine.setParams({ size: options.size })
    let maxRadius: number | undefined
    if (typeof options.maxRadiusFactor === 'number') {
      // measured while no stroke is open: scriptScale is not applied
      const measure = rig.engine as unknown as {
        radius(tool: Tool, pressure: number, speed: number): number
      }
      maxRadius = measure.radius('brush', 1, 0) * options.maxRadiusFactor
    }
    rig.runWhole(stroke.pts, { maxRadius, settleTicks: WIDTH_SETTLE_TICKS })
    return measureWidthFromPixels(rig.capture(), WIDTH_SHEET, WIDTH_SHEET)
  } finally {
    rig.destroy()
  }
}

/**
 * 61-04: one adapter replay of the vertical spine, the width factors carried
 * as payload anchors. Goes through renderPartialStrokes exactly like the
 * shipped Play path, so the measurement covers the whole channel:
 * payload anchors → resolveStrokeWidthFactors → scriptBegin/scriptMove
 * → Sample.w → Stroke.widthFrom/widthTo → sizeMult → dab radius and spacing.
 */
function runScriptWidthStroke(anchors: readonly AquarelleAnchor[]): WidthPixels {
  const adapter = createPinnedAdapter(WIDTH_SHEET, WIDTH_SHEET)
  try {
    const stroke = makeStroke(
      resampleAnchors(WIDTH_ANCHORS, WIDTH_SCENARIO_DENSITY),
      MUTATION_ID,
      anchors,
      { ...DEFAULT_CANONICAL_PARAMS, size: WIDTH_SCENARIO_SIZE },
    )
    runStroke(adapter, stroke)
    return measureWidthFromPixels(captureAdapter(adapter), WIDTH_SHEET, WIDTH_SHEET)
  } finally {
    adapter.dispose()
  }
}

/**
 * 61-04 / VEC-03: the per-sample width channel measured on real pixels
 * through the public adapter. Both arms replay the SAME stroke; the only
 * difference is the middle anchor's sparse factor (absent vs 1.8). The
 * observed ratio is the measurement the C-03 trap cannot fake, because the
 * factor never goes through the scriptScale clamp.
 */
function runWidthScenario(renderer: string): void {
  const t0 = performance.now()
  const base = runScriptWidthStroke(WIDTH_SCENARIO_BASE_ANCHORS)
  const scaled = runScriptWidthStroke(WIDTH_SCENARIO_SCALED_ANCHORS)
  if (base.radiusPx <= 0) throw new Error('width scenario: base arm painted nothing')
  const observed = round3(scaled.radiusPx / base.radiusPx)
  const pass = observed >= WIDTH_GATE
  writeResult({
    scenario: 'width',
    kind: 'auto',
    sheet: `${WIDTH_SHEET}x${WIDTH_SHEET}`,
    widthFactor: WIDTH_FACTOR,
    density: WIDTH_SCENARIO_DENSITY,
    widthRatio: {
      baseRadiusPx: round3(base.radiusPx),
      scaledRadiusPx: round3(scaled.radiusPx),
      observed,
      gate: WIDTH_GATE,
      channel: 'scriptFactor(sample)',
    },
    env: { renderer: String(renderer), userAgent: navigator.userAgent },
    verdict: `${pass ? 'VECTOR-WIDTH PASS' : 'VECTOR-WIDTH FAIL'} observed=${observed}`,
    totalProbeMs: Math.round(performance.now() - t0),
  })
}

// --- natural pen scenario (SCRATCH, 61 gap closure) -------------------------
//
// A hand-painted mouse stroke is replayed through the SAME adapter as a
// vector stroke. Its samples carry the p = -1 sentinel, so the engine derives
// pressure from the spacing the hand produced (slow at turns = dense samples
// = high pressure). The vector arms carry explicit pressures: the shipped
// profile (base 0.5) and a candidate calibrated to the hand's band. The sheet
// is captured as one PNG so the three arms can be compared by eye and by
// cross-section metrics.

const NATURAL_SHEET = 640
const NATURAL_SIZE = 18
const NATURAL_COLOR = '#b4761f'
const NATURAL_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.22, y: 0.24, kind: 'auto' },
  { x: 0.74, y: 0.44, kind: 'auto' },
  { x: 0.28, y: 0.58, kind: 'auto' },
  { x: 0.72, y: 0.80, kind: 'auto' },
]

interface NaturalPoint {
  x: number
  y: number
}

function naturalSpine(): NaturalPoint[] {
  return sampleVectorPath(NATURAL_ANCHORS).points.map((point) => ({ x: point.x, y: point.y }))
}

function stationsOf(points: readonly NaturalPoint[]): number[] {
  const stations: number[] = []
  let running = 0
  for (let index = 0; index < points.length; index += 1) {
    if (index > 0) {
      const a = points[index - 1]!
      const b = points[index]!
      running += Math.hypot(b.x - a.x, b.y - a.y)
    }
    stations.push(running)
  }
  return stations
}

function pointAtDistance(
  points: readonly NaturalPoint[],
  stations: readonly number[],
  distance: number,
): NaturalPoint {
  const total = stations[stations.length - 1] ?? 0
  if (distance <= 0) return points[0]!
  if (distance >= total) return points[points.length - 1]!
  let low = 0
  let high = stations.length - 1
  while (low + 1 < high) {
    const middle = (low + high) >> 1
    if (stations[middle]! <= distance) low = middle
    else high = middle
  }
  const from = stations[low]!
  const to = stations[high]!
  const t = to > from ? (distance - from) / (to - from) : 0
  const a = points[low]!
  const b = points[high]!
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function smooth01(value: number): number {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

/** |turn angle| per spine point over a 16-sample window, spread ±24 samples. */
function naturalTurnLoad(points: readonly NaturalPoint[]): number[] {
  const count = points.length
  const turn = new Array<number>(count).fill(0)
  if (count < 3) return turn
  for (let index = 0; index < count; index += 1) {
    const before = points[Math.max(0, index - 8)]!
    const here = points[index]!
    const after = points[Math.min(count - 1, index + 8)]!
    const ax = here.x - before.x
    const ay = here.y - before.y
    const bx = after.x - here.x
    const by = after.y - here.y
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la <= 0 || lb <= 0) continue
    const cosine = Math.min(1, Math.max(-1, (ax * bx + ay * by) / (la * lb)))
    turn[index] = Math.acos(cosine) / (Math.PI / 2)
  }
  const spread = new Array<number>(count).fill(0)
  for (let index = 0; index < count; index += 1) {
    let sum = 0
    let hits = 0
    for (let offset = -24; offset <= 24; offset += 1) {
      const peer = index + offset
      if (peer < 0 || peer >= count) continue
      sum += turn[peer]!
      hits += 1
    }
    spread[index] = hits === 0 ? 0 : Math.min(1, sum / hits)
  }
  return spread
}

function naturalPhase(points: readonly NaturalPoint[]): number {
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) return 0
  const raw = Math.sin(first.x * 12.9898 + first.y * 78.233 + last.x * 37.719 + last.y * 43.313) * 43758.5453
  return raw - Math.floor(raw)
}

/**
 * The hand arm: emit samples along the spine at a spacing equal to a plausible
 * hand speed / 60. The engine sees one sample per tick, so spacing IS speed.
 * Slow at turns, with a little drift; p keeps the mouse sentinel.
 */
function naturalHandPoints(
  spine: readonly NaturalPoint[],
  turn: readonly number[],
): AquarellePoint[] {
  const stations = stationsOf(spine)
  const total = stations[stations.length - 1] ?? 0
  if (total <= 0) return []
  const points: AquarellePoint[] = []
  const count = spine.length
  let travelled = 0
  while (travelled <= total) {
    const point = pointAtDistance(spine, stations, travelled)
    points.push({ x: point.x, y: point.y, p: -1, tx: 0, ty: 0, tw: 0 })
    const u = travelled / total
    const localTurn = turn[Math.min(count - 1, Math.round(u * (count - 1)))] ?? 0
    const speed = (0.42 - 0.29 * localTurn) * (1 + 0.10 * Math.sin(2 * Math.PI * (2.3 * u + 0.17)))
    travelled += Math.max(0.0016, speed / 60)
  }
  return points
}

/** The shipped profile (base 0.5) — duplicated here because the probe cannot
 *  import app code. */
function naturalCurrentPressures(
  spine: readonly NaturalPoint[],
  turn: readonly number[],
): number[] {
  const phase = naturalPhase(spine)
  const span = spine.length === 1 ? 1 : spine.length - 1
  return spine.map((_point, index) => {
    const u = index / span
    const taper = 0.42
      + (1 - 0.42) * Math.min(smooth01(u / 0.055), smooth01((1 - u) / 0.055))
    const wobble = 1
      + 0.18 * Math.sin(2 * Math.PI * (1.1 * u + phase))
      + 0.09 * Math.sin(2 * Math.PI * (3.3 * u + 2 * phase))
    const loaded = 0.5 + 0.42 * (turn[index] ?? 0)
    return Math.min(0.95, Math.max(0.16, loaded * taper * wobble))
  })
}

/** Candidate: the hand's own pressure band, with turns pooling pigment. */
function naturalProposedPressures(
  spine: readonly NaturalPoint[],
  turn: readonly number[],
): number[] {
  const phase = naturalPhase(spine)
  const span = spine.length === 1 ? 1 : spine.length - 1
  return spine.map((_point, index) => {
    const u = index / span
    const land = Math.min(smooth01(u / 0.05), smooth01((1 - u) / 0.05))
    const body = 0.88
      + 0.09 * Math.sin(2 * Math.PI * (1.4 * u + phase))
      + 0.045 * Math.sin(2 * Math.PI * (4.1 * u + 2 * phase))
    const loaded = Math.min(1, body + 0.20 * (turn[index] ?? 0))
    return Math.min(1, Math.max(0.16, 0.45 + (loaded - 0.45) * land))
  })
}

/**
 * Paint-sample the spine at a fixed arc-length step and evaluate the pressure
 * law on THOSE samples (the profile's index runs over the painted points, not
 * the 0.002 geometry walk). A hand stroke's samples are its pointer events;
 * this is the vector equivalent.
 */
function resampleVectorArm(
  spine: readonly NaturalPoint[],
  stepUv: number,
  pressuresOf: (points: readonly NaturalPoint[], turn: readonly number[]) => number[],
): AquarellePoint[] {
  const stations = stationsOf(spine)
  const total = stations[stations.length - 1] ?? 0
  if (total <= 0) return []
  const samples: NaturalPoint[] = []
  let travelled = 0
  while (travelled <= total) {
    samples.push(pointAtDistance(spine, stations, travelled))
    travelled += stepUv
  }
  const last = spine[spine.length - 1]!
  const final = samples[samples.length - 1]!
  if (Math.hypot(final.x - last.x, final.y - last.y) > 1e-6) samples.push(last)
  const turn = naturalTurnLoad(samples)
  const pressures = pressuresOf(samples, turn)
  return samples.map((point, index) => ({
    x: point.x,
    y: point.y,
    p: pressures[index] ?? 0.5,
    tx: 0,
    ty: 0,
    tw: 0,
  }))
}

function makeNaturalStroke(points: AquarellePoint[]): StudioStroke<AquarelleStrokePayload> {
  const stroke = makeStroke(points, MUTATION_ID, undefined, {
    ...DEFAULT_CANONICAL_PARAMS,
    size: NATURAL_SIZE,
  })
  return {
    ...stroke,
    color: NATURAL_COLOR,
    engine: { ...stroke.engine, color: NATURAL_COLOR },
  }
}

function runNaturalArm(points: AquarellePoint[]): {
  canvas: HTMLCanvasElement
  pixels: Uint8ClampedArray
} {
  const adapter = createPinnedAdapter(NATURAL_SHEET, NATURAL_SHEET)
  try {
    runStroke(adapter, makeNaturalStroke(points))
    const canvas = adapter.captureFrame() as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('natural: no 2D context')
    return { canvas, pixels: new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data) }
  } finally {
    adapter.dispose()
  }
}

interface NaturalArmMetrics {
  paintedPixels: number
  bodyPixels: number
  meanPeakInk: number
  peakSd: number
  meanWidthPx: number
  widthSd: number
  meanHaloWidthPx: number
}

function measureNaturalArm(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  spine: readonly NaturalPoint[],
  offsetRange = 36,
): NaturalArmMetrics {
  const luminanceAt = (x: number, y: number): number => {
    const index = (y * width + x) * 4
    return 0.299 * pixels[index]! + 0.587 * pixels[index + 1]! + 0.114 * pixels[index + 2]!
  }
  const corners = [luminanceAt(1, 1), luminanceAt(width - 2, 1), luminanceAt(1, height - 2), luminanceAt(width - 2, height - 2)]
  const background = corners.reduce((sum, value) => sum + value, 0) / corners.length
  const inkAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0
    return Math.max(0, background - luminanceAt(x, y))
  }

  let paintedPixels = 0
  let bodyPixels = 0
  for (let index = 0; index < pixels.length; index += 4) {
    const ink = Math.max(0, background - (0.299 * pixels[index]! + 0.587 * pixels[index + 1]! + 0.114 * pixels[index + 2]!))
    if (ink > 16) paintedPixels += 1
    if (ink > 96) bodyPixels += 1
  }

  const stations = stationsOf(spine)
  const total = stations[stations.length - 1] ?? 0
  const peaks: number[] = []
  const widths: number[] = []
  const halos: number[] = []
  const stationsCount = 60
  for (let k = 1; k < stationsCount; k += 1) {
    const distance = (total * k) / stationsCount
    const point = pointAtDistance(spine, stations, distance)
    const ahead = pointAtDistance(spine, stations, Math.min(total, distance + 0.004))
    const behind = pointAtDistance(spine, stations, Math.max(0, distance - 0.004))
    const tx = ahead.x - behind.x
    const ty = ahead.y - behind.y
    const length = Math.hypot(tx, ty) || 1
    const nx = -ty / length
    const ny = tx / length
    const cx = point.x * width
    const cy = (1 - point.y) * height
    let peak = 0
    const profile: number[] = []
    for (let offset = -offsetRange; offset <= offsetRange; offset += 1) {
      const ink = inkAt(Math.round(cx + nx * offset), Math.round(cy - ny * offset))
      profile.push(ink)
      if (ink > peak) peak = ink
    }
    const edge = Math.max(18, peak * 0.5)
    let widthCount = 0
    let haloCount = 0
    for (const ink of profile) {
      if (ink >= edge) widthCount += 1
      if (ink >= 12) haloCount += 1
    }
    peaks.push(peak)
    widths.push(widthCount)
    halos.push(haloCount)
  }

  const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
  const sd = (values: number[]): number => {
    const average = mean(values)
    return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, values.length))
  }

  return {
    paintedPixels,
    bodyPixels,
    meanPeakInk: round3(mean(peaks)),
    peakSd: round3(sd(peaks)),
    meanWidthPx: round3(mean(widths)),
    widthSd: round3(sd(widths)),
    meanHaloWidthPx: round3(mean(halos)),
  }
}

function runNaturalScenario(renderer: string): void {
  const t0 = performance.now()
  const spine = naturalSpine()
  const turn = naturalTurnLoad(spine)

  const hand = naturalHandPoints(spine, turn)
  const currentPressures = naturalCurrentPressures(spine, turn)
  const proposedPressures = naturalProposedPressures(spine, turn)
  const current = spine.map((point, index) => ({
    x: point.x,
    y: point.y,
    p: currentPressures[index] ?? 0.5,
    tx: 0,
    ty: 0,
    tw: 0,
  }))
  const proposed = spine.map((point, index) => ({
    x: point.x,
    y: point.y,
    p: proposedPressures[index] ?? 0.5,
    tx: 0,
    ty: 0,
    tw: 0,
  }))
  const coarse = resampleVectorArm(spine, 0.006, naturalProposedPressures)
  const coarseCurrent = resampleVectorArm(spine, 0.006, naturalCurrentPressures)

  const armHand = runNaturalArm(hand)
  const armCurrent = runNaturalArm(current)
  const armProposed = runNaturalArm(proposed)
  const armCoarse = runNaturalArm(coarse)
  const armCoarseCurrent = runNaturalArm(coarseCurrent)

  const columns = 5
  const sheet = document.createElement('canvas')
  sheet.width = NATURAL_SHEET * columns + 8 * (columns - 1)
  sheet.height = NATURAL_SHEET + 28
  const sheetCtx = sheet.getContext('2d')
  if (!sheetCtx) throw new Error('natural: no composite context')
  sheetCtx.fillStyle = '#ffffff'
  sheetCtx.fillRect(0, 0, sheet.width, sheet.height)
  const arms = [armHand, armCurrent, armProposed, armCoarse, armCoarseCurrent]
  for (let index = 0; index < arms.length; index += 1) {
    sheetCtx.drawImage(arms[index]!.canvas, index * (NATURAL_SHEET + 8), 0)
  }
  sheetCtx.fillStyle = '#111111'
  sheetCtx.font = 'bold 13px system-ui, sans-serif'
  const labels = [
    'HAND',
    'VEC 0.5 dense',
    'VEC 0.88 dense',
    'VEC 0.88 step .006',
    'VEC 0.5 step .006',
  ]
  for (let index = 0; index < labels.length; index += 1) {
    sheetCtx.fillText(labels[index]!, index * (NATURAL_SHEET + 8) + 8, NATURAL_SHEET + 20)
  }

  writeResult({
    scenario: 'natural',
    sheet: `${NATURAL_SHEET}x${NATURAL_SHEET}`,
    size: NATURAL_SIZE,
    anchors: NATURAL_ANCHORS,
    sampleCounts: {
      handPoints: hand.length,
      densePoints: spine.length,
      coarsePoints: coarse.length,
    },
    arms: {
      hand: measureNaturalArm(armHand.pixels, NATURAL_SHEET, NATURAL_SHEET, spine),
      current: measureNaturalArm(armCurrent.pixels, NATURAL_SHEET, NATURAL_SHEET, spine),
      proposed: measureNaturalArm(armProposed.pixels, NATURAL_SHEET, NATURAL_SHEET, spine),
      coarse: measureNaturalArm(armCoarse.pixels, NATURAL_SHEET, NATURAL_SHEET, spine),
      coarseCurrent: measureNaturalArm(armCoarseCurrent.pixels, NATURAL_SHEET, NATURAL_SHEET, spine),
    },
    sheetPng: sheet.toDataURL('image/png'),
    env: { renderer: String(renderer), userAgent: navigator.userAgent },
    verdict: 'NATURAL-PEN MEASURED',
    totalProbeMs: Math.round(performance.now() - t0),
  })
}

// --- real-stroke comparison (SCRATCH, 61 gap closure) ----------------------
//
// The live project's own strokes, decoded from its saved SNAP: one recorded
// mouse stroke and the vector path drawn beside it with the same brush
// (round, size 40, every global 50). All arms replay on a 1080 square sheet.
// They differ ONLY in how the vector spine is sampled and pressed, so the
// capture answers the artist's question directly: does the vector now paint
// like the hand beside it?

const REAL_SHEET = 1080
const REAL_MUTATION = 0x51c0dd
const REAL_HAND_POINTS: readonly (readonly [number, number])[] = [[0.38613,0.86183],[0.36779,0.8502],[0.34946,0.83857],[0.32288,0.81785],[0.28418,0.78518],[0.24306,0.74537],[0.21515,0.71125],[0.19495,0.68673],[0.18563,0.67468],[0.18329,0.67004],[0.18476,0.66963],[0.18947,0.67179],[0.19419,0.67398],[0.1989,0.67614],[0.2036,0.67831],[0.21299,0.68237],[0.24625,0.69631],[0.26012,0.7014],[0.26943,0.70365],[0.27146,0.70401],[0.27253,0.70401],[0.27561,0.70401],[0.27803,0.7022],[0.27803,0.6983],[0.27163,0.66972],[0.23964,0.60529],[0.2078,0.56486],[0.16631,0.51798],[0.14026,0.48482],[0.12828,0.46741],[0.13591,0.46615],[0.15409,0.46728],[0.21057,0.4894],[0.31406,0.53799],[0.41108,0.57945],[0.44544,0.59165],[0.45084,0.59327],[0.45153,0.59054],[0.4522,0.58781],[0.43645,0.5256],[0.41781,0.45623],[0.39942,0.38309],[0.3924,0.33019],[0.3924,0.29975],[0.3924,0.28566]];
const REAL_VECTOR_ANCHORS: readonly AquarelleAnchor[] = [{"x":0.91753,"y":0.90422,"kind":"auto"},{"x":0.69653,"y":0.71688,"kind":"bezier","in":{"x":0.69653,"y":0.71688},"out":{"x":0.69653,"y":0.71688}},{"x":0.91801,"y":0.74524,"kind":"auto"},{"x":0.74876,"y":0.5565,"kind":"auto"},{"x":0.69584,"y":0.49484,"kind":"bezier","in":{"x":0.69584,"y":0.49484},"out":{"x":0.69584,"y":0.49484}},{"x":0.90384,"y":0.52479,"kind":"bezier","in":{"x":0.90384,"y":0.52479},"out":{"x":0.90384,"y":0.52479}},{"x":0.75531,"y":0.38548,"kind":"bezier","in":{"x":0.75531,"y":0.38548},"out":{"x":0.75531,"y":0.38548}},{"x":0.72549,"y":0.27201,"kind":"auto"}];
const REAL_PARAMS: Readonly<Record<string, number>> = {"bleed":50,"dry":50,"edge":50,"flow":50,"granulation":50,"lift":22,"load":50,"size":40,"water":50};
const REAL_BRUSH = "round";
const REAL_COLOR = "#103c65";
const REAL_SEED = 1882439339;

function makeRealStroke(points: AquarellePoint[]): StudioStroke<AquarelleStrokePayload> {
  const stroke = toStudioStroke({
    tool: 'brush',
    color: REAL_COLOR,
    params: { ...REAL_PARAMS },
    brushId: REAL_BRUSH,
    points,
    mutationId: REAL_MUTATION,
    timestamp: 0,
  })
  return { ...stroke, traceSeed: REAL_SEED }
}

function runRealArm(points: AquarellePoint[]): {
  canvas: HTMLCanvasElement
  pixels: Uint8ClampedArray
} {
  const adapter = createPinnedAdapter(REAL_SHEET, REAL_SHEET)
  try {
    runStroke(adapter, makeRealStroke(points))
    const canvas = adapter.captureFrame() as HTMLCanvasElement
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('real: no 2D context')
    return { canvas, pixels: new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data) }
  } finally {
    adapter.dispose()
  }
}

const REAL_SAMPLE_BASE = 0.04
const REAL_STEP_TURN_SLOWDOWN = 0.4
const REAL_STEP_DRIFT = [
  { cycles: 1.3, amplitude: 0.18 },
  { cycles: 3.7, amplitude: 0.08 },
] as const
const REAL_STEP_MIN = 0.008
const REAL_STEP_MAX = 0.08

/** The shipped sampler: hand cadence from curvature + drift. */
function realPaintSample(points: readonly NaturalPoint[]): NaturalPoint[] {
  const stations = stationsOf(points)
  const total = stations[stations.length - 1] ?? 0
  if (!(total > 0)) return [...points]
  const turn = naturalTurnLoad(points)
  const phase = naturalPhase(points)
  const samples: NaturalPoint[] = [pointAtDistance(points, stations, 0)]
  let travelled = 0
  while (travelled < total && samples.length < 20000) {
    const u = travelled / total
    const localTurn = turn[Math.min(turn.length - 1, Math.round(u * (turn.length - 1)))] ?? 0
    let drift = 1
    for (let term = 0; term < REAL_STEP_DRIFT.length; term += 1) {
      const { cycles, amplitude } = REAL_STEP_DRIFT[term]!
      drift += amplitude * Math.sin(2 * Math.PI * (cycles * u + phase * (term + 1)))
    }
    const step = Math.min(REAL_STEP_MAX, Math.max(REAL_STEP_MIN, REAL_SAMPLE_BASE * (1 - REAL_STEP_TURN_SLOWDOWN * localTurn) * drift))
    travelled += step
    samples.push(pointAtDistance(points, stations, Math.min(total, travelled)))
  }
  return samples
}

/** The shipped profile: the band the engine derives for recorded mouse strokes. */
function realPaintPressures(samples: readonly NaturalPoint[]): number[] {
  const phase = naturalPhase(samples)
  const turn = naturalTurnLoad(samples)
  const span = samples.length === 1 ? 1 : samples.length - 1
  return samples.map((_point, index) => {
    const u = index / span
    const land = Math.min(smooth01(u / 0.05), smooth01((1 - u) / 0.05))
    let drift = 0
    drift += 0.09 * Math.sin(2 * Math.PI * (1.4 * u + phase))
    drift += 0.045 * Math.sin(2 * Math.PI * (4.1 * u + 2 * phase))
    const loaded = Math.min(0.6, 0.3 + drift + 0.16 * (turn[index] ?? 0))
    const pressure = 0.45 + (loaded - 0.45) * land
    return Math.min(0.6, Math.max(0.14, pressure))
  })
}

function runRealScenario(renderer: string): void {
  const t0 = performance.now()
  const spine = naturalSpineFromAnchors(REAL_VECTOR_ANCHORS)
  const handPoints: AquarellePoint[] = REAL_HAND_POINTS.map(([x, y]) => ({ x, y, p: -1, tx: 0, ty: 0, tw: 0 }))

  const newSamples = realPaintSample(spine)
  const newPressures = realPaintPressures(newSamples)
  const vecNew: AquarellePoint[] = newSamples.map((point, index) => ({
    x: point.x, y: point.y, p: newPressures[index] ?? 0.5, tx: 0, ty: 0, tw: 0,
  }))
  const interimSamples = resampleVectorArm(spine, 0.006, naturalProposedPressures)
  const vecSentinel: AquarellePoint[] = newSamples.map((point) => ({
    x: point.x, y: point.y, p: -1, tx: 0, ty: 0, tw: 0,
  }))
  const oldPressures = naturalCurrentPressures(spine, naturalTurnLoad(spine))
  const vecOld: AquarellePoint[] = spine.map((point, index) => ({
    x: point.x, y: point.y, p: oldPressures[index] ?? 0.5, tx: 0, ty: 0, tw: 0,
  }))

  const armHand = runRealArm(handPoints)
  const armNew = runRealArm(vecNew)
  const armSentinel = runRealArm(vecSentinel)
  const armInterim = runRealArm(interimSamples)
  const armOld = runRealArm(vecOld)

  const handSpine: NaturalPoint[] = REAL_HAND_POINTS.map(([x, y]) => ({ x, y }))
  const metrics = {
    hand: measureNaturalArm(armHand.pixels, REAL_SHEET, REAL_SHEET, handSpine, 160),
    vectorNew: measureNaturalArm(armNew.pixels, REAL_SHEET, REAL_SHEET, spine, 160),
    vectorSentinel: measureNaturalArm(armSentinel.pixels, REAL_SHEET, REAL_SHEET, spine, 160),
    vectorInterim006: measureNaturalArm(armInterim.pixels, REAL_SHEET, REAL_SHEET, spine, 160),
    vectorOldGeometryWalk: measureNaturalArm(armOld.pixels, REAL_SHEET, REAL_SHEET, spine, 160),
  }

  const columns = 5
  const small = 432
  const sheet = document.createElement('canvas')
  sheet.width = small * columns + 8 * (columns - 1)
  sheet.height = small + 28
  const sheetCtx = sheet.getContext('2d')
  if (!sheetCtx) throw new Error('real: no composite context')
  sheetCtx.fillStyle = '#ffffff'
  sheetCtx.fillRect(0, 0, sheet.width, sheet.height)
  const arms = [armHand, armNew, armSentinel, armInterim, armOld]
  for (let index = 0; index < arms.length; index += 1) {
    sheetCtx.drawImage(arms[index]!.canvas, index * (small + 8), 0, small, small)
  }
  sheetCtx.fillStyle = '#111111'
  sheetCtx.font = 'bold 13px system-ui, sans-serif'
  const labels = [
    'HAND 45 pts',
    'VEC p 0.14-0.6',
    'VEC sentinel (engine)',
    'VEC interim p 0.45-1',
    'VEC old 693 pts',
  ]
  for (let index = 0; index < labels.length; index += 1) {
    sheetCtx.fillText(labels[index]!, index * (small + 8) + 8, small + 20)
  }

  writeResult({
    scenario: 'real',
    sheet: `${REAL_SHEET}x${REAL_SHEET}`,
    brush: REAL_BRUSH,
    params: REAL_PARAMS,
    sampleCounts: {
      hand: handPoints.length,
      vectorNew: vecNew.length,
      vectorSentinel: vecSentinel.length,
      vectorInterim: interimSamples.length,
      vectorOld: vecOld.length,
    },
    arms: metrics,
    sheetPng: sheet.toDataURL('image/png'),
    env: { renderer: String(renderer), userAgent: navigator.userAgent },
    verdict: 'REAL-STROKE COMPARED',
    totalProbeMs: Math.round(performance.now() - t0),
  })
}

function naturalSpineFromAnchors(anchors: readonly AquarelleAnchor[]): NaturalPoint[] {
  return sampleVectorPath(anchors).points.map((point) => ({ x: point.x, y: point.y }))
}

// --- WebGL2 canary ----------------------------------------------------------

/** Throw if the vendored engine cannot get a real WebGL2 surface. */
function probeRenderer(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const engine = withSeededMathRandom(PAPER_SEED, () => new WatercolorEngine(canvas, null, {}, [64, 64]))
  try {
    const gl = (engine as unknown as { gl: WebGL2RenderingContext }).gl
    const version = gl.getParameter(gl.VERSION) as string
    if (!version) throw new Error('no WebGL2 version string')
    return gl.getParameter(gl.RENDERER) as string
  } finally {
    engine.destroy()
  }
}

// --- report -----------------------------------------------------------------

function writeResult(report: Record<string, unknown>): void {
  const pre = document.getElementById('result')
  if (!pre) throw new Error('probe page is missing pre#result')
  pre.textContent = JSON.stringify(report, null, 2)
  if (typeof report['verdict'] === 'string') {
    pre.setAttribute('data-verdict', report['verdict'] as string)
  }
  const status = document.getElementById('status')
  if (status) status.textContent = 'DONE'
  console.log('PROBE_RESULT ' + JSON.stringify(report))
}

// --- main -------------------------------------------------------------------

function main(): void {
  const renderer = probeRenderer()
  const scenario = new URLSearchParams(location.search).get('scenario')
  if (scenario === 'width') {
    try {
      runWidthScenario(renderer)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      writeResult({
        scenario: 'width',
        widthRatio: { baseRadiusPx: 0, scaledRadiusPx: 0, observed: 0 },
        verdict: `VECTOR-WIDTH FAIL ${message}`,
        error: message,
      })
    }
    return
  }
  if (scenario === 'natural') {
    try {
      runNaturalScenario(renderer)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      writeResult({
        scenario: 'natural',
        arms: {},
        verdict: `NATURAL-PEN FAIL ${message}`,
        error: message,
      })
    }
    return
  }
  if (scenario === 'real') {
    try {
      runRealScenario(renderer)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      writeResult({
        scenario: 'real',
        arms: {},
        verdict: `REAL-STROKE FAIL ${message}`,
        error: message,
      })
    }
    return
  }
  const t0 = performance.now()

  // The interior anchors are the joins the seam metric scans.
  const joins = JOIN_ANCHORS.slice(1, -1)

  const segmentRuns: Record<string, number> = {}
  const payloadExtension: Record<string, number> = {}
  const segmentRunsRaw: Record<string, number> = {}
  const payloadExtensionRaw: Record<string, number> = {}
  const densitySweep: Record<
    string,
    { seamStepPx: number; seamMaxChannelDelta: number; paintedPixels: number }
  > = {}

  for (const density of DENSITIES) {
    const segmentsBuffer = runSegmentRuns(SHEET_W, SHEET_H, JOIN_ANCHORS, density)
    const payloadBuffer = runPayloadExtension(SHEET_W, SHEET_H, JOIN_ANCHORS, density)
    const segmentPainted = paintedPixels(segmentsBuffer)
    const payloadPainted = paintedPixels(payloadBuffer)
    if (segmentPainted === 0 || payloadPainted === 0) {
      throw new Error(`blank seam capture at density ${density} (segmentRuns=${segmentPainted}, payloadExtension=${payloadPainted})`)
    }
    const segmentRaw = seamMaxChannelDelta(segmentsBuffer, SHEET_W, SHEET_H, joins)
    const payloadRaw = seamMaxChannelDelta(payloadBuffer, SHEET_W, SHEET_H, joins)
    const segmentStep = measureSeamStepPx(segmentsBuffer, SHEET_W, SHEET_H, joins)
    const payloadStep = measureSeamStepPx(payloadBuffer, SHEET_W, SHEET_H, joins)
    segmentRuns[String(density)] = segmentStep
    payloadExtension[String(density)] = payloadStep
    segmentRunsRaw[String(density)] = segmentRaw
    payloadExtensionRaw[String(density)] = payloadRaw
    densitySweep[String(density)] = {
      seamStepPx: payloadStep,
      seamMaxChannelDelta: payloadRaw,
      paintedPixels: payloadPainted,
    }
  }

  // The sampling law: the smallest density where the payload-extension
  // seam step stops improving by more than 0.5px over the previous
  // density. When it is still improving at 16x, 16 is the ceiling this
  // probe measures.
  const step1 = payloadExtension['1']!
  const step4 = payloadExtension['4']!
  const settledDensity: Density = step1 - step4 <= 0.5 ? 4 : 16

  // Cost: one stroke plus a sheet at 10 / 50 / 200 strokes per size.
  const cost: Record<string, SizeCost> = {}
  for (const size of COST_SIZES) {
    cost[size.label] = measureCost(size.width, size.height, COST_ANCHORS, settledDensity)
  }

  // VEC-05 reference count: the largest sheet that stays under 33ms at
  // 1920x1080, falling back to 10 when even that misses.
  const ref = cost['1920x1080']!
  let referenceStrokeCount = 10
  if (ref.msPerSheet50 < 33) referenceStrokeCount = 50
  if (ref.msPerSheet200 < 33) referenceStrokeCount = 200

  const first = digestRun(SHEET_W, SHEET_H, JOIN_ANCHORS, settledDensity)
  const second = digestRun(SHEET_W, SHEET_H, JOIN_ANCHORS, settledDensity)
  const identical = first.digest === second.digest

  // Width, both arms measured from pixels. `sizeMult()` is
  // 3^((size - 0.5) * 2), so the size that multiplies the footprint by
  // 1.8 is 0.5 + ln(1.8) / (2 * ln(3)).
  const widthBase = runWidthStroke(settledDensity, { size: 0.5 })
  const widthScaled = runWidthStroke(settledDensity, {
    size: 0.5 + Math.log(WIDTH_FACTOR) / (2 * Math.log(3)),
  })
  const widthObserved = round3(widthScaled.radiusPx / widthBase.radiusPx)

  // The C-03 clamp evidence: scriptBegin's maxRadius is capped at
  // scriptScale = min(1, maxRadius / radius), so this arm measures ~1.0.
  // It is evidence, never a gate.
  const clampBase = runWidthStroke(settledDensity, { maxRadiusFactor: 1 })
  const clampScaled = runWidthStroke(settledDensity, { maxRadiusFactor: WIDTH_FACTOR })
  const clampObserved = round3(clampScaled.radiusPx / clampBase.radiusPx)

  const segmentAt16 = segmentRuns['16']!
  const payloadAt16 = payloadExtension['16']!
  const strategy = payloadAt16 <= segmentAt16 ? 'payload-extension' : 'segment-runs'
  const seamPass = !(segmentAt16 > 2 && payloadAt16 > 2)
  const seamName = seamPass
    ? strategy
    : `both-above-2px-at-16x(segmentRuns=${segmentAt16},payloadExtension=${payloadAt16})`
  const widthPass = widthObserved >= WIDTH_GATE

  // Only the sizeMult arm gates (VEC-03): the clamp arm fires for a reason
  // the phase already designs around, so it is never a FAIL condition.
  const verdict = widthPass
    ? `VECTOR-SPINE ${seamPass ? 'PASS' : 'FAIL'} seam=${seamName} density=${settledDensity} ref=${referenceStrokeCount} width=scriptFactor(${widthObserved})`
    : `VECTOR-SPINE FAIL width=${widthObserved}`

  writeResult({
    scenario: 'vector-spine',
    kind: 'auto',
    widthFactor: 1,
    density: settledDensity,
    sheet: `${SHEET_W}x${SHEET_H}`,
    samplesPerStroke: resampleAnchors(JOIN_ANCHORS, settledDensity).length,
    seamStepPx: { segmentRuns, payloadExtension },
    seamMaxChannelDelta: { segmentRuns: segmentRunsRaw, payloadExtension: payloadExtensionRaw },
    densitySweep,
    settledDensity,
    digestA: first.digest,
    digestB: second.digest,
    byteLength: first.byteLength,
    byteLengthB: second.byteLength,
    identical,
    cost,
    referenceStrokeCount,
    widthRatio: {
      factor: WIDTH_FACTOR,
      baseRadiusPx: round3(widthBase.radiusPx),
      scaledRadiusPx: round3(widthScaled.radiusPx),
      observed: widthObserved,
      channel: 'scriptFactor(sizeMult)',
      maxRadius: {
        baseRadiusPx: round3(clampBase.radiusPx),
        scaledRadiusPx: round3(clampScaled.radiusPx),
        observed: clampObserved,
        channel: 'scriptScale-clamped',
      },
    },
    env: { renderer: String(renderer), userAgent: navigator.userAgent },
    verdict,
    totalProbeMs: Math.round(performance.now() - t0),
  })
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  writeResult({
    scenario: 'vector-spine',
    digestA: '',
    digestB: '',
    byteLength: 0,
    verdict: `VECTOR-SPINE FAIL ${message}`,
    error: message,
  })
}
