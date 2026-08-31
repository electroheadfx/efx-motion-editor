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
  BACKGROUND_CLIP_DRAG_THRESHOLD_PX,
  usePhysicsPaintBackgroundClipDrag,
  type BackgroundClipDragSourceElement,
  type BackgroundClipDragWindowLike,
} from './usePhysicsPaintBackgroundClipDrag';

type Listener = (event: any) => void;

class WindowDouble implements BackgroundClipDragWindowLike {
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

class SourceDouble implements BackgroundClipDragSourceElement {
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
  readonly clampDestination?: (destination: number) => {
    destination: number;
    left: number;
    width: number;
    blockedEdge: 'left' | 'right' | null;
  };
  readonly prepareAtDestination?: (destination: number) =>
    | Readonly<{ ok: true; publication: { clipId: string; landingFrame: number } }>
    | Readonly<{ ok: false; reason?: string; detail?: string }>;
  readonly onDropCommit?: (publication: { clipId: string; landingFrame: number }) =>
    | Readonly<{ ok: true }>
    | Readonly<{ ok: false; reason?: string }>;
} = {}) {
  hookRuntime.reset();
  const windowLike = new WindowDouble();
  const source = new SourceDouble();
  const resolveSource = vi.fn(() => ({ clipId: 'clip-1', startFrame: 100 }));
  const projectDestination = vi.fn(({ clientX }: { originClientX: number; clientX: number }) => clientX);
  const prepareAtDestination = vi.fn(options.prepareAtDestination ?? ((destination: number) => ({
    ok: true as const,
    publication: Object.freeze({ clipId: 'clip-1', landingFrame: destination }),
  })));
  const onDropCommit = vi.fn(options.onDropCommit ?? ((_publication: { clipId: string; landingFrame: number }) => ({ ok: true as const })));
  const onRejected = vi.fn();
  const onPreviewChange = vi.fn();
  const onSelectClip = vi.fn();
  const onCancel = vi.fn();
  const clearClickSequence = vi.fn();
  const render = () => {
    hookRuntime.cursor = 0;
    return usePhysicsPaintBackgroundClipDrag({
      windowLike,
      resolveSource,
      projectDestination,
      clampDestination: options.clampDestination ?? ((destination) => ({
        destination,
        left: destination,
        width: 54,
        blockedEdge: null,
      })),
      prepareAtDestination,
      onDropCommit,
      onRejected,
      onPreviewChange,
      onSelectClip,
      onCancel,
      clearClickSequence,
    });
  };
  return {
    windowLike,
    source,
    resolveSource,
    projectDestination,
    prepareAtDestination,
    onDropCommit,
    onRejected,
    onPreviewChange,
    onSelectClip,
    onCancel,
    clearClickSequence,
    render,
  };
}

describe('usePhysicsPaintBackgroundClipDrag', () => {
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
    expect(harness.prepareAtDestination).not.toHaveBeenCalled();

    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(BACKGROUND_CLIP_DRAG_THRESHOLD_PX).toBe(4);
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

  it('cancels on Escape without committing and clears session paint', () => {
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
    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
    expect(harness.source.focus).toHaveBeenCalledTimes(1);
  });

  it('suppresses the trailing post-drop click exactly once and cancels pending click work', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.clearClickSequence).toHaveBeenCalledTimes(1);
    expect(api.consumeClickSuppression()).toBe(true);
    expect(api.consumeClickSuppression()).toBe(false);
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

  it('publishes exact clamped ghost geometry and blocked-edge state from live pointer projection', () => {
    const clampDestination = vi.fn((destination: number) => ({
      destination: 108,
      left: 144,
      width: 72,
      blockedEdge: destination > 108 ? 'right' as const : null,
    }));
    const harness = createHarness({ clampDestination });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 112 }));

    expect(clampDestination).toHaveBeenCalledWith(112);
    expect(harness.prepareAtDestination).toHaveBeenCalledWith(108);
    expect(harness.render().ghost).toEqual({
      active: true,
      left: 144,
      width: 72,
      blockedEdge: 'right',
    });
  });

  it('retains the prepared publication by identity for preview paint and commit', () => {
    const publication = Object.freeze({ clipId: 'clip-1', landingFrame: 108 });
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
    const prepareAtDestination = vi.fn((destination: number) => destination === 105
      ? { ok: true as const, publication: Object.freeze({ clipId: 'clip-1', landingFrame: destination }) }
      : { ok: false as const, reason: 'blocked' });
    const harness = createHarness({ prepareAtDestination });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    expect(harness.render().ghost.active).toBe(true);

    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 106 }));
    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
  });

  it('clears paint and restores focus when the commit port rejects', async () => {
    const harness = createHarness({
      onDropCommit: () => { throw new Error('transport failed'); },
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

  it('commits exactly once on release to a free frame and never mutates mid-gesture', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    // No store call during the gesture — release-time commit only.
    expect(harness.onDropCommit).not.toHaveBeenCalled();
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.onDropCommit).toHaveBeenCalledTimes(1);
    expect(harness.onDropCommit).toHaveBeenCalledWith({ clipId: 'clip-1', landingFrame: 105 });
  });

  it('rejects a landing inside another clip with the start-collision reason and clears paint', () => {
    const harness = createHarness({
      onDropCommit: () => ({ ok: false as const, reason: 'start-collision' }),
    });
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 105 }));

    expect(harness.onRejected).toHaveBeenCalledWith('start-collision');
    expect(harness.render().ghost.active).toBe(false);
    expect(harness.render().preview).toBeNull();
  });

  it('skips the store call on a net-zero move (release at the source start frame)', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105 }));
    // Preview-is-the-commit: the release lands at the LAST previewed frame, so
    // a net-zero move must preview back at the source's own start frame first.
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 100 }));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 100 }));

    expect(harness.onDropCommit).not.toHaveBeenCalled();
  });

  it('routes a sub-threshold release (click) to clip selection without a store call', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointerup', pointerEvent(harness.source, { clientX: 100 }));

    expect(harness.onSelectClip).toHaveBeenCalledWith('clip-1');
    expect(harness.onDropCommit).not.toHaveBeenCalled();
  });

  it('is row-fixed: the API exposes no cross-track signals and projection ignores vertical movement', () => {
    const harness = createHarness();
    const api = harness.render();
    const apiKeys = Object.keys(api);
    expect(apiKeys).not.toContain('destinationTrackId');
    expect(apiKeys).not.toContain('insertionFrame');
    expect(apiKeys).not.toContain('isCrossing');
    // The projection input carries only horizontal geometry — vertical pointer
    // movement can never influence the landing frame (row-fixed law).
    api.onPointerDown(pointerEvent(harness.source));
    harness.windowLike.emit('pointermove', pointerEvent(harness.source, { clientX: 105, clientY: 400 }));
    expect(harness.projectDestination).toHaveBeenCalledWith({ originClientX: 100, clientX: 105 });
  });
});
