// @vitest-environment node
// ============================================================
//  spine.test.ts — the vector spine's golden pins (61-02).
//
//  The handle law, the arc-length station ordering and the sparse
//  width law are the contract every later plan indexes into, so the
//  numbers here are asserted as literals rather than described.
//
//  Sections:
//    1. auto-handle goldens (middle / first / last anchor)
//    2. bezier anchors round-trip their stored handles
//    3. the sampled path: collinear, monotone stations
//    4. duplicate / single / empty fallbacks
//    5. the sparse width law
//    6. the per-vertex colour law (261111-wd6)
//    7. determinism scan coverage
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ANCHOR_WIDTH_DEFAULT,
  ANCHOR_WIDTH_MAX,
  ANCHOR_WIDTH_MIN,
  PATH_SAMPLE_STEP_UV,
  anchorWidthAt,
  clampAnchorWidth,
  isUniformColorProfile,
  isUniformWidthProfile,
  normaliseAnchorColor,
  normaliseVectorAnchors,
  pathLength,
  resolveAnchorHandles,
  sampleVectorColors,
  sampleVectorPath,
  sampleVectorWidths,
  type VectorAnchor,
} from './spine'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COLLINEAR: ReadonlyArray<VectorAnchor> = Object.freeze([
  { x: 0, y: 0, kind: 'auto' },
  { x: 1, y: 0, kind: 'auto' },
  { x: 2, y: 0, kind: 'auto' },
] as const)

function anchors(points: ReadonlyArray<readonly [number, number]>): VectorAnchor[] {
  return points.map(([x, y]) => ({ x, y, kind: 'auto' as const }))
}

function hasNaN(path: { points: ReadonlyArray<{ x: number; y: number }>; stations: ReadonlyArray<number> }): boolean {
  return (
    path.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
    path.stations.some((s) => !Number.isFinite(s))
  )
}

// ---------------------------------------------------------------------------
// 1. Auto-handle goldens
// ---------------------------------------------------------------------------

