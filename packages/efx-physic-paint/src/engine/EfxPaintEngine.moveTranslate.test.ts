// ============================================================
//  Move tool (261004-dn5) — contract of record
//
//  - HOVER PREVIEW: tool 'move', not drawing, pointermove over a fresh
//    (script-backed) stroke — the engine reports that stroke's mutationId as
//    moveHoverTargetId and previews the stroke's OWN points with its own color
//    (fallback '#888888'), its render radius and opacity 0.6. Off the stroke,
//    after onPointerLeave and after leaving the tool the preview is cleared.
//    Pixel-only paint (no recorded entry) is never a preview target.
//  - CURSOR GLYPH: drawBrushCursor runs in pointer mode while a move hover
//    target is active (same glyph family as the erase hover).
//  - DRAG RIGIDITY: pointerdown on the stroke, pointermove by (dx, dy),
//    pointerup — EVERY point of the target entry gains exactly (dx, dy) while
//    p / tx / ty / tw / spd / timestamp / params are byte-identical: a rigid
//    translation, never a re-simulation.
//  - DEPOSIT FOLLOWS: after the commit the canvas shows the stroke's pixels at
//    the translated position (old position cleared, new position pixel-equal in
//    color and radius — look parity, no re-simulation).
//  - SAVE: serializeProject() carries the translated points with today's
//    2-decimal rounding; loading the serialized document back renders the
//    stroke at the moved position.
//  - MUTATION: exactly one CompletedPaintMutation with kind 'move' fires per
//    committed drag; getStrokeCount()/allActions stay unchanged; the undo
//    availability count does not move (a move pushes NO undo checkpoint) while
//    the redo availability is cleared (a stale redo can never repaint pre-move
//    pixels).
//  - CLICK WITHOUT DRAG: |dx| < 1 && |dy| < 1 discards silently — no mutation,
//    points unchanged, redrawAll never runs.
//  - SINGLE STROKE PER DRAG: two overlapping strokes → only the NEWEST hit
//    translates (firstOnly semantics of the ONE hit-test law).
//  - QUEUED-STROKE FLUSH: a stroke whose finalization is still queued is
//    flushed BEFORE the translation and re-found by mutationId after the flush.
//  - NO WET/DIRTY REFUSAL: a still-wet stroke is a valid move target — no
//    wetness gate is added ("dirty -> always refuse" must never return).
//  - GUARD: the paint path and the erase path are unchanged (regression cells
//    on the same mount), and a 'move' pointerdown with no script entry under it
//    is a pure no-op (no rawPts accumulation, no acceptStroke, no mutation).
//
//  Detection is ONE law shared by hover and gesture start: resolveEraseTargetIds
//  is reused verbatim (no second detection law) — every cell drives the REAL
//  pointer handlers (setTool / onPointerMove / onPointerDown / onPointerUp).
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
    moveHoverTargetId: null,
    moveGesture: null,
    lastPreviewBbox: null, lastCursorRect: null, drawnQueuedOutlineCount: 0,
    lastDisplayCompositeTime: 0, rafId: 0,
    allActions: [], undoStack: [], redoStack: [], historyEntries: [], historyIndex: 0,
    pendingStrokeFinalizations: [], activeStrokeFinalization: null,
    strokeFinalizationScheduled: false, strokeFinalizationGeneration: 0,
    nextMutationId: 1, activeMutationId: null, lastCompletedMutationId: null,
    performanceListener: null, completedMutationListener: null, historyAvailabilityListener: null,
    color: '#123456',
    state: {
      drawing: false, tool: 'paint' as const,
      brushOpts: { ...defaultOpts }, hasPenInput: false,
      // Null physics mode = every deposit force-dries to the DRY canvas, so the
      // deposit-follow cells can sample real pixels (the local mode keeps paint
      // in the wet buffer instead).
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
  const strokes = engine.getStrokes()
  return strokes[strokes.length - 1].mutationId
}

function hLine(y: number): Array<[number, number]> {
  return [[20, y], [50, y], [80, y]]
}

/** pointermove with no button — the hover path. */
function hover(engine: EngineInternals, x: number, y: number, timeStamp: number): void {
  engine.onPointerMove(pointerEvent({ x, y, timeStamp, buttons: 0, pointerType: 'mouse' }))
}

