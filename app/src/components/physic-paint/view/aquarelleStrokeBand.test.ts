// ============================================================
//  aquarelleStrokeBand — the preview footprint band (261101-mvg).
//
//  One pure entry point for BOTH stroke kinds: an Eraser (lift)
//  delegates to the 261029-eur ribbon law, a paint stroke draws the
//  area its own bake footprint covers (size, recorded tip aspect,
//  per-point recorded pressure, water x1.3, the isotropic pen law).
//  The paint radius and tip aspect are pinned equal to the engine /
//  cursor law (`aquarelleFootprintFor`) with a FIXED-rotation
//  NON-ROUND tip, so the drawn area and the stamped area cannot
//  drift — and the pen pin is non-vacuous precisely because the
//  recorded tip is not round.
//
//  The module stays pure: no Preact, no signals, no DOM, and no
//  import of the STATEFUL footprint helper (its header comment names
//  those modules, so the purity pin matches import statements, never
//  a bare substring).
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildBrushForStroke,
  toEngineParams,
  type Brush,
} from '@efxlab/efx-watercolor';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import type { AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import { aquarelleFootprintFor } from '../engine/aquarelleFootprint';
import {
  MIN_STROKE_PAD_PX,
  MAX_POLYLINE_POINTS,
  distanceToSegmentPx,
  type CanvasPoint,
} from './scriptStrokeEdition';
import { buildLiftRibbon, buildLiftRibbonCached } from './aquarelleLiftRibbon';
import {
  buildStrokeBand,
  buildStrokeBandCached,
  paintRadiusDocFor,
  paintTipForStroke,
  trimStrokeBandCache,
} from './aquarelleStrokeBand';

const SIZE = { width: 1000, height: 1000 };
/** Canonical AQUA-04 params: size 12 px → engine size 0.375. */
const CANONICAL = { size: 12 };
/** Cap sweep resolution, mirrored from the shared polygon builder. */
const CAP_SEGMENTS = 8;
const ROUND = { ...NEUTRAL_TOOL_OVERRIDES };

function point(x: number, y: number, pressure = 0.5, tiltX = 0, tiltY = 0) {
  return { x, y, p: pressure, tx: tiltX, ty: tiltY, tw: 0 };
}

type Recorded = Pick<
  AquarelleStroke,
  'tool' | 'points' | 'params' | 'brushId' | 'toolOverrides'
>;

function paintStroke(
  tool: 'brush' | 'water' | 'pen',
  points: ReturnType<typeof point>[],
  overrides: typeof NEUTRAL_TOOL_OVERRIDES = ROUND,
  brushId = 'round',
): Recorded {
  return { tool, brushId, toolOverrides: overrides, params: CANONICAL, points };
}

function liftStroke(
  points: ReturnType<typeof point>[],
  overrides: typeof NEUTRAL_TOOL_OVERRIDES = ROUND,
  brushId = 'round',
): Recorded {
  return { tool: 'lift', brushId, toolOverrides: overrides, params: CANONICAL, points };
}

function roundBrush(overrides: typeof NEUTRAL_TOOL_OVERRIDES = ROUND): Brush {
  return buildBrushForStroke('round', overrides);
}

function engineSizeOf(params: Record<string, number> = CANONICAL): number {
  return toEngineParams(params).size ?? 0.5;
}

/** The widest distance from the recorded centerline, in canvas px. */
function maxDistanceFromCenterline(
  polygon: readonly CanvasPoint[],
  centerline: readonly CanvasPoint[],
): number {
  let max = 0;
  for (const vertex of polygon) {
    let best = Infinity;
    if (centerline.length === 1) {
      best = Math.hypot(vertex.x - centerline[0]!.x, vertex.y - centerline[0]!.y);
    }
    for (let index = 1; index < centerline.length; index += 1) {
      best = Math.min(
        best,
        distanceToSegmentPx(
          vertex.x,
          vertex.y,
          centerline[index - 1]!,
          centerline[index]!,
        ),
      );
    }
    max = Math.max(max, best);
  }
  return max;
}

function horizontalCenterline(
  points: readonly ReturnType<typeof point>[],
  size: { width: number; height: number },
): CanvasPoint[] {
  return points.map((recorded) => ({
    x: recorded.x * size.width,
    y: (1 - recorded.y) * size.height,
  }));
}

describe('261101-mvg stroke band — the Eraser delegates to the ribbon law', () => {
  it('returns the 261029-eur ribbon polygon element-for-element', () => {
    const recorded = liftStroke(
      [point(0.2, 0.4, 0.6, 18, 5), point(0.5, 0.5, 0.6, 18, 5), point(0.8, 0.6, 0.6, 18, 5)],
      { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 },
    );
    const band = buildStrokeBand(recorded, SIZE);
    const ribbon = buildLiftRibbon(recorded, SIZE);
    expect(band.polygonPx).toHaveLength(ribbon.polygonPx.length);
    for (let index = 0; index < ribbon.polygonPx.length; index += 1) {
      expect(band.polygonPx[index]!.x).toBe(ribbon.polygonPx[index]!.x);
      expect(band.polygonPx[index]!.y).toBe(ribbon.polygonPx[index]!.y);
    }
  });

  it('shares the single-point ribbon silhouette for a one-dab eraser', () => {
    const recorded = liftStroke([point(0.5, 0.5)]);
    expect(buildStrokeBand(recorded, SIZE).polygonPx).toEqual(
      buildLiftRibbon(recorded, SIZE).polygonPx,
    );
  });
});

describe('261101-mvg stroke band — paint footprint', () => {
  it('keeps every vertex inside the tip support of the recorded centerline', () => {
    const recorded = paintStroke('brush', [
      point(0.2, 0.5),
      point(0.4, 0.5),
      point(0.6, 0.5),
      point(0.8, 0.5),
    ]);
    const polygon = buildStrokeBand(recorded, SIZE).polygonPx;
    expect(polygon.length).toBeGreaterThan(2);
    const radiusPx =
      paintRadiusDocFor('brush', roundBrush(), engineSizeOf(), 0.5) * SIZE.height;
    expect(maxDistanceFromCenterline(polygon, horizontalCenterline(recorded.points, SIZE)))
      .toBeLessThanOrEqual(radiusPx + 1e-6);
    for (const vertex of polygon) {
      expect(Number.isFinite(vertex.x)).toBe(true);
      expect(Number.isFinite(vertex.y)).toBe(true);
    }
  });

  it('drives the width by the per-point recorded pressure', () => {
    const points = [point(0.2, 0.5), point(0.5, 0.5), point(0.8, 0.5)];
    const hard = paintStroke('brush', points.map((p) => ({ ...p, p: 1 })));
    const soft = paintStroke('brush', points.map((p) => ({ ...p, p: 0.2 })));
    const hardMax = maxDistanceFromCenterline(
      buildStrokeBand(hard, SIZE).polygonPx,
      horizontalCenterline(hard.points, SIZE),
    );
    const softMax = maxDistanceFromCenterline(
      buildStrokeBand(soft, SIZE).polygonPx,
      horizontalCenterline(soft.points, SIZE),
    );
    expect(hardMax).toBeGreaterThan(softMax);
  });

  it('applies water x1.3 to the same recorded geometry', () => {
    const points = [point(0.2, 0.5), point(0.5, 0.5), point(0.8, 0.5)];
    const brushBand = buildStrokeBand(paintStroke('brush', points), SIZE).polygonPx;
    const waterBand = buildStrokeBand(paintStroke('water', points), SIZE).polygonPx;
    const brushMax = maxDistanceFromCenterline(
      brushBand,
      horizontalCenterline(points, SIZE),
    );
    const waterMax = maxDistanceFromCenterline(
      waterBand,
      horizontalCenterline(points, SIZE),
    );
    expect(waterMax).toBeCloseTo(brushMax * 1.3, 6);
  });

  it('forces the pen to an isotropic aspect-1 splat even with a non-round recorded tip', () => {
    const wideTip = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 };
    const points = [point(0.2, 0.5), point(0.5, 0.5), point(0.8, 0.5)];
    const recorded = paintStroke('pen', points, wideTip);
    const tip = paintTipForStroke(recorded);
    expect(tip.aspect).toBe(1);
    expect(tip.angle).toBe(0);
    expect(tip.rotation).toBe('fixed');
    const penRadiusPx =
      paintRadiusDocFor('pen', roundBrush(wideTip), engineSizeOf(), 0.5) * SIZE.height;
    const polygon = buildStrokeBand(recorded, SIZE).polygonPx;
    expect(maxDistanceFromCenterline(polygon, horizontalCenterline(points, SIZE)))
      .toBeLessThanOrEqual(penRadiusPx + 1e-6);
  });
});

