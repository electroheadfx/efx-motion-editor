// ============================================================
//  engineAdapter — tracer behaviors (56-01 / 56-12).
//
//  Pins on the thinnest end-to-end aquarelle path:
//    1. spectral mix: yellow + blue is green-dominant (subtractive)
//    2. payload round-trip: traceSeed = hashMutationId, cuisson clamp
//    3. fail-closed: payloadCodec.parse(malformed) === null, never throws
//
//  GPU pins (E2E deposit, determinism A2, stepping law) need a real
//  WebGL2 context — vitest is blind there (project law
//  `feedback_live_evidence_over_unit_probes`). They run only when
//  WebGL2 is present and close on live/disk UAT A1/A2 otherwise.
//
//  Standing-pin family (paintVersionDisciplineContract /
//  hostGenericityRoundTrip) — normal vitest .test.ts, no new config.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { hashMutationId, mixStrokeSeed } from '@efxlab/efx-paint-host'
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation'
import { mixSpectral } from '@efxlab/efx-spectral'
import {
  createAquarelleEngineAdapter,
  resolveBakePaperPreset,
  resolveStrokeWidthFactors,
} from './engineAdapter'
import { PAPERS } from '../playground/papers'
import { BRUSH_PRESETS } from '../playground/brushes'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import { toStudioStroke, DIFFUSION_CAP } from '../payload/toStudioStroke'
import type { AquarelleStroke } from '../payload/toStudioStroke'
import type { AquarelleAnchor } from '../payload/vectorPath'
import * as VectorPathModule from '../payload/vectorPath'
import { ANCHOR_WIDTH_DEFAULT, ANCHOR_WIDTH_MAX, ANCHOR_WIDTH_MIN } from '../vector/spine'

// ---------------------------------------------------------------------------
// WebGL2 gate — GPU pins skip cleanly when the context cannot exist.
// ---------------------------------------------------------------------------

function hasWebGL2(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    return Boolean(gl && (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')))
  } catch {
    return false
  }
}

const gpu = hasWebGL2()

// ---------------------------------------------------------------------------
// Canvas helper — a real canvas for GPU runs, a 2d stub otherwise.
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

function makeSurface(width: number, height: number): HTMLCanvasElement {
  if (gpu && typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return c
  }
  return makeMockCanvas(width, height).canvas
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
      { x: 0.3, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 0.4, y: 0.5, p: 0.6, tx: 0, ty: 0, tw: 0 },
      { x: 0.5, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 0.6, y: 0.5, p: 0.4, tx: 0, ty: 0, tw: 0 },
    ],
    mutationId: 42,
    timestamp: 1000,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. Spectral mix — subtractive, not RGB average
// ---------------------------------------------------------------------------

describe('resolveBakePaperPreset (261027 UAT round 9)', () => {
  // On-disk evidence: the live sheet painted on 'paper/toned-sand' (preset
  // 'toned') while every Move/Apply bake resolved the same Studio id to
  // 'cold'. The two sheets' tooth differed, and the re-bake lost most of the
  // wash density the artist saw.
  const host = PAPERS.find((preset) => preset.id === 'toned')!
  const paper = { paperId: 'paper/toned-sand', grainStrength: 0.35, grainScale: 1 }

  it('uses the host-resolved preset for a Studio paper id instead of cold', () => {
    expect(resolveBakePaperPreset(paper, host)).toBe(host)
  })

  it('prefers a matching vendor preset id over the host preset', () => {
    const cold = PAPERS.find((preset) => preset.id === 'cold')!
    expect(resolveBakePaperPreset({ ...paper, paperId: 'cold' }, host)).toBe(cold)
  })

  it('falls back to the host preset when no paper rides the bake, and to the default for an unknown id', () => {
    expect(resolveBakePaperPreset(undefined, host)).toBe(host)
    expect(resolveBakePaperPreset(paper)).toBe(PAPERS[0])
  })
})

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
    const reparsed = adapter.payloadCodec.parse(adapter.payloadCodec.serialize(projected))
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

  it('payload stores CANONICAL AQUA-04 globals, not mapped 0..1 values', () => {
    const adapter = createAquarelleEngineAdapter()
    const runtime = makeStrokePayload({
      params: { size: 12, water: 50, load: 50, flow: 50, bleed: 50, dry: 50, edge: 50, granulation: 50 },
    })
    const projected = toStudioStroke(runtime)
    const reparsed = adapter.payloadCodec.parse(adapter.payloadCodec.serialize(projected))

    // Canonical: size is 1..400 px, the rest 0..100. Mapped would be 0..1.
    expect(reparsed?.engine.params['size']).toBe(12)
    expect(reparsed?.engine.params['water']).toBe(50)
    expect(reparsed?.engine.params['load']).toBe(50)
    expect(reparsed?.engine.params['granulation']).toBe(50)
    adapter.dispose()
  })
})

