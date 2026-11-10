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
  clampAnchorWidth,
  isUniformWidthProfile,
  normaliseVectorAnchors,
  resolveAnchorHandles,
  sampleVectorPath,
  sampleVectorWidths,
  type AquarelleRenderMode,
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

/** What the overlay hands the Studio seam when a path is finished. */
export interface VectorPathCommit {
  readonly anchors: readonly VectorAnchor[];
  readonly renderMode: AquarelleRenderMode;
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
 */
export function hitTestVectorPath(
  anchors: readonly VectorAnchor[],
  handles: readonly ResolvedAnchorHandles[],
  pointerUv: Vec2,
  width: number,
  height: number,
  scale: number,
): VectorHitTarget | null {
  const pointer = uvToScreen(pointerUv, width, height);
  if (!Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return null;
  const zoom = finiteScale(scale);
  const anchorRadiusPx = ANCHOR_HIT_PAD_PX + ANCHOR_BODY_PX / 2;
  const handleRadiusPx = ANCHOR_HIT_PAD_PX + HANDLE_BODY_PX / 2;

  let bestHandle: VectorHitTarget | null = null;
  let bestHandleDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < anchors.length; index += 1) {
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
 * document — T-61-28).
 */
export function buildDraftPath(draftAnchors: readonly VectorAnchor[]): DraftVectorPath {
  const anchors = normaliseVectorAnchors(draftAnchors);
  if (anchors.length === 0) return { anchors: [], points: [] };
  const { points } = sampleVectorPath(anchors);
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
 */
export function projectVectorPath(
  anchors: readonly VectorAnchor[],
  width: number,
  height: number,
): VectorPathProjection {
  const normalised = normaliseVectorAnchors(anchors);
  if (normalised.length === 0) return { anchors: [], spine: [], widths: [], envelope: [] };
  const { points } = sampleVectorPath(normalised);
  if (points.length === 0) return { anchors: [], spine: [], widths: [], envelope: [] };
  const spine = points.map((point) => uvToScreen(point, width, height));
  const widths = sampleVectorWidths(normalised, points);
  const envelope = isUniformWidthProfile(normalised) ? [] : buildEnvelope(spine, widths, height);
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
 */
export function promoteAnchorForDrag(
  anchors: readonly VectorAnchor[],
  index: number,
): readonly VectorAnchor[] {
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

// --- Insert on a segment (61-10 Task 2) -----------------------------------

/**
 * Insert one `auto` anchor between the two anchors of `segmentIndex`. The
 * click is projected onto the chord to find its station, then the evaluated
 * curve is sampled at that station so the new anchor sits ON the path the
 * user clicked — never off the chord's straight line. Its handles are not
 * stored: re-resolving the list derives them like every other `auto` anchor
 * (D-03's counter-case: a new anchor starts unowned). The input list is never
 * mutated and untouched anchors are carried by reference.
 */
export function insertAnchorOnSegment(
  anchors: readonly VectorAnchor[],
  segmentIndex: number,
  pointUv: Vec2,
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
  const handles = resolveAnchorHandles(normalised);
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

// --- The commit's stroke half --------------------------------------------

/**
 * The pure half of the layer's commit seam: a finished path plus its
 * record-time source becomes a complete `AquarelleStroke`. Every required
 * field is written explicitly — anchors and renderMode are the vector-half's
 * contribution, the rest come from the same `snapshotAquarelleRecord()` /
 * selection expressions the hand-painted `onStrokeEnd` literal already uses.
 * Sampled spine points carry full pressure and no tilt: the width profile,
 * not pressure, shapes a vector stroke.
 */
export function buildVectorStroke(
  commit: VectorPathCommit,
  source: VectorStrokeSource,
): AquarelleStroke {
  return {
    tool: source.tool,
    color: source.color,
    params: { ...source.params },
    brushId: source.brushId,
    renderMode: commit.renderMode,
    anchors: [...commit.anchors],
    points: commit.points.map((point) => ({
      x: point.x,
      y: point.y,
      p: 1,
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
