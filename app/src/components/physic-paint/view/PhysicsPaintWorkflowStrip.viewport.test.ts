import type { ComponentChildren } from 'preact';
import type { PreactHookRuntime } from '../../../test/preactHookRuntime';
import type { PhysicPaintRotoLoopClip, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import type { BackgroundTrack, DocumentSoundClip, InternalPaintTrack } from '../../../efx-paint/document/efxPaintDocument';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { getDocument, registerDocument, setActiveTrackId } from '../../../stores/efxPaintStore';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { audioPeaksCache } from '../../../lib/audioPeaksCache';
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

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { signal } from '@preact/signals';
import { derivePhysicPaintRotoLoopRanges } from '../roto/physicsPaintRotoPhysicalResolver';
import { buildRotoTimelineStructuralIndex, PhysicsPaintWorkflowStrip } from './PhysicsPaintWorkflowStrip';
import { PhysicsPaintTrackRow, PhysicsPaintTrackRowHeader } from './PhysicsPaintTrackRow';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

const CELL_WIDTH_PX = 18;
/** 261008-ig1 Task 2: the strip source for the narrow-read contract pin. */
const stripSource = readFileSync(fileURLToPath(new URL('./PhysicsPaintWorkflowStrip.tsx', import.meta.url)), 'utf8');

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

/**
 * 261008-ig1 Task 2: expand the strip's per-clip child component vnodes by
 * calling their (hook-free) component functions directly — same idiom as
 * resolveRow. `walk` never expands function components, so without this the
 * stain/edge vnodes stay opaque.
 */
function expandNamedComponent(root: unknown, name: string): TestVNode[] {
  return findAll(root, (vnode) => typeof vnode.type === 'function' && (vnode.type as { name?: string }).name === name)
    .map((vnode) => (vnode.type as (props: TestVNode['props']) => TestVNode | null)(vnode.props))
    .filter((vnode): vnode is TestVNode => vnode !== null && vnode !== undefined);
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
  /** 260922-qad: the launch startFrame at Studio open (strip prop timelineOpenFrame). */
  readonly openFrame?: number | null;
  readonly physicalCells?: readonly RotoPhysicalTimelineCell[];
  readonly realKeyRecords?: readonly PhysicPaintRotoRealKeyRecord[];
  readonly cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  readonly loopResolutionContext?: ReturnType<typeof derivePhysicPaintRotoLoopRanges> | null;
  // 47-01: multi-track row slice — the document-derived row bundle.
  readonly tracks?: readonly InternalPaintTrack[];
  readonly activeTrackId?: string;
  readonly layerId?: string;
  readonly background?: BackgroundTrack;
  readonly onSelectTrack?: (trackId: string) => void;
  /** 261008-ig1 Task 2: the placed document sound clips (array order canonical). */
  readonly documentAudios?: readonly DocumentSoundClip[];
  /** Initial selected clip id — the Studio-owned selection signal the harness owns. */
  readonly selectedSoundId?: string | null;
  /** Initial reveal request consumed by the strip's nonce-keyed effect. */
  readonly revealRequest?: { frame: number; nonce: number } | null;
}

function createWorkflowHarness(options: WorkflowHarnessOptions = {}) {
  // Mutable locals: render reads them fresh, so tests can grow the content
  // extent (setCapacity) or move the launch frame (setOpenFrame) between
  // renders — the 260922-qad late-content and one-shot legs rely on this.
  let capacity = options.capacity ?? 240;
  let openFrame: number | null | undefined = options.openFrame;
  const visibleFrameCount = options.visibleFrameCount ?? 47;
  const runtime = runtimeHolder.current;
  if (!runtime) throw new Error('Expected the Preact hook runtime mock.');
  runtime.reset();
  const scroller = createScroller(visibleFrameCount * CELL_WIDTH_PX);
  const content = {};
  let currentFrame = options.currentFrame ?? 154;
  let tree: unknown = null;
  // 261008-ig1 Task 2: the Studio-owned selection signal + reveal request the
  // strip consumes (the harness plays the Studio).
  const selectedSoundId = signal<string | null>(options.selectedSoundId ?? null);
  let revealRequest: { frame: number; nonce: number } | null = options.revealRequest ?? null;

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
  const onOpenDocumentSound = vi.fn();
  const onDocumentSoundDblClick = vi.fn();
  const onDocumentSoundSettle = vi.fn(() => true);

  function render(): unknown {
    const runtime = runtimeHolder.current;
    if (!runtime) throw new Error('Expected the Preact hook runtime mock.');
    runtime.beginRender();
    tree = PhysicsPaintWorkflowStrip({
      currentFrame,
      timelineOpenFrame: openFrame,
      isPlaying: false,
      ready: true,
      onion: { enabled: false, previous: false, next: false, count: 1, opacity: 0.5 },
      rotoPhysicalCells: options.physicalCells ?? createPhysicalCells(capacity),
      cachedRotoFrames: options.cachedRotoFrames as PhysicPaintRotoCacheFrame[] | undefined,
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
      // 261008-ig1 Task 2: the multi-clip sound band.
      documentAudios: options.documentAudios,
      selectedSoundId,
      revealRequest,
      onOpenDocumentSound,
      onDocumentSoundDblClick,
      onDocumentSoundSettle,
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

  // The strip renders rows via the <PhysicsPaintTrackRow /> component and
  // header cells via <PhysicsPaintTrackRowHeader />. This harness executes
  // the strip as a plain function (never a real Preact render), so component
  // vnodes are opaque — their rendered DOM never appears in the tree. Both
  // components are hook-free, so we expand them here by calling the component
  // function directly with its props.
  function resolveRow(vnode: TestVNode): TestVNode {
    if (vnode.type === PhysicsPaintTrackRow || vnode.type === PhysicsPaintTrackRowHeader) {
      return (vnode.type as (props: TestVNode['props']) => TestVNode)(vnode.props);
    }
    return vnode;
  }

  function trackRows(): TestVNode[] {
    return findAll(tree, (vnode) => (
      typeof vnode.props['data-track-id'] === 'string'
      || vnode.type === PhysicsPaintTrackRow
      || vnode.type === PhysicsPaintTrackRowHeader
    ))
      .map(resolveRow)
      .filter((vnode) => (
        typeof vnode.props['data-track-id'] === 'string'
        && (hasClass(vnode, 'physics-paint-track-row') || hasClass(vnode, 'physics-paint-lane'))
      ));
  }

  function rowHeaders(): TestVNode[] {
    return findAll(tree, (vnode) => (
      typeof vnode.props['data-track-id'] === 'string'
      || vnode.type === PhysicsPaintTrackRow
      || vnode.type === PhysicsPaintTrackRowHeader
    ))
      .map(resolveRow)
      .filter((vnode) => (
        typeof vnode.props['data-track-id'] === 'string'
        && hasClass(vnode, 'physics-paint-track-row-header')
      ));
  }

  function rowCells(trackId: string): TestVNode[] {
    const row = trackRows().find((candidate) => candidate.props['data-track-id'] === trackId);
    expect(row).toBeDefined();
    return findAll(row, (vnode) => {
      // Active lane: cells are opaque RotoTimelineCellButton vnodes carrying
      // `frame` (number) + `cellClass` (roto-fill-*).
      const frame = vnode.props.frame;
      const cellClass = vnode.props.cellClass;
      if (typeof frame === 'number' && typeof cellClass === 'string' && cellClass.includes('physics-paint-roto-cell')) {
        return true;
      }
      // Presentational rows: rendered spans carry data-roto-app-frame + class.
      const appFrame = vnode.props['data-roto-app-frame'];
      return (typeof appFrame === 'number' || typeof appFrame === 'string') && hasClass(vnode, 'physics-paint-roto-cell');
    });
  }

  function clickRowHeader(trackId: string): void {
    const header = rowHeaders().find((candidate) => candidate.props['data-track-id'] === trackId);
    expect(header).toBeDefined();
    (header!.props.onClick as () => void)();
    render();
  }

  return {
    get capacity() {
      return capacity;
    },
    setCapacity(next: number) {
      capacity = next;
    },
    setOpenFrame(next: number | null | undefined) {
      openFrame = next;
    },
    /** Run queued effects AFTER render() has assigned the scroller ref. */
    flushEffects: () => runtimeHolder.current?.flushEffects(),
    scroller,
    render,
    scrollToFrame,
    clickFrame,
    dragScrollbarToRatio,
    representedFrames: () => representedFrames(tree),
    currentFrame: () => currentFrame,
    trackRows,
    rowHeaders,
    rowCells,
    clickRowHeader,
    headerColumn: () => findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-header-column')),
    headerRows: () => findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-header-rows')),
    rowsRegion: () => findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-rows-region')),
    stripSection: () => findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-workflow-strip')),
    rowsRegionRows: () => {
      const region = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-rows-region'));
      return findAll(region, (vnode) => (
        typeof vnode.props['data-track-id'] === 'string'
        || vnode.type === PhysicsPaintTrackRow
        || vnode.type === PhysicsPaintTrackRowHeader
      ))
        .map(resolveRow)
        .filter((vnode) => (
          typeof vnode.props['data-track-id'] === 'string'
          && hasClass(vnode, 'physics-paint-track-row')
        ));
    },
    headerRowsHeaders: () => {
      const rows = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-header-rows'));
      return findAll(rows, (vnode) => (
        typeof vnode.props['data-track-id'] === 'string'
        || vnode.type === PhysicsPaintTrackRow
        || vnode.type === PhysicsPaintTrackRowHeader
      ))
        .map(resolveRow)
        .filter((vnode) => (
          typeof vnode.props['data-track-id'] === 'string'
          && hasClass(vnode, 'physics-paint-track-row-header')
        ));
    },
    // 47-01 UAT: the header column must be OUTSIDE the horizontal scroller so
    // it stays pinned while the frame cells scroll (D-05).
    headerInsideScroller: () => {
      const scroller = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-timeline-scroll'));
      return findAll(scroller, (vnode) => hasClass(vnode, 'physics-paint-track-row-header'));
    },
    // 261008-ig1 Task 2: per-clip child expansion + selection/reveal access.
    soundStains: () => expandNamedComponent(tree, 'PhysicsPaintSoundClipStain'),
    soundEdges: () => expandNamedComponent(tree, 'PhysicsPaintSoundClipEdges'),
    selection: () => selectedSoundId.value,
    setRevealRequest(next: { frame: number; nonce: number } | null) {
      revealRequest = next;
    },
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
      onOpenDocumentSound,
      onDocumentSoundDblClick,
      onDocumentSoundSettle,
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

/** ResizeObserver stub — the strip's mount effect constructs one on flush. */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
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
      bytes: testWebpBytes(''),
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
    expect(harness.scroller.scrollWidth).toBe(capacity * CELL_WIDTH_PX);

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
      { keyId: 'A', appFrame: 94, kind: 'real-key', payload: { frameIndex: 0, appFrame: 94, bytes: testWebpBytes('YQ==') } },
      { keyId: 'B', appFrame: 97, kind: 'real-key', payload: { frameIndex: 1, appFrame: 97, bytes: testWebpBytes('Yg==') } },
      { keyId: 'M1', appFrame: 100, kind: 'real-key', payload: { frameIndex: 2, appFrame: 100, bytes: testWebpBytes('bTE=') } },
      { keyId: 'M2', appFrame: 101, kind: 'real-key', payload: { frameIndex: 3, appFrame: 101, bytes: testWebpBytes('bTI=') } },
      { keyId: 'S1', appFrame: 110, kind: 'real-key', payload: { frameIndex: 4, appFrame: 110, bytes: testWebpBytes('czE=') } },
      { keyId: 'S2', appFrame: 111, kind: 'real-key', payload: { frameIndex: 5, appFrame: 111, bytes: testWebpBytes('czI=') } },
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
      // Every row renders the shared frameCells extent. The active lane emits
      // opaque RotoTimelineCellButton vnodes (frame + cellClass), the
      // presentational rows emit rendered spans (data-roto-app-frame + class) —
      // both are per-row cells keyed to the same frameCells extent.
      for (const row of rows) {
        const cells = findAll(row, (vnode) => {
          const frame = vnode.props.frame;
          const cellClass = vnode.props.cellClass;
          if (typeof frame === 'number' && typeof cellClass === 'string' && cellClass.includes('physics-paint-roto-cell')) {
            return true;
          }
          const appFrame = vnode.props['data-roto-app-frame'];
          return (typeof appFrame === 'number' || typeof appFrame === 'string') && hasClass(vnode, 'physics-paint-roto-cell');
        });
        expect(cells.length).toBeGreaterThan(0);
      }
    });

    it('reads each row through its own trackId — no cross-row frame leak (TML-05/Pitfall 8)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      // Track B owns a real key at frame 8 in the runtime store.
      const bRecords: readonly PhysicPaintRotoRealKeyRecord[] = [
        { keyId: 'b-key', appFrame: 8, kind: 'real-key', payload: { frameIndex: 0, appFrame: 8, bytes: testWebpBytes('Yg==') } },
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
        cachedRotoFrames: [{ frameIndex: 0, appFrame: 5, bytes: testWebpBytes('YQ=='), source: 'real-key' }],
      });
      harness.render();

      const aCells = harness.rowCells(trackA.id);
      // The active lane renders opaque RotoTimelineCellButton vnodes: frame +
      // cellClass props (the rich lane, not the presentational row spans).
      expect(String(aCells[5].props.frame)).toBe('5');
      expect(String(aCells[5].props.cellClass)).toContain('roto-fill-cached');
      expect(String(aCells[8].props.frame)).toBe('8');
      expect(String(aCells[8].props.cellClass)).toContain('roto-fill-empty');

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

    it('renders a pinned header column with a label cell for every row including the active lane (UI-SPEC header column)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      const harness = createWorkflowHarness({
        tracks: [trackA, trackB],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
      });
      harness.render();

      // Every row — the active lane, the non-active Paint row, and the fixed
      // Background row — gets exactly one header cell in the header column.
      const headers = harness.rowHeaders();
      expect(headers).toHaveLength(3);
      const activeHeader = headers.find((h) => h.props['data-track-id'] === trackA.id);
      expect(activeHeader).toBeDefined();
      expect(activeHeader!.props['aria-label']).toBe('Select track Track 1');
      expect(activeHeader!.props.class).toContain('physics-paint-track-row-header-active');
      // 260911-s1j: every row control is standing inline — no ⋯ expander, no
      // tools panel, and no hover zone (the header never tracks pointer moves
      // or closes anything on leave).
      expect(activeHeader!.props.onPointerMove).toBeUndefined();
      expect(activeHeader!.props.onPointerLeave).toBeUndefined();
      expect(activeHeader!.props['data-tools-open']).toBeUndefined();
      expect(findAll(activeHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-tools-toggle'))).toHaveLength(0);
      expect(findAll(activeHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-tools'))).toHaveLength(0);
      // The inline controls render: the solo chip and exactly three tool
      // buttons (eye, blend, trash).
      expect(findAll(activeHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-solo'))).toHaveLength(1);
      expect(findAll(activeHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-tool-button'))).toHaveLength(3);
      // 47-01 UAT round 5: the header label carries the FULL track name (the
      // "Track 1" vs "1" fix) — the label span text must match the track name.
      const activeLabel = findOne(activeHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-label'));
      expect(String(activeLabel.props.children)).toBe('Track 1');
      const bgHeader = headers.find((h) => h.props['data-track-id'] === document.background.id);
      expect(bgHeader).toBeDefined();
      expect(bgHeader!.props['aria-label']).toBe('Bg row');
      expect(bgHeader!.props.class).toContain('physics-paint-track-row-header-background');
      // The Background row has no hover/selection capability for now — it must
      // NOT be a role=button, must not carry an onSelectTrack handler, and must
      // not render the hover tools.
      expect(bgHeader!.props.role).toBeUndefined();
      expect(bgHeader!.props.tabIndex).toBeUndefined();
      expect(bgHeader!.props.onClick).toBeUndefined();
      expect(bgHeader!.props.onPointerLeave).toBeUndefined();
      const bgLabel = findOne(bgHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-label'));
      expect(String(bgLabel.props.children)).toBe('Bg');
      expect(findAll(bgHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-tools'))).toHaveLength(0);
      expect(findAll(bgHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-tools-toggle'))).toHaveLength(0);
      // 260911-s1j: none of the standing Paint controls leak onto the Bg row.
      expect(findAll(bgHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-solo'))).toHaveLength(0);
      expect(findAll(bgHeader!, (vnode) => hasClass(vnode, 'physics-paint-track-row-tool-button'))).toHaveLength(0);

      // The header column is a sibling of the horizontal scroller, never a
      // descendant — so it stays pinned while the frame cells scroll (D-05).
      expect(harness.headerInsideScroller()).toHaveLength(0);
      const headerColumn = harness.headerColumn();
      expect(headerColumn).toBeDefined();
      const headerRows = harness.headerRows();
      expect(headerRows).toBeDefined();
      // Header cells live inside the header-rows band, so each 30px header
      // cell aligns 1:1 with its 30px row.
      expect(harness.headerRowsHeaders()).toHaveLength(3);
    });

    it('keeps the rows-region a distinct band holding the active lane (UI-SPEC rows region)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      const harness = createWorkflowHarness({
        tracks: [trackA, trackB],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
      });
      harness.render();

      // The rows-region is a distinct container holding the active lane plus
      // the presentational rows; it is a sibling of the header column inside
      // the timeline body, not fused into the lane.
      const rowsRegion = harness.rowsRegion();
      expect(rowsRegion.props['data-rows']).toBe('multi');
      const lane = findOne(rowsRegion, (vnode) => hasClass(vnode, 'physics-paint-lane'));
      expect(lane).toBeDefined();
      // 2 presentational Paint rows (50-UAT redesign: no Photo row).
      expect(harness.rowsRegionRows()).toHaveLength(2);
    });

    it('defaults the strip height to exactly the rows content, capped at 270px (UAT round 3 flexible height)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      const harness = createWorkflowHarness({
        tracks: [trackA, trackB],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
      });
      harness.render();

      const strip = harness.stripSection();
      const stripStyle = strip.props.style as { height?: string };
      // 2 Paint rows + 1 Bg row = 3 rows × 30px = 90px content;
      // chrome 132px (52.5-01b D-07: ruler band 28 -> 36) → default =
      // min(132 + 90, 270) = 222px (all rows visible, no dead space, no scroll).
      expect(String(stripStyle.height)).toBe('222px');
    });

    it('caps the default strip height at 270px when the rows overflow the cap (UAT round 3 flexible height)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      const extraTracks: InternalPaintTrack[] = [
        { ...trackB, id: 'track-c', name: 'Paint 3', order: 2 },
        { ...trackB, id: 'track-d', name: 'Paint 4', order: 3 },
        { ...trackB, id: 'track-e', name: 'Paint 5', order: 4 },
      ];
      const harness = createWorkflowHarness({
        tracks: [trackA, trackB, ...extraTracks],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
      });
      harness.render();

      const strip = harness.stripSection();
      const stripStyle = strip.props.style as { height?: string };
      // 5 Paint rows + 1 Bg row = 6 rows × 30px = 180px content; default is
      // capped at 270px so the canvas keeps room — the rows region scrolls.
      expect(String(stripStyle.height)).toBe('270px');
    });

    it('carries the full frame-capacity width on the rows-region and every track row (UAT round 2 horizontal scroll)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      const harness = createWorkflowHarness({
        tracks: [trackA, trackB],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
        // A document wider than a typical viewport: the rows must extend past
        // the visible window to the last cell, matching the ruler extent.
        capacity: 600,
      });
      harness.render();

      const fullWidth = `${harness.capacity * CELL_WIDTH_PX}px`;
      // The rows-region itself carries the full capacity width so its block
      // child does not clip at the viewport edge (the ruler and active lane
      // already reach the full extent).
      const rowsRegion = harness.rowsRegion();
      const rowsStyle = rowsRegion.props.style as { width?: string; minWidth?: string };
      expect(String(rowsStyle.width)).toBe(fullWidth);
      expect(String(rowsStyle.minWidth)).toBe(fullWidth);
      // Each presentational track row's cells grid mirrors the same extent so
      // its cells stay scrollable to the last frame like the active lane.
      for (const row of harness.rowsRegionRows()) {
        const cells = findOne(row, (vnode) => hasClass(vnode, 'physics-paint-track-row-cells'));
        expect(cells).toBeDefined();
        const cellsStyle = cells!.props.style as { minWidth?: string };
        expect(String(cellsStyle.minWidth)).toBe(fullWidth);
      }
    });

    it('renders rows in document order with the active lane highlighted in place (mockup redesign)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      // Track B is second in document order and active — the rich lane must
      // render at its DOCUMENT position (the mockup highlights the active row
      // in place), not first.
      const harness = createWorkflowHarness({
        tracks: [trackA, trackB],
        activeTrackId: trackB.id,
        layerId,
        background: document.background,
      });
      harness.render();

      const rows = harness.trackRows();
      expect(rows.map((row) => row.props['data-track-id'])).toEqual([trackA.id, trackB.id, document.background.id]);
      // The active track is the rich lane: its cells are opaque
      // RotoTimelineCellButton vnodes (frame prop); the presentational row's
      // cells are rendered spans (data-roto-app-frame).
      const bCells = harness.rowCells(trackB.id);
      expect(String(bCells[0].props.frame)).toBe('0');
      const aCells = harness.rowCells(trackA.id);
      expect(String(aCells[0].props['data-roto-app-frame'])).toBe('0');
      // The pinned header column mirrors the same document order 1:1.
      const headers = harness.rowHeaders();
      expect(headers.map((header) => header.props['data-track-id'])).toEqual([trackA.id, trackB.id, document.background.id]);
    });

    it('fades a hidden Paint row to gray without removing any cell (TML-04 hide presentation)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      const hiddenTrack: InternalPaintTrack = { ...trackB, visible: false };
      const harness = createWorkflowHarness({
        tracks: [trackA, hiddenTrack],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
      });
      harness.render();

      const bRow = harness.trackRows().find((row) => row.props['data-track-id'] === trackB.id);
      expect(bRow).toBeDefined();
      expect(String(bRow!.props.class)).toContain('physics-paint-track-row-hidden');
      // The hidden row still renders its full cell lane — hide never removes
      // elements, it only fades (the fill classes stay resolved).
      const bCells = harness.rowCells(trackB.id);
      expect(bCells.length).toBeGreaterThan(0);
      const aRow = harness.trackRows().find((row) => row.props['data-track-id'] === trackA.id);
      expect(String(aRow!.props.class)).not.toContain('physics-paint-track-row-hidden');
    });

    it('dims the active lane when the ACTIVE track is hidden (TML-04)', () => {
      const layerId = 'multi-track-layer';
      const { document, trackA, trackB } = makeMultiTrackDocument(layerId, 'track-b');
      const hiddenActive = { ...trackA, visible: false };
      const harness = createWorkflowHarness({
        tracks: [hiddenActive, trackB],
        activeTrackId: trackA.id,
        layerId,
        background: document.background,
      });
      const tree = harness.render();

      const lane = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-lane'));
      expect(String(lane.props.class)).toContain('physics-paint-lane-hidden');
      // The lane still renders its full cell extent (the fade is the only change).
      expect(findAll(lane, (vnode) => typeof vnode.props.frame === 'number').length).toBeGreaterThan(0);
    });
  });
});

