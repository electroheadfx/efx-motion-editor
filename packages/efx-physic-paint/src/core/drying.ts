// ============================================================
//  LUT-driven drying system
//  Extracted from efx-paint-physic-v3.html lines 260-284, 1654-1724, 2526-2554
//  No module-level mutable state. No DOM access (ctx passed as arg).
// ============================================================

import type { WetBuffers, SavedWetBuffers, DryingLUT } from '../types'
import { LUT_SIZE } from '../types'
import { lerp, clamp } from '../util/math'

/** Threshold below which wet paint is considered fully dry */
const DRY_ALPHA_THRESHOLD = 1

/**
 * Initialize the drying LUT tables.
 * dryLUT: cumulative S-curve (0.002 base with 0.998 decay).
 * invLUT: inverse mapping.
 * From v3.html initDryingLUT() line 260
 */
export function initDryingLUT(dryLUT: Float32Array, invLUT: Float32Array): void {
  dryLUT[0] = 0
  invLUT[0] = 0
  for (let c = 1; c <= LUT_SIZE; c++) invLUT[c] = -1
  for (let c = 1; c <= LUT_SIZE; c++) {
    dryLUT[c] = 0.002 + dryLUT[c - 1] * 0.998
    const idx = Math.min(LUT_SIZE, Math.floor(dryLUT[c] * LUT_SIZE))
    invLUT[idx] = c
  }
  for (let c = 1; c <= LUT_SIZE; c++) {
    if (invLUT[c] === -1) invLUT[c] = invLUT[c - 1]
  }
}

/**
 * Advances drying position for all wet pixels and transfers wet paint
 * to the dry canvas via LUT-driven fractional transfer.
 * Runs at 10fps independent of painting.
 * From v3.html dryStep() line 1654
 *
 * @param wet - Wet paint buffers
 * @param drying - Drying LUT and per-pixel dryPos
 * @param ctx - The dry canvas (hidden `c`) 2D context
 * @param width - Canvas width
 * @param height - Canvas height
 * @param drySpeed - LUT positions per physics tick (default ~40)
 * @param paperHeight - Paper height map for texture modulation, or null
 */
