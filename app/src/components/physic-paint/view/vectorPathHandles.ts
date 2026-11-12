// ============================================================
//  vectorPathHandles — the draw/edit geometry of a vector path
//  (61-09, VEC-01 / VEC-07).
//
//  Two laws this module owns:
//    1. SCREEN-PIXEL CHROME. Every handle constant below is a
//       SCREEN-pixel value (the shipped `scriptStrokeTransform`
//       law): the marker keeps its screen size at every zoom, so
//       its uv extent is the screen size divided by the effective
//       zoom. `screenPadToUv` is the one conversion; nothing here
//       re-derives it.
//    2. ONE CURVE. The spine, the resolved handles and the sparse
//       width profile all come from `@efxlab/efx-watercolor`
//       (61-02's spine.ts). Nothing in this module re-samples a
//       curve, re-derives a tangent or invents a second station
//       list.
//
//  Coordinates: document uv (y up, the engine's frame) for every
//  anchor / spine value; layer pixels (y down, the SVG viewBox
//  units of the canvas overlays) for anything drawn. `uvToScreen`
//  and `screenToUv` are the only bridge.
//
//  PURITY: no Preact, no signals, no DOM, no engine import. The
//  module is called from render bodies and from pointer handlers
//  alike.
// ============================================================

import {
  ANCHOR_WIDTH_DEFAULT,
  DEFAULT_AQUARELLE_CURVE_MODE,
  clampAnchorWidth,
  evaluateAquarellePath,
  isUniformWidthProfile,
  normaliseAnchorColor,
  normaliseVectorAnchors,
  readAnchorCornerState,
  recordedCurveModeField,
  resolveAnchorHandles,
  resolveCurveAnchors,
  sampleVectorWidths,
  withAnchorCornerState,
  type AnchorCornerState,
  type AquarelleCurveMode,
  type AquarelleStroke,
  type AquarelleTool,
  type ResolvedAnchorHandles,
  type Vec2,
  type VectorAnchor,
} from '@efxlab/efx-watercolor/payload';
import type { CanvasPoint } from './scriptStrokeEdition';

// --- The shipped screen-pixel chrome -------------------------------------

/** Anchor marker edge, screen px (UI-SPEC: 9px square, the transform-handle law). */
export const ANCHOR_BODY_PX = 9;

/** Extra hit area around a handle/anchor marker, screen px. */
export const ANCHOR_HIT_PAD_PX = 8;

/** Auto-smooth anchor circle radius, screen px (inscribed in the 9px square). */
export const ANCHOR_CORE_RADIUS_PX = 3.5;

/** Handle dot diameter, screen px. */
export const HANDLE_BODY_PX = 7;

/** Screen px the pointer must travel before a press becomes a drag. */
export const DRAG_THRESHOLD_PX = 3;

/** Screen px inside which a click counts as landing on the previous anchor. */
export const ADJACENCY_MIN_PX = 6;

/** Screen px inside which a click on the first anchor finishes the path there. */
export const FIRST_ANCHOR_HIT_PX = 12;

/**
 * Display-only base half-width of the width envelope at factor 1, as a
 * fraction of the document height (the unit `paintRadiusDocFor` uses for the
 * hand-painted band). The envelope visualises the RELATIVE profile — the
 * baked thickness is the brush's own radius times the same factor.
 */
export const VECTOR_ENVELOPE_BASE_UV = 0.02;

/** One pointer target on a vector path, in priority order. */
export type VectorHitTarget =
  | { readonly kind: 'anchor'; readonly index: number }
  | { readonly kind: 'handle-in'; readonly index: number }
  | { readonly kind: 'handle-out'; readonly index: number };

/** Drawable geometry of one vector path, in layer pixels (y down). */
export interface VectorPathProjection {
  /** One marker position per anchor, order preserved. */
  readonly anchors: readonly CanvasPoint[];
  /** The sampled spine polyline. */
  readonly spine: readonly CanvasPoint[];
  /** One width factor per spine point (1 on a uniform profile). */
  readonly widths: readonly number[];
  /** Closed envelope polygon; empty when the profile is uniform (D-10). */
  readonly envelope: readonly CanvasPoint[];
}

/**
 * The mode a NEWLY drawn path is recorded with. `DEFAULT_AQUARELLE_CURVE_MODE`
 * stays the STORAGE default (an absent key in an existing document means
 * Bézier), so a new path always writes its mode explicitly instead of relying
 * on absence. Spline is the draw/edit default because every anchor the pen
 * places is smooth unless Shift made it a corner, and a spline edit keeps
 * deriving tangents instead of freezing them into kinks.
 */
export const DEFAULT_VECTOR_PATH_CURVE_MODE: AquarelleCurveMode = 'spline';

