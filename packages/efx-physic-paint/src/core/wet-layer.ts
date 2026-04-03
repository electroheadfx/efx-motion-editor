// ============================================================
//  Wet Layer Buffer Operations
//  Extracted from efx-paint-physic-v3.html lines 755-919, 2559
//  All buffers are passed as arguments — no module-level mutable state.
//  No DOM access in this module.
// ============================================================

import type { WetBuffers, SavedWetBuffers, TmpBuffers, PenPoint } from '../types'
import { lerp } from '../util/math'

/**
 * Edge feathering on the wet layer within bounds.
 * Extends paint edges by averaging alpha + color into neighboring empty pixels.
 * Creates smooth sub-pixel transitions at brush boundaries.
 * @param passes - Number of feathering passes (1=soft, 2=med, 3=high)
 */
export function featherWetEdges(
  wet: WetBuffers,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number,
  passes: number,
): void {
  const x0 = Math.max(1, bounds.x0)
  const y0 = Math.max(1, bounds.y0)
  const x1 = Math.min(width - 2, bounds.x1)
  const y1 = Math.min(height - 2, bounds.y1)

  for (let pass = 0; pass < passes; pass++) {
    // Expand: for empty pixels adjacent to paint, set them to averaged neighbor values
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x
        if (wet.alpha[i] > 1) continue // skip painted pixels

        // Count painted neighbors and accumulate their values
        let sumA = 0, sumR = 0, sumG = 0, sumB = 0, sumSO = 0, count = 0
        const neighbors = [i - 1, i + 1, i - width, i + width]
        for (const ni of neighbors) {
          if (wet.alpha[ni] > 1) {
            sumA += wet.alpha[ni]
            sumR += wet.r[ni]
            sumG += wet.g[ni]
            sumB += wet.b[ni]
            sumSO += wet.strokeOpacity ? wet.strokeOpacity[ni] : 1
            count++
          }
        }
        if (count === 0) continue // no painted neighbors

        // Set this pixel to a fraction of neighbor averages (feathered edge)
        const frac = 0.35 // how much of neighbor intensity to inherit
        wet.alpha[i] = (sumA / count) * frac
        wet.r[i] = sumR / count
        wet.g[i] = sumG / count
        wet.b[i] = sumB / count
        if (wet.strokeOpacity) wet.strokeOpacity[i] = sumSO / count
        wet.wetness[i] = Math.max(wet.wetness[i], 100)
      }
    }
  }
}
import { hexRgb, mixSubtractive } from '../util/color'

/**
 * Factory: allocates all 5 Float32Arrays for the wet paint layer.
 * From v3.html lines 173-177
 */
export function createWetBuffers(size: number): WetBuffers {
  return {
    r: new Float32Array(size),
    g: new Float32Array(size),
    b: new Float32Array(size),
    alpha: new Float32Array(size),
    wetness: new Float32Array(size),
    strokeOpacity: new Float32Array(size),
  }
}

/**
 * Factory: allocates 4 Float32Arrays for the saved wet layer snapshot.
 * From v3.html lines 192-195
 */
export function createSavedWetBuffers(size: number): SavedWetBuffers {
  return {
    r: new Float32Array(size),
    g: new Float32Array(size),
    b: new Float32Array(size),
    alpha: new Float32Array(size),
    strokeOpacity: new Float32Array(size),
  }
}

/**
 * Factory: allocates 4 Float32Arrays for diffusion ping-pong buffers.
 */
export function createTmpBuffers(size: number): TmpBuffers {
  return {
    r: new Float32Array(size),
    g: new Float32Array(size),
    b: new Float32Array(size),
    alpha: new Float32Array(size),
  }
}

/**
 * Clears all wet layer arrays, saved arrays, dryPos, blowDX/DY, and lastStrokeMask.
 * From v3.html clearWetLayer() line 2559
 */
export function clearWetLayer(
  wet: WetBuffers,
  saved: SavedWetBuffers,
  dryPos: Float32Array,
  blowDX: Float32Array,
  blowDY: Float32Array,
  lastStrokeMask: Uint8Array,
): void {
  wet.r.fill(0)
  wet.g.fill(0)
  wet.b.fill(0)
  wet.alpha.fill(0)
  wet.wetness.fill(0)
  wet.strokeOpacity.fill(0)
  dryPos.fill(0)
  blowDX.fill(0)
  blowDY.fill(0)
  saved.r.fill(0)
  saved.g.fill(0)
  saved.b.fill(0)
  saved.alpha.fill(0)
  lastStrokeMask.fill(0)
}

