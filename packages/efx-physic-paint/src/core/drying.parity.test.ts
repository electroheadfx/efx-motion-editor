// ============================================================
//  260930-q6t Task 1 (RED) — bake parity: display law vs dry law
//
//  The wet display overlay renders through the Beer-Lambert
//  wetDisplayAlpha (render/compositor.ts:29-43) while the dry
//  transfer runs the linear /800 model (core/drying.ts:95/:127/:216,
//  forceDryAll without paper modulation). This file pins BOTH
//  current laws in pixels over one sample grid:
//
//    pin A (green at base) — forceDryAll transfers exactly
//      round(min(1, alpha/800) * pixelOpacity * 255)
//    pin B (green at base) — compositeWetLayer displays exactly
//      round(wetDisplayAlpha(alpha, pixelOpacity, paperHeight))
//    pin C (green at base) — the per-sample display-vs-dry alpha
//      delta clears the recorded floor, with direction recorded
//    parity target (RED at base) — forceDryAll's transferred alpha
//      equals the display alpha within 1 unit for EVERY sample:
//      "what you see is what persists" at leave/close
//
//  Sample grid: alpha {40,120,300,800,1500,2600} x pixelOpacity
//  {0.4, 0.85, 1.0} x paperHeight {0, 0.5, 1.0} = 54 samples.
//  No production file is edited for this pin.
// ============================================================

import { describe, expect, it } from 'vitest'
import { forceDryAll, initDryingLUT } from './drying'
import { compositeWetLayer, wetDisplayAlpha } from '../render/compositor'
import { createWetBuffers } from './wet-layer'
import { LUT_SIZE } from '../types'
import type { DryingLUT, SavedWetBuffers, WetBuffers } from '../types'

const ALPHAS = [40, 120, 300, 800, 1500, 2600]
const OPS = [0.4, 0.85, 1.0]
const PHS = [0, 0.5, 1.0]

interface Sample {
  alpha: number
  pixelOpacity: number
  paperHeight: number
  index: number
}

const SAMPLES: Sample[] = []
for (const alpha of ALPHAS) {
  for (const pixelOpacity of OPS) {
    for (const paperHeight of PHS) {
      SAMPLES.push({ alpha, pixelOpacity, paperHeight, index: SAMPLES.length })
    }
  }
}
const W = SAMPLES.length // 54
const H = 1

function makeWet(): WetBuffers {
  const wet = createWetBuffers(W * H)
  for (const s of SAMPLES) {
    wet.alpha[s.index] = s.alpha
    wet.strokeOpacity[s.index] = s.pixelOpacity
    wet.r[s.index] = 200
    wet.g[s.index] = 100
    wet.b[s.index] = 50
    wet.wetness[s.index] = 1
  }
  return wet
}

function makeDrying(): DryingLUT {
  const drying: DryingLUT = {
    dryLUT: new Float32Array(LUT_SIZE + 1),
    invLUT: new Float32Array(LUT_SIZE + 1),
    dryPos: new Float32Array(W * H),
  }
  initDryingLUT(drying.dryLUT, drying.invLUT)
  return drying
}

function makeSaved(): SavedWetBuffers {
  return {
    r: new Float32Array(W * H),
    g: new Float32Array(W * H),
    b: new Float32Array(W * H),
    alpha: new Float32Array(W * H),
    strokeOpacity: new Float32Array(W * H),
  }
}

/** Display-side bytes: what compositeWetLayer puts on an empty display buffer. */
function displayAlphas(): number[] {
  const wet = makeWet()
  let placed: { id: ImageData; x: number; y: number } | null = null
  const ctx = {
    createImageData: (w: number, h: number) =>
      ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as ImageData,
    putImageData: (id: ImageData, x: number, y: number) => {
      placed = { id, x, y }
    },
  } as unknown as CanvasRenderingContext2D
  compositeWetLayer(
    ctx,
    wet,
    W,
    H,
    (x, y) => SAMPLES[y * W + x].paperHeight,
  )
  expect(placed).not.toBeNull()
  const p = placed!
  return SAMPLES.map((s) => {
    const absX = s.index % W
    const absY = (s.index / W) | 0
    const local = (absY - p.y) * p.id.width + (absX - p.x)
    return p.id.data[local * 4 + 3]
  })
}

