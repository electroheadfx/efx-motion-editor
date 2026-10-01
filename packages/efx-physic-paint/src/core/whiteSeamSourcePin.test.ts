/**
 * 260930-wm6 R2 — white seam / block-trace source pin (measure-first, NO fix).
 *
 * Question (user-mandated 2026-10-01): which path writes the occasional
 * horizontal or vertical white cuts through the paint, and the occasional
 * full block outline? Suspects, in the order the user ranked them:
 *
 *   (a) bbox clipping — the pickup/Blending path rasterizes in segments, each
 *       into its own segBounds offscreen canvas with 30% overlap
 *       (paint.ts:581-601). "That rectangle matches the trace of a block."
 *       Ink drawn past the offscreen edge is HARD-CUT by the canvas.
 *   (b) copyLiveAlphaCanvas torn extraction — already pinned
 *       (copyLiveExtractionTornEdge.test.ts, "ONE pin, NO fix"). Its numbers
 *       decide this cell; this file does not re-derive them.
 *   (c) paper tile seams — loadPaperTexture tiles via drawImage at
 *       tileWidth = img.width * tileScale. A non-seamless source steps at
 *       every tile boundary, and a FRACTIONAL tileWidth resamples (and
 *       clamps instead of wraps) even a seamless source. sampleH then turns
 *       that height step into a deposit/display cut.
 *   (d) solver region vs dry region (found while reading, not on the user's
 *       list) — forceDryAll dries point-bbox ± brushRenderRadius, but
 *       createLocalFluidPhysicsContinuation solves a strictly larger rect
 *       (± margin). Paint the solver moved into the margin ring is never
 *       force-dried by that stroke.
 *
 * VERDICT is read off the numbers logged below. Do NOT write a directed fix
 * before this pin names the writer. spreadScale.ts and compositor.ts stay
 * byte-untouched; the accepted look knobs are not re-tuned.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createPaintStrokeRasterContinuation } from '../brush/paint'
import { createWetBuffers, DEPOSIT_KEEP_TIER, DEPOSIT_DENSITY_SCALE, PAPER_ADSORPTION_GAMMA } from './wet-layer'
import { conditionHeightMap } from './paper'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

const paintSrc = readFileSync(new URL('../brush/paint.ts', import.meta.url), 'utf8')
const engineSrc = readFileSync(new URL('../engine/EfxPaintEngine.ts', import.meta.url), 'utf8')
const paperSrc = readFileSync(new URL('./paper.ts', import.meta.url), 'utf8')

const CANVAS_W = 320
const CANVAS_H = 160
const BRUSH_RADIUS = 8
const WATER_01 = 0.5
const MUTATION_ID = 11
const PROFILE_SEED = 987654321

// ============================================================
//  Axis-aligned cut detector — the visible symptom
// ============================================================

interface CutReport {
  /** a horizontal white line through ink: empty px with ink above AND below */
  horizontalCutPx: number
  /** a vertical white line through ink: empty px with ink left AND right */
  verticalCutPx: number
  longestHorizontalRun: number
  longestVerticalRun: number
}

const INK = 32
const EMPTY = 4

function detectCuts(alpha: ArrayLike<number>, w: number, h: number): CutReport {
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : alpha[y * w + x]
  let horizontalCutPx = 0
  let verticalCutPx = 0
  let longestHorizontalRun = 0
  let longestVerticalRun = 0

  for (let y = 1; y < h - 1; y++) {
    let run = 0
    for (let x = 1; x < w - 1; x++) {
      const self = at(x, y)
      const isCut = self < EMPTY && at(x, y - 1) >= INK && at(x, y + 1) >= INK
      if (isCut) {
        horizontalCutPx++
        run++
        if (run > longestHorizontalRun) longestHorizontalRun = run
      } else {
        run = 0
      }
    }
  }
  for (let x = 1; x < w - 1; x++) {
    let run = 0
    for (let y = 1; y < h - 1; y++) {
      const self = at(x, y)
      const isCut = self < EMPTY && at(x - 1, y) >= INK && at(x + 1, y) >= INK
      if (isCut) {
        verticalCutPx++
        run++
        if (run > longestVerticalRun) longestVerticalRun = run
      } else {
        run = 0
      }
    }
  }
  return { horizontalCutPx, verticalCutPx, longestHorizontalRun, longestVerticalRun }
}

// ============================================================
//  (a) offscreen clip — ink that reaches the readback border
// ============================================================

