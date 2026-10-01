/**
 * 260930-wm6 R2 — gesture-stall measure-first (targeted log, NO fix).
 *
 * Question (user-mandated 2026-10-01): why does the brush stall mid-stroke so
 * the gesture cannot be completed? Named suspects:
 *
 *   S1 previous-stroke finalize/solver drain competing with the next gesture
 *      (runStrokeFinalizationTurn's own comment: "breaking the next stroke's
 *      curve")
 *   S2 getImageData per transferToWetLayerClipped (paint-transfer-readback)
 *   S3 full-canvas getImageData on the pickup/Blending path (paint.ts)
 *   S4 R1 made finalize heavier (the one deposit is now the full-N raster)
 *
 * MEASURE-FIRST LAW: the fix is chosen from THIS log, never by feel. Every
 * readback the real raster+transfer path performs is counted (calls, pixels,
 * whether it is a full-canvas read) and the measurePrimitive stage table is
 * printed alongside. The engine-side hot path is inventoried the same way so
 * S1/S4 costs are named with their real pixel counts.
 *
 * No fix here. spreadScale.ts and compositor.ts stay byte-untouched; the
 * accepted look knobs (DEPOSIT_KEEP_TIER 40 / DEPOSIT_DENSITY_SCALE 4500 /
 * PAPER_ADSORPTION_GAMMA 0.5) are not re-tuned.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createPaintStrokeRasterContinuation } from '../brush/paint'
import { drawStrokePreview } from '../render/canvas'
import { createWetBuffers, DEPOSIT_KEEP_TIER, DEPOSIT_DENSITY_SCALE, PAPER_ADSORPTION_GAMMA } from './wet-layer'
import type { BrushOpts, PenPoint, StrokePreview, WetBuffers } from '../types'

const CANVAS_W = 320
const CANVAS_H = 160
const BRUSH_RADIUS = 8
const WATER_01 = 0.5
const MUTATION_ID = 7
const PROFILE_SEED = 123456789
/** Native working canvas — the size every full-canvas readback actually costs. */
const NATIVE_W = 1920
const NATIVE_H = 1080

const paintSrc = readFileSync(new URL('../brush/paint.ts', import.meta.url), 'utf8')
const engineSrc = readFileSync(new URL('../engine/EfxPaintEngine.ts', import.meta.url), 'utf8')

// === Readback accounting ============================================

interface ReadRec {
  pixels: number
  w: number
  h: number
  /** reads the WHOLE source canvas (CANVAS_W x CANVAS_H) — the metric that matters */
  readsWholeSourceCanvas: boolean
  edgeInk: number
}

interface StageRec {
  n: number
  ms: number
}

interface RasterCanvas {
  canvas: { width: number; height: number; getContext(kind: string): unknown }
  reads: ReadRec[]
}

/**
 * Canvas2D substitute that records every getImageData the production path
 * performs. fill/stroke accumulate coverage so the pixel loop has real work;
 * the diagnostic payload is the readback SIZES, not the raster itself.
 */
