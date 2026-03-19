import {isFullSpeed} from '../../lib/playbackEngine';
import {timelineStore} from '../../stores/timelineStore';

/**
 * Full-speed playback indicator badge.
 * Shows a lightning bolt + "FULL SPEED" label on the canvas
 * when full-speed mode is active during playback.
 */
export function FullSpeedBadge() {
  const active = isFullSpeed.value;
  const playing = timelineStore.isPlaying.value;

  if (!active || !playing) return null;

  return (
    <div
      class="absolute left-1/2 -translate-x-1/2 bottom-14 pointer-events-none z-10"
      style={{opacity: 1, transition: 'opacity 200ms ease-out'}}
    >
      <div class="bg-black/80 text-amber-400 text-sm font-mono px-3 py-1 rounded-full">
        {'\u26A1'} FULL SPEED
      </div>
    </div>
  );
}
