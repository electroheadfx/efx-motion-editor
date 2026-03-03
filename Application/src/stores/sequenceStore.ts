import {signal, batch} from '@preact/signals';
import type {Sequence, KeyPhoto} from '../types/sequence';

const sequences = signal<Sequence[]>([]);
const activeSequenceId = signal<string | null>(null);

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

export const sequenceStore = {
  sequences,
  activeSequenceId,

  // --- Sequence CRUD ---

  /** Create a new sequence with default settings */
  createSequence(name: string): Sequence {
    const seq: Sequence = {
      id: genId(),
      name,
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
    };
    sequences.value = [...sequences.value, seq];
    activeSequenceId.value = seq.id;
    markDirty();
    return seq;
  },

  /** Add a pre-built sequence (used by hydration from .mce) */
  add(seq: Sequence) {
    sequences.value = [...sequences.value, seq];
  },

  /** Remove a sequence by ID */
  remove(id: string) {
    sequences.value = sequences.value.filter((s) => s.id !== id);
    if (activeSequenceId.value === id) {
      activeSequenceId.value = sequences.value[0]?.id ?? null;
    }
    markDirty();
  },

  /** Duplicate a sequence */
  duplicate(id: string): Sequence | null {
    const original = sequences.value.find((s) => s.id === id);
    if (!original) return null;

    const copy: Sequence = {
      ...original,
      id: genId(),
      name: `${original.name} (Copy)`,
      keyPhotos: original.keyPhotos.map((kp) => ({
        ...kp,
        id: genId(),
      })),
    };
    sequences.value = [...sequences.value, copy];
    markDirty();
    return copy;
  },

  /** Reorder sequences by moving item from oldIndex to newIndex */
  reorderSequences(oldIndex: number, newIndex: number) {
    const arr = [...sequences.value];
    const [moved] = arr.splice(oldIndex, 1);
    arr.splice(newIndex, 0, moved);
    sequences.value = arr;
    markDirty();
  },

  /** Update sequence name */
  rename(id: string, name: string) {
    sequences.value = sequences.value.map((s) =>
      s.id === id ? {...s, name} : s,
    );
    markDirty();
  },

  /** Set per-sequence fps */
  setSequenceFps(id: string, fps: number) {
    sequences.value = sequences.value.map((s) =>
      s.id === id ? {...s, fps} : s,
    );
    markDirty();
  },

  /** Set per-sequence resolution */
  setSequenceResolution(id: string, width: number, height: number) {
    sequences.value = sequences.value.map((s) =>
      s.id === id ? {...s, width, height} : s,
    );
    markDirty();
  },

  // --- Key Photo CRUD ---

  /** Add a key photo to a sequence */
  addKeyPhoto(sequenceId: string, imageId: string, holdFrames: number = 4) {
    const kp: KeyPhoto = {
      id: genId(),
      imageId,
      holdFrames,
    };
    sequences.value = sequences.value.map((s) =>
      s.id === sequenceId ? {...s, keyPhotos: [...s.keyPhotos, kp]} : s,
    );
    markDirty();
  },

  /** Remove a key photo from a sequence */
  removeKeyPhoto(sequenceId: string, keyPhotoId: string) {
    sequences.value = sequences.value.map((s) =>
      s.id === sequenceId
        ? {...s, keyPhotos: s.keyPhotos.filter((kp) => kp.id !== keyPhotoId)}
        : s,
    );
    markDirty();
  },

  /** Reorder key photos within a sequence */
  reorderKeyPhotos(
    sequenceId: string,
    oldIndex: number,
    newIndex: number,
  ) {
    sequences.value = sequences.value.map((s) => {
      if (s.id !== sequenceId) return s;
      const arr = [...s.keyPhotos];
      const [moved] = arr.splice(oldIndex, 1);
      arr.splice(newIndex, 0, moved);
      return {...s, keyPhotos: arr};
    });
    markDirty();
  },

  /** Update hold frames for a key photo */
  updateHoldFrames(
    sequenceId: string,
    keyPhotoId: string,
    holdFrames: number,
  ) {
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
  },

  // --- Accessors ---

  setActive(id: string | null) {
    activeSequenceId.value = id;
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
    });
  },
};
