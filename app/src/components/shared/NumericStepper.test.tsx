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

  it('moves by exactly 0.5 when the field step is 0.5 (the fps field)', () => {
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

  it('clamps a typed out-of-range value and ignores unparseable text', () => {
    const clamped = vi.fn();
    const typed = input(renderStepper({ value: 12, max: 20, onChange: clamped }));
    expect(typed).toBeDefined();
    (typed!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: '99' } });
    expect(clamped).toHaveBeenCalledWith(20);

    const ignored = vi.fn();
    const garbage = input(renderStepper({ value: 12, onChange: ignored }));
    expect(garbage).toBeDefined();
    (garbage!.props as { onBlur: (event: unknown) => void }).onBlur({ currentTarget: { value: 'abc' } });
    expect(ignored).not.toHaveBeenCalled();
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

/** The Studio workflow strip keeps the fps field on a 0.5 step (D-24). */
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

  it('declares an explicit step on every NumericStepper element in a swept file', () => {
    const offenders: string[] = [];
    for (const relPath of scannedPaths) {
      for (const element of stepperElements(readSweptSource(relPath))) {
        if (!/step=\{/.test(element)) offenders.push(`${relPath}: ${element.replace(/\s+/g, ' ')}`);
      }
    }
    expect(
      offenders,
      `A swept field lost its own step (D-24: fps 0.5, everything else keeps its current step):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps the Studio fps field on a 0.5 step while other fields keep 1', () => {
    const relPath = 'src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx';
    const fps = stepperElements(readSweptSource(relPath)).find((element) =>
      element.includes(`ariaLabel="${STUDIO_FPS_ARIA_LABEL}"`),
    );
    expect(fps, `No NumericStepper for "${STUDIO_FPS_ARIA_LABEL}" in ${relPath}`).toBeDefined();
    expect(fps, 'The fps field must keep step 0.5 (D-24)').toMatch(/step=\{0\.5\}/);
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
