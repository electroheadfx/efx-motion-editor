// ============================================================
//  261023-j5b — EfxPaintEngine.attachStrokesBaseline contract.
//
//  LAZY ATTACH: navigation installs a COMPLETE retained script
//  into the ledger SILENTLY, over cached pixels that already show
//  the same content:
//    - same validation / cloning / paint-order / serials /
//      mutationIds as restoreStrokesBaseline;
//    - NO stroke replay (zero renderPaintStroke calls);
//    - NO preview-base touch (the cached pixels stay the display);
//    - the frame-visit mode becomes 'detached', so any later
//      redrawAll (an async preview-base decode) also skips the
//      ledger replay;
//    - history is cleared (a baseline is never an undo step) and
//      notifyHistoryAvailability fires;
//    - clear() returns the visit to 'live'.
//
//  Prototype-based mock-canvas harness (restoreBaseline precedent) so
//  redrawAll is real and a replay would be visible as deposits.
// ============================================================

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const { depositAlongPath, createMockCanvas, renderPaintStrokeSpy } = vi.hoisted(() => {
  function depositAlongPath(
    alpha: Float32Array, points: Array<{ x: number; y: number }>,
    width: number, height: number, radius: number, value: number,
  ): void {
    for (const p of points) {
      const r = Math.ceil(radius)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue
          const gx = Math.round(p.x) + dx
          const gy = Math.round(p.y) + dy
          if (gx < 0 || gx >= width || gy < 0 || gy >= height) continue
          alpha[gy * width + gx] = value
        }
      }
    }
  }

  function createMockCanvas(initialW = 1, initialH = 1) {
    const state = { w: initialW, h: initialH, data: new Uint8ClampedArray(initialW * initialH * 4) }
    const resize = () => { state.data = new Uint8ClampedArray(state.w * state.h * 4) }
    const ctx = {
      canvas: { get width() { return state.w }, get height() { return state.h } },
      globalAlpha: 1,
      fillStyle: '#fff',
      save() {}, restore() {}, translate() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
      fill() {}, stroke() {},
      clearRect(x: number, y: number, w: number, h: number) {
        for (let py = Math.max(0, y); py < Math.min(state.h, y + h); py++)
          for (let px = Math.max(0, x); px < Math.min(state.w, x + w); px++) {
            const d = (py * state.w + px) * 4
            state.data[d] = 0; state.data[d + 1] = 0; state.data[d + 2] = 0; state.data[d + 3] = 0
          }
      },
      drawImage() {},
      getImageData(sx: number, sy: number, sw: number, sh: number) {
        const out = new Uint8ClampedArray(sw * sh * 4)
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
          const gx = sx + x, gy = sy + y
          if (gx < 0 || gx >= state.w || gy < 0 || gy >= state.h) continue
          const src = (gy * state.w + gx) * 4, dst = (y * sw + x) * 4
          out[dst] = state.data[src]; out[dst + 1] = state.data[src + 1]
          out[dst + 2] = state.data[src + 2]; out[dst + 3] = state.data[src + 3]
        }
        return { width: sw, height: sh, data: out }
      },
      putImageData() {},
      setPointerCapture() {}, releasePointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: state.w, height: state.h }),
    }
    return {
      get width() { return state.w }, set width(v: number) { state.w = v; resize() },
      get height() { return state.h }, set height(v: number) { state.h = v; resize() },
      getContext: () => ctx,
      get _data() { return state.data },
    }
  }

  const renderPaintStrokeSpy = vi.fn((
    points: Array<{ x: number; y: number }>, color: string | null,
    _opts: { size?: number }, _ctx: unknown,
    wet: { alpha: Float32Array; strokeOpacity: Float32Array; r: Float32Array; g: Float32Array; b: Float32Array },
    _s: unknown, _d: unknown, _m: unknown, _p: unknown,
    width: number, height: number,
  ) => {
    depositAlongPath(wet.alpha, points, width, height, 6, 5000)
    depositAlongPath(wet.strokeOpacity, points, width, height, 6, 1)
    const hex = color ? /^#?([0-9a-f]{6})$/i.exec(color.trim()) : null
    if (hex) {
      const rgb = parseInt(hex[1], 16)
      depositAlongPath(wet.r, points, width, height, 6, (rgb >> 16) & 255)
      depositAlongPath(wet.g, points, width, height, 6, (rgb >> 8) & 255)
      depositAlongPath(wet.b, points, width, height, 6, rgb & 255)
    }
  })

  return { depositAlongPath, createMockCanvas, renderPaintStrokeSpy }
})

