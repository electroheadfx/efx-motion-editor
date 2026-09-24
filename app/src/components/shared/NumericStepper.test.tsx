/**
 * 52.2-03 (D-23/D-24): the shared `− [field] +` numeric stepper.
 *
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as PhysicsPaintTrackRow.test.tsx): the component function is invoked
 * directly and its vnodes are walked, so handlers are driven with plain event
 * objects and the hold-to-repeat lifecycle is proven with fake timers.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRAIN_SCALE_MAX, GRAIN_SCALE_MIN } from '../../efx-paint/document/efxPaintDocument';
import { pushAction, resetHistory } from '../../lib/history';
import { historyStore } from '../../stores/historyStore';
import type { HistoryEntry } from '../../types/history';
import { grainScaleStep } from '../physic-paint/view/PhysicsPaintTopBar';
import {
  NUMERIC_STEPPER_REPEAT_DELAY_MS,
  NUMERIC_STEPPER_REPEAT_INTERVAL_MS,
  NumericStepper,
} from './NumericStepper';

// The harness calls component functions outside a render context: useRef and
// useEffect have no Preact component to attach to, so they are stubbed to
// inert equivalents (the same stubbing PhysicsPaintTrackRow.test.tsx uses).
vi.mock('preact/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact/hooks')>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
  };
});

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

function childrenOf(node: TestVNode): unknown[] {
  const children = node.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
}

function materialize(node: unknown): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map(materialize);
  if (typeof node !== 'object') return node;
  const vnode = node as TestVNode;
  if (typeof vnode.type === 'function') return materialize(vnode.type(vnode.props));
  return {
    ...vnode,
    props: {
      ...vnode.props,
      children: childrenOf(vnode).map(materialize),
    },
  } as TestVNode;
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

type StepperProps = Parameters<typeof NumericStepper>[0];

function renderStepper(overrides: Partial<StepperProps> = {}): unknown {
  return materialize(NumericStepper({
    value: 12,
    onChange: () => {},
    step: 1,
    min: 0,
    max: 20,
    ariaLabel: 'Test value',
    ...overrides,
  }));
}

function button(tree: unknown, label: string): TestVNode | undefined {
  return findAll(tree, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === label)[0];
}

function input(tree: unknown): TestVNode | undefined {
  return findAll(tree, (vnode) => vnode.type === 'input')[0];
}

/** Pointer press on a stepper button — the − / + click path (D-24). */
function pointerDown(target: TestVNode, pointerId = 7): void {
  (target.props as { onPointerDown: (event: unknown) => void }).onPointerDown({
    preventDefault: vi.fn(),
    pointerId,
    currentTarget: { setPointerCapture: vi.fn() },
  });
}

