// ============================================================
//  brushBridge — the ONE live/bake mapping, now mask-aware (63-01 / TIP-05).
//
//  Laws pinned here:
//    TIP-02  one derivation function turns declared RGBA into a
//            36,864-byte mask (full branch coverage in deriveMask.test.ts)
//    TIP-05  a registered mask reaches Brush.tipData at tipSize 192,
//            built from CUSTOM_BASE, through buildBrushForStroke
//    D-21    masked tips are stamps: the multiplier bag still applies
//    D-22    the registry is resolved BEFORE the preset lookup; no
//            second mapping path, no gating on preset/response mode
//
//  Assertion style: scalar predicates (boolean/primitive toBe) so TAP
//  diagnostics stay one-line and the RED evidence classifier parses.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { buildBrushForStroke } from './brushBridge'
import { CUSTOM_BASE, TIP_SIZE } from './brushes'
import { deriveMask, TIP_MASK_BYTES } from '../brushes/deriveMask'
import {
  registerMask,
  resetMaskRegistry,
  resolveMask,
} from '../brushes/maskRegistry'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function solidMask(value: number): Uint8Array {
  return new Uint8Array(TIP_MASK_BYTES).fill(value)
}

/** A 192×192 RGBA buffer with one controlled pixel, everything else opaque white. */
function makeRgba(fill: [number, number, number, number]): Uint8Array {
  const rgba = new Uint8Array(TIP_MASK_BYTES * 4)
  for (let i = 0; i < TIP_MASK_BYTES; i++) {
    rgba[i * 4] = fill[0]
    rgba[i * 4 + 1] = fill[1]
    rgba[i * 4 + 2] = fill[2]
    rgba[i * 4 + 3] = fill[3]
  }
  return rgba
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

beforeEach(() => {
  resetMaskRegistry()
})

// ---------------------------------------------------------------------------
// deriveMask — the declared 192×192 contract (branch law in deriveMask.test.ts)
// ---------------------------------------------------------------------------

describe('deriveMask (declared extent)', () => {
  it('yields exactly 36,864 bytes for a 192×192 RGBA image', () => {
    const mask = deriveMask(makeRgba([255, 255, 255, 255]))
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask.length).toBe(TIP_MASK_BYTES)
    expect(TIP_MASK_BYTES).toBe(36_864)
  })

  it('returns null for any buffer whose length is not exactly 192×192×4', () => {
    const short = new Uint8Array(TIP_MASK_BYTES * 4 - 1)
    const long = new Uint8Array(TIP_MASK_BYTES * 4 + 1)
    const empty = new Uint8Array(0)
    expect(deriveMask(short) === null).toBe(true)
    expect(deriveMask(long) === null).toBe(true)
    expect(deriveMask(empty) === null).toBe(true)
  })

  it('alpha branch: any alpha below 250 carries the alpha channel verbatim', () => {
    const rgba = makeRgba([255, 255, 255, 255])
    rgba[17 * 4 + 3] = 100
    const mask = deriveMask(rgba)
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask[17]).toBe(100)
    expect(mask[0]).toBe(255)
  })
})

// ---------------------------------------------------------------------------
// buildBrushForStroke — a registered mask reaches Brush.tipData (TIP-05 / D-21)
// ---------------------------------------------------------------------------

describe('buildBrushForStroke (mask-backed)', () => {
  it('builds tipData deep-equal to the registered mask at tipSize 192', () => {
    const mask = solidMask(180)
    expect(registerMask('wc/custom-test', mask)).toBe(true)
    const brush = buildBrushForStroke('wc/custom-test')
    expect(brush.tipSize).toBe(TIP_SIZE)
    expect(sameBytes(brush.tipData, mask)).toBe(true)
  })

  it('builds from CUSTOM_BASE (follow rotation, 0.2 spacing, 0.4 wetRound)', () => {
    registerMask('wc/custom-base', solidMask(200))
    const brush = buildBrushForStroke('wc/custom-base')
    expect(brush.rotation).toBe(CUSTOM_BASE.rotation)
    expect(brush.spacing).toBe(CUSTOM_BASE.spacing)
    expect(brush.wetRound).toBe(CUSTOM_BASE.wetRound)
    expect(brush.angleJitter).toBe(CUSTOM_BASE.angleJitter)
  })

  it('carries the registered id verbatim as the brush id (no translation)', () => {
    registerMask('wc/custom-abc12345', solidMask(120))
    const brush = buildBrushForStroke('wc/custom-abc12345')
    expect(brush.id).toBe('wc/custom-abc12345')
  })

  it('registry wins over the preset path for a known preset id', () => {
    const mask = solidMask(64)
    registerMask('round', mask)
    const brush = buildBrushForStroke('round')
    expect(sameBytes(brush.tipData, mask)).toBe(true)
    expect(brush.tipMean).toBe(64 / 255)
  })

  it('an unregistered id still takes the preset path', () => {
    const brush = buildBrushForStroke('wc/round-medium')
    expect(brush.id).toBe('round')
    expect(resolveMask('wc/round-medium') === null).toBe(true)
    // The preset's procedural round tip is not a solid 255 square.
    const allMax = brush.tipData.every((v) => v === 255)
    expect(allMax).toBe(false)
  })

  it('a faint mask yields exactly max(0.01, 10/255) — the documented formula', () => {
    const faint = solidMask(10)
    registerMask('wc/faint', faint)
    const brush = buildBrushForStroke('wc/faint')
    expect(brush.tipMean).toBe(Math.max(0.01, 10 / 255))
    expect(brush.tipMean).toBe(10 / 255)
  })

  it('overrides still change spacing, aspect and grain on a mask-backed brush', () => {
    registerMask('wc/custom-mult', solidMask(128))
    const brush = buildBrushForStroke('wc/custom-mult', {
      tip: 2,
      aspect: 3,
      grain: 5,
    })
    expect(brush.spacing).toBe(CUSTOM_BASE.spacing / 2)
    expect(brush.aspect).toBe(CUSTOM_BASE.aspect * 3)
    expect(brush.grain).toBe(CUSTOM_BASE.grain * 5)
  })

  it('a present overrides bag leaves every unmasked multiplier at its base value', () => {
    registerMask('wc/custom-mult2', solidMask(128))
    const plain = buildBrushForStroke('wc/custom-mult2')
    const withOverrides = buildBrushForStroke('wc/custom-mult2', {})
    expect(withOverrides.spacing).toBe(plain.spacing)
    expect(withOverrides.aspect).toBe(plain.aspect)
    expect(withOverrides.wetRound).toBe(plain.wetRound)
  })
})
