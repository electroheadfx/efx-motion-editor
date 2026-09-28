// ============================================================
//  Paint Brush Rendering
//  Extracted from efx-paint-physic-v3.html lines 586-1051
//  No module-level mutable state. genTexture creates
//  offscreen canvases for rendering (acceptable for render-path functions).
// ============================================================

import type { PenPoint, BrushOpts, WetBuffers, SavedWetBuffers, PaintPrimitiveTimingObserver } from '../types'
import { hexRgb, rgbHex, mixSubtractive } from '../util/color'
import { lerp, clamp, curveBounds } from '../util/math'
import { hashMutationId, seededDraw, arcSlot, traceShapeNoise } from '../util/traceSeed'
import { sampleH } from '../core/paper'
import { transferToWetLayerClipped } from '../core/wet-layer'
import { smooth, resample, ribbonWithScales, deformNScaled, deformScaled, avgPenData } from './stroke'

function measurePrimitive<T>(observer: PaintPrimitiveTimingObserver | undefined, stage: string, run: () => T): T {
  if (!observer) return run()
  const startedAt = performance.now()
  try {
    return run()
  } finally {
    observer(stage, performance.now() - startedAt)
  }
}

export interface PaintStrokeRasterContinuation {
  step(): boolean
  runToCompletion(): void
}

function createIteratorContinuation(iterator: Generator<void, void, void>): PaintStrokeRasterContinuation {
  let complete = false
  return {
    step() {
      if (complete) return true
      complete = iterator.next().done === true
      return complete
    },
    runToCompletion() {
      while (!complete) complete = iterator.next().done === true
    },
  }
}

/**
 * Flat polygon fill with no grain modulation.
 * From v3.html fillFlat() line 646
 */