function pointerUp(target: TestVNode): void {
  (target.props as { onPointerUp: () => void }).onPointerUp();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NumericStepper — shared − [field] + treatment (D-23/D-24)', () => {
  it('steps up by the field step on a single click of +', () => {
    const onChange = vi.fn();
    const plus = button(renderStepper({ value: 12, onChange }), 'Increase Test value');
    expect(plus).toBeDefined();
    pointerDown(plus!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(13);
  });

  it('steps down by the field step on a single click of −', () => {
    const onChange = vi.fn();
    const minus = button(renderStepper({ value: 12, onChange }), 'Decrease Test value');
    expect(minus).toBeDefined();
    pointerDown(minus!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(11);
  });

  it('never emits a value beyond max, even when held', () => {
    const onChange = vi.fn();
    const plus = button(renderStepper({ value: 20, min: 0, max: 20, onChange }), 'Increase Test value');
    expect(plus).toBeDefined();
    pointerDown(plus!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_DELAY_MS + NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 4);
    pointerUp(plus!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never emits a value below min, even when held', () => {
    const onChange = vi.fn();
    const minus = button(renderStepper({ value: 0, min: 0, max: 20, onChange }), 'Decrease Test value');
    expect(minus).toBeDefined();
    pointerDown(minus!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_DELAY_MS + NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 4);
    pointerUp(minus!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves by exactly the declared subunit step when the field step is 0.5', () => {
    const up = vi.fn();
    const plus = button(renderStepper({ value: 23.5, step: 0.5, min: 1, max: 60, onChange: up }), 'Increase Test value');
    expect(plus).toBeDefined();
    pointerDown(plus!);
    expect(up).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledWith(24);

    const down = vi.fn();
    const minus = button(renderStepper({ value: 24, step: 0.5, min: 1, max: 60, onChange: down }), 'Decrease Test value');
    expect(minus).toBeDefined();
    pointerDown(minus!);
    expect(down).toHaveBeenCalledTimes(1);
    expect(down).toHaveBeenCalledWith(23.5);
  });

  it('commits exactly once on a short press and does not repeat after release', () => {
    const onChange = vi.fn();
    const plus = button(renderStepper({ value: 12, onChange }), 'Increase Test value');
    expect(plus).toBeDefined();
    pointerDown(plus!);
    pointerUp(plus!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_DELAY_MS + NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 5);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('repeats while held after a short delay, and releasing stops the repeat', () => {
    const onChange = vi.fn();
    const plus = button(renderStepper({ value: 12, onChange }), 'Increase Test value');
    expect(plus).toBeDefined();
    pointerDown(plus!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_DELAY_MS - 1);
    expect(onChange).toHaveBeenCalledTimes(1); // the press step only — no repeat before the delay
    vi.advanceTimersByTime(1 + NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 2);
    const held = onChange.mock.calls.length;
    expect(held).toBeGreaterThanOrEqual(3);
    pointerUp(plus!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 10);
    expect(onChange).toHaveBeenCalledTimes(held);
  });

  it('stops the repeat when the pointer press is cancelled', () => {
    const onChange = vi.fn();
    const plus = button(renderStepper({ value: 12, onChange }), 'Increase Test value');
    expect(plus).toBeDefined();
    pointerDown(plus!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_DELAY_MS + NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 2);
    const held = onChange.mock.calls.length;
    (plus!.props as { onPointerCancel: () => void }).onPointerCancel();
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 10);
    expect(onChange).toHaveBeenCalledTimes(held);
  });

  it('renders a keyboard-editable text field with no native spinner affordance', () => {
    const onChange = vi.fn();
    const field = input(renderStepper({ value: 12, onChange }));
    expect(field).toBeDefined();
    expect(field!.props.type).toBe('text');
    expect(field!.props.type).not.toBe('number');
    expect(field!.props['aria-label']).toBe('Test value');
    expect(field!.props.value).toBe('12');

    // Blur commits through the clamp + step-rounding path.
    (field!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: '18' } });
    expect(onChange).toHaveBeenCalledWith(18);
  });

  it('commits on Enter and reverts on Escape', () => {
    const onChange = vi.fn();
    const field = input(renderStepper({ value: 12, onChange }));
    expect(field).toBeDefined();
    const blur = vi.fn();
    (field!.props as { onKeyDown: (event: unknown) => void }).onKeyDown({ key: 'Enter', currentTarget: { value: '19', blur } });
    expect(onChange).toHaveBeenCalledWith(19);
    expect(blur).toHaveBeenCalled();

    const reverted = vi.fn();
    const escaped = input(renderStepper({ value: 12, onChange: reverted }));
    expect(escaped).toBeDefined();
    const escapeTarget = { value: '99', blur: vi.fn() };
    (escaped!.props as { onKeyDown: (event: unknown) => void }).onKeyDown({ key: 'Escape', currentTarget: escapeTarget });
    expect(escapeTarget.value).toBe('12');
    expect(reverted).not.toHaveBeenCalled();
  });

  it('clamps a typed out-of-range value and rejects unparseable text with a revert to the pre-edit value', () => {
    const clamped = vi.fn();
    const typed = input(renderStepper({ value: 12, max: 20, onChange: clamped }));
    expect(typed).toBeDefined();
    (typed!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: '99' } });
    expect(clamped).toHaveBeenCalledWith(20);

    // 260924-ffd Pin 6 (locked decision): garbage rejects AND reverts the
    // field to the pre-edit display text — no commit, no blanked input.
    const ignored = vi.fn();
    const garbage = input(renderStepper({ value: 12, onChange: ignored }));
    expect(garbage).toBeDefined();
    const garbageTarget = { value: 'abc' };
    (garbage!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: garbageTarget });
    expect(ignored).not.toHaveBeenCalled();
    expect(garbageTarget.value).toBe('12');
  });

  it('renders both buttons always, as first-class pointer targets', () => {
    const tree = renderStepper({});
    const buttons = findAll(tree, (vnode) => vnode.type === 'button');
    expect(buttons).toHaveLength(2);
    for (const target of buttons) {
      expect(typeof target.props.onPointerDown).toBe('function');
      expect(typeof target.props.onPointerUp).toBe('function');
      expect(target.props.type).toBe('button');
      // Always visible: never gated behind hover/opacity/visibility rules.
      expect(String(target.props.class ?? '')).not.toMatch(/hidden|opacity-0/);
    }
    expect(String(buttons[0].props['aria-label'])).toContain('Decrease Test value');
    expect(String(buttons[1].props['aria-label'])).toContain('Increase Test value');
  });

  it('disables both buttons and the field when disabled', () => {
    const onChange = vi.fn();
    const tree = renderStepper({ disabled: true, onChange });
    const plus = button(tree, 'Increase Test value');
    expect(plus).toBeDefined();
    expect(plus!.props.disabled).toBe(true);
    const field = input(tree);
    expect(field!.props.disabled).toBe(true);
    pointerDown(plus!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_DELAY_MS + NUMERIC_STEPPER_REPEAT_INTERVAL_MS);
    expect(onChange).not.toHaveBeenCalled();
  });
});

