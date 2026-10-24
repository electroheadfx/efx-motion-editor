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
//    - the rotate circle sits above top-centre on a stem;
//    - scale = currentDistance / startDistance — direct
//      manipulation, the inline editor's `newDist / startDist`
//      (D-06 reference) — clamped to [0.1, 10];
//    - Shift snaps rotation to 15 degrees (PI / 12);
//    - apply = scale FIRST, then rotate about the same centre.
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
  readonly centerX: number;
  readonly centerY: number;
  readonly angleRad: number;
  readonly factor: number;
}

export type ScriptStrokeTransformCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface ScriptStrokeTransformHandle {
  readonly id: ScriptStrokeTransformCorner | 'rotate';
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

/** The five drawn handles: four scale corners plus the rotate circle. */
export function scriptStrokeTransformHandles(
  box: ScriptStrokeSelectionBox,
): ScriptStrokeTransformHandle[] {
  const centerX = box.x + box.width / 2;
  return [
    { id: 'tl', kind: 'scale', x: box.x, y: box.y },
    { id: 'tr', kind: 'scale', x: box.x + box.width, y: box.y },
    { id: 'bl', kind: 'scale', x: box.x, y: box.y + box.height },
    { id: 'br', kind: 'scale', x: box.x + box.width, y: box.y + box.height },
    { id: 'rotate', kind: 'rotate', x: centerX, y: box.y - SCRIPT_TRANSFORM_ROTATE_STEM_PX },
  ];
}

/**
 * The handle under a canvas point (handle hit-testing wins over the
 * stroke hit test). Corners use the padded square, the rotate handle
 * accepts the circle AND the stem.
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

/** Scale one point about a centre, preserving every other field. */
export function scaleScriptPoint<T extends ScriptTransformPoint>(
  point: T,
  centerX: number,
  centerY: number,
  factor: number,
): T {
  return {
    ...point,
    x: centerX + (point.x - centerX) * factor,
    y: centerY + (point.y - centerY) * factor,
  } as T;
}

/** The shared commit math: scale first, then rotate about the centre. */
export function applyScriptStrokeTransform<T extends ScriptTransformPoint>(
  point: T,
  transform: ScriptStrokeTransform,
): T {
  const scaled = scaleScriptPoint(point, transform.centerX, transform.centerY, transform.factor);
  return rotateScriptPoint(scaled, transform.centerX, transform.centerY, transform.angleRad);
}

/**
 * Build the live transform from a handle gesture. Scale is direct
 * manipulation (drag away from the centre = grow), rotated by the
 * atan2 difference. Shift snaps the rotation to 15 degrees.
 */
export function buildScriptStrokeTransform(
  kind: 'rotate' | 'scale',
  center: ScriptTransformPoint,
  startPoint: ScriptTransformPoint,
  currentPoint: ScriptTransformPoint,
  snap: boolean,
): ScriptStrokeTransform {
  if (kind === 'scale') {
    const startDistance = Math.hypot(startPoint.x - center.x, startPoint.y - center.y);
    const currentDistance = Math.hypot(currentPoint.x - center.x, currentPoint.y - center.y);
    // A degenerate distance is identity, never NaN or a collapse to zero: a
    // pointer exactly on the centre has no direction to scale along.
    const rawFactor =
      startDistance > 0 && currentDistance > 0 ? currentDistance / startDistance : 1;
    const factor = Math.min(SCALE_MAX_FACTOR, Math.max(SCALE_MIN_FACTOR, rawFactor));
    return { kind, centerX: center.x, centerY: center.y, angleRad: 0, factor };
  }
  const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
  const currentAngle = Math.atan2(currentPoint.y - center.y, currentPoint.x - center.x);
  let angleRad = currentAngle - startAngle;
  if (snap) angleRad = Math.round(angleRad / ROTATE_SNAP_RAD) * ROTATE_SNAP_RAD;
  return {
    kind,
    centerX: center.x,
    centerY: center.y,
    angleRad: normalizeAngle(angleRad),
    factor: 1,
  };
}

/** True when a release would be a no-op (tiny angle, tiny factor delta). */
export function isIdentityScriptStrokeTransform(transform: ScriptStrokeTransform): boolean {
  return (
    Math.abs(transform.angleRad) < IDENTITY_ANGLE_EPSILON
    && Math.abs(transform.factor - 1) < IDENTITY_FACTOR_EPSILON
  );
}
