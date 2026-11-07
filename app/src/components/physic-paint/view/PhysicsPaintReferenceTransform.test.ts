import { describe, expect, it } from 'vitest';
import {
  buildRailMotionEditCss,
  getRailMotionBounds,
  getReferenceBounds,
} from './PhysicsPaintReferenceTransform';
import type { PhotoReferenceTransform } from '../../../efx-paint/document/efxPaintDocument';

/**
 * 50-05 (Task 2, S4) contract tests for the reference display-transform
 * bounding-box geometry. `getReferenceBounds` computes the SAME bounding box
 * the reference ghost (Plan 50-04) draws — natural project resolution scaled
 * by `zoom` (project→working), centered at
 * `(canvasWidth/2 + x*zoom, canvasHeight/2 + y*zoom)`, then rotated by
 * `rotation` and scaled by `scaleX`/`scaleY` (D-13). No aspect-fit, no crop.
 */

const IDENTITY: PhotoReferenceTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

describe('getReferenceBounds (50-05, S4 geometry)', () => {
  it('centers the reference at natural size scaled by zoom for the default transform', () => {
    const bounds = getReferenceBounds(IDENTITY, 200, 100, 2, 800, 600);
    // w = 200*2 = 400, h = 100*2 = 200; center = (400, 300).
    expect(bounds.center).toEqual({ x: 400, y: 300 });
    expect(bounds.drawW).toBe(400);
    expect(bounds.drawH).toBe(200);
    // Corners: TL(-200,-100) TR(200,-100) BR(200,100) BL(-200,100) around center.
    expect(bounds.corners[0]).toEqual({ x: 200, y: 200 });
    expect(bounds.corners[1]).toEqual({ x: 600, y: 200 });
    expect(bounds.corners[2]).toEqual({ x: 600, y: 400 });
    expect(bounds.corners[3]).toEqual({ x: 200, y: 400 });
  });

  it('offsets the center by x*zoom and y*zoom (project-space position)', () => {
    const bounds = getReferenceBounds({ ...IDENTITY, x: 50, y: -25 }, 200, 100, 2, 800, 600);
    expect(bounds.center).toEqual({ x: 400 + 50 * 2, y: 300 + -25 * 2 });
    expect(bounds.center).toEqual({ x: 500, y: 250 });
  });

  it('scales the half-dimensions by scaleX/scaleY (D-13)', () => {
    const bounds = getReferenceBounds({ ...IDENTITY, scaleX: 2, scaleY: 0.5 }, 200, 100, 2, 800, 600);
    // hw = (400/2)*2 = 400, hh = (200/2)*0.5 = 50.
    expect(bounds.corners[0]).toEqual({ x: 0, y: 250 });
    expect(bounds.corners[2]).toEqual({ x: 800, y: 350 });
  });

  it('rotates the corners around the center by rotation degrees (D-13)', () => {
    // 90° rotation: TL(-200,-100) → (100,-200) relative to center → (500, 100).
    const bounds = getReferenceBounds({ ...IDENTITY, rotation: 90 }, 200, 100, 2, 800, 600);
    expect(bounds.center).toEqual({ x: 400, y: 300 });
    expect(bounds.corners[0].x).toBeCloseTo(500, 5);
    expect(bounds.corners[0].y).toBeCloseTo(100, 5);
    expect(bounds.corners[2].x).toBeCloseTo(300, 5);
    expect(bounds.corners[2].y).toBeCloseTo(500, 5);
  });

  it('keeps the center fixed under rotation (rotation is around the center)', () => {
    const bounds = getReferenceBounds({ ...IDENTITY, rotation: 37 }, 200, 100, 2, 800, 600);
    expect(bounds.center).toEqual({ x: 400, y: 300 });
  });
});

/**
 * 261107-tfp: the rail-motion boundary box geometry. It mirrors the
 * compositor's op order (`translate(pivot + offset) → rotate → scale →
 * translate(-pivot)`, the same chain `buildRailMotionEditCss` expresses) so the
 * box tracks the composited paint under Position/Scale/Rotation. The base rect
 * is the DISPLAYED drawing key's normalized ink box; the center is the
 * TRANSFORMED PIVOT (the gesture anchor), deliberately not the box centroid.
 */
const PROJECT_W = 1000;
const PROJECT_H = 800;
const INK_BASE = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };

