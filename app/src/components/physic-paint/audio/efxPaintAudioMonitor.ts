import type { AudioTrack } from '../../../types/audio';
import type { EfxPaintAudioPreviewContext } from '../../../types/physicPaint';
import { audioEngine } from '../../../lib/audioEngine';
import { resolveTrackPlayback } from './efxPaintAudioPreviewContext';

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

let state: MonitorState = 'idle';
let context: EfxPaintAudioPreviewContext | null = null;
let anchorAppFrame = 0;
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
    audioEngine.ensureContext();
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
    state = 'playing';
  },

  /** Stop all sources and clear the anchor. No-op unless playing. */
  stop(): void {
    if (state !== 'playing') return;
    audioEngine.stopAll();
    anchorAppFrame = 0;
    state = context ? 'positioned' : 'idle';
  },

  /** Reposition the anchor without sound (D-09 silent scrub). */
  positionedAt(cursorAppFrame: number): void {
    anchorAppFrame = cursorAppFrame;
    if (state === 'idle') state = 'positioned';
  },

  isPlaying(): boolean {
    return state === 'playing';
  },

  /** Anchor accessor for the upcoming drift corrector (D-10, plan 41-03+). */
  getAnchorAppFrame(): number {
    return anchorAppFrame;
  },
};
