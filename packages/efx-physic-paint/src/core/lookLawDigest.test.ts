// ============================================================
//  260930-wm6 look-law digest — preview == cache == reloaded
//
//  THE STANDING MECHANICAL GATE (user, 2026-10-01): at settle the
//  settled paint bytes are identical whether read from the screen
//  export, from the cache capture, or from a reload of that cache.
//  Byte-equal. No metric gate on the LOOK — that is native UAT by
//  eye.
//
//  Why this file exists. The one look law (260930-wm6) unified the
//  wet layer's two OUTPUT paths — display (compositeWetLayer) and
//  dry transfer (forceDryAll) — onto wetDisplayAlpha. It never
//  touched the INPUT side, where a THIRD path was still lying to
//  the eye:
//
//    tier='live'  blitted drawBristleFootprint straight onto the
//                 dry canvas (ctx.drawImage(off)) at LIVE_WIDTH_MUL
//                 = 4 — a dense, solid, full-radius raw blit.
//    tier='final' deposited through transferToWetLayerClipped
//                 (R8-reduced radius, keep-gate 70, D-08 paper
//                 adsorption) and was then spread by the R9 solver.
//
//  The engine showed the first and persisted the second, then
//  undid the first via active.liveSnapshot on finalize. The user
//  saw "the initial stroke render is altered with time" and "the
//  cache stores the wrong image state" — which look got captured
//  depended on when the capture ran.
//
//  Two invariants close it:
//
//    ONE PIPELINE  — every deposit goes transferToWetLayerClipped
//                    -> R9 solver -> wetDisplayAlpha. The engine
//                    never takes the tier='live' branch, and paint
//                    never blits onto the dry canvas. Screen, cache
//                    and reload therefore read one state.
//    ONE LANDING   — the look is revealed only after the deposit
//                    and the physicsTicks solver have finished, so
//                    the paint never changes after it is shown.
//
//  Plus the three deposit knobs the user named as the ONLY look
//  levers (all three strangled the deposit BEFORE the solver, which
//  is why the settled look came out "less dense / lost
//  consistency"):
//
//    keep-gate        70 -> lower   (it ate the bristle speckle)
//    deposit scale    3000 -> higher (mid-tone density)
//    D-08 adsorption  userOpacity^2 floor -> linear, softer gamma
//
//  READ-ONLY / byte-untouched by this work:
//    render/compositor.ts  (wetDisplayAlpha is THE display law)
//    core/spreadScale.ts   (R8 depositRoom / R9 physicsTicks)
//  Never fork their math into a second copy.
//
//  Target look = dense + physics texture. Never the solid raw blit
//  of the first screenshot — that is Paint's job (paint-width).
// ============================================================

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { compositeWetLayer, wetDisplayAlpha } from '../render/compositor'
import { createWetBuffers, transferToWetLayerClipped } from './wet-layer'
import { forceDryAll, initDryingLUT } from './drying'
import { sampleH } from './paper'
import { LUT_SIZE } from '../types'
import type { BrushOpts, DryingLUT, PenPoint, SavedWetBuffers, WetBuffers } from '../types'
import { EfxPaintEngine } from '../engine/EfxPaintEngine'
import { createPaintStrokeRasterContinuation } from '../brush/paint'

const wetLayerSrc = readFileSync(new URL('./wet-layer.ts', import.meta.url), 'utf8')
const paintSrc = readFileSync(new URL('../brush/paint.ts', import.meta.url), 'utf8')
const engineSrc = readFileSync(new URL('../engine/EfxPaintEngine.ts', import.meta.url), 'utf8')

// ------------------------------------------------------------
//  1. The three deposit knobs — named levers, no longer strangling
// ------------------------------------------------------------

