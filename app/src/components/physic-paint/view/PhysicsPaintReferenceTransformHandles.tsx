import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { PhotoReferenceTransform } from '../../../efx-paint/document/efxPaintDocument';
import { efxPaintVersion, getDocument, setPhotoReferenceTransform } from '../../../stores/efxPaintStore';
import { physicPaintStore, physicPaintVersion } from '../../../stores/physicPaintStore';
import { getReferenceBounds } from './PhysicsPaintReferenceTransform';
import {
  getHandlePositions,
  hitTestHandles,
  getRotationZone,
  pointInPolygon,
  getCursorForHandle,
} from '../../canvas/transformHandles';
import type { HandleType, LayerBounds } from '../../canvas/transformHandles';

/**
 * 50-05 (Task 2, S4): the interactive reference transform handles on the
 * monitor surface. Reuses the main editor `TransformOverlay` PATTERN
 * (counter-scaled fixed screen-pixel handles, drag-to-move body hit, corner
 * scale handles, rotation handle) but writes to the reference DISPLAY
 * properties via `setPhotoReferenceTransform` — NOT to `layerStore` /
 * `keyframeStore` (the reference is not a layer, D-13).
 *
 * Locked by default (D-13): while `transformLocked` is true the overlay has no
 * handles and no canvas grab — painting works normally. Unlocking enters
 * reference-transform mode: drag moves the reference, corner handles scale, the
 * rotation handle rotates; the overlay's `pointerEvents: all` intercepts
 * painting gestures. The transform is applied identically in all three modes
 * (what you align is what Reveal will reveal) and NEVER affects the flattened
 * raster or export (D-13, D-06).
 *
 * The geometry reads ACCEPTED canonical state only (no optimistic changes):
 * the bounds are computed from `track.transform` (the accepted display
 * transform) and the resolved source image's natural dimensions, in WORKING
 * space (the same space the ghost draws in — see `getReferenceBounds`). The
 * image dimensions are decoded async via `new Image()` from the frame-aligned
 * verdict's `dataUrl` and held in a signal (no useState — efx-preact-reactivity).
 */

