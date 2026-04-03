/**
 * bezierPath.ts — Pure math utilities for bezier path editing (Phase 25)
 *
 * No store imports, no side effects. All functions are pure.
 * Provides: freehand-to-bezier conversion, shape-to-bezier, point insertion/deletion,
 * handle coupling, segment dragging, sampling, and hit-testing.
 */

import fitCurve from 'fit-curve';
import { Bezier } from 'bezier-js';
import type { BezierAnchor, PaintShape } from '../types/paint';

// ---------------------------------------------------------------------------
// 1. cubicBezierPoint — Standard cubic bezier evaluation (de Casteljau)
// ---------------------------------------------------------------------------

export function cubicBezierPoint(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t2 * t * x3,
    y: mt2 * mt * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t2 * t * y3,
  };
}

// ---------------------------------------------------------------------------
// 2. pointsToBezierAnchors — Convert freehand [x,y,pressure][] to BezierAnchor[]
// ---------------------------------------------------------------------------

/** Find nearest pressure value from original points for a given position */
function findNearestPressure(
  points: [number, number, number][],
  pos: number[],
): number {
  let minDist = Infinity;
  let pressure = 0.5;
  for (const [x, y, p] of points) {
    const d = (x - pos[0]) ** 2 + (y - pos[1]) ** 2;
    if (d < minDist) {
      minDist = d;
      pressure = p;
    }
  }
  return pressure;
}

export function pointsToBezierAnchors(
  points: [number, number, number][],
  tolerance: number = 4.0,
): BezierAnchor[] {
  if (points.length < 2) {
    return points.map(([x, y, p]) => ({
      x, y, pressure: p,
      handleIn: null, handleOut: null,
    }));
  }

  // Extract 2D positions for fit-curve
  const positions = points.map(([x, y]) => [x, y]);

  let currentTolerance = tolerance;
  let segments: number[][][] = [];
  let attempts = 0;

  // Fit with tolerance clamping: retry if too many anchors
  while (attempts < 5) {
    segments = fitCurve(positions, currentTolerance);
    const anchorCount = segments.length + 1;

    if (anchorCount > 80) {
      // Way too many anchors — increase tolerance
      currentTolerance *= 2.0;
      attempts++;
      continue;
    }
    if (anchorCount < 3 && points.length > 10) {
      // Too few anchors for a complex stroke — decrease tolerance
      currentTolerance *= 0.5;
      attempts++;
      continue;
    }
    break;
  }

  if (segments.length === 0) {
    return points.map(([x, y, p]) => ({
      x, y, pressure: p,
      handleIn: null, handleOut: null,
    }));
  }

  // Build BezierAnchor array from fit-curve segments
  const anchors: BezierAnchor[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (i === 0) {
      // First segment: create first anchor with handleOut only
      const pressure = findNearestPressure(points, seg[0]);
      anchors.push({
        x: seg[0][0], y: seg[0][1],
        pressure,
        handleIn: null,
        handleOut: { x: seg[1][0], y: seg[1][1] },
      });
    }
    // End point of segment: handleIn from cp2, handleOut from next segment's cp1
    const pressure = findNearestPressure(points, seg[3]);
    const handleIn = { x: seg[2][0], y: seg[2][1] };
    const handleOut = (i < segments.length - 1)
      ? { x: segments[i + 1][1][0], y: segments[i + 1][1][1] }
      : null;
    anchors.push({
      x: seg[3][0], y: seg[3][1],
      pressure,
      handleIn,
      handleOut,
    });
  }

  return anchors;
}

// ---------------------------------------------------------------------------
// 3. shapeToAnchors — Convert PaintShape to BezierAnchor[] + closedPath flag
// ---------------------------------------------------------------------------

/** Rotate a point around a center by angle radians */
function rotatePoint(
  px: number, py: number,
  cx: number, cy: number,
  angle: number,
): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/** Rotate anchor positions and handles around a center */
function rotateAnchor(
  anchor: BezierAnchor,
  cx: number, cy: number,
  angle: number,
): BezierAnchor {
  const pos = rotatePoint(anchor.x, anchor.y, cx, cy, angle);
  const handleIn = anchor.handleIn
    ? rotatePoint(anchor.handleIn.x, anchor.handleIn.y, cx, cy, angle)
    : null;
  const handleOut = anchor.handleOut
    ? rotatePoint(anchor.handleOut.x, anchor.handleOut.y, cx, cy, angle)
    : null;
  return { ...anchor, x: pos.x, y: pos.y, handleIn, handleOut };
}

