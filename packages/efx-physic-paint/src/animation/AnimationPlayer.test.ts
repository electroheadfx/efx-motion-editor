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

  // First rAF initializes AnimationPlayer.lastFrameTime. Use a non-zero
  // timestamp because AnimationPlayer treats 0 as its uninitialized sentinel.
  rafCallback?.(1)

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (!rafCallback) break
    rafCallback(1 + ((frame + 1) * frameDuration))
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
  return vi.mocked(engine.renderPartialStrokes).mock.calls.map((call: [unknown]) => call[0] as RenderedStroke[])
}

function pointCountFor(call: RenderedStroke[], color: string): number {
  return call.find(({ stroke }) => stroke.color === color)?.pointCount ?? 0
}

function firstPointFor(call: RenderedStroke[], color: string): PenPoint | null {
  return call.find(({ stroke }) => stroke.color === color)?.stroke.points[0] ?? null
}

function firstFrameFor(calls: RenderedStroke[][], color: string): number {
  return calls.findIndex(call => pointCountFor(call, color) > 0)
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

  it('spreads more strokes than frames across the whole duration instead of cramming overflow at the end', () => {
    const strokes = Array.from({ length: 20 }, (_, index) => makeStroke(`#overflow-${index}`, 4, index))
    const engine = createEngine(strokes)
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 16, fps: 12 })
    advanceAnimationFrames(18)

    const calls = renderCalls(engine)
    const firstFrames = strokes.map(stroke => firstFrameFor(calls, stroke.color!))
    const firstFrameCounts = Array.from({ length: 16 }, (_, frame) => firstFrames.filter(firstFrame => firstFrame === frame).length)

    expect(firstFrames.at(-1)).toBe(15)
    expect(firstFrameCounts[15]).toBe(2)
    expect(firstFrameCounts.slice(0, 15).some(count => count === 2)).toBe(true)
    for (const stroke of strokes) {
      expect(pointCountFor(calls.at(-1)!, stroke.color!)).toBe(stroke.points.length)
    }
  })

  it('starts frame-annotated strokes at their selected Play frame and keeps drawing them progressively', () => {
    const scheduledStroke = { ...makeStroke('#frame-edit', 8, 2), playFrame: 2 }
    const engine = createEngine([makeStroke('#base', 8, 1), scheduledStroke])
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 4, fps: 12 })
    advanceAnimationFrames(6)

    const calls = renderCalls(engine)

    expect(pointCountFor(calls[0], '#frame-edit')).toBe(0)
    expect(pointCountFor(calls[1], '#frame-edit')).toBe(0)
    expect(pointCountFor(calls[2], '#frame-edit')).toBeGreaterThan(0)
    expect(pointCountFor(calls[2], '#frame-edit')).toBeLessThan(8)
    expect(pointCountFor(calls.at(-1)!, '#frame-edit')).toBe(8)
  })

  it('keeps multiple strokes painted on the same Play frame sequential instead of parallel', () => {
    const firstFrameEdit = { ...makeStroke('#frame-edit-a', 8, 2), playFrame: 2 }
    const secondFrameEdit = { ...makeStroke('#frame-edit-b', 8, 3), playFrame: 2 }
    const engine = createEngine([makeStroke('#base', 4, 1), firstFrameEdit, secondFrameEdit])
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 8, fps: 12 })
    advanceAnimationFrames(10)

    const calls = renderCalls(engine)
    const firstSecondEditFrame = calls.findIndex(call => pointCountFor(call, '#frame-edit-b') > 0)

    expect(pointCountFor(calls[2], '#frame-edit-a')).toBeGreaterThan(0)
    expect(pointCountFor(calls[2], '#frame-edit-b')).toBe(0)
    expect(firstSecondEditFrame).toBeGreaterThan(2)
    expect(pointCountFor(calls[firstSecondEditFrame], '#frame-edit-a')).toBe(8)
    expect(pointCountFor(calls[firstSecondEditFrame], '#frame-edit-b')).toBeGreaterThan(0)
  })

  it('fits later Play-frame strokes into the remaining duration instead of spending the full tail on one stroke', () => {
    const firstFrameEdit = { ...makeStroke('#frame-edit-a', 30, 2), playFrame: 6 }
    const secondFrameEdit = { ...makeStroke('#frame-edit-b', 30, 3), playFrame: 6 }
    const engine = createEngine([makeStroke('#base', 4, 1), firstFrameEdit, secondFrameEdit])
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 10, fps: 12 })
    advanceAnimationFrames(12)

    const calls = renderCalls(engine)

    expect(pointCountFor(calls[6], '#frame-edit-a')).toBeGreaterThan(0)
    expect(pointCountFor(calls[7], '#frame-edit-a')).toBe(30)
    expect(pointCountFor(calls[7], '#frame-edit-b')).toBe(0)
    expect(pointCountFor(calls[8], '#frame-edit-b')).toBeGreaterThan(0)
    expect(pointCountFor(calls.at(-1)!, '#frame-edit-b')).toBe(30)
  })

  it('pulls over-late Play-frame anchors earlier when needed to fit following strokes in range', () => {
    const firstFrameEdit = { ...makeStroke('#frame-edit-a', 8, 2), playFrame: 3 }
    const secondFrameEdit = { ...makeStroke('#frame-edit-b', 8, 3), playFrame: 3 }
    const engine = createEngine([makeStroke('#base', 4, 1), firstFrameEdit, secondFrameEdit])
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 4, fps: 12 })
    advanceAnimationFrames(6)

    const calls = renderCalls(engine)

    expect(pointCountFor(calls[2], '#frame-edit-a')).toBe(8)
    expect(pointCountFor(calls[2], '#frame-edit-b')).toBe(0)
    expect(pointCountFor(calls[3], '#frame-edit-b')).toBe(8)
  })

  it('keeps playback geometry unchanged when wiggle is not configured', () => {
    const sourceStrokes = makeRecordedOrderStrokes()
    const engine = createEngine(sourceStrokes)
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 12, fps: 12 })
    advanceAnimationFrames(1)

    const firstRenderedStroke = renderCalls(engine)[0]?.[0]?.stroke

    expect(firstRenderedStroke).toBe(sourceStrokes[0])
  })

  it('applies deterministic stroke deformation and position wiggle when configured', () => {
    const engine = createEngine(makeRecordedOrderStrokes())
    const player = new AnimationPlayer(engine as EfxPaintEngine)

    player.play({ frameCount: 12, fps: 12, wiggle: { strokeDeformation: 80, strokePosition: 60 } })
    advanceAnimationFrames(1)

    const firstCall = renderCalls(engine)[0]
    const firstPoint = firstPointFor(firstCall, '#stroke-1')

    expect(firstPoint).toBeDefined()
    expect(firstPoint).not.toMatchObject({ x: 0, y: 0 })
    expect(firstPoint).toEqual(firstPointFor(firstCall, '#stroke-1'))
  })

  it('does not add a public sequential or parallel mode toggle to AnimationConfig', () => {
    const typesSource = readFileSync(resolve(__dirname, 'types.ts'), 'utf8')
    const configBody = typesSource.match(/export interface AnimationConfig \{([\s\S]*?)\n\}/)?.[1] ?? ''

    expect(configBody).toContain('wiggle?: AnimationWiggleConfig')
    expect(configBody).not.toMatch(/\bmode\b/i)
    expect(configBody).not.toMatch(/\bparallel\b/i)
    expect(configBody).not.toMatch(/\bsequential\b/i)
  })
})
