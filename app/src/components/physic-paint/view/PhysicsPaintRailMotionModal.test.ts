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
import { PhysicsPaintRailMotionEasingControl } from './PhysicsPaintRailMotionEasingControl';
import { SliderStepper } from '../../shared/SliderStepper';
import {
  SHEET_ID_RAIL_MOTION,
  SHEET_ID_SETTINGS,
  bringSheetToFront,
  resetFloatingSheetStack,
  sheetZIndex,
} from './floatingSheetStack';
import type {
  RailMotionChannelWiggleRow,
  RailMotionDialogBundle,
  RailMotionInspectorUnit,
} from './physicsPaintKeyRailPresentation';
import type {
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionEasing,
} from '../roto/railMotionModel';

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

/** 261108-gh0: Wiggle rows share the SliderStepper component, so the numeric
 * fields are counted by ariaLabel and never by component identity alone. */
function numericSteppers(tree: TestVNode): TestVNode[] {
  return collect(tree).filter(
    (node) => node.type === SliderStepper
      && typeof node.props?.ariaLabel === 'string'
      && !String(node.props.ariaLabel).endsWith(' wiggle'),
  );
}

function wiggleSteppers(tree: TestVNode): TestVNode[] {
  return collect(tree).filter(
    (node) => node.type === SliderStepper
      && String(node.props?.ariaLabel).endsWith(' wiggle'),
  );
}

function globalToggles(tree: TestVNode): TestVNode[] {
  return collect(tree).filter(
    (node) => node.props?.['data-motion-wiggle-global'] !== undefined,
  );
}

function renderModal(props: Parameters<typeof PhysicsPaintRailMotionModal>[0]): TestVNode {
  hooks.cursor = 0;
  return PhysicsPaintRailMotionModal(props) as unknown as TestVNode;
}

const MODAL_SOURCE = readFileSync(
  fileURLToPath(new URL('./PhysicsPaintRailMotionModal.tsx', import.meta.url)),
  'utf8',
);

const STUDIO_CSS = readFileSync(
  fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)),
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

function wiggleRow(
  channelId: PhysicPaintRotoRailMotionChannelId,
  label: string,
  wiggle: number,
  wiggleGlobal: boolean,
  setWiggle: (wiggle: number) => string | null = () => null,
  setWiggleGlobal: (wiggleGlobal: boolean) => string | null = () => null,
): RailMotionChannelWiggleRow {
  return { channelId, label, wiggle, wiggleGlobal, setWiggle, setWiggleGlobal };
}

/** The three channels the partial fixture rail carries. */
function partialChannels(
  setWiggle: (wiggle: number) => string | null = () => null,
  setWiggleGlobal: (wiggleGlobal: boolean) => string | null = () => null,
): RailMotionChannelWiggleRow[] {
  return [
    wiggleRow('position-x', 'Position X', 12, true, setWiggle, setWiggleGlobal),
    wiggleRow('position-y', 'Position Y', 0, false, setWiggle, setWiggleGlobal),
    wiggleRow('scale', 'Scale', 3, true, setWiggle, setWiggleGlobal),
  ];
}

/** 261108-gh0 UAT: the property-mode motion-wide easing handle. */
function motionEasingHandle(
  easing: PhysicPaintRotoRailMotionEasing = 'ease',
  set: (easing: PhysicPaintRotoRailMotionEasing) => string | null = () => null,
): NonNullable<RailMotionDialogBundle['motionEasing']> {
  return { easing, set };
}

/** A rail carrying the Position pair and Scale; Rotation/Opacity absent. */
function partialBundle(
  commit: RailMotionDialogBundle['commit'] = () => null,
  reset: RailMotionDialogBundle['reset'] = () => null,
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
    reset,
    keyEasing: null,
    // 261108-gh0 UAT: property mode has no key to write, so the sheet shows the
    // MOTION-wide easing row instead — it must never be absent.
    motionEasing: motionEasingHandle(),
    // 261108-gh0: one Wiggle row per PRESENT channel, in the fixed D-13 order.
    channels: partialChannels(),
    applyEasingToAllKeys: null,
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
    reset: () => null,
    keyEasing: null,
    motionEasing: motionEasingHandle(),
    channels: [
      wiggleRow('position-x', 'Position X', 0, true),
      wiggleRow('position-y', 'Position Y', 0, true),
    ],
    applyEasingToAllKeys: null,
  };
}

