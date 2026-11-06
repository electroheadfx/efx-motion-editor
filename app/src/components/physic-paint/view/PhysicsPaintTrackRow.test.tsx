/**
 * 47 close-out cross-track UAT fixes:
 * - Always-on rail lines: every non-active Paint row renders its own Key Rail
 *   segments as read-only bars (the rail line no longer waits for the track to
 *   be selected / the rich-lane swap).
 * - Ghost-key fix: the row subscribes to ITS OWN track revision signal
 *   (getTrackRotorRevision) — a store bump to the track re-renders the row with
 *   fresh store reads, so a cross-track move's removal half updates the source
 *   row immediately instead of waiting for the Studio's 150ms chrome throttle.
 *
 * Render tests materialize the vnode tree (no DOM environment — same pattern as
 * PhysicsPaintKeyRail.test.tsx); the subscription and CSS contracts are
 * source/CSS reads like the strip's contract tests.
 */
import { testWebpBytes } from '../../../testUtils/testWebpBytes';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PhysicsPaintTrackColumnStrip,
  PhysicsPaintTrackRow,
  PhysicsPaintTrackRowHeader,
  railMotionExpandedSelection,
  resolveMotionBlockExpanded,
  resolveMotionChevronKind,
  resolveMotionRecordForRail,
  resolveRailMotionHasKeys,
  resolveSelectedRailMotionId,
  resolveTrackMotionLaneCount,
  toggleRailMotionExpansion,
} from './PhysicsPaintTrackRow';
import type { PhysicPaintRotoRailMotionChannelId, PhysicPaintRotoRailMotionRecord } from '../roto/railMotionModel';
import type { RailMotionRailView } from '../roto/railMotionIdentity';
import type { RailSetIdentity } from '../roto/physicsPaintRotoRailSetSelection';
import {
  clearPhysicsPaintPerformance,
  snapshotPhysicsPaintPerformance,
} from '../performance/physicsPaintPerformanceTrace';
import {
  _setPhysicPaintMarkDirtyCallback,
  physicPaintStore,
} from '../../../stores/physicPaintStore';
import { deriveEfxPaintBackgroundResolution } from '../../../efx-paint/compositor/efxPaintBackgroundResolution';
import type { BackgroundTrack } from '../../../efx-paint/document/efxPaintDocument';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';

// The Bg clip rail target uses the styled-tooltip hook and useRef; the render
// tests materialize the vnode tree as plain function calls (no DOM/hook
// context), so the hook, its portal host, and useRef are stubbed to inert
// values.
vi.mock('./PhysicsPaintStyledTooltip', () => ({
  useStyledTooltip: () => ({
    visible: false,
    onPointerEnter: () => {},
    onPointerLeave: () => {},
    onFocus: () => {},
    onBlur: () => {},
    hide: () => {},
  }),
  PhysicsPaintStyledTooltip: () => null,
}));
vi.mock('preact/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact/hooks')>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
  };
});

const LAYER = 'layer-track-row-uat';
const TRACK = 'track-row-uat-a';
const CAPACITY = 24;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

const makeFrame = (appFrame: number, tag: string) => ({
  frameIndex: 0,
  appFrame,
  bytes: testWebpBytes(btoa(tag)),
  width: 4,
  height: 4,
});

const makePayload = (appFrame: number, tag: string): PhysicPaintRotoRealKeyPayload => ({
  frameIndex: 0,
  appFrame,
  bytes: testWebpBytes(btoa(tag)),
  width: 4,
  height: 4,
});

const makeRecord = (keyId: string, appFrame: number, tag: string): PhysicPaintRotoRealKeyRecord => ({
  kind: 'real-key',
  keyId,
  appFrame,
  payload: makePayload(appFrame, tag),
});

function seedTrack(trackId: string, records: readonly PhysicPaintRotoRealKeyRecord[]): void {
  const seeded = physicPaintStore.replaceRotoPhysicalRecords(LAYER, trackId, records, INTERPOLATION, CAPACITY);
  if (!seeded.ok) throw new Error(`Seed failed for ${trackId}: ${seeded.error}`);
  for (const record of records) {
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, trackId, record.appFrame, makeFrame(record.appFrame, `frame-${record.keyId}`));
  }
}

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

function childrenOf(node: TestVNode): unknown[] {
  const children = node.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
}

function materialize(node: unknown): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map(materialize);
  if (typeof node !== 'object') return node;
  const vnode = node as TestVNode;
  if (typeof vnode.type === 'function') {
    // Preact 11 + lucide-preact 1.57: icon components call useContext and cannot
    // be invoked outside a hook dispatcher. Keep them as opaque leaves.
    try {
      return materialize(vnode.type(vnode.props));
    } catch {
      return vnode;
    }
  }
  return {
    ...vnode,
    props: {
      ...vnode.props,
      children: childrenOf(vnode).map(materialize),
    },
  } as TestVNode;
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

function hasClass(vnode: TestVNode, name: string): boolean {
  return String(vnode.props.class ?? vnode.props.className ?? '').split(/\s+/).includes(name);
}

const rowSourcePath = fileURLToPath(new URL('./PhysicsPaintTrackRow.tsx', import.meta.url));
const rowSource = () => readFileSync(rowSourcePath, 'utf8');
const cssPath = fileURLToPath(new URL('../physicsPaintStudio.css', import.meta.url));
const css = () => readFileSync(cssPath, 'utf8');

