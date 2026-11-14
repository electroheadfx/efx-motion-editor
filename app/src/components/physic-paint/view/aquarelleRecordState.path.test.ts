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
  ANCHOR_WIDTH_MAX,
  sampleVectorPath,
  toStudioStroke as aquarelleToStudioStroke,
  type AquarelleAnchor,
  type AquarelleCurveMode,
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
  updateAquarelleCurveModeInScript,
  updateAquarellePathInScript,
  type AquarelleStrokeTransform,
} from './aquarelleRecordState';
import {
  beginAquarellePathEdit,
  restoreAquarelleEditSnapshot,
  setAquarelleScriptEditInFlight,
} from './aquarelleStrokeSelection';
import { resampleVectorPaintPoints, vectorSpinePressures } from './vectorPathHandles';

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
function sampledSpinePoints(
  anchors: readonly AquarelleAnchor[],
): readonly AquarellePoint[] {
  const sampled = resampleVectorPaintPoints(sampleVectorPath(anchors).points);
  const pressures = vectorSpinePressures(sampled);
  return sampled.map((p, index) => ({
    x: p.x,
    y: p.y,
    p: pressures[index]!,
    tx: 0,
    ty: 0,
    tw: 0,
  }));
}

/** A recorded vector stroke whose `points` are the spine sampled from its anchors. */
function g17VectorStroke(mutationId: number): AquarelleStroke {
  return stroke(mutationId, sampledSpinePoints(G17_PRE_ANCHORS), G17_PRE_ANCHORS);
}

