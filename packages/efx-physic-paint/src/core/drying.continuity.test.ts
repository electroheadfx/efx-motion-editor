// ============================================================
//  260930-wm6 — one look law continuity pins (RED re-pin)
//
//  THE ONE LOOK LAW (non-negotiable): every wet-to-dry transfer
//  alpha is exactly
//      wetDisplayAlpha(alpha, pixelOpacity, sampleH(...)) / 255
//  from render/compositor.ts. No /800, no paper carve — paper
//  lives inside wetDisplayAlpha only.
//
//  Behavioral pins (re-pointed from the /800 characterization):
//    fractional step  — exactly the telescoping f-delta
//                       f(before) − f(after), f = wda/255
//    full-dry step    — exactly the f(alpha) byte
//    paper            — modulates ONLY through the display law:
//                       pixelOpacity >= 0.90 ignores it entirely,
//                       below it follows wetDisplayAlpha exactly
//
//  Kill-list source pins (RED at base — the symbols exist):
//    drying.ts        — no /800 transfer literals, no carve clamp,
//                       wetDisplayAlpha is the transfer law
//    EfxPaintEngine.ts — no natural-drying entry points, no quiet
//                       constant, no drying interval, no drySpeed
//                       control surface (dies with GREEN B)
//
//  Harness is H=2: sampleH clamps iy to height−2, so a 1-row grid
//  with a non-null paper map would read row −1 (NaN). Row 1 carries
//  paper only — its wet alpha stays 0 so dryStep skips it.
// ============================================================

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { dryStep, forceDryAll, initDryingLUT } from './drying'
import { wetDisplayAlpha } from '../render/compositor'
import { createWetBuffers } from './wet-layer'
import { LUT_SIZE } from '../types'
import type { DryingLUT, SavedWetBuffers, WetBuffers } from '../types'

const W = 8
const H = 2
const SIZE = W * H
const DRY_SPEED = 40
/** Baseline paper unit sampleH(null, …) returns — the no-map display height. */
const NO_MAP_PH = 0.5

interface Harness {
  wet: WetBuffers
  drying: DryingLUT
  df: number
  data: Uint8ClampedArray
  ctx: CanvasRenderingContext2D
}

function harness(): Harness {
  const wet = createWetBuffers(SIZE)
  wet.strokeOpacity.fill(1)
  const drying: DryingLUT = {
    dryLUT: new Float32Array(LUT_SIZE + 1),
    invLUT: new Float32Array(LUT_SIZE + 1),
    dryPos: new Float32Array(SIZE),
  }
  initDryingLUT(drying.dryLUT, drying.invLUT)
  // One dryStep from dryPos 0 advances to DRY_SPEED; the LUT-driven fraction
  // delta for that step is exactly dryLUT[DRY_SPEED] (prevFrac = dryLUT[0] = 0).
  const df = drying.dryLUT[DRY_SPEED]
  const data = new Uint8ClampedArray(SIZE * 4)
  const ctx = {
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data }),
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D
  return { wet, drying, df, data, ctx }
}

/** One look law, scaled 0..1 — the ONLY transfer law. */
function f(alpha: number, op: number, ph: number): number {
  return wetDisplayAlpha(alpha, op, ph) / 255
}

/**
 * Alpha whose one-step fractional transfer lands closest to saTarget under
 * the one look law (f is monotone then saturates — scan the rising branch).
 */
function alphaFor(saTarget: number, df: number, op = 1, ph = NO_MAP_PH): number {
  let best = 0
  let bestErr = Infinity
  for (let a = 1; a <= 8000; a++) {
    const delta = f(a, op, ph) - f(a - a * df, op, ph)
    const err = Math.abs(delta - saTarget)
    if (err < bestErr) {
      bestErr = err
      best = a
    }
    if (delta >= saTarget) break
  }
  return best
}

/**
 * Bytes dryStep's fractional branch must write over an EMPTY dry base:
 * oa = sa (ma = 0), byte = round(sa · 255), sa = f(before) − f(after).
 */
