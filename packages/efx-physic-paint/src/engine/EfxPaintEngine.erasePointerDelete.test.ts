// ============================================================
//  Erase pointer-delete (261003-ud9) — contract of record
//
//  - CLICK-DELETE: erase tool, eraseStrength 100, one recorded fresh paint stroke with wet deposit; a single click (onPointerDown at a point on the stroke, then onPointerUp at the same point) removes it — mutationId absent from getStrokes()/getStrokeCount() and from the save() serialized strokes list, wet.alpha and savedWet.alpha under its ribbon are 0, dry-canvas centerline reads transparent after the rebuild, undo counters no longer count it, and completedMutationListener fires exactly once with kind 'erase' and an integer mutationId — FAILS at RED (today: short stroke discarded, nothing changes).
//  - CLICK force 0: identical setup with eraseStrength 0 removes nothing and fires no notification (guard pin, must stay green forever).
//  - CLICK pixel-only: erase tool, no recorded stroke under the click (paint exists only as dry-canvas pixels) — dry pixels, getStrokeCount(), getHistoryAvailability() and the notification list all unchanged — guard pin.
//  - CLICK empty space: click away from every stroke — no removal, no notification.
//  - CLICK during drain: a paint stroke accepted but not yet finalized (queued in pendingStrokeFinalizations), then a click on it — after the click, the stroke's entry is gone AND its deposit pixels are gone (no orphan deposit), notification fired once — FAILS at RED.
//  - HOVER PREVIEW: erase tool, not drawing, onPointerMove at a point on a fresh stroke — the engine reports that stroke's mutationId as the hover target, previewStroke is set to that stroke's own points with the erase preview color and that stroke's render radius — FAILS at RED (today: no hover state exists).
//  - HOVER POINTER CURSOR: in the same hover state, drawBrushCursor is invoked in pointer mode; with no hover target, off the stroke, after onPointerLeave, after setTool('paint'), while drawing, or at eraseStrength 0 — brush mode (or no hover target) — FAILS at RED.
//  - HOVER scope: paint with no recorded entry under the pointer never becomes a hover target; while state.drawing is true the hover is not computed and previewStroke is owned by the gesture (null at down, ribbon only once the gesture has its own samples).
//  - DRAG GUARD: a multi-sample erase drag still whole-stroke-removes a fresh stroke and still pixel-erases baked paint with the force law (guard pins riding the existing cells' shape).
//  - CURSOR GLYPH (canvas.pointerCursor.test.ts): with a recording 2D context, drawBrushCursor in pointer mode draws the pointing-hand polyline with the dual dark/white treatment (two offset passes), while brush mode still draws the ring/crosshair as today.
//
//  Every cell drives the REAL pointer handlers (onPointerDown / onPointerMove /
//  onPointerUp / onPointerLeave / setTool) — never the private removal method —
//  so the cells pin the user-visible path. Detection is ONE law shared by
//  hover, click and drag (261003-hpi whole-stroke removal, purely geometric).
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
      points: Array<{ x: number; y: number }>, _c: string | null,
      _opts: { size?: number }, _ctx: unknown, wet: { alpha: Float32Array; strokeOpacity: Float32Array },
      _s: unknown, _d: unknown, _m: unknown, _p: unknown,
      width: number, height: number,
    ) => {
      depositAlongPath(wet.alpha, points, width, height, 6, 500)
      depositAlongPath(wet.strokeOpacity, points, width, height, 6, 1)
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
    // Wrapped so the tests can assert the call arguments (pointer vs brush mode)
    // while the real implementation still runs against the recording context.
    drawBrushCursor: vi.fn((...args: unknown[]) => (actual.drawBrushCursor as (...a: unknown[]) => void)(...args)),
  }
})

vi.mock('../render/compositor', () => ({ compositeWetLayer: () => {}, wetDisplayAlpha: (a: number) => a }))

vi.mock('../core/fluids', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/fluids')>()
  return { ...actual, localFluidPhysicsStep: () => {} }
})

