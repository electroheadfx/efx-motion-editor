import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnimationPlayer } from './AnimationPlayer'
import type { PaintStroke, PenPoint } from '../types'
import type { EfxPaintEngine } from '../engine/EfxPaintEngine'

type RenderedStroke = { stroke: PaintStroke; pointCount: number }
type MockEngine = Pick<
  EfxPaintEngine,
  | 'getStrokes'
  | 'setInputLocked'
  | 'setAnimationMode'
  | 'renderPartialStrokes'
  | 'renderAllStrokes'
  | 'exportCompositeCanvas'
>

const makePoint = (index: number): PenPoint => ({
  x: index,
  y: index * 2,
  p: 0.5,
  tx: 0,
  ty: 0,
  tw: 0,
  spd: 1,
})

const makeStroke = (id: string, pointCount: number, timestamp: number): PaintStroke => ({
  tool: 'paint',
  points: Array.from({ length: pointCount }, (_, index) => makePoint(index)),
  color: id,
  params: {
    size: 8,
    opacity: 100,
    pressure: 70,
    waterAmount: 50,
    dryAmount: 30,
    edgeDetail: 10,
    pickup: 0,
    eraseStrength: 50,
    antiAlias: 1,
  },
  timestamp,
})

const makeRecordedOrderStrokes = () => [
  makeStroke('#stroke-1', 12, 0),
  // Timestamp is intentionally very close to stroke 1. Timestamp-ratio playback
  // would start this immediately; sequential playback must not.
  makeStroke('#stroke-2', 30, 1),
  makeStroke('#stroke-3', 6, 10_000),
]

let rafCallback: FrameRequestCallback | null = null

function installAnimationFrameMock(): void {
  rafCallback = null
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    rafCallback = callback
    return 1
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
}

function advanceAnimationFrames(frameCount: number, fps = 12): void {
  const frameDuration = 1000 / fps

  // First rAF initializes AnimationPlayer.lastFrameTime.
  rafCallback?.(0)

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (!rafCallback) break
    rafCallback((frame + 1) * frameDuration)
  }
}

function createEngine(strokes: PaintStroke[]) {
  const canvas = {} as HTMLCanvasElement
  const engine: MockEngine = {
    getStrokes: vi.fn(() => strokes),
    setInputLocked: vi.fn(),
    setAnimationMode: vi.fn(),
    renderPartialStrokes: vi.fn(),
    renderAllStrokes: vi.fn(),
    exportCompositeCanvas: vi.fn(() => canvas),
  }
  return engine
}

function renderCalls(engine: MockEngine): RenderedStroke[][] {
  return vi.mocked(engine.renderPartialStrokes).mock.calls.map(([strokes]) => strokes as RenderedStroke[])
}

function pointCountFor(call: RenderedStroke[], color: string): number {
  return call.find(({ stroke }) => stroke.color === color)?.pointCount ?? 0
}

describe('AnimationPlayer sequential playback', () => {
  beforeEach(() => {
    installAnimationFrameMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders recorded strokes one hand at a time even when timestamps would overlap', () => {
    const engine = createEngine(makeRecordedOrderStrokes())
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 12, fps: 12 })
    advanceAnimationFrames(12)

    const calls = renderCalls(engine)
    const firstCompleteIndex = calls.findIndex(call => pointCountFor(call, '#stroke-1') === 12)

    expect(firstCompleteIndex).toBeGreaterThanOrEqual(0)
    for (const call of calls.slice(0, firstCompleteIndex)) {
      expect(pointCountFor(call, '#stroke-2')).toBe(0)
      expect(pointCountFor(call, '#stroke-3')).toBe(0)
    }
  })

  it('allocates more rendered frame coverage to a longer stroke than shorter strokes', () => {
    const engine = createEngine(makeRecordedOrderStrokes())
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 16, fps: 12 })
    advanceAnimationFrames(16)

    const calls = renderCalls(engine)
    const stroke2ActiveFrames = calls.filter(call => {
      const points = pointCountFor(call, '#stroke-2')
      return points > 0 && points < 30
    }).length
    const stroke3ActiveFrames = calls.filter(call => {
      const points = pointCountFor(call, '#stroke-3')
      return points > 0 && points < 6
    }).length

    expect(stroke2ActiveFrames).toBeGreaterThan(stroke3ActiveFrames)
  })

  it('compresses tight durations so the final render frame contains every stroke complete', () => {
    const engine = createEngine(makeRecordedOrderStrokes())
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 2, fps: 12 })
    advanceAnimationFrames(2)

    const calls = renderCalls(engine)
    const finalPartialFrame = calls.at(-1)

    expect(finalPartialFrame).toBeDefined()
    expect(pointCountFor(finalPartialFrame!, '#stroke-1')).toBe(12)
    expect(pointCountFor(finalPartialFrame!, '#stroke-2')).toBe(30)
    expect(pointCountFor(finalPartialFrame!, '#stroke-3')).toBe(6)
    expect(engine.renderAllStrokes).toHaveBeenCalledTimes(1)
    expect(engine.setAnimationMode).toHaveBeenLastCalledWith(false)
    expect(engine.setInputLocked).toHaveBeenLastCalledWith(false)
  })

  it('does not add a public sequential or parallel mode toggle to AnimationConfig', () => {
    const typesSource = readFileSync(resolve(__dirname, 'types.ts'), 'utf8')
    const configBody = typesSource.match(/export interface AnimationConfig \{([\s\S]*?)\n\}/)?.[1] ?? ''

    expect(configBody).not.toMatch(/\bmode\b/i)
    expect(configBody).not.toMatch(/\bparallel\b/i)
    expect(configBody).not.toMatch(/\bsequential\b/i)
  })
})
