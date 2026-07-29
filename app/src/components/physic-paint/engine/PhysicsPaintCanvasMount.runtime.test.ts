// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import type {
  CompletedPaintMutation,
  EfxPaintEngine,
  PaintPerformanceSample,
} from '@efxlab/efx-physic-paint';
import { PreactHookRuntime } from '../../../test/preactHookRuntime';
import type { NativePenInputHandler } from './PhysicsPaintCanvasMount';

type AnyVNode = VNode<Record<string, any>>;

const performanceMocks = vi.hoisted(() => ({
  recordCounter: vi.fn(),
}));

let runtime = new PreactHookRuntime();

vi.mock('preact/hooks', () => ({
  useState: <T,>(initial: T | (() => T)) => runtime.useState(initial),
  useRef: <T,>(initial: T) => runtime.useRef(initial),
  useMemo: <T,>(factory: () => T, deps: unknown[]) => runtime.useMemo(factory, deps),
  useCallback: <T,>(callback: T, deps: unknown[]) => runtime.useCallback(callback, deps),
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => runtime.useEffect(effect, deps),
}));

vi.mock('@efxlab/efx-physic-paint/preact', () => ({
  EfxPaintCanvas: 'efx-paint-canvas',
}));

vi.mock('../performance/physicsPaintPerformanceTrace', () => ({
  recordPhysicsPaintPerformanceCounter: performanceMocks.recordCounter,
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
  onEngineReady: ReturnType<typeof vi.fn>;
  onCanvasMounted: ReturnType<typeof vi.fn>;
  onNativePenInputReady: ReturnType<typeof vi.fn>;
  onCompletedMutation: ReturnType<typeof vi.fn>;
  onPerformanceSample: ReturnType<typeof vi.fn>;
  beforeEngineDestroy: ReturnType<typeof vi.fn>;
  getStrokeMetadata: ReturnType<typeof vi.fn>;
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
    onEngineReady: vi.fn(() => label),
    onCanvasMounted: vi.fn(),
    onNativePenInputReady: vi.fn(),
    onCompletedMutation: vi.fn(() => label),
    onPerformanceSample: vi.fn(() => label),
    beforeEngineDestroy: vi.fn(() => label),
    getStrokeMetadata: vi.fn(() => ({ playFrame: label === 'latest' ? 22 : 11 })),
  };
}

function canvasProps(callbacks: ParentCallbacks, width = 200, height = 100) {
  return {
    width,
    height,
    paperTextureScale: 1,
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
  const child = childrenOf(tree).find((node) => node.type === 'efx-paint-canvas');
  expect(child).toBeDefined();
  runtime.flushEffects();
  return { tree, child: child!, shell };
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
  it('keeps captured Efx callback identities stable while invoking only the latest parent callbacks', () => {
    const initial = parentCallbacks('initial');
    const latest = parentCallbacks('latest');
    const mounted = renderCanvas(initial);
    const rerendered = renderCanvas(latest, 200, 100, mounted.shell);
    const callbackNames = [
      'onEngineReady',
      'onNativePenInputReady',
      'onCompletedMutation',
      'onPerformanceSample',
      'beforeEngineDestroy',
      'getStrokeMetadata',
    ] as const;

    for (const name of callbackNames) {
      expect(rerendered.child.props[name], name).toBe(mounted.child.props[name]);
    }

    const engine = { setTool: vi.fn() } as unknown as EfxPaintEngine;
    const penHandler = vi.fn() as unknown as NativePenInputHandler;
    const mutation = {} as CompletedPaintMutation;
    const sample = {} as PaintPerformanceSample;
    mounted.child.props.onEngineReady(engine);
    mounted.child.props.onNativePenInputReady(penHandler);
    mounted.child.props.onCompletedMutation(mutation, engine);
    mounted.child.props.onPerformanceSample(sample);
    mounted.child.props.beforeEngineDestroy(engine);

    expect(mounted.child.props.getStrokeMetadata()).toEqual({ playFrame: 22 });
    expect(engine.setTool).toHaveBeenCalledWith('paint');
    expect(latest.onEngineReady).toHaveBeenCalledWith(engine);
    expect(latest.onCanvasMounted).toHaveBeenCalledWith(true);
    expect(latest.onNativePenInputReady).toHaveBeenCalledWith(penHandler);
    expect(latest.onCompletedMutation).toHaveBeenCalledWith(mutation, engine);
    expect(latest.onPerformanceSample).toHaveBeenCalledWith(sample);
    expect(latest.beforeEngineDestroy).toHaveBeenCalledWith(engine);
    for (const callback of Object.values(initial)) expect(callback).not.toHaveBeenCalled();
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

    const resized = renderCanvas(callbacks, 100, 100, mounted.shell);
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
