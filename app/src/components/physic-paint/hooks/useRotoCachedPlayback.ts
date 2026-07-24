import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { PhysicPaintRotoPlaybackSettings } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';

const MIN_ROTO_PLAYBACK_FPS = 1;
const MAX_ROTO_PLAYBACK_FPS = 60;

export interface RotoCachedPlaybackFrame<Frame> {
  appFrame: number;
  frame: Frame | null;
}

export interface UseRotoCachedPlaybackInput<Frame> {
  initialSettings: PhysicPaintRotoPlaybackSettings;
  workflowMode: PhysicsPaintWorkflowMode;
  getFrames: () => RotoCachedPlaybackFrame<Frame>[];
  onStart: (frameCount: number) => void;
  onFrame: (frameIndex: number, appFrame: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
}

export interface RotoCachedPlayback<Frame> {
  isActive: boolean;
  frame: Frame | null;
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
  const [frame, setFrame] = useState<Frame | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loop, setLoopState] = useState(initialSettings.loop);
  const [fps, setFps] = useState(initialSettings.fps);
  const settingsRef = useRef<PhysicPaintRotoPlaybackSettings>(initialSettings);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const finishPlayback = useCallback(() => {
    clearTimer();
    setFrame(null);
    setIsActive(false);
    inputRef.current.setIsPlaying(false);
  }, [clearTimer]);

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
      setStatus('No cached Roto frames yet. Missing frames play transparent/background.');
      return;
    }
    const playbackFps = clampRotoPlaybackFps(requestedFps);
    const missingCount = cachedFrames.filter((entry) => !entry.frame).length;
    let frameIndex = 0;
    clearTimer();
    setIsActive(true);
    currentInput.setIsPlaying(true);
    currentInput.onStart(cachedFrames.length);
    setStatus(missingCount > 0
      ? `Playing cached Roto frames at ${playbackFps} fps. ${missingCount} missing frame(s). Missing frames play transparent/background.`
      : `Playing ${cachedFrames.length} cached Roto frame(s) at ${playbackFps} fps. Missing frames play transparent/background.`);
    const showNextFrame = () => {
      if (frameIndex >= cachedFrames.length) {
        if (!settingsRef.current.loop) {
          finishPlayback();
          return;
        }
        frameIndex = 0;
      }
      const cachedFrame = cachedFrames[frameIndex];
      setFrame(cachedFrame.frame ?? null);
      inputRef.current.onFrame(frameIndex, cachedFrame.appFrame);
      frameIndex += 1;
    };
    showNextFrame();
    timerRef.current = window.setInterval(showNextFrame, 1000 / playbackFps);
  }, [clearTimer, finishPlayback]);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
      setStatus('Cached Roto playback stopped.');
      return;
    }
    start();
  }, [isActive, start, stop]);

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

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (input.workflowMode !== 'roto') stop();
  }, [input.workflowMode, stop]);

  return {
    isActive,
    frame,
    status,
    setStatus,
    loop,
    fps,
    setLoop,
    getSettings,
    replaceSettings,
    start,
    stop,
    toggle,
    updateFps,
    resetForLaunch,
  };
}
