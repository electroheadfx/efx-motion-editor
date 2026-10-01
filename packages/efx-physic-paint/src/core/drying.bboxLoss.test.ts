// ============================================================
//  260930-wm6 re-pin — forceDryAll bbox-loss proof under the
//  ONE LOOK LAW
//
//  Transfer alpha = wetDisplayAlpha(alpha, pixelOpacity,
//  sampleH(...)) / 255 — the display law is the ONLY transfer
//  law (no /800, no carve).
//
//  260930-wm6 R3b — the bbox-loss half of this proof is now a
//  PIN OF THE FIX, not of the defect. Physics-drifted wet sitting
//  OUTSIDE the caller's `dryRegionForStroke` used to be untouched
//  by the bbox-clamped forceDryAll and was destroyed on
//  leave/close — and because getBakedCanvas is previewBase + dry
//  with no wet overlay, it read as a TRUE WHITE hole along the
//  bbox rectangle (the "full block outline" and its four sides).
//  forceDryAll now widens its clamp to the real wet extent, so
//  every visible solved pixel lands in dry.
//
//  This file is the deterministic mechanism proof:
//    (i)   wet mass INSIDE the caller's bounds transfers to dry
//    (ii)  wet mass OUTSIDE the caller's bounds ALSO transfers —
//          it is no longer stranded (R3b fix)
//    (iii) dry's gained alpha equals inside + outside transfer,
//          so NO visible mass is unaccounted for
//
//  Seeded grid (W=20 x H=10), op 1 = display fast path (paper
//  ignored; the forceDryAll call passes paper = null):
//    inside  (cols 6..9, rows 3..6): 16 px @ alpha 400
//      -> per-px transfer round(wetDisplayAlpha(400, 1, ·)) = 40
//      -> inside transfer 16 * 40 = 640
//    drift   (cols 10..11, rows 3..6): 8 px @ alpha 700
//      -> per-px transfer round(wetDisplayAlpha(700, 1, ·)) = 70
//      -> outside transfer 8 * 70 = 560 (was the loss)
//    dry total after = 640 + 560 = 1200
//    wet total before = 16*400 + 8*700 = 12000 (outside = 46.67%)
//
//  Second block: the paper-gap pure helper bakeParityPaperMods is
//  unit-checked AGAINST compositor.ts's paper response through
//  wetDisplayAlpha — compositor is imported and read, NEVER
//  edited.
// ============================================================

import { describe, expect, it } from 'vitest'
import { forceDryAll, initDryingLUT } from './drying'
import { wetDisplayAlpha } from '../render/compositor'
import { bakeParityPaperMods } from '../engine/EfxPaintEngine'
import { createWetBuffers } from './wet-layer'
import { LUT_SIZE } from '../types'
import type { DryingLUT, SavedWetBuffers, WetBuffers } from '../types'

const W = 20
const H = 10
const SIZE = W * H

// Narrow bounds: cols 6..9, rows 3..6 = 4x4 = 16 px inside.
const BOUNDS = { x0: 6, y0: 3, x1: 9, y1: 6 } as const
const INSIDE_PX = (BOUNDS.x1 - BOUNDS.x0 + 1) * (BOUNDS.y1 - BOUNDS.y0 + 1) // 16

// Physics-drift zone: cols 10..11, rows 3..6 = 2x4 = 8 px OUTSIDE bounds.
const DRIFT_COLS = [10, 11] as const
const DRIFT_ROWS = [3, 4, 5, 6] as const
const OUTSIDE_PX = DRIFT_COLS.length * DRIFT_ROWS.length // 8

const INSIDE_ALPHA = 400
const OUTSIDE_ALPHA = 700
const OPACITY = 1