/**
 * 260924-d6l — constraint-injection contract pins.
 *
 * The 260923-bcm grain-scale exception (variable step + free typed entry) must
 * live ONLY on the paper grain field. These pins lock the contract before any
 * production edit:
 *
 * - Pin 1: a classic field given only value/step/min/max moves by exactly its
 *   declared step — including at values inside the grain band ]0.5, 2.0[, where
 *   an escaped adaptive policy would emit a band jump — and typed commits snap
 *   to the field's grid (never free entry).
 * - Pin 2: the grain field's exact option shape resolves its step from the LIVE
 *   value on every emission and keeps free, comma-tolerant typed entry inside
 *   the shared grain bounds (the shipped 260923-bcm rule: 0.5 strictly inside
 *   ]0.5, 2.0[, 0.1 at/below 0.5 and at/above 2.0).
 * - Pin 3 (in numericStepperSweep below): the exception-option identifiers
 *   appear only at the paper-grain call site.
 */
describe('260924-d6l — constraint-injection contract pins', () => {
  it('Pin 1: a classic constant-step field moves by exactly its step inside the grain band', () => {
    // + at 1.00 (deliberately inside the grain band) must be 1.01, not a 0.5 band jump.
    const up = vi.fn();
    const plus = button(renderStepper({ value: 1, step: 0.01, min: 0, max: 2, onChange: up }), 'Increase Test value');
    expect(plus).toBeDefined();
    pointerDown(plus!);
    expect(up).toHaveBeenCalledTimes(1);
    expect(up.mock.calls[0][0]).toBe(1.01);

    // − at 1.00 must be 0.99.
    const down = vi.fn();
    const minus = button(renderStepper({ value: 1, step: 0.01, min: 0, max: 2, onChange: down }), 'Decrease Test value');
    expect(minus).toBeDefined();
    pointerDown(minus!);
    expect(down).toHaveBeenCalledTimes(1);
    expect(down.mock.calls[0][0]).toBe(0.99);

    // + at 0.50 (the band edge) must be 0.51, not a band jump.
    const edge = vi.fn();
    const edgePlus = button(renderStepper({ value: 0.5, step: 0.01, min: 0, max: 2, onChange: edge }), 'Increase Test value');
    expect(edgePlus).toBeDefined();
    pointerDown(edgePlus!);
    expect(edge).toHaveBeenCalledTimes(1);
    expect(edge.mock.calls[0][0]).toBe(0.51);
  });

  it('Pin 1: typed commits snap to the classic field grid — never free entry', () => {
    // Step-1 field (Rot-like): "45.5" commits 46.
    const rot = vi.fn();
    const stepOne = input(renderStepper({ value: 45, step: 1, min: 0, max: 60, onChange: rot }));
    expect(stepOne).toBeDefined();
    (stepOne!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: '45.5' } });
    expect(rot).toHaveBeenCalledTimes(1);
    expect(rot.mock.calls[0][0]).toBe(46);

    // Step-0.01 field (Scale-like): "1.2345" commits 1.23 — snapped, not free.
    const scale = vi.fn();
    const stepHundredth = input(renderStepper({ value: 1, step: 0.01, min: 0, max: 2, onChange: scale }));
    expect(stepHundredth).toBeDefined();
    (stepHundredth!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: '1.2345' } });
    expect(scale).toHaveBeenCalledTimes(1);
    expect(scale.mock.calls[0][0]).toBe(1.23);
  });

  /** The grain element's exact option shape (PhysicsPaintTopBar grain field). */
  function renderGrainStepper(value: number, onChange: (next: number) => void): unknown {
    return renderStepper({
      value,
      onChange,
      step: grainScaleStep(value),
      resolveStep: grainScaleStep,
      freeEntry: true,
      min: GRAIN_SCALE_MIN,
      max: GRAIN_SCALE_MAX,
    });
  }

  it('Pin 2: the grain option shape resolves the step from the live value on every press', () => {
    // + at 1.0 → 1.5 (interior band: 0.5)
    const upFromOne = vi.fn();
    const plusOne = button(renderGrainStepper(1, upFromOne), 'Increase Test value');
    expect(plusOne).toBeDefined();
    pointerDown(plusOne!);
    expect(upFromOne).toHaveBeenCalledTimes(1);
    expect(upFromOne.mock.calls[0][0]).toBe(1.5);

    // + at 1.5 → 2.0 (still interior: 0.5)
    const upFromOneHalf = vi.fn();
    const plusOneHalf = button(renderGrainStepper(1.5, upFromOneHalf), 'Increase Test value');
    expect(plusOneHalf).toBeDefined();
    pointerDown(plusOneHalf!);
    expect(upFromOneHalf).toHaveBeenCalledTimes(1);
    expect(upFromOneHalf.mock.calls[0][0]).toBe(2);

    // + at 2.0 → 2.1 (edge: 0.1 — re-resolved from the live value, not the press-start step)
    const upFromTwo = vi.fn();
    const plusTwo = button(renderGrainStepper(2, upFromTwo), 'Increase Test value');
    expect(plusTwo).toBeDefined();
    pointerDown(plusTwo!);
    expect(upFromTwo).toHaveBeenCalledTimes(1);
    expect(upFromTwo.mock.calls[0][0]).toBe(2.1);

    // − at 1.5 → 1.0 (interior: 0.5)
    const downFromOneHalf = vi.fn();
    const minusOneHalf = button(renderGrainStepper(1.5, downFromOneHalf), 'Decrease Test value');
    expect(minusOneHalf).toBeDefined();
    pointerDown(minusOneHalf!);
    expect(downFromOneHalf).toHaveBeenCalledTimes(1);
    expect(downFromOneHalf.mock.calls[0][0]).toBe(1);

    // − at 0.5 → 0.4 (edge: 0.1)
    const downFromHalf = vi.fn();
    const minusHalf = button(renderGrainStepper(0.5, downFromHalf), 'Decrease Test value');
    expect(minusHalf).toBeDefined();
    pointerDown(minusHalf!);
    expect(downFromHalf).toHaveBeenCalledTimes(1);
    expect(downFromHalf.mock.calls[0][0]).toBe(0.4);
  });

  it('Pin 2: grain typed commits stay free, comma-tolerant, and clamped to the shared bounds', () => {
    // "1.3" stays 1.3 — free entry, no grid snap to 1.5.
    const free = vi.fn();
    const freeField = input(renderGrainStepper(1, free));
    expect(freeField).toBeDefined();
    (freeField!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: '1.3' } });
    expect(free).toHaveBeenCalledTimes(1);
    expect(free.mock.calls[0][0]).toBe(1.3);

    // "2,2" (decimal comma) commits 2.2.
    const comma = vi.fn();
    const commaField = input(renderGrainStepper(2, comma));
    expect(commaField).toBeDefined();
    (commaField!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: '2,2' } });
    expect(comma).toHaveBeenCalledTimes(1);
    expect(comma.mock.calls[0][0]).toBe(2.2);

    // "0" clamps to the shared lower grain bound.
    const clamped = vi.fn();
    const clampedField = input(renderGrainStepper(1, clamped));
    expect(clampedField).toBeDefined();
    (clampedField!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: '0' } });
    expect(clamped).toHaveBeenCalledTimes(1);
    expect(clamped.mock.calls[0][0]).toBe(GRAIN_SCALE_MIN);
  });
});

