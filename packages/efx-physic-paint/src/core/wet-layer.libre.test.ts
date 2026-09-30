// ============================================================
//  Free-physics contract pins (R8 revised 2026-09-30c —
//  260930-libre "physique-libre".
//  SPECS/real-paint/01-brush-footprint.md).
//
//  PHYSICS ON A REDUCED CLONE, NO MASKING.
//  The physics clone (size × (1 - g)) is the ONLY deposit the
//  solver sees; the solver runs UNCONSTRAINED — its outward
//  transport IS the edge physics. The original stroke (pressure
//  geometry, 8c thickness field) is preserved as the gesture
//  record and ignored by physics.
//   (1) ZERO masking — snapshotWetAlpha / projectWetIntoEnvelope
//       / stampRibbonIntoEnvelope are deleted with their pins;
//       never clip to the deposit, never clip to the ribbon;
//   (2) depositRoom is the ONE look lever: g(0) = 0 (spread 0
//       reads pressure width), g(spreadCurveFor(65)) ≈ 0.5
//       ("2x thinner", à estimer), g never exceeds 0.5;
//   (3) featherWetEdges stays boundary-AA only (the solver
//       supplies the organic edge);
//   (4) margin arithmetic stays byte-unchanged; the solver tick law
//       moved to spreadScale.physicsTicks (R9 2026-09-30d: tick floor
//       3 — a look lever scales amplitude, never presence; the count
//       is never reduced to hold a width).
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createWetBuffers, featherWetEdges } from './wet-layer'
import * as wetLayerNs from './wet-layer'
import * as spreadScaleNs from './spreadScale'
import type { WetBuffers } from '../types'

const api = wetLayerNs as Record<string, unknown>
const spreadApi = spreadScaleNs as Record<string, unknown>
const spreadCurveFor = spreadScaleNs.spreadCurveFor

const W = 32
const H = 32

function idx(x: number, y: number): number {
  return y * W + x
}

function fillRect(
  wet: WetBuffers,
  x0: number, y0: number, x1: number, y1: number,
  a: number, r: number, g: number, b: number, wetness: number, so: number,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = idx(x, y)
      wet.alpha[i] = a
      wet.r[i] = r
      wet.g[i] = g
      wet.b[i] = b
      wet.wetness[i] = wetness
      wet.strokeOpacity[i] = so
    }
  }
}

function makeBlob(): WetBuffers {
  const wet = createWetBuffers(W * H)
  fillRect(wet, 10, 10, 21, 21, 1000, 200, 200, 200, 500, 0.8)
  return wet
}

function snapshotBuffers(wet: WetBuffers): {
  alpha: Float32Array; r: Float32Array; g: Float32Array
  b: Float32Array; wetness: Float32Array; strokeOpacity: Float32Array
} {
  return {
    alpha: wet.alpha.slice(),
    r: wet.r.slice(),
    g: wet.g.slice(),
    b: wet.b.slice(),
    wetness: wet.wetness.slice(),
    strokeOpacity: wet.strokeOpacity.slice(),
  }
}

const engineSrc = readFileSync(
  new URL('../engine/EfxPaintEngine.ts', import.meta.url),
  'utf8',
)
const wetLayerSrc = readFileSync(
  new URL('./wet-layer.ts', import.meta.url),
  'utf8',
)

function countOcc(s: string, needle: string): number {
  let n = 0
  let i = 0
  while ((i = s.indexOf(needle, i)) !== -1) {
    n++
    i += needle.length
  }
  return n
}

