import { signal } from '@preact/signals';
import type { FrameGotoMode } from './physicsPaintFrameGoto';

/**
 * 261105-cgl UAT: the timeline ruler's display unit, owned by the frame go-to
 * switch. Session-only and frame-first; nothing is persisted. The ruler reads
 * this signal so its tick labels follow the Frame/Seconds switch.
 */
export type TimelineUnitMode = FrameGotoMode;

const timelineUnitMode = signal<TimelineUnitMode>('frame');

/** Subscribing read for render paths (the popup switch and the ruler). */
export function getTimelineUnitMode(): TimelineUnitMode {
  return timelineUnitMode.value;
}

/** Dispatch-time read for pointer handlers. */
export function peekTimelineUnitMode(): TimelineUnitMode {
  return timelineUnitMode.peek();
}

/** Compare-then-write setter (reactivity rule 3). */
export function setTimelineUnitMode(next: TimelineUnitMode): boolean {
  if (timelineUnitMode.peek() === next) return false;
  timelineUnitMode.value = next;
  return true;
}

/** Compact ruler label for a seconds value: 0, 0.25, 1, 0.125 (no zeros). */
export function formatRulerSecondsLabel(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0';
  const fixed = seconds.toFixed(3).replace(/\.?0+$/, '');
  return fixed === '' || fixed === '-0' ? '0' : fixed;
}