export function dryStep(
  wet: WetBuffers,
  drying: DryingLUT,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  drySpeed: number,
  paperHeight: Float32Array | null,
): void {
  const id = ctx.getImageData(0, 0, width, height)
  const d = id.data
  let changed = false
  const size = width * height

  for (let i = 0; i < size; i++) {
    if (wet.alpha[i] < DRY_ALPHA_THRESHOLD) continue

    const prevPos = drying.dryPos[i]
    drying.dryPos[i] = Math.min(LUT_SIZE, drying.dryPos[i] + drySpeed)

    // Fully dry: transfer everything remaining
    if (drying.dryPos[i] >= LUT_SIZE) {
      const densityAlpha = Math.min(1, wet.alpha[i] / 800)
      const pixelOpacity = wet.strokeOpacity ? wet.strokeOpacity[i] : 1.0
      const sa = densityAlpha * pixelOpacity
      const pi = i * 4
      const ma = d[pi + 3] / 255
      if (sa > 0.005) {
        const oa = Math.min(1, ma + sa * (1 - ma))
        const bt = sa / Math.max(0.005, oa)
        d[pi]     = Math.round(clamp(lerp(d[pi],     wet.r[i], bt), 0, 255))
        d[pi + 1] = Math.round(clamp(lerp(d[pi + 1], wet.g[i], bt), 0, 255))
        d[pi + 2] = Math.round(clamp(lerp(d[pi + 2], wet.b[i], bt), 0, 255))
        d[pi + 3] = Math.round(clamp(oa * 255, 0, 255))
        changed = true
      }
      wet.alpha[i] = 0; wet.wetness[i] = 0
      wet.r[i] = 0; wet.g[i] = 0; wet.b[i] = 0
      if (wet.strokeOpacity) wet.strokeOpacity[i] = 0
      drying.dryPos[i] = 0
      continue
    }

    // LUT-driven fractional transfer
    const frac = drying.dryLUT[Math.floor(drying.dryPos[i])]
    const prevFrac = drying.dryLUT[Math.floor(prevPos)]
    const df = frac - prevFrac
    if (df < 0.0001) continue

    const drain = wet.alpha[i] * df
    const pixelOpacity = wet.strokeOpacity ? wet.strokeOpacity[i] : 1.0
    let sa = (drain / 800) * pixelOpacity

    // Paper texture modulation — skip at full opacity for solid coverage
    if (paperHeight && pixelOpacity < 0.99) {
      const ph = paperHeight[i]
      sa *= clamp(1.4 - ph * 0.8, 0.3, 1.4)
    }

    const pi = i * 4
    const ma = d[pi + 3] / 255

    if (sa > 0.005) {
      const oa = Math.min(1, ma + sa * (1 - ma))
      const bt = sa / Math.max(0.005, oa)
      d[pi]     = Math.round(clamp(lerp(d[pi],     wet.r[i], bt), 0, 255))
      d[pi + 1] = Math.round(clamp(lerp(d[pi + 1], wet.g[i], bt), 0, 255))
      d[pi + 2] = Math.round(clamp(lerp(d[pi + 2], wet.b[i], bt), 0, 255))
      d[pi + 3] = Math.round(clamp(oa * 255, 0, 255))
      changed = true
    }

    wet.alpha[i] -= drain
    wet.wetness[i] = Math.max(0, wet.wetness[i] * (1 - df))

    if (wet.alpha[i] < DRY_ALPHA_THRESHOLD) {
      wet.alpha[i] = 0; wet.wetness[i] = 0
      wet.r[i] = 0; wet.g[i] = 0; wet.b[i] = 0
      if (wet.strokeOpacity) wet.strokeOpacity[i] = 0
      drying.dryPos[i] = 0
    }
  }

  if (changed) ctx.putImageData(id, 0, 0)
}

/**
 * Instantly transfer all wet paint to the dry canvas and clear wet layer.
 * Uses a=min(wetAlpha/800,1) opacity formula (the "sacred" /800).
 * From v3.html forceDryAll() line 2526
 */
export function forceDryAll(
  wet: WetBuffers,
  saved: SavedWetBuffers,
  drying: DryingLUT,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const id = ctx.getImageData(0, 0, width, height)
  const d = id.data
  let changed = false
  const size = width * height

  for (let i = 0; i < size; i++) {
    if (wet.alpha[i] < 1) continue

    // Sacred /800 divisor — calibrated for sparse paper-height deposits (D-06)
    // dryStep also uses /800 — must stay consistent
    const densityAlpha = Math.min(1, wet.alpha[i] / 800)
    const pixelOpacity = wet.strokeOpacity ? wet.strokeOpacity[i] : 1.0
    const sa = densityAlpha * pixelOpacity
    const pi = i * 4
    const ma = d[pi + 3] / 255

    if (sa > 0.005) {
      const oa = Math.min(1, ma + sa * (1 - ma))
      const bt = sa / Math.max(0.005, oa)
      d[pi]     = Math.round(clamp(lerp(d[pi],     wet.r[i], bt), 0, 255))
      d[pi + 1] = Math.round(clamp(lerp(d[pi + 1], wet.g[i], bt), 0, 255))
      d[pi + 2] = Math.round(clamp(lerp(d[pi + 2], wet.b[i], bt), 0, 255))
      d[pi + 3] = Math.round(clamp(oa * 255, 0, 255))
      changed = true
    }

    wet.alpha[i] = 0; wet.wetness[i] = 0
    wet.r[i] = 0; wet.g[i] = 0; wet.b[i] = 0
    if (wet.strokeOpacity) wet.strokeOpacity[i] = 0
    drying.dryPos[i] = 0
  }

  if (changed) ctx.putImageData(id, 0, 0)
}
