// ============================================================
//  SPIKE 006 — Q4: parity, the final question.
//
//  Q3c's 8-band + seed-mix encoder is the FROZEN design; the artist accepted
//  its ~21 ms first-dab cost on 2026-11-25. What is still open is whether the
//  composite the artist SEES while the stroke is live survives being baked
//  into the sheet's 7 coefficients, captured, restored and replayed.
//
//  BARS — declared before measuring (2026-11-25, before the first Q4 run):
//    1. live vs merged: the display-time band mix vs the same composite after
//       the fit — amount 100, falloff 0/50/100, over paper AND over a
//       same-visit stroke. The merged state is RE-RENDERED THROUGH ALL 16
//       BANDS over every texel: max <= 2/255, p95 <= 1/255, zero over 2/255.
//    2. amount 0 bypasses the layer path: the shipped path must be byte-
//       identical to d509a886d. The engine sources are unchanged since that
//       commit (measured: `git diff d509a886d HEAD -- packages/efx-watercolor/src
//       app/src` is empty), so this reduces to run-to-run byte identity plus a
//       reference digest the implementation quick compares against.
//    3. capture round trip: captureSheet of a merged sheet -> wipe ->
//       restoreSheet -> re-render is byte-identical to the pre-capture display.
//    4. determinism: the same script twice paints the same bytes, and the
//       merge is a pure function of its inputs (draw twice, identical bytes).
//    5. bake replay: the workbench proves the merge replays from the captured
//       inputs; the engine lifecycle (stroke-end for POINTER and SCRIPTED
//       strokes) is the implementation quick's explicit gate, not a gap.
//
//  THE FROZEN ENCODER (accepted 2026-11-25):
//    bands       8 compiled bands [1,3,5,7,9,10,11,13] (D-optimal over the 16)
//    Jacobian    rank-one (exact for bandOf's A-dependence)
//    iterations  4 LM steps (hard cap; the 2-iteration form misses max 13)
//    seed        mix(base, layer, aEff) in coefficient space
//    write-back  in place: ink = fit − fixed, display = ink + fixed = fit
// ============================================================

import { createAquarelleEngineAdapter } from '../../../../packages/efx-watercolor/src/adapter/engineAdapter'
import { PAPERS, type PaperPreset } from '../../../../packages/efx-watercolor/src/playground/papers'
import { DEFAULT_CANONICAL_PARAMS } from '../../../../packages/efx-watercolor/src/playground/params'
import { toStudioStroke, type AquarellePoint } from '../../../../packages/efx-watercolor/src/payload/toStudioStroke'
import type { GL } from '../../../../packages/efx-watercolor/src/playground/gl'
import { fromHalf } from '../../../../packages/efx-watercolor/src/playground/half'
import * as law from './law'
import { dOptimal } from './bands'
import { MergePass, halfA, halfB, halfR } from './merge'
import {
  canary, capturedEngine, copySheet, decodeSheet, encodeSnapshot, renderState, stateInto,
  tapEngine, withSeededMathRandom,
  type EnginePriv, type SheetState,
} from './sheet'

const QUERY = new URLSearchParams(location.search)
const REQUESTED = Number(QUERY.get('size') ?? 2048)
const PAPER_SEED = Number(QUERY.get('seed') ?? 0xc0ffee)
const PAPER_STRENGTH = 1
const SETTLE_TICKS = 10
const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

const START = Number(QUERY.get('start') ?? 0.30)
const AMOUNT = 1
const FALLOFFS = [0, 0.5, 1] as const
/** The merged-sheet bars run at the default falloff. */
const NOMINAL_FALLOFF = 0.5

/** The frozen encoder — the exact constants the implementation quick must use. */
const FROZEN_BANDS = [1, 3, 5, 7, 9, 10, 11, 13] as const
const FROZEN = {
  iterations: 4,
  coreSkip: false,
  seeded: false,
  rankOneJ: true,
  seedMix: true,
  bandList: FROZEN_BANDS as readonly number[],
}

/**
 * DECLARED BEFORE MEASURING (2026-11-25, before the first Q4 run).
 *  - live vs merged, at every scene × falloff: max <= 2/255, p95 <= 1/255,
 *    zero texels over 2/255, re-rendered through all 16 bands
 *  - amount 0: the shipped path is byte-identical across runs (and the engine
 *    sources are unchanged since d509a886d, so it is the same code)
 *  - capture round trip of a merged sheet: zero differing display bytes
 *  - the same script twice, and the merge twice: zero differing bytes
 */
const THRESHOLD = {
  maxChannel: 2,
  p95Channel: 1,
  overTexels: 0,
}

type Rect = { x0: number; y0: number; x1: number; y1: number }

// --- scene (identical to Q3/Q3b/Q3c, so the numbers stay comparable) --------

type Entry = { color: string; points: AquarellePoint[]; mutationId: number; size: number }

const strokeA = (size: number): Entry => ({
  color: '#1d3f7a',
  mutationId: 0x5a0001,
  size,
  points: [
    { x: 0.10, y: 0.5, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.50, y: 0.501, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.90, y: 0.5, p: 0.85, tx: 0, ty: 0, tw: 0 },
  ],
})

