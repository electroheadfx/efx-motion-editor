// ============================================================
//  261107-qgj — the floating Motion modal.
//
//  Laws pinned here:
//    closed -> nothing renders
//    open -> a dialog labelled "Motion" with present-only numeric
//            fields (no ghost row, no 'not added', no absent note)
//    every field commits its own channel + display value
//    a rejection renders one role="alert" with the exact sentence
//    the close button calls the ONE close path
//    the fourth sheet takes its z from the shared stack
//    the header drag moves the surface and never closes it
//    the bottom resize sets the session height (240 floor, viewport max)
//    the session layout survives close/reopen and reset clears it
//
//  No DOM environment: same vnode-walk idiom as the sibling
//  sheet suites. The cursor-based hooks mock keeps refs across
//  re-invocations so the rejection state is observable.
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { signal } from '@preact/signals';
import {
  PhysicsPaintRailMotionModal,
  resetRailMotionModalLayout,
} from './PhysicsPaintRailMotionModal';
import { SliderStepper } from '../../shared/SliderStepper';
import {
  SHEET_ID_RAIL_MOTION,
  SHEET_ID_SETTINGS,
  bringSheetToFront,
  resetFloatingSheetStack,
  sheetZIndex,
} from './floatingSheetStack';
import type {
  RailMotionDialogBundle,
  RailMotionInspectorUnit,
} from './physicsPaintKeyRailPresentation';
import type { PhysicPaintRotoRailMotionChannelId } from '../roto/railMotionModel';

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

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node !== 'object') return String(node);
  return textOf((node as TestVNode).props?.children);
}

function click(node: TestVNode): void {
  const onClick = node.props?.onClick as (() => void) | undefined;
  expect(onClick, 'element has no onClick').toBeTypeOf('function');
  onClick!();
}

function renderModal(props: Parameters<typeof PhysicsPaintRailMotionModal>[0]): TestVNode {
  hooks.cursor = 0;
  return PhysicsPaintRailMotionModal(props) as unknown as TestVNode;
}

const MODAL_SOURCE = readFileSync(
  fileURLToPath(new URL('./PhysicsPaintRailMotionModal.tsx', import.meta.url)),
  'utf8',
);

const STUDIO_SOURCE = readFileSync(
  fileURLToPath(new URL('../PhysicsPaintStudio.tsx', import.meta.url)),
  'utf8',
);

/**
 * The hooks mock keys refs by call order: surfaceRef is index 0. Install a
 * fake surface rect so the drag clamp and the resize math have geometry to
 * work with (the node harness never lays anything out).
 */
function installSurfaceRect(rect: { left: number; top: number; width: number; height: number }) {
  const ref = hooks.refs.get(0) as { current: unknown } | undefined;
  expect(ref, 'surfaceRef is the first hook in the modal').toBeDefined();
  ref!.current = { getBoundingClientRect: () => rect };
}

function headerOf(tree: TestVNode): TestVNode {
  return collect(tree).find(
    (node) => node.props?.['data-testid'] === 'physics-rail-motion-modal-header',
  )!;
}

function resizeOf(tree: TestVNode): TestVNode {
  return collect(tree).find(
    (node) => node.props?.['data-testid'] === 'physics-rail-motion-modal-resize',
  )!;
}

function rootStyle(tree: TestVNode): Record<string, unknown> {
  return tree.props?.style as Record<string, unknown>;
}

function pointerDownEvent(clientX: number, clientY: number) {
  return {
    button: 0,
    clientX,
    clientY,
    pointerId: 1,
    preventDefault: vi.fn(),
    currentTarget: { setPointerCapture: vi.fn() },
  };
}

function field(
  channelId: PhysicPaintRotoRailMotionChannelId,
  label: string,
  unit: RailMotionInspectorUnit,
  value: number,
  present: boolean,
) {
  return { channelId, label, unit, value, present };
}

/** A rail carrying the Position pair and Scale; Rotation/Opacity absent. */
function partialBundle(
  commit: RailMotionDialogBundle['commit'] = () => null,
): RailMotionDialogBundle {
  return {
    presentation: {
      railId: 'rail-1',
      frame: 5,
      fields: [
        field('position-x', 'Position X', 'px', 120, true),
        field('position-y', 'Position Y', 'px', -12, true),
        field('scale', 'Scale', '%', 150, true),
        field('rotation', 'Rotation', '°', 0, false),
        field('opacity', 'Opacity', '%', 100, false),
      ],
    },
    commit,
  };
}

