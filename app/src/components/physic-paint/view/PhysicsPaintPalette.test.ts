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

import { PhysicsPaintRightPanel, type PhysicsPaintRightPanelProps } from './PhysicsPaintRightPanel';

const DEFAULTS = ['#103c65', '#2d5be3', '#4caf70', '#f59e0b', '#ff6633', '#ff6666', '#f8fafc', '#111827'];

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
    onSaveState: vi.fn(),
    onLoadState: vi.fn(),
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

async function settleLoads(props: PhysicsPaintRightPanelProps): Promise<AnyVNode> {
  await Promise.resolve();
  await Promise.resolve();
  return renderPanel(props);
}

function childrenOf(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
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
    expect(props.onColorChange).toHaveBeenLastCalledWith('#a1b2c3', 100);

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

  it('gives every visible swatch a removal action that does not select color and persists favorite/recent/default deletion', async () => {
    mocks.loadFavoriteColors.mockResolvedValue(['#abcdef']);
    mocks.loadRecentColors.mockResolvedValue(['#fedcba']);
    const props = baseProps();
    let tree = renderPanel(props);
    tree = await settleLoads(props);

    const visible = paletteColors(tree);
    for (const color of visible) expect(findByAria(tree, `Remove ${color} from palette`)).toBeDefined();

    findByAria(tree, 'Remove #abcdef from palette').props.onClick();
    tree = renderPanel(props);
    expect(props.onColorChange).not.toHaveBeenCalled();
    expect(mocks.saveFavoriteColors).toHaveBeenLastCalledWith([]);
    expect(paletteColors(tree)).not.toContain('#abcdef');

    findByAria(tree, 'Remove #fedcba from palette').props.onClick();
    tree = renderPanel(props);
    expect(mocks.saveRecentColors).toHaveBeenLastCalledWith([]);
    expect(paletteColors(tree)).not.toContain('#fedcba');

    findByAria(tree, 'Remove #103c65 from palette').props.onClick();
    tree = renderPanel(props);
    expect(mocks.saveHiddenPaletteColors).toHaveBeenLastCalledWith(['#103c65']);
    expect(paletteColors(tree)).not.toContain('#103c65');
    expect(props.onColorChange).not.toHaveBeenCalled();
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
