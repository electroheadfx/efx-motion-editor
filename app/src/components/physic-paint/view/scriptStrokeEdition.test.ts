// ============================================================
//  scriptStrokeEdition.test.ts — the shared script-edition seam
//  (quick 261023-g4p Task 2; multi-select 261024-mz5 Task 1).
//
//  One selection SET, one drag state and one gesture geometry
//  serve both the watercolor module and the brush Move surface.
//  The watercolor module aliases these signals by identity so
//  its existing consumers can never diverge from the shared
//  state.
//
//  The keyboard consume law: Delete is consumed once a registered
//  port reports active AND the selection is non-empty — the whole
//  set goes to the port in ONE batch call. '<' / '>' stay
//  single-stroke: a multi-selection consumes the key but never
//  steps anything.
// ============================================================

import { afterEach, describe, expect, it } from 'vitest';
import { effect } from '@preact/signals';
import {
  aquarelleSelectMode,
  aquarelleSelectedStrokeMutationId,
  aquarelleStrokeDrag,
} from './aquarelleStrokeSelection';
import {
  clearScriptStrokeDrag,
  clearScriptStrokeSelection,
  deleteSelectedScriptStroke,
  hitsScriptStroke,
  scriptSelectedStrokeId,
  scriptSelectedStrokeIds,
  scriptSelectMode,
  scriptStrokeBoundsPx,
  scriptStrokeDrag,
  selectScriptStroke,
  selectScriptStrokeAt,
  setScriptSelectMode,
  setScriptStrokeDrag,
  setScriptStrokeEditionPort,
  setScriptStrokeEditionPorts,
  setScriptStrokeSelection,
  stepSelectedScriptStroke,
  toggleScriptStrokeSelection,
  type CanvasPoint,
  type ScriptStrokeEditionPort,
  type SelectableScriptStroke,
} from './scriptStrokeEdition';

const SIZE = { width: 400, height: 200 };

function point(x: number, y: number): CanvasPoint {
  return { x, y };
}

interface PortCalls {
  deleted: number[][];
  stepped: Array<{ id: number; direction: 'back' | 'forward' }>;
}

function fakePort(options: {
  active?: boolean;
  calls: PortCalls;
}): ScriptStrokeEditionPort {
  return {
    isActive: () => options.active ?? true,
    listStrokes: (): SelectableScriptStroke[] => [],
    hitTestStroke: () => null,
    deleteStrokes: (ids) => {
      options.calls.deleted.push([...ids]);
    },
    moveStrokes: () => {},
    stepStroke: (id, direction) => {
      options.calls.stepped.push({ id, direction });
    },
  };
}

function calls(): PortCalls {
  return { deleted: [], stepped: [] };
}

function selected(): number[] {
  return [...scriptSelectedStrokeIds.value].sort((a, b) => a - b);
}

afterEach(() => {
  setScriptStrokeEditionPort(null);
  setScriptStrokeEditionPorts(null);
  clearScriptStrokeSelection();
  setScriptSelectMode(false);
});

describe('scriptStrokeEdition — shared signals', () => {
  it('aliases the watercolor signals by identity', () => {
    expect(aquarelleSelectMode).toBe(scriptSelectMode);
    expect(aquarelleSelectedStrokeMutationId).toBe(scriptSelectedStrokeId);
    expect(aquarelleStrokeDrag).toBe(scriptStrokeDrag);
  });

  it('is compare-then-write on the select mode', () => {
    let runs = 0;
    const dispose = effect(() => {
      void scriptSelectMode.value;
      runs += 1;
    });
    try {
      const before = runs;
      setScriptSelectMode(true);
      setScriptSelectMode(true);
      expect(runs).toBe(before + 1);
      setScriptSelectMode(false);
      setScriptSelectMode(false);
      expect(runs).toBe(before + 2);
    } finally {
      dispose();
    }
  });

  it('is compare-then-write on the drag over every field', () => {
    let runs = 0;
    const dispose = effect(() => {
      void scriptStrokeDrag.value;
      runs += 1;
    });
    try {
      const before = runs;
      setScriptStrokeDrag({ mutationIds: [3], dxPx: 2, dyPx: 4 });
      setScriptStrokeDrag({ mutationIds: [3], dxPx: 2, dyPx: 4 });
      expect(runs).toBe(before + 1);
      setScriptStrokeDrag({ mutationIds: [3, 7], dxPx: 2, dyPx: 4 });
      setScriptStrokeDrag({ mutationIds: [3, 7], dxPx: 2, dyPx: 5 });
      setScriptStrokeDrag({ mutationIds: [3], dxPx: 2, dyPx: 5 });
      expect(runs).toBe(before + 4);
      // A stale clear (no drag armed) is a no-op.
      clearScriptStrokeDrag();
      clearScriptStrokeDrag();
      expect(runs).toBe(before + 5);
    } finally {
      dispose();
    }
  });

  it('turning select mode off clears the selection and the drag', () => {
    setScriptSelectMode(true);
    selectScriptStroke(11);
    setScriptStrokeDrag({ mutationIds: [11], dxPx: 5, dyPx: 6 });

    setScriptSelectMode(false);

    expect(scriptSelectedStrokeIds.value.size).toBe(0);
    expect(scriptSelectedStrokeId.value).toBeNull();
    expect(scriptStrokeDrag.value).toBeNull();
  });
});

