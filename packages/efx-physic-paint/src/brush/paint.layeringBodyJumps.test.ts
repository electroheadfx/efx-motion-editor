// ============================================================
//  260928-dh1 lever 2 — measure-first pin (NO fix)
//
//  Question: does the 37 x fillFlat layering (paint.ts:440-452,
//  layers = round((22+15)/speedDeplete) = 37 at speedDeplete 1,
//  lAlpha = min(0.08, 3/37) = 0.08, plus round(37*0.2) = 7 soft
//  layers at lAlpha*0.25) manufacture the bodyHardJumps that the
//  four-seam run CONFIRMED at post-raster (heavy-slow 654)?
//
//  Compare on the 260924-pyp analytic substrate (real
//  createPaintStrokeRasterContinuation, Canvas2D AA modelled as
//  coverage source-over — no node-canvas, 260924-pyp law):
//
//    SINGLE        one fillFlat of the fixed ribbon polygon
//    STACKED_SAME  37+7 x fillFlat of that SAME polygon
//                  (isolates pure alpha stacking)
//    STACKED_DEFORM the production schedule, per-layer deformScaled
//                  (the real layering + AA)
//    PRODUCTION    createPaintStrokeRasterContinuation, bristles
//                  dropped (stroke no-op) so the fillFlat schedule
//                  is the only contributor
//
//  If STACKED_DEFORM / PRODUCTION score bodyHardJumps > 0 while
//  SINGLE and STACKED_SAME score 0, the AA layering is proven as
//  the manufacturer BEFORE a line of fix code.
//
//  Constraints the fix will live under (pinned here as comments,
//  not code): wet-layer.ts LOCKED, DEPOSIT_KEEP_TIER untouched,
//  no per-pixel loop in the production stroke raster (260925-dso).
//  ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createPaintStrokeRasterContinuation, fillFlat } from './paint'
import { ribbonWithScales, deformNScaled, deformScaled } from './stroke'
import { curveBounds } from '../util/math'
import { createWetBuffers } from '../core/wet-layer'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'
import { computeDefectMetrics } from '../../../../app/src/components/physic-paint/performance/depositSpeckleCapture'

const CANVAS_W = 256
const CANVAS_H = 96
const MID_Y = 48
const BRUSH_RADIUS = 8
const ENGINE_EDGE_DETAIL = 4
const PROFILE_SEED = 123456789
const MUTATION_ID = 7
const WATER_01 = 0.5
const OPAC = 1
const SPEED_DEPLETE = 1

/** Production layer schedule (paint.ts:440-452) at speedDeplete = 1. */
const LAYERS = Math.round((22 + 15) / SPEED_DEPLETE) // 37
const LALPHA = Math.min(0.08, 3 / LAYERS)            // 0.08
const SOFT_LAYERS = Math.round(LAYERS * 0.2)         // 7

const OUT_DIR = '/tmp/efx-dh1-layering'

// === Analytic Canvas2D (260924-pyp pattern — fill only, stroke no-op) ===

function accumulateOverlap(row: Float32Array, from: number, to: number, w: number): void {
  if (!(to > from)) return
  const a = Math.max(0, from)
  const b = Math.min(w, to)
  if (b <= a) return
  const px0 = Math.floor(a)
  const px1 = Math.ceil(b) - 1
  for (let px = px0; px <= px1; px++) {
    const o = Math.min(b, px + 1) - Math.max(a, px)
    if (o > 0) row[px] += o
  }
}

const SS = 16

function compositePolygon(
  buf: Float32Array,
  poly: Array<[number, number]>,
  bounds: { x0: number; y0: number; w: number; h: number },
  layerAlpha: number,
): void {
  if (poly.length < 3) return
  let yMin = Infinity, yMax = -Infinity
  for (const p of poly) {
    if (p[1] < yMin) yMin = p[1]
    if (p[1] > yMax) yMax = p[1]
  }
  const ly0 = Math.max(0, Math.floor(yMin - bounds.y0))
  const ly1 = Math.min(bounds.h - 1, Math.ceil(yMax - bounds.y0))
  const edges: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    edges.push(a[0], a[1], b[0], b[1])
  }
  const rowCov = new Float32Array(bounds.w)
  for (let ly = ly0; ly <= ly1; ly++) {
    rowCov.fill(0)
    const gy = bounds.y0 + ly
    for (let sy = 0; sy < SS; sy++) {
      const yy = gy + (sy + 0.5) / SS
      const cx: number[] = []
      const cd: number[] = []
      for (let e = 0; e < edges.length; e += 4) {
        const y0 = edges[e + 1], y1 = edges[e + 3]
        let dir = 0
        if (y0 <= yy && yy < y1) dir = 1
        else if (y1 <= yy && yy < y0) dir = -1
        if (dir === 0) continue
        const t = (yy - y0) / (y1 - y0)
        cx.push(edges[e] + t * (edges[e + 2] - edges[e]))
        cd.push(dir)
      }
      if (cx.length === 0) continue
      const order = cx.map((_, i) => i).sort((a, b) => cx[a] - cx[b])
      let winding = 0
      let start = NaN
      for (const idx of order) {
        const prev = winding
        winding += cd[idx]
        if (prev === 0 && winding !== 0) start = cx[idx]
        else if (prev !== 0 && winding === 0) {
          accumulateOverlap(rowCov, start - bounds.x0, cx[idx] - bounds.x0, bounds.w)
        }
      }
    }
    for (let lx = 0; lx < bounds.w; lx++) {
      const c = rowCov[lx] / SS
      if (c <= 0) continue
      const src = c * layerAlpha
      if (src <= 0) continue
      const i = ly * bounds.w + lx
      buf[i] = src + buf[i] * (1 - src)
    }
  }
}

