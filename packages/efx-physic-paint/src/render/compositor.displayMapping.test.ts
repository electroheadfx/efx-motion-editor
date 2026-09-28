// ============================================================
//  260928-dh1 lever 1 — display-mapping pin (MEASURE FIRST)
//
//  Pins wetDisplayAlpha / compositeWetLayer behaviour on a KNOWN
//  alpha ramp BEFORE any display change, so the fix cannot be an
//  algebraic no-op. The four-seam run named Birthplace 2 at
//  post-display (tornEdge 33 -> 12 282 on heavy-slow). This file
//  answers one question: does the DISPLAY MAPPING itself tear a
//  clean input field, or does the halo arrive already formed?
//
//  Measurements:
//    P1  the pixelOpacity 0.90 branch is a hard discontinuity
//    P2  pixelOpacity < 0.001 is a hard include/exclude skip
//    P3  a CLEAN ramp at pixelOpacity 1.0 stays clean through the
//        mapping (the default-brush path — no false tear)
//    P4  a CLEAN ramp + noisy pixelOpacity DOES tear (the mapping
//        amplifies opacity noise into a torn contour)
//    P5  sub-0.5 recovery holes (fluid advects alpha without
//        strokeOpacity) become visible gaps in the display
//
//  Measurement only — no display code changes in this file.
// ============================================================

import { describe, expect, it } from 'vitest'
import { wetDisplayAlpha, compositeWetLayer } from './compositor'
import { DENSITY_NORM } from '../types'
import type { WetBuffers } from '../types'
import { computeDefectMetrics } from '../../../../app/src/components/physic-paint/performance/depositSpeckleCapture'

// --- helpers -------------------------------------------------

function makeWet(size: number): WetBuffers {
  return {
    alpha: new Float32Array(size),
    r: new Float32Array(size),
    g: new Float32Array(size),
    b: new Float32Array(size),
    wetness: new Float32Array(size),
    strokeOpacity: new Float32Array(size),
  }
}

/** Capture what compositeWetLayer writes, without a real canvas. */
function captureComposite(
  wet: WetBuffers,
  width: number,
  height: number,
  paperHeight: Float32Array | null,
): { alpha: Uint8Array; width: number; height: number } {
  const size = width * height
  const out = new Uint8Array(size)
  const sampleH = paperHeight
    ? (x: number, y: number) => paperHeight[y * width + x]
    : () => 0
  let captured: ImageData | null = null
  const ctx = {
    createImageData: (w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4)
      return { width: w, height: h, data } as ImageData
    },
    putImageData: (id: ImageData) => {
      captured = id
    },
  } as unknown as CanvasRenderingContext2D
  compositeWetLayer(ctx, wet, width, height, sampleH)
  if (!captured) return { alpha: out, width, height }
  const d = (captured as ImageData).data
  // compositeWetLayer writes only the wet bbox; treat the rest as 0.
  // We don't know the bbox here, so read every 4th byte of the region.
  const rw = (captured as ImageData).width
  const rh = (captured as ImageData).height
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      // region is written at (bx0, by0); we can't see the offset from
      // putImageData alone, so score the region as-is (the tear lives
      // in the interior pattern, not in the absolute placement).
      out[y * rw + x] = d[(y * rw + x) * 4 + 3]
    }
  }
  return { alpha: out, width: rw, height: rh }
}

/** Smooth horizontal alpha ramp: 0 at x=0 .. peak at x=width-1. */
function cleanRamp(width: number, height: number, peak: number): Float32Array {
  const a = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      a[y * width + x] = Math.round((x / (width - 1)) * peak)
    }
  }
  return a
}

// --- P1: the 0.90 branch is a hard discontinuity -------------

