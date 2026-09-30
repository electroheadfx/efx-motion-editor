// ============================================================
//  Envelope-law contract pins (R8 revised 2026-09-30b —
//  260930-espace "enveloppe-espace".
//  SPECS/real-paint/01-brush-footprint.md).
//
//  THE ENVELOPE IS A ROOM, NOT A CLIP.
//  The pressure-defined stroke thickness is the MAXIMUM thickness.
//  The envelope is the GEOMETRIC pressure ribbon (ribbonWithScales at
//  FULL pressure width) — a room the solver fills from a REDUCED
//  deposit. Clip ONLY past the ribbon (rare), NEVER to the deposit.
//   (1) featherWetEdges is boundary AA only — never an outward grower
//       (no EMPTY-pixel writes);
//   (2) projectWetIntoEnvelope is a HARD ceiling past the ROOM — mass
//       the solver carried INTO the room survives (that transport IS
//       the look); mass past the ribbon is renormalized back inside
//       (interior contrast rises, width does not);
//   (3) solver ticks / margin arithmetic stay byte-unchanged
//       (#144 organic look — never reduced to hold the envelope).
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

/** Mark a square room (the pressure-ribbon stand-in) inside an envelope mask. */
function markRoom(envelope: Float32Array, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) envelope[idx(x, y)] = 2
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

