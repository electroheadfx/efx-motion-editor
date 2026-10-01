/**
 * 260928-dh1 — deposit keep-gate field diagnosis (measure-first, NO fix).
 *
 * Question (user-mandated, before any new deposit code):
 *   Is the pixel speckle manufactured by transferToWetLayerClipped's
 *   include/exclude cut (`if (a < DEPOSIT_KEEP_TIER) continue`,
 *   wet-layer.ts:447), or is the rasterized alpha field already speckled
 *   BEFORE that cut?
 *
 *   - smooth BEFORE / speckled AFTER  -> the gate manufactures the speckle.
 *     Lever is the tier, or a field that never straddles the tier.
 *     (A continuous-modulation gate is FORBIDDEN — 260924-m7w. The field
 *     itself must stop straddling the threshold.)
 *   - speckled BEFORE                 -> source is upstream: layered low-alpha
 *     polygon fill, deformN, and/or the bristle pass.
 *
 * Extends the 260924-pyp production-AA substrate (productionAaSettleMeasurement
 * .test.ts): real ribbonWithScales / deformNScaled / deformScaled geometry and
 * the real production layer schedule, with ONLY the Canvas2D rasterizer replaced
 * (analytic coverage — real Canvas2D is unavailable headless, no installs).
 * 260924-pyp EXCLUDED bristles; this harness INCLUDES them, because the
 * 0.015–0.06 alpha trace field is the suspected threshold-straddling source.
 *
 * The entry point is the REAL createPaintStrokeRasterContinuation, called with
 * the engine's own argument convention (EfxPaintEngine.stepInteractivePaint
 * Finalization: opts.size is already brushRenderRadius, waterAmount is /100).
 * The real transferToWetLayerClipped applies the real `a < DEPOSIT_KEEP_TIER` cut.
 * wet-layer.ts is NOT edited. The BEFORE field is the exact `offData` that
 * function reads (captured at its getImageData call). The AFTER keep-field is
 * `a >= 70` on those same bytes — the gate is a pure threshold.
 *
 * Control: the same run with ctx.stroke() a no-op (bristles draw nothing) isolates
 * the bristle contribution. "manufactured" = pixels kept only because bristles
 * pushed them across the tier.
 *
 * Threat T-dh1-SC: no package installs (no node-canvas/skia-canvas) — 260924-pyp law.
 */

import { describe, expect, it, vi } from 'vitest'
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createPaintStrokeRasterContinuation } from '../brush/paint'
import { curveBounds } from '../util/math'
import { createWetBuffers, DEPOSIT_KEEP_TIER } from './wet-layer'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

// === Substrate constants (mirrored from the dh1 capture harness + EfxPaintEngine) ===
const CANVAS_W = 256
const CANVAS_H = 96
const MID_Y = 48
/** dh1 harness setBrushSize(16) -> brushRenderRadius = max(0.5, 16/2) = 8 */
const BRUSH_RADIUS = 8
/** dh1 harness setEdgeDetail(4) -> edgeMul = 4/50 (EfxPaintEngine passes it through) */
const ENGINE_EDGE_DETAIL = 4
/** LCG seed — paint.continuation / productionAaSettleMeasurement precedent */
const PROFILE_SEED = 123456789
const MUTATION_ID = 7
/** dh1 harness setWaterAmount(50); the engine passes opts.waterAmount / 100 */
const WATER_01 = 0.5
/** dh1 harness setBrushOpacity(100) -> opac = 1 */
const OPAC = 1

/**
 * The gate under diagnosis. Mirrored here ONLY to derive the binary keep-field
 * from the captured BEFORE bytes — never written into wet-layer.ts. The real
 * transferToWetLayerClipped applies its own copy of this threshold.
 */
const GATE_TIER = DEPOSIT_KEEP_TIER

const OUT_DIR = '/tmp/efx-dh1-gate'

// === Analytic Canvas2D substitute (260924-pyp pattern) ===
// fill  -> nonzero-winding scanline coverage (exact x-span, 16 y sub-samples)
// stroke-> capsule signed-distance coverage, kernel width-normalised so a long
//          stroke's total added alpha = lineWidth * globalAlpha (sub-pixel lines
//          stay conservative rather than over-claiming).

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

function distToSegment(px: number, py: number, a: [number, number], b: [number, number]): number {
  const vx = b[0] - a[0], vy = b[1] - a[1]
  const wx = px - a[0], wy = py - a[1]
  const len2 = vx * vx + vy * vy
  const t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0
  const dx = wx - t * vx, dy = wy - t * vy
  return Math.hypot(dx, dy)
}

