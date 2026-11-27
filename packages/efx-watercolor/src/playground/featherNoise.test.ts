// ============================================================
//  featherNoise.test.ts — Spec 11 (2026-11-27, quick 261126-v8j):
//  Feather noise chips the band outside a receding core; Feather falloff
//  shapes the opening.
//
//  The artist's live UAT rejected the first law's CHARACTER (a smooth front
//  that shrank the whole mark into a noodle). The revised ruling: a solid
//  CORE recedes linearly with the slider — coreU = 1 − CORE_DEPTH·drive,
//  wobbled by one low-frequency value-noise cell — and OUTSIDE the core ONE
//  fine chip field (three octaves of the engine's value noise in the stroke
//  frame plus the paper tooth) is thresholded into a sharp speckle mask:
//
//      featherShift += LIFT · band · chipMask
//
//  Where the mask is 1 the paint is removed; where it is 0 the paint is
//  untouched, so the kept paint in the band IS the chips and keeps its own
//  coverage / paper / bristle micro texture. Threshold-only, never a depth
//  fade and never an outward spray: nothing can appear outside the base
//  mark. Feather falloff still distributes the shipped rim opening with the
//  SAME exponent map Edge falloff uses — one shape language, no second
//  table.
//
//  Laws pinned here:
//   1. The declared constants (core depth / wobble, wobble feature, chip
//      feature, chip cut ends, chip tooth, lift) — the probe's calibration
//      targets.
//   2. `featherNoiseDrive(n)` is the recorded slider, clamped: LINEAR,
//      total, 0 reads the neutral block.
//   3. `featherNoiseCoreU(drive)` = 1 − CORE_DEPTH·drive: the core recedes
//      monotonically, never collapses; total.
//   4. `featherNoiseChipCut(drive)` falls from START to END: more drive =
//      denser flakes; total.
//   5. `featherNoiseChipFeaturePx` / `featherNoiseWobbleFeaturePx` =
//      clamp(hw · SCALE, MIN, MAX) in document px — brush-relative,
//      floored and capped, total.
//   6. The law ships as a SHADER PERMUTATION: the engine's default program
//      is the NEUTRAL gather (the pre-change source, byte-for-byte) and the
//      EXTENDED program — the law — compiles lazily the first time the
//      driven noise is above 0 or the falloff leaves 50. Both come from the
//      ONE generator, and slider 0 (drive 0) stays on the neutral path.
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
  FEATHER_NOISE_CORE_DEPTH?: number
  FEATHER_NOISE_CORE_WOBBLE?: number
  FEATHER_NOISE_WOBBLE_SCALE?: number
  FEATHER_NOISE_WOBBLE_MIN_PX?: number
  FEATHER_NOISE_WOBBLE_MAX_PX?: number
  FEATHER_NOISE_CHIP_SCALE?: number
  FEATHER_NOISE_CHIP_MIN_PX?: number
  FEATHER_NOISE_CHIP_MAX_PX?: number
  FEATHER_NOISE_CHIP_CUT_START?: number
  FEATHER_NOISE_CHIP_CUT_END?: number
  FEATHER_NOISE_CHIP_TOOTH?: number
  FEATHER_NOISE_LIFT?: number
  featherNoiseDrive?: (n: number) => number
  featherNoiseCoreU?: (drive: number) => number
  featherNoiseChipCut?: (drive: number) => number
  featherNoiseChipFeaturePx?: (halfWidthPx: number) => number
  featherNoiseWobbleFeaturePx?: (halfWidthPx: number) => number
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
  it('pins the declared values the probe calibrates against', () => {
    expect(FEATHER_NOISE.FEATHER_NOISE_CORE_DEPTH, 'the core recession').toBe(0.82)
    expect(FEATHER_NOISE.FEATHER_NOISE_CORE_WOBBLE, 'the core wobble uN').toBe(0.05)
    expect(FEATHER_NOISE.FEATHER_NOISE_WOBBLE_SCALE, 'the wobble scale').toBe(0.35)
    expect(FEATHER_NOISE.FEATHER_NOISE_WOBBLE_MIN_PX, 'the wobble floor').toBe(8)
    expect(FEATHER_NOISE.FEATHER_NOISE_WOBBLE_MAX_PX, 'the wobble ceiling').toBe(48)
    expect(FEATHER_NOISE.FEATHER_NOISE_CHIP_SCALE, 'the chip scale').toBe(0.05)
    expect(FEATHER_NOISE.FEATHER_NOISE_CHIP_MIN_PX, 'the chip floor').toBe(2.5)
    expect(FEATHER_NOISE.FEATHER_NOISE_CHIP_MAX_PX, 'the chip ceiling').toBe(6)
    expect(FEATHER_NOISE.FEATHER_NOISE_CHIP_CUT_START, 'the chip cut at drive 0').toBe(0.62)
    expect(FEATHER_NOISE.FEATHER_NOISE_CHIP_CUT_END, 'the chip cut at drive 1').toBe(0.47)
    expect(FEATHER_NOISE.FEATHER_NOISE_CHIP_TOOTH, 'the paper tooth share').toBe(0.15)
    expect(FEATHER_NOISE.FEATHER_NOISE_LIFT, 'the chip threshold rise').toBe(1.4)
  })

  it('routes every chip cut through the declared ends (the cut falls with drive)', () => {
    const start = FEATHER_NOISE.FEATHER_NOISE_CHIP_CUT_START ?? Number.NaN
    const end = FEATHER_NOISE.FEATHER_NOISE_CHIP_CUT_END ?? Number.NaN
    expect(end, 'more drive removes more area').toBeLessThan(start)
  })

  it('leaves no pre-law constant alive in the package sources', () => {
    for (const token of [
      'FEATHER_NOISE_FEATURE_SCALE',
      'FEATHER_NOISE_FEATURE_MIN_PX',
      'FEATHER_NOISE_FEATURE_MAX_PX',
      'FEATHER_NOISE_DEPTH',
      'FEATHER_NOISE_BLUR_PX',
      'FEATHER_NOISE_BLUR_MIN_U',
      'FEATHER_NOISE_BLUR_MAX_U',
      'FEATHER_NOISE_FEATURES',
      'FEATHER_NOISE_MIN_PX',
      'FEATHER_NOISE_MAX_PX',
      'FEATHER_NOISE_REFERENCE_PX',
      'FEATHER_NOISE_FLOOR',
      'featherNoisePeriodPx',
      'featherNoiseScale',
      'featherNoiseFeaturePx',
      'featherNoiseBlurU',
    ]) {
      const carriers = PACKAGE_SOURCES.filter(({ text }) => text.includes(token)).map(
        ({ file }) => file,
      )
      expect(carriers, `${token} is dead and removed`).toEqual([])
    }
  })
})