/** What the overlay hands the Studio seam when a path is finished. */
export interface VectorPathCommit {
  readonly anchors: readonly VectorAnchor[];
  /** The mode the path was sampled and is recorded with (G-20). */
  readonly curveMode: AquarelleCurveMode;
  readonly points: readonly Vec2[];
}

/** The record-time half of a finished path (everything the overlay never reads). */
export interface VectorStrokeSource {
  readonly color: string | null;
  readonly params: Readonly<Record<string, number>>;
  readonly brushId: string;
  readonly toolOverrides: NonNullable<AquarelleStroke['toolOverrides']>;
  readonly tool: AquarelleTool;
  readonly diffusionFrames: number;
  readonly timestamp: number;
  readonly playFrame: number;
}

// --- uv <-> layer pixels --------------------------------------------------

/** Document uv (y up) to layer pixels (y down). */
export function uvToScreen(point: Vec2, width: number, height: number): CanvasPoint {
  return { x: point.x * width, y: (1 - point.y) * height };
}

/** Layer pixels (y down) to document uv (y up). */
export function screenToUv(point: CanvasPoint, width: number, height: number): Vec2 {
  return { x: point.x / width, y: 1 - point.y / height };
}

/**
 * A screen-pixel length expressed in document uv at the current display:
 * `padPx / (width * scale)`. The anchor marker's uv extent is exactly
 * `screenPadToUv(ANCHOR_BODY_PX, width, scale)`, so it shrinks by the zoom
 * factor and the drawn marker keeps its screen size.
 */
export function screenPadToUv(padPx: number, width: number, scale: number): number {
  const denominator = width * scale;
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return padPx / denominator;
}

function distanceBetween(a: CanvasPoint, b: CanvasPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function finiteScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

// --- Hit testing ----------------------------------------------------------

/** Distance from a point to a segment, in layer pixels. */
export function pointToSegmentDistancePx(
  point: CanvasPoint,
  start: CanvasPoint,
  end: CanvasPoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!(lengthSquared > 0)) return distanceBetween(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return distanceBetween(point, { x: start.x + dx * t, y: start.y + dy * t });
}

/**
 * The hit target under the pointer, in the UI-SPEC priority order:
 * handle -> anchor -> nothing. Handles are offered only for `bezier`
 * anchors (an auto anchor's derived tangent is not a user-owned control);
 * anchors are tested from the nearest out so overlapping markers resolve
 * deterministically. The pad is a SCREEN-pixel value, so it is applied as
 * `distance * scale`.
 *
 * 61-30 (G-20): under `spline` every tangent is derived, so no stored handle
 * is a user-owned control — the handle loop is skipped entirely (T-61-88).
 */
export function hitTestVectorPath(
  anchors: readonly VectorAnchor[],
  handles: readonly ResolvedAnchorHandles[],
  pointerUv: Vec2,
  width: number,
  height: number,
  scale: number,
  curveMode: AquarelleCurveMode = DEFAULT_AQUARELLE_CURVE_MODE,
): VectorHitTarget | null {
  const pointer = uvToScreen(pointerUv, width, height);
  if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;
  const zoom = finiteScale(scale);
  const anchorRadiusPx = ANCHOR_HIT_PAD_PX + ANCHOR_BODY_PX / 2;
  const handleRadiusPx = ANCHOR_HIT_PAD_PX + HANDLE_BODY_PX / 2;

  let bestHandle: VectorHitTarget | null = null;
  let bestHandleDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; curveMode !== 'spline' && index < anchors.length; index += 1) {
    if (anchors[index]!.kind !== 'bezier') continue;
    const resolved = handles[index];
    if (resolved === undefined) continue;
    const candidates: readonly { kind: 'handle-in' | 'handle-out'; at: Vec2 }[] = [
      { kind: 'handle-in', at: resolved.in },
      { kind: 'handle-out', at: resolved.out },
    ];
    for (const candidate of candidates) {
      if (!Number.isFinite(candidate.at.x) || !Number.isFinite(candidate.at.y)) continue;
      const distance = distanceBetween(pointer, uvToScreen(candidate.at, width, height)) * zoom;
      if (distance > handleRadiusPx || distance >= bestHandleDistance) continue;
      bestHandleDistance = distance;
      bestHandle = { kind: candidate.kind, index };
    }
  }
  if (bestHandle !== null) return bestHandle;

  let bestAnchor: VectorHitTarget | null = null;
  let bestAnchorDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]!;
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) continue;
    const distance = distanceBetween(pointer, uvToScreen(anchor, width, height)) * zoom;
    if (distance > anchorRadiusPx || distance >= bestAnchorDistance) continue;
    bestAnchorDistance = distance;
    bestAnchor = { kind: 'anchor', index };
  }
  return bestAnchor;
}

