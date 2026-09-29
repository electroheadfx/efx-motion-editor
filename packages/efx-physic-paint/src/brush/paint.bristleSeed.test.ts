import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import * as paint from './paint'
import { createPaintStrokeRasterContinuation } from './paint'
import { ribbonWithScales } from './stroke'
import {
  STREAK_ALPHA,
  WIDTH_FLOOR,
  MAX_TRACE_WIDTH,
  POISSON_FILL,
  BODY_BAND,
} from './footprintLanes'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

// 52.4-01 (tracer, retargeted from 260928-dh1) — seeded deposit-time bristle
// footprint pins. Harness mirrored from paint.continuation.test.ts (canvasFactory
// stub + document stub + LCG Math.random + wet() + 4-point PenPoint array), except
// the context records lineWidth / globalAlpha / strokeStyle WRITES with their
// values and vertex coordinates, so the footprint geometry and per-sample shape
// parameters are observable, and getImageData returns alpha-255 pixels so the
// DEPOSIT_KEEP_TIER gate (70/255) lets a tier=final transfer reach the wet
// buffer (D-07 gate test).
//
// Behaviors pinned (PLAN Task 2 <behavior>):
//   1. export/tier            — drawBristleFootprint exported, (curve, params,
//                               tier), tier in {live, final}, FootprintParams
//                               carries ctx/radius/color/opac/hasPenInput/mutationId
//   2. determinism            — same mutationId -> identical op logs, different
//                               mutationId -> different, undefined mutationId
//                               (disk replay) -> byte-identical across runs
//   3. containment            — every vertex within the local ribbon half-width
//                               (end taper included)
//   4. source shape           — body slice: ribbonWithScales + hashMutationId,
//                               no paper sampler / 0.72 / non-seeded RNG /
//                               removed alpha terms (nA / pressureMod / ch-1)
//   5. stage pin              — observed run emits ZERO paint-raster-layers
//                               stages (retired with the 37x layering blocks)
//   6. D-07 gate              — tier=live: zero wet-transfer stages, wet.alpha
//                               untouched; tier=final: exactly one, mutates
//   legacy rewrites           — width-only SIZE modulation + ONE constant
//                               streak alpha; pressure ordering; velocity no
//                               longer changes the deposit; wobble variance
//
// Forward-declared casts (below) let the RED run call the future signatures
// before the implementation exists without failing tsc on excess arguments.

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

// Forward-declared signature: the tier parameter is what Task 2 threads
// through, so the RED run can call it before the implementation exists without
// failing tsc on excess arguments (sampleHFn slot replaced by required tier).
const startContinuation = createPaintStrokeRasterContinuation as unknown as (
  ...args: unknown[]
) => { runToCompletion(): void }

// Future footprint contract, declared locally so the RED test compiles before
// paint.ts exports the real FootprintParams / FootprintTier types.
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
  // LCG over Math.random so any BASE (unseeded) draws are identical across the
  // light/heavy and slow/fast runs of a pin. The GREEN footprint ignores
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

/** Split the op log into per-bristle blocks (save ... restore blocks that
 *  contain at least one stroke — fillFlat blocks never stroke). */
