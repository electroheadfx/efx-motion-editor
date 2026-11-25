// ============================================================
//  SPIKE 006 — Q3c: the reduced-band-set fit — the last cost round.
//
//  Q3b showed the merge is NOT Jacobian-bound (rank-one J: 36.0 -> 33.2 ms) and
//  is NOT a per-draw floor (1x1 = 0.5 ms, 512² = 0.6 ms, full rect = 31.9).
//  What is left is the arithmetic per texel: the band evaluations and the 8x8
//  normal equations, both proportional to the band count. The fit has 8
//  unknowns, so it does not NEED 16 equations — it needs 8 well-conditioned
//  ones. Fit 8, then RE-RENDER THROUGH ALL 16 and judge the error there.
//
//    A. the same serialized path as Q3b (one draw after an idle GPU, the
//       first-dab wait after an immediate / 50 ms / 200 ms start)
//    B. residual against the 16-band target over EVERY texel of the stroke rect
//       (p95 <= 1, max <= 2) — the fit's own band list is not the judge
//    C. iteration use (does the 2-iteration cap bind?)
//    D. the size ladder, to prove the cost is still fragment work
//    E. Q4 parity, ONLY if Q3c passes
//
//  Hard stop: if the combined variant (8 bands + 2 iterations + rank-one J) is
//  still over 25 ms, the decision is the artist's, not the harness's.
// ============================================================

import { createAquarelleEngineAdapter } from '../../../../packages/efx-watercolor/src/adapter/engineAdapter'
import { PAPERS, type PaperPreset } from '../../../../packages/efx-watercolor/src/playground/papers'
import { DEFAULT_CANONICAL_PARAMS } from '../../../../packages/efx-watercolor/src/playground/params'
import { toStudioStroke, type AquarellePoint } from '../../../../packages/efx-watercolor/src/payload/toStudioStroke'
import { DISPLAY_BANDS } from '../../../../packages/efx-watercolor/src/playground/spectralData'
import type { GL } from '../../../../packages/efx-watercolor/src/playground/gl'
import { fromHalf } from '../../../../packages/efx-watercolor/src/playground/half'
import * as law from './law'
import { candidates as bandSets, dOptimal } from './bands'
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
const AMOUNT = Number(QUERY.get('amount') ?? 1)
const FALLOFF = Number(QUERY.get('falloff') ?? 50) / 100
const EXPONENT = Math.pow(2, 2 * FALLOFF - 1)

/**
 * DECLARED BEFORE MEASURING (2026-11-25, before the first Q3c timing run).
 *  - the next stroke's first read of the sheet after an immediate start must
 *    not wait longer than 20 ms
 *  - the merged sheet, re-rendered through ALL 16 display bands, must match the
 *    live composite target within 2/255 at the worst texel and 1/255 at p95
 *  - after a 50 / 200 ms pause the merge must be long done
 *  - HARD STOP: a combined variant over 25 ms is the artist's decision
 */
const THRESHOLD = {
  immediateStartMs: 20,
  residualMaxChannel: 2,
  residualP95Channel: 1,
  after50Ms: 0.5,
  after200Ms: 0.5,
  hardStopMs: 25,
}

type Rect = { x0: number; y0: number; x1: number; y1: number }

// --- scene (identical to Q3/Q3b, so the numbers stay comparable) ------------

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

const alphaAt = (u: number) => {
  const t = Math.min(1, Math.max(0, (u - START) / (1 - START)))
  return 1 - AMOUNT * Math.pow(t, EXPONENT)
}

// --- timing ----------------------------------------------------------------

type Latency = { min: number; median: number; p95: number; max: number; rounds: number }

const r2 = (v: number) => Number(v.toFixed(2))
const quantile = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(xs.length * p))]!

const busyWait = (ms: number) => {
  const until = performance.now() + ms
  while (performance.now() < until) { /* spin: the GPU is a separate process */ }
}

