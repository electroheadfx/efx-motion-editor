// ============================================================
//  deriveMask — the two-branch derivation law, pinned at every boundary
//  (TIP-03 as amended / D-09). The module header of deriveMask.ts IS
//  the written law; this file is its executable statement.
//
//  Branches pinned:
//    ALPHA      any alpha < 250 → the alpha channel verbatim
//    LUMA-POL   enough alpha    → mean < 128 ? lum : 255 − lum
//    COEFF      Rec. 709 weights, per-pixel rounding
//    NORMALIZE  bake-only contrast stretch, never a divide by zero
//
//  Assertion style: scalar predicates (boolean/primitive toBe) so TAP
//  diagnostics stay one-line and the RED evidence classifier parses.
// ============================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  deriveMask,
  normalizeMaskContrast,
  MASK_ALPHA_THRESHOLD,
  MASK_POLARITY_MEAN_THRESHOLD,
  TIP_MASK_BYTES,
} from './deriveMask'

const TIP_SIZE = 192
const PIXELS = TIP_SIZE * TIP_SIZE

/** A full 192×192 RGBA buffer, every pixel the same colour. */
function uniform(r: number, g: number, b: number, a: number): Uint8Array {
  const rgba = new Uint8Array(PIXELS * 4)
  for (let i = 0; i < PIXELS; i++) {
    rgba[i * 4] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = a
  }
  return rgba
}

function allEqual(mask: Uint8Array, value: number): boolean {
  for (let i = 0; i < mask.length; i++) if (mask[i] !== value) return false
  return true
}

function differingCount(a: Uint8Array, b: Uint8Array): number {
  let count = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) count += 1
  return count + Math.abs(a.length - b.length)
}

describe('deriveMask — pinned constants', () => {
  it('pins the alpha threshold at 250', () => {
    expect(MASK_ALPHA_THRESHOLD).toBe(250)
  })

  it('pins the polarity mean threshold at 128', () => {
    expect(MASK_POLARITY_MEAN_THRESHOLD).toBe(128)
  })

  it('pins the legal mask length at 192 squared', () => {
    expect(TIP_MASK_BYTES).toBe(36_864)
  })
})

describe('deriveMask — alpha branch (any alpha below 250)', () => {
  it('carries the alpha channel verbatim when one pixel sits at alpha 249, even over pure white RGB', () => {
    const rgba = uniform(255, 255, 255, 255)
    rgba[17 * 4 + 3] = 249
    const mask = deriveMask(rgba)
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask.length).toBe(TIP_MASK_BYTES)
    expect(mask[17]).toBe(249)
    expect(mask[0]).toBe(255)
    // Exactly the alpha channel: one pixel differs from the rest.
    expect(differingCount(mask, uniform(255, 255, 255, 255).filter((_v, i) => i % 4 === 3))).toBe(1)
  })

  it('never consults RGB on the alpha branch (black and white RGB yield the same alpha mask)', () => {
    const blackRgb = uniform(0, 0, 0, 200)
    const whiteRgb = uniform(255, 255, 255, 200)
    const a = deriveMask(blackRgb)
    const b = deriveMask(whiteRgb)
    expect(a === null).toBe(false)
    expect(b === null).toBe(false)
    if (a === null || b === null) return
    expect(differingCount(a, b)).toBe(0)
    expect(allEqual(a, 200)).toBe(true)
  })

  it('alpha boundary: an image at exactly 250 alpha everywhere takes the luminance branch', () => {
    // Uniform RGB 200 would be alpha 250 on the alpha branch and 55 on the
    // inverted luminance branch — the mask value names which branch ran.
    const mask = deriveMask(uniform(200, 200, 200, 250))
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask[0]).toBe(55)
    expect(allEqual(mask, 55)).toBe(true)
  })
})

describe('deriveMask — luminance branch, polarity', () => {
  it('light-on-dark: a uniformly dark opaque image yields the luminance itself', () => {
    const mask = deriveMask(uniform(40, 40, 40, 255))
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask[0]).toBe(40)
    expect(allEqual(mask, 40)).toBe(true)
  })

  it('dark-on-light: a uniformly bright opaque image yields 255 minus the luminance', () => {
    const mask = deriveMask(uniform(200, 200, 200, 255))
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask[0]).toBe(55)
    expect(allEqual(mask, 55)).toBe(true)
  })

  it('mean boundary: an exactly mean-128 image is inverted (greater-or-equal rule)', () => {
    const mask = deriveMask(uniform(128, 128, 128, 255))
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask[0]).toBe(127)
    expect(allEqual(mask, 127)).toBe(true)
  })

  it('mean boundary: an image one luminance step darker is NOT inverted', () => {
    const mask = deriveMask(uniform(127, 127, 127, 255))
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask[0]).toBe(127)
    expect(allEqual(mask, 127)).toBe(true)
  })

  it('inversion applies per pixel, not just to the mean', () => {
    // Mean (10·(N−1) + 255)/N ≈ 10.007 → dark branch, so pixels carry their
    // own luminance, including the single bright one.
    const rgba = uniform(10, 10, 10, 255)
    rgba[0] = 255
    rgba[1] = 255
    rgba[2] = 255
    const mask = deriveMask(rgba)
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask[0]).toBe(255)
    expect(mask[1]).toBe(10)
  })
})

