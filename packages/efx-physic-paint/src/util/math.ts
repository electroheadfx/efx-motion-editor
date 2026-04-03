// ============================================================
//  Math Utilities
//  Extracted from efx-paint-physic-v3.html lines 433-494, 581
//  All functions preserve the exact v3 algorithms
// ============================================================

import type { PenPoint } from '../types'

/**
 * Gaussian random number via Box-Muller transform.
 * From v3.html gauss(m,s) — line 433
 */
export function gauss(mean: number = 0, stddev: number = 1): number {
  return Math.sqrt(-2 * Math.log(Math.random())) *
    Math.cos(2 * Math.PI * Math.random()) * stddev + mean
}

/**
 * Linear interpolation between two values.
 * From v3.html lerp(a,b,t) — line 434
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Distance between two points (object or array form).
 * From v3.html dist(a,b) — line 453
 */
export function dist(
  a: { x: number; y: number } | [number, number],
  b: { x: number; y: number } | [number, number],
): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    return Math.hypot(a[0] - b[0], a[1] - b[1])
  }
  const ao = a as { x: number; y: number }
  const bo = b as { x: number; y: number }
  return Math.hypot(ao.x - bo.x, ao.y - bo.y)
}

/**
 * Distance between two point objects.
 * From v3.html distXY(a,b) — line 435
 */
export function distXY(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Clamp a value to [lo, hi] range.
 * From v3.html clamp(v,lo,hi) — line 457
 */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Compute bounding box for a curve with radius padding.
 * Returns clamped bounds within canvas area.
 * From v3.html curveBounds(curve, radius) — lines 437-451
 *
 * Note: Uses canvasW/canvasH parameters instead of v3's global W/H
 */
export function curveBounds(
  curve: Array<{ x: number; y: number }>,
  radius: number,
  canvasW: number = 1000,
  canvasH: number = 650,
): { x0: number; y0: number; x1: number; y1: number; w: number; h: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const p of curve) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  const pad = radius * 2 + 10
  const x0 = Math.max(0, Math.floor(minX - pad))
  const y0 = Math.max(0, Math.floor(minY - pad))
  const x1 = Math.min(canvasW, Math.ceil(maxX + pad))
  const y1 = Math.min(canvasH, Math.ceil(maxY + pad))

  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}

/**
 * Compute bounding box for a polygon (array of [x,y] tuples).
 * From v3.html polyBounds(pts) — line 581
 */
export function polyBounds(
  pts: Array<[number, number]>,
): { x0: number; y0: number; x1: number; y1: number; w: number; h: number } {
  let x0 = 1e9
  let y0 = 1e9
  let x1 = -1e9
  let y1 = -1e9

  for (const [x, y] of pts) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }

  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}

/**
 * Linearly interpolate between two PenPoints.
 * From v3.html lerpPt(a,b,t) — lines 488-494
 */
export function lerpPt(a: PenPoint, b: PenPoint, t: number): PenPoint {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    p: lerp(a.p, b.p, t),
    tx: lerp(a.tx, b.tx, t),
    ty: lerp(a.ty, b.ty, t),
    tw: lerp(a.tw, b.tw, t),
    spd: lerp(a.spd, b.spd, t),
  }
}
