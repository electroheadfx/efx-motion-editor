import {currentSpeedLabel, showSpeedBadge} from '../../lib/jklShuttle';

/**
 * Speed indicator badge for JKL shuttle control.
 * Shows "2x", "4x", "-4x" etc near playback controls when speed changes,
 * then fades out after BADGE_DURATION ms.
 */
export function SpeedBadge() {
  const label = currentSpeedLabel.value;
  const visible = showSpeedBadge.value;

  // Don't render at all if there's no label to show
  if (!label) return null;

  return (
    <div
      class="absolute left-1/2 -translate-x-1/2 bottom-14 pointer-events-none z-10"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease-out',
      }}
    >
      <div class="bg-black/80 text-white text-sm font-mono px-3 py-1 rounded-full">
        {label}
      </div>
    </div>
  );
}
