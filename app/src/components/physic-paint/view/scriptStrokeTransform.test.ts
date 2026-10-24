// ============================================================
//  scriptStrokeTransform.test.ts — pure transform geometry for
//  the Studio script-edition selection (quick 261024-mz5 Task 2;
//  edge handles follow the inline editor's D-04 law).
//
//  This module is deliberately signal-free and Preact-free: it
//  owns the union box, the four uniform-scale corner handles, the
//  four non-uniform edge-midpoint handles and the rotate handle,
//  plus the point math every commit path uses. Both the overlay
//  preview and the brush/watercolor commit share these functions,
//  so the ghost and the committed points can never disagree.
//
//  SCALE DIRECTIONS:
//    - corner = currentDistance / startDistance about the centre
//      (the inline editor's `newDist / transformStartDist`, D-06);
//    - edge = (pointer - opposite edge) / original side, one axis
//      only, anchored at the opposite edge (D-04).
//  Both are clamped to [0.1, 10].
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  SCRIPT_TRANSFORM_HANDLE_HIT_PAD_PX,
  SCRIPT_TRANSFORM_HANDLE_SIZE_PX,
  SCRIPT_TRANSFORM_ROTATE_RADIUS_PX,
  SCRIPT_TRANSFORM_ROTATE_STEM_PX,
  applyScriptStrokeTransform,
  buildScriptStrokeTransform,
  hitTestScriptStrokeTransformHandle,
  isIdentityScriptStrokeTransform,
  rotateScriptPoint,
  scaleScriptPoint,
  scriptStrokeSelectionBox,
  scriptStrokeTransformHandles,
  type ScriptStrokeSelectionBox,
  type ScriptStrokeTransform,
  type ScriptStrokeTransformHandle,
} from './scriptStrokeTransform';

const BOX: ScriptStrokeSelectionBox = { x: 10, y: 20, width: 60, height: 50 };
/** A box centred on (100, 100) — the corner/rotate gesture fixtures. */
const CENTER_BOX: ScriptStrokeSelectionBox = { x: 50, y: 50, width: 100, height: 100 };

function bounds(x: number, y: number, width: number, height: number) {
  return { bounds: { x, y, width, height } };
}

function handleOf(
  id: ScriptStrokeTransformHandle['id'],
  box: ScriptStrokeSelectionBox = BOX,
): ScriptStrokeTransformHandle {
  const handle = scriptStrokeTransformHandles(box).find((candidate) => candidate.id === id);
  if (!handle) throw new Error(`missing handle ${id}`);
  return handle;
}

function transform(overrides: Partial<ScriptStrokeTransform> = {}): ScriptStrokeTransform {
  return {
    kind: 'rotate',
    centerX: 100,
    centerY: 100,
    anchorX: 100,
    anchorY: 100,
    angleRad: 0,
    scaleX: 1,
    scaleY: 1,
    ...overrides,
  };
}

describe('scriptStrokeTransform — selection box', () => {
  it('unions the inflated bounds of every stroke', () => {
    expect(scriptStrokeSelectionBox([
      bounds(10, 20, 30, 40),
      bounds(50, 60, 20, 10),
    ])).toEqual({ x: 10, y: 20, width: 60, height: 50 });
  });

  it('returns null for an empty selection', () => {
    expect(scriptStrokeSelectionBox([])).toBeNull();
  });

  it('keeps a single stroke box untouched (already inflated)', () => {
    expect(scriptStrokeSelectionBox([bounds(5, 6, 7, 8)]))
      .toEqual({ x: 5, y: 6, width: 7, height: 8 });
  });
});

