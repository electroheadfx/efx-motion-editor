// ============================================================
//  bristles.test.ts — the deterministic per-bristle set (64-21).
//
//  The bristle set is a PURE FUNCTION of one seeded stream (the stroke's
//  `traceSeed`): one RNG, one fixed call order, an 8-float stride, and
//  `count = round(clamp(2·halfWidth/1.1, 40, 256))` (§4.1). The call order is
//  part of the record's meaning — one draw per field even when a run is
//  clipped — so it is pinned here as a contract, not documented as a comment.
//
//  Laws pinned here:
//   1. The §4.1 count law: 40 floor for a non-positive / non-finite input,
//      round to nearest in the band, 256 cap.
//   2. Two identical streams produce byte-identical Float32Arrays; streams
//      that differ in their first value produce different data.
//   3. The draw count is a closed function of the run headers: six draws per
//      header (run, d, f, p, value pick, value multiplier — exactly one
//      multiplier draw in all three bands), seven per bristle (across,
//      radiusScale, touchReach, loadRate, initialLoad, seed, valueJitter),
//      INCLUDING the fields of a run clipped by `count`.
//   4. A run shares its tuft multipliers: `radiusScale` and `loadRate` vary
//      only by the ±12 % per-bristle factor and the edge term, `initialLoad`
//      shares the run's `p`, and `valueJitter` shares one run multiplier
//      within ±4 % (§4.2).
//   5. `across` is monotone and spans approximately −1..1; `edge` is
//      `smoothstep(0.55, 1, |across|)`; an edge bristle is thicker than a
//      centre bristle of the same run; `touchReach` is clamped to 0..0.92;
//      `initialLoad` is in (0, 1].
//   6. The stride is exactly 8 floats and the field order is the documented
//      one, with the spare slot zero.
//   7. The module never reads `Math.random`, a wall clock, or the engine.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BRISTLE_CAP,
  BRISTLE_MIN,
  BRISTLE_SPACING_PX,
  bristleCount,
  makeBristles,
} from './bristles'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(resolve(HERE, 'bristles.ts'), 'utf8')

/** mulberry32 — the same generator family the adapter installs (the test owns its own copy). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stream that returns `first` on its first call, then delegates. */
function shifted(first: number, tail: () => number): () => number {
  let used = false
  return () => {
    if (!used) {
      used = true
      return first
    }
    return tail()
  }
}

/** A stream that always returns `value`, counting its draws. */
function constant(value: number): { rng: () => number; draws: () => number } {
  let n = 0
  return {
    rng: () => {
      n += 1
      return value
    },
    draws: () => n,
  }
}

