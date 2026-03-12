import {useRef, useCallback, useEffect} from 'preact/hooks';
import {Preview} from '../Preview';
import {SpeedBadge} from '../overlay/SpeedBadge';
import {timelineStore} from '../../stores/timelineStore';
import {canvasStore} from '../../stores/canvasStore';
import {playbackEngine} from '../../lib/playbackEngine';

/** Safari macOS gesture event interface */
interface GestureEvent extends UIEvent {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
}

export function CanvasArea() {
  const isPlaying = timelineStore.isPlaying.value;
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state for middle-click panning
  const dragRef = useRef({
    isDragging: false,
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

  // --- Pan handlers: middle-click drag ---
  const handlePointerDown = useCallback((e: PointerEvent) => {
    // Middle mouse button (button === 1) starts pan drag
    if (e.button !== 1) return;
    e.preventDefault();
    const drag = dragRef.current;
    drag.isDragging = true;
    drag.startX = e.clientX;
    drag.startY = e.clientY;
    drag.startPanX = canvasStore.panX.value;
    drag.startPanY = canvasStore.panY.value;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.isDragging) return;
    const z = canvasStore.zoom.value;
    canvasStore.setPan(
      drag.startPanX + (e.clientX - drag.startX) / z,
      drag.startPanY + (e.clientY - drag.startY) / z,
    );
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.isDragging) return;
    drag.isDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may not be active
    }
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
        style={{cursor: dragRef.current.isDragging ? 'grabbing' : 'default'}}
      >
        <div
          class="w-full max-w-[830px] aspect-video rounded bg-black overflow-hidden"
          style={{
            transform: `scale(${canvasStore.zoom.value}) translate(${canvasStore.panX.value}px, ${canvasStore.panY.value}px)`,
            transformOrigin: 'center center',
          }}
        >
          <Preview />
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
        {/* Zoom display */}
        <span class="text-[11px] text-[var(--color-text-dim)]">
          {canvasStore.zoomPercent.value}%
        </span>
        {/* Fit button */}
        <button
          class="rounded bg-[var(--color-bg-settings)] px-2.5 py-1.5 cursor-pointer"
          onClick={() => canvasStore.fitToWindow()}
          title="Fit to window"
        >
          <span class="text-[11px] text-[var(--color-text-secondary)]">
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