describe('scriptStrokeTransform — handles', () => {
  it('exports the geometry constants the overlay renders and hit-tests', () => {
    expect(SCRIPT_TRANSFORM_HANDLE_SIZE_PX).toBeGreaterThan(0);
    expect(SCRIPT_TRANSFORM_HANDLE_HIT_PAD_PX).toBeGreaterThan(0);
    expect(SCRIPT_TRANSFORM_ROTATE_STEM_PX).toBeGreaterThan(SCRIPT_TRANSFORM_ROTATE_RADIUS_PX);
    expect(SCRIPT_TRANSFORM_ROTATE_RADIUS_PX).toBeGreaterThan(0);
  });

  it('places four corners, four edge midpoints and the rotate circle', () => {
    const handles = scriptStrokeTransformHandles(BOX);
    const byId = new Map(handles.map((handle) => [handle.id, handle]));

    expect(handles).toHaveLength(9);
    expect(byId.get('tl')).toMatchObject({ kind: 'scale', x: 10, y: 20 });
    expect(byId.get('tr')).toMatchObject({ kind: 'scale', x: 70, y: 20 });
    expect(byId.get('bl')).toMatchObject({ kind: 'scale', x: 10, y: 70 });
    expect(byId.get('br')).toMatchObject({ kind: 'scale', x: 70, y: 70 });
    // Edge midpoints — the non-uniform resize handles (D-04).
    expect(byId.get('t')).toMatchObject({ kind: 'scale', x: 40, y: 20 });
    expect(byId.get('r')).toMatchObject({ kind: 'scale', x: 70, y: 45 });
    expect(byId.get('b')).toMatchObject({ kind: 'scale', x: 40, y: 70 });
    expect(byId.get('l')).toMatchObject({ kind: 'scale', x: 10, y: 45 });
    expect(byId.get('rotate')).toMatchObject({
      kind: 'rotate',
      x: 40,
      y: 20 - SCRIPT_TRANSFORM_ROTATE_STEM_PX,
    });
  });

  it('hit-tests corners and edge midpoints as scale, the circle or stem as rotate', () => {
    expect(hitTestScriptStrokeTransformHandle({ x: 10, y: 20 }, BOX)?.id).toBe('tl');
    expect(hitTestScriptStrokeTransformHandle({ x: 70, y: 70 }, BOX)?.id).toBe('br');
    // Within the hit pad, just outside the drawn square.
    const padded = 10 + SCRIPT_TRANSFORM_HANDLE_SIZE_PX / 2 + SCRIPT_TRANSFORM_HANDLE_HIT_PAD_PX - 1;
    expect(hitTestScriptStrokeTransformHandle({ x: padded, y: 20 }, BOX)?.id).toBe('tl');

    // Edge midpoints — corner-first ordering, so each midpoint is its own id.
    expect(hitTestScriptStrokeTransformHandle({ x: 40, y: 20 }, BOX)?.id).toBe('t');
    expect(hitTestScriptStrokeTransformHandle({ x: 70, y: 45 }, BOX)?.id).toBe('r');
    expect(hitTestScriptStrokeTransformHandle({ x: 40, y: 70 }, BOX)?.id).toBe('b');
    expect(hitTestScriptStrokeTransformHandle({ x: 10, y: 45 }, BOX)?.id).toBe('l');

    // The rotate circle itself.
    expect(hitTestScriptStrokeTransformHandle(
      { x: 40, y: 20 - SCRIPT_TRANSFORM_ROTATE_STEM_PX },
      BOX,
    )?.kind).toBe('rotate');
    // The stem between top-centre and the circle — beyond the top edge pad.
    expect(hitTestScriptStrokeTransformHandle(
      { x: 40, y: 20 - SCRIPT_TRANSFORM_ROTATE_STEM_PX / 2 },
      BOX,
    )?.kind).toBe('rotate');

    // Well away from any handle.
    expect(hitTestScriptStrokeTransformHandle({ x: 200, y: 200 }, BOX)).toBeNull();
    // Inside the box (stroke space) is never a handle.
    expect(hitTestScriptStrokeTransformHandle({ x: 40, y: 45 }, BOX)).toBeNull();
  });
});

