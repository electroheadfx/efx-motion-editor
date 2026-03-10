import {signal, batch} from '@preact/signals';
import type {Sequence, KeyPhoto} from '../types/sequence';
import type {Layer} from '../types/layer';
import {createBaseLayer} from '../types/layer';
import {pushAction} from '../lib/history';

const sequences = signal<Sequence[]>([]);
const activeSequenceId = signal<string | null>(null);
const selectedKeyPhotoId = signal<string | null>(null);

/** Generate a unique ID */
function genId(): string {
  return crypto.randomUUID();
}

// NOTE: markDirty callback is set by projectStore via _setMarkDirtyCallback()
// to avoid circular imports. See projectStore.ts initialization.
// When Plan 03-02 adds projectStore.markDirty(), it should call:
//   import { _setMarkDirtyCallback } from './sequenceStore';
//   _setMarkDirtyCallback(() => projectStore.markDirty());
let _markDirty: (() => void) | null = null;
export function _setMarkDirtyCallback(fn: () => void) {
  _markDirty = fn;
}
function markDirty() {
  _markDirty?.();
}

/** Capture a snapshot of current state for undo/redo closures. */
function snapshot() {
  return {
    seqs: structuredClone(sequences.peek()),
    active: activeSequenceId.peek(),
  };
}

/** Restore a previously captured snapshot. Also marks project dirty. */
function restore(snap: {seqs: Sequence[]; active: string | null}) {
  batch(() => {
    sequences.value = snap.seqs;
    activeSequenceId.value = snap.active;
  });
  markDirty();
}