const spread = (xs: number[], rounds: number): Latency => {
  xs.sort((a, b) => a - b)
  return { min: r2(xs[0]!), median: r2(quantile(xs, 0.5)), p95: r2(quantile(xs, 0.95)), max: r2(xs[xs.length - 1]!), rounds }
}

/** Latency of ONE submission after an idle GPU — not throughput. */
function latencyOf(fn: () => void, fence: () => void, rounds: number): Latency {
  const xs: number[] = []
  for (let i = 0; i < rounds; i++) {
    fence()
    const t0 = performance.now()
    fn()
    fence()
    xs.push(performance.now() - t0)
  }
  return spread(xs, rounds)
}

/** The wait the next stroke's first read of the sheet pays, artist pause excluded. */
function firstDabRead(merge: () => void, fence: () => void, raw: WebGL2RenderingContext, pauseMs: number, rounds: number): Latency {
  const xs: number[] = []
  for (let i = 0; i < rounds; i++) {
    fence()
    merge()
    raw.flush()
    if (pauseMs > 0) busyWait(pauseMs)
    const t0 = performance.now()
    fence()
    xs.push(performance.now() - t0)
  }
  return spread(xs, rounds)
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
  engine.resetSheet()
  drive(strokeA(brushSize))
  drive(strokeB(brushSize))
  const S_AB = decodeSheet(engine.captureSheet())
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
  const inputs = {
    baseA: halfA(S_A.a), baseB: halfB(S_A.b, S_A.s),
    layerA: halfA(S_B.a), layerB: halfB(S_B.b, S_B.s),
    cover: halfR(S_B.cover),
    lateral: halfR(lateral),
  }

  // --- the band sets --------------------------------------------------------
  // The choice is a property of the display basis (bands.ts), not of the scene;
  // the residual below is what judges it, and it is measured through all 16.
  const sets8 = bandSets(8)
  const best8 = sets8[0]! // dOptimal8
  const set10 = dOptimal(10)
  const set12 = dOptimal(12)
  const selection = {
    n: 8,
    chosen: best8,
    alternatives: sets8.slice(1),
    n10: set10,
    n12: set12,
    chosenWavelengths: best8.indices.map((i) => DISPLAY_BANDS[i]!),
  }

  // --- the passes -----------------------------------------------------------
  // One output target (84 MB) is shared by every band-list specialisation: they
  // all write the same place and are read back in turn.
  // One pass per DESIGN (band list × Jacobian × seed), sharing one output
  // target: the constants are compiled in, so a design is never recompiled
  // between measurements and the A/B below cannot be confounded by codegen.
  const base = { iterations: 4, coreSkip: false, seeded: false }
  const pass16 = new MergePass(gl, w, h, base)
  pass16.upload(inputs)
  const out = pass16.outTarget
  const mk = (opts: { bandList?: readonly number[]; rankOneJ?: boolean; seedMix?: boolean; coreSkip?: boolean }) =>
    new MergePass(gl, w, h, { ...base, ...opts }, 1, undefined, out)
  const pass16mix = mk({ seedMix: true })
  const pass8num = mk({ bandList: best8.indices })
  const pass8 = mk({ bandList: best8.indices, rankOneJ: true })
  const pass8mix = mk({ bandList: best8.indices, rankOneJ: true, seedMix: true })
  // The design's own exact-endpoint branch: aEff 0 and aEff 1 are copies, and
  // they are 55 % of the stroke rect (measured bins, Q3b).
  const pass8mixSkip = mk({ bandList: best8.indices, rankOneJ: true, seedMix: true, coreSkip: true })
  const pass10mix = mk({ bandList: set10.indices, rankOneJ: true, seedMix: true })
  const pass12mix = mk({ bandList: set12.indices, rankOneJ: true, seedMix: true })
  for (const p of [pass16mix, pass8num, pass8, pass8mix, pass8mixSkip, pass10mix, pass12mix]) {
    p.adoptInputs(pass16.inputTextures)
    p.amount = AMOUNT
    p.start = START
    p.falloff = FALLOFF
  }
  pass16.amount = AMOUNT
  pass16.start = START
  pass16.falloff = FALLOFF

  type Candidate = { name: string; pass: MergePass; bands: number; apply: () => void }
  const configure = (pass: MergePass, iterations: number) => () => {
    pass.iterations = iterations
    pass.bindUniforms()
  }
  const candidates: Candidate[] = [
    { name: 'bands16-4it-numJ', pass: pass16, bands: 16, apply: configure(pass16, 4) },
    { name: 'bands16-4it-numJ-seedMix', pass: pass16mix, bands: 16, apply: configure(pass16mix, 4) },
    { name: 'bands8-4it-numJ', pass: pass8num, bands: 8, apply: configure(pass8num, 4) },
    { name: 'bands8-4it-rank1', pass: pass8, bands: 8, apply: configure(pass8, 4) },
    { name: 'bands8-4it-rank1-seedMix', pass: pass8mix, bands: 8, apply: configure(pass8mix, 4) },
    { name: 'bands8-4it-rank1-seedMix-coreSkip', pass: pass8mixSkip, bands: 8, apply: configure(pass8mixSkip, 4) },
    { name: 'bands8-3it-rank1-seedMix', pass: pass8mix, bands: 8, apply: configure(pass8mix, 3) },
    { name: 'bands8-2it-rank1', pass: pass8, bands: 8, apply: configure(pass8, 2) },
    { name: 'bands8-2it-rank1-seedMix', pass: pass8mix, bands: 8, apply: configure(pass8mix, 2) },
    { name: 'bands10-2it-rank1-seedMix', pass: pass10mix, bands: 10, apply: configure(pass10mix, 2) },
    { name: 'bands12-2it-rank1-seedMix', pass: pass12mix, bands: 12, apply: configure(pass12mix, 2) },
    // Drift control: the decisive variant measured a second time, last.
    { name: 'bands8-4it-rank1-seedMix#2', pass: pass8mix, bands: 8, apply: configure(pass8mix, 4) },
  ]

  // The fence floor is a property of the shared target, not of the encoder.
  const fenceOnly = latencyOf(() => { /* nothing */ }, () => pass16.fence(), 12)

  // --- A/B. timing, per candidate ------------------------------------------
  const timing: Record<string, unknown>[] = []
  for (const c of candidates) {
    c.apply()
    const latency = latencyOf(() => c.pass.drawOnce(strokeRect), () => c.pass.fence(), 12)
    const immediate = firstDabRead(() => c.pass.drawOnce(strokeRect), () => c.pass.fence(), raw, 0, 10)
    const after50 = firstDabRead(() => c.pass.drawOnce(strokeRect), () => c.pass.fence(), raw, 50, 6)
    const after200 = firstDabRead(() => c.pass.drawOnce(strokeRect), () => c.pass.fence(), raw, 200, 6)
    timing.push({
      name: c.name,
      bands: c.bands,
      latency,
      firstDab: { immediate, after50, after200 },
      feltMs: {
        immediate: r2(Math.max(0, immediate.median - fenceOnly.median)),
        after50: r2(Math.max(0, after50.median - fenceOnly.median)),
        after200: r2(Math.max(0, after200.median - fenceOnly.median)),
      },
      derivedMs: {
        immediate: latency.median,
        after50: r2(Math.max(0, latency.median - 50)),
        after200: r2(Math.max(0, latency.median - 200)),
      },
    })
  }

  // --- interleaved A/B: is the seed mix's cost real, or drift? --------------
  // The end-of-run recheck drifts, so the two decisive designs are alternated
  // in the same process: a linear drift then applies to both and cancels.
  const medianOf = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
  const ab = { plain: [] as number[], seedMix: [] as number[] }
  for (let round = 0; round < 4; round++) {
    for (const [key, p] of [['plain', pass8], ['seedMix', pass8mix]] as const) {
      p.iterations = 4
      p.bindUniforms()
      ab[key].push(latencyOf(() => p.drawOnce(strokeRect), () => p.fence(), 6).median)
    }
  }
  const abab = {
    plain: { samples: ab.plain, median: r2(medianOf(ab.plain)) },
    seedMix: { samples: ab.seedMix, median: r2(medianOf(ab.seedMix)) },
    deltaMs: r2(medianOf(ab.seedMix) - medianOf(ab.plain)),
  }

  // --- the target: the 16-band mix, computed ONCE --------------------------
  const tRgb = new Uint8Array(rw * rh * 3)
  const tAeff = new Float32Array(rw * rh)
  {
    const layerTmp = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    const baseTmp = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    for (let ry = 0; ry < rh; ry++) {
      const y = strokeRect.y0 + ry
      for (let rx = 0; rx < rw; rx++) {
        const x = strokeRect.x0 + rx
        stateInto(layerTmp, S_B, x, y)
        stateInto(baseTmp, S_A, x, y)
        const u = Math.min(1, Math.abs(x - geomB.centreX) / geomB.halfWidth)
        const cov = Math.min(1, S_B.cover[y * w + x]!)
        const aEff = Math.min(1, Math.max(0, alphaAt(u) * cov))
        const target = law.targetBand(layerTmp, baseTmp, aEff) // all 16 bands
        const i = ry * rw + rx
        tAeff[i] = aEff
        tRgb[i * 3] = target.rgb8[0]!
        tRgb[i * 3 + 1] = target.rgb8[1]!
        tRgb[i * 3 + 2] = target.rgb8[2]!
      }
    }
  }

  /**
   * The residual the brief defines: the merged state, RE-RENDERED THROUGH ALL
   * 16 display bands (law.stateRgb8 uses every band, whatever the fit used),
   * against the 16-band target. Over every texel of the stroke rect.
   */
  const measureResidual = (reader: { readA(rect: Rect): Uint16Array; readB(rect: Rect): Uint16Array }) => {
    const a = reader.readA(strokeRect)
    const b = reader.readB(strokeRect)
    const hist = new Uint32Array(256)
    const bins = [
      [0, 0.01], [0.01, 0.1], [0.1, 0.25], [0.25, 0.5],
      [0.5, 0.75], [0.75, 0.9], [0.9, 0.99], [0.99, 0.9999], [0.9999, 1.0001],
    ].map(([lo, hi]) => ({ lo: lo!, hi: hi!, n: 0, max: 0, sum: 0, over: 0 }))
    const st = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    let maxC = 0, sumC = 0, n = 0, over = 0
    let worst: Record<string, unknown> = {}
    for (let ry = 0; ry < rh; ry++) {
      const y = strokeRect.y0 + ry
      for (let rx = 0; rx < rw; rx++) {
        const o = ry * rw + rx
        for (let c = 0; c < 4; c++) st.a[c] = fromHalf(a[o * 4 + c]!)
        for (let c = 0; c < 3; c++) st.b[c] = fromHalf(b[o * 4 + c]!)
        st.s = fromHalf(b[o * 4 + 3]!)
        const got = law.stateRgb8(st)
        const d = Math.max(
          Math.abs(got[0] - tRgb[o * 3]!),
          Math.abs(got[1] - tRgb[o * 3 + 1]!),
          Math.abs(got[2] - tRgb[o * 3 + 2]!),
        )
        if (d > maxC) {
          maxC = d
          worst = {
            at: [strokeRect.x0 + rx, y], aEff: Number(tAeff[o]!.toFixed(3)), got,
            want: [tRgb[o * 3], tRgb[o * 3 + 1], tRgb[o * 3 + 2]],
          }
        }
        sumC += d
        hist[d] = hist[d]! + 1
        if (d > THRESHOLD.residualMaxChannel) over++
        n++
        const aEff = tAeff[o]!
        const bin = bins.find((bb) => aEff >= bb.lo && aEff < bb.hi)
        if (bin) {
          bin.n++
          bin.sum += d
          if (d > bin.max) bin.max = d
          if (d > THRESHOLD.residualMaxChannel) bin.over++
        }
      }
    }
    let acc = 0, p95 = 255
    const want = Math.ceil(n * 0.95)
    for (let d = 0; d < 256; d++) { acc += hist[d]!; if (acc >= want) { p95 = d; break } }
    return {
      samples: n,
      maxChannel: maxC,
      meanChannel: n ? Number((sumC / n).toFixed(2)) : 0,
      p95Channel: p95,
      overThreshold: over,
      worst,
      bins: bins.map((bb) => ({
        aEff: `${bb.lo}-${bb.hi}`, n: bb.n, max: bb.max,
        mean: bb.n ? Number((bb.sum / bb.n).toFixed(2)) : 0, over: bb.over,
      })),
    }
  }

  const residuals = candidates.map((c, i) => {
    c.apply()
    c.pass.drawOnce(strokeRect)
    c.pass.fence()
    const res = measureResidual(c.pass)
    // how much of the cap the fit actually uses
    const it = c.pass.readIterations(strokeRect)
    const cap = c.pass.iterations
    let sum = 0, maxIter = 0, atCap = 0
    for (let i = 0; i < it.length; i++) {
      const v = fromHalf(it[i]!)
      sum += v
      if (v > maxIter) maxIter = v
      if (v >= cap) atCap++
    }
    return {
      name: c.name,
      bands: c.bands,
      feltMs: (timing[i]!.feltMs as { immediate: number }).immediate,
      latencyMs: (timing[i]!.latency as Latency).median,
      iterationsUsed: {
        mean: it.length ? Number((sum / it.length).toFixed(2)) : 0,
        max: maxIter,
        cap,
        atCapShare: it.length ? Number((atCap / it.length).toFixed(3)) : 0,
      },
      ...res,
    }
  })

  const passing = residuals.filter((r) =>
    r.feltMs <= THRESHOLD.immediateStartMs && r.maxChannel <= THRESHOLD.residualMaxChannel && r.p95Channel <= THRESHOLD.residualP95Channel)
  const fastestPassing = passing.length ? passing.slice().sort((a, b) => a.feltMs - b.feltMs)[0]! : null
  // When nothing passes, report the fastest candidate that meets the RESIDUAL
  // bar (the cost is then the whole story) or the lowest residual otherwise.
  const nearest = fastestPassing
    ?? residuals.filter((r) => r.maxChannel <= THRESHOLD.residualMaxChannel && r.p95Channel <= THRESHOLD.residualP95Channel)
      .sort((a, b) => a.feltMs - b.feltMs)[0]
    ?? residuals.slice().sort((a, b) => a.maxChannel - b.maxChannel)[0]!
  const best = candidates.find((c) => c.name === nearest.name)!

  const q3cPass = passing.length > 0
  const combined = residuals.find((r) => r.name === 'bands8-2it-rank1')!
  const combinedSeedMix = residuals.find((r) => r.name === 'bands8-2it-rank1-seedMix')!
  const hardStop = Math.min(combined.feltMs, combinedSeedMix.feltMs) > THRESHOLD.hardStopMs

  // --- C. the size ladder on the chosen encoder ----------------------------
  best.apply()
  const sizeLadder = {
    r1: latencyOf(() => best.pass.drawOnce({ x0: 0, y0: 0, x1: 1, y1: 1 }), () => best.pass.fence(), 8),
    r512: latencyOf(() => best.pass.drawOnce({ x0: 0, y0: 0, x1: 512, y1: 512 }), () => best.pass.fence(), 8),
    r1024: latencyOf(() => best.pass.drawOnce({ x0: 0, y0: 0, x1: 1024, y1: 1024 }), () => best.pass.fence(), 8),
    full: latencyOf(() => best.pass.drawOnce({ x0: 0, y0: 0, x1: w, y1: h }), () => best.pass.fence(), 8),
  }

  // --- D. Q4 parity, only if Q3c passed ------------------------------------
  const q4: Record<string, unknown> | null = q3cPass ? (() => {
    const digestOf = (sheet: SheetState) => {
      let hash = 0
      for (let i = 0; i < sheet.a.length; i += 37) hash = (hash * 31 + Math.round(sheet.a[i]! * 1024)) >>> 0
      for (let i = 0; i < sheet.b.length; i += 97) hash = (hash * 31 + Math.round(sheet.b[i]! * 1024)) >>> 0
      for (let i = 0; i < sheet.s.length; i += 397) hash = (hash * 31 + Math.round(sheet.s[i]! * 1024)) >>> 0
      return hash.toString(16)
    }

    // the merged sheet, from the CHOSEN encoder's own output
    best.apply()
    best.pass.drawOnce(strokeRect)
    best.pass.fence()
    const merged = copySheet(S_A)
    const aFit = best.pass.readA(strokeRect)
    const bFit = best.pass.readB(strokeRect)
    const mr = strokeRect
    const mrw = mr.x1 - mr.x0
    for (let ry = 0; ry < mr.y1 - mr.y0; ry++) {
      const y = mr.y0 + ry
      for (let rx = 0; rx < mrw; rx++) {
        const x = mr.x0 + rx
        const o = y * w + x
        const so = ry * mrw + rx
        for (let c = 0; c < 4; c++) merged.a[o * 4 + c] = fromHalf(aFit[so * 4 + c]!)
        for (let c = 0; c < 3; c++) merged.b[o * 3 + c] = fromHalf(bFit[so * 4 + c]!)
        merged.s[o] = fromHalf(bFit[so * 4 + 3]!)
        const cov = Math.min(1, S_B.cover[o]!)
        merged.cover[o] = 1 - (1 - S_A.cover[o]!) * (1 - cov)
      }
    }

    // (a) live vs merged over every covered texel
    const layerTmp = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    const baseTmp = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    const mergedTmp = law.makeState([0, 0, 0, 0], [0, 0, 0], 0)
    let maxC = 0, sumC = 0, n = 0, over = 0, betweenOut = 0, betweenN = 0
    const hist = new Uint32Array(256)
    let worst: Record<string, unknown> = {}
    for (let ry = 0; ry < rh; ry++) {
      const y = strokeRect.y0 + ry
      for (let rx = 0; rx < rw; rx++) {
        const x = strokeRect.x0 + rx
        const o = ry * rw + rx
        const cov = Math.min(1, S_B.cover[y * w + x]!)
        if (cov <= 0) continue
        stateInto(mergedTmp, merged, x, y)
        const got = law.stateRgb8(mergedTmp)
        const want: [number, number, number] = [tRgb[o * 3]!, tRgb[o * 3 + 1]!, tRgb[o * 3 + 2]!]
        const d = Math.max(Math.abs(got[0] - want[0]), Math.abs(got[1] - want[1]), Math.abs(got[2] - want[2]))
        if (d > maxC) { maxC = d; worst = { at: [x, y], aEff: Number(tAeff[o]!.toFixed(3)), got, want } }
        sumC += d
        hist[d] = hist[d]! + 1
        if (d > THRESHOLD.residualMaxChannel) over++
        n++
        const aEff = tAeff[o]!
        if (aEff > 0.002 && aEff < 0.998) {
          stateInto(layerTmp, S_B, x, y)
          stateInto(baseTmp, S_A, x, y)
          const layerRgb = law.stateRgb8(layerTmp)
          const baseRgb = law.stateRgb8(baseTmp)
          betweenN++
          if (got.some((v, i) => v < Math.min(layerRgb[i]!, baseRgb[i]!) - 1 || v > Math.max(layerRgb[i]!, baseRgb[i]!) + 1)) betweenOut++
        }
      }
    }
    let p95Acc = 0, p95 = 255
    const p95Want = Math.ceil(n * 0.95)
    for (let d = 0; d < 256; d++) { p95Acc += hist[d]!; if (p95Acc >= p95Want) { p95 = d; break } }

    // (b) amount 0 = bypass: the shipped path's reference digest, twice.
    const d0 = digestOf(S_AB)
    engine.resetSheet()
    drive(strokeA(brushSize))
    drive(strokeB(brushSize))
    const d0Repeat = digestOf(decodeSheet(engine.captureSheet()))

    // (c) capture parity
    const mergedDigest = digestOf(merged)
    engine.restoreSheet(encodeSnapshot(merged))
    const capturedDigest = digestOf(decodeSheet(engine.captureSheet()))
    const mergedPixels = renderState(engine, merged)
    engine.restoreSheet(encodeSnapshot(merged))
    const restoredPixels = renderState(engine, decodeSheet(engine.captureSheet()))
    let capturePixelMax = 0
    for (let i = 0; i < mergedPixels.length; i += 4) {
      for (let c = 0; c < 3; c++) capturePixelMax = Math.max(capturePixelMax, Math.abs(mergedPixels[i + c]! - restoredPixels[i + c]!))
    }

    // (d) bake replay
    engine.resetSheet()
    drive(strokeA(brushSize))
    engine.resetSheet()
    drive(strokeB(brushSize))
    const S_B2 = decodeSheet(engine.captureSheet())
    let replayMax = 0
    for (let i = 0; i < S_B.a.length; i += 37) replayMax = Math.max(replayMax, Math.abs(S_B.a[i]! - S_B2.a[i]!))
    const replayDigest = digestOf(S_B2)

    return {
      encoder: best.name,
      liveVsMerged: {
        coveredTexels: n,
        maxChannel: maxC,
        meanChannel: n ? Number((sumC / n).toFixed(2)) : 0,
        p95Channel: p95,
        overThreshold: over,
        worst,
        bar: THRESHOLD.residualMaxChannel,
        pass: maxC <= THRESHOLD.residualMaxChannel,
      },
      betweenness: { samples: betweenN, outside: betweenOut, pass: betweenOut === 0 },
      amountZeroBypass: {
        bypass: 'amount 0 short-circuits to the shipped path: no layer, no clear, no merge',
        referenceDigest: d0,
        repeatDigest: d0Repeat,
        deterministic: d0 === d0Repeat,
      },
      captureParity: {
        mergedDigest,
        capturedDigest,
        digestEqual: mergedDigest === capturedDigest,
        renderVsRestoredMaxChannel: capturePixelMax,
      },
      bakeReplay: {
        replayDigest,
        layerDigest: digestOf(S_B),
        sameStrokeMax: replayMax,
        pass: replayDigest === digestOf(S_B),
      },
    }
  })() : null

  const verdict = {
    q3cPass,
    immediateBarMs: THRESHOLD.immediateStartMs,
    residualBar: { maxChannel: THRESHOLD.residualMaxChannel, p95Channel: THRESHOLD.residualP95Channel },
    hardStopMs: THRESHOLD.hardStopMs,
    hardStop,
    combinedVariant: {
      bands8_2it_rank1: { feltMs: combined.feltMs, maxChannel: combined.maxChannel, p95Channel: combined.p95Channel },
      bands8_2it_rank1_seedMix: { feltMs: combinedSeedMix.feltMs, maxChannel: combinedSeedMix.maxChannel, p95Channel: combinedSeedMix.p95Channel },
    },
    bestCandidate: best.name,
    bestFeltMs: nearest.feltMs,
    bestMaxChannel: nearest.maxChannel,
    bestP95Channel: nearest.p95Channel,
    q4Pass: q4
      ? ((q4.liveVsMerged as { pass: boolean }).pass
        && (q4.captureParity as { digestEqual: boolean }).digestEqual
        && (q4.bakeReplay as { pass: boolean }).pass)
      : null,
  }

  return {
    spike: '006',
    scenario: 'q3c',
    query: { requested: REQUESTED, sheet: w, paperSeed: PAPER_SEED, start: START, amount: AMOUNT, falloff: FALLOFF },
    threshold: THRESHOLD,
    renderer,
    bakeMs,
    sheet: { requested: REQUESTED, actual: w, pixels: w * h },
    geometry: { strokeRect, strokePixels: rw * rh, centreX: geomB.centreX, halfWidth: geomB.halfWidth },
    selection,
    fenceFloorMs: fenceOnly.median,
    timing,
    abab,
    residuals,
    sizeLadder,
    verdict,
    q4,
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
