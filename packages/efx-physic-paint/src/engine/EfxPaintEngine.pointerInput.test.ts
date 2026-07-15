import { afterEach, describe, expect, it, vi } from 'vitest'
import { EfxPaintEngine } from './EfxPaintEngine'
import type { BrushOpts, PenPoint } from '../types'

type EngineInternals = EfxPaintEngine & Record<string, any>

afterEach(() => {
  vi.restoreAllMocks()
})

type PointerSample = {
  x: number
  y: number
  timeStamp: number
  pressure?: number
  tiltX?: number
  tiltY?: number
  twist?: number
  buttons?: number
  pointerType?: string
}

const brushOpts: BrushOpts = {
  size: 12,
  opacity: 100,
  pressure: 100,
  waterAmount: 0,
  dryAmount: 100,
  edgeDetail: 0,
  pickup: 0,
  eraseStrength: 100,
  antiAlias: 0,
}

function pointerEvent(sample: PointerSample, coalesced: PointerEvent[] = []): PointerEvent {
  return {
    clientX: sample.x,
    clientY: sample.y,
    timeStamp: sample.timeStamp,
    pressure: sample.pressure ?? 0.5,
    tiltX: sample.tiltX ?? 0,
    tiltY: sample.tiltY ?? 0,
    twist: sample.twist ?? 0,
    buttons: sample.buttons ?? 1,
    pointerType: sample.pointerType ?? 'pen',
    pointerId: 1,
    preventDefault: vi.fn(),
    getCoalescedEvents: () => coalesced,
  } as unknown as PointerEvent
}

function createHarness(tool: 'paint' | 'erase' = 'paint') {
  const engine = Object.create(EfxPaintEngine.prototype) as EngineInternals
  Object.assign(engine, {
    width: 100,
    height: 100,
    inputLocked: false,
    destroyed: false,
    rawPts: [],
    lastPointerSampleTimeStamp: Number.NEGATIVE_INFINITY,
    lastAcceptedPointerSampleTimeStamp: Number.NEGATIVE_INFINITY,
    lastPointerInputTime: 0,
    lastNativePenInputTime: 0,
    nativePenInput: null,
    cursorX: -1,
    cursorY: -1,
    previewStroke: null,
    allActions: [],
    undoStack: [],
    pendingStrokeFinalizations: [],
    activeStrokeFinalization: null,
    strokeFinalizationScheduled: false,
    strokeFinalizationGeneration: 0,
    nextMutationId: 1,
    activeMutationId: null,
    lastCompletedMutationId: null,
    performanceListener: null,
    completedMutationListener: null,
    historyAvailabilityListener: null,
    redoStack: [],
    color: '#123456',
    state: {
      drawing: false,
      tool,
      brushOpts: { ...brushOpts },
      hasPenInput: false,
      physicsMode: null,
    },
    dualCanvas: {
      dryCanvas: {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
      },
    },
    getStrokeMetadata: undefined,
    recordPerformance: vi.fn(),
  })
  return engine
}

function draw(engine: EngineInternals, samples: PointerSample[]): void {
  engine.onPointerDown(pointerEvent(samples[0]))
  for (const sample of samples.slice(1)) engine.onPointerMove(pointerEvent(sample))
}

function xy(points: PenPoint[]): Array<[number, number]> {
  return points.map(({ x, y }) => [x, y])
}

function pen(points: PenPoint[]): Array<[number, number, number, number, number]> {
  return points.map(({ p, tx, ty, tw, spd }) => [p, tx, ty, tw, spd])
}

