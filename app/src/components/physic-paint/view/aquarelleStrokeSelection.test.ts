// ============================================================
//  261022-pim Task 1 — watercolor stroke select mode.
//
//  Pure-module contract for the selectable recorded strokes:
//  UV → canvas pixel mapping through the ONE bridge, radius
//  hit-testing (newest wins), frame scope, deleted exclusion,
//  inflated bounds, and compare-then-write select mode.
//  No DOM, no Preact components.
// ============================================================

import { describe, expect, it } from 'vitest';
import { effect } from '@preact/signals';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  getRecordedAquarelleStroke,
  markAquarelleStrokeDeleted,
  recordAquarelleStroke,
  sendAquarelleStrokeBackwardInScript,
} from './aquarelleRecordState';
import {
  aquarelleSelectMode,
  aquarelleSelectedStrokeMutationIds,
  aquarelleStrokeBoundsPx,
  aquarelleStrokePointsPx,
  aquarelleStrokesOnFrame,
  beginAquarelleDeleteEdit,
  beginAquarelleTransformEdit,
  hitTestAquarelleStroke,
  listSelectableAquarelleStrokes,
  restoreAquarelleEditSnapshot,
  selectAquarelleStroke,
  setAquarelleSelectMode,
} from './aquarelleStrokeSelection';
import {
  clearScriptStrokeSelection,
  scriptSelectedStrokeIds,
  setScriptStrokeSelection,
} from './scriptStrokeEdition';

const SHEET = { width: 400, height: 200 };

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(options: {
  points: readonly AquarellePoint[];
  playFrame: number;
  size?: number;
}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: options.size ?? 12 },
    brushId: 'round',
    points: options.points,
    timestamp: 0,
    playFrame: options.playFrame,
  };
}

