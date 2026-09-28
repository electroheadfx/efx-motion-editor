// ============================================================
//  260927-ton — Shape detail (edgeDetail) deform amplitude must
//  scale with the LOCAL ribbon width along the stroke.
//
//  Law: for the same gesture, the maximum polygon-boundary
//  deviation in a hairline region (p <= 0.1) is at most 0.30 of
//  the maximum deviation in a thick-body region (p = 1), and the
//  near-start taper deforms less than the body (<= 0.80), while
//  the thick-body organic amplitude stays within the today-formula
//  band [0.95, 3.0] x variance = (1.5 + sqrt(radius) * 0.9) * edgeMul.
//
//  Math.random stub: CONSTANT 0.5 (not an LCG — the constant is
//  what makes gauss magnitudes identical everywhere so the region
//  ratio isolates the local scale factor). gauss(0, s) then becomes
//  exactly sqrt(-2*ln(0.5)) * cos(pi) * s = -1.17741 * s: every
//  displacement vector of a given deform generation is the same
//  constant. Because the deform pass structure is periodic along
//  the stroke, the multiset of boundary deviations is identical in
//  any window spanning >= 3 resample spacings, so any region-MAX
//  difference can only come from a local scale factor.
//
//  Expected post-fix scale arithmetic (comment, not an assertion):
//    hairline s = max(0.1, 0.1 * endTaper) = 0.1 (endTaper <= 1)
//      -> hairline displacement = 0.1 x thick -> ratio about 0.07-0.10
//      (threshold 0.30 gives headroom)
//    thick s = endTaper(t in [0.30, 0.40]) in [0.891, 0.972]
//    taper s = endTaper(t in [0.06, 0.14]) in about [0.483, 0.654]
//      -> taper ratio about 0.61-0.73 (threshold 0.80)
//
//  Control expectation at base: tests 2, 4, 5 pass; tests 1 and 3
//  fail with the measured ratio printed — those failures ARE the
//  RED evidence.
//
//  Region filter (260927-ton gate resolution): ORIGIN-T, not x-window.
//  A post-deform x-window admits vertices the deform itself pushed
//  out of band (constant-stub displacements run ~6-8 px), inflating
//  the taper reading past its structural value. originTOfFillVertex
//  maps each fill index back through the 5-pass deform chain to the
//  curve t it came from — the amplitude-vs-local-width law is about
//  where a vertex originated, not where it landed.
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderPaintStroke } from './paint'
import { ribbon, smooth, resample } from './stroke'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

const CANVAS_W = 128
const CANVAS_H = 64
const MID_Y = 32
const RADIUS = 10
/** Today's uniform variance law (edgeDetail 50 -> edgeMul 1). */
const VARIANCE = (1.5 + Math.sqrt(RADIUS) * 0.9) * 1

type FillPath = Array<[number, number]>

// ------------------------------------------------------------
//  Gesture: straight horizontal pressure step, (4,32) -> (104,32)
//  p = 1 for x <= 50, p = 0.1 for x >= 60 (smooth/resample lerps
//  the transition).
// ------------------------------------------------------------
function makeRawGesture(): PenPoint[] {
  const pts: PenPoint[] = []
  for (let x = 4; x <= 104; x += 10) {
    const p = x <= 50 ? 1 : x >= 60 ? 0.1 : 1 - 0.9 * ((x - 50) / 10)
    pts.push({ x, y: MID_Y, p, tx: 0, ty: 0, tw: 0, spd: 0 })
  }
  return pts
}

/** Production geometry prelude, replicated with the exported pure helpers. */
function buildGeometry(): { curve: PenPoint[]; boundary: FillPath } {
  const sm = smooth(makeRawGesture(), 3)
  const curve = resample(sm, Math.max(3, RADIUS * 0.25))
  const boundary = ribbon(curve, RADIUS, 0.8, true)
  return { curve, boundary }
}

const inRange = (t: number, lo: number, hi: number) => t >= lo && t <= hi

