// ============================================================
//  params.ts — the ONE canonical ↔ vendor Params mapping.
//
//  Record stores CANONICAL AQUA-04 globals (size 1..800 px, the
//  other seven 0..100). Live and bake BOTH map through
//  toEngineParams() so the two halves cannot drift (A1/A2).
//  Never store the mapped 0..1 values in the payload.
// ============================================================

import type { Params } from './Engine'

/** The 8 AQUA-04 globals as the UI records them. */
export interface AquarelleCanonicalParams {
  size: number
  water: number
  load: number
  flow: number
  bleed: number
  dry: number
  edge: number
  granulation: number
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
})

function num(v: number | undefined, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/**
 * Legacy top-bar domain. Every value at or below 80 keeps the exact
 * pre-400 mapping so recorded strokes render unchanged; the former
 * 33..80 band was already flat at the 1.0 vendor ceiling.
 */
const LEGACY_SIZE_MAX_PX = 80
/** Largest size the Stroke Settings track shows. */
const SIZE_MAX_PX = 800
/** Vendor footprint scale at 800 px: ~10x the footprint of an 80 px stroke. */
const SIZE_SCALE_AT_MAX = 2.04795
/** Typed values may exceed the 800 px track; this safety ceiling keeps the
 *  vendor's exponential footprint finite (≈30k px) for absurd entries. */
const SIZE_SCALE_HARD_MAX = 4

function sizeToEngineScale(sizePx: number): number {
  if (sizePx <= 32) return Math.max(0, sizePx / 32)
  if (sizePx <= LEGACY_SIZE_MAX_PX) return 1
  const t = (sizePx - LEGACY_SIZE_MAX_PX) / (SIZE_MAX_PX - LEGACY_SIZE_MAX_PX)
  return Math.min(SIZE_SCALE_HARD_MAX, 1 + t * (SIZE_SCALE_AT_MAX - 1))
}

/**
 * Canonical AQUA-04 globals → vendor `Params` (all 0..1, size may
 * exceed 1 above 80 px). `size` shows 1..800 px on the track; 32 px
 * ≈ 1.0, and the 80..800 band scales linearly (typed values above
 * 800 keep growing to a finite safety ceiling).
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
  }
}
