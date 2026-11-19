// ============================================================
//  SPIKE 001 — coverage-composite acrylic probe.
//
//  SCRATCH HARNESS ONLY. Runs the REAL vendored WebGL2 engine twice:
//    engine=baseline  -> packages/efx-watercolor/src (current build, read-only)
//    engine=coverage  -> ../workbench/src (copy patched with the coverage model)
//
//  Scenarios (selected by ?scenario=):
//    neutral            the committed neutral-identity script (256², Body absent)
//    white-over-blue    blue #0044dd band, white #f0f0f0 diagonal, Body knob
//    red-over-blue-50   blue field, then 50 rapid red #cc2222 strokes, Body 100
//    watercolor-50      50 rapid strokes on blank paper at Body 0 (cost control)
//
//  Everything is deterministic: seeded Math.random, fixed script, fixed paper.
//  Output: one JSON report in <pre id="result">; run.mjs writes it to results/.
//
//  Instrumentation (both engines, same patch):
//    - GPU target bytes allocated/disposed/peak per GL class
//    - draw calls, split into full-document (no scissor) and scissored
//    - full-document blits (the rev-4 per-stroke preInk snapshot is 2)
//  These make "no per-stroke full-canvas punch/merge" a measured fact for the
//  engine side (the app's cached-base punch/merge is outside this probe).
// ============================================================

import { WatercolorEngine as BaseEngine } from '../../../../packages/efx-watercolor/src/playground/Engine'
import { createAquarelleEngineAdapter as createBaseAdapter } from '../../../../packages/efx-watercolor/src/adapter/engineAdapter'
import { GL as BaseGL } from '../../../../packages/efx-watercolor/src/playground/gl'
import { coeffsToHex, pigmentFromHex } from '../../../../packages/efx-watercolor/src/playground/spectral'
import { PAPERS, type PaperPreset } from '../../../../packages/efx-watercolor/src/playground/papers'
import {
  toStudioStroke,
  type AquarellePoint,
} from '../../../../packages/efx-watercolor/src/payload/toStudioStroke'

import { WatercolorEngine as CovEngine } from '../workbench/src/playground/Engine'
import { createAquarelleEngineAdapter as createCovAdapter } from '../workbench/src/adapter/engineAdapter'
import { GL as CovGL } from '../workbench/src/playground/gl'

const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
const SETTLE_TICKS = 8
const BRUSH_ID = 'round'
const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

