// ============================================================
//  aquarelleLiftRibbon — the DRAWN border of a recorded Eraser
//  (lift) stroke (quick 261029-eur, requirement LIFT-RIBBON).
//
//  A lift is a stamped footprint, not a line: every dab shaves a
//  tip-shaped disc. The select surface therefore outlines it as a
//  RIBBON — the normal-offset band of the stroke, with a support
//  half-width that mirrors the tip (an ellipse above
//  LIFT_ROUNDED_ASPECT, a rounded rectangle below), plus caps
//  that sweep that SAME support function at both ends. The band's
//  radius comes from `liftRadiusDoc` — the SAME helper the punch
//  stamps with — so the drawn border and the erased pixels share
//  one footprint law by construction.
//
//  This module is pure: no Preact, no signals, no DOM, no
//  stateful engine import (the engine's footprint helper writes
//  module state and is never touched). The only module state is a
//  bounded, revision-keyed ribbon cache so a frame navigation or
//  a pointermove cannot rebuild paths.
//
//  Frames: stations live in a doc-pixel frame `{ x: uv.x * width,
//  yUp: uv.y * height }`; the radius converts as `r * height` on
//  BOTH axes (isotropic length unit, exactly like
//  `buildLiftCoverage`), and only the final polygon flips to
//  canvas px (`y = height - yUp`). Deriving normals in the UV
//  frame is what keeps the band off the mirror bug on a
//  non-square sheet.
// ============================================================

import type { AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import {
  liftEngineSize,
  liftRadiusDoc,
  liftShapeForStroke,
  type LiftFootprintShape,
} from '../roto/aquarelleLiftErase';
import {
  MAX_POLYLINE_POINTS,
  MIN_STROKE_PAD_PX,
  type CanvasPoint,
  type ScriptStrokeBounds,
  type ScriptStrokeSize,
} from './scriptStrokeEdition';

/**
 * 261029-eur: the tip aspect below which the support is a rounded
 * rectangle instead of an ellipse. Mirrors the engine layer's value — this
 * module stays free of that import (same rule as the rest of the file).
 */
export const LIFT_ROUNDED_ASPECT = 0.6;

/** Cap sweep resolution at each end of the band. */
const CAP_SEGMENTS = 8;

/** A single-point lift sweeps its support law this many directions around. */
const POINT_CIRCLE_SEGMENTS = 16;

/**
 * The analytic MAXIMUM of the band's own support formula over the normal
 * angle: `R * max(1, a)` on the ellipse branch (a tip wider than it is long,
 * `a > 1`, reaches `aR` on its wide side) and `R * hypot(1, a)` on the
 * rounded-rect branch. The hit radius uses this, never the bare footprint
 * radius, so a click anywhere inside the drawn border is inside the target.
 */
export function liftSupportFactor(aspect: number): number {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  return a >= LIFT_ROUNDED_ASPECT ? Math.max(1, a) : Math.hypot(1, a);
}

type LiftStrokeSource = Pick<
  AquarelleStroke,
  'points' | 'params' | 'brushId' | 'toolOverrides'
>;

/** Decimate recorded samples to the shared render cap, keeping every field. */
function decimateStations(
  points: readonly AquarelleStroke['points'][number][],
): AquarelleStroke['points'][number][] {
  if (points.length <= MAX_POLYLINE_POINTS) return [...points];
  const out: AquarelleStroke['points'][number][] = [];
  for (let index = 0; index < MAX_POLYLINE_POINTS; index += 1) {
    out.push(points[Math.round((index * (points.length - 1)) / (MAX_POLYLINE_POINTS - 1))]!);
  }
  return out;
}

interface BandStation {
  /** Doc-pixel frame: uv.x * width. */
  px: number;
  /** Doc-pixel frame, y up: uv.y * height. */
  pyUp: number;
  /** Footprint radius in canvas px (isotropic: docHeight * size.height). */
  radius: number;
  /** Tip axis angle in the doc-pixel frame (y up). */
  theta: number;
}

/**
 * The stroke's station list: pressure radius through the shared law, and the
 * mirror of `Engine.brushAngle` — a sticky azimuth scanned BEFORE each point,
 * `follow` riding the aspect-corrected segment direction, `random` the preset
 * angle (declared approximation: never call RNG), else azimuth ?? preset.
 */
function buildStations(
  stroke: LiftStrokeSource,
  shape: LiftFootprintShape,
  size: ScriptStrokeSize,
): BandStation[] {
  const points = decimateStations(stroke.points ?? []);
  const engineSize = liftEngineSize(stroke.params);
  const stations: BandStation[] = [];
  let azimuth: number | null = null;
  // The engine's smoothed s.dx/s.dy are not recorded; the raw segment
  // direction is the declared approximation `collectLiftDabs` also uses.
  let segmentAngle = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    if (Math.hypot(point.tx, point.ty) > 12) azimuth = Math.atan2(-point.ty, point.tx);
    if (index > 0) {
      const previous = points[index - 1]!;
      const dx = (point.x - previous.x) * size.width;
      const dyUp = (point.y - previous.y) * size.height;
      if (Math.hypot(dx, dyUp) > 1e-9) segmentAngle = Math.atan2(dyUp, dx);
    }
    const theta =
      shape.rotation === 'follow'
        ? segmentAngle + shape.angle
        : shape.rotation === 'random'
          ? shape.angle
          : azimuth ?? shape.angle;
    const px = point.x * size.width;
    const pyUp = point.y * size.height;
    const radius = liftRadiusDoc(point.p, engineSize) * size.height;
    // Never emit NaN into a path `d` (T-261029-eur-01).
    if (!Number.isFinite(px) || !Number.isFinite(pyUp) || !Number.isFinite(radius)) continue;
    if (!Number.isFinite(theta)) continue;
    stations.push({ px, pyUp, radius, theta });
  }
  return stations;
}