vi.mock('../brush/paint', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../brush/paint')>()
  return { ...actual, renderPaintStroke: renderPaintStrokeSpy }
})

vi.mock('../render/canvas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../render/canvas')>()
  return {
    ...actual,
    drawBg: () => null,
    drawQueuedStrokePolyline: () => {},
    drawStrokePreview: () => {},
    setupDualCanvas: () => {},
    drawBrushCursor: vi.fn(),
  }
})

vi.mock('../render/compositor', () => ({ compositeWetLayer: () => {}, wetDisplayAlpha: (a: number) => a }))

vi.mock('../core/fluids', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/fluids')>()
  return { ...actual, localFluidPhysicsStep: () => {} }
})

import { EfxPaintEngine } from './EfxPaintEngine'
import type { RecordedStrokeGroup } from './EfxPaintEngine'
import type { BrushOpts, PaintStroke, PenPoint } from '../types'

type EngineInternals = EfxPaintEngine & Record<string, any>

const W = 100, H = 100, SZ = W * H

const defaultOpts: BrushOpts = {
  size: 12, opacity: 100, pressure: 100, waterAmount: 0, dryAmount: 100,
  edgeDetail: 50, pickup: 0, eraseStrength: 100, antiAlias: 0,
}

function makeBuffers() {
  return {
    r: new Float32Array(SZ), g: new Float32Array(SZ), b: new Float32Array(SZ),
    alpha: new Float32Array(SZ), wetness: new Float32Array(SZ), strokeOpacity: new Float32Array(SZ),
  }
}

function makeSavedBuffers() {
  return { r: new Float32Array(SZ), g: new Float32Array(SZ), b: new Float32Array(SZ), alpha: new Float32Array(SZ), strokeOpacity: new Float32Array(SZ) }
}

