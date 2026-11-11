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
  sampleVectorPath,
  toStudioStroke as aquarelleToStudioStroke,
  type AquarelleAnchor,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  getAquarelleEventsForFrame,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  transformAquarelleStrokesInScript,
  translateAquarelleStrokesInScript,
  updateAquarellePathInScript,
  type AquarelleStrokeTransform,
} from './aquarelleRecordState';
import {
  beginAquarellePathEdit,
  restoreAquarelleEditSnapshot,
  setAquarelleScriptEditInFlight,
} from './aquarelleStrokeSelection';

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

// ============================================================
//  61-29 G-17 — a committed path edit must reach the rendered
//  paint. `toStudioStroke` projects `points` into the replay's
//  `pts`, so the recorded points ARE the geometry every replay
//  deposits; a write that replaces `anchors` but keeps the old
//  points leaves the entry's two halves disagreeing and a forced
//  Shift+R reproduces the PRE-edit curve.
//
//  The two paths below sample to different spines (302 vs 304
//  stations) so a stale array is distinguishable by BOTH its
//  coordinates and its length.
// ============================================================

const G17_PRE_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.2, y: 0.5, kind: 'auto' },
  { x: 0.5, y: 0.5, kind: 'auto' },
  { x: 0.8, y: 0.5, kind: 'auto' },
];

const G17_NEXT_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.2, y: 0.6, kind: 'auto' },
  { x: 0.5, y: 0.62, kind: 'auto' },
  { x: 0.8, y: 0.58, kind: 'auto' },
];

/** A WIDER path whose sampled station count differs from the pre-edit spine. */
const G17_WIDE_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.05, y: 0.5, kind: 'auto' },
  { x: 0.5, y: 0.5, kind: 'auto' },
  { x: 0.95, y: 0.5, kind: 'auto' },
];

/** The exact six-field shape `buildVectorStroke` stamps onto a fresh commit. */
function sampledSpinePoints(anchors: readonly AquarelleAnchor[]): readonly AquarellePoint[] {
  return sampleVectorPath(anchors).points.map((p) => ({
    x: p.x,
    y: p.y,
    p: 1,
    tx: 0,
    ty: 0,
    tw: 0,
  }));
}

/** A recorded vector stroke whose `points` are the spine sampled from its anchors. */
function g17VectorStroke(mutationId: number): AquarelleStroke {
  return {
    ...stroke(mutationId, sampledSpinePoints(G17_PRE_ANCHORS), G17_PRE_ANCHORS),
    renderMode: 'vector',
  };
}

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

