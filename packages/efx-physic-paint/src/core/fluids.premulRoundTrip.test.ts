// ============================================================
//  260928-dh1 lever 1 (revised) — premultiply round-trip pin
//
//  MEASURE FIRST, before a line of fix code. The four-seam run
//  named the torn halo at post-display. The display mapping is
//  exonerated (compositor.displayMapping.test.ts P3/P6: clean in
//  -> clean out at po=1.0). The lever is now the copy-in /
//  copy-back premultiply round-trip in fluids.ts, TWICE (the
//  fluidPhysicsStep twin at :541-561 and the local continuation
//  twin at :745-751).
//
//  Two claimed defects in those ~20 lines:
//    D1  invA = 1/a is a noise amplifier — differential a/premul
//        fluctuations blow up and clamp at 0/255.
//    D2  if (a > 0.5) is a hard per-pixel branch — below the line
//        r/g/b and strokeOpacity stay STALE while wet.alpha is
//        written, so the fringe becomes advected scattered alpha
//        + leftover colour/opacity = parasitic pixels.
//
//  This file feeds a clean ramp + a controlled low-density fringe
//  with a small a wobble through copy-in -> copy-back with
//  advection SKIPPED (identity / dt = 0). If that alone produces
//  isolatedPx / tornEdge / bodyHardJumps where the input had none,
//  the round-trip is proven as the creator with zero physics
//  involved. If the pin comes back clean, STOP and report.
//
//  The current copy-back is INLINED here (not imported) so the pin
//  measures the behaviour under change without touching production
//  first. The fix replaces this with one shared recovery routine.
// ============================================================

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IX, advect, recoverWetFromPremultiplied } from './fluids'
import { wetDisplayAlpha } from '../render/compositor'
import { computeDefectMetrics } from '../../../../app/src/components/physic-paint/performance/depositSpeckleCapture'

const fluidsSource = readFileSync(join(__dirname, 'fluids.ts'), 'utf8')

const W = 32
const H = 12
const GW = W + 2
const GH = H + 2
const GRID = GW * GH

interface Wet {
  alpha: Float32Array
  r: Float32Array
  g: Float32Array
  b: Float32Array
  wetness: Float32Array
  strokeOpacity: Float32Array
}

function makeWet(): Wet {
  const size = W * H
  return {
    alpha: new Float32Array(size),
    r: new Float32Array(size),
    g: new Float32Array(size),
    b: new Float32Array(size),
    wetness: new Float32Array(size),
    strokeOpacity: new Float32Array(size),
  }
}

/**
 * copy-in -> copy-back through the SHARED recovery routine
 * (recoverWetFromPremultiplied), with advection replaced by identity.
 * `wobbleA` optionally perturbs stamA after copy-in to model what
 * advection's independent bilinear interpolation does to the alpha
 * channel (the "small a wobble").
 */
function roundTrip(
  wet: Wet,
  opts: {
    wobbleA?: (a: number, x: number, y: number) => number
    premulWobble?: (p: number, x: number, y: number) => number
  } = {},
): void {
  const stamRA = new Float32Array(GRID)
  const stamGA = new Float32Array(GRID)
  const stamBA = new Float32Array(GRID)
  const stamA = new Float32Array(GRID)
  const stamSO = new Float32Array(GRID)
  const stamW = new Float32Array(GRID)

  // --- copy-in (premultiply)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ci = y * W + x
      const si = IX(W, x + 1, y + 1)
      const a = wet.alpha[ci]
      stamRA[si] = wet.r[ci] * a
      stamGA[si] = wet.g[ci] * a
      stamBA[si] = wet.b[ci] * a
      stamA[si] = a
      stamW[si] = wet.wetness[ci]
      stamSO[si] = wet.strokeOpacity[ci] * a
    }
  }

  // --- advection SKIPPED (identity / dt = 0). Optional channel wobble
  // stands in for advection's independent per-channel bilinear noise.
  if (opts.wobbleA || opts.premulWobble) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const si = IX(W, x + 1, y + 1)
        if (opts.wobbleA) stamA[si] = opts.wobbleA(stamA[si], x, y)
        if (opts.premulWobble) {
          stamRA[si] = opts.premulWobble(stamRA[si], x, y)
          stamGA[si] = opts.premulWobble(stamGA[si], x, y)
          stamBA[si] = opts.premulWobble(stamBA[si], x, y)
          stamSO[si] = opts.premulWobble(stamSO[si], x, y)
        }
      }
    }
  }

  // --- copy-back through the shared recovery seam (the fix)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ci = y * W + x
      const si = IX(W, x + 1, y + 1)
      recoverWetFromPremultiplied(
        wet, ci,
        stamA[si],
        stamRA[si], stamGA[si], stamBA[si],
        stamSO[si], stamW[si],
      )
    }
  }
}

