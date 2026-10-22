// ============================================================
//  261022-ujp Task 2 — send a Brush stroke one paint step back.
//
//  `allActions` is the acceptance/undo ledger and NEVER reorders: undo()
//  splices the suffix from a stroke's index. Paint order is the separate
//  `strokeStack` projection of the SAME action object refs; rendering and
//  serialization follow it. Dead refs stay in the projection so undo -> redo
//  restores a stroke's paint position.
//
//  The step inherits the move-commit contract: flush pending finalizations
//  first, clear the redo stack, no new undo checkpoint, one 'move'
//  completed mutation, hover target retained.
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

    function pointInPolygon(px: number, py: number, poly: Array<[number, number]>): boolean {
      let inside = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]
        const [xj, yj] = poly[j]
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
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
import type { CompletedPaintMutation } from './EfxPaintEngine'
import type { BrushOpts, PenPoint, PaintStroke } from '../types'

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

type PointerSample = {
  x: number
  y: number
  timeStamp: number
  pressure?: number
  buttons?: number
  pointerType?: string
}

function pointerEvent(sample: PointerSample): PointerEvent {
  return {
    clientX: sample.x,
    clientY: sample.y,
    timeStamp: sample.timeStamp,
    pressure: sample.pressure ?? 0.5,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    buttons: sample.buttons ?? 1,
    pointerType: sample.pointerType ?? 'pen',
    pointerId: 1,
    preventDefault: vi.fn(),
    getCoalescedEvents: () => [],
  } as unknown as PointerEvent
}

function ev(x: number, y: number, timeStamp: number, buttons: number): PointerEvent {
  return pointerEvent({ x, y, timeStamp, buttons, pointerType: 'mouse' })
}

function captureMutations(engine: EngineInternals): CompletedPaintMutation[] {
  const events: CompletedPaintMutation[] = []
  engine.setCompletedMutationListener((mutation) => { events.push(mutation) })
  return events
}

/** Paint a fresh stroke through the NORMAL pointer path so a script entry exists. */
function paintStroke(engine: EngineInternals, samples: Array<[number, number]>, t0: number): number {
  engine.setTool('paint')
  engine.onPointerDown(ev(samples[0][0], samples[0][1], t0, 1))
  for (let i = 1; i < samples.length; i++) {
    engine.onPointerMove(ev(samples[i][0], samples[i][1], t0 + i * 10, 1))
  }
  const last = samples[samples.length - 1]
  engine.onPointerUp(ev(last[0], last[1], t0 + samples.length * 10, 0))
  engine.flushPendingStrokeFinalizations()
  // Before any reorder the projection equals acceptance order, so the last
  // entry is the stroke just painted.
  const strokes = engine.getStrokes()
  return strokes[strokes.length - 1].mutationId as number
}

function hLine(y: number): Array<[number, number]> {
  return [[20, y], [50, y], [80, y]]
}

/** pointermove with no button — the hover path. */
function hover(engine: EngineInternals, x: number, y: number, timeStamp: number): void {
  engine.onPointerMove(pointerEvent({ x, y, timeStamp, buttons: 0, pointerType: 'mouse' }))
}

