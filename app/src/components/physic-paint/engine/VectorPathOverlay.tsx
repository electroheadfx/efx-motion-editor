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
  normaliseVectorAnchors,
  resolveAnchorHandles,
  resolveRenderModeForBrushId,
  type AquarelleStroke,
  type ResolvedAnchorHandles,
  type Vec2,
  type VectorAnchor,
} from '@efxlab/efx-watercolor/payload';
import {
  aquarelleBrushForActiveTool,
  aquarelleStrokesRevision,
  isAquarelleStrokeDeleted,
} from '../view/aquarelleRecordState';
import { physicsPaintCanvasZoom } from '../view/physicsPaintCanvasZoom';
import type { CanvasPoint } from '../view/scriptStrokeEdition';
import {
  ANCHOR_BODY_PX,
  ANCHOR_CORE_RADIUS_PX,
  ANCHOR_HIT_PAD_PX,
  DRAG_THRESHOLD_PX,
  FIRST_ANCHOR_HIT_PX,
  HANDLE_BODY_PX,
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
  uvToScreen,
  type VectorPathCommit,
  type VectorPathProjection,
} from '../view/vectorPathHandles';
import {
  appendVectorDraftAnchor,
  clearVectorAnchorSelection,
  clearVectorDraft,
  pathEditMutationId,
  setVectorAnchorSelection,
  vectorAnchorSelection,
  vectorDrawDraft,
  vectorPenActive,
  type VectorDraftAnchor,
} from '../view/vectorPathSession';

// --- The overlay's one palette -------------------------------------------

/** Selected-path accent — the same `#38bdf8` the shipped select overlay uses. */
const SELECTED_SPINE_COLOR = '#38bdf8';
const OUTLINE_DARK = '#111111';
const OUTLINE_LIGHT = '#ffffff';
/** User-owned control (a bezier anchor and its handles) — the 26102x accent. */
const OWNED_CONTROL_COLOR = '#f59e0b';
const HANDLE_OPACITY = 0.6;
const SPINE_STROKE_PX = 1.5;
const ENVELOPE_FILL_OPACITY = 0.12;

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
  moved: boolean;
  latest: readonly VectorAnchor[];
}

type PathEditDragState = AnchorDragState | HandleDragState;

/** One path the overlay draws: its anchors, resolved handles and projection. */
interface DrawnVectorPath {
  readonly key: string;
  readonly anchors: readonly VectorAnchor[];
  readonly handles: readonly ResolvedAnchorHandles[];
  readonly projection: VectorPathProjection;
}

function finiteScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
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
  const { anchors: normalised, points } = buildDraftPath(anchors);
  if (normalised.length < 2 || points.length === 0) return;
  handlers.onCommitPath({
    anchors: normalised,
    // The SAME brush-id law the record path stamps: the commit can never
    // disagree with the brush the layer's snapshot stores (61-07 D-14).
    renderMode: resolveRenderModeForBrushId(aquarelleBrushForActiveTool().brushId),
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
    if (stroke.anchors === undefined || stroke.anchors.length === 0) continue;
    targetMutationId = mutationId;
    targetAnchors = stroke.anchors;
    break;
  }
  if (targetMutationId === null || targetAnchors === null) return;
  const next = deleteAnchorsAt(targetAnchors, selection);
  if (next.length === targetAnchors.length) return;
  event.preventDefault?.();
  event.stopPropagation?.();
  clearVectorAnchorSelection();
  handlers.onPathEdit(targetMutationId, next);
}

// --- Drawing --------------------------------------------------------------

function drawnPathOf(
  key: string,
  anchors: readonly VectorAnchor[],
  width: number,
  height: number,
): DrawnVectorPath | null {
  const normalised = normaliseVectorAnchors(anchors);
  if (normalised.length === 0) return null;
  return {
    key,
    anchors: normalised,
    handles: resolveAnchorHandles(normalised),
    projection: projectVectorPath(normalised, width, height),
  };
}

/**
 * One path's SVG group, in the UI-SPEC order: envelope → spine → anchors →
 * handles. Marker extents are screen-pixel constants divided by the effective
 * zoom, so the chrome keeps its screen size at every zoom.
 */