interface ClipRec {
  w: number
  h: number
  /** hull vertices the real drawBristleFootprint wrote, in OFFSCREEN space */
  vertexCount: number
  /** hull vertices outside [0,w) x [0,h) — the canvas hard-clips these */
  clippedVertices: number
}

/**
 * FAITHFUL clip probe. drawBristleFootprint writes one convex capsule hull per
 * step and its moveTo/lineTo vertices ARE the drawn extent (they already sit at
 * q +/- r on the capsule boundary). So the honest (a) question is simply: does
 * any hull vertex land outside the offscreen rect? A stub `fill()` that stamps
 * discs would under-draw and falsely exonerate the bbox — that is why this
 * records the vertices themselves.
 */
function makeClipCanvas(reads: ClipRec[]) {
  let w = 0
  let h = 0
  let buf = new Float32Array(0)
  const verts: Array<[number, number]> = []
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
    moveTo(x: number, y: number) { const p: [number, number] = [x + tx, y + ty]; path.push(p); verts.push(p) },
    lineTo(x: number, y: number) { const p: [number, number] = [x + tx, y + ty]; path.push(p); verts.push(p) },
    closePath() {},
    fill() {
      const a = state.globalAlpha
      for (const [px, py] of path) {
        // Stamp a disc of radius ~lineWidth so the footprint has real extent
        // and CAN reach the border if the bbox is too tight.
        const r = Math.max(1, state.lineWidth * 0.5)
        for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
          for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
            if (dx * dx + dy * dy > r * r) continue
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
      for (let yy = 0; yy < rh; yy++) {
        for (let xx = 0; xx < rw; xx++) {
          const sx = x + xx
          const sy = y + yy
          let a = 0
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) a = buf[sy * w + sx]
          const pi = (yy * rw + xx) * 4
          data[pi] = 255
          data[pi + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255)
        }
      }
      let clipped = 0
      for (const [vx, vy] of verts) {
        if (vx < 0 || vy < 0 || vx >= w || vy >= h) clipped++
      }
      reads.push({ w, h, vertexCount: verts.length, clippedVertices: clipped })
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
  return canvas
}

function makeCurve(n: number): PenPoint[] {
  const pts: PenPoint[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    pts.push({
      x: 30 + t * (CANVAS_W - 60),
      y: CANVAS_H / 2 + Math.sin(t * Math.PI * 3) * 22,
      p: 0.5 + 0.5 * Math.sin(t * Math.PI),
      tx: 0, ty: 0, tw: 0,
      spd: 18,
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

function runClipProbe(label: string, pickup: number): { reads: ClipRec[]; segCount: number; cuts: CutReport } {
  const reads: ClipRec[] = []
  const wet: WetBuffers = createWetBuffers(CANVAS_W * CANVAS_H)
  let segCount = 0
  const surface = makeClipCanvas([])

  let seed = PROFILE_SEED
  const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 0x100000000
  })
  try {
    vi.stubGlobal('document', {
      createElement: () => {
        segCount++
        return makeClipCanvas(reads)
      },
    })
    createPaintStrokeRasterContinuation(
      makeCurve(72),
      '#b01030',
      makeOpts(pickup),
      surface.getContext('2d') as CanvasRenderingContext2D,
      wet,
      null,
      CANVAS_W,
      CANVAS_H,
      true,
      WATER_01,
      'final',
      undefined,
      MUTATION_ID,
    ).runToCompletion()
  } finally {
    spy.mockRestore()
    vi.unstubAllGlobals()
  }

  // The WET field is what the eye sees after transfer+display; cut-detect on it.
  const wetAlpha = new Uint8Array(CANVAS_W * CANVAS_H)
  for (let i = 0; i < wetAlpha.length; i++) {
    wetAlpha[i] = Math.min(255, Math.round((wet.alpha[i] / DEPOSIT_DENSITY_SCALE) * 255))
  }
  void label
  return { reads, segCount, cuts: detectCuts(wetAlpha, CANVAS_W, CANVAS_H) }
}

// ============================================================
//  (c) paper tile seams — the real tiling loop, isolated
// ============================================================

function sampleBilinear(src: Float32Array, sw: number, sh: number, u: number, v: number): number {
  const ix = Math.max(0, Math.min(sw - 2, Math.floor(u)))
  const iy = Math.max(0, Math.min(sh - 2, Math.floor(v)))
  const fx = Math.max(0, Math.min(1, u - ix))
  const fy = Math.max(0, Math.min(1, v - iy))
  const a = src[iy * sw + ix]
  const b = src[iy * sw + ix + 1]
  const c = src[(iy + 1) * sw + ix]
  const d = src[(iy + 1) * sw + ix + 1]
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}

/**
 * Mirrors loadPaperTexture's MIRRORED tiling loop (260930-wm6 R2 fix): each
 * cell is drawn with scale(+-1, +-1) per parity, so the two sides of a shared
 * boundary read the same source pixels. `mirror: false` reproduces the old
 * plain-repeat loop (each cell's own drawImage resample CLAMPED at that cell's
 * edge) — kept so the pin can still demonstrate what wrote the seam.
 */
function tileLikeLoadPaperTexture(
  src: Float32Array, srcW: number, srcH: number,
  canvasW: number, canvasH: number, tileScale: number,
  mirror = true,
): Float32Array {
  const tileW = Math.max(1, srcW * tileScale)
  const tileH = Math.max(1, srcH * tileScale)
  const out = new Float32Array(canvasW * canvasH)
  for (let py = 0; py < canvasH; py++) {
    for (let px = 0; px < canvasW; px++) {
      const txi = Math.floor(px / tileW)
      const tyi = Math.floor(py / tileH)
      const localX = px - txi * tileW
      const localY = py - tyi * tileH
      let u = ((localX + 0.5) / tileW) * srcW - 0.5
      let v = ((localY + 0.5) / tileH) * srcH - 0.5
      if (mirror) {
        if (txi % 2 === 1) u = (srcW - 1) - u
        if (tyi % 2 === 1) v = (srcH - 1) - v
      }
      out[py * canvasW + px] = sampleBilinear(src, srcW, srcH, u, v)
    }
  }
  return out
}

/** Max |Δh| across vertical tile boundaries (x = k*tileW) vs interior columns. */
function tileSeamStep(height: Float32Array, w: number, h: number, tileW: number): { boundary: number; interior: number } {
  let boundary = 0
  let interior = 0
  const cols: number[] = []
  for (let k = 1; k * tileW < w - 1; k++) cols.push(Math.round(k * tileW))
  const interiorCols: number[] = []
  for (let k = 0; k * tileW < w - 1; k++) {
    interiorCols.push(Math.round(k * tileW + tileW * 0.5))
  }
  const stepAt = (x: number): number => {
    let m = 0
    for (let y = 0; y < h; y++) {
      const d = Math.abs(height[y * w + x] - height[y * w + x - 1])
      if (d > m) m = d
    }
    return m
  }
  for (const x of cols) boundary = Math.max(boundary, stepAt(x))
  for (const x of interiorCols) if (x > 0 && x < w) interior = Math.max(interior, stepAt(x))
  return { boundary, interior }
}

function makeSeamlessTile(sw: number, sh: number): Float32Array {
  // Wrap-continuous: value depends only on (x mod sw, y mod sh) phase, and the
  // left/right edges are sampled from the same phase so they meet.
  const src = new Float32Array(sw * sh)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      src[y * sw + x] = 0.5 + 0.25 * Math.sin((2 * Math.PI * x) / sw) * Math.cos((2 * Math.PI * y) / sh)
    }
  }
  return src
}

function makeNonSeamlessTile(sw: number, sh: number): Float32Array {
  // Classic photographed-paper tile: bright left edge, dark right edge.
  const src = new Float32Array(sw * sh)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      src[y * sw + x] = x / (sw - 1)
    }
  }
  return src
}