/** Width-normalised capsule AA: kernel integrates to lineWidth across the normal. */
function stampCapsule(
  buf: Float32Array,
  p0: [number, number],
  p1: [number, number],
  r: number,
  alpha: number,
  bounds: { x0: number; y0: number; w: number; h: number },
): void {
  const norm = (2 * r) / (2 * r + 1)
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0]) - r - 1 - bounds.x0))
  const maxX = Math.min(bounds.w - 1, Math.ceil(Math.max(p0[0], p1[0]) + r + 1 - bounds.x0))
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1]) - r - 1 - bounds.y0))
  const maxY = Math.min(bounds.h - 1, Math.ceil(Math.max(p0[1], p1[1]) + r + 1 - bounds.y0))
  for (let ly = minY; ly <= maxY; ly++) {
    for (let lx = minX; lx <= maxX; lx++) {
      const px = bounds.x0 + lx + 0.5
      const py = bounds.y0 + ly + 0.5
      const d = distToSegment(px, py, p0, p1)
      const cov = Math.min(1, Math.max(0, r + 0.5 - d)) * norm
      if (cov <= 0) continue
      const src = cov * alpha
      const i = ly * bounds.w + lx
      buf[i] = src + buf[i] * (1 - src)
    }
  }
}

function strokePolyline(
  buf: Float32Array,
  path: Array<[number, number]>,
  lineWidth: number,
  alpha: number,
  bounds: { x0: number; y0: number; w: number; h: number },
): void {
  if (path.length === 0 || alpha <= 0 || lineWidth <= 0) return
  const r = Math.max(0.05, lineWidth / 2)
  if (path.length === 1) {
    stampCapsule(buf, path[0], path[0], r, alpha, bounds)
    return
  }
  for (let i = 0; i < path.length - 1; i++) {
    stampCapsule(buf, path[i], path[i + 1], r, alpha, bounds)
  }
}

interface RasterCanvas {
  canvas: { width: number; height: number; getContext(kind: string): unknown }
  /** last getImageData payload — the exact bytes transferToWetLayerClipped gates on */
  lastRead: { data: Uint8ClampedArray; width: number; height: number } | null
}

/**
 * Minimal Canvas2D that actually accumulates coverage into a float alpha plane.
 * `dropStrokes` is the control switch: bristle runs call ctx.stroke(), so a no-op
 * stroke() removes the bristle contribution with zero other changes.
 */
function makeRasterCanvas(dropStrokes: boolean): RasterCanvas {
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
    closePath() { /* compositePolygon closes implicitly */ },
    fill() { compositePolygon(buf, path, bounds, state.globalAlpha) },
    stroke() {
      if (dropStrokes) return
      strokePolyline(buf, path, state.lineWidth, state.globalAlpha, bounds)
    },
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
    putImageData() { /* transfer writes wet buffers, not back to oc */ },
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

// === Speckle metrics (dh1 capture definitions) ===

function isolatedPxContinuous(alpha: Uint8Array | Uint8ClampedArray, w: number, h: number): number {
  let n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = alpha[y * w + x]
      if (a < 4) continue
      const need = a * 0.5
      let peer = false
      for (let dy = -1; dy <= 1 && !peer; dy++) {
        for (let dx = -1; dx <= 1 && !peer; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          if (alpha[ny * w + nx] >= need) peer = true
        }
      }
      if (!peer) n++
    }
  }
  return n
}

function isolatedPxBinary(keep: Uint8Array, w: number, h: number): number {
  let n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!keep[y * w + x]) continue
      let peer = false
      for (let dy = -1; dy <= 1 && !peer; dy++) {
        for (let dx = -1; dx <= 1 && !peer; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          if (keep[ny * w + nx]) peer = true
        }
      }
      if (!peer) n++
    }
  }
  return n
}

function histogram(alpha: Uint8ClampedArray): number[] {
  const bins = new Array<number>(256).fill(0)
  for (let i = 0; i < alpha.length; i++) bins[alpha[i]]++
  return bins
}

function bandCount(alpha: Uint8ClampedArray, lo: number, hi: number): number {
  let n = 0
  for (let i = 0; i < alpha.length; i++) if (alpha[i] >= lo && alpha[i] <= hi) n++
  return n
}

// === PNG dump (grayscale, node:zlib — no canvas, no installs) ===

