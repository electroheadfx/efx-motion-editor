// ============================================================
//  261002-fpi (QUICK 8e) — Blending continuity contract
//
//  The beaded repeating motif at Blending > 0 is the legacy v3.html
//  segment-stamp loop: the curve is sliced into fixed-step segments
//  (step = segLen - floor(segLen * 0.3)) and each segment is stamped
//  as an INDEPENDENT footprint with ONE flat colour taken from the
//  segment midpoint of carriedColors. The `pickupAmt < 0.01` branch is
//  a second rendering family (look-continuity violation).
//
//  This file pins the TARGET invariants (one pipeline, continuous
//  colour, monotone amplitude). RED evidence (commit 2d05b1d6) also
//  carried a characterization block of the legacy split — deleted
//  here together with the segmentation it characterized (Task 2).
//
//  Hard guardrails: no depositRoom / spreadCurveFor / physicsTicks /
//  shape-detail deform changes; this test only OBSERVES the raster
//  through a logging canvas stub — it never writes production code.
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPaintStrokeRasterContinuation } from './paint'
import { resample, smooth } from './stroke'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

// ------------------------------------------------------------
//  Fixed test geometry — a straight horizontal stroke over a
//  mock surface returning a linear RGB ramp (the plan's fixed
//  surface so buildCarriedColors has a real colour to mix).
// ------------------------------------------------------------

const WIDTH = 400
const HEIGHT = 120
const SIZE = 16 // brush radius (opts.size) — resample spacing = max(3, 4) = 4
const AXIS_Y = 60
const PICKER = '#336699'
const PICKER_RGB: [number, number, number] = [51, 102, 153]

const RAW: PenPoint[] = (() => {
  const pts: PenPoint[] = []
  for (let x = 10; x <= 390; x += 4) {
    pts.push({ x, y: AXIS_Y, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 })
  }
  return pts
})()

/** The production curve: smooth(rawPts, 3) then resample at radius * 0.25. */
function makeCurve(): PenPoint[] {
  return resample(smooth(RAW, 3), Math.max(3, SIZE * 0.25))
}

// ------------------------------------------------------------
//  Legacy segment oracle — reproduces the segLen/overlap
//  arithmetic of the legacy rasterize() loop EXACTLY (local
//  copy, not an import: the loop is what this contract deletes).
// ------------------------------------------------------------

interface Segment { start: number; end: number }

function oracleSegments(curveLen: number): { segLen: number; overlap: number; step: number; segs: Segment[] } {
  const segLen = Math.max(8, Math.floor(curveLen / Math.max(1, Math.floor(curveLen / 15))))
  const overlap = Math.floor(segLen * 0.3)
  const step = segLen - overlap
  const segs: Segment[] = []
  for (let start = 0; start < curveLen - 2; start += step) {
    const end = Math.min(start + segLen, curveLen)
    if (end - start < 3) continue // production: seg.length < 3 -> continue
    segs.push({ start, end })
  }
  return { segLen, overlap, step, segs }
}

// ------------------------------------------------------------
//  Logging canvas stub — records fillStyle writes (with the
//  composite active at write time), path geometry, offscreen
//  creation, and transfer-side readbacks.
// ------------------------------------------------------------

type Op =
  | { kind: 'fillStyle'; ctx: number; value: string; composite: string }
  | { kind: 'composite'; ctx: number; value: string }
  | { kind: 'fill'; ctx: number; composite: string }
  | { kind: 'translate'; ctx: number; x: number; y: number }
  | { kind: 'readback'; ctx: number; x: number; y: number }
  | { kind: 'path'; ctx: number; op: 'begin' | 'move' | 'line' | 'close'; x: number; y: number; composite: string }

/** Linear RGB ramp in ABSOLUTE canvas coordinates (r = 30 + x/2 ...). */
function rampData(x0: number, y0: number, w: number, h: number): { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ax = x0 + c
      const i = (r * w + c) * 4
      data[i] = 30 + Math.floor(ax * 0.5)
      data[i + 1] = 40 + Math.floor(ax * 0.3)
      data[i + 2] = 210 - Math.floor(ax * 0.4)
      data[i + 3] = 255
    }
  }
  return { width: w, height: h, data }
}

