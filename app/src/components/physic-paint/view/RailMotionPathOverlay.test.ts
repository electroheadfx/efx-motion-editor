// ============================================================
//  quick 261108-kvw — the canvas path overlay leaf.
//
//  A hooks-free, props-only SVG leaf drawn inside the rail-motion
//  transform-handle SVG. It is invoked DIRECTLY here and its returned
//  vnodes walked, the same way the easing-table contract test does.
//
//  Laws pinned here:
//    RAIL_MOTION_PATH_ACCENT is the ONE #4A90D9 source
//    resolve: null path in, null model out
//    the STATIC geometry (d, dots, stroke/dot radii, dash) is cached
//      and reused while only the cursor marker follows the playhead
//    the root group and every child are pointer-events none and
//      aria-hidden — the overlay can never intercept painting or a
//      handle drag (T-KVW-01)
//    ONE dot per surviving key frame; a key frame the sampler
//      decimated away draws none (never a mis-placed dot)
//    the marker is a distinct element from the key dots
//    placement is project-to-working via placeRailMotionPathPoint
//    no store, signal, hook or handler surface in the leaf
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  RailMotionPath,
  RailMotionPathCursorPoint,
} from '../roto/railMotionPath';
import {
  RAIL_MOTION_PATH_ACCENT,
  RailMotionPathOverlay,
  resolveRailMotionPathRenderModel,
} from './RailMotionPathOverlay';

interface TestVNode {
  type: unknown;
  key?: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

const OVERLAY_SOURCE = readFileSync(
  fileURLToPath(new URL('./RailMotionPathOverlay.tsx', import.meta.url)),
  'utf8',
);

function collect(node: unknown, out: TestVNode[] = []): TestVNode[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (typeof node !== 'object') return out;
  const vnode = node as TestVNode;
  out.push(vnode);
  if (vnode.props?.children !== undefined) collect(vnode.props.children, out);
  return out;
}

/** The canonical fixture: a 0 -> 100 x-route over [0,10], pivot centred. */
function pathFixture(overrides: Partial<RailMotionPath> = {}): RailMotionPath {
  return {
    railId: 'rail-kvw',
    startFrame: 100,
    frameCount: 11,
    pivotX: 0.5,
    pivotY: 0.5,
    samples: Object.freeze([
      Object.freeze({ frame: 0, x: 0, y: 0 }),
      Object.freeze({ frame: 5, x: 50, y: 0 }),
      Object.freeze({ frame: 10, x: 100, y: 0 }),
    ]),
    keyFrames: Object.freeze([0, 10]),
    signature: 'sig-kvw',
    ...overrides,
  };
}

function resolve(
  path: RailMotionPath | null,
  cursor: RailMotionPathCursorPoint | null,
  zoom = 1,
) {
  return resolveRailMotionPathRenderModel({
    path,
    cursor,
    projectWidth: 1000,
    projectHeight: 800,
    zoom,
  });
}

function render(model: ReturnType<typeof resolve>): TestVNode | null {
  if (model === null) return null;
  return RailMotionPathOverlay({ model }) as unknown as TestVNode;
}

function byClass(tree: TestVNode | null, className: string): TestVNode | undefined {
  if (tree === null) return undefined;
  return collect(tree).find((node) => node.props?.class === className);
}

function allByClass(tree: TestVNode | null, className: string): TestVNode[] {
  if (tree === null) return [];
  return collect(tree).filter((node) => node.props?.class === className);
}

describe('261108-kvw rail-motion canvas path overlay', () => {
  it('exposes the ONE rail-motion accent and resolves null-in to null-out', () => {
    expect(RAIL_MOTION_PATH_ACCENT).toBe('#4A90D9');
    expect(resolve(null, null)).toBeNull();
    expect(resolve(null, { frame: 5, x: 50, y: 0 })).toBeNull();
  });

  it('places the static route, the key dots and the cursor marker in working space', () => {
    const model = resolve(pathFixture(), { frame: 5, x: 50, y: 0 });
    if (model === null) throw new Error('expected a render model');

    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.dots)).toBe(true);
    // M at frame 0 (pivot only), then one L per remaining sample.
    expect(model.d).toBe('M500,400 L550,400 L600,400');
    expect(model.dots.map((dot) => dot.key)).toEqual([0, 10]);
    expect(model.dots.map((dot) => [dot.x, dot.y])).toEqual([[500, 400], [600, 400]]);
    expect(model.marker).toEqual({ x: 550, y: 400 });
    expect(model.strokeWidth).toBe(1.5);
    expect(model.dotRadius).toBe(3);
    expect(model.markerRadius).toBe(5);
    expect(model.dashArray).toBe('6 4');

    // A null cursor drops ONLY the marker.
    const cursorless = resolve(pathFixture({ signature: 'sig-kvw-2' }), null);
    expect(cursorless?.marker).toBeNull();
    expect(cursorless?.dots).toHaveLength(2);
  });

  it('scales screen-sized strokes and radii by zoom', () => {
    const model = resolve(pathFixture(), { frame: 5, x: 50, y: 0 }, 2);
    if (model === null) throw new Error('expected a render model');
    expect(model.strokeWidth).toBe(0.75);
    expect(model.dotRadius).toBe(1.5);
    expect(model.markerRadius).toBe(2.5);
    expect(model.dashArray).toBe('3 2');
    expect(model.dots.map((dot) => [dot.x, dot.y])).toEqual([[1000, 800], [1200, 800]]);
    expect(model.marker).toEqual({ x: 1100, y: 800 });
  });

