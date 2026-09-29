// ============================================================
//  Footprint lane look constants (52.4-02) — Claude's Discretion,
//  judged at UAT per 52.4-CONTEXT.
//  Constants-only interface: the RED look-geometry pins import these
//  before the lane builder exists. Pure numbers — no imports, no
//  pixels, no Preact, no alpha/color fields.
// ============================================================

/** The single constant streak alpha at both tiers (D-10/D-11) — co-designed
 *  with the PIN 0 saturation pin: coverage = 1-(1-ALPHA)^k. */
export const STREAK_ALPHA = 0.9
/** D-12(b) floor above the sub-pixel hairline (final tier, post-clamp). */
export const WIDTH_FLOOR = 0.5
/** D-12(b) ceiling — the spec's sub-2 px trace-width bound (final tier). */
export const MAX_TRACE_WIDTH = 2
/** D-13 min adjacent normalized gap = POISSON_FILL x lattice spacing. */
export const POISSON_FILL = 0.8
/** D-02 normalized body/rim split for the baked lateral density profile. */
export const BODY_BAND = 0.4
/** D-12(a) nW gauge amplitude — the UAT edge-chatter lever. */
export const NW_AMPLITUDE = 0.4
/** D-02 body-lane base width range (px), |offset| <= BODY_BAND. */
export const BODY_WIDTH_MIN = 0.8
export const BODY_WIDTH_MAX = 1.3
/** D-02 rim-lane base width range (px), |offset| > BODY_BAND. */
export const RIM_WIDTH_MIN = 0.5
export const RIM_WIDTH_MAX = 0.9
