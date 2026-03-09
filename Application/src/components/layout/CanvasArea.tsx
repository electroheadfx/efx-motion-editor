import {signal} from '@preact/signals';
import {useRef, useCallback} from 'preact/hooks';
import {Preview} from '../Preview';
import {SpeedBadge} from '../overlay/SpeedBadge';
import {timelineStore} from '../../stores/timelineStore';
import {playbackEngine} from '../../lib/playbackEngine';

// --- Preview zoom/pan state (PREV-04) ---
const previewZoom = signal(1);
const previewPanX = signal(0);
const previewPanY = signal(0);

export function CanvasArea() {
  const isPlaying = timelineStore.isPlaying.value;

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

    const oldZoom = previewZoom.value;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(4, oldZoom * factor));

    // Adjust pan to keep point under cursor stable
    const scale = newZoom / oldZoom;
    previewPanX.value = previewPanX.value * scale + cursorX * (1 - scale) / newZoom;
    previewPanY.value = previewPanY.value * scale + cursorY * (1 - scale) / newZoom;
    previewZoom.value = newZoom;
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
    drag.startPanX = previewPanX.value;
    drag.startPanY = previewPanY.value;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.isDragging) return;
    const z = previewZoom.value;
    previewPanX.value = drag.startPanX + (e.clientX - drag.startX) / z;
    previewPanY.value = drag.startPanY + (e.clientY - drag.startY) / z;
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

  // --- Fit button: reset zoom/pan ---
  const handleFit = useCallback(() => {
    previewZoom.value = 1;
    previewPanX.value = 0;
    previewPanY.value = 0;
  }, []);

  return (
    <div class="relative flex flex-col items-center justify-center flex-1 min-h-0 bg-[var(--color-bg-card)]">
      {/* Preview Frame with zoom/pan */}
      <div
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
            transform: `scale(${previewZoom.value}) translate(${previewPanX.value}px, ${previewPanY.value}px)`,
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
          <span class="text-[13px] font-semibold text-[#E0E0E0]">
            {formatTime(timelineStore.currentTime.value)}
          </span>
        </div>
        <span class="text-xs text-[var(--color-text-dim)]">
          / {formatTime(timelineStore.totalDuration.value)}
        </span>
        {/* Zoom display */}
        <span class="text-[11px] text-[var(--color-text-dim)]">
          {Math.round(previewZoom.value * 100)}%
        </span>
        {/* Fit button */}
        <button
          class="rounded bg-[var(--color-bg-settings)] px-2.5 py-1.5 cursor-pointer"
          onClick={handleFit}
          title="Reset zoom and pan"
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
