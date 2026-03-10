import {useRef, useCallback} from 'preact/hooks';
import {timelineStore} from '../../stores/timelineStore';
import {playbackEngine} from '../../lib/playbackEngine';
import {TimelineCanvas} from '../timeline/TimelineCanvas';
import {AddFxMenu} from '../timeline/AddFxMenu';
import {BASE_FRAME_WIDTH} from '../timeline/TimelineRenderer';

export function TimelinePanel() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const handleFitAll = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const totalFrames = timelineStore.totalFrames.peek();
    if (totalFrames <= 0) return;
    const canvasWidth = container.getBoundingClientRect().width - 80; // subtract TRACK_HEADER_WIDTH
    const fitZoom = canvasWidth / (totalFrames * BASE_FRAME_WIDTH);
    timelineStore.setZoom(fitZoom);
    timelineStore.setScrollX(0);
  }, []);

  return (
    <div class="flex flex-col w-full h-[280px] bg-[#111111]">
      {/* Timeline Controls */}
      <div class="flex items-center gap-2 h-9 px-3 bg-[#0F0F0F] shrink-0">
        {/* Seek to start */}
        <button
          class="rounded bg-[var(--color-bg-input)] px-2 py-[5px]"
          onClick={() => playbackEngine.seekToFrame(0)}
        >
          <span class="text-[11px] text-[var(--color-text-secondary)]">
            |&#9664;
          </span>
        </button>

        {/* Play/Pause */}
        <button
          class="rounded bg-[var(--color-accent)] px-2 py-[5px]"
          onClick={() => playbackEngine.toggle()}
        >
          <span class="text-[11px] text-white">
            {timelineStore.isPlaying.value ? '\u23F8' : '\u25B6'}
          </span>
        </button>

        {/* Step backward */}
        <button
          class="rounded bg-[var(--color-bg-input)] px-2 py-[5px]"
          onClick={() => playbackEngine.stepBackward()}
        >
          <span class="text-[11px] text-[var(--color-text-secondary)]">
            &#9664;|
          </span>
        </button>

        {/* Step forward */}
        <button
          class="rounded bg-[var(--color-bg-input)] px-2 py-[5px]"
          onClick={() => playbackEngine.stepForward()}
        >
          <span class="text-[11px] text-[var(--color-text-secondary)]">
            &#9654;|
          </span>
        </button>

        <div class="w-px h-5 bg-[#333333]" />

        {/* Timecode display */}
        <span class="text-[11px] text-[var(--color-text-secondary)]">
          {formatTime(timelineStore.displayTime.value)} / {formatTime(timelineStore.totalDuration.value)}
        </span>

        <div class="flex-1" />

        {/* Zoom slider */}
        <span class="text-[10px] text-[var(--color-text-dim)]">
          Zoom:
        </span>
        <input
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={timelineStore.zoom.value}
          onInput={(e) => timelineStore.setZoom(parseFloat((e.target as HTMLInputElement).value))}
          class="w-[100px] h-2 accent-[var(--color-accent)]"
        />
        <span class="text-[10px] text-[var(--color-text-dim)] w-8">
          {timelineStore.zoom.value.toFixed(1)}x
        </span>

        {/* Fit All */}
        <button
          class="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]"
          onClick={handleFitAll}
        >
          <span class="text-[10px] text-[var(--color-text-secondary)]">
            Fit All
          </span>
        </button>

        <div class="w-px h-5 bg-[#333333]" />

        {/* Add FX */}
        <AddFxMenu />
      </div>

      {/* Canvas Timeline (replaces time ruler, mock tracks) */}
      <div ref={canvasContainerRef} class="flex-1 min-h-0 overflow-hidden">
        <TimelineCanvas />
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
