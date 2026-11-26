// ============================================================
//  featherNoise.test.ts — Spec 11: Feather noise and Feather falloff.
//
//  The feather band is radius-relative: at small brush sizes it is
//  narrower than the paper's cloud features, so the rim reads smooth.
//  Spec 11 gives the artist a brush-relative grain (Feather noise) whose
//  FEATURE SIZE is derived from the feather band, with a pixel floor so
//  the specks survive on tiny brushes, mixed INTO the paper tooth
//  (never replacing it). Feather falloff distributes both the shipped
//  rim opening and the interior grain with the SAME exponent map Edge
//  falloff uses — one shape language, no second table.
//
//  Laws pinned here:
//   1. The four starting constants (4 / 2 / 16 / 1.1) — the probe's
//      calibration targets, so a silent drift must fail a test.
//   2. `featherNoisePeriodPx(bandPx)` = clamp(bandPx / FEATURES, MIN, MAX):
//      the band holds a fixed number of features, floored at 2 px and
//      capped at 16 px. Non-finite / non-positive band -> the floor.
//   3. `featherNoiseScale(bandPx)` = REFERENCE_PX / period: the zoom
//      factor the shader applies to the paper sampling coordinate.
//      Always finite and > 0, never NaN.
//   4. `edgeFalloffExponent` is declared ONCE in the package: Spec 11
//      reuses the shipped twin, it never adds a second exponent map.
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// The namespace cast keeps a not-yet-exported symbol a clean per-test
// assertion failure instead of a module-load error for the whole suite.
import * as bristleModule from './bristles'
import { BRISTLE_GATHER, bristleCarrierFS } from './shaders'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = resolve(HERE, '..')

const FEATHER_NOISE = bristleModule as unknown as {
  FEATHER_NOISE_FEATURES?: number
  FEATHER_NOISE_MIN_PX?: number
  FEATHER_NOISE_MAX_PX?: number
  FEATHER_NOISE_REFERENCE_PX?: number
  featherNoisePeriodPx?: (bandPx: number) => number
  featherNoiseScale?: (bandPx: number) => number
}

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

describe('the Spec 11 feather-noise constants', () => {
  it('pins the four starting values the probe calibrates against', () => {
    expect(FEATHER_NOISE.FEATHER_NOISE_FEATURES, 'features across the band').toBe(4)
    expect(FEATHER_NOISE.FEATHER_NOISE_MIN_PX, 'the pixel floor at tiny brushes').toBe(2)
    expect(FEATHER_NOISE.FEATHER_NOISE_MAX_PX, 'the period ceiling').toBe(16)
    expect(FEATHER_NOISE.FEATHER_NOISE_REFERENCE_PX, 'the tooth reference period').toBe(1.1)
  })
})

describe('featherNoisePeriodPx — the band-relative feature period', () => {
  it('holds a fixed feature count across the band, floored at 2 px and capped at 16', () => {
    expect(typeof FEATHER_NOISE.featherNoisePeriodPx, 'featherNoisePeriodPx is exported').toBe(
      'function',
    )
    // band / 4, clamped: 8 -> 2 (the floor), 24 -> 6, 1000 -> 16 (the max).
    expect(FEATHER_NOISE.featherNoisePeriodPx?.(8), 'band 8 sits on the floor').toBeCloseTo(2, 12)
    expect(FEATHER_NOISE.featherNoisePeriodPx?.(24), 'band 24 reads 6').toBeCloseTo(6, 12)
    expect(FEATHER_NOISE.featherNoisePeriodPx?.(1000), 'band 1000 sits on the cap').toBeCloseTo(
      16,
      12,
    )
  })

  it('is a total function: a missing band reads the floor, never NaN', () => {
    expect(FEATHER_NOISE.featherNoisePeriodPx?.(0), 'a zero band').toBeCloseTo(2, 12)
    expect(FEATHER_NOISE.featherNoisePeriodPx?.(-4), 'a negative band').toBeCloseTo(2, 12)
    expect(FEATHER_NOISE.featherNoisePeriodPx?.(Number.NaN), 'a missing band').toBeCloseTo(2, 12)
    expect(
      FEATHER_NOISE.featherNoisePeriodPx?.(Number.POSITIVE_INFINITY),
      'an unrepresentable band',
    ).toBeCloseTo(2, 12)
    expect(
      FEATHER_NOISE.featherNoisePeriodPx?.(Number.NEGATIVE_INFINITY),
      'an unrepresentable band',
    ).toBeCloseTo(2, 12)
    expect(Number.isNaN(FEATHER_NOISE.featherNoisePeriodPx?.(Number.NaN) ?? Number.NaN)).toBe(false)
  })

  it('never decreases as the band widens and stays inside [MIN, MAX]', () => {
    let previous = 0
    for (let band = 0; band <= 100; band += 1) {
      const period = FEATHER_NOISE.featherNoisePeriodPx?.(band) ?? Number.NaN
      expect(period).toBeGreaterThanOrEqual(previous)
      expect(period).toBeGreaterThanOrEqual(
        FEATHER_NOISE.FEATHER_NOISE_MIN_PX ?? Number.NaN,
      )
      expect(period).toBeLessThanOrEqual(FEATHER_NOISE.FEATHER_NOISE_MAX_PX ?? Number.NaN)
      previous = period
    }
  })
})

