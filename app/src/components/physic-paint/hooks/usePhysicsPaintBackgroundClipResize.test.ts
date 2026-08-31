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
  BACKGROUND_CLIP_RESIZE_THRESHOLD_PX,
  usePhysicsPaintBackgroundClipResize,
  type BackgroundClipResizeSourceElement,
  type BackgroundClipResizeWindowLike,
} from './usePhysicsPaintBackgroundClipResize';

type Listener = (event: any) => void;

class WindowDouble implements BackgroundClipResizeWindowLike {
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

class SourceDouble implements BackgroundClipResizeSourceElement {
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
  readonly source?: { clipId: string; edge: 'start' | 'end'; startFrame: number; endFrame: number; cycleLength: number };
  readonly clampFrame?: (frame: number) => {
    frame: number;
    left: number;
    width: number;
    blockedEdge: 'left' | 'right' | null;
  };
  readonly prepareAtFrame?: (frame: number) =>
    | Readonly<{ ok: true; publication: { clipId: string; edge: 'start' | 'end'; frame: number } }>
    | Readonly<{ ok: false; reason?: string; detail?: string }>;
  readonly onDropCommit?: (publication: { clipId: string; edge: 'start' | 'end'; frame: number }) =>
    | Readonly<{ ok: true }>
    | Readonly<{ ok: false; reason?: string }>;
} = {}) {
  hookRuntime.reset();
  const windowLike = new WindowDouble();
  const source = new SourceDouble();
  const resolveSource = vi.fn(() => options.source ?? {
    clipId: 'clip-1',
    edge: 'end' as const,
    startFrame: 100,
    endFrame: 105,
    cycleLength: 1,
  });
  const projectFrame = vi.fn(({ clientX }: { originClientX: number; clientX: number }) => clientX);
  const prepareAtFrame = vi.fn(options.prepareAtFrame ?? ((frame: number) => ({
    ok: true as const,
    publication: Object.freeze({ clipId: 'clip-1', edge: 'end' as const, frame }),
  })));
  const onDropCommit = vi.fn(options.onDropCommit ?? ((_publication: { clipId: string; edge: 'start' | 'end'; frame: number }) => ({ ok: true as const })));
  const onRejected = vi.fn();
  const onSelectClip = vi.fn();
  const onCancel = vi.fn();
  const clearClickSequence = vi.fn();
  const render = () => {
    hookRuntime.cursor = 0;
    return usePhysicsPaintBackgroundClipResize({
      windowLike,
      resolveSource,
      projectFrame,
      clampFrame: options.clampFrame ?? ((frame) => ({
        frame,
        left: frame,
        width: 54,
        blockedEdge: null,
      })),
      prepareAtFrame,
      onDropCommit,
      onRejected,
      onSelectClip,
      onCancel,
      clearClickSequence,
    });
  };
  return {
    windowLike,
    source,
    resolveSource,
    projectFrame,
    prepareAtFrame,
    onDropCommit,
    onRejected,
    onSelectClip,
    onCancel,
    clearClickSequence,
    render,
  };
}

describe('usePhysicsPaintBackgroundClipResize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts only after horizontal travel exceeds the 4px threshold', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 104 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 104 }));
    expect(harness.source.captured).toEqual([]);
    expect(harness.prepareAtFrame).not.toHaveBeenCalled();

    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(BACKGROUND_CLIP_RESIZE_THRESHOLD_PX).toBe(4);
    expect(harness.source.captured).toEqual([7]);
    expect(harness.clearClickSequence).toHaveBeenCalledTimes(1);
  });

  it('captures the pointer, switches to ew-resize, and releases capture on drop', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.source.captured).toEqual([7]);
    expect(harness.source.style.cursor).toBe('ew-resize');

    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.source.released).toEqual([7]);
    expect(harness.source.style.cursor).toBe('pointer');
  });

  it('commits the END edge through the store port with the dragged frame', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 108 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 108 }));

    expect(harness.onDropCommit).toHaveBeenCalledTimes(1);
    expect(harness.onDropCommit).toHaveBeenCalledWith({ clipId: 'clip-1', edge: 'end', frame: 108 });
  });

  it('commits the START edge through the store port with the dragged frame', () => {
    const harness = createHarness({
      source: { clipId: 'clip-1', edge: 'start', startFrame: 100, endFrame: 105, cycleLength: 1 },
      prepareAtFrame: (frame) => ({
        ok: true as const,
        publication: Object.freeze({ clipId: 'clip-1', edge: 'start' as const, frame }),
      }),
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 95 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 95 }));

    expect(harness.onDropCommit).toHaveBeenCalledTimes(1);
    expect(harness.onDropCommit).toHaveBeenCalledWith({ clipId: 'clip-1', edge: 'start', frame: 95 });
  });

  it('never commits a net-zero resize (release at the source edge frame)', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    // The end edge anchor is endFrame 105 — a release there is a no-op.
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.onDropCommit).not.toHaveBeenCalled();
  });

  it('routes a sub-threshold release to clip selection without any store call', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 100 }));
    expect(harness.onSelectClip).toHaveBeenCalledWith('clip-1');
    expect(harness.onDropCommit).not.toHaveBeenCalled();
  });

  it('cancels on Escape without committing and clears the ghost', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 108 }));
    expect(harness.render().ghost.active).toBe(true);

    harness.windowLike.emit('keydown', {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    });

    expect(harness.onDropCommit).not.toHaveBeenCalled();
    expect(harness.onCancel).toHaveBeenCalledTimes(1);
    expect(harness.render().ghost.active).toBe(false);
  });

  it('publishes exact clamped ghost geometry and blocked-edge state from live pointer projection', () => {
    const clampFrame = vi.fn((frame: number) => ({
      frame: 108,
      left: 144,
      width: 72,
      blockedEdge: frame > 108 ? 'right' as const : null,
    }));
    const harness = createHarness({ clampFrame });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 112 }));

    expect(clampFrame).toHaveBeenCalledWith(112);
    expect(harness.prepareAtFrame).toHaveBeenCalledWith(108);
    expect(harness.render().ghost).toEqual({
      active: true,
      left: 144,
      width: 72,
      blockedEdge: 'right',
    });
  });

  it('clears the ghost synchronously when a later frame is rejected', () => {
    const prepareAtFrame = vi.fn((frame: number) => frame === 105
      ? { ok: true as const, publication: Object.freeze({ clipId: 'clip-1', edge: 'end' as const, frame }) }
      : { ok: false as const, reason: 'blocked' });
    const harness = createHarness({ prepareAtFrame });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.render().ghost.active).toBe(true);

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 106 }));
    expect(harness.render().ghost.active).toBe(false);
  });
});
