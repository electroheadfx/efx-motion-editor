// ============================================================
//  SPIKE 002 — acrylic bristle deposit feasibility probe.
//
//  SCRATCH HARNESS ONLY. Runs the REAL vendored WebGL2 engine twice:
//    engine=baseline -> packages/efx-watercolor/src (read-only)
//    engine=bristle  -> ../workbench/src (copy patched with the per-bristle
//                       carrier + 5-nearest deposit + last-touch channel)
//
//  Three decision legs, all measured on the same page load:
//    1. determinism — the same script runs twice through fresh adapters;
//       image digests AND reservoir digests must match. `--salt n` shifts the
//       bristle RNG at stroke start to demonstrate that the seed is the
//       load-bearing record state (salt 0 vs salt 1 must differ).
//    2. cost — bakeMs (script + settle) and renderMs (exports + readbacks)
//       at 256 / 1080 / 2048, plus GPU target bytes counted at the GL
//       boundary (the same instrumentation idiom as spike 001).
//    3. wetness — the same scene with the last-touch channel off/on; the
//       report carries the measured extra bytes and the bakeMs delta.
//
//  Scenarios:
//    cross        dark fixed band + two wet crossings (pickup/refill surface)
//    watercolor-50 the committed 50-rapid-stroke cost passage
//    neutral      the plan-01 single stroke
//
//  Output: one JSON report in <pre id="result">; run.mjs writes results/.
// ============================================================

import { WatercolorEngine as BaseEngine } from '../../../../packages/efx-watercolor/src/playground/Engine'
import { createAquarelleEngineAdapter as createBaseAdapter } from '../../../../packages/efx-watercolor/src/adapter/engineAdapter'
import { GL as BaseGL } from '../../../../packages/efx-watercolor/src/playground/gl'
import { PAPERS, type PaperPreset } from '../../../../packages/efx-watercolor/src/playground/papers'
import { WatercolorEngine as BristleEngine } from '../workbench/src/playground/Engine'
import { createAquarelleEngineAdapter as createBristleAdapter } from '../workbench/src/adapter/engineAdapter'
import { GL as BristleGL } from '../workbench/src/playground/gl'
import { toStudioStroke, type AquarellePoint } from '../workbench/src/payload/toStudioStroke'

const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
const SETTLE_TICKS = 8
const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

