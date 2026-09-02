import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { batch, signal, type Signal } from '@preact/signals';
import type { PhysicPaintRotoPlaybackSettings } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { efxPaintAudioMonitor } from '../audio/efxPaintAudioMonitor';
import { efxPaintAudioPreviewStore } from '../audio/efxPaintAudioPreviewStore';
import { efxPaintAudioOwnership } from '../audio/efxPaintAudioOwnership';

const MIN_ROTO_PLAYBACK_FPS = 1;
const MAX_ROTO_PLAYBACK_FPS = 60;

export interface RotoCachedPlaybackFrame<Frame> {
  appFrame: number;
  frame: Frame | null;
}

/**
 * 38.1-D-01 per-tick playback surface: one write per playback tick, read ONLY
 * by the sanctioned live surfaces (the playback canvas image subscriber and
 * the nav-pill current-frame indicator). Writing this signal never re-renders
 * the Studio — anything needing its value outside a live surface must peek().
 */
export interface RotoCachedPlaybackTick<Frame = unknown> {
  frameIndex: number;
  appFrame: number;
  frame: Frame | null;
}

export interface UseRotoCachedPlaybackInput<Frame> {
  initialSettings: PhysicPaintRotoPlaybackSettings;
  workflowMode: PhysicsPaintWorkflowMode;
  getFrames: () => RotoCachedPlaybackFrame<Frame>[];
  /**
   * D-01 (260902-cfa amendment): the shared application-frame cursor at Play
   * press time. start() begins visual playback at this frame and dispatches
   * playAtCursor(cursorAppFrame, rangeEnd) — resume re-anchors at the cursor,
   * never the range start. Absent (or an out-of-range value) falls back to the
   * range start.
   */
  getCurrentAppFrame?: () => number;
  onStart: (frameCount: number) => void;
  onFrame: (frameIndex: number, appFrame: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

export interface RotoCachedPlayback<Frame> {
  isActive: boolean;
  frame: Frame | null;
  playbackTick: Signal<RotoCachedPlaybackTick<Frame> | null>;
  status: string | null;
  setStatus: (status: string | null) => void;
  loop: boolean;
  fps: number;
  setLoop: (loop: boolean) => void;
  getSettings: () => PhysicPaintRotoPlaybackSettings;
  replaceSettings: (settings: PhysicPaintRotoPlaybackSettings) => void;
  start: (fps?: number) => void;
  stop: () => void;
  toggle: () => void;
  seek: (targetAppFrame: number) => void;
  scrub: (targetAppFrame: number) => void;
  scrubEnd: (finalAppFrame: number) => void;
  updateFps: (fps: number) => void;
  resetForLaunch: (settings: PhysicPaintRotoPlaybackSettings) => void;
}

export function clampRotoPlaybackFps(value: number): number {
  if (!Number.isFinite(value)) return MIN_ROTO_PLAYBACK_FPS;
  return Math.max(MIN_ROTO_PLAYBACK_FPS, Math.min(MAX_ROTO_PLAYBACK_FPS, value));
}

export function useRotoCachedPlayback<Frame>(input: UseRotoCachedPlaybackInput<Frame>): RotoCachedPlayback<Frame> {
  const initialSettings = {
    loop: input.initialSettings.loop,
    fps: clampRotoPlaybackFps(input.initialSettings.fps),
  };
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loop, setLoopState] = useState(initialSettings.loop);
  const [fps, setFps] = useState(initialSettings.fps);
  const settingsRef = useRef<PhysicPaintRotoPlaybackSettings>(initialSettings);
  const timerRef = useRef<number | null>(null);
  // 260902-cfa (D-02): the playback frame index lives on a ref so the seek
  // method can re-anchor it mid-playback. Plain mutable ref — never drives
  // rendering (the per-tick frame flows through playbackTick, 38.1-D-01).
  const frameIndexRef = useRef(0);
  // 41-CR-01: monotonic playback-session generation. start() bumps it so every
  // fresh start (including updateFps re-entry and resetForLaunch→start) gets a
  // new generation; finishPlayback (the single stop funnel) bumps it again so
  // any in-flight prepare from the just-ended session goes stale. Plain
  // mutable ref — never drives rendering (no signal, no state).
  const audioSessionRef = useRef(0);
  const inputRef = useRef(input);
  inputRef.current = input;
  // 38.1-D-01/D-08: the per-tick frame lives on a signal, not useState, so a
  // playback tick never re-renders the Studio. Created once per hook instance
  // (ref-held); `frame` remains readable as a plain value via the getter on
  // the returned object (existing consumer/test contract).
  const playbackTickRef = useRef<Signal<RotoCachedPlaybackTick<Frame> | null> | null>(null);
  if (playbackTickRef.current === null) playbackTickRef.current = signal<RotoCachedPlaybackTick<Frame> | null>(null);
  const playbackTick = playbackTickRef.current;
  // 38.1-D-02: capsule-bound status events raised while playback is ACTIVE are
  // appended to this queue instead of publishing to render state per tick;
  // finishPlayback (the single stop funnel) flushes the queue ONCE inside the
  // same synchronous block as the play-state restoration, so Preact's render
  // queue produces exactly ONE catch-up render showing the flushed line once,
  // after which the 36.15/38 capsule arbitration resumes the idle context line
  // (38 D-10). Events are never dropped; the queue is cleared on flush, and a
  // second stop without an intervening start flushes nothing.
  const queuedStatusEventsRef = useRef<string[]>([]);
  const statusGateActiveRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const finishPlayback = useCallback(() => {
    // 38.1-D-01: the entire stop path is ONE synchronous block — queue flush,
    // tick clear, and play-state restoration with no intervening await — so
    // exactly ONE catch-up render restores full UI currency on stop.
    batch(() => {
      clearTimer();
      audioSessionRef.current += 1;
      statusGateActiveRef.current = false;
      playbackTick.value = null;
      setIsActive(false);
      const queued = queuedStatusEventsRef.current;
      if (queued.length > 0) {
        queuedStatusEventsRef.current = [];
        setStatus(queued[queued.length - 1]);
      }
      inputRef.current.setIsPlaying(false);
    });
    // 41-02: stop audio monitoring through the same single stop funnel
    // (no-op when the monitor is not playing).
    efxPaintAudioMonitor.stop();
  }, [clearTimer, playbackTick]);

  const stop = useCallback(() => {
    finishPlayback();
  }, [finishPlayback]);

  const replaceSettings = useCallback((settings: PhysicPaintRotoPlaybackSettings) => {
    const next = { loop: settings.loop, fps: clampRotoPlaybackFps(settings.fps) };
    settingsRef.current = next;
    setLoopState(next.loop);
    setFps(next.fps);
  }, []);

  const resetForLaunch = useCallback((settings: PhysicPaintRotoPlaybackSettings) => {
    finishPlayback();
    replaceSettings(settings);
  }, [finishPlayback, replaceSettings]);

  const start = useCallback((requestedFps = settingsRef.current.fps) => {
    const currentInput = inputRef.current;
    const cachedFrames = currentInput.getFrames();
    if (cachedFrames.length === 0) {
      // A re-entrant start() (e.g. updateFps after frames were cleared
      // mid-playback) must stop the previously running playback BEFORE
      // publishing the empty status — otherwise the stale interval keeps
      // ticking with the old frame list while the UI reports playback
      // impossible. finishPlayback is the single stop funnel (D-02); it is
      // skipped when no timer is running so a plain empty start never
      // touches the external play-state callback.
      if (timerRef.current !== null) finishPlayback();
      setStatus('No cached Roto frames yet. Missing frames play transparent/background.');
      return;
    }
    const playbackFps = clampRotoPlaybackFps(requestedFps);
    const missingCount = cachedFrames.filter((entry) => !entry.frame).length;
    // D-01 (260902-cfa amendment): Play re-anchors at the current
    // application-frame cursor — an idle seek to frame N resumes visually AND
    // audibly at N, never the range start. An out-of-range cursor (or no
    // matching frame) falls back to the range start; loop wrap still returns
    // to the range start (the showNextFrame wrap branch below).
    const cursorAppFrame = currentInput.getCurrentAppFrame?.() ?? 0;
    const cursorIndex = cachedFrames.findIndex((entry) => entry.appFrame === cursorAppFrame);
    const startIndex = cursorIndex >= 0 ? cursorIndex : 0;
    frameIndexRef.current = startIndex;
    clearTimer();
    audioSessionRef.current += 1;
    setIsActive(true);
    currentInput.setIsPlaying(true);
    currentInput.onStart(cachedFrames.length);
    const startStatus = missingCount > 0
      ? `Playing cached Roto frames at ${playbackFps} fps. ${missingCount} missing frame(s). Missing frames play transparent/background.`
      : `Playing ${cachedFrames.length} cached Roto frame(s) at ${playbackFps} fps. Missing frames play transparent/background.`;
    setStatus(startStatus);
    // D-02: the start line doubles as the deferred playback event — visible
    // from the start transition render, re-published once inside the stop
    // catch-up render, then the idle context line resumes (38 D-10).
    queuedStatusEventsRef.current = [startStatus];
    statusGateActiveRef.current = true;
    // 41-02 audio monitoring: default-On until the 41-04 toggle lands. The
    // loop window cap is the playback-range end (truth table section 2) — the
    // first cached appFrame is the Play cursor, one past the last is the end.
    // Store reads use peek() (38.1-D-01); the engine singleton is reused (D-08).
    const audioPreview = efxPaintAudioPreviewStore.getSection();
    if (audioPreview && audioPreview.tracks.length > 0) {
      const audioCursorAppFrame = cachedFrames[startIndex].appFrame;
      const audioPlaybackRangeEnd = cachedFrames[cachedFrames.length - 1].appFrame + 1;
      // 41-CR-01: capture this start's session generation before the async
      // prepare; the deferred play dispatches ONLY when playback is still
      // active AND no newer session (or stop) has superseded this one —
      // otherwise orphaned audio could start after a visual stop and latch
      // the ownership claim.
      const audioSession = audioSessionRef.current;
      void efxPaintAudioMonitor.prepare(audioPreview).then(() => {
        if (timerRef.current === null || audioSessionRef.current !== audioSession) return;
        efxPaintAudioMonitor.playAtCursor(audioCursorAppFrame, audioPlaybackRangeEnd);
      });
      // 41-03 (locked A6): matched-fps guarantee — surface a non-blocking
      // note once per playback session when playback fps diverges from the
      // project fps. Routed through the publishStatus gate (queued during
      // playback, flushed on stop); playbackRate is never scaled.
      const fpsNote = efxPaintAudioMonitor.noteFpsMismatchOnce(audioPreview.fps, playbackFps);
      if (fpsNote) publishStatus(fpsNote);
    }
    const showNextFrame = () => {
      if (frameIndexRef.current >= cachedFrames.length) {
        if (!settingsRef.current.loop) {
          finishPlayback();
          return;
        }
        frameIndexRef.current = 0;
        // 41-03 (D-11): every loop wrap re-seeks audio to the mapped loop
        // start via stopAll + restart; source metadata untouched.
        efxPaintAudioMonitor.notifyLoopWrap(
          cachedFrames[0].appFrame,
          cachedFrames[cachedFrames.length - 1].appFrame + 1,
        );
      }
      const cachedFrame = cachedFrames[frameIndexRef.current];
      playbackTick.value = { frameIndex: frameIndexRef.current, appFrame: cachedFrame.appFrame, frame: cachedFrame.frame ?? null };
      inputRef.current.onFrame(frameIndexRef.current, cachedFrame.appFrame);
      frameIndexRef.current += 1;
      // 41-03 (D-10): drift check with the current Paint cursor. The monitor
      // self-throttles (~every 10 ticks), so the tick itself keeps the 38.1
      // D-01 single-write discipline; no per-frame audio re-sync.
      efxPaintAudioMonitor.checkDrift(
        cachedFrame.appFrame,
        cachedFrames[cachedFrames.length - 1].appFrame + 1,
      );
    };
    showNextFrame();
    timerRef.current = window.setInterval(showNextFrame, 1000 / playbackFps);
  }, [clearTimer, finishPlayback, playbackTick]);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
      setStatus('Cached Roto playback stopped.');
      return;
    }
    start();
  }, [isActive, start, stop]);

  // 260902-cfa (D-02): the single seek funnel for the ruler/cursor navigation
  // path. Seek-while-playing is a full audio seek-restart at the new cursor
  // (playAtCursor = stopAll + re-dispatch, truth table section 5) with the
  // visual playback re-anchored at the target frame — main-editor seek-restart
  // parity. Seek-while-idle (or an out-of-range target) is a silent re-anchor
  // (positionedAt, D-09) with zero engine dispatch. Invoked from the
  // navigation handler, never from render (efx-preact-reactivity rule 6).
  const seek = useCallback((targetAppFrame: number) => {
    const currentInput = inputRef.current;
    const cachedFrames = currentInput.getFrames();
    const targetIndex = cachedFrames.findIndex((entry) => entry.appFrame === targetAppFrame);
    if (isActive && targetIndex >= 0) {
      // Re-anchor the frame index past the target so the next timer tick shows
      // the frame AFTER the target (the target itself is displayed now via the
      // playbackTick write below — no double-display).
      frameIndexRef.current = targetIndex + 1;
      const cachedFrame = cachedFrames[targetIndex];
      playbackTick.value = { frameIndex: targetIndex, appFrame: cachedFrame.appFrame, frame: cachedFrame.frame ?? null };
      currentInput.onFrame(targetIndex, cachedFrame.appFrame);
      // Full seek-restart at the new cursor; the range end matches the start()
      // audio range-end derivation (one past the last cached appFrame).
      efxPaintAudioMonitor.playAtCursor(targetAppFrame, cachedFrames[cachedFrames.length - 1].appFrame + 1);
      return;
    }
    // D-09 silent re-anchor: idle, after stop, or an out-of-range target.
    efxPaintAudioMonitor.positionedAt(targetAppFrame);
  }, [isActive, playbackTick]);

  // D-02 amendment (audible scrub): the ruler-drag funnel. While active the
  // scrub is a seek-restart (same as seek — the ruler scrub while playing
  // keeps the animation running from the new frame). While idle it routes to
  // the monitor's throttled short snippet (scrubAt) — audible when the session
  // toggle is On, a silent positionedAt re-anchor when muted (D-09 unchanged).
  const scrub = useCallback((targetAppFrame: number) => {
    if (isActive) {
      seek(targetAppFrame);
      return;
    }
    efxPaintAudioMonitor.scrubAt(targetAppFrame);
  }, [isActive, seek]);

  // D-02 amendment: drag release — stop the snippet and re-anchor at the final
  // frame. A no-op while active (the seek-restart already handled audio).
  const scrubEnd = useCallback((finalAppFrame: number) => {
    if (isActive) return;
    efxPaintAudioMonitor.scrubEnd(finalAppFrame);
  }, [isActive]);

  const setLoop = useCallback((nextLoop: boolean) => {
    settingsRef.current = { ...settingsRef.current, loop: nextLoop };
    setLoopState(nextLoop);
  }, []);

  const updateFps = useCallback((nextValue: number) => {
    const nextFps = clampRotoPlaybackFps(nextValue);
    settingsRef.current = { ...settingsRef.current, fps: nextFps };
    setFps(nextFps);
    if (isActive) start(nextFps);
  }, [isActive, start]);

  const getSettings = useCallback(() => ({ ...settingsRef.current }), []);

  // D-02 gate: while playback is active, capsule-bound status publishes are
  // queued (single-flush-on-stop); outside playback they publish immediately.
  // Null clears always pass through — only events queue.
  const publishStatus = useCallback((next: string | null) => {
    if (statusGateActiveRef.current && next !== null) {
      queuedStatusEventsRef.current.push(next);
      return;
    }
    setStatus(next);
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // 41-04 (D-06): the ownership guard publishes its suppressed/auto-resume
  // notes through this hook's publishStatus gate (queued during playback,
  // flushed once on stop) rather than bypassing capsule arbitration.
  useEffect(() => {
    efxPaintAudioOwnership.configure({ statusPublisher: publishStatus });
    return () => efxPaintAudioOwnership.configure({ statusPublisher: null });
  }, [publishStatus]);

  useEffect(() => {
    if (input.workflowMode !== 'roto') stop();
  }, [input.workflowMode, stop]);

  return {
    isActive,
    get frame() { return playbackTick.value?.frame ?? null; },
    playbackTick,
    status,
    setStatus: publishStatus,
    loop,
    fps,
    setLoop,
    getSettings,
    replaceSettings,
    start,
    stop,
    toggle,
    seek,
    scrub,
    scrubEnd,
    updateFps,
    resetForLaunch,
  };
}
