import {signal} from '@preact/signals';
import type {HistoryEntry} from '../types/history';

const stack = signal<HistoryEntry[]>([]);
const pointer = signal(-1);

export const historyStore = {
  stack,
  pointer,
  // Undo/redo logic deferred to Phase 8 (UNDO-01, UNDO-02, UNDO-03)
};
