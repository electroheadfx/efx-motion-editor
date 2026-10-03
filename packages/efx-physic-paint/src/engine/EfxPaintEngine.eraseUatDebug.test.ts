// ============================================================
//  Erase contract UAT debug (erase-contract-uat-failure)
//
//  Diagnostic probes for the three UAT targets:
//  (A) order-dependence of whole-stroke erase on fresh/wet paint
//  (C) paint durability across save/load round-trip (key leave/return
//      class) — survivors must survive replay, and a reloaded doc must
//      remain whole-stroke erasable.
//
//  These tests assert the INTENDED contract (per debug session
//  .planning/debug/erase-contract-uat-failure.md), not current behavior.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const sx = Math.min(sw - 1, Math.floor((x * sw) / w))
            const sy = Math.min(sh - 1, Math.floor((y * sh) / h))
            const gx = dx + x, gy = dy + y
            if (gx < 0 || gx >= state.w || gy < 0 || gy >= state.h) continue
            const s = (sy * sw + sx) * 4, d = (gy * state.w + gx) * 4
            state.data[d] = srcData[s]; state.data[d + 1] = srcData[s + 1]
            state.data[d + 2] = srcData[s + 2]; state.data[d + 3] = srcData[s + 3]
          }
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
      opts: { size?: number }, _ctx: unknown, wet: { alpha: Float32Array; strokeOpacity: Float32Array },
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
  return { ...actual, drawBg: () => null, drawBrushCursor: () => {}, drawQueuedStrokePolyline: () => {}, drawStrokePreview: () => {}, setupDualCanvas: () => {} }
})

vi.mock('../render/compositor', () => ({ compositeWetLayer: () => {}, wetDisplayAlpha: (a: number) => a }))

vi.mock('../core/fluids', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/fluids')>()
  return { ...actual, localFluidPhysicsStep: () => {} }
})

import { EfxPaintEngine } from './EfxPaintEngine'
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
      dryCanvas: { ...dry, setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() },
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
    const ctx = engine.dualCanvas.dryCtx
    for (const p of points) {
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue
        const gx = Math.round(p.x) + dx, gy = Math.round(p.y) + dy
        if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue
        const id = ctx.getImageData(gx, gy, 1, 1)
        id.data[0] = 18; id.data[1] = 52; id.data[2] = 86; id.data[3] = 255
        ctx.putImageData(id, gx, gy)
      }
    }
    // baked strokes have zero wet
  }
  return stroke
}

function eraseGesture(engine: EngineInternals, points: PenPoint[], force = 50) {
  engine.state.tool = 'erase'
  engine.state.brushOpts = { ...defaultOpts, eraseStrength: force }
  engine.state.drawing = true
  const opts = { ...engine.state.brushOpts }
  engine.acceptStroke({
    tool: 'erase', points: points.map(p => ({ ...p })), color: null,
    params: opts, timestamp: Date.now(), hasPenInput: false, physicsMode: null,
  }, [], engine.nextMutationId++)
  engine.rawPts = []
  engine.flushPendingStrokeFinalizations()
}

