// ============================================================
//  61-12 Task 2 (VEC-04 / D-12 / D-14) — the render-mode batch write.
//
//  The render mode is a STROKE property, never a path property: the
//  write reads no anchors, so a hand-painted stroke is written
//  exactly like a vector one and NO anchor list is created,
//  dropped, copied or rewritten (T-61-40). One revision bump and
//  ONE history entry cover the whole batch (T-61-41).
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  toStudioStroke as aquarelleToStudioStroke,
  type AquarelleAnchor,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleRenderMode,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  deleteAquarelleStrokesFromScript,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  updateAquarelleRenderModeInScript,
} from './aquarelleRecordState';
import {
  beginAquarelleRenderModeEdit,
  restoreAquarelleEditSnapshot,
} from './aquarelleStrokeSelection';

type AquarelleTimelineStroke = ReturnType<typeof aquarelleToStudioStroke>;

/** Non-default sample fields — the mode write must not touch any of them. */
function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 0.25, tx: 0.5, ty: -0.5, tw: 0.75 };
}

function stroke(
  mutationId: number,
  extra: Partial<AquarelleStroke> = {},
): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points: [point(0.1, 0.5), point(0.2, 0.4)],
    mutationId,
    timestamp: mutationId,
    playFrame: 601,
    ...extra,
  };
}

/** A vector stroke: a non-empty anchor list is the only vector-ness signal. */
function vectorStroke(mutationId: number): AquarelleStroke {
  return stroke(mutationId, { anchors: ANCHORS });
}

function timelineStrokeAt(index: number): AquarelleTimelineStroke {
  const event: AquarellePayloadEvent | undefined =
    getRecordedAquarellePayloadTimeline()[index];
  if (!event || 'kind' in event) {
    throw new Error(`expected a stroke event at timeline index ${index}`);
  }
  return event;
}

/**
 * A valid three-anchor path: the third anchor carries the DEFAULT width, so
 * the D-10 projection writes no width key for it — a mode write must not
 * disturb that.
 */
const ANCHORS: readonly AquarelleAnchor[] = Object.freeze([
  Object.freeze({ x: 0.12, y: 0.2, kind: 'auto' as const }),
  Object.freeze({
    x: 0.3,
    y: 0.44,
    kind: 'bezier' as const,
    in: { x: 0.24, y: 0.36 },
    out: { x: 0.36, y: 0.52 },
    width: 1.4,
  }),
  Object.freeze({ x: 0.62, y: 0.71, kind: 'auto' as const, width: 1 }),
]);