// ============================================================
//  (d) solver region vs dry region
// ============================================================

/**
 * The engine's two rects, computed from its own formulas (EfxPaintEngine
 * stepInteractivePaintFinalization + dryRegionForStroke). Kept as literal
 * mirrors with a source pin below so drift is caught.
 */
function regionOverflow(brushR: number, waterAmount: number, spreadStrength: number): { margin: number; dryHalf: number; solverHalf: number } {
  const waterFrac = waterAmount / 100
  const waterCurve = waterFrac * waterFrac
  // spreadCurveFor is spreadScale.ts's law (READ-ONLY). Mirrored value for
  // Spread 65 — the R9-locked default. The source pin asserts the formula.
  const spreadCurve = Math.pow(Math.max(0, Math.min(1, spreadStrength / 100)), 0.65)
  const margin = Math.ceil(2 + waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4)
  return { margin, dryHalf: brushR, solverHalf: brushR + margin }
}

// ============================================================
//  Tests
// ============================================================

describe('260930-wm6 R2 — (a) offscreen/bbox clip: hull vertices past the offscreen edge', () => {
  for (const pickup of [0, 60]) {
    it(`pickup=${pickup} — no hull vertex may land outside its offscreen (that is the block outline)`, () => {
      const r = runClipProbe(`pickup ${pickup}`, pickup)
      let totalClipped = 0
      let totalVerts = 0
      console.log(`\n[seam] === (a) offscreen clip — pickup=${pickup} ===`)
      console.log(`[seam] offscreen canvases: ${r.segCount}  readbacks: ${r.reads.length}`)
      for (let i = 0; i < r.reads.length; i++) {
        const rec = r.reads[i]
        totalClipped += rec.clippedVertices
        totalVerts += rec.vertexCount
        console.log(`[seam]   read#${i} ${rec.w}x${rec.h} verts=${rec.vertexCount} clippedVerts=${rec.clippedVertices}`)
      }
      console.log(`[seam] cut detector on the wet field: ${JSON.stringify(r.cuts)}`)
      console.log(
        totalClipped === 0
          ? `[seam] VERDICT (a) pickup=${pickup}: CLEAN — all ${totalVerts} hull vertices inside the offscreen, the bbox does not clip.`
          : `[seam] VERDICT (a) pickup=${pickup}: GUILTY — ${totalClipped}/${totalVerts} hull vertices clipped by the offscreen edge.`,
      )
      expect(
        totalClipped,
        `${totalClipped} of ${totalVerts} hull vertices land outside their offscreen rect. The canvas ` +
          'hard-clips those — a straight rectangular cut with no AA, the exact "full block outline" / ' +
          'block trace. curveBounds(seg, radius + variance*5) is too tight for what drawBristleFootprint paints.',
      ).toBe(0)
    })
  }
})