export function shapeToAnchors(
  shape: PaintShape,
): { anchors: BezierAnchor[]; closedPath: boolean } {
  const rotation = shape.rotation ?? 0;

  switch (shape.tool) {
    case 'line': {
      let anchors: BezierAnchor[] = [
        { x: shape.x1, y: shape.y1, pressure: 0.5, handleIn: null, handleOut: null },
        { x: shape.x2, y: shape.y2, pressure: 0.5, handleIn: null, handleOut: null },
      ];
      if (rotation) {
        const cx = (shape.x1 + shape.x2) / 2;
        const cy = (shape.y1 + shape.y2) / 2;
        anchors = anchors.map(a => rotateAnchor(a, cx, cy, rotation));
      }
      return { anchors, closedPath: false };
    }
    case 'rect': {
      const xMin = Math.min(shape.x1, shape.x2);
      const yMin = Math.min(shape.y1, shape.y2);
      const xMax = Math.max(shape.x1, shape.x2);
      const yMax = Math.max(shape.y1, shape.y2);
      let anchors: BezierAnchor[] = [
        { x: xMin, y: yMin, pressure: 0.5, handleIn: null, handleOut: null },
        { x: xMax, y: yMin, pressure: 0.5, handleIn: null, handleOut: null },
        { x: xMax, y: yMax, pressure: 0.5, handleIn: null, handleOut: null },
        { x: xMin, y: yMax, pressure: 0.5, handleIn: null, handleOut: null },
      ];
      if (rotation) {
        const cx = (xMin + xMax) / 2;
        const cy = (yMin + yMax) / 2;
        anchors = anchors.map(a => rotateAnchor(a, cx, cy, rotation));
      }
      return { anchors, closedPath: true };
    }
    case 'ellipse': {
      const cx = (shape.x1 + shape.x2) / 2;
      const cy = (shape.y1 + shape.y2) / 2;
      const rx = Math.abs(shape.x2 - shape.x1) / 2;
      const ry = Math.abs(shape.y2 - shape.y1) / 2;
      const k = 0.5522847498; // kappa for cubic bezier circle approximation
      let anchors: BezierAnchor[] = [
        {
          x: cx, y: cy - ry, pressure: 0.5,
          handleIn: { x: cx - rx * k, y: cy - ry },
          handleOut: { x: cx + rx * k, y: cy - ry },
        },
        {
          x: cx + rx, y: cy, pressure: 0.5,
          handleIn: { x: cx + rx, y: cy - ry * k },
          handleOut: { x: cx + rx, y: cy + ry * k },
        },
        {
          x: cx, y: cy + ry, pressure: 0.5,
          handleIn: { x: cx + rx * k, y: cy + ry },
          handleOut: { x: cx - rx * k, y: cy + ry },
        },
        {
          x: cx - rx, y: cy, pressure: 0.5,
          handleIn: { x: cx - rx, y: cy + ry * k },
          handleOut: { x: cx - rx, y: cy - ry * k },
        },
      ];
      if (rotation) {
        anchors = anchors.map(a => rotateAnchor(a, cx, cy, rotation));
      }
      return { anchors, closedPath: true };
    }
    default:
      return { anchors: [], closedPath: false };
  }
}

// ---------------------------------------------------------------------------
// 4. sampleBezierPath — Re-densify bezier anchors to [x,y,pressure][] points
// ---------------------------------------------------------------------------

