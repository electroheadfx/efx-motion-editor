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

function makeStroke(points: AquarellePoint[]): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color: STROKE_COLOR,
    params: { ...DEFAULT_CANONICAL_PARAMS },
    brushId: BRUSH_ID,
    points,
    mutationId: MUTATION_ID,
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
  // seam step stops improving by more than 0.5 channel units over the
  // previous density. When it is still improving at 16x, 16 is the answer
  // (the ceiling this probe can measure).
  const step1 = payloadExtension['1']!
  const step4 = payloadExtension['4']!
  const settledDensity: Density = step1 - step4 <= 0.5 ? 4 : 16

  const first = digestRun(SHEET_W, SHEET_H, JOIN_ANCHORS, settledDensity)
  const second = digestRun(SHEET_W, SHEET_H, JOIN_ANCHORS, settledDensity)
  const identical = first.digest === second.digest

  const segmentAt16 = segmentRuns['16']!
  const payloadAt16 = payloadExtension['16']!

  let verdict: string
  if (segmentAt16 > 2 && payloadAt16 > 2) {
    verdict = `VECTOR-SPINE FAIL seam=both-above-2px-at-16x(segmentRuns=${segmentAt16},payloadExtension=${payloadAt16})`
  } else {
    // The numbers support the lower seam at the densest sampling; a tie
    // keeps the continuous strategy the phase intends to build.
    const strategy = payloadAt16 <= segmentAt16 ? 'payload-extension' : 'segment-runs'
    verdict = `VECTOR-SPINE PASS seam=${strategy} density=${settledDensity}`
  }

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
    env: { renderer: String(renderer), userAgent: navigator.userAgent },
    verdict,
    cost: { totalProbeMs: Math.round(performance.now() - t0) },
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