/** The point on a polyline at a fraction of its total arc length (test-side law). */
function pointAtArcFraction(
  points: readonly { readonly x: number; readonly y: number }[],
  fraction: number,
): { x: number; y: number } {
  const first = points[0]!;
  if (points.length < 2) return { x: first.x, y: first.y };
  const stations: number[] = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const point = points[index]!;
    stations.push(stations[index - 1]! + Math.hypot(point.x - previous.x, point.y - previous.y));
  }
  const total = stations[stations.length - 1]!;
  const target = Math.min(Math.max(fraction, 0), 1) * total;
  if (!(total > 0) || target <= 0) return { x: first.x, y: first.y };
  if (target >= total) return { ...points[points.length - 1]! };
  let low = 0;
  let high = stations.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (stations[middle]! <= target) low = middle;
    else high = middle;
  }
  const span = stations[high]! - stations[low]!;
  const t = span > 0 ? (target - stations[low]!) / span : 0;
  const from = points[low]!;
  const to = points[high]!;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
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
    // quick 261112-i6d: the width probe reads the PACKAGE ceiling, so it stays
    // above the (raised) bound instead of becoming a valid stored factor.
    expect(updateAquarellePathInScript(id, [{ x: Number.NaN, y: 0.5, kind: 'auto' }])).toBe(0);
    expect(updateAquarellePathInScript(id, [])).toBe(0);
    expect(
      updateAquarellePathInScript(id, [{ x: 0.2, y: 0.4, kind: 'auto', width: ANCHOR_WIDTH_MAX + 1 }]),
    ).toBe(0);
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
    // The pre-edit spine is the horizontal path, paint-sampled; all y = 0.5.
    expect(before.points).toHaveLength(sampledSpinePoints(G17_PRE_ANCHORS).length);
    expect(before.points[0]!.y).toBe(0.5);
    const revision = aquarelleStrokesRevision.value;
    const spine = sampleVectorPath(G17_NEXT_ANCHORS).points;
    const lastOut = before.points.length - 1;

    expect(updateAquarellePathInScript(id, G17_NEXT_ANCHORS)).toBe(1);

    const after = getRecordedAquarelleStroke(id)!;
    // The anchors moved — this half already worked at HEAD ...
    expectAnchor(after.anchors![1], { x: 0.5, y: 0.62, kind: 'auto' });
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
    // ... and the stored spine MUST move with them: `toStudioStroke` projects
    // `points` into the replay's `pts`, so these points ARE what Shift+R paints.
    expect(after.points[0]!.x).toBeCloseTo(spine[0]!.x, 12);
    expect(after.points[0]!.y).toBeCloseTo(spine[0]!.y, 12);
    expect(after.points[lastOut]!.x).toBeCloseTo(spine[spine.length - 1]!.x, 12);
    expect(after.points[lastOut]!.y).toBeCloseTo(spine[spine.length - 1]!.y, 12);
    // D-08 (62-01): the recorded sample count IS the stroke's `ticks`, so an
    // edit PRESERVES it and redistributes the stations by arc length instead of
    // re-deriving a length-proportional list (the retired pre-62 law).
    expect(after.points).toHaveLength(before.points.length);
    // The mid station lies on the NEW spine at its own arc-length fraction.
    const midIndex = Math.floor(before.points.length / 2);
    const mid = pointAtArcFraction(spine, midIndex / (before.points.length - 1));
    expect(after.points[midIndex]!.x).toBeCloseTo(mid.x, 12);
    expect(after.points[midIndex]!.y).toBeCloseTo(mid.y, 12);
    expect(after.points).not.toEqual(before.points);
  });

  it('keeps the payload entry’s pts and engine.anchors on the same path', () => {
    const id = 61803;
    recordAquarelleStroke(id, g17VectorStroke(id));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const beforeCount = getRecordedAquarelleStroke(id)!.points.length;
    const spine = sampleVectorPath(G17_NEXT_ANCHORS).points;

    expect(updateAquarellePathInScript(id, G17_NEXT_ANCHORS)).toBe(1);

    const entry = timelineStrokeAt(index);
    const strokeAfter = getRecordedAquarelleStroke(id)!;
    // The opaque copy already moved at HEAD ...
    expect(entry.engine.anchors).toEqual(strokeAfter.anchors);
    // ... but the replay's pts MUST agree with it.
    expect(entry.pts[0]!.x).toBeCloseTo(spine[0]!.x, 12);
    expect(entry.pts[0]!.y).toBeCloseTo(spine[0]!.y, 12);
    const midIndex = Math.floor(beforeCount / 2);
    const mid = pointAtArcFraction(spine, midIndex / (beforeCount - 1));
    expect(entry.pts[midIndex]!.y).toBeCloseTo(mid.y, 12);
    const lastIndex = beforeCount - 1;
    expect(entry.pts[lastIndex]!.y).toBeCloseTo(spine[spine.length - 1]!.y, 12);
    // D-08 (62-01): the entry carries the PRESERVED count, not a re-derived one.
    expect(entry.pts).toHaveLength(beforeCount);
    expect(entry.pts[0]!.y).toBeCloseTo(entry.engine.anchors![0]!.y, 12);
    // The projection keeps the sample fields and re-ticks the new spine.
    for (const sampleIndex of [0, midIndex, lastIndex]) {
      const sample = entry.pts[sampleIndex]!;
      expect(sample.p).toBe(-1);
      expect(sample.tx).toBe(0);
      expect(sample.ty).toBe(0);
      expect(sample.tw).toBe(0);
      expect(sample.tick).toBe(sampleIndex);
    }
  });

  it('preserves the recorded point count on every path write (D-08)', () => {
    const id = 61805;
    // The pre-edit spine is whatever was recorded; a widened path must NOT
    // re-derive a length-proportional station count from it.
    recordAquarelleStroke(id, stroke(id, [point(0.2, 0.5), point(0.8, 0.5)], G17_PRE_ANCHORS));
    expect(getRecordedAquarelleStroke(id)!.points).toHaveLength(2);

    expect(updateAquarellePathInScript(id, G17_WIDE_ANCHORS)).toBe(1);

    const after = getRecordedAquarelleStroke(id)!;
    // D-08 (62-01): the recorded count IS `ticks`, so the write may not change
    // it — the stations are redistributed along the wider spine instead.
    expect(after.points).toHaveLength(2);
    // The geometry DID move: both stations sit on the widened path's endpoints.
    expect(after.points[0]!.x).toBeCloseTo(0.05, 12);
    expect(after.points[1]!.x).toBeCloseTo(0.95, 12);
  });

  it('stamps every preserved sample with the buildVectorStroke point shape', () => {
    const id = 61807;
    // Non-default sample fields on the recorded points prove the write
    // RE-DERIVES the spine instead of carrying the old one.
    recordAquarelleStroke(id, stroke(id, [point(0.2, 0.5), point(0.8, 0.5)], G17_PRE_ANCHORS));
    const before = getRecordedAquarelleStroke(id)!;

    expect(updateAquarellePathInScript(id, G17_NEXT_ANCHORS)).toBe(1);

    const after = getRecordedAquarelleStroke(id)!;
    // D-08 (62-01): the recorded count is preserved, and the two stations sit
    // on the new path's own endpoints.
    expect(after.points).toHaveLength(before.points.length);
    expect(after.points[0]!.y).toBeCloseTo(0.6, 12);
    expect(after.points[1]!.y).toBeCloseTo(0.58, 12);
    for (const sample of after.points) {
      expect(Number.isFinite(sample.x)).toBe(true);
      expect(Number.isFinite(sample.y)).toBe(true);
      expect(sample.tx).toBe(0);
      expect(sample.ty).toBe(0);
      expect(sample.tw).toBe(0);
    }
    // D-07 (62-01): the recorded profile is REMAPPED, never replaced by the
    // cold-start speed sentinel the pre-62 law stamped unconditionally.
    expect(after.points.map((sample) => sample.p)).toEqual([0.25, 0.25]);
  });

  it('feeds the new spine to every replay through getAquarelleEventsForFrame', () => {
    const id = 61809;
    recordAquarelleStroke(id, g17VectorStroke(id));

    expect(updateAquarellePathInScript(id, G17_NEXT_ANCHORS)).toBe(1);

    // The exact replay input the bake consumes: the frame's events.
    const replay = getAquarelleEventsForFrame(601).filter(
      (event): event is AquarelleTimelineStroke => !('kind' in event),
    );
    expect(replay).toHaveLength(1);
    const entry = replay[0]!;
    const strokeAfter = getRecordedAquarelleStroke(id)!;
    expect(entry.engine.mutationId).toBe(id);
    // Both halves of the entry agree on the NEW path ...
    expect(entry.engine.anchors).toEqual(strokeAfter.anchors);
    // ... and the deposited geometry IS the stored, count-preserved spine.
    expect(entry.pts).toHaveLength(strokeAfter.points.length);
    expect(entry.pts.map((p) => [p.x, p.y])).toEqual(
      strokeAfter.points.map((p) => [p.x, p.y]),
    );
  });

  it('restores the pre-edit spine on undo and the re-sampled spine on redo in ONE step', () => {
    const id = 61811;
    recordAquarelleStroke(id, g17VectorStroke(id));
    const before = getRecordedAquarelleStroke(id)!;
    const beforePoints = before.points;
    expect(beforePoints).toHaveLength(sampledSpinePoints(G17_PRE_ANCHORS).length);

    // One gesture through the real selection wrapper.
    setAquarelleScriptEditInFlight(false);
    const editId = beginAquarellePathEdit(id, G17_NEXT_ANCHORS);
    expect(editId).not.toBeNull();
    const convertedPoints = getRecordedAquarelleStroke(id)!.points;
    // D-08 (62-01): the edit PRESERVES the recorded count (it IS `ticks`).
    expect(convertedPoints).toHaveLength(beforePoints.length);

    // UNDO: the old anchors AND the old points come back in one step.
    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    const undone = getRecordedAquarelleStroke(id)!;
    expectAnchor(undone.anchors![1], { x: 0.5, y: 0.5, kind: 'auto' });
    expect(undone.points).toBe(beforePoints);
    expect(undone.points[0]!.y).toBeCloseTo(0.5, 12);
    expect(undone.points[Math.floor(beforePoints.length / 2)]!.y).toBeCloseTo(0.5, 12);

    // REDO: the edited side, points included.
    expect(restoreAquarelleEditSnapshot(editId!, 'redo')).not.toBeNull();
    const redone = getRecordedAquarelleStroke(id)!;
    expectAnchor(redone.anchors![1], { x: 0.5, y: 0.62, kind: 'auto' });
    expect(redone.points).toHaveLength(beforePoints.length);
    expect(redone.points).toEqual(convertedPoints);
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
    // The GEOMETRY is unchanged, but the stations are arc-length placed now:
    // D-08 (62-01) preserves the count and retires the pre-62 length-
    // proportional list, so the array is fresh and differently sampled.
    expect(after.points).not.toBe(before.points);
    expect(after.points).toHaveLength(before.points.length);
    const spine = sampleVectorPath(G17_PRE_ANCHORS).points;
    const midIndex = Math.floor(after.points.length / 2);
    const mid = pointAtArcFraction(spine, midIndex / (after.points.length - 1));
    expect(after.points[midIndex]!.y).toBeCloseTo(mid.y, 12);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });

  it('treats an anchor-colour-only change as a write — never the silent 0', () => {
    const id = 61814;
    recordAquarelleStroke(id, g17VectorStroke(id));
    const before = getRecordedAquarelleStroke(id)!;
    const revision = aquarelleStrokesRevision.value;
    // 261111-wd6: only the middle anchor gains a colour. The spine is
    // unchanged, so only a colour-aware anchorsEqual can see the edit.
    const colourOnly: readonly AquarelleAnchor[] = G17_PRE_ANCHORS.map((anchor, index) =>
      index === 1 ? { ...anchor, color: '#ff0000' } : anchor,
    );

    expect(updateAquarellePathInScript(id, colourOnly)).toBe(1);

    const after = getRecordedAquarelleStroke(id)!;
    expect(after.anchors![1]!.color).toBe('#ff0000');
    expect('color' in after.anchors![0]!).toBe(false);
    expect('color' in after.anchors![2]!).toBe(false);
    // The GEOMETRY is unchanged, but the stations are arc-length placed now:
    // D-08 (62-01) preserves the count and retires the pre-62 length-
    // proportional list, so the array is fresh and differently sampled.
    expect(after.points).not.toBe(before.points);
    expect(after.points).toHaveLength(before.points.length);
    const spine = sampleVectorPath(G17_PRE_ANCHORS).points;
    const midIndex = Math.floor(after.points.length / 2);
    const mid = pointAtArcFraction(spine, midIndex / (after.points.length - 1));
    expect(after.points[midIndex]!.y).toBeCloseTo(mid.y, 12);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);

    // The identical second call stores nothing, bumps nothing and returns 0.
    expect(updateAquarellePathInScript(id, colourOnly)).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });

  it('carries an explicit anchor colour through a translate untouched (both entry halves)', () => {
    const id = 9107;
    const coloured: readonly AquarelleAnchor[] = [
      { x: 0.2, y: 0.4, kind: 'auto', color: '#ff0000', width: 1.5 },
      { x: 0.6, y: 0.8, kind: 'auto' },
    ];
    recordAquarelleStroke(id, stroke(id, [point(0.2, 0.4), point(0.6, 0.8)], coloured));
    const index = getRecordedAquarellePayloadTimeline().length - 1;

    expect(translateAquarelleStrokesInScript([id], 0.1, 0.2)).toBe(1);

    const moved = getRecordedAquarelleStroke(id)!;
    expect(moved.anchors![0]!.color).toBe('#ff0000');
    expect(moved.anchors![0]!.width).toBe(1.5);
    expect('color' in moved.anchors![1]!).toBe(false);
    // The opaque engine block carries the same anchors (T-61-34).
    expect(timelineStrokeAt(index).engine.anchors![0]!.color).toBe('#ff0000');
  });
});

