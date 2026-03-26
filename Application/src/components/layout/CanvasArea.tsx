import {useRef, useCallback, useEffect} from 'preact/hooks';
import {useSignal} from '@preact/signals';
import {Plus, Minus, Maximize, Maximize2, Minimize2, Paintbrush} from 'lucide-preact';
import {Preview} from '../Preview';
import {SpeedBadge} from '../overlay/SpeedBadge';
import {FullSpeedBadge} from '../overlay/FullSpeedBadge';
import {TransformOverlay} from '../canvas/TransformOverlay';
import {PaintOverlay} from '../canvas/PaintOverlay';
import {MotionPath} from '../canvas/MotionPath';
import {OnionSkinOverlay} from '../canvas/OnionSkinOverlay';
import {PaintToolbar} from '../overlay/PaintToolbar';
import {timelineStore} from '../../stores/timelineStore';
import {canvasStore} from '../../stores/canvasStore';
import {paintStore} from '../../stores/paintStore';
import {projectStore} from '../../stores/projectStore';
import {imageStore} from '../../stores/imageStore';
import {uiStore} from '../../stores/uiStore';
import {layerStore} from '../../stores/layerStore';
import {playbackEngine, isFullSpeed} from '../../lib/playbackEngine';
import {isFullscreen, enterFullscreen} from '../../lib/fullscreenManager';
import {activeSequenceFrames} from '../../lib/frameMap';
import type {Layer} from '../../types/layer';

/** Safari macOS gesture event interface */
interface GestureEvent extends UIEvent {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
}

/**
 * Get source dimensions for a layer from imageStore metadata.
 * Used by TransformOverlay for bounding box calculation.
 */
