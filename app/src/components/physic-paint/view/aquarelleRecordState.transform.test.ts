// ============================================================
//  261024-mz5 Task 3 — transform a recorded Water color stroke.
//
//  Scale/rotate change POINT COORDINATES ONLY: every other
//  point field (p/tx/ty/tw) and the whole `params` bag stay
//  byte-identical — brush size is never scaled (D-06). The
//  stroke and its payload-timeline entry are REPLACED at the
//  SAME index, one revision bump per effective batch, so a
//  snapshot taken before the transform restores the origin by
//  reference on undo.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  toStudioStroke as aquarelleToStudioStroke,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  deleteAquarelleStrokesFromScript,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  transformAquarelleStrokesInScript,
  type AquarelleStrokeTransform,
} from './aquarelleRecordState';
import {
  beginAquarelleTransformEdit,
  restoreAquarelleEditSnapshot,
} from './aquarelleStrokeSelection';

type AquarelleTimelineStroke = ReturnType<typeof aquarelleToStudioStroke>;

/** Non-default sample fields — the transform must copy every one untouched. */
function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 0.25, tx: 0.5, ty: -0.5, tw: 0.75 };
}

function stroke(mutationId: number, points: readonly AquarellePoint[]): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points,
    mutationId,
    timestamp: mutationId,
    playFrame: 601,
  };
}

function timelineStrokeAt(index: number): AquarelleTimelineStroke {
  const event: AquarellePayloadEvent | undefined =
    getRecordedAquarellePayloadTimeline()[index];
  if (!event || 'kind' in event) {
    throw new Error(`expected a stroke event at timeline index ${index}`);
  }
  return event;
}

/** Uniform scale ×2 about the sheet centre (anchor == centre). */
const SCALE_2: AquarelleStrokeTransform = {
  kind: 'scale',
  centerUvX: 0.5,
  centerUvY: 0.5,
  anchorUvX: 0.5,
  anchorUvY: 0.5,
  angleRad: 0,
  scaleX: 2,
  scaleY: 2,
};

/** 90° rotation about the sheet centre (uv space). */
const ROTATE_90: AquarelleStrokeTransform = {
  kind: 'rotate',
  centerUvX: 0.5,
  centerUvY: 0.5,
  anchorUvX: 0.5,
  anchorUvY: 0.5,
  angleRad: Math.PI / 2,
  scaleX: 1,
  scaleY: 1,
};