/**
 * Deposit paint from a stroke curve into the wet layer with a single color.
 * Polygon fill into wet layer with radial falloff.
 * From v3.html depositToWetLayer() lines 755-803
 *
 * @param curve - Resampled pen points along the stroke
 * @param color - Hex color string e.g. '#ff0000'
 * @param radius - Brush radius in pixels
 * @param opacity - Brush opacity 0-1
 * @param waterAmount - Water slider 0-1
 * @param wetBuffers - Wet paint buffers (r, g, b, alpha, wetness)
 * @param hasPenInput - Whether tablet pen is being used
 * @param width - Canvas width
 * @param height - Canvas height
 */
export function depositToWetLayer(
  curve: PenPoint[],
  color: string,
  radius: number,
  opacity: number,
  waterAmount: number,
  wetBuffers: WetBuffers,
  hasPenInput: boolean,
  width: number,
  height: number,
  paperHeight: Float32Array | null = null,  // D-08: paper-height deposit modulation
  gamma: number = 0.8,                       // D-09: granulation
  delta: number = 1.2,                       // D-09: density
  userOpacity: number = 1.0,                 // D-01: stroke opacity for Porter-Duff accumulation
): void {
  const [cr, cg, cb] = hexRgb(color)
  const depositStrength = opacity * 1.2
  const r2 = radius * radius

  for (let ci = 0; ci < curve.length; ci++) {
    const p = curve[ci]
    const cx = Math.round(p.x), cy = Math.round(p.y)
    const ri = Math.ceil(radius)
    const pressureMod = hasPenInput ? 0.4 + p.p * 0.6 : 1

    for (let dy = -ri; dy <= ri; dy++) {
      const py = cy + dy
      if (py < 0 || py >= height) continue
      for (let dx = -ri; dx <= ri; dx++) {
        const px = cx + dx
        if (px < 0 || px >= width) continue
        const dd = dx * dx + dy * dy
        if (dd > r2) continue

        // Falloff: smooth radial with sqrt for softer edges
        const dist = Math.sqrt(dd) / radius
        const ff = Math.max(0, 1 - dist * dist) * pressureMod
        if (ff < 0.001) continue

        const idx = py * width + px
        let depositAlpha = depositStrength * ff * 200

        // D-08/D-09: Paper-height deposit modulation
        // Valleys (h~0) get full deposit; peaks (h~1) get reduced deposit
        // Floor scales with userOpacity² so 100% opacity → full coverage
        if (paperHeight) {
          const h = paperHeight[idx]
          const wFrac = Math.min(1, wetBuffers.wetness[idx] / 1000)
          const adsorption = (1 - wFrac) * (1 - h * gamma) * delta
          const floor = userOpacity * userOpacity
          depositAlpha *= Math.max(floor, adsorption)
        }

        const existingA = wetBuffers.alpha[idx]
        const newA = Math.min(200000, existingA + depositAlpha)

        // D-10: Subtractive RYB mixing when blending with existing paint
        if (existingA > 1) {
          const blend = depositAlpha / (existingA + depositAlpha)
          const existing: [number, number, number] = [
            wetBuffers.r[idx], wetBuffers.g[idx], wetBuffers.b[idx]
          ]
          const incoming: [number, number, number] = [cr, cg, cb]
          const mixed = mixSubtractive(existing, incoming, blend)
          wetBuffers.r[idx] = mixed[0]
          wetBuffers.g[idx] = mixed[1]
          wetBuffers.b[idx] = mixed[2]
        } else {
          wetBuffers.r[idx] = cr
          wetBuffers.g[idx] = cg
          wetBuffers.b[idx] = cb
        }

        wetBuffers.alpha[idx] = newA
        // D-01/D-02: Porter-Duff "over" opacity accumulation
        const existingOp = wetBuffers.strokeOpacity[idx]
        wetBuffers.strokeOpacity[idx] = existingOp + userOpacity * (1 - existingOp)
        const waterDeposit = waterAmount * 1200 * ff * depositStrength
        wetBuffers.wetness[idx] = Math.min(1000, wetBuffers.wetness[idx] + waterDeposit)
      }
    }
  }
}

/**
 * Like depositToWetLayer but with per-polygon color from pickup sampling.
 * From v3.html depositToWetLayerWithColors() lines 805-852
 */