// --- Pure list operations -------------------------------------------------

/** Insert one anchor at `index`, clamped into range; the input is never mutated. */
export function insertAnchorAt(
  anchors: readonly VectorAnchor[],
  index: number,
  anchor: VectorAnchor,
): readonly VectorAnchor[] {
  const clamped = Number.isFinite(index)
    ? Math.max(0, Math.min(anchors.length, Math.trunc(index)))
    : anchors.length;
  return [...anchors.slice(0, clamped), anchor, ...anchors.slice(clamped)];
}

/** Drop every listed index; unknown / non-integer indices are ignored. */
export function deleteAnchorsAt(
  anchors: readonly VectorAnchor[],
  indices: readonly number[],
): readonly VectorAnchor[] {
  const removed = new Set<number>();
  for (const index of indices) {
    if (Number.isInteger(index) && index >= 0) removed.add(index);
  }
  if (removed.size === 0) return anchors;
  return anchors.filter((_, index) => !removed.has(index));
}

/**
 * True when the pointer lands within ADJACENCY_MIN_PX of the last anchor.
 * A duplicate click is refused rather than appended, so no zero-length
 * segment can accumulate in the draft (T-61-29).
 */
export function isAdjacentToLast(
  anchors: readonly VectorAnchor[],
  pointerUv: Vec2,
  width: number,
  height: number,
  scale: number,
): boolean {
  const last = anchors[anchors.length - 1];
  if (last === undefined) return false;
  const pointer = uvToScreen(pointerUv, width, height);
  const anchor = uvToScreen(last, width, height);
  if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return false;
  return distanceBetween(pointer, anchor) * finiteScale(scale) < ADJACENCY_MIN_PX;
}

// --- Draft evaluation -----------------------------------------------------

/** The in-progress path: its typed anchors and the sampled spine (document uv). */
export interface DraftVectorPath {
  readonly anchors: readonly VectorAnchor[];
  readonly points: readonly Vec2[];
}

/**
 * Evaluate the draft anchors through the one spine module. The returned
 * anchor list is the NORMALISED list, so the committed path is exactly the
 * curve the user saw (a duplicate or non-finite anchor can never reach the
 * document — T-61-28). 61-30 (G-20): the points come from the mode's
 * evaluation view while the anchors stay the STORED ones — a draft is never
 * rewritten by the mode it is drawn with.
 */
export function buildDraftPath(
  draftAnchors: readonly VectorAnchor[],
  curveMode: AquarelleCurveMode = DEFAULT_AQUARELLE_CURVE_MODE,
): DraftVectorPath {
  const anchors = normaliseVectorAnchors(draftAnchors);
  if (anchors.length === 0) return { anchors: [], points: [] };
  const { points } = evaluateAquarellePath(anchors, curveMode);
  return { anchors, points };
}

// --- Projection -----------------------------------------------------------

function buildEnvelope(
  spine: readonly CanvasPoint[],
  widths: readonly number[],
  height: number,
): CanvasPoint[] {
  if (spine.length < 2) return [];
  const baseHalfWidthPx = VECTOR_ENVELOPE_BASE_UV * height;
  const left: CanvasPoint[] = [];
  const right: CanvasPoint[] = [];
  for (let index = 0; index < spine.length; index += 1) {
    const point = spine[index]!;
    const before = spine[Math.max(0, index - 1)]!;
    const after = spine[Math.min(spine.length - 1, index + 1)]!;
    let tx = after.x - before.x;
    let ty = after.y - before.y;
    const length = Math.hypot(tx, ty);
    if (!(length > 0)) {
      tx = 1;
      ty = 0;
    } else {
      tx /= length;
      ty /= length;
    }
    const half = baseHalfWidthPx * (widths[index] ?? 1);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(half)) continue;
    left.push({ x: point.x - ty * half, y: point.y + tx * half });
    right.push({ x: point.x + ty * half, y: point.y - tx * half });
  }
  if (left.length < 2) return [];
  return [...left, ...right.reverse()];
}

/**
 * Project one anchor list into drawable layer-pixel geometry. An empty list
 * draws nothing (the vector-ness law: no anchors = not a vector stroke). A
 * uniform width profile stores no factor, so it draws no envelope — the
 * envelope exists to make the sparse profile visible (D-10), exactly like the
 * rung law's "no rung for an absent factor".
 *
 * `alwaysEnvelope` (61-13 wireframe) draws the swept envelope even for a
 * uniform profile: the wireframe is a CONSTRUCTION view, so it shows the
 * stroke's actual width unconditionally. Editing chrome keeps the D-10 law.
 *
 * 61-30 (G-20): `curveMode` selects the evaluation view for the SPINE only —
 * the markers and the width profile always read the stored anchors, because
 * a mode is not an anchor edit.
 */