// ------------------------------------------------------------
//  Structural origin-t of a captured fill vertex.
//
//  The capture is fills[0] = the first layer polygon, whose vertex
//  order is exactly the deform chain output (fillFlat does
//  moveTo pts[0] / lineTo rest, no reordering). The chain is
//  deformNScaled depth 4 over ribbonWithScales (2n vertices) plus
//  one layer deformScaled = 5 passes, so fill vertex k sits at
//  parameter u = k / 32 along the CLOSED base polygon.
//
//  Base polygon order is [...L, ...R.reverse()]: vertex v < n is
//  L[v] at curve t = v/(n-1); vertex v >= n is R[2n-1-v] at curve
//  t = (2n-1-v)/(n-1). Interpolating t along the base edge gives
//  the origin-t of any displaced midpoint without a nearest-neighbour
//  guess — this is the 260927-ton "origin-t reading": filter by
//  where a vertex CAME FROM, not by where the deform pushed it
//  (the x-window recipe admitted vertices displaced out of band).
// ------------------------------------------------------------
function tOfBaseVertex(v: number, n: number): number {
  const ci = v < n ? v : 2 * n - 1 - v
  return n > 1 ? ci / (n - 1) : 0
}

function originTOfFillVertex(k: number, n: number): number {
  const P = 2 * n
  const u = k / 32
  const e = Math.floor(u) % P
  const frac = u - Math.floor(u)
  const t0 = tOfBaseVertex(e, n)
  const t1 = tOfBaseVertex((e + 1) % P, n)
  return t0 + (t1 - t0) * frac
}

// ------------------------------------------------------------
//  Capture harness (paint.continuation.test.ts precedent):
//  canvasFactory records moveTo/lineTo coordinates per path and
//  snapshots the path on every fill op; document.createElement
//  stub; wet() buffers.
// ------------------------------------------------------------
function canvasFactory(fills: FillPath[]) {
  const contexts = new WeakMap<object, any>()
  return () => {
    const canvas: any = { width: 0, height: 0 }
    let path: FillPath = []
    const context: any = {
      canvas,
      fillStyle: '', globalAlpha: 1, strokeStyle: '', lineWidth: 1, lineCap: 'round',
      save: () => {}, restore: () => {},
      beginPath: () => { path = [] },
      moveTo: (x: number, y: number) => { path.push([x, y]) },
      lineTo: (x: number, y: number) => { path.push([x, y]) },
      closePath: () => {},
      fill: () => { fills.push(path.map(v => [v[0], v[1]] as [number, number])) },
      stroke: () => {},
      translate: () => {},
      drawImage: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
      clearRect: () => {},
    }
    contexts.set(canvas, context)
    canvas.getContext = () => contexts.get(canvas)
    return canvas
  }
}

function wet(size: number): WetBuffers {
  return {
    r: new Float32Array(size), g: new Float32Array(size), b: new Float32Array(size),
    alpha: new Float32Array(size), wetness: new Float32Array(size), strokeOpacity: new Float32Array(size),
  }
}

/** Run one pressure gesture through renderPaintStroke and return the FIRST fill path (pickup-less layers[0]). */
function captureFirstFill(): FillPath {
  const fills: FillPath[] = []
  vi.stubGlobal('document', { createElement: vi.fn(canvasFactory(fills)) })
  const main = canvasFactory(fills)()
  const opts = { size: 10, opacity: 100, pressure: 100, waterAmount: 50, dryAmount: 50, edgeDetail: 50, pickup: 0, eraseStrength: 50, antiAlias: 0 } satisfies BrushOpts
  const buffers = wet(CANVAS_W * CANVAS_H)
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  renderPaintStroke(
    makeRawGesture(), '#336699', opts, main.getContext('2d'), buffers, {} as any,
    new Float32Array(CANVAS_W * CANVAS_H), new Uint8Array(CANVAS_W * CANVAS_H),
    null, CANVAS_W, CANVAS_H,
    true, false, 0.5, () => 0.5,
  )
  expect(fills.length, 'the stroke must produce at least one fill').toBeGreaterThan(0)
  return fills[0]
}

// ------------------------------------------------------------
//  Measurement: point-to-polyline distance to the CLOSED
//  undeformed boundary B (point-segment distance, min over all
//  segments); region max = max over captured vertices whose x lies
//  in the window (no other filter).
// ------------------------------------------------------------
function distToClosedPoly(v: [number, number], poly: FillPath): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const vx = b[0] - a[0]
    const vy = b[1] - a[1]
    const len2 = vx * vx + vy * vy
    let t = len2 > 0 ? ((v[0] - a[0]) * vx + (v[1] - a[1]) * vy) / len2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const dx = v[0] - (a[0] + t * vx)
    const dy = v[1] - (a[1] + t * vy)
    const d = Math.hypot(dx, dy)
    if (d < best) best = d
  }
  return best
}

