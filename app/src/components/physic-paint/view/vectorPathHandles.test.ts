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
  sampleVectorPath,
} from '@efxlab/efx-watercolor/payload';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  ADJACENCY_MIN_PX,
  ANCHOR_BODY_PX,
  ANCHOR_CORE_RADIUS_PX,
  ANCHOR_HIT_PAD_PX,
  DEFAULT_VECTOR_PATH_CURVE_MODE,
  DRAG_THRESHOLD_PX,
  FIRST_ANCHOR_HIT_PX,
  HANDLE_BODY_PX,
  VECTOR_PAINT_SAMPLE_STEP_UV,
  buildAnchorColorCommit,
  buildAnchorWidthCommit,
  buildDraftPath,
  buildVectorStroke,
  deleteAnchorsAt,
  hitTestVectorPath,
  insertAnchorAt,
  insertAnchorOnSegment,
  isAdjacentToLast,
  moveAnchorBy,
  moveHandleTo,
  pointToSegmentDistancePx,
  projectVectorPath,
  promoteAnchorForDrag,
  resampleVectorPaintPoints,
  screenPadToUv,
  screenToUv,
  selectAnchor,
  uvToScreen,
  vectorSpinePressures,
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

  it('deletes [0, 2] from a four-anchor list, keeping the middle two in order', () => {
    const d = auto(3, 0);
    expect(deleteAnchorsAt([a, b, c, d], [0, 2])).toEqual([b, d]);
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

describe('moveHandleTo — coupling and the break modifier (61-10 task 2)', () => {
  const anchor = bezier(0.5, 0.5, { x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 });

  it('moves the named endpoint and never mutates the input', () => {
    const before = [anchor];
    const moved = moveHandleTo(before, 0, 'out', { x: 0.6, y: 0.5 }, false);

    expect(moved).not.toBe(before);
    expect(moved[0]!.out!.x).toBeCloseTo(0.6, 12);
    expect(moved[0]!.out!.y).toBeCloseTo(0.5, 12);
    expect(before[0]).toEqual(anchor);
  });

  it('mirrors the partner about the anchor on a coupled drag', () => {
    const moved = moveHandleTo([anchor], 0, 'out', { x: 0.6, y: 0.5 }, false);
    expect(moved[0]!.out).toEqual({ x: 0.6, y: 0.5 });
    // Collinear and equal-length: the partner is the point reflection.
    expect(moved[0]!.in!.x).toBeCloseTo(0.4, 12);
    expect(moved[0]!.in!.y).toBeCloseTo(0.5, 12);
    expect(moved[0]!.kind).toBe('bezier');
  });

  it('mirrors from the in side as well', () => {
    const moved = moveHandleTo([anchor], 0, 'in', { x: 0.4, y: 0.6 }, false);
    expect(moved[0]!.in).toEqual({ x: 0.4, y: 0.6 });
    expect(moved[0]!.out!.x).toBeCloseTo(0.6, 12);
    expect(moved[0]!.out!.y).toBeCloseTo(0.4, 12);
  });

  it('leaves the partner byte-identical when the coupling is broken (Alt)', () => {
    const moved = moveHandleTo([anchor], 0, 'out', { x: 0.6, y: 0.5 }, true);
    expect(moved[0]!.out).toEqual({ x: 0.6, y: 0.5 });
    expect(moved[0]!.in).toEqual({ x: 0.45, y: 0.5 });
    expect(moved[0]!.in).toBe(anchor.in);
    expect(moved[0]!.kind).toBe('bezier');
  });

  it('refuses a non-bezier anchor and a non-finite point', () => {
    const smooth = auto(0.5, 0.5);
    expect(moveHandleTo([smooth], 0, 'out', { x: 0.6, y: 0.5 }, false)).toEqual([smooth]);
    expect(moveHandleTo([anchor], 0, 'out', { x: Number.NaN, y: 0.5 }, false)[0]).toBe(anchor);
  });
});

describe('insertAnchorOnSegment — a click on the spine (61-10 task 2)', () => {
  const anchors = [auto(0.2, 0.5), auto(0.5, 0.5), auto(0.8, 0.5)];

  it('inserts one auto anchor between the two anchors of the segment', () => {
    const next = insertAnchorOnSegment(anchors, 0, { x: 0.35, y: 0.5 });
    expect(next).toHaveLength(4);
    // Untouched anchors are carried by reference, in order.
    expect(next[0]).toBe(anchors[0]);
    expect(next[2]).toBe(anchors[1]);
    expect(next[3]).toBe(anchors[2]);
    const inserted = next[1]!;
    // Re-resolving the list derives its handles: it is stored as `auto`.
    expect(inserted.kind).toBe('auto');
    // The clicked projection on the evaluated curve; a collinear path keeps y.
    expect(inserted.x).toBeCloseTo(0.35, 2);
    expect(inserted.y).toBeCloseTo(0.5, 6);
    expect(anchors).toHaveLength(3);
  });

  it('inserts on the last segment and clamps an out-of-range index to it', () => {
    const last = insertAnchorOnSegment(anchors, 1, { x: 0.65, y: 0.5 });
    expect(last).toHaveLength(4);
    expect(last[2]!.kind).toBe('auto');
    expect(last[2]!.x).toBeCloseTo(0.65, 2);
    const clamped = insertAnchorOnSegment(anchors, 99, { x: 0.65, y: 0.5 });
    expect(clamped).toHaveLength(4);
    expect(clamped[2]).toEqual(last[2]);
  });

  it('is finite-safe and needs two anchors to have a segment', () => {
    expect(insertAnchorOnSegment(anchors, 0, { x: Number.NaN, y: 0.5 })).toHaveLength(3);
    expect(insertAnchorOnSegment([auto(0.2, 0.5)], 0, { x: 0.5, y: 0.5 })).toHaveLength(1);
    expect(insertAnchorOnSegment([], 0, { x: 0.5, y: 0.5 })).toHaveLength(0);
  });
});

describe('selectAnchor — the one anchor selection (61-10 task 2)', () => {
  it('replaces the selection on a plain press', () => {
    expect(selectAnchor([2, 0], 1, false)).toEqual([1]);
    expect(selectAnchor([], 2, false)).toEqual([2]);
  });

  it('adds, keeps ascending order and toggles off on an additive press', () => {
    expect(selectAnchor([], 2, true)).toEqual([2]);
    expect(selectAnchor([0, 2], 1, true)).toEqual([0, 1, 2]);
    expect(selectAnchor([0, 1, 2], 1, true)).toEqual([0, 2]);
  });

  it('dedupes and ignores a non-integer or negative index', () => {
    expect(selectAnchor([1, 1, 0], 2, true)).toEqual([0, 1, 2]);
    expect(selectAnchor([1], -1, true)).toEqual([1]);
    expect(selectAnchor([1], 1.5, false)).toEqual([1]);
    const input = [1];
    expect(selectAnchor(input, 2, false)).not.toBe(input);
  });
});

describe('buildAnchorWidthCommit — one sparse width write (61-10 task 2)', () => {
  const anchors = [auto(0.2, 0.5), auto(0.5, 0.5), auto(0.8, 0.5)];

  it('writes every listed index and leaves the rest reference-identical', () => {
    const next = buildAnchorWidthCommit(anchors, [0, 2], 1.8);
    expect(next).toHaveLength(3);
    expect(next[0]!.width).toBe(1.8);
    expect(next[1]).toBe(anchors[1]);
    expect(next[2]!.width).toBe(1.8);
    // The input stays sparse.
    expect('width' in anchors[0]!).toBe(false);
    expect('width' in anchors[2]!).toBe(false);
  });

  it('removes the key at exactly 1 instead of storing width: 1', () => {
    const wide = [
      { ...auto(0.2, 0.5), width: 1.5 },
      auto(0.5, 0.5),
      { ...auto(0.8, 0.5), width: 1.2 },
    ];
    const next = buildAnchorWidthCommit(wide, [0, 2], 1);
    expect('width' in next[0]!).toBe(false);
    expect('width' in next[2]!).toBe(false);
    expect(next[1]).toBe(wide[1]);
  });

  it('clamps through clampAnchorWidth', () => {
    expect(buildAnchorWidthCommit(anchors, [0], 99)[0]!.width).toBe(2);
    expect(buildAnchorWidthCommit(anchors, [0], 0)[0]!.width).toBe(0.2);
    // A non-finite value clamps to the default, which is stored as absent.
    expect('width' in buildAnchorWidthCommit(anchors, [0], Number.NaN)[0]!).toBe(false);
  });

  it('ignores unknown indices and never mutates the input', () => {
    const next = buildAnchorWidthCommit(anchors, [7], 1.8);
    expect(next).toEqual(anchors);
    expect(next).not.toBe(anchors);
    buildAnchorWidthCommit(anchors, [0], 1.8);
    expect('width' in anchors[0]!).toBe(false);
  });
});

// 261111-wd6: the colour sibling of the width commit. One pass over the list,
// canonical colour from the package normaliser, no default elision — an
// explicit colour is always stored, even when it equals the stroke colour.
describe('buildAnchorColorCommit — one explicit per-vertex colour (261111-wd6)', () => {
  const shaped = [
    { ...auto(0.2, 0.5), width: 1.8 },
    bezier(0.5, 0.5, { x: 0.4, y: 0.4 }, { x: 0.6, y: 0.6 }),
    auto(0.8, 0.5),
  ];

  it('writes every listed index and leaves the rest reference-identical', () => {
    const next = buildAnchorColorCommit(shaped, [0, 2], '#ff0000');
    expect(next).not.toBeNull();
    expect(next![0]!.color).toBe('#ff0000');
    expect(next![1]).toBe(shaped[1]);
    expect(next![2]!.color).toBe('#ff0000');
    // The input stays colourless.
    expect('color' in shaped[0]!).toBe(false);
    expect('color' in shaped[2]!).toBe(false);
  });

  it('preserves width and both handles on every target', () => {
    const next = buildAnchorColorCommit(shaped, [0, 1], '#0f0');
    expect(next![0]!.width).toBe(1.8);
    expect(next![0]!.x).toBe(0.2);
    expect(next![1]!.in).toEqual({ x: 0.4, y: 0.4 });
    expect(next![1]!.out).toEqual({ x: 0.6, y: 0.6 });
    expect(next![1]!.kind).toBe('bezier');
  });

  it('canonicalises the colour through the package normaliser', () => {
    expect(buildAnchorColorCommit(shaped, [0], '#FF0000')![0]!.color).toBe('#ff0000');
    expect(buildAnchorColorCommit(shaped, [0], '#0f0')![0]!.color).toBe('#00ff00');
  });

  it('returns null for a malformed colour or an empty selection', () => {
    expect(buildAnchorColorCommit(shaped, [0], '#xyz')).toBeNull();
    expect(buildAnchorColorCommit(shaped, [0], '')).toBeNull();
    expect(buildAnchorColorCommit(shaped, [0], 'red')).toBeNull();
    expect(buildAnchorColorCommit(shaped, [], '#ff0000')).toBeNull();
  });

  it('returns null when the selection names no existing anchor', () => {
    expect(buildAnchorColorCommit(shaped, [7], '#ff0000')).toBeNull();
    expect(buildAnchorColorCommit(shaped, [7, 9], '#ff0000')).toBeNull();
  });

  it('still yields a new list for the anchor\'s existing colour', () => {
    const colored = buildAnchorColorCommit(shaped, [0], '#ff0000')!;
    const again = buildAnchorColorCommit(colored, [0], '#ff0000');
    expect(again).not.toBeNull();
    expect(again).not.toBe(colored);
    expect(again![0]).not.toBe(colored[0]);
    expect(again![0]).toEqual(colored[0]);
  });

  it('writes nothing when only unknown indices ride beside a real one', () => {
    const next = buildAnchorColorCommit(shaped, [1, 7], '#ff0000')!;
    expect(next[1]!.color).toBe('#ff0000');
    expect(next).toHaveLength(3);
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

// ---------------------------------------------------------------------------
//  61-30 (G-20) — spline is an EVALUATION mode: every read path samples the
//  derived-auto view and never rewrites a stored kind or handle.
// ---------------------------------------------------------------------------

describe('61-30 curve mode — spline evaluates a view and never rewrites the path', () => {
  const STORED: readonly VectorAnchor[] = [
    auto(0.2, 0.5),
    bezier(0.5, 0.5, { x: 0.4, y: 0.9 }, { x: 0.6, y: 0.1 }),
    auto(0.8, 0.5),
  ];

  /** The derived-auto view, written out here so the test never asks the code under test. */
  const SPLINE_VIEW: readonly VectorAnchor[] = [
    auto(0.2, 0.5),
    auto(0.5, 0.5),
    auto(0.8, 0.5),
  ];

  it('buildDraftPath samples the spline view and carries the STORED anchors untouched', () => {
    const draft = buildDraftPath(STORED, 'spline');
    // Untouched: the authored bezier anchor is carried by reference, handles and all.
    expect(draft.anchors).toHaveLength(3);
    for (let index = 0; index < STORED.length; index += 1) {
      expect(draft.anchors[index]).toBe(STORED[index]);
    }
    expect(draft.anchors[1]!.kind).toBe('bezier');
    expect(draft.anchors[1]!.in).toEqual({ x: 0.4, y: 0.9 });
    expect(draft.anchors[1]!.out).toEqual({ x: 0.6, y: 0.1 });
    // The points ARE the spline evaluation, not the authored Bézier one.
    expect(draft.points).toEqual(sampleVectorPath(SPLINE_VIEW).points);
    expect(draft.points).not.toEqual(sampleVectorPath(STORED).points);
  });

  it('promoteAnchorForDrag converts nothing under spline', () => {
    const promoted = promoteAnchorForDrag(STORED, 1, 'spline');
    expect(promoted).toHaveLength(3);
    expect(promoted[0]).toBe(STORED[0]);
    // The authored bezier anchor survives the press byte-identical.
    expect(promoted[1]).toBe(STORED[1]);
    expect(promoted[1]!.kind).toBe('bezier');
    expect(promoted[1]!.in).toEqual({ x: 0.4, y: 0.9 });
    expect(promoted[1]!.out).toEqual({ x: 0.6, y: 0.1 });
    // An auto anchor is NOT promoted either: spline owns every tangent.
    const autoPromoted = promoteAnchorForDrag(STORED, 0, 'spline');
    expect(autoPromoted[0]).toBe(STORED[0]);
    expect(autoPromoted[0]!.kind).toBe('auto');
    expect('in' in autoPromoted[0]!).toBe(false);
    expect('out' in autoPromoted[0]!).toBe(false);
  });

  it('hitTestVectorPath offers no handle under spline even on a stored handle endpoint', () => {
    const anchors = [bezier(0.5, 0.5, { x: 0.45, y: 0.5 }, { x: 0.55, y: 0.5 })];
    const handles = resolveAnchorHandles(anchors);
    const onOutHandle = { x: 0.55, y: 0.5 };
    // The same pointer in the authored mode IS the out handle ...
    expect(hitTestVectorPath(anchors, handles, onOutHandle, 1000, 1000, 1, 'bezier')).toEqual({
      kind: 'handle-out',
      index: 0,
    });
    // ... and under spline the stored handles are dormant: nothing there at all.
    expect(hitTestVectorPath(anchors, handles, onOutHandle, 1000, 1000, 1, 'spline')).toBeNull();
  });

  it('insertAnchorOnSegment lands on the spline segment, not the stored Bézier curve', () => {
    // Spline midpoint of segment 1 is (0.65, 0.5) — the straight derived view.
    // The authored out handle (0.6, 0.1) pulls the Bézier midpoint to y = 0.35.
    const spline = insertAnchorOnSegment(STORED, 1, { x: 0.65, y: 0.5 }, 'spline');
    expect(spline).toHaveLength(4);
    const inserted = spline[2]!;
    expect(inserted.kind).toBe('auto');
    expect(inserted.x).toBeCloseTo(0.65, 6);
    expect(inserted.y).toBeCloseTo(0.5, 6);
    expect(inserted.y).not.toBeCloseTo(0.35, 2);
    // Every authored anchor is carried by reference, order preserved.
    expect(spline[0]).toBe(STORED[0]);
    expect(spline[1]).toBe(STORED[1]);
    expect(spline[3]).toBe(STORED[2]);
    // The same click in the authored mode really does land elsewhere.
    const authored = insertAnchorOnSegment(STORED, 1, { x: 0.65, y: 0.5 }, 'bezier');
    expect(authored[2]!.y).toBeCloseTo(0.35, 6);
  });
});

describe('vectorSpinePressures — the recorded sample pressure', () => {
  const spine = Array.from({ length: 64 }, (_unused, index) => ({
    x: 0.1 + 0.8 * (index / 63),
    y: 0.5,
  }));

  it('records the mouse pressure sentinel, so the engine owns the pressure', () => {
    // A hand stroke records -1 on every sample; the engine derives pressure
    // from the spacing (speed). The vector stroke must be the same kind of
    // sample, or it bypasses the physics that makes the hand look natural.
    expect(vectorSpinePressures(spine)).toEqual(spine.map(() => -1));
  });

  it('returns one pressure per sample', () => {
    expect(vectorSpinePressures([])).toEqual([]);
    expect(vectorSpinePressures([{ x: 0.5, y: 0.5 }])).toEqual([-1]);
  });
});

describe('resampleVectorPaintPoints — the paint sampler', () => {
  it('pins the base cadence to the live project’s measured hand spacing', () => {
    // Recorded mouse strokes: 0.014-0.033 uv mean spacing, 19-86 samples.
    // 0.04 base (before the corner slowdown and drift) lands in that band.
    expect(VECTOR_PAINT_SAMPLE_STEP_UV).toBe(0.04);
  });

  it('keeps both endpoints and samples at the measured hand cadence', () => {
    // A 0.8 uv straight path: the live project's mouse strokes cover ~0.03 uv
    // per sample, so this is ~20-25 samples, not the geometry walk's 400.
    const geometry = Array.from({ length: 400 }, (_unused, index) => ({
      x: 0.1 + 0.8 * (index / 399),
      y: 0.5,
    }));
    const paint = resampleVectorPaintPoints(geometry);
    expect(paint.length).toBeGreaterThan(14);
    expect(paint.length).toBeLessThan(30);
    expect(paint[0]).toEqual(geometry[0]);
    expect(paint[paint.length - 1]).toEqual(geometry[geometry.length - 1]);
    const meanSpacing = 0.8 / (paint.length - 1);
    expect(meanSpacing).toBeGreaterThan(0.025);
    expect(meanSpacing).toBeLessThan(0.05);
    for (let index = 1; index < paint.length; index += 1) {
      const previous = paint[index - 1]!;
      const point = paint[index]!;
      expect(Math.hypot(point.x - previous.x, point.y - previous.y)).toBeLessThanOrEqual(0.08 + 1e-9);
    }
  });

  it('lands a 1.4 uv path near the hand sample count the live project measures', () => {
    const geometry = Array.from({ length: 700 }, (_unused, index) => ({
      x: 0.1 + 1.4 * (index / 699),
      y: 0.5,
    }));
    const paint = resampleVectorPaintPoints(geometry);
    // The recorded hand stroke beside the vector used 45 samples for ~1.33 uv;
    // the old geometry walk gave this path 700 ticks (24 s of wet time).
    expect(paint.length).toBeGreaterThan(30);
    expect(paint.length).toBeLessThan(50);
  });

  it('slows the samples into a corner', () => {
    const straight = Array.from({ length: 400 }, (_unused, index) => ({
      x: 0.1 + 0.8 * (index / 399),
      y: 0.5,
    }));
    const zigzag = straight.map((point, index) => ({
      x: point.x,
      y: 0.5 + (index % 16 < 8 ? 0.12 : -0.12),
    }));
    const meanStep = (geometry: readonly { x: number; y: number }[]) => {
      const paint = resampleVectorPaintPoints(geometry);
      let total = 0;
      for (let index = 1; index < paint.length; index += 1) {
        const previous = paint[index - 1]!;
        const point = paint[index]!;
        total += Math.hypot(point.x - previous.x, point.y - previous.y);
      }
      return total / (paint.length - 1);
    };
    // A slower pen per unit of path = tighter spacing. The final interval is
    // clamped to the endpoint, so compare the mean, not the minimum.
    expect(meanStep(zigzag)).toBeLessThan(meanStep(straight) - 0.003);
  });

  it('returns a short path as its own two endpoints', () => {
    const short = [{ x: 0.5, y: 0.5 }, { x: 0.501, y: 0.5 }];
    expect(resampleVectorPaintPoints(short)).toEqual(short);
  });

  it('passes an empty or single-point spine through untouched', () => {
    expect(resampleVectorPaintPoints([])).toEqual([]);
    expect(resampleVectorPaintPoints([{ x: 0.4, y: 0.6 }])).toEqual([{ x: 0.4, y: 0.6 }]);
  });
});

describe('buildVectorStroke — every required field has a stated source', () => {
  it('projects a commit plus its record-time source into a complete stroke', () => {
    const anchors = [auto(0.2, 0.5), auto(0.8, 0.5)];
    const commit: VectorPathCommit = {
      anchors,
      curveMode: DEFAULT_VECTOR_PATH_CURVE_MODE,
      points: [
        { x: 0.2, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ],
    };
    const toolOverrides = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 1.5 };
    const stroke = buildVectorStroke(commit, {
      color: '#103c65',
      params: { size: 40, dry: 30 },
      brushId: 'wc/round-medium',
      toolOverrides,
      tool: 'brush',
      diffusionFrames: 120,
      timestamp: 1234,
      playFrame: 9,
    });

    expect(stroke.anchors).toEqual(anchors);
    // New paths default to spline, and the mode is written EXPLICITLY — the
    // storage default stays Bézier, so absence can never mean spline.
    expect(DEFAULT_VECTOR_PATH_CURVE_MODE).toBe('spline');
    expect(stroke.curveMode).toBe('spline');
    // A vector path carries no pressure input: its samples carry the mouse
    // sentinel, so the engine derives pressure from the spacing.
    expect(stroke.points).toEqual([
      { x: 0.2, y: 0.5, p: -1, tx: 0, ty: 0, tw: 0 },
      { x: 0.8, y: 0.5, p: -1, tx: 0, ty: 0, tw: 0 },
    ]);
    expect(stroke.color).toBe('#103c65');
    expect(stroke.params).toEqual({ size: 40, dry: 30 });
    expect(stroke.brushId).toBe('wc/round-medium');
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
      {
        anchors: [auto(0, 0)],
        curveMode: DEFAULT_VECTOR_PATH_CURVE_MODE,
        points: [{ x: 0, y: 0 }],
      },
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

  it('omits the curve-mode key when a commit is explicitly Bézier', () => {
    const stroke = buildVectorStroke(
      {
        anchors: [auto(0.2, 0.5), auto(0.8, 0.5)],
        curveMode: 'bezier',
        points: [
          { x: 0.2, y: 0.5 },
          { x: 0.8, y: 0.5 },
        ],
      },
      {
        color: null,
        params: {},
        brushId: 'wc/round-medium',
        toolOverrides: { ...NEUTRAL_TOOL_OVERRIDES },
        tool: 'brush',
        diffusionFrames: 0,
        timestamp: 1,
        playFrame: 0,
      },
    );
    // Bézier is expressed by ABSENCE, never by a stored default value.
    expect('curveMode' in stroke).toBe(false);
  });
});
