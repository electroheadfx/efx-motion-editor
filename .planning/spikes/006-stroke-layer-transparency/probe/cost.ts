// ============================================================
//  SPIKE 006 — Q3 (cost, on the REAL GPU path), Q2 (the shipped committed-base
//  law) and the pool write-back rider. SCRATCH HARNESS ONLY.
//
//  Q3: the bounded LM merge is a REAL GLSL pass (./merge.ts), run over a
//  realistic Gouache stroke's touched rect and over the whole sheet, at the
//  engine's real sheet sizes, on the real GPU. A CPU extrapolation is not an
//  answer, so none is given.
//
//  Q2: the shipped t_sheet x t_base^(1-cover) merge, evaluated CPU-side from the
//  engine's own exports, across the new stroke's fade band over a cached key.
//
//  RIDER: where the merged paint lands — mobile pool, settled pool, or both —
//  read through the wet transport, a following stroke's pickup, and the
//  capture/restore round trip the bake replay reads.
// ============================================================

import { createAquarelleEngineAdapter } from '../../../../packages/efx-watercolor/src/adapter/engineAdapter'
import { PAPERS, type PaperPreset } from '../../../../packages/efx-watercolor/src/playground/papers'
import { DEFAULT_CANONICAL_PARAMS } from '../../../../packages/efx-watercolor/src/playground/params'
import { toStudioStroke, type AquarellePoint } from '../../../../packages/efx-watercolor/src/payload/toStudioStroke'
import type { GL } from '../../../../packages/efx-watercolor/src/playground/gl'
import { fromHalf } from '../../../../packages/efx-watercolor/src/playground/half'
import * as law from './law'
import { MergePass, halfA, halfB, halfR } from './merge'
import {
  canary, capturedEngine, decodeSheet, encodeSnapshot, pixelOf, renderState, stateAt, stateInto,
  tapEngine, withSeededMathRandom,
  type EnginePriv, type SheetState,
} from './sheet'

const QUERY = new URLSearchParams(location.search)
const REQUESTED = Number(QUERY.get('size') ?? 1080)
const PAPER_SEED = Number(QUERY.get('seed') ?? 0xc0ffee)
const PAPER_STRENGTH = 1
const SETTLE_TICKS = 10
const COLD: PaperPreset | undefined = PAPERS.find((preset) => preset.id === 'cold')

const START = Number(QUERY.get('start') ?? 0.30)
const AMOUNT = Number(QUERY.get('amount') ?? 1)
const FALLOFF = Number(QUERY.get('falloff') ?? 50) / 100
const EXPONENT = Math.pow(2, 2 * FALLOFF - 1)

/**
 * DECLARED BEFORE MEASURING (2026-11-25, before the first timing run).
 *  - the realistic rect at 2K must fit one 60 Hz frame
 *  - the worst-case full sheet may exceed a frame but must beat a human's next
 *    stroke, which is the pickup read
 *  - the residual at the chosen budget is Q1's bar, carried forward
 */
const THRESHOLD = {
  realisticRectMs: 16.7,
  fullSheetMs: 250,
  residualChannel8: 2,
}

// --- scene ------------------------------------------------------------------

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

