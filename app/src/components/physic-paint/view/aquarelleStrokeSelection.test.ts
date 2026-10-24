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
import {
  isAquarelleDryEvent,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  bumpAquarelleStrokesRevision,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  markAquarelleStrokeDeleted,
  recordAquarelleStroke,
  sendAquarelleStrokeBackwardInScript,
  updateAquarelleStrokesInScript,
} from './aquarelleRecordState';
import {
  aquarelleSelectMode,
  aquarelleSelectedStrokeMutationIds,
  aquarelleStrokeBoundsPx,
  aquarelleStrokePointsPx,
  aquarelleStrokesOnFrame,
  beginAquarelleAppearanceEdit,
  beginAquarelleDeleteEdit,
  beginAquarelleTransformEdit,
  hitTestAquarelleStroke,
  listSelectableAquarelleStrokes,
  readAquarelleStrokeAppearance,
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
  timestamp?: number;
  diffusionFrames?: number;
  color?: string | null;
}): AquarelleStroke {
  return {
    tool: 'brush',
    color: options.color === undefined ? '#103c65' : options.color,
    params: { size: options.size ?? 12 },
    brushId: 'round',
    points: options.points,
    timestamp: options.timestamp ?? 0,
    ...(options.diffusionFrames !== undefined
      ? { diffusionFrames: options.diffusionFrames }
      : {}),
    playFrame: options.playFrame,
  };
}

type StrokeEvent = Exclude<AquarellePayloadEvent, { kind: 'dry' }>;

function entryIndexOf(events: readonly AquarellePayloadEvent[], mutationId: number): number {
  return events.findIndex(
    (event) => !isAquarelleDryEvent(event) && event.engine.mutationId === mutationId,
  );
}

