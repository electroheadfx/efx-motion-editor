/**
 * Rail-motion canvas path overlay (quick 261108-kvw).
 *
 * A hooks-free leaf drawn inside the existing rail-motion transform-handle
 * SVG, rendered FIRST so the dashed route sits BEHIND the boundary polygon and
 * the handle rects. The root group and every child carry `pointer-events:
 * none` and register no handlers, so the overlay can never intercept painting,
 * key dragging or handle dragging (T-KVW-01).
 *
 * Split of work, so scrubbing never rebuilds the polyline:
 * - the STATIC geometry (path `d`, key dots, stroke/dot radii, dash pattern)
 *   is memoized in a module-level one-entry cache keyed on the path bundle
 *   reference plus project size and zoom;
 * - the cursor marker is recomputed on every call — it is the only geometry
 *   that follows the playhead.
 */

import {
  buildRailMotionPathD,
  placeRailMotionPathPoint,
  type RailMotionPath,
  type RailMotionPathCursorPoint,
} from '../roto/railMotionPath';

/**
 * The ONE rail-motion accent source. The transform handles, the polygon, the
 * rotation stem and handle strokes all import this constant — no new design
 * token is introduced.
 */
export const RAIL_MOTION_PATH_ACCENT = '#4A90D9';

export interface RailMotionPathDot {
  readonly key: number;
  readonly x: number;
  readonly y: number;
}

export interface RailMotionPathRenderModel {
  readonly d: string;
  readonly dots: readonly RailMotionPathDot[];
  readonly marker: { readonly x: number; readonly y: number } | null;
  readonly strokeWidth: number;
  readonly dotRadius: number;
  readonly markerRadius: number;
  readonly dashArray: string;
}

export interface RailMotionPathRenderModelInput {
  readonly path: RailMotionPath | null;
  readonly cursor: RailMotionPathCursorPoint | null;
  readonly projectWidth: number;
  readonly projectHeight: number;
  readonly zoom: number;
}

interface RailMotionPathStaticModel {
  readonly path: RailMotionPath;
  readonly projectWidth: number;
  readonly projectHeight: number;
  readonly zoom: number;
  readonly d: string;
  readonly dots: readonly RailMotionPathDot[];
  readonly strokeWidth: number;
  readonly dotRadius: number;
  readonly dashArray: string;
}

/** One entry: the route is rebuilt only when the bundle or the canvas changes. */
let _railMotionPathStaticModel: RailMotionPathStaticModel | null = null;

function railMotionPathScreenSize(zoom: number, screenPixels: number): number {
  return zoom > 0 ? screenPixels / zoom : screenPixels;
}

function buildRailMotionPathStaticModel(
  path: RailMotionPath,
  projectWidth: number,
  projectHeight: number,
  zoom: number,
): RailMotionPathStaticModel {
  const cached = _railMotionPathStaticModel;
  if (cached !== null
    && Object.is(cached.path, path)
    && Object.is(cached.projectWidth, projectWidth)
    && Object.is(cached.projectHeight, projectHeight)
    && Object.is(cached.zoom, zoom)) {
    return cached;
  }

  // Every position key frame is in the sample list whenever the authored set
  // fits the sampler's hard cap; an over-cap authored set is decimated, so a
  // key frame without a surviving sample draws no dot (never a mis-placed one).
  const sampleByFrame = new Map<number, { readonly x: number; readonly y: number }>();
  for (const sample of path.samples) sampleByFrame.set(sample.frame, sample);

  const dots: RailMotionPathDot[] = [];
  for (const keyFrame of path.keyFrames) {
    const sample = sampleByFrame.get(keyFrame);
    if (sample === undefined) continue;
    const placed = placeRailMotionPathPoint(
      sample.x,
      sample.y,
      path.pivotX,
      path.pivotY,
      projectWidth,
      projectHeight,
      zoom,
    );
    dots.push(Object.freeze({
      key: keyFrame,
      x: placed.x,
      y: placed.y,
    }) as RailMotionPathDot);
  }

  const model = Object.freeze({
    path,
    projectWidth,
    projectHeight,
    zoom,
    d: buildRailMotionPathD(path, projectWidth, projectHeight, zoom),
    dots: Object.freeze(dots) as readonly RailMotionPathDot[],
    strokeWidth: railMotionPathScreenSize(zoom, 1.5),
    dotRadius: railMotionPathScreenSize(zoom, 3),
    dashArray: `${railMotionPathScreenSize(zoom, 6)} ${railMotionPathScreenSize(zoom, 4)}`,
  }) as RailMotionPathStaticModel;
  _railMotionPathStaticModel = model;
  return model;
}

/**
 * Resolves the render model. Null in => null out. The static geometry comes
 * from the module cache; the marker is placed per call from the cursor's
 * authored point, so only it changes while scrubbing.
 */
export function resolveRailMotionPathRenderModel(
  input: RailMotionPathRenderModelInput,
): RailMotionPathRenderModel | null {
  const { path, cursor, projectWidth, projectHeight, zoom } = input;
  if (path === null) return null;

  const staticModel = buildRailMotionPathStaticModel(
    path,
    projectWidth,
    projectHeight,
    zoom,
  );
  const marker = cursor === null
    ? null
    : Object.freeze(placeRailMotionPathPoint(
      cursor.x,
      cursor.y,
      path.pivotX,
      path.pivotY,
      projectWidth,
      projectHeight,
      zoom,
    ));

  return Object.freeze({
    d: staticModel.d,
    dots: staticModel.dots,
    marker,
    strokeWidth: staticModel.strokeWidth,
    dotRadius: staticModel.dotRadius,
    markerRadius: railMotionPathScreenSize(zoom, 5),
    dashArray: staticModel.dashArray,
  }) as RailMotionPathRenderModel;
}

const OVERLAY_GROUP_POINTER_STYLE = { pointerEvents: 'none' as const };

export interface RailMotionPathOverlayProps {
  readonly model: RailMotionPathRenderModel | null;
}

/**
 * The leaf itself. No hooks, no handlers, no store reads — pure props to SVG.
 */
export function RailMotionPathOverlay(props: RailMotionPathOverlayProps) {
  const model = props.model;
  if (model === null) return null;
  return (
    <g
      class="physics-paint-rail-motion-path"
      aria-hidden="true"
      style={OVERLAY_GROUP_POINTER_STYLE}
    >
      <path
        class="rail-motion-path-line"
        d={model.d}
        fill="none"
        stroke={RAIL_MOTION_PATH_ACCENT}
        stroke-width={model.strokeWidth}
        stroke-dasharray={model.dashArray}
        vector-effect="non-scaling-stroke"
        style={OVERLAY_GROUP_POINTER_STYLE}
      />
      {model.dots.map((dot) => (
        <circle
          key={dot.key}
          class="rail-motion-path-key-dot"
          cx={dot.x}
          cy={dot.y}
          r={model.dotRadius}
          fill={RAIL_MOTION_PATH_ACCENT}
          style={OVERLAY_GROUP_POINTER_STYLE}
        />
      ))}
      {model.marker === null ? null : (
        <circle
          class="rail-motion-path-cursor"
          cx={model.marker.x}
          cy={model.marker.y}
          r={model.markerRadius}
          fill={RAIL_MOTION_PATH_ACCENT}
          stroke="white"
          stroke-width={model.strokeWidth}
          vector-effect="non-scaling-stroke"
          style={OVERLAY_GROUP_POINTER_STYLE}
        />
      )}
    </g>
  );
}
