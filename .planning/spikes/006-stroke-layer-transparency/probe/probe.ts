// ============================================================
//  SPIKE 006 — composite-law probe (Q1 only).
//
//  SCRATCH HARNESS ONLY. Runs the REAL WebGL2 engine, unmodified.
//
//  THE QUESTION. Can a per-stroke layer (its own ink, cover and a lateral
//  alpha field) be merged into the sheet ONCE at stroke end — and land back in
//  the sheet's 7 absorbance coefficients + scatter — without the artist seeing
//  a difference, on the Gouache (Kubelka-Munk, Body 100) branch the six
//  rejected laws never addressed?
//
//  WHAT RUNS, on ONE engine (same paper, so every capture shares it):
//    1. paint stroke B alone on a blank sheet      -> S_B   (the layer)
//    2. resetSheet; paint stroke A                 -> S_A   (the base)
//    3. paint stroke B over A, same visit          -> S_AB  (the shipped result)
//    4. a grid of random states, exported through the REAL displayFS and
//       compared to the CPU mirror                 -> the mirror gate
//    5. the law, swept over its own independent variable
//
//  WHY ALPHA IS THE VARIABLE. The composite is `band_out = A·band_L +
//  (1-A)·band_S`, so A alone decides it — the lateral field only chooses A.
//  The probe therefore samples real (layer, base) texel pairs and sweeps
//  A over the stations t = 0, ¼, ½, ¾, 1 with `A = 1 - amount·t^e`, which is
//  exactly "every station of the fade band", for each falloff's own exponent.
//  Geometry is used only to pick the texels (over paper, over the earlier
//  stroke) and is read off the captures, never off the nominal coordinates.
//
//  EVIDENCE SPLIT
//  --------------
//  The 7×16 pinv encoder is O(1) per texel, so its targets are ALSO rendered
//  end-to-end through the real shader on a full composite sheet (one per law
//  and gate) and required to match the mirror. The bounded KM fit is
//  iterative; it is measured on a stratified texel sample through the mirror,
//  which the grid gate has proven equal to the real shader within 1/255.
//
//  Output: one JSON report in <pre id="result">; run.mjs writes results/.
// ============================================================

import { WatercolorEngine } from '../../../../packages/efx-watercolor/src/playground/Engine'
import { createAquarelleEngineAdapter } from '../../../../packages/efx-watercolor/src/adapter/engineAdapter'
import { PAPERS, type PaperPreset } from '../../../../packages/efx-watercolor/src/playground/papers'
import { DEFAULT_CANONICAL_PARAMS } from '../../../../packages/efx-watercolor/src/playground/params'
import { toStudioStroke, type AquarellePoint } from '../../../../packages/efx-watercolor/src/payload/toStudioStroke'
import { fromHalf, toHalf } from '../../../../packages/efx-watercolor/src/playground/half'
import * as law from './law'

const QUERY = new URLSearchParams(location.search)
const SHEET = Number(QUERY.get('size') ?? 540)
const PAPER_SEED = Number(QUERY.get('seed') ?? 0xc0ffee)
const PAPER_STRENGTH = 1
const SETTLE_TICKS = 10

const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

/** The reverted quick's final `BRISTLE_EDGE_START` (v6); the design calls the same knob START. */
const START = Number(QUERY.get('start') ?? 0.30)
const AMOUNT = Number(QUERY.get('amount') ?? 1)
/** Declared BEFORE measuring, as required. */
const THRESHOLD = { channel8: 2, hueDeg: 2, mirror8: 1 }

const A_Y = 0.5
const A_X0 = 0.10, A_X1 = 0.90
const A_SIZE = 170
const B_X = 0.5
const B_Y0 = 0.12, B_Y1 = 0.88
const B_SIZE = 130

// ---------------------------------------------------------------------------

