// ============================================================
//  61-09 Task 1/2 — the vector handle geometry.
//
//  Laws pinned here:
//    - every handle constant is a SCREEN-PIXEL value, so its uv
//      extent shrinks by exactly the zoom factor;
//    - hit priority is handle -> anchor -> nothing, and a pointer
//      farther than the pad from both returns null;
//    - a projection draws nothing for an anchorless path and one
//      marker per anchor otherwise, with a width envelope only
//      when the sparse profile actually stores a factor;
//    - a click on / beside the last anchor is refused and list
//      operations never mutate their input;
//    - `buildVectorStroke` states every required stroke field
//      explicitly (nothing left to an implicit default).
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  type ResolvedAnchorHandles,
  type Vec2,
  type VectorAnchor,
  resolveAnchorHandles,
} from '@efxlab/efx-watercolor/payload';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  ADJACENCY_MIN_PX,
  ANCHOR_BODY_PX,
  ANCHOR_CORE_RADIUS_PX,
  ANCHOR_HIT_PAD_PX,
  DRAG_THRESHOLD_PX,
  FIRST_ANCHOR_HIT_PX,
  HANDLE_BODY_PX,
  buildDraftPath,
  buildVectorStroke,
  deleteAnchorsAt,
  hitTestVectorPath,
  insertAnchorAt,
  isAdjacentToLast,
  moveAnchorBy,
  moveHandleTo,
  pointToSegmentDistancePx,
  projectVectorPath,
  promoteAnchorForDrag,
  screenPadToUv,
  screenToUv,
  uvToScreen,
  type VectorPathCommit,
} from './vectorPathHandles';

const auto = (x: number, y: number): VectorAnchor => ({ x, y, kind: 'auto' });
const bezier = (x: number, y: number, inPt: Vec2, outPt: Vec2): VectorAnchor => ({
  x,
  y,
  kind: 'bezier',
  in: inPt,
  out: outPt,
});

describe('vector handle constants are the shipped screen-pixel law', () => {
  it('publishes the UI-SPEC values verbatim', () => {
    expect(ANCHOR_BODY_PX).toBe(9);
    expect(ANCHOR_HIT_PAD_PX).toBe(8);
    expect(ANCHOR_CORE_RADIUS_PX).toBe(3.5);
    expect(HANDLE_BODY_PX).toBe(7);
    expect(DRAG_THRESHOLD_PX).toBe(3);
    expect(ADJACENCY_MIN_PX).toBe(6);
    expect(FIRST_ANCHOR_HIT_PX).toBe(12);
  });
});

describe('counter-scaling — a screen-pixel extent shrinks by the zoom factor', () => {
  it('converts a screen pad into uv through the displayed width', () => {
    // 8px on a 1000-unit document displayed at 2x.
    expect(screenPadToUv(ANCHOR_HIT_PAD_PX, 1000, 2)).toBeCloseTo(0.004, 12);
  });

  it('keeps the anchor marker screen size constant at zoom 1, 2 and 4', () => {
    const uvExtent = (scale: number) => screenPadToUv(ANCHOR_BODY_PX, 1000, scale);
    expect(uvExtent(1)).toBeCloseTo(0.009, 12);
    expect(uvExtent(2)).toBeCloseTo(0.0045, 12);
    expect(uvExtent(4)).toBeCloseTo(0.00225, 12);
    // Exactly one zoom factor between each step — no accumulated drift.
    expect(uvExtent(2)).toBeCloseTo(uvExtent(1) / 2, 12);
    expect(uvExtent(4)).toBeCloseTo(uvExtent(1) / 4, 12);
  });

  it('maps document uv to layer pixels with the y axis flipped', () => {
    expect(uvToScreen({ x: 0.25, y: 0.75 }, 800, 600)).toEqual({ x: 200, y: 150 });
    expect(screenToUv({ x: 200, y: 150 }, 800, 600)).toEqual({ x: 0.25, y: 0.75 });
    expect(screenToUv(uvToScreen({ x: 0.1, y: 0.9 }, 500, 400), 500, 400)).toEqual({
      x: 0.1,
      y: 0.9,
    });
  });
});

