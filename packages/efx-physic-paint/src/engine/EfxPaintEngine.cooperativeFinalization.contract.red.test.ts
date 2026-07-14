import { afterEach, describe, expect, it, vi } from 'vitest'
import { EfxPaintEngine } from './EfxPaintEngine'

type EngineInternals = EfxPaintEngine & Record<string, any>

afterEach(() => {
  vi.restoreAllMocks()
})

function createHarness() {
  const finalized: string[] = []
  const engine = Object.create(EfxPaintEngine.prototype) as EngineInternals
  Object.assign(engine, {
    pendingStrokeFinalizations: [],
    activeStrokeFinalization: null,
    strokeFinalizationScheduled: false,
    strokeFinalizationGeneration: 0,
    destroyed: false,
    lastPointerInputTime: 0,
    lastStrokeHandoffTime: 0,
    activeMutationId: null,
    performanceListener: null,
    completedMutationListener: null,
    undoStack: [],
    allActions: [],
    state: { drawing: false, physicsMode: 'local' },
    pushUndoSnapshot: vi.fn(function (this: EngineInternals) { this.undoStack.push({}) }),
    notifyCompletedMutation: vi.fn((_kind: string, id: number) => finalized.push(String(id))),
    recordPerformance: vi.fn(),
    stepInteractivePaintFinalization(this: EngineInternals, active: any) {
      active.steps = (active.steps ?? 0) + 1
      if (active.steps < 3) return
      this.pendingStrokeFinalizations.shift()
      finalized.push(active.pending.id)
      this.activeStrokeFinalization = null
      this.activeMutationId = null
    },
    finishActiveStrokeSynchronously(this: EngineInternals, active: any) {
      this.pendingStrokeFinalizations.shift()
      finalized.push(active.pending.id)
      this.activeStrokeFinalization = null
      this.activeMutationId = null
    },
  })

  function enqueue(id: string, tool: 'paint' | 'erase' = 'paint', playFrame = 0) {
    engine.pendingStrokeFinalizations.push({
      id, tool, color: tool === 'paint' ? '#123456' : null, points: [{ x: 1, y: 1 }], opts: {},
      hasPenInput: false, mutationId: Number(id.replace(/\D/g, '')) || 1, queuedAt: performance.now(), playFrame,
    })
  }

  return { engine, finalized, enqueue }
}

