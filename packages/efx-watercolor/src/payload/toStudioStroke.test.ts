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
//
//  61-03 adds the vector-path pins: `anchors` and `curveMode` are
//  copied into the opaque engine block ONLY when present, so a plain
//  stroke keeps its exact pre-vector key set (D-14 independence).
// ============================================================

import { describe, expect, it } from 'vitest'
import { hashMutationId, mixStrokeSeed } from '@efxlab/efx-paint-host'
import { payloadCodec } from './codec'
import { isAquarelleDryEvent } from './dryEvent'
import { toEngineParams } from '../playground/params'
import { ANCHOR_WIDTH_DEFAULT, isUniformWidthProfile } from '../vector/spine'
import type { AquarelleAnchor } from './vectorPath'
import {
  AQUARELLE_TOOLS,
  PAINT_SEED_SALT_PARAM,
  isAquarellePaintTool,
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

// ---------------------------------------------------------------------------
// 4. Vector path engine block (61-03 D-14)
//
//  The anchor list rides the opaque engine slot, which is the ONE
//  persistence carrier. It is copied ONLY when present, so a plain
//  hand-painted stroke keeps today's exact key set.
// ---------------------------------------------------------------------------

/** Key set of the engine block BEFORE this plan — pinned literally. */
const PRE_VECTOR_ENGINE_KEYS = [
  'tool',
  'color',
  'params',
  'brushId',
  'toolOverrides',
  'mutationId',
  'diffusionFrames',
  'timestamp',
  'playFrame',
] as const

const VECTOR_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 20, y: 32, kind: 'auto' },
  { x: 44, y: 32, kind: 'bezier', in: { x: 40, y: 30 }, out: { x: 48, y: 34 } },
]

// quick 261123-kpy (modifier relief): the engine POLARITY rides the opaque
// engine slot and follows the conditional-spread convention — written ONLY
// when latched, so an unflagged stroke keeps its exact key set.
describe('relief engine block (quick 261123-kpy)', () => {
  it('projects each polarity verbatim only when the runtime stroke carries it', () => {
    for (const relief of ['erode', 'deposit'] as const) {
      const flagged = toStudioStroke(makeRuntimeStroke({ relief }))
      expect(flagged.engine.relief).toBe(relief)
      expect(Object.keys(flagged.engine), `relief ${relief}`).toEqual([
        ...PRE_VECTOR_ENGINE_KEYS,
        'relief',
      ])
    }
  })

  it('invents no relief key when the field is absent (byte-identical shape)', () => {
    const stroke = toStudioStroke(makeRuntimeStroke())
    expect('relief' in stroke.engine).toBe(false)
    expect(Object.keys(stroke.engine)).toEqual([...PRE_VECTOR_ENGINE_KEYS])
  })
})

describe('vector path engine block (61-03 D-14)', () => {
  it('copies anchors into the engine block unchanged', () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ anchors: VECTOR_ANCHORS }))
    expect(stroke.engine.anchors).toEqual(VECTOR_ANCHORS)
  })

  it('adds no key at all when the field is absent (byte-identical shape)', () => {
    const stroke = toStudioStroke(makeRuntimeStroke())
    expect(Object.keys(stroke.engine)).toEqual([...PRE_VECTOR_ENGINE_KEYS])
    expect('anchors' in stroke.engine).toBe(false)
  })

  it('round-trips a bezier anchor whose handles have zero length exactly', () => {
    const cornerAnchors: readonly AquarelleAnchor[] = [
      { x: 10, y: 10, kind: 'bezier', in: { x: 10, y: 10 }, out: { x: 10, y: 10 } },
      { x: 20, y: 20, kind: 'bezier', in: { x: 20, y: 20 }, out: { x: 20, y: 20 } },
    ]
    const stroke = toStudioStroke(makeRuntimeStroke({ anchors: cornerAnchors }))
    expect(stroke.engine.anchors).toEqual(cornerAnchors)
    expect(stroke.engine.anchors?.[0]?.in).toEqual({ x: 10, y: 10 })
  })
})

// ---------------------------------------------------------------------------
// 4b. Curve mode engine block (61-30 G-20)
//
//  `curveMode` rides the opaque engine slot, is copied ONLY when present,
//  and lands AFTER the anchor member so a stroke that carries neither keeps
//  today's key order.
// ---------------------------------------------------------------------------

describe('curve mode engine block (61-30 G-20)', () => {
  it('copies a spline mode into the engine block unchanged', () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ curveMode: 'spline' }))
    expect(stroke.engine.curveMode).toBe('spline')
    expect('anchors' in stroke.engine).toBe(false)
    expect(Object.keys(stroke.engine)).toEqual([...PRE_VECTOR_ENGINE_KEYS, 'curveMode'])
  })

  it('invents no curveMode key when the field is absent (byte-identical shape)', () => {
    const stroke = toStudioStroke(makeRuntimeStroke())
    expect('curveMode' in stroke.engine).toBe(false)
    expect(Object.keys(stroke.engine)).toEqual([...PRE_VECTOR_ENGINE_KEYS])
  })
})

// ---------------------------------------------------------------------------
// 5. Sparse width projection through the engine block and the wire (D-10)
// ---------------------------------------------------------------------------

const THREE_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0, y: 0, kind: 'auto' },
  { x: 10, y: 0, kind: 'auto' },
  { x: 20, y: 0, kind: 'auto' },
]