export function depositToWetLayerWithColors(
  curve: PenPoint[],
  carriedColors: Array<[number, number, number]>,
  radius: number,
  opacity: number,
  waterAmount: number,
  wetBuffers: WetBuffers,
  hasPenInput: boolean,
  width: number,
  height: number,
  paperHeight: Float32Array | null = null,  // D-08: paper-height deposit modulation
  gamma: number = 0.8,                       // D-09: granulation
  delta: number = 1.2,                       // D-09: density
  userOpacity: number = 1.0,                 // D-01: stroke opacity for Porter-Duff accumulation
): void {
  const depositStrength = opacity * 1.2
  const r2 = radius * radius

  for (let ci = 0; ci < curve.length; ci++) {
    const p = curve[ci]
    const cx = Math.round(p.x), cy = Math.round(p.y)
    const ri = Math.ceil(radius)
    const pressureMod = hasPenInput ? 0.4 + p.p * 0.6 : 1
    const [cr, cg, cb] = carriedColors[ci]

    for (let dy = -ri; dy <= ri; dy++) {
      const py = cy + dy
      if (py < 0 || py >= height) continue
      for (let dx = -ri; dx <= ri; dx++) {
        const px = cx + dx
        if (px < 0 || px >= width) continue
        const dd = dx * dx + dy * dy
        if (dd > r2) continue

        const dist = Math.sqrt(dd) / radius
        const ff = Math.max(0, 1 - dist * dist) * pressureMod
        if (ff < 0.001) continue

        const idx = py * width + px
        let depositAlpha = depositStrength * ff * 200

        // D-08/D-09: Paper-height deposit modulation
        // Floor scales with userOpacity² so 100% opacity → full coverage
        if (paperHeight) {
          const h = paperHeight[idx]
          const wFrac = Math.min(1, wetBuffers.wetness[idx] / 1000)
          const adsorption = (1 - wFrac) * (1 - h * gamma) * delta
          const floor = userOpacity * userOpacity
          depositAlpha *= Math.max(floor, adsorption)
        }

        const existingA = wetBuffers.alpha[idx]
        const newA = Math.min(200000, existingA + depositAlpha)

        // D-10: Subtractive RYB mixing when blending with existing paint
        if (existingA > 1) {
          const blend = depositAlpha / (existingA + depositAlpha)
          const existing: [number, number, number] = [
            wetBuffers.r[idx], wetBuffers.g[idx], wetBuffers.b[idx]
          ]
          const incoming: [number, number, number] = [cr, cg, cb]
          const mixed = mixSubtractive(existing, incoming, blend)
          wetBuffers.r[idx] = mixed[0]
          wetBuffers.g[idx] = mixed[1]
          wetBuffers.b[idx] = mixed[2]
        } else {
          wetBuffers.r[idx] = cr
          wetBuffers.g[idx] = cg
          wetBuffers.b[idx] = cb
        }

        wetBuffers.alpha[idx] = newA
        // D-01/D-02: Porter-Duff "over" opacity accumulation
        const existingOp = wetBuffers.strokeOpacity[idx]
        wetBuffers.strokeOpacity[idx] = existingOp + userOpacity * (1 - existingOp)
        const waterDeposit = waterAmount * 1200 * ff * depositStrength
        wetBuffers.wetness[idx] = Math.min(1000, wetBuffers.wetness[idx] + waterDeposit)
      }
    }
  }
}

/**
 * Reads canvas ImageData and writes to wet arrays for non-zero alpha pixels.
 * From v3.html transferToWetLayer() lines 855-882
 */
export function transferToWetLayer(
  offCtx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  waterAmount: number,
  width: number,
  height: number,
  paperHeight: Float32Array | null = null,  // D-08: paper-height deposit modulation
  gamma: number = 0.8,                       // D-09: granulation
  delta: number = 1.2,                       // D-09: density
  userOpacity: number = 1.0,                 // D-01: stroke opacity for Porter-Duff accumulation
): void {
  const offData = offCtx.getImageData(0, 0, width, height).data

  for (let i = 0; i < width * height; i++) {
    const pi = i * 4
    const a = offData[pi + 3]
    if (a < 20) continue  // Filter bristle trace + anti-aliased edge artifacts

    let depositAlpha = (a / 255) * 3000

    // D-08/D-09: Paper-height deposit modulation
    // Floor scales with userOpacity² so 100% opacity → full coverage
    if (paperHeight) {
      const h = paperHeight[i]
      const wFrac = Math.min(1, wetBuffers.wetness[i] / 1000)
      const adsorption = (1 - wFrac) * (1 - h * gamma) * delta
      const floor = userOpacity * userOpacity
      depositAlpha *= Math.max(floor, adsorption)
    }

    const existingA = wetBuffers.alpha[i]
    const newA = Math.min(200000, existingA + depositAlpha)

    // D-10: Subtractive RYB mixing when blending with existing paint
    // At full opacity: overwrite color (solid paint covers)
    if (existingA > 1 && userOpacity < 0.99) {
      const blend = depositAlpha / (existingA + depositAlpha)
      const existing: [number, number, number] = [
        wetBuffers.r[i], wetBuffers.g[i], wetBuffers.b[i]
      ]
      const incoming: [number, number, number] = [
        offData[pi], offData[pi + 1], offData[pi + 2]
      ]
      const mixed = mixSubtractive(existing, incoming, blend)
      wetBuffers.r[i] = mixed[0]
      wetBuffers.g[i] = mixed[1]
      wetBuffers.b[i] = mixed[2]
    } else {
      wetBuffers.r[i] = offData[pi]
      wetBuffers.g[i] = offData[pi + 1]
      wetBuffers.b[i] = offData[pi + 2]
    }

    wetBuffers.alpha[i] = newA
    // D-01/D-02: Porter-Duff "over" opacity accumulation
    const existingOp = wetBuffers.strokeOpacity[i]
    wetBuffers.strokeOpacity[i] = existingOp + userOpacity * (1 - existingOp)
    wetBuffers.wetness[i] = Math.min(1000, wetBuffers.wetness[i] + waterAmount * 1200 * (a / 255))
  }
}