describe('scriptStrokeEdition — selection set law', () => {
  it('plain select replaces, toggle flips, any iterable is accepted, clear empties', () => {
    selectScriptStroke(7);
    expect(selected()).toEqual([7]);
    selectScriptStroke(9);
    expect(selected()).toEqual([9]);

    toggleScriptStrokeSelection(7);
    expect(selected()).toEqual([7, 9]);
    toggleScriptStrokeSelection(7);
    expect(selected()).toEqual([9]);

    setScriptStrokeSelection(new Set([7, 9]));
    expect(selected()).toEqual([7, 9]);
    setScriptStrokeSelection([9]);
    expect(selected()).toEqual([9]);

    clearScriptStrokeSelection();
    expect(scriptSelectedStrokeIds.value.size).toBe(0);
  });

  it('is compare-then-write: one notification per effective membership change', () => {
    let runs = 0;
    const dispose = effect(() => {
      void scriptSelectedStrokeIds.value;
      runs += 1;
    });
    try {
      const before = runs;
      selectScriptStroke(7);
      selectScriptStroke(7);
      expect(runs).toBe(before + 1);
      toggleScriptStrokeSelection(7);
      expect(runs).toBe(before + 2);
      toggleScriptStrokeSelection(7);
      expect(runs).toBe(before + 3);
      // Identical membership: no new Set, no notification.
      setScriptStrokeSelection([7]);
      expect(runs).toBe(before + 3);
      clearScriptStrokeSelection();
      clearScriptStrokeSelection();
      expect(runs).toBe(before + 4);
    } finally {
      dispose();
    }
  });

  it('the single-id computed alias notifies exactly when its value changes', () => {
    let runs = 0;
    const dispose = effect(() => {
      void scriptSelectedStrokeId.value;
      runs += 1;
    });
    try {
      const before = runs;
      selectScriptStroke(7);
      expect(scriptSelectedStrokeId.value).toBe(7);
      expect(runs).toBe(before + 1);
      // {7} -> {7,9}: the singleton value becomes null.
      toggleScriptStrokeSelection(9);
      expect(scriptSelectedStrokeId.value).toBeNull();
      expect(runs).toBe(before + 2);
      // {7,9} -> {7}: back to the singleton.
      toggleScriptStrokeSelection(9);
      expect(scriptSelectedStrokeId.value).toBe(7);
      expect(runs).toBe(before + 3);
      // {7} -> {}: null.
      toggleScriptStrokeSelection(7);
      expect(scriptSelectedStrokeId.value).toBeNull();
      expect(runs).toBe(before + 4);
      // null -> null with a different multi-set: no notification.
      setScriptStrokeSelection([7, 9]);
      expect(scriptSelectedStrokeId.value).toBeNull();
      expect(runs).toBe(before + 4);
    } finally {
      dispose();
    }
  });
});

