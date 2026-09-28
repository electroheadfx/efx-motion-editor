// ============================================================
//  260928-dh1 move 2 — extraction-artifact pin (ONE pin, NO fix)
//
//  Question: is the ~12 200 post-display tornEdge an ARTIFACT of
//  copyLiveAlphaCanvas / dry-minus-background, or does a clean
//  input stay clean through the extraction?
//
//  Feed a CLEAN synthetic dry layer (ideal AA edge, zero speckle)
//  through the REAL EfxPaintEngine.copyLiveAlphaCanvas and read
//  tornEdge on the extracted paint-only alpha plane.
//
//    thousands -> the extraction manufactures the tear. The
//                measured "torn contour" was never a real defect
//                and everything folds into lever 2 (paint.ts).
//    clean     -> the extraction is exonerated. Remaining interval
//                suspects are real advection and dryStep's
//                paperHeight term. Decide on evidence then.
//
//  Do NOT write a third directed fix before this pin returns.
//
//  Both extraction branches are pinned:
//    - background-subtraction (dry RGBA byte-equality vs bg)
//    - separated (drawImage dry as-is)
//  ============================================================

import { describe, expect, it, vi } from 'vitest'
import { EfxPaintEngine } from './EfxPaintEngine'
import { computeDefectMetrics } from '../../../../app/src/components/physic-paint/performance/depositSpeckleCapture'

const W = 64
const H = 32

interface Rgba {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Flat paper — the opaque background the dry layer is composited against. */
const PAPER: readonly [number, number, number, number] = [240, 230, 220, 255]
/** Stroke ink (#103c65 — the dh1 capture colour). */
const PAINT: readonly [number, number, number, number] = [16, 60, 101, 255]

const AA_SPAN = 10

/**
 * CLEAN synthetic dry layer: a solid body with an IDEAL AA edge.
 * Coverage is a smooth monotonic 10px ramp (step 0.1 → alpha step 25.5,
 * under the 32-unit hard-jump threshold, so the INPUT scores bodyHardJumps
 * = 0 by the metric's own definition). Body x 20..43, y 10..21. Alpha is
 * 255 everywhere paper exists (paint over opaque paper) — the AA lives in
 * the colour, exactly as dryStep writeback leaves it.
 */
function buildCleanDry(): Rgba {
  const data = new Uint8ClampedArray(W * H * 4)
  const x0 = 20, x1 = 43, y0 = 10, y1 = 21
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0
      const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0
      const d = Math.max(dx, dy)
      const c = d === 0 ? 1 : Math.max(0, 1 - d / AA_SPAN)
      const i = (y * W + x) * 4
      if (c <= 0) {
        data[i] = PAPER[0]; data[i + 1] = PAPER[1]; data[i + 2] = PAPER[2]; data[i + 3] = PAPER[3]
        continue
      }
      data[i] = Math.round(PAPER[0] + c * (PAINT[0] - PAPER[0]))
      data[i + 1] = Math.round(PAPER[1] + c * (PAINT[1] - PAPER[1]))
      data[i + 2] = Math.round(PAPER[2] + c * (PAINT[2] - PAPER[2]))
      data[i + 3] = 255
    }
  }
  return { data, width: W, height: H }
}

function buildPaper(): Rgba {
  const data = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = PAPER[0]
    data[i * 4 + 1] = PAPER[1]
    data[i * 4 + 2] = PAPER[2]
    data[i * 4 + 3] = PAPER[3]
  }
  return { data, width: W, height: H }
}

/**
 * Paint-only dry layer (transparent paper): the same ideal coverage ramp
 * carried in ALPHA. Control — this is what a paint-only live layer looks
 * like, and it must survive extraction as a smooth ramp.
 */
