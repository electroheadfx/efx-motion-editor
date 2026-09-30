import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as paint from './paint'
import { createPaintStrokeRasterContinuation } from './paint'
import { ribbonWithScales } from './stroke'
import {
  buildBristleLanes,
  STREAK_ALPHA,
  CORE_MAX_TRACE_WIDTH,
  WIDTH_FLOOR,
  POISSON_FILL,
  BODY_BAND,
  RIM_WIDTH_MIN,
  RIM_WIDTH_MAX,
} from './footprintLanes'
import { hashMutationId } from '../util/traceSeed'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

// 260929-t2o (R7 amended 2026-09-29b, USER SPEC ACT) — capsule-sweep
// coverage contract pins (SPECS/real-paint/01-brush-footprint.md R7).
// Harness inherited from 52.4-01/02 + 260929-j47 + 260929-m2z (canvasFactory
// op-log stub + document stub + LCG Math.random + wet() + PenPoint arrays).
// The coverage model the pins encode changes from the m2z filled whole-fibre
// outline to the R7-amended capsule sweep:
//
//   R7-amended coverage = ONE transparent round-cap capsule sweep per fibre
//   (width = W(t) per short step), convex sub-shapes only, ONE coverage
//   action per fibre (one fill, nonzero union of same-winding convex capsule
//   subpaths). A self-intersecting whole-fibre outline is FORBIDDEN — it
//   cancels winding and punches holes (the 260929-m2z "parcellaire"
//   regression: hollow tube on thin spans, holes inside thick spans).
//   R7 continuous field: the thin family is DISSOLVED — lane density and
//   spacing scale with the local halfW through offset x halfW, never a
//   family switch at any width. endTaper belongs at TRUE stroke ends only
//   (FootprintParams.tSpan / ribbonWithScales global t-span), not at every
//   pickup re-slice boundary.
//   R7(a) rim legibility: rim widths >= 1 px (RIM_WIDTH_MIN/MAX) and W(t)
//   variation must SURVIVE the CORE_MAX_TRACE_WIDTH = 2 single clamp.
//   PIN 0 stays COMPOSITE: k_body >= 4 AND 1-prod(1-ga) >= 0.99 at every
//   body sample at radii 16 and 32 under the single fill alpha.
//
// Behaviors pinned:
//   1. export/tier            — drawBristleFootprint exported, (curve, params,
//                               tier), tier in {live, final}, FootprintParams
//                               carries ctx/radius/color/opac/hasPenInput/
//                               mutationId (+ tSpan, pinned separately)
//   2. determinism            — same mutationId -> identical op logs, different
//                               mutationId -> different, undefined mutationId
//                               (disk replay) -> byte-identical across runs
//   3. containment            — every boundary vertex within the local ribbon
//                               half-width (end taper included; capsule caps
//                               may bulge <= 1 px tangentially)
//   4. source shape           — body slice: ribbonWithScales + hashMutationId,
//                               no paper sampler / 0.72 / non-seeded RNG /
//                               removed alpha terms / skip machinery / stroke
//   5. stage pin              — observed run emits ZERO paint-raster-layers
//                               stages (retired with the 37x layering blocks)
//   6. D-07 gate              — tier=live: zero wet-transfer stages, wet.alpha
//                               untouched; tier=final: exactly one, mutates
//   R7-amended structure      — capsule-sweep, no-parcellaire curl,
//                               continuous field, tSpan, rim-width,
//                               clamp-surviving W(t), single-alpha,
//                               saturation-by-overlap
//   laws kept at BOUNDS       — determinism ABA, containment, SIZE <= 0.35,
//                               velocity scope lock, density ratio >= 1.5,
//                               gauge <= 10%, ink +/- 15%, live divisor 4,
//                               rim Poisson gap floor, width [WIDTH_FLOOR,
//                               CORE_MAX_TRACE_WIDTH], composite 0.99 / k 4

const LCG_START = 123456789

function canvasFactory(log: string[]) {
  const contexts = new WeakMap<object, any>()
  return () => {
    const canvas: any = { width: 0, height: 0 }
    let lw = 1
    let ga = 1
    let ss = ''
    let fs = ''
    const context: any = {
      canvas,
      get lineWidth() { return lw },
      set lineWidth(v: number) { lw = v; log.push(`lw:${v.toFixed(4)}`) },
      get globalAlpha() { return ga },
      set globalAlpha(v: number) { ga = v; log.push(`ga:${v.toFixed(4)}`) },
      get strokeStyle() { return ss },
      set strokeStyle(v: string) { ss = v; log.push(`ss:${v}`) },
      get fillStyle() { return fs },
      set fillStyle(v: string) { fs = v; log.push(`fs:${v}`) },
      save: () => log.push('save'), restore: () => log.push('restore'),
      beginPath: () => log.push('begin'), closePath: () => log.push('close'),
      moveTo: (x: number, y: number) => log.push(`m:${x.toFixed(3)},${y.toFixed(3)}`),
      lineTo: (x: number, y: number) => log.push(`l:${x.toFixed(3)},${y.toFixed(3)}`),
      fill: () => log.push('fill'), stroke: () => log.push('stroke'),
      translate: () => log.push('translate'), drawImage: () => log.push('draw'),
      // Opaque pixels: the deposit keep-gate (a < 70/255) must let a
      // tier=final transfer through so the D-07 pin can observe wet writes.
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) }),
      putImageData: () => log.push('put'), clearRect: () => {},
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

function installLcg(): void {
  let seed = LCG_START
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 0x100000000
  })
}

// Forward-declared signature so the RED run can call the contract before any
// signature change lands without failing tsc on excess arguments.
const startContinuation = createPaintStrokeRasterContinuation as unknown as (
  ...args: unknown[]
) => { runToCompletion(): void }

type FootprintTierShape = 'live' | 'final'
interface FootprintParamsShape {
  ctx: CanvasRenderingContext2D
  radius: number
  color: string
  opac: number
  hasPenInput: boolean
  mutationId?: number
  /** Global t-span [t0, t1] of this slice within the whole stroke —
   *  endTaper then dips only at TRUE stroke ends (R7 amended). */
  tSpan?: [number, number]
}

const draw = (paint as unknown as Record<string, unknown>).drawBristleFootprint as unknown as (
  curve: PenPoint[],
  params: FootprintParamsShape,
  tier: FootprintTierShape,
) => void

/** ribbonWithScales with the optional global t-span fifth argument
 *  (forward-declared so the RED run type-checks before the parameter
 *  lands; four-arg behavior is byte-preserved). */
const ribbon5 = ribbonWithScales as unknown as (
  curve: PenPoint[],
  halfWidth: number,
  tPow?: number,
  hasPenInput?: boolean,
  tSpan?: [number, number],
) => { poly: Array<[number, number]>; scales: number[] }

const CONTINUATION_POINTS: PenPoint[] = [
  { x: 5, y: 8, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.2 },
  { x: 14, y: 12, p: 0.6, tx: 0, ty: 0, tw: 0, spd: 0.2 },
  { x: 24, y: 14, p: 0.7, tx: 0, ty: 0, tw: 0, spd: 0.2 },
  { x: 34, y: 18, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.2 },
]

