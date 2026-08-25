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
import { describe, expect, it, vi } from 'vitest';
import type { ComponentChildren } from 'preact';
import type { PreactHookRuntime } from '../../../test/preactHookRuntime';
import type { EfxPaintDocument, BackgroundTrack, InternalPaintTrack } from '../../../efx-paint/document/efxPaintDocument';
import type { TrackDeletePreview } from '../../../stores/efxPaintStore';
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
import { PhysicsPaintWorkflowStrip } from './PhysicsPaintWorkflowStrip';
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
 *  those vnodes by calling the component function directly. */
function expandComponent(vnode: TestVNode): TestVNode {
  if (vnode.type === PhysicsPaintTrackRowHeader || vnode.type === PhysicsPaintTrackColumnStrip) {
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
  tracks: readonly InternalPaintTrack[];
  activeTrackId: string;
  background: BackgroundTrack;
  trackA: InternalPaintTrack;
  trackB: InternalPaintTrack;
}

function makeTwoTrackFixture(): ColumnFixture {
  const document = createEfxPaintDocument('header-column-layer');
  const trackA = document.tracks[0];
  const trackB: InternalPaintTrack = { ...trackA, id: 'track-b', name: 'Paint 2', order: 1 };
  return {
    tracks: [trackA, trackB],
    activeTrackId: trackA.id,
    background: document.background,
    trackA,
    trackB,
  };
}

interface ColumnRenderOptions {
  readonly tracks: readonly InternalPaintTrack[];
  readonly activeTrackId: string;
  readonly background: BackgroundTrack | null;
  readonly onSelectTrack?: (trackId: string) => void;
  readonly onToggleVisible?: (trackId: string) => void;
  readonly onToggleSolo?: (trackId: string) => void;
  readonly onAddTrack?: () => void;
  readonly onDuplicateTrack?: (trackId: string) => void;
  readonly onRequestDeleteTrack?: (trackId: string) => void;
  readonly toolsOpenTrackId?: string | null;
  readonly onToggleTools?: (trackId: string) => void;
}

function renderColumn(options: ColumnRenderOptions): TestVNode {
  return physicsPaintTrackHeaderColumn({
    tracks: options.tracks,
    activeTrackId: options.activeTrackId,
    background: options.background,
    onSelectTrack: options.onSelectTrack ?? vi.fn(),
    onToggleVisible: options.onToggleVisible ?? vi.fn(),
    onToggleSolo: options.onToggleSolo ?? vi.fn(),
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

/** A pointer-capture drag target that records the strip's session listeners. */
function createDragTarget() {
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
    getBoundingClientRect: vi.fn(() => ({ top: 0, left: 0, width: 140, height: 30 })),
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
  registerDocument(layerId, twoTrackDocument);
  return { layerId, document: twoTrackDocument, trackA, trackB, background: document.background };
}

interface StripHarnessOptions {
  readonly fixture: RegisteredFixture;
  readonly onToggleTrackVisible?: (trackId: string, visible: boolean) => void;
  readonly onToggleSolo?: (trackId: string, solo: boolean) => void;
  readonly onRenameTrack?: (trackId: string, name: string) => void;
  readonly onDuplicateTrack?: (trackId: string) => void;
  readonly onReorderTrack?: (trackId: string, newOrder: number) => void;
  readonly publishStatus?: (message: string | null) => void;
}

/**
 * Strip-level harness for the CRUD interactions (47-02 Task 2): renders the
 * real `PhysicsPaintWorkflowStrip` with a registered two-track bundle and
 * spy intents, then expands the header-column vnode so the tests can reach the
 * row headers, the rename input, the insertion indicator, and the delete
 * dialog. The strip's `rotoPhysicalActions` channel carries a capture spy so
 * rejections are observable.
 */
function createStripHarness(options: StripHarnessOptions) {
  const runtime = runtimeHolder.current;
  if (!runtime) throw new Error('Expected the Preact hook runtime mock.');
  runtime.reset();
  const { fixture } = options;
  const scroller = createScroller(47 * 18);
  const content = {};
  const band = createHeaderBand();
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

  function render(): unknown {
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
      rotoPhysicalActions: { publishStatus: callbacks.publishStatus },
      tracks: fixture.document.tracks,
      activeTrackId: fixture.trackA.id,
      layerId: fixture.layerId,
      background: fixture.background,
      onSelectTrack: callbacks.onSelectTrack,
      onToggleTrackVisible: callbacks.onToggleTrackVisible,
      onToggleSolo: callbacks.onToggleSolo,
      onRenameTrack: callbacks.onRenameTrack,
      onDuplicateTrack: callbacks.onDuplicateTrack,
      onReorderTrack: callbacks.onReorderTrack,
    });
    tree = expandHeaderColumnVnodes(tree);

    const scrollerNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-timeline-scroll'));
    const contentNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-lane'));
    assignRef(scrollerNode.ref ?? scrollerNode.props.ref, scroller);
    assignRef(contentNode.ref ?? contentNode.props.ref, content);
    const headerRowsNode = findOne(tree, (vnode) => hasClass(vnode, 'physics-paint-header-rows'));
    assignRef(headerRowsNode.ref ?? headerRowsNode.props.ref, band);
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

  return { render, callbacks, tree: () => tree, headerCell: headerCellFor, renameInput, grip, insertionIndicator, dialog };
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

    // The hide (eye) toggle lives in the row's tools group.
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
      (input.props.onInput as (event: unknown) => void)({ target: { value: badValue } });
      harness.render();
      (input.props.onKeyDown as (event: unknown) => void)({
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
    (input.props.onInput as (props: unknown) => void)({ target: { value: '  New Name  ' } });
    harness.render();
    (input.props.onKeyDown as (event: unknown) => void)({
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
    expect(dialog!.props.preview.trackId).toBe(fixture.trackA.id);
    expect(dialog!.props.preview.isLastTrack).toBe(false);

    const expanded = expandComponent(dialog!);
    const title = findNode(expanded, (vnode) => hasClass(vnode, 'physics-paint-delete-track-dialog-title'));
    expect(String(title.props.children)).toBe('Delete track Track 1?');
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
    registerDocument(layerId, document);
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
