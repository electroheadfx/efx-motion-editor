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
 * Creates the polygon from the centerline with varying width from
 * pressure, together with the local-width SCALE of every vertex
 * (260927-ton): s = w / halfWidth, i.e. the exact expression ribbon
 * already used for w — one computation, so polygon geometry and
 * scales can never diverge.
 *
 * Returns the closed polygon in [x,y] array form plus a scales array
 * aligned to the polygon vertex order: vertex k < n maps to
 * scales[k] (L side), vertex k >= n maps to scales[2n - 1 - k]
 * (R was reversed).
 *
 * @param curve - Resampled pen points
 * @param halfWidth - Half brush width (radius)
 * @param tPow - Taper power (default 0.8)
 * @param hasPenInput - Whether tablet pen is being used
 * @param tSpan - Optional global t range [t0, t1] this slice covers within
 *   the whole stroke (260929-t2o, R7 amended). endTaper then runs over the
 *   GLOBAL t so a mid-stroke slice keeps full lateral extent at its ends —
 *   taper belongs at true stroke ends, never at an internal re-slice
 *   boundary. Omitted = current per-slice behavior (byte-identical).
 */
export function ribbonWithScales(
  curve: PenPoint[],
  halfWidth: number,
  tPow: number = 0.8,
  hasPenInput: boolean = false,
  tSpan?: [number, number],
): { poly: Array<[number, number]>; scales: number[] } {
  if (curve.length < 2) return { poly: [], scales: [] }
  const L: Array<[number, number]> = [], R: Array<[number, number]> = []
  const scales: number[] = []
  for (let i = 0; i < curve.length; i++) {
    let tdx: number, tdy: number
    if (i === 0) { tdx = curve[1].x - curve[0].x; tdy = curve[1].y - curve[0].y }
    else if (i === curve.length - 1) { tdx = curve[i].x - curve[i - 1].x; tdy = curve[i].y - curve[i - 1].y }
    else { tdx = curve[i + 1].x - curve[i - 1].x; tdy = curve[i + 1].y - curve[i - 1].y }
    const l = Math.hypot(tdx, tdy) || 1, nx = -tdy / l, ny = tdx / l
    const u = i / (curve.length - 1)
    const t = tSpan ? tSpan[0] + (tSpan[1] - tSpan[0]) * u : u

    const endTaper = Math.pow(Math.sin(t * Math.PI), tPow) * 0.7 + 0.3
    const s = Math.max(0.1, (hasPenInput ? curve[i].p : 1) * endTaper)
    const w = halfWidth * s

    const tiltAngle = (curve[i].tx || 0) * 0.015
    const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle)
    const rnx = nx * cosT - ny * sinT, rny = nx * sinT + ny * cosT

    L.push([curve[i].x + rnx * w, curve[i].y + rny * w])
    R.push([curve[i].x - rnx * w, curve[i].y - rny * w])
    scales.push(s)
  }
  return { poly: [...L, ...R.reverse()], scales: [...scales, ...scales.slice().reverse()] }
}

/**
 * Creates polygon from centerline with varying width from pressure.
 * Returns closed polygon as [x,y] array.
 * From v3.html ribbon() line 549
 *
 * Delegates to ribbonWithScales and returns only the polygon, so the
 * ribbon geometry and the local-width scale channel are one code path.
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
  return ribbonWithScales(curve, halfWidth, tPow, hasPenInput).poly
}

/**
 * Scale-aware midpoint displacement for organic edges (260927-ton).
 * Same algorithm as deform — for each edge push the original vertex
 * then the displaced midpoint, gauss(0, variance) on x and y — except
 * the midpoint is displaced by gauss(0, variance * sMid) where
 * sMid = (sA + sB) / 2, so the deform amplitude follows the LOCAL
 * ribbon width instead of the base-brush-radius variance uniformly.
 * The output scales array carries [sA, sMid] per edge, aligned to the
 * output polygon vertex order. gauss call count per polygon is
 * unchanged from deform (two reads per edge).
 */
export function deformScaled(
  poly: Array<[number, number]>,
  scales: number[],
  variance: number,
  rng: () => number = Math.random,
): { poly: Array<[number, number]>; scales: number[] } {
  const r: Array<[number, number]> = []
  const rs: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    const a = poly[i], b = poly[j]
    const sA = scales[i], sB = scales[j]
    const sMid = (sA + sB) / 2
    r.push(a)
    rs.push(sA)
    r.push([(a[0] + b[0]) / 2 + gauss(0, variance * sMid, rng), (a[1] + b[1]) / 2 + gauss(0, variance * sMid, rng)])
    rs.push(sMid)
  }
  return { poly: r, scales: rs }
}