describe('260930-wm6 R2 — (c) paper tile seams', () => {
  const SW = 32
  const SH = 32
  const CW = 256
  const CH = 64

  it('non-seamless source (photographed paper) with the OLD plain repeat: demonstrates the writer', () => {
    // This is the measurement that NAMED (c) as the seam writer. Kept as the
    // record of the diagnosis: plain-repeat tiling of a photographed paper_*.jpg
    // steps hard at every tile boundary.
    const src = makeNonSeamlessTile(SW, SH)
    const raw = tileLikeLoadPaperTexture(src, SW, SH, CW, CH, 1, /* mirror */ false)
    const height = conditionHeightMap(raw)
    const { boundary, interior } = tileSeamStep(height, CW, CH, SW * 1)
    console.log(`\n[seam] === (c) paper tiles ===`)
    console.log(`[seam] DIAGNOSIS — plain-repeat, non-seamless src, tileScale=1: boundaryStep=${boundary.toFixed(4)} interiorStep=${interior.toFixed(4)}`)
    console.log(`[seam]   -> that ${boundary.toFixed(2)} step IS the horizontal+vertical cut grid / one tile's block outline.`)
    expect(boundary, 'the plain-repeat loop must show the seam — otherwise this pin is not measuring the defect').toBeGreaterThan(0.1)
  })

  it('non-seamless source with MIRRORED tiling: boundary step must be gone', () => {
    const src = makeNonSeamlessTile(SW, SH)
    const raw = tileLikeLoadPaperTexture(src, SW, SH, CW, CH, 1, /* mirror */ true)
    const height = conditionHeightMap(raw)
    const { boundary, interior } = tileSeamStep(height, CW, CH, SW * 1)
    console.log(`[seam] FIX — mirrored tiling, non-seamless src, tileScale=1: boundaryStep=${boundary.toFixed(4)} interiorStep=${interior.toFixed(4)}`)
    console.log(
      boundary <= interior + 1e-6
        ? '[seam] VERDICT (c) mirrored/non-seamless: CLEAN'
        : `[seam] VERDICT (c) mirrored/non-seamless: STILL GUILTY — ${boundary.toFixed(4)} > ${interior.toFixed(4)}`,
    )
    expect(boundary, `mirrored tiling still steps ${boundary.toFixed(4)} at a tile boundary`).toBeLessThanOrEqual(interior + 1e-6)
  })

  it('FRACTIONAL tileScale with MIRRORED tiling: boundary step must be gone', () => {
    // paperTextureScale = canvasWidth / projectCanvasWidth (PhysicsPaintStudio),
    // so tileW = img.width * (working/project) is fractional whenever the
    // working canvas is not an integer multiple of the project size.
    const fracScale = 2048 / 1920 // ≈ 1.0666 — a real HD working scale
    const src = makeSeamlessTile(SW, SH)
    const raw = tileLikeLoadPaperTexture(src, SW, SH, CW, CH, fracScale, /* mirror */ true)
    const height = conditionHeightMap(raw)
    const tileW = SW * fracScale
    const { boundary, interior } = tileSeamStep(height, CW, CH, tileW)
    console.log(`[seam] FIX — mirrored tiling, seamless src, tileScale=${fracScale.toFixed(4)} (tileW=${tileW.toFixed(2)}): boundaryStep=${boundary.toFixed(4)} interiorStep=${interior.toFixed(4)}`)
    console.log(
      boundary <= interior + 1e-6
        ? '[seam] VERDICT (c) mirrored/fractional: CLEAN'
        : `[seam] VERDICT (c) mirrored/fractional: STILL GUILTY — ${boundary.toFixed(4)} > ${interior.toFixed(4)}`,
    )
    expect(boundary).toBeLessThanOrEqual(interior + 1e-6)
  })

  it('loadPaperTexture mirror-tiles (source pin — the model above must match production)', () => {
    expect(
      paperSrc,
      'loadPaperTexture must MIRROR alternate tile cells (scale(-1|1, -1|1) per parity). Plain repeat ' +
        'of a photographed paper_*.jpg steps 0.80 at every boundary — the cut grid and block outline.',
    ).toMatch(/flipX\s*=\s*ix\s*%\s*2\s*===\s*1/)
    expect(paperSrc).toMatch(/flipY\s*=\s*iy\s*%\s*2\s*===\s*1/)
    expect(paperSrc).toMatch(/tx\.scale\(\s*flipX\s*\?\s*-1\s*:\s*1\s*,\s*flipY\s*\?\s*-1\s*:\s*1\s*\)/)
  })
})

