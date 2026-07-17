import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentChildren, VNode } from 'preact';

type AnyVNode = VNode<Record<string, any>>;

class HookRuntime {
  private cursor = 0;
  private slots: Array<{ value?: unknown; deps?: unknown[]; cleanup?: () => void }> = [];
  private pendingEffects: Array<() => void> = [];

  beginRender() { this.cursor = 0; this.pendingEffects = []; }
  finishRender() { for (const effect of this.pendingEffects) effect(); }
  useState<T>(initial: T): [T, (next: T | ((value: T) => T)) => void] {
    const index = this.cursor++;
    const slot = this.slots[index] ??= { value: initial };
    return [slot.value as T, (next) => { slot.value = typeof next === 'function' ? (next as (value: T) => T)(slot.value as T) : next; }];
  }
  useRef<T>(initial: T) {
    const index = this.cursor++;
    const slot = this.slots[index] ??= { value: { current: initial } };
    return slot.value as { current: T };
  }
  useMemo<T>(factory: () => T, deps: unknown[]): T {
    const index = this.cursor++;
    const slot = this.slots[index] ??= {};
    if (!sameDeps(slot.deps, deps)) { slot.value = factory(); slot.deps = deps; }
    return slot.value as T;
  }
  useEffect(effect: () => void | (() => void), deps?: unknown[]) {
    const index = this.cursor++;
    const slot = this.slots[index] ??= {};
    if (deps && sameDeps(slot.deps, deps)) return;
    this.pendingEffects.push(() => { slot.cleanup?.(); const cleanup = effect(); slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined; slot.deps = deps; });
  }
}

function sameDeps(previous: unknown[] | undefined, next: unknown[]) {
  return Boolean(previous && previous.length === next.length && previous.every((value, index) => Object.is(value, next[index])));
}

class FakeElement extends EventTarget {
  scrollTop = 0;
  scrollHeight = 500;
  clientHeight = 100;
  firstElementChild: FakeElement | null = null;
  captured = false;
  rectTop = 10;
  setPointerCapture = vi.fn(() => { this.captured = true; });
  hasPointerCapture = vi.fn(() => this.captured);
  releasePointerCapture = vi.fn(() => { this.captured = false; });
  getBoundingClientRect = vi.fn(() => ({ top: this.rectTop }));
}

class Observer {
  static instances: Observer[] = [];
  observed: FakeElement[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) { Observer.instances.push(this); }
  observe = vi.fn((element: FakeElement) => { this.observed.push(element); });
  disconnect = vi.fn(() => { this.disconnected = true; });
  trigger() { this.callback(); }
}

class MutationObserverStub extends Observer {
  observe = vi.fn((element: FakeElement) => { this.observed.push(element); });
}

let runtime = new HookRuntime();
vi.mock('preact/hooks', () => ({
  useState: <T,>(initial: T) => runtime.useState(initial),
  useRef: <T,>(initial: T) => runtime.useRef(initial),
  useCallback: <T,>(callback: T, deps: unknown[]) => runtime.useMemo(() => callback, deps),
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => runtime.useEffect(effect, deps),
}));

import { SidebarScrollArea } from './SidebarScrollArea';

function childrenOf(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
  return [vnode, ...childrenOf(vnode.props?.children)];
}

function renderArea(options: { interactive?: boolean; viewport?: FakeElement; child?: FakeElement } = {}) {
  runtime.beginRender();
  const tree = SidebarScrollArea({ children: 'content' as ComponentChildren, interactive: options.interactive }) as AnyVNode;
  const viewport = options.viewport ?? new FakeElement();
  viewport.firstElementChild = options.child ?? new FakeElement();
  const viewportNode = childrenOf(tree).find((node) => (node as AnyVNode).props?.onScroll) as AnyVNode;
  (viewportNode.ref as { current: FakeElement | null }).current = viewport;
  runtime.finishRender();
  return { tree, viewport, rerender: () => renderExisting(options.interactive) };
}

function renderExisting(interactive?: boolean) {
  runtime.beginRender();
  const tree = SidebarScrollArea({ children: 'content' as ComponentChildren, interactive }) as AnyVNode;
  runtime.finishRender();
  return tree;
}

function pointerEvent(type: string, clientY: number, pointerId = 7): PointerEvent {
  const event = new Event(type) as PointerEvent;
  Object.defineProperties(event, { clientY: { value: clientY }, pointerId: { value: pointerId }, currentTarget: { writable: true, value: null } });
  return event;
}

function scrollbarNodes(tree: VNode) {
  const nodes = childrenOf(tree).filter((node) => (node as AnyVNode).props?.style?.backgroundColor === 'var(--sidebar-scrollbar-thumb)');
  const thumb = nodes[0] as AnyVNode | undefined;
  const track = thumb ? childrenOf(tree).find((node) => (node as AnyVNode).props?.style?.width === '10px') as AnyVNode : undefined;
  return { track, thumb };
}