describe('261022-pim aquarelle stroke select mode', () => {
  it('maps UV points to canvas pixels through the one bridge', () => {
    const mapped = aquarelleStrokePointsPx(
      stroke({ points: [point(0.25, 0.75)], playFrame: 201 }),
      SHEET,
    );
    // uv y is UP: 0.75 → (1 - 0.75) * 200 = 50.
    expect(mapped).toEqual([{ x: 100, y: 50 }]);
  });

  it('hits a stroke within its brush radius and misses outside it', () => {
    recordAquarelleStroke(
      9001,
      stroke({ points: [point(0, 0.5), point(1, 0.5)], playFrame: 202, size: 20 }),
    );
    // uv y=0.5 → pixel y=100; radius = max(6, 20/2) = 10.
    expect(hitTestAquarelleStroke({ x: 200, y: 108 }, 202, SHEET)).toBe(9001);
    expect(hitTestAquarelleStroke({ x: 200, y: 140 }, 202, SHEET)).toBeNull();
  });

  it('newest wins when two strokes overlap', () => {
    recordAquarelleStroke(
      9002,
      stroke({ points: [point(0.2, 0.5), point(0.8, 0.5)], playFrame: 203, size: 40 }),
    );
    recordAquarelleStroke(
      9003,
      stroke({ points: [point(0.2, 0.5), point(0.8, 0.5)], playFrame: 203, size: 40 }),
    );
    expect(hitTestAquarelleStroke({ x: 200, y: 100 }, 203, SHEET)).toBe(9003);
  });

  it('deleted strokes are not selectable', () => {
    recordAquarelleStroke(
      9004,
      stroke({ points: [point(0.5, 0.5)], playFrame: 204, size: 40 }),
    );
    markAquarelleStrokeDeleted(9004);
    expect(hitTestAquarelleStroke({ x: 200, y: 100 }, 204, SHEET)).toBeNull();
    expect(
      listSelectableAquarelleStrokes(204, SHEET).some((entry) => entry.mutationId === 9004),
    ).toBe(false);
  });

  it('strokes of another playFrame are not selectable', () => {
    recordAquarelleStroke(
      9005,
      stroke({ points: [point(0.5, 0.5)], playFrame: 205, size: 40 }),
    );
    expect(hitTestAquarelleStroke({ x: 200, y: 100 }, 206, SHEET)).toBeNull();
    expect(
      listSelectableAquarelleStrokes(206, SHEET).some((entry) => entry.mutationId === 9005),
    ).toBe(false);
    // Frame 205 still owns it.
    expect(hitTestAquarelleStroke({ x: 200, y: 100 }, 205, SHEET)).toBe(9005);
  });

  it('bbox is inflated by half the brush size on each side', () => {
    const mapped = aquarelleStrokePointsPx(
      stroke({
        points: [point(0.25, 0.5), point(0.5, 0.25)],
        playFrame: 207,
        size: 20,
      }),
      SHEET,
    );
    // (100,100) and (200,150); pad = max(6, 20/2) = 10.
    expect(aquarelleStrokeBoundsPx(mapped, 20)).toEqual({
      x: 90,
      y: 90,
      width: 120,
      height: 70,
    });
  });

  it('decimates long polylines to at most 96 points', () => {
    const points: AquarellePoint[] = [];
    for (let index = 0; index < 300; index += 1) {
      points.push(point(index / 299, 0.5));
    }
    recordAquarelleStroke(9006, stroke({ points, playFrame: 208, size: 12 }));
    const entry = listSelectableAquarelleStrokes(208, SHEET).find(
      (candidate) => candidate.mutationId === 9006,
    );
    expect(entry).toBeDefined();
    expect(entry!.pointsPx.length).toBe(96);
  });

  it('badges carry a stable creation id and the position from the top', () => {
    recordAquarelleStroke(9301, stroke({ points: [point(0.1, 0.5)], playFrame: 301 }));
    recordAquarelleStroke(9302, stroke({ points: [point(0.2, 0.5)], playFrame: 301 }));

    expect(listSelectableAquarelleStrokes(301, SHEET).map((entry) => (
      [entry.mutationId, entry.serial, entry.stackPosition, entry.stackTotal]
    ))).toEqual([[9301, 1, 2, 2], [9302, 2, 1, 2]]);

    // Restacking changes only the stack position — the id is creation order.
    expect(sendAquarelleStrokeBackwardInScript(9302)).toBe(true);
    expect(listSelectableAquarelleStrokes(301, SHEET).map((entry) => (
      [entry.mutationId, entry.serial, entry.stackPosition, entry.stackTotal]
    ))).toEqual([[9301, 1, 1, 2], [9302, 2, 2, 2]]);

    // Deleting #1 leaves #2 on #2 — a number is a stable handle, never reused.
    markAquarelleStrokeDeleted(9301);
    expect(listSelectableAquarelleStrokes(301, SHEET).map((entry) => (
      [entry.mutationId, entry.serial, entry.stackPosition, entry.stackTotal]
    ))).toEqual([[9302, 2, 1, 1]]);
  });

  // 261024-mz5: one gesture edits the WHOLE selection; every id is filtered
  // to the current edit frame (recorded, non-deleted) before mutating.
  it('aquarelleStrokesOnFrame keeps only recorded, non-deleted strokes of the frame', () => {
    recordAquarelleStroke(9401, stroke({ points: [point(0.1, 0.5)], playFrame: 401 }));
    recordAquarelleStroke(9402, stroke({ points: [point(0.2, 0.5)], playFrame: 402 }));
    recordAquarelleStroke(9403, stroke({ points: [point(0.3, 0.5)], playFrame: 401 }));
    markAquarelleStrokeDeleted(9403);

    expect(aquarelleStrokesOnFrame([9401, 9402, 9403, 999999], 401)).toEqual([9401]);
    expect(aquarelleStrokesOnFrame([9401, 9402], 402)).toEqual([9402]);
    expect(aquarelleStrokesOnFrame([], 401)).toEqual([]);
  });

  it('the selected set is the shared signal by identity', () => {
    setScriptStrokeSelection([7, 9]);
    expect(aquarelleSelectedStrokeMutationIds).toBe(scriptSelectedStrokeIds);
    expect([...aquarelleSelectedStrokeMutationIds.value].sort()).toEqual([7, 9]);
    clearScriptStrokeSelection();
  });

  it('a batch delete removes the deleted ids from the selection and keeps survivors', () => {
    recordAquarelleStroke(9501, stroke({ points: [point(0.1, 0.5)], playFrame: 501 }));
    recordAquarelleStroke(9502, stroke({ points: [point(0.2, 0.5)], playFrame: 501 }));
    recordAquarelleStroke(9503, stroke({ points: [point(0.3, 0.5)], playFrame: 501 }));
    setScriptStrokeSelection([9501, 9502, 9503]);

    const editId = beginAquarelleDeleteEdit([9501, 9502]);
    expect(editId).not.toBeNull();
    expect([...scriptSelectedStrokeIds.value]).toEqual([9503]);
  });

  // 261024-mz5 Task 3: scale/rotate is ONE edit for the WHOLE selection —
  // undo restores both strokes by reference and the selection is kept.
  it('a multi-id transform edit restores both strokes on undo and keeps the selection', () => {
    recordAquarelleStroke(9601, stroke({ points: [point(0.1, 0.5)], playFrame: 601 }));
    recordAquarelleStroke(9602, stroke({ points: [point(0.2, 0.5)], playFrame: 601 }));
    const firstBefore = getRecordedAquarelleStroke(9601)!;
    const secondBefore = getRecordedAquarelleStroke(9602)!;
    setScriptStrokeSelection([9601, 9602]);

    const editId = beginAquarelleTransformEdit([9601, 9602], {
      kind: 'scale',
      centerUvX: 0.5,
      centerUvY: 0.5,
      angleRad: 0,
      factor: 2,
    });
    expect(editId).not.toBeNull();
    expect(getRecordedAquarelleStroke(9601)!.points[0]!.x).toBeCloseTo(-0.3, 12);
    // Every stroke still exists — the selection is kept.
    expect([...scriptSelectedStrokeIds.value].sort()).toEqual([9601, 9602]);

    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    expect(getRecordedAquarelleStroke(9601)).toBe(firstBefore);
    expect(getRecordedAquarelleStroke(9602)).toBe(secondBefore);
    expect(getRecordedAquarelleStroke(9601)!.points[0]!.x).toBe(0.1);
    clearScriptStrokeSelection();
  });

  it('setAquarelleSelectMode is compare-then-write', () => {
    let runs = 0;
    const dispose = effect(() => {
      void aquarelleSelectMode.value;
      runs += 1;
    });
    try {
      const before = runs;
      setAquarelleSelectMode(true);
      setAquarelleSelectMode(true);
      expect(runs).toBe(before + 1);
      setAquarelleSelectMode(false);
      expect(runs).toBe(before + 2);
      expect(aquarelleSelectMode.value).toBe(false);
    } finally {
      dispose();
      setAquarelleSelectMode(false);
      selectAquarelleStroke(null);
    }
  });
});
