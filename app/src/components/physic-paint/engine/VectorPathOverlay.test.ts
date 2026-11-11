// ============================================================
//  61-09 Task 1/2/3 — the vector path overlay.
//
//  Laws pinned here:
//    - the overlay draws one spine polyline plus one marker per
//      anchor, and NOTHING for a hand-painted or off-frame stroke;
//    - the draw gesture: plain click = smooth anchor, Alt+click =
//      corner, adjacency refusal, first-anchor finish, Enter and
//      double-click finish, Escape cancels with zero commits;
//    - the draft is cleared BEFORE the commit runs, so a second
//      Enter in the same tick is a no-op (T-61-30);
//    - the commit is one VectorPathCommit: anchors, renderMode of
//      the active brush, sampled points;
//    - the overlay owns gesture only — no bake, no record call, no
//      engine import (T-61-31).
//
//  Render tests materialize the vnode tree (no DOM environment),
//  following the shipped AquarelleToolRow harness.
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { effect } from '@preact/signals';
import {
  resolveAnchorHandles,
  sampleVectorPath,
  type AquarelleStroke,
  type VectorAnchor,
} from '@efxlab/efx-watercolor/payload';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  aquarelleSelectedTipId,
  aquarelleStrokesRevision,
  captureAquarelleStrokeRegistry,
  getAquarelleEventsForFrame,
  getRecordedAquarellePayloadTimeline,
  getRecordedAquarelleStroke,
  getRecordedAquarelleStrokeEntries,
  recordAquarelleStroke,
  recordAquarelleStrokeWhenEnabled,
  resetAquarelleRecordState,
  updateAquarellePathInScript,
} from '../view/aquarelleRecordState';
import {
  beginAquarellePathEdit,
  listSelectableAquarelleStrokes,
  restoreAquarelleEditSnapshot,
  setAquarelleScriptEditInFlight,
} from '../view/aquarelleStrokeSelection';
import {
  clearVectorAnchorSelection,
  clearVectorDraft,
  enterPathEdit,
  exitPathEdit,
  resetForStudioOpen,
  setVectorAnchorSelection,
  toggleVectorAnchorSelection,
  vectorAnchorSelection,
  vectorDrawDraft,
  vectorPenActive,
  type VectorDraftAnchor,
} from '../view/vectorPathSession';
import {
  buildAnchorWidthCommit,
  buildDraftPath,
  buildVectorStroke,
  uvToScreen,
  type VectorPathCommit,
} from '../view/vectorPathHandles';
import {
  VectorPathOverlay,
  handleVectorPathEditKey,
  handleVectorPathKey,
  handleVectorPathWindowKey,
  vectorPathEditDrag,
  type VectorPathGestureHandlers,
} from './VectorPathOverlay';
import { ScriptStrokeOverlay } from './ScriptStrokeOverlay';
import { buildStrokeBand } from '../view/aquarelleStrokeBand';
import { wireframeMode } from '../view/scriptStrokeEdition';

vi.mock('preact/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact/hooks')>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useState: (initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      () => {},
    ],
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
  };
});

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
    try {
      return materialize((vnode.type as (props: Record<string, unknown>) => unknown)(vnode.props));
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

function nodesWithTestId(tree: unknown, testId: string): TestVNode[] {
  return [...walk(tree)].filter((node) => node.props?.['data-testid'] === testId);
}

const FRAME = 7;
const WIDTH = 1000;
const HEIGHT = 800;

function auto(x: number, y: number): VectorDraftAnchor {
  return { x, y, kind: 'auto' };
}

function bezier(x: number, y: number): VectorDraftAnchor {
  return { x, y, kind: 'bezier', in: { x, y }, out: { x, y } };
}

function vectorStroke(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 40, dry: 30 },
    brushId: 'wc/round-medium',
    points: [
      { x: 0.2, y: 0.5, p: 1, tx: 0, ty: 0, tw: 0 },
      { x: 0.8, y: 0.5, p: 1, tx: 0, ty: 0, tw: 0 },
    ],
    toolOverrides: { ...NEUTRAL_TOOL_OVERRIDES },
    timestamp: 1000,
    playFrame: FRAME,
    anchors: [auto(0.2, 0.5), auto(0.5, 0.5), auto(0.8, 0.5)],
    ...overrides,
  };
}

type TestGestureHandlers = Partial<VectorPathGestureHandlers> & {
  onPathEdit?: (mutationId: number, anchors: readonly VectorAnchor[]) => void;
};

function propsWith(
  entries: readonly (readonly [number, AquarelleStroke])[] = [],
  handlers: TestGestureHandlers = {},
) {
  return {
    width: WIDTH,
    height: HEIGHT,
    getPlayFrame: () => FRAME,
    getRecordedStrokes: () => new Map(entries),
    onCommitPath: handlers.onCommitPath ?? (() => {}),
    onCancelPath: handlers.onCancelPath ?? (() => {}),
    onPathEdit: handlers.onPathEdit ?? (() => {}),
  };
}

function render(tree: unknown): TestVNode | null {
  const materialized = materialize(tree);
  if (materialized === null || materialized === undefined) return null;
  const nodes = [...walk(materialized)];
  return nodes[0] ?? null;
}

function pointerEvent(
  x: number,
  y: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    button: 0,
    altKey: false,
    pointerId: 1,
    clientX: x,
    clientY: y,
    // 61-16: the drag target also exposes the pointer-capture trio, so the
    // capture/release assertions observe the calls the overlay makes.
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT }),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn((): boolean => true),
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  };
}

/** The capture trio the 61-16 drag assertions observe on `currentTarget`. */
interface CaptureStub {
  readonly setPointerCapture: ReturnType<typeof vi.fn>;
  readonly releasePointerCapture: ReturnType<typeof vi.fn>;
  readonly hasPointerCapture: ReturnType<typeof vi.fn>;
}

function captureOf(event: Record<string, unknown>): CaptureStub {
  return event['currentTarget'] as CaptureStub;
}

/** Layer px → document uv for the 1000×800 stub rect. */
function clickAt(uvX: number, uvY: number, overrides: Record<string, unknown> = {}) {
  return pointerEvent(uvX * WIDTH, (1 - uvY) * HEIGHT, overrides);
}

function press(root: TestVNode, event: Record<string, unknown>): void {
  const onPointerDown = root.props['onPointerDown'] as ((e: unknown) => void) | undefined;
  expect(onPointerDown, 'overlay root has no pointer handler').toBeTypeOf('function');
  onPointerDown!(event);
}

function draftAnchors(): readonly VectorDraftAnchor[] {
  return vectorDrawDraft.peek()?.anchors ?? [];
}

beforeEach(() => {
  resetForStudioOpen();
  aquarelleSelectedTipId.value = 'wc/round-medium';
});

afterEach(() => {
  resetForStudioOpen();
  aquarelleSelectedTipId.value = 'wc/round-medium';
  clearVectorDraft();
  wireframeMode.value = false;
});