interface RasterCanvas {
  canvas: { width: number; height: number; getContext(kind: string): unknown }
  lastRead: { data: Uint8ClampedArray; width: number; height: number } | null
}

function makeFillCanvas(): RasterCanvas {
  let w = 0
  let h = 0
  let buf = new Float32Array(0)
  const bounds = {
    get x0() { return 0 },
    get y0() { return 0 },
    get w() { return w },
    get h() { return h },
  }
  const state = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt' }
  const stack: Array<typeof state & { tx: number; ty: number }> = []
  let path: Array<[number, number]> = []
  let tx = 0
  let ty = 0
  const out: RasterCanvas = { canvas: null as never, lastRead: null }

  const ctx: Record<string, unknown> = {
    canvas: null as never,
    get globalAlpha() { return state.globalAlpha },
    set globalAlpha(v: number) { state.globalAlpha = v },
    get fillStyle() { return state.fillStyle },
    set fillStyle(v: string) { state.fillStyle = v },
    get strokeStyle() { return state.strokeStyle },
    set strokeStyle(v: string) { state.strokeStyle = v },
    get lineWidth() { return state.lineWidth },
    set lineWidth(v: number) { state.lineWidth = v },
    get lineCap() { return state.lineCap },
    set lineCap(v: string) { state.lineCap = v },
    save() { stack.push({ ...state, tx, ty }) },
    restore() {
      const s = stack.pop()
      if (!s) return
      Object.assign(state, s)
      tx = s.tx
      ty = s.ty
    },
    translate(x: number, y: number) { tx += x; ty += y },
    beginPath() { path = [] },
    moveTo(x: number, y: number) { path.push([x + tx, y + ty]) },
    lineTo(x: number, y: number) { path.push([x + tx, y + ty]) },
    closePath() {},
    fill() { compositePolygon(buf, path, bounds, state.globalAlpha) },
    stroke() { /* bristles dropped — isolate the fillFlat schedule */ },
    getImageData(x: number, y: number, rw: number, rh: number) {
      const data = new Uint8ClampedArray(rw * rh * 4)
      for (let yy = 0; yy < rh; yy++) {
        for (let xx = 0; xx < rw; xx++) {
          const sx = x + xx
          const sy = y + yy
          let a = 0
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) a = buf[sy * w + sx]
          const pi = (yy * rw + xx) * 4
          data[pi] = 255
          data[pi + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255)
        }
      }
      out.lastRead = { data, width: rw, height: rh }
      return { width: rw, height: rh, data }
    },
    putImageData() {},
    drawImage() {},
    clearRect() { buf.fill(0) },
  }

  const canvas = {
    get width() { return w },
    set width(v: number) { w = v; buf = new Float32Array(Math.max(0, w * h)) },
    get height() { return h },
    set height(v: number) { h = v; buf = new Float32Array(Math.max(0, w * h)) },
    getContext: () => ctx,
  }
  ctx.canvas = canvas
  out.canvas = canvas
  return out
}

function alphaPlane(read: { data: Uint8ClampedArray; width: number; height: number }): Uint8Array {
  const a = new Uint8Array(read.width * read.height)
  for (let i = 0; i < a.length; i++) a[i] = read.data[i * 4 + 3]
  return a
}

/** Size the analytic canvas and return a ctx already translated into buf space. */
function beginFill(raster: RasterCanvas, bounds: { x0: number; y0: number; w: number; h: number }) {
  raster.canvas.width = bounds.w
  raster.canvas.height = bounds.h
  const ctx = raster.canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.translate(-bounds.x0, -bounds.y0)
  return ctx
}

/** Force a getImageData readback so metricsOf has a plane to score. */
function readBack(raster: RasterCanvas): void {
  const ctx = raster.canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.getImageData(0, 0, raster.canvas.width, raster.canvas.height)
}