/** A bundle whose rail carries only the Position pair. */
function positionOnlyBundle(): RailMotionDialogBundle {
  return {
    presentation: {
      railId: 'rail-partial',
      frame: 5,
      fields: [
        field('position-x', 'Position X', 'px', 120, true),
        field('position-y', 'Position Y', 'px', -12, true),
        field('scale', 'Scale', '%', 100, false),
        field('rotation', 'Rotation', '°', 0, false),
        field('opacity', 'Opacity', '%', 100, false),
      ],
    },
    commit: () => null,
  };
}

beforeEach(() => {
  hooks.reset();
  resetFloatingSheetStack();
  resetRailMotionModalLayout();
});

afterEach(() => {
  hooks.reset();
  resetFloatingSheetStack();
  resetRailMotionModalLayout();
  vi.unstubAllGlobals();
});

describe('261107-qgj floating Motion modal', () => {
  it('renders nothing while closed — a null dialog or a null signal', () => {
    expect(PhysicsPaintRailMotionModal({ dialog: null })).toBeNull();
    expect(PhysicsPaintRailMotionModal({ dialog: signal<RailMotionDialogBundle | null>(null) }))
      .toBeNull();
  });

  it('opens as a Motion dialog with one header and one close button', () => {
    const tree = renderModal({ dialog: signal(partialBundle()), onClose: vi.fn() });
    expect(tree.props?.role).toBe('dialog');
    expect(String(tree.props?.['aria-label'])).toBe('Motion');
    expect(tree.props?.['data-testid']).toBe('physics-rail-motion-modal');

    const nodes = collect(tree);
    expect(nodes.filter((node) => node.props?.['data-testid'] === 'physics-rail-motion-modal-header'))
      .toHaveLength(1);
    expect(nodes.filter((node) => node.props?.['data-testid'] === 'physics-rail-motion-modal-close'))
      .toHaveLength(1);
    expect(textOf(tree)).toContain('Motion');
  });

  it('renders ONLY present channels — no ghost row, no absent marker, no absent note', () => {
    const tree = renderModal({ dialog: signal(positionOnlyBundle()) });
    const steppers = collect(tree).filter((node) => node.type === SliderStepper);
    expect(steppers).toHaveLength(2);
    expect(steppers.map((node) => node.props?.ariaLabel)).toEqual(['Position X', 'Position Y']);

    // The SliderStepper renders its own label cell (same as the Stroke settings
    // rows), so the copy lives on the vnode props, not in this tree walk.
    expect(steppers.map((node) => node.props?.label)).toEqual(['Position X (px)', 'Position Y (px)']);
    const copy = textOf(tree);
    expect(copy).not.toContain('Scale');
    expect(copy).not.toContain('Rotation');
    expect(copy).not.toContain('Opacity');
    expect(copy).not.toContain('not added');
  });

  it('shows each field label with its unit and the projected display value', () => {
    const tree = renderModal({ dialog: signal(partialBundle()) });
    const steppers = collect(tree).filter((node) => node.type === SliderStepper);
    expect(steppers.map((node) => node.props?.ariaLabel)).toEqual([
      'Position X', 'Position Y', 'Scale',
    ]);
    expect(steppers.map((node) => node.props?.value)).toEqual([120, -12, 150]);
    expect(steppers.map((node) => node.props?.label)).toEqual([
      'Position X (px)', 'Position Y (px)', 'Scale (%)',
    ]);
    expect(steppers.every((node) => node.props?.freeEntry === true)).toBe(true);
    expect(steppers.every((node) => node.props?.step === 1)).toBe(true);
    expect(steppers.every((node) => node.props?.precision === 3)).toBe(true);
    // 261107-qgj UAT: the Stroke settings slider treatment — the track spans
    // the display-unit range while typed entry stays unclamped.
    expect(steppers.map((node) => [node.props?.min, node.props?.max])).toEqual([
      [-1000, 1000],
      [-1000, 1000],
      [10, 500],
    ]);
    expect(steppers.every((node) => node.props?.allowOutOfRangeEntry === true)).toBe(true);
    expect(steppers.every((node) => node.props?.commitOnRelease === true)).toBe(true);
  });

  it('commits every field through the bundle with its own channel id and display value', () => {
    const commit = vi.fn(() => null as string | null);
    const tree = renderModal({ dialog: signal(partialBundle(commit)) });
    const stepper = (label: string) => collect(tree).find(
      (node) => node.type === SliderStepper && node.props?.ariaLabel === label,
    )!;

    (stepper('Position X').props?.onChange as (value: number) => void)(999);
    (stepper('Position Y').props?.onChange as (value: number) => void)(-999);
    (stepper('Scale').props?.onChange as (value: number) => void)(250);

    expect(commit.mock.calls).toEqual([
      ['position-x', 999],
      ['position-y', -999],
      ['scale', 250],
    ]);
  });

  it('shows a returned rejection verbatim in ONE role="alert"', () => {
    const commit = vi.fn(() => 'Scale must be greater than 0.');
    const dialog = signal<RailMotionDialogBundle | null>(partialBundle(commit));
    const first = renderModal({ dialog });
    const scale = collect(first).find(
      (node) => node.type === SliderStepper && node.props?.ariaLabel === 'Scale',
    )!;
    (scale.props?.onChange as (value: number) => void)(0);

    const second = renderModal({ dialog });
    const alerts = collect(second).filter((node) => node.props?.role === 'alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].props?.children).toBe('Scale must be greater than 0.');
    // The projected value is still the one the document holds — no clamp echo.
    const reseated = collect(second).find(
      (node) => node.type === SliderStepper && node.props?.ariaLabel === 'Scale',
    )!;
    expect(reseated.props?.value).toBe(150);
  });

  it('a successful commit clears a previous rejection', () => {
    let next: string | null = 'A rejected value.';
    const commit = vi.fn(() => next);
    const dialog = signal<RailMotionDialogBundle | null>(partialBundle(commit));
    const first = renderModal({ dialog });
    const scale = (label: string, tree: TestVNode) => collect(tree).find(
      (node) => node.type === SliderStepper && node.props?.ariaLabel === label,
    )!;
    (scale('Scale', first).props?.onChange as (value: number) => void)(0);

    const second = renderModal({ dialog });
    expect(collect(second).filter((node) => node.props?.role === 'alert')).toHaveLength(1);

    next = null;
    (scale('Scale', second).props?.onChange as (value: number) => void)(200);
    const third = renderModal({ dialog });
    expect(collect(third).filter((node) => node.props?.role === 'alert')).toHaveLength(0);
  });

  it('the close button calls the ONE close path and its pointerdown never starts a drag', () => {
    const onClose = vi.fn();
    const tree = renderModal({ dialog: signal(partialBundle()), onClose });
    const closeButton = collect(tree).find(
      (node) => node.props?.['data-testid'] === 'physics-rail-motion-modal-close',
    )!;
    const stopPropagation = vi.fn();
    const onPointerDown = closeButton.props?.onPointerDown as ((event: unknown) => void) | undefined;
    expect(onPointerDown, 'the close button carries a pointerdown guard').toBeTypeOf('function');
    onPointerDown!({ stopPropagation });
    expect(stopPropagation, 'the press never reaches the header').toHaveBeenCalledTimes(1);
    click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('takes its z-index from the shared four-sheet stack and seats the fourth step', () => {
    const tree = renderModal({ dialog: signal(partialBundle()) });
    const style = tree.props?.style as Record<string, unknown>;
    expect(style?.zIndex).toBe(sheetZIndex(SHEET_ID_RAIL_MOTION));
    expect(style?.zIndex).toBe(53);
    expect(style?.top).toBe('60px');
    expect(style?.right).toBe('12px');
    expect(style?.width).toBe('320px');
    expect(style?.height, 'the bottom inset stays 12px').toBe('min(380px, calc(100% - 72px))');
    expect(
      tree.props?.onPointerDownCapture,
      'the root raises itself on capture-phase pointerdown',
    ).toBeTypeOf('function');

    bringSheetToFront(SHEET_ID_SETTINGS);
    expect((renderModal({ dialog: signal(partialBundle()) }).props?.style as Record<string, unknown>)?.zIndex)
      .toBe(sheetZIndex(SHEET_ID_SETTINGS) - 1);
  });

  it('pins the sheet contract in source: props-driven, front-only Escape, one close path', () => {
    expect(MODAL_SOURCE).toContain('closeSheetIfFront(SHEET_ID_RAIL_MOTION');
    expect(MODAL_SOURCE).toContain('releaseSheet(SHEET_ID_RAIL_MOTION)');
    expect(MODAL_SOURCE).toContain('event.stopImmediatePropagation();');
    expect(MODAL_SOURCE).toContain('event.preventDefault();');
    expect(MODAL_SOURCE).toContain('const editable = target?.closest?.(\'input, textarea, [contenteditable="true"]\');');
    expect(MODAL_SOURCE).toContain('[data-testid="${MODAL_TESTID}"]');
    expect(MODAL_SOURCE).toContain('key={`${field.channelId}:${rejectionSeq}`}');
    expect(MODAL_SOURCE).not.toContain('physicPaintStore');
    expect(MODAL_SOURCE).not.toContain('useState');
    // The store-free projection module is the only data source.
    expect(MODAL_SOURCE).toContain('RailMotionDialogBundle');
  });

  it('the header drag moves the surface by the pointer delta and never closes it', () => {
    const onClose = vi.fn();
    const dialog = signal(partialBundle());
    const header = headerOf(renderModal({ dialog, onClose }));
    (header.props?.onPointerDown as (event: unknown) => void)(pointerDownEvent(100, 100));
    (header.props?.onPointerMove as (event: unknown) => void)({ clientX: 130, clientY: 120 });

    const moved = renderModal({ dialog, onClose });
    expect(rootStyle(moved)?.transform).toBe('translate(30px, 20px)');
    expect(onClose, 'a drag never closes the modal').not.toHaveBeenCalled();

    // Release stops the drag: a later move without a press is a no-op.
    (headerOf(moved).props?.onPointerUp as () => void)();
    (headerOf(moved).props?.onPointerMove as (event: unknown) => void)({ clientX: 900, clientY: 900 });
    expect(rootStyle(renderModal({ dialog }))?.transform).toBe('translate(30px, 20px)');
  });

  it('clamps the drag to keep 80px visible horizontally and the header on screen', () => {
    vi.stubGlobal('window', { innerWidth: 1200, innerHeight: 800 });
    const dialog = signal(partialBundle());
    const first = renderModal({ dialog });
    installSurfaceRect({ left: 700, top: 60, width: 300, height: 260 });
    const header = headerOf(first);
    (header.props?.onPointerDown as (event: unknown) => void)(pointerDownEvent(100, 100));
    const move = headerOf(renderModal({ dialog })).props?.onPointerMove as (event: unknown) => void;

    // Far past the left edge: 80px of the 320px surface stays visible.
    move({ clientX: -5000, clientY: -5000 });
    expect(rootStyle(renderModal({ dialog }))?.transform).toBe('translate(-920px, -60px)');
    // Far past the right/bottom edges: the header stays reachable.
    move({ clientX: 5000, clientY: 5000 });
    expect(rootStyle(renderModal({ dialog }))?.transform).toBe('translate(420px, 692px)');
  });

  it('the bottom resize sets the height with a 240px floor and a viewport-derived max', () => {
    vi.stubGlobal('window', { innerWidth: 1200, innerHeight: 800 });
    const dialog = signal(partialBundle());
    const first = renderModal({ dialog });
    installSurfaceRect({ left: 700, top: 100, width: 300, height: 260 });
    const handle = resizeOf(first);
    expect(handle.props?.['aria-hidden']).toBe('true');
    (handle.props?.onPointerDown as (event: unknown) => void)(pointerDownEvent(100, 200));
    const move = resizeOf(renderModal({ dialog })).props?.onPointerMove as (event: unknown) => void;

    move({ clientY: 300 });
    expect(rootStyle(renderModal({ dialog }))?.height).toBe('360px');
    move({ clientY: -1000 });
    expect(rootStyle(renderModal({ dialog }))?.height).toBe('240px');
    // max = max(240, 800 - 100 - 12)
    move({ clientY: 10000 });
    expect(rootStyle(renderModal({ dialog }))?.height).toBe('688px');

    const grip = collect(renderModal({ dialog })).find(
      (node) => node.type === 'span'
        && (node.props?.style as Record<string, unknown> | undefined)?.width === '34px',
    );
    expect(grip, 'the handle carries the sibling sheet 34x3 grip').toBeDefined();
    expect((grip!.props?.style as Record<string, unknown>).height).toBe('3px');
  });

  it('the layout is session-scoped: close/reopen keeps it, reset clears it', () => {
    const dialog = signal(partialBundle());
    const header = headerOf(renderModal({ dialog }));
    (header.props?.onPointerDown as (event: unknown) => void)(pointerDownEvent(100, 100));
    (headerOf(renderModal({ dialog })).props?.onPointerMove as (event: unknown) => void)(
      { clientX: 140, clientY: 130 },
    );

    vi.stubGlobal('window', { innerWidth: 1200, innerHeight: 800 });
    installSurfaceRect({ left: 700, top: 100, width: 300, height: 260 });
    const handle = resizeOf(renderModal({ dialog }));
    (handle.props?.onPointerDown as (event: unknown) => void)(pointerDownEvent(100, 200));
    (resizeOf(renderModal({ dialog })).props?.onPointerMove as (event: unknown) => void)({ clientY: 260 });

    const placed = renderModal({ dialog });
    expect(rootStyle(placed)?.transform).toBe('translate(40px, 30px)');
    expect(rootStyle(placed)?.height).toBe('320px');

    // A closed sheet renders nothing; the session layout outlives it.
    expect(renderModal({ dialog: signal<RailMotionDialogBundle | null>(null) })).toBeNull();
    const reopened = renderModal({ dialog });
    expect(rootStyle(reopened)?.transform, 'the session keeps the placed surface')
      .toBe('translate(40px, 30px)');
    expect(rootStyle(reopened)?.height).toBe('320px');

    resetRailMotionModalLayout();
    const cleared = renderModal({ dialog });
    expect(rootStyle(cleared)?.transform).toBe('translate(0px, 0px)');
    expect(rootStyle(cleared)?.height).toBe('min(380px, calc(100% - 72px))');
  });

  it('pins the Studio close path and the removed sidebar in source (261107-qgj)', () => {
    expect(STUDIO_SOURCE).toContain('railMotionDialog: rotoTimelineActions.railMotionDialog,');
    expect(STUDIO_SOURCE).toContain(
      'onCloseRailMotionDialog: rotoTimelineActions.clearRailMotionSelection,',
    );
    expect(STUDIO_SOURCE).not.toContain('commitRailMotionChannelValue');
    expect(STUDIO_SOURCE).not.toContain('projectRailMotionInspector');
    expect(STUDIO_SOURCE).not.toContain('selectedRailMotion');
    // The Escape path is the shared front gate, never a private listener.
    expect(MODAL_SOURCE).toContain('if (!closeSheetIfFront(SHEET_ID_RAIL_MOTION, close)) return;');
  });

  it('pins the sheet mechanics in source (261107-qgj)', () => {
    expect(MODAL_SOURCE).toContain(
      'const railMotionModalDragOffset = signal<DragOffset | null>(null);',
    );
    expect(MODAL_SOURCE).toContain(
      'const railMotionModalResizeHeight = signal<number | null>(null);',
    );
    expect(MODAL_SOURCE).toContain('export function resetRailMotionModalLayout(): void {');
    expect(MODAL_SOURCE).toContain('onPointerDown={onHeaderPointerDown}');
    expect(MODAL_SOURCE).toContain('data-testid="physics-rail-motion-modal-resize"');
    expect(MODAL_SOURCE).toContain('80 - start.rect.width - start.rect.left');
    expect(MODAL_SOURCE).toContain('window.innerHeight - 48 - start.rect.top');
    expect(MODAL_SOURCE).toContain('Math.max(240, viewportHeight - rect.top - SURFACE_INSET_PX)');
    expect(MODAL_SOURCE).toContain(
      'transform: `translate(${applied?.dxPx ?? 0}px, ${applied?.dyPx ?? 0}px)`,',
    );
  });
});
