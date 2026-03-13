import {useRef} from 'preact/hooks';
import type {RefObject} from 'preact';
import type {Layer, LayerTransform} from '../../types/layer';
import {isFxLayer} from '../../types/layer';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
import {canvasStore} from '../../stores/canvasStore';
import {projectStore} from '../../stores/projectStore';
import {timelineStore} from '../../stores/timelineStore';
import {startCoalescing, stopCoalescing} from '../../lib/history';
import {clientToCanvas} from './coordinateMapper';
import {
  getLayerBounds,
  getHandlePositions,
  hitTestHandles,
  getRotationZone,
  getCursorForHandle,
  pointInPolygon,
} from './transformHandles';
import type {HandleType, LayerBounds} from './transformHandles';
import {hitTestLayers, hitTestLayersCycle} from './hitTest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransformOverlayProps {
  containerRef: RefObject<HTMLDivElement>;
  getSourceDimensions: (layer: Layer) => {w: number; h: number} | null;
  isSpaceHeld: RefObject<boolean>;
  onPanStart: (e: PointerEvent) => void;
}

type DragMode = 'none' | 'pending' | 'move' | 'scale' | 'rotate';

interface DragState {
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startLayerTransform: LayerTransform;
  handleType?: HandleType;
  layerId?: string;
  startBounds?: LayerBounds;
}

