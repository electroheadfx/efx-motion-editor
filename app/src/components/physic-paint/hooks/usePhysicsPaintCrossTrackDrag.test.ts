import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookRuntime = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  signals: [] as Array<{ value: unknown; peek: () => unknown }>,
  cursor: 0,
  reset() {
    this.refs = [];
    this.signals = [];
    this.cursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useRef: <Value>(initial: Value) => {
    const index = hookRuntime.cursor++;
    hookRuntime.refs[index] ??= { current: initial };
    return hookRuntime.refs[index] as { current: Value };
  },
}));

vi.mock('@preact/signals', () => ({
  useSignal: <Value>(initial: Value) => {
    const index = hookRuntime.cursor++;
    hookRuntime.signals[index] ??= {
      value: initial,
      peek() { return this.value; },
    };
    return hookRuntime.signals[index] as { value: Value; peek: () => Value };
  },
}));

import {
  computeCrossTrackDestination,
  computeInsertionFrame,
  usePhysicsPaintCrossTrackDrag,
  type CrossTrackDragCaptureElement,
  type CrossTrackDragSource,
  type CrossTrackDragWindowLike,
} from './usePhysicsPaintCrossTrackDrag';

type Listener = (event: any) => void;

class WindowDouble implements CrossTrackDragWindowLike {
  readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class CaptureDouble implements CrossTrackDragCaptureElement {
  readonly captured: number[] = [];
  readonly released: number[] = [];

  setPointerCapture(pointerId: number) {
    if (!this.captured.includes(pointerId)) this.captured.push(pointerId);
  }

  hasPointerCapture(pointerId: number) {
    return this.captured.includes(pointerId) && !this.released.includes(pointerId);
  }

  releasePointerCapture(pointerId: number) {
    if (!this.released.includes(pointerId)) this.released.push(pointerId);
  }
}

/** A document double the hook must never touch (D-16 read-only gesture). */
class DocumentDouble {
  readonly sourceKeys: string[] = ['key-1'];
  readonly destinationKeys: string[] = [];

  snapshot() {
    return JSON.stringify({ sourceKeys: this.sourceKeys, destinationKeys: this.destinationKeys });
  }
}

function pointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return {
    pointerId: 7,
    clientX: 300,
    clientY: 15,
    isPrimary: true,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as PointerEvent;
}

function createHarness(options: {
  readonly resolveSource?: (event: PointerEvent) => CrossTrackDragSource | null;
} = {}) {
  hookRuntime.reset();
  const windowLike = new WindowDouble();
  const capture = new CaptureDouble();
  const document = new DocumentDouble();
  const commit = vi.fn();
  const resolveSource = vi.fn(
    options.resolveSource ?? (() => ({ fromTrackId: 'track-a', keyIds: ['key-1'] } as const)),
  );
  const render = () => {
    hookRuntime.cursor = 0;
    return usePhysicsPaintCrossTrackDrag({
      windowLike,
      getRowBounds: () => [
        { trackId: 'track-a', top: 0, bottom: 30 },
        { trackId: 'track-b', top: 30, bottom: 60 },
        { trackId: 'track-c', top: 60, bottom: 90 },
      ],
      getCaptureElement: () => capture,
      getContentLeft: () => 270,
      getScrollLeft: () => 0,
      framePitch: 18,
      resolveSource,
      onCommit: commit,
    });
  };
  return {
    windowLike,
    capture,
    document,
    commit,
    resolveSource,
    render,
  };
}

describe('computeCrossTrackDestination (47-05 Task 1, TML-05/D-16)', () => {
  const ROW_BOUNDS = Object.freeze([
    { trackId: 'track-a', top: 0, bottom: 30 },
    { trackId: 'track-b', top: 30, bottom: 60 },
    { trackId: 'track-c', top: 60, bottom: 90 },
  ]);

  it('resolves the row below the source to that row trackId', () => {
    expect(computeCrossTrackDestination(ROW_BOUNDS, 45, 'track-a')).toBe('track-b');
    expect(computeCrossTrackDestination(ROW_BOUNDS, 75, 'track-b')).toBe('track-c');
  });

  it('resolves the source row to the source trackId (no crossing)', () => {
    expect(computeCrossTrackDestination(ROW_BOUNDS, 15, 'track-a')).toBe('track-a');
    expect(computeCrossTrackDestination(ROW_BOUNDS, 45, 'track-b')).toBe('track-b');
  });

  it('resolves null outside every row', () => {
    expect(computeCrossTrackDestination(ROW_BOUNDS, 200, 'track-a')).toBeNull();
    expect(computeCrossTrackDestination([], 15, 'track-a')).toBeNull();
  });
});

describe('computeInsertionFrame (47-05 Task 1, TML-05/D-16)', () => {
  it('resolves the frame from the pointer X against the 18px pitch', () => {
    expect(computeInsertionFrame(0, 0, 1, 18)).toBe(0);
    expect(computeInsertionFrame(17, 0, 1, 18)).toBe(0);
    expect(computeInsertionFrame(18, 0, 1, 18)).toBe(1);
    expect(computeInsertionFrame(36, 0, 1, 18)).toBe(2);
  });

  it('accounts for the horizontal scrollLeft', () => {
    expect(computeInsertionFrame(0, 36, 1, 18)).toBe(2);
    expect(computeInsertionFrame(9, 9, 1, 18)).toBe(1);
  });

  it('never resolves below zero', () => {
    expect(computeInsertionFrame(-40, 0, 1, 18)).toBe(0);
  });
});

describe('usePhysicsPaintCrossTrackDrag (47-05 Task 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures the destination row and live insertion frame when the pointer crosses, without mutating the document (D-16)', () => {
    const harness = createHarness();
    const api = harness.render();
    const snapshotBefore = harness.document.snapshot();

    api.onPointerDown(pointerEvent({ clientX: 282, clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientX: 306, clientY: 45 }));
    expect(api.destinationTrackId.value).toBe('track-b');
    expect(api.isCrossing.value).toBe(true);
    // 306 - contentLeft 270 = 36px content-X → frame 2 at the 18px pitch.
    expect(api.insertionFrame.value).toBe(2);

    // The takeover captures on the rows-region (the same-row drag's source
    // element loses capture and cancels non-committing).
    expect(harness.capture.captured).toEqual([7]);

    // The gesture never mutated the document — byte-unchanged until release.
    expect(harness.document.snapshot()).toBe(snapshotBefore);
    expect(harness.commit).not.toHaveBeenCalled();
  });

