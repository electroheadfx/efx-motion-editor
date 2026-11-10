// @vitest-environment node
// ============================================================
//  vectorPath.test.ts — the persisted vector-path shape (61-03).
//
//  Standing pins for VEC-01 / VEC-03 / VEC-04:
//    · vector-ness is implied by a NON-EMPTY anchor list
//    · render mode is explicit and an absent mode means watercolour (D-12)
//    · a malformed anchor list is refused WHOLE — undefined, never a
//      partially repaired list, never a throw (T-61-08)
//    · the width factor is the ONLY per-anchor paint property
//      (VEC-03 / VEC-04): no per-anchor brush and no per-anchor colour
//    · the anchor type is 61-02's VectorAnchor re-exported, never a
//      second declaration (one structural type, one definition)
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ANCHOR_WIDTH_DEFAULT,
  ANCHOR_WIDTH_MAX,
  ANCHOR_WIDTH_MIN,
  isUniformWidthProfile,
} from '../vector/spine'
import {
  AQUARELLE_RENDER_MODES,
  DEFAULT_AQUARELLE_RENDER_MODE,
  anchorsEqual,
  isAquarelleRenderMode,
  isVectorStroke,
  normaliseAquarelleAnchors,
  projectVectorPath,
  resolveAquarelleRenderMode,
  vectorPathsEqual,
  type AquarelleAnchor,
} from './vectorPath'

const VECTOR_PATH_SOURCE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'vectorPath.ts',
)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TWO_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 20, y: 32, kind: 'auto' },
  { x: 44, y: 32, kind: 'bezier', in: { x: 40, y: 30 }, out: { x: 48, y: 34 } },
]

// ---------------------------------------------------------------------------
// 1. isVectorStroke — a non-empty anchor list IS vector-ness
// ---------------------------------------------------------------------------