const DRAG_THRESHOLD = 4; // pixels

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransformOverlay({
  containerRef,
  getSourceDimensions,
  isSpaceHeld,
  onPanStart,
}: TransformOverlayProps) {
  const dragRef = useRef<DragState>({
    mode: 'none',
    startClientX: 0,
    startClientY: 0,
    startLayerTransform: {x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0},
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  // --- Derived state (read signals during render) ---
  const selectedId = layerStore.selectedLayerId.value;
  const layers = layerStore.layers.value;
  const isPlaying = timelineStore.isPlaying.value;
  const zoom = canvasStore.zoom.value;
  const projW = projectStore.width.value;
  const projH = projectStore.height.value;

  // Find selected layer
  const selectedLayer = selectedId ? layers.find((l) => l.id === selectedId) : null;

  // Don't render overlay during playback, or if no content layer selected
  if (isPlaying || !selectedLayer || isFxLayer(selectedLayer)) {
    return (
      <div
        style={{position: 'absolute', inset: 0, pointerEvents: 'all'}}
        onPointerDown={handlePointerDown}
      />
    );
  }

  // Get source dimensions and bounds
  const dims = getSourceDimensions(selectedLayer);
  if (!dims) {
    return (
      <div
        style={{position: 'absolute', inset: 0, pointerEvents: 'all'}}
        onPointerDown={handlePointerDown}
      />
    );
  }

  const bounds = getLayerBounds(selectedLayer, dims.w, dims.h, projW, projH);
  const handles = getHandlePositions(bounds, zoom);

  // Build bounding box polygon path (SVG)
  const [tl, tr, br, bl] = bounds.corners;
  const polyPoints = `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;

  // Counter-scale sizes for fixed screen-pixel appearance
  const strokeWidth = 1.5 / zoom;
  const cornerSize = 8 / zoom;
  const edgeSize = 6 / zoom;
  const borderWidth = 1 / zoom;

  // --- Event handlers ---

  function getProjectPoint(e: PointerEvent) {
    const container = containerRef.current;
    if (!container) return {x: 0, y: 0};
    const rect = container.getBoundingClientRect();
    return clientToCanvas(
      e.clientX,
      e.clientY,
      rect,
      canvasStore.zoom.peek(),
      canvasStore.panX.peek(),
      canvasStore.panY.peek(),
      projectStore.width.peek(),
      projectStore.height.peek(),
    );
  }

  function handlePointerDown(e: PointerEvent) {
    // Middle-click or Space+drag -> pan
    if (e.button === 1 || (e.button === 0 && isSpaceHeld.current)) {
      onPanStart(e);
      return;
    }

    // Only handle left-click from here
    if (e.button !== 0) return;

    const point = getProjectPoint(e);
    const currentZoom = canvasStore.zoom.peek();
    const pW = projectStore.width.peek();
    const pH = projectStore.height.peek();
    const currentLayers = layerStore.layers.peek();
    const currentSelectedId = layerStore.selectedLayerId.peek();
    const currentSelected = currentSelectedId ? currentLayers.find((l) => l.id === currentSelectedId) : null;

    // 1. If a layer is selected, hit-test handles first
    if (currentSelected && !isFxLayer(currentSelected)) {
      const selDims = getSourceDimensions(currentSelected);
      if (selDims) {
        const selBounds = getLayerBounds(currentSelected, selDims.w, selDims.h, pW, pH);
        const selHandles = getHandlePositions(selBounds, currentZoom);

        // Check handle hit
        const handleHit = hitTestHandles(point, selHandles, currentZoom);
        if (handleHit) {
          e.preventDefault();
          dragRef.current = {
            mode: 'pending',
            startClientX: e.clientX,
            startClientY: e.clientY,
            startLayerTransform: {...currentSelected.transform},
            handleType: handleHit,
            layerId: currentSelectedId!,
            startBounds: selBounds,
          };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }

        // Check rotation zone
        if (getRotationZone(point, selBounds, currentZoom)) {
          e.preventDefault();
          dragRef.current = {
            mode: 'pending',
            startClientX: e.clientX,
            startClientY: e.clientY,
            startLayerTransform: {...currentSelected.transform},
            handleType: 'rotate',
            layerId: currentSelectedId!,
            startBounds: selBounds,
          };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // 2. Hit-test layers
    const hitLayerId = e.altKey
      ? hitTestLayersCycle(point, currentLayers, pW, pH, getSourceDimensions, currentSelectedId)
      : hitTestLayers(point, currentLayers, pW, pH, getSourceDimensions);

    if (hitLayerId) {
      layerStore.setSelected(hitLayerId);
      uiStore.selectLayer(hitLayerId);
      const hitLayer = currentLayers.find((l) => l.id === hitLayerId);
      if (hitLayer) {
        e.preventDefault();
        dragRef.current = {
          mode: 'pending',
          startClientX: e.clientX,
          startClientY: e.clientY,
          startLayerTransform: {...hitLayer.transform},
          layerId: hitLayerId,
        };
        const hitDims = getSourceDimensions(hitLayer);
        if (hitDims) {
          dragRef.current.startBounds = getLayerBounds(hitLayer, hitDims.w, hitDims.h, pW, pH);
        }
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }

    // 3. Nothing hit -> deselect
    layerStore.setSelected(null);
    uiStore.selectLayer(null);
  }

  function handlePointerMove(e: PointerEvent) {
    const state = dragRef.current;

    if (state.mode === 'none') {
      // Update cursor based on what's under the pointer
      updateCursor(e);
      return;
    }

    if (state.mode === 'pending') {
      const dist = Math.hypot(e.clientX - state.startClientX, e.clientY - state.startClientY);
      if (dist < DRAG_THRESHOLD) return;

      // Transition to actual mode
      if (state.handleType === 'rotate') {
        dragRef.current = {...state, mode: 'rotate'};
      } else if (state.handleType) {
        dragRef.current = {...state, mode: 'scale'};
      } else {
        dragRef.current = {...state, mode: 'move'};
      }
      startCoalescing();
    }

    const currentState = dragRef.current;
    const currentZoom = canvasStore.zoom.peek();

    if (currentState.mode === 'move') {
      const dx = (e.clientX - currentState.startClientX) / currentZoom;
      const dy = (e.clientY - currentState.startClientY) / currentZoom;
      layerStore.updateLayer(currentState.layerId!, {
        transform: {
          ...currentState.startLayerTransform,
          x: currentState.startLayerTransform.x + dx,
          y: currentState.startLayerTransform.y + dy,
        },
      });
    } else if (currentState.mode === 'scale') {
      applyScale(e, currentState);
    } else if (currentState.mode === 'rotate') {
      applyRotation(e, currentState);
    }
  }

  function applyScale(e: PointerEvent, state: DragState) {
    if (!state.startBounds || !state.layerId) return;

    const mouse = getProjectPoint(e);
    const startMouse = getProjectPointFromClient(state.startClientX, state.startClientY);
    const center = state.startBounds.center;

    const startDist = Math.hypot(startMouse.x - center.x, startMouse.y - center.y);
    const currentDist = Math.hypot(mouse.x - center.x, mouse.y - center.y);

    if (startDist < 1) return;
    const scaleFactor = currentDist / startDist;

    const ht = state.handleType;
    if (ht?.startsWith('corner')) {
      // Uniform scale
      layerStore.updateLayer(state.layerId, {
        transform: {
          ...state.startLayerTransform,
          scaleX: state.startLayerTransform.scaleX * scaleFactor,
          scaleY: state.startLayerTransform.scaleY * scaleFactor,
        },
      });
    } else if (ht === 'edge-left' || ht === 'edge-right') {
      // Project the mouse delta onto the horizontal axis (rotated)
      const rad = (state.startLayerTransform.rotation * Math.PI) / 180;
      const axisX = Math.cos(rad);
      const axisY = Math.sin(rad);

      const startProj = (startMouse.x - center.x) * axisX + (startMouse.y - center.y) * axisY;
      const currProj = (mouse.x - center.x) * axisX + (mouse.y - center.y) * axisY;

      if (Math.abs(startProj) < 1) return;
      const factor = currProj / startProj;

      layerStore.updateLayer(state.layerId, {
        transform: {
          ...state.startLayerTransform,
          scaleX: state.startLayerTransform.scaleX * factor,
        },
      });
    } else if (ht === 'edge-top' || ht === 'edge-bottom') {
      // Project the mouse delta onto the vertical axis (rotated)
      const rad = (state.startLayerTransform.rotation * Math.PI) / 180;
      const axisX = -Math.sin(rad);
      const axisY = Math.cos(rad);

      const startProj = (startMouse.x - center.x) * axisX + (startMouse.y - center.y) * axisY;
      const currProj = (mouse.x - center.x) * axisX + (mouse.y - center.y) * axisY;

      if (Math.abs(startProj) < 1) return;
      const factor = currProj / startProj;

      layerStore.updateLayer(state.layerId, {
        transform: {
          ...state.startLayerTransform,
          scaleY: state.startLayerTransform.scaleY * factor,
        },
      });
    }
  }

  function applyRotation(e: PointerEvent, state: DragState) {
    if (!state.startBounds || !state.layerId) return;

    const mouse = getProjectPoint(e);
    const startMouse = getProjectPointFromClient(state.startClientX, state.startClientY);
    const center = state.startBounds.center;

    const currentAngle = Math.atan2(mouse.y - center.y, mouse.x - center.x);
    const startAngle = Math.atan2(startMouse.y - center.y, startMouse.x - center.x);
    const deltaAngle = ((currentAngle - startAngle) * 180) / Math.PI;

    layerStore.updateLayer(state.layerId, {
      transform: {
        ...state.startLayerTransform,
        rotation: state.startLayerTransform.rotation + deltaAngle,
      },
    });
  }

  function getProjectPointFromClient(clientX: number, clientY: number) {
    const container = containerRef.current;
    if (!container) return {x: 0, y: 0};
    const rect = container.getBoundingClientRect();
    return clientToCanvas(
      clientX,
      clientY,
      rect,
      canvasStore.zoom.peek(),
      canvasStore.panX.peek(),
      canvasStore.panY.peek(),
      projectStore.width.peek(),
      projectStore.height.peek(),
    );
  }

  function handlePointerUp(e: PointerEvent) {
    const state = dragRef.current;

    if (state.mode === 'move' || state.mode === 'scale' || state.mode === 'rotate') {
      stopCoalescing();
    }

    dragRef.current = {
      mode: 'none',
      startClientX: 0,
      startClientY: 0,
      startLayerTransform: {x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0},
    };

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may not be active
    }
  }

  function updateCursor(e: PointerEvent) {
    const el = overlayRef.current;
    if (!el) return;

    const point = getProjectPoint(e);
    const currentZoom = canvasStore.zoom.peek();
    const pW = projectStore.width.peek();
    const pH = projectStore.height.peek();
    const currentLayers = layerStore.layers.peek();
    const currentSelectedId = layerStore.selectedLayerId.peek();
    const currentSelected = currentSelectedId ? currentLayers.find((l) => l.id === currentSelectedId) : null;

    if (currentSelected && !isFxLayer(currentSelected)) {
      const selDims = getSourceDimensions(currentSelected);
      if (selDims) {
        const selBounds = getLayerBounds(currentSelected, selDims.w, selDims.h, pW, pH);
        const selHandles = getHandlePositions(selBounds, currentZoom);

        const handleHit = hitTestHandles(point, selHandles, currentZoom);
        if (handleHit) {
          el.style.cursor = getCursorForHandle(handleHit, false, currentSelected.transform.rotation);
          return;
        }

        if (getRotationZone(point, selBounds, currentZoom)) {
          el.style.cursor = getCursorForHandle(null, true, currentSelected.transform.rotation);
          return;
        }

        if (pointInPolygon(point, selBounds.corners)) {
          el.style.cursor = 'move';
          return;
        }
      }
    }

    // Check if hovering over any layer (move cursor)
    const hitId = hitTestLayers(point, currentLayers, pW, pH, getSourceDimensions);
    if (hitId) {
      el.style.cursor = 'move';
      return;
    }

    el.style.cursor = 'default';
  }

  // --- Render ---

  return (
    <div
      ref={overlayRef}
      style={{position: 'absolute', inset: 0, pointerEvents: 'all'}}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Bounding box SVG */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        <polygon
          points={polyPoints}
          fill="none"
          stroke="#4A90D9"
          stroke-width={strokeWidth}
          vector-effect="non-scaling-stroke"
        />
      </svg>

      {/* Corner handles */}
      {handles.filter((h) => h.type.startsWith('corner')).map((h) => (
        <div
          key={h.type}
          style={{
            position: 'absolute',
            left: `${h.x}px`,
            top: `${h.y}px`,
            width: `${cornerSize}px`,
            height: `${cornerSize}px`,
            transform: 'translate(-50%, -50%)',
            background: 'white',
            border: `${borderWidth}px solid #4A90D9`,
            borderRadius: `${1 / zoom}px`,
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        />
      ))}

      {/* Edge midpoint handles */}
      {handles.filter((h) => h.type.startsWith('edge')).map((h) => (
        <div
          key={h.type}
          style={{
            position: 'absolute',
            left: `${h.x}px`,
            top: `${h.y}px`,
            width: `${edgeSize}px`,
            height: `${edgeSize}px`,
            transform: 'translate(-50%, -50%)',
            background: 'white',
            border: `${borderWidth}px solid #4A90D9`,
            borderRadius: `${1 / zoom}px`,
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}
