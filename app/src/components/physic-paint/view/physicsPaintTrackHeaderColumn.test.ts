/**
 * 47-02 Task 1: pinned header column component behavior tests (TML-01/02/03/07,
 * D-02/D-04/D-06/D-07/D-08).
 *
 * The header column is hook-free (presentational — the strip owns rename/tools
 * state and flows it down), so the tests invoke it as a plain function and walk
 * the returned vnode tree, expanding the hook-free `PhysicsPaintTrackRowHeader`
 * vnodes the same way the strip viewport test does. The solo-arm reflection
 * reads the real `physicsPaintSoloArm` module-level signal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentChildren } from 'preact';
import type { PreactHookRuntime } from '../../../test/preactHookRuntime';
import type { EfxPaintDocument, BackgroundTrack, InternalPaintTrack } from '../../../efx-paint/document/efxPaintDocument';
import type { TrackDeletePreview } from '../../../stores/efxPaintStore';
import type { RotoPhysicalTimelineActionBundle } from '../hooks/useRotoTimelineActions';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { PhysicsPaintTrackColumnStrip, PhysicsPaintTrackRowHeader } from './PhysicsPaintTrackRow';
import { disarmSolo, toggleSolo } from './physicsPaintSoloArm';
import { physicsPaintTrackHeaderColumn } from './physicsPaintTrackHeaderColumn';

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

import { getDocument, registerDocument, requestDeleteTrack } from '../../../stores/efxPaintStore';
import * as efxPaintStoreModule from '../../../stores/efxPaintStore';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED } from '../roto/physicsPaintRotoPhysicalModel';
import { signal } from '@preact/signals';
import { PhysicsPaintWorkflowStrip, computeEnsureRowScrollDelta } from './PhysicsPaintWorkflowStrip';
import { PhysicsPaintDeleteTrackDialog } from './PhysicsPaintDeleteTrackDialog';

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

/** The column renders rows via the hook-free `PhysicsPaintTrackRowHeader`
 *  component and the top strip via `PhysicsPaintTrackColumnStrip`; expand
 *  those vnodes by calling the component function directly. The delete dialog
 *  is hook-free too, so a dialog vnode expands the same way. */
function expandComponent(vnode: TestVNode): TestVNode {
  if (vnode.type === PhysicsPaintTrackRowHeader || vnode.type === PhysicsPaintTrackColumnStrip || vnode.type === PhysicsPaintDeleteTrackDialog) {
    return (vnode.type as (props: TestVNode['props']) => TestVNode)(vnode.props);
  }
  return vnode;
}

/** A minimal DOM event stub for the component's stopPropagation-preventDefault handlers. */
function clickEvent(): { stopPropagation: ReturnType<typeof vi.fn> } {
  return { stopPropagation: vi.fn() };
}

/** The expanded header cells in DOM order (Paint rows then the fixed Bg row). */
function headerCells(root: unknown): TestVNode[] {
  return findAll(root, (vnode) => vnode.type === PhysicsPaintTrackRowHeader)
    .map(expandComponent)
    .filter((vnode) => typeof vnode.props['data-track-id'] === 'string');
}

function headerCell(root: unknown, trackId: string): TestVNode {
  const found = findAll(root, (vnode) => vnode.type === PhysicsPaintTrackRowHeader)
    .map(expandComponent)
    .filter((vnode) => vnode.props['data-track-id'] === trackId);
  expect(found).toHaveLength(1);
  return found[0];
}

interface ColumnFixture {
  readonly layerId: string;
  readonly tracks: readonly InternalPaintTrack[];
  readonly activeTrackId: string;
  readonly background: BackgroundTrack;
  readonly trackA: InternalPaintTrack;
  readonly trackB: InternalPaintTrack;
}

function makeTwoTrackFixture(): ColumnFixture {
  const document = createEfxPaintDocument('header-column-layer');
  const trackA = document.tracks[0];
  const trackB: InternalPaintTrack = { ...trackA, id: 'track-b', name: 'Paint 2', order: 1 };
  return {
    layerId: 'header-column-layer',
    tracks: [trackA, trackB],
    activeTrackId: trackA.id,
    background: document.background,
    trackA,
    trackB,
  };
}

interface ColumnRenderOptions {
  readonly layerId?: string;
  readonly tracks: readonly InternalPaintTrack[];
  readonly activeTrackId: string;
  readonly background: BackgroundTrack | null;
  readonly onSelectTrack?: (trackId: string) => void;
  readonly onToggleVisible?: (trackId: string) => void;
  readonly onToggleSolo?: (trackId: string) => void;
  readonly onToggleBlend?: (trackId: string) => void;
  readonly onAddTrack?: () => void;
  readonly onDuplicateTrack?: (trackId: string) => void;
  readonly onRequestDeleteTrack?: (trackId: string) => void;
  readonly toolsOpenTrackId?: string | null;
  readonly onToggleTools?: (trackId: string) => void;
}

function renderColumn(options: ColumnRenderOptions): TestVNode {
  return physicsPaintTrackHeaderColumn({
    layerId: options.layerId ?? 'header-column-layer',
    tracks: options.tracks,
    activeTrackId: options.activeTrackId,
    background: options.background,
    onSelectTrack: options.onSelectTrack ?? vi.fn(),
    onToggleVisible: options.onToggleVisible ?? vi.fn(),
    onToggleSolo: options.onToggleSolo ?? vi.fn(),
    onToggleBlend: options.onToggleBlend ?? vi.fn(),
    onAddTrack: options.onAddTrack ?? vi.fn(),
    onDuplicateTrack: options.onDuplicateTrack ?? vi.fn(),
    onRequestDeleteTrack: options.onRequestDeleteTrack ?? vi.fn(),
    toolsOpenTrackId: options.toolsOpenTrackId ?? null,
    onToggleTools: options.onToggleTools ?? vi.fn(),
  });
}

