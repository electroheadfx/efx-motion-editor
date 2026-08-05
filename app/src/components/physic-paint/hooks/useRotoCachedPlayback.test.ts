import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

// CR-01 audio mocks: the monitor/ownership modules are fully mocked so the
// deferred prepare→playAtCursor chain can be driven with manually resolved
// promises. playAtCursor mimics the real funnel by claiming ownership, so
// "no ownership claim" assertions stay meaningful.
const audioMocks = vi.hoisted(() => ({
  prepare: vi.fn<(...args: unknown[]) => Promise<void>>(),
  playAtCursor: vi.fn(),
  stop: vi.fn(),
  noteFpsMismatchOnce: vi.fn(() => null as string | null),
  notifyLoopWrap: vi.fn(),
  checkDrift: vi.fn(),
  claimAudio: vi.fn(),
  ownershipConfigure: vi.fn(),
  getSection: vi.fn(() => null as unknown),
}));

vi.mock('../audio/efxPaintAudioMonitor', () => ({
  efxPaintAudioMonitor: {
    prepare: audioMocks.prepare,
    playAtCursor: audioMocks.playAtCursor,
    stop: audioMocks.stop,
    noteFpsMismatchOnce: audioMocks.noteFpsMismatchOnce,
    notifyLoopWrap: audioMocks.notifyLoopWrap,
    checkDrift: audioMocks.checkDrift,
  },
}));

vi.mock('../audio/efxPaintAudioPreviewStore', () => ({
  efxPaintAudioPreviewStore: { getSection: audioMocks.getSection },
}));

vi.mock('../audio/efxPaintAudioOwnership', () => ({
  efxPaintAudioOwnership: {
    configure: audioMocks.ownershipConfigure,
    claimAudio: audioMocks.claimAudio,
  },
}));

