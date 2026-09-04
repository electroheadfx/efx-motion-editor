import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { VNode } from 'preact';
import {
  PhysicsPaintScriptPickerDialog,
  SCRIPT_PICKER_EMPTY_LINE_1,
  SCRIPT_PICKER_EMPTY_LINE_2,
  type PhysicsPaintScriptPickerDialogProps,
  type PhysicsPaintScriptPickerIntent,
} from './PhysicsPaintScriptPickerDialog';
import type { RotoScriptLibraryRow } from '../roto/physicsPaintRotoScriptSchema';

/**
 * AM-3 (52 UAT) contract tests for the Create Rail script picker. The dialog is
 * a pure view (no controller hook) using refs/effect for drag/focus, so
 * preact/hooks is mocked with a cursor-based runtime (the
 * PhysicsPaintPhotoReferenceDialog.test.ts pattern) and the dialog is invoked
 * as a plain function and walked as a vnode tree.
 */

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

beforeEach(() => {
  hooks.reset();
});

type AnyVNode = VNode<Record<string, any>>;

function makeRow(id: string, name: string, brushCount: number): RotoScriptLibraryRow {
  return {
    id,
    revision: `rev-${id}`,
    integritySha256: `sha-${id}`,
    name,
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
    source: {
      projectName: 'Project',
      layerId: 'layer-1',
      layerName: 'Layer 1',
      sourceFrame: 0,
      displayFrame: 1,
      width: 10,
      height: 10,
      background: { background: 'transparent', paperGrain: 'none', grainStrength: 0 },
    },
    thumbnail: { mimeType: 'image/webp', width: 96, height: 64, quality: 80, dataUrl: `data:image/webp;base64,${id}` },
    brushCount,
  };
}

function childrenOf(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
  if (typeof vnode.type === 'function') {
    const rendered = (vnode.type as (props: Record<string, any>) => unknown)(vnode.props);
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
    walk((current as AnyVNode).props?.children);
  };
  walk(node);
  return parts.join(' ');
}

function hasClass(node: unknown, className: string): boolean {
  const vnode = node as AnyVNode;
  return typeof vnode.type !== 'function' && String(vnode.props?.class ?? '').split(/\s+/).includes(className);
}

function findByLabel(tree: AnyVNode, label: string): AnyVNode {
  const match = childrenOf(tree).find((node) => {
    const vnode = node as AnyVNode;
    return typeof vnode.type !== 'function' && vnode.props?.['aria-label'] === label;
  }) as AnyVNode | undefined;
  expect(match, `Missing element with aria-label ${label}`).toBeDefined();
  return match!;
}

function fireClick(node: AnyVNode): void {
  const onClick = (node.props as unknown as { onClick?: () => void }).onClick;
  expect(onClick, 'Missing onClick handler').toBeDefined();
  onClick?.();
}

function renderDialog(props: Partial<PhysicsPaintScriptPickerDialogProps> = {}): AnyVNode {
  return PhysicsPaintScriptPickerDialog({
    open: true,
    intent: { kind: 'paint', mode: 'progressive' },
    rows: [makeRow('a', 'Walk Cycle', 4), makeRow('b', 'Jump', 1)],
    onPick: () => {},
    onClose: () => {},
    ...props,
  }) as AnyVNode;
}

describe('PhysicsPaintScriptPickerDialog (AM-3)', () => {
  it('renders nothing when closed', () => {
    expect(renderDialog({ open: false })).toBeNull();
  });

  it.each([
    [{ kind: 'paint', mode: 'progressive' } as const, 'Create Motion Rail'],
    [{ kind: 'paint', mode: 'static' } as const, 'Create Static Rail'],
    [{ kind: 'reveal' } as const, 'Create Reveal Photo Rail'],
  ])('titles the dialog after the menu-chosen rail kind (%s → %s)', (intent: PhysicsPaintScriptPickerIntent, title: string) => {
    const tree = renderDialog({ intent });
    const dialog = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function' && vnode.props?.['role'] === 'dialog';
    }) as AnyVNode | undefined;
    expect(dialog, 'Missing role=dialog').toBeDefined();
    expect(textContent(dialog)).toContain(title);
  });

  it('lists the library Actions with thumbnail, name, and natural duration (the Scripts panel row data)', () => {
    const tree = renderDialog();
    const rows = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-script-row'));
    expect(rows).toHaveLength(2);
    const first = rows[0] as AnyVNode;
    expect(first.props['aria-label']).toBe('Use Walk Cycle');
    expect(textContent(first)).toContain('Walk Cycle');
    const counts = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-script-count'));
    expect(counts).toHaveLength(2);
    expect(textContent(counts[0]).replace(/\s+/g, ' ').trim()).toBe('4 frames');
    expect(textContent(counts[1]).replace(/\s+/g, ' ').trim()).toBe('1 frame');
    const thumbnails = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-script-thumbnail'));
    expect(thumbnails).toHaveLength(2);
    expect((thumbnails[0] as AnyVNode).props.src).toBe('data:image/webp;base64,a');
  });

  it('routes a row pick to onPick with the Action id', () => {
    const onPick = vi.fn();
    const tree = renderDialog({ onPick });
    fireClick(findByLabel(tree, 'Use Jump'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('b');
  });

  it('routes the header X, the Cancel button, and Escape to onClose (closes ONLY the picker)', () => {
    const onClose = vi.fn();
    const tree = renderDialog({ onClose });
    fireClick(findByLabel(tree, 'Close Action picker'));
    expect(onClose).toHaveBeenCalledTimes(1);

    const cancel = childrenOf(tree).find((node) => hasClass(node, 'physics-paint-script-picker-cancel')) as AnyVNode | undefined;
    expect(cancel, 'Missing Cancel button').toBeDefined();
    fireClick(cancel!);
    expect(onClose).toHaveBeenCalledTimes(2);

    const dialog = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function' && vnode.props?.['role'] === 'dialog';
    }) as AnyVNode;
    const onKeyDown = dialog.props.onKeyDown as (event: { key: string; preventDefault: () => void; stopPropagation: () => void }) => void;
    expect(onKeyDown).toBeDefined();
    onKeyDown({ key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('shows an explanatory empty state on an empty library — never a dead dialog', () => {
    const tree = renderDialog({ rows: [] });
    expect(textContent(tree)).toContain(SCRIPT_PICKER_EMPTY_LINE_1);
    expect(textContent(tree)).toContain(SCRIPT_PICKER_EMPTY_LINE_2);
    expect(childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-script-row'))).toHaveLength(0);
    // The dialog still opens (role=dialog present) and stays closable.
    expect(findByLabel(tree, 'Close Action picker')).toBeDefined();
  });

  it('follows the floating-dialog convention: no backdrop, a movable grab header, and a focusable surface', () => {
    const tree = renderDialog();
    // The root wrapper is the pointer-events-none shell (the CSS pins it); only
    // the surface is interactive — no backdrop element exists in the tree.
    const backdrops = childrenOf(tree).filter((node) => hasClass(node, 'physics-paint-script-picker-backdrop'));
    expect(backdrops).toHaveLength(0);
    const header = childrenOf(tree).find((node) => hasClass(node, 'physics-paint-script-picker-header')) as AnyVNode | undefined;
    expect(header, 'Missing draggable header').toBeDefined();
    expect(header!.props.onPointerDown).toBeDefined();
    const surface = childrenOf(tree).find((node) => hasClass(node, 'physics-paint-script-picker-surface')) as AnyVNode | undefined;
    expect(surface, 'Missing surface').toBeDefined();
    expect(surface!.props.tabIndex).toBe(-1);
  });
});
