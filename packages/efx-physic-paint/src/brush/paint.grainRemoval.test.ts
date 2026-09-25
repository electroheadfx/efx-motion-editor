import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderPaintStroke } from './paint'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

// 260925-dso — Pin 1: the stroke raster must run zero grain/emboss pixel passes.
// Harness mirrored from paint.continuation.test.ts (canvasFactory stub + document
// stub + seeded Math.random + wet() buffers + 4-point PenPoint array).

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

function runRaster(pickup: number) {
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
  let seed = 123456789
  vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 0x100000000
  })
  const stages: string[] = []
  const observer = (stage: string) => {
    stages.push(stage)
  }
  // Non-null height map so the emboss branch is live at base (default 0.45).
  const paperHeight = new Float32Array(width * height).fill(0.5)
  renderPaintStroke(
    points, '#336699', opts, main.getContext('2d'), buffers, {} as any,
    new Float32Array(width * height), new Uint8Array(width * height),
    paperHeight, width, height,
    false, false, 0.5, () => 0.5, observer,
  )
  return { stages, log }
}

const paintSource = readFileSync(new URL('./paint.ts', import.meta.url), 'utf8')

describe('260925-dso — paint raster runs no grain/emboss pass', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([0, 60])('no grain/emboss stages and no putImageData writeback for pickup=%s', (pickup) => {
    const { stages, log } = runRaster(pickup)

    // Observer-wiring controls — must be green at base (prove the harness works).
    expect(stages).toContain('paint-raster-geometry')
    expect(stages).toContain('paint-raster-layers')

    // The four negative behaviors — RED at base.
    expect(stages.some((stage) => stage.startsWith('paint-grain-'))).toBe(false)
    expect(stages.some((stage) => stage.startsWith('paint-emboss-'))).toBe(false)
    expect(stages).not.toContain('paint-raster-paper-emboss')
    // The grain/emboss writebacks are the raster's only putImageData.
    expect(log).not.toContain('put')
  })

  it('source shape: grain-fill helper and emboss applier are gone from paint.ts', () => {
    expect(paintSource).not.toContain('fillPolyGrain')
    expect(paintSource).not.toContain('applyPaperEmboss')
  })
})
