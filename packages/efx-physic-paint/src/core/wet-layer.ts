// ============================================================
//  Wet Layer Buffer Operations
//  Extracted from efx-paint-physic-v3.html lines 755-919, 2559
//  All buffers are passed as arguments — no module-level mutable state.
//  No DOM access in this module.
// ============================================================

import type { WetBuffers, SavedWetBuffers, TmpBuffers, PenPoint, PaintPrimitiveTimingObserver } from '../types'
import { lerp } from '../util/math'

function measurePrimitive<T>(observer: PaintPrimitiveTimingObserver | undefined, stage: string, run: () => T): T {
  if (!observer) return run()
  const startedAt = performance.now()
  try {
    return run()
  } finally {
    observer(stage, performance.now() - startedAt)
  }
}

/**
 * Boundary anti-aliasing on the wet layer within bounds (R8 envelope law,
 * 260930-dy0 — the R7(c) companion at the wet layer).
 *
 * AA of the EXISTING boundary only: painted pixels with at least one empty
 * orthogonal neighbor blend their alpha toward the 4-neighbor mean (empty
 * neighbors contribute 0) at frac 0.35. Pixels with four painted neighbors
 * are untouched; every pre-empty pixel is never read for write and never
 * written — no alpha, no color, no wetness, no strokeOpacity, no halo.
 * This is NOT an outward grower: the silhouette cannot widen here.
 * @param passes - Number of AA passes (1=soft, 2=med, 3=high)
 */
export function featherWetEdges(
  wet: WetBuffers,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number,
  passes: number,
  observePrimitive?: PaintPrimitiveTimingObserver,
): void {
  const x0 = Math.max(1, bounds.x0)
  const y0 = Math.max(1, bounds.y0)
  const x1 = Math.min(width - 2, bounds.x1)
  const y1 = Math.min(height - 2, bounds.y1)

  for (let pass = 0; pass < passes; pass++) {
    measurePrimitive(observePrimitive, 'paint-edge-feather-pass', () => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * width + x
          const a = wet.alpha[i]
          if (a <= 1) continue // empty pixels are never written (no grower)

          const neighbors = [i - 1, i + 1, i - width, i + width]
          let sum = 0
          let empty = 0
          for (const ni of neighbors) {
            const na = wet.alpha[ni]
            if (na <= 1) empty++
            sum += na
          }
          if (empty === 0) continue // deep interior — untouched

          // Alpha-only boundary AA toward the 4-neighbor mean (empty = 0).
          const mean4 = sum / 4
          wet.alpha[i] = a + 0.35 * (mean4 - a)
        }
      }
    })
  }
}

/**
 * Full-frame pre-solver wet-alpha snapshot — the R8 pressure envelope.
 * Take it strictly BEFORE the solver runs; projectWetIntoEnvelope applies
 * the hard ceiling strictly AFTER (a reversed order snapshots the grown
 * state and legitimizes the growth).
 */
export function snapshotWetAlpha(wet: WetBuffers): Float32Array {
  return wet.alpha.slice()
}

/**
 * R8 envelope law (USER DESIGN ACT 2026-09-30): the pressure-defined stroke
 * thickness is the MAXIMUM thickness. Mass the solver grew past the
 * pre-solver envelope is renormalized back inside — interior contrast rises,
 * width does not. Accepted tradeoff (spec 01 R8): a hard envelope removes
 * watercolour bleed past the stroke (capillary wicking); if wanted later it
 * is a separate gesture-driven lever in 52.5, never a passive spread growth.
 */
export function projectWetIntoEnvelope(wet: WetBuffers, envelope: Float32Array): void {
  const n = envelope.length
  const escaped: number[] = []
  let escapedTotal = 0
  for (let i = 0; i < n; i++) {
    if (envelope[i] <= 1 && wet.alpha[i] > 1) {
      escaped.push(i)
      escapedTotal += wet.alpha[i]
    }
  }
  if (escapedTotal <= 0) return // identity — zero writes, no float drift

  let interiorSum = 0
  const interior: number[] = []
  for (let i = 0; i < n; i++) {
    if (envelope[i] > 1 && wet.alpha[i] > 1) {
      interior.push(i)
      interiorSum += wet.alpha[i]
    }
  }
  if (interiorSum > 0) {
    for (const i of interior) {
      wet.alpha[i] = Math.min(200000, wet.alpha[i] + escapedTotal * (wet.alpha[i] / interiorSum))
    }
  }
  // The ceiling is hard: escaped pixels are zeroed even if there is no
  // interior to renormalize onto.
  for (const i of escaped) {
    wet.alpha[i] = 0
    wet.wetness[i] = 0
    wet.strokeOpacity[i] = 0
  }
}

