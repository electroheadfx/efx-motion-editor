// ============================================================
//  260930-q6t Addendum B (B1) — forceDryAll bbox-loss proof
//
//  Task 1 refuted the /800-vs-Beer-Lambert premise (dry transfer
//  is denser than display on 44/54 samples, never lighter — a
//  transfer that only increases alpha cannot lighten anything).
//  The prime suspect is now LOST MASS: physics-drifted wet sitting
//  OUTSIDE `dryRegionForStroke` is never touched by the bbox-
//  clamped forceDryAll (core/drying.ts:197-240 loops only bx0..bx1
//  / by0..by1), so it stays wet until the engine clears on
//  leave/close and is then destroyed.
//
//  This file is the deterministic mechanism proof:
//    (i)   wet mass INSIDE bounds transfers to dry
//    (ii)  wet mass OUTSIDE bounds does NOT transfer and stays in
//          the wet buffer
//    (iii) dry's gained alpha equals EXACTLY the inside-bbox
//          transferred alpha — the outside mass is unaccounted for
//
//  Seeded grid (W=20 x H=10):
//    inside  (cols 6..9, rows 3..6): 16 px @ alpha 400, op 1
//      -> per-px transfer round(min(1,400/800)*1*255) = 128
//      -> dry gained total 16 * 128 = 2048
//    drift   (cols 10..11, rows 3..6): 8 px @ alpha 700, op 1
//      -> stranded wet 8 * 700 = 5600 alpha units
//      -> would-be transfer if bbox were full-frame:
//         8 * round(700/800*255) = 8 * 223 = 1784
//    wet total before = 16*400 + 8*700 = 12000 (outside = 46.67%)
//
//  (A second describe block, added with the instrumentation commit,
//  unit-checks the paper-gap pure helper bakeParityPaperMods against
//  compositor.ts's paperMod through wetDisplayAlpha — compositor is
//  imported and read, NEVER edited.)
// ============================================================

import { describe, expect, it } from 'vitest'
import { forceDryAll, initDryingLUT } from './drying'
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

// /800 law for the seeded alphas (characterized by drying.parity.test.ts pin A).
const EXPECTED_INSIDE_TRANSFER = Math.round(Math.min(1, INSIDE_ALPHA / 800) * OPACITY * 255) // 128
const EXPECTED_DRY_GAIN = INSIDE_PX * EXPECTED_INSIDE_TRANSFER // 2048
const EXPECTED_WOULD_BE_OUTSIDE_TRANSFER =
  OUTSIDE_PX * Math.round(Math.min(1, OUTSIDE_ALPHA / 800) * OPACITY * 255) // 1784

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

/** One forceDryAll run over the seeded buffers with the narrow bounds. */
function runForceDryAll(): RunResult {
  const wet = makeWet()
  const dry = new Uint8ClampedArray(SIZE * 4)
  const ctx = makeDryCtx(dry)
  forceDryAll(wet, makeSaved(), makeDrying(), ctx, W, H, undefined, 'bbox-loss', { ...BOUNDS })
  return { wet, dry }
}

function dryAlphaAt(dry: Uint8ClampedArray, x: number, y: number): number {
  return dry[(y * W + x) * 4 + 3]
}

describe('260930-q6t Addendum B — forceDryAll drops wet mass outside its bounds', () => {
  it('(i) inside-bounds wet transfers to dry: every inside px lands at exactly 128 and its wet alpha is zeroed', () => {
    const { wet, dry } = runForceDryAll()
    for (let y = BOUNDS.y0; y <= BOUNDS.y1; y++) {
      for (let x = BOUNDS.x0; x <= BOUNDS.x1; x++) {
        const i = y * W + x
        expect(
          dryAlphaAt(dry, x, y),
          `inside px (${x},${y}): dry alpha ${dryAlphaAt(dry, x, y)}, /800 law expects ${EXPECTED_INSIDE_TRANSFER}`,
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

    // Exact numbers recorded for 260930-q6t-MEASURE-EVIDENCE.json:
    //   inside transferred per px = 128, dry gained total = 2048
    //   wet total before = 12000, wet outside = 5600 (46.67%)
    //   would-be outside transfer (full-frame bbox) = 1784
    expect(dryTotal, `dry gained ${dryTotal} alpha units, expected ${EXPECTED_DRY_GAIN}`).toBe(EXPECTED_DRY_GAIN)
    expect(dryOutside, `dry outside-bbox gained ${dryOutside}, expected 0 (outside mass unaccounted)`).toBe(0)
    expect(WET_TOTAL_ALPHA).toBe(12000)
    expect(WET_OUTSIDE_ALPHA).toBe(5600)
    expect(EXPECTED_DRY_GAIN).toBe(2048)
    expect(EXPECTED_WOULD_BE_OUTSIDE_TRANSFER).toBe(1784)
    expect(WET_OUTSIDE_ALPHA / WET_TOTAL_ALPHA).toBeCloseTo(5600 / 12000, 10)
  })
})
