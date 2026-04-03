import {useRef, useCallback, useEffect} from 'preact/hooks';
import {useSignal} from '@preact/signals';
import {isFullscreen, exitFullscreen} from '../../lib/fullscreenManager';
import {playbackEngine, isFullSpeed} from '../../lib/playbackEngine';
import {timelineStore} from '../../stores/timelineStore';
import {projectStore} from '../../stores/projectStore';
import {Preview} from '../Preview';

const CONTROLS_HIDE_DELAY = 2000; // ms

export function FullscreenOverlay() {
  const active = isFullscreen.value;
  const controlsVisible = useSignal(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showControls = useCallback(() => {
    controlsVisible.value = true;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      controlsVisible.value = false;
    }, CONTROLS_HIDE_DELAY);
  }, []);

  // Start auto-hide timer when entering fullscreen
  useEffect(() => {
    if (!active) return;
    showControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [active]);

  // Handle keyboard shortcuts scoped to fullscreen
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        exitFullscreen();
        return;
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        playbackEngine.stepBackward();
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        playbackEngine.stepForward();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        return;
      }
      // Block all other shortcuts in fullscreen
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [active]);

  const handleTogglePlay = useCallback(() => {
    if (timelineStore.isPlaying.peek()) {
      playbackEngine.stop();
    } else {
      isFullSpeed.value = true;
      playbackEngine.start();
    }
  }, []);

  const handleStepBackward = useCallback(() => {
    playbackEngine.stepBackward();
  }, []);

  const handleStepForward = useCallback(() => {
    playbackEngine.stepForward();
  }, []);

  // Early return AFTER all hooks
  if (!active) return null;

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const projW = projectStore.width.value;
  const projH = projectStore.height.value;
  const scale = Math.min(screenW / projW, screenH / projH);

  const isPlaying = timelineStore.isPlaying.value;
  const visible = controlsVisible.value;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onMouseMove={showControls}
      style={{cursor: visible ? 'default' : 'none'}}
    >
      {/* Canvas preview at letterbox scale */}
      <div
        style={{
          width: `${projW}px`,
          height: `${projH}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
        class="relative shrink-0"
      >
        <Preview />
      </div>

      {/* Auto-hiding controls bar */}
      <div
        class="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 h-[52px] px-5"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 300ms ease-out',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        <button
          tabIndex={-1}
          class="flex items-center justify-center w-8 h-8 rounded bg-white/10 hover:bg-white/20 cursor-pointer"
          onClick={handleStepBackward}
          title="Step backward"
        >
          <span class="text-xs text-white/80">{'\u23EE'}</span>
        </button>
        <button
          tabIndex={-1}
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 cursor-pointer"
          onClick={handleTogglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          <span class="text-base text-white">
            {isPlaying ? '\u23F8' : '\u25B6'}
          </span>
        </button>
        <button
          tabIndex={-1}
          class="flex items-center justify-center w-8 h-8 rounded bg-white/10 hover:bg-white/20 cursor-pointer"
          onClick={handleStepForward}
          title="Step forward"
        >
          <span class="text-xs text-white/80">{'\u23ED'}</span>
        </button>
        <div class="rounded bg-white/10 px-3 py-1.5">
          <span class="text-[13px] font-semibold text-white/90">
            {formatTime(timelineStore.displayTime.value)}
          </span>
        </div>
        <span class="text-xs text-white/50">
          / {formatTime(timelineStore.totalDuration.value)}
        </span>
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