/**
 * Stamp the geometric pressure ribbon into an envelope mask (R8 revised,
 * 260930-espace — the envelope is a ROOM, not a clip). Nonzero-winding
 * scanline fill of `poly` (the `ribbonWithScales` outline at FULL pressure
 * width). Pixels inside get `mark` (default 2 — the `> 1` inside test of
 * projectWetIntoEnvelope); pixels outside are NEVER touched, so an envelope
 * built from `snapshotWetAlpha` keeps grandfathering earlier strokes' mass
 * (the room is `union(pre-solver mass, this stroke's ribbon)`).
 */
export function stampRibbonIntoEnvelope(
  envelope: Float32Array,
  poly: Array<[number, number]>,
  width: number,
  height: number,
  mark: number = 2,
): void {
  const n = poly.length
  if (n < 3) return
  let minY = Infinity, maxY = -Infinity
  let minX = Infinity, maxX = -Infinity
  for (let k = 0; k < n; k++) {
    const [x, y] = poly[k]
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  const y0 = Math.max(0, Math.floor(minY))
  const y1 = Math.min(height - 1, Math.ceil(maxY))
  const x0 = Math.max(0, Math.floor(minX))
  const x1 = Math.min(width - 1, Math.ceil(maxX))
  const crossings: Array<{ x: number; dir: number }> = []
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5
    crossings.length = 0
    for (let k = 0; k < n; k++) {
      const ax = poly[k][0], ay = poly[k][1]
      const bx = poly[(k + 1) % n][0], by = poly[(k + 1) % n][1]
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
        const t = (yc - ay) / (by - ay)
        crossings.push({ x: ax + (bx - ax) * t, dir: by > ay ? 1 : -1 })
      }
    }
    if (crossings.length < 2) continue
    crossings.sort((a, b) => a.x - b.x)
    let winding = 0
    for (let k = 0; k < crossings.length - 1; k++) {
      winding += crossings[k].dir
      if (winding === 0) continue
      const sx = Math.max(x0, Math.ceil(crossings[k].x - 0.5))
      const ex = Math.min(x1, Math.floor(crossings[k + 1].x - 0.5))
      for (let x = sx; x <= ex; x++) envelope[y * width + x] = mark
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
 * Deposit keep-gate for transferToWetLayerClipped (260924-rm2).
 *
 * Include/exclude ONLY at the deposit gate: raster pixels with alpha
 * below this tier never run; included pixels keep the exact base
 * deposit math `(a / 255) * 3000` and the untouched D-08 paper
 * adsorption, D-09 granulation, D-10 subtractive mixing, wetness
 * write, and strokeOpacity. NEVER scale depositAlpha, wetness, or
 * strokeOpacity with waterAmount, with tier, or with any other
 * parameter (m7w failure 24f40261 / revert 1648658b: alpha-carry
 * modulation produced a quasi-invisible stroke).
 *
 * Tier per the 260924-pyp OUTCOME TABLE (production continuous AA
 * raster, 24 cells): tier 70 holds envelope W_visible <= 8 at default
 * water with texture d(b) = 1-2 at all waters/papers (tier 130 =
 * fallback only, same envelope); tier 200 is FORBIDDEN (proven hard
 * stamp, d(b) = 0); base tier 20 fails the envelope on null paper
 * (W_visible 9 > 8). Body plateau (~244) stays far above the gate —
 * PIN 0 / PIN 0b assert zero body movement in both harnesses.
 */
const DEPOSIT_KEEP_TIER = 70

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
  observePrimitive?: PaintPrimitiveTimingObserver,
): void {
  const offData = measurePrimitive(observePrimitive, 'paint-transfer-readback', () => offCtx.getImageData(0, 0, bounds.w, bounds.h)).data

  measurePrimitive(observePrimitive, 'paint-transfer-pixel-loop', () => {
  for (let ly = 0; ly < bounds.h; ly++) {
    const gy = bounds.y + ly
    if (gy < 0 || gy >= height) continue
    for (let lx = 0; lx < bounds.w; lx++) {
      const gx = bounds.x + lx
      if (gx < 0 || gx >= width) continue
      const pi = (ly * bounds.w + lx) * 4
      const a = offData[pi + 3]
      if (a < DEPOSIT_KEEP_TIER) continue  // 260924-rm2 deposit keep-gate: include/exclude only, never alpha modulation (filters bristle trace + AA edge artifacts)

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
  })
}
