import { vi, describe, expect, it, beforeEach } from 'vitest';
import type { VNode } from 'preact';

/**
 * AM-3 live-report pin: the strip's "+ Rail" button must open the
 * Motion/Static/Reveal menu and route the chosen kind to
 * onCreatePlayScriptRail/onCreateRevealRail. The user reported the button dead
 * live; this harness renders the REAL strip as a plain function with a
 * cursor-persistent useSignal mock, so the menu state survives re-invocation
 * and the click flow is exercised end to end (button → menu → kind → handler).
 * A RED result is a genuine regression in the strip path; a GREEN result
 * clears the committed code and points at the runtime session.
 */

const hooks = vi.hoisted(() => ({
  refs: new Map<number, { current: unknown }>(),
  states: new Map<number, unknown>(),
  signals: new Map<number, unknown>(),
  cursor: 0,
  idCursor: 0,
  reset() {
    this.refs = new Map();
    this.states = new Map();
    this.signals = new Map();
    this.cursor = 0;
    this.idCursor = 0;
  },
  rewind() {
    this.cursor = 0;
    this.idCursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useCallback: <Value extends (...args: never[]) => unknown,>(callback: Value) => callback,
  useEffect: () => {},
  useId: () => `rail-create-${hooks.idCursor++}`,
  useLayoutEffect: () => {},
  useMemo: <Value,>(factory: () => Value) => factory(),
  useRef: <Value,>(initial: Value) => {
    const index = hooks.cursor++;
    if (!hooks.refs.has(index)) hooks.refs.set(index, { current: initial });
    return hooks.refs.get(index) as { current: Value };
  },
  useState: <Value,>(initial: Value | (() => Value)) => {
    const index = hooks.cursor++;
    if (!hooks.states.has(index)) {
      hooks.states.set(index, typeof initial === 'function' ? (initial as () => Value)() : initial);
    }
    return [hooks.states.get(index) as Value, (next: Value | ((current: Value) => Value)) => {
      hooks.states.set(index, typeof next === 'function'
        ? (next as (current: Value) => Value)(hooks.states.get(index) as Value)
        : next);
    }] as const;
  },
}));

vi.mock('preact/compat', async () => {
  const actual = await vi.importActual<typeof import('preact/compat')>('preact/compat');
  return { ...actual, memo: <Value,>(component: Value) => component };
});

vi.mock('@preact/signals', async () => {
  const actual = await vi.importActual<typeof import('@preact/signals')>('@preact/signals');
  return {
    ...actual,
    // Cursor-persistent: a re-invocation replays the same hook slots, so the
    // menu's open signal keeps its value across renders (the live behavior).
    useSignal: <Value,>(initial: Value) => {
      const index = hooks.cursor++;
      if (!hooks.signals.has(index)) hooks.signals.set(index, actual.signal(initial));
      return hooks.signals.get(index) as ReturnType<typeof actual.signal<Value>>;
    },
  };
});

import { PhysicsPaintWorkflowStrip } from './PhysicsPaintWorkflowStrip';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';

type AnyVNode = VNode<Record<string, any>>;

beforeEach(() => {
  hooks.reset();
});

function createPhysicalCells(capacity: number): readonly RotoPhysicalTimelineCell[] {
  return Array.from({ length: capacity }, (_, appFrame) => ({ kind: 'empty', appFrame }));
}

function renderStrip(spies: { paint: ReturnType<typeof vi.fn>; reveal: ReturnType<typeof vi.fn> }): unknown {
  return PhysicsPaintWorkflowStrip({
    currentFrame: 0,
    isPlaying: false,
    ready: true,
    onion: { enabled: false, previous: false, next: false, count: 1, opacity: 0.5 },
    rotoPhysicalCells: createPhysicalCells(120),
    rotoLoopResolutionContext: null,
    rotoLoopPresentations: new Map(),
    selectedRotoLoopClipIds: [],
    onSelectRotoLoopClip: () => {},
    onOpenRotoLoopEdit: async () => {},
    onNavigateToSyncedFrame: () => {},
    onGoToFirstFrame: () => {},
    onGoToPreviousFrame: () => {},
    onGoToNextFrame: () => {},
    onGoToLastFrame: () => {},
    onOnionChange: () => {},
    onCreatePlayScriptRail: spies.paint,
    onCreateRevealRail: spies.reveal,
  });
}

function childrenOf(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
  if (typeof vnode.type === 'function') {
    const rendered = (vnode.type as (props: Record<string, any>) => unknown)(vnode.props);
    return [vnode, ...childrenOf(rendered)];
  }
  return [vnode, ...childrenOf(vnode.props?.children)];
}

function textOf(node: unknown): string {
  const parts: string[] = [];
  const walk = (current: unknown) => {
    if (typeof current === 'string' || typeof current === 'number') { parts.push(String(current)); return; }
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) { for (const child of current) walk(child); return; }
    walk((current as AnyVNode).props?.children);
  };
  walk(node);
  return parts.join('');
}

