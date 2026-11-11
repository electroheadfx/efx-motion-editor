// ============================================================
//  vectorPath.ts — the ONE persisted vector-path shape (61-03).
//
//  SHAPE LAW (the three decisions this module owns):
//    1. VECTOR-NESS is implied by a NON-EMPTY anchor list. A stroke
//       with no anchors is a hand-painted stroke and carries no
//       vector key at all — there is no boolean flag that could
//       disagree with the data.
//    2. RENDER MODE is an explicit per-stroke discriminator (D-12).
//       `watercolor` is the default and an ABSENT mode resolves to
//       it, so a stroke written before this phase renders exactly as
//       it did (REL-02). The mode is never inferred from a zeroed
//       parameter and never a global setting, and it applies to both
//       stroke families (D-14).
//    3. ANCHORS are absolute document-uv points carrying an optional
//       absolute handle pair and an optional width multiplier. The
//       width factor is the ONLY per-anchor paint property (VEC-03 /
//       VEC-04): brush identity and colour live at the stroke level.
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
  type Vec2,
  type VectorAnchor,
  type VectorAnchorKind,
} from '../vector/spine'

export type {
  VectorAnchor as AquarelleAnchor,
  VectorAnchorKind as AquarelleAnchorKind,
} from '../vector/spine'

/** How a stroke is rendered (D-12). Any brush can render either way. */
export type AquarelleRenderMode = 'watercolor' | 'simple-ribbon'

/** The closed render-mode union, in declaration order. */
export const AQUARELLE_RENDER_MODES: readonly AquarelleRenderMode[] = Object.freeze([
  'watercolor',
  'simple-ribbon',
])

/** An absent mode means watercolour (D-12 / REL-02). */
export const DEFAULT_AQUARELLE_RENDER_MODE: AquarelleRenderMode = 'watercolor'

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

/** Strict membership test over the closed render-mode union. */
export function isAquarelleRenderMode(value: unknown): value is AquarelleRenderMode {
  return (AQUARELLE_RENDER_MODES as readonly unknown[]).includes(value)
}

/** The mode a stroke renders with; anything unknown reads watercolour. */
export function resolveAquarelleRenderMode(value: unknown): AquarelleRenderMode {
  return isAquarelleRenderMode(value) ? value : DEFAULT_AQUARELLE_RENDER_MODE
}

/** 61-07: the shipped preset id that selects the clean-sweep deposit. */
export const SIMPLE_RIBBON_BRUSH_ID = 'simple-ribbon'

/**
 * The render mode a brush id implies (D-12/D-14). A pure string comparison:
 * the payload layer must never look into the playground's preset list, so the
 * mapping cannot drift with the brush array and stays testable without WebGL.
 */
export function resolveRenderModeForBrushId(brushId: string | undefined): AquarelleRenderMode {
  return brushId === SIMPLE_RIBBON_BRUSH_ID
    ? 'simple-ribbon'
    : DEFAULT_AQUARELLE_RENDER_MODE
}

/**
 * The conditional canonical term for the recorded stroke: `{ renderMode }`
 * ONLY when the brush implies a non-default mode, else an empty object. A
 * plain hand-painted stroke therefore keeps its exact pre-phase key set and
 * byte cost (REL-02), and the field can never disagree with the brush id the
 * record path already stores.
 */
export function recordedRenderModeField(
  brushId: string | undefined,
): { renderMode?: AquarelleRenderMode } {
  const mode = resolveRenderModeForBrushId(brushId)
  return mode === DEFAULT_AQUARELLE_RENDER_MODE ? {} : { renderMode: mode }
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
  // SCRATCH STUB (61-30 RED): answers the closed union once the guard lands.
  void value
  return false
}

/** The mode a stroke evaluates with; anything unknown reads Bézier. */
export function resolveAquarelleCurveMode(value: unknown): AquarelleCurveMode {
  // SCRATCH STUB (61-30 RED): reads the default until the resolver lands.
  void value
  return DEFAULT_AQUARELLE_CURVE_MODE
}

/**
 * The conditional canonical term for a recorded stroke: `{ curveMode }` ONLY
 * when the mode is not the default, else an empty object — switching back to
 * Bézier drops the key so an untouched document keeps today's exact bytes.
 */
export function recordedCurveModeField(
  curveMode: unknown,
): { curveMode?: AquarelleCurveMode } {
  // SCRATCH STUB (61-30 RED): writes nothing until the helper lands.
  void curveMode
  return {}
}

type MutableAnchor = {
  x: number
  y: number
  kind: VectorAnchorKind
  in?: Vec2
  out?: Vec2
  width?: number
}

/**
 * Canonical form of one anchor, or undefined when any field is malformed.
 * Only the known fields survive, so an unknown extra key can never reach
 * the document. The width factor is the sole per-anchor paint property.
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
  const anchor: MutableAnchor = { x, y, kind }
  if (handleIn !== undefined) anchor.in = { x: (handleIn as Vec2).x, y: (handleIn as Vec2).y }
  if (handleOut !== undefined) anchor.out = { x: (handleOut as Vec2).x, y: (handleOut as Vec2).y }
  if (width !== undefined) anchor.width = width
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
 * handles and the sparse width factor. Order-sensitive: the list order IS
 * the path order.
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
  }
  return true
}

/**
 * D-10: the projected persisted form of an anchor list. A `width` key is
 * written ONLY for an anchor whose factor is present and not exactly
 * ANCHOR_WIDTH_DEFAULT, so a uniformly-wide stroke stores no width data at
 * all and an untouched anchor gains no key. Order is preserved exactly —
 * 61-02's stations index into this order — and the input is never mutated.
 */
export function projectVectorPath(anchors: readonly VectorAnchor[]): readonly VectorAnchor[] {
  const projected = anchors.map((anchor) => {
    const next: MutableAnchor = { x: anchor.x, y: anchor.y, kind: anchor.kind }
    if (anchor.in !== undefined) next.in = { x: anchor.in.x, y: anchor.in.y }
    if (anchor.out !== undefined) next.out = { x: anchor.out.x, y: anchor.out.y }
    if (anchor.width !== undefined && anchor.width !== ANCHOR_WIDTH_DEFAULT) {
      next.width = anchor.width
    }
    return next
  })
  return Object.freeze(projected)
}

/** The two persisted members a vector path is compared on. */
export interface AquarelleVectorPathShape {
  readonly anchors?: readonly VectorAnchor[]
  readonly renderMode?: unknown
}

/**
 * Full path equality: the anchor list plus the render mode, with an absent
 * mode resolving to watercolour so `{ anchors }` equals `{ anchors,
 * renderMode: 'watercolor' }`.
 */
export function vectorPathsEqual(
  a: AquarelleVectorPathShape,
  b: AquarelleVectorPathShape,
): boolean {
  if (!anchorsEqual(a.anchors ?? [], b.anchors ?? [])) return false
  return resolveAquarelleRenderMode(a.renderMode) === resolveAquarelleRenderMode(b.renderMode)
}
