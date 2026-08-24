import type { ComponentChildren } from 'preact';
import type { PreactHookRuntime } from '../../../test/preactHookRuntime';
import type { PhysicPaintRotoLoopClip, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import { vi } from 'vitest';
import type { BackgroundTrack, InternalPaintTrack } from '../../../efx-paint/document/efxPaintDocument';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { getDocument, registerDocument, setActiveTrackId } from '../../../stores/efxPaintStore';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';

const runtimeHolder = vi.hoisted(() => ({ current: null as PreactHookRuntime | null }));

vi.mock('preact/hooks', async () => {
  const { PreactHookRuntime } = await import('../../../test/preactHookRuntime');
  const runtime = new PreactHookRuntime();
  runtimeHolder.current = runtime;
  return {
    useCallback: <Value,>(callback: Value, deps: readonly unknown[]) => runtime.useCallback(callback, deps),
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => runtime.useEffect(effect, deps),
    useLayoutEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => runtime.useEffect(effect, deps),
    useMemo: <Value,>(factory: () => Value, deps: readonly unknown[]) => runtime.useMemo(factory, deps),
    useRef: <Value,>(initial: Value) => runtime.useRef(initial),
    useState: <Value,>(initial: Value | (() => Value)) => runtime.useState(initial),
  };
});

vi.mock('preact/compat', async () => {
  const actual = await vi.importActual<typeof import('preact/compat')>('preact/compat');
  return { ...actual, memo: <Value,>(component: Value) => component };
});

vi.mock('@preact/signals', async () => {
  const actual = await vi.importActual<typeof import('@preact/signals')>('@preact/signals');
  return { ...actual, useSignal: <Value,>(initial: Value) => actual.signal(initial) };
});

import { describe, expect, it } from 'vitest';
import { derivePhysicPaintRotoLoopRanges } from '../roto/physicsPaintRotoPhysicalResolver';
import { buildRotoTimelineStructuralIndex, PhysicsPaintWorkflowStrip } from './PhysicsPaintWorkflowStrip';

const CELL_WIDTH_PX = 18;

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: ComponentChildren };
  ref?: unknown;
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

function findAll(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

function findOne(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode {
  const found = findAll(root, predicate);
  expect(found).toHaveLength(1);
  return found[0];
}

function hasClass(vnode: TestVNode, className: string): boolean {
  return String(vnode.props.class ?? vnode.props.className ?? '').split(/\s+/).includes(className);
}

function assignRef(ref: unknown, value: unknown): void {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref && typeof ref === 'object' && 'current' in ref) {
    (ref as { current: unknown }).current = value;
  }
}

function createPhysicalCells(capacity: number, overrides: readonly RotoPhysicalTimelineCell[] = []): readonly RotoPhysicalTimelineCell[] {
  const byFrame = new Map(overrides.map((cell) => [cell.appFrame, cell]));
  return Array.from({ length: capacity }, (_, appFrame) => (
    byFrame.get(appFrame) ?? { kind: 'empty', appFrame }
  ));
}

function createScroller(clientWidth: number) {
  let scrollWidth = 0;
  let scrollLeft = 0;
  const scroller = {
    clientWidth,
    get scrollWidth() {
      return scrollWidth;
    },
    set scrollWidth(value: number) {
      scrollWidth = value;
      scrollLeft = Math.max(0, Math.min(scrollLeft, Math.max(0, scrollWidth - clientWidth)));
    },
    get scrollLeft() {
      return scrollLeft;
    },
    set scrollLeft(value: number) {
      scrollLeft = Math.max(0, Math.min(value, Math.max(0, scrollWidth - clientWidth)));
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    querySelector: vi.fn(() => null),
    contains: vi.fn(() => false),
    focus: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ left: 0, right: clientWidth, top: 0, bottom: 38, width: clientWidth, height: 38 })),
  };
  return scroller;
}

function frameCells(root: unknown): TestVNode[] {
  return findAll(root, (vnode) => typeof vnode.props.frame === 'number' && typeof vnode.props.onCellClick === 'function');
}

function representedFrames(root: unknown): number[] {
  return frameCells(root).map((cell) => cell.props.frame as number);
}

