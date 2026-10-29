// ============================================================
//  aquarelleLiftRibbon — the Eraser ribbon geometry (261029-eur).
//
//  The drawn band must share the punch's footprint radius law, ride
//  the recorded tip (ellipse above LIFT_ROUNDED_ASPECT, rounded
//  rectangle below), stay deterministic, and keep every dab the
//  punch stamps INSIDE the drawn border — on a NON-square sheet
//  too, which is the UV/canvas mirror pin. The hit radius is the
//  band's maximum support, so an aspect > 1 wide side is clickable.
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  collectLiftDabs,
  liftEngineSize,
  liftRadiusDoc,
  liftShapeForStroke,
} from '../roto/aquarelleLiftErase';
import {
  LIFT_ROUNDED_ASPECT,
  buildLiftRibbon,
  buildLiftRibbonCached,
  liftRibbonBoundsPx,
  liftStrokeRadiusPx,
  liftSupportFactor,
  trimLiftRibbonCache,
} from './aquarelleLiftRibbon';
import {
  MIN_STROKE_PAD_PX,
  hitsScriptStroke,
  type CanvasPoint,
} from './scriptStrokeEdition';

const SIZE = { width: 1000, height: 1000 };
/** Canonical AQUA-04 params: size 12 px → engine size 0.375. */
const CANONICAL = { size: 12 };
const ROUND = { ...NEUTRAL_TOOL_OVERRIDES };

function point(x: number, y: number, pressure = 0.5, tiltX = 0, tiltY = 0) {
  return { x, y, p: pressure, tx: tiltX, ty: tiltY, tw: 0 };
}

function stroke(
  points: ReturnType<typeof point>[],
  overrides: typeof NEUTRAL_TOOL_OVERRIDES | undefined = ROUND,
  brushId = 'round',
) {
  return { brushId, toolOverrides: overrides, params: CANONICAL, points };
}

/** The module's documented support law, reproduced for the cap pin (CR-01). */
function supportHalfWidthAt(aspect: number, delta: number, radius: number): number {
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  return aspect >= LIFT_ROUNDED_ASPECT
    ? radius * Math.sqrt(cos * cos + aspect * aspect * sin * sin)
    : radius * (Math.abs(cos) + aspect * Math.abs(sin));
}

