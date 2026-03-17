import {signal, computed} from '@preact/signals';
import {projectStore} from './projectStore';
import {totalFrames as totalFramesSignal} from '../lib/frameMap';

const currentFrame = signal(0);
const displayFrame = signal(0);
const isPlaying = signal(false);
const timelineDragging = signal(false);
const zoom = signal(1);
const scrollX = signal(0);
const scrollY = signal(0);
const viewportWidth = signal(0);

const currentTime = computed(() => currentFrame.value / projectStore.fps.value);
const displayTime = computed(() => displayFrame.value / projectStore.fps.value);
const totalDuration = computed(() => totalFramesSignal.value / projectStore.fps.value);

// Timeline layout constants (mirrored from TimelineRenderer to avoid circular deps)
const BASE_FRAME_WIDTH = 60;
const TRACK_HEADER_WIDTH = 80;

export const timelineStore = {
  currentFrame,
  displayFrame,
  isPlaying,
  timelineDragging,
  zoom,
  scrollX,
  scrollY,
  viewportWidth,
  currentTime,
  displayTime,
  totalFrames: totalFramesSignal,
  totalDuration,

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
    zoom.value = Math.max(0.1, Math.min(10, v));
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