describe('EfxPaintEngine pointer sample capture', () => {
  it('drains pointerup coalesced events in chronological array order before release', () => {
    const engine = createHarness()
    draw(engine, [{ x: 10, y: 10, timeStamp: 10 }, { x: 20, y: 10, timeStamp: 20 }])
    const coalesced = [
      pointerEvent({ x: 25, y: 14, timeStamp: 25 }),
      pointerEvent({ x: 29, y: 20, timeStamp: 29 }),
    ]

    engine.onPointerUp(pointerEvent({ x: 31, y: 23, timeStamp: 31, buttons: 0 }, coalesced))

    expect(xy(engine.pendingStrokeFinalizations[0].points)).toEqual([
      [10, 10], [20, 10], [25, 14], [29, 20], [31, 23],
    ])
  })

  it('appends a valid meaningfully different release coordinate', () => {
    const engine = createHarness()
    draw(engine, [{ x: 10, y: 10, timeStamp: 10 }, { x: 20, y: 10, timeStamp: 20 }, { x: 30, y: 10, timeStamp: 30 }])

    engine.onPointerUp(pointerEvent({ x: 36, y: 14, timeStamp: 36, buttons: 0 }))

    expect(xy(engine.pendingStrokeFinalizations[0].points)).toEqual([[10, 10], [20, 10], [30, 10], [36, 14]])
  })

  it('publishes Undo availability at the accepted pointer-up boundary', () => {
    const engine = createHarness()
    const listener = vi.fn()
    engine.setHistoryAvailabilityListener(listener)
    draw(engine, [{ x: 10, y: 10, timeStamp: 10 }, { x: 20, y: 10, timeStamp: 20 }, { x: 30, y: 10, timeStamp: 30 }])

    engine.onPointerUp(pointerEvent({ x: 36, y: 14, timeStamp: 36, buttons: 0 }))

    expect(listener).toHaveBeenNthCalledWith(1, { undo: 0, redo: 0 })
    expect(listener).toHaveBeenNthCalledWith(2, { undo: 1, redo: 0 })
    expect(engine.activeStrokeFinalization).toBeNull()
    expect(engine.pendingStrokeFinalizations).toHaveLength(1)
  })

  it('ignores a near-duplicate release coordinate', () => {
    const engine = createHarness()
    draw(engine, [{ x: 10, y: 10, timeStamp: 10 }, { x: 20, y: 10, timeStamp: 20 }, { x: 30, y: 10, timeStamp: 30 }])

    engine.onPointerUp(pointerEvent({ x: 30.5, y: 10.5, timeStamp: 35, buttons: 0 }))

    expect(xy(engine.pendingStrokeFinalizations[0].points)).toEqual([[10, 10], [20, 10], [30, 10]])
  })

  it.each([
    ['non-finite', { x: Number.NaN, y: 20, timeStamp: 35 }],
    ['out-of-canvas', { x: 105, y: 20, timeStamp: 35 }],
  ])('ignores a %s release coordinate', (_label, release) => {
    const engine = createHarness()
    draw(engine, [{ x: 10, y: 10, timeStamp: 10 }, { x: 20, y: 10, timeStamp: 20 }, { x: 30, y: 10, timeStamp: 30 }])

    engine.onPointerUp(pointerEvent({ ...release, buttons: 0 }))

    expect(xy(engine.pendingStrokeFinalizations[0].points)).toEqual([[10, 10], [20, 10], [30, 10]])
  })

  it('ignores a stale release coordinate that would synthesize a long closing segment', () => {
    const engine = createHarness()
    draw(engine, [{ x: 10, y: 10, timeStamp: 10 }, { x: 20, y: 10, timeStamp: 20 }])
    const terminalCurve = [
      pointerEvent({ x: 28, y: 8, timeStamp: 31 }),
      pointerEvent({ x: 34, y: 13, timeStamp: 34 }),
      pointerEvent({ x: 30, y: 19, timeStamp: 37 }),
    ]

    engine.onPointerUp(pointerEvent({ x: 80, y: 80, timeStamp: 30, buttons: 0 }, terminalCurve))

    expect(xy(engine.pendingStrokeFinalizations[0].points)).toEqual([
      [10, 10], [20, 10], [28, 8], [34, 13], [30, 19],
    ])
  })

  it('retains rapid-loop terminal curvature instead of closing directly to release', () => {
    const engine = createHarness()
    draw(engine, [{ x: 10, y: 30, timeStamp: 10 }, { x: 20, y: 30, timeStamp: 20 }])
    const loop = [
      pointerEvent({ x: 28, y: 24, timeStamp: 24 }),
      pointerEvent({ x: 34, y: 30, timeStamp: 28 }),
      pointerEvent({ x: 28, y: 36, timeStamp: 32 }),
      pointerEvent({ x: 22, y: 30, timeStamp: 36 }),
    ]

    engine.onPointerUp(pointerEvent({ x: 20, y: 26, timeStamp: 40, buttons: 0 }, loop))

    expect(xy(engine.pendingStrokeFinalizations[0].points).slice(-5)).toEqual([
      [28, 24], [34, 30], [28, 36], [22, 30], [20, 26],
    ])
  })

  it('keeps the valid endpoint of a short accent or terminal flick', () => {
    const engine = createHarness()
    draw(engine, [{ x: 40, y: 40, timeStamp: 10 }, { x: 43, y: 36, timeStamp: 14 }])
    const flick = [pointerEvent({ x: 47, y: 31, timeStamp: 18 })]

    engine.onPointerUp(pointerEvent({ x: 52, y: 25, timeStamp: 22, buttons: 0 }, flick))

    expect(xy(engine.pendingStrokeFinalizations[0].points)).toEqual([[40, 40], [43, 36], [47, 31], [52, 25]])
  })

  it('gives queued preview, action history, and final raster value-identical immutable points', () => {
    const engine = createHarness('erase')
    draw(engine, [{ x: 10, y: 10, timeStamp: 10 }, { x: 20, y: 12, timeStamp: 20 }, { x: 30, y: 16, timeStamp: 30 }])
    engine.onPointerUp(pointerEvent({ x: 38, y: 22, timeStamp: 38, buttons: 0 }))
    const queuedPoints = engine.pendingStrokeFinalizations[0].points
    const actionPoints = engine.allActions[0].points
    const rasterPoints: PenPoint[][] = []
    engine.captureUndoSnapshot = vi.fn(() => ({ mutationId: 1 }))
    engine.applyStrokeToEngine = vi.fn((_tool: string, points: PenPoint[]) => rasterPoints.push(points.map(point => ({ ...point }))))
    engine.notifyCompletedMutation = vi.fn()

    engine.flushPendingStrokeFinalizations()

    expect(actionPoints).toEqual(queuedPoints)
    expect(actionPoints).not.toBe(queuedPoints)
    expect(actionPoints.every((point: PenPoint, index: number) => point !== queuedPoints[index])).toBe(true)
    expect(rasterPoints[0]).toEqual(queuedPoints)
    expect(Object.isFrozen(actionPoints)).toBe(true)
    expect(actionPoints.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(queuedPoints)).toBe(true)
    expect(queuedPoints.every(Object.isFrozen)).toBe(true)
  })

  it('preserves pointermove coalesced event array order', () => {
    const engine = createHarness()
    engine.onPointerDown(pointerEvent({ x: 10, y: 10, timeStamp: 10 }))
    const coalesced = [
      pointerEvent({ x: 16, y: 10, timeStamp: 16 }),
      pointerEvent({ x: 14, y: 16, timeStamp: 18 }),
      pointerEvent({ x: 20, y: 18, timeStamp: 20 }),
    ]

    engine.onPointerMove(pointerEvent({ x: 99, y: 99, timeStamp: 21 }, coalesced))

    expect(xy(engine.rawPts)).toEqual([[10, 10], [16, 10], [14, 16], [20, 18]])
  })

  it('preserves per-event pen pressure, tilt, twist, and timestamp-derived speed for a long coalesced stroke', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100)
    const engine = createHarness()
    engine.onPointerDown(pointerEvent({ x: 10, y: 10, timeStamp: 10, pressure: 0.15, tiltX: -20, tiltY: 8, twist: 5 }))
    const coalesced = [
      pointerEvent({ x: 20, y: 10, timeStamp: 20, pressure: 0.35, tiltX: -10, tiltY: 12, twist: 15 }),
      pointerEvent({ x: 40, y: 10, timeStamp: 40, pressure: 0.7, tiltX: 5, tiltY: 18, twist: 35 }),
      pointerEvent({ x: 70, y: 10, timeStamp: 70, pressure: 0.95, tiltX: 20, tiltY: 24, twist: 65 }),
    ]

    engine.onPointerMove(pointerEvent({ x: 99, y: 99, timeStamp: 71 }, coalesced))

    expect(pen(engine.rawPts)).toEqual([
      [0.15, -20, 8, 5, 0],
      [0.35, -10, 12, 15, 1],
      [0.7, 5, 18, 35, 1],
      [0.95, 20, 24, 65, 1],
    ])
    expect(engine.state.hasPenInput).toBe(true)
  })

  it('uses native tablet pressure only when PointerEvent pressure is the WebKit fixed fallback', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100)
    const engine = createHarness()
    engine.nativePenInput = { pressure: 0.82, tiltX: 17, tiltY: -9 }
    engine.lastNativePenInputTime = 100

    engine.onPointerDown(pointerEvent({ x: 10, y: 10, timeStamp: 10, pressure: 0.5, tiltX: 0, tiltY: 0 }))
    engine.onPointerMove(pointerEvent({ x: 20, y: 10, timeStamp: 20, pressure: 0.3, tiltX: 4, tiltY: 6 }))

    expect(pen(engine.rawPts)).toEqual([
      [0.82, 17, -9, 0, 0],
      [0.3, 4, 6, 0, 1],
    ])
    expect(engine.state.hasPenInput).toBe(true)
  })

  it('keeps native pen identity through a mouse-typed release event', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100)
    const engine = createHarness()
    engine.nativePenInput = { pressure: 0.4, tiltX: 12, tiltY: -6 }
    engine.lastNativePenInputTime = 100

    engine.onPointerDown(pointerEvent({ x: 10, y: 10, timeStamp: 10, pointerType: 'mouse', pressure: 0.5 }))
    engine.onPointerMove(pointerEvent({ x: 20, y: 10, timeStamp: 20, pointerType: 'mouse', pressure: 0.5 }))
    engine.onPointerUp(pointerEvent({ x: 30, y: 10, timeStamp: 30, pointerType: 'mouse', pressure: 0, buttons: 0 }))

    expect(engine.pendingStrokeFinalizations[0].hasPenInput).toBe(true)
    expect(engine.allActions[0].hasPenInput).toBe(true)
  })

  it('keeps pending strokes deferred while the pen hovers toward the next stroke', () => {
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const engine = createHarness()
    engine.lastStrokeHandoffTime = now
    engine.strokeFinalizationScheduled = true
    engine.runStrokeFinalizationTurn = vi.fn()

    now = 1_400
    engine.onPointerMove(pointerEvent({ x: 40, y: 40, timeStamp: 40, buttons: 0, pointerType: 'mouse' }))
    now = 1_800
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.runStrokeFinalizationTurn).not.toHaveBeenCalled()

    now = 1_899
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.runStrokeFinalizationTurn).not.toHaveBeenCalled()

    now = 1_900
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.runStrokeFinalizationTurn).toHaveBeenCalledTimes(1)
  })

  it('does not finalize stroke 1 when stroke 2 begins and completes inside the idle window', () => {
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const engine = createHarness()
    engine.lastStrokeHandoffTime = 0
    engine.strokeFinalizationScheduled = false
    engine.runStrokeFinalizationTurn = vi.fn()
    engine.flushPendingStrokeFinalizations = vi.fn()

    draw(engine, [
      { x: 10, y: 10, timeStamp: 10 },
      { x: 20, y: 12, timeStamp: 20 },
      { x: 30, y: 16, timeStamp: 30 },
    ])
    engine.onPointerUp(pointerEvent({ x: 38, y: 20, timeStamp: 38, buttons: 0 }))
    expect(engine.pendingStrokeFinalizations).toHaveLength(1)

    now = 1_200
    engine.runScheduledStrokeFinalizationFrame()
    engine.onPointerDown(pointerEvent({ x: 50, y: 50, timeStamp: 50 }))
    engine.onPointerMove(pointerEvent({ x: 60, y: 52, timeStamp: 60 }))
    engine.onPointerMove(pointerEvent({ x: 70, y: 56, timeStamp: 70 }))
    now = 1_300
    engine.onPointerUp(pointerEvent({ x: 78, y: 60, timeStamp: 78, buttons: 0 }))
    engine.runScheduledStrokeFinalizationFrame()

    expect(engine.pendingStrokeFinalizations).toHaveLength(2)
    expect(engine.runStrokeFinalizationTurn).not.toHaveBeenCalled()
    expect(engine.flushPendingStrokeFinalizations).not.toHaveBeenCalled()

    now = 1_799
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.runStrokeFinalizationTurn).not.toHaveBeenCalled()

    now = 1_800
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.runStrokeFinalizationTurn).toHaveBeenCalledTimes(1)
  })
})
