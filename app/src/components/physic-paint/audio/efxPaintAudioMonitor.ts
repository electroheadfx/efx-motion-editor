import type { AudioTrack } from '../../../types/audio';
import type { EfxPaintAudioPreviewContext } from '../../../types/physicPaint';
import { audioEngine } from '../../../lib/audioEngine';
import { applyRevisionedEfxPaintAudioPreview, resolveTrackPlayback } from './efxPaintAudioPreviewContext';
import { efxPaintAudioPreviewStore } from './efxPaintAudioPreviewStore';

/**
 * EFX Paint child-window audio monitor (41-02 tracer).
 *
 * Fetches each track's bytes through the efxasset:// protocol URL carried in
 * the validated payload, decodes locally via the shared audioEngine singleton
 * (D-08: one engine instance per child webview — this module never constructs
 * an AudioContext), and dispatches play/playDelayed at the Paint cursor using
 * the locked truth-table mapping (resolveTrackPlayback — never duplicated
 * here).
 *
 * Authority boundary (AUDIO-01): imports NOTHING from audioStore,
 * timelineStore, or playbackEngine. All track data arrives via the validated
 * EfxPaintAudioPreviewContext payload.
 *
 * State machine: idle | positioned | playing, held in module refs. Play/Stop
 * while already in that state is a no-op (idempotent control funnel). Every
 * position discontinuity is a full seek-restart (stopAll + re-dispatch) —
 * playing sources are never nudged (Pattern 2).
 */

type MonitorState = 'idle' | 'positioned' | 'playing';

/**
 * D-10 drift policy: audio free-runs on the Web Audio clock after a
 * seek-aligned start; a full seek-restart corrects only when measured drift
 * exceeds ~one frame (40ms ≈ 41.7ms at 24fps). The check is throttled — it
 * compares only every EFX_PAINT_AUDIO_DRIFT_CHECK_INTERVAL_TICKS playback
 * ticks, never per frame.
 */
export const EFX_PAINT_AUDIO_DRIFT_THRESHOLD_SEC = 0.04;
export const EFX_PAINT_AUDIO_DRIFT_CHECK_INTERVAL_TICKS = 10;

let state: MonitorState = 'idle';
let context: EfxPaintAudioPreviewContext | null = null;
let anchorAppFrame = 0;
// Drift anchor (truth table section 5): captured at each seek-aligned start.
// The anchor audioTime term cancels in |expected - actual|, so the anchor
// needs only the appFrame and the Web Audio clock reading.
let anchorCtx: Pick<AudioContext, 'currentTime'> | null = null;
let anchorCtxTime = 0;
let driftTickCounter = 0;
// A6: the fps-mismatch note is published once per playback session (reset on
// stop). No playbackRate scaling ever occurs.
let fpsMismatchNoted = false;
// Live Paint cursor + loop window, tracked from playAtCursor / positionedAt /
// checkDrift calls — the restart position for mid-playback revisioned updates
// (D-03).
let liveCursorAppFrame = 0;
let livePlaybackRangeEnd = 0;
const preparedTrackIds = new Set<string>();