describe('261024-mz5 aquarelle stroke transform', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('scales every point of both strokes and both timeline entries at the same indexes', () => {
    const first = 7007;
    const second = 7009;
    recordAquarelleStroke(first, stroke(first, [point(0.1, 0.5), point(0.2, 0.4)]));
    recordAquarelleStroke(second, stroke(second, [point(0.3, 0.5)]));
    const firstIndex = getRecordedAquarellePayloadTimeline().length - 2;
    const secondIndex = getRecordedAquarellePayloadTimeline().length - 1;
    const firstEntry = timelineStrokeAt(firstIndex);
    const secondEntry = timelineStrokeAt(secondIndex);
    const firstStroke = getRecordedAquarelleStroke(first)!;
    const secondStroke = getRecordedAquarelleStroke(second)!;
    const revision = aquarelleStrokesRevision.value;

    expect(transformAquarelleStrokesInScript([first, second], SCALE_2)).toBe(2);

    const scaledFirst = getRecordedAquarelleStroke(first)!;
    const scaledSecond = getRecordedAquarelleStroke(second)!;
    expect(scaledFirst).not.toBe(firstStroke);
    expect(scaledSecond).not.toBe(secondStroke);
    expect(scaledFirst.points[0]!.x).toBeCloseTo(-0.3, 12);
    expect(scaledFirst.points[0]!.y).toBeCloseTo(0.5, 12);
    expect(scaledFirst.points[1]!.x).toBeCloseTo(-0.1, 12);
    expect(scaledFirst.points[1]!.y).toBeCloseTo(0.3, 12);
    expect(scaledSecond.points[0]!.x).toBeCloseTo(0.1, 12);
    expect(scaledSecond.points[0]!.y).toBeCloseTo(0.5, 12);

    // SAME index — replay order is preserved (a replace, never a splice).
    expect(getRecordedAquarellePayloadTimeline().indexOf(firstEntry)).toBe(-1);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(2);
    const scaledEntry = timelineStrokeAt(firstIndex);
    expect(scaledEntry).not.toBe(firstEntry);
    expect(scaledEntry.pts[0]!.x).toBeCloseTo(-0.3, 12);
    expect(timelineStrokeAt(secondIndex)).not.toBe(secondEntry);
    expect(timelineStrokeAt(secondIndex).pts[0]!.x).toBeCloseTo(0.1, 12);
    // Identity is by mutationId, so the registry object is the timeline one.
    const registryEntry = getRecordedAquarellePayloadTimeline().find(
      (event): event is AquarelleTimelineStroke =>
        !('kind' in event)
        && (event.engine as { mutationId?: number }).mutationId === first,
    );
    expect(registryEntry).toBe(timelineStrokeAt(firstIndex));

    // Points only: the sample fields and the whole params bag survive.
    expect(scaledFirst.points[0]!.p).toBe(0.25);
    expect(scaledFirst.points[0]!.tx).toBe(0.5);
    expect(scaledFirst.points[0]!.ty).toBe(-0.5);
    expect(scaledFirst.points[0]!.tw).toBe(0.75);
    expect(scaledEntry.pts[0]!.p).toBe(0.25);
    expect(scaledEntry.pts[0]!.tx).toBe(0.5);
    expect(scaledEntry.pts[0]!.ty).toBe(-0.5);
    expect(scaledEntry.pts[0]!.tw).toBe(0.75);
    expect(scaledFirst.params).toBe(firstStroke.params);
    expect(scaledFirst.params).toEqual({ size: 12, water: 30 });
    expect(scaledEntry.engine.params).toEqual({ size: 12, water: 30 });
    expect(scaledEntry.brushId).toBe(firstEntry.brushId);
    expect(scaledEntry.playFrame).toBe(firstEntry.playFrame);
    expect(scaledEntry.recordedOrder).toBe(firstEntry.recordedOrder);

    // The original point objects were never mutated in place.
    expect(firstStroke.points[0]!.x).toBe(0.1);

    // ONE bump for a multi-id batch.
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });

  it('rotates every point about the uv centre', () => {
    const id = 7011;
    recordAquarelleStroke(id, stroke(id, [point(0.1, 0.5)]));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const originalStroke = getRecordedAquarelleStroke(id)!;

    expect(transformAquarelleStrokesInScript([id], ROTATE_90)).toBe(1);

    const rotated = getRecordedAquarelleStroke(id)!;
    // 90° in uv space: (0.1, 0.5) about (0.5, 0.5) → (0.5, 0.1).
    expect(rotated.points[0]!.x).toBeCloseTo(0.5, 12);
    expect(rotated.points[0]!.y).toBeCloseTo(0.1, 12);
    expect(rotated.params).toBe(originalStroke.params);
    expect(timelineStrokeAt(index).pts[0]!.y).toBeCloseTo(0.1, 12);
  });

  it('resizes ONE uv axis about the opposite edge (non-uniform edge scale)', () => {
    const id = 7019;
    recordAquarelleStroke(id, stroke(id, [point(0.1, 0.5), point(0.2, 0.4)]));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const originalStroke = getRecordedAquarelleStroke(id)!;

    // Left-edge anchor at uv x=0, width ×2, y untouched.
    expect(transformAquarelleStrokesInScript([id], {
      kind: 'scale',
      centerUvX: 0.5,
      centerUvY: 0.5,
      anchorUvX: 0,
      anchorUvY: 0.5,
      angleRad: 0,
      scaleX: 2,
      scaleY: 1,
    })).toBe(1);

    const resized = getRecordedAquarelleStroke(id)!;
    expect(resized.points[0]!.x).toBeCloseTo(0.2, 12);
    expect(resized.points[0]!.y).toBeCloseTo(0.5, 12);
    expect(resized.points[1]!.x).toBeCloseTo(0.4, 12);
    expect(resized.points[1]!.y).toBeCloseTo(0.4, 12);
    expect(resized.params).toBe(originalStroke.params);
    expect(timelineStrokeAt(index).pts[0]!.x).toBeCloseTo(0.2, 12);
    expect(timelineStrokeAt(index).pts[0]!.y).toBeCloseTo(0.5, 12);
  });

  it('refuses identity, non-finite, non-positive scales, and empty targets', () => {
    const id = 7013;
    recordAquarelleStroke(id, stroke(id, [point(0.1, 0.5)]));
    const revision = aquarelleStrokesRevision.value;
    const timeline = [...getRecordedAquarellePayloadTimeline()];
    const original = getRecordedAquarelleStroke(id)!;

    // Identity scale / identity rotation.
    expect(transformAquarelleStrokesInScript([id], { ...SCALE_2, scaleX: 1, scaleY: 1 })).toBe(0);
    expect(transformAquarelleStrokesInScript([id], { ...ROTATE_90, angleRad: 0 })).toBe(0);
    // Non-finite geometry.
    expect(transformAquarelleStrokesInScript([id], { ...SCALE_2, centerUvX: Number.NaN })).toBe(0);
    expect(transformAquarelleStrokesInScript([id], { ...SCALE_2, anchorUvY: Number.NaN })).toBe(0);
    expect(transformAquarelleStrokesInScript([id], { ...ROTATE_90, angleRad: Number.POSITIVE_INFINITY })).toBe(0);
    expect(transformAquarelleStrokesInScript([id], { ...SCALE_2, scaleX: Number.NaN })).toBe(0);
    // A collapse scale is refused too — size may never reach zero.
    expect(transformAquarelleStrokesInScript([id], { ...SCALE_2, scaleX: 0 })).toBe(0);
    expect(transformAquarelleStrokesInScript([id], { ...SCALE_2, scaleY: -2 })).toBe(0);
    // Unknown id and an empty batch.
    expect(transformAquarelleStrokesInScript([999999], SCALE_2)).toBe(0);
    expect(transformAquarelleStrokesInScript([], SCALE_2)).toBe(0);

    expect(aquarelleStrokesRevision.value).toBe(revision);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timeline);
    expect(getRecordedAquarelleStroke(id)).toBe(original);

    // Deleted ids are ignored.
    expect(deleteAquarelleStrokesFromScript([id])).toBe(1);
    const revisionAfterDelete = aquarelleStrokesRevision.value;
    expect(transformAquarelleStrokesInScript([id], SCALE_2)).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(revisionAfterDelete);
  });

  it('one transform edit restores the pre-transform points exactly on undo', () => {
    const first = 7015;
    const second = 7017;
    recordAquarelleStroke(first, stroke(first, [point(0.1, 0.5)]));
    recordAquarelleStroke(second, stroke(second, [point(0.2, 0.5)]));
    const firstIndex = getRecordedAquarellePayloadTimeline().length - 2;
    const secondIndex = getRecordedAquarellePayloadTimeline().length - 1;
    const firstStroke = getRecordedAquarelleStroke(first)!;
    const secondStroke = getRecordedAquarelleStroke(second)!;
    const firstEntry = timelineStrokeAt(firstIndex);
    const secondEntry = timelineStrokeAt(secondIndex);

    const editId = beginAquarelleTransformEdit([first, second], ROTATE_90);
    expect(editId).not.toBeNull();
    expect(getRecordedAquarelleStroke(first)).not.toBe(firstStroke);
    expect(getRecordedAquarelleStroke(second)).not.toBe(secondStroke);

    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    expect(getRecordedAquarelleStroke(first)).toBe(firstStroke);
    expect(getRecordedAquarelleStroke(second)).toBe(secondStroke);
    expect(timelineStrokeAt(firstIndex)).toBe(firstEntry);
    expect(timelineStrokeAt(secondIndex)).toBe(secondEntry);
    expect(getRecordedAquarelleStroke(first)!.points[0]!.x).toBe(0.1);
    expect(getRecordedAquarelleStroke(second)!.points[0]!.x).toBe(0.2);
    // The frozen sample fields survived the whole round trip.
    expect(getRecordedAquarelleStroke(first)!.points[0]!.p).toBe(0.25);
  });
});
