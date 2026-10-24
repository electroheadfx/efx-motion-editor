// ============================================================
//  261022-tv1 Task 1 — drag a recorded Water color stroke.
//
//  A move replaces the stroke + its payload-timeline entry
//  (never mutates them in place): the before/after snapshots hold
//  the live object references, so undo can only restore the
//  origin if the moved side is a NEW object at the SAME index.
//  The registry and the timeline are always captured and
//  restored together.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { effect } from '@preact/signals';
import {
  toStudioStroke as aquarelleToStudioStroke,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
  type AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokeSerial,
  aquarelleStrokesRevision,
  deleteAquarelleStrokeFromScript,
  deleteAquarelleStrokesFromScript,
  emitAquarelleDry,
  getAquarelleEventsForFrame,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  isAquarelleStrokeDeleted,
  markAquarelleStrokeDeleted,
  recordAquarelleStroke,
  remapAquarelleScriptsForRecords,
  resetAquarelleRecordState,
  translateAquarelleStrokeInScript,
  translateAquarelleStrokesInScript,
} from './aquarelleRecordState';
import {
  aquarelleStrokeDrag,
  beginAquarelleMoveEdit,
  clearAquarelleStrokeDrag,
  isAquarelleDeleteInFlight,
  isAquarelleScriptEditInFlight,
  restoreAquarelleEditSnapshot,
  restoreAquarelleSnapshotRaw,
  setAquarelleScriptEditInFlight,
  setAquarelleSelectMode,
  setAquarelleStrokeDrag,
} from './aquarelleStrokeSelection';

type AquarelleTimelineStroke = ReturnType<typeof aquarelleToStudioStroke>;

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(mutationId: number, playFrame = 501): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: 'round',
    points: [point(0.1, 0.5), point(0.2, 0.5)],
    mutationId,
    timestamp: mutationId,
    playFrame,
  };
}

/** Read one payload-timeline entry, narrowed to the stroke union member. */
function timelineStrokeAt(index: number): AquarelleTimelineStroke {
  const event: AquarellePayloadEvent | undefined =
    getRecordedAquarellePayloadTimeline()[index];
  if (!event || 'kind' in event) {
    throw new Error(`expected a stroke event at timeline index ${index}`);
  }
  return event;
}

function timelineStrokeCount(): number {
  return getRecordedAquarellePayloadTimeline().length;
}

function strokeIdsOfFrame(playFrame: number): number[] {
  return getAquarelleEventsForFrame(playFrame).flatMap((event) =>
    'kind' in event ? [] : [(event.engine as { mutationId?: number }).mutationId ?? -1],
  );
}

/** The one timeline entry projecting a stroke identity (the registry's object). */
function findStrokeEntry(mutationId: number): AquarelleTimelineStroke | undefined {
  return getRecordedAquarellePayloadTimeline().find(
    (event): event is AquarelleTimelineStroke =>
      !('kind' in event)
      && (event.engine as { mutationId?: number }).mutationId === mutationId,
  );
}