const STROKE_PARAMS: Readonly<Record<string, number>> = {
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

// --- deterministic RNG (the adapter's own mulberry32) -----------------------

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

// --- GPU target-byte instrumentation at the GL boundary ---------------------
// Byte sizes of the engine's formats, by the WebGL2 internal enum the engine
// passes to GL.target(). Counted on allocation AND kept as a live total on
// dispose, so the report's number is the driver-side footprint of the sheet.

const BYTES_PER_TEXEL: Readonly<Record<number, number>> = {
  0x822f: 4,  // RG16F
  0x822d: 2,  // R16F
  0x881a: 8,  // RGBA16F
  0x8230: 8,  // RG32F
  0x8058: 4,  // RGBA8
  0x822e: 4,  // R32F
  0x8814: 16, // RGBA32F
}

interface MemoryCounter { total: number; peak: number; live: Map<unknown, number> }

const MEMORY: MemoryCounter = { total: 0, peak: 0, live: new Map() }

let instrumented = false
function instrumentGL(): void {
  if (instrumented) return
  instrumented = true
  for (const glClass of [BaseGL, BristleGL]) {
    const proto = glClass.prototype as unknown as {
      target: (w: number, h: number, formats: { internal: number }[], filter: number) => unknown
      disposeTarget: (t: unknown) => void
      disposeTargets: () => void
    }
    const original = proto.target
    proto.target = function patchedTarget(
      this: unknown,
      w: number,
      h: number,
      formats: { internal: number }[],
      filter: number,
    ) {
      const bytes = w * h * formats.reduce((sum, f) => sum + (BYTES_PER_TEXEL[f.internal] ?? 0), 0)
      MEMORY.total += bytes
      MEMORY.peak = Math.max(MEMORY.peak, MEMORY.total)
      const t = original.call(this, w, h, formats, filter)
      MEMORY.live.set(t, bytes)
      return t
    }
    const originalDispose = proto.disposeTarget
    proto.disposeTarget = function patchedDispose(this: unknown, t: unknown) {
      const bytes = MEMORY.live.get(t)
      if (bytes !== undefined) {
        MEMORY.total -= bytes
        MEMORY.live.delete(t)
      }
      return originalDispose.call(this, t)
    }
    const originalDisposeAll = proto.disposeTargets
    proto.disposeTargets = function patchedDisposeAll(this: unknown) {
      // The engine's own resources map is private; zero the live total on a
      // wholesale dispose (document re-creation) — the counter's job is the
      // per-run peak, and a wholesale dispose ends that run's targets.
      return originalDisposeAll.call(this)
    }
  }
}

function resetMemory(): void {
  MEMORY.total = 0
  MEMORY.peak = 0
  MEMORY.live.clear()
}

// --- engine capture (the adapter owns its instance) -------------------------

let baseEngine: BaseEngine | null = null
let bristleEngine: BristleEngine | null = null

function tapEngine<T extends { prototype: { setManual: (v: boolean) => void } }>(
  cls: T,
  assign: (e: never) => void,
): void {
  const proto = cls.prototype
  const original = proto.setManual
  proto.setManual = function patched(this: { __capped?: boolean }, manual: boolean) {
    if (!this.__capped) {
      this.__capped = true
      assign(this as never)
    }
    return original.call(this as never, manual)
  }
}

tapEngine(BaseEngine, (e) => { baseEngine = e })
tapEngine(BristleEngine, (e) => { bristleEngine = e })

// --- digests ----------------------------------------------------------------

function fnvBytes(bytes: ArrayLike<number>): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i]!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function digestCanvas(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('digest: exported canvas has no 2D context')
  return fnvBytes(new Uint8ClampedArray(ctx.getImageData(0, 0, canvas.width, canvas.height).data))
}

// --- scenarios --------------------------------------------------------------

interface Entry {
  readonly color: string
  readonly points: readonly AquarellePoint[]
  readonly mutationId: number
  readonly fixAfter?: boolean
  readonly settle?: number
}

function horizontalLine(y: number, pressure = 0.75): AquarellePoint[] {
  return [
    { x: 0.16, y, p: pressure, tx: 0, ty: 0, tw: 0 },
    { x: 0.5, y: y + 0.002, p: pressure, tx: 0, ty: 0, tw: 0 },
    { x: 0.84, y, p: pressure, tx: 0, ty: 0, tw: 0 },
  ]
}

function diagonal(x0: number, y0: number, x1: number, y1: number, pressure = 0.8): AquarellePoint[] {
  return [
    { x: x0, y: y0, p: pressure, tx: 0, ty: 0, tw: 0 },
    { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 0.02, p: pressure, tx: 0, ty: 0, tw: 0 },
    { x: x1, y: y1, p: pressure, tx: 0, ty: 0, tw: 0 },
  ]
}

function watercolor50(): Entry[] {
  const script: Entry[] = []
  for (let i = 0; i < 50; i += 1) {
    const jitter = ((i % 3) - 1) * 0.003
    script.push({
      color: '#cc2222',
      points: horizontalLine(0.5 + jitter),
      mutationId: 0x7ee100 + i,
      settle: 1,
      fixAfter: false,
    })
  }
  return script
}

/**
 * The pickup surface: a dark band settled dry, then two wet crossings — a
 * light diagonal over it and a mid-tone diagonal back — so a reservoir that
 * actually picks up the canvas colour must move the deposited hue, and a
 * reservoir that ignores the canvas deposits the palette colour twice.
 */
