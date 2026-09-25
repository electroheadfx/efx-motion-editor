// ============================================================
//  260924-pyp — Production-AA substrate settle measurement
//
//  Substrate path: production geometry + production layer schedule +
//  analytic coverage fill (real Canvas2D unavailable headless — no
//  OffscreenCanvas/node-canvas; installs forbidden) — 260924-pyp.
//
//  Measurement only. This harness derives the raster profile from the
//  real rasterizer's own inputs:
//    - production ribbon()/deformN()/deform() geometry imported from
//      brush/stroke.ts (straight dense stroke x 16..112 step 3, y 32,
//      Math.random stubbed by an LCG seed for PIN 3 determinism —
//      precedent: paint.continuation.test.ts run());
//    - production layer-accumulation schedule mirrored from
//      createPaintStrokeRasterContinuationFromCurve's pickup-0 branch
//      (layers = round((22+15)/speedDeplete), lAlpha = min(0.08, 3/layers),
//      the extra round(layers*0.2) soft passes at lAlpha*0.25);
//      bristle traces are EXCLUDED (non-geometric low-alpha strokes that
//      would pin on RNG call order, not on the ribbon fringe we measure);
//      flat layer fills throughout (260925-dso: production deleted the
//      even-layer grain modulation and the paper-emboss pass).
//    - ONLY the Canvas2D fill primitive is replaced by analytic
//      sub-pixel polygon coverage (nonzero-winding scanline, 16 y
//      sub-samples/pixel with exact x-span coverage) — that primitive
//      is exactly what Canvas2D antialiasing approximates. The result
//      is production's continuous AA fringe alpha ramp at the polygon
//      edges.
//
//  NEVER the synthetic graduated 160/110/60 ramp as substrate (that
//  ramp lives only in physicsSettledFootprint.test.ts for 260924-ort).
//  Sanity test rejects binary profiles and literal-ramp profiles.
//
//  Pipeline (all REAL production code, zero production edits):
//    profile → [Task 2: in-harness tier filter — zero profile alpha <
//    tier before transfer ≡ raising transferToWetLayerClipped's keep-gate,
//    exact because `a` is read only after the gate] → real
//    transferToWetLayerClipped (base keep-gate 20, unchanged) → copy
//    buffers → real localFluidPhysicsStep K = max(1, ceil(spreadCurveFor(50)*10)) = 1
//    ticks with engineLocalBbox
//    → widths via widthFromAlpha / widthVisible / wetDisplayAlpha at MID_X.
//
//  PIN 0: body deposit unmodulated — ratio ∈ [0.99, 1.01] of
//  (profileAlpha/255)*3000 × transferCount (x documented D-08 adsorption
//  factor when paper present — recomputed, never read back). PIN 0b:
//  post-settle body means ≥ 0.95× this substrate's own base-tier
//  (gate 20) BASE literals — floors never loosened. Bounds are HARD:
//  violations are recorded as `STOP finding` lines, never edited to pass.
//
//  Threat T-pyp-SC: no package installs (no node-canvas/skia-canvas).
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createWetBuffers, transferToWetLayerClipped } from './wet-layer'
import { localFluidPhysicsStep } from './fluids'
import { wetDisplayAlpha } from '../render/compositor'
import { sampleH } from './paper'
import { ribbon, deform, deformN } from '../brush/stroke'
import { curveBounds } from '../util/math'
import { spreadCurveFor } from './spreadScale'
import type { FluidConfig, PenPoint, WetBuffers } from '../types'

// === Engine-mirrored defaults (EfxPaintEngine) ===
const CANVAS_W = 128
const CANVAS_H = 64
const MID_X = 64
const MID_Y = 32
/** brushRenderRadius(default size 6) = max(0.5, 6/2) = 3 */
const BRUSH_RADIUS = 3
/** Preview ribbon contract: width = 2 * radius at uniform pressure */
const RIBBON_W = 2 * BRUSH_RADIUS
/** Envelope bound: 2r + 2px antialiasing tolerance (PIN 1 contract) */
const ENVELOPE_BOUND = RIBBON_W + 2 // = 8
/** localSpreadStrength 50 → spreadCurveFor(50) = 0.09 (260925-b7c) → ticks = max(1, ceil(0.9)) = 1 */
const SPREAD_STRENGTH = 50
const K_TICKS = Math.max(1, Math.ceil(spreadCurveFor(SPREAD_STRENGTH) * 10))
/**
 * 260925-b7c texture law (user decision 2026-09-25): the rm2 texture gate
 * asserts texture presence at the spread-ENGAGING setting — Spread 80 →
 * spreadCurveFor(80) = 0.636 → K = max(1, ceil(6.36)) = 7 ticks — never at
 * the preview-matched default (default K = 1 leaves d(b) = 0 by design:
 * new 50 = old-30 physics). The d(b) >= 1 assertion is unchanged; every
 * other gate (envelope, PIN 0/0b) stays at the default Spread 50.
 */
