import type { AudioTrack } from '../../../types/audio';
import type { EfxPaintAudioPreviewContext, PhysicPaintDocumentAudioSection } from '../../../types/physicPaint';
import { audioEngine } from '../../../lib/audioEngine';
import {
  resolveClipPlayback,
  resolveDocumentSoundClip,
  studioClipLegEnabled,
  studioMainLegEnabled,
  toDocumentSoundAudioTrack,
} from '../../../lib/documentSoundGates';
import { getDocument } from '../../../stores/efxPaintStore';
import { applyRevisionedEfxPaintAudioPreview, resolveTrackPlayback } from './efxPaintAudioPreviewContext';
import { audioPreviewEnabled, configureAudioPreviewToggleEffect, efxPaintAudioPreviewStore } from './efxPaintAudioPreviewStore';
import { efxPaintDocumentAudioStore } from './efxPaintDocumentAudioStore';
import { efxPaintAudioOwnership } from './efxPaintAudioOwnership';
import { isPhysicsPaintProfilingEnabled } from '../performance/physicsPaintPerformanceTrace';

/** Profile-gated scrub diagnostics (G-52-9): names the exact gate that silenced
 * a scrub snippet so a silent-scrub report carries its cause in the console. */
function logAudioScrubDiagnostic(...args: unknown[]): void {
  if (isPhysicsPaintProfilingEnabled()) console.warn('[efx-paint-audio]', ...args);
}

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
// D-02 amendment (260902-cfa): audible scrub. While dragging the ruler with
// playback idle and monitoring enabled, each scrub update re-dispatches a short
// snippet from the current position, throttled to avoid stopAll/re-prepare
// spam and crackle. The snippet window is a few frames past the cursor; the
// monitor's playAtCursor caps it at each track's audible window.
export const EFX_PAINT_AUDIO_SCRUB_THROTTLE_MS = 120;
export const EFX_PAINT_AUDIO_SCRUB_SNIPPET_FRAMES = 4;

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
// D-02 amendment: last audible-scrub snippet dispatch time (performance.now()).
// Initialized so the first scrub of a session always dispatches; reset by the
// single stop funnel so a fresh scrub starts unthrottled.
let lastScrubAt = -EFX_PAINT_AUDIO_SCRUB_THROTTLE_MS;
// Live Paint cursor + loop window, tracked from playAtCursor / positionedAt /
// checkDrift calls — the restart position for mid-playback revisioned updates
// (D-03).
let liveCursorAppFrame = 0;
let livePlaybackRangeEnd = 0;
// D-14: visual playback is running with the session toggle Off (a Play
// attempt while muted, a mid-playback mute, or a toggle-gated D-07 resume
// all land here). A later toggle-On resumes at the live cursor ONLY when this
// flag is set; the visual-stop funnel (stop) clears it.
let toggleSilenced = false;
const preparedTrackIds = new Set<string>();

/**
 * Shared warn-and-skip prepare for one source id (main track OR document
 * clip): a failed fetch (efxasset 404) or decode logs console.warn and skips
 * ONLY that source — playback of the others never blocks and never throws
 * (AUDIO-06 / 52.5-01a clip prepare through the same path, keyed by clip id).
 */
async function fetchAndDecodeSource(id: string, assetUrl: string): Promise<void> {
  try {
    const response = await fetch(assetUrl);
    if (!response.ok) throw new Error(`efxasset fetch failed (status ${response.status})`);
    const bytes = await response.arrayBuffer();
    await audioEngine.decode(id, bytes);
    preparedTrackIds.add(id);
  } catch (error) {
    preparedTrackIds.delete(id);
    console.warn(`[efxPaintAudioMonitor] skipping audio track "${id}" — asset fetch/decode failed`, error);
  }
}

