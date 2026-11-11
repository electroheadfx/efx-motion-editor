// ============================================================
//  vectorPath.ts — the ONE persisted vector-path shape (61-03).
//
//  SHAPE LAW (the three decisions this module owns):
//    1. VECTOR-NESS is implied by a NON-EMPTY anchor list. A stroke
//       with no anchors is a hand-painted stroke and carries no
//       vector key at all — there is no boolean flag that could
//       disagree with the data.
//    2. NUMBERING STAYS PUT. The removed render-mode discriminator
//       keeps its AQTL bit slot in the reader only, so files written
//       while it existed still open; nothing writes or interprets a
//       render mode here.
//    3. ANCHORS are absolute document-uv points carrying an optional
//       absolute handle pair, an optional width multiplier and an
//       optional explicit colour. Quick 261111-wd6 REVISES VEC-04's
//       "width is the only per-anchor paint property": a vertex may
//       carry its own colour, stored even when it equals the stroke
//       colour (explicit wins over inherit). Brush identity still
//       lives at the stroke level only.
//
//  FAIL-CLOSED (T-61-08): one malformed anchor refuses the WHOLE
//  list. Nothing here repairs partially, and nothing here throws —
//  a refusal is an `undefined` return, never an exception.
//
//  The anchor type is 61-02's `VectorAnchor`, re-exported under the
//  payload name. One structural type, one definition; a second copy
//  would be a second curve.
// ============================================================

import {
  ANCHOR_WIDTH_DEFAULT,
  ANCHOR_WIDTH_MAX,
  ANCHOR_WIDTH_MIN,
  normaliseAnchorColor,
  sampleVectorPath,
  type SampledVectorPath,
  type Vec2,
  type VectorAnchor,
  type VectorAnchorKind,
} from '../vector/spine'

export type {
  VectorAnchor as AquarelleAnchor,
  VectorAnchorKind as AquarelleAnchorKind,
} from '../vector/spine'

/** Tolerance of every float comparison in this module. */
const EQUALITY_EPSILON = 1e-9

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isFinitePoint(value: unknown): value is Vec2 {
  if (typeof value !== 'object' || value === null) return false
  const point = value as { readonly x?: unknown; readonly y?: unknown }
  return isFiniteNumber(point.x) && isFiniteNumber(point.y)
}

function numbersEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EQUALITY_EPSILON
}

function samePoint(a: Vec2 | undefined, b: Vec2 | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return numbersEqual(a.x, b.x) && numbersEqual(a.y, b.y)
}

// ---------------------------------------------------------------------------
//  Curve mode (G-20, 2026-11-11). D-01 / D-04 are REVISED here under the
//  user's explicit authorisation: `spline` is an EVALUATION MODE over the
//  SAME anchor list, never a third anchor kind and never a rewrite of
//  authored data. An anchor stays `auto` or `bezier`, its stored handles
//  stay in the document, and `spline` merely evaluates every anchor through
//  the spine's derived-smooth family (`handlesFor` already derives handles
//  for any kind that is not `bezier`). Switching back restores the authored
//  geometry byte for byte, and an absent mode reads `bezier`, so every
//  pre-existing document and script body stays byte-identical (REL-02).
// ---------------------------------------------------------------------------

/** How a vector stroke is evaluated (G-20). Not a second anchor kind. */
export type AquarelleCurveMode = 'bezier' | 'spline'

/** The closed curve-mode union, in declaration order. */
export const AQUARELLE_CURVE_MODES: readonly AquarelleCurveMode[] = Object.freeze([
  'bezier',
  'spline',
])

/** An absent mode means Bézier (G-20 / REL-02). */
export const DEFAULT_AQUARELLE_CURVE_MODE: AquarelleCurveMode = 'bezier'

/** Strict membership test over the closed curve-mode union. */
export function isAquarelleCurveMode(value: unknown): value is AquarelleCurveMode {
  return (AQUARELLE_CURVE_MODES as readonly unknown[]).includes(value)
}

/** The mode a stroke evaluates with; anything unknown reads Bézier. */
export function resolveAquarelleCurveMode(value: unknown): AquarelleCurveMode {
  return isAquarelleCurveMode(value) ? value : DEFAULT_AQUARELLE_CURVE_MODE
}