function makeCanvas(log: Op[], id: number, kind: 'offscreen' | 'main'): HTMLCanvasElement {
  const canvas: any = { width: 0, height: 0 }
  let fillStyle = '#000000'
  let composite = 'source-over'
  const ctx: any = {
    canvas,
    globalAlpha: 1,
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'round',
    get fillStyle() { return fillStyle },
    set fillStyle(v: string) { fillStyle = v; log.push({ kind: 'fillStyle', ctx: id, value: v, composite }) },
    get globalCompositeOperation() { return composite },
    set globalCompositeOperation(v: string) { composite = v; log.push({ kind: 'composite', ctx: id, value: v }) },
    save() {},
    restore() {},
    beginPath() { log.push({ kind: 'path', ctx: id, op: 'begin', x: 0, y: 0, composite }) },
    moveTo(x: number, y: number) { log.push({ kind: 'path', ctx: id, op: 'move', x, y, composite }) },
    lineTo(x: number, y: number) { log.push({ kind: 'path', ctx: id, op: 'line', x, y, composite }) },
    closePath() { log.push({ kind: 'path', ctx: id, op: 'close', x: 0, y: 0, composite }) },
    fill() { log.push({ kind: 'fill', ctx: id, composite }) },
    stroke() {},
    translate(x: number, y: number) { log.push({ kind: 'translate', ctx: id, x, y }) },
    scale() {},
    rotate() {},
    setTransform() {},
    transform() {},
    clearRect() {},
    drawImage() {},
    putImageData() {},
    getImageData(x: number, y: number, w: number, h: number) {
      if (kind === 'offscreen') {
        log.push({ kind: 'readback', ctx: id, x, y })
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }
      }
      return rampData(x, y, w, h)
    },
  }
  canvas.getContext = () => ctx
  return canvas
}

// ------------------------------------------------------------
//  One instrumented run
// ------------------------------------------------------------

interface Shape { offscreen: number; footprint: number; transfer: number }

interface RunResult {
  shape: Shape
  curve: PenPoint[]
  applied: Array<[number, number, number]>
  log: Op[]
  offscreenIds: number[]
}

function run(pickup: number): RunResult {
  const log: Op[] = []
  const offscreenIds: number[] = []
  const main = makeCanvas(log, 0, 'main')
  vi.stubGlobal('document', {
    createElement: () => {
      const id = offscreenIds.length + 1
      offscreenIds.push(id)
      return makeCanvas(log, id, 'offscreen')
    },
  })
  const buffers: WetBuffers = {
    r: new Float32Array(WIDTH * HEIGHT),
    g: new Float32Array(WIDTH * HEIGHT),
    b: new Float32Array(WIDTH * HEIGHT),
    alpha: new Float32Array(WIDTH * HEIGHT),
    wetness: new Float32Array(WIDTH * HEIGHT),
    strokeOpacity: new Float32Array(WIDTH * HEIGHT),
  }
  const opts: BrushOpts = {
    size: SIZE, opacity: 100, pressure: 50, waterAmount: 50, dryAmount: 30,
    edgeDetail: 50, pickup, eraseStrength: 50, antiAlias: 0,
  }
  try {
    const continuation = createPaintStrokeRasterContinuation(
      RAW, PICKER, opts, main.getContext('2d') as CanvasRenderingContext2D, buffers,
      null, WIDTH, HEIGHT, false, 0.5, 'final',
    )
    continuation.runToCompletion()
  } finally {
    vi.unstubAllGlobals()
  }

  const isOff = (ctx: number) => offscreenIds.includes(ctx)
  const shape: Shape = {
    offscreen: offscreenIds.length,
    // A footprint draws its fibre fills under source-over on an offscreen.
    footprint: new Set(
      log.filter(o => o.kind === 'fill' && o.composite === 'source-over' && isOff(o.ctx)).map(o => o.ctx),
    ).size,
    // transferToWetLayerClipped reads its offscreen back exactly once.
    transfer: log.filter(o => o.kind === 'readback' && isOff(o.ctx)).length,
  }
  const curve = makeCurve()
  return { shape, curve, applied: appliedSeries(log, offscreenIds, curve), log, offscreenIds }
}