describe('VectorPathOverlay — rendered geometry (task 1)', () => {
  it('draws nothing when no vector stroke and no draft exist', () => {
    expect(VectorPathOverlay(propsWith())).toBeNull();
  });

  it('draws nothing for a hand-painted stroke (no anchors)', () => {
    expect(VectorPathOverlay(propsWith([[11, vectorStroke({ anchors: undefined })]]))).toBeNull();
    expect(VectorPathOverlay(propsWith([[11, vectorStroke({ anchors: [] })]]))).toBeNull();
  });

  it('draws one spine polyline and exactly one marker per anchor', () => {
    // 61-UAT: the structure is construction chrome — it renders only while the
    // pen is drawing, a path edit is open, or the wireframe view is on.
    vectorPenActive.value = true;
    const tree = render(VectorPathOverlay(propsWith([[11, vectorStroke()]])));
    expect(nodesWithTestId(tree, 'vector-path-spine')).toHaveLength(1);
    expect(nodesWithTestId(tree, 'vector-path-anchor')).toHaveLength(3);
    expect(nodesWithTestId(tree, 'vector-path-handle')).toHaveLength(0);
    expect(nodesWithTestId(tree, 'vector-path-envelope')).toHaveLength(0);
  });

  it('draws two handle markers for a bezier anchor and none for an auto anchor', () => {
    vectorPenActive.value = true;
    const tree = render(
      VectorPathOverlay(
        propsWith([
          [
            11,
            vectorStroke({
              anchors: [auto(0.2, 0.5), { x: 0.6, y: 0.5, kind: 'bezier', in: { x: 0.6, y: 0.6 }, out: { x: 0.6, y: 0.4 } }],
            }),
          ],
        ]),
      ),
    );
    expect(nodesWithTestId(tree, 'vector-path-anchor')).toHaveLength(2);
    expect(nodesWithTestId(tree, 'vector-path-handle')).toHaveLength(2);
  });

  it('draws no structure on an idle frame, so the render stays unobstructed', () => {
    // 61-UAT: every vector path's spine sat on top of the painted result with no
    // way to see the final frame. The chrome belongs to the construction states.
    expect(VectorPathOverlay(propsWith([[11, vectorStroke()]]))).toBeNull();
    wireframeMode.value = true;
    expect(VectorPathOverlay(propsWith([[11, vectorStroke()]]))).not.toBeNull();
  });

  it('skips strokes painted on another frame', () => {
    expect(
      VectorPathOverlay(propsWith([[12, vectorStroke({ playFrame: FRAME + 1 })]])),
    ).toBeNull();
  });

  it('mounts the pointer surface while the pen is active with an empty draft', () => {
    vectorPenActive.value = true;
    const root = render(VectorPathOverlay(propsWith()));
    expect(root).not.toBeNull();
    expect(root!.props['onPointerDown']).toBeTypeOf('function');
  });

  it('mounts no pointer surface at all while idle, and one while the pen is active', () => {
    // 61-UAT: an idle frame mounts nothing, so the final render is untouched by
    // both the chrome and the pointer surface.
    expect(VectorPathOverlay(propsWith([[11, vectorStroke()]]))).toBeNull();
    vectorPenActive.value = true;
    const active = render(VectorPathOverlay(propsWith([[11, vectorStroke()]])));
    expect(active!.props['style']).toMatchObject({ pointerEvents: 'auto' });
  });
});

