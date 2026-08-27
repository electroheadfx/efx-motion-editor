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
  buildCrossTrackMoveSuccessMessage,
  computeCrossTrackDestination,
  computeInsertionFrame,
  mapCrossTrackMoveRejection,
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

/** A two-row document double: the injected store port mutates it ONLY at
 *  release time (D-09 copy-paste-delete — source items removed, fresh
 *  identities in the destination); during the gesture it stays byte-identical
 *  (D-16 read-only signals). */
class DocumentDouble {
  readonly sourceKeys: string[] = ['key-1'];
  readonly destinationKeys: string[] = [];

  move(fromTrackId: string, toTrackId: string, keys: readonly string[]) {
    const from = fromTrackId === 'track-a' ? this.sourceKeys : this.destinationKeys;
    const to = toTrackId === 'track-b' ? this.destinationKeys : this.sourceKeys;
    for (const key of keys) {
      const index = from.indexOf(key);
      if (index >= 0) from.splice(index, 1);
    }
    to.push(...keys.map((key) => `${key}-fresh`));
  }

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
  readonly rejection?: { readonly ok: false; readonly reason: string };
} = {}) {
  hookRuntime.reset();
  const windowLike = new WindowDouble();
  const capture = new CaptureDouble();
  const document = new DocumentDouble();
  const moveTrackItems = vi.fn((_layerId: string, fromTrackId: string, toTrackId: string, keys: readonly string[], _destinationAppFrame: number) => {
    if (options.rejection) return options.rejection;
    document.move(fromTrackId, toTrackId, keys);
    return { ok: true as const };
  });
  const publishStatus = vi.fn();
  const setApplyStatus = vi.fn();
  const resolveSource = vi.fn(
    options.resolveSource ?? (() => ({ fromTrackId: 'track-a', keyIds: ['key-1'] } as const)),
  );
  const render = () => {
    hookRuntime.cursor = 0;
    return usePhysicsPaintCrossTrackDrag({
      windowLike,
      layerId: 'layer-1',
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
      moveTrackItems,
      publishStatus,
      setApplyStatus,
    });
  };
  return {
    windowLike,
    capture,
    document,
    moveTrackItems,
    publishStatus,
    setApplyStatus,
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

describe('cross-track move copy (47-05 Task 2, TML-05/D-17/D-14)', () => {
  it('builds the English success capsule line with singular/plural counts', () => {
    expect(buildCrossTrackMoveSuccessMessage(1)).toBe('Moved 1 key to another track.');
    expect(buildCrossTrackMoveSuccessMessage(3)).toBe('Moved 3 keys to another track.');
  });

  it('maps every moveTrackItems rejection reason to a fixed English message and falls back to a generic failure (T-47-05-03)', () => {
    expect(mapCrossTrackMoveRejection('track-missing')).toBe('Track not found');
    expect(mapCrossTrackMoveRejection('duplicate-destination-frame')).toBe('Destination frame is occupied');
    expect(mapCrossTrackMoveRejection('partial-loop-overlap')).toBe('Loop would be partially moved');
    expect(mapCrossTrackMoveRejection('empty-set')).toBe('Nothing to move');
    expect(mapCrossTrackMoveRejection('missing-key')).toBe('Key not found');
    // Unmapped and missing reasons never ship empty or French copy (D-14).
    expect(mapCrossTrackMoveRejection('apply-failed')).toBe('Move failed.');
    expect(mapCrossTrackMoveRejection('anything-else')).toBe('Move failed.');
    expect(mapCrossTrackMoveRejection(undefined)).toBe('Move failed.');
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
    expect(harness.moveTrackItems).not.toHaveBeenCalled();
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
    expect(harness.moveTrackItems).not.toHaveBeenCalled();
    expect(harness.publishStatus).not.toHaveBeenCalled();
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
    expect(harness.moveTrackItems).toHaveBeenCalledTimes(1);

    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientY: 45 }));
    harness.windowLike.emit('keydown', {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    });
    expect(harness.moveTrackItems).toHaveBeenCalledTimes(1);
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
    expect(harness.moveTrackItems).not.toHaveBeenCalled();
  });
});

