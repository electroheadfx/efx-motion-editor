// ============================================================
//  Erase Contract — truth table (261003-hpi)
//
//  | #  | State under the gesture | Semantics | Force |
//  |----|------------------------|-----------|-------|
//  | W-S | WET: gesture crosses a recorded paint stroke with wet.alpha>=1 | STROKE — remove whole stroke (entry + deposit) | 0=inert, >=1 full removal |
//  | W-P | WET | NEVER — no pixel-granular wet lightening | all |
//  | D-P | DRY (baked only) | PIXEL — per-pass removal >= force/100 at full coverage | 0=none, 100->1pass, 50-><=8, 25-><=21 |
//  | D-S | DRY | NEVER — no entry/history mutation from pixel cell | all |
//
//  Mixed gesture: both cells apply per region. Orphan wet (no entry): untouched.
//  R4: erase seed never aligns with erased mark. Frozen knobs: 40/4500/0.5.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { depositAlongPath, createMockCanvas, pointToPolylineDist, polygonVertices } = vi.hoisted(() => {
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

  function pointInPolygon(px: number, py: number, path: Array<[number, number]>): boolean {
    let inside = false
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      const [xi, yi] = path[i]
      const [xj, yj] = path[j]
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
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
      _data: state.data,
    }
  }

  function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.hypot(px - x1, py - y1)
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
  }

  function pointToPolylineDist(px: number, py: number, points: Array<{ x: number; y: number }>): number {
    if (points.length === 0) return Infinity
    if (points.length === 1) return Math.hypot(px - points[0].x, py - points[0].y)
    let min = Infinity
    for (let i = 0; i < points.length - 1; i++)
      min = Math.min(min, segDist(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y))
    return min
  }

  return { depositAlongPath, createMockCanvas, pointToPolylineDist, polygonVertices: null as any }
})

vi.mock('../brush/paint', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../brush/paint')>()
  return {
    ...actual,
    renderPaintStroke: (
      points: Array<{ x: number; y: number }>, _c: string | null,
      opts: { size?: number }, _ctx: unknown, wet: { alpha: Float32Array },
      _s: unknown, _d: unknown, _m: unknown, _p: unknown,
      width: number, height: number,
    ) => {
      depositAlongPath(wet.alpha, points, width, height, Math.max(3, (opts.size || 12) / 2 + 2), 500)
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
import { applyEraseStroke } from '../brush/erase'
import { DEPOSIT_KEEP_TIER, DEPOSIT_DENSITY_SCALE, PAPER_ADSORPTION_GAMMA } from '../core/wet-layer'
import { seededRng, hashMutationId } from '../util/traceSeed'
import { deformNScaled } from '../brush/stroke'
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
    },
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
    previewBaseEnabled: false, visibleBackgroundSuppressed: false,
    displayCompositeDirty: false, lookDelta: null, wetDisplayScratch: null,
    lastStrokeBounds: null,
    getStrokeMetadata: undefined,
    recordPerformance: vi.fn(),
    requestRender: vi.fn(), compositeDisplayNow: vi.fn(), renderVisibleWetLayer: vi.fn(),
    redrawPreviewBase: vi.fn(), prepareWetLayerForStroke: vi.fn(),
    scheduleStrokeFinalization: vi.fn(), markStrokeHandoffComplete: vi.fn(),
    beginBakeParityFlushCapture: vi.fn(), completeBakeParityFlushCapture: vi.fn(),
    beginBakeParityTransfer: vi.fn(), endBakeParityTransfer: vi.fn(),
    hasPendingInput: vi.fn(() => false),
  })
  return engine
}

