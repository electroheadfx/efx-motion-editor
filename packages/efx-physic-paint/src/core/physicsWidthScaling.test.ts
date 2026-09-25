// ============================================================
//  260924-stb — width → physics contract pins (TDD contract)
//
//  Quick brief law: "physics intensity must scale with local stroke
//  width" — a hairline must not inflate past its drawn footprint the
//  way a thick downstroke may; the thick mark must keep spreading and
//  texturing (physics not disabled); body opacity is absolute (PIN 0
//  / 0b, m7w 24f40261 law); two identical gestures must settle
//  byte-identically (stop-motion law).
//
//  Bounds are calibrated ONCE in 260924-stb-VERDICT.md before this
//  RED commit and must NEVER be re-calibrated afterwards:
//    W1 tol = 3.0 px (thin settled visible vs drawn)
//    W2 floor = 1 px d(b) at default water (50), both papers
//    W3 monotone law on physics-induced inflation
//        (W_settle - W_deposit) / W_drawn, thin <= thick
//    W4 PIN 0 ratio [0.99, 1.01] + PIN 0b >= 0.95 x base literals
//    W5 byte-identical digests across two runs
//    W6 production texture (pyp/rm2 idiom): d(b) >= 1 at EVERY water
//        x both papers on the r=3 uniform production raster
//
//  260925-b7c texture-law recalibration (user decision 2026-09-25):
//  the two TEXTURE-PRESENCE gates (W2, W6) assert at the
//  spread-ENGAGING setting Spread 80 — "texture is present when spread
//  is engaged" — NOT at the preview-matched default (new 50 = old 30
//  derives K = 1, which is by design a hard stamp: d(b) = 0 there).
//  The floors themselves (d(b) >= 1) are NOT weakened. Every other gate
//  (W1, W3, W4, W5, W7) still asserts at the default Spread 50.
//
//  W6 was appended by the orchestrator-authorized re-calibration cycle
//  (Option 1, 2026-09-24): the pyp production-path texture pin became a
//  first-class pin HERE, alongside W1-W5, BEFORE the f() knee was
//  re-derived — so the new bounds are legal only if the FULL pin set
//  (W1..W6) passes together. W1-W5 tolerances above are UNCHANGED by
//  that cycle (no pin weakened); only the carrier's wFloor/wFull in
//  fluids.ts were re-derived — see the VERDICT re-calibration section.
//
//  W7 (carrier-revision cycle, 2026-09-25): field-law pin locking the
//  NEIGHBORHOOD mean-thickness law itself (mean min(h,v)-run over the
//  5x5 Chebyshev box R=2, knee 4/6, residual 0.25). Bounds calibrated
//  PRE-RED in the VERDICT re-diagnosis append: thick-edge min f >= 0.99,
//  hairline cols 40-46 max f <= 0.30, production cols 40-90 min f >= 0.80.
//  W1-W6 above remain byte-untouched.
//
//  Substrate: pressure gesture r=10, pThin=0.1134 (drawn thin
//  2.025 px @ x=44, drawn thick 19.865 px @ x=68), analytic coverage
//  raster (pyp idiom, LCG seed 123456789), deposited through the
//  REAL transferToWetLayerClipped (keep-gate tier 70 + base deposit
//  arithmetic), settled through the REAL localFluidPhysicsStep with
//  engine defaults K_TICKS = max(1, ceil(spreadCurveFor(50)*10)) = 1
//  (260925-b7c calibration law, spreadCurveFor(50) = 0.09) and
//  {viscosity:0.0001, omega_h:0.06,
//  darkening:0.1}. W6 additionally builds the pyp production substrate
//  (uniform r=3, ribbon hasPenInput=false) in the same file.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createWetBuffers, transferToWetLayerClipped } from './wet-layer'
import { IX, buildWidthScaleField, localFluidPhysicsStep } from './fluids'
import { wetDisplayAlpha } from '../render/compositor'
import { sampleH } from './paper'
import { ribbon, deform, deformN } from '../brush/stroke'
import { curveBounds } from '../util/math'
import { spreadCurveFor } from './spreadScale'
import type { FluidConfig, PenPoint, WetBuffers } from '../types'

