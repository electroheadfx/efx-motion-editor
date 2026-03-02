import {signal} from '@preact/signals';
import type {Layer} from '../types/layer';

const layers = signal<Layer[]>([]);
const selectedLayerId = signal<string | null>(null);

export const layerStore = {
  layers,
  selectedLayerId,

  add(layer: Layer) {
    layers.value = [...layers.value, layer];
  },
  remove(id: string) {
    layers.value = layers.value.filter(l => l.id !== id);
  },
  setSelected(id: string | null) {
    selectedLayerId.value = id;
  },
  updateLayer(id: string, updates: Partial<Layer>) {
    layers.value = layers.value.map(l =>
      l.id === id ? {...l, ...updates} : l,
    );
  },
  reorder(fromIndex: number, toIndex: number) {
    const arr = [...layers.value];
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    layers.value = arr;
  },
  reset() {
    layers.value = [];
    selectedLayerId.value = null;
  },
};
