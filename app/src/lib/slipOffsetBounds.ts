/**
 * 261010-en9 R5/R6 — the ONLY home of the Offset (s) sign law and file-window
 * bounds shared by the editor sidebar and the Studio audio modal.
 *
 * Sign law (user convention):
 * - UI positive Offset = earlier source (content slides later on the timeline).
 * - Engine `slipOffset` is the opposite sign: `source = inFrame + slipOffset +
 *   framesIntoTrack`, so a positive engine slipOffset reads LATER source.
 * - Display: `framesToSeconds(-track.slipOffset, fps)`.
 * - Commit: `setSlipOffset(id, -secondsToFrames(ui, fps))`.
 *
 * Bounds live in UI seconds; the clamp lives in engine frames so the two
 * surfaces cannot drift from the file window `[0, totalFramesInFile]`.
 */

export interface SlipWindow {
  readonly inFrame: number;
  readonly outFrame: number;
  readonly totalFramesInFile: number;
}

/**
 * Resolve the source length in frames from a sound clip, tolerating the
 * 0/NaN/undefined holes that would otherwise collapse the slip bounds to a
 * point (261010 UAT: Studio Offset stuck at zero). `preferred` is the
 * persisted `sourceFrames`; `cached` is the peaks-cache value. Returns null
 * when nothing usable is known — callers must treat that as "no slip room".
 */
export function resolveSlipTotalFrames(
  preferred: number | null | undefined,
  cached: number | null | undefined,
): number | null {
  for (const candidate of [preferred, cached]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 1) {
      return Math.floor(candidate);
    }
  }
  return null;
}

/** UI-second min/max for the Offset (s) control. Positive UI = earlier source. */
export function slipOffsetBoundsSeconds(
  window: SlipWindow,
  fps: number,
): { readonly min: number; readonly max: number } {
  const safeFps = Math.max(1, fps);
  const total = window.totalFramesInFile;
  // Unknown source length → no slip room. Never emit NaN bounds (a NaN min
  // freezes the slider at 0 and reads as "the control is broken").
  if (!Number.isFinite(total) || total < 1) {
    return { min: 0, max: 0 };
  }
  return {
    min: (window.outFrame - total) / safeFps,
    max: window.inFrame / safeFps,
  };
}

/**
 * Clamp an engine-sign slipOffset so the heard source window
 * `[inFrame + slip, outFrame + slip]` stays inside `[0, totalFramesInFile]`.
 * Inverts to the UI bounds above: `slip ∈ [-(inFrame), total - outFrame]`.
 */
export function clampSlipOffsetFrames(
  engineSlipFrames: number,
  window: SlipWindow,
): number {
  const total = window.totalFramesInFile;
  if (!Number.isFinite(total) || total < 1 || !Number.isFinite(engineSlipFrames)) {
    return 0;
  }
  const min = -window.inFrame;
  const max = total - window.outFrame;
  const clamped = Math.max(min, Math.min(max, engineSlipFrames));
  // Normalize -0 so callers and tests see a plain zero at the lower edge.
  return clamped === 0 ? 0 : clamped;
}