// ============================================================
//  61-30 (G-20) — the curve-mode switch: a committed mode change
//  re-samples the points from the new evaluation in the SAME
//  write, and switching back restores the authored geometry
//  byte-identical (the authored handles are never rewritten).
// ============================================================

/** An authored path with one off-curve bezier anchor, so spline differs from bezier. */
const CURVE_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.2, y: 0.5, kind: 'auto' },
  { x: 0.5, y: 0.5, kind: 'bezier', in: { x: 0.4, y: 0.9 }, out: { x: 0.6, y: 0.1 } },
  { x: 0.8, y: 0.5, kind: 'auto' },
];

/** A second authored path, also with a bezier anchor, used by the path-write case. */
const EDITED_CURVE_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.2, y: 0.6, kind: 'auto' },
  { x: 0.5, y: 0.6, kind: 'bezier', in: { x: 0.4, y: 1 }, out: { x: 0.6, y: 0.2 } },
  { x: 0.8, y: 0.6, kind: 'auto' },
];

/** The derived-auto evaluation view, written out here (never asked from the code under test). */
function splineView(anchors: readonly AquarelleAnchor[]): readonly AquarelleAnchor[] {
  return anchors.map((anchor) => ({
    x: anchor.x,
    y: anchor.y,
    kind: 'auto' as const,
    ...(anchor.width === undefined ? {} : { width: anchor.width }),
  }));
}