// One look law for the seeded alphas — fast path (op 1) ignores paper,
// so the sampleH(null) baseline 0.5 is irrelevant to the byte:
//   round(wetDisplayAlpha(400, 1, 0.5)) = 40, round(wetDisplayAlpha(700, 1, 0.5)) = 70
const EXPECTED_INSIDE_TRANSFER = Math.round(wetDisplayAlpha(INSIDE_ALPHA, OPACITY, 0.5)) // 40
const EXPECTED_OUTSIDE_TRANSFER = Math.round(wetDisplayAlpha(OUTSIDE_ALPHA, OPACITY, 0.5)) // 70
const EXPECTED_INSIDE_GAIN = INSIDE_PX * EXPECTED_INSIDE_TRANSFER // 640
const EXPECTED_OUTSIDE_GAIN = OUTSIDE_PX * EXPECTED_OUTSIDE_TRANSFER // 560 — was the loss, now lands
const EXPECTED_DRY_GAIN = EXPECTED_INSIDE_GAIN + EXPECTED_OUTSIDE_GAIN // 1200

const WET_TOTAL_ALPHA = INSIDE_PX * INSIDE_ALPHA + OUTSIDE_PX * OUTSIDE_ALPHA // 12000
const WET_OUTSIDE_ALPHA = OUTSIDE_PX * OUTSIDE_ALPHA // 5600

function isInside(x: number, y: number): boolean {
  return x >= BOUNDS.x0 && x <= BOUNDS.x1 && y >= BOUNDS.y0 && y <= BOUNDS.y1
}

function isDrift(x: number, y: number): boolean {
  return DRIFT_COLS.includes(x) && DRIFT_ROWS.includes(y)
}

function makeWet(): WetBuffers {
  const wet = createWetBuffers(SIZE)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (isInside(x, y)) {
        wet.alpha[i] = INSIDE_ALPHA
        wet.strokeOpacity[i] = OPACITY
        wet.wetness[i] = 1
        wet.r[i] = 30; wet.g[i] = 60; wet.b[i] = 120
      } else if (isDrift(x, y)) {
        wet.alpha[i] = OUTSIDE_ALPHA
        wet.strokeOpacity[i] = OPACITY
        wet.wetness[i] = 1
        wet.r[i] = 20; wet.g[i] = 40; wet.b[i] = 90
      }
    }
  }
  return wet
}

function makeDrying(): DryingLUT {
  const drying: DryingLUT = {
    dryLUT: new Float32Array(LUT_SIZE + 1),
    invLUT: new Float32Array(LUT_SIZE + 1),
    dryPos: new Float32Array(SIZE),
  }
  initDryingLUT(drying.dryLUT, drying.invLUT)
  return drying
}

function makeSaved(): SavedWetBuffers {
  return {
    r: new Float32Array(SIZE),
    g: new Float32Array(SIZE),
    b: new Float32Array(SIZE),
    alpha: new Float32Array(SIZE),
    strokeOpacity: new Float32Array(SIZE),
  }
}

/**
 * ImageData-backed dry plane with REAL rect semantics: getImageData hands
 * forceDryAll a rect-local buffer (it indexes with (py-by0)*rectW + px-bx0),
 * putImageData commits that rect back into the absolute full-frame plane at
 * (x, y) — exactly what the canvas does. The parity harness never needed the
 * commit because it ran with bounds=null (bx0=by0=0, rect-local == absolute).
 */
function makeDryCtx(dry: Uint8ClampedArray): CanvasRenderingContext2D {
  return {
    getImageData: (_x: number, _y: number, w: number, h: number) =>
      ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (id: ImageData, x: number, y: number) => {
      for (let ry = 0; ry < id.height; ry++) {
        for (let rx = 0; rx < id.width; rx++) {
          const src = (ry * id.width + rx) * 4
          const dst = ((y + ry) * W + (x + rx)) * 4
          dry[dst] = id.data[src]
          dry[dst + 1] = id.data[src + 1]
          dry[dst + 2] = id.data[src + 2]
          dry[dst + 3] = id.data[src + 3]
        }
      }
    },
  } as unknown as CanvasRenderingContext2D
}

interface RunResult {
  wet: WetBuffers
  dry: Uint8ClampedArray
}

/**
 * One forceDryAll run over the seeded buffers with the narrow bounds.
 * Call form is the GREEN A signature: paperHeight (null — op 1 is the
 * fast path so paper cannot matter), observePrimitive, stagePrefix,
 * bounds. RED runs this against the pre-GREEN signature where the extra
 * args land in the old slots — the assertions below are the RED gate.
 */
