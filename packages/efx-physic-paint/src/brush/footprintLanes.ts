// ============================================================
//  Footprint lane builder + look constants (52.4-02, 260929-j47)
//  — Claude's Discretion, judged at UAT per 52.4-CONTEXT.
//  Pure seeded geometry: no pixels, no Preact, no alpha/color on
//  the lane type (D-02 geometry only; source-shape prohibitions).
//
//  Placement (260929-j47): the body band is OVERLAP-PACKED to the
//  k_body >= 4 core-lane law — the body's Poisson min-gap role is
//  superseded per user authority (52.4-04 deviation 2 fix path), so
//  composite PIN 0 1-prod(1-ga) >= 0.99 is reached by many low-alpha
//  lanes, never by one near-opaque lane. Strata jitter keeps the
//  structure seeded and non-lattice. The rim band keeps the seeded
//  Poisson-gap floor against the unique-lane lattice spacing (D-13,
//  rim only) with the baked body/rim density profile (D-02).
// ============================================================

import { seededDraw } from '../util/traceSeed'

/** Core streak alpha (D-10/D-11) — inside the locked [0.4, 0.55] band,
 *  judged at UAT. PIN 0 is the COMPOSITE body opacity
 *  1-(1-a)^k over core + soft-under lanes (user authority, 260929-j47):
 *  saturation comes from k_body >= 4 overlapping core lanes co-designed
 *  with the overlap-packed body strata — the old 0.995 k=1 conflict
 *  value is gone (the deviation documented in 52.4-04-SUMMARY). */
export const STREAK_ALPHA = 0.5
/** Soft-under pass alpha (260929-j47): the wide very-low-alpha under-
 *  pass drawn beneath every core trace so the composite edge fades
 *  continuously (R1 look) and the composite law has a second term to
 *  lean on. Co-designed: composite >= 0.99 at the body edge needs
 *  1-0.5^4 x (1-SOFT)^8 >= 0.99 -> SOFT >= 0.199, so the top of the
 *  plan's ~0.10-0.25 discretion keeps real margin. */
export const SOFT_EDGE_ALPHA = 0.25
/** D-12(b) floor above the sub-pixel hairline (final tier, post-clamp). */
export const WIDTH_FLOOR = 0.5
/** D-12(b) core ceiling (USER AUTHORITY): every core-pass trace stays
 *  within 2 px — the visible streak core is sub-2 px. */
export const CORE_MAX_TRACE_WIDTH = 2
/** D-12(b) two-tier ceiling: the RAISED soft-under ceiling — the wide
 *  low-alpha pass clamps here (raw x SOFT_WIDTH_MUL at p=1 tops out
 *  ~6.9 px, so 6 admits the full soft width while bounding op cost);
 *  the core pass never uses it. */
export const MAX_TRACE_WIDTH = 6
/** Soft-under width multiplier: soft lw = raw x this, clamped
 *  [WIDTH_FLOOR, MAX_TRACE_WIDTH] — roughly doubles the core trace so
 *  the low-alpha under-pass straddles the core on both sides. */
export const SOFT_WIDTH_MUL = 2
/** 260929-j47 hairline regime threshold: radius < HAIRLINE_RADIUS draws
 *  1-3 continuous seeded soft streaks (two-pass) instead of the lane
 *  field — no skip stream, no run-boundary breaks, one unbroken path
 *  per pass. Chosen between the battery bounds: ABOVE the radius-3
 *  real-raster cell (plan lower bound) and BELOW every bristleSeed
 *  lane-field pin (radii 16/20/32/40). 8 keeps the radius-8
 *  deposit-gate/layering cells on the lane field (8 < 8 is false)
 *  while radius 3/6 pipeline cells take the hairline path. */
export const HAIRLINE_RADIUS = 8
/** D-13 rim min adjacent normalized gap = POISSON_FILL x lattice
 *  spacing of the UNIQUE (two-pass deduped) lane count. 0.7 unchanged;
 *  the body band no longer uses it (superseded by k_body overlap). */
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
 *  (0.8) = 2.04 > CORE_MAX_TRACE_WIDTH, so at p = 1 every body core
 *  trace clamps to exactly 2 px — a 1 px half-width that makes the
 *  k_body >= 4 edge-window arithmetic deterministic (260929-j47). */
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
/** Body overlap packing (260929-j47): target mean adjacent body gap in
 *  px (count ~ radius, so px ~= norm x count). Worst-case gap is
 *  BODY_MAX_REACH_PX; the band-edge one-sided window then holds
 *  4 core lanes inside the 1 px core half-width (3 x 0.28 + jitter
 *  < 1). */
const BODY_GAP_PX = 0.24
const BODY_MIN_GAP_PX = 0.14
const BODY_MAX_REACH_PX = 0.28
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

  // Unique (two-pass deduped) lane count — the rim Poisson floor is
  // asserted against exactly this quantity by the D-13 pin.
  const nUnique = nBody + nRim
  const rimGap = poissonGap(nUnique)

  // Reach bounds in normalized units: strata gaps are measured in px
  // via offset x radius, and count ~ radius (R6) — px ~= norm x count.
  const reachNorm = BODY_MAX_REACH_PX / c
  const bodyMinGapNorm = BODY_MIN_GAP_PX / c
  const rimEdge = Math.min(rimGap / 2, 0.02)

  const body = strataPositions(strokeSeed, 'pb', nBody, -BODY_BAND, BODY_BAND, bodyMinGapNorm, reachNorm)
  const left = strataPositions(strokeSeed, 'pl', nLeft, -1 + rimEdge, -BODY_BAND - rimGap, rimGap, Number.POSITIVE_INFINITY)
  const right = strataPositions(strokeSeed, 'pr', nRight, BODY_BAND + rimGap, 1 - rimEdge, rimGap, Number.POSITIVE_INFINITY)

  const offsets = [...left, ...body, ...right].sort((a, b) => a - b)
  return offsets.map((offset, i) => ({ offset, width: widthFor(offset, strokeSeed, i) }))
}