export function sampleBezierPath(
  anchors: BezierAnchor[],
  spacing: number = 2.0,
  closedPath: boolean = false,
): [number, number, number][] {
  if (anchors.length < 2) {
    return anchors.map(a => [a.x, a.y, a.pressure]);
  }

  const result: [number, number, number][] = [];
  const segmentCount = closedPath ? anchors.length : anchors.length - 1;

  for (let i = 0; i < segmentCount; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % anchors.length];
    const cp1 = a.handleOut ?? { x: a.x, y: a.y };
    const cp2 = b.handleIn ?? { x: b.x, y: b.y };

    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(10, Math.ceil(dist / spacing));

    for (let t = 0; t <= steps; t++) {
      const u = t / steps;
      const pt = cubicBezierPoint(
        a.x, a.y, cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y, u,
      );
      const pressure = a.pressure + (b.pressure - a.pressure) * u;
      result.push([pt.x, pt.y, pressure]);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 5. insertAnchorOnSegment — Split a bezier segment via de Casteljau
// ---------------------------------------------------------------------------

export function insertAnchorOnSegment(
  anchors: BezierAnchor[],
  segmentIndex: number,
  t: number,
): BezierAnchor[] {
  if (segmentIndex < 0 || segmentIndex >= anchors.length - 1) {
    return [...anchors];
  }

  const result = anchors.map(a => ({ ...a,
    handleIn: a.handleIn ? { ...a.handleIn } : null,
    handleOut: a.handleOut ? { ...a.handleOut } : null,
  }));
  const a = result[segmentIndex];
  const b = result[segmentIndex + 1];
  const cp1 = a.handleOut ?? { x: a.x, y: a.y };
  const cp2 = b.handleIn ?? { x: b.x, y: b.y };

  const bez = new Bezier(a.x, a.y, cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y);
  const split = bez.split(t);
  const left = split.left;
  const right = split.right;

  // Update anchor A's handleOut
  a.handleOut = { x: left.points[1].x, y: left.points[1].y };

  // New anchor at split point with interpolated pressure
  const pressure = a.pressure + (b.pressure - a.pressure) * t;
  const newAnchor: BezierAnchor = {
    x: left.points[3].x,
    y: left.points[3].y,
    pressure,
    handleIn: { x: left.points[2].x, y: left.points[2].y },
    handleOut: { x: right.points[1].x, y: right.points[1].y },
  };

  // Update anchor B's handleIn
  b.handleIn = { x: right.points[2].x, y: right.points[2].y };

  // Splice new anchor into array
  result.splice(segmentIndex + 1, 0, newAnchor);
  return result;
}

// ---------------------------------------------------------------------------
// 6. deleteAnchor — Remove anchor and auto-adjust neighboring handles
// ---------------------------------------------------------------------------

export function deleteAnchor(
  anchors: BezierAnchor[],
  idx: number,
): BezierAnchor[] {
  if (anchors.length <= 2) return [...anchors]; // Cannot delete below 2 anchors
  if (idx < 0 || idx >= anchors.length) return [...anchors];

  const result = anchors.map(a => ({ ...a,
    handleIn: a.handleIn ? { ...a.handleIn } : null,
    handleOut: a.handleOut ? { ...a.handleOut } : null,
  }));
  result.splice(idx, 1);

  // Auto-adjust handles of neighbors for smooth reconnection
  if (idx > 0 && idx < result.length) {
    const prev = result[idx - 1];
    const next = result[idx];
    // Point handles toward each other at 1/3 distance
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    prev.handleOut = { x: prev.x + dx / 3, y: prev.y + dy / 3 };
    next.handleIn = { x: next.x - dx / 3, y: next.y - dy / 3 };
  }

  return result;
}

// ---------------------------------------------------------------------------
// 7. updateCoupledHandle — Smooth handle coupling with Alt-break (D-08)
// ---------------------------------------------------------------------------

export function updateCoupledHandle(
  anchor: BezierAnchor,
  draggedSide: 'in' | 'out',
  newPos: { x: number; y: number },
  isAltHeld: boolean,
): void {
  // Set the dragged handle to newPos
  if (draggedSide === 'out') {
    anchor.handleOut = { x: newPos.x, y: newPos.y };
  } else {
    anchor.handleIn = { x: newPos.x, y: newPos.y };
  }

  // Alt breaks tangent (D-08)
  if (isAltHeld) {
    anchor.cornerMode = true;
    return;
  }

  // If already corner mode, don't re-couple
  if (anchor.cornerMode) return;

  // Mirror opposite handle: same angle + PI, preserve opposite handle's original distance
  const opposite = draggedSide === 'out' ? 'handleIn' : 'handleOut';
  const current = draggedSide === 'out' ? anchor.handleOut! : anchor.handleIn!;
  const otherHandle = anchor[opposite];

  const angle = Math.atan2(current.y - anchor.y, current.x - anchor.x);
  const oppositeAngle = angle + Math.PI;

  if (otherHandle) {
    const dist = Math.hypot(otherHandle.x - anchor.x, otherHandle.y - anchor.y);
    anchor[opposite] = {
      x: anchor.x + Math.cos(oppositeAngle) * dist,
      y: anchor.y + Math.sin(oppositeAngle) * dist,
    };
  }
}

// ---------------------------------------------------------------------------
// 8. dragSegment — Drag a point on the curve between two anchors (D-10)
// ---------------------------------------------------------------------------

export function dragSegment(
  anchorA: BezierAnchor,
  anchorB: BezierAnchor,
  t: number,
  targetPos: { x: number; y: number },
): void {
  const cp1 = anchorA.handleOut ?? { x: anchorA.x, y: anchorA.y };
  const cp2 = anchorB.handleIn ?? { x: anchorB.x, y: anchorB.y };

  // Current point at t on the bezier
  const currentPt = cubicBezierPoint(
    anchorA.x, anchorA.y, cp1.x, cp1.y, cp2.x, cp2.y, anchorB.x, anchorB.y, t,
  );

  // Delta from current position to target
  const dx = targetPos.x - currentPt.x;
  const dy = targetPos.y - currentPt.y;

  // Distribute delta to both handles proportionally
  const w1 = 1 - t;
  const w2 = t;
  anchorA.handleOut = {
    x: cp1.x + dx * w1,
    y: cp1.y + dy * w1,
  };
  anchorB.handleIn = {
    x: cp2.x + dx * w2,
    y: cp2.y + dy * w2,
  };
}

// ---------------------------------------------------------------------------
// 9. findNearestSegment — Find closest segment to a point using bezier-js
// ---------------------------------------------------------------------------

export function findNearestSegment(
  anchors: BezierAnchor[],
  point: { x: number; y: number },
  closedPath: boolean = false,
): { segmentIndex: number; t: number; distance: number } | null {
  if (anchors.length < 2) return null;

  let bestSegment = -1;
  let bestT = 0;
  let bestDist = Infinity;

  const segmentCount = closedPath ? anchors.length : anchors.length - 1;

  for (let i = 0; i < segmentCount; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % anchors.length];
    const cp1 = a.handleOut ?? { x: a.x, y: a.y };
    const cp2 = b.handleIn ?? { x: b.x, y: b.y };

    const bez = new Bezier(a.x, a.y, cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y);
    const proj = bez.project(point);
    const dist = Math.hypot(proj.x - point.x, proj.y - point.y);

    if (dist < bestDist) {
      bestDist = dist;
      bestSegment = i;
      bestT = proj.t ?? 0;
    }
  }

  if (bestSegment === -1) return null;
  return { segmentIndex: bestSegment, t: bestT, distance: bestDist };
}

// ---------------------------------------------------------------------------
// 10. hitTestAnchor — Find anchor/handle within a hit radius
// ---------------------------------------------------------------------------

export function hitTestAnchor(
  anchors: BezierAnchor[],
  point: { x: number; y: number },
  radius: number,
): { anchorIndex: number; part: 'anchor' | 'handleIn' | 'handleOut' } | null {
  const r2 = radius * radius;

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];

    // Check anchor point first (priority over handles)
    if ((a.x - point.x) ** 2 + (a.y - point.y) ** 2 <= r2) {
      return { anchorIndex: i, part: 'anchor' };
    }

    // Check handleIn
    if (a.handleIn) {
      if ((a.handleIn.x - point.x) ** 2 + (a.handleIn.y - point.y) ** 2 <= r2) {
        return { anchorIndex: i, part: 'handleIn' };
      }
    }

    // Check handleOut
    if (a.handleOut) {
      if ((a.handleOut.x - point.x) ** 2 + (a.handleOut.y - point.y) ** 2 <= r2) {
        return { anchorIndex: i, part: 'handleOut' };
      }
    }
  }

  return null;
}