// The canonical bag exactly as the app records it (0..100).
const BASE_PARAMS: Readonly<Record<string, number>> = {
  size: 12,
  water: 50,
  load: 50,
  flow: 50,
  bleed: 50,
  dry: 50,
  edge: 50,
  granulation: 50,
  lift: 22,
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

// --- instrumentation: GPU target memory ------------------------------------

interface MemoryStats {
  allocated: number
  disposed: number
  live: number
  peak: number
}

function bytesPerTexel(internal: number): number {
  // WebGL2 internal formats used by the engine (values fixed by the spec).
  if (internal === 0x881a) return 8 // RGBA16F
  if (internal === 0x8058) return 4 // RGBA8
  if (internal === 0x822d) return 2 // R16F
  if (internal === 0x822f) return 4 // RG16F
  if (internal === 0x8230) return 8 // RG32F
  return 0
}

function trackMemory(GLClass: { prototype: Record<string, unknown> }): MemoryStats {
  const proto = GLClass.prototype as unknown as {
    target: (w: number, h: number, formats: { internal: number }[], filter: number) => object
    disposeTarget: (t: object) => void
    disposeTargets: () => void
  }
  const stats: MemoryStats = { allocated: 0, disposed: 0, live: 0, peak: 0 }
  const live = new Map<object, number>()
  const originalTarget = proto.target
  const originalDispose = proto.disposeTarget
  const originalDisposeAll = proto.disposeTargets
  proto.target = function trackedTarget(w, h, formats, filter) {
    const t = originalTarget.call(this, w, h, formats, filter)
    const bytes = formats.reduce((sum, f) => sum + bytesPerTexel(f.internal), 0) * w * h
    live.set(t, bytes)
    stats.allocated += bytes
    stats.live += bytes
    if (stats.live > stats.peak) stats.peak = stats.live
    return t
  }
  proto.disposeTarget = function trackedDispose(t) {
    const bytes = live.get(t)
    if (bytes !== undefined) {
      live.delete(t)
      stats.live -= bytes
      stats.disposed += bytes
    }
    return originalDispose.call(this, t)
  }
  proto.disposeTargets = function trackedDisposeAll() {
    live.clear()
    stats.live = 0
    return originalDisposeAll.call(this)
  }
  return stats
}

// --- instrumentation: draw / blit counts -----------------------------------

interface DrawStats {
  total: number
  fullDocument: number
  fullDocumentBlits: number
}

function trackDraws(GLClass: { prototype: Record<string, unknown> }, docSide: () => number): DrawStats {
  const proto = GLClass.prototype as unknown as {
    draw: (target: { w: number; h: number } | null, rect?: object | null, canvasSize?: unknown) => void
    blit: (src: unknown, sx: number, sy: number, dst: unknown, dx: number, dy: number, w: number, h: number) => void
  }
  const stats: DrawStats = { total: 0, fullDocument: 0, fullDocumentBlits: 0 }
  const originalDraw = proto.draw
  const originalBlit = proto.blit
  proto.draw = function trackedDraw(target, rect, canvasSize) {
    stats.total += 1
    if (!rect && target && target.w === docSide() && target.h === docSide()) stats.fullDocument += 1
    return originalDraw.call(this, target, rect, canvasSize)
  }
  proto.blit = function trackedBlit(src, sx, sy, dst, dx, dy, w, h) {
    if (w === docSide() && h === docSide()) stats.fullDocumentBlits += 1
    return originalBlit.call(this, src, sx, sy, dst, dx, dy, w, h)
  }
  return stats
}

// The side is resolved by the engine under test; each engine gets its own
// stats object with its own side.
const sides = { baseline: 0, coverage: 0 }
const baseMemory = trackMemory(BaseGL as never)
const covMemory = trackMemory(CovGL as never)
const baseDraws = trackDraws(BaseGL as never, () => sides.baseline)
const covDraws = trackDraws(CovGL as never, () => sides.coverage)

// --- engine capture ---------------------------------------------------------

let capturedBaseEngine: BaseEngine | null = null
let capturedCovEngine: CovEngine | null = null

function patchEngineCapture(engineClass: typeof BaseEngine | typeof CovEngine, which: 'baseline' | 'coverage'): void {
  const proto = engineClass.prototype as unknown as { setManual: (manual: boolean) => void }
  const original = proto.setManual
  proto.setManual = function patchedSetManual(this: unknown, manual: boolean) {
    if (which === 'baseline') {
      if (capturedBaseEngine === null) capturedBaseEngine = this as BaseEngine
    } else if (capturedCovEngine === null) {
      capturedCovEngine = this as CovEngine
    }
    return original.call(this, manual)
  }
}
patchEngineCapture(BaseEngine, 'baseline')
patchEngineCapture(CovEngine, 'coverage')

// --- digests and pixel statistics -------------------------------------------

function hashPixels(buffer: Uint8ClampedArray): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < buffer.length; i += 1) {
    hash ^= buffer[i]!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function digestCanvas(canvas: HTMLCanvasElement): { digest: string; byteLength: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('digest: exported canvas has no 2D context')
  const buffer = new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data)
  return { digest: hashPixels(buffer), byteLength: buffer.length }
}

interface BandBox {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

interface BoxStats {
  mean: [number, number, number]
  luma: number
  hue: number
  sat: number
  blueExcess: number
  nearPaperPct: number
  minLuma: number
  maxLuma: number
  pixels: number
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === rr) h = ((gg - bb) / d + 6) % 6
    else if (max === gg) h = (bb - rr) / d + 2
    else h = (rr - gg) / d + 4
    h *= 60
  }
  return { h, s: max > 0 ? d / max : 0, v: max }
}

/** Rows are top-first in the export while doc uv is y-up. */
function boxStats(canvas: HTMLCanvasElement, box: BandBox): BoxStats {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('boxStats: canvas has no 2D context')
  const w = canvas.width
  const h = canvas.height
  const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)))
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)))
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)))
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let r = 0
  let g = 0
  let b = 0
  let luma = 0
  let n = 0
  let nearPaper = 0
  let minLuma = 255
  let maxLuma = 0
  for (let i = 0; i < data.length; i += 4) {
    const rr = data[i]!
    const gg = data[i + 1]!
    const bb = data[i + 2]!
    r += rr
    g += gg
    b += bb
    const l = (rr + gg + bb) / 3
    luma += l
    if (l < minLuma) minLuma = l
    if (l > maxLuma) maxLuma = l
    // The transparent export is pure transmittance: bare paper is exactly 255.
    if (rr >= 250 && gg >= 250 && bb >= 250) nearPaper += 1
    n += 1
  }
  const mean: [number, number, number] = [r / n, g / n, b / n]
  const hsv = rgbToHsv(mean[0], mean[1], mean[2])
  return {
    mean,
    luma: luma / n,
    hue: hsv.h,
    sat: hsv.s,
    blueExcess: mean[2] - mean[0],
    nearPaperPct: (100 * nearPaper) / n,
    minLuma,
    maxLuma,
    pixels: n,
  }
}

