/**
 * 52.5-01b Task 3: pure geometry + trim-law helpers for the Studio document
 * sound band (UI-SPEC Interaction Contracts, D-07/D-08/D-09).
 *
 * Everything here is side-effect free so the truth table and the trim clamps
 * are unit-testable (soundBandGeometry.test.ts). The strip owns the gesture
 * session and the DOM preview; these functions own the numbers:
 *
 * - Band layout law: 36px band, stain inset 8px (half-extent 14px symmetric
 *   about the band center), arm thresholds 4px (stain) / 2px (trim), 6px trim
 *   end zones, 8px hit depth (D-07/D-09).
 * - Tier selection mirrors `TimelineRenderer.drawAudioTrack` exactly
 *   (pixelsPerPeak < 1 -> tier1, > 4 -> tier3, else tier2; D-04).
 * - The filled path traces maxes left-to-right on top, mins right-to-left on
 *   bottom — the same single-path fill as the timeline audio track, adapted to
 *   the full-height stain. NO center line, NO fades, NO edge handles (D-06).
 * - Trim law: `in < out`, minimum span 1 frame, `start >= 0`. A left trim
 *   keeps the timeline end fixed; a right trim may not push the timeline end
 *   past the parent end. A REPOSITION (UAT round 5) only bounds the start to a
 *   frame the parent actually has (`start <= parentEndExclusive - 1`) — the body
 *   may overhang the parent end,
 *   which is what the "instead" placement needs (start at frame 10 with the
 *   body past frame 30); a full-width clip used to compute
 *   `high = parentEnd - span = 0` and stay pinned at frame 0.
 */

import type { WaveformPeaks } from '../../../types/audio';
import type { SoundFadeCurve } from '../../../efx-paint/document/efxPaintDocument';

/** Layout constant: the band height (D-07 — 28px -> 36px, single source of truth). */
export const SOUND_BAND_HEIGHT_PX = 36;
/** Stain inset from the band top/bottom: max extent = 36 - 8 = 28px. */
export const SOUND_STAIN_INSET_PX = 8;
/** Half-extent of the waveform about the band's vertical center: (36 - 8) / 2. */
export const SOUND_STAIN_HALF_EXTENT_PX = (SOUND_BAND_HEIGHT_PX - SOUND_STAIN_INSET_PX) / 2;
/** Horizontal travel that arms a stain reposition (matches RULER_SCRUB_THRESHOLD_PX). */
export const SOUND_STAIN_ARM_PX = 4;
/** Horizontal travel that arms a trim (precision chrome; never seeks, so 2px). */
export const SOUND_TRIM_ARM_PX = 2;
/** Width of each trim end zone at the bar's ends. */
export const SOUND_TRIM_ZONE_PX = 6;
/** Trim hit-zone depth extending downward from the 2px drawn bar. */
export const SOUND_TRIM_HIT_PX = 8;

/** UAT round 3: the waveform fill — RGB (22, 110, 203). */
export const SOUND_WAVEFORM_FILL = '#166ECB';
/** UAT round 5: the fade/gain overlay stroke, lightened from #2DB3E3. */
export const SOUND_OVERLAY_STROKE = '#7DD3F5';
/** UAT round 4: overlay strokes are hairline — 1px, never 1.5. */
export const SOUND_OVERLAY_STROKE_PX = 1;
/** UAT round 4: fade shapes — the same closed curve set the document stores. */
export type { SoundFadeCurve };

/**
 * The band gesture intent, fixed at pointer-down and NEVER switched mid-
 * gesture (identity law). `'stain'` is the bare reposition; `'duplicate'`
 * (261008-ig1 Task 3) is the bare-alt clone append — the trim kinds never
 * duplicate (trim gains no alt branch).
 */
export type SoundBandGestureKind = 'stain' | 'trim-start' | 'trim-end' | 'duplicate';

/** The document sound fields a gesture may move (commit patch for the member setter). */
export interface SoundBandGesturePatch {
  /** 261008-ig1: the PLACED clip the gesture moved (identity fixed at
   *  pointer-down) — the settle routes through the per-clip store door. */
  readonly clipId: string;
  /** 261008-ig1 Task 3: the gesture intent stamped at pointer-down — the
   *  Studio routes `'duplicate'` to the clone-append door, everything else to
   *  the geometry patch (move/trim keep their Task 2 routing). */
  readonly kind: SoundBandGestureKind;
  readonly startFrame?: number;
  readonly inFrame?: number;
  readonly outFrame?: number;
}

/** The clip's timeline anchor fields (the gesture origin snapshot). */
export interface SoundBandValues {
  readonly startFrame: number;
  readonly inFrame: number;
  readonly outFrame: number;
}

/** Audible span of the clip in frames: [start, start + (out - in)). */
export function soundSpanFrames(inFrame: number, outFrame: number): number {
  return Math.max(0, outFrame - inFrame);
}