/** One click-drag with the move tool: down on `from`, one move to `to`, up. */
function moveDrag(engine: EngineInternals, from: [number, number], to: [number, number], t0: number): void {
  engine.onPointerDown(ev(from[0], from[1], t0, 1))
  engine.onPointerMove(ev(to[0], to[1], t0 + 10, 1))
  engine.onPointerUp(ev(to[0], to[1], t0 + 20, 0))
}

function dryAlphaAt(engine: EngineInternals, x: number, y: number): number {
  return engine.dualCanvas.dryCtx.getImageData(x, y, 1, 1).data[3]
}

function dryPixelAt(engine: EngineInternals, x: number, y: number): number[] {
  const d = engine.dualCanvas.dryCtx.getImageData(x, y, 1, 1).data
  return [d[0], d[1], d[2], d[3]]
}

function strokeById(engine: EngineInternals, mutationId: number) {
  return engine.getStrokes().find((s: { mutationId?: number }) => s.mutationId === mutationId)
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

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── HOVER: the move tool previews the stroke under the pointer ────

describe('HOVER: move tool previews the fresh stroke under the pointer', () => {
  it('HOVER PREVIEW: hovering a script-backed stroke targets it and previews its own color/radius at 0.6 opacity', () => {
    const engine = createHarness()
    const id = paintStroke(engine, hLine(30), 100)
    const before = strokeById(engine, id)
    expect(before).toBeTruthy()

    engine.setTool('move')
    hover(engine, 50, 30, 200)

    expect(engine.moveHoverTargetId).toBe(id)
    expect(engine.previewStroke).not.toBeNull()
    expect(engine.previewStroke.pts.map((p: PenPoint) => p.x)).toEqual(before.points.map((p) => p.x))
    expect(engine.previewStroke.pts.map((p: PenPoint) => p.y)).toEqual(before.points.map((p) => p.y))
    expect(engine.previewStroke.color).toBe(before.color)
    expect(engine.previewStroke.radius).toBe(6)
    expect(engine.previewStroke.opacity).toBe(0.6)
  })

  it('HOVER PREVIEW: off the stroke, after pointerleave and after leaving the tool the preview is cleared', () => {
    const engine = createHarness()
    paintStroke(engine, hLine(30), 100)
    engine.setTool('move')

    hover(engine, 50, 30, 200)
    expect(engine.moveHoverTargetId).not.toBeNull()

    hover(engine, 10, 90, 210) // off the stroke
    expect(engine.moveHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()

    hover(engine, 50, 30, 220)
    engine.onPointerLeave(ev(50, 30, 230, 0))
    expect(engine.moveHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()

    hover(engine, 50, 30, 240)
    engine.setTool('paint')
    expect(engine.moveHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()
  })

  it('HOVER SCOPE: pixel-only (baked) paint is never a move preview target', () => {
    const engine = createHarness()
    paintDryPatch(engine, 50, 30) // dry pixels only — NO script entry
    engine.setTool('move')

    hover(engine, 50, 30, 200)

    expect(engine.moveHoverTargetId ?? null).toBeNull()
    expect(engine.previewStroke).toBeNull()
  })

  it('HOVER POINTER CURSOR: drawBrushCursor runs in pointer mode while a move hover target is active', () => {
    const engine = createHarness()
    paintStroke(engine, hLine(30), 100)
    engine.setTool('move')
    const ctx = createDisplayCtx()
    cursorMock.mockClear()

    hover(engine, 50, 30, 200)
    expect(engine.moveHoverTargetId).not.toBeNull()

    engine.redrawDisplayOverlays(ctx)
    expect(cursorMode()).toBe('pointer')

    const box = engine.overlayBoundsForCursor()
    expect(box).not.toBeNull()
    expect(box!.x0).toBeLessThanOrEqual(50)
    expect(box!.y1).toBeGreaterThanOrEqual(30)
  })

  it('HOVER POINTER CURSOR: brush mode off the stroke and after leaving the tool', () => {
    const engine = createHarness()
    paintStroke(engine, hLine(30), 100)
    engine.setTool('move')
    const ctx = createDisplayCtx()
    cursorMock.mockClear()

    hover(engine, 10, 90, 200)
    engine.redrawDisplayOverlays(ctx)
    expect(cursorMode()).toBe('brush')

    hover(engine, 50, 30, 210)
    engine.setTool('paint')
    engine.redrawDisplayOverlays(ctx)
    expect(cursorMode()).toBe('brush')
  })
})

// ─── DRAG: rigid translation of the whole stroke ───────────────────

describe('DRAG: one click-drag rigidly translates the whole stroke', () => {
  it('DRAG RIGIDITY: every point gains exactly (dx, dy); p/tx/ty/tw/spd/timestamp/params are untouched', () => {
    const engine = createHarness()
    const id = paintStroke(engine, hLine(30), 100)
    const before = strokeById(engine, id)
    const snapshot = before.points.map((p: PenPoint) => ({ ...p }))
    const paramsBefore = { ...before.params }

    engine.setTool('move')
    moveDrag(engine, [50, 30], [70, 40], 200)
    engine.flushPendingStrokeFinalizations()

    const after = strokeById(engine, id)
    expect(after.points).toHaveLength(snapshot.length)
    snapshot.forEach((p, i) => {
      expect(after.points[i].x).toBe(p.x + 20)
      expect(after.points[i].y).toBe(p.y + 10)
      expect(after.points[i].p).toBe(p.p)
      expect(after.points[i].tx).toBe(p.tx)
      expect(after.points[i].ty).toBe(p.ty)
      expect(after.points[i].tw).toBe(p.tw)
      expect(after.points[i].spd).toBe(p.spd)
    })
    expect(after.timestamp).toBe(before.timestamp)
    expect(after.params).toEqual(paramsBefore)
  })

  it('DEPOSIT FOLLOWS: old position cleared, new position painted, look pixel-equal', () => {
    const engine = createHarness()
    const id = paintStroke(engine, hLine(30), 100)
    engine.flushPendingStrokeFinalizations()

    expect(dryAlphaAt(engine, 50, 30)).toBeGreaterThan(200)
    expect(dryAlphaAt(engine, 70, 40)).toBe(0)
    const pixelBefore = dryPixelAt(engine, 50, 30)
    // Radius probe: 7px off the centerline sits outside the 6px disk.
    expect(dryAlphaAt(engine, 50, 37)).toBe(0)

    engine.setTool('move')
    moveDrag(engine, [50, 30], [70, 40], 200)
    engine.flushPendingStrokeFinalizations()

    expect(dryAlphaAt(engine, 50, 30)).toBe(0)
    expect(dryAlphaAt(engine, 70, 40)).toBeGreaterThan(200)
    expect(dryPixelAt(engine, 70, 40)).toEqual(pixelBefore)
    expect(dryAlphaAt(engine, 70, 47)).toBe(0)
    expect(strokeById(engine, id).points[1].x).toBe(70)
    expect(strokeById(engine, id).points[1].y).toBe(40)
  })

  it('CLICK WITHOUT DRAG: |dx| < 1 && |dy| < 1 commits nothing — no mutation, points unchanged, no redraw', () => {
    const engine = createHarness()
    const id = paintStroke(engine, hLine(30), 100)
    const before = strokeById(engine, id).points.map((p: PenPoint) => ({ ...p }))
    const historyBefore = engine.getHistoryAvailability()
    const events = captureMutations(engine)
    const redraw = vi.spyOn(engine as never, 'redrawAll' as never)

    engine.setTool('move')
    // Sub-pixel press/release pair: |dx| and |dy| both stay under the commit floor.
    engine.onPointerDown(ev(50, 30, 200, 1))
    engine.onPointerUp(ev(50.4, 30.4, 210, 0))

    expect(events.filter((e) => e.kind === 'move')).toHaveLength(0)
    const after = strokeById(engine, id).points
    after.forEach((p: PenPoint, i: number) => {
      expect(p.x).toBe(before[i].x)
      expect(p.y).toBe(before[i].y)
    })
    expect(engine.getHistoryAvailability()).toEqual(historyBefore)
    expect(redraw).not.toHaveBeenCalled()
  })

  it('SINGLE STROKE PER DRAG: only the newest of two overlapping strokes translates', () => {
    const engine = createHarness()
    const older = paintStroke(engine, hLine(30), 100)
    const newer = paintStroke(engine, hLine(30), 300)
    const olderBefore = strokeById(engine, older).points.map((p: PenPoint) => ({ ...p }))

    engine.setTool('move')
    moveDrag(engine, [50, 30], [70, 50], 400)
    engine.flushPendingStrokeFinalizations()

    const olderAfter = strokeById(engine, older).points
    olderAfter.forEach((p: PenPoint, i: number) => {
      expect(p.x).toBe(olderBefore[i].x)
      expect(p.y).toBe(olderBefore[i].y)
    })
    expect(strokeById(engine, newer).points[1].x).toBe(70)
    expect(strokeById(engine, newer).points[1].y).toBe(50)
  })

  it('QUEUED-STROKE FLUSH: a still-queued stroke is flushed first and re-found by mutationId after the flush', () => {
    const engine = createHarness()
    engine.setTool('paint')
    engine.onPointerDown(ev(20, 30, 10, 1))
    engine.onPointerMove(ev(50, 30, 20, 1))
    engine.onPointerMove(ev(80, 30, 30, 1))
    engine.onPointerUp(ev(80, 30, 40, 0))
    expect(engine.pendingStrokeFinalizations).toHaveLength(1)
    expect(engine.getStrokeCount()).toBe(1)
    const id = engine.getStrokes()[0].mutationId

    engine.setTool('move')
    moveDrag(engine, [50, 30], [70, 40], 200)

    expect(engine.pendingStrokeFinalizations).toHaveLength(0)
    expect(strokeById(engine, id).points[1].x).toBe(70)
    expect(dryAlphaAt(engine, 50, 30)).toBe(0)
    expect(dryAlphaAt(engine, 70, 40)).toBeGreaterThan(200)
  })

  it('NO WET REFUSAL: a still-wet stroke is a valid move target (no wetness gate is added)', () => {
    const engine = createHarness()
    const id = paintStroke(engine, hLine(30), 100)
    // Simulate a stroke whose deposit has not dried yet.
    engine.wet.alpha[30 * W + 50] = 300
    expect(engine.wet.alpha[30 * W + 50]).toBeGreaterThan(0)

    engine.setTool('move')
    moveDrag(engine, [50, 30], [70, 40], 200)
    engine.flushPendingStrokeFinalizations()

    expect(strokeById(engine, id).points[1].x).toBe(70)
    expect(strokeById(engine, id).points[1].y).toBe(40)
  })
})

// ─── MUTATION / HISTORY / SAVE contract ────────────────────────────

describe('COMMIT: one move mutation, no undo checkpoint, redo cleared, Save writes the new coordinates', () => {
  it('MUTATION: exactly one kind-move notification, stroke count unchanged, undo count unchanged, redo cleared', () => {
    const engine = createHarness()
    paintStroke(engine, hLine(30), 100)
    // Seed a redo checkpoint the move must clear (a stale redo could repaint the
    // pre-move pixels). Structurally the same entry undo() pushes.
    engine.redoStack.push({ mutationId: 999, actions: [], checkpoint: null, deferred: null })
    const undoBefore = engine.getHistoryAvailability().undo
    expect(engine.getHistoryAvailability().redo).toBe(1)
    const events = captureMutations(engine)
    const availability: Array<{ undo: number; redo: number }> = []
    engine.setHistoryAvailabilityListener((next) => { availability.push(next) })

    engine.setTool('move')
    moveDrag(engine, [50, 30], [70, 40], 200)
    engine.flushPendingStrokeFinalizations()

    const moveEvents = events.filter((e) => e.kind === 'move')
    expect(moveEvents).toHaveLength(1)
    expect(Number.isInteger(moveEvents[0].mutationId)).toBe(true)
    expect(engine.getStrokeCount()).toBe(1)
    expect(engine.getHistoryAvailability().undo).toBe(undoBefore)
    expect(engine.getHistoryAvailability().redo).toBe(0)
    expect(availability.at(-1)).toEqual({ undo: undoBefore, redo: 0 })
  })

  it('SAVE: serializeProject carries the translated points (2-decimal rounding) and reload renders them moved', () => {
    const engine = createHarness()
    const id = paintStroke(engine, hLine(30), 100)
    engine.setTool('move')
    // 7.777 / -3.333 exercises the existing 2-decimal rounding on save.
    moveDrag(engine, [50, 30], [57.777, 26.667], 200)
    engine.flushPendingStrokeFinalizations()

    const doc = engine.save()
    const strokes = doc.tracks[0].strokes ?? []
    expect(strokes).toHaveLength(1)
    const pts = strokes[0].pts
    expect(pts[1][0]).toBe(Math.round((50 + 7.777) * 100) / 100)
    expect(pts[1][1]).toBe(Math.round((30 - 3.333) * 100) / 100)
    expect(pts[1][0]).not.toBe(50)

    const reloaded = createHarness()
    reloaded.load(doc)
    expect(reloaded.getStrokeCount()).toBe(1)
    expect(dryAlphaAt(reloaded, 50, 30)).toBe(0)
    expect(dryAlphaAt(reloaded, 58, 27)).toBeGreaterThan(200)
    expect(reloaded.getStrokes()[0].mutationId).not.toBe(undefined)
    void id
  })

  it('MOVE NEVER PAINTS: a move commit does not push a new history entry or a new allActions entry', () => {
    const engine = createHarness()
    const id = paintStroke(engine, hLine(30), 100)
    const actionsBefore = engine.allActions.length
    const historyBefore = engine.undoStack.length

    engine.setTool('move')
    moveDrag(engine, [50, 30], [70, 40], 200)
    engine.flushPendingStrokeFinalizations()

    expect(engine.allActions.length).toBe(actionsBefore)
    expect(engine.undoStack.length).toBe(historyBefore)
    expect(engine.allActions.filter((a: { mutationId?: number }) => a.mutationId === id)).toHaveLength(1)
  })
})

// ─── GUARD: never a paint target, paint/erase paths unchanged ──────

describe('GUARD: the move tool never paints and never changes the existing paths', () => {
  it('NO TARGET: a move pointerdown over bare canvas is a pure no-op (no rawPts, no acceptStroke, no mutation)', () => {
    const engine = createHarness()
    paintDryPatch(engine, 10, 10) // pixels far away, no script entry at 50/30
    const events = captureMutations(engine)
    const countBefore = engine.getStrokeCount()
    const historyBefore = engine.getHistoryAvailability()
    const redraw = vi.spyOn(engine as never, 'redrawAll' as never)

    engine.setTool('move')
    engine.onPointerDown(ev(50, 30, 200, 1))
    expect(engine.rawPts).toHaveLength(0)
    expect(engine.state.drawing).toBe(false)
    engine.onPointerMove(ev(70, 40, 210, 1))
    engine.onPointerUp(ev(70, 40, 220, 0))

    expect(engine.getStrokeCount()).toBe(countBefore)
    expect(engine.getHistoryAvailability()).toEqual(historyBefore)
    expect(events.filter((e) => e.kind === 'move')).toHaveLength(0)
    expect(redraw).not.toHaveBeenCalled()
  })

  it('PAINT PATH UNCHANGED: painting with the move tool absent from the flow still records one stroke', () => {
    const engine = createHarness()
    const events = captureMutations(engine)

    const id = paintStroke(engine, hLine(30), 100)

    expect(engine.getStrokeCount()).toBe(1)
    expect(strokeById(engine, id)).toBeTruthy()
    expect(events.filter((e) => e.kind === 'paint')).toHaveLength(1)
    expect(engine.getHistoryAvailability().undo).toBe(1)
  })

  it('ERASE PATH UNCHANGED: a click with the erase tool still whole-stroke-removes the fresh stroke', () => {
    const engine = createHarness()
    const id = paintStroke(engine, hLine(30), 100)
    const events = captureMutations(engine)

    engine.setTool('erase')
    engine.onPointerDown(ev(50, 30, 200, 1))
    engine.onPointerUp(ev(50, 30, 210, 0))
    engine.flushPendingStrokeFinalizations()

    expect(strokeById(engine, id)).toBeUndefined()
    expect(engine.getStrokeCount()).toBe(0)
    expect(dryAlphaAt(engine, 50, 30)).toBe(0)
    expect(events.filter((e) => e.kind === 'erase')).toHaveLength(1)
  })
})