export function fillFlat(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  color: string,
  alpha: number,
): void {
  if (pts.length < 3) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * Draw bristle traces along stroke for natural brush appearance.
 * From v3.html drawBristleTraces() line 657
 *
 * 260928-dh1: SINGLE seeded deposit-time trace generator.
 * - Per-bristle parameters, wobble phase, skip draws and per-sample shape
 *   noise are all keyed by (mutationId seed, arc-length) — deterministic
 *   replay, stable across resample/chunking.
 * - Shape noise is fbm (util/noise.ts) with pressure-scaled amplitude
 *   (v11 limit #2 fixed: modulation varies along the stroke, amplitude
 *   grows with pressure).
 * - Lateral offset scales with the LOCAL ribbon scale, so deformation
 *   variance is pressure-dependent with no pressure-independent floor
 *   (v11 limit #1 fixed), and every offset is clamped to the same
 *   ribbonWithScales half-width (geometry clamp only — never alpha).
 * - ctx.stroke() geometry only; per-sample width/alpha are written every
 *   sample and the path is flushed at run boundaries (20% relative change)
 *   so the modulation actually renders.
 */
export function drawBristleTraces(
  ctx: CanvasRenderingContext2D,
  curve: PenPoint[],
  radius: number,
  color: string,
  opac: number,
  penData: PenPoint[],
  hasPenInput: boolean,
  sampleHFn: (x: number, y: number) => number,
  mutationId?: number,
): void {
  void penData
  if (curve.length < 2) return
  const [cr, cg, cb] = hexRgb(color)
  const darker = rgbHex(cr * 0.7, cg * 0.7, cb * 0.7)
  const lighter = rgbHex(Math.min(255, cr * 1.4), Math.min(255, cg * 1.4), Math.min(255, cb * 1.4))
  const strokeSeed = hashMutationId(mutationId)

  // Containment + taper: the SAME ribbon scale the ribbon polygon uses
  // (ribbonWithScales / stroke.ts endTaper) — first curve.length entries
  // map to curve points in order. No second inline scale math.
  const { scales } = ribbonWithScales(curve, radius, 0.8, hasPenInput)

  // Arc-length table (px) — wobble phase and noise are keyed on arc,
  // never sample index (resample/chunking stability).
  const arc: number[] = [0]
  for (let i = 1; i < curve.length; i++) {
    arc[i] = arc[i - 1] + Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y)
  }

  const count = Math.max(4, Math.floor(radius * 0.5))
  const bristles: Array<{ offset: number; width: number; alpha: number; dark: boolean; wFreq: number; wAmp: number }> = []
  for (let i = 0; i < count; i++) {
    const slot = `b${i}`
    bristles.push({
      offset: (i / (count - 1)) * 2 - 1 + (seededDraw(strokeSeed, slot, 'offset') - 0.5) * 0.06,
      width: 0.4 + seededDraw(strokeSeed, slot, 'width') * 1.8,
      alpha: 0.015 + seededDraw(strokeSeed, slot, 'alpha') * 0.045,
      dark: seededDraw(strokeSeed, slot, 'dark') > 0.5,
      wFreq: 0.04 + seededDraw(strokeSeed, slot, 'wFreq') * 0.08,
      wAmp: 0.3 + seededDraw(strokeSeed, slot, 'wAmp') * 1.2,
    })
  }
  for (let bi = 0; bi < bristles.length; bi++) {
    const b = bristles[bi]
    ctx.save()
    ctx.strokeStyle = b.dark ? darker : lighter
    ctx.lineCap = 'round'
    ctx.beginPath()
    let on = false
    let lastX = 0
    let lastY = 0
    let runLW = -1
    let runGA = -1
    for (let ci = 0; ci < curve.length; ci++) {
      const p = curve[ci]
      let tx2: number, ty2: number
      if (ci === 0) { tx2 = curve[1].x - curve[0].x; ty2 = curve[1].y - curve[0].y }
      else if (ci === curve.length - 1) { tx2 = p.x - curve[ci - 1].x; ty2 = p.y - curve[ci - 1].y }
      else { tx2 = curve[ci + 1].x - curve[ci - 1].x; ty2 = curve[ci + 1].y - curve[ci - 1].y }
      const l = Math.hypot(tx2, ty2) || 1
      let nx = -ty2 / l, ny = tx2 / l

      const tiltAngle = (p.tx || 0) * 0.015
      const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle)
      const rnx = nx * cosT - ny * sinT, rny = nx * sinT + ny * cosT

      // Local ribbon half-width — deformation scales with it (pressure-
      // dependent variance, no pressure-independent floor) and the offset
      // is clamped to it (traces can never escape the footprint).
      const halfW = radius * scales[ci]
      const lim = Math.max(0, halfW - 1e-3)
      const wobble = Math.sin(arc[ci] * b.wFreq) * b.wAmp
      const off = clamp((b.offset + wobble * 0.015) * halfW, -lim, lim)
      const bx = p.x + rnx * off, by = p.y + rny * off

      // Per-sample shape parameters — fbm keyed by (seed, arc, bristle,
      // channel), amplitude scaled by pressure (v11 limit #2).
      const pressure = hasPenInput ? p.p : 1
      const ampW = 0.2 + 0.6 * pressure
      const ampA = 0.25 + 0.75 * pressure
      const nW = traceShapeNoise(strokeSeed, arc[ci], bi, 0)
      const nA = traceShapeNoise(strokeSeed, arc[ci], bi, 1)
      const pMod = hasPenInput ? 0.5 + p.p * 1.0 : 1
      const pressureMod = hasPenInput ? 0.3 + p.p * 0.7 : 1
      const lw = b.width * pMod * (1 + (nW - 0.5) * ampW)
      const ga = b.alpha * opac * pressureMod * (1 + (nA - 0.5) * ampA)

      // Velocity: faster strokes skip more samples (v11 reference kept).
      const skipChance = hasPenInput ? clamp(p.spd * 0.002, 0, 0.15) : 0.025
      const slot = arcSlot(arc[ci])
      const paperSkip = sampleHFn(bx, by) > 0.72 && seededDraw(strokeSeed, slot, `paper${bi}`) > 0.3
      const chanceSkip = seededDraw(strokeSeed, slot, `skip${bi}`) < skipChance
      const skip = paperSkip || chanceSkip

      // Run boundary: relative width/alpha change > 20% — flush the run
      // with the PREVIOUS sample's state (written last iteration), then
      // restart the path re-emitting the shared vertex.
      const boundary = on && (runLW > 0) && (Math.abs(lw - runLW) > 0.2 * runLW || Math.abs(ga - runGA) > 0.2 * runGA)
      if (on && (boundary || skip)) {
        ctx.stroke()
        ctx.beginPath()
        if (boundary && !skip) { ctx.moveTo(lastX, lastY) } else { on = false }
      }

      // One shape-parameter write per curve sample (both channels).
      ctx.lineWidth = lw
      ctx.globalAlpha = ga
      if (skip) continue

      if (!on) { ctx.moveTo(bx, by); on = true } else ctx.lineTo(bx, by)
      lastX = bx
      lastY = by
      runLW = lw
      runGA = ga
    }
    if (on) ctx.stroke()
    ctx.restore()
  }
}

