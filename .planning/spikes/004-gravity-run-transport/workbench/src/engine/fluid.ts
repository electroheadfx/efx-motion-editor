// ============================================================
//  fluid.ts — aquarelle fluid sheet (AQUA-01).
//
//  Float32Array buffers: velocity (u,v), wetness, mobile
//  pigment, fixed pigment, plus mobile/fixed colour mass so
//  baked pixels carry the deposited hue. `step` orchestrates
//  transport + drying over the wet region only (R1.6 idle dry
//  sheet is a no-op). Integer ticks only (DATA-03) — dt is in
//  tick units, never raw milliseconds.
//
//  Look laws this sheet must produce (fluid.test.ts):
//    wet-in-wet bloom · hard wet-on-dry edge · tide line ·
//    conservation (never seeps onto dry paper) · four tools ·
//    same script ⇒ same pixels (D-20).
// ============================================================

import { transportStep } from './transport'
import { fixDrying } from './drying'

/** Wetness at or below this is treated as dry for the transport gate. */
export const WET_EPS = 1e-4

/**
 * Pigment density ceiling. BOTH deposit and transfer honour it —
 * without the transfer cap, tide-line pull piles every edge up to
 * marker opacity and a wash dies into donuts. Tuned so a fully
 * loaded wash tops out near 50% coverage: paper tooth stays visible
 * through the darkest stroke (the oracle never goes opaque).
 */
export const MAX_DENSITY = 0.62

/**
 * Per-stroke sim response (AQUA-04 globals, normalised 0..1).
 * Values scale the base transport/drying constants so a param of
 * 0.5 reproduces the tuned defaults. Live and bake both feed this
 * from the recorded param bag (one stepping law).
 */
export interface SimTuning {
  /** Water motion strength (capillary tide-line velocity). */
  flow: number
  /** Pigment diffusion through wet paper. */
  bleed: number
  /** Drying speed. */
  dry: number
  /** Tide-line darkening at the receding wet front. */
  edge: number
  /** Pigment settling into the paper grain. */
  granulation: number
}

/** Tuned defaults — param 0.5 on every axis. */
export const DEFAULT_SIM_TUNING: Readonly<SimTuning> = Object.freeze({
  flow: 0.5,
  bleed: 0.5,
  dry: 0.5,
  edge: 0.5,
  granulation: 0.5,
})

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Resolve a partial tuning onto the defaults, clamped 0..1. */
export function resolveTuning(partial?: Partial<SimTuning>): SimTuning {
  const d = DEFAULT_SIM_TUNING
  return {
    flow: clamp01(Number.isFinite(partial?.flow) ? partial!.flow! : d.flow),
    bleed: clamp01(Number.isFinite(partial?.bleed) ? partial!.bleed! : d.bleed),
    dry: clamp01(Number.isFinite(partial?.dry) ? partial!.dry! : d.dry),
    edge: clamp01(Number.isFinite(partial?.edge) ? partial!.edge! : d.edge),
    granulation: clamp01(
      Number.isFinite(partial?.granulation) ? partial!.granulation! : d.granulation,
    ),
  }
}

export interface FluidSheet {
  readonly width: number
  readonly height: number
  /** Horizontal velocity. */
  u: Float32Array
  /** Vertical velocity. */
  v: Float32Array
  /** Wetness per pixel (0 = dry). */
  wet: Float32Array
  /** Mobile (suspended) pigment density. */
  mobile: Float32Array
  /** Fixed (settled) pigment density. */
  fixed: Float32Array
  /** Mobile pigment colour mass (density × channel). */
  mobileR: Float32Array
  mobileG: Float32Array
  mobileB: Float32Array
  /** Fixed pigment colour mass (density × channel). */
  fixedR: Float32Array
  fixedG: Float32Array
  fixedB: Float32Array
}

/** Allocate a zeroed sheet. All pixels start dry and pigment-free. */
export function createSheet(width: number, height: number): FluidSheet {
  const w = Math.max(0, Math.trunc(width))
  const h = Math.max(0, Math.trunc(height))
  const n = w * h
  return {
    width: w,
    height: h,
    u: new Float32Array(n),
    v: new Float32Array(n),
    wet: new Float32Array(n),
    mobile: new Float32Array(n),
    fixed: new Float32Array(n),
    mobileR: new Float32Array(n),
    mobileG: new Float32Array(n),
    mobileB: new Float32Array(n),
    fixedR: new Float32Array(n),
    fixedG: new Float32Array(n),
    fixedB: new Float32Array(n),
  }
}

