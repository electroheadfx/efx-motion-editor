// @vitest-environment node
// ============================================================
//  vectorPath.test.ts — the persisted vector-path shape (61-03).
//
//  Standing pins for VEC-01 / VEC-03 / VEC-04:
//    · vector-ness is implied by a NON-EMPTY anchor list
//    · a malformed anchor list is refused WHOLE — undefined, never a
//      partially repaired list, never a throw (T-61-08)
//    · an anchor carries no per-anchor brush, and since 261111-wd6 it
//      may carry ONE explicit per-vertex colour (VEC-04 revised)
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
  sampleVectorPath,
} from '../vector/spine'
import {
  AQUARELLE_CURVE_MODES,
  DEFAULT_AQUARELLE_CURVE_MODE,
  anchorsEqual,
  evaluateAquarellePath,
  isAquarelleCurveMode,
  isVectorStroke,
  normaliseAquarelleAnchors,
  projectVectorPath,
  recordedCurveModeField,
  resolveAquarelleCurveMode,
  resolveCurveAnchors,
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
// 2. Curve mode (G-20: an evaluation mode over the SAME anchor list, never
//    a third anchor kind and never a rewrite of authored data)
// ---------------------------------------------------------------------------

describe('curve mode (G-20: explicit evaluation discriminator, absent means Bézier)', () => {
  it('declares exactly bezier and spline in this order, defaulting to bezier, and the guard is a strict membership test', () => {
    expect(AQUARELLE_CURVE_MODES).toEqual(['bezier', 'spline'])
    expect(DEFAULT_AQUARELLE_CURVE_MODE).toBe('bezier')
    expect(isAquarelleCurveMode('bezier')).toBe(true)
    expect(isAquarelleCurveMode('spline')).toBe(true)
    expect(isAquarelleCurveMode('linear')).toBe(false)
    expect(isAquarelleCurveMode('watercolor')).toBe(false)
    expect(isAquarelleCurveMode(undefined)).toBe(false)
    expect(isAquarelleCurveMode(null)).toBe(false)
    expect(isAquarelleCurveMode(1)).toBe(false)
    expect(isAquarelleCurveMode({ mode: 'spline' })).toBe(false)
  })

  it('resolves an absent mode and bezier to bezier, and passes spline through', () => {
    expect(resolveAquarelleCurveMode(undefined)).toBe('bezier')
    expect(resolveAquarelleCurveMode('bezier')).toBe('bezier')
    expect(resolveAquarelleCurveMode('spline')).toBe('spline')
  })

  it('resolves any unknown value to bezier', () => {
    expect(resolveAquarelleCurveMode('linear')).toBe('bezier')
    expect(resolveAquarelleCurveMode('simple-ribbon')).toBe('bezier')
    expect(resolveAquarelleCurveMode(null)).toBe('bezier')
    expect(resolveAquarelleCurveMode(3)).toBe('bezier')
    expect(resolveAquarelleCurveMode({ curveMode: 'spline' })).toBe('bezier')
  })

  it('recordedCurveModeField writes nothing for the default and one key otherwise', () => {
    expect(recordedCurveModeField('bezier')).toEqual({})
    expect(Object.keys(recordedCurveModeField('bezier'))).toHaveLength(0)
    expect(recordedCurveModeField('spline')).toEqual({ curveMode: 'spline' })
  })
})

// ---------------------------------------------------------------------------
// 2c. Curve evaluation (G-20: spline is a VIEW over the same anchor list —
//     the authored kinds and handles stay in the document, untouched)
// ---------------------------------------------------------------------------

describe('curve evaluation (G-20: spline is a view, never a rewrite)', () => {
  const STORED: readonly AquarelleAnchor[] = [
    { x: 0.2, y: 0.5, kind: 'bezier', in: { x: 0.1, y: 0.4 }, out: { x: 0.3, y: 0.6 } },
    { x: 0.5, y: 0.5, kind: 'auto', width: 1.8 },
    // A placed corner: both handles sit ON the anchor.
    { x: 0.8, y: 0.5, kind: 'bezier', in: { x: 0.8, y: 0.5 }, out: { x: 0.8, y: 0.5 } },
  ]

  /** The derived view, written out here so the test never asks the code under test. */
  const SPLINE_VIEW: readonly AquarelleAnchor[] = [
    { x: 0.2, y: 0.5, kind: 'auto' },
    { x: 0.5, y: 0.5, kind: 'auto', width: 1.8 },
    { x: 0.8, y: 0.5, kind: 'bezier', in: { x: 0.8, y: 0.5 }, out: { x: 0.8, y: 0.5 } },
  ]

  it('resolveCurveAnchors returns the input list as-is for bezier', () => {
    expect(resolveCurveAnchors(STORED, 'bezier')).toBe(STORED)
  })

  it('resolveCurveAnchors smooths curves but keeps a placed corner', () => {
    const view = resolveCurveAnchors(STORED, 'spline')
    expect(view).not.toBe(STORED)
    expect(view).toEqual(SPLINE_VIEW)
    expect(Object.isFrozen(view)).toBe(true)
    // The authored curve control is smoothed away…
    expect(view[0]!.kind).toBe('auto')
    expect('in' in view[0]!).toBe(false)
    expect('out' in view[0]!).toBe(false)
    // …and the corner keeps its kind and its on-anchor handles.
    expect(view[2]!.kind).toBe('bezier')
    expect(view[2]!.in).toEqual({ x: 0.8, y: 0.5 })
    expect(view[2]!.out).toEqual({ x: 0.8, y: 0.5 })
    // The width factor is a paint property, not an evaluation one.
    expect(view[1]!.width).toBe(1.8)
    // The DOCUMENT keeps the authored handles — a view is never a write-back.
    expect(STORED[0]).toEqual({
      x: 0.2,
      y: 0.5,
      kind: 'bezier',
      in: { x: 0.1, y: 0.4 },
      out: { x: 0.3, y: 0.6 },
    })
  })

  it('resolveCurveAnchors preserves an explicit colour on the derived view and on a placed corner', () => {
    const stored: readonly AquarelleAnchor[] = [
      { x: 0.2, y: 0.5, kind: 'bezier', in: { x: 0.1, y: 0.4 }, out: { x: 0.3, y: 0.6 }, color: '#ff0000' },
      { x: 0.8, y: 0.5, kind: 'bezier', in: { x: 0.8, y: 0.5 }, out: { x: 0.8, y: 0.5 }, color: '#00ff00', width: 1.6 },
    ]
    const view = resolveCurveAnchors(stored, 'spline')
    expect(view[0]!.color).toBe('#ff0000')
    expect(view[1]!.color).toBe('#00ff00')
    expect(view[1]!.width).toBe(1.6)
  })

  it('resolveCurveAnchors never mutates or aliases the input when deriving the spline view', () => {
    const stored: AquarelleAnchor[] = STORED.map((anchor) => ({ ...anchor }))
    const snapshot = JSON.parse(JSON.stringify(stored)) as readonly AquarelleAnchor[]
    const view = resolveCurveAnchors(stored, 'spline')
    expect(view).not.toBe(stored)
    expect(view[0]).not.toBe(stored[0])
    expect(view[2]).not.toBe(stored[2])
    expect(stored).toEqual(snapshot)
  })

  it('evaluateAquarellePath samples the mode evaluation view and the two modes differ', () => {
    const bezier = evaluateAquarellePath(STORED, 'bezier')
    const spline = evaluateAquarellePath(STORED, 'spline')
    expect(bezier).toEqual(sampleVectorPath(STORED))
    // An authored handle has no effect under spline: the sampled spine is
    // exactly the one over the derived-auto view.
    expect(spline).toEqual(sampleVectorPath(SPLINE_VIEW))
    // Non-degenerate: smoothing the first anchor really does draw another curve.
    expect(spline.points).not.toEqual(bezier.points)
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
      normaliseAquarelleAnchors([{ x: 20, y: 32, kind: 'auto', width: ANCHOR_WIDTH_MAX + 1 }]),
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

  it('keeps an explicit anchor colour and canonicalises a non-canonical one', () => {
    const normalised = normaliseAquarelleAnchors([
      { x: 20, y: 32, kind: 'auto', color: '#FF0000' },
    ])
    expect(normalised).toEqual([{ x: 20, y: 32, kind: 'auto', color: '#ff0000' }])
    expect(normalised![0]!.color).toBe('#ff0000')
  })

  it('refuses the WHOLE list for a malformed colour', () => {
    expect(
      normaliseAquarelleAnchors([
        { x: 20, y: 32, kind: 'auto' },
        { x: 30, y: 32, kind: 'auto', color: '#xyz' },
      ]),
    ).toBeUndefined()
    expect(normaliseAquarelleAnchors([{ x: 20, y: 32, kind: 'auto', color: 42 }])).toBeUndefined()
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

  it('vectorPathsEqual compares the anchors and nothing else', () => {
    expect(vectorPathsEqual({ anchors: TWO_ANCHORS }, { anchors: TWO_ANCHORS })).toBe(true)
    expect(vectorPathsEqual({}, { anchors: [] })).toBe(true)
    expect(
      vectorPathsEqual({ anchors: TWO_ANCHORS }, { anchors: [TWO_ANCHORS[0]!] }),
    ).toBe(false)
  })

  it('anchorsEqual compares the explicit colour and treats both-absent as equal', () => {
    const plain: readonly AquarelleAnchor[] = [{ x: 10, y: 10, kind: 'auto' }]
    expect(anchorsEqual(plain, [{ x: 10, y: 10, kind: 'auto' }])).toBe(true)
    expect(anchorsEqual(plain, [{ x: 10, y: 10, kind: 'auto', color: '#ff0000' }])).toBe(false)
    expect(
      anchorsEqual(
        [{ x: 10, y: 10, kind: 'auto', color: '#ff0000' }],
        [{ x: 10, y: 10, kind: 'auto', color: '#00ff00' }],
      ),
    ).toBe(false)
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

  it('keeps an explicit colour even at the default width and writes no colour key otherwise', () => {
    const projected = projectVectorPath([
      { x: 0, y: 0, kind: 'auto' },
      { x: 10, y: 0, kind: 'auto', color: '#103c65' },
      { x: 20, y: 0, kind: 'auto', width: ANCHOR_WIDTH_DEFAULT, color: '#ff0000' },
    ])
    expect('color' in projected[0]!).toBe(false)
    expect(projected[1]!.color).toBe('#103c65')
    expect(projected[2]!.color).toBe('#ff0000')
    expect('width' in projected[2]!).toBe(false)
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
// 6. A legacy renderMode key is inert data (no mode exists any more)
// ---------------------------------------------------------------------------

describe('legacy renderMode key', () => {
  it('survives a JSON round trip as an ignored extra field', () => {
    const path = { anchors: TWO_ANCHORS, renderMode: 'simple-ribbon' as const }
    const round = JSON.parse(JSON.stringify(path)) as {
      anchors: readonly AquarelleAnchor[]
      renderMode: unknown
    }
    expect(anchorsEqual(round.anchors, TWO_ANCHORS)).toBe(true)
    expect(round.renderMode).toBe('simple-ribbon')
    expect(isVectorStroke(round)).toBe(true)
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

  it('carries no per-anchor brush identity, and colour is the one paint member (VEC-04 revised)', () => {
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
    // 261111-wd6 revises VEC-04: a vertex may carry its own explicit colour.
    expect(/\bcolor\?:\s*string\b/.test(anchorRegion)).toBe(true)
  })
})
