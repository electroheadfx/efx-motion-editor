// ============================================================
//  Footprint lane builder + look constants (52.4-02, 260929-j47,
//  260929-m2z R7 fibre coverage contract)
//  — Claude's Discretion, judged at UAT per 52.4-CONTEXT.
//  Pure seeded geometry: no pixels, no Preact, no alpha/color on
//  the lane type (D-02 geometry only; source-shape prohibitions).
//
//  R7 coverage law (SPECS/real-paint/01-brush-footprint.md, USER
//  SPEC ACT 2026-09-29): every fibre is ONE transparent closed
//  FILLED outline — the soft edge is the fill anti-aliasing of that
//  single boundary (R7c). There is no stroked path, no wide
//  low-alpha under-pass and no skip/run-flush dashing on the
//  coverage path; gaps come only from the charge/deposit model.
//
//  Placement (260929-j47): the body band is OVERLAP-PACKED to the
//  k_body >= 4 core-lane law — the body's Poisson min-gap role is
//  superseded per user authority (52.4-04 deviation 2 fix path), so
//  composite PIN 0 1-prod(1-ga) >= 0.99 is reached by many low-alpha
//  overlapping fills, never by one near-opaque fill. Strata jitter
//  keeps the structure seeded and non-lattice. The rim band keeps
//  the seeded Poisson-gap floor against the unique-lane lattice
//  spacing (D-13, rim only) with the baked body/rim density profile
//  (D-02).
// ============================================================

import { seededDraw } from '../util/traceSeed'

/** Core streak alpha (D-10/D-11) — top of the locked [0.4, 0.55]
 *  band, judged at UAT. PIN 0 is the COMPOSITE body opacity
 *  1-prod(1-a) over the overlapping body fills (user authority,
 *  260929-m2z): saturation comes from k_body >= 4 overlapping fills
 *  co-designed with the overlap-packed body strata — a single fill
 *  can never saturate. Arithmetic at 0.55: (1-0.55)^6 = 0.0083 ->
 *  composite 0.9917 >= 0.99 at k = 6, and the body's worst-case
 *  0.18 px max-gap guarantees k >= 6 at every body sample including
 *  the band edge — real margin at the existing 0.99 bound. */
export const STREAK_ALPHA = 0.55
/** D-12(b) floor above the sub-pixel hairline (final tier, post-clamp). */
export const WIDTH_FLOOR = 0.5
/** D-12(b) fibre ceiling (USER AUTHORITY): every filled outline stays
 *  within 2 px — the visible fibre is sub-2 px. The R7 single-clamp
 *  law: this is the ONLY ceiling (the soft-under ceiling retired with
 *  the under-pass, 260929-m2z). */
export const CORE_MAX_TRACE_WIDTH = 2
/** R7 thin-regime threshold (260929-m2z, replaces the radius-keyed
 *  HAIRLINE_RADIUS): the regime decision keys on the LOCAL ribbon
 *  half-width halfW = radius x scales[ci], so a fat brush at light
 *  pressure or on a taper takes the thin path wherever it is locally
 *  thin. halfW < THIN_HALF_W draws the seeded 1-3 thin-family
 *  outlines over that span; otherwise the full lane field. Chosen
 *  between the battery bounds: ABOVE the radius-3 cell (halfW <= 3)
 *  and BELOW every lane-field pin's mid-stroke halfW (radius 16 at
 *  p = 1 -> 16). Radius-8 cells at p = 1 sit exactly at the thick
 *  side (8 < 8 is false), matching the old radius-8 lane path. */
export const THIN_HALF_W = 8
/** D-13 rim min adjacent normalized gap = POISSON_FILL x lattice
 *  spacing of the UNIQUE lane count. 0.7 unchanged; the body band
 *  no longer uses it (superseded by k_body overlap). */
export const POISSON_FILL = 0.7
/** D-02 normalized body/rim split for the baked lateral density profile
 *  (initial 0.4): raised so the body band carries the density ratio AND
 *  the k_body >= 4 overlap coverage at radii 16/32. */
export const BODY_BAND = 0.52
/** D-12(a) nW gauge amplitude — the UAT edge-chatter lever.
 *  Gauge bound: fbm in [0, 0.875] -> gauge in [1-A/2, 1+0.375A]. */
