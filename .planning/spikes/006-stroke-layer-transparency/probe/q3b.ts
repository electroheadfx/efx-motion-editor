// ============================================================
//  SPIKE 006 — Q3b: the SERIALIZED stroke-end path.
//
//  Q3 measured the merge as THROUGHPUT and judged it against a 60 Hz frame.
//  That was the wrong bar: the merge runs ONCE, at stroke end. The real gate is
//  (a) no dropped frame while painting, and (b) no perceptible wait for the
//  next stroke, whose first dab reads the merged sheet.
//
//  This probe measures, on the real GPU path:
//    A. stroke-end -> merge-complete latency (single draw after an idle GPU)
//    B. the first-dab wait when the next stroke starts immediately, after
//       50 ms and after 200 ms
//    C. the display's marginal per-frame cost with a live layer (frames
//       dropped while painting)
//    D. the single-buffer memory map at 2K (the ceiling is declared below)
//    E. only if B fails: a half-resolution band fit + full-res resolve
//    F. only if Q3b passes: Q4 parity
// ============================================================

import { createAquarelleEngineAdapter } from '../../../../packages/efx-watercolor/src/adapter/engineAdapter'
import { PAPERS, type PaperPreset } from '../../../../packages/efx-watercolor/src/playground/papers'
import { DEFAULT_CANONICAL_PARAMS } from '../../../../packages/efx-watercolor/src/playground/params'
import { toStudioStroke, type AquarellePoint } from '../../../../packages/efx-watercolor/src/payload/toStudioStroke'
import type { GL } from '../../../../packages/efx-watercolor/src/playground/gl'
import { fromHalf } from '../../../../packages/efx-watercolor/src/playground/half'
import * as law from './law'
import { DisplayCostPass, MergePass, ResolvePass, halfA, halfB, halfR } from './merge'
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
 * DECLARED BEFORE MEASURING (2026-11-25, before the first Q3b timing run).
 *  - the next stroke's first read of the sheet must not wait longer than
 *    ~20 ms after an immediate start (the artist's felt delay)
 *  - after a 50 ms or 200 ms pause the merge must be long done
 *  - the display pass with a live layer must still fit one 60 Hz frame at 2K
 *    (that is what "no dropped frame while painting" means numerically)
 *  - the layer's added allocation at 2K must fit 160 MB
 *  - the merged state must reproduce the live composite within 2/255
 */
const THRESHOLD = {
  immediateStartMs: 20,
  after50Ms: 0.5,
  after200Ms: 0.5,
  displayWithLayerMs: 16.7,
  memoryAddedMb: 160,
  residualChannel8: 2,
}

type Rect = { x0: number; y0: number; x1: number; y1: number }

// --- scene (identical to the Q3 probe, so the numbers stay comparable) ------

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

/**
 * The artist starts the next stroke `pauseMs` after the merge was submitted.
 * Returns the wait the next stroke's first read of the sheet actually pays —
 * the artist's own pause is excluded. `flush()` hands the merge to the GPU so
 * the pause is real GPU time rather than a queue the harness never submitted.
 */
function firstDabRead(merge: () => void, fence: () => void, raw: WebGL2RenderingContext, pauseMs: number, rounds: number): Latency {
  const xs: number[] = []
  for (let i = 0; i < rounds; i++) {
    fence()                 // idle
    merge()                 // stroke end: submit the merge
    raw.flush()             // start it now, not at the next fence
    if (pauseMs > 0) busyWait(pauseMs)
    const t0 = performance.now()
    fence()                 // the next stroke's first dab reads the merged sheet
    xs.push(performance.now() - t0)
  }
  return spread(xs, rounds)
}

// ---------------------------------------------------------------------------

type Eng = EnginePriv & { g: GL; resetSheet(): void }

const MiB = (bytes: number) => Number((bytes / (1024 * 1024)).toFixed(1))

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
  const strokePixels = rw * rh

  // The per-texel lateral field the merge consumes (Q1's u).
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
  const configure = (pass: MergePass | ResolvePass) => {
    pass.amount = AMOUNT
    pass.start = START
    pass.falloff = FALLOFF
  }

  // --- A. stroke-end -> merge-complete latency ------------------------------
  const chosen = 4 // Q3's affordable budget; 12 iterations is the max-residual budget
  const pass = new MergePass(gl, w, h, { iterations: chosen, coreSkip: false, seeded: false })
  pass.upload(inputs)
  configure(pass)
  pass.bindUniforms()

  const mergeLatency = latencyOf(() => pass.drawOnce(strokeRect), () => pass.fence(), 12)
  const fenceOnly = latencyOf(() => { /* nothing */ }, () => pass.fence(), 12)
  const throughput = pass.run(strokeRect, 10) // Q3's method, for the record

  // The size ladder: if a 1x1 rect costs what the stroke rect costs, the
  // measured latency is a per-draw floor (binning / submission), NOT fragment
  // work — and no per-texel optimization could ever move it.
  const sizeLadder = {
    r1: latencyOf(() => pass.drawOnce({ x0: 0, y0: 0, x1: 1, y1: 1 }), () => pass.fence(), 12),
    r512: latencyOf(() => pass.drawOnce({ x0: 0, y0: 0, x1: 512, y1: 512 }), () => pass.fence(), 8),
    r1024: latencyOf(() => pass.drawOnce({ x0: 0, y0: 0, x1: 1024, y1: 1024 }), () => pass.fence(), 8),
    full: latencyOf(() => pass.drawOnce({ x0: 0, y0: 0, x1: w, y1: h }), () => pass.fence(), 8),
  }

  // The 12-iteration budget, for the context table (max residual 2/255, 0 over).
  // One pass, two budgets: a second pass would re-upload 150 MB of inputs.
  pass.iterations = 12
  pass.bindUniforms()
  const mergeLatency12 = latencyOf(() => pass.drawOnce(strokeRect), () => pass.fence(), 8)
  pass.iterations = chosen
  pass.bindUniforms()

  // --- B. the first-dab wait ------------------------------------------------
  const firstDab = {
    baselineFenceMs: fenceOnly.median,
    immediate: firstDabRead(() => pass.drawOnce(strokeRect), () => pass.fence(), raw, 0, 10),
    after50ms: firstDabRead(() => pass.drawOnce(strokeRect), () => pass.fence(), raw, 50, 8),
    after200ms: firstDabRead(() => pass.drawOnce(strokeRect), () => pass.fence(), raw, 200, 8),
  }
  const feltDelay = {
    immediate: r2(Math.max(0, firstDab.immediate.median - fenceOnly.median)),
    after50ms: r2(Math.max(0, firstDab.after50ms.median - fenceOnly.median)),
    after200ms: r2(Math.max(0, firstDab.after200ms.median - fenceOnly.median)),
  }
  // The derived value: what is left of the merge when the dab arrives.
  const derived = {
    immediate: mergeLatency.median,
    after50ms: r2(Math.max(0, mergeLatency.median - 50)),
    after200ms: r2(Math.max(0, mergeLatency.median - 200)),
  }

  // --- C. frames dropped while painting -------------------------------------
  // The dab path is unchanged (same shader, same target formats — the layer's
  // targets are the sheet's formats). The per-frame cost that DOES change is
  // the display, which must composite the live layer: a second 16-band
  // conversion plus the mix.
  const display = new DisplayCostPass(gl, w, h)
  display.amount = AMOUNT
  display.start = START
  display.falloff = FALLOFF
  display.adoptInputs(pass.inputTextures)
  const displayCost: Record<string, Latency> = {}
  for (const [name, mode] of [['today', 0], ['twoStates', 1], ['branchOnCover', 2]] as const) {
    display.mode = mode
    display.bindUniforms()
    displayCost[name] = latencyOf(() => display.drawOnce(), () => display.fence(), 10)
  }
  const displayMarginal = r2(displayCost.twoStates!.median - displayCost.today!.median)
  display.dispose()

  // --- D. memory: the single-buffer layer at 2K ----------------------------
  const RGBA16F = { internal: 0x881a, format: 0x1908, type: 0x140b }
  const R16F = { internal: 0x822d, format: 0x1903, type: 0x140b }
  const memory: Record<string, unknown> = {}
  {
    while (raw.getError() !== raw.NO_ERROR) { /* clear */ }
    // The layer's stroke target: the same MRT shape as the sheet's own `ink`.
    const layerInk = gl.target(w, h, [RGBA16F, RGBA16F], raw.NEAREST)
    // The layer's coverage + lateral field.
    const layerFields = gl.target(w, h, [R16F, R16F], raw.NEAREST)
    const err = raw.getError()
    memory.sheetPixels = w * h
    memory.items = [
      { item: 'layer inkA + inkB (RGBA16F MRT — the dab target)', bytes: w * h * 16, mib: MiB(w * h * 16) },
      { item: 'layer cover + lateral (R16F MRT)', bytes: w * h * 4, mib: MiB(w * h * 4) },
    ]
    memory.addedMiB = MiB(w * h * 20)
    memory.mergeTargetsMiB = 0
    memory.note = 'the merge samples ink.read + fixed + cover.read and writes ink.write + cover.write; ' +
      'both doubles already exist (Engine.ts:551 ink, :552 fixed, :557 cover), so the merge allocates nothing'
    memory.ceilingMiB = THRESHOLD.memoryAddedMb
    memory.glError = err
    gl.disposeTarget(layerInk)
    gl.disposeTarget(layerFields)
  }

  // --- E. cost variants, only if the immediate start misses the bar ---------
  // Each candidate is judged on the two axes the brief names: the felt
  // first-dab wait at an immediate start, and the merge error against Q1's
  // target over EVERY texel of the stroke's rect (no stride).
  type Reader = { readA(rect: Rect): Uint16Array; readB(rect: Rect): Uint16Array }
  type Candidate = { name: string; reader: Reader; feltMs: number; redraw: () => void }
  const candidates: Candidate[] = [{
    name: 'full-res-4it-numericJ',
    reader: pass,
    feltMs: feltDelay.immediate,
    redraw: () => { pass.rankOneJ = false; pass.bindUniforms(); pass.drawOnce(strokeRect); pass.fence() },
  }]
  const variants: Record<string, unknown> = {}

  if (feltDelay.immediate >= THRESHOLD.immediateStartMs) {
    // Half-resolution band fit + a full-res resolve: the core and the outside
    // are copied EXACTLY, only the fade band is upsampled.
    const halfRect: Rect = {
      x0: Math.max(0, Math.floor(strokeRect.x0 / 2)),
      y0: Math.max(0, Math.floor(strokeRect.y0 / 2)),
      x1: Math.min(Math.round(w / 2), Math.ceil(strokeRect.x1 / 2)),
      y1: Math.min(Math.round(h / 2), Math.ceil(strokeRect.y1 / 2)),
    }
    const half = new MergePass(gl, w, h, { iterations: chosen, coreSkip: false, seeded: false }, 2, raw.LINEAR)
    half.adoptInputs(pass.inputTextures)
    configure(half)
    half.bindUniforms()
    const resolve = new ResolvePass(gl, w, h)
    resolve.adoptInputs(pass.inputTextures)
    configure(resolve)
    resolve.bindUpsample(half.outTexA, half.outTexB)
    resolve.bindUniforms()

    // Two programs, so each draw must re-bind its own uniforms (the production
    // path pays the same bind once per stroke end).
    const submitHalf = () => {
      half.bindUniforms(); half.drawOnce(halfRect)
      resolve.bindUniforms(); resolve.drawOnce(strokeRect)
    }
    const halfLatency = latencyOf(submitHalf, () => resolve.fence(), 10)
    const halfFirstDab = {
      immediate: firstDabRead(submitHalf, () => resolve.fence(), raw, 0, 10),
      after50ms: firstDabRead(submitHalf, () => resolve.fence(), raw, 50, 6),
    }
    const halfFelt = r2(Math.max(0, halfFirstDab.immediate.median - fenceOnly.median))
    variants.halfResolve = {
      halfRect,
      halfPixels: (halfRect.x1 - halfRect.x0) * (halfRect.y1 - halfRect.y0),
      iterations: chosen,
      latency: halfLatency,
      feltDelay: {
        immediate: halfFelt,
        after50ms: r2(Math.max(0, halfFirstDab.after50ms.median - fenceOnly.median)),
      },
      derived: { immediate: halfLatency.median, after50ms: r2(Math.max(0, halfLatency.median - 50)) },
    }
    candidates.push({
      name: 'half-resolve-4it',
      reader: resolve,
      feltMs: halfFelt,
      redraw: () => { submitHalf(); resolve.fence() },
    })

    // --- Variant R: the rank-one Jacobian, on the same pass -----------------
    // bandOf depends on the 7 coefficients only through the scalar A, so the
    // 8x16 Jacobian is rank-1 there: two perturbed evaluations replace eight.
    pass.rankOneJ = true
    pass.bindUniforms()
    const rankOneLatency = latencyOf(() => pass.drawOnce(strokeRect), () => pass.fence(), 12)
    const rankOneFirstDab = {
      immediate: firstDabRead(() => pass.drawOnce(strokeRect), () => pass.fence(), raw, 0, 10),
      after50ms: firstDabRead(() => pass.drawOnce(strokeRect), () => pass.fence(), raw, 50, 6),
    }
    const rankOneFelt = r2(Math.max(0, rankOneFirstDab.immediate.median - fenceOnly.median))
    variants.rankOneJ = {
      iterations: chosen,
      latency: rankOneLatency,
      feltDelay: {
        immediate: rankOneFelt,
        after50ms: r2(Math.max(0, rankOneFirstDab.after50ms.median - fenceOnly.median)),
      },
      derived: { immediate: rankOneLatency.median, after50ms: r2(Math.max(0, rankOneLatency.median - 50)) },
    }
    candidates.push({
      name: 'rank-one-jacobian-4it',
      reader: pass,
      feltMs: rankOneFelt,
      redraw: () => { pass.rankOneJ = true; pass.bindUniforms(); pass.drawOnce(strokeRect); pass.fence() },
    })
  }

  // The target bands do not depend on the encoder: compute them once for the
  // whole rect, then every candidate is judged against the same array.
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
        const target = law.targetBand(layerTmp, baseTmp, aEff)
        const i = ry * rw + rx
        tAeff[i] = aEff
        tRgb[i * 3] = target.rgb8[0]!
        tRgb[i * 3 + 1] = target.rgb8[1]!
        tRgb[i * 3 + 2] = target.rgb8[2]!
      }
    }
  }

  const measureResidual = (reader: Reader) => {
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
        if (d > THRESHOLD.residualChannel8) over++
        n++
        const aEff = tAeff[o]!
        const bin = bins.find((bb) => aEff >= bb.lo && aEff < bb.hi)
        if (bin) {
          bin.n++
          bin.sum += d
          if (d > bin.max) bin.max = d
          if (d > THRESHOLD.residualChannel8) bin.over++
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

  const residuals = candidates.map((c) => {
    c.redraw()
    return { name: c.name, feltMs: c.feltMs, ...measureResidual(c.reader) }
  })
  const passing = residuals.filter((x) => x.feltMs < THRESHOLD.immediateStartMs && x.maxChannel <= THRESHOLD.residualChannel8)
  const bestResidual = passing.length
    ? passing.slice().sort((x, y) => x.feltMs - y.feltMs)[0]!
    : residuals[0]!
  const best = candidates.find((c) => c.name === bestResidual.name)!
  const residual = bestResidual

  // --- F. Q4 parity, only if Q3b passed ------------------------------------
  const q3bPass = passing.length > 0
  const q4: Record<string, unknown> | null = q3bPass ? (() => {
    const digestOf = (sheet: SheetState) => {
      let hash = 0
      for (let i = 0; i < sheet.a.length; i += 37) hash = (hash * 31 + Math.round(sheet.a[i]! * 1024)) >>> 0
      for (let i = 0; i < sheet.b.length; i += 97) hash = (hash * 31 + Math.round(sheet.b[i]! * 1024)) >>> 0
      for (let i = 0; i < sheet.s.length; i += 397) hash = (hash * 31 + Math.round(sheet.s[i]! * 1024)) >>> 0
      return hash.toString(16)
    }

    // The merged sheet: the fitted state inside the rect, the base elsewhere,
    // and the coverage union the engine's cover pass would produce.
    const merged = copySheet(S_A)
    const aFit = best.reader.readA(strokeRect)
    const bFit = best.reader.readB(strokeRect)
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

    // (a) live vs merged over EVERY covered texel (Q3 sampled at stride 3-5).
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
        if (cov <= 0) continue // outside the stroke: the merge copies the base exactly
        stateInto(mergedTmp, merged, x, y)
        const got = law.stateRgb8(mergedTmp)
        const want: [number, number, number] = [tRgb[o * 3]!, tRgb[o * 3 + 1]!, tRgb[o * 3 + 2]!]
        const d = Math.max(Math.abs(got[0] - want[0]), Math.abs(got[1] - want[1]), Math.abs(got[2] - want[2]))
        if (d > maxC) { maxC = d; worst = { at: [x, y], aEff: Number(tAeff[o]!.toFixed(3)), got, want } }
        sumC += d
        hist[d] = hist[d]! + 1
        if (d > THRESHOLD.residualChannel8) over++
        n++
        // in the fade band the result must lie between the under-stroke and the layer
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

    // (c) capture parity: the merged sheet through the capture/restore round trip.
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

    // (d) bake replay: the whole chain again, from a wiped sheet.
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
        bar: THRESHOLD.residualChannel8,
        pass: maxC <= THRESHOLD.residualChannel8,
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
    mergeLatencyPass: mergeLatency.median < 250,
    immediateStartPass: q3bPass,
    baselineImmediateFeltMs: feltDelay.immediate,
    after50msPass: feltDelay.after50ms < THRESHOLD.after50Ms,
    after200msPass: feltDelay.after200ms < THRESHOLD.after200Ms,
    displayFitsFrame: displayCost.twoStates!.median <= THRESHOLD.displayWithLayerMs,
    memoryPass: (memory.addedMiB as number) <= THRESHOLD.memoryAddedMb,
    bestCandidate: best.name,
    bestFeltMs: best.feltMs,
    bestResidualMax: residual.maxChannel,
    q3bPass,
    q4Pass: q4 ? ((q4.liveVsMerged as { pass: boolean }).pass && (q4.captureParity as { digestEqual: boolean }).digestEqual && (q4.bakeReplay as { pass: boolean }).pass) : null,
  }

  return {
    spike: '006',
    scenario: 'q3b',
    query: { requested: REQUESTED, sheet: w, paperSeed: PAPER_SEED, start: START, amount: AMOUNT, falloff: FALLOFF },
    threshold: THRESHOLD,
    renderer,
    bakeMs,
    sheet: { requested: REQUESTED, actual: w, pixels: w * h },
    geometry: { strokeRect, strokePixels, centreX: geomB.centreX, halfWidth: geomB.halfWidth },
    A_mergeLatency: {
      budget: chosen,
      singleDrawAfterIdle: mergeLatency,
      throughputMs: r2(throughput),
      budget12: mergeLatency12,
      fenceOnly,
      sizeLadder,
    },
    B_firstDab: { ...firstDab, feltDelayMs: feltDelay, derivedMs: derived },
    C_display: { cost: displayCost, marginalMs: displayMarginal, barMs: THRESHOLD.displayWithLayerMs },
    D_memory: memory,
    E_variants: variants,
    residual,
    residuals,
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