/** The sampled spine of one evaluation mode, stamped with the vector commit shape. */
function sampledModePoints(
  anchors: readonly AquarelleAnchor[],
  mode: 'bezier' | 'spline',
): readonly AquarellePoint[] {
  const source = mode === 'spline' ? splineView(anchors) : anchors;
  const sampled = resampleVectorPaintPoints(sampleVectorPath(source).points);
  const pressures = vectorSpinePressures(sampled);
  return sampled.map((p, index) => ({
    x: p.x,
    y: p.y,
    p: pressures[index]!,
    tx: 0,
    ty: 0,
    tw: 0,
  }));
}

/** A recorded vector stroke with the authored anchors and, when given, a curve mode. */
function curveStroke(mutationId: number, mode?: 'bezier' | 'spline'): AquarelleStroke {
  return {
    ...stroke(mutationId, sampledModePoints(CURVE_ANCHORS, mode ?? 'bezier'), CURVE_ANCHORS),
    ...(mode === undefined ? {} : { curveMode: mode }),
  };
}

describe('61-30 G-20 — the curve-mode switch re-samples the path', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('stores the mode and the spline points in one write, is idempotent and restores on bezier', () => {
    const id = 63001;
    recordAquarelleStroke(id, curveStroke(id));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const before = getRecordedAquarelleStroke(id)!;
    const beforeEntry = timelineStrokeAt(index);
    const revision = aquarelleStrokesRevision.value;
    const count = before.points.length;
    const splineSpine = sampleVectorPath(splineView(CURVE_ANCHORS)).points;
    const bezierSpine = sampleVectorPath(CURVE_ANCHORS).points;
    const midIndex = Math.floor(count / 2);
    const midFraction = midIndex / (count - 1);
    const splineMid = pointAtArcFraction(splineSpine, midFraction);
    const bezierMid = pointAtArcFraction(bezierSpine, midFraction);
    // Non-degenerate: the two evaluations differ at the mid station.
    expect(Math.abs(splineMid.y - bezierMid.y)).toBeGreaterThan(1e-3);
    expect('curveMode' in before).toBe(false);

    expect(updateAquarelleCurveModeInScript([id], 'spline')).toBe(1);

    const switched = getRecordedAquarelleStroke(id)!;
    expect(switched.curveMode).toBe('spline');
    // The authored geometry is untouched by the switch — kinds and handles stay.
    expect(switched.anchors).toEqual(CURVE_ANCHORS);
    expectAnchor(switched.anchors![1], {
      x: 0.5,
      y: 0.5,
      kind: 'bezier',
      in: { x: 0.4, y: 0.9 },
      out: { x: 0.6, y: 0.1 },
    });
    // The points ARE the spline evaluation, at the PRESERVED count (D-08).
    expect(switched.points).toHaveLength(count);
    expect(switched.points[0]!.y).toBeCloseTo(splineSpine[0]!.y, 12);
    expect(switched.points[midIndex]!.y).toBeCloseTo(splineMid.y, 12);
    expect(switched.points[count - 1]!.y).toBeCloseTo(
      splineSpine[splineSpine.length - 1]!.y,
      12,
    );
    expect(switched.points).not.toEqual(before.points);
    // The payload entry is replaced at the SAME index with the new mode and pts.
    const switchedEntry = timelineStrokeAt(index);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
    expect(getRecordedAquarellePayloadTimeline().indexOf(beforeEntry)).toBe(-1);
    expect(switchedEntry).not.toBe(beforeEntry);
    expect(switchedEntry.engine.curveMode).toBe('spline');
    expect(switchedEntry.pts).toHaveLength(count);
    expect(switchedEntry.pts[midIndex]!.y).toBeCloseTo(splineMid.y, 12);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);

    // A second identical call is a no-op — one mode, one write, one bump.
    expect(updateAquarelleCurveModeInScript([id], 'spline')).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);

    // Switching back drops the key and returns to the authored Bézier
    // geometry at the same, preserved count.
    expect(updateAquarelleCurveModeInScript([id], 'bezier')).toBe(1);
    const restored = getRecordedAquarelleStroke(id)!;
    expect('curveMode' in restored).toBe(false);
    expect(restored.points).toHaveLength(count);
    expect(restored.points[midIndex]!.y).toBeCloseTo(bezierMid.y, 12);
    expect(restored.points[midIndex]!.y).not.toBeCloseTo(splineMid.y, 6);
    expect('curveMode' in timelineStrokeAt(index).engine).toBe(false);
    expect(aquarelleStrokesRevision.value).toBe(revision + 2);

    // Round-trip: the same mode at the same count reproduces the same stations.
    expect(updateAquarelleCurveModeInScript([id], 'spline')).toBe(1);
    expect(getRecordedAquarelleStroke(id)!.points).toEqual(switched.points);

    // An anchorless stroke and an unknown mode write nothing.
    const plainId = 63003;
    recordAquarelleStroke(plainId, stroke(plainId, [point(0.2, 0.5), point(0.3, 0.5)]));
    const plainRevision = aquarelleStrokesRevision.value;
    expect(updateAquarelleCurveModeInScript([plainId], 'spline')).toBe(0);
    expect(updateAquarelleCurveModeInScript([id], 'linear' as AquarelleCurveMode)).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(plainRevision);
    expect('anchors' in getRecordedAquarelleStroke(plainId)!).toBe(false);
  });

  it('samples the edited path through the stroke stored spline mode', () => {
    const id = 63005;
    recordAquarelleStroke(id, curveStroke(id, 'spline'));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const count = getRecordedAquarelleStroke(id)!.points.length;
    const splineSpine = sampleVectorPath(splineView(EDITED_CURVE_ANCHORS)).points;
    const bezierSpine = sampleVectorPath(EDITED_CURVE_ANCHORS).points;
    // The mid station nearly coincides here, so the non-degeneracy premise is
    // the MAXIMUM divergence across all stations — that is a station the edit
    // must reproduce from the spline evaluation, not from the Bezier one.
    let divergentIndex = 0;
    let divergentDelta = 0;
    for (let station = 0; station < count; station += 1) {
      const fraction = station / (count - 1);
      const delta = Math.abs(
        pointAtArcFraction(splineSpine, fraction).y - pointAtArcFraction(bezierSpine, fraction).y,
      );
      if (delta > divergentDelta) {
        divergentDelta = delta;
        divergentIndex = station;
      }
    }
    const divergentFraction = divergentIndex / (count - 1);
    const splineDivergent = pointAtArcFraction(splineSpine, divergentFraction);
    const bezierDivergent = pointAtArcFraction(bezierSpine, divergentFraction);
    expect(divergentDelta).toBeGreaterThan(1e-3);
    const revision = aquarelleStrokesRevision.value;

    expect(updateAquarellePathInScript(id, EDITED_CURVE_ANCHORS)).toBe(1);

    const after = getRecordedAquarelleStroke(id)!;
    // The mode rides the stroke through the edit ...
    expect(after.curveMode).toBe('spline');
    expect(after.anchors).toEqual(EDITED_CURVE_ANCHORS);
    // ... and the points ARE the spline evaluation of the edited path, at the
    // PRESERVED count (D-08).
    expect(after.points).toHaveLength(count);
    expect(after.points[divergentIndex]!.y).toBeCloseTo(splineDivergent.y, 12);
    expect(after.points[divergentIndex]!.y).not.toBeCloseTo(bezierDivergent.y, 6);
    // The payload entry agrees on both halves in the same write.
    const entry = timelineStrokeAt(index);
    expect(entry.engine.curveMode).toBe('spline');
    expect(entry.pts[divergentIndex]!.y).toBeCloseTo(splineDivergent.y, 12);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });
});