export function projectVectorPath(
  anchors: readonly VectorAnchor[],
  width: number,
  height: number,
  options: { readonly alwaysEnvelope?: boolean; readonly curveMode?: AquarelleCurveMode } = {},
): VectorPathProjection {
  const normalised = normaliseVectorAnchors(anchors);
  if (normalised.length === 0) return { anchors: [], spine: [], widths: [], envelope: [] };
  const { points } = evaluateAquarellePath(
    normalised,
    options.curveMode ?? DEFAULT_AQUARELLE_CURVE_MODE,
  );
  if (points.length === 0) return { anchors: [], spine: [], widths: [], envelope: [] };
  const spine = points.map((point) => uvToScreen(point, width, height));
  // The width profile indexes the STORED anchors, never the spline view.
  const widths = sampleVectorWidths(normalised, points);
  const envelope = options.alwaysEnvelope === true || !isUniformWidthProfile(normalised)
    ? buildEnvelope(spine, widths, height)
    : [];
  return {
    anchors: normalised.map((anchor) => uvToScreen(anchor, width, height)),
    spine,
    widths,
    envelope,
  };
}

// --- Edit helpers (61-10, VEC-02) ----------------------------------------

/**
 * D-03: grabbing an `auto` anchor promotes it to `bezier` PERMANENTLY, with
 * the derived handles frozen at their pre-drag values. There is no
 * auto-with-override state — the moment the user takes control, they own it.
 * An already-bezier anchor is carried untouched (same anchor object), and the
 * input list is never mutated.
 *
 * 61-30 (G-20): under `spline` every tangent is derived, so an anchor drag
 * owns nothing to freeze — the list is returned untouched with every kind and
 * handle intact (T-61-88).
 */
export function promoteAnchorForDrag(
  anchors: readonly VectorAnchor[],
  index: number,
  curveMode: AquarelleCurveMode = DEFAULT_AQUARELLE_CURVE_MODE,
): readonly VectorAnchor[] {
  if (curveMode === 'spline') return [...anchors];
  const anchor = anchors[index];
  if (anchor === undefined || anchor.kind === 'bezier') return [...anchors];
  const resolved = resolveAnchorHandles(anchors)[index];
  if (resolved === undefined) return [...anchors];
  const promoted: VectorAnchor = {
    ...anchor,
    kind: 'bezier',
    in: { x: resolved.in.x, y: resolved.in.y },
    out: { x: resolved.out.x, y: resolved.out.y },
  };
  const next = [...anchors];
  next[index] = promoted;
  return next;
}

/**
 * Move one anchor by a document-uv delta, carrying every STORED handle
 * endpoint by the same delta. An `auto` anchor stores no handles, so none are
 * invented; every other anchor keeps its exact identity.
 */
export function moveAnchorBy(
  anchors: readonly VectorAnchor[],
  index: number,
  dx: number,
  dy: number,
): readonly VectorAnchor[] {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return [...anchors];
  const anchor = anchors[index];
  if (anchor === undefined) return [...anchors];
  const moved: VectorAnchor = {
    ...anchor,
    x: anchor.x + dx,
    y: anchor.y + dy,
    ...(anchor.in !== undefined ? { in: { x: anchor.in.x + dx, y: anchor.in.y + dy } } : {}),
    ...(anchor.out !== undefined ? { out: { x: anchor.out.x + dx, y: anchor.out.y + dy } } : {}),
  };
  const next = [...anchors];
  next[index] = moved;
  return next;
}

/**
 * The handle drag: move one handle endpoint of a `bezier` anchor. Unless the
 * coupling is broken (the Alt modifier), the partner handle is mirrored about
 * the anchor so the pair stays collinear and equal-length. With the coupling
 * broken the partner is carried byte-identical for this drag only — the anchor
 * stays `bezier` either way.
 */
export function moveHandleTo(
  anchors: readonly VectorAnchor[],
  index: number,
  side: 'in' | 'out',
  pointUv: Vec2,
  breakCoupling: boolean,
): readonly VectorAnchor[] {
  const anchor = anchors[index];
  if (anchor === undefined || anchor.kind !== 'bezier') return [...anchors];
  if (!Number.isFinite(pointUv.x) || !Number.isFinite(pointUv.y)) return [...anchors];
  const moved = { x: pointUv.x, y: pointUv.y };
  const mirrored = { x: 2 * anchor.x - moved.x, y: 2 * anchor.y - moved.y };
  const movedAnchor: VectorAnchor = breakCoupling
    ? (side === 'in' ? { ...anchor, in: moved } : { ...anchor, out: moved })
    : (side === 'in'
      ? { ...anchor, in: moved, out: mirrored }
      : { ...anchor, in: mirrored, out: moved });
  const next = [...anchors];
  next[index] = movedAnchor;
  return next;
}

