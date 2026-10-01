// ============================================================
//  261001-cache3 — settled-pixel 3-surface probe
//  MEASUREMENT ONLY. No fix lives in this file.
//
//  Q: the cache reads "a bit less dense colour/texture" than the
//  first fresh paint. Where does the density go?
//
//  One settled stroke pixel is read off THREE surfaces:
//    S1  getBakedCanvas()        previewBase + dry   (monitor)
//    S2  copyLiveAlphaCanvas()   the cache CAPTURE
//    S3  cache bytes -> decode -> drawImage          (the RELOAD)
//
//  and off the SCREEN composite (paper + reloaded cache), because a
//  premultiply wash can HIDE in the cache readback (saturated RGB
//  clamps at 255) and still show on screen.
//
//  Signature law — read the deltas, do not guess:
//    RGB brighter at SAME alpha -> premultiply wash
//        straight bytes drawn as-if premultiplied, then un-
//        premultiplied on read = RGB * 255 / alpha = brighter.
//        WKWebView does exactly this to a premultiplyAlpha:'none'
//        bitmap (52.1 washed-out regression, physicPaintStore 1444).
//    alpha lower                -> capture/transfer loss
//    all three equal, screen lighter -> double paper composite
//
//  The mock canvas implements the REAL 2D alpha contract
//  (premultiplied backing store, straight getImageData/putImageData)
//  so the wash appears as numbers, not folklore.
//
//  READ-ONLY here: wetDisplayAlpha, the one look law, the three look
//  knobs (40 / 4500 / 0.5). forceDryAll is used unmodified.
// ============================================================

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { EfxPaintEngine } from './EfxPaintEngine'
import { forceDryAll, initDryingLUT } from '../core/drying'
import { wetDisplayAlpha } from '../render/compositor'
import { createWetBuffers } from '../core/wet-layer'
import { LUT_SIZE } from '../types'
import type { DryingLUT, SavedWetBuffers, WetBuffers } from '../types'

const W = 32
const H = 24

/** The settled-stroke probe pixel. */
const PX = 12
const PY = 10
/** A second probe pixel in the same stroke: the OPAQUE core. */
const OX = 14
const OY = 10

const PAPER: readonly [number, number, number, number] = [240, 230, 220, 255]
/** Muted magenta — all channels < 255 so an un-premultiply wash cannot hide behind a clamp. */
const INK: readonly [number, number, number, number] = [240, 15, 200, 255]

/** Grain pixel: keep-gate floor deposit (706 -> display byte 71 on the fast path). */
const THIN_WET_ALPHA = 706
/** Core pixel: saturating deposit (3000 -> display byte 255). */
const THICK_WET_ALPHA = 3000
const OP = 1.0

// One-look-law reference bytes (fast path, op >= 0.90 ignores paper).
const REF_THIN = Math.round(wetDisplayAlpha(THIN_WET_ALPHA, OP, 0.5))
const REF_THICK = Math.round(wetDisplayAlpha(THICK_WET_ALPHA, OP, 0.5))

// ---------------------------------------------------------------------------
// Canvas mock with the REAL 2D alpha contract.
//   backing store  = PREMULTIPLIED  (every browser)
//   putImageData   = takes STRAIGHT, premultiplies on store
//   getImageData   = un-premultiplies on read, returns STRAIGHT
//   drawImage      = source-over in premultiplied space
// That contract is what turns a premultiply mismatch into a visible
// number: straight bytes fed to a premultiplied drawImage come back
// from getImageData divided by alpha.
// ---------------------------------------------------------------------------

type Vec4 = readonly [number, number, number, number]

function premul(r: number, g: number, b: number, a: number): Vec4 {
  if (a <= 0) return [0, 0, 0, 0]
  const f = a / 255
  return [Math.round(r * f), Math.round(g * f), Math.round(b * f), a]
}