function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectNotContains(source: string, needle: string): void {
  expect(source.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

/** `smoothstep(0.55, 1, x)` — declared here so the edge law has an independent witness. */
function smoothstepEdge(across: number): number {
  const t = Math.min(1, Math.max(0, (Math.abs(across) - 0.55) / (1 - 0.55)))
  return t * t * (3 - 2 * t)
}

describe('bristleCount — the §4.1 count law', () => {
  it('is round(clamp(2·halfWidth/1.1, 40, 256))', () => {
    expect(bristleCount(22)).toBe(40) // 40 texels: the floor
    expect(bristleCount(50)).toBe(91) // 100/1.1 = 90.9 → rounds to 91
    expect(bristleCount(55)).toBe(100) // 110/1.1 = 100 exactly
    expect(bristleCount(1e9)).toBe(256) // the cap
  })

  it('maps a non-positive or non-finite half-width to the floor', () => {
    expect(bristleCount(0)).toBe(40)
    expect(bristleCount(-4)).toBe(40)
    expect(bristleCount(NaN)).toBe(40)
    expect(bristleCount(Infinity)).toBe(BRISTLE_MIN)
  })

  it('exports the fixed constants', () => {
    expect(BRISTLE_CAP).toBe(256)
    expect(BRISTLE_MIN).toBe(40)
    expect(BRISTLE_SPACING_PX).toBe(1.1)
  })
})

describe('makeBristles — a pure function of the seeded stream', () => {
  it('produces byte-identical data for two identical streams', () => {
    const a = makeBristles(64, mulberry32(7))
    const b = makeBristles(64, mulberry32(7))
    expect(a.count).toBe(64)
    expect(a.data.length).toBe(64 * 8)
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
  })

  it('produces different data for streams differing only in their first value', () => {
    const a = makeBristles(64, mulberry32(7))
    const b = makeBristles(64, shifted(0.123, mulberry32(7)))
    expect(Array.from(a.data)).not.toEqual(Array.from(b.data))
  })

  it('consumes the RNG in a closed number of draws — six per run header, seven per bristle', () => {
    // A constant stream makes the run structure a closed quantity: the run
    // length is `3 + floor(v·14)` for every header.
    const a = constant(0) // run length 3 → ceil(40/3) = 14 headers (the last one clipped)
    makeBristles(40, a.rng)
    expect(a.draws()).toBe(14 * 6 + 40 * 7)

    const b = constant(0.5) // run length 10 → exactly 4 headers
    makeBristles(40, b.rng)
    expect(b.draws()).toBe(4 * 6 + 40 * 7)

    const c = constant(0.999) // run length 16 → 3 headers (the last one clipped to 8 bristles)
    makeBristles(40, c.rng)
    expect(c.draws()).toBe(3 * 6 + 40 * 7)
  })

  it('draws every clipped run field — one draw per field even past `count`', () => {
    // Run length 16 with count 40: the third header is clipped to 8 bristles,
    // but its six header draws and the eight bristles' seven draws each still
    // happen (3 headers × 6 + 40 × 7). A short-circuiting generator would
    // report 40×7 + 2×6 + a partial third header.
    const c = constant(0.999)
    const set = makeBristles(40, c.rng)
    expect(set.count).toBe(40)
    expect(c.draws()).toBe(3 * 6 + 40 * 7)
  })
})

describe('makeBristles — the run structure (§4.2)', () => {
  it('shares one tuft multiplier across a run: radiusScale and loadRate vary only by the ±12 % factor and the edge term', () => {
    // A constant 0.5 stream: run length 10, d = 1.05, p = 0.94,
    // m = 1.0, per-bristle factor = 1.0. `radiusScale / (1 + 1.4·edge)` must
    // then be the SAME constant (d · 0.88..1.12) for every bristle of a run.
    const set = makeBristles(40, constant(0.5).rng)
    const runValues: number[] = []
    for (let i = 0; i < 10; i += 1) {
      const across = set.data[i * 8]!
      const radiusScale = set.data[i * 8 + 1]!
      const loadRate = set.data[i * 8 + 3]!
      const edge = smoothstepEdge(across)
      expect(loadRate).toBeCloseTo(radiusScale, 6)
      runValues.push(radiusScale / (1 + 1.4 * edge))
    }
    for (const v of runValues) expect(v).toBeCloseTo(runValues[0]!, 6)
    // A different run (bristle 10 starts the second header) may share the same
    // constant on this stream — the law is per-run sharing, not run uniqueness.
    const across10 = set.data[10 * 8]!
    const radius10 = set.data[10 * 8 + 1]!
    expect(radius10 / (1 + 1.4 * smoothstepEdge(across10))).toBeCloseTo(runValues[0]!, 6)
  })

  it('shares one run multiplier in valueJitter, within ±4 %', () => {
    // Header pinned at 0.5 → run length 10, value multiplier m = 1.0. The
    // per-bristle draws then vary, so every bristle of the run prints a jitter
    // inside m·(1 ± 0.04) = 0.96..1.04.
    const tail = mulberry32(21)
    const header = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
    let i = 0
    const scripted = (): number => (i < header.length ? header[i++]! : tail())
    const set = makeBristles(40, scripted)
    for (let k = 0; k < 10; k += 1) {
      const jitter = set.data[k * 8 + 5]!
      expect(jitter).toBeGreaterThanOrEqual(0.96 - 1e-9)
      expect(jitter).toBeLessThanOrEqual(1.04 + 1e-9)
    }
  })

  it('pins the exact law on a constant stream — across, edge, radiusScale, touchReach, initialLoad, seed, valueJitter', () => {
    // With rng() = 0.5 constantly: run 10, d = 1.05, f = 0, p = 0.94,
    // m = 1.0, and the per-bristle factor (0.88 + 0.24·0.5) = 1.0.
    // spacing = 2/40 = 0.05 → across_0 = −1 + 0.5·0.05 = −0.975.
    const set = makeBristles(40, constant(0.5).rng)
    const across0 = set.data[0]!
    expect(across0).toBeCloseTo(-0.975, 6)
    const edge0 = smoothstepEdge(across0)
    expect(edge0).toBeCloseTo(0.991083, 5)
    expect(set.data[1]!).toBeCloseTo(1.05 * (1 + 1.4 * edge0), 5)
    expect(set.data[2]!).toBeCloseTo(0.04 + 0.3 * 0.5 * 0.5 + 0.42 * edge0, 6)
    expect(set.data[3]!).toBeCloseTo(1.05 * (1 + 1.4 * edge0), 5)
    expect(set.data[4]!).toBeCloseTo(0.5, 6) // seed: one draw
    expect(set.data[5]!).toBeCloseTo(1.0, 6) // valueJitter = m · (1 + 0)
    expect(set.data[6]!).toBeCloseTo(0.94 * (1 - 0.3 * edge0 * 0.5), 6)
  })

  it('spans the documented per-bristle bands', () => {
    const set = makeBristles(256, mulberry32(3))
    for (let i = 0; i < set.count; i += 1) {
      const across = set.data[i * 8]!
      const radiusScale = set.data[i * 8 + 1]!
      const touchReach = set.data[i * 8 + 2]!
      const initialLoad = set.data[i * 8 + 6]!
      expect(across).toBeGreaterThanOrEqual(-1.1)
      expect(across).toBeLessThanOrEqual(1.1)
      expect(radiusScale).toBeGreaterThan(0)
      expect(radiusScale).toBeLessThanOrEqual(1.35 * 1.12 * 2.4 + 1e-9)
      expect(touchReach).toBeGreaterThanOrEqual(0)
      expect(touchReach).toBeLessThanOrEqual(0.92)
      expect(initialLoad).toBeGreaterThan(0)
      expect(initialLoad).toBeLessThanOrEqual(1)
    }
  })

  it('is monotone across the set and thicker at the edges than at the centre', () => {
    const set = makeBristles(256, mulberry32(3))
    let previous = -Infinity
    for (let i = 0; i < set.count; i += 1) {
      const across = set.data[i * 8]!
      expect(across).toBeGreaterThan(previous)
      previous = across
    }
    // The edge law is proven on the constant stream, where every run carries
    // the same tuft multipliers and `edge` is the only term that moves radius.
    const flat = makeBristles(256, constant(0.5).rng)
    const centreRadius = flat.data[Math.floor(256 / 2) * 8 + 1]!
    const edgeRadius = flat.data[0 * 8 + 1]!
    const centreEdge = smoothstepEdge(flat.data[Math.floor(256 / 2) * 8]!)
    const edgeEdge = smoothstepEdge(flat.data[0 * 8]!)
    expect(edgeEdge).toBeGreaterThan(centreEdge)
    expect(edgeRadius).toBeGreaterThan(centreRadius)
  })
})

describe('makeBristles — the 8-float stride and the field order', () => {
  it('writes exactly 8 floats per bristle with the spare slot zero', () => {
    const set = makeBristles(41, mulberry32(5))
    expect(set.count).toBe(41)
    expect(set.data.length).toBe(41 * 8)
    for (let i = 0; i < set.count; i += 1) expect(set.data[i * 8 + 7]).toBe(0)
  })

  it('keeps the documented field order', () => {
    // A constant stream pins each slot's identity: across at 0, radiusScale at
    // 1, touchReach at 2, loadRate at 3, seed at 4, valueJitter at 5,
    // initialLoad at 6, spare at 7.
    const set = makeBristles(40, constant(0.5).rng)
    expect(set.data[4]).toBeCloseTo(0.5, 6) // seed: the draw's own value
    expect(set.data[5]).toBeCloseTo(1.0, 6) // valueJitter: m · (1 + (0.5·2−1)·0.04)
    expect(set.data[6]).not.toBeCloseTo(0.5, 3) // initialLoad is p·(1 − …), never the seed
    expect(set.data[2]).not.toBeCloseTo(set.data[3]!, 3) // touchReach ≠ loadRate on this stream
  })

  it('preserves the header call order — changing it changes every bristle', () => {
    // The first draw is the run length. A stream that returns 0 first makes
    // the first run 3 bristles long; the same tail returning 0.999 makes it
    // 16. Every downstream field therefore differs.
    const a = makeBristles(40, shifted(0.0, constant(0.5).rng))
    const b = makeBristles(40, shifted(0.999, constant(0.5).rng))
    expect(Array.from(a.data)).not.toEqual(Array.from(b.data))
  })
})

describe('bristles.ts — the determinism contract in source', () => {
  it('reads no wall clock and no Math.random', () => {
    expectNotContains(SOURCE, 'Math.random')
    expectNotContains(SOURCE, 'Date.now')
    expectNotContains(SOURCE, 'performance.now')
    expectNotContains(SOURCE, 'new Date')
  })

  it('imports nothing from the engine and documents the call order as a contract', () => {
    expectNotContains(SOURCE, "from './Engine'")
    expectNotContains(SOURCE, "from './shaders'")
    expectContains(SOURCE, 'RNG draws happen in a fixed order')
  })

  it('exports the set interface and cites its notes sections', () => {
    expectContains(SOURCE, 'export interface BristleSet')
    expectContains(SOURCE, '§4.1')
    expectContains(SOURCE, '§4.2')
    expectContains(SOURCE, '§3.1')
  })
})
