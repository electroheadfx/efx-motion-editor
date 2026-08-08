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
import { derivePhysicPaintRotoLoopRanges } from '../roto/physicsPaintRotoPhysicalResolver';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import { LOOP_CLIP_SINGLE_CLICK_DELAY_MS, PhysicsPaintLoopClipRail } from './PhysicsPaintLoopClipRail';
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
  selectedLoopClipId: string | null,
  onSelectLoopClip: (loopId: string | null) => void,
  onOpenLoopEdit: (loopId: string) => Promise<unknown>,
): unknown {
  hooks.reset();
  return PhysicsPaintWorkflowStrip({
    currentFrame: 0,
    isPlaying: false,
    ready: true,
    onion: { enabled: false, previous: false, next: false, count: 1, opacity: 0.5 },
    rotoLoopResolutionContext: loopContext,
    rotoLoopPresentations: presentations,
    selectedRotoLoopClipId: selectedLoopClipId,
    onSelectRotoLoopClip: onSelectLoopClip,
    onOpenRotoLoopEdit: onOpenLoopEdit,
    onNavigateToSyncedFrame: () => {},
    onGoToFirstFrame: () => {},
    onGoToPreviousFrame: () => {},
    onGoToNextFrame: () => {},
    onGoToLastFrame: () => {},
    onOnionChange: () => {},
  });
}

