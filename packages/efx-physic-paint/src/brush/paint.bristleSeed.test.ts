import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createPaintStrokeRasterContinuation, drawBristleTraces } from './paint'
import { ribbonWithScales } from './stroke'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

// 260928-dh1 — seeded deposit-time bristle pass pins.
// Harness mirrored from paint.continuation.test.ts (canvasFactory stub +
// document stub + LCG Math.random + wet() + 4-point PenPoint array), except
// the context records lineWidth / globalAlpha / strokeStyle WRITES with their
// values and vertex coordinates, so the bristle geometry and per-sample shape
// parameters are observable.
//
// Behaviors pinned (PLAN Task 2 <behavior>):
//   1. bristleSeed determinism       — same mutationId -> identical op logs,
//                                      different mutationId -> different logs
//   2. containment                   — every vertex within the local ribbon
//                                      half-width (end taper included)
//   3. fbm shape noise               — per-sample width/alpha modulation varies
//                                      along the stroke; amplitude grows with
//                                      pressure (v11 limit #2)
//   4. deformation variance          — light/heavy wobble-excursion ratio
//                                      <= 0.35 (v11 limit #1, base ~0.47)
//   5. pressure/velocity ordering    — control
//   6. source shape                  — no Math.random/gauss in the generator

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
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
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

// Forward-declared signature: the mutationId parameter is what Task 2 threads
// through, so the RED run can call it before the implementation exists without
// failing tsc on excess arguments.
const startContinuation = createPaintStrokeRasterContinuation as unknown as (
  ...args: unknown[]
) => { runToCompletion(): void }

const draw = drawBristleTraces as unknown as (
  ctx: CanvasRenderingContext2D,
  curve: PenPoint[],
  radius: number,
  color: string,
  opac: number,
  penData: PenPoint[],
  hasPenInput: boolean,
  sampleHFn: (x: number, y: number) => number,
  mutationId?: number,
) => void

function runRasterLog(mutationId: number): string[] {
  const width = 48, height = 32
  const log: string[] = []
  vi.stubGlobal('document', { createElement: vi.fn(canvasFactory(log)) })
  const main = canvasFactory(log)()
  const points: PenPoint[] = [
    { x: 5, y: 8, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.2 },
    { x: 14, y: 12, p: 0.6, tx: 0, ty: 0, tw: 0, spd: 0.2 },
    { x: 24, y: 14, p: 0.7, tx: 0, ty: 0, tw: 0, spd: 0.2 },
    { x: 34, y: 18, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.2 },
  ]
  const opts = { size: 6, opacity: 75, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 60, eraseStrength: 50, antiAlias: 0 } satisfies BrushOpts
  const buffers = wet(width * height)
  installLcg()
  const continuation = startContinuation(
    points, '#336699', opts, main.getContext('2d'), buffers, null,
    width, height, false, 0.5, () => 0.5, undefined, mutationId,
  )
  continuation.runToCompletion()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  return log
}

/** Straight horizontal stroke — normals are exact verticals, so a vertex's
 *  perpendicular deviation from the mean path is its y deviation. */
function straightCurve(p: number, spd: number, n = 41, spacing = 10): PenPoint[] {
  return Array.from({ length: n }, (_, i) => ({ x: i * spacing, y: 16, p, tx: 0, ty: 0, tw: 0, spd }))
}

function bristleRun(curve: PenPoint[], radius: number, mutationId: number, hasPenInput = true): string[] {
  const log: string[] = []
  const canvas = canvasFactory(log)()
  // LCG over Math.random so the BASE (unseeded gauss/Math.random) draws are
  // identical across the light/heavy and slow/fast runs of a pin — the plan's
  // "same LCG draws both runs". The GREEN generator ignores Math.random.
  installLcg()
  try {
    draw(canvas.getContext('2d'), curve, radius, '#336699', 1, curve, hasPenInput, () => 0.5, mutationId)
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

describe('260928-dh1 bristleSeed — seeded deposit-time trace generator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('determinism: same mutationId gives byte-identical raster-continuation op logs, different mutationId gives different logs', () => {
    const a = runRasterLog(7)
    const b = runRasterLog(7)
    const c = runRasterLog(99)

    expect(b).toEqual(a)
    expect(c).not.toEqual(a)
  })

  it('containment: every bristle vertex lies within the local ribbon half-width (ribbonWithScales s x radius, end taper included)', () => {
    const radius = 20
    const curve = straightCurve(0.5, 0)
    const { scales } = ribbonWithScales(curve, radius, 0.8, true)
    const vertices = verticesOf(bristleRun(curve, radius, 7))
    expect(vertices.length).toBeGreaterThan(0)

    for (const [vx, vy] of vertices) {
      const contained = curve.some((pt, idx) => {
        // Tangent exactly as drawBristleTraces / ribbonWithScales compute it
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

  it('fbm shape noise: per-sample width/alpha modulation varies along the stroke and its amplitude strictly increases with pressure', () => {
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

      // Adjacent arc-length samples differ.
      expect(meanAbsDelta(lwLight)).toBeGreaterThan(0)
      expect(meanAbsDelta(gaLight)).toBeGreaterThan(0)

      // Distant samples differ more than adjacent ones.
      expect(meanDistantAbsDelta(lwLight, gap)).toBeGreaterThan(meanAbsDelta(lwLight))
      expect(meanDistantAbsDelta(gaLight, gap)).toBeGreaterThan(meanAbsDelta(gaLight))

      // Amplitude strictly increases with pressure for the same (seed, arc).
      expect(spread(lwHeavy)).toBeGreaterThan(spread(lwLight))
      expect(spread(gaHeavy)).toBeGreaterThan(spread(gaLight))
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
        // >= 41: a run boundary may re-emit the shared vertex (moveTo of the
        // next run) — duplicate sample positions only, never extra samples.
        const ys = verticesOf(block).map(([, y]) => y)
        expect(ys.length).toBeGreaterThanOrEqual(41)
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

  it('pressure/velocity ordering (control): light ink < heavy ink and heavy-fast ink < heavy-slow ink', () => {
    const radius = 20
    const light = inkOf(bristleRun(straightCurve(0.2, 1), radius, 7))
    const heavy = inkOf(bristleRun(straightCurve(0.9, 1), radius, 7))
    const heavyFast = inkOf(bristleRun(straightCurve(0.9, 60), radius, 7))

    expect(light).toBeGreaterThan(0)
    expect(heavy).toBeGreaterThan(0)
    expect(light).toBeLessThan(heavy)
    expect(heavyFast).toBeLessThan(heavy)
  })

  it('source shape: the generator is seeded (no Math.random / gauss) and containment reads ribbonWithScales', () => {
    const src = readFileSync(new URL('./paint.ts', import.meta.url), 'utf8')
    const start = src.indexOf('export function drawBristleTraces')
    expect(start).toBeGreaterThan(-1)
    const end = src.indexOf('\nexport function', start + 10)
    const body = src.slice(start, end > -1 ? end : undefined)

    expect(body).not.toContain('Math.random')
    expect(body).not.toContain('gauss(')
    expect(body).toContain('ribbonWithScales')
    expect(body).toContain('hashMutationId')
  })
})