// ============================================================
//  62-01 — a fitted anchor list CONVERTS an anchorless painted
//  stroke through the ONE script write: `anchors` stored,
//  `curveMode` stored only when it is not the default, `points`
//  re-derived from the path, ONE revision bump and ONE timeline
//  index (D-01, D-02, D-12). One undo restores the hand samples
//  exactly (count, coordinates and pressures) and removes both
//  keys; one redo reinstalls the converted pair.
//
//  The fitted list below carries the exact shape
//  `fitVectorPathAnchors` emits — `auto` anchors ON recorded
//  samples — so the conversion seam is pinned without importing
//  the session module this plan also adds (that module's own pins
//  live in `vectorPathCurveBracket.test.ts`).
// ============================================================

/** The fitted anchor shape: `auto` anchors placed ON recorded samples. */
function fittedSamples(points: readonly AquarellePoint[]): readonly AquarelleAnchor[] {
  const indices = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return [...new Set(indices)].map((index) => ({
    x: points[index]!.x,
    y: points[index]!.y,
    kind: 'auto' as const,
  }));
}

/** A hand-recorded Brush stroke: 300 samples, monotone-but-varying pressure. */
function handStroke(mutationId: number): AquarelleStroke {
  const points: AquarellePoint[] = [];
  for (let index = 0; index < 300; index += 1) {
    const t = index / 299;
    points.push({
      x: 0.1 + 0.8 * t,
      y: 0.5 + 0.18 * Math.sin(t * Math.PI * 2),
      p: 0.2 + 0.7 * t,
      tx: 0.5,
      ty: -0.5,
      tw: 0.75,
    });
  }
  return stroke(mutationId, points);
}

