import {signal, computed} from '@preact/signals';
import {sequenceStore} from './sequenceStore';
import type {Layer} from '../types/layer';

const selectedLayerId = signal<string | null>(null);

/** Computed: layers for the currently active sequence (bottom-to-top order) */
const layers = computed<Layer[]>(() => {
  const seq = sequenceStore.getActiveSequence();
  return seq?.layers ?? [];
});

export const layerStore = {
  layers,
  selectedLayerId,

  /** Add a layer to the active sequence (pushes undo action via sequenceStore) */
  add(layer: Layer) {
    sequenceStore.addLayer(layer);
  },

  /** Remove a layer by ID from active sequence (cannot remove base layer) */
  remove(id: string) {
    const target = layers.value.find((l) => l.id === id);
    if (target?.isBase) return; // Cannot delete base layer
    sequenceStore.removeLayer(id);
  },

  /** Update layer properties */
  updateLayer(id: string, updates: Partial<Layer>) {
    sequenceStore.updateLayer(id, updates);
  },

  /** Reorder layers (oldIndex/newIndex in the layers array) */
  reorder(fromIndex: number, toIndex: number) {
    // Prevent moving base layer (always index 0) or moving anything below it
    if (fromIndex === 0 || toIndex === 0) return;
    sequenceStore.reorderLayers(fromIndex, toIndex);
  },

  setSelected(id: string | null) {
    selectedLayerId.value = id;
  },

  reset() {
    selectedLayerId.value = null;
  },
};