function runRasterLog(mutationId: number | undefined): string[] {
  const width = 48, height = 32
  const log: string[] = []
  vi.stubGlobal('document', { createElement: vi.fn(canvasFactory(log)) })
  const main = canvasFactory(log)()
  const points = CONTINUATION_POINTS
  const opts = { size: 6, opacity: 75, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 60, eraseStrength: 50, antiAlias: 0 } satisfies BrushOpts
  const buffers = wet(width * height)
  installLcg()
  try {
    const continuation = startContinuation(
      points, '#336699', opts, main.getContext('2d'), buffers, null,
      width, height, false, 0.5, 'final', undefined, mutationId,
    )
    continuation.runToCompletion()
  } finally {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
  return log
}

/**
 * Observed continuation run for the stage pin (5) and D-07 gate (6).
 * Fresh-deposit config (pickup 0) so one run has exactly one transfer site;
 * the pickup path's per-segment transfers all happen inside the single
 * tier=final raster (D-07's law is live-writes-nothing, not segment count).
 */
function runRasterObserve(tier: FootprintTierShape): { stages: string[]; buffers: WetBuffers } {
  const width = 48, height = 32
  const stages: string[] = []
  vi.stubGlobal('document', { createElement: vi.fn(canvasFactory([])) })
  const main = canvasFactory([])()
  const opts = { size: 6, opacity: 75, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0 } satisfies BrushOpts
  const buffers = wet(width * height)
  installLcg()
  try {
    const continuation = startContinuation(
      CONTINUATION_POINTS, '#336699', opts, main.getContext('2d'), buffers, null,
      width, height, false, 0.5, tier,
      (stage: string) => { stages.push(stage) }, 7,
    )
    continuation.runToCompletion()
  } finally {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
  return { stages, buffers }
}

/** Straight horizontal stroke — normals are exact verticals, so a vertex's
 *  perpendicular deviation from the mean path is its y deviation. */
function straightCurve(p: number, spd: number, n = 41, spacing = 10): PenPoint[] {
  return Array.from({ length: n }, (_, i) => ({ x: i * spacing, y: 16, p, tx: 0, ty: 0, tw: 0, spd }))
}

/** Tight writing curl: 41 points on a circle of curvature radius rho —
 *  the measured 260929-m2z FAIL condition (live fibre widths up to 8 px,
 *  i.e. w/2 = 4 > rho over curls of rho ~ 3). */
function curlCurve(rho: number, n = 41): PenPoint[] {
  const span = Math.PI * 1.5 // 270 deg arc
  return Array.from({ length: n }, (_, i) => {
    const a = (i / (n - 1)) * span
    return { x: rho * Math.sin(a), y: 20 - rho * Math.cos(a), p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }
  })
}

function bristleRun(
  curve: PenPoint[],
  radius: number,
  mutationId: number,
  hasPenInput = true,
  tier: FootprintTierShape = 'final',
  extra: { tSpan?: [number, number] } = {},
): string[] {
  const log: string[] = []
  const canvas = canvasFactory(log)()
  // LCG over Math.random so any BASE (unseeded) draws are identical across
  // the light/heavy and slow/fast runs of a pin. The GREEN footprint ignores
  // Math.random entirely (source-shape pin).
  installLcg()
  try {
    draw(
      curve,
      { ctx: canvas.getContext('2d'), radius, color: '#336699', opac: 1, hasPenInput, mutationId, ...extra },
      tier,
    )
  } finally {
    vi.restoreAllMocks()
  }
  return log
}

/** Split the op log into per-fibre coverage blocks (save ... restore blocks
 *  that contain at least one fill — R7: coverage IS the fill). */
function bristleBlocks(log: string[]): string[][] {
  const blocks: string[][] = []
  let cur: string[] | null = null
  for (const entry of log) {
    if (entry === 'save') { cur = [entry]; continue }
    if (entry === 'restore' && cur) {
      cur.push(entry)
      if (cur.some((e) => e === 'fill')) blocks.push(cur)
      cur = null
      continue
    }
    if (cur) cur.push(entry)
  }
  return blocks
}

/** Split one coverage block's path into subpaths at each moveTo (R7
 *  capsule sweep: one convex capsule subpath per short step; the base
 *  whole-fibre outline is a single subpath). */
function subpathsOf(block: string[]): Array<Array<[number, number]>> {
  const subs: Array<Array<[number, number]>> = []
  let cur: Array<[number, number]> | null = null
  for (const entry of block) {
    if (entry.startsWith('m:')) {
      if (cur && cur.length) subs.push(cur)
      const [x, y] = entry.slice(2).split(',').map(Number)
      cur = [[x, y]]
    } else if (entry.startsWith('l:')) {
      const [x, y] = entry.slice(2).split(',').map(Number)
      if (cur) cur.push([x, y])
    }
  }
  if (cur && cur.length) subs.push(cur)
  return subs
}

/** Convexity by cross products of consecutive edges (implicit close):
 *  all non-degenerate crosses the same sign, collinear within epsilon. */
function isConvexPolygon(pts: Array<[number, number]>): boolean {
  const n = pts.length
  if (n < 3) return true
  let sign = 0
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % n]
    const [x2, y2] = pts[(i + 2) % n]
    const cross = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
    if (Math.abs(cross) <= 1e-4) continue // collinear within epsilon
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

function valueSeq(block: string[], prefix: string): number[] {
  return block.filter((e) => e.startsWith(prefix)).map((e) => Number(e.slice(prefix.length)))
}

function meanAbsDelta(values: number[]): number {
  if (values.length < 2) return 0
  let sum = 0
  for (let i = 1; i < values.length; i++) sum += Math.abs(values[i] - values[i - 1])
  return sum / (values.length - 1)
}

function meanDistantAbsDelta(values: number[], gap: number): number {
  if (values.length <= gap) return 0
  let sum = 0
  let n = 0
  for (let i = 0; i + gap < values.length; i++) { sum += Math.abs(values[i + gap] - values[i]); n++ }
  return n ? sum / n : 0
}

/** Absolute standard deviation — the pressure SIZE lever changes the
 *  scale of lw, so dispersion must be measured unscaled (52.4-02). */
function stdev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function verticesOf(log: string[]): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const entry of log) {
    if (entry.startsWith('m:') || entry.startsWith('l:')) {
      const [x, y] = entry.slice(2).split(',').map(Number)
      out.push([x, y])
    }
  }
  return out
}

function inkOf(log: string[]): number {
  let lw = 1
  let ga = 1
  let ink = 0
  for (const entry of log) {
    if (entry.startsWith('lw:')) lw = Number(entry.slice(3))
    else if (entry.startsWith('ga:')) ga = Number(entry.slice(3))
    else if (entry.startsWith('l:')) ink += lw * ga
  }
  return ink
}

// ------------------------------------------------------------
// 52.4-02 look-geometry harness — makeLineCurve / extractLanes.
// ------------------------------------------------------------

const LINE_SPACING = 2

/** Dense straight horizontal stroke at y = 16 (length radius x 10 px).
 *  Spacing 2 px keeps mid-stroke extraction (vertex near t = 0.5) stable
 *  and the arc-keyed gauge smooth between consecutive samples. */
function makeLineCurve(radius: number, p: number, spd: number): PenPoint[] {
  const n = Math.round((radius * 10) / LINE_SPACING) + 1
  return Array.from({ length: n }, (_, i) => ({ x: i * LINE_SPACING, y: 16, p, tx: 0, ty: 0, tw: 0, spd }))
}