/** Content-space left edge of the stain/bar at the 18px cell pitch. */
export function soundStainLeftPx(startFrame: number, cellWidthPx: number): number {
  return startFrame * cellWidthPx;
}

/** Content-space width of the stain/bar for the clip's span. */
export function soundStainWidthPx(inFrame: number, outFrame: number, cellWidthPx: number): number {
  return soundSpanFrames(inFrame, outFrame) * cellWidthPx;
}

/**
 * Tier rule — byte-for-byte the `TimelineRenderer.drawAudioTrack` selection:
 * pixels-per-peak from the tier2 pair count, < 1 zooms out to tier1, > 4 zooms
 * in to tier3, else tier2; an empty tier2 falls back to tier1. null = no peaks
 * (loading / fail-closed → no stain).
 */
export function selectSoundPeaks(peaks: WaveformPeaks | undefined, barWidthPx: number): Float32Array | null {
  if (!peaks) return null;
  let selected: Float32Array;
  if (peaks.tier2.length > 0) {
    const pixelsPerPeak = barWidthPx / (peaks.tier2.length / 2);
    selected = pixelsPerPeak < 1 ? peaks.tier1
      : pixelsPerPeak > 4 ? peaks.tier3
      : peaks.tier2;
  } else {
    selected = peaks.tier1;
  }
  return selected.length > 0 ? selected : null;
}

/**
 * Filled waveform path for the stain: trace maxes left-to-right across the
 * top, then mins right-to-left across the bottom, closed — the TimelineRenderer
 * single-path fill adapted to a `widthPx`-wide band with the half-extent
 * symmetric about center. Returns null for degenerate input (never a broken
 * shape — the loading state draws no stain).
 */