describe('scriptStrokeEdition — shared geometry', () => {
  it('hits a segment within the radius and misses outside it', () => {
    const segment = [point(0, 0), point(100, 0)];
    expect(hitsScriptStroke(point(50, 5), segment, 6)).toBe(true);
    expect(hitsScriptStroke(point(50, 7), segment, 6)).toBe(false);
    // Clamped to the segment ends: beyond (100,0) the distance grows.
    expect(hitsScriptStroke(point(103, 0), segment, 6)).toBe(true);
    expect(hitsScriptStroke(point(107, 0), segment, 6)).toBe(false);
  });

  it('hits a single point within the radius', () => {
    const single = [point(20, 30)];
    expect(hitsScriptStroke(point(23, 34), single, 6)).toBe(true);
    expect(hitsScriptStroke(point(30, 30), single, 6)).toBe(false);
  });

  it('never hits an empty polyline', () => {
    expect(hitsScriptStroke(point(0, 0), [], 6)).toBe(false);
  });

  it('pads bounds by max(6, size / 2)', () => {
    const points = [point(100, 100), point(200, 150)];
    expect(scriptStrokeBoundsPx(points, 20)).toEqual({
      x: 90,
      y: 90,
      width: 120,
      height: 70,
    });
    expect(scriptStrokeBoundsPx(points, 4)).toEqual({
      x: 94,
      y: 94,
      width: 112,
      height: 62,
    });
    expect(scriptStrokeBoundsPx([], 20)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('scriptStrokeEdition — keyboard consume law', () => {
  it('deleteSelectedScriptStroke refuses with no port, an inactive port, or no selection', () => {
    expect(deleteSelectedScriptStroke()).toBe(false);

    const inactive = calls();
    setScriptStrokeEditionPort(fakePort({ active: false, calls: inactive }));
    selectScriptStroke(5);
    expect(deleteSelectedScriptStroke()).toBe(false);
    expect(inactive.deleted).toEqual([]);

    const active = calls();
    setScriptStrokeEditionPort(fakePort({ active: true, calls: active }));
    clearScriptStrokeSelection();
    expect(deleteSelectedScriptStroke()).toBe(false);
    expect(active.deleted).toEqual([]);
  });

  it('deleteSelectedScriptStroke passes the WHOLE selection in one batch call', () => {
    const portCalls = calls();
    setScriptStrokeEditionPort(fakePort({ calls: portCalls }));
    setScriptStrokeSelection([7, 9]);

    expect(deleteSelectedScriptStroke()).toBe(true);
    expect(portCalls.deleted).toEqual([[7, 9]]);
    // Consumed even if the port's own operation refused internally.
    expect(deleteSelectedScriptStroke()).toBe(true);
    expect(portCalls.deleted).toEqual([[7, 9], [7, 9]]);
  });

  it('stepSelectedScriptStroke consumes a multi-selection without stepping anything', () => {
    expect(stepSelectedScriptStroke('back')).toBe(false);

    const inactive = calls();
    setScriptStrokeEditionPort(fakePort({ active: false, calls: inactive }));
    selectScriptStroke(2);
    expect(stepSelectedScriptStroke('forward')).toBe(false);
    expect(inactive.stepped).toEqual([]);

    const active = calls();
    setScriptStrokeEditionPort(fakePort({ active: true, calls: active }));
    clearScriptStrokeSelection();
    expect(stepSelectedScriptStroke('back')).toBe(false);
    expect(active.stepped).toEqual([]);

    // 2+ selected: the key is consumed, the port is never asked.
    setScriptStrokeSelection([4, 6]);
    expect(stepSelectedScriptStroke('back')).toBe(true);
    expect(active.stepped).toEqual([]);

    // Exactly one: the step is forwarded.
    setScriptStrokeSelection([4]);
    expect(stepSelectedScriptStroke('back')).toBe(true);
    expect(stepSelectedScriptStroke('forward')).toBe(true);
    expect(active.stepped).toEqual([
      { id: 4, direction: 'back' },
      { id: 4, direction: 'forward' },
    ]);
  });

  it('resolves the ACTIVE module port when both are registered', () => {
    const watercolorCalls = calls();
    const brushCalls = calls();
    setScriptStrokeEditionPorts({
      watercolor: fakePort({ active: false, calls: watercolorCalls }),
      brush: fakePort({ active: true, calls: brushCalls }),
    });
    setScriptStrokeSelection([7]);

    expect(deleteSelectedScriptStroke()).toBe(true);
    expect(brushCalls.deleted).toEqual([[7]]);
    expect(watercolorCalls.deleted).toEqual([]);

    // Neither surface active: the key is not consumed.
    setScriptStrokeEditionPorts({
      watercolor: fakePort({ active: false, calls: watercolorCalls }),
      brush: fakePort({ active: false, calls: brushCalls }),
    });
    expect(deleteSelectedScriptStroke()).toBe(false);

    // Both reporting active (defensive): watercolor is the deterministic winner.
    setScriptStrokeEditionPorts({
      watercolor: fakePort({ active: true, calls: watercolorCalls }),
      brush: fakePort({ active: true, calls: brushCalls }),
    });
    expect(deleteSelectedScriptStroke()).toBe(true);
    expect(watercolorCalls.deleted).toEqual([[7]]);
    expect(brushCalls.deleted).toEqual([[7]]);
  });
});

describe('scriptStrokeEdition — selectScriptStrokeAt modifiers', () => {
  it('replaces on a plain hit, toggles on an additive hit, and keeps on additive-empty', () => {
    let hit: number | null = 42;
    const port: ScriptStrokeEditionPort = {
      ...fakePort({ calls: calls() }),
      hitTestStroke: () => hit,
    };

    selectScriptStroke(7);
    expect(selectScriptStrokeAt(point(1, 1), 3, SIZE, port)).toBe(42);
    expect(selected()).toEqual([42]);

    hit = 9;
    expect(selectScriptStrokeAt(point(1, 1), 3, SIZE, port, true)).toBe(9);
    expect(selected()).toEqual([9, 42]);
    // Additive on an already-selected stroke toggles it off.
    expect(selectScriptStrokeAt(point(1, 1), 3, SIZE, port, true)).toBe(9);
    expect(selected()).toEqual([42]);

    // Plain-empty clears; additive-empty keeps.
    hit = null;
    expect(selectScriptStrokeAt(point(1, 1), 3, SIZE, port)).toBeNull();
    expect(selected()).toEqual([]);

    selectScriptStroke(7);
    expect(selectScriptStrokeAt(point(1, 1), 3, SIZE, port, true)).toBeNull();
    expect(selected()).toEqual([7]);
  });

  it('hit-tests through the port with the exact point, frame and size', () => {
    const port: ScriptStrokeEditionPort = {
      ...fakePort({ calls: calls() }),
      hitTestStroke: (pointPx, playFrame, size) => {
        expect(pointPx).toEqual(point(10, 20));
        expect(playFrame).toBe(3);
        expect(size).toEqual(SIZE);
        return 42;
      },
    };
    expect(selectScriptStrokeAt(point(10, 20), 3, SIZE, port)).toBe(42);
    expect(scriptSelectedStrokeId.value).toBe(42);
  });
});
