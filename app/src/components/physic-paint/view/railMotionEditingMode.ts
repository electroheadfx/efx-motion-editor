/**
 * Session-only rail-motion editing mode (261107 UAT).
 *
 * Deploying a motion lane and animating it are now two separate states: the
 * lane can stay open while the paint tool keeps working, and ANIMATE MODE —
 * one channel selected in the pinned header, highlighted white — is the only
 * state that arms the canvas boundary/gizmo.
 *
 * `railMotionLastSelectedChannel` remembers the property the Motion tool
 * re-selects when it is turned on. Nothing here is persisted or part of the
 * document: these are UI-session signals, like the block expansion itself.
 */

import { signal } from '@preact/signals';
import type { RailMotionDisplayLaneId } from './TimelineMotionChannels';

/** The channel the canvas is animating right now; null = painting mode. */
export const railMotionSelectedChannel = signal<RailMotionDisplayLaneId | null>(null);

/** The most recently selected channel, remembered across exits. */
export const railMotionLastSelectedChannel = signal<RailMotionDisplayLaneId | null>(null);

/** Enters animate mode for one channel and remembers it. Idempotent. */
export function selectRailMotionChannel(channel: RailMotionDisplayLaneId): void {
  if (railMotionSelectedChannel.value !== channel) {
    railMotionSelectedChannel.value = channel;
  }
  if (railMotionLastSelectedChannel.value !== channel) {
    railMotionLastSelectedChannel.value = channel;
  }
}

/** Clicking the selected property again leaves animate mode. */
export function toggleRailMotionChannelSelection(channel: RailMotionDisplayLaneId): void {
  if (railMotionSelectedChannel.value === channel) {
    exitRailMotionEditing();
    return;
  }
  selectRailMotionChannel(channel);
}

/**
 * Leaves animate mode. The deployed lane and the remembered property stay, so
 * the next Motion-tool press or click on the property returns exactly there.
 */
export function exitRailMotionEditing(): void {
  if (railMotionSelectedChannel.value !== null) railMotionSelectedChannel.value = null;
}
