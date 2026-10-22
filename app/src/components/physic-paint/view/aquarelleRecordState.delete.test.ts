// ============================================================
//  261022-pim Task 2 — delete a recorded stroke from the script.
//
//  The marker set is the script authority: the stroke's payload
//  timeline entry leaves the timeline, its presence gate stays
//  (so capture never falls back to engine-1), and the revision
//  advances for the narrow overlay leaf.
// ============================================================

import { describe, expect, it } from 'vitest';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  deleteAquarelleStrokeFromScript,
  emitAquarelleDry,
  getAquarelleEventsForFrame,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  isAquarelleStrokeDeleted,
  markAquarelleStrokeDeleted,
  recordAquarelleStroke,
} from './aquarelleRecordState';
import {
  beginAquarelleDeleteEdit,
  restoreAquarelleEditSnapshot,
} from './aquarelleStrokeSelection';

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(mutationId: number, playFrame = 301): AquarelleStroke {
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

describe('261022-pim aquarelle record-state delete', () => {
  it('delete marks the stroke and splices its timeline entry', () => {
    recordAquarelleStroke(7101, stroke(7101));
    recordAquarelleStroke(7102, stroke(7102));
    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];
    const entryForFirst = timelineBefore[timelineBefore.length - 2];
    const revisionBefore = aquarelleStrokesRevision.value;

    expect(deleteAquarelleStrokeFromScript(7101)).toBe(true);

    expect(isAquarelleStrokeDeleted(7101)).toBe(true);
    const timelineAfter = getRecordedAquarellePayloadTimeline();
    expect(timelineAfter).not.toContain(entryForFirst);
    expect(timelineAfter.length).toBe(timelineBefore.length - 1);
    // Presence gate stays TRUE — the capture uses it to choose the aquarelle
    // serialize path; the marker (not absence) removes the stroke.
    expect(getRecordedAquarelleStroke(7101)).toBeDefined();
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);
  });

  it('a second delete of the same id is a no-op returning false', () => {
    recordAquarelleStroke(7103, stroke(7103));
    expect(deleteAquarelleStrokeFromScript(7103)).toBe(true);
    const revisionAfterFirst = aquarelleStrokesRevision.value;
    const timelineAfterFirst = [...getRecordedAquarellePayloadTimeline()];

    expect(deleteAquarelleStrokeFromScript(7103)).toBe(false);
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterFirst);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineAfterFirst);
  });

  it('an unknown id is a no-op returning false', () => {
    expect(deleteAquarelleStrokeFromScript(999999)).toBe(false);
    expect(isAquarelleStrokeDeleted(999999)).toBe(false);
  });
});

// 261022-pim second-delete fix: the delete re-bake reads the recorded
// timeline for the edit frame, not the engine guide strokes (an Apply refresh
// drops them). Dry is a sheet action with no frame anchor, so it rides every
// frame's replay list.
describe('261022-pim aquarelle frame replay list', () => {
  it('keeps only the frame strokes plus every Dry event', () => {
    recordAquarelleStroke(7401, stroke(7401, 401));
    recordAquarelleStroke(7402, stroke(7402, 401));
    recordAquarelleStroke(7403, stroke(7403, 402));
    emitAquarelleDry(4242);

    const frame401 = getAquarelleEventsForFrame(401);
    const ids = frame401.flatMap((event) =>
      'kind' in event ? [] : [(event.engine as { mutationId?: number }).mutationId],
    );
    expect(ids).toEqual(expect.arrayContaining([7401, 7402]));
    expect(ids).not.toContain(7403);
    expect(frame401.some((event) => 'kind' in event && event.kind === 'dry')).toBe(true);
  });

  it('honors the deleted marker even if a stale read left the entry', () => {
    recordAquarelleStroke(7411, stroke(7411, 403));
    recordAquarelleStroke(7412, stroke(7412, 403));
    markAquarelleStrokeDeleted(7411);

    const ids = getAquarelleEventsForFrame(403).flatMap((event) =>
      'kind' in event ? [] : [(event.engine as { mutationId?: number }).mutationId],
    );
    expect(ids).not.toContain(7411);
    expect(ids).toContain(7412);
  });
});

// 261022-pim Task 3: one delete is one edit with a before/after snapshot.
// Undo restores the exact timeline (same object refs, same order) and the
// revision-authority check fails closed on a newer script mutation.
describe('261022-pim aquarelle delete edit snapshots', () => {
  it('undo snapshot restores the entry at its original index, unmarks, and bumps the revision', () => {
    recordAquarelleStroke(7201, stroke(7201));
    recordAquarelleStroke(7202, stroke(7202));
    recordAquarelleStroke(7203, stroke(7203));
    const timelineBefore = [...getRecordedAquarellePayloadTimeline()];
    const tail = timelineBefore.slice(-3);

    const editId = beginAquarelleDeleteEdit(7202);
    expect(editId).not.toBeNull();
    expect(isAquarelleStrokeDeleted(7202)).toBe(true);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(timelineBefore.length - 1);
    const revisionAfterDelete = aquarelleStrokesRevision.value;

    const revert = restoreAquarelleEditSnapshot(editId!, 'undo');
    expect(revert).not.toBeNull();
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterDelete + 1);
    expect(isAquarelleStrokeDeleted(7202)).toBe(false);

    const restored = [...getRecordedAquarellePayloadTimeline()];
    expect(restored).toHaveLength(timelineBefore.length);
    // The exact middle entries are back, in recording order, by reference.
    expect(restored.slice(-3)).toEqual(tail);
    expect(restored[restored.length - 3]).toBe(tail[0]);
    expect(restored[restored.length - 2]).toBe(tail[1]);
    expect(restored[restored.length - 1]).toBe(tail[2]);
  });

  it('a stale snapshot is refused', () => {
    recordAquarelleStroke(7301, stroke(7301));
    recordAquarelleStroke(7302, stroke(7302));
    const editId = beginAquarelleDeleteEdit(7301);
    expect(editId).not.toBeNull();

    // A newer recorded stroke moves the script revision past the edit's after
    // side — the stale undo must fail closed and change nothing.
    recordAquarelleStroke(7303, stroke(7303));
    const revisionAfterNewStroke = aquarelleStrokesRevision.value;
    const timelineAfterNewStroke = [...getRecordedAquarellePayloadTimeline()];

    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).toBeNull();
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterNewStroke);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timelineAfterNewStroke);
    expect(isAquarelleStrokeDeleted(7301)).toBe(true);
  });
});