describe('featherNoiseDrive — the recorded slider IS the drive', () => {
  it('is linear: 0 nothing, 20 shallow, 60 medium, 100 full', () => {
    const drive = FEATHER_NOISE.featherNoiseDrive
    expect(typeof drive, 'featherNoiseDrive is exported').toBe('function')
    expect(drive!(0)).toBe(0)
    expect(drive!(0.2)).toBeCloseTo(0.2, 12)
    expect(drive!(0.4)).toBeCloseTo(0.4, 12)
    expect(drive!(0.6)).toBeCloseTo(0.6, 12)
    expect(drive!(1)).toBeCloseTo(1, 12)
  })

  it('is total: a non-finite slider reads the neutral block, extremes clamp', () => {
    const drive = FEATHER_NOISE.featherNoiseDrive
    expect(drive!(Number.NaN)).toBe(0)
    expect(drive!(-1)).toBe(0)
    expect(drive!(2)).toBeCloseTo(1, 12)
    expect(drive!(Number.POSITIVE_INFINITY)).toBeCloseTo(1, 12)
  })
})

describe('featherNoiseCoreU — the surviving core recedes linearly', () => {
  it('reads 1 − 0.82 · drive: full at 0, thin at 100', () => {
    const core = FEATHER_NOISE.featherNoiseCoreU
    expect(typeof core, 'featherNoiseCoreU is exported').toBe('function')
    expect(core!(0), 'drive 0 keeps the full width').toBeCloseTo(1, 12)
    expect(core!(0.2), 'drive 20 recedes by 16.4 %').toBeCloseTo(1 - 0.82 * 0.2, 12)
    expect(core!(0.4)).toBeCloseTo(1 - 0.82 * 0.4, 12)
    expect(core!(0.6)).toBeCloseTo(1 - 0.82 * 0.6, 12)
    expect(core!(1), 'drive 100 keeps 18 % of the visual half-width').toBeCloseTo(0.18, 12)
  })

  it('never collapses and never grows as the drive rises', () => {
    const core = FEATHER_NOISE.featherNoiseCoreU ?? (() => Number.NaN)
    let previous = core(0)
    for (let step = 0; step <= 100; step += 1) {
      const value = core(step / 100)
      expect(value).toBeLessThanOrEqual(previous + 1e-12)
      expect(value).toBeGreaterThan(0)
      previous = value
    }
  })

  it('is total: a non-finite drive reads the neutral core', () => {
    const core = FEATHER_NOISE.featherNoiseCoreU
    expect(core?.(Number.NaN), 'NaN reads 1').toBeCloseTo(1, 12)
    expect(core?.(Number.POSITIVE_INFINITY), 'inf clamps to full drive').toBeCloseTo(0.18, 12)
    expect(core?.(-1), 'negative clamps to 0').toBeCloseTo(1, 12)
  })
})

