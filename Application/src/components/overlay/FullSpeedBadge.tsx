import {isFullSpeed} from '../../lib/playbackEngine';
import {timelineStore} from '../../stores/timelineStore';

/**
 * Full-speed playback indicator.
 * Shows a lightning bolt icon inline in the controls bar
 * when full-speed mode is active during playback.
 */
export function FullSpeedBadge() {
  const active = isFullSpeed.value;
  const playing = timelineStore.isPlaying.value;

  if (!active || !playing) return null;

  return (
    <span class="text-amber-400 text-sm pointer-events-none" title="Full-speed playback">{'\u26A1'}</span>
  );
}
