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
  positionedAt: vi.fn(),
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
    positionedAt: audioMocks.positionedAt,
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

// The navigation coordinator's key utilities are irrelevant to the solo
// playback seam tests — stub the hook so the coordinator renders with a
// minimal harness.
vi.mock('./useRotoKeyUtilities', () => ({
  useRotoKeyUtilities: () => ({
    session: { actionAvailability: { value: {} } },
    keyActionInFlight: false,
    resetSession: vi.fn(),
    executeSessionEffects: vi.fn(),
    runSessionResult: vi.fn(),
    duplicateKey: vi.fn(),
    copyKey: vi.fn(),
    cutKey: vi.fn(),
    pasteKey: vi.fn(),
    addKey: vi.fn(),
  }),
}));

import { clampRotoPlaybackFps, useRotoCachedPlayback, type UseRotoCachedPlaybackInput } from './useRotoCachedPlayback';
import { useRotoNavigationCoordinator } from './useRotoNavigationCoordinator';
import { findCachedRotoDisplayFrame } from './useRotoReferenceController';
import type { SoloPlaybackWindow } from '../roto/physicsPaintRotoSoloWindow';
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

  // D-02 seek wiring (260902-cfa): seek-while-playing is a full audio
  // seek-restart at the new cursor (playAtCursor = stopAll + re-dispatch,
  // truth table section 5); seek-while-idle / out-of-range / after-stop is a
  // silent re-anchor (positionedAt, D-09) with zero engine dispatch.
  describe('seek (D-02 seek-restart / D-09 silent re-anchor)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      installWindowTimers();
      audioMocks.prepare.mockReset().mockResolvedValue(undefined);
      audioMocks.playAtCursor.mockReset();
      audioMocks.stop.mockReset();
      audioMocks.positionedAt.mockReset();
      audioMocks.noteFpsMismatchOnce.mockReset().mockReturnValue(null);
      audioMocks.notifyLoopWrap.mockReset();
      audioMocks.checkDrift.mockReset();
      audioMocks.claimAudio.mockReset();
      audioMocks.ownershipConfigure.mockReset();
      audioMocks.getSection.mockReset().mockReturnValue(null);
    });

    const seekFrames = [
      { appFrame: 8, frame: { id: 'first' } },
      { appFrame: 9, frame: { id: 'second' } },
      { appFrame: 10, frame: { id: 'third' } },
    ];

    function createSeekHarness() {
      const onFrame = vi.fn();
      const harness = createHarness({
        initialSettings: { loop: false, fps: 2 },
        workflowMode: 'roto',
        getFrames: () => seekFrames,
        onStart: vi.fn(),
        onFrame,
        setIsPlaying: vi.fn(),
      });
      return { harness, onFrame };
    }

    it('seek while active re-anchors at the target and dispatches playAtCursor exactly once', () => {
      const { harness, onFrame } = createSeekHarness();
      let playback = harness.render();
      playback.start();
      playback = harness.render();
      expect(playback.isActive).toBe(true);
      expect(onFrame).toHaveBeenLastCalledWith(0, 8);

      // Advance one tick: now showing frame 9 (index 1).
      vi.advanceTimersByTime(500);
      expect(onFrame).toHaveBeenLastCalledWith(1, 9);

      // Seek to frame 9 while playing: re-anchor + full audio seek-restart.
      playback.seek(9);
      expect(audioMocks.playAtCursor).toHaveBeenCalledTimes(1);
      expect(audioMocks.playAtCursor).toHaveBeenCalledWith(9, 11);
      expect(playback.frame).toEqual({ id: 'second' });

      // The next timer tick shows the frame AFTER the target (frame 10).
      vi.advanceTimersByTime(500);
      expect(onFrame).toHaveBeenLastCalledWith(2, 10);
      vi.useRealTimers();
    });

    it('seek while idle dispatches positionedAt with zero engine calls', () => {
      const { harness } = createSeekHarness();
      const playback = harness.render();
      expect(playback.isActive).toBe(false);

      playback.seek(9);
      expect(audioMocks.positionedAt).toHaveBeenCalledWith(9);
      expect(audioMocks.playAtCursor).not.toHaveBeenCalled();
      expect(audioMocks.prepare).not.toHaveBeenCalled();
    });

    it('seek to an out-of-range appFrame is a silent re-anchor — positionedAt only, no frame-index change', () => {
      const { harness, onFrame } = createSeekHarness();
      let playback = harness.render();
      playback.start();
      playback = harness.render();
      expect(playback.isActive).toBe(true);
      expect(onFrame).toHaveBeenLastCalledWith(0, 8);

      playback.seek(99); // not in getFrames()
      expect(audioMocks.positionedAt).toHaveBeenCalledWith(99);
      expect(audioMocks.playAtCursor).not.toHaveBeenCalled();
      // No frame-index change: the next tick still shows frame 9 (index 1).
      vi.advanceTimersByTime(500);
      expect(onFrame).toHaveBeenLastCalledWith(1, 9);
      vi.useRealTimers();
    });

    it('seek after stop() is a silent re-anchor — positionedAt only', () => {
      const { harness } = createSeekHarness();
      let playback = harness.render();
      playback.start();
      playback = harness.render();
      playback.stop();
      playback = harness.render();
      expect(playback.isActive).toBe(false);

      playback.seek(9);
      expect(audioMocks.positionedAt).toHaveBeenCalledWith(9);
      expect(audioMocks.playAtCursor).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});

