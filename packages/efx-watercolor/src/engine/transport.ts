// ============================================================
//  transport.ts — wet-gated pigment transport (AQUA-01 / R1.3).
//
//  Three terms, all operating only between pixels the wet mask
//  marks wet (conservation: never seeps onto dry paper):
//    1. capillary tide-line velocity (toward the receding wet
//       boundary — the dark-rim mechanism)
//    2. advection along the velocity field
//    3. wet-gated diffusion (closed neighbourhood)
//
//  56-03 RED stub — the look-law tests pin the behavior this
//  module must produce; the implementation lands in GREEN.
// ============================================================

import type { FluidSheet } from './fluid'

/**
 * Advance mobile pigment transport by `dt`.
 * Flux exists only between pixels where BOTH sides are wet.
 */
export function transportStep(_sheet: FluidSheet, _dt: number): void {
  // 56-03 RED stub — intentionally unimplemented.
}