const seededRandom = (seed: number): (() => number) => {
  let state = (seed | 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const withSeededMathRandom = <T,>(seed: number, fn: () => T): T => {
  const original = Math.random
  const rng = seededRandom(seed)
  Math.random = () => rng()
  try { return fn() } finally { Math.random = original }
}

let captured: WatercolorEngine | null = null
function tapEngine(): void {
  const proto = WatercolorEngine.prototype as unknown as { setManual: (v: boolean) => void }
  const original = proto.setManual
  proto.setManual = function patched(this: WatercolorEngine, manual: boolean) {
    if (manual && captured === null) captured = this
    return original.call(this, manual)
  }
}

function canary(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const engine = withSeededMathRandom(PAPER_SEED, () => new WatercolorEngine(canvas, null, {}, [64, 64]))
  try {
    const gl = (engine as unknown as { gl: WebGL2RenderingContext }).gl
    return gl.getParameter(gl.RENDERER) as string
  } finally {
    engine.destroy()
  }
}

// --- strokes ----------------------------------------------------------------

type Entry = { color: string; points: AquarellePoint[]; mutationId: number; size: number }

const strokeA = (): Entry => ({
  color: '#1d3f7a',
  mutationId: 0x5a0001,
  size: A_SIZE,
  points: [
    { x: A_X0, y: A_Y, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: (A_X0 + A_X1) / 2, y: A_Y + 0.001, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: A_X1, y: A_Y, p: 0.85, tx: 0, ty: 0, tw: 0 },
  ],
})

const strokeB = (): Entry => ({
  color: '#c2402a',
  mutationId: 0x5b0001,
  size: B_SIZE,
  points: [
    { x: B_X, y: B_Y0, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: B_X + 0.001, y: (B_Y0 + B_Y1) / 2, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: B_X, y: B_Y1, p: 0.85, tx: 0, ty: 0, tw: 0 },
  ],
})

const makeStroke = (entry: Entry) => toStudioStroke({
  tool: 'brush',
  color: entry.color,
  params: { ...DEFAULT_CANONICAL_PARAMS, size: entry.size, body: 100 },
  brushId: 'bristle-round',
  points: entry.points.map((p) => ({ ...p })),
  mutationId: entry.mutationId,
  timestamp: 0,
})

// --- the sheet state --------------------------------------------------------

interface SheetState {
  w: number
  h: number
  a: Float32Array // 4 coefficients per texel
  b: Float32Array // 3 coefficients per texel
  s: Float32Array // scattering S
  cover: Float32Array
}

const blankSheet = (w: number, h: number): SheetState => ({
  w, h,
  a: new Float32Array(w * h * 4),
  b: new Float32Array(w * h * 3),
  s: new Float32Array(w * h),
  cover: new Float32Array(w * h),
})

/** Decode a captured snapshot into a full-sheet state (unpainted texels stay zero). */
function decodeSheet(snapshot: unknown): SheetState {
  const snap = snapshot as {
    whole: { w: number; h: number; rect: { x0: number; y0: number; x1: number; y1: number } | null; layers: Record<string, Uint16Array> }
  }
  const { w, h, rect, layers } = snap.whole
  const out = blankSheet(w, h)
  if (!rect) return out
  const rw = rect.x1 - rect.x0
  const rh = rect.y1 - rect.y0
  const inkA = layers.inkA!, inkB = layers.inkB!, fixA = layers.fixedA!, fixB = layers.fixedB!, cover = layers.cover!
  for (let ry = 0; ry < rh; ry++) {
    const y = rect.y0 + ry
    for (let rx = 0; rx < rw; rx++) {
      const o = y * w + (rect.x0 + rx)
      const si = (ry * rw + rx) * 4
      for (let c = 0; c < 4; c++) out.a[o * 4 + c] = fromHalf(inkA[si + c]!) + fromHalf(fixA[si + c]!)
      for (let c = 0; c < 3; c++) out.b[o * 3 + c] = fromHalf(inkB[si + c]!) + fromHalf(fixB[si + c]!)
      out.s[o] = fromHalf(inkB[si + 3]!) + fromHalf(fixB[si + 3]!)
      // the cover layer is ONE channel per texel (readHalf's `channels = 1` path)
      out.cover[o] = fromHalf(cover[ry * rw + rx]!)
    }
  }
  return out
}

const scratch = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
function stateInto(out: law.State, sheet: SheetState, x: number, y: number): law.State {
  const o = y * sheet.w + x
  for (let c = 0; c < 4; c++) out.a[c] = sheet.a[o * 4 + c]!
  for (let c = 0; c < 3; c++) out.b[c] = sheet.b[o * 3 + c]!
  out.s = sheet.s[o]!
  return out
}

/** Build a restorable snapshot from a full-sheet state (everything in the mobile pool). */
function encodeSnapshot(sheet: SheetState) {
  const { w, h } = sheet
  const n = w * h
  const inkA = new Uint16Array(n * 4)
  const inkB = new Uint16Array(n * 4)
  const cover = new Uint16Array(n * 4)
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) inkA[i * 4 + c] = toHalf(sheet.a[i * 4 + c]!)
    for (let c = 0; c < 3; c++) inkB[i * 4 + c] = toHalf(sheet.b[i * 3 + c]!)
    inkB[i * 4 + 3] = toHalf(sheet.s[i]!)
    cover[i * 4] = toHalf(Math.min(Math.max(sheet.cover[i]!, 0), 1))
  }
  return {
    whole: {
      w, h,
      rect: { x0: 0, y0: 0, x1: w, y1: h },
      layers: {
        inkA, inkB,
        fixedA: new Uint16Array(n * 4), fixedB: new Uint16Array(n * 4),
        wet: new Uint16Array(n * 4), relief: new Uint16Array(n * 4), cover,
        lastTouch: new Float32Array(n).fill(1e6),
      },
    },
    bristleContent: false,
    wetPeak: 0,
    wetAgo: Infinity,
  }
}

