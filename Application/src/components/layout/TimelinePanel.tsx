import {useRef, useCallback, useEffect} from 'preact/hooks';
import {Play, Pause, SkipBack, SkipForward, Rewind, Plus, Minus, Shrink, Repeat, Repeat1} from 'lucide-preact';
import {timelineStore} from '../../stores/timelineStore';
import {uiStore} from '../../stores/uiStore';
import {isolationStore} from '../../stores/isolationStore';
import {playbackEngine} from '../../lib/playbackEngine';
import {TimelineCanvas} from '../timeline/TimelineCanvas';
import {TimelineScrollbar} from '../timeline/TimelineScrollbar';
import {AddLayerMenu} from '../timeline/AddFxMenu';
import {AddTransitionMenu} from '../timeline/AddTransitionMenu';
import {BASE_FRAME_WIDTH} from '../timeline/TimelineRenderer';

export function TimelinePanel() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isolationStore.loadLoopPreference();
  }, []);

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
    <div
      class="flex flex-col w-full h-[280px] bg-[var(--color-bg-section-header)]"
      onMouseEnter={() => uiStore.setMouseRegion('timeline')}
      onMouseLeave={() => uiStore.setMouseRegion('other')}
    >
      {/* Timeline Controls */}
      <div class="flex items-center gap-2 h-9 px-3 bg-[var(--color-bg-root)] shrink-0">
        {/* Seek to start */}
        <button
          class="rounded bg-[var(--color-bg-input)] px-2 py-[5px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white cursor-pointer transition-colors"
          onClick={() => playbackEngine.seekToFrame(0)}
          title="Seek to start"
        >
          <Rewind size={14} />
        </button>

        {/* Play/Pause */}
        <button
          class="rounded bg-[var(--color-accent)] px-2 py-[5px] text-white hover:brightness-125 cursor-pointer transition-colors"
          onClick={() => playbackEngine.toggle()}
          title={timelineStore.isPlaying.value ? 'Pause (Space)' : 'Play (Space)'}
        >
          {timelineStore.isPlaying.value ? <Pause size={14} /> : <Play size={14} />}
        </button>

        {/* Step backward */}
        <button
          class="rounded bg-[var(--color-bg-input)] px-2 py-[5px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white cursor-pointer transition-colors"
          onClick={() => playbackEngine.stepBackward()}
          title="Step backward"
        >
          <SkipBack size={14} />
        </button>

        {/* Step forward */}
        <button
          class="rounded bg-[var(--color-bg-input)] px-2 py-[5px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white cursor-pointer transition-colors"
          onClick={() => playbackEngine.stepForward()}
          title="Step forward"
        >
          <SkipForward size={14} />
        </button>

        {/* Loop toggle */}
        <button
          class={`rounded px-2 py-[5px] cursor-pointer transition-colors ${
            isolationStore.loopEnabled.value
              ? 'bg-[var(--color-accent)] text-white hover:brightness-125'
              : 'bg-[var(--color-bg-input)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-white'
          }`}
          onClick={() => isolationStore.toggleLoop()}
          title={isolationStore.loopEnabled.value ? 'Loop: ON' : 'Loop: OFF'}
        >
          {isolationStore.loopEnabled.value ? <Repeat1 size={14} /> : <Repeat size={14} />}
        </button>

        <div class="w-px h-5 bg-[var(--color-border-subtle)]" />

        {/* Timecode display */}
        <span class="text-[11px] text-[var(--color-text-secondary)]">
          {formatTime(timelineStore.displayTime.value)} / {formatTime(timelineStore.totalDuration.value)}
        </span>

        <div class="flex-1" />

        {/* Timeline Zoom: [-] [Fit All] [+] */}
        <button
          class={`rounded-[5px] px-2.5 py-[5px] text-[var(--color-text-secondary)] ${
            timelineStore.isAtMinZoom.value
              ? 'bg-[var(--color-bg-input)] opacity-40 cursor-default'
              : 'bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover-item)] cursor-pointer'
          }`}
          onClick={() => timelineStore.zoomOut()}
          title="Timeline zoom out (-)"
        >
          <Minus size={14} />
        </button>

        <button
          class="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] cursor-pointer"
          onClick={handleFitAll}
          title="Fit all frames"
        >
          <Shrink size={14} />
        </button>

        <button
          class={`rounded-[5px] px-2.5 py-[5px] text-[var(--color-text-secondary)] ${
            timelineStore.isAtMaxZoom.value
              ? 'bg-[var(--color-bg-input)] opacity-40 cursor-default'
              : 'bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover-item)] cursor-pointer'
          }`}
          onClick={() => timelineStore.zoomIn()}
          title="Timeline zoom in (+/=)"
        >
          <Plus size={14} />
        </button>

        <span class="text-[10px] text-[var(--color-text-dim)] w-8">
          {timelineStore.zoom.value.toFixed(1)}x
        </span>

        <div class="w-px h-5 bg-[var(--color-border-subtle)]" />

        {/* Add Transition */}
        <AddTransitionMenu />

        {/* Add Layer */}
        <AddLayerMenu />
      </div>

      {/* Canvas Timeline (replaces time ruler, mock tracks) */}
      <div ref={canvasContainerRef} class="flex-1 min-h-0 overflow-hidden flex flex-row">
        <TimelineCanvas />
        <TimelineScrollbar />
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
