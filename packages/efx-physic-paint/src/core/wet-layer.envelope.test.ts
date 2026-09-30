// ============================================================
//  Envelope-law contract pins (260930-dy0, R8 USER DESIGN ACT
//  2026-09-30 — SPECS/real-paint/01-brush-footprint.md).
//
//  The pressure-defined stroke thickness is the MAXIMUM thickness.
//  Spread redistributes mass inside the envelope; it never widens
//  the stroke. Three laws pinned here:
//   (1) featherWetEdges is boundary AA only — never an outward
//       grower (no EMPTY-pixel writes);
//   (2) projectWetIntoEnvelope is a HARD ceiling — solver growth
//       past the pre-solver envelope is renormalized back inside
//       (interior contrast rises, width does not);
//   (3) solver ticks / margin arithmetic stay byte-unchanged
//       (#144 organic look — never reduced to hold the envelope).
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createWetBuffers, featherWetEdges } from './wet-layer'
import * as wetLayerNs from './wet-layer'
import { spreadCurveFor } from './spreadScale'
import type { WetBuffers } from '../types'

const api = wetLayerNs as Record<string, unknown>

const W = 32
const H = 32
const FRAC = 0.35

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

function countOcc(s: string, needle: string): number {
  let n = 0
  let i = 0
  while ((i = s.indexOf(needle, i)) !== -1) {
    n++
    i += needle.length
  }
  return n
}

function nthIndex(s: string, needle: string, n: number): number {
  let i = -1
  for (let k = 0; k < n; k++) {
    i = s.indexOf(needle, i + 1)
    if (i === -1) return -1
  }
  return i
}

describe('envelope law (R8, 260930-dy0)', () => {
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

  it('projectWetIntoEnvelope: exported as a function', () => {
    expect(typeof api.projectWetIntoEnvelope).toBe('function')
  })

  it('renormalized: escaped mass is zeroed and conserved onto the interior', () => {
    expect(typeof api.projectWetIntoEnvelope).toBe('function')
    const project = api.projectWetIntoEnvelope as (w: WetBuffers, e: Float32Array) => void

    const setup = () => {
      const wet = makeBlob()
      const envelope = wet.alpha.slice()
      // Solver growth: three escaped pixels just outside the blob.
      wet.alpha[idx(9, 10)] = 300
      wet.wetness[idx(9, 10)] = 200
      wet.strokeOpacity[idx(9, 10)] = 0.4
      wet.alpha[idx(10, 9)] = 300
      wet.wetness[idx(10, 9)] = 200
      wet.strokeOpacity[idx(10, 9)] = 0.4
      wet.alpha[idx(8, 8)] = 500
      wet.wetness[idx(8, 8)] = 200
      wet.strokeOpacity[idx(8, 8)] = 0.4
      return { wet, envelope }
    }

    const a = setup()
    const beforeTotal = a.wet.alpha.reduce((s, v) => s + v, 0)
    let beforeInterior = 0
    for (let i = 0; i < W * H; i++) {
      if (a.envelope[i] > 1 && a.wet.alpha[i] > 1) beforeInterior += a.wet.alpha[i]
    }

    project(a.wet, a.envelope)

    for (const i of [idx(9, 10), idx(10, 9), idx(8, 8)]) {
      expect(a.wet.alpha[i]).toBe(0)
      expect(a.wet.wetness[i]).toBe(0)
      expect(a.wet.strokeOpacity[i]).toBe(0)
    }

    const afterTotal = a.wet.alpha.reduce((s, v) => s + v, 0)
    expect(Math.abs(afterTotal - beforeTotal) / beforeTotal).toBeLessThan(1e-3)

    let afterInterior = 0
    for (let i = 0; i < W * H; i++) {
      if (a.envelope[i] > 1 && a.wet.alpha[i] > 1) afterInterior += a.wet.alpha[i]
    }
    expect(afterInterior).toBeGreaterThan(beforeInterior)

    const b = setup()
    project(b.wet, b.envelope)
    expect(Array.from(a.wet.alpha)).toEqual(Array.from(b.wet.alpha))
    expect(Array.from(a.wet.wetness)).toEqual(Array.from(b.wet.wetness))
    expect(Array.from(a.wet.strokeOpacity)).toEqual(Array.from(b.wet.strokeOpacity))
  })

  it('identity: zero escape leaves every buffer byte-identical', () => {
    expect(typeof api.projectWetIntoEnvelope).toBe('function')
    const project = api.projectWetIntoEnvelope as (w: WetBuffers, e: Float32Array) => void

    const wet = makeBlob()
    const envelope = wet.alpha.slice()
    const before = snapshotBuffers(wet)

    project(wet, envelope)

    expect(Array.from(wet.alpha)).toEqual(Array.from(before.alpha))
    expect(Array.from(wet.r)).toEqual(Array.from(before.r))
    expect(Array.from(wet.g)).toEqual(Array.from(before.g))
    expect(Array.from(wet.b)).toEqual(Array.from(before.b))
    expect(Array.from(wet.wetness)).toEqual(Array.from(before.wetness))
    expect(Array.from(wet.strokeOpacity)).toEqual(Array.from(before.strokeOpacity))
  })

  it('engine-wired: snapshotWetAlpha( and projectWetIntoEnvelope( each called twice', () => {
    expect(countOcc(engineSrc, 'snapshotWetAlpha(')).toBe(2)
    expect(countOcc(engineSrc, 'projectWetIntoEnvelope(')).toBe(2)
  })

  it('snapshot-before: snapshot strictly before the solver, projection strictly after, at both sites', () => {
    const s1 = nthIndex(engineSrc, 'snapshotWetAlpha(', 1)
    const c1 = nthIndex(engineSrc, 'createLocalFluidPhysicsContinuation(', 1)
    const p1 = nthIndex(engineSrc, 'projectWetIntoEnvelope(', 1)
    const s2 = nthIndex(engineSrc, 'snapshotWetAlpha(', 2)
    const l1 = nthIndex(engineSrc, 'localFluidPhysicsStep(', 1)
    const p2 = nthIndex(engineSrc, 'projectWetIntoEnvelope(', 2)
    for (const v of [s1, c1, p1, s2, l1, p2]) expect(v).toBeGreaterThan(-1)
    expect(s1).toBeLessThan(c1)
    expect(c1).toBeLessThan(p1)
    expect(p1).toBeLessThan(s2)
    expect(s2).toBeLessThan(l1)
    expect(l1).toBeLessThan(p2)
  })

  it('ticks-unchanged: ceil(spreadCurve * 10) x2 — 3 at 60, 4 at 65, 1 at 50', () => {
    expect(countOcc(engineSrc, 'Math.ceil(spreadCurve * 10)')).toBe(2)
    expect(Math.max(1, Math.ceil(spreadCurveFor(60) * 10))).toBe(3)
    expect(Math.max(1, Math.ceil(spreadCurveFor(65) * 10))).toBe(4)
    expect(Math.max(1, Math.ceil(spreadCurveFor(50) * 10))).toBe(1)
  })

  it('margin-formula: compute-window expression byte-unchanged x2', () => {
    expect(countOcc(engineSrc, 'waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4')).toBe(2)
  })

  it('feather-wired: featherWetEdges( stays wired at both engine sites', () => {
    expect(countOcc(engineSrc, 'featherWetEdges(')).toBe(2)
  })
})