describe('Studio open positions the timeline viewport on the opened frame', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** frameLeft = frame * 18; intersects the [scrollLeft, scrollLeft + clientWidth] viewport. */
  function frameInView(scroller: ReturnType<typeof createScroller>, frame: number): boolean {
    const frameLeft = frame * CELL_WIDTH_PX;
    const frameRight = frameLeft + CELL_WIDTH_PX;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    return frameLeft < viewRight && frameRight > viewLeft;
  }

  // Harness fixture unless stated: capacity 240, visibleFrameCount 47
  // (clientWidth 846, maxScroll 3474); positioning target for frame 111 =
  // 111*18 + 9 - 846/2 = 1584.

  it('(i) THE RED: opening at frame 111 puts frame 111 inside the viewport', () => {
    const harness = createWorkflowHarness({ capacity: 240, visibleFrameCount: 47, openFrame: 111 });
    harness.render();
    harness.flushEffects();

    expect(harness.scroller.scrollLeft).toBe(1584);
    expect(frameInView(harness.scroller, 111)).toBe(true);
  });

  it('(ii) control: opening at frame 1 keeps scrollLeft at 0 with frame 0 in view', () => {
    const harness = createWorkflowHarness({ capacity: 240, visibleFrameCount: 47, openFrame: 0 });
    harness.render();
    harness.flushEffects();

    expect(harness.scroller.scrollLeft).toBe(0);
    expect(frameInView(harness.scroller, 0)).toBe(true);
  });

  it('(iii) control: positioning writes no navigation or selection intent', () => {
    const harness = createWorkflowHarness({ capacity: 240, visibleFrameCount: 47, openFrame: 111 });
    harness.render();
    harness.flushEffects();

    expect(harness.spies.onNavigateToSyncedFrame).toHaveBeenCalledTimes(0);
    expect(harness.spies.onGoToFirstFrame).toHaveBeenCalledTimes(0);
    expect(harness.spies.onGoToPreviousFrame).toHaveBeenCalledTimes(0);
    expect(harness.spies.onGoToNextFrame).toHaveBeenCalledTimes(0);
    expect(harness.spies.onGoToLastFrame).toHaveBeenCalledTimes(0);
    expect(harness.spies.onSelectRotoSpacingProxy).toHaveBeenCalledTimes(0);
    expect(harness.spies.onClearRotoKeySelection).toHaveBeenCalledTimes(0);
    expect(harness.spies.onSelectRotoLoopClip).toHaveBeenCalledTimes(0);
  });

  it('(iv) RED: one-shot positioning — navigation never re-positions and manual scroll never snaps back', () => {
    const harness = createWorkflowHarness({ capacity: 240, visibleFrameCount: 47, openFrame: 111 });
    harness.render();
    harness.flushEffects();
    expect(harness.scroller.scrollLeft).toBe(1584);

    // In-session: the launch frame moves on and the current frame navigates.
    harness.setOpenFrame(50);
    harness.spies.onNavigateToSyncedFrame(50);
    harness.render();
    harness.flushEffects();
    expect(harness.scroller.scrollLeft).toBe(1584);

    // Manual scroll after open stays free — no snap-back on the next flush.
    harness.scrollToFrame(5);
    harness.flushEffects();
    expect(harness.scroller.scrollLeft).toBe(90);
  });

  it('(v) RED: late content — parked while the extent is short, positions once content covers the frame', () => {
    const harness = createWorkflowHarness({ capacity: 50, visibleFrameCount: 47, openFrame: 111 });
    harness.render();
    harness.flushEffects();
    // scrollWidth 900 < (111+1)*18 = 2016 → not eligible → parked at 0.
    expect(harness.scroller.scrollLeft).toBe(0);

    harness.setCapacity(240);
    harness.render();
    harness.flushEffects();
    expect(harness.scroller.scrollLeft).toBe(1584);
  });

  it('(vi) control: no launch frame never positions, whatever the current frame is', () => {
    const harness = createWorkflowHarness({ capacity: 240, visibleFrameCount: 47, currentFrame: 111 });
    harness.render();
    harness.flushEffects();

    expect(harness.scroller.scrollLeft).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
 * 261008-ig1 Task 2 — the multi-clip band: one stain per clip, selection via
 * the Studio-owned signal (narrow read in the per-clip children), press =
 * select (never scrub), band press = deselect, dblclick = open THAT clip.
 * ------------------------------------------------------------------------- */

describe('PhysicsPaintWorkflowStrip multi-clip sound band (261008-ig1 Task 2)', () => {
  const CLIP_A: DocumentSoundClip = {
    id: 'clip-a',
    sourceId: 'src-shared',
    sourcePath: '/Users/test/Music/shared.wav',
    sourceRevision: 0,
    startFrame: 0,
    inFrame: 0,
    outFrame: 48,
    gain: 0,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'linear',
    fadeOutCurve: 'linear',
    enabled: true,
  };
  // D-02: a second placed clip of the SAME imported file (shared sourceId —
  // one peaks entry must serve both stains).
  const CLIP_B: DocumentSoundClip = {
    ...CLIP_A,
    id: 'clip-b',
    startFrame: 96,
    outFrame: 132,
  };
  const PEAKS = {
    tier1: new Float32Array(8),
    tier2: new Float32Array(8),
    tier3: new Float32Array(8),
  };

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    audioPeaksCache.clear();
    audioPeaksCache.set('src-shared', PEAKS, 48);
  });
  afterEach(() => {
    audioPeaksCache.clear();
    vi.unstubAllGlobals();
  });

  function pressEvent(overrides: Record<string, unknown> = {}) {
    return {
      isPrimary: true,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      pointerId: 1,
      clientX: 36,
      stopPropagation: vi.fn(),
      ...overrides,
    };
  }

  it('renders one stain per clip and exactly one is-selected — the selected clip', () => {
    const harness = createWorkflowHarness({
      documentAudios: [CLIP_A, CLIP_B],
      selectedSoundId: 'clip-b',
    });
    harness.render();

    const stains = harness.soundStains();
    expect(stains).toHaveLength(2);
    const selected = stains.filter((stain) => hasClass(stain, 'is-selected'));
    expect(selected).toHaveLength(1);
    // CLIP_B is the SECOND entry (document order) — selection binds by id,
    // not by list position.
    expect(stains.indexOf(selected[0])).toBe(1);
    // Both stains render (non-null) from the ONE shared-source peaks entry —
    // the child fails closed to null without peaks (D-02/D-03).
    expect(stains.every((stain) => typeof stain.props.onDblClick === 'function')).toBe(true);
  });

  it('stain press selects THAT clip, stops the press, and never seeks', () => {
    const harness = createWorkflowHarness({ documentAudios: [CLIP_A, CLIP_B] });
    harness.render();
    // The strip's gesture session calls window.addEventListener at event time
    // (the ruler scrub hook captured `win` at setup — no window there).
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });

    const stains = harness.soundStains();
    const event = pressEvent();
    (stains[0].props.onPointerDown as (pointerEvent: unknown) => void)(event);

    expect(harness.selection()).toBe('clip-a');
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(harness.spies.onNavigateToSyncedFrame).not.toHaveBeenCalled();
    expect(harness.spies.onOpenDocumentSound).not.toHaveBeenCalled();
  });

  it('pressing the band outside every clip deselects without seeking', () => {
    const harness = createWorkflowHarness({
      documentAudios: [CLIP_A, CLIP_B],
      selectedSoundId: 'clip-b',
    });
    // No window stub: the ruler scrub hook captured `win` = undefined at
    // setup and early-returns — only the strip's deselect line runs.
    const tree = harness.render();
    const ruler = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-ruler'));
    (ruler.props.onPointerDown as (pointerEvent: unknown) => void)(pressEvent());

    expect(harness.selection()).toBeNull();
    expect(harness.spies.onNavigateToSyncedFrame).not.toHaveBeenCalled();
  });

  it('double-clicking a clip opens THAT clip through the clip port, never the header launcher', () => {
    const harness = createWorkflowHarness({ documentAudios: [CLIP_A, CLIP_B] });
    harness.render();

    const stains = harness.soundStains();
    const event = { stopPropagation: vi.fn() };
    (stains[1].props.onDblClick as (pointerEvent: unknown) => void)(event);

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(harness.spies.onDocumentSoundDblClick).toHaveBeenCalledWith('clip-b');
    expect(harness.spies.onOpenDocumentSound).not.toHaveBeenCalled();
  });

  it('strip body source never reads selectedSoundId.value — only the per-clip children do (narrow-read law)', () => {
    const bodyAt = stripSource.indexOf('export function PhysicsPaintWorkflowStrip');
    expect(bodyAt).toBeGreaterThan(-1);
    // The per-clip children are declared BEFORE the strip export (the strip is
    // the last top-level declaration), so this slice is exactly the render body.
    const body = stripSource.slice(bodyAt);
    // The lookahead distinguishes reads from the guarded `= null` / `= clip.id`
    // writes that live inside event handlers.
    const readPattern = /selectedSoundId\.value(?!\s*=[^=])/g;
    expect(body.match(readPattern) ?? []).toHaveLength(0);

    const stainAt = stripSource.indexOf('function PhysicsPaintSoundClipStain');
    const edgesAt = stripSource.indexOf('function PhysicsPaintSoundClipEdges');
    expect(stainAt).toBeGreaterThan(-1);
    expect(stainAt).toBeLessThan(bodyAt);
    expect(edgesAt).toBeGreaterThan(stainAt);
    const stainChild = stripSource.slice(stainAt, edgesAt);
    expect((stainChild.match(readPattern) ?? []).length).toBeGreaterThanOrEqual(1);
    const edgesChild = stripSource.slice(edgesAt, bodyAt);
    expect((edgesChild.match(readPattern) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});

/* ---------------------------------------------------------------------------
 * 261008-ig1 Task 2 — reveal: the modal row click issues `{frame, nonce}`;
 * the strip rides the qad positioning math keyed on the nonce ALONE (identity-
 * stable deps), manual scrolling is never overridden, a new nonce re-fires.
 * ------------------------------------------------------------------------- */

describe('PhysicsPaintWorkflowStrip reveal request (261008-ig1 Task 2)', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Harness fixture: capacity 240, visibleFrameCount 47 (clientWidth 846,
  // maxScroll 3474) — positioning target for frame 111 = 111*18 + 9 - 423 = 1584.
  it('positions once per nonce, manual scroll persists, a new nonce re-fires', () => {
    const harness = createWorkflowHarness({ capacity: 240, visibleFrameCount: 47 });
    harness.render();
    harness.flushEffects();
    expect(harness.scroller.scrollLeft).toBe(0);

    harness.setRevealRequest({ frame: 111, nonce: 1 });
    harness.render();
    harness.flushEffects();
    expect(harness.scroller.scrollLeft).toBe(1584);

    // The scroll the USER did is never snapped back (qad law): same nonce,
    // effect deps unchanged, no re-position.
    harness.scrollToFrame(5);
    harness.flushEffects();
    expect(harness.scroller.scrollLeft).toBe(90);

    // A NEW reveal request re-fires on demand.
    harness.setRevealRequest({ frame: 111, nonce: 2 });
    harness.render();
    harness.flushEffects();
    expect(harness.scroller.scrollLeft).toBe(1584);
  });

  it('parks while the content extent is shorter than the reveal frame', () => {
    const harness = createWorkflowHarness({ capacity: 50, visibleFrameCount: 47 });
    harness.render();
    harness.setRevealRequest({ frame: 111, nonce: 1 });
    harness.render();
    harness.flushEffects();
    // scrollWidth 900 < (111+1)*18 = 2016 → parked at 0 (fail-closed).
    expect(harness.scroller.scrollLeft).toBe(0);
  });

  it('reveal positioning writes no navigation or selection intent', () => {
    const harness = createWorkflowHarness({ capacity: 240, visibleFrameCount: 47 });
    harness.render();
    harness.setRevealRequest({ frame: 111, nonce: 1 });
    harness.render();
    harness.flushEffects();

    expect(harness.scroller.scrollLeft).toBe(1584);
    expect(harness.spies.onNavigateToSyncedFrame).toHaveBeenCalledTimes(0);
    expect(harness.spies.onGoToFirstFrame).toHaveBeenCalledTimes(0);
    expect(harness.spies.onGoToLastFrame).toHaveBeenCalledTimes(0);
  });
});

/* ---------------------------------------------------------------------------
 * 261008-ig1 Task 3 — the alt+drag duplication truth table (D-03):
 * - bare alt + stain body → kind 'duplicate' + clipId STAMPED at pointer-down
 *   (identity never switches mid-move), ghost preview while the original stays
 *   put, store commit on pointer-up ONLY (settle-on-release),
 * - cmd/alt never duplicates (the meta/ctrl/shift exclusions run first),
 * - alt on a trim handle still trims (trim gains no alt branch),
 * - sub-threshold press commits nothing and retracts the ghost.
 * ------------------------------------------------------------------------- */

describe('PhysicsPaintWorkflowStrip alt+drag duplication (261008-ig1 Task 3)', () => {
  const CLIP: DocumentSoundClip = {
    id: 'clip-1',
    sourceId: 'src-shared',
    sourcePath: '/Users/test/Music/shared.wav',
    sourceRevision: 0,
    startFrame: 0,
    inFrame: 0,
    outFrame: 48,
    gain: 0,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'linear',
    fadeOutCurve: 'linear',
    enabled: true,
  };
  const PEAKS = {
    tier1: new Float32Array(8),
    tier2: new Float32Array(8),
    tier3: new Float32Array(8),
  };

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    audioPeaksCache.clear();
    audioPeaksCache.set('src-shared', PEAKS, 48);
  });
  afterEach(() => {
    audioPeaksCache.clear();
    vi.unstubAllGlobals();
  });

  function pressEvent(overrides: Record<string, unknown> = {}) {
    return {
      isPrimary: true,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      pointerId: 1,
      clientX: 36,
      stopPropagation: vi.fn(),
      ...overrides,
    };
  }

  /** Install the gesture window AFTER render (the ruler scrub hook captured
   *  `win` at setup) and expose the window-level drag handlers. */
  function stubGestureWindow() {
    const listeners = new Map<string, (event: unknown) => void>();
    vi.stubGlobal('window', {
      addEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
        listeners.set(type, handler);
      }),
      removeEventListener: vi.fn(),
    });
    return {
      registered: () => [...listeners.keys()],
      move: (clientX: number) => {
        listeners.get('pointermove')?.({ pointerId: 1, clientX, stopPropagation: vi.fn() });
      },
      up: (clientX: number) => {
        listeners.get('pointerup')?.({ pointerId: 1, clientX, stopPropagation: vi.fn() });
      },
    };
  }

  function ghostsOf(tree: unknown): TestVNode[] {
    // The ghost is a function component — expand it (same idiom as the
    // stain/edges children) to reach the rendered intrinsic vnode's class.
    return expandNamedComponent(tree, 'PhysicsPaintSoundDuplicateGhost')
      .filter((vnode) => hasClass(vnode, 'physics-paint-sound-duplicate-preview'));
  }

  it('bare alt+drag stamps kind+clipId at pointer-down, previews the ghost, and settles only on release', () => {
    const harness = createWorkflowHarness({ documentAudios: [CLIP] });
    harness.render();
    const win = stubGestureWindow();

    const stains = harness.soundStains();
    const event = pressEvent({ altKey: true });
    (stains[0].props.onPointerDown as (pointerEvent: unknown) => void)(event);

    // Press = select THAT clip + stop (same contract as a plain press) and the
    // gesture identity (duplicate + clipId) is stamped HERE, before any move.
    expect(harness.selection()).toBe('clip-1');
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(win.registered()).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']));

    // The ghost preview renders while the ORIGINAL stain keeps its geometry —
    // one ghost, no selection class of its own (exactly one is-selected law).
    const tree = harness.render();
    const ghosts = ghostsOf(tree);
    expect(ghosts).toHaveLength(1);
    expect((ghosts[0].props.style as { left: string }).left).toBe('0px');
    expect(hasClass(ghosts[0], 'is-selected')).toBe(false);
    const original = harness.soundStains()[0];
    expect((original.props.style as { left: string }).left).toBe('0px');

    // +3 cells: the ghost tracks the drag (DOM-imperative — no strip
    // re-render), but NOTHING commits until pointer-up (settle-on-release).
    win.move(36 + 54);
    expect(harness.spies.onDocumentSoundSettle).not.toHaveBeenCalled();

    win.up(36 + 54);
    expect(harness.spies.onDocumentSoundSettle).toHaveBeenCalledTimes(1);
    expect(harness.spies.onDocumentSoundSettle).toHaveBeenCalledWith({
      clipId: 'clip-1',
      kind: 'duplicate',
      startFrame: 3,
      inFrame: 0,
      outFrame: 48,
    });

    // Ghost retracted after release — the committed clone renders from the
    // store instead (the original never moved).
    const after = harness.render();
    expect(ghostsOf(after)).toHaveLength(0);
    expect((harness.soundStains()[0].props.style as { left: string }).left).toBe('0px');
  });

  it('gesture identity never switches mid-move — releasing alt mid-drag still settles as duplicate', () => {
    const harness = createWorkflowHarness({ documentAudios: [CLIP] });
    harness.render();
    const win = stubGestureWindow();

    (harness.soundStains()[0].props.onPointerDown as (pointerEvent: unknown) => void)(pressEvent({ altKey: true }));
    // Move + release events carry NO altKey (the user let go of the modifier) —
    // the kind decided at pointer-down is the one that settles.
    win.move(36 + 18);
    win.up(36 + 18);

    expect(harness.spies.onDocumentSoundSettle).toHaveBeenCalledTimes(1);
    expect(harness.spies.onDocumentSoundSettle).toHaveBeenCalledWith({
      clipId: 'clip-1',
      kind: 'duplicate',
      startFrame: 1,
      inFrame: 0,
      outFrame: 48,
    });
  });

  it('cmd+alt never duplicates — the modifier exclusions run before the alt branch', () => {
    const harness = createWorkflowHarness({ documentAudios: [CLIP] });
    harness.render();
    const win = stubGestureWindow();

    const event = pressEvent({ altKey: true, metaKey: true });
    (harness.soundStains()[0].props.onPointerDown as (pointerEvent: unknown) => void)(event);

    // The guard returned before stopPropagation/selection/session — no
    // gesture, no ghost, no settle path at all.
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(harness.selection()).toBeNull();
    expect(win.registered()).toHaveLength(0);
    expect(ghostsOf(harness.render())).toHaveLength(0);
  });

  it('alt on a trim handle still trims — trim gains no duplicate branch', () => {
    const harness = createWorkflowHarness({ documentAudios: [CLIP] });
    harness.render();
    const win = stubGestureWindow();

    const edges = harness.soundEdges();
    const startEdge = findOne(edges[0], (vnode) => hasClass(vnode, 'physics-paint-sound-edge-start'));
    const event = pressEvent({ altKey: true });
    (startEdge.props.onPointerDown as (pointerEvent: unknown) => void)(event);

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(harness.selection()).toBe('clip-1');
    expect(win.registered()).toEqual(expect.arrayContaining(['pointermove', 'pointerup']));

    win.move(36 + 18);
    win.up(36 + 18);

    // kind 'trim-start' — never 'duplicate': a left trim moves start+in together.
    expect(harness.spies.onDocumentSoundSettle).toHaveBeenCalledTimes(1);
    expect(harness.spies.onDocumentSoundSettle).toHaveBeenCalledWith({
      clipId: 'clip-1',
      kind: 'trim-start',
      startFrame: 1,
      inFrame: 1,
      outFrame: 48,
    });
    expect(ghostsOf(harness.render())).toHaveLength(0);
  });

  it('a sub-threshold alt press commits nothing and retracts the ghost', () => {
    const harness = createWorkflowHarness({ documentAudios: [CLIP] });
    harness.render();
    const win = stubGestureWindow();

    (harness.soundStains()[0].props.onPointerDown as (pointerEvent: unknown) => void)(pressEvent({ altKey: true }));
    expect(ghostsOf(harness.render())).toHaveLength(1);

    // Release under the 4px arm threshold: press selected only — no settle.
    win.up(36);
    expect(harness.spies.onDocumentSoundSettle).not.toHaveBeenCalled();
    expect(ghostsOf(harness.render())).toHaveLength(0);
  });
});
