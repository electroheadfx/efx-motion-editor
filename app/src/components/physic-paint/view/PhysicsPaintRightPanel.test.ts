import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentChildren, VNode } from 'preact';
import { signal } from '@preact/signals';
import { createPhysicsPaintPaneResizeDrag, PhysicsPaintRightPanel, type PhysicsPaintRightPanelProps } from './PhysicsPaintRightPanel';
import { SliderStepper } from '../../shared/SliderStepper';
import type { PhysicsPaintAudioController } from './physicsPaintAudioController';
import { physicPaintVersion } from '../../../stores/physicPaintStore';
import { activeModule } from '../../shared/activeModule';
import type { ScriptMemorySnapshot } from '../performance/scriptMemorySnapshot';

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
/** Per-component hook frames so extracted tabs keep state across expansions. */
let componentFrames = new Map<string, { slots: Array<{ value?: unknown; deps?: unknown[]; cleanup?: () => void }> }>();
// 49-06 (UAT round 2): the tool-pane tab is a Studio-owned signal. The harness
// shares ONE signal across renders so a manual tab click sticks through
// re-renders (the 47 UAT contract) and a Bg clip selection forces Background.
let toolTabSignal = signal<'paint' | 'track' | 'background'>('paint');

vi.mock('preact/hooks', () => ({
  useState: <T,>(initial: T | (() => T)) => runtime.useState(initial),
  useRef: <T,>(initial: T) => runtime.useRef(initial),
  useMemo: <T,>(factory: () => T, deps: unknown[]) => runtime.useMemo(factory, deps),
  useCallback: <T,>(callback: T, deps: unknown[]) => runtime.useCallback(callback, deps),
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => runtime.useEffect(effect, deps),
}));

vi.mock('../../../lib/paintPreferences', () => mocks);
vi.mock('../../sidebar/SidebarScrollArea', () => ({
  // 260905-epb: a marker div exposes the scroll-region boundary in the vnode
  // tree so the hierarchy tests can assert what is pinned vs. what scrolls.
  SidebarScrollArea: ({ children }: { children: ComponentChildren }) => ({ type: 'div', props: { class: 'sidebar-scroll-area-mock', children } }),
}));
vi.mock('./PhysicsPaintScriptsPanel', () => ({
  PhysicsPaintScriptsPanel: () => null,
}));
// Icons used by the panel tree pulled in through WatercolorModuleSection
// (AquarelleToolRow + BrushesDocker) and the sections this harness walks.
vi.mock('lucide-preact', () => {
  const Icon = () => null;
  return {
    GripHorizontal: Icon,
    X: Icon,
    Trash2: Icon,
    AudioWaveform: Icon,
    Paintbrush: Icon,
    Droplet: Icon,
    Pen: Icon,
    Eraser: Icon,
    Plus: Icon,
    FolderOpen: Icon,
    Star: Icon,
    ChevronDown: Icon,
    ChevronRight: Icon,
    Search: Icon,
  };
});
// The Background Clip section is signals-driven (useSignal only); the harness
// walks components as plain function calls, so useSignal maps to the real
// signal core (the BackgroundAssetPickerView.test.ts pattern).
vi.mock('@preact/signals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@preact/signals')>();
  return {
    ...actual,
    useSignal: <Value,>(value: Value) => actual.signal(value),
  };
});

function baseProps(overrides: Partial<PhysicsPaintRightPanelProps> = {}): PhysicsPaintRightPanelProps {
  return {
    activeTool: 'paint',
    color: '#103c65',
    opacity: 100,
    brushSize: 11,
    onBrushSizeChange: vi.fn(),
    onOpacityChange: vi.fn(),
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
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onClearFrame: vi.fn(),
    trackName: 'Paint 1',
    trackOpacity: 1,
    trackBlendMode: 'normal',
    onTrackOpacityChange: vi.fn(),
    onTrackBlendChange: vi.fn(),
    scripts: { library: { enterScripts: vi.fn() } } as unknown as PhysicsPaintRightPanelProps['scripts'],
    toolTab: toolTabSignal,
    ...overrides,
  };
}

function renderPanel(props: PhysicsPaintRightPanelProps): AnyVNode {
  runtime.beginRender();
  const tree = PhysicsPaintRightPanel(props) as AnyVNode;
  runtime.finishRender();
  return tree;
}

/**
 * Call a function component against a persistent per-component hook frame
 * (I-10 adoption). Extracted tabs (RightPanelColorTab etc.) own their
 * useState/useRef slots; a shared cursor would collide with the panel's own
 * slots, and a per-call fresh frame would wipe palette state between
 * lookups. One frame per component name mirrors Preact's per-instance hooks.
 */
function callComponent(type: (props: Record<string, any>) => unknown, props: Record<string, any>): unknown {
  const name = type.name || 'anon';
  const internals = runtime as unknown as {
    cursor: number;
    slots: Array<{ value?: unknown; deps?: unknown[]; cleanup?: () => void }>;
    pendingEffects: Array<() => void>;
  };
  const savedCursor = internals.cursor;
  const savedSlots = internals.slots;
  let frame = componentFrames.get(name);
  if (!frame) {
    frame = { slots: [] };
    componentFrames.set(name, frame);
  }
  internals.cursor = 0;
  internals.slots = frame.slots;
  const savedPending = internals.pendingEffects;
  internals.pendingEffects = [];
  try {
    const result = type(props);
    const ownEffects = internals.pendingEffects;
    internals.pendingEffects = savedPending;
    for (const effect of ownEffects) effect();
    return result;
  } finally {
    internals.slots = savedSlots;
    internals.cursor = savedCursor;
  }
}

