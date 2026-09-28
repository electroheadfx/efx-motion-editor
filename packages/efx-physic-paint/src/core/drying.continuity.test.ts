import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { dryStep, forceDryAll, initDryingLUT } from './drying'
import { createWetBuffers } from './wet-layer'
import { LUT_SIZE } from '../types'
import type { DryingLUT, SavedWetBuffers, WetBuffers } from '../types'

// 260928-dh1 — dryStep de-hardcut pins (PLAN Task 2 <behavior>).
//
//   1. a pixel with sa just below 0.005 still transfers proportionally —
//      no zero-transfer-while-draining cliff (base: the `sa > 0.005` gate
//      drops the residue without transfer -> RED)
//   2. the `pixelOpacity < 0.99` on/off discontinuity is absent from the
//      paper-modulation curve; the multiplier applies continuously
//      (base: 0.98 modulated, 0.99/1.0 not -> RED)
//   3. forceDryAll carries the same continuous transfer
//   4. source shape: DRY_ALPHA_THRESHOLD stays the dry-state cutoff, the
//      transfer gates and the 0.99 discontinuity are gone, and dryStep
//      contains no trace generator (single-generator law)
//
// Modulation is CONTINUOUS and multiplicative everywhere in this path.

const W = 8
const H = 1
const SIZE = W * H
const DRY_SPEED = 40

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
  // delta for that step is exactly dryLUT[DRY_SPEED] (prevPos = 0).
  const df = drying.dryLUT[DRY_SPEED]
  const data = new Uint8ClampedArray(SIZE * 4)
  const ctx = {
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data }),
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D
  return { wet, drying, df, data, ctx }
}

/** wet.alpha that yields sa = saTarget for this step (sa = alpha*df/800*op). */
function alphaFor(saTarget: number, df: number, op = 1): number {
  return (saTarget * 800) / (df * op)
}

function saved(): SavedWetBuffers {
  return {
    r: new Float32Array(SIZE), g: new Float32Array(SIZE), b: new Float32Array(SIZE),
    alpha: new Float32Array(SIZE), strokeOpacity: new Float32Array(SIZE),
  }
}

const dryingSource = readFileSync(new URL('./drying.ts', import.meta.url), 'utf8')

describe('260928-dh1 drying continuity — no hard transfer cutoffs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('sa just below 0.005 transfers proportionally instead of draining without transfer', () => {
    const h = harness()

    // px0: bare canvas, sa = 0.004 (below the base 0.005 gate).
    h.wet.alpha[0] = alphaFor(0.004, h.df)
    // px1 / px2: partially-covered canvas (alpha 128), sa = 0.002 / 0.004 —
    // transferred COLOR must scale with sa.
    h.wet.alpha[1] = alphaFor(0.002, h.df)
    h.wet.r[1] = 250
    h.data[1 * 4 + 3] = 128
    h.wet.alpha[2] = alphaFor(0.004, h.df)
    h.wet.r[2] = 250
    h.data[2 * 4 + 3] = 128

    const alphaBefore = h.wet.alpha[0]
    dryStep(h.wet, h.drying, h.ctx, W, H, DRY_SPEED, null)

    // px0: sub-gate sa transferred at all (base: 0 -> RED).
    expect(h.data[3]).toBeGreaterThan(0)
    // ... while the wet side drained (the base had drain WITHOUT transfer).
    expect(h.wet.alpha[0]).toBeLessThan(alphaBefore)

    // px1/px2: proportional and strictly monotone in sa (base: both 0 -> RED).
    expect(h.data[4]).toBeGreaterThan(0)
    expect(h.data[8]).toBeGreaterThan(h.data[4])
  })

  it('paper modulation is continuous across pixelOpacity 0.99 and still applies at full opacity', () => {
    const withPaper = (paperHeight: Float32Array | null): number[] => {
      const h = harness()
      const ops = [0.98, 0.99, 1.0]
      ops.forEach((op, i) => {
        h.wet.alpha[i] = alphaFor(0.02, h.df)
        h.wet.r[i] = 250
        h.wet.strokeOpacity[i] = op
        h.data[i * 4 + 3] = 128
      })
      dryStep(h.wet, h.drying, h.ctx, W, H, DRY_SPEED, paperHeight)
      return [h.data[0], h.data[4], h.data[8]]
    }

    const paper = new Float32Array(SIZE).fill(1) // multiplier = clamp(1.4 - 0.8) = 0.6
    const [r98, r99, r100] = withPaper(paper)

    // The multiplier now applies at every opacity — the 0.99 boundary is gone
    // (base: 0.98 modulated, 0.99/1.0 not -> RED).
    expect(r99).toBe(r98)
    expect(r100).toBe(r99)

    // Control: the multiplier is still applied (not deleted) — full-opacity
    // transfer with paper is lighter than without paper.
    const [rNoPaper] = withPaper(null)
    expect(r100).toBeLessThan(rNoPaper)
  })

  it('forceDryAll also transfers sa below 0.005 (gate removed everywhere)', () => {
    const h = harness()
    h.wet.alpha[0] = 0.004 * 800 // sa = min(1, alpha/800) * op = 0.004
    h.data[3] = 0

    forceDryAll(h.wet, saved(), h.drying, h.ctx, W, H)

    expect(h.data[3]).toBeGreaterThan(0)
  })

  it('source shape: dry-state cutoff stays, hard transfer gates and the 0.99 discontinuity are gone, no trace generator in dryStep', () => {
    expect(dryingSource).toContain('const DRY_ALPHA_THRESHOLD = 1')
    expect(dryingSource).not.toContain('pixelOpacity < 0.99')
    expect(dryingSource).not.toContain('sa > 0.005')
    expect(dryingSource).not.toContain('drawBristleTraces')
    expect(dryingSource).not.toContain('Math.random')
  })
})