export const efxPaintAudioMonitor = {
  /**
   * Fetch + decode every non-muted track. Per-track try/catch: a failed fetch
   * (efxasset 404) or decode logs console.warn and skips ONLY that track —
   * playback of the others never blocks and never throws (AUDIO-06).
   */
  async prepare(next: EfxPaintAudioPreviewContext): Promise<void> {
    context = next;
    preparedTrackIds.clear();
    if (state === 'idle') state = 'positioned';
    await Promise.all(next.tracks.filter((track) => !track.muted).map(async (track) => {
      try {
        const response = await fetch(track.assetUrl);
        if (!response.ok) throw new Error(`efxasset fetch failed (status ${response.status})`);
        const bytes = await response.arrayBuffer();
        await audioEngine.decode(track.id, bytes);
        preparedTrackIds.add(track.id);
      } catch (error) {
        preparedTrackIds.delete(track.id);
        console.warn(`[efxPaintAudioMonitor] skipping audio track "${track.id}" — asset fetch/decode failed`, error);
      }
    }));
  },

  /**
   * Start (or seek-restart) monitoring at the Paint cursor. ensureContext()
   * runs inside the Play gesture chain, so autoplay suspension is handled.
   * Called again while playing: stopAll first, then re-dispatch at the new
   * cursor (seek-restart discipline — the D-03/D-11 template).
   */
  playAtCursor(cursorAppFrame: number, playbackRangeEnd: number): void {
    const current = context;
    if (!current) return;
    const ctx = audioEngine.ensureContext();
    if (state === 'playing') audioEngine.stopAll();
    for (const track of current.tracks) {
      if (track.muted || !preparedTrackIds.has(track.id)) continue;
      const resolution = resolveTrackPlayback(track, cursorAppFrame, playbackRangeEnd, current.fps);
      if (!resolution) continue;
      // The payload entry is AudioTrack-compatible for the engine's
      // fade/volume math (same timing/gain field names) — the engine consumes
      // it unchanged; it never sees the extra AudioTrack authority fields.
      const trackLike = track as unknown as AudioTrack;
      if (resolution.kind === 'immediate') {
        audioEngine.play(track.id, resolution.sourceOffsetSec, trackLike, current.fps, resolution.maxPlaySec);
      } else {
        audioEngine.playDelayed(track.id, resolution.delaySec, resolution.sourceOffsetSec, trackLike, current.fps, resolution.maxPlaySec);
      }
    }
    anchorAppFrame = cursorAppFrame;
    anchorCtx = ctx;
    anchorCtxTime = ctx.currentTime;
    driftTickCounter = 0;
    liveCursorAppFrame = cursorAppFrame;
    livePlaybackRangeEnd = playbackRangeEnd;
    state = 'playing';
  },

  /** Stop all sources and clear the anchor. No-op unless playing. */
  stop(): void {
    if (state !== 'playing') return;
    audioEngine.stopAll();
    anchorAppFrame = 0;
    anchorCtx = null;
    anchorCtxTime = 0;
    driftTickCounter = 0;
    fpsMismatchNoted = false;
    state = context ? 'positioned' : 'idle';
  },

  /** Reposition the anchor without sound (D-09 silent scrub). */
  positionedAt(cursorAppFrame: number): void {
    anchorAppFrame = cursorAppFrame;
    liveCursorAppFrame = cursorAppFrame;
    if (state === 'idle') state = 'positioned';
  },

  /**
   * D-11 loop wrap: re-seek audio to the mapped loop start via the normal
   * seek-restart path (stopAll + play at the loop-start mapping). Source
   * audio metadata is never touched. No-op unless playing.
   */
  notifyLoopWrap(loopStartAppFrame: number, playbackRangeEnd: number): void {
    if (state !== 'playing') return;
    this.playAtCursor(loopStartAppFrame, playbackRangeEnd);
  },

  /**
   * D-10 drift corrector: invoked from the playback tick with the current
   * Paint cursor; self-throttles to one comparison per
   * EFX_PAINT_AUDIO_DRIFT_CHECK_INTERVAL_TICKS calls. Computes expected vs
   * actual per truth table section 5 and runs a full seek-restart at the
   * current cursor only when absolute drift exceeds
   * EFX_PAINT_AUDIO_DRIFT_THRESHOLD_SEC. Playing sources are never nudged.
   */
  checkDrift(cursorAppFrame: number, playbackRangeEnd: number): void {
    liveCursorAppFrame = cursorAppFrame;
    livePlaybackRangeEnd = playbackRangeEnd;
    if (state !== 'playing' || !context || !anchorCtx) return;
    driftTickCounter += 1;
    if (driftTickCounter < EFX_PAINT_AUDIO_DRIFT_CHECK_INTERVAL_TICKS) return;
    driftTickCounter = 0;
    const expectedSec = (cursorAppFrame - anchorAppFrame) / context.fps;
    const actualSec = anchorCtx.currentTime - anchorCtxTime;
    if (Math.abs(expectedSec - actualSec) > EFX_PAINT_AUDIO_DRIFT_THRESHOLD_SEC) {
      this.playAtCursor(cursorAppFrame, playbackRangeEnd);
    }
  },

  /**
   * Locked A6 (a6-matched-fps): sync is guaranteed when the child playback
   * fps equals the project fps. On mismatch, return a non-blocking status
   * note — once per playback session (reset by stop()). No playbackRate
   * scaling, no pitch shift, ever.
   */
  noteFpsMismatchOnce(projectFps: number, playbackFps: number): string | null {
    if (fpsMismatchNoted || playbackFps === projectFps) return null;
    fpsMismatchNoted = true;
    return `Audio preview sync is best-effort: playback at ${playbackFps} fps differs from the project ${projectFps} fps. Sync is guaranteed at matched fps.`;
  },

  /**
   * D-03 mid-playback revisioned update: adopt the newer context (fetch +
   * decode any new/changed tracks through the same prepare path), then — when
   * playing — restart audio at the CURRENT Paint cursor with the new context
   * (stopAll + fresh dispatch, never deferred to next play). When idle or
   * positioned, only the stored context and the anchor are updated; zero
   * audio dispatch.
   */
  async applyRevisionedContext(next: EfxPaintAudioPreviewContext): Promise<void> {
    const restartAtCursor = state === 'playing';
    await this.prepare(next);
    if (restartAtCursor) {
      this.playAtCursor(liveCursorAppFrame, livePlaybackRangeEnd);
    } else {
      anchorAppFrame = liveCursorAppFrame;
    }
  },

  isPlaying(): boolean {
    return state === 'playing';
  },

  /** Anchor accessor for the drift corrector and scrub tests (D-09/D-10). */
  getAnchorAppFrame(): number {
    return anchorAppFrame;
  },
};

/**
 * Single child-side funnel for pushed audio-context events (D-02/D-03,
 * AUDIO-04): validate + strict newer-than revision guard
 * (applyRevisionedEfxPaintAudioPreview — stale or equal revisions are dropped
 * silently, same-revision re-delivery is a defined no-op), then hand the
 * accepted section to the monitor. Returns null for a dropped delivery (zero
 * audio dispatch), otherwise the monitor's apply promise.
 */
export function handleEfxPaintAudioContextEvent(value: unknown): Promise<void> | null {
  const applied = applyRevisionedEfxPaintAudioPreview(efxPaintAudioPreviewStore, value);
  if (!applied) return null;
  const section = efxPaintAudioPreviewStore.getSection();
  if (!section) return null;
  return efxPaintAudioMonitor.applyRevisionedContext(section);
}
