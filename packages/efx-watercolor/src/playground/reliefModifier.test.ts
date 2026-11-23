// ============================================================
//  Quick 261123-kpy — the modifier relief law (pure).
//
//  Shift FLATTENS relief and Cmd ENHANCES it, both multiplicatively on the
//  height already painted. The magnitude is PRESSURE-ONLY: the engine never
//  reads the Emboss slider, a real pen follows the existing embossPress floor
//  curve, and the pressureless case is the recorded per-sample `p < 0`
//  sentinel, which is EXACTLY full strength for any input. This is the only
//  executable pin of the pressure contract — the real-engine proof lives in
//  the `emboss-relief-modifier` probe.
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  RELIEF_MODIFIER_MAX,
  RELIEF_MODIFIER_MIN,
  RELIEF_MODIFIER_RATE,
  reliefModifierBand,
  reliefModifierPress,
  reliefModifierRate,
  reliefModifierSigned,
} from './reliefModifier'

describe('modifier relief law (quick 261123-kpy)', () => {
  it('pins the pressureless sentinel at exactly full press, whatever the curve input', () => {
    // A mouse/trackpad sample records p = -1; the engine passes the flag, not
    // the raw pressure, so the modifier strength is EXACTLY 1.0 — not the
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

  it('maps press onto the MIN..MAX band, reaching MAX only at full press', () => {
    expect(reliefModifierBand(0)).toBe(RELIEF_MODIFIER_MIN)
    expect(reliefModifierBand(1)).toBe(RELIEF_MODIFIER_MAX)
    expect(reliefModifierBand(0.5)).toBe(2)
    expect(reliefModifierBand(0.405)).toBeGreaterThan(RELIEF_MODIFIER_MIN)
    expect(reliefModifierBand(0.405)).toBeLessThan(RELIEF_MODIFIER_MAX)
    // Out-of-range inputs clamp rather than extrapolate.
    expect(reliefModifierBand(-0.5)).toBe(RELIEF_MODIFIER_MIN)
    expect(reliefModifierBand(4)).toBe(RELIEF_MODIFIER_MAX)
  })

  it('keeps the per-dab gain small: the effect compounds across a stroke', () => {
    // A stroke's dabs overlap heavily, so the gain applies n times:
    // (1 + rate)^n. RELIEF_MODIFIER_RATE is therefore a fraction of 1, not a
    // relief magnitude — a large value saturates in a couple of dabs.
    expect(RELIEF_MODIFIER_RATE).toBeGreaterThan(0)
    expect(RELIEF_MODIFIER_RATE).toBeLessThan(0.5)
    // Ten overlapping dabs of a stroke must stay within one order of
    // magnitude — a per-dab gain that compounds past that reads as a slab.
    expect(Math.pow(1 + RELIEF_MODIFIER_RATE, 10)).toBeLessThan(10)
    expect(reliefModifierRate(RELIEF_MODIFIER_MAX)).toBe(RELIEF_MODIFIER_RATE)
    expect(reliefModifierRate(RELIEF_MODIFIER_MIN)).toBeCloseTo(RELIEF_MODIFIER_RATE / 3, 10)
    // Graded: a light touch moves the height less than a full press.
    const light = reliefModifierRate(reliefModifierBand(0.405))
    expect(light).toBeGreaterThan(0)
    expect(light).toBeLessThan(RELIEF_MODIFIER_RATE)
    // Never 1, whatever it is handed — no single dab replaces the height.
    expect(reliefModifierRate(99)).toBe(RELIEF_MODIFIER_RATE)
    expect(reliefModifierRate(-1)).toBe(0)
  })

  it('signs the polarity: erode is negative, deposit is positive', () => {
    // The engine's erode branch requires reliefSigned < 0; the deposit branch
    // requires reliefSigned > 0.
    expect(reliefModifierSigned('erode', 0.06)).toBe(-0.06)
    expect(reliefModifierSigned('deposit', 0.06)).toBe(0.06)
  })
})
