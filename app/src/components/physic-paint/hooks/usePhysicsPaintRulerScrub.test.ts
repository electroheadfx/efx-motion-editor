import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookRuntime = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  cursor: 0,
  reset() {
    this.refs = [];
    this.cursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useEffect: vi.fn(),
  useRef: <Value>(initial: Value) => {
    const index = hookRuntime.cursor++;
    hookRuntime.refs[index] ??= { current: initial };
    return hookRuntime.refs[index] as { current: Value };
  },
}));

import {
  RULER_SCRUB_THRESHOLD_PX,
  usePhysicsPaintRulerScrub,
  type RulerScrubRulerElement,
  type RulerScrubWindowLike,
} from './usePhysicsPaintRulerScrub';

type Listener = (event: any) => void;

class WindowDouble implements RulerScrubWindowLike {
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

  listenerCount() {
    let total = 0;
    for (const listeners of this.listeners.values()) total += listeners.size;
    return total;
  }
}

class RulerDouble implements RulerScrubRulerElement {
  readonly captured: number[] = [];
  readonly released: number[] = [];
  constructor(readonly rectLeft: number) {}

  getBoundingClientRect() {
    return { left: this.rectLeft };
  }

  setPointerCapture(pointerId: number) {
    this.captured.push(pointerId);
  }

  hasPointerCapture(pointerId: number) {
    return this.captured.includes(pointerId) && !this.released.includes(pointerId);
  }

  releasePointerCapture(pointerId: number) {
    this.released.push(pointerId);
  }
}

function pointerEvent(ruler: RulerDouble, overrides: Partial<PointerEvent> = {}): PointerEvent {
  return {
    pointerId: 7,
    clientX: 100,
    clientY: 12,
    isPrimary: true,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    currentTarget: ruler,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as PointerEvent;
}

function createHarness(options: {
  readonly frameCount?: number;
  readonly rectLeft?: number;
  readonly cellWidthPx?: number;
} = {}) {
  hookRuntime.reset();
  const windowLike = new WindowDouble();
  const ruler = new RulerDouble(options.rectLeft ?? 40);
  const onSeek = vi.fn();
  const frameCount = options.frameCount ?? 10;
  const render = () => {
    hookRuntime.cursor = 0;
    return usePhysicsPaintRulerScrub({
      frameCount: () => frameCount,
      onSeek,
      cellWidthPx: options.cellWidthPx,
      windowLike,
    });
  };
  return { windowLike, ruler, onSeek, render, frameCount };
}

/** rAF test rig: queued callbacks fire only when the test flushes them. */
function stubAnimationFrame() {
  let nextId = 1;
  const queue = new Map<number, () => void>();
  const cancelled: number[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, () => callback(0));
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    cancelled.push(id);
    queue.delete(id);
  });
  return {
    queue,
    cancelled,
    flushAll() {
      const pending = [...queue.values()];
      queue.clear();
      for (const run of pending) run();
    },
  };
}

