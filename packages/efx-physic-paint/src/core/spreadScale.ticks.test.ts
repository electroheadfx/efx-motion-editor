// ============================================================
//  R9 spread continuity pins (260930-continuity — solver-tick floor)
//
//  Law source: USER DESIGN ACT 2026-09-30d
//  (SPECS/real-paint/01-brush-footprint.md R9):
//  a look lever scales the AMPLITUDE of one always-on process,
//  never its presence.
//
//    physicsTicks(spreadCurve) = max(TICK_FLOOR, ceil(spreadCurve*10))
//    TICK_FLOOR = 3 (à estimer / judged at UAT)
//
//  260925-b7c LOCKED: spreadCurveFor is byte-untouched — the curve
//  compression below 50 is the accepted cause, never reshaped here.
//  Approved range 60-65 must be byte-identical to the pre-floor law
//  (3 at 60-61, 4 at 62-65). The floor only RAISES the low end (the
//  chalk band 0-50 was 1 tick, 51-56 was 2).
//
//  Control expectation at base (pre-GREEN): every pin fails on its
//  first assertion (`physicsTicks` is not exported yet) — clean
//  AssertionErrors, zero crashes. That failure IS the RED evidence.
// ============================================================

import { describe, it, expect } from 'vitest'
import { spreadCurveFor } from './spreadScale'
import * as spreadScaleNs from './spreadScale'

const api = spreadScaleNs as Record<string, unknown>

describe('R9 spread continuity (260930-continuity — tick floor, amplitude not presence)', () => {
  it('tick-floor-lever: physicsTicks is exported next to depositRoom; TICK_FLOOR = 3', () => {
    expect(typeof api.physicsTicks).toBe('function')
    expect(api.TICK_FLOOR).toBe(3)
  })

  it('chalk-floor: slider 0 / 50 / 55 all run TICK_FLOOR ticks (was 1 / 1 / 2)', () => {
    expect(typeof api.physicsTicks).toBe('function')
    const physicsTicks = api.physicsTicks as (sc: number) => number
    const TICK_FLOOR = api.TICK_FLOOR as number
    expect(physicsTicks(spreadCurveFor(0))).toBe(TICK_FLOOR)
    expect(physicsTicks(spreadCurveFor(50))).toBe(TICK_FLOOR)
    expect(physicsTicks(spreadCurveFor(55))).toBe(TICK_FLOOR)
  })

  it('approved-range-identical: slider 60 -> 3 and 65 -> 4 (byte-identical to the pre-floor law)', () => {
    expect(typeof api.physicsTicks).toBe('function')
    const physicsTicks = api.physicsTicks as (sc: number) => number
    expect(physicsTicks(spreadCurveFor(60))).toBe(3)
    expect(physicsTicks(spreadCurveFor(65))).toBe(4)
  })

  it('never-reduces: physicsTicks >= max(1, ceil(sc*10)) at every slider cell — the floor only raises', () => {
    expect(typeof api.physicsTicks).toBe('function')
    const physicsTicks = api.physicsTicks as (sc: number) => number
    for (let s = 0; s <= 100; s += 0.5) {
      const preFloor = Math.max(1, Math.ceil(spreadCurveFor(s) * 10))
      expect(physicsTicks(spreadCurveFor(s))).toBeGreaterThanOrEqual(preFloor)
    }
  })

  it('floor-band: every cell whose pre-floor law is <= TICK_FLOOR runs exactly TICK_FLOOR (0-61 -> 3)', () => {
    expect(typeof api.physicsTicks).toBe('function')
    const physicsTicks = api.physicsTicks as (sc: number) => number
    const TICK_FLOOR = api.TICK_FLOOR as number
    for (let s = 0; s <= 61; s += 0.5) {
      const preFloor = Math.max(1, Math.ceil(spreadCurveFor(s) * 10))
      if (preFloor <= TICK_FLOOR) {
        expect(physicsTicks(spreadCurveFor(s))).toBe(TICK_FLOOR)
      }
    }
    expect(physicsTicks(spreadCurveFor(0))).toBe(3)
    expect(physicsTicks(spreadCurveFor(61))).toBe(3)
  })

  it('monotone: physicsTicks is non-decreasing across slider 0..100', () => {
    expect(typeof api.physicsTicks).toBe('function')
    const physicsTicks = api.physicsTicks as (sc: number) => number
    let previous = -Infinity
    for (let s = 0; s <= 100; s += 0.5) {
      const t = physicsTicks(spreadCurveFor(s))
      expect(t).toBeGreaterThanOrEqual(previous)
      previous = t
    }
  })
})
