import type {Layer} from '../../types/layer';
import type {Point} from './coordinateMapper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HandleType =
  | 'corner-tl'
  | 'corner-tr'
  | 'corner-br'
  | 'corner-bl'
  | 'edge-top'
  | 'edge-right'
  | 'edge-bottom'
  | 'edge-left'
  | 'rotate';

export interface HandlePosition {
  type: HandleType;
  x: number; // Project-space X
  y: number; // Project-space Y
}

export interface LayerBounds {
  corners: Point[]; // 4 corners in project space [TL, TR, BR, BL], rotated
  center: Point; // Center point in project space
  drawW: number; // Unscaled draw width (after aspect-fit + crop)
  drawH: number; // Unscaled draw height
}

// ---------------------------------------------------------------------------
// Bounding box geometry
// ---------------------------------------------------------------------------

/**
 * Compute the rotated bounding box corners of a layer in project space.
 *
 * Replicates the exact PreviewRenderer.drawLayer() transform pipeline:
 *   1. Calculate effective source dimensions after crop
 *   2. Aspect-fit to canvas dimensions
 *   3. Center at (transform.x + canvasW/2, transform.y + canvasH/2)
 *   4. Apply scaleX/scaleY to half-dimensions
 *   5. Rotate 4 corners around center by transform.rotation degrees
 */
export function getLayerBounds(
  layer: Layer,
  sourceWidth: number,
  sourceHeight: number,
  canvasW: number,
  canvasH: number,
): LayerBounds {
  const {cropTop, cropRight, cropBottom, cropLeft} = layer.transform;

  // 1. Effective source dimensions after crop
  const hasCrop = cropTop || cropRight || cropBottom || cropLeft;
  let srcW = sourceWidth;
  let srcH = sourceHeight;
  if (hasCrop) {
    srcW = sourceWidth * (1 - cropLeft - cropRight);
    srcH = sourceHeight * (1 - cropTop - cropBottom);
  }

  // Guard against degenerate dimensions
  if (srcW <= 0 || srcH <= 0) {
    const cx = layer.transform.x + canvasW / 2;
    const cy = layer.transform.y + canvasH / 2;
    return {
      corners: [
        {x: cx, y: cy},
        {x: cx, y: cy},
        {x: cx, y: cy},
        {x: cx, y: cy},
      ],
      center: {x: cx, y: cy},
      drawW: 0,
      drawH: 0,
    };
  }

  // 2. Aspect-fit to canvas
  const aspect = srcW / srcH;
  const canvasAspect = canvasW / canvasH;
  let drawW: number;
  let drawH: number;
  if (aspect > canvasAspect) {
    // Source is wider -- fit to canvas width
    drawW = canvasW;
    drawH = canvasW / aspect;
  } else {
    // Source is taller -- fit to canvas height
    drawH = canvasH;
    drawW = canvasH * aspect;
  }

  // 3. Center point in project space
  const cx = layer.transform.x + canvasW / 2;
  const cy = layer.transform.y + canvasH / 2;

  // 4. Half-dimensions after non-uniform scale
  const scaleX = layer.transform.scaleX;
  const scaleY = layer.transform.scaleY;
  const hw = (drawW / 2) * scaleX;
  const hh = (drawH / 2) * scaleY;

  // 5. Four corners before rotation (relative to center)
  const localCorners: Point[] = [
    {x: -hw, y: -hh}, // TL
    {x: hw, y: -hh}, // TR
    {x: hw, y: hh}, // BR
    {x: -hw, y: hh}, // BL
  ];

  // Rotate around center
  const rad = (layer.transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = localCorners.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));

  return {corners, center: {x: cx, y: cy}, drawW, drawH};
}

// ---------------------------------------------------------------------------
// Handle positions
// ---------------------------------------------------------------------------

/**
 * Returns positions for all 8 handles (4 corners + 4 edge midpoints).
 * Positions are in project space, derived from the bounding box corners.
 */
