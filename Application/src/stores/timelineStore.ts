import {signal, computed} from '@preact/signals';
import {projectStore} from './projectStore';

const currentFrame = signal(0);
const isPlaying = signal(false);
const zoom = signal(1);
const scrollX = signal(0);

const currentTime = computed(() => currentFrame.value / projectStore.fps.value);

export const timelineStore = {
  currentFrame,
  isPlaying,
  zoom,
  scrollX,
  currentTime,

  seek(frame: number) {
    currentFrame.value = Math.max(0, frame);
  },
  setPlaying(v: boolean) {
    isPlaying.value = v;
  },
  togglePlaying() {
    isPlaying.value = !isPlaying.value;
  },
  stepForward() {
    currentFrame.value += 1;
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
  reset() {
    currentFrame.value = 0;
    isPlaying.value = false;
    zoom.value = 1;
    scrollX.value = 0;
  },
};
