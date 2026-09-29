// ============================================================
//  Footprint lane builder + look constants (52.4-02) — Claude's
//  Discretion, judged at UAT per 52.4-CONTEXT.
//  Pure seeded geometry: no pixels, no Preact, no alpha/color on
//  the lane type (D-02 geometry only; source-shape prohibitions).
//
//  Placement: seeded two-band stratified jitter (D-13 law: every
//  adjacent normalized gap >= POISSON_FILL x lattice spacing,
//  non-lattice structure; D-02 law: body denser and wider than
//  rim). NOTE (deviation recorded in 52.4-02-SUMMARY): the plan's
//  example dart-throwing (random sequential adsorption) provably
//  jams below the required count (car-parking limit ~0.748 x
//  span / minGap) and cannot reach the required body/rim density
//  ratio — stratified placement satisfies both laws by
//  construction while remaining fully seeded and keyed by
//  seededDraw slots.
// ============================================================

import { seededDraw } from '../util/traceSeed'

/** The single constant streak alpha at both tiers (D-10/D-11) —
 *  co-designed with the PIN 0 saturation pin: at k = 1 lane the
 *  coverage 1-(1-ALPHA)^1 must reach >= 0.99 with FP margin, so the
 *  initial 0.9 rose to 0.995 (k>=2 at 0.9 is unreachable inside the
 *  sub-2 px ceiling). Judged at UAT. */
export const STREAK_ALPHA = 0.995
/** D-12(b) floor above the sub-pixel hairline (final tier, post-clamp). */
export const WIDTH_FLOOR = 0.5
/** D-12(b) ceiling — the spec's sub-2 px trace-width bound (final tier). */
export const MAX_TRACE_WIDTH = 2
/** D-13 min adjacent normalized gap = POISSON_FILL x lattice spacing.
 *  0.7 (initial 0.8): co-designed with the saturation pin so the
 *  body-band tiling reach covers every gap at reference radii. */
export const POISSON_FILL = 0.7
/** D-02 normalized body/rim split for the baked lateral density profile
 *  (initial 0.4): raised so the body band carries the density ratio AND
 *  the sub-2 px tiling reach at radii 16/32. */
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
 *  Min is the saturation-tiling floor: min width x pMod(1.5) x gauge
 *  floor (0.8) >= widest body stratum gap at reference radii. */
export const BODY_WIDTH_MIN = 1.3
export const BODY_WIDTH_MAX = 1.6
/** D-02 rim-lane base width range (px), |offset| > BODY_BAND —
 *  strictly thinner mean than body (rim translucency by coverage). */
export const RIM_WIDTH_MIN = 0.5
export const RIM_WIDTH_MAX = 0.9
/** Bounded jitter attempts per lane before the unjittered stratum
 *  fallback (the strata already satisfy the gap law, so the fallback
 *  is always valid). */
export const POISSON_MAX_ATTEMPTS = 24

export interface BristleLane {
  /** Normalized lateral offset in [-1, 1]. */
  offset: number
  /** Base width in px (pre-pMod, pre-gauge, pre-clamp). */
  width: number
}

/** pMod at p = 1 (paint.ts: 0.5 + p * 1.0) — reach floor math only. */
const PMOD_P1 = 1.5
/** Gauge floor = 1 + (fbm_min - 0.5) * A, fbm_min = 0. */
const GAUGE_FLOOR = 1 - NW_AMPLITUDE / 2
/** Minimum possible mid-stroke body lw in px at p = 1 — the tiling
 *  reach every body-band gap must fit inside (PIN 0 saturation,
 *  k >= 1 at STREAK_ALPHA). */
const MIN_BODY_LW_PX = BODY_WIDTH_MIN * PMOD_P1 * GAUGE_FLOOR
/** Gap arithmetic margin: safely above the op-log vertex rounding
 *  (y.toFixed(3) -> <= 1.25e-5 normalized at radius 40). */
const GAP_EPS = 1e-4

function poissonGap(count: number): number {
  return POISSON_FILL * (2 / (count - 1)) + GAP_EPS
}

/** Smallest body-lane count meeting BOTH the D-02 density ratio
 *  (>= 1.5) and the sub-2 px tiling reach (stratum width <= min
 *  reach), capped by the band capacity. count ~ radius (R6). */
function bodyCountFor(count: number): number {
  const g = poissonGap(count)
  const ratioNeed = Math.ceil((count * 1.5 * BODY_BAND) / (1 + 0.5 * BODY_BAND))
  const span = 2 * BODY_BAND - g // usable body span (band edge margin g/2 per side)
  const tilingNeed = Math.ceil((span * count) / MIN_BODY_LW_PX) + 1
  const capacity = Math.floor(span / g) + 1
  return Math.max(1, Math.min(count, capacity, Math.max(ratioNeed, tilingNeed)))
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
  // by the capacity/tiling caps in bodyCountFor.
  return Array.from({ length: n }, (_, k) => lo + k * w)
}

function widthFor(offset: number, strokeSeed: number, index: number): number {
  const inBody = Math.abs(offset) <= BODY_BAND
  const min = inBody ? BODY_WIDTH_MIN : RIM_WIDTH_MIN
  const max = inBody ? BODY_WIDTH_MAX : RIM_WIDTH_MAX
  return min + seededDraw(strokeSeed, `b${index}`, 'width') * (max - min)
}

/**
 * One shared tier-independent lane layout (D-05): Poisson-gap-law
 * lateral placement with the baked two-band density profile (D-02),
 * per-lane widths from the named body/rim px ranges. Seeded only —
 * same strokeSeed reproduces byte-identical lanes.
 */
export function buildBristleLanes(strokeSeed: number, count: number): BristleLane[] {
  const c = Math.max(2, count)
  const g = poissonGap(c)
  const half = g / 2 // band-edge margin: body/rim cross gap = 2 * half = g
  const nBody = bodyCountFor(c)
  const nRim = c - nBody
  const nLeft = Math.ceil(nRim / 2)
  const nRight = nRim - nLeft

  // Reach bound in normalized units: stratum gaps are measured in px
  // via offset x radius, and count ~ radius (R6) — px ~= norm x count.
  const reachNorm = MIN_BODY_LW_PX / c

  const body = strataPositions(strokeSeed, 'pb', nBody, -BODY_BAND + half, BODY_BAND - half, g, reachNorm)
  const left = strataPositions(strokeSeed, 'pl', nLeft, -1 + half, -BODY_BAND - half, g, Number.POSITIVE_INFINITY)
  const right = strataPositions(strokeSeed, 'pr', nRight, BODY_BAND + half, 1 - half, g, Number.POSITIVE_INFINITY)

  const offsets = [...left, ...body, ...right].sort((a, b) => a - b)
  return offsets.map((offset, i) => ({ offset, width: widthFor(offset, strokeSeed, i) }))
}