/** Region max over fill vertices whose STRUCTURAL origin-t is in [tLo, tHi]. */
function regionMaxByT(fill: FillPath, boundary: FillPath, n: number, tLo: number, tHi: number, label: string): number {
  let max = 0
  let count = 0
  for (let k = 0; k < fill.length; k++) {
    const t = originTOfFillVertex(k, n)
    if (t >= tLo && t <= tHi) {
      count++
      const d = distToClosedPoly(fill[k], boundary)
      if (d > max) max = d
    }
  }
  expect(count, `${label} origin-t band [${tLo},${tHi}] selected ${count} fill vertices (need >= 1)`).toBeGreaterThan(0)
  return max
}

interface Measurement {
  hairline: number
  thick: number
  taper: number
  hairlineWidth: number
}

let cached: Measurement | null = null

function measure(): Measurement {
  if (cached) return cached
  const { curve, boundary } = buildGeometry()
  const n = curve.length

  // Substrate validity: undeformed ribbon width inside the hairline window.
  let hairlineWidth = 0
  for (let i = 0; i < curve.length; i++) {
    const t = i / (curve.length - 1)
    if (curve[i].p <= 0.1001 && inRange(t, 0.68, 0.88)) {
      const li = boundary[i]
      const ri = boundary[2 * n - 1 - i]
      hairlineWidth = Math.max(hairlineWidth, Math.abs(li[1] - ri[1]))
    }
  }

  const fill = captureFirstFill()
  cached = {
    hairline: regionMaxByT(fill, boundary, n, 0.68, 0.88, 'hairline'),
    thick: regionMaxByT(fill, boundary, n, 0.30, 0.40, 'thick'),
    taper: regionMaxByT(fill, boundary, n, 0.06, 0.14, 'taper'),
    hairlineWidth,
  }
  return cached
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('260927-ton — edgeDetail deform amplitude scales with local ribbon width', () => {
  it('Test 1 (hairline pin): hairline max deviation <= 0.30 x thick-body max deviation', () => {
    const m = measure()
    const ratio = m.thick > 0 ? m.hairline / m.thick : NaN
    console.log(`[RED-pin] hairline=${m.hairline.toFixed(4)} thick=${m.thick.toFixed(4)} hairline/thick=${ratio.toFixed(4)}`)
    expect(
      ratio,
      `hairline/thick ratio = ${m.hairline.toFixed(4)}/${m.thick.toFixed(4)} = ${ratio.toFixed(4)} (must be <= 0.30)`,
    ).toBeLessThanOrEqual(0.30)
  })

  it('Test 2 (thick-body preservation control): thick max stays within [0.95, 3.0] x today\'s variance', () => {
    const m = measure()
    console.log(`[RED-pin] thick=${m.thick.toFixed(4)} variance=${VARIANCE.toFixed(4)} band=[${(0.95 * VARIANCE).toFixed(4)}, ${(3.0 * VARIANCE).toFixed(4)}]`)
    expect(
      m.thick,
      `thick max ${m.thick.toFixed(4)} must be >= 0.95 x variance ${(0.95 * VARIANCE).toFixed(4)}`,
    ).toBeGreaterThanOrEqual(0.95 * VARIANCE)
    expect(
      m.thick,
      `thick max ${m.thick.toFixed(4)} must be <= 3.0 x variance ${(3.0 * VARIANCE).toFixed(4)}`,
    ).toBeLessThanOrEqual(3.0 * VARIANCE)
  })

  it('Test 3 (taper pin): taper max deviation <= 0.80 x thick-body max deviation', () => {
    const m = measure()
    const ratio = m.thick > 0 ? m.taper / m.thick : NaN
    console.log(`[RED-pin] taper=${m.taper.toFixed(4)} thick=${m.thick.toFixed(4)} taper/thick=${ratio.toFixed(4)}`)
    expect(
      ratio,
      `taper/thick ratio = ${m.taper.toFixed(4)}/${m.thick.toFixed(4)} = ${ratio.toFixed(4)} (must be <= 0.80)`,
    ).toBeLessThanOrEqual(0.80)
  })

  it('Test 4 (substrate-validity control): undeformed ribbon width in the hairline window <= 3.0 px', () => {
    const m = measure()
    console.log(`[RED-pin] hairline ribbon width=${m.hairlineWidth.toFixed(4)} px`)
    expect(
      m.hairlineWidth,
      `hairline window ribbon width ${m.hairlineWidth.toFixed(4)} px must be <= 3.0 px (real ~2px hairline, non-vacuous pin)`,
    ).toBeLessThanOrEqual(3.0)
  })

  it('Test 5 (determinism control): two runs under the constant stub produce byte-identical fill paths', () => {
    const a = captureFirstFill()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    const b = captureFirstFill()
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
})