/** Mean/min/max of the alpha channel (mode 4 export). */
function alphaStats(canvas: HTMLCanvasElement, box: BandBox): { mean: number; min: number; max: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('alphaStats: canvas has no 2D context')
  const w = canvas.width
  const h = canvas.height
  const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)))
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)))
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)))
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let sum = 0
  let min = 255
  let max = 0
  let n = 0
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i]!
    sum += a
    if (a < min) min = a
    if (a > max) max = a
    n += 1
  }
  return { mean: sum / n / 255, min: min / 255, max: max / 255 }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * The exact failure the criterion names: a texel the pigment layer claims to
 * COVER (mode-4 alpha >= threshold) that still reads as bare paper (>= 250 in
 * the transparent export). Percentage of all covered texels.
 */
function coveredPaperWhitePct(transparent: HTMLCanvasElement, pigment: HTMLCanvasElement, threshold = 0.5): number {
  const ctxT = transparent.getContext('2d')
  const ctxP = pigment.getContext('2d')
  if (!ctxT || !ctxP) throw new Error('coveredPaperWhitePct: canvas has no 2D context')
  const t = ctxT.getImageData(0, 0, transparent.width, transparent.height).data
  const a = ctxP.getImageData(0, 0, pigment.width, pigment.height).data
  let covered = 0
  let paperWhite = 0
  for (let i = 0; i < t.length; i += 4) {
    if (a[i + 3]! < threshold * 255) continue
    covered += 1
    const luma = (t[i]! + t[i + 1]! + t[i + 2]!) / 3
    if (luma >= 250) paperWhite += 1
  }
  return covered > 0 ? (100 * paperWhite) / covered : 0
}

// --- scripts ----------------------------------------------------------------

interface ScriptEntry {
  readonly color: string
  readonly points: readonly AquarellePoint[]
  readonly mutationId: number
  readonly body?: number
  readonly size?: number
  /** Settle ticks after applyStroke; 0 = rapid (one tick). */
  readonly settle?: number
  /** Fix after the settle (defaults true). */
  readonly fixAfter?: boolean
  /** Reported with the per-stroke timing (under / cover / rapid / ref). */
  readonly kind?: string
}

function paramsBag(entry: ScriptEntry): Record<string, number> {
  const bag: Record<string, number> = { ...BASE_PARAMS }
  if (entry.body !== undefined) bag['body'] = entry.body
  if (entry.size !== undefined) bag['size'] = entry.size
  return bag
}

function makeStroke(entry: ScriptEntry) {
  return toStudioStroke({
    tool: 'brush',
    color: entry.color,
    params: paramsBag(entry),
    brushId: BRUSH_ID,
    points: entry.points.map((point) => ({ ...point })),
    mutationId: entry.mutationId,
    timestamp: 0,
  })
}

const NEUTRAL_POINTS: readonly AquarellePoint[] = [
  { x: 0.3, y: 0.3, p: 0.55, tx: 0, ty: 0, tw: 0 },
  { x: 0.42, y: 0.4, p: 0.7, tx: 0, ty: 0, tw: 0 },
  { x: 0.56, y: 0.52, p: 0.62, tx: 0, ty: 0, tw: 0 },
  { x: 0.7, y: 0.62, p: 0.45, tx: 0, ty: 0, tw: 0 },
]

const BLUE = '#0044dd'
const WHITE = '#f0f0f0'
const RED = '#cc2222'

const BLUE_BAND: readonly AquarellePoint[] = [
  { x: 0.12, y: 0.5, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.35, y: 0.5, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.6, y: 0.5, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.88, y: 0.5, p: 0.8, tx: 0, ty: 0, tw: 0 },
]

const WHITE_DIAGONAL: readonly AquarellePoint[] = [
  { x: 0.18, y: 0.8, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.4, y: 0.62, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.6, y: 0.4, p: 0.8, tx: 0, ty: 0, tw: 0 },
  { x: 0.82, y: 0.2, p: 0.8, tx: 0, ty: 0, tw: 0 },
]