function childrenOf(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
  if (typeof vnode.type === 'function') {
    // The harness invokes components by hand, so function vnodes stay
    // unexpanded in the returned tree — expand them so lookups and the text
    // walker reach the elements the component actually renders.
    const rendered = callComponent(vnode.type as (props: Record<string, any>) => unknown, vnode.props);
    return [vnode, ...childrenOf(rendered)];
  }
  const children = vnode.props?.children;
  return [vnode, ...childrenOf(children)];
}

function textContent(node: unknown): string {
  const parts: string[] = [];
  const walk = (current: unknown) => {
    if (typeof current === 'string' || typeof current === 'number') { parts.push(String(current)); return; }
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) { for (const child of current) walk(child); return; }
    const vnode = current as AnyVNode;
    if (typeof vnode.type === 'function') {
      // Expand extracted tab components so track/onion labels inside
      // RightPanel*Tab reach the text walker (I-10).
      try {
        walk(callComponent(vnode.type as (props: Record<string, any>) => unknown, vnode.props));
      } catch {
        // Unrenderable mock leaf — contributes no text.
      }
      return;
    }
    walk(vnode.props?.children);
  };
  walk(node);
  return parts.join(' ');
}

function findById(tree: AnyVNode, id: string): AnyVNode {
  // Skip function-component vnodes (their props.id mirrors the element's)
  // so the lookup lands on the rendered host element, e.g. the range input
  // inside PanelSlider rather than the PanelSlider vnode itself.
  const match = childrenOf(tree).find((node) => {
    const vnode = node as AnyVNode;
    return vnode.props?.id === id && typeof vnode.type !== 'function';
  }) as AnyVNode | undefined;
  expect(match, `Missing element with id ${id}`).toBeDefined();
  return match!;
}

/**
 * The blended SliderStepper vnode for a field (the id rides on the component,
 * whose rendered root also carries it). Assertions read the COMPONENT's props —
 * value / min / max / commitOnRelease / onChange. Matched on the exported
 * component identity so the wrapping PanelSlider (same id prop) never wins.
 */
function findStepper(tree: AnyVNode, id: string): AnyVNode {
  const match = childrenOf(tree).find((node) => {
    const vnode = node as AnyVNode;
    return vnode.type === SliderStepper && vnode.props?.id === id;
  }) as AnyVNode | undefined;
  expect(match, `Missing SliderStepper with id ${id}`).toBeDefined();
  return match!;
}

/** The five-option blend select in the Track section (TML-04). */
const TRACK_BLEND_OPTIONS = ['normal', 'screen', 'multiply', 'overlay', 'add'];

/** Find a host element by class (the harness walks expanded components). */
function findByClass(tree: AnyVNode, className: string): AnyVNode {
  const match = childrenOf(tree).find((node) => {
    const vnode = node as AnyVNode;
    return typeof vnode.type !== 'function' && String(vnode.props?.class ?? '').split(/\s+/).includes(className);
  }) as AnyVNode | undefined;
  expect(match, `Missing element with class ${className}`).toBeDefined();
  return match!;
}

/** True when a host element vnode carries the given class (260905-epb). */
function hasClass(node: unknown, className: string): boolean {
  const vnode = node as AnyVNode;
  return typeof vnode?.type !== 'function' && String(vnode?.props?.class ?? '').split(/\s+/).includes(className);
}

/** The raw children of a host element vnode — no function-vnode expansion. */
function directChildrenOf(node: AnyVNode): unknown[] {
  const children = node.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
}

/** Click a tool-pane tab and re-render so the harness picks up the state. */
function clickToolTab(tree: AnyVNode, tabClass: string): void {
  const tab = findByClass(tree, tabClass);
  (tab.props.onClick as () => void)();
}

/** Render the panel and open the 'Track' tab (the initial tab is 'Paint'). */
function renderPanelWithTrackTab(props: PhysicsPaintRightPanelProps): AnyVNode {
  const tree = renderPanel(props);
  clickToolTab(tree, 'physics-paint-tab-track-option');
  return renderPanel(props);
}

beforeEach(() => {
  runtime = new HookRuntime();
  componentFrames = new Map();
  toolTabSignal = signal<'paint' | 'track' | 'background'>('paint');
  vi.clearAllMocks();
  mocks.loadFavoriteColors.mockResolvedValue([]);
  mocks.loadRecentColors.mockResolvedValue([]);
  mocks.loadHiddenPaletteColors.mockResolvedValue([]);
  mocks.saveFavoriteColors.mockResolvedValue();
  mocks.saveRecentColors.mockResolvedValue();
  mocks.saveHiddenPaletteColors.mockResolvedValue();
});

