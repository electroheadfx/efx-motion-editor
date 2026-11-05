import { framesToSeconds, secondsToFrames } from '../../../lib/audioGain';

/**
 * 261105-cgl Task 2: the pure frame/seconds go-to law for the current-frame
 * readout popover.
 *
 * The popover lets the user jump to an exact frame or to a time. Both entries
 * are the SAME position expressed through two units, so there is exactly one
 * conversion path: frame mode normalizes; seconds mode converts at the PROJECT
 * fps through the shared `audioGain` helpers (the same law the audio surfaces
 * use), then normalizes. Nothing here touches the timeline, the document, or
 * any store — the caller forwards the returned frame to the Studio's existing
 * navigation path.
 *
 * `audioGain` treats a non-positive/non-finite fps as 1, so this module can
 * never divide by zero.
 */

export type FrameGotoMode = 'frame' | 'seconds';

/**
 * Round a frame input to the nearest whole frame and clamp it into
 * `[0, lastFrame]`. Non-finite input returns null — the caller must skip the
 * seek entirely rather than land on a NaN/negative frame (T-261105-CGL-01).
 */
export function normalizeFrameGotoFrame(frame: number, lastFrame: number): number | null {
  if (!Number.isFinite(frame)) return null;
  const max = Number.isFinite(lastFrame) ? Math.max(0, Math.trunc(lastFrame)) : 0;
  return Math.min(max, Math.max(0, Math.round(frame)));
}

/** The value a given position displays in the requested unit. */
export function resolveFrameGotoValue(mode: FrameGotoMode, frame: number, fps: number): number {
  return mode === 'frame' ? frame : framesToSeconds(frame, fps);
}

/**
 * Resolve a typed/stepped entry into the frame the timeline should seek to,
 * or null when the entry must not produce a seek.
 */
export function resolveFrameGotoTarget(
  mode: FrameGotoMode,
  value: number,
  fps: number,
  lastFrame: number,
): number | null {
  if (!Number.isFinite(value)) return null;
  if (mode === 'frame') return normalizeFrameGotoFrame(value, lastFrame);
  return normalizeFrameGotoFrame(secondsToFrames(value, fps), lastFrame);
}