let crcTable: Uint32Array | null = null
function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function writeGrayPng(path: string, w: number, h: number, gray: Uint8Array): void {
  const raw = Buffer.alloc((w + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = gray[y * w + x]
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 0
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(path, png)
}

// === Production-path runner ===

function makeCurve(spacing: number, p: number, spd: number): PenPoint[] {
  const pts: PenPoint[] = []
  for (let x = 32; x <= 224; x += spacing) {
    pts.push({ x, y: MID_Y, p, tx: 0, ty: 0, tw: 0, spd })
  }
  return pts
}

interface GateDump {
  label: string
  width: number
  height: number
  bounds: { x0: number; y0: number; w: number; h: number }
  /** exact offData alpha bytes transferToWetLayerClipped gates on */
  before: Uint8ClampedArray
  /** binary keep-field: before[i] >= GATE_TIER */
  keep: Uint8Array
  isolatedBefore: number
  isolatedAfter: number
  hist: number[]
  bandLow: number
  bandStraddle: number
  bandHigh: number
  totalPx: number
  keptPx: number
  /** 0 = wetBuffers.alpha agrees with `keep` on every pixel */
  crossCheckMismatch: number
}

function runGateDump(label: string, p: number, spd: number, dropStrokes: boolean): GateDump {
  const curve = makeCurve(3, p, spd)
  const hasPenInput = true
  const edgeMul = ENGINE_EDGE_DETAIL / 50
  const variance = (1.5 + Math.sqrt(BRUSH_RADIUS) * 0.9) * edgeMul
  const bounds = curveBounds(curve, BRUSH_RADIUS + variance * 5, CANVAS_W, CANVAS_H)

  const raster = makeRasterCanvas(dropStrokes)
  const wetBuffers: WetBuffers = createWetBuffers(CANVAS_W * CANVAS_H)

  // Engine convention (EfxPaintEngine.stepInteractivePaintFinalization):
  //   renderOpts = { ...opts, size: brushRenderRadius(opts) }  -> size IS the radius
  //   waterAmount passed to paint is opts.waterAmount / 100
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
    // paint.ts creates its own offscreen via document.createElement('canvas') —
    // return the accumulating raster so drawBristleFootprint /
    // transferToWetLayerClipped all run as real production code over it.
    // 52.4-01: the sampleHFn slot is now the required tier — 'final' is
    // the deposit this diagnosis measures (the full-N wet transfer).
    vi.stubGlobal('document', { createElement: () => raster.canvas })
    createPaintStrokeRasterContinuation(
      curve,
      '#103c65',
      opts,
      raster.canvas.getContext('2d') as CanvasRenderingContext2D,
      wetBuffers,
      null,
      CANVAS_W,
      CANVAS_H,
      hasPenInput,
      WATER_01,
      'final',
      undefined,
      MUTATION_ID,
    ).runToCompletion()
  } finally {
    spy.mockRestore()
    vi.unstubAllGlobals()
  }

  const read = raster.lastRead
  if (!read) throw new Error(`dh1 gate dump: no getImageData captured for ${label}`)
  const w = read.width
  const h = read.height
  const before = new Uint8ClampedArray(w * h)
  for (let i = 0; i < w * h; i++) before[i] = read.data[i * 4 + 3]

  const keep = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) keep[i] = before[i] >= GATE_TIER ? 1 : 0

  // Cross-check: the REAL transfer deposits exactly the kept pixels (paperHeight
  // is null, so the D-08 adsorption branch cannot zero anything out).
  let crossCheckMismatch = 0
  for (let ly = 0; ly < h; ly++) {
    const gy = bounds.y0 + ly
    if (gy < 0 || gy >= CANVAS_H) continue
    for (let lx = 0; lx < w; lx++) {
      const gx = bounds.x0 + lx
      if (gx < 0 || gx >= CANVAS_W) continue
      const landed = wetBuffers.alpha[gy * CANVAS_W + gx] > 0 ? 1 : 0
      if (landed !== keep[ly * w + lx]) crossCheckMismatch++
    }
  }

  return {
    label,
    width: w,
    height: h,
    bounds,
    before,
    keep,
    isolatedBefore: isolatedPxContinuous(before, w, h),
    isolatedAfter: isolatedPxBinary(keep, w, h),
    hist: histogram(before),
    bandLow: bandCount(before, 1, 39),
    bandStraddle: bandCount(before, 40, 100),
    bandHigh: bandCount(before, 101, 255),
    totalPx: w * h,
    keptPx: keep.reduce((s, v) => s + v, 0),
    crossCheckMismatch,
  }
}

function asciiBefore(before: Uint8ClampedArray, w: number, x0: number, x1: number, y0: number, y1: number): string {
  const lines: string[] = []
  for (let y = y0; y <= y1; y++) {
    let row = `${String(y).padStart(3, ' ')} `
    for (let x = x0; x <= x1; x++) row += (before[y * w + x] >> 4).toString(16)
    lines.push(row)
  }
  return lines.join('\n')
}

