import {useRef, useCallback, useEffect} from 'preact/hooks';
import {Play, Pause, SkipBack, SkipForward, ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, Plus, Minus, Shrink, Repeat, Repeat1, Sparkles, Music, Magnet} from 'lucide-preact';
import {capturePreviewCanvas} from '../../lib/shaderPreviewCapture';
import {timelineStore} from '../../stores/timelineStore';
import {uiStore} from '../../stores/uiStore';
import {isolationStore} from '../../stores/isolationStore';
import {audioStore} from '../../stores/audioStore';
import {playbackEngine} from '../../lib/playbackEngine';
import {findPrevSequenceStart, findNextSequenceStart} from '../../lib/sequenceNav';
import {totalFrames, trackLayouts} from '../../lib/frameMap';
import {TimelineCanvas} from '../timeline/TimelineCanvas';
import {TimelineScrollbar} from '../timeline/TimelineScrollbar';
import {AddLayerMenu} from '../timeline/AddFxMenu';
import {AddTransitionMenu} from '../timeline/AddTransitionMenu';
import {AddAudioButton} from '../timeline/AddAudioButton';
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
      class="flex flex-col w-full h-[280px] bg-(--color-bg-section-header)"
      onMouseEnter={() => uiStore.setMouseRegion('timeline')}
      onMouseLeave={() => uiStore.setMouseRegion('other')}
    >
      {/* Timeline Controls */}
      <div class="flex items-center gap-2 h-9 px-3 bg-(--color-bg-root) shrink-0">
        {/* Skip Back */}
        <button
          class="rounded bg-(--color-bg-input) px-2 py-[5px] text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white cursor-pointer transition-colors"
          onClick={() => playbackEngine.seekToFrame(0)}
          title="Skip to start"
        >
          <SkipBack size={14} />
        </button>

        {/* Step Back (previous sequence) */}
        <button
          class="rounded bg-(--color-bg-input) px-2 py-[5px] text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white cursor-pointer transition-colors"
          onClick={() => {
            const prev = findPrevSequenceStart(trackLayouts.value, timelineStore.currentFrame.value);
            if (prev !== null) playbackEngine.seekToFrame(prev);
          }}
          title="Previous sequence"
        >
          <ChevronFirst size={14} />
        </button>

        {/* Rewind (previous frame) */}
        <button
          class="rounded bg-(--color-bg-input) px-2 py-[5px] text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white cursor-pointer transition-colors"
          onClick={() => playbackEngine.stepBackward()}
          title="Previous frame"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Play/Pause */}
        <button
          class="rounded bg-(--color-accent) px-2 py-[5px] text-white hover:brightness-125 cursor-pointer transition-colors"
          onClick={() => playbackEngine.toggle()}
          title={timelineStore.isPlaying.value ? 'Pause (Space)' : 'Play (Space)'}
        >
          {timelineStore.isPlaying.value ? <Pause size={14} /> : <Play size={14} />}
        </button>

        {/* Fast Forward (next frame) */}
        <button
          class="rounded bg-(--color-bg-input) px-2 py-[5px] text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white cursor-pointer transition-colors"
          onClick={() => playbackEngine.stepForward()}
          title="Next frame"
        >
          <ChevronsRight size={14} />
        </button>

        {/* Step Forward (next sequence) */}
        <button
          class="rounded bg-(--color-bg-input) px-2 py-[5px] text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white cursor-pointer transition-colors"
          onClick={() => {
            const next = findNextSequenceStart(trackLayouts.value, timelineStore.currentFrame.value);
            if (next !== null) playbackEngine.seekToFrame(next);
          }}
          title="Next sequence"
        >
          <ChevronLast size={14} />
        </button>

        {/* Skip Forward */}
        <button
          class="rounded bg-(--color-bg-input) px-2 py-[5px] text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white cursor-pointer transition-colors"
          onClick={() => playbackEngine.seekToFrame(totalFrames.value - 1)}
          title="Skip to end"
        >
          <SkipForward size={14} />
        </button>

        {/* Timecode display */}
        <span class="text-[11px] text-(--color-text-secondary)">
          {formatTime(timelineStore.displayTime.value)} / {formatTime(timelineStore.totalDuration.value)}
        </span>

        <div class="w-px h-5 bg-(--color-border-subtle)" />

        {/* Loop toggle */}
        <button
          class={`rounded px-2 py-[5px] cursor-pointer transition-colors ${
            isolationStore.loopEnabled.value
              ? 'bg-(--color-accent) text-white hover:brightness-125'
              : 'bg-(--color-bg-input) text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white'
          }`}
          onClick={() => isolationStore.toggleLoop()}
          title={isolationStore.loopEnabled.value ? 'Loop: ON' : 'Loop: OFF'}
        >
          {isolationStore.loopEnabled.value ? <Repeat1 size={14} /> : <Repeat size={14} />}
        </button>

        {/* Beat markers toggle */}
        {audioStore.tracks.value.length > 0 && (
          <button
            class={`rounded px-2 py-[5px] cursor-pointer transition-colors ${
              audioStore.beatMarkersVisible.value
                ? 'bg-(--color-accent) text-white hover:brightness-125'
                : 'bg-(--color-bg-input) text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white'
            }`}
            onClick={() => audioStore.toggleBeatMarkers()}
            title={audioStore.beatMarkersVisible.value ? 'Beat markers: ON' : 'Beat markers: OFF'}
          >
            <Music size={14} />
          </button>
        )}

        {/* Snap-to-beat toggle */}
        {audioStore.tracks.value.length > 0 && (
          <button
            class={`rounded px-2 py-[5px] cursor-pointer transition-colors ${
              audioStore.snapToBeatsEnabled.value
                ? 'bg-(--color-accent) text-white hover:brightness-125'
                : 'bg-(--color-bg-input) text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) hover:text-white'
            }`}
            onClick={() => audioStore.toggleSnapToBeats()}
            title={audioStore.snapToBeatsEnabled.value ? 'Snap to beats: ON' : 'Snap to beats: OFF'}
          >
            <Magnet size={14} />
          </button>
        )}

        <div class="flex-1" />

        {/* Timeline Zoom: [-] [Fit All] [+] */}
        <button
          class={`rounded-[5px] px-2.5 py-[5px] text-(--color-text-secondary) ${
            timelineStore.isAtMinZoom.value
              ? 'bg-(--color-bg-input) opacity-40 cursor-default'
              : 'bg-(--color-bg-input) hover:bg-(--color-bg-hover-item) cursor-pointer'
          }`}
          onClick={() => timelineStore.zoomOut()}
          title="Timeline zoom out (-)"
        >
          <Minus size={14} />
        </button>

        <button
          class="rounded bg-(--color-bg-input) px-2.5 py-[5px] text-(--color-text-secondary) hover:bg-(--color-bg-hover-item) cursor-pointer"
          onClick={handleFitAll}
          title="Fit all frames"
        >
          <Shrink size={14} />
        </button>

        <button
          class={`rounded-[5px] px-2.5 py-[5px] text-(--color-text-secondary) ${
            timelineStore.isAtMaxZoom.value
              ? 'bg-(--color-bg-input) opacity-40 cursor-default'
              : 'bg-(--color-bg-input) hover:bg-(--color-bg-hover-item) cursor-pointer'
          }`}
          onClick={() => timelineStore.zoomIn()}
          title="Timeline zoom in (+/=)"
        >
          <Plus size={14} />
        </button>

        <span class="text-[10px] text-(--color-text-dim) w-8">
          {timelineStore.zoom.value.toFixed(1)}x
        </span>

        <div class="w-px h-5 bg-(--color-border-subtle)" />

        {/* Add Transition */}
        <AddTransitionMenu />

        {/* Shader Browser */}
        <button
          class="rounded px-2 py-[5px] bg-(--color-bg-input) hover:bg-(--color-border-subtle) transition-colors"
          onClick={() => {
            if (uiStore.editorMode.peek() === 'shader-browser') {
              uiStore.setEditorMode('editor');
            } else {
              capturePreviewCanvas();
              uiStore.setEditorMode('shader-browser');
            }
          }}
          title="Shader Browser"
        >
          <span class="text-[10px] text-(--color-text-secondary) flex items-center gap-1"><Sparkles size={11} /> Shader</span>
        </button>

        {/* Add Layer */}
        <AddLayerMenu />

        {/* Add Audio */}
        <AddAudioButton />
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