/** Even-odd ray casting over the implicit closing edge. */
function pointInPolygon(polygon: readonly CanvasPoint[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const crosses = (a.y > y) !== (b.y > y)
      && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function uvToCanvas(x: number, y: number, size: { width: number; height: number }): CanvasPoint {
  return { x: x * size.width, y: (1 - y) * size.height };
}

describe('261029-eur lift ribbon — one footprint law', () => {
  it('draws a round tip at exactly the punch radius on both sides', () => {
    const size = SIZE;
    const recorded = stroke([point(0.25, 0.5), point(0.5, 0.5), point(0.75, 0.5)]);
    const radiusPx = liftRadiusDoc(0.5, liftEngineSize(CANONICAL)) * size.height;
    const { polygonPx, hitRadiusPx } = buildLiftRibbon(recorded, size);
    // Station order: left(0), left(1), left(2), forward cap, right(...)…
    // A horizontal stroke's normal is (0, 1) in the y-up doc frame.
    expect(polygonPx[1]!.x).toBeCloseTo(0.5 * size.width, 6);
    expect(polygonPx[1]!.y).toBeCloseTo(0.5 * size.height - radiusPx, 6);
    expect(hitRadiusPx).toBeCloseTo(radiusPx, 6);
    expect(hitRadiusPx).toBeGreaterThanOrEqual(MIN_STROKE_PAD_PX);
  });

  it('turns a single-point lift into a closed circle of radius R', () => {
    const recorded = stroke([point(0.5, 0.5)]);
    const radiusPx = liftRadiusDoc(0.5, liftEngineSize(CANONICAL)) * SIZE.height;
    const { polygonPx, hitRadiusPx } = buildLiftRibbon(recorded, SIZE);
    expect(polygonPx.length).toBeGreaterThan(8);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const vertex of polygonPx) {
      minX = Math.min(minX, vertex.x);
      maxX = Math.max(maxX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxY = Math.max(maxY, vertex.y);
    }
    expect(minX).toBeCloseTo(500 - radiusPx, 6);
    expect(maxX).toBeCloseTo(500 + radiusPx, 6);
    expect(minY).toBeCloseTo(500 - radiusPx, 6);
    expect(maxY).toBeCloseTo(500 + radiusPx, 6);
    expect(hitRadiusPx).toBeCloseTo(Math.max(MIN_STROKE_PAD_PX, radiusPx), 6);
  });

  it('sweeps every cap vertex through the end station’s own support law (no flare, no notch)', () => {
    const radiusPx = liftRadiusDoc(0.5, liftEngineSize(CANONICAL)) * SIZE.height;
    const points = [point(0.25, 0.5), point(0.75, 0.5)];
    const cases = [
      // Follow rotation, aspect 0.2 (the hake preset with its 90° angle
      // doubled to 180°): the band is 0.2 R wide, so a constant-R cap flares
      // ~4.6x out of it at the junction (CR-01).
      stroke(points, { ...NEUTRAL_TOOL_OVERRIDES, rotation: 2 }, 'hake'),
      // Follow rotation, aspect 2 (the chalk preset widened 2.5x): the band is
      // 2 R wide, so the same constant-R cap cuts an inward notch instead.
      stroke(points, { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2.5 }, 'chalk'),
    ];
    for (const recorded of cases) {
      const shape = liftShapeForStroke(recorded);
      // A horizontal left → right stroke: segmentAngle 0, so a 'follow' tip
      // points along the preset angle.
      const theta = shape.angle;
      const { polygonPx, hitRadiusPx } = buildLiftRibbon(recorded, SIZE);
      const firstX = 0.25 * SIZE.width;
      const lastX = 0.75 * SIZE.width;
      const endY = 0.5 * SIZE.height;
      const forwardCap = polygonPx.filter((vertex) => vertex.x > lastX + 1e-6);
      const backwardCap = polygonPx.filter((vertex) => vertex.x < firstX - 1e-6);
      // CAP_SEGMENTS - 1 vertices per cap: angle 0 and π ARE the band
      // junctions already emitted, so the sweep skips them.
      expect(forwardCap).toHaveLength(7);
      expect(backwardCap).toHaveLength(7);
      for (const [vertices, stationX] of [
        [forwardCap, lastX],
        [backwardCap, firstX],
      ] as const) {
        for (const vertex of vertices) {
          // Canvas y is flipped: recover the doc-frame radial direction.
          const dx = vertex.x - stationX;
          const dyUp = endY - vertex.y;
          const delta = Math.atan2(dyUp, dx) - theta;
          // The junction sits on this same curve at delta = ±π/2; a
          // constant-radius cap leaves it in both directions (flare below
          // aspect 1, notch above), so this equality is the continuity pin.
          expect(Math.hypot(dx, dyUp)).toBeCloseTo(
            supportHalfWidthAt(shape.aspect, delta, radiusPx),
            6,
          );
          // And no cap vertex ever escapes the click target.
          expect(Math.hypot(dx, dyUp)).toBeLessThanOrEqual(
            liftSupportFactor(shape.aspect) * radiusPx + 1e-6,
          );
        }
      }
      expect(hitRadiusPx).toBeCloseTo(liftSupportFactor(shape.aspect) * radiusPx, 6);
    }
  });

  it('reaches past the bare footprint radius for an aspect > 1 tip, and shrinks below it for a flat one', () => {
    const wide = stroke(
      [point(0.25, 0.5), point(0.75, 0.5)],
      { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 },
    );
    const flat = stroke(
      [point(0.25, 0.5), point(0.75, 0.5)],
      { ...NEUTRAL_TOOL_OVERRIDES, aspect: 0.5 },
    );
    const radiusPx = liftRadiusDoc(0.5, liftEngineSize(CANONICAL)) * SIZE.height;
    const wideHit = liftStrokeRadiusPx(wide, SIZE);
    const flatHit = liftStrokeRadiusPx(flat, SIZE);
    expect(wideHit).toBeCloseTo(radiusPx * 2, 6);
    expect(flatHit).toBeCloseTo(radiusPx * Math.hypot(1, 0.5), 6);
    expect(liftSupportFactor(2)).toBe(2);
    expect(liftSupportFactor(0.5)).toBeCloseTo(Math.hypot(1, 0.5), 12);
    expect(LIFT_ROUNDED_ASPECT).toBe(0.6);

    const centerline = [
      { x: 0.25 * SIZE.width, y: 0.5 * SIZE.height },
      { x: 0.75 * SIZE.width, y: 0.5 * SIZE.height },
    ];
    // 1.5 R off the centerline: inside the wide tip's band, outside the flat's.
    const probe = { x: 0.5 * SIZE.width, y: 0.5 * SIZE.height + radiusPx * 1.5 };
    expect(hitsScriptStroke(probe, centerline, wideHit)).toBe(true);
    expect(hitsScriptStroke(probe, centerline, flatHit)).toBe(false);
  });

  it('keeps every punch dab inside the ribbon on a non-square, tilted sheet', () => {
    const size = { width: 400, height: 200 };
    const recorded = stroke(
      [
        point(0.2, 0.5, 0.6, 24, 9),
        point(0.5, 0.5, 0.6, 24, 9),
        point(0.8, 0.5, 0.6, 24, 9),
      ],
      { ...NEUTRAL_TOOL_OVERRIDES, aspect: 0.5 },
    );
    const { polygonPx } = buildLiftRibbon(recorded, size);
    // WR-04: the punch oracle must use the REAL tip shape, not the zero-angle
    // radial fallback — otherwise the dab angles differ from the drawn band
    // and this containment pin cannot see a footprint drift.
    const dabs = collectLiftDabs(
      { points: recorded.points, params: CANONICAL },
      size,
      liftShapeForStroke(recorded),
    );
    expect(dabs.length).toBeGreaterThan(2);
    for (const dab of dabs) {
      const canvas = uvToCanvas(dab.x, dab.y, size);
      expect(pointInPolygon(polygonPx, canvas.x, canvas.y)).toBe(true);
    }
    // Beyond the dab's own radius along its across axis is OUTSIDE the band:
    // the aspect 0.5 support is only half the radius on that side.
    const middle = dabs.reduce((best, dab) =>
      Math.abs(dab.x - 0.5) < Math.abs(best.x - 0.5) ? dab : best,
    );
    const angle = middle.angle ?? 0;
    const acrossX = -Math.sin(angle);
    const acrossY = Math.cos(angle);
    expect(
      pointInPolygon(
        polygonPx,
        (middle.x + acrossX * middle.r * 1.5) * size.width,
        (1 - (middle.y + acrossY * middle.r * 1.5)) * size.height,
      ),
    ).toBe(false);
  });

  it('is deterministic for a random-rotation preset (no RNG) and follows its preset angle', () => {
    const wide = stroke(
      [point(0.25, 0.5), point(0.75, 0.5)],
      { ...NEUTRAL_TOOL_OVERRIDES, aspect: 3 },
    );
    const sponge = {
      brushId: 'sponge',
      toolOverrides: { ...NEUTRAL_TOOL_OVERRIDES, aspect: 3 },
      params: CANONICAL,
      points: wide.points,
    };
    const first = buildLiftRibbon(sponge, SIZE);
    const second = buildLiftRibbon(sponge, SIZE);
    expect(second.polygonPx).toEqual(first.polygonPx);
    expect(second.hitRadiusPx).toBe(first.hitRadiusPx);
    // rotation 'random' uses the PRESET angle (0 here), never a sampled one:
    // the ellipse's wide side is 3 R across the horizontal centerline.
    const radiusPx = liftRadiusDoc(0.5, liftEngineSize(CANONICAL)) * SIZE.height;
    let maxAcross = 0;
    for (const vertex of first.polygonPx) {
      maxAcross = Math.max(maxAcross, Math.abs(vertex.y - 0.5 * SIZE.height));
    }
    expect(maxAcross).toBeCloseTo(radiusPx * 3, 4);
  });

  it('caches by (revision, width, height) and trims ids the listing dropped', () => {
    const recorded = stroke([point(0.25, 0.5), point(0.75, 0.5)]);
    const first = buildLiftRibbonCached(recorded, 9101, SIZE, 7);
    const again = buildLiftRibbonCached(recorded, 9101, SIZE, 7);
    expect(again.polygonPx).toBe(first.polygonPx);
    expect(again.hitRadiusPx).toBe(first.hitRadiusPx);
    // A revision bump invalidates the whole map: fresh arrays.
    const secondRevision = buildLiftRibbonCached(recorded, 9101, SIZE, 8);
    expect(secondRevision.polygonPx).not.toBe(first.polygonPx);
    expect(secondRevision.polygonPx).toEqual(first.polygonPx);

    const kept = buildLiftRibbonCached(recorded, 9102, SIZE, 8);
    trimLiftRibbonCache([9102]);
    expect(buildLiftRibbonCached(recorded, 9102, SIZE, 8).polygonPx).toBe(kept.polygonPx);
    trimLiftRibbonCache([]);
    expect(buildLiftRibbonCached(recorded, 9102, SIZE, 8).polygonPx).not.toBe(kept.polygonPx);
  });

  it('computes bounds as the polygon bbox plus the shared grab margin', () => {
    const recorded = stroke([point(0.25, 0.5), point(0.75, 0.5)]);
    const { polygonPx } = buildLiftRibbon(recorded, SIZE);
    const bounds = liftRibbonBoundsPx(polygonPx);
    let minX = Infinity;
    let maxX = -Infinity;
    for (const vertex of polygonPx) {
      minX = Math.min(minX, vertex.x);
      maxX = Math.max(maxX, vertex.x);
    }
    expect(bounds.x).toBeCloseTo(minX - MIN_STROKE_PAD_PX, 9);
    expect(bounds.width).toBeCloseTo(maxX - minX + MIN_STROKE_PAD_PX * 2, 9);
  });

  it('shares the punch law and never touches the stateful footprint module', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./aquarelleLiftRibbon.ts', import.meta.url)),
      'utf8',
    );
    expect(source).toContain("from '../roto/aquarelleLiftErase'");
    expect(source).toContain('liftRadiusDoc');
    expect(source).toContain('liftShapeForStroke');
    expect(source).not.toContain('aquarelleFootprint');
  });
});