/**
 * Recursive scale-aware deform with decreasing variance — loops
 * exactly like deformN with the same pass divisor (1 + d * 0.65),
 * threading the local-width scales through every pass.
 */
export function deformNScaled(
  poly: Array<[number, number]>,
  scales: number[],
  depth: number,
  variance: number,
  rng: () => number = Math.random,
): { poly: Array<[number, number]>; scales: number[] } {
  let p = poly, s = scales
  for (let d = 0; d < depth; d++) {
    const out = deformScaled(p, s, variance / (1 + d * 0.65), rng)
    p = out.poly
    s = out.scales
  }
  return { poly: p, scales: s }
}

/**
 * Per-sample ribbon side offsets from the deformed contour (R10,
 * 260930-detail). Runs the deformNScaled midpoint law (gauss(0, variance *
 * sMid) — the 260927-ton local-width amplitude — with the v11 octave decay
 * 1/(1 + d * 0.65)) on the ribbonWithScales polygon, then folds each
 * deformed chain back onto the capsule lattice: per sample, the mean
 * perpendicular deviation of the inserted contour vertices in the two
 * adjacent chain segments (the ribbon polygon's two cap edges are never
 * folded). Positive = outward. Velocity multiplies the amplitude via
 * speedAtT (the existing speed law: clamp(1 + spd * 0.003, 1, 1.5)).
 * `variance = 0` = identity displacement (the pipeline still runs — the
 * look-continuity law: amplitude, never presence).
 */
export function deformSampleSides(
  curve: PenPoint[],
  halfWidth: number,
  tPow: number = 0.8,
  hasPenInput: boolean = false,
  tSpan?: [number, number],
  variance: number = 0,
  depth: number = 4,
  rng: () => number = Math.random,
): { leftOff: number[]; rightOff: number[] } {
  const n = curve.length
  const leftOff = new Array<number>(n).fill(0)
  const rightOff = new Array<number>(n).fill(0)
  if (n < 2) return { leftOff, rightOff }

  const { poly: base, scales: baseS } = ribbonWithScales(curve, halfWidth, tPow, hasPenInput, tSpan)
  const { poly: def } = deformNScaled(base, baseS, depth, variance, rng)
  const stride = 2 ** depth

  // Per-sample outward normal — rotated exactly like ribbonWithScales.
  const normals: Array<[number, number]> = []
  for (let si = 0; si < n; si++) {
    let tx: number, ty: number
    if (si === 0) { tx = curve[1].x - curve[0].x; ty = curve[1].y - curve[0].y }
    else if (si === n - 1) { tx = curve[si].x - curve[si - 1].x; ty = curve[si].y - curve[si - 1].y }
    else { tx = curve[si + 1].x - curve[si - 1].x; ty = curve[si + 1].y - curve[si - 1].y }
    const l = Math.hypot(tx, ty) || 1
    const nx = -ty / l, ny = tx / l
    const tiltAngle = (curve[si].tx || 0) * 0.015
    const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle)
    normals[si] = [nx * cosT - ny * sinT, nx * sinT + ny * cosT]
  }

  const inL = (v: number): boolean => v <= n - 1
  const inR = (v: number): boolean => v >= n
  const fold = (si: number, bi: number, sign: number): number => {
    const [nx, ny] = normals[si]
    let sum = 0
    let count = 0
    for (const a of [bi - 1, bi]) {
      const b = a + 1
      if (a < 0 || b > base.length - 1) continue
      if (!(inL(a) && inL(b)) && !(inR(a) && inR(b))) continue
      const ax = base[a][0], ay = base[a][1], bx = base[b][0], by = base[b][1]
      for (let k = a * stride + 1; k < (a + 1) * stride; k++) {
        const t = (k - a * stride) / stride
        const cx = ax + (bx - ax) * t
        const cy = ay + (by - ay) * t
        sum += sign * ((def[k][0] - cx) * nx + (def[k][1] - cy) * ny)
        count++
      }
    }
    return count > 0 ? sum / count : 0
  }

  for (let si = 0; si < n; si++) {
    const vScale = clamp(1 + speedAtT(curve, si / (n - 1)) * 0.003, 1, 1.5)
    leftOff[si] = fold(si, si, 1) * vScale
    rightOff[si] = fold(si, 2 * n - 1 - si, -1) * vScale
  }
  return { leftOff, rightOff }
}