describe('featherNoiseScale — the sampling zoom the shader applies', () => {
  it('maps the reference period onto the derived band period', () => {
    expect(typeof FEATHER_NOISE.featherNoiseScale, 'featherNoiseScale is exported').toBe('function')
    // REFERENCE / period: 1.1 / 2 = 0.55; 1.1 / 16 = 0.06875; 1.1 / 6 = 0.18333…
    expect(FEATHER_NOISE.featherNoiseScale?.(0), 'band 0 reads the floor period').toBeCloseTo(
      0.55,
      12,
    )
    expect(FEATHER_NOISE.featherNoiseScale?.(1000), 'band 1000 reads the cap period').toBeCloseTo(
      0.06875,
      12,
    )
    expect(FEATHER_NOISE.featherNoiseScale?.(24), 'band 24 reads 1.1 / 6').toBeCloseTo(
      0.18333333333333,
      12,
    )
  })

  it('is always finite, strictly positive and never NaN', () => {
    for (const band of [0, -4, Number.NaN, Number.POSITIVE_INFINITY, 4, 8, 12, 24, 40, 200, 1000]) {
      const scale = FEATHER_NOISE.featherNoiseScale?.(band) ?? Number.NaN
      expect(Number.isFinite(scale), `band ${band} reads a finite scale`).toBe(true)
      expect(scale, `band ${band} reads a positive scale`).toBeGreaterThan(0)
    }
  })
})

describe('the one exponent map', () => {
  it('declares edgeFalloffExponent once in the package — Spec 11 adds no second table', () => {
    const declarations = PACKAGE_SOURCES.filter(({ text }) =>
      /export function edgeFalloffExponent\b/.test(text),
    ).map(({ file }) => file)
    expect(declarations.length, 'edgeFalloffExponent is declared once in the package').toBe(1)
    expect(declarations[0], 'edgeFalloffExponent is declared in playground/bristles.ts').toBe(
      'playground/bristles.ts',
    )
  })
})

// ============================================================
//  The law's source pins (Task 2). The pure twins above prove the
//  arithmetic; these prove the GLSL and the ONE gather binder carry the
//  same law: six uniforms declared and bound, the shaped opening with the
//  falloff-50 pow skip, the guarded falloff-profile grain mix, the shipped
//  threshold anchors untouched, and no Spec 11 uniform in the carrier.
// ============================================================

const SIX_FEATHER_UNIFORMS = [
  'uFeatherFalloff',
  'uFeatherNoise',
  'uFeatherNoiseFeatures',
  'uFeatherNoiseMinPx',
  'uFeatherNoiseMaxPx',
  'uFeatherNoiseRefPx',
] as const

const ENGINE_SOURCE =
  PACKAGE_SOURCES.find(({ file }) => file === 'playground/Engine.ts')?.text ?? ''

