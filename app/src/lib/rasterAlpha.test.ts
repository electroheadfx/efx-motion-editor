import { afterEach, describe, expect, it, vi } from 'vitest'
import { isFullyOpaqueRaster } from './rasterAlpha'

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
