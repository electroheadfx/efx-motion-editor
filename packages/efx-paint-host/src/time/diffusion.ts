// ============================================================
//  Host-owned diffusion / cuisson MECHANISM (D-20).
//  The host owns the per-stroke tick budget only. Each engine
//  owns its cap policy (the engine-1 frame ceiling and any
//  watercolour cap stay engine-side). There is NO default
//  maximum in this module — clampCuissonTicks requires the
//  caller to pass its own bounds.
// ============================================================

/**
 * Return the stroke's non-negative integer cuisson tick budget with
 * no upper ceiling. `cuisson: 10000` is returned unchanged — the host
 * never bakes a cap into the mechanism (D-20).
 */
export function cuissonTicks(stroke: { cuisson: number }): number {
  const { cuisson } = stroke
  if (typeof cuisson !== 'number' || !Number.isFinite(cuisson)) {
    throw new RangeError('cuissonTicks: cuisson must be a finite number')
  }
  if (!Number.isInteger(cuisson)) {
    throw new RangeError('cuissonTicks: cuisson must be an integer')
  }
  if (cuisson < 0) {
    throw new RangeError('cuissonTicks: cuisson must be non-negative')
  }
  return cuisson
}

/**
 * Pure range clamp the ENGINE calls with its own policy bounds.
 * The host never supplies a default max — min and max are required
 * caller-owned values (D-20).
 */
export function clampCuissonTicks(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError('clampCuissonTicks: value, min, and max must be finite numbers')
  }
  if (min > max) {
    throw new RangeError('clampCuissonTicks: min must be less than or equal to max')
  }
  return Math.min(Math.max(value, min), max)
}