  it('clears the crossing signals when the pointer returns to the source row', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientX: 306, clientY: 45 }));
    expect(api.isCrossing.value).toBe(true);

    harness.windowLike.emit('pointermove', pointerEvent({ clientX: 306, clientY: 15 }));
    expect(api.destinationTrackId.value).toBeNull();
    expect(api.isCrossing.value).toBe(false);
    expect(api.insertionFrame.value).toBeNull();
    // The takeover capture stays (a re-cross re-arms the signals instantly).
    expect(harness.capture.captured).toEqual([7]);
  });

  it('keeps a same-row drag plain: no preview, no commit, no capture when the pointer never crosses (D-16)', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientX: 400, clientY: 20 }));
    harness.windowLike.emit('pointerup', pointerEvent({ clientX: 400, clientY: 20 }));

    expect(api.destinationTrackId.value).toBeNull();
    expect(api.isCrossing.value).toBe(false);
    expect(api.insertionFrame.value).toBeNull();
    expect(harness.capture.captured).toEqual([]);
    expect(harness.commit).not.toHaveBeenCalled();
    // The same-row release path owns the release — the hook cleaned up.
    const liveListenerCount = [...harness.windowLike.listeners.values()]
      .reduce((total, listeners) => total + listeners.size, 0);
    expect(liveListenerCount).toBe(0);
  });

  it('clears the crossing signals on release and cancels on Escape without committing', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientY: 45 }));
    expect(api.isCrossing.value).toBe(true);

    harness.windowLike.emit('pointerup', pointerEvent({ clientY: 45 }));
    expect(api.destinationTrackId.value).toBeNull();
    expect(api.isCrossing.value).toBe(false);
    expect(api.insertionFrame.value).toBeNull();
    expect(harness.commit).toHaveBeenCalledTimes(1);

    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientY: 45 }));
    harness.windowLike.emit('keydown', {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    });
    expect(harness.commit).toHaveBeenCalledTimes(1);
    expect(api.isCrossing.value).toBe(false);
    expect(api.destinationTrackId.value).toBeNull();
  });

  it('never starts a session from a press that resolves to no draggable source', () => {
    const harness = createHarness({ resolveSource: () => null });
    const api = harness.render();
    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientY: 45 }));
    expect(api.isCrossing.value).toBe(false);
    expect(harness.capture.captured).toEqual([]);
    expect(harness.commit).not.toHaveBeenCalled();
  });
});
