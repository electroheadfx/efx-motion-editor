// ============================================================
//  scriptStrokeTransform — pure selection-transform geometry
//  (quick 261024-mz5 Task 2).
//
//  Signal-free and Preact-free: the overlay preview, the brush
//  engine commit and the watercolor script edit all consume these
//  functions, so a ghost can never disagree with what commits.
//
//  GEOMETRY LAW
//    - the union box spans every selected stroke's inflated bounds;
//    - the four corner squares are UNIFORM scale about the box
//      CENTRE (the inline editor's geometry law);
//    - the four edge midpoint squares are NON-UNIFORM scale along
//      one axis, anchored at the OPPOSITE edge — r/l resize width,
//      t/b resize height, the other axis is untouched (the inline
//      editor's D-04 law);
//    - the rotate circle sits above top-centre on a stem;
//    - corner scale = currentDistance / startDistance — direct
//      manipulation, the inline editor's `newDist / startDist`
//      (D-06 reference) — clamped to [0.1, 10]; edge scale is
//      (pointer - anchor) / original side, same clamp;
//    - Shift snaps rotation to 15 degrees (PI / 12);
//    - apply = scale FIRST (about the anchor), then rotate about
//      the centre.
//
//  Only x / y move. Every other point field (pressure, tilt,
//  twist, speed) and the stroke's `params` are out of scope here.
// ============================================================

/** Minimal point shape — CanvasPoint and PenPoint both satisfy it. */
export interface ScriptTransformPoint {
  x: number;
  y: number;
}

export interface ScriptStrokeSelectionBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScriptStrokeTransform {
  readonly kind: 'rotate' | 'scale';
  /** Rotation centre — also the uniform-scale anchor. */
  readonly centerX: number;
  readonly centerY: number;
  /** Scale anchor: the box centre for corners, the opposite edge for edges. */
  readonly anchorX: number;
  readonly anchorY: number;
  readonly angleRad: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export type ScriptStrokeTransformCorner = 'tl' | 'tr' | 'bl' | 'br';
export type ScriptStrokeTransformEdge = 't' | 'r' | 'b' | 'l';

export interface ScriptStrokeTransformHandle {
  readonly id: ScriptStrokeTransformCorner | ScriptStrokeTransformEdge | 'rotate';
  readonly kind: 'rotate' | 'scale';
  readonly x: number;
  readonly y: number;
}

/** Drawn corner-square edge, in canvas pixels. */
export const SCRIPT_TRANSFORM_HANDLE_SIZE_PX = 9;
/** Extra hit tolerance around a corner square. */
export const SCRIPT_TRANSFORM_HANDLE_HIT_PAD_PX = 8;
/** Stem length from top-centre up to the rotate circle. */
export const SCRIPT_TRANSFORM_ROTATE_STEM_PX = 28;
/** Drawn rotate-circle radius. */
export const SCRIPT_TRANSFORM_ROTATE_RADIUS_PX = 7;

/** Shift snap step — 15 degrees. */
const ROTATE_SNAP_RAD = Math.PI / 12;
/** Scale factor bounds: never collapse to zero and never explode. */
const SCALE_MIN_FACTOR = 0.1;
const SCALE_MAX_FACTOR = 10;
/** Identity tolerances (angle radians, factor delta). */
const IDENTITY_ANGLE_EPSILON = 1e-6;
const IDENTITY_FACTOR_EPSILON = 0.01;

function normalizeAngle(angleRad: number): number {
  return Math.atan2(Math.sin(angleRad), Math.cos(angleRad));
}

function distanceToSegment(
  px: number,
  py: number,
  a: ScriptTransformPoint,
  b: ScriptTransformPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - a.x, py - a.y);
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** Union of every selected stroke's (already inflated) bounds. */
export function scriptStrokeSelectionBox(
  strokes: ReadonlyArray<{ bounds: ScriptStrokeSelectionBox }>,
): ScriptStrokeSelectionBox | null {
  if (strokes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { bounds } of strokes) {
    if (bounds.x < minX) minX = bounds.x;
    if (bounds.y < minY) minY = bounds.y;
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The nine drawn handles: four scale corners, four edge midpoints, the rotate circle. */
export function scriptStrokeTransformHandles(
  box: ScriptStrokeSelectionBox,
): ScriptStrokeTransformHandle[] {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  return [
    { id: 'tl', kind: 'scale', x: box.x, y: box.y },
    { id: 'tr', kind: 'scale', x: box.x + box.width, y: box.y },
    { id: 'bl', kind: 'scale', x: box.x, y: box.y + box.height },
    { id: 'br', kind: 'scale', x: box.x + box.width, y: box.y + box.height },
    { id: 't', kind: 'scale', x: centerX, y: box.y },
    { id: 'r', kind: 'scale', x: box.x + box.width, y: centerY },
    { id: 'b', kind: 'scale', x: centerX, y: box.y + box.height },
    { id: 'l', kind: 'scale', x: box.x, y: centerY },
    { id: 'rotate', kind: 'rotate', x: centerX, y: box.y - SCRIPT_TRANSFORM_ROTATE_STEM_PX },
  ];
}

/**
 * The handle under a canvas point (handle hit-testing wins over the
 * stroke hit test). Every scale handle uses the padded square — corners
 * are listed first, so a corner wins over the adjacent edge midpoint.
 * The rotate handle accepts the circle AND the stem; the edge handles
 * are tested before the stem so the top midpoint stays grabbable.
 */
export function hitTestScriptStrokeTransformHandle(
  point: ScriptTransformPoint,
  box: ScriptStrokeSelectionBox,
): ScriptStrokeTransformHandle | null {
  const half = SCRIPT_TRANSFORM_HANDLE_SIZE_PX / 2 + SCRIPT_TRANSFORM_HANDLE_HIT_PAD_PX;
  const handles = scriptStrokeTransformHandles(box);
  for (const handle of handles) {
    if (handle.kind !== 'scale') continue;
    if (Math.abs(point.x - handle.x) <= half && Math.abs(point.y - handle.y) <= half) {
      return handle;
    }
  }
  const rotate = handles[handles.length - 1]!;
  if (
    Math.hypot(point.x - rotate.x, point.y - rotate.y)
    <= SCRIPT_TRANSFORM_ROTATE_RADIUS_PX + SCRIPT_TRANSFORM_HANDLE_HIT_PAD_PX
  ) {
    return rotate;
  }
  const topCenter = { x: box.x + box.width / 2, y: box.y };
  if (distanceToSegment(point.x, point.y, topCenter, rotate) <= SCRIPT_TRANSFORM_HANDLE_HIT_PAD_PX) {
    return rotate;
  }
  return null;
}

/** Rotate one point about a centre, preserving every other field. */
export function rotateScriptPoint<T extends ScriptTransformPoint>(
  point: T,
  centerX: number,
  centerY: number,
  angleRad: number,
): T {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  return {
    ...point,
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos,
  } as T;
}

/** Scale one point per axis about an anchor, preserving every other field. */
export function scaleScriptPoint<T extends ScriptTransformPoint>(
  point: T,
  anchorX: number,
  anchorY: number,
  scaleX: number,
  scaleY: number,
): T {
  return {
    ...point,
    x: anchorX + (point.x - anchorX) * scaleX,
    y: anchorY + (point.y - anchorY) * scaleY,
  } as T;
}

/** The shared commit math: scale first (about the anchor), then rotate about the centre. */
export function applyScriptStrokeTransform<T extends ScriptTransformPoint>(
  point: T,
  transform: ScriptStrokeTransform,
): T {
  const scaled = scaleScriptPoint(
    point,
    transform.anchorX,
    transform.anchorY,
    transform.scaleX,
    transform.scaleY,
  );
  return rotateScriptPoint(scaled, transform.centerX, transform.centerY, transform.angleRad);
}

function clampScaleFactor(value: number): number {
  return Math.min(SCALE_MAX_FACTOR, Math.max(SCALE_MIN_FACTOR, value));
}

function isCornerHandle(id: ScriptStrokeTransformHandle['id']): id is ScriptStrokeTransformCorner {
  return id === 'tl' || id === 'tr' || id === 'bl' || id === 'br';
}

/**
 * Build the live transform from a handle gesture. Corners scale uniformly
 * about the box centre (drag away = grow, `currentDistance / startDistance`);
 * edge midpoints scale ONE axis, anchored at the opposite edge (the inline
 * editor's D-04 law); rotation is the atan2 difference. Shift snaps rotation
 * to 15 degrees. Every factor is clamped to [0.1, 10].
 */
export function buildScriptStrokeTransform(
  handle: ScriptStrokeTransformHandle,
  box: ScriptStrokeSelectionBox,
  startPoint: ScriptTransformPoint,
  currentPoint: ScriptTransformPoint,
  snap: boolean,
): ScriptStrokeTransform {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  if (handle.kind === 'rotate') {
    const startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
    const currentAngle = Math.atan2(currentPoint.y - centerY, currentPoint.x - centerX);
    let angleRad = currentAngle - startAngle;
    if (snap) angleRad = Math.round(angleRad / ROTATE_SNAP_RAD) * ROTATE_SNAP_RAD;
    return {
      kind: 'rotate',
      centerX,
      centerY,
      anchorX: centerX,
      anchorY: centerY,
      angleRad: normalizeAngle(angleRad),
      scaleX: 1,
      scaleY: 1,
    };
  }

  if (isCornerHandle(handle.id)) {
    const startDistance = Math.hypot(startPoint.x - centerX, startPoint.y - centerY);
    const currentDistance = Math.hypot(currentPoint.x - centerX, currentPoint.y - centerY);
    // A degenerate distance is identity, never NaN or a collapse to zero: a
    // pointer exactly on the centre has no direction to scale along.
    const rawFactor =
      startDistance > 0 && currentDistance > 0 ? currentDistance / startDistance : 1;
    const factor = clampScaleFactor(rawFactor);
    return {
      kind: 'scale',
      centerX,
      centerY,
      anchorX: centerX,
      anchorY: centerY,
      angleRad: 0,
      scaleX: factor,
      scaleY: factor,
    };
  }

  // Edge midpoint: one axis scales, the opposite edge is the anchor, and the
  // other axis stays untouched (non-uniform resize — D-04).
  let anchorX = centerX;
  let anchorY = centerY;
  let scaleX = 1;
  let scaleY = 1;
  if (handle.id === 'r' || handle.id === 'l') {
    if (box.width > 0) {
      if (handle.id === 'r') {
        anchorX = box.x;
        scaleX = clampScaleFactor((currentPoint.x - anchorX) / box.width);
      } else {
        anchorX = box.x + box.width;
        scaleX = clampScaleFactor((anchorX - currentPoint.x) / box.width);
      }
    }
  } else if (box.height > 0) {
    if (handle.id === 'b') {
      anchorY = box.y;
      scaleY = clampScaleFactor((currentPoint.y - anchorY) / box.height);
    } else {
      anchorY = box.y + box.height;
      scaleY = clampScaleFactor((anchorY - currentPoint.y) / box.height);
    }
  }
  return {
    kind: 'scale',
    centerX,
    centerY,
    anchorX,
    anchorY,
    angleRad: 0,
    scaleX,
    scaleY,
  };
}

/** True when a release would be a no-op (tiny angle, tiny per-axis scale delta). */
export function isIdentityScriptStrokeTransform(transform: ScriptStrokeTransform): boolean {
  return (
    Math.abs(transform.angleRad) < IDENTITY_ANGLE_EPSILON
    && Math.abs(transform.scaleX - 1) < IDENTITY_FACTOR_EPSILON
    && Math.abs(transform.scaleY - 1) < IDENTITY_FACTOR_EPSILON
  );
}
