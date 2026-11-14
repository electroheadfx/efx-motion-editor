// ============================================================
//  VectorPathOverlay — the vector draw surface (61-09, VEC-01 /
//  VEC-07).
//
//  Scoped by the 61-08 session signals: the pen latch
//  (`vectorPenActive`) opens the draw surface; an open path edit
//  (`pathEditMutationId`) instead owns the surface for anchor
//  editing (D-06 — the two states are mutually exclusive). Every
//  recorded vector stroke of the edit frame draws its spine, its
//  width envelope and one marker per anchor; a draft draws the
//  same geometry while it is being placed.
//
//  AUTHORITY BOUNDARY (T-61-31): the overlay owns GESTURE ONLY.
//  It never bakes, never records and never imports an engine or
//  adapter module. A finished path leaves as ONE
//  `VectorPathCommit`; AquarelleCanvasLayer assembles the stroke
//  and forwards it to the ONE existing stroke-end seam, so a
//  vector stroke costs exactly one revision bump — the same cost
//  as a hand-painted one. A completed path EDIT likewise leaves
//  as ONE `onPathEdit(mutationId, anchors)` call; the Studio owns
//  the history entry and the refusal (61-10).
//
//  62-03 (D-06): an armed curve-bracket fit is the PRE-CONVERSION
//  edit target — an anchorless painted stroke draws and edits
//  through the held anchors until a committed gesture writes them
//  to the record. The session is read-only here: ONE render-body
//  read of `curveFitSession`, `.peek()` in the Delete seam. The
//  target's mode is `resolveAquarelleCurveMode(stroke.curveMode)`
//  for BOTH anchor sources — never the draw-time mint.
//
//  GEOMETRY: every curve, handle and width factor comes from the
//  61-02 spine module through `vectorPathHandles`; every chrome
//  size is a SCREEN-pixel constant counter-scaled by the effective
//  zoom (the shipped `scriptStrokeTransform` law).
//
//  Preact reactivity: module signals, `.peek()` in handlers, no
//  render-body signal writes, effect only for the key listener
//  (`efx-preact-reactivity`).
// ============================================================

import { signal } from '@preact/signals';
import type { JSX, TargetedPointerEvent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import {
  DEFAULT_AQUARELLE_CURVE_MODE,
  clampAnchorWidth,
  normaliseVectorAnchors,
  resolveAnchorHandles,
  resolveAquarelleCurveMode,
  resolveCurveAnchors,
  sampleVectorPath,
  type AquarelleCurveMode,
  type AquarelleStroke,
  type ResolvedAnchorHandles,
  type Vec2,
  type VectorAnchor,
} from '@efxlab/efx-watercolor/payload';
import { aquarelleStrokesRevision, isAquarelleStrokeDeleted } from '../view/aquarelleRecordState';
import { physicsPaintCanvasZoom } from '../view/physicsPaintCanvasZoom';
import { strokeSizePreview, wireframeMode } from '../view/scriptStrokeEdition';
import { isKeyboardOwnedTarget } from '../view/shortcutTextTarget';
import type { CanvasPoint } from '../view/scriptStrokeEdition';
import {
  ANCHOR_BODY_PX,
  ANCHOR_CORE_RADIUS_PX,
  ANCHOR_HIT_PAD_PX,
  DEFAULT_VECTOR_PATH_CURVE_MODE,
  DRAG_THRESHOLD_PX,
  FIRST_ANCHOR_HIT_PX,
  HANDLE_BODY_PX,
  VECTOR_ENVELOPE_BASE_UV,
  buildDraftPath,
  deleteAnchorsAt,
  hitTestVectorPath,
  insertAnchorOnSegment,
  isAdjacentToLast,
  moveAnchorBy,
  moveHandleTo,
  pointToSegmentDistancePx,
  projectVectorPath,
  promoteAnchorForDrag,
  screenToUv,
  selectAnchor,
  toggleAnchorCorner,
  uvToScreen,
  type VectorPathCommit,
  type VectorPathProjection,
} from '../view/vectorPathHandles';
import {
  appendVectorDraftAnchor,
  clearVectorAnchorSelection,
  clearVectorDraft,
  moveVectorDraftCursor,
  pathEditMutationId,
  setVectorAnchorSelection,
  vectorAnchorSelection,
  vectorDrawDraft,
  vectorPenActive,
  type VectorDrawDraft,
  type VectorDraftAnchor,
} from '../view/vectorPathSession';
import { curveFitSession } from '../view/vectorPathCurveBracket';

// --- The overlay's one palette -------------------------------------------

/** Selected-path accent — the same `#38bdf8` the shipped select overlay uses. */
const SELECTED_SPINE_COLOR = '#38bdf8';
const OUTLINE_DARK = '#111111';
const OUTLINE_LIGHT = '#ffffff';
/** User-owned control (a bezier anchor and its handles) — the 26102x accent. */
const OWNED_CONTROL_COLOR = '#f59e0b';
/**
 * 261112-i6d: the selected VERTEX accent — orange, the one colour that reads
 * over orange paint because it is carried by a dark halo and a soft glow
 * (three layered strokes, never an SVG filter).
 */
const SELECTED_ANCHOR_COLOR = '#f97316';
/** The handle CONNECTOR's opacity — the dot itself stays solid (§6 item 5). */
const HANDLE_OPACITY = 0.6;
const SPINE_STROKE_PX = 1.5;

/** Immediately above the stroke overlay (40), below the brush cursor (50). */
const VECTOR_PATH_Z_INDEX = 41;

/** What the overlay hands the layer when a path is finished. */
export interface VectorPathGestureHandlers {
  readonly onCommitPath: (commit: VectorPathCommit) => void;
  readonly onCancelPath: () => void;
}

export interface VectorPathOverlayProps {
  width: number;
  height: number;
  getPlayFrame: () => number;
  getRecordedStrokes: () => ReadonlyMap<number, AquarelleStroke>;
  onCommitPath: (commit: VectorPathCommit) => void;
  onCancelPath: () => void;
  /**
   * 61-10: one completed path-edit gesture. The overlay hands the numeric
   * mutationId and the FULL next anchor list; history and the refusal live in
   * the Studio (the overlay never imports a record or selection module).
   */
  onPathEdit: (mutationId: number, anchors: readonly VectorAnchor[]) => void;
}

/**
 * The live anchor-drag preview. Gesture-local display state written ONLY by
 * the pointer handlers and cleared BEFORE the commit runs (the T-61-30
 * clear-before-commit law), so a same-tick repeat gesture finds nothing. This
 * leaf's render body is the only subscriber.
 */
export const vectorPathEditDrag = signal<{
  readonly mutationId: number;
  readonly anchors: readonly VectorAnchor[];
} | null>(null);

/** One in-flight anchor drag (path edit): where it started and its latest list. */
interface AnchorDragState {
  readonly kind: 'anchor';
  readonly mutationId: number;
  readonly index: number;
  readonly startUv: Vec2;
  readonly anchorsAtStart: readonly VectorAnchor[];
  readonly wasPromoted: boolean;
  /** 61-16: the pointer this drag captured, released when the drag ends. */
  readonly pointerId: number;
  moved: boolean;
  latest: readonly VectorAnchor[];
}

/** One in-flight handle drag: the endpoint follows the pointer absolutely. */
interface HandleDragState {
  readonly kind: 'handle';
  readonly mutationId: number;
  readonly index: number;
  readonly side: 'in' | 'out';
  readonly anchorsAtStart: readonly VectorAnchor[];
  /** 61-16: the pointer this drag captured, released when the drag ends. */
  readonly pointerId: number;
  moved: boolean;
  latest: readonly VectorAnchor[];
}

type PathEditDragState = AnchorDragState | HandleDragState;

/**
 * The optional pointer-capture capability a drag target carries. Nothing here
 * assumes the methods exist: a detached or non-element target has none, and a
 * capture call must never throw into a gesture (T-61-57).
 */
interface PointerCaptureTarget {
  setPointerCapture?(pointerId: number): void;
  releasePointerCapture?(pointerId: number): void;
  hasPointerCapture?(pointerId: number): boolean;
}

/**
 * Capture the pointer for the lifetime of a drag. Without it a pointermove or
 * pointerup that lands outside the overlay is delivered elsewhere and the edit
 * is stranded mid-gesture (CR-01). A detached target cannot capture; the drag
 * keeps working in place.
 */
function capturePointer(
  target: PointerCaptureTarget | null | undefined,
  pointerId: number,
): void {
  if (target === null || target === undefined) return;
  if (typeof target.setPointerCapture !== 'function') return;
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // A target that cannot capture still receives in-overlay events.
  }
}

