import {signal, computed} from '@preact/signals';
import type {ProjectData} from '../types/project';

const name = signal('Untitled Project');
const fps = signal(24);
const width = signal(1920);
const height = signal(1080);

const aspectRatio = computed(() => width.value / height.value);

export const projectStore = {
  name,
  fps,
  width,
  height,
  aspectRatio,

  setName(v: string) {
    name.value = v;
  },
  setFps(v: number) {
    fps.value = v;
  },
  setResolution(w: number, h: number) {
    width.value = w;
    height.value = h;
  },

  loadFromData(data: ProjectData) {
    name.value = data.name;
    fps.value = data.fps;
    width.value = data.width;
    height.value = data.height;
  },

  reset() {
    name.value = 'Untitled Project';
    fps.value = 24;
    width.value = 1920;
    height.value = 1080;
  },
};