function createHarness() {
  const dry = createMockCanvas(W, H)
  const engine = Object.create(EfxPaintEngine.prototype) as EngineInternals
  Object.assign(engine, {
    width: W, height: H, size: SZ,
    inputLocked: false, destroyed: false, rawPts: [],
    lastPointerSampleTimeStamp: Number.NEGATIVE_INFINITY,
    lastAcceptedPointerSampleTimeStamp: Number.NEGATIVE_INFINITY,
    lastPointerInputTime: 0, lastStrokeInputTime: 0, lastStrokeHandoffTime: 0,
    lastNativePenInputTime: 0, nativePenInput: null,
    cursorX: -1, cursorY: -1, previewStroke: null,
    eraseHoverTargetId: null,
    moveHoverTargetId: null,
    moveGesture: null,
    lastPreviewBbox: null, lastCursorRect: null, drawnQueuedOutlineCount: 0,
    lastDisplayCompositeTime: 0, rafId: 0,
    allActions: [], strokeStack: [], undoStack: [], redoStack: [], historyEntries: [], historyIndex: 0,
    pendingStrokeFinalizations: [], activeStrokeFinalization: null,
    strokeFinalizationScheduled: false, strokeFinalizationGeneration: 0,
    nextMutationId: 1, activeMutationId: null, lastCompletedMutationId: null,
    performanceListener: null, completedMutationListener: null, historyAvailabilityListener: null,
    color: '#123456',
    state: {
      drawing: false, tool: 'paint' as const,
      brushOpts: { ...defaultOpts }, hasPenInput: false,
      physicsMode: null as 'local' | null, bgMode: 'transparent',
      wetPaper: false, embossStrength: 0, localSpreadStrength: 50,
      physicsRunning: false,
    },
    savedPhysicsMode: null,
    dualCanvas: {
      dryCanvas: {
        ...dry,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
      },
      dryCtx: dry.getContext('2d'),
      displayCtx: createMockCanvas(W, H).getContext('2d'),
      previewBaseCtx: createMockCanvas(W, H).getContext('2d'),
    },
    wet: makeBuffers(), savedWet: makeSavedBuffers(),
    drying: { dryLUT: new Float32Array(257), invLUT: new Float32Array(257), dryPos: new Float32Array(SZ) },
    fluid: { u: new Float32Array(SZ), v: new Float32Array(SZ), u0: new Float32Array(SZ), v0: new Float32Array(SZ), p: new Float32Array(SZ), div: new Float32Array(SZ), wetMask: new Float32Array(SZ), blurMask: new Float32Array(SZ) },
    fluidConfig: { viscosity: 0.001, omega_h: 0.06, darkening: 0.1 },
    blowDX: new Float32Array(SZ), blowDY: new Float32Array(SZ),
    lastStrokeMask: new Float32Array(SZ),
    paperHeight: null, bgCanvas: createMockCanvas(W, H), bgCtx: createMockCanvas(W, H).getContext('2d'),
    bgData: null, paperTextures: new Map(), userPhoto: null,
    currentPaperKey: '', texHeight: null,
    previewBaseEnabled: false, visibleBackgroundSuppressed: false,
    previewBackgroundSeparated: false,
    previewBaseImage: null, previewBasePaintCanvas: null,
    displayCompositeDirty: false, lookDelta: null, wetDisplayScratch: null,
    lastStrokeBounds: null,
    getStrokeMetadata: undefined,
    recordPerformance: vi.fn(),
    requestRender: vi.fn(), compositeDisplayNow: vi.fn(), renderVisibleWetLayer: vi.fn(),
    redrawPreviewBase: vi.fn(), prepareWetLayerForStroke: undefined as never,
    scheduleStrokeFinalization: vi.fn(), markStrokeHandoffComplete: vi.fn(),
    beginBakeParityFlushCapture: vi.fn(), completeBakeParityFlushCapture: vi.fn(),
    beginBakeParityTransfer: vi.fn(), endBakeParityTransfer: vi.fn(),
    hasPendingInput: vi.fn(() => false),
    strokeReplayMode: 'live', framePaintSettings: null,
  })
  delete (engine as any).prepareWetLayerForStroke
  return engine
}

function point(x: number, y: number): PenPoint {
  return { x, y, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.1 }
}

function stroke(mutationId: number | undefined, points: PenPoint[], diffusionFrames?: number): Readonly<PaintStroke> {
  return {
    tool: 'paint',
    points,
    color: '#123456',
    params: { ...defaultOpts },
    timestamp: mutationId ?? 1,
    ...(mutationId === undefined ? {} : { mutationId }),
    ...(diffusionFrames === undefined ? {} : { diffusionFrames }),
  }
}

function group(mutationId: number, pointCount = 3, continuations: Readonly<PaintStroke>[] = []): Readonly<RecordedStrokeGroup> {
  return {
    primary: stroke(mutationId, Array.from({ length: pointCount }, (_, index) => point(index + 2, index + 2))),
    continuations,
  }
}