describe('resolveAnchorHandles — the auto-smooth law', () => {
  it('derives the middle anchor handles from its neighbours: P +- (P_next - P_prev) / 6', () => {
    const handles = resolveAnchorHandles(COLLINEAR)
    expect(handles).toHaveLength(3)
    expect(handles[1]!.out).toEqual({ x: 1.3333333333333333, y: 0 })
    expect(handles[1]!.in).toEqual({ x: 0.6666666666666666, y: 0 })
  })

  it('gives the endpoints a one-sided tangent: P0 + (P1 - P0) / 3 and its mirror', () => {
    const handles = resolveAnchorHandles(COLLINEAR)
    expect(handles[0]!.out).toEqual({ x: 0.3333333333333333, y: 0 })
    expect(handles[0]!.in).toEqual({ x: -0.3333333333333333, y: 0 })
    expect(handles[2]!.in).toEqual({ x: 1.6666666666666667, y: 0 })
    expect(handles[2]!.out).toEqual({ x: 2.3333333333333335, y: 0 })
  })

  it('returns both handles at the anchor for a single-anchor list', () => {
    const [handles] = resolveAnchorHandles([{ x: 0.25, y: 0.5, kind: 'auto' }])
    expect(handles!.in).toEqual({ x: 0.25, y: 0.5 })
    expect(handles!.out).toEqual({ x: 0.25, y: 0.5 })
  })

  it('does not mutate the anchors it reads', () => {
    const input = anchors([
      [0, 0],
      [1, 0],
      [2, 0],
    ])
    const snapshot = JSON.stringify(input)
    resolveAnchorHandles(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

// ---------------------------------------------------------------------------
// 2. Bezier anchors round-trip their stored handles
// ---------------------------------------------------------------------------

describe('resolveAnchorHandles — bezier anchors', () => {
  it('returns the stored handles unchanged', () => {
    const path: VectorAnchor[] = [
      { x: 0, y: 0, kind: 'bezier', in: { x: -0.2, y: -0.1 }, out: { x: 0.3, y: 0.4 } },
      { x: 1, y: 0, kind: 'bezier', in: { x: 0.7, y: 0.1 }, out: { x: 1.2, y: -0.2 } },
    ]
    const handles = resolveAnchorHandles(path)
    expect(handles[0]).toEqual({ in: { x: -0.2, y: -0.1 }, out: { x: 0.3, y: 0.4 } })
    expect(handles[1]).toEqual({ in: { x: 0.7, y: 0.1 }, out: { x: 1.2, y: -0.2 } })
  })

  it('keeps zero-length corner handles as zero-length — no auto promotion', () => {
    const path: VectorAnchor[] = [
      { x: 0, y: 0, kind: 'bezier', in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
      { x: 1, y: 0, kind: 'bezier', in: { x: 1, y: 0 }, out: { x: 1, y: 0 } },
    ]
    const handles = resolveAnchorHandles(path)
    expect(handles[0]).toEqual({ in: { x: 0, y: 0 }, out: { x: 0, y: 0 } })
    expect(handles[1]).toEqual({ in: { x: 1, y: 0 }, out: { x: 1, y: 0 } })
  })

  it('falls back to the auto law when the stored handles are missing or non-finite', () => {
    const path: VectorAnchor[] = [
      { x: 0, y: 0, kind: 'auto' },
      { x: 1, y: 0, kind: 'bezier' },
      { x: 2, y: 0, kind: 'bezier', in: { x: Number.NaN, y: 0 }, out: { x: 2, y: 0 } },
    ]
    const handles = resolveAnchorHandles(path)
    expect(handles[1]!.out).toEqual({ x: 1.3333333333333333, y: 0 })
    expect(handles[2]!.in).toEqual({ x: 1.6666666666666667, y: 0 })
  })
})

// ---------------------------------------------------------------------------
// 3. The sampled path — arc-length stations are the ordering authority
// ---------------------------------------------------------------------------

describe('sampleVectorPath', () => {
  it('keeps a collinear path on its line with strictly increasing x', () => {
    const path = sampleVectorPath(COLLINEAR)
    expect(path.points.length).toBeGreaterThan(3)
    let previousX = Number.NEGATIVE_INFINITY
    for (const point of path.points) {
      expect(Math.abs(point.y)).toBeLessThan(1e-12)
      expect(point.x).toBeGreaterThan(previousX)
      previousX = point.x
    }
    expect(path.points[0]).toEqual({ x: 0, y: 0 })
    expect(path.points[path.points.length - 1]).toEqual({ x: 2, y: 0 })
  })

  it('reports strictly increasing stations whose last entry is pathLength', () => {
    const path = sampleVectorPath(COLLINEAR)
    expect(path.stations).toHaveLength(path.points.length)
    expect(path.stations[0]).toBe(0)
    for (let i = 1; i < path.stations.length; i++) {
      expect(path.stations[i]!).toBeGreaterThan(path.stations[i - 1]!)
    }
    expect(path.stations[path.stations.length - 1]).toBe(pathLength(COLLINEAR))
  })

  it('pins the first and last anchor at their emitted stations', () => {
    const path = sampleVectorPath(COLLINEAR)
    expect(path.points[0]).toEqual({ x: 0, y: 0 })
    expect(path.stations[0]).toBe(0)
    expect(path.points[path.points.length - 1]).toEqual({ x: 2, y: 0 })
    expect(pathLength(COLLINEAR)).toBeGreaterThan(0)
  })

  it('samples no wider than PATH_SAMPLE_STEP_UV between consecutive points', () => {
    const path = sampleVectorPath(COLLINEAR)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1]!
      const b = path.points[i]!
      const step = Math.hypot(b.x - a.x, b.y - a.y)
      expect(step).toBeLessThanOrEqual(PATH_SAMPLE_STEP_UV + 1e-12)
    }
  })
})

// ---------------------------------------------------------------------------
// 4. Duplicate / single / empty fallbacks
// ---------------------------------------------------------------------------

describe('degenerate anchor lists', () => {
  it('drops a duplicated position before evaluating', () => {
    const duplicated = anchors([
      [1, 0],
      [1, 0],
      [2, 0],
    ])
    const normalised = normaliseVectorAnchors(duplicated)
    expect(normalised).toHaveLength(2)
    expect(normalised.map((a) => a.x)).toEqual([1, 2])
  })

  it('evaluates a duplicated list without NaN and without a zero-length segment', () => {
    const path = sampleVectorPath(
      anchors([
        [1, 0],
        [1, 0],
        [2, 0],
      ]),
    )
    expect(hasNaN(path)).toBe(false)
    expect(path.points.length).toBeGreaterThan(1)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1]!
      const b = path.points[i]!
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0)
    }
  })

  it('reads neighbours from the normalised list so a duplicate cannot shift the handles', () => {
    const withDuplicate = resolveAnchorHandles(
      anchors([
        [0, 0],
        [1, 0],
        [1, 0],
        [2, 0],
      ]),
    )
    const clean = resolveAnchorHandles(COLLINEAR)
    expect(withDuplicate).toEqual(clean)
  })

  it('samples a single anchor to exactly one point and zero length', () => {
    const single = anchors([[0.25, 0.5]])
    const path = sampleVectorPath(single)
    expect(path.points).toEqual([{ x: 0.25, y: 0.5 }])
    expect(path.stations).toEqual([0])
    expect(pathLength(single)).toBe(0)
  })

  it('samples an empty list to zero points and never throws', () => {
    const path = sampleVectorPath([])
    expect(path.points).toEqual([])
    expect(path.stations).toEqual([])
    expect(pathLength([])).toBe(0)
  })

  it('drops non-finite anchors', () => {
    const normalised = normaliseVectorAnchors([
      { x: Number.NaN, y: 0, kind: 'auto' },
      { x: 0, y: 0, kind: 'auto' },
      { x: 1, y: Number.POSITIVE_INFINITY, kind: 'auto' },
      { x: 2, y: 0, kind: 'auto' },
    ])
    expect(normalised.map((a) => a.x)).toEqual([0, 2])
  })
})

// ---------------------------------------------------------------------------
// 5. The sparse width law — absent reads 1, interpolation is linear on arc length
// ---------------------------------------------------------------------------

function widened(
  points: ReadonlyArray<readonly [number, number]>,
  widths: ReadonlyArray<number | undefined>,
): VectorAnchor[] {
  return points.map(([x, y], index) => {
    const width = widths[index]
    return width === undefined ? { x, y, kind: 'auto' as const } : { x, y, kind: 'auto' as const, width }
  })
}

const MID_18 = widened(
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [undefined, 1.8, undefined],
)

describe('clampAnchorWidth', () => {
  it('guards the published 0.2..2.0 range and defaults non-finite input', () => {
    expect(clampAnchorWidth(0.1)).toBe(ANCHOR_WIDTH_MIN)
    expect(clampAnchorWidth(0.1)).toBe(0.2)
    expect(clampAnchorWidth(3)).toBe(ANCHOR_WIDTH_MAX)
    expect(clampAnchorWidth(3)).toBe(2)
    expect(clampAnchorWidth(1.8)).toBe(1.8)
    expect(clampAnchorWidth(Number.NaN)).toBe(ANCHOR_WIDTH_DEFAULT)
    expect(clampAnchorWidth(Number.NaN)).toBe(1)
  })

  it('never lowers a factor that is already inside the range', () => {
    for (const factor of [0.2, 0.5, 1, 1.4, 1.8, 2]) {
      expect(clampAnchorWidth(factor)).toBe(factor)
    }
  })
})

describe('isUniformWidthProfile', () => {
  it('reports a list with no factor at all as uniform', () => {
    expect(isUniformWidthProfile(COLLINEAR)).toBe(true)
    expect(isUniformWidthProfile(widened([[0, 0], [1, 0]], [undefined, undefined]))).toBe(true)
  })

  it('reports a list where every factor is exactly 1 as uniform', () => {
    expect(isUniformWidthProfile(widened([[0, 0], [1, 0]], [1, 1]))).toBe(true)
  })

  it('reports a single edited anchor as non-uniform', () => {
    expect(isUniformWidthProfile(MID_18)).toBe(false)
  })
})

describe('anchorWidthAt', () => {
  const length = pathLength(MID_18)

  it('reads 1 where no factor is set and the edited factor at its anchor station', () => {
    expect(length).toBe(2)
    expect(anchorWidthAt(MID_18, 0)).toBe(1)
    expect(anchorWidthAt(MID_18, length / 2)).toBe(1.8)
    expect(anchorWidthAt(MID_18, length)).toBe(1)
  })

  it('interpolates linearly on arc length between the two bracketing anchors', () => {
    expect(anchorWidthAt(MID_18, length / 4)).toBe(1.4)
  })

  it('holds the nearest factor before the first and after the last station', () => {
    const trailing = widened(
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [undefined, undefined, 1.6],
    )
    const total = pathLength(trailing)
    expect(anchorWidthAt(trailing, 0)).toBe(1)
    expect(anchorWidthAt(trailing, total)).toBe(1.6)
    expect(anchorWidthAt(trailing, total + 5)).toBe(1.6)
    expect(anchorWidthAt(trailing, -5)).toBe(1)
  })

  it('returns the default for a list without anchors and 1 for a single anchor', () => {
    expect(anchorWidthAt([], 0.5)).toBe(ANCHOR_WIDTH_DEFAULT)
    expect(anchorWidthAt([{ x: 0.25, y: 0.5, kind: 'auto' }], 0)).toBe(1)
  })
})

describe('sampleVectorWidths', () => {
  it('returns one factor per point, all inside the published range', () => {
    const path = sampleVectorPath(MID_18)
    const widths = sampleVectorWidths(MID_18, path.points)
    expect(widths).toHaveLength(path.points.length)
    for (const width of widths) {
      expect(Number.isFinite(width)).toBe(true)
      expect(width).toBeGreaterThanOrEqual(ANCHOR_WIDTH_MIN)
      expect(width).toBeLessThanOrEqual(ANCHOR_WIDTH_MAX)
    }
  })

  it('rises to the edited factor then falls back — non-decreasing then non-increasing', () => {
    const path = sampleVectorPath(MID_18)
    const widths = sampleVectorWidths(MID_18, path.points)
    let peak = 0
    for (let i = 1; i < widths.length; i++) if (widths[i]! > widths[peak]!) peak = i
    for (let i = 1; i <= peak; i++) expect(widths[i]!).toBeGreaterThanOrEqual(widths[i - 1]!)
    for (let i = peak + 1; i < widths.length; i++) expect(widths[i]!).toBeLessThanOrEqual(widths[i - 1]!)
    expect(widths[0]).toBe(1)
    expect(widths[widths.length - 1]).toBe(1)
  })

  it('carries a 1.8 factor through untouched — nothing clamps it to 1', () => {
    const path = sampleVectorPath(MID_18)
    const widths = sampleVectorWidths(MID_18, path.points)
    expect(Math.max(...widths)).toBeCloseTo(1.8, 12)
  })

  it('returns exactly 1 for every point of a uniform profile', () => {
    const path = sampleVectorPath(COLLINEAR)
    const widths = sampleVectorWidths(COLLINEAR, path.points)
    expect(widths).toEqual(path.points.map(() => 1))
  })

  it('reads the final factor for points at or beyond the end of the spine', () => {
    const trailing = widened(
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [undefined, undefined, 1.6],
    )
    const widths = sampleVectorWidths(trailing, [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 9, y: 9 },
    ])
    expect(widths[0]).toBe(1)
    expect(widths[1]).toBeCloseTo(1.6, 12)
    expect(widths[2]).toBeCloseTo(1.6, 12)
  })
})