beforeEach(() => {
  runtime = new HookRuntime();
  Observer.instances = [];
  vi.stubGlobal('ResizeObserver', Observer);
  vi.stubGlobal('MutationObserver', MutationObserverStub);
});

describe('SidebarScrollArea custom vertical scrollbar', () => {
  it('shows only for overflow with proportional geometry and preserves hidden native overflow scrolling', () => {
    const viewport = new FakeElement();
    viewport.scrollHeight = 400;
    viewport.clientHeight = 100;
    viewport.scrollTop = 150;
    const mounted = renderArea({ interactive: true, viewport });
    const tree = mounted.rerender();
    const { track, thumb } = scrollbarNodes(tree);

    expect(track).toBeDefined();
    expect(thumb?.props.style.height).toBe('25px');
    expect(thumb?.props.style.transform).toBe('translateY(37.5px)');
    const viewportNode = childrenOf(tree).find((node) => (node as AnyVNode).props?.onScroll) as AnyVNode;
    expect(viewportNode.props.class).toContain('overflow-y-auto');
    expect(viewportNode.props.style.scrollbarWidth).toBe('none');

    runtime = new HookRuntime();
    const noOverflow = new FakeElement();
    noOverflow.scrollHeight = 100;
    noOverflow.clientHeight = 100;
    renderArea({ interactive: true, viewport: noOverflow });
    expect(scrollbarNodes(renderExisting(true)).thumb).toBeUndefined();
  });

  it('keeps default consumers non-interactive while interactive panes enable track activation', () => {
    renderArea({ interactive: false });
    let tree = renderExisting(false);
    let nodes = scrollbarNodes(tree);
    expect(nodes.track?.props.style.pointerEvents).toBe('none');
    expect(nodes.track?.props.onPointerDown).toBeUndefined();
    expect(nodes.thumb?.props.onPointerDown).toBeUndefined();

    runtime = new HookRuntime();
    renderArea({ interactive: true });
    tree = renderExisting(true);
    nodes = scrollbarNodes(tree);
    expect(nodes.track?.props.style.pointerEvents).toBe('auto');
    nodes.track?.props.onPointerDown(pointerEvent('pointerdown', 85));
    const interactiveViewport = childrenOf(tree).find((node) => (node as AnyVNode).props?.onScroll) as AnyVNode;
    expect((interactiveViewport.ref as { current: FakeElement }).current.scrollTop).toBeCloseTo(331.57894736842104);
  });

  it('maps vertical thumb drag to scrollTop and releases capture at drag end', () => {
    const viewport = new FakeElement();
    viewport.scrollHeight = 500;
    viewport.clientHeight = 100;
    renderArea({ interactive: true, viewport });
    let tree = renderExisting(true);
    const { thumb } = scrollbarNodes(tree);
    const target = new FakeElement();
    const down = pointerEvent('pointerdown', 20);
    Object.defineProperty(down, 'currentTarget', { value: target });
    thumb?.props.onPointerDown(down);

    target.dispatchEvent(pointerEvent('pointermove', 58));
    expect(viewport.scrollTop).toBeCloseTo(200);
    target.dispatchEvent(pointerEvent('pointerup', 58));
    expect(target.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('observes viewport and content, refreshes after mutation, and keeps instances independent', () => {
    const firstViewport = new FakeElement();
    const firstChild = new FakeElement();
    renderArea({ interactive: true, viewport: firstViewport, child: firstChild });
    const firstResize = Observer.instances.find((instance) => !(instance instanceof MutationObserverStub))!;
    const firstMutation = Observer.instances.find((instance) => instance instanceof MutationObserverStub)!;
    expect(firstResize.observed).toEqual([firstViewport, firstChild]);
    expect(firstMutation.observed).toEqual([firstViewport]);

    firstViewport.scrollHeight = 900;
    firstMutation.trigger();
    expect(firstResize.disconnect).toHaveBeenCalled();
    expect(firstResize.observe).toHaveBeenCalledWith(firstViewport);
    expect(firstResize.observe).toHaveBeenCalledWith(firstChild);

    runtime = new HookRuntime();
    Observer.instances = [];
    const secondViewport = new FakeElement();
    secondViewport.scrollHeight = 300;
    renderArea({ interactive: true, viewport: secondViewport });
    secondViewport.scrollTop = 100;
    let secondTree = renderExisting(true);
    const secondViewportNode = childrenOf(secondTree).find((node) => (node as AnyVNode).props?.onScroll) as AnyVNode;
    secondViewportNode.props.onScroll();
    secondTree = renderExisting(true);
    expect(Number.parseFloat(scrollbarNodes(secondTree).thumb?.props.style.transform.match(/[\d.]+/)?.[0] ?? 'NaN')).toBeCloseTo(33.33333333333333);
    expect(firstViewport.scrollTop).toBe(0);
  });
});