function renderFixture(fixture: ColumnFixture, overrides: Partial<ColumnRenderOptions> = {}): TestVNode {
  return renderColumn({ ...fixture, ...overrides });
}

/* ---- 47-02 Task 2: strip harness + CRUD behavior tests ---- */

function isVnode(value: unknown): value is TestVNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'props' in value;
}

/**
 * The strip renders the hook-free `physicsPaintTrackHeaderColumn` as an opaque
 * vnode whose rendered DOM never appears in the walk (it carries no children).
 * Expand it in place by calling the component function with its props, so the
 * row headers / rename input / insertion indicator become reachable.
 */
function expandHeaderColumnVnodes(node: TestVNode): TestVNode {
  const children = childrenOf(node);
  if (children.length === 0) return node;
  const expanded = children.map((child) => {
    if (isVnode(child) && child.type === physicsPaintTrackHeaderColumn) {
      return (child.type as (props: TestVNode['props']) => TestVNode)(child.props);
    }
    return isVnode(child) ? expandHeaderColumnVnodes(child) : child;
  });
  return { ...node, props: { ...node.props, children: expanded } };
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

function createPhysicalCells(capacity: number): readonly RotoPhysicalTimelineCell[] {
  return Array.from({ length: capacity }, (_, appFrame): RotoPhysicalTimelineCell => ({ kind: 'empty', appFrame }));
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

/** A fake header-rows band the strip reads for the reorder insertion math. */
function createHeaderBand(top = 100) {
  return {
    getBoundingClientRect: vi.fn(() => ({ top, bottom: top + 270, left: 0, right: 140, width: 140, height: 270 })),
    scrollTop: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    querySelector: vi.fn(() => null),
    contains: vi.fn(() => false),
  };
}

/** One tracked row's live geometry, in rows-region CONTENT coordinates. */
interface RowsRegionRowFixture {
  readonly trackId: string;
  contentTop: number;
  contentBottom: number;
}

/** The rows-region fake's vertical geometry (47-02 Task 3). */
interface RowsRegionFixture {
  readonly clientHeight: number;
  readonly scrollHeight: number;
  readonly rows: readonly RowsRegionRowFixture[];
}

/**
 * A fake rows-region the strip reads for the vertical scroll machinery: the
 * scrollbar pill's top/height/visible derivation, the header-band sync, and
 * the ensure-active-row effect. Each tracked row's visual rect derives from
 * its CONTENT coordinates minus the current scrollTop, mirroring a real DOM
 * where scrolling moves the content under a fixed viewport.
 */
function createRowsRegion(initial: RowsRegionFixture) {
  let scrollTop = 0;
  const state = {
    clientHeight: initial.clientHeight,
    scrollHeight: initial.scrollHeight,
    rows: [...initial.rows],
  };
  const region = {
    get clientHeight() { return state.clientHeight; },
    set clientHeight(value: number) { state.clientHeight = value; },
    get scrollHeight() { return state.scrollHeight; },
    set scrollHeight(value: number) { state.scrollHeight = value; },
    get scrollTop() { return scrollTop; },
    set scrollTop(value: number) {
      scrollTop = Math.max(0, Math.min(value, Math.max(0, state.scrollHeight - state.clientHeight)));
    },
    scrollLeft: 0,
    getBoundingClientRect: vi.fn(() => ({ top: 0, bottom: state.clientHeight, height: state.clientHeight, left: 140, right: 140 })),
    querySelector: vi.fn((selector: string) => {
      const match = /^\[data-track-id="(.+)"\]$/.exec(selector);
      const row = match ? state.rows.find((candidate) => candidate.trackId === match[1]) : undefined;
      if (!row) return null;
      return {
        getBoundingClientRect: () => ({
          top: row.contentTop - scrollTop,
          bottom: row.contentBottom - scrollTop,
          height: row.contentBottom - row.contentTop,
        }),
      };
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setRowGeometry(trackId: string, contentTop: number, contentBottom: number) {
      const row = state.rows.find((candidate) => candidate.trackId === trackId);
      if (row) {
        row.contentTop = contentTop;
        row.contentBottom = contentBottom;
      }
    },
  };
  return region;
}

/** ResizeObserver stub — the strip's mount effect constructs one. */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** A pointer-capture drag target that records the strip's session listeners. */
function createDragTarget(rect: { top: number; left: number; width: number; height: number } = { top: 0, left: 0, width: 140, height: 30 }) {
  const handlers = new Map<string, (event: unknown) => void>();
  const target = {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    addEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
      handlers.set(type, handler);
    }),
    removeEventListener: vi.fn((type: string) => {
      handlers.delete(type);
    }),
    getBoundingClientRect: vi.fn(() => rect),
    fire: (type: string, event: unknown) => handlers.get(type)?.(event),
  };
  return target;
}

interface RegisteredFixture {
  readonly layerId: string;
  readonly document: EfxPaintDocument;
  readonly trackA: InternalPaintTrack;
  readonly trackB: InternalPaintTrack;
  readonly background: BackgroundTrack;
}

/** A two-track document registered in the store (the CRUD store ops need it). */
function makeRegisteredFixture(): RegisteredFixture {
  const layerId = 'header-column-crud-layer';
  const document = createEfxPaintDocument(layerId);
  const trackA = document.tracks[0];
  const trackB: InternalPaintTrack = { ...trackA, id: 'track-b', name: 'Paint 2', order: 1 };
  const twoTrackDocument: EfxPaintDocument = { ...document, tracks: [trackA, trackB] };
  registerDocument(twoTrackDocument);
  return { layerId, document: twoTrackDocument, trackA, trackB, background: document.background };
}

interface StripHarnessOptions {
  readonly fixture: RegisteredFixture;
  readonly activeTrackId?: string;
  readonly rows?: RowsRegionFixture;
  readonly onToggleTrackVisible?: (trackId: string, visible: boolean) => void;
  readonly onToggleSolo?: (trackId: string, solo: boolean) => void;
  readonly onRenameTrack?: (trackId: string, name: string) => void;
  readonly onDuplicateTrack?: (trackId: string) => void;
  readonly onReorderTrack?: (trackId: string, newOrder: number) => void;
  readonly publishStatus?: (message: string | null) => void;
}

/**
 * A complete `rotoPhysicalActions` surface for the strip harness: every
 * `.value` member the strip reads during render is backed by a real signal
 * (the disabled/computed ones start disabled-false), and the interaction
 * functions are inert spies. The rename/delete status channel is the harness's
 * `publishStatus` capture spy so rejections are observable.
 */
function createPhysicalActions(publishStatus: (message: string | null) => void): RotoPhysicalTimelineActionBundle {
  const bool = (value = false) => signal(value);
  // The harness only exercises the members the strip reads during render and
  // the rename/delete interactions; the rest of the bundle surface is inert.
  return {
    canInsertFrame: bool(),
    canDeleteFrame: bool(),
    canScissor: bool(),
    insertDisabledReason: signal<string | null>(null),
    insertTooltipDescription: signal('Insert key before'),
    deleteDisabledReason: signal<string | null>(null),
    deleteScopeLabel: signal('Delete Frame'),
    scissorDisabledReason: signal<string | null>(null),
    forceSpacingInput: signal('1'),
    canApplyForceSpacing: bool(),
    forceSpacingDisabledReason: signal<string | null>(null),
    canDragKey: bool(),
    canAddEmptyKey: bool(),
    addEmptyKeyDisabledReason: signal<string | null>(null),
    scissorTooltipDescription: signal('Split the Key Rail before this key.'),
    canSelectAllKeys: bool(),
    selectAllKeysDisabledReason: signal<string | null>(null),
    dragDisabledReason: signal<string | null>(null),
    publishStatus,
    prepareRotoPush: vi.fn(),
    commitRotoPush: vi.fn(async () => false),
    prepareRailSetMove: vi.fn(),
    commitRailSetMove: vi.fn(async () => false),
    setForceSpacingInput: vi.fn(),
    applyForceSpacing: vi.fn(),
  } as unknown as RotoPhysicalTimelineActionBundle;
}

/**
 * Strip-level harness for the CRUD interactions (47-02 Task 2): renders the
 * real `PhysicsPaintWorkflowStrip` with a registered two-track bundle and
 * spy intents. The strip invokes the hook-free header column as a plain
 * function, so its DOM (row headers, rename input, insertion indicator) is
 * directly in the tree; the delete dialog appears appended at the strip root
 * when a delete preview is live.
 */
function createStripHarness(options: StripHarnessOptions) {
  const runtime = runtimeHolder.current;
  if (!runtime) throw new Error('Expected the Preact hook runtime mock.');
  runtime.reset();
  const { fixture } = options;
  const scroller = createScroller(47 * 18);
  const content = {};
  const band = createHeaderBand();
  const rowsRegion = createRowsRegion(options.rows ?? {
    clientHeight: 90,
    scrollHeight: 300,
    rows: [
      { trackId: fixture.trackA.id, contentTop: 120, contentBottom: 150 },
      { trackId: fixture.trackB.id, contentTop: 240, contentBottom: 270 },
    ],
  });
  // 47-02 Task 3: the pinned header-column element never scrolls (D-01/D-05);
  // the band INSIDE it carries the vertical scroll position. The strip owns
  // this ref and hands it to the hook-free column.
  const column = { scrollTop: 0 };
  const callbacks = {
    onSelectTrack: vi.fn(),
    onToggleTrackVisible: options.onToggleTrackVisible ?? vi.fn(),
    onToggleSolo: options.onToggleSolo ?? vi.fn(),
    onRenameTrack: options.onRenameTrack ?? vi.fn(),
    onDuplicateTrack: options.onDuplicateTrack ?? vi.fn(),
    onReorderTrack: options.onReorderTrack ?? vi.fn(),
    publishStatus: options.publishStatus ?? vi.fn(),
  };
  let tree: unknown = null;

  function render(overrides: { readonly activeTrackId?: string } = {}): unknown {
    const runtime = runtimeHolder.current;
    if (!runtime) throw new Error('Expected the Preact hook runtime mock.');
    runtime.beginRender();
    tree = PhysicsPaintWorkflowStrip({
      currentFrame: 154,
      isPlaying: false,
      ready: true,
      onion: { enabled: false, previous: false, next: false, count: 1, opacity: 0.5 },
      rotoPhysicalCells: createPhysicalCells(240),
      onNavigateToSyncedFrame: vi.fn(),
      onGoToFirstFrame: vi.fn(),
      onGoToPreviousFrame: vi.fn(),
      onGoToNextFrame: vi.fn(),
      onGoToLastFrame: vi.fn(),
      onOnionChange: vi.fn(),
      onSelectRotoSpacingProxy: vi.fn(),
      onClearRotoSpacingSelection: vi.fn(),
      onClearRotoKeySelection: vi.fn(),
      onSelectRotoLoopClip: vi.fn(),
      rotoPhysicalActions: createPhysicalActions(callbacks.publishStatus),
      tracks: fixture.document.tracks,
      activeTrackId: overrides.activeTrackId ?? options.activeTrackId ?? fixture.trackA.id,
      layerId: fixture.layerId,
      background: fixture.background,
      onSelectTrack: callbacks.onSelectTrack,
      onToggleTrackVisible: callbacks.onToggleTrackVisible,
      onToggleSolo: callbacks.onToggleSolo,
      onRenameTrack: callbacks.onRenameTrack,
      onDuplicateTrack: callbacks.onDuplicateTrack,
      onReorderTrack: callbacks.onReorderTrack,
    });
    tree = expandHeaderColumnVnodes(tree as TestVNode);

    const scrollerNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-timeline-scroll'));
    const contentNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-lane'));
    assignRef(scrollerNode.ref ?? scrollerNode.props.ref, scroller);
    assignRef(contentNode.ref ?? contentNode.props.ref, content);
    const headerRowsNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-header-rows'));
    assignRef(headerRowsNode.ref ?? headerRowsNode.props.ref, band);
    // 47-02 Task 3: the rows-region and the pinned header column carry refs
    // the strip reads for the vertical scroll machinery (pill geometry,
    // ensure-active-row, sync lockstep).
    const rowsRegionNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-rows-region'));
    assignRef(rowsRegionNode.ref ?? rowsRegionNode.props.ref, rowsRegion);
    const headerColumnNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-header-column'));
    assignRef(headerColumnNode.ref ?? headerColumnNode.props.ref, column);
    const ruler = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-ruler'));
    const width = Number.parseFloat(String((ruler.props.style as { width?: string } | undefined)?.width ?? '0'));
    scroller.scrollWidth = width;
    return tree;
  }

  function headerCellFor(trackId: string): TestVNode {
    return headerCell(tree, trackId);
  }

  function renameInput(): TestVNode {
    const expandedHeaders = findAll(tree, (vnode) => vnode.type === PhysicsPaintTrackRowHeader).map(expandComponent);
    const inputs = expandedHeaders.flatMap((header) => findAll(header, (vnode) => hasClass(vnode, 'physics-paint-track-rename-input')));
    expect(inputs).toHaveLength(1);
    // preact/compat's options.vnode hook normalizes DOM event props: onInput
    // arrives as 'oninput' and onBlur as 'onfocusout' in the vnode tree
    // (onClick/onKeyDown stay camelCase — they are not in the special list).
    expect(inputs[0].props['oninput']).toBeTypeOf('function');
    return inputs[0];
  }

  function grip(trackId: string): TestVNode {
    const header = headerCellFor(trackId);
    return findOne(header, (vnode) => hasClass(vnode, 'physics-paint-track-row-grip'));
  }

  function insertionIndicator(): TestVNode | null {
    const found = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-row-insertion-indicator'));
    return found.length === 0 ? null : found[0];
  }

  function dialog(): TestVNode | null {
    const found = findAll(tree, (vnode) => vnode.type === PhysicsPaintDeleteTrackDialog);
    return found.length === 0 ? null : found[0];
  }

  function fireRegionScroll(): void {
    const regionNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-rows-region'));
    (regionNode.props['onScroll'] as () => void)();
  }

  function pill(): TestVNode | null {
    const found = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-vertical-scrollbar'));
    return found.length === 0 ? null : found[0];
  }

  return {
    render,
    callbacks,
    tree: () => tree,
    headerCell: headerCellFor,
    renameInput,
    grip,
    insertionIndicator,
    dialog,
    rowsRegion,
    band,
    column,
    fireRegionScroll,
    pill,
    flushEffects: () => runtime.flushEffects(),
  };
}

function findNode(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode {
  return findOne(root, predicate);
}

describe('physicsPaintTrackHeaderColumn (47-02 Task 1)', () => {
  it('renders every Paint track as a row plus exactly one locked Bg row at the bottom (TML-01/07)', () => {
    const fixture = makeTwoTrackFixture();
    const root = renderFixture(fixture);
    const cells = headerCells(root);
    // 2 Paint rows + exactly 1 Bg row, in document order, Bg always last.
    expect(cells).toHaveLength(3);
    expect(cells.map((cell) => cell.props['data-track-id'])).toEqual([
      fixture.trackA.id,
      fixture.trackB.id,
      fixture.background.id,
    ]);
    // Every row carries its name as the label cell text.
    for (const cell of cells) {
      const label = findOne(cell, (vnode) => hasClass(vnode, 'physics-paint-track-row-label'));
      const text = String(label.props.children);
      if (cell.props['data-track-id'] === fixture.trackA.id) expect(text).toBe('Track 1');
      if (cell.props['data-track-id'] === fixture.trackB.id) expect(text).toBe('Paint 2');
      if (cell.props['data-track-id'] === fixture.background.id) expect(text).toBe('Bg');
    }
  });

  it('marks the active track row with the accent class and moves it when activeTrackId switches (TML-03)', () => {
    const fixture = makeTwoTrackFixture();
    const rootA = renderFixture(fixture, { activeTrackId: fixture.trackA.id });
    expect(hasClass(headerCell(rootA, fixture.trackA.id), 'physics-paint-track-row-header-active')).toBe(true);
    expect(hasClass(headerCell(rootA, fixture.trackB.id), 'physics-paint-track-row-header-active')).toBe(false);

    const rootB = renderFixture(fixture, { activeTrackId: fixture.trackB.id });
    expect(hasClass(headerCell(rootB, fixture.trackA.id), 'physics-paint-track-row-header-active')).toBe(false);
    expect(hasClass(headerCell(rootB, fixture.trackB.id), 'physics-paint-track-row-header-active')).toBe(true);
  });

  it('routes hide and solo toggles to onToggleVisible/onToggleSolo and reflects the solo arm state (TML-04 surface)', () => {
    const fixture = makeTwoTrackFixture();
    const onToggleVisible = vi.fn();
    const onToggleSolo = vi.fn();
    const root = renderFixture(fixture, { onToggleVisible, onToggleSolo });
    const headerA = headerCell(root, fixture.trackA.id);

    // 47 UAT: the hide (eye) toggle is a standing row control before the name
    // (no longer inside the hover tools panel).
    const eye = findOne(headerA, (vnode) => vnode.props['aria-label'] === 'Hide Track 1');
    (eye.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onToggleVisible).toHaveBeenCalledWith(fixture.trackA.id);

    // The solo (S) toggle.
    const solo = findOne(headerA, (vnode) => hasClass(vnode, 'physics-paint-track-row-solo'));
    expect(hasClass(solo, 'physics-paint-track-row-solo-armed')).toBe(false);
    (solo.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onToggleSolo).toHaveBeenCalledWith(fixture.trackA.id);

    // The armed state reflects the module-level solo arm (D-20).
    expect(toggleSolo()).toBe(true);
    try {
      const armedRoot = renderFixture(fixture);
      const armedSolo = findOne(headerCell(armedRoot, fixture.trackA.id), (vnode) => hasClass(vnode, 'physics-paint-track-row-solo'));
      expect(hasClass(armedSolo, 'physics-paint-track-row-solo-armed')).toBe(true);
      expect(String(armedSolo.props['aria-pressed'])).toBe('true');
    } finally {
      disarmSolo();
    }
    const disarmedRoot = renderFixture(fixture);
    const disarmedSolo = findOne(headerCell(disarmedRoot, fixture.trackA.id), (vnode) => hasClass(vnode, 'physics-paint-track-row-solo'));
    expect(hasClass(disarmedSolo, 'physics-paint-track-row-solo-armed')).toBe(false);
    expect(String(disarmedSolo.props['aria-pressed'])).toBe('false');
  });

  it('renders a per-track frame-blending toggle after the eye and routes the click to onToggleBlend, arming with the row\'s own canonical interpolation state (47 UAT)', () => {
    const fixture = makeTwoTrackFixture();
    const onToggleBlend = vi.fn();
    const root = renderFixture(fixture, { onToggleBlend });
    const headerA = headerCell(root, fixture.trackA.id);

    // The blend toggle sits in the standing row controls (after the eye,
    // before the name) — disabled by default (disabled interpolation state).
    const blend = findOne(headerA, (vnode) => vnode.props['aria-label'] === 'Blend Track 1');
    expect(hasClass(blend, 'physics-paint-track-row-blend-enabled')).toBe(false);
    expect(String(blend.props['aria-pressed'])).toBe('false');
    (blend.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onToggleBlend).toHaveBeenCalledWith(fixture.trackA.id);

    // The pressed state reflects THIS row's track's canonical interpolation
    // state (T-47-04: a row never reads the active track's state). A unique
    // layer keeps the armed write out of the shared fixture layer.
    const layerId = 'header-column-blend-layer';
    try {
      physicPaintStore.setRotoPhysicalInterpolationState(layerId, fixture.trackA.id, { enabled: true, mode: 'blend' });
      const armedRoot = renderFixture({ ...fixture, layerId }, { onToggleBlend });
      const armedBlend = findOne(headerCell(armedRoot, fixture.trackA.id), (vnode) => vnode.props['aria-label'] === 'Blend Track 1');
      expect(hasClass(armedBlend, 'physics-paint-track-row-blend-enabled')).toBe(true);
      expect(String(armedBlend.props['aria-pressed'])).toBe('true');
      // Track B's row stays disarmed — the toggle is per-track, not per-layer.
      const headerB = headerCell(armedRoot, fixture.trackB.id);
      const blendB = findOne(headerB, (vnode) => vnode.props['aria-label'] === 'Blend Paint 2');
      expect(hasClass(blendB, 'physics-paint-track-row-blend-enabled')).toBe(false);
    } finally {
      physicPaintStore.setRotoPhysicalInterpolationState(layerId, fixture.trackA.id, PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED);
    }
  });

  it('truncates a long name with an ellipsis class and keeps the full name in the title tooltip (D-02)', () => {
    const fixture = makeTwoTrackFixture();
    const longName = 'A very long Paint track name that cannot fit in a 140px column at all';
    const tracks: readonly InternalPaintTrack[] = [
      { ...fixture.trackA, id: 'track-long', name: longName },
    ];
    const root = renderFixture(fixture, { tracks });
    const header = headerCell(root, 'track-long');
    const label = findOne(header, (vnode) => hasClass(vnode, 'physics-paint-track-row-label'));
    expect(hasClass(label, 'physics-paint-track-row-label-ellipsis')).toBe(true);
    expect(String(label.props.title)).toBe(longName);
  });

  it('renders the Bg row locked and muted with no hover/duplicate/delete actions (D-06)', () => {
    const fixture = makeTwoTrackFixture();
    const root = renderFixture(fixture);
    const bg = headerCell(root, fixture.background.id);
    expect(hasClass(bg, 'physics-paint-track-row-header-background')).toBe(true);
    // Lock indicator present.
    expect(findAll(bg, (vnode) => hasClass(vnode, 'physics-paint-track-row-lock'))).toHaveLength(1);
    // No hover capability: not a role=button, no click, no tools group, no
    // more-button, no reorder grab.
    expect(bg.props.role).toBeUndefined();
    expect(bg.props.onClick).toBeUndefined();
    expect(findAll(bg, (vnode) => hasClass(vnode, 'physics-paint-track-row-tools'))).toHaveLength(0);
    expect(findAll(bg, (vnode) => hasClass(vnode, 'physics-paint-track-row-tools-toggle'))).toHaveLength(0);
    expect(findAll(bg, (vnode) => hasClass(vnode, 'physics-paint-track-row-grip'))).toHaveLength(0);
  });

  it('adds a track from the column + button and exposes duplicate/delete actions per Paint row (D-07)', () => {
    const fixture = makeTwoTrackFixture();
    const onAddTrack = vi.fn();
    const onDuplicateTrack = vi.fn();
    const onRequestDeleteTrack = vi.fn();
    const onToggleTools = vi.fn();

    // The '+' add button lives in the column strip and routes through onAddTrack.
    const root = renderFixture(fixture, { onAddTrack });
    const strip = findOne(root, (vnode) => vnode.type === PhysicsPaintTrackColumnStrip);
    const addButton = findOne(expandComponent(strip), (vnode) => vnode.props['aria-label'] === 'Add track');
    (addButton.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onAddTrack).toHaveBeenCalledTimes(1);

    // The tools panel opens only from the more-button (47-01 UAT round 6) and
    // exposes the duplicate + delete actions for that row.
    const rootClosed = renderFixture(fixture, { onToggleTools });
    const more = findOne(headerCell(rootClosed, fixture.trackA.id), (vnode) => hasClass(vnode, 'physics-paint-track-row-tools-toggle'));
    (more.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onToggleTools).toHaveBeenCalledWith(fixture.trackA.id);

    const rootOpen = renderFixture(fixture, {
      toolsOpenTrackId: fixture.trackA.id,
      onDuplicateTrack,
      onRequestDeleteTrack,
    });
    const headerA = headerCell(rootOpen, fixture.trackA.id);
    const duplicate = findOne(headerA, (vnode) => vnode.props['aria-label'] === 'Duplicate Track 1');
    (duplicate.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onDuplicateTrack).toHaveBeenCalledWith(fixture.trackA.id);
    const trash = findOne(headerA, (vnode) => vnode.props['aria-label'] === 'Delete Track 1');
    // Two Paint rows exist, so the row is deletable — no disabled guard.
    expect(trash.props['aria-disabled']).toBeUndefined();
    (trash.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onRequestDeleteTrack).toHaveBeenCalledWith(fixture.trackA.id);
  });
});

describe('physicsPaintTrackHeaderColumn track CRUD interactions (47-02 Task 2)', () => {
  it('opens rename in place on double-click and commits fail-closed: empty/whitespace/control/over-length rejected with no store call, valid name committed once (TML-02/ASVS V5)', () => {
    const fixture = makeRegisteredFixture();
    const onRenameTrack = vi.fn();
    const publishStatus = vi.fn();
    const harness = createStripHarness({ fixture, onRenameTrack, publishStatus });
    harness.render();

    // A double-click on the row header opens the edit field.
    (harness.headerCell(fixture.trackA.id).props.onDblClick as () => void)();
    harness.render();
    expect(harness.renameInput()).toBeDefined();

    // Empty, whitespace-only, control-character, and over-length drafts are
    // rejected fail-closed: the editor closes, the store intent never fires,
    // and the rejection reaches the status channel.
    const rejections = ['', '   ', '\u0007bad', 'x'.repeat(65)];
    for (const badValue of rejections) {
      (harness.headerCell(fixture.trackA.id).props.onDblClick as () => void)();
      harness.render();
      const input = harness.renameInput();
      (input.props['oninput'] as (event: unknown) => void)({ target: { value: badValue } });
      harness.render();
      // Re-find the input AFTER the draft render: the Enter handler lives on
      // the freshly rendered vnode, whose onCommitRename closure reads the
      // NEW draft (the stale pre-draft input would commit the old value).
      const inputWithDraft = harness.renameInput();
      (inputWithDraft.props.onKeyDown as (event: unknown) => void)({
        key: 'Enter',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      });
      harness.render();
      const inputs = findAll(harness.tree(), (vnode) => hasClass(vnode, 'physics-paint-track-rename-input'));
      expect(inputs).toHaveLength(0);
    }
    expect(onRenameTrack).not.toHaveBeenCalled();
    expect(publishStatus).toHaveBeenCalledTimes(rejections.length);

    // A valid draft commits exactly once, trimmed.
    (harness.headerCell(fixture.trackA.id).props.onDblClick as () => void)();
    harness.render();
    const input = harness.renameInput();
    (input.props['oninput'] as (props: unknown) => void)({ target: { value: '  New Name  ' } });
    harness.render();
    const inputWithDraft = harness.renameInput();
    (inputWithDraft.props.onKeyDown as (event: unknown) => void)({
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(onRenameTrack).toHaveBeenCalledTimes(1);
    expect(onRenameTrack).toHaveBeenCalledWith(fixture.trackA.id, 'New Name');
    expect(publishStatus).toHaveBeenCalledTimes(rejections.length);
  });

  it('routes the duplicate intent once from the row tools (TML-02/D-09)', () => {
    const fixture = makeRegisteredFixture();
    const onDuplicateTrack = vi.fn();
    const harness = createStripHarness({ fixture, onDuplicateTrack });
    harness.render();

    const duplicate = findNode(harness.headerCell(fixture.trackA.id), (vnode) => vnode.props['aria-label'] === 'Duplicate Track 1');
    (duplicate.props.onClick as (event: unknown) => void)(clickEvent());
    expect(onDuplicateTrack).toHaveBeenCalledTimes(1);
    expect(onDuplicateTrack).toHaveBeenCalledWith(fixture.trackA.id);
  });

  it('opens the acknowledge-and-delete dialog via requestDeleteTrack and confirms with commitDeleteTrack(layerId, trackId, true) once (D-17)', () => {
    const fixture = makeRegisteredFixture();
    const commitSpy = vi.spyOn(efxPaintStoreModule, 'commitDeleteTrack');
    const harness = createStripHarness({ fixture });
    harness.render();

    const trash = findNode(harness.headerCell(fixture.trackA.id), (vnode) => vnode.props['aria-label'] === 'Delete Track 1');
    (trash.props.onClick as (event: unknown) => void)(clickEvent());
    harness.render();

    // The dialog opens with the requestDeleteTrack preview (frame count, loop
    // clip count, Hold reference count) and the track name.
    const dialog = harness.dialog();
    expect(dialog).not.toBeNull();
    expect(dialog!.props.layerId).toBe(fixture.layerId);
    expect(dialog!.props.trackName).toBe('Track 1');
    const preview = dialog!.props.preview as TrackDeletePreview;
    expect(preview.trackId).toBe(fixture.trackA.id);
    expect(preview.isLastTrack).toBe(false);

    const expanded = expandComponent(dialog!);
    const title = findNode(expanded, (vnode) => hasClass(vnode, 'physics-paint-delete-track-dialog-title'));
    // JSX `Delete track {trackName}?` splits into a children array — join the
    // pieces before comparing so the copy reads naturally.
    const titleChildren = Array.isArray(title.props.children) ? title.props.children : [title.props.children];
    expect(titleChildren.join('')).toBe('Delete track Track 1?');
    const detail = findNode(expanded, (vnode) => hasClass(vnode, 'physics-paint-delete-track-dialog-detail'));
    const detailText = String(detail.props.children);
    expect(detailText).toContain('0 frames');
    expect(detailText).toContain('0 loop clips');
    expect(detailText).toContain('0 Hold references');

    // Confirm commits exactly once with the explicit acknowledgement.
    const confirm = findNode(expanded, (vnode) => hasClass(vnode, 'physics-paint-delete-track-confirm'));
    (confirm.props.onClick as () => void)();
    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(commitSpy).toHaveBeenCalledWith(fixture.layerId, fixture.trackA.id, true);

    // The strip closes the dialog after the acknowledged commit.
    harness.render();
    expect(harness.dialog()).toBeNull();
  });

  it('refuses the last-track delete: disabled Confirm, refusal message, never calls commitDeleteTrack (D-17)', () => {
    const layerId = 'last-track-layer';
    const document = createEfxPaintDocument(layerId);
    registerDocument(document);
    const onlyTrack = document.tracks[0];
    const preview = requestDeleteTrack(layerId, onlyTrack.id);
    expect(preview).not.toBeNull();
    expect(preview!.isLastTrack).toBe(true);

    const commitSpy = vi.spyOn(efxPaintStoreModule, 'commitDeleteTrack');
    const root = PhysicsPaintDeleteTrackDialog({
      layerId,
      trackName: onlyTrack.name,
      preview: preview!,
      onCancel: vi.fn(),
    });

    const refusal = findNode(root, (vnode) => hasClass(vnode, 'physics-paint-delete-track-dialog-refusal'));
    expect(String(refusal.props.children)).toBe('At least one Paint track is required.');
    const confirm = findNode(root, (vnode) => hasClass(vnode, 'physics-paint-delete-track-confirm'));
    expect(confirm.props.disabled).toBe(true);
    expect(confirm.props['aria-disabled']).toBe('true');
    (confirm.props.onClick as () => void)();
    expect(commitSpy).not.toHaveBeenCalled();
    // The document is byte-unchanged.
    expect(getDocument(layerId)!.tracks.map((track) => track.id)).toEqual([onlyTrack.id]);
  });

  it('cancels the delete dialog without committing (Phase 46 D-14)', () => {
    const fixture = makeRegisteredFixture();
    const onCancel = vi.fn();
    const preview: TrackDeletePreview = {
      layerId: fixture.layerId,
      trackId: fixture.trackA.id,
      frameCount: 12,
      loopClipCount: 2,
      holdReferenceCount: 1,
      isLastTrack: false,
    };
    const commitSpy = vi.spyOn(efxPaintStoreModule, 'commitDeleteTrack');
    const root = PhysicsPaintDeleteTrackDialog({
      layerId: fixture.layerId,
      trackName: 'Track 1',
      preview,
      onCancel,
    });

    const cancel = findNode(root, (vnode) => hasClass(vnode, 'physics-paint-delete-track-cancel'));
    (cancel.props.onClick as () => void)();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('computes the reorder insertion index from the pointer Y, renders the indicator, and commits onReorderTrack once with a numeric order only (TML-05/D-08)', () => {
    const fixture = makeRegisteredFixture();
    const onReorderTrack = vi.fn();
    const harness = createStripHarness({ fixture, onReorderTrack });
    harness.render();

    // Pointerdown on the grab area starts the session (band top = 100px;
    // clientY 115 → index 0).
    const grip = harness.grip(fixture.trackA.id);
    const dragTarget = createDragTarget();
    (grip.props.onPointerDown as (event: unknown) => void)({
      clientY: 115,
      pointerId: 1,
      currentTarget: dragTarget,
      preventDefault: vi.fn(),
    });
    harness.render();
    expect(dragTarget.setPointerCapture).toHaveBeenCalledWith(1);
    const indicator = harness.insertionIndicator();
    expect(indicator).not.toBeNull();
    expect(indicator!.props['data-insertion-index']).toBe(0);

    // Moving the pointer updates the live indicator (clientY 145 → index 1).
    dragTarget.fire('pointermove', { clientY: 145 });
    harness.render();
    expect(harness.insertionIndicator()!.props['data-insertion-index']).toBe(1);

    // Release commits exactly once with the same trackId and the clamped
    // numeric order (clientY 400 → raw 10 → clamp 1), never rewriting ids.
    dragTarget.fire('pointerup', { clientY: 400, pointerId: 1 });
    expect(onReorderTrack).toHaveBeenCalledTimes(1);
    expect(onReorderTrack).toHaveBeenCalledWith(fixture.trackA.id, 1);
    harness.render();
    expect(harness.insertionIndicator()).toBeNull();
  });
});

describe('physicsPaintTrackHeaderColumn vertical scroll + ensure-active-row (47-02 Task 3)', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('computeEnsureRowScrollDelta returns a positive delta below, negative above, and 0 when fully visible (TML-03/D-05)', () => {
    // Active row BELOW the viewport → scroll DOWN (positive delta), aligning
    // the row's bottom with the viewport's bottom.
    expect(computeEnsureRowScrollDelta(180, 210, 60, 150)).toBe(60);
    // Active row ABOVE the viewport → scroll UP (negative delta), aligning
    // the row's top with the viewport's top.
    expect(computeEnsureRowScrollDelta(20, 50, 60, 150)).toBe(-40);
    // Fully visible → no scroll.
    expect(computeEnsureRowScrollDelta(70, 140, 60, 150)).toBe(0);
    // Exactly touching the boundaries still counts as fully visible.
    expect(computeEnsureRowScrollDelta(60, 150, 60, 150)).toBe(0);
    expect(computeEnsureRowScrollDelta(90, 150, 60, 150)).toBe(0);
  });

  it('clamps a row taller than the viewport so its top aligns with the viewport top (D-05 edge)', () => {
    // Row 180px tall in a 30px viewport: the delta always aligns the row's
    // top with the viewport's top — never scrolls past the row's own top.
    expect(computeEnsureRowScrollDelta(30, 210, 60, 90)).toBe(-30);
    expect(computeEnsureRowScrollDelta(180, 360, 0, 90)).toBe(180);
    expect(computeEnsureRowScrollDelta(0, 180, 30, 60)).toBe(-30);
  });

  it('renders the vertical pill scrollbar on rows-region overflow and none when the rows fit (TML-01)', () => {
    const fixture = makeRegisteredFixture();
    const harness = createStripHarness({ fixture });
    harness.render();

    // Overflow (90px viewport, 300px content): the region's scroll handler
    // derives the pill and a re-render shows it in the pinned column.
    harness.fireRegionScroll();
    harness.render();
    const pill = harness.pill();
    expect(pill).not.toBeNull();
    const thumb = findOne(pill!, (vnode) => hasClass(vnode, 'physics-paint-vertical-scrollbar-thumb'));
    expect(thumb.props.style).toMatchObject({ height: '40px' });

    // Dragging the pill scrolls the rows-region (thumb geometry: clientHeight
    // 90 → thumbHeight 40, thumbRange 50, maxScroll 300 - 90 = 210). The
    // pill's rect spans the 90px column height — NOT the default 30px
    // row-height rect. Pointerdown grabs the thumb at clientY 20 (offset 20),
    // then a move to clientY 60 drags it to y=40 → scrollTop (40/50)*210 = 168.
    const target = createDragTarget({ top: 0, left: 140, width: 14, height: 90 });
    (pill!.props['onPointerDown'] as (event: unknown) => void)({
      currentTarget: target,
      pointerId: 7,
      clientY: 20,
    });
    expect(harness.rowsRegion.scrollTop).toBe(0);
    target.fire('pointermove', { pointerId: 7, clientY: 60 });
    expect(harness.rowsRegion.scrollTop).toBe(168);

    // No overflow → no pill, and the rows region does not scroll.
    harness.rowsRegion.clientHeight = 300;
    harness.rowsRegion.scrollTop = 0;
    harness.fireRegionScroll();
    harness.render();
    expect(harness.pill()).toBeNull();
  });

  it('keeps the header column pinned: the band follows the rows region 1:1 while the column scrollTop stays 0 (D-01/D-05)', () => {
    const fixture = makeRegisteredFixture();
    const harness = createStripHarness({ fixture });
    harness.render();

    // A user vertical scroll advances the rows region; the header-rows band
    // mirrors it exactly so every header label stays aligned with its row.
    harness.rowsRegion.scrollTop = 120;
    harness.fireRegionScroll();
    expect(harness.rowsRegion.scrollTop).toBe(120);
    expect(harness.band.scrollTop).toBe(120);
    // The pinned column element itself never scrolls.
    expect(harness.column.scrollTop).toBe(0);
  });

  it('scrolls the rows region so the active row enters view when activeTrackId changes (TML-03/D-05 effect leg)', () => {
    const fixture = makeRegisteredFixture();
    const harness = createStripHarness({ fixture });
    harness.render();

    // Mount: the active row (Track A, content 120..150) sits below the
    // 0..90 viewport → the effect scrolls 60px down on first render.
    expect(harness.rowsRegion.scrollTop).toBe(0);
    harness.flushEffects();
    expect(harness.rowsRegion.scrollTop).toBe(60);

    // Switching the active track to Track B (content 240..270) re-runs the
    // effect: the row is still below the 60..150 viewport → scroll to 180.
    harness.render({ activeTrackId: fixture.trackB.id });
    harness.flushEffects();
    expect(harness.rowsRegion.scrollTop).toBe(180);

    // Switching back to Track A (content 120..150, ABOVE the 180..270
    // viewport) scrolls back up so the row's top re-enters view.
    harness.render({ activeTrackId: fixture.trackA.id });
    harness.flushEffects();
    expect(harness.rowsRegion.scrollTop).toBe(120);
  });
});