describe('261022-tv1 aquarelle stroke translate', () => {
  it('translate moves every stroke point and its timeline entry pts', () => {
    const id = 8101;
    recordAquarelleStroke(id, stroke(id, 501));
    const originalIndex = timelineStrokeCount() - 1;
    const originalEntry = timelineStrokeAt(originalIndex);
    const revisionBefore = aquarelleStrokesRevision.value;

    expect(translateAquarelleStrokeInScript(id, 0.05, -0.1)).toBe(true);

    const moved = getRecordedAquarelleStroke(id)!;
    expect(moved).toBeDefined();
    expect(moved.points).toHaveLength(2);
    expect(moved.points[0]!.x).toBeCloseTo(0.15, 12);
    expect(moved.points[0]!.y).toBeCloseTo(0.4, 12);
    expect(moved.points[1]!.x).toBeCloseTo(0.25, 12);
    expect(moved.points[1]!.y).toBeCloseTo(0.4, 12);

    const movedEntry = timelineStrokeAt(originalIndex);
    expect(movedEntry).not.toBe(originalEntry);
    expect(movedEntry.pts).toHaveLength(2);
    expect(movedEntry.pts[0]!.x).toBeCloseTo(0.15, 12);
    expect(movedEntry.pts[0]!.y).toBeCloseTo(0.4, 12);
    expect(movedEntry.pts[1]!.x).toBeCloseTo(0.25, 12);
    expect(movedEntry.pts[1]!.y).toBeCloseTo(0.4, 12);

    // Everything that is not a coordinate survives the translation untouched.
    expect(movedEntry.ticks).toBe(originalEntry.ticks);
    expect(movedEntry.recordedOrder).toBe(originalEntry.recordedOrder);
    expect(movedEntry.playFrame).toBe(originalEntry.playFrame);
    expect(movedEntry.traceSeed).toBe(originalEntry.traceSeed);
    expect(movedEntry.cuisson).toBe(originalEntry.cuisson);
    expect(movedEntry.brushId).toBe(originalEntry.brushId);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);
  });

  it('refuses unknown, deleted, zero, and non-finite deltas', () => {
    const id = 8102;
    recordAquarelleStroke(id, stroke(id, 502));
    const revision = aquarelleStrokesRevision.value;
    const timelineSnapshot = [...getRecordedAquarellePayloadTimeline()];

    // Unknown id.
    expect(translateAquarelleStrokeInScript(999999, 0.01, 0.01)).toBe(false);
    // Zero and non-finite deltas on a live stroke.
    expect(translateAquarelleStrokeInScript(id, 0, 0)).toBe(false);
    expect(translateAquarelleStrokeInScript(id, Number.NaN, 0.01)).toBe(false);
    expect(translateAquarelleStrokeInScript(id, 0.01, Number.POSITIVE_INFINITY)).toBe(false);

    // None of the refusals above touched the revision or the timeline.
    expect(aquarelleStrokesRevision.value).toBe(revision);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineSnapshot);

    // Deleted stroke.
    expect(deleteAquarelleStrokeFromScript(id)).toBe(true);
    const revisionAfterDelete = aquarelleStrokesRevision.value;
    const timelineAfterDelete = [...getRecordedAquarellePayloadTimeline()];
    expect(translateAquarelleStrokeInScript(id, 0.01, 0.01)).toBe(false);
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterDelete);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineAfterDelete);
  });
});