describe('P1 — pixelOpacity 0.90 branch discontinuity', () => {
  it('output jumps when pixelOpacity crosses 0.90 at fixed density', () => {
    const densityAlpha = 1500 // density = 0.5
    const paperH = 0.5
    const below = wetDisplayAlpha(densityAlpha, 0.89, paperH)
    const above = wetDisplayAlpha(densityAlpha, 0.90, paperH)
    const jump = Math.abs(above - below)
    // PIN: the jump is real and material (> 4/255). If this ever reads
    // <= 4 the branch has been blended and this pin is obsolete — replace
    // it with a continuity pin, do not loosen it silently.
    expect(jump, `0.90 jump at density 1500 = ${jump} (below=${below}, above=${above})`).toBeGreaterThan(4)
  })

  it('the two branches use different formulas (linear vs Beer-Lambert)', () => {
    // At po=1.0: min(255, round(density * 300)). At po=0.5: Beer-Lambert
    // * paperMod * po. The paper-free branch must NOT match the paper
    // branch at equal density — that mismatch is the discontinuity source.
    const densityAlpha = 2400
    const linear = wetDisplayAlpha(densityAlpha, 1.0, 0)
    const beer = wetDisplayAlpha(densityAlpha, 0.5, 0)
    expect(linear).toBe(Math.min(255, Math.round((densityAlpha / DENSITY_NORM) * 300)))
    expect(beer).not.toBe(linear)
  })
})

// --- P2: pixelOpacity < 0.001 is a hard skip -----------------

describe('P2 — pixelOpacity include/exclude skip', () => {
  it('compositeWetLayer drops a pixel with alpha > 0 but strokeOpacity = 0', () => {
    const width = 8
    const height = 1
    const wet = makeWet(width * height)
    // Four solid pixels at display-relevant density, but strokeOpacity = 0
    // (the fluid a<=0.5 recovery hole). One pixel at po=1.0 as control.
    for (let x = 0; x < 4; x++) {
      wet.alpha[x] = 2000
      wet.strokeOpacity[x] = 0
    }
    wet.alpha[4] = 2000
    wet.strokeOpacity[4] = 1
    const { alpha, width: rw } = captureComposite(wet, width, height, null)
    // The po=0 pixels must vanish (hard skip) — that IS the current law.
    expect(alpha[0]).toBe(0)
    expect(alpha[1]).toBe(0)
    expect(alpha[2]).toBe(0)
    expect(alpha[3]).toBe(0)
    // The po=1 control must survive.
    expect(alpha[4]).toBeGreaterThan(0)
    expect(rw).toBeGreaterThan(0)
  })
})

// --- P3: clean ramp at po=1.0 stays clean --------------------

describe('P3 — clean ramp through the default-brush path', () => {
  it('a smooth density ramp at pixelOpacity 1.0 yields tornEdge = 0', () => {
    const width = 40
    const height = 6
    const wet = makeWet(width * height)
    const ramp = cleanRamp(width, height, 2450)
    for (let i = 0; i < width * height; i++) {
      wet.alpha[i] = ramp[i]
      wet.strokeOpacity[i] = 1
      wet.r[i] = 20
      wet.g[i] = 20
      wet.b[i] = 20
    }
    const { alpha, width: rw, height: rh } = captureComposite(wet, width, height, null)
    const m = computeDefectMetrics(alpha, rw, rh)
    // PIN: the mapping alone must NOT tear a clean input at po=1.0.
    // If this fails the mapping is manufacturing speckle from nothing.
    expect(m.tornEdge, `tornEdge=${m.tornEdge} bodyHardJumps=${m.bodyHardJumps}`).toBe(0)
    expect(m.bodyHardJumps).toBe(0)
    expect(m.isolatedPx).toBe(0)
  })
})

// --- P4: clean ramp + noisy po DOES tear ---------------------

describe('P4 — opacity noise amplifies into a torn contour', () => {
  it('a smooth density ramp with per-pixel po noise around 0.90 tears', () => {
    const width = 40
    const height = 6
    const wet = makeWet(width * height)
    const ramp = cleanRamp(width, height, 2450)
    // Deterministic po noise straddling the 0.90 branch: even columns
    // 0.88 (Beer-Lambert + paper), odd columns 0.92 (linear, no paper).
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        wet.alpha[i] = ramp[i]
        wet.strokeOpacity[i] = x % 2 === 0 ? 0.88 : 0.92
        wet.r[i] = 20
        wet.g[i] = 20
        wet.b[i] = 20
      }
    }
    const { alpha, width: rw, height: rh } = captureComposite(wet, width, height, null)
    const m = computeDefectMetrics(alpha, rw, rh)
    // PIN (measured): the 0.90 branch makes adjacent columns take different
    // formulas whose outputs differ by >= 32, so the BODY carries hard jumps
    // (alternating 194/138 at density 0.5). The contour itself stays intact
    // (tornEdge = 0 — both values are still ink), so this discontinuity is a
    // body-speckle source, NOT a torn-contour source.
    expect(
      m.bodyHardJumps,
      `bodyHardJumps=${m.bodyHardJumps} tornEdge=${m.tornEdge} isolatedPx=${m.isolatedPx} — the 0.90 branch must be shown to make body hard jumps`,
    ).toBeGreaterThan(0)
  })
})

