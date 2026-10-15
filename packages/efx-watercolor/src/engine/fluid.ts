// ============================================================
//  fluid.ts — aquarelle fluid sheet (AQUA-01).
//
//  Float32Array buffers: velocity (u,v), wetness, mobile
//  pigment, fixed pigment, plus mobile/fixed colour mass so
//  baked pixels carry the deposited hue. `step` orchestrates
//  transport + drying over the wet region only (R1.6 idle dry
//  sheet is a no-op). Integer ticks only (DATA-03).
//
//  56-03 RED stub — allocation and export surface only; the
//  physics (transport/drying) is intentionally unimplemented so
//  the look-law tests fail on assertions, not on imports.
// ============================================================

/** Wetness below this is treated as dry for the transport gate. */
export const WET_EPS = 1e-4

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

/**
 * Advance the sim by one tick of `dt` (integer-tick units).
 * Wet-gated transport + drying. dt<=0 and an idle dry sheet
 * are no-ops (flagged assumptions AQUA-01).
 */
export function step(_sheet: FluidSheet, _dt: number): void {
  // 56-03 RED stub — intentionally does nothing. GREEN lands
  // transportStep + fixDrying here.
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