const CANVAS_W = 128
const CANVAS_H = 64
const MID_Y = 32
const SPREAD_STRENGTH = 50
/** Engine tick law (per spread strength): K = max(1, ceil(spreadCurve·10)). */
const ticksForSpread = (strength: number): number =>
  Math.max(1, Math.ceil(spreadCurveFor(strength) * 10))
/** Engine-default mirror: Spread 50 → spreadCurveFor(50) = 0.09 → K = 1 tick (260925-b7c). */
const K_TICKS = ticksForSpread(SPREAD_STRENGTH)
/**
 * 260925-b7c texture law (user decision 2026-09-25): texture presence is
 * asserted when spread is ENGAGED — Spread 80 → spreadCurveFor(80) = 0.636
 * → K = max(1, ceil(6.36)) = 7 ticks — never at the preview-matched
 * default (default K = 1 leaves d(b) = 0 by design: new 50 = old-30
 * physics, the point measured live as preview-matched). The d(b) >= 1
 * assertion itself is unchanged — only the setting moves.
 */
const TEXTURE_SPREAD_STRENGTH = 80
const TEXTURE_K_TICKS = ticksForSpread(TEXTURE_SPREAD_STRENGTH)
const FLUID_CONFIG: FluidConfig = { viscosity: 0.0001, omega_h: 0.06, darkening: 0.1 }
const VISIBLE_THRESH = 13
const ALPHA_FLOOR = 125
const ENGINE_EDGE_DETAIL = 4
const PROFILE_SEED = 123456789
const SS = 16

// Gesture cross-sections (VERDICT substrate)
const RADIUS = 10
const P_THIN = 0.1134
const THIN_X = 44
const THICK_X = 68
const THIN_REGION: [number, number] = [40, 48]
const THICK_REGION: [number, number] = [64, 76]

// W6 production substrate (pyp/rm2 idiom): uniform r=3 brush, straight
// dense stroke, hasPenInput=false — the real production-path raster
// (brushRenderRadius(default size 6) = 3, ribbon width 2r = 6 px).
const PROD_RADIUS = 3
const PROD_MID_X = 64
const PROD_SPACING = 3

// VERDICT bounds — calibrated before RED, never re-calibrated
const W1_TOL_PX = 3.0
const W2_FLOOR_PX = 1
const W2_DEFAULT_WATER = 50
const W4_FLOOR = 0.95

// W7 field-law bounds (VERDICT re-diagnosis append — calibrated PRE-RED,
// never re-calibrated after this commit)
const W7_THICK_EDGE_MIN_F = 0.99
const W7_HAIRLINE_MAX_F = 0.30
const W7_PROD_MIN_F = 0.80
const W7_HAIRLINE_COLS: [number, number] = [40, 46]
const W7_PROD_COLS: [number, number] = [40, 90]

const WATERS = [10, 50, 90] as const
const PAPERS = ['null', 'synthetic'] as const
type PaperKind = (typeof PAPERS)[number]

const LAW = 'physics intensity must scale with local stroke width'

// ============================================================
//  Substrate: pressure gesture + analytic coverage raster (pyp idiom)
// ============================================================

function makePressureCurve(pThin: number): PenPoint[] {
  const pts: PenPoint[] = []
  for (let x = 16; x <= 112; x += 3) {
    let p: number
    if (x <= 48) p = pThin
    else if (x < 60) p = pThin + (1 - pThin) * ((x - 48) / 12)
    else if (x <= 78) p = 1
    else if (x < 90) p = 1 - (1 - pThin) * ((x - 78) / 12)
    else p = pThin
    pts.push({ x, y: MID_Y, p, tx: 0, ty: 0, tw: 0, spd: 0 })
  }
  return pts
}

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

function engineLocalBbox(curve: PenPoint[], water01: number, radius: number, spreadStrength: number = SPREAD_STRENGTH) {
  let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
  for (const p of curve) {
    sx0 = Math.min(sx0, p.x); sy0 = Math.min(sy0, p.y)
    sx1 = Math.max(sx1, p.x); sy1 = Math.max(sy1, p.y)
  }
  const waterCurve = water01 * water01
  const spreadCurve = spreadCurveFor(spreadStrength)
  const margin = Math.ceil(2 + waterCurve * radius * 0.6 + spreadCurve * radius * 0.4)
  return {
    x0: Math.max(0, Math.floor(sx0 - radius - margin)),
    y0: Math.max(0, Math.floor(sy0 - radius - margin)),
    x1: Math.min(CANVAS_W - 1, Math.ceil(sx1 + radius + margin)),
    y1: Math.min(CANVAS_H - 1, Math.ceil(sy1 + radius + margin)),
  }
}

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