interface ExtractedLane {
  xMid: number
  yMid: number
  lwMid: number
  /** The block's constant globalAlpha — R7: ONE fill alpha
   *  (STREAK_ALPHA x opac), written once per block. */
  gaMid: number
  /** min / max x over ALL capsule subpaths of the block — the fibre's
   *  longitudinal span (full-curve fibres span the whole stroke). */
  xFirst: number
  xLast: number
}

/**
 * Parse the op log into per-fibre mid-stroke records (R7 capsule-sweep
 * extraction). One save...restore block per fibre (ONE fill per fibre).
 * The block's path is a set of convex capsule subpaths, one per short
 * step, split at each moveTo. Extraction: pick the subpath whose x-span
 * contains the block midpoint (straight pin curves); yMid = (minY+maxY)/2
 * of that subpath (the fibre CENTRE); xMid = its x-span midpoint; lwMid =
 * the ascending lw write at the sample index nearest xMid (one write per
 * sample); gaMid = the block's single alpha; xFirst/xLast = min/max x
 * over ALL subpaths. The base whole-fibre outline parses as a single
 * subpath. Reads op-log strings only — no getImageData (52.4-02).
 */
function extractLanes(log: string[]): ExtractedLane[] {
  const lanes: ExtractedLane[] = []
  let verts: Array<{ x: number; y: number; m: boolean }> | null = null
  let lws: number[] = []
  let ga = Number.NaN
  for (const entry of log) {
    if (entry === 'save') {
      verts = []
      lws = []
      ga = Number.NaN
      continue
    }
    if (entry === 'restore' && verts) {
      const lane = laneFromBlock(verts, lws, ga)
      if (lane) lanes.push(lane)
      verts = null
      continue
    }
    if (!verts) continue
    if (entry.startsWith('lw:')) { lws.push(Number(entry.slice(3))); continue }
    if (entry.startsWith('ga:')) { ga = Number(entry.slice(3)); continue }
    if (entry.startsWith('m:') || entry.startsWith('l:')) {
      const [x, y] = entry.slice(2).split(',').map(Number)
      verts.push({ x, y, m: entry.startsWith('m:') })
    }
  }
  return lanes
}

/** Mid-stroke lane record from one block's vertices (see extractLanes). */
function laneFromBlock(
  verts: Array<{ x: number; y: number; m: boolean }>,
  lws: number[],
  ga: number,
): ExtractedLane | null {
  if (verts.length < 2) return null
  const subs: Array<Array<{ x: number; y: number }>> = []
  let cur: Array<{ x: number; y: number }> | null = null
  for (const v of verts) {
    if (v.m) {
      if (cur && cur.length) subs.push(cur)
      cur = [{ x: v.x, y: v.y }]
    } else if (cur) {
      cur.push({ x: v.x, y: v.y })
    }
  }
  if (cur && cur.length) subs.push(cur)
  if (subs.length === 0) return null

  let xFirst = Number.POSITIVE_INFINITY
  let xLast = Number.NEGATIVE_INFINITY
  for (const s of subs) {
    for (const v of s) {
      if (v.x < xFirst) xFirst = v.x
      if (v.x > xLast) xLast = v.x
    }
  }
  const blockMidX = (xFirst + xLast) / 2

  let pick = subs[0]
  let best = Number.POSITIVE_INFINITY
  for (const s of subs) {
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    for (const v of s) { if (v.x < lo) lo = v.x; if (v.x > hi) hi = v.x }
    if (lo <= blockMidX && hi >= blockMidX) { pick = s; break }
    const d = Math.abs((lo + hi) / 2 - blockMidX)
    if (d < best) { best = d; pick = s }
  }

  let yLo = Number.POSITIVE_INFINITY
  let yHi = Number.NEGATIVE_INFINITY
  let xLo = Number.POSITIVE_INFINITY
  let xHi = Number.NEGATIVE_INFINITY
  for (const v of pick) {
    if (v.y < yLo) yLo = v.y
    if (v.y > yHi) yHi = v.y
    if (v.x < xLo) xLo = v.x
    if (v.x > xHi) xHi = v.x
  }
  const yMid = (yLo + yHi) / 2
  const xMid = (xLo + xHi) / 2
  const idx = Math.min(Math.round(xMid / LINE_SPACING), Math.max(lws.length - 1, 0))
  const lwMid = lws.length > 0 ? lws[idx] : Number.NaN
  return { xMid, yMid, lwMid, gaMid: ga, xFirst, xLast }
}

// ------------------------------------------------------------
// R7-amended coverage contract helpers (260929-t2o).
// ------------------------------------------------------------

/** The ONE whitelisted alpha as a logged string (bristleRun opac = 1).
 *  Number() keeps the RED run honest: the value tracks STREAK_ALPHA
 *  through the co-design. */
function singleAlphaStrings(): Set<string> {
  return new Set([`ga:${Number(STREAK_ALPHA).toFixed(4)}`])
}

/** Numeric alpha whitelist — membership assertions fail on value; only
 *  the single fill constant qualifies. */
function allowedAlphaValues(): number[] {
  return [STREAK_ALPHA]
    .filter((a): a is number => typeof a === 'number' && !Number.isNaN(a))
    .map((a) => Number(a.toFixed(4)))
}

/** Normalized offsets of extracted fibres, deduped at the op-log vertex
 *  rounding (one pass per fibre now — kept as a safety net) then sorted. */
function uniqueSortedOffsets(offsets: number[]): number[] {
  const seen = new Set<string>()
  const out: number[] = []
  for (const o of offsets) {
    const key = o.toFixed(3)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(o)
  }
  return out.sort((a, b) => a - b)
}

/** Worst-case body-band coverage over samples x = -band..band step 0.25
 *  (straight horizontal stroke, lateral center in px = yMid - 16), R7
 *  single-fill-alpha form:
 *  - kBody = count of covering FILLS (every fill is core coverage now —
 *    one transparent coverage action per fibre); the `k_body >= 4` overlap
 *    law;
 *  - composite = 1 - prod(1 - ga_i) over covering fills — the composite
 *    PIN 0 opacity law (user authority: 1-(1-alpha)^k, never a
 *    near-opaque single lane/fill).
 *  When midX is given, only fibres whose longitudinal span covers it are
 *  counted — mid-stroke coverage is the measured site. */
function worstBodyCoverage(
  lanes: { yMid: number; lwMid: number; gaMid: number; xFirst: number; xLast: number }[],
  radius: number,
  midX?: number,
): { minKBody: number; minComposite: number } {
  const covering = midX === undefined
    ? lanes
    : lanes.filter((l) => l.xFirst <= midX && l.xLast >= midX)
  const centers = covering.map((l) => l.yMid - 16)
  const band = BODY_BAND * radius // body band |offset| <= BODY_BAND, scales ~ 1 at mid-stroke
  let minKBody = Number.POSITIVE_INFINITY
  let minComposite = Number.POSITIVE_INFINITY
  for (let x = -band; x <= band + 1e-9; x += 0.25) {
    let kBody = 0
    let prod = 1
    for (let i = 0; i < covering.length; i++) {
      if (Math.abs(x - centers[i]) <= covering[i].lwMid / 2) {
        kBody++
        prod *= 1 - covering[i].gaMid
      }
    }
    if (kBody < minKBody) minKBody = kBody
    const composite = 1 - prod
    if (composite < minComposite) minComposite = composite
  }
  return { minKBody, minComposite }
}

