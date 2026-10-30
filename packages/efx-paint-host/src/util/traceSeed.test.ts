// ============================================================
//  261030-v1t — mixStrokeSeed: the per-output-frame paint salt.
//
//  The aquarelle engine draws every stochastic paint channel from
//  ONE per-stroke RNG (traceSeed). Re-seeding it per output frame
//  gives hand-made variation without touching geometry — but only
//  if the salt is a PURE function of (stroke seed, output frame):
//  same script + option + frame must always reproduce the pixels
//  across two bakes, a save/reopen, a Replay and a Regenerate.
//
//  Laws pinned here:
//    - purity: identical inputs => identical output
//    - distinctness: frames 0, 1, 2 => three different seeds
//    - a pinned literal (the determinism contract, D-20 family)
//    - totality: any finite base / integer frame => a uint32
//    - no Math.random, no clock, no module state
// ============================================================

import { describe, expect, it } from 'vitest'
import { hashMutationId, mixStrokeSeed } from './traceSeed'

describe('mixStrokeSeed (261030-v1t)', () => {
  it('is pure: identical inputs give identical output, every time', () => {
    const base = hashMutationId(42)
    const first = mixStrokeSeed(base, 3)
    for (let i = 0; i < 5; i += 1) expect(mixStrokeSeed(base, 3)).toBe(first)
  })

  it('gives three distinct seeds for the same base at frames 0, 1 and 2', () => {
    const base = hashMutationId(42)
    const seeds = [0, 1, 2].map((frame) => mixStrokeSeed(base, frame))
    expect(new Set(seeds).size).toBe(3)
  })

  it('keeps the base seed distinct from its frame-fixed mixes', () => {
    const base = hashMutationId(42)
    expect(mixStrokeSeed(base, 0)).not.toBe(base)
    expect(mixStrokeSeed(base, 0)).not.toBe(mixStrokeSeed(base, 1))
  })

  it('pins mixStrokeSeed(hashMutationId(42), 3) to its literal', () => {
    expect(hashMutationId(42)).toBe(2850896287)
    expect(mixStrokeSeed(hashMutationId(42), 3)).toBe(179180383)
  })

  it('is total for any finite base and any integer frame (a uint32, never NaN)', () => {
    const bases = [0, 1, 0xffffffff, -7, 1.5, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]
    const frames = [0, 1, -1, 7, 1.7, -3, Number.MAX_SAFE_INTEGER]
    for (const base of bases) {
      for (const frame of frames) {
        const seed = mixStrokeSeed(base, frame)
        expect(Number.isInteger(seed)).toBe(true)
        expect(seed).toBeGreaterThanOrEqual(0)
        expect(seed).toBeLessThanOrEqual(0xffffffff)
      }
    }
  })

  it('truncates a fractional frame — the salt is the integer output frame', () => {
    const base = hashMutationId(42)
    expect(mixStrokeSeed(base, 3.9)).toBe(mixStrokeSeed(base, 3))
  })

  it('never draws from Math.random or the clock', () => {
    const originalRandom = Math.random
    const originalDateNow = Date.now
    Math.random = () => {
      throw new Error('mixStrokeSeed drew from Math.random')
    }
    Date.now = () => {
      throw new Error('mixStrokeSeed read the clock')
    }
    try {
      expect(() => mixStrokeSeed(hashMutationId(42), 5)).not.toThrow()
      expect(mixStrokeSeed(hashMutationId(42), 5)).toBe(mixStrokeSeed(hashMutationId(42), 5))
    } finally {
      Math.random = originalRandom
      Date.now = originalDateNow
    }
  })
})