/** Display-alpha plane — what the user actually sees (po=1 linear branch). */
function displayPlane(wet: Wet): { alpha: Uint8Array; width: number; height: number } {
  const out = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const d = wetDisplayAlpha(wet.alpha[i], wet.strokeOpacity[i], 0)
    out[i] = Math.max(0, Math.min(255, Math.round(d)))
  }
  return { alpha: out, width: W, height: H }
}

/** strokeOpacity plane (0..1 -> 0..255) — the 0.90-branch trigger. */
function soPlane(wet: Wet): { alpha: Uint8Array; width: number; height: number } {
  const out = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    out[i] = Math.max(0, Math.min(255, Math.round(wet.strokeOpacity[i] * 255)))
  }
  return { alpha: out, width: W, height: H }
}

/**
 * Controlled low-density fringe with a small a wobble.
 * Body: a solid rectangle at wet.alpha = 2882 (one 245 layer).
 * Fringe: a one-pixel skirt around the body whose a wobbles across
 * the 0.5 recovery line (0.2 .. 1.0) AND across real fringe densities
 * (80 .. 400), deterministic (no RNG).
 */
function buildField(): Wet {
  const wet = makeWet()
  const x0 = 6, x1 = 25, y0 = 3, y1 = 8
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x
      wet.alpha[i] = 2882
      wet.r[i] = 40
      wet.g[i] = 30
      wet.b[i] = 20
      wet.strokeOpacity[i] = 1
    }
  }
  // One-pixel skirt. a wobbles across the 0.5 line and through the
  // realistic fringe band. The wobble is the "controlled low-density
  // fringe with a small a wobble" of the measure-first entry.
  const skirt: Array<[number, number, number]> = []
  for (let x = x0; x <= x1; x++) {
    skirt.push([x, y0 - 1, 0.3 + (x % 5) * 0.1])          // 0.3 0.4 0.5 0.6 0.7
    skirt.push([x, y1 + 1, 80 + (x % 4) * 60])            // 80 140 200 260
  }
  for (let y = y0; y <= y1; y++) {
    skirt.push([x0 - 1, y, 0.2 + (y % 3) * 0.15])         // 0.2 0.35 0.5
    skirt.push([x1 + 1, y, 400 - (y % 3) * 100])          // 400 300 200
  }
  for (const [x, y, a] of skirt) {
    const i = y * W + x
    wet.alpha[i] = a
    wet.r[i] = 40
    wet.g[i] = 30
    wet.b[i] = 20
    wet.strokeOpacity[i] = 1
  }
  return wet
}

function snapshot(wet: Wet) {
  return {
    display: computeDefectMetrics(displayPlane(wet).alpha, W, H),
    so: computeDefectMetrics(soPlane(wet).alpha, W, H),
  }
}

// ============================================================

