// ============================================================
//  SPIKE 004 — gravity run transport probe.
//
//  SCRATCH HARNESS ONLY. Runs the REAL vendored WebGL2 engine twice:
//    engine=baseline   -> packages/efx-watercolor/src (read-only, HEAD)
//    engine=workbench  -> ../workbench/src (copy patched with a `gravity`
//                         param that sags the wet film down the sheet in
//                         advectWet / advectInk / advectCover)
//
//  Question: given a wet acrylic sheet, when a gravity term drives the fluid
//  transport, does paint LEAVE the stroke and RUN DOWNWARD, with a run length
//  that grows with the parameter — and is gravity 0 byte-identical to HEAD?
//
//  Scene: one acrylic bristle-flat stroke (medium record values, canonical
//  size 60) at y = 0.62, optionally followed by a Water-tool pass over it
//  (the wetness gate: today's acrylic brush carries water 0.05, under the
//  mobility floor). Then N ticks with `gravity` set. No fix during the run.
//
//  Metrics: paint-mask geometry (top / bottom / centroid / extent), the
//  painted share, and the four export digests. The mask comes from the
//  `transparent` export (transmittance over nothing: luma < 250 is paint).
//  The `white` export is saved as a PNG so the run is visible.
//
//  Output: one JSON report in <pre id="result">; run.mjs writes results/.
// ============================================================

import { WatercolorEngine as BaseEngine } from '../../../../packages/efx-watercolor/src/playground/Engine'
import { createAquarelleEngineAdapter as createBaseAdapter } from '../../../../packages/efx-watercolor/src/adapter/engineAdapter'
import { PAPERS, type PaperPreset } from '../../../../packages/efx-watercolor/src/playground/papers'
import { toStudioStroke, type AquarellePoint } from '../../../../packages/efx-watercolor/src/payload/toStudioStroke'
import { WatercolorEngine as GravEngine } from '../workbench/src/playground/Engine'
import { createAquarelleEngineAdapter as createGravAdapter } from '../workbench/src/adapter/engineAdapter'
import { MEDIUMS } from '../workbench/src/playground/mediums'

const PAPER_SEED = 0xc0ffee
const PAPER_STRENGTH = 1
const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

const QUERY = new URLSearchParams(location.search)
const CANON_SIZE = Number(QUERY.get('sizeParam') ?? '60')
// The Water pass's own canonical size: a narrower wet feed is the field
// model's only lever for a THIN tongue (a scalar field translates rigidly).
const WATER_SIZE = Number(QUERY.get('waterSize') ?? String(CANON_SIZE))
const ENGINE_KIND = (QUERY.get('engine') ?? 'workbench') as 'baseline' | 'workbench'
const GRAVITY = Number(QUERY.get('gravity') ?? '0')
const GAIN = Number(QUERY.get('gain') ?? '0.08')
const THRESHOLD = Number(QUERY.get('thr') ?? '0')
const FOCUS = Number(QUERY.get('focus') ?? '0')
const NOISE = Number(QUERY.get('noise') ?? '0')
const NOISE_SCALE = Number(QUERY.get('noiseScale') ?? '8')
const WATER_PASS = QUERY.get('water') === '1'
// Repeat the Water pass: a narrow feed needs more passes to carry the same
// water volume as a wide one (the field model's starve control).
const WATER_PASSES = Number(QUERY.get('waterPasses') ?? '1')
const TICKS = Number(QUERY.get('ticks') ?? '120')
const SHEET = Number(QUERY.get('size') ?? '512')
// 'acrylic' = the acrylic stroke (+ optional water pass); 'water' = a pure
// water stroke, which isolates the wet transport from the pigment.
const SCENE = QUERY.get('scene') ?? 'acrylic'

// The acrylic medium record, verbatim — the shipped configuration this spike
// asks about. A canonical record rides the stroke bag like any studio stroke.
const ACRYLIC = MEDIUMS.find((m) => m.id === 'acrylic')
if (!ACRYLIC) throw new Error('acrylic medium record missing')
const STROKE_PARAMS: Record<string, number> = { ...ACRYLIC.params, size: CANON_SIZE, lift: 22 }

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

// --- engine capture (the adapter owns its instance) -------------------------

let baseEngine: BaseEngine | null = null
let gravEngine: GravEngine | null = null

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
tapEngine(GravEngine, (e) => { gravEngine = e })

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

// --- scene ------------------------------------------------------------------