interface WorkflowHarnessOptions {
  readonly capacity?: number;
  readonly currentFrame?: number;
  readonly visibleFrameCount?: number;
  readonly physicalCells?: readonly RotoPhysicalTimelineCell[];
  readonly realKeyRecords?: readonly PhysicPaintRotoRealKeyRecord[];
  readonly cachedRotoFrames?: readonly { frameIndex: number; appFrame: number; dataUrl: string; source: string }[];
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  readonly loopResolutionContext?: ReturnType<typeof derivePhysicPaintRotoLoopRanges> | null;
  // 47-01: multi-track row slice — the document-derived row bundle.
  readonly tracks?: readonly InternalPaintTrack[];
  readonly activeTrackId?: string;
  readonly layerId?: string;
  readonly background?: BackgroundTrack;
  readonly onSelectTrack?: (trackId: string) => void;
}

function createWorkflowHarness(options: WorkflowHarnessOptions = {}) {
  const capacity = options.capacity ?? 240;
  const visibleFrameCount = options.visibleFrameCount ?? 47;
  const runtime = runtimeHolder.current;
  if (!runtime) throw new Error('Expected the Preact hook runtime mock.');
  runtime.reset();
  const scroller = createScroller(visibleFrameCount * CELL_WIDTH_PX);
  const content = {};
  let currentFrame = options.currentFrame ?? 154;
  let tree: unknown = null;

  const onNavigateToSyncedFrame = vi.fn((frame: number) => {
    currentFrame = frame;
  });
  const onGoToFirstFrame = vi.fn();
  const onGoToPreviousFrame = vi.fn();
  const onGoToNextFrame = vi.fn();
  const onGoToLastFrame = vi.fn();
  const onOnionChange = vi.fn();
  const onSelectRotoSpacingProxy = vi.fn();
  const onClearRotoSpacingSelection = vi.fn();
  const onClearRotoKeySelection = vi.fn();
  const onSelectRotoLoopClip = vi.fn();

  function render(): unknown {
    const runtime = runtimeHolder.current;
    if (!runtime) throw new Error('Expected the Preact hook runtime mock.');
    runtime.beginRender();
    tree = PhysicsPaintWorkflowStrip({
      currentFrame,
      isPlaying: false,
      ready: true,
      onion: { enabled: false, previous: false, next: false, count: 1, opacity: 0.5 },
      rotoPhysicalCells: options.physicalCells ?? createPhysicalCells(capacity),
      cachedRotoFrames: options.cachedRotoFrames,
      rotoKeyRecords: options.realKeyRecords,
      rotoLoopClips: options.loopClips,
      rotoLoopResolutionContext: options.loopResolutionContext,
      onSelectRotoSpacingProxy,
      onClearRotoSpacingSelection,
      onClearRotoKeySelection,
      onSelectRotoLoopClip,
      onNavigateToSyncedFrame,
      onGoToFirstFrame,
      onGoToPreviousFrame,
      onGoToNextFrame,
      onGoToLastFrame,
      onOnionChange,
      // 47-01: multi-track row slice.
      tracks: options.tracks,
      activeTrackId: options.activeTrackId ?? '',
      layerId: options.layerId ?? '',
      background: options.background,
      onSelectTrack: options.onSelectTrack,
    });

    const scrollerNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-timeline-scroll'));
    const contentNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-lane'));
    assignRef(scrollerNode.ref ?? scrollerNode.props.ref, scroller);
    assignRef(contentNode.ref ?? contentNode.props.ref, content);

    const ruler = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-ruler'));
    const width = Number.parseFloat(String((ruler.props.style as { width?: string } | undefined)?.width ?? '0'));
    scroller.scrollWidth = width;
    return tree;
  }

  function fireScroll(): void {
    const scrollerNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-timeline-scroll'));
    (scrollerNode.props.onScroll as () => void)();
    render();
  }

  function scrollToFrame(frame: number): void {
    scroller.scrollLeft = frame * CELL_WIDTH_PX;
    fireScroll();
  }

  function clickFrame(frame: number): void {
    const cell = findOne(tree, (vnode) => vnode.props.frame === frame && typeof vnode.props.onCellClick === 'function');
    (cell.props.onCellClick as (frame: number, vm: unknown, event: unknown) => void)(
      frame,
      cell.props.vm,
      { metaKey: false, ctrlKey: false, shiftKey: false },
    );
    render();
  }

  function dragScrollbarToRatio(ratio: number): void {
    fireScroll();
    const track = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-timeline-scrollbar'));
    const thumb = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-timeline-scrollbar-thumb'));
    const thumbWidth = Number.parseFloat(String((thumb.props.style as { width?: string }).width));
    const trackTarget = {
      getBoundingClientRect: () => ({ left: 0, width: scroller.clientWidth }),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const desiredThumbLeft = ratio * (scroller.clientWidth - thumbWidth);
    (track.props.onPointerDown as (event: unknown) => void)({
      currentTarget: trackTarget,
      clientX: desiredThumbLeft + thumbWidth / 2,
      pointerId: 1,
    });
    render();
  }

  function trackRows(): TestVNode[] {
    return findAll(tree, (vnode) => typeof vnode.props['data-track-id'] === 'string');
  }

  function rowCells(trackId: string): TestVNode[] {
    const row = trackRows().find((candidate) => candidate.props['data-track-id'] === trackId);
    expect(row).toBeDefined();
    return findAll(row, (vnode) => typeof vnode.props['data-roto-app-frame'] === 'string');
  }

  function clickRowHeader(trackId: string): void {
    const row = trackRows().find((candidate) => candidate.props['data-track-id'] === trackId);
    expect(row).toBeDefined();
    const header = findAll(row, (vnode) => hasClass(vnode, 'physics-paint-track-row-header'))[0];
    expect(header).toBeDefined();
    (header.props.onClick as () => void)();
    render();
  }

  return {
    capacity,
    scroller,
    render,
    scrollToFrame,
    clickFrame,
    dragScrollbarToRatio,
    representedFrames: () => representedFrames(tree),
    currentFrame: () => currentFrame,
    trackRows,
    rowCells,
    clickRowHeader,
    spies: {
      onNavigateToSyncedFrame,
      onGoToFirstFrame,
      onGoToPreviousFrame,
      onGoToNextFrame,
      onGoToLastFrame,
      onOnionChange,
      onSelectRotoSpacingProxy,
      onClearRotoSpacingSelection,
      onClearRotoKeySelection,
      onSelectRotoLoopClip,
    },
  };
}

function expectCompletePhysicalExtent(harness: ReturnType<typeof createWorkflowHarness>): void {
  const frames = harness.representedFrames();
  expect(frames).toHaveLength(harness.capacity);
  expect(frames[0]).toBe(0);
  expect(frames[frames.length - 1]).toBe(harness.capacity - 1);
  expect(harness.scroller.scrollWidth).toBe(harness.capacity * CELL_WIDTH_PX);
}

describe('PhysicsPaintWorkflowStrip horizontal viewport authority', () => {
  it.each([
    ['empty', []],
    ['sparse', [{ kind: 'empty', appFrame: 0 }, undefined]],
    ['duplicate', [{ kind: 'empty', appFrame: 0 }, { kind: 'empty', appFrame: 0 }]],
    ['reordered', [{ kind: 'empty', appFrame: 1 }, { kind: 'empty', appFrame: 0 }]],
    ['non-zero-based', [{ kind: 'empty', appFrame: 4 }]],
    ['over-maximum', createPhysicalCells(601)],
  ] as const)('fails closed for a malformed %s physical projection', (_label, cells) => {
    const harness = createWorkflowHarness({
      physicalCells: cells as unknown as readonly RotoPhysicalTimelineCell[],
    });

    expect(() => harness.render()).toThrow(/Invalid Roto physical projection/);
  });

  it.each([120, 600])('indexes %i physical cells with exactly one lifecycle classification per cell', (capacity) => {
    const classifyTarget = vi.fn(() => ({ kind: 'empty', appFrame: 0 } as const));
    const cells = createPhysicalCells(capacity);
    const cachedFrames = Array.from({ length: capacity }, (_, appFrame) => ({
      frameIndex: appFrame,
      appFrame,
      dataUrl: 'data:image/png;base64,',
      source: 'real-key' as const,
    }));

    const index = buildRotoTimelineStructuralIndex(cells, cachedFrames, {
      realKeyRecords: [],
      loopClips: [],
    }, classifyTarget);

    expect(classifyTarget).toHaveBeenCalledTimes(capacity);
    expect(index.frameCells).toHaveLength(capacity);
    expect(index.cachedFrameByAppFrame.size).toBe(capacity);
    expect(index.lifecycleTargetByAppFrame.size).toBe(capacity);
  });

  it('uses the complete physical capacity instead of a cursor-relative 120-cell page', () => {
    const harness = createWorkflowHarness({ capacity: 240, currentFrame: 154 });
    harness.render();

    expectCompletePhysicalExtent(harness);
  });

  it('renders and navigates the complete 600-frame extent without coupling selection to the viewport', () => {
    const capacity = 600;
    const visibleFrameCount = 47;
    const selectedFrame = 540;
    const harness = createWorkflowHarness({ capacity, currentFrame: selectedFrame, visibleFrameCount });
    harness.render();

    expectCompletePhysicalExtent(harness);
    expect(harness.scroller.scrollWidth).toBe(10_800);

    harness.dragScrollbarToRatio(1);
    const finalScrollLeft = (capacity - visibleFrameCount) * CELL_WIDTH_PX;
    expect(harness.scroller.scrollLeft).toBe(finalScrollLeft);
    expect(harness.currentFrame()).toBe(selectedFrame);
    expect(harness.spies.onNavigateToSyncedFrame).not.toHaveBeenCalled();

    const finalFullyVisibleFrame = capacity - 1;
    const beforeFrames = harness.representedFrames();
    harness.clickFrame(finalFullyVisibleFrame);

    expect(harness.currentFrame()).toBe(finalFullyVisibleFrame);
    expect(harness.scroller.scrollLeft).toBe(finalScrollLeft);
    expect(harness.representedFrames()).toEqual(beforeFrames);
  });

  it('lets the scrollbar inspect earlier ranges without changing selection or dispatching navigation intents', () => {
    const harness = createWorkflowHarness({ capacity: 240, currentFrame: 154, visibleFrameCount: 47 });
    harness.render();

    harness.scrollToFrame(47);

    expectCompletePhysicalExtent(harness);
    expect(harness.scroller.scrollLeft).toBe(47 * CELL_WIDTH_PX);
    expect(harness.currentFrame()).toBe(154);
    expect(harness.spies.onNavigateToSyncedFrame).not.toHaveBeenCalled();
    expect(harness.spies.onGoToFirstFrame).not.toHaveBeenCalled();
    expect(harness.spies.onGoToPreviousFrame).not.toHaveBeenCalled();
    expect(harness.spies.onGoToNextFrame).not.toHaveBeenCalled();
    expect(harness.spies.onGoToLastFrame).not.toHaveBeenCalled();
    expect(harness.spies.onOnionChange).not.toHaveBeenCalled();
  });

  it('selects the leftmost visible frame without changing scrollLeft or the represented frame extent', () => {
    const harness = createWorkflowHarness({ capacity: 240, currentFrame: 154, visibleFrameCount: 47 });
    harness.render();
    harness.scrollToFrame(94);
    const beforeFrames = harness.representedFrames();
    const beforeScrollLeft = harness.scroller.scrollLeft;

    harness.clickFrame(94);

    expect(harness.currentFrame()).toBe(94);
    expect(harness.spies.onNavigateToSyncedFrame).toHaveBeenLastCalledWith(94);
    expect(harness.scroller.scrollLeft).toBe(beforeScrollLeft);
    expect(harness.representedFrames()).toEqual(beforeFrames);
  });

  it('selects the final fully visible frame without changing scrollLeft or the represented frame extent', () => {
    const visibleFrameCount = 47;
    const visibleStart = 94;
    const rightEdgeFrame = visibleStart + visibleFrameCount - 1;
    const harness = createWorkflowHarness({ capacity: 240, currentFrame: 154, visibleFrameCount });
    harness.render();
    harness.scrollToFrame(visibleStart);
    const beforeFrames = harness.representedFrames();
    const beforeScrollLeft = harness.scroller.scrollLeft;

    harness.clickFrame(rightEdgeFrame);

    expect(harness.currentFrame()).toBe(rightEdgeFrame);
    expect(harness.spies.onNavigateToSyncedFrame).toHaveBeenLastCalledWith(rightEdgeFrame);
    expect(harness.scroller.scrollLeft).toBe(beforeScrollLeft);
    expect(harness.representedFrames()).toEqual(beforeFrames);
  });

  it('maps the custom scrollbar across frame zero, an intermediate range, and the final legal boundary', () => {
    const visibleFrameCount = 47;
    const capacity = 240;
    const harness = createWorkflowHarness({ capacity, currentFrame: 154, visibleFrameCount });
    harness.render();

    harness.dragScrollbarToRatio(0);
    expect(harness.scroller.scrollLeft).toBe(0);

    harness.dragScrollbarToRatio(0.5);
    expect(harness.scroller.scrollLeft / CELL_WIDTH_PX).toBeCloseTo((capacity - visibleFrameCount) / 2);

    harness.dragScrollbarToRatio(1);
    expect(harness.scroller.scrollLeft).toBe((capacity - visibleFrameCount) * CELL_WIDTH_PX);
    expect(harness.currentFrame()).toBe(154);
    expect(harness.spies.onNavigateToSyncedFrame).not.toHaveBeenCalled();
  });

  it.each([31, 47])('keeps edge selection viewport-independent at a %i-cell responsive width', (visibleFrameCount) => {
    const visibleStart = 94;
    const harness = createWorkflowHarness({ capacity: 240, currentFrame: 154, visibleFrameCount });
    harness.render();
    harness.scrollToFrame(visibleStart);
    expectCompletePhysicalExtent(harness);

    const beforeLeft = harness.scroller.scrollLeft;
    const beforeFrames = harness.representedFrames();
    harness.clickFrame(visibleStart);
    expect(harness.scroller.scrollLeft).toBe(beforeLeft);
    expect(harness.representedFrames()).toEqual(beforeFrames);

    harness.scrollToFrame(visibleStart);
    const rightEdgeFrame = visibleStart + visibleFrameCount - 1;
    const beforeRight = harness.scroller.scrollLeft;
    const beforeRightFrames = harness.representedFrames();
    harness.clickFrame(rightEdgeFrame);
    expect(harness.scroller.scrollLeft).toBe(beforeRight);
    expect(harness.representedFrames()).toEqual(beforeRightFrames);
  });

  describe('timeline content controls', () => {
    const records: readonly PhysicPaintRotoRealKeyRecord[] = [
      { keyId: 'A', appFrame: 94, kind: 'real-key', payload: { frameIndex: 0, appFrame: 94, dataUrl: 'data:image/png;base64,YQ==' } },
      { keyId: 'B', appFrame: 97, kind: 'real-key', payload: { frameIndex: 1, appFrame: 97, dataUrl: 'data:image/png;base64,Yg==' } },
      { keyId: 'M1', appFrame: 100, kind: 'real-key', payload: { frameIndex: 2, appFrame: 100, dataUrl: 'data:image/png;base64,bTE=' } },
      { keyId: 'M2', appFrame: 101, kind: 'real-key', payload: { frameIndex: 3, appFrame: 101, dataUrl: 'data:image/png;base64,bTI=' } },
      { keyId: 'S1', appFrame: 110, kind: 'real-key', payload: { frameIndex: 4, appFrame: 110, dataUrl: 'data:image/png;base64,czE=' } },
      { keyId: 'S2', appFrame: 111, kind: 'real-key', payload: { frameIndex: 5, appFrame: 111, dataUrl: 'data:image/png;base64,czI=' } },
    ];
    const loopClips: readonly PhysicPaintRotoLoopClip[] = [
      { loopId: 'motion', placementStart: 100, sourceKeyIds: ['M1', 'M2'], repeat: 2, mode: 'progressive' },
      { loopId: 'static', placementStart: 110, sourceKeyIds: ['S1', 'S2'], repeat: 2, mode: 'static' },
    ];
    const loopResolutionContext = derivePhysicPaintRotoLoopRanges({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      loopClips,
      capacity: 240,
      interpolationEnabled: false,
    });
    const physicalCells = createPhysicalCells(240, [
      { kind: 'real', appFrame: 94, keyId: 'A' },
      { kind: 'generated', appFrame: 95, leftKeyId: 'A', rightKeyId: 'B' },
      { kind: 'generated', appFrame: 96, leftKeyId: 'A', rightKeyId: 'B' },
      { kind: 'real', appFrame: 97, keyId: 'B' },
      { kind: 'real', appFrame: 100, keyId: 'M1' },
      { kind: 'real', appFrame: 101, keyId: 'M2' },
      { kind: 'real', appFrame: 110, keyId: 'S1' },
      { kind: 'real', appFrame: 111, keyId: 'S2' },
    ]);

    it.each([
      ['ordinary real key', 94],
      ['generated interpolation cell', 95],
      ['Motion Group repeated cell', 102],
      ['intentional gap / Delete Frame cell', 105],
      ['Static Group repeated cell', 112],
    ] as const)('keeps the viewport fixed when clicking a visible %s', (_label, targetFrame) => {
      const harness = createWorkflowHarness({
        capacity: 240,
        currentFrame: 154,
        visibleFrameCount: 47,
        physicalCells,
        realKeyRecords: records,
        loopClips,
        loopResolutionContext,
      });
      harness.render();
      harness.scrollToFrame(94);
      const beforeFrames = harness.representedFrames();
      const beforeScrollLeft = harness.scroller.scrollLeft;

      harness.clickFrame(targetFrame);

      expect(harness.currentFrame()).toBe(targetFrame);
      expect(harness.scroller.scrollLeft).toBe(beforeScrollLeft);
      expect(harness.representedFrames()).toEqual(beforeFrames);
      expect(harness.spies.onGoToFirstFrame).not.toHaveBeenCalled();
      expect(harness.spies.onGoToPreviousFrame).not.toHaveBeenCalled();
      expect(harness.spies.onGoToNextFrame).not.toHaveBeenCalled();
      expect(harness.spies.onGoToLastFrame).not.toHaveBeenCalled();
    });
  });

  describe('47-01 multi-track row slice', () => {
    function makeMultiTrackDocument(layerId: string, secondId: string) {
      const document = createEfxPaintDocument(layerId);
      const trackA = document.tracks[0];
      const trackB: InternalPaintTrack = { ...trackA, id: secondId, name: 'Paint 2', order: 1 };
      registerDocument({ ...document, tracks: [trackA, trackB] });
      return { document, trackA, trackB };
    }

    it('renders every Paint track as a row plus exactly one Background row (TML-01)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      const harness = createWorkflowHarness({
        tracks: [trackA, trackB],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
      });
      harness.render();

      const rows = harness.trackRows();
      expect(rows).toHaveLength(3);
      const ids = rows.map((row) => row.props['data-track-id']);
      expect(ids).toContain(trackA.id);
      expect(ids).toContain(trackB.id);
      expect(ids).toContain(document.background.id);
      // Every row renders the shared frameCells extent (presentational cells).
      for (const row of rows) {
        const cells = findAll(row, (vnode) => typeof vnode.props['data-roto-app-frame'] === 'string');
        expect(cells.length).toBeGreaterThan(0);
      }
    });

    it('reads each row through its own trackId — no cross-row frame leak (TML-05/Pitfall 8)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      // Track B owns a real key at frame 8 in the runtime store.
      const bRecords: readonly PhysicPaintRotoRealKeyRecord[] = [
        { keyId: 'b-key', appFrame: 8, kind: 'real-key', payload: { frameIndex: 0, appFrame: 8, dataUrl: 'data:image/png;base64,Yg==' } },
      ];
      const seeded = physicPaintStore.replaceRotoPhysicalDocument(layerId, trackB.id, {
        capacity: 240,
        realKeyRecords: bRecords,
        interpolation: { enabled: false, mode: 'duplicate' },
        scriptMotion: { deformation: 0, position: 0 },
        background: null,
        selectedKeyId: null,
        cursorAppFrame: 0,
        revision: buildPhysicPaintRotoPhysicalRevision(bRecords, { enabled: false, mode: 'duplicate' }, []),
      });
      expect(seeded.ok).toBe(true);
      // Track A (the active row) owns a real frame at frame 5 in the props projection.
      const harness = createWorkflowHarness({
        tracks: [trackA, trackB],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
        physicalCells: createPhysicalCells(240, [
          { kind: 'real', appFrame: 5, keyId: 'a-key' },
        ]),
        cachedRotoFrames: [{ frameIndex: 0, appFrame: 5, dataUrl: 'data:image/png;base64,YQ==', source: 'real-key' }],
      });
      harness.render();

      const aCells = harness.rowCells(trackA.id);
      expect(String(aCells[5].props['data-roto-app-frame'])).toBe('5');
      expect(String(aCells[5].props.class)).toContain('roto-fill-cached');
      expect(String(aCells[8].props['data-roto-app-frame'])).toBe('8');
      expect(String(aCells[8].props.class)).toContain('roto-fill-empty');

      const bCells = harness.rowCells(trackB.id);
      expect(String(bCells[8].props['data-roto-app-frame'])).toBe('8');
      expect(String(bCells[8].props.class)).toContain('roto-fill-cached');
      expect(String(bCells[5].props['data-roto-app-frame'])).toBe('5');
      expect(String(bCells[5].props.class)).toContain('roto-fill-empty');
    });

    it('row-header click fires onSelectTrack and the active track switches (TML-03)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      const onSelectTrack = vi.fn((trackId: string) => {
        setActiveTrackId(layerId, trackId);
      });
      const harness = createWorkflowHarness({
        tracks: [trackA, trackB],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
        onSelectTrack,
      });
      harness.render();

      harness.clickRowHeader(trackB.id);

      expect(onSelectTrack).toHaveBeenCalledWith(trackB.id);
      expect(getDocument(layerId)?.activeTrackId).toBe(trackB.id);
    });
  });
});
