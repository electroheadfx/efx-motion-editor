// ============================================================
//  raster.ts — FluidSheet → display pixels (56-11).
//
//  sheetToBytes (fluid.ts) is the determinism byte view.
//  THIS module is the display raster: composite mobile + fixed
//  pigment into RGBA. Unpainted pixels stay alpha 0 (AQUA-08 /
//  A5 export law). Pure — no DOM — so pins stay host-free.
//
//  Compositing is the transparent-glaze model (Beer–Lambert):
//  coverage saturates softly with pigment density so a wash stays
//  translucent and paper reads through it, and a heavy deposit
//  darkens the pigment instead of turning into flat plastic.
// ============================================================

import { WET_EPS, MAX_DENSITY, type FluidSheet } from './fluid'

function clampByte(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0
  return v >= 255 ? 255 : Math.round(v)
}

/** Density → coverage curve. 1.0 density ≈ 0.65 coverage (translucent wash). */
const ABSORB = 1.05
/** Extra darkening per unit density above 1 (layering / glazing). */
const GLAZE_SHADE = 0.26
/** Wet paint reads darker than dry — applied only in the live wet view. */
const WET_DARKEN = 0.18
/** Damp-paper sheen (no pigment) — a faint cool tint, never grey paint. */
const DAMP_ALPHA = 0.08

/**
 * Composite the sheet into RGBA (width*height*4).
 * Colour = total colour mass / total pigment density.
 * Coverage follows Beer–Lambert so paint stays translucent.
 * Alpha 0 where pigment density is 0.
 */
export function sheetToRgba(sheet: FluidSheet, showWet = false): Uint8ClampedArray {
  const n = sheet.width * sheet.height
  const out = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    const density = (sheet.mobile[i] ?? 0) + (sheet.fixed[i] ?? 0)
    const o = i * 4
    const wet = sheet.wet[i] ?? 0
    if (density <= 1e-6) {
      const wetShow = showWet ? wet : 0
      if (wetShow > WET_EPS) {
        // Damp paper only — a faint cool sheen so Water reads as wet,
        // never as grey pigment. Baked export stays alpha 0 (A5).
        out[o] = 195
        out[o + 1] = 205
        out[o + 2] = 215
        out[o + 3] = clampByte(255 * Math.min(1, wetShow) * DAMP_ALPHA)
      } else {
        out[o] = 0
        out[o + 1] = 0
        out[o + 2] = 0
        out[o + 3] = 0
      }
      continue
    }
    const r = ((sheet.mobileR[i] ?? 0) + (sheet.fixedR[i] ?? 0)) / density
    const g = ((sheet.mobileG[i] ?? 0) + (sheet.fixedG[i] ?? 0)) / density
    const b = ((sheet.mobileB[i] ?? 0) + (sheet.fixedB[i] ?? 0)) / density
    // Clamp at the visual ceiling too — the buffer can be hand-loaded
    // by tests/undo, and the look law is absolute: never opaque paint.
    const d = Math.min(density, MAX_DENSITY)
    // Glaze: heavier deposit darkens the pigment (hue preserved at density 1).
    const shade = Math.exp(-Math.max(0, d - 1) * GLAZE_SHADE)
    // Wet paint reads slightly darker in the live view only.
    const wetShade = showWet ? 1 - Math.min(1, wet) * WET_DARKEN : 1
    const k = shade * wetShade
    out[o] = clampByte(r * k)
    out[o + 1] = clampByte(g * k)
    out[o + 2] = clampByte(b * k)
    // Beer–Lambert coverage — soft saturation, never a hard plastic cap.
    out[o + 3] = clampByte(255 * (1 - Math.exp(-d * ABSORB)))
  }
  return out
}

/** Minimal 2d surface — createImageData so putImageData gets a real ImageData (WebKit rejects bags). */
type SheetRasterContext = {
  createImageData(w: number, h: number): { width: number; height: number; data: Uint8ClampedArray }
  putImageData(
    imageData: { width: number; height: number; data: Uint8ClampedArray },
    x: number,
    y: number,
  ): void
}

/** Draw the sheet raster onto a 2d canvas. Unpainted pixels are cleared to alpha 0. */
export function drawSheetToCanvas(
  sheet: FluidSheet,
  canvas: { getContext(id: '2d'): SheetRasterContext | null },
  options?: { showWet?: boolean },
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rgba = sheetToRgba(sheet, options?.showWet ?? false)
  // WebKit rejects a plain {width,height,data} bag — putImageData needs a real ImageData.
  const imageData = ctx.createImageData(sheet.width, sheet.height)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)
}
