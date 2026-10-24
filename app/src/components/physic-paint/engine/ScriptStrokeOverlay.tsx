// ============================================================
//  ScriptStrokeOverlay — the ONE script-edition gesture surface
//  shared by the Water color select mode and the Brush Move mode
//  (quick 261023-g4p Task 2; moved from AquarelleStrokeOverlay,
//  introduced by 261022-pim / 261022-tv1; multi-select 261024-mz5).
//
//  A narrow leaf: it is the ONLY mouse-facing layer above the
//  engine canvas while its select surface is active, so painting
//  is blocked without touching the engine's pointer handling. It
//  outlines every listed stroke of the current edit frame (a
//  point polyline plus a brush-size-inflated bbox), owns the
//  selection SET (plain click replaces, Cmd/Ctrl-click toggles,
//  Shift-click adds, empty click clears), hands Alt+click to the
//  caller's batch delete callback, and turns a press-and-drag on
//  a hit stroke into a GHOST preview of the WHOLE selection.
//
//  During the gesture the ONLY write is the shared drag signal —
//  no script mutation and no apply runs before pointerup. The
//  release clears the ghost and hands the captured id array plus
//  the pixel delta to the caller's batch move callback.
//
//  Selection and drag are applied in the pointer handlers —
//  never an effect. The shared select/drag signals are read here
//  and nowhere in a render body that owns the engine
//  (efx-preact-reactivity).
// ============================================================

import type { JSX, TargetedPointerEvent } from 'preact';
import { useRef } from 'preact/hooks';
import {
  clearScriptStrokeDrag,
  clearScriptStrokeTransform,
  scriptSelectedStrokeIds,
  scriptStrokeDrag,
  scriptStrokeTransform,
  selectScriptStroke,
  selectScriptStrokeAt,
  setScriptStrokeDrag,
  setScriptStrokeSelection,
  setScriptStrokeTransform,
  toggleScriptStrokeSelection,
  type CanvasPoint,
  type ScriptStrokeEditionPort,
} from '../view/scriptStrokeEdition';
import {
  SCRIPT_TRANSFORM_HANDLE_SIZE_PX,
  SCRIPT_TRANSFORM_ROTATE_RADIUS_PX,
  SCRIPT_TRANSFORM_ROTATE_STEM_PX,
  applyScriptStrokeTransform,
  buildScriptStrokeTransform,
  hitTestScriptStrokeTransformHandle,
  isIdentityScriptStrokeTransform,
  scriptStrokeSelectionBox,
  scriptStrokeTransformHandles,
  type ScriptStrokeSelectionBox,
  type ScriptStrokeTransform,
} from '../view/scriptStrokeTransform';

const SELECTED_STROKE_COLOR = '#38bdf8';
const OUTLINE_DARK = '#111111';
const OUTLINE_LIGHT = '#ffffff';
const TRANSFORM_HANDLE_COLOR = '#f59e0b';

/** Canvas pixels the pointer must travel before the press becomes a move. */
const DRAG_THRESHOLD_PX = 3;

interface ScriptDragGesture {
  readonly kind: 'drag';
  readonly pointerId: number;
  /** Captured at pointerdown — a later selection change never retargets. */
  readonly mutationIds: readonly number[];
  readonly startX: number;
  readonly startY: number;
  started: boolean;
}

interface ScriptTransformGesture {
  readonly kind: 'transform';
  readonly pointerId: number;
  /** The captured selection this handle gesture transforms. */
  readonly mutationIds: readonly number[];
  readonly transformKind: 'rotate' | 'scale';
  readonly centerX: number;
  readonly centerY: number;
  readonly startX: number;
  readonly startY: number;
  started: boolean;
}

type ScriptOverlayGesture = ScriptDragGesture | ScriptTransformGesture;

function scaleCursor(corner: 'tl' | 'tr' | 'bl' | 'br'): string {
  // The cursor names the axis pair the drag follows, matching the box's
  // rotation-free geometry (handles are screen-aligned, like the inline editor).
  return corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize';
}

