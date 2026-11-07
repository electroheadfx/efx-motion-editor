/**
 * The Animate-anchored channel menu shell (261107).
 *
 * `position: fixed` escapes the timeline's `overflow` clip, so the menu is
 * rendered from the strip next to the Animate button and clamped to the
 * viewport. It is a separate module from `TimelineMotionChannels` because that
 * module is a props-only, DOM-free surface; this shell is the ONE place that
 * measures the viewport.
 */

import { TIMELINE_MOTION, TIMELINE_SURFACE } from './timelineRailDesign';
import {
  RAIL_MOTION_DISPLAY_LANE_ORDER,
  TimelineMotionChannelMenu,
  type TimelineMotionChannelMenuProps,
} from './TimelineMotionChannels';

export interface TimelineMotionChannelMenuOverlayProps extends TimelineMotionChannelMenuProps {
  /** The trigger button's screen anchor (bottom-left corner). */
  readonly anchor: Readonly<{ x: number; y: number }> | null;
}

/**
 * The fixed-position shell around the channel menu. `position: fixed` escapes
 * the timeline's `overflow` clip; the menu is clamped to the viewport and
 * flips above the trigger when there is no room underneath. A transparent
 * backdrop closes it.
 */
export function TimelineMotionChannelMenuOverlay({
  anchor,
  channels,
  onToggleChannel,
  onClose,
}: TimelineMotionChannelMenuOverlayProps) {
  const menuWidth = 200;
  const menuHeight = RAIL_MOTION_DISPLAY_LANE_ORDER.length * 28 + 8;
  const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const resolved = anchor ?? {
    x: Math.max(8, viewportWidth / 2 - menuWidth / 2),
    y: Math.round(viewportHeight / 2),
  };
  const left = Math.max(4, Math.min(resolved.x, viewportWidth - menuWidth - 4));
  const below = resolved.y + 2;
  const top = below + menuHeight > viewportHeight - 4
    ? Math.max(4, resolved.y - menuHeight - 32)
    : below;
  return (
    <>
      <div
        class="physics-paint-motion-channel-menu-backdrop"
        style={{ position: 'fixed', inset: 0, zIndex: TIMELINE_MOTION.channelMenuZIndex - 1 }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      />
      <div
        class="physics-paint-motion-channel-menu-overlay"
        style={{
          position: 'fixed',
          left,
          top,
          width: menuWidth,
          zIndex: TIMELINE_MOTION.channelMenuZIndex,
          background: TIMELINE_SURFACE.rows,
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 6px 18px rgba(0, 0, 0, 0.5)',
        }}
      >
        <TimelineMotionChannelMenu
          channels={channels}
          onToggleChannel={onToggleChannel}
          onClose={onClose}
        />
      </div>
    </>
  );
}