function buildCleanDryPaintOnly(): Rgba {
  const data = new Uint8ClampedArray(W * H * 4)
  const x0 = 20, x1 = 43, y0 = 10, y1 = 21
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0
      const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0
      const d = Math.max(dx, dy)
      const c = d === 0 ? 1 : Math.max(0, 1 - d / AA_SPAN)
      const i = (y * W + x) * 4
      data[i] = PAINT[0]
      data[i + 1] = PAINT[1]
      data[i + 2] = PAINT[2]
      data[i + 3] = Math.round(c * 255)
    }
  }
  return { data, width: W, height: H }
}

function buildTransparent(): Rgba {
  return { data: new Uint8ClampedArray(W * H * 4), width: W, height: H }
}

function cloneRgba(src: Rgba): Rgba {
  return { data: new Uint8ClampedArray(src.data), width: src.width, height: src.height }
}

/** Storage canvas — records putImageData and composites drawImage as source-over. */
function makeStorageCanvas() {
  let w = 0
  let h = 0
  let buf = new Uint8ClampedArray(0)
  const ctx = {
    clearRect: () => { buf.fill(0) },
    putImageData: (id: Rgba) => {
      w = id.width; h = id.height
      buf = new Uint8ClampedArray(id.data)
    },
    drawImage: (src: { __pixels?: Rgba }) => {
      const s = src.__pixels
      if (!s) return
      for (let i = 0; i < buf.length && i < s.data.length; i += 4) {
        const sa = s.data[i + 3] / 255
        if (sa <= 0) continue
        const da = buf[i + 3] / 255
        const outA = sa + da * (1 - sa)
        if (outA <= 0) continue
        for (let c = 0; c < 3; c++) {
          buf[i + c] = Math.round((s.data[i + c] * sa + buf[i + c] * da * (1 - sa)) / outA)
        }
        buf[i + 3] = Math.round(outA * 255)
      }
    },
    getImageData: (_x: number, _y: number, rw: number, rh: number): Rgba => {
      const data = new Uint8ClampedArray(rw * rh * 4)
      data.set(buf.subarray(0, Math.min(buf.length, data.length)))
      return { data, width: rw, height: rh }
    },
  }
  const canvas = {
    get width() { return w },
    set width(v: number) { w = v; buf = new Uint8ClampedArray(Math.max(0, w * h) * 4) },
    get height() { return h },
    set height(v: number) { h = v; buf = new Uint8ClampedArray(Math.max(0, w * h) * 4) },
    getContext: () => ctx,
  }
  return { canvas, ctx }
}

function makeGetImageDataSource(pixels: Rgba) {
  return {
    getImageData: (x: number, y: number, rw: number, rh: number): Rgba => {
      void x; void y
      return cloneRgba({ data: pixels.data, width: rw, height: rh })
    },
  }
}