function runForceDryAll(): RunResult {
  const wet = makeWet()
  const dry = new Uint8ClampedArray(SIZE * 4)
  const ctx = makeDryCtx(dry)
  forceDryAll(wet, makeSaved(), makeDrying(), ctx, W, H, null, undefined, 'bbox-loss', { ...BOUNDS })
  return { wet, dry }
}

function dryAlphaAt(dry: Uint8ClampedArray, x: number, y: number): number {
  return dry[(y * W + x) * 4 + 3]
}

describe('260930-q6t Addendum B / 260930-wm6 R3b — forceDryAll must not drop visible wet mass', () => {
  it('(i) inside-bounds wet transfers to dry: every inside px lands at exactly 40 (one look law) and its wet alpha is zeroed', () => {
    const { wet, dry } = runForceDryAll()
    for (let y = BOUNDS.y0; y <= BOUNDS.y1; y++) {
      for (let x = BOUNDS.x0; x <= BOUNDS.x1; x++) {
        const i = y * W + x
        expect(
          dryAlphaAt(dry, x, y),
          `inside px (${x},${y}): dry alpha ${dryAlphaAt(dry, x, y)}, one look law expects ${EXPECTED_INSIDE_TRANSFER}`,
        ).toBe(EXPECTED_INSIDE_TRANSFER)
        expect(wet.alpha[i], `inside px (${x},${y}): wet alpha must be zeroed after transfer`).toBe(0)
        expect(wet.strokeOpacity[i], `inside px (${x},${y}): strokeOpacity must be zeroed`).toBe(0)
        expect(wet.wetness[i], `inside px (${x},${y}): wetness must be zeroed`).toBe(0)
      }
    }
  })

  it('(ii) outside-bounds wet ALSO transfers (R3b) — the drift band lands at exactly 70 and is cleared, never stranded', () => {
    const { wet, dry } = runForceDryAll()
    for (const y of DRIFT_ROWS) {
      for (const x of DRIFT_COLS) {
        const i = y * W + x
        expect(
          dryAlphaAt(dry, x, y),
          `drift px (${x},${y}): dry alpha ${dryAlphaAt(dry, x, y)}, one look law expects ${EXPECTED_OUTSIDE_TRANSFER}`,
        ).toBe(EXPECTED_OUTSIDE_TRANSFER)
        expect(wet.alpha[i], `drift px (${x},${y}): wet must be cleared after transfer`).toBe(0)
      }
    }
    // Nothing anywhere may survive as stranded wet — that is the true hole.
    let stranded = 0
    for (let i = 0; i < SIZE; i++) if (wet.alpha[i] > 0) stranded++
    expect(stranded, `${stranded} wet pixel(s) survive forceDryAll — visible ones would read as true holes on getBakedCanvas`).toBe(0)
  })

  it("(iii) dry's gained alpha equals inside + outside transfer — no visible mass is unaccounted for", () => {
    const { dry } = runForceDryAll()
    let dryTotal = 0
    for (let i = 3; i < dry.length; i += 4) dryTotal += dry[i]
    const dryOutside = (() => {
      let sum = 0
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!isInside(x, y)) sum += dryAlphaAt(dry, x, y)
        }
      }
      return sum
    })()

    // Exact one-look-law numbers for the seeded grid:
    //   inside transfer  = 16 * 40 = 640
    //   outside transfer =  8 * 70 = 560 (this WAS the bbox loss)
    //   dry total        = 1200 — the whole visible mass lands
    expect(dryTotal, `dry gained ${dryTotal} alpha units, expected ${EXPECTED_DRY_GAIN}`).toBe(EXPECTED_DRY_GAIN)
    expect(dryOutside, `drift band gained ${dryOutside}, expected ${EXPECTED_OUTSIDE_GAIN} (R3b: it must land)`).toBe(EXPECTED_OUTSIDE_GAIN)
    expect(WET_TOTAL_ALPHA).toBe(12000)
    expect(WET_OUTSIDE_ALPHA).toBe(5600)
    // Literal pins — the law's constants, independent of the derivation.
    expect(EXPECTED_INSIDE_TRANSFER).toBe(40)
    expect(EXPECTED_OUTSIDE_TRANSFER).toBe(70)
    expect(EXPECTED_DRY_GAIN).toBe(1200)
    expect(EXPECTED_INSIDE_GAIN).toBe(640)
    expect(EXPECTED_OUTSIDE_GAIN).toBe(560)
    expect(WET_OUTSIDE_ALPHA / WET_TOTAL_ALPHA).toBeCloseTo(5600 / 12000, 10)
  })
})

