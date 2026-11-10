// ============================================================
//  61-10 Task 3 — whole-stroke moves carry the vector path.
//
//  Translate/transform map POINTS ONLY today. Once a stroke is a
//  path, its anchors and every stored handle endpoint must move
//  through the SAME map, and the payload entry's opaque
//  `engine.anchors` must come from the stroke — never a stale
//  pre-edit copy (T-61-34). A hand-painted stroke keeps its exact
//  previous shape: no anchors key ever appears (REL-02). An
//  unreadable path is refused whole — no partial write.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  toStudioStroke as aquarelleToStudioStroke,
  type AquarelleAnchor,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  transformAquarelleStrokesInScript,
  translateAquarelleStrokesInScript,
  updateAquarellePathInScript,
  type AquarelleStrokeTransform,
} from './aquarelleRecordState';

type AquarelleTimelineStroke = ReturnType<typeof aquarelleToStudioStroke>;

/** Non-default sample fields — every mapping must copy them untouched. */
function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 0.25, tx: 0.5, ty: -0.5, tw: 0.75 };
}

function stroke(
  mutationId: number,
  points: readonly AquarellePoint[],
  anchors?: readonly AquarelleAnchor[],
): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points,
    mutationId,
    timestamp: mutationId,
    playFrame: 601,
    ...(anchors === undefined ? {} : { anchors }),
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

interface ExpectedAnchor {
  readonly x: number;
  readonly y: number;
  readonly kind: 'auto' | 'bezier';
  readonly in?: { readonly x: number; readonly y: number };
  readonly out?: { readonly x: number; readonly y: number };
  readonly width?: number;
}

/** Exact-shape anchor comparison: coordinates close, optional keys PRESENT or ABSENT. */
function expectAnchor(anchor: AquarelleAnchor | undefined, expected: ExpectedAnchor): void {
  expect(anchor).toBeDefined();
  expect(anchor!.x).toBeCloseTo(expected.x, 12);
  expect(anchor!.y).toBeCloseTo(expected.y, 12);
  expect(anchor!.kind).toBe(expected.kind);
  expect(anchor!.width).toBe(expected.width);
  if (expected.in === undefined) {
    expect(anchor).not.toHaveProperty('in');
  } else {
    expect(anchor!.in!.x).toBeCloseTo(expected.in.x, 12);
    expect(anchor!.in!.y).toBeCloseTo(expected.in.y, 12);
  }
  if (expected.out === undefined) {
    expect(anchor).not.toHaveProperty('out');
  } else {
    expect(anchor!.out!.x).toBeCloseTo(expected.out.x, 12);
    expect(anchor!.out!.y).toBeCloseTo(expected.out.y, 12);
  }
}

/** A bezier anchor with both handles + a width, and an auto anchor with a width. */
const PATH: readonly AquarelleAnchor[] = [
  { x: 0.2, y: 0.4, kind: 'bezier', in: { x: 0.15, y: 0.35 }, out: { x: 0.25, y: 0.45 }, width: 1.8 },
  { x: 0.6, y: 0.8, kind: 'auto', width: 0.4 },
];

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

