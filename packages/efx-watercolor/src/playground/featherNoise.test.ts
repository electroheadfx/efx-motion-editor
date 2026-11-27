// ============================================================
//  featherNoise.test.ts — Spec 11: Feather noise and Feather falloff.
//
//  The delivered law (2026-11-27) is a DEPTH-OF-PENETRATION break-up: paint
//  outside a wavy front rides the natural three-scale cloud (20 / 60 / 200
//  document px) and is removed, the interior stays a continuous core, and the
//  mark never paints beyond the shipped base silhouette. The artist's
//  re-index (2026-11-27k) then fixes the slider's meaning:
//
//     0    a CLEAN edge — the shipped Feather raggedness scaled to zero
//     20   the delivered BASE look — the neutral program, byte-identical
//     40   light break-up · 60 medium · 100 the full three-scale break-up
//
//  The original Spec 11 band-relative grain twins (features / floor / cap /
//  reference) survive as the pure helper library the probe's band readout
//  uses; they no longer describe the shader law.
//
//  Laws pinned here:
//   1. The four band constants (4 / 2 / 16 / 1.1) and their period / scale
//      twins — the probe's calibration targets; a silent drift must fail.
//   2. `edgeFalloffExponent` is declared ONCE in the package: the falloff
//      reuses the shipped twin, it never adds a second exponent map.
//   3. The re-index twins: `featherNoiseDrive` (0 at and below 20, then
//      linear to 1 at 100) and `featherEdgeClean` (smoothstep(0, 20, slider):
//      0 at 0, exactly 1 from 20 up), both total and monotone.
//   4. The law ships as a SHADER PERMUTATION: the engine's default is the
//      NEUTRAL gather (the pre-change source, byte-for-byte) at slider 20 and
//      falloff 50; the EXTENDED program — clean edge + break-up — compiles
//      lazily for slider 0 or above 20, or falloff off 50.
//   5. Above 20 the noisy mark may only REMOVE paint from the shipped base
//      mark: the final shift is floored at the shipped shift, so no outward
//      fibers or spikes can exist while the footprint keeps its width.
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
  FEATHER_NOISE_NEUTRAL?: number
  featherNoisePeriodPx?: (bandPx: number) => number
  featherNoiseScale?: (bandPx: number) => number
  featherNoiseDrive?: (n: number) => number
  featherEdgeClean?: (n: number) => number
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

