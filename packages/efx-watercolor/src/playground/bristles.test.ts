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
//   4. A run shares its tuft multiplier: `loadRate` varies only by the ±12 %
//      per-bristle factor and the edge term. `radiusScale` is the reference's
//      PLAIN per-bristle `0.75 + rnd·0.95` (app.js C() `l`), never the
//      edge-thickening `g` law — that one is `loadRate` (shape.w). `initialLoad`
//      shares the run's `p`, and `valueJitter` shares one run multiplier
//      within ±4 % (§4.2).
//   5. `across` is monotone and spans approximately −1..1; `edge` is the
//      LINEAR `clamp(|across|, 0.55, 1)` (app.js C() `o(0.55,1,|n|)`); a rim
//      bristle DRIES FASTER (`loadRate`) but is NOT thicker (`radiusScale` is
//      position-independent); `touchReach` is clamped to 0..0.92;
//      `initialLoad` is in (0, 1].
//   6. The stride is exactly 8 floats and the field order is the documented
//      one, with the spare slot zero.
//   7. The module never reads `Math.random`, a wall clock, or the engine.
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BRISTLE_CAP,
  BRISTLE_MIN,
  BRISTLE_SPACING_PX,
  bristleCount,
  makeBristles,
} from './bristles'
// 64-22: the gather's constants and its softness band. The namespace cast
// keeps a not-yet-exported symbol a clean per-test failure instead of a
// module-load error for the whole suite.
import * as bristleModule from './bristles'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(resolve(HERE, 'bristles.ts'), 'utf8')
// 261121-umu: the engine's ONE contact-pressure call site is pinned from source.
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')

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

/** `clamp(|x|, 0.55, 1)` — the reference's LINEAR radial weight (app.js C()). */
function clampEdge(across: number): number {
  return Math.min(1, Math.max(0.55, Math.abs(across)))
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

  it('consumes the RNG in a closed number of draws — six per run header, eight per bristle', () => {
    // A constant stream makes the run structure a closed quantity: the run
    // length is `3 + floor(v·14)` for every header. Per bristle the fields are
    // across, radiusScale, touchReach (two draws: `rng()·rng()`), loadRate,
    // initialLoad, seed, valueJitter = 8 draws.
    const a = constant(0) // run length 3 → ceil(40/3) = 14 headers (the last one clipped)
    makeBristles(40, a.rng)
    expect(a.draws()).toBe(14 * 6 + 40 * 8)

    const b = constant(0.5) // run length 10 → exactly 4 headers
    makeBristles(40, b.rng)
    expect(b.draws()).toBe(4 * 6 + 40 * 8)

    const c = constant(0.999) // run length 16 → 3 headers (the last one clipped to 8 bristles)
    makeBristles(40, c.rng)
    expect(c.draws()).toBe(3 * 6 + 40 * 8)
  })

  it('draws every clipped run field — one draw per field even past `count`', () => {
    // Run length 16 with count 40: the third header is clipped to 8 bristles,
    // but its six header draws and the eight bristles' eight draws each still
    // happen (3 headers × 6 + 40 × 8). A short-circuiting generator would
    // report 40×8 + 2×6 + a partial third header.
    const c = constant(0.999)
    const set = makeBristles(40, c.rng)
    expect(set.count).toBe(40)
    expect(c.draws()).toBe(3 * 6 + 40 * 8)
  })
})

