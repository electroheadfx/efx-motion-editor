// ============================================================
//  toStudioStroke.test.ts — 261031-cf9 persisted paint seed salt.
//
//  The salt is reserved host state inside the open canonical
//  `engine.params` bag. `toStudioStroke` is the ONE projection, so
//  folding it into `traceSeed` there keeps the adapter untouched
//  (`configure()` already keys `engine.setRandom(stroke.traceSeed)`).
//
//  Standing pins:
//    · absent salt  -> hashMutationId(mutationId), byte-identical to today
//    · finite salt  -> mixStrokeSeed(hashMutationId(id), salt)
//    · total/fail-closed helper: absent/NaN/Infinity/string/negative -> null
//    · truncation: 4.7 -> 4; 0 is a valid salt
//    · payload codec round-trip preserves the salt and the same seed
//    · the engine-params projection stays inert to the key
// ============================================================

import { describe, expect, it } from 'vitest'
import { hashMutationId, mixStrokeSeed } from '@efxlab/efx-paint-host'
import { payloadCodec } from './codec'
import { isAquarelleDryEvent } from './dryEvent'
import { toEngineParams } from '../playground/params'
import {
  PAINT_SEED_SALT_PARAM,
  paintSeedSaltOf,
  toStudioStroke,
  type AquarelleStroke,
} from './toStudioStroke'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRuntimeStroke(overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#2244aa',
    params: { size: 12, water: 50, flow: 50 },
    brushId: 'wc/round-medium',
    points: [
      { x: 20, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 28, y: 32, p: 0.6, tx: 0, ty: 0, tw: 0 },
      { x: 36, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 44, y: 32, p: 0.4, tx: 0, ty: 0, tw: 0 },
    ],
    mutationId: 42,
    timestamp: 1000,
    ...overrides,
  }
}

function paramsWithSalt(salt: number): Record<string, number> {
  return { size: 12, water: 50, flow: 50, [PAINT_SEED_SALT_PARAM]: salt }
}

const BASE_SEED = hashMutationId(42)

// ---------------------------------------------------------------------------
// 1. The projection — absent salt keeps today's exact seed
// ---------------------------------------------------------------------------

describe('toStudioStroke paint seed salt (261031-cf9)', () => {
  it('yields hashMutationId(mutationId) when no salt is recorded', () => {
    const stroke = toStudioStroke(makeRuntimeStroke())
    expect(stroke.traceSeed).toBe(BASE_SEED)
    expect(stroke.engine.params[PAINT_SEED_SALT_PARAM]).toBeUndefined()
  })

  it('folds a finite salt through mixStrokeSeed', () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ params: paramsWithSalt(3) }))
    expect(stroke.traceSeed).toBe(mixStrokeSeed(BASE_SEED, 3))
    expect(stroke.traceSeed).not.toBe(BASE_SEED)
  })

  it('salt 0 is valid and differs from an absent salt', () => {
    const salted = toStudioStroke(makeRuntimeStroke({ params: paramsWithSalt(0) }))
    const absent = toStudioStroke(makeRuntimeStroke())
    expect(salted.traceSeed).toBe(mixStrokeSeed(BASE_SEED, 0))
    expect(salted.traceSeed).not.toBe(absent.traceSeed)
  })

  it('different salts produce different seeds; the same salt reproduces the seed', () => {
    const salt3 = toStudioStroke(makeRuntimeStroke({ params: paramsWithSalt(3) }))
    const salt4 = toStudioStroke(makeRuntimeStroke({ params: paramsWithSalt(4) }))
    const salt3Again = toStudioStroke(makeRuntimeStroke({ params: paramsWithSalt(3) }))
    expect(salt3.traceSeed).not.toBe(salt4.traceSeed)
    expect(salt3Again.traceSeed).toBe(salt3.traceSeed)
  })

  it('truncates a fractional salt to its integer part', () => {
    const fractional = toStudioStroke(makeRuntimeStroke({ params: paramsWithSalt(4.7) }))
    const integer = toStudioStroke(makeRuntimeStroke({ params: paramsWithSalt(4) }))
    expect(fractional.traceSeed).toBe(integer.traceSeed)
  })
})

// ---------------------------------------------------------------------------
// 2. paintSeedSaltOf — total and fail-closed
// ---------------------------------------------------------------------------

describe('paintSeedSaltOf', () => {
  it('returns null for an absent key', () => {
    expect(paintSeedSaltOf({ size: 12 })).toBeNull()
  })

  it('returns null for NaN, Infinity, a string and a negative value', () => {
    expect(paintSeedSaltOf({ [PAINT_SEED_SALT_PARAM]: NaN })).toBeNull()
    expect(paintSeedSaltOf({ [PAINT_SEED_SALT_PARAM]: Infinity })).toBeNull()
    expect(
      paintSeedSaltOf({
        [PAINT_SEED_SALT_PARAM]: '3' as unknown as number,
      }),
    ).toBeNull()
    expect(paintSeedSaltOf({ [PAINT_SEED_SALT_PARAM]: -1 })).toBeNull()
  })

  it('truncates 4.7 to 4 and accepts 0 as a salt', () => {
    expect(paintSeedSaltOf({ [PAINT_SEED_SALT_PARAM]: 4.7 })).toBe(4)
    expect(paintSeedSaltOf({ [PAINT_SEED_SALT_PARAM]: 0 })).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 3. Persistence law — the salt survives the payload codec round-trip
// ---------------------------------------------------------------------------

describe('paint seed salt persistence', () => {
  it('round-trips through payloadCodec and re-projects to the same seed', () => {
    const runtime = makeRuntimeStroke({ params: paramsWithSalt(3) })
    const projected = toStudioStroke(runtime)
    const decoded = payloadCodec.parse(payloadCodec.serialize(projected))

    expect(decoded).not.toBeNull()
    if (decoded === null || isAquarelleDryEvent(decoded)) {
      throw new Error('expected the decoded event to be a stroke')
    }
    expect(decoded.engine.params[PAINT_SEED_SALT_PARAM]).toBe(3)

    const reprojected = toStudioStroke({
      ...runtime,
      params: { ...decoded.engine.params },
    })
    expect(reprojected.traceSeed).toBe(projected.traceSeed)
    expect(reprojected.traceSeed).toBe(mixStrokeSeed(BASE_SEED, 3))
  })

  it('leaves the engine-params projection unchanged', () => {
    expect(toEngineParams({ size: 12, [PAINT_SEED_SALT_PARAM]: 3 })).toEqual(
      toEngineParams({ size: 12 }),
    )
  })
})