describe('usePhysicsPaintRulerScrub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('seeks synchronously on pointer-down with the floored cell frame and takes pointer capture', () => {
    const raf = stubAnimationFrame();
    const harness = createHarness();
    const api = harness.render();
    // rectLeft 40, 18px pitch → clientX 99 lands at floor(59/18) = frame 3.
    api.onPointerDown(pointerEvent(harness.ruler, { clientX: 99 }));

    expect(harness.onSeek).toHaveBeenCalledTimes(1);
    expect(harness.onSeek).toHaveBeenCalledWith(3);
    expect(harness.ruler.captured).toEqual([7]);
    expect(raf.queue.size).toBe(0);
  });

  it('clamps the down-seek frame into [0, frameCount-1]', () => {
    stubAnimationFrame();
    const harness = createHarness({ frameCount: 10 });
    const api = harness.render();

    api.onPointerDown(pointerEvent(harness.ruler, { clientX: harness.ruler.rectLeft - 25 }));
    expect(harness.onSeek).toHaveBeenLastCalledWith(0);
    harness.windowLike.emit('pointerup', pointerEvent(harness.ruler));

    api.onPointerDown(pointerEvent(harness.ruler, { clientX: harness.ruler.rectLeft + 18 * 40 }));
    expect(harness.onSeek).toHaveBeenLastCalledWith(9);
    expect(harness.onSeek).toHaveBeenCalledTimes(2);
  });

  it('derives the frame from the ruler element\'s own bounding rect left edge', () => {
    stubAnimationFrame();
    const harness = createHarness({ rectLeft: 140 });
    const api = harness.render();
    // 140 + 18*4 + 2 = 214 → frame 4.
    api.onPointerDown(pointerEvent(harness.ruler, { clientX: 214 }));
    expect(harness.onSeek).toHaveBeenCalledWith(4);
  });

  it('coalesces scrub moves past the 4px threshold to one seek per animation frame with the latest frame', () => {
    const raf = stubAnimationFrame();
    const harness = createHarness();
    const api = harness.render();
    const origin = harness.ruler.rectLeft;
    api.onPointerDown(pointerEvent(harness.ruler, { clientX: origin }));
    expect(harness.onSeek).toHaveBeenCalledTimes(1);
    expect(RULER_SCRUB_THRESHOLD_PX).toBe(4);

    // Two moves land before the next animation frame: only ONE rAF is pending.
    harness.windowLike.emit('pointermove', pointerEvent(harness.ruler, { clientX: origin + 18 * 2 }));
    harness.windowLike.emit('pointermove', pointerEvent(harness.ruler, { clientX: origin + 18 * 5 }));
    expect(raf.queue.size).toBe(1);
    expect(harness.onSeek).toHaveBeenCalledTimes(1);

    raf.flushAll();
    expect(harness.onSeek).toHaveBeenCalledTimes(2);
    expect(harness.onSeek).toHaveBeenLastCalledWith(5);

    // A further move schedules a fresh animation frame and emits the new frame.
    harness.windowLike.emit('pointermove', pointerEvent(harness.ruler, { clientX: origin + 18 * 7 }));
    raf.flushAll();
    expect(harness.onSeek).toHaveBeenCalledTimes(3);
    expect(harness.onSeek).toHaveBeenLastCalledWith(7);
  });

  it('re-emits nothing when the scrub lands back on the last emitted frame', () => {
    const raf = stubAnimationFrame();
    const harness = createHarness();
    const api = harness.render();
    const origin = harness.ruler.rectLeft;
    api.onPointerDown(pointerEvent(harness.ruler, { clientX: origin }));

    // Travel past the threshold but stay inside frame 0 (18px cell).
    harness.windowLike.emit('pointermove', pointerEvent(harness.ruler, { clientX: origin + 12 }));
    raf.flushAll();
    expect(harness.onSeek).toHaveBeenCalledTimes(1);
  });

  it('emits nothing beyond the down-seek for a sub-threshold wiggle (plain click is never swallowed)', () => {
    const raf = stubAnimationFrame();
    const harness = createHarness();
    const api = harness.render();
    const origin = harness.ruler.rectLeft + 54;
    api.onPointerDown(pointerEvent(harness.ruler, { clientX: origin }));
    expect(harness.onSeek).toHaveBeenCalledTimes(1);
    expect(harness.onSeek).toHaveBeenLastCalledWith(3);

    harness.windowLike.emit('pointermove', pointerEvent(harness.ruler, { clientX: origin + 3 }));
    harness.windowLike.emit('pointermove', pointerEvent(harness.ruler, { clientX: origin - 4 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.ruler, { clientX: origin }));

    expect(raf.queue.size).toBe(0);
    expect(harness.onSeek).toHaveBeenCalledTimes(1);
  });

  it('pointerup releases capture, cancels a pending rAF, and removes every window listener idempotently', () => {
    const raf = stubAnimationFrame();
    const harness = createHarness();
    const api = harness.render();
    const origin = harness.ruler.rectLeft;
    api.onPointerDown(pointerEvent(harness.ruler, { clientX: origin }));
    harness.windowLike.emit('pointermove', pointerEvent(harness.ruler, { clientX: origin + 18 * 4 }));
    expect(raf.queue.size).toBe(1);

    harness.windowLike.emit('pointerup', pointerEvent(harness.ruler, { clientX: origin + 18 * 4 }));
    expect(harness.ruler.released).toEqual([7]);
    expect(raf.cancelled.length).toBe(1);
    expect(harness.windowLike.listenerCount()).toBe(0);
    // The cancelled animation frame never seeks after release.
    raf.flushAll();
    expect(harness.onSeek).toHaveBeenCalledTimes(1);

    // A second up for the same pointer is a no-op (idempotent cleanup).
    harness.windowLike.emit('pointerup', pointerEvent(harness.ruler));
    expect(raf.cancelled.length).toBe(1);
  });

  it('pointercancel releases the session the same way pointerup does', () => {
    const raf = stubAnimationFrame();
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.ruler, { clientX: harness.ruler.rectLeft }));
    harness.windowLike.emit('pointercancel', pointerEvent(harness.ruler));
    expect(harness.ruler.released).toEqual([7]);
    expect(harness.windowLike.listenerCount()).toBe(0);
    expect(raf.queue.size).toBe(0);
  });

  it('ignores non-primary, modified, and non-left-button downs plus a second session while active', () => {
    stubAnimationFrame();
    const harness = createHarness();
    const api = harness.render();
    for (const overrides of [
      { isPrimary: false },
      { button: 1 },
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
    ]) {
      api.onPointerDown(pointerEvent(harness.ruler, overrides));
    }
    expect(harness.onSeek).not.toHaveBeenCalled();
    expect(harness.windowLike.listenerCount()).toBe(0);

    api.onPointerDown(pointerEvent(harness.ruler, { clientX: harness.ruler.rectLeft }));
    api.onPointerDown(pointerEvent(harness.ruler, { pointerId: 9, clientX: harness.ruler.rectLeft + 90 }));
    expect(harness.onSeek).toHaveBeenCalledTimes(1);
    expect(harness.ruler.captured).toEqual([7]);
  });
});
