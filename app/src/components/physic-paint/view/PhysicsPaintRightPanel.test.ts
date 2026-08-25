import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentChildren, VNode } from 'preact';
import { createPhysicsPaintPaneResizeDrag, PhysicsPaintRightPanel, type PhysicsPaintRightPanelProps } from './PhysicsPaintRightPanel';

type AnyVNode = VNode<Record<string, any>>;

const mocks = vi.hoisted(() => ({
  loadFavoriteColors: vi.fn<() => Promise<string[]>>(),
  loadRecentColors: vi.fn<() => Promise<string[]>>(),
  loadHiddenPaletteColors: vi.fn<() => Promise<string[]>>(),
  saveFavoriteColors: vi.fn<(colors: string[]) => Promise<void>>(),
  saveRecentColors: vi.fn<(colors: string[]) => Promise<void>>(),
  saveHiddenPaletteColors: vi.fn<(colors: string[]) => Promise<void>>(),
}));

class HookRuntime {
  private cursor = 0;
  private slots: Array<{ value?: unknown; deps?: unknown[]; cleanup?: () => void }> = [];
  private pendingEffects: Array<() => void> = [];

  beginRender() {
    this.cursor = 0;
    this.pendingEffects = [];
  }

  finishRender() {
    for (const effect of this.pendingEffects) effect();
  }

  useState<T>(initial: T | (() => T)): [T, (next: T | ((current: T) => T)) => void] {
    const index = this.cursor++;
    const slot = this.slots[index] ??= {};
    if (!('value' in slot)) slot.value = typeof initial === 'function' ? (initial as () => T)() : initial;
    return [slot.value as T, (next) => {
      slot.value = typeof next === 'function' ? (next as (current: T) => T)(slot.value as T) : next;
    }];
  }

  useRef<T>(initial: T) {
    const index = this.cursor++;
    const slot = this.slots[index] ??= { value: { current: initial } };
    return slot.value as { current: T };
  }

  useMemo<T>(factory: () => T, deps: unknown[]): T {
    const index = this.cursor++;
    const slot = this.slots[index] ??= {};
    if (!sameDeps(slot.deps, deps)) {
      slot.value = factory();
      slot.deps = deps;
    }
    return slot.value as T;
  }

  useCallback<T>(callback: T, deps: unknown[]): T {
    return this.useMemo(() => callback, deps);
  }

  useEffect(effect: () => void | (() => void), deps?: unknown[]) {
    const index = this.cursor++;
    const slot = this.slots[index] ??= {};
    if (deps && sameDeps(slot.deps, deps)) return;
    this.pendingEffects.push(() => {
      slot.cleanup?.();
      const cleanup = effect();
      slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      slot.deps = deps;
    });
  }
}

function sameDeps(previous: unknown[] | undefined, next: unknown[]) {
  return Boolean(previous && previous.length === next.length && previous.every((value, index) => Object.is(value, next[index])));
}

let runtime = new HookRuntime();

vi.mock('preact/hooks', () => ({
  useState: <T,>(initial: T | (() => T)) => runtime.useState(initial),
  useRef: <T,>(initial: T) => runtime.useRef(initial),
  useMemo: <T,>(factory: () => T, deps: unknown[]) => runtime.useMemo(factory, deps),
  useCallback: <T,>(callback: T, deps: unknown[]) => runtime.useCallback(callback, deps),
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => runtime.useEffect(effect, deps),
}));

vi.mock('../../../lib/paintPreferences', () => mocks);
vi.mock('../../sidebar/SidebarScrollArea', () => ({
  SidebarScrollArea: ({ children }: { children: ComponentChildren }) => children,
}));
vi.mock('./PhysicsPaintScriptsPanel', () => ({
  PhysicsPaintScriptsPanel: () => null,
}));
vi.mock('lucide-preact', () => ({ GripHorizontal: () => null, X: () => null }));

function baseProps(overrides: Partial<PhysicsPaintRightPanelProps> = {}): PhysicsPaintRightPanelProps {
  return {
    activeTool: 'paint',
    color: '#103c65',
    opacity: 100,
    edgeDetail: 50,
    pickup: 50,
    spread: 50,
    smoothing: 1,
    eraseStrength: 50,
    physicsMode: 'local',
    onion: { enabled: true, previous: true, next: true, count: 1, opacity: 50 },
    playWiggle: { strokeDeformation: 0, strokePosition: 0 },
    onColorChange: vi.fn(),
    onEdgeDetailChange: vi.fn(),
    onPickupChange: vi.fn(),
    onSpreadChange: vi.fn(),
    onSmoothingChange: vi.fn(),
    onEraseStrengthChange: vi.fn(),
    onOnionChange: vi.fn(),
    onPlayWiggleChange: vi.fn(),
    trackName: 'Paint 1',
    trackOpacity: 1,
    trackBlendMode: 'normal',
    onTrackOpacityChange: vi.fn(),
    onTrackBlendChange: vi.fn(),
    scripts: { library: { enterScripts: vi.fn() } } as unknown as PhysicsPaintRightPanelProps['scripts'],
    ...overrides,
  };
}

