import type {WaveformPeaks} from '../types/audio';

/**
 * 261010-g2n W1 — source-space audio waveform geometry.
 *
 * The timeline waveform is drawn once in SOURCE space and windowed to the clip
 * bar (mirror getPhysicPaintSoundStainGeometry). Trim reveals a cut, slip slides
 * content under a fixed bar, and tier selection measures source-pixel density so
 * a short zoomed window on a long file stays detailed instead of collapsing to
 * a 2-peak spike stretched across the bar.
 */

export interface AudioSourceSpaceGeometry {
  /** Pixels per source frame (equals frameWidth when barW is the exact trim span). */
  readonly sourceScale: number;
  /** Canvas x of source frame 0. */
  readonly sourceX: number;
  /** Canvas width of the full source file. */
  readonly sourceW: number;
}

export interface AudioSourceSpaceInput {
  readonly barX: number;
  readonly barW: number;
  readonly inFrame: number;
  readonly outFrame: number;
  readonly slipOffset: number;
  readonly totalAudioFrames: number;
}

/**
 * Source-space window for an audio clip bar.
 *
 * - sourceScale = barW / max(1, trimFrames) — density follows the trim, never
 *   "fill the bar with whatever peaks we sliced".
 * - sourceX = barX - (inFrame + slipOffset) * sourceScale — the source slides
 *   left as In or slip advances, so the bar left edge shows later source.
 * - sourceW = max(1, totalAudioFrames) * sourceScale — the full file footprint.
 */
export function audioSourceSpaceGeometry(input: AudioSourceSpaceInput): AudioSourceSpaceGeometry {
  const trimFrames = Math.max(1, input.outFrame - input.inFrame);
  const sourceScale = input.barW / trimFrames;
  const sourceFrames = Math.max(1, input.totalAudioFrames);
  return {
    sourceScale,
    sourceX: input.barX - (input.inFrame + input.slipOffset) * sourceScale,
    sourceW: sourceFrames * sourceScale,
  };
}

/**
 * Pick a peak tier from SOURCE-pixel density.
 *
 * pixelsPerSourcePeak = sourceScale * (totalAudioFrames / tier2PeakCount)
 * is how many canvas pixels one tier2 peak covers in source space. Below 1 px
 * the envelope must downsample (tier1); above 4 px it can afford detail (tier3).
 * Falls back to tier1 when tier2 is empty.
 */
export function selectAudioPeakTier(
  peaks: WaveformPeaks,
  sourceScale: number,
  totalAudioFrames: number,
): Float32Array {
  const tier2Count = peaks.tier2.length / 2;
  if (tier2Count <= 0) return peaks.tier1;
  const pixelsPerSourcePeak = sourceScale * (Math.max(1, totalAudioFrames) / tier2Count);
  if (pixelsPerSourcePeak < 1) return peaks.tier1;
  if (pixelsPerSourcePeak > 4) return peaks.tier3;
  return peaks.tier2;
}

export interface AudioFitTrack {
  readonly inFrame: number;
  readonly outFrame: number;
  readonly offsetFrame: number;
  readonly slipOffset: number;
  readonly totalFramesInFile: number;
}

export interface AudioFitViewport {
  /** First visible timeline frame (content space). */
  readonly visStart: number;
  /** One-past-last visible timeline frame (content space). */
  readonly visEnd: number;
}

export interface AudioFitResult {
  readonly inFrame: number;
  readonly outFrame: number;
  readonly offsetFrame: number;
  readonly slipOffset: 0;
}

/**
 * 261010-g2n W2 / UAT 2026-10-10 — snap In/Out to the timeline's visible view.
 *
 * The audible span becomes EXACTLY the on-screen frame range at the current
 * zoom (crop when the bar overhangs the view, expand when it is narrower, move
 * it into view when it is off-screen). Content at the left of the intersection
 * (or the clip's own left when it sits entirely inside the view) is preserved
 * as the new In; Position moves to the visible left edge and slip resets to 0.
 * Returns null (no store write) only when the clip already matches the view.
 */
export function computeAudioFitToView(
  track: AudioFitTrack,
  viewport: AudioFitViewport,
): AudioFitResult | null {
  const trimFrames = Math.max(1, track.outFrame - track.inFrame);
  const barStart = track.offsetFrame;
  const barEnd = track.offsetFrame + trimFrames;

  const visStart = viewport.visStart;
  const visEnd = viewport.visEnd;
  const viewSpan = Math.round(visEnd) - Math.round(visStart);
  if (!Number.isFinite(viewSpan) || viewSpan <= 0) return null;

  // Source at timeline frame t is inFrame + slipOffset + (t - offsetFrame).
  const sourceAt = (t: number) => track.inFrame + track.slipOffset + (t - track.offsetFrame);

  // Keep the source content at the left of the intersection, or the clip's own
  // left when it sits entirely inside (or outside) the view.
  const overlaps = barEnd > visStart && barStart < visEnd;
  const keepT = overlaps ? Math.max(barStart, visStart) : barStart;
  let newIn = Math.round(sourceAt(keepT));
  let newOut = newIn + Math.max(1, viewSpan);

  // Clamp into the file window (T-g2n-02).
  const maxIn = Math.max(0, track.totalFramesInFile - 1);
  newIn = Math.min(Math.max(0, newIn), maxIn);
  const maxOut = Math.max(newIn + 1, track.totalFramesInFile);
  newOut = Math.min(Math.max(newIn + 1, newOut), maxOut);

  const newOffset = Math.round(visStart);

  // Already snapped to the view — no store write.
  if (
    newIn === track.inFrame &&
    newOut === track.outFrame &&
    newOffset === track.offsetFrame &&
    track.slipOffset === 0
  ) {
    return null;
  }

  return {
    inFrame: newIn,
    outFrame: newOut,
    offsetFrame: newOffset,
    slipOffset: 0,
  };
}