type EnginePriv = {
  readback(flat: boolean, mode?: number, texture?: boolean): Uint8Array
  captureSheet(): unknown
  restoreSheet(s: unknown): boolean
  resetSheet(): void
  setParams(p: Record<string, number>): void
}

function renderState(engine: EnginePriv, sheet: SheetState): Uint8Array {
  if (!engine.restoreSheet(encodeSnapshot(sheet))) throw new Error('restoreSheet refused the encoded snapshot')
  return engine.readback(true, 2) // flat = true, MODE.transparent
}

const pixelOf = (buf: Uint8Array, w: number, x: number, y: number): [number, number, number] => {
  const i = (y * w + x) * 4
  return [buf[i]!, buf[i + 1]!, buf[i + 2]!]
}

// --- the falloff curve ------------------------------------------------------

/** e = 2^(2b - 1): falloff 0 -> 0.5 (broad), 50 -> 1 (linear), 100 -> 2 (rim). */
const exponentOf = (falloff: number) => Math.pow(2, 2 * (falloff / 100) - 1)

/** A = 1 - amount·t^e at station t. */
const alphaAtStation = (t: number, falloff: number) =>
  1 - AMOUNT * Math.pow(Math.min(1, Math.max(0, t)), exponentOf(falloff))

// --- the mirror gate --------------------------------------------------------

function mirrorGate(engine: EnginePriv, w: number, h: number) {
  const sheet = blankSheet(w, h)
  const rng = seededRandom(0x6d1a00)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * w + x
      for (let c = 0; c < 4; c++) sheet.a[o * 4 + c] = rng() * (rng() < 0.25 ? 0.05 : 2.5)
      for (let c = 0; c < 3; c++) sheet.b[o * 3 + c] = rng() * 2.5
      // 45 % legacy, 55 % Kubelka-Munk across the real Body-100 range
      sheet.s[o] = rng() < 0.45 ? 0 : rng() * 0.25
      sheet.cover[o] = 1
    }
  }
  const actual = renderState(engine, sheet)
  const deltas: number[] = []
  let scattered = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      stateInto(scratch, sheet, x, y)
      if (scratch.s > 1e-3) scattered++
      const expected = law.stateRgb8(scratch)
      const got = pixelOf(actual, w, x, y)
      deltas.push(Math.max(Math.abs(got[0] - expected[0]), Math.abs(got[1] - expected[1]), Math.abs(got[2] - expected[2])))
    }
  }
  deltas.sort((p, q) => p - q)
  const maxChannel = deltas[deltas.length - 1] ?? 0
  return {
    n: deltas.length,
    scatteredShare: scattered / (w * h),
    maxChannel,
    p99Channel: deltas[Math.floor(deltas.length * 0.99)] ?? 0,
    pass: maxChannel <= THRESHOLD.mirror8,
  }
}

