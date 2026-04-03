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
export function compositeWetLayer(
  displayCtx: CanvasRenderingContext2D,
  wet: WetBuffers,
  width: number,
  height: number,
  sampleHFn: (x: number, y: number) => number,
): void {
  // Sparse check: skip compositing if no wet paint exists
  const size = width * height
  let hasWet = false
  for (let i = 0; i < size; i += 64) {
    if (wet.alpha[i] > DRY_ALPHA_THRESHOLD) { hasWet = true; break }
  }
  if (!hasWet) return

  const id = displayCtx.createImageData(width, height)
  const d = id.data

  for (let i = 0; i < size; i++) {
    if (wet.alpha[i] < DRY_ALPHA_THRESHOLD) continue

    const px = i % width
    const py = (i / width) | 0

    // D-04: Per-pixel opacity from accumulator
    const pixelOpacity = wet.strokeOpacity[i] || 0
    if (pixelOpacity < 0.001) continue  // No stroke deposited here -- skip

    const density = wet.alpha[i] / DENSITY_NORM
    let finalAlpha: number

    if (pixelOpacity >= 0.90) {
      // High opacity: bypass Beer-Lambert. Linear ramp reaches 255 at density ~0.85
      // Threshold 0.90 accommodates pen pressure at max (pressureMod ~0.94)
      finalAlpha = Math.min(255, Math.round(density * 300 * pixelOpacity))
    } else {
      // Partial opacity: Beer-Lambert with paper grain for watercolor look
      const displayAlpha = Math.min(MAX_DISPLAY_ALPHA,
        Math.round(255 * (1 - Math.exp(-DENSITY_K_DISPLAY * density))))
      const pH = sampleHFn(px, py)
      const paperStrength = 0.05 + 0.20 * (1 - Math.min(1, density * 2))
      const paperMod = 1.0 - paperStrength * pH
      finalAlpha = displayAlpha * paperMod * pixelOpacity
    }

    const pi = i * 4
    d[pi]     = Math.round(clamp(wet.r[i], 0, 255))
    d[pi + 1] = Math.round(clamp(wet.g[i], 0, 255))
    d[pi + 2] = Math.round(clamp(wet.b[i], 0, 255))
    d[pi + 3] = Math.round(clamp(finalAlpha, 0, 255))
  }

  displayCtx.putImageData(id, 0, 0)
}