const TEXTURE_SPREAD_STRENGTH = 80
const TEXTURE_K_TICKS = Math.max(1, Math.ceil(spreadCurveFor(TEXTURE_SPREAD_STRENGTH) * 10))
/** Engine fluidConfig defaults (D-13 / D-02 / D-03) */
const FLUID_CONFIG: FluidConfig = { viscosity: 0.0001, omega_h: 0.06, darkening: 0.1 }

// === Measurement thresholds (calibrated — same floors as m7w/nqe/ort) ===
/** Visible threshold: ~5% of 255 */
const VISIBLE_THRESH = 13
/** Raw-density floor equivalent to VISIBLE_THRESH through wetDisplayAlpha */
const ALPHA_FLOOR = 125

// === Sweep cells ===
const WATERS = [10, 50, 90] as const
const PAPERS = ['null', 'synthetic'] as const
/**
 * Cutoff tiers applied in-harness (zero profile alpha < tier before
 * transfer — equivalent to raising transferToWetLayerClipped's keep-gate;
 * `a` is read only after the gate for deposit math and wetness, so
 * included pixels keep byte-identical base math). 20 = base keep-gate.
 */
const TIERS = [20, 200, 130, 70] as const
const DENSE_SPACING = 3
/** One production transfer per cell (mirrors a single finalize transfer) */
const TRANSFER_COUNT = 1

// === Substrate constants (mirrored from paint.ts pickup-0 branch) ===
/** LCG seed for deform RNG determinism (paint.continuation.test.ts precedent) */
const PROFILE_SEED = 123456789
/**
 * Production variance: (1.5 + sqrt(radius) * 0.9) * edgeMul where edgeMul =
 * edgeDetail / 50. The ENGINE's default brushOpts.edgeDetail is 4
 * (EfxPaintEngine initial state) — the value renderPaintStroke receives at
 * finalize — so edgeMul = 4/50 = 0.08. (paint.ts's `?? 50` fallback only
 * applies when edgeDetail is null, which the engine never passes.)
 */
const ENGINE_EDGE_DETAIL = 4
const VARIANCE = (1.5 + Math.sqrt(BRUSH_RADIUS) * 0.9) * (ENGINE_EDGE_DETAIL / 50)
/** Scanline sub-samples per pixel row (analytic x-span coverage exact) */
const SS = 16

interface Profile {
  bounds: { x0: number; y0: number; w: number; h: number }
  data: Uint8ClampedArray // RGBA, bounds.w * bounds.h * 4
}

interface CellResult {
  paper: string
  water: number
  tier: number
  W_deposit: number
  W_settle: number
  W_visible: number
  pin0_min: number
  pin0_max: number
  pin0b_alpha: number
  pin0b_display: number
}

// === Copied small helpers (NOT imported from physicsSettledFootprint.test.ts —
//     importing that file would register its suites in this run) ===

function makeCurve(spacing: number): PenPoint[] {
  const pts: PenPoint[] = []
  for (let x = 16; x <= 112; x += spacing) {
    pts.push({ x, y: MID_Y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 })
  }
  return pts
}

/** Deterministic pseudo-noise height map in [0, 1] (no RNG — pin 3 needs it) */
function makeSyntheticPaper(): Float32Array {
  const h = new Float32Array(CANVAS_W * CANVAS_H)
  for (let y = 0; y < CANVAS_H; y++) {
    for (let x = 0; x < CANVAS_W; x++) {
      const v = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
      h[y * CANVAS_W + x] = v
    }
  }
  return h
}

const STROKE = { x0: 16, x1: 112, y: MID_Y }

/**
 * Engine local-mode bbox (applyStrokeToEngine / stepInteractivePaintFinalization):
 *   margin = ceil(2 + waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4)
 */
function engineLocalBbox(curve: PenPoint[], water01: number, spreadStrength: number = SPREAD_STRENGTH) {
  let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
  for (const p of curve) {
    sx0 = Math.min(sx0, p.x); sy0 = Math.min(sy0, p.y)
    sx1 = Math.max(sx1, p.x); sy1 = Math.max(sy1, p.y)
  }
  const waterCurve = water01 * water01
  const spreadCurve = spreadCurveFor(spreadStrength)
  const margin = Math.ceil(2 + waterCurve * BRUSH_RADIUS * 0.6 + spreadCurve * BRUSH_RADIUS * 0.4)
  return {
    x0: Math.max(0, Math.floor(sx0 - BRUSH_RADIUS - margin)),
    y0: Math.max(0, Math.floor(sy0 - BRUSH_RADIUS - margin)),
    x1: Math.min(CANVAS_W - 1, Math.ceil(sx1 + BRUSH_RADIUS + margin)),
    y1: Math.min(CANVAS_H - 1, Math.ceil(sy1 + BRUSH_RADIUS + margin)),
  }
}

