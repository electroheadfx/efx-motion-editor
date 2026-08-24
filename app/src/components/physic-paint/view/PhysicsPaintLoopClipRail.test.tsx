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
  // Rewind the hook cursor without clearing refs/values so a re-render reads
  // the same hook indices (used by the drag-session ghost re-render).
  rewind() {
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
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { frameMap, fxTrackLayouts } from '../../../lib/frameMap';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { sequenceStore } from '../../../stores/sequenceStore';
import { registerDocument } from '../../../stores/efxPaintStore';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoKeyIdentity,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  derivePhysicPaintRotoLoopRanges,
  projectPhysicPaintRotoPhysicalTimeline,
  resolvePhysicPaintRotoLoopFrame,
  resolvePhysicPaintRotoSpacingProxy,
  type PhysicPaintRotoGroupDragClampInput,
  type PhysicPaintRotoLoopRange,
} from '../roto/physicsPaintRotoPhysicalResolver';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import { LOOP_CLIP_FAST_DOUBLE_CLICK_MS, LOOP_CLIP_SINGLE_CLICK_DELAY_MS, PhysicsPaintLoopClipRail } from './PhysicsPaintLoopClipRail';
import {
  useRotoTimelineActions,
  type RotoGroupDragPreparationResult,
  type RotoGroupDragPublication,
  type RotoTimelineActionsInput,
} from '../hooks/useRotoTimelineActions';
import { PhysicsPaintScriptsPanel } from './PhysicsPaintScriptsPanel';
import { PhysicsPaintWorkflowStrip } from './PhysicsPaintWorkflowStrip';
import {
  projectPhysicsPaintLoopClipGeometry,
  projectPhysicsPaintLoopClipPresentation,
  type PhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

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

function createPhysicalCells(
  capacity: number,
  overrides: readonly RotoPhysicalTimelineCell[] = [],
): readonly RotoPhysicalTimelineCell[] {
  const byFrame = new Map(overrides.map((cell) => [cell.appFrame, cell]));
  return Array.from({ length: capacity }, (_, appFrame) => (
    byFrame.get(appFrame) ?? { kind: 'empty', appFrame }
  ));
}

function renderWorkflowStrip(
  loopContext: ReturnType<typeof derivePhysicPaintRotoLoopRanges> | null,
  presentations: ReadonlyMap<string, PhysicsPaintLoopClipPresentation>,
  selectedLoopClipIds: readonly string[],
  onSelectLoopClip: (loopId: string | null, gesture?: 'plain' | 'toggle' | 'range' | 'union') => void,
  onOpenLoopEdit: (loopId: string) => Promise<unknown>,
  cellProps: Partial<Pick<Parameters<typeof PhysicsPaintWorkflowStrip>[0], 'rotoPhysicalCells' | 'cachedRotoFrames' | 'rotoSpacingSelection' | 'rotoKeyRecords' | 'rotoLoopClips'>> = {},
): unknown {
  hooks.reset();
  return PhysicsPaintWorkflowStrip({
    currentFrame: 0,
    isPlaying: false,
    ready: true,
    onion: { enabled: false, previous: false, next: false, count: 1, opacity: 0.5 },
    rotoPhysicalCells: createPhysicalCells(120),
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

function createGeneratedPresentationDocument(
  mode: PhysicPaintRotoLoopClip['mode'],
  options: {
    readonly visibleRanges?: PhysicPaintRotoLoopClip['visibleRanges'];
    readonly incomingInterpolationBreakKeyIds?: readonly string[];
  } = {},
): PhysicPaintRotoPhysicalDocument {
  const records: PhysicPaintRotoRealKeyRecord[] = [
    { keyId: 'A', appFrame: 0, kind: 'real-key', payload: { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,YQ==' } },
    { keyId: 'B', appFrame: 3, kind: 'real-key', payload: { frameIndex: 1, appFrame: 3, dataUrl: 'data:image/png;base64,Yg==' } },
  ];
  const clip: PhysicPaintRotoLoopClip = {
    loopId: `generated-${mode}`,
    placementStart: 0,
    sourceKeyIds: ['A', 'B'],
    repeat: 1,
    mode,
    scriptId: `script-${mode}`,
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 0,
    originalEndExclusive: 4,
    visibleRanges: options.visibleRanges ?? [{ start: 0, endExclusive: 4 }],
    frameOverrides: [],
  };
  const interpolation = { enabled: true, mode: 'duplicate' as const };
  const incomingInterpolationBreakKeyIds = options.incomingInterpolationBreakKeyIds ?? [];
  return parsePhysicPaintRotoPhysicalDocument({
    capacity: 12,
    realKeyRecords: records,
    groupOverrideRecords: [],
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips: [clip],
    incomingInterpolationBreakKeyIds,
    revision: buildPhysicPaintRotoPhysicalRevision(
      records,
      interpolation,
      [clip],
      incomingInterpolationBreakKeyIds,
      [],
    ),
  });
}

function renderGeneratedPresentationDocument(document: PhysicPaintRotoPhysicalDocument): {
  readonly classesByFrame: ReadonlyMap<number, string>;
  readonly semanticKindsByFrame: ReadonlyMap<number, unknown>;
  readonly resolutionKindsByFrame: ReadonlyMap<number, string>;
} {
  const identities = document.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame }));
  const loopContext = derivePhysicPaintRotoLoopRanges({
    identities,
    loopClips: document.loopClips,
    capacity: document.capacity,
    interpolationEnabled: document.interpolation.enabled,
  });
  const projection = projectPhysicPaintRotoPhysicalTimeline({
    identities,
    capacity: document.capacity,
    interpolationEnabled: document.interpolation.enabled,
    incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
  });
  if (!projection.ok) throw new Error('Expected presentation physical projection.');
  const presentations = new Map(document.loopClips.map((clip) => {
    const range = loopContext.ranges.find((candidate) => candidate.loopId === clip.loopId);
    if (!range) throw new Error('Expected presentation Group range.');
    return [clip.loopId, projectPhysicsPaintLoopClipPresentation(range, clip, 'Presentation oracle')] as const;
  }));
  const tree = renderWorkflowStrip(loopContext, presentations, [], () => {}, async () => {}, {
    rotoPhysicalCells: projection.projection.cells,
    rotoKeyRecords: document.realKeyRecords,
    rotoLoopClips: document.loopClips,
  });
  const cells = findAll(tree, (vnode) => typeof vnode.props.frame === 'number' && typeof vnode.props.cellClass === 'string');
  return {
    classesByFrame: new Map(cells.map((cell) => [cell.props.frame as number, String(cell.props.cellClass)])),
    semanticKindsByFrame: new Map(cells.map((cell) => [cell.props.frame as number, cell.props.semanticKind])),
    resolutionKindsByFrame: new Map(cells.map((cell) => {
      const frame = cell.props.frame as number;
      return [frame, resolvePhysicPaintRotoLoopFrame(loopContext, frame).kind];
    })),
  };
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
  it('renders one continuous target across fragmented visible ranges for one stable selected Group', () => {
    const ranges = [
      explicitGroupRange(10, 12, { requestedEnd: 16 }),
      explicitGroupRange(13, 16, { requestedEnd: 16 }),
    ];
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
      // The presentation reflects the loop's overall resolved extent, so it is
      // built from the last fragment (max effectiveEnd) — matching how the
      // studio builds the loopId-keyed presentation map (WR-03).
      projectPhysicsPaintLoopClipPresentation(ranges[1], clip, 'Walk'),
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
    expect(rail.props['aria-label']).toBe('Rails');
    const anchor = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-anchor'));
    expect(anchor.props.style).toEqual({ left: '36px', width: '108px' });
    const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(target.props['aria-pressed']).toBe(true);
    expect(target.props['aria-label']).toBe(
      'Walk Rail. Motion Rail. Cycle 6f × 1 = 6f. Effective 6 frames. Modified locally — Regenerate to restore from Action.',
    );
    expect(hasClass(target, 'selected')).toBe(true);
    expect(hasClass(target, 'boundary-start')).toBe(true);
    expect(hasClass(target, 'boundary-end')).toBe(true);
    expect(hasClass(target, 'boundary-cell-start')).toBe(true);
    expect(hasClass(target, 'boundary-cell-end')).toBe(true);
    expect(textOf(tree)).not.toContain('Fragment');
    expect(textOf(tree)).not.toContain('Range F');

    const dot = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-lifecycle-dot'));
    expect(hasClass(dot, 'modified')).toBe(true);
    expect(dot.props['aria-hidden']).toBe('true');

    const space = { key: ' ', stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (target.props.onKeyDown as (event: typeof space) => void)(space);
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith('group-a', 'plain');
    expect(onOpenLoopEdit).not.toHaveBeenCalled();
  });

  it('projects Motion and Static Group rails against the complete 600-frame extent', () => {
    const clips: readonly PhysicPaintRotoLoopClip[] = [
      { loopId: 'motion-high', placementStart: 540, sourceKeyIds: ['M1', 'M2'], repeat: 2, mode: 'progressive' },
      { loopId: 'static-high', placementStart: 570, sourceKeyIds: ['S1', 'S2'], repeat: 2, mode: 'static' },
    ];
    const identities = [
      { keyId: 'M1', appFrame: 0 },
      { keyId: 'M2', appFrame: 1 },
      { keyId: 'S1', appFrame: 10 },
      { keyId: 'S2', appFrame: 11 },
    ];
    const loopContext = derivePhysicPaintRotoLoopRanges({
      identities,
      loopClips: clips,
      capacity: 600,
      interpolationEnabled: false,
    });
    const presentations = new Map(loopContext.ranges.map((range) => {
      const clip = clips.find((candidate) => candidate.loopId === range.loopId)!;
      return [range.loopId, projectPhysicsPaintLoopClipPresentation(range, clip, null)] as const;
    }));
    const tree = renderWorkflowStrip(
      loopContext,
      presentations,
      [],
      vi.fn(),
      vi.fn(async () => {}),
      { rotoPhysicalCells: createPhysicalCells(600), rotoLoopClips: clips },
    );
    const rail = findOne(tree, (vnode) => vnode.type === PhysicsPaintLoopClipRail);

    expect(rail.props.visibleFrameWindow).toEqual({ startFrame: 0, endFrameExclusive: 600 });
    expect(rail.props.framePitch).toBe(18);

    hooks.reset();
    const railTree = materializeNamedComponents(
      PhysicsPaintLoopClipRail(rail.props as unknown as Parameters<typeof PhysicsPaintLoopClipRail>[0]),
      new Set(['PhysicsPaintLoopClipRailTarget']),
    );
    const anchors = findAll(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-anchor'));
    const targets = findAll(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

    expect(anchors.map((anchor) => anchor.props.style)).toEqual([
      { left: '9720px', width: '72px' },
      { left: '10260px', width: '72px' },
    ]);
    expect(targets).toHaveLength(2);
    expect(hasClass(targets[0], 'mode-progressive')).toBe(true);
    expect(hasClass(targets[1], 'mode-static')).toBe(true);
    for (const target of targets) {
      expect(hasClass(target, 'boundary-start')).toBe(true);
      expect(hasClass(target, 'boundary-end')).toBe(true);
      expect(hasClass(target, 'boundary-cell-start')).toBe(true);
      expect(hasClass(target, 'boundary-cell-end')).toBe(true);
    }
  });

  it('publishes the shared Infinity boundary to Group Rail drag despite a deleted tail', () => {
    const records: PhysicPaintRotoRealKeyRecord[] = [
      { keyId: 'A', appFrame: 10, kind: 'real-key', payload: { frameIndex: 0, appFrame: 10, dataUrl: 'data:image/png;base64,YQ==' } },
      { keyId: 'B', appFrame: 12, kind: 'real-key', payload: { frameIndex: 1, appFrame: 12, dataUrl: 'data:image/png;base64,Yg==' } },
      { keyId: 'C', appFrame: 30, kind: 'real-key', payload: { frameIndex: 2, appFrame: 30, dataUrl: 'data:image/png;base64,Yw==' } },
      { keyId: 'D', appFrame: 31, kind: 'real-key', payload: { frameIndex: 3, appFrame: 31, dataUrl: 'data:image/png;base64,ZA==' } },
    ];
    const infinityClip: PhysicPaintRotoLoopClip = {
      loopId: 'group-a',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity',
      mode: 'progressive',
      scriptId: 'action-a',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 10, endExclusive: 25 }],
      frameOverrides: [],
    };
    const nextClip: PhysicPaintRotoLoopClip = {
      loopId: 'group-next',
      placementStart: 30,
      sourceKeyIds: ['C', 'D'],
      repeat: 1,
      mode: 'static',
    };
    const loopContext = derivePhysicPaintRotoLoopRanges({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      loopClips: [infinityClip, nextClip],
      capacity: 40,
      interpolationEnabled: false,
    });
    const infinityRange = loopContext.ranges.find((range) => range.loopId === infinityClip.loopId);
    if (!infinityRange) throw new Error('Expected Infinity Group range.');
    const presentations = new Map([[
      infinityClip.loopId,
      projectPhysicsPaintLoopClipPresentation(infinityRange, infinityClip, 'Walk'),
    ]]);

    const tree = renderWorkflowStrip(
      loopContext,
      presentations,
      [],
      vi.fn(),
      vi.fn(async () => {}),
      { rotoKeyRecords: records, rotoLoopClips: [infinityClip, nextClip] },
    );
    const rail = findOne(tree, (vnode) => vnode.type === PhysicsPaintLoopClipRail);
    const getClampInput = rail.props.getClampInput as (
      loopId: string,
    ) => Omit<
      PhysicPaintRotoGroupDragClampInput,
      'proposedDestinationPlacementStart'
    > | null;
    const clampInput = getClampInput(infinityClip.loopId);
    if (!clampInput) throw new Error('Expected Group Rail clamp input.');

    expect(clampInput.draggedInterval).toEqual({
      phaseOrigin: 10,
      effectiveEnd: 30,
    });
  });

  it('keeps deleted Group phases gray under one rail and exposes only true outer endpoint cuts', () => {
    const records: PhysicPaintRotoRealKeyRecord[] = [
      { keyId: 'A', appFrame: 0, kind: 'real-key', payload: { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,YQ==' } },
      { keyId: 'B', appFrame: 1, kind: 'real-key', payload: { frameIndex: 1, appFrame: 1, dataUrl: 'data:image/png;base64,Yg==' } },
    ];
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'group-a',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 3,
      mode: 'progressive',
      scriptId: 'action-a',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 16,
      visibleRanges: [
        { start: 10, endExclusive: 11 },
        { start: 12, endExclusive: 13 },
        { start: 14, endExclusive: 15 },
      ],
      frameOverrides: [],
    };
    const ranges = [
      explicitGroupRange(10, 11, {
        cycleLength: 2,
        sourceFrameCount: 2,
        sourceOffsets: [0, 1],
        repeat: 3,
        requestedEnd: 16,
      }),
      explicitGroupRange(12, 13, {
        cycleLength: 2,
        sourceFrameCount: 2,
        sourceOffsets: [0, 1],
        repeat: 3,
        requestedEnd: 16,
      }),
      explicitGroupRange(14, 15, {
        cycleLength: 2,
        sourceFrameCount: 2,
        sourceOffsets: [0, 1],
        repeat: 3,
        requestedEnd: 16,
      }),
    ];
    const loopContext = {
      ranges,
      keyIdByAppFrame: new Map(records.map((record) => [record.appFrame, record.keyId])),
      interpolationEnabled: false,
    };
    const presentations = new Map([[
      clip.loopId,
      projectPhysicsPaintLoopClipPresentation(ranges[0], clip, 'Walk'),
    ]]);

    const tree = renderWorkflowStrip(
      loopContext,
      presentations,
      [],
      () => {},
      async () => {},
      {
        rotoKeyRecords: records,
        rotoLoopClips: [clip],
      },
    );

    const cells = new Map(
      findAll(tree, (vnode) => typeof vnode.props.frame === 'number' && typeof vnode.props.cellClass === 'string')
        .map((vnode) => [vnode.props.frame as number, String(vnode.props.cellClass)]),
    );
    for (const frame of [11, 13, 15]) {
      expect(cells.get(frame)).toContain('roto-fill-empty');
    }
    expect(cells.get(10)).toContain('roto-loop-boundary-start');
    expect(cells.get(10)).not.toContain('roto-loop-boundary-end');
    expect(cells.get(15)).toContain('roto-loop-boundary-end');
    expect(cells.get(15)).not.toContain('roto-loop-boundary-start');
    for (const frame of [11, 12, 13, 14]) {
      expect(cells.get(frame)).not.toContain('roto-loop-boundary-start');
      expect(cells.get(frame)).not.toContain('roto-loop-boundary-end');
    }
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

  it.each([
    ['progressive', '#c4b5fd'],
    ['static', '#67e8f9'],
  ] as const)('keeps linked-only %s Groups to one passive 3px segment', (mode, linkedColor) => {
    const ranges = [
      explicitGroupRange(10, 12, { requestedEnd: 16 }),
      explicitGroupRange(13, 16, { requestedEnd: 16 }),
    ];
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'group-a', placementStart: 10, sourceKeyIds: ['A'], repeat: 1,
      mode, scriptId: 'action-a', syncState: 'synchronized', provenanceState: 'attached',
    };
    const presentations = new Map([['group-a', projectPhysicsPaintLoopClipPresentation(ranges[1], clip, 'Pose')]]);

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

    const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(hasClass(target, 'action-linked')).toBe(true);
    expect(hasClass(target, 'selected')).toBe(false);
    expect(target.props['aria-pressed']).toBe(false);
    expect(target.props['aria-selected']).toBeUndefined();
    expect(String(target.props['aria-label'])).toBe(
      `Pose Rail. ${mode === 'static' ? 'Static' : 'Motion'} Rail. Cycle 6f × 1 = 6f. Effective 6 frames. Synchronized with Action. Linked to selected Action Pose.`,
    );
    expect(String(target.props['aria-label'])).not.toContain('Fragment');
    expect(findAll(target, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-segment'))).toHaveLength(1);

    const linkedSegmentRule = cssRule(`.physics-paint-loop-clip-rail-target.mode-${mode}.action-linked:not(.selected) .physics-paint-loop-clip-rail-segment {`);
    expect(linkedSegmentRule).toContain(`background: ${linkedColor}`);
    expect(linkedSegmentRule).not.toMatch(/box-shadow|border|outline|::before|::after/);
    expect(physicsPaintStudioCss).not.toContain(`.physics-paint-loop-clip-rail-target.mode-${mode}.action-linked:not(.selected) {`);
  });

  it('keeps selected orange authoritative when the same Group remains Action-linked', () => {
    const range = explicitGroupRange(10, 16);
    const clip: PhysicPaintRotoLoopClip = {
      loopId: 'group-a', placementStart: 10, sourceKeyIds: ['A'], repeat: 1,
      mode: 'progressive', scriptId: 'action-a', syncState: 'modified', provenanceState: 'attached',
    };
    const presentations = new Map([['group-a', projectPhysicsPaintLoopClipPresentation(range, clip, 'Walk')]]);

    hooks.reset();
    const tree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: [range],
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 18 },
      framePitch: 18,
      selectedLoopClipIds: ['group-a'],
      linkedLoopClipIds: ['group-a'],
      linkedActionName: 'Walk',
      onSelectLoopClip: vi.fn(),
      onOpenLoopEdit: vi.fn(async () => {}),
    }), new Set(['PhysicsPaintLoopClipRailTarget']));

    const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(hasClass(target, 'action-linked')).toBe(true);
    expect(hasClass(target, 'selected')).toBe(true);
    expect(target.props['aria-pressed']).toBe(true);
    expect(findAll(target, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-segment'))).toHaveLength(1);
    expect(cssRule('.physics-paint-loop-clip-rail-target.selected .physics-paint-loop-clip-rail-segment {'))
      .toContain('background: #f59e0b');
  });

  it('pins exact rail, target, endpoint, focus, and zero-added-height geometry', () => {
    expect(cssRule('.physics-paint-loop-clip-rail-segment {')).toContain('height: 3px');
    expect(cssRule('.physics-paint-loop-clip-rail-target {')).toContain('height: 12px');
    expect(cssRule('.physics-paint-loop-clip-rail-anchor {')).toContain('min-width: 12px');
    const focusRule = cssRule('.physics-paint-rail-target:focus,');
    expect(focusRule).toContain('.physics-paint-rail-target:focus,\n.physics-paint-rail-target:focus-visible {');
    expect(focusRule).toContain('outline: none');
    const ringRule = cssRule('.physics-paint-rail-target:focus-visible::after {');
    expect(ringRule).toContain('border: 2px solid #f2f5f7');
    expect(ringRule).toContain('top: -2px');
    expect(ringRule).toContain('bottom: -24px');
    expect(ringRule).toContain('border-radius: 8px');
    expect(cssRule('.physics-paint-workflow-strip {')).toContain('height: 264px');
    expect(cssRule('.physics-paint-lane {')).toContain('height: 48px');
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

  it('commits modifier-click set membership synchronously with no single-click timer (43.6-08 G-43.6-8)', () => {
    vi.useFakeTimers();
    const clips: PhysicPaintRotoLoopClip[] = [
      {
        loopId: 'loop-a',
        placementStart: 0,
        sourceKeyIds: ['A1', 'A2', 'A3'],
        repeat: 1,
        mode: 'progressive',
      },
    ];
    const context = derivePhysicPaintRotoLoopRanges({
      identities: clips.flatMap((clip) => clip.sourceKeyIds.map((keyId, index) => ({
        keyId,
        appFrame: clip.placementStart + index,
      }))),
      loopClips: clips,
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

    // A Cmd+click commits synchronously — before any timer advance.
    (targets[0].props.onClick as (event: unknown) => void)({
      timeStamp: 100,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    expect(onSelectLoopClip.mock.calls).toEqual([['loop-a', 'toggle']]);
    // Advancing past the single-click delay does not fire a second commit.
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(onSelectLoopClip.mock.calls).toEqual([['loop-a', 'toggle']]);

    // A plain click still commits only after the single-click delay.
    (targets[0].props.onClick as (event: unknown) => void)({
      timeStamp: 900,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    expect(onSelectLoopClip.mock.calls).toEqual([['loop-a', 'toggle']]);
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(onSelectLoopClip.mock.calls).toEqual([
      ['loop-a', 'toggle'],
      ['loop-a', 'plain'],
    ]);
    vi.useRealTimers();
  });

  it('commits an in-window Cmd+click synchronously and never opens the editor (43.6-10 WR-02)', () => {
    vi.useFakeTimers();
    const clips: PhysicPaintRotoLoopClip[] = [
      {
        loopId: 'loop-a',
        placementStart: 0,
        sourceKeyIds: ['A1', 'A2', 'A3'],
        repeat: 1,
        mode: 'progressive',
      },
    ];
    const context = derivePhysicPaintRotoLoopRanges({
      identities: clips.flatMap((clip) => clip.sourceKeyIds.map((keyId, index) => ({
        keyId,
        appFrame: clip.placementStart + index,
      }))),
      loopClips: clips,
      capacity: 120,
      interpolationEnabled: false,
    });
    const presentations = new Map(context.ranges.map((range) => {
      const clip = clips.find((candidate) => candidate.loopId === range.loopId)!;
      return [range.loopId, projectPhysicsPaintLoopClipPresentation(range, clip, null)] as const;
    }));
    const onSelectLoopClip = vi.fn();
    const onOpenLoopEdit = vi.fn(async () => {});

    hooks.reset();
    const tree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: context.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 0, endFrameExclusive: 12 },
      framePitch: 18,
      selectedLoopClipIds: [],
      onSelectLoopClip,
      onOpenLoopEdit,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const targets = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

    // A plain click arms the pending single-click timer.
    (targets[0].props.onClick as (event: unknown) => void)({
      timeStamp: 100,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    // A Cmd+click inside the pending window is a set-membership gesture, never
    // an open-editor double-click intent: it must commit 'toggle' synchronously
    // and must not route to the editor branch.
    (targets[0].props.onClick as (event: unknown) => void)({
      timeStamp: 200,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    expect(onSelectLoopClip.mock.calls).toEqual([['loop-a', 'toggle']]);
    expect(onOpenLoopEdit).not.toHaveBeenCalled();
    // Advancing past the single-click delay does not fire a second commit.
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(onSelectLoopClip.mock.calls).toEqual([['loop-a', 'toggle']]);
    expect(onOpenLoopEdit).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  // RED 2: a single Motion/Static Rail that is a set-of-one paint member but
  // NOT a move member runs its OWN 43.3/43.4 Group drag (never the batch
  // session). Fails against current HEAD (routes to the batch session).
  it('runs the own Group drag for a single Motion/Static Rail that is a set-of-one paint member but not a move member (RED 2)', () => {
    const clips: PhysicPaintRotoLoopClip[] = [
      {
        loopId: 'loop-a',
        placementStart: 0,
        sourceKeyIds: ['A1', 'A2', 'A3'],
        repeat: 1,
        mode: 'progressive',
      },
    ];
    const context = derivePhysicPaintRotoLoopRanges({
      identities: clips.flatMap((clip) => clip.sourceKeyIds.map((keyId, index) => ({
        keyId,
        appFrame: clip.placementStart + index,
      }))),
      loopClips: clips,
      capacity: 120,
      interpolationEnabled: false,
    });
    const presentations = new Map(context.ranges.map((range) => {
      const clip = clips.find((candidate) => candidate.loopId === range.loopId)!;
      return [range.loopId, projectPhysicsPaintLoopClipPresentation(range, clip, null)] as const;
    }));
    const onSelectLoopClip = vi.fn();
    const onOpenLoopEdit = vi.fn(async () => {});
    const onRailSetDragPointerDown = vi.fn();

    hooks.reset();
    const tree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: context.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 0, endFrameExclusive: 12 },
      framePitch: 18,
      selectedLoopClipIds: [],
      railSetMemberLoopIds: ['loop-a'],
      onSelectLoopClip,
      onOpenLoopEdit,
      onRailSetDragPointerDown,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

    // loop-a is a paint-only member (set-of-one): the own Group drag hook
    // takes the pointer-down (it calls stopPropagation), never the batch
    // session.
    const pointerEvent = { pointerId: 1, clientX: 0, clientY: 0, stopPropagation: vi.fn() };
    (target.props.onPointerDown as (event: unknown) => void)(pointerEvent);
    expect(onRailSetDragPointerDown).not.toHaveBeenCalled();
    expect(pointerEvent.stopPropagation).toHaveBeenCalledOnce();
  });

  // RED 3: a genuine explicit move member (railSetMoveMemberLoopIds) still
  // routes its pointer-down to the batch session and keeps the
  // registerClickSequenceCanceller 250ms-timer cancellation behavior.
  // Fails against current HEAD because the gate is isSetMember today.
  it('registers its click-sequence canceller with the batch registry (WR-01) and clears the pending single-click timer on drag begin (RED 3)', () => {
    vi.useFakeTimers();
    const clips: PhysicPaintRotoLoopClip[] = [
      {
        loopId: 'loop-a',
        placementStart: 0,
        sourceKeyIds: ['A1', 'A2', 'A3'],
        repeat: 1,
        mode: 'progressive',
      },
    ];
    const context = derivePhysicPaintRotoLoopRanges({
      identities: clips.flatMap((clip) => clip.sourceKeyIds.map((keyId, index) => ({
        keyId,
        appFrame: clip.placementStart + index,
      }))),
      loopClips: clips,
      capacity: 120,
      interpolationEnabled: false,
    });
    const presentations = new Map(context.ranges.map((range) => {
      const clip = clips.find((candidate) => candidate.loopId === range.loopId)!;
      return [range.loopId, projectPhysicsPaintLoopClipPresentation(range, clip, null)] as const;
    }));
    const onSelectLoopClip = vi.fn();
    const onOpenLoopEdit = vi.fn(async () => {});
    const onRailSetDragPointerDown = vi.fn();
    const registerClickSequenceCanceller = vi.fn();

    hooks.reset();
    const tree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: context.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 0, endFrameExclusive: 12 },
      framePitch: 18,
      selectedLoopClipIds: [],
      railSetMoveMemberLoopIds: ['loop-a'],
      onSelectLoopClip,
      onOpenLoopEdit,
      onRailSetDragPointerDown,
      registerClickSequenceCanceller,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(registerClickSequenceCanceller).toHaveBeenCalledOnce();

    // A move member's pointer-down routes to the batch session (D-08), so the
    // rail's own drag hook never starts and never clears the timer itself.
    const pointerEvent = { pointerId: 1, clientX: 0, clientY: 0 };
    (target.props.onPointerDown as (event: unknown) => void)(pointerEvent);
    expect(onRailSetDragPointerDown).toHaveBeenCalledWith(pointerEvent);

    // The click arms the 250 ms single-click timer.
    (target.props.onClick as (event: unknown) => void)({
      timeStamp: 100,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });

    // The batch session's clearClickSequence (drag-begin threshold crossing)
    // reaches this rail through the registry and cancels the pending timer.
    const canceller = registerClickSequenceCanceller.mock.calls[0]![0] as () => void;
    canceller();
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS + 1);
    expect(onSelectLoopClip).not.toHaveBeenCalled();

    // Control: without the canceller the timer fires the single click.
    hooks.reset();
    const controlTree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: context.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 0, endFrameExclusive: 12 },
      framePitch: 18,
      selectedLoopClipIds: [],
      railSetMoveMemberLoopIds: ['loop-a'],
      onSelectLoopClip,
      onOpenLoopEdit,
      onRailSetDragPointerDown,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const controlTarget = findOne(controlTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    (controlTarget.props.onClick as (event: unknown) => void)({
      timeStamp: 100,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS + 1);
    expect(onSelectLoopClip).toHaveBeenCalledWith('loop-a', 'plain');
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
    expect(target.props['data-rail-first-frame']).toBe(10);
    expect(hasClass(target, 'physics-paint-rail-target')).toBe(true);
    expect(hasClass(target, 'mode-progressive')).toBe(true);
    expect(hasClass(target, 'boundary-start')).toBe(true);
    expect(hasClass(target, 'boundary-end')).toBe(false);
    // A Motion Rail exposes the same full-height cell edges as a Key Rail:
    // the boundary-cell classes ride the shared rail-target base, and the
    // shared rule paints the 1px #f8fafc edge borders.
    expect(hasClass(target, 'boundary-cell-start')).toBe(true);
    expect(hasClass(target, 'boundary-cell-end')).toBe(false);
    expect(segment).toBeTruthy();
    expect(cssRule('.physics-paint-rail-target.boundary-cell-start {')).toContain('border-left: 1px solid #f8fafc');
    expect(cssRule('.physics-paint-rail-target.boundary-cell-end {')).toContain('border-right: 1px solid #f8fafc');
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
    // 43.4 defect 8: the shared full-row focus ring is the target's only
    // pseudo — the same ::after rule serves the Key Rail target too.
    expect(physicsPaintStudioCss).toContain('.physics-paint-rail-target:focus-visible::after');

    (anchor.props.onPointerEnter as () => void)();
    expect(typeof target.props.onfocusin).toBe('function');
    (target.props.onfocusin as () => void)();
    const railCopy = `${String(target.props['aria-label'])} ${textOf(railTree)}`;
    for (const fact of ['Walk Rail', 'Type: Motion', 'Cycle 5f × 5 = 25f', 'Effective 25f', 'Status: Synchronized with Action.']) {
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
    expect(cssRule('.physics-paint-workflow-strip {')).toContain('height: 264px');
    expect(cssRule('.physics-paint-lane {')).toContain('height: 48px');

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
    const editButton = findOne(selectedPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Edit Group — Walk Rail');
    const closeButton = findOne(selectedPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Close Group inspector — Walk Rail');
    expect(findAll(selectedPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Create Group…')).toHaveLength(0);
    expect(findAll(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-toolbar'))).toHaveLength(0);
    expect(findAll(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-summary'))).toHaveLength(0);
    expect(findAll(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-list'))).toHaveLength(0);
    const inspector = findOne(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-inspector'));
    expect(textOf(inspector)).toBe('NameWalk RailSource ActionWalkPlacementF10CycleCycle 5f × 5 = 25fEffectiveEffective 25fGroup TypeMotionStatusSynchronized with Action.');
    expect(textOf(inspector)).not.toContain(rawLoopId);
    (editButton.props.onClick as () => void)();
    expect(onOpenLoopEdit).toHaveBeenCalledTimes(3);
    expect(onOpenLoopEdit).toHaveBeenLastCalledWith(selectedLoopClipId);
    (closeButton.props.onClick as () => void)();
    expect(onCloseLoopClip).toHaveBeenCalledOnce();

    const layerId = 'loop-tracer-layer';
    // 46-01: fxTrackLayouts resolves the ACTIVE track of a registered document;
    // register the launch document with the fixed track so production reads land here.
    const document = createEfxPaintDocument(layerId);
    const track = document.tracks[0];
    registerDocument({
      ...document,
      activeTrackId: TEST_TRACK_ID,
      tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
    });
    const records: PhysicPaintRotoRealKeyRecord[] = sourceKeyIds.map((keyId, appFrame) => ({
      keyId,
      appFrame,
      kind: 'real-key',
      payload: { frameIndex: 0, appFrame, dataUrl: 'data:image/png;base64,YQ==' },
    }));
    const loopClips = [clip];
    physicPaintStore.clearRotoPhysicalRecords(layerId, TEST_TRACK_ID);
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
    const installed = physicPaintStore.replaceRotoPhysicalDocument(layerId, TEST_TRACK_ID, {
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

    physicPaintStore.clearRotoPhysicalRecords(layerId, TEST_TRACK_ID);
    sequenceStore.reset();
    await Promise.resolve();
    vi.useRealTimers();
  });

  // 43.4 defect 10: a direct click is a focus-worthy activation for every rail
  // family — the clicked Motion/Static (Loop Clip) Rail button must hold DOM
  // focus so the shared :focus ring paints immediately, identical to Key Rails.
  it('moves DOM focus to the clicked Motion/Static rail button so the shared focus ring applies', () => {
    const rawLoopId = '0f65c808-defect-10';
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
      capacity: 120,
      interpolationEnabled: false,
    });
    const presentation = projectPhysicsPaintLoopClipPresentation(loopContext.ranges[0], clip, 'Walk');
    const presentations = new Map([[rawLoopId, presentation]]);
    const onSelectLoopClip = vi.fn();
    const onOpenLoopEdit = vi.fn(async () => {});

    vi.useFakeTimers();
    hooks.reset();
    const railTree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: loopContext.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 20 },
      framePitch: 18,
      selectedLoopClipIds: [],
      onSelectLoopClip,
      onOpenLoopEdit,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const target = findOne(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

    const clicked = {
      tabIndex: 0,
      focused: false,
      focus() { this.focused = true; },
      getAttribute: (name: string) => (name === 'data-rail-first-frame' ? '10' : null),
      closest: (selector: string) => (selector === '.physics-paint-lane' ? lane : null),
    };
    const lane = { querySelectorAll: () => [clicked], closest: () => null };

    (target.props.onClick as (event: { currentTarget: unknown; timeStamp: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; stopPropagation(): void; preventDefault(): void }) => void)({
      currentTarget: clicked,
      timeStamp: 100,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });
    expect(clicked.focused).toBe(true);
    expect(clicked.tabIndex).toBe(0);
    // A focused rail target draws the ring through the shared :focus rule.
    expect(cssRule('.physics-paint-rail-target:focus::after,')).toContain('border: 2px solid #f2f5f7');
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
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
    // Static Rails draw the identical full-height cell edges as Key Rails via
    // the shared boundary treatment (band cap + cell edge on one rule set).
    expect(hasClass(target, 'boundary-cell-start')).toBe(true);
    expect(hasClass(target, 'boundary-cell-end')).toBe(true);
    expect(`${String(target.props['aria-label'])} ${textOf(tree)}`).toContain('Type: Static');
    expect(cssRule('.physics-paint-loop-clip-rail-target.mode-static .physics-paint-loop-clip-rail-segment {'))
      .toContain('background: #06b6d4');
    expect(cssRule('.physics-paint-loop-clip-rail-target.mode-static:hover:not(.selected) .physics-paint-loop-clip-rail-segment,'))
      .toContain('background: #67e8f9');
    expect(cssRule('.physics-paint-rail-target.boundary-start .physics-paint-rail-segment::before,'))
      .toContain('background: #f8fafc');
    expect(cssRule('.physics-paint-rail-target.boundary-end .physics-paint-rail-segment::after {'))
      .toContain('background: #f8fafc');
    expect(cssRule('.physics-paint-rail-target.boundary-cell-start {'))
      .toContain('border-left: 1px solid #f8fafc');
    expect(cssRule('.physics-paint-rail-target.boundary-cell-end {'))
      .toContain('border-right: 1px solid #f8fafc');
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
        rotoPhysicalCells: createPhysicalCells(120, [
          { kind: 'real', appFrame: 0, keyId: 'A' },
          { kind: 'generated', appFrame: 1, leftKeyId: 'A', rightKeyId: 'B' },
          { kind: 'generated', appFrame: 8, leftKeyId: 'A', rightKeyId: 'B' },
        ]),
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

  describe('generated Group cell presentation authority', () => {
    it.each([
      ['progressive', 'linked-generated'],
      ['static', 'linked'],
    ] as const)('keeps valid %s source-cycle interpolation blue with its generated dash', (mode, expectedResolutionKind) => {
      const rendered = renderGeneratedPresentationDocument(createGeneratedPresentationDocument(mode));
      const generatedClass = rendered.classesByFrame.get(1) ?? '';

      expect(rendered.semanticKindsByFrame.get(1)).toBe('generated');
      expect(rendered.resolutionKindsByFrame.get(1)).toBe(expectedResolutionKind);
      expect(generatedClass).toContain('roto-fill-generated');
      expect(generatedClass).toContain('roto-linked-source-generated');
      expect(generatedClass).not.toContain('roto-linked-source-key');
      expect(cssRule('.physics-paint-roto-cell.roto-fill-generated {')).toContain('background: #365ed6');
      expect(cssRule('.physics-paint-roto-cell.roto-fill-generated::before {')).toContain("content: ''");
    });

    it('keeps genuine lifecycle deletion and external movement gaps neutral instead of generated blue', () => {
      const deleted = renderGeneratedPresentationDocument(createGeneratedPresentationDocument('static', {
        visibleRanges: [{ start: 0, endExclusive: 1 }, { start: 3, endExclusive: 4 }],
        incomingInterpolationBreakKeyIds: ['B'],
      }));
      const externalGap = renderGeneratedPresentationDocument(createGeneratedPresentationDocument('static', {
        incomingInterpolationBreakKeyIds: ['B'],
      }));

      expect(deleted.semanticKindsByFrame.get(1)).toBe('empty');
      expect(deleted.resolutionKindsByFrame.get(1)).toBe('empty');
      expect(deleted.classesByFrame.get(1)).toContain('roto-fill-empty');
      expect(deleted.classesByFrame.get(1)).not.toContain('roto-fill-generated');

      expect(externalGap.semanticKindsByFrame.get(1)).toBe('empty');
      expect(externalGap.classesByFrame.get(1)).toContain('roto-fill-empty');
      expect(externalGap.classesByFrame.get(1)).not.toContain('roto-fill-generated');
    });

    it('keeps real source keys on the existing cached source-key presentation', () => {
      const rendered = renderGeneratedPresentationDocument(createGeneratedPresentationDocument('static'));
      const sourceClass = rendered.classesByFrame.get(0) ?? '';

      expect(rendered.semanticKindsByFrame.get(0)).toBe('real-key');
      expect(rendered.resolutionKindsByFrame.get(0)).toBe('real');
      expect(sourceClass).toContain('roto-fill-cached');
      expect(sourceClass).toContain('occupied');
      expect(sourceClass).toContain('saved');
      expect(sourceClass).not.toContain('roto-fill-generated');
    });

    it.each(['progressive', 'static'] as const)('preserves %s generated classifications and fill classes after save/reopen parsing', (mode) => {
      const beforeDocument = createGeneratedPresentationDocument(mode);
      const reopenedDocument = parsePhysicPaintRotoPhysicalDocument(JSON.parse(JSON.stringify(beforeDocument)));
      const before = renderGeneratedPresentationDocument(beforeDocument);
      const reopened = renderGeneratedPresentationDocument(reopenedDocument);

      expect(reopened.semanticKindsByFrame).toEqual(before.semanticKindsByFrame);
      expect(reopened.resolutionKindsByFrame).toEqual(before.resolutionKindsByFrame);
      expect(reopened.classesByFrame).toEqual(before.classesByFrame);
      expect(reopened.classesByFrame.get(1)).toContain('roto-fill-generated');
      expect(reopened.classesByFrame.get(1)).toContain('roto-linked-source-generated');
      expect(reopened.classesByFrame.get(1)).not.toContain('roto-linked-source-key');
    });
  });

  describe('Group Rail drag session (usePhysicsPaintGroupRailDrag)', () => {
    interface MockWindow {
      addEventListener: (type: string, listener: (event: unknown) => void) => void;
      removeEventListener: (type: string, listener: (event: unknown) => void) => void;
      setTimeout: (handler: () => void) => number;
      dispatch: (type: string, event: unknown) => void;
      listenerCount: (type: string) => number;
      listenersFor: (type: string) => readonly ((event: unknown) => void)[];
    }

    function createMockWindow(): MockWindow {
      const listeners = new Map<string, Set<(event: unknown) => void>>();
      return {
        addEventListener: (type, listener) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(listener);
        },
        removeEventListener: (type, listener) => {
          listeners.get(type)?.delete(listener);
        },
        // No-op: the post-drop click suppression stays latched until the
        // trailing click consumes it (Pitfall 2 idiom).
        setTimeout: () => 0,
        dispatch: (type, event) => {
          for (const listener of listeners.get(type) ?? []) listener(event);
        },
        listenerCount: (type) => listeners.get(type)?.size ?? 0,
        listenersFor: (type) => [...(listeners.get(type) ?? [])],
      };
    }

    function createMockSourceElement() {
      let capturedPointerId: number | null = null;
      return {
        setPointerCapture: vi.fn((pointerId: number) => { capturedPointerId = pointerId; }),
        hasPointerCapture: vi.fn((pointerId: number) => capturedPointerId === pointerId),
        releasePointerCapture: vi.fn((pointerId: number) => {
          if (capturedPointerId === pointerId) capturedPointerId = null;
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        focus: vi.fn(),
      };
    }

    function createPointerDown(sourceElement: unknown, clientX = 100, clientY = 50, pointerId = 1) {
      return {
        isPrimary: true,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        pointerId,
        clientX,
        clientY,
        currentTarget: sourceElement,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
    }

    function createPointerMove(clientX: number, clientY = 50, pointerId = 1) {
      return { pointerId, clientX, clientY, preventDefault: vi.fn() };
    }

    function createPointerUp(clientX: number, clientY = 50, pointerId = 1) {
      return { pointerId, clientX, clientY, preventDefault: vi.fn() };
    }

    function createGroupDragPublication(
      loopId: string,
      destinationPlacementStart: number,
      preparedEffectiveEnd = destinationPlacementStart + 6,
      movedClipOverrides: Partial<PhysicPaintRotoLoopClip> = {},
    ): RotoGroupDragPublication {
      return {
        proposal: {
          mapping: new Map([['A', destinationPlacementStart]]),
          orderedKeyIds: ['A'],
          assignments: [],
          cells: [],
          generatedCells: [],
          selectedKeyId: 'A',
          selectedAppFrame: destinationPlacementStart,
          changes: [],
          removedKeyId: null,
          removedKeyIds: [],
          drag: null,
          nextRecords: null,
          nextLoopClips: [{
            loopId,
            placementStart: destinationPlacementStart,
            sourceKeyIds: ['A'],
            repeat: 'infinity',
            mode: 'progressive',
            syncState: 'synchronized',
            provenanceState: 'attached',
            phaseOrigin: destinationPlacementStart,
            originalEndExclusive: preparedEffectiveEnd,
            visibleRanges: [{ start: destinationPlacementStart, endExclusive: preparedEffectiveEnd }],
            frameOverrides: [],
            ...movedClipOverrides,
          }],
          nextIncomingInterpolationBreakKeyIds: null,
          semanticDelta: null,
          status: {
            operationKind: 'move-group',
            changed: true,
            affectedKeyIds: ['A'],
            affectedCount: 1,
            code: 'ok',
            text: 'Moved Group.',
          },
        },
        intent: { kind: 'move-group', loopId, destinationPlacementStart },
        proposalVersion: `v:${loopId}:${destinationPlacementStart}`,
        expectedLaunch: { operationId: 'op-1', layerId: 'layer-1' },
        loopId,
        clampedDestinationPlacementStart: destinationPlacementStart,
        vacatedInterval: null,
      };
    }

    function renderDragRail(
      mockWindow: MockWindow,
      prepareRotoGroupDrag: (loopId: string, destinationPlacementStart: number) => RotoGroupDragPreparationResult,
      commitRotoGroupDrag: (publication: RotoGroupDragPublication) => Promise<boolean>,
      onSelectLoopClip: (loopId: string, gesture: 'plain' | 'toggle' | 'range' | 'union') => void,
      onOpenLoopEdit: (loopId: string) => Promise<unknown>,
      options: {
        getClampInput?: (loopId: string) => Omit<PhysicPaintRotoGroupDragClampInput, 'proposedDestinationPlacementStart'> | null;
        onRotoGroupDragRejected?: (reason: string, detail?: string) => void;
      } = {},
    ): unknown {
      const range = explicitGroupRange(10, 16);
      const clip: PhysicPaintRotoLoopClip = {
        loopId: 'group-a', placementStart: 10, sourceKeyIds: ['A'], repeat: 1,
        mode: 'progressive', scriptId: 'action-a', syncState: 'modified', provenanceState: 'attached',
      };
      const presentations = new Map([['group-a', projectPhysicsPaintLoopClipPresentation(range, clip, 'Walk')]]);
      return materializeNamedComponents(PhysicsPaintLoopClipRail({
        ranges: [range],
        presentations,
        visibleFrameWindow: { startFrame: 8, endFrameExclusive: 18 },
        framePitch: 18,
        selectedLoopClipIds: [],
        onSelectLoopClip,
        onOpenLoopEdit,
        prepareRotoGroupDrag,
        commitRotoGroupDrag,
        getClampInput: options.getClampInput,
        onRotoGroupDragRejected: options.onRotoGroupDragRejected,
        windowLike: mockWindow,
      }), new Set(['PhysicsPaintLoopClipRailTarget']));
    }

    it('preserves plain click selection when the pointer releases below the drag threshold', () => {
      vi.useFakeTimers();
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn();
      const commitRotoGroupDrag = vi.fn(async () => true);
      const onSelectLoopClip = vi.fn();
      const onOpenLoopEdit = vi.fn(async () => {});
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

      const sourceElement = createMockSourceElement();
      const pointerDown = createPointerDown(sourceElement, 100, 50);
      (target.props.onPointerDown as (event: unknown) => void)(pointerDown);
      expect(pointerDown.stopPropagation).toHaveBeenCalledOnce();
      mockWindow.dispatch('pointermove', createPointerMove(102, 50));
      mockWindow.dispatch('pointerup', createPointerUp(102, 50));
      expect(prepareRotoGroupDrag).not.toHaveBeenCalled();
      expect(commitRotoGroupDrag).not.toHaveBeenCalled();

      const clickEvent = { timeStamp: 100, metaKey: false, ctrlKey: false, shiftKey: false, stopPropagation: vi.fn(), preventDefault: vi.fn() };
      (target.props.onClick as (event: unknown) => void)(clickEvent);
      vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
      expect(onSelectLoopClip).toHaveBeenCalledOnce();
      expect(onSelectLoopClip).toHaveBeenLastCalledWith('group-a', 'plain');
      expect(onOpenLoopEdit).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('Escape disarms a below-threshold session before any later pointermove can start it', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, vi.fn(), vi.fn(async () => {}));
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
      const sourceElement = createMockSourceElement();

      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(sourceElement, 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(102, 50));
      const escapeEvent = { key: 'Escape', preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
      mockWindow.dispatch('keydown', escapeEvent);
      mockWindow.dispatch('pointermove', createPointerMove(110, 50));

      expect(prepareRotoGroupDrag).not.toHaveBeenCalled();
      expect(commitRotoGroupDrag).not.toHaveBeenCalled();
      expect(escapeEvent.preventDefault).toHaveBeenCalledOnce();
      expect(escapeEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
      expect(sourceElement.setPointerCapture).not.toHaveBeenCalled();
      expect(sourceElement.releasePointerCapture).not.toHaveBeenCalled();
      expect(sourceElement.focus).toHaveBeenCalledOnce();
      for (const type of ['pointermove', 'pointerup', 'pointercancel', 'keydown']) {
        expect(mockWindow.listenerCount(type)).toBe(0);
      }
    });

    it('ignores an obsolete pointercancel closure after a newer pointer session becomes current', async () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, vi.fn(), vi.fn(async () => {}));
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
      const firstSource = createMockSourceElement();

      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(firstSource, 100, 50, 1));
      mockWindow.dispatch('pointermove', createPointerMove(110, 50, 1));
      const stalePointerCancel = mockWindow.listenersFor('pointercancel')[0];
      const sessionRef = [...hooks.refs.values()].find((ref) => (
        (ref.current as { pointerId?: number } | null)?.pointerId === 1
      ));
      expect(stalePointerCancel).toBeDefined();
      expect(sessionRef).toBeDefined();
      if (!stalePointerCancel || !sessionRef) throw new Error('First pointer session must be retained');
      sessionRef.current = null;
      prepareRotoGroupDrag.mockClear();

      const secondSource = createMockSourceElement();
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(secondSource, 200, 50, 2));
      stalePointerCancel({ pointerId: 1 });
      mockWindow.dispatch('pointermove', createPointerMove(210, 50, 2));
      mockWindow.dispatch('pointerup', createPointerUp(210, 50, 2));
      await Promise.resolve();

      expect(firstSource.releasePointerCapture).not.toHaveBeenCalled();
      expect(firstSource.focus).not.toHaveBeenCalled();
      expect(prepareRotoGroupDrag).toHaveBeenCalledOnce();
      expect(commitRotoGroupDrag).toHaveBeenCalledOnce();
      expect(secondSource.releasePointerCapture).toHaveBeenCalledWith(2);
    });

    it('cancels the pending single-click timer when the drag crosses the threshold', () => {
      vi.useFakeTimers();
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      const onSelectLoopClip = vi.fn();
      const onOpenLoopEdit = vi.fn(async () => {});
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

      // A plain click schedules the deferred single-click selection.
      const firstClick = { timeStamp: 100, metaKey: false, ctrlKey: false, shiftKey: false, stopPropagation: vi.fn(), preventDefault: vi.fn() };
      (target.props.onClick as (event: unknown) => void)(firstClick);

      // A drag crosses the threshold before the timer fires.
      const sourceElement = createMockSourceElement();
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(sourceElement, 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(110, 50));
      expect(prepareRotoGroupDrag).toHaveBeenCalledOnce();
      expect(prepareRotoGroupDrag).toHaveBeenLastCalledWith('group-a', 11);

      vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
      expect(onSelectLoopClip).not.toHaveBeenCalled();
      expect(onOpenLoopEdit).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('Escape mid-session cancels with zero commit and restores source focus', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      const onSelectLoopClip = vi.fn();
      const onOpenLoopEdit = vi.fn(async () => {});
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

      const sourceElement = createMockSourceElement();
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(sourceElement, 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(110, 50));
      expect(prepareRotoGroupDrag).toHaveBeenCalledOnce();

      const escapeEvent = { key: 'Escape', preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
      mockWindow.dispatch('keydown', escapeEvent);
      expect(escapeEvent.preventDefault).toHaveBeenCalledOnce();
      expect(escapeEvent.stopImmediatePropagation).toHaveBeenCalledOnce();
      expect(commitRotoGroupDrag).not.toHaveBeenCalled();
      expect(onSelectLoopClip).not.toHaveBeenCalled();
      expect(onOpenLoopEdit).not.toHaveBeenCalled();
      expect(sourceElement.focus).toHaveBeenCalledOnce();

      // Re-render on the same hook indices: the ghost is gone.
      hooks.rewind();
      const tree2 = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
      expect(findAll(tree2, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'))).toHaveLength(0);
    });

    it('suppresses the post-drop click so it cannot re-fire selection or Edit Group', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      const onSelectLoopClip = vi.fn();
      const onOpenLoopEdit = vi.fn(async () => {});
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

      const sourceElement = createMockSourceElement();
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(sourceElement, 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(110, 50));
      mockWindow.dispatch('pointerup', createPointerUp(110, 50));
      expect(commitRotoGroupDrag).toHaveBeenCalledOnce();

      const clickEvent = { timeStamp: 200, metaKey: false, ctrlKey: false, shiftKey: false, stopPropagation: vi.fn(), preventDefault: vi.fn() };
      (target.props.onClick as (event: unknown) => void)(clickEvent);
      expect(onSelectLoopClip).not.toHaveBeenCalled();
      expect(onOpenLoopEdit).not.toHaveBeenCalled();
    });

    it('renders the ghost with aria-hidden and pointer-events none at 55% opacity', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      const onSelectLoopClip = vi.fn();
      const onOpenLoopEdit = vi.fn(async () => {});
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

      const sourceElement = createMockSourceElement();
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(sourceElement, 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(110, 50));

      // Re-render on the same hook indices so the session ghost state survives.
      hooks.rewind();
      const tree2 = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
      const ghost = findOne(tree2, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'));
      expect(ghost.props['aria-hidden']).toBe('true');
      // Rightward +1 frame → destination 11 → offset 18px, constant resolved
      // width 108px (D-13 rigid — no longer shrunk from the anchor's right edge).
      expect(ghost.props.style).toEqual({ left: '18px', width: '108px' });
      const ghostRule = cssRule('.physics-paint-loop-clip-rail-ghost {');
      expect(ghostRule).toContain('pointer-events: none');
      expect(ghostRule).toContain('opacity: 0.55');
      expect(ghostRule).toContain('height: 3px');
    });

    it('uses finite moved visible geometry instead of a deleted-tail lifecycle end for the ghost', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart, 20, {
          repeat: 2,
          visibleRanges: [{ start: destinationPlacementStart, endExclusive: 16 }],
        }),
      }));
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, vi.fn(async () => true), vi.fn(), vi.fn(async () => {}));
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(createMockSourceElement(), 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(100 + 2 * 18, 50));

      hooks.rewind();
      const movedTree = renderDragRail(mockWindow, prepareRotoGroupDrag, vi.fn(async () => true), vi.fn(), vi.fn(async () => {}));
      const ghost = findOne(movedTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'));
      expect(ghost.props.style).toEqual({ left: '36px', width: '72px' });
      expect(hasClass(ghost, 'effective-zero')).toBe(false);
    });

    it('renders finite empty moved visible geometry as an effective-zero ghost', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart, 20, {
          repeat: 2,
          visibleRanges: [],
        }),
      }));
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, vi.fn(async () => true), vi.fn(), vi.fn(async () => {}));
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(createMockSourceElement(), 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(100 + 2 * 18, 50));

      hooks.rewind();
      const movedTree = renderDragRail(mockWindow, prepareRotoGroupDrag, vi.fn(async () => true), vi.fn(), vi.fn(async () => {}));
      const ghost = findOne(movedTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'));
      expect(ghost.props.style).toEqual({ left: '36px', width: '8px' });
      expect(hasClass(ghost, 'effective-zero')).toBe(true);
    });

    it('renders and commits the detached Infinity boundary from the real timeline resolver publication', async () => {
      const records: readonly PhysicPaintRotoRealKeyRecord[] = Object.freeze([
        Object.freeze({
          kind: 'real-key',
          keyId: 'A',
          appFrame: 1,
          payload: Object.freeze({ frameIndex: 0, appFrame: 1, dataUrl: 'data:image/png;base64,YQ==' }),
        }),
        Object.freeze({
          kind: 'real-key',
          keyId: 'C',
          appFrame: 5,
          payload: Object.freeze({ frameIndex: 1, appFrame: 5, dataUrl: 'data:image/png;base64,Yw==' }),
        }),
      ]);
      const clip: PhysicPaintRotoLoopClip = Object.freeze({
        loopId: 'group-detached-infinity',
        placementStart: 12,
        sourceKeyIds: Object.freeze(['A', 'C']),
        repeat: 'infinity',
        mode: 'progressive',
        syncState: 'modified',
        provenanceState: 'detached',
        phaseOrigin: 12,
        originalEndExclusive: 20,
        visibleRanges: Object.freeze([
          Object.freeze({ start: 12, endExclusive: 15 }),
          Object.freeze({ start: 17, endExclusive: 20 }),
        ]),
        frameOverrides: Object.freeze([]),
      });
      const executePhysicalEdit = vi.fn(async (_input: unknown) => true);
      const timeline = useRotoTimelineActions({
        getModel: () => ({ settings: {}, realSourceFrames: [] }) as never,
        getRotoKeyRecords: () => records,
        getRotoInterpolationState: () => ({ enabled: false, mode: 'duplicate' }),
        getCapacity: () => 24,
        getParentEndExclusive: () => 20,
        getRotoLoopClips: () => [clip],
        getLaunchContext: () => ({ operationId: 'op-detached', layerId: 'layer-detached' }) as PhysicPaintLaunchContext,
        getIncomingInterpolationBreakKeyIds: () => [],
        executePhysicalEdit: executePhysicalEdit as never,
      } as RotoTimelineActionsInput);
      const context = derivePhysicPaintRotoLoopRanges({
        identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
        loopClips: [clip],
        capacity: 24,
        interpolationEnabled: false,
      });
      const range = context.ranges[0];
      const presentations = new Map([[
        clip.loopId,
        projectPhysicsPaintLoopClipPresentation(range, clip, 'Detached Infinity'),
      ]]);
      const mockWindow = createMockWindow();
      const render = () => materializeNamedComponents(PhysicsPaintLoopClipRail({
        ranges: [range],
        presentations,
        visibleFrameWindow: { startFrame: 10, endFrameExclusive: 22 },
        framePitch: 18,
        selectedLoopClipIds: [],
        onSelectLoopClip: vi.fn(),
        onOpenLoopEdit: vi.fn(async () => {}),
        prepareRotoGroupDrag: timeline.physicalActions.prepareRotoGroupDrag,
        commitRotoGroupDrag: timeline.physicalActions.commitRotoGroupDrag,
        windowLike: mockWindow,
      }), new Set(['PhysicsPaintLoopClipRailTarget']));

      hooks.reset();
      const tree = render();
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(createMockSourceElement(), 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(100 + 2 * 18, 50));

      hooks.rewind();
      const movedTree = render();
      const ghost = findOne(movedTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'));
      expect(ghost.props.style).toEqual({ left: '36px', width: '180px' });

      mockWindow.dispatch('pointerup', createPointerUp(100 + 2 * 18, 50));
      await Promise.resolve();
      expect(executePhysicalEdit).toHaveBeenCalledOnce();
      const submitted = executePhysicalEdit.mock.calls[0][0] as { proposal: RotoGroupDragPublication['proposal'] };
      const movedClip = submitted.proposal.nextLoopClips?.find((candidate) => candidate.loopId === clip.loopId);
      expect(movedClip).toMatchObject({
        placementStart: 14,
        phaseOrigin: 14,
        repeat: 'infinity',
        originalEndExclusive: 24,
        visibleRanges: [
          { start: 14, endExclusive: 17 },
          { start: 19, endExclusive: 24 },
        ],
      });
    });

    it('shrinks the Infinity ghost rightward to the retained next-Group candidate boundary', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart, 16),
      }));
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, vi.fn(async () => true), vi.fn(), vi.fn(async () => {}));
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(createMockSourceElement(), 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(100 + 2 * 18, 50));

      hooks.rewind();
      const movedTree = renderDragRail(mockWindow, prepareRotoGroupDrag, vi.fn(async () => true), vi.fn(), vi.fn(async () => {}));
      const ghost = findOne(movedTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'));
      expect(ghost.props.style).toEqual({ left: '36px', width: '72px' });
    });

    it('expands the Infinity ghost leftward to the retained parent/capacity candidate boundary', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart, 16),
      }));
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, vi.fn(async () => true), vi.fn(), vi.fn(async () => {}));
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(createMockSourceElement(), 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(100 - 2 * 18, 50));

      hooks.rewind();
      const movedTree = renderDragRail(mockWindow, prepareRotoGroupDrag, vi.fn(async () => true), vi.fn(), vi.fn(async () => {}));
      const ghost = findOne(movedTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'));
      expect(ghost.props.style).toEqual({ left: '-36px', width: '144px' });
    });

    it('renders identical constant-width ghost geometry for leftward and rightward drags (D-13 rigid)', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      const onSelectLoopClip = vi.fn();
      const onOpenLoopEdit = vi.fn(async () => {});
      // range: phaseOrigin 10, effectiveEnd 16, framePitch 18 →
      // resolved width (16-10)*18 = 108px; anchor at left 36px, width 108px.
      const renderGhost = (clientX: number): { left: string; width: string } => {
        hooks.reset();
        const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
        const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
        const sourceElement = createMockSourceElement();
        (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(sourceElement, 100, 50));
        mockWindow.dispatch('pointermove', createPointerMove(clientX, 50));
        hooks.rewind();
        const tree2 = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
        const ghost = findOne(tree2, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'));
        return ghost.props.style as { left: string; width: string };
      };

      // Leftward −2 frames → destination 8 → ghost offset −36px, full width 108px.
      const leftward = renderGhost(100 - 2 * 18);
      expect(leftward).toEqual({ left: '-36px', width: '108px' });
      // Rightward +2 frames → destination 12 → ghost offset +36px, full width 108px.
      const rightward = renderGhost(100 + 2 * 18);
      expect(rightward).toEqual({ left: '36px', width: '108px' });
      // Identical geometry: equal width, positions symmetric about the original rail.
      expect(rightward.width).toBe(leftward.width);
      expect(parseInt(rightward.left)).toBe(-parseInt(leftward.left));
      // Rightward beyond the original extent (destination 18 ≥ effectiveEnd 16):
      // the ghost must keep its full constant width and shift right, never collapse
      // to a 1px sliver (the reported rightward-preview defect).
      const rightwardFar = renderGhost(100 + 8 * 18);
      expect(rightwardFar).toEqual({ left: '144px', width: '108px' });
    });

    it('renders the blocked-edge bar on the right edge when the clamp binds rightward', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      const onSelectLoopClip = vi.fn();
      const onOpenLoopEdit = vi.fn(async () => {});
      // D-08 collision: B@20 blocks every destination whose derived interval
      // [destination, destination+6) contains 20, so a rightward drag to 18
      // clamps to 14 — the first free placement — and binds the right edge.
      const identities: PhysicPaintRotoKeyIdentity[] = [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 20 },
      ];
      const getClampInput = (loopId: string): Omit<PhysicPaintRotoGroupDragClampInput, 'proposedDestinationPlacementStart'> | null => ({
        clip: { loopId, placementStart: 10, sourceKeyIds: ['A'], repeat: 1, mode: 'progressive' },
        draggedInterval: { phaseOrigin: 10, effectiveEnd: 16 },
        identities,
        loopRanges: [explicitGroupRange(10, 16)],
        capacity: 24,
      });
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit, { getClampInput });
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

      const sourceElement = createMockSourceElement();
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(sourceElement, 100, 50));
      // clientX 244 = origin 100 + 8 frames * 18px pitch → proposed destination 18.
      mockWindow.dispatch('pointermove', createPointerMove(244, 50));
      expect(prepareRotoGroupDrag).toHaveBeenLastCalledWith('group-a', 14);

      hooks.rewind();
      const tree2 = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit, { getClampInput });
      const bar = findOne(tree2, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost-blocked-edge'));
      expect(hasClass(bar, 'edge-right')).toBe(true);
      const barRule = cssRule('.physics-paint-loop-clip-rail-ghost-blocked-edge {');
      expect(barRule).toContain('background: #ff6b6b');
      expect(barRule).toContain('width: 2px');
      expect(barRule).toContain('height: 12px');
    });

    it('renders no blocked-edge bar when the ghost is unclamped', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      const onSelectLoopClip = vi.fn();
      const onOpenLoopEdit = vi.fn(async () => {});
      hooks.reset();
      // No getClampInput: the session previews the raw destination with no clamp.
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

      const sourceElement = createMockSourceElement();
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(sourceElement, 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(110, 50));

      hooks.rewind();
      const tree2 = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit);
      expect(findOne(tree2, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'))).toBeDefined();
      expect(findAll(tree2, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost-blocked-edge'))).toHaveLength(0);
    });

    it('Escape removes the ghost and the blocked-edge bar together', () => {
      const mockWindow = createMockWindow();
      const prepareRotoGroupDrag = vi.fn((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => ({
        ok: true,
        publication: createGroupDragPublication(loopId, destinationPlacementStart),
      }));
      const commitRotoGroupDrag = vi.fn(async () => true);
      const onSelectLoopClip = vi.fn();
      const onOpenLoopEdit = vi.fn(async () => {});
      const identities: PhysicPaintRotoKeyIdentity[] = [
        { keyId: 'A', appFrame: 10 },
        { keyId: 'B', appFrame: 20 },
      ];
      const getClampInput = (loopId: string): Omit<PhysicPaintRotoGroupDragClampInput, 'proposedDestinationPlacementStart'> | null => ({
        clip: { loopId, placementStart: 10, sourceKeyIds: ['A'], repeat: 1, mode: 'progressive' },
        draggedInterval: { phaseOrigin: 10, effectiveEnd: 16 },
        identities,
        loopRanges: [explicitGroupRange(10, 16)],
        capacity: 24,
      });
      hooks.reset();
      const tree = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit, { getClampInput });
      const target = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));

      const sourceElement = createMockSourceElement();
      (target.props.onPointerDown as (event: unknown) => void)(createPointerDown(sourceElement, 100, 50));
      mockWindow.dispatch('pointermove', createPointerMove(244, 50));
      expect(prepareRotoGroupDrag).toHaveBeenLastCalledWith('group-a', 14);

      const escapeEvent = { key: 'Escape', preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
      mockWindow.dispatch('keydown', escapeEvent);
      expect(commitRotoGroupDrag).not.toHaveBeenCalled();

      hooks.rewind();
      const tree2 = renderDragRail(mockWindow, prepareRotoGroupDrag, commitRotoGroupDrag, onSelectLoopClip, onOpenLoopEdit, { getClampInput });
      expect(findAll(tree2, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost'))).toHaveLength(0);
      expect(findAll(tree2, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-ghost-blocked-edge'))).toHaveLength(0);
    });
  });
});