describe('premul round-trip pin (advection SKIPPED / dt = 0)', () => {
  it('R1 — pure identity round-trip on the wobbled fringe: input == output', () => {
    // The null hypothesis. copy-in -> copy-back with no channel wobble
    // must preserve the field. ε = 0.01 makes identity exact for every
    // visible pixel (a >= 0.2); the vanishing tail is allowed to soften.
    const wet = buildField()
    const rIn = Array.from(wet.r)
    const soIn = Array.from(wet.strokeOpacity)
    const aIn = Array.from(wet.alpha)
    roundTrip(wet)
    for (let i = 0; i < W * H; i++) {
      if (aIn[i] < 0.2) continue
      expect(wet.r[i], `r[${i}] ${rIn[i]} -> ${wet.r[i]}`).toBeCloseTo(rIn[i], 0)
      expect(wet.strokeOpacity[i], `so[${i}]`).toBeCloseTo(soIn[i], 1)
    }
  })

  it('R2 — FIXED: no stale colour/opacity below the old 0.5 line (D2 gone)', () => {
    // The measure-first (RED) showed the old `if (a > 0.5)` left r=40 /
    // so=1 STALE on the a=0.4 pixel while the a=0.6 neighbour recovered
    // to a clamped 255 — a 215-unit parasitic colour pair. The shared
    // recovery must write BOTH pixels, so no pixel keeps pre-advection
    // colour beside freshly-written alpha.
    const wet = makeWet()
    const iA = 5 * W + 10 // lands at a = 0.4 (was below the line)
    const iB = 5 * W + 11 // lands at a = 0.6 (was above the line)
    for (const i of [iA, iB]) {
      wet.alpha[i] = 2882
      wet.r[i] = 40
      wet.strokeOpacity[i] = 1
    }
    roundTrip(wet, {
      wobbleA: (_a, x, y) => {
        const i = y * W + x
        if (i === iA) return 0.4
        if (i === iB) return 0.6
        return 0
      },
    })
    // BOTH pixels are written (alpha follows the wobble) ...
    expect(wet.alpha[iA]).toBeCloseTo(0.4, 5)
    expect(wet.alpha[iB]).toBeCloseTo(0.6, 5)
    // ... and NEITHER keeps the raw pre-advection body values untouched
    // as a stale pair beside its new alpha. The recovery must run on both
    // sides of the old line.
    //
    // With consistent premul (r*a = 40*2882) and a collapsed to 0.4/0.6,
    // the soft denominator bounds the blow-up: both land in the same
    // clamped regime instead of disagreeing by 215.
    expect(wet.r[iA]).toBe(wet.r[iB])
    expect(wet.strokeOpacity[iA]).toBe(wet.strokeOpacity[iB])
  })

  it('R3 — FIXED: moderate a wobble never clamps colour to 0/255 speckle', () => {
    // The old `1/a` amplifier turned a sharp a collapse into clamped
    // 0/255 colour speckle. The shared recovery must keep recovered
    // colour strictly inside (0, 255) for a moderate wobble — no
    // clamped speckle, and every pixel written (no stale pair).
    const wet = buildField()
    const rIn = Array.from(wet.r)
    roundTrip(wet, {
      wobbleA: (a, x, y) => {
        if (a <= 0) return 0
        // 30% collapse on alternating pixels — a bilinear backtrace
        // landing off a sharp density edge.
        return (x + y) % 2 === 0 ? a * 0.7 : a
      },
    })
    let clamped = 0
    let maxShift = 0
    for (let i = 0; i < W * H; i++) {
      if (rIn[i] !== 40) continue
      if (wet.r[i] >= 255 || wet.r[i] <= 0) clamped++
      maxShift = Math.max(maxShift, Math.abs(wet.r[i] - 40))
    }
    // HARD PIN — no clamp speckle on a 30% a-wobble. A shift is the
    // 1/a gain; a clamp is the D1 defect and is forbidden.
    expect(clamped, `clamped=${clamped} maxShift=${maxShift}`).toBe(0)
  })

  it('R5 — source shape: the a > 0.5 branch is gone, one recovery seam serves both twins', () => {
    expect(fluidsSource).not.toContain('if (a > 0.5)')
    expect(fluidsSource).not.toContain('invA = 1.0 / a')
    expect(fluidsSource).toContain('export function recoverWetFromPremultiplied')
    // Both copy-back loops call the shared seam — the 260925-iy6 one-seam shape.
    const callSites = fluidsSource.split('recoverWetFromPremultiplied(').length - 1
    // 1 definition + 2 call sites (export is the definition's own text)
    expect(callSites).toBeGreaterThanOrEqual(3)
  })

  it('R4 — dt=0 advect is identity (so R2/R3 are pure round-trip, not physics)', () => {
    // Guards the premise of this whole file: skipping advection really
    // is a no-op, so any defect above is copy-in/copy-back.
    const W2 = 8, H2 = 4
    const gw = new Float32Array((W2 + 2) * (H2 + 2))
    const src = new Float32Array((W2 + 2) * (H2 + 2))
    for (let j = 1; j <= H2; j++) {
      for (let i = 1; i <= W2; i++) {
        src[IX(W2, i, j)] = i * 10 + j
        gw[IX(W2, i, j)] = 0
      }
    }
    const u = new Float32Array((W2 + 2) * (H2 + 2))
    const v = new Float32Array((W2 + 2) * (H2 + 2))
    // Even with a live velocity field, dt=0 cannot move anything.
    for (let k = 0; k < u.length; k++) { u[k] = 1; v[k] = 1 }
    advect(W2, H2, 0, gw, src, u, v, 0)
    for (let j = 1; j <= H2; j++) {
      for (let i = 1; i <= W2; i++) {
        expect(gw[IX(W2, i, j)]).toBeCloseTo(src[IX(W2, i, j)], 5)
      }
    }
  })
})
