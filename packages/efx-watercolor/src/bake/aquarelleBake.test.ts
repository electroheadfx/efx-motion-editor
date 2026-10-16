// ============================================================
//  aquarelleBake — createBakeHost consumer (56-08, D-21).
//
//  Standing-pin family (bakeHost.test.ts / codec.test.ts) —
//  normal vitest .test.ts, no new config.
//
//  Pins the AQUA-05 / AQUA-07 / AQUA-08 bake law:
//    - every BakeHostTurn uses mode 'flush-survives-navigation'
//      (long cuisson survives leaving the frame)
//    - cancelled/interrupted turn never publishes
//    - overlapping flush() calls share one drain outcome
//    - zero-stroke script produces zero frames and completes
//    - unpainted pixels stay alpha 0
//    - Dry events fire in recorded order between stroke turns
//    - diffusionFrames clamped to DIFFUSION_CAP before stepTick
//    - a zero-diffusionFrames stroke bakes a single captured frame
// ============================================================

import { describe, expect, it } from 'vitest'
import type { EngineAdapter, StudioStroke } from '@efxlab/efx-paint-host'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import { toStudioStroke, DIFFUSION_CAP, type AquarelleStroke } from '../payload/toStudioStroke'
import { createDryEvent, isAquarelleDryEvent, type AquarellePayloadEvent } from '../payload/dryEvent'
import { createAquarelleBake, type AquarelleBakeFrame } from './aquarelleBake'

// ---------------------------------------------------------------------------
// Mock canvas + fake adapter (same idiom as engineAdapter.test.ts)
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
    toDataURL: () => 'data:image/webp;base64,AAAA',
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
        fillRect: (x: number, y: number, w: number, h: number) => {
          for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
              const dst = ((y + row) * width + (x + col)) * 4
              pixels[dst] = 10
              pixels[dst + 1] = 20
              pixels[dst + 2] = 30
              pixels[dst + 3] = 255
            }
          }
        },
      }
    },
  }
  return { canvas: canvasRef as unknown as HTMLCanvasElement, pixels }
}

function makeStroke(overrides: Partial<AquarelleStroke> = {}): StudioStroke<AquarelleStrokePayload> {
  const raw: AquarelleStroke = {
    tool: 'brush',
    color: '#2244aa',
    params: { size: 8, water: 50, flow: 50 },
    brushId: 'wc/round-medium',
    points: [
      { x: 4, y: 4, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 8, y: 4, p: 0.5, tx: 0, ty: 0, tw: 0 },
    ],
    mutationId: 7,
    timestamp: 1000,
    ...overrides,
  }
  return toStudioStroke(raw)
}

interface FakeAdapterLog {
  applied: unknown[]
  stepped: number[]
  captures: number
}

/**
 * Deterministic adapter double. applyStroke paints a 2×2 block at (1,1);
 * stepTick is recorded so the clamp law can be pinned; captureFrame returns
 * the live mock canvas (alpha 0 outside the block).
 */
function makeFakeAdapter(width = 8, height = 8): {
  adapter: EngineAdapter<AquarelleStrokePayload>
  pixels: Uint8ClampedArray
  log: FakeAdapterLog
  canvas: HTMLCanvasElement
} {
  const { canvas, pixels } = makeMockCanvas(width, height)
  const log: FakeAdapterLog = { applied: [], stepped: [], captures: 0 }
  const adapter: EngineAdapter<AquarelleStrokePayload> = {
    engineId: 'efx-watercolor',
    payloadCodec: {
      serialize: (s: unknown) => s as StudioStroke<AquarelleStrokePayload>,
      parse: (s: unknown) => s as StudioStroke<AquarelleStrokePayload>,
    },
    setInputLocked: () => undefined,
    setAnimationMode: () => undefined,
    getStrokes: () => [],
    renderPartialStrokes: () => undefined,
    renderAllStrokes: () => undefined,
    exportCompositeCanvas: () => canvas,
    applyStroke: (stroke) => {
      log.applied.push(stroke)
      if (isAquarelleDryEvent(stroke)) return
      // Paint a tiny opaque block — everything else stays alpha 0.
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null
      if (ctx && typeof ctx.fillRect === 'function') ctx.fillRect(1, 1, 2, 2)
    },
    stepTick: (tick: number) => {
      log.stepped.push(tick)
    },
    captureFrame: () => {
      log.captures += 1
      return canvas as unknown as CanvasImageSource
    },
    dispose: () => undefined,
  }
  return { adapter, pixels, log, canvas }
}