describe('261101-mvg stroke band — pinned to the engine/cursor footprint law', () => {
  it('agrees with aquarelleFootprintFor on radiusDoc and aspect for brush and water', () => {
    // FIXED rotation + non-unit aspect + preset angle: no declared
    // approximation (no follow/random tip) can make this pin vacuous.
    const wideTip = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 };
    const brush = roundBrush(wideTip);
    const engineSize = engineSizeOf();
    for (const tool of ['brush', 'water'] as const) {
      for (const pressure of [0.2, 0.5, 1]) {
        const footprint = aquarelleFootprintFor({
          tool,
          tipId: 'round',
          toolOverrides: wideTip,
          size: 12,
          pressure,
          moveAngle: 0,
          tiltX: 0,
          tiltY: 0,
        });
        expect(paintRadiusDocFor(tool, brush, engineSize, pressure))
          .toBeCloseTo(footprint.radiusDoc, 12);
        expect(footprint.aspect).toBe(2);
        expect(
          paintTipForStroke({ tool, brushId: 'round', toolOverrides: wideTip }).aspect,
        ).toBe(footprint.aspect);
      }
    }
  });

  it('agrees with aquarelleFootprintFor on the pen law and its isotropic cut', () => {
    const wideTip = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 };
    const engineSize = engineSizeOf();
    for (const pressure of [0.2, 0.5, 1]) {
      const footprint = aquarelleFootprintFor({
        tool: 'pen',
        tipId: 'round',
        toolOverrides: wideTip,
        size: 12,
        pressure,
        moveAngle: 0,
        tiltX: 0,
        tiltY: 0,
      });
      // Non-vacuous: the recorded tip IS aspect 2, yet the pen stays round.
      expect(
        paintTipForStroke({ tool: 'pen', brushId: 'round', toolOverrides: wideTip }).aspect,
      ).toBe(1);
      expect(footprint.aspect).toBe(1);
      expect(
        paintRadiusDocFor('pen', roundBrush(wideTip), engineSize, pressure),
      ).toBeCloseTo(footprint.radiusDoc, 12);
    }
  });

  it('reaches about 2R on the wide side of an aspect-2 tip', () => {
    const wideTip = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 2 };
    const recorded = paintStroke('brush', [point(0.2, 0.5), point(0.8, 0.5)], wideTip);
    const radiusPx =
      paintRadiusDocFor('brush', roundBrush(wideTip), engineSizeOf(), 0.5) * SIZE.height;
    const polygon = buildStrokeBand(recorded, SIZE).polygonPx;
    let maxAcross = 0;
    for (const vertex of polygon) {
      maxAcross = Math.max(maxAcross, Math.abs(vertex.y - 0.5 * SIZE.height));
    }
    expect(maxAcross).toBeCloseTo(radiusPx * 2, 6);
  });

  it('uses the rounded-rectangle support branch below the rounded aspect without NaN', () => {
    const flatTip = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 0.5 };
    const recorded = paintStroke('brush', [point(0.2, 0.5), point(0.8, 0.5)], flatTip);
    const radiusPx =
      paintRadiusDocFor('brush', roundBrush(flatTip), engineSizeOf(), 0.5) * SIZE.height;
    const polygon = buildStrokeBand(recorded, SIZE).polygonPx;
    expect(polygon.length).toBeGreaterThan(2);
    let maxAcross = 0;
    for (const vertex of polygon) {
      expect(Number.isFinite(vertex.x)).toBe(true);
      expect(Number.isFinite(vertex.y)).toBe(true);
      maxAcross = Math.max(maxAcross, Math.abs(vertex.y - 0.5 * SIZE.height));
    }
    // |cos| + a|sin| supports a·R across the band and at most hypot(1, a)·R
    // over the cap sweep — the rounded-rect branch, never the ellipse one.
    expect(maxAcross).toBeGreaterThan(0.5 * radiusPx);
    expect(maxAcross).toBeLessThanOrEqual(Math.hypot(1, 0.5) * radiusPx + 1e-6);
  });
});