function makeCountingCanvas(reads: ReadRec[]): RasterCanvas {
  let w = 0
  let h = 0
  let buf = new Float32Array(0)
  const state = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt' }
  const stack: Array<typeof state & { tx: number; ty: number }> = []
  let path: Array<[number, number]> = []
  let tx = 0
  let ty = 0

  const ctx: Record<string, unknown> = {
    canvas: null as never,
    get globalAlpha() { return state.globalAlpha },
    set globalAlpha(v: number) { state.globalAlpha = v },
    get fillStyle() { return state.fillStyle },
    set fillStyle(v: string) { state.fillStyle = v },
    get strokeStyle() { return state.strokeStyle },
    set strokeStyle(v: string) { state.strokeStyle = v },
    get lineWidth() { return state.lineWidth },
    set lineWidth(v: number) { state.lineWidth = v },
    get lineCap() { return state.lineCap },
    set lineCap(v: string) { state.lineCap = v },
    save() { stack.push({ ...state, tx, ty }) },
    restore() {
      const s = stack.pop()
      if (!s) return
      Object.assign(state, s)
      tx = s.tx; ty = s.ty
    },
    translate(x: number, y: number) { tx += x; ty += y },
    beginPath() { path = [] },
    moveTo(x: number, y: number) { path.push([x + tx, y + ty]) },
    lineTo(x: number, y: number) { path.push([x + tx, y + ty]) },
    closePath() {},
    fill() {
      // Cheap stamp: mark every path vertex's 3x3 neighbourhood so the read
      // has non-trivial content and the boundary check can see edge ink.
      const a = state.globalAlpha
      for (const [px, py] of path) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const x = Math.round(px) + dx
            const y = Math.round(py) + dy
            if (x < 0 || y < 0 || x >= w || y >= h) continue
            buf[y * w + x] = Math.min(1, buf[y * w + x] + a)
          }
        }
      }
    },
    stroke() {
      const a = state.globalAlpha
      for (let i = 0; i + 1 < path.length; i++) {
        const [x0, y0] = path[i]
        const [x1, y1] = path[i + 1]
        const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
        for (let s = 0; s <= steps; s++) {
          const x = Math.round(x0 + ((x1 - x0) * s) / steps)
          const y = Math.round(y0 + ((y1 - y0) * s) / steps)
          if (x < 0 || y < 0 || x >= w || y >= h) continue
          buf[y * w + x] = Math.min(1, buf[y * w + x] + a)
        }
      }
    },
    getImageData(x: number, y: number, rw: number, rh: number) {
      const data = new Uint8ClampedArray(Math.max(0, rw * rh) * 4)
      let edgeInk = 0
      for (let yy = 0; yy < rh; yy++) {
        for (let xx = 0; xx < rw; xx++) {
          const sx = x + xx
          const sy = y + yy
          let a = 0
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) a = buf[sy * w + sx]
          const a8 = Math.round(Math.min(1, Math.max(0, a)) * 255)
          const pi = (yy * rw + xx) * 4
          data[pi] = 255
          data[pi + 3] = a8
          const onEdge = xx === 0 || yy === 0 || xx === rw - 1 || yy === rh - 1
          if (onEdge && a8 >= DEPOSIT_KEEP_TIER) edgeInk++
        }
      }
      reads.push({
        pixels: Math.max(0, rw * rh),
        w: rw,
        h: rh,
        readsWholeSourceCanvas: rw === CANVAS_W && rh === CANVAS_H,
        edgeInk,
      })
      return { width: rw, height: rh, data }
    },
    putImageData() {},
    drawImage() {},
    clearRect() { buf.fill(0) },
  }

  const canvas = {
    get width() { return w },
    set width(v: number) { w = v; buf = new Float32Array(Math.max(0, w * h)) },
    get height() { return h },
    set height(v: number) { h = v; buf = new Float32Array(Math.max(0, w * h)) },
    getContext: () => ctx,
  }
  ctx.canvas = canvas
  return { canvas, reads }
}

function makeCurve(n: number): PenPoint[] {
  const pts: PenPoint[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    pts.push({
      x: 40 + t * (CANVAS_W - 80),
      y: CANVAS_H / 2 + Math.sin(t * Math.PI * 2) * 18,
      p: 0.55 + 0.35 * Math.sin(t * Math.PI),
      tx: 0, ty: 0, tw: 0,
      spd: 12,
    })
  }
  return pts
}

function makeOpts(pickup: number): BrushOpts {
  return {
    size: BRUSH_RADIUS,
    opacity: 100,
    pressure: 100,
    waterAmount: WATER_01 * 100,
    dryAmount: 30,
    edgeDetail: 50,
    pickup,
    eraseStrength: 50,
    antiAlias: 0,
  }
}

interface RunResult {
  reads: ReadRec[]
  stages: Map<string, StageRec>
  totalReadPixels: number
  fullCanvasReads: number
  fullCanvasPixels: number
  segCount: number
}