// One move is one edit: the before side holds the ORIGINAL stroke/entry
// references, the after side the moved ones. Undo/redo swap by reference.
describe('261022-tv1 aquarelle move edit snapshots', () => {
  it('a move edit restores the origin by reference on undo', () => {
    const id = 8201;
    recordAquarelleStroke(id, stroke(id, 503));
    const originalIndex = timelineStrokeCount() - 1;
    const originalEntry = timelineStrokeAt(originalIndex);
    const originalStroke = getRecordedAquarelleStroke(id)!;

    const editId = beginAquarelleMoveEdit(id, 0.05, -0.1);
    expect(editId).not.toBeNull();

    const movedStroke = getRecordedAquarelleStroke(id)!;
    const movedEntry = timelineStrokeAt(originalIndex);
    expect(movedStroke).not.toBe(originalStroke);
    expect(movedEntry).not.toBe(originalEntry);
    expect(movedStroke.points[0]!.x).toBeCloseTo(0.15, 12);

    const revert = restoreAquarelleEditSnapshot(editId!, 'undo');
    expect(revert).not.toBeNull();
    expect(getRecordedAquarelleStroke(id)).toBe(originalStroke);
    expect(timelineStrokeAt(originalIndex)).toBe(originalEntry);
    expect(getRecordedAquarelleStroke(id)!.points[0]!.x).toBeCloseTo(0.1, 12);
    expect(getRecordedAquarelleStroke(id)!.points[1]!.x).toBeCloseTo(0.2, 12);
  });

  it('redo re-applies the moved side', () => {
    const id = 8202;
    recordAquarelleStroke(id, stroke(id, 504));
    const originalIndex = timelineStrokeCount() - 1;
    const originalEntry = timelineStrokeAt(originalIndex);

    const editId = beginAquarelleMoveEdit(id, 0.02, 0.03);
    expect(editId).not.toBeNull();
    const movedStroke = getRecordedAquarelleStroke(id)!;
    const movedEntry = timelineStrokeAt(originalIndex);
    expect(movedEntry).not.toBe(originalEntry);

    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    expect(getRecordedAquarelleStroke(id)).not.toBe(movedStroke);
    expect(timelineStrokeAt(originalIndex)).toBe(originalEntry);

    expect(restoreAquarelleEditSnapshot(editId!, 'redo')).not.toBeNull();
    expect(getRecordedAquarelleStroke(id)).toBe(movedStroke);
    expect(timelineStrokeAt(originalIndex)).toBe(movedEntry);
    expect(getRecordedAquarelleStroke(id)!.points[0]!.x).toBeCloseTo(0.12, 12);
    expect(getRecordedAquarelleStroke(id)!.points[0]!.y).toBeCloseTo(0.53, 12);
  });

  it('a stale snapshot is refused', () => {
    const id = 8301;
    recordAquarelleStroke(id, stroke(id, 505));
    const originalIndex = timelineStrokeCount() - 1;
    const editId = beginAquarelleMoveEdit(id, 0.01, 0.01);
    expect(editId).not.toBeNull();

    // A newer recorded stroke moves the script revision past the edit's after
    // side — the stale undo must fail closed and change nothing.
    recordAquarelleStroke(8302, stroke(8302, 505));
    const revisionAfterNewStroke = aquarelleStrokesRevision.value;
    const timelineAfterNewStroke = [...getRecordedAquarellePayloadTimeline()];
    const strokeAfterNewStroke = getRecordedAquarelleStroke(id);

    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).toBeNull();
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterNewStroke);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineAfterNewStroke);
    expect(getRecordedAquarelleStroke(id)).toBe(strokeAfterNewStroke);
    expect(timelineStrokeAt(originalIndex)).not.toBe(undefined);
  });

  it('a failed re-bake rollback restores the pre-move script', () => {
    const id = 8401;
    recordAquarelleStroke(id, stroke(id, 506));
    const index = timelineStrokeCount() - 1;
    const editId = beginAquarelleMoveEdit(id, 0.04, 0.04);
    expect(editId).not.toBeNull();
    const movedStroke = getRecordedAquarelleStroke(id)!;
    const movedEntry = timelineStrokeAt(index);

    // The replay port's failure path: take the revert snapshot (the moved
    // side), swap to the origin, then raw-restore the revert.
    const revert = restoreAquarelleEditSnapshot(editId!, 'undo');
    expect(revert).not.toBeNull();
    expect(getRecordedAquarelleStroke(id)).not.toBe(movedStroke);

    restoreAquarelleSnapshotRaw(revert!);
    expect(getRecordedAquarelleStroke(id)).toBe(movedStroke);
    expect(timelineStrokeAt(index)).toBe(movedEntry);
  });

  it('a second move on the same stroke is refused while one is in flight', () => {
    const id = 8701;
    recordAquarelleStroke(id, stroke(id, 508));
    const originalStroke = getRecordedAquarelleStroke(id)!;
    const revision = aquarelleStrokesRevision.value;

    setAquarelleScriptEditInFlight(true);
    try {
      expect(isAquarelleScriptEditInFlight()).toBe(true);
      // The delete-named alias shares the ONE guard.
      expect(isAquarelleDeleteInFlight()).toBe(true);
      expect(beginAquarelleMoveEdit(id, 0.01, 0.01)).toBeNull();
    } finally {
      setAquarelleScriptEditInFlight(false);
    }

    expect(isAquarelleScriptEditInFlight()).toBe(false);
    expect(getRecordedAquarelleStroke(id)).toBe(originalStroke);
    expect(aquarelleStrokesRevision.value).toBe(revision);
  });
});