interface Profile {
  bounds: { x0: number; y0: number; w: number; h: number }
  data: Uint8ClampedArray
  curve: PenPoint[]
  radius: number
  hasPenInput: boolean
}

function makeUniformCurve(): PenPoint[] {
  const pts: PenPoint[] = []
  for (let x = 16; x <= 112; x += PROD_SPACING) {
    pts.push({ x, y: MID_Y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 })
  }
  return pts
}

function buildProfileFor(curve: PenPoint[], radius: number, hasPenInput: boolean): Profile {
  const variance = (1.5 + Math.sqrt(radius) * 0.9) * (ENGINE_EDGE_DETAIL / 50)
  const bounds = curveBounds(curve, radius + variance * 5, CANVAS_W, CANVAS_H)
  const buf = new Float32Array(bounds.w * bounds.h)
  let seed = PROFILE_SEED
  const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 0x100000000
  })
  try {
    const base = ribbon(curve, radius, 0.8, hasPenInput)
    const baseD = deformN(base, 4, variance)
    const layers = Math.round((22 + 15) / 1)
    const lAlpha = Math.min(0.08, 3 / layers)
    for (let i = 0; i < layers; i++) {
      const v = deform(baseD, variance * 0.2)
      // every layer flat-fills (260925-dso: grain/emboss passes deleted)
      compositePolygon(buf, v, bounds, lAlpha)
    }
    const soft = Math.round(layers * 0.2)
    for (let i = 0; i < soft; i++) {
      const v = deform(baseD, variance * 0.5)
      compositePolygon(buf, v, bounds, lAlpha * 0.25)
    }
  } finally {
    spy.mockRestore()
  }
  const data = new Uint8ClampedArray(bounds.w * bounds.h * 4)
  for (let i = 0; i < buf.length; i++) {
    const pi = i * 4
    data[pi] = 255; data[pi + 1] = 0; data[pi + 2] = 0
    data[pi + 3] = Math.round(Math.min(1, Math.max(0, buf[i])) * 255)
  }
  return { bounds, data, curve, radius, hasPenInput }
}

/** Gesture substrate (W1-W5): pressure-varying r=10 stroke. */
function buildProfile(): Profile {
  return buildProfileFor(makePressureCurve(P_THIN), RADIUS, true)
}

/**
 * Production substrate (W6): uniform r=3 straight stroke with
 * hasPenInput=false — the pyp/rm2 production-path raster idiom
 * (productionAaSettleMeasurement.test.ts buildProfile contract,
 * self-contained per plan: no helper imports across test files).
 */
function buildProductionProfile(): Profile {
  return buildProfileFor(makeUniformCurve(), PROD_RADIUS, false)
}

function drawnWidthAt(profile: Profile, col: number): number {
  const poly = ribbon(profile.curve, profile.radius, 0.8, profile.hasPenInput)
  const xc = col + 0.5
  const ys: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const x0 = a[0], x1 = b[0]
    if ((x0 <= xc && xc < x1) || (x1 <= xc && xc < x0)) {
      const t = (xc - x0) / (x1 - x0)
      ys.push(a[1] + t * (b[1] - a[1]))
    }
  }
  if (ys.length < 2) return 0
  return Math.max(...ys) - Math.min(...ys)
}

// ============================================================
//  Deposit through the REAL transfer (keep-gate tier 70) + settle
//  through the REAL local fluid step
// ============================================================

function depositRun(profile: Profile, water01: number, paper: Float32Array | null): WetBuffers {
  const imageData = { data: profile.data, width: profile.bounds.w, height: profile.bounds.h }
  const fakeOffCtx = { getImageData: () => imageData }
  const transferBounds = { x: profile.bounds.x0, y: profile.bounds.y0, w: profile.bounds.w, h: profile.bounds.h }
  const wet = createWetBuffers(CANVAS_W * CANVAS_H)
  transferToWetLayerClipped(fakeOffCtx as never, wet, water01, transferBounds, CANVAS_W, CANVAS_H, paper)
  return wet
}