function makeCurve(spacing: number, p: number, spd: number): PenPoint[] {
  const pts: PenPoint[] = []
  for (let x = 32; x <= 224; x += spacing) {
    pts.push({ x, y: MID_Y, p, tx: 0, ty: 0, tw: 0, spd })
  }
  return pts
}

function geometry() {
  const curve = makeCurve(3, 0.9, 0.2)
  const edgeMul = ENGINE_EDGE_DETAIL / 50
  const variance = (1.5 + Math.sqrt(BRUSH_RADIUS) * 0.9) * edgeMul
  const bounds = curveBounds(curve, BRUSH_RADIUS + variance * 5, CANVAS_W, CANVAS_H)
  const { poly: base, scales: baseS } = ribbonWithScales(curve, BRUSH_RADIUS, 0.8, true)
  const { poly: baseD, scales: baseDS } = deformNScaled(base, baseS, 4, variance)
  return { curve, variance, bounds, base, baseD, baseDS }
}

interface Cell {
  label: string
  tornEdge: number
  bodyHardJumps: number
  bodyHfEnergy: number
  isolatedPx: number
  alphaMass: number
}

function metricsOf(label: string, raster: RasterCanvas): Cell {
  const read = raster.lastRead
  if (!read) throw new Error(`no getImageData for ${label}`)
  const m = computeDefectMetrics(alphaPlane(read), read.width, read.height)
  return {
    label,
    tornEdge: m.tornEdge,
    bodyHardJumps: m.bodyHardJumps,
    bodyHfEnergy: m.bodyHfEnergy,
    isolatedPx: m.isolatedPx,
    alphaMass: m.alphaMass,
  }
}

function report(cells: Cell[]): string {
  const lines = ['260928-dh1 lever 2 — 37 x fillFlat layering vs single equivalent fill']
  lines.push(`schedule: ${LAYERS} x lAlpha ${LALPHA.toFixed(3)} + ${SOFT_LAYERS} x ${LALPHA * 0.25}`)
  lines.push(`canvas ${CANVAS_W}x${CANVAS_H}, radius ${BRUSH_RADIUS}, edgeDetail ${ENGINE_EDGE_DETAIL}, stroke = no-op (bristles dropped)`)
  lines.push('')
  for (const c of cells) {
    lines.push(
      `  ${c.label.padEnd(18)} tornEdge=${String(c.tornEdge).padStart(5)}  bodyHardJumps=${String(c.bodyHardJumps).padStart(5)}  bodyHfEnergy=${String(c.bodyHfEnergy).padStart(8)}  isolatedPx=${String(c.isolatedPx).padStart(4)}  alphaMass=${c.alphaMass}`,
    )
  }
  return lines.join('\n')
}

// ============================================================