/**
 * The pure half of a corner commit (261112-i6d): write the requested corner
 * state on every listed anchor in one pass and leave every other anchor
 * reference-identical. The shape itself comes from the package's
 * `withAnchorCornerState` — under Spline `resolveCurveAnchors` keeps a
 * straight corner verbatim while smoothing every other anchor, so the SAME
 * write yields a sharp angle in BOTH curve modes; under Bézier the stored
 * handles collapse onto the anchor. `width` and `color` survive both branches.
 *
 * A list whose every listed anchor already holds the requested state returns
 * the INPUT reference — the caller's identity check is the whole no-op
 * decision, and the caller drives the result through ONE edit wrapper.
 */
export function buildAnchorCornerCommit(
  anchors: readonly VectorAnchor[],
  indices: readonly number[],
  state: AnchorCornerState,
): readonly VectorAnchor[] {
  const targets = new Set(
    normaliseAnchorSelection(indices).filter((index) => index < anchors.length),
  );
  let changed = false;
  const next = anchors.map((anchor, index) => {
    if (!targets.has(index)) return anchor;
    const written = withAnchorCornerState(anchor, state);
    if (written !== anchor) changed = true;
    return written;
  });
  return changed ? next : anchors;
}

/**
 * 261112-i6d — Alt+click on a vertex TOGGLES the corner state: a curved vertex
 * becomes a straight corner, a straight corner returns to the derived-smooth
 * round shape. One law for both curve modes, never a second anchor model.
 *
 * An invalid index or an absent anchor returns the INPUT reference — the
 * caller's identity check is the whole commit decision. This never touches
 * the per-drag Alt decoupling inside `moveHandleTo`.
 */
export function toggleAnchorCorner(
  anchors: readonly VectorAnchor[],
  index: number,
): readonly VectorAnchor[] {
  if (!Number.isInteger(index) || index < 0 || index >= anchors.length) return anchors;
  const anchor = anchors[index];
  if (anchor === undefined) return anchors;
  const next: AnchorCornerState = readAnchorCornerState(anchor) === 'straight' ? 'round' : 'straight';
  return buildAnchorCornerCommit(anchors, [index], next);
}

// --- Insert on a segment (61-10 Task 2) -----------------------------------

/**
 * Insert one `auto` anchor between the two anchors of `segmentIndex`. The
 * click is projected onto the chord to find its station, then the evaluated
 * curve is sampled at that station so the new anchor sits ON the path the
 * user clicked — never off the chord's straight line. Its handles are not
 * stored: re-resolving the list derives them like every other `auto` anchor
 * (D-03's counter-case: a new anchor starts unowned). The input list is never
 * mutated and untouched anchors are carried by reference.
 *
 * 61-30 (G-20): under `spline` the basis handles come from the derived-auto
 * view, so the click is projected onto the curve the user actually sees while
 * the stored anchors keep their authored kinds and handles.
 */
export function insertAnchorOnSegment(
  anchors: readonly VectorAnchor[],
  segmentIndex: number,
  pointUv: Vec2,
  curveMode: AquarelleCurveMode = DEFAULT_AQUARELLE_CURVE_MODE,
): readonly VectorAnchor[] {
  const normalised = normaliseVectorAnchors(anchors);
  if (normalised.length < 2) return [...normalised];
  if (!Number.isFinite(pointUv.x) || !Number.isFinite(pointUv.y)) return [...normalised];
  const lastSegment = normalised.length - 2;
  const segment = Number.isFinite(segmentIndex)
    ? Math.max(0, Math.min(lastSegment, Math.trunc(segmentIndex)))
    : lastSegment;
  const start = normalised[segment]!;
  const end = normalised[segment + 1]!;
  const handles = resolveAnchorHandles(resolveCurveAnchors(normalised, curveMode));
  const controlA = handles[segment]?.out ?? start;
  const controlB = handles[segment + 1]?.in ?? end;
  // Chord projection: the station the click falls on along the segment.
  const chordX = end.x - start.x;
  const chordY = end.y - start.y;
  const chordSquared = chordX * chordX + chordY * chordY;
  const t = chordSquared > 0
    ? Math.max(0, Math.min(1, ((pointUv.x - start.x) * chordX + (pointUv.y - start.y) * chordY) / chordSquared))
    : 0.5;
  const u = 1 - t;
  const x = u * u * u * start.x + 3 * u * u * t * controlA.x + 3 * u * t * t * controlB.x + t * t * t * end.x;
  const y = u * u * u * start.y + 3 * u * u * t * controlA.y + 3 * u * t * t * controlB.y + t * t * t * end.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [...normalised];
  const inserted: VectorAnchor = { x, y, kind: 'auto' };
  return [
    ...normalised.slice(0, segment + 1),
    inserted,
    ...normalised.slice(segment + 1),
  ];
}