describe('Physics Paint right panel Track section (47-03, TML-04 + 47 UAT tabs)', () => {
  it('hosts the track options behind the Track tab: active track name, opacity slider value, and blend select value', () => {
    const tree = renderPanelWithTrackTab(baseProps({
      trackName: 'Paint 1',
      trackOpacity: 0.5,
      trackBlendMode: 'multiply',
    }));

    // 261008-ryq: the tool-pane tabs are Paint | Track | Audio (relabeled —
    // no 'option' suffix), each asserted on its OWN button so the check does
    // not pass off unrelated panel text.
    const paintTab = textContent(findByClass(tree, 'physics-paint-tab-paint-option'));
    expect(paintTab).toContain('Paint');
    expect(paintTab).not.toContain('option');
    const trackTab = textContent(findByClass(tree, 'physics-paint-tab-track-option'));
    expect(trackTab).toContain('Track');
    expect(trackTab).not.toContain('option');
    expect(textContent(findByClass(tree, 'physics-paint-tab-audio-option'))).toContain('Audio');
    expect(textContent(tree)).toContain('Blend');
    expect(textContent(tree)).toContain('Paint 1');
    expect(findStepper(tree, 'physics-track-opacity').props.value).toBe(0.5);
    expect(findById(tree, 'physics-track-blend').props.value).toBe('multiply');
  });

  it('keeps the track controls out of the Paint panel (47 UAT)', () => {
    const tree = renderPanel(baseProps());
    expect(findByClass(tree, 'physics-paint-tab-paint-option').props['aria-selected']).toBe(true);
    expect(findByClass(tree, 'physics-paint-tab-track-option').props['aria-selected']).toBe(false);
    expect(textContent(tree)).not.toContain('Track:');
  });

  it('commits the track opacity only when the thumb is released (48-06 UAT)', () => {
    // Clamping first (fresh signal draft): the slider display always clamps to
    // the declared 0..1 range (47-03 TML-04).
    const clampedUp = renderPanelWithTrackTab(baseProps({ trackOpacity: 1.5 }));
    expect(findStepper(clampedUp, 'physics-track-opacity').props.value).toBe(1);

    const clampedDown = renderPanelWithTrackTab(baseProps({ trackOpacity: -0.2 }));
    expect(findStepper(clampedDown, 'physics-track-opacity').props.value).toBe(0);

    const props = baseProps({ trackOpacity: 0.5 });
    const tree = renderPanelWithTrackTab(props);
    const stepper = findStepper(tree, 'physics-track-opacity');

    // The panel hands the blended component the release-commit law and the
    // raw commit callback; the drag draft itself lives inside SliderStepper.
    expect(stepper.props.commitOnRelease).toBe(true);
    expect(stepper.props.onChange).toBe(props.onTrackOpacityChange);
    expect(props.onTrackOpacityChange).not.toHaveBeenCalled();
    expect(stepper.props.min).toBe(0);
    expect(stepper.props.max).toBe(1);
  });

  it('commits the selected blend mode once and offers exactly the five BlendMode options', () => {
    const props = baseProps({ trackBlendMode: 'normal' });
    const tree = renderPanelWithTrackTab(props);

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
    const first = renderPanelWithTrackTab(baseProps({
      trackName: 'Paint 1',
      trackOpacity: 0.5,
      trackBlendMode: 'multiply',
    }));

    expect(textContent(first)).toContain('Paint 1');
    expect(findStepper(first, 'physics-track-opacity').props.value).toBe(0.5);
    expect(findById(first, 'physics-track-blend').props.value).toBe('multiply');

    const second = renderPanelWithTrackTab(baseProps({
      trackName: 'Paint 2',
      trackOpacity: 1,
      trackBlendMode: 'normal',
    }));

    expect(textContent(second)).toContain('Paint 2');
    expect(textContent(second)).not.toContain('Paint 1');
    expect(findStepper(second, 'physics-track-opacity').props.value).toBe(1);
    expect(findById(second, 'physics-track-blend').props.value).toBe('normal');
  });

  it('keeps the manually selected tab across re-renders — no auto-select fights the user\'s choice (47 UAT)', () => {
    // Track selection, tool changes, and paint activity must NEVER move the
    // tab: a manual 'Track' click sticks through re-renders with
    // different active tracks/tools, and a paint revision bump does not
    // revert it.
    const first = renderPanel(baseProps());
    clickToolTab(first, 'physics-paint-tab-track-option');
    const onTrack = renderPanel(baseProps());
    expect(findStepper(onTrack, 'physics-track-opacity')).toBeDefined();

    // Active track changes + a paint revision bump: the tab stays put.
    renderPanel(baseProps({ trackName: 'Paint 2' }));
    physicPaintVersion.value++;
    const afterPaintBump = renderPanel(baseProps({ trackName: 'Paint 2' }));

    expect(findByClass(afterPaintBump, 'physics-paint-tab-track-option').props['aria-selected']).toBe(true);
    expect(findStepper(afterPaintBump, 'physics-track-opacity')).toBeDefined();

    // Manual 'Paint' click also sticks.
    clickToolTab(afterPaintBump, 'physics-paint-tab-paint-option');
    const onPaint = renderPanel(baseProps({ activeTool: 'erase' }));
    expect(findByClass(onPaint, 'physics-paint-tab-paint-option').props['aria-selected']).toBe(true);
    expect(findStepper(onPaint, 'physics-edge-detail')).toBeDefined();
  });

  it('49-06 UAT round 2: a selected Bg clip shows the Background option tab — a THIRD tab that never replaces Track option', () => {
    const selectedBackgroundClipId = signal<string | null>('clip-1');
    const tree = renderPanel(baseProps({
      backgroundClipSection: {
        layerId: 'layer-1',
        selectedBackgroundClipId,
        ports: {},
      },
    }));
    // The Background option tab appears and is active.
    expect(findByClass(tree, 'physics-paint-tab-background-option').props['aria-selected']).toBe(true);
    // Track option is STILL present — it is never replaced by the clip section.
    expect(findByClass(tree, 'physics-paint-tab-track-option')).toBeDefined();
    expect(findByClass(tree, 'physics-paint-tab-paint-option')).toBeDefined();
    // The Track section content is NOT shown while a clip is selected.
    const trackOpacity = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return vnode.props?.id === 'physics-track-opacity';
    });
    expect(trackOpacity).toBeUndefined();
  });

  it('49-06 UAT round 2: clearing the Bg selection returns the panel to the manual tab (Track option)', () => {
    const selectedBackgroundClipId = signal<string | null>('clip-1');
    const props = baseProps({
      backgroundClipSection: {
        layerId: 'layer-1',
        selectedBackgroundClipId,
        ports: {},
      },
    });
    const withClip = renderPanel(props);
    expect(findByClass(withClip, 'physics-paint-tab-background-option').props['aria-selected']).toBe(true);
    // The controller clears the selection (a Paint track click) AND returns
    // the tool tab to Track — the Background tab disappears and the manual
    // Track tab shows again.
    selectedBackgroundClipId.value = null;
    toolTabSignal.value = 'track';
    const cleared = renderPanel(props);
    const backgroundTab = childrenOf(cleared).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function'
        && String(vnode.props?.class ?? '').split(/\s+/).includes('physics-paint-tab-background-option');
    });
    expect(backgroundTab).toBeUndefined();
    expect(findByClass(cleared, 'physics-paint-tab-track-option').props['aria-selected']).toBe(true);
    expect(findStepper(cleared, 'physics-track-opacity')).toBeDefined();
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