describe('the Spec 11 band constants (the probe helper library)', () => {
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

describe('featherNoiseScale — the sampling zoom the probe derives', () => {
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
//  The re-index twins (artist ruling 2026-11-27k). The slider is the artist's
//  scale; the shader reads two derived weights:
//
//   * `featherNoiseDrive` — the break-up amount: 0 at and below 20, linear to
//     the full erosion at 100.
//   * `featherEdgeClean` — the shipped Feather raggedness scale:
//     smoothstep(0, 20, slider), 0 at 0 (a CLEAN edge) and exactly 1 from 20
//     up (the delivered base look).
// ============================================================

describe('the re-indexed Feather-noise slider', () => {
  it('pins the neutral slider value at 20 canonical (0.2 normalised)', () => {
    expect(FEATHER_NOISE.FEATHER_NOISE_NEUTRAL, 'the neutral point').toBe(0.2)
  })

  it('maps the slider onto the break-up drive: flat through 20, then linear to 100', () => {
    const drive = FEATHER_NOISE.featherNoiseDrive
    expect(typeof drive, 'featherNoiseDrive is exported').toBe('function')
    expect(drive!(0), 'slider 0 is the clean edge, no break-up').toBe(0)
    expect(drive!(0.1), 'slider 10 is still below the neutral point').toBe(0)
    expect(drive!(0.2), 'slider 20 is the neutral base look').toBe(0)
    expect(drive!(0.4), 'slider 40 is light break-up').toBeCloseTo(0.25, 12)
    expect(drive!(0.6), 'slider 60 is medium break-up').toBeCloseTo(0.5, 12)
    expect(drive!(1), 'slider 100 is the full break-up').toBeCloseTo(1, 12)
    // Total: a non-finite slider reads the neutral drive; out-of-track clamps.
    expect(drive!(Number.NaN)).toBe(0)
    expect(drive!(-1)).toBe(0)
    expect(drive!(2)).toBeCloseTo(1, 12)
    // Monotone across the whole track.
    let previous = 0
    for (let i = 0; i <= 100; i += 1) {
      const value = drive!(i / 100)
      expect(value).toBeGreaterThanOrEqual(previous)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      previous = value
    }
  })

  it('scales the shipped edge raggedness: clean at 0, exactly the base from 20 up', () => {
    const clean = FEATHER_NOISE.featherEdgeClean
    expect(typeof clean, 'featherEdgeClean is exported').toBe('function')
    expect(clean!(0), 'slider 0 is the clean edge').toBe(0)
    expect(clean!(0.1), 'slider 10 is the smoothstep midpoint').toBeCloseTo(0.5, 12)
    expect(clean!(0.2), 'slider 20 restores the shipped edge exactly').toBe(1)
    expect(clean!(0.3), 'above 20 the weight is exactly 1').toBe(1)
    expect(clean!(1), 'slider 100 keeps the shipped edge').toBe(1)
    // Total: a missing slider replays the shipped edge, never NaN.
    expect(clean!(Number.NaN)).toBe(1)
    expect(clean!(-1)).toBe(0)
    expect(clean!(2)).toBe(1)
    // Monotone and bounded.
    let previous = 0
    for (let i = 0; i <= 100; i += 1) {
      const value = clean!(i / 100)
      expect(value).toBeGreaterThanOrEqual(previous)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      previous = value
    }
  })
})

// ============================================================
//  The law's source pins. The pure twins above prove the arithmetic; these
//  prove the GLSL and the ONE gather binder carry the law the artist approved
//  on 2026-11-27 (rulings 2026-11-27e/f/g) as re-indexed on 2026-11-27k:
//
//   * Feather noise is a DEPTH-OF-PENETRATION control: a single wavy FRONT is
//     displaced inward, paint outside it is removed, and the body inside stays
//     plain (never a field of holes).
//   * The front is displaced by the natural three-scale cloud (20/60/200 px);
//     a contained fringe and sparse chips ride the same field.
//   * Slider 0 scales the shipped raggedness to zero (CLEAN edge); slider 20
//     is the delivered base; above 20 the drive erodes.
//   * The chip terms are floored at the shipped shift, so the noisy mark can
//     only remove paint from the base mark — no outward fibers or spikes.
//   * Feather falloff still shapes the shipped rim opening with the ONE
//     exponent map, skipping pow at 50.
// ============================================================

const LAW_UNIFORMS = [
  'uFeatherFalloff',
  'uFeatherNoise',
  'uFeatherNoiseAnchor',
  'uFeatherNoiseLift',
  'uFeatherEdgeClean',
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
    // The clean-edge weight travels beside it: 0 at slider 0, 1 from 20 up.
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherEdgeClean!, clamp(featherEdgeClean(this.params.featherNoise), 0, 1));',
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

  it('scales the shipped raggedness by the clean-edge weight after the falloff branch', () => {
    expect(BRISTLE_GATHER).toContain('featherShift *= uFeatherEdgeClean;')
    const falloffBranch = BRISTLE_GATHER.indexOf('if (uFeatherFalloff != 0.5) {')
    const clean = BRISTLE_GATHER.indexOf('featherShift *= uFeatherEdgeClean;')
    const noiseBlock = BRISTLE_GATHER.indexOf('if (uFeatherNoise * uFeather > 0.0) {')
    expect(falloffBranch, 'the falloff branch exists').toBeGreaterThanOrEqual(0)
    expect(clean, 'the clean-edge scale follows the falloff branch').toBeGreaterThan(falloffBranch)
    expect(clean, 'the clean-edge scale precedes the noise block').toBeLessThan(noiseBlock)
  })

  it('removes paint outside a wavy FRONT and keeps the body plain (no field of holes)', () => {
    expect(BRISTLE_GATHER).toContain('float pen = mix(0.88, 0.35, uFeatherNoise);')
    expect(BRISTLE_GATHER).toContain('float wobble = cloudMix(css);')
    expect(BRISTLE_GATHER).toContain('float front = pen + wobble * 0.30;')
    // The front is SOFTENED (±0.04 uN ~ 4 px at Size 120): a hard cut read
    // pixelised (artist ruling 2026-11-27k).
    expect(BRISTLE_GATHER).toContain(
      'float envelope = smoothstep(front - 0.04, front + 0.04, uN);',
    )
    // One radial front = no detached islands in the body.
    expect(BRISTLE_GATHER).toContain('featherShift += uFeather * uFeatherNoiseLift * envelope;')
  })

  it('rides the three-scale cloud: 20 / 60 / 200 document px, summed SIGNED', () => {
    expect(BRISTLE_GATHER).toContain('cloudNoise(css / 20.0 + 19.0)')
    expect(BRISTLE_GATHER).toContain('cloudNoise(css / 60.0 + 71.0)')
    expect(BRISTLE_GATHER).toContain('cloudNoise(css / 200.0 + 133.0)')
  })

  it('carries the contained fringe and the sparse chip peaks', () => {
    // The fringe: a narrow band straddling the front, perforated by the cloud.
    expect(BRISTLE_GATHER).toContain('float band = exp(-pow((uN - (front - 0.07)) / 0.11, 2.0));')
    expect(BRISTLE_GATHER).toContain('float spray = clamp(max(cloudMix(css * 3.1 + 23.0), 0.0) * 14.0, 0.0, 1.3);')
    // The chip peaks: sparse tops of a slow field.
    expect(BRISTLE_GATHER).toContain('float spikeField = cloudMix(css * 0.8 + 41.0);')
    expect(BRISTLE_GATHER).toContain('float spike = smoothstep(0.10, 0.34, spikeField);')
    expect(BRISTLE_GATHER).toContain('float reach = mix(0.12, 0.40, uFeatherNoise);')
  })

  it('floors the chip terms at the shipped shift — the mark may only remove paint', () => {
    // The shipped shift is captured before the noise block touches it...
    const capture = BRISTLE_GATHER.indexOf('float shippedShift = featherShift;')
    const erosion = BRISTLE_GATHER.indexOf(
      'featherShift += uFeather * uFeatherNoiseLift * envelope;',
    )
    expect(capture, 'the shipped shift is captured').toBeGreaterThanOrEqual(0)
    expect(capture, 'the capture precedes the erosion').toBeLessThan(erosion)
    // ...and the noisy result is floored at it, so no chip can paint beyond
    // the base silhouette (the re-index's no-outward-spikes law).
    expect(BRISTLE_GATHER).toContain('featherShift = max(featherShift, shippedShift);')
    const clamp = BRISTLE_GATHER.indexOf('featherShift = max(featherShift, shippedShift);')
    const reach = BRISTLE_GATHER.indexOf('featherShift -= uFeather * spike * reach;')
    expect(clamp, 'the floor follows every chip term').toBeGreaterThan(reach)
  })

  it('keeps the shipped threshold expression and its anchors byte-identical', () => {
    expect(BRISTLE_GATHER).toContain(
      'float featherStart = uFeatherEdge * (1.0 - mix(uFeatherMin, uFeatherReach, uFeather));',
    )
    // The extended body's paper height carries the clean state: slider 0
    // rides the F0 rim (rimCalm's own smoothstep) and from 20 up max() keeps
    // rimCalm — the shipped rim and its micro texture. The NEUTRAL variant
    // keeps PRE's height verbatim (pinned in the permutation block below).
    expect(BRISTLE_GATHER).toContain(
      'float rimClean = max(rimCalm, (1.0 - uFeatherEdgeClean) * smoothstep(0.45, 0.75, lateral));',
    )
    expect(BRISTLE_GATHER).toContain(
      'float height = mix(grainHeight(css, uAxis), 0.5, rimClean);',
    )
    const clean = BRISTLE_GATHER.indexOf('featherShift *= uFeatherEdgeClean;')
    const rim = BRISTLE_GATHER.indexOf('float rimClean = max(rimCalm,')
    const noiseBlock = BRISTLE_GATHER.indexOf('if (uFeatherNoise * uFeather > 0.0) {')
    expect(rim, 'the rim calm follows the clean-edge scale').toBeGreaterThan(clean)
    expect(rim, 'the rim calm precedes the noise block').toBeLessThan(noiseBlock)
    expect(BRISTLE_GATHER).toContain(
      'float threshold = uGrain * (1.0 - height) - 0.25 + featherShift;',
    )
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
//  program (the law) is compiled lazily the first time the slider leaves the
//  neutral 20 or the falloff leaves 50. Both variants come from ONE generator,
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
      'uFeatherEdgeClean',
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

  it('selects the neutral program at slider 20 and the law at 0 or above 20', () => {
    // The switch reads the two twins, so it can never disagree with the
    // shader's own weights: break-up > 0, clean-edge < 1, or falloff != 50.
    expect(ENGINE_SOURCE).toContain('featherNoiseDrive(this.params.featherNoise) > 0')
    expect(ENGINE_SOURCE).toContain('featherEdgeClean(this.params.featherNoise) < 1')
    expect(ENGINE_SOURCE).toContain('this.params.featherFalloff !== 0.5')
    // Slider 20 is the neutral point: drive 0, clean-edge exactly 1.
    expect(FEATHER_NOISE.featherNoiseDrive?.(0.2)).toBe(0)
    expect(FEATHER_NOISE.featherEdgeClean?.(0.2)).toBe(1)
    // Slider 0 is the clean edge: the extended program must run (the neutral
    // source has no raggedness scale), and every break-up value too.
    expect(FEATHER_NOISE.featherEdgeClean?.(0)).toBe(0)
    expect(FEATHER_NOISE.featherNoiseDrive?.(0.4)).toBeGreaterThan(0)
    expect(FEATHER_NOISE.featherNoiseDrive?.(1)).toBeGreaterThan(0)
    for (const which of [
      'bristleDeposit',
      'bristleCover',
      'bristleRelief',
      'bristleCoverLayer',
    ]) {
      expect(ENGINE_SOURCE).toContain(`this.gatherProgram('${which}')`)
    }
  })

  it('defaults every bag to the neutral slider 20 (engine 0.2)', () => {
    // The Engine's at-rest params and the canonical default both sit on the
    // neutral point, so a fresh session renders the shipped bytes.
    expect(ENGINE_SOURCE).toContain('featherNoise: 0.2,')
    expect(ENGINE_SOURCE).not.toContain('featherNoise: 0,')
  })
})
