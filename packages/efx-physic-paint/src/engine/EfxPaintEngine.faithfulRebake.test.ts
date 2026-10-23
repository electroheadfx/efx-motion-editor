// ============================================================
//  261023-j5b — the faithful edit rebake contract.
//
//  The h9v restore replayed every retained stroke with
//  `{ replay: true }`, which SKIPS prepareWetLayerForStroke. Each
//  replayed stroke then left its wet material behind, so strokes
//  grew and gained halos (slow navigation AND corrupting). The j5b
//  law:
//
//    - LAZY ATTACH never replays: attachStrokesBaseline only
//      installs the ledger and marks the visit 'detached';
//    - the FIRST script edit of a detached visit rebakes the whole
//      ledger with LIVE deposit semantics (prepareWetLayerForStroke
//      per stroke) and clears the duplicated preview base ONCE;
//    - 'faithful' persists for the rest of the visit — a second
//      edit never falls back to replay:true;
//    - the visit's captured paint globals are applied for the
//      rebake and the live globals restored afterwards;
//    - clear() resets the visit to 'live' and drops the settings.
//
//  The harness is the engine suite's prototype-based mock canvas
//  (restoreBaseline precedent); applyStrokeToEngine and
//  prepareWetLayerForStroke are wrapped so the replay flags and the
//  applied settings are observable without a DOM.
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
import type { PaintRenderSettings, RecordedStrokeGroup } from './EfxPaintEngine'
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

/** The globals live on a fresh harness (mirrors the constructor defaults). */
const LIVE_SETTINGS: PaintRenderSettings = {
  localSpreadStrength: 65,
  wetPaper: true,
  physicsStrength: 0.2,
  paperGrain: '',
}

/** The frame's captured globals — deliberately different from LIVE_SETTINGS. */
const FRAME_SETTINGS: PaintRenderSettings = {
  localSpreadStrength: 10,
  wetPaper: false,
  physicsStrength: 0.8,
  paperGrain: 'grainB',
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
      wetPaper: true, embossStrength: 0, localSpreadStrength: 65,
      physicsStrength: 0.2, physicsRunning: false,
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
  delete (engine as any).prepareWetLayerForStroke
  delete (engine as any).applyStrokeToEngine

  const replayLog: Array<{ replay: boolean; settings: PaintRenderSettings }> = []
  const prepareLog: number[] = []
  const clearLog: Array<boolean | undefined> = []

  const originalApply = (EfxPaintEngine.prototype as unknown as Record<string, any>).applyStrokeToEngine
  const originalPrepare = (EfxPaintEngine.prototype as unknown as Record<string, any>).prepareWetLayerForStroke
  const originalClear = (EfxPaintEngine.prototype as unknown as Record<string, any>).clearPreviewBaseImage

  engine.applyStrokeToEngine = (tool: unknown, points: unknown, color: unknown, opts: unknown, options: Record<string, unknown> = {}) => {
    replayLog.push({
      replay: options.replay === true,
      settings: engine.getPaintRenderSettings(),
    })
    return originalApply.call(engine, tool, points, color, opts, options)
  }
  engine.prepareWetLayerForStroke = (...args: unknown[]) => {
    prepareLog.push(1)
    return originalPrepare.apply(engine, args)
  }
  engine.clearPreviewBaseImage = (skipRedraw?: boolean) => {
    clearLog.push(skipRedraw)
    return originalClear.call(engine, skipRedraw)
  }

  // A real paper texture for FRAME_SETTINGS.paperGrain (grain-on rebake).
  ;(engine.paperTextures as Map<string, { heightMap: Float32Array }>).set('grainB', {
    heightMap: new Float32Array(SZ),
  })

  return { engine, replayLog, prepareLog, clearLog }
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
  }
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('lazy attach: no replay on navigation', () => {
  it('installs the ledger and detaches without rendering a stroke or touching the base', () => {
    const { engine, replayLog, prepareLog, clearLog } = createHarness()

    expect(engine.attachStrokesBaseline([group(7), group(9)], FRAME_SETTINGS)).toBe(2)

    expect(replayLog).toEqual([])
    expect(prepareLog).toEqual([])
    expect(clearLog).toEqual([])
    expect(engine.getStrokes().map((entry) => entry.mutationId)).toEqual([7, 9])
    expect(engine.strokeReplayMode).toBe('detached')
    expect(engine.getFramePaintSettings()).toEqual(FRAME_SETTINGS)
  })

  it('a redraw while detached (async base decode landing) still replays nothing', () => {
    const { engine, replayLog } = createHarness()
    engine.attachStrokesBaseline([group(7)])

    engine.renderAllStrokes()

    expect(replayLog).toEqual([])
  })
})