describe('sparse vector width projection (61-03 D-10)', () => {
  it('writes no width key for a fully uniform stroke', () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ anchors: THREE_ANCHORS }))
    const anchors = stroke.engine.anchors ?? []
    expect(anchors).toHaveLength(3)
    expect(anchors.some((anchor) => 'width' in anchor)).toBe(false)
    expect(isUniformWidthProfile(anchors)).toBe(true)
  })

  it('drops an explicit default factor through the engine block (uniform stores nothing)', () => {
    const anchors = [
      THREE_ANCHORS[0]!,
      { ...THREE_ANCHORS[1]!, width: ANCHOR_WIDTH_DEFAULT },
      THREE_ANCHORS[2]!,
    ]
    const stroke = toStudioStroke(makeRuntimeStroke({ anchors }))
    expect(stroke.engine.anchors).toHaveLength(3)
    expect(stroke.engine.anchors?.some((anchor) => 'width' in anchor)).toBe(false)
  })

  it('keeps exactly one width key when one of three anchors reads 1.8', () => {
    const sparse = [THREE_ANCHORS[0]!, THREE_ANCHORS[1]!, { ...THREE_ANCHORS[2]!, width: 1.8 }]
    const stroke = toStudioStroke(makeRuntimeStroke({ anchors: sparse }))
    const anchors = stroke.engine.anchors ?? []
    expect(anchors.filter((anchor) => 'width' in anchor)).toHaveLength(1)
    expect(anchors[2]!.width).toBe(1.8)
    expect('width' in anchors[0]!).toBe(false)
    expect('width' in anchors[1]!).toBe(false)
  })

  it('preserves 1.8 and 0.3 with no clamp to 1 through the engine block and the wire codec', () => {
    for (const factor of [1.8, 0.3]) {
      const anchors = [THREE_ANCHORS[0]!, { ...THREE_ANCHORS[1]!, width: factor }, THREE_ANCHORS[2]!]
      const stroke = toStudioStroke(makeRuntimeStroke({ anchors }))
      expect(stroke.engine.anchors?.[1]?.width).toBe(factor)

      const decoded = payloadCodec.parse(payloadCodec.serialize(stroke))
      expect(decoded).not.toBeNull()
      if (decoded === null || isAquarelleDryEvent(decoded)) {
        throw new Error('expected the decoded event to be a stroke')
      }
      expect(decoded.engine.anchors?.[1]?.width).toBe(factor)
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Raw pointer timing (quick 261116-rp) — repeats and gaps survive
// ---------------------------------------------------------------------------

describe('toStudioStroke raw pointer ticks (quick 261116-rp)', () => {
  it('carries pointTicks into pts[].tick and uses the last tick as the span', () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ pointTicks: [0, 0, 3, 9] }))
    expect(stroke.pts.map((point) => point.tick)).toEqual([0, 0, 3, 9])
    expect(stroke.ticks).toBe(9)
  })

  it('keeps the legacy index law when pointTicks is absent or ill-sized', () => {
    const legacy = toStudioStroke(makeRuntimeStroke())
    expect(legacy.pts.map((point) => point.tick)).toEqual([0, 1, 2, 3])
    expect(legacy.ticks).toBe(3)

    const illSized = toStudioStroke(makeRuntimeStroke({ pointTicks: [0, 2] }))
    expect(illSized.pts.map((point) => point.tick)).toEqual([0, 1, 2, 3])
    expect(illSized.ticks).toBe(3)
  })

  it('never lets a corrupt trace run backwards', () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ pointTicks: [0, 5, 3, 7] }))
    expect(stroke.pts.map((point) => point.tick)).toEqual([0, 5, 5, 7])
    expect(stroke.ticks).toBe(7)
  })

  it('survives the payload codec so the ticks reach AQTL and the script', () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ pointTicks: [0, 0, 3, 9] }))
    const decoded = payloadCodec.parse(payloadCodec.serialize(stroke))
    expect(decoded).not.toBeNull()
    if (decoded === null || isAquarelleDryEvent(decoded)) throw new Error('expected a stroke')
    expect(decoded.pts.map((point) => point.tick)).toEqual([0, 0, 3, 9])
    expect(decoded.ticks).toBe(9)
  })
})

// ---------------------------------------------------------------------------
// 4. The five-member payload union (quick 261121-mtu) — additive only
// ---------------------------------------------------------------------------

describe('AquarelleTool payload union (quick 261121-mtu)', () => {
  it("lists exactly five payload tools, in tool-row order — 'watercolor' second", () => {
    expect([...AQUARELLE_TOOLS]).toEqual(['brush', 'watercolor', 'water', 'pen', 'lift'])
  })

  it('isAquarellePaintTool is true for brush and watercolor only', () => {
    expect(AQUARELLE_TOOLS.filter(isAquarellePaintTool)).toEqual(['brush', 'watercolor'])
  })

  it("accepts a payload whose engine slot carries tool: 'watercolor' (codec shape guard)", () => {
    const stroke = toStudioStroke(makeRuntimeStroke({ tool: 'watercolor' }))
    expect(stroke.engine.tool).toBe('watercolor')
    const decoded = payloadCodec.parse(payloadCodec.serialize(stroke))
    expect(decoded).not.toBeNull()
    if (decoded === null || isAquarelleDryEvent(decoded)) throw new Error('expected a stroke')
    expect(decoded.engine.tool).toBe('watercolor')
  })

  it('keeps the four legacy payloads byte-identical through a JSON round trip', () => {
    // Additive contract: widening the union must not touch what a stored
    // brush/water/pen/lift stroke serialises to — no migration, no new keys.
    for (const tool of ['brush', 'water', 'pen', 'lift'] as const) {
      const projected = toStudioStroke(makeRuntimeStroke({ tool }))
      const json = JSON.stringify(projected.engine)
      const reparsed = JSON.parse(json) as { tool: string }
      expect(reparsed).toEqual(projected.engine)
      expect(reparsed.tool).toBe(tool)
    }
  })
})
