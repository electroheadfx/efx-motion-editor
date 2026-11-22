// ============================================================
//  The last-touch time-base law (WR-03; 64-26 Task 1).
//
//  A last-touch value is SECONDS on an engine-relative clock: `nowSec()`
//  subtracts `timeBaseMs`, the engine's own anchor, so stamps are small and
//  exact-f32 precise. A raw stamp is therefore meaningless on another
//  engine's clock — a bake engine runs a virtual clock from 0 while the live
//  engine runs real time, and a `timeBaseMs` reset re-anchors the same
//  engine. The whole-document record therefore travels as AGES (seconds
//  before the capture) and each engine re-stamps them on its own clock.
//
//  PRECISION RECORD (recorded, never assumed): stamps and the pair are exact
//  f32 and the storage is relative seconds. At a 24-hour session
//  (now = 86400 s) f32 resolves 2^-7 s ≈ 7.8 ms — under 10 ms — while the
//  wetness law's shortest timescale is `wetSeconds` in whole seconds, so a
//  single monotonic base is safe for the life of an engine and only a
//  cross-domain carry has to travel as ages.
//
//  Neither conversion reads a clock: the caller passes `now`, which is what
//  makes both laws pure and CPU-testable.
// ============================================================

/**
 * Convert stamps to AGES IN PLACE: a fresh stamp (its `now`) becomes 0, an
 * old stamp its elapsed seconds (`Math.max(now - stamp, 0)` — a future stamp
 * clamps to 0, never negative), and the one-week sentinel an ancient age
 * (now + 604800) that can never read as fresh. Returns the same array so a
 * capture can wrap the readback in one expression.
 */
export function stampsToAges(stamps: Float32Array, now: number): Float32Array {
  for (let i = 0; i < stamps.length; i += 1) {
    stamps[i] = Math.max(now - stamps[i], 0)
  }
  return stamps
}

/**
 * Re-stamp AGES on the current clock into a NEW array (`now - age` per
 * texel). The input is NEVER mutated: the app restores the same cached
 * sheet snapshot repeatedly, and an in-place conversion would age it on
 * every restore.
 */
export function agesToStamps(ages: Float32Array, now: number): Float32Array {
  const stamps = new Float32Array(ages.length)
  for (let i = 0; i < ages.length; i += 1) {
    stamps[i] = now - ages[i]
  }
  return stamps
}