describe('PhysicsPaintRightPanel scroll hierarchy (260905-epb)', () => {
  it('pins the tools pane tablist as a sibling of the scroll area with the tab panel inside it', () => {
    const tree = renderPanel(baseProps());
    const toolsPane = findByClass(tree, 'physics-paint-right-pane-tools');
    const direct = directChildrenOf(toolsPane);
    // The tablist is a direct child of the pane — a sibling of the scroll area,
    // never a descendant of it.
    const tablist = direct.find((child) => hasClass(child, 'physics-paint-options-tabs-tool'));
    expect(tablist).toBeDefined();
    const scrollAreaVnode = direct.find((child) => {
      const vnode = child as AnyVNode;
      return typeof vnode.type === 'function' && String(vnode.props?.class ?? '').includes('physics-paint-right-pane-scroll-area');
    });
    expect(scrollAreaVnode).toBeDefined();
    // The tab panel content IS inside the scroll area.
    const section = childrenOf(scrollAreaVnode).find((node) => hasClass(node, 'physics-paint-options-tabs-section'));
    expect(section).toBeDefined();
  });

  it('pins the secondary pane tablist as a sibling of the scroll area with the tab panel inside it', () => {
    const tree = renderPanel(baseProps());
    // Open the Onion tab so the pane-level scroll area wraps the tab panel
    // (the scripts tab renders the ScriptsPanel directly, no pane scroll area).
    const onionTab = findByClass(tree, 'physics-paint-tab-onion');
    (onionTab.props.onClick as () => void)();
    const onionTree = renderPanel(baseProps());
    const secondaryPane = findByClass(onionTree, 'physics-paint-right-pane-secondary');
    const direct = directChildrenOf(secondaryPane);
    const tablist = direct.find((child) => hasClass(child, 'physics-paint-options-tabs-navigation'));
    expect(tablist).toBeDefined();
    const scrollAreaVnode = direct.find((child) => {
      const vnode = child as AnyVNode;
      return typeof vnode.type === 'function' && String(vnode.props?.class ?? '').includes('physics-paint-right-pane-scroll-area');
    });
    expect(scrollAreaVnode).toBeDefined();
    const section = childrenOf(scrollAreaVnode).find((node) => hasClass(node, 'physics-paint-options-tabs-section'));
    expect(section).toBeDefined();
  });

  it('keeps the primary pane tablist as a sibling of the scroll area (UI checklist row 6)', () => {
    const tree = renderPanel(baseProps());
    const primaryPane = findByClass(tree, 'physics-paint-right-pane-primary');
    const direct = directChildrenOf(primaryPane);
    expect(direct.some((child) => hasClass(child, 'physics-paint-options-tabs-top'))).toBe(true);
    const scrollAreaVnode = direct.find((child) => {
      const vnode = child as AnyVNode;
      return typeof vnode.type === 'function' && String(vnode.props?.class ?? '').includes('physics-paint-right-pane-scroll-area');
    });
    expect(scrollAreaVnode).toBeDefined();
    const content = childrenOf(scrollAreaVnode).find((node) => hasClass(node, 'physics-paint-right-pane-content'));
    expect(content).toBeDefined();
  });
});

describe('Physics Paint right panel pickup label (260930-ni6)', () => {
  it('labels the pickup slider Blending and keeps the physics-pickup control wiring', () => {
    // 56-02 panel-split moved the Brush-module sliders into BrushModuleSection.
    // The rename pin follows the control home (D-05 shared/module split).
    const panelSrc = readFileSync(new URL('./BrushModuleSection.tsx', import.meta.url), 'utf8');
    // Presence of the new label proves the rename (the label prop holds exactly one value).
    expect(panelSrc).toContain('label="Blending"');
    // The id pin guards the control wiring — value/onChange stay on the same element.
    expect(panelSrc).toContain('id="physics-pickup"');
  });
});