/** Column cross-section width: pixels with raw alpha at/above ALPHA_FLOOR */
function widthFromAlpha(wet: WetBuffers, col: number): number {
  let count = 0
  for (let y = 0; y < CANVAS_H; y++) {
    if (wet.alpha[y * CANVAS_W + col] >= ALPHA_FLOOR) count++
  }
  return count
}

/** Column cross-section width at display visibility (compositeWetLayer gates). */
function widthVisible(wet: WetBuffers, col: number, paper: Float32Array | null): number {
  let count = 0
  for (let y = 0; y < CANVAS_H; y++) {
    const i = y * CANVAS_W + col
    if (wet.alpha[i] < 1) continue
    const so = wet.strokeOpacity[i] || 0
    if (so < 0.001) continue
    const h = sampleH(paper, col, y, CANVAS_W, CANVAS_H)
    if (wetDisplayAlpha(wet.alpha[i], so, h) >= VISIBLE_THRESH) count++
  }
  return count
}

// === Analytic coverage fill (replaces ONLY ctx.fill()) ===

function accumulateOverlap(row: Float32Array, from: number, to: number, w: number): void {
  if (!(to > from)) return
  const a = Math.max(0, from)
  const b = Math.min(w, to)
  if (b <= a) return
  const px0 = Math.floor(a)
  const px1 = Math.ceil(b) - 1
  for (let px = px0; px <= px1; px++) {
    const o = Math.min(b, px + 1) - Math.max(a, px)
    if (o > 0) row[px] += o
  }
}

/**
 * Source-over composite one polygon's analytic coverage onto the profile
 * buffer (float alpha 0..1). Nonzero-winding scanline: SS y sub-samples
 * per pixel row, exact x-span overlap per sub-sample.
 */
function compositePolygon(
  buf: Float32Array,
  poly: Array<[number, number]>,
  bounds: { x0: number; y0: number; w: number; h: number },
  layerAlpha: number,
): void {
  if (poly.length < 3) return
  let yMin = Infinity, yMax = -Infinity
  for (const p of poly) {
    if (p[1] < yMin) yMin = p[1]
    if (p[1] > yMax) yMax = p[1]
  }
  const ly0 = Math.max(0, Math.floor(yMin - bounds.y0))
  const ly1 = Math.min(bounds.h - 1, Math.ceil(yMax - bounds.y0))
  const edges: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    edges.push(a[0], a[1], b[0], b[1])
  }
  const rowCov = new Float32Array(bounds.w)
  for (let ly = ly0; ly <= ly1; ly++) {
    rowCov.fill(0)
    const gy = bounds.y0 + ly
    for (let sy = 0; sy < SS; sy++) {
      const yy = gy + (sy + 0.5) / SS
      const cx: number[] = []
      const cd: number[] = []
      for (let e = 0; e < edges.length; e += 4) {
        const y0 = edges[e + 1], y1 = edges[e + 3]
        let dir = 0
        if (y0 <= yy && yy < y1) dir = 1
        else if (y1 <= yy && yy < y0) dir = -1
        if (dir === 0) continue
        const t = (yy - y0) / (y1 - y0)
        cx.push(edges[e] + t * (edges[e + 2] - edges[e]))
        cd.push(dir)
      }
      if (cx.length === 0) continue
      const order = cx.map((_, i) => i).sort((a, b) => cx[a] - cx[b])
      let winding = 0
      let start = NaN
      for (const idx of order) {
        const prev = winding
        winding += cd[idx]
        if (prev === 0 && winding !== 0) start = cx[idx]
        else if (prev !== 0 && winding === 0) {
          accumulateOverlap(rowCov, start - bounds.x0, cx[idx] - bounds.x0, bounds.w)
        }
      }
    }
    for (let lx = 0; lx < bounds.w; lx++) {
      const c = rowCov[lx] / SS
      if (c <= 0) continue
      let src = c * layerAlpha
      if (src <= 0) continue
      const i = ly * bounds.w + lx
      buf[i] = src + buf[i] * (1 - src)
    }
  }
}

/**
 * Build the production-AA profile: ribbon(curve, 3, 0.8, false) →
 * deformN depth 4 → production layer schedule → analytic coverage fills.
 * Deterministic under the LCG stub (gauss in deform/deformN reads
 * Math.random only during this build).
 */
