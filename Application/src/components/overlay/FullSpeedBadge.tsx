import {isFullSpeed} from '../../lib/playbackEngine';
import {timelineStore} from '../../stores/timelineStore';

/**
 * Full-speed playback indicator.
 * Shows a lightning bolt icon in the top-left corner of the window
 * when full-speed mode is active during playback.
 */
export function FullSpeedBadge() {
  const active = isFullSpeed.value;
  const playing = timelineStore.isPlaying.value;

  if (!active || !playing) return null;

  return (
    <div class="fixed top-2 left-2 pointer-events-none z-40">
      <span class="text-amber-400 text-lg" title="Full-speed playback">{'\u26A1'}</span>
    </div>
  );
}
