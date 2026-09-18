// ============================================================
//  Wet Layer Compositor
//  Beer-Lambert absorption model for wet paint overlay.
//  Extracted from efx-paint-physic-v3.html lines 2139-2186
//  No module-level mutable state.
// ============================================================

import type { WetBuffers } from '../types'
import { DENSITY_NORM, DENSITY_K_DISPLAY, MAX_DISPLAY_ALPHA } from '../types'
import { clamp } from '../util/math'

/** Threshold below which wet paint is considered invisible */
const DRY_ALPHA_THRESHOLD = 1

/**
 * Composite the wet paint layer onto the display canvas.
 * Uses Beer-Lambert absorption model for density-dependent opacity.
 * Paper grain modulates the wet layer alpha for texture.
 * Per-pixel opacity is read from wet.strokeOpacity (Porter-Duff accumulated, D-04).
 *
 * From v3.html compositeWetLayer() line 2139
 *
 * @param displayCtx - The display (overlay) canvas context
 * @param wet - Wet paint buffers
 * @param width - Canvas width
 * @param height - Canvas height
 * @param sampleHFn - Paper height sampling function (x, y) => 0-1
 */
export function wetDisplayAlpha(
  densityAlpha: number,
  pixelOpacity: number,
  paperHeight: number,
): number {
  const density = densityAlpha / DENSITY_NORM
  if (pixelOpacity >= 0.90) {
    return Math.min(255, Math.round(density * 300 * pixelOpacity))
  }
  const displayAlpha = Math.min(MAX_DISPLAY_ALPHA,
    Math.round(255 * (1 - Math.exp(-DENSITY_K_DISPLAY * density))))
  const paperStrength = 0.05 + 0.20 * (1 - Math.min(1, density * 2))
  const paperMod = 1.0 - paperStrength * paperHeight
  return displayAlpha * paperMod * pixelOpacity
}

export function compositeWetLayer(
  displayCtx: CanvasRenderingContext2D,
  wet: WetBuffers,
  width: number,
  height: number,
  sampleHFn: (x: number, y: number) => number,
  scratch?: ImageData,
): void {
  const size = width * height
  // 52.1 (2nd-stroke freeze): the per-composite upload was the WHOLE full-frame
  // display ImageData — 8.3MB putImageData every ~30ms during a stroke, so a
  // long stroke queued ~80 × 8.3MB ≈ 660MB of GPU uploads; the drain then froze
  // the next stroke's canvas flush (the fresh-key 2nd-stroke ~1s block). Scan
  // the wet extent and upload ONLY its bounding box. The display was already
  // cleared by compositeDisplayNow, so pixels outside the box correctly stay
  // transparent; the full-frame scratch still mirrors every wet pixel (it was
  // zeroed before this call) for the overlay rect restores.
  let bx0 = width, by0 = height, bx1 = -1, by1 = -1
  for (let i = 0; i < size; i++) {
    if (wet.alpha[i] > DRY_ALPHA_THRESHOLD) {
      const x = i % width
      const y = (i / width) | 0
      if (x < bx0) bx0 = x
      if (x > bx1) bx1 = x
      if (y < by0) by0 = y
      if (y > by1) by1 = y
    }
  }
  if (bx1 < 0) return
  const rw = bx1 - bx0 + 1
  const rh = by1 - by0 + 1
  const region = displayCtx.createImageData(rw, rh)
  const d = region.data
  const sd = scratch ? scratch.data : null

  for (let py = by0; py <= by1; py++) {
    const rowBase = py * width
    const rowRegionOff = (py - by0) * rw * 4
    for (let px = bx0; px <= bx1; px++) {
      const i = rowBase + px
      if (wet.alpha[i] < DRY_ALPHA_THRESHOLD) continue

      // D-04: Per-pixel opacity from accumulator
      const pixelOpacity = wet.strokeOpacity[i] || 0
      if (pixelOpacity < 0.001) continue  // No stroke deposited here -- skip

      const finalAlpha = wetDisplayAlpha(wet.alpha[i], pixelOpacity, sampleHFn(px, py))

      const ri = rowRegionOff + (px - bx0) * 4
      d[ri]     = Math.round(clamp(wet.r[i], 0, 255))
      d[ri + 1] = Math.round(clamp(wet.g[i], 0, 255))
      d[ri + 2] = Math.round(clamp(wet.b[i], 0, 255))
      d[ri + 3] = Math.round(clamp(finalAlpha, 0, 255))
      if (sd) {
        const si = i * 4
        sd[si] = d[ri]
        sd[si + 1] = d[ri + 1]
        sd[si + 2] = d[ri + 2]
        sd[si + 3] = d[ri + 3]
      }
    }
  }

  displayCtx.putImageData(region, bx0, by0)
}