function buildProfile(): Profile {
  const curve = makeCurve(DENSE_SPACING)
  const bounds = curveBounds(curve, BRUSH_RADIUS + VARIANCE * 5, CANVAS_W, CANVAS_H)
  const buf = new Float32Array(bounds.w * bounds.h)
  let seed = PROFILE_SEED
  const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 0x100000000
  })
  try {
    const base = ribbon(curve, BRUSH_RADIUS, 0.8, false)
    const baseD = deformN(base, 4, VARIANCE)
    // pickup-0 branch schedule: speedDeplete = 1 (no pen input)
    const layers = Math.round((22 + 15) / 1)
    const lAlpha = Math.min(0.08, 3 / layers)
    for (let i = 0; i < layers; i++) {
      const v = deform(baseD, VARIANCE * 0.2)
      // every layer flat-fills (260925-dso: grain/emboss passes deleted)
      compositePolygon(buf, v, bounds, lAlpha)
    }
    // soft passes: round(layers * 0.2) at lAlpha * 0.25 (fillFlat)
    const soft = Math.round(layers * 0.2)
    for (let i = 0; i < soft; i++) {
      const v = deform(baseD, VARIANCE * 0.5)
      compositePolygon(buf, v, bounds, lAlpha * 0.25)
    }
    // bristle traces EXCLUDED (documented in header)
  } finally {
    spy.mockRestore()
  }
  const data = new Uint8ClampedArray(bounds.w * bounds.h * 4)
  for (let i = 0; i < buf.length; i++) {
    const pi = i * 4
    data[pi] = 255
    data[pi + 1] = 0
    data[pi + 2] = 0
    data[pi + 3] = Math.round(Math.min(1, Math.max(0, buf[i])) * 255)
  }
  return { bounds, data }
}

let profileCache: Profile | null = null
function getProfile(): Profile {
  if (!profileCache) profileCache = buildProfile()
  return profileCache
}

/** In-harness tier filter: zero profile alpha < tier before transfer. */
function applyTier(profile: Profile, tier: number): Profile {
  if (tier <= 20) return profile // base keep-gate 20 admitted by transfer itself
  const data = new Uint8ClampedArray(profile.data) // copy — never mutate the cache
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < tier) data[i] = 0
  }
  return { bounds: profile.bounds, data }
}

// === Body derivation (from the profile, never hardcoded rows) ===

interface BodyState {
  col: number[] // alpha per ly at MID_X
  plateau: number
  threshold: number
  rows: number[] // ly indices — coverage-saturated polygon interior
}

function bodyState(profile: Profile): BodyState {
  const lx = MID_X - profile.bounds.x0
  const col: number[] = []
  for (let ly = 0; ly < profile.bounds.h; ly++) {
    col.push(profile.data[(ly * profile.bounds.w + lx) * 4 + 3])
  }
  const plateau = Math.max(...col)
  // coverage-saturated interior derived from the profile's own plateau
  // (plan: "coverage-saturated, e.g. >= 245" — threshold follows the
  // measured plateau, rows are never hardcoded)
  const threshold = Math.max(200, Math.floor(plateau * 0.96))
  const rows: number[] = []
  for (let ly = 0; ly < col.length; ly++) {
    if (col[ly] >= threshold) rows.push(ly)
  }
  return { col, plateau, threshold, rows }
}

// === PIN 0 expectation ===

/**
 * Unmodulated deposit expectation for a body pixel after ONE transfer.
 * paper=null → exact (profileAlpha/255)*3000.
 * paper present → times the documented D-08 adsorption factor
 * max(floor, adsorption) recomputed from paper height (wetness = 0 at
 * first transfer; floor = userOpacity^2 = 1). Production reads this
 * same formula inside transferToWetLayerClipped — the pin still detects
 * any tier/water alpha modulation because the factor is recomputed here,
 * never read back from the deposit.
 */
function expectedDeposit(profileAlpha: number, gx: number, gy: number, paper: Float32Array | null): number {
  let expected = (profileAlpha / 255) * 3000 * TRANSFER_COUNT
  if (paper) {
    const h = sampleH(paper, gx, gy, CANVAS_W, CANVAS_H)
    const adsorption = (1 - 0) * (1 - h * 0.8) * 1.2 // wFrac = 0, gamma 0.8, delta 1.2
    expected *= Math.max(1, adsorption)
  }
  return expected
}

// === Cell runner (real pipeline) ===