  it('reuses the cached static geometry while only the marker follows the playhead', () => {
    const path = pathFixture();
    const first = resolve(path, { frame: 5, x: 50, y: 0 });
    const second = resolve(path, { frame: 10, x: 100, y: 0 });
    if (first === null || second === null) throw new Error('expected render models');

    expect(second.d).toBe(first.d);
    expect(second.dots).toBe(first.dots);
    expect(second.strokeWidth).toBe(first.strokeWidth);
    expect(second.dotRadius).toBe(first.dotRadius);
    expect(second.dashArray).toBe(first.dashArray);
    expect(second.marker).not.toBe(first.marker);
    expect(first.marker).toEqual({ x: 550, y: 400 });
    expect(second.marker).toEqual({ x: 600, y: 400 });

    // A different canvas size or zoom re-derives the static geometry.
    const resized = resolveRailMotionPathRenderModel({
      path,
      cursor: null,
      projectWidth: 640,
      projectHeight: 480,
      zoom: 1,
    });
    expect(resized?.dots).not.toBe(first.dots);
    expect(resized?.d).not.toBe(first.d);
  });

  it('draws a dot only for a key frame that survived sampling', () => {
    const decimated = pathFixture({ keyFrames: Object.freeze([0, 10, 42]) });
    const model = resolve(decimated, null);
    expect(model?.dots.map((dot) => dot.key)).toEqual([0, 10]);
    expect(model?.dots.some((dot) => dot.key === 42)).toBe(false);
  });

  it('renders nothing for a null model and a fully inert group for a model', () => {
    expect(render(null)).toBeNull();

    const tree = render(resolve(pathFixture(), { frame: 5, x: 50, y: 0 }));
    if (tree === null) throw new Error('expected a rendered tree');
    expect(tree.type).toBe('g');
    expect(tree.props.class).toBe('physics-paint-rail-motion-path');
    expect(tree.props['aria-hidden']).toBe('true');
    expect(tree.props.style).toEqual({ pointerEvents: 'none' });

    const line = byClass(tree, 'rail-motion-path-line');
    if (line === undefined) throw new Error('expected the route polyline');
    expect(line.props.d).toBe('M500,400 L550,400 L600,400');
    expect(line.props.fill).toBe('none');
    expect(line.props.stroke).toBe(RAIL_MOTION_PATH_ACCENT);
    expect(line.props['stroke-dasharray']).toBe('6 4');
    expect(line.props['vector-effect']).toBe('non-scaling-stroke');
    expect(line.props.style).toEqual({ pointerEvents: 'none' });

    const dots = allByClass(tree, 'rail-motion-path-key-dot');
    expect(dots).toHaveLength(2);
    expect(dots.map((dot) => dot.key)).toEqual([0, 10]);
    expect(dots.map((dot) => [dot.props.cx, dot.props.cy])).toEqual([[500, 400], [600, 400]]);
    expect(dots.every((dot) => dot.props.fill === RAIL_MOTION_PATH_ACCENT)).toBe(true);
    expect(dots.every((dot) => dot.props.r === 3)).toBe(true);
    expect(dots.every((dot) => dot.props.style !== undefined)).toBe(true);

    const markers = allByClass(tree, 'rail-motion-path-cursor');
    expect(markers).toHaveLength(1);
    expect(markers[0]?.props.cx).toBe(550);
    expect(markers[0]?.props.cy).toBe(400);
    expect(markers[0]?.props.r).toBe(5);
    expect(markers[0]?.props.stroke).toBe('white');
    expect(markers[0]?.props['vector-effect']).toBe('non-scaling-stroke');
    expect(markers[0]?.props.style).toEqual({ pointerEvents: 'none' });

    // No handlers anywhere: the overlay is painted, never interactive.
    for (const node of collect(tree)) {
      const handler = Object.keys(node.props ?? {}).find((name) => /^on[A-Z]/.test(name));
      expect(handler, `unexpected handler ${handler ?? ''}`).toBeUndefined();
    }
  });

  it('omits only the cursor element when the playhead leaves the span', () => {
    const tree = render(resolve(pathFixture(), null));
    if (tree === null) throw new Error('expected a rendered tree');
    expect(allByClass(tree, 'rail-motion-path-key-dot')).toHaveLength(2);
    expect(allByClass(tree, 'rail-motion-path-cursor')).toHaveLength(0);
    expect(byClass(tree, 'rail-motion-path-line')).toBeDefined();
  });

  it('is a hooks-free leaf: no store, signal, hook or handler surface', () => {
    expect(OVERLAY_SOURCE).not.toMatch(/physicPaintStore|@preact\/signals|preact\/hooks/);
    expect(OVERLAY_SOURCE).not.toMatch(/useState|useSignal|useComputed/);
    expect(OVERLAY_SOURCE).not.toMatch(/onClick|onPointer|onMouse|onKeyDown/);
    expect(OVERLAY_SOURCE).toContain("from '../roto/railMotionPath'");
  });
});
