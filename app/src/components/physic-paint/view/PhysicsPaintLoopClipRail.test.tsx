import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  refs: new Map<number, { current: unknown }>(),
  values: [] as unknown[],
  cursor: 0,
  idCursor: 0,
  reset() {
    this.refs = new Map();
    this.values = [];
    this.cursor = 0;
    this.idCursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useCallback: <Value extends (...args: never[]) => unknown,>(callback: Value) => callback,
  useEffect: () => {},
  useId: () => `loop-tracer-${hooks.idCursor++}`,
  useLayoutEffect: () => {},
  useMemo: <Value,>(factory: () => Value) => factory(),
  useRef: <Value,>(initial: Value) => {
    const index = hooks.cursor++;
    if (!hooks.refs.has(index)) hooks.refs.set(index, { current: initial });
    return hooks.refs.get(index) as { current: Value };
  },
  useState: <Value,>(initial: Value | (() => Value)) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) {
      hooks.values[index] = typeof initial === 'function' ? (initial as () => Value)() : initial;
    }
    return [hooks.values[index] as Value, (next: Value | ((current: Value) => Value)) => {
      hooks.values[index] = typeof next === 'function'
        ? (next as (current: Value) => Value)(hooks.values[index] as Value)
        : next;
    }] as const;
  },
}));

vi.mock('preact/compat', async () => {
  const actual = await vi.importActual<typeof import('preact/compat')>('preact/compat');
  return { ...actual, memo: <Value,>(component: Value) => component };
});

vi.mock('@preact/signals', async () => {
  const actual = await vi.importActual<typeof import('@preact/signals')>('@preact/signals');
  return { ...actual, useSignal: <Value,>(initial: Value) => actual.signal(initial) };
});

import { describe, expect, it } from 'vitest';
import type { ComponentChildren } from 'preact';
import { defaultTransform, type Layer } from '../../../types/layer';
import type { Sequence } from '../../../types/sequence';
import { frameMap, fxTrackLayouts } from '../../../lib/frameMap';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { sequenceStore } from '../../../stores/sequenceStore';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoSpacingProxy,
  type PhysicPaintRotoLoopRange,
} from '../roto/physicsPaintRotoPhysicalResolver';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import { LOOP_CLIP_FAST_DOUBLE_CLICK_MS, LOOP_CLIP_SINGLE_CLICK_DELAY_MS, PhysicsPaintLoopClipRail } from './PhysicsPaintLoopClipRail';
import { PhysicsPaintScriptsPanel } from './PhysicsPaintScriptsPanel';
import { PhysicsPaintWorkflowStrip } from './PhysicsPaintWorkflowStrip';
import {
  projectPhysicsPaintLoopClipGeometry,
  projectPhysicsPaintLoopClipPresentation,
  type PhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';

const physicsPaintStudioCss = readFileSync(
  fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url)),
  'utf8',
);

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: ComponentChildren };
}

function childrenOf(node: TestVNode): unknown[] {
  const children = node.props?.children;
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

function materializeNamedComponents(node: unknown, names: ReadonlySet<string>): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map((child) => materializeNamedComponents(child, names));
  if (typeof node !== 'object') return node;
  const vnode = node as TestVNode;
  if (typeof vnode.type === 'function' && names.has(vnode.type.name)) {
    return materializeNamedComponents(vnode.type(vnode.props), names);
  }
  const children = childrenOf(vnode);
  if (children.length === 0) return vnode;
  return {
    ...vnode,
    props: {
      ...vnode.props,
      children: children.map((child) => materializeNamedComponents(child, names)),
    },
  } as TestVNode;
}

