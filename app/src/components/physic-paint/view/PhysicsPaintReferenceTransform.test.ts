import { describe, expect, it } from 'vitest';
import { getReferenceBounds } from './PhysicsPaintReferenceTransform';
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