describe('usePhysicsPaintCrossTrackDrag commit + rejection (47-05 Task 2, TML-05/D-17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits the move through moveTrackItems exactly once on a crossed release — source loses the items, the destination gains fresh identities (D-09)', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientX: 306, clientY: 45 }));
    harness.windowLike.emit('pointerup', pointerEvent({ clientX: 306, clientY: 45 }));

    expect(harness.moveTrackItems).toHaveBeenCalledTimes(1);
    // The commit carries the PREVIEWED insertion frame (47 close-out UAT round
    // 2): clientX 306 - contentLeft 270 = 36px → frame 2 at the 18px pitch.
    expect(harness.moveTrackItems).toHaveBeenCalledWith('layer-1', 'track-a', 'track-b', ['key-1'], 2);
    expect(harness.document.sourceKeys).toEqual([]);
    expect(harness.document.destinationKeys).toEqual(['key-1-fresh']);
    expect(harness.publishStatus).toHaveBeenCalledWith('Moved 1 key to another track.');
    // The rejection tone never fires on success.
    expect(harness.setApplyStatus).not.toHaveBeenCalledWith('error');
    // The destination signals clear on release.
    expect(api.destinationTrackId.value).toBeNull();
    expect(api.isCrossing.value).toBe(false);
    expect(api.insertionFrame.value).toBeNull();
  });

  it('passes the release-point frame so the rail lands exactly where the preview showed (47 close-out UAT round 2)', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent({ clientY: 15 }));
    // Release at clientX 342 → (342-270)/18 = frame 4 — the commit frame comes
    // from the SAME resolver the insertion preview uses, so the landed rail
    // starts exactly at the line the user saw.
    harness.windowLike.emit('pointermove', pointerEvent({ clientX: 342, clientY: 45 }));
    harness.windowLike.emit('pointerup', pointerEvent({ clientX: 342, clientY: 45 }));
    expect(harness.moveTrackItems).toHaveBeenCalledWith('layer-1', 'track-a', 'track-b', ['key-1'], 4);
  });

  it('a rejected move leaves both rows byte-identical and publishes the specific English reason with the red warning triangle (D-17)', () => {
    const harness = createHarness({ rejection: { ok: false, reason: 'partial-loop-overlap' } });
    const api = harness.render();
    const snapshotBefore = harness.document.snapshot();

    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientY: 45 }));
    harness.windowLike.emit('pointerup', pointerEvent({ clientY: 45 }));

    expect(harness.moveTrackItems).toHaveBeenCalledTimes(1);
    expect(harness.document.snapshot()).toBe(snapshotBefore);
    expect(harness.setApplyStatus).toHaveBeenCalledWith('error');
    expect(harness.publishStatus).toHaveBeenCalledWith('Loop would be partially moved');
  });

  it('never calls moveTrackItems when the release never crossed a row boundary — the same-row drag owns it (D-16)', () => {
    const harness = createHarness();
    const api = harness.render();
    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientX: 400, clientY: 20 }));
    harness.windowLike.emit('pointerup', pointerEvent({ clientX: 400, clientY: 20 }));

    expect(harness.moveTrackItems).not.toHaveBeenCalled();
    expect(harness.publishStatus).not.toHaveBeenCalled();
    expect(harness.setApplyStatus).not.toHaveBeenCalled();
    expect(harness.document.snapshot()).toBe(JSON.stringify({ sourceKeys: ['key-1'], destinationKeys: [] }));
  });

  it('never reaches moveTrackItems when the press resolved no draggable source — the header reorder grab path owns it (D-18)', () => {
    const harness = createHarness({ resolveSource: () => null });
    const api = harness.render();
    api.onPointerDown(pointerEvent({ clientY: 15 }));
    harness.windowLike.emit('pointermove', pointerEvent({ clientY: 45 }));
    harness.windowLike.emit('pointerup', pointerEvent({ clientY: 45 }));

    expect(harness.moveTrackItems).not.toHaveBeenCalled();
    expect(harness.publishStatus).not.toHaveBeenCalled();
    expect(harness.setApplyStatus).not.toHaveBeenCalled();
  });
});