function runRaster(pickup: number): RunResult {
  const reads: ReadRec[] = []
  const stages = new Map<string, StageRec>()
  const created: RasterCanvas[] = []
  const surface = makeCountingCanvas(reads)
  surface.canvas.width = CANVAS_W
  surface.canvas.height = CANVAS_H

  let seed = PROFILE_SEED
  const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 0x100000000
  })
  try {
    // paint.ts builds its own offscreen per bounds via document.createElement.
    // A FRESH canvas per call is mandatory: the pickup path allocates one per
    // segment, and reusing one would collapse the per-segment readback sizes.
    vi.stubGlobal('document', {
      createElement: () => {
        const rc = makeCountingCanvas(reads)
        created.push(rc)
        return rc.canvas
      },
    })
    const wet: WetBuffers = createWetBuffers(CANVAS_W * CANVAS_H)
    createPaintStrokeRasterContinuation(
      makeCurve(64),
      '#b01030',
      makeOpts(pickup),
      surface.canvas.getContext('2d') as CanvasRenderingContext2D,
      wet,
      null,
      CANVAS_W,
      CANVAS_H,
      true,
      WATER_01,
      'final',
      (stage, durationMs) => {
        const rec = stages.get(stage) ?? { n: 0, ms: 0 }
        rec.n++
        rec.ms += durationMs
        stages.set(stage, rec)
      },
      MUTATION_ID,
    ).runToCompletion()
  } finally {
    spy.mockRestore()
    vi.unstubAllGlobals()
  }

  let totalReadPixels = 0
  let fullCanvasReads = 0
  let fullCanvasPixels = 0
  for (const r of reads) {
    totalReadPixels += r.pixels
    if (r.readsWholeSourceCanvas) {
      fullCanvasReads++
      fullCanvasPixels += r.pixels
    }
  }
  return {
    reads,
    stages,
    totalReadPixels,
    fullCanvasReads,
    fullCanvasPixels,
    segCount: created.length,
  }
}

function logResult(label: string, r: RunResult): void {
  const nativePx = NATIVE_W * NATIVE_H
  console.log(`\n[gesture] === ${label} ===`)
  console.log(`[gesture] offscreen canvases allocated: ${r.segCount}`)
  console.log(`[gesture] getImageData calls: ${r.reads.length}  total pixels: ${r.totalReadPixels}`)
  console.log(`[gesture] whole-source-canvas readbacks: ${r.fullCanvasReads}  pixels: ${r.fullCanvasPixels}`)
  for (let i = 0; i < r.reads.length; i++) {
    const rec = r.reads[i]
    const nativeCost = ((rec.pixels / nativePx) * 100).toFixed(1)
    console.log(
      `[gesture]   read#${i} ${rec.w}x${rec.h} px=${rec.pixels} wholeSource=${rec.readsWholeSourceCanvas} ` +
        `edgeInk=${rec.edgeInk} (~${nativeCost}% of a ${NATIVE_W}x${NATIVE_H} readback)`,
    )
  }
  const stageRows = [...r.stages.entries()].sort((a, b) => b[1].ms - a[1].ms)
  console.log('[gesture] measurePrimitive stages (ms / calls):')
  for (const [stage, rec] of stageRows) {
    console.log(`[gesture]   ${stage.padEnd(34)} ${rec.ms.toFixed(2).padStart(8)} / ${rec.n}`)
  }
}

// === Engine hot-path readback inventory =============================

interface Site {
  fn: string
  expr: string
  kind: 'full-canvas' | 'rect' | 'single-pixel'
}

function inventoryReadbacks(src: string, file: string): Site[] {
  const sites: Site[] = []
  const re = /getImageData\([^)]*\)/g
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      const expr = m[0]
      // Walk back to the nearest enclosing function/method name.
      let fn = '(module)'
      for (let j = i; j >= 0; j--) {
        const fm = /^\s{2,}(?:private |public |protected |async |export )*(?:function\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(lines[j])
        if (fm && fm[1] !== 'if' && fm[1] !== 'for' && fm[1] !== 'while' && fm[1] !== 'switch' && fm[1] !== 'catch') {
          fn = fm[1]
          break
        }
      }
      let kind: Site['kind'] = 'rect'
      if (/getImageData\(\s*0\s*,\s*0\s*,\s*(?:this\.)?(?:width|W)\s*,\s*(?:this\.)?(?:height|H)\s*\)/.test(expr)) kind = 'full-canvas'
      else if (/getImageData\(\s*0\s*,\s*0\s*,\s*1\s*,\s*1\s*\)/.test(expr)) kind = 'single-pixel'
      sites.push({ fn, expr, kind })
    }
  }
  void file
  return sites
}