/** True when the sheet carries no wet pixel (R1.6 idle dry sheet). */
export function isDrySheet(sheet: FluidSheet): boolean {
  const wet = sheet.wet
  for (let i = 0; i < wet.length; i++) {
    if ((wet[i] ?? 0) > WET_EPS) return false
  }
  return true
}

/**
 * Advance the sim by one tick of `dt` (integer-tick units).
 * Wet-gated transport + drying. dt<=0 and an idle dry sheet are
 * no-ops (flagged assumptions AQUA-01) and cost no work.
 */
export function step(sheet: FluidSheet, dt: number, tuning?: Partial<SimTuning>): void {
  if (!(dt > 0)) return
  if (isDrySheet(sheet)) return
  const resolved = resolveTuning(tuning)
  transportStep(sheet, dt, resolved)
  fixDrying(sheet, dt, resolved)
}

/** Total pigment density (mobile + fixed) over the whole sheet. */
export function totalPigment(sheet: FluidSheet): number {
  let sum = 0
  for (let i = 0; i < sheet.mobile.length; i++) {
    sum += (sheet.mobile[i] ?? 0) + (sheet.fixed[i] ?? 0)
  }
  return sum
}

/** Count of pixels with wetness above the dry threshold. */
export function wetPixelCount(sheet: FluidSheet): number {
  let n = 0
  for (let i = 0; i < sheet.wet.length; i++) {
    if ((sheet.wet[i] ?? 0) > WET_EPS) n++
  }
  return n
}

/**
 * Deterministic byte view of every sheet buffer (end to end).
 * Used by the determinism pins — same script ⇒ same bytes.
 */
export function sheetToBytes(sheet: FluidSheet): Uint8Array {
  const buffers: Float32Array[] = [
    sheet.u,
    sheet.v,
    sheet.wet,
    sheet.mobile,
    sheet.fixed,
    sheet.mobileR,
    sheet.mobileG,
    sheet.mobileB,
    sheet.fixedR,
    sheet.fixedG,
    sheet.fixedB,
  ]
  let total = 0
  for (const b of buffers) total += b.byteLength
  const out = new Uint8Array(total)
  let offset = 0
  for (const b of buffers) {
    out.set(new Uint8Array(b.buffer, b.byteOffset, b.byteLength), offset)
    offset += b.byteLength
  }
  return out
}

/** Linear index of (x, y) — shared helper for the engine modules. */
export function sheetIndex(sheet: FluidSheet, x: number, y: number): number {
  return y * sheet.width + x
}

/**
 * Transfer `amount` of mobile pigment (and proportional colour
 * mass) from pixel `from` to pixel `to`. Amount may be negative
 * (reverse direction). Never drives a density below zero.
 */
export function transferMobile(
  sheet: FluidSheet,
  from: number,
  to: number,
  amount: number,
): void {
  if (amount === 0) return
  if (amount > 0) {
    const available = sheet.mobile[from] ?? 0
    // Never pile past MAX_DENSITY at the destination — the tide-line
    // pull would otherwise stack every edge into a dark ring.
    const destTotal = (sheet.mobile[to] ?? 0) + (sheet.fixed[to] ?? 0)
    const room = Math.max(0, MAX_DENSITY - destTotal)
    let moved = amount > available ? available : amount
    if (moved > room) moved = room
    if (moved <= 0) return
    const share = available > 0 ? moved / available : 0
    const r = (sheet.mobileR[from] ?? 0) * share
    const g = (sheet.mobileG[from] ?? 0) * share
    const b = (sheet.mobileB[from] ?? 0) * share
    sheet.mobile[from] = available - moved
    sheet.mobileR[from] = (sheet.mobileR[from] ?? 0) - r
    sheet.mobileG[from] = (sheet.mobileG[from] ?? 0) - g
    sheet.mobileB[from] = (sheet.mobileB[from] ?? 0) - b
    sheet.mobile[to] = (sheet.mobile[to] ?? 0) + moved
    sheet.mobileR[to] = (sheet.mobileR[to] ?? 0) + r
    sheet.mobileG[to] = (sheet.mobileG[to] ?? 0) + g
    sheet.mobileB[to] = (sheet.mobileB[to] ?? 0) + b
    return
  }
  transferMobile(sheet, to, from, -amount)
}