import { EfxPaintEngine } from './EfxPaintEngine'
import type { CompletedPaintMutation } from './EfxPaintEngine'
import { drawBrushCursor } from '../render/canvas'
import type { BrushOpts, PenPoint } from '../types'

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
    lastPreviewBbox: null, lastCursorRect: null, drawnQueuedOutlineCount: 0,
    lastDisplayCompositeTime: 0, rafId: 0,
    allActions: [], undoStack: [], redoStack: [], historyEntries: [], historyIndex: 0,
    pendingStrokeFinalizations: [], activeStrokeFinalization: null,
    strokeFinalizationScheduled: false, strokeFinalizationGeneration: 0,
    nextMutationId: 1, activeMutationId: null, lastCompletedMutationId: null,
    performanceListener: null, completedMutationListener: null, historyAvailabilityListener: null,
    color: '#123456',
    state: {
      drawing: false, tool: 'erase' as const,
      brushOpts: { ...defaultOpts }, hasPenInput: false,
      physicsMode: 'local' as const, bgMode: 'transparent',
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

function pushPaintStroke(
  engine: EngineInternals, points: PenPoint[], mutationId: number,
  physicsMode: 'local' | null, wet: boolean,
) {
  const stroke = {
    tool: 'paint' as const, points: points.map(p => ({ ...p })), color: '#123456',
    params: { ...defaultOpts }, timestamp: Date.now(), hasPenInput: false,
    physicsMode, mutationId,
  }
  engine.allActions.push(stroke)
  engine.undoStack.push({ mutationId, actions: [stroke], checkpoint: null, deferred: null })
  engine.historyEntries = [...engine.undoStack]
  engine.historyIndex = engine.undoStack.length
  engine.nextMutationId = Math.max(engine.nextMutationId, mutationId + 1)
  const radius = 6
  if (wet) {
    depositAlongPath(engine.wet.alpha, points, W, H, radius, 500)
    depositAlongPath(engine.savedWet.alpha, points, W, H, radius, 500)
  } else {
    paintDryPatch(engine, Math.round(points[0].x), Math.round(points[0].y), radius, points)
  }
  return stroke
}

/** Opaque dry-canvas paint with NO recorded entry — the baked/pixel-only cell. */
function paintDryPatch(engine: EngineInternals, cx: number, cy: number, radius = 6, points?: PenPoint[]) {
  const ctx = engine.dualCanvas.dryCtx
  const centers = points ?? [{ x: cx, y: cy }]
  for (const p of centers) {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue
      const gx = Math.round(p.x) + dx, gy = Math.round(p.y) + dy
      if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue
      const id = ctx.getImageData(gx, gy, 1, 1)
      id.data[0] = 18; id.data[1] = 52; id.data[2] = 86; id.data[3] = 255
      ctx.putImageData(id, gx, gy)
    }
  }
}

function captureMutations(engine: EngineInternals): CompletedPaintMutation[] {
  const events: CompletedPaintMutation[] = []
  engine.setCompletedMutationListener((mutation) => { events.push(mutation) })
  return events
}

function click(engine: EngineInternals, x: number, y: number, timeStamp: number): void {
  engine.onPointerDown(pointerEvent({ x, y, timeStamp }))
  engine.onPointerUp(pointerEvent({ x, y, timeStamp, buttons: 0 }))
}

function drag(engine: EngineInternals, samples: Array<[number, number]>, t0: number): void {
  // pointerType 'mouse' → hasPenInput false → pMod 1: the D-P force-law cell
  // shape (pen pressure 0.5 would legitimately modulate the mask strength).
  const ev = (x: number, y: number, timeStamp: number, buttons: number) =>
    pointerEvent({ x, y, timeStamp, buttons, pointerType: 'mouse' })
  engine.onPointerDown(ev(samples[0][0], samples[0][1], t0, 1))
  for (let i = 1; i < samples.length; i++) {
    engine.onPointerMove(ev(samples[i][0], samples[i][1], t0 + i * 10, 1))
  }
  const last = samples[samples.length - 1]
  engine.onPointerUp(ev(last[0], last[1], t0 + samples.length * 10, 0))
}