function order(engine: EngineInternals): Array<number | undefined> {
  return engine.getStrokes().map((stroke: PaintStroke) => stroke.mutationId)
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('261022-ujp Brush paint-order projection', () => {
  it('paint order is acceptance order', () => {
    const engine = createHarness()
    const a = paintStroke(engine, hLine(20), 100)
    const b = paintStroke(engine, hLine(40), 300)
    const c = paintStroke(engine, hLine(60), 500)

    expect(order(engine)).toEqual([a, b, c])
  })

  it('sendStrokeBackward moves a stroke one step back', () => {
    const engine = createHarness()
    const a = paintStroke(engine, hLine(20), 100)
    const b = paintStroke(engine, hLine(40), 300)
    const c = paintStroke(engine, hLine(60), 500)
    // A stale redo would repaint pre-reorder pixels — the step must clear it.
    engine.redoStack.push({ mutationId: 999, actions: [], checkpoint: null, deferred: null })
    const undoBefore = engine.getHistoryAvailability().undo
    expect(engine.getHistoryAvailability().redo).toBe(1)
    const events = captureMutations(engine)

    engine.setTool('move')
    expect(engine.sendStrokeBackward(c)).toBe(true)

    expect(order(engine)).toEqual([a, c, b])
    const moveEvents = events.filter((event) => event.kind === 'move')
    expect(moveEvents).toHaveLength(1)
    expect(moveEvents[0].mutationId).toBe(c)
    expect(engine.getHistoryAvailability().undo).toBe(undoBefore)
    expect(engine.getHistoryAvailability().redo).toBe(0)
  })

  it('each call is one step and the bottom refuses', () => {
    const engine = createHarness()
    const a = paintStroke(engine, hLine(20), 100)
    const b = paintStroke(engine, hLine(40), 300)
    const c = paintStroke(engine, hLine(60), 500)
    const events = captureMutations(engine)
    engine.setTool('move')

    expect(engine.sendStrokeBackward(c)).toBe(true)
    expect(order(engine)).toEqual([a, c, b])
    expect(engine.sendStrokeBackward(c)).toBe(true)
    expect(order(engine)).toEqual([c, a, b])

    // Already at the front: the third press refuses with no mutation.
    expect(engine.sendStrokeBackward(c)).toBe(false)
    expect(order(engine)).toEqual([c, a, b])
    expect(events.filter((event) => event.kind === 'move')).toHaveLength(2)
  })

  it('sendStrokeForward moves a stroke one step in front and the top refuses', () => {
    const engine = createHarness()
    const a = paintStroke(engine, hLine(20), 100)
    const b = paintStroke(engine, hLine(40), 300)
    const c = paintStroke(engine, hLine(60), 500)
    const events = captureMutations(engine)

    engine.setTool('move')
    expect(engine.sendStrokeForward(a)).toBe(true)
    expect(order(engine)).toEqual([b, a, c])
    expect(engine.sendStrokeForward(a)).toBe(true)
    expect(order(engine)).toEqual([b, c, a])

    // Already on top: the step refuses with no mutation.
    expect(engine.sendStrokeForward(a)).toBe(false)
    expect(order(engine)).toEqual([b, c, a])
    expect(events.filter((event) => event.kind === 'move')).toHaveLength(2)
  })

  it('forward keeps a primary and its continuations together', () => {
    const engine = createHarness()
    const primary1: PaintStroke = { tool: 'paint', points: [{ x: 10, y: 10, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { ...defaultOpts }, timestamp: 1, mutationId: 1 }
    const continuation: PaintStroke = { tool: 'paint', points: [], color: '#000000', params: { ...defaultOpts }, timestamp: 1, mutationId: 1, diffusionFrames: 4 }
    const primary2: PaintStroke = { tool: 'paint', points: [{ x: 20, y: 20, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { ...defaultOpts }, timestamp: 2, mutationId: 2 }
    engine.allActions = [primary1, continuation, primary2]
    engine.strokeStack = [primary1, continuation, primary2]
    engine.setTool('move')

    expect(engine.sendStrokeForward(1)).toBe(true)

    // Group 1 (primary + continuation) lands in front of primary-2 and stays
    // internally contiguous.
    expect(engine.strokeStack[0]).toBe(primary2)
    expect(engine.strokeStack[1]).toBe(primary1)
    expect(engine.strokeStack[2]).toBe(continuation)
    expect(engine.allActions.map((action: PaintStroke) => action.mutationId)).toEqual([1, 1, 2])
  })

  it('refuses outside the move tool and for unknown ids', () => {
    const engine = createHarness()
    const a = paintStroke(engine, hLine(20), 100)
    const b = paintStroke(engine, hLine(40), 300)
    const events = captureMutations(engine)

    // Tool 'paint' — the key path only exists under the Move tool.
    engine.setTool('paint')
    expect(engine.sendStrokeBackward(b)).toBe(false)

    engine.setTool('move')
    expect(engine.sendStrokeBackward(999999)).toBe(false)

    expect(order(engine)).toEqual([a, b])
    expect(events.filter((event) => event.kind === 'move')).toHaveLength(0)
    expect(engine.getStrokeCount()).toBe(2)
  })

  it('the hover target survives so repeated presses step the same stroke', () => {
    const engine = createHarness()
    const a = paintStroke(engine, hLine(30), 100)
    const b = paintStroke(engine, hLine(30), 300)
    const c = paintStroke(engine, hLine(30), 500)
    const events = captureMutations(engine)

    engine.setTool('move')
    hover(engine, 50, 30, 700)
    expect(engine.getMoveTargetMutationId()).toBe(c)
    expect(engine.moveHoverTargetId).toBe(c)

    expect(engine.sendStrokeBackward(c)).toBe(true)
    expect(order(engine)).toEqual([a, c, b])
    // The ONE brush selection state is the hover target — it must not move.
    expect(engine.getMoveTargetMutationId()).toBe(c)

    expect(engine.sendStrokeBackward(c)).toBe(true)
    expect(order(engine)).toEqual([c, a, b])
    expect(engine.getMoveTargetMutationId()).toBe(c)

    const moves = events.filter((event) => event.kind === 'move')
    expect(moves).toHaveLength(2)
    expect(moves.every((event) => event.mutationId === c)).toBe(true)
  })

  it('hit-testing targets the visually topmost stroke after a step', () => {
    const engine = createHarness()
    const a = paintStroke(engine, hLine(30), 100)
    const b = paintStroke(engine, hLine(30), 300)

    engine.setTool('move')
    hover(engine, 50, 30, 500)
    expect(engine.getMoveTargetMutationId()).toBe(b)

    expect(engine.sendStrokeBackward(b)).toBe(true)
    expect(order(engine)).toEqual([b, a])

    // A is painted on top now, so the hover must retarget it — the hit test
    // cannot keep resolving against the acceptance ledger.
    hover(engine, 50, 30, 600)
    expect(engine.getMoveTargetMutationId()).toBe(a)
  })

  it('continuations travel with their primary', () => {
    const engine = createHarness()
    const primary1: PaintStroke = { tool: 'paint', points: [{ x: 10, y: 10, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { ...defaultOpts }, timestamp: 1, mutationId: 1 }
    const continuation: PaintStroke = { tool: 'paint', points: [], color: '#000000', params: { ...defaultOpts }, timestamp: 1, mutationId: 1, diffusionFrames: 4 }
    const primary2: PaintStroke = { tool: 'paint', points: [{ x: 20, y: 20, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { ...defaultOpts }, timestamp: 2, mutationId: 2 }
    engine.allActions = [primary1, continuation, primary2]
    engine.strokeStack = [primary1, continuation, primary2]
    engine.setTool('move')

    expect(engine.sendStrokeBackward(2)).toBe(true)

    // primary-2 first, then primary-1 with its zero-point entry still
    // immediately after it.
    expect(engine.strokeStack[0]).toBe(primary2)
    expect(engine.strokeStack[1]).toBe(primary1)
    expect(engine.strokeStack[2]).toBe(continuation)
    expect(engine.strokeStack[2].points).toHaveLength(0)
    // The acceptance ledger is untouched (undo splices its suffix).
    expect(engine.allActions.map((action: PaintStroke) => action.mutationId)).toEqual([1, 1, 2])
  })

  it('redrawAll replays in paint order', () => {
    const engine = createHarness()
    const a = paintStroke(engine, hLine(20), 100)
    const b = paintStroke(engine, hLine(40), 300)
    const c = paintStroke(engine, hLine(60), 500)
    const replayed: Array<number | undefined> = []
    const realApply = engine.applyStrokeToEngine.bind(engine)
    engine.applyStrokeToEngine = vi.fn((tool: unknown, points: unknown, color: unknown, params: unknown, opts: { mutationId?: number }) => {
      replayed.push(opts.mutationId)
      return realApply(tool, points, color, params, opts)
    })

    engine.setTool('move')
    expect(engine.sendStrokeBackward(c)).toBe(true)

    expect(replayed).toEqual([a, c, b])
  })

  it('save and load keep the new order', () => {
    const engine = createHarness()
    paintStroke(engine, hLine(20), 100)
    paintStroke(engine, hLine(40), 300)
    const c = paintStroke(engine, hLine(60), 500)
    engine.setTool('move')
    expect(engine.sendStrokeBackward(c)).toBe(true)

    const doc = engine.save()
    const strokes = doc.tracks[0].strokes ?? []
    expect(strokes.map((stroke) => stroke.pts[0][1])).toEqual([20, 60, 40])

    const reloaded = createHarness()
    reloaded.load(doc)
    expect(reloaded.getStrokes().map((stroke: PaintStroke) => stroke.points[0].y)).toEqual([20, 60, 40])
  })

  it('undo/redo still work after a reorder', () => {
    const engine = createHarness()
    const a = paintStroke(engine, hLine(20), 100)
    const b = paintStroke(engine, hLine(40), 300)
    const c = paintStroke(engine, hLine(60), 500)
    engine.setTool('move')
    expect(engine.sendStrokeBackward(c)).toBe(true)
    expect(engine.getStrokeCount()).toBe(3)

    expect(engine.undo()).toBe(true)
    expect(engine.redo()).toBe(true)
    engine.flushPendingStrokeFinalizations()

    expect(engine.getStrokeCount()).toBe(3)
    expect(order(engine)).toEqual([a, c, b])
  })
})
