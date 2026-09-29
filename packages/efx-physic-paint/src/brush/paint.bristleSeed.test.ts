import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as paint from './paint'
import { createPaintStrokeRasterContinuation } from './paint'
import { ribbonWithScales } from './stroke'
import {
  buildBristleLanes,
  STREAK_ALPHA,
  THIN_HALF_W,
  CORE_MAX_TRACE_WIDTH,
  WIDTH_FLOOR,
  POISSON_FILL,
  BODY_BAND,
} from './footprintLanes'
import { hashMutationId } from '../util/traceSeed'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

// 260929-m2z (R7 rewrite) — fibre coverage contract pins
// (SPECS/real-paint/01-brush-footprint.md R7, USER SPEC ACT 2026-09-29).
// Harness inherited from 52.4-01/02 + 260929-j47 (canvasFactory op-log stub
// + document stub + LCG Math.random + wet() + 4-point PenPoint array); the
// coverage model the pins encode changed from the two-pass stroked-line
// model to the R7 filled-outline model:
//
//   R7 coverage = ONE transparent closed filled outline per fibre. The soft
//   edge is the fill anti-aliasing of that SINGLE fibre boundary (R7c) —
//   there is no wide low-alpha under-pass (its constant is gone from the
//   imports; the honest Number() pattern below makes the pin fail on VALUE
//   if it ever returns), no stroked path anywhere in the coverage run, and
//   exactly ONE globalAlpha (STREAK_ALPHA x opac) + ONE fillStyle.
//   R7 thin regime keys on the LOCAL ribbon half-width halfW (tested
//   against THIN_HALF_W via ribbonWithScales), never on brush radius alone.
//   R7b continuity: every block is one contiguous subpath — exactly one
//   moveTo + one fill, block count = selected fibre count. The seeded skip
//   stream and the >20% run-flush are deleted from the coverage path, so
//   gaps can only come from the charge/deposit model.
//   PIN 0 stays COMPOSITE: k_body = count of covering fills >= 4 AND
//   1-prod(1-ga) >= 0.99 at every body sample at radii 16 and 32 under the
//   single fill alpha (user authority — never a near-opaque single fill).
//
// Behaviors pinned:
//   1. export/tier            — drawBristleFootprint exported, (curve, params,
//                               tier), tier in {live, final}, FootprintParams
//                               carries ctx/radius/color/opac/hasPenInput/mutationId
//   2. determinism            — same mutationId -> identical op logs, different
//                               mutationId -> different, undefined mutationId
//                               (disk replay) -> byte-identical across runs
//   3. containment            — every boundary vertex within the local ribbon
//                               half-width (end taper included; final-tier end
//                               caps may bulge <= 1 px tangentially)
//   4. source shape           — body slice: ribbonWithScales + hashMutationId,
//                               no paper sampler / 0.72 / non-seeded RNG /
//                               removed alpha terms / skip machinery / stroke
//   5. stage pin              — observed run emits ZERO paint-raster-layers
//                               stages (retired with the 37x layering blocks)
//   6. D-07 gate              — tier=live: zero wet-transfer stages, wet.alpha
//                               untouched; tier=final: exactly one, mutates
//   R7 structure              — filled-outline, halfW regime, radius-3 thin
//                               family, R7b continuity, single-alpha,
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
}

const draw = (paint as unknown as Record<string, unknown>).drawBristleFootprint as unknown as (
  curve: PenPoint[],
  params: FootprintParamsShape,
  tier: FootprintTierShape,
) => void

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

function bristleRun(curve: PenPoint[], radius: number, mutationId: number, hasPenInput = true, tier: FootprintTierShape = 'final'): string[] {
  const log: string[] = []
  const canvas = canvasFactory(log)()
  // LCG over Math.random so any BASE (unseeded) draws are identical across
  // the light/heavy and slow/fast runs of a pin. The GREEN footprint ignores
  // Math.random entirely (source-shape pin).
  installLcg()
  try {
    draw(
      curve,
      { ctx: canvas.getContext('2d'), radius, color: '#336699', opac: 1, hasPenInput, mutationId },
      tier,
    )
  } finally {
    vi.restoreAllMocks()
  }
  return log
}