describe('featherNoiseChipCut — the flakes densify with the drive', () => {
  it('falls from 0.62 to 0.47 linearly', () => {
    const cut = FEATHER_NOISE.featherNoiseChipCut
    expect(typeof cut, 'featherNoiseChipCut is exported').toBe('function')
    expect(cut!(0)).toBeCloseTo(0.62, 12)
    expect(cut!(0.2)).toBeCloseTo(0.62 - 0.15 * 0.2, 12)
    expect(cut!(0.6)).toBeCloseTo(0.62 - 0.15 * 0.6, 12)
    expect(cut!(1)).toBeCloseTo(0.47, 12)
  })

  it('is total: a non-finite drive reads the sparse end, extremes clamp', () => {
    const cut = FEATHER_NOISE.featherNoiseChipCut
    expect(cut?.(Number.NaN)).toBeCloseTo(0.62, 12)
    expect(cut?.(-1)).toBeCloseTo(0.62, 12)
    expect(cut?.(2)).toBeCloseTo(0.47, 12)
  })
})

describe('the brush-relative feature sizes', () => {
  it('chip cells read half-width · 0.05, floored at 2.5 px and capped at 6 px', () => {
    const chip = FEATHER_NOISE.featherNoiseChipFeaturePx
    expect(typeof chip, 'featherNoiseChipFeaturePx is exported').toBe('function')
    expect(chip?.(120), 'half-width 120 reads 6 px').toBeCloseTo(6, 12)
    expect(chip?.(4), 'a tiny brush sits on the floor').toBeCloseTo(2.5, 12)
    expect(chip?.(40), 'half-width 40 still sits on the floor').toBeCloseTo(2.5, 12)
    expect(chip?.(80), 'half-width 80 reads 4 px').toBeCloseTo(4, 12)
    expect(chip?.(1000), 'a huge brush sits on the cap').toBeCloseTo(6, 12)
  })

  it('the wobble reads half-width · 0.35, floored at 8 px and capped at 48 px', () => {
    const wobble = FEATHER_NOISE.featherNoiseWobbleFeaturePx
    expect(typeof wobble, 'featherNoiseWobbleFeaturePx is exported').toBe('function')
    expect(wobble?.(120), 'half-width 120 reads 42 px').toBeCloseTo(42, 12)
    expect(wobble?.(4), 'a tiny brush sits on the floor').toBeCloseTo(8, 12)
    expect(wobble?.(20), 'half-width 20 still sits on the floor').toBeCloseTo(8, 12)
    expect(wobble?.(1000), 'a huge brush sits on the cap').toBeCloseTo(48, 12)
  })

  it('both are total and never decrease as the brush widens', () => {
    for (const [name, fn, min, max] of [
      [
        'featherNoiseChipFeaturePx',
        FEATHER_NOISE.featherNoiseChipFeaturePx,
        FEATHER_NOISE.FEATHER_NOISE_CHIP_MIN_PX,
        FEATHER_NOISE.FEATHER_NOISE_CHIP_MAX_PX,
      ],
      [
        'featherNoiseWobbleFeaturePx',
        FEATHER_NOISE.featherNoiseWobbleFeaturePx,
        FEATHER_NOISE.FEATHER_NOISE_WOBBLE_MIN_PX,
        FEATHER_NOISE.FEATHER_NOISE_WOBBLE_MAX_PX,
      ],
    ] as const) {
      let previous = -1
      for (let halfWidth = 0; halfWidth <= 400; halfWidth += 1) {
        const feature = fn?.(halfWidth) ?? Number.NaN
        expect(feature, `${name}(${halfWidth})`).toBeGreaterThanOrEqual(previous)
        expect(feature).toBeGreaterThanOrEqual(min ?? Number.NaN)
        expect(feature).toBeLessThanOrEqual(max ?? Number.NaN)
        previous = feature
      }
      for (const value of [0, -4, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(fn?.(value), `${name}(${value}) reads the floor`).toBeCloseTo(min ?? Number.NaN, 12)
      }
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
//  prove the GLSL and the ONE gather binder carry the artist's 2026-11-27
//  revised law (quick 261126-v8j):
//
//   * A solid core recedes linearly with the drive (coreU = 1 −
//     CORE_DEPTH·drive) and wobbles low-frequency; the paint inside it is
//     untouched.
//   * The band outside the core is gated by ONE fine chip field — three
//     octaves of the engine's value noise in the STROKE frame plus the
//     paper tooth — thresholded sharply into chipMask.
//   * The removal is `featherShift += LIFT · band · chipMask` — a threshold
//     shift, never a depth fade, never a wide smooth envelope or a smooth
//     shrink, and nothing outside the base mark gains paint.
//   * Feather falloff still shapes the shipped rim opening with the ONE
//     exponent map, skipping pow at 50.
// ============================================================

const LAW_UNIFORMS = [
  'uFeatherFalloff',
  'uFeatherNoise',
  'uFeatherNoiseAnchor',
  'uFeatherNoiseCoreDepth',
  'uFeatherNoiseWobble',
  'uFeatherNoiseWobbleFeature',
  'uFeatherNoiseChipFeature',
  'uFeatherNoiseChipCut',
  'uFeatherNoiseChipTooth',
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
    // The band's anchor is the Edge-transparency span, never a re-typed 0.9.
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseAnchor!, BRISTLE_LAYER_EDGE);',
    )
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseCoreDepth!, FEATHER_NOISE_CORE_DEPTH);',
    )
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseWobble!, FEATHER_NOISE_CORE_WOBBLE);',
    )
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseWobbleFeature!, featherNoiseWobbleFeaturePx(halfWidthPx));',
    )
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseChipFeature!, featherNoiseChipFeaturePx(halfWidthPx));',
    )
    expect(ENGINE_SOURCE).toContain('featherNoiseChipCut(featherNoiseDrive(this.params.featherNoise))')
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseChipTooth!, FEATHER_NOISE_CHIP_TOOTH);',
    )
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uFeatherNoiseLift!, FEATHER_NOISE_LIFT);',
    )
  })

  it('computes the dab half-width ONCE for the lateral laws and the features', () => {
    expect(ENGINE_SOURCE).toContain('const halfWidthPx = r * this.dh;')
    expect(ENGINE_SOURCE).toContain('gl.uniform1f(p.u.uHalfWidthPx!, halfWidthPx);')
    expect(ENGINE_SOURCE).not.toContain('gl.uniform1f(p.u.uHalfWidthPx!, r * this.dh);')
  })

  it('shapes the opening with the shipped exponent map and SKIPS pow at falloff 50', () => {
    expect(BRISTLE_GATHER).toContain(
      'float featherShift = uFeather * uFeatherShift * smoothstep(featherStart, uFeatherEdge, lateral);',
    )
    expect(BRISTLE_GATHER).toContain('if (uFeatherFalloff != 0.5) {')
    expect(BRISTLE_GATHER).toContain('exp2(2.0 * uFeatherFalloff - 1.0)')
  })

  it('recedes a CORE and chips the band outside it — never a smooth front', () => {
    expect(BRISTLE_GATHER).toContain('if (uFeatherNoise > 0.0) {')
    // The stroke-stationary frame: q.y's NEGATED sign. q.y < 0 is the
    // leading half, so uAlongPx − q.y·uHalfWidthPx is the texel's own
    // station P (S − (S − P)). The plus sign reads 2S − P — a per-DAB
    // phase that collapsed the fields to their minimum over ~80 dabs.
    expect(BRISTLE_GATHER).toContain(
      'vec2 sp = vec2(q.x * uHalfWidthPx, uAlongPx - q.y * uHalfWidthPx);',
    )
    // The core: linear recession plus one low-frequency wobble cell.
    expect(BRISTLE_GATHER).toContain(
      'float core = 1.0 - uFeatherNoiseCoreDepth * uFeatherNoise + wob * 2.0 * uFeatherNoiseWobble;',
    )
    // The band: outside the core, clamped to the base mark's visual edge.
    expect(BRISTLE_GATHER).toContain('float band = smoothstep(core - 0.01, core + 0.01, uN)')
    expect(BRISTLE_GATHER).toContain('* (1.0 - smoothstep(1.0, 1.01, uN));')
    // ONE chip field, tooth-tilted, thresholded sharply into a mask.
    expect(BRISTLE_GATHER).toContain(
      'float chips = featherNoiseFbm(sp / max(uFeatherNoiseChipFeature, 1.0) + vec2(3.1, 7.7))',
    )
    expect(BRISTLE_GATHER).toContain('+ uFeatherNoiseChipTooth * (rawHeight - 0.5);')
    expect(BRISTLE_GATHER).toContain(
      'float chipMask = smoothstep(uFeatherNoiseChipCut - 0.03, uFeatherNoiseChipCut + 0.03, chips);',
    )
    // The removal: threshold-only, gated by the core band and the chips.
    expect(BRISTLE_GATHER).toContain('featherShift += uFeatherNoiseLift * band * chipMask;')
    // DROPPED uFeather: the chips work at Feather 0 and Feather 85 alike.
    expect(BRISTLE_GATHER).not.toContain('uFeather * band * chipMask')
  })

  it('keeps the paper tooth available to the chip field without moving the threshold', () => {
    expect(BRISTLE_GATHER).toContain('float rawHeight = grainHeight(css, uAxis);')
    expect(BRISTLE_GATHER).toContain('float height = mix(rawHeight, 0.5, rimCalm);')
    expect(BRISTLE_GATHER).toContain(
      'float threshold = uGrain * (1.0 - height) - 0.25 + featherShift;',
    )
  })

  it('samples ONE coherent value-noise fbm in the chip field, weights summing to 1', () => {
    expect(BRISTLE_GATHER).toContain('float featherNoiseFbm(vec2 p){')
    expect(BRISTLE_GATHER).toContain('0.5714 * valueNoise(p)')
    expect(BRISTLE_GATHER).toContain('0.2857 * valueNoise(p * 2.0 + vec2(17.3, 11.1))')
    expect(BRISTLE_GATHER).toContain('0.1429 * valueNoise(p * 4.0 + vec2(31.7, 23.9))')
  })

  it('carries no smooth front, spray, spike or outward source', () => {
    for (const dead of [
      'cloudNoise',
      'cloudMix',
      'float pen = mix(0.88, 0.35, uFeatherNoise);',
      'float spray =',
      'float spike =',
      'float spikeField =',
      'float band = exp(-pow(',
      'float reach = mix(0.12, 0.40, uFeatherNoise);',
      'featherShift -= uFeather * spike * reach;',
      // The rejected first law's smooth erosion front.
      'float n01 = smoothstep(-0.3, 0.7, featherNoiseFbm(nf));',
      'float front = 1.0 - uFeatherNoiseDepth * uFeatherNoise * n01;',
      'float envelope = smoothstep(front - uFeatherNoiseBlur, front + uFeatherNoiseBlur, uN);',
      'featherShift += uFeatherNoiseLift * envelope;',
      'uFeatherNoiseDepth',
      'uFeatherNoiseBlur',
      'uFeatherNoiseFeature',
    ]) {
      expect(BRISTLE_GATHER.includes(dead), `the law no longer carries ${dead}`).toBe(false)
    }
  })

  it('keeps the shipped threshold expression and its anchors byte-identical', () => {
    expect(BRISTLE_GATHER).toContain(
      'float featherStart = uFeatherEdge * (1.0 - mix(uFeatherMin, uFeatherReach, uFeather));',
    )
    // PRE's paper height, verbatim — the neutral path compiles from this line.
    expect(SHADERS.BRISTLE_GATHER_NEUTRAL ?? '').toContain(
      'float height = mix(grainHeight(css, uAxis), 0.5, rimCalm);',
    )
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
//  field, no law uniforms and no reshuffled statement — and the EXTENDED
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

  it('keeps the neutral source free of the law — no field, no uniforms, no branch', () => {
    const neutral = SHADERS.BRISTLE_GATHER_NEUTRAL ?? ''
    for (const token of [
      'featherNoiseFbm',
      'uFeatherFalloff',
      'uFeatherNoise',
      'uFeatherNoiseCoreDepth',
      'uFeatherNoiseWobble',
      'uFeatherNoiseWobbleFeature',
      'uFeatherNoiseChipFeature',
      'uFeatherNoiseChipCut',
      'uFeatherNoiseChipTooth',
      'uFeatherNoiseLift',
      'q.x * uHalfWidthPx',
      'rawHeight',
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

  it('selects by driven noise > 0 OR falloff != 50 — slider 0 stays neutral', () => {
    expect(ENGINE_SOURCE).toContain('featherNoiseDrive(this.params.featherNoise) > 0')
    expect(ENGINE_SOURCE).toContain('this.params.featherFalloff !== 0.5')
    // The drive is the slider: 0 is the neutral program's ONLY noise value.
    expect(FEATHER_NOISE.featherNoiseDrive?.(0)).toBe(0)
    expect(FEATHER_NOISE.featherNoiseDrive?.(0.2)).toBeGreaterThan(0)
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