/**
 * Sample average color from canvas area.
 * From v3.html sampleAreaColor() line 707
 */
export function sampleAreaColor(
  imgData: ImageData,
  cx: number,
  cy: number,
  radius: number,
): [number, number, number] | null {
  const d = imgData.data, w = imgData.width, h = imgData.height
  const ri = Math.ceil(radius * 0.5), r2 = ri * ri
  let sr = 0, sg = 0, sb = 0, cnt = 0
  for (let dy = -ri; dy <= ri; dy += 2) {
    for (let dx = -ri; dx <= ri; dx += 2) {
      if (dx * dx + dy * dy > r2) continue
      const px = clamp(Math.round(cx + dx), 0, w - 1), py = clamp(Math.round(cy + dy), 0, h - 1)
      const i = (py * w + px) * 4
      if (d[i + 3] < 20) continue
      sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; cnt++
    }
  }
  if (cnt < 1) return null
  return [sr / cnt, sg / cnt, sb / cnt]
}

/**
 * Build per-segment color from surface sampling + subtractive mixing.
 * From v3.html buildCarriedColors() line 724
 */
export function buildCarriedColors(
  curve: PenPoint[],
  pickerColor: string,
  pickup: number,
  canvasSnap: ImageData,
  radius: number,
): Array<[number, number, number]> {
  const [pr, pg, pb] = hexRgb(pickerColor)
  let carried: [number, number, number] = [pr, pg, pb]
  const colors: Array<[number, number, number]> = []
  const pickupRate = pickup * 0.12

  for (let i = 0; i < curve.length; i++) {
    const p = curve[i]
    const surface = sampleAreaColor(canvasSnap, p.x, p.y, radius)

    if (surface && pickup > 0) {
      const blended = mixSubtractive(carried, surface, pickupRate)
      carried = [blended[0], blended[1], blended[2]]
    }

    const depositR = lerp(pr, carried[0], pickup)
    const depositG = lerp(pg, carried[1], pickup)
    const depositB = lerp(pb, carried[2], pickup)
    colors.push([Math.round(depositR), Math.round(depositG), Math.round(depositB)])
  }
  return colors
}

/**
 * Wet composite: mix source onto main canvas with watercolor blending.
 * From v3.html applyWetComposite() line 1056
 */
export function applyWetComposite(
  mc: CanvasRenderingContext2D,
  sc: HTMLCanvasElement,
  wet: number,
  width: number,
  height: number,
): void {
  const md = mc.getImageData(0, 0, width, height)
  const sd = sc.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height)
  const m = md.data, s = sd.data
  for (let i = 0; i < m.length; i += 4) {
    const sa = s[i + 3] / 255; if (sa < 0.003) continue
    const ma = m[i + 3] / 255
    if (ma < 0.01) { m[i] = s[i]; m[i + 1] = s[i + 1]; m[i + 2] = s[i + 2]; m[i + 3] = s[i + 3]; continue }
    const mixT = clamp(wet * sa * ma * 0.4, 0, 0.35), dk = 1 - mixT * 0.12
    const nr = lerp(s[i], (s[i] * 0.55 + m[i] * 0.45), mixT) * dk
    const ng = lerp(s[i + 1], (s[i + 1] * 0.55 + m[i + 1] * 0.45), mixT) * dk
    const nb = lerp(s[i + 2], (s[i + 2] * 0.55 + m[i + 2] * 0.45), mixT) * dk
    const oa = ma + sa * (1 - ma), bt = sa / oa
    m[i] = Math.round(clamp(lerp(m[i], nr, bt), 0, 255))
    m[i + 1] = Math.round(clamp(lerp(m[i + 1], ng, bt), 0, 255))
    m[i + 2] = Math.round(clamp(lerp(m[i + 2], nb, bt), 0, 255))
    m[i + 3] = Math.round(clamp(oa * 255, 0, 255))
  }
  mc.putImageData(md, 0, 0)
}

