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
//   5. The law ships as a SHADER PERMUTATION: the engine's default program
//      is the NEUTRAL gather (the pre-change source, byte-for-byte) and the
//      EXTENDED program — the law — compiles lazily the first time the
//      driven noise is above 0 or the falloff leaves 50. Both come from the
//      ONE generator, and slider 20 (drive 0) stays on the neutral path.
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// The namespace cast keeps a not-yet-exported symbol a clean per-test
// assertion failure instead of a module-load error for the whole suite.
import * as bristleModule from './bristles'
import * as shadersModule from './shaders'
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
  featherNoiseDrive?: (n: number) => number
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
//  The law's source pins. The pure twins above prove the arithmetic; these
//  prove the GLSL and the ONE gather binder carry the law the artist approved
//  on 2026-11-27 (rulings 2026-11-27e/f/g/h):
//
//   * Feather noise is a DEPTH-OF-PENETRATION control, not an amplitude: a
//     single wavy FRONT is displaced inward, paint outside it is removed, and
//     the body inside stays plain (never a field of holes).
//   * The front is displaced by the natural three-scale cloud (20/60/200 px)
//     and a contained fringe + sparse outward SPIKES ride the same field.
//   * The slider is the artist's scale; `featherNoiseDrive` maps it so that
//     0..20 is the plain block, 40 the light fringe, 60 the medium and 100 the
//     full halo, interpolating in between.
//   * Feather falloff still shapes the shipped rim opening with the ONE
//     exponent map, skipping pow at 50.
// ============================================================

const LAW_UNIFORMS = [
  'uFeatherFalloff',
  'uFeatherNoise',
  'uFeatherNoiseAnchor',
  'uFeatherNoiseLift',
] as const

const ENGINE_SOURCE =
  PACKAGE_SOURCES.find(({ file }) => file === 'playground/Engine.ts')?.text ?? ''

describe('the Spec 11 law in BRISTLE_GATHER', () => {
  it('declares the law uniforms beside the shipped feather anchors', () => {
    for (const name of LAW_UNIFORMS) {
      expect(BRISTLE_GATHER.includes(`uniform float ${name};`), `${name} is declared`).toBe(true)
    }
  })

  it('binds every law uniform from the ONE gather binder', () => {
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherFalloff!, clamp(this.params.featherFalloff, 0, 1));',
    )
    // The slider is the artist's scale; the DRIVE is what the shader reads.
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoise!, clamp(featherNoiseDrive(this.params.featherNoise), 0, 1));',
    )
    // The front's anchor is the Edge-transparency span, never a re-typed 0.9.
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseAnchor!, BRISTLE_LAYER_EDGE);',
    )
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseLift!, FEATHER_NOISE_LIFT);',
    )
  })

  it('shapes the opening with the shipped exponent map and SKIPS pow at falloff 50', () => {
    expect(BRISTLE_GATHER).toContain(
      'float featherShift = uFeather * uFeatherShift * smoothstep(featherStart, uFeatherEdge, lateral);',
    )
    expect(BRISTLE_GATHER).toContain('if (uFeatherFalloff != 0.5) {')
    expect(BRISTLE_GATHER).toContain('exp2(2.0 * uFeatherFalloff - 1.0)')
  })

  it('removes paint outside a wavy FRONT and keeps the body plain (no field of holes)', () => {
    expect(BRISTLE_GATHER).toContain('float pen = mix(0.88, 0.35, uFeatherNoise);')
    expect(BRISTLE_GATHER).toContain('float wobble = cloudMix(css);')
    expect(BRISTLE_GATHER).toContain('float front = pen + wobble * 0.30;')
    expect(BRISTLE_GATHER).toContain(
      'float envelope = smoothstep(front - 0.015, front + 0.015, uN);',
    )
    // One radial front = no detached islands in the body.
    expect(BRISTLE_GATHER).toContain('featherShift += uFeather * uFeatherNoiseLift * envelope;')
  })

  it('rides the three-scale cloud: 20 / 60 / 200 document px, summed SIGNED', () => {
    expect(BRISTLE_GATHER).toContain('cloudNoise(css / 20.0 + 19.0)')
    expect(BRISTLE_GATHER).toContain('cloudNoise(css / 60.0 + 71.0)')
    expect(BRISTLE_GATHER).toContain('cloudNoise(css / 200.0 + 133.0)')
  })

  it('carries the contained fringe and the sparse outward spikes', () => {
    // The fringe: a narrow band straddling the front, perforated by the cloud.
    expect(BRISTLE_GATHER).toContain('float band = exp(-pow((uN - (front - 0.07)) / 0.11, 2.0));')
    expect(BRISTLE_GATHER).toContain('float spray = clamp(max(cloudMix(css * 3.1 + 23.0), 0.0) * 14.0, 0.0, 1.3);')
    // The spikes: sparse peaks of a slow field that reach OUTSIDE the base edge.
    expect(BRISTLE_GATHER).toContain('float spikeField = cloudMix(css * 0.8 + 41.0);')
    expect(BRISTLE_GATHER).toContain('float spike = smoothstep(0.10, 0.34, spikeField);')
    expect(BRISTLE_GATHER).toContain('float reach = mix(0.12, 0.40, uFeatherNoise);')
  })

  it('keeps the shipped threshold expression and its anchors byte-identical', () => {
    expect(BRISTLE_GATHER).toContain(
      'float featherStart = uFeatherEdge * (1.0 - mix(uFeatherMin, uFeatherReach, uFeather));',
    )
    // PRE's paper height, verbatim — the neutral path compiles from this line.
    expect(BRISTLE_GATHER).toContain(
      'float height = mix(grainHeight(css, uAxis), 0.5, rimCalm);',
    )
    expect(BRISTLE_GATHER).toContain(
      'float threshold = uGrain * (1.0 - height) - 0.25 + featherShift;',
    )
  })

  it('maps the artist slider onto the drive (0..20 plain, 40 light, 60 medium, 100 full)', () => {
    const drive = FEATHER_NOISE.featherNoiseDrive
    expect(typeof drive, 'featherNoiseDrive is exported').toBe('function')
    expect(drive!(0)).toBe(0)
    expect(drive!(0.2)).toBe(0)
    expect(drive!(0.4)).toBeCloseTo(0.2, 12)
    expect(drive!(0.6)).toBeCloseTo(0.4, 12)
    expect(drive!(1)).toBeCloseTo(1, 12)
    // Monotone and total: a non-finite slider reads the plain block.
    expect(drive!(Number.NaN)).toBe(0)
    expect(drive!(2)).toBeCloseTo(1, 12)
  })

  it('keeps bristleCarrierFS free of the law uniforms', () => {
    for (const name of LAW_UNIFORMS) {
      expect(bristleCarrierFS.includes(name), `${name} never reaches the carrier`).toBe(false)
    }
  })
})

