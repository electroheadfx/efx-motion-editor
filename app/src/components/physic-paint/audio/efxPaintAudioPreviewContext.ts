import type { EfxPaintAudioPreviewContext, EfxPaintAudioPreviewTrack } from '../../../types/physicPaint';
import { isEfxPaintAudioPreviewContext, isEfxPaintAudioPreviewTrack } from '../../../types/physicPaint';

/**
 * EFX Paint audio preview context module (child window).
 *
 * Encodes the locked frame-to-audio truth table
 * (.planning/phases/41-efx-paint-audio-preview-monitoring-toggle/41-FRAME-AUDIO-TRUTH-TABLE.md):
 * - paint appFrame IS the main-editor global frame (zero translation, section 1)
 * - half-open audible window capped at the Paint playback-range end (section 2)
 * - source offset math mirroring playbackEngine.ts:192-224 verbatim (section 3)
 * - strict newer-than revision guard, single application funnel (section 4)
 *
 * Authority boundary (AUDIO-01): this module imports NOTHING from audioStore,
 * timelineStore, or playbackEngine. All track data arrives via validated
 * payload only.
 */

const AUDIO_PREVIEW_KEYS = new Set(['revision', 'fps', 'tracks']);
const AUDIO_PREVIEW_TRACK_KEYS = new Set(['id', 'assetUrl', 'offsetFrame', 'inFrame', 'outFrame', 'slipOffset', 'fadeInFrames', 'fadeOutFrames', 'volume', 'muted', 'fadeInCurve', 'fadeOutCurve']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isStructuredClonePlainData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.every((entry) => isStructuredClonePlainData(entry, seen));
    if (!isPlainRecord(value)) return false;
    return Object.values(value).every((entry) => isStructuredClonePlainData(entry, seen));
  } finally {
    seen.delete(value);
  }
}

/**
 * Fail-null parse funnel for an incoming audioPreview section. Rebuilds a
 * canonical plain-data copy so no foreign object graph is retained. Never
 * throws, never partially applies (HYDR-03 lesson).
 */
export function parseEfxPaintAudioPreviewSection(value: unknown): EfxPaintAudioPreviewContext | null {
  if (!isStructuredClonePlainData(value) || !isPlainRecord(value) || !hasOnlyKeys(value, AUDIO_PREVIEW_KEYS)) return null;
  if (!isEfxPaintAudioPreviewContext(value)) return null;
  if (!value.tracks.every((track) => isPlainRecord(track) && hasOnlyKeys(track, AUDIO_PREVIEW_TRACK_KEYS) && isEfxPaintAudioPreviewTrack(track))) return null;
  try {
    return {
      revision: value.revision,
      fps: value.fps,
      tracks: value.tracks.map((track) => ({ ...track })),
    };
  } catch {
    return null;
  }
}

/** Minimal store surface the revision guard applies against. */
export interface EfxPaintAudioPreviewStoreTarget {
  getSection: () => unknown;
  setSection: (section: EfxPaintAudioPreviewContext) => void;
}

/**
 * Strict newer-than revision guard (D-02 / AUDIO-04): applies an incoming
 * section only when incoming.revision > current.revision. Equal or lower
 * revisions are dropped silently (same-revision re-application is a defined
 * no-op). Single application funnel for interleaved hydration/push events.
 * Returns true when the section was applied.
 */
export function applyRevisionedEfxPaintAudioPreview(store: EfxPaintAudioPreviewStoreTarget, incoming: unknown): boolean {
  const parsed = parseEfxPaintAudioPreviewSection(incoming);
  if (!parsed) return false;
  const current = store.getSection();
  const currentRevision = isEfxPaintAudioPreviewContext(current) ? current.revision : null;
  if (currentRevision !== null && parsed.revision <= currentRevision) return false;
  store.setSection(parsed);
  return true;
}

export type EfxPaintTrackPlaybackResolution =
  | { kind: 'immediate'; sourceOffsetSec: number; maxPlaySec: number }
  | { kind: 'delayed'; delaySec: number; sourceOffsetSec: number; maxPlaySec: number }
  | null;

/**
 * Truth table section 3, verbatim: maps a payload track + Paint cursor to the
 * Web Audio dispatch parameters. The cap is the Paint playback-range end (D-11
 * loop window), NOT totalFrames (section 2). projectFps is the main-editor
 * project fps carried in the payload (section 3/6).
 */
export function resolveTrackPlayback(
  track: Pick<EfxPaintAudioPreviewTrack, 'offsetFrame' | 'inFrame' | 'outFrame' | 'slipOffset' | 'muted'>,
  cursorFrame: number,
  playbackRangeEnd: number,
  projectFps: number,
): EfxPaintTrackPlaybackResolution {
  if (track.muted) return null;

  // Audible on the half-open interval [offsetFrame, offsetFrame + (outFrame - inFrame)).
  const trackStartOnTimeline = track.offsetFrame;
  const trimDuration = track.outFrame - track.inFrame;
  const trackEndOnTimeline = trackStartOnTimeline + trimDuration;

  // Child-window cap: the Paint playback-range end, never beyond (D-11).
  const effectiveEnd = Math.min(trackEndOnTimeline, playbackRangeEnd);

  if (cursorFrame >= trackStartOnTimeline && cursorFrame < effectiveEnd) {
    // Case A — cursor inside the window: start immediately.
    const framesIntoTrack = cursorFrame - trackStartOnTimeline;
    return {
      kind: 'immediate',
      sourceOffsetSec: (track.inFrame + track.slipOffset + framesIntoTrack) / projectFps,
      maxPlaySec: (effectiveEnd - cursorFrame) / projectFps,
    };
  }
  if (cursorFrame < trackStartOnTimeline && trackStartOnTimeline < effectiveEnd) {
    // Case B — cursor before the window: schedule with delay.
    return {
      kind: 'delayed',
      delaySec: (trackStartOnTimeline - cursorFrame) / projectFps,
      sourceOffsetSec: (track.inFrame + track.slipOffset) / projectFps,
      maxPlaySec: (effectiveEnd - trackStartOnTimeline) / projectFps,
    };
  }
  // Case C — no audible extent: emit nothing.
  return null;
}