/**
 * Release a capture only when the target still holds it. Releasing a pointer
 * the element no longer holds is an error in the pointer-events spec, so the
 * `hasPointerCapture` answer is honoured when the target can give one; a
 * missing method or a throwing target is swallowed — the release is cleanup,
 * never part of the edit.
 */
export function releasePointerCapture(
  target: PointerCaptureTarget | null | undefined,
  pointerId: number,
): void {
  if (target === null || target === undefined) return;
  if (typeof target.releasePointerCapture !== 'function') return;
  try {
    if (target.hasPointerCapture?.(pointerId) === false) return;
    target.releasePointerCapture(pointerId);
  } catch {
    // The pointer is already gone; there is nothing left to release.
  }
}

/** One path the overlay draws: its anchors, resolved handles and projection. */
interface DrawnVectorPath {
  readonly key: string;
  readonly anchors: readonly VectorAnchor[];
  /** 61-31 (G-20): the mode this path is drawn and edited through. */
  readonly curveMode: AquarelleCurveMode;
  readonly handles: readonly ResolvedAnchorHandles[];
  readonly projection: VectorPathProjection;
  /** 61-13: the recorded stroke's own colour; null for the pen draft. */
  readonly color: string | null;
  /** 61-13: the live target (open path edit / pen draft) wears louder chrome. */
  readonly selected: boolean;
}

function finiteScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * 261112-n3f: the ONE envelope mask id per drawn path. `drawn.key` is
 * `stroke-<mutationId>` or `draft`, and exactly one overlay mounts per
 * document, so the id is deterministic and unique without a counter or a
 * hook. Every character outside the attribute charset is reduced to `-`, so
 * no key can break the `id` or its `url(#…)` reference (T-261112-n3f-01).
 */
