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
  useEffect: vi.fn(),
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
  RAIL_SET_DRAG_THRESHOLD_PX,
  usePhysicsPaintRailSetDrag,
  type RailSetDragSourceElement,
  type RailSetDragWindowLike,
} from './usePhysicsPaintRailSetDrag';

type GapInterval = Readonly<{ start: number; end: number }>;
type Publication = Readonly<{ delta: number; gapIntervals: readonly GapInterval[] }>;
type Listener = (event: any) => void;

class WindowDouble implements RailSetDragWindowLike {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly timers: Array<() => void> = [];

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  setTimeout(handler: () => void) {
    this.timers.push(handler);
    return this.timers.length;
  }

  emit(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class SourceDouble implements RailSetDragSourceElement {
  readonly captured: number[] = [];
  readonly released: number[] = [];
  readonly listeners = new Map<string, Set<Listener>>();
  readonly style = { cursor: 'pointer' };
  focus = vi.fn();

  setPointerCapture(pointerId: number) {
    this.captured.push(pointerId);
  }

  hasPointerCapture(pointerId: number) {
    return this.captured.includes(pointerId) && !this.released.includes(pointerId);
  }

  releasePointerCapture(pointerId: number) {
    this.released.push(pointerId);
  }

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

function pointerEvent(source: SourceDouble, overrides: Partial<PointerEvent> = {}): PointerEvent {
  return {
    pointerId: 7,
    clientX: 100,
    clientY: 20,
    isPrimary: true,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    currentTarget: source,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as PointerEvent;
}

function createHarness(options: {
  readonly clampDelta?: (proposedDelta: number) => {
    delta: number;
    blockedEdge: 'left' | 'right' | null;
    collidingMemberId: string | null;
  };
  readonly prepareAtDelta?: (delta: number) =>
    | Readonly<{ ok: true; publication: Publication }>
    | Readonly<{ ok: false; reason?: string; detail?: string }>;
  readonly onDropCommit?: (publication: Publication) => Promise<boolean>;
} = {}) {
  hookRuntime.reset();
  const windowLike = new WindowDouble();
  const source = new SourceDouble();
  const prepareAtDelta = vi.fn(options.prepareAtDelta ?? ((delta: number) => ({
    ok: true as const,
    publication: Object.freeze({ delta, gapIntervals: Object.freeze([]) }),
  })));
  const onDropCommit = vi.fn(options.onDropCommit ?? (async (_publication: Publication) => true));
  const onCancel = vi.fn();
  const onRejected = vi.fn();
  const onPreviewChange = vi.fn();
  const clearClickSequence = vi.fn();
  const render = () => {
    hookRuntime.cursor = 0;
    return usePhysicsPaintRailSetDrag<Publication>({
      windowLike,
      projectDelta: ({ originClientX, clientX }) => clientX - originClientX,
      clampDelta: options.clampDelta ?? ((proposedDelta) => ({
        delta: proposedDelta,
        blockedEdge: null,
        collidingMemberId: null,
      })),
      prepareAtDelta,
      onDropCommit,
      onCancel,
      onRejected,
      onPreviewChange,
      clearClickSequence,
    });
  };
  return {
    windowLike,
    source,
    prepareAtDelta,
    onDropCommit,
    onCancel,
    onRejected,
    onPreviewChange,
    clearClickSequence,
    render,
  };
}

describe('usePhysicsPaintRailSetDrag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects guarded pointer-down inputs and ignores a second session while active', () => {
    const harness = createHarness();
    const api = harness.render();
    for (const overrides of [
      { isPrimary: false },
      { button: 1 },
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
    ]) {
      api.onPointerDown(pointerEvent(harness.source, overrides));
    }
    expect(harness.windowLike.listeners.size).toBe(0);

    api.onPointerDown(pointerEvent(harness.source));
    api.onPointerDown(pointerEvent(harness.source, { pointerId: 9, clientX: 200 }));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.source.captured).toEqual([7]);
  });

  it('falls through to click behavior when released under the 4px threshold', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 103 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 103 }));
    expect(harness.source.captured).toEqual([]);
    expect(harness.prepareAtDelta).not.toHaveBeenCalled();
    expect(harness.onDropCommit).not.toHaveBeenCalled();
    expect(harness.onRejected).not.toHaveBeenCalled();
    expect(api.consumeClickSuppression()).toBe(false);
  });

  it('starts only after horizontal travel exceeds the 4px threshold', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 104 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 104 }));
    expect(harness.source.captured).toEqual([]);
    expect(harness.prepareAtDelta).not.toHaveBeenCalled();

    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 106 }));
    expect(RAIL_SET_DRAG_THRESHOLD_PX).toBe(4);
    expect(harness.source.captured).toEqual([7]);
    expect(harness.clearClickSequence).toHaveBeenCalledTimes(1);
  });

  it('captures the pointer, switches to grabbing, and releases capture on drop', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.source.captured).toEqual([7]);
    expect(harness.source.style.cursor).toBe('grabbing');

    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.source.released).toEqual([7]);
    expect(harness.source.style.cursor).toBe('pointer');
  });

  it('publishes the set-level preview state from the clamp result and prepared gap intervals', () => {
    const clampDelta = vi.fn(() => ({
      delta: 12,
      blockedEdge: 'right' as const,
      collidingMemberId: 'k1',
    }));
    const harness = createHarness({
      clampDelta,
      prepareAtDelta: () => ({
        ok: true as const,
        publication: Object.freeze({
          delta: 12,
          gapIntervals: Object.freeze([{ start: 20, end: 30 }]),
        }),
      }),
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    expect(clampDelta).toHaveBeenCalledWith(5);
    expect(harness.prepareAtDelta).toHaveBeenCalledWith(12);
    expect(harness.render().preview).toEqual({
      delta: 12,
      blockedEdge: 'right',
      collidingMemberId: 'k1',
      gapIntervals: [{ start: 20, end: 30 }],
    });
    expect(harness.onPreviewChange).toHaveBeenCalledWith(harness.render().preview);
  });

  it('retains the prepared publication by identity for preview paint and commit', () => {
    const publication = Object.freeze({
      delta: 12,
      gapIntervals: Object.freeze([{ start: 20, end: 30 }]),
    });
    const harness = createHarness({
      prepareAtDelta: () => ({ ok: true, publication }),
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.render().preview?.gapIntervals).toEqual(publication.gapIntervals);
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.onDropCommit).toHaveBeenCalledWith(publication);
  });

  it('publishes nothing for a zero-delta clamp: no prepare, no commit, no rejection', () => {
    const harness = createHarness({
      clampDelta: () => ({ delta: 0, blockedEdge: null, collidingMemberId: null }),
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.prepareAtDelta).not.toHaveBeenCalled();
    expect(harness.render().preview).toBeNull();

    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.onDropCommit).not.toHaveBeenCalled();
    expect(harness.onRejected).not.toHaveBeenCalled();
    expect(harness.source.focus).toHaveBeenCalledTimes(1);
  });

  it('clears paint and reports the retained rejection at drop when prepare fails', () => {
    const harness = createHarness({
      prepareAtDelta: () => ({ ok: false as const, reason: 'blocked', detail: 'k1' }),
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.render().preview).toBeNull();
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.onDropCommit).not.toHaveBeenCalled();
    expect(harness.onRejected).toHaveBeenCalledWith('blocked', 'k1');
  });

  it('clears paint synchronously when a later delta is rejected', () => {
    const prepareAtDelta = vi.fn((delta: number) => delta === 5
      ? { ok: true as const, publication: Object.freeze({ delta, gapIntervals: Object.freeze([]) }) }
      : { ok: false as const, reason: 'blocked' });
    const harness = createHarness({ prepareAtDelta });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.render().preview).not.toBeNull();

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 106 }));
    expect(harness.render().preview).toBeNull();
  });

  it('cancels on Escape exactly once with byte-untouched originals', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    harness.windowLike.emit('keydown', {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    });

    expect(harness.onDropCommit).not.toHaveBeenCalled();
    expect(harness.onCancel).toHaveBeenCalledTimes(1);
    expect(harness.source.released).toEqual([7]);
    expect(harness.source.style.cursor).toBe('pointer');
    expect(harness.render().preview).toBeNull();
    expect(harness.source.focus).toHaveBeenCalledTimes(1);

    harness.windowLike.emit('keydown', {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    });
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 106 }));
    expect(harness.onCancel).toHaveBeenCalledTimes(1);
    expect(harness.prepareAtDelta).toHaveBeenCalledTimes(1);
  });

  it('cancels on pointercancel exactly once', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    harness.windowLike.emit('pointercancel', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.onCancel).toHaveBeenCalledTimes(1);
    expect(harness.source.released).toEqual([7]);
    expect(harness.render().preview).toBeNull();

    harness.windowLike.emit('pointercancel', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels on lostpointercapture exactly once', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    harness.source.emit('lostpointercapture', {});
    expect(harness.onCancel).toHaveBeenCalledTimes(1);
    expect(harness.source.released).toEqual([7]);
    expect(harness.render().preview).toBeNull();

    harness.source.emit('lostpointercapture', {});
    expect(harness.onCancel).toHaveBeenCalledTimes(1);
  });

  it('arms trailing-click suppression only after a session actually started', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 103 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 103 }));
    expect(api.consumeClickSuppression()).toBe(false);

    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));
    expect(api.consumeClickSuppression()).toBe(true);
    expect(api.consumeClickSuppression()).toBe(false);
  });

  it('clears paint and restores focus when the commit port rejects', async () => {
    const harness = createHarness({
      onDropCommit: async () => { throw new Error('transport failed'); },
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));

    await Promise.resolve();
    await Promise.resolve();
    expect(harness.render().preview).toBeNull();
    expect(harness.source.focus).toHaveBeenCalledTimes(1);
  });
});