function renderPanel(props: PhysicsPaintRightPanelProps): AnyVNode {
  runtime.beginRender();
  const tree = PhysicsPaintRightPanel(props) as AnyVNode;
  runtime.finishRender();
  return tree;
}

function childrenOf(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
  const children = vnode.props?.children;
  return [vnode, ...childrenOf(children)];
}

function textContent(node: unknown): string {
  const parts: string[] = [];
  const walk = (current: unknown) => {
    if (typeof current === 'string' || typeof current === 'number') { parts.push(String(current)); return; }
    if (!current || typeof current !== 'object') return;
    walk((current as AnyVNode).props?.children);
  };
  walk(node);
  return parts.join(' ');
}

function findById(tree: AnyVNode, id: string): AnyVNode {
  const match = childrenOf(tree).find((node) => (node as AnyVNode).props?.id === id) as AnyVNode | undefined;
  expect(match, `Missing element with id ${id}`).toBeDefined();
  return match!;
}

/** The five-option blend select in the Track section (TML-04). */
const TRACK_BLEND_OPTIONS = ['normal', 'screen', 'multiply', 'overlay', 'add'];

beforeEach(() => {
  runtime = new HookRuntime();
  vi.clearAllMocks();
  mocks.loadFavoriteColors.mockResolvedValue([]);
  mocks.loadRecentColors.mockResolvedValue([]);
  mocks.loadHiddenPaletteColors.mockResolvedValue([]);
  mocks.saveFavoriteColors.mockResolvedValue();
  mocks.saveRecentColors.mockResolvedValue();
  mocks.saveHiddenPaletteColors.mockResolvedValue();
});

describe('Physics Paint right panel Track section (47-03, TML-04)', () => {
  it('renders the Track section with the active track name, opacity slider value, and blend select value', () => {
    const tree = renderPanel(baseProps({
      trackName: 'Paint 1',
      trackOpacity: 0.5,
      trackBlendMode: 'multiply',
    }));

    expect(textContent(findById(tree, 'physics-track-blend'))).toContain('Blend');
    expect(textContent(tree)).toContain('Paint 1');
    expect(findById(tree, 'physics-track-opacity').props.value).toBe(0.5);
    expect(findById(tree, 'physics-track-blend').props.value).toBe('multiply');
  });

  it('commits the dragged opacity once and clamps the slider display to 0..1', () => {
    const props = baseProps({ trackOpacity: 0.5 });
    const tree = renderPanel(props);

    findById(tree, 'physics-track-opacity').props.onInput({ target: { value: '0.8' } });

    expect(props.onTrackOpacityChange).toHaveBeenCalledOnce();
    expect(props.onTrackOpacityChange).toHaveBeenCalledWith(0.8);
    expect(findById(tree, 'physics-track-opacity').props.min).toBe(0);
    expect(findById(tree, 'physics-track-opacity').props.max).toBe(1);

    const clampedUp = renderPanel(baseProps({ trackOpacity: 1.5 }));
    expect(findById(clampedUp, 'physics-track-opacity').props.value).toBe(1);

    const clampedDown = renderPanel(baseProps({ trackOpacity: -0.2 }));
    expect(findById(clampedDown, 'physics-track-opacity').props.value).toBe(0);
  });

  it('commits the selected blend mode once and offers exactly the five BlendMode options', () => {
    const props = baseProps({ trackBlendMode: 'normal' });
    const tree = renderPanel(props);

    findById(tree, 'physics-track-blend').props.onChange({ currentTarget: { value: 'screen' } });

    expect(props.onTrackBlendChange).toHaveBeenCalledOnce();
    expect(props.onTrackBlendChange).toHaveBeenCalledWith('screen');

    const select = findById(tree, 'physics-track-blend');
    const options = childrenOf(select)
      .filter((node) => (node as AnyVNode).type === 'option')
      .map((node) => (node as AnyVNode).props.value);
    expect(options).toEqual(TRACK_BLEND_OPTIONS);
  });

  it('re-renders to the new active track values when the active track changes (D-05)', () => {
    const props = baseProps({
      trackName: 'Paint 1',
      trackOpacity: 0.5,
      trackBlendMode: 'multiply',
    });
    const first = renderPanel(props);

    expect(textContent(first)).toContain('Paint 1');
    expect(findById(first, 'physics-track-opacity').props.value).toBe(0.5);
    expect(findById(first, 'physics-track-blend').props.value).toBe('multiply');

    const second = renderPanel(baseProps({
      trackName: 'Paint 2',
      trackOpacity: 1,
      trackBlendMode: 'normal',
    }));

    expect(textContent(second)).toContain('Paint 2');
    expect(textContent(second)).not.toContain('Paint 1');
    expect(findById(second, 'physics-track-opacity').props.value).toBe(1);
    expect(findById(second, 'physics-track-blend').props.value).toBe('normal');
  });
});

