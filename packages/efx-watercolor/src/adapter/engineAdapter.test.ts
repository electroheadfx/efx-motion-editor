// ============================================================
//  engineAdapter — tracer behaviors (56-01).
//
//  Five pins on the thinnest end-to-end aquarelle path:
//    1. spectral mix: yellow + blue is green-dominant (subtractive)
//    2. payload round-trip: traceSeed = hashMutationId, cuisson clamp
//    3. E2E deposit: stroke bbox paints, far corner stays transparent
//    4. determinism: two fresh replays are byte-identical
//    5. fail-closed: payloadCodec.parse(malformed) === null, never throws
//
//  Standing-pin family (paintVersionDisciplineContract /
//  hostGenericityRoundTrip) — normal vitest .test.ts, no new config.
// ============================================================

import { describe, expect, it } from 'vitest'
import { hashMutationId } from '@efxlab/efx-paint-host'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import { mixSpectral } from '@efxlab/efx-spectral'
import { createAquarelleEngineAdapter } from './engineAdapter'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import { toStudioStroke, DIFFUSION_CAP } from '../payload/toStudioStroke'
import type { AquarelleStroke } from '../payload/toStudioStroke'

// ---------------------------------------------------------------------------
// Mock canvas — same idiom as app/src/efx-paint/host-split/fakeEngine2Fixture.ts
// ---------------------------------------------------------------------------

interface MockImageData {
  width: number
  height: number
  data: Uint8ClampedArray
}

function makeMockCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement
  pixels: Uint8ClampedArray
} {
  const pixels = new Uint8ClampedArray(width * height * 4)
  const canvasRef: Record<string, unknown> = {
    width,
    height,
    getContext: (id: string) => {
      if (id !== '2d') return null
      return {
        canvas: canvasRef,
        getImageData: (x: number, y: number, w: number, h: number): MockImageData => {
          const out = new Uint8ClampedArray(w * h * 4)
          for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
              const src = ((y + row) * width + (x + col)) * 4
              const dst = (row * w + col) * 4
              out[dst] = pixels[src] ?? 0
              out[dst + 1] = pixels[src + 1] ?? 0
              out[dst + 2] = pixels[src + 2] ?? 0
              out[dst + 3] = pixels[src + 3] ?? 0
            }
          }
          return { width: w, height: h, data: out }
        },
        putImageData: (imageData: MockImageData, x: number, y: number) => {
          for (let row = 0; row < imageData.height; row++) {
            for (let col = 0; col < imageData.width; col++) {
              const src = (row * imageData.width + col) * 4
              const dst = ((y + row) * width + (x + col)) * 4
              pixels[dst] = imageData.data[src] ?? 0
              pixels[dst + 1] = imageData.data[src + 1] ?? 0
              pixels[dst + 2] = imageData.data[src + 2] ?? 0
              pixels[dst + 3] = imageData.data[src + 3] ?? 0
            }
          }
        },
        createImageData: (w: number, h: number): MockImageData => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
      }
    },
  }
  return { canvas: canvasRef as unknown as HTMLCanvasElement, pixels }
}

function alphaAt(pixels: Uint8ClampedArray, width: number, x: number, y: number): number {
  return pixels[(y * width + x) * 4 + 3] ?? 0
}

function frameBytes(frame: CanvasImageSource): Uint8ClampedArray {
  const canvas = frame as HTMLCanvasElement
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('captureFrame did not return a 2d canvas')
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return img.data
}