function runCell(
  tier: number,
  water01: number,
  paper: Float32Array | null,
  spreadStrength: number = SPREAD_STRENGTH,
  ticks: number = K_TICKS,
): { deposit: WetBuffers; settled: WetBuffers; widths: { W_deposit: number; W_settle: number; W_visible: number } } {
  const profile = applyTier(getProfile(), tier)
  const imageData = { data: profile.data, width: profile.bounds.w, height: profile.bounds.h }
  const fakeOffCtx = { getImageData: () => imageData }
  // production bounds shape: { x, y, w, h } (curveBounds returns x0/y0)
  const transferBounds = { x: profile.bounds.x0, y: profile.bounds.y0, w: profile.bounds.w, h: profile.bounds.h }
  const curve = makeCurve(DENSE_SPACING)
  const wet = createWetBuffers(CANVAS_W * CANVAS_H)
  transferToWetLayerClipped(
    fakeOffCtx as never, wet, water01, transferBounds, CANVAS_W, CANVAS_H, paper,
  )
  const W_deposit = widthFromAlpha(wet, MID_X)

  const settled = createWetBuffers(CANVAS_W * CANVAS_H)
  settled.r.set(wet.r); settled.g.set(wet.g); settled.b.set(wet.b)
  settled.alpha.set(wet.alpha); settled.wetness.set(wet.wetness)
  settled.strokeOpacity.set(wet.strokeOpacity)

  localFluidPhysicsStep(
    settled, FLUID_CONFIG, CANVAS_W, CANVAS_H,
    engineLocalBbox(curve, water01, spreadStrength), ticks,
  )
  const W_settle = widthFromAlpha(settled, MID_X)
  const W_visible = widthVisible(settled, MID_X, paper)
  return { deposit: wet, settled, widths: { W_deposit, W_settle, W_visible } }
}

function pin0RatioRange(
  deposit: WetBuffers,
  profile: Profile,
  body: BodyState,
  paper: Float32Array | null,
): { min: number; max: number } {
  const lx = MID_X - profile.bounds.x0
  let min = Infinity
  let max = -Infinity
  for (const ly of body.rows) {
    const gy = profile.bounds.y0 + ly
    const a = profile.data[(ly * profile.bounds.w + lx) * 4 + 3]
    const expected = expectedDeposit(a, MID_X, gy, paper)
    const ratio = deposit.alpha[gy * CANVAS_W + MID_X] / expected
    if (ratio < min) min = ratio
    if (ratio > max) max = ratio
  }
  return { min, max }
}

function bodyMeans(settled: WetBuffers, profile: Profile, body: BodyState, paper: Float32Array | null): { alpha: number; display: number } {
  let sumA = 0
  let sumD = 0
  for (const ly of body.rows) {
    const gy = profile.bounds.y0 + ly
    const i = gy * CANVAS_W + MID_X
    sumA += settled.alpha[i]
    const h = sampleH(paper, MID_X, gy, CANVAS_W, CANVAS_H)
    sumD += wetDisplayAlpha(settled.alpha[i], settled.strokeOpacity[i] || 0, h)
  }
  const n = Math.max(1, body.rows.length)
  return { alpha: sumA / n, display: sumD / n }
}