describe('62-01 painted-stroke conversion — one write, one undo', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
    setAquarelleScriptEditInFlight(false);
  });

  it('converts a fitted hand stroke in one write: anchors, mode and re-derived points', () => {
    const id = 62001;
    recordAquarelleStroke(id, handStroke(id));
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const before = getRecordedAquarelleStroke(id)!;
    const beforeEntry = timelineStrokeAt(index);
    const revision = aquarelleStrokesRevision.value;
    const fit = fittedSamples(before.points);
    expect(fit).toHaveLength(3);
    expect('anchors' in before).toBe(false);

    const editId = beginAquarellePathEdit(id, fit, { curveMode: 'spline' });
    expect(editId).not.toBeNull();

    const after = getRecordedAquarelleStroke(id)!;
    expect(after.anchors).toEqual(fit);
    expect(after.curveMode).toBe('spline');
    // The points are re-derived from the path — never the hand's own array.
    expect(after.points).not.toBe(before.points);
    expect(after.points).not.toEqual(before.points);
    // Both endpoints sit exactly on the path's endpoints (first/last samples).
    expect(after.points[0]!.x).toBeCloseTo(fit[0]!.x, 12);
    expect(after.points[0]!.y).toBeCloseTo(fit[0]!.y, 12);
    const last = fit.length - 1;
    expect(after.points[after.points.length - 1]!.x).toBeCloseTo(fit[last]!.x, 12);
    expect(after.points[after.points.length - 1]!.y).toBeCloseTo(fit[last]!.y, 12);
    // D-07/D-08 (62-01 Task 3): the conversion PRESERVES the hand's sample
    // count and remaps the recorded profile with both ends pinned.
    expect(after.points).toHaveLength(before.points.length);
    expect(after.points[0]!.p).toBe(before.points[0]!.p);
    expect(after.points[after.points.length - 1]!.p).toBe(
      before.points[before.points.length - 1]!.p,
    );
    // ONE revision bump and ONE entry at the SAME index.
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
    expect(getRecordedAquarellePayloadTimeline()).toHaveLength(1);
    expect(getRecordedAquarellePayloadTimeline().indexOf(beforeEntry)).toBe(-1);
    const entry = timelineStrokeAt(index);
    expect(entry).not.toBe(beforeEntry);
    expect(entry.engine.anchors).toEqual(fit);
    expect(entry.engine.curveMode).toBe('spline');
    expect(entry.pts).toHaveLength(after.points.length);
  });

  it('restores the exact hand samples in one undo and the conversion in one redo', () => {
    const id = 62003;
    recordAquarelleStroke(id, handStroke(id));
    const before = getRecordedAquarelleStroke(id)!;
    const beforePoints = before.points;
    const fit = fittedSamples(beforePoints);

    const editId = beginAquarellePathEdit(id, fit, { curveMode: 'spline' });
    expect(editId).not.toBeNull();
    const convertedPoints = getRecordedAquarelleStroke(id)!.points;
    expect(convertedPoints).not.toBe(beforePoints);

    // UNDO: the hand points — count, coordinates AND pressures — come back,
    // and the conversion's two keys disappear with them (one-way is
    // ledger-reversible, D-01/D-12).
    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    const undone = getRecordedAquarelleStroke(id)!;
    expect(undone.points).toHaveLength(beforePoints.length);
    expect(undone.points).toEqual(beforePoints);
    expect(undone.points.map((sample) => sample.p)).toEqual(
      beforePoints.map((sample) => sample.p),
    );
    expect('anchors' in undone).toBe(false);
    expect('curveMode' in undone).toBe(false);

    // REDO: the converted pair, points included.
    expect(restoreAquarelleEditSnapshot(editId!, 'redo')).not.toBeNull();
    const redone = getRecordedAquarelleStroke(id)!;
    expect(redone.anchors).toEqual(fit);
    expect(redone.curveMode).toBe('spline');
    expect(redone.points).toEqual(convertedPoints);
  });

  it('treats a second identical commit as a silent no-op that mints no ledger entry', () => {
    const id = 62005;
    recordAquarelleStroke(id, handStroke(id));
    const before = getRecordedAquarelleStroke(id)!;
    const fit = fittedSamples(before.points);
    const revision = aquarelleStrokesRevision.value;

    const editId = beginAquarellePathEdit(id, fit, { curveMode: 'spline' });
    expect(editId).not.toBeNull();
    const converted = getRecordedAquarelleStroke(id)!;
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);

    // The identical second commit stores nothing, bumps nothing, mints no edit.
    expect(beginAquarellePathEdit(id, fit, { curveMode: 'spline' })).toBeNull();
    expect(getRecordedAquarelleStroke(id)).toBe(converted);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);

    // The next REAL edit takes the immediate successor id: neither the first
    // write nor the no-op birthed a second ledger entry.
    const moved = fit.map((anchor, anchorIndex) =>
      anchorIndex === 1 ? { ...anchor, y: anchor.y + 0.02 } : anchor,
    );
    expect(beginAquarellePathEdit(id, moved, { curveMode: 'spline' })).toBe(editId! + 1);
  });

  it('refuses a degenerate stroke and an unreadable path without writing', () => {
    const id = 62007;
    recordAquarelleStroke(
      id,
      stroke(id, [{ x: Number.NaN, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 }]),
    );
    const before = getRecordedAquarelleStroke(id)!;
    const revision = aquarelleStrokesRevision.value;

    expect(beginAquarellePathEdit(id, [])).toBeNull();
    expect(beginAquarellePathEdit(id, [{ x: Number.NaN, y: 0.5, kind: 'auto' }])).toBeNull();
    expect(aquarelleStrokesRevision.value).toBe(revision);
    expect(getRecordedAquarelleStroke(id)).toBe(before);
    expect('anchors' in before).toBe(false);
  });

  it('stores no mode key on the in-app route and compares the effective mode on a re-write', () => {
    // The in-app gesture passes NO explicit mode: the default is the ABSENT
    // key, exactly the expression the 62-03 overlay previews with (D-01/D-02).
    const defaultId = 62009;
    recordAquarelleStroke(defaultId, handStroke(defaultId));
    const defaultFit = fittedSamples(getRecordedAquarelleStroke(defaultId)!.points);
    expect(beginAquarellePathEdit(defaultId, defaultFit)).not.toBeNull();
    const defaultAfter = getRecordedAquarelleStroke(defaultId)!;
    expect(defaultAfter.anchors).toEqual(defaultFit);
    expect('curveMode' in defaultAfter).toBe(false);
    expect('curveMode' in timelineStrokeAt(0).engine).toBe(false);

    // An explicit default mode also writes no key ...
    const explicitDefaultId = 62011;
    recordAquarelleStroke(explicitDefaultId, handStroke(explicitDefaultId));
    const explicitFit = fittedSamples(getRecordedAquarelleStroke(explicitDefaultId)!.points);
    expect(
      beginAquarellePathEdit(explicitDefaultId, explicitFit, { curveMode: 'bezier' }),
    ).not.toBeNull();
    expect('curveMode' in getRecordedAquarelleStroke(explicitDefaultId)!).toBe(false);

    // ... a spline conversion stores it, and switching back DROPS it: the
    // write happens on the MODE change alone, with identical anchors.
    const splineId = 62013;
    recordAquarelleStroke(splineId, handStroke(splineId));
    const splineFit = fittedSamples(getRecordedAquarelleStroke(splineId)!.points);
    expect(beginAquarellePathEdit(splineId, splineFit, { curveMode: 'spline' })).not.toBeNull();
    const splineStroke = getRecordedAquarelleStroke(splineId)!;
    expect(splineStroke.curveMode).toBe('spline');
    expect(updateAquarellePathInScript(splineId, splineFit, { curveMode: 'bezier' })).toBe(1);
    const dropped = getRecordedAquarelleStroke(splineId)!;
    expect('curveMode' in dropped).toBe(false);
    expect(dropped.anchors).toEqual(splineFit);
    expect(dropped.points).not.toBe(splineStroke.points);
    // The geometry is identical (same spine, same count); the pressure is
    // re-derived from the samples the flip starts from, so it agrees to
    // interpolation precision rather than bit-for-bit (D-07/D-08).
    expect(dropped.points).toHaveLength(splineStroke.points.length);
    expect(dropped.points.map(({ x, y }) => ({ x, y }))).toEqual(
      splineStroke.points.map(({ x, y }) => ({ x, y })),
    );
    for (let sampleIndex = 0; sampleIndex < dropped.points.length; sampleIndex += 1) {
      expect(dropped.points[sampleIndex]!.p).toBeCloseTo(
        splineStroke.points[sampleIndex]!.p,
        9,
      );
    }

    // An unknown mode refuses the whole write, even when the anchors changed
    // (fail-closed: never a silent Bézier fall back — T-62-01).
    const invalidId = 62015;
    recordAquarelleStroke(invalidId, handStroke(invalidId));
    const invalidBefore = getRecordedAquarelleStroke(invalidId)!;
    const invalidRevision = aquarelleStrokesRevision.value;
    const invalidFit = fittedSamples(invalidBefore.points);
    const movedFit = invalidFit.map((anchor, anchorIndex) =>
      anchorIndex === 0 ? { ...anchor, x: anchor.x + 0.01 } : anchor,
    );
    expect(
      updateAquarellePathInScript(invalidId, movedFit, { curveMode: 'linear' as AquarelleCurveMode }),
    ).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(invalidRevision);
    expect(getRecordedAquarelleStroke(invalidId)).toBe(invalidBefore);
  });

  it('changes only the path — tool, frame, params, seed salt and identity are untouched', () => {
    const id = 62017;
    const salted: AquarelleStroke = {
      ...handStroke(id),
      params: { size: 12, water: 30, paintSeedSalt: 3 },
    };
    recordAquarelleStroke(id, salted);
    const index = getRecordedAquarellePayloadTimeline().length - 1;
    const before = getRecordedAquarelleStroke(id)!;
    const beforeEntry = timelineStrokeAt(index);
    const fit = fittedSamples(before.points);

    expect(beginAquarellePathEdit(id, fit, { curveMode: 'spline' })).not.toBeNull();

    const after = getRecordedAquarelleStroke(id)!;
    const afterEntry = timelineStrokeAt(index);
    // Identity and every non-path field ride the spread untouched.
    expect(after.mutationId).toBe(id);
    expect(after.timestamp).toBe(before.timestamp);
    expect(after.playFrame).toBe(before.playFrame);
    expect(after.tool).toBe(before.tool);
    expect(after.color).toBe(before.color);
    expect(after.brushId).toBe(before.brushId);
    expect(after.params).toBe(before.params);
    // No seed bump: the projection's traceSeed is byte-identical (CRV-02).
    expect(afterEntry.traceSeed).toBe(beforeEntry.traceSeed);
    expect(afterEntry.engine.params).toEqual(beforeEntry.engine.params);
    // The ONLY changed keys are the path's three.
    const afterFields = after as unknown as Record<string, unknown>;
    const beforeFields = before as unknown as Record<string, unknown>;
    const changed = Object.keys(after)
      .filter((key) => afterFields[key] !== beforeFields[key])
      .sort();
    expect(changed).toEqual(['anchors', 'curveMode', 'points']);
  });
});