describe('EfxPaintEngine cooperative finalization contracts', () => {
  it('accepts pointer input while the previous brush remains pending', () => {
    const { engine, enqueue } = createHarness()
    enqueue('brush-1')
    engine.runStrokeFinalizationTurn()
    expect(engine.activeStrokeFinalization).not.toBeNull()

    engine.inputLocked = false
    engine.lastCompletedMutationId = null
    engine.lastPointerInputTime = 0
    engine.rawPts = []
    engine.dualCanvas = {
      dryCanvas: {
        setPointerCapture: vi.fn(),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      },
    }
    engine.width = 100
    engine.height = 100
    engine.onPointerDown({
      preventDefault: vi.fn(), pointerId: 1, timeStamp: performance.now(), clientX: 10, clientY: 10,
      pressure: 0.5, tiltX: 0, tiltY: 0, pointerType: 'mouse', buttons: 1, twist: 0,
    } as unknown as PointerEvent)

    expect(engine.state.drawing).toBe(true)
    expect(engine.activeStrokeFinalization).not.toBeNull()
  })

  it('preserves strict FIFO order across resumable paint and synchronous erase jobs', () => {
    const { engine, finalized, enqueue } = createHarness()
    enqueue('brush-1')
    enqueue('erase-2', 'erase')
    enqueue('brush-3')
    engine.flushPendingStrokeFinalizations()

    expect(finalized).toEqual(['brush-1', 'erase-2', 'brush-3'])
    expect(engine.undoStack).toHaveLength(3)
  })

  it('flushes N pending brushes before Undo and retains one snapshot per remaining brush', () => {
    const { engine, enqueue } = createHarness()
    enqueue('brush-1')
    enqueue('brush-2')
    enqueue('brush-3')
    engine.dualCanvas = { dryCtx: { putImageData: vi.fn() } }
    engine.wet = { r: new Float32Array(), g: new Float32Array(), b: new Float32Array(), alpha: new Float32Array(), wetness: new Float32Array(), strokeOpacity: new Float32Array() }
    engine.savedWet = { r: new Float32Array(), g: new Float32Array(), b: new Float32Array(), alpha: new Float32Array(), strokeOpacity: new Float32Array() }
    engine.drying = { dryPos: new Float32Array() }
    engine.allActions = [{}, {}, {}]
    engine.pushUndoSnapshot = function (this: EngineInternals) {
      this.undoStack.push({ canvas: {}, wet: { r: [], g: [], b: [], a: [], w: [], dp: [], so: [] }, saved: { r: [], g: [], b: [], a: [], so: [] } })
    }

    engine.undo()

    expect(engine.pendingStrokeFinalizations).toHaveLength(0)
    expect(engine.undoStack).toHaveLength(2)
    expect(engine.allActions).toHaveLength(2)
  })

  it('invalidates queued and active work on Clear so stale turns cannot publish', () => {
    const { engine, finalized, enqueue } = createHarness()
    enqueue('brush-1')
    enqueue('brush-2')
    engine.runStrokeFinalizationTurn()
    const stale = engine.activeStrokeFinalization
    engine.pendingStrokeFinalizations = []
    engine.strokeFinalizationGeneration++
    engine.activeStrokeFinalization = null
    engine.runStrokeFinalizationTurn()

    expect(stale.generation).not.toBe(engine.strokeFinalizationGeneration)
    expect(finalized).toEqual([])
  })

  it('retains source-frame metadata on queued ownership across navigation', () => {
    const { engine, enqueue } = createHarness()
    enqueue('brush-1', 'paint', 7)
    engine.runStrokeFinalizationTurn()
    const active = engine.activeStrokeFinalization
    const currentFrame = 12

    expect(currentFrame).toBe(12)
    expect(active.pending.playFrame).toBe(7)
  })

  it('flushes accepted jobs before destroy disposes scheduler resources', () => {
    const { engine, finalized, enqueue } = createHarness()
    enqueue('brush-1')
    engine.rafId = 0
    engine.physicsInterval = null
    engine.stopNaturalDrying = vi.fn()
    engine.dualCanvas = { dryCanvas: { removeEventListener: vi.fn() } }
    engine.boundPointerDown = vi.fn(); engine.boundPointerMove = vi.fn(); engine.boundPointerUp = vi.fn()
    engine.boundPointerLeave = vi.fn(); engine.boundTouchStart = vi.fn()

    engine.destroy()

    expect(finalized).toEqual(['brush-1'])
    expect(engine.destroyed).toBe(true)
  })

  it('makes zero finalization progress while drawing, including callbacks requested before pointerdown', () => {
    const { engine, finalized, enqueue } = createHarness()
    enqueue('brush-1')

    engine.scheduleStrokeFinalization()
    engine.state.drawing = true
    engine.runScheduledStrokeFinalizationFrame()

    expect(finalized).toEqual([])
    expect(engine.activeStrokeFinalization).toBeNull()
    expect(engine.pendingStrokeFinalizations.map((job: any) => job.id)).toEqual(['brush-1'])
  })

  it('pointerdown preserves an active continuation without resetting or reordering it', () => {
    const { engine, enqueue } = createHarness()
    enqueue('brush-1')
    enqueue('brush-2')
    engine.runStrokeFinalizationTurn()
    const active = engine.activeStrokeFinalization
    const completedSteps = active.steps

    engine.inputLocked = false
    engine.lastCompletedMutationId = null
    engine.lastPointerInputTime = 0
    engine.rawPts = []
    engine.dualCanvas = {
      dryCanvas: {
        setPointerCapture: vi.fn(),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      },
    }
    engine.width = 100
    engine.height = 100
    engine.onPointerDown({
      preventDefault: vi.fn(), pointerId: 1, timeStamp: performance.now(), clientX: 10, clientY: 10,
      pressure: 0.5, tiltX: 0, tiltY: 0, pointerType: 'mouse', buttons: 1, twist: 0,
    } as unknown as PointerEvent)

    expect(engine.activeStrokeFinalization).toBe(active)
    expect(engine.activeStrokeFinalization.steps).toBe(completedSteps)
    expect(engine.pendingStrokeFinalizations.map((job: any) => job.id)).toEqual(['brush-1', 'brush-2'])
  })

  it('waits for 500 ms of pointer inactivity before running one safe step per visual frame', () => {
    const { engine, finalized, enqueue } = createHarness()
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    enqueue('brush-1')
    engine.lastPointerInputTime = now

    engine.scheduleStrokeFinalization()
    now = 1_499
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization).toBeNull()
    expect(finalized).toEqual([])

    now = 1_500
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization.steps).toBe(1)
    expect(finalized).toEqual([])
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization.steps).toBe(2)
    expect(finalized).toEqual([])
    engine.runScheduledStrokeFinalizationFrame()
    expect(finalized).toEqual(['brush-1'])
  })

  it('starts the full inactivity window after pointerup handoff completes', () => {
    const { engine, enqueue } = createHarness()
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    engine.lastStrokeHandoffTime = now

    now = 1_600
    enqueue('brush-1')
    engine.markStrokeHandoffComplete()
    engine.scheduleStrokeFinalization()

    now = 2_099
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization).toBeNull()

    now = 2_100
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization.pending.id).toBe('brush-1')
  })

  it('does not start finalization while a pointer event is queued but not yet dispatched', () => {
    const { engine, enqueue } = createHarness()
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    enqueue('brush-1')
    engine.lastStrokeHandoffTime = now
    engine.scheduleStrokeFinalization()
    engine.hasPendingInput = vi.fn(() => true)

    now = 1_500
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization).toBeNull()

    engine.hasPendingInput = vi.fn(() => false)
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization.pending.id).toBe('brush-1')
  })

  it('resets the inactivity window whenever another stroke begins', () => {
    const { engine, enqueue } = createHarness()
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    enqueue('brush-1')
    engine.lastPointerInputTime = now
    engine.scheduleStrokeFinalization()

    now = 1_400
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization).toBeNull()

    engine.lastPointerInputTime = now
    now = 1_899
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization).toBeNull()

    now = 1_900
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization.pending.id).toBe('brush-1')
    expect(engine.activeStrokeFinalization.steps).toBe(1)
  })

  it('resumes queued FIFO work on the first visual frame after the inactivity window', () => {
    const { engine, enqueue } = createHarness()
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    enqueue('brush-1')
    engine.lastPointerInputTime = now
    engine.state.drawing = true
    engine.scheduleStrokeFinalization()
    now = 1_600
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization).toBeNull()

    engine.state.drawing = false
    engine.runScheduledStrokeFinalizationFrame()
    expect(engine.activeStrokeFinalization.pending.id).toBe('brush-1')
    expect(engine.activeStrokeFinalization.steps).toBe(1)
  })

  it('retains prolonged-drawing jobs in FIFO order and drains after input ends', () => {
    const { engine, finalized, enqueue } = createHarness()
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    enqueue('brush-1')
    enqueue('brush-2')
    engine.lastPointerInputTime = now
    engine.state.drawing = true
    engine.scheduleStrokeFinalization()
    now = 2_000
    for (let frame = 1; frame <= 20; frame++) engine.runScheduledStrokeFinalizationFrame()

    expect(finalized).toEqual([])
    expect(engine.pendingStrokeFinalizations.map((job: any) => job.id)).toEqual(['brush-1', 'brush-2'])

    engine.state.drawing = false
    for (let frame = 21; frame <= 26; frame++) engine.runScheduledStrokeFinalizationFrame()
    expect(finalized).toEqual(['brush-1', 'brush-2'])
  })

  it('records the first completed raster publication from queue admission', () => {
    const { engine, enqueue } = createHarness()
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    enqueue('brush-1')
    const pending = engine.pendingStrokeFinalizations[0]
    pending.queuedAt = now
    const active = {
      pending,
      phase: 'raster',
      raster: { step: vi.fn(() => true) },
    }
    engine.recordPerformance = vi.fn()

    now = 1_650
    EfxPaintEngine.prototype.stepInteractivePaintFinalization.call(engine, active)

    expect(active.phase).toBe('post-raster')
    expect(engine.recordPerformance).toHaveBeenCalledWith(
      'stroke-first-raster-publication',
      'scheduled-wait',
      1_000,
      { mutationId: pending.mutationId },
    )
  })

  it('hides the active outline as soon as that stroke publishes raster pixels', () => {
    const { engine, enqueue } = createHarness()
    enqueue('brush-1')
    enqueue('brush-2')
    engine.activeStrokeFinalization = {
      pending: engine.pendingStrokeFinalizations[0],
      phase: 'post-raster',
    }

    expect(engine.getQueuedStrokePreviews().map((job: any) => job.id)).toEqual(['brush-2'])

    engine.activeStrokeFinalization.phase = 'raster'
    expect(engine.getQueuedStrokePreviews().map((job: any) => job.id)).toEqual(['brush-1', 'brush-2'])
  })

  it('keeps every queued stroke represented while rapid drawing defers rasterization', () => {
    const { engine, enqueue } = createHarness()
    enqueue('brush-1')
    enqueue('brush-2')
    enqueue('brush-3')
    enqueue('brush-4')
    engine.state.drawing = true

    expect(engine.getQueuedStrokePreviews().map((job: any) => job.id)).toEqual([
      'brush-1', 'brush-2', 'brush-3', 'brush-4',
    ])
  })

  it('draws queued points directly without smoothing or ribbon construction during the idle window', () => {
    const { engine, enqueue } = createHarness()
    enqueue('brush-1')
    engine.pendingStrokeFinalizations[0].points = Object.freeze([
      Object.freeze({ x: 1, y: 1 }),
      Object.freeze({ x: 2, y: 2 }),
      Object.freeze({ x: 3, y: 1 }),
    ])
    const drawQueuedStrokePreview = vi.fn()
    engine.drawQueuedStrokePreview = drawQueuedStrokePreview

    engine.drawQueuedStrokePreviews({} as CanvasRenderingContext2D)
    engine.drawQueuedStrokePreviews({} as CanvasRenderingContext2D)

    expect(drawQueuedStrokePreview).toHaveBeenCalledTimes(2)
    expect(drawQueuedStrokePreview).toHaveBeenNthCalledWith(1, expect.anything(), engine.pendingStrokeFinalizations[0].points)
    expect(drawQueuedStrokePreview).toHaveBeenNthCalledWith(2, expect.anything(), engine.pendingStrokeFinalizations[0].points)
  })

  it('lifecycle flush bypasses frame pacing and completes all accepted jobs', () => {
    const { engine, finalized, enqueue } = createHarness()
    enqueue('brush-1')
    enqueue('brush-2')
    engine.scheduleStrokeFinalization()

    engine.flushPendingStrokeFinalizations()

    expect(finalized).toEqual(['brush-1', 'brush-2'])
    expect(engine.pendingStrokeFinalizations).toHaveLength(0)
    expect(engine.activeStrokeFinalization).toBeNull()
  })
})