export const NW_AMPLITUDE = 0.4
/** D-12(a) gauge arc scale — the fbm lattice cell is 1 unit and
 *  traceShapeNoise keys on arc * 0.05, so sampling at raw arc puts a
 *  10 px step at 0.5 units (Nyquist): the gauge aliases to near-white
 *  per-sample chatter (edge chatter, the very defect D-12a names).
 *  0.1 keeps the gauge genuinely low frequency — >= 10 noise samples
 *  per base cell at 10 px spacing — with the same amplitude bound. */
export const NW_ARC_SCALE = 0.1
/** D-02 body-lane base width range (px), |offset| <= BODY_BAND.
 *  MIN is the overlap-coverage floor: MIN x pMod(1.5) x gauge floor
 *  (0.8) = 2.04 > CORE_MAX_TRACE_WIDTH, so at p = 1 every body
 *  outline width clamps to exactly 2 px — a 1 px half-width that
 *  makes the k_body >= 4 edge-window arithmetic deterministic
 *  (260929-j47). */
export const BODY_WIDTH_MIN = 1.7
export const BODY_WIDTH_MAX = 1.9
/** D-02 rim-lane base width range (px), |offset| > BODY_BAND —
 *  strictly thinner mean than body (rim translucency by coverage). */
export const RIM_WIDTH_MIN = 0.5
export const RIM_WIDTH_MAX = 0.9
/** Bounded jitter attempts per lane before the unjittered stratum
 *  fallback (the strata already satisfy the gap law, so the fallback
 *  is always valid). */
export const POISSON_MAX_ATTEMPTS = 24
/** Body overlap packing (260929-m2z co-design): target mean adjacent
 *  body gap in px (count ~ radius, so px ~= norm x count). Worst-case
 *  gap is BODY_MAX_REACH_PX. The 260929-j47 values (0.24 / 0.28)
 *  left the band-EDGE one-sided window (x = +-BODY_BAND, width
 *  1 px into the band) at only 5 covering fills at radius 16 ->
 *  composite 1-0.45^5 = 0.9815 < 0.99 at STREAK_ALPHA 0.55 (needs
 *  k >= 6). Tightened until the arithmetic is guaranteed: worst gap
 *  0.18 px packs floor(1.0 / 0.18) = 5 plus the edge lane = 6 body
 *  fills inside the 1 px core half-width (5 x 0.18 + jitter < 1),
 *  and the first rim lane covers the outer edge too ->
 *  composite >= 1-0.45^6 = 0.9917 >= 0.99 at every body sample.
 *  MIN keeps a >= 0.14 px draw gap (amp = min(w - MIN - eps,
 *  REACH - w) stays positive, so the strata keep seeded jitter). */
const BODY_GAP_PX = 0.16
const BODY_MIN_GAP_PX = 0.14
const BODY_MAX_REACH_PX = 0.18
/** Rim count = RIM_COUNT_RATIO x body count: keeps the D-02 density
 *  ratio (1/1.04) / (0.45/0.96) = 2.05 >= 1.5 while leaving each rim
 *  stratum enough span for the Poisson floor (capacity ~0.34 x unique
 *  count per the global spacing — 0.45 stays well inside it). */
const RIM_COUNT_RATIO = 0.45

export interface BristleLane {
  /** Normalized lateral offset in [-1, 1]. */
  offset: number
  /** Base width in px (pre-pMod, pre-gauge, pre-clamp). */
  width: number
}

/** Gap arithmetic margin: safely above the op-log vertex rounding
 *  (y.toFixed(3) -> <= 1.25e-5 normalized at radius 40). */
const GAP_EPS = 1e-4

function poissonGap(count: number): number {
  return POISSON_FILL * (2 / (count - 1)) + GAP_EPS
}

/** Smallest body-lane count whose strata gaps sit inside
 *  [BODY_MIN_GAP_PX, BODY_MAX_REACH_PX] px — the k_body >= 4 overlap
 *  law by construction (260929-j47; count ~ radius, R6). */
function bodyCountFor(count: number): number {
  return Math.max(4, Math.ceil((2 * BODY_BAND * count) / BODY_GAP_PX) + 1)
}

/** Stratified positions across [lo, hi] with seeded jitter bounded so
 *  adjacent gaps stay in [minGap, maxReach] (both by construction). */