// ------------------------------------------------------------
//  Applied-colour series — the colour that actually lands on
//  the stroke, expanded per curve sample:
//  - recolour path (source-atop writes): one colour per sample,
//    curve order;
//  - flat path: the footprint colour of each offscreen, expanded
//    per sample (single offscreen = constant; legacy segmented =
//    last-write-wins over the oracle segments).
// ------------------------------------------------------------

function parseColor(v: string): [number, number, number] {
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = v.match(/(\d+)\D+(\d+)\D+(\d+)/)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  throw new Error(`unparseable fillStyle: ${v}`)
}

function appliedSeries(log: Op[], offscreenIds: number[], curve: PenPoint[]): Array<[number, number, number]> {
  const recolour = log.filter(o => o.kind === 'fillStyle' && o.composite === 'source-atop')
  if (recolour.length > 0) {
    if (recolour.length !== curve.length) {
      throw new Error(`recolour writes ${recolour.length} !== curve samples ${curve.length}`)
    }
    return recolour.map(o => parseColor(o.value))
  }
  const perCtx = offscreenIds.map(id => {
    const w = log.find(o => o.kind === 'fillStyle' && o.ctx === id && o.composite === 'source-over')
    if (!w || w.kind !== 'fillStyle') throw new Error(`offscreen ${id} has no footprint fillStyle`)
    return parseColor(w.value)
  })
  if (perCtx.length === 1) return curve.map(() => perCtx[0])
  const { segs } = oracleSegments(curve.length)
  if (segs.length !== perCtx.length) {
    throw new Error(`oracle segment count ${segs.length} !== offscreen count ${perCtx.length}`)
  }
  const applied: Array<[number, number, number]> = new Array(curve.length)
  segs.forEach((s, k) => {
    for (let i = s.start; i < s.end; i++) applied[i] = perCtx[k]
  })
  return applied
}

// ------------------------------------------------------------
//  Statistics — first-difference autocorrelation of the applied
//  colour series. The legacy artifact is a PEAK at exactly the
//  segment-step lag (piecewise-flat segment colours); a
//  continuous series has no such peak (its first difference
//  varies smoothly, so no lag stands out above the others).
// ------------------------------------------------------------

function luminance(c: [number, number, number]): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
}

function firstDiff(series: Array<[number, number, number]>): number[] {
  const d: number[] = []
  for (let i = 1; i < series.length; i++) d.push(luminance(series[i]) - luminance(series[i - 1]))
  return d
}

function autocorrAt(d: number[], lag: number): number {
  const n = d.length
  if (lag <= 0 || lag >= n) return 0
  const mean = d.reduce((a, b) => a + b, 0) / n
  let c0 = 0
  let ck = 0
  for (let i = 0; i < n; i++) {
    const a = d[i] - mean
    c0 += a * a
    if (i + lag < n) ck += a * (d[i + lag] - mean)
  }
  if (c0 < 1e-9) return 0 // constant first difference — perfectly continuous
  return ck / c0
}

/** Peak of the autocorrelation at `lag` above the median over other lags. */
function periodicity(d: number[], lag: number): { rLag: number; medianOthers: number; peakDelta: number } {
  const rLag = autocorrAt(d, lag)
  const maxLag = Math.floor(d.length / 2)
  const others: number[] = []
  for (let k = 2; k <= maxLag; k++) {
    if (Math.abs(k - lag) <= 1) continue // skip the peak's own shoulders
    if (k === 2 * lag || k === 3 * lag) continue // skip harmonic aliases of the period
    others.push(autocorrAt(d, k))
  }
  const sorted = [...others].sort((a, b) => a - b)
  const medianOthers = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
  return { rLag, medianOthers, peakDelta: rLag - medianOthers }
}

