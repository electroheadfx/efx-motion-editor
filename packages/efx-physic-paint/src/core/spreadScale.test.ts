// ============================================================
//  260925-b7c — spread scale calibration pins
//
//  Law source: user decision 2026-09-25 (D-11 Spread control):
//    - new 50 = today's 30  → spreadCurve 0.09 (bitwise legacy (30/100)^2)
//    - new 100 = today's 100 → spreadCurve 1.0 (bitwise legacy (100/100)^2)
//    - new 0 = no spread → 0
//    - monotone non-decreasing across 0..100
//    - slider keeps min 0 / max 100 / label "Spread" / default 50 (no UI change)
//
//  Legacy reference formulas are written inline so the pins are
//  self-contained: legacyCurve(s) = (s/100)^2, and the derived
//  quantities the engine/harnesses compute from a curve value:
//    ticks  = max(1, ceil(curve * 10))
//    margin = ceil(2 + waterCurve * brushR * 0.6 + curve * brushR * 0.4)
//  where waterCurve = (water/100)^2.
//
//  Control expectation at base (pre-GREEN): tests 2-4 pass (the legacy
//  law already satisfies range/zero/monotone); test 1 fails (0.25 vs
//  0.09) — that failure IS the RED evidence.
// ============================================================

import { describe, it, expect } from 'vitest'
import { spreadCurveFor } from './spreadScale'

/** Legacy law reference (the law the engine used before 260925-b7c). */
const legacyCurve = (s: number): number => (s / 100) ** 2
const legacyTicks = (curve: number): number => Math.max(1, Math.ceil(curve * 10))
const legacyMargin = (curve: number, water: number, brushR: number): number =>
  Math.ceil(2 + (water / 100) ** 2 * brushR * 0.6 + curve * brushR * 0.4)

const BRUSH_RADII = [2, 8, 16, 32] as const
const WATERS = [10, 50, 90] as const

describe('260925-b7c — spread scale calibration pins', () => {
  it('Pin 1 (calibration): slider 50 == legacy 30 — curve, ticks, and margin bitwise at every grid cell', () => {
    // The curve itself: new 50 must be exactly legacy (30/100)^2 = 0.09.
    expect(spreadCurveFor(50)).toBe(legacyCurve(30))

    // Derived quantities on the fixed brush/water grid: every cell equal
    // to the same quantities computed from legacy (30/100)^2.
    const curve = spreadCurveFor(50)
    const reference = legacyCurve(30)
    for (const brushR of BRUSH_RADII) {
      for (const water of WATERS) {
        expect(legacyTicks(curve)).toBe(legacyTicks(reference))
        expect(legacyMargin(curve, water, brushR)).toBe(legacyMargin(reference, water, brushR))
      }
    }
  })

  it('Pin 2 (range): slider 100 == legacy 100 — curve 1.0, ticks 10, margins match on the same grid', () => {
    expect(spreadCurveFor(100)).toBe(legacyCurve(100))
    expect(legacyTicks(spreadCurveFor(100))).toBe(10)

    const curve = spreadCurveFor(100)
    const reference = legacyCurve(100)
    for (const brushR of BRUSH_RADII) {
      for (const water of WATERS) {
        expect(legacyTicks(curve)).toBe(legacyTicks(reference))
        expect(legacyMargin(curve, water, brushR)).toBe(legacyMargin(reference, water, brushR))
      }
    }
  })

  it('Pin 3 (zero): slider 0 = no spread; out-of-range inputs clamp to [0, 100]', () => {
    expect(spreadCurveFor(0)).toBe(0)
    expect(spreadCurveFor(-5)).toBe(0)
    expect(spreadCurveFor(150)).toBe(1)
  })

  it('Pin 4 (monotone): non-decreasing across 0..100 in 0.5 steps', () => {
    let previous = -Infinity
    for (let s = 0; s <= 100; s += 0.5) {
      const curve = spreadCurveFor(s)
      expect(curve).toBeGreaterThanOrEqual(previous)
      previous = curve
    }
  })
})
