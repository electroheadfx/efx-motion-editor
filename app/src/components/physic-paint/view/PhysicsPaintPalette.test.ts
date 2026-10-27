import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentChildren, VNode } from 'preact';

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
/** Per-component hook frames so the extracted Color tab keeps palette state. */
let componentFrames = new Map<string, { slots: Array<{ value?: unknown; deps?: unknown[]; cleanup?: () => void }> }>();

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
// Icons used by the panel tree pulled in through WatercolorModuleSection
// (AquarelleToolRow + BrushesDocker).
vi.mock('lucide-preact', () => {
  const Icon = () => null;
  return {
    GripHorizontal: Icon,
    X: Icon,
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

import { PhysicsPaintRightPanel, type PhysicsPaintRightPanelProps } from './PhysicsPaintRightPanel';
import { DEFAULT_AQUARELLE_PARAMS } from './aquarelleRecordState';

const DEFAULTS = ['#103c65', '#2d5be3', '#4caf70', '#f59e0b', '#ff6633', '#ff6666', '#f8fafc', '#111827'];

// 261027-klx: the palette commits the Water color Pigment (the aquarelle
// `load` global) as its opacity — the engine-1 `opacity` prop is gone.
const WATERCOLOR_LOAD = DEFAULT_AQUARELLE_PARAMS.load;

function baseProps(overrides: Partial<PhysicsPaintRightPanelProps> = {}): PhysicsPaintRightPanelProps {
  return {
    color: '#103c65',
    // 261018-f15 C2: the panel's size router is onBrushSizeChange (the retired
    // `size`/`onSizeChange` props no longer exist). The palette suite does not
    // exercise size.
    onBrushSizeChange: vi.fn(),
    onion: { enabled: true, previous: true, next: true, count: 1, opacity: 50 },
    playWiggle: { strokeDeformation: 0, strokePosition: 0 },
    onColorChange: vi.fn(),
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
    ...overrides,
  };
}

function renderPanel(props: PhysicsPaintRightPanelProps): AnyVNode {
  runtime.beginRender();
  const tree = PhysicsPaintRightPanel(props) as AnyVNode;
  runtime.finishRender();
  // I-10: RightPanelColorTab owns the palette hooks — expand it so its
  // load effects run before the test awaits settleLoads.
  childrenOf(tree);
  return tree;
}

async function settleLoads(props: PhysicsPaintRightPanelProps): Promise<AnyVNode> {
  await Promise.resolve();
  await Promise.resolve();
  return renderPanel(props);
}

/**
 * Call a function component against a persistent per-component hook frame
 * (I-10 adoption). RightPanelColorTab owns the palette state — a shared
 * cursor collides with the panel's slots, and a per-call fresh frame would
 * wipe favorites between lookups. Effects queued during the call are drained
 * so loadFavoriteColors / loadRecentColors / loadHiddenPaletteColors run.
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
    // Expand extracted tab components (RightPanelColorTab owns the palette).
    return [vnode, ...childrenOf(callComponent(vnode.type as (props: Record<string, any>) => unknown, vnode.props))];
  }
  const children = vnode.props?.children;
  return [vnode, ...childrenOf(children)];
}

function findByAria(tree: AnyVNode, label: string): AnyVNode {
  const match = childrenOf(tree).find((node) => (node as AnyVNode).props?.['aria-label'] === label) as AnyVNode | undefined;
  expect(match, `Missing element with aria-label ${label}`).toBeDefined();
  return match!;
}

function paletteColors(tree: AnyVNode): string[] {
  return childrenOf(findByAria(tree, 'Color palette'))
    .filter((node) => typeof (node as AnyVNode).props?.['aria-label'] === 'string' && (node as AnyVNode).props['aria-label'].startsWith('Use '))
    .map((node) => (node as AnyVNode).props['aria-label'].slice(4));
}

function swatchNodes(tree: AnyVNode): AnyVNode[] {
  return childrenOf(findByAria(tree, 'Color palette')).filter(
    (node) => typeof (node as AnyVNode).props?.['aria-label'] === 'string' && (node as AnyVNode).props['aria-label'].startsWith('Use '),
  ) as AnyVNode[];
}

/** 261025-co0: an event-like object for the palette grid's Delete/Backspace handler. */
function paletteKeyEvent(
  overrides: Partial<{
    key: string;
    repeat: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    preventDefault: ReturnType<typeof vi.fn>;
    stopPropagation: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    key: 'Delete',
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  runtime = new HookRuntime();
  componentFrames = new Map();
  vi.clearAllMocks();
  mocks.loadFavoriteColors.mockResolvedValue([]);
  mocks.loadRecentColors.mockResolvedValue([]);
  mocks.loadHiddenPaletteColors.mockResolvedValue([]);
  mocks.saveFavoriteColors.mockResolvedValue();
  mocks.saveRecentColors.mockResolvedValue();
  mocks.saveHiddenPaletteColors.mockResolvedValue();
});

describe('native-approved Physics Paint palette behavior', () => {
  it('normalizes a newly typed favorite, shows it first immediately, suppresses duplicates, and persists the same list', async () => {
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    findByAria(tree, 'Brush color hex value').props.onInput({ target: { value: ' A1B ' } });
    tree = renderPanel(props);
    findByAria(tree, 'Brush color hex value').props.onInput({ target: { value: '#A1B2C3' } });
    tree = renderPanel(props);
    const add = childrenOf(tree).find((node) => (node as AnyVNode).type === 'button' && (node as AnyVNode).props?.children === '+') as AnyVNode;
    add.props.onClick();
    tree = renderPanel(props);

    expect(paletteColors(tree)[0]).toBe('#a1b2c3');
    expect(paletteColors(tree).filter((color) => color === '#a1b2c3')).toHaveLength(1);
    expect(mocks.saveFavoriteColors).toHaveBeenLastCalledWith(['#a1b2c3']);
    expect(props.onColorChange).toHaveBeenLastCalledWith('#a1b2c3', WATERCOLOR_LOAD);

    const addAgain = childrenOf(tree).find((node) => (node as AnyVNode).type === 'button' && (node as AnyVNode).props?.children === '+') as AnyVNode;
    addAgain.props.onClick();
    tree = renderPanel(props);
    expect(paletteColors(tree).filter((color) => color === '#a1b2c3')).toHaveLength(1);
    expect(mocks.saveFavoriteColors).toHaveBeenCalledTimes(1);
  });

  it('orders every newest favorite before defaults and recents without the former combined 24-color cap', async () => {
    const favorites = Array.from({ length: 20 }, (_, index) => `#${(0x200000 + index).toString(16)}`);
    const recents = Array.from({ length: 12 }, (_, index) => `#${(0x300000 + index).toString(16)}`);
    mocks.loadFavoriteColors.mockResolvedValue(favorites);
    mocks.loadRecentColors.mockResolvedValue(recents);
    const props = baseProps();

    let tree = renderPanel(props);
    tree = await settleLoads(props);
    const colors = paletteColors(tree);

    expect(colors.slice(0, favorites.length)).toEqual([...favorites].reverse());
    expect(colors).toHaveLength(favorites.length + DEFAULTS.length + recents.length);
    expect(colors.length).toBeGreaterThan(24);
    expect(colors[colors.length - 1]).toBe(recents[recents.length - 1]);
  });

  it('renders no removal control and gives every swatch a boolean aria-pressed', async () => {
    mocks.loadFavoriteColors.mockResolvedValue(['#abcdef']);
    mocks.loadRecentColors.mockResolvedValue(['#fedcba']);
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    const labels = childrenOf(tree)
      .map((node) => (node as AnyVNode).props?.['aria-label'])
      .filter((label): label is string => typeof label === 'string');
    expect(labels.some((label) => label.startsWith('Remove '))).toBe(false);

    const nodes = swatchNodes(tree);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(typeof node.props['aria-pressed']).toBe('boolean');
      expect(node.props['aria-pressed']).toBe(false);
    }
  });

  it('selects, applies, commits once, and focuses on a swatch click, then deselects on a second click', async () => {
    mocks.loadFavoriteColors.mockResolvedValue(['#abcdef']);
    const onColorChange = vi.fn();
    const onColorCommit = vi.fn();
    const props = baseProps({ onColorChange, onColorCommit });
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    const focus = vi.fn();
    findByAria(tree, 'Use #abcdef').props.onClick({ currentTarget: { focus } });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(onColorChange).toHaveBeenCalledTimes(1);
    expect(onColorChange).toHaveBeenLastCalledWith('#abcdef', WATERCOLOR_LOAD);
    expect(onColorCommit).toHaveBeenCalledTimes(1);
    expect(onColorCommit).toHaveBeenLastCalledWith('#abcdef', WATERCOLOR_LOAD);

    tree = renderPanel(props);
    expect(findByAria(tree, 'Use #abcdef').props['aria-pressed']).toBe(true);
    for (const node of swatchNodes(tree)) {
      if (node.props['aria-label'] === 'Use #abcdef') continue;
      expect(node.props['aria-pressed']).toBe(false);
    }

    findByAria(tree, 'Use #abcdef').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);
    expect(findByAria(tree, 'Use #abcdef').props['aria-pressed']).toBe(false);
    expect(onColorCommit).toHaveBeenCalledTimes(2);
    expect(onColorCommit).toHaveBeenLastCalledWith('#abcdef', WATERCOLOR_LOAD);
  });

  it('does not rewrite the previously selected swatch when another swatch is clicked', async () => {
    mocks.loadFavoriteColors.mockResolvedValue(['#abcdef']);
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    findByAria(tree, 'Use #abcdef').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);
    expect(findByAria(tree, 'Use #abcdef').props['aria-pressed']).toBe(true);

    findByAria(tree, 'Use #103c65').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);

    expect(mocks.saveFavoriteColors).not.toHaveBeenCalled();
    expect(mocks.saveRecentColors).not.toHaveBeenCalled();
    expect(mocks.saveHiddenPaletteColors).not.toHaveBeenCalled();
    expect(paletteColors(tree)).toContain('#abcdef');
    expect(findByAria(tree, 'Use #103c65').props['aria-pressed']).toBe(true);
    expect(findByAria(tree, 'Use #abcdef').props['aria-pressed']).toBe(false);
  });

  it('rewrites the selected favorite in place on a committed color change', async () => {
    mocks.loadFavoriteColors.mockResolvedValue(['#abcdef']);
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    findByAria(tree, 'Use #abcdef').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);
    expect(findByAria(tree, 'Use #abcdef').props['aria-pressed']).toBe(true);

    findByAria(tree, 'Brush color hex value').props.onInput({ target: { value: '#22aa44' } });
    tree = renderPanel(props);
    findByAria(tree, 'Brush color hex value').props.onKeyDown({ key: 'Enter', currentTarget: { blur: vi.fn() } });
    tree = renderPanel(props);

    expect(mocks.saveFavoriteColors).toHaveBeenLastCalledWith(['#22aa44']);
    expect(mocks.saveRecentColors).not.toHaveBeenCalled();
    expect(paletteColors(tree)[0]).toBe('#22aa44');
    expect(paletteColors(tree)).not.toContain('#abcdef');
    expect(findByAria(tree, 'Use #22aa44').props['aria-pressed']).toBe(true);
  });

  it('hides a rewritten built-in default and adds the replacement as the newest favorite', async () => {
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    findByAria(tree, 'Use #2d5be3').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);
    expect(findByAria(tree, 'Use #2d5be3').props['aria-pressed']).toBe(true);

    findByAria(tree, 'Brush color hex value').props.onInput({ target: { value: '#445566' } });
    tree = renderPanel(props);
    findByAria(tree, 'Brush color hex value').props.onKeyDown({ key: 'Enter', currentTarget: { blur: vi.fn() } });
    tree = renderPanel(props);

    expect(mocks.saveHiddenPaletteColors).toHaveBeenLastCalledWith(['#2d5be3']);
    expect(mocks.saveFavoriteColors).toHaveBeenLastCalledWith(['#445566']);
    expect(paletteColors(tree)).not.toContain('#2d5be3');
    expect(paletteColors(tree)[0]).toBe('#445566');
    expect(findByAria(tree, 'Use #445566').props['aria-pressed']).toBe(true);
  });

  it('never writes palette preferences on an unselected or identical commit', async () => {
    mocks.loadFavoriteColors.mockResolvedValue(['#abcdef']);
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    findByAria(tree, 'Brush color hex value').props.onInput({ target: { value: '#22aa44' } });
    tree = renderPanel(props);
    findByAria(tree, 'Brush color hex value').props.onKeyDown({ key: 'Enter', currentTarget: { blur: vi.fn() } });
    tree = renderPanel(props);
    expect(mocks.saveFavoriteColors).not.toHaveBeenCalled();
    expect(mocks.saveRecentColors).not.toHaveBeenCalled();
    expect(mocks.saveHiddenPaletteColors).not.toHaveBeenCalled();

    findByAria(tree, 'Use #abcdef').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);
    findByAria(tree, 'Brush color hex value').props.onKeyDown({ key: 'Enter', currentTarget: { blur: vi.fn() } });
    tree = renderPanel(props);
    expect(mocks.saveFavoriteColors).not.toHaveBeenCalled();
    expect(mocks.saveRecentColors).not.toHaveBeenCalled();
    expect(mocks.saveHiddenPaletteColors).not.toHaveBeenCalled();
  });

  it('deletes the selected favorite, recent, or default with Delete/Backspace and contains the key', async () => {
    mocks.loadFavoriteColors.mockResolvedValue(['#abcdef']);
    mocks.loadRecentColors.mockResolvedValue(['#fedcba']);
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    findByAria(tree, 'Use #abcdef').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);
    let event = paletteKeyEvent();
    findByAria(tree, 'Color palette').props.onKeyDown(event);
    tree = renderPanel(props);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(mocks.saveFavoriteColors).toHaveBeenLastCalledWith([]);
    expect(paletteColors(tree)).not.toContain('#abcdef');
    expect(swatchNodes(tree).every((node) => node.props['aria-pressed'] === false)).toBe(true);

    findByAria(tree, 'Use #fedcba').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);
    event = paletteKeyEvent({ key: 'Backspace' });
    findByAria(tree, 'Color palette').props.onKeyDown(event);
    tree = renderPanel(props);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(mocks.saveRecentColors).toHaveBeenLastCalledWith([]);
    expect(paletteColors(tree)).not.toContain('#fedcba');

    findByAria(tree, 'Use #103c65').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);
    event = paletteKeyEvent();
    findByAria(tree, 'Color palette').props.onKeyDown(event);
    tree = renderPanel(props);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(mocks.saveHiddenPaletteColors).toHaveBeenLastCalledWith(['#103c65']);
    expect(paletteColors(tree)).not.toContain('#103c65');
    expect(swatchNodes(tree).every((node) => node.props['aria-pressed'] === false)).toBe(true);
  });

  it('contains Delete/Backspace without mutating on no selection, key repeat, or modifiers', async () => {
    mocks.loadFavoriteColors.mockResolvedValue(['#abcdef']);
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    // No selection: the key is contained but nothing is saved.
    let event = paletteKeyEvent();
    findByAria(tree, 'Color palette').props.onKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(mocks.saveFavoriteColors).not.toHaveBeenCalled();
    expect(mocks.saveRecentColors).not.toHaveBeenCalled();
    expect(mocks.saveHiddenPaletteColors).not.toHaveBeenCalled();

    // Selected + key repeat: contained, still nothing saved.
    findByAria(tree, 'Use #abcdef').props.onClick({ currentTarget: { focus: vi.fn() } });
    tree = renderPanel(props);
    event = paletteKeyEvent({ repeat: true });
    findByAria(tree, 'Color palette').props.onKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(mocks.saveFavoriteColors).not.toHaveBeenCalled();

    // Modifier combinations and non-delete keys stay available to the global
    // and Studio handlers, so neither spy fires and nothing is saved.
    event = paletteKeyEvent({ metaKey: true });
    findByAria(tree, 'Color palette').props.onKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();

    event = paletteKeyEvent({ key: 'ArrowLeft' });
    findByAria(tree, 'Color palette').props.onKeyDown(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(mocks.saveFavoriteColors).not.toHaveBeenCalled();
  });

  it('emits ONE color commit per gesture (hex Enter, swatch click, box release), never on live input', async () => {
    const onColorChange = vi.fn();
    const onColorCommit = vi.fn();
    const props = baseProps({ onColorChange, onColorCommit });
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    const hex = findByAria(tree, 'Brush color hex value');
    hex.props.onInput({ target: { value: '#22aa44' } });
    tree = renderPanel(props);
    // Typed hex does not go live; the field commits on Enter/blur only.
    expect(onColorChange).not.toHaveBeenCalled();
    expect(onColorCommit).not.toHaveBeenCalled();

    findByAria(tree, 'Brush color hex value').props.onKeyDown({
      key: 'Enter',
      currentTarget: { blur: vi.fn() },
    });
    expect(onColorChange).toHaveBeenLastCalledWith('#22aa44', WATERCOLOR_LOAD);
    expect(onColorCommit).toHaveBeenCalledTimes(1);
    expect(onColorCommit).toHaveBeenLastCalledWith('#22aa44', WATERCOLOR_LOAD);

    findByAria(tree, 'Use #2d5be3').props.onClick({ currentTarget: { focus: vi.fn() } });
    expect(onColorCommit).toHaveBeenCalledTimes(2);
    expect(onColorCommit).toHaveBeenLastCalledWith('#2d5be3', WATERCOLOR_LOAD);

    // A drag on the color box commits on release, not on pointerdown.
    const box = childrenOf(tree).find(
      (node) => (node as AnyVNode).props?.class === 'physics-paint-color-box',
    ) as AnyVNode;
    box.props.onPointerDown({
      pointerId: 1,
      currentTarget: { setPointerCapture: vi.fn() },
    });
    expect(onColorCommit).toHaveBeenCalledTimes(2);
    box.props.onPointerUp();
    expect(onColorCommit).toHaveBeenCalledTimes(3);
    expect(onColorCommit).toHaveBeenLastCalledWith('#2d5be3', WATERCOLOR_LOAD);
  });

  it('restores a removed built-in default through + as the newest persisted favorite', async () => {
    mocks.loadHiddenPaletteColors.mockResolvedValue(['#103c65']);
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);
    expect(paletteColors(tree)).not.toContain('#103c65');

    const add = childrenOf(tree).find((node) => (node as AnyVNode).type === 'button' && (node as AnyVNode).props?.children === '+') as AnyVNode;
    add.props.onClick();
    tree = renderPanel(props);

    expect(paletteColors(tree)[0]).toBe('#103c65');
    expect(mocks.saveHiddenPaletteColors).toHaveBeenLastCalledWith([]);
    expect(mocks.saveFavoriteColors).toHaveBeenLastCalledWith(['#103c65']);
  });
});