function strokeEntryAt(
  events: readonly AquarellePayloadEvent[],
  mutationId: number,
): StrokeEvent {
  const index = entryIndexOf(events, mutationId);
  expect(index, `timeline entry for ${mutationId}`).toBeGreaterThanOrEqual(0);
  const event = events[index]!;
  expect(isAquarelleDryEvent(event)).toBe(false);
  return event as StrokeEvent;
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
      anchorUvX: 0.5,
      anchorUvY: 0.5,
      angleRad: 0,
      scaleX: 2,
      scaleY: 2,
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

// ============================================================
//  261024-p5q Task 2 — per-stroke appearance edits.
//
//  The Paint section writes canonical params/color to every
//  selected stroke as ONE in-memory script edit: objects are
//  REPLACED (never mutated), the regenerated timeline entry
//  lands on the SAME index, and the revision bumps once. A
//  failed re-bake restores the snapshot pair exactly.
// ============================================================

describe('261024-p5q watercolor appearance edits', () => {
  it('replaces strokes and timeline entries at the same indexes with one revision bump', () => {
    recordAquarelleStroke(9701, stroke({
      points: [point(0.1, 0.4), point(0.3, 0.6)],
      playFrame: 701,
      size: 12,
      timestamp: 10,
      diffusionFrames: 42,
    }));
    recordAquarelleStroke(9702, stroke({
      points: [point(0.5, 0.5)],
      playFrame: 701,
      size: 20,
      timestamp: 20,
    }));
    recordAquarelleStroke(9703, stroke({
      points: [point(0.7, 0.5)],
      playFrame: 701,
      size: 30,
      timestamp: 30,
    }));

    const eventsBefore = [...getRecordedAquarellePayloadTimeline()];
    const firstIndex = entryIndexOf(eventsBefore, 9701);
    const secondIndex = entryIndexOf(eventsBefore, 9702);
    const firstEntryBefore = strokeEntryAt(eventsBefore, 9701);
    const secondEntryBefore = strokeEntryAt(eventsBefore, 9702);
    const thirdEntryBefore = strokeEntryAt(eventsBefore, 9703);
    const firstPointsBefore = getRecordedAquarelleStroke(9701)!.points;

    const revisionBefore = aquarelleStrokesRevision.value;
    expect(updateAquarelleStrokesInScript([9701, 9702], { params: { load: 70 } })).toBe(2);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);

    const firstStroke = getRecordedAquarelleStroke(9701)!;
    expect(firstStroke.params).toEqual({ size: 12, load: 70 });
    // Everything else on the stroke survives: points, measured cuisson, order.
    expect(firstStroke.points).toEqual(firstPointsBefore);
    expect(firstStroke.diffusionFrames).toBe(42);
    expect(firstStroke.timestamp).toBe(10);

    const eventsAfter = getRecordedAquarellePayloadTimeline();
    expect(eventsAfter).toHaveLength(eventsBefore.length);
    // The regenerated entry lands on the SAME index (replay order preserved).
    const firstEntryAfter = eventsAfter[firstIndex]!;
    expect(isAquarelleDryEvent(firstEntryAfter)).toBe(false);
    const firstStrokeEntryAfter = firstEntryAfter as StrokeEvent;
    expect(firstStrokeEntryAfter.engine.mutationId).toBe(9701);
    expect(firstStrokeEntryAfter.engine.params).toEqual({ size: 12, load: 70 });
    // cuisson is re-derived from the preserved measured diffusionFrames.
    expect(firstStrokeEntryAfter.cuisson).toBe(42);
    expect(firstStrokeEntryAfter.ticks).toBe(1);
    expect(firstStrokeEntryAfter.recordedOrder).toBe(10);
    expect(firstStrokeEntryAfter.pts).toEqual(firstEntryBefore.pts);

    const secondEntryAfter = eventsAfter[secondIndex]!;
    expect(isAquarelleDryEvent(secondEntryAfter)).toBe(false);
    expect((secondEntryAfter as StrokeEvent).engine.params).toEqual({ size: 20, load: 70 });
    expect((secondEntryAfter as StrokeEvent).ticks).toBe(1);

    // Untouched neighbour stays put by reference (no wholesale rebuild).
    expect(eventsAfter[entryIndexOf(eventsAfter, 9703)]).toBe(thirdEntryBefore);
    expect(secondEntryBefore).not.toBe(secondEntryAfter);
  });

  it('a colour patch writes the stroke and both entry colour slots', () => {
    recordAquarelleStroke(9704, stroke({ points: [point(0.5, 0.5)], playFrame: 702 }));
    expect(updateAquarelleStrokesInScript([9704], { color: '#ff0000' })).toBe(1);

    expect(getRecordedAquarelleStroke(9704)!.color).toBe('#ff0000');
    const entry = strokeEntryAt(getRecordedAquarellePayloadTimeline(), 9704);
    expect(entry.color).toBe('#ff0000');
    expect(entry.engine.color).toBe('#ff0000');
    // Params are untouched by a colour-only patch.
    expect(entry.engine.params).toEqual({ size: 12 });
  });

  it('unknown, deleted and unchanged targets are refused without a bump', () => {
    recordAquarelleStroke(9705, stroke({ points: [point(0.1, 0.5)], playFrame: 703, size: 12 }));
    recordAquarelleStroke(9706, stroke({ points: [point(0.2, 0.5)], playFrame: 703, size: 12 }));
    markAquarelleStrokeDeleted(9706);
    const revisionBefore = aquarelleStrokesRevision.value;

    expect(updateAquarelleStrokesInScript([999999], { params: { load: 70 } })).toBe(0);
    expect(updateAquarelleStrokesInScript([9706], { params: { load: 70 } })).toBe(0);
    // No-op params, no data at all and malformed data are all refused before mutating.
    expect(updateAquarelleStrokesInScript([9705], { params: { size: 12 } })).toBe(0);
    expect(updateAquarelleStrokesInScript([9705], {})).toBe(0);
    expect(updateAquarelleStrokesInScript([9705], { params: {} })).toBe(0);
    expect(updateAquarelleStrokesInScript([9705], { params: { load: Number.NaN } })).toBe(0);
    expect(updateAquarelleStrokesInScript([9705], { params: { notCanonical: 1 } })).toBe(0);
    expect(updateAquarelleStrokesInScript([9705], { color: '' })).toBe(0);
    expect(updateAquarelleStrokesInScript([], { color: '#00ff00' })).toBe(0);

    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
    expect(getRecordedAquarelleStroke(9705)!.params).toEqual({ size: 12 });
  });

  it('one appearance edit is one undo step that restores the pre-edit objects by reference', () => {
    recordAquarelleStroke(9707, stroke({ points: [point(0.1, 0.5)], playFrame: 704, size: 12 }));
    recordAquarelleStroke(9708, stroke({ points: [point(0.2, 0.5)], playFrame: 704, size: 12 }));
    const firstBefore = getRecordedAquarelleStroke(9707)!;
    const secondBefore = getRecordedAquarelleStroke(9708)!;
    const firstEntryBefore = strokeEntryAt(getRecordedAquarellePayloadTimeline(), 9707);
    setScriptStrokeSelection([9707, 9708]);

    const editId = beginAquarelleAppearanceEdit([9707, 9708], { params: { load: 70 } });
    expect(editId).not.toBeNull();
    // Object replacement, never in-place mutation.
    expect(getRecordedAquarelleStroke(9707)).not.toBe(firstBefore);
    expect(firstBefore.params).toEqual({ size: 12 });
    expect(getRecordedAquarelleStroke(9707)!.params.load).toBe(70);
    expect(getRecordedAquarelleStroke(9708)!.params.load).toBe(70);
    // Every stroke still exists — the selection is kept.
    expect([...scriptSelectedStrokeIds.value].sort()).toEqual([9707, 9708]);

    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    expect(getRecordedAquarelleStroke(9707)).toBe(firstBefore);
    expect(getRecordedAquarelleStroke(9708)).toBe(secondBefore);
    expect(strokeEntryAt(getRecordedAquarellePayloadTimeline(), 9707)).toBe(firstEntryBefore);
    clearScriptStrokeSelection();
  });

  it('a zero-change or empty appearance edit stores no edit', () => {
    recordAquarelleStroke(9709, stroke({ points: [point(0.3, 0.5)], playFrame: 705, size: 12 }));
    const revisionBefore = aquarelleStrokesRevision.value;
    expect(beginAquarelleAppearanceEdit([9709], { params: { size: 12 } })).toBeNull();
    expect(beginAquarelleAppearanceEdit([], { params: { size: 20 } })).toBeNull();
    expect(beginAquarelleAppearanceEdit([9709], {})).toBeNull();
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
  });

  it('readAquarelleStrokeAppearance keeps caller order and drops other-frame/deleted ids', () => {
    recordAquarelleStroke(9710, stroke({ points: [point(0.1, 0.5)], playFrame: 706, color: '#123456' }));
    recordAquarelleStroke(9711, stroke({ points: [point(0.1, 0.5)], playFrame: 707, color: '#abcdef' }));
    recordAquarelleStroke(9712, stroke({ points: [point(0.1, 0.5)], playFrame: 706, color: '#00ff00' }));
    recordAquarelleStroke(9713, stroke({ points: [point(0.1, 0.5)], playFrame: 706, color: null }));
    markAquarelleStrokeDeleted(9712);

    expect(readAquarelleStrokeAppearance([9713, 9710, 9711, 9712, 999999], 706)).toEqual([
      { mutationId: 9713, params: { size: 12 }, color: null },
      { mutationId: 9710, params: { size: 12 }, color: '#123456' },
    ]);
    // Params are copied — a caller can never mutate the registry.
    const [row] = readAquarelleStrokeAppearance([9710], 706);
    expect(row!.params).not.toBe(getRecordedAquarelleStroke(9710)!.params);
  });

  it('readAquarelleStrokeAppearance re-reads on a stroke revision bump', () => {
    recordAquarelleStroke(9714, stroke({ points: [point(0.1, 0.5)], playFrame: 708 }));
    let runs = 0;
    const dispose = effect(() => {
      readAquarelleStrokeAppearance([9714], 708);
      runs += 1;
    });
    try {
      const before = runs;
      bumpAquarelleStrokesRevision();
      expect(runs).toBe(before + 1);
    } finally {
      dispose();
    }
  });
});
