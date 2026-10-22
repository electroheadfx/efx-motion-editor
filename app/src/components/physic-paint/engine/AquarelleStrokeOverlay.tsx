// ============================================================
//  AquarelleStrokeOverlay — the Water color select surface
//  (quick 261022-pim Task 1).
//
//  A narrow leaf: it is the ONLY mouse-facing layer above the
//  vendor canvas while select mode is active, so painting is
//  blocked without touching the engine's pointer handling. It
//  outlines every recorded stroke of the current edit frame (a
//  point polyline plus a brush-size-inflated bbox), selects the
//  newest stroke under a left click, and hands Alt+click to the
//  Studio's delete callback.
//
//  Selection is applied in the pointer handler — never an
//  effect. The select/move signals are read here and nowhere in
//  the Studio render body (efx-preact-reactivity).
// ============================================================

import type { JSX, TargetedPointerEvent } from 'preact';
import { temporaryMove } from '../view/physicsPaintTemporaryErase';
import {
  aquarelleSelectMode,
  aquarelleSelectedStrokeMutationId,
  listSelectableAquarelleStrokes,
  selectAquarelleStrokeAt,
} from '../view/aquarelleStrokeSelection';

const SELECTED_STROKE_COLOR = '#38bdf8';
const OUTLINE_DARK = '#111111';
const OUTLINE_LIGHT = '#ffffff';

export function AquarelleStrokeOverlay(props: {
  width: number;
  height: number;
  getPlayFrame: () => number;
  onDeleteStroke: (mutationId: number) => void;
}): JSX.Element | null {
  const selectMode = aquarelleSelectMode.value;
  const moveArmed = temporaryMove.value;
  if (!selectMode && !moveArmed) return null;

  // Narrow subscriptions: the revision (inside the listing) repaints the
  // outlines when the script changes; the selected id drives the highlight.
  const playFrame = props.getPlayFrame();
  const strokes = listSelectableAquarelleStrokes(playFrame, {
    width: props.width,
    height: props.height,
  });
  const selectedId = aquarelleSelectedStrokeMutationId.value;

  const handlePointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // The overlay owns the gesture: no pointer reaches the vendor canvas.
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const scaleX = rect.width > 0 ? props.width / rect.width : 1;
    const scaleY = rect.height > 0 ? props.height / rect.height : 1;
    const hit = selectAquarelleStrokeAt(
      {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      },
      playFrame,
      { width: props.width, height: props.height },
    );
    if (hit !== null && event.altKey) props.onDeleteStroke(hit);
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
          const points = entry.pointsPx.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <g key={entry.mutationId} data-stroke-id={entry.mutationId}>
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
                x={entry.bounds.x}
                y={entry.bounds.y}
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
