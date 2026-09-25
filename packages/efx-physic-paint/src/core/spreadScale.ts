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
