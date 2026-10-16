// ============================================================
//  raster.ts — FluidSheet → display pixels (56-11).
//
//  sheetToBytes (fluid.ts) is the determinism byte view.
//  THIS module is the display raster: composite mobile + fixed
//  pigment into RGBA. Unpainted pixels stay alpha 0 (AQUA-08 /
//  A5 export law). Pure — no DOM — so pins stay host-free.
// ============================================================

import type { FluidSheet } from './fluid'
import type { DepositCanvas } from './deposit'

function clampByte(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0
  return v >= 255 ? 255 : Math.round(v)
}

/**
 * Composite the sheet into RGBA (width*height*4).
 * Colour = total colour mass / total pigment density.
 * Alpha 0 where pigment density is 0.
 */
export function sheetToRgba(sheet: FluidSheet): Uint8ClampedArray {
  const n = sheet.width * sheet.height
  const out = new Uint8ClampedArray(n * 4)
  for (let i = 0; i < n; i++) {
    const density = (sheet.mobile[i] ?? 0) + (sheet.fixed[i] ?? 0)
    const o = i * 4
    if (density <= 1e-6) {
      out[o] = 0
      out[o + 1] = 0
      out[o + 2] = 0
      out[o + 3] = 0
      continue
    }
    const r = ((sheet.mobileR[i] ?? 0) + (sheet.fixedR[i] ?? 0)) / density
    const g = ((sheet.mobileG[i] ?? 0) + (sheet.fixedG[i] ?? 0)) / density
    const b = ((sheet.mobileB[i] ?? 0) + (sheet.fixedB[i] ?? 0)) / density
    out[o] = clampByte(r)
    out[o + 1] = clampByte(g)
    out[o + 2] = clampByte(b)
    out[o + 3] = clampByte(255 * Math.min(1, density))
  }
  return out
}

/** Draw the sheet raster onto a 2d canvas. Unpainted pixels are cleared to alpha 0. */
export function drawSheetToCanvas(sheet: FluidSheet, canvas: HTMLCanvasElement | DepositCanvas): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rgba = sheetToRgba(sheet)
  ctx.putImageData(
    { width: sheet.width, height: sheet.height, data: rgba } as unknown as ImageData,
    0,
    0,
  )
}
