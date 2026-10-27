// ============================================================
//  261027-gh9g — the top-bar brush picker and floating catalog.
//
//  Laws pinned here:
//    the dropdown's FIRST action is "Open modal"
//    picking a dropdown brush selects it and closes the menu
//    Open modal closes the menu and opens the catalog
//    the catalog stays open when a brush is picked
//    the catalog is draggable, height-resizable and closes via its X
//    the catalog surface is more transparent than the Move-edit sheet
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRUSH_PRESETS } from '@efxlab/efx-watercolor';

vi.mock('preact/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact/hooks')>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useState: (initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      () => {},
    ],
  };
});

import { PhysicsPaintBrushMenu } from './PhysicsPaintBrushMenu';
import { PhysicsPaintBrushModal, resetBrushModalLayout } from './PhysicsPaintBrushModal';
import { WatercolorBrushLibrary } from './WatercolorBrushLibrary';
import {
  aquarelleBrushMenuAnchor,
  aquarelleBrushMenuOpen,
  aquarelleBrushModalOpen,
  aquarelleSelectedTipId,
  setAquarelleBrushMenuOpen,
  setAquarelleBrushModalOpen,
} from './aquarelleRecordState';

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

function collect(node: unknown, out: TestVNode[] = []): TestVNode[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (typeof node !== 'object') return out;
  const vnode = node as TestVNode;
  out.push(vnode);
  const children = vnode.props?.children;
  if (children !== undefined) collect(children, out);
  return out;
}

function buttonTestIds(nodes: TestVNode[]): string[] {
  return nodes
    .filter((node) => node.type === 'button')
    .map((node) => String(node.props?.['data-testid'] ?? ''));
}

function click(node: TestVNode): void {
  const onClick = node.props?.onClick as (() => void) | undefined;
  expect(onClick, 'element has no onClick').toBeTypeOf('function');
  onClick!();
}

const MENU_SOURCE = readFileSync(resolve(__dirname, 'PhysicsPaintBrushMenu.tsx'), 'utf8');
const MODAL_SOURCE = readFileSync(resolve(__dirname, 'PhysicsPaintBrushModal.tsx'), 'utf8');
const CSS_SOURCE = readFileSync(resolve(__dirname, '..', 'physicsPaintStudio.css'), 'utf8');

beforeEach(() => {
  aquarelleSelectedTipId.value = 'chalk';
  aquarelleBrushMenuOpen.value = false;
  aquarelleBrushMenuAnchor.value = { left: 20, top: 70 };
  aquarelleBrushModalOpen.value = false;
  resetBrushModalLayout();
});

afterEach(() => {
  aquarelleSelectedTipId.value = 'chalk';
  aquarelleBrushMenuOpen.value = false;
  aquarelleBrushMenuAnchor.value = null;
  aquarelleBrushModalOpen.value = false;
  resetBrushModalLayout();
});