function hLine(y: number): PenPoint[] {
  return [
    { x: 20, y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
    { x: 50, y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
    { x: 80, y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
  ]
}

function wetAt(engine: EngineInternals, x: number, y: number): number {
  return engine.wet.alpha[y * W + x]
}

function dryAlphaAt(engine: EngineInternals, x: number, y: number): number {
  return engine.dualCanvas.dryCtx.getImageData(x, y, 1, 1).data[3]
}

function idsOf(engine: EngineInternals): number[] {
  return engine.getStrokes().map((s: any) => s.mutationId)
}

type CursorMock = { mock: { calls: Array<unknown[]> }; mockClear(): void }
const cursorMock = drawBrushCursor as unknown as CursorMock

/** Mode argument of the LAST drawBrushCursor call (missing at RED → 'brush'). */
function cursorMode(): 'pointer' | 'brush' | 'none' {
  const calls = cursorMock.mock.calls
  if (calls.length === 0) return 'none'
  return (calls[calls.length - 1][7] as 'pointer' | 'brush' | undefined) ?? 'brush'
}

function createDisplayCtx(): CanvasRenderingContext2D {
  return {
    save() {}, restore() {}, setLineDash() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {},
    stroke() {}, fill() {},
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D
}

function hover(engine: EngineInternals, x: number, y: number, timeStamp: number): void {
  engine.onPointerMove(pointerEvent({ x, y, timeStamp, buttons: 0, pointerType: 'mouse' }))
}

// ─── CLICK: single click = whole-stroke delete ──────────────

describe('CLICK: single click on a fresh stroke removes it end-to-end', () => {
  it('CLICK-DELETE: click removes entry, deposit, history and save() — one erase notification', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(30), 1, 'local', true)
    const events = captureMutations(engine)
    expect(engine.getStrokeCount()).toBe(1)

    click(engine, 50, 30, 100)

    expect(idsOf(engine)).not.toContain(1)
    expect(engine.getStrokeCount()).toBe(0)
    expect(engine.save().tracks[0].strokes ?? []).toHaveLength(0)
    expect(wetAt(engine, 50, 30)).toBe(0)
    expect(engine.savedWet.alpha[30 * W + 50]).toBe(0)
    expect(dryAlphaAt(engine, 50, 30)).toBeLessThan(2)
    expect(engine.getHistoryAvailability().undo).toBe(0)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('erase')
    expect(Number.isInteger(events[0].mutationId)).toBe(true)
  })

  it('CLICK force 0: identical click removes nothing and fires no notification', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(30), 1, 'local', true)
    const events = captureMutations(engine)
    engine.setEraseStrength(0)

    click(engine, 50, 30, 100)

    expect(idsOf(engine)).toContain(1)
    expect(wetAt(engine, 50, 30)).toBeGreaterThan(0)
    expect(engine.getHistoryAvailability().undo).toBe(1)
    expect(events).toHaveLength(0)
  })

  it('CLICK pixel-only: click on dry paint without a recorded entry is a no-op', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(70), 1, 'local', true) // recorded, far away
    paintDryPatch(engine, 50, 30) // baked pixels only — NO entry
    const events = captureMutations(engine)
    const countBefore = engine.getStrokeCount()
    const historyBefore = engine.getHistoryAvailability()

    click(engine, 50, 30, 100)

    expect(dryAlphaAt(engine, 50, 30)).toBe(255)
    expect(engine.getStrokeCount()).toBe(countBefore)
    expect(engine.getHistoryAvailability()).toEqual(historyBefore)
    expect(events).toHaveLength(0)
  })

  it('CLICK empty space: click away from every stroke is a no-op', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(30), 1, 'local', true)
    const events = captureMutations(engine)
    const countBefore = engine.getStrokeCount()

    click(engine, 90, 90, 100)

    expect(engine.getStrokeCount()).toBe(countBefore)
    expect(wetAt(engine, 50, 30)).toBeGreaterThan(0)
    expect(engine.getHistoryAvailability().undo).toBe(1)
    expect(events).toHaveLength(0)
  })

  it('CLICK during drain: flush-before-remove leaves no orphan deposit, one erase notification', () => {
    const engine = createHarness()
    const events = captureMutations(engine)
    engine.setTool('paint')
    engine.onPointerDown(pointerEvent({ x: 20, y: 30, timeStamp: 10 }))
    engine.onPointerMove(pointerEvent({ x: 50, y: 30, timeStamp: 20 }))
    engine.onPointerMove(pointerEvent({ x: 80, y: 30, timeStamp: 30 }))
    engine.onPointerUp(pointerEvent({ x: 80, y: 30, timeStamp: 40, buttons: 0 }))
    expect(engine.pendingStrokeFinalizations).toHaveLength(1)
    expect(engine.getStrokeCount()).toBe(1)

    engine.setTool('erase')
    click(engine, 50, 30, 100)

    // Entry gone AND deposit gone (flush ran before removal — no ghost pixels).
    expect(idsOf(engine)).not.toContain(1)
    expect(engine.pendingStrokeFinalizations).toHaveLength(0)
    expect(wetAt(engine, 50, 30)).toBe(0)
    expect(engine.savedWet.alpha[30 * W + 50]).toBe(0)
    expect(dryAlphaAt(engine, 50, 30)).toBeLessThan(2)
    expect(engine.save().tracks[0].strokes ?? []).toHaveLength(0)
    // Exactly one erase notification (the paint finalization's own 'paint'
    // notification is the existing pipeline's, not the click path's).
    const eraseEvents = events.filter((e) => e.kind === 'erase')
    expect(eraseEvents).toHaveLength(1)
    expect(Number.isInteger(eraseEvents[0].mutationId)).toBe(true)
  })
})