describe('first edit: faithful rebake with LIVE deposit semantics', () => {
  it('replays every remaining stroke with replay:false and one prepareWetLayerForStroke each', () => {
    const { engine, replayLog, prepareLog } = createHarness()
    engine.attachStrokesBaseline([group(7), group(9)])

    expect(engine.deleteStroke(7)).toBe(true)

    expect(replayLog.map((entry) => entry.replay)).toEqual([false])
    expect(prepareLog).toHaveLength(1)
    expect(engine.strokeReplayMode).toBe('faithful')
  })

  it('clears a detached visit\'s duplicated preview base exactly ONCE', () => {
    const { engine, clearLog } = createHarness()
    engine.attachStrokesBaseline([group(7), group(9)])

    engine.deleteStroke(7)
    expect(clearLog).toEqual([true])

    // Second edit: still faithful, base already owns no duplicate.
    expect(engine.moveStroke(9, 5, 0)).toBe(true)
    expect(clearLog).toEqual([true])
  })

  it('a LIVE complete visit (Duplicate-derived) clears the duplicated base once when declared', () => {
    const { engine, clearLog } = createHarness()
    engine.attachStrokesBaseline([group(7), group(9)])
    // Duplicate-derived live visit: the ledger is present and the preview base
    // still holds the same script; no edit has run yet.
    engine.strokeReplayMode = 'live'
    engine.setScriptBaseClearPending(true)

    expect(engine.deleteStroke(7)).toBe(true)
    expect(clearLog).toEqual([true])

    // The port re-declares completeness on every edit; the once-per-visit
    // guard must not wipe the just-rebaked pixels again.
    engine.setScriptBaseClearPending(true)
    expect(engine.moveStroke(9, 5, 0)).toBe(true)
    expect(clearLog).toEqual([true])
  })

  it('a LIVE partial visit keeps its pre-existing base', () => {
    const { engine, clearLog } = createHarness()
    engine.attachStrokesBaseline([group(7)])
    engine.strokeReplayMode = 'live'
    engine.setScriptBaseClearPending(false)

    expect(engine.deleteStroke(7)).toBe(true)

    expect(clearLog).toEqual([])
  })

  it('a second edit keeps replay:false (the visit never falls back to replay:true)', () => {
    const { engine, replayLog, prepareLog } = createHarness()
    engine.attachStrokesBaseline([group(7), group(9)])

    engine.deleteStroke(7)
    engine.moveStroke(9, 5, 0)
    engine.moveStroke(9, -5, 0)

    expect(replayLog.map((entry) => entry.replay)).toEqual([false, false, false])
    expect(prepareLog).toHaveLength(3)
  })

  it('the no-cache fallback (restoreStrokesBaseline on a LIVE visit) also rebakes faithfully and keeps the base', () => {
    const { engine, replayLog, clearLog } = createHarness()

    expect(engine.restoreStrokesBaseline([group(4), group(8)])).toBe(2)

    expect(replayLog.map((entry) => entry.replay)).toEqual([false, false])
    // A live visit's base belongs to the frame BEFORE these strokes — keep it.
    expect(clearLog).toEqual([])
    expect(engine.strokeReplayMode).toBe('faithful')
  })
})

describe('paint settings: applied for the rebake, restored afterwards', () => {
  it('applies the frame snapshot to every replayed stroke and restores the live globals', () => {
    const { engine, replayLog } = createHarness()
    engine.attachStrokesBaseline([group(7), group(9)], FRAME_SETTINGS)

    engine.deleteStroke(7)

    expect(replayLog).toHaveLength(1)
    expect(replayLog[0].settings).toEqual(FRAME_SETTINGS)
    // Restored: the engine reads the live globals again after the rebake.
    expect(engine.getPaintRenderSettings()).toEqual(LIVE_SETTINGS)
    expect(engine.paperHeight).toBeNull()
    // The visit keeps its captured snapshot for the next edit.
    expect(engine.getFramePaintSettings()).toEqual(FRAME_SETTINGS)
  })

  it('a rebake without a captured snapshot leaves the live globals untouched', () => {
    const { engine, replayLog } = createHarness()
    engine.attachStrokesBaseline([group(7)])

    engine.rebakeStrokesFaithfully(null)

    expect(replayLog).toHaveLength(1)
    expect(replayLog[0].settings).toEqual(LIVE_SETTINGS)
    expect(engine.getPaintRenderSettings()).toEqual(LIVE_SETTINGS)
  })

  it('never captures the temporary applied globals as the visit snapshot', () => {
    const { engine } = createHarness()
    engine.attachStrokesBaseline([group(7), group(9)])
    expect(engine.getFramePaintSettings()).toBeNull()

    // The rebake runs under FRAME_SETTINGS via the public seam.
    engine.rebakeStrokesFaithfully(FRAME_SETTINGS)

    expect(engine.getFramePaintSettings()).toBeNull()
    expect(engine.getPaintRenderSettings()).toEqual(LIVE_SETTINGS)
  })
})

describe('clear() ends the visit', () => {
  it('resets the replay mode to live and drops the frame paint settings', () => {
    const { engine } = createHarness()
    engine.attachStrokesBaseline([group(7)], FRAME_SETTINGS)
    engine.deleteStroke(7)
    expect(engine.strokeReplayMode).toBe('faithful')
    expect(engine.getFramePaintSettings()).toEqual(FRAME_SETTINGS)

    engine.clear()

    expect(engine.strokeReplayMode).toBe('live')
    expect(engine.getFramePaintSettings()).toBeNull()
  })

  it('a live paint after clear() captures the fresh globals again', () => {
    const { engine } = createHarness()
    engine.attachStrokesBaseline([group(7)], FRAME_SETTINGS)
    engine.clear()
    engine.state.localSpreadStrength = 40
    engine.state.wetPaper = false
    engine.state.physicsStrength = 0.5
    engine.currentPaperKey = 'grainB'

    engine.applyStrokeToEngine('paint', [point(2, 2), point(8, 8)], '#123456', { ...defaultOpts }, {})

    expect(engine.getFramePaintSettings()).toEqual({
      localSpreadStrength: 40,
      wetPaper: false,
      physicsStrength: 0.5,
      paperGrain: 'grainB',
    })
  })
})
