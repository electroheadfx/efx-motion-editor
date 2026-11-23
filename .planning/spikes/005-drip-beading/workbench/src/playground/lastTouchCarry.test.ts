// ============================================================
//  The last-touch ping-pong carry law (CR-03; 64-26 Task 1).
//
//  Family: plain unit test on the existing setup — no new config, no
//  WebGL. `DoubleTarget`'s halves are two independent textures
//  (`gl.ts double()` creates each separately and `swap()` only swaps
//  references), and `bristleTouch`'s scissored stamp writes only the
//  current dab's rect into the write half, so without a read-to-write
//  carry every dab reverts everything the previous dab stamped. The
//  simulation below reproduces that rollback and proves the carry
//  cures it with one rect-sized copy per dab.
//
//  Laws pinned here:
//   1. Without a carry, a second non-overlapping dab leaves the first
//      dab's texels at the sentinel — the shipped rollback (CR-03).
//   2. With `takeCarry`/`recordStamp` driving the copy, the second dab
//      preserves the first, a third preserves both, and an overlapping
//      dab overwrites only the texels it paints.
//   3. `takeCarry` returns the pending rect once and clears it;
//      `recordStamp` stores nothing for an empty or inverted rect;
//      `invalidateCarry` drops the pending rect unconditionally.
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  invalidateCarry,
  newLastTouchCarry,
  recordStamp,
  takeCarry,
  type TouchRect,
} from './lastTouchCarry'

// The cleared last-touch value (one week before the clock's zero), as the
// engine writes it: both halves start here and every untouched texel holds it.
const SENTINEL = -604800

const W = 40
const H = 12

const idx = (x: number, y: number): number => y * W + x

function blank(): Float32Array {
  return new Float32Array(W * H).fill(SENTINEL)
}

/** The touch fragment's scissored draw: write `value` into the rect only. */
function stamp(half: Float32Array, r: TouchRect, value: number): void {
  for (let y = r.y0; y < r.y1; y += 1) {
    for (let x = r.x0; x < r.x1; x += 1) half[idx(x, y)] = value
  }
}

/** The carry blit: copy the rect from the read half into the write half. */
function carry(read: Float32Array, write: Float32Array, r: TouchRect): void {
  for (let y = r.y0; y < r.y1; y += 1) {
    for (let x = r.x0; x < r.x1; x += 1) write[idx(x, y)] = read[idx(x, y)]
  }
}

const A: TouchRect = { x0: 2, y0: 2, x1: 8, y1: 8 }
const C: TouchRect = { x0: 10, y0: 2, x1: 16, y1: 8 }
const B: TouchRect = { x0: 20, y0: 2, x1: 26, y1: 8 }
// Overlaps A's right edge (5..8) and C's left edge (10..12).
const D: TouchRect = { x0: 5, y0: 4, x1: 12, y1: 10 }

describe('the carry law (CR-03)', () => {
  it('reproduces the shipped rollback without a carry', () => {
    let read = blank()
    let write = blank()
    const swap = (): void => {
      const t = read
      read = write
      write = t
    }

    stamp(write, A, 10)
    swap()
    // The second dab writes only its own rect; nothing carried A over.
    stamp(write, B, 20)
    swap()

    expect(read[idx(3, 3)], 'the first dab was reverted by the second').toBe(SENTINEL)
    expect(read[idx(22, 3)], 'the second dab stamped its own rect').toBe(20)
  })

  it('carries the previous dab rect so two non-overlapping dabs both survive', () => {
    let read = blank()
    let write = blank()
    const state = newLastTouchCarry()
    const swap = (): void => {
      const t = read
      read = write
      write = t
    }
    const dab = (r: TouchRect, value: number): void => {
      const pending = takeCarry(state)
      if (pending) carry(read, write, pending)
      stamp(write, r, value)
      swap()
      recordStamp(state, r)
    }

    dab(A, 10)
    dab(B, 20)

    expect(read[idx(3, 3)], 'the first dab survives the second').toBe(10)
    expect(read[idx(22, 3)], 'the second dab stamps its own rect').toBe(20)
    expect(read[idx(38, 10)], 'nothing outside the dabs was touched').toBe(SENTINEL)
  })

  it('preserves both earlier rects across a third non-overlapping dab', () => {
    let read = blank()
    let write = blank()
    const state = newLastTouchCarry()
    const swap = (): void => {
      const t = read
      read = write
      write = t
    }
    const dab = (r: TouchRect, value: number): void => {
      const pending = takeCarry(state)
      if (pending) carry(read, write, pending)
      stamp(write, r, value)
      swap()
      recordStamp(state, r)
    }

    dab(A, 10)
    dab(C, 30)
    dab(B, 20)

    expect(read[idx(3, 3)], 'the first dab survives two later dabs').toBe(10)
    expect(read[idx(12, 3)], 'the third dab survives too').toBe(30)
    expect(read[idx(22, 3)], 'the last dab stamps its own rect').toBe(20)
  })

  it('preserves texels outside an overlapping dab', () => {
    let read = blank()
    let write = blank()
    const state = newLastTouchCarry()
    const swap = (): void => {
      const t = read
      read = write
      write = t
    }
    const dab = (r: TouchRect, value: number): void => {
      const pending = takeCarry(state)
      if (pending) carry(read, write, pending)
      stamp(write, r, value)
      swap()
      recordStamp(state, r)
    }

    dab(A, 10)
    dab(D, 40)

    expect(read[idx(3, 3)], 'A outside the overlap keeps its stamp').toBe(10)
    expect(read[idx(6, 5)], 'the overlap belongs to the later dab').toBe(40)
    expect(read[idx(11, 9)], 'D outside A is stamped').toBe(40)
    expect(read[idx(30, 3)], 'outside both rects stays dry').toBe(SENTINEL)
  })
})

describe('the carry state machine', () => {
  it('returns the pending rect once and then clears it', () => {
    const state = newLastTouchCarry()
    expect(takeCarry(state), 'a fresh carry holds nothing').toBeNull()
    recordStamp(state, { x0: 1, y0: 1, x1: 3, y1: 3 })
    // Field-by-field: a whole-object `toEqual` prints a multi-line diff and
    // breaks the TAP report format the RED gate reads.
    const used = takeCarry(state)
    expect(used?.x0).toBe(1)
    expect(used?.y0).toBe(1)
    expect(used?.x1).toBe(3)
    expect(used?.y1).toBe(3)
    expect(takeCarry(state), 'the rect is consumed by one carry').toBeNull()
  })

  it('stores nothing for an empty or inverted rect', () => {
    const state = newLastTouchCarry()
    recordStamp(state, { x0: 5, y0: 5, x1: 5, y1: 5 })
    expect(takeCarry(state), 'an empty rect is not a carry').toBeNull()
    recordStamp(state, { x0: 7, y0: 7, x1: 3, y1: 3 })
    expect(takeCarry(state), 'an inverted rect is not a carry').toBeNull()
  })

  it('invalidateCarry drops a pending rect unconditionally', () => {
    const state = newLastTouchCarry()
    recordStamp(state, { x0: 1, y0: 1, x1: 4, y1: 4 })
    invalidateCarry(state)
    expect(takeCarry(state), 'a whole-target write leaves nothing to carry').toBeNull()
  })
})