// ─── HOVER: preview + pointer cursor ────────────────────────

describe('HOVER: erase tool previews the fresh stroke under the pointer', () => {
  it('HOVER PREVIEW: move over a fresh stroke targets it and previews its own geometry', () => {
    const engine = createHarness()
    const stroke = pushPaintStroke(engine, hLine(30), 1, 'local', true)

    hover(engine, 50, 30, 10)

    expect(engine.eraseHoverTargetId).toBe(1)
    expect(engine.previewStroke).not.toBeNull()
    expect(engine.previewStroke.pts).toBe(stroke.points)
    expect(engine.previewStroke.color).toBe('#ff4444')
    expect(engine.previewStroke.radius).toBe(6)
  })

  it('HOVER PREVIEW: move-off, leave, tool change and force 0 clear the preview', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(30), 1, 'local', true)

    hover(engine, 50, 30, 10) // (sets at GREEN — clearing is what this cell pins)
    hover(engine, 10, 90, 20) // off the stroke
    expect(engine.eraseHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()

    hover(engine, 50, 30, 30)
    engine.onPointerLeave(pointerEvent({ x: 50, y: 30, timeStamp: 40, buttons: 0 }))
    expect(engine.eraseHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()

    hover(engine, 50, 30, 50)
    engine.setTool('paint')
    expect(engine.eraseHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()
    engine.setTool('erase')

    hover(engine, 50, 30, 60)
    engine.setEraseStrength(0)
    expect(engine.eraseHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()
    hover(engine, 50, 30, 70)
    expect(engine.eraseHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()
  })

  it('HOVER POINTER CURSOR: drawBrushCursor runs in pointer mode while a hover target is active', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(30), 1, 'local', true)
    const ctx = createDisplayCtx()
    cursorMock.mockClear()

    hover(engine, 50, 30, 10)
    expect(engine.eraseHoverTargetId).toBe(1)

    engine.redrawDisplayOverlays(ctx)
    expect(cursorMode()).toBe('pointer')

    // The incremental restore box must fully contain the arrow glyph.
    const box = engine.overlayBoundsForCursor()
    expect(box).not.toBeNull()
    expect(box!.x0).toBeLessThanOrEqual(50)
    expect(box!.y0).toBeLessThanOrEqual(30)
    expect(box!.x1).toBeGreaterThanOrEqual(50 + 13) // arrow 11.5 + 3px under-stroke
    expect(box!.y1).toBeGreaterThanOrEqual(30 + 20) // arrow 18.8 + 3px under-stroke
  })

  it('HOVER POINTER CURSOR: brush mode off-stroke, after leave, after setTool(paint), while drawing, at force 0', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(30), 1, 'local', true)
    const ctx = createDisplayCtx()
    cursorMock.mockClear()

    // Off the stroke
    hover(engine, 10, 90, 10)
    engine.redrawDisplayOverlays(ctx)
    expect(cursorMode()).toBe('brush')

    // After onPointerLeave
    hover(engine, 50, 30, 20)
    engine.onPointerLeave(pointerEvent({ x: 50, y: 30, timeStamp: 30, buttons: 0 }))
    engine.redrawDisplayOverlays(ctx)
    expect(cursorMode()).toBe('brush')

    // After leaving the erase tool
    hover(engine, 50, 30, 40)
    engine.setTool('paint')
    engine.redrawDisplayOverlays(ctx)
    expect(cursorMode()).toBe('brush')
    engine.setTool('erase')

    // While drawing (gesture owns the state; hover is not computed)
    engine.onPointerDown(pointerEvent({ x: 50, y: 30, timeStamp: 50 }))
    engine.redrawDisplayOverlays(ctx)
    expect(cursorMode()).toBe('brush')
    engine.onPointerCancel(pointerEvent({ x: 50, y: 30, timeStamp: 60, buttons: 0 }))

    // At eraseStrength 0
    engine.setEraseStrength(0)
    hover(engine, 50, 30, 70)
    engine.redrawDisplayOverlays(ctx)
    expect(cursorMode()).toBe('brush')
    expect(engine.eraseHoverTargetId ?? null).toBeNull()
  })

  it('HOVER scope: pixel-only paint never becomes a hover target; while drawing the gesture owns previewStroke', () => {
    // Pixel-only paint: no entry under the pointer → no hover target.
    const engine = createHarness()
    paintDryPatch(engine, 50, 30)
    hover(engine, 50, 30, 10)
    expect(engine.eraseHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()

    // While drawing: hover is not computed, previewStroke belongs to the gesture.
    const e2 = createHarness()
    pushPaintStroke(e2, hLine(30), 1, 'local', true)
    hover(e2, 50, 30, 10) // hover (sets at GREEN)
    e2.onPointerDown(pointerEvent({ x: 50, y: 30, timeStamp: 20 }))
    expect(e2.previewStroke).toBeNull()
    expect(e2.eraseHoverTargetId ?? null).toBeNull()
    e2.onPointerMove(pointerEvent({ x: 55, y: 30, timeStamp: 30 })) // gesture sample 2 → ribbon
    expect(e2.previewStroke).not.toBeNull()
    expect(e2.previewStroke.pts).toBe(e2.rawPts)
    expect(e2.eraseHoverTargetId ?? null).toBeNull()
    e2.onPointerCancel(pointerEvent({ x: 55, y: 30, timeStamp: 40, buttons: 0 }))
  })
})