function unpremul(r: number, g: number, b: number, a: number): Vec4 {
  if (a <= 0) return [0, 0, 0, 0]
  const f = 255 / a
  return [
    Math.min(255, Math.round(r * f)),
    Math.min(255, Math.round(g * f)),
    Math.min(255, Math.round(b * f)),
    a,
  ]
}

interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

/**
 * A drawImage source. `__drawnAsPremult` is the flag under test: when the
 * bytes are STRAIGHT but this is true, drawImage feeds the straight RGB into
 * the premultiplied source-over — the WKWebView 'none'-bitmap bug.
 */
interface DrawSource {
  __buf: Uint8ClampedArray
  __w: number
  __h: number
  __drawnAsPremult: boolean
}

function asSource(buf: Uint8ClampedArray, w: number, h: number, drawnAsPremult: boolean): DrawSource {
  return { __buf: buf, __w: w, __h: h, __drawnAsPremult: drawnAsPremult }
}

interface MockCanvas extends DrawSource {
  width: number
  height: number
  getContext: (kind: string, opts?: unknown) => MockCtx
}

interface MockCtx {
  clearRect: () => void
  putImageData: (id: Rgba, dx?: number, dy?: number) => void
  getImageData: (x: number, y: number, w: number, h: number) => Rgba
  drawImage: (src: DrawSource, dx?: number, dy?: number, dw?: number, dh?: number) => void
  createImageData: (w: number, h: number) => Rgba
}

function makePremultCanvas(w: number, h: number): MockCanvas {
  // Premultiplied backing store.
  let buf = new Uint8ClampedArray(w * h * 4)
  let cw = w
  let ch = h

  const canvas = {
    __buf: buf,
    __w: cw,
    __h: ch,
    // A canvas is always a correctly-premultiplied drawImage source.
    __drawnAsPremult: true,
    get width() { return cw },
    set width(v: number) {
      cw = v
      buf = new Uint8ClampedArray(Math.max(0, cw * ch) * 4)
      canvas.__buf = buf; canvas.__w = cw; canvas.__h = ch
    },
    get height() { return ch },
    set height(v: number) {
      ch = v
      buf = new Uint8ClampedArray(Math.max(0, cw * ch) * 4)
      canvas.__buf = buf; canvas.__w = cw; canvas.__h = ch
    },
    getContext: () => ctx,
  } as MockCanvas

  const ctx: MockCtx = {
    clearRect: () => { buf.fill(0) },

    putImageData: (id: Rgba, dx = 0, dy = 0) => {
      for (let y = 0; y < id.height; y++) {
        for (let x = 0; x < id.width; x++) {
          const si = (y * id.width + x) * 4
          const di = ((dy + y) * cw + (dx + x)) * 4
          if (di < 0 || di + 3 >= buf.length) continue
          const [pr, pg, pb, pa] = premul(id.data[si], id.data[si + 1], id.data[si + 2], id.data[si + 3])
          buf[di] = pr; buf[di + 1] = pg; buf[di + 2] = pb; buf[di + 3] = pa
        }
      }
    },

    getImageData: (x: number, y: number, rw: number, rh: number): Rgba => {
      const data = new Uint8ClampedArray(rw * rh * 4)
      for (let ry = 0; ry < rh; ry++) {
        for (let rx = 0; rx < rw; rx++) {
          const si = ((y + ry) * cw + (x + rx)) * 4
          const di = (ry * rw + rx) * 4
          if (si < 0 || si + 3 >= buf.length) continue
          const [sr, sg, sb, sa] = unpremul(buf[si], buf[si + 1], buf[si + 2], buf[si + 3])
          data[di] = sr; data[di + 1] = sg; data[di + 2] = sb; data[di + 3] = sa
        }
      }
      return { data, width: rw, height: rh }
    },

    createImageData: (rw: number, rh: number): Rgba => ({
      data: new Uint8ClampedArray(rw * rh * 4),
      width: rw,
      height: rh,
    }),

    drawImage: (src: DrawSource, dx = 0, dy = 0, dw?: number, dh?: number) => {
      void dw; void dh // same-size only in this probe
      // Resolve what drawImage BELIEVES the source premultiplied bytes are.
      // If the source is stored straight but flagged premultiplied, the
      // straight RGB is wrongly used as the premultiplied colour — the wash.
      const s = src.__buf
      const sw = src.__w
      const sh = src.__h
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const si = (y * sw + x) * 4
          const di = ((dy + y) * cw + (dx + x)) * 4
          if (si + 3 >= s.length || di < 0 || di + 3 >= buf.length) continue
          const sa255 = s[si + 3]
          if (sa255 <= 0) continue
          // Colour as drawImage sees it (already in premultiplied space).
          let scr: number, scg: number, scb: number
          if (src.__drawnAsPremult) {
            scr = s[si]; scg = s[si + 1]; scb = s[si + 2]
          } else {
            const [pr, pg, pb] = premul(s[si], s[si + 1], s[si + 2], sa255)
            scr = pr; scg = pg; scb = pb
          }
          const sa = sa255 / 255
          const da255 = buf[di + 3]
          const da = da255 / 255
          const keep = 1 - sa
          const outA = sa + da * keep
          if (outA <= 0) { buf[di] = 0; buf[di + 1] = 0; buf[di + 2] = 0; buf[di + 3] = 0; continue }
          buf[di] = Math.round(scr + buf[di] * keep)
          buf[di + 1] = Math.round(scg + buf[di + 1] * keep)
          buf[di + 2] = Math.round(scb + buf[di + 2] * keep)
          buf[di + 3] = Math.round(outA * 255)
        }
      }
    },
  }

  return canvas
}