function addPaintStroke(engine: EngineInternals, points: PenPoint[], opts: BrushOpts, mutationId: number, wet = true) {
  const stroke = {
    tool: 'paint' as const, points: points.map(p => ({ ...p })), color: '#123456',
    params: { ...opts }, timestamp: Date.now(), hasPenInput: false,
    physicsMode: 'local' as const, mutationId,
  }
  engine.allActions.push(stroke)
  engine.undoStack.push({ mutationId, actions: [stroke], checkpoint: null, deferred: null })
  engine.historyEntries = [...engine.undoStack]
  engine.historyIndex = engine.undoStack.length
  engine.nextMutationId = Math.max(engine.nextMutationId, mutationId + 1)
  const radius = Math.max(3, (opts.size || 12) / 2)
  if (wet) {
    depositAlongPath(engine.wet.alpha, points, W, H, radius, 500)
    depositAlongPath(engine.savedWet.alpha, points, W, H, radius, 500)
  } else {
    // baked: write opaque pixels to dry canvas
    const ctx = engine.dualCanvas.dryCtx
    for (const p of points) {
      const r = Math.ceil(radius)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue
        const gx = Math.round(p.x) + dx, gy = Math.round(p.y) + dy
        if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue
        const d = (gy * W + gx) * 4
        const id = ctx.getImageData(gx, gy, 1, 1)
        id.data[0] = 18; id.data[1] = 52; id.data[2] = 86; id.data[3] = 255
        ctx.putImageData(id, gx, gy)
      }
    }
  }
  return stroke
}

function eraseGesture(engine: EngineInternals, points: PenPoint[], force: number) {
  engine.state.tool = 'erase'
  engine.state.brushOpts = { ...defaultOpts, eraseStrength: force }
  engine.rawPts = points.map(p => ({ ...p }))
  engine.state.drawing = true
  // Simulate pointer-up acceptance + finalize
  const opts = { ...engine.state.brushOpts }
  engine.acceptStroke({
    tool: 'erase', points: points.map(p => ({ ...p })), color: null,
    params: opts, timestamp: Date.now(), hasPenInput: false, physicsMode: null,
  }, [], engine.nextMutationId++)
  engine.rawPts = []
  engine.flushPendingStrokeFinalizations()
}

function dryAlphaAt(engine: EngineInternals, x: number, y: number): number {
  return engine.dualCanvas.dryCtx.getImageData(x, y, 1, 1).data[3]
}

function wetAlphaAt(engine: EngineInternals, x: number, y: number): number {
  return engine.wet.alpha[y * W + x]
}

