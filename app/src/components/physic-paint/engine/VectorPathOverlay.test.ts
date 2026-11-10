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
import {
  resolveAnchorHandles,
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
  clearVectorDraft,
  enterPathEdit,
  exitPathEdit,
  resetForStudioOpen,
  vectorDrawDraft,
  vectorPenActive,
  type VectorDraftAnchor,
} from '../view/vectorPathSession';
import { buildDraftPath, buildVectorStroke, type VectorPathCommit } from '../view/vectorPathHandles';
import {
  VectorPathOverlay,
  handleVectorPathKey,
  type VectorPathGestureHandlers,
} from './VectorPathOverlay';

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
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT }),
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  };
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
    const tree = render(VectorPathOverlay(propsWith([[11, vectorStroke()]])));
    expect(nodesWithTestId(tree, 'vector-path-spine')).toHaveLength(1);
    expect(nodesWithTestId(tree, 'vector-path-anchor')).toHaveLength(3);
    expect(nodesWithTestId(tree, 'vector-path-handle')).toHaveLength(0);
    expect(nodesWithTestId(tree, 'vector-path-envelope')).toHaveLength(0);
  });

  it('draws two handle markers for a bezier anchor and none for an auto anchor', () => {
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

  it('passes pointer events through unless the pen is active and no path edit is open', () => {
    const idle = render(VectorPathOverlay(propsWith([[11, vectorStroke()]])));
    expect(idle!.props['style']).toMatchObject({ pointerEvents: 'none' });
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

  it('binds the key listener only while the pen is active and removes it on cleanup', () => {
    const source = readFileSync(resolve(__dirname, './VectorPathOverlay.tsx'), 'utf8');
    expect(source).toContain("window.addEventListener('keydown'");
    expect(source).toContain("window.removeEventListener('keydown'");
    expect(source).toContain('if (!penActive) return');
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

  it('stores exactly ONE history entry for one changed anchor and refuses while in flight', () => {
    const originalAnchors = editedStroke().anchors;
    const revisionBefore = aquarelleStrokesRevision.value;
    const nextAnchors: readonly VectorAnchor[] = [auto(0.25, 0.5), auto(0.5, 0.5), auto(0.8, 0.5)];

    const editId = beginAquarellePathEdit(EDIT_ID, nextAnchors);
    expect(editId).not.toBeNull();
    expect(getRecordedAquarelleStroke(EDIT_ID)!.anchors).toEqual(nextAnchors);

    // ONE entry for the whole gesture: a single undo restores the pre-drag path.
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
