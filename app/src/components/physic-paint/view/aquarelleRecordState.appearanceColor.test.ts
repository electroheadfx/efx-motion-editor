// @vitest-environment node
// ============================================================
//  261113-fkm — a whole-stroke colour apply REPLACES the
//  per-vertex colours.
//
//  D-01: the explicit anchor `color` (261111-wd6) wins over the
//  stroke colour. A whole-stroke colour apply therefore must not
//  only write the stroke colour — it must clear every explicit
//  anchor colour in the SAME write, or the next re-bake replays
//  the old per-vertex variation over the new global colour.
//  Geometry, order, kind, handles and width factors survive; an
//  anchor that carried no colour keeps its exact reference (the
//  sparse profile stays byte-identical) and a hand-painted stroke
//  never gains an `anchors` key.
//
//  D-02: Size/params, brush id, the paint-seed flag and the tool
//  multipliers are NOT colour channels — a patch without `color`
//  never touches the anchor list.
//
//  A same-colour apply on a coloured-anchor stroke is still an
//  edit (the clear changes the stored bytes), so the batch must
//  return 1 instead of silently dropping the clear.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  type AquarelleAnchor,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
  isAquarelleDryEvent,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleStrokesRevision,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  updateAquarelleStrokesInScript,
} from './aquarelleRecordState';

function point(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke(
  mutationId: number,
  options: {
    color?: string | null;
    anchors?: readonly AquarelleAnchor[];
  } = {},
): AquarelleStroke {
  return {
    tool: 'brush',
    color: options.color === undefined ? '#103c65' : options.color,
    params: { size: 12 },
    brushId: 'round',
    points: [point(0.05, 0.05), point(0.95, 0.95)],
    mutationId,
    timestamp: mutationId,
    playFrame: 900,
    ...(options.anchors === undefined ? {} : { anchors: options.anchors }),
  };
}

/**
 * A mixed path: an explicit colour at each end and two anchors that never
 * carried one. Index 1 is the sparse no-colour case whose reference identity
 * is asserted; index 2 is a `bezier` anchor whose handles and width factor
 * must survive the clear untouched.
 */
const MIXED_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.1, y: 0.5, kind: 'auto', color: '#ff0000' },
  { x: 0.35, y: 0.3, kind: 'auto' },
  {
    x: 0.6,
    y: 0.7,
    kind: 'bezier',
    in: { x: 0.5, y: 0.6 },
    out: { x: 0.7, y: 0.8 },
    width: 1.8,
  },
  { x: 0.9, y: 0.4, kind: 'auto', color: '#103c65' },
];

/** The same geometry with no explicit colour on any anchor. */
const COLOURLESS_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.1, y: 0.5, kind: 'auto' },
  { x: 0.35, y: 0.3, kind: 'auto' },
  {
    x: 0.6,
    y: 0.7,
    kind: 'bezier',
    in: { x: 0.5, y: 0.6 },
    out: { x: 0.7, y: 0.8 },
    width: 1.8,
  },
  { x: 0.9, y: 0.4, kind: 'auto' },
];

/** The mixed path as `toStudioStroke` projects it once every colour is gone. */
const MIXED_PROJECTION: readonly AquarelleAnchor[] = COLOURLESS_ANCHORS;

type StrokeEvent = Exclude<AquarellePayloadEvent, { kind: 'dry' }>;

function entryIndexOf(events: readonly AquarellePayloadEvent[], mutationId: number): number {
  return events.findIndex(
    (event) => !isAquarelleDryEvent(event) && event.engine.mutationId === mutationId,
  );
}

function strokeEntryAt(
  events: readonly AquarellePayloadEvent[],
  mutationId: number,
): StrokeEvent {
  const index = entryIndexOf(events, mutationId);
  expect(index, `timeline entry for ${mutationId}`).toBeGreaterThanOrEqual(0);
  const event = events[index]!;
  expect(isAquarelleDryEvent(event)).toBe(false);
  return event as StrokeEvent;
}

function hasOwnColor(anchor: AquarelleAnchor): boolean {
  return Object.prototype.hasOwnProperty.call(anchor, 'color');
}

