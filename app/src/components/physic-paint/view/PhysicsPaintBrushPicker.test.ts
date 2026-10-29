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
    useLayoutEffect: () => {},
    useState: (initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      () => {},
    ],
  };
});

import { PhysicsPaintBrushMenu } from './PhysicsPaintBrushMenu';
import { PhysicsPaintBrushModal, resetBrushModalLayout } from './PhysicsPaintBrushModal';
import {
  SHEET_ID_BRUSHES,
  bringSheetToFront,
  resetFloatingSheetStack,
  sheetZIndex,
} from './floatingSheetStack';
import { WatercolorBrushLibrary } from './WatercolorBrushLibrary';
import {
  aquarelleActiveTool,
  aquarelleBrushMenuAnchor,
  aquarelleBrushMenuOpen,
  aquarelleBrushMenuTarget,
  aquarelleBrushModalOpen,
  aquarelleLiftTipId,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
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
  aquarelleActiveTool.value = 'brush';
  aquarelleBrushMenuTarget.value = 'brush';
  aquarelleLiftTipId.value = 'filbert';
  aquarelleBrushMenuOpen.value = false;
  aquarelleBrushMenuAnchor.value = { left: 20, top: 70 };
  aquarelleBrushModalOpen.value = false;
  resetBrushModalLayout();
  // The stack order is module-global: a raise in one case would leak.
  resetFloatingSheetStack();
});

