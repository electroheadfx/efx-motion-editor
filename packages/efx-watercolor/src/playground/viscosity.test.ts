// ============================================================
//  Viscosity law pins (Phase 64, MED-02 .. MED-06).
//
//  Family: source-scan + CPU boundary table on the existing setup — no new
//  config. vitest has no WebGL2, so the two uniforms cannot be read back
//  here; the byte-level proof that the neutral default leaves a
//  pre-milestone project untouched lives in probe/medium-engine against
//  baselines/neutral-identity.json.
//
//  Laws pinned here:
//   1. Engine.ts applies viscosity at exactly two sites, with the exact
//      documented literals.
//   2. Engine.ts reads `this.params.viscosity` exactly once.
//   3. No viscosity token appears in the settle, bleach, advect-ink or
//      display regions — the value is consumed only while stepping fluid,
//      so a later change can never re-process settled pigment.
//   4. The documented rate table: monotonic dissipation, exact reduction to
//      the pre-milestone expression at 0, and a bounded spread.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toEngineParams } from './params'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')

// The documented law, restated as literals — the test must not import the
// values from production, or a changed constant would move the pin with it.
const DISSIPATION_BASE = 3.0
const FLOW_GAIN = 2.4
const VISCOSITY_GAIN = 12.0
const SPREAD_BASE = 0.12
const SPREAD_VISCOSITY_RATIO = 0.9

/** The exponent's coefficient: 3.0 - flow * 2.4 + viscosity * 12.0. */
function dissipationRate(flow: number, viscosity: number): number {
  return DISSIPATION_BASE - flow * FLOW_GAIN + viscosity * VISCOSITY_GAIN
}

/** The dissipation uniform the advect-velocity pass receives (no flash-dry). */
function dissipation(flow: number, viscosity: number, dt: number): number {
  return Math.exp(-dt * dissipationRate(flow, viscosity))
}

/** The spread uniform the advect-wet pass receives: 0.12 * (1 - v * 0.9). */
function spread(viscosity: number): number {
  return SPREAD_BASE * (1 - viscosity * SPREAD_VISCOSITY_RATIO)
}

/** Slice Engine.ts between two literal anchors; throws when either is absent. */
function sliceBetween(startAnchor: string, endAnchor: string): string {
  const start = ENGINE_SOURCE.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = ENGINE_SOURCE.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return ENGINE_SOURCE.slice(start, end)
}

describe('Engine viscosity sites', () => {
  it('applies viscosity at exactly the two documented literals', () => {
    // Site one — dissipation. Additive inside the exponent: it can only raise
    // the decay rate, never lower the floor and never replace `flow`.
    expect(ENGINE_SOURCE).toContain('3.0 - flow * 2.4 + viscosity * 12.0')
    expect(ENGINE_SOURCE).toContain(
      'Math.exp(-dt * (3.0 - flow * 2.4 + viscosity * 12.0)) * (fixing ? Math.exp(-dt * 7) : 1)',
    )
    // Site two — spread. The 0.12 diffusion floor is scaled, not replaced.
    expect(ENGINE_SOURCE).toContain('0.12 * (1 - viscosity * 0.9)')
  })

  it('reads this.params.viscosity exactly once — the single local', () => {
    const reads = ENGINE_SOURCE.match(/this\.params\.viscosity/g) ?? []
    expect(reads).toHaveLength(1)
    expect(ENGINE_SOURCE).toContain('const viscosity = this.params.viscosity;')
  })

  it('never consumes viscosity in a settle, bleach, advect-ink or display pass', () => {
    const regions: ReadonlyArray<[string, string]> = [
      // The settle block is one contiguous region in step() (64-08 retired
      // bleachFS, so it is the fix block's only draw).
      ['settle', sliceBetween('// fixing: mobile pigment (and its scattering) settles into the paper', 'gl.disable(gl.BLEND);')],
      ['advect-ink', sliceBetween('// pigment: flows, bleeds and gathers at drying edges', 'this.dirty = union(this.dirty, rect);')],
      ['display', sliceBetween('private drawDisplay(', 'private render() {')],
    ]
    for (const [name, text] of regions) {
      expect(text.length, `${name} region must be non-empty`).toBeGreaterThan(0)
      expect(text.toLowerCase(), `${name} must not read viscosity`).not.toContain('viscosity')
    }
  })
})

describe('viscosity rate table', () => {
  const FLOWS = [0, 0.45, 1] as const
  const VISCOSITIES = [0, 0.5, 1] as const
  const DTS = [1 / 60, 1 / 120, 1 / 30] as const

  it('is strictly increasing in viscosity at fixed flow and dt', () => {
    for (const flow of FLOWS) {
      const rates = VISCOSITIES.map((viscosity) => dissipationRate(flow, viscosity))
      expect(rates[0]).toBeLessThan(rates[1]!)
      expect(rates[1]).toBeLessThan(rates[2]!)

      for (const dt of DTS) {
        const uniforms = VISCOSITIES.map((viscosity) => dissipation(flow, viscosity, dt))
        // More viscosity => faster decay => a strictly smaller uniform.
        expect(uniforms[0]).toBeGreaterThan(uniforms[1]!)
        expect(uniforms[1]).toBeGreaterThan(uniforms[2]!)
      }
    }
  })

  it('reduces bit-identically to the pre-milestone expression at viscosity 0', () => {
    for (const flow of FLOWS) {
      for (const dt of DTS) {
        const preMilestone = Math.exp(-dt * (3.0 - flow * 2.4))
        // `+ 0 * 12.0` is an IEEE +0 on a positive coefficient: the value is
        // bit-identical, which is what keeps a pre-milestone project's render
        // unchanged at the neutral default.
        expect(dissipation(flow, 0, dt)).toBe(Math.exp(-dt * (3.0 - flow * 2.4 + 0 * 12.0)))
        expect(dissipation(flow, 0, dt)).toBe(preMilestone)
      }
    }
  })

  it('scales the 0.12 diffusion floor on the documented boundary', () => {
    expect(spread(0)).toBe(0.12)
    expect(spread(0.5)).toBe(0.066)
    // The plan's "exactly 0.012" is the real-number boundary. In IEEE-754
    // binary64 the documented expression evaluates to
    // 0.12 * (1 - 0.9) = 0.011999999999999997 (about 3.5e-18 short of the
    // decimal literal), so the pin is 12-decimal closeness: the expression is
    // the contract, not the last bit of a decimal conversion.
    expect(spread(1)).toBeCloseTo(0.012, 12)
    // The floor is approached from above, never crossed.
    expect(spread(1)).toBeGreaterThan(0)
  })

  it('never returns a negative spread for any clamped viscosity', () => {
    for (let step = 0; step <= 100; step += 1) {
      expect(spread(step / 100)).toBeGreaterThanOrEqual(0)
    }
    // An overshooting canonical is clamped in the ONE mapping (T-64-01), so the
    // engine-side law only ever sees 0..1 — the clamp is the guard, not a
    // saturation inside the spread expression.
    const mapped = toEngineParams({ viscosity: 150 }).viscosity
    if (typeof mapped !== 'number') throw new Error('toEngineParams dropped the viscosity key')
    expect(mapped).toBe(1)
    expect(spread(mapped)).toBeGreaterThan(0)
  })
})
