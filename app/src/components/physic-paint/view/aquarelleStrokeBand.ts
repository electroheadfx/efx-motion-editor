// ============================================================
//  aquarelleStrokeBand — the ONE preview footprint band for both
//  stroke kinds (quick 261101-mvg, "Preview stroke size").
//
//  REUSE CONTRACT: the next quick (Draft mode) must import THIS
//  module and never rebuild paint footprint geometry. The band is
//  the area a recorded stroke covers on canvas:
//
//    - an Eraser (`lift`) DELEGATES to the 261029-eur ribbon law
//      (`buildLiftRibbon` / its cache) — the erase footprint is
//      never re-derived here;
//    - every paint tool derives its radius from the SAME bake law
//      the engine stamps with: declared size (`toEngineParams`),
//      recorded tip aspect, per-point recorded pressure through
//      the brush's `pressureSize`, water x1.3 at speed 0, and the
//      isotropic pen splat.
//
//  Both kinds share one geometry core (`buildSupportBandStations`
//  + `buildSupportBandPolygon` in `aquarelleLiftRibbon.ts`): the
//  normals, the aspect-corrected segment law, the decimation, the
//  support caps and the vertex budget are literally the same code,
//  so the two previews cannot drift apart.
//
//  PURITY: no Preact, no signals, no DOM, no stateful engine
//  import. `aquarelleFootprint.ts` (the engine/cursor footprint
//  helper) is deliberately NOT imported — it carries module state
//  (`cachedBrush`, `lastShapedAngle`) — but its numeric law is
//  reproduced in `paintRadiusDocFor` and pinned equal by test.
//
//  Frames: stations live in the doc-pixel frame
//  `{ x: uv.x * width, yUp: uv.y * height }`; the radius converts
//  as `r * height` on BOTH axes (isotropic length unit), and only
//  the final polygon flips to canvas px. Deriving normals in the
//  doc frame is what keeps the band off the mirror bug on a
//  non-square sheet.
//
//  Declared approximations (display-only): the recorded 60 Hz
//  samples are decimated to MAX_POLYLINE_POINTS, speed is 0 (the
//  engine's speed-thin factor is 1 — no speed term), a `random`
//  tip uses its preset angle and never RNG, and the raw segment
//  direction stands in for the engine's smoothed delta.
//
//  The only module state is a bounded, revision-keyed paint cache;
//  the Eraser keeps the ONE 261029-eur cache.
// ============================================================

import {
  buildBrushForStroke,
  toEngineParams,
  type Brush,
  type Rotation,
} from '@efxlab/efx-watercolor';
import type { AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  buildLiftRibbon,
  buildLiftRibbonCached,
  buildSupportBandPolygon,
  buildSupportBandStations,
} from './aquarelleLiftRibbon';
import type { CanvasPoint, ScriptStrokeSize } from './scriptStrokeEdition';

const DEG = Math.PI / 180;

/** The drawn footprint of one recorded stroke, in canvas px. */
export interface StrokeBandGeometry {
  /** Closed-on-render polygon; the renderer appends Z. Empty = draw nothing. */
  readonly polygonPx: CanvasPoint[];
}

/** The recorded tip resolved into the band's support shape. */
export interface StrokeBandTip {
  readonly brush: Brush;
  readonly aspect: number;
  /** Tip axis angle in the doc frame (y up), radians. */
  readonly angle: number;
  readonly rotation: Rotation;
}

/**
 * The recorded tip of a paint stroke, resolved through the SAME
 * `buildBrushForStroke` call the bake and the punch use.
 *
 * A `pen` is an isotropic ink splat: `Engine` taps `splatInk`, which takes no
 * angle, and `aquarelleFootprintFor` reports `aspect: 1, angle: 0`. The
 * recorder, however, stores the SELECTED tip's overrides for pen too, so an
 * unforced band would draw an off-law ellipse for a pen stroke recorded with
 * flat/chalk. Force aspect 1 and angle 0 here.
 */
export function paintTipForStroke(
  stroke: Pick<AquarelleStroke, 'tool' | 'brushId' | 'toolOverrides'>,
): StrokeBandTip {
  const brush = buildBrushForStroke(stroke.brushId || 'round', stroke.toolOverrides);
  if (stroke.tool === 'pen') {
    return { brush, aspect: 1, angle: 0, rotation: 'fixed' };
  }
  return {
    brush,
    aspect: brush.aspect,
    angle: brush.angle * DEG,
    rotation: brush.rotation,
  };
}