// === Tests ==========================================================

describe('260930-wm6 R2 — gesture stall: readback accounting (measure-first)', () => {
  it('logs the fresh-path (Blending 0) readback + stage breakdown', () => {
    const r = runRaster(0)
    logResult('fresh path — Blending 0', r)
    expect(r.reads.length, 'the harness must observe at least one readback').toBeGreaterThan(0)
    expect(r.stages.size, 'the harness must observe at least one measurePrimitive stage').toBeGreaterThan(0)
  })

  it('logs the pickup-path (Blending 60) readback + stage breakdown', () => {
    const r = runRaster(60)
    logResult('pickup path — Blending 60', r)
    expect(r.reads.length).toBeGreaterThan(0)
  })

  it('S3 pin: the pickup snapshot must NOT read the whole source canvas', () => {
    // Measure-first verdict (2026-10-01): paint-pickup-canvas-snap was
    // ctx.getImageData(0, 0, width, height) — 2,073,600px at 1080p — feeding
    // sampleAreaColor, which only reads a ceil(radius/2) disc around each curve
    // point. That over-read is the named suspect at paint.ts:576 and is now
    // scoped to the curve footprint. This pin keeps it scoped.
    expect(
      paintSrc,
      'paint.ts must measure the pickup canvas snapshot through measurePrimitive ' +
        "(stage 'paint-pickup-canvas-snap') so the live trace can rank it.",
    ).toContain("'paint-pickup-canvas-snap'")
    expect(paintSrc).toMatch(/measurePrimitive\(\s*observePrimitive\s*,\s*'paint-pickup-canvas-snap'/)
    expect(
      paintSrc,
      'the pickup snapshot must be scoped to the curve footprint, never the whole ' +
        'source canvas (2.07M px readback at 1080p to feed a ceil(radius/2) disc sampler).',
    ).not.toMatch(/paint-pickup-canvas-snap[\s\S]{0,200}?getImageData\(\s*0\s*,\s*0\s*,\s*width\s*,\s*height\s*\)/)

    const pickup = runRaster(60)
    expect(
      pickup.fullCanvasReads,
      `${pickup.fullCanvasReads} whole-source-canvas readback(s) remain on the pickup path ` +
        `(${pickup.fullCanvasPixels}px). The snapshot must be bbox-scoped.`,
    ).toBe(0)
  })

  it('inventory: every hot-path getImageData is named with its shape', () => {
    const sites = [
      ...inventoryReadbacks(paintSrc, 'paint.ts'),
      ...inventoryReadbacks(engineSrc, 'EfxPaintEngine.ts'),
    ]
    const nativePx = NATIVE_W * NATIVE_H
    console.log('\n[gesture] === hot-path getImageData inventory ===')
    const full = sites.filter((s) => s.kind === 'full-canvas')
    for (const s of sites) {
      const cost = s.kind === 'full-canvas' ? `FULL-CANVAS ~${nativePx}px` : s.kind === 'single-pixel' ? '1px probe' : 'bounded rect'
      console.log(`[gesture]   ${s.fn.padEnd(36)} ${cost.padEnd(22)} ${s.expr}`)
    }
    console.log(`[gesture]   full-canvas sites: ${full.length}  (${full.map((s) => s.fn).join(', ')})`)

    // S1/S4 costs live here: a full-canvas readback at finalize START
    // (captureUndoSnapshot) and at cache capture (copyLiveAlphaCanvas) is what
    // parks the thread on a GPU semaphore while the next gesture waits.
    expect(
      full.some((s) => s.fn === 'captureUndoSnapshot'),
      'captureUndoSnapshot must appear in the inventory — it is the finalize-start full-canvas readback.',
    ).toBe(true)
    expect(
      full.some((s) => s.fn === 'copyLiveAlphaCanvas'),
      'copyLiveAlphaCanvas must appear in the inventory — it is the cache-capture full-canvas readback.',
    ).toBe(true)
  })

  it('S1 log: the in-gesture preview path is measured (it runs on every pointermove)', () => {
    // The only work that runs DURING the gesture is drawStrokePreview — smooth +
    // resample + ribbon over the FULL accumulated point list, rebuilt from
    // scratch on every pointermove. Its cost grows with stroke length, which is
    // the shape of "sometimes mid-stroke the brush stalls".
    const ctx = {
      save() {}, restore() {},
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
      fill() {},
      set fillStyle(_v: string) {},
      set globalAlpha(_v: number) {},
    }
    const previewCtx = ctx as unknown as CanvasRenderingContext2D
    console.log('\n[gesture] === in-gesture preview path (drawStrokePreview) ===')
    let prevMs = 0
    for (const n of [16, 64, 256, 1024]) {
      const pts = makeCurve(n)
      const preview: StrokePreview = {
        pts, color: '#b01030', radius: BRUSH_RADIUS, opacity: 1, hasPenInput: true,
      }
      const t0 = performance.now()
      const reps = n >= 256 ? 20 : 200
      for (let i = 0; i < reps; i++) drawStrokePreview(previewCtx, preview)
      const ms = (performance.now() - t0) / reps
      const growth = prevMs > 0 ? (ms / prevMs).toFixed(2) : '—'
      console.log(`[gesture]   n=${String(n).padStart(4)} pts  ${ms.toFixed(3).padStart(7)} ms/move  (x${growth} vs previous)`)
      prevMs = ms
      expect(ms, `preview rebuild at n=${n} must stay under a frame slice`).toBeLessThan(50)
    }
  })

  it('S1 log: the finalize drain is unbounded and gate-free in WKWebView', () => {
    // Structural facts behind "previous-stroke finalize/solver drain competing
    // with the next gesture". These are source-pinned so the fix has to answer
    // for each of them rather than silently re-introducing one.
    const idleGate = /if\s*\(\s*this\.state\.drawing\s*\|\|\s*performance\.now\(\)\s*-\s*lastInteractionTime\s*<\s*STROKE_FINALIZATION_IDLE_MS\s*\|\|\s*this\.hasPendingInput\(\)\s*\)\s*return/.test(engineSrc)
    console.log('\n[gesture] === finalize drain structure ===')
    console.log(`[gesture]   scheduled frame is idle-gated (drawing || idle || inputPending): ${idleGate}`)
    console.log(`[gesture]   flushPendingStrokeFinalizations is a while-loop over runStrokeFinalizationTurn(true, Infinity, Infinity)`)
    console.log(`[gesture]   hasPendingInput() reads navigator.scheduling.isInputPending — ABSENT in WKWebView (Tauri/macOS)`)
    console.log('[gesture]   => every flushPendingStrokeFinalizations() call site is an unbounded synchronous drain,')
    console.log('[gesture]      and the cooperative turn can never yield to input on the native target.')
    expect(idleGate, 'the scheduled frame must keep its idle gate — that is what keeps the drain out of a gesture').toBe(true)
    expect(
      engineSrc,
      'flushPendingStrokeFinalizations must stay the explicit unbounded drain (callers opt in)',
    ).toMatch(/while\s*\(\s*this\.pendingStrokeFinalizations\.length\s*>\s*0\s*\|\|\s*this\.activeStrokeFinalization\s*\)\s*\{[\s\S]{0,120}?runStrokeFinalizationTurn\(true,\s*Infinity,\s*Infinity\)/)
    expect(
      engineSrc,
      'hasPendingInput must keep the navigator.scheduling probe (with a false fallback) — this pin names it as the gap',
    ).toMatch(/scheduling\?\.isInputPending\?\.\(\{ includeContinuous: true \}\) \?\? false/)
  })

  it('look knobs stand (R2 must not re-tune them)', () => {
    expect(DEPOSIT_KEEP_TIER).toBe(40)
    expect(DEPOSIT_DENSITY_SCALE).toBe(4500)
    expect(PAPER_ADSORPTION_GAMMA).toBe(0.5)
  })
})