/** Split the op log into per-fibre coverage blocks (save ... restore blocks
 *  that contain at least one fill — R7: coverage IS the fill; the old
 *  stroke-detection flip is retired with the stroked-line model). */
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
  /** First / last paired side-vertex x — the fibre's longitudinal span
   *  (lane-field fibres span the thick region; thin-family fibres span
   *  each locally-thin region). */
  xFirst: number
  xLast: number
}

/**
 * Parse the op log into per-fibre mid-stroke records (R7 filled-outline
 * extraction). One save...restore block per fibre; the block's path is
 * left side (ascending x) -> end-cap polyline -> right side (descending x)
 * -> start-cap polyline -> close. Pairing: split at the first x-decrease
 * (the first right-side vertex), then pair each left vertex with the
 * same-x right vertex — cap vertices sit on non-lattice x beyond the end
 * samples, so they never pair. yMid = mean of the pair = the fibre
 * CENTRE (not a boundary vertex); lwMid = the sample's lineWidth write
 * (one per sample, left pass, in ascending order); gaMid = the block's
 * single alpha. Reads op-log strings only — no getImageData (52.4-02).
 */
function extractLanes(log: string[]): ExtractedLane[] {
  const lanes: ExtractedLane[] = []
  let verts: Array<{ x: number; y: number }> | null = null
  let lws: number[] = []
  let ga = Number.NaN
  let lw = Number.NaN
  for (const entry of log) {
    if (entry === 'save') {
      verts = []
      lws = []
      ga = Number.NaN
      lw = Number.NaN
      continue
    }
    if (entry === 'restore' && verts) {
      const lane = laneFromBlock(verts, lws, ga)
      if (lane) lanes.push(lane)
      verts = null
      continue
    }
    if (!verts) continue
    if (entry.startsWith('lw:')) { lw = Number(entry.slice(3)); lws.push(lw); continue }
    if (entry.startsWith('ga:')) { ga = Number(entry.slice(3)); continue }
    if (entry.startsWith('m:') || entry.startsWith('l:')) {
      const [x, y] = entry.slice(2).split(',').map(Number)
      verts.push({ x, y })
    }
  }
  return lanes
}

/** Pair one block's vertices into the mid-stroke lane record (see
 *  extractLanes). Returns null for non-outline blocks (no x-decrease —
 *  the BASE stroke model's single ascending polyline, or an empty block). */
function laneFromBlock(
  verts: Array<{ x: number; y: number }>,
  lws: number[],
  ga: number,
): ExtractedLane | null {
  if (verts.length < 2) return null
  let r = -1
  for (let i = 1; i < verts.length; i++) {
    if (verts[i].x < verts[i - 1].x - 1e-9) { r = i; break }
  }
  if (r < 0) return null
  const left = verts.slice(0, r)
  const right = verts.slice(r)
  const rightByKey = new Map<string, number>()
  for (const v of right) {
    const key = v.x.toFixed(3)
    if (!rightByKey.has(key)) rightByKey.set(key, v.y)
  }
  const pairs: Array<{ x: number; yc: number }> = []
  for (const v of left) {
    const ry = rightByKey.get(v.x.toFixed(3))
    if (ry !== undefined) pairs.push({ x: v.x, yc: (v.y + ry) / 2 })
  }
  if (pairs.length === 0) return null
  const mid = pairs[Math.floor(pairs.length / 2)]
  // lw writes: one per sample on the left pass, ascending — pair k is
  // sample k (cap vertices pair with nothing, so indices stay aligned).
  const lwMid = lws.length > 0 ? lws[Math.min(Math.floor(pairs.length / 2), lws.length - 1)] : Number.NaN
  return { xMid: mid.x, yMid: mid.yc, lwMid, gaMid: ga, xFirst: pairs[0].x, xLast: pairs[pairs.length - 1].x }
}

// ------------------------------------------------------------
// R7 coverage contract helpers (260929-m2z).
// ------------------------------------------------------------