// --- The anchor selection (61-10 Task 2) ----------------------------------

/** Deduplicated, ascending selection; unknown indices are dropped. */
function normaliseAnchorSelection(selected: readonly number[]): readonly number[] {
  const kept = new Set<number>();
  for (const index of selected) {
    if (Number.isInteger(index) && index >= 0) kept.add(index);
  }
  return [...kept].sort((a, b) => a - b);
}

/**
 * The overlay's selection action: a plain press replaces the selection with
 * the pressed anchor; an additive press (Shift / Cmd / Ctrl) toggles it while
 * keeping the list deduplicated and ascending. Always returns a new list.
 */
export function selectAnchor(
  selected: readonly number[],
  index: number,
  additive: boolean,
): readonly number[] {
  const current = normaliseAnchorSelection(selected);
  if (!Number.isInteger(index) || index < 0) return current;
  if (!additive) return [index];
  const next = new Set(current);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  return [...next].sort((a, b) => a - b);
}

// --- The width commit (61-10 Task 2) --------------------------------------

/** One anchor without its `width` key — the sparse representation of 1.0. */
function withoutWidth(anchor: VectorAnchor): VectorAnchor {
  const { width: _width, ...rest } = anchor;
  return rest;
}

/**
 * The pure half of a width commit: write the CLAMPED factor on every listed
 * anchor in one pass and leave every other anchor reference-identical. A
 * factor of exactly 1 DELETES the key instead of storing `width: 1`, so the
 * sparse profile stays sparse (the envelope law reads an absent factor as 1).
 * The caller drives the result through ONE edit wrapper — never one per
 * anchor (VEC-07).
 */
export function buildAnchorWidthCommit(
  anchors: readonly VectorAnchor[],
  indices: readonly number[],
  value: number,
): readonly VectorAnchor[] {
  const targets = new Set(normaliseAnchorSelection(indices));
  const width = clampAnchorWidth(value);
  return anchors.map((anchor, index) => {
    if (!targets.has(index)) return anchor;
    return width === ANCHOR_WIDTH_DEFAULT ? withoutWidth(anchor) : { ...withoutWidth(anchor), width };
  });
}

// --- The colour commit (261111-wd6) ---------------------------------------

/**
 * The pure half of a per-vertex colour commit: write the CANONICAL colour on
 * every listed anchor in one pass and leave every other anchor reference-
 * identical. Returns null — never a no-op list — when the package normaliser
 * refuses the colour, when the selection is empty, or when the selection
 * names no existing anchor; the caller then falls through to the shipped
 * stroke-level commit.
 *
 * Unlike width there is NO default elision: an explicit colour is stored even
 * when it equals the stroke colour (explicit wins over inherit). The caller
 * drives the result through ONE edit wrapper (VEC-07).
 */
export function buildAnchorColorCommit(
  anchors: readonly VectorAnchor[],
  indices: readonly number[],
  color: string,
): readonly VectorAnchor[] | null {
  const next = normaliseAnchorColor(color);
  if (next === undefined) return null;
  const targets = new Set(normaliseAnchorSelection(indices));
  if (targets.size === 0) return null;
  let namesAnchor = false;
  for (const index of targets) {
    if (index < anchors.length) {
      namesAnchor = true;
      break;
    }
  }
  if (!namesAnchor) return null;
  return anchors.map((anchor, index) =>
    targets.has(index) ? { ...anchor, color: next } : anchor,
  );
}

/**
 * Whether a colour commit would change nothing (261112-hfk CR-01).
 *
 * `next` MUST be the list `buildAnchorColorCommit` produced from these very
 * `anchors`: same length, same order, every non-targeted anchor reference-
 * identical — so only the listed indices can differ, and comparing the
 * explicit colours is the whole decision. An uncoloured anchor that gains a
 * colour is a REAL change, including one equal to its stroke's colour
 * (explicit wins over inherit — never skipped as a no-op).
 *
 * The commit chain returns the same null edit id for "in flight/unchanged" as
 * for "refused" (the anchorsEqual early return), so a caller that sees a null
 * edit id after a true verdict must treat it as in flight, never refused.
 */
export function anchorColorCommitIsNoOp(
  anchors: readonly VectorAnchor[],
  next: readonly VectorAnchor[],
): boolean {
  return next.every((anchor, index) => anchor.color === anchors[index]?.color);
}

// --- The commit's stroke half --------------------------------------------

