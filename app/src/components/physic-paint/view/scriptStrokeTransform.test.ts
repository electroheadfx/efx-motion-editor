// ============================================================
//  scriptStrokeTransform.test.ts — pure transform geometry for
//  the Studio script-edition selection (quick 261024-mz5 Task 2).
//
//  This module is deliberately signal-free and Preact-free: it
//  owns the union box, the four uniform-scale corner handles and
//  the rotate handle, plus the point math every commit path uses.
//  Both the overlay preview and the brush/watercolor commit share
//  these functions, so the ghost and the committed points can
//  never disagree.
//
//  SCALE DIRECTION: dragging a corner away from the centre grows
//  the selection (factor = currentDistance / startDistance), the
//  same law as the inline editor's `newDist / transformStartDist`
//  (D-06 reference). The PLAN's behavior line wrote the ratio the
//  other way round; the direct-manipulation law wins.
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
} from './scriptStrokeTransform';

const BOX: ScriptStrokeSelectionBox = { x: 10, y: 20, width: 60, height: 50 };

function bounds(x: number, y: number, width: number, height: number) {
  return { bounds: { x, y, width, height } };
}

function transform(overrides: Partial<ScriptStrokeTransform> = {}): ScriptStrokeTransform {
  return {
    kind: 'rotate',
    centerX: 100,
    centerY: 100,
    angleRad: 0,
    factor: 1,
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

  it('places four corner handles and the rotate circle above top-centre', () => {
    const handles = scriptStrokeTransformHandles(BOX);
    const byId = new Map(handles.map((handle) => [handle.id, handle]));

    expect(handles).toHaveLength(5);
    expect(byId.get('tl')).toMatchObject({ kind: 'scale', x: 10, y: 20 });
    expect(byId.get('tr')).toMatchObject({ kind: 'scale', x: 70, y: 20 });
    expect(byId.get('bl')).toMatchObject({ kind: 'scale', x: 10, y: 70 });
    expect(byId.get('br')).toMatchObject({ kind: 'scale', x: 70, y: 70 });
    expect(byId.get('rotate')).toMatchObject({
      kind: 'rotate',
      x: 40,
      y: 20 - SCRIPT_TRANSFORM_ROTATE_STEM_PX,
    });
  });

  it('hit-tests corners as scale and the circle or stem as rotate', () => {
    expect(hitTestScriptStrokeTransformHandle({ x: 10, y: 20 }, BOX)?.id).toBe('tl');
    expect(hitTestScriptStrokeTransformHandle({ x: 70, y: 70 }, BOX)?.id).toBe('br');
    // Within the hit pad, just outside the drawn square.
    const padded = 10 + SCRIPT_TRANSFORM_HANDLE_SIZE_PX / 2 + SCRIPT_TRANSFORM_HANDLE_HIT_PAD_PX - 1;
    expect(hitTestScriptStrokeTransformHandle({ x: padded, y: 20 }, BOX)?.id).toBe('tl');

    // The rotate circle itself.
    expect(hitTestScriptStrokeTransformHandle(
      { x: 40, y: 20 - SCRIPT_TRANSFORM_ROTATE_STEM_PX },
      BOX,
    )?.kind).toBe('rotate');
    // The stem between top-centre and the circle.
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

  it('scales a point about the centre and preserves every other field', () => {
    const scaled = scaleScriptPoint(
      { x: 150, y: 100, p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 },
      100,
      100,
      2,
    );
    expect(scaled.x).toBe(200);
    expect(scaled.y).toBe(100);
    expect(scaled).toMatchObject({ p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 });
  });

  it('never mutates the input point', () => {
    const point = { x: 150, y: 100, p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 };
    rotateScriptPoint(point, 100, 100, Math.PI / 2);
    scaleScriptPoint(point, 100, 100, 2);
    expect(point).toEqual({ x: 150, y: 100, p: 0.4, tx: 2, ty: 3, tw: 4, spd: 5 });
  });

  it('applies scale FIRST then rotation about the same centre', () => {
    // Scale 2x about (100,100): (150,100) -> (200,100).
    // Rotate 90 deg about (100,100): (200,100) -> (100,200).
    const applied = applyScriptStrokeTransform(
      { x: 150, y: 100, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 },
      transform({ kind: 'scale', angleRad: Math.PI / 2, factor: 2 }),
    );
    expect(applied.x).toBeCloseTo(100, 6);
    expect(applied.y).toBeCloseTo(200, 6);
    expect(applied.p).toBe(0.5);
  });
});

describe('scriptStrokeTransform — gesture builders', () => {
  const CENTER = { x: 100, y: 100 };
  const START = { x: 150, y: 100 };

  it('measures the rotation as the difference of the two atan2 angles', () => {
    const built = buildScriptStrokeTransform(
      'rotate',
      CENTER,
      START,
      { x: 100, y: 150 },
      false,
    );
    expect(built.kind).toBe('rotate');
    expect(built.angleRad).toBeCloseTo(Math.PI / 2, 6);
    expect(built.factor).toBe(1);
  });

  it('snaps the rotation to 15 degrees when Shift is held', () => {
    const almost = Math.PI / 12 + 0.02;
    const current = rotateScriptPoint(START, CENTER.x, CENTER.y, almost);

    const snapped = buildScriptStrokeTransform('rotate', CENTER, START, current, true);
    expect(snapped.angleRad).toBeCloseTo(Math.PI / 12, 6);

    const unsnapped = buildScriptStrokeTransform('rotate', CENTER, START, current, false);
    expect(unsnapped.angleRad).toBeCloseTo(almost, 6);
  });

  it('grows when the corner is dragged away from the centre', () => {
    const built = buildScriptStrokeTransform(
      'scale',
      CENTER,
      START,
      { x: 200, y: 100 },
      false,
    );
    expect(built.kind).toBe('scale');
    // start distance 50, current distance 100 -> 2x.
    expect(built.factor).toBeCloseTo(2, 6);
    expect(built.angleRad).toBe(0);

    const shrunk = buildScriptStrokeTransform('scale', CENTER, START, { x: 125, y: 100 }, false);
    expect(shrunk.factor).toBeCloseTo(0.5, 6);
  });

  it('clamps the scale factor to [0.1, 10] and never yields Infinity', () => {
    const huge = buildScriptStrokeTransform('scale', CENTER, { x: 101, y: 100 }, { x: 500, y: 100 }, false);
    expect(huge.factor).toBe(10);

    const tiny = buildScriptStrokeTransform('scale', CENTER, { x: 101, y: 100 }, { x: 100.5, y: 100 }, false);
    expect(tiny.factor).toBe(0.1);

    // Pointer exactly on the centre: a degenerate distance is identity, not NaN.
    const degenerate = buildScriptStrokeTransform('scale', CENTER, { x: 110, y: 100 }, { x: 100, y: 100 }, false);
    expect(degenerate.factor).toBe(1);
  });

  it('detects identity transforms (tiny angle and tiny factor delta)', () => {
    expect(isIdentityScriptStrokeTransform(transform())).toBe(true);
    expect(isIdentityScriptStrokeTransform(transform({ factor: 1.005 }))).toBe(true);
    expect(isIdentityScriptStrokeTransform(transform({ angleRad: 0.0000001 }))).toBe(true);
    expect(isIdentityScriptStrokeTransform(transform({ factor: 1.02 }))).toBe(false);
    expect(isIdentityScriptStrokeTransform(transform({ angleRad: 0.02 }))).toBe(false);
  });
});
