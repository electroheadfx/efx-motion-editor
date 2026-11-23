// ============================================================
//  Quick 261123-kpy — the modifier relief law (pure).
//
//  Shift at brush-stroke START flattens relief, Cmd enhances it, and Shift
//  wins when both are held. Both directions are ANCHORED TO THE EXISTING
//  HEIGHT — they multiply what is already painted:
//
//    Cmd   : h' = h * (1 + rate * f)     // amplify the film's own relief
//    Shift : h' = h * (1 - rate * f)     // flatten it back toward the film
//
//  so bare paper stays bare (0 times anything is 0), the paint's own texture
//  is enhanced or flattened in place rather than replaced by a stamped dome,
//  and Shift can never cut below what is there. An earlier revision COMPOSED
//  with gl.MAX, which REPLACES the paint's relief with a uniform dome and
//  invents relief where there is no paint — it read as an "internal emboss"
//  destroying the mark (UAT 2026-11-23).
//
//  The magnitude is PRESSURE-ONLY and never reads the Emboss slider, so the
//  modifier works at Emboss 0 (where there is simply nothing to enhance):
//
//    - a real pen follows the existing `embossPress` floor curve
//      (EMBOSS_PRESS_FLOOR + (1 - FLOOR) * clamp(pr, 0, 1));
//    - a pressureless pointer (mouse/trackpad) is the recorded per-sample
//      `p < 0` sentinel, which is EXACTLY full strength for ANY input — the
//      sentinel, never pointerType, so a replayed bag reproduces the live
//      effect exactly.
//
//  The band MIN..MAX is the artist-facing dial (lightest touch to full
//  press); RATE is the per-dab gain it maps onto. RATE is small because the
//  effect COMPOUNDS across the overlapping dabs of one stroke — `(1 + rate)^n`
//  — so a large per-dab value saturates in a couple of dabs.
//
//  Pure: no imports, no engine state.
// ============================================================

/** The modifier polarity latched at brush-stroke start. */
export type ReliefMode = 'erode' | 'deposit'

/** Lightest-touch band value. */
export const RELIEF_MODIFIER_MIN = 1

/** Full-press band value. */
export const RELIEF_MODIFIER_MAX = 3

/**
 * The per-dab gain at FULL press, for both polarities. Small on purpose: a
 * stroke's dabs overlap heavily and the factor compounds, so this is roughly
 * "how much one dab is allowed to move the height".
 */
export const RELIEF_MODIFIER_RATE = 0.25

/**
 * The pressure factor for a modifier dab. The recorded pressureless sentinel
 * (`p < 0` on the sample) is EXACTLY full strength; a real pen passes the
 * engine's `embossPress` floor-curve value verbatim.
 */
export function reliefModifierPress(embossPressAtPr: number, pressureless: boolean): number {
  return pressureless ? 1 : embossPressAtPr
}

/**
 * The band value MIN..MAX for a pressure factor: MIN at the lightest touch to
 * MAX at full press. The floor curve keeps the lightest touch just above MIN
 * instead of collapsing to nothing.
 */
export function reliefModifierBand(press: number): number {
  const t = press < 0 ? 0 : press > 1 ? 1 : press
  return RELIEF_MODIFIER_MIN + (RELIEF_MODIFIER_MAX - RELIEF_MODIFIER_MIN) * t
}

/**
 * The per-dab gain for a band value: RATE at MAX, graded strictly below it.
 * Never 1, so no single dab replaces the height outright.
 */
export function reliefModifierRate(band: number): number {
  const t = band < 0 ? 0 : band > RELIEF_MODIFIER_MAX ? 1 : band / RELIEF_MODIFIER_MAX
  return RELIEF_MODIFIER_RATE * t
}

/**
 * The SIGNED gain for a modifier dab: erode is negative (the engine's erode
 * branch requires `reliefSigned < 0`), deposit positive.
 */
export function reliefModifierSigned(mode: ReliefMode, rate: number): number {
  return mode === 'erode' ? -rate : rate
}
