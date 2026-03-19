import {signal, computed} from '@preact/signals';
import {projectStore} from './projectStore';
import {totalFrames as totalFramesSignal, fxTrackLayouts} from '../lib/frameMap';

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
const ZOOM_STEP = 1.3;
const EPSILON = 0.001;

const currentFrame = signal(0);
const displayFrame = signal(0);
const isPlaying = signal(false);
const timelineDragging = signal(false);
const zoom = signal(1);
const scrollX = signal(0);
const scrollY = signal(0);
const viewportWidth = signal(0);
const viewportHeight = signal(0);

const currentTime = computed(() => currentFrame.value / projectStore.fps.value);
const displayTime = computed(() => displayFrame.value / projectStore.fps.value);
const totalDuration = computed(() => totalFramesSignal.value / projectStore.fps.value);
const isAtMinZoom = computed(() => zoom.value <= ZOOM_MIN + EPSILON);
const isAtMaxZoom = computed(() => zoom.value >= ZOOM_MAX - EPSILON);

// Timeline layout constants (mirrored from TimelineRenderer to avoid circular deps)
const BASE_FRAME_WIDTH = 60;
const TRACK_HEADER_WIDTH = 80;
const RULER_HEIGHT = 24;
const TRACK_HEIGHT = 52;
const FX_TRACK_HEIGHT = 28;

// Linear timeline: single content row
const totalContentHeight = computed(() => {
  const fxCount = fxTrackLayouts.value.length;
  return RULER_HEIGHT + fxCount * FX_TRACK_HEIGHT + TRACK_HEIGHT;
});

const maxScrollY = computed(() => {
  return Math.max(0, totalContentHeight.value - viewportHeight.value);
});

export const timelineStore = {
  currentFrame,
  displayFrame,
  isPlaying,
  timelineDragging,
  zoom,
  scrollX,
  scrollY,
  viewportWidth,
  viewportHeight,
  totalContentHeight,
  maxScrollY,
  currentTime,
  displayTime,
  totalFrames: totalFramesSignal,
  totalDuration,
  isAtMinZoom,
  isAtMaxZoom,

  setTimelineDragging(v: boolean) {
    timelineDragging.value = v;
  },
  seek(frame: number) {
    const max = totalFramesSignal.value;
    const upper = max > 0 ? max - 1 : 0;
    currentFrame.value = Math.max(0, Math.min(frame, upper));
  },
  setPlaying(v: boolean) {
    isPlaying.value = v;
  },
  togglePlaying() {
    isPlaying.value = !isPlaying.value;
  },
  stepForward() {
    const max = totalFramesSignal.value;
    const upper = max > 0 ? max - 1 : 0;
    if (currentFrame.value < upper) {
      currentFrame.value += 1;
    }
  },
  stepBackward() {
    currentFrame.value = Math.max(0, currentFrame.value - 1);
  },
  setZoom(v: number) {
    zoom.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
  },
  zoomIn() {
    const newZoom = Math.min(ZOOM_MAX, zoom.value * ZOOM_STEP);
    zoom.value = newZoom;
  },
  zoomOut() {
    const newZoom = Math.max(ZOOM_MIN, zoom.value / ZOOM_STEP);
    zoom.value = newZoom;
  },
  setScrollX(v: number) {
    scrollX.value = v;
  },
  setScrollY(v: number) {
    scrollY.value = Math.max(0, v);
  },
  setViewportWidth(v: number) {
    viewportWidth.value = v;
  },
  setViewportHeight(v: number) {
    viewportHeight.value = v;
  },
  /** Scroll the timeline so the given frame is visible (smooth follow for seeks). */
  ensureFrameVisible(frame: number) {
    const vw = viewportWidth.value;
    if (vw <= 0) return;
    const frameWidth = BASE_FRAME_WIDTH * zoom.value;
    const playheadX = frame * frameWidth;
    const trackArea = vw - TRACK_HEADER_WIDTH;
    const visibleLeft = scrollX.value;
    const visibleRight = scrollX.value + trackArea;
    const margin = frameWidth * 2;
    if (playheadX < visibleLeft + margin) {
      scrollX.value = Math.max(0, playheadX - margin);
    } else if (playheadX > visibleRight - margin) {
      scrollX.value = Math.max(0, playheadX - trackArea + margin);
    }
  },
  /** Page-style scroll: jump one screen width when playhead exits viewport. */
  ensureFrameVisiblePaged(frame: number) {
    const vw = viewportWidth.value;
    if (vw <= 0) return;
    const frameWidth = BASE_FRAME_WIDTH * zoom.value;
    const playheadX = frame * frameWidth;
    const trackArea = vw - TRACK_HEADER_WIDTH;
    const visibleLeft = scrollX.value;
    const visibleRight = scrollX.value + trackArea;
    if (playheadX < visibleLeft) {
      scrollX.value = Math.max(0, scrollX.value - trackArea);
    } else if (playheadX > visibleRight) {
      scrollX.value = scrollX.value + trackArea;
    }
  },
  /** No-op in linear timeline — all content is on one row, no vertical scroll needed. */
  ensureTrackVisible(_sequenceId: string) {
    // Linear timeline: single content row, no per-track vertical scroll
  },
  syncDisplayFrame() {
    displayFrame.value = currentFrame.value;
  },
  reset() {
    currentFrame.value = 0;
    displayFrame.value = 0;
    isPlaying.value = false;
    zoom.value = 1;
    scrollX.value = 0;
    scrollY.value = 0;
  },
};