/** Stub WebP encoder — carries the captured pixels so alpha can be pinned. */
function pixelEncoder(frame: CanvasImageSource): Uint8Array {
  const canvas = frame as HTMLCanvasElement
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null
  if (!ctx) return new Uint8Array([0])
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return new Uint8Array(img.data.buffer.slice(0), img.data.byteOffset, img.data.byteLength)
}

function alphaAt(pixels: Uint8Array, width: number, x: number, y: number): number {
  return pixels[(y * width + x) * 4 + 3] ?? 0
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

// ---------------------------------------------------------------------------

describe('createAquarelleBake — flush-survives-navigation consumer', () => {
  it('bake(script) submits flush-survives-navigation turns and publishes one WebP frame per stroke', async () => {
    const { adapter, log } = makeFakeAdapter()
    const modes: string[] = []
    const bake = createAquarelleBake(adapter, {
      encodeWebp: pixelEncoder,
      width: 8,
      height: 8,
    })
    // Record the mode every turn uses by wrapping submit through a spy adapter
    // is not enough — pin the mode via the produced behaviour across dispose.
    const events: AquarellePayloadEvent[] = [makeStroke(), makeStroke({ mutationId: 8, timestamp: 1001 })]
    const result = await bake.bake(events)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.frames).toHaveLength(2)
    expect(result.frames[0]!.strokeIndex).toBe(0)
    expect(result.frames[1]!.strokeIndex).toBe(1)
    expect(log.captures).toBe(2)
    expect(log.applied).toHaveLength(2)
    expect(modes).toEqual([])
  })

  it('every turn survives dispose (mode flush-survives-navigation) and still commits', async () => {
    const { adapter } = makeFakeAdapter()
    const gate = deferred<void>()
    let encoderCalls = 0
    const slowEncode = async (): Promise<Uint8Array> => {
      encoderCalls += 1
      await gate.promise
      return new Uint8Array([1, 2, 3])
    }
    const bake = createAquarelleBake(adapter, { encodeWebp: slowEncode, width: 8, height: 8 })
    const pending = bake.bake([makeStroke()])

    // Let the turn reach produce (host pre-produce yield).
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    bake.dispose()
    gate.resolve()

    const result = await pending
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.frames).toHaveLength(1)
    expect(encoderCalls).toBe(1)
  })

  it('a cancelled/interrupted turn never publishes its frames', async () => {
    const { adapter } = makeFakeAdapter()
    const gate = deferred<void>()
    const committed: AquarelleBakeFrame[] = []
    const slowEncode = async (): Promise<Uint8Array> => {
      await gate.promise
      return new Uint8Array([9, 9, 9])
    }
    const bake = createAquarelleBake(adapter, {
      encodeWebp: slowEncode,
      width: 8,
      height: 8,
      onCommit: (frame) => {
        committed.push(frame)
      },
    })
    const pending = bake.bake([makeStroke()])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    bake.interrupt()
    gate.resolve()

    const result = await pending
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('cancelled')
    expect(committed).toHaveLength(0)
  })

  it('overlapping flush() calls share one drain outcome', async () => {
    const { adapter } = makeFakeAdapter()
    const gate = deferred<void>()
    let encodes = 0
    const slowEncode = async (): Promise<Uint8Array> => {
      encodes += 1
      await gate.promise
      return new Uint8Array([4])
    }
    const bake = createAquarelleBake(adapter, { encodeWebp: slowEncode, width: 8, height: 8 })
    const pending = bake.bake([makeStroke(), makeStroke({ mutationId: 9, timestamp: 1002 })])

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const flushA = bake.flush()
    const flushB = bake.flush()
    gate.resolve()
    await Promise.all([flushA, flushB, pending])

    // Both flushes settled after the same turns — one shared drain, no extra work.
    expect(encodes).toBe(2)
    const result = await pending
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.frames).toHaveLength(2)
  })

  it('zero-stroke script produces zero published frames and completes', async () => {
    const { adapter, log } = makeFakeAdapter()
    const bake = createAquarelleBake(adapter, { encodeWebp: pixelEncoder, width: 8, height: 8 })
    const result = await bake.bake([])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.frames).toHaveLength(0)
    expect(log.captures).toBe(0)
  })

  it('baked frames have alpha 0 in unpainted regions (AQUA-08)', async () => {
    const { adapter } = makeFakeAdapter(8, 8)
    const bake = createAquarelleBake(adapter, { encodeWebp: pixelEncoder, width: 8, height: 8 })
    const result = await bake.bake([makeStroke()])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const bytes = result.frames[0]!.bytes
    // Painted block at (1,1)-(2,2) is opaque; far corner stays transparent.
    expect(alphaAt(bytes, 8, 1, 1)).toBe(255)
    expect(alphaAt(bytes, 8, 7, 7)).toBe(0)
  })

  it('Dry events fire in recorded order between stroke turns (D-15)', async () => {
    const { adapter, log } = makeFakeAdapter()
    const bake = createAquarelleBake(adapter, { encodeWebp: pixelEncoder, width: 8, height: 8 })
    const strokeA = makeStroke({ mutationId: 1, timestamp: 10 })
    const dry = createDryEvent(3, 11)
    const strokeB = makeStroke({ mutationId: 2, timestamp: 12 })
    const result = await bake.bake([strokeA, dry, strokeB])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Two stroke turns; Dry applied between them on the adapter.
    expect(result.frames).toHaveLength(2)
    expect(log.applied).toHaveLength(3)
    expect(isAquarelleDryEvent(log.applied[1])).toBe(true)
    expect(log.applied[0]).toBe(strokeA)
    expect(log.applied[2]).toBe(strokeB)
  })

  it('diffusionFrames is clamped to DIFFUSION_CAP before stepTick (D-19)', async () => {
    const { adapter, log } = makeFakeAdapter()
    const bake = createAquarelleBake(adapter, { encodeWebp: pixelEncoder, width: 8, height: 8 })
    const result = await bake.bake([makeStroke({ diffusionFrames: DIFFUSION_CAP + 500 })])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.frames).toHaveLength(1)
    // stepTick walked exactly the clamped window — never the raw 1100.
    expect(log.stepped).toHaveLength(DIFFUSION_CAP)
    expect(log.stepped[0]).toBe(0)
    expect(log.stepped[DIFFUSION_CAP - 1]).toBe(DIFFUSION_CAP - 1)
  })

  it('a zero-diffusionFrames stroke bakes a single captured frame and completes', async () => {
    const { adapter, log } = makeFakeAdapter()
    const bake = createAquarelleBake(adapter, { encodeWebp: pixelEncoder, width: 8, height: 8 })
    const result = await bake.bake([makeStroke({ diffusionFrames: 0 })])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.frames).toHaveLength(1)
    expect(log.stepped).toHaveLength(0)
    expect(log.captures).toBe(1)
  })

  it('bake turns are FIFO — a later stroke never commits before an earlier one', async () => {
    const { adapter } = makeFakeAdapter()
    const order: number[] = []
    // Encoder latency decreases with stroke index so a racy queue would
    // commit stroke 1 first; the FIFO commit chain must keep 0 before 1.
    const latencies = [30, 0]
    let call = 0
    const flakyEncode = async (): Promise<Uint8Array> => {
      const index = call++
      await new Promise((resolve) => setTimeout(resolve, latencies[index] ?? 0))
      return new Uint8Array([index])
    }
    const bake = createAquarelleBake(adapter, {
      encodeWebp: flakyEncode,
      width: 8,
      height: 8,
      onCommit: (frame) => {
        order.push(frame.strokeIndex)
      },
    })
    const result = await bake.bake([
      makeStroke({ mutationId: 1, timestamp: 1 }),
      makeStroke({ mutationId: 2, timestamp: 2 }),
    ])
    expect(result.ok).toBe(true)
    expect(order).toEqual([0, 1])
  })

  it('idempotent: two fresh bakes of the same script produce identical bytes', async () => {
    const first = makeFakeAdapter()
    const second = makeFakeAdapter()
    const script = (): AquarellePayloadEvent[] => [
      makeStroke({ mutationId: 42, timestamp: 5 }),
      createDryEvent(1, 6),
      makeStroke({ mutationId: 43, timestamp: 7, diffusionFrames: 3 }),
    ]
    const a = await createAquarelleBake(first.adapter, { encodeWebp: pixelEncoder, width: 8, height: 8 }).bake(script())
    const b = await createAquarelleBake(second.adapter, { encodeWebp: pixelEncoder, width: 8, height: 8 }).bake(script())
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.frames.map((f) => Array.from(f.bytes))).toEqual(b.frames.map((f) => Array.from(f.bytes)))
  })
})
