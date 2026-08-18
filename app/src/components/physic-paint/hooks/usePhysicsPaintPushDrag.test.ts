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
  type PushToolDirection,
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
  readonly clampDestination?: (proposedDeltaFrames: number, direction: PushToolDirection) => PushDragClampResult;
  readonly prepareAtDestination?: (deltaFrames: number, direction: PushToolDirection) => PushDragPreparationResult<Publication>;
  readonly onDropCommit?: (publication: Publication) => Promise<boolean>;
} = {}) {
  hookRuntime.reset();
  const windowLike = new WindowDouble();
  const source = new SourceDouble();
  const projectDestination = vi.fn(
    ({ originClientX, clientX }: { originClientX: number; clientX: number }) => clientX - originClientX,
  );
  const clampDestination = vi.fn(
    options.clampDestination ?? ((deltaFrames: number, _direction: PushToolDirection): PushDragClampResult => ({ deltaFrames, blockedEdge: null })),
  );
  const prepareAtDestination = vi.fn(
    options.prepareAtDestination ?? ((deltaFrames: number, _direction: PushToolDirection) => ({
      ok: true as const,
      publication: Object.freeze({ deltaFrames }),
    })),
  );
  const onDropCommit = vi.fn(options.onDropCommit ?? (async (_publication: Publication) => true));
  const onCancel = vi.fn();
  const onRejected = vi.fn();
  const onBlocked = vi.fn();
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
      onBlocked,
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
    onBlocked,
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

  it('projects the pointer delta, locks the direction from the drag sign, clamps it, and prepares the retained publication', () => {
    const clampDestination = vi.fn((_deltaFrames: number, _direction: PushToolDirection): PushDragClampResult => ({
      deltaFrames: 3,
      blockedEdge: 'right',
    }));
    const harness = createHarness({ clampDestination });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.projectDestination).toHaveBeenCalledWith({ originClientX: 100, clientX: 105 });
    // The drag moved right (105 > 100), so the direction locks to 'right' and
    // both clamp and prepare receive it.
    expect(clampDestination).toHaveBeenCalledWith(5, 'right');
    expect(harness.prepareAtDestination).toHaveBeenCalledWith(3, 'right');
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

  it('passes a sub-threshold click through unsuppressed so navigation proceeds (D-09)', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 104 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 104 }));

    expect(harness.source.captured).toEqual([]);
    expect(harness.prepareAtDestination).not.toHaveBeenCalled();
    expect(api.consumeClickSuppression()).toBe(false);
  });

  it('cancels on Escape without committing, clears session paint, and stops propagation', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    const stopImmediatePropagation = vi.fn();
    harness.windowLike.emit('keydown', {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopImmediatePropagation,
    });

    expect(harness.onDropCommit).not.toHaveBeenCalled();
    expect(harness.onCancel).toHaveBeenCalledTimes(1);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
    expect(harness.source.focus).toHaveBeenCalledTimes(1);
  });

  it('cancels on pointercancel, clears preview, and removes every listener exactly once', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    harness.windowLike.emit('pointercancel', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
    expect(harness.windowLike.removedCount).toBe(4);
    expect(harness.source.removedCount).toBe(1);
    expect(harness.onDropCommit).not.toHaveBeenCalled();
  });

  it('cancels on lostpointercapture and clears session paint', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));

    harness.source.emit('lostpointercapture', {});

    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
    expect(harness.windowLike.removedCount).toBe(4);
    expect(harness.source.removedCount).toBe(1);
    expect(harness.onDropCommit).not.toHaveBeenCalled();
  });

  it('routes a drop with no retained publication to onRejected with zero mutation', () => {
    const prepareAtDestination = vi.fn(() => ({
      ok: false as const,
      reason: 'no-free-space-in-direction',
      detail: 'No empty space in that direction.',
    }));
    const harness = createHarness({ prepareAtDestination });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.onDropCommit).not.toHaveBeenCalled();
    expect(harness.onRejected).toHaveBeenCalledWith('no-free-space-in-direction', 'No empty space in that direction.');
    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
    expect(harness.source.focus).toHaveBeenCalledTimes(1);
  });

  it('restores focus and leaves zero mutation when the commit port resolves false', async () => {
    const harness = createHarness({
      onDropCommit: async () => false,
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));

    await Promise.resolve();
    await Promise.resolve();
    expect(harness.source.focus).toHaveBeenCalledTimes(1);
    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
  });

  it('restores focus when the commit port rejects', async () => {
    const harness = createHarness({
      onDropCommit: async () => { throw new Error('transport failed'); },
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));

    await Promise.resolve();
    await Promise.resolve();
    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
    expect(harness.source.focus).toHaveBeenCalledTimes(1);
  });

  it('passes the pointer viewport coords to onBlocked when a destination is rejected (43.5-05 Defect 2)', () => {
    const prepareAtDestination = vi.fn(() => ({
      ok: false as const,
      reason: 'no-free-space-in-direction',
      detail: 'No empty space in that direction.',
    }));
    const harness = createHarness({ prepareAtDestination });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105, clientY: 40 }));

    expect(harness.onBlocked).toHaveBeenCalledWith(
      'no-free-space-in-direction',
      'No empty space in that direction.',
      { clientX: 105, clientY: 40 },
    );
  });

  it('suppresses the trailing post-drop click exactly once', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));

    expect(api.consumeClickSuppression()).toBe(true);
    expect(api.consumeClickSuppression()).toBe(false);
  });
});
