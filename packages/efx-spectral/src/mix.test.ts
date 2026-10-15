// ============================================================
//  Standing spectral pin (56-01). Family: paintVersionDisciplineContract /
//  hostGenericityRoundTrip — normal vitest .test.ts, no new config.
//
//  Law (R1.2 / Q6): yellow + blue mixes GREEN (subtractive),
//  never an RGB average. mixSpectral is a pure function.
// ============================================================

import { describe, expect, it } from 'vitest'
import { mixSpectral } from './mix'

describe('mixSpectral', () => {
  it('yellow + blue returns a green-dominant colour (g > r and g > b)', () => {
    const mixed = mixSpectral([255, 255, 0], [0, 0, 255], 0.5)
    expect(mixed[1]).toBeGreaterThan(mixed[0])
    expect(mixed[1]).toBeGreaterThan(mixed[2])
  })

  it('is a pure function — two calls return identical result values', () => {
    const first = mixSpectral([255, 255, 0], [0, 0, 255], 0.5)
    const second = mixSpectral([255, 255, 0], [0, 0, 255], 0.5)
    expect(first[0]).toBe(second[0])
    expect(first[1]).toBe(second[1])
    expect(first[2]).toBe(second[2])
  })
})