describe('getRailMotionBounds (261107 live UAT)', () => {
  it('places the displayed ink box with the identity transform', () => {
    const bounds = getRailMotionBounds(IDENTITY, INK_BASE, 0.5, 0.5, PROJECT_W, PROJECT_H, 1);
    // Ink box in project px: x 250..750, y 200..600; pivot = the raster centre.
    expect(bounds.corners).toEqual([
      { x: 250, y: 200 },
      { x: 750, y: 200 },
      { x: 750, y: 600 },
      { x: 250, y: 600 },
    ]);
    expect(bounds.center).toEqual({ x: 500, y: 400 });
    expect(bounds.drawW).toBe(500);
    expect(bounds.drawH).toBe(400);
  });

  it('shifts every corner and the center by the position offset', () => {
    const bounds = getRailMotionBounds(
      { ...IDENTITY, x: 100, y: -50 },
      INK_BASE,
      0.5,
      0.5,
      PROJECT_W,
      PROJECT_H,
      1,
    );
    expect(bounds.corners).toEqual([
      { x: 350, y: 150 },
      { x: 850, y: 150 },
      { x: 850, y: 550 },
      { x: 350, y: 550 },
    ]);
    expect(bounds.center).toEqual({ x: 600, y: 350 });
  });

  it('scales about the compositor pivot', () => {
    const bounds = getRailMotionBounds(
      { ...IDENTITY, scaleX: 2, scaleY: 2 },
      INK_BASE,
      0.5,
      0.5,
      PROJECT_W,
      PROJECT_H,
      1,
    );
    expect(bounds.corners).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 800 },
      { x: 0, y: 800 },
    ]);
    // The pivot is the fixed point of the scale gesture.
    expect(bounds.center).toEqual({ x: 500, y: 400 });
    // drawW/drawH are the UNSCALED base draw size (transformBoundsCore law).
    expect(bounds.drawW).toBe(500);
    expect(bounds.drawH).toBe(400);
  });

  it('rotates the corners around the compositor pivot', () => {
    const bounds = getRailMotionBounds(
      { ...IDENTITY, rotation: 90 },
      INK_BASE,
      0.5,
      0.5,
      PROJECT_W,
      PROJECT_H,
      1,
    );
    // TL (250,200): dx -250, dy -200 -> pivot + (200, -250).
    expect(bounds.corners[0].x).toBeCloseTo(700, 9);
    expect(bounds.corners[0].y).toBeCloseTo(150, 9);
    expect(bounds.corners[2].x).toBeCloseTo(300, 9);
    expect(bounds.corners[2].y).toBeCloseTo(650, 9);
    expect(bounds.center).toEqual({ x: 500, y: 400 });
  });

  it('keeps a corner that sits on the pivot fixed under rotation', () => {
    const bounds = getRailMotionBounds(
      { ...IDENTITY, rotation: 90 },
      INK_BASE,
      0.25,
      0.25,
      PROJECT_W,
      PROJECT_H,
      1,
    );
    // TL is exactly the pivot (250,200) and must not move.
    expect(bounds.corners[0].x).toBeCloseTo(250, 9);
    expect(bounds.corners[0].y).toBeCloseTo(200, 9);
    // BR (750,600): dx 500, dy 400 -> pivot + (-dy, dx) = (-150, 700).
    expect(bounds.corners[2].x).toBeCloseTo(-150, 9);
    expect(bounds.corners[2].y).toBeCloseTo(700, 9);
    expect(bounds.center).toEqual({ x: 250, y: 200 });
  });

  it('applies the project-to-working zoom to every coordinate', () => {
    const bounds = getRailMotionBounds(IDENTITY, INK_BASE, 0.5, 0.5, PROJECT_W, PROJECT_H, 0.5);
    expect(bounds.corners).toEqual([
      { x: 125, y: 100 },
      { x: 375, y: 100 },
      { x: 375, y: 300 },
      { x: 125, y: 300 },
    ]);
    expect(bounds.center).toEqual({ x: 250, y: 200 });
    expect(bounds.drawW).toBe(250);
    expect(bounds.drawH).toBe(200);
  });

  it('reproduces getReferenceBounds corner-for-corner for a full-frame base (fallback equality)', () => {
    const transform = { x: 50, y: -25, scaleX: 1.5, scaleY: 0.5, rotation: 37 };
    // The legacy helper takes the PROJECT-space base plus the WORKING canvas
    // size — exactly the pair the handles already pass (width, height) and the
    // project size recovered as width/zoom.
    const reference = getReferenceBounds(
      transform,
      PROJECT_W,
      PROJECT_H,
      2,
      PROJECT_W * 2,
      PROJECT_H * 2,
    );
    const rail = getRailMotionBounds(
      transform,
      { x: 0, y: 0, width: 1, height: 1 },
      0.5,
      0.5,
      PROJECT_W,
      PROJECT_H,
      2,
    );
    expect(rail.drawW).toBe(reference.drawW);
    expect(rail.drawH).toBe(reference.drawH);
    expect(rail.center.x).toBeCloseTo(reference.center.x, 9);
    expect(rail.center.y).toBeCloseTo(reference.center.y, 9);
    for (let index = 0; index < 4; index += 1) {
      expect(rail.corners[index].x).toBeCloseTo(reference.corners[index].x, 9);
      expect(rail.corners[index].y).toBeCloseTo(reference.corners[index].y, 9);
    }
  });
});

describe('buildRailMotionEditCss (59-12 edit-view mirror)', () => {
  it('uses the compositor op order and the project→working zoom on offsets only', () => {
    const css = buildRailMotionEditCss(
      { translateX: 100, translateY: -50, scale: 2, rotationRadians: Math.PI / 4, pivotX: 0.5, pivotY: 0.25 },
      1000,
      800,
      0.5,
    );
    // pivot = (500, 200); offset scaled by zoom → (50, -25).
    expect(css).toBe('translate(550px, 175px) rotate(0.7853981633974483rad) scale(2) translate(-500px, -200px)');
  });

  it('is the plain identity chain at zero values', () => {
    expect(buildRailMotionEditCss(
      { translateX: 0, translateY: 0, scale: 1, rotationRadians: 0, pivotX: 0.5, pivotY: 0.5 },
      1000,
      1000,
      1,
    )).toBe('translate(500px, 500px) rotate(0rad) scale(1) translate(-500px, -500px)');
  });
});