function maxJump(d: number[]): number {
  return d.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
}

function meanDeviation(applied: Array<[number, number, number]>): number {
  let s = 0
  for (const c of applied) {
    s += (Math.abs(c[0] - PICKER_RGB[0]) + Math.abs(c[1] - PICKER_RGB[1]) + Math.abs(c[2] - PICKER_RGB[2])) / 3
  }
  return s / applied.length
}

// ------------------------------------------------------------
//  Thresholds pinned in this RED test
// ------------------------------------------------------------

/** Continuous colour: no lag may stand out this far above the others
 *  (RED measured peakDelta=0.513 at the legacy step lag 12). */
const CONTINUOUS_PEAK_MAX = 0.3
/** Continuity: no single-sample colour jump above 12/255 luminance. */
const MAX_SAMPLE_JUMP = 12

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ============================================================
//  TARGET invariants — RED at base (2d05b1d6: legacy periodicity
//  peakDelta=0.513 at step lag 12, shape (8,8,8) at pickup 1,
//  no recolour pass), GREEN on one continuous pipeline.
// ============================================================

describe('261002-fpi target invariants — one continuous pipeline', () => {
  it('ONE PIPELINE: shape is exactly (1,1,1) for pickup in {0, 0.5, 1, 60, 100}', () => {
    for (const pickup of [0, 0.5, 1, 60, 100]) {
      const r = run(pickup)
      expect(
        r.shape,
        `pickup ${pickup}: one offscreen, one footprint, one transfer — never a second rendering family`,
      ).toEqual({ offscreen: 1, footprint: 1, transfer: 1 })
    }
  })

  it('CONTINUOUS COLOUR: at pickup 60 no periodic peak at the legacy step lag and no single-sample jump > 12/255', () => {
    const r = run(60)
    const { step } = oracleSegments(r.curve.length)
    const d = firstDiff(r.applied)
    const { rLag, medianOthers, peakDelta } = periodicity(d, step)
    const jump = maxJump(d)
    console.log(
      `[fpi] TARGET at pickup 60: step=${step} r[lag]=${rLag.toFixed(3)} ` +
      `medianOthers=${medianOthers.toFixed(3)} peakDelta=${peakDelta.toFixed(3)} maxJump=${jump.toFixed(2)}`,
    )
    expect(
      peakDelta,
      `no significant autocorrelation peak at the legacy segment-step lag ${step} ` +
      `(peakDelta=${peakDelta.toFixed(3)} must be < ${CONTINUOUS_PEAK_MAX})`,
    ).toBeLessThan(CONTINUOUS_PEAK_MAX)
    expect(
      jump,
      `no single-sample colour jump above ${MAX_SAMPLE_JUMP}/255 luminance (measured ${jump.toFixed(2)})`,
    ).toBeLessThanOrEqual(MAX_SAMPLE_JUMP)
  })

  it('RECOLOUR-ORDER + PATCH COVERAGE: the carried-colour pass runs after the footprint and before the transfer, and each per-sample patch covers the footprint lateral reach at that sample', () => {
    const r = run(60)
    const { log, offscreenIds, curve } = r
    const isOff = (ctx: number) => offscreenIds.includes(ctx)
    let lastFootprintFill = -1
    let firstRecolour = -1
    let firstTransfer = -1
    log.forEach((o, idx) => {
      if (o.kind === 'fill' && o.composite === 'source-over' && isOff(o.ctx)) lastFootprintFill = idx
      if (firstRecolour === -1 && o.kind === 'fillStyle' && o.composite === 'source-atop') firstRecolour = idx
      if (firstTransfer === -1 && o.kind === 'readback' && isOff(o.ctx)) firstTransfer = idx
    })

    expect(firstRecolour, 'a carried-colour (source-atop) recolour pass must exist at pickup > 0').toBeGreaterThan(-1)
    expect(lastFootprintFill, 'the recolour must run AFTER the footprint is drawn').toBeGreaterThan(-1)
    expect(firstRecolour, 'recolour fillStyle writes must come after the footprint fills').toBeGreaterThan(lastFootprintFill)
    expect(firstTransfer, 'the recolour must run BEFORE transferToWetLayerClipped reads the offscreen').toBeGreaterThan(firstRecolour)

    // Footprint lateral reach per sample (path vertices, source-over).
    const fpReach = new Array<number>(curve.length).fill(0)
    for (const o of log) {
      if (o.kind !== 'path' || (o.op !== 'move' && o.op !== 'line')) continue
      if (o.composite !== 'source-over' || !isOff(o.ctx)) continue
      let best = -1
      let bd = Infinity
      for (let i = 0; i < curve.length; i++) {
        const dx = Math.abs(o.x - curve[i].x)
        if (dx < bd) { bd = dx; best = i }
      }
      if (bd > 2) continue // cap vertices between samples
      fpReach[best] = Math.max(fpReach[best], Math.abs(o.y - AXIS_Y))
    }

    // Recolour patch reach per sample: group path points between
    // source-atop fills (one patch = one fill), centre = mean of
    // the patch points, reach = max distance from the centre.
    const rcReach = new Array<number>(curve.length).fill(0)
    let group: Array<{ x: number; y: number }> = []
    const flushGroup = (): void => {
      if (group.length > 0) {
        const cx = group.reduce((a, p) => a + p.x, 0) / group.length
        const cy = group.reduce((a, p) => a + p.y, 0) / group.length
        let radius = 0
        for (const p of group) radius = Math.max(radius, Math.hypot(p.x - cx, p.y - cy))
        let best = -1
        let bd = Infinity
        for (let i = 0; i < curve.length; i++) {
          const dx = Math.abs(cx - curve[i].x)
          if (dx < bd) { bd = dx; best = i }
        }
        rcReach[best] = Math.max(rcReach[best], radius)
      }
      group = []
    }
    for (const o of log) {
      if (o.kind === 'fill') {
        if (o.composite === 'source-atop') flushGroup()
        continue
      }
      if (o.kind === 'path' && o.composite === 'source-atop' && (o.op === 'move' || o.op === 'line')) {
        group.push({ x: o.x, y: o.y })
      }
    }
    flushGroup()

    let covered = 0
    for (let i = 0; i < curve.length; i++) {
      if (fpReach[i] <= 0) continue
      covered++
      expect(
        rcReach[i],
        `sample ${i} (x=${curve[i].x}): recolour patch reach ${rcReach[i].toFixed(2)} must cover ` +
        `the footprint lateral reach ${fpReach[i].toFixed(2)} — under-coverage leaves ` +
        'picker-coloured streaks inside the stroke',
      ).toBeGreaterThanOrEqual(fpReach[i])
    }
    expect(covered, 'the footprint must have produced lateral geometry at some samples').toBeGreaterThan(0)
  })

  it('MONOTONE AMPLITUDE: deviation from the pure picker grows strictly with pickup {0,25,50,75,100}; pickup 0 applies the pure picker at every sample', () => {
    const pickups = [0, 25, 50, 75, 100]
    const devs: number[] = []
    let zero: RunResult | null = null
    for (const pickup of pickups) {
      const r = run(pickup)
      if (pickup === 0) zero = r
      devs.push(meanDeviation(r.applied))
    }
    expect(zero).not.toBeNull()
    for (let i = 0; i < zero!.applied.length; i++) {
      expect(
        zero!.applied[i],
        `pickup 0 sample ${i} must be the pure picker colour (constant-colour input, same pipeline)`,
      ).toEqual(PICKER_RGB)
    }
    console.log(`[fpi] deviation by pickup: ${pickups.map((p, i) => `${p}=${devs[i].toFixed(3)}`).join(' ')}`)
    for (let i = 1; i < devs.length; i++) {
      expect(
        devs[i],
        `deviation must grow strictly with pickup: ${pickups[i - 1]}=${devs[i - 1].toFixed(3)} -> ` +
        `${pickups[i]}=${devs[i].toFixed(3)}`,
      ).toBeGreaterThan(devs[i - 1])
    }
  })
})