function bristleBlocks(log: string[]): string[][] {
  const blocks: string[][] = []
  let cur: string[] | null = null
  for (const entry of log) {
    if (entry === 'save') { cur = [entry]; continue }
    if (entry === 'restore' && cur) {
      cur.push(entry)
      if (cur.some((e) => e === 'stroke')) blocks.push(cur)
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

function spread(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / mean
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
}

/** Parse the op log into per-lane mid-stroke records: one save...restore
 *  block per lane, stateful walk pairing each vertex with the lw write that
 *  preceded it (skip samples write lw but no vertex; a run-boundary flush
 *  re-emits the shared vertex under the PREVIOUS sample's lw — both stay
 *  correctly paired). Reads op-log strings only — no getImageData, no
 *  pixel reads (52.4-02 acceptance). */
function extractLanes(log: string[]): ExtractedLane[] {
  const lanes: ExtractedLane[] = []
  let cur: Array<{ x: number; y: number; lw: number }> | null = null
  let lw = Number.NaN
  for (const entry of log) {
    if (entry === 'save') {
      cur = []
      lw = Number.NaN
      continue
    }
    if (entry === 'restore' && cur) {
      if (cur.length > 0) {
        const mid = cur[Math.floor(cur.length / 2)]
        lanes.push({ xMid: mid.x, yMid: mid.y, lwMid: mid.lw })
      }
      cur = null
      continue
    }
    if (!cur) continue
    if (entry.startsWith('lw:')) {
      lw = Number(entry.slice(3))
      continue
    }
    if (entry.startsWith('m:') || entry.startsWith('l:')) {
      const [x, y] = entry.slice(2).split(',').map(Number)
      cur.push({ x, y, lw })
    }
  }
  return lanes
}

/** Normalized lateral offsets of extracted lanes: (y - 16) / (radius x
 *  scales[idx]). Scales come from ribbonWithScales itself, so the pair is
 *  exact for the GREEN footprint (no wobble) and recovers the tracer's
 *  base offset within its wobble bound. */
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

describe('260928-dh1 bristleSeed — seeded deposit-time trace generator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

  it('determinism: same mutationId gives byte-identical continuation op logs, different mutationId gives different logs, undefined mutationId replays byte-identical', () => {
    const a = runRasterLog(7)
    const b = runRasterLog(7)
    const c = runRasterLog(99)
    const d = runRasterLog(undefined)
    const e = runRasterLog(undefined)

    expect(b).toEqual(a)
    expect(c).not.toEqual(a)
    expect(e).toEqual(d)
  })

  it('containment: every bristle vertex lies within the local ribbon half-width (ribbonWithScales s x radius, end taper included)', () => {
    const radius = 20
    const curve = straightCurve(0.5, 0)
    const { scales } = ribbonWithScales(curve, radius, 0.8, true)
    const vertices = verticesOf(bristleRun(curve, radius, 7))
    expect(vertices.length).toBeGreaterThan(0)

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
        return tangential < 1e-6 && lateral <= radius * scales[idx] + 1e-6
      })
      expect(contained).toBe(true)
    }
  })

  it('shape noise: per-sample width modulation varies along the stroke and grows with pressure; streak alpha is one constant for both pressures', () => {
    const radius = 20
    const lightLog = bristleRun(straightCurve(0.2, 0), radius, 7)
    const heavyLog = bristleRun(straightCurve(0.9, 0), radius, 7)
    const light = bristleBlocks(lightLog)
    const heavy = bristleBlocks(heavyLog)
    expect(light.length).toBeGreaterThan(0)
    expect(heavy.length).toBe(light.length)

    const gap = 10 // >= 25% of the 400px stroke -> "distant" arc-length pairs
    for (let i = 0; i < light.length; i++) {
      const lwLight = valueSeq(light[i], 'lw:')
      const gaLight = valueSeq(light[i], 'ga:')
      const lwHeavy = valueSeq(heavy[i], 'lw:')
      const gaHeavy = valueSeq(heavy[i], 'ga:')

      // One shape-parameter write per curve sample — not constant per bristle.
      expect(lwLight.length).toBe(41)
      expect(gaLight.length).toBe(41)
      expect(lwHeavy.length).toBe(41)
      expect(gaHeavy.length).toBe(41)

      // Width varies along the stroke: adjacent samples differ, distant
      // samples differ more than adjacent ones (fbm, channel 0).
      expect(meanAbsDelta(lwLight)).toBeGreaterThan(0)
      expect(meanDistantAbsDelta(lwLight, gap)).toBeGreaterThan(meanAbsDelta(lwLight))

      // Amplitude strictly increases with pressure for the same (seed, arc).
      expect(spread(lwHeavy)).toBeGreaterThan(spread(lwLight))

      // D-10 / D-11: ONE constant streak alpha — same value every sample and
      // at both pressures (no pressure/velocity/arc/noise alpha term).
      expect(new Set(gaLight).size).toBe(1)
      expect(new Set(gaHeavy).size).toBe(1)
      expect(gaLight[0]).toBe(gaHeavy[0])
    }
  })

  it('deformation variance: light(p=0.2)/heavy(p=0.9) wobble-excursion ratio of central bristles <= 0.35', () => {
    const radius = 20
    const count = Math.max(4, Math.floor(radius * 0.5))
    // Central bristles by construction: |base offset| = |i/(count-1)*2-1| <= 0.4
    const central = Array.from({ length: count }, (_, i) => i)
      .filter((i) => Math.abs((i / (count - 1)) * 2 - 1) <= 0.4)

    const excursion = (p: number): number => {
      const blocks = bristleBlocks(bristleRun(straightCurve(p, 0), radius, 7))
      let sumSq = 0
      let n = 0
      for (const idx of central) {
        const block = blocks[idx]
        expect(block).toBeTruthy()
        // >= 30: the arc-length skip stream may drop some samples (and a run
        // boundary may re-emit the shared vertex) — duplicate sample positions
        // only, never missing lanes.
        const ys = verticesOf(block).map(([, y]) => y)
        expect(ys.length).toBeGreaterThanOrEqual(30)
        const mean = ys.reduce((a, b) => a + b, 0) / ys.length
        for (const y of ys) { sumSq += (y - mean) ** 2; n++ }
      }
      return Math.sqrt(sumSq / n) / radius
    }

    const light = excursion(0.2)
    const heavy = excursion(0.9)
    expect(heavy).toBeGreaterThan(0)
    expect(light / heavy).toBeLessThanOrEqual(0.35)
  })

  it('pressure/velocity ordering (control): light ink < heavy ink and velocity no longer changes the deposit (heavy-fast ink equals heavy-slow ink)', () => {
    const radius = 20
    const light = inkOf(bristleRun(straightCurve(0.2, 1), radius, 7))
    const heavy = inkOf(bristleRun(straightCurve(0.9, 1), radius, 7))
    const heavyFast = inkOf(bristleRun(straightCurve(0.9, 60), radius, 7))

    expect(light).toBeGreaterThan(0)
    expect(heavy).toBeGreaterThan(0)
    expect(light).toBeLessThan(heavy)
    // D-09/D-10: velocity terms (chanceSkip) are deleted — the seeded layout
    // is keyed by arc-length, so speed cannot change the deposit.
    expect(heavyFast).toBe(heavy)
  })

  it('source shape: the footprint is seeded geometry-only (ribbonWithScales + hashMutationId) with no paper sampler, 0.72 threshold, non-seeded RNG or removed alpha terms', () => {
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
  // 52.4-02 look-geometry pins (RED first — fail against the tracer's
  // uniform lateral offsets + unclamped widths before Task 2 installs
  // buildBristleLanes). Named targets: Poisson (1), profile (2),
  // floor/ceiling (3), saturation (7).
  // ------------------------------------------------------------

  it('Poisson placement (D-13): adjacent normalized gaps >= POISSON_FILL x lattice spacing, non-lattice (max deviation > 0.05), same mutationId identical, different id differs', () => {
    const radius = 40
    const curve = makeLineCurve(radius, 1, 0)
    const offA = laneOffsets(extractLanes(bristleRun(curve, radius, 7)), curve, radius).sort((a, b) => a - b)
    const offB = laneOffsets(extractLanes(bristleRun(curve, radius, 7)), curve, radius).sort((a, b) => a - b)
    const offC = laneOffsets(extractLanes(bristleRun(curve, radius, 999)), curve, radius).sort((a, b) => a - b)
    expect(offA.length).toBeGreaterThanOrEqual(4)

    // Same mutationId reproduces identical offsets; a different id differs.
    expect(offB).toEqual(offA)
    expect(offC).not.toEqual(offA)

    const count = offA.length
    const spacing = 2 / (count - 1)
    for (let i = 1; i < count; i++) {
      expect(offA[i] - offA[i - 1]).toBeGreaterThanOrEqual(POISSON_FILL * spacing)
    }

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

  it('width bounds (D-12b): every final-tier lw lies in [WIDTH_FLOOR, MAX_TRACE_WIDTH] at p=0.2 and at p=1', () => {
    const radius = 20
    const lightLws = lwSeq(bristleRun(makeLineCurve(radius, 0.2, 0), radius, 7))
    expect(lightLws.length).toBeGreaterThan(0)
    expect(Math.min(...lightLws)).toBeGreaterThanOrEqual(WIDTH_FLOOR)

    const heavyLws = lwSeq(bristleRun(makeLineCurve(radius, 1, 0), radius, 7))
    expect(heavyLws.length).toBeGreaterThan(0)
    expect(Math.max(...heavyLws)).toBeLessThanOrEqual(MAX_TRACE_WIDTH)
  })

  it('low-frequency gauge (D-12a): within each lane segment at constant pressure, consecutive lw deltas are <= 10% relative', () => {
    const radius = 20
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

  it('single alpha + uniform base color (D-09/D-10/D-11): exactly one distinct globalAlpha (STREAK_ALPHA x opac) and one distinct strokeStyle at both tiers', () => {
    const radius = 20
    const curve = makeLineCurve(radius, 1, 0)
    const expectedGa = `ga:${(STREAK_ALPHA * 1).toFixed(4)}` // bristleRun opac = 1
    for (const tier of ['final', 'live'] as const) {
      const log = bristleRun(curve, radius, 7, true, tier)
      const alphas = new Set(log.filter((e) => e.startsWith('ga:')))
      expect(alphas).toEqual(new Set([expectedGa]))
      const styles = new Set(log.filter((e) => e.startsWith('ss:')))
      expect(styles).toEqual(new Set(['ss:#336699']))
    }
  })

  it('no fill body (D-01): the direct-draw footprint op log contains zero fill operations — saturation may only come from lane overlap', () => {
    const log = bristleRun(makeLineCurve(20, 1, 0), 20, 7)
    expect(log.filter((e) => e === 'fill')).toHaveLength(0)
  })

  it('PIN 0 saturation by overlap (D-01/D-02): body-band coverage 1-(1-STREAK_ALPHA)^k >= 0.99 at radii 16 and 32, tier=final', () => {
    for (const radius of [16, 32]) {
      const lanes = extractLanes(bristleRun(makeLineCurve(radius, 1, 0), radius, 7))
      expect(lanes.length).toBeGreaterThan(0)
      // Straight horizontal stroke, normal = (0, 1): lateral center in px.
      const centers = lanes.map((l) => l.yMid - 16)
      const band = BODY_BAND * radius // body band |offset| <= BODY_BAND, scales ~ 1 at mid-stroke
      for (let x = -band; x <= band + 1e-9; x += 0.25) {
        let k = 0
        for (let i = 0; i < lanes.length; i++) {
          if (Math.abs(x - centers[i]) <= lanes[i].lwMid / 2) k++
        }
        expect(1 - Math.pow(1 - STREAK_ALPHA, k)).toBeGreaterThanOrEqual(0.99)
      }
    }
  })

  it('4.1 ink preservation (D-05): live tier draws ceil(N / LIVE_TIER_DIVISOR) lanes and its mid-stroke lw sum is within 15% of the final sum', () => {
    const radius = 20
    const curve = makeLineCurve(radius, 1, 0)
    const finalLanes = extractLanes(bristleRun(curve, radius, 7, true, 'final'))
    const liveLanes = extractLanes(bristleRun(curve, radius, 7, true, 'live'))
    const LIVE_TIER_DIVISOR = 4 // mirrors the non-exported paint.ts constant
    expect(liveLanes.length).toBe(Math.ceil(finalLanes.length / LIVE_TIER_DIVISOR))

    const finalSum = finalLanes.reduce((s, l) => s + l.lwMid, 0)
    const liveSum = liveLanes.reduce((s, l) => s + l.lwMid, 0)
    const ratio = liveSum / finalSum
    expect(ratio).toBeGreaterThanOrEqual(0.85)
    expect(ratio).toBeLessThanOrEqual(1.15)
  })
})