describe('makeBristles — the run structure (§4.2)', () => {
  it('shares one tuft multiplier across a run: loadRate varies only by the ±12 % factor and the edge term; radiusScale is plain', () => {
    // A constant 0.5 stream: run length 10, d = 1.05, p = 0.94,
    // m = 1.0, per-bristle factor = 1.0. `loadRate / (1 + 1.4·edge)` must
    // then be the SAME constant (d · 0.88..1.12) for every bristle of a run,
    // and the radius scale is the plain `0.75 + 0.5·0.95` (app.js C() `l`).
    const set = makeBristles(40, constant(0.5).rng)
    const runValues: number[] = []
    for (let i = 0; i < 10; i += 1) {
      const across = set.data[i * 8]!
      const radiusScale = set.data[i * 8 + 1]!
      const loadRate = set.data[i * 8 + 3]!
      const edge = clampEdge(across)
      expect(radiusScale).toBeCloseTo(0.75 + 0.5 * 0.95, 6)
      runValues.push(loadRate / (1 + 1.4 * edge))
    }
    for (const v of runValues) expect(v).toBeCloseTo(runValues[0]!, 6)
    // A different run (bristle 10 starts the second header) may share the same
    // constant on this stream — the law is per-run sharing, not run uniqueness.
    const across10 = set.data[10 * 8]!
    const load10 = set.data[10 * 8 + 3]!
    expect(load10 / (1 + 1.4 * clampEdge(across10))).toBeCloseTo(runValues[0]!, 6)
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
    const edge0 = clampEdge(across0)
    expect(edge0).toBeCloseTo(0.975, 6)
    // app.js C(): radiusScale `l` = 0.75 + a()·0.95, position-independent.
    expect(set.data[1]!).toBeCloseTo(0.75 + 0.5 * 0.95, 6)
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
      expect(radiusScale).toBeLessThanOrEqual(1.7 + 1e-9)
      expect(touchReach).toBeGreaterThanOrEqual(0)
      expect(touchReach).toBeLessThanOrEqual(0.92)
      expect(initialLoad).toBeGreaterThan(0)
      expect(initialLoad).toBeLessThanOrEqual(1)
    }
  })

  it('is monotone across the set and dries faster at the edges than at the centre', () => {
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
    const centre = Math.floor(256 / 2)
    const centreLoad = flat.data[centre * 8 + 3]!
    const edgeLoad = flat.data[0 * 8 + 3]!
    expect(clampEdge(flat.data[0 * 8]!)).toBeGreaterThan(clampEdge(flat.data[centre * 8]!))
    expect(edgeLoad).toBeGreaterThan(centreLoad)
    // The radius scale is position-independent (app.js C() `l`).
    expect(flat.data[0 * 8 + 1]!).toBeCloseTo(flat.data[centre * 8 + 1]!, 6)
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

  it('preserves the header call order — each header slot lands in its documented role', () => {
    // Scripted header, then a constant 0.5 tail. Header order is run, d, f, p,
    // value pick, multiplier:
    //   0.5  → run = 3 + floor(0.5·14) = 10
    //   0.75 → d   = 0.75 + 0.75·0.6 = 1.2
    //   0.25 → f   = (0.25 − 0.5)·0.16 = −0.04
    //   0.5  → p   = 0.88 + 0.5·0.12 = 0.94
    //   0.5  → value pick → else band
    //   0.25 → m   = 0.96 + 0.25·0.08 = 0.98
    // Reordering any header draw moves a factor into the wrong field.
    const header = [0.5, 0.75, 0.25, 0.5, 0.5, 0.25]
    let i = 0
    const scripted = (): number => (i < header.length ? header[i++]! : 0.5)
    const set = makeBristles(40, scripted)
    const edge0 = clampEdge(set.data[0]!)
    expect(set.data[1]!).toBeCloseTo(0.75 + 0.5 * 0.95, 6) // radiusScale: plain l (app.js C())
    expect(set.data[3]!).toBeCloseTo(1.2 * (1 + 1.4 * edge0), 6) // loadRate ← d
    expect(set.data[2]!).toBeCloseTo(0.075 + 0.42 * edge0, 6) // touchReach ← f (−0.04)
    expect(set.data[5]!).toBeCloseTo(0.98, 6) // valueJitter ← m
    expect(set.data[6]!).toBeCloseTo(0.94 * (1 - 0.15 * edge0), 6) // initialLoad ← p
  })
})

describe('bristles.ts — the determinism contract in source', () => {
  it('reads no wall clock and no Math.random', () => {
    // Call forms, not bare names: the module header legitimately names
    // `Math.random` and the wall clock in prose to state the ban.
    expectNotContains(SOURCE, 'Math.random(')
    expectNotContains(SOURCE, 'Date.now(')
    expectNotContains(SOURCE, 'performance.now(')
    expectNotContains(SOURCE, 'new Date(')
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

// ============================================================
//  64-22 — the gather's softness band, restated 2026-11-19.
//
//  Feather is a STUDIO control: the reference has ONE constant band, §6's
//  paint.softness 0.09, and no Feather at all. The artist's ruling: Feather 0
//  must mean NO feather, so the studio band never moves and Feather instead
//  thins the carried film radially (pinned in scattering.test.ts).
//  BRISTLE_SOFTNESS stays declared as the reference's own band, the neutral
//  fallback the twin uses for a missing width, and the constant
//  `gatherSoftness` returns at every Feather.
// ============================================================
//  64-23 — the trace constants, the edge constants and their formulas.
//
//  The reference's §6 constants are declared ONCE here, beside the
//  stroke's other constants, and each pure helper is pinned at both
//  endpoints of its band so the GLSL in `shaders.ts` has a tested twin it
//  must mirror expression-for-expression (Task 2 binds them as uniforms).
//
//   §4.3  dryness / streak / broken     §4.4  the paper tooth threshold
//   §4.5  the wide/local body           §5.3  rim contact noise
//   §5.4  the staggered landing         §5.5  the rim coverage bias
//
//  The namespace cast keeps a not-yet-exported symbol a clean per-test
//  assertion failure instead of a module-load error for the whole suite.
// ============================================================

const TRACES = bristleModule as unknown as {
  BRISTLE_GRAIN?: number
  BRISTLE_STREAK?: number
  BRISTLE_STREAK_LENGTH?: number
  BRISTLE_STREAK_SHARE?: number
  BRISTLE_RIM_CONTACT?: number
  BRISTLE_HAIRS?: number
  BRISTLE_DRY_EDGE?: number
  BRISTLE_LANDING?: number
  bristleDryness?: (load: number) => number
  bristleBroken?: (load: number, streakNoise: number) => number
  bristleThreshold?: (grain: number, height: number) => number
  bristleSoftnessBand?: (coverage: number, threshold: number, softness: number) => number
  bristleLandingOffset?: (seed01: number) => number
  bristleLanded?: (offset: number, distOverHalfWidth: number) => number
  bristleRim?: (across: number) => number
  bristleEdgeBias?: (across: number) => number
  bristleBody?: (wide: number, local: number, presence: number, hairs: number) => number
  bristleCoverage?: (body: number, pressure: number, edgeBias: number) => number
  // Spec 10: the lateral edge film and its shape-bias exponent.
  BRISTLE_EDGE_START?: number
  BRISTLE_EDGE_EXP_MIN?: number
  BRISTLE_EDGE_EXP_MAX?: number
  BRISTLE_EDGE_CORE?: number
  edgeFalloffExponent?: (bias: number) => number
  bristleEdgeFilm?: (lateral: number, amount: number, falloff: number) => number
}

const SRC_ROOT = resolve(HERE, '..')

function packageSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...packageSourceFiles(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

const PACKAGE_SOURCES = packageSourceFiles(SRC_ROOT).map(file => ({
  file: file.slice(SRC_ROOT.length + 1),
  text: readFileSync(file, 'utf8'),
}))

describe('the §6 trace and edge constants (64-23)', () => {
  it('pins each constant to its §6 default', () => {
    expect(TRACES.BRISTLE_GRAIN, '§6 paint.grain — the paper-tooth scale').toBe(1.2)
    expect(TRACES.BRISTLE_STREAK, '§6 paint.streak').toBe(0.9)
    expect(TRACES.BRISTLE_STREAK_LENGTH, '§6 paint.streakLength').toBe(18)
    expect(TRACES.BRISTLE_STREAK_SHARE, '§6 streakShare').toBe(0.15)
    expect(TRACES.BRISTLE_RIM_CONTACT, '§6 rimContact').toBe(0.45)
    expect(TRACES.BRISTLE_HAIRS, '§6 hairs').toBe(0.45)
    expect(TRACES.BRISTLE_DRY_EDGE, '§6 dryEdge').toBe(0.35)
    expect(TRACES.BRISTLE_LANDING, '§6 paint.landing').toBe(1.6)
  })

  it('declares each constant once in the package — a second copy fails the build', () => {
    const names = [
      'BRISTLE_GRAIN',
      'BRISTLE_STREAK',
      'BRISTLE_STREAK_LENGTH',
      'BRISTLE_STREAK_SHARE',
      'BRISTLE_RIM_CONTACT',
      'BRISTLE_HAIRS',
      'BRISTLE_DRY_EDGE',
      'BRISTLE_LANDING',
    ]
    for (const name of names) {
      const declarations = PACKAGE_SOURCES.filter(({ text }) =>
        new RegExp(`export const ${name}\\b`).test(text),
      ).map(({ file }) => file)
      expect(declarations.length, `${name} is declared once in the package`).toBe(1)
      expect(declarations[0], `${name} is declared in playground/bristles.ts`).toBe(
        'playground/bristles.ts',
      )
    }
  })

  it('documents the §4.4 grain collision with the brush preset grain', () => {
    expectContains(SOURCE, 'Brush.grain')
    expectContains(SOURCE, 'paper-tooth')
    expectContains(SOURCE, '§4.4')
  })

  it('cites every law it ports', () => {
    for (const section of ['§4.3', '§4.4', '§4.5', '§5.3', '§5.4', '§5.5', '§6']) {
      expectContains(SOURCE, section)
    }
  })
})

describe('bristleDryness — §4.3', () => {
  it('is clamp((1 − load)·0.9·1.6, 0, 1)', () => {
    expect(typeof TRACES.bristleDryness, 'bristleDryness is exported').toBe('function')
    expect(TRACES.bristleDryness?.(1), 'a loaded bristle has zero dryness').toBe(0)
    expect(TRACES.bristleDryness?.(0.5), 'half-dry: 0.5 · 0.9 · 1.6').toBeCloseTo(0.72, 9)
    expect(TRACES.bristleDryness?.(0), 'a dry bristle saturates at 1').toBe(1)
  })

  it('clamps at the band and never returns NaN', () => {
    expect(typeof TRACES.bristleDryness, 'bristleDryness is exported').toBe('function')
    expect(TRACES.bristleDryness?.(1.5), 'an over-full load never goes negative').toBe(0)
    expect(TRACES.bristleDryness?.(-1), 'a negative load saturates at 1').toBe(1)
    expect(TRACES.bristleDryness?.(Number.NaN), 'NaN is the neutral, fully loaded 0').toBe(0)
    expect(TRACES.bristleDryness?.(Number.POSITIVE_INFINITY), 'non-finite is the neutral 0').toBe(0)
    expect(TRACES.bristleDryness?.(Number.NEGATIVE_INFINITY), 'non-finite is the neutral 0').toBe(0)
  })
})

describe('bristleBroken — §4.3', () => {
  it('prints solid while loaded, at any noise', () => {
    expect(typeof TRACES.bristleBroken, 'bristleBroken is exported').toBe('function')
    for (const noise of [0, 0.3, 0.5, 0.7, 1]) {
      expect(TRACES.bristleBroken?.(1, noise), 'a loaded bristle is exactly solid').toBe(1)
    }
  })

  it('mixes the thresholded noise by dryness · hairs', () => {
    expect(typeof TRACES.bristleBroken, 'bristleBroken is exported').toBe('function')
    // load 0 → dryness 1 → weight 0.45; smoothstep(0.3, 0.7, 0.5) = 0.5.
    expect(TRACES.bristleBroken?.(0, 0.5), 'the fully dry mid-noise mix').toBeCloseTo(
      1 - 0.45 + 0.45 * 0.5,
      9,
    )
    expect(TRACES.bristleBroken?.(0, 0), 'a valley dashes the most').toBeCloseTo(0.55, 9)
    expect(TRACES.bristleBroken?.(0, 1), 'a peak prints solid even when dry').toBe(1)
    expect(TRACES.bristleBroken?.(0.5, 0.5), 'half-dry: weight 0.72 · 0.45').toBeCloseTo(
      1 - 0.324 + 0.324 * 0.5,
      9,
    )
    expect(TRACES.bristleBroken?.(0, 0.3), 'below 0.3 the noise thresholds to 0').toBeCloseTo(0.55, 9)
    expect(TRACES.bristleBroken?.(0, 0.7), 'at 0.7 the noise thresholds to 1').toBe(1)
  })

  it('replays the solid look for non-finite inputs', () => {
    expect(typeof TRACES.bristleBroken, 'bristleBroken is exported').toBe('function')
    expect(TRACES.bristleBroken?.(Number.NaN, 0.5), 'a missing load reads as fully loaded').toBe(1)
    expect(TRACES.bristleBroken?.(0, Number.NaN), 'a missing noise reads as the smooth peak').toBe(1)
  })
})

describe('bristleThreshold — §4.4', () => {
  it('is grain·(1 − height) − 0.25; peaks map to −0.25 and valleys to 0.95 at grain 1.2', () => {
    expect(typeof TRACES.bristleThreshold, 'bristleThreshold is exported').toBe('function')
    expect(TRACES.bristleThreshold?.(1.2, 1), 'a paper peak admits any coverage').toBeCloseTo(-0.25, 9)
    expect(TRACES.bristleThreshold?.(1.2, 0), 'a valley needs a nearly solid load').toBeCloseTo(0.95, 9)
    expect(TRACES.bristleThreshold?.(1.2, 0.5)).toBeCloseTo(0.35, 9)
  })

  it('is monotone decreasing in height', () => {
    expect(typeof TRACES.bristleThreshold, 'bristleThreshold is exported').toBe('function')
    let previous = Number.POSITIVE_INFINITY
    for (const height of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const value = TRACES.bristleThreshold?.(1.2, height) ?? Number.NaN
      expect(value).toBeLessThan(previous)
      previous = value
    }
  })

  it('never returns NaN', () => {
    expect(typeof TRACES.bristleThreshold, 'bristleThreshold is exported').toBe('function')
    expect(
      TRACES.bristleThreshold?.(Number.NaN, 0.5),
      'a missing grain replays §6 BRISTLE_GRAIN',
    ).toBeCloseTo(1.2 * 0.5 - 0.25, 9)
    expect(
      TRACES.bristleThreshold?.(1.2, Number.NaN),
      'a missing height reads as no tooth (0)',
    ).toBeCloseTo(0.95, 9)
  })
})

describe('bristleSoftnessBand — §4.4', () => {
  it('is 0.5 at the threshold and saturates at the band edges', () => {
    expect(typeof TRACES.bristleSoftnessBand, 'bristleSoftnessBand is exported').toBe('function')
    expect(
      TRACES.bristleSoftnessBand?.(0.4, 0.4, 0.09),
      'coverage = threshold is the half point',
    ).toBeCloseTo(0.5, 9)
    expect(
      TRACES.bristleSoftnessBand?.(0.31, 0.4, 0.09),
      'below the low edge prints nothing',
    ).toBe(0)
    expect(
      TRACES.bristleSoftnessBand?.(0.49, 0.4, 0.09),
      'above the high edge prints fully',
    ).toBe(1)
  })

  it('is a hard step at width 0 — Feather 0 has no feather', () => {
    expect(TRACES.bristleSoftnessBand?.(0.39, 0.4, 0)).toBe(0)
    expect(TRACES.bristleSoftnessBand?.(0.4, 0.4, 0)).toBe(1)
    expect(TRACES.bristleSoftnessBand?.(0.41, 0.4, 0)).toBe(1)
  })

  it('is the smoothstep between the edges, not a linear ramp', () => {
    expect(typeof TRACES.bristleSoftnessBand, 'bristleSoftnessBand is exported').toBe('function')
    // A quarter into the band: t = 0.25 → 3t² − 2t³ = 0.15625.
    expect(TRACES.bristleSoftnessBand?.(0.35, 0.4, 0.1)).toBeCloseTo(0.15625, 9)
  })

  it('never returns NaN', () => {
    expect(typeof TRACES.bristleSoftnessBand, 'bristleSoftnessBand is exported').toBe('function')
    expect(
      TRACES.bristleSoftnessBand?.(Number.NaN, 0.4, 0.09),
      'a missing coverage prints nothing',
    ).toBe(0)
    expect(
      TRACES.bristleSoftnessBand?.(0.4, Number.NaN, 0.09),
      'a missing threshold reads as no tooth (0)',
    ).toBe(1)
    expect(
      TRACES.bristleSoftnessBand?.(0.4, 0.4, Number.NaN),
      'a missing width replays §6 0.09',
    ).toBeCloseTo(0.5, 9)
    expect(
      TRACES.bristleSoftnessBand?.(0.4, 0.4, -0.09),
      'a negative width replays §6 0.09',
    ).toBeCloseTo(0.5, 9)
  })
})

describe('bristleLandingOffset — §5.4', () => {
  it('is (0.04 + 0.7·fract(seed·13.7)²)·landing — landing 1.6 spans [0.064, 1.184)', () => {
    expect(typeof TRACES.bristleLandingOffset, 'bristleLandingOffset is exported').toBe('function')
    expect(TRACES.bristleLandingOffset?.(0), 'seed 0 lands as early as possible').toBeCloseTo(0.064, 9)
    for (const seed of [0, 0.05, 0.25, 0.5, 0.75, 0.9, 0.99]) {
      const offset = TRACES.bristleLandingOffset?.(seed) ?? Number.NaN
      expect(offset).toBeGreaterThanOrEqual(0.064 - 1e-12)
      expect(offset).toBeLessThan(1.184)
    }
    // fract(0.5·13.7) = 0.85 → 1.6·(0.04 + 0.7·0.85²).
    expect(TRACES.bristleLandingOffset?.(0.5)).toBeCloseTo(1.6 * (0.04 + 0.7 * 0.85 * 0.85), 9)
  })

  it('never returns NaN', () => {
    expect(typeof TRACES.bristleLandingOffset, 'bristleLandingOffset is exported').toBe('function')
    expect(
      TRACES.bristleLandingOffset?.(Number.NaN),
      'a missing seed lands as early as possible',
    ).toBeCloseTo(0.064, 9)
  })
})

describe('bristleLanded — §5.4', () => {
  it('is smoothstep(offset, offset + 0.12, distance/halfWidth)', () => {
    expect(typeof TRACES.bristleLanded, 'bristleLanded is exported').toBe('function')
    expect(TRACES.bristleLanded?.(0.3, 0.3), 'before the offset a bristle does not print').toBe(0)
    expect(TRACES.bristleLanded?.(0.3, 0.2)).toBe(0)
    expect(TRACES.bristleLanded?.(0.3, 0.36), 'the ramp midpoint is half landed').toBeCloseTo(0.5, 9)
    expect(TRACES.bristleLanded?.(0.3, 0.42), 'past the ramp the bristle is fully landed').toBe(1)
  })

  it('never returns NaN', () => {
    expect(typeof TRACES.bristleLanded, 'bristleLanded is exported').toBe('function')
    expect(TRACES.bristleLanded?.(Number.NaN, 0.5), 'a missing offset lands at 0').toBe(1)
    expect(TRACES.bristleLanded?.(0.3, Number.NaN), 'a missing distance reads as fully landed').toBe(1)
  })
})

describe('bristleRim — §5.3', () => {
  it('is 0.25 + 0.75·smoothstep(0.45, 1, |across|)', () => {
    expect(typeof TRACES.bristleRim, 'bristleRim is exported').toBe('function')
    expect(TRACES.bristleRim?.(0), 'a centre bristle gets a quarter of the wobble').toBeCloseTo(0.25, 9)
    expect(TRACES.bristleRim?.(0.45), 'the wobble starts at 0.45').toBeCloseTo(0.25, 9)
    expect(TRACES.bristleRim?.(1), 'an edge bristle gets the full amount').toBeCloseTo(1, 9)
    expect(TRACES.bristleRim?.(-1), 'the law is symmetric in across').toBeCloseTo(1, 9)
    expect(TRACES.bristleRim?.(0.725), 'the midpoint is 0.25 + 0.75·0.5').toBeCloseTo(0.625, 6)
  })

  it('never returns NaN', () => {
    expect(typeof TRACES.bristleRim, 'bristleRim is exported').toBe('function')
    expect(TRACES.bristleRim?.(Number.NaN), 'a missing across reads as the centre').toBeCloseTo(0.25, 9)
  })
})

describe('bristleEdgeBias — §5.5', () => {
  it('is mix(1, 0.35, smoothstep(0.3, 1.05, |across|))', () => {
    expect(typeof TRACES.bristleEdgeBias, 'bristleEdgeBias is exported').toBe('function')
    expect(TRACES.bristleEdgeBias?.(0), 'the core carries no bias').toBe(1)
    expect(TRACES.bristleEdgeBias?.(0.3)).toBe(1)
    expect(TRACES.bristleEdgeBias?.(1.05), 'the rim is biased to 0.35').toBeCloseTo(0.35, 9)
    expect(TRACES.bristleEdgeBias?.(-1.1), 'beyond the band the bias saturates').toBeCloseTo(0.35, 9)
    expect(TRACES.bristleEdgeBias?.(0.675), 'the midpoint is 0.675').toBeCloseTo(0.675, 6)
  })

  it('never returns NaN', () => {
    expect(typeof TRACES.bristleEdgeBias, 'bristleEdgeBias is exported').toBe('function')
    expect(TRACES.bristleEdgeBias?.(Number.NaN), 'a missing across reads as no bias').toBe(1)
  })
})

describe('bristleBody — §4.5', () => {
  it('is mix(wide/5·presence, local, hairs)', () => {
    expect(typeof TRACES.bristleBody, 'bristleBody is exported').toBe('function')
    expect(TRACES.bristleBody?.(5, 0.5, 1, 0), 'hairs 0 is the wide body alone').toBeCloseTo(1, 9)
    expect(TRACES.bristleBody?.(5, 0.5, 1, 1), 'hairs 1 is the local fibres alone').toBeCloseTo(0.5, 9)
    expect(TRACES.bristleBody?.(5, 0.5, 1, 0.45), 'the default mixes 45 % local').toBeCloseTo(
      0.55 * 1 + 0.45 * 0.5,
      9,
    )
    expect(TRACES.bristleBody?.(2.5, 0.5, 0.5, 0), 'presence scales the wide body').toBeCloseTo(0.25, 9)
  })

  it('never returns NaN', () => {
    expect(typeof TRACES.bristleBody, 'bristleBody is exported').toBe('function')
    expect(TRACES.bristleBody?.(Number.NaN, 0.5, 1, 0.45), 'a missing wide reads as 0').toBeCloseTo(
      0.45 * 0.5,
      9,
    )
    expect(TRACES.bristleBody?.(5, Number.NaN, 1, 0.45), 'a missing local reads as 0').toBeCloseTo(
      0.55,
      9,
    )
    expect(TRACES.bristleBody?.(5, 0.5, Number.NaN, 0.45), 'a missing presence reads as 0').toBeCloseTo(
      0.45 * 0.5,
      9,
    )
    expect(
      TRACES.bristleBody?.(5, 0.5, 1, Number.NaN),
      'a missing hairs replays the 64-22 local-only body',
    ).toBeCloseTo(0.5, 9)
  })
})

describe('bristleCoverage — §4.5 / §5.5', () => {
  it('is body·(0.3 + 0.7·pressure)·edgeBias', () => {
    expect(typeof TRACES.bristleCoverage, 'bristleCoverage is exported').toBe('function')
    expect(TRACES.bristleCoverage?.(0.5, 0, 1), 'zero pressure keeps only the 0.3 floor').toBeCloseTo(
      0.15,
      9,
    )
    expect(TRACES.bristleCoverage?.(0.5, 1, 1), 'full pressure is the full body').toBeCloseTo(0.5, 9)
    expect(TRACES.bristleCoverage?.(0.5, 0.5, 1), 'half pressure is 0.65').toBeCloseTo(0.325, 9)
    expect(TRACES.bristleCoverage?.(0.5, 1, 0.35), 'the rim bias scales the coverage').toBeCloseTo(
      0.175,
      9,
    )
  })

  it('never returns NaN', () => {
    expect(typeof TRACES.bristleCoverage, 'bristleCoverage is exported').toBe('function')
    expect(TRACES.bristleCoverage?.(Number.NaN, 1, 1), 'a missing body prints nothing').toBe(0)
    expect(
      TRACES.bristleCoverage?.(0.5, Number.NaN, 1),
      'a missing pressure reads as the 0.3 floor',
    ).toBeCloseTo(0.15, 9)
    expect(
      TRACES.bristleCoverage?.(0.5, 1, Number.NaN),
      'a missing edge bias reads as no bias',
    ).toBeCloseTo(0.5, 9)
  })
})

// ============================================================
//  Spec 10 — the lateral edge film (Edge transparency and Edge falloff).
//
//  `gatherBristle` computes ONE lateral film share, in SILHOUETTE units: 1 is
//  the visible rim (BRISTLE_FEATHER_EDGE of the nominal footprint), not the
//  footprint's own edge. At amount 100 the core keeps `1 - BRISTLE_EDGE_CORE`
//  (45%) of its pigment — about 65% of the original opacity — and the rim
//  reaches 0; the shape bias picks the ramp through `edgeFalloffExponent`,
//  and amount 0 is inert. The share scales BOTH the deposit's opacity (the
//  gather coverage) and the pigment it carries (the deposit's absorbance),
//  so the lerp's fixed point is the diluted pigment and no dab ever erases
//  paint without depositing. The four constants are bound as uniforms, so the
//  fragment cannot re-type them.
// ============================================================

describe('bristleEdgeFilm — Spec 10, the lateral film in silhouette units', () => {
  it('is inert at amount 0 for every falloff', () => {
    for (const falloff of [0, 0.5, 1]) {
      for (const lateral of [0, 0.3, 0.55, 0.775, 1, 1.4]) {
        expect(
          TRACES.bristleEdgeFilm?.(lateral, 0, falloff),
          `amount 0 must not move the film (lateral ${lateral}, falloff ${falloff})`,
        ).toBe(1)
      }
    }
  })

  it('fades the core by amount · BRISTLE_EDGE_CORE at every falloff', () => {
    for (const amount of [0, 0.25, 0.5, 1]) {
      for (const falloff of [0, 0.5, 1]) {
        expect(
          TRACES.bristleEdgeFilm?.(0, amount, falloff),
          'the core fades with the amount — 45% pigment at amount 100',
        ).toBeCloseTo(1 - amount * (TRACES.BRISTLE_EDGE_CORE ?? Number.NaN), 12)
        expect(
          TRACES.bristleEdgeFilm?.(0.55, amount, falloff),
          'the fade starts exactly at BRISTLE_EDGE_START',
        ).toBeCloseTo(1 - amount * (TRACES.BRISTLE_EDGE_CORE ?? Number.NaN), 12)
      }
    }
  })

  it('reads 1 - amount at the silhouette for every falloff', () => {
    for (const amount of [0.25, 0.5, 1]) {
      for (const falloff of [0, 0.5, 1]) {
        expect(
          TRACES.bristleEdgeFilm?.(1, amount, falloff),
          'the rim must read exactly 1 - amount',
        ).toBeCloseTo(1 - amount, 12)
      }
    }
  })

  it('reads the landmark table at the fade midpoint (t = 0.5)', () => {
    // u = (0.775 - 0.55) / 0.45 = 0.5 → film = 1 - amount · (CORE + (1 - CORE)·0.5^e).
    const core = TRACES.BRISTLE_EDGE_CORE ?? Number.NaN
    const mid = (e: number): number => 1 - (core + (1 - core) * 0.5 ** e)
    expect(
      TRACES.bristleEdgeFilm?.(0.775, 1, 0.5),
      'falloff 50 (e = 1) reads 1 - (CORE + (1 - CORE)·0.5)',
    ).toBeCloseTo(mid(1), 9)
    expect(
      TRACES.bristleEdgeFilm?.(0.775, 1, 0),
      'falloff 0 (e = 0.5) reads the broad ramp',
    ).toBeCloseTo(mid(0.5), 9)
    expect(
      TRACES.bristleEdgeFilm?.(0.775, 1, 1),
      'falloff 100 (e = 2) reads the rim ramp',
    ).toBeCloseTo(mid(2), 9)
  })

  it('fades monotonically from the core to the rim at every falloff', () => {
    for (const falloff of [0, 0.5, 1]) {
      let previous = 1
      for (let step = 0; step <= 20; step += 1) {
        const film = TRACES.bristleEdgeFilm?.(step / 20, 1, falloff) ?? Number.NaN
        expect(
          film,
          `film must never rise between the core and the rim (falloff ${falloff}, step ${step})`,
        ).toBeLessThanOrEqual(previous + 1e-9)
        previous = film
      }
      expect(previous, 'the sweep ends at the rim').toBeCloseTo(0, 9)
    }
  })

  it('clamps cells beyond the silhouette to the full rim factor by design', () => {
    // The film narrows the mark at amount > 0 — intended, not a threshold change.
    expect(TRACES.bristleEdgeFilm?.(1.5, 1, 0.5), 'beyond the rim is the rim').toBeCloseTo(0, 12)
    expect(TRACES.bristleEdgeFilm?.(99, 0.5, 0), 'a far cell keeps the rim film').toBeCloseTo(
      0.5,
      12,
    )
  })

  it('never returns NaN', () => {
    for (const [lateral, amount, falloff] of [
      [Number.NaN, 1, 0.5],
      [0.5, Number.NaN, 0.5],
      [0.5, 1, Number.NaN],
      [Number.POSITIVE_INFINITY, 1, 0.5],
    ] as const) {
      expect(
        TRACES.bristleEdgeFilm?.(lateral, amount, falloff),
        `a non-finite argument reads as the neutral film (${lateral}/${amount}/${falloff})`,
      ).toBe(1)
    }
  })
})

describe('edgeFalloffExponent — the Spec 10 shape bias', () => {
  it('maps the canonical 0 / 50 / 100 onto 0.5 / 1 / 2', () => {
    expect(typeof TRACES.edgeFalloffExponent, 'edgeFalloffExponent is exported').toBe('function')
    expect(TRACES.edgeFalloffExponent?.(0), 'canonical 0 — the broad fade').toBeCloseTo(0.5, 12)
    expect(TRACES.edgeFalloffExponent?.(0.5), 'canonical 50 — linear').toBeCloseTo(1, 12)
    expect(TRACES.edgeFalloffExponent?.(1), 'canonical 100 — the rim fade').toBeCloseTo(2, 12)
  })

  it('is monotone between the anchors and clamped to the exponent bounds', () => {
    let previous = 0
    for (let step = 0; step <= 100; step += 1) {
      const exponent = TRACES.edgeFalloffExponent?.(step / 100) ?? Number.NaN
      expect(exponent).toBeGreaterThanOrEqual(previous)
      expect(exponent).toBeGreaterThanOrEqual(TRACES.BRISTLE_EDGE_EXP_MIN ?? 0.5)
      expect(exponent).toBeLessThanOrEqual(TRACES.BRISTLE_EDGE_EXP_MAX ?? 2)
      previous = exponent
    }
    // Out-of-track biases clamp to the same bounds.
    expect(TRACES.edgeFalloffExponent?.(-1)).toBeCloseTo(0.5, 12)
    expect(TRACES.edgeFalloffExponent?.(2)).toBeCloseTo(2, 12)
  })

  it('never returns NaN (a missing bias reads linear)', () => {
    expect(TRACES.edgeFalloffExponent?.(Number.NaN), 'a missing bias is linear').toBe(1)
    expect(TRACES.edgeFalloffExponent?.(Number.POSITIVE_INFINITY), 'a broken bias is linear').toBe(1)
  })
})

describe('the Spec 10 edge constants', () => {
  it('pins the start anchor, the core share and the exponent bounds', () => {
    expect(TRACES.BRISTLE_EDGE_START, 'the fade starts at 0.55 of the silhouette').toBe(0.55)
    expect(TRACES.BRISTLE_EDGE_CORE, 'amount 100 keeps 45% of the pigment at the core').toBe(0.55)
    expect(TRACES.BRISTLE_EDGE_EXP_MIN, 'falloff 0 is the square-root shape').toBe(0.5)
    expect(TRACES.BRISTLE_EDGE_EXP_MAX, 'falloff 100 is the squared shape').toBe(2)
  })

  it('declares each constant once in the package — a second copy fails the build', () => {
    for (const name of ['BRISTLE_EDGE_START', 'BRISTLE_EDGE_CORE', 'BRISTLE_EDGE_EXP_MIN', 'BRISTLE_EDGE_EXP_MAX']) {
      const declarations = PACKAGE_SOURCES.filter(({ text }) =>
        new RegExp(`export const ${name}\\b`).test(text),
      ).map(({ file }) => file)
      expect(declarations.length, `${name} is declared once in the package`).toBe(1)
      expect(declarations[0], `${name} is declared in playground/bristles.ts`).toBe(
        'playground/bristles.ts',
      )
    }
  })
})

// ============================================================
//  64-24 — the §3.4 wetness gate and the touch refresh (D-24).
//
//  Two pure laws, each the tested twin of an expression the engine's
//  fragments run: `bristleWetness` is the carrier's `wetAt` in mode 1 (the
//  timestamp law — an old sheet stops giving up its paint) and
//  `bristleTouchValue` is `bristleTouchFS`'s `mix`. The sentinel
//  `LAST_TOUCH_DRY_SECONDS` lives HERE, beside every other declared law:
//  the module declares each once and the engine imports it, so the
//  package-wide scan below fails the build on a second copy.
// ============================================================

const WETNESS = bristleModule as unknown as {
  LAST_TOUCH_DRY_SECONDS?: number
  bristleWetness?: (ageSeconds: number, wetSeconds: number) => number
  bristleTouchValue?: (prev: number, now: number, mask: number) => number
}

describe('the §3.4 wetness gate (64-24)', () => {
  it('declares LAST_TOUCH_DRY_SECONDS once, here: one week before the clock\'s zero', () => {
    expect(WETNESS.LAST_TOUCH_DRY_SECONDS, 'the one-week sentinel').toBe(-604800)
    const declarations = PACKAGE_SOURCES.filter(({ text }) =>
      /export const LAST_TOUCH_DRY_SECONDS\b/.test(text),
    ).map(({ file }) => file)
    expect(declarations.length, 'declared once in the package').toBe(1)
    expect(declarations[0], 'declared in playground/bristles.ts').toBe('playground/bristles.ts')
    // A cleared R32F would read 0 = "touched at t = 0", i.e. every texel wet;
    // the sentinel exists precisely so the cleared value is never 0.
    expectContains(SOURCE, 'touched at t = 0')
  })

  it('is exp(−age / wetSeconds): 1 at age 0, exp(−1) at one tack time, dry-to-float at 600 s', () => {
    expect(typeof WETNESS.bristleWetness, 'bristleWetness is exported').toBe('function')
    expect(WETNESS.bristleWetness?.(0, 7), 'fresh paint gives everything up').toBe(1)
    expect(WETNESS.bristleWetness?.(7, 7), 'one tack time in').toBeCloseTo(Math.exp(-1), 12)
    const old = WETNESS.bristleWetness?.(600, 7) ?? Number.NaN
    expect(Number.isFinite(old), 'still finite at 600 s').toBe(true)
    expect(old, '600 s is dry to float precision').toBeLessThan(1e-30)
    expect(old, 'never negative').toBeGreaterThanOrEqual(0)
  })

  it('decays monotonically in age and floors wetSeconds at 1', () => {
    const w = (age: number) => WETNESS.bristleWetness?.(age, 7) ?? Number.NaN
    expect(w(0)).toBe(1)
    expect(w(1)).toBeGreaterThan(w(7))
    expect(w(7)).toBeGreaterThan(w(60))
    expect(w(60)).toBeGreaterThan(w(600))
    // The floor: a zero, negative or non-finite tack time reads as one second.
    expect(WETNESS.bristleWetness?.(1, 0), 'zero tack time floors at 1 s').toBeCloseTo(
      Math.exp(-1),
      12,
    )
    expect(WETNESS.bristleWetness?.(1, -5), 'negative tack time floors at 1 s').toBeCloseTo(
      Math.exp(-1),
      12,
    )
    expect(WETNESS.bristleWetness?.(1, Number.NaN), 'a missing tack time is 1 s').toBeCloseTo(
      Math.exp(-1),
      12,
    )
  })

  it('reads a negative or non-finite age as 1 — never NaN, never above 1', () => {
    expect(WETNESS.bristleWetness?.(-3, 7), 'a future timestamp is not yet old').toBe(1)
    expect(WETNESS.bristleWetness?.(Number.NaN, 7)).toBe(1)
    expect(WETNESS.bristleWetness?.(Number.POSITIVE_INFINITY, 7)).toBe(1)
    const v = WETNESS.bristleWetness?.(0.5, 7) ?? Number.NaN
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  })
})

describe('bristleTouchValue — the touch refresh mix (64-24)', () => {
  it('is prev + (now − prev)·clamp01(mask): 0 keeps, 1 writes, 0.5 halves', () => {
    expect(typeof WETNESS.bristleTouchValue, 'bristleTouchValue is exported').toBe('function')
    expect(WETNESS.bristleTouchValue?.(0.2, 0.8, 0), 'mask 0 leaves the field').toBe(0.2)
    expect(WETNESS.bristleTouchValue?.(0.2, 0.8, 1), 'mask 1 writes now').toBe(0.8)
    expect(WETNESS.bristleTouchValue?.(0.2, 0.8, 0.5), 'half the way').toBeCloseTo(0.5, 12)
  })

  it('clamps the mask and always lands between its two inputs', () => {
    expect(WETNESS.bristleTouchValue?.(0.2, 0.8, 2), 'mask above 1 clamps').toBe(0.8)
    expect(WETNESS.bristleTouchValue?.(0.2, 0.8, -1), 'mask below 0 clamps').toBe(0.2)
    const table: Array<[number, number, number]> = [
      [3, 10, 0.25],
      [10, 3, 0.75],
      [-604800, 0, 0.1],
      [0, -604800, 0.9],
      [1, 1, 0.5],
    ]
    for (const [prev, now, mask] of table) {
      const v = WETNESS.bristleTouchValue?.(prev, now, mask) ?? Number.NaN
      expect(v, `between ${prev} and ${now} at mask ${mask}`).toBeGreaterThanOrEqual(
        Math.min(prev, now),
      )
      expect(v, `between ${prev} and ${now} at mask ${mask}`).toBeLessThanOrEqual(
        Math.max(prev, now),
      )
    }
  })

  it('is total: a missing time or weight never produces NaN', () => {
    // No previous → the touch writes now; no time to write → the field keeps;
    // no weight → nothing is recorded; two missing times → 0.
    expect(WETNESS.bristleTouchValue?.(Number.NaN, 10, 1), 'no previous keeps now').toBe(10)
    expect(WETNESS.bristleTouchValue?.(5, Number.NaN, 1), 'no now keeps the field').toBe(5)
    expect(WETNESS.bristleTouchValue?.(5, 10, Number.NaN), 'no weight records nothing').toBe(5)
    const v = WETNESS.bristleTouchValue?.(Number.NaN, Number.NaN, Number.NaN) ?? Number.NaN
    expect(Number.isFinite(v), 'never NaN').toBe(true)
    expect(v, 'two missing times read as 0').toBe(0)
  })
})

// ============================================================
//  261119-pod — the §3.3 smear.
//
//  Two Studio laws join the module's declared set: the §3.3 hash cell
//  (`BRISTLE_SMEAR_PERIOD_PX`, 6 px) and the §3.3 clamp (`BRISTLE_SMEAR_CAP`,
//  0.8). Each pure twin is the tested mirror of one expression in
//  `shaders.ts`: a literal that replaces a declared constant, or a second
//  copy of a law, fails the pins below. `bristleSmearRate` IS the 1:1
//  mapping (D-A): one knob, no second curve. Feather is the reference's
//  softness only — it has no constant of its own beyond the band gain.
// ============================================================

const SMEAR = bristleModule as unknown as {
  BRISTLE_SMEAR_PERIOD_PX?: number
  BRISTLE_SMEAR_CAP?: number
  bristleSmearRate?: (pickup: number) => number
  bristleSmearWeight?: (rate: number, wet: number, hash: number) => number
}

describe('the §3.3 smear constants and twins (261119-pod)', () => {
  it('declares the two constants once, beside the other stroke laws', () => {
    expect(SMEAR.BRISTLE_SMEAR_PERIOD_PX, '§3.3 hash cell period').toBe(6)
    // 2026-11-20 (artist): 1.0 — the Pickup knob's 2x response curve made the
    // reference's 0.8 bind across the whole contact band; the artist's
    // maximum must read as a full wet-on-wet pull.
    expect(SMEAR.BRISTLE_SMEAR_CAP, '§3.3 clamp').toBe(1)
    for (const [name, literal] of [
      ['BRISTLE_SMEAR_PERIOD_PX', 'export const BRISTLE_SMEAR_PERIOD_PX = 6;'],
      ['BRISTLE_SMEAR_CAP', 'export const BRISTLE_SMEAR_CAP = 1.0;'],
    ] as const) {
      expect(
        (SOURCE.match(new RegExp(literal.replaceAll('.', '\\.'), 'g')) ?? []).length,
        `${name} declared once`,
      ).toBe(1)
      const declarations = PACKAGE_SOURCES.filter(({ text }) =>
        new RegExp(`export const ${name}\\b`).test(text),
      ).map(({ file }) => file)
      expect(declarations, `${name} is declared once in the package`).toEqual([
        'playground/bristles.ts',
      ])
    }
  })

  it('bristleSmearRate is clamp01(pickup) — the 1:1 mapping, no second knob (D-A)', () => {
    expect(typeof SMEAR.bristleSmearRate, 'bristleSmearRate is exported').toBe('function')
    expect(SMEAR.bristleSmearRate?.(0), 'Pickup 0 smears nothing').toBe(0)
    expect(
      SMEAR.bristleSmearRate?.(1),
      'Pickup 100 normalises to 1.0 through the ONE mapping',
    ).toBe(1)
    expect(SMEAR.bristleSmearRate?.(0.6), 'the same number, one knob').toBeCloseTo(0.6, 12)
    expect(SMEAR.bristleSmearRate?.(1.5), 'clamped above').toBe(1)
    expect(SMEAR.bristleSmearRate?.(-0.2), 'clamped below').toBe(0)
    expect(SMEAR.bristleSmearRate?.(Number.NaN), 'a missing rate smears nothing').toBe(0)
  })

  it('bristleSmearWeight is clamp(rate·wet·hash, 0, BRISTLE_SMEAR_CAP) — monotone, zero at rate 0', () => {
    expect(typeof SMEAR.bristleSmearWeight, 'bristleSmearWeight is exported').toBe('function')
    expect(SMEAR.bristleSmearWeight?.(0, 1, 1), 'no pickup, no drag').toBe(0)
    expect(SMEAR.bristleSmearWeight?.(1, 1, 1), 'the §3.3 cap').toBeCloseTo(1, 12)
    expect(SMEAR.bristleSmearWeight?.(0.5, 0.5, 0.5)).toBeCloseTo(0.125, 12)
    expect(SMEAR.bristleSmearWeight?.(1, 1, 0.5)).toBeCloseTo(0.5, 12)
    // Monotone in each argument across its band.
    let previous = -1
    for (const rate of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      const w = SMEAR.bristleSmearWeight?.(rate, 0.8, 0.7) ?? Number.NaN
      expect(w).toBeGreaterThanOrEqual(previous)
      previous = w
    }
    previous = -1
    for (const wet of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      const w = SMEAR.bristleSmearWeight?.(1, wet, 1) ?? Number.NaN
      expect(w).toBeGreaterThanOrEqual(previous)
      previous = w
    }
    previous = -1
    for (const hash of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      const w = SMEAR.bristleSmearWeight?.(1, 1, hash) ?? Number.NaN
      expect(w).toBeGreaterThanOrEqual(previous)
      previous = w
    }
    expect(SMEAR.bristleSmearWeight?.(1, 1, 1), 'never above the cap').toBeLessThanOrEqual(1)
    expect(SMEAR.bristleSmearWeight?.(Number.NaN, 1, 1), 'a missing rate drags nothing').toBe(0)
  })
})

describe('bristleContactPressure — §3.1, the reference brush pressure (spike 004)', () => {
  const LAW = bristleModule as unknown as {
    bristleContactPressure?: (pen: number, speed: number, distPx: number, shortPx: number, pressureLink?: number, speedLink?: number) => number
    BRISTLE_PRESSURE_SLOW?: number
    BRISTLE_PRESSURE_FAST?: number
    BRISTLE_PRESSURE_SPEED?: number
    BRISTLE_PRESSURE_ATTACK?: number
    BRISTLE_PRESSURE_ATTACK_FLOOR?: number
    BRISTLE_PRESSURE_START?: number
  }

  it('carries the reference Settings values verbatim', () => {
    expect(LAW.BRISTLE_PRESSURE_SLOW).toBe(1)
    expect(LAW.BRISTLE_PRESSURE_FAST).toBe(0.42)
    expect(LAW.BRISTLE_PRESSURE_SPEED).toBe(1.4)
    expect(LAW.BRISTLE_PRESSURE_ATTACK).toBe(0.018)
    expect(LAW.BRISTLE_PRESSURE_ATTACK_FLOOR).toBe(0.45)
    expect(LAW.BRISTLE_PRESSURE_START).toBe(0.3)
  })

  it('a fast drag at full attack paints at pressureFast·pen — 0.42, not the pointer 1.0', () => {
    expect(typeof LAW.bristleContactPressure, 'bristleContactPressure is exported').toBe('function')
    expect(LAW.bristleContactPressure?.(1, 10, 100, 600), 'fast, past the attack ramp').toBeCloseTo(0.42, 12)
    expect(LAW.bristleContactPressure?.(0.75, 10, 100, 600), 'the Studio scene pen').toBeCloseTo(0.315, 12)
  })

  it('a resting brush reads pressureSlow·pen', () => {
    expect(LAW.bristleContactPressure?.(1, 0, 100, 600)).toBeCloseTo(1, 12)
    expect(LAW.bristleContactPressure?.(0.5, 0, 100, 600)).toBeCloseTo(0.5, 12)
  })

  it('the attack ramp starts at the 0.45 floor over attack·shortSide px', () => {
    expect(LAW.bristleContactPressure?.(1, 10, 0, 600)).toBeCloseTo(0.42 * 0.45, 12)
    expect(LAW.bristleContactPressure?.(1, 10, 600 * 0.018, 600)).toBeCloseTo(0.42, 12)
    expect(LAW.bristleContactPressure?.(1, 10, 3, 600)).toBeGreaterThan(LAW.bristleContactPressure?.(1, 10, 0, 600) ?? 1)
  })

  it('is monotone in speed and linear in pen pressure', () => {
    let previous = Number.POSITIVE_INFINITY
    for (const speed of [0, 0.35, 0.7, 1.05, 1.4, 4]) {
      const p = LAW.bristleContactPressure?.(1, speed, 100, 600) ?? Number.NaN
      expect(p).toBeLessThanOrEqual(previous + 1e-12)
      previous = p
    }
    expect(LAW.bristleContactPressure?.(0.5, 2, 100, 600)).toBeCloseTo(
      (LAW.bristleContactPressure?.(1, 2, 100, 600) ?? Number.NaN) / 2,
      12,
    )
  })

  it('a non-finite argument reads as the neutral value, never NaN', () => {
    expect(LAW.bristleContactPressure?.(Number.NaN, 2, 100, 600)).toBeCloseTo(0.42, 12)
    expect(LAW.bristleContactPressure?.(1, Number.NaN, 100, 600), 'a missing speed reads as rest').toBeCloseTo(1, 12)
    expect(LAW.bristleContactPressure?.(1, 2, Number.NaN, 600), 'a missing distance reads as zero travel').toBeCloseTo(0.42 * 0.45, 12)
    expect(LAW.bristleContactPressure?.(1, 2, 100, 0)).toBeCloseTo(0.42, 12)
  })

  // --- pressureLink (quick 261121-umu): how much the authored pen pressure
  // enters the CONTACT gate. 1 = the shipped law; 0 = the gate ignores the
  // authored pen while the speed and attack ramps still apply.

  it('an absent pressureLink is the shipped formula, bit for bit', () => {
    expect(typeof LAW.bristleContactPressure, 'bristleContactPressure is exported').toBe('function')
    for (const pen of [0, 0.15, 0.3, 0.75, 1]) {
      expect(LAW.bristleContactPressure?.(pen, 2, 100, 600, 1), `pen ${pen} at link 1`).toBe(
        LAW.bristleContactPressure?.(pen, 2, 100, 600),
      )
    }
    expect(LAW.bristleContactPressure?.(0.15, 10, 100, 600), 'the shipped 0.15 contact value').toBeCloseTo(0.063, 12)
  })

  it('pressureLink 0 takes the authored pen out of the contact gate', () => {
    expect(LAW.bristleContactPressure?.(0.15, 10, 100, 600, 0)).toBeCloseTo(0.42, 12)
    expect(LAW.bristleContactPressure?.(1, 10, 100, 600, 0)).toBeCloseTo(0.42, 12)
    expect(LAW.bristleContactPressure?.(0, 10, 100, 600, 0)).toBeCloseTo(0.42, 12)
  })

  it('pressureLink 0 keeps the speed ramp', () => {
    expect(LAW.bristleContactPressure?.(0.15, 0, 100, 600, 0), 'rest').toBeCloseTo(1, 12)
    expect(LAW.bristleContactPressure?.(0.15, 10, 100, 600, 0), 'fast').toBeCloseTo(0.42, 12)
    let previous = Number.POSITIVE_INFINITY
    for (const speed of [0, 0.35, 0.7, 1.05, 1.4, 4]) {
      const p = LAW.bristleContactPressure?.(0.15, speed, 100, 600, 0) ?? Number.NaN
      expect(p).toBeLessThanOrEqual(previous + 1e-12)
      previous = p
    }
  })

  it('pressureLink 0 keeps the attack ramp', () => {
    expect(LAW.bristleContactPressure?.(0.15, 10, 0, 600, 0), 'first touch').toBeCloseTo(0.42 * 0.45, 12)
    expect(LAW.bristleContactPressure?.(0.15, 10, 600 * 0.018, 600, 0), 'past the attack').toBeCloseTo(0.42, 12)
    let previous = -1
    for (const distance of [0, 3, 6, 10.8]) {
      const p = LAW.bristleContactPressure?.(0.15, 10, distance, 600, 0) ?? Number.NaN
      expect(p).toBeGreaterThanOrEqual(previous - 1e-12)
      previous = p
    }
  })

  it('pressureLink interpolates between the authored pressure and 1', () => {
    expect(LAW.bristleContactPressure?.(0.15, 10, 100, 600, 0.5), 'half link').toBeCloseTo(0.42 * 0.575, 12)
    let previous = Number.POSITIVE_INFINITY
    for (const link of [0, 0.25, 0.5, 0.75, 1]) {
      const p = LAW.bristleContactPressure?.(0.15, 10, 100, 600, link) ?? Number.NaN
      expect(p).toBeLessThanOrEqual(previous + 1e-12)
      previous = p
    }
  })

  it('a non-finite pressureLink reads as the shipped 1', () => {
    expect(LAW.bristleContactPressure?.(0.5, 2, 100, 600, Number.NaN)).toBe(
      LAW.bristleContactPressure?.(0.5, 2, 100, 600),
    )
  })

  it('the engine passes the brush pressureLink and speedLink at its ONE contact-pressure call site', () => {
    expect(ENGINE_SOURCE.match(/bristleContactPressure\s*\(/g) ?? [], 'exactly one call site').toHaveLength(1)
    expect(ENGINE_SOURCE).toMatch(
      /bristleContactPressure\(clamp\(pr, 0, 1\), s\.speed, s\.travelled \* this\.dh, this\.dh, b\.pressureLink \?\? 1, b\.speedLink \?\? 1\)/,
    )
  })

  // --- speedLink (2026-11-21, the artist's fast-hand report): how much the
  // HAND SPEED enters the CONTACT gate. 1 = the shipped law; 0 = the gate
  // ignores hand speed, so Dry alone decides whether the paint runs out.

  it('an absent speedLink is the shipped formula, bit for bit', () => {
    for (const speed of [0, 0.35, 1.4, 4]) {
      expect(LAW.bristleContactPressure?.(1, speed, 100, 600, 1, 1), `speed ${speed} at link 1`).toBe(
        LAW.bristleContactPressure?.(1, speed, 100, 600, 1),
      )
    }
    expect(LAW.bristleContactPressure?.(1, 10, 100, 600, 1, 1), 'the shipped fast contact value').toBeCloseTo(0.42, 12)
  })

  it('speedLink 0 takes the hand speed out of the contact gate', () => {
    expect(LAW.bristleContactPressure?.(1, 0, 100, 600, 1, 0), 'rest').toBeCloseTo(1, 12)
    expect(LAW.bristleContactPressure?.(1, 10, 100, 600, 1, 0), 'fast deposits like rest').toBeCloseTo(1, 12)
    expect(LAW.bristleContactPressure?.(0.15, 10, 100, 600, 0, 0), 'both links out').toBeCloseTo(1, 12)
    let previous = Number.POSITIVE_INFINITY
    for (const speed of [0, 0.35, 0.7, 1.05, 1.4, 4]) {
      const p = LAW.bristleContactPressure?.(1, speed, 100, 600, 1, 0) ?? Number.NaN
      expect(p).toBe(1)
      expect(p).toBeLessThanOrEqual(previous + 1e-12)
      previous = p
    }
  })

  it('speedLink 0 keeps the attack ramp', () => {
    expect(LAW.bristleContactPressure?.(1, 10, 0, 600, 1, 0), 'first touch').toBeCloseTo(0.45, 12)
    expect(LAW.bristleContactPressure?.(1, 10, 600 * 0.018, 600, 1, 0), 'past the attack').toBeCloseTo(1, 12)
  })

  it('speedLink interpolates between 1 and the speed ramp', () => {
    expect(LAW.bristleContactPressure?.(1, 10, 100, 600, 1, 0.5), 'half link').toBeCloseTo(0.71, 12)
    // A higher link lets more of the fast-hand ramp in, so the contact value
    // is monotone NON-INCREASING across 0 -> 1.
    let previous = Number.POSITIVE_INFINITY
    for (const link of [0, 0.25, 0.5, 0.75, 1]) {
      const p = LAW.bristleContactPressure?.(1, 10, 100, 600, 1, link) ?? Number.NaN
      expect(p).toBeLessThanOrEqual(previous + 1e-12)
      previous = p
    }
  })

  it('a non-finite speedLink reads as the shipped 1', () => {
    expect(LAW.bristleContactPressure?.(1, 10, 100, 600, 1, Number.NaN)).toBe(
      LAW.bristleContactPressure?.(1, 10, 100, 600, 1),
    )
  })

  it('Dry speed 0 binds zero depletion in the engine', () => {
    expect(ENGINE_SOURCE).toMatch(/const depletion = dryRate <= 0 \? 0 :/)
    expect(ENGINE_SOURCE).toMatch(/gl\.uniform1f\(p\.u\.uDepletion!, depletion\)/)
  })
})

// 2026-11-20 (the artist's explicit table): <50 → 1x, 100 → 2x, 200 → 4x,
// 240 → 8x, 300 → 16x, 340 → 30x, above 340 → 50x. Interpolated linearly
// between the anchors, stepped above 340, by CANONICAL Size.
describe('bristleSampleScale — the artist’s size-driven motion supersampling table', () => {
  it('is exactly 1 at and below 50 (normal sizes pay nothing)', () => {
    expect(bristleModule.bristleSampleScale(0)).toBe(1)
    expect(bristleModule.bristleSampleScale(1)).toBe(1)
    expect(bristleModule.bristleSampleScale(50)).toBe(1)
  })

  it('hits every anchor of the table', () => {
    expect(bristleModule.bristleSampleScale(100)).toBeCloseTo(2, 12)
    expect(bristleModule.bristleSampleScale(200)).toBeCloseTo(4, 12)
    expect(bristleModule.bristleSampleScale(240)).toBeCloseTo(8, 12)
    expect(bristleModule.bristleSampleScale(300)).toBeCloseTo(16, 12)
    expect(bristleModule.bristleSampleScale(340)).toBeCloseTo(30, 12)
  })

  it('interpolates linearly between anchors', () => {
    expect(bristleModule.bristleSampleScale(75)).toBeCloseTo(1.5, 12)
    expect(bristleModule.bristleSampleScale(150)).toBeCloseTo(3, 12)
    expect(bristleModule.bristleSampleScale(220)).toBeCloseTo(6, 12)
    expect(bristleModule.bristleSampleScale(270)).toBeCloseTo(12, 12)
    expect(bristleModule.bristleSampleScale(320)).toBeCloseTo(23, 12)
  })

  it('steps to 50x above 340 and never decreases', () => {
    expect(bristleModule.bristleSampleScale(341)).toBe(50)
    expect(bristleModule.bristleSampleScale(800)).toBe(50)
    expect(bristleModule.bristleSampleScale(Number.NaN)).toBe(50)
    let previous = 0
    for (let px = 0; px <= 500; px += 1) {
      const scale = bristleModule.bristleSampleScale(px)
      expect(scale).toBeGreaterThanOrEqual(previous)
      previous = scale
    }
  })
})