describe('scriptStrokeTransform — point math', () => {
  it('rotates a point 90 degrees about the centre and preserves every other field', () => {
    const rotated = rotateScriptPoint(
      { x: 150, y: 100, p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 },
      100,
      100,
      Math.PI / 2,
    );
    expect(rotated.x).toBeCloseTo(100, 6);
    expect(rotated.y).toBeCloseTo(150, 6);
    expect(rotated).toMatchObject({ p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 });
  });

  it('scales a point per axis about the anchor and preserves every other field', () => {
    const scaled = scaleScriptPoint(
      { x: 150, y: 120, p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 },
      100,
      100,
      2,
      0.5,
    );
    expect(scaled.x).toBe(200);
    expect(scaled.y).toBe(110);
    expect(scaled).toMatchObject({ p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 });
  });

  it('scales one axis when the factors differ (non-uniform resize)', () => {
    const horizontal = scaleScriptPoint({ x: 150, y: 120 }, 100, 100, 2, 1);
    expect(horizontal).toEqual({ x: 200, y: 120 });
    const vertical = scaleScriptPoint({ x: 150, y: 120 }, 100, 100, 1, 2);
    expect(vertical).toEqual({ x: 150, y: 140 });
  });

  it('never mutates the input point', () => {
    const point = { x: 150, y: 100, p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 };
    rotateScriptPoint(point, 100, 100, Math.PI / 2);
    scaleScriptPoint(point, 100, 100, 2, 2);
    expect(point).toEqual({ x: 150, y: 100, p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 });
  });

  it('applies scale FIRST then rotation about the same centre', () => {
    // Scale 2x about (100,100): (150,100) -> (200,100).
    // Rotate 90 deg about (100,100): (200,100) -> (100,200).
    const applied = applyScriptStrokeTransform(
      { x: 150, y: 100, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 },
      transform({ kind: 'scale', angleRad: Math.PI / 2, scaleX: 2, scaleY: 2 }),
    );
    expect(applied.x).toBeCloseTo(100, 6);
    expect(applied.y).toBeCloseTo(200, 6);
    expect(applied.p).toBe(0.5);
  });

  it('scales about the anchor, not the centre, for an edge transform', () => {
    // Right edge anchored at x=100: (150,120) -> (200,120); y untouched.
    const applied = applyScriptStrokeTransform(
      { x: 150, y: 120 },
      transform({ kind: 'scale', anchorX: 100, anchorY: 100, scaleX: 2, scaleY: 1 }),
    );
    expect(applied).toEqual({ x: 200, y: 120 });
  });
});

