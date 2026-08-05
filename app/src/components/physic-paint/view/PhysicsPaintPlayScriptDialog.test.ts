import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Node-environment component harness: preact/hooks is mocked with a cursor-based runtime
// (same approach as PhysicsPaintStyledTooltip.test.ts) so the dialog function can be invoked
// directly and its vnode tree inspected. No DOM is involved; event handler props are invoked
// with fake events.
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  refs: new Map<number, { current: unknown }>(),
  cursor: 0,
  reset() {
    this.values = [];
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
  useState: <Value>(initial: Value | (() => Value)) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === 'function' ? (initial as () => Value)() : initial;
    return [hooks.values[index] as Value, (next: Value | ((current: Value) => Value)) => {
      hooks.values[index] = typeof next === 'function'
        ? (next as (current: Value) => Value)(hooks.values[index] as Value)
        : next;
    }] as const;
  },
}));

// The real InlineColorPicker module instantiates a Tauri LazyStore at import time
// (paintPreferences), which cannot load in the node test environment. The dialog contract only
// needs the component identity and its props — the picker's own rendering is out of scope here.
vi.mock('../../sidebar/InlineColorPicker', () => ({ InlineColorPicker: () => null }));

import { PhysicsPaintPlayScriptDialog } from './PhysicsPaintPlayScriptDialog';
import { InlineColorPicker } from '../../sidebar/InlineColorPicker';
import type { RotoPlayScriptController, RotoPlayScriptMode } from '../roto/physicsPaintRotoPlayScriptController';

const source = readFileSync(fileURLToPath(new URL('./PhysicsPaintPlayScriptDialog.tsx', import.meta.url)), 'utf8');

interface TestVNode {
  type: unknown;
  props: Record<string, unknown>;
}

function sig<Value>(value: Value): { value: Value } {
  return { value };
}

interface FakeControllerSeed {
  mode?: RotoPlayScriptMode;
  countText?: string;
  repeatText?: string;
  infinity?: boolean;
  repeatError?: string | null;
  loopReadout?: string | null;
  error?: string | null;
  progress?: { completed: number; total: number } | null;
  canCancel?: boolean;
  validationError?: string | null;
  phase?: string;
}

// Fake controller harness exposing the exact 42-02 interface — plain { value } cells stand in
// for signals (the dialog only ever reads/writes .value); re-renders are invoked manually.
function createFakeController(seed: FakeControllerSeed = {}) {
  const signals = {
    confirmationOpen: sig(true),
    countText: sig(seed.countText ?? 'Max'),
    capacity: sig(4),
    mode: sig<RotoPlayScriptMode>(seed.mode ?? 'progressive'),
    overrideColor: sig<string | null>(null),
    overrideEnabled: sig(false),
    dialogMotion: sig({ deformation: 25, position: 40 }),
    repeatText: sig(seed.repeatText ?? '1'),
    infinity: sig(seed.infinity ?? false),
    lastFiniteRepeat: sig('1'),
    layerEndExclusive: sig<number | null>(8),
    parsedRepeat: sig<{ count: number | null; error: string | null }>({ count: 1, error: null }),
    repeatError: sig<string | null>(seed.repeatError ?? null),
    loopReadout: sig<string | null>(seed.loopReadout ?? null),
    destinationRange: sig<string | null>('F4–F7'),
    validationError: sig<string | null>(seed.validationError ?? null),
    disabledReason: sig<string | null>(null),
    phase: sig(seed.phase ?? 'idle'),
    progress: sig<{ completed: number; total: number } | null>(seed.progress ?? null),
    status: sig<string | null>(null),
    error: sig<string | null>(seed.error ?? null),
    canCancel: sig(seed.canCancel ?? false),
  };
  const controller = {
    ...signals,
    appliedSummary: {
      line1: sig('Progressive · Original colors · Motion 25/40'),
      line2: sig('No frames generated yet'),
    },
    openConfirmation: vi.fn(async () => {}),
    closeConfirmation: vi.fn(),
    confirm: vi.fn(async () => true),
    cancel: vi.fn(),
    setInfinity: vi.fn(),
    resetDialogMotion: vi.fn(),
    dispose: vi.fn(),
  } as unknown as RotoPlayScriptController;
  return { controller, signals };
}

function renderDialog(controller: RotoPlayScriptController): TestVNode {
  hooks.cursor = 0;
  const tree = PhysicsPaintPlayScriptDialog({ playScript: controller, returnFocusRef: { current: null } });
  if (!tree) throw new Error('Dialog did not render (confirmationOpen false?)');
  return tree as unknown as TestVNode;
}