// 261024-mz5: one gesture edits the WHOLE selection in ONE in-memory edit —
// registry strokes and timeline entries swap together at the SAME indexes,
// with exactly one revision bump per effective batch.
describe('261024-mz5 aquarelle batch translate/delete', () => {
  // Frame 504 is shared with a single-stroke cell above — start clean so the
  // batch assertions see ONLY this batch's strokes.
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('translates both strokes and both timeline entries at the same indexes with one bump', () => {
    const first = 9101;
    const second = 9102;
    recordAquarelleStroke(first, stroke(first, 501));
    recordAquarelleStroke(second, stroke(second, 501));
    const firstIndex = timelineStrokeCount() - 2;
    const secondIndex = timelineStrokeCount() - 1;
    const firstEntry = timelineStrokeAt(firstIndex);
    const secondEntry = timelineStrokeAt(secondIndex);
    const revision = aquarelleStrokesRevision.value;

    expect(translateAquarelleStrokesInScript([first, second], 0.05, -0.1)).toBe(2);

    expect(getRecordedAquarelleStroke(first)!.points[0]!.x).toBeCloseTo(0.15, 12);
    expect(getRecordedAquarelleStroke(first)!.points[0]!.y).toBeCloseTo(0.4, 12);
    expect(getRecordedAquarelleStroke(second)!.points[0]!.x).toBeCloseTo(0.15, 12);
    expect(getRecordedAquarelleStroke(second)!.points[0]!.y).toBeCloseTo(0.4, 12);

    const movedFirst = timelineStrokeAt(firstIndex);
    const movedSecond = timelineStrokeAt(secondIndex);
    expect(movedFirst).not.toBe(firstEntry);
    expect(movedSecond).not.toBe(secondEntry);
    expect(movedFirst.pts[0]!.x).toBeCloseTo(0.15, 12);
    expect(movedSecond.pts[0]!.x).toBeCloseTo(0.15, 12);
    // Everything that is not a coordinate survives untouched.
    expect(movedFirst.ticks).toBe(firstEntry.ticks);
    expect(movedSecond.ticks).toBe(secondEntry.ticks);
    expect(movedFirst.playFrame).toBe(firstEntry.playFrame);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });

  it('ignores unknown and deleted ids; an all-unknown batch bumps nothing', () => {
    const live = 9103;
    recordAquarelleStroke(live, stroke(live, 502));
    const revision = aquarelleStrokesRevision.value;

    expect(translateAquarelleStrokesInScript([999999], 0.01, 0.01)).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(revision);

    expect(deleteAquarelleStrokesFromScript([live])).toBe(1);
    const revisionAfterDelete = aquarelleStrokesRevision.value;
    const timelineAfterDelete = [...getRecordedAquarellePayloadTimeline()];

    expect(translateAquarelleStrokesInScript([live], 0.01, 0.01)).toBe(0);
    expect(deleteAquarelleStrokesFromScript([live])).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterDelete);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineAfterDelete);
  });

  it('a multi-id move edit restores both strokes on undo', () => {
    const first = 9104;
    const second = 9105;
    recordAquarelleStroke(first, stroke(first, 503));
    recordAquarelleStroke(second, stroke(second, 503));
    const firstIndex = timelineStrokeCount() - 2;
    const secondIndex = timelineStrokeCount() - 1;
    const firstStroke = getRecordedAquarelleStroke(first)!;
    const secondStroke = getRecordedAquarelleStroke(second)!;
    const firstEntry = timelineStrokeAt(firstIndex);
    const secondEntry = timelineStrokeAt(secondIndex);

    const editId = beginAquarelleMoveEdit([first, second], 0.05, -0.1);
    expect(editId).not.toBeNull();
    expect(getRecordedAquarelleStroke(first)).not.toBe(firstStroke);
    expect(getRecordedAquarelleStroke(second)).not.toBe(secondStroke);

    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    expect(getRecordedAquarelleStroke(first)).toBe(firstStroke);
    expect(getRecordedAquarelleStroke(second)).toBe(secondStroke);
    expect(timelineStrokeAt(firstIndex)).toBe(firstEntry);
    expect(timelineStrokeAt(secondIndex)).toBe(secondEntry);
    expect(getRecordedAquarelleStroke(first)!.points[0]!.x).toBeCloseTo(0.1, 12);
    expect(getRecordedAquarelleStroke(second)!.points[0]!.x).toBeCloseTo(0.1, 12);
  });

  it('deletes every listed id in ONE edit and one revision bump', () => {
    const first = 9106;
    const second = 9107;
    const kept = 9108;
    recordAquarelleStroke(first, stroke(first, 504));
    recordAquarelleStroke(second, stroke(second, 504));
    recordAquarelleStroke(kept, stroke(kept, 504));
    const revision = aquarelleStrokesRevision.value;

    expect(deleteAquarelleStrokesFromScript([first, second])).toBe(2);

    expect(isAquarelleStrokeDeleted(first)).toBe(true);
    expect(isAquarelleStrokeDeleted(second)).toBe(true);
    expect(isAquarelleStrokeDeleted(kept)).toBe(false);
    expect(strokeIdsOfFrame(504)).toEqual([kept]);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });
});

