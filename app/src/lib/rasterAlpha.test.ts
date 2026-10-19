import { afterEach, describe, expect, it, vi } from 'vitest'
import { isFullyOpaqueRaster, transmittanceToAlpha } from './rasterAlpha'

const PROBE_PIXELS = 64 * 64

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubProbeCanvas(alpha: number, mode: 'ok' | 'null-context' | 'throws' = 'ok') {
  const data = new Uint8ClampedArray(PROBE_PIXELS * 4)
  for (let i = 3; i < data.length; i += 4) data[i] = alpha
  const probeCtx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData:
      mode === 'throws'
        ? vi.fn(() => {
            throw new Error('tainted')
          })
        : vi.fn(() => ({ data })),
  }
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: vi.fn(() => (mode === 'null-context' ? null : probeCtx)),
    })),
  })
  return probeCtx
}

const source = {} as HTMLCanvasElement

describe('isFullyOpaqueRaster', () => {
  it('true when every probed pixel is opaque (aquarelle transmittance)', () => {
    stubProbeCanvas(255)
    expect(isFullyOpaqueRaster(source)).toBe(true)
  })

  it('false when any probed pixel is transparent (engine-1 real alpha)', () => {
    stubProbeCanvas(0)
    expect(isFullyOpaqueRaster(source)).toBe(false)
  })

  it('false when the probe context is unavailable', () => {
    stubProbeCanvas(255, 'null-context')
    expect(isFullyOpaqueRaster(source)).toBe(false)
  })

  it('false when reading pixels throws', () => {
    stubProbeCanvas(255, 'throws')
    expect(isFullyOpaqueRaster(source)).toBe(false)
  })
})

function makeTransmittanceCanvas(data: Uint8ClampedArray): HTMLCanvasElement {
  return {
    width: 1,
    height: 1,
    getContext: () => ({ getImageData: () => ({ data }) }),
  } as unknown as HTMLCanvasElement
}

function stubAlphaOutput(): { written: () => Uint8ClampedArray | null } {
  let written: Uint8ClampedArray | null = null
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        putImageData: (image: { data: Uint8ClampedArray }) => {
          written = image.data
        },
      }),
    }),
  })
  return { written: () => written }
}

describe('transmittanceToAlpha', () => {
  it('white (no pigment) becomes fully transparent', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255])
    const output = stubAlphaOutput()
    expect(transmittanceToAlpha(makeTransmittanceCanvas(data))).not.toBeNull()
    expect(Array.from(output.written()!)).toEqual([0, 0, 0, 0])
  })

  it('keeps the pigment colour with alpha from the least transmitted channel', () => {
    // Magenta transmittance: green is absorbed (51), alpha = 255 - 51.
    const data = new Uint8ClampedArray([255, 51, 255, 255])
    const output = stubAlphaOutput()
    transmittanceToAlpha(makeTransmittanceCanvas(data))
    expect(Array.from(output.written()!)).toEqual([255, 0, 255, 204])
  })

  it('black stays opaque black', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255])
    const output = stubAlphaOutput()
    transmittanceToAlpha(makeTransmittanceCanvas(data))
    expect(Array.from(output.written()!)).toEqual([0, 0, 0, 255])
  })

  it('null when pixels cannot be read', () => {
    stubAlphaOutput()
    const unlucky = { width: 1, height: 1, getContext: () => null } as unknown as HTMLCanvasElement
    expect(transmittanceToAlpha(unlucky)).toBeNull()
  })
})
