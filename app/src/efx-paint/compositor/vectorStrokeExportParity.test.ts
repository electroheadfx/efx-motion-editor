// @vitest-environment node
// ============================================================
//  61-14 Task 1 (VEC-06 / D-14) — draw, save, reopen: the bake
//  inputs come back deep-equal.
//
//  The bake consumes the PROJECTION's output, never the live
//  recorded stroke, so the seams that can silently drop a width
//  factor, a render mode or an anchor list are:
//
//    recorded AquarelleStroke -> toStudioStroke (61-03)
//      -> AQTL v2 encode/decode (61-05)
//      -> restoreAquarelleRecordTimeline -> toStudioStroke
//
//  This file drives the REAL chain end to end — the saved event
//  list is read from the record store (what Save serialises) and
//  the reopened entries are read back from the restored store
//  (what the next bake receives). Deep equality is exact because
//  every fixture value is quantisation-exact for the codec:
//    - uv endpoints 0/1 (u16 round trip), the -1 pressure
//      sentinel, tilt multiples of 1/50 (i16 round trip);
//    - binary32-exact anchor coordinates (0.25/0.5/0.75/0.125/1/0)
//      and Math.fround width factors (f32 round trip).
//  A failure therefore names a real dropped field, never a
//  rounding artefact.
//
//  Per the plan's law, none of these assertions may be relaxed to
//  make the suite pass: a parity failure is a defect in the seam
//  it names.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  toStudioStroke,
  type AquarelleAnchor,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  decodeScriptTimelineBinary,
  encodeScriptTimelineBinary,
} from '../../components/physic-paint/performance/scriptTimelineCodec';
import {
  getRecordedAquarellePayloadTimeline,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
} from '../../components/physic-paint/view/aquarelleRecordState';

type AquarelleTimelineStroke = ReturnType<typeof toStudioStroke>;

/** Non-default sample fields — every value is codec-exact. */
function point(x: number, y: number, p: number): AquarellePoint {
  return { x, y, p, tx: 10, ty: -10, tw: 5 };
}

/** Existing record-fixture style (aquarelleRecordState.transform.test.ts). */
function stroke(
  mutationId: number,
  overrides: Partial<AquarelleStroke> = {},
): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points: [point(0, 0, -1), point(1, 1, 1)],
    mutationId,
    timestamp: mutationId,
    playFrame: 601,
    ...overrides,
  };
}

/** One `auto` anchor carrying the sparse 1.8 width, one `bezier` with handles. */
const VECTOR_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.25, y: 0.5, kind: 'auto', width: Math.fround(1.8) },
  { x: 0.75, y: 0.125, kind: 'bezier', in: { x: 0.5, y: 0.5 }, out: { x: 1, y: 0 } },
];

/**
 * Save then reopen through the shipped chain. `restoreAquarelleRecordTimeline`
 * replaces the whole store, so the returned timeline is exactly what the next
 * frame's bake would receive after an app restart.
 */
function reopen(events: readonly AquarellePayloadEvent[]): readonly AquarellePayloadEvent[] {
  const bytes = encodeScriptTimelineBinary(events);
  restoreAquarelleRecordTimeline(decodeScriptTimelineBinary(bytes));
  return getRecordedAquarellePayloadTimeline();
}

function strokeEntryAt(
  timeline: readonly AquarellePayloadEvent[],
  index = 0,
): AquarelleTimelineStroke {
  const event = timeline[index];
  if (!event || 'kind' in event) {
    throw new Error(`expected a stroke event at timeline index ${index}`);
  }
  return event;
}