const strokeB = (size: number): Entry => ({
  color: '#c2402a',
  mutationId: 0x5b0001,
  size,
  points: [
    { x: 0.5, y: 0.12, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.501, y: 0.5, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.5, y: 0.88, p: 0.85, tx: 0, ty: 0, tw: 0 },
  ],
})

const makeStroke = (entry: Entry, pickup = DEFAULT_CANONICAL_PARAMS.pickup) => toStudioStroke({
  tool: 'brush',
  color: entry.color,
  params: { ...DEFAULT_CANONICAL_PARAMS, size: entry.size, body: 100, pickup },
  brushId: 'bristle-round',
  points: entry.points.map((p) => ({ ...p })),
  mutationId: entry.mutationId,
  timestamp: 0,
})

// --- geometry from the captures (never from the authored points) ------------

function geometryOf(sheet: SheetState, min = 0.01) {
  const { w, h } = sheet
  const ink = (x: number, y: number) => Math.abs(sheet.a[(y * w + x) * 4]!)
  let x0 = w, x1 = -1, y0 = h, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (ink(x, y) > min) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  }
  if (x1 < 0) return { x0: 0, x1: w - 1, y0: 0, y1: h - 1, centreX: Math.round(w / 2), halfWidth: Math.round(w * 0.1) }
  const colInk = new Float64Array(w)
  for (let x = x0; x <= x1; x++) {
    let sum = 0
    for (let y = y0; y <= y1; y++) sum += ink(x, y)
    colInk[x] = sum / Math.max(1, y1 - y0 + 1)
  }
  let centreX = x0, peak = -1
  for (let x = x0; x <= x1; x++) if (colInk[x]! > peak) { peak = colInk[x]!; centreX = x }
  const edge = peak * 0.03
  let left = centreX, right = centreX
  while (left > x0 && colInk[left - 1]! > edge) left--
  while (right < x1 && colInk[right + 1]! > edge) right++
  return { x0, x1, y0, y1, centreX, halfWidth: Math.max(1, ((centreX - left) + (right - centreX)) / 2) }
}

// --- capture hashing: FULL bytes, not a stride sample -----------------------

type CaptureLayer = Uint16Array | Float32Array
type Snap = { whole: { w: number; h: number; rect: Rect | null; layers: Record<string, CaptureLayer> } }

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

const fnv = (seed: number, view: ArrayBufferView): number => {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  let h = seed >>> 0
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i]!, FNV_PRIME) >>> 0
  return h
}

const fnvString = (seed: number, text: string): number => {
  let h = seed >>> 0
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), FNV_PRIME) >>> 0
  return h
}

/** Every byte of every captured layer, in a fixed order. */
function digestCapture(snap: Snap): string {
  const { w, h, rect, layers } = snap.whole
  let hash = fnv(FNV_OFFSET, new Float64Array([
    w, h, rect ? rect.x0 : -1, rect ? rect.y0 : -1, rect ? rect.x1 : -1, rect ? rect.y1 : -1,
  ]))
  for (const key of Object.keys(layers).sort()) {
    hash = fnvString(hash, key)
    hash = fnv(hash, layers[key]!)
  }
  return hash.toString(16)
}

type LayerCompare = { layer: string; differingValues: number; comparedTexels: number; maxAbsDelta?: number }
type CaptureCompare = {
  rectA: Rect | null
  rectB: Rect | null
  union: Rect | null
  rectEqual: boolean
  layers: LayerCompare[]
  differingValues: number
  differingLayers: string[]
  /** Every value equal over the union AND the crop identical. */
  identical: boolean
  /** Every PAINT layer equal over the union (see PAINT_LAYERS). */
  paintIdentical: boolean
}

/**
 * The layers the composite writes and the display reads. `lastTouch` is
 * excluded on purpose: it is wetness bookkeeping whose one-week sentinel is
 * stamped on the clock in force when `engine.resetSheet()` runs, so an
 * in-process replay stores a sentinel offset by the clock value at reset.
 * Both read as "ancient" to the wetness law; neither is paint.
 */
const PAINT_LAYERS = ['cover', 'fixedA', 'fixedB', 'inkA', 'inkB', 'relief', 'wet']

const layerChannels = (name: string): number =>
  name === 'wet' || name === 'relief' || name === 'cover' || name === 'lastTouch' ? 1 : 4

const sameRect = (a: Rect | null, b: Rect | null): boolean =>
  (!a && !b) || (!!a && !!b && a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1)

const rectUnion = (a: Rect | null, b: Rect | null): Rect | null =>
  !a ? b : !b ? a : {
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
  }

/**
 * Compare two captures over the UNION of their crops, treating a texel outside
 * a crop as zero — which is what the crop means (the engine only reads the
 * `everPainted` bbox, and nothing exists outside it). Values are compared as
 * their raw storage bits (half-float patterns, f32 patterns).
 */