import { clampRotoPlaybackFps, useRotoCachedPlayback, type UseRotoCachedPlaybackInput } from './useRotoCachedPlayback';
import type { EfxPaintAudioPreviewContext } from '../../../types/physicPaint';

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
      initialSettings: { loop: false, fps: 24 },
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
      initialSettings: { loop: false, fps: 2 },
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
      initialSettings: { loop: false, fps: 2 },
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
    expect(playback.isActive).toBe(true);
    expect(playback.frame).toEqual({ id: 'last' });

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

  it('stops a previously running playback when start() re-enters with an empty frame list', () => {
    vi.useFakeTimers();
    installWindowTimers();
    const onFrame = vi.fn();
    const setIsPlaying = vi.fn();
    let frames: Array<{ appFrame: number; frame: Frame | null }> = [
      { appFrame: 5, frame: { id: 'key' } },
      { appFrame: 6, frame: { id: 'next' } },
    ];
    const harness = createHarness({
      initialSettings: { loop: true, fps: 24 },
      workflowMode: 'roto',
      getFrames: () => frames,
      onStart: vi.fn(),
      onFrame,
      setIsPlaying,
    });

    let playback = harness.render();
    playback.start();
    playback = harness.render();
    expect(playback.isActive).toBe(true);

    // Frames cleared mid-playback; a re-entrant start() (e.g. via updateFps)
    // must stop the stale interval instead of leaving it ticking with the
    // old frame list while the status line reports playback impossible.
    frames = [];
    playback.start();
    playback = harness.render();

    expect(playback.isActive).toBe(false);
    expect(playback.status).toBe('No cached Roto frames yet. Missing frames play transparent/background.');
    expect(setIsPlaying).toHaveBeenLastCalledWith(false);
    const frameCallsBefore = onFrame.mock.calls.length;
    vi.advanceTimersByTime(500);
    expect(onFrame.mock.calls.length).toBe(frameCallsBefore);
    vi.useRealTimers();
  });

  it('restarts active playback at a clamped FPS and resets for a new launch', () => {
    vi.useFakeTimers();
    installWindowTimers();
    const onFrame = vi.fn();
    const setIsPlaying = vi.fn();
    const harness = createHarness({
      initialSettings: { loop: false, fps: 24 },
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

    playback.resetForLaunch({ loop: false, fps: 24 });
    playback = harness.render();
    expect(playback.isActive).toBe(false);
    expect(playback.frame).toBeNull();
    expect(setIsPlaying).toHaveBeenLastCalledWith(false);
    vi.useRealTimers();
  });

  // CR-01: the deferred prepare→playAtCursor chain must be gated on the
  // playback session that requested it — a stop (or a newer start) while
  // prepare is in flight must make the stale completion a silent no-op.
  describe('CR-01 audio session guard', () => {
    function audioSection(): EfxPaintAudioPreviewContext {
      return {
        revision: 1,
        fps: 24,
        tracks: [
          {
            id: 'track-1',
            assetUrl: 'efxasset://localhost/tmp/cr01-fixture.wav',
            offsetFrame: 0,
            inFrame: 0,
            outFrame: 48,
            slipOffset: 0,
            fadeInFrames: 0,
            fadeOutFrames: 0,
            volume: 1,
            muted: false,
            fadeInCurve: 'linear',
            fadeOutCurve: 'linear',
          },
        ],
      };
    }

    function deferred<Value = void>() {
      let resolve!: (value: Value | PromiseLike<Value>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<Value>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    async function flushMicrotasks() {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    const cr01Frames = [
      { appFrame: 8, frame: { id: 'first' } },
      { appFrame: 9, frame: { id: 'last' } },
    ];

    function createAudioHarness() {
      return createHarness({
        initialSettings: { loop: false, fps: 24 },
        workflowMode: 'roto',
        getFrames: () => cr01Frames,
        onStart: vi.fn(),
        onFrame: vi.fn(),
        setIsPlaying: vi.fn(),
      });
    }

    beforeEach(() => {
      vi.useFakeTimers();
      installWindowTimers();
      audioMocks.prepare.mockReset().mockResolvedValue(undefined);
      audioMocks.playAtCursor.mockReset().mockImplementation(() => audioMocks.claimAudio());
      audioMocks.stop.mockReset();
      audioMocks.noteFpsMismatchOnce.mockReset().mockReturnValue(null);
      audioMocks.notifyLoopWrap.mockReset();
      audioMocks.checkDrift.mockReset();
      audioMocks.claimAudio.mockReset();
      audioMocks.ownershipConfigure.mockReset();
      audioMocks.getSection.mockReset().mockReturnValue(null);
    });

    it('never dispatches playAtCursor or claims ownership when stop happens during prepare', async () => {
      audioMocks.getSection.mockReturnValue(audioSection());
      const gate = deferred<void>();
      audioMocks.prepare.mockReturnValue(gate.promise);
      const harness = createAudioHarness();
      const playback = harness.render();

      playback.start();
      expect(audioMocks.prepare).toHaveBeenCalledTimes(1);

      playback.stop();
      gate.resolve();
      await gate.promise;
      await flushMicrotasks();

      expect(audioMocks.playAtCursor).not.toHaveBeenCalled();
      expect(audioMocks.claimAudio).not.toHaveBeenCalled();
    });

    it('rejects the stale prepare completion after start→stop→start; only the newest session plays', async () => {
      audioMocks.getSection.mockReturnValue(audioSection());
      const staleGate = deferred<void>();
      audioMocks.prepare.mockReturnValueOnce(staleGate.promise).mockResolvedValue(undefined);
      const harness = createAudioHarness();
      let playback = harness.render();

      playback.start();
      playback.stop();
      playback = harness.render();
      playback.start();
      await flushMicrotasks();

      expect(audioMocks.playAtCursor).toHaveBeenCalledTimes(1);
      expect(audioMocks.playAtCursor).toHaveBeenCalledWith(8, 10);

      staleGate.resolve();
      await staleGate.promise;
      await flushMicrotasks();

      expect(audioMocks.playAtCursor).toHaveBeenCalledTimes(1);
    });

    it('plays at the cursor once prepare resolves while still playing, and stops through the funnel', async () => {
      audioMocks.getSection.mockReturnValue(audioSection());
      const harness = createAudioHarness();
      const playback = harness.render();

      playback.start();
      await flushMicrotasks();

      expect(audioMocks.playAtCursor).toHaveBeenCalledTimes(1);
      expect(audioMocks.playAtCursor).toHaveBeenCalledWith(8, 10);

      playback.stop();
      expect(audioMocks.stop).toHaveBeenCalled();
    });

    it('skips audio preparation entirely when no audio section is present', () => {
      const harness = createAudioHarness();
      const playback = harness.render();

      playback.start();

      expect(audioMocks.prepare).not.toHaveBeenCalled();
      expect(audioMocks.playAtCursor).not.toHaveBeenCalled();
    });
  });
});
