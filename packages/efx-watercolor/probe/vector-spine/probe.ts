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
): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color: STROKE_COLOR,
    params: { ...DEFAULT_CANONICAL_PARAMS },
    brushId: BRUSH_ID,
    points,
    mutationId,
    timestamp: 0,
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
  const t0 = performance.now()
  const renderer = probeRenderer()

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
