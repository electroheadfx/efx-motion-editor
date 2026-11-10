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
// ============================================================

import { describe, expect, it } from 'vitest'
import {
  PATH_SAMPLE_STEP_UV,
  normaliseVectorAnchors,
  pathLength,
  resolveAnchorHandles,
  sampleVectorPath,
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
