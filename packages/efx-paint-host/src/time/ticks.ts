// ============================================================
//  Host-owned fixed integer tick grid (DATA-03 / D-23).
//  Time on the host is integer ticks at HOST_TICK_HZ = 60
//  (~1/60 s).  Public timing APIs take or return integer ticks
//  and never raw milliseconds.  Helpers are pure and total:
//  out-of-range or non-finite input is rejected by a named
//  RangeError (or clamped by a named rule), never silently
//  coerced through floating ms.
// ============================================================

/** Fixed host tick rate. 1 tick = 1/60 s. Integer ticks only (DATA-03). */
export const HOST_TICK_HZ = 60

function assertFiniteSeconds(seconds: number, fn: string): void {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    throw new RangeError(`${fn}: seconds must be a finite number`)
  }
}

/**
 * Convert a non-negative duration in seconds to a non-negative integer
 * tick count at HOST_TICK_HZ. Non-finite or negative input throws a
 * named RangeError.
 */
export function ticksFromSeconds(seconds: number): number {
  assertFiniteSeconds(seconds, 'ticksFromSeconds')
  if (seconds < 0) {
    throw new RangeError('ticksFromSeconds: seconds must be non-negative')
  }
  return Math.round(seconds * HOST_TICK_HZ)
}

/**
 * Convert an integer tick count back to seconds (ticks / HOST_TICK_HZ).
 * Non-integer, non-finite, or negative ticks throw a named RangeError —
 * fractional ticks never enter the host time domain.
 */
export function secondsFromTicks(ticks: number): number {
  if (typeof ticks !== 'number' || !Number.isFinite(ticks)) {
    throw new RangeError('secondsFromTicks: ticks must be a finite number')
  }
  if (!Number.isInteger(ticks)) {
    throw new RangeError('secondsFromTicks: ticks must be an integer')
  }
  if (ticks < 0) {
    throw new RangeError('secondsFromTicks: ticks must be non-negative')
  }
  return ticks / HOST_TICK_HZ
}

/**
 * Snap a sample timestamp (seconds within a stroke) to the nearest
 * non-negative integer tick. Negative seconds clamp to 0 (named clamp
 * rule); non-finite input throws a named RangeError.
 */
export function snapSampleToTick(secondsWithinStroke: number): number {
  assertFiniteSeconds(secondsWithinStroke, 'snapSampleToTick')
  if (secondsWithinStroke < 0) {
    return 0
  }
  return Math.round(secondsWithinStroke * HOST_TICK_HZ)
}
