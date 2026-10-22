// ============================================================
//  AquarelleStrokeOverlay — the Water color select surface
//  (quick 261022-pim Task 1, drag added by 261022-tv1).
//
//  A narrow leaf: it is the ONLY mouse-facing layer above the
//  vendor canvas while select mode is active, so painting is
//  blocked without touching the engine's pointer handling. It
//  outlines every recorded stroke of the current edit frame (a
//  point polyline plus a brush-size-inflated bbox), selects the
//  newest stroke under a left click, hands Alt+click to the
//  Studio's delete callback, and turns a press-and-drag on a hit
//  stroke into a GHOST preview.
//
//  During the gesture the ONLY write is the drag signal — no
//  script mutation and no apply runs before pointerup. The
//  release clears the ghost and hands the pixel delta to the
//  Studio callback.
//
//  Selection and drag are applied in the pointer handlers —
//  never an effect. The select/drag signals are read here and
//  nowhere in the Studio render body (efx-preact-reactivity).
// ============================================================

import type { JSX, TargetedPointerEvent } from 'preact';
import { useRef } from 'preact/hooks';
import { temporaryMove } from '../view/physicsPaintTemporaryErase';
import {
  aquarelleSelectMode,
  aquarelleSelectedStrokeMutationId,
  aquarelleStrokeDrag,
  clearAquarelleStrokeDrag,
  listSelectableAquarelleStrokes,
  selectAquarelleStrokeAt,
  setAquarelleStrokeDrag,
} from '../view/aquarelleStrokeSelection';

const SELECTED_STROKE_COLOR = '#38bdf8';
const OUTLINE_DARK = '#111111';
const OUTLINE_LIGHT = '#ffffff';

/** Canvas pixels the pointer must travel before the press becomes a move. */
const DRAG_THRESHOLD_PX = 3;

interface AquarelleDragGesture {
  readonly pointerId: number;
  readonly mutationId: number;
  readonly startX: number;
  readonly startY: number;
  started: boolean;
}

export function AquarelleStrokeOverlay(props: {
  width: number;
  height: number;
  getPlayFrame: () => number;
  onDeleteStroke: (mutationId: number) => void;
  onMoveStroke: (mutationId: number, dxPx: number, dyPx: number) => void;
}): JSX.Element | null {
  // Gesture state lives in a ref — no component state, no effect.
  const gestureRef = useRef<AquarelleDragGesture | null>(null);
  const selectMode = aquarelleSelectMode.value;
  const moveArmed = temporaryMove.value;
  // The drag read is narrow (this leaf only). It also keeps the surface
  // mounted when a held Cmd is released in the middle of the gesture.
  const drag = aquarelleStrokeDrag.value;
  if (!selectMode && !moveArmed && drag === null) return null;

  // Narrow subscriptions: the revision (inside the listing) repaints the
  // outlines when the script changes; the selected id drives the highlight.
  const playFrame = props.getPlayFrame();
  const strokes = listSelectableAquarelleStrokes(playFrame, {
    width: props.width,
    height: props.height,
  });
  const selectedId = aquarelleSelectedStrokeMutationId.value;

  const canvasPointOf = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const scaleX = rect.width > 0 ? props.width / rect.width : 1;
    const scaleY = rect.height > 0 ? props.height / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // The overlay owns the gesture: no pointer reaches the vendor canvas.
    event.preventDefault();
    const point = canvasPointOf(event);
    const hit = selectAquarelleStrokeAt(
      point,
      playFrame,
      { width: props.width, height: props.height },
    );
    if (hit === null) return;
    if (event.altKey) {
      props.onDeleteStroke(hit);
      return;
    }
    // Arm the gesture. No drag signal, no script mutation, no apply yet.
    gestureRef.current = {
      pointerId: event.pointerId,
      mutationId: hit,
      startX: point.x,
      startY: point.y,
      started: false,
    };
    // Own the pointer for the whole gesture: a drag that leaves the overlay
    // still streams its moves and ends here exactly once.
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // A detached overlay cannot capture; the element still owns pointerup.
    }
  };

  const handlePointerMove = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const point = canvasPointOf(event);
    const dxPx = point.x - gesture.startX;
    const dyPx = point.y - gesture.startY;
    if (!gesture.started) {
      if (Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;
      gesture.started = true;
    }
    setAquarelleStrokeDrag({ mutationId: gesture.mutationId, dxPx, dyPx });
  };

  const releasePointerCapture = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget as HTMLElement;
    try {
      if (target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Already released / detached — nothing to clean up.
    }
  };

  const handlePointerUp = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const point = canvasPointOf(event);
    const dxPx = point.x - gesture.startX;
    const dyPx = point.y - gesture.startY;
    // A press that never crossed the threshold is a click: selection already
    // happened on pointerdown, so it must not move anything.
    const crossed = gesture.started || Math.hypot(dxPx, dyPx) >= DRAG_THRESHOLD_PX;
    gestureRef.current = null;
    clearAquarelleStrokeDrag();
    releasePointerCapture(event);
    if (!crossed) return;
    props.onMoveStroke(gesture.mutationId, dxPx, dyPx);
  };

  // A cancelled gesture leaves the script untouched: no move, no apply.
  const handlePointerCancel = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    clearAquarelleStrokeDrag();
  };

  return (
    <div
      data-testid="aquarelle-stroke-overlay"
      style={{
        position: 'absolute',
        inset: '0',
        zIndex: 40,
        pointerEvents: 'auto',
        cursor: 'default',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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
        {strokes.map((entry) => {
          const isSelected = entry.mutationId === selectedId;
          // The dragged stroke renders as the GHOST: its polyline and bbox
          // translated by the live drag offset. No engine call, no apply.
          const dragOffset =
            drag !== null && drag.mutationId === entry.mutationId ? drag : null;
          const offsetX = dragOffset?.dxPx ?? 0;
          const offsetY = dragOffset?.dyPx ?? 0;
          const points = entry.pointsPx
            .map((p) => `${p.x + offsetX},${p.y + offsetY}`)
            .join(' ');
          return (
            <g
              key={entry.mutationId}
              data-stroke-id={entry.mutationId}
              data-testid={dragOffset ? 'aquarelle-drag-ghost' : undefined}
            >
              {isSelected ? (
                <polyline
                  points={points}
                  fill="none"
                  stroke={SELECTED_STROKE_COLOR}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={OUTLINE_DARK}
                    strokeWidth={2}
                    opacity={0.7}
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={points}
                    fill="none"
                    stroke={OUTLINE_LIGHT}
                    strokeWidth={1}
                    opacity={0.9}
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
              <rect
                x={entry.bounds.x + offsetX}
                y={entry.bounds.y + offsetY}
                width={entry.bounds.width}
                height={entry.bounds.height}
                fill="none"
                stroke={isSelected ? SELECTED_STROKE_COLOR : OUTLINE_DARK}
                strokeWidth={1}
                strokeDasharray="4 3"
                opacity={isSelected ? 0.9 : 0.45}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