describe('deriveMask — luminance coefficients (Rec. 709)', () => {
  it('weights a red-dominant pixel as red, not green or blue', () => {
    const mask = deriveMask(uniform(200, 0, 0, 255))
    expect(mask === null).toBe(false)
    if (mask === null) return
    // round(0.2126 · 200) = round(42.52) = 43
    expect(mask[0]).toBe(43)
  })

  it('weights a green-dominant pixel as green', () => {
    const mask = deriveMask(uniform(0, 100, 0, 255))
    expect(mask === null).toBe(false)
    if (mask === null) return
    // round(0.7152 · 100) = round(71.52) = 72
    expect(mask[0]).toBe(72)
  })

  it('weights a blue-dominant pixel as blue', () => {
    const mask = deriveMask(uniform(0, 0, 255, 255))
    expect(mask === null).toBe(false)
    if (mask === null) return
    // round(0.0722 · 255) = round(18.411) = 18
    expect(mask[0]).toBe(18)
  })

  it('per-pixel spot check: 0.2126·255 + 0.7152·128 + 0.0722·0 rounds to 146', () => {
    const rgba = uniform(10, 10, 10, 255)
    rgba[0] = 255
    rgba[1] = 128
    rgba[2] = 0
    const mask = deriveMask(rgba)
    expect(mask === null).toBe(false)
    if (mask === null) return
    expect(mask[0]).toBe(146)
  })
})

describe('deriveMask — wrong length is total and fail-closed', () => {
  it('returns null for a buffer one byte short of 192×192×4', () => {
    expect(deriveMask(new Uint8Array(PIXELS * 4 - 1)) === null).toBe(true)
  })

  it('returns null for a buffer one byte over 192×192×4', () => {
    expect(deriveMask(new Uint8Array(PIXELS * 4 + 1)) === null).toBe(true)
  })

  it('returns null for an empty buffer', () => {
    expect(deriveMask(new Uint8Array(0)) === null).toBe(true)
  })

  it('returns null for a tiny well-formed buffer at the default extent', () => {
    expect(deriveMask(new Uint8Array(4)) === null).toBe(true)
    expect(deriveMask(new Uint8Array(16)) === null).toBe(true)
  })
})

describe('normalizeMaskContrast — bake-only contrast stretch', () => {
  it('stretches a mask spanning 10..200 onto 0..255', () => {
    const mask = new Uint8Array([10, 105, 200])
    const out = normalizeMaskContrast(mask)
    expect(out.length).toBe(3)
    expect(`${out[0]},${out[1]},${out[2]}`).toBe('0,128,255')
  })

  it('returns a constant mask unchanged, as a copy', () => {
    const mask = new Uint8Array(16).fill(7)
    const out = normalizeMaskContrast(mask)
    expect(out === mask).toBe(false)
    expect(out.length).toBe(16)
    expect(allEqual(out, 7)).toBe(true)
  })

  it('never divides by zero on an empty mask', () => {
    const out = normalizeMaskContrast(new Uint8Array(0))
    expect(out.length).toBe(0)
  })

  it('maps the observed minimum to 0 and maximum to 255', () => {
    const mask = new Uint8Array([10, 30, 200, 120])
    const out = normalizeMaskContrast(mask)
    expect(out[0]).toBe(0)
    expect(out[2]).toBe(255)
  })

  it('is not called from the derivation path (bake-only by law)', () => {
    const source = readFileSync(resolve(__dirname, 'deriveMask.ts'), 'utf8')
    const deriveStart = source.indexOf('export function deriveMask')
    const deriveEnd = source.indexOf('export function normalizeMaskContrast')
    expect(deriveStart >= 0).toBe(true)
    expect(deriveEnd > deriveStart).toBe(true)
    const deriveBody = source.slice(deriveStart, deriveEnd)
    expect(deriveBody.includes('normalizeMaskContrast')).toBe(false)
  })
})
