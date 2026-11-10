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

/**
 * Guard the published 0.2..2.0 range (D-09). This clamp exists ONLY to bound
 * the range; it must never lower a factor that is already inside it — C-03
 * forbids the upper bound at 1.0 that `Engine.ts:844` applies to `scriptScale`,
 * which is why the ceiling here is ANCHOR_WIDTH_MAX and never 1. A non-finite
 * factor reads the default.
 */
export function clampAnchorWidth(value: number): number {
  if (!Number.isFinite(value)) return ANCHOR_WIDTH_DEFAULT
  return Math.min(ANCHOR_WIDTH_MAX, Math.max(ANCHOR_WIDTH_MIN, value))
}

/**
 * The factor one anchor contributes: absent reads 1 (D-10), present is clamped
 * into the published range. Interpolation and the uniform test both read this
 * single definition, so a sparse profile can never disagree with itself.
 */
function anchorWidthFactor(anchor: VectorAnchor): number {
  return anchor.width === undefined ? ANCHOR_WIDTH_DEFAULT : clampAnchorWidth(anchor.width)
}

/**
 * D-10: true when the profile stores nothing worth persisting — every anchor
 * carries either no factor or exactly the default. A caller that sees true must
 * write no width data at all.
 */
export function isUniformWidthProfile(anchors: readonly VectorAnchor[]): boolean {
  return normaliseVectorAnchors(anchors).every(
    (anchor) => anchorWidthFactor(anchor) === ANCHOR_WIDTH_DEFAULT,
  )
}

function widthAtStation(
  anchors: readonly VectorAnchor[],
  anchorStations: readonly number[],
  station: number,
): number {
  const last = anchors.length - 1
  if (last < 0) return ANCHOR_WIDTH_DEFAULT
  if (last === 0) return anchorWidthFactor(anchors[0]!)
  if (!Number.isFinite(station) || station <= anchorStations[0]!) {
    return anchorWidthFactor(anchors[0]!)
  }
  if (station >= anchorStations[last]!) return anchorWidthFactor(anchors[last]!)
  for (let index = 0; index < last; index++) {
    const start = anchorStations[index]!
    const end = anchorStations[index + 1]!
    if (station > end) continue
    const span = end - start
    const from = anchorWidthFactor(anchors[index]!)
    if (span <= 0) return anchorWidthFactor(anchors[index + 1]!)
    const to = anchorWidthFactor(anchors[index + 1]!)
    return from + (to - from) * ((station - start) / span)
  }
  return anchorWidthFactor(anchors[last]!)
}

/**
 * The width factor at an arc-length station, interpolated linearly between the
 * two bracketing anchors' factors and held at the first / last anchor outside
 * the path. `station` is a position on the spine's own station list (uv).
 */
export function anchorWidthAt(anchors: readonly VectorAnchor[], station: number): number {
  const normalised = normaliseVectorAnchors(anchors)
  const { anchorStations } = walkPath(normalised)
  return widthAtStation(normalised, anchorStations, station)
}

/**
 * One width factor per input point, mapped onto the spine's own arc-length
 * stations. Points at or beyond the end of the spine read the final factor, so
 * a trailing sample can never fall off the profile.
 */
export function sampleVectorWidths(
  anchors: readonly VectorAnchor[],
  points: readonly Vec2[],
): readonly number[] {
  if (points.length === 0) return []
  const normalised = normaliseVectorAnchors(anchors)
  if (normalised.length === 0) return points.map(() => ANCHOR_WIDTH_DEFAULT)
  if (isUniformWidthProfile(normalised)) return points.map(() => ANCHOR_WIDTH_DEFAULT)
  const { points: samples, stations, anchorStations } = walkPath(normalised)
  return points.map((point) => {
    let nearest = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index]!
      const dx = point.x - sample.x
      const dy = point.y - sample.y
      const squared = dx * dx + dy * dy
      if (squared < nearestDistance) {
        nearestDistance = squared
        nearest = index
        if (squared === 0) break
      }
    }
    return widthAtStation(normalised, anchorStations, stations[nearest] ?? 0)
  })
}