const H_LINE_A: PenPoint[] = [
  { x: 20, y: 30, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
  { x: 50, y: 30, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
  { x: 80, y: 30, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
]
const H_LINE_B: PenPoint[] = [
  { x: 20, y: 70, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
  { x: 50, y: 70, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
  { x: 80, y: 70, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
]
const V_ERASE_CROSSES_A: PenPoint[] = [
  { x: 50, y: 10, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
  { x: 50, y: 25, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
  { x: 50, y: 40, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
]

// ─── D-P: dry pixel eraser force law ─────────────────────────

describe('D-P: dry pixel eraser force law', () => {
  function runDryPass(force: number, mutationId: number, initial = 255): number {
    vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
    const dry = createMockCanvas(W, H)
    // Fill solid opaque
    for (let i = 0; i < SZ; i++) { dry._data[i * 4] = 18; dry._data[i * 4 + 1] = 52; dry._data[i * 4 + 2] = 86; dry._data[i * 4 + 3] = initial }
    const wet = makeBuffers()
    const pts: PenPoint[] = [
      { x: 20, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
      { x: 50, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
      { x: 80, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
    ]
    const opts = { ...defaultOpts, eraseStrength: force }
    let alpha = initial
    let passes = 0
    while (alpha >= 2 && passes < 100) {
      applyEraseStroke(pts, opts, dry.getContext('2d') as any, wet as any, W, H, false, null, 'transparent', null, undefined, mutationId)
      alpha = dry.getContext('2d').getImageData(50, 50, 1, 1).data[3]
      passes++
    }
    return passes
  }

  it('force 100 clears centerline in 1 pass', () => {
    expect(runDryPass(100, 1)).toBe(1)
  })

  it('force 50 clears centerline in <= 8 passes', () => {
    expect(runDryPass(50, 1)).toBeLessThanOrEqual(8)
  })

  it('force 25 clears centerline in <= 21 passes', () => {
    expect(runDryPass(25, 1)).toBeLessThanOrEqual(21)
  })

  it('force 0 removes nothing', () => {
    vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
    const dry = createMockCanvas(W, H)
    for (let i = 0; i < SZ; i++) dry._data[i * 4 + 3] = 255
    const wet = makeBuffers()
    const pts: PenPoint[] = [
      { x: 20, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
      { x: 50, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
      { x: 80, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
    ]
    applyEraseStroke(pts, { ...defaultOpts, eraseStrength: 0 }, dry.getContext('2d') as any, wet as any, W, H, false, null, 'transparent', null, undefined, 1)
    expect(dry.getContext('2d').getImageData(50, 50, 1, 1).data[3]).toBe(255)
  })

  it('per-pass removal >= force/100 at full coverage, strictly monotone across 0/25/50/75/100', () => {
    vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
    const rates: number[] = []
    for (const force of [0, 25, 50, 75, 100]) {
      const dry = createMockCanvas(W, H)
      for (let i = 0; i < SZ; i++) dry._data[i * 4 + 3] = 255
      const wet = makeBuffers()
      const pts: PenPoint[] = [
        { x: 20, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
        { x: 50, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
        { x: 80, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
      ]
      const opts = { ...defaultOpts, eraseStrength: force }
      applyEraseStroke(pts, opts, dry.getContext('2d') as any, wet as any, W, H, false, null, 'transparent', null, undefined, 1)
      const after = dry.getContext('2d').getImageData(50, 50, 1, 1).data[3]
      const rate = (255 - after) / 255
      rates.push(rate)
      if (force > 0) expect(rate).toBeGreaterThanOrEqual(force / 100 - 0.02)
    }
    // Strictly monotone: each rate < next (allow clamp at 1.0 for 75->100)
    for (let i = 1; i < rates.length; i++) {
      if (rates[i] >= 0.999 && rates[i - 1] >= 0.999) continue
      expect(rates[i]).toBeGreaterThan(rates[i - 1])
    }
  })
})

// ─── W-S: wet paint = whole-stroke removal ──────────────────

describe('W-S: wet paint = whole-stroke removal', () => {
  it.each([[50], [100]])('force %i removes the whole stroke (entry + deposit)', (force) => {
    const engine = createHarness()
    const strokeA = addPaintStroke(engine, H_LINE_A, defaultOpts, 1)
    addPaintStroke(engine, H_LINE_B, defaultOpts, 2)
    const beforeCount = engine.getStrokeCount()
    eraseGesture(engine, V_ERASE_CROSSES_A, force)
    // Entry gone
    const ids = engine.getStrokes().map((s: any) => s.mutationId)
    expect(ids).not.toContain(strokeA.mutationId)
    // Wet gone under A's ribbon
    expect(wetAlphaAt(engine, 50, 30)).toBe(0)
    expect(engine.savedWet.alpha[30 * W + 50]).toBe(0)
    // Dry canvas at centerline is background
    expect(dryAlphaAt(engine, 50, 30)).toBeLessThan(2)
    // B survives
    expect(ids).toContain(2)
  })

  it('force 0 removes nothing', () => {
    const engine = createHarness()
    const strokeA = addPaintStroke(engine, H_LINE_A, defaultOpts, 1)
    eraseGesture(engine, V_ERASE_CROSSES_A, 0)
    const ids = engine.getStrokes().map((s: any) => s.mutationId)
    expect(ids).toContain(strokeA.mutationId)
    expect(wetAlphaAt(engine, 50, 30)).toBeGreaterThan(0)
  })
})

// ─── W-P: wet buffers never pixel-lightened ─────────────────

describe('W-P: wet buffers never pixel-lightened', () => {
  it('wet/savedWet outside removed footprints byte-identical; non-crossed stroke stays wet', () => {
    const engine = createHarness()
    addPaintStroke(engine, H_LINE_A, defaultOpts, 1) // crossed
    addPaintStroke(engine, H_LINE_B, defaultOpts, 2) // NOT crossed
    const wetBefore = new Float32Array(engine.wet.alpha)
    const savedBefore = new Float32Array(engine.savedWet.alpha)
    eraseGesture(engine, V_ERASE_CROSSES_A, 50)
    // Outside A's footprint: byte-identical
    let mismatches = 0
    for (let i = 0; i < SZ; i++) {
      const x = i % W, y = (i / W) | 0
      const inA = pointToPolylineDist(x, y, H_LINE_A) <= 12
      if (inA) continue
      if (engine.wet.alpha[i] !== wetBefore[i] || engine.savedWet.alpha[i] !== savedBefore[i]) mismatches++
    }
    expect(mismatches).toBe(0)
    // B stays wet
    expect(wetAlphaAt(engine, 50, 70)).toBeGreaterThan(0)
  })
})

// ─── D-S: dry pixel cell never mutates entries ──────────────

describe('D-S: dry pixel cell never mutates entries', () => {
  it('gesture over baked paint leaves entry count and history coherent', () => {
    const engine = createHarness()
    addPaintStroke(engine, H_LINE_A, defaultOpts, 1, false) // baked
    const countBefore = engine.getStrokeCount()
    const histBefore = engine.getHistoryAvailability()
    eraseGesture(engine, V_ERASE_CROSSES_A, 50)
    // Only the erase gesture's own entry added
    expect(engine.getStrokeCount()).toBe(countBefore + 1)
    expect(engine.getHistoryAvailability().undo).toBe(histBefore.undo + 1)
    // Paint entry still present
    const ids = engine.getStrokes().map((s: any) => s.mutationId)
    expect(ids).toContain(1)
  })
})

// ─── R4: erase seed never aligns with erased mark ──────────

describe('R4: erase seed anti-alignment', () => {
  it('two different mutationIds produce different erase patterns', () => {
    vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
    const results: number[][] = []
    for (const mid of [1, 2]) {
      const dry = createMockCanvas(W, H)
      for (let i = 0; i < SZ; i++) dry._data[i * 4 + 3] = 255
      const wet = makeBuffers()
      const pts: PenPoint[] = [
        { x: 20, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
        { x: 50, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
        { x: 80, y: 50, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 },
      ]
      applyEraseStroke(pts, { ...defaultOpts, eraseStrength: 50 }, dry.getContext('2d') as any, wet as any, W, H, false, null, 'transparent', null, undefined, mid)
      results.push(Array.from(dry._data))
    }
    expect(results[0]).not.toEqual(results[1])
  })

  it('erase-shape stream differs from shape-detail stream (no alignment)', () => {
    const eraseRng = seededRng(hashMutationId(1), 'erase-shape')
    const paintRng = seededRng(hashMutationId(1), 'shape-detail')
    const base = [[0, 0], [10, 0], [10, 10], [0, 10]] as Array<[number, number]>
    const scales = [1, 1, 1, 1]
    const eraseDeform = deformNScaled(base, scales, 4, 3, eraseRng)
    const paintDeform = deformNScaled(base, scales, 4, 3, paintRng)
    expect(eraseDeform.poly).not.toEqual(paintDeform.poly)
  })

  it('erase.ts uses erase-shape stream and zero Math.random', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync(require.resolve('../brush/erase.ts'), 'utf8')
    expect(src).toContain("'erase-shape'")
    expect(src).not.toContain('Math.random()')
  })
})

// ─── Frozen knobs ──────────────────────────────────────────

describe('frozen knobs literal', () => {
  it('DEPOSIT_KEEP_TIER === 40, DEPOSIT_DENSITY_SCALE === 4500, PAPER_ADSORPTION_GAMMA === 0.5', () => {
    expect(DEPOSIT_KEEP_TIER).toBe(40)
    expect(DEPOSIT_DENSITY_SCALE).toBe(4500)
    expect(PAPER_ADSORPTION_GAMMA).toBe(0.5)
  })
})

// ─── History coherence ─────────────────────────────────────

describe('history coherence after W-S removal', () => {
  it('undo counts only still-present mutations; undo() does not resurrect removed stroke', () => {
    const engine = createHarness()
    addPaintStroke(engine, H_LINE_A, defaultOpts, 1)
    addPaintStroke(engine, H_LINE_B, defaultOpts, 2)
    eraseGesture(engine, V_ERASE_CROSSES_A, 50)
    const ids = engine.getStrokes().map((s: any) => s.mutationId)
    expect(ids).not.toContain(1)
    // undo counts: B + erase gesture = 2 (A removed)
    expect(engine.getHistoryAvailability().undo).toBe(2)
    // undo() should not crash and should not resurrect A
    const result = engine.undo()
    expect(typeof result).toBe('boolean')
    expect(engine.getStrokes().map((s: any) => s.mutationId)).not.toContain(1)
  })
})

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => createMockCanvas(1, 1) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
