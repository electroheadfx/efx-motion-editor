import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ComponentChildren } from 'preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const drag = vi.hoisted(() => ({
  ghost: { active: false, left: 0, width: 0, blockedEdge: null as 'left' | 'right' | null },
  onPointerDown: vi.fn(),
  consumeClickSuppression: vi.fn(() => false),
  input: null as Record<string, unknown> | null,
}));

const tooltip = vi.hoisted(() => ({
  hide: vi.fn(),
  onPointerEnter: vi.fn(),
  onPointerLeave: vi.fn(),
  onFocus: vi.fn(),
  onBlur: vi.fn(),
}));

vi.mock('preact/hooks', async () => {
  const actual = await vi.importActual<typeof import('preact/hooks')>('preact/hooks');
  return {
    ...actual,
    useRef: <Value,>(initial: Value) => ({ current: initial }),
  };
});

vi.mock('../hooks/usePhysicsPaintKeyRailDrag', () => ({
  usePhysicsPaintKeyRailDrag: (input: Record<string, unknown>) => {
    drag.input = input;
    return {
      onPointerDown: drag.onPointerDown,
      ghost: drag.ghost,
      preview: null,
      consumeClickSuppression: drag.consumeClickSuppression,
    };
  },
}));

vi.mock('./PhysicsPaintStyledTooltip', () => ({
  useStyledTooltip: () => ({ ...tooltip, visible: true }),
  PhysicsPaintStyledTooltip: (props: Record<string, unknown>) => (
    <span class="test-key-rail-tooltip">{props.children as ComponentChildren}</span>
  ),
}));

import {
  PhysicsPaintKeyRail,
  projectPhysicsPaintKeyRailGeometry,
} from './PhysicsPaintKeyRail';
import type { KeyRailSegment } from './physicsPaintKeyRailPresentation';

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: ComponentChildren };
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
  if (typeof vnode.type === 'function') return materialize(vnode.type(vnode.props));
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

function hasClass(vnode: TestVNode, name: string): boolean {
  return String(vnode.props.class ?? vnode.props.className ?? '').split(/\s+/).includes(name);
}

function findAll(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

function findOne(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode {
  const found = findAll(root, predicate);
  expect(found).toHaveLength(1);
  return found[0];
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return childrenOf(node as TestVNode).map(textOf).join('');
}

const css = readFileSync(
  fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)),
  'utf8',
);

