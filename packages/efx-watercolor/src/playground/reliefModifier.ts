// ============================================================
//  Quick 261123-kpy — the modifier relief magnitude law (pure).
//
//  Shift at brush-stroke START erodes relief, Cmd deposits it, and Shift wins
//  when both are held. The magnitude is PRESSURE-ONLY:
//
//    - the Emboss slider is NEVER read, so the modifier works at Emboss 0;
//    - a real pen follows the existing `embossPress` floor curve
//      (EMBOSS_PRESS_FLOOR + (1 - FLOOR) * clamp(pr, 0, 1));
//    - a pressureless pointer (mouse/trackpad) is the recorded per-sample
//      `p < 0` sentinel, which is EXACTLY full magnitude for ANY input — the
//      sentinel, never pointerType, so a replayed bag reproduces the live
//      magnitude exactly.
//
//  The band is expressed in EMBOSS-SLIDER UNITS: MIN at the lightest touch
//  rising to MAX at full press. These are the SAME numbers the slider shows,
//  and the engine feeds them through the slider's own delivery law — so a
//  modifier stroke behaves EXACTLY as if the artist had set Emboss to that
//  value. Full press means "as if Emboss were MAX", never "as if the slider
//  were pegged at 15". The first calibration (kpy, gain 15) targeted the
//  slider's ceiling and read far too strong in UAT.
//
//  The engine applies `amount * RELIEF_GAIN` to the band, exactly as it does
//  to `P.emboss` on the normal path, so the modifier inherits the brush's own
//  ink-density scaling and matches what that Emboss number really delivers.
//  `reliefModifierErodeAmount` grades the erode from the BAND (not from the
//  delivered amount), so a light touch smooths gently on every brush instead
//  of wiping the band in a single dab.
//
//  Pure: no imports, no engine state.
// ============================================================

/** The modifier polarity latched at brush-stroke start. */
export type ReliefMode = 'erode' | 'deposit'

/** Lightest-touch magnitude, in Emboss-slider units. */
export const RELIEF_MODIFIER_MIN = 1

/** Full-press magnitude, in Emboss-slider units. */
export const RELIEF_MODIFIER_MAX = 3

/**
 * The pressure factor for a modifier dab. The recorded pressureless sentinel
 * (`p < 0` on the sample) is EXACTLY full strength; a real pen passes the
 * engine's `embossPress` floor-curve value verbatim.
 */
export function reliefModifierPress(embossPressAtPr: number, pressureless: boolean): number {
  return pressureless ? 1 : embossPressAtPr
}

/**
 * The unsigned magnitude in Emboss-slider units: MIN at the lightest touch
 * rising linearly to MAX at full press. The floor curve keeps the lightest
 * touch just above MIN instead of collapsing to nothing.
 */
export function reliefModifierMagnitude(press: number): number {
  const t = press < 0 ? 0 : press > 1 ? 1 : press
  return RELIEF_MODIFIER_MIN + (RELIEF_MODIFIER_MAX - RELIEF_MODIFIER_MIN) * t
}

/**
 * The SIGNED relief amount for a modifier dab: erode is negative (the engine's
 * erode branch requires `reliefSigned < 0`), deposit positive.
 */
export function reliefModifierSigned(mode: ReliefMode, magnitude: number): number {
  return mode === 'erode' ? -magnitude : magnitude
}

/**
 * The erode strength in [0, 1] for a modifier dab, read from the BAND value
 * (not the amount-scaled relief): MAX band is one full-strength pass, lighter
 * touches are graded, so a soft touch smooths gently instead of wiping the
 * band in a single dab.
 */
export function reliefModifierErodeAmount(band: number): number {
  return Math.min(1, band / RELIEF_MODIFIER_MAX)
}