const BLUE_FIELD_LINES: readonly number[] = [0.42, 0.5, 0.58]

const RED_REF_POINTS: readonly AquarellePoint[] = [
  { x: 0.2, y: 0.86, p: 0.75, tx: 0, ty: 0, tw: 0 },
  { x: 0.5, y: 0.86, p: 0.75, tx: 0, ty: 0, tw: 0 },
  { x: 0.8, y: 0.86, p: 0.75, tx: 0, ty: 0, tw: 0 },
]

function horizontalLine(y: number): readonly AquarellePoint[] {
  return [
    { x: 0.16, y, p: 0.75, tx: 0, ty: 0, tw: 0 },
    { x: 0.5, y: y + 0.002, p: 0.75, tx: 0, ty: 0, tw: 0 },
    { x: 0.84, y, p: 0.75, tx: 0, ty: 0, tw: 0 },
  ]
}

function neutralScript(): ScriptEntry[] {
  return [{ color: '#2244aa', points: NEUTRAL_POINTS, mutationId: 0x6d65d1 }]
}

function whiteOverBlueScript(body: number): ScriptEntry[] {
  // The UNDERLAYER is painted at Body 0 (a saturated watercolour band, the
  // same on both engines and at every Body value). Only the covering stroke
  // carries the Body knob — the knob is the acrylic cover, not the paint.
  return [
    { color: BLUE, points: BLUE_BAND, mutationId: 0x51a7e1, body: 0, kind: 'under' },
    { color: WHITE, points: WHITE_DIAGONAL, mutationId: 0x51a7e2, body, kind: 'cover' },
  ]
}

function redOverBlueScript(redBody = 100): ScriptEntry[] {
  const script: ScriptEntry[] = []
  // Saturated watercolour underlayer (Body 0), identical on both engines.
  for (let i = 0; i < BLUE_FIELD_LINES.length; i += 1) {
    script.push({ color: BLUE, points: horizontalLine(BLUE_FIELD_LINES[i]!), mutationId: 0x7ed001 + i, body: 0, kind: 'under' })
  }
  for (let i = 0; i < 50; i += 1) {
    const jitter = ((i % 3) - 1) * 0.003
    script.push({
      color: RED,
      points: horizontalLine(0.5 + jitter),
      mutationId: 0x7ed100 + i,
      body: redBody,
      settle: 1,
      fixAfter: false,
      kind: 'rapid',
    })
  }
  script.push({ color: RED, points: RED_REF_POINTS, mutationId: 0x7ed200, body: redBody, kind: 'ref' })
  return script
}

function watercolorScript(): ScriptEntry[] {
  const script: ScriptEntry[] = []
  for (let i = 0; i < 50; i += 1) {
    const jitter = ((i % 3) - 1) * 0.003
    script.push({
      color: RED,
      points: horizontalLine(0.5 + jitter),
      mutationId: 0x7ee100 + i,
      body: 0,
      settle: 1,
      fixAfter: false,
    })
  }
  return script
}

// --- run --------------------------------------------------------------------

type Which = 'baseline' | 'coverage'

interface EngineHandle {
  applyStroke: (stroke: unknown) => void
  stepTick: (tick: number) => void
  fix: () => void
  dispose: () => void
}

interface FrameReport {
  gate: string
  engine: Which
  scenario: string
  body: number | null
  width: number
  height: number
  renderer: string
  verdict: string
  bakeMs: number
  renderMs: number
  strokeTimingsMs: number[]
  strokeKinds: string[]
  strokeP50Ms: number | null
  strokeP95Ms: number | null
  strokeMaxMs: number | null
  draws: DrawStats
  memory: MemoryStats & { setupBytes: number; transientPeakBytes: number }
  digests: Record<string, string>
  boxes: Record<string, BoxStats>
  alpha: Record<string, { mean: number; min: number; max: number }>
  extra: Record<string, number>
  ideal: Record<string, string>
  error?: string
}

function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return round2(sorted[idx]!)
}

function probeRenderer(EngineClass: typeof BaseEngine | typeof CovEngine): string {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const engine = withSeededMathRandom(PAPER_SEED, () => new EngineClass(canvas, null, {}, [64, 64]))
  try {
    const gl = (engine as unknown as { gl: WebGL2RenderingContext }).gl
    const version = gl.getParameter(gl.VERSION) as string
    if (!version) throw new Error('no WebGL2 version string')
    return gl.getParameter(gl.RENDERER) as string
  } finally {
    engine.destroy()
  }
}