export const efxPaintAudioMonitor = {
  /**
   * Fetch + decode every non-muted main track plus the document clip (52.5-01a).
   * Per-source try/catch via fetchAndDecodeSource — never throws (AUDIO-06).
   * `next` may be null: a clip-only session (zero main-audio tracks) still
   * prepares the clip so the widened useRotoCachedPlayback gate can play it.
   */
  async prepare(next: EfxPaintAudioPreviewContext | null): Promise<void> {
    context = next;
    preparedTrackIds.clear();
    if (state === 'idle') state = 'positioned';
    const jobs: Promise<void>[] = next
      ? next.tracks.filter((track) => !track.muted).map((track) => fetchAndDecodeSource(track.id, track.assetUrl))
      : [];
    const clip = efxPaintDocumentAudioStore.getSection();
    if (clip) jobs.push(fetchAndDecodeSource(clip.clipId, clip.assetUrl));
    await Promise.all(jobs);
  },

  /**
   * 52.5-01a (Q1): decode ONLY the current document clip — used by the
   * documentAudio push funnel where the main tracks are already prepared and
   * must not be re-fetched. Warn-and-skip, same path.
   */
  async prepareClip(): Promise<void> {
    const clip = efxPaintDocumentAudioStore.getSection();
    if (clip) await fetchAndDecodeSource(clip.clipId, clip.assetUrl);
  },

  /**
   * Start (or seek-restart) monitoring at the Paint cursor. ensureContext()
   * runs inside the Play gesture chain, so autoplay suspension is handled.
   * Called again while playing: stopAll first, then re-dispatch at the new
   * cursor (seek-restart discipline — the D-03/D-11 template).
   *
   * Two legs (52.5-01a, Q3 / STUDIO-MIX-01 — mix, don't contend):
   *  1. MAIN-track leg — entry gates, in order (both keep the live cursor
   *     current so a later resume restarts at the true position):
   *     a. D-13/D-14 session toggle AND the modal preview-main toggle
   *        (studioMainLegEnabled, Q3 AND composition) — a muted session or a
   *        preview-main-Off session dispatches no main tracks.
   *     b. D-05/D-06 first-player-wins ownership — suppressed with the status
   *        note; a window already holding the claim is never suppressed by a
   *        later main start.
   *  2. DOCUMENT CLIP leg — gated by NEITHER toggle and reachable even when
   *     the claim fails (the ownership early-return only ever ends the MAIN
   *     leg). Dispatched INSIDE playAtCursor after the main loop, so
   *     stopAll, seek-restart, drift, loop-wrap, and scrub funnels cover it.
   */
  playAtCursor(cursorAppFrame: number, playbackRangeEnd: number): void {
    const current = context;
    const clipSection = efxPaintDocumentAudioStore.getSection();
    if (!current && !clipSection) return;
    liveCursorAppFrame = cursorAppFrame;
    livePlaybackRangeEnd = playbackRangeEnd;
    const sessionToggleOn = audioPreviewEnabled.peek();
    if (!sessionToggleOn) {
      // D-14: a start/restart attempt while muted leaves visual playback
      // running silent — remember it so a later toggle-On resumes here. The
      // ungated clip leg below may still dispatch (Q3); it never clears this
      // flag on its own.
      toggleSilenced = true;
    }
    // UAT round 2: the main leg rides the SESSION monitoring toggle alone —
    // the document-sound modal never touches the main app's audio.
    const sound = clipSection
      ? resolveDocumentSoundClip(getDocument(efxPaintDocumentAudioStore.getLayerId() ?? ''), clipSection)
      : null;
    let mainLeg = Boolean(current) && studioMainLegEnabled(sessionToggleOn);
    if (mainLeg && !efxPaintAudioOwnership.canStartAudio()) {
      // D-05/D-06: the guard suppresses the MAIN leg only — the clip mixes
      // through (it never sits behind this early-return).
      logAudioScrubDiagnostic('playAtCursor suppressed: main window holds audio');
      efxPaintAudioOwnership.noteSuppressed();
      mainLeg = false;
    }
    const fps = current?.fps ?? efxPaintDocumentAudioStore.getFps();
    const clipResolution = sound && clipSection
      ? resolveClipPlayback(sound, cursorAppFrame, playbackRangeEnd, fps)
      : null;
    const clipLeg = Boolean(
      sound && studioClipLegEnabled(sound.enabled) && clipSection && clipResolution && preparedTrackIds.has(clipSection.clipId),
    );
    if (!mainLeg && !clipLeg) {
      // Nothing dispatchable at this cursor: a mid-playback re-entry must not
      // leave stale sources running (seek beyond every audible window).
      if (state === 'playing') this.stop();
      return;
    }
    const ctx = audioEngine.ensureContext();
    if (state === 'playing') audioEngine.stopAll();
    let dispatched = 0;
    if (mainLeg && current) {
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
        dispatched += 1;
      }
    }
    if (clipLeg && sound && clipSection && clipResolution) {
      // D-14: the adapter scales the percent volume to linear and carries the
      // fade fields — the engine's gain/applyFadeSchedule math applies them
      // unchanged (if the adapter did not scale, this is where it would show).
      const clipTrack = toDocumentSoundAudioTrack(sound, clipSection.assetUrl, fps);
      if (clipResolution.kind === 'immediate') {
        audioEngine.play(sound.id, clipResolution.sourceOffsetSec, clipTrack, fps, clipResolution.maxPlaySec);
      } else {
        audioEngine.playDelayed(sound.id, clipResolution.delaySec, clipResolution.sourceOffsetSec, clipTrack, fps, clipResolution.maxPlaySec);
      }
      dispatched += 1;
    }
    logAudioScrubDiagnostic('playAtCursor:', cursorAppFrame, '| dispatched', dispatched, 'tracks | AudioContext', ctx.state);
    anchorAppFrame = cursorAppFrame;
    anchorCtx = ctx;
    anchorCtxTime = ctx.currentTime;
    driftTickCounter = 0;
    // The main leg runs iff the session toggle is On — a clip dispatch under
    // a muted session keeps the D-14 flag set so a later toggle-On starts main.
    toggleSilenced = !sessionToggleOn;
    state = 'playing';
    // D-05 claim lifecycle: ONLY a dispatched MAIN leg claims ownership — the
    // clip alone never claims (mix, don't contend).
    if (mainLeg) efxPaintAudioOwnership.claimAudio();
  },

  /**
   * Stop all sources and clear the anchor. Also the visual-stop funnel for
   * the ownership guard and the toggle: releases the claim, drops any pending
   * suppression, and clears the muted-mid-playback flag (both idempotent — a
   * second stop stays a no-op).
   */
  stop(): void {
    toggleSilenced = false;
    // D-02 amendment: any stop (visual stop, toggle Off, scrub release) resets
    // the audible-scrub throttle so the next scrub starts unthrottled.
    lastScrubAt = -EFX_PAINT_AUDIO_SCRUB_THROTTLE_MS;
    efxPaintAudioOwnership.releaseAudio();
    efxPaintAudioOwnership.noteVisualStop();
    if (state !== 'playing') return;
    audioEngine.stopAll();
    anchorAppFrame = 0;
    anchorCtx = null;
    anchorCtxTime = 0;
    driftTickCounter = 0;
    fpsMismatchNoted = false;
    state = (context || efxPaintDocumentAudioStore.getSection()) ? 'positioned' : 'idle';
  },

  /** Reposition the anchor without sound (D-09 silent scrub). */
  positionedAt(cursorAppFrame: number): void {
    anchorAppFrame = cursorAppFrame;
    liveCursorAppFrame = cursorAppFrame;
    if (state === 'idle') state = 'positioned';
  },

  /**
   * D-02 amendment (audible scrub): re-dispatch a short snippet at the dragged
   * position through the normal playAtCursor funnel (stopAll + re-dispatch),
   * throttled to EFX_PAINT_AUDIO_SCRUB_THROTTLE_MS so a fast drag never spams
   * stopAll/re-prepare. The snippet window is a few frames past the cursor
   * (EFX_PAINT_AUDIO_SCRUB_SNIPPET_FRAMES); playAtCursor caps it at each
   * track's audible window.
   *
   * 52.5 UAT fix: the gate is "anything could sound here", not "main context
   * exists" — a document-clip-only session (context null after prepare(null))
   * must scrub its clip audibly exactly as Play sounds it. Main leg still
   * needs context AND the session toggle; the clip leg needs its section and
   * its `enabled` switch ON (playAtCursor decides what actually dispatches).
   * A scrub with nothing dispatchable stays a D-09 positionedAt re-anchor.
   */
  scrubAt(cursorAppFrame: number): void {
    const clipSection = efxPaintDocumentAudioStore.getSection();
    const sound = clipSection
      ? resolveDocumentSoundClip(getDocument(efxPaintDocumentAudioStore.getLayerId() ?? ''), clipSection)
      : null;
    const hasMain = Boolean(context) && audioPreviewEnabled.peek();
    const hasClip = Boolean(clipSection && sound && sound.enabled);
    if (!hasMain && !hasClip) {
      logAudioScrubDiagnostic('scrubAt gated:', !context ? 'no-context (prepare never ran)' : 'toggle-off', 'frame', cursorAppFrame);
      this.positionedAt(cursorAppFrame);
      return;
    }
    const now = performance.now();
    if (now - lastScrubAt < EFX_PAINT_AUDIO_SCRUB_THROTTLE_MS) return;
    lastScrubAt = now;
    logAudioScrubDiagnostic('scrubAt dispatch:', cursorAppFrame, '| prepared', preparedTrackIds.size, '/', context ? context.tracks.length : 0, 'tracks | canStart', efxPaintAudioOwnership.canStartAudio());
    this.playAtCursor(cursorAppFrame, cursorAppFrame + EFX_PAINT_AUDIO_SCRUB_SNIPPET_FRAMES);
  },

  /**
   * D-02 amendment: drag release — stop the snippet through the single stop
   * funnel (releases the transient ownership claim) and re-anchor the audio at
   * the final frame so the next Play resumes there.
   */
  scrubEnd(finalAppFrame: number): void {
    this.stop();
    this.positionedAt(finalAppFrame);
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
   * D-14 toggle funnel, driven by setAudioPreviewEnabled through the injected
   * effect channel. Off: an audible session stops immediately through the
   * single stop funnel (visual playback is untouched — the toggle never
   * stops the frame timer) and is flagged so a later On resumes; an idle or
   * ownership-suppressed session is a pure state change (the D-06 note
   * lifecycle is unchanged). On: resumes at the live Paint cursor only when
   * playback is running silent. Same-value repeats never reach here — the
   * store setter is idempotent (AUDIO-05).
   */
  setPreviewEnabled(enabled: boolean): void {
    if (!enabled) {
      if (state !== 'playing') return;
      this.stop();
      toggleSilenced = true;
      // Q3 (52.5-01a): the toggle silences ONLY the main leg — re-enter the
      // play funnel so an active document clip keeps sounding through the
      // muted session (the clip leg is gated by neither toggle). With no clip
      // the re-entry hits the muted-session early return with zero engine
      // dispatch (MON-01 baseline unchanged).
      this.playAtCursor(liveCursorAppFrame, livePlaybackRangeEnd);
      return;
    }
    if (!toggleSilenced) return;
    toggleSilenced = false;
    this.playAtCursor(liveCursorAppFrame, livePlaybackRangeEnd);
  },

  /**
   * D-03 mid-playback revisioned update: adopt the newer context (fetch +
   * decode any new/changed tracks through the same prepare path), then — when
   * playing — restart audio at the CURRENT Paint cursor with the new context
   * (stopAll + fresh dispatch, never deferred to next play). The restart
   * decision is taken AFTER prepare resolves: a toggle racing the update
   * lands inside the await, and the funnel's final word reflects the state at
   * acceptance time — Off always ends silent, On always ends positioned
   * (AUDIO-05 concurrency edge). When idle or positioned, only the stored
   * context and the anchor are updated; zero audio dispatch.
   */
  async applyRevisionedContext(next: EfxPaintAudioPreviewContext): Promise<void> {
    await this.prepare(next);
    if (state === 'playing') {
      this.playAtCursor(liveCursorAppFrame, livePlaybackRangeEnd);
    } else {
      anchorAppFrame = liveCursorAppFrame;
    }
  },

  /**
   * 52.5-01a (Q1): a newer documentAudio section (or a null clear) just
   * entered the child store. Present section: decode the clip through the
   * warn-and-skip path, then — when playing — restart at the CURRENT Paint
   * cursor so the clip leg reflects the change immediately (D-03 discipline;
   * the restart's stopAll retires the previous clip source). Null clear:
   * retire ONLY the clip source — the main leg keeps playing untouched.
   */
  async applyRevisionedDocumentAudio(previous: PhysicPaintDocumentAudioSection | null): Promise<void> {
    const section = efxPaintDocumentAudioStore.getSection();
    if (!section) {
      if (previous) {
        audioEngine.stop(previous.clipId);
        preparedTrackIds.delete(previous.clipId);
      }
      return;
    }
    await this.prepareClip();
    if (state === 'playing') {
      this.playAtCursor(liveCursorAppFrame, livePlaybackRangeEnd);
    } else {
      anchorAppFrame = liveCursorAppFrame;
    }
  },

  isPlaying(): boolean {
    return state === 'playing';
  },

  /**
   * D-08 engine release on window close (AUDIO-06): stop every source through
   * the single stop funnel — stopAll covers scheduled playDelayed sources
   * (RESEARCH Pitfall 6) and the funnel also releases the ownership claim and
   * clears suppression — then close the AudioContext if one exists and
   * discard it. A closed context is never reused: a later playAtCursor
   * creates a fresh one via ensureContext (clean re-open). Idempotent: a
   * second release performs no stopAll (stop is a no-op unless playing) and
   * no close (hasContext is false once the context is discarded). The stored
   * context section and prepared buffers survive — release tears down the
   * engine, not the monitoring session, so a post-release Play simply
   * re-creates the context.
   */
  release(): void {
    this.stop();
    if (audioEngine.hasContext()) {
      void audioEngine.closeContext();
    }
  },

  /** Anchor accessor for the drift corrector and scrub tests (D-09/D-10). */
  getAnchorAppFrame(): number {
    return anchorAppFrame;
  },
};

