// ============================================================
//  The Kubelka-Munk display band (Phase 64, D-14 / D-15 / D-17,
//  MED-34 / MED-35 / MED-36).
//
//  Family: plain unit test on the existing setup — no new config. The band
//  block is generated source, so the CPU reference below mirrors the emitted
//  expressions line by line and the generator's output is pinned as text; the
//  byte-level proof lives in probe/medium-engine.
//
//  Laws pinned here:
//   1. At zero scattering the reference is the legacy exponential exp(-A) of
//      the clamped absorption exponent (the half-exponent calibration), to
//      rounding, and its reflectance is exactly 0.
//   2. A band with no absorption returns 1 for any positive scattering — the
//      continuous limit and the reflectance of a non-absorbing scatterer over
//      white.
//   3. The reference stays finite, non-negative and at most 1 over the deposit
//      grid (absorption 0..20, scattering 1e-3..50) and far past it, up to the
//      half-float ceiling, with a strictly positive complement of its
//      reflectance.
//   4. It is continuous into the limit: a scattering of 1e-9 is within a
//      thousandth of the exponential for every absorption in the grid.
//   5. At fixed absorption it rises with scattering; at fixed scattering it
//      falls with absorption.
//   6. Reflectance plus transmittance never exceeds 1 beyond a recorded
//      tolerance.
//   7. The generated block opens on the imported epsilon and keeps the legacy
//      lines character for character in its false branch.
//   8. Its true branch halves the clamped exponent, carries band-indexed
//      km-prefixed intermediates, a defined zero-absorption branch, and
//      divides only by quantities positive by construction. It runs the
//      exp(-arg)-normalized form rather than the raw sinh/cosh denominator:
//      the plan's literal denominator overflows float32 beyond arg ~ 88,
//      which ~40 overlapping Body-100 dabs reach, so the generator emits the
//      algebraically identical form normalized by exp(-arg), where every term
//      is bounded for every finite absorption and scattering.
//   9. The epsilon and the deposit maximum are interpolated from
//      ./scattering, never retyped in the generator.
//  10. displayFS declares one scattering scalar from the two settled channels
//      and scales it by the granulation and edge factor (D-16).
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { displayBasisGLSL } from './spectral'
import { DISPLAY_BANDS } from './spectralData'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(resolve(HERE, 'spectral.ts'), 'utf8')
const SHADERS_SOURCE = readFileSync(resolve(HERE, 'shaders.ts'), 'utf8')
const SCATTERING_SOURCE = readFileSync(resolve(HERE, 'scattering.ts'), 'utf8')

