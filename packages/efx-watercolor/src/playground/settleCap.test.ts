// ============================================================
//  settleCap — the ONE visible settle window (261019c, 261123-vkb).
//
//  Family: plain unit pins (the formula is pure arithmetic). The law:
//  Dry Speed arrives in PERCENT 0..100 and the return is 60 Hz ticks —
//  0 → 300, 50 → 165, 100 → 30 — with a non-finite argument falling through
//  to the 50 percent default and both ends clamped. The bake re-exports the
//  neutral module's function, so the `./bake` barrel and the main entry
//  resolve the SAME binding (ONE definition, never a second copy).
// ============================================================

import { describe, expect, it } from 'vitest'
import { aquarelleVisibleSettleTicks, SETTLE_TICK_MS } from './settleCap'
import { aquarelleVisibleSettleTicks as aquarelleVisibleSettleTicksFromBake } from '../bake/aquarelleBake'

describe('aquarelleVisibleSettleTicks — the visible settle window (261019c, 261123-vkb)', () => {
  it('maps Dry Speed percent to 60 Hz ticks (0 → 300, 50 → 165, 100 → 30)', () => {
    expect(aquarelleVisibleSettleTicks(0)).toBe(300)
    expect(aquarelleVisibleSettleTicks(50)).toBe(165)
    expect(aquarelleVisibleSettleTicks(100)).toBe(30)
  })

  it('falls through to the 50 percent default on a non-finite argument', () => {
    expect(aquarelleVisibleSettleTicks(Number.NaN)).toBe(165)
    expect(aquarelleVisibleSettleTicks(Number.POSITIVE_INFINITY)).toBe(165)
  })

  it('clamps below 0 to 300 ticks and above 100 to 30 ticks', () => {
    expect(aquarelleVisibleSettleTicks(-20)).toBe(300)
    expect(aquarelleVisibleSettleTicks(140)).toBe(30)
  })

  it('exports the 60 Hz host tick in ms', () => {
    expect(SETTLE_TICK_MS).toBe(1000 / 60)
  })

  it('is ONE definition: the bake re-export is the same function object', () => {
    expect(aquarelleVisibleSettleTicksFromBake).toBe(aquarelleVisibleSettleTicks)
  })
})