/**
 * 52.5-01a (Q1, T-52.5-08): the shared PHYSIC_PAINT_AUDIO_CONTEXT_EVENT carries
 * EITHER payload shape — disjoint key sets ({revision,fps,tracks} vs
 * {revision,clipId,assetUrl}) plus the null clear. A `clipId` member or an
 * explicit null routes to the documentAudio funnel; everything else is the
 * audioPreview shape (which never carries clipId and never sends null).
 */
function isDocumentAudioTransport(value: unknown): boolean {
  if (value === null) return true;
  return typeof value === 'object' && !Array.isArray(value) && 'clipId' in value;
}

/**
 * Single child-side funnel for pushed audio-context events (D-02/D-03,
 * AUDIO-04, 52.5-01a): route by payload shape, then validate + strict
 * newer-than revision guard in the owning store (equal/stale dropped
 * silently, same-revision re-delivery is a defined no-op), then hand the
 * accepted section to the monitor. Returns null for a dropped delivery (zero
 * audio dispatch), otherwise the monitor's apply promise.
 */
export function handleEfxPaintAudioContextEvent(value: unknown): Promise<void> | null {
  if (isDocumentAudioTransport(value)) {
    const previous = efxPaintDocumentAudioStore.getSection();
    const applied = efxPaintDocumentAudioStore.accept(value);
    if (!applied) return null;
    return efxPaintAudioMonitor.applyRevisionedDocumentAudio(previous);
  }
  const applied = applyRevisionedEfxPaintAudioPreview(efxPaintAudioPreviewStore, value);
  if (!applied) return null;
  const section = efxPaintAudioPreviewStore.getSection();
  if (!section) return null;
  return efxPaintAudioMonitor.applyRevisionedContext(section);
}

/**
 * D-07 auto-resume entry: restart monitoring at the live Paint cursor through
 * the standard funnel (playAtCursor re-checks the session toggle and the
 * ownership guard, so a muted or re-claimed window dispatches nothing).
 */
export function resumeEfxPaintAudioAtLiveCursor(): void {
  efxPaintAudioMonitor.playAtCursor(liveCursorAppFrame, livePlaybackRangeEnd);
}

// The ownership guard drives D-07 auto-resume through this funnel. Module-
// scope registration is safe: the monitor is child-window-only code — the
// main window never imports it (AUDIO-01 authority boundary).
efxPaintAudioOwnership.configure({ resumeHandler: resumeEfxPaintAudioAtLiveCursor });

// D-14: the session toggle's immediate mid-playback effect routes through the
// monitor funnel (Off stops, On resumes at the live cursor when playback is
// running silent). Same child-only module-scope discipline as above.
configureAudioPreviewToggleEffect((enabled) => efxPaintAudioMonitor.setPreviewEnabled(enabled));
