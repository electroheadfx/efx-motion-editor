/**
 * 260930-wm6 R3b — white seams as TRUE HOLES (measure-first, NO fix).
 *
 * STEP 1 verdict (user observation, 2026-10-01): the residual lines are TRUE
 * WHITE — background shows through, alpha ~ 0 — and the UAT stroke ran at 100%
 * brush opacity. The paper path is therefore EXONERATED by physics: at
 * pixelOpacity >= 0.90 wetDisplayAlpha takes the fast path and never applies
 * paperMod, and even on the slow path conditionHeightMap clamps h to [0.10,
 * 0.90] so paperMod >= 0.775 — paper can lighten at most ~22% and can NEVER
 * punch a hole. paper.ts stays byte-untouched.
 *
 * STEP 2-ALT: re-open the two structural hole writers, with production
 * geometry. Both sit downstream of an already-accepted fact: getBakedCanvas()
 * (the monitor surface) is previewBaseCanvas + dryCanvas and carries NO wet
 * overlay — so any wet pixel that is never transferred to dry is an invisible
 * TRUE HOLE on the monitor, regardless of what the wet overlay would have
 * shown during the gesture.
 *
 *   (a) footprint clipped by its segBounds offscreen. R2 recorded 0 clipped
 *       hull verts at edgeDetail 50 / radius 8. This re-runs at the production
 *       extremes the UAT hits (edgeDetail 100 -> edgeMul 2, large radius)
 *       because deformSampleSides depth 4 is what pushes the drawn outline.
 *   (d) wet that never lands in dry:
 *         (d1) forceDryAll's sa==0 path — when wetDisplayAlpha rounds to 0
 *              (at 100% opacity: wet.alpha < 5, since DENSITY_NORM=3000 gives
 *              sa = round(alpha/10)/255) the pixel is zeroed without a
 *              transfer. NOTE: those bytes render 0 on the wet overlay TOO,
 *              so destroying them is the one look law being honest — a hole
 *              is only real when a VISIBLE byte (sa > 0) fails to land.
 *         (d2) the bbox clamp — forceDryAll at finalize is clamped to
 *              dryRegionForStroke = point-bbox +/- brushRenderRadius (= size/2),
 *              but the solver solves +/- (brushR + margin). The margin ring
 *              holds VISIBLE paint that never transfers, and the monitor drops it.
 *
 * THE INVARIANT: no VISIBLE wet pixel may vanish without landing in dry.
 * (d2) is the writer. spreadScale.ts / compositor.ts / wet-layer.ts stay
 * byte-untouched; the accepted look knobs are not re-tuned.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createPaintStrokeRasterContinuation } from '../brush/paint'
import { createWetBuffers, createSavedWetBuffers, DEPOSIT_KEEP_TIER, DEPOSIT_DENSITY_SCALE, PAPER_ADSORPTION_GAMMA } from './wet-layer'
import { forceDryAll } from './drying'
import { wetDisplayAlpha } from '../render/compositor'
import type { BrushOpts, PenPoint, WetBuffers } from '../types'

const paintSrc = readFileSync(new URL('../brush/paint.ts', import.meta.url), 'utf8')
const engineSrc = readFileSync(new URL('../engine/EfxPaintEngine.ts', import.meta.url), 'utf8')
const dryingSrc = readFileSync(new URL('./drying.ts', import.meta.url), 'utf8')
const compositorSrc = readFileSync(new URL('../render/compositor.ts', import.meta.url), 'utf8')

const PROFILE_SEED = 246813579

// ============================================================
//  Axis-aligned cut detector — the visible symptom
// ============================================================

const INK = 32
const EMPTY = 4

interface CutReport {
  horizontalCutPx: number
  verticalCutPx: number
  longestHorizontalRun: number
  longestVerticalRun: number
}

function detectCuts(alpha: ArrayLike<number>, w: number, h: number): CutReport {
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : alpha[y * w + x]
  let horizontalCutPx = 0
  let verticalCutPx = 0
  let longestHorizontalRun = 0
  let longestVerticalRun = 0
  for (let y = 1; y < h - 1; y++) {
    let run = 0
    for (let x = 1; x < w - 1; x++) {
      const isCut = at(x, y) < EMPTY && at(x, y - 1) >= INK && at(x, y + 1) >= INK
      if (isCut) { horizontalCutPx++; run++; if (run > longestHorizontalRun) longestHorizontalRun = run }
      else run = 0
    }
  }
  for (let x = 1; x < w - 1; x++) {
    let run = 0
    for (let y = 1; y < h - 1; y++) {
      const isCut = at(x, y) < EMPTY && at(x - 1, y) >= INK && at(x + 1, y) >= INK
      if (isCut) { verticalCutPx++; run++; if (run > longestVerticalRun) longestVerticalRun = run }
      else run = 0
    }
  }
  return { horizontalCutPx, verticalCutPx, longestHorizontalRun, longestVerticalRun }
}

// ============================================================
//  A counting canvas that records real hull vertices (a probe)
// ============================================================

interface ClipRec { w: number; h: number; vertexCount: number; clippedVertices: number }

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
    restore() { const s = stack.pop(); if (!s) return; Object.assign(state, s); tx = s.tx; ty = s.ty },
    translate(x: number, y: number) { tx += x; ty += y },
    beginPath() { path = [] },
    moveTo(x: number, y: number) { const p: [number, number] = [x + tx, y + ty]; path.push(p); verts.push(p) },
    lineTo(x: number, y: number) { const p: [number, number] = [x + tx, y + ty]; path.push(p); verts.push(p) },
    closePath() {},
    fill() {
      const a = state.globalAlpha
      for (const [px, py] of path) {
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
          const sx = x + xx, sy = y + yy
          let a = 0
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) a = buf[sy * w + sx]
          const pi = (yy * rw + xx) * 4
          data[pi] = 255
          data[pi + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255)
        }
      }
      let clipped = 0
      for (const [vx, vy] of verts) if (vx < 0 || vy < 0 || vx >= w || vy >= h) clipped++
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

function makeOpts(radius: number, edgeDetail: number): BrushOpts {
  // createPaintStrokeRasterContinuation reads opts.size AS the radius
  // (paint.ts:512 `const radius = opts.size || 24`) — not as a diameter.
  return {
    size: radius,
    opacity: 100,
    pressure: 100,
    waterAmount: 50,
    dryAmount: 30,
    edgeDetail,
    pickup: 0,
    eraseStrength: 50,
    antiAlias: 0,
  }
}

// ============================================================
//  A dry canvas recorder for forceDryAll (putImageData capture)
// ============================================================

interface DryRec {
  w: number
  h: number
  /** alpha bytes forceDryAll wrote back (0 where it never wrote) */
  written: Uint8ClampedArray
  /** every wet pixel it zeroed */
  cleared: Array<{ x: number; y: number; wetAlphaBefore: number; sa: number; transferred: boolean }>
}

