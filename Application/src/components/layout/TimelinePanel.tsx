import {timelineStore} from '../../stores/timelineStore';

const timelineClips = [
  {label: 'Sequence 01  \u00B7  8 keys', sub: '2.0s', width: 240, bg: '#2D4A8A'},
  {label: 'Sequence 02  \u00B7  5 keys', sub: '1.5s', width: 180, bg: '#243D74'},
  {label: 'Sequence 03  \u00B7  12 keys', sub: '3.0s', width: 360, bg: '#2D4A8A'},
];

export function TimelinePanel() {
  return (
    <div class="flex flex-col w-full h-[280px] bg-[#111111]">
      {/* Timeline Controls */}
      <div class="flex items-center gap-2 h-9 px-3 bg-[#0F0F0F] shrink-0">
        <button
          class="rounded bg-[var(--color-bg-input)] px-2 py-[5px]"
          onClick={() => timelineStore.seek(0)}
        >
          <span class="text-[11px] text-[var(--color-text-secondary)]">
            |&#9664;
          </span>
        </button>
        <button
          class="rounded bg-[var(--color-accent)] px-2 py-[5px]"
          onClick={() => timelineStore.togglePlaying()}
        >
          <span class="text-[11px] text-white">
            {timelineStore.isPlaying.value ? '\u23F8' : '\u25B6'}
          </span>
        </button>
        <button
          class="rounded bg-[var(--color-bg-input)] px-2 py-[5px]"
          onClick={() => timelineStore.stepForward()}
        >
          <span class="text-[11px] text-[var(--color-text-secondary)]">
            &#9654;|
          </span>
        </button>
        <div class="w-px h-5 bg-[#333333]" />
        <span class="text-[11px] text-[var(--color-text-secondary)]">
          {timelineStore.currentTime.value.toFixed(2)}s / 8.00s
        </span>
        <div class="flex-1" />
        <span class="text-[10px] text-[var(--color-text-dim)]">
          Timeline Zoom:
        </span>
        <div class="flex items-center w-[100px] h-3">
          <div class="w-[88px] h-[3px] rounded-sm bg-[#333333]" />
          <div class="w-3 h-3 rounded-full bg-[var(--color-text-muted)]" />
        </div>
        <button class="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span class="text-[10px] text-[var(--color-text-secondary)]">
            Fit All
          </span>
        </button>
      </div>

      {/* Time Ruler */}
      <div class="flex items-center h-6 px-3 bg-[#0D0D0D] shrink-0">
        <div class="w-0.5 h-4 bg-[#E55A2B]" />
      </div>

      {/* Tracks Area */}
      <div class="flex flex-col gap-1 p-1 bg-[#111111] flex-1 overflow-y-auto">
        {/* FX Track */}
        <div class="flex items-center h-[52px]">
          <div class="flex flex-col items-start justify-center gap-0.5 w-20 h-[52px] px-2 bg-[#0D0D0D]">
            <span class="text-[10px] font-medium text-[#8888BB]">
              FX Layer
            </span>
            <span class="text-[10px] text-[var(--color-text-dim)]">
              &#128065; &#128274;
            </span>
          </div>
          <div class="flex items-center gap-[3px] flex-1 h-11 px-1 bg-[var(--color-bg-card-alt)]">
            <div class="flex items-center justify-center rounded h-10 px-2 bg-[#4A2D8A] flex-1">
              <span class="text-[10px] text-[#CCAAFF] truncate">
                Light Leaks &middot; Screen &middot; 80% opacity
              </span>
            </div>
          </div>
        </div>

        {/* Photos Track */}
        <div class="flex items-center h-[52px]">
          <div class="flex flex-col items-start justify-center gap-0.5 w-20 h-[52px] px-2 bg-[#0D0D0D]">
            <span class="text-[10px] font-medium text-[var(--color-text-secondary)]">
              Photos
            </span>
            <span class="text-[10px] text-[var(--color-text-dim)]">
              &#128065; &#128274;
            </span>
          </div>
          <div class="flex items-center gap-[3px] flex-1 h-11 px-1 bg-[var(--color-bg-card-alt)]">
            {timelineClips.map((clip) => (
              <div
                key={clip.label}
                class="flex flex-col justify-center rounded h-10 px-2"
                style={{width: clip.width, backgroundColor: clip.bg}}
              >
                <span class="text-[10px] text-[#AACCFF] truncate">
                  {clip.label}
                </span>
                <span class="text-[9px] text-[#7799CC]">{clip.sub}</span>
              </div>
            ))}
            <button class="flex items-center justify-center w-8 h-10 rounded bg-[var(--color-bg-input)]">
              <span class="text-base text-[var(--color-text-dim)]">+</span>
            </button>
          </div>
        </div>

        {/* Audio Track */}
        <div class="flex items-center h-16">
          <div class="flex flex-col items-start justify-center gap-0.5 w-20 h-16 px-2 bg-[#0D0D0D]">
            <span class="text-[10px] font-medium text-[#55BB88]">Audio</span>
            <span class="text-[9px] text-[var(--color-text-dim)]">
              Vol 85%
            </span>
          </div>
          <div class="flex items-center flex-1 h-14 px-1 bg-[var(--color-bg-card-alt)]">
            <div class="flex flex-col justify-center gap-1 rounded h-12 px-2 bg-[#1A3D2A] flex-1">
              <span class="text-[10px] font-medium text-[#55DD88]">
                background.mp3
              </span>
              <div class="w-full h-4 rounded-sm bg-[#2A7A4A]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