function renderPath(
  drawn: DrawnVectorPath,
  scale: number,
  width: number,
  height: number,
): JSX.Element {
  const { anchors, handles, projection } = drawn;
  const spinePoints = projection.spine.map((point) => `${point.x},${point.y}`).join(' ');
  const envelope = projection.envelope.length < 3
    ? null
    : `M${projection.envelope.map((point) => `${point.x},${point.y}`).join(' L')} Z`;
  const anchorSizePx = ANCHOR_BODY_PX / scale;
  const coreRadiusPx = ANCHOR_CORE_RADIUS_PX / scale;
  const handleRadiusPx = HANDLE_BODY_PX / 2 / scale;

  return (
    <g key={drawn.key}>
      {envelope === null ? null : (
        <path
          data-testid="vector-path-envelope"
          d={envelope}
          fill={SELECTED_SPINE_COLOR}
          fillOpacity={ENVELOPE_FILL_OPACITY}
          stroke={SELECTED_SPINE_COLOR}
          strokeOpacity={0.5}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
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
      {projection.anchors.map((point, index) => {
        const anchor = anchors[index];
        if (anchor === undefined) return null;
        return anchor.kind === 'bezier' ? (
          <rect
            key={`anchor-${index}`}
            data-testid="vector-path-anchor"
            x={point.x - anchorSizePx / 2}
            y={point.y - anchorSizePx / 2}
            width={anchorSizePx}
            height={anchorSizePx}
            fill={OWNED_CONTROL_COLOR}
            stroke={OUTLINE_LIGHT}
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
            stroke={OUTLINE_LIGHT}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {anchors.map((anchor, index) => {
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
                  <circle
                    data-testid="vector-path-handle"
                    cx={point.x}
                    cy={point.y}
                    r={handleRadiusPx}
                    fill={OWNED_CONTROL_COLOR}
                    fillOpacity={HANDLE_OPACITY}
                    stroke={OUTLINE_LIGHT}
                    strokeWidth={1}
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
  const editKeyHandlersRef = useRef<VectorPathEditKeyHandlers>({
    getRecordedStrokes: props.getRecordedStrokes,
    onPathEdit: props.onPathEdit,
  });
  editKeyHandlersRef.current = {
    getRecordedStrokes: props.getRecordedStrokes,
    onPathEdit: props.onPathEdit,
  };
  // The in-flight anchor / handle drag (path edit). A ref so the pointer
  // handlers never re-render the surface mid-gesture; the visual preview
  // travels on a signal.
  const dragRef = useRef<PathEditDragState | null>(null);

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

  // Path edit (61-10): resolve the stroke the session names. The id is a
  // session string and the registry is keyed by number, so the match is
  // explicit and fails closed when it cannot be read.
  const recordedStrokes = props.getRecordedStrokes();
  let editTargetMutationId: number | null = null;
  let editTargetAnchors: readonly VectorAnchor[] | null = null;
  if (editMutationId !== null) {
    for (const [mutationId, candidate] of recordedStrokes) {
      if (String(mutationId) !== editMutationId) continue;
      if (isAquarelleStrokeDeleted(mutationId)) continue;
      const candidateAnchors = candidate.anchors;
      if (candidateAnchors === undefined || candidateAnchors.length === 0) continue;
      editTargetMutationId = mutationId;
      editTargetAnchors = candidateAnchors;
      break;
    }
  }

  useEffect(() => {
    // The draft keys live while the pen is latched; the edit keys live while
    // a path edit is open. Both are primitives, so the listener rebinds only
    // when one of the two states flips (efx-preact-reactivity).
    if (!penActive && editMutationId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      handleVectorPathKey(event, handlersRef.current);
      handleVectorPathEditKey(event, editKeyHandlersRef.current);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [penActive, editMutationId]);

  const playFrame = props.getPlayFrame();
  const recorded: DrawnVectorPath[] = [];
  for (const [mutationId, stroke] of recordedStrokes) {
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    if ((stroke.playFrame ?? 0) !== playFrame) continue;
    // The vector-ness law: no anchors = a hand-painted stroke, nothing drawn.
    // The live drag preview replaces the edited stroke's own anchors.
    const anchors = editDrag !== null && editDrag.mutationId === mutationId
      ? editDrag.anchors
      : stroke.anchors;
    if (anchors === undefined || anchors.length === 0) continue;
    const drawn = drawnPathOf(`stroke-${mutationId}`, anchors, props.width, props.height);
    if (drawn === null) continue;
    recorded.push(drawn);
  }
  const draftPath = draft === null || draft.anchors.length === 0
    ? null
    : drawnPathOf('draft', draft.anchors, props.width, props.height);

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
    const anchor: VectorDraftAnchor = event.altKey
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
    if (editTargetMutationId === null || editTargetAnchors === null) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerUv = pointerUvOf(event);
    if (pointerUv === null) return;
    const handles = resolveAnchorHandles(editTargetAnchors);
    const target = hitTestVectorPath(
      editTargetAnchors,
      handles,
      pointerUv,
      props.width,
      props.height,
      scale,
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
        moved: false,
        latest: editTargetAnchors,
      };
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
      const promoted = promoteAnchorForDrag(editTargetAnchors, target.index);
      dragRef.current = {
        kind: 'anchor',
        mutationId: editTargetMutationId,
        index: target.index,
        startUv: pointerUv,
        anchorsAtStart: promoted,
        wasPromoted: current.kind !== 'bezier',
        moved: false,
        latest: promoted,
      };
      vectorPathEditDrag.value = { mutationId: editTargetMutationId, anchors: promoted };
      return;
    }

    // A click on the spine inserts ONE anchor, committed immediately — a
    // click is a completed gesture, so no drag state is opened. The inserted
    // anchor becomes the selection.
    const segment = spineSegmentAt(editTargetAnchors, pointerUv);
    if (segment === null) return;
    const next = insertAnchorOnSegment(editTargetAnchors, segment, pointerUv);
    if (next.length === editTargetAnchors.length) return;
    setVectorAnchorSelection([segment + 1]);
    props.onPathEdit(editTargetMutationId, next);
  };

  const continueEditDrag = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null) return;
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

  const finishEditDrag = () => {
    const drag = dragRef.current;
    if (drag === null) return;
    dragRef.current = null;
    // Clear BEFORE the commit so a same-tick repeat gesture finds nothing
    // (the T-61-30 clear-before-commit law).
    vectorPathEditDrag.value = null;
    if (drag.moved) {
      props.onPathEdit(drag.mutationId, drag.latest);
      return;
    }
    // A grab-and-release still commits the promotion (D-03); an already-bezier
    // anchor that did not move is a no-op and commits nothing. A handle that
    // did not move is a no-op too — there is no promotion to preserve.
    if (drag.kind === 'anchor' && drag.wasPromoted) {
      props.onPathEdit(drag.mutationId, drag.anchorsAtStart);
    }
  };

  const cancelEditDrag = () => {
    dragRef.current = null;
    vectorPathEditDrag.value = null;
  };

  return (
    <div
      data-testid="vector-path-overlay"
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
      onPointerMove={editInteractive ? continueEditDrag : undefined}
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
        {recorded.map((drawn) => renderPath(drawn, scale, props.width, props.height))}
        {draftPath === null ? null : renderPath(draftPath, scale, props.width, props.height)}
      </svg>
    </div>
  );
}