function freshCopy(deposit: WetBuffers): WetBuffers {
  const s = createWetBuffers(CANVAS_W * CANVAS_H)
  s.r.set(deposit.r); s.g.set(deposit.g); s.b.set(deposit.b)
  s.alpha.set(deposit.alpha); s.wetness.set(deposit.wetness)
  s.strokeOpacity.set(deposit.strokeOpacity)
  return s
}

function settleReal(
  profile: Profile,
  deposit: WetBuffers,
  water01: number,
  spreadStrength: number = SPREAD_STRENGTH,
  ticks: number = K_TICKS,
): WetBuffers {
  const s = freshCopy(deposit)
  localFluidPhysicsStep(s, FLUID_CONFIG, CANVAS_W, CANVAS_H,
    engineLocalBbox(profile.curve, water01, profile.radius, spreadStrength), ticks)
  return s
}

// ============================================================
//  Measurement helpers (pyp / footprint idiom)
// ============================================================

function widthFromAlpha(wet: WetBuffers, col: number): number {
  let count = 0
  for (let y = 0; y < CANVAS_H; y++) if (wet.alpha[y * CANVAS_W + col] >= ALPHA_FLOOR) count++
  return count
}

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

interface RegionState { threshold: number; pixels: Array<{ gx: number; gy: number; profileAlpha: number }> }

function regionBody(profile: Profile, c0: number, c1: number): RegionState {
  let plateau = 0
  for (let gx = c0; gx <= c1; gx++) {
    const lx = gx - profile.bounds.x0
    for (let ly = 0; ly < profile.bounds.h; ly++) {
      plateau = Math.max(plateau, profile.data[(ly * profile.bounds.w + lx) * 4 + 3])
    }
  }
  const threshold = Math.max(200, Math.floor(plateau * 0.9))
  const pixels: RegionState['pixels'] = []
  for (let gx = c0; gx <= c1; gx++) {
    const lx = gx - profile.bounds.x0
    for (let ly = 0; ly < profile.bounds.h; ly++) {
      const a = profile.data[(ly * profile.bounds.w + lx) * 4 + 3]
      if (a >= threshold) pixels.push({ gx, gy: profile.bounds.y0 + ly, profileAlpha: a })
    }
  }
  return { threshold, pixels }
}

function pin0Ratio(wet: WetBuffers, body: RegionState, paper: Float32Array | null): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const p of body.pixels) {
    let expected = (p.profileAlpha / 255) * 3000
    if (paper) {
      const h = sampleH(paper, p.gx, p.gy, CANVAS_W, CANVAS_H)
      expected *= Math.max(1, (1 - 0) * (1 - h * 0.8) * 1.2)
    }
    const ratio = wet.alpha[p.gy * CANVAS_W + p.gx] / expected
    if (ratio < min) min = ratio
    if (ratio > max) max = ratio
  }
  return { min, max }
}

function bodyMeans(wet: WetBuffers, body: RegionState, paper: Float32Array | null): { alpha: number; display: number } {
  let sumA = 0
  let sumD = 0
  for (const p of body.pixels) {
    const i = p.gy * CANVAS_W + p.gx
    sumA += wet.alpha[i]
    const h = sampleH(paper, p.gx, p.gy, CANVAS_W, CANVAS_H)
    sumD += wetDisplayAlpha(wet.alpha[i], wet.strokeOpacity[i] || 0, h)
  }
  const n = Math.max(1, body.pixels.length)
  return { alpha: sumA / n, display: sumD / n }
}

// ============================================================
//  Cell cache — one deposit+settle per (paper, water), shared by pins
// ============================================================

interface Cell {
  paper: PaperKind
  water: number
  paperArr: Float32Array | null
  deposit: WetBuffers
  settled: WetBuffers
}

const profile = buildProfile()
const drawnThin = drawnWidthAt(profile, THIN_X)
const drawnThick = drawnWidthAt(profile, THICK_X)
const bodies = {
  thin: regionBody(profile, THIN_REGION[0], THIN_REGION[1]),
  thick: regionBody(profile, THICK_REGION[0], THICK_REGION[1]),
}

