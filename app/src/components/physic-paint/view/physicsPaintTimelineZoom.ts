import { computed, signal } from '@preact/signals';

/**
 * Phase 60 RED scaffold — every export the authority will provide, with
 * placeholder behaviour so the unit suite is discovered and fails on its
 * assertions. GREEN replaces this file with the real implementation.
 */

export const TIMELINE_ZOOM_PRESETS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
export const TIMELINE_ZOOM_MIN = 0.25;
export const TIMELINE_ZOOM_MAX = 4;
export const TIMELINE_ZOOM_EPSILON = 0.001;
export const TIMELINE_LANE_ORIGIN_PX = 6;
export const TIMELINE_RULER_MIN_TICK_PX = 40;
export const TIMELINE_RULER_MIN_STEP = 3;

export interface TimelineMetrics {
  readonly scale: number;
  readonly cellWidth: number;
  readonly cellGap: number;
  readonly pitch: number;
}

export interface TimelineZoomScrollPort {
  getScrollLeft(): number;
  getScrollerLeft(): number;
  getClientWidth(): number;
  setScrollLeft(value: number): void;
  getPlayheadFrame(): number;
  getFrameCount(): number;
}

export function clampTimelineZoomScale(scale: number): number {
  return scale;
}

export function resolveTimelineMetrics(scale: number): TimelineMetrics {
  return { scale, cellWidth: 0, cellGap: 0, pitch: 0 };
}

export function resolveRulerStep(_pitch: number): number {
  return TIMELINE_RULER_MIN_STEP;
}

export function resolveCursorAnchorLocalX(_clientX: number, _scrollerLeft: number): number {
  return 0;
}

export function resolvePlayheadAnchorLocalX(
  _scrollLeft: number,
  _clientWidth: number,
  _playheadFrame: number,
  _pitch: number,
): number {
  return 0;
}

export function resolveAnchoredScrollLeft(
  _scrollLeft: number,
  _localX: number,
  _oldPitch: number,
  _newPitch: number,
): number {
  return 0;
}

export function frameToPx(_frame: number, _pitch: number): number {
  return 0;
}

export function pxToFrame(_clientX: number, _scrollerLeft: number, _scrollLeft: number, _pitch: number): number {
  return 0;
}

export function resolveTimelineViewportFrames(
  _scrollLeft: number,
  _clientWidth: number,
  _pitch: number,
): { visStart: number; visEnd: number } | null {
  return null;
}

export function resolveTimelineFitScale(_frameCount: number, _clientWidth: number): number {
  return 1;
}

export function nextTimelineZoomPreset(current: number, _direction: 1 | -1): number {
  return current;
}

export function nextTimelineZoomWheelScale(current: number, _deltaY: number, _deltaMode: number): number {
  return current;
}

export function resolveTimelineZoomPercent(_scale: number): number {
  return 0;
}

const scaleSignal = signal(1);

export function registerTimelineZoomScrollPort(_port: TimelineZoomScrollPort | null): void {
  // Scaffold: no port storage yet.
}

export const timelineZoom = {
  scale: scaleSignal,
  metrics: computed(() => resolveTimelineMetrics(scaleSignal.value)),
  percent: computed(() => resolveTimelineZoomPercent(scaleSignal.value)),
  isAtMin: computed(() => scaleSignal.value <= TIMELINE_ZOOM_MIN),
  isAtMax: computed(() => scaleSignal.value >= TIMELINE_ZOOM_MAX),

  setScale(next: number): void {
    scaleSignal.value = next;
  },

  setScaleAtCursor(_nextScale: number, _clientX: number): void {},

  zoomIn(): void {},

  zoomOut(): void {},

  fit(): void {},

  resetForStudioOpen(): void {
    scaleSignal.value = 1;
  },
};