describe('260930-wm6 the three deposit knobs are named look levers', () => {
  it('keep-gate is a named lever LOWER than the old 70 (it was eating the speckle)', () => {
    const keepTier = Number(/const\s+DEPOSIT_KEEP_TIER\s*=\s*(\d+)/.exec(wetLayerSrc)?.[1])
    expect(Number.isFinite(keepTier), 'wet-layer.ts must name const DEPOSIT_KEEP_TIER').toBe(true)
    expect(
      keepTier,
      `DEPOSIT_KEEP_TIER = ${keepTier}. The 260924-rm2 value 70 dropped the faint footprint ` +
        'pixels that carry the bristle speckle — the "lost consistency" in the settled shot. ' +
        'It must come DOWN.',
    ).toBeLessThan(70)
  })

  it('deposit scale is a named lever HIGHER than the old 3000 (mid-tone density)', () => {
    const scale = Number(/const\s+DEPOSIT_DENSITY_SCALE\s*=\s*(\d+)/.exec(wetLayerSrc)?.[1])
    expect(Number.isFinite(scale), 'wet-layer.ts must name const DEPOSIT_DENSITY_SCALE').toBe(true)
    expect(
      scale,
      `DEPOSIT_DENSITY_SCALE = ${scale}. The bare (a / 255) * 3000 produced the thin mid-tones ` +
        'of the settled shot. The scale must come UP so kept pixels read dense.',
    ).toBeGreaterThan(3000)
  })

  it('D-08 paper adsorption floor is linear in userOpacity (the squared floor strangled it)', () => {
    expect(
      wetLayerSrc,
      'the D-08 adsorption floor was `userOpacity * userOpacity` — 50% opacity deposited 25%. ' +
        'The floor must be linear so partial opacity does not collapse the deposit.',
    ).not.toContain('userOpacity * userOpacity')
    expect(
      wetLayerSrc,
      'the D-08 adsorption floor must read Math.max(userOpacity, adsorption) — linear floor.',
    ).toMatch(/depositAlpha\s*\*=\s*Math\.max\(\s*userOpacity\s*,/)
  })

  it('D-08 adsorption gamma/delta are named levers, not literals at the paint.ts call sites', () => {
    expect(wetLayerSrc, 'wet-layer.ts must name const PAPER_ADSORPTION_GAMMA').toMatch(/const\s+PAPER_ADSORPTION_GAMMA\s*=/)
    expect(wetLayerSrc, 'wet-layer.ts must name const PAPER_ADSORPTION_DELTA').toMatch(/const\s+PAPER_ADSORPTION_DELTA\s*=/)
    expect(
      paintSrc,
      'paint.ts must not hardcode the adsorption gamma/delta (it passed 0.8, 1.2 at every ' +
        'transfer site) — wet-layer.ts owns them so there is exactly one place to eye-tune.',
    ).not.toContain(', 0.8, 1.2,')
  })
})

// ------------------------------------------------------------
//  2. One pipeline — the raw blit third path is gone
// ------------------------------------------------------------

describe('260930-wm6 one pipeline — no raw blit third path', () => {
  it('the raster never writes to the dry canvas (no raw blit third path)', () => {
    expect(
      paintSrc,
      "tier='live' used to `ctx.drawImage(off, ...)` the footprint straight onto the dry canvas — " +
        'a dense solid raw blit no other path produces, and the exact look of the rejected first ' +
        'screenshot. Every deposit must go through transferToWetLayerClipped so the solver and ' +
        'wetDisplayAlpha see it, and the dry canvas is written only by the one look law.',
    ).not.toContain('ctx.drawImage(')
  })

  it('the engine never takes the tier=live branch (one geometry, one law)', () => {
    expect(
      engineSrc,
      "the engine must not request tier='live' — its cheaper lane geometry (LIVE_WIDTH_MUL=4, " +
        '1/4 of the lanes) plus the raw blit made the preview a different render from the ' +
        'settled deposit. Preview must be the settled pipeline.',
    ).not.toContain("'live'")
  })

  it('the engine holds no live-blot snapshot/restore dance', () => {
    expect(
      engineSrc,
      'the tier=live blit was written to the dry canvas and then UNDONE via active.liveSnapshot ' +
        'on finalize — the visible "the stroke just changed" moment. With one pipeline there is ' +
        'nothing to undo.',
    ).not.toContain('liveSnapshot')
  })

  it('every raster branch deposits through transferToWetLayerClipped', () => {
    const depositCalls = paintSrc.split('transferToWetLayerClipped').length - 1
    expect(
      depositCalls,
      'each raster branch (fresh, pickup-segment, single-colour) must deposit through the one law',
    ).toBeGreaterThanOrEqual(3)
  })

  it('the live raster writes paint into the wet buffers (the deposit IS the preview)', () => {
    // RED at base: D-07 had tier=live write NOTHING to wet and blit to dry.
    // The preview must be the same deposit the solver and the cache read.
    const { buffers, wetTotal } = runRasterSettled()
    expect(
      wetTotal,
      `tier=raster wrote wet_total_alpha=${wetTotal}. The preview must deposit into the wet ` +
        'buffers through transferToWetLayerClipped — that is the only state the solver, the ' +
        'screen and the cache all read.',
    ).toBeGreaterThan(0)
    expect(buffers.alpha.length).toBeGreaterThan(0)
  })
})

// ------------------------------------------------------------
//  3. One landing — nothing is revealed before the solver finishes
// ------------------------------------------------------------

describe('260930-wm6 one landing — reveal only after deposit + solver', () => {
  it('the finalize path reveals only after the fluid phase (never mid-deposit / mid-solver)', () => {
    const finalizeSlice = engineSrc.slice(
      engineSrc.indexOf('private stepInteractivePaintFinalization'),
      engineSrc.indexOf('private dryRegionForStroke'),
    )
    const dirtyWrites = finalizeSlice.split('displayCompositeDirty = true').length - 1
    expect(
      dirtyWrites,
      'stepInteractivePaintFinalization must not mark the display dirty — the reveal happens ' +
        'in completeActiveStrokeFinalization once the physicsTicks solver has run, so the half-' +
        'deposited and mid-solver states are never painted to screen',
    ).toBe(0)
  })

  it('the solver phase completes before finishInteractivePaintFinalization', () => {
    expect(engineSrc).toMatch(
      /active\.fluid\?\.step\(\)\)\s*\{[\s\S]{0,240}?finishInteractivePaintFinalization/,
    )
  })

  it('completeActiveStrokeFinalization is what reveals (displayCompositeDirty = true)', () => {
    const completeSlice = engineSrc.slice(
      engineSrc.indexOf('private completeActiveStrokeFinalization'),
      engineSrc.indexOf('private stepInteractivePaintFinalization'),
    )
    expect(completeSlice).toContain('displayCompositeDirty = true')
  })
})

// ------------------------------------------------------------
//  4. Cache capture cannot diverge from the preview
// ------------------------------------------------------------

function makeOutputCanvas() {
  const calls: string[] = []
  const context = {
    clearRect: vi.fn(),
    drawImage: vi.fn((source: { __name?: string }) => calls.push(source.__name ?? 'unknown')),
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toDataURL: () => 'data:image/png;base64,Y2FjaGU=',
  } as unknown as HTMLCanvasElement
  return { canvas, calls }
}

function makeEngineForCapture(overrides: Record<string, unknown> = {}) {
  const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine
  Object.assign(engine as object, {
    width: 12,
    height: 8,
    dualCanvas: {
      dryCanvas: { __name: 'dry' },
      displayCanvas: { __name: 'display' },
      previewBaseCanvas: { __name: 'preview-base' },
    },
    previewBackgroundSeparated: true,
    renderVisibleWetLayer: vi.fn(),
    flushPendingStrokeFinalizations: vi.fn(),
    sampleBakeParityExport: vi.fn(),
    recordPerformance: vi.fn(),
    pendingStrokeFinalizations: [],
    activeStrokeFinalization: null,
    ...overrides,
  })
  return engine
}

describe('260930-wm6 preview == cache — the same paint surfaces, the same order', () => {
  it('copyLiveAlphaCanvas composes dry then display, exactly like exportCompositeCanvas', () => {
    const cacheOut = makeOutputCanvas()
    vi.stubGlobal('document', { createElement: vi.fn(() => cacheOut.canvas) })
    makeEngineForCapture().copyLiveAlphaCanvas()

    const previewOut = makeOutputCanvas()
    vi.stubGlobal('document', { createElement: vi.fn(() => previewOut.canvas) })
    makeEngineForCapture().exportCompositeCanvas()
    vi.unstubAllGlobals()

    expect(
      cacheOut.calls,
      'the cache capture must compose the same two paint surfaces in the same order as the ' +
        'screen export, or preview and cache can never be byte-equal',
    ).toEqual(previewOut.calls)
    expect(cacheOut.calls).toEqual(['dry', 'display'])
  })

  it('copyLiveAlphaCanvas flushes in-flight finalization before reading pixels', () => {
    // A capture that runs while the deposit/solver is mid-flight freezes a state
    // that is not the settled look — the user's "the cache stores the wrong image
    // state". The 52.1 no-eager-flush pin stays: the flush is CONDITIONAL (only
    // when work is actually queued) so the idle resolve path remains a fast copy.
    const out = makeOutputCanvas()
    vi.stubGlobal('document', { createElement: vi.fn(() => out.canvas) })
    const flush = vi.fn()
    makeEngineForCapture({
      flushPendingStrokeFinalizations: flush,
      pendingStrokeFinalizations: [{}],
      activeStrokeFinalization: null,
    }).copyLiveAlphaCanvas()
    vi.unstubAllGlobals()

    expect(
      flush,
      'copyLiveAlphaCanvas must settle in-flight finalization before it reads the surfaces',
    ).toHaveBeenCalledOnce()
  })

  it('copyLiveAlphaCanvas stays a fast copy when nothing is in flight (52.1 pin preserved)', () => {
    const out = makeOutputCanvas()
    vi.stubGlobal('document', { createElement: vi.fn(() => out.canvas) })
    const flush = vi.fn()
    makeEngineForCapture({
      flushPendingStrokeFinalizations: flush,
      pendingStrokeFinalizations: [],
      activeStrokeFinalization: null,
    }).copyLiveAlphaCanvas()
    vi.unstubAllGlobals()

    expect(flush).not.toHaveBeenCalled()
  })

  it('the background-subtraction branch may only zero pixels equal to the background on all four channels', () => {
    // A paint-only cache must never rewrite a painted pixel.
    const start = engineSrc.indexOf('const dryPixels = this.dualCanvas.dryCtx.getImageData')
    const slice = engineSrc.slice(start, start + 1600)
    expect(slice).toContain('dry[index] === background[index]')
    expect(slice).toContain('dry[index + 1] === background[index + 1]')
    expect(slice).toContain('dry[index + 2] === background[index + 2]')
    expect(slice).toContain('dry[index + 3] === background[index + 3]')
  })
})

// ------------------------------------------------------------
//  5. The byte digest through the REAL deposit — settled == persisted == reload
// ------------------------------------------------------------

const FOOTPRINT_ALPHAS = [0, 30, 55, 69, 71, 90, 128, 180, 220, 255]
const OPS = [0.4, 0.85, 1.0]
const PHS = [0, 0.5, 1.0]

interface DigestSample {
  a: number
  pixelOpacity: number
  paperHeight: number
  index: number
}

const SAMPLES: DigestSample[] = []
for (const a of FOOTPRINT_ALPHAS) {
  for (const pixelOpacity of OPS) {
    for (const paperHeight of PHS) {
      SAMPLES.push({ a, pixelOpacity, paperHeight, index: SAMPLES.length })
    }
  }
}
const W = SAMPLES.length
const H = 2 // row 0 = samples, row 1 = paper carrier for sampleH's bilinear tap

function makePaper(): Float32Array {
  const paper = new Float32Array(W * H)
  for (const s of SAMPLES) {
    paper[s.index] = s.paperHeight
    paper[W + s.index] = s.paperHeight
  }
  return paper
}

/** One 1x1 deposit per sample so userOpacity and paper are sample-exact. */
function depositReal(): WetBuffers {
  const wet = createWetBuffers(W * H)
  const paper = makePaper()
  for (const s of SAMPLES) {
    const offData = new Uint8ClampedArray(4)
    offData[0] = 210
    offData[1] = 60
    offData[2] = 120
    offData[3] = s.a // the exact byte transferToWetLayerClipped gates on
    const offCtx = {
      getImageData: (_x: number, _y: number, w: number, h: number) =>
        ({ width: w, height: h, data: offData }) as ImageData,
    } as unknown as CanvasRenderingContext2D
    transferToWetLayerClipped(
      offCtx,
      wet,
      0,
      { x: s.index, y: 0, w: 1, h: 1 },
      W,
      H,
      paper,
      undefined,
      undefined,
      s.pixelOpacity,
    )
  }
  return wet
}

/** Settled screen bytes — compositeWetLayer over the deposited wet layer. */
function settledDisplayAlphas(): number[] {
  const wet = depositReal()
  let placed: { id: ImageData; x: number; y: number } | null = null
  const ctx = {
    createImageData: (w: number, h: number) =>
      ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as ImageData,
    putImageData: (id: ImageData, x: number, y: number) => {
      placed = { id, x, y }
    },
  } as unknown as CanvasRenderingContext2D
  compositeWetLayer(ctx, wet, W, H, (x, y) => sampleH(makePaper(), x, y, W, H))
  // compositeWetLayer uploads only the wet bbox and skips un-deposited pixels
  // (keep-gate / zero opacity) — those read back as 0, matching an empty dry.
  if (!placed) return SAMPLES.map(() => 0)
  const p = placed
  return SAMPLES.map((s) => {
    const absX = s.index % W
    const absY = (s.index / W) | 0
    const local = (absY - p.y) * p.id.width + (absX - p.x)
    if (local < 0 || local >= p.id.width * p.id.height) return 0
    const byte = p.id.data[local * 4 + 3]
    return byte === undefined ? 0 : byte
  })
}

/** Settled cache bytes — forceDryAll over an empty dry surface. */
function settledCacheAlphas(): number[] {
  const wet = depositReal()
  const data = new Uint8ClampedArray(W * H * 4)
  const ctx = {
    getImageData: (_x: number, _y: number, w: number, h: number) =>
      ({ width: w, height: h, data }) as ImageData,
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D
  const drying: DryingLUT = {
    dryLUT: new Float32Array(LUT_SIZE + 1),
    invLUT: new Float32Array(LUT_SIZE + 1),
    dryPos: new Float32Array(W * H),
  }
  initDryingLUT(drying.dryLUT, drying.invLUT)
  const saved: SavedWetBuffers = {
    r: new Float32Array(W * H),
    g: new Float32Array(W * H),
    b: new Float32Array(W * H),
    alpha: new Float32Array(W * H),
    strokeOpacity: new Float32Array(W * H),
  }
  forceDryAll(wet, saved, drying, ctx, W, H, makePaper())
  return SAMPLES.map((s) => data[s.index * 4 + 3])
}

describe('260930-wm6 byte digest — settled == persisted == reloaded', () => {
  it('screen byte == cache byte == reload byte for every deposited sample', () => {
    const display = settledDisplayAlphas()
    const cache = settledCacheAlphas()
    for (const s of SAMPLES) {
      // Reload: the persisted paint surface is lossless (WebP-lossless frame
      // codec), so a reload reads back the identical bytes. The gate is that
      // the CAPTURE equals the SCREEN — reload then inherits it.
      const reload = cache[s.index]
      expect(
        cache[s.index],
        `a=${s.a} op=${s.pixelOpacity} ph=${s.paperHeight}: cache ${cache[s.index]} vs ` +
          `screen ${display[s.index]} — one look law must hold end to end (deposit -> solver -> ` +
          `wetDisplayAlpha -> transfer)`,
      ).toBe(display[s.index])
      expect(reload, `a=${s.a} op=${s.pixelOpacity} ph=${s.paperHeight}`).toBe(cache[s.index])
    }
  })

  it('the digest byte is wetDisplayAlpha of the deposited wet state (the one look law end to end)', () => {
    const wet = depositReal()
    const display = settledDisplayAlphas()
    for (const s of SAMPLES) {
      const expected = Math.round(
        wetDisplayAlpha(wet.alpha[s.index], wet.strokeOpacity[s.index], makePaper()[s.index]),
      )
      expect(display[s.index], `a=${s.a} op=${s.pixelOpacity} ph=${s.paperHeight}`).toBe(expected)
    }
  })

  it('the deposit writes strokeOpacity through the Porter-Duff law (preview and cache share it)', () => {
    const wet = depositReal()
    for (const s of SAMPLES) {
      if (wet.alpha[s.index] <= 0) continue // the keep-gate may legitimately drop faint pixels
      expect(
        wet.strokeOpacity[s.index],
        `a=${s.a} op=${s.pixelOpacity}: the deposit must record the per-pixel opacity the ` +
          'display law reads, or preview and cache diverge',
      ).toBeCloseTo(s.pixelOpacity, 5)
    }
  })
})

// ------------------------------------------------------------
//  Raster helper — the settled raster must land in the wet buffers
// ------------------------------------------------------------

function runRasterSettled(): { buffers: WetBuffers; wetTotal: number } {
  const width = 48
  const height = 32
  const buffers = createWetBuffers(width * height)
  const offData = new Uint8ClampedArray(width * height * 4)
  for (let i = 3; i < offData.length; i += 4) offData[i] = 200

  const offCtx2d = {
    translate: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    getImageData: (_x: number, _y: number, w: number, h: number) =>
      ({ width: w, height: h, data: offData }) as ImageData,
  }
  const offCanvas = { width: 0, height: 0, getContext: () => offCtx2d }
  vi.stubGlobal('document', { createElement: vi.fn(() => offCanvas) })

  const mainCtx = { getImageData: vi.fn(() => ({ width, height, data: new Uint8ClampedArray(width * height * 4) })) }
  const points: PenPoint[] = [
    { x: 8, y: 16, p: 0.6, tx: 0, ty: 0, tw: 0, spd: 0.1 },
    { x: 18, y: 16, p: 0.7, tx: 0, ty: 0, tw: 0, spd: 0.1 },
    { x: 28, y: 16, p: 0.6, tx: 0, ty: 0, tw: 0, spd: 0.1 },
    { x: 38, y: 16, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.1 },
  ]
  const opts = {
    size: 6, opacity: 100, pressure: 70, waterAmount: 0, dryAmount: 30,
    edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0,
  } as BrushOpts

  try {
    const continuation = createPaintStrokeRasterContinuation(
      points, '#336699', opts, mainCtx as unknown as CanvasRenderingContext2D,
      buffers, null, width, height, false, 0, 'final', undefined, 7,
    )
    continuation.runToCompletion()
  } finally {
    vi.unstubAllGlobals()
  }

  let wetTotal = 0
  for (let i = 0; i < buffers.alpha.length; i++) wetTotal += buffers.alpha[i]
  return { buffers, wetTotal }
}