const cellCache = new Map<string, Cell>()
function getCell(paper: PaperKind, water: number): Cell {
  const key = `${paper}|${water}`
  const hit = cellCache.get(key)
  if (hit) return hit
  const paperArr = paper === 'synthetic' ? makeSyntheticPaper() : null
  const deposit = depositRun(profile, water / 100, paperArr)
  const settled = settleReal(profile, deposit, water / 100)
  const cell: Cell = { paper, water, paperArr, deposit, settled }
  cellCache.set(key, cell)
  return cell
}

function forEachCell(fn: (cell: Cell) => void): void {
  for (const paper of PAPERS) {
    for (const water of WATERS) fn(getCell(paper, water))
  }
}

function cellTag(cell: Cell): string {
  return `paper=${cell.paper} water=${cell.water}`
}

// ============================================================
//  PIN 0b base-calibrated literals (VERDICT table — measured on the
//  base/production settle; asserted as >= 0.95x floors post-GREEN)
// ============================================================

interface Literal { alpha: number; display: number }
const PIN0B_LITERALS: Record<string, { thin: Literal; thick: Literal }> = {
  'null|10': { thin: { alpha: 2609.81, display: 245.61 }, thick: { alpha: 2828.31, display: 252.64 } },
  'null|50': { thin: { alpha: 2615.41, display: 245.83 }, thick: { alpha: 2838.81, display: 253.16 } },
  'null|90': { thin: { alpha: 2359.55, display: 220.78 }, thick: { alpha: 2859.92, display: 254.84 } },
  'synthetic|10': { thin: { alpha: 2599.17, display: 243.06 }, thick: { alpha: 2873.23, display: 252.58 } },
  'synthetic|50': { thin: { alpha: 2609.84, display: 245.44 }, thick: { alpha: 2884.11, display: 253.43 } },
  'synthetic|90': { thin: { alpha: 2389.93, display: 218.22 }, thick: { alpha: 2905.78, display: 254.42 } },
}

// ============================================================
//  The six contract pins (W6 added by the Option-1 re-calibration
//  cycle — production-path texture pin, same file as W1-W5)
// ============================================================

let prodProfileCache: Profile | null = null
function getProductionProfile(): Profile {
  if (!prodProfileCache) prodProfileCache = buildProductionProfile()
  return prodProfileCache
}