/** Normalized lateral offsets of extracted fibres: (y - 16) / (radius x
 *  scales[idx]). Scales come from ribbonWithScales itself, so the pair is
 *  exact for the GREEN footprint (no wobble). */
function laneOffsets(lanes: ExtractedLane[], curve: PenPoint[], radius: number): number[] {
  const { scales } = ribbonWithScales(curve, radius, 0.8, true)
  return lanes.map((lane) => {
    const idx = Math.min(Math.round(lane.xMid / LINE_SPACING), scales.length - 1)
    return (lane.yMid - 16) / (radius * scales[idx])
  })
}

/** Every lineWidth write in the run, in order. */
function lwSeq(log: string[]): number[] {
  return log.filter((e) => e.startsWith('lw:')).map((e) => Number(e.slice(3)))
}

/** Longitudinal mid of a straight pin curve (the x a fibre must cover to
 *  count toward the mid-stroke body coverage). */
function midXOf(curve: PenPoint[]): number {
  return ((curve.length - 1) * LINE_SPACING) / 2
}

describe('260928-dh1 bristleSeed — seeded deposit-time trace generator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('capsule-sweep coverage (R7 amended): straight pin curve at radii 16/20/32, both tiers — every coverage block is exactly ONE fill + ONE globalAlpha (STREAK_ALPHA x opac) + ONE fillStyle, split into convex capsule subpaths at each moveTo with subpath count = curve.length - 1 (one capsule per short step), no stroked path in the run', () => {
    for (const radius of [16, 20, 32]) {
      const curve = makeLineCurve(radius, 1, 0)
      for (const tier of ['final', 'live'] as const) {
        const log = bristleRun(curve, radius, 7, true, tier)
        const ctx = `radius ${radius} tier ${tier}`

        expect(log.filter((e) => e === 'stroke'), `${ctx} must contain no stroked path`).toHaveLength(0)

        const blocks = bristleBlocks(log)
        expect(blocks.length, `${ctx} must emit coverage blocks`).toBeGreaterThan(0)
        for (const block of blocks) {
          expect(block.filter((e) => e === 'fill'), `${ctx} block fill count (one coverage action per fibre)`).toHaveLength(1)
          const subs = subpathsOf(block)
          expect(subs.length, `${ctx} capsule subpath count = curve.length - 1`).toBe(curve.length - 1)
          subs.forEach((sub, si) => {
            expect(isConvexPolygon(sub), `${ctx} capsule subpath ${si} must be convex (nonzero union is hole-free only for convex same-winding subpaths)`).toBe(true)
          })
        }

        const alphas = new Set(log.filter((e) => e.startsWith('ga:')))
        expect(alphas, `${ctx} distinct globalAlpha`).toEqual(singleAlphaStrings())
        const styles = new Set(log.filter((e) => e.startsWith('fs:')))
        expect(styles, `${ctx} distinct fillStyle`).toEqual(new Set(['fs:#336699']))
      }
    }
  })

  it('no-parcellaire curl (R7 amended): tight-arc curve of curvature radius 3 px at radius 16, tier=live (fibre widths up to 8 px, w/2 >= rho — the measured 260929-m2z FAIL condition) — every block splits into subpaths and EVERY subpath is convex (a self-intersecting whole-fibre outline cancels winding and punches holes)', () => {
    const curve = curlCurve(3)
    const log = bristleRun(curve, 16, 7, true, 'live')
    const blocks = bristleBlocks(log)
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      const subs = subpathsOf(block)
      expect(subs.length).toBeGreaterThan(0)
      subs.forEach((sub, si) => {
        expect(
          isConvexPolygon(sub),
          `curl subpath ${si} must be convex — non-convex means the whole-fibre outline self-intersects (parcellaire: winding cancellation, holes/hollow tube)`,
        ).toBe(true)
      })
    }
  })

  it('continuous field, no family switch (R7): radius 40 at p = 0.15 (locally halfW < 8), radius 40 at p = 1, and radius 3, tier=final — each run emits exactly the shared lane-layout block count (never the 1-3 thin family)', () => {
    for (const [radius, p] of [[40, 0.15], [40, 1], [3, 1]] as const) {
      const curve = makeLineCurve(radius, p, 0)
      if (radius === 40 && p === 0.15) {
        // The locally-thin condition must hold for real (not vacuously):
        // mid-stroke halfW = radius * scales via ribbonWithScales.
        const { scales } = ribbonWithScales(curve, radius, 0.8, true)
        const halfW = radius * scales[Math.floor(curve.length / 2)]
        expect(halfW).toBeLessThan(8)
      }
      const blocks = bristleBlocks(bristleRun(curve, radius, 7, true, 'final'))
      const expected = buildBristleLanes(hashMutationId(7), Math.max(4, Math.floor(radius))).length
      expect(blocks.length, `radius ${radius} p ${p}: block count = shared lane layout, never a family switch`).toBe(expected)
      expect(blocks.length).toBeGreaterThan(3)
    }
  })

  it('tSpan endTaper at true stroke ends (R7 amended): ribbonWithScales fifth-argument global t-span keeps the slice ends at their interior scale (no 0.3 endTaper dip) while the default four-arg call still tapers; the footprint interior slice retains lateral extent >= 0.9 x radius at its end columns; FootprintParams declares tSpan and the pickup call site passes the segment global range', () => {
    // (1) ribbonWithScales global t-span — slice [80, 120] of a 201-point
    // curve is the global range [0.4, 0.6]; sin is symmetric about 0.5, so
    // first and last scales equal the interior scale.
    const full = makeLineCurve(40, 1, 0) // x = 0..400, 201 points
    const SLICE_START = 80
    const SLICE_END = 120
    const slice = full.slice(SLICE_START, SLICE_END + 1) // 41 points, x = 160..240
    const tSpan: [number, number] = [SLICE_START / (full.length - 1), SLICE_END / (full.length - 1)]
    expect(tSpan[0]).toBeCloseTo(0.4, 5)
    expect(tSpan[1]).toBeCloseTo(0.6, 5)

    const n = slice.length
    const endTaperAt = (t: number) => Math.pow(Math.sin(t * Math.PI), 0.8) * 0.7 + 0.3
    const five = ribbon5(slice, 40, 0.8, true, tSpan)
    expect(five.scales[0]).toBeCloseTo(Math.max(0.1, endTaperAt(0.4)), 5)
    expect(five.scales[n - 1]).toBeCloseTo(Math.max(0.1, endTaperAt(0.6)), 5)
    expect(five.scales[0]).toBeCloseTo(five.scales[n - 1], 5)
    expect(five.scales[0], 'tSpan slice ends must not dip to the 0.3 endTaper floor').toBeGreaterThan(0.35)
    expect(five.scales[n - 1], 'tSpan slice ends must not dip to the 0.3 endTaper floor').toBeGreaterThan(0.35)

    const four = ribbon5(slice, 40, 0.8, true)
    expect(four.scales[0], 'default four-arg call still tapers (byte-preserved)').toBeCloseTo(0.3, 5)
    expect(four.scales[n - 1], 'default four-arg call still tapers (byte-preserved)').toBeCloseTo(0.3, 5)

    // (2) footprint interior slice with params.tSpan — vertex columns at
    // the slice's first and last sample x retain lateral extent >= 0.9 x
    // radius; without tSpan the ends collapse toward the 0.3 floor.
    const extentAt = (log: string[], xTarget: number): number => {
      const col = verticesOf(log).filter(([x]) => Math.abs(x - xTarget) < 1e-6)
      expect(col.length, `vertex column at x=${xTarget}`).toBeGreaterThan(0)
      return Math.max(...col.map(([, y]) => Math.abs(y - 16)))
    }
    const withSpan = bristleRun(slice, 40, 7, true, 'final', { tSpan })
    expect(extentAt(withSpan, slice[0].x), 'interior-slice first column keeps lateral extent').toBeGreaterThanOrEqual(0.9 * 40)
    expect(extentAt(withSpan, slice[n - 1].x), 'interior-slice last column keeps lateral extent').toBeGreaterThanOrEqual(0.9 * 40)

    const withoutSpan = bristleRun(slice, 40, 7, true, 'final')
    expect(extentAt(withoutSpan, slice[0].x), 'without tSpan the slice ends collapse toward the 0.3 floor').toBeLessThan(0.5 * 40)

    // (3) source pins: FootprintParams declares tSpan; the pickup call
    // site passes tSpan with the segment's global range.
    const src = readFileSync(new URL('./paint.ts', import.meta.url), 'utf8')
    const ifaceStart = src.indexOf('export interface FootprintParams')
    expect(ifaceStart).toBeGreaterThan(-1)
    const ifaceEnd = src.indexOf('}', ifaceStart)
    expect(src.slice(ifaceStart, ifaceEnd)).toMatch(/\btSpan\b/)
    const segCall = src.indexOf('drawBristleFootprint(seg')
    expect(segCall, 'pickup call site drawBristleFootprint(seg, ...) must exist').toBeGreaterThan(-1)
    expect(src.slice(segCall, segCall + 500), 'pickup call site must pass tSpan').toMatch(/tSpan\s*:/)
  })

  it('rim-width >= 1 px (R7(a)): RIM_WIDTH_MIN >= 1 and RIM_WIDTH_MAX >= RIM_WIDTH_MIN; at p = 1 every emitted final-tier rim-lane width (|offset| > BODY_BAND) is in [1, CORE_MAX_TRACE_WIDTH] with visible variation (stdev > 0)', () => {
    expect(RIM_WIDTH_MIN, 'rim fibres must READ — never sub-pixel').toBeGreaterThanOrEqual(1)
    expect(RIM_WIDTH_MAX).toBeGreaterThanOrEqual(RIM_WIDTH_MIN)

    const radius = 40
    const curve = makeLineCurve(radius, 1, 0)
    const lanes = extractLanes(bristleRun(curve, radius, 7, true, 'final'))
    const offs = laneOffsets(lanes, curve, radius)
    const rimWidths = lanes.filter((_, i) => Math.abs(offs[i]) > BODY_BAND).map((l) => l.lwMid)
    expect(rimWidths.length).toBeGreaterThan(0)
    for (const w of rimWidths) {
      expect(w, `rim width ${w} must be >= 1 px`).toBeGreaterThanOrEqual(1)
      expect(w).toBeLessThanOrEqual(CORE_MAX_TRACE_WIDTH)
    }
    expect(stdev(rimWidths), 'rim widths must vary — contour variation carries the edge texture').toBeGreaterThan(0)
  })

  it('clamp-surviving W(t) (R7(a)): at p = 1, tier=final, radius 32 — raw-block width reads: among the WIDE half of the fibre blocks (the body) some block contains a lw write strictly < CORE_MAX_TRACE_WIDTH and the per-block mean lw varies (stdev > 0) — variation survives the single clamp (whose bound stays 2)', () => {
    expect(CORE_MAX_TRACE_WIDTH).toBe(2)

    // Raw block reads only — no lane-parser dependence. Body identity is
    // the WIDE half of the blocks (D-02: mean body width > mean rim
    // width), so the pin cannot pass vacuously through extraction
    // misclassification of rim widths as body.
    const radius = 32
    const log = bristleRun(makeLineCurve(radius, 1, 0), radius, 7, true, 'final')
    const blocks = bristleBlocks(log)
    expect(blocks.length).toBeGreaterThan(0)
    const stats = blocks.map((b) => {
      const lws = valueSeq(b, 'lw:')
      expect(lws.length).toBeGreaterThan(0)
      return {
        mean: lws.reduce((a, x) => a + x, 0) / lws.length,
        min: Math.min(...lws),
      }
    })
    stats.sort((a, b) => b.mean - a.mean)
    const body = stats.slice(0, Math.floor(stats.length / 2))
    expect(body.length).toBeGreaterThan(0)
    expect(
      body.some((s) => s.min < CORE_MAX_TRACE_WIDTH),
      'some body block must contain a width write strictly below the 2 px clamp — W(t) variation must survive the clamp',
    ).toBe(true)
    expect(
      stdev(body.map((s) => s.mean)),
      'body per-block mean width must vary at p = 1 — the clamp must not flatten W(t)',
    ).toBeGreaterThan(0)
  })

  it('export/tier: drawBristleFootprint is exported as (curve, params, tier) with tier in {live, final} and FootprintParams carrying ctx/radius/color/opac/hasPenInput/mutationId', () => {
    const fp = (paint as unknown as Record<string, unknown>).drawBristleFootprint
    expect(typeof fp).toBe('function')

    const src = readFileSync(new URL('./paint.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/export type FootprintTier\s*=\s*'live'\s*\|\s*'final'/)

    const ifaceStart = src.indexOf('export interface FootprintParams')
    expect(ifaceStart).toBeGreaterThan(-1)
    const ifaceEnd = src.indexOf('}', ifaceStart)
    const iface = src.slice(ifaceStart, ifaceEnd)
    for (const field of ['ctx', 'radius', 'color', 'opac', 'hasPenInput', 'mutationId']) {
      expect(iface).toMatch(new RegExp(`\\b${field}\\b`))
    }

    const fnStart = src.indexOf('export function drawBristleFootprint')
    expect(fnStart).toBeGreaterThan(-1)
    const sigEnd = src.indexOf('):', fnStart)
    expect(sigEnd).toBeGreaterThan(-1)
    const sig = src.slice(fnStart, sigEnd)
    expect(sig).toContain('curve')
    expect(sig).toContain('params')
    expect(sig).toContain('tier')
  })

  it('determinism (ABA): same mutationId byte-identical across an intervening different-id run, different mutationId differs, undefined mutationId replays byte-identical', () => {
    // ABA pattern (52.4-04 R5 hardening): run id 7, then 99, then 7 — the
    // first and third logs must be byte-identical (no module-level
    // seed-state leak survives the intervening different-id run).
    const first = runRasterLog(7)
    const second = runRasterLog(99)
    const third = runRasterLog(7)
    const d = runRasterLog(undefined)
    const e = runRasterLog(undefined)

    expect(third).toEqual(first)
    expect(second).not.toEqual(first)
    expect(e).toEqual(d)
  })

  it('containment: every bristle boundary vertex lies within the local ribbon half-width (ribbonWithScales s x radius, end taper included; capsule caps may bulge at most 1 px tangentially)', () => {
    const radius = 20
    const curve = straightCurve(0.5, 0)
    const { scales } = ribbonWithScales(curve, radius, 0.8, true)
    const vertices = verticesOf(bristleRun(curve, radius, 7))
    expect(vertices.length).toBeGreaterThan(0)

    // Capsule caps (arc approximations) bulge at most half a fibre width
    // = 1 px beyond a sample along the tangent. The LATERAL bound — the
    // actual containment law — is unchanged.
    const capBulgeMax = CORE_MAX_TRACE_WIDTH / 2 + 1e-6

    for (const [vx, vy] of vertices) {
      const contained = curve.some((pt, idx) => {
        // Tangent exactly as drawBristleFootprint / ribbonWithScales compute it
        // (endpoint-aware central difference; tilt is 0 on this curve).
        let tx: number, ty: number
        if (idx === 0) { tx = curve[1].x - curve[0].x; ty = curve[1].y - curve[0].y }
        else if (idx === curve.length - 1) { tx = pt.x - curve[idx - 1].x; ty = pt.y - curve[idx - 1].y }
        else { tx = curve[idx + 1].x - curve[idx - 1].x; ty = curve[idx + 1].y - curve[idx - 1].y }
        const l = Math.hypot(tx, ty) || 1
        const nx = -ty / l
        const ny = tx / l
        const dx = vx - pt.x
        const dy = vy - pt.y
        const tangential = Math.abs(dx * (tx / l) + dy * (ty / l))
        const lateral = Math.abs(dx * nx + dy * ny)
        return tangential <= capBulgeMax && lateral <= radius * scales[idx] + 1e-6
      })
      expect(contained).toBe(true)
    }
  })

  it('shape noise: per-sample width modulation varies along the stroke and grows with pressure; streak alpha is one constant for both pressures', () => {
    const radius = 32
    const lightLog = bristleRun(straightCurve(0.2, 0), radius, 7)
    const heavyLog = bristleRun(straightCurve(0.9, 0), radius, 7)
    const light = bristleBlocks(lightLog)
    const heavy = bristleBlocks(heavyLog)
    expect(light.length).toBeGreaterThan(0)
    expect(heavy.length).toBeGreaterThan(0)
    // R7 continuous field: the BLOCK COUNT is the shared lane layout at
    // both pressures (the field thins through offset x halfW, never a
    // family switch). What must hold at both pressures: one alpha,
    // per-sample width writes, low-frequency gauge, pressure as SIZE lever.

    const gap = 10 // >= 25% of the 400px stroke -> "distant" arc-length pairs
    for (const block of light) {
      const lws = valueSeq(block, 'lw:')
      const ga = valueSeq(block, 'ga:')
      // One width write per curve sample — not constant per fibre.
      expect(lws.length).toBe(41)
      // D-10 / D-11 + R7: ONE constant alpha written once per block —
      // same value at both pressures (no pressure/velocity/arc/noise
      // alpha term), from the single-fill whitelist.
      expect(ga.length).toBe(1)
      expect(allowedAlphaValues()).toContain(ga[0])
    }
    for (const block of heavy) {
      expect(valueSeq(block, 'lw:').length).toBe(41)
      const ga = valueSeq(block, 'ga:')
      expect(ga.length).toBe(1)
      expect(allowedAlphaValues()).toContain(ga[0])
    }
    const lightAlphas = new Set(lightLog.filter((e) => e.startsWith('ga:')))
    const heavyAlphas = new Set(heavyLog.filter((e) => e.startsWith('ga:')))
    expect(lightAlphas).toEqual(singleAlphaStrings())
    expect(heavyAlphas).toEqual(lightAlphas)

    // Low-frequency gauge: within each fibre, the distant arc-length
    // delta dominates the adjacent delta (fibres at p = 0.2 are never
    // floor-clamped: raw >= BODY_WIDTH_MIN x 0.7 x 0.8 > WIDTH_FLOOR —
    // so every light block is eligible).
    const varying = light.filter((b) => meanAbsDelta(valueSeq(b, 'lw:')) > 0)
    expect(varying.length).toBeGreaterThan(0)
    for (const block of light) {
      const lws = valueSeq(block, 'lw:')
      expect(meanDistantAbsDelta(lws, gap)).toBeGreaterThan(meanAbsDelta(lws))
    }
    const flatLight = light.flatMap((b) => valueSeq(b, 'lw:'))
    const flatHeavy = heavy.flatMap((b) => valueSeq(b, 'lw:'))
    // Pressure SIZE lever (52.4-04): mean lw at p=0.9 > mean lw at p=0.2 —
    // pressure scales the width, never the alpha (D-10/D-11).
    const meanLight = flatLight.reduce((a, b) => a + b, 0) / flatLight.length
    const meanHeavy = flatHeavy.reduce((a, b) => a + b, 0) / flatHeavy.length
    expect(meanHeavy).toBeGreaterThan(meanLight)
    expect(stdev(flatHeavy)).toBeGreaterThan(stdev(flatLight))
  })

  it('SIZE-extent law: light(p=0.2)/heavy(p=0.9) RMS lateral excursion over ALL lanes <= 0.35 with one constant streak alpha', () => {
    // RMS lateral excursion |y - 16| / radius over ALL vertices of ALL
    // coverage blocks of each run (bounds never retuned).
    const radius = 32

    const excursion = (p: number): { rms: number; ga: Set<string> } => {
      const log = bristleRun(straightCurve(p, 0), radius, 7)
      const blocks = bristleBlocks(log)
      expect(blocks.length).toBeGreaterThan(0)
      let sumSq = 0
      let n = 0
      for (const block of blocks) {
        const ys = verticesOf(block).map(([, y]) => y)
        expect(ys.length).toBeGreaterThan(0)
        for (const y of ys) { sumSq += (y - 16) ** 2; n++ }
      }
      expect(n).toBeGreaterThan(0)
      return {
        rms: Math.sqrt(sumSq / n) / radius,
        ga: new Set(log.filter((e) => e.startsWith('ga:'))),
      }
    }

    const light = excursion(0.2)
    const heavy = excursion(0.9)
    expect(heavy.rms).toBeGreaterThan(0)
    expect(light.rms / heavy.rms).toBeLessThanOrEqual(0.35)
    // D-10/D-11 + R7: EXACTLY the single fill alpha, identical in
    // both runs — no pressure/velocity/arc/noise alpha term anywhere.
    expect(light.ga).toEqual(singleAlphaStrings())
    expect(heavy.ga).toEqual(singleAlphaStrings())
    expect(light.ga).toEqual(heavy.ga)
  })

  it('pressure SIZE ordering + no velocity term (scope lock): light ink < heavy ink and the heavy-fast op log byte-equals the heavy-slow op log', () => {
    const radius = 20
    const lightLog = bristleRun(straightCurve(0.2, 1), radius, 7)
    const heavyLog = bristleRun(straightCurve(0.9, 1), radius, 7)
    const heavyFastLog = bristleRun(straightCurve(0.9, 60), radius, 7)
    const light = inkOf(lightLog)
    const heavy = inkOf(heavyLog)

    expect(light).toBeGreaterThan(0)
    expect(heavy).toBeGreaterThan(0)
    // Constant per-block ga makes inkOf a width-mass measure — pressure
    // affects SIZE only (D-10/D-11: no pressure alpha term).
    expect(light).toBeLessThan(heavy)
    // Velocity carries no deposit term in tranche 1a: R2 gesture
    // translucency is scope-deferred (row e rides R2 in 53.1+), so an
    // spd-only difference must produce identical footprint output.
    expect(heavyFastLog).toEqual(heavyLog)
  })

  it('source shape: the footprint is seeded geometry-only (ribbonWithScales + hashMutationId) with no paper sampler, 0.72 threshold, non-seeded RNG, skip machinery, removed alpha terms or stroked-path emission', () => {
    const src = readFileSync(new URL('./paint.ts', import.meta.url), 'utf8')
    const start = src.indexOf('export function drawBristleFootprint')
    expect(start).toBeGreaterThan(-1)
    const end = src.indexOf('\nexport function', start + 10)
    const body = src.slice(start, end > -1 ? end : undefined)

    expect(body).toContain('ribbonWithScales')
    expect(body).toContain('hashMutationId')
    // D-14: no paper sampler, no Curtis h > 0.72 cut.
    expect(body).not.toMatch(/\bsampleH\b/)
    expect(body).not.toContain('0.72')
    // No non-seeded RNG / per-pixel reads in the footprint.
    expect(body).not.toContain('Math.random')
    expect(body).not.toContain('gauss(')
    expect(body).not.toContain('getImageData')
    // D-11: no removed alpha terms — nA channel read, pressureMod, channel 1.
    expect(body).not.toMatch(/\bnA\b/)
    expect(body).not.toContain('pressureMod')
    expect(body).not.toMatch(/traceShapeNoise\([^)]*,\s*1\s*\)/)
    // R7: the coverage path has no dashing mechanism and no stroked
    // emission — no skip rate, no under-pass constant, no ctx.stroke.
    expect(body).not.toContain('FOOTPRINT_SKIP_RATE')
    expect(body).not.toContain('SOFT_EDGE_ALPHA')
    expect(body).not.toMatch(/ctx\.stroke\s*\(/)
  })

  it('stage pin: an observed continuation run emits zero paint-raster-layers stages and still reports paint-raster-bristles', () => {
    const { stages } = runRasterObserve('final')
    expect(stages.filter((s) => s === 'paint-raster-layers')).toHaveLength(0)
    expect(stages).toContain('paint-raster-bristles')
  })

  it('D-07 gate: tier=live emits zero wet-transfer stages and leaves wet.alpha untouched; tier=final emits exactly one and mutates wet.alpha', () => {
    const live = runRasterObserve('live')
    expect(live.stages.filter((s) => s === 'paint-wet-transfer-composition')).toHaveLength(0)
    expect(live.buffers.alpha.every((v) => v === 0)).toBe(true)

    const final = runRasterObserve('final')
    expect(final.stages.filter((s) => s === 'paint-wet-transfer-composition')).toHaveLength(1)
    expect(final.buffers.alpha.some((v) => v !== 0)).toBe(true)
  })

  // ------------------------------------------------------------
  // Look-geometry pins (52.4-02, R7-amended structure):
  // capsule-subpath extraction, one block per fibre, mid-span coverage.
  // ------------------------------------------------------------

  it('Poisson placement (D-13, body superseded per user authority): rim adjacent gaps >= POISSON_FILL x spacing, body band k_body >= 4 overlap, non-lattice (max deviation > 0.05), same mutationId identical, different id differs', () => {
    const radius = 40
    const curve = makeLineCurve(radius, 1, 0)
    const lanesA = extractLanes(bristleRun(curve, radius, 7))
    const lanesB = extractLanes(bristleRun(curve, radius, 7))
    const lanesC = extractLanes(bristleRun(curve, radius, 999))
    const offA = uniqueSortedOffsets(laneOffsets(lanesA, curve, radius))
    const offB = uniqueSortedOffsets(laneOffsets(lanesB, curve, radius))
    const offC = uniqueSortedOffsets(laneOffsets(lanesC, curve, radius))
    expect(offA.length).toBeGreaterThanOrEqual(4)

    // Same mutationId reproduces identical offsets; a different id differs.
    expect(offB).toEqual(offA)
    expect(offC).not.toEqual(offA)

    // Rim-region gap floor ONLY (D-13 body-band gap law superseded): every
    // adjacent pair with BOTH offsets outside BODY_BAND keeps the Poisson
    // floor over the unique-lane lattice spacing.
    const spacing = 2 / (offA.length - 1)
    let rimPairs = 0
    for (let i = 1; i < offA.length; i++) {
      const a = offA[i - 1]
      const b = offA[i]
      if (Math.abs(a) > BODY_BAND && Math.abs(b) > BODY_BAND) {
        rimPairs++
        expect(b - a).toBeGreaterThanOrEqual(POISSON_FILL * spacing)
      }
    }
    expect(rimPairs).toBeGreaterThan(0)

    // Body band asserts the overlap law instead of a gap floor: at every
    // body sample at radius 40 (mid-stroke coverage), >= 4 covering fills.
    const { minKBody, minComposite } = worstBodyCoverage(lanesA, radius, midXOf(curve))
    expect(minKBody, `k_body at radius ${radius}`).toBeGreaterThanOrEqual(4)
    expect(minComposite, `composite coverage at radius ${radius}`).toBeGreaterThanOrEqual(0.99)

    // Non-lattice: at least one lane more than 0.05 off the uniform lattice.
    const maxDev = Math.max(...offA.map((o, i) => Math.abs(o - (-1 + i * spacing))))
    expect(maxDev).toBeGreaterThan(0.05)
  })

  it('baked lateral profile (D-02): body/rim lane-count density ratio >= 1.5 and mean body lane width > mean rim lane width', () => {
    const radius = 40
    const curve = makeLineCurve(radius, 1, 0)
    const lanes = extractLanes(bristleRun(curve, radius, 7))
    const offs = laneOffsets(lanes, curve, radius)
    const body = lanes.filter((_, i) => Math.abs(offs[i]) <= BODY_BAND)
    const rim = lanes.filter((_, i) => Math.abs(offs[i]) > BODY_BAND)
    expect(body.length).toBeGreaterThan(0)
    expect(rim.length).toBeGreaterThan(0)

    const densityRatio = (body.length / (2 * BODY_BAND)) / (rim.length / (2 * (1 - BODY_BAND)))
    expect(densityRatio).toBeGreaterThanOrEqual(1.5)

    // Mid-sample lw / pMod(p=1) = lane base width (pMod cancels in the
    // comparison; dividing keeps the mean in px as the D-02 law words it).
    const PMOD_P1 = 1.5 // hasPenInput pMod = 0.5 + p * 1.0 at p = 1
    const meanBody = body.reduce((s, l) => s + l.lwMid / PMOD_P1, 0) / body.length
    const meanRim = rim.reduce((s, l) => s + l.lwMid / PMOD_P1, 0) / rim.length
    expect(meanBody).toBeGreaterThan(meanRim)
  })

  it('width bounds (D-12b R7 single-clamp): CORE_MAX_TRACE_WIDTH = 2 and every final-tier fibre width in [WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH] at p=0.2 and p=1', () => {
    // R7 single-clamp law: one clamp pair — the soft-under ceiling is
    // retired with the under-pass. The visible fibre stays sub-2 px.
    expect(CORE_MAX_TRACE_WIDTH).toBe(2)

    const radius = 32
    const lightLws = lwSeq(bristleRun(makeLineCurve(radius, 0.2, 0), radius, 7))
    expect(lightLws.length).toBeGreaterThan(0)
    expect(Math.min(...lightLws)).toBeGreaterThanOrEqual(WIDTH_FLOOR)
    expect(Math.max(...lightLws)).toBeLessThanOrEqual(CORE_MAX_TRACE_WIDTH)

    const heavyLws = lwSeq(bristleRun(makeLineCurve(radius, 1, 0), radius, 7))
    expect(heavyLws.length).toBeGreaterThan(0)
    expect(Math.min(...heavyLws)).toBeGreaterThanOrEqual(WIDTH_FLOOR)
    expect(Math.max(...heavyLws)).toBeLessThanOrEqual(CORE_MAX_TRACE_WIDTH)
  })

  it('core sub-2 px (D-12b): every fibre lane has lw <= CORE_MAX_TRACE_WIDTH at p=0.2 and p=1 (all coverage is core — there is no second pass)', () => {
    const radius = 32
    for (const p of [0.2, 1]) {
      const lanes = extractLanes(bristleRun(makeLineCurve(radius, p, 0), radius, 7))
      expect(lanes.length).toBeGreaterThan(0)
      for (const lane of lanes) {
        expect(lane.lwMid).toBeGreaterThanOrEqual(WIDTH_FLOOR)
        expect(
          lane.lwMid,
          `fibre lw ${lane.lwMid} (p=${p}) must stay <= CORE_MAX_TRACE_WIDTH`,
        ).toBeLessThanOrEqual(CORE_MAX_TRACE_WIDTH)
      }
    }
  })

  it('low-frequency gauge (D-12a): within each fibre at constant pressure, consecutive lw deltas are <= 10% relative', () => {
    const radius = 32
    const blocks = bristleBlocks(bristleRun(makeLineCurve(radius, 1, 0), radius, 7))
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      const lws = valueSeq(block, 'lw:')
      expect(lws.length).toBeGreaterThanOrEqual(30)
      let maxRel = 0
      for (let i = 1; i < lws.length; i++) {
        const rel = Math.abs(lws[i] - lws[i - 1]) / lws[i - 1]
        if (rel > maxRel) maxRel = rel
      }
      expect(maxRel).toBeLessThanOrEqual(0.1)
    }
  })

  it('single-alpha + uniform base color (R7c/D-09/D-10/D-11): exactly ONE distinct globalAlpha (STREAK_ALPHA x opac) and ONE distinct fillStyle at both tiers — the soft-under silhouette pass is gone', () => {
    const radius = 20
    const curve = makeLineCurve(radius, 1, 0)
    const expectedGa = singleAlphaStrings()
    for (const tier of ['final', 'live'] as const) {
      const log = bristleRun(curve, radius, 7, true, tier)
      const alphas = new Set(log.filter((e) => e.startsWith('ga:')))
      expect(alphas).toEqual(expectedGa)
      const styles = new Set(log.filter((e) => e.startsWith('fs:')))
      expect(styles).toEqual(new Set(['fs:#336699']))
    }
  })

  it('saturation-by-overlap (D-01 rewrite): coverage happens only through transparent fills at the single whitelisted alpha — near-opaque single-fibre fills are structurally impossible and saturation is proven solely by the composite pin', () => {
    const log = bristleRun(makeLineCurve(20, 1, 0), 20, 7)
    // Coverage IS the fill (the old zero-fill / stroke-only law retired).
    const fills = log.filter((e) => e === 'fill')
    expect(fills.length).toBeGreaterThan(0)
    // Only the single whitelisted alpha may deposit anything...
    const alphas = log.filter((e) => e.startsWith('ga:'))
    expect(new Set(alphas)).toEqual(singleAlphaStrings())
    // ...and it can never be near-opaque: the locked [0.4, 0.55] band
    // tops out at 0.55, so a single fibre alone can never saturate —
    // body opacity comes only from overlap (the composite pin below).
    for (const entry of alphas) {
      expect(Number(entry.slice(3))).toBeLessThanOrEqual(0.55)
    }
  })

  it('PIN 0 composite saturation by overlap (D-01/D-02, user authority): body-band covering-fill count k_body >= 4 AND composite 1-prod(1-ga) >= 0.99 at every sample at radii 16 and 32, tier=final', () => {
    for (const radius of [16, 32]) {
      const curve = makeLineCurve(radius, 1, 0)
      const lanes = extractLanes(bristleRun(curve, radius, 7))
      expect(lanes.length).toBeGreaterThan(0)
      const { minKBody, minComposite } = worstBodyCoverage(lanes, radius, midXOf(curve))
      // (a) genuine overlap: >= 4 covering fills EVERY body sample —
      // a single near-opaque fill can never satisfy the pin again.
      expect(minKBody, `k_body at radius ${radius}`).toBeGreaterThanOrEqual(4)
      // (b) composite body opacity under the single fill alpha.
      expect(minComposite, `composite coverage at radius ${radius}`).toBeGreaterThanOrEqual(0.99)
    }
  })

  it('R7b continuity / no-dash: every coverage block performs exactly ONE fill (one coverage action per fibre) and the block count equals the shared lane layout at every pressure — no skip or run-flush fragmentation anywhere', () => {
    for (const p of [0.15, 1]) {
      const radius = 32
      const curve = makeLineCurve(radius, p, 0)
      const log = bristleRun(curve, radius, 7, true, 'final')
      const blocks = bristleBlocks(log)
      const expectedFibres = buildBristleLanes(hashMutationId(7), Math.max(4, Math.floor(radius))).length
      expect(blocks.length, `p=${p}: block count = layout`).toBe(expectedFibres)
      for (const block of blocks) {
        expect(block.filter((e) => e === 'fill')).toHaveLength(1)
      }
    }
  })

  it('radius-3 full field: the shared lane layout (never a 1-3 family), each block exactly one fill at the whitelisted alpha, no interior path fragmentation', () => {
    const radius = 3
    const log = bristleRun(makeLineCurve(radius, 1, 0), radius, 7, true, 'final')

    const alphas = new Set(log.filter((e) => e.startsWith('ga:')))
    expect(alphas).toEqual(singleAlphaStrings())

    const blocks = bristleBlocks(log)
    const expected = buildBristleLanes(hashMutationId(7), Math.max(4, Math.floor(radius))).length
    expect(blocks.length).toBe(expected)
    expect(blocks.length).toBeGreaterThan(3)
    for (const block of blocks) {
      expect(block.filter((e) => e === 'fill')).toHaveLength(1)
      const gaValues = valueSeq(block, 'ga:')
      expect(gaValues.length).toBe(1)
      expect(allowedAlphaValues()).toContain(gaValues[0])
    }
  })

  it('4.1 ink preservation (D-05): live tier draws ceil(N / LIVE_TIER_DIVISOR) fibres (one block per fibre) and its mid-stroke lw sum is within 15% of the final sum', () => {
    const radius = 32
    const curve = makeLineCurve(radius, 1, 0)
    const finalLanes = extractLanes(bristleRun(curve, radius, 7, true, 'final'))
    const liveLanes = extractLanes(bristleRun(curve, radius, 7, true, 'live'))
    const LIVE_TIER_DIVISOR = 4 // mirrors the non-exported paint.ts constant
    // R7 one-block-per-fibre: final = N fibres; live = ceil(N / divisor)
    // selected fibres (the x2 two-pass factor is retired).
    expect(finalLanes.length).toBeGreaterThan(0)
    expect(liveLanes.length).toBe(Math.ceil(finalLanes.length / LIVE_TIER_DIVISOR))

    const finalSum = finalLanes.reduce((s, l) => s + l.lwMid, 0)
    const liveSum = liveLanes.reduce((s, l) => s + l.lwMid, 0)
    const ratio = liveSum / finalSum
    expect(ratio).toBeGreaterThanOrEqual(0.85)
    expect(ratio).toBeLessThanOrEqual(1.15)
  })
})