/**
 * The conditional canonical term for a recorded stroke: `{ curveMode }` ONLY
 * when the mode is not the default, else an empty object — switching back to
 * Bézier drops the key so an untouched document keeps today's exact bytes.
 */
export function recordedCurveModeField(
  curveMode: AquarelleCurveMode,
): { curveMode?: AquarelleCurveMode } {
  return curveMode === DEFAULT_AQUARELLE_CURVE_MODE ? {} : { curveMode }
}

/**
 * A corner is a `bezier` anchor whose two handles sit ON the anchor — the
 * shape the draw gesture places (Shift+click) and the shape a spline must not
 * smooth away. Any stored handle length means the anchor is a curve control,
 * which spline owns again.
 */
function isCornerAnchor(anchor: VectorAnchor): boolean {
  if (anchor.kind !== 'bezier') return false;
  const { in: handleIn, out: handleOut } = anchor;
  if (!isFinitePoint(handleIn) || !isFinitePoint(handleOut)) return false;
  return handleIn.x === anchor.x && handleIn.y === anchor.y
    && handleOut.x === anchor.x && handleOut.y === anchor.y;
}

/**
 * The evaluation VIEW of an anchor list (G-20). `bezier` returns the list
 * untouched; `spline` turns every anchor into the derived-smooth view EXCEPT
 * a placed corner, which keeps its identity so a sharp angle survives the
 * mode. Widths always survive. Authored handles on a smoothed anchor are
 * dropped from the VIEW only — the document keeps them.
 */
export function resolveCurveAnchors(
  anchors: readonly VectorAnchor[],
  curveMode: AquarelleCurveMode,
): readonly VectorAnchor[] {
  if (curveMode !== 'spline') return anchors
  const view = anchors.map((anchor) => {
    // 261111-wd6: paint properties survive BOTH branches — a spline that
    // dropped a colour would make the sampler read a colour the document
    // never wrote.
    const paint = {
      ...(anchor.width === undefined ? {} : { width: anchor.width }),
      ...(anchor.color === undefined ? {} : { color: anchor.color }),
    }
    if (isCornerAnchor(anchor)) {
      const corner: VectorAnchor = {
        x: anchor.x,
        y: anchor.y,
        kind: 'bezier',
        in: { x: anchor.in!.x, y: anchor.in!.y },
        out: { x: anchor.out!.x, y: anchor.out!.y },
        ...paint,
      }
      return corner
    }
    const plain: VectorAnchor = { x: anchor.x, y: anchor.y, kind: 'auto', ...paint }
    return plain
  })
  return Object.freeze(view)
}

/**
 * One `sampleVectorPath` walk over the mode's evaluation view (G-20): Bézier
 * evaluates the authored list unchanged, spline evaluates the derived-auto
 * view. This is the ONE place the mode chooses an evaluation — every caller
 * that needs points goes through here, never the raw spine sampler.
 */
export function evaluateAquarellePath(
  anchors: readonly VectorAnchor[],
  curveMode: AquarelleCurveMode,
): SampledVectorPath {
  return sampleVectorPath(resolveCurveAnchors(anchors, curveMode))
}

type MutableAnchor = {
  x: number
  y: number
  kind: VectorAnchorKind
  in?: Vec2
  out?: Vec2
  width?: number
  color?: string
}

/**
 * Canonical form of one anchor, or undefined when any field is malformed.
 * Only the known fields survive, so an unknown extra key can never reach
 * the document. Paint is the sparse width factor plus an optional explicit
 * colour (261111-wd6); a colour the package normaliser cannot canonicalise
 * refuses the WHOLE list — it is never repaired.
 */