export function getHandlePositions(
  bounds: LayerBounds,
  _zoom: number,
): HandlePosition[] {
  const [tl, tr, br, bl] = bounds.corners;
  return [
    // Corner handles
    {type: 'corner-tl' as HandleType, x: tl.x, y: tl.y},
    {type: 'corner-tr' as HandleType, x: tr.x, y: tr.y},
    {type: 'corner-br' as HandleType, x: br.x, y: br.y},
    {type: 'corner-bl' as HandleType, x: bl.x, y: bl.y},
    // Edge midpoint handles
    {
      type: 'edge-top' as HandleType,
      x: (tl.x + tr.x) / 2,
      y: (tl.y + tr.y) / 2,
    },
    {
      type: 'edge-right' as HandleType,
      x: (tr.x + br.x) / 2,
      y: (tr.y + br.y) / 2,
    },
    {
      type: 'edge-bottom' as HandleType,
      x: (br.x + bl.x) / 2,
      y: (br.y + bl.y) / 2,
    },
    {
      type: 'edge-left' as HandleType,
      x: (bl.x + tl.x) / 2,
      y: (bl.y + tl.y) / 2,
    },
  ];
}

// ---------------------------------------------------------------------------
// Handle hit testing
// ---------------------------------------------------------------------------

/**
 * Check if a point (in project space) is within the hit area of any handle.
 * Handle hit area is `handleScreenSize / zoom` pixels (counter-scaled so
 * the clickable area remains constant regardless of zoom level).
 *
 * Returns the HandleType hit or null.
 */
export function hitTestHandles(
  point: Point,
  handles: HandlePosition[],
  zoom: number,
  handleScreenSize: number = 10,
): HandleType | null {
  const hitRadius = handleScreenSize / zoom;

  for (const handle of handles) {
    const dx = point.x - handle.x;
    const dy = point.y - handle.y;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return handle.type;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rotation zone detection
// ---------------------------------------------------------------------------

/**
 * Returns true if the point is outside the bounding box but within
 * a rotation hover zone (~15px screen distance of any corner).
 * The zone is outside the polygon but close to the corners.
 */
export function getRotationZone(
  point: Point,
  bounds: LayerBounds,
  zoom: number,
): boolean {
  // Must be OUTSIDE the bounding box polygon
  if (pointInPolygon(point, bounds.corners)) {
    return false;
  }

  const rotZoneScreenPx = 15;
  const rotZoneProjectPx = rotZoneScreenPx / zoom;

  // Check distance to each corner
  for (const corner of bounds.corners) {
    const dist = Math.hypot(point.x - corner.x, point.y - corner.y);
    if (dist <= rotZoneProjectPx) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Cursor mapping
// ---------------------------------------------------------------------------

/** The 8 cardinal/ordinal angles for resize cursor mapping. */
const RESIZE_CURSORS = [
  'n-resize', // 0deg (up)
  'ne-resize', // 45deg
  'e-resize', // 90deg
  'se-resize', // 135deg
  's-resize', // 180deg
  'sw-resize', // 225deg
  'w-resize', // 270deg
  'nw-resize', // 315deg
];

/**
 * Base angle (in degrees, measured clockwise from north) for each handle type.
 * Corner handles are at 45-degree increments starting from NW=315.
 * Edge handles are at 0/90/180/270.
 */
function baseAngleForHandle(handle: HandleType): number {
  switch (handle) {
    case 'corner-tl':
      return 315;
    case 'corner-tr':
      return 45;
    case 'corner-br':
      return 135;
    case 'corner-bl':
      return 225;
    case 'edge-top':
      return 0;
    case 'edge-right':
      return 90;
    case 'edge-bottom':
      return 180;
    case 'edge-left':
      return 270;
    default:
      return 0;
  }
}

/**
 * Returns CSS cursor value for a handle or rotation zone.
 * Corner/edge handles use resize cursors rotated by the layer rotation.
 * Rotation zone uses a crosshair cursor (custom rotation cursor can be added later).
 */
export function getCursorForHandle(
  handle: HandleType | null,
  isRotationZone: boolean,
  rotation: number,
): string {
  if (isRotationZone) {
    return 'crosshair'; // Rotation cursor -- can be replaced with custom SVG data URL
  }
  if (!handle || handle === 'rotate') {
    return 'default';
  }

  // Compute effective angle: base handle angle + layer rotation
  const base = baseAngleForHandle(handle);
  const effective = ((base + rotation) % 360 + 360) % 360;

  // Snap to nearest 45-degree increment
  const index = Math.round(effective / 45) % 8;
  return RESIZE_CURSORS[index];
}

// ---------------------------------------------------------------------------
// Point-in-polygon (convex, ray-casting)
// ---------------------------------------------------------------------------

/**
 * Standard ray-casting algorithm for testing if a point is inside a polygon.
 * Works for convex and concave polygons.
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}