// --- the measurement --------------------------------------------------------

type Rgb = [number, number, number]
type LawName = 'L-band' | 'L-exp'
type Encoder = 'pinv' | 'fit'
type Gate = 'none' | 'cover' | 'alpha'

interface Cell {
  x: number
  y: number
  layer: law.State
  base: law.State
  cover: number
}

interface CellReport {
  scene: 'overPaper' | 'overStroke'
  law: LawName
  encoder: Encoder
  gate: Gate
  falloff: number
  samples: number
  /** per station: t, the resulting alpha, and the round-trip error in 8-bit steps */
  stations: {
    t: number
    alpha: number
    maxChannel: number
    meanChannel: number
    p95Channel: number
    maxHueDeg: number
    maxHueDegColoured: number
    colouredN: number
    /** encoded bands outside [min(layer, base), max(...)], beyond 1/255 */
    bandOutsideBeyond1: number
    /** the fraction of texels where the layer prints that still print */
    printRetention: number
    /**
     * Where the LAYER holds no visible paint, the composite must leave the
     * base alone. `gapWash` is how far it moved it — the pale-band failure
     * (the under-stroke washed by a film that replaced nothing).
     */
    gapN: number
    gapWashMax: number
    gapWashMean: number
    meanIterations?: number
  }[]
}

function gateFactor(gate: Gate, cell: Cell, layerRgb8: Rgb): number {
  if (gate === 'none') return 1
  // the engine's own base-replacement weight, as DESIGN §3.3's cover_out uses it
  if (gate === 'cover') return cell.cover
  // the display's alpha law: a layer is as opaque as its own darkness
  return 1 - Math.min(...layerRgb8) / 255
}

function measure(
  id: string,
  cells: Cell[],
  falloff: number,
  lawName: LawName,
  encoder: Encoder,
  gate: Gate,
): CellReport {
  const sampleSet = encoder === 'fit' ? thin(cells, 160) : cells
  const stations: CellReport['stations'] = []
  const ts = [0, 0.25, 0.5, 0.75, 1]
  for (const t of ts) {
    const actual: Rgb[] = []
    const expected: Rgb[] = []
    let bandOutside = 0
    let printed = 0
    let printedLayer = 0
    let iterations = 0
    let gapN = 0
    let gapWashMax = 0
    let gapWashSum = 0
    for (const cell of sampleSet) {
      const layerRgb = law.stateRgb8(cell.layer)
      const alpha = Math.min(1, Math.max(0, alphaAtStation(t, falloff) * gateFactor(gate, cell, layerRgb)))
      const target = lawName === 'L-band'
        ? law.targetBand(cell.layer, cell.base, alpha)
        : law.targetExp(cell.layer, cell.base, alpha)
      const scatter = law.mixScatter(cell.layer, cell.base, alpha)
      let encoded: law.State
      if (encoder === 'pinv') {
        encoded = law.encodePinv(target, scatter)
      } else {
        // seed from whichever input dominates at this alpha: at low alpha the
        // answer is the base, and starting from the layer wastes iterations
        const fit = law.encodeFit(target, scatter, alpha >= 0.5 ? cell.layer : cell.base)
        encoded = fit.state
        iterations += fit.iterations
      }
      const rt = law.roundTripF16(encoded)
      const got = law.stateRgb8(rt)
      actual.push(got)
      expected.push(target.rgb8)
      const encBands = law.bandsOf(rt)
      for (let i = 0; i < law.BANDS; i++) {
        const lo = Math.min(law.bandValue(cell.layer, i), law.bandValue(cell.base, i))
        const hi = Math.max(law.bandValue(cell.layer, i), law.bandValue(cell.base, i))
        const v = encBands[i]!
        if (v < lo - 1 / 255 || v > hi + 1 / 255) bandOutside++
      }
      if (layerRgb.some((c) => c < 250)) {
        printedLayer++
        if (got.some((c) => c < 250)) printed++
      } else if (alpha < 1) {
        // the layer reads as bare paper here — the base must survive untouched
        const baseRgb = law.stateRgb8(cell.base)
        const wash = Math.max(...got.map((c, i) => Math.abs(c - baseRgb[i]!)))
        gapN++
        gapWashSum += wash
        gapWashMax = Math.max(gapWashMax, wash)
      }
    }
    const m = law.metrics(actual, expected)
    stations.push({
      t,
      alpha: alphaAtStation(t, falloff),
      maxChannel: m.maxChannel,
      meanChannel: m.meanChannel,
      p95Channel: m.p95Channel,
      maxHueDeg: m.maxHueDeg,
      maxHueDegColoured: m.maxHueDegColoured,
      colouredN: m.colouredN,
      bandOutsideBeyond1: bandOutside,
      printRetention: printedLayer ? printed / printedLayer : 1,
      gapN,
      gapWashMax,
      gapWashMean: gapN ? gapWashSum / gapN : 0,
      meanIterations: encoder === 'fit' && sampleSet.length ? iterations / sampleSet.length : undefined,
    })
  }
  return { scene: id as 'overPaper' | 'overStroke', law: lawName, encoder, gate, falloff, samples: sampleSet.length, stations }
}

