/**
 * 52.2-03 (D-23/D-24): the shared `− [field] +` numeric stepper.
 *
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as PhysicsPaintTrackRow.test.tsx): the component function is invoked
 * directly and its vnodes are walked, so handlers are driven with plain event
 * objects and the hold-to-repeat lifecycle is proven with fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
