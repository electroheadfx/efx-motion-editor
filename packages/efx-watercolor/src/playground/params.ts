// ============================================================
//  params.ts — the ONE canonical ↔ vendor Params mapping.
//
//  Record stores CANONICAL AQUA-04 globals (size 1..800 px, the
//  other seven 0..100). Live and bake BOTH map through
//  toEngineParams() so the two halves cannot drift (A1/A2).
//  Never store the mapped 0..1 values in the payload.
//
//  64-22: every slider member is 0..100 and maps to 0..1 through
//  this file — EXCEPT `wetSeconds`, the one canonical member in
//  SECONDS (1..30, §3.4/§6), which is forwarded as-is with a
//  one-second floor and must never be divided by 100.
// ============================================================

import type { Params } from './Engine'

/**
 * The 8 AQUA-04 globals as the UI records them, plus the Lift strength and
 * the Phase 64 medium keys (viscosity, body, emboss, then 64-22's feather,
 * pickup, refill and the seconds-valued wetSeconds).
 */
export interface AquarelleCanonicalParams {
  size: number
  water: number
  load: number
  flow: number
  bleed: number
  dry: number
  edge: number
  granulation: number
  /**
   * 261028-k03b: Lift (eraser) strength 0..100. 22 is the pre-strength
   * hardcoded per-dab amount (0.22), so every recorded stroke without the
   * key keeps its exact old erase on replay.
   */
  lift: number
  /**
   * Phase 64 (v2.2.0): how thick the medium is, 0..100. 0 is the neutral
   * default — a project painted before the key existed renders
   * byte-identically. The engine raises water-motion dissipation and
   * lowers its diffusion floor from this one value.
   */
  viscosity: number
  /**
   * Phase 64 (v2.2.0): how much a covering stroke replaces the settled paint
   * under it, 0..100. 0 is neutral (no cover pass) — declared here, consumed
   * by its own plan.
   */
  body: number
  /**
   * Phase 64 (v2.2.0): how strongly the paint thickness is lit as relief,
   * 0..100. 0 is neutral (flat paint) — declared here, consumed by its own
   * plan.
   */
  emboss: number
  /**
   * 64-22 (D-22, §6): the gather's coverage-band width, 0..100. Widens the
   * §4.4 softness band on a bristle response; non-bristle responses never
   * read it. 0 is the §6 `paint.softness` band (0.09).
   */
  feather: number
  /**
   * 64-22 (§3.1, §6): how much paint a bristle picks up from the sheet it
   * crosses, 0..100. 60 is the reference's §6 `mixing.pickup` default.
   */
  pickup: number
  /**
   * 64-22 (§3.1, §6): how fast a bristle refills from the brush's own load,
   * 0..100. 60 is the reference's §6 `mixing.refill` default.
   */
  refill: number
  /**
   * 64-22 (§3.4, §6): the last-touch wetness lifetime in SECONDS (1..30).
   * This is the ONE canonical member that is not normalised — it is
   * forwarded as seconds with a 1-second floor, never divided by 100.
   * 7 is the §6 `mixing.wetSeconds` default. Consumed by 64-24.
   */
  wetSeconds: number
}

export const DEFAULT_CANONICAL_PARAMS: Readonly<AquarelleCanonicalParams> = Object.freeze({
  size: 12,
  water: 50,
  load: 50,
  flow: 50,
  bleed: 50,
  dry: 50,
  edge: 50,
  granulation: 50,
  lift: 22,
  viscosity: 0,
  body: 0,
  emboss: 0,
  feather: 0,
  pickup: 60,
  refill: 60,
  wetSeconds: 7,
})

function num(v: number | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Phase 64: the medium keys this milestone adds (viscosity first) are the
 * only clamped ones. A typed canonical value can overshoot its slider
 * track; the engine uniforms must never see an out-of-range number
 * (T-64-01). Clamping lives here, in the ONE mapping, and nowhere else.
 */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Legacy top-bar domain. Every value at or below 80 keeps the exact
 * pre-400 mapping so recorded strokes render unchanged; the former
 * 33..80 band was already flat at the 1.0 vendor ceiling.
 */
export const LEGACY_SIZE_MAX_PX = 80
/** Largest size the Stroke Settings track shows. */
export const SIZE_MAX_PX = 800
/** Vendor footprint scale at 800 px: ~10x the footprint of an 80 px stroke. */
export const SIZE_SCALE_AT_MAX = 2.04795
/** Typed values may exceed the 800 px track; this safety ceiling keeps the
 *  vendor's exponential footprint finite (≈30k px) for absurd entries. */
const SIZE_SCALE_HARD_MAX = 4

/**
 * Canonical px → vendor footprint scale. Exported for the app's pixel-true
 * size helper (quick 261116-inu), whose inverse must mirror this law exactly.
 *
 * quick 261116-inu / Task 7: the former `Math.max(0, ...)` floor on the
 * sub-32 branch is REMOVED per the locked decision "The engine's size floor is
 * removed" — a negative canonical now maps linearly, so a real 1 px footprint
 * is reachable (Round at 1080 needs canonical ≈ −48.9). No recorded stroke can
 * hold a negative canonical, so every non-negative value maps byte-identically
 * to HEAD; the 32..80 flat band and the 80..800 band are untouched.
 */
export function sizeToEngineScale(sizePx: number): number {
  if (sizePx <= 32) return sizePx / 32
  if (sizePx <= LEGACY_SIZE_MAX_PX) return 1
  const t = (sizePx - LEGACY_SIZE_MAX_PX) / (SIZE_MAX_PX - LEGACY_SIZE_MAX_PX)
  return Math.min(SIZE_SCALE_HARD_MAX, 1 + t * (SIZE_SCALE_AT_MAX - 1))
}

/**
 * Canonical AQUA-04 globals → vendor `Params` (all 0..1, size may
 * exceed 1 above 80 px; `wetSeconds` is the one member carried in
 * seconds). `size` shows 1..800 px on the track; 32 px ≈ 1.0, and the
 * 80..800 band scales linearly (typed values above 800 keep growing to
 * a finite safety ceiling).
 */
export function toEngineParams(
  canonical: Partial<AquarelleCanonicalParams> | Record<string, number> | undefined,
): Partial<Params> {
  const p = (canonical ?? {}) as Partial<AquarelleCanonicalParams>
  const d = DEFAULT_CANONICAL_PARAMS
  return {
    size: sizeToEngineScale(num(p.size, d.size)),
    water: num(p.water, d.water) / 100,
    load: num(p.load, d.load) / 100,
    flow: num(p.flow, d.flow) / 100,
    bleed: num(p.bleed, d.bleed) / 100,
    dry: num(p.dry, d.dry) / 100,
    edge: num(p.edge, d.edge) / 100,
    granulation: num(p.granulation, d.granulation) / 100,
    lift: num(p.lift, d.lift) / 100,
    viscosity: clamp01(num(p.viscosity, d.viscosity) / 100),
    body: clamp01(num(p.body, d.body) / 100),
    emboss: clamp01(num(p.emboss, d.emboss) / 100),
    feather: clamp01(num(p.feather, d.feather) / 100),
    pickup: clamp01(num(p.pickup, d.pickup) / 100),
    refill: clamp01(num(p.refill, d.refill) / 100),
    // 64-22 (§3.4): SECONDS, the one non-normalised member. A positive floor
    // keeps the last-touch decay finite; absent/non-finite input falls back
    // to the §6 default so a pre-64-24 stroke replays unchanged.
    wetSeconds: Math.max(1, num(p.wetSeconds, d.wetSeconds)),
  }
}