describe('61-12 aquarelle render-mode batch write', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('writes two vector strokes and one hand-painted stroke as one batch of three', () => {
    const hand = 8001;
    const vectorA = 8003;
    const vectorB = 8005;
    recordAquarelleStroke(hand, stroke(hand));
    recordAquarelleStroke(vectorA, vectorStroke(vectorA));
    recordAquarelleStroke(vectorB, vectorStroke(vectorB));
    const handIndex = getRecordedAquarellePayloadTimeline().length - 3;
    const vectorAIndex = getRecordedAquarellePayloadTimeline().length - 2;
    const vectorBIndex = getRecordedAquarellePayloadTimeline().length - 1;
    const handEntryBefore = timelineStrokeAt(handIndex);
    const revision = aquarelleStrokesRevision.value;

    expect(updateAquarelleRenderModeInScript([hand, vectorA, vectorB], 'simple-ribbon')).toBe(3);

    // Every written stroke's payload entry carries the new mode.
    expect(timelineStrokeAt(handIndex).engine.renderMode).toBe('simple-ribbon');
    expect(timelineStrokeAt(vectorAIndex).engine.renderMode).toBe('simple-ribbon');
    expect(timelineStrokeAt(vectorBIndex).engine.renderMode).toBe('simple-ribbon');
    expect(getRecordedAquarelleStroke(hand)!.renderMode).toBe('simple-ribbon');

    // The hand-painted stroke still carries NO anchors key — key presence,
    // never an `undefined` comparison.
    expect('anchors' in timelineStrokeAt(handIndex).engine).toBe(false);
    expect('anchors' in getRecordedAquarelleStroke(hand)!).toBe(false);

    // SAME index — nothing was spliced, dropped or reordered.
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(3);
    expect(getRecordedAquarellePayloadTimeline().indexOf(handEntryBefore)).toBe(-1);
    // ONE bump for the whole batch.
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });

  it('never creates, drops, copies or rewrites an anchor list (D-12/D-14)', () => {
    const hand = 8011;
    const vector = 8013;
    recordAquarelleStroke(hand, stroke(hand));
    recordAquarelleStroke(vector, vectorStroke(vector));
    const handIndex = getRecordedAquarellePayloadTimeline().length - 2;
    const vectorIndex = getRecordedAquarellePayloadTimeline().length - 1;
    const anchorList = getRecordedAquarelleStroke(vector)!.anchors!;
    const beforeAnchorsJson = JSON.stringify(timelineStrokeAt(vectorIndex).engine.anchors);
    const beforeParams = getRecordedAquarelleStroke(vector)!.params;

    expect(updateAquarelleRenderModeInScript([hand, vector], 'simple-ribbon')).toBe(2);

    // Registry: the SAME array reference — not copied, normalised or rewritten.
    expect(getRecordedAquarelleStroke(vector)!.anchors).toBe(anchorList);
    expect(getRecordedAquarelleStroke(vector)!.params).toBe(beforeParams);
    // Payload entry: byte-identical projection of that list.
    expect(JSON.stringify(timelineStrokeAt(vectorIndex).engine.anchors)).toBe(beforeAnchorsJson);

    // D-10 survives the write: a default-width anchor has no width key, the
    // explicit 1.4 factor is carried untouched.
    const projected = timelineStrokeAt(vectorIndex).engine.anchors!;
    expect('width' in projected[0]!).toBe(false);
    expect(projected[1]!.width).toBe(1.4);
    expect('width' in projected[2]!).toBe(false);

    // The hand-painted stroke gained no anchors key through the mode write.
    expect('anchors' in getRecordedAquarelleStroke(hand)!).toBe(false);
    expect('anchors' in timelineStrokeAt(handIndex).engine).toBe(false);
  });

  it('bumps once, refuses a repeat and de-duplicates a repeated id', () => {
    const first = 8101;
    const second = 8103;
    recordAquarelleStroke(first, vectorStroke(first));
    recordAquarelleStroke(second, stroke(second));
    const firstIndex = getRecordedAquarellePayloadTimeline().length - 2;
    const secondIndex = getRecordedAquarellePayloadTimeline().length - 1;
    const revision = aquarelleStrokesRevision.value;

    expect(updateAquarelleRenderModeInScript([first, second], 'simple-ribbon')).toBe(2);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);

    // A second identical call is a no-op: nothing written, nothing bumped.
    const firstStrokeAfterWrite = getRecordedAquarelleStroke(first)!;
    const firstEntryAfterWrite = timelineStrokeAt(firstIndex);
    const afterWriteRevision = aquarelleStrokesRevision.value;
    expect(updateAquarelleRenderModeInScript([first, second], 'simple-ribbon')).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(afterWriteRevision);
    expect(getRecordedAquarelleStroke(first)).toBe(firstStrokeAfterWrite);
    expect(timelineStrokeAt(firstIndex)).toBe(firstEntryAfterWrite);

    // A repeated id is ONE target: one write for `[first, first, first]`.
    const dedupRevision = aquarelleStrokesRevision.value;
    expect(updateAquarelleRenderModeInScript([first, first, first], 'watercolor')).toBe(1);
    expect(aquarelleStrokesRevision.value).toBe(dedupRevision + 1);
    expect(timelineStrokeAt(firstIndex).engine.renderMode).toBe('watercolor');
    // The untouched neighbour keeps the previous mode.
    expect(timelineStrokeAt(secondIndex).engine.renderMode).toBe('simple-ribbon');
  });

  it('stores exactly ONE history entry for the whole batch', () => {
    const control = 8201;
    const first = 8203;
    const second = 8205;
    const third = 8207;
    recordAquarelleStroke(control, stroke(control));
    recordAquarelleStroke(first, vectorStroke(first));
    recordAquarelleStroke(second, stroke(second));
    recordAquarelleStroke(third, vectorStroke(third));
    const firstIndex = getRecordedAquarellePayloadTimeline().length - 3;
    const secondIndex = getRecordedAquarellePayloadTimeline().length - 2;
    const thirdIndex = getRecordedAquarellePayloadTimeline().length - 1;
    const firstStroke = getRecordedAquarelleStroke(first)!;
    const secondStroke = getRecordedAquarelleStroke(second)!;
    const thirdStroke = getRecordedAquarelleStroke(third)!;
    const firstEntry = timelineStrokeAt(firstIndex);
    const secondEntry = timelineStrokeAt(secondIndex);
    const thirdEntry = timelineStrokeAt(thirdIndex);

    // A one-stroke control edit gives the ledger's current id.
    const controlEditId = beginAquarelleRenderModeEdit([control], 'simple-ribbon');
    expect(controlEditId).not.toBeNull();

    const batchEditId = beginAquarelleRenderModeEdit([first, second, third], 'simple-ribbon');
    expect(batchEditId).not.toBeNull();
    // The id counter advanced by EXACTLY one for the three-stroke batch.
    expect(batchEditId).toBe(controlEditId! + 1);
    expect(timelineStrokeAt(firstIndex).engine.renderMode).toBe('simple-ribbon');
    expect(timelineStrokeAt(secondIndex).engine.renderMode).toBe('simple-ribbon');
    expect(timelineStrokeAt(thirdIndex).engine.renderMode).toBe('simple-ribbon');

    // ONE undo restores all three strokes and all three entries.
    expect(restoreAquarelleEditSnapshot(batchEditId!, 'undo')).not.toBeNull();
    expect(getRecordedAquarelleStroke(first)).toBe(firstStroke);
    expect(getRecordedAquarelleStroke(second)).toBe(secondStroke);
    expect(getRecordedAquarelleStroke(third)).toBe(thirdStroke);
    expect(timelineStrokeAt(firstIndex)).toBe(firstEntry);
    expect(timelineStrokeAt(secondIndex)).toBe(secondEntry);
    expect(timelineStrokeAt(thirdIndex)).toBe(thirdEntry);
    expect(getRecordedAquarelleStroke(first)!.renderMode).toBeUndefined();
    expect('anchors' in getRecordedAquarelleStroke(second)!).toBe(false);
  });

  it('writes a malformed-anchor stroke and skips missing or out-of-timeline ids', () => {
    const malformed = 8301;
    const live = 8303;
    const deleted = 8305;
    const unknown = 999_999;
    const badAnchors = [
      { x: 0.1, y: 0.2, kind: 'bogus' },
    ] as unknown as readonly AquarelleAnchor[];
    recordAquarelleStroke(malformed, stroke(malformed, { anchors: badAnchors }));
    recordAquarelleStroke(live, vectorStroke(live));
    recordAquarelleStroke(deleted, vectorStroke(deleted));
    expect(deleteAquarelleStrokesFromScript([deleted])).toBe(1);
    const malformedIndex = 0;
    const liveIndex = 1;
    const beforeMalformedAnchors = JSON.stringify(
      timelineStrokeAt(malformedIndex).engine.anchors,
    );
    const timelineSize = getRecordedAquarellePayloadTimeline().length;
    const revision = aquarelleStrokesRevision.value;

    // An unknown mode refuses the WHOLE batch before anything is touched.
    expect(
      updateAquarelleRenderModeInScript([live, malformed], 'sparkle' as AquarelleRenderMode),
    ).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(revision);

    // The malformed anchor list is written anyway — the mode write reads no
    // anchors. The deleted id and the never-recorded id are skipped silently.
    expect(
      updateAquarelleRenderModeInScript([malformed, live, deleted, unknown], 'simple-ribbon'),
    ).toBe(2);

    expect(timelineStrokeAt(malformedIndex).engine.renderMode).toBe('simple-ribbon');
    expect(JSON.stringify(timelineStrokeAt(malformedIndex).engine.anchors))
      .toBe(beforeMalformedAnchors);
    expect(timelineStrokeAt(liveIndex).engine.renderMode).toBe('simple-ribbon');
    // Out-of-timeline / unknown ids wrote nothing.
    expect(getRecordedAquarelleStroke(deleted)!.renderMode).toBeUndefined();
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(timelineSize);
    // ONE bump for the two written strokes.
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });
});
