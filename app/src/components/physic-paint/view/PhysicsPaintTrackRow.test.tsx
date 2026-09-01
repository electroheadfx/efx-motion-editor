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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhysicsPaintTrackRow, PhysicsPaintTrackRowHeader } from './PhysicsPaintTrackRow';
import {
  _setPhysicPaintMarkDirtyCallback,
  physicPaintStore,
} from '../../../stores/physicPaintStore';
import { deriveEfxPaintBackgroundResolution } from '../../../efx-paint/compositor/efxPaintBackgroundResolution';
import type { BackgroundTrack, PhotoReferenceTrack } from '../../../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';

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
  dataUrl: `data:image/png;base64,${btoa(tag)}`,
  width: 4,
  height: 4,
});

const makePayload = (appFrame: number, tag: string): PhysicPaintRotoRealKeyPayload => ({
  frameIndex: 0,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(tag)}`,
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
  if (typeof vnode.type === 'function') return materialize(vnode.type(vnode.props));
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
    // Segment spans frames 2..5 inclusive → left 2×18, width 4×18.
    expect(rails[0].props.style).toMatchObject({ left: '36px', width: '72px' });
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
    }]);
    if (!motion.ok) throw new Error(`motion loop seed failed: ${motion.error}`);
    const motionLine = findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(motionLine).toHaveLength(1);
    expect(String(motionLine[0].props.class)).toContain('mode-progressive');
    // Colors come from the shared family rules — the same ones the active
    // lane's loop rails paint with.
    expect(cssRule('.physics-paint-loop-clip-rail-segment {')).toContain('background: #8b5cf6');
    expect(cssRule('.physics-paint-loop-clip-rail-target.mode-static .physics-paint-loop-clip-rail-segment {')).toContain('background: #06b6d4');

    const staticClip = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK, [{
      loopId: 'loop-static',
      placementStart: 6,
      sourceKeyIds: ['k0', 'k1'],
      repeat: 1,
      mode: 'static',
    }]);
    if (!staticClip.ok) throw new Error(`static loop seed failed: ${staticClip.error}`);
    const staticLine = findAll(render(), (vnode) => hasClass(vnode, 'physics-paint-loop-clip-rail-target'));
    expect(staticLine).toHaveLength(1);
    expect(String(staticLine[0].props.class)).toContain('mode-static');
  });

  it('renders the lifecycle status dot on non-active rows (show always)', () => {
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
    expect(dot).toHaveLength(1);
    expect(String(dot[0].props.class)).toContain('unavailable');
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
    // 49-06 (UAT round 6): the line sits 4px into the 8px band — the SAME
    // position as the track Key Rail segment, so the freed 4px reads as the
    // gap between stacked Bg clips.
    expect(cssRule('.physics-paint-bg-clip-rail-line::before {')).toContain('inset: 4px 0 auto 0');
    // 49-06 (UAT round 7): the RESTING line is #195991; the SELECTED line is
    // the SAME orange as the selected cells (#f5a623). The rail's own line does
    // NOT change during a move/resize — only the drag/resize GHOST is a white
    // line drawn on top of it (white on orange).
    expect(cssRule('.physics-paint-bg-clip-rail-line::before {')).toContain('background: #195991');
    expect(cssRule('.physics-paint-bg-clip-rail-anchor .physics-paint-bg-clip-rail-line.selected::before {')).toContain('background: #f5a623');
    expect(cssRule('.physics-paint-bg-clip-rail-ghost {')).toContain('background: #f8fafc');
    expect(cssRule('.physics-paint-bg-clip-rail-ghost {')).toContain('z-index: 4');
    // The START/END markers are the resize handles (ew-resize cursor) — the
    // element IS the 2px x 4px #f8fafc cap (the track's shared boundary cap,
    // no extra rectangle), anchored to the line's outer edges at the same
    // 4px-into-the-band position as the track cap.
    expect(cssRule('.physics-paint-bg-clip-rail-marker {')).toContain('cursor: ew-resize');
    expect(cssRule('.physics-paint-bg-clip-rail-marker {')).toContain('background: #f8fafc');
    expect(cssRule('.physics-paint-bg-clip-rail-marker {')).toContain('top: 4px');
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
    expect(cssRule('.physics-paint-track-row-rail {')).toContain('height: 8px');
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

describe('PhysicsPaintTrackRow — 50-03 Photo row (S1)', () => {
  const photoReference: PhotoReferenceTrack = {
    id: 'photo-ref-track',
    sourceFrameRefs: ['shot_1', 'shot_2'],
    mode: 'reference-only',
    revision: 0,
    visibleInStudio: true,
    opacity: 0.5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    transformLocked: true,
  };

  function renderHeader(overrides: Partial<Parameters<typeof PhysicsPaintTrackRowHeader>[0]> = {}) {
    return materialize(PhysicsPaintTrackRowHeader({
      trackId: 'photo-ref-track',
      label: 'Photo',
      kind: 'photo-reference',
      photoReference,
      ...overrides,
    }));
  }

  it('renders the Photo header with camera glyph, Photo label, lock, eye toggle, and Import/Replace control (S1)', () => {
    const tree = renderHeader();
    // Camera glyph — NEVER the Bg checker swatch (spec stop condition).
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-photo-reference-glyph'))).toHaveLength(1);
    expect(findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-bg-checker'))).toHaveLength(0);
    // Label "Photo".
    const label = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-row-label'));
    expect(label).toHaveLength(1);
    expect(String(label[0].props.children)).toBe('Photo');
    // Lock indicator with the fixed-position tooltip.
    const lock = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-row-lock'));
    expect(lock).toHaveLength(1);
    expect(lock[0].props.title).toBe('Reference layer — fixed position');
    // Eye toggle (D-11).
    expect(findAll(tree, (vnode) => vnode.props['aria-label'] === 'Toggle reference visibility')).toHaveLength(1);
    // Import/Replace control (D-03) — source present → "Replace source".
    expect(findAll(tree, (vnode) => vnode.props['aria-label'] === 'Replace source')).toHaveLength(1);
  });

  it('is not selectable as a track — no role=button, no tabIndex (D-06)', () => {
    const tree = renderHeader();
    const header = findAll(tree, (vnode) => hasClass(vnode, 'physics-paint-track-row-header-photo-reference'));
    expect(header).toHaveLength(1);
    expect(header[0].props.role).toBeUndefined();
    expect(header[0].props.tabIndex).toBeUndefined();
    expect(header[0].props['aria-label']).toBe('Photo row');
  });

  it('renders the passive band when a source exists and an empty lane when none (D-15)', () => {
    const withSource = render({ trackId: 'photo-ref-row', kind: 'photo-reference', photoReference });
    expect(findAll(withSource, (vnode) => hasClass(vnode, 'physics-paint-photo-reference-band'))).toHaveLength(1);
    const band = findAll(withSource, (vnode) => hasClass(vnode, 'physics-paint-photo-reference-band'))[0];
    expect(band.props['aria-label']).toBe('Reference source');
    expect(band.props.role).toBe('group');

    const withoutSource = render({ trackId: 'photo-ref-row', kind: 'photo-reference', photoReference: null });
    expect(findAll(withoutSource, (vnode) => hasClass(vnode, 'physics-paint-photo-reference-band'))).toHaveLength(0);
  });

  it('the eye toggle drives visibleInStudio — aria-pressed reflects it (D-11)', () => {
    const visible = renderHeader({ photoReference: { ...photoReference, visibleInStudio: true } });
    const eyeVisible = findAll(visible, (vnode) => vnode.props['aria-label'] === 'Toggle reference visibility');
    expect(eyeVisible[0].props['aria-pressed']).toBe('true');

    const hidden = renderHeader({ photoReference: { ...photoReference, visibleInStudio: false } });
    const eyeHidden = findAll(hidden, (vnode) => vnode.props['aria-label'] === 'Toggle reference visibility');
    expect(eyeHidden[0].props['aria-pressed']).toBe('false');
  });

  it('the CTA reads Import images when no source and Replace source when a source exists (D-03)', () => {
    const noSource = renderHeader({ photoReference: null });
    expect(findAll(noSource, (vnode) => vnode.props['aria-label'] === 'Import images')).toHaveLength(1);
    expect(findAll(noSource, (vnode) => vnode.props['aria-label'] === 'Replace source')).toHaveLength(0);

    const withSource = renderHeader({ photoReference });
    expect(findAll(withSource, (vnode) => vnode.props['aria-label'] === 'Replace source')).toHaveLength(1);
    expect(findAll(withSource, (vnode) => vnode.props['aria-label'] === 'Import images')).toHaveLength(0);
  });

  it('fires the eye toggle and Import/Replace intents through their ports', () => {
    const onToggleReferenceVisible = vi.fn();
    const onImportReference = vi.fn();
    const tree = renderHeader({ onToggleReferenceVisible, onImportReference });

    const eye = findAll(tree, (vnode) => vnode.props['aria-label'] === 'Toggle reference visibility')[0];
    (eye.props as { onClick: () => void }).onClick();
    expect(onToggleReferenceVisible).toHaveBeenCalledWith(false);

    const cta = findAll(tree, (vnode) => vnode.props['aria-label'] === 'Replace source')[0];
    (cta.props as { onClick: () => void }).onClick();
    expect(onImportReference).toHaveBeenCalledTimes(1);
  });

  it('the passive band is a muted desaturated tone distinct from every Paint rail color (UI-SPEC)', () => {
    const bandRule = cssRule('.physics-paint-photo-reference-band {');
    expect(bandRule).toContain('background: #5a5e62');
    // Never a Paint rail color (purple/cyan) or the orange selection.
    expect(bandRule).not.toContain('#8b5cf6');
    expect(bandRule).not.toContain('#06b6d4');
    expect(bandRule).not.toContain('#f5a623');
    // The Photo row is never a select target (cursor default, not pointer).
    expect(cssRule('.physics-paint-track-row-photo-reference {')).toContain('cursor: default');
  });
});