describe('free physics (R8 revised — reduced clone, no masking, 260930-libre)', () => {
  // --- kept law: feather is boundary AA only (the solver owns the organic edge) ---

  it('feather-empty-pixels: featherWetEdges never writes a pre-empty pixel (all six buffers)', () => {
    const wet = makeBlob()
    const emptyIdx: number[] = []
    for (let i = 0; i < W * H; i++) if (wet.alpha[i] <= 1) emptyIdx.push(i)
    const before = snapshotBuffers(wet)

    featherWetEdges(wet, { x0: 1, y0: 1, x1: 30, y1: 30 }, W, H, 6)

    for (const i of emptyIdx) {
      expect(wet.alpha[i]).toBe(before.alpha[i])
      expect(wet.r[i]).toBe(before.r[i])
      expect(wet.g[i]).toBe(before.g[i])
      expect(wet.b[i]).toBe(before.b[i])
      expect(wet.wetness[i]).toBe(before.wetness[i])
      expect(wet.strokeOpacity[i]).toBe(before.strokeOpacity[i])
    }
  })

  it('boundary-aa: feather blends painted boundary alpha down; deep interior untouched', () => {
    const wet = makeBlob()

    featherWetEdges(wet, { x0: 1, y0: 1, x1: 30, y1: 30 }, W, H, 6)

    // (10,10) is a painted corner with two empty orthogonal neighbors.
    // Uniform blob -> mean4 < 1000 -> the frac blend strictly decreases alpha.
    expect(wet.alpha[idx(10, 10)]).toBeLessThan(1000)
    // (16,16) has four painted neighbors — boundary AA must not touch it.
    expect(wet.alpha[idx(16, 16)]).toBe(1000)
  })

  // --- zero masking (the masking helpers are DELETED) ---

  it('helpers-deleted: snapshotWetAlpha / projectWetIntoEnvelope / stampRibbonIntoEnvelope are gone', () => {
    expect(typeof api.snapshotWetAlpha).toBe('undefined')
    expect(typeof api.projectWetIntoEnvelope).toBe('undefined')
    expect(typeof api.stampRibbonIntoEnvelope).toBe('undefined')
    expect(countOcc(wetLayerSrc, 'snapshotWetAlpha')).toBe(0)
    expect(countOcc(wetLayerSrc, 'projectWetIntoEnvelope')).toBe(0)
    expect(countOcc(wetLayerSrc, 'stampRibbonIntoEnvelope')).toBe(0)
  })

  it('engine-zero-mask: zero references to the masking helpers at the engine (imports included)', () => {
    expect(countOcc(engineSrc, 'snapshotWetAlpha')).toBe(0)
    expect(countOcc(engineSrc, 'projectWetIntoEnvelope')).toBe(0)
    expect(countOcc(engineSrc, 'stampRibbonIntoEnvelope')).toBe(0)
  })

  it('envelope-gone: the engine carries no envelope state, local, or comment', () => {
    expect(countOcc(engineSrc, 'envelope')).toBe(0)
  })

  // --- the look lever (depositRoom) ---

  it('room-lever-2x: g(0) = 0; g(sc65) ≈ 0.5 (2x thinner, à estimer); g never exceeds 0.5', () => {
    expect(typeof spreadApi.depositRoom).toBe('function')
    const g = spreadApi.depositRoom as (sc: number) => number
    expect(g(0)).toBe(0)
    expect(g(spreadCurveFor(65))).toBeCloseTo(0.5, 6)
    expect(g(1)).toBeLessThanOrEqual(0.5)
    expect(g(0.5)).toBeLessThanOrEqual(0.5)
  })

  // --- engine wiring ---

  it('deposit-is-reduced-clone: size: depositR at both tier=final sites (D-07 — one deposit feeds wet/physics)', () => {
    expect(countOcc(engineSrc, 'size: depositR')).toBe(2)
  })

  it('engine-room-lever: depositRoom( called twice (one deposit reduction per site)', () => {
    expect(countOcc(engineSrc, 'depositRoom(')).toBe(2)
  })

  it('solver-wired: both local solvers run — nothing wraps or follows them (unconstrained)', () => {
    expect(countOcc(engineSrc, 'createLocalFluidPhysicsContinuation(')).toBe(1)
    expect(countOcc(engineSrc, 'localFluidPhysicsStep(')).toBe(1)
  })

  // --- kept law: the #144 organic look (ticks / margin / feather) ---

  it('ticks-law-wired: physicsTicks( x2 at the engine — the tick law lives in spreadScale (R9, one lever, one place)', () => {
    expect(countOcc(engineSrc, 'physicsTicks(')).toBe(2)
    expect(countOcc(engineSrc, 'Math.ceil(spreadCurve * 10)')).toBe(0)
  })

  it('margin-formula: compute-window expression byte-unchanged x2', () => {
    expect(countOcc(engineSrc, 'waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4')).toBe(2)
  })

  it('feather-wired: featherWetEdges( stays wired at both engine sites', () => {
    expect(countOcc(engineSrc, 'featherWetEdges(')).toBe(2)
  })
})
