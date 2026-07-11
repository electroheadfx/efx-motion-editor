import { afterEach, describe, expect, it, vi } from 'vitest';

const hookRuntime = vi.hoisted(() => ({
  values: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  cursor: 0,
  reset() {
    this.values = [];
    this.refs = [];
    this.cursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useState: <Value>(initial: Value | (() => Value)) => {
    const index = hookRuntime.cursor++;
    if (!(index in hookRuntime.values)) hookRuntime.values[index] = typeof initial === 'function' ? (initial as () => Value)() : initial;
    return [hookRuntime.values[index] as Value, (value: Value | ((current: Value) => Value)) => {
      hookRuntime.values[index] = typeof value === 'function'
        ? (value as (current: Value) => Value)(hookRuntime.values[index] as Value)
        : value;
    }] as const;
  },
  useRef: <Value>(initial: Value) => {
    const index = hookRuntime.cursor++;
    hookRuntime.refs[index] ??= { current: initial };
    return hookRuntime.refs[index] as { current: Value };
  },
  useCallback: <Value>(callback: Value) => callback,
  useEffect: () => {},
}));

import { clampRotoPlaybackFps, useRotoCachedPlayback, type UseRotoCachedPlaybackInput } from './useRotoCachedPlayback';

type Frame = { id: string };

function createHarness(input: UseRotoCachedPlaybackInput<Frame>) {
  hookRuntime.reset();
  let current = input;
  const render = () => {
    hookRuntime.cursor = 0;
    return useRotoCachedPlayback(current);
  };
  return {
    render,
    update: (next: Partial<UseRotoCachedPlaybackInput<Frame>>) => {
      current = { ...current, ...next };
      return render();
    },
  };
}

describe('useRotoCachedPlayback', () => {
  function installWindowTimers() {
    vi.stubGlobal('window', {
      clearInterval,
      setInterval,
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('clamps playback FPS to the supported range', () => {
    expect(clampRotoPlaybackFps(Number.NaN)).toBe(1);
    expect(clampRotoPlaybackFps(0)).toBe(1);
    expect(clampRotoPlaybackFps(12.5)).toBe(12.5);
    expect(clampRotoPlaybackFps(99)).toBe(60);
  });

  it('reports the unchanged missing-cache status without starting playback', () => {
    const onStart = vi.fn();
    const setIsPlaying = vi.fn();
    const harness = createHarness({
      initialFps: 24,
      workflowMode: 'roto',
      getFrames: () => [],
      onStart,
      onFrame: vi.fn(),
      setIsPlaying,
    });

    harness.render().start();
    const playback = harness.render();

    expect(playback.isActive).toBe(false);
    expect(playback.status).toBe('No cached Roto frames yet. Missing frames play transparent/background.');
    expect(onStart).not.toHaveBeenCalled();
    expect(setIsPlaying).not.toHaveBeenCalled();
  });

  it('starts cached frames, loops them, and stops cleanly', () => {
    vi.useFakeTimers();
    installWindowTimers();
    const onStart = vi.fn();
    const onFrame = vi.fn();
    const setIsPlaying = vi.fn();
    const frames = [{ appFrame: 8, frame: { id: 'first' } }, { appFrame: 9, frame: null }];
    const harness = createHarness({
      initialFps: 2,
      workflowMode: 'roto',
      getFrames: () => frames,
      onStart,
      onFrame,
      setIsPlaying,
    });

    let playback = harness.render();
    playback.setLoop(true);
    playback = harness.render();
    playback.start();
    playback = harness.render();

    expect(playback.isActive).toBe(true);
    expect(playback.frame).toEqual({ id: 'first' });
    expect(playback.status).toBe('Playing cached Roto frames at 2 fps. 1 missing frame(s). Missing frames play transparent/background.');
    expect(onStart).toHaveBeenCalledWith(2);
    expect(onFrame).toHaveBeenLastCalledWith(0, 8);

    vi.advanceTimersByTime(500);
    expect(onFrame).toHaveBeenLastCalledWith(1, 9);
    vi.advanceTimersByTime(500);
    expect(onFrame).toHaveBeenLastCalledWith(0, 8);

    playback.stop();
    playback = harness.render();
    expect(playback.isActive).toBe(false);
    expect(playback.frame).toBeNull();
    expect(setIsPlaying).toHaveBeenLastCalledWith(false);
    vi.useRealTimers();
  });

  it('clears the final transient frame before revealing editable state and ignores stale ticks after Stop', () => {
    vi.useFakeTimers();
    installWindowTimers();
    const transitions: string[] = [];
    const setIsPlaying = vi.fn((playing: boolean) => transitions.push(`playing:${playing}`));
    const harness = createHarness({
      initialFps: 2,
      workflowMode: 'roto',
      getFrames: () => [{ appFrame: 8, frame: { id: 'first' } }, { appFrame: 9, frame: { id: 'last' } }],
      onStart: vi.fn(),
      onFrame: vi.fn(),
      setIsPlaying,
    });

    let playback = harness.render();
    playback.start();
    playback = harness.render();
    expect(playback.frame).toEqual({ id: 'first' });

    vi.advanceTimersByTime(500);
    playback = harness.render();
    expect(playback.isActive).toBe(false);
    expect(playback.frame).toBeNull();
    expect(transitions[transitions.length - 1]).toBe('playing:false');

    vi.advanceTimersByTime(2_000);
    playback = harness.render();
    expect(playback.frame).toBeNull();
    expect(playback.isActive).toBe(false);
    expect(setIsPlaying).toHaveBeenCalledTimes(2);
  });

  it('restarts active playback at a clamped FPS and resets for a new launch', () => {
    vi.useFakeTimers();
    installWindowTimers();
    const onFrame = vi.fn();
    const setIsPlaying = vi.fn();
    const harness = createHarness({
      initialFps: 24,
      workflowMode: 'roto',
      getFrames: () => [{ appFrame: 5, frame: { id: 'key' } }, { appFrame: 6, frame: { id: 'next' } }],
      onStart: vi.fn(),
      onFrame,
      setIsPlaying,
    });

    let playback = harness.render();
    playback.start();
    playback = harness.render();
    playback.updateFps(100);
    playback = harness.render();

    expect(playback.fps).toBe(60);
    expect(playback.status).toBe('Playing 2 cached Roto frame(s) at 60 fps. Missing frames play transparent/background.');
    vi.advanceTimersByTime(17);
    expect(onFrame).toHaveBeenLastCalledWith(1, 6);

    playback.resetForLaunch();
    playback = harness.render();
    expect(playback.isActive).toBe(false);
    expect(playback.frame).toBeNull();
    expect(setIsPlaying).toHaveBeenLastCalledWith(false);
    vi.useRealTimers();
  });
});