function makeStrokePayload(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#2244aa',
    params: { size: 12, water: 50, flow: 50 },
    brushId: 'wc/round-medium',
    points: [
      { x: 20, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 28, y: 32, p: 0.6, tx: 0, ty: 0, tw: 0 },
      { x: 36, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 44, y: 32, p: 0.4, tx: 0, ty: 0, tw: 0 },
    ],
    mutationId: 42,
    timestamp: 1000,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. Spectral mix — subtractive, not RGB average
// ---------------------------------------------------------------------------

describe('spectral mix', () => {
  it('yellow + blue returns a green-dominant colour (g > r and g > b)', () => {
    const mixed = mixSpectral([255, 255, 0], [0, 0, 255], 0.5)
    expect(mixed[1]).toBeGreaterThan(mixed[0])
    expect(mixed[1]).toBeGreaterThan(mixed[2])
  })
})

// ---------------------------------------------------------------------------
// 2. Payload round-trip — traceSeed law + cuisson clamp
// ---------------------------------------------------------------------------

describe('toStudioStroke payload round-trip', () => {
  it('projects traceSeed = hashMutationId(mutationId) and clamps cuisson to [0, 600]', () => {
    const runtime = makeStrokePayload({ diffusionFrames: 1200 })
    const projected = toStudioStroke(runtime)

    expect(projected.traceSeed).toBe(hashMutationId(42))
    expect(projected.cuisson).toBe(DIFFUSION_CAP)
    expect(projected.cuisson).toBeGreaterThanOrEqual(0)
    expect(projected.cuisson).toBeLessThanOrEqual(600)

    const adapter = createAquarelleEngineAdapter()
    const reparsed = adapter.payloadCodec.parse(projected)
    expect(reparsed).not.toBeNull()
    expect(reparsed?.traceSeed).toBe(hashMutationId(42))
    expect(reparsed?.cuisson).toBe(DIFFUSION_CAP)

    const zeroCuisson = toStudioStroke(makeStrokePayload({ diffusionFrames: 0 }))
    expect(zeroCuisson.cuisson).toBe(0)

    const clamped = toStudioStroke(makeStrokePayload({ diffusionFrames: 250 }))
    expect(clamped.cuisson).toBe(250)

    adapter.dispose()
  })

  it('serialize/parse round-trips a minimal AquarelleStrokePayload', () => {
    const adapter = createAquarelleEngineAdapter()
    const runtime = makeStrokePayload()
    const projected = toStudioStroke(runtime)
    const reparsed = adapter.payloadCodec.parse(adapter.payloadCodec.serialize(projected))

    expect(reparsed).not.toBeNull()
    expect(reparsed?.engine.brushId).toBe('wc/round-medium')
    expect(reparsed?.engine.tool).toBe('brush')
    expect(reparsed?.traceSeed).toBe(hashMutationId(42))
    expect(reparsed?.pts.length).toBe(4)
    adapter.dispose()
  })
})

// ---------------------------------------------------------------------------
// 3. E2E deposit — painted bbox, transparent far corner
// ---------------------------------------------------------------------------

describe('EngineAdapter E2E', () => {
  it('applyStroke + stepTick + captureFrame paints the stroke bbox and leaves the far corner transparent', () => {
    const width = 64
    const height = 64
    const { canvas } = makeMockCanvas(width, height)

    const adapter = createAquarelleEngineAdapter({ width, height, canvas })
    const stroke = toStudioStroke(makeStrokePayload())

    adapter.applyStroke(stroke)
    for (let tick = 0; tick <= 8; tick++) adapter.stepTick(tick)

    const frame = adapter.captureFrame()
    const pixels = frameBytes(frame)

    // Stroke runs along y=32 from x=20..44 — its bbox must carry alpha.
    let painted = 0
    for (let y = 24; y < 40; y++) {
      for (let x = 16; x < 48; x++) {
        if (alphaAt(pixels, width, x, y) > 0) painted++
      }
    }
    expect(painted).toBeGreaterThan(0)

    // Far corner (opposite the stroke) stays alpha 0 — unpainted pixels untouched.
    expect(alphaAt(pixels, width, 0, 0)).toBe(0)
    expect(alphaAt(pixels, width, width - 1, height - 1)).toBe(0)

    adapter.dispose()
  })
})

// ---------------------------------------------------------------------------
// 4. Determinism — same script ⇒ same pixels
// ---------------------------------------------------------------------------

describe('EngineAdapter determinism', () => {
  it('two fresh applyStroke/stepTick/captureFrame runs produce byte-identical pixels', () => {
    const width = 64
    const height = 64
    const runtime = makeStrokePayload()
    const projected: StudioStroke<AquarelleStrokePayload> = toStudioStroke(runtime)

    const runOnce = (): Uint8ClampedArray => {
      const { canvas } = makeMockCanvas(width, height)
      const adapter = createAquarelleEngineAdapter({ width, height, canvas })
      adapter.applyStroke(projected)
      for (let tick = 0; tick <= 8; tick++) adapter.stepTick(tick)
      const bytes = frameBytes(adapter.captureFrame())
      adapter.dispose()
      return bytes
    }

    const a = runOnce()
    const b = runOnce()
    expect(a.length).toBe(b.length)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. Fail-closed parse
// ---------------------------------------------------------------------------

describe('payloadCodec fail-closed', () => {
  it('parse(malformed) returns null and never throws', () => {
    const adapter = createAquarelleEngineAdapter()
    const malformed: unknown[] = [
      null,
      undefined,
      0,
      'nope',
      {},
      { pts: 'not-an-array' },
      { pts: [], ticks: 'NaN', cuisson: 0, motion: null, brushId: 1, toolOverrides: {}, traceSeed: 1, recordedOrder: 1, playFrame: null, color: null, engine: {} },
      { pts: [{ x: 'bad' }], ticks: 1, cuisson: 0, motion: null, brushId: 'x', toolOverrides: {}, traceSeed: 1, recordedOrder: 1, playFrame: null, color: null, engine: {} },
      { pts: [], ticks: -1, cuisson: 0, motion: null, brushId: 'x', toolOverrides: {}, traceSeed: 1, recordedOrder: 1, playFrame: null, color: null, engine: {} },
    ]

    for (const raw of malformed) {
      expect(() => adapter.payloadCodec.parse(raw)).not.toThrow()
      expect(adapter.payloadCodec.parse(raw)).toBeNull()
    }

    adapter.dispose()
  })
})
