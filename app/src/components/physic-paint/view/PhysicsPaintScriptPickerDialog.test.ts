import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Node-environment component harness (the PhysicsPaintScriptsPanel.test.ts
// idiom): preact/hooks is mocked with a cursor-based runtime so the dialog can
// be invoked directly and its vnode tree inspected. No DOM is involved, so the
// focus/dismissal effects never run — their contracts are pinned at source
// level below.
const hooks = vi.hoisted(() => ({
  refs: new Map<number, { current: unknown }>(),
  cursor: 0,
  reset() {
    this.refs = new Map();
    this.cursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useRef: <Value>(initial: Value) => {
    const index = hooks.cursor++;
    if (!hooks.refs.has(index)) hooks.refs.set(index, { current: initial });
    return hooks.refs.get(index) as { current: Value };
  },
  useEffect: () => {},
  useLayoutEffect: () => {},
}));

import { PhysicsPaintScriptPickerDialog } from './PhysicsPaintScriptPickerDialog';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';

const source = readFileSync(fileURLToPath(new URL('./PhysicsPaintScriptPickerDialog.tsx', import.meta.url)), 'utf8');

interface TestVNode {
  type: unknown;
  props: Record<string, unknown>;
}

function sig<Value>(value: Value): { value: Value } {
  return { value };
}

function makeRow(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    revision: `revision-${id}`,
    createdAt: '2026-10-22T00:00:00.000Z',
    updatedAt: '2026-10-22T00:00:00.000Z',
    source: {
      projectName: 'Project',
      layerId: 'layer-1',
      layerName: 'Paint',
      sourceFrame: 0,
      displayFrame: 1,
      width: 1000,
      height: 650,
      background: { background: 'transparent', grainStrength: 0 },
    },
    thumbnail: { dataUrl: 'data:image/webp;base64,AA==', width: 48, height: 48 },
    brushCount: 2,
    integrity: '0'.repeat(64),
    ...overrides,
  };
}

function createFakeLibrary(rows: readonly Record<string, unknown>[], layers: readonly { id: string; name: string }[] = []) {
  return {
    rows: sig(rows),
    scriptLayers: sig(layers),
    // A poisoned marker: the dialog must never touch the library — picking is
    // the Studio's job (it selects and then runs the intent).
    select: vi.fn(),
  } as unknown as RotoScriptLibraryController;
}

beforeEach(() => {
  hooks.reset();
});

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

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node !== 'object') return '';
  return textOf((node as TestVNode).props?.children);
}

function renderDialog(options: {
  open?: boolean;
  intent?: 'load-apply' | 'create-rail';
  library: RotoScriptLibraryController;
  onPick?: (id: string) => void;
  onClose?: () => void;
}): unknown {
  hooks.cursor = 0;
  return PhysicsPaintScriptPickerDialog({
    open: options.open ?? true,
    intent: options.intent ?? 'create-rail',
    library: options.library,
    onPick: options.onPick ?? (() => {}),
    onClose: options.onClose ?? (() => {}),
  });
}

const optionRows = (tree: unknown) => findAll(tree, (vnode) => vnode.props?.role === 'option');