/**
 * Clipped wet composite using bounds rect.
 * From v3.html applyWetCompositeClipped() line 1076
 */
export function applyWetCompositeClipped(
  mc: CanvasRenderingContext2D,
  sc: HTMLCanvasElement,
  wet: number,
  bounds: { x: number; y: number; w: number; h: number },
): void {
  const md = mc.getImageData(bounds.x, bounds.y, bounds.w, bounds.h)
  const sd = sc.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, bounds.w, bounds.h)
  const m = md.data, s = sd.data
  for (let i = 0; i < m.length; i += 4) {
    const sa = s[i + 3] / 255; if (sa < 0.003) continue
    const ma = m[i + 3] / 255
    if (ma < 0.01) { m[i] = s[i]; m[i + 1] = s[i + 1]; m[i + 2] = s[i + 2]; m[i + 3] = s[i + 3]; continue }
    const mixT = clamp(wet * sa * ma * 0.4, 0, 0.35), dk = 1 - mixT * 0.12
    const nr = lerp(s[i], (s[i] * 0.55 + m[i] * 0.45), mixT) * dk
    const ng = lerp(s[i + 1], (s[i + 1] * 0.55 + m[i + 1] * 0.45), mixT) * dk
    const nb = lerp(s[i + 2], (s[i + 2] * 0.55 + m[i + 2] * 0.45), mixT) * dk
    const oa = Math.min(1, ma + sa * (1 - ma))
    m[i] = clamp(nr, 0, 255); m[i + 1] = clamp(ng, 0, 255); m[i + 2] = clamp(nb, 0, 255)
    m[i + 3] = Math.round(oa * 255)
  }
  mc.putImageData(md, bounds.x, bounds.y)
}

/**
 * MAIN paint stroke entry point.
 * Orchestrates smooth -> resample -> ribbonWithScales -> deformNScaled
 * -> flat layer fill -> transferToWetLayerClipped pipeline.
 * From v3.html renderPaintStroke() line 921
 */
export function renderPaintStroke(
  rawPts: PenPoint[],
  color: string,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  savedWet: SavedWetBuffers,
  dryPos: Float32Array,
  lastStrokeMask: Uint8Array,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  hasPenInput: boolean,
  wetPaper: boolean,
  waterAmount: number,
  sampleHFn: (x: number, y: number) => number,
  observePrimitive?: PaintPrimitiveTimingObserver,
  mutationId?: number,
): void {
  const radius = opts.size || 24
  const wet = waterAmount
  const { opacity, pickup } = opts
  const pickupAmt = (pickup || 0) / 100
  const curve = measurePrimitive(observePrimitive, 'paint-raster-geometry', () => {
    const sm = smooth(rawPts, 3)
    return resample(sm, Math.max(3, radius * 0.25))
  })
  if (curve.length < 3) return

  const pen = avgPenData(curve)
  // Pen pressure affects brush SIZE only, not opacity (user preference)
  const opac = opacity / 100
  const speedDeplete = hasPenInput ? clamp(1 + pen.spd * 0.003, 1, 1.5) : 1

  createPaintStrokeRasterContinuationFromCurve(
    curve, color, opts, ctx, wetBuffers, paperHeight, width, height,
    hasPenInput, waterAmount,
    sampleHFn, observePrimitive, radius, opac, wet, speedDeplete, pickupAmt,
    mutationId,
  ).runToCompletion()
}