export function soundWaveformPathD(peaks: Float32Array, widthPx: number): string | null {
  const count = peaks.length / 2;
  if (count < 2 || widthPx <= 0) return null;
  const centerY = SOUND_BAND_HEIGHT_PX / 2;
  const half = SOUND_STAIN_HALF_EXTENT_PX;
  const step = widthPx / (count - 1);
  const y = (value: number): number => Math.round((centerY - value * half) * 100) / 100;
  const x = (index: number): number => Math.round(index * step * 100) / 100;
  const parts: string[] = [`M${x(0)} ${y(peaks[1])}`];
  // Top edge (max values, left to right)
  for (let vi = 0; vi < count; vi += 1) {
    parts.push(`L${x(vi)} ${y(peaks[vi * 2 + 1])}`);
  }
  // Bottom edge (min values, right to left)
  for (let vi = count - 1; vi >= 0; vi -= 1) {
    parts.push(`L${x(vi)} ${y(peaks[vi * 2])}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * Gain line y within the band (UAT round 4). The clip gain is a signed integer
 * -100..+100 where 0 is unity at the CENTER of the waveform, +100 is the top of
 * the stain extent (a doubled level) and -100 the bottom (silence).
 */
export function soundGainLineY(gain: number): number {
  const clamped = Math.max(-100, Math.min(100, gain));
  const centerY = SOUND_BAND_HEIGHT_PX / 2;
  return Math.round((centerY - (clamped / 100) * SOUND_STAIN_HALF_EXTENT_PX) * 100) / 100;
}

/**
 * Gain line x span within the stain (UAT round 5): the line runs "from in to
 * out" EXCEPT across an active fade — a fade-in owns [0, fadeInPx] and a fade-out
 * owns [widthPx - fadeOutPx, widthPx], so the gain line is clipped to the gap
 * between the two transitions. Both fades meeting leaves no gap -> null (the
 * ramps already describe the whole clip).
 */
export function soundGainLineSpan(
  fadeInFrames: number,
  fadeOutFrames: number,
  inFrame: number,
  outFrame: number,
  widthPx: number,
): { readonly x1: number; readonly x2: number } | null {
  const fadeInPx = soundFadePx(fadeInFrames, inFrame, outFrame, widthPx) ?? 0;
  const fadeOutPx = soundFadePx(fadeOutFrames, inFrame, outFrame, widthPx) ?? 0;
  const x1 = fadeInPx;
  const x2 = widthPx - fadeOutPx;
  return x2 > x1 ? { x1, x2 } : null;
}

/**
 * Curve shape for a fade overlay (UAT round 4): t in 0..1 mapped by the clip's
 * stored fade curve so the diagonal becomes the real graph — linear is the
 * straight ramp, exponential bows under it (slow start), logarithmic bows over
 * (slow end). Sampled into a polyline so the shape is visible at any width.
 */
const SOUND_FADE_SAMPLES = 8;

/**
 * Fade-in overlay (UAT round 4): from the silent edge (the extent bottom) up to
 * the GAIN line at the fade-in boundary — the ramp must land on the gain
 * position, never past it. null when the fade is zero-length.
 */
export function soundFadeInPathD(
  fadeInFrames: number,
  inFrame: number,
  outFrame: number,
  widthPx: number,
  gain: number,
  curve: SoundFadeCurve,
): string | null {
  const fadePx = soundFadePx(fadeInFrames, inFrame, outFrame, widthPx);
  if (fadePx === null) return null;
  return soundFadeCurvePathD(0, soundSilentEdgeY(), fadePx, soundGainLineY(gain), curve);
}

/**
 * Fade-out overlay: from the gain line at the fade-out boundary down to the
 * silent edge (the extent bottom). null when zero-length.
 */
export function soundFadeOutPathD(
  fadeOutFrames: number,
  inFrame: number,
  outFrame: number,
  widthPx: number,
  gain: number,
  curve: SoundFadeCurve,
): string | null {
  const fadePx = soundFadePx(fadeOutFrames, inFrame, outFrame, widthPx);
  if (fadePx === null) return null;
  return soundFadeCurvePathD(widthPx - fadePx, soundGainLineY(gain), widthPx, soundSilentEdgeY(), curve);
}

const soundSilentEdgeY = (): number => SOUND_BAND_HEIGHT_PX / 2 + SOUND_STAIN_HALF_EXTENT_PX;

/** Fade length in px along the stain, or null when the fade is degenerate. */
function soundFadePx(fadeFrames: number, inFrame: number, outFrame: number, widthPx: number): number | null {
  const span = soundSpanFrames(inFrame, outFrame);
  if (fadeFrames <= 0 || span <= 0 || widthPx <= 0) return null;
  return Math.min(widthPx, (fadeFrames / span) * widthPx);
}

/** Sampled polyline along a fade curve from (x0,y0) to (x1,y1). */
function soundFadeCurvePathD(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  curve: SoundFadeCurve,
): string {
  const parts: string[] = [];
  for (let index = 0; index <= SOUND_FADE_SAMPLES; index += 1) {
    const t = index / SOUND_FADE_SAMPLES;
    const k = curve === 'exponential' ? t * t : curve === 'logarithmic' ? Math.sqrt(t) : t;
    parts.push(`${index ? 'L' : 'M'}${Math.round((x0 + (x1 - x0) * t) * 100) / 100} ${Math.round((y0 + (y1 - y0) * k) * 100) / 100}`);
  }
  return parts.join(' ');
}

/**
 * Stain reposition clamp (UAT round 5): `start >= 0` and the clip must start
 * on a frame that EXISTS in the parent (`start <= parentEndExclusive - 1`);
 * the body may overhang the parent end. Bounding the end instead (the old
 * `high = parentEnd - span`) pinned a full-width clip at 0 and an end-anchored
 * clip at its current start, so the clip could never be dragged to later
 * frames. The start bound keeps at least one frame of the clip grabbable, so
 * it can never be stranded fully past the ruler.
 */
export function clampSoundRepositionStart(
  startFrame: number,
  deltaFrames: number,
  parentEndExclusive: number,
): number {
  const low = 0;
  const high = Math.max(0, parentEndExclusive - 1);
  return Math.min(Math.max(startFrame + deltaFrames, low), high);
}

/**
 * Left-end trim: `start` and `in` move together so the timeline end stays put
 * while the clip shrinks/grows from the left (NLE mental model — the left end
 * sets the start, Phase 15 D-10 carry-over). Clamps: `start >= 0`, `in >= 0`,
 * `in < out` (minimum span 1 frame).
 */
export function applyTrimStartSound(
  startFrame: number,
  inFrame: number,
  outFrame: number,
  deltaFrames: number,
  // The timeline end is invariant under a left-end trim (start+delta and
  // in+delta cancel), so the parent bound is structural here — kept in the
  // signature for symmetry with applyTrimEndSound and the truth-table law.
  _parentEndExclusive: number,
): Pick<SoundBandValues, 'startFrame' | 'inFrame'> {
  const minDelta = -Math.min(startFrame, inFrame);
  const maxDelta = outFrame - 1 - inFrame;
  const delta = Math.min(Math.max(deltaFrames, minDelta), maxDelta);
  return { startFrame: startFrame + delta, inFrame: inFrame + delta };
}

/**
 * Right-end trim: `out` moves; `start`/`in` stay put. Clamps: `in < out`
 * (minimum span 1 frame) and the timeline end `start + (out - in)` never
 * passes the parent end. UAT round 5: the parent bound is FLOORED at 0 so a
 * clip already overhanging the parent (legal since the reposition clamp) is
 * never yanked back by touching the end handle — it may shrink, not snap.
 */
export function applyTrimEndSound(
  startFrame: number,
  inFrame: number,
  outFrame: number,
  deltaFrames: number,
  parentEndExclusive: number,
): Pick<SoundBandValues, 'outFrame'> {
  const minDelta = inFrame + 1 - outFrame;
  const maxDelta = Math.max(0, parentEndExclusive - startFrame + inFrame - outFrame);
  if (maxDelta < minDelta) return { outFrame }; // fail-closed: no valid move
  const delta = Math.min(Math.max(deltaFrames, minDelta), maxDelta);
  return { outFrame: outFrame + delta };
}