function envelopeMaskId(key: string): string {
  return `vector-envelope-mask-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

// --- Finish / cancel ------------------------------------------------------

/**
 * Finish the draft. The draft is cleared BEFORE `onCommitPath` runs, so a
 * same-tick second Enter / double-click finds no draft and commits nothing
 * (T-61-30). A zero- or one-anchor draft is dropped without a commit — a
 * path needs two anchors to exist.
 */
export function finishVectorPath(handlers: VectorPathGestureHandlers): void {
  const draft = vectorDrawDraft.peek();
  if (draft === null) return;
  const anchors = draft.anchors;
  clearVectorDraft();
  if (anchors.length < 2) return;
  // G-20: the path is sampled AND recorded in the draw default — the stroke
  // the user sees while drafting is the stroke that is committed.
  const curveMode = DEFAULT_VECTOR_PATH_CURVE_MODE;
  const { anchors: normalised, points } = buildDraftPath(anchors, curveMode);
  if (normalised.length < 2 || points.length === 0) return;
  handlers.onCommitPath({
    anchors: normalised,
    curveMode,
    points,
  });
}

/** Drop the draft and tell the layer — zero commits. */
export function cancelVectorPath(handlers: VectorPathGestureHandlers): void {
  clearVectorDraft();
  handlers.onCancelPath();
}

/**
 * The overlay's key law: Enter finishes, Escape cancels. A missing draft
 * swallows nothing, so the Studio keeps its own shortcuts when no vector
 * path is in progress.
 */
export function handleVectorPathKey(
  event: {
    readonly key?: string;
    preventDefault?: () => void;
    stopPropagation?: () => void;
  },
  handlers: VectorPathGestureHandlers,
): void {
  const key = event.key;
  if (key !== 'Enter' && key !== 'Escape') return;
  if (vectorDrawDraft.peek() === null) return;
  event.preventDefault?.();
  event.stopPropagation?.();
  if (key === 'Enter') finishVectorPath(handlers);
  else cancelVectorPath(handlers);
}

/** What the Delete/Backspace edit key needs from its host (61-10). */
export interface VectorPathEditKeyHandlers {
  readonly getRecordedStrokes: () => ReadonlyMap<number, AquarelleStroke>;
  readonly onPathEdit: (mutationId: number, anchors: readonly VectorAnchor[]) => void;
  /**
   * 62-03 (D-06): the held fit is the anchor source while the record still
   * carries none — a pre-conversion painted stroke. The host answers with the
   * curve session's fit for the open edit's id, or null. Read at event time,
   * so this seam never subscribes to the session signal.
   */
  readonly getHeldFit?: (
    editMutationId: string,
  ) => { readonly mutationId: number; readonly anchors: readonly VectorAnchor[] } | null;
  /**
   * 61 CR-01 (residual): end any in-flight drag BEFORE this key's write lands.
   * A drag commits `anchorsAtStart` on release, so a Delete that arrives
   * mid-gesture would otherwise be undone by the pointerup.
   */
  readonly cancelActiveDrag?: () => void;
}

/**
 * The open path edit's Delete/Backspace law: remove every selected anchor
 * through `deleteAnchorsAt` and leave the whole next list in ONE
 * `onPathEdit`. The selection is cleared BEFORE the commit (the T-61-30
 * clear-before-commit law), so a same-tick repeat finds nothing. Every other
 * key is left to the Studio — the overlay swallows only what it owns.
 */
export function handleVectorPathEditKey(
  event: { readonly key?: string; preventDefault?: () => void; stopPropagation?: () => void },
  handlers: VectorPathEditKeyHandlers,
): void {
  const key = event.key;
  if (key !== 'Delete' && key !== 'Backspace') return;
  const editMutationId = pathEditMutationId.peek();
  if (editMutationId === null) return;
  const selection = vectorAnchorSelection.peek();
  if (selection.length === 0) return;
  let targetMutationId: number | null = null;
  let targetAnchors: readonly VectorAnchor[] | null = null;
  for (const [mutationId, stroke] of handlers.getRecordedStrokes()) {
    if (String(mutationId) !== editMutationId) continue;
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    const recordAnchors = stroke.anchors;
    if (recordAnchors !== undefined && recordAnchors.length > 0) {
      targetMutationId = mutationId;
      targetAnchors = recordAnchors;
      break;
    }
    // 62-03 (D-06): a pre-conversion painted stroke has no record anchors
    // until the first committed gesture; the held fit is the Delete source.
    const held = handlers.getHeldFit?.(editMutationId) ?? null;
    if (held !== null && held.mutationId === mutationId && held.anchors.length > 0) {
      targetMutationId = mutationId;
      targetAnchors = held.anchors;
    }
    break;
  }
  if (targetMutationId === null || targetAnchors === null) return;
  const next = deleteAnchorsAt(targetAnchors, selection);
  if (next.length === targetAnchors.length) return;
  event.preventDefault?.();
  event.stopPropagation?.();
  clearVectorAnchorSelection();
  // 61 CR-01 (residual): the delete lands first, so the gesture that was
  // holding `anchorsAtStart` must not survive to re-commit it on release.
  handlers.cancelActiveDrag?.();
  handlers.onPathEdit(targetMutationId, next);
}

/**
 * The window listener's dispatcher (61-16 / G-4). The listener is bound in the
 * CAPTURE phase on `window`, so it sees keystrokes aimed at a focused dialog
 * field before that field does. A text-entry target stands both key handlers
 * down — nothing is consumed and nothing is prevented, so Enter submits the
 * dialog and Delete edits the text. Every other target gets the two pure,
 * target-agnostic handlers exactly as before.
 */
export function handleVectorPathWindowKey(
  event: {
    readonly key?: string;
    readonly target?: unknown;
    preventDefault?: () => void;
    stopPropagation?: () => void;
  },
  draftHandlers: VectorPathGestureHandlers,
  editHandlers: VectorPathEditKeyHandlers,
): void {
  if (isKeyboardOwnedTarget(event.target)) return;
  handleVectorPathKey(event, draftHandlers);
  handleVectorPathEditKey(event, editHandlers);
}

// --- Drawing --------------------------------------------------------------

function drawnPathOf(
  key: string,
  anchors: readonly VectorAnchor[],
  width: number,
  height: number,
  options: {
    readonly alwaysEnvelope?: boolean;
    readonly color?: string | null;
    readonly selected?: boolean;
    readonly curveMode?: AquarelleCurveMode;
  } = {},
): DrawnVectorPath | null {
  const normalised = normaliseVectorAnchors(anchors);
  if (normalised.length === 0) return null;
  // 61-31 (G-20): one path's chrome and geometry always agree — the mode view
  // feeds the handle resolve AND the projection. An absent mode reads Bézier,
  // so every pre-existing path draws exactly as before (REL-02).
  const curveMode = options.curveMode ?? DEFAULT_AQUARELLE_CURVE_MODE;
  return {
    key,
    anchors: normalised,
    curveMode,
    handles: resolveAnchorHandles(resolveCurveAnchors(normalised, curveMode)),
    projection: projectVectorPath(normalised, width, height, {
      alwaysEnvelope: options.alwaysEnvelope === true,
      curveMode,
    }),
    color: options.color ?? null,
    selected: options.selected === true,
  };
}

/**
 * 61-21 (IN-01): the provisional rubber-band polyline, in layer pixels. It
 * appends a transient `auto` station at the draft cursor, samples the ONE spine
 * module and screen-projects the samples — never through `renderPath`, so the
 * preview adds no marker, no handle and no envelope, and never touches
 * `DrawnVectorPath`. Construction chrome: it stays visible in wireframe too.
 */
function draftPreviewPointsOf(
  draft: VectorDrawDraft | null,
  width: number,
  height: number,
): string | null {
  if (draft === null || draft.cursor === null || draft.anchors.length === 0) return null;
  const cursor = draft.cursor;
  // Same evaluation view the finished path is sampled through, so the rubber
  // band never disagrees with the stroke Enter commits (G-20).
  const { points } = sampleVectorPath(resolveCurveAnchors([
    ...draft.anchors,
    { x: cursor.x, y: cursor.y, kind: 'auto' },
  ], DEFAULT_VECTOR_PATH_CURVE_MODE));
  if (points.length === 0) return null;
  return points
    .map((point) => {
      const at = uvToScreen(point, width, height);
      return `${at.x},${at.y}`;
    })
    .join(' ');
}

/**
 * One path's SVG group, in the UI-SPEC order: envelope → spine → rungs →
 * anchors → handles. Marker extents are screen-pixel constants divided by the
 * effective zoom, so the chrome keeps its screen size at every zoom.
 *
 * The editing chrome is unchanged (61-09/61-10). `wireframe` (61-13) swaps it
 * for the construction view: the spine becomes a two-pass dark/light line (or
 * the accent for the live target), rungs appear ONLY at anchors carrying an
 * explicit width factor, and every marker wears the dark hairline instead of
 * the light one.
 *
 * 261112-n3f: the editing chrome draws the width envelope ONLY while the
 * shared "Preview stroke size" switch is on (`preview`) — opening a path edit
 * or storing a non-uniform profile no longer draws one by itself. The
 * wireframe is still the unconditional construction view (`alwaysEnvelope`),
 * so it paints the envelope whatever the switch says (61-13).
 *
 * Both branches paint the envelope per the colour table's band law (61-25
 * UI-03) as TWO nodes: an UNMASKED fill carrying the stroke's own colour at
 * 0.14/0.07 (the wash survives), plus a MASKED edge at the doubled authored
 * width, so the VISIBLE edge stays at 3.5 selected / 1.5 unselected.
 */
function renderPath(
  drawn: DrawnVectorPath,
  scale: number,
  width: number,
  height: number,
  wireframe: boolean,
  preview: boolean,
  selectedAnchors: readonly number[],
): JSX.Element {
  const { anchors, handles, projection, color, selected, curveMode } = drawn;
  // 61-31 (G-20) — ownership decides the shape (61-UI-SPEC §340-341): the amber
  // square marks a control the user OWNS. Under Spline every tangent is
  // derived, so no anchor owns one; the derived handles of a stored `bezier`
  // anchor are not controls, and neither a square nor a dot may imply
  // otherwise. Under Bézier both branches are the shipped ones, unchanged.
  const spline = curveMode === 'spline';
  const ownsHandles = (anchor: VectorAnchor): boolean => !spline && anchor.kind === 'bezier';
  const spinePoints = projection.spine.map((point) => `${point.x},${point.y}`).join(' ');
  const envelope = projection.envelope.length < 3
    ? null
    : `M${projection.envelope.map((point) => `${point.x},${point.y}`).join(' L')} Z`;
  const anchorSizePx = ANCHOR_BODY_PX / scale;
  const coreRadiusPx = ANCHOR_CORE_RADIUS_PX / scale;
  const handleRadiusPx = HANDLE_BODY_PX / 2 / scale;
  // 61-25 (UI-03): BOTH envelope branches follow the colour table's band law —
  // the stroke's own colour (the pen draft has none, so it falls back to the
  // vector accent), fill 0.14 selected / 0.07 unselected, edge 3.5 / 1.5, and
  // no extra stroke opacity.
  const envelopeColor = color ?? SELECTED_SPINE_COLOR;
  const markerStroke = wireframe ? OUTLINE_DARK : OUTLINE_LIGHT;
  // 261112-n3f: the ONE preview gate. The wireframe keeps its unconditional
  // construction envelope; the editing chrome shows it only on the switch.
  const showEnvelope = wireframe || preview;
  const maskId = envelopeMaskId(drawn.key);

  return (
    <g key={drawn.key}>
      {envelope === null || !showEnvelope ? null : (
        <>
          {/* 261112-n3f: the mask is built from the SAME closed ring the fill
              paints, so only the outline survives. The ring is
              self-intersecting by construction (`buildEnvelope`), and its
              stroke is what painted the crossing straight lines inside the
              band; masking removes them (no polygon union, no SVG filter —
              this file's own law). */}
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={width}
              height={height}
            >
              <rect x={0} y={0} width={width} height={height} fill="white" />
              {/* Black = hidden; the default nonzero rule matches the fill. */}
              <path d={envelope} fill="black" />
            </mask>
          </defs>
          {/* The fill is NEVER masked — masking it would erase the wash. */}
          <path
            data-testid="vector-path-envelope"
            d={envelope}
            fill={envelopeColor}
            fillOpacity={selected ? 0.14 : 0.07}
          />
          {/* The edge is the ONLY masked node. An SVG stroke straddles the
              path, and the mask hides the half that falls inside the filled
              band, so the authored width is DOUBLED to keep the VISIBLE edge
              at the 61-25 band law's 3.5 selected / 1.5 unselected. */}
          <path
            data-testid="vector-path-envelope-edge"
            d={envelope}
            fill="none"
            stroke={envelopeColor}
            strokeWidth={(selected ? 3.5 : 1.5) * 2}
            vectorEffect="non-scaling-stroke"
            mask={`url(#${maskId})`}
          />
        </>
      )}
      {wireframe ? (
        selected ? (
          <polyline
            data-testid="vector-path-spine"
            points={spinePoints}
            fill="none"
            stroke={SELECTED_SPINE_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <>
            <polyline
              points={spinePoints}
              fill="none"
              stroke={OUTLINE_DARK}
              strokeWidth={2}
              opacity={0.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              data-testid="vector-path-spine"
              points={spinePoints}
              fill="none"
              stroke={OUTLINE_LIGHT}
              strokeWidth={1}
              opacity={0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )
      ) : (
        <>
          <polyline
            points={spinePoints}
            fill="none"
            stroke={OUTLINE_DARK}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            data-testid="vector-path-spine"
            points={spinePoints}
            fill="none"
            stroke={SELECTED_SPINE_COLOR}
            strokeWidth={SPINE_STROKE_PX}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      {wireframe
        ? projection.anchors.map((point, index) => {
          const anchor = anchors[index];
          // D-10/D-15: a rung exists ONLY where the anchor carries an
          // explicit width factor — the sparse representation made visible.
          if (anchor === undefined || anchor.width === undefined) return null;
          const before = projection.anchors[Math.max(0, index - 1)] ?? point;
          const after = projection.anchors[Math.min(projection.anchors.length - 1, index + 1)] ?? point;
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
          // The rung spans the envelope's local cross-section: the same base
          // half-width the envelope sweep uses, at this anchor's factor.
          const half = VECTOR_ENVELOPE_BASE_UV * height * clampAnchorWidth(anchor.width);
          const offsetX = -ty * half;
          const offsetY = tx * half;
          return (
            <g key={`rung-${index}`} data-testid="vector-path-rung">
              <line
                x1={point.x - offsetX}
                y1={point.y - offsetY}
                x2={point.x + offsetX}
                y2={point.y + offsetY}
                stroke={OUTLINE_DARK}
                strokeWidth={1.5}
                opacity={0.55}
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={point.x - offsetX}
                y1={point.y - offsetY}
                x2={point.x + offsetX}
                y2={point.y + offsetY}
                stroke={OUTLINE_LIGHT}
                strokeWidth={1}
                opacity={0.9}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })
        : null}
      {projection.anchors.map((point, index) => {
        const anchor = anchors[index];
        if (anchor === undefined) return null;
        return ownsHandles(anchor) ? (
          <rect
            key={`anchor-${index}`}
            data-testid="vector-path-anchor"
            x={point.x - anchorSizePx / 2}
            y={point.y - anchorSizePx / 2}
            width={anchorSizePx}
            height={anchorSizePx}
            fill={OWNED_CONTROL_COLOR}
            stroke={markerStroke}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <circle
            key={`anchor-${index}`}
            data-testid="vector-path-anchor"
            cx={point.x}
            cy={point.y}
            r={coreRadiusPx}
            fill={SELECTED_SPINE_COLOR}
            stroke={markerStroke}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {/* 61-22 (G-11): the missing feedback for `vectorAnchorSelection` — one
          accent ring per selected index, drawn over the anchor marker. The
          index space is `drawnPathOf`'s normalised anchor list, the same list
          the selection was resolved from; a missing point fails closed. */}
      {selectedAnchors.map((index) => {
        const anchor = anchors[index];
        const point = projection.anchors[index];
        if (anchor === undefined || point === undefined) return null;
        // 61-31 (G-20): the chrome mirrors the marker's shape, so under Spline it
        // is a circle around the circle — never a square implying ownership.
        // 261112-i6d: THREE layered strokes per selected index — a soft glow
        // over a dark contrast halo over the crisp orange ring — so the vertex
        // reads over orange paint while every stroke stays screen-constant
        // (`vectorEffect`). No SVG filter: the layers cost nothing at 60fps.
        return ownsHandles(anchor) ? (
          <g key={`anchor-selection-${index}`}>
            <rect
              data-testid="vector-path-anchor-selection-glow"
              x={point.x - (anchorSizePx + 6) / 2}
              y={point.y - (anchorSizePx + 6) / 2}
              width={anchorSizePx + 6}
              height={anchorSizePx + 6}
              fill="none"
              stroke={SELECTED_ANCHOR_COLOR}
              strokeWidth={8}
              opacity={0.35}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              data-testid="vector-path-anchor-selection-halo"
              x={point.x - (anchorSizePx + 6) / 2}
              y={point.y - (anchorSizePx + 6) / 2}
              width={anchorSizePx + 6}
              height={anchorSizePx + 6}
              fill="none"
              stroke={OUTLINE_DARK}
              strokeWidth={4}
              opacity={0.85}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              data-testid="vector-path-anchor-selection"
              x={point.x - (anchorSizePx + 6) / 2}
              y={point.y - (anchorSizePx + 6) / 2}
              width={anchorSizePx + 6}
              height={anchorSizePx + 6}
              fill="none"
              stroke={SELECTED_ANCHOR_COLOR}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : (
          <g key={`anchor-selection-${index}`}>
            <circle
              data-testid="vector-path-anchor-selection-glow"
              cx={point.x}
              cy={point.y}
              r={coreRadiusPx + 3}
              fill="none"
              stroke={SELECTED_ANCHOR_COLOR}
              strokeWidth={8}
              opacity={0.35}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              data-testid="vector-path-anchor-selection-halo"
              cx={point.x}
              cy={point.y}
              r={coreRadiusPx + 3}
              fill="none"
              stroke={OUTLINE_DARK}
              strokeWidth={4}
              opacity={0.85}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              data-testid="vector-path-anchor-selection"
              cx={point.x}
              cy={point.y}
              r={coreRadiusPx + 3}
              fill="none"
              stroke={SELECTED_ANCHOR_COLOR}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {/* 61-31 (G-20): under Spline the entire handle block returns nothing —
          no stored handle is a user-owned control, so no dot is drawn
          (61-UI-SPEC §340-341 / T-61-92). */}
      {spline ? null : anchors.map((anchor, index) => {
        if (anchor.kind !== 'bezier') return null;
        const resolved = handles[index];
        const anchorPoint = projection.anchors[index];
        if (resolved === undefined || anchorPoint === undefined) return null;
        return (
          <g key={`handles-${index}`}>
            {(['in', 'out'] as const).map((side) => {
              const at = resolved[side];
              if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return null;
              const point = uvToScreen(at, width, height);
              return (
                <g key={side}>
                  <line
                    x1={anchorPoint.x}
                    y1={anchorPoint.y}
                    x2={point.x}
                    y2={point.y}
                    stroke={OWNED_CONTROL_COLOR}
                    strokeOpacity={HANDLE_OPACITY}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* 61-25 (UI-03 / §6 item 5): the dot is SOLID — only the
                      connector above carries the 0.6 opacity. */}
                  <circle
                    data-testid="vector-path-handle"
                    cx={point.x}
                    cy={point.y}
                    r={handleRadiusPx}
                    fill={OWNED_CONTROL_COLOR}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

// --- The component --------------------------------------------------------

export function VectorPathOverlay(props: VectorPathOverlayProps): JSX.Element | null {
  // Handlers ride a ref so the window listener always calls the latest pair.
  const handlersRef = useRef<VectorPathGestureHandlers>({
    onCommitPath: props.onCommitPath,
    onCancelPath: props.onCancelPath,
  });
  handlersRef.current = {
    onCommitPath: props.onCommitPath,
    onCancelPath: props.onCancelPath,
  };
  // The edit key's host seam rides its own ref, like the draft handlers above.
  // 61 CR-01 (residual): `.current` is assigned at the END of this body, after
  // `cancelEditDrag` exists — the seam needs it to end a drag the Delete lands
  // inside. The window listener below only reads the ref at event time.
  const editKeyHandlersRef = useRef<VectorPathEditKeyHandlers>({
    getRecordedStrokes: props.getRecordedStrokes,
    onPathEdit: props.onPathEdit,
    // 62-03 (D-06): `.peek()` because this seam reads at event time — the
    // held fit never becomes a subscription of the key handler.
    getHeldFit: (id) => {
      const fit = curveFitSession.peek();
      return fit !== null && String(fit.mutationId) === id
        ? { mutationId: fit.mutationId, anchors: fit.anchors }
        : null;
    },
  });
  // The in-flight anchor / handle drag (path edit). A ref so the pointer
  // handlers never re-render the surface mid-gesture; the visual preview
  // travels on a signal.
  const dragRef = useRef<PathEditDragState | null>(null);
  // 61-28 (CR-01): the overlay's own element. The edit-lifetime effect below
  // reaches the captured pointer through this ref — the pointer handlers that
  // would otherwise release it are unbound the moment the edit closes.
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  // Narrow reads: this leaf is the only subscriber to the session latches.
  const penActive = vectorPenActive.value;
  const editMutationId = pathEditMutationId.value;
  // The recorded registry is a non-reactive getter — this revision read is
  // what repaints the paths after a record / delete / key remap.
  void aquarelleStrokesRevision.value;
  // Counter-scaling law: screen-pixel chrome divides by the effective zoom.
  const scale = finiteScale(physicsPaintCanvasZoom.effectiveScale.value);
  const draft = vectorDrawDraft.value;
  const editDrag = vectorPathEditDrag.value;
  // 62-03 (D-06): the armed held fit — read ONCE here, this leaf being the
  // narrow subscriber. It is the pre-conversion edit target while the record
  // still carries no anchors for the painted stroke.
  const curveFit = curveFitSession.value;
  // 61-13 (D-16): the session-only wireframe latch. This leaf is the narrow
  // subscriber; the Studio never reads it in its own render body.
  const wireframe = wireframeMode.value;
  // 261112-n3f — the ONE "Preview stroke size" preference, read in this narrow
  // leaf (the only subscriber). Never written here, never read by the Studio
  // render body; the switch owns the vector width preview on every surface.
  const previewStrokeSize = strokeSizePreview.value;
  // 61-22 (G-11): the anchor selection is written by the path-edit pointer
  // handlers (through `.peek()`); this render-body read is the ONE subscriber
  // that turns it into visible chrome. Pure read: no write, no effect.
  const anchorSelection = vectorAnchorSelection.value;

  // Path edit (61-10): resolve the stroke the session names. The id is a
  // session string and the registry is keyed by number, so the match is
  // explicit and fails closed when it cannot be read.
  const recordedStrokes = props.getRecordedStrokes();
  let editTargetMutationId: number | null = null;
  let editTargetAnchors: readonly VectorAnchor[] | null = null;
  // 61-31 (G-20): the SAME resolution captures the target's evaluation mode, so
  // an edit gesture can never run in a mode the drawn path is not using.
  let editTargetCurveMode: AquarelleCurveMode = DEFAULT_AQUARELLE_CURVE_MODE;
  if (editMutationId !== null) {
    for (const [mutationId, candidate] of recordedStrokes) {
      if (String(mutationId) !== editMutationId) continue;
      if (isAquarelleStrokeDeleted(mutationId)) continue;
      const candidateAnchors = candidate.anchors;
      // 62-03 (D-06): record anchors first, held fit second. An anchorless
      // painted stroke resolves through its armed fit until a committed
      // gesture writes anchors; the record always wins once it has them.
      const heldAnchors = curveFit !== null && curveFit.mutationId === mutationId
        ? curveFit.anchors
        : null;
      const resolutionAnchors = candidateAnchors !== undefined && candidateAnchors.length > 0
        ? candidateAnchors
        : heldAnchors;
      if (resolutionAnchors === null || resolutionAnchors.length === 0) continue;
      editTargetMutationId = mutationId;
      editTargetAnchors = resolutionAnchors;
      // 61-31 (G-20) / 62-03 (D-01): ONE mode expression for both anchor
      // sources — the exact expression 62-01's converting write persists.
      // DEFAULT_VECTOR_PATH_CURVE_MODE is the draw-time mint, never this.
      editTargetCurveMode = resolveAquarelleCurveMode(candidate.curveMode);
      break;
    }
  }

  useEffect(() => {
    // The draft keys live while the pen is latched; the edit keys live while
    // a path edit is open. Both are primitives, so the listener rebinds only
    // when one of the two states flips (efx-preact-reactivity).
    if (!penActive && editMutationId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Capture phase on `window` sees keystrokes meant for a dialog field, so
      // the dispatcher yields to a text-entry target before either handler
      // runs (61-16 / G-4).
      handleVectorPathWindowKey(event, handlersRef.current, editKeyHandlersRef.current);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [penActive, editMutationId]);

  useEffect(() => {
    // 61-28 (CR-01) — the edit-lifetime law: a drag belongs to the edit that
    // opened it. Two cases end it here — the edit CLOSED (the latch went null),
    // and the edit RETARGETED to another stroke. Both are cancelled, never
    // flushed: an abandoned gesture must not write anchors into any stroke, so
    // this effect commits nothing. It releases the pointer the gesture
    // captured, which no pointer handler can do once the edit is closed.
    const drag = dragRef.current;
    if (drag === null) return;
    // The drag still belongs to the open edit: this render is unrelated, and a
    // live gesture is never cleared by it.
    if (editMutationId !== null && String(drag.mutationId) === editMutationId) return;
    dragRef.current = null;
    // Compare-then-write (efx-preact-reactivity): an already-clear preview is
    // not written again.
    if (vectorPathEditDrag.peek() !== null) vectorPathEditDrag.value = null;
    releasePointerCapture(surfaceRef.current, drag.pointerId);
  }, [editMutationId]);

  const playFrame = props.getPlayFrame();
  // 61-UAT: spines, anchors, handles and rungs are CONSTRUCTION chrome, never
  // part of the render. Drawing them whenever a frame holds vector strokes put
  // every path's skeleton on top of the painted result, so there was no view of
  // the final frame at all. They are shown only in the three states that are
  // about construction: drawing a path, editing one, or the wireframe view.
  const showStructure = penActive || editTargetMutationId !== null || wireframe;
  const recorded: DrawnVectorPath[] = [];
  for (const [mutationId, stroke] of (showStructure ? recordedStrokes : [])) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    // The vector-ness law: no anchors = a hand-painted stroke, nothing drawn.
    // The live drag preview replaces the edited stroke's own anchors; 62-03
    // (D-06) draws an anchorless painted stroke through its armed held fit
    // until a committed gesture writes anchors into the record.
    const recordAnchors = stroke.anchors !== undefined && stroke.anchors.length > 0
      ? stroke.anchors
      : null;
    const heldFitAnchors = curveFit !== null && curveFit.mutationId === mutationId
      ? curveFit.anchors
      : null;
    const anchors = editDrag !== null && editDrag.mutationId === mutationId
      ? editDrag.anchors
      : (recordAnchors ?? heldFitAnchors);
    if (anchors === null || anchors.length === 0) continue;
    const drawn = drawnPathOf(`stroke-${mutationId}`, anchors, props.width, props.height, {
      // The wireframe always shows the swept envelope, uniform profile or not.
      alwaysEnvelope: wireframe,
      color: typeof stroke.color === 'string' && stroke.color.length > 0 ? stroke.color : null,
      // The open path edit is the live target and wears the louder chrome.
      selected: editMutationId !== null && String(mutationId) === editMutationId,
      // 61-31 (G-20): the stroke's OWN mode — a spline path reads as a spline
      // even while another stroke is the edit target.
      curveMode: resolveAquarelleCurveMode(stroke.curveMode),
    });
    if (drawn === null) continue;
    recorded.push(drawn);
  }
  const draftPath = draft === null || draft.anchors.length === 0
    ? null
    : drawnPathOf('draft', draft.anchors, props.width, props.height, {
      alwaysEnvelope: wireframe,
      selected: penActive,
      // G-20: a draft reads the DRAW default (a new path is recorded spline),
      // so it never inherits the open edit target's mode.
      curveMode: DEFAULT_VECTOR_PATH_CURVE_MODE,
    });
  // 61-21 (IN-01): the live rubber band to the cursor — display-only.
  const draftPreviewPoints = draftPreviewPointsOf(draft, props.width, props.height);

  if (recorded.length === 0 && draftPath === null && !penActive && editTargetMutationId === null) {
    return null;
  }

  // Draw and path edit are mutually exclusive (D-06): the pen owns the surface
  // while it is latched with no path edit open; an open path edit owns it
  // otherwise, even with the pen released.
  const drawInteractive = penActive && editMutationId === null;
  const editInteractive = editTargetMutationId !== null && editTargetAnchors !== null;
  const interactive = drawInteractive || editInteractive;

  const canvasPointOf = (event: TargetedPointerEvent<HTMLDivElement>): CanvasPoint | null => {
    const target = event.currentTarget as HTMLElement | null;
    const rect = target === null ? undefined : target.getBoundingClientRect();
    if (rect === undefined || !(rect.width > 0) || !(rect.height > 0)) return null;
    // Same client-rect → viewBox law the shipped stroke overlay uses.
    const x = (event.clientX - rect.left) * (props.width / rect.width);
    const y = (event.clientY - rect.top) * (props.height / rect.height);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  };

  const pointerUvOf = (event: TargetedPointerEvent<HTMLDivElement>): Vec2 | null => {
    const point = canvasPointOf(event);
    if (point === null) return null;
    const uv = screenToUv(point, props.width, props.height);
    // T-61-28: a non-finite pointer sample never reaches the draft.
    return Number.isFinite(uv.x) && Number.isFinite(uv.y) ? uv : null;
  };

  const pointDistancePx = (a: CanvasPoint, b: CanvasPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

  /**
   * 61-21 (IN-01): the draw state's pointer move writes the preview station
   * through the ONE session writer. It never places an anchor, records a
   * stroke or starts a bake — a move is not a gesture (D-06). No
   * `preventDefault`/`stopPropagation`: nothing about a move is claimed.
   */
  const handleDraftPointerMove = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const pointerUv = pointerUvOf(event);
    if (pointerUv === null) return;
    moveVectorDraftCursor(pointerUv);
  };

  const handlePointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // The overlay owns the gesture: no pointer reaches the engine canvas.
    event.preventDefault();
    event.stopPropagation();
    const pointerUv = pointerUvOf(event);
    if (pointerUv === null) return;
    const current = vectorDrawDraft.peek();
    if (current !== null && current.anchors.length >= 2) {
      // A click on the FIRST anchor finishes the path THERE — no closing
      // anchor is appended, so the committed path has no duplicate station.
      const first = current.anchors[0];
      if (first !== undefined) {
        const firstPoint = uvToScreen(first, props.width, props.height);
        const pointer = uvToScreen(pointerUv, props.width, props.height);
        if (pointDistancePx(pointer, firstPoint) * scale < FIRST_ANCHOR_HIT_PX) {
          finishVectorPath(handlersRef.current);
          return;
        }
      }
    }
    // T-61-29: a duplicate click is REFUSED, never appended.
    if (current !== null && isAdjacentToLast(current.anchors, pointerUv, props.width, props.height, scale)) {
      return;
    }
    // Shift places a corner. Alt is the app-wide colour picker in paint mode,
    // so it can never be the draw surface's modifier.
    const anchor: VectorDraftAnchor = event.shiftKey
      ? {
        x: pointerUv.x,
        y: pointerUv.y,
        kind: 'bezier',
        in: { x: pointerUv.x, y: pointerUv.y },
        out: { x: pointerUv.x, y: pointerUv.y },
      }
      : { x: pointerUv.x, y: pointerUv.y, kind: 'auto' };
    appendVectorDraftAnchor(anchor);
  };

  const handleDoubleClick = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
    finishVectorPath(handlersRef.current);
  };

  // --- Path edit (61-10): the anchor / handle drag ------------------------

  /**
   * The chord segment under the pointer, in screen pixels. The spine's true
   * curve is the evaluator's; hit-testing the CHORD is the documented
   * approximation this overlay has always used (`pointToSegmentDistancePx`),
   * and the inserted anchor is still projected onto the evaluated curve.
   */
  const spineSegmentAt = (
    anchors: readonly VectorAnchor[],
    pointerUv: Vec2,
  ): number | null => {
    const pointer = uvToScreen(pointerUv, props.width, props.height);
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const start = anchors[index];
      const end = anchors[index + 1];
      if (start === undefined || end === undefined) continue;
      const distance = pointToSegmentDistancePx(
        pointer,
        uvToScreen(start, props.width, props.height),
        uvToScreen(end, props.width, props.height),
      ) * scale;
      if (distance > ANCHOR_HIT_PAD_PX || distance >= bestDistance) continue;
      bestDistance = distance;
      best = index;
    }
    return best;
  };

  const startEditDrag = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // 61-28 (CR-01) — the start-of-gesture law: a press ALWAYS ends the gesture
    // before it, even a press that hits nothing. An abandoned drag otherwise
    // survives inside the mounted leaf and rides a later release into a commit;
    // the pointer it captured is released here with it. Compare-then-write, so
    // a press with no open drag writes nothing.
    const previousDrag = dragRef.current;
    if (previousDrag !== null) {
      dragRef.current = null;
      if (vectorPathEditDrag.peek() !== null) vectorPathEditDrag.value = null;
      releasePointerCapture(event.currentTarget, previousDrag.pointerId);
    }
    if (editTargetMutationId === null || editTargetAnchors === null) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerUv = pointerUvOf(event);
    if (pointerUv === null) return;
    // 61-31 (G-20): the open target's mode owns the whole gesture — its handle
    // view, its hit test, its promotion and its insert (T-61-92).
    const handles = resolveAnchorHandles(resolveCurveAnchors(editTargetAnchors, editTargetCurveMode));
    const target = hitTestVectorPath(
      editTargetAnchors,
      handles,
      pointerUv,
      props.width,
      props.height,
      scale,
      editTargetCurveMode,
    );

    if (target !== null && target.kind !== 'anchor') {
      // Handle drag: the endpoint follows the pointer; the partner mirrors
      // about the anchor unless Alt breaks the coupling for this drag.
      const anchor = editTargetAnchors[target.index];
      if (anchor === undefined || anchor.kind !== 'bezier') return;
      dragRef.current = {
        kind: 'handle',
        mutationId: editTargetMutationId,
        index: target.index,
        side: target.kind === 'handle-in' ? 'in' : 'out',
        anchorsAtStart: editTargetAnchors,
        pointerId: event.pointerId,
        moved: false,
        latest: editTargetAnchors,
      };
      // The drag owns the pointer from the press: a move or release that lands
      // outside the overlay still reaches this element (CR-01).
      capturePointer(event.currentTarget, event.pointerId);
      vectorPathEditDrag.value = { mutationId: editTargetMutationId, anchors: editTargetAnchors };
      return;
    }

    if (target !== null) {
      // Anchor grab: the press writes the ONE selection (additive on
      // Shift / Cmd / Ctrl), then D-03 promotes BEFORE any movement so a
      // grab-and-release still commits the promoted shape.
      const current = editTargetAnchors[target.index];
      if (current === undefined) return;
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      setVectorAnchorSelection(
        selectAnchor(vectorAnchorSelection.peek(), target.index, additive),
      );
      // 261112-i6d: Alt+click TOGGLES the vertex between the one straight-
      // corner shape and the derived-smooth round shape — in BOTH curve modes
      // (under Spline `resolveCurveAnchors` preserves a corner, and a round
      // anchor is smoothed by the same evaluation). The branch sits AFTER the
      // selection write (a click always selects that vertex, even when the
      // write is a no-op) and BEFORE `promoteAnchorForDrag`, so no drag state
      // exists and no pointer is captured: a click is a completed gesture,
      // exactly like the spine-insert branch below. The handle branch above
      // keeps its priority, so Alt on a handle dot still starts the shipped
      // handle drag whose PER-MOVE Alt breaks the coupling. Alt is structurally
      // safe here: the colour picker cannot arm during an open path edit and
      // the Studio's pick handler is inert in Select mode.
      if (event.altKey) {
        const next = toggleAnchorCorner(editTargetAnchors, target.index);
        if (next !== editTargetAnchors) props.onPathEdit(editTargetMutationId, next);
        return;
      }
      const promoted = promoteAnchorForDrag(editTargetAnchors, target.index, editTargetCurveMode);
      dragRef.current = {
        kind: 'anchor',
        mutationId: editTargetMutationId,
        index: target.index,
        startUv: pointerUv,
        anchorsAtStart: promoted,
        // 61-31 (G-20): under Spline promotion returns the list untouched, so
        // there is no promotion to preserve on a grab-and-release.
        wasPromoted: editTargetCurveMode !== 'spline' && current.kind !== 'bezier',
        pointerId: event.pointerId,
        moved: false,
        latest: promoted,
      };
      // The drag owns the pointer from the press: a move or release that lands
      // outside the overlay still reaches this element (CR-01).
      capturePointer(event.currentTarget, event.pointerId);
      vectorPathEditDrag.value = { mutationId: editTargetMutationId, anchors: promoted };
      return;
    }

    // A click on the spine inserts ONE anchor, committed immediately — a
    // click is a completed gesture, so no drag state is opened and no pointer
    // capture is taken (there is no later move or release to route). The
    // inserted anchor becomes the selection.
    const segment = spineSegmentAt(editTargetAnchors, pointerUv);
    if (segment === null) return;
    const next = insertAnchorOnSegment(editTargetAnchors, segment, pointerUv, editTargetCurveMode);
    if (next.length === editTargetAnchors.length) return;
    setVectorAnchorSelection([segment + 1]);
    props.onPathEdit(editTargetMutationId, next);
  };

  const continueEditDrag = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null) return;
    // 61-28 (CR-01): a drag whose stroke is no longer the open edit's target
    // can neither preview nor commit. The cleanup effect owns the clearing;
    // this guard makes a same-tick stray event harmless.
    if (editTargetMutationId === null || drag.mutationId !== editTargetMutationId) return;
    const pointerUv = pointerUvOf(event);
    if (pointerUv === null) return;

    if (drag.kind === 'handle') {
      // Absolute: the endpoint IS the pointer, so a dropped move cannot drift
      // it. Alt is read per move — the coupling breaks while it is held.
      const next = moveHandleTo(drag.anchorsAtStart, drag.index, drag.side, pointerUv, event.altKey);
      const startPoint = drag.anchorsAtStart[drag.index]?.[drag.side];
      const movedPoint = next[drag.index]?.[drag.side];
      const distancePx = startPoint !== undefined && movedPoint !== undefined
        ? Math.hypot(
          (movedPoint.x - startPoint.x) * props.width,
          (movedPoint.y - startPoint.y) * props.height,
        ) * scale
        : 0;
      drag.latest = next;
      if (distancePx > DRAG_THRESHOLD_PX) drag.moved = true;
      vectorPathEditDrag.value = { mutationId: drag.mutationId, anchors: next };
      return;
    }

    // Absolute delta from the gesture start — never accumulated per move, so a
    // dropped pointer event cannot drift the anchor.
    const dx = pointerUv.x - drag.startUv.x;
    const dy = pointerUv.y - drag.startUv.y;
    const distancePx = Math.hypot(dx * props.width, dy * props.height) * scale;
    const next = moveAnchorBy(drag.anchorsAtStart, drag.index, dx, dy);
    drag.latest = next;
    if (distancePx > DRAG_THRESHOLD_PX) drag.moved = true;
    vectorPathEditDrag.value = { mutationId: drag.mutationId, anchors: next };
  };

  const finishEditDrag = (event?: TargetedPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null) return;
    // 61-28 (CR-01): the same target law as continueEditDrag — a non-matching
    // drag is refused before any clear, any commit and any release. A release
    // never flushes an abandoned gesture.
    if (editTargetMutationId === null || drag.mutationId !== editTargetMutationId) return;
    dragRef.current = null;
    // Clear BEFORE the commit so a same-tick repeat gesture finds nothing
    // (the T-61-30 clear-before-commit law).
    vectorPathEditDrag.value = null;
    if (drag.moved) {
      props.onPathEdit(drag.mutationId, drag.latest);
    } else if (drag.kind === 'anchor' && drag.wasPromoted) {
      // A grab-and-release still commits the promotion (D-03); an already-bezier
      // anchor that did not move is a no-op and commits nothing. A handle that
      // did not move is a no-op too — there is no promotion to preserve.
      props.onPathEdit(drag.mutationId, drag.anchorsAtStart);
    }
    // Release AFTER the commit decision, so the release can never swallow the
    // edit (T-61-57). A pointer the element already lost is not released.
    releasePointerCapture(event?.currentTarget, drag.pointerId);
  };

  const cancelEditDrag = (event?: TargetedPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    vectorPathEditDrag.value = null;
    if (drag !== null) releasePointerCapture(event?.currentTarget, drag.pointerId);
  };

  // 61 CR-01 (residual): assigned here, where `cancelEditDrag` is in scope, so
  // a Delete handled by the key seam ends the gesture before its own write.
  editKeyHandlersRef.current = {
    getRecordedStrokes: props.getRecordedStrokes,
    onPathEdit: props.onPathEdit,
    // 62-03 (D-06): the held fit answers the pre-conversion Delete — read at
    // event time through `.peek()`, exactly like the ref's other seams.
    getHeldFit: (id) => {
      const fit = curveFitSession.peek();
      return fit !== null && String(fit.mutationId) === id
        ? { mutationId: fit.mutationId, anchors: fit.anchors }
        : null;
    },
    cancelActiveDrag: () => cancelEditDrag(),
  };

  return (
    <div
      data-testid="vector-path-overlay"
      // 61-28 (CR-01): the element the edit-lifetime effect releases from.
      ref={surfaceRef}
      style={{
        position: 'absolute',
        inset: '0',
        zIndex: VECTOR_PATH_Z_INDEX,
        // Pass-through unless the pen or an open path edit owns the surface —
        // the two states are mutually exclusive (D-06).
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: drawInteractive ? 'crosshair' : 'default',
      }}
      onPointerDown={interactive ? (editInteractive ? startEditDrag : handlePointerDown) : undefined}
      // 61-21 (IN-01): the move handler exists ONLY in the draw state; the
      // edit drag keeps its own binding untouched.
      onPointerMove={
        editInteractive ? continueEditDrag : drawInteractive ? handleDraftPointerMove : undefined
      }
      onPointerUp={editInteractive ? finishEditDrag : undefined}
      onPointerCancel={editInteractive ? cancelEditDrag : undefined}
      // Preact's DOM event prop is `onDblClick`; it binds the real `dblclick`.
      onDblClick={drawInteractive ? handleDoubleClick : undefined}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${props.width} ${props.height}`}
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: '0',
          display: 'block',
          pointerEvents: 'none',
        }}
      >
        {recorded.map((drawn) => renderPath(
          drawn,
          scale,
          props.width,
          props.height,
          wireframe,
          previewStrokeSize,
          drawn.selected ? anchorSelection : [],
        ))}
        {/* 61-21 (IN-01): the provisional spine, drawn BEFORE the committed
            draft path so the placed segments stay legible. */}
        {draftPreviewPoints === null ? null : (
          <polyline
            data-testid="vector-path-draft-preview"
            points={draftPreviewPoints}
            fill="none"
            stroke={SELECTED_SPINE_COLOR}
            strokeWidth={1}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {draftPath === null ? null : renderPath(
          draftPath,
          scale,
          props.width,
          props.height,
          wireframe,
          previewStrokeSize,
          draftPath.selected ? anchorSelection : [],
        )}
      </svg>
    </div>
  );
}