function readPx(canvas: MockCanvas, x: number, y: number): [number, number, number, number] {
  const id = canvas.getContext('2d').getImageData(x, y, 1, 1)
  return [id.data[0], id.data[1], id.data[2], id.data[3]]
}

function readPxFromRgba(id: Rgba, x: number, y: number): [number, number, number, number] {
  const i = (y * id.width + x) * 4
  return [id.data[i], id.data[i + 1], id.data[i + 2], id.data[i + 3]]
}

// ---------------------------------------------------------------------------
// Settled-stroke state: seed wet, then run the REAL one-look-law transfer.
// ---------------------------------------------------------------------------

function makeDrying(size: number): DryingLUT {
  const drying: DryingLUT = {
    dryLUT: new Float32Array(LUT_SIZE + 1),
    invLUT: new Float32Array(LUT_SIZE + 1),
    dryPos: new Float32Array(size),
  }
  initDryingLUT(drying.dryLUT, drying.invLUT)
  return drying
}

function makeSaved(size: number): SavedWetBuffers {
  return {
    r: new Float32Array(size),
    g: new Float32Array(size),
    b: new Float32Array(size),
    alpha: new Float32Array(size),
    strokeOpacity: new Float32Array(size),
  }
}

function seedWet(): WetBuffers {
  const wet = createWetBuffers(W * H)
  const stamp = (x: number, y: number, alpha: number) => {
    const i = y * W + x
    wet.alpha[i] = alpha
    wet.strokeOpacity[i] = OP
    wet.wetness[i] = 1
    wet.r[i] = INK[0]; wet.g[i] = INK[1]; wet.b[i] = INK[2]
  }
  // 3x3 grain patch around the thin probe pixel + the opaque core.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) stamp(PX + dx, PY + dy, THIN_WET_ALPHA)
  }
  stamp(OX, OY, THICK_WET_ALPHA)
  return wet
}