/**
 * 261108-d5o: key mode — a Motion key is selected, so the bundle carries the
 * required nullable `keyEasing` write handle (the property-only factories keep
 * it null and must render NO easing row at all). 261108-gh0: key mode also
 * carries the apply-all handle; property mode leaves it null.
 */
function keyModeBundle(
  set: (easing: PhysicPaintRotoRailMotionEasing) => string | null = () => null,
  easing: PhysicPaintRotoRailMotionEasing = 'hold',
  applyEasingToAllKeys: ((easing: PhysicPaintRotoRailMotionEasing) => string | null) = () => null,
): RailMotionDialogBundle {
  return {
    ...partialBundle(),
    keyEasing: { frame: 5, easing, set },
    // Key mode owns the row through `keyEasing`; the motion-wide handle is a
    // property-mode-only fallback and stays null here.
    motionEasing: null,
    applyEasingToAllKeys,
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
    // 261108-gh0: count the NUMERIC fields by ariaLabel — the Wiggle rows share
    // the same SliderStepper component and are asserted separately.
    const steppers = numericSteppers(tree);
    expect(steppers).toHaveLength(2);
    expect(steppers.map((node) => node.props?.ariaLabel)).toEqual(['Position X', 'Position Y']);
    expect(wiggleSteppers(tree).map((node) => node.props?.ariaLabel)).toEqual([
      'Position X wiggle', 'Position Y wiggle',
    ]);

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
    const steppers = numericSteppers(tree);
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

  it('the header reset pins the identity pose through the bundle and surfaces its rejection', () => {
    const reset = vi.fn((): string | null => null);
    const dialog = signal<RailMotionDialogBundle | null>(partialBundle(() => null, reset));
    const first = renderModal({ dialog });
    const findReset = (tree: TestVNode) => collect(tree).find(
      (node) => node.props?.['data-testid'] === 'physics-rail-motion-modal-reset',
    )!;
    const resetButton = findReset(first);
    expect(resetButton.props?.['aria-label']).toBe('Reset Motion values');
    // 261108-gh0: the icon gained its visible word and the auto-width modifier.
    expect(textOf(resetButton)).toBe('Reset');
    expect(String(resetButton.props?.class)).toContain(
      'physics-paint-stroke-settings-header-button--labelled',
    );
    const stopPropagation = vi.fn();
    (resetButton.props?.onPointerDown as (event: unknown) => void)({ stopPropagation });
    expect(stopPropagation, 'the press never starts a header drag').toHaveBeenCalledTimes(1);
    click(resetButton);
    expect(reset).toHaveBeenCalledTimes(1);

    // A refusal reaches the same single alert channel as a field commit.
    reset.mockReturnValue('This value is outside the Motion channel range.');
    click(findReset(renderModal({ dialog })));
    const alerts = collect(renderModal({ dialog })).filter((node) => node.props?.role === 'alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].props?.children).toBe('This value is outside the Motion channel range.');
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

  it('renders the shared easing table in BOTH modes and writes through the right authority (261108-d5o/gh0 UAT)', () => {
    const set = vi.fn((): string | null => null);
    const dialog = signal<RailMotionDialogBundle | null>(keyModeBundle(set, 'hold'));
    const tree = renderModal({ dialog });
    const control = collect(tree).find((node) => node.type === PhysicsPaintRailMotionEasingControl);
    expect(control, 'key mode renders the Keys section').toBeDefined();
    expect(control!.props?.value).toBe('hold');
    expect(control!.props?.keyFrame).toBe(5);
    // The per-key target is the selected key.
    (control!.props?.onSelect as (easing: PhysicPaintRotoRailMotionEasing, target: 'key' | 'all') => void)(
      'linear',
      'key',
    );
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('linear');

    // The Keys section wraps the table.
    const keysSection = collect(tree).find((node) => node.props?.['aria-label'] === 'Keys');
    expect(keysSection).toBeDefined();

    // 261108-gh0 UAT: property-only mode ALSO shows the table — the motion-wide
    // handle. There is no key, so the per-key target is inert.
    const propertyTree = renderModal({ dialog: signal(partialBundle()) });
    const propertyControl = collect(propertyTree).find(
      (node) => node.type === PhysicsPaintRailMotionEasingControl,
    );
    expect(propertyControl, 'property mode still shows the easing table').toBeDefined();
    expect(propertyControl!.props?.value).toBe('ease');
    expect(propertyControl!.props?.keyFrame).toBeNull();
    expect(collect(propertyTree).find(
      (node) => node.props?.['aria-label'] === 'Keys',
    )).toBeDefined();
  });

  it('routes an easing rejection through the modal ONE role="alert" (261108-d5o)', () => {
    const set = vi.fn(() => 'This Motion key has no easing.');
    const dialog = signal<RailMotionDialogBundle | null>(keyModeBundle(set));
    const first = renderModal({ dialog });
    const control = collect(first).find(
      (node) => node.type === PhysicsPaintRailMotionEasingControl,
    );
    expect(control).toBeDefined();
    (control!.props?.onSelect as (easing: PhysicPaintRotoRailMotionEasing, target: 'key' | 'all') => void)(
      'ease',
      'key',
    );

    const second = renderModal({ dialog });
    const alerts = collect(second).filter((node) => node.props?.role === 'alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].props?.children).toBe('This Motion key has no easing.');
    // The row keeps rendering at the displayed easing.
    expect(collect(second).find(
      (node) => node.type === PhysicsPaintRailMotionEasingControl,
    )?.props?.value).toBe('hold');
  });

  it('the All target commits the displayed token in BOTH modes (261108-gh0 UAT)', () => {
    const applyAll = vi.fn((): string | null => null);
    const dialog = signal<RailMotionDialogBundle | null>(
      keyModeBundle(() => null, 'linear', applyAll),
    );
    const tree = renderModal({ dialog });
    const control = collect(tree).find(
      (node) => node.type === PhysicsPaintRailMotionEasingControl,
    );
    (control!.props?.onSelect as (easing: PhysicPaintRotoRailMotionEasing, target: 'key' | 'all') => void)(
      'linear',
      'all',
    );
    expect(applyAll).toHaveBeenCalledTimes(1);
    expect(applyAll).toHaveBeenCalledWith('linear');

    // Property mode has no key, but the All target still writes the motion.
    const propertyApply = vi.fn((): string | null => null);
    const propertyTree = renderModal({
      dialog: signal({ ...partialBundle(), applyEasingToAllKeys: propertyApply }),
    });
    const propertyControl = collect(propertyTree).find(
      (node) => node.type === PhysicsPaintRailMotionEasingControl,
    );
    (propertyControl!.props?.onSelect as (easing: PhysicPaintRotoRailMotionEasing, target: 'key' | 'all') => void)(
      'hold',
      'all',
    );
    expect(propertyApply).toHaveBeenCalledWith('hold');
  });

  it('routes an apply-all rejection through the modal ONE role="alert" (261108-gh0)', () => {
    const applyAll = vi.fn(() => 'There are no Motion keys to change.');
    const dialog = signal<RailMotionDialogBundle | null>(
      keyModeBundle(() => null, 'hold', applyAll),
    );
    const first = renderModal({ dialog });
    (collect(first).find(
      (node) => node.type === PhysicsPaintRailMotionEasingControl,
    )!.props?.onSelect as (easing: PhysicPaintRotoRailMotionEasing, target: 'key' | 'all') => void)(
      'hold',
      'all',
    );

    const second = renderModal({ dialog });
    const alerts = collect(second).filter((node) => node.props?.role === 'alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].props?.children).toBe('There are no Motion keys to change.');
    // The Keys section survives the rejection.
    expect(collect(second).some(
      (node) => node.props?.['aria-label'] === 'Keys',
    )).toBe(true);
  });

  it('renders one Wiggle row per bundle channel with the raw amplitude contract (261108-gh0)', () => {
    const tree = renderModal({ dialog: signal(partialBundle()) });
    const steppers = wiggleSteppers(tree);

    expect(steppers.map((node) => node.props?.ariaLabel)).toEqual([
      'Position X wiggle', 'Position Y wiggle', 'Scale wiggle',
    ]);
    expect(steppers.map((node) => node.props?.label)).toEqual([
      'Position X wiggle', 'Position Y wiggle', 'Scale wiggle',
    ]);
    // Raw model amplitude — never a display-unit conversion.
    expect(steppers.map((node) => node.props?.value)).toEqual([12, 0, 3]);
    expect(steppers.every((node) => node.props?.min === 0)).toBe(true);
    expect(steppers.every((node) => node.props?.max === 1000000)).toBe(true);
    expect(steppers.every((node) => node.props?.step === 1)).toBe(true);
    expect(steppers.every((node) => node.props?.precision === 0)).toBe(true);
    expect(steppers.every((node) => node.props?.freeEntry === true)).toBe(true);
    expect(steppers.every((node) => node.props?.allowOutOfRangeEntry === true)).toBe(true);
    expect(steppers.every((node) => node.props?.commitOnRelease === true)).toBe(true);
    // Only channels the rail carries get a row.
    expect(wiggleSteppers(renderModal({ dialog: signal(positionOnlyBundle()) })))
      .toHaveLength(2);
  });

  it('commits each Wiggle row through its own setter, one reason channel (261108-gh0)', () => {
    const setWiggle = vi.fn((): string | null => null);
    const setWiggleGlobal = vi.fn((): string | null => null);
    const dialog = signal<RailMotionDialogBundle | null>({
      ...partialBundle(),
      channels: partialChannels(setWiggle, setWiggleGlobal),
    });
    const tree = renderModal({ dialog });

    (wiggleSteppers(tree)[1]!.props?.onChange as (value: number) => void)(250);
    expect(setWiggle).toHaveBeenCalledTimes(1);
    expect(setWiggle).toHaveBeenCalledWith(250);

    // Scale starts Global ON, so the toggle offers the per-key fallback.
    click(globalToggles(tree)[2]!);
    expect(setWiggleGlobal).toHaveBeenCalledTimes(1);
    expect(setWiggleGlobal).toHaveBeenCalledWith(false);

    expect(collect(renderModal({ dialog })).filter((node) => node.props?.role === 'alert'))
      .toHaveLength(0);
  });

  it('renders one Global toggle per channel reflecting wiggleGlobal (261108-gh0)', () => {
    const tree = renderModal({ dialog: signal(partialBundle()) });
    const toggles = globalToggles(tree);

    expect(toggles.map((node) => node.props?.['data-motion-wiggle-global'])).toEqual([
      'position-x', 'position-y', 'scale',
    ]);
    expect(toggles.map((node) => node.props?.['aria-pressed'])).toEqual([
      'true', 'false', 'true',
    ]);
    // The existing icon-button chrome with a VISIBLE word, never icon-only.
    expect(toggles.every(
      (node) => String(node.props?.class).includes('physics-paint-roto-key-icon-button'),
    )).toBe(true);
    expect(toggles.map(textOf)).toEqual(['Global', 'Global', 'Global']);
  });

  it('routes a Wiggle rejection through the modal ONE role="alert" and keeps the document value (261108-gh0)', () => {
    const setWiggle = vi.fn(() => 'Wiggle must be between 0 and 1,000,000.');
    const dialog = signal<RailMotionDialogBundle | null>({
      ...partialBundle(),
      channels: partialChannels(setWiggle),
    });
    const first = renderModal({ dialog });
    (wiggleSteppers(first)[0]!.props?.onChange as (value: number) => void)(-1);

    const second = renderModal({ dialog });
    const alerts = collect(second).filter((node) => node.props?.role === 'alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].props?.children).toBe('Wiggle must be between 0 and 1,000,000.');
    // The rejected row remounts at the projected value — no clamp echo.
    expect(wiggleSteppers(second)[0]!.props?.value).toBe(12);
    // The rejection sequence keys the WHOLE row, so the toggle remounts too.
    expect(MODAL_SOURCE).toContain('key={`${row.channelId}:${rejectionSeq}`}');
  });

  it('renders the body in the pinned order: fields, easing, apply-all, Wiggle rows, rejection (261108-gh0)', () => {
    const setWiggle = vi.fn((): string | null => 'Wiggle must be between 0 and 1,000,000.');
    const dialog = signal<RailMotionDialogBundle | null>({
      ...keyModeBundle(() => null, 'hold'),
      channels: partialChannels(setWiggle),
    });
    // Trigger one rejection so the alert is part of the same tree.
    (wiggleSteppers(renderModal({ dialog }))[0]!.props?.onChange as (value: number) => void)(-5);

    const nodes = collect(renderModal({ dialog }));
    const indexOf = (predicate: (node: TestVNode) => boolean) => nodes.findIndex(predicate);
    const scale = indexOf(
      (node) => node.type === SliderStepper && node.props?.ariaLabel === 'Scale',
    );
    const position = indexOf((node) => node.props?.['aria-label'] === 'Position');
    const keys = indexOf((node) => node.props?.['aria-label'] === 'Keys');
    const wiggle = indexOf((node) => node.props?.['aria-label'] === 'Wiggle');
    const alert = indexOf((node) => node.props?.role === 'alert');

    // 261108-gh0 UAT: three bordered sections, in order, alert last.
    expect(position).toBeGreaterThan(-1);
    expect(scale).toBeGreaterThan(position);
    expect(position).toBeLessThan(keys);
    expect(keys).toBeLessThan(wiggle);
    expect(wiggle).toBeLessThan(alert);
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

  it('pins the sections, easing targets, Wiggle and labelled Reset surfaces in source and CSS (261108-gh0)', () => {
    // Three bordered sections: Position, Keys, Wiggle.
    expect(MODAL_SOURCE).toContain('class="physics-paint-motion-section"');
    expect(MODAL_SOURCE).toContain('aria-label="Position"');
    expect(MODAL_SOURCE).toContain('aria-label="Keys"');
    expect(MODAL_SOURCE).toContain('aria-label="Wiggle"');
    // One row, two targets: the key write and the motion-wide write.
    expect(MODAL_SOURCE).toContain("target === 'key'");
    expect(MODAL_SOURCE).toContain('applyToAllKeys?.(easing)');
    expect(MODAL_SOURCE).toContain('data-motion-wiggle-global={row.channelId}');
    expect(MODAL_SOURCE).toContain('row.setWiggle(value)');
    expect(MODAL_SOURCE).toContain('row.setWiggleGlobal(!row.wiggleGlobal)');
    expect(MODAL_SOURCE).toContain('physics-paint-stroke-settings-header-button--labelled');

    expect(STUDIO_CSS).toContain('.physics-paint-stroke-settings-header-button--labelled {');
    expect(STUDIO_CSS).toContain('.physics-paint-motion-section {');
    expect(STUDIO_CSS).toContain('.physics-paint-motion-easing-table {');
    expect(STUDIO_CSS).toContain('.physics-paint-motion-easing-target {');
    expect(STUDIO_CSS).toContain('.physics-paint-motion-wiggle-row {');
    expect(STUDIO_CSS).toContain('.physics-paint-motion-wiggle-global {');
    expect(STUDIO_CSS).toContain('.physics-paint-motion-wiggle-global[aria-pressed="true"]');
  });
});