describe('VectorPathOverlay — draw gesture (task 2)', () => {
  beforeEach(() => {
    vectorPenActive.value = true;
  });

  it('places a smooth anchor per plain click', () => {
    const root = render(VectorPathOverlay(propsWith()))!;
    press(root, clickAt(0.5, 0.5));
    press(root, clickAt(0.7, 0.4));
    expect(draftAnchors()).toEqual([auto(0.5, 0.5), auto(0.7, 0.4)]);
  });

  it('places a corner (bezier with zero-length handles) on Alt+click', () => {
    const root = render(VectorPathOverlay(propsWith()))!;
    press(root, clickAt(0.5, 0.5));
    press(root, clickAt(0.7, 0.4, { altKey: true }));
    expect(draftAnchors()).toEqual([auto(0.5, 0.5), bezier(0.7, 0.4)]);
  });

  it('refuses a click within the adjacency radius of the last anchor', () => {
    const root = render(VectorPathOverlay(propsWith()))!;
    press(root, clickAt(0.5, 0.5));
    // 5 screen px to the right on a 1000px sheet — inside ADJACENCY_MIN_PX.
    press(root, clickAt(0.505, 0.5));
    expect(draftAnchors()).toHaveLength(1);
  });

  it('finishes at the first anchor without appending a closing anchor', () => {
    const onCommitPath = vi.fn();
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.2, 0.5));
    press(root, clickAt(0.6, 0.5));
    press(root, clickAt(0.202, 0.5));
    expect(onCommitPath).toHaveBeenCalledTimes(1);
    const commit = onCommitPath.mock.calls[0]![0] as { anchors: readonly VectorDraftAnchor[] };
    expect(commit.anchors).toHaveLength(2);
    expect(vectorDrawDraft.peek()).toBeNull();
  });

  it('finishes on Enter and commits exactly once', () => {
    const onCommitPath = vi.fn();
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.2, 0.5));
    press(root, clickAt(0.6, 0.5));
    handleVectorPathKey({ key: 'Enter' }, { onCommitPath, onCancelPath: () => {} });
    expect(onCommitPath).toHaveBeenCalledTimes(1);
    expect(vectorDrawDraft.peek()).toBeNull();
  });

  it('finishes on a double-click', () => {
    const onCommitPath = vi.fn();
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.2, 0.5));
    press(root, clickAt(0.6, 0.5));
    // Preact's DOM event prop is `onDblClick` (it binds the real `dblclick`).
    const onDoubleClick = root.props['onDblClick'] as ((e: unknown) => void) | undefined;
    expect(onDoubleClick, 'overlay root has no double-click handler').toBeTypeOf('function');
    onDoubleClick!({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(onCommitPath).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape with zero commits', () => {
    const onCommitPath = vi.fn();
    const onCancelPath = vi.fn();
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath, onCancelPath })))!;
    press(root, clickAt(0.2, 0.5));
    press(root, clickAt(0.6, 0.5));
    handleVectorPathKey({ key: 'Escape' }, { onCommitPath, onCancelPath });
    expect(onCommitPath).not.toHaveBeenCalled();
    expect(onCancelPath).toHaveBeenCalledTimes(1);
    expect(vectorDrawDraft.peek()).toBeNull();
  });

  it('commits nothing for a zero- or one-anchor path and never throws', () => {
    const onCommitPath = vi.fn();
    expect(() =>
      handleVectorPathKey({ key: 'Enter' }, { onCommitPath, onCancelPath: () => {} }),
    ).not.toThrow();
    expect(onCommitPath).not.toHaveBeenCalled();
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.3, 0.5));
    handleVectorPathKey({ key: 'Enter' }, { onCommitPath, onCancelPath: () => {} });
    expect(onCommitPath).not.toHaveBeenCalled();
    expect(vectorDrawDraft.peek()).toBeNull();
  });

  it('clears the draft BEFORE the commit so a same-tick second Enter is a no-op', () => {
    const onCommitPath = vi.fn((commit: unknown) => {
      expect(vectorDrawDraft.peek(), 'draft was still live inside the commit').toBeNull();
      expect(commit).toBeTruthy();
    });
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.3, 0.5));
    press(root, clickAt(0.7, 0.5));
    const handlers = { onCommitPath, onCancelPath: () => {} };
    handleVectorPathKey({ key: 'Enter' }, handlers);
    handleVectorPathKey({ key: 'Enter' }, handlers);
    expect(onCommitPath).toHaveBeenCalledTimes(1);
  });

  it('commits the draft anchors, the active brush mode and the sampled points', () => {
    const onCommitPath = vi.fn();
    aquarelleSelectedTipId.value = 'simple-ribbon';
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.3, 0.5));
    press(root, clickAt(0.7, 0.5));
    handleVectorPathKey({ key: 'Enter' }, { onCommitPath, onCancelPath: () => {} });
    const commit = onCommitPath.mock.calls[0]![0] as {
      anchors: readonly VectorDraftAnchor[];
      renderMode: string;
      points: readonly { x: number; y: number }[];
    };
    expect(commit.anchors).toEqual([auto(0.3, 0.5), auto(0.7, 0.5)]);
    expect(commit.renderMode).toBe('simple-ribbon');
    expect(commit.points).toEqual(buildDraftPath([auto(0.3, 0.5), auto(0.7, 0.5)]).points);
  });

  it('prevents default and stops propagation so no paint stroke starts underneath', () => {
    const root = render(VectorPathOverlay(propsWith()))!;
    const event = clickAt(0.5, 0.5);
    press(root, event);
    expect((event['preventDefault'] as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((event['stopPropagation'] as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('binds the key listener while the pen or a path edit is active and removes it on cleanup', () => {
    const source = readFileSync(resolve(__dirname, './VectorPathOverlay.tsx'), 'utf8');
    expect(source).toContain("window.addEventListener('keydown'");
    expect(source).toContain("window.removeEventListener('keydown'");
    // 61-10: the same listener carries the open path edit's Delete/Backspace.
    expect(source).toContain('if (!penActive && editMutationId === null) return');
  });
});

// 61-21 (IN-01): the draw state shows the curve the NEXT click will produce.
// A pointer move writes the draft's `cursor` station through the one session
// writer and the overlay draws a provisional dashed spine from the last placed
// anchor to it. Nothing is placed, recorded or committed by a move (D-06).
describe('61-21 IN-01 — the live rubber band', () => {
  const DRAFT_ANCHORS = [auto(0.2, 0.5), auto(0.6, 0.5)] as const;
  const CURSOR = { x: 0.8, y: 0.4 };

  beforeEach(() => {
    resetAquarelleRecordState();
    resetForStudioOpen();
    vectorPenActive.value = true;
  });

  afterEach(() => {
    exitPathEdit();
    resetAquarelleRecordState();
    resetForStudioOpen();
  });

  it('draws one provisional spine to the cursor, and none without a cursor', () => {
    vectorDrawDraft.value = { anchors: [...DRAFT_ANCHORS], cursor: CURSOR };
    const tree = render(VectorPathOverlay(propsWith()));
    const previews = nodesWithTestId(tree, 'vector-path-draft-preview');
    expect(previews).toHaveLength(1);

    // The points are the ONE spine module's samples of anchors + cursor,
    // screen-projected — never a hand-drawn chord.
    const expected = sampleVectorPath([...DRAFT_ANCHORS, { ...CURSOR, kind: 'auto' }]).points
      .map((point) => {
        const at = uvToScreen(point, WIDTH, HEIGHT);
        return `${at.x},${at.y}`;
      })
      .join(' ');
    expect(previews[0]!.props['points']).toBe(expected);
    expect(previews[0]!.props['fill']).toBe('none');
    expect(previews[0]!.props['strokeDasharray']).toBe('4 3');

    // No cursor station = no rubber band.
    vectorDrawDraft.value = { anchors: [...DRAFT_ANCHORS], cursor: null };
    expect(
      nodesWithTestId(render(VectorPathOverlay(propsWith())), 'vector-path-draft-preview'),
    ).toHaveLength(0);
  });

  it('never places an anchor or commits from a pointer move, and draws the preview before the spine', () => {
    const onCommitPath = vi.fn();
    vectorDrawDraft.value = { anchors: [...DRAFT_ANCHORS], cursor: null };
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    const onPointerMove = root.props['onPointerMove'] as ((e: unknown) => void) | undefined;
    expect(onPointerMove, 'the draw state has no pointer-move handler').toBeTypeOf('function');

    onPointerMove!(clickAt(CURSOR.x, CURSOR.y));

    expect(vectorDrawDraft.peek()?.cursor).toEqual(CURSOR);
    expect(vectorDrawDraft.peek()?.anchors).toHaveLength(2);
    expect(onCommitPath).not.toHaveBeenCalled();

    // Re-render at the new station: ONE provisional line, still two anchors,
    // and no marker or handle for the cursor.
    const tree = render(VectorPathOverlay(propsWith([], { onCommitPath })));
    const nodes = [...walk(tree)];
    const previews = nodesWithTestId(tree, 'vector-path-draft-preview');
    expect(previews).toHaveLength(1);
    expect(nodesWithTestId(tree, 'vector-path-anchor')).toHaveLength(2);
    expect(nodesWithTestId(tree, 'vector-path-handle')).toHaveLength(0);

    // Drawn BEFORE the committed draft spine, so the placed path stays legible.
    const previewIndex = nodes.findIndex(
      (node) => node.props?.['data-testid'] === 'vector-path-draft-preview',
    );
    const spineIndex = nodes.findIndex(
      (node) => node.props?.['data-testid'] === 'vector-path-spine',
    );
    expect(previewIndex).toBeGreaterThanOrEqual(0);
    expect(spineIndex).toBeGreaterThan(previewIndex);
    expect(onCommitPath).not.toHaveBeenCalled();
  });
});

describe('VectorPathOverlay — one entry per finished path (task 3)', () => {
  const SIZE = { width: WIDTH, height: HEIGHT };
  const HAND_PAINTED_ID = 92001;
  const VECTOR_ID = 92002;

  /**
   * The Studio's stroke-end handler, reduced to the ONE record seam it drives
   * (the plan's scope: the overlay commits, the Studio records).
   */
  function recordCommitAs(mutationId: number) {
    return (commit: VectorPathCommit) => {
      const stroke = buildVectorStroke(commit, {
        color: '#103c65',
        params: { size: 40, dry: 30 },
        brushId: 'wc/round-medium',
        toolOverrides: { ...NEUTRAL_TOOL_OVERRIDES },
        tool: 'brush',
        diffusionFrames: 120,
        timestamp: 4242,
        playFrame: FRAME,
      });
      recordAquarelleStrokeWhenEnabled(true, mutationId, stroke, 'frame-key');
    };
  }

  beforeEach(() => {
    resetAquarelleRecordState();
    vectorPenActive.value = true;
  });

  it('records exactly one entry and one revision bump for a finished path', () => {
    const revisionBefore = aquarelleStrokesRevision.value;
    const onCommitPath = vi.fn(recordCommitAs(VECTOR_ID));
    const handlers = { onCommitPath, onCancelPath: () => {} };
    expect(getRecordedAquarelleStrokeEntries().size).toBe(0);

    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.3, 0.5));
    press(root, clickAt(0.7, 0.5));
    handleVectorPathKey({ key: 'Enter' }, handlers);

    expect(onCommitPath).toHaveBeenCalledTimes(1);
    expect(getRecordedAquarelleStrokeEntries().size).toBe(1);
    expect(getAquarelleEventsForFrame(FRAME)).toHaveLength(1);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);

    // A repeat finish on the cleared draft adds nothing — not a second entry,
    // not a second timeline event, not a second revision bump (T-61-30).
    handleVectorPathKey({ key: 'Enter' }, handlers);
    expect(onCommitPath).toHaveBeenCalledTimes(1);
    expect(getRecordedAquarelleStrokeEntries().size).toBe(1);
    expect(getAquarelleEventsForFrame(FRAME)).toHaveLength(1);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);
  });

  it('records nothing for an empty or one-anchor path — no entry, no serial, no event', () => {
    const revisionBefore = aquarelleStrokesRevision.value;
    const onCommitPath = vi.fn(recordCommitAs(VECTOR_ID));
    const handlers = { onCommitPath, onCancelPath: () => {} };

    // Empty draft.
    handleVectorPathKey({ key: 'Enter' }, handlers);
    // One-anchor draft.
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.3, 0.5));
    handleVectorPathKey({ key: 'Enter' }, handlers);

    expect(onCommitPath).not.toHaveBeenCalled();
    expect(getRecordedAquarelleStrokeEntries().size).toBe(0);
    expect(getAquarelleEventsForFrame(FRAME)).toHaveLength(0);
    // No serial: nothing is listed and nothing was allocated.
    expect(listSelectableAquarelleStrokes(FRAME, SIZE, 'all')).toEqual([]);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore);
  });

  it('lists a committed vector stroke once, keyed by serial, with the hand-painted row shape', () => {
    recordAquarelleStroke(
      HAND_PAINTED_ID,
      vectorStroke({ mutationId: HAND_PAINTED_ID, anchors: undefined }),
      'frame-key',
    );
    const onCommitPath = vi.fn(recordCommitAs(VECTOR_ID));
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.3, 0.5));
    press(root, clickAt(0.7, 0.5));
    handleVectorPathKey({ key: 'Enter' }, { onCommitPath, onCancelPath: () => {} });

    const rows = listSelectableAquarelleStrokes(FRAME, SIZE, 'all');
    const vectorRows = rows.filter((row) => row.mutationId === VECTOR_ID);
    const paintRows = rows.filter((row) => row.mutationId === HAND_PAINTED_ID);
    expect(vectorRows).toHaveLength(1);
    expect(paintRows).toHaveLength(1);
    const vectorRow = vectorRows[0]!;
    const paintRow = paintRows[0]!;

    // One ordinary paint row: no badge, no icon, no vector-only field.
    expect(Object.keys(vectorRow).sort()).toEqual(Object.keys(paintRow).sort());
    expect(vectorRow.kind).toBe('paint');
    expect(vectorRow.kind).toBe(paintRow.kind);
    expect(vectorRow.color).toBe(paintRow.color);
    expect(vectorRow.tool).toBe(paintRow.tool);
    expect(vectorRow.brushId).toBe(paintRow.brushId);
    expect(vectorRow.customResponse).toBe(paintRow.customResponse);

    // Keyed by serial: one row per serial, and the vector row owns its own.
    const serials = rows.map((row) => row.serial);
    expect(new Set(serials).size).toBe(rows.length);
    expect(rows.filter((row) => row.serial === vectorRow.serial)).toHaveLength(1);

    // Shared stack grammar: the vector stroke was recorded last, so it is top.
    expect(rows.map((row) => row.stackTotal)).toEqual([2, 2]);
    expect(vectorRow.stackPosition).toBe(1);
    expect(paintRow.stackPosition).toBe(2);
  });
});