/** Dry-side bytes: what forceDryAll writes over an empty dry buffer. */
function dryAlphas(): number[] {
  const wet = makeWet()
  const data = new Uint8ClampedArray(W * H * 4)
  const ctx = {
    getImageData: (_x: number, _y: number, w: number, h: number) =>
      ({ width: w, height: h, data }),
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D
  forceDryAll(wet, makeSaved(), makeDrying(), ctx, W, H)
  return SAMPLES.map((s) => data[s.index * 4 + 3])
}

describe('260930-q6t bake parity — display law vs dry transfer law', () => {
  it('pin A: forceDryAll currently transfers via the /800 law (characterization, green at base)', () => {
    const dry = dryAlphas()
    for (const s of SAMPLES) {
      const expected = Math.round(Math.min(1, s.alpha / 800) * s.pixelOpacity * 255)
      expect(
        dry[s.index],
        `alpha=${s.alpha} op=${s.pixelOpacity}: forceDryAll transferred ${dry[s.index]}, /800 law expects ${expected}`,
      ).toBe(expected)
    }
  })

  it('pin B: compositeWetLayer currently displays via wetDisplayAlpha (characterization, green at base)', () => {
    const display = displayAlphas()
    for (const s of SAMPLES) {
      const expected = Math.round(wetDisplayAlpha(s.alpha, s.pixelOpacity, s.paperHeight))
      expect(
        display[s.index],
        `alpha=${s.alpha} op=${s.pixelOpacity} ph=${s.paperHeight}: display ${display[s.index]}, wetDisplayAlpha expects ${expected}`,
      ).toBe(expected)
    }
  })

  it('pin C: display-vs-dry alpha delta clears the recorded floor, direction recorded (green at base)', () => {
    const display = displayAlphas()
    const dry = dryAlphas()
    const deltas = SAMPLES.map((s) => display[s.index] - dry[s.index])
    const maxAbs = Math.max(...deltas.map((d) => Math.abs(d)))
    const dryDenser = deltas.filter((d) => d < 0).length
    const overOneUnit = deltas.filter((d) => Math.abs(d) > 1).length

    // Floors asserted FROM the measured values at base (see RED-EVIDENCE.json
    // for the per-sample table): max |delta| = 175, dry-denser in 47/54,
    // |delta| > 1 in 44/54.
    expect(maxAbs, `max |display-dry| delta was ${maxAbs}, floor 150`).toBeGreaterThanOrEqual(150)
    expect(dryDenser, `dry-denser samples ${dryDenser}/54, floor 40`).toBeGreaterThanOrEqual(40)
    expect(overOneUnit, `samples over 1 alpha unit ${overOneUnit}/54, floor 30`).toBeGreaterThanOrEqual(30)
  })

  it('parity target: forceDryAll transferred alpha equals display alpha within 1 unit for every sample (RED at base)', () => {
    const display = displayAlphas()
    const dry = dryAlphas()
    const mismatches: string[] = []
    for (const s of SAMPLES) {
      const d = display[s.index]
      const r = dry[s.index]
      if (Math.abs(d - r) > 1) {
        mismatches.push(
          `alpha=${s.alpha} op=${s.pixelOpacity} ph=${s.paperHeight}: display=${d} dry=${r} delta=${d - r}`,
        )
      }
    }
    expect(
      mismatches,
      `bake parity broken at base: ${mismatches.length}/54 samples differ by more than 1 alpha unit ` +
        `(dry transfer and display disagree) — first mismatches: ${mismatches.slice(0, 5).join('; ')}`,
    ).toEqual([])
  })
})