function expectedStepBytes(alpha: number, op: number, ph: number, df: number): number {
  const drain = alpha * df
  const sa = f(alpha, op, ph) - f(alpha - drain, op, ph)
  return Math.round(Math.min(1, sa) * 255)
}

function saved(): SavedWetBuffers {
  return {
    r: new Float32Array(SIZE), g: new Float32Array(SIZE), b: new Float32Array(SIZE),
    alpha: new Float32Array(SIZE), strokeOpacity: new Float32Array(SIZE),
  }
}

describe('260930-wm6 one look law — dryStep/forceDryAll transfer pins', () => {
  it('fractional step writes exactly the telescoping f-delta over an empty dry base', () => {
    const h = harness()

    // px0: sub-old-gate residue; px1/px2: larger loads — all op 1, no paper map.
    h.wet.alpha[0] = alphaFor(0.004, h.df)
    h.wet.alpha[1] = alphaFor(0.02, h.df)
    h.wet.alpha[2] = alphaFor(0.05, h.df)
    const before = [h.wet.alpha[0], h.wet.alpha[1], h.wet.alpha[2]]
    expect(before[0]).toBeGreaterThan(0)

    dryStep(h.wet, h.drying, h.ctx, W, H, DRY_SPEED, null)

    for (let px = 0; px <= 2; px++) {
      const expected = expectedStepBytes(before[px], 1, NO_MAP_PH, h.df)
      expect(
        h.data[px * 4 + 3],
        `px${px} alpha=${before[px]}: transferred byte ${h.data[px * 4 + 3]}, ` +
          `one look law expects ${expected}`,
      ).toBe(expected)
      // ... while the wet side drained by exactly the LUT fraction.
      const drain = before[px] * h.df
      expect(h.wet.alpha[px]).toBeCloseTo(before[px] - drain, 10)
    }

    // Strictly monotone in the seeded load — sub-gate residue still transfers.
    expect(h.data[3]).toBeGreaterThan(0)
    expect(h.data[7]).toBeGreaterThan(h.data[3])
    expect(h.data[11]).toBeGreaterThan(h.data[7])
  })

  it('full-dry step writes exactly the wetDisplayAlpha byte', () => {
    const h = harness()
    h.wet.alpha[0] = 400; h.wet.strokeOpacity[0] = 1
    h.wet.alpha[1] = 400; h.wet.strokeOpacity[1] = 0.85
    h.wet.alpha[2] = 1500; h.wet.strokeOpacity[2] = 0.4
    // Push the dry clock to the end so this step takes the full-dry branch.
    h.drying.dryPos[0] = LUT_SIZE - 1
    h.drying.dryPos[1] = LUT_SIZE - 1
    h.drying.dryPos[2] = LUT_SIZE - 1

    dryStep(h.wet, h.drying, h.ctx, W, H, DRY_SPEED, null)

    const cases = [
      { px: 0, alpha: 400, op: 1 },
      { px: 1, alpha: 400, op: 0.85 },
      { px: 2, alpha: 1500, op: 0.4 },
    ]
    for (const c of cases) {
      const expected = Math.round(wetDisplayAlpha(c.alpha, c.op, NO_MAP_PH))
      expect(
        h.data[c.px * 4 + 3],
        `full-dry alpha=${c.alpha} op=${c.op}: byte ${h.data[c.px * 4 + 3]}, ` +
          `wetDisplayAlpha expects ${expected}`,
      ).toBe(expected)
      expect(h.wet.alpha[c.px], `px${c.px} wet must be fully drained`).toBe(0)
    }
  })

  it('paper reaches the transfer only through wetDisplayAlpha — carve-free, fast path ignores it', () => {
    const runWith = (paper: Float32Array | null) => {
      const h = harness()
      h.wet.alpha[0] = 400; h.wet.strokeOpacity[0] = 1 // fast path
      h.wet.alpha[1] = 400; h.wet.strokeOpacity[1] = 0.85 // slow path
      // Filled map samples 1 at every integer pixel; null samples NO_MAP_PH.
      const ph = paper ? 1 : NO_MAP_PH
      const expFast = expectedStepBytes(400, 1, ph, h.df)
      const expSlow = expectedStepBytes(400, 0.85, ph, h.df)
      dryStep(h.wet, h.drying, h.ctx, W, H, DRY_SPEED, paper)
      return { fast: h.data[3], slow: h.data[7], expFast, expSlow }
    }

    const paper = new Float32Array(SIZE).fill(1)
    const withPaper = runWith(paper)
    const noPaper = runWith(null)

    // Fast path (pixelOpacity >= 0.90): paper does not modulate at all.
    expect(withPaper.fast).toBe(noPaper.fast)
    expect(withPaper.fast).toBe(withPaper.expFast)
    expect(noPaper.fast).toBe(noPaper.expFast)

    // Slow path: both sides equal the display-law response, and they differ.
    expect(withPaper.slow).toBe(withPaper.expSlow)
    expect(noPaper.slow).toBe(noPaper.expSlow)
    expect(withPaper.slow).not.toBe(noPaper.slow)
  })

  it('forceDryAll transfers exactly the wetDisplayAlpha byte — the finalize law', () => {
    const h = harness()
    h.wet.alpha[0] = 400; h.wet.strokeOpacity[0] = 1
    h.wet.alpha[1] = 400; h.wet.strokeOpacity[1] = 0.85
    h.wet.alpha[2] = 40; h.wet.strokeOpacity[2] = 1 // light residue still lands

    forceDryAll(h.wet, saved(), h.drying, h.ctx, W, H, null)

    const cases = [
      { px: 0, alpha: 400, op: 1 },
      { px: 1, alpha: 400, op: 0.85 },
      { px: 2, alpha: 40, op: 1 },
    ]
    for (const c of cases) {
      const expected = Math.round(wetDisplayAlpha(c.alpha, c.op, NO_MAP_PH))
      expect(
        h.data[c.px * 4 + 3],
        `forceDryAll alpha=${c.alpha} op=${c.op}: byte ${h.data[c.px * 4 + 3]}, ` +
          `one look law expects ${expected}`,
      ).toBe(expected)
      expect(h.wet.alpha[c.px], `px${c.px} wet must be zeroed`).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Kill list — source shape. The drying file goes green with GREEN A; the
// engine file stays red until GREEN B kills the cooking window.
// ---------------------------------------------------------------------------

const dryingSource = readFileSync(new URL('./drying.ts', import.meta.url), 'utf8')
const engineSource = readFileSync(new URL('../engine/EfxPaintEngine.ts', import.meta.url), 'utf8')

describe('260930-wm6 kill list — source shape', () => {
  it('drying.ts: one look law only — wetDisplayAlpha in, /800 and carve out, dry-state cutoff stays', () => {
    expect(dryingSource).toContain('const DRY_ALPHA_THRESHOLD = 1')
    expect(dryingSource).toContain('wetDisplayAlpha')
    expect(dryingSource).not.toContain('/800')
    expect(dryingSource).not.toContain('/ 800')
    expect(dryingSource).not.toContain('1.4 - ')
    expect(dryingSource).not.toContain('0.3, 1.4')
    expect(dryingSource).not.toContain('pixelOpacity < 0.99')
    expect(dryingSource).not.toContain('sa > 0.005')
    expect(dryingSource).not.toContain('drawBristleTraces')
    expect(dryingSource).not.toContain('Math.random')
  })

  it('EfxPaintEngine.ts: the cooking window control surface is gone', () => {
    expect(engineSource).not.toContain('startNaturalDrying')
    expect(engineSource).not.toContain('stopNaturalDrying')
    expect(engineSource).not.toContain('DRYING_QUIET_MS')
    expect(engineSource).not.toContain('dryingInterval')
    expect(engineSource).not.toContain('setDrySpeed')
    expect(engineSource).not.toContain('drySpeed')
  })
})