// === PIN 0b base literals (260924-pyp production-AA base) ===
/**
 * Base-calibrated body means after K settle ticks at the base tier
 * (keep-gate 20), measured on THIS substrate (production geometry +
 * production layer schedule + analytic coverage fill) at Task-1 RED of
 * 260924-pyp (2026-09-24). Floors = 0.95 x these values: catch body
 * opacity destroyed anywhere between deposit and display. These literals
 * are the 260924-pyp production-AA base and may NEVER be loosened to go
 * green. Keyed `${water}|${paper}`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_BODY_MEAN_ALPHA: Record<string, number> = {
  '10|null': 2832.80, '10|synthetic': 2867.09,
  '50|null': 2832.80, '50|synthetic': 2867.09,
  '90|null': 2849.31, '90|synthetic': 2915.98,
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_BODY_MEAN_DISPLAY: Record<string, number> = {
  '10|null': 255.00, '10|synthetic': 255.00,
  '50|null': 255.00, '50|synthetic': 255.00,
  '90|null': 255.00, '90|synthetic': 255.00,
}

const STOP_FINDINGS: string[] = []

function measureCells(
  tiers: readonly number[],
  spreadStrength: number = SPREAD_STRENGTH,
  ticks: number = K_TICKS,
): CellResult[] {
  const profile = getProfile()
  const body = bodyState(profile)
  const results: CellResult[] = []
  for (const tier of tiers) {
    const tiered = applyTier(profile, tier)
    for (const water of WATERS) {
      for (const paperKind of PAPERS) {
        const paper = paperKind === 'synthetic' ? makeSyntheticPaper() : null
        const { deposit, settled, widths } = runCell(tier, water / 100, paper, spreadStrength, ticks)
        const pin0 = pin0RatioRange(deposit, tiered, body, paper)
        const means = bodyMeans(settled, profile, body, paper)
        results.push({
          paper: paperKind,
          water,
          tier,
          ...widths,
          pin0_min: pin0.min,
          pin0_max: pin0.max,
          pin0b_alpha: means.alpha,
          pin0b_display: means.display,
        })
      }
    }
  }
  return results
}

function logTable(mark: string, results: CellResult[]): void {
  const header = [
    'paper', 'water', 'tier',
    'W_deposit', 'W_settle', 'W_visible', 'd(b)',
    'PIN0_min', 'PIN0_max',
    'PIN0b_meanAlpha', 'PIN0b_meanDisplay',
    'envelope<=8',
  ].join('\t')
  const rows = results.map(r => [
    r.paper, String(r.water), String(r.tier),
    String(r.W_deposit), String(r.W_settle), String(r.W_visible),
    String(r.W_settle - r.W_deposit),
    r.pin0_min.toFixed(4), r.pin0_max.toFixed(4),
    r.pin0b_alpha.toFixed(2), r.pin0b_display.toFixed(2),
    r.W_visible <= ENVELOPE_BOUND ? 'PASS' : 'FAIL',
  ].join('\t'))
  console.log(`\n[${mark}] r=${BRUSH_RADIUS} 2r=${RIBBON_W} K=${K_TICKS} visible>=${VISIBLE_THRESH} alphaFloor=${ALPHA_FLOOR} envelope=${ENVELOPE_BOUND}`)
  console.log([header, ...rows].join('\n'))
}

function checkPinGates(results: CellResult[], assertMode: boolean): void {
  for (const r of results) {
    const key = `${r.water}|${r.paper}`
    const baseA = BASE_BODY_MEAN_ALPHA[key]
    const baseD = BASE_BODY_MEAN_DISPLAY[key]
    const floorA = 0.95 * baseA
    const floorD = 0.95 * baseD
    if (r.pin0_min < 0.99 || r.pin0_max > 1.01) {
      const line = `STOP finding: tier=${r.tier} water=${r.water} paper=${r.paper} PIN 0 moved (min=${r.pin0_min.toFixed(4)} max=${r.pin0_max.toFixed(4)})`
      STOP_FINDINGS.push(line)
      console.log(`[260924-pyp] ${line}`)
      if (assertMode) expect(r.pin0_min, line).toBeGreaterThanOrEqual(0.99)
      if (assertMode) expect(r.pin0_max, line).toBeLessThanOrEqual(1.01)
    }
    if (r.pin0b_alpha < floorA || r.pin0b_display < floorD) {
      const line = `STOP finding: tier=${r.tier} water=${r.water} paper=${r.paper} PIN 0b moved (alpha=${r.pin0b_alpha.toFixed(2)} < ${floorA.toFixed(2)} or display=${r.pin0b_display.toFixed(2)} < ${floorD.toFixed(2)})`
      STOP_FINDINGS.push(line)
      console.log(`[260924-pyp] ${line}`)
      if (assertMode) expect(r.pin0b_alpha, line).toBeGreaterThanOrEqual(floorA)
      if (assertMode) expect(r.pin0b_display, line).toBeGreaterThanOrEqual(floorD)
    }
  }
}

// ============================================================

describe('260924-pyp production-AA substrate — sanity', () => {
  it('profile is a continuous multi-value AA fringe (not binary, not the 160/110/60 ramp)', () => {
    const profile = getProfile()
    const body = bodyState(profile)
    console.log(
      `[260924-pyp] substrate: bounds=${profile.bounds.x0},${profile.bounds.y0} ${profile.bounds.w}x${profile.bounds.h} ` +
      `plateau=${body.plateau} threshold=${body.threshold} bodyRows(ly)=${body.rows.join(',')} ` +
      `substrate=production ribbon/deform + production layer schedule + analytic coverage fill`,
    )
    console.log(`[260924-pyp] MID_X column: ${body.col.map((a, i) => `${profile.bounds.y0 + i}:${a}`).filter((_, i) => body.col[i] > 0).join(' ')}`)
    // coverage-saturated interior exists and is near-opaque
    expect(body.plateau, 'interior plateau must be coverage-saturated (>= 240)').toBeGreaterThanOrEqual(240)
    expect(body.rows.length, 'body must be a plausible ribbon cross-section (4..10 rows)').toBeGreaterThanOrEqual(4)
    expect(body.rows.length).toBeLessThanOrEqual(10)
    // not binary: MID_X column must show > 2 distinct nonzero alphas
    const distinct = new Set(body.col.filter(a => a > 0))
    expect(distinct.size, `MID_X column must show > 2 distinct alphas, got ${distinct.size}`).toBeGreaterThan(2)

    // Continuous multi-value AA fringe per side: from the body mid-row out
    // to zero, the top side must show >= 3 distinct sub-255 alpha levels
    // and the bottom side >= 2. (The synthetic 160/110/60 ramp is rejected
    // explicitly below; binary rejection also rides on MID_X distinct > 2
    // and the band richness floor.)
    // 260925-dso recalibration: with the in-harness grain replication gone,
    // the bottom side measures [65,245] (was [63,243,244] with grain — the
    // third level was grain's +/-1 plateau jitter 243 vs 244, deleted with
    // the pass); law intent (graduated fringe, not a hard cut) unchanged.
    const first = body.rows[0]
    const last = body.rows[body.rows.length - 1]
    const mid = body.rows[Math.floor(body.rows.length / 2)]
    const topLevels = [...new Set(body.col.slice(0, mid + 1).filter(a => a > 0 && a < 255))].sort((a, b) => a - b)
    const bottomLevels = [...new Set(body.col.slice(mid).filter(a => a > 0 && a < 255))].sort((a, b) => a - b)
    const topFringe = [...new Set(body.col.slice(0, first).filter(a => a > 0))].sort((a, b) => a - b)
    const bottomFringe = [...new Set(body.col.slice(last + 1).filter(a => a > 0))].sort((a, b) => a - b)
    console.log(
      `[260924-pyp] AA fringe: topSide=[${topLevels.join(',')}] bottomSide=[${bottomLevels.join(',')}] ` +
      `topFringeRows=[${topFringe.join(',')}] bottomFringeRows=[${bottomFringe.join(',')}]`,
    )
    expect(
      topLevels.length,
      `top side must show >= 3 distinct sub-255 alpha levels (binary profile), got [${topLevels.join(',')}]`,
    ).toBeGreaterThanOrEqual(3)
    expect(
      bottomLevels.length,
      `bottom side must show >= 2 distinct sub-255 alpha levels (binary profile), got [${bottomLevels.join(',')}]`,
    ).toBeGreaterThanOrEqual(2)
    // fringe rows exist outside the body on both sides (AA edge, not hard cut)
    expect(topFringe.length, 'top side must have at least one fringe row outside the body').toBeGreaterThanOrEqual(1)
    expect(bottomFringe.length, 'bottom side must have at least one fringe row outside the body').toBeGreaterThanOrEqual(1)
    // never the synthetic graduated ramp as substrate
    const rampLiteral = new Set([60, 110, 160])
    const isLiteralRamp = (v: number[]) => v.length > 0 && v.every(a => rampLiteral.has(a))
    expect(
      isLiteralRamp(topLevels) && isLiteralRamp(bottomLevels),
      'profile must not be the synthetic 160/110/60 ramp',
    ).toBe(false)
    // whole-stroke edge band richness (deform sub-pixel positions):
    // several distinct intermediate alphas across the stroke's edges
    const band = new Set<number>()
    for (let i = 3; i < profile.data.length; i += 4) {
      const a = profile.data[i]
      if (a > 0 && a < body.threshold) band.add(a)
    }
    console.log(`[260924-pyp] edge-band distinct alphas (0<a<threshold): ${band.size}`)
    expect(band.size, `whole-stroke edge band must be multi-value, got ${band.size} distinct alphas`).toBeGreaterThanOrEqual(6)
  })
})

describe('260924-pyp production-AA substrate — base tier (keep-gate 20)', () => {
  it('determinism (PIN 3): identical builds → identical profile and settled alpha digests', () => {
    const a = buildProfile()
    const b = buildProfile()
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
    const runA = runCell(20, 0.5, null)
    const runB = runCell(20, 0.5, null)
    expect(Array.from(runA.deposit.alpha)).toEqual(Array.from(runB.deposit.alpha))
    expect(Array.from(runA.settled.alpha)).toEqual(Array.from(runB.settled.alpha))
    console.log('[260924-pyp] determinism (PIN 3): profile + deposit + settled digests identical across runs')
  })

  it('base-tier outcome table: 3 waters × 2 papers with PIN 0 / PIN 0b gates', () => {
    const results = measureCells([20]) // base keep-gate only (Task 1 scope)
    logTable('260924-pyp BASE TIER TABLE', results)
    expect(results).toHaveLength(WATERS.length * PAPERS.length)
    for (const r of results) {
      expect(r.W_deposit, `W_deposit>0 paper=${r.paper} water=${r.water}`).toBeGreaterThan(0)
      expect(r.W_settle).toBeGreaterThan(0)
      expect(r.W_visible).toBeGreaterThan(0)
      expect(r.W_visible).toBeLessThanOrEqual(CANVAS_H)
    }
    // PIN 0 + PIN 0b hard gates (assertMode: Task 1 done requires in-bounds)
    checkPinGates(results, /* assertMode */ true)
    if (STOP_FINDINGS.length > 0) {
      console.log(`[260924-pyp] STOP findings so far: ${STOP_FINDINGS.length}`)
    }
  })
})