// ---------------------------------------------------------------------------
// 3. Fail-closed parse
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

// ---------------------------------------------------------------------------
// 4. GPU pins — E2E deposit, determinism (A2), stepping law.
//    Skipped without WebGL2; close on live/disk UAT A1/A2.
// ---------------------------------------------------------------------------

describe.skipIf(!gpu)('EngineAdapter GPU (WebGL2 required)', () => {
  it('applyStroke + stepTick + captureFrame paints the stroke and leaves the far corner transparent (A5)', () => {
    const width = 64
    const height = 64
    const canvas = makeSurface(width, height)

    const adapter = createAquarelleEngineAdapter({ width, height, canvas })
    adapter.applyStroke(toStudioStroke(makeStrokePayload()))
    for (let tick = 0; tick <= 8; tick++) adapter.stepTick(tick)

    const pixels = frameBytes(adapter.captureFrame())

    let painted = 0
    for (let y = 24; y < 40; y++) {
      for (let x = 16; x < 48; x++) {
        if (alphaAt(pixels, width, x, y) > 0) painted++
      }
    }
    expect(painted).toBeGreaterThan(0)

    expect(alphaAt(pixels, width, 0, 0)).toBe(0)
    expect(alphaAt(pixels, width, width - 1, height - 1)).toBe(0)

    adapter.dispose()
  })

  it('two fresh applyStroke/stepTick/captureFrame runs produce byte-identical pixels (A2)', () => {
    const width = 64
    const height = 64
    const projected: StudioStroke<AquarelleStrokePayload> = toStudioStroke(makeStrokePayload())

    const runOnce = (): Uint8ClampedArray => {
      const canvas = makeSurface(width, height)
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

  it('stepTick advances the sim after applyStroke (one stepping law)', () => {
    const width = 64
    const height = 64
    const canvas = makeSurface(width, height)
    const adapter = createAquarelleEngineAdapter({ width, height, canvas })

    adapter.applyStroke(toStudioStroke(makeStrokePayload({ mutationId: 7, timestamp: 1 })))
    const afterDeposit = frameBytes(adapter.captureFrame())

    for (let tick = 0; tick < 12; tick++) adapter.stepTick(tick)
    const afterSteps = frameBytes(adapter.captureFrame())

    expect(Buffer.from(afterDeposit).equals(Buffer.from(afterSteps))).toBe(false)
    expect(alphaAt(afterSteps, width, 0, 0)).toBe(0)
    adapter.dispose()
  })

  it('a Dry event force-dries at its tick (D-15) and never at frame indices (P4)', () => {
    const width = 32
    const height = 32
    const canvas = makeSurface(width, height)
    const adapter = createAquarelleEngineAdapter({ width, height, canvas })

    adapter.applyStroke(toStudioStroke(makeStrokePayload({ mutationId: 8, timestamp: 2 })))
    adapter.applyStroke({ kind: 'dry', tick: 3 } as unknown as StudioStroke<AquarelleStrokePayload>)

    const pixels = frameBytes(adapter.captureFrame())
    let painted = 0
    for (let i = 3; i < pixels.length; i += 4) {
      if ((pixels[i] ?? 0) > 0) painted++
    }
    expect(painted).toBeGreaterThan(0)
    adapter.dispose()
  })
})

// ---------------------------------------------------------------------------
// 5. 261029-bks — the clock-only idle-gap seam.
//    `skipTicks` mirrors `stepTick`'s guard: a disposed adapter (or one with
//    no engine) returns BEFORE any clock add, so the virtual clock can never
//    diverge from a no-skip run.
// ---------------------------------------------------------------------------

describe('skipTicks (261029-bks)', () => {
  it('exposes the seam and never throws — including after dispose', () => {
    const adapter = createAquarelleEngineAdapter()

    expect(typeof adapter.skipTicks).toBe('function')
    expect(() => adapter.skipTicks(0, 10)).not.toThrow()

    adapter.dispose()
    expect(() => adapter.skipTicks(0, 10)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 6. 261030-v1t — the per-frame paint salt seams.
//    setPaintSeedFrame / resetSheet are optional EXTENSION seams on the
//    adapter (the host EngineAdapter interface is untouched). The salt is a
//    pure mix of (traceSeed, output frame): the same salt reproduces the
//    pixels, an adjacent salt changes them, and resetSheet never re-rolls the
//    paper. The seam contract below is context-free; the pixel pins need
//    WebGL2 and close on live/disk UAT otherwise.
// ---------------------------------------------------------------------------

describe('paint seed salt seams (261030-v1t)', () => {
  it('exposes setPaintSeedFrame and resetSheet, total even without a WebGL2 engine', () => {
    const adapter = createAquarelleEngineAdapter()

    expect(typeof adapter.setPaintSeedFrame).toBe('function')
    expect(typeof adapter.resetSheet).toBe('function')
    expect(() => adapter.setPaintSeedFrame(3)).not.toThrow()
    expect(() => adapter.resetSheet()).not.toThrow()
    expect(() => adapter.setPaintSeedFrame(null)).not.toThrow()

    adapter.dispose()
    // dispose() nulls the engine — the seams stay total, never throw.
    expect(() => adapter.resetSheet()).not.toThrow()
    expect(() => adapter.setPaintSeedFrame(1)).not.toThrow()
  })

  it('sources its salt from the pure host mix of (traceSeed, frame)', () => {
    const stroke = toStudioStroke(makeStrokePayload())
    // The adapter keys configure() with seededRandom(mixStrokeSeed(traceSeed, frame))
    // when a frame is set — pinning the pair here keeps a refactor from silently
    // re-keying the stream.
    const frame0 = mixStrokeSeed(stroke.traceSeed || 1, 0)
    const frame1 = mixStrokeSeed(stroke.traceSeed || 1, 1)
    expect(frame0).toBe(1370007503)
    expect(frame1).not.toBe(frame0)
    // No salt => today's exact key: seededRandom(stroke.traceSeed || 1).
    expect(mixStrokeSeed(stroke.traceSeed || 1, 0)).not.toBe(stroke.traceSeed)
  })
})

// ---------------------------------------------------------------------------
// 7. 261031-cf9 — the persisted per-stroke paint seed salt.
//    The salt rides `engine.params` and is folded into `traceSeed` by the ONE
//    projection, so the adapter keeps reading a single host field. OFF (no
//    key) is byte-identical to today.
// ---------------------------------------------------------------------------

describe('persisted paint seed salt (261031-cf9)', () => {
  it('keeps a salted traceSeed through the adapter payload acceptance', () => {
    const adapter = createAquarelleEngineAdapter()
    const salted = toStudioStroke(
      makeStrokePayload({ params: { size: 12, water: 50, flow: 50, paintSeedSalt: 3 } }),
    )

    expect(salted.traceSeed).toBe(mixStrokeSeed(hashMutationId(42), 3))

    const reparsed = adapter.payloadCodec.parse(adapter.payloadCodec.serialize(salted))
    expect(reparsed).not.toBeNull()
    expect(reparsed?.traceSeed).toBe(mixStrokeSeed(hashMutationId(42), 3))
    expect(reparsed?.engine.params['paintSeedSalt']).toBe(3)
    adapter.dispose()
  })
})

describe.skipIf(!gpu)('per-frame paint salt GPU (WebGL2 required)', () => {
  const width = 64
  const height = 64

  const paintFresh = (salt: number | null): Uint8ClampedArray => {
    const canvas = makeSurface(width, height)
    const adapter = createAquarelleEngineAdapter({ width, height, canvas })
    adapter.setPaintSeedFrame(salt)
    adapter.applyStroke(toStudioStroke(makeStrokePayload()))
    for (let tick = 0; tick <= 8; tick++) adapter.stepTick(tick)
    const bytes = frameBytes(adapter.captureFrame())
    adapter.dispose()
    return bytes
  }

  it('resetSheet leaves the paper-only export byte-identical and clears the paint', () => {
    const canvas = makeSurface(width, height)
    const adapter = createAquarelleEngineAdapter({ width, height, canvas })

    const blank = frameBytes(adapter.captureFrame())
    adapter.applyStroke(toStudioStroke(makeStrokePayload()))
    const painted = frameBytes(adapter.captureFrame())
    expect(Buffer.from(painted).equals(Buffer.from(blank))).toBe(false)

    adapter.resetSheet()
    const afterReset = frameBytes(adapter.captureFrame())
    expect(Buffer.from(afterReset).equals(Buffer.from(blank))).toBe(true)
    adapter.dispose()
  })

  it('salt j, reset, salt j again is byte-identical (the same frame reproduces)', () => {
    const canvas = makeSurface(width, height)
    const adapter = createAquarelleEngineAdapter({ width, height, canvas })
    const paint = (salt: number): Uint8ClampedArray => {
      adapter.setPaintSeedFrame(salt)
      adapter.applyStroke(toStudioStroke(makeStrokePayload()))
      for (let tick = 0; tick <= 8; tick++) adapter.stepTick(tick)
      return frameBytes(adapter.captureFrame())
    }

    const first = paint(3)
    adapter.resetSheet()
    const again = paint(3)
    expect(Buffer.from(again).equals(Buffer.from(first))).toBe(true)
    adapter.dispose()
  })

  it('salt j versus j+1 changes the captured pixels', () => {
    const a = paintFresh(3)
    const b = paintFresh(4)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })

  it('absence of a salt keeps today’s stream: two fresh null-salt runs are byte-identical', () => {
    const a = paintFresh(null)
    const b = paintFresh(null)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 8. 61-04 — the sparse width profile bridge (VEC-03).
//    `resolveStrokeWidthFactors` is the ONE bridge from the persisted sparse
//    anchor factors (61-02 spine) to the engine's per-sample finite channel.
//    It is pure — no clock, no RNG, no engine-state write — runs once per
//    active stroke, and its derived array is never persisted. Non-GPU: every
//    law is arithmetic over the pure spine module; the real-pixel proof lives
//    in probe/vector-spine (`--scenario width`).
// ---------------------------------------------------------------------------

describe('resolveStrokeWidthFactors (61-04)', () => {
  // Three anchors on the test grid's y = 0.5 line: default, 1.8, default.
  // The middle factor is the authored maximum the engine must carry.
  const SPARSE_ANCHORS: readonly AquarelleAnchor[] = [
    { x: 0.3, y: 0.5, kind: 'auto' },
    { x: 0.5, y: 0.5, kind: 'auto', width: 1.8 },
    { x: 0.6, y: 0.5, kind: 'auto' },
  ]

  const projected = (anchors: readonly AquarelleAnchor[] | undefined) => {
    const stroke = toStudioStroke(makeStrokePayload(anchors === undefined ? {} : { anchors }))
    return { payload: stroke.engine, pts: stroke.pts }
  }

  it('reads null without anchors — a hand-painted stroke carries no width data', () => {
    const absent = projected(undefined)
    expect(resolveStrokeWidthFactors(absent.payload, absent.pts)).toBeNull()

    const empty = projected([])
    expect(resolveStrokeWidthFactors(empty.payload, empty.pts)).toBeNull()
  })

  it('reads null for a uniform profile — every anchor at the default factor', () => {
    const uniform = projected([
      { x: 0.3, y: 0.5, kind: 'auto' },
      { x: 0.5, y: 0.5, kind: 'auto', width: ANCHOR_WIDTH_DEFAULT },
      { x: 0.6, y: 0.5, kind: 'auto' },
    ])
    expect(resolveStrokeWidthFactors(uniform.payload, uniform.pts)).toBeNull()
  })

  it('derives one Float32Array entry per point: authored maximum, held ends', () => {
    const { payload, pts } = projected(SPARSE_ANCHORS)
    const factors = resolveStrokeWidthFactors(payload, pts)

    expect(factors).toBeInstanceOf(Float32Array)
    expect(factors?.length).toBe(pts.length)

    const values = Array.from(factors!)
    expect(Math.max(...values)).toBeGreaterThan(1.7)
    expect(Math.max(...values)).toBeLessThanOrEqual(1.8)
    expect(values[0]).toBeCloseTo(1, 5)
    expect(values[values.length - 1]).toBeCloseTo(1, 5)
  })

  it('two consecutive resolutions are element-wise identical (pure, no clock/RNG)', () => {
    const { payload, pts } = projected(SPARSE_ANCHORS)
    const first = resolveStrokeWidthFactors(payload, pts)
    const second = resolveStrokeWidthFactors(payload, pts)

    expect(second).not.toBeNull()
    expect(second?.length).toBe(first?.length)
    for (let index = 0; index < (first?.length ?? 0); index++) {
      expect(second![index]).toBe(first![index])
    }
  })

  it('a one-point grid reads the first anchor factor', () => {
    const { payload } = projected([
      { x: 0.3, y: 0.5, kind: 'auto', width: 1.8 },
      { x: 0.6, y: 0.5, kind: 'auto' },
    ])
    const single: StudioPoint = { x: 0.3, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0, tick: 0 }
    const factors = resolveStrokeWidthFactors(payload, [single])

    expect(factors).not.toBeNull()
    expect(factors!.length).toBe(1)
    expect(factors![0]).toBeCloseTo(1.8, 5)
  })

  it('holds out-of-range factors at the nearest published end, always finite', () => {
    const maxAuthored = 9
    const { payload, pts } = projected([
      { x: 0.3, y: 0.5, kind: 'auto', width: maxAuthored },
      { x: 0.5, y: 0.5, kind: 'auto', width: 0.05 },
      { x: 0.6, y: 0.5, kind: 'auto' },
    ])
    const factors = resolveStrokeWidthFactors(payload, pts)

    expect(factors).not.toBeNull()
    const values = Array.from(factors!)
    for (const value of values) {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(ANCHOR_WIDTH_MIN)
      expect(value).toBeLessThanOrEqual(ANCHOR_WIDTH_MAX)
      // No extrapolation: nothing reads beyond what was authored.
      expect(value).toBeLessThanOrEqual(maxAuthored)
    }
    // Grid x = 0.3 / 0.4 / 0.5 / 0.6: the oversized anchor holds its clamped
    // maximum at index 0, the undersized one holds the clamped minimum at
    // index 2 (the 0.4 sample interpolates between them), and the trailing
    // anchor keeps the default.
    expect(values[0]).toBeCloseTo(ANCHOR_WIDTH_MAX, 5)
    expect(values[2]).toBeCloseTo(ANCHOR_WIDTH_MIN, 5)
    expect(values[values.length - 1]).toBeCloseTo(ANCHOR_WIDTH_DEFAULT, 5)
  })

  it('feeds the factor at both script calls inside feedDueSample (source contract)', () => {
    const adapterSource = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'engineAdapter.ts'),
      'utf8',
    )
    const feedStart = adapterSource.indexOf('const feedDueSample')
    expect(feedStart).toBeGreaterThan(-1)
    const feed = adapterSource.slice(feedStart, adapterSource.indexOf('return {', feedStart))
    expect(feed.length).toBeGreaterThan(0)

    const lines = feed.split('\n')
    const moveLine = lines.find((line) => line.includes('scriptMove('))
    expect(moveLine).toBeDefined()

    // The width factor is the argument AFTER the 2D tilt pair at both call
    // sites — begin(...tiltX, tiltY, widthFactor, renderMode) /
    // move(...tiltX, tiltY, widthFactor). A refactor that drops it silently
    // reverts to the capped footprint (C-03), so the source contract pins it.
    // 61-07 appended the render mode after it on the SAME scriptBegin call —
    // never a second deposit path (T-61-22) — so the begin call is multi-line
    // now and its argument block is pinned instead of its last source line.
    const beginBlock = feed.slice(feed.indexOf('scriptBegin('), feed.indexOf('scriptMove('))
    expect(beginBlock).toContain('widthFactor,')
    expect(beginBlock).toContain('resolveAquarelleRenderMode(active.stroke.engine.renderMode)')
    expect(moveLine!.trimEnd().endsWith('widthFactor)')).toBe(true)
    // Both read the per-sample entry derived once at activation.
    expect(feed).toContain('active.widths')
  })
})

// ---------------------------------------------------------------------------
// 8. 61-07 — the simple-ribbon preset, the brush-id mapping and the
//    conditional record-time mode term (D-12 / D-13 / D-14).
//
//    The two mapping helpers are read through the module namespace so a RED
//    run fails on the planned assertion instead of on a missing named import.
// ---------------------------------------------------------------------------

function resolveBrushMode(brushId: string | undefined): unknown {
  return (
    VectorPathModule as unknown as {
      resolveRenderModeForBrushId?: (id: string | undefined) => unknown
    }
  ).resolveRenderModeForBrushId?.(brushId)
}

function recordedModeField(brushId: string | undefined): unknown {
  return (
    VectorPathModule as unknown as {
      recordedRenderModeField?: (id: string | undefined) => unknown
    }
  ).recordedRenderModeField?.(brushId)
}

const SIMPLE_RIBBON_HINT =
  'Clean sweep along the path — no wet bleed. The wet sliders stay at zero until you raise them.'

describe('simple-ribbon brush preset (61-07)', () => {
  it('ships exactly one ribbon preset with the approved name and hint', () => {
    const ribbons = BRUSH_PRESETS.filter((preset) => preset.renderMode === 'simple-ribbon')
    expect(ribbons).toHaveLength(1)
    expect(ribbons[0]!.id).toBe('simple-ribbon')
    expect(ribbons[0]!.name).toBe('Simple ribbon')
    expect(ribbons[0]!.hint).toBe(SIMPLE_RIBBON_HINT)
  })

  it('keeps the brush-side wet multipliers neutral so a raised global still reaches the deposit', () => {
    const preset = BRUSH_PRESETS.find((candidate) => candidate.id === 'simple-ribbon')
    expect(preset).toBeDefined()
    // D-13: these are the multipliers the engine folds into the wet terms.
    // Zeroing them would make the preset deaf to water/load/flow.
    expect(preset!.water).toBe(1)
    expect(preset!.load).toBe(1)
    expect(preset!.flow).toBe(1)
    expect(preset!.capacity).toBe(1)
    // Crispness-only overrides (the clean-sweep look).
    expect(preset!.grain).toBe(0)
    expect(preset!.scatter).toBe(0)
  })
})

describe('brush-id → render-mode mapping (61-07 D-12/D-14)', () => {
  it('maps only the simple-ribbon preset id to the ribbon mode', () => {
    expect(resolveBrushMode('simple-ribbon')).toBe('simple-ribbon')
    expect(resolveBrushMode('chalk')).toBe('watercolor')
    expect(resolveBrushMode('wc/round-medium')).toBe('watercolor')
  })

  it('resolves an absent brush id to watercolour', () => {
    expect(resolveBrushMode(undefined)).toBe('watercolor')
  })

  it('keeps the mapping a pure string comparison — no playground import', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../payload/vectorPath.ts'),
      'utf8',
    )
    expect(source).not.toContain('playground/')
  })
})

describe('recordedRenderModeField — the conditional canonical term (61-07)', () => {
  it('returns { renderMode: simple-ribbon } for the ribbon brush', () => {
    expect(recordedModeField('simple-ribbon')).toEqual({ renderMode: 'simple-ribbon' })
  })

  it('returns an EMPTY object for every other brush id and for undefined', () => {
    // A default-mode hand-painted stroke must gain no key: same pre-phase
    // key set, same byte cost (REL-02).
    expect(recordedModeField('chalk')).toEqual({})
    expect(recordedModeField('wc/round-medium')).toEqual({})
    expect(recordedModeField(undefined)).toEqual({})
    expect(Object.keys(recordedModeField('chalk') as object)).toHaveLength(0)
  })
})

describe('renderMode payload round-trip (61-07 VEC-06)', () => {
  it('carries renderMode: simple-ribbon through the script codec unchanged', () => {
    const adapter = createAquarelleEngineAdapter()
    const projected = toStudioStroke(makeStrokePayload({ renderMode: 'simple-ribbon' }))
    const reparsed = adapter.payloadCodec.parse(adapter.payloadCodec.serialize(projected))
    expect(reparsed).not.toBeNull()
    expect(reparsed?.engine.renderMode).toBe('simple-ribbon')
    adapter.dispose()
  })

  it('leaves an absent mode absent — no key is invented (REL-02)', () => {
    const adapter = createAquarelleEngineAdapter()
    const projected = toStudioStroke(makeStrokePayload())
    const reparsed = adapter.payloadCodec.parse(adapter.payloadCodec.serialize(projected))
    expect(reparsed).not.toBeNull()
    expect('renderMode' in (reparsed!.engine as object)).toBe(false)
    adapter.dispose()
  })
})