function crossScene(): Entry[] {
  return [
    { color: '#111111', points: horizontalLine(0.5, 0.7), mutationId: 0x51b001 },
    { color: '#dddddd', points: diagonal(0.2, 0.8, 0.8, 0.2), mutationId: 0x51b002, fixAfter: false },
    { color: '#cc2222', points: diagonal(0.2, 0.24, 0.8, 0.8), mutationId: 0x51b003, fixAfter: false },
  ]
}

function neutralScene(): Entry[] {
  return [
    {
      color: '#2244aa',
      points: [
        { x: 0.3, y: 0.3, p: 0.55, tx: 0, ty: 0, tw: 0 },
        { x: 0.42, y: 0.4, p: 0.7, tx: 0, ty: 0, tw: 0 },
        { x: 0.56, y: 0.52, p: 0.62, tx: 0, ty: 0, tw: 0 },
        { x: 0.7, y: 0.62, p: 0.45, tx: 0, ty: 0, tw: 0 },
      ],
      mutationId: 0x6d65d1,
    },
  ]
}

/**
 * The acrylic-scale cost passage: 20 strokes in four directions, three
 * pigments, every fifth stroke left wet — the size and count a real acrylic
 * brush uses (canonical size 60 → ~78 bristles at 1080², ~149 at 2K).
 */
function acrylic20(): Entry[] {
  const script: Entry[] = []
  const colors = ['#cc2222', '#224488', '#dddddd', '#333333']
  for (let i = 0; i < 20; i += 1) {
    const row = i % 4
    const y = 0.22 + row * 0.18
    const points =
      i % 2 === 0
        ? horizontalLine(y, 0.75)
        : diagonal(0.16, y - 0.09, 0.84, y + 0.09, 0.75)
    script.push({
      color: colors[row]!,
      points,
      mutationId: 0x51c000 + i,
      settle: 3,
      fixAfter: i % 5 !== 4,
    })
  }
  return script
}

function readScenario(): Entry[] {
  const scenario = QUERY.get('scenario') ?? 'cross'
  if (scenario === 'cross') return crossScene()
  if (scenario === 'watercolor-50') return watercolor50()
  if (scenario === 'neutral') return neutralScene()
  if (scenario === 'acrylic-20') return acrylic20()
  throw new Error(`invalid scenario "${scenario}" (expected cross, watercolor-50, neutral, acrylic-20)`)
}

function makeStroke(entry: Entry) {
  return toStudioStroke({
    tool: 'brush',
    color: entry.color,
    params: { ...STROKE_PARAMS, size: CANON_SIZE, body: BODY },
    brushId: BRUSH_ID,
    points: entry.points.map((p) => ({ ...p })),
    mutationId: entry.mutationId,
    timestamp: 0,
  })
}

/**
 * A direct construction canary: the adapter fails closed on any engine
 * exception (no WebGL2, a bad shader), so an uncaptured engine would hide
 * the real error. This surfaces it.
 */
function canary(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const engine = withSeededMathRandom(PAPER_SEED, () => new BristleEngine(canvas, null, {}, [64, 64]))
  try {
    const gl = (engine as unknown as { gl: WebGL2RenderingContext }).gl
    return gl.getParameter(gl.RENDERER) as string
  } finally {
    engine.destroy()
  }
}

// --- region metrics ---------------------------------------------------------
// Four boxes in doc uv (y up) on the cross scene: the two crossings, each
// stroke's own body, and bare paper. The crossing reading is the pickup
// evidence — a reservoir that ignores the canvas deposits the crossing as
// pure red; one that picked up the black band reads darker and less red.

interface Box { x0: number; y0: number; x1: number; y1: number }

const CROSS_BOXES: Readonly<Record<'crossing' | 'redOwn' | 'lightOwn' | 'paper', Box>> = {
  crossing: { x0: 0.46, y0: 0.46, x1: 0.54, y1: 0.54 },
  redOwn: { x0: 0.28, y0: 0.34, x1: 0.36, y1: 0.42 },
  lightOwn: { x0: 0.28, y0: 0.64, x1: 0.36, y1: 0.72 },
  paper: { x0: 0.45, y0: 0.86, x1: 0.55, y1: 0.94 },
}