export function createPaintStrokeRasterContinuation(
  rawPts: PenPoint[],
  color: string,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  hasPenInput: boolean,
  waterAmount: number,
  sampleHFn: (x: number, y: number) => number,
  observePrimitive?: PaintPrimitiveTimingObserver,
  mutationId?: number,
): PaintStrokeRasterContinuation {
  const radius = opts.size || 24
  const wet = waterAmount
  const { opacity, pickup } = opts
  const pickupAmt = (pickup || 0) / 100
  const curve = measurePrimitive(observePrimitive, 'paint-raster-geometry', () => {
    const sm = smooth(rawPts, 3)
    return resample(sm, Math.max(3, radius * 0.25))
  })
  if (curve.length < 3) return createIteratorContinuation((function* () {})())
  const pen = avgPenData(curve)
  const opac = opacity / 100
  const speedDeplete = hasPenInput ? clamp(1 + pen.spd * 0.003, 1, 1.5) : 1
  return createPaintStrokeRasterContinuationFromCurve(
    curve, color, opts, ctx, wetBuffers, paperHeight, width, height,
    hasPenInput, waterAmount,
    sampleHFn, observePrimitive, radius, opac, wet, speedDeplete, pickupAmt,
    mutationId,
  )
}

export function createPaintStrokeRasterContinuationFromCurve(
  curve: PenPoint[],
  color: string,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  hasPenInput: boolean,
  waterAmount: number,
  sampleHFn: (x: number, y: number) => number,
  observePrimitive: PaintPrimitiveTimingObserver | undefined,
  radius: number,
  opac: number,
  wet: number,
  speedDeplete: number,
  pickupAmt: number,
  mutationId?: number,
): PaintStrokeRasterContinuation {
  void wet
  function* rasterize(): Generator<void, void, void> {
    if (pickupAmt < 0.01) {
      const edgeMul = (opts.edgeDetail != null ? opts.edgeDetail : 50) / 50
      const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul
      const bounds = curveBounds(curve, radius + variance * 5, width, height)
      const off = document.createElement('canvas')
      off.width = bounds.w; off.height = bounds.h
      const oc = off.getContext('2d', { willReadFrequently: true })!
      oc.translate(-bounds.x0, -bounds.y0)
      const { poly: base, scales: baseS } = ribbonWithScales(curve, radius, 0.8, hasPenInput)
      const { poly: baseD, scales: baseDS } = deformNScaled(base, baseS, 4, variance)
      const layers = Math.round((22 + 15) / (speedDeplete || 1))
      const lAlpha = Math.min(0.08, 3 / layers)

      for (let i = 0; i < layers; i++) {
        const { poly: v } = deformScaled(baseD, baseDS, variance * 0.2)
        measurePrimitive(observePrimitive, 'paint-raster-layers', () => fillFlat(oc, v, color, lAlpha))
        yield
      }
      for (let i = 0; i < Math.round(layers * 0.2); i++) {
        const { poly: v } = deformScaled(baseD, baseDS, variance * 0.5)
        measurePrimitive(observePrimitive, 'paint-raster-layers', () => fillFlat(oc, v, color, lAlpha * 0.25))
        yield
      }
      measurePrimitive(observePrimitive, 'paint-raster-bristles', () => drawBristleTraces(oc, curve, radius, color, 1, curve, hasPenInput, sampleHFn, mutationId))
      yield
      measurePrimitive(observePrimitive, 'paint-wet-transfer-composition', () => transferToWetLayerClipped(oc, wetBuffers, waterAmount,
        { x: bounds.x0, y: bounds.y0, w: bounds.w, h: bounds.h }, width, height,
        paperHeight, 0.8, 1.2, opac, observePrimitive))
      return
    }

    const canvasSnap = ctx.getImageData(0, 0, width, height)
    const carriedColors = buildCarriedColors(curve, color, pickupAmt, canvasSnap, radius)
    const segLen = Math.max(8, Math.floor(curve.length / Math.max(1, Math.floor(curve.length / 15))))
    const overlap = Math.floor(segLen * 0.3)

    for (let start = 0; start < curve.length - 2; start += segLen - overlap) {
      const end = Math.min(start + segLen, curve.length)
      const seg = curve.slice(start, end)
      if (seg.length < 3) continue
      const mid = Math.floor((start + end) / 2)
      const segColor = carriedColors[clamp(mid, 0, carriedColors.length - 1)]
      const segHex = rgbHex(segColor[0], segColor[1], segColor[2])
      const edgeMul = (opts.edgeDetail != null ? opts.edgeDetail : 50) / 50
      const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul
      const segBounds = curveBounds(seg, radius + variance * 5, width, height)
      const off2 = document.createElement('canvas')
      off2.width = segBounds.w; off2.height = segBounds.h
      const oc2 = off2.getContext('2d', { willReadFrequently: true })!
      oc2.translate(-segBounds.x0, -segBounds.y0)
      const { poly: base, scales: baseS } = ribbonWithScales(seg, radius, 0.8, hasPenInput)
      const { poly: baseD, scales: baseDS } = deformNScaled(base, baseS, 4, variance)
      const layers = Math.round((22 + opac * 15) / speedDeplete)
      const lAlpha = Math.min(0.065, 3 / layers) * opac

      for (let i = 0; i < layers; i++) {
        const { poly: v } = deformScaled(baseD, baseDS, variance * 0.2)
        measurePrimitive(observePrimitive, 'paint-raster-layers', () => fillFlat(oc2, v, segHex, lAlpha))
        yield
      }
      for (let i = 0; i < Math.round(layers * 0.1); i++) {
        const { poly: v } = deformScaled(baseD, baseDS, variance * 0.5)
        measurePrimitive(observePrimitive, 'paint-raster-layers', () => fillFlat(oc2, v, segHex, lAlpha * 0.2))
        yield
      }
      measurePrimitive(observePrimitive, 'paint-raster-bristles', () => drawBristleTraces(oc2, seg, radius, segHex, opac, seg, hasPenInput, sampleHFn, mutationId))
      yield
      measurePrimitive(observePrimitive, 'paint-wet-transfer-composition', () => transferToWetLayerClipped(oc2, wetBuffers, waterAmount,
        { x: segBounds.x0, y: segBounds.y0, w: segBounds.w, h: segBounds.h }, width, height,
        paperHeight, 0.8, 1.2, opac, observePrimitive))
      yield
    }
  }
  return createIteratorContinuation(rasterize())
}

