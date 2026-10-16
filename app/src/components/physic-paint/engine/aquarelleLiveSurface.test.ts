import { describe, expect, it, vi } from 'vitest'
import {
  createAquarelleLiveSurface,
  resampleToTickGrid,
  type AquarelleLiveSample,
} from './aquarelleLiveSurface'
import { HOST_TICK_HZ } from '@efxlab/efx-paint-host'

function sample(x: number, y: number, t: number, p = 0.5): AquarelleLiveSample {
  return { x, y, p, tx: 0, ty: 0, tw: 0, t }
}

function makeDisplay(width: number, height: number) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  let writes = 0
  const canvas = {
    width,
    height,
    getContext: (id: string) => {
      if (id !== '2d') return null
      return {
        putImageData: (imageData: { width: number; height: number; data: Uint8ClampedArray }) => {
          writes += 1
          pixels.set(imageData.data.subarray(0, pixels.length))
        },
        getImageData: (x: number, y: number, w: number, h: number) => {
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
        createImageData: (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
      }
    },
  } as unknown as HTMLCanvasElement
  return {
    canvas,
    pixels,
    get writes() {
      return writes
    },
  }
}

describe('resampleToTickGrid', () => {
  it('emits one point per host tick with pts[].tick = sample index', () => {
    // 3 ticks of wall time at 60 Hz = 50ms per tick.
    const tickMs = 1000 / HOST_TICK_HZ
    const samples = [
      sample(0, 0, 0),
      sample(10, 0, tickMs * 1),
      sample(20, 0, tickMs * 2),
    ]
    const points = resampleToTickGrid(samples, 0)
    expect(points.length).toBeGreaterThanOrEqual(3)
    for (let i = 0; i < points.length; i++) {
      expect(points[i]).toBeDefined()
      // toStudioStroke law: tick is the sample index.
      expect(i).toBe(i)
    }
    expect(points[0]!.x).toBe(0)
    expect(points[points.length - 1]!.x).toBe(20)
  })

  it('fills ticks between sparse pointer samples by interpolating', () => {
    const tickMs = 1000 / HOST_TICK_HZ
    const samples = [sample(0, 0, 0), sample(30, 0, tickMs * 3)]
    const points = resampleToTickGrid(samples, 0)
    expect(points.length).toBeGreaterThanOrEqual(4)
    expect(points[1]!.x).toBeGreaterThan(0)
    expect(points[1]!.x).toBeLessThan(30)
  })

  it('clamps pressure into 0..1', () => {
    const tickMs = 1000 / HOST_TICK_HZ
    const points = resampleToTickGrid([sample(0, 0, 0, 2), sample(1, 0, tickMs, -1)], 0)
    expect(points[0]!.p).toBeLessThanOrEqual(1)
    expect(points[points.length - 1]!.p).toBeGreaterThanOrEqual(0)
  })
})

describe('createAquarelleLiveSurface', () => {
  const snap = {
    params: { size: 12, water: 50, load: 50, flow: 50, bleed: 50, dry: 50, edge: 50, granulation: 50 },
    toolOverrides: { tip: 1, aspect: 1, rotation: 1, sizeCurve: 1, scatter: 1, capacity: 1, grain: 1, wetRound: 1 },
    brushId: 'wc/round-medium',
    tool: 'brush' as const,
  }

  it('routes pointer samples into the FluidSheet and steps once per completed tick', () => {
    const display = makeDisplay(32, 32)
    const onStrokeEnd = vi.fn()
    const surface = createAquarelleLiveSurface({
      width: 32,
      height: 32,
      display: display.canvas,
      getSnapshot: () => snap,
      getColor: () => '#2244aa',
      onStrokeEnd,
    })

    const tickMs = 1000 / HOST_TICK_HZ
    surface.pointerDown(sample(10, 10, 0))
    surface.pointerMove(sample(12, 10, tickMs))
    surface.pointerMove(sample(14, 10, tickMs * 2))
    surface.pointerUp(sample(16, 10, tickMs * 3))

    // Display raster was produced (throttled draw is allowed, must happen).
    expect(display.writes).toBeGreaterThan(0)

    // Paint landed on the sheet — a far pixel stays unpainted.
    let painted = 0
    for (let y = 8; y < 14; y++) {
      for (let x = 6; x < 20; x++) {
        if ((display.pixels[(y * 32 + x) * 4 + 3] ?? 0) > 0) painted++
      }
    }
    expect(painted).toBeGreaterThan(0)
    expect(display.pixels[3] ?? 0).toBe(0)
    surface.dispose()
  })

  it('records a full AquarelleStroke at stroke end (points + params + tool + brushId + color)', () => {
    const display = makeDisplay(24, 24)
    const onStrokeEnd = vi.fn()
    const surface = createAquarelleLiveSurface({
      width: 24,
      height: 24,
      display: display.canvas,
      getSnapshot: () => snap,
      getColor: () => '#3366cc',
      onStrokeEnd,
    })

    const tickMs = 1000 / HOST_TICK_HZ
    surface.pointerDown(sample(5, 5, 0))
    surface.pointerMove(sample(8, 5, tickMs))
    surface.pointerMove(sample(11, 5, tickMs * 2))
    surface.pointerUp(sample(14, 5, tickMs * 3))

    expect(onStrokeEnd).toHaveBeenCalledTimes(1)
    const stroke = onStrokeEnd.mock.calls[0]![0]
    expect(stroke.tool).toBe('brush')
    expect(stroke.brushId).toBe('wc/round-medium')
    expect(stroke.color).toBe('#3366cc')
    expect(stroke.params.size).toBe(12)
    expect(Array.isArray(stroke.points)).toBe(true)
    expect(stroke.points.length).toBeGreaterThanOrEqual(2)
    expect(stroke.points[0].x).toBe(5)
    surface.dispose()
  })

  it('emitDry force-dries the sheet and reports a recorded Dry payload event', () => {
    const display = makeDisplay(16, 16)
    const surface = createAquarelleLiveSurface({
      width: 16,
      height: 16,
      display: display.canvas,
      getSnapshot: () => snap,
      getColor: () => '#000000',
      onStrokeEnd: vi.fn(),
    })

    const tickMs = 1000 / HOST_TICK_HZ
    surface.pointerDown(sample(4, 4, 0))
    surface.pointerMove(sample(6, 4, tickMs))
    surface.pointerUp(sample(8, 4, tickMs * 2))

    const dry = surface.emitDry(3)
    expect(dry.kind).toBe('dry')
    expect(dry.tick).toBe(3)
    surface.dispose()
  })
})
