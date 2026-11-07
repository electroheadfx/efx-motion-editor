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
  TimelineMotionAddChannelRow,
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
import { resolveMotionCommandAvailability } from '../roto/railMotionCommands';
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
    addChannel: {
      open: false,
      disabled: false,
      reason: null,
      onToggle: () => {},
    },
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
    expect(findAll(tree, (vnode) => vnode.type === 'path')).toHaveLength(2);
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

  it('renders exactly the evaluator curve path for each model channel', () => {
    const paths = findAll(renderLane(), (vnode) => vnode.type === 'path');
    const expected = POSITION_CHANNELS.map((channel) =>
      buildRailMotionCurvePath(channel, RAIL_FRAME_COUNT, TIMELINE_GEOMETRY.motionLaneHeight, {
        railId: 'rail-a',
      }),
    );

    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.props.d)).toEqual(expected);
    expect(paths[0].props.strokeWidth).toBe(TIMELINE_MOTION.curveWidth);
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

  it('ends with the 2px post-block gap and the live 18px add row in the same rhythm as the body', () => {
    const tree = renderHeaderGroup();
    const group = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-motion-header-group'))[0]!;
    const children = childrenOf(group);

    const gap = children.find((child) => childHasClass(child, 'physics-paint-motion-header-gap'))!;
    expect(styleOf(gap).height).toBe(TIMELINE_MOTION.postBlockGap);
    expect(styleOf(gap).height).toBe(2);
    expect(gap.props['aria-hidden']).toBe('true');
    // 261107-mkn: the `+` row is the group's LAST child — exactly where the
    // body reserves its blank 18px slot.
    const addRow = children[children.length - 1] as TestVNode;
    expect(addRow.props['data-motion-add-channel-row']).toBe(true);
    expect(styleOf(addRow).height).toBe(TIMELINE_MOTION.laneHeight);
    expect(styleOf(addRow).height).toBe(18);
    expect(children.indexOf(gap)).toBe(children.length - 2);
  });

  it('passes the add row open/disabled/reason through and relays the captured anchor', () => {
    const onToggle = vi.fn();
    const tree = renderHeaderGroup({
      addChannel: { open: true, disabled: false, reason: null, onToggle },
    });
    const group = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-motion-header-group'))[0]!;
    const addRow = childrenOf(group)[childrenOf(group).length - 1] as TestVNode;
    expect(addRow.props['aria-expanded']).toBe(true);
    expect(addRow.props.disabled).toBe(false);
    expect(addRow.props.title).toBeUndefined();

    const handler = addRow.props.onClick as (event: unknown) => void;
    handler({ currentTarget: { getBoundingClientRect: () => ({ left: 12, bottom: 34 }) } });
    expect(onToggle).toHaveBeenCalledWith({ x: 12, y: 34 });

    // A disabled row carries the host's reason verbatim and never fires. The
    // reason is the ONE authority's own value — never re-authored here.
    const reason = resolveMotionCommandAvailability({
      command: 'add-motion-channel',
      hasRail: true,
      hasMotionRecord: true,
      hasKeylessChannel: false,
    }).reason;
    expect(reason).toBeTruthy();
    const disabled = renderHeaderGroup({
      addChannel: { open: true, disabled: true, reason, onToggle },
    });
    const disabledGroup = findAll(disabled, (vnode) => hasClass(vnode, 'physics-paint-motion-header-group'))[0]!;
    const disabledRow = childrenOf(disabledGroup)[childrenOf(disabledGroup).length - 1] as TestVNode;
    expect(disabledRow.props.disabled).toBe(true);
    expect(disabledRow.props.title).toBe(reason);
    expect(disabledRow.props['aria-description']).toBe(reason);
    expect(disabledRow.props['aria-expanded']).toBe(false);
    expect(disabledRow.props.onClick).toBeUndefined();
    expect(onToggle).toHaveBeenCalledTimes(1);
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
      selected: true,
    });

    expect(tree).toBeNull();
  });

  it('wraps the rail row plus its lanes in a rounded 1.5px rect', () => {
    const rect = resolveMotionBlockOutlineRect({ rowTop: 100, rowHeight: 30, laneCount: 3 });
    expect(rect).not.toBeNull();

    const tree = materialize(
      TimelineMotionBlockOutline({ rowTop: 100, rowHeight: 30, laneCount: 3, selected: true }),
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

  it('wraps the extra 18px add-channel row when the block renders one (59-17)', () => {
    const without = resolveMotionBlockOutlineRect({ rowTop: 0, rowHeight: 30, laneCount: 2 });
    const withRow = resolveMotionBlockOutlineRect({
      rowTop: 0,
      rowHeight: 30,
      laneCount: 2,
      addChannelRow: true,
    });

    expect(without).not.toBeNull();
    expect(withRow).not.toBeNull();
    expect(withRow!.height - without!.height).toBe(TIMELINE_MOTION.laneHeight);
    expect(without!.height).toBe(
      30 + 2 * TIMELINE_MOTION.laneHeight + TIMELINE_MOTION.postBlockGap,
    );

    const tree = materialize(
      TimelineMotionBlockOutline({
        rowTop: 0,
        rowHeight: 30,
        laneCount: 2,
        addChannelRow: true,
        selected: true,
      }),
    );
    const node = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-motion-block-outline'))[0]!;
    expect(styleOf(node).height).toBe(withRow!.height);
  });

  it('adds no add-channel term to a collapsed block (laneCount 0 stays null)', () => {
    expect(resolveMotionBlockOutlineRect({
      rowTop: 0,
      rowHeight: 30,
      laneCount: 0,
      addChannelRow: true,
    })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* add-channel menu                                                    */
/* ------------------------------------------------------------------ */

describe('TimelineMotionChannelMenu', () => {
  function menuRows(tree: unknown): TestVNode[] {
    return findAll(tree, (vnode) => vnode.props['data-motion-channel-menu-row'] !== undefined);
  }

  it('lists only the keyless display lanes in fixed order at the 18px rhythm', () => {
    const tree = materialize(
      TimelineMotionChannelMenu({
        channels: POSITION_CHANNELS,
        onAddChannel: () => {},
        onClose: () => {},
      }),
    );
    const rows = menuRows(tree);

    expect(rows.map((row) => row.props['data-motion-channel-menu-row'])).toEqual([
      'scale',
      'rotation',
      'opacity',
    ]);
    expect(rows.every((row) => styleOf(row).height === TIMELINE_MOTION.laneHeight)).toBe(true);
  });

  it('offers Position exactly once and adds position-x (the reducer seeds both axes)', () => {
    const onAddChannel = vi.fn();
    const onClose = vi.fn();
    const tree = materialize(
      TimelineMotionChannelMenu({
        channels: [motionChannel('scale', [0])],
        onAddChannel,
        onClose,
      }),
    );
    const rows = menuRows(tree);

    expect(rows.map((row) => row.props['data-motion-channel-menu-row'])).toEqual([
      'position',
      'rotation',
      'opacity',
    ]);
    expect(textOf(rows[0])).toBe('Position');

    clickOf(rows[0])();
    expect(onAddChannel).toHaveBeenCalledTimes(1);
    expect(onAddChannel).toHaveBeenCalledWith('position-x');
    expect(onAddChannel).not.toHaveBeenCalledWith('position-y');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when every display lane carries keys (D-15 complement)', () => {
    const tree = TimelineMotionChannelMenu({
      channels: [
        motionChannel('position-x', [0]),
        motionChannel('position-y', [0]),
        motionChannel('scale', [0]),
        motionChannel('rotation', [0]),
        motionChannel('opacity', [0]),
      ],
      onAddChannel: () => {},
      onClose: () => {},
    });

    expect(tree).toBeNull();
  });

  it('calls onAddChannel BEFORE onClose so the seed lands before the menu retires', () => {
    const order: string[] = [];
    const tree = materialize(
      TimelineMotionChannelMenu({
        channels: POSITION_CHANNELS,
        onAddChannel: () => order.push('add'),
        onClose: () => order.push('close'),
      }),
    );

    clickOf(menuRows(tree)[0]!)();
    expect(order).toEqual(['add', 'close']);
  });
});

/* ------------------------------------------------------------------ */
/* add-channel row (59-17, G1/CR-03)                                   */
/* ------------------------------------------------------------------ */

describe('TimelineMotionAddChannelRow', () => {
  const ENABLED = { disabled: false, reason: null } as const;
  const ALL_KEYED_REASON = 'Every Motion channel is already present on this rail.';

  function rowOf(node: unknown): TestVNode {
    return findAll(node, (vnode) => vnode.props['data-motion-add-channel-row'] !== undefined)[0]!;
  }

  it('renders the 18px add-channel row with the lane rhythm', () => {
    const tree = materialize(
      TimelineMotionAddChannelRow({ open: false, ...ENABLED, onToggle: () => {} }),
    );
    const rows = findAll(tree, (vnode) => vnode.props['data-motion-add-channel-row'] !== undefined);

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.type).toBe('button');
    expect(row.props.type).toBe('button');
    expect(row.props['aria-label']).toBe('Add Motion channel');
    expect(row.props['aria-haspopup']).toBe('menu');
    const style = styleOf(row);
    expect(style.height).toBe(TIMELINE_MOTION.laneHeight);
    expect(style.height).toBe(18);
    expect(style.width).toBe('100%');
    expect(style.gap).toBe(TIMELINE_MOTION.laneLabelGap);
    expect(style.color).toBe(TIMELINE_SURFACE.motionToggleInactive);
    expect(style.cursor).toBe('pointer');
  });

  it('mirrors the open state on aria-expanded', () => {
    const closed = materialize(
      TimelineMotionAddChannelRow({ open: false, ...ENABLED, onToggle: () => {} }),
    );
    const open = materialize(
      TimelineMotionAddChannelRow({ open: true, ...ENABLED, onToggle: () => {} }),
    );

    expect(
      findAll(closed, (vnode) => vnode.props['data-motion-add-channel-row'] !== undefined)[0]!.props['aria-expanded'],
    ).toBe(false);
    expect(
      findAll(open, (vnode) => vnode.props['data-motion-add-channel-row'] !== undefined)[0]!.props['aria-expanded'],
    ).toBe(true);
  });

  it('routes the click to onToggle (the host owns the session state)', () => {
    const onToggle = vi.fn();
    const tree = materialize(TimelineMotionAddChannelRow({ open: false, ...ENABLED, onToggle }));

    clickOf(findAll(tree, (vnode) => vnode.props['data-motion-add-channel-row'] !== undefined)[0]!)();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders an enabled row with no reason: no title, pointer cursor and a live aria-expanded', () => {
    const row = rowOf(materialize(
      TimelineMotionAddChannelRow({ open: false, ...ENABLED, onToggle: () => {} }),
    ));

    expect(row.props.disabled).toBe(false);
    expect(row.props.title).toBeUndefined();
    expect(row.props['aria-description']).toBeUndefined();
    expect(row.props['aria-expanded']).toBe(false);
    expect(styleOf(row).cursor).toBe('pointer');
    expect(styleOf(row).opacity).toBe(1);
    expect(row.props.onClick).toBeTypeOf('function');
  });

  it('renders a disabled row with the reason verbatim, no click handler and aria-expanded forced false', () => {
    const onToggle = vi.fn();
    const row = rowOf(materialize(TimelineMotionAddChannelRow({
      open: true,
      disabled: true,
      reason: ALL_KEYED_REASON,
      onToggle,
    })));

    expect(row.props.disabled).toBe(true);
    expect(row.props.title).toBe(ALL_KEYED_REASON);
    expect(row.props['aria-description']).toBe(ALL_KEYED_REASON);
    // An open session signal cannot make a disabled row claim an open menu.
    expect(row.props['aria-expanded']).toBe(false);
    expect(styleOf(row).cursor).toBe('not-allowed');
    expect(styleOf(row).opacity).toBe(0.4);
    // No handler at all — not a guarded no-op.
    expect(row.props.onClick).toBeUndefined();
    expect(onToggle).not.toHaveBeenCalled();
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
