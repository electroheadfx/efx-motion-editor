import { afterEach, describe, expect, it, vi } from 'vitest'
import { EfxPaintEngine } from './EfxPaintEngine'

type EngineInternals = EfxPaintEngine & Record<string, any>

afterEach(() => {
  vi.restoreAllMocks()
})

function makeSnapshot(mutationId: number, id: string, value: number) {
  return {
    mutationId,
    canvas: { id },
    wet: {
      r: new Float32Array([value + 1]), g: new Float32Array([value + 2]), b: new Float32Array([value + 3]),
      a: new Float32Array([value + 4]), w: new Float32Array([value + 5]), dp: new Float32Array([value + 6]), so: new Float32Array([value / 100]),
    },
    saved: {
      r: new Float32Array([value + 7]), g: new Float32Array([value + 8]), b: new Float32Array([value + 9]),
      a: new Float32Array([value + 10]), so: new Float32Array([(value + 1) / 100]),
    },
  }
}

function installSnapshotBuffers(engine: EngineInternals, snapshot: ReturnType<typeof makeSnapshot>) {
  engine.dualCanvas = { dryCtx: { putImageData: vi.fn() } }
  engine.wet = {
    r: new Float32Array(snapshot.wet.r), g: new Float32Array(snapshot.wet.g), b: new Float32Array(snapshot.wet.b),
    alpha: new Float32Array(snapshot.wet.a), wetness: new Float32Array(snapshot.wet.w), strokeOpacity: new Float32Array(snapshot.wet.so),
  }
  engine.savedWet = {
    r: new Float32Array(snapshot.saved.r), g: new Float32Array(snapshot.saved.g), b: new Float32Array(snapshot.saved.b),
    alpha: new Float32Array(snapshot.saved.a), strokeOpacity: new Float32Array(snapshot.saved.so),
  }
  engine.drying = { dryPos: new Float32Array(snapshot.wet.dp) }
}

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
    redoStack: [],
    allActions: [],
    state: { drawing: false, physicsMode: 'local' },
    captureUndoSnapshot: vi.fn((mutationId: number) => makeSnapshot(mutationId, `before-${mutationId}`, mutationId * 10)),
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
    const mutationId = Number(id.replace(/\D/g, '')) || 1
    const pending = {
      id, tool, color: tool === 'paint' ? '#123456' : null, points: [{ x: 1, y: 1 }], opts: {},
      hasPenInput: false, mutationId, queuedAt: performance.now(), playFrame,
    }
    engine.pendingStrokeFinalizations.push(pending)
    engine.undoStack.push({ mutationId, actions: [{ mutationId }], checkpoint: null, deferred: pending })
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

  it('moves grouped history bidirectionally without replaying finalized strokes', () => {
    const { engine } = createHarness()
    const before = makeSnapshot(2, 'before', 10)
    const after = makeSnapshot(2, 'after', 20)
    engine.undoStack = [{ mutationId: 2, actions: [{ mutationId: 2 }, { diffusionFrames: 6 }], checkpoint: before, deferred: null }]
    engine.allActions = [{ mutationId: 1 }, { mutationId: 2 }, { diffusionFrames: 6 }]
    installSnapshotBuffers(engine, after)
    engine.captureUndoSnapshot = vi.fn()
      .mockReturnValueOnce(after)
      .mockReturnValueOnce(before)
    engine.redrawAll = vi.fn()
    engine.renderAllStrokes = vi.fn()

    expect(engine.undo()).toBe(true)
    expect(engine.allActions).toEqual([{ mutationId: 1 }])
    expect(engine.undoStack).toHaveLength(0)
    expect(engine.redoStack).toHaveLength(1)

    expect(engine.redo()).toBe(true)
    expect(engine.allActions).toEqual([{ mutationId: 1 }, { mutationId: 2 }, { diffusionFrames: 6 }])
    expect(engine.undoStack).toHaveLength(1)
    expect(engine.redoStack).toHaveLength(0)
    expect(engine.redrawAll).not.toHaveBeenCalled()
    expect(engine.renderAllStrokes).not.toHaveBeenCalled()
  })

  it('cancels the latest queued brush on Undo without rasterizing it', () => {
    const { engine, finalized, enqueue } = createHarness()
    enqueue('brush-1')
    engine.allActions = [{ mutationId: 1 }]
    engine.strokeFinalizationScheduled = true
    engine.dualCanvas = { dryCtx: { putImageData: vi.fn() } }
    engine.wet = { r: new Float32Array(), g: new Float32Array(), b: new Float32Array(), alpha: new Float32Array(), wetness: new Float32Array(), strokeOpacity: new Float32Array() }
    engine.savedWet = { r: new Float32Array(), g: new Float32Array(), b: new Float32Array(), alpha: new Float32Array(), strokeOpacity: new Float32Array() }
    engine.drying = { dryPos: new Float32Array() }

    engine.undo()

    expect(finalized).toEqual([])
    expect(engine.pendingStrokeFinalizations).toHaveLength(0)
    expect(engine.activeStrokeFinalization).toBeNull()
    expect(engine.strokeFinalizationScheduled).toBe(false)
    expect(engine.undoStack).toHaveLength(0)
    expect(engine.allActions).toHaveLength(0)
    expect(engine.redoStack[0].actions).toEqual([{ mutationId: 1 }])
  })

  it('cancels active finalization and exactly restores its pre-brush snapshot', () => {
    const { engine, finalized, enqueue } = createHarness()
    enqueue('brush-1')
    const pending = engine.pendingStrokeFinalizations[0]
    const stale = {
      pending,
      generation: 0,
      finalizationStartedAt: 0,
      phase: 'raster',
      raster: null,
      fluid: null,
    }
    const canvas = { id: 'before-brush' }
    engine.allActions = [{ mutationId: 1 }]
    engine.activeStrokeFinalization = stale
    engine.activeMutationId = 1
    engine.strokeFinalizationScheduled = true
    engine.undoStack = [{
      mutationId: 1, actions: [{ mutationId: 1 }], checkpoint: {
      mutationId: 1,
      canvas,
      wet: {
        r: new Float32Array([1]), g: new Float32Array([2]), b: new Float32Array([3]),
        a: new Float32Array([4]), w: new Float32Array([5]), dp: new Float32Array([6]), so: new Float32Array([0.7]),
      },
      saved: {
        r: new Float32Array([7]), g: new Float32Array([8]), b: new Float32Array([9]),
        a: new Float32Array([10]), so: new Float32Array([0.8]),
      },
    }, deferred: pending }]
    engine.dualCanvas = { dryCtx: { putImageData: vi.fn() } }
    engine.wet = {
      r: new Float32Array([91]), g: new Float32Array([92]), b: new Float32Array([93]),
      alpha: new Float32Array([94]), wetness: new Float32Array([95]), strokeOpacity: new Float32Array([0.9]),
    }
    engine.savedWet = {
      r: new Float32Array([97]), g: new Float32Array([98]), b: new Float32Array([99]),
      alpha: new Float32Array([100]), strokeOpacity: new Float32Array([1]),
    }
    engine.drying = { dryPos: new Float32Array([96]) }

    engine.undo()
    engine.completeActiveStrokeFinalization(stale)

    expect(finalized).toEqual(['1'])
    expect(engine.strokeFinalizationGeneration).toBe(1)
    expect(engine.pendingStrokeFinalizations).toHaveLength(0)
    expect(engine.activeStrokeFinalization).toBeNull()
    expect(engine.activeMutationId).toBeNull()
    expect(engine.strokeFinalizationScheduled).toBe(false)
    expect(engine.dualCanvas.dryCtx.putImageData).toHaveBeenCalledWith(canvas, 0, 0)
    expect(Array.from(engine.wet.r)).toEqual([1])
    expect(Array.from(engine.wet.g)).toEqual([2])
    expect(Array.from(engine.wet.b)).toEqual([3])
    expect(Array.from(engine.wet.alpha)).toEqual([4])
    expect(Array.from(engine.wet.wetness)).toEqual([5])
    expect(Array.from(engine.drying.dryPos)).toEqual([6])
    expect(engine.wet.strokeOpacity[0]).toBeCloseTo(0.7)
    expect(Array.from(engine.savedWet.r)).toEqual([7])
    expect(Array.from(engine.savedWet.g)).toEqual([8])
    expect(Array.from(engine.savedWet.b)).toEqual([9])
    expect(Array.from(engine.savedWet.alpha)).toEqual([10])
    expect(engine.savedWet.strokeOpacity[0]).toBeCloseTo(0.8)
    expect(engine.allActions).toHaveLength(0)
    expect(engine.redoStack[0].actions).toEqual([{ mutationId: 1 }])
  })

  it('undoes the latest accepted brush when a physics continuation trails it', () => {
    const { engine, finalized } = createHarness()
    const loadedBaseline = { tool: 'paint', mutationId: undefined }
    const latestBrush = { tool: 'paint', mutationId: 2 }
    const physicsContinuation = { tool: 'paint', mutationId: undefined, points: [], diffusionFrames: 6 }
    const latestSnapshot = {
      mutationId: 2,
      canvas: { id: 'before-latest' },
      wet: {
        r: new Float32Array([11]), g: new Float32Array([12]), b: new Float32Array([13]),
        a: new Float32Array([14]), w: new Float32Array([15]), dp: new Float32Array([16]), so: new Float32Array([0.4]),
      },
      saved: {
        r: new Float32Array([17]), g: new Float32Array([18]), b: new Float32Array([19]),
        a: new Float32Array([20]), so: new Float32Array([0.5]),
      },
    }
    engine.allActions = [loadedBaseline, latestBrush, physicsContinuation]
    engine.undoStack = [{ mutationId: 2, actions: [latestBrush, physicsContinuation], checkpoint: latestSnapshot, deferred: null }]
    engine.dualCanvas = { dryCtx: { putImageData: vi.fn() } }
    engine.wet = {
      r: new Float32Array([91]), g: new Float32Array([92]), b: new Float32Array([93]),
      alpha: new Float32Array([94]), wetness: new Float32Array([95]), strokeOpacity: new Float32Array([0.9]),
    }
    engine.savedWet = {
      r: new Float32Array([97]), g: new Float32Array([98]), b: new Float32Array([99]),
      alpha: new Float32Array([100]), strokeOpacity: new Float32Array([1]),
    }
    engine.drying = { dryPos: new Float32Array([96]) }

    engine.undo()

    expect(finalized).toEqual(['2'])
    expect(engine.dualCanvas.dryCtx.putImageData).toHaveBeenCalledWith(latestSnapshot.canvas, 0, 0)
    expect(engine.allActions).toEqual([loadedBaseline])
    expect(engine.redoStack[0].actions).toEqual([latestBrush, physicsContinuation])
  })

  it('restores the latest finalized brush by identity and preserves earlier history', () => {
    const { engine, finalized } = createHarness()
    const firstAction = { mutationId: 1 }
    const latestAction = { mutationId: 2 }
    const firstSnapshot = {
      mutationId: 1,
      canvas: { id: 'before-first' },
      wet: {
        r: new Float32Array([0]), g: new Float32Array([0]), b: new Float32Array([0]),
        a: new Float32Array([0]), w: new Float32Array([0]), dp: new Float32Array([0]), so: new Float32Array([0]),
      },
      saved: {
        r: new Float32Array([0]), g: new Float32Array([0]), b: new Float32Array([0]),
        a: new Float32Array([0]), so: new Float32Array([0]),
      },
    }
    const latestSnapshot = {
      mutationId: 2,
      canvas: { id: 'before-latest' },
      wet: {
        r: new Float32Array([11]), g: new Float32Array([12]), b: new Float32Array([13]),
        a: new Float32Array([14]), w: new Float32Array([15]), dp: new Float32Array([16]), so: new Float32Array([0.4]),
      },
      saved: {
        r: new Float32Array([17]), g: new Float32Array([18]), b: new Float32Array([19]),
        a: new Float32Array([20]), so: new Float32Array([0.5]),
      },
    }
    engine.allActions = [firstAction, latestAction]
    engine.undoStack = [
      { mutationId: 1, actions: [firstAction], checkpoint: firstSnapshot, deferred: null },
      { mutationId: 2, actions: [latestAction], checkpoint: latestSnapshot, deferred: null },
    ]
    engine.dualCanvas = { dryCtx: { putImageData: vi.fn() } }
    engine.wet = {
      r: new Float32Array([91]), g: new Float32Array([92]), b: new Float32Array([93]),
      alpha: new Float32Array([94]), wetness: new Float32Array([95]), strokeOpacity: new Float32Array([0.9]),
    }
    engine.savedWet = {
      r: new Float32Array([97]), g: new Float32Array([98]), b: new Float32Array([99]),
      alpha: new Float32Array([100]), strokeOpacity: new Float32Array([1]),
    }
    engine.drying = { dryPos: new Float32Array([96]) }

    engine.undo()

    expect(finalized).toEqual(['2'])
    expect(engine.dualCanvas.dryCtx.putImageData).toHaveBeenCalledWith(latestSnapshot.canvas, 0, 0)
    expect(Array.from(engine.wet.r)).toEqual([11])
    expect(Array.from(engine.savedWet.alpha)).toEqual([20])
    expect(engine.undoStack).toEqual([{ mutationId: 1, actions: [firstAction], checkpoint: firstSnapshot, deferred: null }])
    expect(engine.allActions).toEqual([firstAction])
    expect(engine.redoStack[0].actions).toEqual([latestAction])
  })

  it('resets active-frame script and removed history at the navigation Clear boundary', () => {
    const { engine } = createHarness()
    engine.allActions = [{ mutationId: 1 }]
    engine.undoStack = [{ mutationId: 1 }]
    engine.redoStack = [{ mutationId: 0 }]
    engine.stopNaturalDrying = vi.fn()
    engine.wet = {
      r: new Float32Array(1), g: new Float32Array(1), b: new Float32Array(1),
      alpha: new Float32Array(1), wetness: new Float32Array(1), strokeOpacity: new Float32Array(1),
    }
    engine.savedWet = {
      r: new Float32Array(1), g: new Float32Array(1), b: new Float32Array(1),
      alpha: new Float32Array(1), strokeOpacity: new Float32Array(1),
    }
    engine.drying = { dryPos: new Float32Array(1) }
    engine.blowDX = new Float32Array(1)
    engine.blowDY = new Float32Array(1)
    engine.lastStrokeMask = new Uint8Array(1)
    engine.fluid = {
      u: new Float32Array(1), v: new Float32Array(1), u0: new Float32Array(1),
      v0: new Float32Array(1), p: new Float32Array(1), div: new Float32Array(1),
    }
    engine.bgCtx = { fillStyle: '', clearRect: vi.fn(), fillRect: vi.fn(), getImageData: vi.fn(() => ({})) }
    engine.state.bgMode = 'transparent'
    engine.paperTextures = new Map()
    engine.userPhoto = null
    engine.redrawPreviewBase = vi.fn()
    engine.previewBaseEnabled = true
    engine.dualCanvas = {
      dryCtx: { clearRect: vi.fn(), putImageData: vi.fn() },
      displayCtx: { clearRect: vi.fn() },
    }

    engine.clear()

    expect(engine.getStrokes()).toEqual([])
    expect(engine.undoStack).toEqual([])
    expect(engine.redoStack).toEqual([])
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
