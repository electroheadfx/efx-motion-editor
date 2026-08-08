import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { signal } from '@preact/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';

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
import {
  createRotoPlayScriptController,
  type RotoPlayScriptController,
  type RotoPlayScriptControllerPorts,
  type RotoPlayScriptMode,
} from '../roto/physicsPaintRotoPlayScriptController';
import type { PhysicPaintRotoLoopClip } from '../roto/physicsPaintRotoPhysicalModel';

const source = readFileSync(fileURLToPath(new URL('./PhysicsPaintPlayScriptDialog.tsx', import.meta.url)), 'utf8');
const cssSource = readFileSync(fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)), 'utf8');

// Strip comments so selector extraction is not confused by leading block comments.
const cssRules = cssSource.replace(/\/\*[\s\S]*?\*\//g, '');

// Extract every CSS rule block whose selector lives in the .physics-paint-play-script-* scope
// (modal-scoped contract, D-19 — surrounding Paint UI rules are excluded by construction).
function playScriptCssScope(): string {
  return cssRules
    .split('}')
    .filter((chunk) => chunk.includes('physics-paint-play-script'))
    .map((chunk) => `${chunk}}`)
    .join('\n');
}

// Extract the single rule block for one exact selector inside the play-script scope.
function playScriptCssRule(selector: string): string {
  const chunk = cssRules
    .split('}')
    .find((block) => block.includes('{') && block.split('{')[0].trim() === selector);
  expect(chunk, `missing CSS rule for ${selector}`).toBeTruthy();
  return `${chunk}}`;
}

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
  // 43-06 loop modes
  dialogMode?: 'apply' | 'loop-edit' | 'source-edit';
  loopEditTargetId?: string | null;
  loopEditTarget?: { loopId: string; placementStart: number; sourceKeyIds: string[]; repeat: number | 'infinity'; mode: 'progressive' | 'static' } | null;
  loopEditSourceStart?: number | null;
  sourceEditSharedLoopCount?: number;
  loopIntentActive?: boolean;
  identicalSourceCycle?: { sourceKeyIds: readonly string[]; loopCount: number; sourceStart: number } | null;
  linkChoice?: 'link' | 'create';
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
    // 43-06 loop modes
    dialogMode: sig<'apply' | 'loop-edit' | 'source-edit'>(seed.dialogMode ?? 'apply'),
    loopEditTargetId: sig<string | null>(seed.loopEditTargetId ?? null),
    loopEditTarget: sig(seed.loopEditTarget ?? null),
    loopEditSourceStart: sig<number | null>(seed.loopEditSourceStart ?? null),
    sourceEditSharedLoopCount: sig(seed.sourceEditSharedLoopCount ?? 0),
    loopIntentActive: sig(seed.loopIntentActive ?? false),
    identicalSourceCycle: sig(seed.identicalSourceCycle ?? null),
    linkChoice: sig<'link' | 'create'>(seed.linkChoice ?? 'link'),
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
    openLoopEdit: vi.fn(async () => ({ ok: true, reason: null })),
    openSourceEdit: vi.fn(async () => ({ ok: true, reason: null })),
    repairLoop: vi.fn(async () => ({ ok: true, reason: null })),
    updateLoop: vi.fn(async () => true),
    unlinkLoop: vi.fn(async () => ({ ok: true, reason: null })),
    duplicateLinkedLoop: vi.fn(async () => ({ ok: true, reason: null })),
    relinkLoop: vi.fn(async () => ({ ok: true, reason: null })),
    findIdenticalSourceCycle: vi.fn(() => null),
  } as unknown as RotoPlayScriptController;
  return { controller, signals };
}