describe('VectorPathOverlay — the path-edit seam (task 1)', () => {
  const EDIT_ID = 93001;

  function editedStroke(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
    return vectorStroke({ mutationId: EDIT_ID, ...overrides });
  }

  beforeEach(() => {
    resetAquarelleRecordState();
    resetForStudioOpen();
    recordAquarelleStroke(EDIT_ID, editedStroke(), 'frame-key');
  });

  afterEach(() => {
    exitPathEdit();
    resetAquarelleRecordState();
  });

  it('replaces the recorded path at the same timeline index, bumps once, and repeats at zero', () => {
    const registryEntry = () =>
      captureAquarelleStrokeRegistry().pairs.find((pair) => pair[0] === EDIT_ID)![2];
    const entryBefore = registryEntry();
    const indexBefore = getRecordedAquarellePayloadTimeline().indexOf(entryBefore);
    expect(indexBefore).toBeGreaterThanOrEqual(0);
    const revisionBefore = aquarelleStrokesRevision.value;
    const nextAnchors: readonly VectorAnchor[] = [auto(0.2, 0.55), auto(0.5, 0.55), auto(0.8, 0.55)];

    expect(updateAquarellePathInScript(EDIT_ID, nextAnchors)).toBe(1);

    const strokeAfter = getRecordedAquarelleStroke(EDIT_ID)!;
    expect(strokeAfter.anchors).toEqual(nextAnchors);
    // Every other field survives the path write.
    expect(strokeAfter.points).toEqual(editedStroke().points);
    expect(strokeAfter.params).toEqual(editedStroke().params);
    const entryAfter = registryEntry();
    expect(entryAfter).not.toBe(entryBefore);
    // SAME index — the replay order never moves.
    expect(getRecordedAquarellePayloadTimeline().indexOf(entryAfter)).toBe(indexBefore);
    // The payload's opaque engine block carries the SAME anchors (T-61-34).
    expect((entryAfter.engine as { anchors?: readonly VectorAnchor[] }).anchors).toEqual(nextAnchors);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);

    // Idempotency: the same call twice stores nothing and bumps nothing.
    expect(updateAquarellePathInScript(EDIT_ID, nextAnchors)).toBe(0);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);
  });

  it('stores exactly ONE edit snapshot for one changed anchor, restores it in one undo, and refuses while in flight', () => {
    const originalAnchors = editedStroke().anchors;
    const revisionBefore = aquarelleStrokesRevision.value;
    const nextAnchors: readonly VectorAnchor[] = [auto(0.25, 0.5), auto(0.5, 0.5), auto(0.8, 0.5)];

    const editId = beginAquarellePathEdit(EDIT_ID, nextAnchors);
    expect(editId).not.toBeNull();
    expect(getRecordedAquarelleStroke(EDIT_ID)!.anchors).toEqual(nextAnchors);

    // ONE edit snapshot for the whole gesture: a single undo restores the
    // pre-drag path. (The ledger entry itself is the Studio's business and is
    // pinned by 61-15's stack-length test, not here.)
    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    expect(getRecordedAquarelleStroke(EDIT_ID)!.anchors).toEqual(originalAnchors);

    // A second path commit while one is in flight is refused and bumps nothing.
    setAquarelleScriptEditInFlight(true);
    expect(
      beginAquarellePathEdit(EDIT_ID, [auto(0.3, 0.5), auto(0.5, 0.5), auto(0.8, 0.5)]),
    ).toBeNull();
    setAquarelleScriptEditInFlight(false);
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 2);
  });

  it('owns the pointer while a path edit is open even with the pen released', () => {
    enterPathEdit(String(EDIT_ID));
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, editedStroke()]])))!;
    expect(root.props['style']).toMatchObject({ pointerEvents: 'auto' });
    expect(root.props['onPointerDown']).toBeTypeOf('function');
  });

  it('drags an anchor and commits ONE onPathEdit carrying the promotion and the moved handles', () => {
    enterPathEdit(String(EDIT_ID));
    const stroke = editedStroke();
    const originalAnchors = stroke.anchors as readonly VectorAnchor[];
    const derived = resolveAnchorHandles(originalAnchors);
    const onPathEdit = vi.fn();
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, stroke]], { onPathEdit })))!;

    press(root, clickAt(0.2, 0.5));
    const onPointerMove = root.props['onPointerMove'] as ((e: unknown) => void) | undefined;
    expect(onPointerMove, 'overlay root has no pointer-move handler').toBeTypeOf('function');
    onPointerMove!(clickAt(0.26, 0.55));
    const onPointerUp = root.props['onPointerUp'] as ((e: unknown) => void) | undefined;
    expect(onPointerUp, 'overlay root has no pointer-up handler').toBeTypeOf('function');
    onPointerUp!(clickAt(0.26, 0.55));

    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [mutationId, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(mutationId).toBe(EDIT_ID);
    expect(anchors).toHaveLength(3);
    const dragged = anchors[0]!;
    expect(dragged.kind).toBe('bezier');
    expect(dragged.x).toBeCloseTo(0.26, 9);
    expect(dragged.y).toBeCloseTo(0.55, 9);
    expect(dragged.in!.x).toBeCloseTo(derived[0]!.in.x + 0.06, 9);
    expect(dragged.in!.y).toBeCloseTo(derived[0]!.in.y + 0.05, 9);
    expect(dragged.out!.x).toBeCloseTo(derived[0]!.out.x + 0.06, 9);
    expect(dragged.out!.y).toBeCloseTo(derived[0]!.out.y + 0.05, 9);
    // The neighbours are untouched.
    expect(anchors[1]).toEqual(originalAnchors[1]);
    expect(anchors[2]).toEqual(originalAnchors[2]);
  });

  it('commits the promotion on a grab-and-release of an auto anchor', () => {
    enterPathEdit(String(EDIT_ID));
    const stroke = editedStroke();
    const derived = resolveAnchorHandles(stroke.anchors as readonly VectorAnchor[]);
    const onPathEdit = vi.fn();
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, stroke]], { onPathEdit })))!;

    press(root, clickAt(0.2, 0.5));
    const onPointerUp = root.props['onPointerUp'] as ((e: unknown) => void) | undefined;
    expect(onPointerUp, 'overlay root has no pointer-up handler').toBeTypeOf('function');
    onPointerUp!(clickAt(0.2, 0.5));

    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(anchors[0]!.kind).toBe('bezier');
    expect(anchors[0]!.in).toEqual(derived[0]!.in);
    expect(anchors[0]!.out).toEqual(derived[0]!.out);
    expect(anchors[0]!.x).toBeCloseTo(0.2, 12);
    expect(anchors[0]!.y).toBeCloseTo(0.5, 12);
  });

  it('commits nothing on a grab-and-release of an already-bezier anchor', () => {
    resetAquarelleRecordState();
    const anchors: readonly VectorAnchor[] = [
      { x: 0.2, y: 0.5, kind: 'bezier', in: { x: 0.15, y: 0.5 }, out: { x: 0.25, y: 0.5 } },
      auto(0.5, 0.5),
      auto(0.8, 0.5),
    ];
    const stroke = editedStroke({ anchors });
    recordAquarelleStroke(EDIT_ID, stroke, 'frame-key');
    enterPathEdit(String(EDIT_ID));
    const onPathEdit = vi.fn();
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, stroke]], { onPathEdit })))!;

    press(root, clickAt(0.2, 0.5));
    const onPointerUp = root.props['onPointerUp'] as ((e: unknown) => void) | undefined;
    expect(onPointerUp, 'overlay root has no pointer-up handler').toBeTypeOf('function');
    onPointerUp!(clickAt(0.2, 0.5));

    expect(onPathEdit).not.toHaveBeenCalled();
  });
});