/**
 * Simplified single-color paint stroke path (no pickup).
 * From v3.html renderPaintStrokeSingleColor() line 1020
 */
export function renderPaintStrokeSingleColor(
  curve: PenPoint[],
  color: string,
  radius: number,
  opac: number,
  wet: number,
  speedDeplete: number,
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  dryPos: Float32Array,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  wetPaper: boolean,
  hasPenInput: boolean,
  waterAmount: number,
  sampleHFn: (x: number, y: number) => number,
  observePrimitive?: PaintPrimitiveTimingObserver,
  mutationId?: number,
): void {
  const edgeMul = (opts.edgeDetail != null ? opts.edgeDetail : 50) / 50
  const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul

  // Clip offscreen canvas to stroke bounds for performance
  const bounds = curveBounds(curve, radius + variance * 5, width, height)
  const off = document.createElement('canvas')
  off.width = bounds.w; off.height = bounds.h
  const oc = off.getContext('2d', { willReadFrequently: true })!
  oc.translate(-bounds.x0, -bounds.y0) // shift so curve coords work directly

  const { poly: base, scales: baseS } = ribbonWithScales(curve, radius, 0.8, hasPenInput)
  const { poly: baseD, scales: baseDS } = deformNScaled(base, baseS, 4, variance)
  // Render layers at full intensity — opacity applied as post-multiply
  const layers = Math.round((22 + 15) / (speedDeplete || 1))
  const lAlpha = Math.min(0.08, 3 / layers)

  measurePrimitive(observePrimitive, 'paint-raster-layers', () => {
    for (let i = 0; i < layers; i++) {
      const { poly: v } = deformScaled(baseD, baseDS, variance * 0.2)
      fillFlat(oc, v, color, lAlpha)
    }
    for (let i = 0; i < Math.round(layers * 0.2); i++) {
      const { poly: v } = deformScaled(baseD, baseDS, variance * 0.5)
      fillFlat(oc, v, color, lAlpha * 0.25)
    }
  })
  measurePrimitive(observePrimitive, 'paint-raster-bristles', () => drawBristleTraces(oc, curve, radius, color, 1, curve, hasPenInput, sampleHFn, mutationId))

  // D-12: Unified render path. Transfer at FULL intensity to wet layer.
  measurePrimitive(observePrimitive, 'paint-wet-transfer-composition', () => transferToWetLayerClipped(oc, wetBuffers, waterAmount,
    { x: bounds.x0, y: bounds.y0, w: bounds.w, h: bounds.h }, width, height,
    paperHeight, 0.8, 1.2, opac, observePrimitive))
}
