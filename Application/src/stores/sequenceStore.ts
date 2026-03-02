import {signal} from '@preact/signals';
import type {Sequence} from '../types/sequence';

const sequences = signal<Sequence[]>([]);
const activeSequenceId = signal<string | null>(null);

export const sequenceStore = {
  sequences,
  activeSequenceId,

  add(seq: Sequence) {
    sequences.value = [...sequences.value, seq];
  },
  remove(id: string) {
    sequences.value = sequences.value.filter(s => s.id !== id);
  },
  setActive(id: string | null) {
    activeSequenceId.value = id;
  },
  getById(id: string) {
    return sequences.value.find(s => s.id === id) ?? null;
  },
  reset() {
    sequences.value = [];
    activeSequenceId.value = null;
  },
};