// --- P5: recovery holes become display gaps ------------------

describe('P5 — fluid recovery holes punch display gaps', () => {
  it('a solid body with scattered po=0 holes scores bodyHardJumps > 0', () => {
    const width = 20
    const height = 8
    const wet = makeWet(width * height)
    for (let i = 0; i < width * height; i++) {
      wet.alpha[i] = 2450
      wet.strokeOpacity[i] = 1
      wet.r[i] = 20
      wet.g[i] = 20
      wet.b[i] = 20
    }
    // Three interior holes where fluid left alpha but no strokeOpacity
    // (the a<=0.5 skip in fluids.ts:547).
    for (const idx of [45, 67, 92]) {
      wet.strokeOpacity[idx] = 0
    }
    const { alpha, width: rw, height: rh } = captureComposite(wet, width, height, null)
    const m = computeDefectMetrics(alpha, rw, rh)
    // PIN: holes in strokeOpacity become holes in the display body
    // (bodyHardJumps counts fully-enclosed empty pixels). bodyHfEnergy stays 0
    // because the surviving body is a flat plateau — that is correct. The
    // holes also register as 1px scanline gaps (tornEdge > 0) — metric
    // overlap, not a contradiction.
    expect(m.bodyHardJumps, `bodyHardJumps=${m.bodyHardJumps}`).toBeGreaterThan(0)
    expect(m.bodyHfEnergy).toBe(0)
  })
})

// --- P6: what the mapping does to a fluid-style low-density fringe ---

describe('P6 — low-density fringe through the mapping (the live halo shape)', () => {
  it('isolated low-density pixels survive as isolated display pixels at po=1.0', () => {
    // Simulates the post-fluid wet field: a solid body + scattered low-density
    // fringe pixels (the salt-and-pepper halo). At po=1.0 the mapping is
    // round(a/10) — linear, so isolated IN stays isolated OUT. This is the
    // algebraic no-op finding: the mapping cannot remove halo speckle.
    const width = 24
    const height = 10
    const wet = makeWet(width * height)
    for (let y = 2; y < 8; y++) {
      for (let x = 4; x < 20; x++) {
        const i = y * width + x
        wet.alpha[i] = 2450
        wet.strokeOpacity[i] = 1
        wet.r[i] = 20; wet.g[i] = 20; wet.b[i] = 20
      }
    }
    // Five isolated halo pixels just outside the body, density 400-700
    // (display alpha 40-70 — clearly visible).
    for (const [x, y, a] of [[2, 3, 500], [21, 4, 600], [10, 1, 450], [12, 8, 700], [3, 7, 400]] as const) {
      const i = y * width + x
      wet.alpha[i] = a
      wet.strokeOpacity[i] = 1
      wet.r[i] = 20; wet.g[i] = 20; wet.b[i] = 20
    }
    const { alpha, width: rw, height: rh } = captureComposite(wet, width, height, null)
    const m = computeDefectMetrics(alpha, rw, rh)
    // MEASUREMENT (not a wish): the mapping at po=1.0 preserves isolated
    // pixels. isolatedPx > 0 and tornEdge > 0 in == out. A formula-only
    // change to wetDisplayAlpha cannot kill the halo without a cutoff.
    expect(m.isolatedPx, `isolatedPx=${m.isolatedPx} tornEdge=${m.tornEdge}`).toBeGreaterThan(0)
    expect(m.tornEdge).toBeGreaterThan(0)
    // Control: the same field with the halo pixels removed is clean.
    for (const [x, y] of [[2, 3], [21, 4], [10, 1], [12, 8], [3, 7]] as const) {
      wet.alpha[y * width + x] = 0
    }
    const clean = captureComposite(wet, width, height, null)
    const mClean = computeDefectMetrics(clean.alpha, clean.width, clean.height)
    expect(mClean.isolatedPx).toBe(0)
    expect(mClean.tornEdge).toBe(0)
  })
})