function cssRule(selector: string): string {
  const source = css();
  const start = source.indexOf(selector);
  expect(start, `CSS rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('}', start);
  return source.slice(start, end === -1 ? source.length : end + 1);
}

const FRAME_CELLS = Array.from({ length: CAPACITY }, (_, frame) => frame);

function render(overrides: Partial<Parameters<typeof PhysicsPaintTrackRow>[0]> = {}) {
  return materialize(PhysicsPaintTrackRow({
    trackId: TRACK,
    layerId: LAYER,
    frameCells: FRAME_CELLS,
    ...overrides,
  }));
}

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
});

describe('PhysicsPaintTrackRow — 47 close-out cross-track UAT', () => {
  it('subscribes to ITS OWN track revision signal (the ghost-key fix seam)', () => {
    // The narrow per-track subscription is what makes the source row refresh
    // immediately after a cross-track move's removal half — without it the row
    // only re-renders when the Studio's 150ms throttled chrome re-renders.
    const body = rowSource();
    expect(body).toMatch(/getTrackRotorRevision\(layerId,\s*trackId\)\.value/);
  });

  it('renders always-on read-only rails from THIS track records with the active lane shared classes', () => {
    seedTrack(TRACK, [
      makeRecord('k0', 2, 'a@2'),
      makeRecord('k1', 5, 'a@5'),
    ]);
    const tree = render();
    const rails = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-row-rail'));
    expect(rails).toHaveLength(1);
    // Segment spans frames 2..5 inclusive → left 2×18, width 4×18 − 2 (v7's
    // 2px rail-end inset so the next segment never abuts this one).
    expect(rails[0].props.style).toMatchObject({ left: '36px', width: '70px' });
    // The shared active-lane classes carry the visuals (caps, cell edges,
    // colors) — pixel-identical rails on every track.
    expect(String(rails[0].props.class)).toContain('physics-paint-rail-target');
    expect(String(rails[0].props.class)).toContain('boundary-start');
    expect(findAll(rails[0], (vnode) => hasClass(vnode, 'physics-paint-key-rail-segment'))).toHaveLength(1);
  });

  it('re-renders fresh store state per render: removing the moved rail drops the line and empties the cells', () => {
    seedTrack(TRACK, [
      makeRecord('k0', 2, 'a@2'),
      makeRecord('k1', 5, 'a@5'),
    ]);
    expect(findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-track-row-rail'))).toHaveLength(1);

    // The cross-track move's removal half: records replaced without the moved
    // keys, runtime bytes removed — then the row re-renders (its revision
    // signal bumped) and must show the post-move state, never ghosts.
    const removed = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK, [], INTERPOLATION, CAPACITY);
    if (!removed.ok) throw new Error(`removal must resolve: ${removed.error}`);
    physicPaintStore.removeRealRotoKeyFrame(LAYER, TRACK, 2);
    physicPaintStore.removeRealRotoKeyFrame(LAYER, TRACK, 5);

    const tree = render();
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-row-rail'))).toHaveLength(0);
    const cachedCells = findAll(tree, (vnode) => hasClass(vnode, 'roto-fill-cached'));
    expect(cachedCells).toHaveLength(0);
  });

  it('renders motion and static Loop Clip rails with the shared family colors (UAT round 3)', () => {
    physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK, [
      makeRecord('k0', 0, 'a@0'),
      makeRecord('k1', 2, 'a@2'),
    ], INTERPOLATION, CAPACITY);
    const motion = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK, [{
      loopId: 'loop-motion',
      placementStart: 6,
      sourceKeyIds: ['k0', 'k1'],
      repeat: 3,
      mode: 'progressive',
      // 261031-vbo (Quick C1): a typed fixture keeps its all-or-nothing
      // provenance — a provenance-free clip is now a merged Standard Rail.
      scriptId: 'script-1',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
    }]);
    if (!motion.ok) throw new Error(`motion loop seed failed: ${motion.error}`);
    const motionLine = findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(motionLine).toHaveLength(1);
    expect(String(motionLine[0].props.class)).toContain('mode-progressive');
    // v2.0.1 v7: the per-mode family colors collapsed into the shared palette
    // variable on the base segment rule — motion and static now paint from
    // --rail-line, exactly like the active lane's loop rails.
    expect(cssRule('.physics-paint-loop-clip-rail-segment {')).toContain('background: var(--rail-line, #6C8A35)');
    expect(css()).not.toContain('.physics-paint-loop-clip-rail-target.mode-static .physics-paint-loop-clip-rail-segment {');
    expect(css().toLowerCase()).not.toContain('#06b6d4');

    const staticClip = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK, [{
      loopId: 'loop-static',
      placementStart: 6,
      sourceKeyIds: ['k0', 'k1'],
      repeat: 1,
      mode: 'static',
      scriptId: 'script-1',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
    }]);
    if (!staticClip.ok) throw new Error(`static loop seed failed: ${staticClip.error}`);
    const staticLine = findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(staticLine).toHaveLength(1);
    expect(String(staticLine[0].props.class)).toContain('mode-static');
    expect(String(staticLine[0].props.class)).not.toContain('rail-kind-standard');
  });

  it('renders a merged Standard Rail gray and labelled Standard on a non-active row (261031-vbo)', () => {
    physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK, [
      makeRecord('k0', 0, 'a@0'),
      makeRecord('k1', 2, 'a@2'),
    ], INTERPOLATION, CAPACITY);
    const seeded = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK, [{
      loopId: 'loop-merged',
      placementStart: 6,
      sourceKeyIds: ['k0', 'k1'],
      repeat: 3,
      mode: 'progressive',
    }]);
    if (!seeded.ok) throw new Error(`merged loop seed failed: ${seeded.error}`);
    const line = findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(line).toHaveLength(1);
    const className = String(line[0]!.props.class);
    expect(className).toContain('rail-kind-standard');
    expect(className).toContain('mode-progressive');
    expect(className).not.toContain('rail-kind-reveal');
    expect(String(line[0]!.props['aria-label'])).toContain('Standard rail at frame ');
    // v2.0.1 v7: the merged Standard Rail no longer forks a gray rule — it
    // paints from the shared base segment rule (the palette variable) exactly
    // like the active lane's loop rails.
    expect(cssRule('.physics-paint-loop-clip-rail-segment {')).toContain('background: var(--rail-line, #6C8A35)');
    expect(css().toLowerCase()).not.toContain('rail-kind-standard.mode-progressive .physics-paint-loop-clip-rail-segment');
  });

  it('renders no in-line lifecycle status dot on non-active rows (AM-2: the status lives in the tooltip)', () => {
    physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK, [
      makeRecord('k0', 0, 'a@0'),
      makeRecord('k1', 2, 'a@2'),
    ], INTERPOLATION, CAPACITY);
    const seeded = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK, [{
      loopId: 'loop-unavailable',
      placementStart: 6,
      sourceKeyIds: ['k0', 'k1'],
      repeat: 3,
      mode: 'progressive',
    }]);
    if (!seeded.ok) throw new Error(`loop seed failed: ${seeded.error}`);
    const line = findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(line).toHaveLength(1);
    const dot = findAll(line[0], (vnode) => hasClass(vnode, 'physics-paint-loop-clip-lifecycle-dot'));
    expect(dot).toHaveLength(0);
  });

  it('49-06 UAT round 4: the Bg cells carry vertical separators, the rail line is the move handle, and the markers signal ew-resize', () => {
    // The separator is an inset line on every cell except the first — the
    // group-of-cells read (box-shadow, never border, so the flex box model
    // stays intact).
    expect(cssRule('.physics-paint-bg-clip-cell:not(:first-child) {')).toContain('box-shadow: inset 1px 0 0 0 rgba(0, 0, 0, 0.28)');
    // The rail LINE is the whole-rail move handle (grab cursor) — exactly like
    // the track's Key Rail graphic line.
    expect(cssRule('.physics-paint-bg-clip-rail-line {')).toContain('cursor: grab');
    expect(cssRule('.physics-paint-bg-clip-rail-line::before {')).toContain('height: 4px');
    // v2.0.1 v7: the line sits flush at the row top in the 6px band — the
    // SAME position as the track Key Rail segment and every other rail
    // family, so all rails share one baseline. The pseudo-element pins
    // left/right too or its auto width collapses to 0px.
    expect(cssRule('.physics-paint-bg-clip-rail-line::before {')).toContain('inset: 0 0 auto 0');
    // 49-06 (UAT round 7): the RESTING line is #195991; v7 retires the orange
    // selected line for the brighter Bg blue (#3F8FD0), matching the rail
    // palette law. The rail's own line does NOT change during a move/resize —
    // only the drag/resize GHOST is a white line drawn on top of it.
    expect(cssRule('.physics-paint-bg-clip-rail-line::before {')).toContain('background: #195991');
    expect(cssRule('.physics-paint-bg-clip-rail-anchor .physics-paint-bg-clip-rail-line.selected::before {')).toContain('background: #3F8FD0');
    expect(cssRule('.physics-paint-bg-clip-rail-ghost {')).toContain('background: #f8fafc');
    expect(cssRule('.physics-paint-bg-clip-rail-ghost {')).toContain('z-index: 4');
    // The START/END markers are the resize handles (ew-resize cursor) — the
    // element IS the 2px x 4px #f8fafc cap (the track's shared boundary cap,
    // no extra rectangle), anchored to the line's outer edges flush at the row
    // top (v7: the same `top: 0` baseline as every rail family).
    expect(cssRule('.physics-paint-bg-clip-rail-marker {')).toContain('cursor: ew-resize');
    expect(cssRule('.physics-paint-bg-clip-rail-marker {')).toContain('background: #f8fafc');
    expect(cssRule('.physics-paint-bg-clip-rail-marker {')).toContain('top: 0');
    expect(cssRule('.physics-paint-bg-clip-rail-marker-start {')).toContain('left: 0');
    expect(cssRule('.physics-paint-bg-clip-rail-marker-end {')).toContain('right: 0');
    // 49-06 (UAT round 6): the clip's START/END full-height #f8fafc cell edges —
    // the same boundary-cell treatment as the track Key Rail, so two adjacent
    // Bg clips stay as distinguishable as two track rails.
    expect(cssRule('.physics-paint-bg-clip-cells::before {')).toContain('background: #f8fafc');
    expect(cssRule('.physics-paint-bg-clip-cells::after {')).toContain('background: #f8fafc');
  });

  it('keeps the rails one-click selectable and the background row rail-free', () => {
    // UAT round 5: the band is clickable (select rail + activate track) with
    // the select cursor; cells carry the select cursor too.
    expect(cssRule('.physics-paint-track-row-rail {')).toContain('cursor: pointer');
    // v2.0.1 v7: the rail band is 6px (the 4px rail line plus its 2px gap
    // before the 22px cells below).
    expect(cssRule('.physics-paint-track-row-rail {')).toContain('height: 6px');
    expect(cssRule('.physics-paint-track-row:not(.physics-paint-track-row-background) {')).toContain('cursor: pointer');

    physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK, [makeRecord('k0', 2, 'a@2')], INTERPOLATION, CAPACITY);
    const backgroundTree = render({ trackId: 'bg-row', kind: 'background' });
    expect(findAll(backgroundTree, (vnode) => hasClass(vnode, 'physics-paint-track-row-rail'))).toHaveLength(0);
  });

  it('fires the one-click frame selection intent with the clicked frame (UAT round 5)', () => {
    const onSelectTrackFrame = vi.fn();
    const tree = PhysicsPaintTrackRow({
      trackId: TRACK,
      layerId: LAYER,
      frameCells: FRAME_CELLS,
      onSelectTrackFrame,
    }) as TestVNode;
    const row = findAll(materialize(tree), (vnode) => hasClass(vnode, 'physics-paint-track-row'))[0];
    const rowProps = row.props as { onClick: (event: MouseEvent) => void };
    const clickEvent = (target: unknown) => ({ target, stopPropagation: vi.fn() }) as unknown as MouseEvent;
    // No clicked cell (header-style click) → no frame intent.
    rowProps.onClick(clickEvent(null));
    expect(onSelectTrackFrame).not.toHaveBeenCalled();
    // A cell click carries the frame from data-roto-app-frame.
    const cell = { dataset: { rotoAppFrame: '7' } };
    rowProps.onClick(clickEvent({ closest: () => cell }));
    expect(onSelectTrackFrame).toHaveBeenCalledWith(TRACK, 7);
  });

  it('49-06 UAT round 2: clicking an EMPTY Background row cell is the placement gesture (selects the target frame)', () => {
    const onSelectBackgroundFrame = vi.fn();
    const tree = PhysicsPaintTrackRow({
      trackId: 'bg-row',
      layerId: LAYER,
      frameCells: FRAME_CELLS,
      kind: 'background',
      onSelectBackgroundFrame,
    }) as TestVNode;
    const row = findAll(materialize(tree), (vnode) => hasClass(vnode, 'physics-paint-track-row'))[0];
    const rowProps = row.props as { onClick: (event: MouseEvent) => void };
    // A cell click selects the target frame — the only Bg-row cell-click intent
    // (never navigates/selects).
    const cell = { dataset: { rotoAppFrame: '7' } };
    rowProps.onClick({ target: { closest: () => cell }, stopPropagation: vi.fn() } as unknown as MouseEvent);
    expect(onSelectBackgroundFrame).toHaveBeenCalledWith(7);
    // A non-cell click (rail overlay) does NOT select a frame.
    rowProps.onClick({ target: null, stopPropagation: vi.fn() } as unknown as MouseEvent);
    expect(onSelectBackgroundFrame).toHaveBeenCalledTimes(1);
  });

  it('49-06 UAT round 2: the selected Bg clip rail paints the orange selection class and the placement cell carries the marker', () => {
    const background: BackgroundTrack = {
      id: 'bg-track',
      clips: [{
        id: 'bg-clip-1',
        startFrame: 2,
        sourceFrameRefs: ['k0'],
        repeat: { mode: 'finite', count: 2 },
        sourceKind: 'imported-background',
        revision: 1,
      }],
      fallback: { mode: 'transparent' },
      visible: true,
      revision: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      transformLocked: true,
    };
    const tree = render({
      trackId: 'bg-row',
      kind: 'background',
      background,
      backgroundResolutionContext: deriveEfxPaintBackgroundResolution(background, CAPACITY),
      selectedBackgroundClipId: 'bg-clip-1',
      backgroundPlacementFrame: 7,
    });
    // The clip renders as a GROUP OF CELLS (one per frame of the extent) with
    // the selected orange treatment on the container.
    const cells = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-clip-cells'));
    expect(cells).toHaveLength(1);
    expect(String(cells[0].props.class)).toContain('selected');
    const cellSpans = findAll(cells[0], (vnode) => hasClass(vnode, 'physics-paint-bg-clip-cell'));
    expect(cellSpans.length).toBeGreaterThan(0);
    // The rail LINE carries the selected class (orange segment) and the
    // START/END markers are present.
    const line = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-clip-rail-line'));
    expect(line).toHaveLength(1);
    expect(String(line[0].props.class)).toContain('selected');
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-clip-rail-marker'))).toHaveLength(2);
    // The lane carries NO text — the badge span is gone (47 lock).
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-clip-rail-badge'))).toHaveLength(0);
    // The placement-target cell carries the marker class.
    const marker = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-placement-target'));
    expect(marker).toHaveLength(1);
    expect(marker[0].props['data-roto-app-frame']).toBe(7);
  });

  it('49-06 UAT round 8: the whole rail is interactive — cells route pointerdown to the move hook and the anchor onClick selects (track-rail pattern)', () => {
    const background: BackgroundTrack = {
      id: 'bg-track',
      clips: [{
        id: 'bg-clip-1',
        startFrame: 2,
        sourceFrameRefs: ['k0'],
        repeat: { mode: 'finite', count: 2 },
        sourceKind: 'imported-background',
        revision: 1,
      }],
      fallback: { mode: 'transparent' },
      visible: true,
      revision: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      transformLocked: true,
    };
    const onMovePointerDown = vi.fn();
    const onSelectBackgroundClip = vi.fn();
    const tree = render({
      trackId: 'bg-row',
      kind: 'background',
      background,
      backgroundResolutionContext: deriveEfxPaintBackgroundResolution(background, CAPACITY),
      onSelectBackgroundClip,
      backgroundClipDrag: {
        onPointerDown: onMovePointerDown,
        ghost: { active: false, left: 0, width: 0, blockedEdge: null },
        preview: null,
        consumeClickSuppression: () => false,
      },
    });
    // The cells container is the whole-rail MOVE handle (like the line) — a
    // pointerdown on any cell routes to the drag hook.
    const cells = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-clip-cells'));
    expect(cells).toHaveLength(1);
    expect(cells[0].props['data-bg-clip-id']).toBe('bg-clip-1');
    expect(cells[0].props['data-bg-clip-start']).toBe(2);
    const cellsPointerDown = (cells[0].props as { onPointerDown?: (event: unknown) => void }).onPointerDown;
    expect(typeof cellsPointerDown).toBe('function');
    cellsPointerDown?.({ stopPropagation: vi.fn() } as unknown as PointerEvent);
    expect(onMovePointerDown).toHaveBeenCalledTimes(1);
    // The anchor's onClick owns selection (the track-rail pattern) — a plain
    // click selects the clip; a suppressed click (post-drag) is swallowed.
    const anchor = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-clip-rail-anchor'));
    expect(anchor).toHaveLength(1);
    const onClick = (anchor[0].props as { onClick?: () => void }).onClick;
    expect(typeof onClick).toBe('function');
    onClick?.();
    expect(onSelectBackgroundClip).toHaveBeenCalledWith('bg-clip-1');
  });

  it('49-06 UAT round 3: every Bg cell is a whole-rail move handle and the first/last carry resize sub-handles', () => {
    const background: BackgroundTrack = {
      id: 'bg-track',
      clips: [{
        id: 'bg-clip-1',
        startFrame: 2,
        sourceFrameRefs: ['k0'],
        repeat: { mode: 'finite', count: 2 },
        sourceKind: 'imported-background',
        revision: 1,
      }],
      fallback: { mode: 'transparent' },
      visible: true,
      revision: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      transformLocked: true,
    };
    const onMovePointerDown = vi.fn();
    const onResizePointerDown = vi.fn();
    const tree = render({
      trackId: 'bg-row',
      kind: 'background',
      background,
      backgroundResolutionContext: deriveEfxPaintBackgroundResolution(background, CAPACITY),
      backgroundClipDrag: {
        onPointerDown: onMovePointerDown,
        ghost: { active: false, left: 0, width: 0, blockedEdge: null },
        preview: null,
        consumeClickSuppression: () => false,
      },
      backgroundClipResize: {
        onPointerDown: onResizePointerDown,
        ghost: { active: false, left: 0, width: 0, blockedEdge: null },
        consumeClickSuppression: () => false,
      },
    });
    const cells = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-clip-cell'));
    expect(cells.length).toBeGreaterThan(0);
    // The cells are the visual FILL — no interaction (pointer-events none).
    for (const cell of cells) {
      expect((cell.props as { onPointerDown?: unknown }).onPointerDown).toBeUndefined();
    }
    // The rail LINE is the whole-rail MOVE handle.
    const line = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-clip-rail-line'));
    expect(line).toHaveLength(1);
    expect(typeof (line[0].props as { onPointerDown?: unknown }).onPointerDown).toBe('function');
    // The START/END markers are the resize handles with the edge attribute.
    const markers = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-clip-rail-marker'));
    expect(markers).toHaveLength(2);
    const startMarker = markers.find((h) => hasClass(h, 'physics-paint-bg-clip-rail-marker-start'))!;
    const endMarker = markers.find((h) => hasClass(h, 'physics-paint-bg-clip-rail-marker-end'))!;
    expect(startMarker.props['data-bg-clip-edge']).toBe('start');
    expect(endMarker.props['data-bg-clip-edge']).toBe('end');
    // The marker's pointer-down stops propagation and routes to the resize hook.
    const startEvent = { stopPropagation: vi.fn() };
    (startMarker.props as { onPointerDown: (event: unknown) => void }).onPointerDown(startEvent);
    expect(startEvent.stopPropagation).toHaveBeenCalled();
    expect(onResizePointerDown).toHaveBeenCalledTimes(1);
    expect(onMovePointerDown).not.toHaveBeenCalled();
  });

  it('fires the one-click rail selection intents with the rail identity (UAT round 5)', () => {
    // k0/k1 form an ordinary Key Rail; k2/k3 are the loop's source keys
    // (group-owned keys paint no ordinary rail line).
    seedTrack(TRACK, [
      makeRecord('k0', 2, 'a@2'),
      makeRecord('k1', 5, 'a@5'),
      makeRecord('k2', 8, 'a@8'),
      makeRecord('k3', 10, 'a@10'),
    ]);
    physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK, [{
      loopId: 'loop-motion',
      placementStart: 12,
      sourceKeyIds: ['k2', 'k3'],
      repeat: 2,
      mode: 'progressive',
    }]);
    const onSelectTrackRail = vi.fn();
    const tree = materialize(PhysicsPaintTrackRow({
      trackId: TRACK,
      layerId: LAYER,
      frameCells: FRAME_CELLS,
      onSelectTrackRail,
    }));
    const keyRails = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-row-rail')
      && hasClass(vnode, 'physics-paint-rail-target')
      && !hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(keyRails).toHaveLength(1);
    (keyRails[0].props as { onClick: (event: unknown) => void }).onClick({ stopPropagation: vi.fn() });
    expect(onSelectTrackRail).toHaveBeenCalledWith(TRACK, { kind: 'key', firstKeyId: 'k0', keyIds: ['k0', 'k1'], firstKeyFrame: 2 });

    const loopRails = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(loopRails).toHaveLength(1);
    (loopRails[0].props as { onClick: (event: unknown) => void }).onClick({ stopPropagation: vi.fn() });
    expect(onSelectTrackRail).toHaveBeenCalledWith(TRACK, { kind: 'loop', loopId: 'loop-motion', placementFrame: 12 });
  });
});

describe('PhysicsPaintTrackColumnStrip — 50-UAT photo/reference camera icon (S1, modal redesign)', () => {
  function renderStrip(overrides: Partial<Parameters<typeof PhysicsPaintTrackColumnStrip>[0]> = {}) {
    return materialize(PhysicsPaintTrackColumnStrip({
      trackCount: 2,
      onAddTrack: () => {},
      ...overrides,
    }));
  }

  it('renders the camera icon between the title group and the + button (50-UAT)', () => {
    const tree = renderStrip();
    const camera = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-column-photo'));
    expect(camera).toHaveLength(1);
    expect(camera[0].props['aria-label']).toBe('Photo reference settings');
    // No source yet — the plain affordance, no active state, no X badge.
    expect(hasClass(camera[0], 'has-reference')).toBe(false);
    // The X remove badge is GONE (50-UAT round 2 — remove lives in the dialog).
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-column-photo-remove'))).toHaveLength(0);
    // The + add-track button still renders.
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-column-add'))).toHaveLength(1);
  });

  it('shows the active state when a source exists — still no X badge (50-UAT)', () => {
    const tree = renderStrip({ hasReference: true });
    const camera = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-column-photo'));
    expect(hasClass(camera[0], 'has-reference')).toBe(true);
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-column-photo-remove'))).toHaveLength(0);
  });

  it('routes the camera click to the open-dialog intent (50-UAT)', () => {
    const onOpenReference = vi.fn();
    const tree = renderStrip({ onOpenReference });
    const camera = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-column-photo'))[0];
    (camera.props as { onClick: () => void }).onClick();
    expect(onOpenReference).toHaveBeenCalledTimes(1);
  });
});

describe('PhysicsPaintTrackRow — 52.2-12 render counters (D-18)', () => {
  const profileStorage = new Map<string, string>();

  beforeEach(() => {
    profileStorage.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => profileStorage.get(key) ?? null,
      },
    });
    clearPhysicsPaintPerformance();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearPhysicsPaintPerformance();
  });

  it('counts real row renders through render.tracksStrip only while profiling is enabled', () => {
    // Gate off: the row renders normally but records nothing.
    render();
    render();
    expect(snapshotPhysicsPaintPerformance().counters['render.tracksStrip']).toBe(0);

    // Gate on: each materialized row render increments the counter exactly once.
    profileStorage.set('efx.physicsPaint.profile', '1');
    render();
    render();
    render();
    expect(snapshotPhysicsPaintPerformance().counters['render.tracksStrip']).toBe(3);

    // Clearing the profile window resets the surface counter to its zero row.
    clearPhysicsPaintPerformance();
    expect(snapshotPhysicsPaintPerformance().counters['render.tracksStrip']).toBe(0);
    render();
    expect(snapshotPhysicsPaintPerformance().counters['render.tracksStrip']).toBe(1);
  });
});

describe('PhysicsPaintTrackRow — 261023-bji solo focus dimming', () => {
  it('carries the solo-dimmed class only when soloDimmed is set', () => {
    const dimmed = render({ soloDimmed: true }) as TestVNode;
    expect(hasClass(dimmed, 'physics-paint-track-row-solo-dimmed')).toBe(true);
    const plain = render() as TestVNode;
    expect(hasClass(plain, 'physics-paint-track-row-solo-dimmed')).toBe(false);
  });

  it('shares the exact hidden-track fade: opacity 0.4 + grayscale 0.9', () => {
    const rule = cssRule('.physics-paint-track-row-solo-dimmed {');
    expect(rule).toContain('opacity: 0.4');
    expect(rule).toContain('filter: grayscale(0.9)');
  });
});

describe('PhysicsPaintTrackRow — 261104-so5 painted phase on a generated in-between', () => {
  const INTERPOLATION_ON = { enabled: true, mode: 'duplicate' } as const;

  /** The first row cell materialized for one frame (the row emits one span per frame). */
  function cellAt(tree: unknown, frame: number): TestVNode {
    const cell = findAll(tree, (vnode) => Number(vnode.props['data-roto-app-frame']) === frame)[0];
    if (!cell) throw new Error(`No row cell materialized at frame ${frame}`);
    return cell;
  }

  function cellKinds(tree: unknown): string[] {
    return FRAME_CELLS.map((frame) => String(cellAt(tree, frame).props['data-cell-kind']));
  }

  /**
   * The reported fixture: source keys A@2 / B@9 (a strict generated interior
   * 3..8) inside a lifecycle loop over phaseOrigin 2, originalEndExclusive 18.
   * `visibleRanges` / `frameOverrides` vary per pin.
   */
  function seedLifecycleDocument(input: {
    readonly visibleRanges: readonly { readonly start: number; readonly endExclusive: number }[];
    readonly frameOverrides?: readonly { readonly appFrame: number; readonly keyId: string }[];
    readonly overrideRecords?: readonly PhysicPaintRotoRealKeyRecord[];
  }): void {
    const records = [makeRecord('A', 2, 'a@2'), makeRecord('B', 9, 'b@9')];
    const overrideRecords = input.overrideRecords ?? [];
    const loop = {
      loopId: 'loop-1',
      placementStart: 2,
      sourceKeyIds: ['A', 'B'],
      repeat: 2,
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 2,
      originalEndExclusive: 18,
      visibleRanges: input.visibleRanges,
      frameOverrides: input.frameOverrides ?? [],
    };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(LAYER, TRACK, {
      capacity: CAPACITY,
      realKeyRecords: records,
      groupOverrideRecords: overrideRecords,
      interpolation: INTERPOLATION_ON,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(
        records,
        INTERPOLATION_ON,
        [loop],
        [],
        overrideRecords,
      ),
      loopClips: [loop],
      incomingInterpolationBreakKeyIds: [],
    });
    if (!seeded.ok) throw new Error(`Lifecycle document seed failed: ${seeded.error}`);
  }

  it('paints the interp dash for a lifecycle override on a generated in-between (the reported regression)', () => {
    seedLifecycleDocument({
      visibleRanges: [{ start: 2, endExclusive: 18 }],
      frameOverrides: [{ appFrame: 7, keyId: 'ov1' }],
      overrideRecords: [makeRecord('ov1', 7, 'ov1@7')],
    });

    // The store seam reproduces the bug exactly: the structural projection
    // reports a generated in-between at frame 7 while the render source
    // resolves the Group frame override as a 'real' key, and no app-frame
    // real-key record exists there.
    const projection = physicPaintStore.getRotoPhysicalProjection(LAYER, TRACK);
    expect(projection?.cells[7]?.kind).toBe('generated');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK, 7)?.kind).toBe('real');
    expect(physicPaintStore.getRotoRealKeyRecordByAppFrame(LAYER, TRACK, 7)).toBeNull();

    const tree = render();
    // The full key/interp/cycle/empty matrix at the row's cells: frame 7 is
    // interp here, exactly like the active lane's structural classification.
    expect(cellKinds(tree)).toEqual([
      'empty', 'empty', // 0-1
      'key', // 2 — source key A
      'interp', 'interp', 'interp', 'interp', // 3-6
      'interp', // 7 — the painted phase (the fix)
      'interp', // 8
      'key', // 9 — source key B
      'cycle', 'cycle', 'cycle', 'cycle', 'cycle', 'cycle', 'cycle', 'cycle', // 10-17
      'empty', 'empty', 'empty', 'empty', 'empty', 'empty', // 18-23
    ]);
    expect(cellAt(tree, 10).props['data-cycle']).toBe(2);
    expect(cellAt(tree, 17).props['data-cycle']).toBe(2);
  });

  it('keeps a group-gap frame empty even though its projection reports generated (guard)', () => {
    // A visible-range gap at frame 7: the projection still derives the strict
    // interior from A@2/B@9, but the lifecycle classifier reports 'group-gap'
    // and the render source is null — a projection-only fix would wrongly
    // paint interp here.
    seedLifecycleDocument({
      visibleRanges: [{ start: 2, endExclusive: 6 }, { start: 10, endExclusive: 18 }],
    });

    const projection = physicPaintStore.getRotoPhysicalProjection(LAYER, TRACK);
    expect(projection?.cells[7]?.kind).toBe('generated');
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK, 7)).toBeNull();

    const tree = render();
    expect(cellAt(tree, 7).props['data-cell-kind']).toBe('empty');
    expect(hasClass(cellAt(tree, 7), 'roto-fill-empty')).toBe(true);
  });

  it('keeps a stale cached frame with no record empty (guard)', () => {
    // Runtime pixels left behind at a frame with no app-frame real-key record
    // (the deleted-key case): the cell has a cached fill but is not a rail
    // state, so the v7 matrix must stay 'empty' — never interp.
    seedTrack(TRACK, [makeRecord('A', 2, 'a@2'), makeRecord('B', 9, 'b@9')]);
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, TRACK, 5, makeFrame(5, 'stale'));

    expect(physicPaintStore.getRotoRealKeyRecordByAppFrame(LAYER, TRACK, 5)).toBeNull();
    const tree = render();
    expect(cellAt(tree, 5).props['data-cell-kind']).toBe('empty');
    expect(hasClass(cellAt(tree, 5), 'roto-fill-cached')).toBe(true);
  });
});
describe('59-11 rail motion hosting — chevron, session expansion and the expanded block', () => {
  const LOOP_RAIL_ID = 'loop-motion-59-11';
  const KEY_RAIL_ID = 'rail-59-11-key';
  const LOOP_IDENTITY: RailSetIdentity = { kind: 'loop', loopId: LOOP_RAIL_ID };
  const OTHER_LOOP_IDENTITY: RailSetIdentity = { kind: 'loop', loopId: 'loop-other-59-11' };
  const KEY_IDENTITY: RailSetIdentity = { kind: 'key-rail', firstKeyId: 'k0' };
  const ALL_CHANNEL_IDS: readonly PhysicPaintRotoRailMotionChannelId[] = [
    'position-x', 'position-y', 'scale', 'rotation', 'opacity',
  ];

  function railView(
    overrides: Partial<RailMotionRailView> & Pick<RailMotionRailView, 'railId' | 'anchorKeyId'>,
  ): RailMotionRailView {
    return {
      startFrame: 0,
      endFrameExclusive: 10,
      keyIds: [],
      railType: 'motion',
      loopId: null,
      ...overrides,
    };
  }

  function motionRecord(
    railId: string,
    channelIds: readonly PhysicPaintRotoRailMotionChannelId[],
    frames: readonly number[] = [0, 4],
  ): PhysicPaintRotoRailMotionRecord {
    return {
      railId,
      anchorKeyId: 'k0',
      channels: channelIds.map((id) => ({
        id,
        keys: frames.map((frame) => ({ frame, value: 1, easing: 'ease' as const, wiggle: 0 })),
      })),
    };
  }

  /** Seed the store with one motion-bearing Loop Clip rail (k0..k1). */
  function seedMotionRail(): void {
    seedTrack(TRACK, [makeRecord('k0', 0, 'a@0'), makeRecord('k1', 4, 'a@4')]);
    const loop = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK, [{
      loopId: LOOP_RAIL_ID,
      placementStart: 0,
      sourceKeyIds: ['k0', 'k1'],
      repeat: 1,
      mode: 'progressive',
      scriptId: 'script-59-11',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
    }]);
    if (!loop.ok) throw new Error(`motion loop seed failed: ${loop.error}`);
    const seeded = physicPaintStore.replaceRotoPhysicalRailMotions(
      LAYER,
      TRACK,
      [motionRecord(LOOP_RAIL_ID, ALL_CHANNEL_IDS)],
    );
    if (!seeded.ok) throw new Error(`motion record seed failed: ${seeded.error}`);
  }

  function renderHeader(
    overrides: Partial<Parameters<typeof PhysicsPaintTrackRowHeader>[0]> = {},
  ): unknown {
    return materialize(PhysicsPaintTrackRowHeader({
      trackId: TRACK,
      label: 'Track A',
      activeTrackId: TRACK,
      layerId: LAYER,
      ...overrides,
    }));
  }

  function motionChevron(tree: unknown): TestVNode {
    const matches = findAll(tree, (vnode) => vnode.props['data-motion-chevron'] !== undefined);
    expect(matches).toHaveLength(1);
    return matches[0];
  }

  beforeEach(() => {
    railMotionExpandedSelection.value = null;
  });

  afterEach(() => {
    railMotionExpandedSelection.value = null;
  });

  it('resolves the durable railId from both identity kinds — never the firstKeyId', () => {
    const views: RailMotionRailView[] = [
      railView({ railId: LOOP_RAIL_ID, anchorKeyId: 'k0', loopId: LOOP_RAIL_ID, railType: 'motion' }),
      // A bound bare Key Rail: its durable identity is the assigned railId.
      railView({ railId: KEY_RAIL_ID, anchorKeyId: 'k7', railType: 'standard' }),
      // An unbound Key Rail (no motion record): railId null, anchor is a hint only.
      railView({ railId: null, anchorKeyId: 'k9', railType: 'standard' }),
    ];

    expect(resolveSelectedRailMotionId(views, { kind: 'loop', loopId: LOOP_RAIL_ID })).toBe(LOOP_RAIL_ID);
    expect(resolveSelectedRailMotionId(views, { kind: 'key-rail', firstKeyId: 'k7' })).toBe(KEY_RAIL_ID);
    expect(resolveSelectedRailMotionId(views, { kind: 'key-rail', firstKeyId: 'k9' })).toBeNull();
    expect(resolveSelectedRailMotionId(views, { kind: 'loop', loopId: 'missing' })).toBeNull();
    expect(resolveSelectedRailMotionId(views, null)).toBeNull();
  });

  it('expands only while the recorded session identity still IS the selected rail', () => {
    const same = {
      expandedSelection: LOOP_IDENTITY,
      selectedRail: LOOP_IDENTITY,
      selectedRailMotionId: LOOP_RAIL_ID,
    };
    expect(resolveMotionBlockExpanded(same)).toBe(true);
    expect(resolveMotionBlockExpanded({ ...same, selectedRail: OTHER_LOOP_IDENTITY })).toBe(false);
    expect(resolveMotionBlockExpanded({ ...same, expandedSelection: null })).toBe(false);
    expect(resolveMotionBlockExpanded({ ...same, selectedRailMotionId: null })).toBe(false);
    expect(resolveMotionBlockExpanded({ ...same, selectedRail: null })).toBe(false);
  });

  it('renders the three chevron kinds from motion presence and expansion', () => {
    expect(resolveMotionChevronKind({ hasMotion: false, expanded: false })).toBe('minus');
    expect(resolveMotionChevronKind({ hasMotion: true, expanded: false })).toBe('chevron-right');
    expect(resolveMotionChevronKind({ hasMotion: true, expanded: true })).toBe('chevron-down');
  });

  it('renders the grey minus on a track with no motion — a disabled 14×14 button with its reason', () => {
    const tree = renderHeader();
    const chevron = motionChevron(tree);
    expect(chevron.props['data-motion-chevron']).toBe('minus');
    expect(hasClass(chevron, 'is-none')).toBe(true);
    expect(chevron.props['aria-disabled']).toBe('true');
    expect(chevron.props['aria-expanded']).toBeUndefined();
    expect(chevron.props.title).toBe('No motion channels');
    expect(chevron.props['aria-description']).toBe('No motion channels');
    expect(chevron.props.onClick).toBeUndefined();
    expect(chevron.props.style).toMatchObject({ width: '14px', height: '14px' });
  });

  it('clicking the collapsed chevron on the selected motion rail expands it, clicking again collapses it', () => {
    seedMotionRail();
    const collapsed = renderHeader({ selectedRail: LOOP_IDENTITY });
    const right = motionChevron(collapsed);
    expect(right.props['data-motion-chevron']).toBe('chevron-right');
    expect(right.props['aria-expanded']).toBe('false');
    expect(right.props['aria-disabled']).toBeUndefined();
    expect(right.props['aria-label']).toBe('Expand motion channels');
    expect(right.props.onClick).toBeTypeOf('function');
    (right.props.onClick as () => void)();
    expect(railMotionExpandedSelection.value).toEqual(LOOP_IDENTITY);

    const expanded = renderHeader({ selectedRail: LOOP_IDENTITY });
    const down = motionChevron(expanded);
    expect(down.props['data-motion-chevron']).toBe('chevron-down');
    expect(down.props['aria-expanded']).toBe('true');
    expect(down.props['aria-label']).toBe('Collapse motion channels');
    (down.props.onClick as () => void)();
    expect(railMotionExpandedSelection.value).toBeNull();
  });

  it('disables the chevron of a motion-bearing track whose rail is not the selected one — with a visible reason', () => {
    seedMotionRail();
    const tree = renderHeader({ activeTrackId: 'track-other', selectedRail: LOOP_IDENTITY });
    const chevron = motionChevron(tree);
    expect(chevron.props['data-motion-chevron']).toBe('chevron-right');
    expect(chevron.props['aria-disabled']).toBe('true');
    expect(chevron.props.title).toBe('Select this track’s rail to open its motion channels');
    expect(chevron.props.onClick).toBeUndefined();
  });

  it('Animate leaves the block collapsed: the session signal stays null and the glyph is chevron-right (D-03)', () => {
    seedMotionRail();
    // Animate writes motion into the store (the seed) and never touches the
    // session expansion identity — the block must stay collapsed.
    expect(railMotionExpandedSelection.value).toBeNull();
    const tree = renderHeader({ selectedRail: LOOP_IDENTITY });
    expect(motionChevron(tree).props['data-motion-chevron']).toBe('chevron-right');
  });

  it('writes the session expansion signal in exactly one place — the chevron toggle — and adds no effect', () => {
    const body = rowSource();
    const writes = body.match(/railMotionExpandedSelection\.value\s*=/g) ?? [];
    expect(writes).toHaveLength(1);
    expect(body).not.toMatch(/useEffect\s*\(/);
  });

  it('keeps at most one block open: toggling another rail replaces the recorded identity', () => {
    toggleRailMotionExpansion(LOOP_IDENTITY, LOOP_RAIL_ID);
    expect(railMotionExpandedSelection.value).toEqual(LOOP_IDENTITY);
    toggleRailMotionExpansion(KEY_IDENTITY, KEY_RAIL_ID);
    expect(railMotionExpandedSelection.value).toEqual(KEY_IDENTITY);
    toggleRailMotionExpansion(KEY_IDENTITY, KEY_RAIL_ID);
    expect(railMotionExpandedSelection.value).toBeNull();
    // A rail with no motion is never recorded.
    toggleRailMotionExpansion(LOOP_IDENTITY, null);
    expect(railMotionExpandedSelection.value).toBeNull();
    toggleRailMotionExpansion(null, null);
    expect(railMotionExpandedSelection.value).toBeNull();
  });

  it('resolves the motion record for a rail and treats an all-keyless record as no motion', () => {
    const withKeys = motionRecord(LOOP_RAIL_ID, ALL_CHANNEL_IDS);
    const keyless = motionRecord(LOOP_RAIL_ID, ALL_CHANNEL_IDS, []);
    expect(resolveMotionRecordForRail([withKeys], LOOP_RAIL_ID)).toBe(withKeys);
    expect(resolveMotionRecordForRail([withKeys], null)).toBeNull();
    expect(resolveMotionRecordForRail([withKeys], 'missing')).toBeNull();
    expect(resolveRailMotionHasKeys(withKeys)).toBe(true);
    expect(resolveRailMotionHasKeys(keyless)).toBe(false);
    expect(resolveRailMotionHasKeys(null)).toBe(false);
  });

  it('counts DISPLAY lanes, not model channels: five keyed channels yield four lanes (D-11/D-13)', () => {
    const record = motionRecord(LOOP_RAIL_ID, ALL_CHANNEL_IDS);
    const input = {
      views: [railView({ railId: LOOP_RAIL_ID, anchorKeyId: 'k0', loopId: LOOP_RAIL_ID })],
      record,
      expandedSelection: LOOP_IDENTITY,
      selectedRail: LOOP_IDENTITY,
      selectedRailMotionId: LOOP_RAIL_ID,
    };
    expect(resolveTrackMotionLaneCount(input)).toBe(4);
    expect(resolveTrackMotionLaneCount({ ...input, expandedSelection: null })).toBe(0);
    expect(resolveTrackMotionLaneCount({ ...input, selectedRailMotionId: null })).toBe(0);
    expect(resolveTrackMotionLaneCount({
      ...input,
      record: motionRecord(LOOP_RAIL_ID, ALL_CHANNEL_IDS, []),
    })).toBe(0);
  });

  it('renders the expanded block only while expanded: four display lanes, the outline and the post-block gap', () => {
    const record = motionRecord(LOOP_RAIL_ID, ALL_CHANNEL_IDS);
    const views = [railView({
      railId: LOOP_RAIL_ID,
      anchorKeyId: 'k0',
      loopId: LOOP_RAIL_ID,
      keyIds: ['k0', 'k1'],
      endFrameExclusive: 10,
    })];
    const base = {
      rotoSelectedRail: LOOP_IDENTITY,
      rotoRailMotions: [record],
      rotoRailViews: views,
      motionRowHeightPx: 105,
    };

    railMotionExpandedSelection.value = LOOP_IDENTITY;
    const expanded = render(base);
    expect(findAll(expanded, (vnode) => hasClass(vnode, 'physics-paint-motion-block-lanes'))).toHaveLength(1);
    const lanes = findAll(expanded, (vnode) => hasClass(vnode, 'physics-paint-motion-lane'));
    expect(lanes).toHaveLength(4);
    expect(lanes.map((lane) => String(lane.props['data-motion-display-lane']))).toEqual([
      'position', 'scale', 'rotation', 'opacity',
    ]);
    const outline = findAll(expanded, (vnode) => hasClass(vnode, 'physics-paint-motion-block-outline'));
    expect(outline).toHaveLength(1);
    expect(outline[0].props.style).toMatchObject({ height: 31 + 4 * 18 + 2, borderRadius: 4 });
    const gap = findAll(expanded, (vnode) => hasClass(vnode, 'physics-paint-motion-block-gap'));
    expect(gap).toHaveLength(1);
    expect(gap[0].props.style).toMatchObject({ height: '2px' });
    expect((expanded as TestVNode).props.style).toMatchObject({ position: 'relative', height: '105px' });

    // Collapsed: no lane, no outline — the row keeps its rail-cell lane only.
    railMotionExpandedSelection.value = null;
    const collapsed = render(base);
    expect(findAll(collapsed, (vnode) => hasClass(vnode, 'physics-paint-motion-lane'))).toHaveLength(0);
    expect(findAll(collapsed, (vnode) => hasClass(vnode, 'physics-paint-motion-block-outline'))).toHaveLength(0);
    expect((collapsed as TestVNode).props.style).toBeUndefined();

    // A different recorded identity (selection moved) renders no lanes either.
    railMotionExpandedSelection.value = OTHER_LOOP_IDENTITY;
    const stale = render(base);
    expect(findAll(stale, (vnode) => hasClass(vnode, 'physics-paint-motion-lane'))).toHaveLength(0);
  });
});