/**
 * Clipped version of transferToWetLayer using bounds rect.
 * From v3.html transferToWetLayerClipped() lines 884-919
 */
export function transferToWetLayerClipped(
  offCtx: CanvasRenderingContext2D,
  wetBuffers: WetBuffers,
  waterAmount: number,
  bounds: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
  paperHeight: Float32Array | null = null,  // D-08: paper-height deposit modulation
  gamma: number = 0.8,                       // D-09: granulation
  delta: number = 1.2,                       // D-09: density
  userOpacity: number = 1.0,                 // D-01: stroke opacity for Porter-Duff accumulation
): void {
  const offData = offCtx.getImageData(0, 0, bounds.w, bounds.h).data

  for (let ly = 0; ly < bounds.h; ly++) {
    const gy = bounds.y + ly
    if (gy < 0 || gy >= height) continue
    for (let lx = 0; lx < bounds.w; lx++) {
      const gx = bounds.x + lx
      if (gx < 0 || gx >= width) continue
      const pi = (ly * bounds.w + lx) * 4
      const a = offData[pi + 3]
      if (a < 20) continue  // Filter bristle trace + anti-aliased edge artifacts that create grey artifacts

      const i = gy * width + gx
      let depositAlpha = (a / 255) * 3000

      // D-08/D-09: Paper-height deposit modulation
      // Valleys (h~0) get full deposit; peaks (h~1) get reduced deposit
      // Floor scales with userOpacity² so 100% opacity → full coverage (no paper holes)
      if (paperHeight) {
        const h = paperHeight[i]
        const wFrac = Math.min(1, wetBuffers.wetness[i] / 1000)
        const adsorption = (1 - wFrac) * (1 - h * gamma) * delta
        const floor = userOpacity * userOpacity  // 100%→1.0, 50%→0.25, 30%→0.09
        depositAlpha *= Math.max(floor, adsorption)
      }

      const existingA = wetBuffers.alpha[i]
      const newA = Math.min(200000, existingA + depositAlpha)

      // D-10: Subtractive RYB mixing when blending with existing paint
      // At full opacity: overwrite color (solid paint covers, no subtractive darkening)
      if (existingA > 1 && userOpacity < 0.99) {
        const blend = depositAlpha / (existingA + depositAlpha)
        const existing: [number, number, number] = [
          wetBuffers.r[i], wetBuffers.g[i], wetBuffers.b[i]
        ]
        const incoming: [number, number, number] = [
          offData[pi], offData[pi + 1], offData[pi + 2]
        ]
        const mixed = mixSubtractive(existing, incoming, blend)
        wetBuffers.r[i] = mixed[0]
        wetBuffers.g[i] = mixed[1]
        wetBuffers.b[i] = mixed[2]
      } else {
        wetBuffers.r[i] = offData[pi]
        wetBuffers.g[i] = offData[pi + 1]
        wetBuffers.b[i] = offData[pi + 2]
      }

      wetBuffers.alpha[i] = newA
      // D-01/D-02: Porter-Duff "over" opacity accumulation
      const existingOp = wetBuffers.strokeOpacity[i]
      wetBuffers.strokeOpacity[i] = existingOp + userOpacity * (1 - existingOp)
      wetBuffers.wetness[i] = Math.min(1000, wetBuffers.wetness[i] + waterAmount * 800 * (a / 255))
    }
  }
}