function canonicalAnchor(raw: Record<string, unknown>): MutableAnchor | undefined {
  const x = raw['x']
  const y = raw['y']
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return undefined
  const kind = raw['kind']
  if (kind !== 'auto' && kind !== 'bezier') return undefined
  const handleIn = raw['in']
  const handleOut = raw['out']
  if (handleIn !== undefined && !isFinitePoint(handleIn)) return undefined
  if (handleOut !== undefined && !isFinitePoint(handleOut)) return undefined
  const width = raw['width']
  if (width !== undefined) {
    if (!isFiniteNumber(width)) return undefined
    if (width < ANCHOR_WIDTH_MIN || width > ANCHOR_WIDTH_MAX) return undefined
  }
  const color = raw['color']
  const normalisedColor = color === undefined ? undefined : normaliseAnchorColor(color)
  if (color !== undefined && normalisedColor === undefined) return undefined
  const anchor: MutableAnchor = { x, y, kind }
  if (handleIn !== undefined) anchor.in = { x: (handleIn as Vec2).x, y: (handleIn as Vec2).y }
  if (handleOut !== undefined) anchor.out = { x: (handleOut as Vec2).x, y: (handleOut as Vec2).y }
  if (width !== undefined) anchor.width = width
  if (normalisedColor !== undefined) anchor.color = normalisedColor
  return anchor
}

/**
 * Validate an anchor list and return a frozen canonical copy, or undefined
 * when ANY entry is malformed. An empty list is not a path, so it refuses
 * too. Total: never throws.
 */
export function normaliseAquarelleAnchors(input: unknown): readonly VectorAnchor[] | undefined {
  if (!Array.isArray(input) || input.length === 0) return undefined
  const anchors: VectorAnchor[] = []
  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null) return undefined
    const anchor = canonicalAnchor(entry as Record<string, unknown>)
    if (anchor === undefined) return undefined
    anchors.push(anchor)
  }
  return Object.freeze(anchors)
}

/** True when a payload carries a valid, non-empty anchor list. */
export function isVectorStroke(
  payload: { readonly anchors?: unknown } | null | undefined,
): boolean {
  return normaliseAquarelleAnchors(payload?.anchors) !== undefined
}

/**
 * Field-by-field anchor comparison to within 1e-9, including the optional
 * handles, the sparse width factor and the explicit colour. Order-sensitive:
 * the list order IS the path order. Without the colour term a colour-only
 * edit compares equal and the record store silently drops the gesture.
 */
export function anchorsEqual(
  a: readonly VectorAnchor[],
  b: readonly VectorAnchor[],
): boolean {
  if (a.length !== b.length) return false
  for (let index = 0; index < a.length; index++) {
    const left = a[index]!
    const right = b[index]!
    if (!numbersEqual(left.x, right.x) || !numbersEqual(left.y, right.y)) return false
    if (left.kind !== right.kind) return false
    if (!samePoint(left.in, right.in) || !samePoint(left.out, right.out)) return false
    if (left.width === undefined || right.width === undefined) {
      if (left.width !== right.width) return false
    } else if (!numbersEqual(left.width, right.width)) {
      return false
    }
    // Exact string equality: both canonical, both absent is equal.
    if (left.color !== right.color) return false
  }
  return true
}

/**
 * D-10: the projected persisted form of an anchor list. A `width` key is
 * written ONLY for an anchor whose factor is present and not exactly
 * ANCHOR_WIDTH_DEFAULT, so a uniformly-wide stroke stores no width data at
 * all and an untouched anchor gains no key. A `color` key is written
 * whenever it is present (261111-wd6) — there is NO default elision for
 * colour, because an explicit colour equal to the stroke's is still an
 * explicit intent. Order is preserved exactly — 61-02's stations index into
 * this order — and the input is never mutated.
 */
export function projectVectorPath(anchors: readonly VectorAnchor[]): readonly VectorAnchor[] {
  const projected = anchors.map((anchor) => {
    const next: MutableAnchor = { x: anchor.x, y: anchor.y, kind: anchor.kind }
    if (anchor.in !== undefined) next.in = { x: anchor.in.x, y: anchor.in.y }
    if (anchor.out !== undefined) next.out = { x: anchor.out.x, y: anchor.out.y }
    if (anchor.width !== undefined && anchor.width !== ANCHOR_WIDTH_DEFAULT) {
      next.width = anchor.width
    }
    if (anchor.color !== undefined) next.color = anchor.color
    return next
  })
  return Object.freeze(projected)
}

/** The persisted member a vector path is compared on. */
export interface AquarelleVectorPathShape {
  readonly anchors?: readonly VectorAnchor[]
}

/** Path equality: the anchor list, and nothing else. */
export function vectorPathsEqual(
  a: AquarelleVectorPathShape,
  b: AquarelleVectorPathShape,
): boolean {
  return anchorsEqual(a.anchors ?? [], b.anchors ?? [])
}