/**
 * The pressure a vector stroke's spine is built around.
 *
 * A vector path has no pressure input: the pen places anchors, it does not
 * press. The engine's deposit law reads `p` first (`pressureOf`), so a
 * constant value here is a constant footprint and a constant deposit. `0.5`
 * is the value the engine already records for a pressureless device; the
 * clean-sweep ribbon keeps it (its contract is a flat sweep, not a wet pen),
 * and it is the fallback for a sample the profile did not fill.
 */
export const VECTOR_STROKE_BASE_PRESSURE = 0.5;

/**
 * Base arc-length distance between two PAINT samples, in document uv.
 *
 * The replay feeds one sample per host tick, so sample spacing IS the hand's
 * speed and sample count IS the stroke's wet lifetime. The live project's own
 * recorded mouse strokes (same brush, 1080 square) carry 19-86 samples with a
 * 0.014-0.033 uv mean spacing and replay in 0.3-1.4 s. The old 0.002 uv
 * geometry walk gave a 1.4 uv path 232-700 samples — a 4-24 s wash that spread
 * into the broad, even cloud a hand never paints. This base (with the turn
 * slowdown and drift below) lands a 1.4 uv path at ~40 samples / 0.65 s.
 */
export const VECTOR_PAINT_SAMPLE_STEP_UV = 0.04;

/** The step multiplier at a full turn: the hand slows into a corner. */
const VECTOR_PAINT_STEP_TURN_SLOWDOWN = 0.4;
/** Deterministic low-frequency pacing drift, so spacing is never robotic. */
const VECTOR_PAINT_STEP_DRIFT = [
  { cycles: 1.3, amplitude: 0.18 },
  { cycles: 3.7, amplitude: 0.08 },
] as const;
const VECTOR_PAINT_STEP_MIN_UV = 0.008;
const VECTOR_PAINT_STEP_MAX_UV = 0.08;

/**
 * The pressure sentinel a mouse records: "no device pressure, derive it from
 * speed". A vector stroke is built from exactly the samples a mouse stroke
 * records — this sentinel and a hand-cadence spacing — so the engine's own
 * pressure law (`clamp(1.18 - speed * 0.95, 0.12, 1)` smoothed per tick) is
 * the ONLY owner of the vector's pressure. The probe measured this against the
 * live project's own hand stroke: peak ink 115.8 vs 117.4, core width 114.6
 * vs 120.1 px, halo 188.9 vs 186.4 px.
 */
const VECTOR_PRESSURE_SENTINEL = -1;

/**
 * Paint-sample an evaluated spine the way the recorded mouse strokes are
 * sampled: a hand's cadence, not the geometry walk's. The step varies with
 * the path's own turning angle (slow into corners) plus a deterministic drift,
 * and the first / last points are exact. The stroke stores these points, so the
 * replay's tick count (its wet lifetime) follows the same law at commit and at
 * every re-derivation.
 */
export function resampleVectorPaintPoints(points: readonly Vec2[]): readonly Vec2[] {
  if (points.length <= 2) return [...points];
  const stations: number[] = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const point = points[index]!;
    stations.push(stations[index - 1]! + Math.hypot(point.x - previous.x, point.y - previous.y));
  }
  const total = stations[stations.length - 1]!;
  if (!(total > 0)) return [...points];
  const turnLoad = vectorSpineTurnLoad(points);
  const phase = vectorSpinePressurePhase(points);
  const pointAt = (distance: number): Vec2 => {
    if (distance <= 0) return { ...points[0]! };
    if (distance >= total) return { ...points[points.length - 1]! };
    let low = 0;
    let high = stations.length - 1;
    while (low + 1 < high) {
      const middle = (low + high) >> 1;
      if (stations[middle]! <= distance) low = middle;
      else high = middle;
    }
    const fromStation = stations[low]!;
    const span = stations[high]! - fromStation;
    const t = span > 0 ? (distance - fromStation) / span : 0;
    const from = points[low]!;
    const to = points[high]!;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  };
  const resampled: Vec2[] = [pointAt(0)];
  let travelled = 0;
  while (travelled < total && resampled.length < 20000) {
    const u = travelled / total;
    const localTurn = turnLoad[Math.min(turnLoad.length - 1, Math.round(u * (turnLoad.length - 1)))] ?? 0;
    let drift = 1;
    for (let term = 0; term < VECTOR_PAINT_STEP_DRIFT.length; term += 1) {
      const { cycles, amplitude } = VECTOR_PAINT_STEP_DRIFT[term]!;
      drift += amplitude * Math.sin(2 * Math.PI * (cycles * u + phase * (term + 1)));
    }
    const step = Math.min(
      VECTOR_PAINT_STEP_MAX_UV,
      Math.max(
        VECTOR_PAINT_STEP_MIN_UV,
        VECTOR_PAINT_SAMPLE_STEP_UV * (1 - VECTOR_PAINT_STEP_TURN_SLOWDOWN * localTurn) * drift,
      ),
    );
    travelled += step;
    resampled.push(pointAt(Math.min(total, travelled)));
  }
  return resampled;
}