// ============================================================
//  The neutral/extended permutation — the identity gate (2026-11-27).
//
//  Adding code to a program shifts the driver's codegen by ~1 LSB even when
//  the added block never runs (measured: the A2 restructure still moved the
//  noise-0 digests). The law therefore lives in a SECOND program: the
//  engine's default is the NEUTRAL gather — the pre-change source with no
//  cloud, no law uniforms and no reshuffled statement — and the EXTENDED
//  program (the law) is compiled lazily the first time the DRIVEN noise is
//  above 0 or the falloff leaves 50. Both variants come from ONE generator,
//  so the rest of the gather can never diverge between them.
// ============================================================

const SHADERS = shadersModule as unknown as {
  bristleGatherSource?: (extended: boolean) => string
  BRISTLE_GATHER_NEUTRAL?: string
  bristleDepositFS?: string
  bristleCoverFS?: string
  bristleReliefFS?: string
  bristleCoverLayerFS?: string
  bristleDepositNeutralFS?: string
  bristleCoverNeutralFS?: string
  bristleReliefNeutralFS?: string
  bristleCoverLayerNeutralFS?: string
}

describe('the neutral/extended gather permutation', () => {
  it('builds both variants from the ONE generator', () => {
    expect(typeof SHADERS.bristleGatherSource, 'bristleGatherSource is exported').toBe('function')
    expect(SHADERS.bristleGatherSource?.(true), 'extended is the law source').toBe(BRISTLE_GATHER)
    expect(SHADERS.bristleGatherSource?.(false), 'neutral is the shipped source').toBe(
      SHADERS.BRISTLE_GATHER_NEUTRAL,
    )
    expect(typeof SHADERS.BRISTLE_GATHER_NEUTRAL, 'the neutral variant is exported').toBe('string')
  })

  it('keeps the neutral source free of the law — no cloud, no uniforms, no branch', () => {
    const neutral = SHADERS.BRISTLE_GATHER_NEUTRAL ?? ''
    for (const token of [
      'cloudNoise',
      'cloudMix',
      'uFeatherFalloff',
      'uFeatherNoise',
      'uFeatherNoiseLift',
      'exp2(2.0 * uFeatherFalloff - 1.0)',
    ]) {
      expect(neutral.includes(token), `neutral never carries ${token}`).toBe(false)
    }
  })

  it('keeps the neutral gather in PRE order: height before featherStart, one threshold', () => {
    const neutral = SHADERS.BRISTLE_GATHER_NEUTRAL ?? ''
    const height = 'float height = mix(grainHeight(css, uAxis), 0.5, rimCalm);'
    expect(neutral.split(height).length - 1, 'one height statement').toBe(1)
    expect(neutral.indexOf(height), 'height precedes featherStart').toBeLessThan(
      neutral.indexOf('float featherStart ='),
    )
    expect(neutral).toContain(
      'float featherShift = uFeather * uFeatherShift * smoothstep(featherStart, uFeatherEdge, lateral);',
    )
    expect(neutral).toContain('float threshold = uGrain * (1.0 - height) - 0.25 + featherShift;')
  })

  it('exports a neutral consumer for every gather program, law-free', () => {
    const pairs = [
      ['bristleDepositNeutralFS', 'bristleDepositFS'],
      ['bristleCoverNeutralFS', 'bristleCoverFS'],
      ['bristleReliefNeutralFS', 'bristleReliefFS'],
      ['bristleCoverLayerNeutralFS', 'bristleCoverLayerFS'],
    ] as const
    for (const [neutralName, extendedName] of pairs) {
      const neutral = SHADERS[neutralName]
      expect(typeof neutral, `${neutralName} is exported`).toBe('string')
      expect(neutral, `${neutralName} composes the neutral gather`).toContain(
        SHADERS.BRISTLE_GATHER_NEUTRAL,
      )
      expect(neutral, `${neutralName} never carries the law`).not.toContain('uFeatherNoise')
      expect(SHADERS[extendedName], `${extendedName} keeps the law`).toContain('uFeatherNoise')
    }
  })

  it('runs the neutral programs by default and compiles the law variants lazily', () => {
    expect(ENGINE_SOURCE).toContain(
      'this.programs.bristleDeposit = this.g.program(S.bristleDepositNeutralFS);',
    )
    expect(ENGINE_SOURCE).toContain(
      'this.programs.bristleCover = this.g.program(S.bristleCoverNeutralFS);',
    )
    expect(ENGINE_SOURCE).toContain(
      'this.programs.bristleRelief = this.g.program(S.bristleReliefNeutralFS);',
    )
    expect(ENGINE_SOURCE).toContain(
      'this.programs.bristleCoverLayer = this.g.program(S.bristleCoverLayerNeutralFS);',
    )
    // Lazy: the extended sources compile inside the selector, never the ctor.
    expect(ENGINE_SOURCE).toContain('this.gatherLaw ??= {')
    expect(ENGINE_SOURCE).toContain('this.g.program(S.bristleDepositExtendedFS)')
    expect(ENGINE_SOURCE).toContain('this.g.program(S.bristleCoverExtendedFS)')
    expect(ENGINE_SOURCE).toContain('this.g.program(S.bristleReliefExtendedFS)')
    expect(ENGINE_SOURCE).toContain('this.g.program(S.bristleCoverLayerExtendedFS)')
    expect(ENGINE_SOURCE).not.toContain(
      'this.programs.bristleDeposit = this.g.program(S.bristleDepositFS);',
    )
  })

  it('selects by driven noise > 0 OR falloff != 50 — slider 20 stays neutral', () => {
    expect(ENGINE_SOURCE).toContain('featherNoiseDrive(this.params.featherNoise) > 0')
    expect(ENGINE_SOURCE).toContain('this.params.featherFalloff !== 0.5')
    // The drive is flat across 0..20, so the slider's first stop is the
    // neutral path: 20 reads drive 0.
    expect(FEATHER_NOISE.featherNoiseDrive?.(0.2)).toBe(0)
    for (const which of [
      'bristleDeposit',
      'bristleCover',
      'bristleRelief',
      'bristleCoverLayer',
    ]) {
      expect(ENGINE_SOURCE).toContain(`this.gatherProgram('${which}')`)
    }
  })
})