describe('61-14 vector stroke export parity', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('reopen parity: a vector stroke keeps its pts, anchor list and render mode', () => {
    recordAquarelleStroke(
      201,
      stroke(201, { brushId: 'simple-ribbon', anchors: VECTOR_ANCHORS, renderMode: 'simple-ribbon' }),
    );
    const saved = [...getRecordedAquarellePayloadTimeline()];
    const savedEntry = strokeEntryAt(saved);

    const reopened = reopen(saved);
    expect(reopened).toHaveLength(1);
    const reopenedEntry = strokeEntryAt(reopened);

    // Whole-entry equality first: any dropped field fails here with a diff.
    expect(reopenedEntry).toStrictEqual(savedEntry);

    // Named fields separately so a failure names what the seam dropped.
    expect(reopenedEntry.pts, 'pts length').toHaveLength(savedEntry.pts.length);
    for (const [index, source] of savedEntry.pts.entries()) {
      const restored = reopenedEntry.pts[index]!;
      expect(restored.x, `pts[${index}].x`).toBe(source.x);
      expect(restored.y, `pts[${index}].y`).toBe(source.y);
      expect(restored.tick, `pts[${index}].tick`).toBe(source.tick);
    }
    expect(reopenedEntry.engine.anchors, 'engine.anchors').toStrictEqual(
      savedEntry.engine.anchors,
    );
    expect(reopenedEntry.engine.renderMode, 'engine.renderMode').toBe('simple-ribbon');

    // The projected anchor shapes, named field by field.
    const anchors = reopenedEntry.engine.anchors!;
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toStrictEqual({
      x: 0.25,
      y: 0.5,
      kind: 'auto',
      width: Math.fround(1.8),
    });
    expect(anchors[1]).toStrictEqual({
      x: 0.75,
      y: 0.125,
      kind: 'bezier',
      in: { x: 0.5, y: 0.5 },
      out: { x: 1, y: 0 },
    });
  });

  it('reopen parity: a uniform-width path reopens with no width key', () => {
    recordAquarelleStroke(
      203,
      stroke(203, {
        brushId: 'simple-ribbon',
        renderMode: 'simple-ribbon',
        anchors: [
          { x: 0, y: 0, kind: 'auto', width: 1 },
          { x: 1, y: 1, kind: 'bezier' },
        ],
      }),
    );
    const savedEntry = strokeEntryAt(getRecordedAquarellePayloadTimeline());
    // The sparse law already dropped the explicit 1.0 at projection time.
    expect('width' in savedEntry.engine.anchors![0]!).toBe(false);

    const reopenedEntry = strokeEntryAt(reopen([...getRecordedAquarellePayloadTimeline()]));
    expect(reopenedEntry).toStrictEqual(savedEntry);
    const anchors = reopenedEntry.engine.anchors!;
    expect(anchors[0]).toStrictEqual({ x: 0, y: 0, kind: 'auto' });
    expect(anchors[1]).toStrictEqual({ x: 1, y: 1, kind: 'bezier' });
    expect('width' in anchors[0]!).toBe(false);
    expect('width' in anchors[1]!).toBe(false);
  });

  it('reopen parity: a default hand-painted stroke keeps its exact pre-phase shape', () => {
    // No anchors, no renderMode: the pre-vector stroke shape (REL-02).
    recordAquarelleStroke(205, stroke(205));
    const savedEntry = strokeEntryAt(getRecordedAquarellePayloadTimeline());
    expect('anchors' in savedEntry.engine).toBe(false);
    expect('renderMode' in savedEntry.engine).toBe(false);

    const reopenedEntry = strokeEntryAt(reopen([...getRecordedAquarellePayloadTimeline()]));
    expect(reopenedEntry).toStrictEqual(savedEntry);
    expect('anchors' in reopenedEntry.engine).toBe(false);
    expect('renderMode' in reopenedEntry.engine).toBe(false);
  });

  it('reopen parity: a hand-painted stroke keeps its render mode and never gains a path', () => {
    // D-14: the mode applies to BOTH families — a hand-painted stroke
    // carries `renderMode` with NO anchor list, before and after reopen.
    recordAquarelleStroke(
      207,
      stroke(207, { brushId: 'simple-ribbon', renderMode: 'simple-ribbon' }),
    );
    const savedEntry = strokeEntryAt(getRecordedAquarellePayloadTimeline());
    expect('anchors' in savedEntry.engine).toBe(false);
    expect(savedEntry.engine.renderMode).toBe('simple-ribbon');

    const reopenedEntry = strokeEntryAt(reopen([...getRecordedAquarellePayloadTimeline()]));
    expect(reopenedEntry).toStrictEqual(savedEntry);
    expect('anchors' in reopenedEntry.engine).toBe(false);
    expect(reopenedEntry.engine.renderMode, 'engine.renderMode').toBe('simple-ribbon');
  });

  it('reopen parity: the engine event count and order match the source', () => {
    recordAquarelleStroke(
      211,
      stroke(211, { brushId: 'simple-ribbon', anchors: VECTOR_ANCHORS, renderMode: 'simple-ribbon' }),
    );
    recordAquarelleStroke(213, stroke(213));
    recordAquarelleStroke(
      215,
      stroke(215, { brushId: 'simple-ribbon', renderMode: 'simple-ribbon' }),
    );
    const saved = [...getRecordedAquarellePayloadTimeline()];
    const savedIds = saved.map((event) => strokeEntryAt([event]).engine.mutationId);

    const reopened = reopen(saved);
    expect(reopened).toHaveLength(saved.length);
    expect(reopened.map((event) => strokeEntryAt([event]).engine.mutationId)).toStrictEqual(
      savedIds,
    );
    expect(savedIds).toStrictEqual([211, 213, 215]);
  });
});