export interface PhysicsPaintReferenceTransformHandlesProps {
  readonly layerId: string | null;
  readonly currentFrame: number;
  readonly isPlaying: boolean;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

interface DragState {
  mode: 'none' | 'pending' | 'move' | 'scale' | 'rotate';
  startClientX: number;
  startClientY: number;
  startTransform: PhotoReferenceTransform;
  handleType?: HandleType;
  startBounds?: LayerBounds;
}

const DRAG_THRESHOLD = 4; // pixels

const IDENTITY_TRANSFORM: PhotoReferenceTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

export function PhysicsPaintReferenceTransformHandles(props: PhysicsPaintReferenceTransformHandlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageSize = useSignal<{ w: number; h: number } | null>(null);
  const dragRef = useRef<DragState>({
    mode: 'none',
    startClientX: 0,
    startClientY: 0,
    startTransform: IDENTITY_TRANSFORM,
  });

  const { layerId, currentFrame, isPlaying, width, height, zoom } = props;

  // Decode the resolved source image's natural dimensions (async) so the
  // bounds can be computed. Gated on !isPlaying and a present layerId; a
  // missing track / missing verdict / decode failure clears the size
  // (fail-closed — no handles without a resolved source, D-04).
  useEffect(() => {
    if (isPlaying || !layerId) {
      imageSize.value = null;
      return;
    }
    const document = getDocument(layerId);
    if (!document) {
      imageSize.value = null;
      return;
    }
    const track = document.photoReference;
    if (!track || track.sourceFrameRefs.length === 0) {
      imageSize.value = null;
      return;
    }
    const verdict = physicPaintStore.getReferenceSourceFrameVerdict(layerId, currentFrame);
    if (!verdict) {
      imageSize.value = null;
      return;
    }
    const image = new Image();
    image.onload = () => {
      imageSize.value = { w: image.width, h: image.height };
    };
    image.onerror = () => {
      imageSize.value = null;
    };
    image.src = verdict.dataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the store version
    // clocks are read inside the effect's dep array (narrow leaf subscription,
    // never the Studio root); a source/transform change re-resolves the size.
  }, [layerId, currentFrame, isPlaying, efxPaintVersion.value, physicPaintVersion.value]);

  // Read accepted display state (narrow reads, no render-body writes).
  const document = layerId ? getDocument(layerId) : null;
  const track = document?.photoReference ?? null;
  const transformLocked = track?.transformLocked ?? true;
  const transform = track?.transform ?? IDENTITY_TRANSFORM;

  // Locked / playing / no resolved size / no track → no handles, no grab.
  if (transformLocked || isPlaying || !imageSize.value || !track) {
    return (
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      />
    );
  }

  const bounds = getReferenceBounds(transform, imageSize.value.w, imageSize.value.h, zoom, width, height);
  const handles = getHandlePositions(bounds, zoom);

  const [tl, tr, br, bl] = bounds.corners;
  const polyPoints = `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;

  // Counter-scaled fixed screen-pixel handle geometry (TransformOverlay pattern).
  const strokeWidth = 1.5 / zoom;
  const cornerSize = 8 / zoom;
  const edgeSize = 6 / zoom;

  // 50-UAT (D-13 spec gap fix): the VISIBLE rotation handle — a stem + circle
  // above the top-edge midpoint along the box's outward normal, counter-scaled
  // to a fixed 20px stem / 5px knob on screen. The corner rotation zones stay
  // (drag near a corner also rotates); the knob makes rotation discoverable.
  const topMid = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
  const normalX = topMid.x - bounds.center.x;
  const normalY = topMid.y - bounds.center.y;
  const normalLen = Math.hypot(normalX, normalY) || 1;
  const rotHandle = {
    x: topMid.x + (normalX / normalLen) * (20 / zoom),
    y: topMid.y + (normalY / normalLen) * (20 / zoom),
  };
  const rotHandleRadius = 5 / zoom;
  const rotHandleHitRadius = 8 / zoom;

  function getWorkingPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left) * (width / rect.width),
      y: (clientY - rect.top) * (height / rect.height),
    };
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const point = getWorkingPointFromClient(e.clientX, e.clientY);

    // 50-UAT (D-13 spec): the visible rotation knob is a direct rotate target —
    // checked BEFORE the corner/edge handles and the corner rotation zone.
    const rotDx = point.x - rotHandle.x;
    const rotDy = point.y - rotHandle.y;
    if (rotDx * rotDx + rotDy * rotDy <= rotHandleHitRadius * rotHandleHitRadius) {
      e.preventDefault();
      dragRef.current = {
        mode: 'pending',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTransform: { ...transform },
        handleType: 'rotate',
        startBounds: bounds,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    const handleHit = hitTestHandles(point, handles, zoom);
    if (handleHit) {
      e.preventDefault();
      dragRef.current = {
        mode: 'pending',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTransform: { ...transform },
        handleType: handleHit,
        startBounds: bounds,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (getRotationZone(point, bounds, zoom)) {
      e.preventDefault();
      dragRef.current = {
        mode: 'pending',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTransform: { ...transform },
        handleType: 'rotate',
        startBounds: bounds,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (pointInPolygon(point, bounds.corners)) {
      e.preventDefault();
      dragRef.current = {
        mode: 'pending',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTransform: { ...transform },
        startBounds: bounds,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
  }

  function handlePointerMove(e: PointerEvent) {
    const state = dragRef.current;
    if (state.mode === 'none') return;

    if (state.mode === 'pending') {
      const dist = Math.hypot(e.clientX - state.startClientX, e.clientY - state.startClientY);
      if (dist < DRAG_THRESHOLD) return;
      if (state.handleType === 'rotate') {
        dragRef.current = { ...state, mode: 'rotate' };
      } else if (state.handleType) {
        dragRef.current = { ...state, mode: 'scale' };
      } else {
        dragRef.current = { ...state, mode: 'move' };
      }
    }

    const current = dragRef.current;
    if (current.mode === 'move') applyMove(e, current);
    else if (current.mode === 'scale') applyScale(e, current);
    else if (current.mode === 'rotate') applyRotation(e, current);
  }

  function applyMove(e: PointerEvent, state: DragState) {
    const start = getWorkingPointFromClient(state.startClientX, state.startClientY);
    const current = getWorkingPointFromClient(e.clientX, e.clientY);
    const dx = (current.x - start.x) / zoom;
    const dy = (current.y - start.y) / zoom;
    setPhotoReferenceTransform(layerId!, {
      ...state.startTransform,
      x: state.startTransform.x + dx,
      y: state.startTransform.y + dy,
    });
  }

  function applyScale(e: PointerEvent, state: DragState) {
    if (!state.startBounds) return;
    const mouse = getWorkingPointFromClient(e.clientX, e.clientY);
    const startMouse = getWorkingPointFromClient(state.startClientX, state.startClientY);
    const center = state.startBounds.center;

    const startDist = Math.hypot(startMouse.x - center.x, startMouse.y - center.y);
    const currentDist = Math.hypot(mouse.x - center.x, mouse.y - center.y);
    if (startDist < 1) return;
    const scaleFactor = currentDist / startDist;

    const ht = state.handleType;
    if (ht?.startsWith('corner')) {
      setPhotoReferenceTransform(layerId!, {
        ...state.startTransform,
        scaleX: state.startTransform.scaleX * scaleFactor,
        scaleY: state.startTransform.scaleY * scaleFactor,
      });
    } else if (ht === 'edge-left' || ht === 'edge-right') {
      const rad = (state.startTransform.rotation * Math.PI) / 180;
      const axisX = Math.cos(rad);
      const axisY = Math.sin(rad);
      const startProj = (startMouse.x - center.x) * axisX + (startMouse.y - center.y) * axisY;
      const currProj = (mouse.x - center.x) * axisX + (mouse.y - center.y) * axisY;
      if (Math.abs(startProj) < 1) return;
      const factor = currProj / startProj;
      setPhotoReferenceTransform(layerId!, {
        ...state.startTransform,
        scaleX: state.startTransform.scaleX * factor,
      });
    } else if (ht === 'edge-top' || ht === 'edge-bottom') {
      const rad = (state.startTransform.rotation * Math.PI) / 180;
      const axisX = -Math.sin(rad);
      const axisY = Math.cos(rad);
      const startProj = (startMouse.x - center.x) * axisX + (startMouse.y - center.y) * axisY;
      const currProj = (mouse.x - center.x) * axisX + (mouse.y - center.y) * axisY;
      if (Math.abs(startProj) < 1) return;
      const factor = currProj / startProj;
      setPhotoReferenceTransform(layerId!, {
        ...state.startTransform,
        scaleY: state.startTransform.scaleY * factor,
      });
    }
  }

  function applyRotation(e: PointerEvent, state: DragState) {
    if (!state.startBounds) return;
    const mouse = getWorkingPointFromClient(e.clientX, e.clientY);
    const startMouse = getWorkingPointFromClient(state.startClientX, state.startClientY);
    const center = state.startBounds.center;

    const currentAngle = Math.atan2(mouse.y - center.y, mouse.x - center.x);
    const startAngle = Math.atan2(startMouse.y - center.y, startMouse.x - center.x);
    const deltaAngle = ((currentAngle - startAngle) * 180) / Math.PI;

    setPhotoReferenceTransform(layerId!, {
      ...state.startTransform,
      rotation: state.startTransform.rotation + deltaAngle,
    });
  }

  function handlePointerUp(e: PointerEvent) {
    dragRef.current = {
      mode: 'none',
      startClientX: 0,
      startClientY: 0,
      startTransform: IDENTITY_TRANSFORM,
    };
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may not be active.
    }
  }

  // 50-UAT (bounds-only capture): the overlay container is pointer-events NONE
  // so painting outside the reference passes through to the engine canvas. The
  // SVG children (bounds polygon, rotation-zone circles, handle rects) are the
  // ONLY hit targets — each carries pointer-events: all and bubbles to the SVG
  // root's handlers. The handler logic (hitTestHandles → getRotationZone →
  // pointInPolygon) is unchanged; the SVG hit-testing only decides WHETHER the
  // event fires at all.
  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-label="Reference transform"
    >
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <polygon
          points={polyPoints}
          fill="transparent"
          stroke="#4A90D9"
          stroke-width={strokeWidth}
          vector-effect="non-scaling-stroke"
          style={{ pointerEvents: 'all', cursor: 'move' }}
        />
        {/* 50-UAT (D-13 spec): the VISIBLE rotation handle — a decorative stem
            (pointer-events none, pass-through) plus an interactive knob that
            enters rotate mode (handlePointerDown's direct rotation target). */}
        <line
          x1={topMid.x}
          y1={topMid.y}
          x2={rotHandle.x}
          y2={rotHandle.y}
          stroke="#4A90D9"
          stroke-width={strokeWidth}
          vector-effect="non-scaling-stroke"
          aria-hidden="true"
        />
        <circle
          cx={rotHandle.x}
          cy={rotHandle.y}
          r={rotHandleRadius}
          fill="white"
          stroke="#4A90D9"
          stroke-width={strokeWidth}
          vector-effect="non-scaling-stroke"
          style={{ pointerEvents: 'all', cursor: getCursorForHandle(null, true, transform.rotation) }}
        />
        {/* Rotation-zone hit circles — one per corner, radius = the 15px screen
            rotation zone (getRotationZone). Transparent fill + pointer-events
            all; the handler disambiguates rotate vs move by pointInPolygon. */}
        {bounds.corners.map((corner, index) => (
          <circle
            key={`rotation-zone-${index}`}
            cx={corner.x}
            cy={corner.y}
            r={15 / zoom}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: 'grab' }}
          />
        ))}
        {handles.filter((h) => h.type.startsWith('corner')).map((h) => (
          <rect
            key={h.type}
            x={h.x - cornerSize / 2}
            y={h.y - cornerSize / 2}
            width={cornerSize}
            height={cornerSize}
            fill="white"
            stroke="#4A90D9"
            stroke-width={strokeWidth}
            vector-effect="non-scaling-stroke"
            style={{ pointerEvents: 'all' }}
          />
        ))}
        {handles.filter((h) => h.type.startsWith('edge')).map((h) => (
          <rect
            key={h.type}
            x={h.x - edgeSize / 2}
            y={h.y - edgeSize / 2}
            width={edgeSize}
            height={edgeSize}
            fill="white"
            stroke="#4A90D9"
            stroke-width={strokeWidth}
            vector-effect="non-scaling-stroke"
            style={{ pointerEvents: 'all' }}
          />
        ))}
      </svg>
    </div>
  );
}