function strataPositions(
  strokeSeed: number,
  key: string,
  n: number,
  lo: number,
  hi: number,
  minGap: number,
  maxReach: number,
): number[] {
  if (n <= 0) return []
  if (n === 1) return [(lo + hi) / 2]
  const w = (hi - lo) / (n - 1)
  const amp = Math.max(0, Math.min(w - minGap - GAP_EPS, maxReach - w))
  for (let attempt = 0; attempt < POISSON_MAX_ATTEMPTS; attempt++) {
    const pos: number[] = []
    for (let k = 0; k < n; k++) {
      const u = seededDraw(strokeSeed, `${key}#${k}#${attempt}`, 'poisson')
      pos.push(Math.min(hi, Math.max(lo, lo + k * w + (u - 0.5) * amp)))
    }
    let ok = true
    for (let k = 1; k < n; k++) {
      if (pos[k] - pos[k - 1] < minGap - GAP_EPS / 2) { ok = false; break }
    }
    if (ok) return pos
  }
  // Fallback: unjittered stratum centers — spacing w >= minGap holds
  // by the bodyCountFor / rim capacity arithmetic above.
  return Array.from({ length: n }, (_, k) => lo + k * w)
}

function widthFor(offset: number, strokeSeed: number, index: number): number {
  const inBody = Math.abs(offset) <= BODY_BAND
  const min = inBody ? BODY_WIDTH_MIN : RIM_WIDTH_MIN
  const max = inBody ? BODY_WIDTH_MAX : RIM_WIDTH_MAX
  return min + seededDraw(strokeSeed, `b${index}`, 'width') * (max - min)
}

/**
 * One shared tier-independent lane layout (D-05): overlap-packed body
 * strata (k_body >= 4 law, 260929-j47) + seeded Poisson-gap rim strata
 * (D-13 rim law) with the baked two-band density profile (D-02),
 * per-lane widths from the named body/rim px ranges. Seeded only —
 * same strokeSeed reproduces byte-identical lanes.
 */
export function buildBristleLanes(strokeSeed: number, count: number): BristleLane[] {
  const c = Math.max(2, count)
  const nBody = bodyCountFor(c)
  const nRim = Math.max(2, Math.ceil(RIM_COUNT_RATIO * nBody))
  const nLeft = Math.ceil(nRim / 2)
  const nRight = nRim - nLeft

  // Unique lane count — the rim Poisson floor is asserted against
  // exactly this quantity by the D-13 pin.
  const nUnique = nBody + nRim
  const rimGap = poissonGap(nUnique)

  // Reach bounds in normalized units: strata gaps are measured in px
  // via offset x radius, and count ~ radius (R6) — px ~= norm x count.
  const reachNorm = BODY_MAX_REACH_PX / c
  const bodyMinGapNorm = BODY_MIN_GAP_PX / c
  // Rim outer edge (260929-m2z): the R7 outline centreline clamps to
  // halfW - w/2 so the full fibre width stays inside the ribbon — if
  // the outermost rim lane were laid at the old 1 - rimGap/2 edge its
  // centreline would clamp inward and SHRINK the recovered outer gap
  // below the D-13 Poisson floor (measured: 0.0041 < 0.0055 at radius
  // 40). Pull the edge in by the worst-case rim half-width (in norm
  // units: (RIM_WIDTH_MAX x max pMod x max gauge / 2) / count) so the
  // strata are never clamped; the old rimGap/2 floor stays for small
  // counts where it is larger.
  const rimHalfWorstNorm = ((RIM_WIDTH_MAX * 1.5 * 1.15) / 2 + 0.001) / c
  const rimEdge = Math.max(Math.min(rimGap / 2, 0.02), rimHalfWorstNorm + GAP_EPS)

  const body = strataPositions(strokeSeed, 'pb', nBody, -BODY_BAND, BODY_BAND, bodyMinGapNorm, reachNorm)
  const left = strataPositions(strokeSeed, 'pl', nLeft, -1 + rimEdge, -BODY_BAND - rimGap, rimGap, Number.POSITIVE_INFINITY)
  const right = strataPositions(strokeSeed, 'pr', nRight, BODY_BAND + rimGap, 1 - rimEdge, rimGap, Number.POSITIVE_INFINITY)

  const offsets = [...left, ...body, ...right].sort((a, b) => a - b)
  return offsets.map((offset, i) => ({ offset, width: widthFor(offset, strokeSeed, i) }))
}
