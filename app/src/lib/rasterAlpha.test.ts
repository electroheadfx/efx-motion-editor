import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isFullyOpaqueRaster,
  transmittanceRectToPigmentAlpha,
  transmittanceSourceToPigmentAlpha,
  transmittanceToAlpha,
} from './rasterAlpha'

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

  it('SOFT BORDER: a light wash keeps a small alpha instead of an opaque sheet', () => {
    // 12% neutral absorption (224/255 transmitted) → 12% alpha, not 255.
    const data = new Uint8ClampedArray([224, 224, 224, 255])
    const output = stubAlphaOutput()
    transmittanceToAlpha(makeTransmittanceCanvas(data))
    expect(Array.from(output.written()!)).toEqual([0, 0, 0, 31])
  })
})

function stubConversionDocument(options: {
  probeAlpha?: number
  conversionData?: Uint8ClampedArray
} = {}): {
  written: Uint8ClampedArray[]
  created: Array<{ width: number; height: number; drawn: CanvasImageSource[] }>
} {
  const probeAlpha = options.probeAlpha ?? 255
  const conversionData = options.conversionData ?? new Uint8ClampedArray([255, 51, 255, 255])
  const written: Uint8ClampedArray[] = []
  const created: Array<{ width: number; height: number; drawn: CanvasImageSource[] }> = []
  vi.stubGlobal('document', {
    createElement: vi.fn(() => {
      const element = {
        width: 0,
        height: 0,
        drawn: [] as CanvasImageSource[],
        getContext: vi.fn(() => {
          const probeData = new Uint8ClampedArray(PROBE_PIXELS * 4)
          for (let i = 3; i < probeData.length; i += 4) probeData[i] = probeAlpha
          return {
            clearRect: vi.fn(),
            drawImage: vi.fn((source: CanvasImageSource) => {
              element.drawn.push(source)
            }),
            // The 64×64 probe canvas reports the probed alpha; every other
            // canvas (the draw-in of a non-canvas source) reports its pixels.
            getImageData: vi.fn(() => ({
              data: element.width === 64 && element.height === 64 ? probeData : conversionData,
            })),
            putImageData: vi.fn((image: { data: Uint8ClampedArray }) => {
              written.push(image.data)
            }),
          }
        }),
      }
      created.push(element)
      return element
    }),
  })
  return { written, created }
}

describe('transmittanceSourceToPigmentAlpha', () => {
  it('converts a canvas source and memoizes the result by source identity', () => {
    const source = makeTransmittanceCanvas(new Uint8ClampedArray([255, 51, 255, 255]))
    const { written, created } = stubConversionDocument()

    const converted = transmittanceSourceToPigmentAlpha(source)

    expect(converted).not.toBeNull()
    expect(Array.from(written[0]!)).toEqual([255, 0, 255, 204])
    // Probe + output.
    expect(created).toHaveLength(2)
    // Second call serves the cached canvas — no second probe/conversion.
    expect(transmittanceSourceToPigmentAlpha(source)).toBe(converted)
    expect(written).toHaveLength(1)
  })

  it('returns null (and memoizes it) for a source with real alpha — engine-1 paint is untouched', () => {
    const source = makeTransmittanceCanvas(new Uint8ClampedArray([255, 0, 0, 128]))
    const { created } = stubConversionDocument({ probeAlpha: 128 })

    expect(transmittanceSourceToPigmentAlpha(source)).toBeNull()
    expect(transmittanceSourceToPigmentAlpha(source)).toBeNull()
    // Only the probe canvas — the helper never allocates a conversion canvas
    // for a non-transmittance source.
    expect(created).toHaveLength(1)
  })

  it('draws a non-canvas source (ImageBitmap) into a sized canvas before converting', () => {
    const source = { width: 2, height: 1 } as unknown as CanvasImageSource
    const { written, created } = stubConversionDocument()

    const converted = transmittanceSourceToPigmentAlpha(source)

    expect(converted).not.toBeNull()
    // Probe + draw-in + output.
    expect(created).toHaveLength(3)
    expect(created[1]!.width).toBe(2)
    expect(created[1]!.height).toBe(1)
    expect(created[1]!.drawn).toEqual([source])
    expect(Array.from(written[0]!)).toEqual([255, 0, 255, 204])
  })
})


// ============================================================
//  261028-k03b — the lift preview's dirty-rect conversion.
// ============================================================
describe('transmittanceRectToPigmentAlpha', () => {
  it('converts only the requested rect with the same law', () => {
    class FakeImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    }
    vi.stubGlobal('ImageData', FakeImageData);
    // 2 x 1 sheet: white (no pigment) + magenta (green absorbed at 51).
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      255, 51, 255, 255,
    ]);
    const out = transmittanceRectToPigmentAlpha(data, 2, 1, { x: 1, y: 0, width: 1, height: 1 });
    expect(out).not.toBeNull();
    expect(out!.width).toBe(1);
    expect(Array.from(out!.data)).toEqual([255, 0, 255, 204]);
    // The full rect keeps the transparent white pixel as a zeroed RGBA.
    const full = transmittanceRectToPigmentAlpha(data, 2, 1, { x: 0, y: 0, width: 2, height: 1 });
    expect(Array.from(full!.data.slice(0, 4))).toEqual([0, 0, 0, 0]);
  });

  it('clamps an out-of-bounds rect and refuses an empty one', () => {
    class FakeImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    }
    vi.stubGlobal('ImageData', FakeImageData);
    const data = new Uint8ClampedArray(2 * 2 * 4).fill(255);
    const clamped = transmittanceRectToPigmentAlpha(data, 2, 2, { x: -1, y: -1, width: 4, height: 4 });
    expect(clamped!.width).toBe(2);
    expect(clamped!.height).toBe(2);
    expect(transmittanceRectToPigmentAlpha(data, 2, 2, { x: 5, y: 5, width: 1, height: 1 })).toBeNull();
  });
});