function makeDryCanvas(rec: DryRec, W: number, H: number) {
  const ctx: Record<string, unknown> = {
    canvas: null as never,
    getImageData(x: number, y: number, rw: number, rh: number) {
      rec.w = W; rec.h = H
      return { width: rw, height: rh, data: new Uint8ClampedArray(rw * rh * 4) }
    },
    putImageData(id: { width: number; height: number; data: Uint8ClampedArray }, dx = 0, dy = 0) {
      rec.w = W; rec.h = H
      // Honour the (dx, dy) origin — forceDryAll writes back ONLY its clamp
      // rect, so a flat copy would smear that rect over the whole frame and
      // fake "the ring got written".
      for (let yy = 0; yy < id.height; yy++) {
        for (let xx = 0; xx < id.width; xx++) {
          const dstX = dx + xx, dstY = dy + yy
          if (dstX < 0 || dstY < 0 || dstX >= W || dstY >= H) continue
          const s = (yy * id.width + xx) * 4
          const d = (dstY * W + dstX) * 4
          rec.written[d] = id.data[s]
          rec.written[d + 1] = id.data[s + 1]
          rec.written[d + 2] = id.data[s + 2]
          rec.written[d + 3] = id.data[s + 3]
        }
      }
    },
  }
  const canvas = {
    get width() { return W },
    set width(_v: number) {},
    get height() { return H },
    set height(_v: number) {},
    getContext: () => ctx,
  }
  ctx.canvas = canvas
  return canvas
}

