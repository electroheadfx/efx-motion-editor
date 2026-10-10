/**
 * Single home of the locked fade curve law (261010-ht0).
 *
 * Shape f(t) on t in [0,1]:
 * - exponential = t^2
 * - logarithmic = sqrt(t)
 * - linear = t
 *
 * Loudness (0 = silent, 1 = full gain):
 * - fade-in  = 1 - f(1 - t)
 * - fade-out = 1 - f(t)
 *
 * Mirror identity (F1): fadeLoudnessIn(t) === fadeLoudnessOut(1 - t) for every
 * curve. Exponential fade-in is therefore 2t - t^2 (fast start / bows over)
 * while exponential fade-out stays the current user-liked 1 - t^2 (stays high
 * then drops). soundBandGeometry and audioEngine/audioExportMixer sample this
 * law and keep no private copies.
 */

export type FadeCurveName = 'linear' | 'exponential' | 'logarithmic';

/** Fade direction for loudness sampling. */
export type FadeDirection = 'in' | 'out';

/**
 * Named sample count for AudioParam curve arrays (T-ht0-02: finite, never
 * derived from duration — keeps the scheduler allocation bounded).
 */
export const FADE_CURVE_SAMPLES = 32;

/**
 * Fade-out target floor so AudioParam never receives a zero edge (kept from the
 * prior exponentialRampToValueAtTime contract).
 */
export const FADE_OUT_FLOOR = 0.001;

/** Shape f(t) on t in [0,1]; out-of-domain t clamps into the unit interval. */
export function fadeShape(t: number, curve: FadeCurveName): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  if (curve === 'exponential') return clamped * clamped;
  if (curve === 'logarithmic') return Math.sqrt(clamped);
  return clamped;
}

/** Fade-in loudness at t in [0,1]: 0 = silent, 1 = full gain. */
export function fadeLoudnessIn(t: number, curve: FadeCurveName): number {
  return 1 - fadeShape(1 - t, curve);
}

/** Fade-out loudness at t in [0,1]: 1 = full gain, 0 = silent. */
export function fadeLoudnessOut(t: number, curve: FadeCurveName): number {
  return 1 - fadeShape(t, curve);
}

/**
 * Sample loudness (or scaled gain) values for AudioParam.setValueCurveAtTime.
 *
 * Endpoints match the ramp targets: fade-in runs toward 1 (or `gain`), fade-out
 * runs toward FADE_OUT_FLOOR. `from`/`to` are t positions in [0,1] so a partial
 * fade-in (playback joins mid-fade) samples only the remaining loudness slice.
 */
export function sampleFadeCurve(
  curve: FadeCurveName,
  direction: FadeDirection,
  from: number,
  to: number,
  gain: number = 1,
): Float32Array {
  const count = FADE_CURVE_SAMPLES;
  const out = new Float32Array(count + 1);
  const span = to - from;
  for (let index = 0; index <= count; index += 1) {
    const t = from + span * (index / count);
    const loudness = direction === 'in' ? fadeLoudnessIn(t, curve) : fadeLoudnessOut(t, curve);
    let value = loudness * gain;
    if (direction === 'out' && value < FADE_OUT_FLOOR) value = FADE_OUT_FLOOR;
    out[index] = value;
  }
  return out;
}