function getSourceDimensionsForLayer(layer: Layer): {w: number; h: number} | null {
  if (layer.source.type === 'static-image') {
    const img = imageStore.getById(layer.source.imageId);
    if (img) return {w: img.width, h: img.height};
    return null;
  }
  if (layer.source.type === 'image-sequence') {
    // For image sequences, use the first image's dimensions
    const ids = layer.source.imageIds;
    if (ids.length > 0) {
      const img = imageStore.getById(ids[0]);
      if (img) return {w: img.width, h: img.height};
    }
    // Base layer (empty imageIds): look up actual image from current frame
    const frames = activeSequenceFrames.peek();
    if (frames.length > 0) {
      const frame = frames[timelineStore.currentFrame.peek()] ?? frames[0];
      if (frame) {
        const img = imageStore.getById(frame.imageId);
        if (img) return {w: img.width, h: img.height};
      }
    }
    return {w: projectStore.width.peek(), h: projectStore.height.peek()};
  }
  if (layer.source.type === 'video') {
    // Video: use project dimensions as approximation
    return {w: projectStore.width.peek(), h: projectStore.height.peek()};
  }
  return null;
}

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useSignal(false);
  const isSpaceHeld = useRef(false);
  const spaceDragOccurred = useRef(false);

  // Drag state for panning (start coordinates, not reactive)
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // --- Zoom handler: Cmd/Ctrl + scroll ---
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();

    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left - rect.width / 2;
    const cursorY = e.clientY - rect.top - rect.height / 2;

    const oldZoom = canvasStore.zoom.peek();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = oldZoom * factor;
    canvasStore.setSmoothZoom(newZoom, cursorX, cursorY);
  }, []);

  // --- Pan handler: middle-click drag (left-click no longer pans) ---
  const startPan = useCallback((e: PointerEvent) => {
    e.preventDefault();
    const drag = dragRef.current;
    isDragging.value = true;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.startPanX = canvasStore.panX.value;
    drag.startPanY = canvasStore.panY.value;
    // Capture on the container, not the overlay that triggered this
    const container = containerRef.current;
    if (container) {
      container.setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    // Middle mouse button starts pan
    if (e.button === 1) {
      startPan(e);
    }
    // Left-click no longer starts pan -- handled by TransformOverlay
  }, [startPan]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.value) return;
    const drag = dragRef.current;
    const z = canvasStore.zoom.value;
    canvasStore.setPan(
      drag.startPanX + (e.clientX - drag.startX) / z,
      drag.startPanY + (e.clientY - drag.startY) / z,
    );
    if (isSpaceHeld.current) {
      spaceDragOccurred.current = true;
    }
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!isDragging.value) return;
    isDragging.value = false;
    try {
      const container = containerRef.current;
      if (container) {
        container.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Pointer capture may not be active
    }
  }, []);

  // --- Space: hold for pan mode, tap for play/pause ---
  // --- P key: toggle paint mode ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        isSpaceHeld.current = true;
        spaceDragOccurred.current = false;
      }
      // P key: toggle paint mode (only when a paint layer is selected)
      if (e.code === 'KeyP' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        const selId = layerStore.selectedLayerId.peek();
        if (selId) {
          const all = layerStore.layers.peek();
          const ovl = layerStore.overlayLayers.peek();
          const sel = all.find(l => l.id === selId) ?? ovl.find(l => l.id === selId);
          if (sel?.type === 'paint') paintStore.togglePaintMode();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const wasHeld = isSpaceHeld.current;
        isSpaceHeld.current = false;
        if (!wasHeld) return;

        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

        if (!spaceDragOccurred.current) {
          if (e.shiftKey) {
            // Shift+Space: toggle full-speed playback
            playbackEngine.toggleFullSpeed();
          } else {
            // In fullscreen, plain Space also uses full-speed
            if (isFullscreen.peek()) {
              if (timelineStore.isPlaying.peek()) {
                playbackEngine.stop();
              } else {
                isFullSpeed.value = true;
                playbackEngine.start();
              }
            } else {
              // Plain Space: toggle play/pause
              playbackEngine.toggle();
            }
          }
        }
        spaceDragOccurred.current = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // --- ResizeObserver: track container dimensions ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const padding = 32; // p-4 = 16px * 2
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const {width, height} = entry.contentRect;
        canvasStore.updateContainerSize(width - padding, height - padding);
        if (canvasStore.fitLocked.peek()) {
          canvasStore.fitToWindow();
        }
      }
    });
    observer.observe(el);

    // Initial measurement and fit
    const rect = el.getBoundingClientRect();
    canvasStore.updateContainerSize(rect.width - padding, rect.height - padding);
    canvasStore.fitToWindow();

    return () => observer.disconnect();
  }, []);

  // --- Pinch-to-zoom: macOS GestureEvent ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onGestureStart = (e: Event) => {
      e.preventDefault();
    };

    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as unknown as GestureEvent;
      const rect = el.getBoundingClientRect();
      const cursorX = (ge.clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
      const cursorY = (ge.clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
      const newZoom = canvasStore.zoom.peek() * ge.scale;
      canvasStore.setSmoothZoom(newZoom, cursorX, cursorY);
    };

    el.addEventListener('gesturestart', onGestureStart, {passive: false});
    el.addEventListener('gesturechange', onGestureChange, {passive: false});

    return () => {
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, []);

  // Cursor: grabbing while panning, default otherwise
  // (TransformOverlay manages its own cursor for layer interactions)
  const cursorStyle = isDragging.value ? 'grabbing' : 'default';

  // Determine if paint mode overlay should be active
  const selectedId = layerStore.selectedLayerId.value;
  const allLayers = layerStore.layers.value;
  const overlayLayers = layerStore.overlayLayers.value;
  const selectedLayer = selectedId
    ? (allLayers.find(l => l.id === selectedId) ?? overlayLayers.find(l => l.id === selectedId) ?? null)
    : null;
  const hasPaintLayerSelected = selectedLayer?.type === 'paint';
  // In paint mode, force-keep the paint layer selected (sticky mode)
  if (paintStore.paintMode.value && !hasPaintLayerSelected && selectedId) {
    // Another layer was clicked — re-select the paint layer instead
    const paintLayer = allLayers.find(l => l.type === 'paint') ?? overlayLayers.find(l => l.type === 'paint');
    if (paintLayer) {
      layerStore.setSelected(paintLayer.id);
    } else {
      // No paint layer exists anymore — deactivate paint mode
      paintStore.paintMode.value = false;
    }
  }
  const isPaintModeActive = paintStore.paintMode.value && hasPaintLayerSelected;

  return (
    <div
      class="relative flex flex-col items-center justify-center flex-1 min-h-0 bg-(--color-bg-right)"
      onMouseEnter={() => uiStore.setMouseRegion('canvas')}
      onMouseLeave={() => uiStore.setMouseRegion('other')}
    >
      {/* Paint toolbar in controls bar when in paint mode */}
      {isPaintModeActive && (
        <div class="flex items-center justify-center w-full h-[42px] px-2 shrink-0">
          <PaintToolbar />
        </div>
      )}
      {/* Preview Controls (zoom, fit, fullscreen) — hidden in paint mode */}
      <div class="flex items-center justify-center gap-3 w-full h-[42px] px-5 shrink-0"
        style={isPaintModeActive ? {display: 'none'} : undefined}
      >
        {/* Paint mode toggle button (only active when a paint layer is selected) */}
        <button
          class={`rounded p-1.5 transition-colors ${
            isPaintModeActive
              ? 'bg-(--color-accent) text-white'
              : hasPaintLayerSelected
                ? 'bg-(--color-bg-settings) hover:bg-(--color-bg-input) text-(--color-text-secondary)'
                : 'bg-(--color-bg-settings) text-(--color-text-secondary) opacity-40 cursor-not-allowed'
          }`}
          onClick={() => hasPaintLayerSelected && paintStore.togglePaintMode()}
          title={!hasPaintLayerSelected ? 'Select a paint layer first' : isPaintModeActive ? 'Exit paint mode (P)' : 'Enter paint mode (P)'}
          disabled={!hasPaintLayerSelected}
        >
          <Paintbrush size={14} />
        </button>
        {/* Zoom controls — hidden in paint mode (paint toolbar replaces them) */}
        {!isPaintModeActive && (<>
          <button
            class={`rounded-[5px] px-2.5 py-1 text-(--color-text-button) ${
              canvasStore.isAtMinZoom.value
                ? 'bg-(--color-bg-settings) opacity-40 cursor-default'
                : 'bg-(--color-bg-settings) hover:bg-(--color-bg-input) cursor-pointer'
            }`}
            onClick={() => canvasStore.zoomOut()}
            title="Zoom out (-)"
          >
            <Minus size={16} />
          </button>
          <span class="text-[11px] text-(--color-text-dim)">
            {canvasStore.zoomPercent.value}%
          </span>
          <button
            class={`rounded-[5px] px-2.5 py-1 text-(--color-text-button) ${
              canvasStore.isAtMaxZoom.value
                ? 'bg-(--color-bg-settings) opacity-40 cursor-default'
                : 'bg-(--color-bg-settings) hover:bg-(--color-bg-input) cursor-pointer'
            }`}
            onClick={() => canvasStore.zoomIn()}
            title="Zoom in (=)"
          >
            <Plus size={16} />
          </button>
          <button
            class={`rounded px-2.5 py-1.5 cursor-pointer transition-colors ${
              canvasStore.fitLocked.value
                ? 'bg-(--color-accent) text-white hover:brightness-125'
                : 'bg-(--color-bg-settings) text-(--color-text-secondary) hover:bg-(--color-bg-input) hover:text-white'
            }`}
            onClick={() => canvasStore.toggleFitLock()}
            title={canvasStore.fitLocked.value ? 'Fit to window \u2014 locked (F)' : 'Fit to window (F)'}
          >
            {canvasStore.fitLocked.value ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            class="rounded px-2.5 py-1.5 bg-(--color-bg-settings) hover:bg-(--color-bg-input) cursor-pointer text-(--color-text-secondary)"
            onClick={() => enterFullscreen()}
            title="Fullscreen (\u21E7\u2318F)"
          >
            <Maximize size={16} />
          </button>
        </>)}
        {/* Full-speed indicator */}
        <FullSpeedBadge />
      </div>
      {/* Preview Frame with zoom/pan */}
      <div
        ref={containerRef}
        class="flex items-center justify-center flex-1 w-full min-h-0 p-4 overflow-hidden"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{cursor: cursorStyle}}
      >
        <div
          style={{
            width: `${projectStore.width.value}px`,
            height: `${projectStore.height.value}px`,
            transform: `scale(${canvasStore.zoom.value}) translate(${canvasStore.panX.value}px, ${canvasStore.panY.value}px)`,
            transformOrigin: 'center center',
          }}
          data-canvas-area
          class={`relative rounded bg-black overflow-visible shrink-0 border-2 ${
            isPaintModeActive ? 'border-(--color-accent)' : 'border-transparent'
          }`}
        >
          <Preview />
          <MotionPath />
          {isPaintModeActive && paintStore.onionSkinEnabled.value && (
            <OnionSkinOverlay />
          )}
          {isPaintModeActive ? (
            <PaintOverlay
              containerRef={containerRef}
              isSpaceHeld={isSpaceHeld}
              onPanStart={startPan}
            />
          ) : (
            <TransformOverlay
              containerRef={containerRef}
              getSourceDimensions={getSourceDimensionsForLayer}
              isSpaceHeld={isSpaceHeld}
              onPanStart={startPan}
            />
          )}
        </div>
      </div>
      {/* Paint toolbar now renders in the controls bar above */}
      {/* JKL speed badge */}
      <SpeedBadge />
    </div>
  );
}