describe('VectorPathOverlay — handle drag, insert, delete, width (task 2)', () => {
  const EDIT_ID = 94001;

  function editedStroke(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
    return vectorStroke({ mutationId: EDIT_ID, ...overrides });
  }

  const HANDLE_ANCHORS: readonly VectorAnchor[] = [
    { x: 0.2, y: 0.5, kind: 'bezier', in: { x: 0.15, y: 0.5 }, out: { x: 0.25, y: 0.5 } },
    auto(0.5, 0.5),
    auto(0.8, 0.5),
  ];

  function renderHandleStroke(onPathEdit: (id: number, anchors: readonly VectorAnchor[]) => void) {
    const stroke = editedStroke({ anchors: HANDLE_ANCHORS });
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, stroke]], { onPathEdit })))!;
    return { stroke, root };
  }

  beforeEach(() => {
    resetAquarelleRecordState();
    resetForStudioOpen();
    recordAquarelleStroke(EDIT_ID, editedStroke(), 'frame-key');
  });

  afterEach(() => {
    exitPathEdit();
    resetAquarelleRecordState();
  });

  it('drags one handle, mirrors its coupled partner and commits ONCE', () => {
    enterPathEdit(String(EDIT_ID));
    const onPathEdit = vi.fn();
    const { root } = renderHandleStroke(onPathEdit);

    // Grab the OUT handle of anchor 0 (50px from the anchor, inside the handle pad).
    press(root, clickAt(0.25, 0.5));
    const onPointerMove = root.props['onPointerMove'] as ((e: unknown) => void) | undefined;
    expect(onPointerMove, 'overlay root has no pointer-move handler').toBeTypeOf('function');
    onPointerMove!(clickAt(0.3, 0.5));
    const onPointerUp = root.props['onPointerUp'] as ((e: unknown) => void) | undefined;
    expect(onPointerUp, 'overlay root has no pointer-up handler').toBeTypeOf('function');
    onPointerUp!(clickAt(0.3, 0.5));

    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [mutationId, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(mutationId).toBe(EDIT_ID);
    expect(anchors[0]!.kind).toBe('bezier');
    expect(anchors[0]!.out!.x).toBeCloseTo(0.3, 9);
    expect(anchors[0]!.out!.y).toBeCloseTo(0.5, 9);
    // Coupled: the partner is the point reflection about the anchor (0.2, 0.5).
    expect(anchors[0]!.in!.x).toBeCloseTo(0.1, 9);
    expect(anchors[0]!.in!.y).toBeCloseTo(0.5, 9);
    // The neighbours are untouched.
    expect(anchors[1]).toEqual(HANDLE_ANCHORS[1]);
    expect(anchors[2]).toEqual(HANDLE_ANCHORS[2]);
  });

  it('leaves the partner untouched when Alt breaks the coupling', () => {
    enterPathEdit(String(EDIT_ID));
    const onPathEdit = vi.fn();
    const { root } = renderHandleStroke(onPathEdit);

    press(root, clickAt(0.25, 0.5));
    const onPointerMove = root.props['onPointerMove'] as ((e: unknown) => void) | undefined;
    onPointerMove!(clickAt(0.3, 0.5, { altKey: true }));
    const onPointerUp = root.props['onPointerUp'] as ((e: unknown) => void) | undefined;
    expect(onPointerUp, 'overlay root has no pointer-up handler').toBeTypeOf('function');
    onPointerUp!(clickAt(0.3, 0.5, { altKey: true }));

    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(anchors[0]!.out!.x).toBeCloseTo(0.3, 9);
    expect(anchors[0]!.in).toEqual({ x: 0.15, y: 0.5 });
    // Byte-identical: the broken partner is carried, not rebuilt.
    expect(anchors[0]!.in).toBe(HANDLE_ANCHORS[0]!.in);
    expect(anchors[0]!.kind).toBe('bezier');
  });

  it('inserts one anchor on a spine click, commits ONCE and selects it', () => {
    enterPathEdit(String(EDIT_ID));
    const stroke = editedStroke();
    const originalAnchors = stroke.anchors as readonly VectorAnchor[];
    const onPathEdit = vi.fn();
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, stroke]], { onPathEdit })))!;

    // 150px from both anchors, on the chord — no anchor or handle can win.
    press(root, clickAt(0.35, 0.5));

    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [mutationId, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(mutationId).toBe(EDIT_ID);
    expect(anchors).toHaveLength(4);
    expect(anchors[0]).toEqual(originalAnchors[0]);
    expect(anchors[1]!.kind).toBe('auto');
    expect(anchors[1]!.x).toBeCloseTo(0.35, 2);
    expect(anchors[2]).toEqual(originalAnchors[1]);
    expect(anchors[3]).toEqual(originalAnchors[2]);
    // The inserted anchor is the new selection (the ONE session signal).
    expect(vectorAnchorSelection.peek()).toEqual([1]);
  });

  it('keeps ONE ascending, deduplicated selection and clears it on exit and reset', () => {
    resetForStudioOpen();
    expect(vectorAnchorSelection.peek()).toEqual([]);
    setVectorAnchorSelection([2, 0, 2]);
    expect(vectorAnchorSelection.peek()).toEqual([0, 2]);
    toggleVectorAnchorSelection(1);
    expect(vectorAnchorSelection.peek()).toEqual([0, 1, 2]);
    toggleVectorAnchorSelection(1);
    expect(vectorAnchorSelection.peek()).toEqual([0, 2]);
    // Idempotent: a repeated identical write notifies nothing.
    let runs = 0;
    const dispose = effect(() => {
      void vectorAnchorSelection.value;
      runs += 1;
    });
    setVectorAnchorSelection([2, 0]);
    expect(runs).toBe(1);
    dispose();

    enterPathEdit('7');
    setVectorAnchorSelection([1]);
    exitPathEdit();
    expect(vectorAnchorSelection.peek()).toEqual([]);
    setVectorAnchorSelection([1]);
    resetForStudioOpen();
    expect(vectorAnchorSelection.peek()).toEqual([]);
    clearVectorAnchorSelection();
    expect(vectorAnchorSelection.peek()).toEqual([]);
  });

  it('deletes every selected anchor in ONE commit and clears the selection', () => {
    enterPathEdit(String(EDIT_ID));
    const stroke = editedStroke();
    const originalAnchors = stroke.anchors as readonly VectorAnchor[];
    setVectorAnchorSelection([0, 2]);
    const onPathEdit = vi.fn();
    const event = { key: 'Delete', preventDefault: vi.fn(), stopPropagation: vi.fn() };
    handleVectorPathEditKey(event, {
      getRecordedStrokes: () => new Map([[EDIT_ID, stroke]]),
      onPathEdit,
    });

    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [mutationId, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(mutationId).toBe(EDIT_ID);
    expect(anchors).toEqual([originalAnchors[1]]);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vectorAnchorSelection.peek()).toEqual([]);
  });

  it('handles delete keys only while a path edit owns a non-empty selection', () => {
    const onPathEdit = vi.fn();
    const handlers = {
      getRecordedStrokes: () => new Map([[EDIT_ID, editedStroke()]]),
      onPathEdit,
    };

    // No path edit open.
    setVectorAnchorSelection([0]);
    handleVectorPathEditKey({ key: 'Delete' }, handlers);
    expect(onPathEdit).not.toHaveBeenCalled();

    // Edit open, empty selection.
    enterPathEdit(String(EDIT_ID));
    clearVectorAnchorSelection();
    handleVectorPathEditKey({ key: 'Delete' }, handlers);
    expect(onPathEdit).not.toHaveBeenCalled();

    // Not a delete key.
    setVectorAnchorSelection([0]);
    handleVectorPathEditKey({ key: 'a' }, handlers);
    expect(onPathEdit).not.toHaveBeenCalled();

    // Backspace deletes too.
    handleVectorPathEditKey({ key: 'Backspace' }, handlers);
    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(anchors).toHaveLength(2);
  });

  it('writes a three-anchor width commit as ONE edit snapshot that one undo restores', () => {
    const originalAnchors = editedStroke().anchors as readonly VectorAnchor[];
    const revisionBefore = aquarelleStrokesRevision.value;
    const next = buildAnchorWidthCommit(originalAnchors, [0, 1, 2], 1.8);
    const editId = beginAquarellePathEdit(EDIT_ID, next);
    expect(editId).not.toBeNull();

    const after = getRecordedAquarelleStroke(EDIT_ID)!;
    expect(after.anchors!.map((anchor) => anchor.width)).toEqual([1.8, 1.8, 1.8]);
    // ONE bump for the whole multi-anchor write — a per-anchor loop would be +3.
    expect(aquarelleStrokesRevision.value).toBe(revisionBefore + 1);

    // One undo restores all three factors at once.
    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    expect(getRecordedAquarelleStroke(EDIT_ID)!.anchors).toEqual(originalAnchors);
  });

  it('binds the edit key listener for an open path edit and unbinds it on cleanup', () => {
    const source = readFileSync(resolve(__dirname, './VectorPathOverlay.tsx'), 'utf8');
    // 61-16: `window` binds ONE guarded dispatcher, not the two pure handlers
    // (the capture-phase listener must see the event target first).
    expect(source).toContain(
      'handleVectorPathWindowKey(event, handlersRef.current, editKeyHandlersRef.current)',
    );
    expect(source).toContain('window.addEventListener(\'keydown\', onKeyDown, true)');
    expect(source).toContain('[penActive, editMutationId]');
    expect(source).toContain("window.removeEventListener('keydown'");
  });
});