/** Central difference; endpoints use their adjacent segment; zero → previous. */
function stationTangent(
  stations: readonly BandStation[],
  index: number,
  previous: CanvasPoint,
): CanvasPoint {
  const count = stations.length;
  if (count === 1) return { x: 1, y: 0 };
  const a = stations[index === 0 ? 0 : index - 1]!;
  const b = stations[index === count - 1 ? count - 1 : index + 1]!;
  const dx = b.px - a.px;
  const dyUp = b.pyUp - a.pyUp;
  const length = Math.hypot(dx, dyUp);
  if (!(length > 1e-9)) return previous;
  return { x: dx / length, y: dyUp / length };
}

/**
 * The band's support half-width along an arbitrary unit direction (doc frame).
 * The band edges pass the local normal; the caps sweep this same law, so every
 * cap vertex joins the band on the same support curve (CR-01).
 */
function supportHalfWidth(
  station: BandStation,
  dirX: number,
  dirYUp: number,
  aspect: number,
): number {
  // Same finite/positive default as `liftSupportFactor` (T-261029-eur-01): a
  // non-finite aspect must never emit NaN into a path `d`.
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const delta = Math.atan2(dirYUp, dirX) - station.theta;
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  if (a >= LIFT_ROUNDED_ASPECT) {
    return station.radius * Math.sqrt(cos * cos + a * a * sin * sin);
  }
  return station.radius * (Math.abs(cos) + a * Math.abs(sin));
}

function toCanvas(point: CanvasPoint, height: number): CanvasPoint {
  return { x: point.x, y: height - point.y };
}

/** The click/hit radius in canvas px — the band's maximum support, floored. */
export function liftStrokeRadiusPx(
  stroke: Pick<AquarelleStroke, 'points' | 'params' | 'brushId' | 'toolOverrides'>,
  size: ScriptStrokeSize,
): number {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) {
    return MIN_STROKE_PAD_PX;
  }
  const shape = liftShapeForStroke(stroke);
  const support = liftSupportFactor(shape.aspect);
  const engineSize = liftEngineSize(stroke.params);
  let max = 0;
  for (const point of stroke.points ?? []) {
    const radius = liftRadiusDoc(point.p, engineSize) * size.height * support;
    if (Number.isFinite(radius) && radius > max) max = radius;
  }
  return Math.max(MIN_STROKE_PAD_PX, max);
}

export interface LiftRibbonGeometry {
  /** Closed-on-render polygon in canvas px; the renderer appends Z. */
  polygonPx: CanvasPoint[];
  /** The band's maximum support, floored at MIN_STROKE_PAD_PX. */
  hitRadiusPx: number;
}

/**
 * The drawn ribbon of one recorded lift stroke: a normal-offset band with
 * support-function caps. Pure — same input, same output; fresh arrays every call.
 */
