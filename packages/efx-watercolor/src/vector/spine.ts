// ============================================================
//  spine.ts — the ONE vector spine: anchors → evaluated path.
//
//  REUSE CONTRACT: the payload (61-03), the adapter (61-04) and
//  the handle overlay (61-09) all index into THIS module. Do not
//  re-derive the handle law, the station list or the width law
//  anywhere else — a second copy is a second curve.
//
//  Three laws this module owns:
//    1. DERIVED HANDLES. An `auto` anchor stores no handles; both
//       are recomputed from its neighbours on every evaluation, so
//       moving an anchor moves the neighbouring tangents with it
//       and nothing can drift out of sync. A `bezier` anchor keeps
//       the handles it was authored with.
//    2. ARC-LENGTH STATIONS. The sampled station list is the single
//       ordering authority. Every consumer (width law, overlay,
//       adapter) indexes this list; no second station definition.
//    3. SPARSE WIDTH. An anchor carries a width factor only once it
//       is edited (D-10); absent reads ANCHOR_WIDTH_DEFAULT, and a
//       uniform profile stores nothing. The factor is a multiplier
//       of the brush size (D-09), never a pixel radius, and nothing
//       here clamps it below its published 0.2..2.0 range.
//
//  PURITY: no imports, no Preact, no signals, no DOM, no engine, no
//  unseeded RNG, and no pixel / zoom / viewport term. Coordinates
//  are document uv — this module knows nothing about the canvas.
// ============================================================

/** A point in document uv space. */
export interface Vec2 {
  readonly x: number
  readonly y: number
}

/**
 * D-01: exactly two anchor kinds — a smooth anchor whose handles are
 * derived, and a Bézier anchor carrying its own coupled handles.
 */
export type VectorAnchorKind = 'auto' | 'bezier'

/** One editable point on a vector stroke, in document uv. */
export interface VectorAnchor {
  readonly x: number
  readonly y: number
  readonly kind: VectorAnchorKind
  /** Absolute document-uv endpoint of the incoming handle (`bezier` anchors). */
  readonly in?: Vec2
  /** Absolute document-uv endpoint of the outgoing handle (`bezier` anchors). */
  readonly out?: Vec2
  /** Width multiplier of the stroke's brush size (D-09). Absent reads 1. */
  readonly width?: number
}

/** The handles actually used for one anchor on this evaluation. */
export interface ResolvedAnchorHandles {
  readonly in: Vec2
  readonly out: Vec2
}

/** The evaluated spine: one point per sample plus its arc-length station. */
export interface SampledVectorPath {
  readonly points: readonly Vec2[]
  readonly stations: readonly number[]
}

/**
 * Knot exponent of the auto-smooth family — 0.5 is centripetal (Q11).
 * Exported so the overlay and the later plans name the family from here
 * instead of carrying a literal.
 */
export const AUTO_SMOOTH_ALPHA = 0.5

/** Published lower bound of a vertex width multiplier. */
export const ANCHOR_WIDTH_MIN = 0.2

/** Published upper bound of a vertex width multiplier. */
export const ANCHOR_WIDTH_MAX = 2

/** The width of an anchor that was never edited (D-10: absent reads 1). */
export const ANCHOR_WIDTH_DEFAULT = 1

/** Maximum arc-length distance between two consecutive spine samples, in uv. */
export const PATH_SAMPLE_STEP_UV = 0.002

function isFinitePoint(point: Vec2 | undefined): point is Vec2 {
  return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y)
}

function distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Duplicate fallback: drop non-finite anchors and any anchor sitting exactly
 * on the immediately preceding kept anchor. Centripetal tangents divide by the
 * neighbour distance, so a duplicated point must never reach the evaluator.
 * Input order is preserved — the list order IS the path order.
 */
export function normaliseVectorAnchors(anchors: readonly VectorAnchor[]): readonly VectorAnchor[] {
  const kept: VectorAnchor[] = []
  for (const anchor of anchors) {
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) continue
    const previous = kept[kept.length - 1]
    if (previous !== undefined && previous.x === anchor.x && previous.y === anchor.y) continue
    kept.push(anchor)
  }
  return kept
}