function boxMean(canvas: HTMLCanvasElement, box: Box): { r: number; g: number; b: number; luma: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('box mean: no 2D context')
  const w = canvas.width
  const h = canvas.height
  const x0 = Math.max(0, Math.min(w - 1, Math.round(box.x0 * w)))
  const x1 = Math.max(x0 + 1, Math.min(w, Math.round(box.x1 * w)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round((1 - box.y1) * h)))
  const y1 = Math.max(y0 + 1, Math.min(h, Math.round((1 - box.y0) * h)))
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n += 1
  }
  const mean = { r: r / n, g: g / n, b: b / n }
  return { ...mean, luma: (mean.r + mean.g + mean.b) / 3 }
}

/** Share of the sheet that carries paint (transparent luma below paper-white). */
function paintedPct(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('painted pct: no 2D context')
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let painted = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    painted += (data[i]! + data[i + 1]! + data[i + 2]!) / 3 < 250 ? 1 : 0
    n += 1
  }
  return Math.round((1000 * painted) / n) / 10
}

// --- one run ----------------------------------------------------------------

const QUERY = new URLSearchParams(location.search)
const CANON_SIZE = Number(QUERY.get('sizeParam') ?? '12')
const BRUSH_ID = QUERY.get('brush') ?? 'round'
// Phase 64 Body (canonical 0..100). The frontier measurement: the bristle
// deposit and the coverage composite both on the stroke, one cost budget.
const BODY = Number(QUERY.get('body') ?? '0')
if (!Number.isFinite(BODY) || BODY < 0 || BODY > 100) throw new Error(`invalid body ${QUERY.get('body')}`)

interface RunResult {
  readonly digests: { paper: string; transparent: string; white: string; pigment: string }
  readonly bakeMs: number
  readonly renderMs: number
  readonly paintedPct: number
  readonly regions: Record<'crossing' | 'redOwn' | 'lightOwn' | 'paper', ReturnType<typeof boxMean>>
  readonly gpuPeakBytes: number
  readonly bristleDigest: string | null
  readonly bristleInfo: unknown
}

function runOnce(
  engineKind: 'baseline' | 'bristle',
  script: readonly Entry[],
  sheet: number,
  touch: boolean,
  salt: number,
  pinnedPaperSeed = true,
): RunResult {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  if (engineKind === 'baseline') baseEngine = null
  else bristleEngine = null
  instrumentGL()
  resetMemory()

  // The engine rolls its paper grain seed from Math.random at construction,
  // and setPaper() never re-seeds it. `pinnedPaperSeed: false` reproduces the
  // app's actual bake path (an unpinned constructor), which is the replay
  // hazard the paperB control gate measures.
  const make = () => {
    if (engineKind === 'baseline') {
      return createBaseAdapter({ width: sheet, height: sheet, paperPreset: COLD, paperStrength: PAPER_STRENGTH })
    }
    return createBristleAdapter({ width: sheet, height: sheet, paperPreset: COLD, paperStrength: PAPER_STRENGTH })
  }
  const adapter = pinnedPaperSeed ? withSeededMathRandom(PAPER_SEED, make) : make()

  try {
    const engine = engineKind === 'baseline' ? baseEngine : bristleEngine
    if (engine === null) throw new Error(`probe never captured the ${engineKind} engine`)
    if (engineKind === 'bristle') {
      const be = engine as BristleEngine
      be.setBristleMode(true, touch)
      be.setBristleSalt(salt)
    }
    const bakeStart = performance.now()
    script.forEach((entry, index) => {
      adapter.applyStroke(makeStroke(entry))
      const settle = entry.settle ?? SETTLE_TICKS
      for (let tick = 0; tick <= settle; tick += 1) adapter.stepTick(tick)
      if (entry.fixAfter !== false) adapter.fix()
      if (entry.fixAfter === false && (index + 1) % 10 === 0) adapter.fix()
    })
    if (script.some((e) => e.fixAfter === false)) adapter.fix()
    const bakeMs = Math.round(performance.now() - bakeStart)

    const renderStart = performance.now()
    const paperCanvas = engine.exportCanvas('paper')
    const transparentCanvas = engine.exportCanvas('transparent')
    const whiteCanvas = engine.exportCanvas('white')
    const pigmentCanvas = engine.exportCanvas('pigment')
    const paper = digestCanvas(paperCanvas)
    const transparent = digestCanvas(transparentCanvas)
    const white = digestCanvas(whiteCanvas)
    const pigment = digestCanvas(pigmentCanvas)
    const renderMs = Math.round(performance.now() - renderStart)
    // Region readings after renderMs so the render cost keeps its meaning.
    const painted = paintedPct(transparentCanvas)
    const regions = {
      crossing: boxMean(pigmentCanvas, CROSS_BOXES.crossing),
      redOwn: boxMean(pigmentCanvas, CROSS_BOXES.redOwn),
      lightOwn: boxMean(pigmentCanvas, CROSS_BOXES.lightOwn),
      paper: boxMean(pigmentCanvas, CROSS_BOXES.paper),
    }

    let bristleDigest: string | null = null
    let info: unknown = null
    if (engineKind === 'bristle') {
      const be = engine as BristleEngine
      bristleDigest = fnvBytes(be.readBristles())
      info = { ...be.bristleInfo, gpuLiveBytes: MEMORY.total }
    }
    return {
      digests: { paper, transparent, white, pigment },
      bakeMs,
      renderMs,
      paintedPct: painted,
      regions,
      gpuPeakBytes: MEMORY.peak,
      bristleDigest,
      bristleInfo: info,
    }
  } finally {
    adapter.dispose()
  }
}

