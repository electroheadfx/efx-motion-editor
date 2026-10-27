// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import { PreactHookRuntime } from '../../../test/preactHookRuntime';

type AnyVNode = VNode<Record<string, any>>;

const performanceMocks = vi.hoisted(() => ({
  recordCounter: vi.fn(),
  recordDecode: vi.fn(),
}));

let runtime = new PreactHookRuntime();

vi.mock('preact/hooks', () => ({
  useState: <T,>(initial: T | (() => T)) => runtime.useState(initial),
  useRef: <T,>(initial: T) => runtime.useRef(initial),
  useMemo: <T,>(factory: () => T, deps: unknown[]) => runtime.useMemo(factory, deps),
  useCallback: <T,>(callback: T, deps: unknown[]) => runtime.useCallback(callback, deps),
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => runtime.useEffect(effect, deps),
}));

// The layer modules pull the watercolor runtime; the mount's contract is which
// layers it renders and how it forwards to the latest parent callbacks, so both
// layers are opaque string elements here.
vi.mock('./AquarelleCanvasLayer', () => ({
  AquarelleCanvasLayer: 'aquarelle-canvas-layer',
}));
vi.mock('./AquarelleCachedBaseLayer', () => ({
  AquarelleCachedBaseLayer: 'aquarelle-cached-base-layer',
}));

vi.mock('../performance/physicsPaintPerformanceTrace', () => ({
  recordPhysicsPaintPerformanceCounter: performanceMocks.recordCounter,
  recordPhysicsPaintDecodeSample: performanceMocks.recordDecode,
}));

import { PhysicsPaintCanvasMount } from './PhysicsPaintCanvasMount';

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(readonly callback: () => void) {
    ResizeObserverStub.instances.push(this);
  }
}

class RegionStub {
  width = 400;
  height = 300;
  readonly getBoundingClientRect = vi.fn(() => ({ width: this.width, height: this.height }));
}

class ShellStub {
  readonly parentElement = new RegionStub();
  readonly querySelector = vi.fn(() => ({}));
}

interface ParentCallbacks {
  onCanvasMounted: ReturnType<typeof vi.fn>;
  onAquarelleStrokeEnd: ReturnType<typeof vi.fn>;
  onAquarelleStrokeSettled: ReturnType<typeof vi.fn>;
  onAquarelleTransformStrokes: ReturnType<typeof vi.fn>;
  onEnginePortReady: ReturnType<typeof vi.fn>;
  getAquarellePlayFrame: ReturnType<typeof vi.fn>;
  getAquarellePaperGrainStrength: ReturnType<typeof vi.fn>;
}

interface MountedCanvas {
  tree: AnyVNode;
  child: AnyVNode;
  shell: ShellStub;
}

let animationFrameId = 0;
let pendingAnimationFrames = new Map<number, FrameRequestCallback>();
let requestAnimationFrameMock: ReturnType<typeof vi.fn>;
let cancelAnimationFrameMock: ReturnType<typeof vi.fn>;

function parentCallbacks(label: string): ParentCallbacks {
  return {
    onCanvasMounted: vi.fn(),
    onAquarelleStrokeEnd: vi.fn(() => label),
    onAquarelleStrokeSettled: vi.fn(() => label),
    onAquarelleTransformStrokes: vi.fn(() => label),
    onEnginePortReady: vi.fn(() => label),
    getAquarellePlayFrame: vi.fn(() => (label === 'latest' ? 22 : 11)),
    getAquarellePaperGrainStrength: vi.fn(() => (label === 'latest' ? 3 : 1)),
  };
}

function canvasProps(callbacks: ParentCallbacks, width = 200, height = 100) {
  return {
    width,
    height,
    paperTextureScale: 1,
    getAquarellePaperId: () => 'paper/cold-press',
    ...callbacks,
  };
}

function childrenOf(node: unknown): AnyVNode[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
  return [vnode, ...childrenOf(vnode.props?.children)];
}

function renderCanvas(callbacks: ParentCallbacks, width = 200, height = 100, shell = new ShellStub()): MountedCanvas {
  runtime.beginRender();
  const tree = PhysicsPaintCanvasMount(canvasProps(callbacks, width, height)) as AnyVNode;
  (tree.ref as { current: ShellStub | null }).current = shell;
  const child = childrenOf(tree).find((node) => node.type === 'aquarelle-canvas-layer');
  expect(child).toBeDefined();
  runtime.flushEffects();
  return { tree, child: child!, shell };
}

function flushAnimationFrames() {
  const frames = [...pendingAnimationFrames.entries()];
  pendingAnimationFrames.clear();
  for (const [, callback] of frames) callback(0);
}

