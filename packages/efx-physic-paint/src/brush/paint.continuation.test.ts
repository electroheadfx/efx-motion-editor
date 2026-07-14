import { describe, expect, it, vi } from 'vitest'
import { createPaintStrokeRasterContinuation, renderPaintStroke } from './paint'
import { ribbon } from './stroke'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

function canvasFactory(log: string[]) {
  const contexts = new WeakMap<object, any>()
  return () => {
    const canvas: any = { width: 0, height: 0 }
    const context: any = {
      canvas,
      fillStyle: '', globalAlpha: 1, strokeStyle: '', lineWidth: 1, lineCap: 'round',
      save: () => log.push('save'), restore: () => log.push('restore'),
      beginPath: () => log.push('begin'), moveTo: () => log.push('move'), lineTo: () => log.push('line'),
      closePath: () => log.push('close'), fill: () => log.push('fill'), stroke: () => log.push('stroke'),
      translate: () => log.push('translate'), drawImage: () => log.push('draw'),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => log.push('put'), clearRect: () => {},
    }
    contexts.set(canvas, context)
    canvas.getContext = () => contexts.get(canvas)
    return canvas
  }
}

function wet(size: number): WetBuffers {
  return {
    r: new Float32Array(size), g: new Float32Array(size), b: new Float32Array(size),
    alpha: new Float32Array(size), wetness: new Float32Array(size), strokeOpacity: new Float32Array(size),
  }
}

function run(resumable: boolean, pickup: number) {
  const width = 48, height = 32
  const log: string[] = []
  vi.stubGlobal('document', { createElement: vi.fn(canvasFactory(log)) })
  const main = canvasFactory(log)()
  const points: PenPoint[] = [
    { x: 5, y: 8, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.2 },
    { x: 14, y: 12, p: 0.6, tx: 0, ty: 0, tw: 0, spd: 0.2 },
    { x: 24, y: 14, p: 0.7, tx: 0, ty: 0, tw: 0, spd: 0.2 },
    { x: 34, y: 18, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.2 },
  ]
  const opts = { size: 6, opacity: 75, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup, eraseStrength: 50, antiAlias: 0 } satisfies BrushOpts
  const buffers = wet(width * height)
  const randomCalls: number[] = []
  let seed = 123456789
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (1664525 * seed + 1013904223) >>> 0
    const value = seed / 0x100000000
    randomCalls.push(value)
    return value
  })
  const args = [points, '#336699', opts, main.getContext('2d'), buffers, {} as any, new Float32Array(width * height), new Uint8Array(width * height), null, width, height, false, false, 0, 8, 0.5, () => 0.5] as const
  if (resumable) {
    const continuation = createPaintStrokeRasterContinuation(points, '#336699', opts, main.getContext('2d'), buffers, null, width, height, false, 0, 8, 0.5, () => 0.5)
    while (!continuation.step()) log.push('yield')
  } else {
    renderPaintStroke(...args)
  }
  return { pixels: Array.from(buffers.alpha), randomCalls, log: log.filter(entry => entry !== 'yield') }
}

describe('paint raster continuation parity', () => {
  it.each([0, 60])('preserves pixels, RNG call order, and canvas operation order for pickup=%s', (pickup) => {
    const sequential = run(false, pickup)
    vi.restoreAllMocks()
    const resumable = run(true, pickup)

    expect(resumable.pixels).toEqual(sequential.pixels)
    expect(resumable.randomCalls).toEqual(sequential.randomCalls)
    expect(resumable.log).toEqual(sequential.log)
  })

  it('uses raw pen pressure for width without an unexposed multiplier', () => {
    const curve: PenPoint[] = [
      { x: 0, y: 0, p: 0.25, tx: 0, ty: 0, tw: 0, spd: 0 },
      { x: 10, y: 0, p: 0.25, tx: 0, ty: 0, tw: 0, spd: 0 },
      { x: 20, y: 0, p: 0.25, tx: 0, ty: 0, tw: 0, spd: 0 },
    ]

    const polygon = ribbon(curve, 12, 0.8, true)

    expect(polygon[1]).toEqual([10, 3])
  })
})