describe('260924-stb physics width scaling contract', () => {
  it(`W1 hairline: ${LAW} — thin settled visible width <= drawn + ${W1_TOL_PX}px in every cell`, () => {
    // Law: a hairline must not settle wider than its drawn ribbon plus the
    // VERDICT tolerance (base today inflates far more than thick ones).
    const bound = drawnThin + W1_TOL_PX
    forEachCell(cell => {
      const v = widthVisible(cell.settled, THIN_X, cell.paperArr)
      expect(
        v,
        `${LAW} — W1 FAIL ${cellTag(cell)}: thin W_visible=${v} > drawn=${drawnThin.toFixed(3)} + tol=${W1_TOL_PX} = ${bound.toFixed(3)} (settle inflates the hairline past the VERDICT bound)`,
      ).toBeLessThanOrEqual(bound)
    })
  })

  it(`W2 thick physics (control): ${LAW} — thick d(b) >= ${W2_FLOOR_PX}px at spread-engaged Spread ${TEXTURE_SPREAD_STRENGTH} (default water), both papers`, () => {
    // Law: physics must NOT be disabled on thick strokes — the control pin.
    // 260925-b7c texture law: asserted at the spread-engaging setting
    // (Spread 80, K=7), NOT at the preview-matched default (K=1 by design);
    // floor unchanged (>= 1 px).
    for (const paper of PAPERS) {
      const cell = getCell(paper, W2_DEFAULT_WATER)
      const settledTexture = settleReal(
        profile, cell.deposit, W2_DEFAULT_WATER / 100, TEXTURE_SPREAD_STRENGTH, TEXTURE_K_TICKS,
      )
      const db = widthFromAlpha(settledTexture, THICK_X) - widthFromAlpha(cell.deposit, THICK_X)
      expect(
        db,
        `${LAW} — W2 FAIL ${cellTag(cell)} Spread=${TEXTURE_SPREAD_STRENGTH} K=${TEXTURE_K_TICKS}: thick d(b)=W_settle-W_deposit=${db} < floor=${W2_FLOOR_PX} (physics disabled / thick no longer spreads or textures at spread-engaged setting)`,
      ).toBeGreaterThanOrEqual(W2_FLOOR_PX)
    }
  })

  it(`W3 monotone: ${LAW} — physics-induced relative inflation at thin <= at thick in every cell`, () => {
    // Law: relative inflation (physics component) of the thin cross-section
    // must never exceed the thick cross-section's (VERDICT: measured on
    // W_settle - W_deposit over W_drawn — the literal settled/drawn form is
    // structurally unsatisfiable under the locked deposit, see VERDICT §Pin
    // bounds proposal; absolute spread may grow with width).
    forEachCell(cell => {
      const thinPhys = (widthFromAlpha(cell.settled, THIN_X) - widthFromAlpha(cell.deposit, THIN_X)) / drawnThin
      const thickPhys = (widthFromAlpha(cell.settled, THICK_X) - widthFromAlpha(cell.deposit, THICK_X)) / drawnThick
      expect(
        thinPhys,
        `${LAW} — W3 FAIL ${cellTag(cell)}: thin physics inflation=${thinPhys.toFixed(3)} > thick=${thickPhys.toFixed(3)} (hairline penalized harder than the thick stroke — thin Ws/Wd/base=${widthFromAlpha(cell.settled, THIN_X)}/${widthFromAlpha(cell.deposit, THIN_X)}, thick ${widthFromAlpha(cell.settled, THICK_X)}/${widthFromAlpha(cell.deposit, THICK_X)})`,
      ).toBeLessThanOrEqual(thickPhys)
    })
  })

  it(`W4 PIN 0/0b (opacity law): deposit ratio in [0.99, 1.01] and settled body means >= ${W4_FLOOR}x base literals — both regions x waters x papers`, () => {
    forEachCell(cell => {
      const lit = PIN0B_LITERALS[`${cell.paper}|${cell.water}`]
      for (const [rname, body] of Object.entries(bodies)) {
        // PIN 0 — deposit-stage body ratio (m7w 24f40261: never move the body)
        const ratio = pin0Ratio(cell.deposit, body, cell.paperArr)
        expect(
          ratio.min,
          `${LAW} — W4 PIN 0 FAIL ${cellTag(cell)} region=${rname}: deposit ratio min=${ratio.min.toFixed(4)} < 0.99`,
        ).toBeGreaterThanOrEqual(0.99)
        expect(
          ratio.max,
          `${LAW} — W4 PIN 0 FAIL ${cellTag(cell)} region=${rname}: deposit ratio max=${ratio.max.toFixed(4)} > 1.01`,
        ).toBeLessThanOrEqual(1.01)
        // PIN 0b — post-settle body floors vs VERDICT base literals
        const means = bodyMeans(cell.settled, body, cell.paperArr)
        const base = lit[rname as 'thin' | 'thick']
        expect(
          means.alpha,
          `${LAW} — W4 PIN 0b FAIL ${cellTag(cell)} region=${rname}: settled meanAlpha=${means.alpha.toFixed(2)} < ${W4_FLOOR} x ${base.alpha} = ${(W4_FLOOR * base.alpha).toFixed(2)} (body visibility moved)`,
        ).toBeGreaterThanOrEqual(W4_FLOOR * base.alpha)
        expect(
          means.display,
          `${LAW} — W4 PIN 0b FAIL ${cellTag(cell)} region=${rname}: settled meanDisplay=${means.display.toFixed(2)} < ${W4_FLOOR} x ${base.display} = ${(W4_FLOOR * base.display).toFixed(2)} (body visibility moved)`,
        ).toBeGreaterThanOrEqual(W4_FLOOR * base.display)
      }
    })
  })

  it(`W5 determinism (stop-motion law): ${LAW} — two identical gesture runs settle byte-identically`, () => {
    for (const paper of PAPERS) {
      for (const water of WATERS) {
        const paperArr = paper === 'synthetic' ? makeSyntheticPaper() : null
        // Two fully independent runs: fresh profile (same LCG seed), fresh deposit, fresh settle
        const p1 = buildProfile()
        const d1 = depositRun(p1, water / 100, paperArr)
        const s1 = settleReal(p1, d1, water / 100)
        const p2 = buildProfile()
        const d2 = depositRun(p2, water / 100, paperArr)
        const s2 = settleReal(p2, d2, water / 100)
        expect(
          Array.from(d1.alpha),
          `${LAW} — W5 FAIL paper=${paper} water=${water}: deposit alpha digests diverge across identical runs (non-deterministic deposit)`,
        ).toEqual(Array.from(d2.alpha))
        expect(
          Array.from(s1.alpha),
          `${LAW} — W5 FAIL paper=${paper} water=${water}: settled alpha digests diverge across identical runs (RNG/clock in the scaling path — stop-motion boil)`,
        ).toEqual(Array.from(s2.alpha))
      }
    }
  })

  it(`W6 production texture (pyp/rm2 idiom): ${LAW} — d(b) = W_settle - W_deposit >= 1 at EVERY water x both papers on the r=3 production raster, at spread-engaged Spread ${TEXTURE_SPREAD_STRENGTH}`, () => {
    // Law: the production raster must keep its Physics identity — the
    // settled mark spreads/textures relative to its deposit (d(b) >= 1),
    // never collapses to a hard stamp. This is the pyp production-path
    // texture pin, first-class here alongside W1-W5 so the re-calibrated
    // f() bounds must satisfy BOTH substrates together (Option 1).
    // 260925-b7c texture law: asserted at the spread-engaging setting
    // (Spread 80, K=7), NOT at the preview-matched default (K=1 by design);
    // floor unchanged (>= 1).
    const prod = getProductionProfile()
    for (const paper of PAPERS) {
      for (const water of WATERS) {
        const paperArr = paper === 'synthetic' ? makeSyntheticPaper() : null
        const deposit = depositRun(prod, water / 100, paperArr)
        const settled = settleReal(prod, deposit, water / 100, TEXTURE_SPREAD_STRENGTH, TEXTURE_K_TICKS)
        const wDep = widthFromAlpha(deposit, PROD_MID_X)
        const wSet = widthFromAlpha(settled, PROD_MID_X)
        const db = wSet - wDep
        expect(
          db,
          `${LAW} — W6 FAIL paper=${paper} water=${water} Spread=${TEXTURE_SPREAD_STRENGTH} K=${TEXTURE_K_TICKS}: production d(b)=W_settle-W_deposit=${db} < 1 ` +
          `(W_deposit=${wDep} -> W_settle=${wSet} at x=${PROD_MID_X}) — the r=3 production stroke settled to a hard ` +
          `stamp at the spread-engaged setting (physics texture/spread identity lost on the production raster; pyp/rm2 texture law)`,
        ).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it(`W7 field law (neighborhood thickness): ${LAW} — thick-edge f >= ${W7_THICK_EDGE_MIN_F}, hairline cols ${W7_HAIRLINE_COLS[0]}-${W7_HAIRLINE_COLS[1]} max f <= ${W7_HAIRLINE_MAX_F}, production cols ${W7_PROD_COLS[0]}-${W7_PROD_COLS[1]} min f >= ${W7_PROD_MIN_F} (both papers, water ${W2_DEFAULT_WATER})`, () => {
    // Law: the equalization multiplier f must be built from the NEIGHBORHOOD
    // mean thickness (5x5 box, R=2), not the cell's own run — the property
    // that makes hairline and production low-run cells discriminate (VERDICT
    // re-diagnosis). Bounds calibrated PRE-RED in the VERDICT append; this
    // pins the field itself, since W1-W6 are behavioral only.
    const alphaAt = (wet: WetBuffers, cx: number, cy: number): number =>
      cx < 0 || cy < 0 || cx >= CANVAS_W || cy >= CANVAS_H ? 0 : wet.alpha[cy * CANVAS_W + cx]

    const buildField = (p: Profile, wet: WetBuffers) => {
      const bbox = engineLocalBbox(p.curve, W2_DEFAULT_WATER / 100, p.radius)
      const localW = bbox.x1 - bbox.x0 + 1
      const localH = bbox.y1 - bbox.y0 + 1
      const f = buildWidthScaleField(wet, bbox.x0, bbox.y0, bbox.x1, bbox.y1, localW, localH, CANVAS_W)
      const fAt = (cx: number, cy: number): number =>
        f[IX(localW, cx - bbox.x0 + 1, cy - bbox.y0 + 1)]
      return { f, bbox, fAt }
    }

    for (const paper of PAPERS) {
      const paperArr = paper === 'synthetic' ? makeSyntheticPaper() : null

      // Gesture substrate — W7a (thick edge) + W7b (hairline core)
      const deposit = depositRun(profile, W2_DEFAULT_WATER / 100, paperArr)
      const g = buildField(profile, deposit)

      // W7a: edge cells of the thick region — inside cell (alpha > 20) with a
      // 4-neighbor at alpha <= 20 (or off-canvas) — must keep f >= 0.99
      let edgeMin = Infinity
      let edgeCount = 0
      for (let cx = THICK_REGION[0]; cx <= THICK_REGION[1]; cx++) {
        for (let cy = 0; cy < CANVAS_H; cy++) {
          if (alphaAt(deposit, cx, cy) <= 20) continue
          const isEdge = alphaAt(deposit, cx - 1, cy) <= 20 || alphaAt(deposit, cx + 1, cy) <= 20
            || alphaAt(deposit, cx, cy - 1) <= 20 || alphaAt(deposit, cx, cy + 1) <= 20
          if (!isEdge) continue
          edgeCount++
          edgeMin = Math.min(edgeMin, g.fAt(cx, cy))
        }
      }
      expect(edgeCount, `${LAW} — W7a setup FAIL paper=${paper}: no thick-edge cells found (substrate broken)`).toBeGreaterThan(0)
      expect(
        edgeMin,
        `${LAW} — W7a FAIL paper=${paper}: thick-stroke edge cells min f=${edgeMin} < ${W7_THICK_EDGE_MIN_F} ` +
        `(physics intensity damped at the thick mark's edge — neighborhood field lost; ${edgeCount} edge cells)`,
      ).toBeGreaterThanOrEqual(W7_THICK_EDGE_MIN_F)

      // W7b: source cells (deposit alpha >= 1) in the hairline columns —
      // the neighborhood mean must keep them damped (<= 0.30)
      let hairMax = -Infinity
      let hairCount = 0
      for (let cx = W7_HAIRLINE_COLS[0]; cx <= W7_HAIRLINE_COLS[1]; cx++) {
        for (let cy = 0; cy < CANVAS_H; cy++) {
          if (alphaAt(deposit, cx, cy) < 1) continue
          hairCount++
          hairMax = Math.max(hairMax, g.fAt(cx, cy))
        }
      }
      expect(hairCount, `${LAW} — W7b setup FAIL paper=${paper}: no hairline source cells in cols ${W7_HAIRLINE_COLS[0]}-${W7_HAIRLINE_COLS[1]} (substrate broken)`).toBeGreaterThan(0)
      expect(
        hairMax,
        `${LAW} — W7b FAIL paper=${paper}: hairline source max f=${hairMax} > ${W7_HAIRLINE_MAX_F} ` +
        `(hairline equalization no longer damped — thin stroke will inflate past its footprint; ${hairCount} source cells)`,
      ).toBeLessThanOrEqual(W7_HAIRLINE_MAX_F)

      // Production substrate — W7c: body cells must read "thick enough"
      const prodDeposit = depositRun(getProductionProfile(), W2_DEFAULT_WATER / 100, paperArr)
      const p = buildField(getProductionProfile(), prodDeposit)
      let prodMin = Infinity
      let prodCount = 0
      for (let cx = W7_PROD_COLS[0]; cx <= W7_PROD_COLS[1]; cx++) {
        for (let cy = 0; cy < CANVAS_H; cy++) {
          if (alphaAt(prodDeposit, cx, cy) < 1) continue
          prodCount++
          prodMin = Math.min(prodMin, p.fAt(cx, cy))
        }
      }
      expect(prodCount, `${LAW} — W7c setup FAIL paper=${paper}: no production source cells in cols ${W7_PROD_COLS[0]}-${W7_PROD_COLS[1]} (substrate broken)`).toBeGreaterThan(0)
      expect(
        prodMin,
        `${LAW} — W7c FAIL paper=${paper}: production source min f=${prodMin} < ${W7_PROD_MIN_F} ` +
        `(production body reads thin → W6 texture identity would die; ${prodCount} source cells)`,
      ).toBeGreaterThanOrEqual(W7_PROD_MIN_F)
    }
  })
})
