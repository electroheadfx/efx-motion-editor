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
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  isAquarelleStrokeDeleted,
  recordAquarelleStroke,
} from './aquarelleRecordState';

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
