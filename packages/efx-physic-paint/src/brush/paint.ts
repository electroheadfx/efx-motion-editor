// ============================================================
//  Paint Brush Rendering
//  Extracted from efx-paint-physic-v3.html lines 586-1051
//  No module-level mutable state. genTexture + fillPolyGrain create
//  offscreen canvases for rendering (acceptable for render-path functions).
// ============================================================

import type { PenPoint, BrushOpts, WetBuffers, SavedWetBuffers } from '../types'
import { hexRgb, rgbHex, mixSubtractive } from '../util/color'
import { gauss, lerp, clamp, curveBounds } from '../util/math'
import { polyBounds } from '../util/math'
import { sampleH } from '../core/paper'
import { transferToWetLayerClipped } from '../core/wet-layer'
import { smooth, resample, ribbon, deform, deformN, avgPenData } from './stroke'
import { fbm } from '../util/noise'

/**
 * Fill polygon with grain/emboss modulation.
 * Creates an offscreen canvas for the polygon fill, applies grain/emboss per-pixel.
 * From v3.html fillPolyGrain() line 618
 */
export function fillPolyGrain(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  r: number,
  g: number,
  b: number,
  alpha: number,
  grain: number,
  emboss: number,
  paperHeight: Float32Array | null,
  width: number,
  height: number,
  sampleHFn: (x: number, y: number) => number,
): void {
  if (pts.length < 3) return
  const bb = polyBounds(pts)
  const pad = 4
  const ox = bb.x0 - pad, oy = bb.y0 - pad
  const bw = Math.ceil(bb.w + pad * 2), bh = Math.ceil(bb.h + pad * 2)
  if (bw < 1 || bh < 1 || bw > 4000 || bh > 4000) return

  const tc = document.createElement('canvas')
  tc.width = bw; tc.height = bh
  const tx = tc.getContext('2d')!
  tx.fillStyle = `rgba(${r},${g},${b},${alpha})`
  tx.beginPath()
  tx.moveTo(pts[0][0] - ox, pts[0][1] - oy)
  for (let i = 1; i < pts.length; i++) tx.lineTo(pts[i][0] - ox, pts[i][1] - oy)
  tx.closePath()
  tx.fill()

  if (grain > 0.01 || emboss > 0.01) {
    const id = tx.getImageData(0, 0, bw, bh), d = id.data
    for (let py = 0; py < bh; py++) for (let px = 0; px < bw; px++) {
      const idx = (py * bw + px) * 4
      if (d[idx + 3] < 1) continue
      let mod = 1
      if (grain > 0.01) mod *= 1 - grain * 0.5 * (1 - fbm((ox + px) * 0.08, (oy + py) * 0.08, 3))
      if (emboss > 0.01) {
        const hVal = sampleHFn(ox + px, oy + py)
        // Adsorption: valleys hold paint (opaque), peaks paint is thin (transparent)
        const embMod = 2 - hVal * 2 // 0 at peaks, 2 at valleys
        mod *= clamp(lerp(1, embMod, emboss), 0.05, 2.0)
      }
      d[idx + 3] = Math.round(clamp(d[idx + 3] * mod, 0, 255))
    }
    tx.putImageData(id, 0, 0)
  }
  ctx.drawImage(tc, ox, oy)
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
): void {
  if (curve.length < 2) return
  const [cr, cg, cb] = hexRgb(color)
  const darker = rgbHex(cr * 0.7, cg * 0.7, cb * 0.7)
  const lighter = rgbHex(Math.min(255, cr * 1.4), Math.min(255, cg * 1.4), Math.min(255, cb * 1.4))
  const count = Math.max(4, Math.floor(radius * 0.5))
  const bristles: Array<{ offset: number; width: number; alpha: number; dark: boolean; wFreq: number; wAmp: number }> = []
  for (let i = 0; i < count; i++) {
    bristles.push({
      offset: (i / (count - 1)) * 2 - 1 + gauss(0, 0.03),
      width: 0.4 + Math.random() * 1.8,
      alpha: 0.015 + Math.random() * 0.06,
      dark: Math.random() > 0.5,
      wFreq: 0.04 + Math.random() * 0.08,
      wAmp: 0.3 + Math.random() * 1.2,
    })
  }
  for (const b of bristles) {
    ctx.save()
    ctx.globalAlpha = b.alpha * opac
    ctx.strokeStyle = b.dark ? darker : lighter
    ctx.lineWidth = b.width
    ctx.lineCap = 'round'
    ctx.beginPath()
    let on = false
    for (let ci = 0; ci < curve.length; ci++) {
      const p = curve[ci]
      let tx2: number, ty2: number
      if (ci === 0) { tx2 = curve[1].x - curve[0].x; ty2 = curve[1].y - curve[0].y }
      else if (ci === curve.length - 1) { tx2 = p.x - curve[ci - 1].x; ty2 = p.y - curve[ci - 1].y }
      else { tx2 = curve[ci + 1].x - curve[ci - 1].x; ty2 = curve[ci + 1].y - curve[ci - 1].y }
      const l = Math.hypot(tx2, ty2) || 1
      let nx = -ty2 / l, ny = tx2 / l

      const t = ci / (curve.length - 1)
      const pr = hasPenInput ? p.p * 0.7 + 0.3 : Math.pow(Math.sin(t * Math.PI), 0.8) * 0.7 + 0.3

      const tiltAngle = (p.tx || 0) * 0.015
      const cosT = Math.cos(tiltAngle), sinT = Math.sin(tiltAngle)
      const rnx = nx * cosT - ny * sinT, rny = nx * sinT + ny * cosT

      const wobble = Math.sin(ci * b.wFreq) * b.wAmp
      const off = (b.offset + wobble * 0.015) * radius * pr
      const bx = p.x + rnx * off, by = p.y + rny * off

      const skipChance = hasPenInput ? clamp(p.spd * 0.002, 0, 0.15) : 0.025
      const hVal = sampleHFn(bx, by)
      if (hVal > 0.72 && Math.random() > 0.3) { on = false; continue }
      if (Math.random() < skipChance) { on = false; continue }

      const pMod = hasPenInput ? 0.5 + p.p * 1.0 : 1
      ctx.lineWidth = b.width * pMod

      if (!on) { ctx.moveTo(bx, by); on = true } else ctx.lineTo(bx, by)
    }
    ctx.stroke()
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
 * Apply paper emboss effect in bounding box.
 * From v3.html applyPaperEmboss() line 989
 */
export function applyPaperEmboss(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  paperHeight: Float32Array | null,
  wetAlpha: Float32Array,
  width: number,
  _height: number,
  embossStrength: number,
  embossStack: number,
  userOpacity: number = 0,
): void {
  if (!paperHeight || embossStrength <= 0) return
  const w = bounds.w
  const h = bounds.h
  const ox = bounds.x
  const oy = bounds.y
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  const fullOpacity = userOpacity >= 0.99
  for (let ly = 0; ly < h; ly++) {
    for (let lx = 0; lx < w; lx++) {
      const pi = (ly * w + lx) * 4
      if (d[pi + 3] < 2) continue
      const gi = (oy + ly) * width + (ox + lx)
      if (gi < 0 || gi >= width * _height) continue
      const hVal = paperHeight[gi]

      // Fade emboss with accumulated paint
      const accumulated = wetAlpha[gi] / (3000 * embossStack * embossStack * embossStack)
      const fadeout = clamp(1 - accumulated, 0.15, 1)
      const strength = embossStrength * fadeout

      const colorShift = (hVal - 0.5) * 2 * strength // -1 (valley) to +1 (peak)

      if (fullOpacity) {
        // 100% opacity: peak lightening only (paper grain texture)
        // Skip alpha modulation (causes transparency) and valley darkening (compounds)
        if (colorShift > 0) {
          const lift = colorShift * 80
          d[pi]     = Math.min(255, d[pi] + Math.round(lift))
          d[pi + 1] = Math.min(255, d[pi + 1] + Math.round(lift))
          d[pi + 2] = Math.min(255, d[pi + 2] + Math.round(lift))
        }
        continue
      }

      // Partial opacity: full emboss (alpha + color)
      const embMod = 2 - hVal * 2
      const alphaMod = clamp(lerp(1, embMod, strength), 0.05, 2.0)
      d[pi + 3] = Math.round(clamp(d[pi + 3] * alphaMod, 0, 255))

      if (colorShift > 0) {
        const lift = colorShift * 80
        d[pi]     = Math.min(255, d[pi] + Math.round(lift))
        d[pi + 1] = Math.min(255, d[pi + 1] + Math.round(lift))
        d[pi + 2] = Math.min(255, d[pi + 2] + Math.round(lift))
      } else {
        const darken = 1 + colorShift * 0.3 // 0.7 to 1.0
        d[pi]     = Math.round(d[pi] * darken)
        d[pi + 1] = Math.round(d[pi + 1] * darken)
        d[pi + 2] = Math.round(d[pi + 2] * darken)
      }
    }
  }
  ctx.putImageData(id, 0, 0)
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
  const sd = sc.getContext('2d')!.getImageData(0, 0, width, height)
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
  const sd = sc.getContext('2d')!.getImageData(0, 0, bounds.w, bounds.h)
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
 * Orchestrates smooth -> resample -> ribbon -> deformN -> fillPolyGrain
 * -> depositToWetLayer/transferToWetLayerClipped pipeline.
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
  embossStrength: number,
  embossStack: number,
  waterAmount: number,
  sampleHFn: (x: number, y: number) => number,
): void {
  const radius = opts.size || 24
  const wet = waterAmount
  const { opacity, pickup } = opts
  const pickupAmt = (pickup || 0) / 100
  const sm = smooth(rawPts, 3), curve = resample(sm, Math.max(3, radius * 0.25))
  if (curve.length < 3) return

  const pen = avgPenData(curve)
  // Pen pressure affects brush SIZE only, not opacity (user preference)
  const opac = opacity / 100
  const speedDeplete = hasPenInput ? clamp(1 + pen.spd * 0.003, 1, 1.5) : 1

  if (pickupAmt < 0.01) {
    renderPaintStrokeSingleColor(curve, color, radius, opac, wet, speedDeplete, opts,
      ctx, wetBuffers, dryPos, paperHeight, width, height,
      embossStrength, embossStack, wetPaper, hasPenInput, waterAmount, sampleHFn)
    return
  }

  // Pickup path: per-segment polygon rendering with carried colors
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
    const [scr, scg, scb] = segColor

    const edgeMul = (opts.edgeDetail != null ? opts.edgeDetail : 50) / 50
    const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul

    const segBounds = curveBounds(seg, radius + variance * 5, width, height)
    const off2 = document.createElement('canvas')
    off2.width = segBounds.w; off2.height = segBounds.h
    const oc2 = off2.getContext('2d')!
    oc2.translate(-segBounds.x0, -segBounds.y0)

    const base = ribbon(seg, radius, 0.8, hasPenInput), baseD = deformN(base, 4, variance)
    const layers = Math.round((22 + opac * 15) / speedDeplete)
    const lAlpha = Math.min(0.065, 3 / layers) * opac

    for (let i = 0; i < layers; i++) {
      const v = deform(baseD, variance * 0.2)
      if (i % 2 === 0) fillPolyGrain(oc2, v, scr, scg, scb, lAlpha, 0.4, 0, paperHeight, width, height, sampleHFn)
      else fillFlat(oc2, v, segHex, lAlpha)
    }
    for (let i = 0; i < Math.round(layers * 0.1); i++) {
      fillFlat(oc2, deform(baseD, variance * 0.5), segHex, lAlpha * 0.2)
    }

    drawBristleTraces(oc2, seg, radius, segHex, opac, seg, hasPenInput, sampleHFn)
    applyPaperEmboss(oc2, { x: segBounds.x0, y: segBounds.y0, w: segBounds.w, h: segBounds.h },
      paperHeight, wetBuffers.alpha, width, height, embossStrength, embossStack, opacity / 100)

    // D-12: Unified render path — all paint goes through wet layer + compositor
    transferToWetLayerClipped(oc2, wetBuffers, waterAmount,
      { x: segBounds.x0, y: segBounds.y0, w: segBounds.w, h: segBounds.h }, width, height,
      paperHeight, 0.8, 1.2, opac)
  }
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
  embossStrength: number,
  embossStack: number,
  wetPaper: boolean,
  hasPenInput: boolean,
  waterAmount: number,
  sampleHFn: (x: number, y: number) => number,
): void {
  const [cr, cg, cb] = hexRgb(color)
  const edgeMul = (opts.edgeDetail != null ? opts.edgeDetail : 50) / 50
  const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul

  // Clip offscreen canvas to stroke bounds for performance
  const bounds = curveBounds(curve, radius + variance * 5, width, height)
  const off = document.createElement('canvas')
  off.width = bounds.w; off.height = bounds.h
  const oc = off.getContext('2d')!
  oc.translate(-bounds.x0, -bounds.y0) // shift so curve coords work directly

  const base = ribbon(curve, radius, 0.8, hasPenInput), baseD = deformN(base, 4, variance)
  // Render layers at full intensity — opacity applied as post-multiply
  const layers = Math.round((22 + 15) / (speedDeplete || 1))
  const lAlpha = Math.min(0.08, 3 / layers)

  for (let i = 0; i < layers; i++) {
    const v = deform(baseD, variance * 0.2)
    if (i % 2 === 0) fillPolyGrain(oc, v, cr, cg, cb, lAlpha, 0.4, 0, paperHeight, width, height, sampleHFn)
    else fillFlat(oc, v, color, lAlpha)
  }
  for (let i = 0; i < Math.round(layers * 0.2); i++) {
    fillFlat(oc, deform(baseD, variance * 0.5), color, lAlpha * 0.25)
  }
  drawBristleTraces(oc, curve, radius, color, 1, curve, hasPenInput, sampleHFn)
  applyPaperEmboss(oc, { x: bounds.x0, y: bounds.y0, w: bounds.w, h: bounds.h },
    paperHeight, wetBuffers.alpha, width, height, embossStrength, embossStack, opts.opacity / 100)

  // D-12: Unified render path. Transfer at FULL intensity to wet layer.
  transferToWetLayerClipped(oc, wetBuffers, waterAmount,
    { x: bounds.x0, y: bounds.y0, w: bounds.w, h: bounds.h }, width, height,
    paperHeight, 0.8, 1.2, opac)
}
