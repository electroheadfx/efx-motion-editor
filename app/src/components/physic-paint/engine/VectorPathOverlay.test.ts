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
import type { AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import { aquarelleSelectedTipId } from '../view/aquarelleRecordState';
import {
  clearVectorDraft,
  resetForStudioOpen,
  vectorDrawDraft,
  vectorPenActive,
  type VectorDraftAnchor,
} from '../view/vectorPathSession';
import { buildDraftPath } from '../view/vectorPathHandles';
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

function propsWith(
  entries: readonly (readonly [number, AquarelleStroke])[] = [],
  handlers: Partial<VectorPathGestureHandlers> = {},
) {
  return {
    width: WIDTH,
    height: HEIGHT,
    getPlayFrame: () => FRAME,
    getRecordedStrokes: () => new Map(entries),
    onCommitPath: handlers.onCommitPath ?? (() => {}),
    onCancelPath: handlers.onCancelPath ?? (() => {}),
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
    expect(draftAnchors()).toEqual([
      auto(0.5, 0.5),
      { x: 0.7, y: 0.4, kind: 'bezier', in: { x: 0.7, y: 0.4 }, out: { x: 0.7, y: 0.4 } },
    ]);
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
    const onDoubleClick = root.props['onDoubleClick'] as ((e: unknown) => void) | undefined;
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

describe('VectorPathOverlay — authority boundary (T-61-31)', () => {
  it('never imports an engine, bake or adapter module and never records', () => {
    const source = readFileSync(resolve(__dirname, './VectorPathOverlay.tsx'), 'utf8');
    expect(source).not.toContain('captureFrame');
    expect(source).not.toContain('scriptBegin');
    expect(source).not.toContain('applyStroke');
    expect(source).not.toContain('recordAquarelleStroke');
    expect(source).not.toContain('aquarelleEnginePort');
    expect(source).not.toContain('aquarelleFootprint');
  });

  it('is mounted beside the stroke overlay and forwards to props.onStrokeEnd', () => {
    const layer = readFileSync(resolve(__dirname, './AquarelleCanvasLayer.tsx'), 'utf8');
    expect(layer).toContain('<VectorPathOverlay');
    expect(layer).toContain('buildVectorStroke(');
    expect(layer).toContain('onStrokeEndRef.current?.(');
    expect(layer).not.toContain('recordAquarelleStroke');
  });
});