function handlesFor(anchors: readonly VectorAnchor[], index: number): ResolvedAnchorHandles {
  const anchor = anchors[index]!
  if (anchor.kind === 'bezier' && isFinitePoint(anchor.in) && isFinitePoint(anchor.out)) {
    return { in: { x: anchor.in.x, y: anchor.in.y }, out: { x: anchor.out.x, y: anchor.out.y } }
  }
  const last = anchors.length - 1
  if (last === 0) {
    const point = { x: anchor.x, y: anchor.y }
    return { in: { ...point }, out: { ...point } }
  }
  // Endpoints take the one-sided tangent (P1 - P0) / 3; interior anchors take
  // the two-sided (P_next - P_prev) / 6 of the auto-smooth family. Both handles
  // are written as ONE division ((n·P -+ delta) / n) instead of P -+ delta/n:
  // the exact handles are rationals (e.g. 4/6), and the single rounding is what
  // pins the golden literals and keeps hydrate re-derivation bit-identical.
  const scale = index === 0 || index === last ? 3 : 6
  const before = anchors[Math.max(0, index - 1)]!
  const after = anchors[Math.min(last, index + 1)]!
  const dx = after.x - before.x
  const dy = after.y - before.y
  return {
    in: { x: (scale * anchor.x - dx) / scale, y: (scale * anchor.y - dy) / scale },
    out: { x: (scale * anchor.x + dx) / scale, y: (scale * anchor.y + dy) / scale },
  }
}

/**
 * The handles every anchor draws with on this evaluation. Derived handles are
 * never stored on an `auto` anchor and the input list is never mutated.
 * Neighbours are read from the normalised list, so a duplicate cannot shift
 * the remaining tangents.
 */
export function resolveAnchorHandles(
  anchors: readonly VectorAnchor[],
): readonly ResolvedAnchorHandles[] {
  const normalised = normaliseVectorAnchors(anchors)
  const resolved: ResolvedAnchorHandles[] = []
  for (let index = 0; index < normalised.length; index++) resolved.push(handlesFor(normalised, index))
  return resolved
}

function cubicPointAt(start: Vec2, controlA: Vec2, controlB: Vec2, end: Vec2, t: number): Vec2 {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * start.x + b * controlA.x + c * controlB.x + d * end.x,
    y: a * start.y + b * controlA.y + c * controlB.y + d * end.y,
  }
}

interface PathWalk extends SampledVectorPath {
  /** Arc-length station at which each normalised anchor is reached. */
  readonly anchorStations: readonly number[]
}

/**
 * The one walk every consumer indexes. Emits the first anchor, then the
 * interior samples of each segment (no wider than PATH_SAMPLE_STEP_UV along
 * the chord estimate) and the segment's end anchor, accumulating straight-line
 * arc length into a strictly increasing station list. A segment whose endpoint
 * coincides with the last emitted point contributes no zero-length sample.
 */
function walkPath(anchors: readonly VectorAnchor[]): PathWalk {
  const points: Vec2[] = []
  const stations: number[] = []
  const anchorStations: number[] = []
  if (anchors.length === 0) return { points, stations, anchorStations }

  const handles = anchors.map((_, index) => handlesFor(anchors, index))
  let total = 0
  let cursor: Vec2 = { x: anchors[0]!.x, y: anchors[0]!.y }
  points.push(cursor)
  stations.push(0)
  anchorStations.push(0)

  for (let index = 0; index < anchors.length - 1; index++) {
    const start = anchors[index]!
    const end = anchors[index + 1]!
    const controlA = handles[index]!.out
    const controlB = handles[index + 1]!.in
    const chord = distance(start, end)
    const steps = Math.max(1, Math.ceil(chord / PATH_SAMPLE_STEP_UV))
    for (let step = 1; step < steps; step++) {
      const sample = cubicPointAt(start, controlA, controlB, end, step / steps)
      const advance = distance(cursor, sample)
      if (advance <= 0) continue
      total += advance
      points.push(sample)
      stations.push(total)
      cursor = sample
    }
    const advance = distance(cursor, end)
    if (advance > 0) {
      total += advance
      cursor = { x: end.x, y: end.y }
      points.push(cursor)
      stations.push(total)
    }
    anchorStations.push(total)
  }

  return { points, stations, anchorStations }
}

/**
 * Evaluate the anchor list into a spine polyline. The returned stations are
 * strictly increasing and indexed one-to-one with the points; they are the
 * only arc-length authority in the package.
 */
export function sampleVectorPath(anchors: readonly VectorAnchor[]): SampledVectorPath {
  const { points, stations } = walkPath(normaliseVectorAnchors(anchors))
  return { points, stations }
}

/** Total arc length of the evaluated spine; 0 for fewer than two anchors. */
export function pathLength(anchors: readonly VectorAnchor[]): number {
  const { stations } = walkPath(normaliseVectorAnchors(anchors))
  return stations.length === 0 ? 0 : stations[stations.length - 1]!
}
