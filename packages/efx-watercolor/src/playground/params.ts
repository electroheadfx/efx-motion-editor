// ============================================================
//  params.ts — the ONE canonical ↔ vendor Params mapping.
//
//  Record stores CANONICAL AQUA-04 globals (size 1..80 px, the
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
 * Canonical AQUA-04 globals → vendor `Params` (all 0..1).
 * `size` is 1..80 px on the slider; the vendor takes a 0..1
 * footprint scale where 32 px ≈ 1.0.
 */
export function toEngineParams(
  canonical: Partial<AquarelleCanonicalParams> | Record<string, number> | undefined,
): Partial<Params> {
  const p = (canonical ?? {}) as Partial<AquarelleCanonicalParams>
  const d = DEFAULT_CANONICAL_PARAMS
  return {
    size: Math.max(0, Math.min(1, num(p.size, d.size) / 32)),
    water: num(p.water, d.water) / 100,
    load: num(p.load, d.load) / 100,
    flow: num(p.flow, d.flow) / 100,
    bleed: num(p.bleed, d.bleed) / 100,
    dry: num(p.dry, d.dry) / 100,
    edge: num(p.edge, d.edge) / 100,
    granulation: num(p.granulation, d.granulation) / 100,
  }
}
