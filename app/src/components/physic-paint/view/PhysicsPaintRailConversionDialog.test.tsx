import { beforeEach, describe, expect, it, vi } from 'vitest';

// Node-environment component harness: preact/hooks is mocked with a cursor-based
// useRef runtime (same approach as PhysicsPaintPlayScriptDialog.test.ts) so the
// dialog function is invoked directly and its vnode tree inspected. No DOM.
const hooks = vi.hoisted(() => ({
  refs: new Map<number, { current: unknown }>(),
  cursor: 0,
  reset() {
    this.refs = new Map();
    this.cursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useRef: <Value,>(initial: Value) => {
    const index = hooks.cursor++;
    if (!hooks.refs.has(index)) hooks.refs.set(index, { current: initial });
    return hooks.refs.get(index) as { current: Value };
  },
  useEffect: () => {},
}));

import type { ReadonlySignal } from '@preact/signals';
import { PhysicsPaintRailConversionDialog } from './PhysicsPaintRailConversionDialog';
import type { RotoRailConversionRequest } from '../hooks/useRotoTimelineActions';

interface TestVNode {
  type: unknown;
  props: Record<string, unknown>;
  /** Preact hoists JSX refs onto the vnode. */
  ref?: unknown;
}

function sig<Value>(value: Value): { value: Value } {
  return { value };
}

function childrenOf(vnode: TestVNode): unknown[] {
  const children = vnode.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
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

function findOne(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode {
  const found = findAll(root, predicate);
  expect(found).toHaveLength(1);
  return found[0];
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(childrenOf(node as TestVNode));
}

function hasClass(vnode: TestVNode, name: string): boolean {
  return String(vnode.props?.class ?? '').split(/\s+/).includes(name);
}

const byClass = (name: string) => (vnode: TestVNode) => hasClass(vnode, name);
const buttons = (root: unknown): TestVNode[] =>
  findAll(root, (vnode) => vnode.type === 'button');
// The footer actions only — the header close is a <button> too.
const actionButtons = (root: unknown): TestVNode[] =>
  buttons(findOne(root, byClass('physics-paint-rail-conversion-actions')));

interface FakeEvent {
  key?: string;
  preventDefault: ReturnType<typeof vi.fn>;
  stopPropagation: ReturnType<typeof vi.fn>;
}

function fakeEvent(key?: string): FakeEvent {
  return { ...(key === undefined ? {} : { key }), preventDefault: vi.fn(), stopPropagation: vi.fn() };
}

function renderDialog(
  request: RotoRailConversionRequest | null,
  answer: (choice: 'convert' | 'new-rail') => void = vi.fn(),
): { tree: unknown; answer: (choice: 'convert' | 'new-rail') => void } {
  hooks.cursor = 0;
  const tree = PhysicsPaintRailConversionDialog({
    request: sig(request) as unknown as ReadonlySignal<RotoRailConversionRequest | null>,
    answer,
  });
  return { tree, answer };
}

beforeEach(() => {
  hooks.reset();
});

describe('PhysicsPaintRailConversionDialog (quick 261105-raf)', () => {
  it('renders nothing without a pending request', () => {
    const { tree } = renderDialog(null);
    expect(tree).toBeNull();
  });

  it('renders the locked title, Motion copy and both actions', () => {
    const { tree } = renderDialog({ railKind: 'motion' });
    const root = tree as TestVNode;
    expect(hasClass(root, 'physics-paint-play-script-dialog')).toBe(true);
    expect(hasClass(root, 'physics-paint-rail-conversion-dialog')).toBe(true);
    expect(root.props.role).toBe('dialog');
    expect(root.props['aria-labelledby']).toBe('physics-rail-conversion-title');

    const surface = findOne(root, byClass('physics-paint-rail-conversion-surface'));
    expect(textOf(findOne(surface, (vnode) => vnode.props?.id === 'physics-rail-conversion-title'))).toBe('Edit this rail?');
    expect(textOf(findOne(surface, byClass('physics-paint-rail-conversion-body'))))
      .toBe('This Motion rail is script-generated. Convert it to Standard to keep your edit — Regenerate will no longer rebuild it.');

    const actions = actionButtons(surface);
    expect(actions).toHaveLength(2);
    expect(textOf(actions[0])).toBe('New rail');
    expect(textOf(actions[1])).toBe('Convert to Standard');
    expect(hasClass(actions[0], 'physics-paint-play-script-button-ghost')).toBe(true);
    expect(hasClass(actions[1], 'physics-paint-play-script-button-primary')).toBe(true);
    // The primary is the focused-on-open action (its ref is wired).
    expect(actions[1].ref ?? actions[1].props.ref).toBeTruthy();
    // No dimming backdrop and no third action: the surface is the only child.
    expect(childrenOf(root)).toHaveLength(1);
    expect(childrenOf(root)[0]).toBe(surface);
  });

  it('wires the movable surface and its header drag handlers', () => {
    const { tree } = renderDialog({ railKind: 'motion' });
    const surface = findOne(tree, byClass('physics-paint-rail-conversion-surface'));
    expect(surface.ref ?? surface.props.ref).toBeTruthy();
    const header = findOne(surface, byClass('physics-paint-rail-conversion-header'));
    expect(typeof header.props.onPointerDown).toBe('function');
    expect(typeof header.props.onPointerMove).toBe('function');
    expect(typeof header.props.onPointerUp).toBe('function');
    expect(typeof header.props.onPointerCancel).toBe('function');
  });

  it('names the Static and Reveal rail kinds', () => {
    const statik = renderDialog({ railKind: 'static' }).tree as TestVNode;
    expect(textOf(findOne(statik, byClass('physics-paint-rail-conversion-body'))))
      .toBe('This Static rail is script-generated. Convert it to Standard to keep your edit — Regenerate will no longer rebuild it.');
    const reveal = renderDialog({ railKind: 'reveal' }).tree as TestVNode;
    expect(textOf(findOne(reveal, byClass('physics-paint-rail-conversion-body'))))
      .toBe('This Reveal rail is script-generated. Convert it to Standard to keep your edit — Regenerate will no longer rebuild it.');
  });

  it('routes Convert to Standard to convert', () => {
    const answer = vi.fn();
    const { tree } = renderDialog({ railKind: 'motion' }, answer);
    const actions = actionButtons(tree);
    (actions[1].props.onClick as () => void)();
    expect(answer).toHaveBeenCalledTimes(1);
    expect(answer).toHaveBeenCalledWith('convert');
  });

  it('routes the New rail button to the non-destructive answer', () => {
    const answer = vi.fn();
    const { tree } = renderDialog({ railKind: 'motion' }, answer);
    (actionButtons(tree)[0].props.onClick as () => void)();
    expect(answer).toHaveBeenCalledWith('new-rail');
  });

  it('routes the header close to the non-destructive answer without starting a drag', () => {
    const answer = vi.fn();
    const { tree } = renderDialog({ railKind: 'motion' }, answer);
    const close = findOne(tree, (vnode) => vnode.props?.['aria-label'] === 'Close');
    const pointerDown = fakeEvent();
    (close.props.onPointerDown as (event: FakeEvent) => void)(pointerDown);
    expect(pointerDown.stopPropagation).toHaveBeenCalled();
    (close.props.onClick as () => void)();
    expect(answer).toHaveBeenCalledWith('new-rail');
  });

  it('routes Escape to New rail and stops the Studio shortcuts', () => {
    const answer = vi.fn();
    const { tree } = renderDialog({ railKind: 'reveal' }, answer);
    const root = tree as TestVNode;
    const escape = fakeEvent('Escape');
    (root.props.onKeyDown as (event: FakeEvent) => void)(escape);
    expect(escape.stopPropagation).toHaveBeenCalled();
    expect(escape.preventDefault).toHaveBeenCalled();
    expect(answer).toHaveBeenCalledWith('new-rail');

    // Every other key is swallowed (never reaches the Studio) without answering.
    const enter = fakeEvent('Enter');
    (root.props.onKeyDown as (event: FakeEvent) => void)(enter);
    expect(enter.stopPropagation).toHaveBeenCalled();
    expect(enter.preventDefault).not.toHaveBeenCalled();
    expect(answer).toHaveBeenCalledTimes(1);
  });
});