describe('260930-wm6 R2 — (d) solver region overflows the force-dry region', () => {
  it('the margin band is non-empty: solver paint can live outside dryRegionForStroke', () => {
    const brushR = 16
    const { margin, dryHalf, solverHalf } = regionOverflow(brushR, 50, 65)
    console.log('\n[seam] === (d) solver vs dry region ===')
    console.log(`[seam] brushR=${brushR} water=50 spread=65 → dryHalf=${dryHalf} solverHalf=${solverHalf} overflowBand=${margin}px per side`)
    console.log(
      margin > 0
        ? `[seam] VERDICT (d): GUILTY-CANDIDATE — ${margin}px per side is solved but never force-dried by this stroke.`
        : '[seam] VERDICT (d): CLEAN',
    )
    console.log('[seam] note: an orphaned wet ring shows as a HALO (extra paint), not a white cut. ' +
      'A white cut needs the ring to be dropped without being composited, or the dry region to clip a transfer.')
    // Source pin: the two formulas must still differ by the margin.
    expect(
      engineSrc,
      'the solver margin formula must stay in stepInteractivePaintFinalization',
    ).toMatch(/margin\s*=\s*Math\.ceil\(\s*2\s*\+\s*waterCurve\s*\*\s*brushR\s*\*\s*0\.6\s*\+\s*spreadCurve\s*\*\s*brushR\s*\*\s*0\.4\s*\)/)
    expect(
      engineSrc,
      'dryRegionForStroke must stay point-bbox ± brushRenderRadius (no margin) for this pin to mean anything',
    ).toMatch(/x0:\s*Math\.max\(0,\s*Math\.floor\(sx0\s*-\s*brushR\)\)/)
    expect(margin, 'the overflow band is the defect this pin measures').toBeGreaterThan(0)
  })
})

describe('260930-wm6 R2 — look knobs stand (do not re-tune)', () => {
  it('KEEP_TIER 40 / DENSITY_SCALE 4500 / GAMMA 0.5 are accepted', () => {
    expect(DEPOSIT_KEEP_TIER).toBe(40)
    expect(DEPOSIT_DENSITY_SCALE).toBe(4500)
    expect(PAPER_ADSORPTION_GAMMA).toBe(0.5)
    expect(paintSrc, 'R2 must not fork a second deposit law').not.toContain('/ 800')
  })
})