// ---------------------------------------------------------------------------
// 6. The per-vertex colour law (261111-wd6) — explicit, sparse, canonical
// ---------------------------------------------------------------------------

/** The MID_18 shape with an explicit colour on the middle anchor instead. */
const MID_RED: readonly VectorAnchor[] = [
  { x: 0, y: 0, kind: 'auto' },
  { x: 1, y: 0, kind: 'auto', color: '#ff0000' },
  { x: 2, y: 0, kind: 'auto' },
]

describe('normaliseAnchorColor', () => {
  it('canonicalises 3, 6 and 8 digit hex to lowercase #rrggbb', () => {
    expect(normaliseAnchorColor('#ABC')).toBe('#aabbcc')
    expect(normaliseAnchorColor('abc')).toBe('#aabbcc')
    expect(normaliseAnchorColor('#AABBCC')).toBe('#aabbcc')
    expect(normaliseAnchorColor('#aabbccdd')).toBe('#aabbcc')
  })

  it('returns undefined for anything that is not a 3/6/8 digit hex colour', () => {
    expect(normaliseAnchorColor('#abcd')).toBeUndefined()
    expect(normaliseAnchorColor('#xyz')).toBeUndefined()
    expect(normaliseAnchorColor('')).toBeUndefined()
    expect(normaliseAnchorColor(42)).toBeUndefined()
    expect(normaliseAnchorColor(null)).toBeUndefined()
    expect(normaliseAnchorColor(undefined)).toBeUndefined()
  })
})