describe('61-29 G-17 — the path write carries the replay geometry', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('re-samples the recorded points from the new anchors so every replay paints the new curve', () => {
    const id = 61801;
    recordAquarelleStroke(id, g17VectorStroke(id));
    const before = getRecordedAquarelleStroke(id)!;
    // The pre-edit spine is the horizontal path: 302 stations, all y = 0.5.
    expect(before.points).toHaveLength(302);
    expect(before.points[0]!.y).toBe(0.5);
    const revision = aquarelleStrokesRevision.value;
    const expected = sampledSpinePoints(G17_NEXT_ANCHORS);

    expect(updateAquarellePathInScript(id, G17_NEXT_ANCHORS)).toBe(1);

    const after = getRecordedAquarelleStroke(id)!;
    // The anchors moved — this half already worked at HEAD ...
    expectAnchor(after.anchors![1], { x: 0.5, y: 0.62, kind: 'auto' });
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
    // ... and the stored spine MUST move with them: `toStudioStroke` projects
    // `points` into the replay's `pts`, so these points ARE what Shift+R paints.
    expect(after.points[0]!.x).toBeCloseTo(expected[0]!.x, 12);
    expect(after.points[0]!.y).toBeCloseTo(expected[0]!.y, 12);
    expect(after.points[150]!.y).toBeCloseTo(expected[150]!.y, 12);
    expect(after.points[301]!.y).toBeCloseTo(expected[301]!.y, 12);
    expect(after.points).toHaveLength(expected.length);
    expect(after.points).not.toEqual(before.points);
  });

  it('keeps the payload entry’s pts and engine.anchors on the same path', () => {
    const id = 61803;
    recordAquarelleStroke(id, g17VectorStroke(id));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const expected = sampledSpinePoints(G17_NEXT_ANCHORS);

    expect(updateAquarellePathInScript(id, G17_NEXT_ANCHORS)).toBe(1);

    const entry = timelineStrokeAt(index);
    const strokeAfter = getRecordedAquarelleStroke(id)!;
    // The opaque copy already moved at HEAD ...
    expect(entry.engine.anchors).toEqual(strokeAfter.anchors);
    // ... but the replay's pts MUST agree with it.
    expect(entry.pts[0]!.x).toBeCloseTo(expected[0]!.x, 12);
    expect(entry.pts[0]!.y).toBeCloseTo(expected[0]!.y, 12);
    expect(entry.pts[150]!.y).toBeCloseTo(expected[150]!.y, 12);
    expect(entry.pts[301]!.y).toBeCloseTo(expected[301]!.y, 12);
    expect(entry.pts).toHaveLength(expected.length);
    expect(entry.pts[0]!.y).toBeCloseTo(entry.engine.anchors![0]!.y, 12);
    // The projection keeps the sample fields and re-ticks the new spine.
    for (const sampleIndex of [0, 150, 301]) {
      const sample = entry.pts[sampleIndex]!;
      expect(sample.p).toBe(1);
      expect(sample.tx).toBe(0);
      expect(sample.ty).toBe(0);
      expect(sample.tw).toBe(0);
      expect(sample.tick).toBe(sampleIndex);
    }
  });

  it('re-derives the point count from the anchor geometry on every path write', () => {
    const id = 61805;
    // The pre-edit spine is whatever was recorded; a widened path must not
    // reuse its station count.
    recordAquarelleStroke(id, stroke(id, [point(0.2, 0.5), point(0.8, 0.5)], G17_PRE_ANCHORS));
    expect(getRecordedAquarelleStroke(id)!.points).toHaveLength(2);
    const expected = sampledSpinePoints(G17_WIDE_ANCHORS);
    expect(expected.length).not.toBe(sampleVectorPath(G17_PRE_ANCHORS).points.length);

    expect(updateAquarellePathInScript(id, G17_WIDE_ANCHORS)).toBe(1);

    expect(getRecordedAquarelleStroke(id)!.points).toHaveLength(expected.length);
  });

  it('stamps every re-derived sample with the buildVectorStroke point shape', () => {
    const id = 61807;
    // Non-default sample fields on the recorded points prove the write
    // RE-DERIVES the spine instead of carrying the old one.
    recordAquarelleStroke(id, stroke(id, [point(0.2, 0.5), point(0.8, 0.5)], G17_PRE_ANCHORS));

    expect(updateAquarellePathInScript(id, G17_NEXT_ANCHORS)).toBe(1);

    const after = getRecordedAquarelleStroke(id)!;
    for (const sample of after.points) {
      expect(sample.p).toBe(1);
      expect(sample.tx).toBe(0);
      expect(sample.ty).toBe(0);
      expect(sample.tw).toBe(0);
    }
    expect(after.points).toHaveLength(sampledSpinePoints(G17_NEXT_ANCHORS).length);
  });

  it('feeds the new spine to every replay through getAquarelleEventsForFrame', () => {
    const id = 61809;
    recordAquarelleStroke(id, g17VectorStroke(id));
    const expected = sampledSpinePoints(G17_NEXT_ANCHORS);

    expect(updateAquarellePathInScript(id, G17_NEXT_ANCHORS)).toBe(1);

    // The exact replay input the bake consumes: the frame's events.
    const replay = getAquarelleEventsForFrame(601).filter(
      (event): event is AquarelleTimelineStroke => !('kind' in event),
    );
    expect(replay).toHaveLength(1);
    const entry = replay[0]!;
    expect(entry.engine.mutationId).toBe(id);
    // Both halves of the entry agree on the NEW path ...
    expect(entry.engine.anchors).toEqual(getRecordedAquarelleStroke(id)!.anchors);
    // ... and the deposited geometry IS the re-sampled spine.
    expect(entry.pts).toHaveLength(expected.length);
    expect(entry.pts.map((p) => [p.x, p.y])).toEqual(expected.map((p) => [p.x, p.y]));
  });

  it('restores the pre-edit spine on undo and the re-sampled spine on redo in ONE step', () => {
    const id = 61811;
    recordAquarelleStroke(id, g17VectorStroke(id));
    const before = getRecordedAquarelleStroke(id)!;
    const beforePoints = before.points;
    expect(beforePoints).toHaveLength(302);
    const expected = sampledSpinePoints(G17_NEXT_ANCHORS);

    // One gesture through the real selection wrapper.
    setAquarelleScriptEditInFlight(false);
    const editId = beginAquarellePathEdit(id, G17_NEXT_ANCHORS);
    expect(editId).not.toBeNull();
    expect(getRecordedAquarelleStroke(id)!.points).toHaveLength(expected.length);

    // UNDO: the old anchors AND the old points come back in one step.
    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    const undone = getRecordedAquarelleStroke(id)!;
    expectAnchor(undone.anchors![1], { x: 0.5, y: 0.5, kind: 'auto' });
    expect(undone.points).toBe(beforePoints);
    expect(undone.points[0]!.y).toBeCloseTo(0.5, 12);
    expect(undone.points[150]!.y).toBeCloseTo(0.5, 12);

    // REDO: the edited side, points included.
    expect(restoreAquarelleEditSnapshot(editId!, 'redo')).not.toBeNull();
    const redone = getRecordedAquarelleStroke(id)!;
    expectAnchor(redone.anchors![1], { x: 0.5, y: 0.62, kind: 'auto' });
    expect(redone.points).toHaveLength(expected.length);
    expect(redone.points).toEqual(expected);
  });

  it('treats an anchors-only change as a write even when the sampled spine is identical', () => {
    const id = 61813;
    recordAquarelleStroke(id, g17VectorStroke(id));
    const before = getRecordedAquarelleStroke(id)!;
    const revision = aquarelleStrokesRevision.value;
    // A width factor changes the persisted path but not the spine: the change
    // test reads anchors, never points.
    const widthOnly: readonly AquarelleAnchor[] = G17_PRE_ANCHORS.map((anchor, index) =>
      index === 1 ? { ...anchor, width: 1.5 } : anchor,
    );

    expect(updateAquarellePathInScript(id, widthOnly)).toBe(1);

    const after = getRecordedAquarelleStroke(id)!;
    expectAnchor(after.anchors![1], { x: 0.5, y: 0.5, kind: 'auto', width: 1.5 });
    // The spine is unchanged, but it is a FRESH re-derived array.
    expect(after.points).not.toBe(before.points);
    expect(after.points).toEqual(before.points);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });
});
