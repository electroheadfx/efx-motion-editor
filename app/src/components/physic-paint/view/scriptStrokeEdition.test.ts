// ============================================================
//  scriptStrokeEdition.test.ts — the shared script-edition seam
//  (quick 261023-g4p Task 2).
//
//  One selection/drag state and one gesture geometry serve both
//  the watercolor module and the brush Move surface. The
//  watercolor module must alias these signals by identity so its
//  existing consumers can never diverge from the shared state.
//
//  The keyboard consume law: a key is consumed exactly once a
//  registered port reports active AND a stroke is selected —
//  even when the port's operation refuses internally.
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
  deleteSelectedScriptStroke,
  hitsScriptStroke,
  scriptSelectedStrokeId,
  scriptSelectMode,
  scriptStrokeBoundsPx,
  scriptStrokeDrag,
  selectScriptStroke,
  selectScriptStrokeAt,
  setScriptSelectMode,
  setScriptStrokeDrag,
  setScriptStrokeEditionPort,
  stepSelectedScriptStroke,
  type CanvasPoint,
  type ScriptStrokeEditionPort,
  type SelectableScriptStroke,
} from './scriptStrokeEdition';

const SIZE = { width: 400, height: 200 };

function point(x: number, y: number): CanvasPoint {
  return { x, y };
}

interface PortCalls {
  deleted: number[];
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
    deleteStroke: (id) => {
      options.calls.deleted.push(id);
    },
    moveStroke: () => {},
    stepStroke: (id, direction) => {
      options.calls.stepped.push({ id, direction });
    },
  };
}

function calls(): PortCalls {
  return { deleted: [], stepped: [] };
}

afterEach(() => {
  setScriptStrokeEditionPort(null);
  selectScriptStroke(null);
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

  it('is compare-then-write on the selected id', () => {
    let runs = 0;
    const dispose = effect(() => {
      void scriptSelectedStrokeId.value;
      runs += 1;
    });
    try {
      const before = runs;
      selectScriptStroke(7);
      selectScriptStroke(7);
      expect(runs).toBe(before + 1);
      selectScriptStroke(null);
      selectScriptStroke(null);
      expect(runs).toBe(before + 2);
    } finally {
      dispose();
    }
  });

  it('is compare-then-write on all three drag fields', () => {
    let runs = 0;
    const dispose = effect(() => {
      void scriptStrokeDrag.value;
      runs += 1;
    });
    try {
      const before = runs;
      setScriptStrokeDrag({ mutationId: 3, dxPx: 2, dyPx: 4 });
      setScriptStrokeDrag({ mutationId: 3, dxPx: 2, dyPx: 4 });
      expect(runs).toBe(before + 1);
      setScriptStrokeDrag({ mutationId: 3, dxPx: 2, dyPx: 5 });
      setScriptStrokeDrag({ mutationId: 3, dxPx: 3, dyPx: 5 });
      setScriptStrokeDrag({ mutationId: 4, dxPx: 3, dyPx: 5 });
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
    setScriptStrokeDrag({ mutationId: 11, dxPx: 5, dyPx: 6 });

    setScriptSelectMode(false);

    expect(scriptSelectedStrokeId.value).toBeNull();
    expect(scriptStrokeDrag.value).toBeNull();
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
    selectScriptStroke(null);
    expect(deleteSelectedScriptStroke()).toBe(false);
    expect(active.deleted).toEqual([]);
  });

  it('deleteSelectedScriptStroke calls the port once and consumes the key', () => {
    const portCalls = calls();
    setScriptStrokeEditionPort(fakePort({ calls: portCalls }));
    selectScriptStroke(9);

    expect(deleteSelectedScriptStroke()).toBe(true);
    expect(portCalls.deleted).toEqual([9]);
    // Consumed even if the port's own operation refused internally.
    expect(deleteSelectedScriptStroke()).toBe(true);
    expect(portCalls.deleted).toEqual([9, 9]);
  });

  it('stepSelectedScriptStroke follows the same consume law and forwards the direction', () => {
    expect(stepSelectedScriptStroke('back')).toBe(false);

    const inactive = calls();
    setScriptStrokeEditionPort(fakePort({ active: false, calls: inactive }));
    selectScriptStroke(2);
    expect(stepSelectedScriptStroke('forward')).toBe(false);
    expect(inactive.stepped).toEqual([]);

    const active = calls();
    setScriptStrokeEditionPort(fakePort({ active: true, calls: active }));
    selectScriptStroke(null);
    expect(stepSelectedScriptStroke('back')).toBe(false);
    expect(active.stepped).toEqual([]);

    selectScriptStroke(4);
    expect(stepSelectedScriptStroke('back')).toBe(true);
    expect(stepSelectedScriptStroke('forward')).toBe(true);
    expect(active.stepped).toEqual([
      { id: 4, direction: 'back' },
      { id: 4, direction: 'forward' },
    ]);
  });
});

describe('scriptStrokeEdition — selectScriptStrokeAt', () => {
  it('hit-tests through the port, writes the selection, and returns the hit', () => {
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