describe('261022-tv1 aquarelle move/delete lockstep', () => {
  it('a delete after a move splices the moved entry', () => {
    const movedId = 8501;
    const keptId = 8502;
    recordAquarelleStroke(movedId, stroke(movedId, 507));
    recordAquarelleStroke(keptId, stroke(keptId, 507));
    const movedIndex = timelineStrokeCount() - 2;
    expect(translateAquarelleStrokeInScript(movedId, 0.02, 0.03)).toBe(true);
    const movedEntry = timelineStrokeAt(movedIndex);

    expect(deleteAquarelleStrokeFromScript(movedId)).toBe(true);

    expect(isAquarelleStrokeDeleted(movedId)).toBe(true);
    expect(getRecordedAquarellePayloadTimeline()).not.toContain(movedEntry);
    const staleEntries = getRecordedAquarellePayloadTimeline().filter(
      (event) => !('kind' in event) && (event.engine as { mutationId?: number }).mutationId === movedId,
    );
    expect(staleEntries).toHaveLength(0);
    const ids = strokeIdsOfFrame(507);
    expect(ids).not.toContain(movedId);
    expect(ids).toContain(keptId);
  });
});

describe('261022-tv1 aquarelle stroke drag signal', () => {
  it('the drag signal is compare-then-write', () => {
    let runs = 0;
    const dispose = effect(() => {
      void aquarelleStrokeDrag.value;
      runs += 1;
    });
    try {
      const before = runs;
      setAquarelleStrokeDrag({ mutationIds: [8601], dxPx: 12, dyPx: -4 });
      setAquarelleStrokeDrag({ mutationIds: [8601], dxPx: 12, dyPx: -4 });
      expect(runs).toBe(before + 1);
      setAquarelleStrokeDrag({ mutationIds: [8601], dxPx: 13, dyPx: -4 });
      expect(runs).toBe(before + 2);
      clearAquarelleStrokeDrag();
      clearAquarelleStrokeDrag();
      expect(runs).toBe(before + 3);
      expect(aquarelleStrokeDrag.value).toBeNull();
    } finally {
      dispose();
      clearAquarelleStrokeDrag();
    }
  });

  it('disarming select mode or starting a script edit clears the ghost', () => {
    const id = 8801;
    recordAquarelleStroke(id, stroke(id, 509));

    setAquarelleSelectMode(true);
    setAquarelleStrokeDrag({ mutationIds: [id], dxPx: 20, dyPx: 10 });
    expect(aquarelleStrokeDrag.value).not.toBeNull();
    setAquarelleSelectMode(false);
    expect(aquarelleStrokeDrag.value).toBeNull();

    setAquarelleStrokeDrag({ mutationIds: [id], dxPx: 20, dyPx: 10 });
    expect(beginAquarelleMoveEdit(id, 0.01, 0.01)).not.toBeNull();
    expect(aquarelleStrokeDrag.value).toBeNull();
  });
});

