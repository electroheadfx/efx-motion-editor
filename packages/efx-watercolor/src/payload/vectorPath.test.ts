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
import { ANCHOR_WIDTH_MAX, ANCHOR_WIDTH_MIN } from '../vector/spine'
import {
  AQUARELLE_RENDER_MODES,
  DEFAULT_AQUARELLE_RENDER_MODE,
  anchorsEqual,
  isAquarelleRenderMode,
  isVectorStroke,
  normaliseAquarelleAnchors,
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
// 5. One structural type — no second anchor declaration (VEC-04 pin shape)
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
    expect(/\bbrushId\b/.test(source)).toBe(false)
    expect(/\bbrushType\b/.test(source)).toBe(false)
    expect(/\bcolour?\b\s*:/.test(source)).toBe(false)
    expect(/\bcolor\s*:/.test(source)).toBe(false)
  })
})
