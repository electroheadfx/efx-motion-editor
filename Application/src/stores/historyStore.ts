import {signal} from '@preact/signals';
import type {HistoryEntry} from '../types/history';

const stack = signal<HistoryEntry[]>([]);
const pointer = signal(-1);

export const historyStore = {
  stack,
  pointer,
  // Undo/redo logic lives in lib/history.ts (pushAction, undo, redo, resetHistory, etc.)
};