/** Hand-rolled controller + ports for the Audio tab (261008-ryq). */
function audioTabHarness(missingIds: ReadonlySet<string> = new Set()) {
  const selectedSoundId = signal<string | null>('clip-1');
  const controller = {
    audios: [
      { id: 'clip-1', sourcePath: '/Users/test/Music/one.wav', startFrame: 0, inFrame: 2, outFrame: 24, enabled: true },
      { id: 'clip-2', sourcePath: '/Users/test/Music/two.wav', startFrame: 12, inFrame: 0, outFrame: 18, enabled: false },
    ],
    selectedSoundId,
    removeArmed: false,
    busy: false,
    confirmRemove: vi.fn(),
    requestRemove: vi.fn(),
    disarmRemove: vi.fn(),
    isSoundMissing: (clip: { id: string }) => missingIds.has(clip.id),
  } as unknown as PhysicsPaintAudioController;
  const onSelectClip = vi.fn();
  const onImportRequest = vi.fn();
  const props = baseProps({
    audioSectionPorts: { getController: () => controller, onSelectClip, onImportRequest },
  });
  return { controller, selectedSoundId, onSelectClip, onImportRequest, props };
}

/** Render the panel with the Audio tab open. */
function renderAudioTab(props: PhysicsPaintRightPanelProps): AnyVNode {
  const tree = renderPanel(props);
  clickToolTab(tree, 'physics-paint-tab-audio-option');
  return renderPanel(props);
}

describe('Physics Paint right panel Audio tab (261008-ryq)', () => {
  it('renders one row per clip with the selected highlight, filename and frame span', () => {
    const { props } = audioTabHarness();
    const tree = renderAudioTab(props);

    const rows = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-audio-clip-row'));
    expect(rows).toHaveLength(2);
    const selectedRows = rows.filter((node) => hasClass(node, 'physics-paint-audio-clip-row-selected'));
    expect(selectedRows).toHaveLength(1);
    expect(textContent(selectedRows[0])).toContain('one.wav');
    expect(textContent(selectedRows[0])).toMatch(/0\s+·\s+2\s+\.\.\s+24/);
    expect(textContent(selectedRows[0])).toContain('On');
    // The unselected row carries its own span/toggle text, no highlight class.
    const otherRow = rows.find((node) => !hasClass(node, 'physics-paint-audio-clip-row-selected'))!;
    expect(textContent(otherRow)).toContain('two.wav');
    expect(textContent(otherRow)).toMatch(/12\s+·\s+0\s+\.\.\s+18/);
    expect(textContent(otherRow)).toContain('Off');
  });

  it('row click calls onSelectClip with that clip id (select + reveal + open live in the Studio handler)', () => {
    const { props, onSelectClip } = audioTabHarness();
    const tree = renderAudioTab(props);

    const selects = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-audio-clip-select'));
    expect(selects).toHaveLength(2);
    ((selects[1] as AnyVNode).props.onClick as () => void)();
    expect(onSelectClip).toHaveBeenCalledOnce();
    expect(onSelectClip).toHaveBeenCalledWith('clip-2');
  });

  it('trash rides the shared two-step arm: first press selects + requestRemove, second press confirms', () => {
    const { controller, selectedSoundId, props } = audioTabHarness();
    let tree = renderAudioTab(props);

    // First press on the UNARMED row 2: selects it and arms via requestRemove.
    let trashes = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-audio-clip-trash'));
    ((trashes[1] as AnyVNode).props.onClick as () => void)();
    expect(selectedSoundId.value).toBe('clip-2');
    expect(controller.requestRemove).toHaveBeenCalledOnce();
    expect(controller.confirmRemove).not.toHaveBeenCalled();

    // Arm lands (the fake mirrors the controller's armed state) → second press confirms.
    (controller as { removeArmed: boolean }).removeArmed = true;
    tree = renderPanel(props);
    trashes = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-audio-clip-trash'));
    ((trashes[1] as AnyVNode).props.onClick as () => void)();
    expect(controller.confirmRemove).toHaveBeenCalledOnce();
  });

  it('(261009-ofk) a missing clip renders its row with the missing class and a Relink button', () => {
    const { props } = audioTabHarness(new Set(['clip-1']));
    const tree = renderAudioTab(props);

    const rows = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-audio-clip-row'));
    const missingRows = rows.filter((node) => hasClass(node, 'physics-paint-audio-clip-row-missing'));
    expect(missingRows).toHaveLength(1);
    const relinkButtons = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-audio-clip-relink'));
    expect(relinkButtons).toHaveLength(1);
    expect(textContent(relinkButtons[0])).toContain('Relink');
  });

  it('(261009-ofk) clicking Relink sets selectedSoundId to that clip id and calls onImportRequest(\'replace\') once', () => {
    const { props, controller, onImportRequest } = audioTabHarness(new Set(['clip-2']));
    const tree = renderAudioTab(props);

    const relinkButtons = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-audio-clip-relink'));
    expect(relinkButtons).toHaveLength(1);
    ((relinkButtons[0] as AnyVNode).props.onClick as () => void)();

    expect(controller.selectedSoundId.value).toBe('clip-2');
    expect(onImportRequest).toHaveBeenCalledTimes(1);
    expect(onImportRequest).toHaveBeenCalledWith('replace');
  });

  it('(261009-ofk) a present clip renders no Relink button', () => {
    const { props } = audioTabHarness(new Set());
    const tree = renderAudioTab(props);

    const relinkButtons = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-audio-clip-relink'));
    expect(relinkButtons).toHaveLength(0);
  });

  it('Import disarms first then requests the append import', () => {
    const { controller, onImportRequest, props } = audioTabHarness();
    const tree = renderAudioTab(props);

    (findByClass(tree, 'physics-paint-audio-clip-import').props.onClick as () => void)();
    expect(controller.disarmRemove).toHaveBeenCalledOnce();
    expect(onImportRequest).toHaveBeenCalledOnce();
    expect(onImportRequest).toHaveBeenCalledWith('append');
  });

  it('renders no audio arm (null, no crash) when the tab is opened without ports', () => {
    const tree = renderAudioTab(baseProps());
    const rows = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-audio-clip-row'));
    expect(rows).toHaveLength(0);
    expect(childrenOf(tree).some((node) => hasClass(node, 'physics-paint-audio-clip-list'))).toBe(false);
  });
});

