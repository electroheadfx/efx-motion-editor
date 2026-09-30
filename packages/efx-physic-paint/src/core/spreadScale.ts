// ============================================================
//  spreadScale — the ONE spread-curve law (D-11 local spread)
//
//  Consumed by BOTH EfxPaintEngine local-mode spread sites
//  (finalize continuation + local step) and by the three
//  engine-mirrored harnesses (physicsWidthScaling,
//  physicsSettledFootprint, productionAaSettleMeasurement).
//  Never inline (s/100)^2 anywhere else — this module owns it.
//
//  Law history:
//  - Base: legacy (s/100)^2 — strength scaled quadratically.
//  - 260925-b7c GREEN: calibration law (user decision 2026-09-25):
//    piecewise-linear in curve space — new 50 = old 30 (0.09),
//    new 100 = old 100 (1.0), 0 = 0, monotone in between.
//    The slider keeps min 0 / max 100 / label "Spread" / default 50;
//    stored Spread values are reinterpreted on the new scale
//    (project clean-break law — no migration).
// ============================================================

/** Clamp to [0, 100] (the engine setter already clamps — D-11 hardening). */
const clampStrength = (strength: number): number =>
  Math.min(100, Math.max(0, strength))

/** Spread curve in [0, 1] for a slider strength in [0, 100]. */
export const spreadCurveFor = (strength: number): number => {
  const s = clampStrength(strength)
  return s <= 50 ? 0.09 * (s / 50) : 0.09 + 0.91 * ((s - 50) / 50)
}

/**
 * R8 look lever (260930-libre, USER DESIGN ACT 2026-09-30c): `g` in
 * `depositRadius = brushR * (1 - g(spreadCurve))`. The physics clone is the
 * ONLY deposit the solver sees, and the solver runs UNCONSTRAINED.
 * `g(0) = 0` — at rest the deposit is full pressure width (matches the
 * fullR live preview). `g` reaches 0.5 at the working spread 65 ("2x
 * thinner", à estimer) and never exceeds it — the deposit cannot invert.
 * UAT look lever — tune here, never at the engine sites.
 */
export const depositRoom = (spreadCurve: number): number =>
  0.5 * Math.min(1, spreadCurve / spreadCurveFor(65))

/**
 * R9 tick floor (260930-continuity, USER DESIGN ACT 2026-09-30d): a look
 * lever scales the AMPLITUDE of one always-on process, never its presence.
 * `physicsTicks = max(TICK_FLOOR, ceil(spreadCurve*10))` — the floor sits at
 * or below the approved-range values (3 at 60-61, 4 at 62-65), so spread
 * 60-65 is byte-identical to the pre-floor law. `TICK_FLOOR = 3` is the UAT
 * look lever (à estimer) for "below 50 reads the same look, finer, harder"
 * instead of chalk. The count is never reduced to hold a width.
 */
export const TICK_FLOOR = 3

export const physicsTicks = (spreadCurve: number): number =>
  Math.max(TICK_FLOOR, Math.ceil(spreadCurve * 10))
