// ============================================================
//  261022-ujp Task 1 — step a recorded stroke one payload
//  position back (Space stack step).
//
//  The payload timeline IS the watercolor paint order: a step
//  swaps two stroke events by index assignment. Dry events are
//  sheet actions with no frame anchor (D-15), so they keep their
//  absolute timeline index and are never swap partners. The
//  registry Map insertion order (newest-last hit-testing) and
//  every per-stroke field stay untouched.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  isAquarelleDryEvent,
  toStudioStroke as aquarelleToStudioStroke,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  deleteAquarelleStrokeFromScript,
  emitAquarelleDry,
  getAquarelleEventsForFrame,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  sendAquarelleStrokeBackwardInScript,
  sendAquarelleStrokeForwardInScript,
} from './aquarelleRecordState';
import {
  aquarelleSelectedStrokeMutationId,
  beginAquarelleReorderEdit,
  restoreAquarelleEditSnapshot,
  selectAquarelleStroke,
  setAquarelleScriptEditInFlight,
} from './aquarelleStrokeSelection';

type AquarelleTimelineStroke = ReturnType<typeof aquarelleToStudioStroke>;

/** Read one timeline entry, narrowed to the stroke union member (Dry has `kind`). */
function asTimelineStroke(event: AquarellePayloadEvent | undefined): AquarelleTimelineStroke {
  if (!event || 'kind' in event) {
    throw new Error('expected a stroke event in the payload timeline');
  }
  return event;
}

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(mutationId: number, playFrame = 601): AquarelleStroke {
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

/** Stroke mutationIds of the whole timeline, in payload order. */
function timelineIds(): number[] {
  return getRecordedAquarellePayloadTimeline().flatMap((event) =>
    'kind' in event
      ? []
      : [(event.engine as { mutationId?: number }).mutationId ?? -1],
  );
}

/** Stroke mutationIds of one edit frame, in payload order. */
function frameIds(playFrame: number): number[] {
  return getAquarelleEventsForFrame(playFrame).flatMap((event) =>
    'kind' in event
      ? []
      : [(event.engine as { mutationId?: number }).mutationId ?? -1],
  );
}

describe('261022-ujp aquarelle stroke stack step', () => {
  it('sends a stroke one step back in the payload timeline', () => {
    recordAquarelleStroke(9101, stroke(9101));
    recordAquarelleStroke(9102, stroke(9102));
    recordAquarelleStroke(9103, stroke(9103));
    const tailBefore = getRecordedAquarellePayloadTimeline().slice(-3);
    const revisionBefore = aquarelleStrokesRevision.value;

    expect(sendAquarelleStrokeBackwardInScript(9103)).toBe(true);

    const tailAfter = getRecordedAquarellePayloadTimeline().slice(-3);
    expect(tailAfter.map((event) => (asTimelineStroke(event).engine as { mutationId?: number }).mutationId))
      .toEqual([9101, 9103, 9102]);
    expect(frameIds(601).slice(-3)).toEqual([9101, 9103, 9102]);
    // 261022-ujp fix: the recording slot travels with the POSITION, so the
    // moved stroke takes its new neighbour's slot and vice versa. Leaving the
    // moved stroke on its old timestamp collapsed the bake's settle gap and
    // the water absorbed the underpainting (2-stroke repro).
    const movedAfter = asTimelineStroke(tailAfter[1]);
    const movedBefore = asTimelineStroke(tailBefore[2]);
    const partnerBefore = asTimelineStroke(tailBefore[1]);
    expect(movedAfter.recordedOrder).toBe(partnerBefore.recordedOrder);
    expect(asTimelineStroke(tailAfter[2]).recordedOrder).toBe(movedBefore.recordedOrder);
    expect((movedAfter.engine as { timestamp?: number }).timestamp).toBe(partnerBefore.recordedOrder);
    expect(getRecordedAquarelleStroke(9103)!.timestamp).toBe(partnerBefore.recordedOrder);
    // Regression pin: the frame's recording clock stays monotonic in paint
    // order, which is what keeps the settle gap the bake feeds between strokes.
    const slots = frameIds(601)
      .slice(-3)
      .map((id) => getRecordedAquarelleStroke(id)!.timestamp);
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
    // Everything else on the stroke is intact — same source points, same
    // duration, same frame.
    expect(movedAfter.ticks).toBe(movedBefore.ticks);
    expect(movedAfter.playFrame).toBe(movedBefore.playFrame);
    expect(movedAfter.pts).toBe(movedBefore.pts);
    expect(getRecordedAquarelleStroke(9103)!.points[0]!.x).toBe(0.1);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);
  });

  it('each call is one step, and the bottom refuses', () => {
    // Own frame so the walk cannot reach a previous test's strokes.
    recordAquarelleStroke(9201, stroke(9201, 602));
    recordAquarelleStroke(9202, stroke(9202, 602));
    recordAquarelleStroke(9203, stroke(9203, 602));
    recordAquarelleStroke(9204, stroke(9204, 602));

    expect(sendAquarelleStrokeBackwardInScript(9204)).toBe(true);
    expect(timelineIds().slice(-4)).toEqual([9201, 9202, 9204, 9203]);
    expect(sendAquarelleStrokeBackwardInScript(9204)).toBe(true);
    expect(timelineIds().slice(-4)).toEqual([9201, 9204, 9202, 9203]);
    expect(sendAquarelleStrokeBackwardInScript(9204)).toBe(true);
    expect(timelineIds().slice(-4)).toEqual([9204, 9201, 9202, 9203]);

    // One more press cannot move it past the front.
    const revisionBefore = aquarelleStrokesRevision.value;
    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];
    expect(sendAquarelleStrokeBackwardInScript(9204)).toBe(false);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineBefore);
  });

  it('each forward call is one step, and the top refuses', () => {
    // Own frame so the walk cannot reach a previous test's strokes.
    recordAquarelleStroke(9401, stroke(9401, 611));
    recordAquarelleStroke(9402, stroke(9402, 611));
    recordAquarelleStroke(9403, stroke(9403, 611));

    expect(sendAquarelleStrokeForwardInScript(9401)).toBe(true);
    expect(timelineIds().slice(-3)).toEqual([9402, 9401, 9403]);
    expect(sendAquarelleStrokeForwardInScript(9401)).toBe(true);
    expect(timelineIds().slice(-3)).toEqual([9402, 9403, 9401]);

    const revisionBefore = aquarelleStrokesRevision.value;
    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];
    expect(sendAquarelleStrokeForwardInScript(9401)).toBe(false);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineBefore);
  });

  it('a forward edit restores the previous order on undo and the new order on redo', () => {
    recordAquarelleStroke(9501, stroke(9501, 612));
    recordAquarelleStroke(9502, stroke(9502, 612));

    const editId = beginAquarelleReorderEdit(9501, 'forward');
    expect(editId).not.toBeNull();
    expect(frameIds(612).slice(-2)).toEqual([9502, 9501]);

    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    expect(frameIds(612).slice(-2)).toEqual([9501, 9502]);

    expect(restoreAquarelleEditSnapshot(editId!, 'redo')).not.toBeNull();
    expect(frameIds(612).slice(-2)).toEqual([9502, 9501]);
  });

  it('refuses unknown, deleted, and single-of-frame strokes', () => {
    recordAquarelleStroke(9301, stroke(9301, 603));
    recordAquarelleStroke(9302, stroke(9302, 603));
    recordAquarelleStroke(9303, stroke(9303, 604));

    const revisionBefore = aquarelleStrokesRevision.value;
    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];

    expect(sendAquarelleStrokeBackwardInScript(999999)).toBe(false);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineBefore);

    // 9303's only older same-frame stroke does not exist (9302 is another frame).
    expect(sendAquarelleStrokeBackwardInScript(9303)).toBe(false);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineBefore);

    expect(deleteAquarelleStrokeFromScript(9301)).toBe(true);
    const revisionAfterDelete = aquarelleStrokesRevision.value;
    const timelineAfterDelete = [...getRecordedAquarellePayloadTimeline()];
    expect(sendAquarelleStrokeBackwardInScript(9301)).toBe(false);
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterDelete);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineAfterDelete);
  });

  it('Dry events keep their absolute index', () => {
    recordAquarelleStroke(9401, stroke(9401, 605));
    const dry = emitAquarelleDry(9401);
    recordAquarelleStroke(9402, stroke(9402, 605));

    expect(sendAquarelleStrokeBackwardInScript(9402)).toBe(true);

    const tail = getRecordedAquarellePayloadTimeline().slice(-3);
    expect(isAquarelleDryEvent(tail[1]!)).toBe(true);
    expect(tail[1]).toBe(dry);
    expect((asTimelineStroke(tail[0]).engine as { mutationId?: number }).mutationId).toBe(9402);
    expect((asTimelineStroke(tail[2]).engine as { mutationId?: number }).mutationId).toBe(9401);
  });

  it('a reorder edit restores the previous order on undo and the new order on redo', () => {
    recordAquarelleStroke(9501, stroke(9501, 606));
    recordAquarelleStroke(9502, stroke(9502, 606));

    const editId = beginAquarelleReorderEdit(9502);
    expect(editId).not.toBeNull();
    expect(timelineIds().slice(-2)).toEqual([9502, 9501]);

    const undoRevert = restoreAquarelleEditSnapshot(editId!, 'undo');
    expect(undoRevert).not.toBeNull();
    expect(timelineIds().slice(-2)).toEqual([9501, 9502]);

    expect(restoreAquarelleEditSnapshot(editId!, 'redo')).not.toBeNull();
    expect(timelineIds().slice(-2)).toEqual([9502, 9501]);

    // A newer record makes the stale undo fail closed.
    recordAquarelleStroke(9503, stroke(9503, 606));
    const staleEdit = beginAquarelleReorderEdit(9503);
    expect(staleEdit).not.toBeNull();
    // 9503 swaps with its immediate older same-frame neighbour, 9501.
    expect(timelineIds().slice(-3)).toEqual([9502, 9503, 9501]);
    recordAquarelleStroke(9504, stroke(9504, 606));
    const revisionAfterNewStroke = aquarelleStrokesRevision.value;
    const timelineAfterNewStroke = [...getRecordedAquarellePayloadTimeline()];

    expect(restoreAquarelleEditSnapshot(staleEdit!, 'undo')).toBeNull();
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterNewStroke);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineAfterNewStroke);
  });

  it('a reorder keeps the selection and the shared in-flight guard', () => {
    recordAquarelleStroke(9601, stroke(9601, 607));
    recordAquarelleStroke(9602, stroke(9602, 607));
    selectAquarelleStroke(9602);

    try {
      const editId = beginAquarelleReorderEdit(9602);
      expect(editId).not.toBeNull();
      expect(aquarelleSelectedStrokeMutationId.value).toBe(9602);
      expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
      expect(aquarelleSelectedStrokeMutationId.value).toBe(9602);

      setAquarelleScriptEditInFlight(true);
      expect(beginAquarelleReorderEdit(9602)).toBeNull();
    } finally {
      setAquarelleScriptEditInFlight(false);
      selectAquarelleStroke(null);
    }
  });
});