function renderDialog(controller: RotoPlayScriptController, brushColor = '#103c65'): TestVNode {
  hooks.cursor = 0;
  const tree = PhysicsPaintPlayScriptDialog({ playScript: controller, confirmationOpen: controller.confirmationOpen.value, brushColor, returnFocusRef: { current: null } });
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

describe('PhysicsPaintPlayScriptDialog final grid (D-16 final / D-19)', () => {
  it('lays out Mode (span-2), then Timing LEFT beside the Color-over-Motion right stack, then the summary bar (span-2)', () => {
    const readout = 'Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip';
    const { controller } = createFakeController({ loopReadout: readout });
    const tree = renderDialog(controller);
    const content = findOne(tree, byClass('physics-paint-play-script-content'));
    const contentChildren = childrenOf(content).filter((child): child is TestVNode =>
      typeof child === 'object' && child !== null && !Array.isArray(child));

    // Mode card is the first-read element, full width.
    const modeCard = findOne(content, byClass('physics-paint-play-script-card-mode'));
    expect(hasClass(modeCard, 'physics-paint-play-script-card-wide')).toBe(true);
    expect(parentOf(tree, modeCard)).toBe(content);
    expect(contentChildren[0]).toBe(modeCard);

    // (a) Timing card is the LEFT sibling of the right-column stack — same body grid row.
    const timingCard = findOne(tree, byClass('physics-paint-play-script-card-timing'));
    const sideStack = findOne(tree, byClass('physics-paint-play-script-side-stack'));
    expect(parentOf(tree, timingCard)).toBe(content);
    expect(parentOf(tree, sideStack)).toBe(content);
    expect(contentChildren.indexOf(timingCard)).toBeLessThan(contentChildren.indexOf(sideStack));

    // (b) Color card precedes Motion wiggle inside the right column; Motion wiggle is
    // NEVER a separate full-width row and NEVER above Color (D-16).
    const colorCard = findOne(tree, byClass('physics-paint-play-script-card-color'));
    const motionCard = findOne(tree, byClass('physics-paint-play-script-card-motion'));
    expect(parentOf(tree, colorCard)).toBe(sideStack);
    expect(parentOf(tree, motionCard)).toBe(sideStack);
    const stackChildren = childrenOf(sideStack).filter((child): child is TestVNode =>
      typeof child === 'object' && child !== null && !Array.isArray(child));
    expect(stackChildren.indexOf(colorCard)).toBeLessThan(stackChildren.indexOf(motionCard));
    expect(hasClass(motionCard, 'physics-paint-play-script-card-wide')).toBe(false);

    // Motion wiggle heading with the compact Reset defaults heading link.
    const heading = findOne(motionCard, byClass('physics-paint-play-script-card-heading'));
    expect(textOf(heading)).toContain('Motion wiggle');
    expect(textOf(findOne(heading, (vnode) => textOf(vnode) === 'Reset defaults'))).toBe('Reset defaults');

    // (d) Summary bar: Requested left / Effective right, after the main grid row.
    const summaryBar = findOne(tree, byClass('physics-paint-play-script-summary-bar'));
    expect(parentOf(tree, summaryBar)).toBe(content);
    expect(contentChildren.indexOf(summaryBar)).toBeGreaterThan(contentChildren.indexOf(sideStack));
    expect(textOf(findOne(summaryBar, byClass('physics-paint-play-script-summary-requested')))).toBe('Requested: 25f (5f × 5)');
    expect(textOf(findOne(summaryBar, byClass('physics-paint-play-script-summary-effective')))).toBe('Effective: 18f — shortened by the next clip');

    // Footer stays outside the body grid, inside the modal surface.
    const footer = findOne(tree, byClass('physics-paint-play-script-footer'));
    expect(parentOf(tree, footer)).not.toBe(content);
    expect(textOf(findOne(footer, (vnode) => textOf(vnode) === 'Generate'))).toBe('Generate');
  });

  it('keeps the body on the 1fr 1fr two-column grid with the right column as a vertical flex stack and NO scroll region (CSS contract)', () => {
    const contentRule = playScriptCssRule('.physics-paint-play-script-content');
    expect(contentRule).toContain('grid-template-columns: 1fr 1fr');
    expect(contentRule).not.toMatch(/overflow/);
    // (c) No scroll-region anywhere in the modal scope (full-scope sweep).
    expect(playScriptCssScope()).not.toMatch(/overflow(-y)?:\s*(auto|scroll)/);
    const stackRule = playScriptCssRule('.physics-paint-play-script-side-stack');
    expect(stackRule).toContain('display: flex');
    expect(stackRule).toContain('flex-direction: column');
  });

  it('splits the infinity readout as Cycle Nf × ∞ left / Effective right, and renders nothing when the readout is null', () => {
    const { controller } = createFakeController({ loopReadout: 'Cycle 4f × ∞ · Effective: 4f' });
    const tree = renderDialog(controller);
    const bar = findOne(tree, byClass('physics-paint-play-script-summary-bar'));
    expect(textOf(findOne(bar, byClass('physics-paint-play-script-summary-requested')))).toBe('Cycle 4f × ∞');
    expect(textOf(findOne(bar, byClass('physics-paint-play-script-summary-effective')))).toBe('Effective: 4f');
    const empty = renderDialog(createFakeController({ loopReadout: null }).controller);
    expect(findAll(empty, byClass('physics-paint-play-script-summary-bar'))).toHaveLength(0);
  });
});

describe('PhysicsPaintPlayScriptDialog modal overlay shell (D-19)', () => {
  it('renders a dimmed backdrop layer and the modal surface inside the role=dialog overlay root', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const root = findOne(tree, (vnode) => vnode.props?.role === 'dialog');
    expect(root.props['aria-modal']).toBe('true');
    const backdrop = findOne(root, byClass('physics-paint-play-script-backdrop'));
    expect(backdrop.props['aria-hidden']).toBe('true');
    // Backdrop is NOT wired to close — Cancel/Escape/success only (D-17/D-19).
    expect(backdrop.props.onClick).toBeUndefined();
    // The modal surface is a sibling of the backdrop, directly under the overlay root.
    const surface = findOne(root, byClass('physics-paint-play-script-surface'));
    expect(parentOf(root, surface)).toBe(root);
  });

  it('keeps the compact header (title left, Max range right) and the footer INSIDE the modal surface', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const surface = findOne(tree, byClass('physics-paint-play-script-surface'));
    const header = findOne(surface, byClass('physics-paint-play-script-header'));
    expect(parentOf(surface, header)).toBe(surface);
    // Title is the first header child; the range readout is the second (right-aligned via CSS).
    const headerChildren = childrenOf(header).filter((child): child is TestVNode =>
      typeof child === 'object' && child !== null && !Array.isArray(child));
    expect(textOf(headerChildren[0])).toBe('Play Script');
    expect(textOf(headerChildren[1])).toBe('Max 4 · F4–F7');
    // Footer (progress + Cancel/Generate) renders inside the modal surface, after the body.
    const footer = findOne(surface, byClass('physics-paint-play-script-footer'));
    expect(parentOf(surface, footer)).toBe(surface);
    const surfaceChildren = childrenOf(surface).filter((child): child is TestVNode =>
      typeof child === 'object' && child !== null && !Array.isArray(child));
    const bodyIndex = surfaceChildren.findIndex((child) => hasClass(child, 'physics-paint-play-script-content'));
    const footerIndex = surfaceChildren.findIndex((child) => hasClass(child, 'physics-paint-play-script-footer'));
    const headerIndex = surfaceChildren.findIndex((child) => hasClass(child, 'physics-paint-play-script-header'));
    expect(headerIndex).toBeGreaterThanOrEqual(0);
    expect(bodyIndex).toBeGreaterThan(headerIndex);
    expect(footerIndex).toBeGreaterThan(bodyIndex);
  });

  it('mounts the overlay out of the canvas grid cell: fixed inset positioning, no grid-cell placement (CSS contract)', () => {
    const rootRule = playScriptCssRule('.physics-paint-play-script-dialog');
    expect(rootRule).toContain('position: fixed');
    expect(rootRule).toContain('inset: 0');
    expect(rootRule).not.toContain('grid-row');
    expect(rootRule).not.toContain('grid-column');
    // Dimmed backdrop between the Paint UI and the modal.
    const backdropRule = playScriptCssRule('.physics-paint-play-script-backdrop');
    expect(backdropRule).toMatch(/background:\s*oklch\(0 0 0\s*\/\s*0\.5/);
  });

  it('declares the proposal dark token set on the modal scope and removes the old light palette (CSS contract)', () => {
    const scope = playScriptCssScope();
    for (const token of ['--ps-surface', '--ps-raised', '--ps-inset', '--ps-foot', '--ps-fg', '--ps-muted', '--ps-faint', '--ps-border', '--ps-accent', '--ps-accent-hi', '--ps-ok', '--ps-error', '--ps-radius']) {
      expect(scope).toContain(token);
    }
    // Old light Play Script palette is fully removed from the modal scope (D-19).
    for (const lightToken of ['#f7f5ef', '#d8d4ca', '#a9afb7', '#365ed6', '#a12f37', '#20242a', '#343a42', '#171a1f']) {
      expect(scope).not.toContain(lightToken);
    }
  });

  it('has NO scrolling region anywhere in the modal scope (CSS contract, D-19)', () => {
    const scope = playScriptCssScope();
    expect(scope).not.toMatch(/overflow-y:\s*auto/);
    expect(scope).not.toMatch(/overflow:\s*auto/);
    expect(scope).not.toMatch(/overflow-y:\s*scroll/);
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

describe('PhysicsPaintPlayScriptDialog keyboard containment (CR-01) + Generate guard on repeatError (WR-01)', () => {
  it('stops keydown propagation at the dialog root for every key so Studio shortcuts never fire behind the modal', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const root = findOne(tree, (vnode) => vnode.props?.role === 'dialog');
    const onKeyDown = handler(root, 'onKeyDown');
    for (const key of ['ArrowLeft', ' ', 'z', 'Delete', 'Escape', 'Enter', 'Tab']) {
      const stopPropagation = vi.fn();
      onKeyDown({ key, metaKey: key === 'z', preventDefault: vi.fn(), stopPropagation, currentTarget: null });
      expect(stopPropagation, `keydown '${key}' must stop propagation at the dialog root`).toHaveBeenCalled();
    }
  });

  it('disables Generate while the repeat field is invalid (repeatError channel), not only validationError', () => {
    const { controller } = createFakeController({ repeatError: 'Enter a positive integer.' });
    const tree = renderDialog(controller);
    const generate = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-play-script-button-primary'));
    expect(generate.props.disabled).toBe(true);
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

describe('PhysicsPaintPlayScriptDialog header drag + stable color-pane height (UAT remediation)', () => {
  it('drags the modal via the header: pointerdown + pointermove translates the surface, pointerup ends the drag', () => {
    const { controller } = createFakeController();
    let tree = renderDialog(controller);
    const header = () => findOne(tree, byClass('physics-paint-play-script-header'));
    const surface = () => findOne(tree, byClass('physics-paint-play-script-surface'));
    // Centered by default — no offset transform.
    expect(surface().props?.style).toBeUndefined();
    const handle = { setPointerCapture: vi.fn() };
    handler(header(), 'onPointerDown')({ button: 0, clientX: 100, clientY: 100, pointerId: 1, preventDefault: vi.fn(), currentTarget: handle });
    tree = renderDialog(controller);
    handler(header(), 'onPointerMove')({ clientX: 115, clientY: 108, preventDefault: vi.fn(), currentTarget: handle });
    tree = renderDialog(controller);
    expect(surface().props?.style).toEqual({ transform: 'translate(15px, 8px)' });
    // After pointerup the drag ends — further moves leave the offset untouched.
    handler(header(), 'onPointerUp')({ clientX: 115, clientY: 108, preventDefault: vi.fn(), currentTarget: handle });
    tree = renderDialog(controller);
    handler(header(), 'onPointerMove')({ clientX: 220, clientY: 200, preventDefault: vi.fn(), currentTarget: handle });
    tree = renderDialog(controller);
    expect(surface().props?.style).toEqual({ transform: 'translate(15px, 8px)' });
  });

  it('marks the header as the drag handle and the root while dragging (CSS contract)', () => {
    expect(playScriptCssRule('.physics-paint-play-script-header')).toContain('cursor: grab');
    expect(playScriptCssRule('.physics-paint-play-script-dialog.physics-paint-play-script-dragging .physics-paint-play-script-header')).toContain('cursor: grabbing');
  });

  it('locks the color pane to the Custom row height so Original/Custom toggling never resizes the modal (CSS contract)', () => {
    // Deterministic Custom row: 7px padding + meta (hex 16px + 2px gap + note 14px) + 7px + 2px border = 48px.
    expect(playScriptCssRule('.physics-paint-play-script-color-pane')).toContain('min-height: 48px');
    expect(playScriptCssRule('.physics-paint-play-script-color-hex')).toContain('line-height: 16px');
    expect(playScriptCssRule('.physics-paint-play-script-color-note')).toContain('line-height: 14px');
  });
});

describe('PhysicsPaintPlayScriptDialog pending Loop Clip authority transition', () => {
  it('renders Edit Loop Clip immediately from the accepted local loop while authority is pending', () => {
    const loop: PhysicPaintRotoLoopClip = {
      loopId: 'loop-1',
      placementStart: 10,
      sourceKeyIds: ['source-1', 'source-2', 'source-3'],
      repeat: 4,
      mode: 'static',
    };
    const launchContext: PhysicPaintLaunchContext = {
      operationId: 'launch-1',
      layerId: 'layer-1',
      startFrame: 10,
      width: 1920,
      height: 1080,
      project: { name: 'Saved project', saved: true, contextId: 'project-context-1' },
    };
    const requestAuthority = vi.fn(() => new Promise<never>(() => {}));
    const library = {
      selectedId: signal<string | null>('script-1'),
      selected: signal({ id: 'script-1' }),
      busy: signal(false),
    } as unknown as RotoPlayScriptControllerPorts['library'];
    const controller = createRotoPlayScriptController({
      library,
      getLaunchContext: () => launchContext,
      getSelection: () => ({ kind: 'real-key', keyId: 'source-1', appFrame: 10 }),
      getMotion: () => ({ deformation: 0, position: 0 }),
      getBrushColor: () => '#103c65',
      getOperationLocked: () => false,
      getSize: () => ({ width: 1920, height: 1080 }),
      getRotoLoopClips: () => [loop],
      getLoopEditSnapshot: (placementStart) => ({
        identities: loop.sourceKeyIds.map((keyId, index) => ({ keyId, appFrame: placementStart + index })),
        physicalCapacity: 600,
        layerEndExclusive: 600,
        interpolationEnabled: false,
        remainingCapacity: 600 - placementStart,
      }),
      requestAuthority,
      commit: vi.fn(async () => ({ ok: false as const, error: 'not used by this reproduction' })),
      stopPlayback: vi.fn(),
      log: vi.fn(),
    });

    void controller.openLoopEdit(loop.loopId);

    expect(requestAuthority).not.toHaveBeenCalled();
    hooks.cursor = 0;
    const tree = PhysicsPaintPlayScriptDialog({
      playScript: controller,
      confirmationOpen: controller.confirmationOpen.value,
      brushColor: '#103c65',
      returnFocusRef: { current: null },
    }) as unknown as TestVNode | null;
    const title = tree ? textOf(findOne(tree, byId('physics-play-script-title'))) : null;

    expect({
      confirmationOpen: controller.confirmationOpen.value,
      dialogRendered: tree !== null,
      title,
    }).toEqual({
      confirmationOpen: true,
      dialogRendered: true,
      title: 'Edit Loop Clip',
    });
  });

  it('renders Edit Loop Clip from a valid local snapshot while the project has unsaved changes', async () => {
    const loop: PhysicPaintRotoLoopClip = {
      loopId: 'loop-dirty',
      placementStart: 10,
      sourceKeyIds: ['source-1', 'source-2', 'source-3'],
      repeat: 4,
      mode: 'static',
    };
    const launchContext: PhysicPaintLaunchContext = {
      operationId: 'launch-dirty',
      layerId: 'layer-1',
      startFrame: 10,
      width: 1920,
      height: 1080,
      project: { name: 'Dirty project', saved: false, contextId: 'project-context-1' },
    };
    const requestAuthority = vi.fn(() => new Promise<never>(() => {}));
    const library = {
      selectedId: signal<string | null>('script-1'),
      selected: signal({ id: 'script-1' }),
      busy: signal(false),
    } as unknown as RotoPlayScriptControllerPorts['library'];
    const controller = createRotoPlayScriptController({
      library,
      getLaunchContext: () => launchContext,
      getSelection: () => ({ kind: 'real-key', keyId: 'source-1', appFrame: 10 }),
      getMotion: () => ({ deformation: 0, position: 0 }),
      getBrushColor: () => '#103c65',
      getOperationLocked: () => false,
      getSize: () => ({ width: 1920, height: 1080 }),
      getRotoLoopClips: () => [loop],
      getLoopEditSnapshot: (placementStart) => ({
        identities: loop.sourceKeyIds.map((keyId, index) => ({ keyId, appFrame: placementStart + index })),
        physicalCapacity: 600,
        layerEndExclusive: 600,
        interpolationEnabled: false,
        remainingCapacity: 600 - placementStart,
      }),
      requestAuthority,
      commit: vi.fn(async () => ({ ok: false as const, error: 'not used by this reproduction' })),
      stopPlayback: vi.fn(),
      log: vi.fn(),
    });

    const result = await controller.openLoopEdit(loop.loopId);
    hooks.cursor = 0;
    const tree = PhysicsPaintPlayScriptDialog({
      playScript: controller,
      confirmationOpen: controller.confirmationOpen.value,
      brushColor: '#103c65',
      returnFocusRef: { current: null },
    }) as unknown as TestVNode | null;
    const title = tree ? textOf(findOne(tree, byId('physics-play-script-title'))) : null;

    expect(requestAuthority).not.toHaveBeenCalled();
    expect({
      result,
      confirmationOpen: controller.confirmationOpen.value,
      dialogRendered: tree !== null,
      title,
    }).toEqual({
      result: { ok: true, reason: null },
      confirmationOpen: true,
      dialogRendered: true,
      title: 'Edit Loop Clip',
    });
  });
});

// 43-06 Task 2 (D-01/D-02/D-05): loop-edit (S2), source-edit (S3), and the
// apply-time Link/Create choice (S4) on the SAME Phase 42 modal shell.
describe('PhysicsPaintPlayScriptDialog loop-edit mode (S2, D-01)', () => {
  const target = { loopId: 'L1', placementStart: 10, sourceKeyIds: ['S1', 'S2', 'S3', 'S4', 'S5'], repeat: 3 as const, mode: 'static' as const };
  const loopEditSeed = {
    dialogMode: 'loop-edit' as const,
    loopEditTargetId: 'L1',
    loopEditTarget: target,
    loopEditSourceStart: 10,
    mode: 'static' as const,
    countText: '5',
    repeatText: '3',
    loopReadout: 'Requested: 15f (5f × 3) · Effective: 8f — shortened by the next clip',
  };

  it('renders the locked title, range readout, and the Update loop / Edit source cycle… actions', () => {
    const { controller } = createFakeController(loopEditSeed);
    const tree = renderDialog(controller);
    expect(textOf(findOne(tree, byId('physics-play-script-title')))).toBe('Edit Loop Clip');
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-header-range')))).toBe('F10 · Cycle 5f');
    const footer = findOne(tree, byClass('physics-paint-play-script-actions'));
    expect(textOf(findOne(footer, (vnode) => textOf(vnode) === 'Update loop'))).toBe('Update loop');
    expect(textOf(findOne(footer, (vnode) => textOf(vnode) === 'Edit source cycle…'))).toBe('Edit source cycle…');
    expect(findAll(footer, (vnode) => textOf(vnode) === 'Generate')).toHaveLength(0);
    expect(findAll(footer, (vnode) => textOf(vnode) === 'Regenerate source cycle')).toHaveLength(0);
  });

  it('keeps the source edit count separate from a longer physical cycle-duration readout', () => {
    const spacedTarget = { ...target, sourceKeyIds: ['S1', 'S2', 'S3'] };
    const { controller } = createFakeController({
      ...loopEditSeed,
      loopEditTarget: spacedTarget,
      countText: '3',
      loopReadout: 'Requested: 21f (7f × 3) · Effective: 21f',
    });
    const tree = renderDialog(controller);

    expect(textOf(findOne(tree, byClass('physics-paint-play-script-header-range')))).toBe('F10 · Cycle 3f');
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-summary-requested')))).toBe('Requested: 21f (7f × 3)');
    expect(findOne(tree, byId('physics-play-script-count')).props.value).toBe('3');
  });

  it('locks Frames-per-cycle and every source field at reduced opacity with values preserved; ONLY Repeat + Infinity stay editable', () => {
    const { controller } = createFakeController(loopEditSeed);
    const tree = renderDialog(controller);
    // Frames-per-cycle input: disabled, value preserved.
    const countInput = findOne(tree, byId('physics-play-script-count'));
    expect(countInput.props.disabled).toBe(true);
    expect(countInput.props.value).toBe('5');
    // Mode/Color/Motion cards + the count field carry the locked treatment.
    expect(hasClass(findOne(tree, byClass('physics-paint-play-script-card-mode')), 'physics-paint-play-script-locked')).toBe(true);
    expect(hasClass(findOne(tree, byClass('physics-paint-play-script-card-color')), 'physics-paint-play-script-locked')).toBe(true);
    expect(hasClass(findOne(tree, byClass('physics-paint-play-script-card-motion')), 'physics-paint-play-script-locked')).toBe(true);
    expect(hasClass(parentOf(tree, countInput)!, 'physics-paint-play-script-locked')).toBe(true);
    // Every mode/color radio is disabled; the Motion sliders and Reset defaults are disabled.
    for (const radio of findAll(tree, (vnode) => vnode.props?.role === 'radio')) {
      expect(radio.props['aria-disabled']).toBe(true);
    }
    expect(findOne(tree, byId('physics-play-script-motion-deformation')).props.disabled).toBe(true);
    expect(findOne(tree, byId('physics-play-script-motion-position')).props.disabled).toBe(true);
    expect(findOne(tree, (vnode) => textOf(vnode) === 'Reset defaults').props.disabled).toBe(true);
    // Repeat + Infinity remain editable.
    expect(findOne(tree, byId('physics-play-script-repeat')).props.disabled).toBe(false);
    const infinityToggle = findOne(tree, (vnode) => vnode.props?.type === 'checkbox');
    expect(infinityToggle.props.disabled).toBe(false);
    // The Requested/Effective readout renders in the summary bar.
    const bar = findOne(tree, byClass('physics-paint-play-script-summary-bar'));
    expect(textOf(findOne(bar, byClass('physics-paint-play-script-summary-requested')))).toBe('Requested: 15f (5f × 3)');
    expect(textOf(findOne(bar, byClass('physics-paint-play-script-summary-effective')))).toBe('Effective: 8f — shortened by the next clip');
  });

  it('Update loop confirms; Edit source cycle… opens the source-edit mode for the target loop', () => {
    const { controller } = createFakeController(loopEditSeed);
    const tree = renderDialog(controller);
    handler(findOne(tree, (vnode) => textOf(vnode) === 'Update loop'), 'onClick')();
    expect(controller.confirm).toHaveBeenCalledTimes(1);
    handler(findOne(tree, (vnode) => textOf(vnode) === 'Edit source cycle…'), 'onClick')();
    expect(controller.openSourceEdit).toHaveBeenCalledWith('L1');
  });

  it('keeps Update loop disabled while Repeat is invalid', () => {
    const { controller } = createFakeController({ ...loopEditSeed, repeatError: 'Enter a positive integer.' });
    const tree = renderDialog(controller);
    expect(findOne(tree, (vnode) => textOf(vnode) === 'Update loop').props.disabled).toBe(true);
  });
});

describe('PhysicsPaintPlayScriptDialog source-edit mode (S3, D-02)', () => {
  const sourceEditSeed = {
    dialogMode: 'source-edit' as const,
    loopEditTargetId: 'L1',
    loopEditTarget: { loopId: 'L1', placementStart: 10, sourceKeyIds: ['S1', 'S2', 'S3', 'S4', 'S5'], repeat: 3 as const, mode: 'static' as const },
    mode: 'static' as const,
    countText: '5',
    repeatText: '3',
    sourceEditSharedLoopCount: 1,
  };

  it('renders the locked title, the base notice, and the Regenerate source cycle confirmation', () => {
    const { controller } = createFakeController(sourceEditSeed);
    const tree = renderDialog(controller);
    expect(textOf(findOne(tree, byId('physics-play-script-title')))).toBe('Edit Source Cycle');
    const notice = findOne(tree, byClass('physics-paint-play-script-notice'));
    expect(textOf(notice)).toContain('Confirming regenerates the source cycle and updates every linked Loop Clip referencing it.');
    expect(textOf(notice)).not.toContain('shared by');
    expect(textOf(findOne(tree, (vnode) => textOf(vnode) === 'Regenerate source cycle'))).toBe('Regenerate source cycle');
    // The full form stays editable (prefill values preserved).
    expect(findOne(tree, byId('physics-play-script-count')).props.disabled).toBe(false);
    expect(findOne(tree, byId('physics-play-script-count')).props.value).toBe('5');
    expect(findOne(tree, byId('physics-play-script-motion-deformation')).props.disabled).toBe(false);
  });

  it('shows the shared-source count only when more than one loop references the cycle', () => {
    const { controller } = createFakeController({ ...sourceEditSeed, sourceEditSharedLoopCount: 3 });
    const tree = renderDialog(controller);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-notice')))).toContain('This source cycle is shared by 3 loops.');
  });

  it('keeps the Phase 42 generation lifecycle: inputs disabled and Cancel generation while busy', () => {
    const { controller } = createFakeController({ ...sourceEditSeed, canCancel: true, progress: { completed: 1, total: 5 } });
    const tree = renderDialog(controller);
    expect(findOne(tree, byId('physics-play-script-count')).props.disabled).toBe(true);
    expect(textOf(findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Cancel generation'))).toBe('Cancel generation');
    expect(findAll(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Regenerate source cycle')).toHaveLength(0);
  });
});

describe('PhysicsPaintPlayScriptDialog apply-time Link/Create choice (S4, D-05)', () => {
  const identical = { sourceKeyIds: ['S1', 'S2', 'S3', 'S4', 'S5'], loopCount: 2, sourceStart: 10 };

  it('renders nothing when the controller reports no identical source cycle', () => {
    const { controller } = createFakeController({ identicalSourceCycle: null, loopIntentActive: true });
    const tree = renderDialog(controller);
    expect(findAll(tree, byClass('physics-paint-play-script-card-source-choice'))).toHaveLength(0);
  });

  it('renders the segmented control with locked options and helpers, Link selected by default with the source range and linked count', () => {
    const { controller } = createFakeController({ identicalSourceCycle: identical, loopIntentActive: true, linkChoice: 'link' });
    const tree = renderDialog(controller);
    const card = findOne(tree, byClass('physics-paint-play-script-card-source-choice'));
    expect(textOf(findOne(card, (vnode) => textOf(vnode) === 'Link to existing cycle'))).toBe('Link to existing cycle');
    expect(textOf(findOne(card, (vnode) => textOf(vnode) === 'Create new cycle'))).toBe('Create new cycle');
    const helper = findOne(card, byId('physics-play-script-source-helper'));
    expect(textOf(helper)).toContain('Reuses the existing source cycle. Future source edits update every linked loop.');
    expect(textOf(helper)).toContain('Source F10–F14 · 2 linked loop(s).');
    const linkRadio = findOne(card, (vnode) => textOf(vnode) === 'Link to existing cycle');
    expect(linkRadio.props['aria-checked']).toBe(true);
  });

  it('switching to Create new cycle updates the controller linkChoice and shows the Create helper', () => {
    const { controller, signals } = createFakeController({ identicalSourceCycle: identical, loopIntentActive: true, linkChoice: 'link' });
    let tree = renderDialog(controller);
    handler(findOne(tree, (vnode) => textOf(vnode) === 'Create new cycle'), 'onClick')({ currentTarget: null });
    expect(signals.linkChoice.value).toBe('create');
    tree = renderDialog(controller);
    const helper = findOne(tree, byId('physics-play-script-source-helper'));
    expect(textOf(helper)).toContain('Creates an independent source cycle. Future edits do not affect the existing loops.');
  });
});

describe('PhysicsPaintPlayScriptDialog 43-06 copy + token contract', () => {
  it('ships every locked 43-06 dialog string verbatim and never the prohibited terms (D-20)', () => {
    for (const locked of ['Edit Loop Clip', 'Edit Source Cycle', 'Update loop', 'Edit source cycle…', 'Regenerate source cycle', 'Link to existing cycle', 'Create new cycle']) {
      expect(source).toContain(locked);
    }
    expect(source).not.toContain('clip bloquant');
    expect((source.match(/clip bloquant/g) ?? []).length).toBe(0);
  });

  it('introduces no new CSS color tokens — the locked/notice rules reference only the Phase 42 --ps-* set', () => {
    const lockedRule = playScriptCssRule('.physics-paint-play-script-locked');
    expect(lockedRule).toContain('opacity');
    expect(lockedRule).not.toMatch(/#[0-9a-fA-F]{3,8}\b|oklch|rgb\(/);
    const noticeRule = playScriptCssRule('.physics-paint-play-script-notice');
    expect(noticeRule).not.toMatch(/#[0-9a-fA-F]{3,8}\b|oklch|rgb\(/);
    expect(noticeRule).toContain('var(--ps-muted)');
    // The defined token set is exactly the locked Phase 42 set — 43-06 adds none.
    const defined = [...playScriptCssScope().matchAll(/--ps-[a-z-]+:/g)].map((match) => match[0]);
    expect([...new Set(defined)].sort()).toEqual([
      '--ps-accent-hi:', '--ps-accent:', '--ps-border:', '--ps-error:', '--ps-faint:', '--ps-fg:',
      '--ps-foot:', '--ps-inset:', '--ps-muted:', '--ps-ok:', '--ps-radius:', '--ps-raised:', '--ps-surface:',
    ]);
  });
});