/** The ONE whitelisted alpha as a logged string (bristleRun opac = 1).
 *  Number() keeps the RED run honest: the value tracks STREAK_ALPHA
 *  through the co-design, and the under-pass constant is no longer in the
 *  imports at all — if it ever reappears in the run it fails on VALUE. */
function singleAlphaStrings(): Set<string> {
  return new Set([`ga:${Number(STREAK_ALPHA).toFixed(4)}`])
}

/** Numeric alpha whitelist — membership assertions fail on value; only
 *  the single fill constant qualifies (the soft-under constant is gone). */
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
 *    one transparent outline per fibre); the `k_body >= 4` overlap law;
 *  - composite = 1 - prod(1 - ga_i) over covering fills — the composite
 *    PIN 0 opacity law (user authority: 1-(1-alpha)^k, never a
 *    near-opaque single lane/fill).
 *  When midX is given, only fibres whose longitudinal span covers it are
 *  counted — thin-family fibres over the end spans of a mixed curve are
 *  not present mid-stroke and must not inflate the count. */
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

  it('filled-outline coverage (R7): straight pin curve at radii 16/20/32, both tiers — every coverage block is exactly one moveTo + one fill (single closed subpath), the run contains no stroked path, exactly ONE globalAlpha (STREAK_ALPHA x opac) and ONE fillStyle', () => {
    for (const radius of [16, 20, 32]) {
      const curve = makeLineCurve(radius, 1, 0)
      for (const tier of ['final', 'live'] as const) {
        const log = bristleRun(curve, radius, 7, true, tier)
        const ctx = `radius ${radius} tier ${tier}`

        // R7c: no stroked path anywhere — coverage is the fill AA of ONE
        // fibre boundary; a stroke (or a wide under-pass) is forbidden.
        expect(log.filter((e) => e === 'stroke'), `${ctx} must contain no stroked path`).toHaveLength(0)

        const blocks = bristleBlocks(log)
        expect(blocks.length, `${ctx} must emit coverage blocks`).toBeGreaterThan(0)
        for (const block of blocks) {
          // Single closed subpath: one moveTo, one fill, no interior breaks.
          expect(block.filter((e) => e === 'fill'), `${ctx} block fill count`).toHaveLength(1)
          expect(block.filter((e) => e.startsWith('m:')), `${ctx} block moveTo count`).toHaveLength(1)
        }

        // Exactly ONE alpha (the under-pass constant is gone from the
        // imports — its logged value would be NaN and fail on value) and
        // ONE fill style.
        const alphas = new Set(log.filter((e) => e.startsWith('ga:')))
        expect(alphas, `${ctx} distinct globalAlpha`).toEqual(singleAlphaStrings())
        const styles = new Set(log.filter((e) => e.startsWith('fs:')))
        expect(styles, `${ctx} distinct fillStyle`).toEqual(new Set(['fs:#336699']))
      }
    }
  })

  it('thin regime keys on local halfW (R7): radius 40 at p = 0.15 computes mid-stroke halfW = radius * scales via ribbonWithScales, asserts halfW < THIN_HALF_W, then the run emits only the 1-3 thin family; radius 40 at p = 1 asserts halfW >= THIN_HALF_W and the full lane family (> 3 blocks)', () => {
    const radius = 40

    // Light pressure: LOCAL half-width decides the regime — compute it
    // first so the pin can never pass vacuously on block counts alone.
    const thinCurve = makeLineCurve(radius, 0.15, 0)
    const { scales: thinScales } = ribbonWithScales(thinCurve, radius, 0.8, true)
    const halfW = radius * thinScales[Math.floor(thinCurve.length / 2)]
    expect(halfW).toBeLessThan(THIN_HALF_W)
    const thinBlocks = bristleBlocks(bristleRun(thinCurve, radius, 7, true, 'final'))
    expect(thinBlocks.length).toBeGreaterThanOrEqual(1)
    expect(thinBlocks.length).toBeLessThanOrEqual(3)

    // Heavy pressure: the same radius is locally thick — full lane family.
    const thickCurve = makeLineCurve(radius, 1, 0)
    const { scales: thickScales } = ribbonWithScales(thickCurve, radius, 0.8, true)
    const halfWThick = radius * thickScales[Math.floor(thickCurve.length / 2)]
    expect(halfWThick).toBeGreaterThanOrEqual(THIN_HALF_W)
    const thickBlocks = bristleBlocks(bristleRun(thickCurve, radius, 7, true, 'final'))
    expect(thickBlocks.length).toBeGreaterThan(3)
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

  it('containment: every bristle boundary vertex lies within the local ribbon half-width (ribbonWithScales s x radius, end taper included; final-tier end caps may bulge at most 1 px tangentially)', () => {
    const radius = 20
    const curve = straightCurve(0.5, 0)
    const { scales } = ribbonWithScales(curve, radius, 0.8, true)
    const vertices = verticesOf(bristleRun(curve, radius, 7))
    expect(vertices.length).toBeGreaterThan(0)

    // Final tier clamps every fibre width to CORE_MAX_TRACE_WIDTH = 2, so
    // the lineTo-only endpoint caps (arc approximations) bulge at most
    // half a fibre width = 1 px beyond the end sample along the tangent.
    // The LATERAL bound — the actual containment law — is unchanged.
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
    // R7 halfW regime: the BLOCK COUNT legitimately differs by pressure
    // (p = 0.2 is locally thin -> thin family; p = 0.9 is thick -> lane
    // field). What must hold at both pressures: one alpha, per-sample
    // width writes, low-frequency gauge, pressure as SIZE lever.

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
    // delta dominates the adjacent delta (thin-family fibres are all
    // body-width at p = 0.2 — never floor-clamped: raw >= BODY_WIDTH_MIN
    // x 0.7 x 0.8 > WIDTH_FLOOR — so every light block is eligible).
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
  // Look-geometry pins (52.4-02, R7-adapted structure):
  // centre-based pairing, one block per fibre, mid-span coverage.
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

  it('R7b continuity / no-dash: every coverage block is one contiguous subpath (exactly one moveTo, one fill) and the block count equals the selected fibre count — no skip or run-flush fragmentation anywhere', () => {
    // Pure-thick lane field (radius 32 at p = 1 is locally thick at every
    // sample): block count must equal the shared lane layout exactly.
    const radius = 32
    const curve = makeLineCurve(radius, 1, 0)
    const log = bristleRun(curve, radius, 7, true, 'final')
    const blocks = bristleBlocks(log)
    const expectedFibres = buildBristleLanes(hashMutationId(7), Math.max(4, Math.floor(radius))).length
    expect(blocks.length).toBe(expectedFibres)
    for (const block of blocks) {
      expect(block.filter((e) => e.startsWith('m:'))).toHaveLength(1)
      expect(block.filter((e) => e === 'fill')).toHaveLength(1)
    }

    // A curve thin everywhere draws only the seeded 1-3 thin family —
    // still one contiguous subpath per fibre, never fragmented.
    const thinBlocks = bristleBlocks(bristleRun(makeLineCurve(radius, 0.15, 0), radius, 7, true, 'final'))
    expect(thinBlocks.length).toBeGreaterThanOrEqual(1)
    expect(thinBlocks.length).toBeLessThanOrEqual(3)
    for (const block of thinBlocks) {
      expect(block.filter((e) => e.startsWith('m:'))).toHaveLength(1)
      expect(block.filter((e) => e === 'fill')).toHaveLength(1)
    }
  })

  it('radius-3 thin family: 1-3 coverage blocks, each exactly one moveTo + one fill at the whitelisted alpha, no interior path breaks', () => {
    const radius = 3
    const log = bristleRun(makeLineCurve(radius, 1, 0), radius, 7, true, 'final')

    const alphas = new Set(log.filter((e) => e.startsWith('ga:')))
    expect(alphas).toEqual(singleAlphaStrings())

    const blocks = bristleBlocks(log)
    expect(blocks.length).toBeGreaterThanOrEqual(1)
    expect(blocks.length).toBeLessThanOrEqual(3)
    for (const block of blocks) {
      expect(block.filter((e) => e.startsWith('m:'))).toHaveLength(1)
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
