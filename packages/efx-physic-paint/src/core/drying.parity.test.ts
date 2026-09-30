// ============================================================
//  260930-wm6 Task 1 (RED) — the one look law, byte-for-byte
//
//  THE ONE LOOK LAW (non-negotiable): at every wet-to-dry transfer
//  the transfer alpha must be exactly
//      wetDisplayAlpha(alpha, pixelOpacity,
//                      sampleH(paperHeight, x, y, w, h)) / 255
//  from render/compositor.ts (fast path included). No /800, no
//  separate paper carve, no third law. WYSIWYG by construction.
//
//  This file pins BOTH sides over one sample grid:
//
//    pin B (green at base) — compositeWetLayer displays exactly
//      round(wetDisplayAlpha(alpha, pixelOpacity, paperHeight)):
//      the display law is pinned as-is.
//    one-look-law target (RED at base) — forceDryAll's transferred
//      dry byte over an empty dry base equals the compositeWetLayer
//      display byte EXACTLY for every sample. Fails at base because
//      forceDryAll transfers through the linear /800 model and has
//      no paper input at all.
//
//  The old /800 characterization pin and the old divergence-floor
//  pin are DELETED — they pinned the dying law and would be a
//  second competing parity target. Parity is the ONLY parity target
//  in the suite.
//
//  Sample grid: alpha {40,120,300,800,1500,2600} x pixelOpacity
//  {0.4, 0.85, 1.0} x paperHeight {0, 0.5, 1.0} = 54 samples on
//  row 0 of a H=2 grid — sampleH clamps iy to height-2, so a
//  1-row grid with a non-null paper map would read row -1 (NaN).
//  Row 1 carries paper only (its wet alpha stays 0).
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
const H = 2 // row 0 = samples, row 1 = paper carrier (see header)

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

/** Paper map over both rows — row 1 mirrors row 0 so sampleH's bilinear tap stays finite. */
function makePaper(): Float32Array {
  const paper = new Float32Array(W * H)
  for (const s of SAMPLES) {
    paper[s.index] = s.paperHeight
    paper[W + s.index] = s.paperHeight
  }
  return paper
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
    // Row 1 mirrors row 0 (only row 0 holds wet, so this is the
    // carrier row — kept sample-exact for safety).
    (x, y) => SAMPLES[(y * W + x) % W].paperHeight,
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

/**
 * Dry-side bytes: what forceDryAll writes over an empty dry buffer.
 *
 * GREEN A call form: the paper map joins the signature right after
 * height — the same map the display samples, so both sides read
 * identical paper units through the one look law.
 */
function dryAlphas(): number[] {
  const wet = makeWet()
  const data = new Uint8ClampedArray(W * H * 4)
  const ctx = {
    getImageData: (_x: number, _y: number, w: number, h: number) =>
      ({ width: w, height: h, data }),
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D
  forceDryAll(wet, makeSaved(), makeDrying(), ctx, W, H, makePaper())
  return SAMPLES.map((s) => data[s.index * 4 + 3])
}

describe('260930-wm6 one look law — display law vs dry transfer law', () => {
  it('pin B: compositeWetLayer displays exactly wetDisplayAlpha(alpha, op, ph) (green at base)', () => {
    const display = displayAlphas()
    for (const s of SAMPLES) {
      const expected = Math.round(wetDisplayAlpha(s.alpha, s.pixelOpacity, s.paperHeight))
      expect(
        display[s.index],
        `alpha=${s.alpha} op=${s.pixelOpacity} ph=${s.paperHeight}: display ${display[s.index]}, wetDisplayAlpha expects ${expected}`,
      ).toBe(expected)
    }
  })

  it('one-look-law target: forceDryAll transferred byte equals the display byte EXACTLY for every sample (RED at base)', () => {
    const display = displayAlphas()
    const dry = dryAlphas()
    for (const s of SAMPLES) {
      const d = display[s.index]
      const r = dry[s.index]
      expect(
        r,
        `alpha=${s.alpha} op=${s.pixelOpacity} ph=${s.paperHeight}: forceDryAll transferred byte ${r}, ` +
          `display byte ${d} — the one look law (wetDisplayAlpha) must be the ONLY transfer law`,
      ).toBe(d)
    }
  })
})