describe('the Spec 11 law in BRISTLE_GATHER', () => {
  it('declares the six uniforms beside the shipped feather anchors', () => {
    for (const name of SIX_FEATHER_UNIFORMS) {
      expect(BRISTLE_GATHER.includes(`uniform float ${name};`), `${name} is declared`).toBe(true)
    }
  })

  it('binds every uniform from the ONE gather binder (params + bristles.ts constants)', () => {
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherFalloff!, clamp(this.params.featherFalloff, 0, 1));',
    )
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoise!, clamp(this.params.featherNoise, 0, 1));',
    )
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseFeatures!, FEATHER_NOISE_FEATURES);',
    )
    expect(ENGINE_SOURCE).toContain('gl.uniform1f(p.u.uFeatherNoiseMinPx!, FEATHER_NOISE_MIN_PX);')
    expect(ENGINE_SOURCE).toContain('gl.uniform1f(p.u.uFeatherNoiseMaxPx!, FEATHER_NOISE_MAX_PX);')
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseRefPx!, FEATHER_NOISE_REFERENCE_PX);',
    )
  })

  it('shapes the opening with the shipped exponent map and SKIPS pow at falloff 50', () => {
    // The one shape language: 2^(2b-1) — the tested twin edgeFalloffExponent's
    // expression, never a second table.
    expect(BRISTLE_GATHER).toContain('float e = exp2(2.0 * uFeatherFalloff - 1.0);')
    // pow(x, 1.0) is not guaranteed exact: the neutral half skips it so the
    // shipped bytes survive byte-identically.
    expect(BRISTLE_GATHER).toContain('float shaped = (uFeatherFalloff == 0.5) ? s : pow(s, e);')
    expect(BRISTLE_GATHER).toContain('float featherShift = uFeather * uFeatherShift * shaped;')
  })

  it('evaluates the second grainHeight sample only inside the w guard (noise 0 skips it)', () => {
    // amount x Feather x the falloff profile — the grain speaks the Edge
    // transparency language, so falloff 0 reaches deep and 100 hugs the rim.
    expect(BRISTLE_GATHER).toContain('float w = uFeatherNoise * uFeather * bodyW;')
    const guard = /if \(w > ([^)]+)\) \{/.exec(BRISTLE_GATHER)
    expect(guard, 'the grain mix is guarded by w').not.toBeNull()
    const start = guard!.index + guard![0].length
    const block = BRISTLE_GATHER.slice(start, BRISTLE_GATHER.indexOf('}', start))
    expect(block).toContain(
      'float periodPx = clamp(bandPx / uFeatherNoiseFeatures, uFeatherNoiseMinPx, uFeatherNoiseMaxPx);',
    )
    expect(block).toContain('float rimScale = uFeatherNoiseRefPx / periodPx;')
    expect(block).toContain('float rimGrain = grainHeight(css * rimScale, uAxis);')
    // mix, never replace: the paper stays visible at every setting.
    expect(block).toContain('height = mix(heightPaper, rimGrain, w);')
  })

  it('keeps the shipped threshold expression and its anchors byte-identical', () => {
    expect(BRISTLE_GATHER).toContain(
      'float featherStart = uFeatherEdge * (1.0 - mix(uFeatherMin, uFeatherReach, uFeather));',
    )
    // The paper height keeps its shipped EXPRESSION; only its identifier moved.
    expect(BRISTLE_GATHER).toContain(
      'float heightPaper = mix(grainHeight(css, uAxis), 0.5, rimCalm);',
    )
    expect(BRISTLE_GATHER).toContain('float height = heightPaper;')
    expect(BRISTLE_GATHER).toContain(
      'float threshold = uGrain * (1.0 - height) - 0.25 + featherShift;',
    )
  })

  it('keeps bristleCarrierFS free of the six Spec 11 uniforms', () => {
    for (const name of SIX_FEATHER_UNIFORMS) {
      expect(bristleCarrierFS.includes(name), `${name} never reaches the carrier`).toBe(false)
    }
  })
})