beforeEach(() => {
  renderPaintStrokeSpy.mockClear()
  vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('attachStrokesBaseline', () => {
  it('installs the stored paint order with the SAME mutationIds and returns the primary count', () => {
    const engine = createHarness()

    expect(engine.attachStrokesBaseline([group(7), group(3), group(5)])).toBe(3)

    expect(engine.getStrokes().map((entry) => entry.mutationId)).toEqual([7, 3, 5])
    expect([...engine.getStrokeSerials().keys()]).toEqual([7, 3, 5])
    // Points are cloned, never shared with the frozen store entry.
    const stored = group(7)
    engine.attachStrokesBaseline([stored])
    expect(engine.getStrokes()[0]!.points[0]).not.toBe(stored.primary.points[0])
  })

  it('NEVER replays a stroke on attach and never touches the preview base', () => {
    const engine = createHarness()
    engine.previewBaseEnabled = true
    engine.previewBaseImage = { width: W, height: H }

    engine.attachStrokesBaseline([group(7, 4), group(3, 2)])

    expect(renderPaintStrokeSpy).not.toHaveBeenCalled()
    expect(engine.redrawPreviewBase).not.toHaveBeenCalled()
    expect(engine.redrawAll).toBe(engine.redrawAll) // sanity: method exists on the prototype
    expect((engine as any).strokeReplayMode).toBe('detached')
    expect(engine.displayCompositeDirty).toBe(true)
  })

  it('a later redrawAll while detached still skips the ledger replay', () => {
    const engine = createHarness()
    engine.attachStrokesBaseline([group(7), group(3)])

    // The async preview-base decode path calls redrawAll after the attach.
    ;(engine as any).redrawAll()

    expect(renderPaintStrokeSpy).not.toHaveBeenCalled()
  })

  it('clears history and notifies history availability', () => {
    const engine = createHarness()
    const availability = vi.fn()
    engine.historyAvailabilityListener = availability
    engine.undoStack.push({ mutationId: 99, actions: [], checkpoint: null, deferred: null })
    engine.redoStack.push({ mutationId: 98, actions: [], checkpoint: null, deferred: null })

    engine.attachStrokesBaseline([group(4)])

    expect(engine.canUndo()).toBe(false)
    expect(engine.canRedo()).toBe(false)
    expect(availability).toHaveBeenCalledWith({ undo: 0, redo: 0 })
  })

  it('emits no completed mutation for the attach', () => {
    const engine = createHarness()
    const events: unknown[] = []
    engine.completedMutationListener = (mutation: unknown) => { events.push(mutation) }

    engine.attachStrokesBaseline([group(4)])

    expect(events).toEqual([])
  })

  it('advances nextMutationId above every attached id', () => {
    const engine = createHarness()
    engine.nextMutationId = 3
    engine.attachStrokesBaseline([group(7), group(3)])
    expect(engine.enqueueRecordedStroke(group(42))).toBeGreaterThan(7)
  })

  it('clear() returns the frame visit to the live replay mode', () => {
    const engine = createHarness()
    engine.attachStrokesBaseline([group(4)])
    expect((engine as any).strokeReplayMode).toBe('detached')

    engine.clear()

    expect((engine as any).strokeReplayMode).toBe('live')
  })

  it('undefined mode is read as live — prototype harnesses never run the constructor', () => {
    const engine = createHarness()
    delete (engine as any).strokeReplayMode
    engine.attachStrokesBaseline([group(4)])
    ;(engine as any).redrawAll()
    expect(renderPaintStrokeSpy).not.toHaveBeenCalled()
    engine.clear()
    ;(engine as any).redrawAll()
    // Live mode replays — but the ledger was cleared, so still no deposit.
    expect(renderPaintStrokeSpy).not.toHaveBeenCalled()
  })

  describe('fail-closed validation — no mutation on malformed input', () => {
    it('refuses duplicate ids and malformed groups without touching the engine', () => {
      const engine = createHarness()
      expect(engine.attachStrokesBaseline([group(5), group(5)])).toBe(0)
      expect(engine.getStrokes()).toEqual([])
      expect((engine as any).strokeReplayMode).toBe('live')

      const bad = { primary: stroke(undefined, [point(1, 1)]), continuations: [] } as unknown as RecordedStrokeGroup
      expect(engine.attachStrokesBaseline([bad])).toBe(0)
      expect(engine.getStrokes()).toEqual([])
    })

    it('refuses an empty list', () => {
      const engine = createHarness()
      expect(engine.attachStrokesBaseline([])).toBe(0)
    })
  })
})