function line(y: number, pressure = 0.8): AquarellePoint[] {
  // 2026-11-23 (the artist): a LONG horizontal stroke, so the patchy drip has
  // room to show separate runs along it.
  return [
    { x: 0.06, y, p: pressure, tx: 0, ty: 0, tw: 0 },
    { x: 0.5, y: y + 0.001, p: pressure, tx: 0, ty: 0, tw: 0 },
    { x: 0.94, y, p: pressure, tx: 0, ty: 0, tw: 0 },
  ]
}

function vline(x: number, pressure = 0.8): AquarellePoint[] {
  return [
    { x, y: 0.86, p: pressure, tx: 0, ty: 0, tw: 0 },
    { x: x + 0.001, y: 0.6, p: pressure, tx: 0, ty: 0, tw: 0 },
    { x, y: 0.34, p: pressure, tx: 0, ty: 0, tw: 0 },
  ]
}

function stroke(tool: 'brush' | 'water', points: readonly AquarellePoint[], mutationId: number) {
  return toStudioStroke({
    tool,
    color: tool === 'brush' ? '#1d3f8f' : '#000000',
    params: { ...STROKE_PARAMS, size: tool === 'water' ? WATER_SIZE : CANON_SIZE },
    brushId: 'bristle-flat',
    points: [...points],
    mutationId,
    timestamp: 0,
  })
}

// --- paint-mask geometry ------------------------------------------------------
// The transparent export is the sheet's transmittance: paper-white where no
// paint sits, darker where pigment absorbs. Doc uv is y-up; the canvas is
// y-down, so "runs down the sheet" = the mask's bottom edge moves toward
// HIGHER canvas rows (LOWER doc y).

interface MaskGeometry {
  paintedPct: number
  topY: number          // doc uv of the highest painted row
  bottomY: number       // doc uv of the lowest painted row
  centroidY: number     // doc uv mean of the painted texels
  extentY: number       // topY - bottomY
  columnsPainted: number
  /** Longest vertical run of paint in any single column, in px. */
  maxColumnRunPx: number
  /** Painted columns whose bottom edge sits within 8 px of the lowest row. */
  tongueWidthPx: number
  /** Bottom edge of the paint per column, in doc uv (y-up). */
  bottomYs: number[]
}

const PAINT_LUMA = 250

function maskGeometry(canvas: HTMLCanvasElement): MaskGeometry {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('mask: no 2D context')
  const w = canvas.width
  const h = canvas.height
  const data = ctx.getImageData(0, 0, w, h).data
  const colBottom = new Array<number>(w).fill(-1)
  const colTop = new Array<number>(w).fill(-1)
  let n = 0
  let sumY = 0
  let topRow = -1
  let bottomRow = -1
  let columnsPainted = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      const luma = (data[i]! + data[i + 1]! + data[i + 2]!) / 3
      if (luma >= PAINT_LUMA) continue
      n += 1
      sumY += y
      if (topRow < 0) topRow = y
      bottomRow = y
      if (colBottom[x]! < 0) columnsPainted += 1
      if (colTop[x]! < 0) colTop[x] = y
      colBottom[x] = y
    }
  }
  if (n === 0) {
    return {
      paintedPct: 0,
      topY: 0,
      bottomY: 0,
      centroidY: 0,
      extentY: 0,
      columnsPainted: 0,
      maxColumnRunPx: 0,
      tongueWidthPx: 0,
      bottomYs: [],
    }
  }
  const docY = (row: number) => 1 - (row + 0.5) / h
  const bottomYs = colBottom.filter((v) => v >= 0).map(docY)
  let maxColumnRunPx = 0
  let tongueWidthPx = 0
  for (let x = 0; x < w; x += 1) {
    if (colBottom[x]! < 0) continue
    maxColumnRunPx = Math.max(maxColumnRunPx, colBottom[x]! - colTop[x]! + 1)
    if (colBottom[x]! >= bottomRow - 8) tongueWidthPx += 1
  }
  return {
    paintedPct: Math.round((1000 * n) / (w * h)) / 10,
    topY: Math.round(docY(topRow) * 10000) / 10000,
    bottomY: Math.round(docY(bottomRow) * 10000) / 10000,
    centroidY: Math.round(docY(sumY / n) * 10000) / 10000,
    extentY: Math.round((topRow === bottomRow ? 0 : docY(topRow) - docY(bottomRow)) * 10000) / 10000,
    columnsPainted,
    maxColumnRunPx,
    tongueWidthPx,
    bottomYs,
  }
}

