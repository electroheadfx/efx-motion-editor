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

import { describe, expect, it } from 'vitest';
import { effect } from '@preact/signals';
import {
  toStudioStroke as aquarelleToStudioStroke,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  deleteAquarelleStrokeFromScript,
  getAquarelleEventsForFrame,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  isAquarelleStrokeDeleted,
  recordAquarelleStroke,
  translateAquarelleStrokeInScript,
} from './aquarelleRecordState';
import {
  aquarelleStrokeDrag,
  beginAquarelleMoveEdit,
  clearAquarelleStrokeDrag,
  restoreAquarelleEditSnapshot,
  restoreAquarelleSnapshotRaw,
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
      setAquarelleStrokeDrag({ mutationId: 8601, dxPx: 12, dyPx: -4 });
      setAquarelleStrokeDrag({ mutationId: 8601, dxPx: 12, dyPx: -4 });
      expect(runs).toBe(before + 1);
      setAquarelleStrokeDrag({ mutationId: 8601, dxPx: 13, dyPx: -4 });
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
});
