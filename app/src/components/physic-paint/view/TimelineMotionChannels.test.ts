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
  TimelineMotionChannelLane,
  TimelineMotionChannelMenu,
  resolveKeylessMotionDisplayLanes,
  resolveMotionDisplayLanes,
  resolveVisibleMotionDisplayLanes,
  type RailMotionDisplayLaneView,
  type TimelineMotionChannelLaneProps,
} from './TimelineMotionChannels';
import { buildRailMotionCurvePath } from '../roto/railMotionEvaluator';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionKey,
} from '../roto/railMotionModel';
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
    onMoveCursorToKey: () => {},
    onToggleKeyAtCursor: () => {},
    ...overrides,
  };
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

  it('renders the header cluster as icon, label, key count, previous, diamond, next', () => {
    const tree = renderLane();

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
      buildRailMotionCurvePath(channel, RAIL_FRAME_COUNT, TIMELINE_GEOMETRY.motionLaneHeight),
    );

    expect(paths).toHaveLength(2);
    expect(paths.map((path) => path.props.d)).toEqual(expected);
    expect(paths[0].props.strokeWidth).toBe(TIMELINE_MOTION.curveWidth);
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

  it('routes key and nav clicks to the frame handlers', () => {
    const onSelectKey = vi.fn();
    const onMoveCursorToKey = vi.fn();
    const onToggleKeyAtCursor = vi.fn();
    const tree = renderLane({ cursorFrame: 3, onSelectKey, onMoveCursorToKey, onToggleKeyAtCursor });

    clickOf(keyDots(tree)[1])();
    expect(onSelectKey).toHaveBeenCalledWith(3);

    clickOf(headerPart(tree, 'previous'))();
    expect(onMoveCursorToKey).toHaveBeenCalledWith(0);

    clickOf(headerPart(tree, 'next'))();
    expect(onMoveCursorToKey).toHaveBeenLastCalledWith(6);

    clickOf(headerPart(tree, 'diamond'))();
    expect(onToggleKeyAtCursor).toHaveBeenCalledTimes(1);
  });

  it('selects the rail from the lane surface', () => {
    const onSelectRail = vi.fn();
    const tree = renderLane({ onSelectRail });

    clickOf(laneNode(tree))();
    expect(onSelectRail).toHaveBeenCalledWith('rail-a');
  });

  it('disables an inert nav control WITH a visible reason, never a silent no-op', () => {
    const tree = renderLane({ cursorFrame: 0 });

    const previous = headerPart(tree, 'previous');
    expect(previous.props.disabled).toBe(true);
    expect(typeof previous.props.title).toBe('string');
    expect(String(previous.props.title).length).toBeGreaterThan(0);
    expect(previous.props['aria-description']).toBe(previous.props.title);

    const next = headerPart(tree, 'next');
    expect(next.props.disabled).toBe(false);
  });

  it('lets the host override a disabled reason', () => {
    const tree = renderLane({
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