export function buildLiftRibbon(
  stroke: LiftStrokeSource,
  size: ScriptStrokeSize,
): LiftRibbonGeometry {
  const hitRadiusPx = liftStrokeRadiusPx(stroke, size);
  if (
    !Number.isFinite(size.width)
    || !Number.isFinite(size.height)
    || size.width <= 0
    || size.height <= 0
  ) {
    return { polygonPx: [], hitRadiusPx };
  }
  const shape = liftShapeForStroke(stroke);
  const stations = buildStations(stroke, shape, size);
  if (stations.length === 0) return { polygonPx: [], hitRadiusPx };
  const aspect = shape.aspect;

  // Single sample: sweep the station's own support law all the way around, so
  // the drawn silhouette and the hit radius share one law (IN-02). A round tip
  // (aspect 1) is still the same circle; a wide tip draws its own ellipse.
  if (stations.length === 1) {
    const only = stations[0]!;
    const polygonPx: CanvasPoint[] = [];
    for (let index = 0; index < POINT_CIRCLE_SEGMENTS; index += 1) {
      const angle = (index / POINT_CIRCLE_SEGMENTS) * Math.PI * 2;
      const dirX = Math.cos(angle);
      const dirYUp = Math.sin(angle);
      const half = supportHalfWidth(only, dirX, dirYUp, aspect);
      polygonPx.push(
        toCanvas({ x: only.px + dirX * half, y: only.pyUp + dirYUp * half }, size.height),
      );
    }
    return { polygonPx, hitRadiusPx };
  }

  const left: CanvasPoint[] = [];
  const right: CanvasPoint[] = [];
  const tangents: CanvasPoint[] = [];
  let previousTangent: CanvasPoint = { x: 1, y: 0 };
  for (let index = 0; index < stations.length; index += 1) {
    const station = stations[index]!;
    const tangent = stationTangent(stations, index, previousTangent);
    previousTangent = tangent;
    tangents.push(tangent);
    // n = (-t.yUp, t.x): the left side of the travel direction.
    const normalX = -tangent.y;
    const normalYUp = tangent.x;
    const half = supportHalfWidth(station, normalX, normalYUp, aspect);
    left.push({ x: station.px + normalX * half, y: station.pyUp + normalYUp * half });
    right.push({ x: station.px - normalX * half, y: station.pyUp - normalYUp * half });
  }

  const docPolygon: CanvasPoint[] = [...left];
  // Forward cap about the last station, sweeping +n → -n through +t. Every cap
  // vertex takes the station's OWN support half-width along its radial
  // direction: angle 0 and π are the band junctions already emitted above, so
  // the cap meets the band exactly on the same support curve. A constant-radius
  // cap would flare out of a narrow band and notch into a wide one (CR-01).
  const last = stations[stations.length - 1]!;
  const lastTangent = tangents[tangents.length - 1]!;
  const lastNormal = { x: -lastTangent.y, y: lastTangent.x };
  for (let index = 1; index < CAP_SEGMENTS; index += 1) {
    const angle = (index / CAP_SEGMENTS) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dirX = cos * lastNormal.x + sin * lastTangent.x;
    const dirYUp = cos * lastNormal.y + sin * lastTangent.y;
    const half = supportHalfWidth(last, dirX, dirYUp, aspect);
    docPolygon.push({ x: last.px + dirX * half, y: last.pyUp + dirYUp * half });
  }
  for (let index = stations.length - 1; index >= 0; index -= 1) {
    docPolygon.push(right[index]!);
  }
  // Backward cap about the first station, sweeping -n → +n through -t — the
  // same support law, mirrored.
  const first = stations[0]!;
  const firstTangent = tangents[0]!;
  const firstNormal = { x: -firstTangent.y, y: firstTangent.x };
  for (let index = 1; index < CAP_SEGMENTS; index += 1) {
    const angle = (index / CAP_SEGMENTS) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dirX = -(cos * firstNormal.x + sin * firstTangent.x);
    const dirYUp = -(cos * firstNormal.y + sin * firstTangent.y);
    const half = supportHalfWidth(first, dirX, dirYUp, aspect);
    docPolygon.push({ x: first.px + dirX * half, y: first.pyUp + dirYUp * half });
  }

  return { polygonPx: docPolygon.map((point) => toCanvas(point, size.height)), hitRadiusPx };
}

/** Exact polygon bbox expanded by the shared grab margin (lift bounds law). */
export function liftRibbonBoundsPx(
  polygonPx: readonly CanvasPoint[],
  pad: number = MIN_STROKE_PAD_PX,
): ScriptStrokeBounds {
  if (polygonPx.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of polygonPx) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

interface LiftRibbonCacheEntry {
  readonly stamp: string;
  readonly polygonPx: CanvasPoint[];
  readonly hitRadiusPx: number;
}

/**
 * The ONLY module state: a revision-keyed ribbon cache. Any stamp change
 * (`revision|width|height`) clears the whole map before storing, so a frame
 * navigation or a resize can never serve a stale polygon; `trimLiftRibbonCache`
 * drops ids the newest listing no longer contains (T-261029-eur-01).
 */
const liftRibbonCache = new Map<number, LiftRibbonCacheEntry>();

export function buildLiftRibbonCached(
  stroke: LiftStrokeSource,
  mutationId: number,
  size: ScriptStrokeSize,
  revision: number,
): LiftRibbonGeometry {
  const stamp = `${revision}|${size.width}|${size.height}`;
  const cached = liftRibbonCache.get(mutationId);
  if (cached && cached.stamp === stamp) {
    return { polygonPx: cached.polygonPx, hitRadiusPx: cached.hitRadiusPx };
  }
  if (cached) liftRibbonCache.clear();
  const built = buildLiftRibbon(stroke, size);
  liftRibbonCache.set(mutationId, {
    stamp,
    polygonPx: built.polygonPx,
    hitRadiusPx: built.hitRadiusPx,
  });
  return built;
}

/** Drop every cached ribbon whose id the newest listing no longer contains. */
export function trimLiftRibbonCache(liveIds: Iterable<number>): void {
  const live = new Set(liveIds);
  for (const mutationId of [...liftRibbonCache.keys()]) {
    if (!live.has(mutationId)) liftRibbonCache.delete(mutationId);
  }
}