describe('PhysicsPaintScriptPickerDialog contract (261022-o2a)', () => {
  it('renders nothing when closed', () => {
    expect(renderDialog({ open: false, library: createFakeLibrary([makeRow('a', 'Alpha')]) })).toBeNull();
  });

  it('lists one row per library row, including rows outside the current sidebar scope', () => {
    const library = createFakeLibrary(
      [makeRow('a', 'Alpha'), makeRow('b', 'Beta', { source: { ...makeRow('b', 'Beta').source, layerId: 'layer-2', layerName: 'Hair' } })],
      [{ id: 'layer-1', name: 'Paint' }],
    );
    const tree = renderDialog({ library });

    expect(optionRows(tree).map((row) => row.props['aria-label'])).toEqual(['Pick Alpha', 'Pick Beta']);
    // The scope filter is a list-view concession only — the picker must never
    // read it (a hidden Action stays pickable).
    expect(source).not.toContain('scriptScope');
    expect(source).not.toContain('filterScriptRows');
  });

  it('renders the row name, provenance and brush count, live-resolving the layer name', () => {
    const library = createFakeLibrary([makeRow('a', 'Alpha')], [{ id: 'layer-1', name: 'Renamed layer' }]);
    const tree = renderDialog({ library });

    expect(textOf(tree)).toContain('Alpha');
    expect(textOf(tree)).toContain('Project · Renamed layer · F1');
    expect(textOf(tree)).toContain('2 brushes');
  });

  it('flips the title with the intent', () => {
    const library = createFakeLibrary([makeRow('a', 'Alpha')]);
    expect(textOf(renderDialog({ intent: 'load-apply', library }))).toContain('Load + Apply');
    expect(textOf(renderDialog({ intent: 'create-rail', library }))).toContain('Run Script');
    // The subtitle stays intent-independent (the two titles are the only flip).
    expect(textOf(renderDialog({ intent: 'load-apply', library }))).toContain('Pick a project Script.');
    expect(textOf(renderDialog({ intent: 'create-rail', library }))).toContain('Pick a project Script.');
  });

  it('invokes onPick with the row id and never touches the library', () => {
    const onPick = vi.fn();
    const library = createFakeLibrary([makeRow('a', 'Alpha'), makeRow('b', 'Beta')]);
    const tree = renderDialog({ library, onPick });

    const first = optionRows(tree)[0];
    (first.props.onClick as () => void)();
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('a');
    expect(library.select).not.toHaveBeenCalled();

    // Enter and Space activate too; Space must suppress the page scroll.
    const preventDefault = vi.fn();
    const second = optionRows(tree)[1];
    (second.props.onKeyDown as (event: { key: string; preventDefault: () => void }) => void)({ key: 'Enter', preventDefault });
    expect(onPick).toHaveBeenNthCalledWith(2, 'b');
    (second.props.onKeyDown as (event: { key: string; preventDefault: () => void }) => void)({ key: ' ', preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenNthCalledWith(3, 'b');
  });

  it('routes the close X to onClose', () => {
    const onClose = vi.fn();
    const tree = renderDialog({ library: createFakeLibrary([makeRow('a', 'Alpha')]), onClose });
    const close = findAll(tree, (vnode) => vnode.props?.['aria-label'] === 'Close script picker');
    expect(close).toHaveLength(1);
    (close[0].props.onClick as () => void)();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when the project has no Scripts', () => {
    const copy = textOf(renderDialog({ library: createFakeLibrary([]) }));
    expect(copy).toContain('No project Scripts yet.');
    expect(copy).toContain('Save the current real Roto frame as a Script first.');
    expect(optionRows(renderDialog({ library: createFakeLibrary([]) }))).toHaveLength(0);
  });

  it('pins the sanctioned dialog behaviours at source level (focus, dismissal, exempt root)', () => {
    // Focus capture/restore — deferred surface focus on open, restore only when
    // the opener is still attached, and no dangling timer.
    expect(source).toContain('previousActiveElement.current = document.activeElement');
    expect(source).toContain('window.setTimeout(() => surfaceRef.current?.focus?.(), 0)');
    expect(source).toContain('previous instanceof HTMLElement && previous.isConnected');
    expect(source).toContain('previous.focus?.()');
    expect(source).toContain('window.clearTimeout(timer)');
    // Outside pointerdown closes; clicks inside the surface never do.
    expect(source).toContain("window.addEventListener('pointerdown', onPointerDown, true)");
    expect(source).toContain('surface.contains(target)');
    // Escape is THIS dialog's layer: closed, default prevented and the event
    // stopped before the Studio's bubble-phase dispatcher can see it.
    expect(source).toContain("window.addEventListener('keydown', onEscapeKeyDown, true)");
    expect(source).toContain('event.stopImmediatePropagation()');
    expect(source).toContain("window.removeEventListener('pointerdown', onPointerDown, true)");
    expect(source).toContain("window.removeEventListener('keydown', onEscapeKeyDown, true)");
    // The Tools popover must treat the whole picker as an exempt surface.
    expect(source).toContain('data-toolbox-dismiss-exempt');
    // Presentation contract: fixed root, interactive surface, non-modal dialog.
    expect(source).toContain('class="physics-paint-script-picker-dialog"');
    expect(source).toContain('class="physics-paint-script-picker-surface"');
    expect(source).toContain('aria-modal="false"');
  });
});
