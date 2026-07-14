// ============================================================
//  Erase Brush
//  Extracted from efx-paint-physic-v3.html lines 1214-1296
//  No module-level mutable state. Offscreen canvas for mask rendering.
// ============================================================

import type { PenPoint, BrushOpts, WetBuffers, PaintPrimitiveTimingObserver } from '../types'

function measurePrimitive<T>(observer: PaintPrimitiveTimingObserver | undefined, stage: string, run: () => T): T {
  if (!observer) return run()
  const startedAt = performance.now()
  try {
    return run()
  } finally {
    observer(stage, performance.now() - startedAt)
  }
}
import { lerp, clamp, curveBounds } from '../util/math'
import { smooth, resample, ribbon, deform, deformN } from './stroke'
import { fillFlat } from './paint'

/**
 * Stroke-completion erase -- uses same ribbon+deform polygon as paint brush.
 * Erases by drawing transparent circles on dry canvas and clearing wet layer in area.
 * Uses `globalCompositeOperation = 'destination-out'` for transparent erase.
 * From v3.html applyEraseStroke() line 1214
 */
export function applyEraseStroke(
  rawPts: PenPoint[],
  opts: BrushOpts,
  ctx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  width: number,
  height: number,
  hasPenInput: boolean,
  embossStrength: number,
  paperHeight: Float32Array | null,
  bgMode: string,
  bgData: ImageData | null,
  observePrimitive?: PaintPrimitiveTimingObserver,
): void {
  if (rawPts.length < 3) return
  const { size } = opts
  const eraseStr = (opts.eraseStrength != null ? opts.eraseStrength : 50) / 100
  const edgeMul = (opts.edgeDetail != null ? opts.edgeDetail : 50) / 50
  const radius = size
  const pMod = hasPenInput ? rawPts[Math.floor(rawPts.length / 2)].p : 1

  const curve = measurePrimitive(observePrimitive, 'erase-geometry', () => {
    const sm = smooth(rawPts, 3)
    return resample(sm, Math.max(3, radius * 0.25))
  })
  if (curve.length < 3) return

  const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul
  const bounds = curveBounds(curve, radius + variance * 5, width, height)

  // Render erase mask to offscreen canvas (same shape as paint brush)
  const off = document.createElement('canvas')
  off.width = bounds.w; off.height = bounds.h
  const oc = off.getContext('2d')!
  oc.translate(-bounds.x0, -bounds.y0)

  const base = ribbon(curve, radius, 0.8, hasPenInput)
  const baseD = deformN(base, 4, variance)
  // More layers at higher strength for denser mask coverage
  // Fixed light mask for shape -- strMul controls actual removal amount
  const layers = 15
  const lAlpha = 0.04

  measurePrimitive(observePrimitive, 'erase-mask-raster', () => {
    for (let i = 0; i < layers; i++) {
      const v = deform(baseD, variance * 0.2)
      fillFlat(oc, v, '#fff', lAlpha)
    }
    for (let i = 0; i < Math.round(layers * 0.2); i++) {
      fillFlat(oc, deform(baseD, variance * 0.5), '#fff', lAlpha * 0.5)
    }
  })

  // Read the mask and apply erase
  const maskData = measurePrimitive(observePrimitive, 'erase-mask-readback', () => oc.getImageData(0, 0, bounds.w, bounds.h)).data
  const cid = measurePrimitive(observePrimitive, 'erase-dry-readback', () => ctx.getImageData(bounds.x0, bounds.y0, bounds.w, bounds.h))
  const cd = cid.data
  const bd = bgData ? bgData.data : null

  // Strength multiplier: at 100% a mask alpha of 128 should fully erase
  // Cubic: 0%=none, 30%~10%, 50%~25%, 70%~55%, 90%~full
  const strMul = eraseStr * eraseStr * eraseStr * 5 + eraseStr * 0.3

  measurePrimitive(observePrimitive, 'erase-pixel-loop', () => {
  for (let ly = 0; ly < bounds.h; ly++) {
    const gy = bounds.y0 + ly
    if (gy < 0 || gy >= height) continue
    for (let lx = 0; lx < bounds.w; lx++) {
      const gx = bounds.x0 + lx
      if (gx < 0 || gx >= width) continue
      const li = (ly * bounds.w + lx) * 4
      const maskAlpha = maskData[li + 3] / 255 // 0-1 from offscreen shape
      if (maskAlpha < 0.01) continue

      const eraseMask = clamp(maskAlpha * strMul * pMod, 0, 1)
      const keep = 1 - eraseMask
      const i = gy * width + gx

      // Erase from wet layer
      wetBuffers.alpha[i] *= keep
      wetBuffers.wetness[i] *= keep
      if (wetBuffers.alpha[i] < 1) {
        wetBuffers.alpha[i] = 0
        wetBuffers.r[i] = 0; wetBuffers.g[i] = 0; wetBuffers.b[i] = 0
      }

      // Erase from main canvas
      if (bgMode === 'transparent') {
        // Transparent mode: just reduce alpha (don't lerp RGB toward black)
        cd[li + 3] = Math.round(cd[li + 3] * keep)
        if (cd[li + 3] < 2) { cd[li] = 0; cd[li + 1] = 0; cd[li + 2] = 0; cd[li + 3] = 0 }
      } else if (bd) {
        const gi = (gy * width + gx) * 4
        cd[li]     = Math.round(lerp(cd[li],     bd[gi],     eraseMask))
        cd[li + 1] = Math.round(lerp(cd[li + 1], bd[gi + 1], eraseMask))
        cd[li + 2] = Math.round(lerp(cd[li + 2], bd[gi + 2], eraseMask))
        cd[li + 3] = Math.round(lerp(cd[li + 3], bd[gi + 3], eraseMask))
      } else {
        cd[li + 3] = Math.round(cd[li + 3] * keep)
        if (cd[li + 3] < 2) { cd[li] = 0; cd[li + 1] = 0; cd[li + 2] = 0; cd[li + 3] = 0 }
      }
    }
  }
  })
  measurePrimitive(observePrimitive, 'erase-dry-writeback', () => ctx.putImageData(cid, bounds.x0, bounds.y0))
}