// ============================================================
//  Tests
// ============================================================

describe('260930-wm6 R3b — (a) footprint vs segBounds at production extremes', () => {
  // MUST run with the curve INTERIOR: curveBounds clamps to the canvas, so a
  // curve near the edge collapses the offscreen to the full frame and a
  // "clipped vert" then means the WORLD edge, not the offscreen block. Only an
  // interior offscreen makes a clipped vert mean "the block outline".
  const IW = 1024, IH = 1024
  for (const [radius, edgeDetail] of [[8, 100], [32, 100], [64, 100]] as const) {
    it(`radius=${radius} edgeDetail=${edgeDetail} (edgeMul=${edgeDetail / 50}) — hull verts must stay inside the offscreen`, () => {
      const reads: ClipRec[] = []
      const wet: WetBuffers = createWetBuffers(IW * IH)
      let segCount = 0
      const surface = makeClipCanvas([])

      // Interior curve: keep it inside the padding-safe zone so the offscreen
      // is strictly smaller than the canvas and a clip is a real block edge.
      const edgeMul = edgeDetail / 50
      const variance = (1.5 + Math.sqrt(radius) * 0.9) * edgeMul
      const pad = (radius + variance * 5) * 2 + 10
      const cx = IW / 2, cy = IH / 2
      const extent = Math.min(180, IW / 2 - pad - 8)
      const pts: PenPoint[] = []
      for (let i = 0; i < 48; i++) {
        const t = i / 47
        pts.push({
          x: cx + (t - 0.5) * extent,
          y: cy + Math.sin(t * Math.PI * 2) * (extent * 0.2),
          p: 0.5 + 0.5 * Math.sin(t * Math.PI),
          tx: 0, ty: 0, tw: 0, spd: 40,
        })
      }

      let seed = PROFILE_SEED
      const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
        seed = (1664525 * seed + 1013904223) >>> 0
        return seed / 0x100000000
      })
      try {
        vi.stubGlobal('document', {
          createElement: () => { segCount++; return makeClipCanvas(reads) },
        })
        createPaintStrokeRasterContinuation(
          pts, '#b01030', makeOpts(radius, edgeDetail),
          surface.getContext('2d') as CanvasRenderingContext2D,
          wet, null, IW, IH, true, 0.5, 'final', undefined, 31,
        ).runToCompletion()
      } finally {
        spy.mockRestore()
        vi.unstubAllGlobals()
      }

      let totalClipped = 0
      let totalVerts = 0
      console.log(`\n[hole] === (a) production geometry — radius=${radius} edgeDetail=${edgeDetail} pad=${pad.toFixed(1)} ===`)
      console.log(`[hole] offscreen canvases: ${segCount}  readbacks: ${reads.length}`)
      for (let i = 0; i < reads.length; i++) {
        const r = reads[i]
        const interior = r.w < IW || r.h < IH
        totalClipped += r.clippedVertices
        totalVerts += r.vertexCount
        console.log(`[hole]   read#${i} ${r.w}x${r.h} interiorOffscreen=${interior} verts=${r.vertexCount} clippedVerts=${r.clippedVertices}`)
      }
      const interior = reads.some((r) => r.w < IW || r.h < IH)
      console.log(
        totalClipped === 0
          ? `[hole] VERDICT (a) radius=${radius}: CLEAN — all ${totalVerts} hull verts inside; curveBounds padding covers deformNScaled depth 4.`
          : `[hole] VERDICT (a) radius=${radius}: GUILTY — ${totalClipped}/${totalVerts} hull verts clipped${interior ? ' by the OFFSCREEN edge (the block outline)' : ' by the CANVAS edge (world boundary — not a seam)'}.`,
      )
      expect(interior, 'the probe must produce an INTERIOR offscreen or it is measuring the world edge, not the block').toBe(true)
      expect(
        totalClipped,
        `${totalClipped}/${totalVerts} hull verts land outside their offscreen at radius=${radius} edgeDetail=${edgeDetail}. ` +
          'The canvas hard-clips those — a straight rectangular cut with no AA, the "full block outline".',
      ).toBe(0)
    })
  }
})

