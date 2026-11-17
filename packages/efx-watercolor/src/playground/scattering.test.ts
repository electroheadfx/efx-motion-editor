// ============================================================
//  The one perceptual Body curve and the scattering deposit law
//  (Phase 64, D-14 / MED-21 / MED-32).
//
//  Family: plain unit test on the existing setup — no new config. Both laws
//  are pure functions, so they are tested directly; the cover pass and the
//  deposit sites that consume them are pinned by source scan in
//  coverage.test.ts and here, and the byte-level proof lives in
//  probe/medium-engine.
//
//  Laws pinned here:
//   1. BODY_CURVE_EXPONENT is 6 — the exponent is exported, never inlined.
//   2. bodyCurve(0) = 0, bodyCurve(0.5) = 0.015625 (a glaze, D-14),
//      bodyCurve(1) = 1 (a true cover at the tip core).
//   3. The curve is monotone over the band and clamps outside it; a
//      non-finite input maps to the neutral 0.
//   4. The module declares the curve exactly once, imports nothing from the
//      engine, and its header records D-14 (superseding spec 06 §3's inline
//      clamp) and that 64-08 extends this module.
//   5. SCATTERING_MAX is exactly 8 and SCATTER_EPSILON exactly 1e-3, both
//      exported as positive finite numbers, the epsilon far below any real
//      deposit the engine produces.
//   6. scatteringDeposit(body, amount) = SCATTERING_MAX × bodyCurve(body) ×
//      amount: it scales with the dab amount, is monotone in body, and a
//      zero, negative or non-finite amount deposits exactly 0 — never NaN.
//   7. The package barrel re-exports the law module, so the app and later
//      plans import the law from one place.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BODY_CURVE_EXPONENT,
  SCATTERING_MAX,
  SCATTER_EPSILON,
  bodyCurve,
  scatteringDeposit,
} from './scattering'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(resolve(HERE, 'scattering.ts'), 'utf8')
const INDEX_SOURCE = readFileSync(resolve(HERE, 'index.ts'), 'utf8')

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` would dump the module into the RED report and break its format.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

describe('the one Body curve (D-14 / MED-21)', () => {
  it('exports exponent 6 and pins the four band values', () => {
    expect(BODY_CURVE_EXPONENT, 'the exponent is 6').toBe(6)
    expect(bodyCurve(0), 'Body 0 erases nothing').toBe(0)
    expect(bodyCurve(0.5), 'Body 50 is a glaze (1/64)').toBe(0.015625)
    expect(bodyCurve(1), 'Body 100 reaches a true cover at the tip core').toBe(1)
  })

  it('is monotone over the band and clamps outside it', () => {
    let previous = -1
    for (let i = 0; i <= 200; i += 1) {
      const value = bodyCurve(i / 200)
      expect(value >= previous, `not monotone at ${i / 200}`).toBe(true)
      previous = value
    }
    expect(bodyCurve(-0.5), 'below the band clamps to 0').toBe(0)
    expect(bodyCurve(2), 'above the band clamps to 1').toBe(1)
  })

  it('maps a non-finite body to the neutral 0', () => {
    expect(bodyCurve(Number.NaN), 'NaN is the neutral 0').toBe(0)
    expect(bodyCurve(Number.POSITIVE_INFINITY), 'Infinity is the neutral 0').toBe(0)
    expect(bodyCurve(Number.NEGATIVE_INFINITY), '-Infinity is the neutral 0').toBe(0)
  })

  it('is the only declaration, imports nothing from the engine, and records D-14', () => {
    expect(
      (SOURCE.match(/export function bodyCurve/g) ?? []).length,
      'one curve declaration',
    ).toBe(1)
    expect(
      (SOURCE.match(/BODY_CURVE_EXPONENT = 6/g) ?? []).length,
      'one exponent declaration, at 6',
    ).toBe(1)
    expectContains(SOURCE, 'Math.pow(clamp01(body), BODY_CURVE_EXPONENT)')
    expect(
      /from '\.\/Engine'/.test(SOURCE),
      'the curve imports nothing from the engine',
    ).toBe(false)
    expect(SOURCE.includes('D-14'), 'the header records D-14').toBe(true)
    expect(SOURCE.includes('supersedes'), 'the header records the superseded inline clamp').toBe(true)
    expect(SOURCE.includes('64-08'), 'the header names the plan that extends this module').toBe(true)
  })
})

describe('the scattering deposit law (D-14 / MED-32)', () => {
  it('exports SCATTERING_MAX = 8 and SCATTER_EPSILON = 1e-3', () => {
    expect(SCATTERING_MAX, 'the saturated deposit at unit amount is 8').toBe(8)
    expect(SCATTER_EPSILON, 'the render-side cheap-branch switch is 1e-3').toBe(1e-3)
    expect(Number.isFinite(SCATTERING_MAX) && SCATTERING_MAX > 0, 'SCATTERING_MAX is positive and finite').toBe(true)
    expect(Number.isFinite(SCATTER_EPSILON) && SCATTER_EPSILON > 0, 'SCATTER_EPSILON is positive and finite').toBe(true)
    // The epsilon must stay far below any real deposit: Body 50 at unit
    // amount is the faintest value UAT 3 calls visible paint.
    expect(
      SCATTER_EPSILON < scatteringDeposit(0.5, 1),
      'the epsilon sits below a Body-50 unit-amount deposit',
    ).toBe(true)
  })

  it('equals SCATTERING_MAX × bodyCurve(body) × amount', () => {
    for (const body of [0, 0.25, 0.5, 0.75, 1]) {
      for (const amount of [0.125, 0.5, 1, 2]) {
        expect(scatteringDeposit(body, amount), `deposit at body ${body}, amount ${amount}`).toBe(
          SCATTERING_MAX * bodyCurve(body) * amount,
        )
      }
    }
    expect(scatteringDeposit(0.5, 1), 'Body 50, unit amount').toBe(0.125)
    expect(scatteringDeposit(1, 1), 'Body 100, unit amount').toBe(8)
    expect(scatteringDeposit(1, 0.5), 'Body 100, half amount').toBe(4)
  })

  it('is monotone in body for a fixed amount', () => {
    let previous = -1
    for (let i = 0; i <= 200; i += 1) {
      const value = scatteringDeposit(i / 200, 0.37)
      expect(value >= previous, `not monotone at ${i / 200}`).toBe(true)
      previous = value
    }
  })

  it('deposits exactly 0 for a zero, negative or non-finite amount', () => {
    expect(scatteringDeposit(1, 0), 'zero amount deposits nothing').toBe(0)
    expect(scatteringDeposit(1, -0.5), 'a negative amount deposits nothing').toBe(0)
    expect(scatteringDeposit(1, Number.NaN), 'a NaN amount deposits nothing').toBe(0)
    expect(scatteringDeposit(1, Number.POSITIVE_INFINITY), 'an infinite amount deposits nothing').toBe(0)
    // 0 × Infinity would be NaN without the amount guard.
    expect(scatteringDeposit(0, Number.POSITIVE_INFINITY), 'a neutral body and an infinite amount').toBe(0)
  })

  it('stays finite and non-negative on a hostile grid', () => {
    const bodies = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -3, -0.01, 0, 0.5, 1, 2, 1e9]
    const amounts = [0, -1, 1e-9, 0.5, 1, 1e6]
    for (const body of bodies) {
      for (const amount of amounts) {
        const value = scatteringDeposit(body, amount)
        expect(Number.isFinite(value), `finite at body ${body}, amount ${amount}`).toBe(true)
        expect(value >= 0, `non-negative at body ${body}, amount ${amount}`).toBe(true)
      }
    }
  })

  it('declares the deposit law once, allocates nothing, and records both constants', () => {
    expect(
      (SOURCE.match(/export function scatteringDeposit/g) ?? []).length,
      'one deposit declaration',
    ).toBe(1)
    expect(
      (SOURCE.match(/SCATTERING_MAX = 8/g) ?? []).length,
      'one SCATTERING_MAX declaration, at 8',
    ).toBe(1)
    expect(
      (SOURCE.match(/SCATTER_EPSILON = 1e-3/g) ?? []).length,
      'one SCATTER_EPSILON declaration, at 1e-3',
    ).toBe(1)
    expectContains(SOURCE, 'SCATTERING_MAX * bodyCurve(body) * amount')
    expect(SOURCE.includes('new '), 'the law module allocates nothing').toBe(false)
    expect(
      /from '\.\/Engine'/.test(SOURCE),
      'the law module imports nothing from the engine',
    ).toBe(false)
    // The header names both constants with their reason; 64-09 consumes the
    // epsilon as its render-side switch.
    expectContains(SOURCE, 'SCATTERING_MAX')
    expectContains(SOURCE, 'SCATTER_EPSILON')
    expectContains(SOURCE, '64-09')
  })

  it('is re-exported from the package barrel', () => {
    expectContains(INDEX_SOURCE, "from './scattering'")
    for (const name of [
      'BODY_CURVE_EXPONENT',
      'SCATTERING_MAX',
      'SCATTER_EPSILON',
      'bodyCurve',
      'scatteringDeposit',
    ]) {
      expectContains(INDEX_SOURCE, name)
    }
  })
})