describe('260928-dh1 lever 2 measure-first — does 37 x fillFlat manufacture bodyHardJumps?', () => {
  it('measures SINGLE vs STACKED_SAME vs STACKED_DEFORM vs PRODUCTION (verdict in the log)', () => {
    const g = geometry()
    const cells: Cell[] = []

    // --- SINGLE: one fillFlat of the fixed deformed ribbon polygon
    {
      const raster = makeFillCanvas()
      const ctx = beginFill(raster, g.bounds)
      fillFlat(ctx, g.baseD, '#103c65', 1)
      readBack(raster)
      cells.push(metricsOf('SINGLE', raster))
    }

    // --- STACKED_SAME: the production schedule on the SAME polygon every
    //     layer. Pure alpha stacking of one AA edge — source-over of a
    //     fixed coverage field is smooth in every pixel.
    {
      const raster = makeFillCanvas()
      const ctx = beginFill(raster, g.bounds)
      const poly = g.baseD
      for (let i = 0; i < LAYERS; i++) fillFlat(ctx, poly, '#103c65', LALPHA)
      for (let i = 0; i < SOFT_LAYERS; i++) fillFlat(ctx, poly, '#103c65', LALPHA * 0.25)
      readBack(raster)
      cells.push(metricsOf('STACKED_SAME', raster))
    }

    // --- STACKED_DEFORM: the production schedule (paint.ts:443-452) with
    //     per-layer deformScaled. This is the claimed manufacturer.
    {
      const raster = makeFillCanvas()
      const ctx = beginFill(raster, g.bounds)
      for (let i = 0; i < LAYERS; i++) {
        const { poly: v } = deformScaled(g.baseD, g.baseDS, g.variance * 0.2)
        fillFlat(ctx, v, '#103c65', LALPHA)
      }
      for (let i = 0; i < SOFT_LAYERS; i++) {
        const { poly: v } = deformScaled(g.baseD, g.baseDS, g.variance * 0.5)
        fillFlat(ctx, v, '#103c65', LALPHA * 0.25)
      }
      readBack(raster)
      cells.push(metricsOf('STACKED_DEFORM', raster))
    }

    // --- PRODUCTION: the real createPaintStrokeRasterContinuation,
    //     bristles dropped (stroke no-op) so the fillFlat schedule is the
    //     only contributor. Captured at transferToWetLayerClipped.getImageData.
    {
      const raster = makeFillCanvas()
      const wetBuffers: WetBuffers = createWetBuffers(CANVAS_W * CANVAS_H)
      const opts: BrushOpts = {
        size: BRUSH_RADIUS,
        opacity: OPAC * 100,
        pressure: 100,
        waterAmount: WATER_01 * 100,
        dryAmount: 30,
        edgeDetail: ENGINE_EDGE_DETAIL,
        pickup: 0,
        eraseStrength: 50,
        antiAlias: 0,
      }
      let seed = PROFILE_SEED
      const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
        seed = (1664525 * seed + 1013904223) >>> 0
        return seed / 0x100000000
      })
      try {
        vi.stubGlobal('document', { createElement: () => raster.canvas })
        createPaintStrokeRasterContinuation(
          g.curve,
          '#103c65',
          opts,
          raster.canvas.getContext('2d') as CanvasRenderingContext2D,
          wetBuffers,
          null,
          CANVAS_W,
          CANVAS_H,
          true,
          WATER_01,
          () => 0.5,
          undefined,
          MUTATION_ID,
        ).runToCompletion()
      } finally {
        spy.mockRestore()
        vi.unstubAllGlobals()
      }
      cells.push(metricsOf('PRODUCTION', raster))
    }

    const text = report(cells)
    const by = new Map(cells.map(c => [c.label, c]))
    const single = by.get('SINGLE')!
    const same = by.get('STACKED_SAME')!
    const deform = by.get('STACKED_DEFORM')!
    const prod = by.get('PRODUCTION')!

    // VERDICT (measurement, not a wish).
    const verdict: string[] = []
    if (deform.bodyHardJumps > single.bodyHardJumps && prod.bodyHardJumps > single.bodyHardJumps) {
      verdict.push('  -> LAYERING MANUFACTURES: 37 x fillFlat scores more bodyHardJumps than a single fill.')
    } else if (deform.bodyHardJumps <= single.bodyHardJumps) {
      verdict.push('  -> REFUTED: the 37 x fillFlat layering does NOT manufacture bodyHardJumps.')
      verdict.push(`     SINGLE already scores ${single.bodyHardJumps}; stacking ${LAYERS}+${SOFT_LAYERS} layers scores ${deform.bodyHardJumps} (production ${prod.bodyHardJumps}).`)
      verdict.push('     The jumps are in the SINGLE fill of the deformN ribbon itself — the AA edge of a')
      verdict.push('     wiggly polygon at ink-floor 4 counts concave AA pockets as interior hard jumps.')
    } else {
      verdict.push('  -> MIXED: see the cell table.')
    }
    if (prod.bodyHardJumps > 0 && prod.bodyHardJumps < single.bodyHardJumps * 4) {
      verdict.push(`  live four-seam post-raster bodyHardJumps was 654 (heavy-slow); analytic PRODUCTION = ${prod.bodyHardJumps}.`)
      verdict.push('  The 260924-pyp analytic AA UNDER-COUNTS real Canvas2D AA — this substrate cannot')
      verdict.push('  reproduce the live 654 and cannot prove a manufacturer that lives in real AA.')
    }
    verdict.push(`  mass is comparable across cells (alphaMass ${single.alphaMass}..${prod.alphaMass}) — the comparison is fair.`)

    console.log(`${text}\n${verdict.join('\n')}`)

    // Substrate sanity only. The verdict above is the deliverable — this pin
    // is MEASURE FIRST and must not encode the hypothesis as a requirement.
    for (const c of cells) {
      expect(c.alphaMass, `${c.label} alphaMass`).toBeGreaterThan(0)
    }
    // Fair comparison: all four cells deposit the same mass (±2%).
    const minMass = Math.min(...cells.map(c => c.alphaMass))
    const maxMass = Math.max(...cells.map(c => c.alphaMass))
    expect(maxMass / minMass, `mass spread ${minMass}..${maxMass}`).toBeLessThan(1.02)
    // isolatedPx is CROSS-CHECK ONLY (it under-counts torn contours) but a
    // non-zero isolated count here would mean the substrate sprays crumbs
    // even on a single fill — that would poison every cell equally.
    expect(single.isolatedPx).toBe(0)
    expect(same.isolatedPx).toBe(0)
  })
})