// D-01 (260902-cfa amendment): Play must honor the cursor. start() resolves
// the current application-frame cursor at press time, finds its index in
// cachedFrames, and begins visual playback there, dispatching
// playAtCursor(cursorAppFrame, rangeEnd). An out-of-range cursor (or no
// matching frame) falls back to the range start; loop wrap still returns to
// the range start.
describe('start honors the current application-frame cursor (D-01)', () => {
  function audioSection(): EfxPaintAudioPreviewContext {
    return {
      revision: 1,
      fps: 24,
      tracks: [
        {
          id: 'track-1',
          assetUrl: 'efxasset://localhost/tmp/d01-fixture.wav',
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

  function installWindowTimers() {
    vi.stubGlobal('window', {
      clearInterval,
      setInterval,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    installWindowTimers();
    audioMocks.prepare.mockReset().mockResolvedValue(undefined);
    audioMocks.playAtCursor.mockReset();
    audioMocks.stop.mockReset();
    audioMocks.positionedAt.mockReset();
    audioMocks.noteFpsMismatchOnce.mockReset().mockReturnValue(null);
    audioMocks.notifyLoopWrap.mockReset();
    audioMocks.checkDrift.mockReset();
    audioMocks.claimAudio.mockReset();
    audioMocks.ownershipConfigure.mockReset();
    audioMocks.getSection.mockReset().mockReturnValue(null);
  });

  const d01Frames = [
    { appFrame: 8, frame: { id: 'first' } },
    { appFrame: 9, frame: { id: 'second' } },
    { appFrame: 10, frame: { id: 'third' } },
  ];

  function createD01Harness(getCurrentAppFrame: () => number) {
    const onFrame = vi.fn();
    const harness = createHarness({
      initialSettings: { loop: false, fps: 2 },
      workflowMode: 'roto',
      getFrames: () => d01Frames,
      getCurrentAppFrame,
      onStart: vi.fn(),
      onFrame,
      setIsPlaying: vi.fn(),
    });
    return { harness, onFrame };
  }

  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('starts playback at the current application-frame cursor after an idle seek (D-01)', async () => {
    audioMocks.getSection.mockReturnValue(audioSection());
    const { harness, onFrame } = createD01Harness(() => 9);
    let playback = harness.render();
    // Idle seek to frame 9 re-anchors the audio anchor silently (D-09).
    playback.seek(9);
    expect(audioMocks.positionedAt).toHaveBeenCalledWith(9);
    playback = harness.render();
    // Play resumes at the cursor — visual playback begins at frame 9 and the
    // audio dispatches playAtCursor(9, rangeEnd), never the range start.
    playback.start();
    await flushMicrotasks();
    playback = harness.render();
    expect(playback.isActive).toBe(true);
    expect(playback.frame).toEqual({ id: 'second' });
    expect(onFrame).toHaveBeenLastCalledWith(1, 9);
    expect(audioMocks.playAtCursor).toHaveBeenCalledWith(9, 11);
    vi.useRealTimers();
  });

  it('falls back to the range start when the current cursor is out of range (D-01 clamp)', async () => {
    audioMocks.getSection.mockReturnValue(audioSection());
    const { harness, onFrame } = createD01Harness(() => 99);
    let playback = harness.render();
    playback.start();
    await flushMicrotasks();
    playback = harness.render();
    expect(playback.isActive).toBe(true);
    expect(playback.frame).toEqual({ id: 'first' });
    expect(onFrame).toHaveBeenLastCalledWith(0, 8);
    expect(audioMocks.playAtCursor).toHaveBeenCalledWith(8, 11);
    vi.useRealTimers();
  });

  it('loop wrap still returns to the range start, not the cursor (D-01)', () => {
    const { harness, onFrame } = createD01Harness(() => 9);
    let playback = harness.render();
    playback.setLoop(true);
    playback = harness.render();
    playback.start();
    playback = harness.render();
    expect(onFrame).toHaveBeenLastCalledWith(1, 9);
    // Walk to the end of the enumeration: index 2 (frame 10), then wrap to 0.
    vi.advanceTimersByTime(500);
    expect(onFrame).toHaveBeenLastCalledWith(2, 10);
    vi.advanceTimersByTime(500);
    expect(onFrame).toHaveBeenLastCalledWith(0, 8);
    vi.useRealTimers();
  });
});

/**
 * Solo playback filter seam (D-17/D-19, Pitfall 3). The ONLY place the solo
 * filter lives is the navigation coordinator's getFrames enumeration; the
 * stopped-canvas display lookup (findCachedRotoDisplayFrame) must stay
 * untouched (D-18). These tests drive the coordinator's getFrames through
 * useRotoCachedPlayback and assert the enumeration shapes.
 */
describe('solo playback filter seam (useRotoNavigationCoordinator getFrames)', () => {
  type Preview = { appFrame: number; id: string };

  interface CoordinatorPlaybackInput {
    getEndFrame: () => number | null;
    getFrame: (appFrame: number) => Preview | null;
    getSoloWindow?: () => SoloPlaybackWindow | null;
  }

  function createCoordinatorHarness(playback: CoordinatorPlaybackInput) {
    hookRuntime.reset();
    const onStart = vi.fn();
    const onFrame = vi.fn();
    const setIsPlaying = vi.fn();
    let current = playback;
    const render = () => {
      hookRuntime.cursor = 0;
      return useRotoNavigationCoordinator({
        workflowMode: 'roto',
        keyUtilities: {
          currentFrame: 0,
          currentKeyId: null,
          physicalKeyUtilities: {} as never,
          getSelectedKeyIds: () => [],
          getRotoKeyRecords: () => [],
          realKeyFrames: [],
          dirtyFrames: new Set(),
          canvasSize: { width: 1, height: 1 },
          applyStatus: 'idle',
          flushInFlight: false,
          buildBlankRotoFrame: () => ({}) as never,
          setDirtyFrames: () => {},
          syncPendingRotoFrames: () => {},
          showCachedReference: () => {},
          clearGeneratedFrame: () => {},
          clearDeletedFrame: () => {},
          setApplyMessage: () => {},
          setApplyStatus: () => {},
          setLastError: () => {},
        },
        playback: {
          initialSettings: { loop: true, fps: 2 },
          getEndFrame: () => current.getEndFrame(),
          getFrame: (appFrame) => current.getFrame(appFrame),
          ...(current.getSoloWindow !== undefined
            ? { getSoloWindow: () => current.getSoloWindow!() }
            : {}),
          onStart,
          onFrame,
          setIsPlaying,
        },
      });
    };
    return {
      render,
      update: (next: Partial<CoordinatorPlaybackInput>) => {
        current = { ...current, ...next };
        return render();
      },
      onStart,
      onFrame,
      setIsPlaying,
    };
  }

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

  it('disarmed enumeration is byte-identical to the pre-solo enumeration (same length, same frame references)', () => {
    vi.useFakeTimers();
    installWindowTimers();
    const harness = createCoordinatorHarness({
      getEndFrame: () => 10,
      getFrame: (appFrame) => ({ appFrame, id: `f${appFrame}` }),
    });

    const coordinator = harness.render();
    coordinator.playback.start();
    const next = harness.render();

    expect(next.playback.isActive).toBe(true);
    expect(harness.onStart).toHaveBeenCalledWith(10);
    expect(next.playback.frame).toEqual({ appFrame: 0, id: 'f0' });
    expect(harness.onFrame).toHaveBeenLastCalledWith(0, 0);

    // Walk the full enumeration: appFrames 0..9 in order, every frame present.
    for (let tick = 1; tick < 10; tick += 1) {
      vi.advanceTimersByTime(500);
      expect(harness.onFrame).toHaveBeenLastCalledWith(tick, tick);
    }
    vi.useRealTimers();
  });

  it('armed enumeration is restricted to the solo window with unattributed frames nulled', () => {
    vi.useFakeTimers();
    installWindowTimers();
    const harness = createCoordinatorHarness({
      getEndFrame: () => 50,
      getFrame: (appFrame) => ({ appFrame, id: `f${appFrame}` }),
      getSoloWindow: () => ({
        start: 12,
        endExclusive: 40,
        includesFrame: (appFrame) => appFrame % 2 === 0,
      }),
    });

    const coordinator = harness.render();
    coordinator.playback.start();
    const next = harness.render();

    expect(next.playback.isActive).toBe(true);
    expect(harness.onStart).toHaveBeenCalledWith(28); // 40 - 12
    // First tick: appFrame 12, attributed (even) -> frame present.
    expect(next.playback.frame).toEqual({ appFrame: 12, id: 'f12' });
    expect(harness.onFrame).toHaveBeenLastCalledWith(0, 12);

    vi.advanceTimersByTime(500);
    expect(harness.onFrame).toHaveBeenLastCalledWith(1, 13);
    // Unattributed in-range frame (odd) -> frame null (transparent).
    expect(next.playback.frame).toBeNull();

    vi.advanceTimersByTime(500);
    expect(harness.onFrame).toHaveBeenLastCalledWith(2, 14);
    expect(next.playback.frame).toEqual({ appFrame: 14, id: 'f14' });

    // The enumeration never leaves the window: after 28 ticks it wraps to 12.
    vi.advanceTimersByTime(500 * 26);
    expect(harness.onFrame).toHaveBeenLastCalledWith(0, 12);
    vi.useRealTimers();
  });

  it('armed with an empty window intersection yields an empty list (no start)', () => {
    vi.useFakeTimers();
    installWindowTimers();
    const harness = createCoordinatorHarness({
      getEndFrame: () => 10,
      getFrame: (appFrame) => ({ appFrame, id: `f${appFrame}` }),
      getSoloWindow: () => ({
        start: 12,
        endExclusive: 40,
        includesFrame: () => true,
      }),
    });

    const coordinator = harness.render();
    coordinator.playback.start();
    const next = harness.render();

    expect(next.playback.isActive).toBe(false);
    expect(next.playback.status).toBe('No cached Roto frames yet. Missing frames play transparent/background.');
    expect(harness.onStart).not.toHaveBeenCalled();
    expect(harness.setIsPlaying).not.toHaveBeenCalled();
  });

  it('Pitfall 3 regression: armed solo does not alter the stopped-canvas display lookup (D-18)', () => {
    // The stopped canvas renders everything at any cursor position:
    // findCachedRotoDisplayFrame has no solo input and returns the physical
    // frame for frames inside AND outside the solo window.
    const soloWindow: SoloPlaybackWindow = {
      start: 12,
      endExclusive: 40,
      includesFrame: (appFrame) => appFrame >= 12 && appFrame < 40,
    };
    const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;
    const physical = (appFrame: number) => ({
      kind: 'real' as const,
      layerId: 'layer-1',
      appFrame,
      keyId: `k${appFrame}`,
      contentRevision: 'rev-1',
      cacheRevision: `rev-1:real:k${appFrame}`,
      renderedFrame: { frameIndex: appFrame, appFrame, dataUrl: pngDataUrl(`k${appFrame}`) },
    });
    const display = (appFrame: number) => findCachedRotoDisplayFrame(appFrame, {
      getPhysicalRenderSource: (frame) => physical(frame),
    });

    // Inside the solo window: still rendered on the stopped canvas.
    expect(display(20)).toMatchObject({ appFrame: 20, keyId: 'k20' });
    // Outside the solo window: still rendered on the stopped canvas.
    expect(display(5)).toMatchObject({ appFrame: 5, keyId: 'k5' });
    expect(display(50)).toMatchObject({ appFrame: 50, keyId: 'k50' });
    expect(soloWindow.includesFrame(20)).toBe(true);
    expect(soloWindow.includesFrame(5)).toBe(false);
  });
});