beforeEach(() => {
  runtime = new PreactHookRuntime();
  ResizeObserverStub.instances = [];
  animationFrameId = 0;
  pendingAnimationFrames = new Map();
  requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
    const id = ++animationFrameId;
    pendingAnimationFrames.set(id, callback);
    return id;
  });
  cancelAnimationFrameMock = vi.fn((id: number) => {
    pendingAnimationFrames.delete(id);
  });
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('window', {
    requestAnimationFrame: requestAnimationFrameMock,
    cancelAnimationFrame: cancelAnimationFrameMock,
  });
  vi.clearAllMocks();
});

describe('PhysicsPaintCanvasMount directly executed hook behavior', () => {
  it('renders the watercolor layer only and forwards to the latest parent callbacks', () => {
    const initial = parentCallbacks('initial');
    const latest = parentCallbacks('latest');
    const mounted = renderCanvas(initial);
    // 261027-klx: engine-1's Efx child surface is gone — the mount renders the
    // live aquarelle sheet (and, with a cached key, its base layer) and nothing
    // else.
    expect(childrenOf(mounted.tree).some((node) => node.type === 'efx-paint-canvas')).toBe(false);

    const rerendered = renderCanvas(latest, 200, 100, mounted.shell);
    // The mount effect only re-registers on a dimension change; the pending
    // frame must forward to the LATEST parent callback captured by the rerender.
    flushAnimationFrames();

    const stroke = { id: 1 };
    const port = { snapshot: vi.fn() };
    const transform = { translateX: 4 };
    mounted.child.props.onStrokeEnd(stroke);
    mounted.child.props.onStrokeSettled(stroke, 3);
    mounted.child.props.onTransformStrokes([1], transform);
    mounted.child.props.onEnginePortReady(port);

    expect(latest.onAquarelleStrokeEnd).toHaveBeenCalledWith(stroke);
    expect(latest.onAquarelleStrokeSettled).toHaveBeenCalledWith(stroke, 3);
    expect(latest.onAquarelleTransformStrokes).toHaveBeenCalledWith([1], transform);
    expect(latest.onEnginePortReady).toHaveBeenCalledWith(port);
    expect(latest.onCanvasMounted).toHaveBeenCalledWith(true);
    for (const callback of Object.values(initial)) expect(callback).not.toHaveBeenCalled();

    // The frame/paper getters are read through refs, so the SAME child vnode
    // serves the latest values without re-invoking the parent closure captured
    // at the first render.
    expect(mounted.child.props.getPlayFrame()).toBe(22);
    expect(mounted.child.props.getPaperGrainStrength()).toBe(3);
    expect(rerendered.child.props.getPlayFrame()).toBe(22);
  });

  it('renders the cached base layer under the live sheet when a cached key URL is present', () => {
    runtime.beginRender();
    const tree = PhysicsPaintCanvasMount({
      ...canvasProps(parentCallbacks('cached')),
      aquarelleCachedBaseUrl: 'blob:cached-key',
    }) as AnyVNode;
    const cached = childrenOf(tree).find((node) => node.type === 'aquarelle-cached-base-layer');
    expect(cached?.props.url).toBe('blob:cached-key');
  });

  it('keeps the dimension effect mounted for equal dimensions and reconfigures it once when width or height changes', () => {
    const callbacks = parentCallbacks('current');
    const mounted = renderCanvas(callbacks);
    const initialObserver = ResizeObserverStub.instances[0];

    const unchanged = renderCanvas(callbacks, 200, 100, mounted.shell);
    expect(unchanged.tree.props.style).toMatchObject({ width: '400px', height: '200px' });
    expect(ResizeObserverStub.instances).toHaveLength(1);
    expect(initialObserver.disconnect).not.toHaveBeenCalled();
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

    renderCanvas(callbacks, 100, 100, mounted.shell);
    expect(ResizeObserverStub.instances).toHaveLength(2);
    expect(initialObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);

    const activeObserver = ResizeObserverStub.instances[1];
    mounted.shell.parentElement.width = 450;
    mounted.shell.parentElement.height = 240;
    activeObserver.callback();
    const afterObserver = renderCanvas(callbacks, 100, 100, mounted.shell);
    expect(afterObserver.tree.props.style).toMatchObject({ width: '240px', height: '240px' });
    expect(ResizeObserverStub.instances).toHaveLength(2);
    expect(activeObserver.disconnect).not.toHaveBeenCalled();
  });

  it('unmounts the active observer and pending animation frame exactly once', () => {
    const callbacks = parentCallbacks('current');
    renderCanvas(callbacks);
    const activeObserver = ResizeObserverStub.instances[0];

    runtime.unmount();
    runtime.unmount();
    runtime.flushEffects();

    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(activeObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(pendingAnimationFrames).toHaveLength(0);
    expect(performanceMocks.recordCounter).toHaveBeenCalledWith('observer.canvasMount.resize.cleanup');
  });
});
