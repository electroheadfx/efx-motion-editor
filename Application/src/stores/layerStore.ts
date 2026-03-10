import {signal, computed} from '@preact/signals';
import {sequenceStore} from './sequenceStore';
import type {Layer} from '../types/layer';

const selectedLayerId = signal<string | null>(null);

/** Computed: layers for the currently active sequence (bottom-to-top order) */
const layers = computed<Layer[]>(() => {
  const seq = sequenceStore.getActiveSequence();
  return seq?.layers ?? [];
});

/** Computed: all layers from all FX sequences */
const fxLayers = computed<Layer[]>(() => {
  return sequenceStore.getFxSequences().flatMap(s => s.layers);
});

export const layerStore = {
  layers,
  fxLayers,
  selectedLayerId,

  /** Add a layer to the active sequence (pushes undo action via sequenceStore) */
  add(layer: Layer) {
    sequenceStore.addLayer(layer);
  },

  /** Remove a layer by ID (routes to sequence-aware method for FX layers) */
  remove(id: string) {
    // Check if this is an FX layer
    if (fxLayers.peek().some(l => l.id === id)) {
      sequenceStore.removeLayerFromSequence(id);
      return;
    }
    const target = layers.value.find((l) => l.id === id);
    if (target?.isBase) return; // Cannot delete base layer
    sequenceStore.removeLayer(id);
  },

  /** Update layer properties (routes to sequence-aware method for FX layers) */
  updateLayer(id: string, updates: Partial<Layer>) {
    if (fxLayers.peek().some(l => l.id === id)) {
      sequenceStore.updateLayerInSequence(id, updates);
      return;
    }
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
