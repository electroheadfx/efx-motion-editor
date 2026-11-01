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
  CollisionCard,
  ColorCard,
  ColorizeCard,
  DialogRadioGroup,
  KeepScriptCard,
  KeyScriptCard,
  MotionWiggleCard,
  PaintSeedCard,
  PaintTimingCard,
  PhotoWiggleCard,
  RailTypeCard,
  RevealTimingCard,
  SourceCycleCard,
  StackReadoutCard,
} from './PhysicsPaintPlayScriptCards';
import {
  createRotoPlayScriptController,
  stackRunKindMode,
  type RotoPlayScriptController,
  type RotoPlayScriptControllerPorts,
  type RotoPlayScriptMode,
  type RotoPlayScriptStackRunKind,
} from '../roto/physicsPaintRotoPlayScriptController';
import type { PhysicPaintRotoLoopClip } from '../roto/physicsPaintRotoPhysicalModel';
import { STANDARD_RAIL_REGENERATE_REASON } from '../roto/physicsPaintRotoRunScriptStacking';

const source = [
  readFileSync(fileURLToPath(new URL('./PhysicsPaintPlayScriptDialog.tsx', import.meta.url)), 'utf8'),
  readFileSync(fileURLToPath(new URL('./PhysicsPaintPlayScriptCards.tsx', import.meta.url)), 'utf8'),
].join('\n');

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
  max?: boolean;
  repeatText?: string;
  infinity?: boolean;
  overrideEnabled?: boolean;
  repeatError?: string | null;
  loopReadout?: string | null;
  error?: string | null;
  progress?: { completed: number; total: number } | null;
  status?: string | null;
  canCancel?: boolean;
  validationError?: string | null;
  phase?: string;
  // 43-06 loop modes
  dialogMode?: 'apply' | 'loop-edit' | 'source-edit';
  loopEditTargetId?: string | null;
  loopEditTarget?: PhysicPaintRotoLoopClip | null;
  loopEditSourceStart?: number | null;
  sourceEditSharedLoopCount?: number;
  regenerateDisabledReason?: string | null;
  regenerateImpact?: {
    actionId: string;
    actionRevision: string;
    actionHash: string;
    documentRevision: string;
    initiatingGroupId: string;
    groupName: string;
    groupType: 'Motion' | 'Static';
    restoredRange: string;
    locallyPaintedFrameCount: number;
    deletedFrameCount: number;
    deletedFrameRanges: string;
    fragmentCount: number;
    gapRanges: string;
    affectedGroups: readonly { groupId: string; name: string; range: string }[];
    sourceCacheEffects: string;
    storedSettings: { mode: RotoPlayScriptMode; motion: { deformation: number; position: number }; overrideColor: string | null; sourceKeyIds: readonly string[] };
  } | null;
  loopIntentActive?: boolean;
  identicalSourceCycle?: { sourceKeyIds: readonly string[]; loopCount: number; sourceStart: number } | null;
  linkChoice?: 'link' | 'create';
  // 52-05 (G-52-3): the Run Script tabs
  railTab?: 'paint' | 'reveal';
  revealCountText?: string;
  revealValidationError?: string | null;
  revealReferencePlaced?: boolean;
  canonicalStart?: number | null;
  // 261029-vbp: the Reveal tab colorize pair
  colorize?: boolean;
  colorizeMix?: number;
  // 261030-ey9: the Reveal tab Photo wiggle
  photoWiggle?: boolean;
  // 261030-ig0: per-key script editing
  keyScriptEdits?: boolean;
  // 261030-v1t: per-frame paint-seed variation
  paintSeedVariation?: boolean;
  // 261031-i54: Run Script stacking onto an existing Paint rail
  runDestination?: { kind: 'stack'; clipId: string } | { kind: 'create' } | { kind: 'refuse'; reason: 'ambiguous-rail' };
  // 261031-qps (Quick B): the stacked rail's kind — a reveal destination swaps the cards
  stackRailKind?: 'playscript' | 'reveal' | null;
  // 261101-1pc (Quick C2): the stack's four-kind Rail Type (dialog state only)
  stackRunKind?: RotoPlayScriptStackRunKind;
  stackOverrideColor?: string | null;
  repeatLocked?: boolean;
  framesMax?: number;
  destinationRange?: string | null;
  stackReadout?: { spanLabel: string; offsetLabel: string; outcomeLabel: string } | null;
  keepScript?: boolean;
  keepScriptVisible?: boolean;
  keepScriptEffective?: boolean;
  keepScriptDisabledReason?: string | null;
  stackCollision?: {
    boundaryExclusive: number;
    blocker: 'other-rail' | 'real-key' | 'parent-end' | 'target-end';
    victimClipId: string | null;
    runCollision?: boolean;
    lifecycleOverflow?: boolean;
    parentEndExclusive?: number | null;
  } | null;
  collisionOffers?: readonly ('cancel' | 'truncate' | 'overwrite')[];
}