function thin<T>(list: T[], n: number): T[] {
  if (list.length <= n || n <= 0) return list
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(list[Math.floor((i * (list.length - 1)) / (n - 1))]!)
  return out
}

// ---------------------------------------------------------------------------

const layerAtGlobal = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)

function main(): unknown {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  const renderer = canary()
  tapEngine()

  const adapter = withSeededMathRandom(PAPER_SEED, () =>
    createAquarelleEngineAdapter({ width: SHEET, height: SHEET, paperPreset: COLD, paperStrength: PAPER_STRENGTH }),
  )
  const engine = captured as unknown as EnginePriv | null
  if (!engine) throw new Error('probe never captured the adapter engine (setManual tap missed)')
  engine.setParams({ granulation: 0 })

  const bakeStart = performance.now()
  const drive = (entry: Entry) => {
    adapter.applyStroke(makeStroke(entry))
    for (let tick = 0; tick <= SETTLE_TICKS; tick++) adapter.stepTick(tick)
    adapter.fix()
  }

  drive(strokeB())
  const S_B = decodeSheet(engine.captureSheet())
  engine.resetSheet()
  drive(strokeA())
  const S_A = decodeSheet(engine.captureSheet())
  drive(strokeB())
  const S_AB = decodeSheet(engine.captureSheet())
  const bakeMs = Math.round(performance.now() - bakeStart)

  const w = S_B.w
  const h = S_B.h

  // --- geometry, read off the captures ------------------------------------
  const ink = (s: SheetState, x: number, y: number) => Math.abs(s.a[(y * w + x) * 4]!)
  const bboxOf = (s: SheetState, min: number) => {
    let x0 = w, x1 = -1, y0 = h, y1 = -1
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (ink(s, x, y) > min) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    }
    return { x0, x1, y0, y1 }
  }
  const bboxB = bboxOf(S_B, 0.01)
  const bboxA = bboxOf(S_A, 0.01)
  const colInk = new Float64Array(w)
  for (let x = bboxB.x0; x <= bboxB.x1; x++) {
    let sum = 0
    for (let y = bboxB.y0; y <= bboxB.y1; y++) sum += ink(S_B, x, y)
    colInk[x] = sum / Math.max(1, bboxB.y1 - bboxB.y0 + 1)
  }
  let centreX = bboxB.x0
  let peak = -1
  for (let x = bboxB.x0; x <= bboxB.x1; x++) if (colInk[x]! > peak) { peak = colInk[x]!; centreX = x }
  const edge = peak * 0.03
  let left = centreX, right = centreX
  while (left > bboxB.x0 && colInk[left - 1]! > edge) left--
  while (right < bboxB.x1 && colInk[right + 1]! > edge) right++
  const halfWidth = Math.max(1, ((centreX - left) + (right - centreX)) / 2)

  // rows where stroke A sits under stroke B's band
  const aRows = new Set<number>()
  let aRowSum = 0
  for (let y = bboxB.y0; y <= bboxB.y1; y++) {
    if (y < bboxA.y0 || y > bboxA.y1) continue
    let sum = 0
    for (let x = centreX - Math.floor(halfWidth); x <= centreX + Math.floor(halfWidth); x++) sum += ink(S_A, x, y)
    if (sum / (2 * halfWidth) > peak * 0.15) { aRows.add(y); aRowSum += y }
  }
  const aRowMid = aRows.size ? aRowSum / aRows.size : Math.round(h * 0.5)

  // the cover channel's lateral profile at a mid row — evidence in its own right
  const probeRow = Math.round(bboxB.y0 + (bboxB.y1 - bboxB.y0) * 0.5)
  const coverLateral: { x: number; cover: number; ink: number }[] = []
  for (let x = bboxB.x0; x <= bboxB.x1; x += Math.max(1, Math.round((bboxB.x1 - bboxB.x0) / 20))) {
    coverLateral.push({ x, cover: Number(S_B.cover[probeRow * w + x]!.toFixed(3)), ink: Number(ink(S_B, x, probeRow).toFixed(3)) })
  }

  // --- the mirror gate ------------------------------------------------------
  const mirror = mirrorGate(engine, w, h)

  // --- cells: real (layer, base) texel pairs -------------------------------
  const stride = Number(QUERY.get('stride') ?? 2)
  const paperBase = blankSheet(w, h)
  const overPaper: Cell[] = []
  const overStroke: Cell[] = []
  for (let y = bboxB.y0; y <= bboxB.y1; y++) {
    for (let x = bboxB.x0; x <= bboxB.x1; x += stride) {
      if (ink(S_B, x, y) <= 0.01) continue
      if (y % stride !== 0) continue
      const layer = law.makeState([0, 1, 2, 3].map((c) => S_B.a[(y * w + x) * 4 + c]!), [0, 1, 2].map((c) => S_B.b[(y * w + x) * 3 + c]!), S_B.s[y * w + x]!)
      const cover = S_B.cover[y * w + x]!
      if (!aRows.has(y)) {
        overPaper.push({ x, y, layer, base: law.zeroState(), cover })
      } else if (ink(S_A, x, y) > 0.01) {
        const base = law.makeState([0, 1, 2, 3].map((c) => S_A.a[(y * w + x) * 4 + c]!), [0, 1, 2].map((c) => S_A.b[(y * w + x) * 3 + c]!), S_A.s[y * w + x]!)
        overStroke.push({ x, y, layer, base, cover })
      }
    }
  }

  // --- the law sweep -------------------------------------------------------
  const reports: CellReport[] = []
  for (const falloff of [0, 50, 100]) {
    for (const lawName of ['L-band', 'L-exp'] as const) {
      for (const encoder of lawName === 'L-band' ? (['pinv', 'fit'] as const) : (['pinv'] as const)) {
        for (const gate of ['none', 'cover', 'alpha'] as const) {
          reports.push(measure('overPaper', overPaper, falloff, lawName, encoder, gate))
          reports.push(measure('overStroke', overStroke, falloff, lawName, encoder, gate))
        }
      }
    }
  }

  // --- end-to-end: the real shader agrees with the mirror on a composite ----
  // One full-sheet composite at the band midpoint, rendered through displayFS.
  let endToEnd: { maxChannel: number; samples: number } | null = null
  {
    const cells = overPaper
    const t = 0.5
    const sheet = blankSheet(w, h)
    const expected = new Map<number, Rgb>()
    for (const cell of cells) {
      const alpha = alphaAtStation(t, 0)
      const target = law.targetBand(cell.layer, cell.base, alpha)
      const encoded = law.roundTripF16(law.encodePinv(target, law.mixScatter(cell.layer, cell.base, alpha)))
      const o = cell.y * w + cell.x
      for (let c = 0; c < 4; c++) sheet.a[o * 4 + c] = encoded.a[c]!
      for (let c = 0; c < 3; c++) sheet.b[o * 3 + c] = encoded.b[c]!
      sheet.s[o] = encoded.s
      sheet.cover[o] = 1
      expected.set(o, target.rgb8)
    }
    const rendered = renderState(engine, sheet)
    let maxChannel = 0
    let n = 0
    for (const cell of cells) {
      const o = cell.y * w + cell.x
      const got = pixelOf(rendered, w, cell.x, cell.y)
      const want = expected.get(o)!
      maxChannel = Math.max(maxChannel, ...got.map((c, i) => Math.abs(c - want[i]!)))
      n++
    }
    endToEnd = { maxChannel, samples: n }
  }

  // --- the 50 % layer over white -------------------------------------------
  // Checked in LINEAR light, where alpha compositing lives: the display's
  // `rgb` is linear, and the sRGB "darkness" metric is a companded value that
  // a linear 50 % mix does NOT halve (see the findings).
  const coreCells = overPaper.filter((c) => Math.abs(c.x - centreX) <= 1)
  const coreCell = coreCells[Math.floor(coreCells.length / 2)] ?? overPaper[0]!
  const white = law.zeroState()
  const whiteHalf: Record<string, unknown> = {}
  for (const lawName of ['L-band', 'L-exp'] as const) {
    const layer = coreCell.layer
    const t = lawName === 'L-band' ? law.targetBand(layer, white, 0.5) : law.targetExp(layer, white, 0.5)
    const layerLin = law.bandRgbLinear(law.bandsOf(layer))
    const targetLin = law.bandRgbLinear(t.bands)
    const linErr = Math.max(...targetLin.map((c, i) => Math.abs(c - (0.5 * layerLin[i]! + 0.5)) * 255))
    const scatter = law.mixScatter(layer, white, 0.5)
    const pinvOut = law.stateRgb8(law.roundTripF16(law.encodePinv(t, scatter)))
    const fit = law.encodeFit(t, scatter, layer)
    const fitOut = law.stateRgb8(law.roundTripF16(fit.state))
    whiteHalf[lawName] = {
      layerRgb8: law.stateRgb8(layer),
      layerScatter: Number(layer.s.toExponential(2)),
      layerLinear: layerLin.map((v) => Number(v.toFixed(4))),
      targetLinear: targetLin.map((v) => Number(v.toFixed(4))),
      /** the law's own linear-light check: target must be 0.5·layer + 0.5 per channel */
      linearMixError8: linErr,
      targetRgb8: t.rgb8,
      pinv: { rgb8: pinvOut, delta8: Math.max(...pinvOut.map((c, i) => Math.abs(c - t.rgb8[i]!))) },
      fit: { rgb8: fitOut, delta8: Math.max(...fitOut.map((c, i) => Math.abs(c - t.rgb8[i]!))), iterations: fit.iterations, residual8: fit.residual8 },
    }
  }

  // --- what B's environment changed at its own core -------------------------
  const coreY = aRows.size ? Math.round(aRowMid) : Math.round((bboxB.y0 + bboxB.y1) / 2)
  stateInto(layerAtGlobal, S_B, centreX, coreY)
  const coreB = law.stateRgb8(layerAtGlobal)
  stateInto(layerAtGlobal, S_AB, centreX, coreY)
  const coreAB = law.stateRgb8(layerAtGlobal)

  return {
    spike: '006',
    scenario: 'composite-law',
    query: { sheet: SHEET, paperSeed: PAPER_SEED, start: START, amount: AMOUNT },
    threshold: THRESHOLD,
    renderer,
    bakeMs,
    paper: { id: COLD.id },
    geometry: {
      centreX, halfWidth, bandPx: 2 * halfWidth, left, right,
      bboxB, bboxA, aRows: aRows.size, aRowMid: Math.round(aRowMid), probeRow, coverLateral,
    },
    cells: { overPaper: overPaper.length, overStroke: overStroke.length },
    mirror,
    endToEnd,
    whiteHalf,
    environment: { coreBAlone: coreB, coreBOverA: coreAB, envDeltaAtCore: Math.max(...coreAB.map((c, i) => Math.abs(c - coreB[i]!))), at: { centreX, coreY } },
    reports,
    engineParams: { granulation: 0, body: 100, brush: 'bristle-round', feather: 0 },
  }
}

const status = document.getElementById('status')
const result = document.getElementById('result')
try {
  const report = main()
  if (status) status.textContent = 'DONE'
  if (result) result.textContent = JSON.stringify(report)
} catch (error) {
  if (status) status.textContent = 'FAILED'
  if (result) result.textContent = JSON.stringify({ error: String((error as Error)?.stack ?? error) })
}
