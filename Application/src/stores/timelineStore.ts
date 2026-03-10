import {signal, computed} from '@preact/signals';
import {projectStore} from './projectStore';
import {totalFrames as totalFramesSignal} from '../lib/frameMap';

const currentFrame = signal(0);
const displayFrame = signal(0);
const isPlaying = signal(false);
const zoom = signal(1);
const scrollX = signal(0);
const scrollY = signal(0);

const currentTime = computed(() => currentFrame.value / projectStore.fps.value);
const displayTime = computed(() => displayFrame.value / projectStore.fps.value);
const totalDuration = computed(() => totalFramesSignal.value / projectStore.fps.value);

export const timelineStore = {
  currentFrame,
  displayFrame,
  isPlaying,
  zoom,
  scrollX,
  scrollY,
  currentTime,
  displayTime,
  totalFrames: totalFramesSignal,
  totalDuration,

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
