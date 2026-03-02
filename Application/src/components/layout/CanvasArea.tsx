import {Preview} from '../Preview';
import {timelineStore} from '../../stores/timelineStore';

export function CanvasArea() {
  const isPlaying = timelineStore.isPlaying.value;

  return (
    <div class="flex flex-col items-center justify-center flex-1 min-h-0 bg-[var(--color-bg-card)]">
      {/* Preview Frame */}
      <div class="flex items-center justify-center flex-1 w-full min-h-0 p-4">
        <div class="w-full max-w-[830px] aspect-video rounded bg-black overflow-hidden">
          <Preview />
        </div>
      </div>
      {/* Canvas Controls */}
      <div class="flex items-center justify-center gap-5 w-full h-[42px] px-5 shrink-0">
        <button
          class="flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-accent)] cursor-pointer"
          onClick={() => timelineStore.togglePlaying()}
        >
          <span class="text-sm text-white">
            {isPlaying ? '\u23F8' : '\u25B6'}
          </span>
        </button>
        <div class="rounded bg-[var(--color-bg-input)] px-3 py-1.5">
          <span class="text-[13px] font-semibold text-[#E0E0E0]">
            {formatTime(timelineStore.currentTime.value)}
          </span>
        </div>
        <span class="text-xs text-[var(--color-text-dim)]">/ 00:00:08.00</span>
        <button class="rounded bg-[var(--color-bg-settings)] px-2.5 py-1.5">
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
