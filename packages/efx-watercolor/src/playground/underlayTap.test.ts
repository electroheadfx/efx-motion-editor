// ============================================================
//  The committed-base tap (pickup-collapse-live, 2026-11-21).
//
//  Family: plain unit test on the existing setup — no new config. The block is
//  generated source, so the CPU reference below mirrors the emitted expressions
//  and the generator's output is pinned as text; the end-to-end proof lives in
//  probe/pickup-collapse (app-live vs app-bake).
//
//  The bug this pins: on the first live paint over a committed-only base, the
//  carrier's wet/touch taps sampled the engine's sheet, which holds NO committed
//  base (it is display-only underlay), so wet = 0 and Pickup 100 collapsed to
//  unmixed paint. The re-bake — the arbiter — replays the base into the sheet
//  and picks up correctly. The display already composites the underlay
//  (`tNew * tBase^(1-cover)`, displayFS); the carrier must tap the same surface.
//
//  Laws pinned here:
//   1. The inverse: a committed sheet's sRGB transmittance, fed through the
//      pigment upsample, recovers the paint's own seven coefficients
//      (direction, magnitude, display) — the SAME law `pigmentFromHex`
//      implements, which is what the shader block is generated from.
//   2. The same-paint gate stays closed on a committed base of the brush's own
//      pigment (cosine >= 0.975's top at the covered taps) and opens for a
//      different paint — the artist's yellow-goes-green law, now over the
//      committed surface.
//   3. The base share is the display's own (1 - cover): the committed base is
//      replaced where this session's ink covers it, exactly as the capture
//      merge and the re-bake's dab law define.
//   4. The carrier's tap reads sheet + base on all three taps and wetAt reads
//      the base's cover and age; every uniform is gated by uBaseTapOn, so a
//      bake (no underlay ever bound there) keeps its recorded arithmetic.
//   5. The engine binds the underlay on its own texture unit and stamps the
//      base's age in engine seconds at setUnderlay.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { coeffsToLinear, pigmentFromDisplayGLSL, pigmentFromHex, rgbToHex } from './spectral'
import { BASIS, PRIMARIES, SPECTRAL_EPSILON } from './spectralData'
import { bristleCarrierFS } from './shaders'

const HERE = dirname(fileURLToPath(import.meta.url))
const SPECTRAL_SOURCE = readFileSync(resolve(HERE, 'spectral.ts'), 'utf8')
const SHADERS_SOURCE = readFileSync(resolve(HERE, 'shaders.ts'), 'utf8')
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')