function asciiKeep(keep: Uint8Array, w: number, h: number, x0: number, x1: number, y0: number, y1: number): string {
  const lines: string[] = []
  for (let y = y0; y <= y1; y++) {
    let row = `${String(y).padStart(3, ' ')} `
    for (let x = x0; x <= x1; x++) {
      if (!keep[y * w + x]) { row += '.'; continue }
      let peer = false
      for (let dy = -1; dy <= 1 && !peer; dy++) {
        for (let dx = -1; dx <= 1 && !peer; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          if (keep[ny * w + nx]) peer = true
        }
      }
      row += peer ? '#' : 'X'
    }
    lines.push(row)
  }
  return lines.join('\n')
}

function crossSection(before: Uint8ClampedArray, w: number, x: number, y0: number, y1: number): string {
  const parts: string[] = []
  for (let y = y0; y <= y1; y++) parts.push(`${y}:${before[y * w + x]}`)
  return parts.join('  ')
}

describe('260928-dh1 deposit keep-gate field diagnosis', () => {
  it('dumps the rasterized alpha field before/after the a<70 include-exclude cut', () => {
    mkdirSync(OUT_DIR, { recursive: true })

    const cells: Array<{ p: number; spd: number; name: string }> = [
      { p: 0.9, spd: 0.2, name: 'heavy-slow' },
      { p: 0.2, spd: 0.2, name: 'light-slow' },
    ]

    const report: string[] = []
    report.push('260928-dh1 — deposit keep-gate field diagnosis')
    report.push(`gate tier = ${GATE_TIER} (wet-layer.ts DEPOSIT_KEEP_TIER — the 260930-wm6 named look lever)`)
    report.push(`canvas ${CANVAS_W}x${CANVAS_H}, radius ${BRUSH_RADIUS}, edgeDetail ${ENGINE_EDGE_DETAIL}, mutationId ${MUTATION_ID}, paperHeight null`)
    report.push('entry = createPaintStrokeRasterContinuation (engine convention: opts.size IS radius, waterAmount/100)')
    report.push('BEFORE = exact offData alpha at transferToWetLayerClipped.getImageData')
    report.push('AFTER  = binary keep-field (before >= 70) — the gate is a pure threshold')
    report.push('control = identical run with ctx.stroke() a no-op (bristles draw nothing)')
    report.push('')

    const byName = new Map<string, { withB: GateDump; noB: GateDump; manufactured: number; manufacturedIsolated: number }>()

    for (const cell of cells) {
      const withB = runGateDump(`${cell.name}-bristles`, cell.p, cell.spd, false)
      const noB = runGateDump(`${cell.name}-nobristles`, cell.p, cell.spd, true)

      // manufactured = kept only because bristles pushed the pixel across the tier
      let manufactured = 0
      let manufacturedIsolated = 0
      const manufMask = new Uint8Array(withB.keep.length)
      for (let i = 0; i < withB.keep.length; i++) {
        if (withB.keep[i] && !noB.keep[i]) {
          manufMask[i] = 1
          manufactured++
        }
      }
      const w = withB.width
      const h = withB.height
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!manufMask[y * w + x]) continue
          let peer = false
          for (let dy = -1; dy <= 1 && !peer; dy++) {
            for (let dx = -1; dx <= 1 && !peer; dx++) {
              if (dx === 0 && dy === 0) continue
              const nx = x + dx, ny = y + dy
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
              if (withB.keep[ny * w + nx]) peer = true
            }
          }
          if (!peer) manufacturedIsolated++
        }
      }
      byName.set(cell.name, { withB, noB, manufactured, manufacturedIsolated })

      report.push(`=== ${cell.name}  (p=${cell.p}, spd=${cell.spd}) ===`)
      report.push(`  raster bounds x ${withB.bounds.x0}..${withB.bounds.x0 + withB.bounds.w - 1}  y ${withB.bounds.y0}..${withB.bounds.y0 + withB.bounds.h - 1}`)
      report.push(`  WITH bristles   : isolatedBefore=${withB.isolatedBefore}  isolatedAfter=${withB.isolatedAfter}  kept=${withB.keptPx}/${withB.totalPx}  crossCheckMismatch=${withB.crossCheckMismatch}`)
      report.push(`  WITHOUT bristles: isolatedBefore=${noB.isolatedBefore}  isolatedAfter=${noB.isolatedAfter}  kept=${noB.keptPx}/${noB.totalPx}  crossCheckMismatch=${noB.crossCheckMismatch}`)
      report.push(`  manufactured by bristles (kept only with bristles) = ${manufactured}  (isolated among them = ${manufacturedIsolated})`)
      report.push(`  bands WITH bristles  : 1-39=${withB.bandLow}  40-100(straddle)=${withB.bandStraddle}  101-255=${withB.bandHigh}`)
      report.push(`  bands WITHOUT bristles: 1-39=${noB.bandLow}  40-100(straddle)=${noB.bandStraddle}  101-255=${noB.bandHigh}`)
      const nz: string[] = []
      for (let v = 0; v < 256; v++) if (withB.hist[v] > 0) nz.push(`${v}:${withB.hist[v]}`)
      report.push(`  histogram WITH bristles (nonzero bins) = ${nz.join(' ')}`)

      const cx = Math.floor(withB.width / 2)
      report.push(`  cross-section BEFORE @x=${cx} (alpha per y):`)
      report.push(`    ${crossSection(withB.before, w, cx, 0, h - 1)}`)

      const ax0 = Math.max(0, cx - 24)
      const ax1 = Math.min(w - 1, cx + 24)
      report.push(`  BEFORE field (hex = alpha>>4), x ${ax0}..${ax1}:`)
      report.push(asciiBefore(withB.before, w, ax0, ax1, 0, h - 1))
      report.push('  AFTER keep-field (# = kept+has neighbour, X = kept ISOLATED, . = dropped):')
      report.push(asciiKeep(withB.keep, w, h, ax0, ax1, 0, h - 1))
      report.push('')

      const beforePng = new Uint8Array(w * h)
      const afterPng = new Uint8Array(w * h)
      for (let i = 0; i < w * h; i++) {
        beforePng[i] = withB.before[i]
        afterPng[i] = withB.keep[i] ? (manufMask[i] ? 255 : 180) : 0
      }
      writeGrayPng(`${OUT_DIR}/${cell.name}-before-alpha.png`, w, h, beforePng)
      writeGrayPng(`${OUT_DIR}/${cell.name}-after-keep.png`, w, h, afterPng)
      writeGrayPng(`${OUT_DIR}/${cell.name}-nobristles-before-alpha.png`, noB.width, noB.height, Uint8Array.from(noB.before))
    }

    // === Verdict (heavy-slow cell — the body that showed the live speckle) ===
    const heavy = byName.get('heavy-slow')!
    const withB = heavy.withB
    const noB = heavy.noB
    const bristlesPushAcross = heavy.manufactured
    const upstream = withB.isolatedBefore >= 8
    const gateManufactures = withB.isolatedAfter >= 8 && withB.isolatedAfter >= withB.isolatedBefore * 2

    report.push('=== VERDICT (heavy-slow cell) ===')
    report.push(`  isolatedBefore (continuous field) = ${withB.isolatedBefore}`)
    report.push(`  isolatedAfter  (binary keep-field)= ${withB.isolatedAfter}`)
    report.push(`  pixels the bristles pushed across tier ${GATE_TIER} = ${bristlesPushAcross} (isolated among them = ${heavy.manufacturedIsolated})`)
    report.push(`  crossCheckMismatch (real transfer vs a>=70 on captured bytes) = ${withB.crossCheckMismatch}`)
    if (upstream && gateManufactures) {
      report.push('  -> MIXED: the field is already speckled BEFORE the cut AND the cut amplifies it.')
    } else if (gateManufactures) {
      report.push('  -> GATE MANUFACTURES THE SPECKLE: field is smooth before, speckled after.')
    } else if (upstream) {
      report.push('  -> UPSTREAM SOURCE: the rasterized alpha field is already speckled before the cut.')
    } else {
      report.push('  -> BOTH FIELDS CLEAN at the gate: speckle is DOWNSTREAM of transferToWetLayerClipped.')
    }
    report.push(`  bristle contribution to threshold straddling: ${bristlesPushAcross > 0 ? 'CONFIRMED (low-alpha traces cross the include/exclude tier)' : 'not observed'}`)
    report.push(`  straddle band 40-100 with bristles = ${withB.bandStraddle}, without = ${noB.bandStraddle}`)
    report.push(`  PNGs + this report in ${OUT_DIR}`)

    const text = report.join('\n')
    writeFileSync(`${OUT_DIR}/diagnosis.txt`, text)
    console.log(text)

    expect(withB.crossCheckMismatch).toBe(0)
    expect(withB.totalPx).toBeGreaterThan(0)
    expect(withB.keptPx).toBeGreaterThan(0)
  })
})
