/**
 * Phase 59 plan 10 — v7 motion lane surface pins.
 *
 * The component is a pure function of props, so every row is proven by
 * materializing the returned vnode tree as plain function calls (no DOM, no
 * hook dispatcher — same harness shape as PhysicsPaintTrackRow.test.tsx).
 *
 * The grouped Position lane is the load-bearing case: TWO model channels fold
 * into ONE display lane with ONE dot per SHARED key frame and TWO evaluator
 * curve paths. A second Position row, or a key count that sums both axes, is
 * the failure this file exists to catch (D-11, D-12, D-13).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  RAIL_MOTION_DISPLAY_LANE_ORDER,
  TimelineMotionBlockOutline,
  TimelineMotionChannelHeaderRow,
  TimelineMotionChannelLane,
  TimelineMotionChannelMenu,
  TimelineMotionHeaderGroup,
  resolveKeylessMotionDisplayLanes,
  resolveMotionDisplayLanes,
  resolveVisibleMotionDisplayLanes,
  type RailMotionDisplayLaneView,
  type TimelineMotionChannelHeaderRowProps,
  type TimelineMotionChannelLaneProps,
  type TimelineMotionHeaderGroupProps,
} from './TimelineMotionChannels';
import { buildRailMotionCurvePath } from '../roto/railMotionEvaluator';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionKey,
} from '../roto/railMotionModel';
import type { RailMotionRailView } from '../roto/railMotionIdentity';
import {
  resolveMotionBlockOutlineRect,
  TIMELINE_GEOMETRY,
  TIMELINE_MOTION,
  TIMELINE_RAIL_PALETTES,
  TIMELINE_SURFACE,
} from './timelineRailDesign';

/* ------------------------------------------------------------------ */
/* vnode harness                                                       */
/* ------------------------------------------------------------------ */

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

function childrenOf(node: TestVNode): unknown[] {
  const children = node.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
}

function materialize(node: unknown): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map(materialize);
  if (typeof node !== 'object') return node;
  const vnode = node as TestVNode;
  if (typeof vnode.type === 'function') {
    // lucide-preact icon components call useContext and cannot be invoked
    // outside a hook dispatcher; keep them as opaque leaves.
    try {
      return materialize((vnode.type as (props: unknown) => unknown)(vnode.props));
    } catch {
      return vnode;
    }
  }
  return {
    ...vnode,
    props: {
      ...vnode.props,
      children: childrenOf(vnode).map(materialize),
    },
  } as TestVNode;
}

function* walk(node: unknown): Generator<TestVNode> {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
    return;
  }
  if (typeof node !== 'object') return;
  const vnode = node as TestVNode;
  yield vnode;
  for (const child of childrenOf(vnode)) yield* walk(child);
}

function findAll(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

function hasClass(vnode: TestVNode, name: string): boolean {
  const value = vnode.props.class ?? vnode.props.className;
  return typeof value === 'string' && value.split(/\s+/).includes(name);
}

function styleOf(vnode: TestVNode): Record<string, unknown> {
  return (vnode.props.style ?? {}) as Record<string, unknown>;
}

/** Recursive text content (Preact hands single-expression children as an array). */
function textOf(vnode: TestVNode): string {
  return childrenOf(vnode)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (child !== null && typeof child === 'object') return textOf(child as TestVNode);
      return '';
    })
    .join('');
}

function clickOf(vnode: TestVNode): () => void {
  const handler = vnode.props.onClick;
  if (typeof handler !== 'function') {
    throw new Error(`Expected an onClick handler on <${String(vnode.type)}>`);
  }
  return handler as () => void;
}

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

const RAIL_FRAME_COUNT = 12;
const SHARED_POSITION_FRAMES = [0, 3, 6] as const;

function motionKey(frame: number, value: number): PhysicPaintRotoRailMotionKey {
  return { frame, value, easing: 'ease', wiggle: 0 };
}

function motionChannel(
  id: PhysicPaintRotoRailMotionChannelId,
  frames: readonly number[],
  valueFor: (frame: number) => number = (frame) => frame,
): PhysicPaintRotoRailMotionChannel {
  return { id, keys: frames.map((frame) => motionKey(frame, valueFor(frame))) };
}