// quick-261023-ors: the LAST top-pane tab — the read-only script-memory gauge.
const SAMPLE_MEMORY_SNAPSHOT: ScriptMemorySnapshot = {
  capturedAt: '2026-10-23T00:00:00.000Z',
  approxMethod: 'json-utf8-byte-length',
  watercolor: {
    frames: [{ frame: 5, strokes: 2, points: 20, approxBytes: 2048 }],
    deleted: { strokes: 0, points: 0, approxBytes: 0 },
    orphanedStrokes: 0,
    skippedStrokes: 0,
    dryEvents: { count: 0, approxBytes: 0 },
    totals: { frames: 1, strokes: 2, points: 20, approxBytes: 2048 },
  },
  brush: {
    scope: 'per-frame-session-store',
    frames: [
      { frame: 9, strokes: 3, points: 30, approxBytes: 4096, complete: true, diffusionFrames: 0, hydratable: true },
    ],
    totals: { strokes: 3, points: 30, approxBytes: 4096, completeFrames: 1, partialFrames: 0 },
    currentEngineFrame: { available: true, strokes: 3, points: 30, approxBytes: 4096 },
    note: 'sample note',
  },
  frameCache: {
    scope: 'this-webview',
    totalBytes: 3072,
    caches: [
      { name: 'frameLru', kind: 'decoded-image', byteTotalBytes: 1024, entryCount: 2 },
      { name: 'generatedRenderSource', kind: 'compressed-bytes', byteTotalBytes: 2048, entryCount: 1 },
    ],
  },
};

function memorySectionFixture(frame = 5) {
  return {
    ports: {
      read: () => SAMPLE_MEMORY_SNAPSHOT,
      purgeFrame: vi.fn(() => true),
      purgeRail: vi.fn(() => true),
      clearRail: vi.fn(() => true),
    },
    frame: signal(frame),
    railContext: signal<{
      trackName: string;
      keyRail: { frames: readonly number[]; startFrame: number; endFrame: number } | null;
    } | null>({ trackName: 'Paint 1', keyRail: null }),
  };
}

function topPaneTabLabels(tree: AnyVNode): string[] {
  return childrenOf(tree)
    .filter((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function'
        && String(vnode.props?.class ?? '').split(/\s+/).some((token) => token.startsWith('physics-paint-tab-top-'));
    })
    .map((node) => textContent(node));
}

