import { applyEasing } from './keyframeEngine';
import type { Transition } from '../types/sequence';

/**
 * Compute the content opacity at a given local frame, considering optional
 * fade-in and fade-out transitions.
 *
 * - Returns 1.0 when no fades are active (fully opaque).
 * - Fade-in ramps opacity from 0 to 1 over fadeIn.duration frames at start.
 * - Fade-out ramps opacity from 1 to 0 over fadeOut.duration frames at end.
 * - When both overlap, their opacities are multiplied (product rule).
 *
 * @param localFrame - The current frame within the sequence (0-based).
 * @param totalFrames - The total number of frames in the sequence.
 * @param fadeIn - Optional fade-in transition definition.
 * @param fadeOut - Optional fade-out transition definition.
 * @returns Opacity value clamped to [0, 1].
 */
export function computeFadeOpacity(
  localFrame: number,
  totalFrames: number,
  fadeIn: Transition | undefined,
  fadeOut: Transition | undefined,
): number {
  let opacity = 1.0;

  if (fadeIn && fadeIn.duration > 0 && localFrame < fadeIn.duration) {
    const t = localFrame / fadeIn.duration;
    opacity *= applyEasing(t, fadeIn.curve);
  }

  if (fadeOut && fadeOut.duration > 0 && localFrame >= totalFrames - fadeOut.duration) {
    const framesFromEnd = totalFrames - 1 - localFrame;
    const t = fadeOut.duration > 0 ? framesFromEnd / fadeOut.duration : 1;
    opacity *= applyEasing(t, fadeOut.curve);
  }

  return Math.max(0, Math.min(1, opacity));
}

/**
 * Compute the solid color overlay alpha for a given local frame.
 * This is the inverse of computeFadeOpacity — used when mode === 'solid'
 * to determine how much of the solid color to draw over the content.
 *
 * @returns Alpha value clamped to [0, 1] for the solid overlay.
 */
export function computeSolidFadeAlpha(
  localFrame: number,
  totalFrames: number,
  fadeIn: Transition | undefined,
  fadeOut: Transition | undefined,
): number {
  return 1.0 - computeFadeOpacity(localFrame, totalFrames, fadeIn, fadeOut);
}