const POSITION_CHANNELS: readonly PhysicPaintRotoRailMotionChannel[] = [
  motionChannel('position-x', SHARED_POSITION_FRAMES, (frame) => frame * 10),
  motionChannel('position-y', SHARED_POSITION_FRAMES, (frame) => frame * 20),
];

/** A hand-built display lane: the component must not depend on the projection. */
const POSITION_LANE: RailMotionDisplayLaneView = {
  id: 'position',
  channels: POSITION_CHANNELS,
  keys: POSITION_CHANNELS[0].keys,
  keyCount: POSITION_CHANNELS[0].keys.length,
};

function laneProps(
  overrides: Partial<TimelineMotionChannelLaneProps> = {},
): TimelineMotionChannelLaneProps {
  return {
    railId: 'rail-a',
    lane: POSITION_LANE,
    railType: 'standard',
    selected: true,
    railFrameCount: RAIL_FRAME_COUNT,
    cursorFrame: 3,
    selectedKeyFrames: [],
    onSelectRail: () => {},
    onSelectKey: () => {},
    ...overrides,
  };
}

function headerRowProps(
  overrides: Partial<TimelineMotionChannelHeaderRowProps> = {},
): TimelineMotionChannelHeaderRowProps {
  return {
    lane: POSITION_LANE,
    railType: 'standard',
    selected: true,
    railFrameCount: RAIL_FRAME_COUNT,
    cursorFrame: 3,
    onMoveCursorToKey: () => {},
    onToggleKeyAtCursor: () => {},
    ...overrides,
  };
}

function renderHeaderRow(
  overrides: Partial<TimelineMotionChannelHeaderRowProps> = {},
): unknown {
  return materialize(TimelineMotionChannelHeaderRow(headerRowProps(overrides)));
}

const HEADER_RAIL_VIEW: RailMotionRailView = {
  railId: 'rail-a',
  anchorKeyId: 'k0',
  startFrame: 0,
  endFrameExclusive: RAIL_FRAME_COUNT,
  keyIds: ['k0'],
  railType: 'standard',
  loopId: null,
};

function headerGroupProps(
  overrides: Partial<TimelineMotionHeaderGroupProps> = {},
): TimelineMotionHeaderGroupProps {
  return {
    channels: POSITION_CHANNELS,
    view: HEADER_RAIL_VIEW,
    selected: true,
    cursorFrame: 3,
    onMotionCursorStep: () => {},
    onToggleMotionKeyAtCursor: () => {},
    ...overrides,
  };
}

function renderHeaderGroup(
  overrides: Partial<TimelineMotionHeaderGroupProps> = {},
): unknown {
  return materialize(TimelineMotionHeaderGroup(headerGroupProps(overrides)));
}

function headerRows(tree: unknown): TestVNode[] {
  return findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-motion-lane-header'));
}

/** A `childrenOf` entry is `unknown`; narrow it to a vnode before class checks. */
function childHasClass(child: unknown, name: string): child is TestVNode {
  if (child === null || typeof child !== 'object' || Array.isArray(child)) return false;
  return hasClass(child as TestVNode, name);
}

function renderLane(overrides: Partial<TimelineMotionChannelLaneProps> = {}): unknown {
  return materialize(TimelineMotionChannelLane(laneProps(overrides)));
}

function laneNode(tree: unknown): TestVNode {
  const nodes = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-motion-lane'));
  expect(nodes.length, 'the motion lane root element').toBeGreaterThan(0);
  return nodes[0] ?? { type: 'missing', props: {} };
}

function headerParts(tree: unknown): TestVNode[] {
  return findAll(tree, (vnode) => vnode.props['data-motion-header-part'] !== undefined);
}

function headerPart(tree: unknown, name: string): TestVNode {
  const found = headerParts(tree).find(
    (vnode) => vnode.props['data-motion-header-part'] === name,
  );
  expect(found, `header cluster part "${name}"`).toBeDefined();
  return found ?? { type: 'missing', props: {} };
}