class PointerTarget extends EventTarget {
  captured = true;
  released: number[] = [];

  hasPointerCapture() { return this.captured; }
  releasePointerCapture(pointerId: number) { this.released.push(pointerId); this.captured = false; }
}

function pointerEvent(type: string, clientY = 0, pointerId = 7): PointerEvent {
  const event = new Event(type) as PointerEvent;
  Object.defineProperties(event, {
    clientY: { value: clientY },
    pointerId: { value: pointerId },
  });
  return event;
}

describe('Physics Paint right panel session controls', () => {
  it.each(['pointerup', 'pointercancel'] as const)('releases capture and removes resize listeners on %s', (endEvent) => {
    const target = new PointerTarget();
    const resize = vi.fn();
    createPhysicsPaintPaneResizeDrag({ target: target as unknown as HTMLElement, pointerId: 7, resize });

    target.dispatchEvent(pointerEvent('pointermove', 44));
    target.dispatchEvent(pointerEvent(endEvent));
    target.dispatchEvent(pointerEvent('pointermove', 88));

    expect(resize).toHaveBeenCalledOnce();
    expect(resize).toHaveBeenCalledWith(44);
    expect(target.released).toEqual([7]);
  });

  it('ignores move and end events from another pointer', () => {
    const target = new PointerTarget();
    const resize = vi.fn();
    createPhysicsPaintPaneResizeDrag({ target: target as unknown as HTMLElement, pointerId: 7, resize });

    target.dispatchEvent(pointerEvent('pointermove', 44, 8));
    target.dispatchEvent(pointerEvent('pointerup', 0, 8));
    target.dispatchEvent(pointerEvent('pointermove', 55, 7));

    expect(resize).toHaveBeenCalledOnce();
    expect(resize).toHaveBeenCalledWith(55);
    expect(target.released).toEqual([]);
  });

  it('removes resize listeners and releases capture on lost capture and explicit unmount cleanup', () => {
    const lostTarget = new PointerTarget();
    const lostResize = vi.fn();
    createPhysicsPaintPaneResizeDrag({ target: lostTarget as unknown as HTMLElement, pointerId: 7, resize: lostResize });
    lostTarget.dispatchEvent(new Event('lostpointercapture'));
    lostTarget.dispatchEvent(pointerEvent('pointermove', 44));
    expect(lostResize).not.toHaveBeenCalled();
    expect(lostTarget.released).toEqual([7]);

    const unmountedTarget = new PointerTarget();
    const unmountedResize = vi.fn();
    const cleanup = createPhysicsPaintPaneResizeDrag({ target: unmountedTarget as unknown as HTMLElement, pointerId: 8, resize: unmountedResize });
    cleanup();
    unmountedTarget.dispatchEvent(pointerEvent('pointermove', 55));
    unmountedTarget.dispatchEvent(pointerEvent('pointerup'));
    expect(unmountedResize).not.toHaveBeenCalled();
    expect(unmountedTarget.released).toEqual([8]);
    cleanup();
    expect(unmountedTarget.released).toEqual([8]);
  });

  it('releases the previous drag before a replacement drag captures the same handle', () => {
    const target = new PointerTarget();
    const firstResize = vi.fn();
    const firstCleanup = createPhysicsPaintPaneResizeDrag({ target: target as unknown as HTMLElement, pointerId: 7, resize: firstResize });

    firstCleanup();
    target.captured = true;
    const secondResize = vi.fn();
    createPhysicsPaintPaneResizeDrag({ target: target as unknown as HTMLElement, pointerId: 8, resize: secondResize });
    target.dispatchEvent(pointerEvent('pointermove', 66, 7));
    target.dispatchEvent(pointerEvent('pointermove', 77, 8));
    target.dispatchEvent(pointerEvent('pointercancel', 0, 8));

    expect(target.released).toEqual([7, 8]);
    expect(firstResize).not.toHaveBeenCalled();
    expect(secondResize).toHaveBeenCalledOnce();
    expect(secondResize).toHaveBeenCalledWith(77);
  });
});