export function ScriptStrokeOverlay(props: {
  width: number;
  height: number;
  getPlayFrame: () => number;
  port: ScriptStrokeEditionPort;
  selectMode: boolean;
  moveArmed: boolean;
  onDeleteStrokes: (mutationIds: readonly number[]) => void;
  onMoveStrokes: (mutationIds: readonly number[], dxPx: number, dyPx: number) => void;
  /** 261024-mz5 Task 2: when absent, the transform handles never render. */
  onTransformStrokes?: (mutationIds: readonly number[], transform: ScriptStrokeTransform) => void;
  testId: string;
  badgeTestId: string;
  ghostTestId: string;
}): JSX.Element | null {
  // Gesture state lives in a ref — no component state, no effect.
  const gestureRef = useRef<ScriptOverlayGesture | null>(null);
  const { selectMode, moveArmed } = props;
  // Narrow reads (this leaf only). They also keep the surface mounted when a
  // held Cmd is released, or a transform preview is in flight, mid-gesture.
  const drag = scriptStrokeDrag.value;
  const transformPreview = scriptStrokeTransform.value;
  if (!selectMode && !moveArmed && drag === null && transformPreview === null) return null;

  // Narrow subscriptions: the port's listing repaints the outlines when the
  // script changes; the selected SET drives the highlights.
  const playFrame = props.getPlayFrame();
  const size = { width: props.width, height: props.height };
  const strokes = props.port.listStrokes(playFrame, size);
  const selectedIds = scriptSelectedStrokeIds.value;
  const selectionBox: ScriptStrokeSelectionBox | null = scriptStrokeSelectionBox(
    strokes.filter((entry) => selectedIds.has(entry.mutationId)),
  );

  const canvasPointOf = (event: TargetedPointerEvent<HTMLDivElement>): CanvasPoint => {
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
    // The overlay owns the gesture: no pointer reaches the engine canvas.
    event.preventDefault();
    const point = canvasPointOf(event);
    // Handle hit-testing WINS over stroke hit-testing. Handles exist only when
    // the adapter can commit a transform, so a module without that capability
    // never swallows a stroke click.
    const handleHit = selectionBox !== null && props.onTransformStrokes !== undefined
      ? hitTestScriptStrokeTransformHandle(point, selectionBox)
      : null;
    if (handleHit !== null && selectionBox !== null) {
      gestureRef.current = {
        kind: 'transform',
        pointerId: event.pointerId,
        mutationIds: [...scriptSelectedStrokeIds.peek()],
        transformKind: handleHit.kind,
        centerX: selectionBox.x + selectionBox.width / 2,
        centerY: selectionBox.y + selectionBox.height / 2,
        startX: point.x,
        startY: point.y,
        started: false,
      };
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        // A detached overlay cannot capture; the element still owns pointerup.
      }
      return;
    }
    const toggleModifier = event.metaKey || event.ctrlKey;
    const hit = props.port.hitTestStroke(point, playFrame, size);
    const current = scriptSelectedStrokeIds.peek();
    if (event.altKey) {
      if (hit === null) return;
      // Alt+click deletes the selection when the hit belongs to it, else the
      // hit alone. The edit callbacks prune whatever actually vanished.
      const ids = current.has(hit) ? [...current] : [hit];
      props.onDeleteStrokes(ids);
      return;
    }
    if (toggleModifier) {
      // Cmd/Ctrl toggles membership and never arms a drag; an additive empty
      // click keeps the set.
      if (hit === null) return;
      toggleScriptStrokeSelection(hit);
      return;
    }
    if (event.shiftKey) {
      // Shift ADDS (never removes) and never arms a drag.
      if (hit === null) return;
      if (!current.has(hit)) setScriptStrokeSelection([...current, hit]);
      return;
    }
    if (hit === null) {
      // Plain empty click clears through the shared helper; additive-empty
      // returned above and keeps the set.
      selectScriptStrokeAt(point, playFrame, size, props.port);
      return;
    }
    // Plain hit: a stroke already in the selection keeps the WHOLE set (a
    // multi-stroke drag); a fresh hit replaces the selection.
    if (!current.has(hit)) selectScriptStroke(hit);
    const ids = [...scriptSelectedStrokeIds.peek()];
    // Arm the gesture. No drag signal, no script mutation, no apply yet.
    gestureRef.current = {
      kind: 'drag',
      pointerId: event.pointerId,
      mutationIds: ids,
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
    if (!gesture) {
      // Hover cursor: an imperative style write — no state, no signal, no
      // effect. Scale corners name their axis pair; the rotate handle grabs.
      const point = canvasPointOf(event);
      const hovered = selectionBox !== null && props.onTransformStrokes !== undefined
        ? hitTestScriptStrokeTransformHandle(point, selectionBox)
        : null;
      (event.currentTarget as HTMLElement).style.cursor = hovered === null
        ? 'default'
        : hovered.kind === 'rotate'
          ? 'grab'
          : scaleCursor(hovered.id === 'rotate' ? 'tl' : hovered.id);
      return;
    }
    if (gesture.pointerId !== event.pointerId) return;
    const point = canvasPointOf(event);
    const dxPx = point.x - gesture.startX;
    const dyPx = point.y - gesture.startY;
    if (!gesture.started) {
      if (Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;
      gesture.started = true;
    }
    if (gesture.kind === 'transform') {
      // Preview only: no script mutation and no apply before release.
      const transform = buildScriptStrokeTransform(
        gesture.transformKind,
        { x: gesture.centerX, y: gesture.centerY },
        { x: gesture.startX, y: gesture.startY },
        point,
        event.shiftKey,
      );
      setScriptStrokeTransform({ ids: gesture.mutationIds, ...transform });
      return;
    }
    setScriptStrokeDrag({ mutationIds: gesture.mutationIds, dxPx, dyPx });
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
    releasePointerCapture(event);
    if (gesture.kind === 'transform') {
      const transform = buildScriptStrokeTransform(
        gesture.transformKind,
        { x: gesture.centerX, y: gesture.centerY },
        { x: gesture.startX, y: gesture.startY },
        point,
        event.shiftKey,
      );
      clearScriptStrokeTransform();
      // A sub-threshold drag or an identity transform commits nothing.
      if (!crossed || isIdentityScriptStrokeTransform(transform)) return;
      props.onTransformStrokes?.(gesture.mutationIds, transform);
      return;
    }
    clearScriptStrokeDrag();
    if (!crossed) return;
    props.onMoveStrokes(gesture.mutationIds, dxPx, dyPx);
  };

  // A cancelled gesture leaves the script untouched: no move, no transform.
  const handlePointerCancel = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    clearScriptStrokeDrag();
    clearScriptStrokeTransform();
  };

  return (
    <div
      data-testid={props.testId}
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
          const isSelected = selectedIds.has(entry.mutationId);
          // Every selected stroke renders as the GHOST during a drag: its
          // polyline and bbox translated by the live drag offset. No engine
          // call, no apply.
          const dragged = drag !== null && drag.mutationIds.includes(entry.mutationId);
          const offsetX = dragged ? drag!.dxPx : 0;
          const offsetY = dragged ? drag!.dyPx : 0;
          // A handle gesture previews the transform on every captured stroke;
          // still no script mutation and no engine call.
          const transformed = transformPreview !== null
            && transformPreview.ids.includes(entry.mutationId);
          const points = entry.pointsPx
            .map((p) => {
              const moved = transformed
                ? applyScriptStrokeTransform(p, transformPreview!)
                : p;
              return `${moved.x + offsetX},${moved.y + offsetY}`;
            })
            .join(' ');
          const label = `#${entry.serial} · ${entry.stackPosition}/${entry.stackTotal}`;
          const badgeX = Math.max(4, entry.bounds.x + offsetX);
          const badgeY = Math.max(14, entry.bounds.y + offsetY - 7);
          // Monospace advance ≈ 0.6em — accurate enough to size the chip.
          const badgeWidth = label.length * 7.8 + 8;
          return (
            <g
              key={entry.mutationId}
              data-stroke-id={entry.mutationId}
              data-testid={dragged ? props.ghostTestId : undefined}
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
              {/* Selected: a solid box in the stroke's own colour. Unselected:
                  the quiet dashed reference frame. */}
              <rect
                x={entry.bounds.x + offsetX}
                y={entry.bounds.y + offsetY}
                width={entry.bounds.width}
                height={entry.bounds.height}
                fill="none"
                stroke={isSelected ? entry.color : OUTLINE_DARK}
                strokeWidth={isSelected ? 2.5 : 1}
                strokeDasharray={isSelected ? undefined : '4 3'}
                opacity={isSelected ? 1 : 0.45}
                vectorEffect="non-scaling-stroke"
              />
              {/* 261022-ujp: creation-order id · position from the top of the
                  stack. Overlay only — never part of the baked pixels. The chip
                  keeps the text readable over any wash. */}
              <rect
                x={badgeX - 4}
                y={badgeY - 13}
                width={badgeWidth}
                height={18}
                rx={3}
                fill="#ffffff"
                fillOpacity={0.82}
                stroke={isSelected ? entry.color : '#111827'}
                strokeOpacity={isSelected ? 1 : 0.22}
                strokeWidth={isSelected ? 1.25 : 1}
                opacity={isSelected ? 1 : 0.75}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={badgeX}
                y={badgeY}
                data-testid={props.badgeTestId}
                data-stroke-serial={entry.serial}
                data-stroke-stack={entry.stackPosition}
                fontSize={13}
                fontWeight={isSelected ? 700 : 600}
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fill={isSelected ? entry.color : '#111827'}
                stroke="#ffffff"
                strokeWidth={4}
                strokeLinejoin="round"
                opacity={isSelected ? 1 : 0.8}
                style={{ paintOrder: 'stroke', userSelect: 'none' }}
              >
                {label}
              </text>
            </g>
          );
        })}
        {/* 261024-mz5 Task 2: the selection union box and its five handles.
            Rendered only when the adapter can commit a transform. */}
        {selectionBox !== null && props.onTransformStrokes !== undefined ? (
          <g>
            <rect
              data-testid="stroke-transform-box"
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="none"
              stroke={TRANSFORM_HANDLE_COLOR}
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.9}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={selectionBox.x + selectionBox.width / 2}
              y1={selectionBox.y}
              x2={selectionBox.x + selectionBox.width / 2}
              y2={selectionBox.y - SCRIPT_TRANSFORM_ROTATE_STEM_PX}
              stroke={TRANSFORM_HANDLE_COLOR}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            {scriptStrokeTransformHandles(selectionBox).map((handle) =>
              handle.id === 'rotate' ? (
                <circle
                  key={handle.id}
                  data-testid="stroke-transform-handle-rotate"
                  cx={handle.x}
                  cy={handle.y}
                  r={SCRIPT_TRANSFORM_ROTATE_RADIUS_PX}
                  fill="#ffffff"
                  stroke={TRANSFORM_HANDLE_COLOR}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <rect
                  key={handle.id}
                  data-testid={`stroke-transform-handle-scale-${handle.id}`}
                  x={handle.x - SCRIPT_TRANSFORM_HANDLE_SIZE_PX / 2}
                  y={handle.y - SCRIPT_TRANSFORM_HANDLE_SIZE_PX / 2}
                  width={SCRIPT_TRANSFORM_HANDLE_SIZE_PX}
                  height={SCRIPT_TRANSFORM_HANDLE_SIZE_PX}
                  fill="#ffffff"
                  stroke={TRANSFORM_HANDLE_COLOR}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              ),
            )}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