export const sequenceStore = {
  sequences,
  activeSequenceId,
  selectedKeyPhotoId,

  // --- Sequence CRUD ---

  /** Create a new sequence with default settings */
  createSequence(name: string): Sequence {
    const before = snapshot();

    const seq: Sequence = {
      id: genId(),
      kind: 'content',
      name,
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [createBaseLayer()],
    };
    sequences.value = [...sequences.value, seq];
    activeSequenceId.value = seq.id;
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Create sequence "${name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });

    return seq;
  },

  /** Add a pre-built sequence (used by hydration from .mce) — NOT undoable */
  add(seq: Sequence) {
    sequences.value = [...sequences.value, seq];
  },

  /** Remove a sequence by ID */
  remove(id: string) {
    const before = snapshot();

    sequences.value = sequences.value.filter((s) => s.id !== id);
    if (activeSequenceId.value === id) {
      activeSequenceId.value = sequences.value[0]?.id ?? null;
    }
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Delete sequence',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Duplicate a sequence */
  duplicate(id: string): Sequence | null {
    const original = sequences.value.find((s) => s.id === id);
    if (!original) return null;

    const before = snapshot();

    const copy: Sequence = {
      ...original,
      id: genId(),
      name: `${original.name} (Copy)`,
      keyPhotos: original.keyPhotos.map((kp) => ({
        ...kp,
        id: genId(),
      })),
      layers: structuredClone(original.layers),
    };
    sequences.value = [...sequences.value, copy];
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Duplicate sequence',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });

    return copy;
  },

  /** Reorder sequences by moving item from oldIndex to newIndex */
  reorderSequences(oldIndex: number, newIndex: number) {
    const before = snapshot();

    const arr = [...sequences.value];
    const [moved] = arr.splice(oldIndex, 1);
    arr.splice(newIndex, 0, moved);
    sequences.value = arr;
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Reorder sequences',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  // --- FX Sequence CRUD ---

  /** Create an FX sequence with a single FX layer, positioned globally on the timeline */
  createFxSequence(name: string, layer: Layer, totalFrames: number): Sequence {
    const before = snapshot();

    const seq: Sequence = {
      id: genId(),
      kind: 'fx',
      name,
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: totalFrames > 0 ? totalFrames : 100,
    };
    sequences.value = [...sequences.value, seq];
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Add FX "${name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });

    return seq;
  },

  /** Update inFrame/outFrame on an FX sequence (for timeline drag) */
  updateFxSequenceRange(id: string, inFrame: number, outFrame: number) {
    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === id ? {...s, inFrame, outFrame} : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Update FX range',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Get all content sequences (kind === 'content') */
  getContentSequences(): Sequence[] {
    return sequences.value.filter((s) => s.kind === 'content');
  },

  /** Get all FX sequences (kind === 'fx') */
  getFxSequences(): Sequence[] {
    return sequences.value.filter((s) => s.kind === 'fx');
  },

  /** Update sequence name */
  rename(id: string, name: string) {
    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === id ? {...s, name} : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Rename sequence',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Set per-sequence fps */
  setSequenceFps(id: string, fps: number) {
    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === id ? {...s, fps} : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Change sequence FPS',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Set per-sequence resolution */
  setSequenceResolution(id: string, width: number, height: number) {
    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === id ? {...s, width, height} : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Change sequence resolution',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  // --- Key Photo CRUD ---

  /** Add a key photo to a sequence */
  addKeyPhoto(sequenceId: string, imageId: string, holdFrames: number = 4) {
    const before = snapshot();

    const kp: KeyPhoto = {
      id: genId(),
      imageId,
      holdFrames,
    };
    sequences.value = sequences.value.map((s) =>
      s.id === sequenceId ? {...s, keyPhotos: [...s.keyPhotos, kp]} : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Add key photo',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Remove a key photo from a sequence */
  removeKeyPhoto(sequenceId: string, keyPhotoId: string) {
    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === sequenceId
        ? {...s, keyPhotos: s.keyPhotos.filter((kp) => kp.id !== keyPhotoId)}
        : s,
    );
    if (selectedKeyPhotoId.peek() === keyPhotoId) {
      selectedKeyPhotoId.value = null;
    }
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Remove key photo',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Reorder key photos within a sequence */
  reorderKeyPhotos(
    sequenceId: string,
    oldIndex: number,
    newIndex: number,
  ) {
    const before = snapshot();

    sequences.value = sequences.value.map((s) => {
      if (s.id !== sequenceId) return s;
      const arr = [...s.keyPhotos];
      const [moved] = arr.splice(oldIndex, 1);
      arr.splice(newIndex, 0, moved);
      return {...s, keyPhotos: arr};
    });
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Reorder key photos',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Update hold frames for a key photo */
  updateHoldFrames(
    sequenceId: string,
    keyPhotoId: string,
    holdFrames: number,
  ) {
    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === sequenceId
        ? {
            ...s,
            keyPhotos: s.keyPhotos.map((kp) =>
              kp.id === keyPhotoId ? {...kp, holdFrames} : kp,
            ),
          }
        : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Update hold frames',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  // --- Layer CRUD (per active sequence) ---

  /** Add a layer to the active sequence */
  addLayer(layer: Layer) {
    const activeId = activeSequenceId.peek();
    if (!activeId) return;

    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === activeId ? {...s, layers: [...s.layers, layer]} : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Add layer "${layer.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Remove a layer by ID from the active sequence */
  removeLayer(layerId: string) {
    const activeId = activeSequenceId.peek();
    if (!activeId) return;

    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === activeId
        ? {...s, layers: s.layers.filter((l) => l.id !== layerId)}
        : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Remove layer',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Update layer properties in the active sequence */
  updateLayer(layerId: string, updates: Partial<Layer>) {
    const activeId = activeSequenceId.peek();
    if (!activeId) return;

    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === activeId
        ? {
            ...s,
            layers: s.layers.map((l) =>
              l.id === layerId ? {...l, ...updates} : l,
            ),
          }
        : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Update layer',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Update a layer by ID across ALL sequences (finds owning sequence automatically) */
  updateLayerInSequence(layerId: string, updates: Partial<Layer>) {
    // Find which sequence owns this layer
    const ownerSeq = sequences.peek().find(s => s.layers.some(l => l.id === layerId));
    if (!ownerSeq) return;

    const before = snapshot();

    sequences.value = sequences.value.map((s) =>
      s.id === ownerSeq.id
        ? {
            ...s,
            layers: s.layers.map((l) =>
              l.id === layerId ? {...l, ...updates} : l,
            ),
          }
        : s,
    );
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Update layer',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Remove a layer by ID across ALL sequences (finds owning sequence automatically) */
  removeLayerFromSequence(layerId: string) {
    // Find which sequence owns this layer
    const ownerSeq = sequences.peek().find(s => s.layers.some(l => l.id === layerId));
    if (!ownerSeq) return;

    // Protect base layers
    const targetLayer = ownerSeq.layers.find(l => l.id === layerId);
    if (targetLayer?.isBase) return;

    const before = snapshot();

    const remainingLayers = ownerSeq.layers.filter(l => l.id !== layerId);

    // If this was the only layer in an FX sequence, remove the entire sequence
    if (ownerSeq.kind === 'fx' && remainingLayers.length === 0) {
      sequences.value = sequences.value.filter(s => s.id !== ownerSeq.id);
    } else {
      sequences.value = sequences.value.map((s) =>
        s.id === ownerSeq.id
          ? {...s, layers: remainingLayers}
          : s,
      );
    }
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Remove layer',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Reorder layers in the active sequence */
  reorderLayers(fromIndex: number, toIndex: number) {
    const activeId = activeSequenceId.peek();
    if (!activeId) return;

    const before = snapshot();

    sequences.value = sequences.value.map((s) => {
      if (s.id !== activeId) return s;
      const arr = [...s.layers];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return {...s, layers: arr};
    });
    markDirty();

    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Reorder layers',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  // --- Accessors (NOT undoable) ---

  setActive(id: string | null) {
    activeSequenceId.value = id;
    selectedKeyPhotoId.value = null;
  },

  selectKeyPhoto(id: string | null) {
    selectedKeyPhotoId.value = id;
  },

  clearKeyPhotoSelection() {
    selectedKeyPhotoId.value = null;
  },

  getById(id: string) {
    return sequences.value.find((s) => s.id === id) ?? null;
  },

  getActiveSequence() {
    if (!activeSequenceId.value) return null;
    return (
      sequences.value.find((s) => s.id === activeSequenceId.value) ?? null
    );
  },

  reset() {
    batch(() => {
      sequences.value = [];
      activeSequenceId.value = null;
      selectedKeyPhotoId.value = null;
    });
  },
};