afterEach(() => {
  aquarelleSelectedTipId.value = 'chalk';
  aquarelleActiveTool.value = 'brush';
  aquarelleBrushMenuTarget.value = 'brush';
  aquarelleLiftTipId.value = 'filbert';
  aquarelleBrushMenuOpen.value = false;
  aquarelleBrushMenuAnchor.value = null;
  aquarelleBrushModalOpen.value = false;
  resetBrushModalLayout();
  resetFloatingSheetStack();
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
    // 261029-hy2: the brush target keeps the catalog's name.
    expect(String(tree.props?.['aria-label'])).toBe('Brushes');
  });

  // 261029-hy2: the same popover serves the Eraser tool. Its branch lists the
  // 15 painted shapes, has NO "Open modal" entry (the catalog's cards pick
  // brushes through selectAquarelleTip, which would flip the tool to Brush),
  // and a pick writes ONLY the lift tip.
  it('lift mode lists the 15 shapes with no Open modal action', () => {
    aquarelleActiveTool.value = 'lift';
    setAquarelleBrushMenuOpen(true, undefined, 'lift');
    const tree = PhysicsPaintBrushMenu() as TestVNode;
    const ids = buttonTestIds(collect(tree));
    expect(ids).not.toContain('watercolor-brush-menu-open-modal');
    for (const preset of BRUSH_PRESETS) {
      expect(ids).toContain(`watercolor-brush-menu-item-${preset.id}`);
    }
    expect(ids.filter((id) => id.startsWith('watercolor-brush-menu-item-')).length).toBe(BRUSH_PRESETS.length);
    expect(aquarelleBrushMenuTarget.value).toBe('lift');
    expect(String(tree.props?.['aria-label'])).toBe('Eraser shapes');
  });

  it('a lift pick writes only the lift tip — tool, brush selection and multipliers untouched', () => {
    aquarelleActiveTool.value = 'lift';
    aquarelleSelectedTipId.value = 'chalk';
    aquarelleLiftTipId.value = 'filbert';
    const overridesBefore = aquarelleToolOverrides.value;
    setAquarelleBrushMenuOpen(true, undefined, 'lift');
    const nodes = collect(PhysicsPaintBrushMenu());
    const flat = nodes.find((node) => node.props?.['data-testid'] === 'watercolor-brush-menu-item-flat')!;
    click(flat);
    expect(aquarelleLiftTipId.value).toBe('flat');
    expect(aquarelleSelectedTipId.value, 'the brush selection is untouched').toBe('chalk');
    expect(aquarelleActiveTool.value, 'an eraser pick never flips the tool').toBe('lift');
    expect(aquarelleToolOverrides.value, 'the brush multiplier bag is untouched').toBe(overridesBefore);
    expect(aquarelleBrushMenuOpen.value).toBe(false);
  });

  it('the lift branch never reaches the tool-flipping brush picker (region pin)', () => {
    const start = MENU_SOURCE.indexOf('aquarelleBrushMenuTarget.value');
    const end = MENU_SOURCE.indexOf('// 261029-hy2 menu-branch:brush');
    expect(start, 'the menu reads the target once').toBeGreaterThan(-1);
    expect(end, 'the brush branch marker exists').toBeGreaterThan(-1);
    expect(end, 'the brush branch follows the target read').toBeGreaterThan(start);
    const liftRegion = MENU_SOURCE.slice(start, end);
    expect(liftRegion, 'the lift region writes the lift tip').toContain('setAquarelleLiftTipId');
    expect(liftRegion, 'a lift pick never routes through the brush picker').not.toContain('selectAquarelleTip');
    expect(liftRegion, 'a lift pick never flips the tool directly').not.toContain('setAquarelleTool');
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

  it('is viewport-fixed and fills the height below the trigger', () => {
    const rule = CSS_SOURCE.slice(
      CSS_SOURCE.indexOf('.physics-paint-brush-menu {'),
      CSS_SOURCE.indexOf('}', CSS_SOURCE.indexOf('.physics-paint-brush-menu {')),
    );
    expect(rule).toContain('position: fixed');
    // 261027-gh9h/gh9i: the menu is sized from the trigger to the viewport
    // edge, but shrinks to the catalog's own height when every row fits. A
    // definite height (not maxHeight) is still the law: SidebarScrollArea's
    // inner scroller is absolutely positioned, so a content-sized flex parent
    // would collapse it to zero and the brush list would vanish.
    expect(MENU_SOURCE).toContain('const availableHeight = Math.max(240, viewportHeight - anchor.top - 8);');
    expect(MENU_SOURCE).toContain('const menuHeight = naturalHeight === null');
    expect(MENU_SOURCE).toContain('Math.min(availableHeight, naturalHeight)');
    expect(MENU_SOURCE).toContain('height: `${menuHeight}px`');
    expect(MENU_SOURCE).toContain('DEFINITE height is required');
    // Measurement, not hard-coded row math: chrome + the list's own height.
    expect(MENU_SOURCE).toContain('const chrome = menu.offsetHeight - scroller.clientHeight;');
    expect(MENU_SOURCE).toContain('const measured = Math.ceil(chrome + list.offsetHeight);');
  });

  it('uses the app scrollbar and gives the thumb the row width', () => {
    // The OS scrollbar is never used in the Studio — same SidebarScrollArea
    // thumb as the sidebar.
    expect(MENU_SOURCE).toContain('<SidebarScrollArea');
    expect(MENU_SOURCE).not.toContain('overflow-y: auto');
    const thumbRule = CSS_SOURCE.slice(
      CSS_SOURCE.indexOf('.physics-paint-brush-menu-thumb {'),
      CSS_SOURCE.indexOf('}', CSS_SOURCE.indexOf('.physics-paint-brush-menu-thumb {')),
    );
    expect(thumbRule).toContain('flex: 1 1 auto');
    expect(thumbRule).toContain('height: 34px');
    const listRule = CSS_SOURCE.slice(
      CSS_SOURCE.indexOf('.physics-paint-brush-menu-list {'),
      CSS_SOURCE.indexOf('}', CSS_SOURCE.indexOf('.physics-paint-brush-menu-list {')),
    );
    expect(listRule).not.toContain('overflow-y');
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

  it('the close button stops its press before the drag header, then closes (261029-hy2)', () => {
    setAquarelleBrushModalOpen(true);
    const nodes = collect(PhysicsPaintBrushModal());
    const closeButton = nodes.find(
      (node) => node.props?.['data-testid'] === 'watercolor-brush-modal-close',
    )!;
    const stopPropagation = vi.fn();
    const onPointerDown = closeButton.props?.onPointerDown as
      | ((event: unknown) => void)
      | undefined;
    expect(onPointerDown, 'the close button carries a pointerdown guard').toBeTypeOf('function');
    onPointerDown!({ stopPropagation });
    expect(stopPropagation, 'the press never reaches the drag header').toHaveBeenCalledTimes(1);
    expect(aquarelleBrushModalOpen.value, 'a press alone never closes').toBe(true);
    click(closeButton);
    expect(aquarelleBrushModalOpen.value).toBe(false);

    // The drag contract is unchanged: the header still captures the pointer
    // and calls preventDefault on its pressed path.
    const header = nodes.find(
      (node) => node.props?.['data-testid'] === 'watercolor-brush-modal-header',
    )!;
    const preventDefault = vi.fn();
    (header.props?.onPointerDown as (event: unknown) => void)({
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      preventDefault,
      currentTarget: { setPointerCapture: vi.fn() },
    });
    expect(preventDefault, 'header drag capture stays intact').toHaveBeenCalledTimes(1);
  });

  it('takes its z-index from the shared sheet stack and rises one level (261029-hy2)', () => {
    setAquarelleBrushModalOpen(true);
    const before = PhysicsPaintBrushModal() as TestVNode;
    const beforeStyle = before.props?.style as Record<string, unknown>;
    expect(beforeStyle?.zIndex).toBe(sheetZIndex(SHEET_ID_BRUSHES));
    expect(beforeStyle?.zIndex).toBe(51);
    expect(
      before.props?.onPointerDownCapture,
      'the root raises itself on capture-phase pointerdown',
    ).toBeTypeOf('function');
    bringSheetToFront(SHEET_ID_BRUSHES);
    const after = PhysicsPaintBrushModal() as TestVNode;
    expect((after.props?.style as Record<string, unknown>)?.zIndex).toBe(52);
  });
});
