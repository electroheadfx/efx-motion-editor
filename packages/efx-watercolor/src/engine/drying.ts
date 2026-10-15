// ============================================================
//  drying.ts — fix / dry / paper-tooth granulation (AQUA-01 / R1.4).
//
//  The four-role texture law (P6 / D-21) — deposit / drying /
//  paper tooth / granulation — and NO fifth role. Engine-side
//  paper influence (granulation settle, dry-brush skip) is the
//  DEPOSIT role only: it bakes into transparent pixels and is
//  never the display fond (that is paperPass).
//
//  Mechanisms:
//    · edge-localized dry rate — a pixel with fewer wet
//      neighbours evaporates faster, so the wet front recedes
//      from the outside in (the tide-line precondition)
//    · drying-front pigment pull — mobile pigment is drawn
//      toward the receding boundary (wetness gradient), piling
//      up where the wash will finally set (the dark rim)
//    · fix — mobile → fixed pigment when wetness drops below the
//      fix threshold, and a granulation settle term that locks a
//      fraction of mobile pigment as the sheet dries
//
//  No forced Dry at frame boundaries (P4) — this runs
//  continuously on the integer tick grid (DATA-03).
// ============================================================

import { WET_EPS, transferMobile, type FluidSheet } from './fluid'

/** Wetness drop per tick for a fully-surrounded interior pixel. */
const DRY_RATE = 0.010
/** Extra dry-rate per missing wet neighbour (1.0 interior .. ~2.8 isolated). */
const EDGE_DRY_EXTRA = 0.42
/** Wetness below this fixes all remaining mobile pigment in place. */
const FIX_THRESHOLD = 0.06
/** Fraction of mobile pigment that settles per tick as wetness falls. */
const GRANULATION = 0.035
/** Drying-front pull strength — pigment migrates toward the receding edge. */
const FRONT_PULL = 0.22
/** Cap on the fraction of a donor's mobile pigment the front may pull per tick. */
const MAX_PULL_FRACTION = 0.35

function isWet(sheet: FluidSheet, i: number): boolean {
  return (sheet.wet[i] ?? 0) > WET_EPS
}

/** Lock every mobile pigment channel into the fixed buffers at `i`. */
function fixAllAt(sheet: FluidSheet, i: number): void {
  const m = sheet.mobile[i] ?? 0
  if (m <= 0) return
  sheet.fixed[i] = (sheet.fixed[i] ?? 0) + m
  sheet.fixedR[i] = (sheet.fixedR[i] ?? 0) + (sheet.mobileR[i] ?? 0)
  sheet.fixedG[i] = (sheet.fixedG[i] ?? 0) + (sheet.mobileG[i] ?? 0)
  sheet.fixedB[i] = (sheet.fixedB[i] ?? 0) + (sheet.mobileB[i] ?? 0)
  sheet.mobile[i] = 0
  sheet.mobileR[i] = 0
  sheet.mobileG[i] = 0
  sheet.mobileB[i] = 0
}

/**
 * Advance drying by `dt`: dry-rate curve (edge-localized so the
 * wet front recedes), drying-front pigment pull, mobile → fixed
 * (`fix`), paper-tooth granulation settle. Dry-brush skip lives
 * in deposit.ts (the deposit role) — it decides whether a low-
 * wetness stamp lands at all.
 */
export function fixDrying(sheet: FluidSheet, dt: number): void {
  if (!(dt > 0)) return
  const { width: w, height: h, wet, mobile } = sheet

  // 1. Drying-front pull — run BEFORE wetness drops so the front
  //    is still well defined. Pigment moves toward lower wetness.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!isWet(sheet, i)) continue
      const donor = mobile[i] ?? 0
      if (donor <= 0) continue
      const wetI = wet[i] ?? 0

      // Pull from this pixel toward each drier wet neighbour.
      const neighbours: number[] = []
      if (x > 0) neighbours.push(i - 1)
      if (x + 1 < w) neighbours.push(i + 1)
      if (y > 0) neighbours.push(i - w)
      if (y + 1 < h) neighbours.push(i + w)

      for (const j of neighbours) {
        if (!isWet(sheet, j)) continue
        const wetJ = wet[j] ?? 0
        const dw = wetI - wetJ
        if (dw <= 0) continue
        const share = Math.min(MAX_PULL_FRACTION, FRONT_PULL * dw * dt)
        transferMobile(sheet, i, j, donor * share)
      }
    }
  }

  // 2. Edge-localized drying + granulation settle + fix.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const wetI = wet[i] ?? 0
      if (wetI <= 0) continue

      let wetNeighbours = 0
      if (x > 0 && isWet(sheet, i - 1)) wetNeighbours++
      if (x + 1 < w && isWet(sheet, i + 1)) wetNeighbours++
      if (y > 0 && isWet(sheet, i - w)) wetNeighbours++
      if (y + 1 < h && isWet(sheet, i + w)) wetNeighbours++

      const edgeFactor = 1 + (4 - wetNeighbours) * EDGE_DRY_EXTRA
      const nextWet = wetI - DRY_RATE * edgeFactor * dt
      wet[i] = nextWet > 0 ? nextWet : 0

      // Granulation settle: a fraction of mobile pigment locks as
      // the sheet dries (DEPOSIT role, P6 — not a fifth role).
      const m = mobile[i] ?? 0
      if (m > 0) {
        const settle = Math.min(1, GRANULATION * (1 - (wet[i] ?? 0)) * dt)
        const moved = m * settle
        if (moved > 0) {
          const share = moved / m
          sheet.fixed[i] = (sheet.fixed[i] ?? 0) + moved
          sheet.fixedR[i] = (sheet.fixedR[i] ?? 0) + (sheet.mobileR[i] ?? 0) * share
          sheet.fixedG[i] = (sheet.fixedG[i] ?? 0) + (sheet.mobileG[i] ?? 0) * share
          sheet.fixedB[i] = (sheet.fixedB[i] ?? 0) + (sheet.mobileB[i] ?? 0) * share
          sheet.mobile[i] = m - moved
          sheet.mobileR[i] = (sheet.mobileR[i] ?? 0) * (1 - share)
          sheet.mobileG[i] = (sheet.mobileG[i] ?? 0) * (1 - share)
          sheet.mobileB[i] = (sheet.mobileB[i] ?? 0) * (1 - share)
        }
      }

      // Fix the remainder once the pixel is effectively dry.
      if ((wet[i] ?? 0) < FIX_THRESHOLD) {
        fixAllAt(sheet, i)
        if ((wet[i] ?? 0) < WET_EPS) wet[i] = 0
      }
    }
  }
}

/**
 * User-initiated Dry (D-15) — flash-dry the sheet at its tick.
 * Locks every wet pixel's mobile pigment into the fixed buffers
 * and zeroes wetness. This is an explicit recorded gesture, NOT
 * the prohibited forced Dry at frame boundaries (P4 / D-28).
 */
export function forceDrySheet(sheet: FluidSheet): void {
  const { width: w, height: h, wet, mobile } = sheet
  const n = w * h
  for (let i = 0; i < n; i++) {
    if ((wet[i] ?? 0) <= 0 && (mobile[i] ?? 0) <= 0) continue
    fixAllAt(sheet, i)
    wet[i] = 0
  }
}