describe('pointToSegmentDistancePx', () => {
  it('measures the perpendicular distance inside the segment', () => {
    expect(pointToSegmentDistancePx({ x: 3, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBe(3);
  });

  it('falls back to the endpoint beyond the segment', () => {
    expect(
      pointToSegmentDistancePx({ x: 3, y: 14 }, { x: 0, y: 0 }, { x: 0, y: 10 }),
    ).toBeCloseTo(5, 12);
  });
});

describe('hit priority — handle before anchor before nothing', () => {
  it('returns the handle when a handle and its anchor overlap inside the pad', () => {
    const anchors = [bezier(0.5, 0.5, { x: 0.4995, y: 0.5 }, { x: 0.5005, y: 0.5 })];
    const handles = resolveAnchorHandles(anchors);
    expect(hitTestVectorPath(anchors, handles, { x: 0.4995, y: 0.5 }, 1000, 1000, 1)).toEqual({
      kind: 'handle-in',
      index: 0,
    });
    expect(hitTestVectorPath(anchors, handles, { x: 0.5005, y: 0.5 }, 1000, 1000, 1)).toEqual({
      kind: 'handle-out',
      index: 0,
    });
  });

  it('returns the anchor when the handles are farther than the pad', () => {
    const anchors = [bezier(0.5, 0.5, { x: 0.5, y: 0.56 }, { x: 0.5, y: 0.44 })];
    const handles = resolveAnchorHandles(anchors);
    expect(hitTestVectorPath(anchors, handles, { x: 0.5, y: 0.5 }, 1000, 1000, 1)).toEqual({
      kind: 'anchor',
      index: 0,
    });
  });

  it('returns null when the pointer is farther than the pad from every target', () => {
    const anchors = [auto(0.5, 0.5), auto(0.6, 0.5)];
    const handles = resolveAnchorHandles(anchors);
    expect(hitTestVectorPath(anchors, handles, { x: 0.1, y: 0.1 }, 1000, 1000, 1)).toBeNull();
  });

  it('never offers a handle for an auto anchor (its handles are derived, not owned)', () => {
    const anchors = [auto(0.5, 0.5), auto(0.8, 0.5)];
    const handles = resolveAnchorHandles(anchors);
    // The derived out handle of anchor 0 sits at 0.6 — not a user-owned control.
    expect(hitTestVectorPath(anchors, handles, { x: 0.6, y: 0.5 }, 1000, 1000, 1)).toBeNull();
  });

  it('scales the hit pad with the zoom, not with the document', () => {
    const anchors = [auto(0.5, 0.5)];
    const handles: readonly ResolvedAnchorHandles[] = resolveAnchorHandles(anchors);
    // 10px away at 1x → inside the 12.5px anchor radius.
    expect(hitTestVectorPath(anchors, handles, { x: 0.51, y: 0.5 }, 1000, 1000, 1)).toEqual({
      kind: 'anchor',
      index: 0,
    });
    // The same 10 document px is 40 screen px at 4x → outside.
    expect(hitTestVectorPath(anchors, handles, { x: 0.51, y: 0.5 }, 1000, 1000, 4)).toBeNull();
  });
});

describe('adjacency — a duplicate click never appends', () => {
  it('refuses a pointer inside ADJACENCY_MIN_PX of the last anchor', () => {
    const anchors = [auto(0.5, 0.5)];
    expect(isAdjacentToLast(anchors, { x: 0.505, y: 0.5 }, 1000, 1000, 1)).toBe(true);
    expect(isAdjacentToLast(anchors, { x: 0.507, y: 0.5 }, 1000, 1000, 1)).toBe(false);
  });

  it('measures the radius in screen pixels at every zoom', () => {
    const anchors = [auto(0.5, 0.5)];
    // 2.5 document px at 2x = 5 screen px → inside.
    expect(isAdjacentToLast(anchors, { x: 0.5025, y: 0.5 }, 1000, 1000, 2)).toBe(true);
    // 4.5 document px at 2x = 9 screen px → outside.
    expect(isAdjacentToLast(anchors, { x: 0.5045, y: 0.5 }, 1000, 1000, 2)).toBe(false);
  });

  it('never refuses the first click of an empty draft', () => {
    expect(isAdjacentToLast([], { x: 0.5, y: 0.5 }, 1000, 1000, 1)).toBe(false);
  });
});

describe('insert / delete list operations', () => {
  const a = auto(0, 0);
  const b = auto(1, 0);
  const c = auto(2, 0);

  it('inserts at the requested index and preserves order', () => {
    expect(insertAnchorAt([a, b], 1, c)).toEqual([a, c, b]);
    expect(insertAnchorAt([a, b], 0, c)).toEqual([c, a, b]);
    expect(insertAnchorAt([a, b], 2, c)).toEqual([a, b, c]);
  });

  it('clamps an out-of-range insert index to the end', () => {
    expect(insertAnchorAt([a, b], 99, c)).toEqual([a, b, c]);
  });

  it('deletes the listed indices only', () => {
    expect(deleteAnchorsAt([a, b, c], [0, 2])).toEqual([b]);
    expect(deleteAnchorsAt([a, b, c], [7])).toEqual([a, b, c]);
  });

  it('never mutates its input', () => {
    const input = [a, b];
    insertAnchorAt(input, 1, c);
    deleteAnchorsAt(input, [0]);
    expect(input).toEqual([a, b]);
  });
});

describe('promoteAnchorForDrag — D-03, taking control owns the handles', () => {
  it('promotes an auto anchor and freezes the derived handles', () => {
    const anchors = [auto(0.2, 0.5), auto(0.5, 0.5), auto(0.8, 0.5)];
    const derived = resolveAnchorHandles(anchors);
    const promoted = promoteAnchorForDrag(anchors, 1);

    expect(promoted).not.toBe(anchors);
    expect(promoted).toHaveLength(3);
    expect(promoted[0]).toBe(anchors[0]);
    expect(promoted[2]).toBe(anchors[2]);
    const promotedAnchor = promoted[1]!;
    expect(promotedAnchor.kind).toBe('bezier');
    expect(promotedAnchor.x).toBe(0.5);
    expect(promotedAnchor.y).toBe(0.5);
    expect(promotedAnchor.in).toEqual(derived[1]!.in);
    expect(promotedAnchor.out).toEqual(derived[1]!.out);
    // The promotion is pure — the input list is untouched.
    expect(anchors[1]).toEqual(auto(0.5, 0.5));
  });

  it('leaves an already-bezier anchor and its stored handles untouched', () => {
    const anchor = bezier(0.5, 0.5, { x: 0.42, y: 0.5 }, { x: 0.58, y: 0.5 });
    const promoted = promoteAnchorForDrag([anchor], 0);
    expect(promoted[0]).toEqual(anchor);
    expect(promoted[0]).toBe(anchor);
  });
});

describe('moveAnchorBy — the anchor and both stored handles', () => {
  it('moves anchor 1 and its handles, leaving the neighbours reference-identical', () => {
    const before = [
      auto(0.1, 0.1),
      bezier(0.5, 0.5, { x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 }),
      auto(0.9, 0.9),
    ];
    const moved = moveAnchorBy(before, 1, 0.1, 0.2);

    expect(moved).not.toBe(before);
    expect(moved[0]).toBe(before[0]);
    expect(moved[2]).toBe(before[2]);
    const anchor = moved[1]!;
    expect(anchor.kind).toBe('bezier');
    expect(anchor.x).toBeCloseTo(0.6, 12);
    expect(anchor.y).toBeCloseTo(0.7, 12);
    expect(anchor.in!.x).toBeCloseTo(0.55, 12);
    expect(anchor.in!.y).toBeCloseTo(0.7, 12);
    expect(anchor.out!.x).toBeCloseTo(0.65, 12);
    expect(anchor.out!.y).toBeCloseTo(0.7, 12);
    // The input list is untouched.
    expect(before[1]).toEqual(bezier(0.5, 0.5, { x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 }));
  });

  it('moves an auto anchor without inventing handle keys', () => {
    const moved = moveAnchorBy([auto(0.2, 0.2)], 0, 0.1, 0.1);
    expect(moved[0]!.kind).toBe('auto');
    expect(moved[0]!.x).toBeCloseTo(0.3, 12);
    expect(moved[0]!.y).toBeCloseTo(0.3, 12);
    expect('in' in moved[0]!).toBe(false);
    expect('out' in moved[0]!).toBe(false);
  });
});

describe('moveHandleTo — the handle drag', () => {
  it('moves the named endpoint and never mutates the input', () => {
    const anchor = bezier(0.5, 0.5, { x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 });
    const before = [anchor];
    const moved = moveHandleTo(before, 0, 'out', { x: 0.6, y: 0.5 }, false);

    expect(moved).not.toBe(before);
    expect(moved[0]!.out!.x).toBeCloseTo(0.6, 12);
    expect(moved[0]!.out!.y).toBeCloseTo(0.5, 12);
    expect(before[0]).toEqual(anchor);
  });
});

describe('projectVectorPath', () => {
  it('draws nothing for a path with no anchors', () => {
    expect(projectVectorPath([], 1000, 800)).toEqual({
      anchors: [],
      spine: [],
      widths: [],
      envelope: [],
    });
  });

  it('draws exactly one anchor marker per anchor', () => {
    const projection = projectVectorPath([auto(0.2, 0.5), auto(0.5, 0.5), auto(0.8, 0.5)], 1000, 800);
    expect(projection.anchors).toHaveLength(3);
    expect(projection.anchors).toEqual([
      { x: 200, y: 400 },
      { x: 500, y: 400 },
      { x: 800, y: 400 },
    ]);
    expect(projection.spine.length).toBeGreaterThanOrEqual(3);
    expect(projection.widths).toHaveLength(projection.spine.length);
  });

  it('draws no envelope for a uniform width profile', () => {
    const projection = projectVectorPath([auto(0.2, 0.5), auto(0.8, 0.5)], 1000, 800);
    expect(projection.envelope).toEqual([]);
  });

  it('sweeps an envelope when an anchor stores an explicit width factor', () => {
    const sparse = [{ ...auto(0.2, 0.5), width: 1.5 }, auto(0.5, 0.5), auto(0.8, 0.5)];
    const projection = projectVectorPath(sparse, 1000, 800);
    expect(projection.envelope.length).toBeGreaterThan(4);
    for (const point of projection.envelope) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

describe('buildDraftPath', () => {
  it('returns an empty path for an empty draft', () => {
    expect(buildDraftPath([])).toEqual({ anchors: [], points: [] });
  });

  it('returns the single point of a one-anchor draft', () => {
    const single = buildDraftPath([auto(0.4, 0.4)]);
    expect(single.anchors).toEqual([auto(0.4, 0.4)]);
    expect(single.points).toEqual([{ x: 0.4, y: 0.4 }]);
  });

  it('samples a two-anchor draft from its first to its last anchor', () => {
    const two = buildDraftPath([auto(0.2, 0.5), auto(0.8, 0.5)]);
    expect(two.anchors).toHaveLength(2);
    expect(two.points.length).toBeGreaterThan(2);
    expect(two.points[0]).toEqual({ x: 0.2, y: 0.5 });
    expect(two.points[two.points.length - 1]).toEqual({ x: 0.8, y: 0.5 });
  });
});

describe('buildVectorStroke — every required field has a stated source', () => {
  it('projects a commit plus its record-time source into a complete stroke', () => {
    const anchors = [auto(0.2, 0.5), auto(0.8, 0.5)];
    const commit: VectorPathCommit = {
      anchors,
      renderMode: 'simple-ribbon',
      points: [
        { x: 0.2, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ],
    };
    const toolOverrides = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 1.5 };
    const stroke = buildVectorStroke(commit, {
      color: '#103c65',
      params: { size: 40, dry: 30 },
      brushId: 'simple-ribbon',
      toolOverrides,
      tool: 'brush',
      diffusionFrames: 120,
      timestamp: 1234,
      playFrame: 9,
    });

    expect(stroke.anchors).toEqual(anchors);
    expect(stroke.renderMode).toBe('simple-ribbon');
    expect(stroke.points).toEqual([
      { x: 0.2, y: 0.5, p: 1, tx: 0, ty: 0, tw: 0 },
      { x: 0.8, y: 0.5, p: 1, tx: 0, ty: 0, tw: 0 },
    ]);
    expect(stroke.color).toBe('#103c65');
    expect(stroke.params).toEqual({ size: 40, dry: 30 });
    expect(stroke.brushId).toBe('simple-ribbon');
    expect(stroke.toolOverrides).toEqual(toolOverrides);
    expect(stroke.tool).toBe('brush');
    expect(stroke.diffusionFrames).toBe(120);
    expect(stroke.timestamp).toBe(1234);
    expect(stroke.playFrame).toBe(9);
  });

  it('never shares the params / overrides bags with the source', () => {
    const params = { size: 40 };
    const toolOverrides = { ...NEUTRAL_TOOL_OVERRIDES };
    const stroke = buildVectorStroke(
      { anchors: [auto(0, 0)], renderMode: 'watercolor', points: [{ x: 0, y: 0 }] },
      {
        color: null,
        params,
        brushId: 'wc/round-medium',
        toolOverrides,
        tool: 'brush',
        diffusionFrames: 0,
        timestamp: 1,
        playFrame: 0,
      },
    );
    expect(stroke.params).not.toBe(params);
    expect(stroke.toolOverrides).not.toBe(toolOverrides);
  });
});