// ============================================================
//  quick-261024-m20 — the watercolor instance of key-spacing
//  script loss. Force-spacing rewrites appFrames but keeps key
//  IDs, so the recorded strokes, their projected timeline entries
//  and their playFrame anchors must follow the KEY IDENTITY.
//  Registry and timeline stay in lockstep; the snapshot retained
//  union is untouched (session-only drop).
// ============================================================
describe('261024-m20 aquarelle key-identity remap', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('moves every respaced key script onto its key\'s new frame', () => {
    recordAquarelleStroke(1, stroke(1, 0));
    recordAquarelleStroke(2, stroke(2, 2));
    recordAquarelleStroke(3, stroke(3, 10));
    recordAquarelleStroke(4, stroke(4, 14));
    const stroke3Before = getRecordedAquarelleStroke(3)!;
    const entry3Before = findStrokeEntry(3)!;
    const stroke1 = getRecordedAquarelleStroke(1)!;
    const stroke2 = getRecordedAquarelleStroke(2)!;
    const entry1 = findStrokeEntry(1)!;
    const entry2 = findStrokeEntry(2)!;
    const revision = aquarelleStrokesRevision.value;

    const result = remapAquarelleScriptsForRecords(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 2 },
        { keyId: 'c', appFrame: 10 },
        { keyId: 'd', appFrame: 14 },
      ],
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 2 },
        { keyId: 'c', appFrame: 4 },
        { keyId: 'd', appFrame: 6 },
      ],
    );

    expect(result).toEqual({ moved: 2, dropped: 0 });
    expect(getRecordedAquarelleStroke(1)!.playFrame).toBe(0);
    expect(getRecordedAquarelleStroke(2)!.playFrame).toBe(2);
    expect(getRecordedAquarelleStroke(3)!.playFrame).toBe(4);
    expect(getRecordedAquarelleStroke(4)!.playFrame).toBe(6);
    expect(strokeIdsOfFrame(4)).toEqual([3]);
    expect(strokeIdsOfFrame(6)).toEqual([4]);
    expect(strokeIdsOfFrame(10)).toEqual([]);
    expect(strokeIdsOfFrame(14)).toEqual([]);

    // Unmoved strokes and entries keep their exact object identity.
    expect(getRecordedAquarelleStroke(1)).toBe(stroke1);
    expect(getRecordedAquarelleStroke(2)).toBe(stroke2);
    expect(findStrokeEntry(1)).toBe(entry1);
    expect(findStrokeEntry(2)).toBe(entry2);

    // Moved ones are REPLACED objects with both anchors updated.
    const stroke3After = getRecordedAquarelleStroke(3)!;
    expect(stroke3After).not.toBe(stroke3Before);
    const entry3After = findStrokeEntry(3)!;
    expect(entry3After).not.toBe(entry3Before);
    expect(entry3After.playFrame).toBe(4);
    expect((entry3After.engine as AquarelleStrokePayload).playFrame).toBe(4);

    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });

  it('drops only the deleted key script and moves the survivor', () => {
    recordAquarelleStroke(11, stroke(11, 0));
    recordAquarelleStroke(12, stroke(12, 5));
    recordAquarelleStroke(13, stroke(13, 10));

    const result = remapAquarelleScriptsForRecords(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 5 },
        { keyId: 'c', appFrame: 10 },
      ],
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'c', appFrame: 5 },
      ],
    );

    expect(result).toEqual({ moved: 1, dropped: 1 });
    expect(getRecordedAquarelleStroke(12)).toBeUndefined();
    expect(findStrokeEntry(12)).toBeUndefined();
    expect(strokeIdsOfFrame(5)).toEqual([13]);
    expect(getRecordedAquarelleStroke(13)!.playFrame).toBe(5);
    // The moved key kept frame 10's serial counter (1), so a later stroke on
    // its new frame continues at 2 — never a restart.
    recordAquarelleStroke(14, stroke(14, 5));
    expect(aquarelleStrokeSerial(14, 5)).toBe(2);
  });

  it('keeps a surviving deletion marker and clears a dropped one', () => {
    recordAquarelleStroke(21, stroke(21, 5));
    recordAquarelleStroke(22, stroke(22, 10));
    markAquarelleStrokeDeleted(21);
    markAquarelleStrokeDeleted(22);

    const result = remapAquarelleScriptsForRecords(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 5 },
        { keyId: 'c', appFrame: 10 },
      ],
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'c', appFrame: 5 },
      ],
    );

    expect(result).toEqual({ moved: 1, dropped: 1 });
    // Survivor keeps its deletion marker and moves with its key.
    expect(isAquarelleStrokeDeleted(22)).toBe(true);
    expect(getRecordedAquarelleStroke(22)!.playFrame).toBe(5);
    // Dropped identity loses its marker and its serial.
    expect(isAquarelleStrokeDeleted(21)).toBe(false);
    expect(getRecordedAquarelleStroke(21)).toBeUndefined();
    // A fresh serial lookup cannot resolve the old serial (1): the frame
    // counter moved with key c, so it assigns 2.
    expect(aquarelleStrokeSerial(21, 5)).toBe(2);
  });

  it('leaves Dry events by identity and at their relative position', () => {
    recordAquarelleStroke(31, stroke(31, 0));
    const dry = emitAquarelleDry(5);
    recordAquarelleStroke(32, stroke(32, 10));
    expect(getRecordedAquarellePayloadTimeline().indexOf(dry)).toBe(1);

    remapAquarelleScriptsForRecords(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 10 },
      ],
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'b', appFrame: 4 },
      ],
    );

    const timeline = getRecordedAquarellePayloadTimeline();
    expect(timeline[1]).toBe(dry);
    expect(timeline.filter((event) => 'kind' in event)).toHaveLength(1);
    expect(getAquarelleEventsForFrame(0)).toContain(dry);
    expect(getAquarelleEventsForFrame(4)).toContain(dry);
  });

  it('keeps the registry entry as the very timeline object after a remap', () => {
    recordAquarelleStroke(41, stroke(41, 10));

    remapAquarelleScriptsForRecords(
      [{ keyId: 'a', appFrame: 10 }],
      [{ keyId: 'a', appFrame: 4 }],
    );

    // translate/delete find the entry by indexOf: both succeed only while the
    // timeline still holds the registry's very object.
    expect(translateAquarelleStrokeInScript(41, 0.02, 0.02)).toBe(true);
    expect(findStrokeEntry(41)!.pts[0]!.x).toBeCloseTo(0.12, 12);
    expect(deleteAquarelleStrokeFromScript(41)).toBe(true);
    expect(findStrokeEntry(41)).toBeUndefined();
  });

  it('fails closed on a malformed layout without mutating or bumping', () => {
    recordAquarelleStroke(51, stroke(51, 5));
    const revision = aquarelleStrokesRevision.value;
    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];
    const strokeBefore = getRecordedAquarelleStroke(51)!;

    const result = remapAquarelleScriptsForRecords(
      [
        { keyId: 'a', appFrame: 0 },
        { keyId: 'a', appFrame: 5 },
      ],
      [{ keyId: 'b', appFrame: 5 }],
    );

    expect(result).toBeNull();
    expect(aquarelleStrokesRevision.value).toBe(revision);
    const timelineAfter = getRecordedAquarellePayloadTimeline();
    expect(timelineAfter).toHaveLength(timelineBefore.length);
    expect(timelineAfter.every((event, index) => event === timelineBefore[index])).toBe(true);
    expect(getRecordedAquarelleStroke(51)).toBe(strokeBefore);
  });

  it('is a no-op for an identical key layout', () => {
    recordAquarelleStroke(61, stroke(61, 0));
    recordAquarelleStroke(62, stroke(62, 5));
    emitAquarelleDry(3);
    const records = [
      { keyId: 'a', appFrame: 0 },
      { keyId: 'b', appFrame: 5 },
    ];
    const revision = aquarelleStrokesRevision.value;
    const stroke61 = getRecordedAquarelleStroke(61)!;
    const entry61 = findStrokeEntry(61)!;
    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];

    const result = remapAquarelleScriptsForRecords(records, records);

    expect(result).toEqual({ moved: 0, dropped: 0 });
    expect(aquarelleStrokesRevision.value).toBe(revision);
    expect(getRecordedAquarelleStroke(61)).toBe(stroke61);
    expect(findStrokeEntry(61)).toBe(entry61);
    const timelineAfter = getRecordedAquarellePayloadTimeline();
    expect(timelineAfter).toHaveLength(timelineBefore.length);
    expect(timelineAfter.every((event, index) => event === timelineBefore[index])).toBe(true);
  });
});
