// ============================================================
//  quick 261116-gcn — the Textures popover.
//
//  Laws pinned here:
//    "Open modal" is the FIRST action, the compact strip follows
//    a chip pick writes ONLY aquarelleSelectedTextureId
//    a chip pick KEEPS the popover open; the response is untouched
//    Open modal closes the popover, raises Textures and opens the sheet
//    the surface is viewport-fixed and viewport-clamped
//    the compact 34px geometry moved here with the strip
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { PhysicsPaintTextureMenu } from './PhysicsPaintTextureMenu';
import { WatercolorTextureStrip } from './WatercolorTextureStrip';
import {
  SHEET_ID_BRUSHES,
  SHEET_ID_TEXTURES,
  bringSheetToFront,
  isFrontSheet,
  resetFloatingSheetStack,
} from './floatingSheetStack';
import {
  aquarelleSelectedTextureId,
  aquarelleSelectedTipId,
  aquarelleTextureMenuAnchor,
  aquarelleTextureMenuOpen,
  aquarelleTextureModalOpen,
  setAquarelleTextureMenuOpen,
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

/**
 * Materialize the vnode tree so the strip's inner testids and click handlers
 * become reachable — `collect()` alone never invokes function components.
 */
function materialize(node: unknown): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map(materialize);
  if (typeof node !== 'object') return node;
  const vnode = node as TestVNode;
  if (typeof vnode.type === 'function') {
    try {
      return materialize((vnode.type as (props: Record<string, unknown>) => unknown)(vnode.props));
    } catch {
      return vnode;
    }
  }
  const children = vnode.props?.children;
  const list = children === undefined ? [] : Array.isArray(children) ? children : [children];
  return {
    ...vnode,
    props: { ...vnode.props, children: list.map(materialize) },
  } as TestVNode;
}

const MENU_SOURCE = readFileSync(resolve(__dirname, 'PhysicsPaintTextureMenu.tsx'), 'utf8');
const CSS_SOURCE = readFileSync(resolve(__dirname, '..', 'physicsPaintStudio.css'), 'utf8');

function cssBlock(selector: string): string {
  const start = CSS_SOURCE.indexOf(selector);
  expect(start, `${selector} rule must exist`).toBeGreaterThan(-1);
  const end = CSS_SOURCE.indexOf('}', start);
  return end === -1 ? '' : CSS_SOURCE.slice(start, end + 1);
}

function openMenu(): void {
  setAquarelleTextureMenuOpen(true, { left: 20, top: 70 });
}

beforeEach(() => {
  aquarelleSelectedTipId.value = 'chalk';
  aquarelleSelectedTextureId.value = null;
  aquarelleTextureMenuOpen.value = false;
  aquarelleTextureMenuAnchor.value = null;
  aquarelleTextureModalOpen.value = false;
  // The stack order is module-global: a raise in one case would leak.
  resetFloatingSheetStack();
});

afterEach(() => {
  aquarelleSelectedTipId.value = 'chalk';
  aquarelleSelectedTextureId.value = null;
  aquarelleTextureMenuOpen.value = false;
  aquarelleTextureMenuAnchor.value = null;
  aquarelleTextureModalOpen.value = false;
  resetFloatingSheetStack();
});