function run(
  which: Which,
  gate: string,
  scenario: string,
  sheet: number,
  body: number | null,
): FrameReport {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  sides[which] = sheet
  const memory = which === 'baseline' ? baseMemory : covMemory
  const draws = which === 'baseline' ? baseDraws : covDraws
  // Reset counters for this run (the canary below allocates/draws too).
  memory.allocated = 0
  memory.disposed = 0
  memory.live = 0
  memory.peak = 0
  draws.total = 0
  draws.fullDocument = 0
  draws.fullDocumentBlits = 0
  if (which === 'baseline') capturedBaseEngine = null
  else capturedCovEngine = null

  // The canary is created BEFORE the adapter on purpose: it reproduces the
  // existing medium-engine probe's draw order, so the neutral digests can be
  // compared with the committed baseline.
  const renderer = probeRenderer(which === 'baseline' ? BaseEngine : CovEngine)

  const adapter: EngineHandle = withSeededMathRandom(PAPER_SEED, () =>
    which === 'baseline'
      ? (createBaseAdapter({
          width: sheet,
          height: sheet,
          paperPreset: COLD,
          paperStrength: PAPER_STRENGTH,
        }) as EngineHandle)
      : (createCovAdapter({
          width: sheet,
          height: sheet,
          paperPreset: COLD,
          paperStrength: PAPER_STRENGTH,
        }) as EngineHandle),
  )

  // Only the stroke script is counted: the adapter's setup draws the paper
  // (2 full-document passes) before any stroke exists.
  draws.total = 0
  draws.fullDocument = 0
  draws.fullDocumentBlits = 0

  const script =
    scenario === 'white-over-blue'
      ? whiteOverBlueScript(body ?? 100)
      : scenario === 'red-over-blue-50'
        ? redOverBlueScript(body ?? 100)
        : scenario === 'watercolor-50'
          ? watercolorScript()
          : neutralScript()

  const engine = which === 'baseline' ? capturedBaseEngine : capturedCovEngine
  if (engine === null) throw new Error('probe never captured the adapter engine (setManual tap missed)')

  // Memory baseline: the document is allocated; anything above this during
  // the script is transient (rev-4 preInk) or persistent additions (cover).
  const setupBytes = memory.live
  // The setup's own scratch peaks (paper field) are not painting cost.
  memory.peak = memory.live
  const timings: number[] = []
  const bakeStart = performance.now()
  try {
    script.forEach((entry, index) => {
      const t0 = performance.now()
      adapter.applyStroke(makeStroke(entry))
      const settle = entry.settle ?? SETTLE_TICKS
      for (let tick = 0; tick <= settle; tick += 1) adapter.stepTick(tick)
      if (entry.fixAfter !== false) adapter.fix()
      // Fix every 10 rapid strokes, so the 50-stroke session is not one giant
      // wet pool; the last stroke settles in the final fix.
      if (entry.fixAfter === false && (index + 1) % 10 === 0) adapter.fix()
      timings.push(round2(performance.now() - t0))
    })
    if (script.length > 0) adapter.fix()
  } finally {
    // keep the adapter until exports are done
  }
  const bakeMs = round2(performance.now() - bakeStart)

  // Snapshot the cost counters BEFORE the exports: the export readback
  // allocates its own target and would inflate the "during painting" numbers.
  const drawsSnapshot: DrawStats = { ...draws }
  const memorySnapshot = {
    ...memory,
    setupBytes,
    transientPeakBytes: memory.peak - setupBytes,
  }

  const transparent = engine.exportCanvas('transparent')
  const whiteCanvas = engine.exportCanvas('white')
  const paperCanvas = engine.exportCanvas('paper')
  // Mode 4 works on both engines at runtime (MODE.pigment = 4 exists in both);
  // only the coverage variant reads the coverage channel there.
  const pigment = (engine as unknown as { exportCanvas: (b: string) => HTMLCanvasElement }).exportCanvas('pigment')
  const renderMs = round2(performance.now() - bakeStart - bakeMs)

  const dims = { width: sheet, height: sheet }
  const digests: Record<string, string> = {
    paper: digestCanvas(paperCanvas).digest,
    transparent: digestCanvas(transparent).digest,
    white: digestCanvas(whiteCanvas).digest,
    pigment: digestCanvas(pigment).digest,
  }

  const boxes: Record<string, BoxStats> = {}
  const alpha: Record<string, { mean: number; min: number; max: number }> = {}
  const extra: Record<string, number> = {}
  if (scenario === 'white-over-blue') {
    extra['coveredPaperWhitePct'] = round2(coveredPaperWhitePct(transparent, pigment, 0.5))
    // Small boxes inside the stroke CORES: the strokes' alpha rims are ~0.02
    // doc heights wide, so a wider box would average paint with paper.
    const defs: Record<string, BandBox> = {
      cross: { x0: 0.49, y0: 0.49, x1: 0.51, y1: 0.51 },
      whiteOwn: { x0: 0.276, y0: 0.688, x1: 0.304, y1: 0.712 },
      blueOwn: { x0: 0.24, y0: 0.488, x1: 0.3, y1: 0.512 },
      paper: { x0: 0.45, y0: 0.86, x1: 0.55, y1: 0.94 },
    }
    for (const [name, box] of Object.entries(defs)) {
      boxes[name] = boxStats(transparent, box)
      alpha[name] = alphaStats(pigment, box)
    }
  } else if (scenario === 'red-over-blue-50') {
    const defs: Record<string, BandBox> = {
      redField: { x0: 0.42, y0: 0.492, x1: 0.58, y1: 0.508 },
      redRef: { x0: 0.42, y0: 0.848, x1: 0.58, y1: 0.872 },
      paper: { x0: 0.45, y0: 0.93, x1: 0.55, y1: 0.98 },
    }
    for (const [name, box] of Object.entries(defs)) {
      boxes[name] = boxStats(transparent, box)
      alpha[name] = alphaStats(pigment, box)
    }
  } else if (scenario === 'watercolor-50') {
    const defs: Record<string, BandBox> = {
      field: { x0: 0.42, y0: 0.492, x1: 0.58, y1: 0.508 },
      paper: { x0: 0.45, y0: 0.93, x1: 0.55, y1: 0.98 },
    }
    for (const [name, box] of Object.entries(defs)) {
      boxes[name] = boxStats(transparent, box)
    }
  }

  const ideal = {
    blue: coeffsToHex(pigmentFromHex(BLUE).coeffs),
    white: coeffsToHex(pigmentFromHex(WHITE).coeffs),
    red: coeffsToHex(pigmentFromHex(RED).coeffs),
  }

  const report: FrameReport = {
    gate,
    engine: which,
    scenario,
    body,
    ...dims,
    renderer,
    verdict: 'SPIKE-001 CAPTURED',
    bakeMs,
    renderMs,
    strokeTimingsMs: timings,
    strokeKinds: script.map((entry) => entry.kind ?? 'stroke'),
    strokeP50Ms: percentile(timings, 50),
    strokeP95Ms: percentile(timings, 95),
    strokeMaxMs: timings.length > 0 ? round2(Math.max(...timings)) : null,
    draws: drawsSnapshot,
    memory: memorySnapshot,
    digests,
    boxes,
    alpha,
    extra,
    ideal,
  }

  adapter.dispose()
  return report
}