/**
 * Per-sample "the hand was slow here" in [0, 1], from the path's own turning
 * angle: the angle between the chords entering and leaving each sample, read
 * over a window and then spread across its neighbours. Pure geometry — no
 * seed, no timing — so the same path always yields the same profile. Both
 * windows scale with the sample count, so a short path is not swallowed whole
 * by a single corner.
 */
function vectorSpineTurnLoad(points: readonly { x: number; y: number }[]): number[] {
  const count = points.length;
  const turn = new Array<number>(count).fill(0);
  if (count < 3) return turn;
  const window = Math.max(2, Math.min(8, Math.round(count * 0.032)));
  const spreadRadius = Math.max(2, Math.min(24, Math.round(count * 0.096)));
  for (let index = 0; index < count; index += 1) {
    const before = points[Math.max(0, index - window)]!;
    const here = points[index]!;
    const after = points[Math.min(count - 1, index + window)]!;
    const ax = here.x - before.x;
    const ay = here.y - before.y;
    const bx = after.x - here.x;
    const by = after.y - here.y;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la <= 0 || lb <= 0) continue;
    const cosine = Math.min(1, Math.max(-1, (ax * bx + ay * by) / (la * lb)));
    turn[index] = Math.acos(cosine) / (Math.PI / 2);
  }
  const spread = new Array<number>(count).fill(0);
  for (let index = 0; index < count; index += 1) {
    let sum = 0;
    let hits = 0;
    for (let offset = -spreadRadius; offset <= spreadRadius; offset += 1) {
      const peer = index + offset;
      if (peer < 0 || peer >= count) continue;
      sum += turn[peer]!;
      hits += 1;
    }
    spread[index] = hits === 0 ? 0 : Math.min(1, sum / hits);
  }
  return spread;
}

/**
 * A stable per-path phase in [0, 1) — the path's OWN geometry seeds it, so the
 * same path always re-derives the same profile. Time would reshuffle the
 * stroke on every reopen/edit; geometry cannot.
 */
function vectorSpinePressurePhase(points: readonly { x: number; y: number }[]): number {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return 0;
  const raw = Math.sin(first.x * 12.9898 + first.y * 78.233 + last.x * 37.719 + last.y * 43.313) * 43758.5453;
  return raw - Math.floor(raw);
}

/**
 * The per-sample pressure a vector stroke is recorded with.
 *
 * A mouse records the pressure sentinel, and the engine derives pressure from
 * the sample spacing (the hand's speed). A vector stroke is built the same
 * way: paint-sampled at the hand's cadence, so its samples ARE a mouse
 * stroke's samples and the engine's own law produces the pressure — no
 * invented band. The probe's real-data A/B is the pin: peak ink 115.8 vs the
 * hand's 117.4, core width 114.6 vs 120.1 px, halo 188.9 vs 186.4 px.
 */
export function vectorSpinePressures(
  points: readonly { x: number; y: number }[],
): readonly number[] {
  if (points.length === 0) return [];
  return points.map(() => VECTOR_PRESSURE_SENTINEL);
}

/**
 * The pure half of the layer's commit seam: a finished path plus its
 * record-time source becomes a complete `AquarelleStroke`. Every required
 * field is written explicitly — anchors and curveMode are the vector-half's
 * contribution, the rest come from the same `snapshotAquarelleRecord()` /
 * selection expressions the hand-painted `onStrokeEnd` literal already uses.
 * The path is PAINT-sampled (not geometry-sampled) and those samples carry
 * the natural pen profile and no tilt.
 */
export function buildVectorStroke(
  commit: VectorPathCommit,
  source: VectorStrokeSource,
): AquarelleStroke {
  const paintPoints = resampleVectorPaintPoints(commit.points);
  const pressures = vectorSpinePressures(paintPoints);
  return {
    tool: source.tool,
    color: source.color,
    params: { ...source.params },
    brushId: source.brushId,
    ...recordedCurveModeField(commit.curveMode),
    anchors: [...commit.anchors],
    points: paintPoints.map((point, index) => ({
      x: point.x,
      y: point.y,
      p: pressures[index] ?? VECTOR_STROKE_BASE_PRESSURE,
      tx: 0,
      ty: 0,
      tw: 0,
    })),
    toolOverrides: { ...source.toolOverrides },
    diffusionFrames: source.diffusionFrames,
    timestamp: source.timestamp,
    playFrame: source.playFrame,
  };
}