describe('PhysicsPaintLoopClipRail ownership tracer', () => {
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
      selectedLoopClipId: null,
      onSelectLoopClip,
      onOpenLoopEdit,
    })).toBeNull();

    hooks.reset();
    const railTree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: loopContext.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 20 },
      framePitch: 18,
      selectedLoopClipId,
      onSelectLoopClip,
      onOpenLoopEdit,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    expect(findAll(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail'))).toHaveLength(1);
    const anchor = findOne(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-anchor'));
    const target = findOne(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    const segment = findOne(railTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-segment'));
    expect(anchor.props.style).toEqual({ left: '36px', width: '180px' });
    expect(target.props['aria-pressed']).toBe(true);
    expect(segment).toBeTruthy();
    const railSegmentRule = cssRule('.physics-paint-loop-clip-rail-segment {');
    expect(railSegmentRule).toContain('height: 3px');
    expect(railSegmentRule).toContain('background: #8b5cf6');
    expect(physicsPaintStudioCss).toContain('background: #f59e0b');
    expect(physicsPaintStudioCss).toContain('background: #a78bfa');
    expect(physicsPaintStudioCss).toContain('linear-gradient(to right, #8b5cf6 0 calc(100% - 6px), #f59e0b calc(100% - 6px))');
    expect(physicsPaintStudioCss).toContain('linear-gradient(to right, #f59e0b 0 calc(100% - 6px), #fbbf24 calc(100% - 6px))');
    expect(physicsPaintStudioCss).toContain('linear-gradient(to right, #a78bfa 0 calc(100% - 6px), #fbbf24 calc(100% - 6px))');
    expect(cssRule('.physics-paint-loop-clip-rail-target {')).toContain('height: 12px');
    expect(cssRule('.physics-paint-loop-clip-rail-anchor {')).toContain('min-width: 12px');
    expect(physicsPaintStudioCss).not.toContain('.physics-paint-loop-clip-rail-target::after');

    (anchor.props.onPointerEnter as () => void)();
    expect(typeof target.props.onfocusin).toBe('function');
    (target.props.onfocusin as () => void)();
    const railCopy = `${String(target.props['aria-label'])} ${textOf(railTree)}`;
    for (const fact of ['Walk Loop', 'Cycle 5f × 5 = 25f', 'Effective 25f', 'Status: Linked']) {
      expect(railCopy).toContain(fact);
    }
    expect(railCopy).not.toContain(rawLoopId);
    const railTooltip = findOne(railTree, (vnode) => typeof vnode.type === 'function' && vnode.type.name === 'PhysicsPaintStyledTooltip');
    expect(railTooltip.props.topmost).toBe(true);
    expect(cssRule('.physics-paint-styled-tooltip--topmost {')).toContain('z-index: 69');

    const selectedSingleClick = { detail: 1, stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (target.props.onClick as (event: typeof selectedSingleClick) => void)(selectedSingleClick);
    expect(selectedSingleClick.stopPropagation).toHaveBeenCalledOnce();
    expect(selectedSingleClick.preventDefault).not.toHaveBeenCalled();
    expect(onSelectLoopClip).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith(null);
    expect(onOpenLoopEdit).not.toHaveBeenCalled();

    hooks.reset();
    const unselectedRailTree = materializeNamedComponents(PhysicsPaintLoopClipRail({
      ranges: loopContext.ranges,
      presentations,
      visibleFrameWindow: { startFrame: 8, endFrameExclusive: 20 },
      framePitch: 18,
      selectedLoopClipId: null,
      onSelectLoopClip,
      onOpenLoopEdit,
    }), new Set(['PhysicsPaintLoopClipRailTarget']));
    const unselectedTarget = findOne(unselectedRailTree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    onSelectLoopClip.mockClear();
    (unselectedTarget.props.onClick as (event: typeof selectedSingleClick) => void)({ detail: 1, stopPropagation: vi.fn(), preventDefault: vi.fn() });
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith(rawLoopId);

    onSelectLoopClip.mockClear();
    const firstClick = { detail: 1, stopPropagation: vi.fn(), preventDefault: vi.fn() };
    const secondClick = { detail: 2, stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (target.props.onClick as (event: typeof firstClick) => void)(firstClick);
    (target.props.onClick as (event: typeof secondClick) => void)(secondClick);
    (target.props.onDblClick as (event: typeof secondClick) => void)(secondClick);
    vi.advanceTimersByTime(LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
    expect(firstClick.stopPropagation).toHaveBeenCalledOnce();
    expect(secondClick.preventDefault).toHaveBeenCalledTimes(2);
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith(rawLoopId);
    expect(onOpenLoopEdit).toHaveBeenCalledOnce();
    expect(onOpenLoopEdit).toHaveBeenLastCalledWith(rawLoopId);

    onSelectLoopClip.mockClear();
    const enter = { key: 'Enter', stopPropagation: vi.fn(), preventDefault: vi.fn() };
    (target.props.onKeyDown as (event: typeof enter) => void)(enter);
    expect(enter.stopPropagation).toHaveBeenCalledOnce();
    expect(enter.preventDefault).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenCalledOnce();
    expect(onSelectLoopClip).toHaveBeenLastCalledWith(rawLoopId);
    expect(onOpenLoopEdit).toHaveBeenCalledTimes(2);
    expect(onOpenLoopEdit).toHaveBeenLastCalledWith(rawLoopId);

    const pointerDown = { stopPropagation: vi.fn() };
    (target.props.onPointerDown as (event: typeof pointerDown) => void)(pointerDown);
    expect(pointerDown.stopPropagation).toHaveBeenCalledOnce();
    expect(target.props.onPointerMove).toBeUndefined();
    expect(target.props.onDrag).toBeUndefined();
    expect(target.props.onDragStart).toBeUndefined();
    expect(target.props.setPointerCapture).toBeUndefined();

    const noLoopWorkflow = renderWorkflowStrip(null, new Map(), null, onSelectLoopClip, onOpenLoopEdit);
    expect(findAll(noLoopWorkflow, (vnode) => vnode.type === PhysicsPaintLoopClipRail)).toHaveLength(0);
    expect(findAll(noLoopWorkflow, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'))).toHaveLength(0);

    const workflowTree = renderWorkflowStrip(
      loopContext,
      presentations,
      selectedLoopClipId,
      onSelectLoopClip,
      onOpenLoopEdit,
    );
    const strip = findOne(workflowTree, (vnode) => hasClass(vnode, 'physics-paint-workflow-strip'));
    const physicalRow = findOne(strip, (vnode) => hasClass(vnode, 'physics-paint-lane'));
    const mountedRails = findAll(physicalRow, (vnode) => vnode.type === PhysicsPaintLoopClipRail);
    expect(mountedRails).toHaveLength(1);
    expect(mountedRails[0].props.ranges).toBe(loopContext.ranges);
    expect(mountedRails[0].props.selectedLoopClipId).toBe(selectedLoopClipId);
    expect(findAll(strip, (vnode) => hasClass(vnode, 'physics-paint-lane'))).toHaveLength(1);
    expect(findAll(strip, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-lane'))).toHaveLength(0);
    expect(cssRule('.physics-paint-workflow-strip {')).toContain('height: 161px');
    expect(cssRule('.physics-paint-lane {')).toContain('height: 38px');

    const linkedCells = findAll(workflowTree, (vnode) => String(vnode.props.cellClass ?? '').includes('roto-linked-loop-badge'));
    expect(linkedCells.length).toBeGreaterThan(0);
    expect(linkedCells[0].props.tooltipCopy).toBe('Linked · Repeat 1 · Source frame 1 of 5');
    expect(linkedCells[0].props.ariaLabel).toContain('Linked · Repeat 1 · Source frame 1 of 5');
    expect(String(linkedCells[0].props.ariaLabel)).not.toContain('No Roto content');
    expect(cssRule('.physics-paint-roto-cell.roto-linked-loop-badge {')).toContain('rgba(211, 215, 221, 0.82)');
    const linkedDotRule = cssRule('.physics-paint-roto-cell.roto-linked-loop-badge::after {');
    expect(linkedDotRule).toContain('width: 4px');
    expect(linkedDotRule).toContain('height: 4px');
    expect(linkedDotRule).toContain('rgba(221, 224, 229, 0.9)');

    const onCloseLoopClip = vi.fn();
    const normalPanel = renderScriptsPanel(null, onOpenLoopEdit, onCloseLoopClip);
    expect(findAll(normalPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Play Script')).toHaveLength(1);
    expect(findAll(normalPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-toolbar'))).toHaveLength(1);
    expect(findAll(normalPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-list'))).toHaveLength(1);
    expect(findAll(normalPanel, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-inspector'))).toHaveLength(0);

    const selectedPresentation = presentations.get(selectedLoopClipId) ?? null;
    expect(selectedPresentation?.loopId).toBe(selectedLoopClipId);
    const selectedPanel = renderScriptsPanel(selectedPresentation, onOpenLoopEdit, onCloseLoopClip);
    const editButton = findOne(selectedPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Edit Loop Clip — Walk Loop');
    const closeButton = findOne(selectedPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Close Loop Clip inspector — Walk Loop');
    expect(findAll(selectedPanel, (vnode) => vnode.type === 'button' && vnode.props['aria-label'] === 'Play Script')).toHaveLength(0);
    expect(findAll(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-toolbar'))).toHaveLength(0);
    expect(findAll(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-summary'))).toHaveLength(0);
    expect(findAll(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-scripts-list'))).toHaveLength(0);
    const inspector = findOne(selectedPanel, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-inspector'));
    expect(textOf(inspector)).toBe('NameWalk LoopSource scriptWalkPlacementF10CycleCycle 5f × 5 = 25fEffectiveEffective 25fModeProgressiveStatusLinked');
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
    }));
    expect(JSON.stringify(mainTimelineOutput)).not.toContain(rawLoopId);
    expect(Object.keys(mainTimelineOutput.fxTracks[0])).not.toContain('loopCapsules');
    expect(Object.keys(mainTimelineOutput.fxTracks[0])).not.toContain('loopClips');

    physicPaintStore.clearRotoPhysicalRecords(layerId);
    sequenceStore.reset();
    await Promise.resolve();
    vi.useRealTimers();
  });
});