// --- page plumbing ----------------------------------------------------------

function writeResult(report: Record<string, unknown>): void {
  const pre = document.getElementById('result')
  if (!pre) throw new Error('probe page is missing pre#result')
  pre.textContent = JSON.stringify(report, null, 2)
  if (typeof report['verdict'] === 'string') pre.setAttribute('data-verdict', report['verdict'] as string)
  const status = document.getElementById('status')
  if (status) status.textContent = 'DONE'
  console.log('PROBE_RESULT ' + JSON.stringify(report))
}

function readNumber(name: string, min: number, max: number): number | undefined {
  const raw = new URLSearchParams(location.search).get(name)
  if (raw === null || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`invalid ${name} "${raw}" (expected ${min}..${max})`)
  }
  return value
}

function main(): void {
  const query = new URLSearchParams(location.search)
  const gate = query.get('gate') ?? 'spike-001'
  const whichRaw = query.get('engine') ?? 'coverage'
  const which: Which = whichRaw === 'baseline' ? 'baseline' : 'coverage'
  const scenario = query.get('scenario') ?? 'white-over-blue'
  const sheet = Math.round(readNumber('size', 32, 4096) ?? 1080)
  const body = readNumber('body', 0, 100) ?? null
  try {
    const report = run(which, gate, scenario, sheet, body)
    writeResult(report as unknown as Record<string, unknown>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeResult({
      gate,
      engine: which,
      scenario,
      body,
      verdict: `SPIKE-001 FAIL ${message}`,
      error: message,
    })
  }
}

main()