function keyDots(tree: unknown): TestVNode[] {
  return findAll(tree, (vnode) => vnode.props['data-motion-key-frame'] !== undefined);
}

/* ------------------------------------------------------------------ */
/* display-lane projection                                             */
/* ------------------------------------------------------------------ */

describe('resolveMotionDisplayLanes', () => {
  it('folds the five model channels into four fixed-order display lanes', () => {
    const lanes = resolveMotionDisplayLanes([
      motionChannel('opacity', [2]),
      motionChannel('position-y', SHARED_POSITION_FRAMES, (frame) => frame * 20),
      motionChannel('scale', [1]),
      motionChannel('rotation', [4]),
      motionChannel('position-x', SHARED_POSITION_FRAMES, (frame) => frame * 10),
    ]);

    expect(lanes.map((lane) => lane.id)).toEqual([
      'position',
      'scale',
      'rotation',
      'opacity',
    ]);
    expect(RAIL_MOTION_DISPLAY_LANE_ORDER).toEqual([
      'position',
      'scale',
      'rotation',
      'opacity',
    ]);

    const position = lanes[0];
    expect(position.channels.map((channel) => channel.id)).toEqual([
      'position-x',
      'position-y',
    ]);
    expect(position.keys.map((key) => key.frame)).toEqual([0, 3, 6]);
    expect(position.keyCount).toBe(3);

    expect(lanes[1].channels.map((channel) => channel.id)).toEqual(['scale']);
    expect(lanes[3].channels.map((channel) => channel.id)).toEqual(['opacity']);
  });

  it('yields exactly one visible Position lane for a record holding only X and Y', () => {
    const visible = resolveVisibleMotionDisplayLanes(POSITION_CHANNELS);

    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('position');
    expect(visible[0].keyCount).toBe(3);
    expect(visible.length).toBeLessThanOrEqual(RAIL_MOTION_DISPLAY_LANE_ORDER.length);
  });

  it('keeps a single Position lane when only one axis carries keys', () => {
    const visible = resolveVisibleMotionDisplayLanes([motionChannel('position-x', [0, 4])]);

    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('position');
    expect(visible[0].channels.map((channel) => channel.id)).toEqual(['position-x']);
    expect(visible[0].keyCount).toBe(2);
  });

  it('never exceeds four display lanes for a record on all five model channels', () => {
    const all = resolveMotionDisplayLanes([
      motionChannel('position-x', [0]),
      motionChannel('position-y', [0]),
      motionChannel('scale', [0]),
      motionChannel('rotation', [0]),
      motionChannel('opacity', [0]),
    ]);

    expect(all).toHaveLength(4);
    expect(resolveVisibleMotionDisplayLanes([
      motionChannel('position-x', [0]),
      motionChannel('position-y', [0]),
      motionChannel('scale', [0]),
      motionChannel('rotation', [0]),
      motionChannel('opacity', [0]),
    ])).toHaveLength(4);
  });

  it('reports four keyless display lanes when nothing carries keys', () => {
    expect(resolveVisibleMotionDisplayLanes([])).toHaveLength(0);
    expect(resolveKeylessMotionDisplayLanes([]).map((lane) => lane.id)).toEqual([
      'position',
      'scale',
      'rotation',
      'opacity',
    ]);
    expect(resolveMotionDisplayLanes([]).every((lane) => lane.keyCount === 0)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* lane body                                                           */
/* ------------------------------------------------------------------ */

describe('TimelineMotionChannelLane', () => {
  it('renders one motionLane surface of the 18px lane height', () => {
    const tree = renderLane();
    const lane = laneNode(tree);

    expect(lane.props['data-motion-display-lane']).toBe('position');
    expect(styleOf(lane).height).toBe(TIMELINE_GEOMETRY.motionLaneHeight);
    expect(styleOf(lane).background).toBe(TIMELINE_SURFACE.motionLane);
  });

  it('renders NO header content — the lane body is cells, curves and keys only (261107-mkn)', () => {
    const tree = renderLane();

    expect(headerParts(tree)).toHaveLength(0);
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-motion-lane-header'))).toHaveLength(0);
    // The body itself is intact: cells, the evaluator curve and the key dots.
    expect(findAll(tree, (vnode) => vnode.props['data-motion-cell-frame'] !== undefined).length)
      .toBe(RAIL_FRAME_COUNT);
    expect(findAll(tree, (vnode) => vnode.type === 'path')).toHaveLength(1);
    expect(keyDots(tree)).toHaveLength(3);
  });

  it('draws one 6px key per SHARED Position frame, never one per axis', () => {
    const dots = keyDots(renderLane());

    expect(dots).toHaveLength(3);
    expect(dots.map((dot) => dot.props['data-motion-key-frame'])).toEqual([0, 3, 6]);

    // Keys are centred on their frame column: frame × pitch + (cell − key) / 2.
    const centring = (TIMELINE_MOTION.cellWidth - TIMELINE_MOTION.keySize) / 2;
    expect(dots.map((dot) => styleOf(dot).left)).toEqual(
      [0, 3, 6].map((frame) => frame * TIMELINE_GEOMETRY.cellPitch + centring),
    );
    expect(styleOf(dots[0]).width).toBe(TIMELINE_MOTION.keySize);
    expect(styleOf(dots[0]).height).toBe(TIMELINE_MOTION.keySize);
    expect(String(styleOf(dots[0]).boxShadow)).toContain(
      TIMELINE_RAIL_PALETTES.standard.selected.keyRim,
    );
  });

  it('draws ONE curve for the grouped Position lane, never one per axis (261107)', () => {
    const paths = findAll(renderLane(), (vnode) => vnode.type === 'path');
    const expected = buildRailMotionCurvePath(
      POSITION_CHANNELS[0]!,
      RAIL_FRAME_COUNT,
      TIMELINE_GEOMETRY.motionLaneHeight,
      { railId: 'rail-a' },
    );

    expect(paths).toHaveLength(1);
    expect(paths[0]!.props.d).toBe(expected);
    expect(paths[0]!.props.strokeWidth).toBe(TIMELINE_MOTION.curveWidth);
  });

  it('seeds a wiggle-bearing curve with the lane railId, never the preview seed (WR-03)', () => {
    const wiggleChannel: PhysicPaintRotoRailMotionChannel = {
      id: 'position-x',
      keys: [
        { frame: 0, value: 0, easing: 'ease', wiggle: 500 },
        { frame: 6, value: 40, easing: 'ease', wiggle: 0 },
      ],
    };
    const lane: RailMotionDisplayLaneView = {
      id: 'position',
      channels: [wiggleChannel],
      keys: wiggleChannel.keys,
      keyCount: wiggleChannel.keys.length,
    };

    const paths = findAll(renderLane({ lane }), (vnode) => vnode.type === 'path');
    expect(paths).toHaveLength(1);
    const rendered = String(paths[0].props.d);
    const railSeeded = buildRailMotionCurvePath(
      wiggleChannel,
      RAIL_FRAME_COUNT,
      TIMELINE_GEOMETRY.motionLaneHeight,
      { railId: 'rail-a' },
    );
    const previewSeeded = buildRailMotionCurvePath(
      wiggleChannel,
      RAIL_FRAME_COUNT,
      TIMELINE_GEOMETRY.motionLaneHeight,
    );

    expect(railSeeded === previewSeeded, 'the fixtures must diverge by seed').toBe(false);
    expect(rendered === railSeeded, 'the lane curve must use the rail seed').toBe(true);
    expect(rendered === previewSeeded, 'the lane curve must not use the preview seed').toBe(false);
  });

  it('draws the 16 x 18 motion cells at the 18px pitch', () => {
    const cells = findAll(
      renderLane(),
      (vnode) => vnode.props['data-motion-cell-frame'] !== undefined,
    );

    expect(cells).toHaveLength(RAIL_FRAME_COUNT);
    cells.forEach((cell, index) => {
      const style = styleOf(cell);
      expect(cell.props['data-motion-cell-frame']).toBe(index);
      expect(style.left).toBe(index * TIMELINE_GEOMETRY.cellPitch);
      expect(style.width).toBe(TIMELINE_MOTION.cellWidth);
      expect(style.height).toBe(TIMELINE_MOTION.cellHeight);
      expect(style.borderRadius).toBe(TIMELINE_MOTION.cellRadius);
      expect(style.background).toBe(TIMELINE_SURFACE.emptyCellFill);
      expect(String(style.border)).toContain(TIMELINE_SURFACE.emptyCellBorder);
    });
    // The footprint is not the drawing-key cell.
    expect(TIMELINE_MOTION.cellHeight).not.toBe(TIMELINE_GEOMETRY.cellHeight);
  });

  it('marks the key at the cursor frame as the current tier', () => {
    const dots = keyDots(renderLane({ cursorFrame: 3 }));

    expect(dots.map((dot) => dot.props['data-tier'])).toEqual(['idle', 'current', 'idle']);
  });

  it('does not render keys outside the rail band', () => {
    const lane: RailMotionDisplayLaneView = {
      id: 'position',
      channels: [
        motionChannel('position-x', [0, 20]),
        motionChannel('position-y', [0, 20]),
      ],
      keys: [motionKey(0, 0), motionKey(20, 0)],
      keyCount: 2,
    };

    const dots = keyDots(renderLane({ lane }));

    expect(dots).toHaveLength(1);
    expect(dots[0].props['data-motion-key-frame']).toBe(0);
  });

  it('routes a key click to the frame handler', () => {
    const onSelectKey = vi.fn();
    const tree = renderLane({ cursorFrame: 3, onSelectKey });

    clickOf(keyDots(tree)[1])();
    expect(onSelectKey).toHaveBeenCalledWith(3);
  });

  it('selects the rail from the lane surface', () => {
    const onSelectRail = vi.fn();
    const tree = renderLane({ onSelectRail });

    clickOf(laneNode(tree))();
    expect(onSelectRail).toHaveBeenCalledWith('rail-a');
  });
});

/* ------------------------------------------------------------------ */
/* channel header row (261107-mkn: the moved in-lane cluster)          */
/* ------------------------------------------------------------------ */

describe('TimelineMotionChannelHeaderRow', () => {
  it('renders the six parts in order: icon, label, key count, previous, diamond, next', () => {
    const tree = renderHeaderRow();

    expect(headerParts(tree).map((vnode) => vnode.props['data-motion-header-part'])).toEqual([
      'icon',
      'label',
      'count',
      'previous',
      'diamond',
      'next',
    ]);
    expect(textOf(headerPart(tree, 'label'))).toBe('Position');
    expect(textOf(headerPart(tree, 'count'))).toBe('3 keys');
  });

  it('is a flow row at the 18px lane rhythm — never an absolute overlay', () => {
    const tree = renderHeaderRow();
    const header = headerRows(tree)[0]!;
    const style = styleOf(header);

    expect(style.position).toBeUndefined();
    expect(style.height).toBe(TIMELINE_MOTION.laneHeight);
    expect(style.width).toBe('100%');
    expect(style.minWidth).toBe(TIMELINE_MOTION.headerClusterWidth);
    expect(style.flexShrink).toBe(0);
    expect(style.background).toBe(TIMELINE_SURFACE.motionLane);
  });

  it('dims an unselected lane and keeps the rail-select hint', () => {
    const selectedRow = headerRows(renderHeaderRow({ selected: true }))[0]!;
    const idleRow = headerRows(renderHeaderRow({ selected: false }))[0]!;

    expect(styleOf(selectedRow).opacity).toBe(1);
    expect(styleOf(idleRow).opacity).toBe(0.55);
    expect(idleRow.props.title)
      .toBe('Click this lane to select the rail for canvas transforms');
    expect(selectedRow.props.title).toBeUndefined();
  });

  it('routes previous to the earlier key and next to the later key', () => {
    const onMoveCursorToKey = vi.fn();
    const tree = renderHeaderRow({ cursorFrame: 3, onMoveCursorToKey });

    clickOf(headerPart(tree, 'previous'))();
    expect(onMoveCursorToKey).toHaveBeenCalledWith(0);

    clickOf(headerPart(tree, 'next'))();
    expect(onMoveCursorToKey).toHaveBeenLastCalledWith(6);
  });

  it('routes the diamond to the at-cursor toggle', () => {
    const onToggleKeyAtCursor = vi.fn();
    const tree = renderHeaderRow({ cursorFrame: 3, onToggleKeyAtCursor });

    clickOf(headerPart(tree, 'diamond'))();
    expect(onToggleKeyAtCursor).toHaveBeenCalledTimes(1);
  });

  it('disables an inert nav control WITH a visible reason, never a silent no-op', () => {
    const tree = renderHeaderRow({ cursorFrame: 0 });

    const previous = headerPart(tree, 'previous');
    expect(previous.props.disabled).toBe(true);
    expect(typeof previous.props.title).toBe('string');
    expect(String(previous.props.title).length).toBeGreaterThan(0);
    expect(previous.props['aria-description']).toBe(previous.props.title);

    const next = headerPart(tree, 'next');
    expect(next.props.disabled).toBe(false);
  });

  it('lets the host override a disabled reason', () => {
    const tree = renderHeaderRow({
      cursorFrame: 0,
      disabledReasons: { next: 'Rail recording is locked' },
    });

    const next = headerPart(tree, 'next');
    expect(next.props.disabled).toBe(true);
    expect(next.props.title).toBe('Rail recording is locked');
    expect(next.props['aria-description']).toBe('Rail recording is locked');
  });
});

/* ------------------------------------------------------------------ */
/* channel header group (261107-mkn: the pinned-column stack)          */
/* ------------------------------------------------------------------ */

describe('TimelineMotionHeaderGroup', () => {
  it('renders one header row per VISIBLE display lane in fixed order', () => {
    const tree = renderHeaderGroup();

    const rows = headerRows(tree);
    expect(rows).toHaveLength(1);
    expect(textOf(headerPart(rows[0]!, 'label'))).toBe('Position');

    const allKeyed = renderHeaderGroup({
      channels: [
        motionChannel('position-x', SHARED_POSITION_FRAMES),
        motionChannel('position-y', SHARED_POSITION_FRAMES),
        motionChannel('scale', [0]),
        motionChannel('rotation', [1]),
        motionChannel('opacity', [2]),
      ],
    });
    expect(headerRows(allKeyed).map((row) => textOf(headerPart(row, 'label')))).toEqual([
      'Position',
      'Scale',
      'Rotation',
      'Opacity',
    ]);
  });

  it('ends with the 2px post-block gap and no control row', () => {
    const tree = renderHeaderGroup();
    const group = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-motion-header-group'))[0]!;
    const children = childrenOf(group);

    const gap = children.find((child) => childHasClass(child, 'physics-paint-motion-header-gap'))!;
    expect(styleOf(gap).height).toBe(TIMELINE_MOTION.postBlockGap);
    expect(styleOf(gap).height).toBe(2);
    expect(gap.props['aria-hidden']).toBe('true');
    // 261107: the Add channel row moved into the Animate menu, so the header
    // band ends at the post-block gap and the body reserves no slot.
    expect(children.indexOf(gap)).toBe(children.length - 1);
  });

  it('maps a row step to the lane model channel id and the direction from the cursor', () => {
    const onMotionCursorStep = vi.fn();
    const tree = renderHeaderGroup({
      cursorFrame: 3,
      onMotionCursorStep,
      channels: [
        motionChannel('position-x', SHARED_POSITION_FRAMES),
        motionChannel('position-y', SHARED_POSITION_FRAMES),
        motionChannel('scale', [3, 8]),
      ],
    });
    const rows = headerRows(tree);
    expect(rows).toHaveLength(2);

    // Position is the grouped lane: its intents address `position-x`.
    clickOf(headerPart(rows[0]!, 'previous'))();
    expect(onMotionCursorStep).toHaveBeenCalledWith(-1, 'position-x');
    clickOf(headerPart(rows[0]!, 'next'))();
    expect(onMotionCursorStep).toHaveBeenLastCalledWith(1, 'position-x');

    // Scale is a single-channel lane: its intents address `scale`.
    clickOf(headerPart(rows[1]!, 'next'))();
    expect(onMotionCursorStep).toHaveBeenLastCalledWith(1, 'scale');
  });

  it('maps the diamond toggle to the lane model channel id', () => {
    const onToggleMotionKeyAtCursor = vi.fn();
    const tree = renderHeaderGroup({
      cursorFrame: 3,
      onToggleMotionKeyAtCursor,
      channels: [
        motionChannel('position-x', SHARED_POSITION_FRAMES),
        motionChannel('position-y', SHARED_POSITION_FRAMES),
        motionChannel('opacity', [1]),
      ],
    });
    const rows = headerRows(tree);

    clickOf(headerPart(rows[0]!, 'diamond'))();
    expect(onToggleMotionKeyAtCursor).toHaveBeenCalledWith('position-x');
    clickOf(headerPart(rows[1]!, 'diamond'))();
    expect(onToggleMotionKeyAtCursor).toHaveBeenLastCalledWith('opacity');
  });

  it('derives the rail band from the view span and fails closed without a view', () => {
    const spanTree = renderHeaderGroup({
      view: { ...HEADER_RAIL_VIEW, startFrame: 2, endFrameExclusive: 8 },
      cursorFrame: 0,
      channels: [motionChannel('scale', [0, 2, 4])],
    });
    const spanRow = headerRows(spanTree)[0]!;
    // The local band is [0, 6) — cursor 0 has a later key and no earlier one.
    expect(headerPart(spanRow, 'previous').props.disabled).toBe(true);
    expect(headerPart(spanRow, 'next').props.disabled).toBe(false);

    const nullView = renderHeaderGroup({
      view: null,
      channels: [motionChannel('scale', [0])],
    });
    expect(headerRows(nullView)).toHaveLength(1);
    expect(headerPart(headerRows(nullView)[0]!, 'previous').props.disabled).toBe(true);
    expect(headerPart(headerRows(nullView)[0]!, 'next').props.disabled).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* block outline                                                       */
/* ------------------------------------------------------------------ */

describe('TimelineMotionBlockOutline', () => {
  it('renders nothing while the block is collapsed (MUI-03)', () => {
    const tree = TimelineMotionBlockOutline({
      rowTop: 100,
      rowHeight: 30,
      laneCount: 0,
      railStartFrame: 0,
      railFrameCount: 12,
      selected: true,
    });

    expect(tree).toBeNull();
  });

  it('wraps the rail row plus its lanes in a rounded 1.5px rect', () => {
    const rect = resolveMotionBlockOutlineRect({
      rowTop: 100,
      rowHeight: 30,
      laneCount: 3,
      railStartFrame: 0,
      railFrameCount: 12,
    });
    expect(rect).not.toBeNull();

    const tree = materialize(
      TimelineMotionBlockOutline({
        rowTop: 100,
        rowHeight: 30,
        laneCount: 3,
        railStartFrame: 0,
        railFrameCount: 12,
        selected: true,
      }),
    );
    const nodes = findAll(
      tree,
      (vnode) => hasClass(vnode, 'physics-paint-motion-block-outline'),
    );
    expect(nodes).toHaveLength(1);

    const style = styleOf(nodes[0] ?? { type: 'missing', props: {} });
    expect(style.position).toBe('absolute');
    expect(style.top).toBe(100);
    expect(style.height).toBe(86);
    expect(style.borderRadius).toBe(TIMELINE_GEOMETRY.outlineRadius);
    expect(String(style.border)).toContain(`${TIMELINE_GEOMETRY.outlineWidth}px`);
    expect(style.pointerEvents).toBe('none');
  });

  it('hugs the rail frame extent instead of the whole timeline (261107)', () => {
    const rect = resolveMotionBlockOutlineRect({
      rowTop: 0,
      rowHeight: 30,
      laneCount: 2,
      railStartFrame: 6,
      railFrameCount: 9,
    });
    expect(rect?.left).toBe(6 * TIMELINE_GEOMETRY.cellPitch + TIMELINE_GEOMETRY.outlineWidth / 2);
    expect(rect?.width).toBe(
      9 * TIMELINE_GEOMETRY.cellPitch - TIMELINE_GEOMETRY.cellGap - TIMELINE_GEOMETRY.outlineWidth,
    );

    const tree = materialize(
      TimelineMotionBlockOutline({
        rowTop: 0,
        rowHeight: 30,
        laneCount: 2,
        railStartFrame: 6,
        railFrameCount: 9,
        selected: true,
      }),
    );
    const node = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-motion-block-outline'))[0]!;
    expect(styleOf(node).left).toBe(rect?.left);
    expect(styleOf(node).width).toBe(rect?.width);
  });
});

/* ------------------------------------------------------------------ */
/* channel menu                                                        */
/* ------------------------------------------------------------------ */

describe('TimelineMotionChannelMenu', () => {
  function menuRows(tree: unknown): TestVNode[] {
    return findAll(tree, (vnode) => vnode.props['data-motion-channel-menu-row'] !== undefined);
  }

  it('lists all four display channels in fixed order', () => {
    const tree = materialize(
      TimelineMotionChannelMenu({
        channels: POSITION_CHANNELS,
        onToggleChannel: () => {},
        onClose: () => {},
      }),
    );
    const rows = menuRows(tree);

    expect(rows.map((row) => row.props['data-motion-channel-menu-row'])).toEqual([
      'position',
      'scale',
      'rotation',
      'opacity',
    ]);
    expect(rows.map((row) => row.props['data-motion-channel-present'])).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
  });

  it('toggles a PRESENT channel off', () => {
    const onToggleChannel = vi.fn();
    const onClose = vi.fn();
    const tree = materialize(
      TimelineMotionChannelMenu({
        channels: POSITION_CHANNELS,
        onToggleChannel,
        onClose,
      }),
    );

    clickOf(menuRows(tree)[0]!)();
    expect(onToggleChannel).toHaveBeenCalledWith('position-x', true);
    expect(onToggleChannel).not.toHaveBeenCalledWith('position-y', true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('adds an ABSENT channel and closes', () => {
    const onToggleChannel = vi.fn();
    const onClose = vi.fn();
    const tree = materialize(
      TimelineMotionChannelMenu({
        channels: [motionChannel('scale', [0])],
        onToggleChannel,
        onClose,
      }),
    );

    clickOf(menuRows(tree)[0]!)();
    expect(onToggleChannel).toHaveBeenCalledWith('position-x', false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reports presence from the channel inventory, not from the key count (261107)', () => {
    const tree = materialize(
      TimelineMotionChannelMenu({
        channels: [motionChannel('opacity', [])],
        onToggleChannel: () => {},
        onClose: () => {},
      }),
    );
    const rows = menuRows(tree);
    const opacityRow = rows.find((row) => row.props['data-motion-channel-menu-row'] === 'opacity')!;
    expect(opacityRow.props['data-motion-channel-present']).toBe('true');
    expect(rows.find((row) => row.props['data-motion-channel-menu-row'] === 'scale')!
      .props['data-motion-channel-present']).toBe('false');
  });
});

/* ------------------------------------------------------------------ */
/* purity contract                                                     */
/* ------------------------------------------------------------------ */

const moduleSourcePath = fileURLToPath(new URL('./TimelineMotionChannels.tsx', import.meta.url));

function moduleSource(): string {
  return readFileSync(moduleSourcePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('TimelineMotionChannels source contract', () => {
  it('reads no store, hook, signal or DOM state', () => {
    const source = moduleSource();

    expect(source).not.toMatch(
      /physicPaintStore|@preact\/signals|useState|useEffect|useSignal|useRef|document\.|window\./,
    );
  });

  it('derives every geometry value from a design token', () => {
    const source = moduleSource();

    expect(source).toMatch(/from '\.\/timelineRailDesign'/);
    expect(source).toMatch(/TIMELINE_GEOMETRY/);
    expect(source).toMatch(/TIMELINE_MOTION/);
    // No literal that duplicates a locked token: 18 (pitch/lane), 16 (cell
    // width), 6 (key size) or 1.5 (curve width).
    expect(source).not.toMatch(/\b1\.5\b/);
    expect(source).not.toMatch(/\b18\b/);
    expect(source).not.toMatch(/\b16\b/);
    expect(source).not.toMatch(/\b6\b/);
  });
});