// Fake controller harness exposing the post-revision 42-05 interface — plain { value } cells
// stand in for signals (the dialog only ever reads/writes .value); re-renders are invoked
// manually. There is NO overrideColor signal: the override color resolves live from the
// brushColor prop / getBrushColor port (D-08R), never from dialog-side state.
function createFakeController(seed: FakeControllerSeed = {}) {
  const signals = {
    confirmationOpen: sig(true),
    countText: sig(seed.countText ?? '3'),
    max: sig(seed.max ?? false),
    lastFiniteCount: sig('3'),
    capacity: sig(4),
    mode: sig<RotoPlayScriptMode>(seed.mode ?? 'progressive'),
    overrideEnabled: sig(seed.overrideEnabled ?? false),
    dialogMotion: sig({ deformation: 25, position: 40, rotation: 0, scale: 0 }),
    repeatText: sig(seed.repeatText ?? '1'),
    infinity: sig(seed.infinity ?? false),
    lastFiniteRepeat: sig('1'),
    layerEndExclusive: sig<number | null>(8),
    parsedRepeat: sig<{ count: number | null; error: string | null }>({ count: 1, error: null }),
    repeatError: sig<string | null>(seed.repeatError ?? null),
    loopReadout: sig<string | null>(seed.loopReadout ?? null),
    destinationRange: sig<string | null>(seed.destinationRange ?? 'F4–F7'),
    validationError: sig<string | null>(seed.validationError ?? null),
    disabledReason: sig<string | null>(null),
    phase: sig(seed.phase ?? 'idle'),
    progress: sig<{ completed: number; total: number } | null>(seed.progress ?? null),
    status: sig<string | null>(seed.status ?? null),
    error: sig<string | null>(seed.error ?? null),
    canCancel: sig(seed.canCancel ?? false),
    // 43-06 loop modes
    dialogMode: sig<'apply' | 'loop-edit' | 'source-edit'>(seed.dialogMode ?? 'apply'),
    loopEditTargetId: sig<string | null>(seed.loopEditTargetId ?? null),
    loopEditTarget: sig(seed.loopEditTarget ?? null),
    loopEditSourceStart: sig<number | null>(seed.loopEditSourceStart ?? null),
    sourceEditSharedLoopCount: sig(seed.sourceEditSharedLoopCount ?? 0),
    regenerateDisabledReason: sig<string | null>(seed.regenerateDisabledReason ?? null),
    regenerateImpact: sig(seed.regenerateImpact ?? null),
    loopIntentActive: sig(seed.loopIntentActive ?? false),
    identicalSourceCycle: sig(seed.identicalSourceCycle ?? null),
    linkChoice: sig<'link' | 'create'>(seed.linkChoice ?? 'link'),
    // 52-05 (G-52-3): the Run Script tabs
    railTab: sig<'paint' | 'reveal'>(seed.railTab ?? 'paint'),
    canonicalStart: sig<number | null>(seed.canonicalStart ?? 4),
    revealCountText: sig(seed.revealCountText ?? '3'),
    parsedRevealCount: sig<{ count: number | null; error: string | null }>({ count: 3, error: null }),
    revealValidationError: sig<string | null>(seed.revealValidationError ?? null),
    revealReferencePlaced: sig(seed.revealReferencePlaced ?? true),
    colorize: sig(seed.colorize ?? false),
    colorizeMix: sig(seed.colorizeMix ?? 100),
    photoWiggle: sig(seed.photoWiggle ?? false),
    keyScriptEdits: sig(seed.keyScriptEdits ?? false),
    paintSeedVariation: sig(seed.paintSeedVariation ?? false),
    // 261031-i54: Run Script stacking onto an existing Paint rail
    runDestination: sig(seed.runDestination ?? { kind: 'create' as const }),
    stackRailKind: sig(seed.stackRailKind ?? null),
    stackRunKind: sig<RotoPlayScriptStackRunKind>(seed.stackRunKind ?? 'motion'),
    stackOverrideColor: sig<string | null>(seed.stackOverrideColor ?? null),
    repeatLocked: sig(seed.repeatLocked ?? false),
    framesMax: sig(seed.framesMax ?? 4),
    stackReadout: sig(seed.stackReadout ?? null),
    keepScript: sig(seed.keepScript ?? false),
    keepScriptVisible: sig(seed.keepScriptVisible ?? false),
    keepScriptEffective: sig(seed.keepScriptEffective ?? false),
    keepScriptDisabledReason: sig<string | null>(seed.keepScriptDisabledReason ?? null),
    stackCollision: sig(seed.stackCollision ?? null),
    collisionOffers: sig<readonly ('cancel' | 'truncate' | 'overwrite')[]>(seed.collisionOffers ?? []),
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
    setMax: vi.fn(),
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
    setRailTab: vi.fn(),
    requestPhotoReference: vi.fn(),
    setColorize: vi.fn(),
    setColorizeMix: vi.fn(),
    setPhotoWiggle: vi.fn(),
    setKeyScriptEdits: vi.fn(),
    setPaintSeedVariation: vi.fn(),
    useBrushColor: vi.fn(),
    setKeepScript: vi.fn(),
    // IN-04: the fake mirrors the real controller's SOLE write path. The signal
    // is read-only on the interface, and the setter keeps `mode` in lockstep.
    setStackRunKind: vi.fn((kind: RotoPlayScriptStackRunKind) => {
      signals.stackRunKind.value = kind;
      signals.mode.value = stackRunKindMode(kind);
    }),
    confirmStackCollision: vi.fn(),
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

// The dialog composes its cards as function components. This harness renders
// the dialog function directly (no Preact runtime), so it expands the card
// components explicitly; SliderStepper stays opaque and is matched by its props.
const EXPANDABLE = new Set<unknown>([
  CollisionCard, ColorCard, ColorizeCard, DialogRadioGroup, KeepScriptCard,
  KeyScriptCard, MotionWiggleCard, PaintSeedCard, PaintTimingCard,
  PhotoWiggleCard, RailTypeCard, RevealTimingCard, SourceCycleCard,
  StackReadoutCard,
]);

const renderedByVNode = new WeakMap<object, unknown>();

function renderFunctionVNode(vnode: TestVNode): unknown {
  const cached = renderedByVNode.get(vnode as object);
  if (cached !== undefined) return cached;
  const rendered = (vnode.type as (props: Record<string, unknown>) => unknown)(vnode.props);
  renderedByVNode.set(vnode as object, rendered);
  return rendered;
}

function renderedChildren(vnode: TestVNode): unknown[] {
  const children = childrenOf(vnode);
  if (typeof vnode.type === 'function' && EXPANDABLE.has(vnode.type)) {
    return [...children, renderFunctionVNode(vnode)];
  }
  return children;
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
  for (const child of renderedChildren(vnode)) yield* walk(child);
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
  const vnode = node as TestVNode;
  return textOf(renderedChildren(vnode));
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
    if (renderedChildren(vnode).includes(target)) return vnode;
  }
  return null;
}

function renderedParentOf(root: unknown, target: TestVNode): TestVNode | null {
  let parent = parentOf(root, target);
  while (parent && typeof parent.type === 'function') parent = parentOf(root, parent);
  return parent;
}

const byId = (id: string) => (vnode: TestVNode) => vnode.props?.id === id;
const byClass = (name: string) => (vnode: TestVNode) => hasClass(vnode, name);
const byRadioGroup = (label: string) => (vnode: TestVNode) => vnode.props?.role === 'radiogroup' && vnode.props?.['aria-label'] === label;

// 261101-cd5: the creation cards share one equal-width global row. Their
// rendered order inside that row is the only order the design defines.
function globalRowCards(root: unknown): TestVNode[] {
  const row = findOne(root, byClass('physics-paint-play-script-global-row'));
  return findAll(row, (vnode) => hasClass(vnode, 'physics-paint-play-script-card-global')
    && renderedParentOf(row, vnode) === row);
}

beforeEach(() => {
  hooks.reset();
});

describe('PhysicsPaintPlayScriptDialog fixed shell (261101-cd5)', () => {
  it('composes header → workspace (folder tabs then tab-owned panel) → footer inside the fixed surface', () => {
    const readout = 'Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip';
    const { controller } = createFakeController({ loopReadout: readout });
    const tree = renderDialog(controller);
    const surface = findOne(tree, byClass('physics-paint-play-script-surface'));
    const surfaceChildren = childrenOf(surface).filter((child): child is TestVNode =>
      typeof child === 'object' && child !== null && !Array.isArray(child));
    expect(surfaceChildren.map((child) => String(child.props.class ?? ''))).toEqual([
      'physics-paint-play-script-header',
      'physics-paint-play-script-workspace',
      'physics-paint-play-script-footer',
    ]);

    // The workspace owns the folder-tab strip and the panel the tabs fill.
    const workspace = findOne(surface, byClass('physics-paint-play-script-workspace'));
    const workspaceChildren = childrenOf(workspace).filter((child): child is TestVNode =>
      typeof child === 'object' && child !== null && !Array.isArray(child));
    expect(hasClass(workspaceChildren[0]!, 'physics-paint-play-script-tabs')).toBe(true);
    expect(hasClass(workspaceChildren[1]!, 'physics-paint-play-script-content')).toBe(true);

    // The panel is a single column whose first row is the RAIL TYPE subheader.
    const panel = findOne(tree, byClass('physics-paint-play-script-content'));
    const panelChildren = [...walk(panel)]
      .filter((child) => child !== panel && typeof child.type !== 'function')
      .filter((child) => renderedParentOf(panel, child) === panel);
    const modeRow = findOne(panel, byClass('physics-paint-play-script-card-mode'));
    expect(hasClass(modeRow, 'physics-paint-play-script-rail-row')).toBe(true);
    expect(panelChildren[0]).toBe(modeRow);
    expect(findAll(panel, byClass('physics-paint-play-script-key-column'))).toHaveLength(0);
    expect(findAll(panel, byClass('physics-paint-play-script-side-stack'))).toHaveLength(0);

    // Timing and (until the footer tooltip lands) the readout are flat panel rows.
    const timingCard = findOne(panel, byClass('physics-paint-play-script-card-timing'));
    expect(renderedParentOf(tree, timingCard)).toBe(panel);
    const summaryBar = findOne(panel, byClass('physics-paint-play-script-summary-bar'));
    expect(renderedParentOf(tree, summaryBar)).toBe(panel);
    expect(panelChildren.indexOf(summaryBar)).toBeGreaterThan(panelChildren.indexOf(timingCard));
    expect(textOf(findOne(summaryBar, byClass('physics-paint-play-script-summary-requested')))).toBe('Requested: 25f (5f × 5)');
    expect(textOf(findOne(summaryBar, byClass('physics-paint-play-script-summary-effective')))).toBe('Effective: 18f — shortened by the next clip');

    // Footer stays outside the panel, inside the modal surface.
    const footer = findOne(tree, byClass('physics-paint-play-script-footer'));
    expect(parentOf(tree, footer)).toBe(surface);
    expect(textOf(findOne(footer, (vnode) => textOf(vnode) === 'Run Script'))).toBe('Run Script');
  });

  it('marks the root with the reveal modifier only on the Reveal tab', () => {
    const paint = renderDialog(createFakeController().controller);
    const paintRoot = findOne(paint, (vnode) => vnode.props?.role === 'dialog');
    expect(hasClass(paintRoot, 'physics-paint-play-script-reveal')).toBe(false);
    const reveal = renderDialog(createFakeController({ railTab: 'reveal' }).controller);
    const revealRoot = findOne(reveal, (vnode) => vnode.props?.role === 'dialog');
    expect(hasClass(revealRoot, 'physics-paint-play-script-reveal')).toBe(true);
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

describe('PhysicsPaintPlayScriptDialog floating shell', () => {
  it('renders a non-modal floating surface with no blocking backdrop', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const root = findOne(tree, (vnode) => vnode.props?.role === 'dialog');
    expect(root.props['aria-modal']).toBeUndefined();
    expect(findAll(root, byClass('physics-paint-play-script-backdrop'))).toHaveLength(0);
    const surface = findOne(root, byClass('physics-paint-play-script-surface'));
    expect(parentOf(root, surface)).toBe(root);
  });

  it('keeps the 48px header (badge + title, range + Close) and the footer INSIDE the modal surface', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const surface = findOne(tree, byClass('physics-paint-play-script-surface'));
    const header = findOne(surface, byClass('physics-paint-play-script-header'));
    expect(parentOf(surface, header)).toBe(surface);
    const main = findOne(header, byClass('physics-paint-play-script-header-main'));
    expect(findOne(main, byClass('physics-paint-play-script-header-badge'))).toBeDefined();
    expect(textOf(findOne(main, byId('physics-play-script-title')))).toBe('Run Script');
    expect(textOf(findOne(header, byClass('physics-paint-play-script-header-range')))).toBe('Max 4 · F4–F7');

    // T-261101-CD5-01: Close never starts the header drag and routes only through
    // the existing cancel path.
    const close = findOne(header, byClass('physics-paint-play-script-close'));
    expect(close.props['aria-label']).toBe('Close');
    const stopPropagation = vi.fn();
    handler(close, 'onPointerDown')({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    handler(close, 'onClick')();
    expect(controller.cancel).toHaveBeenCalledTimes(1);
    expect(controller.confirm).not.toHaveBeenCalled();

    // Footer (progress + Cancel/Generate) renders inside the modal surface,
    // after the workspace that carries the tabs and panel.
    const footer = findOne(surface, byClass('physics-paint-play-script-footer'));
    expect(parentOf(surface, footer)).toBe(surface);
    const surfaceChildren = childrenOf(surface).filter((child): child is TestVNode =>
      typeof child === 'object' && child !== null && !Array.isArray(child));
    const headerIndex = surfaceChildren.findIndex((child) => hasClass(child, 'physics-paint-play-script-header'));
    const workspaceIndex = surfaceChildren.findIndex((child) => hasClass(child, 'physics-paint-play-script-workspace'));
    const footerIndex = surfaceChildren.findIndex((child) => hasClass(child, 'physics-paint-play-script-footer'));
    expect(headerIndex).toBe(0);
    expect(workspaceIndex).toBeGreaterThan(headerIndex);
    expect(footerIndex).toBeGreaterThan(workspaceIndex);
  });
});

describe('PhysicsPaintPlayScriptDialog mode segmented control (D-05, PLAY-03)', () => {
  it('renders the RAIL TYPE subheader with two radio options, roving tabindex and the Paint Motion helper', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const modeCard = findOne(tree, byClass('physics-paint-play-script-card-mode'));
    expect(hasClass(modeCard, 'physics-paint-play-script-rail-row')).toBe(true);
    expect(hasClass(modeCard, 'physics-paint-play-script-card')).toBe(false);
    expect(textOf(findOne(modeCard, byClass('physics-paint-play-script-rail-label')))).toBe('RAIL TYPE');
    const group = findOne(modeCard, byRadioGroup('Rail Type'));
    expect(group.props['aria-describedby']).toBeUndefined();
    const radios = findAll(group, (vnode) => vnode.props?.role === 'radio');
    expect(radios).toHaveLength(2);
    expect(textOf(radios[0])).toBe('Motion');
    expect(textOf(radios[1])).toBe('Static');
    expect(radios[0].props['aria-checked']).toBe(true);
    expect(radios[0].props.tabIndex).toBe(0);
    expect(radios[1].props['aria-checked']).toBe(false);
    expect(radios[1].props.tabIndex).toBe(-1);
    expect(textOf(findOne(modeCard, byClass('physics-paint-play-script-rail-helper')))).toBe('Builds the paint stroke by stroke');
    expect(findAll(tree, byId('physics-play-script-mode-helper'))).toHaveLength(0);
  });

  it('names the active creation variant in the rail-row helper for all four views and the stack', () => {
    const helperText = (seed: Partial<FakeControllerSeed>) => textOf(findOne(
      renderDialog(createFakeController(seed).controller),
      byClass('physics-paint-play-script-rail-helper'),
    ));
    expect(helperText({})).toBe('Builds the paint stroke by stroke');
    expect(helperText({ mode: 'static' })).toBe('Holds one painted pose per cycle');
    expect(helperText({ railTab: 'reveal' })).toBe('Reveals the photo progressively');
    expect(helperText({ railTab: 'reveal', mode: 'static' })).toBe('Reveals with per-frame variation');
    expect(helperText({
      runDestination: { kind: 'stack', clipId: 'L1' },
      stackRailKind: 'playscript',
      repeatLocked: true,
      framesMax: 6,
    })).toBe('This run merges into the rail — the result is one Standard Rail.');
  });

  it('arrow keys move focus AND check with wrap-around', () => {
    const { controller, signals } = createFakeController({ countText: '3' });
    let tree = renderDialog(controller);
    const radioElements = [{ focus: vi.fn() }, { focus: vi.fn() }];
    const keydown = (key: string) => handler(findOne(tree, byRadioGroup('Rail Type')), 'onKeyDown')({
      key,
      preventDefault: vi.fn(),
      currentTarget: { querySelectorAll: () => radioElements },
    });

    keydown('ArrowRight');
    expect(signals.mode.value).toBe('static');
    expect(radioElements[1].focus).toHaveBeenCalledTimes(1);

    tree = renderDialog(controller);
    const updated = findAll(findOne(tree, byRadioGroup('Rail Type')), (vnode) => vnode.props?.role === 'radio');
    expect(updated[1].props['aria-checked']).toBe(true);
    expect(updated[1].props.tabIndex).toBe(0);
    expect(updated[0].props['aria-checked']).toBe(false);
    expect(updated[0].props.tabIndex).toBe(-1);
    expect(findAll(tree, byId('physics-play-script-mode-helper'))).toHaveLength(0);

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
    const radios = findAll(findOne(tree, byRadioGroup('Rail Type')), (vnode) => vnode.props?.role === 'radio');
    handler(radios[1], 'onClick')({ currentTarget: { focus: vi.fn() } });
    expect(signals.mode.value).toBe('static');
  });
});

describe('PhysicsPaintPlayScriptDialog frame field (D-03 revised)', () => {
  it("switches the single shared field label between 'Frames' and 'Frames per cycle' with the mode", () => {
    const { controller, signals } = createFakeController();
    let tree = renderDialog(controller);
    expect(findOne(tree, byId('physics-play-script-count')).props.label).toBe('Frames');
    signals.mode.value = 'static';
    tree = renderDialog(controller);
    expect(findOne(tree, byId('physics-play-script-count')).props.label).toBe('Frames per cycle');
    // Still ONE shared input — no second field appears in Static / Hold.
    expect(findAll(tree, byId('physics-play-script-count'))).toHaveLength(1);
    expect(findAll(tree, byId('physics-play-script-help'))).toHaveLength(0);
  });

  it('keeps the finite Frames draft unchanged when switching between Motion and Static', () => {
    const { controller, signals } = createFakeController({ countText: '3' });
    let tree = renderDialog(controller);
    const radios = findAll(findOne(tree, byRadioGroup('Rail Type')), (vnode) => vnode.props?.role === 'radio');
    handler(radios[1], 'onClick')({ currentTarget: { focus: vi.fn() } });
    expect(signals.mode.value).toBe('static');
    expect(signals.countText.value).toBe('3');

    signals.countText.value = '6';
    tree = renderDialog(controller);
    handler(findOne(tree, byRadioGroup('Rail Type')), 'onKeyDown')({
      key: 'ArrowLeft',
      preventDefault: vi.fn(),
      currentTarget: { querySelectorAll: () => [{ focus: vi.fn() }, { focus: vi.fn() }] },
    });
    expect(signals.mode.value).toBe('progressive');
    expect(signals.countText.value).toBe('6');
  });
});

describe('PhysicsPaintPlayScriptDialog Timing card (D-12/D-13 loop intent, both modes)', () => {
  it('renders distinct Frames + Max and Repeat + Infinity controls in BOTH Rail Types', () => {
    const { controller, signals } = createFakeController();
    for (const mode of ['progressive', 'static'] as const) {
      signals.mode.value = mode;
      const tree = renderDialog(controller);
      const timingCard = findOne(tree, byClass('physics-paint-play-script-card-timing'));
      expect(findOne(timingCard, byId('physics-play-script-count'))).toBeTruthy();
      expect(findOne(timingCard, byId('physics-play-script-max'))).toBeTruthy();
      expect(findOne(timingCard, byId('physics-play-script-repeat'))).toBeTruthy();
      expect(findOne(timingCard, byId('physics-play-script-infinity'))).toBeTruthy();
      expect(textOf(findOne(timingCard, byId('physics-play-script-max')))).toBe('Max');
      expect(textOf(findOne(timingCard, byId('physics-play-script-infinity')))).toBe('Infinity');
    }
  });

  it('binds the repeat field aria-invalid and error span to the controller repeatError channel', () => {
    const { controller } = createFakeController({ repeatError: 'Cycle count is too large for this cycle length.' });
    const tree = renderDialog(controller);
    expect(findOne(tree, byId('physics-play-script-repeat')).props.ariaInvalid).toBe(true);
    expect(textOf(findOne(tree, byId('physics-play-script-repeat-error')))).toBe('Cycle count is too large for this cycle length.');
  });

  it('wires Max and Infinity through their distinct controller boundaries only', () => {
    const { controller, signals } = createFakeController();
    const tree = renderDialog(controller);
    handler(findOne(tree, byId('physics-play-script-max')), 'onClick')();
    expect(controller.setMax).toHaveBeenCalledTimes(1);
    expect(controller.setMax).toHaveBeenCalledWith(true);
    expect(controller.setInfinity).not.toHaveBeenCalled();
    expect(signals.max.value).toBe(false);
    expect(signals.lastFiniteCount.value).toBe('3');

    handler(findOne(tree, byId('physics-play-script-infinity')), 'onClick')();
    expect(controller.setInfinity).toHaveBeenCalledTimes(1);
    expect(controller.setInfinity).toHaveBeenCalledWith(true);
    expect(controller.setMax).toHaveBeenCalledTimes(1);
    expect(signals.infinity.value).toBe(false);
    expect(signals.lastFiniteRepeat.value).toBe('1');
  });

  it('keeps each finite value visible while its matching capacity toggle disables the input', () => {
    const { controller } = createFakeController({ max: true, countText: '5', infinity: true, repeatText: '7', loopReadout: 'Cycle 4f × ∞ · Effective: 4f' });
    const tree = renderDialog(controller);
    const count = findOne(tree, byId('physics-play-script-count'));
    const repeat = findOne(tree, byId('physics-play-script-repeat'));
    expect(count.props.disabled).toBe(true);
    expect(count.props.value).toBe(5);
    expect(repeat.props.disabled).toBe(true);
    expect(repeat.props.value).toBe(7);
  });
});

describe('PhysicsPaintPlayScriptDialog color segmented control (D-08R/D-18)', () => {
  it("261101-cd5: renders the compact radiogroup with exactly two options 'Original' and 'Custom' in a mini segmented skin", () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const group = findOne(tree, byRadioGroup('Color'));
    expect(hasClass(group, 'physics-paint-play-script-mode-group-mini')).toBe(true);
    const radios = findAll(group, (vnode) => vnode.props?.role === 'radio');
    expect(radios).toHaveLength(2);
    expect(textOf(radios[0])).toBe('Original');
    expect(textOf(radios[1])).toBe('Custom');
  });

  it("has 'Original' checked and the override disabled by default", () => {
    const { controller, signals } = createFakeController();
    const tree = renderDialog(controller);
    const radios = findAll(findOne(tree, byRadioGroup('Color')), (vnode) => vnode.props?.role === 'radio');
    expect(radios[0].props['aria-checked']).toBe(true);
    expect(radios[0].props.tabIndex).toBe(0);
    expect(radios[1].props['aria-checked']).toBe(false);
    expect(radios[1].props.tabIndex).toBe(-1);
    expect(signals.overrideEnabled.value).toBe(false);
    // The swatches live beside the Color title; the old copy row is gone.
    const card = findOne(tree, byClass('physics-paint-play-script-card-color'));
    const heading = findOne(card, byClass('physics-paint-play-script-card-heading'));
    expect(findAll(heading, byClass('physics-paint-play-script-color-dots'))).toHaveLength(1);
    expect(findAll(heading, (vnode) => vnode.type === 'i')).toHaveLength(4);
    expect(findAll(tree, byClass('physics-paint-play-script-color-original-row'))).toHaveLength(0);
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

  it("261101-cd5: checking 'Custom' sets overrideEnabled and renders the CURRENT brushColor prop as a swatch with the hex beneath — live, with no dialog-side copy", () => {
    const { controller, signals } = createFakeController();
    let tree = renderDialog(controller, '#3366ff');
    const radios = findAll(findOne(tree, byRadioGroup('Color')), (vnode) => vnode.props?.role === 'radio');
    handler(radios[1], 'onClick')({ currentTarget: { focus: vi.fn() } });
    expect(signals.overrideEnabled.value).toBe(true);

    tree = renderDialog(controller, '#3366ff');
    const chip = findOne(tree, byClass('physics-paint-play-script-color-custom-chip'));
    const swatch = findOne(chip, byClass('physics-paint-play-script-override-chip'));
    expect((swatch.props.style as { backgroundColor?: string }).backgroundColor).toBe('#3366ff');
    // The hex sits under the swatch — same live prop, no dialog-side color state.
    expect(textOf(findOne(chip, byClass('physics-paint-play-script-color-hex')))).toBe('#3366ff');
    // Custom replaces the four original dots.
    expect(findAll(tree, byClass('physics-paint-play-script-color-dots'))).toHaveLength(0);

    // The chip/hex track the prop live — re-rendering with a new brush color updates them
    // without any dialog-side color state (D-08R/D-18).
    tree = renderDialog(controller, '#aa5500');
    const updatedChip = findOne(tree, byClass('physics-paint-play-script-override-chip'));
    expect((updatedChip.props.style as { backgroundColor?: string }).backgroundColor).toBe('#aa5500');
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-color-hex')))).toBe('#aa5500');
  });

  it("261101-cd5: checking 'Original' sets overrideEnabled false and collapses the custom chip", () => {
    const { controller, signals } = createFakeController({ overrideEnabled: true });
    let tree = renderDialog(controller);
    // Custom shows the swatch + hex chip in place of the dots.
    expect(findAll(tree, byClass('physics-paint-play-script-color-custom-chip'))).toHaveLength(1);
    const radios = findAll(findOne(tree, byRadioGroup('Color')), (vnode) => vnode.props?.role === 'radio');
    handler(radios[0], 'onClick')({ currentTarget: { focus: vi.fn() } });
    expect(signals.overrideEnabled.value).toBe(false);
    tree = renderDialog(controller);
    expect(findAll(tree, byClass('physics-paint-play-script-color-custom-chip'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-color-pane'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-color-dots'))).toHaveLength(1);
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
    handler(findOne(tree, byId('physics-play-script-motion-deformation')), 'onChange')(42);
    expect(signals.dialogMotion.value).toEqual({ deformation: 42, position: 40, rotation: 0, scale: 0 });
    handler(findOne(tree, byId('physics-play-script-motion-position')), 'onChange')(260);
    expect(signals.dialogMotion.value).toEqual({ deformation: 42, position: 100, rotation: 0, scale: 0 });
  });

  it('261030-ey9: renders Rotation and Scale rows after Position and routes them into dialogMotion with the clamp', () => {
    const { controller, signals } = createFakeController();
    const tree = renderDialog(controller);
    const card = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-play-script-card-motion'));
    const ids = findAll(card, (vnode) => vnode.props?.id !== undefined).map((vnode) => String(vnode.props.id));
    expect(ids.indexOf('physics-play-script-motion-rotation')).toBeGreaterThan(ids.indexOf('physics-play-script-motion-position'));
    expect(ids.indexOf('physics-play-script-motion-scale')).toBeGreaterThan(ids.indexOf('physics-play-script-motion-rotation'));
    const rotationRow = findOne(tree, byId('physics-play-script-motion-rotation'));
    expect(rotationRow.props.label).toBe('Rotation');
    expect(rotationRow.props.disabled).toBe(false);
    handler(rotationRow, 'onChange')(73);
    expect(signals.dialogMotion.value).toEqual({ deformation: 25, position: 40, rotation: 73, scale: 0 });
    const scaleRow = findOne(tree, byId('physics-play-script-motion-scale'));
    expect(scaleRow.props.label).toBe('Scale');
    handler(scaleRow, 'onChange')(130);
    expect(signals.dialogMotion.value).toEqual({ deformation: 25, position: 40, rotation: 73, scale: 100 });
  });

  it('261030-ey9: a prefill source that omits rotation/scale renders 0, never undefined', () => {
    const { controller, signals } = createFakeController();
    signals.dialogMotion.value = { deformation: 5, position: 10, rotation: 0, scale: 0 };
    const tree = renderDialog(controller);
    expect(findOne(tree, byId('physics-play-script-motion-rotation')).props.value).toBe(0);
    expect(findOne(tree, byId('physics-play-script-motion-scale')).props.value).toBe(0);
    expect(findOne(tree, byId('physics-play-script-motion-rotation')).props.value).not.toBeUndefined();
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
    expect(findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Run Script').props.disabled).toBe(false);
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
    expect(findOne(tree, byId('physics-play-script-count')).props.disabled).toBe(true);
    expect(findOne(tree, byId('physics-play-script-repeat')).props.disabled).toBe(true);
    expect(findOne(tree, byId('physics-play-script-max')).props.disabled).toBe(true);
    expect(findOne(tree, byId('physics-play-script-infinity')).props.disabled).toBe(true);
    expect(findOne(tree, byId('physics-play-script-motion-deformation')).props.disabled).toBe(true);
    const footer = findOne(tree, byClass('physics-paint-play-script-footer'));
    expect(findOne(footer, (vnode) => vnode.type === 'progress')).toBeTruthy();
    expect(textOf(tree)).toContain('Cancel generation');
  });

  it('starts the progress bar during preparing with the phase label (UAT 261031-i54)', () => {
    const { controller } = createFakeController({
      canCancel: true,
      phase: 'preparing',
      progress: null,
      status: 'Preparing Run Script…',
    });
    const tree = renderDialog(controller);
    const footer = findOne(tree, byClass('physics-paint-play-script-footer'));
    const bar = findOne(footer, (vnode) => vnode.type === 'progress');
    // No value = indeterminate: the bar exists before the first frame commits.
    expect(bar.props.value).toBeUndefined();
    expect(textOf(footer)).toContain('Preparing Run Script…');
  });

  it('keeps the full bar but names the post-bake phase while committing (UAT 261031-i54)', () => {
    const { controller } = createFakeController({
      canCancel: false,
      phase: 'committing',
      progress: { completed: 10, total: 10 },
      status: 'Committing Run Script…',
    });
    const tree = renderDialog(controller);
    const footer = findOne(tree, byClass('physics-paint-play-script-footer'));
    const bar = findOne(footer, (vnode) => vnode.type === 'progress');
    expect(bar.props.value).toBe(10);
    expect(bar.props.max).toBe(10);
    expect(textOf(footer)).toContain('Committing Run Script…');
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

  it('does not trap Tab inside the floating dialog', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const root = findOne(tree, (vnode) => vnode.props?.role === 'dialog');
    const preventDefault = vi.fn();
    handler(root, 'onKeyDown')({ key: 'Tab', preventDefault, stopPropagation: vi.fn(), currentTarget: null });
    expect(preventDefault).not.toHaveBeenCalled();
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
    // 261101-cd5: the segmented labels are the short forms; the custom color
    // reads live from the brush (swatch + hex), never from dialog-side copy.
    expect(source).toContain("{ value: false, label: 'Original' }");
    expect(source).toContain("{ value: true, label: 'Custom' }");
    expect(source).not.toContain("Picked from the app's brush color panel");
    expect(source).toContain('Use brush color');
    expect(source).toContain('GLOBAL OPTIONS');
    expect(source).toContain("label: 'Link'");
    expect(source).toContain("label: 'Create'");
    expect(source).not.toContain("Keep each stroke's original paint color.");
    expect(source).toContain('Frames per cycle');
    expect(source).toContain('Motion wiggle');
    expect(source).toContain('Reset defaults');
    expect(source).not.toContain('The drawing builds stroke by stroke across frames.');
    expect(source).not.toContain('The complete drawing is applied to every cycle frame.');
    expect(source).not.toContain('Save as defaults');
    expect(source).not.toContain('Reset to Motion defaults');
    expect(source).not.toContain('Cycle frames');
    expect(source).not.toContain('updatePanelMotion');
    expect(source).not.toContain('createPortal');
  });
});

describe('PhysicsPaintPlayScriptDialog header drag', () => {
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
});

describe('PhysicsPaintPlayScriptDialog pending Loop Clip authority transition', () => {
  it('renders Edit Rail immediately from the accepted local loop while authority is pending', () => {
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
      getActiveTrackId: () => launchContext.document?.activeTrackId ?? '',
      getSelection: () => ({ kind: 'real-key', keyId: 'source-1', appFrame: 10 }),
      getMotion: () => ({ deformation: 0, position: 0 }),
      getBrushColor: () => '#103c65',
      getBackgroundMetadata: () => ({ background: 'canvas1', grainStrength: 0.45 }),
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
      title: 'Edit Rail',
    });
  });

  it('renders Edit Rail from a valid local snapshot while the project has unsaved changes', async () => {
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
      getActiveTrackId: () => launchContext.document?.activeTrackId ?? '',
      getSelection: () => ({ kind: 'real-key', keyId: 'source-1', appFrame: 10 }),
      getMotion: () => ({ deformation: 0, position: 0 }),
      getBrushColor: () => '#103c65',
      getBackgroundMetadata: () => ({ background: 'canvas1', grainStrength: 0.45 }),
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
      title: 'Edit Rail',
    });
  });
});

// 43-06 Task 2 (D-01/D-02/D-05): loop-edit (S2), source-edit (S3), and the
// apply-time Link/Create choice (S4) on the SAME Phase 42 modal shell.
describe('PhysicsPaintPlayScriptDialog loop-edit mode (S2, D-01)', () => {
  // 261031-vbo: a TYPED rail carries single-script provenance; a provenance-free
  // non-Reveal clip now classifies as a merged Standard Rail.
  const target = { loopId: 'L1', placementStart: 10, sourceKeyIds: ['S1', 'S2', 'S3', 'S4', 'S5'], repeat: 3 as const, mode: 'static' as const, scriptId: 'script-1' };
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

  it('renders the locked title, range readout, and the Update Static / Regenerate Group actions', () => {
    const { controller } = createFakeController(loopEditSeed);
    const tree = renderDialog(controller);
    expect(textOf(findOne(tree, byId('physics-play-script-title')))).toBe('Edit Rail');
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-header-range')))).toBe('F10 · Cycle 5f');
    const footer = findOne(tree, byClass('physics-paint-play-script-actions'));
    expect(textOf(findOne(footer, (vnode) => textOf(vnode) === 'Update Static'))).toBe('Update Static');
    expect(textOf(findOne(footer, (vnode) => textOf(vnode) === 'Regenerate Rail'))).toBe('Regenerate Rail');
    expect(findAll(footer, (vnode) => textOf(vnode) === 'Update Motion')).toHaveLength(0);
    expect(findAll(footer, (vnode) => textOf(vnode) === 'Run Script')).toHaveLength(0);
    expect(findAll(footer, (vnode) => textOf(vnode) === 'Regenerate source cycle')).toHaveLength(0);
  });

  it('uses Update Motion for a Motion Rail without changing the loop-edit action route', () => {
    const { controller } = createFakeController({
      ...loopEditSeed,
      mode: 'progressive',
      loopEditTarget: { ...target, mode: 'progressive' },
    });
    const tree = renderDialog(controller);
    const updateMotion = findOne(tree, (vnode) => textOf(vnode) === 'Update Motion');
    handler(updateMotion, 'onClick')();
    expect(controller.confirm).toHaveBeenCalledTimes(1);
    expect(findAll(tree, (vnode) => textOf(vnode) === 'Update Static')).toHaveLength(0);
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
    expect(findOne(tree, byId('physics-play-script-count')).props.value).toBe(3);
  });

  it('locks Frames-per-cycle and every source field at reduced opacity with values preserved; ONLY Repeat + Infinity stay editable', () => {
    const { controller } = createFakeController(loopEditSeed);
    const tree = renderDialog(controller);
    // Frames-per-cycle input: disabled, value preserved.
    const countInput = findOne(tree, byId('physics-play-script-count'));
    expect(countInput.props.disabled).toBe(true);
    expect(countInput.props.value).toBe(5);
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
    // Repeat + Infinity remain editable; Max stays locked with the source count.
    expect(findOne(tree, byId('physics-play-script-repeat')).props.disabled).toBe(false);
    expect(findOne(tree, byId('physics-play-script-infinity')).props.disabled).toBe(false);
    expect(findOne(tree, byId('physics-play-script-max')).props.disabled).toBe(true);
    // The Requested/Effective readout renders in the summary bar.
    const bar = findOne(tree, byClass('physics-paint-play-script-summary-bar'));
    expect(textOf(findOne(bar, byClass('physics-paint-play-script-summary-requested')))).toBe('Requested: 15f (5f × 3)');
    expect(textOf(findOne(bar, byClass('physics-paint-play-script-summary-effective')))).toBe('Effective: 8f — shortened by the next clip');
  });

  it('Update Static confirms; Regenerate Group opens the source-edit mode for the target loop', () => {
    const { controller } = createFakeController(loopEditSeed);
    const tree = renderDialog(controller);
    handler(findOne(tree, (vnode) => textOf(vnode) === 'Update Static'), 'onClick')();
    expect(controller.confirm).toHaveBeenCalledTimes(1);
    handler(findOne(tree, (vnode) => textOf(vnode) === 'Regenerate Rail'), 'onClick')();
    expect(controller.openSourceEdit).toHaveBeenCalledWith('L1');
  });

  it('keeps Update Static disabled while Repeat is invalid', () => {
    const { controller } = createFakeController({ ...loopEditSeed, repeatError: 'Enter a positive integer.' });
    const tree = renderDialog(controller);
    expect(findOne(tree, (vnode) => textOf(vnode) === 'Update Static').props.disabled).toBe(true);
  });
});

// 261031-vbo (Quick C1): a merged Standard Rail is a merge of RESULTS, not a
// rail type — the dialog never presents the stored `mode` as Motion/Static.
describe('PhysicsPaintPlayScriptDialog merged Standard Rail edit target (261031-vbo)', () => {
  const mergedTarget = {
    loopId: 'M1',
    placementStart: 10,
    sourceKeyIds: ['S1', 'S2', 'S3'],
    repeat: 2 as const,
    mode: 'static' as const,
  };
  const mergedSeed = {
    dialogMode: 'loop-edit' as const,
    loopEditTargetId: 'M1',
    loopEditTarget: mergedTarget,
    loopEditSourceStart: 10,
    mode: 'static' as const,
    countText: '3',
    repeatText: '2',
  };

  it('shows a read-only Standard rail type and no Motion/Static rail-type radios', () => {
    const { controller } = createFakeController(mergedSeed);
    const tree = renderDialog(controller);
    const modeCard = findOne(tree, byClass('physics-paint-play-script-card-mode'));
    expect(textOf(findOne(modeCard, byClass('physics-paint-play-script-rail-label')))).toBe('RAIL TYPE');
    expect(textOf(findOne(modeCard, byClass('physics-paint-play-script-standard-rail-value')))).toBe('Standard');
    expect(findAll(modeCard, byClass('physics-paint-play-script-rail-helper'))).toHaveLength(0);
    expect(findAll(modeCard, byRadioGroup('Rail Type'))).toHaveLength(0);
    expect(findAll(modeCard, (vnode) => textOf(vnode) === 'Motion')).toHaveLength(0);
    expect(findAll(modeCard, (vnode) => textOf(vnode) === 'Static')).toHaveLength(0);
  });

  it('labels the primary action Update Rail', () => {
    const { controller } = createFakeController(mergedSeed);
    const tree = renderDialog(controller);
    const footer = findOne(tree, byClass('physics-paint-play-script-actions'));
    expect(textOf(findOne(footer, (vnode) => textOf(vnode) === 'Update Rail'))).toBe('Update Rail');
    expect(findAll(tree, (vnode) => textOf(vnode) === 'Update Static')).toHaveLength(0);
    expect(findAll(tree, (vnode) => textOf(vnode) === 'Update Motion')).toHaveLength(0);
  });

  it('disables Regenerate Rail with the merged-rail reason as its title', () => {
    const { controller } = createFakeController(mergedSeed);
    const tree = renderDialog(controller);
    const trigger = findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Regenerate Rail');
    expect(trigger.props.disabled).toBe(true);
    expect(trigger.props.title).toBe(STANDARD_RAIL_REGENERATE_REASON);
    expect(trigger.props['aria-disabled']).toBe('true');
  });
});

describe('PhysicsPaintPlayScriptDialog Rail Regenerate confirmation (43.2-09 G3a)', () => {
  const impact = {
    actionId: 'action-1',
    actionRevision: 'action-revision-1',
    actionHash: 'action-deadbeef',
    documentRevision: 'document-1',
    initiatingGroupId: 'G1',
    groupName: 'A very long Group name that must wrap without horizontal scrolling',
    groupType: 'Static' as const,
    restoredRange: 'F10–F19',
    locallyPaintedFrameCount: 2,
    deletedFrameCount: 3,
    deletedFrameRanges: 'F13, F16–F17',
    fragmentCount: 3,
    gapRanges: 'F13, F16–F17',
    affectedGroups: [{ groupId: 'G1', name: 'Rail at F10', range: 'F10–F19' }],
    sourceCacheEffects: 'Rebuilds the saved Script source cycle and refreshes the Rail cache.',
    storedSettings: { mode: 'static' as const, motion: { deformation: 0, position: 0 }, overrideColor: null, sourceKeyIds: ['S1', 'S2', 'S3'] },
  };
  const sourceEditSeed = {
    dialogMode: 'source-edit' as const,
    loopEditTargetId: 'G1',
    loopEditTarget: { loopId: 'G1', placementStart: 10, sourceKeyIds: ['S1', 'S2', 'S3'], repeat: 3 as const, mode: 'static' as const },
    mode: 'static' as const,
    countText: '3',
    repeatText: '3',
    sourceEditSharedLoopCount: 1,
    regenerateImpact: impact,
  };

  it('replaces the editable body with the exact ordered nine-fact disclosure and no thumbnails', () => {
    const { controller } = createFakeController(sourceEditSeed);
    const tree = renderDialog(controller);
    expect(textOf(findOne(tree, byId('physics-play-script-title')))).toBe(`Regenerate “${impact.groupName}”?`);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-regenerate-lead')))).toBe('Regenerate discards accepted local Rail changes and restores the result from the saved Script and stored Rail settings.');
    const facts = findAll(tree, byClass('physics-paint-play-script-regenerate-fact'));
    expect(facts.map((fact) => textOf(findOne(fact, (vnode) => vnode.type === 'dt')))).toEqual([
      'Rail', 'Rail Type', 'Restored range', 'Locally painted frames', 'Deleted frames', 'Fragments', 'Gaps cleared', 'Result', 'Source/cache effects',
    ]);
    expect(facts.map((fact) => textOf(findOne(fact, (vnode) => vnode.type === 'dd')))).toEqual([
      impact.groupName,
      'Static',
      'F10–F19',
      '2',
      '3 · F13, F16–F17',
      '3 → 1',
      'F13, F16–F17',
      'Synchronized with Script.',
      impact.sourceCacheEffects,
    ]);
    expect(findAll(tree, (vnode) => vnode.type === 'img' || hasClass(vnode, 'thumbnail'))).toHaveLength(0);
    expect(findAll(tree, byId('physics-play-script-count'))).toHaveLength(0);
    expect(textOf(findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Keep Local Changes'))).toBe('Keep Local Changes');
    expect(textOf(findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Regenerate Rail'))).toBe('Regenerate Rail');
  });

  it('lists shared Groups once in placement order and uses the exact plural lead and CTA', () => {
    const shared = {
      ...impact,
      affectedGroups: [
        { groupId: 'G1', name: 'Rail at F10', range: 'F10–F19' },
        { groupId: 'G2', name: 'Rail at F30', range: 'F30–F39' },
        { groupId: 'G3', name: 'Rail at F80', range: 'F80–F89' },
      ],
    };
    const { controller } = createFakeController({ ...sourceEditSeed, regenerateImpact: shared, sourceEditSharedLoopCount: 3 });
    const tree = renderDialog(controller);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-regenerate-shared-lead')))).toBe('Regenerate will update 3 Rails that share the same accepted source cycle.');
    expect(findAll(tree, byClass('physics-paint-play-script-regenerate-group-item')).map(textOf)).toEqual([
      'Rail at F10 · F10–F19',
      'Rail at F30 · F30–F39',
      'Rail at F80 · F80–F89',
    ]);
    expect(textOf(findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Regenerate 3 Rails'))).toBe('Regenerate 3 Rails');
  });

  it('returns to Edit Rail without mutation, disables acceptance while busy, and keeps stale rejection in an alert', () => {
    const idle = createFakeController(sourceEditSeed);
    let tree = renderDialog(idle.controller);
    handler(findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Keep Local Changes'), 'onClick')();
    expect(idle.controller.openLoopEdit).toHaveBeenCalledWith('G1');
    expect(idle.controller.confirm).not.toHaveBeenCalled();

    const busy = createFakeController({ ...sourceEditSeed, canCancel: true, progress: { completed: 1, total: 3 } });
    tree = renderDialog(busy.controller);
    expect(findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Regenerate Rail').props.disabled).toBe(true);

    const stale = createFakeController({ ...sourceEditSeed, error: 'Regenerate rejected — saved Script changed.' });
    tree = renderDialog(stale.controller);
    const alert = findOne(tree, (vnode) => vnode.props?.role === 'alert');
    expect(textOf(alert)).toBe('Regenerate rejected — saved Script changed.');
    expect(textOf(findOne(tree, byId('physics-play-script-title')))).toBe(`Regenerate “${impact.groupName}”?`);
  });

});

describe('PhysicsPaintPlayScriptDialog apply-time Link/Create choice (S4, D-05)', () => {
  const identical = { sourceKeyIds: ['S1', 'S2', 'S3', 'S4', 'S5'], loopCount: 2, sourceStart: 10 };

  it('renders nothing when the controller reports no identical source cycle', () => {
    const { controller } = createFakeController({ identicalSourceCycle: null, loopIntentActive: true });
    const tree = renderDialog(controller);
    expect(findAll(tree, byClass('physics-paint-play-script-card-source-choice'))).toHaveLength(0);
  });

  it('261101-cd5: renders the compact Link/Create segmented control with a one-line helper, Link selected by default with the source range and linked count', () => {
    const { controller } = createFakeController({ identicalSourceCycle: identical, loopIntentActive: true, linkChoice: 'link' });
    const tree = renderDialog(controller);
    const card = findOne(tree, byClass('physics-paint-play-script-card-source-choice'));
    expect(textOf(findOne(card, (vnode) => textOf(vnode) === 'Link'))).toBe('Link');
    expect(textOf(findOne(card, (vnode) => textOf(vnode) === 'Create'))).toBe('Create');
    // The compact skin is the mini segmented group.
    expect(hasClass(findOne(card, byRadioGroup('Source cycle')), 'physics-paint-play-script-mode-group-mini')).toBe(true);
    // The full helper stays available twice: a visible one-line subline (title
    // carries the whole copy) and the hidden described-by node.
    const helper = findOne(card, byId('physics-play-script-source-helper'));
    expect(textOf(helper)).toContain('Reuses the existing source cycle. Future source edits update every linked loop.');
    expect(textOf(helper)).toContain('Source F10–F14 · 2 linked loop(s).');
    expect(hasClass(helper, 'physics-paint-play-script-visually-hidden')).toBe(true);
    const subline = findOne(card, byClass('physics-paint-play-script-card-subline'));
    expect(textOf(subline)).toBe(textOf(helper));
    expect(subline.props.title).toBe(textOf(helper));
    expect(findOne(card, byRadioGroup('Source cycle')).props['aria-describedby']).toBe('physics-play-script-source-helper');
    const linkRadio = findOne(card, (vnode) => textOf(vnode) === 'Link');
    expect(linkRadio.props['aria-checked']).toBe(true);
  });

  it('switching to Create updates the controller linkChoice and shows the Create helper', () => {
    const { controller, signals } = createFakeController({ identicalSourceCycle: identical, loopIntentActive: true, linkChoice: 'link' });
    let tree = renderDialog(controller);
    handler(findOne(tree, (vnode) => textOf(vnode) === 'Create'), 'onClick')({ currentTarget: null });
    expect(signals.linkChoice.value).toBe('create');
    tree = renderDialog(controller);
    const card = findOne(tree, byClass('physics-paint-play-script-card-source-choice'));
    const helper = findOne(card, byId('physics-play-script-source-helper'));
    expect(textOf(helper)).toContain('Creates an independent source cycle. Future edits do not affect the existing loops.');
    expect(textOf(findOne(card, byClass('physics-paint-play-script-card-subline')))).toBe(textOf(helper));
  });
});

describe('PhysicsPaintPlayScriptDialog 43-06 copy + token contract', () => {
  it('ships the revised Rail action labels in normal casing and never the prohibited terms', () => {
    for (const locked of ['Edit Rail', 'Edit Source Cycle', 'Update Motion', 'Update Static', 'Update Rail', 'Regenerate Rail', 'Regenerate source cycle', 'Keep Local Changes', 'Cancel']) {
      expect(source).toContain(locked);
    }
    expect(source).not.toContain('clip bloquant');
    expect((source.match(/clip bloquant/g) ?? []).length).toBe(0);
  });
});

describe('PhysicsPaintPlayScriptDialog Reveal Photo Rail tab (52-05, G-52-3)', () => {
  it('renders the Paint Rail / Reveal Photo Rail tab strip in apply mode only', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    const tablist = findOne(tree, (vnode) => vnode.props?.role === 'tablist' && vnode.props?.['aria-label'] === 'Rail kind');
    const tabs = findAll(tablist, (vnode) => vnode.props?.role === 'tab');
    expect(tabs.map((tab) => textOf(tab))).toEqual(['Paint Rail', 'Reveal Photo Rail']);
    expect(tabs[0].props['aria-selected']).toBe('true');
    expect(tabs[1].props['aria-selected']).toBe('false');
    // The tab click routes through the controller's tab switcher.
    handler(tabs[1], 'onClick')();
    expect(controller.setRailTab).toHaveBeenCalledWith('reveal');
    // Edit modes keep their single-surface layout — no tab strip.
    const loopEditTree = renderDialog(createFakeController({ dialogMode: 'loop-edit', loopEditTarget: { loopId: 'L1', placementStart: 12, sourceKeyIds: ['a', 'b'], repeat: 1, mode: 'static' } }).controller);
    expect(findAll(loopEditTree, (vnode) => vnode.props?.role === 'tablist')).toHaveLength(0);
  });

  it('renders the Reveal tab with Reveal Motion/Static rail types, Timing with the from-hint and Infinity, Motion wiggle, and NO Color card or Max toggle', () => {
    const { controller } = createFakeController({ railTab: 'reveal', canonicalStart: 4 });
    const tree = renderDialog(controller);
    const radios = findAll(findOne(tree, byRadioGroup('Rail Type')), (vnode) => vnode.props?.role === 'radio');
    expect(radios.map((radio) => textOf(radio))).toEqual(['Motion', 'Static']);
    expect(findAll(tree, byId('physics-play-script-mode-helper'))).toHaveLength(0);
    // Frames defaults + the playhead-snapshot hint.
    const frames = findOne(tree, byId('physics-play-script-reveal-count'));
    expect(frames.props.value).toBe(3);
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-card-timing')))).toContain('from F4');
    // Repeat + Infinity ride the same mutation law as the Paint Rail.
    expect(findOne(tree, byId('physics-play-script-repeat'))).toBeDefined();
    expect(findOne(tree, byId('physics-play-script-infinity'))).toBeDefined();
    // No Color card, no Max toggle, no source-cycle choice on the Reveal tab.
    expect(findAll(tree, byClass('physics-paint-play-script-card-color'))).toHaveLength(0);
    expect(findAll(tree, byId('physics-play-script-max'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-source-choice'))).toHaveLength(0);
    // Motion wiggle sliders stay (they feed the bake for BOTH variants — D-09).
    expect(findOne(tree, byClass('physics-paint-play-script-card-motion'))).toBeDefined();
  });

  it('261029-vbp: renders the Colorize card in the Reveal tab only, unchecked with a disabled Mix at 100', () => {
    const { controller, signals } = createFakeController({ railTab: 'reveal' });
    const tree = renderDialog(controller);
    const card = findOne(tree, byClass('physics-paint-play-script-card-colorize'));
    expect(textOf(card)).toContain('Colorize');

    const checkbox = findOne(card, byId('physics-play-script-colorize')) as TestVNode;
    expect(checkbox.props.role).toBe('switch');
    expect(checkbox.props['aria-checked']).toBe('false');
    expect(checkbox.props.disabled).toBe(false);
    handler(checkbox, 'onClick')();
    expect(controller.setColorize).toHaveBeenCalledWith(true);

    const mix = findOne(card, byId('physics-play-script-colorize-mix')) as TestVNode;
    expect(mix.props.type).toBe('range');
    expect(mix.props.min).toBe(0);
    expect(mix.props.max).toBe(100);
    expect(mix.props.value).toBe(100);
    expect(mix.props.disabled).toBe(true); // disabled while unchecked
    handler(mix, 'onInput')({ currentTarget: { value: '30' } });
    expect(controller.setColorizeMix).toHaveBeenCalledWith(30);
    expect(signals.colorize.value).toBe(false);

    // The Paint tab renders no Colorize card.
    const paintTree = renderDialog(createFakeController().controller);
    expect(findAll(paintTree, byClass('physics-paint-play-script-card-colorize'))).toHaveLength(0);
    // The negative-gate assertion stays green: the card is NOT named -card-color.
    expect(findAll(tree, byClass('physics-paint-play-script-card-color'))).toHaveLength(0);
  });

  it('261029-vbp: a seeded colorize enable renders the Mix slider enabled and routes its input', () => {
    const { controller } = createFakeController({ railTab: 'reveal', colorize: true, colorizeMix: 40 });
    const tree = renderDialog(controller);
    const card = findOne(tree, byClass('physics-paint-play-script-card-colorize'));
    const checkbox = findOne(card, byId('physics-play-script-colorize')) as TestVNode;
    expect(checkbox.props['aria-checked']).toBe('true');
    const mix = findOne(card, byId('physics-play-script-colorize-mix')) as TestVNode;
    expect(mix.props.value).toBe(40);
    expect(mix.props.disabled).toBe(false);
    handler(mix, 'onInput')({ currentTarget: { value: '30' } });
    expect(controller.setColorizeMix).toHaveBeenCalledWith(30);
  });

  it('261030-ey9: renders the Photo wiggle card in the Reveal tab only, routing the checkbox to the controller', () => {
    const { controller, signals } = createFakeController({ railTab: 'reveal' });
    const tree = renderDialog(controller);
    const card = findOne(tree, byClass('physics-paint-play-script-card-photo-wiggle'));
    expect(textOf(card)).toContain('Photo Wiggle');
    expect(textOf(card)).toContain('Move photo and wash together');
    // 261101-cd5: the global cards share one equal-width row — Photo Wiggle
    // follows Paint Seed.
    const row = findOne(tree, byClass('physics-paint-play-script-global-row'));
    expect(renderedParentOf(tree, card)).toBe(row);
    const rowCards = globalRowCards(tree);
    const seedCard = findOne(tree, byClass('physics-paint-play-script-card-paint-seed-variation'));
    expect(rowCards.indexOf(card)).toBeGreaterThan(rowCards.indexOf(seedCard));

    const checkbox = findOne(card, byId('physics-play-script-photo-wiggle')) as TestVNode;
    expect(checkbox.props.role).toBe('switch');
    // The switch's accessible name keeps the full sentence even though the
    // visible label is the compact subline.
    expect(checkbox.props['aria-label']).toBe('Wiggle photo and wash together');
    expect(checkbox.props['aria-checked']).toBe('false');
    expect(checkbox.props.disabled).toBe(false);
    handler(checkbox, 'onClick')();
    expect(controller.setPhotoWiggle).toHaveBeenCalledWith(true);
    // The dialog never writes the signal itself — the controller owns it.
    expect(signals.photoWiggle.value).toBe(false);

    // A seeded enable renders checked.
    const seeded = renderDialog(createFakeController({ railTab: 'reveal', photoWiggle: true }).controller);
    expect((findOne(seeded, byId('physics-play-script-photo-wiggle')) as TestVNode).props['aria-checked']).toBe('true');

    // The Paint tab renders no Photo wiggle card.
    const paintTree = renderDialog(createFakeController().controller);
    expect(findAll(paintTree, byClass('physics-paint-play-script-card-photo-wiggle'))).toHaveLength(0);
  });

  it('261030-ig0: renders the Key Script opt-in on the Paint tab only, defaulting unchecked', () => {
    const { controller, signals } = createFakeController();
    const tree = renderDialog(controller);
    const card = findOne(tree, byClass('physics-paint-play-script-card-key-script'));
    expect(textOf(card)).toContain('Key Script');
    expect(textOf(card)).toContain('Save a script on each key');
    // 261101-cd5: the compact card keeps the full switch name for AT.
    expect((findOne(card, byId('physics-play-script-key-script-edits')) as TestVNode).props['aria-label'])
      .toBe('Save script on each key');
    // 261030-v1t UAT: the long Paint hint is gone — title + toggle only.
    expect(textOf(card)).not.toContain('Each key of this Rail');
    const checkbox = findOne(card, byId('physics-play-script-key-script-edits')) as TestVNode;
    expect(checkbox.props.role).toBe('switch');
    expect(checkbox.props['aria-checked']).toBe('false');
    expect(checkbox.props.disabled).toBe(false);
    handler(checkbox, 'onClick')();
    expect(controller.setKeyScriptEdits).toHaveBeenCalledWith(true);
    // The dialog never writes the signal itself — the controller owns it.
    expect(signals.keyScriptEdits.value).toBe(false);

    // A seeded enable renders checked.
    const seeded = renderDialog(createFakeController({ keyScriptEdits: true }).controller);
    expect((findOne(seeded, byId('physics-play-script-key-script-edits')) as TestVNode).props['aria-checked']).toBe('true');

    // The Reveal tab does not render the opt-in.
    const reveal = renderDialog(createFakeController({ railTab: 'reveal' }).controller);
    expect(findAll(reveal, byClass('physics-paint-play-script-card-key-script'))).toHaveLength(0);

    // Edit modes never render the creation opt-in.
    const editMode = renderDialog(createFakeController({ dialogMode: 'loop-edit' }).controller);
    expect(findAll(editMode, byClass('physics-paint-play-script-card-key-script'))).toHaveLength(0);

    // 261030-np9 (D-08) + 261101-cd5: the panel keeps Rail Type → Timing →
    // Motion → GLOBAL OPTIONS → global row → summary, and the global row keeps
    // the per-tab equal-width card order.
    const orderOf = (tree: TestVNode) => {
      const panel = findOne(tree, byClass('physics-paint-play-script-content'));
      const panelChildren = [...walk(panel)]
        .filter((child) => child !== panel && typeof child.type !== 'function')
        .filter((child) => renderedParentOf(panel, child) === panel);
      const panelIndexOf = (name: string) => {
        const node = findAll(panel, byClass(name))[0];
        return node ? panelChildren.indexOf(node) : -1;
      };
      const rowCards = globalRowCards(tree);
      const rowIndexOf = (name: string) => rowCards.findIndex((node) => hasClass(node, name));
      return {
        keyScriptCard: findAll(panel, byClass('physics-paint-play-script-card-key-script'))[0],
        mode: panelIndexOf('physics-paint-play-script-card-mode'),
        timing: panelIndexOf('physics-paint-play-script-card-timing'),
        motion: panelIndexOf('physics-paint-play-script-card-motion'),
        globalLabel: panelIndexOf('physics-paint-play-script-global-label'),
        globalRow: panelIndexOf('physics-paint-play-script-global-row'),
        summary: panelIndexOf('physics-paint-play-script-summary-bar'),
        keyScript: rowIndexOf('physics-paint-play-script-card-key-script'),
        seed: rowIndexOf('physics-paint-play-script-card-paint-seed-variation'),
        photoWiggle: rowIndexOf('physics-paint-play-script-card-photo-wiggle'),
        color: rowIndexOf('physics-paint-play-script-card-color'),
        colorize: rowIndexOf('physics-paint-play-script-card-colorize'),
      };
    };
    const paintOrder = orderOf(renderDialog(createFakeController({ loopReadout: 'Requested: 25f (5f × 5)' }).controller));
    expect(hasClass(paintOrder.keyScriptCard, 'physics-paint-play-script-card-wide')).toBe(false);
    expect(paintOrder.mode).toBe(0);
    expect(paintOrder.timing).toBe(paintOrder.mode + 1);
    expect(paintOrder.motion).toBeLessThan(paintOrder.globalLabel);
    expect(paintOrder.globalLabel).toBeLessThan(paintOrder.globalRow);
    expect(paintOrder.globalRow).toBeLessThan(paintOrder.summary);
    // Paint creation row: Key Script → Paint Seed → Color.
    expect(paintOrder.keyScript).toBe(0);
    expect(paintOrder.seed).toBe(paintOrder.keyScript + 1);
    expect(paintOrder.color).toBe(paintOrder.seed + 1);
    expect(paintOrder.photoWiggle).toBe(-1);
    expect(paintOrder.colorize).toBe(-1);

    const revealOrder = orderOf(renderDialog(createFakeController({ railTab: 'reveal', loopReadout: 'Requested: 25f (5f × 5)' }).controller));
    // Reveal creation row: Paint Seed → Photo Wiggle → Colorize; no Key Script
    // and no Color card. The panel column keeps the same skeleton.
    expect(revealOrder.keyScript).toBe(-1);
    expect(revealOrder.color).toBe(-1);
    expect(revealOrder.timing).toBe(revealOrder.mode + 1);
    expect(revealOrder.motion).toBeLessThan(revealOrder.globalLabel);
    expect(revealOrder.globalLabel).toBeLessThan(revealOrder.globalRow);
    expect(revealOrder.globalRow).toBeLessThan(revealOrder.summary);
    expect(revealOrder.seed).toBe(0);
    expect(revealOrder.photoWiggle).toBe(revealOrder.seed + 1);
    expect(revealOrder.colorize).toBe(revealOrder.photoWiggle + 1);
  });

  it('261030-v1t: renders the Paint Seed card on both tabs in apply mode only, routing the checkbox', () => {
    // Paint tab: present, unchecked, editable, routed to the controller.
    const { controller, signals } = createFakeController();
    const tree = renderDialog(controller);
    const card = findOne(tree, byClass('physics-paint-play-script-card-paint-seed-variation'));
    expect(textOf(card)).toContain('Paint Seed');
    expect(textOf(card)).toContain('Vary the brush texture each frame');
    expect((findOne(card, byId('physics-play-script-paint-seed-variation')) as TestVNode).props['aria-label'])
      .toBe('Vary the brush texture per frame');
    // 261030-v1t UAT: the long hint is gone — the card is a compact title + toggle.
    expect(textOf(card)).not.toContain('Same strokes');

    const checkbox = findOne(card, byId('physics-play-script-paint-seed-variation')) as TestVNode;
    expect(checkbox.props.role).toBe('switch');
    expect(checkbox.props['aria-checked']).toBe('false');
    expect(checkbox.props.disabled).toBe(false);
    handler(checkbox, 'onClick')();
    expect(controller.setPaintSeedVariation).toHaveBeenCalledWith(true);
    // The dialog never writes the signal itself — the controller owns it.
    expect(signals.paintSeedVariation.value).toBe(false);

    // Reveal tab: the SAME creation opt-in, also present and routed.
    const reveal = renderDialog(createFakeController({ railTab: 'reveal' }).controller);
    const revealCheckbox = findOne(reveal, byId('physics-play-script-paint-seed-variation')) as TestVNode;
    expect(revealCheckbox.props.role).toBe('switch');

    // 261101-cd5: the seed card lives in the shared global row — after Key
    // Script on Paint, first on Reveal (which has no Key Script card).
    const placementOf = (dialog: TestVNode) => {
      const row = findOne(dialog, byClass('physics-paint-play-script-global-row'));
      const rowCards = globalRowCards(dialog);
      const seed = findOne(dialog, byClass('physics-paint-play-script-card-paint-seed-variation'));
      const keyScript = rowCards.find((node) => hasClass(node, 'physics-paint-play-script-card-key-script'));
      return {
        seedFirstInRow: rowCards[0] === seed,
        seedAfterKeyScript: keyScript ? rowCards.indexOf(seed) > rowCards.indexOf(keyScript) : undefined,
        seedDirectRowChild: renderedParentOf(dialog, seed) === row,
      };
    };
    expect(placementOf(tree)).toEqual({ seedFirstInRow: false, seedAfterKeyScript: true, seedDirectRowChild: true });
    expect(placementOf(reveal)).toEqual({ seedFirstInRow: true, seedAfterKeyScript: undefined, seedDirectRowChild: true });

    // A seeded enable renders checked.
    const seeded = renderDialog(createFakeController({ railTab: 'reveal', paintSeedVariation: true }).controller);
    expect((findOne(seeded, byId('physics-play-script-paint-seed-variation')) as TestVNode).props['aria-checked']).toBe('true');

    // Busy (a generation can be cancelled) disables the toggle.
    const busy = renderDialog(createFakeController({ canCancel: true }).controller);
    expect((findOne(busy, byId('physics-play-script-paint-seed-variation')) as TestVNode).props.disabled).toBe(true);

    // Edit modes never render the creation opt-in — neither tab.
    const loopEdit = renderDialog(createFakeController({ dialogMode: 'loop-edit', railTab: 'reveal' }).controller);
    expect(findAll(loopEdit, byClass('physics-paint-play-script-card-paint-seed-variation'))).toHaveLength(0);
    const sourceEdit = renderDialog(createFakeController({ dialogMode: 'source-edit' }).controller);
    expect(findAll(sourceEdit, byClass('physics-paint-play-script-card-paint-seed-variation'))).toHaveLength(0);
  });

  it('writes the Reveal Frames draft to revealCountText and disables Create on a validation error', () => {
    const { controller, signals } = createFakeController({ railTab: 'reveal' });
    const tree = renderDialog(controller);
    handler(findOne(tree, byId('physics-play-script-reveal-count')), 'onChange')(7);
    expect(signals.revealCountText.value).toBe('7');
    const invalid = renderDialog(createFakeController({ railTab: 'reveal', revealValidationError: 'Enter a positive integer.' }).controller);
    const createButton = findOne(invalid, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Run Script');
    expect(createButton.props.disabled).toBe(true);
  });

  it('shows the reference guard as a rail-row chip with the Place action when no reference is placed (D-12)', () => {
    const { controller } = createFakeController({ railTab: 'reveal', revealReferencePlaced: false });
    const tree = renderDialog(controller);
    // 261101-cd5: the creation guard is the compact chip, never a full-width row.
    expect(findAll(tree, byClass('physics-paint-play-script-reveal-notice'))).toHaveLength(0);
    const railRow = findOne(tree, byClass('physics-paint-play-script-rail-row'));
    const chip = findOne(railRow, byClass('physics-paint-play-script-ref-chip'));
    expect(textOf(chip)).toContain('No photo reference');
    expect(findOne(chip, byClass('physics-paint-play-script-ref-dot'))).toBeDefined();
    handler(findOne(chip, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Place'), 'onClick')();
    expect(controller.requestPhotoReference).toHaveBeenCalledTimes(1);

    // The chip disappears once a reference is placed.
    const placed = renderDialog(createFakeController({ railTab: 'reveal', revealReferencePlaced: true }).controller);
    expect(findAll(placed, byClass('physics-paint-play-script-ref-chip'))).toHaveLength(0);
    expect(findAll(placed, byClass('physics-paint-play-script-reveal-notice'))).toHaveLength(0);

    // The Paint tab never shows a reference chip.
    expect(findAll(renderDialog(createFakeController().controller), byClass('physics-paint-play-script-ref-chip'))).toHaveLength(0);
  });

  it('routes the Reveal tab Create through the same confirm entry (creation IS the first bake — D-11)', () => {
    const { controller } = createFakeController({ railTab: 'reveal' });
    const tree = renderDialog(controller);
    handler(findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Run Script'), 'onClick')();
    expect(controller.confirm).toHaveBeenCalledTimes(1);
  });
});

describe('PhysicsPaintPlayScriptDialog run-script stacking (261031-i54)', () => {
  const STACK_READOUT = {
    spanLabel: 'F13–F15',
    offsetLabel: 'Source cycle +3',
    outcomeLabel: 'Stacks onto the existing cycle.',
  };
  const stackSeed = (overrides: Partial<FakeControllerSeed> = {}): FakeControllerSeed => ({
    runDestination: { kind: 'stack', clipId: 'L1' },
    repeatLocked: true,
    framesMax: 6,
    stackReadout: STACK_READOUT,
    destinationRange: 'F13–F15',
    ...overrides,
  });

  it('renders no stack surface for a create destination and keeps the repeat controls', () => {
    const { controller } = createFakeController();
    const tree = renderDialog(controller);
    expect(findAll(tree, byId('physics-play-script-stack-readout'))).toHaveLength(0);
    expect(findAll(tree, byId('physics-play-script-keep-script'))).toHaveLength(0);
    expect(findAll(tree, byId('physics-play-script-collision'))).toHaveLength(0);
    expect(findAll(tree, byId('physics-play-script-repeat'))).toHaveLength(1);
    expect(findAll(tree, byId('physics-play-script-infinity'))).toHaveLength(1);
    expect(findOne(tree, byClass('physics-paint-play-script-header')).props.children).toBeDefined();
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-header')))).toBe('Run ScriptMax 4 · F4–F7');
  });

  it('renders the stack readout, hides the repeat controls and the Source cycle card, and bounds the header from framesMax', () => {
    const { controller } = createFakeController(stackSeed({
      identicalSourceCycle: { sourceKeyIds: ['S1', 'S2', 'S3', 'S4'], loopCount: 1, sourceStart: 10 },
    }));
    const tree = renderDialog(controller);
    const readout = findOne(tree, byId('physics-play-script-stack-readout'));
    expect(textOf(readout)).toContain('F13–F15');
    expect(textOf(readout)).toContain('Source cycle +3');
    expect(textOf(readout)).toContain('Stacks onto the existing cycle.');
    expect(findAll(tree, byId('physics-play-script-repeat'))).toHaveLength(0);
    expect(findAll(tree, byId('physics-play-script-infinity'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-source-choice'))).toHaveLength(0);
    // Header bound follows framesMax, not capacity.
    expect(textOf(findOne(tree, byClass('physics-paint-play-script-header')))).toBe('Run ScriptMax 6 · F13–F15');
  });

  it('passes the framesMax bound and allowOutOfRangeEntry to the Frames stepper for stack destinations', () => {
    const stack = renderDialog(createFakeController(stackSeed()).controller);
    const stepper = findOne(stack, byId('physics-play-script-count'));
    expect(stepper.props.max).toBe(6);
    expect(stepper.props.sliderMax).toBe(6);
    expect(stepper.props.allowOutOfRangeEntry).toBe(true);
    // Creation keeps today's capacity clamp and no out-of-range entry.
    const create = renderDialog(createFakeController().controller);
    const createStepper = findOne(create, byId('physics-play-script-count'));
    expect(createStepper.props.max).toBe(4);
    expect(createStepper.props.sliderMax).toBe(4);
    expect(createStepper.props.allowOutOfRangeEntry).toBeUndefined();
  });

  it('uses the stack readout in the summary bar when the loop readout is absent', () => {
    const { controller } = createFakeController(stackSeed({ loopReadout: null }));
    const tree = renderDialog(controller);
    const bar = findOne(tree, byClass('physics-paint-play-script-summary-bar'));
    expect(textOf(bar)).toContain('F13–F15');
    expect(textOf(bar)).toContain('Source cycle +3');
    expect(textOf(bar)).toContain('Stacks onto the existing cycle.');
  });

  it('renders the Keep script switch ON for a flag-on stack destination and writes through setKeepScript', () => {
    const { controller } = createFakeController(stackSeed({
      keepScript: true,
      keepScriptVisible: true,
      keepScriptEffective: true,
      keepScriptDisabledReason: null,
    }));
    const tree = renderDialog(controller);
    const toggle = findOne(tree, byId('physics-play-script-keep-script'));
    expect(toggle.props.role).toBe('switch');
    expect(toggle.props['aria-checked']).toBe('true');
    expect(toggle.props.disabled).toBe(false);
    expect(findAll(tree, byId('physics-play-script-keep-script-reason'))).toHaveLength(0);
    handler(toggle, 'onClick')();
    expect(controller.setKeepScript).toHaveBeenCalledWith(false);
  });

  it('renders a disabled Keep script switch with its build reason when the re-bake port is absent', () => {
    // 261031-qps: the pixel-only "stores pixels" reason is gone — every stack
    // destination with the port is enabled. The dialog still renders a reason
    // when the controller reports one (a build without the re-bake port).
    const reason = 'This build cannot re-bake per-key scripts on an existing rail. The run is composited over its existing pixels.';
    const { controller } = createFakeController(stackSeed({
      keepScript: false,
      keepScriptVisible: true,
      keepScriptEffective: false,
      keepScriptDisabledReason: reason,
    }));
    const tree = renderDialog(controller);
    const toggle = findOne(tree, byId('physics-play-script-keep-script'));
    expect(toggle.props['aria-checked']).toBe('false');
    expect(toggle.props.disabled).toBe(true);
    expect(textOf(findOne(tree, byId('physics-play-script-keep-script-reason')))).toBe(reason);
  });

  it('renders Cancel then the default Truncate and offers Overwrite only when the boundary allows it', () => {
    const { controller } = createFakeController(stackSeed({
      stackCollision: { boundaryExclusive: 22, blocker: 'other-rail', victimClipId: 'L2' },
      collisionOffers: ['cancel', 'truncate', 'overwrite'],
    }));
    const tree = renderDialog(controller);
    const card = findOne(tree, byId('physics-play-script-collision'));
    const cancel = findOne(tree, byId('physics-play-script-collision-cancel'));
    const truncate = findOne(tree, byId('physics-play-script-collision-truncate'));
    const overwrite = findOne(tree, byId('physics-play-script-collision-overwrite'));
    const ordered = [...walk(card)].filter((node) => node === cancel || node === truncate || node === overwrite);
    expect(ordered).toEqual([cancel, truncate, overwrite]);
    expect(hasClass(truncate, 'physics-paint-play-script-button-primary')).toBe(true);
    expect(hasClass(cancel, 'physics-paint-play-script-button-primary')).toBe(false);
    expect(hasClass(overwrite, 'physics-paint-play-script-button-primary')).toBe(false);
    handler(cancel, 'onClick')();
    expect(controller.confirmStackCollision).toHaveBeenCalledWith('cancel');
    handler(truncate, 'onClick')();
    expect(controller.confirmStackCollision).toHaveBeenCalledWith('truncate');
    handler(overwrite, 'onClick')();
    expect(controller.confirmStackCollision).toHaveBeenCalledWith('overwrite');

    // The parent end offers Truncate / Cancel only.
    const parent = renderDialog(createFakeController(stackSeed({
      stackCollision: { boundaryExclusive: 20, blocker: 'parent-end', victimClipId: null },
      collisionOffers: ['cancel', 'truncate'],
    })).controller);
    expect(findAll(parent, byId('physics-play-script-collision-overwrite'))).toHaveLength(0);
    expect(findAll(parent, byId('physics-play-script-collision-cancel'))).toHaveLength(1);
    expect(findAll(parent, byId('physics-play-script-collision-truncate'))).toHaveLength(1);
  });

  it('routes Enter on an open collision to Truncate instead of the primary confirm', () => {
    const { controller } = createFakeController(stackSeed({
      stackCollision: { boundaryExclusive: 22, blocker: 'other-rail', victimClipId: 'L2' },
      collisionOffers: ['cancel', 'truncate', 'overwrite'],
    }));
    const tree = renderDialog(controller);
    const root = findOne(tree, (vnode) => vnode.props?.role === 'dialog');
    handler(root, 'onKeyDown')({ key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(controller.confirmStackCollision).toHaveBeenCalledWith('truncate');
    expect(controller.confirm).not.toHaveBeenCalled();
  });

  it('does nothing on Enter while the frame count is invalid', () => {
    // 261031-qps (Quick B): the frame-override refusal is gone — overrides
    // inside the written span are legal — so the Enter guard is pinned against
    // the ordinary count validation instead.
    const { controller } = createFakeController(stackSeed({
      validationError: 'Enter a positive integer.',
    }));
    const tree = renderDialog(controller);
    const root = findOne(tree, (vnode) => vnode.props?.role === 'dialog');
    handler(root, 'onKeyDown')({ key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(controller.confirm).not.toHaveBeenCalled();
    expect(controller.confirmStackCollision).not.toHaveBeenCalled();
  });

  it('routes the collision Cancel to the controller without confirming the run', () => {
    const { controller } = createFakeController(stackSeed({
      stackCollision: { boundaryExclusive: 22, blocker: 'other-rail', victimClipId: 'L2' },
      collisionOffers: ['cancel', 'truncate', 'overwrite'],
    }));
    const tree = renderDialog(controller);
    handler(findOne(tree, byId('physics-play-script-collision-cancel')), 'onClick')();
    expect(controller.confirmStackCollision).toHaveBeenCalledWith('cancel');
    expect(controller.confirm).not.toHaveBeenCalled();
  });

  it('renders the Overwrite copy — the victim rail is REMOVED — only when Overwrite is offered (CR-02)', () => {
    const offered = renderDialog(createFakeController(stackSeed({
      stackCollision: { boundaryExclusive: 22, blocker: 'other-rail', victimClipId: 'L2' },
      collisionOffers: ['cancel', 'truncate', 'overwrite'],
    })).controller);
    const copy = findOne(offered, byId('physics-play-script-collision-overwrite-copy'));
    expect(textOf(copy)).toBe('Removes the other rail; its keys stay as ordinary keys.');
    expect(textOf(copy)).not.toContain('shorten');
    // The rendered card itself carries the explanation, not just the constant.
    expect(textOf(findOne(offered, byId('physics-play-script-collision')))).toContain('Removes the other rail');

    const parent = renderDialog(createFakeController(stackSeed({
      stackCollision: { boundaryExclusive: 20, blocker: 'parent-end', victimClipId: null },
      collisionOffers: ['cancel', 'truncate'],
    })).controller);
    expect(findAll(parent, byId('physics-play-script-collision-overwrite-copy'))).toHaveLength(0);
  });

  it('renders the lifecycle-only capping copy, never run truncation, when only the rail span overflows (WR-03/WR-05)', () => {
    const { controller } = createFakeController(stackSeed({
      stackCollision: {
        boundaryExclusive: 20,
        blocker: 'other-rail',
        victimClipId: 'L2',
        runCollision: false,
        lifecycleOverflow: true,
        parentEndExclusive: 20,
      },
      collisionOffers: ['cancel', 'truncate'],
    }));
    const tree = renderDialog(controller);
    const text = textOf(findOne(tree, byId('physics-play-script-collision')));
    expect(text).toContain("The rail's repeat span crosses the parent end at F20");
    expect(text).toContain('still writes the whole run');
    expect(text).not.toContain('Truncate writes only the free span');
    expect(text).not.toContain('The run reaches past');
    expect(findAll(tree, byId('physics-play-script-collision-overwrite'))).toHaveLength(0);
  });

  it('shows the editable Rail Type and Motion wiggle on a stack and hides the remaining creation-only cards (UAT 261031-i54)', () => {
    const { controller } = createFakeController(stackSeed({
      keepScriptVisible: true,
      keyScriptEdits: true,
      paintSeedVariation: true,
      identicalSourceCycle: { sourceKeyIds: ['S1', 'S2', 'S3', 'S4'], loopCount: 1, sourceStart: 10 },
    }));
    const tree = renderDialog(controller);
    expect(findAll(tree, byClass('physics-paint-play-script-card-mode'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-motion'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-color'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-paint-seed-variation'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-key-script'))).toHaveLength(0);
    // The panel keeps Color and Motion wiggle instead of going empty.
    const stackPanel = findOne(tree, byClass('physics-paint-play-script-content'));
    expect(findAll(stackPanel, byClass('physics-paint-play-script-card-color'))).toHaveLength(1);
    expect(findAll(stackPanel, byClass('physics-paint-play-script-card-motion'))).toHaveLength(1);
    // The stack-specific surfaces and the run span stay.
    expect(findAll(tree, byId('physics-play-script-stack-readout'))).toHaveLength(1);
    expect(findAll(tree, byId('physics-play-script-keep-script'))).toHaveLength(1);
    expect(findAll(tree, byId('physics-play-script-count'))).toHaveLength(1);
    // 261031-vbo (Quick C1): the stack is a merge of results, not a Rail Type edit.
    expect(textOf(tree)).toContain('This run merges into the rail — the result is one Standard Rail.');

    // Creation keeps every one of them, and a plain Apply never promises a merge.
    const create = renderDialog(createFakeController({ keyScriptEdits: true, paintSeedVariation: true }).controller);
    expect(findAll(create, byClass('physics-paint-play-script-card-mode'))).toHaveLength(1);
    expect(findAll(create, byClass('physics-paint-play-script-card-color'))).toHaveLength(1);
    expect(findAll(create, byClass('physics-paint-play-script-card-motion'))).toHaveLength(1);
    expect(findAll(create, byClass('physics-paint-play-script-card-paint-seed-variation'))).toHaveLength(1);
    expect(findAll(create, byClass('physics-paint-play-script-card-key-script'))).toHaveLength(1);
    expect(textOf(create)).not.toContain('This run merges into the rail');
  });

  it('seeds the stack Color from the rail and adopts the brush color only on request (UAT 261031-i54)', () => {
    const { controller } = createFakeController(stackSeed({
      overrideEnabled: true,
      stackOverrideColor: '#abcdef',
    }));
    const tree = renderDialog(controller);
    const colorCard = findOne(tree, byClass('physics-paint-play-script-card-color'));
    // The rail's stored color is shown, not the app's current brush color.
    expect(textOf(colorCard)).toContain('#abcdef');
    expect(textOf(colorCard)).not.toContain('Picked from the app\'s brush color panel');
    const link = findOne(colorCard, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Use brush color');
    handler(link, 'onClick')();
    expect(controller.useBrushColor).toHaveBeenCalled();
  });

  it('hides the Rail kind tabs and never renders the Reveal surface on a stack (WR-06)', () => {
    const { controller } = createFakeController(stackSeed({ railTab: 'reveal' }));
    const tree = renderDialog(controller);
    expect(findAll(tree, (vnode) => vnode.props?.role === 'tablist')).toHaveLength(0);
    expect(findAll(tree, byId('physics-play-script-reveal-count'))).toHaveLength(0);
    expect(findAll(tree, byId('physics-play-script-stack-readout'))).toHaveLength(1);
    expect(findAll(tree, byId('physics-play-script-count'))).toHaveLength(1);
  });

  it('disables the collision actions while busy and the primary Run while a collision is open (WR-10)', () => {
    const collision = {
      boundaryExclusive: 22,
      blocker: 'other-rail' as const,
      victimClipId: 'L2',
      runCollision: true,
      lifecycleOverflow: false,
    };
    const busy = renderDialog(createFakeController(stackSeed({
      canCancel: true,
      stackCollision: collision,
      collisionOffers: ['cancel', 'truncate', 'overwrite'],
    })).controller);
    expect(findOne(busy, byId('physics-play-script-collision-cancel')).props.disabled).toBe(true);
    expect(findOne(busy, byId('physics-play-script-collision-truncate')).props.disabled).toBe(true);
    expect(findOne(busy, byId('physics-play-script-collision-overwrite')).props.disabled).toBe(true);

    const idle = renderDialog(createFakeController(stackSeed({
      stackCollision: collision,
      collisionOffers: ['cancel', 'truncate', 'overwrite'],
    })).controller);
    expect(findOne(idle, byId('physics-play-script-collision-cancel')).props.disabled).toBe(false);
    expect(findOne(idle, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Run Script').props.disabled).toBe(true);
  });
});

describe('PhysicsPaintPlayScriptDialog reveal stacking (261031-qps)', () => {
  const STACK_READOUT = {
    spanLabel: 'F13–F15',
    offsetLabel: 'Source cycle +3',
    outcomeLabel: 'Stacks onto the existing cycle.',
  };
  const revealStackSeed = (overrides: Partial<FakeControllerSeed> = {}): FakeControllerSeed => ({
    runDestination: { kind: 'stack', clipId: 'R1' },
    stackRailKind: 'reveal',
    railTab: 'reveal',
    repeatLocked: true,
    framesMax: 6,
    stackReadout: STACK_READOUT,
    destinationRange: 'F13–F15',
    ...overrides,
  });

  it('composes the reveal cards on a reveal stack and hides every Paint-only surface', () => {
    const { controller } = createFakeController(revealStackSeed({
      keepScriptVisible: true,
      paintSeedVariation: true,
      colorize: true,
      photoWiggle: true,
      identicalSourceCycle: { sourceKeyIds: ['S1', 'S2', 'S3', 'S4'], loopCount: 1, sourceStart: 10 },
    }));
    const tree = renderDialog(controller);

    // Never a Rail Type card, a Motion wiggle card, a Color card or Key Script.
    expect(findAll(tree, byClass('physics-paint-play-script-card-mode'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-motion'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-color'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-key-script'))).toHaveLength(0);
    expect(findAll(tree, (vnode) => vnode.props?.role === 'tablist')).toHaveLength(0);
    expect(findAll(tree, byId('physics-play-script-reveal-count'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-source-choice'))).toHaveLength(0);

    // The reveal-run cards take their place.
    expect(findAll(tree, byClass('physics-paint-play-script-card-colorize'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-photo-wiggle'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-paint-seed-variation'))).toHaveLength(1);

    // Timing, the stack readout and Keep script stay.
    expect(findAll(tree, byId('physics-play-script-count'))).toHaveLength(1);
    expect(findAll(tree, byId('physics-play-script-stack-readout'))).toHaveLength(1);
    expect(findAll(tree, byId('physics-play-script-keep-script'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-summary-bar'))).toHaveLength(1);
  });

  it('states that the run uses the rail’s own reference and never offers to replace it', () => {
    const { controller } = createFakeController(revealStackSeed({ revealReferencePlaced: true }));
    const tree = renderDialog(controller);
    const notice = findOne(tree, byClass('physics-paint-play-script-reveal-notice'));
    expect(textOf(notice)).toBe("This run renders through the rail's own placed photo reference.");
    // The reference is read-only here: no Place-a-reference action anywhere.
    expect(findAll(notice, byClass('physics-paint-play-script-heading-link'))).toHaveLength(0);
    expect(controller.requestPhotoReference).not.toHaveBeenCalled();
  });

  it('warns without a placed reference but still offers no re-placement action', () => {
    const { controller } = createFakeController(revealStackSeed({ revealReferencePlaced: false }));
    const tree = renderDialog(controller);
    const notice = findOne(tree, byClass('physics-paint-play-script-reveal-notice'));
    expect(textOf(notice)).toBe('This Reveal rail has no photo reference. Place one before running — the run refuses without it.');
    expect(findAll(notice, (vnode) => vnode.type === 'button')).toHaveLength(0);
  });

  it('keeps the Paint composition for a playscript stack destination', () => {
    const { controller } = createFakeController({
      runDestination: { kind: 'stack', clipId: 'L1' },
      stackRailKind: 'playscript',
      repeatLocked: true,
      framesMax: 6,
      stackReadout: STACK_READOUT,
      destinationRange: 'F13–F15',
    });
    const tree = renderDialog(controller);
    expect(findAll(tree, byClass('physics-paint-play-script-card-mode'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-motion'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-color'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-colorize'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-photo-wiggle'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-reveal-notice'))).toHaveLength(0);
  });
});

describe('PhysicsPaintPlayScriptDialog Reveal run surface (261101-1pc)', () => {
  const STACK_READOUT = {
    spanLabel: 'F13–F15',
    offsetLabel: 'Source cycle +3',
    outcomeLabel: 'Stacks onto the existing cycle.',
  };
  const revealRunSeed = (overrides: Partial<FakeControllerSeed> = {}): FakeControllerSeed => ({
    runDestination: { kind: 'stack', clipId: 'L1' },
    stackRailKind: 'playscript',
    stackRunKind: 'reveal-motion',
    repeatLocked: true,
    framesMax: 6,
    stackReadout: STACK_READOUT,
    destinationRange: 'F13–F15',
    ...overrides,
  });

  it('offers the 2x2 Rail Type grid on a stack and keeps two options on creation', () => {
    const { controller } = createFakeController({
      runDestination: { kind: 'stack', clipId: 'L1' },
      stackRailKind: 'playscript',
      stackRunKind: 'static',
      repeatLocked: true,
      framesMax: 6,
      stackReadout: STACK_READOUT,
      destinationRange: 'F13–F15',
    });
    const tree = renderDialog(controller);
    const group = findOne(tree, byRadioGroup('Rail Type'));
    const radios = findAll(group, (vnode) => vnode.props?.role === 'radio');
    expect(radios.map((radio) => textOf(radio))).toEqual(['Motion', 'Static', 'Reveal Motion', 'Reveal Static']);
    expect(radios.map((radio) => radio.props['aria-checked'])).toEqual([false, true, false, false]);
    handler(radios[2]!, 'onClick')({ currentTarget: null });
    expect(controller.setStackRunKind).toHaveBeenCalledWith('reveal-motion');

    // Creation keeps its two-option Motion/Static group bound to `mode`.
    const create = renderDialog(createFakeController().controller);
    const createGroup = findOne(create, byRadioGroup('Rail Type'));
    expect(findAll(createGroup, (vnode) => vnode.props?.role === 'radio').map((radio) => textOf(radio)))
      .toEqual(['Motion', 'Static']);
  });

  it('composes the reveal-run card set on a Paint destination', () => {
    const { controller } = createFakeController(revealRunSeed({
      keepScriptVisible: true,
      paintSeedVariation: true,
      colorize: true,
      photoWiggle: true,
      keyScriptEdits: true,
      identicalSourceCycle: { sourceKeyIds: ['S1', 'S2', 'S3', 'S4'], loopCount: 1, sourceStart: 10 },
    }));
    const tree = renderDialog(controller);
    // The Rail Type card stays with the four run kinds.
    const group = findOne(tree, byRadioGroup('Rail Type'));
    expect(findAll(group, (vnode) => vnode.props?.role === 'radio').map((radio) => textOf(radio)))
      .toEqual(['Motion', 'Static', 'Reveal Motion', 'Reveal Static']);
    // Exactly one of each reveal-run card.
    expect(findAll(tree, byClass('physics-paint-play-script-card-colorize'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-motion'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-photo-wiggle'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-card-paint-seed-variation'))).toHaveLength(1);
    // No Color, Key Script, source cycle or rail-kind tabs.
    expect(findAll(tree, byClass('physics-paint-play-script-card-color'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-key-script'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-source-choice'))).toHaveLength(0);
    expect(findAll(tree, (vnode) => vnode.props?.role === 'tablist')).toHaveLength(0);
    // Timing, stack readout, Keep script and the summary bar stay.
    expect(findAll(tree, byId('physics-play-script-count'))).toHaveLength(1);
    expect(findAll(tree, byId('physics-play-script-stack-readout'))).toHaveLength(1);
    expect(findAll(tree, byId('physics-play-script-keep-script'))).toHaveLength(1);
    expect(findAll(tree, byClass('physics-paint-play-script-summary-bar'))).toHaveLength(1);
  });

  it('states that a placed document reference is used, with no action', () => {
    const { controller } = createFakeController(revealRunSeed({ revealReferencePlaced: true }));
    const tree = renderDialog(controller);
    const notice = findOne(tree, byClass('physics-paint-play-script-reveal-notice'));
    expect(textOf(notice)).toBe("This run renders through the document's placed photo reference.");
    expect(findAll(notice, (vnode) => vnode.type === 'button')).toHaveLength(0);
    expect(controller.requestPhotoReference).not.toHaveBeenCalled();
  });

  it('warns without a document reference and offers the Place a reference action', () => {
    const { controller } = createFakeController(revealRunSeed({ revealReferencePlaced: false }));
    const tree = renderDialog(controller);
    const notice = findOne(tree, byClass('physics-paint-play-script-reveal-notice'));
    expect(textOf(notice)).toContain('Reveal bakes the placed photo reference — no reference placed yet.');
    const button = findOne(notice, (vnode) => vnode.type === 'button');
    expect(textOf(button)).toBe('Place a reference…');
    expect(button.props.disabled).toBe(false);
    handler(button, 'onClick')();
    expect(controller.requestPhotoReference).toHaveBeenCalledTimes(1);
  });

  it('disables the Place a reference action while busy', () => {
    const { controller } = createFakeController(revealRunSeed({ revealReferencePlaced: false, canCancel: true }));
    const tree = renderDialog(controller);
    const button = findOne(tree, (vnode) => vnode.type === 'button' && textOf(vnode) === 'Place a reference…');
    expect(button.props.disabled).toBe(true);
  });

  it('restores the Paint composition when the run kind goes back to Motion', () => {
    const test = createFakeController(revealRunSeed());
    const tree = renderDialog(test.controller);
    expect(findAll(tree, byClass('physics-paint-play-script-card-colorize'))).toHaveLength(1);

    test.controller.setStackRunKind('motion');
    const back = renderDialog(test.controller);
    expect(findAll(back, byClass('physics-paint-play-script-card-color'))).toHaveLength(1);
    expect(findAll(back, byClass('physics-paint-play-script-card-motion'))).toHaveLength(1);
    expect(findAll(back, byClass('physics-paint-play-script-card-colorize'))).toHaveLength(0);
    expect(findAll(back, byClass('physics-paint-play-script-card-photo-wiggle'))).toHaveLength(0);
    expect(findAll(back, byClass('physics-paint-play-script-card-paint-seed-variation'))).toHaveLength(0);
    expect(findAll(back, byClass('physics-paint-play-script-reveal-notice'))).toHaveLength(0);
  });

  it('keeps Quick B’s reveal-destination composition even when the run kind says Reveal', () => {
    const { controller } = createFakeController({
      runDestination: { kind: 'stack', clipId: 'R1' },
      stackRailKind: 'reveal',
      stackRunKind: 'reveal-motion',
      repeatLocked: true,
      framesMax: 6,
      stackReadout: STACK_READOUT,
      destinationRange: 'F13–F15',
      revealReferencePlaced: true,
    });
    const tree = renderDialog(controller);
    expect(findAll(tree, byClass('physics-paint-play-script-card-mode'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-motion'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-color'))).toHaveLength(0);
    expect(findAll(tree, byClass('physics-paint-play-script-card-colorize'))).toHaveLength(1);
    const notice = findOne(tree, byClass('physics-paint-play-script-reveal-notice'));
    expect(textOf(notice)).toBe("This run renders through the rail's own placed photo reference.");
  });
});
