import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnimationPlayer } from './AnimationPlayer'
import type { EngineAdapter, StudioPoint, StudioStroke } from './types'

interface TestPayload {
  tool: string
  params: Record<string, number>
  physicsMode: string | null
}

type RenderedStroke = { stroke: StudioStroke<TestPayload>; pointCount: number }

const makePoint = (index: number): StudioPoint => ({
  x: index,
  y: index * 2,
  p: 0.5,
  tx: 0,
  ty: 0,
  tw: 0,
  tick: index,
})

const makeStroke = (id: string, pointCount: number, recordedOrder: number): StudioStroke<TestPayload> => ({
  pts: Array.from({ length: pointCount }, (_, index) => makePoint(index)),
  ticks: Math.max(1, pointCount - 1),
  cuisson: 0,
  motion: null,
  brushId: 'test-brush',
  toolOverrides: {},
  traceSeed: recordedOrder,
  recordedOrder,
  playFrame: null,
  color: id,
  engine: {
    tool: 'paint',
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
    physicsMode: null,
  },
})

const makeRecordedOrderStrokes = () => [
  makeStroke('#stroke-1', 12, 0),
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
  rafCallback?.(1)
  for (let frame = 0; frame < frameCount; frame += 1) {
    if (!rafCallback) break
    rafCallback(1 + ((frame + 1) * frameDuration))
  }
}

function createEngine(strokes: StudioStroke<TestPayload>[]): EngineAdapter<TestPayload> {
  const canvas = {} as HTMLCanvasElement
  return {
    getStrokes: vi.fn(() => strokes),
    setInputLocked: vi.fn(),
    setAnimationMode: vi.fn(),
    renderPartialStrokes: vi.fn(),
    renderAllStrokes: vi.fn(),
    exportCompositeCanvas: vi.fn(() => canvas),
    applyStroke: vi.fn(),
    stepTick: vi.fn(),
    captureFrame: vi.fn(() => canvas),
    dispose: vi.fn(),
  }
}

function renderCalls(engine: EngineAdapter<TestPayload>): RenderedStroke[][] {
  return vi.mocked(engine.renderPartialStrokes as ReturnType<typeof vi.fn>).mock.calls.map((call: [unknown]) => call[0] as RenderedStroke[])
}

function pointCountFor(call: RenderedStroke[], color: string): number {
  return call.find(({ stroke }) => stroke.color === color)?.pointCount ?? 0
}

function firstPointFor(call: RenderedStroke[], color: string): StudioPoint | null {
  return call.find(({ stroke }) => stroke.color === color)?.stroke.pts[0] ?? null
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
    const player = new AnimationPlayer<TestPayload>(engine)

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
    const player = new AnimationPlayer<TestPayload>(engine)

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
    const player = new AnimationPlayer<TestPayload>(engine)

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
    const player = new AnimationPlayer<TestPayload>(engine)

    player.play({ frameCount: 16, fps: 12 })
    advanceAnimationFrames(18)

    const calls = renderCalls(engine)
    const firstFrames = strokes.map(stroke => firstFrameFor(calls, stroke.color!))
    const firstFrameCounts = Array.from({ length: 16 }, (_, frame) => firstFrames.filter(firstFrame => firstFrame === frame).length)

    expect(firstFrames.at(-1)).toBe(15)
    expect(firstFrameCounts[15]).toBe(2)
    expect(firstFrameCounts.slice(0, 15).some(count => count === 2)).toBe(true)
    for (const stroke of strokes) {
      expect(pointCountFor(calls.at(-1)!, stroke.color!)).toBe(stroke.pts.length)
    }
  })

  it('applies a render-time stroke style override without mutating source strokes', () => {
    const sourceStroke = makeStroke('#source', 4, 0)
    const engine = createEngine([sourceStroke])
    const player = new AnimationPlayer<TestPayload>(engine)

    player.play({
      frameCount: 4,
      fps: 12,
      strokeStyleOverride: {
        brushId: 'override-brush',
        toolOverrides: { size: 3, opacity: 40 },
        engine: { tool: 'erase', params: { size: 3, opacity: 40 }, physicsMode: null },
      },
    })
    advanceAnimationFrames(1)

    const renderedStroke = renderCalls(engine)[0]?.[0]?.stroke

    expect(renderedStroke).toMatchObject({
      brushId: 'override-brush',
      toolOverrides: { size: 3, opacity: 40 },
    })
    expect(renderedStroke!.engine).toMatchObject({
      tool: 'erase',
      params: expect.objectContaining({ size: 3, opacity: 40 }),
      physicsMode: null,
    })
    expect(sourceStroke).toMatchObject({
      brushId: 'test-brush',
      color: '#source',
    })
    expect(sourceStroke.engine).toMatchObject({
      tool: 'paint',
      params: expect.objectContaining({ size: 8, opacity: 100 }),
    })
  })

  it('honors Play-frame annotations even when there are more strokes than frames', () => {
    const strokes = Array.from({ length: 20 }, (_, index) => makeStroke(`#overflow-${index}`, 4, index))
    const annotatedStroke = { ...makeStroke('#frame-edit', 4, 21), playFrame: 3 }
    const engine = createEngine([...strokes, annotatedStroke])
    const player = new AnimationPlayer<TestPayload>(engine)

    player.play({ frameCount: 16, fps: 12 })
    advanceAnimationFrames(18)

    const calls = renderCalls(engine)

    expect(firstFrameFor(calls, '#frame-edit')).toBe(3)
  })

  it('starts frame-annotated strokes at their selected Play frame and keeps drawing them progressively', () => {
    const scheduledStroke = { ...makeStroke('#frame-edit', 8, 2), playFrame: 2 }
    const engine = createEngine([makeStroke('#base', 8, 1), scheduledStroke])
    const player = new AnimationPlayer<TestPayload>(engine)

    player.play({ frameCount: 4, fps: 12 })
    advanceAnimationFrames(6)

    const calls = renderCalls(engine)

    expect(pointCountFor(calls[0], '#frame-edit')).toBe(0)
    expect(pointCountFor(calls[1], '#frame-edit')).toBe(0)
    expect(pointCountFor(calls[2], '#frame-edit')).toBeGreaterThan(0)
    expect(pointCountFor(calls[2], '#frame-edit')).toBeLessThan(8)
    expect(pointCountFor(calls.at(-1)!, '#frame-edit')).toBe(8)
  })

  it('keeps annotated strokes progressive when the Play script has more strokes than frames', () => {
    const baseStrokes = Array.from({ length: 6 }, (_, index) => makeStroke(`#base-${index}`, 4, index))
    const scheduledStroke = { ...makeStroke('#frame-edit', 12, 7), playFrame: 3 }
    const engine = createEngine([...baseStrokes, scheduledStroke])
    const player = new AnimationPlayer<TestPayload>(engine)

    player.play({ frameCount: 5, fps: 12 })
    advanceAnimationFrames(7)

    const calls = renderCalls(engine)

    expect(pointCountFor(calls[0], '#frame-edit')).toBe(0)
    expect(pointCountFor(calls[1], '#frame-edit')).toBe(0)
    expect(pointCountFor(calls[2], '#frame-edit')).toBe(0)
    expect(pointCountFor(calls[3], '#frame-edit')).toBeGreaterThan(0)
    expect(pointCountFor(calls[3], '#frame-edit')).toBeLessThan(12)
    expect(pointCountFor(calls.at(-1)!, '#frame-edit')).toBe(12)
  })
})
