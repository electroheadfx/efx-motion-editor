// ============================================================
//  261029-hy2 — the floating Settings sheet.
//
//  Laws pinned here:
//    closed -> nothing renders
//    open -> a dialog labelled "Settings" whose body mounts the
//            retired Settings tab body (RightPanelSettingsTab)
//    the close button closes it, and its pointerdown stops the
//    propagation the drag header would otherwise consume
//    the header drag moves the surface and never closes it
//    the layout is session-scoped: close/reopen keeps the drag
//    Escape closes it (capture-phase keydown, removed the same way)
//
//  No DOM environment: same vnode-walk idiom as
//  PhysicsPaintBrushPicker.test.ts.
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

import { PhysicsPaintSettingsModal, resetSettingsModalLayout } from './PhysicsPaintSettingsModal';
import { RightPanelSettingsTab } from './RightPanelSettingsTab';
import {
  SHEET_ID_BRUSHES,
  SHEET_ID_SETTINGS,
  bringSheetToFront,
  closeSheetIfFront,
  resetFloatingSheetStack,
  sheetZIndex,
} from './floatingSheetStack';
import {
  aquarelleBrushModalOpen,
  aquarelleSettingsModalOpen,
  setAquarelleBrushModalOpen,
  setAquarelleSettingsModalOpen,
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

function click(node: TestVNode): void {
  const onClick = node.props?.onClick as (() => void) | undefined;
  expect(onClick, 'element has no onClick').toBeTypeOf('function');
  onClick!();
}

const SHEET_SOURCE = readFileSync(resolve(__dirname, 'PhysicsPaintSettingsModal.tsx'), 'utf8');

beforeEach(() => {
  aquarelleSettingsModalOpen.value = false;
  aquarelleBrushModalOpen.value = false;
  resetSettingsModalLayout();
  // The stack order is module-global: the z-index math only holds from the
  // initial bottom-to-top order.
  resetFloatingSheetStack();
});

afterEach(() => {
  aquarelleSettingsModalOpen.value = false;
  aquarelleBrushModalOpen.value = false;
  resetSettingsModalLayout();
  resetFloatingSheetStack();
});

describe('261029-hy2 floating Settings sheet', () => {
  it('renders nothing while closed', () => {
    expect(PhysicsPaintSettingsModal()).toBeNull();
  });

  it('opens as a Settings dialog whose body mounts the retired Settings tab', () => {
    setAquarelleSettingsModalOpen(true);
    const tree = PhysicsPaintSettingsModal() as TestVNode;
    expect(tree.props?.role).toBe('dialog');
    expect(String(tree.props?.['aria-label'])).toBe('Settings');
    expect(tree.props?.['data-testid']).toBe('physics-settings-modal');
    const nodes = collect(tree);
    expect(
      nodes.some((node) => node.type === RightPanelSettingsTab),
      'the sheet body is the retired Settings tab',
    ).toBe(true);
    expect(
      nodes.some((node) => node.props?.['data-testid'] === 'physics-settings-modal-close'),
      'the sheet carries a close button',
    ).toBe(true);
    expect(
      nodes.some((node) => node.props?.['data-testid'] === 'physics-settings-modal-resize'),
      'the sheet carries a bottom resize handle',
    ).toBe(true);
    // This is a settings panel, not the transparent brush catalog.
    expect(
      String((tree.props?.style as Record<string, unknown>)?.background),
    ).toContain('rgba(28, 30, 34, 0.9)');
  });

  it('the close button closes the sheet and its pointerdown never starts a header drag', () => {
    setAquarelleSettingsModalOpen(true);
    const closeButton = collect(PhysicsPaintSettingsModal()).find(
      (node) => node.props?.['data-testid'] === 'physics-settings-modal-close',
    )!;
    const stopPropagation = vi.fn();
    const onPointerDown = closeButton.props?.onPointerDown as ((event: unknown) => void) | undefined;
    expect(onPointerDown, 'the close button carries a pointerdown guard').toBeTypeOf('function');
    onPointerDown!({ stopPropagation });
    expect(stopPropagation, 'the press never reaches the drag header').toHaveBeenCalledTimes(1);
    click(closeButton);
    expect(aquarelleSettingsModalOpen.value).toBe(false);
  });

  it('the header drag moves the surface and never closes the sheet', () => {
    setAquarelleSettingsModalOpen(true);
    const header = collect(PhysicsPaintSettingsModal()).find(
      (node) => node.props?.['data-testid'] === 'physics-settings-modal-header',
    )!;
    const onPointerDown = header.props?.onPointerDown as (event: unknown) => void;
    const onPointerMove = header.props?.onPointerMove as (event: unknown) => void;
    onPointerDown({
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      preventDefault: vi.fn(),
      currentTarget: { setPointerCapture: vi.fn() },
    });
    onPointerMove({ clientX: 130, clientY: 120 });
    const moved = PhysicsPaintSettingsModal() as TestVNode;
    expect(
      String((moved.props?.style as Record<string, unknown>)?.transform),
    ).toBe('translate(30px, 20px)');
    expect(aquarelleSettingsModalOpen.value, 'a drag never closes the sheet').toBe(true);
  });

  it('the layout is session-scoped: close then reopen keeps the drag', () => {
    setAquarelleSettingsModalOpen(true);
    const header = collect(PhysicsPaintSettingsModal()).find(
      (node) => node.props?.['data-testid'] === 'physics-settings-modal-header',
    )!;
    (header.props?.onPointerDown as (event: unknown) => void)({
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      preventDefault: vi.fn(),
      currentTarget: { setPointerCapture: vi.fn() },
    });
    (header.props?.onPointerMove as (event: unknown) => void)({ clientX: 130, clientY: 120 });

    const closeButton = collect(PhysicsPaintSettingsModal()).find(
      (node) => node.props?.['data-testid'] === 'physics-settings-modal-close',
    )!;
    click(closeButton);
    expect(aquarelleSettingsModalOpen.value).toBe(false);

    setAquarelleSettingsModalOpen(true);
    const reopened = PhysicsPaintSettingsModal() as TestVNode;
    expect(
      String((reopened.props?.style as Record<string, unknown>)?.transform),
      'the session keeps the placed surface',
    ).toBe('translate(30px, 20px)');
  });

  it('seats the sheet one step below both siblings (261029-hy2 WR-01)', () => {
    setAquarelleSettingsModalOpen(true);
    const style = (PhysicsPaintSettingsModal() as TestVNode).props?.style as Record<string, unknown>;
    // The cascade is stroke-settings 12px / brushes 28px / settings 44px: a
    // covered sheet must keep a clickable strip of its 38px header.
    expect(style?.top).toBe('44px');
    expect(style?.height, 'the bottom inset stays 12px').toBe('min(560px, calc(100% - 56px))');
  });

  it('takes its z-index from the shared sheet stack (261029-hy2)', () => {
    setAquarelleSettingsModalOpen(true);
    const tree = PhysicsPaintSettingsModal() as TestVNode;
    const style = tree.props?.style as Record<string, unknown>;
    expect(style?.zIndex).toBe(sheetZIndex(SHEET_ID_SETTINGS));
    expect(style?.zIndex).toBe(52);
    expect(
      tree.props?.onPointerDownCapture,
      'the root raises itself on capture-phase pointerdown',
    ).toBeTypeOf('function');
  });

  it('a raise of another sheet drops the Settings sheet one level (261029-hy2)', () => {
    setAquarelleSettingsModalOpen(true);
    const before = (PhysicsPaintSettingsModal() as TestVNode).props?.style as Record<string, unknown>;
    bringSheetToFront(SHEET_ID_BRUSHES);
    const after = (PhysicsPaintSettingsModal() as TestVNode).props?.style as Record<string, unknown>;
    expect(after?.zIndex).toBe((before?.zIndex as number) - 1);
  });

  it('Escape closes the sheet — capture-phase keydown, removed symmetrically', () => {
    // The suite's preact/hooks mock replaces useEffect with a no-op, so the
    // close path cannot fire at runtime here; pin it at the source instead.
    expect(SHEET_SOURCE).toContain("window.addEventListener('keydown', onKeyDown, true);");
    expect(SHEET_SOURCE).toContain("if (event.key !== 'Escape') return;");
    expect(SHEET_SOURCE).toContain("window.removeEventListener('keydown', onKeyDown, true);");
    expect(SHEET_SOURCE, 'the listener exists only while open').toContain('if (!open) return undefined;');
    expect(SHEET_SOURCE, 'Escape writes the shared close path').toContain(
      'setAquarelleSettingsModalOpen(false);',
    );
  });

  it('Escape passes through when an input inside the sheet owns the key (261029-hy2 WR-02)', () => {
    // Same source-pin idiom as the Escape test above (the hooks mock makes
    // the listener unreachable here): the stroke dialog's editable guard is
    // ported verbatim, keyed to this sheet's testid.
    expect(SHEET_SOURCE).toContain("const editable = target?.closest?.('input, textarea, [contenteditable=\"true\"]');");
    expect(SHEET_SOURCE).toContain("const insideDialog = (editable as { closest?: (selector: string) => unknown })");
    expect(SHEET_SOURCE).toContain(".closest?.('[data-testid=\"physics-settings-modal\"]');");
    expect(SHEET_SOURCE).toContain('if (insideDialog) return;');
    // The guard precedes the close write, so a typo in a multiplier never
    // dismisses the sheet.
    const guardAt = SHEET_SOURCE.indexOf('if (insideDialog) return;');
    const closeAt = SHEET_SOURCE.indexOf('setAquarelleSettingsModalOpen(false);');
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(closeAt);
  });

  it('one Escape closes only the front sheet — Brushes opened after Settings (261029-hy2 WR-03)', () => {
    // Open order: Settings, then Brushes (each open raises its sheet).
    setAquarelleSettingsModalOpen(true);
    bringSheetToFront(SHEET_ID_SETTINGS);
    setAquarelleBrushModalOpen(true);
    bringSheetToFront(SHEET_ID_BRUSHES);
    // Window keydown listeners run in registration order, so the Settings
    // handler sees this Escape first — and must pass it on.
    const settingsClosed = closeSheetIfFront(
      SHEET_ID_SETTINGS,
      () => setAquarelleSettingsModalOpen(false),
    );
    const brushesClosed = closeSheetIfFront(
      SHEET_ID_BRUSHES,
      () => setAquarelleBrushModalOpen(false),
    );
    expect(settingsClosed, 'a covered sheet never swallows the key').toBe(false);
    expect(aquarelleSettingsModalOpen.value, 'Settings stays open').toBe(true);
    expect(brushesClosed).toBe(true);
    expect(aquarelleBrushModalOpen.value, 'only the front sheet closes').toBe(false);
  });

  it('the store setter is compare-then-write', () => {
    // efx-preact-reactivity rule 3: an unchanged value never wakes subscribers.
    let wakeups = 0;
    const unsubscribe = aquarelleSettingsModalOpen.subscribe(() => {
      wakeups += 1;
    });
    // subscribe() delivers the current value immediately; count only writes.
    wakeups = 0;
    try {
      setAquarelleSettingsModalOpen(false);
      expect(wakeups, 'closing a closed sheet is a no-op').toBe(0);
      setAquarelleSettingsModalOpen(true);
      expect(wakeups).toBe(1);
      setAquarelleSettingsModalOpen(true);
      expect(wakeups, 'reopening an open sheet is a no-op').toBe(1);
    } finally {
      unsubscribe();
    }
  });
});