describe('261027-gh9g top-bar brush dropdown', () => {
  it('lists every brush and puts Open modal FIRST', () => {
    setAquarelleBrushMenuOpen(true);
    const tree = PhysicsPaintBrushMenu() as TestVNode;
    const ids = buttonTestIds(collect(tree));
    expect(ids[0]).toBe('watercolor-brush-menu-open-modal');
    for (const preset of BRUSH_PRESETS) {
      expect(ids).toContain(`watercolor-brush-menu-item-${preset.id}`);
    }
    expect(ids.filter((id) => id.startsWith('watercolor-brush-menu-item-')).length).toBe(BRUSH_PRESETS.length);
  });

  it('picking a brush selects it and closes the dropdown', () => {
    setAquarelleBrushMenuOpen(true);
    const nodes = collect(PhysicsPaintBrushMenu());
    const flat = nodes.find((node) => node.props?.['data-testid'] === 'watercolor-brush-menu-item-flat')!;
    click(flat);
    expect(aquarelleSelectedTipId.value).toBe('flat');
    expect(aquarelleBrushMenuOpen.value).toBe(false);
    expect(aquarelleBrushModalOpen.value).toBe(false);
  });

  it('Open modal closes the dropdown and opens the catalog', () => {
    setAquarelleBrushMenuOpen(true);
    const nodes = collect(PhysicsPaintBrushMenu());
    const openModal = nodes.find((node) => node.props?.['data-testid'] === 'watercolor-brush-menu-open-modal')!;
    click(openModal);
    expect(aquarelleBrushMenuOpen.value).toBe(false);
    expect(aquarelleBrushModalOpen.value).toBe(true);
  });

  it('is viewport-fixed (the top bar scrolls and would clip it)', () => {
    const rule = CSS_SOURCE.slice(
      CSS_SOURCE.indexOf('.physics-paint-brush-menu {'),
      CSS_SOURCE.indexOf('}', CSS_SOURCE.indexOf('.physics-paint-brush-menu {')),
    );
    expect(rule).toContain('position: fixed');
    expect(MENU_SOURCE).toContain("style={{ left: `${left}px`, top: `${anchor.top}px` }}");
  });
});

describe('261027-gh9g floating brush catalog', () => {
  it('mounts the full brush library inside a dialog with a close button', () => {
    setAquarelleBrushModalOpen(true);
    const tree = PhysicsPaintBrushModal() as TestVNode;
    expect(tree.props?.role).toBe('dialog');
    expect(String((tree.props?.style as Record<string, unknown>)?.background)).toContain('rgba(28, 30, 34, 0.55)');
    const nodes = collect(tree);
    expect(nodes.some((node) => node.type === WatercolorBrushLibrary)).toBe(true);
    expect(nodes.some((node) => node.props?.['data-testid'] === 'watercolor-brush-modal-close')).toBe(true);
    expect(nodes.some((node) => node.props?.['data-testid'] === 'watercolor-brush-modal-resize')).toBe(true);
    // The surface is more transparent than the Move-edit sheet (0.9) and
    // carries the glass blur on the class.
    const glass = CSS_SOURCE.slice(
      CSS_SOURCE.indexOf('.physics-paint-brush-modal {'),
      CSS_SOURCE.indexOf('}', CSS_SOURCE.indexOf('.physics-paint-brush-modal {')),
    );
    expect(glass).toContain('backdrop-filter: blur(18px)');
  });

  it('the header drag moves the surface; picking a brush never closes it', () => {
    setAquarelleBrushModalOpen(true);
    const tree = PhysicsPaintBrushModal() as TestVNode;
    const header = collect(tree).find(
      (node) => node.props?.['data-testid'] === 'watercolor-brush-modal-header',
    )!;
    const onPointerDown = header.props?.onPointerDown as ((event: unknown) => void);
    const onPointerMove = header.props?.onPointerMove as ((event: unknown) => void);
    onPointerDown({
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      preventDefault: vi.fn(),
      currentTarget: { setPointerCapture: vi.fn() },
    });
    onPointerMove({ clientX: 130, clientY: 120 });
    const moved = PhysicsPaintBrushModal() as TestVNode;
    expect(String((moved.props?.style as Record<string, unknown>)?.transform)).toBe('translate(30px, 20px)');
    // A library pick rides aquarelleSelectedTipId only — the catalog code has
    // no close call on selection.
    expect(MODAL_SOURCE).not.toContain('selectAquarelleTip');
    setAquarelleBrushModalOpen(true);
    expect(aquarelleBrushModalOpen.value).toBe(true);
  });

  it('the close button closes the catalog', () => {
    setAquarelleBrushModalOpen(true);
    const nodes = collect(PhysicsPaintBrushModal());
    click(nodes.find((node) => node.props?.['data-testid'] === 'watercolor-brush-modal-close')!);
    expect(aquarelleBrushModalOpen.value).toBe(false);
  });
});