/** Paint the settled wet into `dryCanvas` via the unmodified one-look-law transfer. */
function settleInto(dryCanvas: MockCanvas, paperSeeded: boolean) {
  const dryCtx = dryCanvas.getContext('2d')
  if (paperSeeded) {
    const id = dryCtx.createImageData(W, H)
    for (let i = 0; i < W * H; i++) {
      id.data[i * 4] = PAPER[0]; id.data[i * 4 + 1] = PAPER[1]
      id.data[i * 4 + 2] = PAPER[2]; id.data[i * 4 + 3] = PAPER[3]
    }
    dryCtx.putImageData(id, 0, 0)
  }
  const wet = seedWet()
  forceDryAll(wet, makeSaved(W * H), makeDrying(W * H), dryCtx as unknown as CanvasRenderingContext2D, W, H, null)
  return wet
}

// ---------------------------------------------------------------------------
// Engine wiring — same stub pattern as copyLiveExtractionTornEdge.test.ts.
// ---------------------------------------------------------------------------

type LiveEngine = EfxPaintEngine & Record<string, unknown>

function makeEngine(parts: {
  separated: boolean
  dryCanvas: MockCanvas
  dryCtxSource: { getImageData: (x: number, y: number, w: number, h: number) => Rgba }
  bgCtxSource: { getImageData: (x: number, y: number, w: number, h: number) => Rgba }
  previewBaseCanvas: MockCanvas
  displayCanvas: MockCanvas
  bakedScratch: MockCanvas
}): LiveEngine {
  const engine = Object.create(EfxPaintEngine.prototype) as LiveEngine
  Object.assign(engine as object, {
    width: W,
    height: H,
    previewBackgroundSeparated: parts.separated,
    performanceListener: null,
    bakeParityAwaitingExport: null,
    activeMutationId: undefined,
    lastCompletedMutationId: undefined,
    pendingStrokeFinalizations: [],
    activeStrokeFinalization: null,
    bakedScratchCanvas: parts.bakedScratch,
    renderVisibleWetLayer: vi.fn(),
    recordPerformance: vi.fn(),
    sampleBakeParityExport: vi.fn(),
    dualCanvas: {
      dryCanvas: parts.dryCanvas,
      dryCtx: parts.dryCtxSource,
      displayCanvas: parts.displayCanvas,
      previewBaseCanvas: parts.previewBaseCanvas,
    },
    bgCtx: parts.bgCtxSource,
  })
  return engine
}

function sourceOf(canvas: MockCanvas) {
  return {
    getImageData: (x: number, y: number, w: number, h: number) =>
      canvas.getContext('2d').getImageData(x, y, w, h),
  }
}

// ---------------------------------------------------------------------------
// Cache reload models — the three real decode interpretations.
// Cache bytes are S2's getImageData output: exactly what encodeCanvasAsWebp
// hands Rust. The codec is VP8L + config.exact (byte-faithful, pinned in
// frame_codec.rs), so decode yields those same STRAIGHT bytes back.
// ---------------------------------------------------------------------------

type ReloadMode = 'premultiplied' | 'straight-correct' | 'straight-as-premult'

function reloadInto(straightBytes: Rgba, mode: ReloadMode): MockCanvas {
  const out = makePremultCanvas(straightBytes.width, straightBytes.height)
  const buf = new Uint8ClampedArray(straightBytes.data) // the decoded straight bytes
  let bitmap: DrawSource
  if (mode === 'premultiplied') {
    // createImageBitmap(imageData, { premultiplyAlpha: 'premultiply' })
    //   — physicPaintStore.ts:1451, the 52.1 fix
    bitmap = asSource(premulBuffer(buf), straightBytes.width, straightBytes.height, true)
  } else if (mode === 'straight-correct') {
    // spec-correct straight bitmap: drawImage premultiplies first
    bitmap = asSource(buf, straightBytes.width, straightBytes.height, false)
  } else {
    // createImageBitmap(..., { premultiplyAlpha: 'none' }) drawn by
    //   WKWebView as-if premultiplied — the documented wash
    bitmap = asSource(buf, straightBytes.width, straightBytes.height, true)
  }
  out.getContext('2d').drawImage(bitmap, 0, 0)
  return out
}

