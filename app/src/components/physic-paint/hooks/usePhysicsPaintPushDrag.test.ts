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
  PUSH_DRAG_THRESHOLD_PX,
  usePhysicsPaintPushDrag,
  type PushDragClampResult,
  type PushDragPreparationResult,
  type PushDragSourceElement,
  type PushDragWindowLike,
} from './usePhysicsPaintPushDrag';

type Publication = Readonly<{ deltaFrames: number }>;
type Listener = (event: any) => void;

class WindowDouble implements PushDragWindowLike {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly timers: Array<() => void> = [];
  removedCount = 0;

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.removedCount += 1;
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

class SourceDouble implements PushDragSourceElement {
  readonly captured: number[] = [];
  readonly released: number[] = [];
  readonly listeners = new Map<string, Set<Listener>>();
  readonly style = { cursor: 'pointer' };
  focus = vi.fn();
  removedCount = 0;

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
    this.removedCount += 1;
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
  readonly clampDestination?: (proposedDeltaFrames: number) => PushDragClampResult;
  readonly prepareAtDestination?: (deltaFrames: number) => PushDragPreparationResult<Publication>;
  readonly onDropCommit?: (publication: Publication) => Promise<boolean>;
} = {}) {
  hookRuntime.reset();
  const windowLike = new WindowDouble();
  const source = new SourceDouble();
  const projectDestination = vi.fn(
    ({ originClientX, clientX }: { originClientX: number; clientX: number }) => clientX - originClientX,
  );
  const clampDestination = vi.fn(
    options.clampDestination ?? ((deltaFrames: number): PushDragClampResult => ({ deltaFrames, blockedEdge: null })),
  );
  const prepareAtDestination = vi.fn(
    options.prepareAtDestination ?? ((deltaFrames: number) => ({
      ok: true as const,
      publication: Object.freeze({ deltaFrames }),
    })),
  );
  const onDropCommit = vi.fn(options.onDropCommit ?? (async (_publication: Publication) => true));
  const onCancel = vi.fn();
  const onRejected = vi.fn();
  const onPreviewChange = vi.fn();
  const clearClickSequence = vi.fn();
  const render = () => {
    hookRuntime.cursor = 0;
    return usePhysicsPaintPushDrag<Publication>({
      windowLike,
      projectDestination,
      clampDestination,
      prepareAtDestination,
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
    projectDestination,
    clampDestination,
    prepareAtDestination,
    onDropCommit,
    onCancel,
    onRejected,
    onPreviewChange,
    clearClickSequence,
    render,
  };
}

describe('usePhysicsPaintPushDrag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts only after horizontal travel exceeds the 4px push threshold', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 104 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 104 }));
    expect(harness.source.captured).toEqual([]);
    expect(harness.prepareAtDestination).not.toHaveBeenCalled();

    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(PUSH_DRAG_THRESHOLD_PX).toBe(4);
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

  it('projects the pointer delta, clamps it, and prepares the retained publication', () => {
    const clampDestination = vi.fn((_deltaFrames: number): PushDragClampResult => ({
      deltaFrames: 3,
      blockedEdge: 'right',
    }));
    const harness = createHarness({ clampDestination });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.projectDestination).toHaveBeenCalledWith({ originClientX: 100, clientX: 105 });
    expect(clampDestination).toHaveBeenCalledWith(5);
    expect(harness.prepareAtDestination).toHaveBeenCalledWith(3);
    expect(harness.onPreviewChange).toHaveBeenCalledTimes(1);
    expect(harness.render().ghost).toEqual({ active: true, deltaFrames: 3, blockedEdge: 'right' });
  });

  it('retains the prepared publication by identity for preview paint and commit', () => {
    const publication = Object.freeze({ deltaFrames: 108 });
    const harness = createHarness({
      prepareAtDestination: () => ({ ok: true, publication }),
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.render().preview?.publication).toBe(publication);
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.onDropCommit).toHaveBeenCalledWith(publication);
  });

  it('clears ghost and preview synchronously when a later destination is rejected', () => {
    const prepareAtDestination = vi.fn((deltaFrames: number) => deltaFrames === 5
      ? { ok: true as const, publication: Object.freeze({ deltaFrames }) }
      : { ok: false as const, reason: 'blocked' });
    const harness = createHarness({ prepareAtDestination });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.render().ghost.active).toBe(true);

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 106 }));
    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
    expect(harness.onPreviewChange).toHaveBeenLastCalledWith(null);
  });

  it('drops: commits the retained publication exactly once and clears every preview paint', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.onDropCommit).toHaveBeenCalledTimes(1);
    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
    expect(harness.onPreviewChange).toHaveBeenLastCalledWith(null);
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
});