function compareCaptures(a: Snap, b: Snap): CaptureCompare {
  const rectA = a.whole.rect
  const rectB = b.whole.rect
  const union = rectUnion(rectA, rectB)
  const keys = [...new Set([...Object.keys(a.whole.layers), ...Object.keys(b.whole.layers)])].sort()
  const bitsOf = (view: CaptureLayer): Uint16Array | Uint32Array =>
    view instanceof Float32Array
      ? new Uint32Array(view.buffer, view.byteOffset, view.byteLength / 4)
      : view
  const layers: LayerCompare[] = keys.map((layer) => {
    const x = a.whole.layers[layer]
    const y = b.whole.layers[layer]
    if (!x || !y || !union) return { layer, differingValues: x && y ? 0 : -1, comparedTexels: 0 }
    const channels = layerChannels(layer)
    const xa = bitsOf(x), xb = bitsOf(y)
    const wA = rectA ? (rectA.x1 - rectA.x0) * channels : 0
    const wB = rectB ? (rectB.x1 - rectB.x0) * channels : 0
    let differing = 0
    let maxAbs = 0
    const fa = x instanceof Float32Array ? x : null
    const fb = y instanceof Float32Array ? y : null
    for (let yy = union.y0; yy < union.y1; yy++) {
      const inAy = !!rectA && yy >= rectA.y0 && yy < rectA.y1
      const inBy = !!rectB && yy >= rectB.y0 && yy < rectB.y1
      for (let xx = union.x0; xx < union.x1; xx++) {
        const inA = inAy && xx >= rectA!.x0 && xx < rectA!.x1
        const inB = inBy && xx >= rectB!.x0 && xx < rectB!.x1
        if (!inA && !inB) continue
        const oA = inA ? (yy - rectA!.y0) * wA + (xx - rectA!.x0) * channels : -1
        const oB = inB ? (yy - rectB!.y0) * wB + (xx - rectB!.x0) * channels : -1
        for (let c = 0; c < channels; c++) {
          const va = oA >= 0 ? xa[oA + c]! : 0
          const vb = oB >= 0 ? xb[oB + c]! : 0
          if (va !== vb) differing++
          if (fa && fb) {
            const d = Math.abs((oA >= 0 ? fa[oA + c]! : 0) - (oB >= 0 ? fb[oB + c]! : 0))
            if (d > maxAbs) maxAbs = d
          }
        }
      }
    }
    return {
      layer, differingValues: differing,
      comparedTexels: (union.x1 - union.x0) * (union.y1 - union.y0),
      ...(fa ? { maxAbsDelta: maxAbs } : {}),
    }
  })
  const differingValues = layers.reduce((n, l) => n + Math.max(0, l.differingValues), 0)
  const differingLayers = layers.filter((l) => l.differingValues !== 0).map((l) => l.layer)
  const rectEqual = sameRect(rectA, rectB)
  const paintIdentical = layers.every((l) => !PAINT_LAYERS.includes(l.layer) || l.differingValues === 0)
  return {
    rectA, rectB, union, rectEqual, layers, differingValues, differingLayers,
    paintIdentical,
    identical: rectEqual && differingValues === 0 && differingLayers.length === 0,
  }
}

const compareBytes = (a: ArrayBufferView, b: ArrayBufferView) => {
  const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
  const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
  if (x.length !== y.length) return { differingBytes: -1, maxChannel: -1, lengthA: x.length, lengthB: y.length }
  let differing = 0, maxC = 0
  for (let i = 0; i < x.length; i++) {
    const d = Math.abs(x[i]! - y[i]!)
    if (d > 0) differing++
    if (d > maxC) maxC = d
  }
  return { differingBytes: differing, maxChannel: maxC }
}

// ---------------------------------------------------------------------------

type Eng = EnginePriv & { g: GL }

const r2 = (v: number) => Number(v.toFixed(2))