function cssRule(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `CSS rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf('}', start);
  return css.slice(start, end === -1 ? css.length : end + 1);
}

const segments: readonly KeyRailSegment[] = [
  { firstKeyId: 'A', keyIds: ['A', 'B'], firstKeyFrame: 2, lastKeyFrame: 5 },
  { firstKeyId: 'C', keyIds: ['C'], firstKeyFrame: 6, lastKeyFrame: 6 },
];

function render(overrides: Partial<Parameters<typeof PhysicsPaintKeyRail>[0]> = {}) {
  return materialize(PhysicsPaintKeyRail({
    segments,
    visibleFrameWindow: { startFrame: 0, endFrameExclusive: 12 },
    framePitch: 18,
    selectedKeyRail: null,
    onSelectKeyRail: vi.fn(),
    ...overrides,
  }));
}

beforeEach(() => {
  drag.ghost = { active: false, left: 0, width: 0, blockedEdge: null };
  drag.onPointerDown.mockReset();
  drag.consumeClickSuppression.mockReset().mockReturnValue(false);
  drag.input = null;
  for (const callback of Object.values(tooltip)) callback.mockReset();
});

describe('PhysicsPaintKeyRail', () => {
  it('renders clipped segment geometry in first-key order and no DOM for zero visible segments', () => {
    expect(projectPhysicsPaintKeyRailGeometry(
      { firstKeyId: 'A', keyIds: ['A'], firstKeyFrame: 4, lastKeyFrame: 4 },
      { startFrame: 0, endFrameExclusive: 10 },
      18,
    )).toEqual({ left: 72, width: 18, showStartBoundary: true, showEndBoundary: true });
    expect(projectPhysicsPaintKeyRailGeometry(
      { firstKeyId: 'A', keyIds: ['A', 'B'], firstKeyFrame: 2, lastKeyFrame: 8 },
      { startFrame: 4, endFrameExclusive: 7 },
      18,
    )).toEqual({ left: 0, width: 54, showStartBoundary: false, showEndBoundary: false });

    const tree = render();
    const group = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-key-rail'));
    expect(group.props.role).toBe('group');
    expect(group.props['aria-label']).toBe('Rails');
    const anchors = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-key-rail-anchor'));
    expect(anchors.map((anchor) => anchor.props.style)).toEqual([
      { left: '36px', width: '72px' },
      { left: '108px', width: '18px' },
    ]);
    // 43.4 defect 9: the canonical first-key frame feeds the shared rail
    // roving group's cross-type ordering.
    const railTargets = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-rail-target'));
    expect(railTargets.map((target) => target.props['data-rail-first-frame'])).toEqual([2, 6]);
    expect(PhysicsPaintKeyRail({
      segments: [],
      visibleFrameWindow: { startFrame: 0, endFrameExclusive: 12 },
      framePitch: 18,
      selectedKeyRail: null,
      onSelectKeyRail: vi.fn(),
    })).toBeNull();
  });

  it('plain-selects exact segment identity and publishes locked base or selected copy', () => {
    const onSelectKeyRail = vi.fn();
    const tree = render({
      selectedKeyRail: { firstKeyId: 'A', keyIds: ['A', 'B'] },
      onSelectKeyRail,
    });
    const targets = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-key-rail-target'));
    expect(targets[0].props['aria-pressed']).toBe(true);
    expect(targets[0].props['aria-label']).toBe(
      'Selected Key Rail — frames 2–5, 2 keys. Drag to move. Delete removes all keys in this rail.',
    );
    expect(targets[1].props['aria-pressed']).toBe(false);
    expect(targets[1].props['aria-label']).toBe('Key Rail — frame 6, 1 key.');

    const click = { stopPropagation: vi.fn(), preventDefault: vi.fn(), shiftKey: true, metaKey: true, ctrlKey: false };
    (targets[1].props.onClick as (event: typeof click) => void)(click);
    expect(click.stopPropagation).toHaveBeenCalledOnce();
    expect(onSelectKeyRail).toHaveBeenCalledWith({ firstKeyId: 'C', keyIds: ['C'] });
    expect(textOf(tree)).toContain('Selected Key Rail — frames 2–5, 2 keys.');
  });

  it('supports Space selection, leaves Enter inert, and hides the tooltip on Escape', () => {
    const onSelectKeyRail = vi.fn();
    const target = findAll(render({ onSelectKeyRail }), (vnode) => hasClass(vnode, 'physics-paint-key-rail-target'))[0];
    expect(target.props.role).toBe('button');
    expect(target.props.tabIndex).toBe(0);

    const space = { key: ' ', stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (target.props.onKeyDown as (event: typeof space) => void)(space);
    expect(space.preventDefault).toHaveBeenCalledOnce();
    expect(onSelectKeyRail).toHaveBeenCalledWith({ firstKeyId: 'A', keyIds: ['A', 'B'] });

    onSelectKeyRail.mockClear();
    const enter = { key: 'Enter', stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (target.props.onKeyDown as (event: typeof enter) => void)(enter);
    expect(onSelectKeyRail).not.toHaveBeenCalled();
    expect(enter.preventDefault).not.toHaveBeenCalled();

    tooltip.hide.mockClear();
    const escape = { key: 'Escape', stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (target.props.onKeyDown as (event: typeof escape) => void)(escape);
    expect(tooltip.hide).toHaveBeenCalledOnce();
    expect(onSelectKeyRail).not.toHaveBeenCalled();
  });

  it('shows endpoint and boundary-cell classes only at real unclipped boundaries', () => {
    const fullTargets = findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-key-rail-target'));
    for (const target of fullTargets) {
      expect(hasClass(target, 'boundary-start')).toBe(true);
      expect(hasClass(target, 'boundary-end')).toBe(true);
      expect(hasClass(target, 'boundary-cell-start')).toBe(true);
      expect(hasClass(target, 'boundary-cell-end')).toBe(true);
    }
    const clipped = findOne(render({
      segments: [{ firstKeyId: 'A', keyIds: ['A', 'B'], firstKeyFrame: 2, lastKeyFrame: 8 }],
      visibleFrameWindow: { startFrame: 4, endFrameExclusive: 7 },
    }), (vnode) => hasClass(vnode, 'physics-paint-key-rail-target'));
    expect(hasClass(clipped, 'boundary-start')).toBe(false);
    expect(hasClass(clipped, 'boundary-end')).toBe(false);
  });

  it('renders a clamped paint-only ghost and blocked edge without moving or dimming the accepted rail', () => {
    drag.ghost = { active: true, left: 90, width: 72, blockedEdge: 'right' };
    const tree = render({ segments: [segments[0]] });
    const anchor = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-key-rail-anchor'));
    expect(anchor.props.style).toEqual({ left: '36px', width: '72px' });
    const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-key-rail-target'));
    expect(hasClass(target, 'dragging')).toBe(true);
    expect(hasClass(target, 'busy')).toBe(false);
    const ghost = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-key-rail-ghost'));
    expect(ghost.props.style).toEqual({ left: '54px', width: '72px' });
    expect(ghost.props['aria-hidden']).toBe('true');
    const edge = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-key-rail-ghost-blocked-edge'));
    expect(hasClass(edge, 'edge-right')).toBe(true);
    expect(edge.props.style).toEqual({ left: '124px' });
  });

  it('marks only controller-busy accepted rails busy and pins additive paint geometry', () => {
    const target = findOne(render({ busy: true, segments: [segments[0]] }), (vnode) => hasClass(vnode, 'physics-paint-key-rail-target'));
    expect(target.props['aria-busy']).toBe('true');
    expect(hasClass(target, 'busy')).toBe(true);

    expect(cssRule('.physics-paint-key-rail-segment {')).toContain('height: 3px');
    expect(cssRule('.physics-paint-key-rail-segment {')).toContain('background: #8a939c');
    expect(cssRule('.physics-paint-key-rail-target {')).toContain('height: 12px');
    expect(cssRule('.physics-paint-key-rail-target:hover:not(.selected) .physics-paint-key-rail-segment,')).toContain('background: #a7b0b9');
    expect(cssRule('.physics-paint-key-rail-target.selected .physics-paint-key-rail-segment {')).toContain('background: #f59e0b');
    // 43.4 defect 6 + defect 8: the shared rail focus ring (2px #F2F5F7, full
    // row) applies to BOTH :focus and :focus-visible through the shared
    // physics-paint-rail-target class, so a mouse-clicked Key Rail never
    // falls back to the UA default outline and renders the same rectangle as
    // the Motion/Static Rails.
    expect(hasClass(target, 'physics-paint-rail-target')).toBe(true);
    const focusRule = cssRule('.physics-paint-rail-target:focus,');
    expect(focusRule).toContain('.physics-paint-rail-target:focus,\n.physics-paint-rail-target:focus-visible {');
    expect(focusRule).toContain('outline: none');
    const ringRule = cssRule('.physics-paint-rail-target:focus-visible::after {');
    expect(ringRule).toContain('border: 2px solid #f2f5f7');
    expect(ringRule).toContain('top: -2px');
    expect(ringRule).toContain('bottom: -24px');
    expect(cssRule('.physics-paint-key-rail-target.busy {')).toContain('opacity: 0.55');
    expect(cssRule('.physics-paint-key-rail-ghost {')).toContain('opacity: 0.55');
    expect(cssRule('.physics-paint-key-rail-ghost {')).toContain('pointer-events: none');
    expect(cssRule('.physics-paint-key-rail-ghost-blocked-edge {')).toContain('background: #ff6b6b');
    expect(css).not.toContain('physics-paint-key-rail-transition');
  });
});