// ============================================================
//  62-01 — D-07/D-08: every edit seam PRESERVES the stroke's
//  sample count (the count IS `ticks`, so the wet lifetime never
//  moves with path length) and REMAPS the recorded pressure along
//  the NEW spine by arc length, both endpoints pinned.
// ============================================================

/** A five-sample stroke on a straight line with a real, non-uniform profile. */
function pressureStroke(mutationId: number): AquarelleStroke {
  const xs = [0.2, 0.25, 0.5, 0.55, 0.8];
  const ps = [0.2, 0.3, 0.5, 0.7, 0.9];
  return stroke(
    mutationId,
    xs.map((x, index) => ({ x, y: 0.5, p: ps[index]!, tx: 0, ty: 0, tw: 0 })),
  );
}

describe('62-01 D-07/D-08 — count preservation and the pressure remap', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('preserves the recorded sample count through a much longer and a much shorter spine', () => {
    const id = 62101;
    recordAquarelleStroke(id, pressureStroke(id));
    expect(getRecordedAquarelleStroke(id)!.points).toHaveLength(5);

    const longAnchors: readonly AquarelleAnchor[] = [
      { x: 0.1, y: 0.2, kind: 'auto' },
      { x: 0.5, y: 0.8, kind: 'auto' },
      { x: 0.9, y: 0.2, kind: 'auto' },
    ];
    expect(updateAquarellePathInScript(id, longAnchors)).toBe(1);
    expect(getRecordedAquarelleStroke(id)!.points).toHaveLength(5);

    const shortAnchors: readonly AquarelleAnchor[] = [
      { x: 0.45, y: 0.5, kind: 'auto' },
      { x: 0.55, y: 0.5, kind: 'auto' },
    ];
    expect(updateAquarellePathInScript(id, shortAnchors)).toBe(1);
    const after = getRecordedAquarelleStroke(id)!;
    expect(after.points).toHaveLength(5);
    // Endpoints pinned to the NEW spine's own endpoints.
    expect(after.points[0]!.x).toBeCloseTo(0.45, 12);
    expect(after.points[4]!.x).toBeCloseTo(0.55, 12);
  });

  it('spaces the preserved samples evenly along the new spine by arc length', () => {
    const id = 62103;
    recordAquarelleStroke(id, pressureStroke(id));
    const anchors: readonly AquarelleAnchor[] = [
      { x: 0.2, y: 0.5, kind: 'auto' },
      { x: 0.8, y: 0.5, kind: 'auto' },
    ];
    expect(updateAquarellePathInScript(id, anchors)).toBe(1);

    const points = getRecordedAquarelleStroke(id)!.points;
    expect(points).toHaveLength(5);
    const steps: number[] = [];
    for (let index = 1; index < points.length; index += 1) {
      steps.push(
        Math.hypot(
          points[index]!.x - points[index - 1]!.x,
          points[index]!.y - points[index - 1]!.y,
        ),
      );
    }
    const total = steps.reduce((sum, step) => sum + step, 0);
    for (const step of steps) expect(step).toBeCloseTo(total / 4, 9);
  });

  it('remaps the recorded pressure by arc length with both endpoints pinned', () => {
    const id = 62105;
    recordAquarelleStroke(id, pressureStroke(id));
    const anchors: readonly AquarelleAnchor[] = [
      { x: 0.1, y: 0.5, kind: 'auto' },
      { x: 0.9, y: 0.5, kind: 'auto' },
    ];
    expect(updateAquarellePathInScript(id, anchors)).toBe(1);

    const pressures = getRecordedAquarelleStroke(id)!.points.map((sample) => sample.p);
    // The source stations sit at arc fractions 0, 1/12, 1/2, 7/12 and 1; the
    // output stations at 0, 1/4, 1/2, 3/4 and 1 take the interpolated values.
    expect(pressures).toHaveLength(5);
    expect(pressures[0]).toBe(0.2);
    expect(pressures[1]).toBeCloseTo(0.38, 9);
    expect(pressures[2]).toBeCloseTo(0.5, 9);
    expect(pressures[3]).toBeCloseTo(0.78, 9);
    expect(pressures[4]).toBe(0.9);
  });

  it('keeps an all-sentinel stroke sentinel through the reshape', () => {
    const id = 62107;
    const sentinel = (x: number): AquarellePoint => ({
      x,
      y: 0.5,
      p: -1,
      tx: 0,
      ty: 0,
      tw: 0,
    });
    recordAquarelleStroke(
      id,
      stroke(id, [sentinel(0.2), sentinel(0.4), sentinel(0.6), sentinel(0.8)], [
        { x: 0.2, y: 0.5, kind: 'auto' },
        { x: 0.8, y: 0.5, kind: 'auto' },
      ]),
    );
    const anchors: readonly AquarelleAnchor[] = [
      { x: 0.1, y: 0.2, kind: 'auto' },
      { x: 0.5, y: 0.8, kind: 'auto' },
      { x: 0.9, y: 0.2, kind: 'auto' },
    ];
    expect(updateAquarellePathInScript(id, anchors)).toBe(1);
    const points = getRecordedAquarelleStroke(id)!.points;
    expect(points).toHaveLength(4);
    expect(points.map((sample) => sample.p)).toEqual([-1, -1, -1, -1]);
  });
});
