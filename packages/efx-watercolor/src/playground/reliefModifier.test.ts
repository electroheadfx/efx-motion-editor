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
  RELIEF_MODIFIER_DEPOSIT_GAIN,
  RELIEF_MODIFIER_ERODE_GAIN,
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

  it('signs the polarity: erode is negative, deposit is positive', () => {
    // The engine's erode branch requires reliefSigned < 0 and its clamped law
    // reads -reliefSigned; the deposit branch requires reliefSigned > 0.
    expect(reliefModifierSigned('erode', 0.15, 1)).toBeLessThan(0)
    expect(reliefModifierSigned('deposit', 0.15, 1)).toBeGreaterThan(0)
  })

  it('makes a light pen measurably weaker than full press in both polarities', () => {
    // 0.405 is the embossPress curve value at p = 0.3
    // (EMBOSS_PRESS_FLOOR + (1 - FLOOR) * 0.3).
    expect(Math.abs(reliefModifierSigned('erode', 0.15, 0.405))).toBeLessThan(
      Math.abs(reliefModifierSigned('erode', 0.15, 1)),
    )
    expect(Math.abs(reliefModifierSigned('deposit', 0.15, 0.405))).toBeLessThan(
      Math.abs(reliefModifierSigned('deposit', 0.15, 1)),
    )
  })

  it('scales each polarity by its own exported gain', () => {
    const base = 0.15
    expect(Math.abs(reliefModifierSigned('erode', base, 1))).toBe(
      RELIEF_MODIFIER_ERODE_GAIN * base,
    )
    expect(Math.abs(reliefModifierSigned('deposit', base, 1))).toBe(
      RELIEF_MODIFIER_DEPOSIT_GAIN * base,
    )
    expect(Math.abs(reliefModifierSigned('erode', base, 0.405))).toBe(
      RELIEF_MODIFIER_ERODE_GAIN * base * 0.405,
    )
    expect(Math.abs(reliefModifierSigned('deposit', base, 0.405))).toBe(
      RELIEF_MODIFIER_DEPOSIT_GAIN * base * 0.405,
    )
  })

  it('declares both gains as finite positive constants', () => {
    for (const gain of [RELIEF_MODIFIER_ERODE_GAIN, RELIEF_MODIFIER_DEPOSIT_GAIN]) {
      expect(Number.isFinite(gain)).toBe(true)
      expect(gain).toBeGreaterThan(0)
    }
  })
})
