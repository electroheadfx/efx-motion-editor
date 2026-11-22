// ============================================================
//  The last-touch time-base law (WR-03; 64-26 Task 1).
//
//  Family: plain unit test on the existing setup — no new config, no
//  WebGL. Last-touch stamps are SECONDS relative to the engine's own
//  time base, so a raw stamp is meaningless on another engine's clock.
//  The whole-document record therefore travels as AGES — seconds before
//  the capture — and each engine re-stamps them on its own clock.
//
//  Laws pinned here:
//   1. `stampsToAges` converts IN PLACE: a fresh stamp is age 0, an old
//      stamp its elapsed seconds, the one-week sentinel an ancient age
//      (never fresh), and a future stamp clamps to 0.
//   2. `agesToStamps` returns a NEW array: the record it was handed is
//      byte-identical afterwards, and each re-stamped texel's implied
//      age equals the captured age.
//   3. The sentinel round-trips inside the recorded f32 bound at a
//      24-hour session (now = 86400 s): the re-stamped value is
//      negative and its error is under 0.1 s.
//   4. Neither conversion reads a clock — the caller passes `now` — and
//      the module records WR-03 and the f32 precision bound.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { agesToStamps, stampsToAges } from './lastTouchClock'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(resolve(HERE, 'lastTouchClock.ts'), 'utf8')

// The cleared last-touch value: one week before the clock's zero.
const SENTINEL = -604800

describe('stampsToAges', () => {
  it('converts in place: fresh is 0, old is its elapsed age, the sentinel is ancient', () => {
    const now = 100
    const stamps = new Float32Array([now, now - 5, SENTINEL, now + 3])
    const returned = stampsToAges(stamps, now)

    expect(returned, 'the conversion is in place').toBe(stamps)
    expect(stamps[0], 'a fresh stamp is age 0').toBe(0)
    expect(stamps[1], 'an old stamp is its elapsed seconds').toBe(5)
    expect(stamps[2], 'the sentinel becomes an ancient age').toBe(now - SENTINEL)
    expect(stamps[2], 'an ancient age is never fresh').toBeGreaterThan(604800)
    expect(stamps[3], 'a future stamp clamps to 0, never negative').toBe(0)
  })
})

describe('agesToStamps', () => {
  it('returns a NEW array and leaves the record byte-identical', () => {
    const now = 100
    const ages = new Float32Array([0, 5, 604900])
    const snapshot = Array.from(ages)

    const stamps = agesToStamps(ages, now)

    expect(stamps, 'a new array, so a cached sheet keeps its snapshot').not.toBe(ages)
    expect(stamps.length).toBe(ages.length)
    expect(Array.from(ages), 'the input is never mutated').toEqual(snapshot)
    for (let i = 0; i < ages.length; i += 1) {
      expect(now - stamps[i], `implied age at ${i}`).toBeCloseTo(ages[i]!, 4)
    }
  })

  it('round-trips the sentinel inside the recorded f32 bound at 24 hours', () => {
    const now = 24 * 3600
    const stamps = new Float32Array([SENTINEL])
    stampsToAges(stamps, now)
    expect(stamps[0], 'the sentinel is an ancient age').toBeGreaterThan(604800)

    const back = agesToStamps(stamps, now)
    expect(back[0], 'the re-stamped sentinel is still negative (dry)').toBeLessThan(0)
    expect(Math.abs(back[0]! - SENTINEL), 'inside the 0.1 s f32 bound').toBeLessThan(0.1)
  })
})

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` dumps the module into the RED report and breaks its format.
function expectSourceContains(needle: string): void {
  expect(SOURCE.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectSourceLacks(needle: string): void {
  expect(SOURCE.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

describe('the module contract', () => {
  it('names WR-03 and the f32 bound, and reads no clock of its own', () => {
    expectSourceContains('WR-03')
    expectSourceContains('24-hour')
    expectSourceLacks('Date.now(')
    expectSourceLacks('performance.now(')
    expectSourceContains('Math.max(now - stamp, 0)')
  })
})
