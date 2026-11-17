// ============================================================
//  scattering.ts — the ONE perceptual Body curve (Phase 64, D-14).
//
//  `Body` is the one control that does two jobs: it makes a stroke REPLACE
//  what it paints over (spec 06, the cover pass in Engine.ts) and, from spec
//  08, it makes the paint LIGHTEN what it covers (scattering). D-14 gives
//  both terms the same curve, so one control moves them together and the
//  physical-coherence claim holds. The curve is declared HERE, once; 64-08
//  extends this same module with the scattering deposit instead of declaring
//  a second curve.
//
//  Why not the identity — or spec 06 §3's inline `Math.min(1, P.body)`?
//  The cover pass erodes multiplicatively per dab, so ANY constant amount
//  destroys a glaze within a few overlapping dabs: Body 50 at 0.5 would erase
//  half the sheet at every stamp and read as a full cover. The sixth power
//  keeps low-mid Body near zero — bodyCurve(0.5) = 0.015625 — so Body 50 stays
//  a glaze, while Body 100 reaches exactly 1 and is a true cover at the tip
//  core. That is D-14's literal shape ("low-mid Body stays a glaze, only high
//  Body reaches a true cover") and it is what makes spec 08 UAT 3 ("Body 50
//  lightens without erasing; the dark still tints it") true. D-14 supersedes
//  spec 06 §3's inline min-of-one clamp on `P.body`.
//
//  Scattering transport (64-08): the deposit law turns Body into the one
//  broadband scalar S the engine transports. `SCATTERING_MAX` is the S of a
//  fully body-saturated medium at unit amount. `SCATTER_EPSILON` is the
//  render-side switch below which 64-09 runs the legacy exponential verbatim,
//  so it stays many orders below any real deposit — Body 50 at unit amount
//  deposits 0.125, 125x the epsilon — and no visible paint takes the cheap
//  branch.
//
//  Pure functions with no engine import: the laws are laws, not render state.
// ============================================================

/** D-14's exponent: low-mid Body stays a glaze; 1.0 still reaches a true cover. */
export const BODY_CURVE_EXPONENT = 6;

/** The S of a fully body-saturated medium at unit amount (MED-32). */
export const SCATTERING_MAX = 8;

/** Below this S, 64-09's render path runs the legacy exponential verbatim. */
export const SCATTER_EPSILON = 1e-3;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * The one perceptual Body curve (D-14): `clamp01(body) ^ BODY_CURVE_EXPONENT`.
 * The input is the canonical 0..1 `P.body`; a non-finite value maps to the
 * neutral 0. Exact values the phase pins: 0 → 0, 0.5 → 0.015625 (a glaze),
 * 1 → 1 (a true cover at the tip core).
 */
export function bodyCurve(body: number): number {
  if (!Number.isFinite(body)) return 0;
  return Math.pow(clamp01(body), BODY_CURVE_EXPONENT);
}

/**
 * The deposit law (MED-32): `SCATTERING_MAX * bodyCurve(body) * amount`.
 * `amount` is the dab's own pigment amount, so the channel accumulates in
 * proportion to the paint: a faint dab deposits a tiny S and stays
 * translucent, a heavy one deposits a large S and covers. The guard maps a
 * zero, negative or non-finite amount to exactly 0 and keeps `0 × Infinity`
 * from becoming NaN (T-64-22).
 */
export function scatteringDeposit(body: number, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return SCATTERING_MAX * bodyCurve(body) * amount;
}
