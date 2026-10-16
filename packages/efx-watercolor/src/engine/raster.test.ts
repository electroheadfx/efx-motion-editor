import { describe, expect, it } from 'vitest'
import { createSheet } from './fluid'
import { sheetToRgba, drawSheetToCanvas } from './raster'

function setPixel(
  sheet: ReturnType<typeof createSheet>,
  x: number,
  y: number,
  values: {
    mobile?: number
    fixed?: number
    mobileR?: number
    mobileG?: number
    mobileB?: number
    fixedR?: number
    fixedG?: number
    fixedB?: number
  },
): void {
  const i = y * sheet.width + x
  if (values.mobile !== undefined) sheet.mobile[i] = values.mobile
  if (values.fixed !== undefined) sheet.fixed[i] = values.fixed
  if (values.mobileR !== undefined) sheet.mobileR[i] = values.mobileR
  if (values.mobileG !== undefined) sheet.mobileG[i] = values.mobileG
  if (values.mobileB !== undefined) sheet.mobileB[i] = values.mobileB
  if (values.fixedR !== undefined) sheet.fixedR[i] = values.fixedR
  if (values.fixedG !== undefined) sheet.fixedG[i] = values.fixedG
  if (values.fixedB !== undefined) sheet.fixedB[i] = values.fixedB
}

function rgbaAt(bytes: Uint8ClampedArray, width: number, x: number, y: number): [number, number, number, number] {
  const i = (y * width + x) * 4
  return [bytes[i] ?? 0, bytes[i + 1] ?? 0, bytes[i + 2] ?? 0, bytes[i + 3] ?? 0]
}

describe('sheetToRgba', () => {
  it('returns alpha 0 for every unpainted pixel', () => {
    const sheet = createSheet(8, 8)
    const rgba = sheetToRgba(sheet)
    expect(rgba.length).toBe(8 * 8 * 4)
    for (let i = 3; i < rgba.length; i += 4) {
      expect(rgba[i]).toBe(0)
    }
  })

  it('carries the deposited hue from colour mass / density', () => {
    const sheet = createSheet(4, 4)
    setPixel(sheet, 1, 1, {
      mobile: 1,
      mobileR: 34 * 1,
      mobileG: 68 * 1,
      mobileB: 170 * 1,
    })
    const rgba = sheetToRgba(sheet)
    const [r, g, b, a] = rgbaAt(rgba, 4, 1, 1)
    expect(a).toBeGreaterThan(0)
    expect(Math.abs(r - 34)).toBeLessThanOrEqual(1)
    expect(Math.abs(g - 68)).toBeLessThanOrEqual(1)
    expect(Math.abs(b - 170)).toBeLessThanOrEqual(1)
    expect(rgbaAt(rgba, 4, 0, 0)[3]).toBe(0)
  })

  it('is deterministic — same sheet state yields identical bytes', () => {
    const build = () => {
      const sheet = createSheet(6, 6)
      setPixel(sheet, 2, 3, {
        mobile: 0.5,
        fixed: 0.25,
        mobileR: 100 * 0.5,
        mobileG: 50 * 0.5,
        mobileB: 25 * 0.5,
        fixedR: 100 * 0.25,
        fixedG: 50 * 0.25,
        fixedB: 25 * 0.25,
      })
      return sheetToRgba(sheet)
    }
    expect(Buffer.from(build()).equals(Buffer.from(build()))).toBe(true)
  })
})

describe('drawSheetToCanvas', () => {
  it('writes the sheet raster onto a 2d canvas, leaving unpainted pixels alpha 0', () => {
    const sheet = createSheet(4, 4)
    setPixel(sheet, 2, 2, {
      mobile: 1,
      mobileR: 200,
      mobileG: 40,
      mobileB: 40,
    })

    let written: Uint8ClampedArray | null = null
    const canvas = {
      width: 4,
      height: 4,
      getContext: (id: string) => {
        if (id !== '2d') return null
        return {
          putImageData: (imageData: { width: number; height: number; data: Uint8ClampedArray }) => {
            written = imageData.data
          },
          createImageData: (w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4),
          }),
        }
      },
    } as unknown as HTMLCanvasElement

    drawSheetToCanvas(sheet, canvas)

    expect(written).not.toBeNull()
    const rgba = written!
    const [r, , , a] = rgbaAt(rgba, 4, 2, 2)
    expect(a).toBeGreaterThan(0)
    expect(Math.abs(r - 200)).toBeLessThanOrEqual(1)
    expect(rgbaAt(rgba, 4, 0, 0)[3]).toBe(0)
  })
})
