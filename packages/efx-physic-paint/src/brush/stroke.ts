// ============================================================
//  Stroke Processing Pipeline
//  Extracted from efx-paint-physic-v3.html lines 496-580
//  All functions are pure — no module-level mutable state, no DOM access.
// ============================================================

import type { PenPoint } from '../types'
import { gauss, distXY, clamp } from '../util/math'
import { lerpPt } from '../util/math'

/**
 * Averages pen data across points.
 * From v3.html avgPenData() line 496
 */
export function avgPenData(pts: PenPoint[]): { p: number; tx: number; ty: number; tw: number; spd: number } {
  if (!pts.length) return { p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }
  let p = 0, tx = 0, ty = 0, tw = 0, spd = 0
  for (const pt of pts) { p += pt.p; tx += pt.tx; ty += pt.ty; tw += pt.tw; spd += pt.spd }
  const n = pts.length
  return { p: p / n, tx: tx / n, ty: ty / n, tw: tw / n, spd: spd / n }
}

/**
 * Interpolate pressure along stroke at parameter t (0-1).
 * From v3.html pressureAtT() line 504
 */
export function pressureAtT(pts: PenPoint[], t: number): number {
  const i = clamp(Math.round(t * (pts.length - 1)), 0, pts.length - 1)
  return pts[i].p
}

/**
 * Interpolate speed along stroke at parameter t (0-1).
 * From v3.html speedAtT() line 508
 */
export function speedAtT(pts: PenPoint[], t: number): number {
  const i = clamp(Math.round(t * (pts.length - 1)), 0, pts.length - 1)
  return pts[i].spd
}

/**
 * Interpolate tilt along stroke at parameter t (0-1).
 * From v3.html tiltAtT() line 512
 */
export function tiltAtT(pts: PenPoint[], t: number): { tx: number; ty: number; tw: number } {
  const i = clamp(Math.round(t * (pts.length - 1)), 0, pts.length - 1)
  return { tx: pts[i].tx, ty: pts[i].ty, tw: pts[i].tw }
}

/**
 * Catmull-Rom style smoothing via subdivision.
 * Default iterations=3.
 * From v3.html smooth() line 520
 */
export function smooth(pts: PenPoint[], iterations: number = 3): PenPoint[] {
  if (pts.length < 3) return pts
  let r = pts
  for (let i = 0; i < iterations; i++) {
    const s: PenPoint[] = [r[0]]
    for (let j = 0; j < r.length - 1; j++) {
      const a = r[j], b = r[j + 1]
      s.push(lerpPt(a, b, 0.25))
      s.push(lerpPt(a, b, 0.75))
    }
    s.push(r[r.length - 1])
    r = s
  }
  return r
}

/**
 * Equidistant resampling along curve.
 * From v3.html resample() line 533
 */
export function resample(pts: PenPoint[], spacing: number): PenPoint[] {
  if (pts.length < 2) return pts
  const r: PenPoint[] = [pts[0]]
  let ac = 0
  for (let i = 1; i < pts.length; i++) {
    const d = distXY(pts[i - 1], pts[i])
    ac += d
    while (ac >= spacing) {
      ac -= spacing
      const t = 1 - ac / d
      r.push(lerpPt(pts[i - 1], pts[i], t))
    }
  }
  return r
}

/**
 * Creates polygon from centerline with varying width from pressure.
 * Returns closed polygon as [x,y] array.
 * From v3.html ribbon() line 549
 *
 * @param curve - Resampled pen points
 * @param halfWidth - Half brush width (radius)
 * @param tPow - Taper power (default 0.8)
 * @param hasPenInput - Whether tablet pen is being used
 */
export function ribbon(
  curve: PenPoint[],
  halfWidth: number,
  tPow: number = 0.8,
  hasPenInput: boolean = false,
): Array<[number, number]> {
  if (curve.length < 2) return []
  const L: Array<[number, number]> = [], R: Array<[number, number]> = []
  for (let i = 0; i < curve.length; i++) {
    let tdx: number, tdy: number
    if (i === 0) { tdx = curve[1].x - curve[0].x; tdy = curve[1].y - curve[0].y }
    else if (i === curve.length - 1) { tdx = curve[i].x - curve[i - 1].x; tdy = curve[i].y - curve[i - 1].y }
    else { tdx = curve[i + 1].x - curve[i - 1].x; tdy = curve[i + 1].y - curve[i - 1].y }
    const l = Math.hypot(tdx, tdy) || 1, nx = -tdy / l, ny = tdx / l
    const t = i / (curve.length - 1)

    const endTaper = Math.pow(Math.sin(t * Math.PI), tPow) * 0.7 + 0.3
    const penPressure = curve[i].p
    const pr = hasPenInput ? penPressure * endTaper : endTaper
    const w = halfWidth * Math.max(0.1, pr)

    const tiltAngle = (curve[i].tx || 0) * 0.015
    const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle)
    const rnx = nx * cosT - ny * sinT, rny = nx * sinT + ny * cosT

    L.push([curve[i].x + rnx * w, curve[i].y + rny * w])
    R.push([curve[i].x - rnx * w, curve[i].y - rny * w])
  }
  return [...L, ...R.reverse()]
}

/**
 * Midpoint displacement for organic edges.
 * From v3.html deform() line 574
 */
export function deform(poly: Array<[number, number]>, variance: number): Array<[number, number]> {
  const r: Array<[number, number]> = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    r.push(a)
    r.push([(a[0] + b[0]) / 2 + gauss(0, variance), (a[1] + b[1]) / 2 + gauss(0, variance)])
  }
  return r
}

/**
 * Recursive deform with decreasing variance.
 * From v3.html deformN() line 580
 */
export function deformN(poly: Array<[number, number]>, depth: number, variance: number): Array<[number, number]> {
  let p = poly
  for (let d = 0; d < depth; d++) p = deform(p, variance / (1 + d * 0.65))
  return p
}