// --- report -----------------------------------------------------------------

function writeResult(report: Record<string, unknown>): void {
  const pre = document.getElementById('result')
  if (!pre) throw new Error('probe page is missing pre#result')
  pre.textContent = JSON.stringify(report, null, 2)
  const status = document.getElementById('status')
  if (status) status.textContent = 'DONE'
  console.log('PROBE_RESULT ' + JSON.stringify(report))
}

function main(): void {
  const params = new URLSearchParams(location.search)
  const gate = params.get('gate') ?? 'bristle-cross'
  const engineKind = (params.get('engine') ?? 'bristle') as 'baseline' | 'bristle'
  const sheet = Number(params.get('size') ?? '256')
  const touch = params.get('touch') === '1'
  const salt = Number(params.get('salt') ?? '0')
  // Determinism gates run two engines in one page and compare; cost gates run
  // ONE (the committed medium-engine methodology), because two live WebGL
  // contexts on SwiftShader at 2K add memory pressure the engine never has.
  const runs = Number(params.get('runs') ?? '2')
  try {
    if (!Number.isInteger(sheet) || sheet < 32 || sheet > 4096) throw new Error(`invalid size ${sheet}`)
    const script = readScenario()
    const renderer = canary()
    const paperB = params.get('paperB') === 'random' ? false : true
    // Two replays for determinism; one for cost (the committed methodology).
    const first = runOnce(engineKind, script, sheet, touch, salt)
    const second = runs >= 2 ? runOnce(engineKind, script, sheet, touch, salt, paperB) : first
    writeResult({
      gate,
      engine: engineKind,
      scenario: params.get('scenario') ?? 'cross',
      brush: BRUSH_ID,
      sizeParam: CANON_SIZE,
      body: BODY,
      sheet,
      touch,
      salt,
      runs,
      paperB: paperB ? 'fixed' : 'random',
      renderer,
      runA: first,
      runB: second,
      identicalImages: runs >= 2 ? JSON.stringify(first.digests) === JSON.stringify(second.digests) : null,
      identicalBristles:
        runs >= 2 && first.bristleDigest !== null ? first.bristleDigest === second.bristleDigest : null,
      verdict: 'SPIKE-002 CAPTURED',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeResult({ gate, engine: engineKind, sheet, touch, salt, verdict: `SPIKE-002 FAIL ${message}`, error: message })
  }
}

main()