// 61-16 (G-3 / CR-01): a path-edit drag owns the pointer for its WHOLE
// lifetime. The press captures on the overlay root, so a move or a release
// outside the overlay still reaches the drag; the release happens on BOTH
// exits — after the commit decision on finish, and on cancel without a commit.
// The insert-on-spine click is a completed gesture at pointerdown and opens no
// drag state, so it must take no capture. A release is never attempted against
// a pointer the element no longer holds.
describe('VectorPathOverlay — the pointer-capture law (61-16)', () => {
  const EDIT_ID = 96001;

  function editedStroke(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
    return vectorStroke({ mutationId: EDIT_ID, ...overrides });
  }

  const HANDLE_ANCHORS: readonly VectorAnchor[] = [
    { x: 0.2, y: 0.5, kind: 'bezier', in: { x: 0.15, y: 0.5 }, out: { x: 0.25, y: 0.5 } },
    auto(0.5, 0.5),
    auto(0.8, 0.5),
  ];

  beforeEach(() => {
    resetAquarelleRecordState();
    resetForStudioOpen();
    recordAquarelleStroke(EDIT_ID, editedStroke(), 'frame-key');
    enterPathEdit(String(EDIT_ID));
  });

  afterEach(() => {
    exitPathEdit();
    resetAquarelleRecordState();
  });

  it('captures the pointer at an anchor press, and the drag still commits on up', () => {
    const onPathEdit = vi.fn();
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, editedStroke()]], { onPathEdit })))!;

    const down = clickAt(0.2, 0.5);
    press(root, down);
    const capture = captureOf(down);
    expect(capture.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(capture.setPointerCapture).toHaveBeenCalledWith(1);

    const onPointerMove = root.props['onPointerMove'] as ((e: unknown) => void) | undefined;
    expect(onPointerMove, 'overlay root has no pointer-move handler').toBeTypeOf('function');
    onPointerMove!(clickAt(0.26, 0.55));
    const onPointerUp = root.props['onPointerUp'] as ((e: unknown) => void) | undefined;
    expect(onPointerUp, 'overlay root has no pointer-up handler').toBeTypeOf('function');
    onPointerUp!(clickAt(0.26, 0.55));

    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(anchors[0]!.x).toBeCloseTo(0.26, 9);
    expect(anchors[0]!.y).toBeCloseTo(0.55, 9);
  });

  it('captures the pointer at a handle press and commits the handle drag on up', () => {
    resetAquarelleRecordState();
    const stroke = editedStroke({ anchors: HANDLE_ANCHORS });
    recordAquarelleStroke(EDIT_ID, stroke, 'frame-key');
    const onPathEdit = vi.fn();
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, stroke]], { onPathEdit })))!;

    // The OUT handle of anchor 0 sits at (0.25, 0.5).
    const down = clickAt(0.25, 0.5);
    press(root, down);
    const capture = captureOf(down);
    expect(capture.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(capture.setPointerCapture).toHaveBeenCalledWith(1);

    (root.props['onPointerMove'] as (e: unknown) => void)(clickAt(0.3, 0.5));
    (root.props['onPointerUp'] as (e: unknown) => void)(clickAt(0.3, 0.5));

    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(anchors[0]!.out!.x).toBeCloseTo(0.3, 9);
  });

  it('releases the capture AFTER the commit decision, on the drag pointer id', () => {
    const order: string[] = [];
    const onPathEdit = vi.fn(() => {
      order.push('commit');
    });
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, editedStroke()]], { onPathEdit })))!;

    press(root, clickAt(0.2, 0.5));
    (root.props['onPointerMove'] as (e: unknown) => void)(clickAt(0.26, 0.55));

    const up = clickAt(0.26, 0.55);
    const release = captureOf(up).releasePointerCapture;
    release.mockImplementation(() => {
      order.push('release');
    });
    (root.props['onPointerUp'] as (e: unknown) => void)(up);

    expect(onPathEdit).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(1);
    expect(order).toEqual(['commit', 'release']);
  });

  it('releases the capture on cancel and commits nothing', () => {
    const onPathEdit = vi.fn();
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, editedStroke()]], { onPathEdit })))!;

    press(root, clickAt(0.2, 0.5));
    const cancel = clickAt(0.4, 0.4);
    (root.props['onPointerCancel'] as (e: unknown) => void)(cancel);

    expect(onPathEdit).not.toHaveBeenCalled();
    const release = captureOf(cancel).releasePointerCapture;
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(1);
    // The gesture is over: a later move finds no drag state.
    (root.props['onPointerMove'] as (e: unknown) => void)(clickAt(0.5, 0.5));
    expect(onPathEdit).not.toHaveBeenCalled();
  });

  it('takes no capture for the insert-on-spine click and still commits once', () => {
    const onPathEdit = vi.fn();
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, editedStroke()]], { onPathEdit })))!;

    // 150px from both anchors, on the chord — the insert branch, not a drag.
    const down = clickAt(0.35, 0.5);
    press(root, down);
    const capture = captureOf(down);
    expect(onPathEdit).toHaveBeenCalledTimes(1);
    expect((onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]])[1]).toHaveLength(4);
    expect(capture.setPointerCapture).not.toHaveBeenCalled();
    expect(capture.releasePointerCapture).not.toHaveBeenCalled();
  });

  it('releases only a pointer the target still holds, and never throws', () => {
    const onPathEdit = vi.fn();
    const root = render(VectorPathOverlay(propsWith([[EDIT_ID, editedStroke()]], { onPathEdit })))!;

    press(root, clickAt(0.2, 0.5));
    (root.props['onPointerMove'] as (e: unknown) => void)(clickAt(0.26, 0.55));

    const up = clickAt(0.26, 0.55);
    const capture = captureOf(up);
    capture.hasPointerCapture.mockReturnValue(false);
    expect(() => (root.props['onPointerUp'] as (e: unknown) => void)(up)).not.toThrow();

    // A lost pointer is not released — there is nothing to release.
    expect(capture.releasePointerCapture).not.toHaveBeenCalled();
    // The commit is unaffected by the lost capture.
    expect(onPathEdit).toHaveBeenCalledTimes(1);
    expect(vectorPathEditDrag.peek()).toBeNull();
  });
});

