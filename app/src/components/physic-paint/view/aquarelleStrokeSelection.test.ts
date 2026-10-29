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
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  isAquarelleDryEvent,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import { liftEngineSize, liftRadiusDoc } from '../roto/aquarelleLiftErase';
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
  AQUARELLE_STROKE_FILTER_DEFAULT,
  aquarelleScriptStrokeEditionPort,
  aquarelleSelectMode,
  aquarelleSelectedStrokeMutationIds,
  aquarelleStrokeBoundsPx,
  aquarelleStrokePointsPx,
  aquarelleStrokeSettingsDismissed,
  aquarelleStrokesOnFrame,
  aquarelleStrokeTypeFilter,
  beginAquarelleAppearanceEdit,
  beginAquarelleDeleteEdit,
  beginAquarelleTransformEdit,
  hitTestAquarelleStroke,
  listSelectableAquarelleStrokes,
  matchesAquarelleStrokeFilter,
  readAquarelleStrokeAppearance,
  restoreAquarelleEditSnapshot,
  selectAquarelleStroke,
  setAquarelleSelectMode,
  setAquarelleStrokeTypeFilter,
} from './aquarelleStrokeSelection';
import {
  MIN_STROKE_PAD_PX,
  clearScriptStrokeSelection,
  distanceToSegmentPx,
  scriptSelectedStrokeIds,
  setScriptStrokeSelection,
  type CanvasPoint,
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


// ============================================================
//  261029-eur — the stroke-type filter and the Edit choke point.
//
//  One filter signal narrows the LISTING and the HIT-TEST only
//  (never rendered artwork), the selection is pruned on every
//  filter change, and `setAquarelleSelectMode` is the single
//  entry/exit point that owns the filter reset and the one
//  Stroke Settings dismissal reset.
// ============================================================
describe('261029-eur stroke-type filter + Edit choke point', () => {
  /** A lift (eraser) stroke: the fixture's only difference is `tool`. */
  function liftStroke(options: Parameters<typeof stroke>[0]): AquarelleStroke {
    return { ...stroke(options), tool: 'lift' };
  }

  function listedIds(
    playFrame: number,
    filter?: Parameters<typeof listSelectableAquarelleStrokes>[2],
  ): number[] {
    return listSelectableAquarelleStrokes(playFrame, SHEET, filter).map(
      (entry) => entry.mutationId,
    );
  }

  it('labels every listing entry with its kind', () => {
    recordAquarelleStroke(10001, stroke({ points: [point(0.2, 0.5)], playFrame: 801 }));
    recordAquarelleStroke(10002, liftStroke({ points: [point(0.4, 0.5)], playFrame: 801 }));
    expect(
      listSelectableAquarelleStrokes(801, SHEET).map((entry) => [entry.mutationId, entry.kind]),
    ).toEqual([[10001, 'paint'], [10002, 'lift']]);
  });

  it('matchesAquarelleStrokeFilter is the one predicate (paint = not a lift)', () => {
    const paint = stroke({ points: [], playFrame: 801 });
    const lift = liftStroke({ points: [], playFrame: 801 });
    expect(matchesAquarelleStrokeFilter(paint, 'all')).toBe(true);
    expect(matchesAquarelleStrokeFilter(lift, 'all')).toBe(true);
    expect(matchesAquarelleStrokeFilter(paint, 'paint')).toBe(true);
    expect(matchesAquarelleStrokeFilter(lift, 'paint')).toBe(false);
    expect(matchesAquarelleStrokeFilter(lift, 'lift')).toBe(true);
    expect(matchesAquarelleStrokeFilter(paint, 'lift')).toBe(false);
  });

  it('setAquarelleSelectMode(true, "lift") enters lift filtering and an exit returns to Paint', () => {
    recordAquarelleStroke(10011, stroke({ points: [point(0.2, 0.5)], playFrame: 802 }));
    recordAquarelleStroke(10012, liftStroke({ points: [point(0.4, 0.5)], playFrame: 802 }));
    setAquarelleSelectMode(false);
    try {
      setAquarelleSelectMode(true, 'lift');
      expect(aquarelleSelectMode.value).toBe(true);
      expect(aquarelleStrokeTypeFilter.value).toBe('lift');
      expect(listedIds(802, aquarelleStrokeTypeFilter.value)).toEqual([10012]);

      setAquarelleSelectMode(false);
      expect(aquarelleSelectMode.value).toBe(false);
      expect(aquarelleStrokeTypeFilter.value).toBe('paint');
      expect(listedIds(802, aquarelleStrokeTypeFilter.value)).toEqual([10011]);
    } finally {
      setAquarelleSelectMode(false);
      clearScriptStrokeSelection();
    }
  });

  it('a plain entry (rail Select / Cmd tap) starts on the Paint filter', () => {
    recordAquarelleStroke(10013, stroke({ points: [point(0.2, 0.5)], playFrame: 806 }));
    recordAquarelleStroke(10014, liftStroke({ points: [point(0.4, 0.5)], playFrame: 806 }));
    setAquarelleStrokeTypeFilter('all');
    setAquarelleSelectMode(false);
    try {
      setAquarelleSelectMode(true);
      expect(aquarelleStrokeTypeFilter.value).toBe(AQUARELLE_STROKE_FILTER_DEFAULT);
      expect(aquarelleStrokeTypeFilter.value).toBe('paint');
      expect(listedIds(806, aquarelleStrokeTypeFilter.value)).toEqual([10013]);
    } finally {
      setAquarelleSelectMode(false);
      clearScriptStrokeSelection();
      setAquarelleStrokeTypeFilter('all');
    }
  });

  it('the filtered hit-test ignores the other kind under the same pointer', () => {
    // Both strokes share the exact same centerline, so the filter — not the
    // geometry — decides which id a pointer at (200, 100) resolves to.
    recordAquarelleStroke(10021, stroke({
      points: [point(0.2, 0.5), point(0.8, 0.5)],
      playFrame: 803,
      size: 40,
    }));
    recordAquarelleStroke(10022, liftStroke({
      points: [point(0.2, 0.5), point(0.8, 0.5)],
      playFrame: 803,
      size: 40,
    }));
    const probe = { x: 200, y: 100 };
    expect(hitTestAquarelleStroke(probe, 803, SHEET)).toBe(10022);
    expect(hitTestAquarelleStroke(probe, 803, SHEET, 'paint')).toBe(10021);
    expect(hitTestAquarelleStroke(probe, 803, SHEET, 'lift')).toBe(10022);
  });

  it('a re-entry while already ON with no filter resets to Paint and keeps select mode', () => {
    setAquarelleSelectMode(false);
    try {
      setAquarelleSelectMode(true, 'lift');
      expect(aquarelleStrokeTypeFilter.value).toBe('lift');
      // setScriptSelectMode early-returns here — the reset must already
      // have happened BEFORE the delegation, or it would be skipped.
      setAquarelleSelectMode(true);
      expect(aquarelleSelectMode.value).toBe(true);
      expect(aquarelleStrokeTypeFilter.value).toBe('paint');
    } finally {
      setAquarelleSelectMode(false);
      clearScriptStrokeSelection();
    }
  });

  it('a filter change prunes the selection both ways and keeps unjudgeable ids', () => {
    recordAquarelleStroke(10031, stroke({ points: [point(0.1, 0.5)], playFrame: 804 }));
    recordAquarelleStroke(10032, liftStroke({ points: [point(0.2, 0.5)], playFrame: 804 }));
    setAquarelleSelectMode(false);
    try {
      setAquarelleStrokeTypeFilter('all');
      setScriptStrokeSelection([10031, 10032]);
      setAquarelleStrokeTypeFilter('lift');
      expect([...aquarelleSelectedStrokeMutationIds.value]).toEqual([10032]);

      setAquarelleStrokeTypeFilter('paint');
      expect([...aquarelleSelectedStrokeMutationIds.value]).toEqual([]);

      // An id with no recorded entry is kept — nothing to judge here (the
      // delete paths already prune vanished strokes).
      setScriptStrokeSelection([123456]);
      setAquarelleStrokeTypeFilter('lift');
      expect([...aquarelleSelectedStrokeMutationIds.value]).toEqual([123456]);
    } finally {
      clearScriptStrokeSelection();
      setAquarelleStrokeTypeFilter('all');
    }
  });

  it('the filter setter is idempotent — 1000 identical writes notify zero times', () => {
    setAquarelleStrokeTypeFilter('all');
    let runs = 0;
    const dispose = effect(() => {
      void aquarelleStrokeTypeFilter.value;
      runs += 1;
    });
    try {
      const before = runs;
      for (let index = 0; index < 1000; index += 1) setAquarelleStrokeTypeFilter('all');
      expect(runs).toBe(before);
      setAquarelleStrokeTypeFilter('lift');
      expect(runs).toBe(before + 1);
    } finally {
      dispose();
      setAquarelleStrokeTypeFilter('all');
    }
  });

  it('the edition port lists and hits through the LIVE filter', () => {
    recordAquarelleStroke(10041, stroke({
      points: [point(0.2, 0.5), point(0.8, 0.5)],
      playFrame: 805,
      size: 40,
    }));
    recordAquarelleStroke(10042, liftStroke({
      points: [point(0.2, 0.5), point(0.8, 0.5)],
      playFrame: 805,
      size: 40,
    }));
    const probe = { x: 200, y: 100 };
    setAquarelleSelectMode(false);
    setAquarelleStrokeTypeFilter('all');
    try {
      expect(aquarelleScriptStrokeEditionPort.listStrokes(805, SHEET).map((entry) => entry.kind))
        .toEqual(['paint', 'lift']);
      expect(aquarelleScriptStrokeEditionPort.hitTestStroke(probe, 805, SHEET)).toBe(10042);

      setAquarelleStrokeTypeFilter('paint');
      expect(aquarelleScriptStrokeEditionPort.listStrokes(805, SHEET).map((entry) => entry.mutationId))
        .toEqual([10041]);
      expect(aquarelleScriptStrokeEditionPort.hitTestStroke(probe, 805, SHEET)).toBe(10041);
    } finally {
      setAquarelleStrokeTypeFilter('all');
      clearScriptStrokeSelection();
    }
  });

  it('clears the Stroke Settings dismissal flag only on an off -> on select-mode edge', () => {
    setAquarelleSelectMode(false);
    try {
      // A genuine off -> on entry clears it (compare-then-write).
      aquarelleStrokeSettingsDismissed.value = true;
      setAquarelleSelectMode(true);
      expect(aquarelleStrokeSettingsDismissed.value).toBe(false);

      // An already-ON session is NOT an exit/re-enter edge: strict.
      aquarelleStrokeSettingsDismissed.value = true;
      setAquarelleSelectMode(true);
      expect(aquarelleStrokeSettingsDismissed.value).toBe(true);

      // Leaving never clears it either — only the next entry does.
      setAquarelleSelectMode(false);
      expect(aquarelleStrokeSettingsDismissed.value).toBe(true);
      setAquarelleSelectMode(true);
      expect(aquarelleStrokeSettingsDismissed.value).toBe(false);
    } finally {
      aquarelleStrokeSettingsDismissed.value = false;
      setAquarelleSelectMode(false);
      clearScriptStrokeSelection();
    }
  });
});

describe('261029-eur lift ribbon listing (LIFT-RIBBON)', () => {
  /** An aspect-2 (wide) lift: the wide side reaches 2R, past the bare radius. */
  function wideLift(options: Parameters<typeof stroke>[0]): AquarelleStroke {
    return {
      ...stroke(options),
      tool: 'lift',
      toolOverrides: { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 },
    };
  }

  function distanceToPolyline(point: CanvasPoint, polyline: readonly CanvasPoint[]): number {
    if (polyline.length === 1) {
      return Math.hypot(point.x - polyline[0]!.x, point.y - polyline[0]!.y);
    }
    let best = Infinity;
    for (let index = 1; index < polyline.length; index += 1) {
      best = Math.min(
        best,
        distanceToSegmentPx(point.x, point.y, polyline[index - 1]!, polyline[index]!),
      );
    }
    return best;
  }

  it('fills a polygon ribbon, the maximum-support hit radius and polygon bounds on a lift', () => {
    const recorded = wideLift({
      points: [point(0.2, 0.5), point(0.5, 0.5), point(0.8, 0.5)],
      playFrame: 806,
      size: 40,
    });
    recordAquarelleStroke(10051, recorded);
    const entry = listSelectableAquarelleStrokes(806, SHEET).find(
      (candidate) => candidate.mutationId === 10051,
    );
    expect(entry).toBeDefined();
    expect(entry!.kind).toBe('lift');
    expect(entry!.ribbonPx).toBeDefined();
    expect(entry!.ribbonPx!.length).toBeGreaterThan(2);
    expect(entry!.hitRadiusPx).toBeGreaterThanOrEqual(MIN_STROKE_PAD_PX);

    // No drawn vertex escapes the click target: every edge/cap point sits at
    // most `hitRadiusPx` off the centerline (caps included).
    const centerline = aquarelleStrokePointsPx(recorded, SHEET);
    for (const vertex of entry!.ribbonPx!) {
      expect(distanceToPolyline(vertex, centerline)).toBeLessThanOrEqual(
        entry!.hitRadiusPx! + 1e-6,
      );
    }

    // An aspect > 1 tip reaches aspect * R on its wide side.
    const radiusPx = liftRadiusDoc(1, liftEngineSize(recorded.params)) * SHEET.height;
    expect(entry!.hitRadiusPx).toBeCloseTo(radiusPx * 2, 6);

    // Bounds = the polygon's EXACT bbox + the shared 6px grab margin.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const vertex of entry!.ribbonPx!) {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
    }
    expect(entry!.bounds.x).toBeCloseTo(minX - MIN_STROKE_PAD_PX, 9);
    expect(entry!.bounds.y).toBeCloseTo(minY - MIN_STROKE_PAD_PX, 9);
    expect(entry!.bounds.width).toBeCloseTo(maxX - minX + MIN_STROKE_PAD_PX * 2, 9);
    expect(entry!.bounds.height).toBeCloseTo(maxY - minY + MIN_STROKE_PAD_PX * 2, 9);
  });

  it('leaves paint entries on the legacy bounds with no ribbon fields', () => {
    const recorded = stroke({
      points: [point(0.2, 0.5), point(0.8, 0.5)],
      playFrame: 807,
      size: 40,
    });
    recordAquarelleStroke(10052, recorded);
    const entry = listSelectableAquarelleStrokes(807, SHEET).find(
      (candidate) => candidate.mutationId === 10052,
    );
    expect(entry).toBeDefined();
    expect(entry!.kind).toBe('paint');
    expect(entry!.ribbonPx).toBeUndefined();
    expect(entry!.hitRadiusPx).toBeUndefined();
    expect(entry!.bounds).toEqual(
      aquarelleStrokeBoundsPx(aquarelleStrokePointsPx(recorded, SHEET), 40),
    );
  });

  it('hit-tests a lift through the band maximum support, not the declared half-size', () => {
    const recorded = wideLift({
      points: [point(0.2, 0.5), point(0.8, 0.5)],
      playFrame: 808,
      size: 40,
    });
    recordAquarelleStroke(10053, recorded);
    const radiusPx = liftRadiusDoc(1, liftEngineSize(recorded.params)) * SHEET.height;
    const declaredHalfSize = 20;
    // 40 px off a 40 px stroke: outside today's paint law, inside the wide side.
    const wideProbe = { x: 200, y: 100 + declaredHalfSize + 20 };
    expect(wideProbe.y - 100).toBeGreaterThan(declaredHalfSize);
    expect(wideProbe.y - 100).toBeLessThan(radiusPx * 2);
    expect(hitTestAquarelleStroke(wideProbe, 808, SHEET, 'lift')).toBe(10053);
    // One pixel past the band's maximum support misses.
    expect(
      hitTestAquarelleStroke({ x: 200, y: 100 + radiusPx * 2 + 1 }, 808, SHEET, 'lift'),
    ).toBeNull();
  });
});