describe('260930-wm6 R3b — (d1) clear-without-transfer is WYSIWYG-correct (sa==0 was never visible)', () => {
  it('a wet pixel may only be destroyed without landing in dry if wetDisplayAlpha already said it is invisible', () => {
    // THE INVARIANT every hole writer violates: no VISIBLE wet pixel may vanish
    // without landing in dry. DENSITY_NORM = 3000 -> at pixelOpacity 1,
    // sa = round(alpha/10)/255, so alpha 1..4 rounds to 0. forceDryAll does
    // zero those without a transfer — but wetDisplayAlpha ALSO renders them as
    // 0 on the wet overlay, so the display never showed them. Clearing them is
    // the one look law being honest, NOT a hole.
    const W = 16, H = 4
    const wet: WetBuffers = createWetBuffers(W * H)
    const alphas = [1, 2, 3, 4, 5, 10, 100, 706]
    for (let i = 0; i < alphas.length; i++) {
      wet.alpha[i] = alphas[i]
      wet.r[i] = 200; wet.g[i] = 30; wet.b[i] = 60
      wet.strokeOpacity[i] = 1.0
    }
    const rec: DryRec = { w: 0, h: 0, written: new Uint8ClampedArray(W * H * 4), cleared: [] }
    const dryCtx = makeDryCanvas(rec, W, H).getContext('2d') as unknown as CanvasRenderingContext2D

    console.log('\n[hole] === (d1) clear-without-transfer vs the one look law ===')
    for (const a of alphas) {
      const sa = wetDisplayAlpha(a, 1.0, 0.5)
      console.log(`[hole]   wet.alpha=${String(a).padStart(4)}  wetDisplayAlpha=${String(sa).padStart(3)}  ${sa === 0 ? '<- display renders 0 too' : ''}`)
    }

    forceDryAll(wet, createSavedWetBuffers(W * H), { dryPos: new Float32Array(W * H) } as never, dryCtx, W, H, null)

    let destroyedVisible = 0
    let destroyedInvisible = 0
    for (let i = 0; i < alphas.length; i++) {
      const sa = wetDisplayAlpha(alphas[i], 1.0, 0.5)
      const dryA = rec.written[i * 4 + 3]
      const vanished = wet.alpha[i] === 0 && dryA === 0
      if (!vanished) {
        console.log(`[hole]   alpha=${String(alphas[i]).padStart(4)} -> dryA=${dryA}  transferred`)
        continue
      }
      if (sa > 0) { destroyedVisible++; console.log(`[hole]   alpha=${String(alphas[i]).padStart(4)} -> VISIBLE(sa=${sa}) DESTROYED  <-- TRUE HOLE`) }
      else { destroyedInvisible++; console.log(`[hole]   alpha=${String(alphas[i]).padStart(4)} -> invisible(sa=0) destroyed  = display law, not a hole`) }
    }
    console.log(`[hole] VERDICT (d1): ${destroyedVisible > 0 ? 'GUILTY' : 'CLEAN'} — ${destroyedVisible} visible pixel(s) destroyed, ${destroyedInvisible} invisible pixel(s) destroyed (correct).`)
    expect(
      destroyedVisible,
      'A VISIBLE wet pixel (wetDisplayAlpha > 0) must never be destroyed without landing in dry — that is the true hole.',
    ).toBe(0)
    expect(destroyedInvisible, 'the probe must exercise the destroy path to mean anything').toBeGreaterThan(0)
  })
})