function findAll(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

function findOne(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode {
  const found = findAll(root, predicate);
  expect(found).toHaveLength(1);
  return found[0];
}

function hasClass(vnode: TestVNode, name: string): boolean {
  return String(vnode.props.class ?? vnode.props.className ?? '').split(/\s+/).includes(name);
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return childrenOf(node as TestVNode).map(textOf).join('');
}

function cssRule(selector: string): string {
  const start = physicsPaintStudioCss.indexOf(selector);
  expect(start, `CSS rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const end = physicsPaintStudioCss.indexOf('}', start);
  return physicsPaintStudioCss.slice(start, end === -1 ? physicsPaintStudioCss.length : end + 1);
}

function sig<Value,>(value: Value): { value: Value } {
  return { value };
}

function createLibrary(): RotoScriptLibraryController {
  return {
    rows: sig([]),
    availability: sig({ saveDisabledReason: null, canSave: true, canRename: true, canDelete: true }),
    selected: sig(null),
    busy: sig(false),
    rename: sig(null),
    deleteConfirmation: sig(null),
    deleteError: sig(null),
    actionMutationDisabledReason: sig(null),
    selectedId: sig(null),
    status: sig(null),
    skippedInvalidCount: sig(0),
    requestDelete: vi.fn(),
  } as unknown as RotoScriptLibraryController;
}

function createPlayScript(): RotoPlayScriptController {
  return {
    disabledReason: sig(null),
    status: sig(null),
    appliedSummary: {
      line1: sig('Progressive · Original colors · Motion 25/40'),
      line2: sig('No frames generated yet'),
    },
    openConfirmation: vi.fn(async () => {}),
  } as unknown as RotoPlayScriptController;
}

function createRotoScript(): RotoScriptClipboardController {
  return {
    availability: sig({
      replacementApplyDisabledReason: null,
      canCopy: true,
      canApply: true,
      canDiscard: true,
      copyDisabledReason: null,
      applyDisabledReason: null,
      discardDisabledReason: null,
    }),
  } as unknown as RotoScriptClipboardController;
}

function renderScriptsPanel(
  selectedLoopClip: PhysicsPaintLoopClipPresentation | null,
  onOpenLoopEdit: (loopId: string) => Promise<unknown>,
  onCloseLoopClip: () => void,
): unknown {
  hooks.reset();
  const tree = PhysicsPaintScriptsPanel({
    library: createLibrary(),
    playScript: createPlayScript(),
    rotoScript: createRotoScript(),
    playButtonRef: { current: null },
    selectedLoopClip,
    onOpenLoopEdit,
    onCloseLoopClip,
    onSave: () => {},
    onActivateRow: () => {},
    onLoadAndApply: () => {},
    onDiscardScript: () => {},
    onCopyScript: () => {},
    onApplyScript: () => {},
    onRefresh: () => {},
  });
  return materializeNamedComponents(tree, new Set(['IconButton']));
}

function renderWorkflowStrip(
  loopContext: ReturnType<typeof derivePhysicPaintRotoLoopRanges> | null,
  presentations: ReadonlyMap<string, PhysicsPaintLoopClipPresentation>,
  selectedLoopClipIds: readonly string[],
  onSelectLoopClip: (loopId: string | null, gesture?: 'plain' | 'toggle' | 'range') => void,
  onOpenLoopEdit: (loopId: string) => Promise<unknown>,
  cellProps: Pick<Parameters<typeof PhysicsPaintWorkflowStrip>[0], 'rotoPhysicalCells' | 'cachedRotoFrames' | 'rotoSpacingSelection'> = {},
): unknown {
  hooks.reset();
  return PhysicsPaintWorkflowStrip({
    currentFrame: 0,
    isPlaying: false,
    ready: true,
    onion: { enabled: false, previous: false, next: false, count: 1, opacity: 0.5 },
    rotoLoopResolutionContext: loopContext,
    rotoLoopPresentations: presentations,
    selectedRotoLoopClipIds: selectedLoopClipIds,
    onSelectRotoLoopClip: onSelectLoopClip,
    onOpenRotoLoopEdit: onOpenLoopEdit,
    onNavigateToSyncedFrame: () => {},
    onGoToFirstFrame: () => {},
    onGoToPreviousFrame: () => {},
    onGoToNextFrame: () => {},
    onGoToLastFrame: () => {},
    onOnionChange: () => {},
    ...cellProps,
  });
}

function explicitGroupRange(start: number, endExclusive: number, overrides: Partial<PhysicPaintRotoLoopRange> = {}): PhysicPaintRotoLoopRange {
  return {
    loopId: 'group-a',
    placementStart: start,
    phaseOrigin: 10,
    cycleLength: 6,
    sourceFrameCount: 6,
    sourceKeyIds: ['A', 'B'],
    sourceCycleId: 'cycle-a',
    sourceOffsets: [0, 1],
    repeat: 1,
    requestedEnd: endExclusive,
    effectiveEnd: endExclusive,
    boundary: 'project-end',
    truncated: false,
    partialCycle: false,
    unresolved: null,
    ...overrides,
  } as PhysicPaintRotoLoopRange;
}

describe('PhysicsPaintLoopClipRail ownership tracer', () => {
  it('renders explicit fragments as separate targets for one stable selected Group', () => {
    const ranges = [explicitGroupRange(10, 12), explicitGroupRange(13, 16)];
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'group-a',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 1,
      mode: 'progressive',
      scriptId: 'action-a',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 16,
      visibleRanges: [{ start: 10, endExclusive: 12 }, { start: 13, endExclusive: 16 }],
      frameOverrides: [],
    };
    const presentations = new Map([[
      clip.loopId,
      projectPhysicsPaintLoopClipPresentation(ranges[0], clip, 'Walk'),
    ]]);
    const onSelectLoopClip = vi.fn();
    const onOpenLoopEdit = vi.fn(async () => {});

    hooks.reset();
    const tree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges,
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 18 },
      framePitch: 18,
      selectedLoopClipIds: ['group-a'],
      onSelectLoopClip,
      onOpenLoopEdit,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));

    const rail = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail'));
    expect(rail.props['aria-label']).toBe('Groups');
    const anchors = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-anchor'));
    expect(anchors.map((anchor) => anchor.props.style)).toEqual([
      { left: '36px', width: '36px' },
      { left: '90px', width: '54px' },
    ]);
    const targets = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.props['aria-pressed'])).toEqual([true, true]);
    expect(targets.map((target) => target.props['aria-label'])).toEqual([
      'Walk Group. Fragment 1 of 2, frames 10 through 11. Motion Group. Modified locally — Regenerate to restore from Action.',
      'Walk Group. Fragment 2 of 2, frames 13 through 15. Motion Group. Modified locally — Regenerate to restore from Action.',
    ]);
    expect(textOf(tree)).toContain('Range F10–F11 · Fragment 1 of 2');
    expect(textOf(tree)).toContain('Range F13–F15 · Fragment 2 of 2');

    const dots = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-lifecycle-dot'));
    expect(dots).toHaveLength(2);
    expect(dots.every((dot) => hasClass(dot, 'modified'))).toBe(true);
    expect(dots.map((dot) => dot.props['aria-hidden'])).toEqual(['true', 'true']);

    const space = { key: ' ', stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (targets[1].props.onKeyDown as (event: typeof space) => void)(space);
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith('group-a', 'plain');
    expect(onOpenLoopEdit).not.toHaveBeenCalled();
  });

  it.each([
    ['synchronized', '#34d399'],
    ['modified', '#fb923c'],
    ['detached', '#9ca3af'],
    ['unavailable', '#6b7280'],
  ] as const)('pins the passive %s lifecycle dot geometry and color', (lifecycle, color) => {
    const dotRule = cssRule(`.physics-paint-loop-clip-lifecycle-dot.${lifecycle} {`);
    expect(dotRule).toContain(`background: ${color}`);
    const baseRule = cssRule('.physics-paint-loop-clip-lifecycle-dot {');
    expect(baseRule).toContain('width: 6px');
    expect(baseRule).toContain('height: 6px');
    expect(baseRule).toContain('pointer-events: none');
  });

  it('omits the dot for unresolved fragments and gives unresolved copy precedence', () => {
    const unresolvedRange = explicitGroupRange(10, 12, {
      unresolved: { missingSourceKeyIds: ['private-key-id'] },
    });
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'group-a', placementStart: 10, sourceKeyIds: ['A'], repeat: 1,
      mode: 'static', scriptId: 'action-a', syncState: 'modified', provenanceState: 'detached',
    };
    const presentations = new Map([['group-a', projectPhysicsPaintLoopClipPresentation(unresolvedRange, clip, 'Pose')]]);

    hooks.reset();
    const tree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: [unresolvedRange],
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 18 },
      framePitch: 18,
      selectedLoopClipIds: [],
      onSelectLoopClip: vi.fn(),
      onOpenLoopEdit: vi.fn(async () => {}),
    }), new Set(['PhysicsPaintLoopClipRailTarget']));

    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-lifecycle-dot'))).toHaveLength(0);
    const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(hasClass(target, 'unresolved')).toBe(true);
    expect(target.props['aria-label']).toContain('Source missing');
    expect(target.props['aria-label']).not.toContain('Modified locally');
    expect(target.props['aria-label']).not.toContain('private-key-id');
  });

  it('adds passive mode-colored linked halos to every unselected fragment without changing semantics', () => {
    const ranges = [explicitGroupRange(10, 12), explicitGroupRange(13, 16)];
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'group-a', placementStart: 10, sourceKeyIds: ['A'], repeat: 1,
      mode: 'static', scriptId: 'action-a', syncState: 'synchronized', provenanceState: 'attached',
    };
    const presentations = new Map([['group-a', projectPhysicsPaintLoopClipPresentation(ranges[0], clip, 'Pose')]]);

    hooks.reset();
    const tree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges,
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 18 },
      framePitch: 18,
      selectedLoopClipIds: [],
      linkedLoopClipIds: ['group-a'],
      linkedActionName: 'Pose',
      onSelectLoopClip: vi.fn(),
      onOpenLoopEdit: vi.fn(async () => {}),
    }), new Set(['PhysicsPaintLoopClipRailTarget']));

    const targets = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(targets).toHaveLength(2);
    expect(targets.every((target) => hasClass(target, 'action-linked'))).toBe(true);
    expect(targets.map((target) => target.props['aria-pressed'])).toEqual([false, false]);
    expect(targets.every((target) => target.props['aria-selected'] === undefined)).toBe(true);
    expect(targets.every((target) => String(target.props['aria-label']).endsWith('Linked to selected Action Pose.'))).toBe(true);
    const staticHalo = cssRule('.physics-paint-loop-clip-rail-target.mode-static.action-linked:not(.selected) {');
    expect(staticHalo).toContain('box-shadow: 0 0 0 1px #67e8f9, 0 0 5px rgba(103, 232, 249, 0.5)');
    const motionHalo = cssRule('.physics-paint-loop-clip-rail-target.mode-progressive.action-linked:not(.selected) {');
    expect(motionHalo).toContain('box-shadow: 0 0 0 1px #c4b5fd, 0 0 5px rgba(196, 181, 253, 0.55)');
  });

  it('pins exact rail, target, endpoint, focus, and zero-added-height geometry', () => {
    expect(cssRule('.physics-paint-loop-clip-rail-segment {')).toContain('height: 3px');
    expect(cssRule('.physics-paint-loop-clip-rail-target {')).toContain('height: 12px');
    expect(cssRule('.physics-paint-loop-clip-rail-anchor {')).toContain('min-width: 12px');
    const focusRule = cssRule('.physics-paint-loop-clip-rail-target:focus-visible {');
    expect(focusRule).toContain('outline: 2px solid #f2f5f7');
    expect(focusRule).toContain('outline-offset: 2px');
    expect(cssRule('.physics-paint-workflow-strip {')).toContain('height: 161px');
    expect(cssRule('.physics-paint-lane {')).toContain('height: 38px');
    expect(cssRule('.physics-paint-roto-action-row {')).toContain('height: 34px');
    expect(physicsPaintStudioCss).not.toContain('physics-paint-group-lifecycle-lane');
  });
  it('dispatches plain, Shift range, and Cmd/Ctrl toggle rail selection gestures', () => {
    vi.useFakeTimers();
    const clips: PhysicPaintRotoLoopClip[] = [
      {
        loopId: 'loop-a',
        placementStart: 0,
        sourceKeyIds: ['A1', 'A2', 'A3'],
        repeat: 1,
        mode: 'progressive',
      },
      {
        loopId: 'loop-b',
        placementStart: 3,
        sourceKeyIds: ['B1', 'B2', 'B3'],
        repeat: 1,
        mode: 'static',
      },
    ];
    const context = derivePhysicPaintRotoLoopRanges({
      identities: clips.flatMap((clip) => clip.sourceKeyIds.map((keyId, index) => ({
        keyId,
        appFrame: clip.placementStart + index,
      }))),
      loopClips: clips,
      parentEndExclusive: 12,
      capacity: 120,
      interpolationEnabled: false,
    });
    const presentations = new Map(context.ranges.map((range) => {
      const clip = clips.find((candidate) => candidate.loopId === range.loopId)!;
      return [range.loopId, projectPhysicsPaintLoopClipPresentation(range, clip, null)] as const;
    }));
    const onSelectLoopClip = vi.fn();

    hooks.reset();
    const tree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: context.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 0, endFrameExclusive: 12 },
      framePitch: 18,
      selectedLoopClipIds: [],
      onSelectLoopClip,
      onOpenLoopEdit: vi.fn(async () => {}),
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const targets = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

    (targets[0].props.onClick as (event: unknown) => void)({
      timeStamp: 100,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    (targets[1].props.onClick as (event: unknown) => void)({
      timeStamp: 500,
      metaKey: false,
      ctrlKey: false,
      shiftKey: true,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    (targets[1].props.onClick as (event: unknown) => void)({
      timeStamp: 900,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);

    expect(onSelectLoopClip.mock.calls).toEqual([
      ['loop-a', 'plain'],
      ['loop-b', 'range'],
      ['loop-b', 'toggle'],
    ]);
    vi.useRealTimers();
  });

  it('integrates Loop Clip ownership through all nine tracer checks', async () => {
    vi.useFakeTimers();
    const rawLoopId = '0f65c808-raw-loop-uuid';
    const sourceKeyIds = Array.from({ length: 5 }, (_, index) => `source-${index}`);
    const clip: PhysicPaintRotoLoopClip = {
      loopId: rawLoopId,
      placementStart: 10,
      sourceKeyIds,
      repeat: 5,
      mode: 'progressive',
      scriptId: 'script-walk',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
    };
    const loopContext = derivePhysicPaintRotoLoopRanges({
      identities: sourceKeyIds.map((keyId, appFrame) => ({ keyId, appFrame })),
      loopClips: [clip],
      parentEndExclusive: 40,
      capacity: 120,
      interpolationEnabled: false,
    });
    const range = loopContext.ranges[0];
    const presentation = projectPhysicsPaintLoopClipPresentation(range, clip, 'Walk');
    const presentations = new Map([[rawLoopId, presentation]]);
    const selectedLoopClipId = rawLoopId;
    const onSelectLoopClip = vi.fn();
    const onOpenLoopEdit = vi.fn(async () => {});

    expect(projectPhysicsPaintLoopClipGeometry(
      range,
      { startFrame: 8, endFrameExclusive: 20 },
      18,
    )).toEqual({ left: 36, width: 180 });

    hooks.reset();
    expect(PhysicsPaintLoopClipRail({
      ranges: [],
      presentations: new Map(),
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 20 },
      framePitch: 18,
      selectedLoopClipIds: [],
      onSelectLoopClip,
      onOpenLoopEdit,
    })).toBeNull();

    hooks.reset();
    const railTree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: loopContext.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 20 },
      framePitch: 18,
      selectedLoopClipIds: [selectedLoopClipId],
      onSelectLoopClip,
      onOpenLoopEdit,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    expect(findAll(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail'))).toHaveLength(1);
    const anchor = findOne(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-anchor'));
    const target = findOne(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    const segment = findOne(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-segment'));
    expect(anchor.props.style).toEqual({ left: '36px', width: '180px' });
    expect(target.props['aria-pressed']).toBe(true);
    expect(hasClass(target, 'mode-progressive')).toBe(true);
    expect(hasClass(target, 'boundary-start')).toBe(true);
    expect(hasClass(target, 'boundary-end')).toBe(false);
    expect(segment).toBeTruthy();
    const railSegmentRule = cssRule('.physics-paint-loop-clip-rail-segment {');
    expect(railSegmentRule).toContain('height: 3px');
    expect(railSegmentRule).toContain('background: #8b5cf6');
    const railHoverRule = cssRule('.physics-paint-loop-clip-rail-target:hover:not(.selected) .physics-paint-loop-clip-rail-segment,');
    expect(railHoverRule).toContain('background: #c4b5fd');
    const railSelectedRule = cssRule('.physics-paint-loop-clip-rail-target.selected .physics-paint-loop-clip-rail-segment {');
    expect(railSelectedRule).toContain('background: #f59e0b');
    expect(physicsPaintStudioCss).not.toContain('background: #a78bfa');
    expect(physicsPaintStudioCss).not.toContain('.physics-paint-loop-clip-rail-target.truncated .physics-paint-loop-clip-rail-segment');
    expect(cssRule('.physics-paint-loop-clip-rail-target {')).toContain('height: 12px');
    const railTargetHoverRule = cssRule('.physics-paint-loop-clip-rail-target:hover:not(:disabled),');
    expect(railTargetHoverRule).toContain('background: transparent');
    expect(railTargetHoverRule).toContain('box-shadow: none');
    expect(cssRule('.physics-paint-loop-clip-rail-anchor {')).toContain('min-width: 12px');
    expect(physicsPaintStudioCss).not.toContain('.physics-paint-loop-clip-rail-target::after');

    (anchor.props.onPointerEnter as () => void)();
    expect(typeof target.props.onfocusin).toBe('function');
    (target.props.onfocusin as () => void)();
    const railCopy = `${String(target.props['aria-label'])} ${textOf(railTree)}`;
    for (const fact of ['Walk Group', 'Type: Motion', 'Cycle 5f × 5 = 25f', 'Effective 25f', 'Status: Synchronized with Action.']) {
      expect(railCopy).toContain(fact);
    }
    expect(railCopy).not.toContain(rawLoopId);
    const railTooltip = findOne(railTree, (vnode) => typeof vnode.type === 'function' && vnode.type.name === 'PhysicsPaintStyledTooltip');
    expect(railTooltip.props.topmost).toBe(true);
    expect(cssRule('.physics-paint-styled-tooltip--topmost {')).toContain('z-index: 69');

    const selectedSingleClick = { detail: 1, timeStamp: 100, stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (target.props.onClick as (event: typeof selectedSingleClick) => void)(selectedSingleClick);
    expect(selectedSingleClick.stopPropagation).toHaveBeenCalledOnce();
    expect(selectedSingleClick.preventDefault).not.toHaveBeenCalled();
    expect(onSelectLoopClip).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith(rawLoopId, 'plain');
    expect(onOpenLoopEdit).not.toHaveBeenCalled();

    hooks.reset();
    const unselectedRailTree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: loopContext.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 20 },
      framePitch: 18,
      selectedLoopClipIds: [],
      onSelectLoopClip,
      onOpenLoopEdit,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const unselectedTarget = findOne(unselectedRailTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    onSelectLoopClip.mockClear();
    (unselectedTarget.props.onClick as (event: typeof selectedSingleClick) => void)({ detail: 1, timeStamp: 1_000, stopPropagation: vi.fn(), preventDefault: vi.fn() });
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith(rawLoopId, 'plain');

    hooks.reset();
    const selectedAgainTree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: loopContext.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 20 },
      framePitch: 18,
      selectedLoopClipIds: [selectedLoopClipId],
      onSelectLoopClip,
      onOpenLoopEdit,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const selectedAgainTarget = findOne(selectedAgainTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    onSelectLoopClip.mockClear();
    const slowSecondClick = { detail: 2, timeStamp: 1_000 + LOOP_CLIP_FAST_DOUBLE_CLICK_MS + 50, stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (selectedAgainTarget.props.onClick as (event: typeof slowSecondClick) => void)(slowSecondClick);
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith(rawLoopId, 'plain');
    expect(onOpenLoopEdit).not.toHaveBeenCalled();

    hooks.reset();
    const fastDoubleTree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: loopContext.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 20 },
      framePitch: 18,
      selectedLoopClipIds: [],
      onSelectLoopClip,
      onOpenLoopEdit,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const fastDoubleTarget = findOne(fastDoubleTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    onSelectLoopClip.mockClear();
    const firstClick = { detail: 1, timeStamp: 2_000, stopPropagation: vi.fn(), preventDefault: vi.fn() };
    const secondClick = { detail: 2, timeStamp: 2_000 + LOOP_CLIP_FAST_DOUBLE_CLICK_MS - 1, stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (fastDoubleTarget.props.onClick as (event: typeof firstClick) => void)(firstClick);
    (fastDoubleTarget.props.onClick as (event: typeof secondClick) => void)(secondClick);
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(firstClick.stopPropagation).toHaveBeenCalledOnce();
    expect(secondClick.preventDefault).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith(rawLoopId, 'plain');
    expect(onOpenLoopEdit).toHaveBeenCalledOnce();
    expect(onOpenLoopEdit).toHaveBeenLastCalledWith(rawLoopId);

    onSelectLoopClip.mockClear();
    const enter = { key: 'Enter', stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (target.props.onKeyDown as (event: typeof enter) => void)(enter);
    expect(enter.stopPropagation).toHaveBeenCalledOnce();
    expect(enter.preventDefault).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith(rawLoopId, 'plain');
    expect(onOpenLoopEdit).toHaveBeenCalledTimes(2);
    expect(onOpenLoopEdit).toHaveBeenLastCalledWith(rawLoopId);

    const pointerDown = { stopPropagation: vi.fn() };
    (target.props.onPointerDown as (event: typeof pointerDown) => void)(pointerDown);
    expect(pointerDown.stopPropagation).toHaveBeenCalledOnce();
    expect(target.props.onPointerMove).toBeUndefined();
    expect(target.props.onDrag).toBeUndefined();
    expect(target.props.onDragStart).toBeUndefined();
    expect(target.props.setPointerCapture).toBeUndefined();

    const noLoopWorkflow = renderWorkflowStrip(null, new Map(), [], onSelectLoopClip, onOpenLoopEdit);
    expect(findAll(noLoopWorkflow, (vnode) => vnode.type === PhysicsPaintLoopClipRail)).toHaveLength(0);
    expect(findAll(noLoopWorkflow, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'))).toHaveLength(0);

    const workflowTree = renderWorkflowStrip(
      loopContext,
      presentations,
      [selectedLoopClipId],
      onSelectLoopClip,
      onOpenLoopEdit,
    );
    const strip = findOne(workflowTree, (vnode) => hasClass(vnode, 'physics-paint-workflow-strip'));
    const physicalRow = findOne(strip, (vnode) => hasClass(vnode, 'physics-paint-lane'));
    const mountedRails = findAll(physicalRow, (vnode) => vnode.type === PhysicsPaintLoopClipRail);
    expect(mountedRails).toHaveLength(1);
    expect(mountedRails[0].props.ranges).toBe(loopContext.ranges);
    expect(mountedRails[0].props.selectedLoopClipIds).toEqual([selectedLoopClipId]);
    expect(findAll(strip, (vnode) => hasClass(vnode, 'physics-paint-lane'))).toHaveLength(1);
    expect(findAll(strip, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-lane'))).toHaveLength(0);
    expect(cssRule('.physics-paint-workflow-strip {')).toContain('height: 161px');
    expect(cssRule('.physics-paint-lane {')).toContain('height: 38px');

    const linkedCells = findAll(workflowTree, (vnode) => String(vnode.props.cellClass ?? '').includes('roto-linked-loop-badge'));
    expect(linkedCells.length).toBeGreaterThan(0);
    expect(linkedCells[0].props.tooltipCopy).toBe('Linked · Repeat 1 · Source frame 1 of 5');
    expect(linkedCells[0].props.ariaLabel).toContain('Linked · Repeat 1 · Source frame 1 of 5');
    expect(String(linkedCells[0].props.ariaLabel)).not.toContain('No Roto content');
    expect(String(linkedCells[0].props.cellClass)).toContain('roto-linked-source-key');

    const onCloseLoopClip = vi.fn();
    const normalPanel = renderScriptsPanel(null, onOpenLoopEdit, onCloseLoopClip);
    expect(findAll(normalPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Create Group…')).toHaveLength(1);
    expect(findAll(normalPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-toolbar'))).toHaveLength(1);
    expect(findAll(normalPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-list'))).toHaveLength(1);
    expect(findAll(normalPanel, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-inspector'))).toHaveLength(0);

    const selectedPresentation = presentations.get(selectedLoopClipId) ?? null;
    expect(selectedPresentation?.loopId).toBe(selectedLoopClipId);
    const selectedPanel = renderScriptsPanel(selectedPresentation, onOpenLoopEdit, onCloseLoopClip);
    const editButton = findOne(selectedPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Edit Group — Walk Group');
    const closeButton = findOne(selectedPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Close Group inspector — Walk Group');
    expect(findAll(selectedPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Create Group…')).toHaveLength(0);
    expect(findAll(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-toolbar'))).toHaveLength(0);
    expect(findAll(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-summary'))).toHaveLength(0);
    expect(findAll(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-list'))).toHaveLength(0);
    const inspector = findOne(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-inspector'));
    expect(textOf(inspector)).toBe('NameWalk GroupSource ActionWalkPlacementF10CycleCycle 5f × 5 = 25fEffectiveEffective 25fGroup TypeMotionStatusSynchronized with Action.');
    expect(textOf(inspector)).not.toContain(rawLoopId);
    (editButton.props.onClick as () => void)();
    expect(onOpenLoopEdit).toHaveBeenCalledTimes(3);
    expect(onOpenLoopEdit).toHaveBeenLastCalledWith(selectedLoopClipId);
    (closeButton.props.onClick as () => void)();
    expect(onCloseLoopClip).toHaveBeenCalledOnce();

    const layerId = 'loop-tracer-layer';
    const records: PhysicPaintRotoRealKeyRecord[] = sourceKeyIds.map((keyId, appFrame) => ({
      keyId,
      appFrame,
      kind: 'real-key',
      payload: { frameIndex: 0, appFrame, dataUrl: 'data:image/png;base64,YQ==' },
    }));
    const loopClips = [clip];
    physicPaintStore.clearRotoPhysicalRecords(layerId);
    sequenceStore.reset();
    const layer: Layer = {
      id: layerId,
      name: 'Roto',
      type: 'physic-paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'physic-paint', layerId },
    };
    const fxSequence: Sequence = {
      id: 'loop-tracer-sequence',
      name: 'Loop tracer',
      kind: 'fx',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 40,
    };
    sequenceStore.sequences.value = [fxSequence];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const installed = physicPaintStore.replaceRotoPhysicalDocument(layerId, {
      capacity: 120,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      loopClips,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips),
    });
    expect(installed.ok).toBe(true);
    const mainTimelineOutput = {
      frames: frameMap.value,
      fxTracks: fxTrackLayouts.value,
    };
    expect(mainTimelineOutput.fxTracks).toHaveLength(1);
    expect(mainTimelineOutput.fxTracks[0]).toEqual(expect.objectContaining({
      sequenceId: 'loop-tracer-sequence',
      inFrame: 0,
      outFrame: 40,
      rotoKeyFrames: [0, 1, 2, 3, 4],
      repeatDurationMarkers: [{ startFrame: 10, frameCount: 25, mode: 'progressive' }],
    }));
    expect(Object.keys(mainTimelineOutput.fxTracks[0].repeatDurationMarkers![0])).toEqual([
      'startFrame',
      'frameCount',
      'mode',
    ]);
    expect(JSON.stringify(mainTimelineOutput)).not.toContain(rawLoopId);
    expect(Object.keys(mainTimelineOutput.fxTracks[0])).not.toContain('loopCapsules');
    expect(Object.keys(mainTimelineOutput.fxTracks[0])).not.toContain('loopClips');

    physicPaintStore.clearRotoPhysicalRecords(layerId);
    sequenceStore.reset();
    await Promise.resolve();
    vi.useRealTimers();
  });

  it('uses a cyan Static Group Rail theme with visible cuts at both Group endpoints', () => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'hold-loop',
      placementStart: 0,
      sourceKeyIds: ['H1', 'H2', 'H3'],
      repeat: 1,
      mode: 'static',
    };
    const context = derivePhysicPaintRotoLoopRanges({
      identities: clip.sourceKeyIds.map((keyId, appFrame) => ({ keyId, appFrame })),
      loopClips: [clip],
      parentEndExclusive: 6,
      capacity: 120,
      interpolationEnabled: false,
    });
    const presentations = new Map([[
      clip.loopId,
      projectPhysicsPaintLoopClipPresentation(context.ranges[0], clip, 'Hold pose'),
    ]]);

    hooks.reset();
    const tree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: context.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 0, endFrameExclusive: 6 },
      framePitch: 18,
      selectedLoopClipIds: [],
      onSelectLoopClip: vi.fn(),
      onOpenLoopEdit: vi.fn(async () => {}),
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

    expect(hasClass(target, 'mode-static')).toBe(true);
    expect(hasClass(target, 'boundary-start')).toBe(true);
    expect(hasClass(target, 'boundary-end')).toBe(true);
    expect(`${String(target.props['aria-label'])} ${textOf(tree)}`).toContain('Type: Static');
    expect(cssRule('.physics-paint-loop-clip-rail-target.mode-static .physics-paint-loop-clip-rail-segment {'))
      .toContain('background: #06b6d4');
    expect(cssRule('.physics-paint-loop-clip-rail-target.mode-static:hover:not(.selected) .physics-paint-loop-clip-rail-segment,'))
      .toContain('background: #67e8f9');
    expect(cssRule('.physics-paint-loop-clip-rail-target.boundary-start .physics-paint-loop-clip-rail-segment::before,'))
      .toContain('background: #f8fafc');
    expect(cssRule('.physics-paint-loop-clip-rail-target.boundary-end .physics-paint-loop-clip-rail-segment::after {'))
      .toContain('background: #f8fafc');
  });

  it('renders source-cycle generated cells blue and their repeated counterparts dark', () => {
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'loop-spaced',
      placementStart: 0,
      sourceKeyIds: ['A', 'B', 'C'],
      repeat: 2,
      mode: 'progressive',
    };
    const context = derivePhysicPaintRotoLoopRanges({
      identities: [
        { keyId: 'A', appFrame: 0 },
        { keyId: 'B', appFrame: 3 },
        { keyId: 'C', appFrame: 6 },
      ],
      loopClips: [clip],
      parentEndExclusive: 14,
      capacity: 120,
      interpolationEnabled: true,
    });
    const presentations = new Map([[
      clip.loopId,
      projectPhysicsPaintLoopClipPresentation(context.ranges[0], clip, 'Walk'),
    ]]);
    const sourceProxy = resolvePhysicPaintRotoSpacingProxy(context, 0)!;
    const tree = renderWorkflowStrip(
      context,
      presentations,
      [],
      () => {},
      async () => {},
      {
        rotoPhysicalCells: [
          { kind: 'real', appFrame: 0, keyId: 'A' },
          { kind: 'generated', appFrame: 1, leftKeyId: 'A', rightKeyId: 'B' },
          { kind: 'generated', appFrame: 8, leftKeyId: 'A', rightKeyId: 'B' },
        ],
        cachedRotoFrames: [
          { frameIndex: 1, appFrame: 1, dataUrl: 'data:image/png;base64,source', source: 'generated-interpolation' },
          { frameIndex: 8, appFrame: 8, dataUrl: 'data:image/png;base64,repeat', source: 'generated-interpolation' },
        ],
        rotoSpacingSelection: {
          sourceCycleId: sourceProxy.sourceCycleId,
          sourceKeyIds: sourceProxy.sourceKeyIds,
          selectedSourceKeyIds: [sourceProxy.sourceKeyId],
          anchorSourceIndex: sourceProxy.sourceIndex,
        },
      },
    );
    const boundaryStart = findOne(tree, (vnode) => vnode.props.frame === 0 && typeof vnode.props.cellClass === 'string');
    const sourceGenerated = findOne(tree, (vnode) => vnode.props.frame === 1 && typeof vnode.props.cellClass === 'string');
    const repeatedSourceKey = findOne(tree, (vnode) => vnode.props.frame === 7 && typeof vnode.props.cellClass === 'string');
    const repeatedGenerated = findOne(tree, (vnode) => vnode.props.frame === 8 && typeof vnode.props.cellClass === 'string');
    const boundaryEnd = findOne(tree, (vnode) => vnode.props.frame === 13 && typeof vnode.props.cellClass === 'string');

    expect(boundaryStart.props.cellClass).toContain('roto-loop-boundary-start');
    expect(boundaryStart.props.cellClass).not.toContain('roto-loop-boundary-end');
    expect(boundaryStart.props.cellClass).toContain('roto-spacing-proxy-selected');
    expect(sourceGenerated.props.cellClass).toContain('roto-fill-generated');
    expect(sourceGenerated.props.cellClass).toContain('roto-linked-source-generated');
    expect(sourceGenerated.props.cellClass).not.toContain('roto-linked-repeat');
    expect(repeatedSourceKey.props.cellClass).toContain('roto-linked-repeat');
    expect(repeatedSourceKey.props.cellClass).toContain('roto-linked-repeat-source-key');
    expect(repeatedSourceKey.props.cellClass).toContain('roto-spacing-proxy-selected');
    expect(repeatedGenerated.props.cellClass).toContain('roto-fill-generated');
    expect(repeatedGenerated.props.cellClass).toContain('roto-linked-repeat');
    expect(repeatedGenerated.props.cellClass).not.toContain('roto-linked-repeat-source-key');
    expect(repeatedGenerated.props.cellClass).not.toContain('roto-spacing-proxy-selected');
    expect(boundaryEnd.props.cellClass).not.toContain('roto-loop-boundary-start');
    expect(boundaryEnd.props.cellClass).toContain('roto-loop-boundary-end');
    expect(cssRule('.physics-paint-roto-cell.roto-linked-repeat.roto-linked-repeat-source-key {')).toContain('background: #43494f');
    const selectedRepeat = cssRule('.physics-paint-roto-cell.roto-linked-repeat.roto-spacing-proxy-selected:not(.current) {');
    expect(selectedRepeat).toContain('background: #4b6382');
    expect(selectedRepeat).not.toContain('#f5a623');
    expect(selectedRepeat).not.toContain('outline:');
    expect(cssRule('.physics-paint-roto-cell.roto-loop-boundary-start {')).toContain('border-left-color: #f8fafc');
    expect(cssRule('.physics-paint-roto-cell.roto-loop-boundary-end {')).toContain('border-right-color: #f8fafc');
  });
});