function findAll(node: unknown, predicate: (vnode: AnyVNode) => boolean): AnyVNode[] {
  return childrenOf(node).filter((entry) => {
    const vnode = entry as AnyVNode;
    return typeof vnode.type !== 'function' && predicate(vnode);
  }) as AnyVNode[];
}

function findOne(node: unknown, predicate: (vnode: AnyVNode) => boolean): AnyVNode {
  const matches = findAll(node, predicate);
  expect(matches.length, `Expected exactly one match, found ${matches.length}`).toBe(1);
  return matches[0];
}

describe("the strip's + Rail create-rail menu (AM-3 live report)", () => {
  it('opens the Motion/Static/Reveal menu on click and routes each kind to its handler', () => {
    const paint = vi.fn();
    const reveal = vi.fn();
    const tree = renderStrip({ paint, reveal });
    const button = findOne(tree, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Create rail');
    expect(button.props['aria-expanded']).toBe('false');
    expect(findAll(tree, (vnode) => vnode.props['aria-label'] === 'Rail kind')).toHaveLength(0);

    (button.props.onClick as () => void)();

    hooks.rewind();
    const openTree = renderStrip({ paint, reveal });
    const openButton = findOne(openTree, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Create rail');
    expect(openButton.props['aria-expanded']).toBe('true');
    const menu = findOne(openTree, (vnode) => vnode.props['aria-label'] === 'Rail kind');
    const kinds = findAll(menu, (vnode) => vnode.type === 'button');
    expect(kinds.map((kind) => textOf(kind))).toEqual(['Motion', 'Static', 'Reveal']);

    (kinds[0].props.onClick as () => void)();
    expect(paint).toHaveBeenCalledTimes(1);
    expect(paint).toHaveBeenLastCalledWith('progressive');

    // The menu closed on the pick; re-open for the remaining kinds.
    hooks.rewind();
    expect(findAll(renderStrip({ paint, reveal }), (vnode) => vnode.props['aria-label'] === 'Rail kind')).toHaveLength(0);

    (openButton.props.onClick as () => void)();
    hooks.rewind();
    const reopened = renderStrip({ paint, reveal });
    const reopenedMenu = findOne(reopened, (vnode) => vnode.props['aria-label'] === 'Rail kind');
    const reopenedKinds = findAll(reopenedMenu, (vnode) => vnode.type === 'button');
    (reopenedKinds[1].props.onClick as () => void)();
    expect(paint).toHaveBeenCalledTimes(2);
    expect(paint).toHaveBeenLastCalledWith('static');

    (findOne(reopened, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Create rail').props.onClick as () => void)();
    hooks.rewind();
    const third = renderStrip({ paint, reveal });
    const thirdMenu = findOne(third, (vnode) => vnode.props['aria-label'] === 'Rail kind');
    const thirdKinds = findAll(thirdMenu, (vnode) => vnode.type === 'button');
    (thirdKinds[2].props.onClick as () => void)();
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(paint).toHaveBeenCalledTimes(2);
  });
});