// ─── DRAG: existing cells must stay green ───────────────────

describe('DRAG GUARD: multi-sample erase behavior is unchanged', () => {
  it('DRAG GUARD: multi-sample erase drag still whole-stroke-removes a fresh stroke', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(30), 1, 'local', true)
    pushPaintStroke(engine, hLine(70), 2, 'local', true)

    drag(engine, [[50, 10], [50, 30], [50, 50]], 10)
    engine.flushPendingStrokeFinalizations()

    expect(idsOf(engine)).not.toContain(1)
    expect(idsOf(engine)).toContain(2)
    expect(wetAt(engine, 50, 30)).toBe(0)
    expect(wetAt(engine, 50, 70)).toBeGreaterThan(0)
  })

  it('DRAG GUARD: multi-sample drag still pixel-erases baked paint with the force law (force 0 inert)', () => {
    const engine = createHarness()
    paintDryPatch(engine, 50, 50)

    drag(engine, [[30, 50], [50, 50], [70, 50]], 10)
    engine.flushPendingStrokeFinalizations()

    expect(dryAlphaAt(engine, 50, 50)).toBeLessThan(2) // force 100: one pass clears
    expect(engine.getStrokeCount()).toBe(1) // only the erase gesture's own entry (D-S)

    // Force 0: the drag is inert on pixels.
    paintDryPatch(engine, 50, 70)
    engine.setEraseStrength(0)
    drag(engine, [[30, 70], [50, 70], [70, 70]], 100)
    engine.flushPendingStrokeFinalizations()
    expect(dryAlphaAt(engine, 50, 70)).toBe(255)
  })
})

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