/** Median and p90 of the per-column bottom edge (doc uv, y-up). */
function percentiles(values: readonly number[]): { p50: number; p90: number } {
  if (values.length === 0) return { p50: 0, p90: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!
  return { p50: Math.round(at(0.5) * 10000) / 10000, p90: Math.round(at(0.9) * 10000) / 10000 }
}

// --- one run ----------------------------------------------------------------

interface WetProfile {
  peak: number
  mass: number
  centroidY: number
  /** Doc-uv extremes of the texels still above the mobility floor (0.02). */
  mobileBottomY: number
  mobileTopY: number
  /** Share of the sheet's texels above the mobility floor. */
  mobileFrac: number
  /** The engine's simulated rect (texels), if it was awake at the end. */
  activeRect: { x0: number; y0: number; x1: number; y1: number } | null
  /** The engine's own copy of the spike param — proves setParams landed. */
  gravityParam: number | null
}

function wetProfile(field: Float32Array, w: number, h: number): WetProfile {
  let peak = 0
  let mass = 0
  let sumRow = 0
  let mobile = 0
  let bottom = -1
  let top = -1
  for (let r = 0; r < h; r += 1) {
    for (let c = 0; c < w; c += 1) {
      const v = field[r * w + c]!
      if (!(v > 0)) continue
      mass += v
      sumRow += v * r
      if (v > peak) peak = v
      if (v > 0.02) {
        mobile += 1
        if (bottom < 0) bottom = r
        top = r
      }
    }
  }
  const docY = (row: number) => Math.round(((row + 0.5) / h) * 10000) / 10000
  return {
    peak: Math.round(peak * 10000) / 10000,
    mass: Math.round(mass * 10) / 10,
    centroidY: mass > 0 ? docY(sumRow / mass) : 0,
    mobileBottomY: bottom >= 0 ? docY(bottom) : 0,
    mobileTopY: top >= 0 ? docY(top) : 0,
    mobileFrac: Math.round((1000 * mobile) / (w * h)) / 10,
    activeRect: null,
    gravityParam: null,
  }
}

interface RunResult {
  readonly digests: { paper: string; transparent: string; white: string; pigment: string }
  readonly bakeMs: number
  readonly ticksApplied: number
  readonly paintedPct: number
  readonly geometry: Omit<MaskGeometry, 'bottomYs'> & { bottomP50: number; bottomP90: number }
  readonly wet: WetProfile | null
  readonly pngWhite: string
}

function runOnce(): RunResult {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  if (ENGINE_KIND === 'baseline') baseEngine = null
  else gravEngine = null

  const make = () => {
    if (ENGINE_KIND === 'baseline') {
      return createBaseAdapter({ width: SHEET, height: SHEET, paperPreset: COLD, paperStrength: PAPER_STRENGTH })
    }
    return createGravAdapter({ width: SHEET, height: SHEET, paperPreset: COLD, paperStrength: PAPER_STRENGTH })
  }
  const adapter = withSeededMathRandom(PAPER_SEED, make)

  try {
    const engine = ENGINE_KIND === 'baseline' ? baseEngine : gravEngine
    if (engine === null) throw new Error(`probe never captured the ${ENGINE_KIND} engine`)
    const bakeStart = performance.now()
    if (SCENE === 'water') adapter.applyStroke(stroke('water', line(0.62), 0x6a02))
    else if (SCENE === 'cross') {
      // The artist's drip scene: a horizontal and a vertical stroke crossing —
      // two loads of paint at the middle, and a vertical run whose bottom end
      // is free to shed a drop down the empty sheet.
      adapter.applyStroke(stroke('brush', line(0.62), 0x6a01))
      adapter.applyStroke(stroke('brush', vline(0.5), 0x6a03))
      if (WATER_PASS) {
        for (let pass = 0; pass < WATER_PASSES; pass += 1) {
          adapter.applyStroke(stroke('water', line(0.62), 0x6a02 + pass * 0x10))
          adapter.applyStroke(stroke('water', vline(0.5), 0x6a04 + pass * 0x10))
        }
      }
    } else {
      adapter.applyStroke(stroke('brush', line(0.62), 0x6a01))
      if (WATER_PASS) adapter.applyStroke(stroke('water', line(0.62), 0x6a02))
    }
    // Gravity rides a spike-only engine param; baseline has none and keeps 0.
    if (ENGINE_KIND === 'workbench') {
      ;(engine as GravEngine).setParams({
        gravity: GRAVITY,
        gravityGain: GAIN,
        gravityThreshold: THRESHOLD,
        gravityFocus: FOCUS,
        gravityNoise: NOISE,
        gravityNoiseScale: NOISE_SCALE,
      })
    }
    let ticksApplied = 0
    for (let tick = 0; tick <= TICKS; tick += 1) {
      adapter.stepTick(tick)
      ticksApplied += 1
    }
    const bakeMs = Math.round(performance.now() - bakeStart)

    const paperCanvas = engine.exportCanvas('paper')
    const transparentCanvas = engine.exportCanvas('transparent')
    const whiteCanvas = engine.exportCanvas('white')
    const pigmentCanvas = engine.exportCanvas('pigment')
    const geometry = maskGeometry(transparentCanvas)
    const { bottomYs, ...geom } = geometry
    const pct = percentiles(bottomYs)
    const grav = engine as GravEngine
    const wet =
      ENGINE_KIND === 'workbench'
        ? {
            ...wetProfile(grav.readWetField(), SHEET, SHEET),
            activeRect: grav.spikeActiveRect(),
            gravityParam: (grav as unknown as { params?: { gravity?: number } }).params?.gravity ?? null,
          }
        : null
    return {
      digests: {
        paper: digestCanvas(paperCanvas),
        transparent: digestCanvas(transparentCanvas),
        white: digestCanvas(whiteCanvas),
        pigment: digestCanvas(pigmentCanvas),
      },
      bakeMs,
      ticksApplied,
      paintedPct: geometry.paintedPct,
      geometry: { ...geom, bottomP50: pct.p50, bottomP90: pct.p90 },
      wet,
      pngWhite: whiteCanvas.toDataURL('image/png'),
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
  const gate = QUERY.get('gate') ?? 'probe'
  try {
    if (!Number.isInteger(SHEET) || SHEET < 64 || SHEET > 2048) throw new Error(`invalid size ${SHEET}`)
    if (!Number.isFinite(GRAVITY) || GRAVITY < 0 || GRAVITY > 400) throw new Error(`invalid gravity ${GRAVITY}`)
    if (!Number.isFinite(GAIN) || GAIN < 0 || GAIN > 4) throw new Error(`invalid gain ${GAIN}`)
    if (!Number.isFinite(THRESHOLD) || THRESHOLD < 0 || THRESHOLD > 1) throw new Error(`invalid threshold ${THRESHOLD}`)
    if (!Number.isFinite(FOCUS) || FOCUS < 0 || FOCUS > 32) throw new Error(`invalid focus ${FOCUS}`)
    if (!Number.isInteger(WATER_PASSES) || WATER_PASSES < 1 || WATER_PASSES > 4) throw new Error(`invalid waterPasses ${WATER_PASSES}`)
    if (!Number.isFinite(NOISE) || NOISE < 0 || NOISE > 1) throw new Error(`invalid noise ${NOISE}`)
    if (!Number.isFinite(NOISE_SCALE) || NOISE_SCALE < 1 || NOISE_SCALE > 64) throw new Error(`invalid noiseScale ${NOISE_SCALE}`)
    if (!Number.isInteger(TICKS) || TICKS < 0 || TICKS > 1200) throw new Error(`invalid ticks ${TICKS}`)
    const renderer = withSeededMathRandom(PAPER_SEED, () => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const probe = new GravEngine(canvas, null, {}, [64, 64])
      try {
        const gl = (probe as unknown as { gl: WebGL2RenderingContext }).gl
        return gl.getParameter(gl.RENDERER) as string
      } finally {
        probe.destroy()
      }
    })
    const run = runOnce()
    const { pngWhite, ...rest } = run
    writeResult({
      gate,
      engine: ENGINE_KIND,
      gravity: GRAVITY,
      gain: GAIN,
      threshold: THRESHOLD,
      focus: FOCUS,
      noise: NOISE,
      noiseScale: NOISE_SCALE,
      waterSize: WATER_SIZE,
      waterPass: WATER_PASS,
      waterPasses: WATER_PASSES,
      ticks: TICKS,
      sheet: SHEET,
      sizeParam: CANON_SIZE,
      params: STROKE_PARAMS,
      renderer,
      run: rest,
      pngWhite,
      verdict: 'SPIKE-004 CAPTURED',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    writeResult({ gate, engine: ENGINE_KIND, gravity: GRAVITY, sheet: SHEET, verdict: `SPIKE-004 FAIL ${message}`, error: message })
  }
}

main()