describe('260924-pyp cutoff tier sweep — full outcome matrix', () => {
  it('OUTCOME TABLE: waters x tiers x papers with per-cell PIN 0/0b, d(b), envelope', () => {
    const results = measureCells(TIERS)
    logTable('260924-pyp OUTCOME TABLE', results)

    // Harness sanity: every cell measurable (stable exit state). Envelope /
    // monotone pins are NOT asserted as pass/fail — this quick produces the
    // table, not a fix.
    expect(results).toHaveLength(TIERS.length * WATERS.length * PAPERS.length)
    for (const r of results) {
      expect(r.W_deposit, `W_deposit>0 tier=${r.tier} water=${r.water} paper=${r.paper}`).toBeGreaterThan(0)
      expect(r.W_settle, `W_settle>0 tier=${r.tier} water=${r.water} paper=${r.paper}`).toBeGreaterThan(0)
      expect(r.W_visible, `W_visible>0 tier=${r.tier} water=${r.water} paper=${r.paper}`).toBeGreaterThan(0)
      expect(r.W_visible).toBeLessThanOrEqual(CANVAS_H)
    }

    // PIN 0 / PIN 0b HARD gates in every cell: violations are logged as
    // STOP finding lines — bounds are never loosened to make a cell pass.
    checkPinGates(results, /* assertMode */ false)
    console.log(`[260924-pyp] total STOP findings: ${STOP_FINDINGS.length}`)
    for (const f of STOP_FINDINGS) console.log(`[260924-pyp] ${f}`)
  })
})

