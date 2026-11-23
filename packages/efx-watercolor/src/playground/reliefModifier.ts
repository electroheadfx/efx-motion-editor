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
//  The gains are probe-calibrated on the `emboss-relief-modifier` scene: the
//  starting value is the quick 261123-hr5 full-slider +15 magnitude equivalent
//  at full pressure, and a run whose p=0.3 arm saturates at the clamped erode
//  law lowers the erode gain until the pressure arm reads strictly weaker.
//
//  Pure: no imports, no engine state.
// ============================================================

/** The modifier polarity latched at brush-stroke start. */
export type ReliefMode = 'erode' | 'deposit'

/** Erode gain: probe-calibrated on `emboss-relief-modifier` (see Task 3). */
export const RELIEF_MODIFIER_ERODE_GAIN = 15

/** Deposit gain: probe-calibrated on `emboss-relief-modifier` (see Task 3). */
export const RELIEF_MODIFIER_DEPOSIT_GAIN = 15

/**
 * The pressure factor for a modifier dab. The recorded pressureless sentinel
 * (`p < 0` on the sample) is EXACTLY full strength; a real pen passes the
 * engine's `embossPress` floor-curve value verbatim.
 */
export function reliefModifierPress(embossPressAtPr: number, pressureless: boolean): number {
  return pressureless ? 1 : embossPressAtPr
}

/**
 * The SIGNED relief amount for a modifier dab: erode is negative (the engine's
 * erode branch requires `reliefSigned < 0`), deposit positive. The gain is
 * applied leftmost so `press = 1` reproduces `GAIN * base` bit-for-bit.
 */
export function reliefModifierSigned(mode: ReliefMode, base: number, press: number): number {
  return mode === 'erode'
    ? -(RELIEF_MODIFIER_ERODE_GAIN * base * press)
    : RELIEF_MODIFIER_DEPOSIT_GAIN * base * press
}
