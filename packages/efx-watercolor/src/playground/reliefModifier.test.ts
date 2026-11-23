// ============================================================
//  Quick 261123-kpy — the modifier relief magnitude law (pure).
//
//  Shift at stroke start ERODES relief and Cmd DEPOSITS it. The magnitude is
//  PRESSURE-ONLY: the engine never reads the Emboss slider, a real pen follows
//  the existing embossPress floor curve, and the pressureless case is the
//  recorded per-sample `p < 0` sentinel, which is EXACTLY full magnitude for
//  any input. This is the only executable pin of the pressure contract — the
//  real-engine proof lives in the `emboss-relief-modifier` probe.
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  RELIEF_MODIFIER_ERODE_MAX,
  RELIEF_MODIFIER_MAX,
  RELIEF_MODIFIER_MIN,
  reliefModifierErodeAmount,
  reliefModifierMagnitude,
  reliefModifierPress,
  reliefModifierSigned,
} from './reliefModifier'

describe('modifier relief magnitude law (quick 261123-kpy)', () => {
  it('pins the pressureless sentinel at exactly full press, whatever the curve input', () => {
    // A mouse/trackpad sample records p = -1; the engine passes the flag, not
    // the raw pressure, so the modifier magnitude is EXACTLY 1.0 — not the
    // pressure curve's value at that sample.
    expect(reliefModifierPress(0.405, true)).toBe(1)
    expect(reliefModifierPress(0, true)).toBe(1)
    expect(reliefModifierPress(1, true)).toBe(1)
  })

  it('returns the embossPress curve value verbatim for a real pen', () => {
    expect(reliefModifierPress(0.405, false)).toBe(0.405)
    expect(reliefModifierPress(0, false)).toBe(0)
    expect(reliefModifierPress(1, false)).toBe(1)
  })

  it('declares the artist band as MIN 1 and MAX 3 slider units', () => {
    expect(RELIEF_MODIFIER_MIN).toBe(1)
    expect(RELIEF_MODIFIER_MAX).toBe(3)
  })

  it('maps press onto MIN..MAX, reaching MAX only at full press', () => {
    expect(reliefModifierMagnitude(0)).toBe(RELIEF_MODIFIER_MIN)
    expect(reliefModifierMagnitude(1)).toBe(RELIEF_MODIFIER_MAX)
    expect(reliefModifierMagnitude(0.5)).toBe(2)
    // Monotone across the curve, and never past MAX.
    expect(reliefModifierMagnitude(0.405)).toBeGreaterThan(RELIEF_MODIFIER_MIN)
    expect(reliefModifierMagnitude(0.405)).toBeLessThan(RELIEF_MODIFIER_MAX)
    // Out-of-range inputs clamp rather than extrapolate.
    expect(reliefModifierMagnitude(-0.5)).toBe(RELIEF_MODIFIER_MIN)
    expect(reliefModifierMagnitude(4)).toBe(RELIEF_MODIFIER_MAX)
  })

  it('pins the lightest pen touch at 1 and a pressureless pointer at 3, in slider units', () => {
    // The ship-time calibration bug: gain 15 made a full-press modifier equal
    // the Emboss slider PEGGED at its ceiling. The band is now 1..3.
    const lightest = reliefModifierMagnitude(reliefModifierPress(0, false))
    const fullPen = reliefModifierMagnitude(reliefModifierPress(1, false))
    const mouse = reliefModifierMagnitude(reliefModifierPress(0.405, true))
    expect(lightest).toBe(RELIEF_MODIFIER_MIN)
    expect(fullPen).toBe(RELIEF_MODIFIER_MAX)
    expect(mouse).toBe(RELIEF_MODIFIER_MAX)
    // A light touch is a third of a full press, not a rounding error.
    expect(lightest / fullPen).toBeCloseTo(1 / 3, 5)
  })

  it('signs the polarity: erode is negative, deposit is positive', () => {
    // The engine's erode branch requires reliefSigned < 0; the deposit branch
    // requires reliefSigned > 0.
    expect(reliefModifierSigned('erode', 2)).toBe(-2)
    expect(reliefModifierSigned('deposit', 2)).toBe(2)
  })

  it('makes a light pen measurably weaker than full press in both polarities', () => {
    // 0.405 is the embossPress curve value at p = 0.3
    // (EMBOSS_PRESS_FLOOR + (1 - FLOOR) * 0.3).
    const light = reliefModifierMagnitude(0.405)
    const full = reliefModifierMagnitude(1)
    expect(Math.abs(reliefModifierSigned('erode', light))).toBeLessThan(
      Math.abs(reliefModifierSigned('erode', full)),
    )
    expect(Math.abs(reliefModifierSigned('deposit', light))).toBeLessThan(
      Math.abs(reliefModifierSigned('deposit', full)),
    )
  })

  it('caps the erode so no single dab is a wipe', () => {
    // `dst *= (1 - amount)`, so amount 1 clears the footprint in ONE dab.
    expect(RELIEF_MODIFIER_ERODE_MAX).toBeLessThan(0.5)
    expect(reliefModifierErodeAmount(RELIEF_MODIFIER_MAX)).toBe(RELIEF_MODIFIER_ERODE_MAX)
    expect(reliefModifierErodeAmount(RELIEF_MODIFIER_MIN)).toBeCloseTo(RELIEF_MODIFIER_ERODE_MAX / 3, 10)
    // A light touch smooths more gently than a full press, and is never inert.
    const light = reliefModifierErodeAmount(reliefModifierMagnitude(0.405))
    expect(light).toBeGreaterThan(0)
    expect(light).toBeLessThan(RELIEF_MODIFIER_ERODE_MAX)
    // Never exceeds the cap, whatever it is handed.
    expect(reliefModifierErodeAmount(99)).toBe(RELIEF_MODIFIER_ERODE_MAX)
    expect(reliefModifierErodeAmount(-1)).toBe(0)
  })
})