describe('61-10 aquarelle whole-stroke moves carry the vector path', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('translate moves anchors, handles and points by the same delta and the entry agrees', () => {
    const id = 9101;
    recordAquarelleStroke(id, stroke(id, [point(0.2, 0.4), point(0.6, 0.8)], PATH));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const beforeEntry = timelineStrokeAt(index);
    const beforeStroke = getRecordedAquarelleStroke(id)!;
    const revision = aquarelleStrokesRevision.value;

    expect(translateAquarelleStrokesInScript([id], 0.1, 0.2)).toBe(1);

    const moved = getRecordedAquarelleStroke(id)!;
    expect(moved).not.toBe(beforeStroke);
    const anchors = moved.anchors!;
    expect(anchors).toHaveLength(2);
    // The bezier anchor AND both stored handles move by the delta.
    expectAnchor(anchors[0], {
      x: 0.3,
      y: 0.6,
      kind: 'bezier',
      in: { x: 0.25, y: 0.55 },
      out: { x: 0.35, y: 0.65 },
      width: 1.8,
    });
    // The auto anchor gains no invented handle keys and keeps its width.
    expectAnchor(anchors[1], { x: 0.7, y: 1, kind: 'auto', width: 0.4 });
    // Points move by the same delta — a point and its anchor share their place.
    expect(moved.points[0]!.x).toBeCloseTo(0.3, 12);
    expect(moved.points[0]!.y).toBeCloseTo(0.6, 12);
    expect(moved.points[1]!.x).toBeCloseTo(0.7, 12);
    expect(moved.points[1]!.y).toBeCloseTo(1, 12);
    expect(moved.points[0]!.x - anchors[0]!.x).toBeCloseTo(0, 12);
    expect(moved.points[0]!.y - anchors[0]!.y).toBeCloseTo(0, 12);
    // The payload entry carries the SAME anchors — never a stale copy (T-61-34).
    const movedEntry = timelineStrokeAt(index);
    expect(movedEntry).not.toBe(beforeEntry);
    expect(movedEntry.engine.anchors).toEqual(anchors);
    expect(movedEntry.pts[0]!.x).toBeCloseTo(0.3, 12);
    expect(movedEntry.pts[0]!.y).toBeCloseTo(0.6, 12);
    // SAME index, ONE bump, and the sample fields survive untouched.
    expect(getRecordedAquarellePayloadTimeline().indexOf(beforeEntry)).toBe(-1);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
    expect(moved.points[0]!.p).toBe(0.25);
    expect(moved.points[0]!.tx).toBe(0.5);
    expect(moved.points[0]!.ty).toBe(-0.5);
    expect(moved.points[0]!.tw).toBe(0.75);
    // The original objects were never mutated in place.
    expect(beforeStroke.anchors![0]!.x).toBe(0.2);
  });

  it('transform maps anchors and handles through the point map and keeps the widths', () => {
    const id = 9103;
    recordAquarelleStroke(id, stroke(id, [point(0.2, 0.4), point(0.6, 0.8)], PATH));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const beforeEntry = timelineStrokeAt(index);
    const beforeStroke = getRecordedAquarelleStroke(id)!;
    // The width factor is scale-invariant — the literal 1.8 both sides.
    expect(beforeStroke.anchors![0]!.width).toBe(1.8);
    const revision = aquarelleStrokesRevision.value;

    expect(transformAquarelleStrokesInScript([id], SCALE_2)).toBe(1);

    const transformed = getRecordedAquarelleStroke(id)!;
    const anchors = transformed.anchors!;
    expectAnchor(anchors[0], {
      x: -0.1,
      y: 0.3,
      kind: 'bezier',
      in: { x: -0.2, y: 0.2 },
      out: { x: 0, y: 0.4 },
      width: 1.8,
    });
    expectAnchor(anchors[1], { x: 0.7, y: 1.1, kind: 'auto', width: 0.4 });
    expect(anchors[0]!.width).toBe(1.8);
    // Points use the SAME map as the anchors.
    expect(transformed.points[0]!.x).toBeCloseTo(-0.1, 12);
    expect(transformed.points[0]!.y).toBeCloseTo(0.3, 12);
    expect(transformed.points[1]!.x).toBeCloseTo(0.7, 12);
    expect(transformed.points[1]!.y).toBeCloseTo(1.1, 12);
    // The entry's opaque engine copy follows the stroke (no stale anchors).
    const transformedEntry = timelineStrokeAt(index);
    expect(transformedEntry).not.toBe(beforeEntry);
    expect(transformedEntry.engine.anchors).toEqual(anchors);
    expect(transformedEntry.pts[0]!.x).toBeCloseTo(-0.1, 12);
    expect(transformedEntry.pts[0]!.y).toBeCloseTo(0.3, 12);
    expect(getRecordedAquarellePayloadTimeline().indexOf(beforeEntry)).toBe(-1);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
    // Co-ordinates only — the sample fields survive untouched.
    expect(transformed.points[0]!.p).toBe(0.25);
    expect(transformed.points[0]!.tx).toBe(0.5);
    expect(transformedEntry.pts[0]!.p).toBe(0.25);
  });

  it('a hand-painted stroke gains no anchors key and keeps its whole entry shape', () => {
    const id = 9105;
    recordAquarelleStroke(id, stroke(id, [point(0.1, 0.5), point(0.2, 0.4)]));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const beforeEntry = timelineStrokeAt(index);
    const beforeStroke = getRecordedAquarelleStroke(id)!;
    expect('anchors' in beforeStroke).toBe(false);
    expect('anchors' in beforeEntry.engine).toBe(false);

    expect(translateAquarelleStrokesInScript([id], 0.1, 0.2)).toBe(1);
    const moved = getRecordedAquarelleStroke(id)!;
    const movedEntry = timelineStrokeAt(index);
    expect('anchors' in moved).toBe(false);
    expect('anchors' in movedEntry.engine).toBe(false);
    // Everything except the points that MUST move is byte-identical.
    expect({ ...movedEntry, pts: null }).toEqual({ ...beforeEntry, pts: null });

    expect(transformAquarelleStrokesInScript([id], SCALE_2)).toBe(1);
    const transformed = getRecordedAquarelleStroke(id)!;
    const transformedEntry = timelineStrokeAt(index);
    expect('anchors' in transformed).toBe(false);
    expect('anchors' in transformedEntry.engine).toBe(false);
    expect({ ...transformedEntry, pts: null }).toEqual({ ...beforeEntry, pts: null });
  });

  it('refuses a malformed or empty path whole, leaving the stroke and entry untouched', () => {
    const id = 9107;
    recordAquarelleStroke(id, stroke(id, [point(0.2, 0.4), point(0.6, 0.8)], PATH));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const beforeStroke = getRecordedAquarelleStroke(id)!;
    const beforeEntry = timelineStrokeAt(index);
    const revision = aquarelleStrokesRevision.value;
    const timeline = [...getRecordedAquarellePayloadTimeline()];

    // Non-finite coordinate, empty list, out-of-range width, unknown id: all 0.
    expect(updateAquarellePathInScript(id, [{ x: Number.NaN, y: 0.5, kind: 'auto' }])).toBe(0);
    expect(updateAquarellePathInScript(id, [])).toBe(0);
    expect(updateAquarellePathInScript(id, [{ x: 0.2, y: 0.4, kind: 'auto', width: 9 }])).toBe(0);
    expect(updateAquarellePathInScript(999999, PATH)).toBe(0);

    expect(aquarelleStrokesRevision.value).toBe(revision);
    expect(getRecordedAquarelleStroke(id)).toBe(beforeStroke);
    expect(timelineStrokeAt(index)).toBe(beforeEntry);
    expect(getRecordedAquarellePayloadTimeline()).toEqual(timeline);
  });

  it('replaces both strokes of a mixed batch at their own indexes with ONE bump', () => {
    const vectorId = 9109;
    const plainId = 9111;
    recordAquarelleStroke(vectorId, stroke(vectorId, [point(0.2, 0.4)], PATH));
    recordAquarelleStroke(plainId, stroke(plainId, [point(0.3, 0.5)]));
    const vectorIndex = getRecordedAquarellePayloadTimeline().length - 2;
    const plainIndex = getRecordedAquarellePayloadTimeline().length - 1;
    const beforeVectorEntry = timelineStrokeAt(vectorIndex);
    const beforePlainEntry = timelineStrokeAt(plainIndex);
    const revision = aquarelleStrokesRevision.value;

    expect(translateAquarelleStrokesInScript([vectorId, plainId], 0.1, 0.2)).toBe(2);

    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(2);
    expect(getRecordedAquarellePayloadTimeline().indexOf(beforeVectorEntry)).toBe(-1);
    expect(getRecordedAquarellePayloadTimeline().indexOf(beforePlainEntry)).toBe(-1);
    // The vector entry's opaque copy MOVED with its stroke (T-61-34) ...
    expect(timelineStrokeAt(vectorIndex).engine.anchors![0]!.x).toBeCloseTo(0.3, 12);
    expect(timelineStrokeAt(vectorIndex).engine.anchors).toEqual(
      getRecordedAquarelleStroke(vectorId)!.anchors,
    );
    // ... while the hand-painted one gained no key.
    expect('anchors' in timelineStrokeAt(plainIndex).engine).toBe(false);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });
});