function runExtraction(
  dry: Rgba,
  bg: Rgba,
  separated: boolean,
): { tornEdge: number; bodyHardJumps: number; isolatedPx: number; alphaMass: number; alpha: Uint8Array } {
  const out = makeStorageCanvas()
  vi.stubGlobal('document', { createElement: () => out.canvas })

  const drySrc = makeGetImageDataSource(dry)
  const bgSrc = makeGetImageDataSource(bg)
  // Empty wet display — this pin is about the dry extraction, not the overlay.
  const displayPixels = buildTransparent()

  const engine = Object.create(EfxPaintEngine.prototype) as EfxPaintEngine
  Object.assign(engine as object, {
    width: W,
    height: H,
    previewBackgroundSeparated: separated,
    performanceListener: null,
    activeMutationId: undefined,
    lastCompletedMutationId: undefined,
    renderVisibleWetLayer: vi.fn(),
    recordPerformance: vi.fn(),
    dualCanvas: {
      dryCanvas: { __pixels: dry },
      dryCtx: drySrc,
      displayCanvas: { __pixels: displayPixels },
    },
    bgCtx: bgSrc,
  })

  try {
    const canvas = engine.copyLiveAlphaCanvas()
    const readback = (canvas.getContext('2d') as unknown as { getImageData: (x: number, y: number, w: number, h: number) => Rgba })
      .getImageData(0, 0, W, H)
    const alpha = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) alpha[i] = readback.data[i * 4 + 3]
    const m = computeDefectMetrics(alpha, W, H)
    return {
      tornEdge: m.tornEdge,
      bodyHardJumps: m.bodyHardJumps,
      isolatedPx: m.isolatedPx,
      alphaMass: m.alphaMass,
      alpha,
    }
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('copyLiveAlphaCanvas extraction on a CLEAN dry layer (move 2 pin)', () => {
  it('background-subtraction on an ideal AA edge over paper — read tornEdge', () => {
    const dry = buildCleanDry()
    const bg = buildPaper()
    const r = runExtraction(dry, bg, false)
    // MEASUREMENT, not a wish. Log the numbers either way.
    console.log(
      `[move2] background-subtraction clean-AA-over-paper: tornEdge=${r.tornEdge} bodyHardJumps=${r.bodyHardJumps} isolatedPx=${r.isolatedPx} alphaMass=${r.alphaMass}`,
    )
    // Discriminator only — the CALL is made on these numbers. A clean input
    // must not score in the thousands; if it does, the extraction is the
    // artifact and the 12 200 post-display tornEdge was never a real defect.
    expect(r.tornEdge, `tornEdge=${r.tornEdge} — thousands means the extraction manufactures the tear`).toBeLessThan(200)
  })

  it('separated branch on a paint-only AA ramp — read tornEdge', () => {
    // Separated draws dry as-is. A paper-baked dry would saturate alpha at
    // 255 and blind the metric (the capture harness note), so the honest
    // separated cell uses the paint-only ramp.
    const dry = buildCleanDryPaintOnly()
    const bg = buildTransparent()
    const r = runExtraction(dry, bg, true)
    console.log(
      `[move2] separated paint-only-AA: tornEdge=${r.tornEdge} bodyHardJumps=${r.bodyHardJumps} isolatedPx=${r.isolatedPx} alphaMass=${r.alphaMass}`,
    )
    expect(r.tornEdge, `tornEdge=${r.tornEdge}`).toBeLessThan(200)
    expect(r.bodyHardJumps, `bodyHardJumps=${r.bodyHardJumps}`).toBe(0)
  })

  it('background-subtraction on a paint-only AA alpha ramp — read tornEdge', () => {
    // Control: smooth alpha ramp, transparent paper. If this tears, the
    // byte-equality punch is chopping a clean ramp into fragments.
    const dry = buildCleanDryPaintOnly()
    const bg = buildTransparent()
    const r = runExtraction(dry, bg, false)
    console.log(
      `[move2] background-subtraction paint-only-AA: tornEdge=${r.tornEdge} bodyHardJumps=${r.bodyHardJumps} isolatedPx=${r.isolatedPx} alphaMass=${r.alphaMass}`,
    )
    expect(r.tornEdge, `tornEdge=${r.tornEdge}`).toBeLessThan(200)
    expect(r.bodyHardJumps, `bodyHardJumps=${r.bodyHardJumps}`).toBe(0)
    expect(r.isolatedPx, `isolatedPx=${r.isolatedPx}`).toBe(0)
  })

  it('control — the clean dry input itself scores tornEdge = 0 before extraction', () => {
    // Proves the input really is clean, so any tear above is created by
    // the extraction and not smuggled in with the synthetic field.
    const dry = buildCleanDryPaintOnly()
    const alpha = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) alpha[i] = dry.data[i * 4 + 3]
    const m = computeDefectMetrics(alpha, W, H)
    console.log(
      `[move2] INPUT paint-only-AA: tornEdge=${m.tornEdge} bodyHardJumps=${m.bodyHardJumps} isolatedPx=${m.isolatedPx}`,
    )
    expect(m.tornEdge).toBe(0)
    expect(m.bodyHardJumps).toBe(0)
    expect(m.isolatedPx).toBe(0)
  })
})