beforeEach(() => {
  resetAquarelleRecordState();
});

describe('261113-fkm a global colour replaces per-vertex colours', () => {
  it('a global colour clears every explicit anchor colour and re-projects the engine entry', () => {
    const id = 76001;
    recordAquarelleStroke(id, stroke(id, { anchors: MIXED_ANCHORS }));
    const beforeEntry = strokeEntryAt(getRecordedAquarellePayloadTimeline(), id);
    const revision = aquarelleStrokesRevision.value;

    expect(updateAquarelleStrokesInScript([id], { color: '#2f6f3f' })).toBe(1);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);

    const nextStroke = getRecordedAquarelleStroke(id)!;
    expect(nextStroke.color).toBe('#2f6f3f');
    const anchors = nextStroke.anchors!;
    // Geometry, order and kind are preserved exactly.
    expect(anchors).toHaveLength(MIXED_ANCHORS.length);
    expect(anchors.map((anchor) => [anchor.x, anchor.y, anchor.kind])).toEqual(
      MIXED_ANCHORS.map((anchor) => [anchor.x, anchor.y, anchor.kind]),
    );
    // Not one explicit per-vertex colour survives the whole-stroke apply.
    for (const anchor of anchors) {
      expect(hasOwnColor(anchor)).toBe(false);
    }
    // The bezier anchor keeps its stored handles and width factor.
    expect(anchors[2]!.in).toEqual({ x: 0.5, y: 0.6 });
    expect(anchors[2]!.out).toEqual({ x: 0.7, y: 0.8 });
    expect(anchors[2]!.width).toBe(1.8);

    const entry = strokeEntryAt(getRecordedAquarellePayloadTimeline(), id);
    expect(entry.color).toBe('#2f6f3f');
    expect(entry.engine.color).toBe('#2f6f3f');
    // The projection carries the cleared list — never a stale per-vertex colour.
    expect(entry.engine.anchors).toEqual(MIXED_PROJECTION);
    // The geometry halves of the entry are the pre-edit values.
    expect(entry.pts).toEqual(beforeEntry.pts);
    expect(entry.cuisson).toBe(beforeEntry.cuisson);
    expect(entry.recordedOrder).toBe(beforeEntry.recordedOrder);
  });

  it('keeps colourless anchors reference-identical', () => {
    const id = 76002;
    recordAquarelleStroke(id, stroke(id, { anchors: MIXED_ANCHORS }));
    const before = getRecordedAquarelleStroke(id)!;

    expect(updateAquarelleStrokesInScript([id], { color: '#2f6f3f' })).toBe(1);

    const after = getRecordedAquarelleStroke(id)!;
    // Only anchors that carried a colour are rebuilt; the sparse ones are the
    // SAME objects, so a never-coloured anchor can never gain a key.
    expect(after.anchors![1]).toBe(before.anchors![1]);
    expect(after.anchors![2]).toBe(before.anchors![2]);

    // A colour apply on a stroke whose anchors carry no colour leaves the
    // array itself reference-identical. The colour differs, so this is a real
    // write (1) and not the unchanged-drop path.
    const colourlessId = 76003;
    recordAquarelleStroke(colourlessId, stroke(colourlessId, { anchors: COLOURLESS_ANCHORS }));
    const beforeColourless = getRecordedAquarelleStroke(colourlessId)!;
    expect(updateAquarelleStrokesInScript([colourlessId], { color: '#00ff00' })).toBe(1);
    const afterColourless = getRecordedAquarelleStroke(colourlessId)!;
    expect(afterColourless.color).toBe('#00ff00');
    expect(afterColourless.anchors).toBe(beforeColourless.anchors);
  });

  it('a hand-painted stroke gains no anchors key', () => {
    const id = 76004;
    recordAquarelleStroke(id, stroke(id));
    expect(Object.prototype.hasOwnProperty.call(getRecordedAquarelleStroke(id)!, 'anchors')).toBe(
      false,
    );

    expect(updateAquarelleStrokesInScript([id], { color: '#2f6f3f' })).toBe(1);

    const nextStroke = getRecordedAquarelleStroke(id)!;
    expect(nextStroke.color).toBe('#2f6f3f');
    expect(Object.prototype.hasOwnProperty.call(nextStroke, 'anchors')).toBe(false);
    const entry = strokeEntryAt(getRecordedAquarellePayloadTimeline(), id);
    expect(entry.color).toBe('#2f6f3f');
    expect(entry.engine.color).toBe('#2f6f3f');
  });

  it('a same-colour apply still stores the edit', () => {
    const id = 76005;
    recordAquarelleStroke(id, stroke(id, { color: '#2f6f3f', anchors: MIXED_ANCHORS }));
    const revision = aquarelleStrokesRevision.value;

    // The stroke colour already equals the patch colour: only the anchor
    // clear changes the stored bytes, so the batch must count the target.
    expect(updateAquarelleStrokesInScript([id], { color: '#2f6f3f' })).toBe(1);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);

    const nextStroke = getRecordedAquarelleStroke(id)!;
    expect(nextStroke.color).toBe('#2f6f3f');
    for (const anchor of nextStroke.anchors!) {
      expect(hasOwnColor(anchor)).toBe(false);
    }
    expect(strokeEntryAt(getRecordedAquarellePayloadTimeline(), id).engine.color).toBe('#2f6f3f');
  });

  it('a params-only Size patch never clears anchor colours', () => {
    const id = 76006;
    recordAquarelleStroke(id, stroke(id, { anchors: MIXED_ANCHORS }));
    const before = getRecordedAquarelleStroke(id)!;
    const revision = aquarelleStrokesRevision.value;

    expect(updateAquarelleStrokesInScript([id], { params: { size: 20 } })).toBe(1);

    const nextStroke = getRecordedAquarelleStroke(id)!;
    expect(nextStroke).not.toBe(before);
    expect(nextStroke.params.size).toBe(20);
    expect(nextStroke.color).toBe('#103c65');
    // D-02: Size is a multiplier channel — the anchor list is untouched,
    // by reference and by content.
    expect(nextStroke.anchors).toBe(before.anchors);
    expect(nextStroke.anchors![0]!.color).toBe('#ff0000');
    expect(nextStroke.anchors![3]!.color).toBe('#103c65');
    // An identical params patch is still a 0 no-op.
    expect(updateAquarelleStrokesInScript([id], { params: { size: 20 } })).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);
  });

  it('a mixed batch writes both targets once', () => {
    const vectorId = 76007;
    const paintedId = 76008;
    recordAquarelleStroke(vectorId, stroke(vectorId, { anchors: MIXED_ANCHORS }));
    recordAquarelleStroke(paintedId, stroke(paintedId));
    const vectorBefore = getRecordedAquarelleStroke(vectorId)!;
    const revision = aquarelleStrokesRevision.value;

    expect(updateAquarelleStrokesInScript([vectorId, paintedId], { color: '#2f6f3f' })).toBe(2);
    expect(aquarelleStrokesRevision.value).toBe(revision + 1);

    const vectorAfter = getRecordedAquarelleStroke(vectorId)!;
    const paintedAfter = getRecordedAquarelleStroke(paintedId)!;
    expect(vectorAfter.color).toBe('#2f6f3f');
    expect(paintedAfter.color).toBe('#2f6f3f');
    // Only the vector's anchors changed.
    expect(vectorAfter.anchors === vectorBefore.anchors).toBe(false);
    for (const anchor of vectorAfter.anchors!) {
      expect(hasOwnColor(anchor)).toBe(false);
    }
    expect(Object.prototype.hasOwnProperty.call(paintedAfter, 'anchors')).toBe(false);

    const events = getRecordedAquarellePayloadTimeline();
    expect(strokeEntryAt(events, vectorId).engine.color).toBe('#2f6f3f');
    expect(strokeEntryAt(events, paintedId).engine.color).toBe('#2f6f3f');
    expect(strokeEntryAt(events, vectorId).engine.anchors).toEqual(MIXED_PROJECTION);
  });
});