function main(): unknown {
  if (!COLD) throw new Error("paper preset 'cold' is not in PAPERS")
  const renderer = canary(PAPER_SEED)
  tapEngine()

  const adapter = withSeededMathRandom(PAPER_SEED, () =>
    createAquarelleEngineAdapter({ width: REQUESTED, height: REQUESTED, paperPreset: COLD, paperStrength: PAPER_STRENGTH }),
  )
  const engine = capturedEngine() as unknown as Eng | null
  if (!engine) throw new Error('probe never captured the adapter engine')
  engine.setParams({ granulation: 0 })

  /**
   * The engine carries the previous stroke's final direction and tip angle into
   * the next stroke's FIRST dab: scriptBegin seeds the stroke from
   * lastDir/lastAngle (Engine.ts:1494) and the stroke end writes lastDir
   * (Engine.ts:2791), while resetSheet clears neither. It is deterministic, but
   * it means "the same script twice" is only comparable from the same starting
   * carry — so every drive logs what it started from.
   */
  const carryOf = (): Record<string, unknown> => {
    const e = engine as unknown as { lastDir: [number, number]; lastAngle: number }
    return {
      lastDir: [Number(e.lastDir[0].toFixed(6)), Number(e.lastDir[1].toFixed(6))],
      lastAngle: Number(e.lastAngle.toFixed(6)),
    }
  }
  const carryLog: Record<string, unknown>[] = []
  /** The constructor's carry — the starting state of a fresh engine's first stroke. */
  const pinCarry = (): void => {
    const e = engine as unknown as { lastDir: [number, number]; lastAngle: number }
    e.lastDir = [1, 0]
    e.lastAngle = 0
  }
  const drive = (entry: Entry, label: string, pin = false) => {
    if (pin) pinCarry()
    const before = carryOf()
    adapter.applyStroke(makeStroke(entry))
    for (let tick = 0; tick <= SETTLE_TICKS; tick++) adapter.stepTick(tick)
    adapter.fix()
    carryLog.push({ label, pinned: pin, before, after: carryOf() })
  }
  // The ADAPTER's reset, not the engine's: it rewinds the virtual clock and
  // re-seeds the RNG stream, which is what makes a from-scratch replay start
  // on the same naked paper (the engine's resetSheet leaves both alone).
  const fresh = () => adapter.resetSheet()

  const bakeStart = performance.now()
  const brushSize = Math.max(24, Math.round(REQUESTED * 0.12))
  drive(strokeA(brushSize), 'firstA')
  const snapA = engine.captureSheet() as Snap
  const S_A = decodeSheet(snapA)
  fresh()
  drive(strokeB(brushSize), 'firstB')
  const snapB = engine.captureSheet() as Snap
  const S_B = decodeSheet(snapB)
  fresh()
  // The reference visit starts from the constructor carry, so a fresh engine's
  // first stroke IS this state — the same starting state the replay pins.
  drive(strokeA(brushSize), 'firstVisitA', true)
  drive(strokeB(brushSize), 'firstVisitB')
  const snapAB = engine.captureSheet() as Snap
  const S_AB = decodeSheet(snapAB)
  const bakeMs = Math.round(performance.now() - bakeStart)

  const w = S_B.w
  const h = S_B.h
  const geomB = geometryOf(S_B)
  const strokeRect: Rect = {
    x0: Math.max(0, geomB.x0 - 4),
    y0: Math.max(0, geomB.y0 - 4),
    x1: Math.min(w, geomB.x1 + 5),
    y1: Math.min(h, geomB.y1 + 5),
  }
  const rw = strokeRect.x1 - strokeRect.x0
  const rh = strokeRect.y1 - strokeRect.y0

  const lateral = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    lateral[y * w + x] = Math.min(1, Math.abs(x - geomB.centreX) / geomB.halfWidth)
  }

  const gl = engine.g
  const raw = gl.gl
  const RGBA16F = { internal: 0x881a, format: 0x1908, type: 0x140b }
  const R16F = { internal: 0x822d, format: 0x1903, type: 0x140b }
  const rgbaTex = (data: Uint16Array) => gl.texture(w, h, RGBA16F, data, raw.NEAREST)
  const r16Tex = (data: Uint16Array) => gl.texture(w, h, R16F, data, raw.NEAREST)

  const layerTex = {
    layerA: rgbaTex(halfA(S_B.a)),
    layerB: rgbaTex(halfB(S_B.b, S_B.s)),
    cover: r16Tex(halfR(S_B.cover)),
    lateral: r16Tex(halfR(lateral)),
  }
  const zeroA = new Float32Array(w * h * 4)
  const zeroB = new Float32Array(w * h * 3)
  const zeroS = new Float32Array(w * h)
  const bases = {
    paper: { baseA: rgbaTex(halfA(zeroA)), baseB: rgbaTex(halfB(zeroB, zeroS)) },
    stroke: { baseA: rgbaTex(halfA(S_A.a)), baseB: rgbaTex(halfB(S_A.b, S_A.s)) },
  }

  const pass = new MergePass(gl, w, h, { ...FROZEN })
  const configure = (scene: 'paper' | 'stroke', falloff: number, amount = AMOUNT) => {
    pass.adoptInputs({ ...layerTex, ...bases[scene] })
    pass.amount = amount
    pass.start = START
    pass.falloff = falloff
    pass.iterations = FROZEN.iterations
    pass.bindUniforms()
  }

  // --- the band tables: the layer's and the base's display bands, once ------
  // The target's bands are a convex mix of these two; only the weight depends
  // on the falloff, so sweeping the three falloffs costs three mixes, not
  // three band evaluations per texel.
  const nRect = rw * rh
  const layerBands = new Float32Array(nRect * 16)
  const strokeBands = new Float32Array(nRect * 16)
  {
    const st = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    for (let ry = 0; ry < rh; ry++) {
      const y = strokeRect.y0 + ry
      for (let rx = 0; rx < rw; rx++) {
        const x = strokeRect.x0 + rx
        const b0 = (ry * rw + rx) * 16
        stateInto(st, S_B, x, y)
        for (let i = 0; i < 16; i++) layerBands[b0 + i] = law.bandValue(st, i)
        stateInto(st, S_A, x, y)
        for (let i = 0; i < 16; i++) strokeBands[b0 + i] = law.bandValue(st, i)
      }
    }
  }
  // A blank sheet has zero absorbance in every band: bandValue = exp(-0) = 1.
  const paperBandsConstant = law.bandValue(law.makeState([0, 0, 0, 0], [0, 0, 0], 0), 0)
  if (paperBandsConstant !== 1) throw new Error(`blank-sheet band value is ${paperBandsConstant}, not 1`)

  const alphaOf = (x: number, y: number, falloff: number): number => {
    const u = Math.min(1, Math.abs(x - geomB.centreX) / geomB.halfWidth)
    const t = Math.min(1, Math.max(0, (u - START) / (1 - START)))
    const e = Math.pow(2, 2 * falloff - 1)
    const cov = Math.min(1, S_B.cover[y * w + x]!)
    return Math.min(1, Math.max(0, (1 - AMOUNT * Math.pow(t, e)) * cov))
  }

  /**
   * Bar 1's residual: the merged state RE-RENDERED THROUGH ALL 16 BANDS
   * (`law.stateRgb8` never consults the fit's band list) against the
   * display-time band mix, over every texel of the stroke rect.
   */
  const residualFor = (scene: 'paper' | 'stroke', falloff: number) => {
    const a = pass.readA(strokeRect)
    const b = pass.readB(strokeRect)
    const e = Math.pow(2, 2 * falloff - 1)
    const bands = new Float64Array(16)
    const buf = new Float64Array(16)
    const sampleL = new Float64Array(16)
    const sampleS = new Float64Array(16)
    const hist = new Uint32Array(256)
    const bins = [
      [0, 0.01], [0.01, 0.1], [0.1, 0.25], [0.25, 0.5],
      [0.5, 0.75], [0.75, 0.9], [0.9, 0.99], [0.99, 0.9999], [0.9999, 1.0001],
    ].map(([lo, hi]) => ({ lo: lo!, hi: hi!, n: 0, max: 0, sum: 0, over: 0 }))
    const st = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    let maxC = 0, sumC = 0, n = 0, over = 0, betweenOut = 0, betweenN = 0
    let worst: Record<string, unknown> = {}
    for (let ry = 0; ry < rh; ry++) {
      const y = strokeRect.y0 + ry
      for (let rx = 0; rx < rw; rx++) {
        const x = strokeRect.x0 + rx
        const p = ry * rw + rx
        const b0 = p * 16
        const u = Math.min(1, Math.abs(x - geomB.centreX) / geomB.halfWidth)
        const t = Math.min(1, Math.max(0, (u - START) / (1 - START)))
        const cov = Math.min(1, S_B.cover[y * w + x]!)
        const aEff = Math.min(1, Math.max(0, (1 - AMOUNT * Math.pow(t, e)) * cov))

        for (let i = 0; i < 16; i++) {
          const baseBand = scene === 'paper' ? 1 : strokeBands[b0 + i]!
          bands[i] = aEff * layerBands[b0 + i]! + (1 - aEff) * baseBand
        }
        const want = law.bandRgb8(bands)

        for (let c = 0; c < 4; c++) st.a[c] = fromHalf(a[p * 4 + c]!)
        for (let c = 0; c < 3; c++) st.b[c] = fromHalf(b[p * 4 + c]!)
        st.s = fromHalf(b[p * 4 + 3]!)
        for (let i = 0; i < 16; i++) buf[i] = law.bandValue(st, i)
        const got = law.bandRgb8(buf)

        const d = Math.max(Math.abs(got[0] - want[0]), Math.abs(got[1] - want[1]), Math.abs(got[2] - want[2]))
        if (d > maxC) {
          maxC = d
          worst = { at: [x, y], aEff: Number(aEff.toFixed(3)), got, want }
        }
        sumC += d
        hist[d] = hist[d]! + 1
        if (d > THRESHOLD.maxChannel) over++
        n++
        const bin = bins.find((bb) => aEff >= bb.lo && aEff < bb.hi)
        if (bin) {
          bin.n++
          bin.sum += d
          if (d > bin.max) bin.max = d
          if (d > THRESHOLD.maxChannel) bin.over++
        }
        // Supporting metric (sampled): in the fade band the result must lie
        // between the under-stroke and the layer.
        if (aEff > 0.002 && aEff < 0.998 && (p & 7) === 0) {
          for (let i = 0; i < 16; i++) {
            sampleL[i] = layerBands[b0 + i]!
            sampleS[i] = scene === 'paper' ? 1 : strokeBands[b0 + i]!
          }
          const layerRgb = law.bandRgb8(sampleL)
          const baseRgb = law.bandRgb8(sampleS)
          betweenN++
          if (got.some((v, i) => v < Math.min(layerRgb[i]!, baseRgb[i]!) - 1 || v > Math.max(layerRgb[i]!, baseRgb[i]!) + 1)) betweenOut++
        }
      }
    }
    let acc = 0, p95 = 255
    const p95Want = Math.ceil(n * 0.95)
    for (let d = 0; d < 256; d++) { acc += hist[d]!; if (acc >= p95Want) { p95 = d; break } }
    return {
      scene,
      falloff: Math.round(falloff * 100),
      texels: n,
      maxChannel: maxC,
      meanChannel: n ? Number((sumC / n).toFixed(2)) : 0,
      p95Channel: p95,
      overThreshold: over,
      worst,
      pass: maxC <= THRESHOLD.maxChannel && p95 <= THRESHOLD.p95Channel && over === THRESHOLD.overTexels,
      betweenness: { sampled: betweenN, outside: betweenOut },
      bins: bins.map((bb) => ({
        aEff: `${bb.lo}-${bb.hi}`, n: bb.n, max: bb.max,
        mean: bb.n ? Number((bb.sum / bb.n).toFixed(2)) : 0, over: bb.over,
      })),
    }
  }

  // --- BAR 1: live vs merged, 2 scenes x 3 falloffs --------------------------
  const bar1: Record<string, unknown>[] = []
  for (const scene of ['paper', 'stroke'] as const) {
    for (const falloff of FALLOFFS) {
      configure(scene, falloff)
      pass.drawOnce(strokeRect)
      pass.fence()
      bar1.push(residualFor(scene, falloff))
    }
  }
  const bar1Pass = bar1.every((r) => r.pass === true)
  const bar1Overall = {
    maxChannel: Math.max(...bar1.map((r) => r.maxChannel as number)),
    p95Channel: Math.max(...bar1.map((r) => r.p95Channel as number)),
    overThreshold: bar1.reduce((n, r) => n + (r.overThreshold as number), 0),
    texels: bar1.reduce((n, r) => n + (r.texels as number), 0),
  }

  // --- BAR 2: amount 0 bypasses the layer path -----------------------------
  // (a) the shipped path, replayed twice from the same starting carry: every
  // captured byte equal. `snapAB` above is the reference: the FIRST visit of a
  // fresh engine (its starting carry is the constructor's lastDir/lastAngle).
  const sameVisit = (label: string): Snap => {
    fresh()
    // Pin only the FIRST stroke: a fresh engine's first stroke also starts
    // from the constructor carry, and stroke B then inherits A's end exactly
    // as it did in `snapAB`.
    drive(strokeA(brushSize), `${label}A`, true)
    drive(strokeB(brushSize), `${label}B`)
    return engine.captureSheet() as Snap
  }
  const visitReplay1 = sameVisit('visitReplay1')
  const visitReplay2 = sameVisit('visitReplay2')
  const shippedReplay = compareCaptures(snapAB, visitReplay1)
  const visitStability = compareCaptures(visitReplay1, visitReplay2)

  // (b) what the bypass AVOIDS: the layer path at amount 0 replaces the base
  // with the layer wherever the layer covers, so the same-visit pickup of A
  // into B (which the shipped path has) is gone.
  configure('stroke', NOMINAL_FALLOFF, 0)
  pass.drawOnce(strokeRect)
  pass.fence()
  const zA = pass.readA(strokeRect)
  const zB = pass.readB(strokeRect)
  const amountZeroDivergence = (() => {
    const st = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    const shipped = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    const hist = new Uint32Array(256)
    let maxC = 0, sumC = 0, n = 0
    let worst: Record<string, unknown> = {}
    for (let ry = 0; ry < rh; ry++) {
      const y = strokeRect.y0 + ry
      for (let rx = 0; rx < rw; rx++) {
        const x = strokeRect.x0 + rx
        const p = ry * rw + rx
        if (Math.min(1, S_B.cover[y * w + x]!) <= 0) continue
        for (let c = 0; c < 4; c++) st.a[c] = fromHalf(zA[p * 4 + c]!)
        for (let c = 0; c < 3; c++) st.b[c] = fromHalf(zB[p * 4 + c]!)
        st.s = fromHalf(zB[p * 4 + 3]!)
        stateInto(shipped, S_AB, x, y)
        const got = law.stateRgb8(st)
        const want = law.stateRgb8(shipped)
        const d = Math.max(Math.abs(got[0] - want[0]), Math.abs(got[1] - want[1]), Math.abs(got[2] - want[2]))
        if (d > maxC) { maxC = d; worst = { at: [x, y], layerPath: got, shipped: want } }
        sumC += d
        hist[d] = hist[d]! + 1
        n++
      }
    }
    let acc = 0, p95 = 255
    const want = Math.ceil(n * 0.95)
    for (let d = 0; d < 256; d++) { acc += hist[d]!; if (acc >= want) { p95 = d; break } }
    return {
      coveredTexels: n,
      maxChannel: maxC,
      meanChannel: n ? Number((sumC / n).toFixed(2)) : 0,
      p95Channel: p95,
      worst,
    }
  })()

  // --- BAR 3: capture round trip of a merged sheet --------------------------
  configure('stroke', NOMINAL_FALLOFF)
  pass.drawOnce(strokeRect)
  pass.fence()
  const aFit = pass.readA(strokeRect)
  const bFit = pass.readB(strokeRect)
  const merged = copySheet(S_A)
  for (let ry = 0; ry < rh; ry++) {
    const y = strokeRect.y0 + ry
    for (let rx = 0; rx < rw; rx++) {
      const x = strokeRect.x0 + rx
      const p = ry * rw + rx
      const o = y * w + x
      for (let c = 0; c < 4; c++) merged.a[o * 4 + c] = fromHalf(aFit[p * 4 + c]!)
      for (let c = 0; c < 3; c++) merged.b[o * 3 + c] = fromHalf(bFit[p * 4 + c]!)
      merged.s[o] = fromHalf(bFit[p * 4 + 3]!)
      const cov = Math.min(1, S_B.cover[o]!)
      merged.cover[o] = 1 - (1 - S_A.cover[o]!) * (1 - cov)
    }
  }
  const mergedDigest = digestCapture({ whole: { w, h, rect: strokeRect, layers: {
    inkA: halfA(merged.a), inkB: halfB(merged.b, merged.s), cover: halfR(merged.cover),
  } } })

  // (a) the engine holds the merged sheet; render it (pre-capture display)
  const displayPre = renderState(engine, merged)
  // (b) capture it, WIPE, restore, re-render
  const snapMerged = engine.captureSheet() as Snap
  fresh()
  const restored = engine.restoreSheet(snapMerged)
  if (!restored) throw new Error('restoreSheet refused the merged capture')
  const displayPost = engine.readback(true, 2)
  const displayRoundTrip = compareBytes(displayPre, displayPost)
  // (c) the capture carries the state: decode it and compare lane by lane
  const back = decodeSheet(snapMerged)
  const stateCheck = (() => {
    const lanes = { a: 0, b: 0, s: 0, cover: 0 }
    let top = 0
    for (let i = 0; i < back.a.length; i++) {
      const d = Math.abs(back.a[i]! - merged.a[i]!)
      if (d > lanes.a) lanes.a = d
      if (d > top) top = d
    }
    for (let i = 0; i < back.b.length; i++) {
      const d = Math.abs(back.b[i]! - merged.b[i]!)
      if (d > lanes.b) lanes.b = d
      if (d > top) top = d
    }
    for (let i = 0; i < back.s.length; i++) {
      const d = Math.abs(back.s[i]! - merged.s[i]!)
      if (d > lanes.s) lanes.s = d
      if (d > top) top = d
    }
    for (let i = 0; i < back.cover.length; i++) {
      const d = Math.abs(back.cover[i]! - merged.cover[i]!)
      if (d > lanes.cover) lanes.cover = d
      if (d > top) top = d
    }
    return { maxAbs: top, byLane: lanes, exact: top === 0 }
  })()
  // (d) the frozen write-back form: ink = fit − fixed, display = ink + fixed.
  // The fixed pool is the base's state, so the merged state is stored as a
  // difference and the display sums it back through fp16.
  const poolSnapshotOk = engine.restoreSheet(encodeSnapshot(merged, 'mobile', 0, S_A))
  if (!poolSnapshotOk) throw new Error('restoreSheet refused the split (fit − fixed) snapshot')
  const displayPoolSplit = engine.readback(true, 2)
  const poolSplit = compareBytes(displayPre, displayPoolSplit)

  const bar3Pass = displayRoundTrip.differingBytes === 0 && displayRoundTrip.maxChannel === 0

  // --- BAR 4: determinism ---------------------------------------------------
  // The engine carries the previous stroke's end direction/angle into the next
  // stroke's first dab and resetSheet does not clear it, so an in-process
  // replay is only the same script if it starts from the same carry. Pin the
  // constructor carry: the replay then has to reproduce the FIRST paint byte
  // for byte, and two replays have to agree with each other.
  const replay = (entry: Entry, label: string): Snap => {
    fresh()
    drive(entry, label, true)
    return engine.captureSheet() as Snap
  }
  const a2 = replay(strokeA(brushSize), 'replayA2')
  const a3 = replay(strokeA(brushSize), 'replayA3')
  const b2 = replay(strokeB(brushSize), 'replayB2')
  const b3 = replay(strokeB(brushSize), 'replayB3')
  const scriptReplay = {
    strokeA: compareCaptures(snapA, a2),      // the first paint vs its replay
    strokeARepeat: compareCaptures(a2, a3),   // two replays
    strokeB: compareCaptures(b2, b3),
    sameVisit: shippedReplay,                 // the first visit vs its replay
    visitStability,
    bakes: {
      digestA: digestCapture(snapA),
      digestB: digestCapture(snapB),
      digestAB: digestCapture(snapAB),
    },
  }

  configure('stroke', NOMINAL_FALLOFF)
  pass.drawOnce(strokeRect)
  pass.fence()
  const run1 = { a: pass.readA(strokeRect), b: pass.readB(strokeRect), it: pass.readIterations(strokeRect) }
  pass.drawOnce(strokeRect)
  pass.fence()
  const run2 = { a: pass.readA(strokeRect), b: pass.readB(strokeRect), it: pass.readIterations(strokeRect) }
  const mergeReplay = {
    a: compareBytes(run1.a, run2.a),
    b: compareBytes(run1.b, run2.b),
    iterations: compareBytes(run1.it, run2.it),
  }
  const bar4Pass = scriptReplay.strokeA.paintIdentical && scriptReplay.strokeARepeat.paintIdentical
    && scriptReplay.strokeB.paintIdentical && scriptReplay.sameVisit.paintIdentical && scriptReplay.visitStability.paintIdentical
    && mergeReplay.a.differingBytes === 0 && mergeReplay.b.differingBytes === 0 && mergeReplay.iterations.differingBytes === 0

  // --- BAR 5: what the workbench can and cannot prove -----------------------
  const bar5 = {
    workbenchProven: {
      mergeIsPure: mergeReplay.a.differingBytes === 0 && mergeReplay.b.differingBytes === 0 && mergeReplay.iterations.differingBytes === 0,
      mergedSurvivesCapture: bar3Pass,
      scriptPaintsSameBytes: scriptReplay.strokeA.paintIdentical && scriptReplay.strokeARepeat.paintIdentical
        && scriptReplay.strokeB.paintIdentical && scriptReplay.sameVisit.paintIdentical && scriptReplay.visitStability.paintIdentical,
      statement:
        'the merge is a deterministic pure function of (base, layer, cover, lateral, amount, start, falloff); ' +
        'a merged sheet survives capture -> wipe -> restore -> re-render byte-identically; ' +
        'the same script paints the same bytes. Those are the three inputs a bake replay needs.',
    },
    implementationGate: [
      'POINTER stroke with edgeTransparency > 0: the merge runs at stroke end — one draw after the dab loop, before the next stroke reads the sheet. The workbench drives scripted strokes only; it cannot hold the pointer lifecycle.',
      'SCRIPTED stroke (adapter.applyStroke -> Studio apply / capture / bake): the same stroke-end call runs. The workbench proves the merge output, not that the engine invokes it.',
      'BAKE replay: re-baking a merged sheet into keys renders byte-identical to the live display (the workbench proves the merge replays from captured inputs; it cannot prove the engine replays the merged sheet through its own bake path).',
      'edgeTransparency = 0: no layer target is allocated, no merge draw is submitted, and the capture bytes equal the reference digest recorded here (engine sources are unchanged since d509a886d).',
      'The merge must be fed the sheet\'s SUMMED base (ink.read + fixed). The probe\'s base is stroke A captured after a fix; the law is a function of the state, not of which pool holds it.',
    ],
    scope: 'deferred — the lifecycle rows are the implementation quick\'s explicit gate',
  }

  const verdict = {
    bar1: bar1Pass,
    bar1Overall,
    bar2: shippedReplay.paintIdentical && visitStability.paintIdentical,
    bar2ShippedDigest: digestCapture(snapAB),
    bar2LayerPathDiverges: amountZeroDivergence.maxChannel > THRESHOLD.maxChannel,
    bar2DivergenceMax: amountZeroDivergence.maxChannel,
    bar3: bar3Pass,
    bar3DisplayDifferingBytes: displayRoundTrip.differingBytes,
    bar4: bar4Pass,
    bar5: 'quick',
    q4Pass: bar1Pass && shippedReplay.paintIdentical && visitStability.paintIdentical && bar3Pass && bar4Pass,
    q4Scope: 'bars 1-4 measured here; bar 5 is the quick\'s explicit gate',
  }

  return {
    spike: '006',
    scenario: 'q4',
    query: { requested: REQUESTED, sheet: w, paperSeed: PAPER_SEED, start: START, amount: AMOUNT },
    threshold: THRESHOLD,
    frozen: {
      bands: FROZEN_BANDS,
      pinnedByDoptimal: JSON.stringify(dOptimal(8).indices) === JSON.stringify(FROZEN_BANDS),
      dOptimal8: dOptimal(8),
      rankOneJacobian: FROZEN.rankOneJ,
      iterations: FROZEN.iterations,
      seedMix: FROZEN.seedMix,
      writeBack: 'in place: ink = fit - fixed; display = ink + fixed = fit',
    },
    reference: {
      commit: 'd509a886d',
      codeIdentity: 'git diff d509a886d HEAD -- packages/efx-watercolor/src app/src is empty (measured 2026-11-25)',
      engineSource: 'the probe imports the shipped engine read-only; no engine file was modified',
    },
    renderer,
    bakeMs,
    sheet: { requested: REQUESTED, actual: w, pixels: w * h },
    geometry: { strokeRect, strokePixels: nRect, centreX: geomB.centreX, halfWidth: geomB.halfWidth },
    bar1,
    bar1Overall: { ...bar1Overall, pass: bar1Pass },
    bar2: {
      shippedReplay,
      visitStability,
      digests: {
        strokeA: digestCapture(snapA),
        strokeB: digestCapture(snapB),
        sameVisit: digestCapture(snapAB),
        visitReplay1: digestCapture(visitReplay1),
        visitReplay2: digestCapture(visitReplay2),
      },
      amountZeroLayerPath: amountZeroDivergence,
      note: 'the layer path at amount 0 is NOT the shipped path: A_eff = cover replaces the base with the layer, dropping the same-visit pickup. The bypass is a required branch, not a formality.',
      pass: shippedReplay.paintIdentical && visitStability.paintIdentical,
    },
    bar3: {
      mergedDigest,
      displayVsRestored: displayRoundTrip,
      stateCheck,
      poolSplit: { note: 'ink = fit - fixed, display = ink + fixed (fp16 difference)', ...poolSplit },
      pass: bar3Pass,
    },
    bar4: { scriptReplay, mergeReplay, carryLog, pass: bar4Pass },
    bar5,
    verdict,
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