describe('261101-mvg stroke band — frames, determinism and budget', () => {
  it('keeps the doc-frame support on a NON-square sheet (isotropic mirror pin)', () => {
    const size = { width: 1000, height: 600 };
    const points = [point(0.2, 0.5), point(0.5, 0.5), point(0.8, 0.5)];
    const recorded = paintStroke('brush', points);
    const polygon = buildStrokeBand(recorded, size).polygonPx;
    const radiusPx =
      paintRadiusDocFor('brush', roundBrush(), engineSizeOf(), 0.5) * size.height;
    let minAcross = Infinity;
    let maxAcross = 0;
    for (const vertex of polygon) {
      const across = vertex.y - 0.5 * size.height;
      minAcross = Math.min(minAcross, across);
      maxAcross = Math.max(maxAcross, across);
    }
    expect(maxAcross).toBeCloseTo(radiusPx, 6);
    expect(-minAcross).toBeCloseTo(radiusPx, 6);
  });

  it('is deterministic yet returns a fresh array every call', () => {
    const recorded = paintStroke('brush', [point(0.2, 0.5), point(0.8, 0.5)]);
    const first = buildStrokeBand(recorded, SIZE).polygonPx;
    const second = buildStrokeBand(recorded, SIZE).polygonPx;
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it('decimates a 1000-point stroke to the shared budget and keeps every vertex finite', () => {
    const points: ReturnType<typeof point>[] = [];
    for (let index = 0; index < 1000; index += 1) {
      points.push(point(0.1 + (index / 999) * 0.8, 0.5, (index % 10) / 10));
    }
    const polygon = buildStrokeBand(paintStroke('brush', points), SIZE).polygonPx;
    expect(polygon.length).toBeLessThanOrEqual(
      MAX_POLYLINE_POINTS * 2 + (CAP_SEGMENTS - 1) * 2,
    );
    expect(polygon.length).toBeGreaterThan(2);
    for (const vertex of polygon) {
      expect(Number.isFinite(vertex.x)).toBe(true);
      expect(Number.isFinite(vertex.y)).toBe(true);
    }
  });

  it('never emits NaN when some recorded samples are non-finite', () => {
    const points = [
      point(0.2, 0.5),
      point(Number.NaN, 0.5),
      point(0.5, Number.POSITIVE_INFINITY),
      point(0.8, 0.5),
    ];
    const polygon = buildStrokeBand(paintStroke('brush', points), SIZE).polygonPx;
    expect(polygon.length).toBeGreaterThan(2);
    for (const vertex of polygon) {
      expect(Number.isFinite(vertex.x)).toBe(true);
      expect(Number.isFinite(vertex.y)).toBe(true);
    }
  });
});

describe('261101-mvg stroke band — zero stations on BOTH branches', () => {
  it('returns an empty polygon for a paint stroke with no points, without throwing', () => {
    expect(buildStrokeBand(paintStroke('brush', []), SIZE)).toEqual({ polygonPx: [] });
    expect(buildStrokeBand(paintStroke('pen', []), SIZE)).toEqual({ polygonPx: [] });
  });

  it('returns an empty polygon when every paint sample is non-finite, without throwing', () => {
    const nonFinite = [
      point(Number.NaN, Number.NaN),
      point(Number.POSITIVE_INFINITY, 0.5),
    ];
    expect(buildStrokeBand(paintStroke('water', nonFinite), SIZE)).toEqual({ polygonPx: [] });
  });

  it('keeps the 261029-eur early return on the lift path, hit radius included', () => {
    const emptyLift = liftStroke([]);
    expect(buildStrokeBand(emptyLift, SIZE)).toEqual({ polygonPx: [] });
    // The extraction preserved the early return: a hit radius survives it.
    expect(buildLiftRibbon(emptyLift, SIZE).polygonPx).toEqual([]);
    expect(buildLiftRibbon(emptyLift, SIZE).hitRadiusPx).toBe(MIN_STROKE_PAD_PX);
  });

  it('guards a non-finite or non-positive canvas size on both branches', () => {
    const recorded = paintStroke('brush', [point(0.2, 0.5), point(0.8, 0.5)]);
    expect(buildStrokeBand(recorded, { width: 0, height: 600 })).toEqual({ polygonPx: [] });
    expect(buildStrokeBand(recorded, { width: Number.NaN, height: 600 }))
      .toEqual({ polygonPx: [] });
    expect(buildStrokeBand(liftStroke([point(0.2, 0.5), point(0.8, 0.5)]), {
      width: 1000,
      height: -1,
    })).toEqual({ polygonPx: [] });
  });
});

describe('261101-mvg stroke band — bounded cache', () => {
  it('caches paint polygons by (revision, width, height) and trims dropped ids', () => {
    const recorded = paintStroke('brush', [point(0.2, 0.5), point(0.8, 0.5)]);
    const first = buildStrokeBandCached(recorded, 7001, SIZE, 5);
    const again = buildStrokeBandCached(recorded, 7001, SIZE, 5);
    expect(again.polygonPx).toBe(first.polygonPx);
    // A revision bump invalidates the whole map: fresh but equal arrays.
    const nextRevision = buildStrokeBandCached(recorded, 7001, SIZE, 6);
    expect(nextRevision.polygonPx).not.toBe(first.polygonPx);
    expect(nextRevision.polygonPx).toEqual(first.polygonPx);
    // A size change invalidates it too (the stamp carries both extents).
    const resized = buildStrokeBandCached(recorded, 7001, { width: 1000, height: 600 }, 6);
    expect(resized.polygonPx).not.toBe(nextRevision.polygonPx);

    const kept = buildStrokeBandCached(recorded, 7002, SIZE, 6);
    trimStrokeBandCache([7002]);
    expect(buildStrokeBandCached(recorded, 7002, SIZE, 6).polygonPx).toBe(kept.polygonPx);
    trimStrokeBandCache([]);
    expect(buildStrokeBandCached(recorded, 7002, SIZE, 6).polygonPx).not.toBe(kept.polygonPx);
  });

  it('delegates the lift path to the ONE eraser cache (identity with buildLiftRibbonCached)', () => {
    const recorded = liftStroke([point(0.2, 0.5), point(0.8, 0.5)]);
    expect(buildStrokeBandCached(recorded, 7003, SIZE, 9).polygonPx).toBe(
      buildLiftRibbonCached(recorded, 7003, SIZE, 9).polygonPx,
    );
  });
});

describe('261101-mvg stroke band — module purity', () => {
  it('imports neither Preact, signals nor the stateful footprint helper', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./aquarelleStrokeBand.ts', import.meta.url)),
      'utf8',
    );
    // Import-STATEMENT pins, not bare substrings: the header comment NAMES the
    // excluded modules, so a substring gate would be self-invalidating.
    expect(source).toContain("from './aquarelleLiftRibbon'");
    expect(source).toContain('buildLiftRibbon');
    expect(source).not.toMatch(/from\s+['"][^'"]*preact[^'"]*['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*aquarelleFootprint[^'"]*['"]/);
  });
});
