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
