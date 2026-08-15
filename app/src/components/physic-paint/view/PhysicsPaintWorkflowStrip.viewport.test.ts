import type { ComponentChildren } from 'preact';
import type { PreactHookRuntime } from '../../../test/preactHookRuntime';
import type { PhysicPaintRotoLoopClip, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import { vi } from 'vitest';

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
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  readonly loopResolutionContext?: ReturnType<typeof derivePhysicPaintRotoLoopRanges> | null;
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

  return {
    capacity,
    scroller,
    render,
    scrollToFrame,
    clickFrame,
    dragScrollbarToRatio,
    representedFrames: () => representedFrames(tree),
    currentFrame: () => currentFrame,
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
      parentEndExclusive: 240,
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
});
