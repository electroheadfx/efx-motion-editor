// ============================================================
//  mixSpectral — subtractive pigment mixing (Kubelka-Munk).
//
//  Method-level port of the published absorbance/reflectance
//  math from rvanwijnen/spectral.js (MIT — see NOTICE). The
//  reflectance tables live in spectralData.ts. No code is copied
//  or transliterated from SPECS/v1.1.0-water-color/watercolor-playground/
//  or johnowhitaker/inkwash (unlicensed) — clean-room P1 / D-17.
//
//  Law (R1.2 / Q6): yellow + blue mixes GREEN (subtractive),
//  never an RGB average. No Mixbox code, LUTs, or spectra (P2).
//
//  Pure functions only — no module state, no Math.random, no
//  Date.now. Two calls with identical arguments return identical
//  values (D-20 determinism).
// ============================================================

import { BASE_SPECTRA, CIE_CMF, CONVERSION, SPECTRAL_BANDS } from './spectralData'

/** sRGB triple, channels in 0–255. */
export type Rgb = readonly [number, number, number]

const GAMMA = 2.4

function uncompand(x: number): number {
  return x > 0.04045 ? ((x + 0.055) / 1.055) ** GAMMA : x / 12.92
}

function compand(x: number): number {
  return x > 0.0031308 ? 1.055 * x ** (1.0 / GAMMA) - 0.055 : x * 12.92
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function sRgbToLinear(rgb: Rgb): [number, number, number] {
  return [uncompand(rgb[0] / 255), uncompand(rgb[1] / 255), uncompand(rgb[2] / 255)]
}

function linearToSRgb(linear: readonly number[]): Rgb {
  return [
    Math.round(compand(clamp01(linear[0] ?? 0)) * 255),
    Math.round(compand(clamp01(linear[1] ?? 0)) * 255),
    Math.round(compand(clamp01(linear[2] ?? 0)) * 255),
  ]
}

function mulMatVec(m: readonly (readonly number[])[], v: readonly number[]): number[] {
  return m.map((row) => {
    let acc = 0
    for (let i = 0; i < v.length; i++) acc += (row[i] ?? 0) * (v[i] ?? 0)
    return acc
  })
}

/**
 * Spectral upsampling: linear sRGB -> 38-band reflectance curve.
 * Published `lRGB_to_R` decomposition into the six primaries + white.
 */
function linearToReflectance(linear: readonly number[]): number[] {
  const w = Math.min(linear[0] ?? 0, linear[1] ?? 0, linear[2] ?? 0)
  const r = (linear[0] ?? 0) - w
  const g = (linear[1] ?? 0) - w
  const b = (linear[2] ?? 0) - w

  const c = Math.min(g, b)
  const m = Math.min(r, b)
  const y = Math.min(r, g)
  const rr = Math.max(0, Math.min(r - b, r - g))
  const gg = Math.max(0, Math.min(g - b, g - r))
  const bb = Math.max(0, Math.min(b - g, b - r))

  const R = new Array<number>(SPECTRAL_BANDS)
  for (let i = 0; i < SPECTRAL_BANDS; i++) {
    R[i] = Math.max(
      Number.EPSILON,
      w * (BASE_SPECTRA.W[i] ?? 0) +
        c * (BASE_SPECTRA.C[i] ?? 0) +
        m * (BASE_SPECTRA.M[i] ?? 0) +
        y * (BASE_SPECTRA.Y[i] ?? 0) +
        rr * (BASE_SPECTRA.R[i] ?? 0) +
        gg * (BASE_SPECTRA.G[i] ?? 0) +
        bb * (BASE_SPECTRA.B[i] ?? 0),
    )
  }
  return R
}

function reflectanceToLinear(R: readonly number[]): [number, number, number] {
  const xyz = mulMatVec(CIE_CMF.CMF, R)
  const linear = mulMatVec(CONVERSION.XYZ_RGB, xyz)
  return [linear[0] ?? 0, linear[1] ?? 0, linear[2] ?? 0]
}

/** Kubelka-Munk absorption/scattering parameter: (1-R)² / (2R). */
function ks(R: number): number {
  return (1 - R) ** 2 / (2 * R)
}

/** Kubelka-Munk mixing coefficient: 1 + KS - √(KS² + 2·KS). */
function km(KS: number): number {
  return 1 + KS - (KS ** 2 + 2 * KS) ** 0.5
}

function relativeLuminance(linear: readonly number[]): number {
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0)
}

/**
 * Subtractive pigment mix: `a` at weight (1-t) and `b` at weight t.
 *
 * Each pigment is upsampled to a 38-band reflectance curve, converted to
 * Kubelka-Munk KS, concentration-weighted (factor² × tinting-strength² ×
 * luminance, matching the published `mix`), and reconstructed to sRGB.
 *
 * Yellow (#FFFF00) + blue (#0000FF) at t = 0.5 yields a green-dominant
 * colour (g strictly greater than r and b) — never an RGB average.
 *
 * t is clamped to [0, 1]. t = 0 returns `a`, t = 1 returns `b`.
 */
export function mixSpectral(a: Rgb, b: Rgb, t: number): Rgb {
  const factor = clamp01(Number.isFinite(t) ? t : 0)

  const linearA = sRgbToLinear(a)
  const linearB = sRgbToLinear(b)
  const Ra = linearToReflectance(linearA)
  const Rb = linearToReflectance(linearB)

  // Published concentration: factor² × tintingStrength² × luminance.
  // Tinting strength is 1 for both colours (no per-pigment override here).
  const concA = (1 - factor) ** 2 * 1 * relativeLuminance(linearA)
  const concB = factor ** 2 * 1 * relativeLuminance(linearB)
  const total = concA + concB

  const mixed = new Array<number>(SPECTRAL_BANDS)
  for (let i = 0; i < SPECTRAL_BANDS; i++) {
    if (total <= 0) {
      // Both concentrations vanish (black inputs): fall back to a straight
      // KS average so the function stays total.
      mixed[i] = km((ks(Ra[i] ?? Number.EPSILON) + ks(Rb[i] ?? Number.EPSILON)) / 2)
    } else {
      const ksMix = ks(Ra[i] ?? Number.EPSILON) * concA + ks(Rb[i] ?? Number.EPSILON) * concB
      mixed[i] = km(ksMix / total)
    }
  }

  return linearToSRgb(reflectanceToLinear(mixed))
}