const BLOCK = pigmentFromDisplayGLSL()
const CARRIER = bristleCarrierFS

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` would dump whole modules into the RED report.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

const compand = (x: number) => (x < 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}
const norm = (a: ArrayLike<number>) => Math.sqrt(dot(a, a))
const cos = (a: ArrayLike<number>, b: ArrayLike<number>) => dot(a, b) / Math.max(norm(a) * norm(b), 1e-12)

/**
 * Line-for-line CPU mirror of the emitted GLSL: sRGB transmittance ->
 * (alpha, 7 coefficients). Tables are imported, never retyped.
 */
function underlayCoeffsCpu(t: readonly number[]): { alpha: number; coeffs: number[] } {
  const lin = t.map((v) => (v < 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  const w = Math.min(lin[0]!, lin[1]!, lin[2]!)
  const q = lin.map((v) => v - w)
  const c = Math.min(q[1]!, q[2]!)
  const m = Math.min(q[0]!, q[2]!)
  const y = Math.min(q[0]!, q[1]!)
  const rr = Math.min(Math.max(0, q[0]! - q[2]!), Math.max(0, q[0]! - q[1]!))
  const gg = Math.min(Math.max(0, q[1]! - q[2]!), Math.max(0, q[1]! - q[0]!))
  const bb = Math.min(Math.max(0, q[2]! - q[1]!), Math.max(0, q[2]! - q[0]!))
  const absorb: number[] = []
  for (const k of PRIMARIES) {
    const r = w + c * k[0]! + m * k[1]! + y * k[2]! + rr * k[3]! + gg * k[4]! + bb * k[5]!
    absorb.push(-Math.log(Math.max(r, SPECTRAL_EPSILON)))
  }
  const coeffs: number[] = []
  for (const row of BASIS) coeffs.push(dot(row, absorb))
  return { alpha: clamp01(1 - Math.min(t[0]!, t[1]!, t[2]!)), coeffs }
}

/** The committed sheet's sRGB transmittance for a stored coefficient vector. */
function storedTransmittanceSrgb(stored: ArrayLike<number>): number[] {
  return coeffsToLinear(stored).map((v) => clamp01(compand(clamp01(v))))
}

const PALETTE: Record<string, string> = {
  blue: '#5994e4',
  yellow: '#e8c21a',
  red: '#e02a2a',
  green: '#40a060',
}
const DEPTHS = [1, 0.7, 0.45, 0.2]

describe('committed-base tap — the display manifold inverse', () => {
  it('is the pigment upsample applied to the observed colour (one law)', () => {
    for (const [name, hex] of Object.entries(PALETTE)) {
      for (const depth of DEPTHS) {
        const stored = pigmentFromHex(hex).coeffs.map((v) => v * depth)
        const t = storedTransmittanceSrgb(stored)
        const mirror = underlayCoeffsCpu(t)
        const reference = pigmentFromHex(rgbToHex(t)).coeffs
        // 8-bit quantization separates the reference (hex round-trip) from the
        // mirror by ~2e-5; anything larger would mean a retyped table.
        expect(
          cos(mirror.coeffs, reference),
          `${name} d=${depth}: mirror must be pigmentFromHex of the observed colour`,
        ).toBeGreaterThan(0.9999)
        expect(mirror.alpha, `${name} d=${depth}: alpha is the rasterAlpha law`).toBeCloseTo(
          clamp01(1 - Math.min(...t)),
          12,
        )
      }
    }
  })

  it('recovers the stored coefficients (direction, magnitude and display)', () => {
    for (const [name, hex] of Object.entries(PALETTE)) {
      for (const depth of DEPTHS) {
        const stored = pigmentFromHex(hex).coeffs.map((v) => v * depth)
        const t = storedTransmittanceSrgb(stored)
        const est = underlayCoeffsCpu(t)
        expect(cos(est.coeffs, stored), `${name} d=${depth}: direction`).toBeGreaterThan(0.99)
        const ratio = norm(est.coeffs) / Math.max(norm(stored), 1e-9)
        expect(ratio, `${name} d=${depth}: magnitude`).toBeGreaterThan(0.85)
        expect(ratio, `${name} d=${depth}: magnitude`).toBeLessThan(1.15)
        // The seven-band basis is lossy by construction (the residual is its
        // own round-trip limit, worst on saturated masstones), so the display
        // bound is the perceptual one — direction and magnitude carry the law.
        const displayed = coeffsToLinear(est.coeffs).map((v) => clamp01(compand(clamp01(v))))
        const err = Math.max(...displayed.map((v, i) => Math.abs(v - t[i]!)))
        expect(err, `${name} d=${depth}: display`).toBeLessThan(0.08)
      }
    }
  })

  it('keeps the same-paint gate closed and opens it for a different paint', () => {
    for (const depth of DEPTHS) {
      for (const name of ['blue', 'yellow'] as const) {
        const pigment = pigmentFromHex(PALETTE[name]!)
        const stored = pigment.coeffs.map((v) => v * depth)
        const est = underlayCoeffsCpu(storedTransmittanceSrgb(stored))
        expect(
          cos(est.coeffs, pigment.coeffs),
          `${name} d=${depth}: own committed paint must stay gated (cos >= 0.995)`,
        ).toBeGreaterThan(0.995)
      }
      const blueBase = pigmentFromHex(PALETTE.blue!)
      const yellowBrush = pigmentFromHex(PALETTE.yellow!)
      const est = underlayCoeffsCpu(
        storedTransmittanceSrgb(blueBase.coeffs.map((v) => v * depth)),
      )
      expect(
        cos(est.coeffs, yellowBrush.coeffs),
        `yellow brush over a blue committed base d=${depth} must lift`,
      ).toBeLessThan(0.5)
    }
  })

  it('opens the lift gate on a real committed base (alpha above the 0.43 line)', () => {
    // smoothstep(0.55, 0.85, clamp(alpha / 0.5)) is 1 from alpha 0.425 up; the
    // measured app-live blue sheet reads 0.447 and the bake's tap cover 0.68.
    const stored = pigmentFromHex(PALETTE.blue!).coeffs.map((v) => v * 0.7)
    const est = underlayCoeffsCpu(storedTransmittanceSrgb(stored))
    expect(est.alpha).toBeGreaterThan(0.43)
  })
})

describe('committed-base tap — the emitted block', () => {
  it('emits the shipped tables from spectralData, never retyped', () => {
    const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : v.toPrecision(7))
    expectContains(BLOCK, `const vec4 PRI_A[38]`)
    expectContains(BLOCK, `const vec2 PRI_B[38]`)
    expectContains(BLOCK, `const float BASIS_K[266]`)
    expectContains(BLOCK, f(PRIMARIES[0]![0]!))
    expectContains(BLOCK, f(PRIMARIES[0]![2]!))
    expectContains(BLOCK, f(PRIMARIES[37]![5]!))
    expectContains(BLOCK, f(BASIS[0]![0]!))
    expectContains(BLOCK, f(BASIS[6]![37]!))
    expectContains(BLOCK, `-log(max(r, ${f(SPECTRAL_EPSILON)}))`)
    // 38 bands, the pigmentFromHex reflectance upsample, one row offset per
    // coefficient — the exact shape of the CPU law this block mirrors.
    expect(BLOCK.match(/PRI_A\[i\]/g)?.length, 'per-band reflectance reads').toBeGreaterThanOrEqual(1)
    for (let k = 0; k < 7; k++) expectContains(BLOCK, `BASIS_K[${k * 38}+i]`)
    expectContains(SPECTRAL_SOURCE, 'export function pigmentFromDisplayGLSL')
  })

  it('declares the base uniforms and gates every read behind uBaseTapOn', () => {
    expectContains(CARRIER, 'uniform sampler2D uBaseTap;')
    expectContains(CARRIER, 'uniform float uBaseTapOn;')
    expectContains(CARRIER, 'uniform float uBaseTime;')
    expectContains(CARRIER, `${pigmentFromDisplayGLSL()}`)
    expectContains(CARRIER, 'if (uBaseTapOn > 0.5)')
    // The base's share is the deposit law's residual (1 - cover/floor), the
    // fraction of the base a re-bake's sheet would still hold — NOT the
    // display's 1 - cover, whose raw cover saturates at the Body floor.
    expectContains(CARRIER, 'float share = 1.0 - clamp(cov / uBodyFloor, 0.0, 1.0);')
    expectContains(CARRIER, 'cov = clamp(cov + underlayAlpha(texture(uBaseTap, uv).rgb) * share, 0.0, 1.0);')
    // All three taps go through the same tap reader, and the weighted sum keeps
    // the recorded expression shape so uBaseTapOn = 0 is the pre-fix path.
    expect(CARRIER.match(/tapCanvas\(/g)?.length, 'tap reader: one definition + three taps').toBe(4)
    expectContains(CARRIER, 'canvasA = (tapA0 * w0 + tapA1 * w1 + tapA2 * w2) / wSum;')
    // wetAt: the base's stamp is the oldest memory a session can hold, so the
    // last touch is the MORE RECENT of the sheet's and the base's — a sheet
    // age beyond the base's is cleared-sentinel residue, and the union cover
    // feeds the gate.
    expectContains(CARRIER, 'age = min(age, max(uNow - uBaseTime, 0.0));')
  })
})

describe('committed-base tap — the engine seam', () => {
  it('binds the underlay on its own unit and stamps the base age at setUnderlay', () => {
    expectContains(ENGINE_SOURCE, 'uBaseTap')
    expectContains(ENGINE_SOURCE, 'uBaseTapOn')
    expectContains(ENGINE_SOURCE, 'uBaseTime')
    // Unit 11: the carrier already owns 0..10 (reservoirs, fields, cover, times).
    expectContains(ENGINE_SOURCE, 'this.underlayTex ?? this.paper.tex[0]')
    expectContains(ENGINE_SOURCE, 'private underlayTimeSec')
    expectContains(ENGINE_SOURCE, 'ageSeconds')
  })

  it('setUnderlay stamps engine seconds — the ONE time base for last-touch', () => {
    expectContains(ENGINE_SOURCE, 'this.underlayTimeSec = this.nowSec() - age')
  })
})
