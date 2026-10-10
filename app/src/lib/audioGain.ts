/**
 * 261010-bkv — the ONLY bridge between the perceptually uniform dB UI domain
 * and the two stored amplitude domains:
 *   - editor `AudioTrack.volume` is linear amplitude (1.0 = unity; >1 is legal
 *     true-amplitude headroom),
 *   - Studio `DocumentSoundClip.gain` stays an integer -100..+100.
 *
 * UI values are dB. Persistence stays linear / integer gain. Every conversion
 * in the app routes through these helpers so the mapping lives in one place.
 */

/** dB slider floor (maps to linear 0.1 / Studio gain -100). */
export const GAIN_DB_MIN = -20;
/** dB slider ceiling (maps to linear 10.0 / Studio gain +100). */
export const GAIN_DB_MAX = 20;

/** dB -> linear amplitude. 0 dB = 1, -20 dB = 0.1, +20 dB = 10. */
export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

/**
 * Linear amplitude -> dB. Non-positive input floors at GAIN_DB_MIN (the
 * logarithm is undefined; the slider never goes quieter than -20 dB).
 */
export function linearToDb(linear: number): number {
  if (!(linear > 0)) return GAIN_DB_MIN;
  return 20 * Math.log10(linear);
}

/** Studio integer gain (-100..+100) -> dB. 0 = unity, +100 = +20 dB. */
export function gainToDb(gain: number): number {
  return gain / 5;
}

/** dB -> Studio integer gain on the 5-wide grid (rounds to nearest). */
export function dbToGain(db: number): number {
  return Math.round(db * 5);
}

/** Frames -> seconds at project fps (view unit only — storage stays frames). */
export function framesToSeconds(frames: number, fps: number): number {
  return frames / Math.max(1, fps);
}

/** Seconds -> frames at project fps (rounds to the nearest frame). */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * Math.max(1, fps));
}

/** Audio-max readout: `{seconds}s / {frames} frames` (seconds to one decimal). */
export function formatAudioMaxTime(seconds: number, frames: number): string {
  return `${seconds.toFixed(1)}s / ${frames} frames`;
}