describe('isVectorStroke', () => {
  it('is true for a payload carrying a non-empty anchor list', () => {
    expect(isVectorStroke({ anchors: TWO_ANCHORS })).toBe(true)
    expect(isVectorStroke({ anchors: [TWO_ANCHORS[0]!] })).toBe(true)
  })

  it('is false for a payload with no anchors and for an EMPTY anchor list', () => {
    expect(isVectorStroke({})).toBe(false)
    expect(isVectorStroke({ anchors: [] })).toBe(false)
    expect(isVectorStroke(null)).toBe(false)
    expect(isVectorStroke(undefined)).toBe(false)
  })

  it('is false when the anchor list is malformed', () => {
    expect(isVectorStroke({ anchors: [{ x: NaN, y: 0, kind: 'auto' }] })).toBe(false)
    expect(isVectorStroke({ anchors: [{ x: 0, y: 0, kind: 'spline' }] })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. Render mode — explicit, and absent means watercolour (D-12)
// ---------------------------------------------------------------------------

describe('render mode (D-12: explicit discriminator, absent means watercolour)', () => {
  it('declares exactly two modes in this order, defaulting to watercolor', () => {
    expect(AQUARELLE_RENDER_MODES).toEqual(['watercolor', 'simple-ribbon'])
    expect(DEFAULT_AQUARELLE_RENDER_MODE).toBe('watercolor')
  })

  it('resolves an absent mode to watercolor and passes both modes through', () => {
    expect(resolveAquarelleRenderMode(undefined)).toBe('watercolor')
    expect(resolveAquarelleRenderMode('watercolor')).toBe('watercolor')
    expect(resolveAquarelleRenderMode('simple-ribbon')).toBe('simple-ribbon')
  })

  it('resolves any unknown value to watercolor', () => {
    expect(resolveAquarelleRenderMode('oil')).toBe('watercolor')
    expect(resolveAquarelleRenderMode(null)).toBe('watercolor')
    expect(resolveAquarelleRenderMode(3)).toBe('watercolor')
    expect(resolveAquarelleRenderMode({ mode: 'simple-ribbon' })).toBe('watercolor')
  })

  it('isAquarelleRenderMode is a strict membership test', () => {
    expect(isAquarelleRenderMode('watercolor')).toBe(true)
    expect(isAquarelleRenderMode('simple-ribbon')).toBe(true)
    expect(isAquarelleRenderMode('oil')).toBe(false)
    expect(isAquarelleRenderMode(undefined)).toBe(false)
    expect(isAquarelleRenderMode(null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. normaliseAquarelleAnchors — fail-closed over the whole list (T-61-08)
// ---------------------------------------------------------------------------

describe('normaliseAquarelleAnchors', () => {
  it('returns a frozen copy of a well-formed anchor list, unchanged', () => {
    const normalised = normaliseAquarelleAnchors(TWO_ANCHORS)
    expect(normalised).toEqual(TWO_ANCHORS)
    expect(Object.isFrozen(normalised)).toBe(true)
  })

  it('refuses the WHOLE list for a NaN coordinate', () => {
    const malformed = [TWO_ANCHORS[0]!, { x: NaN, y: 32, kind: 'auto' as const }]
    expect(normaliseAquarelleAnchors(malformed)).toBeUndefined()
  })

  it('refuses the whole list for an unknown anchor kind', () => {
    const malformed = [
      TWO_ANCHORS[0]!,
      { x: 30, y: 32, kind: 'spline' as unknown as 'auto' },
    ]
    expect(normaliseAquarelleAnchors(malformed)).toBeUndefined()
  })

  it('refuses the whole list for a non-finite handle', () => {
    const malformed = [
      TWO_ANCHORS[0]!,
      { x: 30, y: 32, kind: 'bezier' as const, in: { x: Infinity, y: 0 }, out: { x: 1, y: 1 } },
    ]
    expect(normaliseAquarelleAnchors(malformed)).toBeUndefined()
    const malformedOut = [
      { x: 30, y: 32, kind: 'bezier' as const, in: { x: 1, y: 1 }, out: { x: 1, y: NaN } },
    ]
    expect(normaliseAquarelleAnchors(malformedOut)).toBeUndefined()
  })

  it('refuses the whole list for a width outside the published range', () => {
    expect(
      normaliseAquarelleAnchors([{ x: 20, y: 32, kind: 'auto', width: 3 }]),
    ).toBeUndefined()
    expect(
      normaliseAquarelleAnchors([{ x: 20, y: 32, kind: 'auto', width: 0.1 }]),
    ).toBeUndefined()
  })

  it('refuses an empty list and a non-array without throwing', () => {
    expect(() => normaliseAquarelleAnchors([])).not.toThrow()
    expect(normaliseAquarelleAnchors([])).toBeUndefined()
    expect(normaliseAquarelleAnchors(undefined)).toBeUndefined()
    expect(normaliseAquarelleAnchors(null)).toBeUndefined()
    expect(normaliseAquarelleAnchors('anchors')).toBeUndefined()
    expect(normaliseAquarelleAnchors({ anchors: TWO_ANCHORS })).toBeUndefined()
  })

  it('accepts both published width bounds exactly', () => {
    expect(
      normaliseAquarelleAnchors([{ x: 0, y: 0, kind: 'auto', width: ANCHOR_WIDTH_MIN }]),
    ).toEqual([{ x: 0, y: 0, kind: 'auto', width: ANCHOR_WIDTH_MIN }])
    expect(
      normaliseAquarelleAnchors([{ x: 0, y: 0, kind: 'auto', width: ANCHOR_WIDTH_MAX }]),
    ).toEqual([{ x: 0, y: 0, kind: 'auto', width: ANCHOR_WIDTH_MAX }])
  })
})

// ---------------------------------------------------------------------------
// 4. Equality — the change-detection primitive for later plans
// ---------------------------------------------------------------------------

describe('anchorsEqual / vectorPathsEqual', () => {
  it('anchorsEqual is true for two deep-equal lists', () => {
    expect(anchorsEqual(TWO_ANCHORS, TWO_ANCHORS.map((anchor) => ({ ...anchor })))).toBe(true)
  })

  it('anchorsEqual is false when a width factor differs by 1e-9', () => {
    const a: readonly AquarelleAnchor[] = [{ x: 10, y: 10, kind: 'auto', width: 1.5 }]
    const b: readonly AquarelleAnchor[] = [{ x: 10, y: 10, kind: 'auto', width: 1.5 + 1e-9 }]
    expect(anchorsEqual(a, b)).toBe(false)
  })

  it('anchorsEqual is false when a handle or a kind differs', () => {
    const base: readonly AquarelleAnchor[] = [
      { x: 10, y: 10, kind: 'bezier', in: { x: 9, y: 9 }, out: { x: 11, y: 11 } },
    ]
    expect(
      anchorsEqual(base, [{ x: 10, y: 10, kind: 'bezier', in: { x: 8, y: 9 }, out: { x: 11, y: 11 } }]),
    ).toBe(false)
    expect(anchorsEqual(base, [{ x: 10, y: 10, kind: 'auto' }])).toBe(false)
  })

  it('vectorPathsEqual compares the mode too, with absent resolving to watercolor', () => {
    expect(vectorPathsEqual({ anchors: TWO_ANCHORS }, { anchors: TWO_ANCHORS })).toBe(true)
    expect(
      vectorPathsEqual(
        { anchors: TWO_ANCHORS, renderMode: 'watercolor' },
        { anchors: TWO_ANCHORS },
      ),
    ).toBe(true)
    expect(
      vectorPathsEqual(
        { anchors: TWO_ANCHORS, renderMode: 'simple-ribbon' },
        { anchors: TWO_ANCHORS },
      ),
    ).toBe(false)
    expect(
      vectorPathsEqual(
        { anchors: TWO_ANCHORS, renderMode: 'simple-ribbon' },
        { anchors: TWO_ANCHORS, renderMode: 'simple-ribbon' },
      ),
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. Sparse width projection (D-10: a uniform stroke stores nothing)
// ---------------------------------------------------------------------------

describe('projectVectorPath — sparse width (D-10)', () => {
  it('omits an explicit default factor and keeps exactly one non-default factor', () => {
    const input: readonly AquarelleAnchor[] = [
      { x: 0, y: 0, kind: 'auto' },
      { x: 10, y: 0, kind: 'auto', width: ANCHOR_WIDTH_DEFAULT },
      { x: 20, y: 0, kind: 'auto', width: 1.8 },
    ]
    const projected = projectVectorPath(input)
    expect(projected).toHaveLength(3)
    expect(projected.filter((anchor) => anchor.width !== undefined)).toHaveLength(1)
    expect(projected.filter((anchor) => 'width' in anchor)).toHaveLength(1)
    expect(projected[2]!.width).toBe(1.8)
  })

  it('keeps a fully uniform list free of width keys, and isUniformWidthProfile agrees', () => {
    const projected = projectVectorPath([
      { x: 0, y: 0, kind: 'auto' },
      { x: 10, y: 0, kind: 'auto' },
      { x: 20, y: 0, kind: 'auto' },
    ])
    expect(projected.every((anchor) => !('width' in anchor))).toBe(true)
    expect(isUniformWidthProfile(projected)).toBe(true)
  })

  it('returns a frozen list, a fresh array, and never mutates its input', () => {
    const input: AquarelleAnchor[] = [
      { x: 0, y: 0, kind: 'auto' },
      { x: 10, y: 0, kind: 'auto', width: ANCHOR_WIDTH_DEFAULT },
    ]
    const projected = projectVectorPath(input)
    expect(Object.isFrozen(projected)).toBe(true)
    expect(projected).not.toBe(input)
    expect(input[1]!.width).toBe(ANCHOR_WIDTH_DEFAULT)
    expect('width' in input[1]!).toBe(true)
  })

  it('preserves anchor order exactly (61-02 stations index into it)', () => {
    const input: readonly AquarelleAnchor[] = [
      { x: 0, y: 0, kind: 'auto' },
      { x: 10, y: 5, kind: 'bezier', in: { x: 9, y: 4 }, out: { x: 11, y: 6 }, width: 0.3 },
      { x: 20, y: 0, kind: 'auto', width: 1.8 },
    ]
    const projected = projectVectorPath(input)
    expect(projected.map((anchor) => [anchor.x, anchor.y])).toEqual([
      [0, 0],
      [10, 5],
      [20, 0],
    ])
    expect(projected[1]!.width).toBe(0.3)
    expect(projected[2]!.width).toBe(1.8)
    expect(projected.map((anchor) => anchor.kind)).toEqual(['auto', 'bezier', 'auto'])
  })
})

// ---------------------------------------------------------------------------
// 6. Render mode survives serialisation (D-12 across a JSON round trip)
// ---------------------------------------------------------------------------

describe('render mode persistence', () => {
  it('keeps simple-ribbon across a JSON round trip of the path', () => {
    const path = { anchors: TWO_ANCHORS, renderMode: 'simple-ribbon' as const }
    const round = JSON.parse(JSON.stringify(path)) as {
      anchors: readonly AquarelleAnchor[]
      renderMode: unknown
    }
    expect(resolveAquarelleRenderMode(round.renderMode)).toBe('simple-ribbon')
    expect(anchorsEqual(round.anchors, TWO_ANCHORS)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 7. One structural type — no second anchor declaration (VEC-04 pin shape)
// ---------------------------------------------------------------------------

describe('the anchor type is re-exported, never redeclared', () => {
  it('re-exports VectorAnchor as AquarelleAnchor from src/vector/spine', () => {
    const source = readFileSync(VECTOR_PATH_SOURCE, 'utf8')
    expect(source).toMatch(/VectorAnchor as AquarelleAnchor/)
    expect(source).toMatch(/from '\.\.\/vector\/spine'/)
    expect(source).not.toMatch(/interface AquarelleAnchor\b/)
    expect(source).not.toMatch(/type AquarelleAnchor\s*=/)
  })

  it('carries no per-anchor brush type and no per-anchor colour member (VEC-04)', () => {
    const source = readFileSync(VECTOR_PATH_SOURCE, 'utf8')
    // 61-07: `resolveRenderModeForBrushId`/`recordedRenderModeField` map a
    // STROKE-level brush id to the stroke's render mode — they are not anchor
    // members. The prohibition is per-ANCHOR paint identity, so the scan is
    // scoped to the anchor type and its canonicalisation, the only place an
    // anchor member can be declared.
    const anchorRegion = source.slice(
      source.indexOf('type MutableAnchor'),
      source.indexOf('export function normaliseAquarelleAnchors'),
    )
    expect(anchorRegion.length).toBeGreaterThan(0)
    expect(/\bbrushId\b/.test(anchorRegion)).toBe(false)
    expect(/\bbrushType\b/.test(anchorRegion)).toBe(false)
    expect(/\bcolour?\b\s*:/.test(anchorRegion)).toBe(false)
    expect(/\bcolor\s*:/.test(anchorRegion)).toBe(false)
  })
})