/**
 * The footprint radius in document heights for a paint tool at speed 0.
 * Mirrors `Engine.radius` / `Engine.brushRadius` (Engine.ts:1564-1587) and
 * `aquarelleFootprint.ts`'s `brushRadius`/`engineSizeMult` — that module is
 * stateful and is never imported here; this law is pinned EQUAL to it by
 * `aquarelleStrokeBand.test.ts`, so the drawn area and the stamped area cannot
 * drift.
 */
export function paintRadiusDocFor(
  tool: 'brush' | 'water' | 'pen',
  brush: Brush,
  engineSize: number,
  pressure: number,
): number {
  const sizeMult = Math.pow(3, (engineSize - 0.5) * 2);
  const clamped = Number.isFinite(pressure) ? Math.min(1, Math.max(0, pressure)) : 0;
  if (tool === 'pen') {
    // splatInk: (0.0016 + 0.0042 p) * 1.12, isotropic.
    return (0.0016 + 0.0042 * clamped) * 1.12 * sizeMult;
  }
  const t = Math.pow(clamped, brush.pressureSize);
  const radius = (brush.size[0] + (brush.size[1] - brush.size[0]) * t) * sizeMult * 0.8;
  // water: ×1.3 at speed 0 (the speed-thin factor is 1 while scripting).
  return tool === 'water' ? radius * 1.3 : radius;
}

/** The engine size the recorded params resolve to, with the bake's default. */
function engineSizeOf(params: Record<string, number>): number {
  const size = toEngineParams(params).size;
  return typeof size === 'number' && Number.isFinite(size) ? size : 0.5;
}

/**
 * The footprint band of one recorded stroke, in canvas px. Pure — same input,
 * same output; fresh arrays every call. The Eraser branch DELEGATES to the
 * 261029-eur ribbon; a stroke with zero valid stations returns an empty
 * polygon on BOTH branches and never throws.
 */
export function buildStrokeBand(
  stroke: Pick<
    AquarelleStroke,
    'tool' | 'points' | 'params' | 'brushId' | 'toolOverrides'
  >,
  size: ScriptStrokeSize,
): StrokeBandGeometry {
  if (
    !Number.isFinite(size.width)
    || !Number.isFinite(size.height)
    || size.width <= 0
    || size.height <= 0
  ) {
    return { polygonPx: [] };
  }
  if (stroke.tool === 'lift') {
    return { polygonPx: buildLiftRibbon(stroke, size).polygonPx };
  }
  const tool = stroke.tool;
  const engineSize = engineSizeOf(stroke.params);
  const tip = paintTipForStroke(stroke);
  const stations = buildSupportBandStations(
    stroke,
    tip,
    size,
    (point) => paintRadiusDocFor(tool, tip.brush, engineSize, point.p) * size.height,
  );
  if (stations.length === 0) return { polygonPx: [] };
  return { polygonPx: buildSupportBandPolygon(stations, size.height, tip.aspect) };
}

interface StrokeBandCacheEntry {
  readonly stamp: string;
  readonly polygonPx: CanvasPoint[];
}

/**
 * The ONLY module state: a bounded, revision-keyed PAINT cache. Any stamp
 * change (`revision|width|height`) clears the whole map before storing, so a
 * frame navigation or a resize can never serve a stale polygon;
 * `trimStrokeBandCache` drops ids the newest listing no longer contains
 * (T-261101-mvg-02). The Eraser keeps its own 261029-eur cache — exactly one
 * cache per kind.
 */
const strokeBandCache = new Map<number, StrokeBandCacheEntry>();

export function buildStrokeBandCached(
  stroke: Pick<
    AquarelleStroke,
    'tool' | 'points' | 'params' | 'brushId' | 'toolOverrides'
  >,
  mutationId: number,
  size: ScriptStrokeSize,
  revision: number,
): StrokeBandGeometry {
  if (stroke.tool === 'lift') {
    return {
      polygonPx: buildLiftRibbonCached(stroke, mutationId, size, revision).polygonPx,
    };
  }
  const stamp = `${revision}|${size.width}|${size.height}`;
  const cached = strokeBandCache.get(mutationId);
  if (cached && cached.stamp === stamp) return { polygonPx: cached.polygonPx };
  if (cached) strokeBandCache.clear();
  const built = buildStrokeBand(stroke, size);
  strokeBandCache.set(mutationId, { stamp, polygonPx: built.polygonPx });
  return built;
}

/** Drop every cached paint band whose id the newest listing no longer contains. */
export function trimStrokeBandCache(liveIds: Iterable<number>): void {
  const live = new Set(liveIds);
  for (const mutationId of [...strokeBandCache.keys()]) {
    if (!live.has(mutationId)) strokeBandCache.delete(mutationId);
  }
}