// ---------------------------------------------------------------------------
// Paper-gap helper — unit-checked against compositor.ts's paperMod THROUGH
// wetDisplayAlpha (compositor is imported and read, never edited).
// ---------------------------------------------------------------------------

describe('260930-wm6 — bakeParityPaperMods under the one look law', () => {
  const SLOW_OPS = [0.4, 0.85]
  const PH_SAMPLES = [0, 0.3, 0.5, 0.7, 1]
  const ALPHA_SAMPLES = [40, 120, 300, 800, 1500]

  it('display mod equals wetDisplayAlpha(alpha, op, ph) / wetDisplayAlpha(alpha, op, 0) on the slow path', () => {
    for (const alpha of ALPHA_SAMPLES) {
      for (const op of SLOW_OPS) {
        const base = wetDisplayAlpha(alpha, op, 0)
        expect(base, `slow-path base alpha must be > 0 for alpha=${alpha} op=${op}`).toBeGreaterThan(0)
        for (const ph of PH_SAMPLES) {
          const withPaper = wetDisplayAlpha(alpha, op, ph)
          const helper = bakeParityPaperMods(alpha, op, ph, ph)
          expect(
            withPaper / base,
            `alpha=${alpha} op=${op} ph=${ph}: compositor paperMod ratio ${withPaper / base}, helper display ${helper.display}`,
          ).toBeCloseTo(helper.display, 10)
        }
      }
    }
  })

  it('display mod is exactly 1 for pixelOpacity >= 0.90 — the compositor fast path applies NO paper', () => {
    for (const alpha of ALPHA_SAMPLES) {
      for (const ph of PH_SAMPLES) {
        const base = wetDisplayAlpha(alpha, 1, 0)
        const withPaper = wetDisplayAlpha(alpha, 1, ph)
        expect(withPaper, `fast path must ignore paper (alpha=${alpha} ph=${ph})`).toBe(base)
        expect(bakeParityPaperMods(alpha, 1, ph, ph).display).toBe(1)
      }
    }
  })

  it('transfer mod IS the display law paper response — no carve (RED at base); forceDryAll parity mod stays 1', () => {
    // One look law: dryStep's paper response is wetDisplayAlpha's paper
    // response, byte-identical to display. toBeCloseTo: the ratio and the
    // direct paperMod form differ only in float noise.
    for (const alpha of ALPHA_SAMPLES) {
      for (const op of SLOW_OPS) {
        const base = wetDisplayAlpha(alpha, op, 0)
        expect(base, `slow-path base must be > 0 for alpha=${alpha} op=${op}`).toBeGreaterThan(0)
        for (const ph of PH_SAMPLES) {
          const expected = wetDisplayAlpha(alpha, op, ph) / base
          const helper = bakeParityPaperMods(alpha, op, ph, ph)
          expect(
            helper.transfer,
            `alpha=${alpha} op=${op} ph=${ph}: transfer mod ${helper.transfer}, display-law response ${expected}`,
          ).toBeCloseTo(expected, 10)
        }
        // No paper map: the transfer samples sampleH(null) = 0.5 — the
        // display baseline for a missing map, not 1.
        const noMap = wetDisplayAlpha(alpha, op, 0.5) / base
        expect(bakeParityPaperMods(alpha, op, 0.5, null).transfer).toBeCloseTo(noMap, 10)
      }
    }

    // Fast path (pixelOpacity >= 0.90): NO paper on the transfer either —
    // the carve used to fire here regardless of opacity.
    for (const ph of PH_SAMPLES) {
      expect(bakeParityPaperMods(300, 1, ph, ph).transfer).toBe(1)
      expect(bakeParityPaperMods(300, 1, ph, null).transfer).toBe(1)
      expect(
        bakeParityPaperMods(300, 1, ph, ph).forceDryAll,
        `forceDryAll parity mod stays 1 (ph=${ph})`,
      ).toBe(1)
    }
  })
})