function childrenOf(vnode: TestVNode): unknown[] {
  const children = vnode.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
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

function findOne(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode {
  const found = findAll(root, predicate);
  expect(found).toHaveLength(1);
  return found[0];
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(childrenOf(node as TestVNode));
}

function hasClass(vnode: TestVNode, name: string): boolean {
  return String(vnode.props?.class ?? '').split(/\s+/).includes(name);
}

function handler(vnode: TestVNode, name: string): (...args: unknown[]) => unknown {
  const fn = vnode.props[name];
  expect(typeof fn).toBe('function');
  return fn as (...args: unknown[]) => unknown;
}

const byId = (id: string) => (vnode: TestVNode) => vnode.props?.id === id;
const byClass = (name: string) => (vnode: TestVNode) => hasClass(vnode, name);

beforeEach(() => {
  hooks.reset();
});

describe('PhysicsPaintPlayScriptDialog mode segmented control (D-05, PLAY-03)', () => {
  it('renders a radiogroup with two radio options, roving tabindex, and the helper line', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const group = findOne(tree, (vnode) => vnode.props?.role === 'radiogroup');
    expect(group.props['aria-describedby']).toBe('physics-play-script-mode-helper');
    const radios = findAll(tree, (vnode) => vnode.props?.role === 'radio');
    expect(radios).toHaveLength(2);
    expect(textOf(radios[0])).toBe('Progressive');
    expect(textOf(radios[1])).toBe('Static / Hold');
    expect(radios[0].props['aria-checked']).toBe(true);
    expect(radios[0].props.tabIndex).toBe(0);
    expect(radios[1].props['aria-checked']).toBe(false);
    expect(radios[1].props.tabIndex).toBe(-1);
    expect(textOf(findOne(tree, byId('physics-play-script-mode-helper')))).toBe('The drawing builds stroke by stroke across frames.');
  });

  it('arrow keys move focus AND check with wrap-around', () => {
    const { controller, signals } = createFakeController();
    let tree = renderDialog(controller);
    const radioElements = [{ focus: vi.fn() }, { focus: vi.fn() }];
    const keydown = (key: string) => handler(findOne(tree, (vnode) => vnode.props?.role === 'radiogroup'), 'onKeyDown')({
      key,
      preventDefault: vi.fn(),
      currentTarget: { querySelectorAll: () => radioElements },
    });

    keydown('ArrowRight');
    expect(signals.mode.value).toBe('static');
    expect(radioElements[1].focus).toHaveBeenCalledTimes(1);

    tree = renderDialog(controller);
    const updated = findAll(tree, (vnode) => vnode.props?.role === 'radio');
    expect(updated[1].props['aria-checked']).toBe(true);
    expect(updated[1].props.tabIndex).toBe(0);
    expect(updated[0].props['aria-checked']).toBe(false);
    expect(updated[0].props.tabIndex).toBe(-1);
    expect(textOf(findOne(tree, byId('physics-play-script-mode-helper')))).toBe('The complete drawing is applied to every cycle frame.');

    // Wrap-around forward and backward.
    keydown('ArrowRight');
    expect(signals.mode.value).toBe('progressive');
    expect(radioElements[0].focus).toHaveBeenCalledTimes(1);
    keydown('ArrowLeft');
    expect(signals.mode.value).toBe('static');
    expect(radioElements[1].focus).toHaveBeenCalledTimes(2);
  });

  it('checks the clicked option', () => {
    const { controller, signals } = createFakeController();
    const tree = renderDialog(controller);
    const radios = findAll(tree, (vnode) => vnode.props?.role === 'radio');
    handler(radios[1], 'onClick')({ currentTarget: { focus: vi.fn() } });
    expect(signals.mode.value).toBe('static');
  });
});

describe('PhysicsPaintPlayScriptDialog frame field (D-03)', () => {
  it('switches the single shared field label between Frames and Cycle frames with the mode', () => {
    const { controller, signals } = createFakeController();
    let tree = renderDialog(controller);
    expect(textOf(findOne(tree, (vnode) => vnode.props?.for === 'physics-play-script-count'))).toBe('Frames');
    signals.mode.value = 'static';
    tree = renderDialog(controller);
    expect(textOf(findOne(tree, (vnode) => vnode.props?.for === 'physics-play-script-count'))).toBe('Cycle frames');
    // Still ONE shared input — no second field appears in Static / Hold.
    expect(findAll(tree, byId('physics-play-script-count'))).toHaveLength(1);
    expect(textOf(findOne(tree, byId('physics-play-script-help')))).toBe('Enter a positive integer or Max.');
  });

  it('renders the first-time Static / Hold defaults: cycle 1, repeat 1, infinity off (D-15)', () => {
    const { controller } = createFakeController({ mode: 'static', countText: '1', repeatText: '1', infinity: false });
    const tree = renderDialog(controller);
    expect(findOne(tree, byId('physics-play-script-count')).props.value).toBe('1');
    expect(findOne(tree, byId('physics-play-script-repeat')).props.value).toBe('1');
    expect(findOne(tree, (vnode) => vnode.props?.type === 'checkbox').props.checked).toBe(false);
  });
});

describe('PhysicsPaintPlayScriptDialog Hold Loop block (D-12/D-13)', () => {
  it('renders the controller loop readout verbatim', () => {
    const readout = 'Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip';
    const { controller } = createFakeController({ loopReadout: readout });
    const tree = renderDialog(controller);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-loop-readout')))).toBe(readout);
  });

  it('binds the repeat field aria-invalid and error span to the controller repeatError channel', () => {
    const { controller } = createFakeController({ repeatError: 'Repeat is too large for this cycle length.' });
    const tree = renderDialog(controller);
    expect(findOne(tree, byId('physics-play-script-repeat')).props['aria-invalid']).toBe(true);
    expect(textOf(findOne(tree, byId('physics-play-script-repeat-error')))).toBe('Repeat is too large for this cycle length.');
  });

  it('wires the Infinity toggle through the controller setInfinity boundary only', () => {
    const { controller, signals } = createFakeController();
    const tree = renderDialog(controller);
    const toggle = findOne(tree, (vnode) => vnode.props?.type === 'checkbox');
    handler(toggle, 'onChange')({ currentTarget: { checked: true } });
    expect(controller.setInfinity).toHaveBeenCalledTimes(1);
    expect(controller.setInfinity).toHaveBeenCalledWith(true);
    // The dialog never manipulates the infinity/lastFiniteRepeat signals directly.
    expect(signals.infinity.value).toBe(false);
    expect(signals.lastFiniteRepeat.value).toBe('1');
  });

  it('renders the repeat input disabled with its value intact while Infinity is on', () => {
    const { controller } = createFakeController({ infinity: true, repeatText: '5', loopReadout: 'Cycle 4f × ∞ · Effective: 4f' });
    const tree = renderDialog(controller);
    const repeat = findOne(tree, byId('physics-play-script-repeat'));
    expect(repeat.props.disabled).toBe(true);
    expect(repeat.props.value).toBe('5');
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-loop-readout')))).toBe('Cycle 4f × ∞ · Effective: 4f');
  });
});

describe('PhysicsPaintPlayScriptDialog color override (D-08/D-09, Pitfall 3)', () => {
  it("shows 'Original colors' by default with no override control", () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-override-swatch')))).toBe('Original colors');
    expect(findAll(tree, byClass('physics-paint-play-script-override-reset'))).toHaveLength(0);
  });

  it('opening the picker does NOT create an override — close without a pick leaves Original colors (Pitfall 3)', () => {
    const { controller, signals } = createFakeController();
    let tree = renderDialog(controller);
    handler(findOne(tree, byClass('physics-paint-play-script-override-swatch')), 'onClick')({});
    tree = renderDialog(controller);
    const picker = findOne(tree, (vnode) => vnode.type === InlineColorPicker);
    // The picker fires onChange on mount (isExternalUpdate starts false) — that is NOT a pick.
    handler(picker, 'onChange')('#112233', 1);
    expect(signals.overrideEnabled.value).toBe(false);
    expect(signals.overrideColor.value).toBe(null);
    handler(picker, 'onClose')({});
    tree = renderDialog(controller);
    expect(findAll(tree, (vnode) => vnode.type === InlineColorPicker)).toHaveLength(0);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-override-swatch')))).toBe('Original colors');
  });

  it("a deliberate pick sets the override, the swatch shows the picked hex, and the reset control returns to 'Original colors'", () => {
    const { controller, signals } = createFakeController();
    let tree = renderDialog(controller);
    handler(findOne(tree, byClass('physics-paint-play-script-override-swatch')), 'onClick')({});
    tree = renderDialog(controller);
    // A genuine user interaction inside the picker well arms the pick handler.
    const well = findOne(tree, byClass('physics-paint-play-script-picker-well'));
    handler(well, 'onPointerDownCapture')({});
    handler(findOne(tree, (vnode) => vnode.type === InlineColorPicker), 'onChange')('#a1b2c3', 1);
    expect(signals.overrideEnabled.value).toBe(true);
    expect(signals.overrideColor.value).toBe('#a1b2c3');
    tree = renderDialog(controller);
    // The picker closes on pick and the swatch shows the picked color as data.
    expect(findAll(tree, (vnode) => vnode.type === InlineColorPicker)).toHaveLength(0);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-override-swatch')))).toContain('#a1b2c3');
    const reset = findOne(tree, byClass('physics-paint-play-script-override-reset'));
    expect(textOf(reset)).toBe('Original colors');
    handler(reset, 'onClick')({});
    expect(signals.overrideEnabled.value).toBe(false);
    tree = renderDialog(controller);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-override-swatch')))).toBe('Original colors');
    expect(findAll(tree, byClass('physics-paint-play-script-override-reset'))).toHaveLength(0);
  });
});