function premulBuffer(straight: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(straight.length)
  for (let i = 0; i < straight.length; i += 4) {
    const [pr, pg, pb, pa] = premul(straight[i], straight[i + 1], straight[i + 2], straight[i + 3])
    out[i] = pr; out[i + 1] = pg; out[i + 2] = pb; out[i + 3] = pa
  }
  return out
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

type Px = [number, number, number, number]

function fmt(px: Px): string {
  return `${String(px[0]).padStart(4)} ${String(px[1]).padStart(4)} ${String(px[2]).padStart(4)} ${String(px[3]).padStart(4)}`
}

function delta(a: Px, b: Px): string {
  const d = (x: number, y: number) => {
    const v = x - y
    return (v >= 0 ? '+' : '') + String(v).padStart(3)
  }
  return `${d(a[0], b[0])} ${d(a[1], b[1])} ${d(a[2], b[2])} ${d(a[3], b[3])}`
}

function samePx(a: Px, b: Px, tol = 1): boolean {
  return Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol
    && Math.abs(a[2] - b[2]) <= tol && Math.abs(a[3] - b[3]) <= tol
}

function paperCanvas(): MockCanvas {
  const c = makePremultCanvas(W, H)
  const id = c.getContext('2d').createImageData(W, H)
  for (let i = 0; i < W * H; i++) {
    id.data[i * 4] = PAPER[0]; id.data[i * 4 + 1] = PAPER[1]
    id.data[i * 4 + 2] = PAPER[2]; id.data[i * 4 + 3] = PAPER[3]
  }
  c.getContext('2d').putImageData(id, 0, 0)
  return c
}

function paintOverPaper(paint: MockCanvas): Px {
  const screen = paperCanvas()
  screen.getContext('2d').drawImage(paint, 0, 0)
  return readPx(screen, PX, PY)
}

// ============================================================
//  Probes
// ============================================================

describe('261001-cache3 — settled-pixel 3-surface probe (measurement only)', () => {
  it('harness self-check: the mock can SEE a premultiply wash', () => {
    // If this fails the probe cannot discriminate and every number below
    // is noise. Prove the three properties the verdict depends on.
    const c = makePremultCanvas(4, 4)

    // (1) a = 255 round-trip is identity (premul is the identity there).
    const opaque = { data: Uint8ClampedArray.from([170, 80, 140, 255]), width: 1, height: 1 }
    c.getContext('2d').putImageData(opaque, 0, 0)
    expect(readPx(c, 0, 0), 'opaque round-trip must be lossless').toEqual([170, 80, 140, 255])

    // (2) semi-transparent round-trip is lossless to +/-1.
    const thin = { data: Uint8ClampedArray.from([INK[0], INK[1], INK[2], 71]), width: 1, height: 1 }
    c.getContext('2d').putImageData(thin, 1, 0)
    expect(samePx(readPx(c, 1, 0), [INK[0], INK[1], INK[2], 71], 1), `thin round-trip ${fmt(readPx(c, 1, 0))}`).toBe(true)

    // (3) the WASH is reproducible: straight bytes drawn as-if premultiplied
    //     come back BRIGHTER at the SAME alpha.
    const washed = reloadInto(thin, 'straight-as-premult')
    const wpx = readPx(washed, 0, 0)
    const cpx = readPx(reloadInto(thin, 'premultiplied'), 0, 0)
    expect(wpx[3], 'wash must not touch alpha').toBe(cpx[3])
    expect(wpx[0], `wash must brighten R: clean=${cpx[0]} washed=${wpx[0]}`).toBeGreaterThan(cpx[0])
    expect(wpx[1], `wash must brighten G: clean=${cpx[1]} washed=${wpx[1]}`).toBeGreaterThan(cpx[1])
    expect(wpx[2], `wash must brighten B: clean=${cpx[2]} washed=${wpx[2]}`).toBeGreaterThan(cpx[2])
    console.log(`[cache3] self-check OK — wash reproduces: clean=${fmt(cpx)} washed=${fmt(wpx)}`)
  })

  it('one settled pixel across S1 / S2 / S3 + screen — print the table', () => {
    console.log(`[cache3] settled pixel (${PX},${PY}) thin wet.alpha=${THIN_WET_ALPHA} and (${OX},${OY}) thick=${THICK_WET_ALPHA} ink=${fmt([...INK] as Px)} paper=${fmt([...PAPER] as Px)}`)
    console.log(`[cache3] one-look-law reference bytes: thin=${REF_THIN} thick=${REF_THICK} (wetDisplayAlpha, READ-ONLY)`)

    const verdicts: string[] = []

    for (const separated of [true, false]) {
      const label = separated ? 'separated  ' : 'bg-subtract'
      const dryCanvas = makePremultCanvas(W, H)
      settleInto(dryCanvas, /* paperSeeded */ !separated)

      const previewBase = makePremultCanvas(W, H)
      if (separated) {
        // Separated: previewBase carries the paper (redrawPreviewBase draws
        // bg then the cache image). dry is paint-only.
        const pb = paperCanvas()
        previewBase.getContext('2d').drawImage(pb, 0, 0)
      }
      const display = makePremultCanvas(W, H) // empty — post-finalize
      const baked = makePremultCanvas(W, H)

      const engine = makeEngine({
        separated,
        dryCanvas,
        dryCtxSource: sourceOf(dryCanvas),
        bgCtxSource: sourceOf(paperCanvas()),
        previewBaseCanvas: previewBase,
        displayCanvas: display,
        bakedScratch: baked,
      })

      // ---- S1: getBakedCanvas() ------------------------------------------
      const s1Canvas = (engine as unknown as { getBakedCanvas: () => MockCanvas }).getBakedCanvas()
      const s1 = readPx(s1Canvas, PX, PY)
      const s1c = readPx(s1Canvas, OX, OY)

      // ---- S2: copyLiveAlphaCanvas() -------------------------------------
      vi.stubGlobal('document', {
        createElement: () => {
          const c = makePremultCanvas(W, H)
          return c
        },
      })
      let s2Canvas: MockCanvas
      try {
        s2Canvas = (engine as unknown as { copyLiveAlphaCanvas: () => MockCanvas }).copyLiveAlphaCanvas()
      } finally {
        vi.unstubAllGlobals()
      }
      const s2 = readPx(s2Canvas, PX, PY)
      const s2c = readPx(s2Canvas, OX, OY)

      // ---- S2 as cache bytes (what encodeCanvasAsWebp sends to Rust) ------
      const cacheBytes = s2Canvas.getContext('2d').getImageData(0, 0, W, H)

      // ---- S3: the three reload interpretations --------------------------
      const s3prem = readPx(reloadInto(cacheBytes, 'premultiplied'), PX, PY)
      const s3corr = readPx(reloadInto(cacheBytes, 'straight-correct'), PX, PY)
      const s3wash = readPx(reloadInto(cacheBytes, 'straight-as-premult'), PX, PY)
      const s3premC = readPx(reloadInto(cacheBytes, 'premultiplied'), OX, OY)
      const s3washC = readPx(reloadInto(cacheBytes, 'straight-as-premult'), OX, OY)

      // ---- screen composites (paper + reloaded cache) --------------------
      const screenPrem = paintOverPaper(reloadInto(cacheBytes, 'premultiplied'))
      const screenWash = paintOverPaper(reloadInto(cacheBytes, 'straight-as-premult'))
      // The correct screen reference: paper + the S2 paint itself.
      const screenS2 = paintOverPaper(s2Canvas)

      console.log(`\n[cache3] --- ${label} ---  thin pixel (${PX},${PY})`)
      console.log(`[cache3] surface                                R    G    B    A  |  dR   dG   dB   dA (vs S2)`)
      console.log(`[cache3] S1 getBakedCanvas()                 ${fmt(s1)}  |  ${delta(s1, s2)}`)
      console.log(`[cache3] S2 copyLiveAlphaCanvas()            ${fmt(s2)}  |  ---- baseline ----`)
      console.log(`[cache3] S3 reload premultiplied (52.1 fix)  ${fmt(s3prem)}  |  ${delta(s3prem, s2)}`)
      console.log(`[cache3] S3 reload straight-correct          ${fmt(s3corr)}  |  ${delta(s3corr, s2)}`)
      console.log(`[cache3] S3 reload straight-as-premult (bug) ${fmt(s3wash)}  |  ${delta(s3wash, s2)}`)
      console.log(`[cache3] screen paper+S2                     ${fmt(screenS2)}  |  ---- baseline ----`)
      console.log(`[cache3] screen paper+S3prem                 ${fmt(screenPrem)}  |  ${delta(screenPrem, screenS2)}`)
      console.log(`[cache3] screen paper+S3wash                 ${fmt(screenWash)}  |  ${delta(screenWash, screenS2)}`)
      console.log(`[cache3] --- ${label} ---  core pixel (${OX},${OY})`)
      console.log(`[cache3] S1 core                              ${fmt(s1c)}`)
      console.log(`[cache3] S2 core                              ${fmt(s2c)}`)
      console.log(`[cache3] S3 core premultiplied                ${fmt(s3premC)}`)
      console.log(`[cache3] S3 core straight-as-premult          ${fmt(s3washC)}`)

      // ---- classify this branch ------------------------------------------
      const rgbBrighterSameAlpha =
        s3wash[3] === s2[3] && (s3wash[0] > s2[0] || s3wash[1] > s2[1] || s3wash[2] > s2[2])
      const alphaLower = s3prem[3] < s2[3] || s2[3] < REF_THIN
      // S1 is paper+paint flattened, S2 is paint-only — RGB WILL differ. The
      // real wet-drop signal is S1 losing MASS against the paper-composited
      // S2 (screen(paper+S2) should equal S1 byte for byte).
      const s1s2Disagree = !samePx(s1, screenS2, 1)
      const screenLighterWithCleanReload =
        samePx(s3prem, s2, 1)
        && (screenPrem[0] > screenS2[0] + 1 || screenPrem[1] > screenS2[1] + 1 || screenPrem[2] > screenS2[2] + 1)

      if (rgbBrighterSameAlpha) {
        verdicts.push(
          `${label}: PREMULTIPLY WASH at RELOAD — S3 straight-as-premult reads ${fmt(s3wash)} vs clean ${fmt(s2)} `
          + `(same alpha ${s2[3]}, RGB brighter). Writer = any decode that hands STRAIGHT bytes to a `
          + `premultiplied drawImage: createImageBitmap(blob) with NO premultiplyAlpha `
          + `(physicsPaintRotoAlphaMerge.ts:41, rotoCanvasFrames.ts:62) or premultiplyAlpha:'none'.`,
        )
      }
      if (alphaLower) {
        verdicts.push(
          `${label}: CAPTURE/TRANSFER LOSS — alpha ${s2[3]} < reference ${REF_THIN}. `
          + `Writer = copyLiveAlphaCanvas branch or the forceDryAll transfer.`,
        )
      }
      if (s1s2Disagree) {
        verdicts.push(
          `${label}: MASS LOSS at BAKE — getBakedCanvas ${fmt(s1)} vs paper+S2 ${fmt(screenS2)}. `
          + `Writer = getBakedCanvas dropping the wet overlay (or a previewBase composite gap).`,
        )
      }
      if (screenLighterWithCleanReload) {
        verdicts.push(
          `${label}: DOUBLE PAPER — clean reload is byte-faithful but the screen is lighter `
          + `(${fmt(screenPrem)} vs ${fmt(screenS2)}). Writer = redrawPreviewBase drawing bg under a cache that already has paper baked in.`,
        )
      }
      if (!rgbBrighterSameAlpha && !alphaLower && !s1s2Disagree && !screenLighterWithCleanReload) {
        verdicts.push(`${label}: ALL CLEAN at this pixel — the writer is NOT on these three surfaces.`)
      }

      // The core must never wash (a = 255 makes premul the identity). If it
      // does, the mock is lying.
      expect(s3washC[3], 'core alpha must stay 255').toBe(255)
    }

    console.log('\n[cache3] ================= VERDICT =================')
    for (const v of verdicts) console.log(`[cache3] ${v}`)
    console.log('[cache3] ============================================')
  })

  it('region scan — mean |dRGB| and dA across the grain patch', () => {
    const dryCanvas = makePremultCanvas(W, H)
    settleInto(dryCanvas, false)
    const display = makePremultCanvas(W, H)
    const engine = makeEngine({
      separated: true,
      dryCanvas,
      dryCtxSource: sourceOf(dryCanvas),
      bgCtxSource: sourceOf(paperCanvas()),
      previewBaseCanvas: paperCanvas(),
      displayCanvas: display,
      bakedScratch: makePremultCanvas(W, H),
    })
    vi.stubGlobal('document', { createElement: () => makePremultCanvas(W, H) })
    let s2Canvas: MockCanvas
    try {
      s2Canvas = (engine as unknown as { copyLiveAlphaCanvas: () => MockCanvas }).copyLiveAlphaCanvas()
    } finally {
      vi.unstubAllGlobals()
    }
    const cacheBytes = s2Canvas.getContext('2d').getImageData(0, 0, W, H)
    const clean = reloadInto(cacheBytes, 'premultiplied')
    const washed = reloadInto(cacheBytes, 'straight-as-premult')

    let sumdRGB = 0
    let sumdA = 0
    let n = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const a = readPx(clean, PX + dx, PY + dy)
        const b = readPx(washed, PX + dx, PY + dy)
        sumdRGB += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) + Math.abs(b[2] - a[2])
        sumdA += b[3] - a[3]
        n++
      }
    }
    console.log(`[cache3] region scan (grain patch, ${n}px): mean|dRGB|=${(sumdRGB / n).toFixed(1)} mean dA=${(sumdA / n).toFixed(1)}`)
    // A wash is RGB-only: alpha is untouched. If dA drifts the mock is wrong.
    expect(Math.abs(sumdA / n), 'wash must not move alpha').toBeLessThanOrEqual(1)
  })

  it('the wash law stands: every createImageBitmap pins premultiplyAlpha', () => {
    // 261001-cache3 — THE WRITER was straight bytes drawn as premultiplied.
    // The 52.1 fix pinned only the ImageData leg; the three blob legs were
    // left on the UA default, and a "default"/"none"-flagged bitmap washes
    // every semi-transparent grain pixel toward white at the same alpha
    // (measured above: +14/+36/+54 RGB at alpha 71, dA = 0). This pin makes
    // the rule un-drop-able: any new createImageBitmap must declare it too.
    const roots = [
      '../../../../app/src/stores/physicPaintStore.ts',
      '../../../../app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts',
      '../../../../app/src/components/physic-paint/roto/rotoCanvasFrames.ts',
    ]
    const offenders: string[] = []
    for (const rel of roots) {
      const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
      // Real call sites only (a comment mentioning the identifier is not a
      // call). Read each call's argument list to its statement end so nested
      // parens — `new Blob([bytes.slice()])` — cannot truncate the scan.
      const calls = src.match(/createImageBitmap\s*\([^;]*;/g) ?? []
      expect(calls.length, `${rel} should contain createImageBitmap call sites`).toBeGreaterThan(0)
      for (const call of calls) {
        if (!call.includes("premultiplyAlpha: 'premultiply'")) offenders.push(`${rel}: ${call.replace(/\s+/g, ' ').trim()}`)
      }
    }
    expect(offenders, `un-pinned createImageBitmap calls: ${offenders.join(' | ')}`).toEqual([])
  })
})
