// ============================================================
//  The one perceptual Body curve (Phase 64, D-14 / MED-21).
//
//  Family: plain unit test on the existing setup — no new config. The curve
//  is a pure law, so it is tested directly; the cover pass that consumes it
//  is pinned by source scan in coverage.test.ts, and the byte-level proof
//  lives in probe/medium-engine.
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
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BODY_CURVE_EXPONENT, bodyCurve } from './scattering'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(resolve(HERE, 'scattering.ts'), 'utf8')

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
