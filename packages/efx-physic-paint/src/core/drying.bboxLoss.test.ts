// ============================================================
//  260930-wm6 re-pin — forceDryAll bbox-loss proof under the
//  ONE LOOK LAW
//
//  Transfer alpha = wetDisplayAlpha(alpha, pixelOpacity,
//  sampleH(...)) / 255 — the display law is the ONLY transfer
//  law (no /800, no carve). The bbox-loss mechanism proof is
//  unchanged; only the expected bytes moved to the new law.
//
//  Physics-drifted wet sitting OUTSIDE `dryRegionForStroke` is
//  never touched by the bbox-clamped forceDryAll (core/drying.ts
//  loops only bx0..bx1 / by0..by1), so it stays wet until the
//  engine clears on leave/close and is then destroyed.
//
//  This file is the deterministic mechanism proof:
//    (i)   wet mass INSIDE bounds transfers to dry
//    (ii)  wet mass OUTSIDE bounds does NOT transfer and stays in
//          the wet buffer
//    (iii) dry's gained alpha equals EXACTLY the inside-bbox
//          transferred alpha — the outside mass is unaccounted for
//
//  Seeded grid (W=20 x H=10), op 1 = display fast path (paper
//  ignored; the forceDryAll call passes paper = null):
//    inside  (cols 6..9, rows 3..6): 16 px @ alpha 400
//      -> per-px transfer round(wetDisplayAlpha(400, 1, ·)) = 40
//      -> dry gained total 16 * 40 = 640
//    drift   (cols 10..11, rows 3..6): 8 px @ alpha 700
//      -> stranded wet 8 * 700 = 5600 alpha units
//      -> would-be transfer if bbox were full-frame:
//         8 * round(wetDisplayAlpha(700, 1, ·)) = 8 * 70 = 560
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
const EXPECTED_DRY_GAIN = INSIDE_PX * EXPECTED_INSIDE_TRANSFER // 640
const EXPECTED_WOULD_BE_OUTSIDE_TRANSFER =
  OUTSIDE_PX * Math.round(wetDisplayAlpha(OUTSIDE_ALPHA, OPACITY, 0.5)) // 560

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

describe('260930-q6t Addendum B — forceDryAll drops wet mass outside its bounds', () => {
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

  it('(ii) outside-bounds wet does NOT transfer: dry stays 0 and the wet buffer keeps the full drifted mass', () => {
    const { wet, dry } = runForceDryAll()
    let outsideAlphaAfter = 0
    let outsidePixelsWithMass = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (isInside(x, y)) continue
        const i = y * W + x
        expect(dryAlphaAt(dry, x, y), `outside px (${x},${y}): dry gained ${dryAlphaAt(dry, x, y)}, expected 0`).toBe(0)
        if (wet.alpha[i] > 0) {
          outsidePixelsWithMass++
          outsideAlphaAfter += wet.alpha[i]
        }
      }
    }
    expect(
      outsidePixelsWithMass,
      `drift pixels still wet after forceDryAll: ${outsidePixelsWithMass}, seeded ${OUTSIDE_PX}`,
    ).toBe(OUTSIDE_PX)
    expect(
      outsideAlphaAfter,
      `wet alpha stranded outside bounds after forceDryAll: ${outsideAlphaAfter}, seeded ${WET_OUTSIDE_ALPHA}`,
    ).toBe(WET_OUTSIDE_ALPHA)
    // The adjacent drift rows kept their exact seeded alpha — no partial drain.
    for (const y of DRIFT_ROWS) {
      for (const x of DRIFT_COLS) {
        expect(wet.alpha[y * W + x], `drift px (${x},${y}) must keep alpha ${OUTSIDE_ALPHA}`).toBe(OUTSIDE_ALPHA)
      }
    }
  })

  it("(iii) dry's gained alpha equals exactly the inside-bbox transferred alpha — outside mass is unaccounted for", () => {
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
    //   inside transferred per px = 40, dry gained total = 640
    //   wet total before = 12000, wet outside = 5600 (46.67%)
    //   would-be outside transfer (full-frame bbox) = 560
    expect(dryTotal, `dry gained ${dryTotal} alpha units, expected ${EXPECTED_DRY_GAIN}`).toBe(EXPECTED_DRY_GAIN)
    expect(dryOutside, `dry outside-bbox gained ${dryOutside}, expected 0 (outside mass unaccounted)`).toBe(0)
    expect(WET_TOTAL_ALPHA).toBe(12000)
    expect(WET_OUTSIDE_ALPHA).toBe(5600)
    // Literal pins — the law's constants, independent of the derivation.
    expect(EXPECTED_INSIDE_TRANSFER).toBe(40)
    expect(EXPECTED_DRY_GAIN).toBe(640)
    expect(EXPECTED_WOULD_BE_OUTSIDE_TRANSFER).toBe(560)
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