// ============================================================
//  260924-rm2 — production-path deposit-cutoff CONTRACT pins
//
//  The contract the landed cutoff must satisfy on the PRODUCTION
//  path: cells run with the RAW profile — no in-harness tier
//  pre-filter (applyTier is a no-op for tier <= 20, so
//  transferToWetLayerClipped's own deposit keep-gate decides
//  inclusion; that no-op IS the integration path at whatever gate
//  production applies). RED at base (keep-gate 20): envelope fails
//  on null paper at default water (W_visible 9 > 8) and texture
//  fails on synthetic paper at waters 10/50 (d(b) = 0) per the
//  260924-pyp OUTCOME TABLE tier-20 rows. GREEN only after the
//  cutoff lands in wet-layer.ts.
//
//  Cutoff = include/exclude at the deposit keep-gate ONLY. PIN 0 +
//  PIN 0b are HARD gates over every production-path cell: any
//  body-pixel movement fails the run (STOP — never loosen a bound;
//  never modulate deposit alpha with water/tier — m7w 24f40261
//  failure mode, reverted 1648658b).
// ============================================================
describe('260924-rm2 production-path deposit-cutoff contract pins', () => {
  /** RAW profile cells — no in-harness tier pre-filter (applyTier no-op at tier 20). */
  const productionPath = () => measureCells([20])

  it('envelope: W_visible <= 8 at DEFAULT water 50, both papers', () => {
    const results = productionPath()
    logTable('260924-rm2 PRODUCTION PATH (raw profile, production keep-gate)', results)
    for (const r of results) {
      if (r.water !== 50) continue
      expect(
        r.W_visible,
        `260924-rm2 envelope FAIL: paper=${r.paper} water=50 W_visible=${r.W_visible} > bound ${ENVELOPE_BOUND} ` +
        `(ribbon 2r=${RIBBON_W} + 2px) — production keep-gate admits fringe pixels the deposit cutoff must exclude ` +
        `(pyp OUTCOME TABLE: base tier 20 fails envelope on null paper)`,
      ).toBeLessThanOrEqual(ENVELOPE_BOUND)
    }
  })

  // 260925-b7c texture law (user decision 2026-09-25): texture presence is
  // asserted when spread is ENGAGED — Spread 80 (K=7), not the
  // preview-matched default (K=1 → d(b) = 0 by design). The d(b) >= 1
  // floor is unchanged; envelope + PIN 0/0b gates above/below stay at the
  // default Spread 50.
  it(`texture: d(b) = W_settle - W_deposit >= 1 at EVERY water {10, 50, 90}, both papers, at spread-engaged Spread ${TEXTURE_SPREAD_STRENGTH}`, () => {
    const results = measureCells([20], TEXTURE_SPREAD_STRENGTH, TEXTURE_K_TICKS)
    for (const r of results) {
      const db = r.W_settle - r.W_deposit
      expect(
        db,
        `260924-rm2 texture FAIL: paper=${r.paper} water=${r.water} Spread=${TEXTURE_SPREAD_STRENGTH} K=${TEXTURE_K_TICKS} d(b)=${db} < 1 ` +
        `(W_deposit=${r.W_deposit} -> W_settle=${r.W_settle}) — a cutoff that lands here is a hard stamp ` +
        `(d(b) must survive on the production raster at every water at the spread-engaged setting; exercises the ` +
        `D-08 synthetic-paper adsorption path alongside null)`,
      ).toBeGreaterThanOrEqual(1)
    }
  })

  it('PIN 0 + PIN 0b HARD gates over every production-path cell (any body movement fails the run)', () => {
    const results = productionPath()
    // assertMode true: violations are STOP findings AND assertion failures —
    // bounds are never loosened to make a cell pass.
    checkPinGates(results, /* assertMode */ true)
  })
})