function hLine(y: number): PenPoint[] {
  return [
    { x: 20, y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
    { x: 50, y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
    { x: 80, y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
  ]
}

function vCross(y: number): PenPoint[] {
  return [
    { x: 50, y: y - 12, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
    { x: 50, y, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
    { x: 50, y: y + 12, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
  ]
}

function wetAt(engine: EngineInternals, x: number, y: number): number {
  return engine.wet.alpha[y * W + x]
}

function idsOf(engine: EngineInternals): number[] {
  return engine.getStrokes().map((s: any) => s.mutationId).filter((v: any) => v !== undefined)
}

// ─── (A) order-independence of whole-stroke erase ────────────

describe('(A) whole-stroke erase is order-independent on fresh paint', () => {
  it('oldest-first: erase 1, then 2, then 3 removes each target and keeps the rest wet', () => {
    const engine = createHarness()
    const s1 = pushPaintStroke(engine, hLine(15), 1, 'local', true)
    const s2 = pushPaintStroke(engine, hLine(40), 2, 'local', true)
    const s3 = pushPaintStroke(engine, hLine(65), 3, 'local', true)
    const s4 = pushPaintStroke(engine, hLine(90), 4, 'local', true)

    eraseGesture(engine, vCross(15), 50)
    expect(idsOf(engine)).not.toContain(s1.mutationId)
    // survivors still wet (still whole-stroke-erasable)
    expect(wetAt(engine, 50, 40)).toBeGreaterThan(0)
    expect(wetAt(engine, 50, 65)).toBeGreaterThan(0)
    expect(wetAt(engine, 50, 90)).toBeGreaterThan(0)

    eraseGesture(engine, vCross(40), 50)
    expect(idsOf(engine)).not.toContain(s2.mutationId)
    expect(wetAt(engine, 50, 65)).toBeGreaterThan(0)
    expect(wetAt(engine, 50, 90)).toBeGreaterThan(0)

    eraseGesture(engine, vCross(65), 50)
    expect(idsOf(engine)).not.toContain(s3.mutationId)
    expect(idsOf(engine)).toContain(s4.mutationId)
    expect(wetAt(engine, 50, 90)).toBeGreaterThan(0)
  })

  it('rebuild does not bake surviving local strokes dry (mixed with a null-mode baked stroke)', () => {
    const engine = createHarness()
    // stroke 1: painted with physics OFF (physicsMode null → force-dried at finalize)
    pushPaintStroke(engine, hLine(15), 1, null, false)
    const s2 = pushPaintStroke(engine, hLine(40), 2, 'local', true)
    const s3 = pushPaintStroke(engine, hLine(65), 3, 'local', true)

    // Erase crosses stroke 2 → removal → redrawAll replays [1 (null), 2 gone, 3 (local)]
    eraseGesture(engine, vCross(40), 50)
    expect(idsOf(engine)).not.toContain(2)
    // stroke 3 must still be wet after the rebuild (null-mode replay must not bake it)
    expect(wetAt(engine, 50, 65)).toBeGreaterThan(0)
    expect(idsOf(engine)).toContain(s3.mutationId)
    expect(idsOf(engine)).toContain(1)
    void s2
  })
})

// ─── (B) cache paint = pixel erase on the preview-base layer ─

describe('(B) pixel erase removes cached (preview-base) paint', () => {
  it('punches the preview-base paint layer and keeps the erased copy as the source', () => {
    const engine = createHarness()
    // A returned key: no stroke entries — the paint is a raster on the preview base.
    const paintCanvas = createMockCanvas(W, H)
    for (let i = 0; i < SZ; i++) {
      paintCanvas._data[i * 4] = 18; paintCanvas._data[i * 4 + 1] = 52
      paintCanvas._data[i * 4 + 2] = 86; paintCanvas._data[i * 4 + 3] = 255
    }
    engine.previewBaseEnabled = true
    engine.previewBaseImage = paintCanvas
    engine.previewBackgroundSeparated = true

    eraseGesture(engine, vCross(50), 100)

    const erased = engine.previewBasePaintCanvas as { _data: Uint8ClampedArray } | null
    expect(erased, 'pixel erase must materialize the editable paint layer').not.toBeNull()
    // Force 100 clears the centreline in one pass
    expect(erased!._data[(50 * W + 50) * 4 + 3]).toBeLessThan(2)
    // Far from the gesture the cached paint survives
    expect(erased!._data[(50 * W + 5) * 4 + 3]).toBeGreaterThan(200)
    // The erased copy is the paint source — redrawPreviewBase must not resurrect
    expect(engine.getPreviewBasePaintSource()).toBe(erased)
    expect(engine.getPreviewBasePaintCanvas()).toBe(erased)
  })

  it('without an erase the paint source is the original image', () => {
    const engine = createHarness()
    const paintCanvas = createMockCanvas(W, H)
    engine.previewBaseEnabled = true
    engine.previewBaseImage = paintCanvas
    expect(engine.getPreviewBasePaintCanvas()).toBeNull()
    expect(engine.getPreviewBasePaintSource()).toBe(paintCanvas)
  })
})

// ─── (C) durability across save/load (key leave/return class) ─

describe('(C) paint survives save/load round-trip after an erase', () => {
  it('survivors are present and re-played wet after load', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(15), 1, 'local', true)
    pushPaintStroke(engine, hLine(40), 2, 'local', true)
    pushPaintStroke(engine, hLine(65), 3, 'local', true)
    eraseGesture(engine, vCross(15), 50) // removes stroke 1

    const doc = engine.save()
    const countBefore = engine.getStrokeCount()

    const engine2 = createHarness()
    engine2.load(doc)
    expect(engine2.getStrokeCount()).toBe(countBefore)
    // reloaded survivors replay their deposit (paint strokes stay visible)
    expect(wetAt(engine2, 50, 40)).toBeGreaterThan(0)
    expect(wetAt(engine2, 50, 65)).toBeGreaterThan(0)
    // removed stroke must NOT resurrect
    expect(wetAt(engine2, 50, 15)).toBe(0)
  })

  it('a reloaded document stays whole-stroke erasable (W-S fires after load)', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(15), 1, 'local', true)
    pushPaintStroke(engine, hLine(40), 2, 'local', true)
    const doc = engine.save()

    const engine2 = createHarness()
    engine2.load(doc)
    const idsBefore = idsOf(engine2)
    expect(idsBefore).toHaveLength(2)
    eraseGesture(engine2, vCross(40), 50)
    // whole-stroke removal: target entry gone, its deposit gone — same contract
    // as pre-save. (getStrokeCount includes the erase entry itself, so assert
    // on the reloaded identities rather than a raw count.)
    const afterIds = idsOf(engine2)
    // the y=40 stroke is the second loaded stroke — it must be gone, the y=15
    // survivor must remain (idsOf also sees the erase entry's id, so assert by
    // membership rather than raw count)
    expect(afterIds).toContain(idsBefore[0])
    expect(afterIds).not.toContain(idsBefore[1])
    expect(wetAt(engine2, 50, 40)).toBe(0)
  })

  it('save/load/save round-trip keeps the stroke list stable (no silent wipe)', () => {
    const engine = createHarness()
    pushPaintStroke(engine, hLine(15), 1, 'local', true)
    pushPaintStroke(engine, hLine(40), 2, 'local', true)
    eraseGesture(engine, vCross(15), 50)

    const doc1 = engine.save()
    const engine2 = createHarness()
    engine2.load(doc1)
    const doc2 = engine2.save()
    expect((doc2.tracks[0] as any).strokes.length).toBe((doc1.tracks[0] as any).strokes.length)
    expect(engine2.getStrokeCount()).toBeGreaterThan(0)
  })
})

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