describe('260930-wm6 R3b — (d2) bbox clamp drops the solver margin ring on the dry-only monitor', () => {
  it('wet outside dryRegionForStroke survives forceDryAll but is invisible in getBakedCanvas', () => {
    // dryRegionForStroke = point-bbox +/- brushRenderRadius (EfxPaintEngine
    // :2728-2731). The solver solves +/- (brushR + margin) (:2680-2684). The
    // margin ring is never transferred, and getBakedCanvas (:1644-1646) is
    // previewBase + dry with NO wet overlay — so the ring is a TRUE HOLE whose
    // boundary is the dryRegionForStroke RECTANGLE: "full block outline".
    const W = 64, H = 64
    const wet: WetBuffers = createWetBuffers(W * H)
    // dryRegionForStroke = point-bbox +/- brushRenderRadius. Model that rect
    // directly, then place solved paint in a ring JUST OUTSIDE it (what the
    // solver writes into the +/- margin band EfxPaintEngine:2680-2684 solves
    // but :2728-2731's dryRegionForStroke excludes).
    const bbox = { x0: 16, y0: 16, x1: 47, y1: 47 }
    const ringPaint: Array<[number, number]> = []
    const place = (x: number, y: number, inBBox: boolean) => {
      wet.alpha[y * W + x] = 706
      wet.r[y * W + x] = 200; wet.g[y * W + x] = 30; wet.b[y * W + x] = 60
      wet.strokeOpacity[y * W + x] = 1.0
      if (!inBBox) ringPaint.push([x, y])
    }
    // Core (inside the bbox) — a filled band the force-dry SHOULD transfer.
    for (let y = 20; y <= 43; y++) for (let x = 20; x <= 43; x++) place(x, y, true)
    // Margin ring (outside the bbox) — the solver's overflow band.
    for (let y = 20; y <= 43; y++) {
      for (let x of [12, 13, 14, 15, 48, 49, 50, 51]) place(x, y, false)
    }
    for (let x = 20; x <= 43; x++) {
      for (let y of [12, 13, 14, 15, 48, 49, 50, 51]) place(x, y, false)
    }

    const rec: DryRec = { w: 0, h: 0, written: new Uint8ClampedArray(W * H * 4), cleared: [] }
    const dryCtx = makeDryCanvas(rec, W, H).getContext('2d') as unknown as CanvasRenderingContext2D
    forceDryAll(wet, createSavedWetBuffers(W * H), { dryPos: new Float32Array(W * H) } as never, dryCtx, W, H, null, undefined, 'paint-final-force-dry', bbox)

    let ringSurvived = 0
    let ringTransferred = 0
    let visibleDestroyed = 0
    for (const [x, y] of ringPaint) {
      const i = y * W + x
      if (wet.alpha[i] > 0) ringSurvived++
      const dryA = rec.written[i * 4 + 3]
      if (dryA > 0) ringTransferred++
      const sa = wetDisplayAlpha(706, 1.0, 0.5)
      if (sa > 0 && dryA === 0) visibleDestroyed++
    }
    console.log('\n[hole] === (d2) bbox clamp vs the solver margin ring ===')
    console.log(`[hole] dryRegionForStroke bbox = ${JSON.stringify(bbox)}`)
    console.log(`[hole] margin-ring wet pixels placed: ${ringPaint.length}  (each renders sa=${wetDisplayAlpha(706, 1.0, 0.5)} — VISIBLE)`)
    console.log(`[hole] ring pixels still wet after forceDryAll: ${ringSurvived} (never transferred)`)
    console.log(`[hole] ring pixels written to dry: ${ringTransferred}`)
    console.log(`[hole] ring pixels VISIBLE but absent from dry: ${visibleDestroyed}`)

    // The MONITOR surface is previewBase + dry — wet never enters it. Build it.
    const monitor = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) monitor[i] = rec.written[i * 4 + 3]
    const cuts = detectCuts(monitor, W, H)
    console.log(`[hole] detectCuts on the dry-only monitor: ${JSON.stringify(cuts)}`)
    console.log(
      visibleDestroyed > 0
        ? `[hole] VERDICT (d2): GUILTY — ${visibleDestroyed} VISIBLE solved pixel(s) live outside dryRegionForStroke, never land in dry, and getBakedCanvas (previewBase + dry) has no wet overlay to show them. The bbox rectangle is the "full block outline"; its four sides are the horizontal/vertical white cuts.`
        : '[hole] VERDICT (d2): CLEAN',
    )

    expect(
      visibleDestroyed,
      `${visibleDestroyed} VISIBLE solved pixel(s) (wetDisplayAlpha > 0) sit outside dryRegionForStroke and never land in dry. ` +
        'getBakedCanvas (previewBase + dry) carries no wet overlay, so they render as TRUE HOLES along the bbox rectangle — ' +
        'the "full block outline" and the horizontal/vertical white cuts.',
    ).toBe(0)
  })

  it('source pins: the two rects really do differ by the margin, and the monitor drops wet', () => {
    expect(
      engineSrc,
      'dryRegionForStroke must stay point-bbox +/- brushRenderRadius (the tight rect) for this pin to mean anything',
    ).toMatch(/x0:\s*Math\.max\(0,\s*Math\.floor\(sx0\s*-\s*brushR\)\)/)
    expect(
      engineSrc,
      'the solver must solve a STRICTLY larger rect (+ margin) — that overflow is the untransferred ring',
    ).toMatch(/x0:\s*Math\.max\(0,\s*Math\.floor\(sx0\s*-\s*brushR\s*-\s*margin\)\)/)
    expect(
      engineSrc,
      'getBakedCanvas must stay previewBase + dry with no wet overlay — that is what turns untransferred wet into a hole',
    ).toMatch(/drawImage\(this\.dualCanvas\.previewBaseCanvas[\s\S]{0,120}?drawImage\(this\.dualCanvas\.dryCanvas/)
    expect(
      engineSrc,
      'getBakedCanvas must NOT draw the display/wet overlay',
    ).not.toMatch(/getBakedCanvas\(\)[\s\S]{0,400}?drawImage\(this\.dualCanvas\.displayCanvas/)
  })
})

describe('260930-wm6 R3b — the paper path is exonerated (STEP 1 physics)', () => {
  it('wetDisplayAlpha can lighten at most ~22% and can never reach 0 via paperMod', () => {
    console.log('\n[hole] === STEP 1 physics — why paper cannot write these lines ===')
    let minRatio = 1
    let reachedZero = false
    for (const pixelOpacity of [0.3, 0.5, 0.7, 0.85]) {
      for (const densityAlpha of [1, 5, 50, 706, 4500, 45000]) {
        for (const h of [0.1, 0.5, 0.9]) {
          const a = wetDisplayAlpha(densityAlpha, pixelOpacity, h)
          const aNoPaper = wetDisplayAlpha(densityAlpha, pixelOpacity, 0)
          if (aNoPaper > 0) minRatio = Math.min(minRatio, a / aNoPaper)
          if (a === 0 && aNoPaper > 0) reachedZero = true
        }
      }
    }
    console.log(`[hole]   min(paperMod applied) = ${minRatio.toFixed(4)}  (theoretical floor 0.775 = 1 - 0.25*0.90)`)
    console.log(`[hole]   paper ever forced alpha to 0 while the no-paper path stayed lit: ${reachedZero}`)
    console.log('[hole] VERDICT: paper can only LIGHTEN, never punch a hole -> TRUE WHITE lines are NOT paper.')

    // And at 100% the fast path never even sees paper.
    expect(compositorSrc, 'the fast path must skip paperMod entirely').toMatch(/if \(pixelOpacity >= 0\.90\) \{\s*return Math\.min\(255, Math\.round\(density \* 300 \* pixelOpacity\)\)/)
    expect(minRatio, 'paperMod must never drop below the 0.775 floor').toBeGreaterThanOrEqual(0.775 - 1e-6)
    expect(reachedZero, 'paper modulation must never punch a true hole').toBe(false)
  })

  it('at 100% opacity the fast path is taken and paper is out of the loop', () => {
    const a = wetDisplayAlpha(706, 1.0, 0.9)
    const b = wetDisplayAlpha(706, 1.0, 0.1)
    console.log(`[hole]   wetDisplayAlpha(706, 1.0, 0.9) = ${a}   wetDisplayAlpha(706, 1.0, 0.1) = ${b}  (equal => paper inert)`)
    expect(a, 'at pixelOpacity 1.0 the paper height must not change the output byte').toBe(b)
  })
})

describe('260930-wm6 R3b — look knobs stand (do not re-tune)', () => {
  it('KEEP_TIER 40 / DENSITY_SCALE 4500 / GAMMA 0.5 are accepted', () => {
    expect(DEPOSIT_KEEP_TIER).toBe(40)
    expect(DEPOSIT_DENSITY_SCALE).toBe(4500)
    expect(PAPER_ADSORPTION_GAMMA).toBe(0.5)
    expect(paintSrc, 'no second deposit law').not.toContain('/ 800')
    expect(dryingSrc, 'forceDryAll must stay on the one look law').toMatch(/wetDisplayAlpha\(/)
    expect(compositorSrc, 'compositor.ts stays the display law').toMatch(/export function wetDisplayAlpha/)
  })
})