/**
 * D-23/D-24 adoption contract: the numeric-stepper sweep.
 *
 * Source-scan contract (same file-reading idiom as
 * `efx-paint/efxPaintCleanBreakContract.test.ts`): every swept component must
 * render its numeric fields through the shared `− [field] +` treatment, and no
 * raw native numeric input may reappear on a swept surface. The scan list is
 * asserted by length so a future narrowing shows up as a changed assertion
 * rather than a silent pass (T-52.2-10).
 *
 * `.test.tsx` paths are excluded from the scan: this file owns the pattern
 * strings, so its own text must never be scanned.
 */
const APP_ROOT = resolve(__dirname, '../../..');

const SWEPT_COMPONENT_PATHS = [
  'src/components/sequence/KeyPhotoStrip.tsx',
  'src/components/sidebar/PaintProperties.tsx',
  'src/components/sidebar/InlineColorPicker.tsx',
  'src/components/shared/ColorPickerModal.tsx',
  'src/components/physic-paint/view/PhysicsPaintTopBar.tsx',
  'src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx',
];

/** The Studio workflow strip fps field declares FPS_PRESETS preset mode (260924-ffd; D-24 fps 0.5 OBSOLETE). */
const STUDIO_FPS_ARIA_LABEL = 'Cached Roto playback frames per second';

