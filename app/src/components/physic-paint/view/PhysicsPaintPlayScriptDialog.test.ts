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

import { PhysicsPaintPlayScriptDialog } from './PhysicsPaintPlayScriptDialog';
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
  overrideEnabled?: boolean;
  repeatError?: string | null;
  loopReadout?: string | null;
  error?: string | null;
  progress?: { completed: number; total: number } | null;
  canCancel?: boolean;
  validationError?: string | null;
  phase?: string;
}

// Fake controller harness exposing the post-revision 42-05 interface — plain { value } cells
// stand in for signals (the dialog only ever reads/writes .value); re-renders are invoked
// manually. There is NO overrideColor signal: the override color resolves live from the
// brushColor prop / getBrushColor port (D-08R), never from dialog-side state.
function createFakeController(seed: FakeControllerSeed = {}) {
  const signals = {
    confirmationOpen: sig(true),
    countText: sig(seed.countText ?? 'Max'),
    capacity: sig(4),
    mode: sig<RotoPlayScriptMode>(seed.mode ?? 'progressive'),
    overrideEnabled: sig(seed.overrideEnabled ?? false),
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

function renderDialog(controller: RotoPlayScriptController, brushColor = '#103c65'): TestVNode {
  hooks.cursor = 0;
  const tree = PhysicsPaintPlayScriptDialog({ playScript: controller, brushColor, returnFocusRef: { current: null } });
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

function parentOf(root: unknown, target: TestVNode): TestVNode | null {
  for (const vnode of walk(root)) {
    if (childrenOf(vnode).includes(target)) return vnode;
  }
  return null;
}

const byId = (id: string) => (vnode: TestVNode) => vnode.props?.id === id;
const byClass = (name: string) => (vnode: TestVNode) => hasClass(vnode, name);
const byRadioGroup = (label: string) => (vnode: TestVNode) => vnode.props?.role === 'radiogroup' && vnode.props?.['aria-label'] === label;

beforeEach(() => {
  hooks.reset();
});

describe('PhysicsPaintPlayScriptDialog card-grid layout (D-16)', () => {
  it('renders Mode first, Timing and Color as sibling cards, Motion wiggle with a heading Reset defaults, then the summary bar before the footer', () => {
    const readout = 'Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip';
    const { controller } = createFakeController({ loopReadout: readout });
    const tree = renderDialog(controller);
    const content = findOne(tree, byClass('physics-paint-play-script-content'));
    const cards = childrenOf(content).filter((child): child is TestVNode =>
      typeof child === 'object' && child !== null && !Array.isArray(child) && hasClass(child as TestVNode, 'physics-paint-play-script-card'));
    expect(cards.length).toBe(4);
    // Mode card is the first-read element, full width.
    expect(hasClass(cards[0], 'physics-paint-play-script-card-mode')).toBe(true);
    expect(hasClass(cards[0], 'physics-paint-play-script-card-wide')).toBe(true);
    // Timing and Color cards are side-by-side siblings of the same body grid.
    expect(hasClass(cards[1], 'physics-paint-play-script-card-timing')).toBe(true);
    expect(hasClass(cards[2], 'physics-paint-play-script-card-color')).toBe(true);
    expect(parentOf(tree, cards[1])).toBe(content);
    expect(parentOf(tree, cards[2])).toBe(content);
    // Motion wiggle card spans full width; Reset defaults lives inside its section heading.
    expect(hasClass(cards[3], 'physics-paint-play-script-card-motion')).toBe(true);
    expect(hasClass(cards[3], 'physics-paint-play-script-card-wide')).toBe(true);
    const heading = findOne(cards[3], byClass('physics-paint-play-script-card-heading'));
    expect(textOf(heading)).toContain('Motion wiggle');
    expect(textOf(findOne(heading, (vnode) => textOf(vnode) === 'Reset defaults'))).toBe('Reset defaults');
    // Summary bar renders the controller loopReadout verbatim at the bottom of the body.
    const summaryBar = findOne(tree, byClass('physics-paint-play-script-summary-bar'));
    expect(textOf(summaryBar)).toBe(readout);
    expect(parentOf(tree, summaryBar)).toBe(content);
    // Fixed footer (progress + Cancel/Generate) stays outside the scrolling body.
    const footer = findOne(tree, byClass('physics-paint-play-script-footer'));
    expect(parentOf(tree, footer)).not.toBe(content);
    expect(textOf(findOne(footer, (vnode) => textOf(vnode) === 'Generate'))).toBe('Generate');
  });

  it('renders the summary bar with tabular-nums and renders nothing when the readout is null', () => {
    const { controller } = createFakeController({ loopReadout: 'Cycle 4f × ∞ · Effective: 4f' });
    const tree = renderDialog(controller);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-summary-bar')))).toBe('Cycle 4f × ∞ · Effective: 4f');
    const empty = renderDialog(createFakeController({ loopReadout: null }).controller);
    expect(findAll(empty, byClass('physics-paint-play-script-summary-bar'))).toHaveLength(0);
  });
});

describe('PhysicsPaintPlayScriptDialog mode segmented control (D-05, PLAY-03)', () => {
  it('renders a radiogroup with two radio options, roving tabindex, and the helper line', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const group = findOne(tree, byRadioGroup('Mode'));
    expect(group.props['aria-describedby']).toBe('physics-play-script-mode-helper');
    const radios = findAll(group, (vnode) => vnode.props?.role === 'radio');
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
    const { controller, signals } = createFakeController({ countText: '3' });
    let tree = renderDialog(controller);
    const radioElements = [{ focus: vi.fn() }, { focus: vi.fn() }];
    const keydown = (key: string) => handler(findOne(tree, byRadioGroup('Mode')), 'onKeyDown')({
      key,
      preventDefault: vi.fn(),
      currentTarget: { querySelectorAll: () => radioElements },
    });

    keydown('ArrowRight');
    expect(signals.mode.value).toBe('static');
    expect(radioElements[1].focus).toHaveBeenCalledTimes(1);

    tree = renderDialog(controller);
    const updated = findAll(findOne(tree, byRadioGroup('Mode')), (vnode) => vnode.props?.role === 'radio');
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
    const { controller, signals } = createFakeController({ countText: '3' });
    const tree = renderDialog(controller);
    const radios = findAll(findOne(tree, byRadioGroup('Mode')), (vnode) => vnode.props?.role === 'radio');
    handler(radios[1], 'onClick')({ currentTarget: { focus: vi.fn() } });
    expect(signals.mode.value).toBe('static');
  });
});

describe('PhysicsPaintPlayScriptDialog frame field (D-03 revised)', () => {
  it("switches the single shared field label between 'Frames' and 'Frames per cycle' with the mode", () => {
    const { controller, signals } = createFakeController();
    let tree = renderDialog(controller);
    expect(textOf(findOne(tree, (vnode) => vnode.props?.for === 'physics-play-script-count'))).toBe('Frames');
    signals.mode.value = 'static';
    tree = renderDialog(controller);
    expect(textOf(findOne(tree, (vnode) => vnode.props?.for === 'physics-play-script-count'))).toBe('Frames per cycle');
    // Still ONE shared input — no second field appears in Static / Hold.
    expect(findAll(tree, byId('physics-play-script-count'))).toHaveLength(1);
    expect(textOf(findOne(tree, byId('physics-play-script-help')))).toBe('Enter a positive integer or Max.');
  });

  it("normalizes 'Max' to '1' when switching to Static / Hold, on click and on arrow keys", () => {
    const { controller, signals } = createFakeController({ countText: 'Max' });
    let tree = renderDialog(controller);
    const radios = findAll(findOne(tree, byRadioGroup('Mode')), (vnode) => vnode.props?.role === 'radio');
    handler(radios[1], 'onClick')({ currentTarget: { focus: vi.fn() } });
    expect(signals.mode.value).toBe('static');
    expect(signals.countText.value).toBe('1');

    // Arrow-key path applies the same normalization.
    signals.mode.value = 'progressive';
    signals.countText.value = 'Max';
    tree = renderDialog(controller);
    handler(findOne(tree, byRadioGroup('Mode')), 'onKeyDown')({
      key: 'ArrowRight',
      preventDefault: vi.fn(),
      currentTarget: { querySelectorAll: () => [{ focus: vi.fn() }, { focus: vi.fn() }] },
    });
    expect(signals.mode.value).toBe('static');
    expect(signals.countText.value).toBe('1');

    // A numeric value is never rewritten by a mode switch.
    signals.mode.value = 'progressive';
    signals.countText.value = '6';
    tree = renderDialog(controller);
    handler(findOne(tree, byRadioGroup('Mode')), 'onKeyDown')({
      key: 'ArrowRight',
      preventDefault: vi.fn(),
      currentTarget: { querySelectorAll: () => [{ focus: vi.fn() }, { focus: vi.fn() }] },
    });
    expect(signals.countText.value).toBe('6');
  });
});

describe('PhysicsPaintPlayScriptDialog Timing card (D-12/D-13 loop intent, both modes)', () => {
  it('renders Repeat + Infinity inside the Timing card in BOTH modes as session-level loop intent', () => {
    const { controller, signals } = createFakeController();
    for (const mode of ['progressive', 'static'] as const) {
      signals.mode.value = mode;
      const tree = renderDialog(controller);
      const timingCard = findOne(tree, byClass('physics-paint-play-script-card-timing'));
      expect(findOne(timingCard, byId('physics-play-script-repeat'))).toBeTruthy();
      expect(findOne(timingCard, (vnode) => vnode.props?.type === 'checkbox')).toBeTruthy();
    }
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
  });
});

describe('PhysicsPaintPlayScriptDialog color segmented control (D-08R/D-18)', () => {
  it("renders a radiogroup with exactly two options 'Original colors' and 'Custom color' using the APG radio pattern", () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const group = findOne(tree, byRadioGroup('Color'));
    const radios = findAll(group, (vnode) => vnode.props?.role === 'radio');
    expect(radios).toHaveLength(2);
    expect(textOf(radios[0])).toBe('Original colors');
    expect(textOf(radios[1])).toBe('Custom color');
  });

  it("has 'Original colors' checked and the override disabled by default", () => {
    const { controller, signals } = createFakeController();
    const tree = renderDialog(controller);
    const radios = findAll(findOne(tree, byRadioGroup('Color')), (vnode) => vnode.props?.role === 'radio');
    expect(radios[0].props['aria-checked']).toBe(true);
    expect(radios[0].props.tabIndex).toBe(0);
    expect(radios[1].props['aria-checked']).toBe(false);
    expect(radios[1].props.tabIndex).toBe(-1);
    expect(signals.overrideEnabled.value).toBe(false);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-color-original-row')))).toContain("Keep each stroke's original paint color.");
  });

  it('arrow keys move check with wrap-around between the two color options', () => {
    const { controller, signals } = createFakeController();
    let tree = renderDialog(controller);
    const radioElements = [{ focus: vi.fn() }, { focus: vi.fn() }];
    const keydown = (key: string) => handler(findOne(tree, byRadioGroup('Color')), 'onKeyDown')({
      key,
      preventDefault: vi.fn(),
      currentTarget: { querySelectorAll: () => radioElements },
    });

    keydown('ArrowRight');
    expect(signals.overrideEnabled.value).toBe(true);
    expect(radioElements[1].focus).toHaveBeenCalledTimes(1);
    // Wrap-around: right from Custom returns to Original; left from Original lands on Custom.
    keydown('ArrowRight');
    expect(signals.overrideEnabled.value).toBe(false);
    expect(radioElements[0].focus).toHaveBeenCalledTimes(1);
    keydown('ArrowLeft');
    expect(signals.overrideEnabled.value).toBe(true);
    expect(radioElements[1].focus).toHaveBeenCalledTimes(2);
  });

  it("checking 'Custom color' sets overrideEnabled and renders the CURRENT brushColor prop as chip + hex + note — live, with no dialog-side copy", () => {
    const { controller, signals } = createFakeController();
    let tree = renderDialog(controller, '#3366ff');
    const radios = findAll(findOne(tree, byRadioGroup('Color')), (vnode) => vnode.props?.role === 'radio');
    handler(radios[1], 'onClick')({ currentTarget: { focus: vi.fn() } });
    expect(signals.overrideEnabled.value).toBe(true);

    tree = renderDialog(controller, '#3366ff');
    const chip = findOne(tree, byClass('physics-paint-play-script-override-chip'));
    expect((chip.props.style as { backgroundColor?: string }).backgroundColor).toBe('#3366ff');
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-color-custom-row')))).toContain('#3366ff');
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-color-custom-row')))).toContain("Picked from the app's brush color panel");

    // The chip/hex track the prop live — re-rendering with a new brush color updates them
    // without any dialog-side color state (D-08R/D-18).
    tree = renderDialog(controller, '#aa5500');
    const updatedChip = findOne(tree, byClass('physics-paint-play-script-override-chip'));
    expect((updatedChip.props.style as { backgroundColor?: string }).backgroundColor).toBe('#aa5500');
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-color-custom-row')))).toContain('#aa5500');
  });

  it("checking 'Original colors' sets overrideEnabled false and restores the original pane", () => {
    const { controller, signals } = createFakeController({ overrideEnabled: true });
    let tree = renderDialog(controller);
    const radios = findAll(findOne(tree, byRadioGroup('Color')), (vnode) => vnode.props?.role === 'radio');
    handler(radios[0], 'onClick')({ currentTarget: { focus: vi.fn() } });
    expect(signals.overrideEnabled.value).toBe(false);
    tree = renderDialog(controller);
    expect(findAll(tree, byClass('physics-paint-play-script-color-custom-row'))).toHaveLength(0);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-color-original-row')))).toContain("Keep each stroke's original paint color.");
  });

  it('mounts no InlineColorPicker anywhere in the dialog and keeps no pick-guard state', () => {
    expect(source).not.toContain('InlineColorPicker');
    expect(source).not.toContain('pickerArmed');
    expect(source).not.toContain('pickerOpen');
    expect(source).not.toContain('picker-well');
    expect(source).not.toContain('override-swatch');
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

  it("'Reset defaults' calls ONLY the controller resetDialogMotion operation", () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    handler(findOne(tree, (vnode) => textOf(vnode) === 'Reset defaults'), 'onClick')({});
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

  it('disables all controls during generation under the existing canCancel rule and keeps progress in the fixed footer', () => {
    const { controller } = createFakeController({ canCancel: true, progress: { completed: 1, total: 4 } });
    const tree = renderDialog(controller);
    for (const radio of findAll(tree, (vnode) => vnode.props?.role === 'radio')) {
      expect(radio.props['aria-disabled']).toBe(true);
      expect(radio.props.tabIndex).toBe(-1);
    }
    expect(findOne(tree, byId('physics-play-script-repeat')).props.disabled).toBe(true);
    expect(findOne(tree, (vnode) => vnode.props?.type === 'checkbox').props.disabled).toBe(true);
    expect(findOne(tree, byId('physics-play-script-motion-deformation')).props.disabled).toBe(true);
    const footer = findOne(tree, byClass('physics-paint-play-script-footer'));
    expect(findOne(footer, (vnode) => vnode.type === 'progress')).toBeTruthy();
    expect(textOf(tree)).toContain('Cancel generation');
  });
});

describe('PhysicsPaintPlayScriptDialog source contract (D-04/D-06/D-08R, locked copy)', () => {
  it('keeps the locked copy and prohibitions in the dialog source', () => {
    expect(source).toContain('Original colors');
    expect(source).toContain('Custom color');
    expect(source).toContain("Picked from the app's brush color panel");
    expect(source).toContain("Keep each stroke's original paint color.");
    expect(source).toContain('Frames per cycle');
    expect(source).toContain('Motion wiggle');
    expect(source).toContain('Reset defaults');
    expect(source).toContain('The drawing builds stroke by stroke across frames.');
    expect(source).toContain('The complete drawing is applied to every cycle frame.');
    expect(source).not.toContain('Save as defaults');
    expect(source).not.toContain('Reset to Motion defaults');
    expect(source).not.toContain('Cycle frames');
    expect(source).not.toContain('updatePanelMotion');
    expect(source).not.toContain('createPortal');
  });
});
