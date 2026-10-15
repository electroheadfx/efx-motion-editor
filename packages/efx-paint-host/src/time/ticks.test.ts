// ============================================================
//  RED/GREEN coverage for the host-owned fixed integer tick grid
//  (DATA-03 / D-23) and the uncapped diffusion/cuisson mechanism
//  (D-20). Modules load lazily so RED fails on a missing-export
//  assertion, not a collection/load error.
// ============================================================

import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Lazy loaders — RED: ./ticks and ./diffusion do not exist, so the named
// exports are undefined and the assertions below are the intentional failure.
// ---------------------------------------------------------------------------

type TicksFromSeconds = (seconds: number) => number
type SecondsFromTicks = (ticks: number) => number
type SnapSampleToTick = (secondsWithinStroke: number) => number
type CuissonTicks = (stroke: { cuisson: number }) => number
type ClampCuissonTicks = (value: number, min: number, max: number) => number

interface TicksModule {
  HOST_TICK_HZ?: number
  ticksFromSeconds?: TicksFromSeconds
  secondsFromTicks?: SecondsFromTicks
  snapSampleToTick?: SnapSampleToTick
}

interface DiffusionModule {
  cuissonTicks?: CuissonTicks
  clampCuissonTicks?: ClampCuissonTicks
}

async function loadTicks(): Promise<TicksModule> {
  try {
    return (await import('./ticks')) as TicksModule
  } catch {
    return {}
  }
}

async function loadDiffusion(): Promise<DiffusionModule> {
  try {
    return (await import('./diffusion')) as DiffusionModule
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Host tick grid — DATA-03 / D-23
// ---------------------------------------------------------------------------

describe('HOST_TICK_HZ fixed integer tick grid (DATA-03 / D-23)', () => {
  it('HOST_TICK_HZ is the constant 60', async () => {
    const { HOST_TICK_HZ } = await loadTicks()
    expect(HOST_TICK_HZ, './ticks must export HOST_TICK_HZ').toBeTypeOf('number')
    expect(HOST_TICK_HZ).toBe(60)
  })

  it('ticksFromSeconds(0.5) returns 30 ticks at 60 Hz', async () => {
    const { ticksFromSeconds } = await loadTicks()
    expect(ticksFromSeconds, './ticks must export ticksFromSeconds').toBeTypeOf('function')
    expect(ticksFromSeconds!(0.5)).toBe(30)
  })

  it('secondsFromTicks(30) returns 0.5 seconds', async () => {
    const { secondsFromTicks } = await loadTicks()
    expect(secondsFromTicks, './ticks must export secondsFromTicks').toBeTypeOf('function')
    expect(secondsFromTicks!(30)).toBe(0.5)
  })

  it('snapSampleToTick(0.501) snaps to the nearest tick 30', async () => {
    const { snapSampleToTick } = await loadTicks()
    expect(snapSampleToTick, './ticks must export snapSampleToTick').toBeTypeOf('function')
    expect(snapSampleToTick!(0.501)).toBe(30)
  })

  it('ticksFromSeconds(Number.NaN) throws a named RangeError', async () => {
    const { ticksFromSeconds } = await loadTicks()
    expect(ticksFromSeconds, './ticks must export ticksFromSeconds').toBeTypeOf('function')
    expect(() => ticksFromSeconds!(Number.NaN)).toThrow(RangeError)
  })

  it('ticksFromSeconds(-1) throws a named RangeError (negative seconds)', async () => {
    const { ticksFromSeconds } = await loadTicks()
    expect(ticksFromSeconds, './ticks must export ticksFromSeconds').toBeTypeOf('function')
    expect(() => ticksFromSeconds!(-1)).toThrow(RangeError)
  })

  it('secondsFromTicks(1.5) throws a named RangeError (fractional ticks)', async () => {
    const { secondsFromTicks } = await loadTicks()
    expect(secondsFromTicks, './ticks must export secondsFromTicks').toBeTypeOf('function')
    expect(() => secondsFromTicks!(1.5)).toThrow(RangeError)
  })

  it('secondsFromTicks(Number.POSITIVE_INFINITY) throws a named RangeError', async () => {
    const { secondsFromTicks } = await loadTicks()
    expect(secondsFromTicks, './ticks must export secondsFromTicks').toBeTypeOf('function')
    expect(() => secondsFromTicks!(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('every public timing return is a non-negative integer tick count', async () => {
    const { ticksFromSeconds, snapSampleToTick } = await loadTicks()
    expect(ticksFromSeconds, './ticks must export ticksFromSeconds').toBeTypeOf('function')
    expect(snapSampleToTick, './ticks must export snapSampleToTick').toBeTypeOf('function')
    for (const ticks of [ticksFromSeconds!(0), ticksFromSeconds!(1), snapSampleToTick!(0.001), snapSampleToTick!(2.4)]) {
      expect(Number.isInteger(ticks)).toBe(true)
      expect(ticks).toBeGreaterThanOrEqual(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Uncapped cuisson mechanism — D-20 (host owns mechanism, never the cap)
// ---------------------------------------------------------------------------

describe('diffusion/cuisson tick-budget mechanism (D-20, no host ceiling)', () => {
  it('cuissonTicks({ cuisson: 10000 }) returns 10000 unchanged (no host ceiling)', async () => {
    const { cuissonTicks } = await loadDiffusion()
    expect(cuissonTicks, './diffusion must export cuissonTicks').toBeTypeOf('function')
    expect(cuissonTicks!({ cuisson: 10000 })).toBe(10000)
  })

  it('cuissonTicks returns the stroke budget as a non-negative integer', async () => {
    const { cuissonTicks } = await loadDiffusion()
    expect(cuissonTicks, './diffusion must export cuissonTicks').toBeTypeOf('function')
    expect(cuissonTicks!({ cuisson: 0 })).toBe(0)
    expect(cuissonTicks!({ cuisson: 4 })).toBe(4)
  })

  it('clampCuissonTicks(5, 1, 3) clamps to the caller-supplied max 3', async () => {
    const { clampCuissonTicks } = await loadDiffusion()
    expect(clampCuissonTicks, './diffusion must export clampCuissonTicks').toBeTypeOf('function')
    expect(clampCuissonTicks!(5, 1, 3)).toBe(3)
  })

  it('clampCuissonTicks(0, 1, 3) clamps to the caller-supplied min 1', async () => {
    const { clampCuissonTicks } = await loadDiffusion()
    expect(clampCuissonTicks, './diffusion must export clampCuissonTicks').toBeTypeOf('function')
    expect(clampCuissonTicks!(0, 1, 3)).toBe(1)
  })

  it('clampCuissonTicks is a pure range clamp (in-range values pass through)', async () => {
    const { clampCuissonTicks } = await loadDiffusion()
    expect(clampCuissonTicks, './diffusion must export clampCuissonTicks').toBeTypeOf('function')
    expect(clampCuissonTicks!(2, 1, 3)).toBe(2)
    expect(clampCuissonTicks!(1, 1, 3)).toBe(1)
    expect(clampCuissonTicks!(3, 1, 3)).toBe(3)
  })
})
