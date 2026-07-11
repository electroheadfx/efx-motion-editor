import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';

const MIN_ROTO_PLAYBACK_FPS = 1;
const MAX_ROTO_PLAYBACK_FPS = 60;

export interface RotoCachedPlaybackFrame<Frame> {
  appFrame: number;
  frame: Frame | null;
}

export interface UseRotoCachedPlaybackInput<Frame> {
  initialFps: number;
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
  start: (fps?: number) => void;
  stop: () => void;
  toggle: () => void;
  updateFps: (fps: number) => void;
  resetForLaunch: () => void;
}

export function clampRotoPlaybackFps(value: number): number {
  if (!Number.isFinite(value)) return MIN_ROTO_PLAYBACK_FPS;
  return Math.max(MIN_ROTO_PLAYBACK_FPS, Math.min(MAX_ROTO_PLAYBACK_FPS, value));
}

export function useRotoCachedPlayback<Frame>(input: UseRotoCachedPlaybackInput<Frame>): RotoCachedPlayback<Frame> {
  const [isActive, setIsActive] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [fps, setFps] = useState(() => input.initialFps);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setIsActive(false);
    setFrame(null);
    inputRef.current.setIsPlaying(false);
  }, [clearTimer]);

  const resetForLaunch = useCallback(() => {
    clearTimer();
    setFrame(null);
    setIsActive(false);
    inputRef.current.setIsPlaying(false);
  }, [clearTimer]);

  const start = useCallback((requestedFps = fps) => {
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
      const cachedFrame = cachedFrames[frameIndex];
      setFrame(cachedFrame.frame ?? null);
      inputRef.current.onFrame(frameIndex, cachedFrame.appFrame);
      frameIndex += 1;
      if (frameIndex >= cachedFrames.length) {
        if (loop) {
          frameIndex = 0;
          return;
        }
        clearTimer();
        setIsActive(false);
        inputRef.current.setIsPlaying(false);
      }
    };
    showNextFrame();
    if (cachedFrames.length > 1) timerRef.current = window.setInterval(showNextFrame, 1000 / playbackFps);
  }, [clearTimer, fps, loop]);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
      setStatus('Cached Roto playback stopped.');
      return;
    }
    start();
  }, [isActive, start, stop]);

  const updateFps = useCallback((nextValue: number) => {
    const nextFps = clampRotoPlaybackFps(nextValue);
    setFps(nextFps);
    if (isActive) start(nextFps);
  }, [isActive, start]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (input.workflowMode !== 'roto') stop();
  }, [input.workflowMode, stop]);

  return { isActive, frame, status, setStatus, loop, fps, setLoop, start, stop, toggle, updateFps, resetForLaunch };
}