describe('scriptStrokeTransform — gesture builders', () => {
  const START = { x: 150, y: 100 };

  it('measures the rotation as the difference of the two atan2 angles', () => {
    const built = buildScriptStrokeTransform(
      handleOf('rotate', CENTER_BOX),
      CENTER_BOX,
      START,
      { x: 100, y: 150 },
      false,
    );
    expect(built.kind).toBe('rotate');
    expect(built.angleRad).toBeCloseTo(Math.PI / 2, 6);
    expect(built.scaleX).toBe(1);
    expect(built.scaleY).toBe(1);
    expect(built.anchorX).toBe(100);
    expect(built.anchorY).toBe(100);
  });

  it('snaps the rotation to 15 degrees when Shift is held', () => {
    const almost = Math.PI / 12 + 0.02;
    const current = rotateScriptPoint(START, 100, 100, almost);

    const snapped = buildScriptStrokeTransform(
      handleOf('rotate', CENTER_BOX), CENTER_BOX, START, current, true,
    );
    expect(snapped.angleRad).toBeCloseTo(Math.PI / 12, 6);

    const unsnapped = buildScriptStrokeTransform(
      handleOf('rotate', CENTER_BOX), CENTER_BOX, START, current, false,
    );
    expect(unsnapped.angleRad).toBeCloseTo(almost, 6);
  });

  it('grows uniformly when a corner is dragged away from the centre', () => {
    const built = buildScriptStrokeTransform(
      handleOf('br', CENTER_BOX),
      CENTER_BOX,
      { x: 150, y: 150 },
      { x: 200, y: 200 },
      false,
    );
    expect(built.kind).toBe('scale');
    // start distance ≈ 70.71, current distance ≈ 141.42 -> 2x on BOTH axes.
    expect(built.scaleX).toBeCloseTo(2, 6);
    expect(built.scaleY).toBeCloseTo(2, 6);
    expect(built.angleRad).toBe(0);
    expect(built.anchorX).toBe(100);
    expect(built.anchorY).toBe(100);

    const shrunk = buildScriptStrokeTransform(
      handleOf('br', CENTER_BOX), CENTER_BOX, { x: 150, y: 150 }, { x: 125, y: 125 }, false,
    );
    expect(shrunk.scaleX).toBeCloseTo(0.5, 6);
    expect(shrunk.scaleY).toBeCloseTo(0.5, 6);
  });

  it('clamps the corner factor to [0.1, 10] and never yields Infinity', () => {
    const huge = buildScriptStrokeTransform(
      handleOf('br', CENTER_BOX), CENTER_BOX, { x: 101, y: 100 }, { x: 500, y: 100 }, false,
    );
    expect(huge.scaleX).toBe(10);
    expect(huge.scaleY).toBe(10);

    const tiny = buildScriptStrokeTransform(
      handleOf('br', CENTER_BOX), CENTER_BOX, { x: 101, y: 100 }, { x: 100.01, y: 100 }, false,
    );
    expect(tiny.scaleX).toBe(0.1);
    expect(tiny.scaleY).toBe(0.1);

    // Pointer exactly on the centre: a degenerate distance is identity, not NaN.
    const degenerate = buildScriptStrokeTransform(
      handleOf('br', CENTER_BOX), CENTER_BOX, { x: 110, y: 100 }, { x: 100, y: 100 }, false,
    );
    expect(degenerate.scaleX).toBe(1);
    expect(degenerate.scaleY).toBe(1);
  });

  it('resizes width only from the right edge, anchored at the left edge', () => {
    const built = buildScriptStrokeTransform(
      handleOf('r'), BOX, { x: 70, y: 45 }, { x: 40, y: 45 }, false,
    );
    expect(built).toMatchObject({
      kind: 'scale',
      centerX: 40,
      centerY: 45,
      anchorX: 10,
      anchorY: 45,
      angleRad: 0,
      scaleX: 0.5,
      scaleY: 1,
    });
  });

  it('resizes width only from the left edge, anchored at the right edge', () => {
    const built = buildScriptStrokeTransform(
      handleOf('l'), BOX, { x: 10, y: 45 }, { x: 40, y: 45 }, false,
    );
    expect(built).toMatchObject({
      anchorX: 70,
      anchorY: 45,
      scaleX: 0.5,
      scaleY: 1,
    });
  });

  it('resizes height only from the bottom and top edges', () => {
    const bottom = buildScriptStrokeTransform(
      handleOf('b'), BOX, { x: 40, y: 70 }, { x: 40, y: 45 }, false,
    );
    expect(bottom).toMatchObject({
      anchorX: 40,
      anchorY: 20,
      scaleX: 1,
      scaleY: 0.5,
    });

    const top = buildScriptStrokeTransform(
      handleOf('t'), BOX, { x: 40, y: 20 }, { x: 40, y: 45 }, false,
    );
    expect(top).toMatchObject({
      anchorX: 40,
      anchorY: 70,
      scaleX: 1,
      scaleY: 0.5,
    });
  });

  it('clamps edge factors and treats a zero side as identity', () => {
    const tiny = buildScriptStrokeTransform(
      handleOf('r'), BOX, { x: 70, y: 45 }, { x: 10, y: 45 }, false,
    );
    expect(tiny.scaleX).toBe(0.1);

    const huge = buildScriptStrokeTransform(
      handleOf('r'), BOX, { x: 70, y: 45 }, { x: 1000, y: 45 }, false,
    );
    expect(huge.scaleX).toBe(10);

    const flatBox: ScriptStrokeSelectionBox = { x: 10, y: 20, width: 0, height: 50 };
    const flat = buildScriptStrokeTransform(
      handleOf('r', flatBox), flatBox, { x: 10, y: 45 }, { x: 100, y: 45 }, false,
    );
    expect(flat.scaleX).toBe(1);
    expect(flat.scaleY).toBe(1);
  });

  it('detects identity transforms (tiny angle, tiny per-axis scale delta)', () => {
    expect(isIdentityScriptStrokeTransform(transform())).toBe(true);
    expect(isIdentityScriptStrokeTransform(transform({ scaleX: 1.005 }))).toBe(true);
    expect(isIdentityScriptStrokeTransform(transform({ angleRad: 0.0000001 }))).toBe(true);
    expect(isIdentityScriptStrokeTransform(transform({ scaleX: 1.02 }))).toBe(false);
    expect(isIdentityScriptStrokeTransform(transform({ scaleY: 1.02 }))).toBe(false);
    expect(isIdentityScriptStrokeTransform(transform({ angleRad: 0.02 }))).toBe(false);
  });
});