describe('Physics Paint right panel Memory tab (quick-261023-ors)', () => {
  const previousModule = activeModule.value;

  beforeEach(() => {
    // The tab component owns a 2 s cache interval; fake timers keep the
    // harness deterministic and stop it leaking between cases.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    activeModule.value = previousModule;
  });

  it('is the LAST top-pane tab in Brush mode (after Color/Paper)', () => {
    activeModule.value = 'brush';
    const tree = renderPanel(baseProps());
    expect(topPaneTabLabels(tree)).toEqual(['Color', 'Paper', 'Memory']);
  });

  it('is the LAST top-pane tab in watercolor mode (after Color/Brush/Settings/Paper)', () => {
    activeModule.value = 'watercolor';
    const tree = renderPanel(baseProps());
    expect(topPaneTabLabels(tree)).toEqual(['Color', 'Brush', 'Settings', 'Paper', 'Memory']);
  });

  it('renders the gauge only on the Memory tab: contextual scripts, the selected frame, then frame caches', () => {
    activeModule.value = 'brush';
    const props = baseProps({ memorySection: memorySectionFixture(9) });
    const before = renderPanel(props);
    expect(textContent(before)).not.toContain('Frame caches');

    clickToolTab(before, 'physics-paint-tab-top-memory');
    const tree = renderPanel(props);
    // The leaf's mount effect writes the snapshot signal AFTER its first
    // render; the harness has no re-render cycle, so walk once to mount it and
    // read the tree again (the real Preact runtime re-renders on the write).
    textContent(tree);
    const text = textContent(tree);

    // Brush mode shows only the brush figure — the watercolor store is the
    // other module's script and is never mixed into the same readout.
    expect(text).toContain('Scripts total');
    expect(text).toMatch(/Scripts total\s*·\s*Brush\s*:/);
    expect(text).not.toContain('Watercolor');
    // Only the SELECTED frame is listed (no long per-frame inventory).
    expect(text).toContain('Frame 9');
    expect(text).not.toContain('Frame 5');
    expect(findByClass(tree, 'physics-paint-memory-frame-current')).toBeDefined();
    // Caches are a SEPARATE section with their own total and named rows.
    expect(text).toContain('Frame caches');
    expect(text).toContain('frameLru');
    expect(text).toContain('generatedRenderSource');
    expect(text).toContain('Purging keeps the painted pixels');
  });

  it('shows the watercolor figure in watercolor mode for the selected frame', () => {
    activeModule.value = 'watercolor';
    const tree = renderMemoryTab(baseProps({ memorySection: memorySectionFixture(5) }));
    const text = textContent(tree);
    expect(text).toMatch(/Scripts total\s*·\s*Watercolor\s*:/);
    expect(text).not.toContain('Brush:');
    expect(text).toContain('Frame 5');
    expect(text).toContain('Watercolor 2 strokes');
  });

  it('renders an empty Memory body (no throw, no figures) when the section is absent', () => {
    activeModule.value = 'brush';
    const first = renderPanel(baseProps());
    clickToolTab(first, 'physics-paint-tab-top-memory');
    let tree!: AnyVNode;
    expect(() => { tree = renderPanel(baseProps()); }).not.toThrow();
    expect(childrenOf(tree).some((node) => hasClass(node, 'physics-paint-memory-tab'))).toBe(false);
    expect(textContent(tree)).not.toContain('Scripts total');
  });

  it('re-renders an unavailable line (no figures) when the read returns null', () => {
    activeModule.value = 'brush';
    const section = memorySectionFixture();
    const props = baseProps({
      memorySection: { ...section, ports: { ...section.ports, read: () => null } },
    });
    const first = renderPanel(props);
    clickToolTab(first, 'physics-paint-tab-top-memory');
    const tree = renderPanel(props);

    expect(textContent(tree)).toContain('Script memory is unavailable in this session.');
    expect(textContent(tree)).not.toContain('Scripts total');
  });

  // quick-261023-ors Task 2: availability gating + the two inline confirmations.
  function renderMemoryTab(props: PhysicsPaintRightPanelProps): AnyVNode {
    const first = renderPanel(props);
    clickToolTab(first, 'physics-paint-tab-top-memory');
    const tree = renderPanel(props);
    // The leaf's mount effect writes the snapshot signal after its first
    // render; one expansion mounts it, and the lookups below re-expand and
    // read the written signal (the harness has no scheduler of its own).
    textContent(tree);
    return tree;
  }

  it('enables the per-key purge only for a selected frame that has a script in the active module', () => {
    activeModule.value = 'brush';
    // The fixture's brush script is on frame 9; watercolor is on frame 5.
    const onScripted = renderMemoryTab(baseProps({ memorySection: memorySectionFixture(9) }));
    expect(findByClass(onScripted, 'physics-paint-memory-purge-frame').props.disabled).toBe(false);

    const onBlank = renderMemoryTab(baseProps({ memorySection: memorySectionFixture(42) }));
    expect(findByClass(onBlank, 'physics-paint-memory-purge-frame').props.disabled).toBe(true);
    // Clear-all still has script strokes on the rail, so it is offered.
    expect(findByClass(onBlank, 'physics-paint-memory-clear-rail')).toBeDefined();

    // In watercolor mode the same frame 5 is the scripted one.
    activeModule.value = 'watercolor';
    const onWatercolor = renderMemoryTab(baseProps({ memorySection: memorySectionFixture(5) }));
    expect(findByClass(onWatercolor, 'physics-paint-memory-purge-frame').props.disabled).toBe(false);
  });

  it('always shows both actions, with the per-frame label reflecting its script', () => {
    activeModule.value = 'brush';
    const section = memorySectionFixture(9);
    const withScript = renderMemoryTab(baseProps({ memorySection: section }));
    expect(findByClass(withScript, 'physics-paint-memory-purge-frame')).toBeDefined();
    expect(findByClass(withScript, 'physics-paint-memory-clear-rail')).toBeDefined();
    expect(textContent(withScript)).toMatch(/Purge script on frame\s+9/);
    expect(textContent(withScript)).toMatch(/Clear all scripts on\s+Paint 1/);

    const blank = renderMemoryTab(baseProps({ memorySection: memorySectionFixture(42) }));
    expect(findByClass(blank, 'physics-paint-memory-purge-frame').props.disabled).toBe(true);
    expect(textContent(blank)).toContain('No script on this frame');

    // Without a track context the actions still render; only the clear-all
    // label falls back, and the per-frame action is unaffected.
    const withoutRail = renderMemoryTab(baseProps({
      memorySection: { ...section, railContext: signal(null) },
    }));
    expect(findByClass(withoutRail, 'physics-paint-memory-purge-frame')).toBeDefined();
    expect(findByClass(withoutRail, 'physics-paint-memory-clear-rail')).toBeDefined();
    expect(textContent(withoutRail)).toMatch(/Clear all scripts on\s+this rail/);
  });

  it('offers the rail-range purge only for a selected key rail with scripts', () => {
    activeModule.value = 'brush';
    const withScripts = memorySectionFixture(9);
    withScripts.railContext.value = {
      trackName: 'Paint 1',
      keyRail: { frames: [5, 9], startFrame: 5, endFrame: 9 },
    };
    const tree = renderMemoryTab(baseProps({ memorySection: withScripts }));
    expect(findByClass(tree, 'physics-paint-memory-purge-rail').props.disabled).toBe(false);
    expect(textContent(tree)).toMatch(/Purge scripts on rail frames\s+5-9/);

    const emptyRail = memorySectionFixture(9);
    emptyRail.railContext.value = {
      trackName: 'Paint 1',
      keyRail: { frames: [42], startFrame: 42, endFrame: 42 },
    };
    const emptyTree = renderMemoryTab(baseProps({ memorySection: emptyRail }));
    expect(findByClass(emptyTree, 'physics-paint-memory-purge-rail').props.disabled).toBe(true);
    expect(textContent(emptyTree)).toMatch(/No scripts on rail frames\s+42-42/);

    // A Loop Clip rail is derived and carries no key scripts: no range action.
    const loopRail = memorySectionFixture(9);
    const loopTree = renderMemoryTab(baseProps({ memorySection: loopRail }));
    expect(
      childrenOf(loopTree).some((node) => hasClass(node as AnyVNode, 'physics-paint-memory-purge-rail')),
    ).toBe(false);
  });

  it('confirms the rail-range purge with the frame span', () => {
    activeModule.value = 'brush';
    const section = memorySectionFixture(9);
    section.railContext.value = {
      trackName: 'Paint 1',
      keyRail: { frames: [5, 9], startFrame: 5, endFrame: 9 },
    };
    const props = baseProps({ memorySection: section });
    let tree = renderMemoryTab(props);

    (findByClass(tree, 'physics-paint-memory-purge-rail').props.onClick as () => void)();
    tree = renderPanel(props);
    expect(textContent(tree)).toMatch(/Purge scripts on rail frames\s+5-9\s*\?/);
    (findByClass(tree, 'physics-paint-memory-confirm-cancel').props.onClick as () => void)();
    tree = renderPanel(props);
    expect(section.ports.purgeRail).not.toHaveBeenCalled();

    (findByClass(tree, 'physics-paint-memory-purge-rail').props.onClick as () => void)();
    tree = renderPanel(props);
    (findByClass(tree, 'physics-paint-memory-confirm-ok').props.onClick as () => void)();
    expect(section.ports.purgeRail).toHaveBeenCalledTimes(1);
    expect(section.ports.purgeRail).toHaveBeenCalledWith([5, 9]);
  });

  it('disables clear-all when the rail holds no scripts at all', () => {
    activeModule.value = 'brush';
    const empty: ScriptMemorySnapshot = {
      ...SAMPLE_MEMORY_SNAPSHOT,
      watercolor: {
        ...SAMPLE_MEMORY_SNAPSHOT.watercolor,
        frames: [],
        totals: { frames: 0, strokes: 0, points: 0, approxBytes: 0 },
      },
      brush: {
        ...SAMPLE_MEMORY_SNAPSHOT.brush,
        frames: [],
        totals: { strokes: 0, points: 0, approxBytes: 0, completeFrames: 0, partialFrames: 0 },
      },
    };
    const section = memorySectionFixture(5);
    const props = baseProps({
      memorySection: { ...section, ports: { ...section.ports, read: () => empty } },
    });
    const tree = renderMemoryTab(props);
    // Clear-all stays visible at all times, disabled until one scripted frame
    // exists; the per-key purge is disabled and says why.
    expect(findByClass(tree, 'physics-paint-memory-clear-rail').props.disabled).toBe(true);
    expect(findByClass(tree, 'physics-paint-memory-purge-frame').props.disabled).toBe(true);
    expect(textContent(tree)).toContain('No script on this frame');
  });

  it('confirms the per-key purge, and Cancel changes nothing', () => {
    activeModule.value = 'brush';
    const section = memorySectionFixture(9);
    const props = baseProps({ memorySection: section });
    let tree = renderMemoryTab(props);

    (findByClass(tree, 'physics-paint-memory-purge-frame').props.onClick as () => void)();
    tree = renderPanel(props);
    expect(textContent(tree)).toMatch(/Purge the script of Frame\s+9\s*\?/);
    expect(textContent(tree)).toContain('The painted pixels stay');

    // Cancel restores the two buttons and touches neither store.
    (findByClass(tree, 'physics-paint-memory-confirm-cancel').props.onClick as () => void)();
    tree = renderPanel(props);
    expect(textContent(tree)).not.toMatch(/Purge the script of Frame\s+9\s*\?/);
    expect(section.ports.purgeFrame).not.toHaveBeenCalled();
    expect(section.ports.clearRail).not.toHaveBeenCalled();

    // Confirm: the port is called with the displayed frame and the gauge is
    // re-read immediately.
    (findByClass(tree, 'physics-paint-memory-purge-frame').props.onClick as () => void)();
    tree = renderPanel(props);
    (findByClass(tree, 'physics-paint-memory-confirm-ok').props.onClick as () => void)();
    tree = renderPanel(props);
    expect(section.ports.purgeFrame).toHaveBeenCalledTimes(1);
    expect(section.ports.purgeFrame).toHaveBeenCalledWith(9);
    expect(textContent(tree)).not.toMatch(/Purge the script of Frame\s+9\s*\?/);
  });

  it('confirms clear-all with the active-rail wording, and Cancel changes nothing', () => {
    activeModule.value = 'brush';
    const section = memorySectionFixture(5);
    const props = baseProps({ memorySection: section });
    let tree = renderMemoryTab(props);

    (findByClass(tree, 'physics-paint-memory-clear-rail').props.onClick as () => void)();
    tree = renderPanel(props);
    expect(textContent(tree)).toContain('Clear every script on the active rail');
    expect(textContent(tree)).toContain('Every key of this rail loses its script');

    (findByClass(tree, 'physics-paint-memory-confirm-cancel').props.onClick as () => void)();
    tree = renderPanel(props);
    expect(textContent(tree)).not.toContain('Clear every script on the active rail');
    expect(section.ports.clearRail).not.toHaveBeenCalled();

    (findByClass(tree, 'physics-paint-memory-clear-rail').props.onClick as () => void)();
    tree = renderPanel(props);
    (findByClass(tree, 'physics-paint-memory-confirm-ok').props.onClick as () => void)();
    tree = renderPanel(props);
    expect(section.ports.clearRail).toHaveBeenCalledTimes(1);
    expect(textContent(tree)).not.toContain('Clear every script on the active rail');
  });
});
