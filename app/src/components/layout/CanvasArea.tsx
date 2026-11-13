import {useRef, useCallback, useEffect} from 'preact/hooks';
import {useSignal} from '@preact/signals';
import {Plus, Minus, Maximize, Paintbrush, Hand} from 'lucide-preact';
import {Preview} from '../Preview';
import {SpeedBadge} from '../overlay/SpeedBadge';
import {FullSpeedBadge} from '../overlay/FullSpeedBadge';
import {TransformOverlay} from '../canvas/TransformOverlay';
import {PaintOverlay} from '../canvas/PaintOverlay';
import {MotionPath} from '../canvas/MotionPath';
import {OnionSkinOverlay} from '../canvas/OnionSkinOverlay';
import {PaintToolbar} from '../overlay/PaintToolbar';
import {InlineColorPicker} from '../sidebar/InlineColorPicker';
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
      // 52.3-01 (D-01): activeSequenceFrames is kind-agnostic and can return
      // paint entries when an fx sequence is active — only content carries imageId.
      if (frame && frame.kind === 'content') {
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

interface HandPanSession {
  readonly pointerId: number;
  readonly target: HTMLButtonElement;
  readonly startX: number;
  readonly startY: number;
  readonly startPanX: number;
  readonly startPanY: number;
  readonly onMove: (event: PointerEvent) => void;
  readonly onEnd: (event: PointerEvent) => void;
}

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useSignal(false);
  const isSpaceHeld = useRef(false);
  const spaceDragOccurred = useRef(false);
  const handSessionRef = useRef<HandPanSession | null>(null);
  // The pill hides unless the pointer is on the canvas; a live Hand press
  // keeps it up even when the drag carries the pointer outside the surface.
  const isHandPanning = useSignal(false);

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

  // --- Hand: press-and-hold pan button (mirrors the Studio's zoom pill) ---
  // The canvas transform is `scale(z) translate(px, py)`, so pan values are
  // pre-scale: a pointer delta in CSS pixels divides by the zoom.
  const endHandSession = useCallback((pointerId?: number) => {
    const session = handSessionRef.current;
    if (!session) return;
    if (pointerId !== undefined && session.pointerId !== pointerId) return;
    handSessionRef.current = null;
    isHandPanning.value = false;
    session.target.removeEventListener('pointermove', session.onMove);
    session.target.removeEventListener('pointerup', session.onEnd);
    session.target.removeEventListener('pointercancel', session.onEnd);
    session.target.removeEventListener('lostpointercapture', session.onEnd);
    try {
      if (session.target.hasPointerCapture(session.pointerId)) {
        session.target.releasePointerCapture(session.pointerId);
      }
    } catch {
      // Capture may already be gone with the pointer.
    }
    session.target.style.cursor = '';
  }, []);

  // A window unmounting mid-press must never leave a captured pointer behind.
  useEffect(() => () => {
    const session = handSessionRef.current;
    if (session) endHandSession(session.pointerId);
  }, [endHandSession]);

  const beginHandSession = useCallback((event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLButtonElement;
    const pointerId = event.pointerId;
    const session: HandPanSession = {
      pointerId,
      target,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: canvasStore.panX.peek(),
      startPanY: canvasStore.panY.peek(),
      onMove: (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        moveEvent.preventDefault();
        const zoom = canvasStore.zoom.peek() || 1;
        canvasStore.setPan(
          session.startPanX + (moveEvent.clientX - session.startX) / zoom,
          session.startPanY + (moveEvent.clientY - session.startY) / zoom,
        );
      },
      onEnd: (endEvent) => {
        if (endEvent.pointerId !== pointerId) return;
        endEvent.preventDefault();
        endHandSession(pointerId);
      },
    };
    handSessionRef.current = session;
    isHandPanning.value = true;
    target.style.cursor = 'grabbing';
    target.addEventListener('pointermove', session.onMove, { passive: false });
    target.addEventListener('pointerup', session.onEnd);
    target.addEventListener('pointercancel', session.onEnd);
    target.addEventListener('lostpointercapture', session.onEnd);
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // Capture is best-effort; without it the press simply ends early.
    }
  }, [endHandSession]);

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
      {/* Paint toolbar when in paint mode */}
      {isPaintModeActive && (
        <div class="flex items-center justify-center w-full pt-4 pb-2 px-2 shrink-0">
          <PaintToolbar />
        </div>
      )}
      {/* Canvas row: optional color picker + canvas */}
      <div class="flex flex-1 w-full min-h-0">
        {/* Inline color picker panel - vertically centered left of canvas */}
        {isPaintModeActive && paintStore.showInlineColorPicker.value && (
          <div class="shrink-0" style={{ width: '235px' }}>
            {/* Absolutely positioned within the canvas outer div (which has position:relative) */}
            <div class="absolute left-0 flex flex-col overflow-hidden" style={{ top: '50%', transform: 'translateY(-50%)', width: '235px', height: '450px', maxHeight: 'calc(100% - 32px)', backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--color-border-subtle)', borderBottom: '1px solid var(--color-border-subtle)', borderTop: '1px solid var(--color-border-subtle)', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}>
            <InlineColorPicker
              color={paintStore.brushColor.value}
              opacity={paintStore.brushOpacity.value}
              onChange={(color: string, opacity: number) => {
                paintStore.setBrushColor(color);
                paintStore.setBrushOpacity(opacity);
                // Live-update selected strokes
                const sel = paintStore.selectedStrokeIds.peek();
                if (paintStore.activeTool.peek() === 'select' && sel.size > 0) {
                  const layerId = layerStore.selectedLayerId.peek();
                  const fr = timelineStore.currentFrame.peek();
                  if (layerId) {
                    const pf = paintStore.getFrame(layerId, fr);
                    if (pf) {
                      for (const el of pf.elements) {
                        if ((el.tool === 'brush' || el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') && sel.has(el.id)) {
                          (el as any).color = color;
                          (el as any).opacity = opacity;
                        }
                      }
                      paintStore.markDirty(layerId, fr);
                      paintStore.invalidateFrameFxCache(layerId, fr);
                      paintStore.paintVersion.value++;
                    }
                  }
                }
              }}
              onClose={() => { paintStore.showInlineColorPicker.value = false; }}
            />
            </div>
          </div>
        )}
        {/* Preview Frame with zoom/pan */}
        <div
          ref={containerRef}
          class="canvas-zoom-pill-host relative flex items-center justify-center flex-1 min-h-0 p-4 pt-0 overflow-hidden"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{cursor: cursorStyle}}
        >
          {/* Floating canvas controls — the Studio pill's glass chrome at the
              canvas bottom-left. It stays up in paint mode so zoom and pan are
              reachable while painting; the paint toolbar keeps the top. */}
          <div
            class="canvas-zoom-pill"
            role="group"
            aria-label="Canvas controls"
            style={
              isHandPanning.value
                ? { opacity: 1, pointerEvents: 'auto' }
                : undefined
            }
          >
            <button
              class="canvas-zoom-pill-text"
              aria-pressed={isPaintModeActive}
              onClick={() => hasPaintLayerSelected && paintStore.togglePaintMode()}
              title={
                !hasPaintLayerSelected
                  ? 'Select a paint layer first'
                  : isPaintModeActive
                    ? 'Leave paint mode (P)'
                    : 'Enter paint mode (P)'
              }
              disabled={!hasPaintLayerSelected}
            >
              <Paintbrush size={14} />
            </button>
            <span class="canvas-zoom-pill-divider" aria-hidden="true" />
            <button
              onClick={() => canvasStore.zoomOut()}
              title="Zoom out (-)"
              disabled={canvasStore.isAtMinZoom.value}
            >
              <Minus size={14} />
            </button>
            <span class="canvas-zoom-pill-level">{canvasStore.zoomPercent.value}%</span>
            <button
              onClick={() => canvasStore.zoomIn()}
              title="Zoom in (=)"
              disabled={canvasStore.isAtMaxZoom.value}
            >
              <Plus size={14} />
            </button>
            <button
              class="cursor-grab"
              onPointerDown={beginHandSession}
              title="Hand — press and hold, then move to pan; releasing stops"
              aria-label="Hand"
            >
              <Hand size={14} />
            </button>
            <button
              class="canvas-zoom-pill-text"
              aria-pressed={canvasStore.fitLocked.value}
              onClick={() => canvasStore.toggleFitLock()}
              title={canvasStore.fitLocked.value ? 'Fit to window — locked (F)' : 'Fit to window (F)'}
            >
              FIT
            </button>
            <button
              class="canvas-zoom-pill-text"
              aria-pressed={Math.abs(canvasStore.zoom.value - 1) < 0.001}
              onClick={() => canvasStore.setSmoothZoom(1)}
              title="Actual size — one project pixel per screen pixel"
            >
              1:1
            </button>
            <button
              onClick={() => enterFullscreen()}
              title="Fullscreen (⇧⌘F)"
              aria-label="Fullscreen"
            >
              <Maximize size={14} />
            </button>
          </div>
          <div class="absolute right-4 bottom-4 pointer-events-none">
            <FullSpeedBadge />
          </div>
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
      </div>
      {/* Paint toolbar now renders in the controls bar above */}
      {/* JKL speed badge */}
      <SpeedBadge />
    </div>
  );
}