// 61-16 (G-4 / CR-02): the window keydown listener is a CAPTURE-phase listener
// on `window`, so it sees every keystroke in the Studio — including the ones the
// user aims at a focused input. The dispatcher yields to any text-entry target
// before either pure key handler runs: Enter submits the dialog, Backspace edits
// the text, and no `preventDefault` is called. Everywhere else the vector keys
// act exactly as before.
describe('VectorPathOverlay — the text-entry key guard (61-16)', () => {
  const EDIT_ID = 96002;

  function editedStroke(): AquarelleStroke {
    return vectorStroke({ mutationId: EDIT_ID });
  }

  beforeEach(() => {
    resetAquarelleRecordState();
    resetForStudioOpen();
    // The two draft cases press on the overlay, which mounts only while the
    // pen owns the surface.
    vectorPenActive.value = true;
  });

  afterEach(() => {
    exitPathEdit();
    resetAquarelleRecordState();
  });

  it('stands down on Enter while a dialog text field has focus', () => {
    const onCommitPath = vi.fn();
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    // Two presses build a committable draft, so only the target guard can
    // refuse the Enter below.
    press(root, clickAt(0.3, 0.5));
    press(root, clickAt(0.7, 0.5));
    expect(draftAnchors()).toHaveLength(2);

    const event = {
      key: 'Enter',
      target: { tagName: 'INPUT' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    handleVectorPathWindowKey(
      event,
      { onCommitPath, onCancelPath: () => {} },
      { getRecordedStrokes: () => new Map(), onPathEdit: () => {} },
    );

    expect(onCommitPath).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    // The draft is untouched: leaving the input and pressing Enter still commits.
    expect(draftAnchors()).toHaveLength(2);
  });

  it('still commits the draft when focus sits outside a text field', () => {
    const onCommitPath = vi.fn();
    const root = render(VectorPathOverlay(propsWith([], { onCommitPath })))!;
    press(root, clickAt(0.3, 0.5));
    press(root, clickAt(0.7, 0.5));

    const event = {
      key: 'Enter',
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    handleVectorPathWindowKey(
      event,
      { onCommitPath, onCancelPath: () => {} },
      { getRecordedStrokes: () => new Map(), onPathEdit: () => {} },
    );

    expect(onCommitPath).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('stands down on Backspace in a textarea and still deletes on the canvas', () => {
    recordAquarelleStroke(EDIT_ID, editedStroke(), 'frame-key');
    enterPathEdit(String(EDIT_ID));
    setVectorAnchorSelection([0]);
    const onPathEdit = vi.fn();
    const editHandlers = {
      getRecordedStrokes: () => new Map([[EDIT_ID, editedStroke()]]),
      onPathEdit,
    };
    const draftHandlers = { onCommitPath: () => {}, onCancelPath: () => {} };

    const inText = {
      key: 'Backspace',
      target: { tagName: 'TEXTAREA' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    handleVectorPathWindowKey(inText, draftHandlers, editHandlers);
    expect(onPathEdit).not.toHaveBeenCalled();
    expect(inText.preventDefault).not.toHaveBeenCalled();
    expect(vectorAnchorSelection.peek()).toEqual([0]);

    const onCanvas = {
      key: 'Backspace',
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    handleVectorPathWindowKey(onCanvas, draftHandlers, editHandlers);
    expect(onPathEdit).toHaveBeenCalledTimes(1);
    const [mutationId, anchors] = onPathEdit.mock.calls[0] as [number, readonly VectorAnchor[]];
    expect(mutationId).toBe(EDIT_ID);
    expect(anchors).toHaveLength(2);
  });
});

describe('VectorPathOverlay — authority boundary (T-61-31)', () => {
  it('never imports an engine, bake or adapter module and never records', () => {
    const source = readFileSync(resolve(__dirname, './VectorPathOverlay.tsx'), 'utf8');
    expect(source).not.toContain('captureFrame');
    expect(source).not.toContain('scriptBegin');
    expect(source).not.toContain('applyStroke');
    expect(source).not.toContain('recordAquarelleStroke');
    expect(source).not.toContain('aquarelleEnginePort');
    expect(source).not.toContain('aquarelleFootprint');
    // 61-10: the overlay asks for an edit; the Studio owns history.
    expect(source).not.toContain('updateAquarellePathInScript');
    expect(source).not.toContain('beginAquarellePathEdit');
  });

  it('is mounted beside the stroke overlay and forwards to props.onStrokeEnd', () => {
    const layer = readFileSync(resolve(__dirname, './AquarelleCanvasLayer.tsx'), 'utf8');
    expect(layer).toContain('<VectorPathOverlay');
    expect(layer).toContain('buildVectorStroke(');
    expect(layer).toContain('onStrokeEndRef.current?.(');
    expect(layer).not.toContain('recordAquarelleStroke');
  });
});

// 61-13 Task 2: the wireframe drawing law. Under the session latch every
// recorded vector stroke on the play frame draws its CONSTRUCTION geometry
// (envelope, spine, rungs at explicit widths, anchors, bezier handles), while
// every hand-painted stroke draws the SHIPPED buildStrokeBand footprint — the
// vector overlay owns construction, the stroke overlay owns the band. Nothing
// here is persisted or exported: the latch is display-only (D-16).
describe('VectorPathOverlay — the wireframe drawing law (61-13)', () => {
  const SIZE = { width: WIDTH, height: HEIGHT };

  beforeEach(() => {
    resetAquarelleRecordState();
    resetForStudioOpen();
  });

  afterEach(() => {
    wireframeMode.value = false;
    resetAquarelleRecordState();
    resetForStudioOpen();
  });

  function mixedStroke(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
    return vectorStroke({
      anchors: [
        auto(0.2, 0.5),
        { x: 0.5, y: 0.5, kind: 'bezier', in: { x: 0.5, y: 0.62 }, out: { x: 0.5, y: 0.38 } },
        auto(0.8, 0.5),
      ],
      ...overrides,
    });
  }

  function portOver(rows: ReturnType<typeof listSelectableAquarelleStrokes>) {
    return {
      isActive: () => false,
      listStrokes: () => rows,
      hitTestStroke: () => null,
      deleteStrokes: () => {},
      moveStrokes: () => {},
      transformStrokes: () => {},
      stepStroke: () => {},
    };
  }

  function overlayProps(port: ReturnType<typeof portOver>) {
    return {
      width: WIDTH,
      height: HEIGHT,
      getPlayFrame: () => FRAME,
      port,
      selectMode: false,
      moveArmed: false,
      onDeleteStrokes: () => {},
      onMoveStrokes: () => {},
      testId: 'stroke-overlay-wireframe',
      badgeTestId: 'stroke-badge-wireframe',
      ghostTestId: 'stroke-ghost-wireframe',
    };
  }

  it('draws the envelope, spine, anchors and handles of every recorded vector stroke', () => {
    wireframeMode.value = true;
    const tree = render(VectorPathOverlay(propsWith([[11, mixedStroke()]])));
    expect(nodesWithTestId(tree, 'vector-path-envelope')).toHaveLength(1);
    expect(nodesWithTestId(tree, 'vector-path-spine')).toHaveLength(1);
    expect(nodesWithTestId(tree, 'vector-path-anchor')).toHaveLength(3);
    expect(nodesWithTestId(tree, 'vector-path-handle')).toHaveLength(2);
    expect(nodesWithTestId(tree, 'vector-path-rung')).toHaveLength(0);
  });

  it('draws a rung only at an anchor carrying an explicit width', () => {
    wireframeMode.value = true;
    const widthless = render(VectorPathOverlay(propsWith([[11, mixedStroke()]])));
    expect(nodesWithTestId(widthless, 'vector-path-rung')).toHaveLength(0);

    const weighted = render(
      VectorPathOverlay(
        propsWith([
          [
            12,
            vectorStroke({
              anchors: [auto(0.2, 0.5), { x: 0.5, y: 0.5, kind: 'auto', width: 1.8 }, auto(0.8, 0.5)],
            }),
          ],
        ]),
      ),
    );
    expect(nodesWithTestId(weighted, 'vector-path-rung')).toHaveLength(1);
  });

  it('draws anchor shapes per kind — square only for bezier — and no handle for auto', () => {
    wireframeMode.value = true;
    const tree = render(VectorPathOverlay(propsWith([[11, mixedStroke()]])));
    const anchors = nodesWithTestId(tree, 'vector-path-anchor');
    expect(anchors.filter((node) => node.type === 'rect')).toHaveLength(1);
    expect(anchors.filter((node) => node.type === 'circle')).toHaveLength(2);
    // Both marker kinds wear the dark hairline under wireframe.
    for (const node of anchors) expect(node.props?.stroke).toBe('#111111');
    // One bezier anchor → exactly its two handles.
    expect(nodesWithTestId(tree, 'vector-path-handle')).toHaveLength(2);
  });

  it('draws the shipped buildStrokeBand footprint and the centreline for a hand-painted stroke', () => {
    const stroke = vectorStroke({ mutationId: 95001, anchors: undefined });
    recordAquarelleStroke(95001, stroke, 'frame-key');
    wireframeMode.value = true;
    const rows = listSelectableAquarelleStrokes(FRAME, SIZE, 'all');
    expect(rows).toHaveLength(1);

    const tree = render(ScriptStrokeOverlay(overlayProps(portOver(rows))));
    const bands = nodesWithTestId(tree, 'stroke-size-band');
    expect(bands).toHaveLength(1);
    // The band is the shipped builder's OWN polygon — never hand-written values.
    const expected = buildStrokeBand(stroke, SIZE).polygonPx;
    const expectedPath = `M${expected.map((point) => `${point.x},${point.y}`).join(' L')} Z`;
    expect(bands[0]!.props.d).toBe(expectedPath);
    // The centreline rides WITH the band under wireframe (the default branch
    // still draws it): the two-pass outline, dark under light.
    expect([...walk(tree)].filter((node) => node.type === 'polyline')).toHaveLength(2);
    // Display-only: the surface is mounted but never owns a pointer.
    expect(tree!.props['style']).toMatchObject({ pointerEvents: 'none' });
    expect(tree!.props['onPointerDown']).toBeUndefined();
  });

  it('leaves a vector stroke to the construction overlay — no band for it', () => {
    recordAquarelleStroke(95002, vectorStroke({ mutationId: 95002 }), 'frame-key');
    wireframeMode.value = true;
    const rows = listSelectableAquarelleStrokes(FRAME, SIZE, 'all');
    const tree = render(ScriptStrokeOverlay(overlayProps(portOver(rows))));
    expect(nodesWithTestId(tree, 'stroke-size-band')).toHaveLength(0);
  });

  it('renders no geometry and throws nothing when the anchors fail normalisation', () => {
    wireframeMode.value = true;
    const malformed = vectorStroke({
      anchors: [
        { x: Number.NaN, y: 0.5, kind: 'auto' },
        { x: Number.POSITIVE_INFINITY, y: 0.5, kind: 'auto' },
      ] as VectorAnchor[],
    });
    let tree: unknown = null;
    expect(() => {
      tree = VectorPathOverlay(propsWith([[11, malformed]]));
    }).not.toThrow();
    expect(tree).toBeNull();
  });

  it('renders no overlay elements for an empty sheet', () => {
    wireframeMode.value = true;
    expect(VectorPathOverlay(propsWith())).toBeNull();
    expect(ScriptStrokeOverlay(overlayProps(portOver([])))).toBeNull();
  });

  it('reuses the shipped buildStrokeBand — exactly one import and one call', () => {
    const source = readFileSync(resolve(__dirname, './ScriptStrokeOverlay.tsx'), 'utf8');
    expect(source).toContain("import { buildStrokeBand } from '../view/aquarelleStrokeBand';");
    expect((source.match(/buildStrokeBand\(/g) ?? []).length).toBe(1);
    expect(source).not.toContain('buildLiftRibbon(');
  });
});