describe('PhysicsPaintPlayScriptDialog application-time Motion controls (D-06)', () => {
  it('writes slider edits to the controller dialogMotion signals with the 0-100 clamp', () => {
    const { controller, signals } = createFakeController();
    const tree = renderDialog(controller);
    handler(findOne(tree, byId('physics-play-script-motion-deformation')), 'onInput')({ currentTarget: { value: '42' } });
    expect(signals.dialogMotion.value).toEqual({ deformation: 42, position: 40 });
    handler(findOne(tree, byId('physics-play-script-motion-position')), 'onInput')({ currentTarget: { value: '260' } });
    expect(signals.dialogMotion.value).toEqual({ deformation: 42, position: 100 });
  });

  it("'Reset to Motion defaults' calls ONLY the controller resetDialogMotion operation", () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    handler(findOne(tree, (vnode) => textOf(vnode) === 'Reset to Motion defaults'), 'onClick')({});
    expect(controller.resetDialogMotion).toHaveBeenCalledTimes(1);
    expect(textOf(tree)).not.toContain('Save as defaults');
  });
});

describe('PhysicsPaintPlayScriptDialog generation states (E5)', () => {
  it('renders a generation failure through the shared inline-error element with no progress bar and enabled controls', () => {
    const { controller } = createFakeController({ error: 'Parent rejected the Play Script batch.', progress: null, canCancel: false, phase: 'failed' });
    const tree = renderDialog(controller);
    const error = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-script-inline-error') && hasClass(vnode, 'physics-paint-play-script-dialog-error'));
    expect(textOf(error)).toBe('Parent rejected the Play Script batch.');
    expect(findAll(tree, (vnode) => vnode.type === 'progress')).toHaveLength(0);
    expect(findOne(tree, (vnode) => textOf(vnode) === 'Generate').props.disabled).toBe(false);
    expect(findOne(tree, byId('physics-play-script-count')).props.disabled).toBe(false);
    expect(findOne(tree, byId('physics-play-script-repeat')).props.disabled).toBe(false);
  });

  it('renders NO generation-error element after normal user cancellation while the dialog stays open', () => {
    const { controller } = createFakeController({ error: null, phase: 'cancelled' });
    const tree = renderDialog(controller);
    expect(findAll(tree, byClass('physics-paint-play-script-dialog-error'))).toHaveLength(0);
    expect(findOne(tree, (vnode) => vnode.props?.role === 'dialog')).toBeTruthy();
  });

  it('disables all new controls during generation under the existing canCancel rule', () => {
    const { controller } = createFakeController({ canCancel: true, progress: { completed: 1, total: 4 } });
    const tree = renderDialog(controller);
    for (const radio of findAll(tree, (vnode) => vnode.props?.role === 'radio')) {
      expect(radio.props['aria-disabled']).toBe(true);
      expect(radio.props.tabIndex).toBe(-1);
    }
    expect(findOne(tree, byId('physics-play-script-repeat')).props.disabled).toBe(true);
    expect(findOne(tree, (vnode) => vnode.props?.type === 'checkbox').props.disabled).toBe(true);
    expect(findOne(tree, byClass('physics-paint-play-script-override-swatch')).props.disabled).toBe(true);
    expect(findOne(tree, byId('physics-play-script-motion-deformation')).props.disabled).toBe(true);
    expect(textOf(tree)).toContain('Cancel generation');
  });
});

describe('PhysicsPaintPlayScriptDialog source contract (D-04/D-06, locked copy)', () => {
  it('keeps the locked copy and prohibitions in the dialog source', () => {
    expect(source).toContain('Original colors');
    expect(source).toContain('Reset to Motion defaults');
    expect(source).not.toContain('Save as defaults');
    expect(source).not.toContain('updatePanelMotion');
    expect(source).toContain('The drawing builds stroke by stroke across frames.');
    expect(source).toContain('The complete drawing is applied to every cycle frame.');
    // The picker mounts INLINE inside the dialog content column — never a popover/portal.
    expect(source).toContain('<InlineColorPicker');
    expect(source).not.toContain('createPortal');
  });
});
