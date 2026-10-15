// ============================================================
//  drying.ts — fix / dry / paper-tooth granulation (AQUA-01 / R1.4).
//
//  The four-role texture law (P6 / D-21) — deposit / drying /
//  paper tooth / granulation — and NO fifth role. Engine-side
//  paper influence (granulation settle, dry-brush skip) is the
//  DEPOSIT role only: it bakes into transparent pixels and is
//  never the display fond (that is paperPass).
//
//  56-03 RED stub — the look-law tests pin the tide-line and
//  fix behavior this module must produce; implementation lands
//  in GREEN.
// ============================================================

import type { FluidSheet } from './fluid'

/**
 * Advance drying by `dt`: dry-rate curve (edge-localized so the
 * wet front recedes), mobile → fixed pigment (`fix`), paper-tooth
 * granulation settle, dry-brush skip. No forced Dry at frame
 * boundaries (P4) — this runs continuously on the tick grid.
 */
export function fixDrying(_sheet: FluidSheet, _dt: number): void {
  // 56-03 RED stub — intentionally unimplemented.
}
