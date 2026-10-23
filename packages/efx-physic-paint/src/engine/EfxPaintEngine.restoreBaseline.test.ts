// ============================================================
//  261023-h9v — EfxPaintEngine.restoreStrokesBaseline contract.
//
//  A COMPLETE retained brush script re-enters the live acceptance
//  ledger through ONE silent public seam that mirrors loadProjectData:
//    - validate the WHOLE group list before mutating anything;
//    - keep every stored primary mutationId (the store identity law);
//    - restore continuations as zero-point diffusion records;
//    - reseed the paint-order projection + creation-order serials;
//    - clear undo/redo/history (a baseline is never an undo step);
//    - advance nextMutationId defensively;
//    - redraw synchronously and emit NO completed-mutation notification.
//
//  The harness is the engine suite's prototype-based mock canvas
//  (strokeReorder / moveTranslate precedent) so redrawAll runs for
//  real without a DOM.
// ============================================================

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const { depositAlongPath, createMockCanvas } = vi.hoisted(() => {
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
    let ga = 1
    let path: Array<[number, number]> = []
    let tx = 0, ty = 0
    const stack: Array<{ ga: number; tx: number; ty: number }> = []

    function pointInPolygon(px: number, py: number, poly: Array<[number, number]>): boolean {
      let inside = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]
        const [xj, yj] = poly[j]
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    }

    function fillPolygon() {
      if (path.length < 3) return
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const [x, y] of path) {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
      const x0 = Math.max(0, Math.floor(minX)), y0 = Math.max(0, Math.floor(minY))
      const x1 = Math.min(state.w - 1, Math.ceil(maxX)), y1 = Math.min(state.h - 1, Math.ceil(maxY))
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          if (!pointInPolygon(px + 0.5, py + 0.5, path)) continue
          const d = (py * state.w + px) * 4
          const dstA = state.data[d + 3] / 255
          const outA = ga + dstA * (1 - ga)
          if (outA > 0) {
            state.data[d] = Math.round((255 * ga + state.data[d] * dstA * (1 - ga)) / outA)
            state.data[d + 1] = Math.round((255 * ga + state.data[d + 1] * dstA * (1 - ga)) / outA)
            state.data[d + 2] = Math.round((255 * ga + state.data[d + 2] * dstA * (1 - ga)) / outA)
          }
          state.data[d + 3] = Math.round(outA * 255)
        }
      }
    }

    const ctx = {
      canvas: { get width() { return state.w }, get height() { return state.h } },
      get globalAlpha() { return ga }, set globalAlpha(v: number) { ga = v },
      fillStyle: '#fff',
      save() { stack.push({ ga, tx, ty }) },
      restore() { const s = stack.pop(); if (s) { ga = s.ga; tx = s.tx; ty = s.ty } },
      translate(x: number, y: number) { tx += x; ty += y },
      beginPath() { path = [] },
      moveTo(x: number, y: number) { path.push([x + tx, y + ty]) },
      lineTo(x: number, y: number) { path.push([x + tx, y + ty]) },
      closePath() {},
      fill: fillPolygon,
      stroke() {},
      clearRect(x: number, y: number, w: number, h: number) {
        for (let py = Math.max(0, y); py < Math.min(state.h, y + h); py++)
          for (let px = Math.max(0, x); px < Math.min(state.w, x + w); px++) {
            const d = (py * state.w + px) * 4
            state.data[d] = 0; state.data[d + 1] = 0; state.data[d + 2] = 0; state.data[d + 3] = 0
          }
      },
      drawImage(src: { _data?: Uint8ClampedArray; width: number; height: number }, dx = 0, dy = 0, dw?: number, dh?: number) {
        const srcData = src?._data
        if (!srcData) return
        const sw = src.width, sh = src.height
        const w = dw ?? sw, h = dh ?? sh
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const sx = Math.min(sw - 1, Math.floor((x * sw) / w))
          const sy = Math.min(sh - 1, Math.floor((y * sh) / h))
          const gx = dx + x, gy = dy + y
          if (gx < 0 || gx >= state.w || gy < 0 || gy >= state.h) continue
          const s = (sy * sw + sx) * 4, d = (gy * state.w + gx) * 4
          state.data[d] = srcData[s]; state.data[d + 1] = srcData[s + 1]
          state.data[d + 2] = srcData[s + 2]; state.data[d + 3] = srcData[s + 3]
        }
      },
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
      putImageData(id: { width: number; height: number; data: Uint8ClampedArray }, dx: number, dy: number) {
        for (let y = 0; y < id.height; y++) for (let x = 0; x < id.width; x++) {
          const gx = dx + x, gy = dy + y
          if (gx < 0 || gx >= state.w || gy < 0 || gy >= state.h) continue
          const src = (y * id.width + x) * 4, dst = (gy * state.w + gx) * 4
          state.data[dst] = id.data[src]; state.data[dst + 1] = id.data[src + 1]
          state.data[dst + 2] = id.data[src + 2]; state.data[dst + 3] = id.data[src + 3]
        }
      },
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

  return { depositAlongPath, createMockCanvas }
})