describe('envelope law (R8 revised — the room, 260930-espace)', () => {
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

  // --- the room contract (the anti-dy0 pins) ---

  it('never-clip-to-deposit: mass the solver carried INTO the room survives (that transport IS the look)', () => {
    expect(typeof api.projectWetIntoEnvelope).toBe('function')
    const project = api.projectWetIntoEnvelope as (w: WetBuffers, e: Float32Array) => void

    const wet = makeBlob() // deposit at 10..21
    const envelope = wet.alpha.slice()
    // The pressure ribbon is LARGER than the deposit — 8..23 is the room.
    markRoom(envelope, 8, 8, 23, 23)
    // Solver growth in the room: between the deposit edge and the ribbon.
    wet.alpha[idx(9, 10)] = 300
    wet.wetness[idx(9, 10)] = 200
    wet.strokeOpacity[idx(9, 10)] = 0.4

    project(wet, envelope)

    // MUST survive. Zeroing it is the 260930-dy0 regression.
    expect(wet.alpha[idx(9, 10)]).toBe(300)
    expect(wet.wetness[idx(9, 10)]).toBe(200)
    expect(wet.strokeOpacity[idx(9, 10)]).toBeCloseTo(0.4, 6)
  })

  it('clip-past-ribbon: mass past the pressure ribbon is clipped (rare)', () => {
    expect(typeof api.projectWetIntoEnvelope).toBe('function')
    const project = api.projectWetIntoEnvelope as (w: WetBuffers, e: Float32Array) => void

    const wet = makeBlob()
    const envelope = wet.alpha.slice()
    markRoom(envelope, 8, 8, 23, 23)
    // Growth PAST the ribbon.
    wet.alpha[idx(5, 5)] = 300
    wet.wetness[idx(5, 5)] = 200
    wet.strokeOpacity[idx(5, 5)] = 0.4

    project(wet, envelope)

    expect(wet.alpha[idx(5, 5)]).toBe(0)
    expect(wet.wetness[idx(5, 5)]).toBe(0)
    expect(wet.strokeOpacity[idx(5, 5)]).toBe(0)
  })

  it('existing-mass-kept: pre-solver mass outside the ribbon is grandfathered (union), not clipped', () => {
    expect(typeof api.projectWetIntoEnvelope).toBe('function')
    const project = api.projectWetIntoEnvelope as (w: WetBuffers, e: Float32Array) => void

    const wet = createWetBuffers(W * H)
    // An earlier stroke's wet mass, far outside this stroke's ribbon.
    wet.alpha[idx(2, 2)] = 1000
    wet.wetness[idx(2, 2)] = 500
    wet.strokeOpacity[idx(2, 2)] = 0.8
    // envelope = union(pre-solver mass, ribbon): the snapshot grandfathers (2,2).
    const envelope = wet.alpha.slice()
    markRoom(envelope, 8, 8, 23, 23)

    project(wet, envelope)

    expect(wet.alpha[idx(2, 2)]).toBe(1000)
    expect(wet.wetness[idx(2, 2)]).toBe(500)
    expect(wet.strokeOpacity[idx(2, 2)]).toBeCloseTo(0.8, 6)
  })

  // --- the room mechanism (new code) ---

  it('stampRibbonIntoEnvelope: exported as a function', () => {
    expect(typeof api.stampRibbonIntoEnvelope).toBe('function')
  })

  it('stamp-marks-ribbon: nonzero fill marks the ribbon interior, leaves the outside', () => {
    expect(typeof api.stampRibbonIntoEnvelope).toBe('function')
    const stamp = api.stampRibbonIntoEnvelope as (
      e: Float32Array, p: Array<[number, number]>, w: number, h: number, m?: number,
    ) => void

    const envelope = new Float32Array(W * H)
    const poly: Array<[number, number]> = [[10, 10], [21, 10], [21, 21], [10, 21]]
    stamp(envelope, poly, W, H)

    expect(envelope[idx(15, 15)]).toBeGreaterThan(1)
    expect(envelope[idx(10, 10)]).toBeGreaterThan(1)
    expect(envelope[idx(5, 5)]).toBeLessThanOrEqual(1)
    expect(envelope[idx(25, 25)]).toBeLessThanOrEqual(1)
  })

  it('stamp-preserves-outside: stamping the ribbon never clears pre-existing envelope mass (grandfathering)', () => {
    expect(typeof api.stampRibbonIntoEnvelope).toBe('function')
    const stamp = api.stampRibbonIntoEnvelope as (
      e: Float32Array, p: Array<[number, number]>, w: number, h: number, m?: number,
    ) => void

    const envelope = new Float32Array(W * H)
    envelope[idx(2, 2)] = 1000 // an earlier stroke, far from this ribbon
    const poly: Array<[number, number]> = [[10, 10], [21, 10], [21, 21], [10, 21]]
    stamp(envelope, poly, W, H)

    expect(envelope[idx(2, 2)]).toBe(1000)
  })

  it('depositRoom: exported; g(0) = 0; g(sc) = sc (the UAT look lever)', () => {
    expect(typeof spreadApi.depositRoom).toBe('function')
    const g = spreadApi.depositRoom as (sc: number) => number
    expect(g(0)).toBe(0)
    expect(g(0.09)).toBeCloseTo(0.09, 10)
    expect(g(0.363)).toBeCloseTo(0.363, 10)
  })

  // --- engine wiring ---

  it('engine-stamped: stampRibbonIntoEnvelope( called twice (both local-physics sites)', () => {
    expect(countOcc(engineSrc, 'stampRibbonIntoEnvelope(')).toBe(2)
  })

  it('engine-room-lever: depositRoom( called twice (one deposit reduction per site)', () => {
    expect(countOcc(engineSrc, 'depositRoom(')).toBe(2)
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

  it('stamp-before: the ribbon is stamped after the snapshot and strictly before the solver, at both sites', () => {
    const s1 = nthIndex(engineSrc, 'snapshotWetAlpha(', 1)
    const t1 = nthIndex(engineSrc, 'stampRibbonIntoEnvelope(', 1)
    const c1 = nthIndex(engineSrc, 'createLocalFluidPhysicsContinuation(', 1)
    const p1 = nthIndex(engineSrc, 'projectWetIntoEnvelope(', 1)
    const s2 = nthIndex(engineSrc, 'snapshotWetAlpha(', 2)
    const t2 = nthIndex(engineSrc, 'stampRibbonIntoEnvelope(', 2)
    const l1 = nthIndex(engineSrc, 'localFluidPhysicsStep(', 1)
    const p2 = nthIndex(engineSrc, 'projectWetIntoEnvelope(', 2)
    for (const v of [s1, t1, c1, p1, s2, t2, l1, p2]) expect(v).toBeGreaterThan(-1)
    expect(s1).toBeLessThan(t1)
    expect(t1).toBeLessThan(c1)
    expect(c1).toBeLessThan(p1)
    expect(p1).toBeLessThan(s2)
    expect(s2).toBeLessThan(t2)
    expect(t2).toBeLessThan(l1)
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