describe('isUniformColorProfile', () => {
  it('reports a list with no colour at all as uniform', () => {
    expect(isUniformColorProfile(COLLINEAR)).toBe(true)
    expect(isUniformColorProfile(MID_18)).toBe(true)
  })

  it('reports one explicitly coloured anchor as non-uniform', () => {
    expect(isUniformColorProfile(MID_RED)).toBe(false)
  })
})

describe('sampleVectorColors', () => {
  const BASE = '#103c65'

  it('returns one canonical colour per point with the endpoints held on the base', () => {
    const path = sampleVectorPath(MID_RED)
    const colors = sampleVectorColors(MID_RED, path.points, BASE)
    expect(colors).toHaveLength(path.points.length)
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
      // Every entry round-trips through the package normaliser unchanged.
      expect(normaliseAnchorColor(color)).toBe(color)
    }
    expect(colors[0]).toBe(BASE)
    expect(colors[colors.length - 1]).toBe(BASE)
  })

  it('reaches the coloured anchor exactly and rises then falls on the way', () => {
    const path = sampleVectorPath(MID_RED)
    const colors = sampleVectorColors(MID_RED, path.points, BASE)
    const red = colors.map((color) => Number.parseInt(color.slice(1, 3), 16))
    let peak = 0
    for (let index = 1; index < red.length; index++) if (red[index]! > red[peak]!) peak = index
    for (let index = 1; index <= peak; index++) expect(red[index]!).toBeGreaterThanOrEqual(red[index - 1]!)
    for (let index = peak + 1; index < red.length; index++) expect(red[index]!).toBeLessThanOrEqual(red[index - 1]!)
    expect(colors[peak]).toBe('#ff0000')
  })

  it('is deterministic: two calls over the same inputs are deep-equal', () => {
    const path = sampleVectorPath(MID_RED)
    expect(sampleVectorColors(MID_RED, path.points, BASE)).toEqual(
      sampleVectorColors(MID_RED, path.points, BASE),
    )
  })

  it('reads the normalised base for a uniform profile and for a point grid with no anchors', () => {
    const path = sampleVectorPath(COLLINEAR)
    expect(sampleVectorColors(COLLINEAR, path.points, '#ABC')).toEqual(
      path.points.map(() => '#aabbcc'),
    )
    expect(sampleVectorColors([], [{ x: 0, y: 0 }], BASE)).toEqual([BASE])
    expect(sampleVectorColors(COLLINEAR, [], BASE)).toEqual([])
  })

  it('returns one entry for a one-point grid', () => {
    expect(sampleVectorColors(MID_RED, [{ x: 1, y: 0 }], BASE)).toEqual(['#ff0000'])
  })

  it('falls back to the base for a malformed authored colour, never throws', () => {
    const malformed: VectorAnchor[] = [
      { x: 0, y: 0, kind: 'auto' },
      { x: 1, y: 0, kind: 'auto', color: '#xyz' },
      { x: 2, y: 0, kind: 'auto' },
    ]
    expect(isUniformColorProfile(malformed)).toBe(false)
    const path = sampleVectorPath(malformed)
    expect(sampleVectorColors(malformed, path.points, BASE)).toEqual(path.points.map(() => BASE))
  })
})

// ---------------------------------------------------------------------------
// 7. Determinism scan coverage — the contract reads src/vector (T-61-07)
// ---------------------------------------------------------------------------

describe('determinism scan coverage', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const moduleSource = readFileSync(join(here, 'spine.ts'), 'utf8')
  const contractSource = readFileSync(join(here, '..', 'determinismContract.test.ts'), 'utf8')

  it('the spine module carries no unseeded RNG source', () => {
    expect(moduleSource.includes('Math.random')).toBe(false)
    expect(moduleSource.includes('crypto.getRandomValues')).toBe(false)
  })

  it('the determinism contract declares src/vector as a scanned root', () => {
    expect(contractSource.includes('VECTOR_DIR')).toBe(true)
    expect(contractSource.includes("'vector'")).toBe(true)
    expect(contractSource.includes('sourceText(VECTOR_DIR)')).toBe(true)
  })
})