const strokeC = (size: number): Entry => ({
  color: '#2f7a3a',
  mutationId: 0x5c0001,
  size,
  points: [
    { x: 0.15, y: 0.30, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.50, y: 0.302, p: 0.85, tx: 0, ty: 0, tw: 0 },
    { x: 0.85, y: 0.30, p: 0.85, tx: 0, ty: 0, tw: 0 },
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

// --- colour -----------------------------------------------------------------

const toLinear = (v: number) => {
  const c = v / 255
  return c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
const toSrgb8 = (c: number) => {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

const alphaAt = (u: number) => {
  const t = Math.min(1, Math.max(0, (u - START) / (1 - START)))
  return 1 - AMOUNT * Math.pow(t, EXPONENT)
}

// --- geometry from the captures ---------------------------------------------

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

const inkOf = (sheet: SheetState, x: number, y: number) => {
  const o = y * sheet.w + x
  return Math.abs(sheet.a[o * 4]!) + Math.abs(sheet.a[o * 4 + 1]!) + Math.abs(sheet.a[o * 4 + 2]!)
}

// ---------------------------------------------------------------------------

type Eng = EnginePriv & { g: GL; resetSheet(): void }

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

  const drive = (entry: Entry, pickup?: number) => {
    adapter.applyStroke(makeStroke(entry, pickup))
    for (let tick = 0; tick <= SETTLE_TICKS; tick++) adapter.stepTick(tick)
    adapter.fix()
  }

  const bakeStart = performance.now()
  const brushSize = Math.max(24, Math.round(REQUESTED * 0.12))
  drive(strokeA(brushSize))
  const S_A = decodeSheet(engine.captureSheet())
  engine.resetSheet()
  drive(strokeB(brushSize))
  const S_B = decodeSheet(engine.captureSheet())
  const bakeMs = Math.round(performance.now() - bakeStart)

  const w = S_B.w
  const h = S_B.h
  const geomB = geometryOf(S_B)
  const geomA = geometryOf(S_A)

  const strokeRect = {
    x0: Math.max(0, geomB.x0 - 4),
    y0: Math.max(0, geomB.y0 - 4),
    x1: Math.min(w, geomB.x1 + 5),
    y1: Math.min(h, geomB.y1 + 5),
  }
  const fullRect = { x0: 0, y0: 0, x1: w, y1: h }
  const strokePixels = (strokeRect.x1 - strokeRect.x0) * (strokeRect.y1 - strokeRect.y0)

  // the lateral field the merge consumes (the MIN-of-|across| field's values)
  const lateral = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    lateral[y * w + x] = Math.min(1, Math.abs(x - geomB.centreX) / geomB.halfWidth)
  }

  // --- Q3: the real GLSL merge ---------------------------------------------
  const gl = engine.g
  const inputs = {
    baseA: halfA(S_A.a), baseB: halfB(S_A.b, S_A.s),
    layerA: halfA(S_B.a), layerB: halfB(S_B.b, S_B.s),
    cover: halfR(S_B.cover),
    lateral: halfR(lateral),
  }

  const configure = (pass: MergePass) => {
    pass.amount = AMOUNT
    pass.start = START
    pass.falloff = FALLOFF
  }

  /** Residual of the fitted rect against the Q1 target, sampled every `stride` texels. */
  const residualOf = (pass: MergePass, rect: typeof fullRect, stride: number) => {
    const a = pass.readA(rect)
    const b = pass.readB(rect)
    const iters = pass.readIterations(rect)
    const rw = rect.x1 - rect.x0
    const rh = rect.y1 - rect.y0
    let maxC = 0, sumC = 0, n = 0, maxBand = 0, iterSum = 0, iterMax = 0
    let worst = { at: [0, 0], u: 0, cover: 0, aEff: 0, got: [0, 0, 0] as number[], want: [0, 0, 0] as number[] }
    const deltas: number[] = []
    let over = 0
    const layerTmp = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    const baseTmp = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    for (let ry = 0; ry < rh; ry += stride) {
      const y = rect.y0 + ry
      for (let rx = 0; rx < rw; rx += stride) {
        const x = rect.x0 + rx
        const o = ry * rw + rx
        stateInto(layerTmp, S_B, x, y)
        stateInto(baseTmp, S_A, x, y)
        const u = Math.min(1, Math.abs(x - geomB.centreX) / geomB.halfWidth)
        const cov = Math.min(1, S_B.cover[y * w + x]!)
        const aEff = Math.min(1, Math.max(0, alphaAt(u) * cov))
        const target = law.targetBand(layerTmp, baseTmp, aEff)
        // readHalf returns half-float BIT PATTERNS — decode before use
        const fitted = law.makeState(
          [0, 1, 2, 3].map((c) => fromHalf(a[o * 4 + c]!)),
          [0, 1, 2].map((c) => fromHalf(b[o * 4 + c]!)),
          fromHalf(b[o * 4 + 3]!),
        )
        const got = law.stateRgb8(fitted)
        const d = Math.max(...got.map((c, i) => Math.abs(c - target.rgb8[i]!)))
        if (d > maxC) {
          maxC = d
          worst = { at: [x, y], u: Number(u.toFixed(3)), cover: Number(cov.toFixed(3)), aEff: Number(aEff.toFixed(3)), got, want: target.rgb8 }
        }
        sumC += d
        deltas.push(d)
        if (d > THRESHOLD.residualChannel8) over++
        n++
        const fb = law.bandsOf(fitted)
        for (let i = 0; i < law.BANDS; i++) maxBand = Math.max(maxBand, Math.abs(fb[i]! - target.bands[i]!) * 255)
        const it = fromHalf(iters[o] ?? 0)
        iterSum += it
        iterMax = Math.max(iterMax, it)
      }
    }
    return {
      samples: n,
      maxChannel: maxC,
      meanChannel: n ? Number((sumC / n).toFixed(2)) : 0,
      p95Channel: (() => { deltas.sort((x, y) => x - y); return deltas.length ? deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))]! : 0 })(),
      overThreshold: over,
      maxBandShift8: Number(maxBand.toFixed(2)),
      iterationsUsedMean: n ? Number((iterSum / n).toFixed(1)) : 0,
      iterationsUsedMax: iterMax,
      worst,
    }
  }

  // A one-texel truth check: with aEff = 1 the fitted state must be the layer's
  // own, so a debug read of the core proves the pass really writes.
  const debugInputs = (pass: MergePass) => {
    const rect = { x0: geomB.centreX - 2, y0: Math.round((geomB.y0 + geomB.y1) / 2) - 2, x1: geomB.centreX + 3, y1: Math.round((geomB.y0 + geomB.y1) / 2) + 3 }
    pass.runDebug(rect)
    const a = pass.readA(rect)
    const b = pass.readB(rect)
    const it = pass.readIterations(rect)
    const o = 2 * (rect.x1 - rect.x0) + 2
    const hf = (v: number) => {
      const sign = v & 0x8000 ? -1 : 1
      const exp = (v >>> 10) & 0x1f
      const mant = v & 0x3ff
      if (exp === 0) return sign * mant * 2 ** -24
      if (exp === 0x1f) return mant ? NaN : sign * Infinity
      return sign * (1 + mant / 1024) * 2 ** (exp - 15)
    }
    return {
      fragCoord_outSize: [a[o * 4], a[o * 4 + 1], a[o * 4 + 2], a[o * 4 + 3]].map((v) => hf(v!)),
      uv10000_layerAx_baseAx: [b[o * 4], b[o * 4 + 1], b[o * 4 + 2], b[o * 4 + 3]].map((v) => hf(v!)),
    }
  }

  const debugOf = (pass: MergePass) => {
    const rect = { x0: geomB.centreX - 2, y0: Math.round((geomB.y0 + geomB.y1) / 2) - 2, x1: geomB.centreX + 3, y1: Math.round((geomB.y0 + geomB.y1) / 2) + 3 }
    const a = pass.readA(rect)
    const b = pass.readB(rect)
    const it = pass.readIterations(rect)
    const rowMidB = Math.round((geomB.y0 + geomB.y1) / 2)
    const o = 2 * (rect.x1 - rect.x0) + 2
    return {
      glError: pass.lastError,
      out: [a[o * 4], a[o * 4 + 1], a[o * 4 + 2], a[o * 4 + 3], b[o * 4], b[o * 4 + 1], b[o * 4 + 2], b[o * 4 + 3]],
      layer: [0, 1, 2, 3].map((c) => S_B.a[(rowMidB * w + geomB.centreX) * 4 + c]).concat([0, 1, 2].map((c) => S_B.b[(rowMidB * w + geomB.centreX) * 3 + c]), [S_B.s[rowMidB * w + geomB.centreX]]),
      iterations: [it[o], it[1], it[2], it[3]],
    }
  }

  const debug: Record<string, unknown> = {}
  {
    const rb = Math.round((geomA.y0 + geomA.y1) / 2)
    debug.cpuCheck = {
      rowMid: rb,
      geomA,
      geomB,
      baseInkAtSample: S_A.a.length ? inkOf(S_A, geomB.centreX, rb) : -1,
      layerInkAtSample: inkOf(S_B, geomB.centreX, rb),
      baseCoverAtSample: S_A.cover.length ? S_A.cover[rb * w + geomB.centreX] : -1,
    }
  }
  debug.writeTest = MergePass.writeTest(engine.g, Math.min(w, 64), Math.min(h, 64))

  const budgetRows: unknown[] = []
  for (const iterations of [4, 8, 12, 16, 24, 32]) {
    const pass = new MergePass(gl, w, h, { iterations, coreSkip: false, seeded: false })
    pass.upload(inputs)
    configure(pass)
    // a 1x1 rect is the per-draw sync floor; subtract it to isolate the work
    const overheadMs = pass.run({ x0: 0, y0: 0, x1: 1, y1: 1 }, 20)
    const rectMs = pass.run(strokeRect, 20)
    const fullMs = pass.run(fullRect, 5)
    if (iterations === 16) {
      debug.uniforms = pass.uniformStatus()
      debug.texel = {
        at: [geomB.centreX, Math.round((geomA.y0 + geomA.y1) / 2)],
        baseA: pass.readTextureTexel('baseA', geomB.centreX, Math.round((geomA.y0 + geomA.y1) / 2)),
        layerA: pass.readTextureTexel('layerA', geomB.centreX, Math.round((geomA.y0 + geomA.y1) / 2)),
        cover: pass.readTextureTexel('cover', geomB.centreX, Math.round((geomA.y0 + geomA.y1) / 2)),
      }
      debug.inputs = debugInputs(pass)
      debug.merge16 = debugOf(pass)
    }
    budgetRows.push({
      iterations,
      overheadMs: Number(overheadMs.toFixed(2)),
      rectMs: Number(rectMs.toFixed(2)),
      rectNetMs: Number(Math.max(0, rectMs - overheadMs).toFixed(2)),
      rectPerTexelUs: Number((Math.max(0, rectMs - overheadMs) * 1000 / strokePixels).toFixed(4)),
      fullMs: Number(fullMs.toFixed(2)),
      fullNetMs: Number(Math.max(0, fullMs - overheadMs).toFixed(2)),
      fullPerTexelUs: Number((Math.max(0, fullMs - overheadMs) * 1000 / (w * h)).toFixed(4)),
      residual: residualOf(pass, strokeRect, 5),
    })
    pass.dispose()
  }

  // --- mitigations ----------------------------------------------------------
  const chosen = 16
  const mitigations: Record<string, unknown> = {}
  {
    const pass = new MergePass(gl, w, h, { iterations: chosen, coreSkip: true, seeded: false })
    pass.upload(inputs)
    configure(pass)
    const overheadMs = pass.run({ x0: 0, y0: 0, x1: 1, y1: 1 }, 20)
    const rectMs = pass.run(strokeRect, 20)
    const fullMs = pass.run(fullRect, 5)
    mitigations.coreSkip = {
      iterations: chosen,
      rectMs: Number(rectMs.toFixed(2)),
      rectNetMs: Number(Math.max(0, rectMs - overheadMs).toFixed(2)),
      fullMs: Number(fullMs.toFixed(2)),
      fullNetMs: Number(Math.max(0, fullMs - overheadMs).toFixed(2)),
      fullPerTexelUs: Number(((fullMs * 1000) / (w * h)).toFixed(4)),
      residual: residualOf(pass, strokeRect, 3),
    }
    pass.dispose()
  }
  {
    const coarse = new MergePass(gl, w, h, { iterations: 8, coreSkip: true, seeded: false }, 8)
    coarse.upload(inputs)
    configure(coarse)
    const coarseRectMs = coarse.run({ x0: 0, y0: 0, x1: coarse.outW, y1: coarse.outH }, 20)
    const seedA = coarse.readA({ x0: 0, y0: 0, x1: coarse.outW, y1: coarse.outH })
    const seedB = coarse.readB({ x0: 0, y0: 0, x1: coarse.outW, y1: coarse.outH })

    const fine = new MergePass(gl, w, h, { iterations: 8, coreSkip: true, seeded: true })
    fine.upload(inputs)
    fine.uploadSeed({ w: coarse.outW, h: coarse.outH, a: seedA, b: seedB })
    configure(fine)
    const fineRectMs = fine.run(strokeRect, 20)
    const fineFullMs = fine.run(fullRect, 5)
    mitigations.coarseToFine = {
      coarseIterations: 8,
      fineIterations: 8,
      coarseMs: Number(coarseRectMs.toFixed(2)),
      fineRectMs: Number(fineRectMs.toFixed(2)),
      rectMs: Number((coarseRectMs + fineRectMs).toFixed(2)),
      fullMs: Number((coarseRectMs + fineFullMs).toFixed(2)),
      residual: residualOf(fine, strokeRect, 3),
    }
    coarse.dispose()
    fine.dispose()
  }

  // --- layer memory: really allocated, so the formats are proven ------------
  const RGBA16F = { internal: 0x881a, format: 0x1908, type: 0x140b }
  const R16F = { internal: 0x822d, format: 0x1903, type: 0x140b }
  let layerDoubleBytes = 0
  {
    const ink = gl.double(w, h, [RGBA16F, RGBA16F], gl.gl.NEAREST)
    const cover = gl.target(w, h, [R16F], gl.gl.NEAREST)
    const lat = gl.target(w, h, [R16F], gl.gl.NEAREST)
    const relief = gl.target(w, h, [R16F], gl.gl.NEAREST)
    layerDoubleBytes = w * h * (2 * 2 * 8) + 3 * w * h * 2
    gl.disposeTarget(ink.read); gl.disposeTarget(ink.write)
    gl.disposeTarget(cover); gl.disposeTarget(lat); gl.disposeTarget(relief)
  }
  const mergeBytes = w * h * (8 + 8 + 2)
  const memory = {
    sheetPixels: w * h,
    layerPreviewMb: Number(((w * h * 22) / (1024 * 1024)).toFixed(1)),
    layerDoubleMb: Number((layerDoubleBytes / (1024 * 1024)).toFixed(1)),
    mergeOutputMb: Number((mergeBytes / (1024 * 1024)).toFixed(1)),
    combinedMb: Number(((layerDoubleBytes + mergeBytes) / (1024 * 1024)).toFixed(1)),
    budgetMb: 256,
  }

  // --- Q2: the shipped committed-base law ----------------------------------
  const sheetCanvas = renderState(engine, S_B)
  const baseCanvas = renderState(engine, S_A)
  const rowMid = Math.round((geomA.y0 + geomA.y1) / 2)
  const q2Profile: unknown[] = []
  let betweenWidth = 0
  let coverRampPx = 0
  let idealFadePx = 0
  let shippedVsIdealMax = 0
  let shippedVsIdealSum = 0
  let profileN = 0
  const xLo = Math.max(0, geomB.x0 - 2)
  const xHi = Math.min(w - 1, geomB.x1 + 2)
  for (let x = xLo; x <= xHi; x++) {
    const sPix = pixelOf(sheetCanvas, w, x, rowMid)
    const bPix = pixelOf(baseCanvas, w, x, rowMid)
    const cov = Math.min(1, S_B.cover[rowMid * w + x]!)
    const u = Math.min(1.05, Math.abs(x - geomB.centreX) / geomB.halfWidth)
    // Q1's mandatory gate: the ideal fade is A(u) x cover, never A alone.
    const aIdeal = Math.min(1, Math.max(0, alphaAt(u) * cov))
    if (cov > 0.02 && cov < 0.98) coverRampPx++
    if (aIdeal > 0.02 && aIdeal < 0.98) idealFadePx++
    const shipped: number[] = []
    const ideal: number[] = []
    let between = true
    for (let c = 0; c < 3; c++) {
      const ts = toLinear(sPix[c]!)
      const tb = toLinear(bPix[c]!)
      shipped.push(ts * Math.pow(tb, 1 - cov))
      ideal.push(aIdeal * ts + (1 - aIdeal) * tb)
      if (shipped[c]! < Math.min(ts, tb) - 1e-6 || shipped[c]! > Math.max(ts, tb) + 1e-6) between = false
    }
    if (between) betweenWidth++
    shippedVsIdealMax = Math.max(shippedVsIdealMax, Math.max(...shipped.map((v, i) => Math.abs(toSrgb8(v) - toSrgb8(ideal[i]!)))))
    shippedVsIdealSum += Math.max(...shipped.map((v, i) => Math.abs(toSrgb8(v) - toSrgb8(ideal[i]!))))
    profileN++
    if (x % Math.max(1, Math.round((xHi - xLo) / 16)) === 0) {
      const ts = toLinear(sPix[0]!)
      const tb = toLinear(bPix[0]!)
      const implied = Math.abs(ts - tb) < 1e-6 ? 0 : (shipped[0]! - tb) / (ts - tb)
      q2Profile.push({
        x, u: Number(u.toFixed(3)), cover: Number(cov.toFixed(3)), idealAlpha: Number(aIdeal.toFixed(3)),
        tSheet8: sPix[0], tBase8: bPix[0], shipped8: toSrgb8(shipped[0]!), ideal8: toSrgb8(ideal[0]!),
        impliedAlpha: Number(implied.toFixed(3)),
      })
    }
  }
  const bandPx = geomB.x1 - geomB.x0
  const q2 = {
    row: rowMid,
    bandPx,
    betweenWidthPx: betweenWidth,
    coverRampPx,
    idealFadePx,
    betweenShare: Number((betweenWidth / Math.max(1, xHi - xLo + 1)).toFixed(3)),
    shippedVsIdeal: {
      maxChannel8: shippedVsIdealMax,
      meanChannel8: profileN ? Number((shippedVsIdealSum / profileN).toFixed(2)) : 0,
      samples: profileN,
    },
    profile: q2Profile,
  }

  // --- RIDER: which pool does the merged paint go into? ---------------------
  // The display sums both pools, so only three read paths can tell them apart.
  const rider: Record<string, unknown> = {}
  {
    const renderDigest: Record<string, string> = {}
    const wetMovement: Record<string, number> = {}
    const pickup: Record<string, number> = {}
    const captureDigest: Record<string, string> = {}

    // The display sums ink + fixed, so `decodeSheet` IS the displayed state:
    // compare the decoded sheets instead of paying a full export per pool.
    const digestOf = (sheet: SheetState) => {
      let hash = 0
      for (let i = 0; i < sheet.a.length; i += 37) hash = (hash * 31 + Math.round(sheet.a[i]! * 1024)) >>> 0
      for (let i = 0; i < sheet.b.length; i += 97) hash = (hash * 31 + Math.round(sheet.b[i]! * 1024)) >>> 0
      for (let i = 0; i < sheet.s.length; i += 397) hash = (hash * 31 + Math.round(sheet.s[i]! * 1024)) >>> 0
      return hash.toString(16)
    }

    for (const pool of ['mobile', 'settled', 'both'] as const) {
      // 1. the display must be pool-blind
      renderDigest[pool] = digestOf(decodeSheet(encodeSnapshot(S_B, pool)))

      // 2. the capture/restore round trip the bake replay reads
      engine.restoreSheet(encodeSnapshot(S_B, pool))
      captureDigest[pool] = digestOf(decodeSheet(engine.captureSheet()))

      // 3. the wet transport: restore WET, run ticks, measure how much paint moved
      engine.restoreSheet(encodeSnapshot(S_B, pool, 1))
      const before = decodeSheet(engine.captureSheet())
      for (let tick = 0; tick < 40; tick++) adapter.stepTick(tick)
      const after = decodeSheet(engine.captureSheet())
      let moved = 0
      let total = 0
      for (let y = geomB.y0; y <= geomB.y1; y += 2) {
        for (let x = geomB.x0; x <= geomB.x1; x += 2) {
          const b0 = inkOf(before, x, y)
          const a0 = inkOf(after, x, y)
          moved += Math.abs(a0 - b0)
          total += b0
        }
      }
      wetMovement[pool] = total > 0 ? Number((moved / total).toFixed(4)) : 0

      // 4. a following stroke's pickup
      engine.restoreSheet(encodeSnapshot(S_B, pool))
      drive(strokeC(brushSize), 100)
      const S_C = decodeSheet(engine.captureSheet())
      const rowC = Math.round(0.30 * h)
      const cross = law.stateRgb8(stateAt(S_C, geomB.centreX, rowC))
      const away = law.stateRgb8(stateAt(S_C, Math.min(w - 1, geomB.centreX + Math.round(geomB.halfWidth * 2.5)), rowC))
      pickup[pool] = Math.max(...cross.map((c, i) => Math.abs(c - away[i]!)))
    }

    rider.renderDigest = renderDigest
    rider.captureDigest = captureDigest
    rider.wetMovement = wetMovement
    rider.pickupShift = pickup
    rider.poolBlind = {
      display: new Set(Object.values(renderDigest)).size === 1,
      capture: new Set(Object.values(captureDigest)).size === 1,
      pickup: new Set(Object.values(pickup)).size === 1,
    }
  }

  return {
    spike: '006',
    scenario: 'cost',
    query: { requested: REQUESTED, sheet: w, paperSeed: PAPER_SEED, start: START, amount: AMOUNT, falloff: FALLOFF },
    threshold: THRESHOLD,
    renderer,
    bakeMs,
    sheet: { requested: REQUESTED, actual: w, pixels: w * h },
    geometry: {
      strokeRect,
      strokeRectPixels: strokePixels,
      bandPx,
      centreX: geomB.centreX,
      halfWidth: geomB.halfWidth,
      aRows: [geomA.y0, geomA.y1],
    },
    memory,
    debug,
    budgets: budgetRows,
    mitigations,
    q2,
    rider,
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