/** The raw native numeric input element this sweep retires (D-23). */
const RAW_NATIVE_NUMERIC_INPUT = /type="number"/;

/** The shared treatment a swept file must reference. */
const SHARED_STEPPER_REFERENCE = /NumericStepper|NumericInput/;

function readSweptSource(relPath: string): string {
  return readFileSync(resolve(APP_ROOT, relPath), 'utf8');
}

/** Every `<NumericStepper ... />` element rendered by a swept file. */
function stepperElements(source: string): string[] {
  return source.match(/<NumericStepper[\s\S]*?\/>/g) ?? [];
}

/** The sole allowed consumer of the exception options (260924-d6l Pin 3). */
const GRAIN_CALL_SITE_REL = 'src/components/physic-paint/view/PhysicsPaintTopBar.tsx';

/** The opt-in exception-option identifiers the paper grain field alone may pass. */
const EXCEPTION_OPTION_IDENTIFIER = /\b(resolveStep|freeEntry)\b/;

/** A file instantiating the shared stepper or its drag-to-scrub wrapper. */
const STEPPER_CALL_SITE = /<NumericStepper\b|<NumericInput\b/;

/** Recursive `src` walk: every non-test `.tsx` file, as `src/...` relative paths. */
function listSourceTsx(dir: string, baseRel: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = `${baseRel}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...listSourceTsx(resolve(dir, entry.name), rel));
    } else if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      found.push(rel);
    }
  }
  return found;
}

/** Every non-test `.tsx` file under `src` with a NumericStepper/NumericInput JSX tag. */
function stepperCallSites(): string[] {
  return listSourceTsx(resolve(APP_ROOT, 'src'), 'src').filter((relPath) =>
    STEPPER_CALL_SITE.test(readSweptSource(relPath)),
  );
}

describe('numericStepperSweep', () => {
  const scannedPaths = SWEPT_COMPONENT_PATHS.filter((relPath) => !/\.test\.tsx$/.test(relPath));

  it('scans the expected swept component list', () => {
    expect(SWEPT_COMPONENT_PATHS.filter((relPath) => /\.test\.tsx$/.test(relPath))).toEqual([]);
    expect(scannedPaths).toHaveLength(6);
  });

  it('leaves no raw native numeric input on a swept surface', () => {
    const offenders = scannedPaths.filter((relPath) =>
      RAW_NATIVE_NUMERIC_INPUT.test(readSweptSource(relPath)),
    );
    expect(
      offenders,
      `Raw native numeric input reintroduced — render through NumericStepper instead:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('renders every swept file through the shared stepper treatment', () => {
    const missing = scannedPaths.filter(
      (relPath) => !SHARED_STEPPER_REFERENCE.test(readSweptSource(relPath)),
    );
    expect(
      missing,
      `Swept file no longer renders through NumericStepper/NumericInput:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('declares an explicit step or presets on every NumericStepper element in a swept file', () => {
    const offenders: string[] = [];
    for (const relPath of scannedPaths) {
      for (const element of stepperElements(readSweptSource(relPath))) {
        if (!/step=\{|presets=\{/.test(element)) offenders.push(`${relPath}: ${element.replace(/\s+/g, ' ')}`);
      }
    }
    expect(
      offenders,
      `A swept field lost its own constraint declaration (step for classic fields, presets for preset menus):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('Pin 5: the Studio fps field declares presets and no longer the obsolete D-24 step 0.5', () => {
    const relPath = 'src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx';
    const source = readSweptSource(relPath);
    const fps = stepperElements(source).find((element) =>
      element.includes(`ariaLabel="${STUDIO_FPS_ARIA_LABEL}"`),
    );
    expect(fps, `No NumericStepper for "${STUDIO_FPS_ARIA_LABEL}" in ${relPath}`).toBeDefined();
    expect(fps, 'The fps field must declare presets (260924-ffd)').toMatch(/presets=\{/);
    expect(fps, 'The fps field must not keep the obsolete D-24 step 0.5').not.toMatch(/step=\{0\.5\}/);
    expect(source, 'The strip must import the shared FPS_PRESETS list').toContain('FPS_PRESETS');
  });

  it('scopes the exception options (resolveStep/freeEntry) to the paper-grain call site only', () => {
    const offenders = stepperCallSites().filter(
      (relPath) =>
        relPath !== GRAIN_CALL_SITE_REL &&
        EXCEPTION_OPTION_IDENTIFIER.test(readSweptSource(relPath)),
    );
    // Positive control: the scan must actually see the grain call site, so an
    // empty offender list can never come from a silently-empty candidate set.
    expect(
      stepperCallSites(),
      'The call-site scan did not find the paper-grain NumericStepper element',
    ).toContain(GRAIN_CALL_SITE_REL);
    expect(
      offenders,
      `Exception options (resolveStep/freeEntry) leaked outside the paper-grain call site —\n` +
        `they are opt-in per call site; omit them for the classic constant-step contract:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * 260924-ffd — the three-tier numeric-stepper contract.
 *
 * - Classic default: a stepper given only value/onChange/ariaLabel (no step,
 *   no presets) moves by exactly ±1 with an integer display.
 * - Preset mode: a first-class `presets` menu walks list entries only, ends
 *   clamp with visibly disabled buttons, typed commits snap nearest-ties-low,
 *   off-list live values display as-is until the first +/− which snaps in the
 *   direction of travel. Supersedes D-24 (fps step 0.5 → OBSOLETE).
 * - Two-tier fps law: PROJECT fps (Settings / New Project) and STUDIO playback
 *   fps (workflow strip) never cross-write — proven by source scan.
 *
 * These pins are RED-first: they must fail before the Task 2 production edit
 * and go green with it (RED-EVIDENCE.json records the honest failing output).
 */
describe('260924-ffd — classic default + fps preset contract pins', () => {
  /** The exact preset list from the plan (ascending — part of the contract). */
  const FPS_WALK = [6, 12, 15, 24, 25, 50, 60] as const;

  type BareOverrides = {
    value?: number;
    onChange?: (next: number) => void;
    presets?: readonly number[];
  };

  /** Bare stepper: only value/onChange/ariaLabel (+ optional presets) — no step, no min/max. */
  function renderBareStepper(overrides: BareOverrides = {}): unknown {
    return materialize(
      NumericStepper({
        value: 12,
        onChange: () => {},
        ariaLabel: 'Test value',
        ...overrides,
      } as unknown as StepperProps),
    );
  }

  /** The fps preset call-site shape: presets, no step. */
  function renderPresetStepper(overrides: BareOverrides = {}): unknown {
    return renderBareStepper({ presets: FPS_WALK, ...overrides });
  }

  it('Pin 1: classic default — no step, no presets steps by exactly ±1 with an integer display', () => {
    const up = vi.fn();
    const plus = button(renderBareStepper({ value: 12, onChange: up }), 'Increase Test value');
    expect(plus).toBeDefined();
    pointerDown(plus!);
    expect(up).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledWith(13);

    const down = vi.fn();
    const minus = button(renderBareStepper({ value: 12, onChange: down }), 'Decrease Test value');
    expect(minus).toBeDefined();
    pointerDown(minus!);
    expect(down).toHaveBeenCalledTimes(1);
    expect(down).toHaveBeenCalledWith(11);

    // Integer display for the default: no decimal point in the field.
    const field = input(renderBareStepper({ value: 12 }));
    expect(field).toBeDefined();
    expect(field!.props.value).toBe('12');
    expect(String(field!.props.value)).not.toContain('.');
  });

  it('Pin 2: preset walk — list entries only, integer display, ends visibly disabled with refusing handlers', () => {
    // + from 24: 25 then 50 — never 24.5 or 30.
    const up25 = vi.fn();
    const plus24 = button(renderPresetStepper({ value: 24, onChange: up25 }), 'Increase Test value');
    expect(plus24).toBeDefined();
    pointerDown(plus24!);
    expect(up25).toHaveBeenCalledTimes(1);
    expect(up25).toHaveBeenCalledWith(25);

    const up50 = vi.fn();
    const plus25 = button(renderPresetStepper({ value: 25, onChange: up50 }), 'Increase Test value');
    expect(plus25).toBeDefined();
    pointerDown(plus25!);
    expect(up50).toHaveBeenCalledTimes(1);
    expect(up50).toHaveBeenCalledWith(50);

    // − from 24: 15 then 12.
    const down15 = vi.fn();
    const minus24 = button(renderPresetStepper({ value: 24, onChange: down15 }), 'Decrease Test value');
    expect(minus24).toBeDefined();
    pointerDown(minus24!);
    expect(down15).toHaveBeenCalledTimes(1);
    expect(down15).toHaveBeenCalledWith(15);

    const down12 = vi.fn();
    const minus15 = button(renderPresetStepper({ value: 15, onChange: down12 }), 'Decrease Test value');
    expect(minus15).toBeDefined();
    pointerDown(minus15!);
    expect(down12).toHaveBeenCalledTimes(1);
    expect(down12).toHaveBeenCalledWith(12);

    // Integer display forced in preset mode.
    const field = input(renderPresetStepper({ value: 24 }));
    expect(field).toBeDefined();
    expect(field!.props.value).toBe('24');
    expect(String(field!.props.value)).not.toContain('.');

    // At 60: the + button is visibly disabled at render AND the handler refuses.
    const atEndUp = vi.fn();
    const endTree = renderPresetStepper({ value: 60, onChange: atEndUp });
    const plusEnd = button(endTree, 'Increase Test value');
    expect(plusEnd).toBeDefined();
    expect(plusEnd!.props.disabled).toBe(true);
    pointerDown(plusEnd!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_DELAY_MS + NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 3);
    expect(atEndUp).not.toHaveBeenCalled();

    // At 6: the − button is visibly disabled at render AND the handler refuses.
    const atStartDown = vi.fn();
    const startTree = renderPresetStepper({ value: 6, onChange: atStartDown });
    const minusStart = button(startTree, 'Decrease Test value');
    expect(minusStart).toBeDefined();
    expect(minusStart!.props.disabled).toBe(true);
    pointerDown(minusStart!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_DELAY_MS + NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 3);
    expect(atStartDown).not.toHaveBeenCalled();
  });

  it('Pin 3: typed commit snaps nearest-ties-low; an off-list value displays as-is then snaps by direction of travel', () => {
    // Nearest-entry snap, ties toward the lower entry.
    const typedCases: Array<[string, number]> = [
      ['30', 25],
      ['5', 6],
      ['999', 60],
      ['24.5', 24],
    ];
    for (const [typed, expected] of typedCases) {
      const onChange = vi.fn();
      const field = input(renderPresetStepper({ value: 24, onChange }));
      expect(field).toBeDefined();
      (field!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: typed } });
      expect(onChange, `typed "${typed}"`).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0], `typed "${typed}"`).toBe(expected);
    }

    // Off-list live value displays as-is after render — no snap on render.
    const offList = input(renderPresetStepper({ value: 30 }));
    expect(offList).toBeDefined();
    expect(offList!.props.value).toBe('30');

    // First press snaps to the nearest entry in the direction of travel.
    const up = vi.fn();
    const plus = button(renderPresetStepper({ value: 30, onChange: up }), 'Increase Test value');
    expect(plus).toBeDefined();
    pointerDown(plus!);
    expect(up).toHaveBeenCalledTimes(1);
    expect(up.mock.calls[0][0]).toBe(50);

    const down = vi.fn();
    const minus = button(renderPresetStepper({ value: 30, onChange: down }), 'Decrease Test value');
    expect(minus).toBeDefined();
    pointerDown(minus!);
    expect(down).toHaveBeenCalledTimes(1);
    expect(down.mock.calls[0][0]).toBe(25);
  });

  const STRIP_REL = 'src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx';
  const PLAYBACK_HOOK_REL = 'src/components/physic-paint/hooks/useRotoCachedPlayback.ts';
  const SETTINGS_REL = 'src/components/views/SettingsView.tsx';
  const NEW_PROJECT_REL = 'src/components/project/NewProjectDialog.tsx';

  it('Pin 4: the Studio playback fps chain never references projectStore', () => {
    expect(readSweptSource(STRIP_REL)).not.toContain('projectStore');
    expect(readSweptSource(PLAYBACK_HOOK_REL)).not.toContain('projectStore');
  });

  it('Pin 4: no file under physic-paint calls projectStore.setFps', () => {
    // Recursive scan over every .ts/.tsx under physic-paint (test files too —
    // an import reference would be a coupling smell as well).
    function listSourceFiles(dir: string): string[] {
      const found: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) found.push(...listSourceFiles(full));
        else if (entry.isFile() && /\.tsx?$/.test(entry.name)) found.push(full);
      }
      return found;
    }
    const physicPaintRoot = resolve(APP_ROOT, 'src/components/physic-paint');
    const files = listSourceFiles(physicPaintRoot);
    // Positive control: the scan must actually see files, so an empty offender
    // list can never come from a silently-empty candidate set.
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('projectStore.setFps'));
    expect(
      offenders.map((file) => file.replace(`${APP_ROOT}/`, '')),
      'The STUDIO playback tier must never write the PROJECT fps store (two-tier isolation)',
    ).toEqual([]);
  });

  it('Pin 4: the Settings Frame Rate control binds projectStore.setFps through the shared preset stepper', () => {
    const source = readSweptSource(SETTINGS_REL);
    expect(source).toContain('projectStore.setFps');
    expect(source, 'Settings must import the shared FPS_PRESETS list').toContain('FPS_PRESETS');
    expect(source, 'Settings Frame Rate must render the shared preset stepper').toMatch(/<NumericStepper/);
    expect(source, 'the inline [15, 24] button row must be gone').not.toMatch(/\[15,\s*24\]/);
  });

  it('Pin 4: the New Project Frame Rate control binds local fps state through the shared preset stepper (never projectStore.setFps)', () => {
    const source = readSweptSource(NEW_PROJECT_REL);
    expect(source, 'New Project seeds the project store via createProject, never setFps directly').not.toContain(
      'projectStore.setFps',
    );
    expect(source, 'New Project must import the shared FPS_PRESETS list').toContain('FPS_PRESETS');
    expect(source, 'the fps seed default stays 24 (locked decision)').toContain('useState(24)');
    expect(source, 'the inline 15/24 fps pills must be gone').not.toContain('setFps(15)');
    expect(source, 'the inline 15/24 fps pills must be gone').not.toContain('setFps(24)');
    expect(source, 'New Project Frame Rate must render the shared preset stepper').toMatch(
      /ariaLabel="Frame Rate"/,
    );
  });

  it('Hold-end coalescing: a preset hold that reaches the list end stops coalescing so the next action is its own undo entry', () => {
    resetHistory();

    // Walk to the end with a short press: 50 → 60.
    const walk = vi.fn();
    const plusAt50 = button(renderPresetStepper({ value: 50, onChange: walk }), 'Increase Test value');
    expect(plusAt50).toBeDefined();
    pointerDown(plusAt50!);
    pointerUp(plusAt50!);
    expect(walk).toHaveBeenCalledTimes(1);
    expect(walk).toHaveBeenCalledWith(60);

    // Hold + at the end (the app has re-rendered with value=60): the press
    // must be refused at the disabled end, and no emission may escape even
    // while the hold timers run.
    const atEnd = vi.fn();
    const plusAt60 = button(renderPresetStepper({ value: 60, onChange: atEnd }), 'Increase Test value');
    expect(plusAt60).toBeDefined();
    expect(plusAt60!.props.disabled).toBe(true);
    pointerDown(plusAt60!);
    vi.advanceTimersByTime(NUMERIC_STEPPER_REPEAT_DELAY_MS + NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 3);
    // Deliberately NO pointerUp: a button disabled mid-hold would swallow the
    // release in the DOM, so cleanup inside the press path is the only thing
    // that can keep module-global coalescing from stranding.
    expect(atEnd).not.toHaveBeenCalled();

    // An unrelated action after the ended hold must create its OWN undo entry
    // (coalescing not stranded, no cross-action merge).
    const entry = (n: number): HistoryEntry => ({
      id: `ffd-${n}`,
      description: `unrelated action ${n}`,
      timestamp: n,
      undo: () => {},
      redo: () => {},
    });
    pushAction(entry(1));
    pushAction(entry(2));
    expect(historyStore.stack.value).toHaveLength(2);
    resetHistory();
  });
});