vi.mock('../brush/paint', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../brush/paint')>()
  return {
    ...actual,
    renderPaintStroke: (
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
    },
  }
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
import type { CompletedPaintMutation, RecordedStrokeGroup } from './EfxPaintEngine'
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
  })
  // Real method (do not stub): prepareWetLayerForStroke drives pre-stroke drying.
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

function group(
  mutationId: number,
  pointCount = 3,
  continuations: Readonly<PaintStroke>[] = [],
): Readonly<RecordedStrokeGroup> {
  return {
    primary: stroke(mutationId, Array.from({ length: pointCount }, (_, index) => point(index + 2, index + 2))),
    continuations,
  };
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('restoreStrokesBaseline', () => {
  it('restores the stored paint order with the SAME mutationIds and returns the primary count', () => {
    const engine = createHarness()

    expect(engine.restoreStrokesBaseline([group(7), group(3), group(5)])).toBe(3)

    expect(engine.getStrokes().map((entry) => entry.mutationId)).toEqual([7, 3, 5])
    expect(engine.getStrokes().map((entry) => entry.points.length)).toEqual([3, 3, 3])
    // The stored points are cloned, not shared with the frozen store entry.
    const stored = group(7)
    engine.restoreStrokesBaseline([stored])
    expect(engine.getStrokes()[0]!.points[0]).not.toBe(stored.primary.points[0])
    expect(Object.isFrozen(engine.getStrokes()[0]!.points)).toBe(false)
    expect(Object.isFrozen(engine.getStrokes()[0]!.points[0])).toBe(false)
  })

  it('restores continuations as zero-point diffusion records and serials for primaries only', () => {
    const engine = createHarness()
    const continuation = stroke(undefined, [], 12)

    expect(engine.restoreStrokesBaseline([group(5, 2, [continuation])])).toBe(1)

    const strokes = engine.getStrokes()
    expect(strokes).toHaveLength(2)
    expect(strokes[1]!.points).toEqual([])
    expect(strokes[1]!.diffusionFrames).toBe(12)
    expect(strokes[1]!.mutationId).toBeUndefined()
    expect([...engine.getStrokeSerials().keys()]).toEqual([5])
  })

  it('clears undo/redo/history and emits no completed mutation for the restore', () => {
    const engine = createHarness()
    engine.undoStack.push({ mutationId: 99, actions: [], checkpoint: null, deferred: null })
    engine.redoStack.push({ mutationId: 98, actions: [], checkpoint: null, deferred: null })
    const events: CompletedPaintMutation[] = []
    engine.setCompletedMutationListener((mutation) => { events.push(mutation) })

    expect(engine.restoreStrokesBaseline([group(4)])).toBe(1)

    expect(engine.canUndo()).toBe(false)
    expect(engine.canRedo()).toBe(false)
    expect(engine.undo()).toBe(false)
    expect(events).toEqual([])
    expect(engine.getHistoryAvailability()).toEqual({ undo: 0, redo: 0 })
  })

  it('keeps ids editable: a post-restore moveStroke succeeds as the first new mutation', () => {
    const engine = createHarness()
    engine.restoreStrokesBaseline([group(4)])
    const events: CompletedPaintMutation[] = []
    engine.setCompletedMutationListener((mutation) => { events.push(mutation) })
    const before = engine.getStrokes()[0]!.points[0]!.x

    // The move contract pushes no undo checkpoint (261004-dn5) — "undoable"
    // means the id is live and editable, not that a new stack entry appears.
    expect(engine.moveStroke(4, 10, 5)).toBe(true)
    expect(engine.getStrokes()[0]!.points[0]!.x).toBe(before + 10)
    expect(events.map((event) => event.kind)).toEqual(['move'])
    expect(engine.canUndo()).toBe(false)
  })

  it('advances nextMutationId above every restored id', () => {
    const engine = createHarness()
    engine.nextMutationId = 3
    engine.restoreStrokesBaseline([group(7), group(3)])

    const nextId = engine.enqueueRecordedStroke(group(42))
    expect(nextId).toBeGreaterThan(7)
  })

  describe('fail-closed validation — no mutation on malformed input', () => {
    function expectUntouched(engine: EngineInternals, before: string): void {
      expect(engine.getStrokes().map((entry) => entry.mutationId)).toEqual(JSON.parse(before))
      expect(engine.canUndo()).toBe(false)
      expect(engine.canRedo()).toBe(false)
      expect(engine.nextMutationId).toBe(1)
    }

    it('refuses duplicate mutationIds', () => {
      const engine = createHarness()
      expect(engine.restoreStrokesBaseline([group(5), group(5)])).toBe(0)
      expectUntouched(engine, '[]')
    })

    it('refuses a non-integer or missing primary mutationId', () => {
      const engine = createHarness()
      const bad = { primary: stroke(undefined, [point(1, 1)]), continuations: [] } as unknown as RecordedStrokeGroup
      expect(engine.restoreStrokesBaseline([bad])).toBe(0)
      const fractional = { primary: { ...stroke(1.5, [point(1, 1)]) }, continuations: [] } as unknown as RecordedStrokeGroup
      expect(engine.restoreStrokesBaseline([fractional])).toBe(0)
      expectUntouched(engine, '[]')
    })

    it('refuses an empty primary points array', () => {
      const engine = createHarness()
      const bad = { primary: stroke(1, []), continuations: [] } as unknown as RecordedStrokeGroup
      expect(engine.restoreStrokesBaseline([bad])).toBe(0)
      expectUntouched(engine, '[]')
    })

    it('refuses a continuation carrying points or a non-positive diffusion count', () => {
      const engine = createHarness()
      const withPoints = { primary: stroke(1, [point(1, 1)]), continuations: [stroke(undefined, [point(2, 2)], 3)] } as unknown as RecordedStrokeGroup
      expect(engine.restoreStrokesBaseline([withPoints])).toBe(0)
      const zeroDiffusion = { primary: stroke(1, [point(1, 1)]), continuations: [stroke(undefined, [], 0)] } as unknown as RecordedStrokeGroup
      expect(engine.restoreStrokesBaseline([zeroDiffusion])).toBe(0)
      expectUntouched(engine, '[]')
    })

    it('refuses a non-array group list and a malformed params object', () => {
      const engine = createHarness()
      expect(engine.restoreStrokesBaseline(null as unknown as RecordedStrokeGroup[])).toBe(0)
      const badParams = {
        primary: { ...stroke(1, [point(1, 1)]), params: null },
        continuations: [],
      } as unknown as RecordedStrokeGroup
      expect(engine.restoreStrokesBaseline([badParams])).toBe(0)
      expectUntouched(engine, '[]')
    })

    it('leaves an existing baseline untouched when a later restore is malformed', () => {
      const engine = createHarness()
      engine.restoreStrokesBaseline([group(4), group(8)])
      expect(engine.restoreStrokesBaseline([group(1), group(1)])).toBe(0)
      expect(engine.getStrokes().map((entry) => entry.mutationId)).toEqual([4, 8])
      expect(engine.getStrokeSerials().size).toBe(2)
    })
  })
})
