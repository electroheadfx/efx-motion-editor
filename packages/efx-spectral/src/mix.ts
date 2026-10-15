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

/** sRGB triple, channels in 0–255. */
export type Rgb = readonly [number, number, number]

/**
 * Subtractive pigment mix: `a` at weight (1-t) and `b` at weight t.
 * t is clamped to [0, 1].
 */
export function mixSpectral(a: Rgb, b: Rgb, t: number): Rgb {
  // RED stub — naive RGB lerp, intentionally NOT subtractive.
  const factor = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0
  return [
    Math.round((a[0] ?? 0) * (1 - factor) + (b[0] ?? 0) * factor),
    Math.round((a[1] ?? 0) * (1 - factor) + (b[1] ?? 0) * factor),
    Math.round((a[2] ?? 0) * (1 - factor) + (b[2] ?? 0) * factor),
  ]
}