const BLOCK = displayBasisGLSL()

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` would dump the module into the RED report and break its format.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectNotContains(source: string, needle: string): void {
  expect(source.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

/** Slice the source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

// ------------------------------------------------------------
//  Recorded tolerances. Each one is measured, not guessed.
// ------------------------------------------------------------

/** Relative miss allowed at zero scattering; measured worst 1.1e-15 (~5 ulps)
 *  over 200 001 absorption samples, because sinh + cosh = exp holds in the
 *  reals and only approximately in IEEE-754. */
const KM_EXACTNESS_TOLERANCE = 1e-12

/** Absolute miss allowed at scattering 1e-9; measured worst 2.2e-10. */
const KM_CONTINUITY_TOLERANCE = 1e-3

/** Slack on the reflectance-plus-transmittance bound; measured max excess 0. */
const KM_SPLIT_TOLERANCE = 1e-12

/** The emitted literals, formatted by the generator's own helper. */
const KM_EPSILON_LITERAL = '0.001000000'
const KM_MAX_LITERAL = '1.0'

// ------------------------------------------------------------
//  CPU reference: a line-by-line mirror of the generated true branch.
// ------------------------------------------------------------

interface KmBand {
  /** Reflectance of the layer over black. */
  r: number
  /** Transmittance through the layer. */
  t: number
  /** Reflectance of the layer over a white background: r + t^2 / (1 - r). */
  band: number
  /** The complement of r, evaluated directly so it never cancels to zero. */
  om: number
}

function kmBand(halfExponent: number, scatter: number): KmBand {
  if (halfExponent <= 0) {
    // A band with no absorption reflects all light over white.
    return { r: 0, t: 1, band: 1, om: 1 }
  }
  const arg = Math.sqrt(halfExponent * (2 * scatter + halfExponent))
  const e = Math.exp(-2 * arg)
  const sh = 0.5 * (1 - e)
  const ch = 0.5 * (1 + e)
  const den = (halfExponent + scatter) * sh + arg * ch
  const r = (scatter * sh) / den
  const t = (arg * Math.sqrt(e)) / den
  const om = (halfExponent * sh + arg * ch) / den
  return { r, t, band: r + (t * t) / om, om }
}

const ABSORPTION_GRID = [0, 1e-6, 1e-3, 0.01, 0.1, 0.5, 1, 2, 5, 10, 20]
const SCATTERING_GRID = [1e-3, 1.1e-3, 0.01, 0.1, 1, 2, 5, 10, 20, 50]

function relativeMiss(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), Number.MIN_VALUE)
}

// ------------------------------------------------------------
//  The legacy block, captured from the generator before 64-10 rewrote it.
//  The false branch must reproduce it character for character.
// ------------------------------------------------------------

const LEGACY_BLOCK = `  tr = exp(-max(dot(a, vec4(0.1447023,-0.2047454,0.05369401,0.3120142)) + dot(b, vec3(0.04493868,-0.2670309,-0.006388283)), 0.0));
  rgb += tr * vec3(0.007598756,0.01443160,0.02304203);
  tr = exp(-max(dot(a, vec4(0.1558969,-0.2221909,0.1575574,0.02525531)) + dot(b, vec3(-0.1239341,-0.04397425,-0.03671390)), 0.0));
  rgb += tr * vec3(-0.07190809,-0.05764169,0.1207272);
  tr = exp(-max(dot(a, vec4(0.1620447,-0.2342462,0.1949895,-0.1317110)) + dot(b, vec3(-0.2092335,0.1561441,-0.07838973)), 0.0));
  rgb += tr * vec3(0.2997730,0.01270480,0.3249726);
  tr = exp(-max(dot(a, vec4(0.1616249,-0.2303617,0.1814340,-0.1569514)) + dot(b, vec3(-0.09951376,0.2022741,-0.01207089)), 0.0));
  rgb += tr * vec3(-0.2579063,-0.06517872,0.4461339);
  tr = exp(-max(dot(a, vec4(0.1510664,-0.1783547,0.09984866,-0.1209759)) + dot(b, vec3(0.2508217,0.1568899,0.2171174)), 0.0));
  rgb += tr * vec3(0.07037487,0.05889296,0.1350291);
  tr = exp(-max(dot(a, vec4(0.1548815,-0.08767601,-0.1765157,0.04911107)) + dot(b, vec3(0.3464263,0.1607311,0.06910126)), 0.0));
  rgb += tr * vec3(-0.2104469,0.1285821,0.09775973);
  tr = exp(-max(dot(a, vec4(0.1732235,-0.05408394,-0.2743489,-0.05756325)) + dot(b, vec3(0.1065638,0.08742798,-0.1425212)), 0.0));
  rgb += tr * vec3(-0.02718884,0.2208098,-0.09346024);
  tr = exp(-max(dot(a, vec4(0.1775172,-0.04068168,-0.2893418,-0.09235940)) + dot(b, vec3(0.001179382,0.03074158,-0.07574946)), 0.0));
  rgb += tr * vec3(-0.3172512,0.4457301,0.04248862);
  tr = exp(-max(dot(a, vec4(0.1748587,-0.02914774,-0.2674148,-0.08768260)) + dot(b, vec3(-0.04379864,-0.02492709,0.1328408)), 0.0));
  rgb += tr * vec3(0.2293731,0.1134161,-0.06150663);
  tr = exp(-max(dot(a, vec4(0.1709800,0.01093349,-0.2652804,-0.08213999)) + dot(b, vec3(-0.4358296,-0.2534114,0.05201528)), 0.0));
  rgb += tr * vec3(0.1930991,0.1395861,-0.01283952);
  tr = exp(-max(dot(a, vec4(0.1627231,0.1243476,0.1224234,-0.2629964)) + dot(b, vec3(0.08929734,-0.2848070,0.1776335)), 0.0));
  rgb += tr * vec3(0.5274069,0.03838932,-0.02348521);
  tr = exp(-max(dot(a, vec4(0.1714174,0.1619576,0.1570717,-0.1994343)) + dot(b, vec3(0.1808936,-0.1937673,-0.2833049)), 0.0));
  rgb += tr * vec3(0.3899227,0.07193636,0.01268301);
  tr = exp(-max(dot(a, vec4(0.1680602,0.1683766,0.1288490,-0.07003431)) + dot(b, vec3(0.1229764,-0.06158691,-0.1976904)), 0.0));
  rgb += tr * vec3(-0.1656770,-0.2589753,-0.01230862);
  tr = exp(-max(dot(a, vec4(0.1629650,0.1711310,0.07210673,0.07361673)) + dot(b, vec3(-0.001589698,0.06228573,-0.02023599)), 0.0));
  rgb += tr * vec3(0.5972293,0.3119106,-0.005481410);
  tr = exp(-max(dot(a, vec4(0.1595490,0.1723758,0.04052390,0.1495078)) + dot(b, vec3(-0.06381081,0.1189043,0.08051684)), 0.0));
  rgb += tr * vec3(-0.1977810,0.08099158,0.05785604);
  tr = exp(-max(dot(a, vec4(0.1607086,0.1728940,0.03731743,0.1419586)) + dot(b, vec3(-0.07924397,0.1139095,0.05512528)), 0.0));
  rgb += tr * vec3(-0.06596648,-0.2556352,-0.05165295);`

describe('the Kubelka-Munk band reference (MED-34)', () => {
  it('returns the legacy exponential at zero scattering', () => {
    for (const absorption of ABSORPTION_GRID) {
      const m = kmBand(absorption / 2, 0)
      const legacy = Math.exp(-absorption)
      expect(m.r, `reflectance over black at absorption ${absorption}`).toBe(0)
      expect(
        relativeMiss(m.band, legacy),
        `band at absorption ${absorption}: ${m.band} vs ${legacy}`,
      ).toBeLessThan(KM_EXACTNESS_TOLERANCE)
    }
  })

  it('returns one for a band with no absorption', () => {
    for (const scatter of [1e-3, 1, 8, 50]) {
      expect(kmBand(0, scatter).band, `zero absorption, scattering ${scatter}`).toBe(1)
    }
  })

  it('stays finite and inside the unit interval over the deposit grid', () => {
    for (const absorption of ABSORPTION_GRID) {
      for (const scatter of SCATTERING_GRID) {
        const m = kmBand(absorption / 2, scatter)
        const where = `absorption ${absorption}, scattering ${scatter}`
        expect(Number.isFinite(m.r) && Number.isFinite(m.t) && Number.isFinite(m.band), `finite at ${where}`).toBe(true)
        expect(m.band >= 0 && m.band <= 1, `band ${m.band} in [0, 1] at ${where}`).toBe(true)
        expect(m.r < 1, `reflectance ${m.r} below 1 at ${where}`).toBe(true)
        expect(m.om > 0, `complement of the reflectance ${m.om} above 0 at ${where}`).toBe(true)
      }
    }
  })

  it('stays finite far past the deposit grid, up to the half-float ceiling', () => {
    for (const absorption of [0.002, 1, 20, 200, 1000]) {
      for (const scatter of [1e-3, 1, 8, 100, 1000, 65504]) {
        const m = kmBand(absorption / 2, scatter)
        const where = `absorption ${absorption}, scattering ${scatter}`
        expect(Number.isFinite(m.band), `finite band at ${where}`).toBe(true)
        expect(m.band >= 0 && m.band <= 1, `band ${m.band} in [0, 1] at ${where}`).toBe(true)
        expect(m.om > 0, `complement of the reflectance above 0 at ${where}`).toBe(true)
      }
    }
  })

  it('is continuous into the scattering-free limit', () => {
    for (const absorption of ABSORPTION_GRID) {
      const m = kmBand(absorption / 2, 1e-9)
      const legacy = Math.exp(-absorption)
      expect(
        Math.abs(m.band - legacy),
        `absorption ${absorption}: |${m.band} - ${legacy}|`,
      ).toBeLessThan(KM_CONTINUITY_TOLERANCE)
    }
  })

  it('rises with scattering and falls with absorption', () => {
    for (const absorption of [0.1, 1, 5, 20]) {
      let previous = -1
      for (let i = 0; i <= 400; i += 1) {
        const value = kmBand(absorption / 2, (i * 50) / 400).band
        expect(value >= previous - KM_SPLIT_TOLERANCE, `not monotone in scattering at ${absorption}`).toBe(true)
        previous = value
      }
    }
    for (const scatter of SCATTERING_GRID) {
      let previous = 2
      for (let i = 0; i <= 400; i += 1) {
        const value = kmBand(i * 20 / 400 / 2, scatter).band
        expect(value <= previous + KM_SPLIT_TOLERANCE, `not monotone in absorption at scattering ${scatter}`).toBe(true)
        previous = value
      }
    }
  })

  it('never lets reflectance plus transmittance exceed one', () => {
    for (const absorption of ABSORPTION_GRID) {
      for (const scatter of SCATTERING_GRID) {
        const m = kmBand(absorption / 2, scatter)
        expect(
          m.r + m.t,
          `reflectance plus transmittance at absorption ${absorption}, scattering ${scatter}`,
        ).toBeLessThanOrEqual(1 + KM_SPLIT_TOLERANCE)
      }
    }
  })
})

describe('the generated band block (MED-34 / MED-35)', () => {
  it('opens on the imported epsilon and the deposit maximum', () => {
    expectContains(BLOCK, 'Kubelka-Munk')
    expectContains(BLOCK, `  if (scatter > ${KM_EPSILON_LITERAL}){`)
    expectContains(BLOCK, `SCATTERING_MAX = ${KM_MAX_LITERAL}`)
    expectContains(BLOCK, 'normalized by exp(-arg)')
    expectContains(BLOCK, 'byte-identical')
    expect(
      (BLOCK.match(/if \(scatter >/g) ?? []).length,
      'one scattering branch for the whole block',
    ).toBe(1)
  })

  it('keeps the legacy band lines character for character in its false branch', () => {
    expect(BLOCK.endsWith(`${LEGACY_BLOCK}\n  }`), 'the block ends with the legacy block').toBe(true)
    expect(
      (BLOCK.match(/tr = exp\(-max\(/g) ?? []).length,
      'one legacy exponential per display band',
    ).toBe(DISPLAY_BANDS.length)
    expect(
      (BLOCK.match(/rgb \+= tr \* vec3\(/g) ?? []).length,
      'one legacy accumulation per display band',
    ).toBe(DISPLAY_BANDS.length)
  })

  it('halves the clamped exponent and carries band-indexed km intermediates', () => {
    for (let i = 0; i < DISPLAY_BANDS.length; i += 1) {
      expectContains(BLOCK, `float kmK${i} = 0.5 * max(`)
      expectContains(BLOCK, `float kmBand${i};`)
      expectContains(BLOCK, `if (kmK${i} <= 0.0){`)
      expectContains(BLOCK, `      kmBand${i} = 1.0;`)
      expectContains(BLOCK, `float kmArg${i} = sqrt(kmK${i} * (2.0 * scatter + kmK${i}));`)
      expectContains(BLOCK, `float kmE${i} = exp(-2.0 * kmArg${i});`)
      expectContains(BLOCK, `float kmSh${i} = 0.5 * (1.0 - kmE${i});`)
      expectContains(BLOCK, `float kmCh${i} = 0.5 * (1.0 + kmE${i});`)
      expectContains(BLOCK, `float kmDen${i} = (kmK${i} + scatter) * kmSh${i} + kmArg${i} * kmCh${i};`)
      expectContains(BLOCK, `float kmR${i} = scatter * kmSh${i} / kmDen${i};`)
      expectContains(BLOCK, `float kmT${i} = kmArg${i} * sqrt(kmE${i}) / kmDen${i};`)
      expectContains(BLOCK, `float kmOm${i} = (kmK${i} * kmSh${i} + kmArg${i} * kmCh${i}) / kmDen${i};`)
      expectContains(BLOCK, `kmBand${i} = kmR${i} + kmT${i} * kmT${i} / kmOm${i};`)
      expect(BLOCK.split(`kmBand${i}`).length, `band ${i} accumulates through kmBand`).toBeGreaterThan(1)
    }
  })

  it('never divides by a quantity that can reach zero', () => {
    // The complement of the reflectance is evaluated directly and never as a
    // subtraction that could round to zero; every denominator is a sum whose
    // last term is the strictly positive argument.
    expectNotContains(BLOCK, '1.0 - kmR')
    expect(
      (BLOCK.match(/\/ kmDen\d+/g) ?? []).length,
      'reflectance, transmittance and complement divide by the positive denominator',
    ).toBe(DISPLAY_BANDS.length * 3)
  })

  it('uses the overflow-free normalized form, never the raw hyperbolics', () => {
    expectContains(BLOCK, 'sqrt(')
    // The plan's literal sinh/cosh denominator overflows float32 beyond
    // arg ~ 88; the emitted form is its exp(-arg)-normalized identity.
    expectNotContains(BLOCK, 'sinh(')
    expectNotContains(BLOCK, 'cosh(')
  })

  it('reads one scattering scalar and never a band-indexed one', () => {
    expectContains(BLOCK, 'scatter')
    expect(
      (BLOCK.match(/scatter\d+/g) ?? []).length,
      'no band-indexed scattering scalar',
    ).toBe(0)
  })
})

describe('the generator and the display shader wiring (MED-34 / MED-35 / D-16)', () => {
  it('imports the epsilon and the maximum from ./scattering and retypes neither', () => {
    expectContains(SOURCE, "import { SCATTER_EPSILON, SCATTERING_MAX } from './scattering';")
    expectContains(SCATTERING_SOURCE, 'export const SCATTER_EPSILON = 1e-3')
    expectContains(SCATTERING_SOURCE, 'export const SCATTERING_MAX = 1')
    const generator = SOURCE.slice(SOURCE.indexOf('export function displayBasisGLSL'))
    expectContains(generator, 'SCATTER_EPSILON')
    expectContains(generator, 'SCATTERING_MAX')
    expect(
      /\b0\.001\b|\b1e-3\b/.test(generator),
      'the generator retypes the epsilon',
    ).toBe(false)
    expect(
      (SOURCE.match(/export function displayBasisGLSL/g) ?? []).length,
      'one generator declaration',
    ).toBe(1)
  })

  it('records the closed form and the calibration above the generator', () => {
    const doc = SOURCE.slice(0, SOURCE.indexOf('export function displayBasisGLSL'))
    for (const phrase of [
      'Kubelka-Munk',
      'half-exponent',
      'layer over black',
      'over a white background',
      'no absorption',
      'below one',
      'SCATTER_EPSILON',
    ]) {
      expectContains(doc, phrase)
    }
  })

  it('declares one scattering scalar beside the coefficient reads', () => {
    expectContains(SHADERS_SOURCE, 'vec4 fB = texture(uFixedB, uv);')
    expectContains(SHADERS_SOURCE, 'float scatter = iB.a + fB.a;')
    const reads = sliceBetween(
      SHADERS_SOURCE,
      'vec4 iB = texture(uInkB, uv);',
      '// Granulation: pigment settles into the valleys of the paper.',
    )
    expectContains(reads, 'float scatter = iB.a + fB.a;')
    expectContains(reads, 'vec3 b = iB.rgb + fB.rgb;')
    expect(
      (SHADERS_SOURCE.match(/float scatter =/g) ?? []).length,
      'one scattering scalar in the shader module',
    ).toBe(1)
  })

  it('scales the scattering scalar exactly as it scales the coefficients', () => {
    expectContains(SHADERS_SOURCE, 'a *= k; b *= k; scatter *= k;')
    const scaled = sliceBetween(SHADERS_SOURCE, 'a *= k; b *= k; scatter *= k;', 'vec3 rgb = vec3(0.0);')
    expect(scaled.length, 'the scaling precedes the band block').toBeGreaterThan(0)
  })

  it('interpolates the generated block after both scalar declarations', () => {
    expectContains(SHADERS_SOURCE, '${displayBasisGLSL()}')
    const tr = SHADERS_SOURCE.indexOf('float tr;')
    const scatter = SHADERS_SOURCE.indexOf('float scatter = iB.a + fB.a;')
    const block = SHADERS_SOURCE.indexOf('${displayBasisGLSL()}')
    expect(tr, 'the legacy scalar is declared').toBeGreaterThanOrEqual(0)
    expect(scatter, 'the scattering scalar is declared').toBeGreaterThanOrEqual(0)
    expect(block, 'the generated block is interpolated').toBeGreaterThan(scatter)
    expect(tr < block, 'the legacy scalar precedes the block').toBe(true)
  })

  it('documents the Kubelka-Munk composite in the shader header', () => {
    expectContains(SHADERS_SOURCE, 'two-constant Kubelka-Munk layer-over-white form')
    expectContains(SHADERS_SOURCE, 'B.a = scattering')
  })
})