describe('quick 261116-gcn Textures popover', () => {
  it('puts Open modal FIRST and the compact strip after the separator', () => {
    openMenu();
    const tree = PhysicsPaintTextureMenu() as TestVNode;
    const ids = buttonTestIds(collect(tree));
    expect(ids[0]).toBe('physics-texture-menu-open-modal');
    // The strip is a SIBLING, mounted below the separator (never inside the
    // open-modal action).
    const children = (tree.props?.children as unknown[]) ?? [];
    const separatorIndex = children.findIndex(
      (child) => (child as TestVNode).props?.class === 'physics-paint-brush-menu-separator',
    );
    const stripIndex = children.findIndex(
      (child) => (child as TestVNode).props?.class === 'physics-paint-texture-menu-strip',
    );
    expect(separatorIndex, 'the separator renders').toBeGreaterThan(-1);
    expect(stripIndex, 'the strip wrapper follows the separator').toBeGreaterThan(separatorIndex);
    expect(collect(tree).some((node) => node.type === WatercolorTextureStrip)).toBe(true);
    // The compact variant is the one mounted here.
    const strip = collect(tree).find((node) => node.type === WatercolorTextureStrip)!;
    expect(strip.props?.compact).toBe(true);
    expect(String(tree.props?.['aria-label'])).toBe('Textures');
  });

  it('a chip pick writes only the texture and keeps the popover open', () => {
    openMenu();
    const tree = materialize(PhysicsPaintTextureMenu());
    const chip = collect(tree).find(
      (node) => node.props?.['data-testid'] === 'watercolor-texture-chip-wc/builtin-chalk',
    )!;
    expect(chip, 'a built-in texture chip renders').toBeTruthy();
    click(chip);
    expect(aquarelleSelectedTextureId.value, 'texture selected').toBe('wc/builtin-chalk');
    expect(aquarelleSelectedTipId.value, 'the response is untouched').toBe('chalk');
    expect(aquarelleTextureMenuOpen.value, 'a texture pick keeps the popover open').toBe(true);
  });

  it('Open modal closes the popover, raises Textures and opens the sheet', () => {
    // Start with another sheet front so the raise is observable.
    bringSheetToFront(SHEET_ID_BRUSHES);
    expect(isFrontSheet(SHEET_ID_TEXTURES)).toBe(false);
    openMenu();
    const nodes = collect(PhysicsPaintTextureMenu());
    click(nodes.find((node) => node.props?.['data-testid'] === 'physics-texture-menu-open-modal')!);
    expect(aquarelleTextureMenuOpen.value).toBe(false);
    expect(aquarelleTextureModalOpen.value).toBe(true);
    expect(isFrontSheet(SHEET_ID_TEXTURES)).toBe(true);
  });

  it('renders null while closed', () => {
    expect(PhysicsPaintTextureMenu()).toBeNull();
  });

  it('pins the viewport-fixed clamp and the event-handler-only close paths', () => {
    const rule = cssBlock('.physics-paint-texture-menu {');
    expect(rule).toContain('position: fixed');
    expect(rule).toContain('z-index: 80');
    expect(rule).toContain('width: 212px');
    expect(rule, 'a wrapped strip scrolls instead of clipping').toContain('overflow-y: auto');
    expect(MENU_SOURCE).toContain(
      'const left = Math.max(8, Math.min(anchor.left, viewportWidth - 220));',
    );
    expect(MENU_SOURCE).toContain(
      'const maxHeight = Math.max(120, viewportHeight - anchor.top - 8);',
    );
    // The toggle guard: a press on the trigger must not race the close.
    expect(MENU_SOURCE).toContain("target.closest('[data-watercolor-texture-trigger]')");
    // Capture-phase listeners and identity-stable deps.
    expect(MENU_SOURCE).toContain("window.addEventListener('pointerdown', onPointerDown, true);");
    expect(MENU_SOURCE).toContain("window.addEventListener('keydown', onKeyDown, true);");
    expect(MENU_SOURCE).toContain("if (event.key !== 'Escape') return;");
    expect(MENU_SOURCE).toContain('event.preventDefault();');
    expect(MENU_SOURCE).toContain('event.stopPropagation();');
    expect(MENU_SOURCE).toContain('}, [open]);');
    // Raise BEFORE opening, in the event handler.
    expect(MENU_SOURCE).toContain('bringSheetToFront(SHEET_ID_TEXTURES);');
    expect(MENU_SOURCE.indexOf('bringSheetToFront(SHEET_ID_TEXTURES);')).toBeLessThan(
      MENU_SOURCE.indexOf('setAquarelleTextureModalOpen(true);'),
    );
    expect(MENU_SOURCE).not.toContain('useState');
    // The strip subscribes itself; the popover never reads the catalog.
    expect(MENU_SOURCE).not.toContain('brushCatalogGeneration');
  });

  it('pins the moved compact chip geometry against the new selectors', () => {
    const stripRule = cssBlock('.physics-paint-texture-menu-strip {');
    expect(stripRule, 'the strip seat keeps the 6px top gap').toContain('padding: 6px 2px 0');
    const chipRule = cssBlock('.physics-paint-texture-menu .watercolor-texture-chip-canvas {');
    expect(chipRule, 'compact chips are 34px').toContain('width: 34px');
    expect(chipRule).toContain('height: 34px');
    // The library's full-size base rule is untouched. The bare selector is a
    // substring of both scoped overrides, so resolve the LAST declaration —
    // the base rule is written after every scoped 34px override.
    const baseAt = CSS_SOURCE.lastIndexOf('.watercolor-texture-chip-canvas {');
    expect(baseAt, 'the base chip rule exists').toBeGreaterThan(-1);
    const baseRule = CSS_SOURCE.slice(baseAt, CSS_SOURCE.indexOf('}', baseAt) + 1);
    expect(baseRule, 'compact is an override, never the library base').toContain('width: 44px');
  });
});
