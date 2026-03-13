import {useRef, useCallback, useEffect} from 'preact/hooks';
import {useSignal} from '@preact/signals';
import {Preview} from '../Preview';
import {SpeedBadge} from '../overlay/SpeedBadge';
import {TransformOverlay} from '../canvas/TransformOverlay';
import {timelineStore} from '../../stores/timelineStore';
import {canvasStore} from '../../stores/canvasStore';
import {projectStore} from '../../stores/projectStore';
import {imageStore} from '../../stores/imageStore';
import {playbackEngine} from '../../lib/playbackEngine';
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
    // Base layer (empty imageIds): use project dimensions as approximation
    return {w: projectStore.width.peek(), h: projectStore.height.peek()};
  }
  if (layer.source.type === 'video') {
    // Video: use project dimensions as approximation
    return {w: projectStore.width.peek(), h: projectStore.height.peek()};
  }
  return null;
}

export function CanvasArea() {
  const isPlaying = timelineStore.isPlaying.value;
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
    // Mark that a drag happened during Space hold (for play/pause suppression)
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

  // --- Space+drag pan tracking ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Only track space if focus is on the canvas area (not inside inputs)
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        isSpaceHeld.current = true;
        spaceDragOccurred.current = false;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceHeld.current = false;

        // If Space+drag occurred, suppress play/pause toggle
        if (spaceDragOccurred.current) {
          spaceDragOccurred.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
        // If no drag occurred, let the global shortcut handle play/pause toggle
      }
    };

    // Listen on window to catch Space regardless of focused element
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

  return (
    <div class="relative flex flex-col items-center justify-center flex-1 min-h-0 bg-[var(--color-bg-right)]">
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
          class="relative rounded bg-black overflow-visible shrink-0"
        >
          <Preview />
          <TransformOverlay
            containerRef={containerRef}
            getSourceDimensions={getSourceDimensionsForLayer}
            isSpaceHeld={isSpaceHeld}
            onPanStart={startPan}
          />
        </div>
      </div>
      {/* JKL speed badge -- positioned above playback controls */}
      <SpeedBadge />
      {/* Preview Controls */}
      <div class="flex items-center justify-center gap-3 w-full h-[42px] px-5 shrink-0">
        {/* Step backward */}
        <button
          class="flex items-center justify-center w-8 h-8 rounded bg-[var(--color-bg-settings)] cursor-pointer"
          onClick={() => playbackEngine.stepBackward()}
          title="Step backward"
        >
          <span class="text-xs text-[var(--color-text-secondary)]">{'\u23EE'}</span>
        </button>
        {/* Play / Pause */}
        <button
          class="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-accent)] cursor-pointer"
          onClick={() => playbackEngine.toggle()}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <span class="text-sm text-white">
            {isPlaying ? '\u23F8' : '\u25B6'}
          </span>
        </button>
        {/* Step forward */}
        <button
          class="flex items-center justify-center w-8 h-8 rounded bg-[var(--color-bg-settings)] cursor-pointer"
          onClick={() => playbackEngine.stepForward()}
          title="Step forward"
        >
          <span class="text-xs text-[var(--color-text-secondary)]">{'\u23ED'}</span>
        </button>
        {/* Timecode display */}
        <div class="rounded bg-[var(--color-bg-input)] px-3 py-1.5">
          <span class="text-[13px] font-semibold text-[var(--color-text-heading)]">
            {formatTime(timelineStore.displayTime.value)}
          </span>
        </div>
        <span class="text-xs text-[var(--color-text-dim)]">
          / {formatTime(timelineStore.totalDuration.value)}
        </span>
        {/* Zoom controls cluster: [ - ] percentage [ + ] [ Fit ] */}
        <button
          class={`rounded-[5px] px-2.5 py-1 ${
            canvasStore.isAtMinZoom.value
              ? 'bg-[var(--color-bg-settings)] opacity-40 cursor-default'
              : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] cursor-pointer'
          }`}
          onClick={() => canvasStore.zoomOut()}
          title="Zoom out (-)"
        >
          <span class="text-sm text-[var(--color-text-button)]">-</span>
        </button>
        <span class="text-[11px] text-[var(--color-text-dim)]">
          {canvasStore.zoomPercent.value}%
        </span>
        <button
          class={`rounded-[5px] px-2.5 py-1 ${
            canvasStore.isAtMaxZoom.value
              ? 'bg-[var(--color-bg-settings)] opacity-40 cursor-default'
              : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] cursor-pointer'
          }`}
          onClick={() => canvasStore.zoomIn()}
          title="Zoom in (=)"
        >
          <span class="text-sm text-[var(--color-text-button)]">+</span>
        </button>
        {/* Fit button (toggles fit lock) */}
        <button
          class={`rounded px-2.5 py-1.5 cursor-pointer ${
            canvasStore.fitLocked.value
              ? 'bg-[var(--color-accent)]'
              : 'bg-[var(--color-bg-settings)]'
          }`}
          onClick={() => canvasStore.toggleFitLock()}
          title={canvasStore.fitLocked.value ? 'Fit to window \u2014 locked (F)' : 'Fit to window (F)'}
        >
          <span class={`text-[11px] ${
            canvasStore.fitLocked.value
              ? 'text-white'
              : 'text-[var(--color-text-secondary)]'
          }`}>
            Fit
          </span>
        </button>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}
