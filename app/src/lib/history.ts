import {batch} from '@preact/signals';
import {historyStore} from '../stores/historyStore';
import type {HistoryEntry} from '../types/history';

const MAX_STACK_SIZE = 200;
let coalescing = false;
let coalesceEntry: HistoryEntry | null = null;

/**
 * Push an undoable action onto the history stack.
 *
 * When coalescing is active (between startCoalescing/stopCoalescing),
 * subsequent pushes update only the redo closure of the first entry —
 * keeping the original undo (mousedown state) so the entire drag
 * collapses to a single undo entry.
 */
export function pushAction(entry: HistoryEntry): void {
  if (coalescing && coalesceEntry) {
    // Update the redo of the coalescing entry (keep original undo)
    coalesceEntry.redo = entry.redo;
    return;
  }

  const {stack, pointer} = historyStore;

  // Truncate any redo entries beyond current pointer (Pitfall 2: undo corruption)
  const newStack = stack.value.slice(0, pointer.value + 1);
  newStack.push(entry);

  // Enforce max size — drop oldest entry
  if (newStack.length > MAX_STACK_SIZE) {
    newStack.shift();
  }

  batch(() => {
    stack.value = newStack;
    pointer.value = newStack.length - 1;
  });

  // If coalescing just started, mark this as the coalesce anchor
  if (coalescing) {
    coalesceEntry = newStack[newStack.length - 1];
  }
}

/**
 * Undo the most recent action.
 * Moves the pointer back one position and calls the entry's undo closure.
 */
export function undo(): void {
  const {stack, pointer} = historyStore;
  if (pointer.value < 0) return;

  const entry = stack.value[pointer.value];
  batch(() => {
    entry.undo();
  });
  pointer.value = pointer.value - 1;
}

/**
 * Redo the most recently undone action.
 * Moves the pointer forward one position and calls the entry's redo closure.
 */
export function redo(): void {
  const {stack, pointer} = historyStore;
  if (pointer.value >= stack.value.length - 1) return;

  pointer.value = pointer.value + 1;
  const entry = stack.value[pointer.value];
  batch(() => {
    entry.redo();
  });
}

/**
 * Begin coalescing mode — used on mousedown/pointerdown for sliders.
 * The first pushAction during coalescing becomes the anchor entry.
 * Subsequent pushActions update only its redo closure, so the entire
 * mousedown-to-mouseup drag becomes a single undo entry.
 */
export function startCoalescing(): void {
  coalescing = true;
  coalesceEntry = null;
}

/**
 * End coalescing mode — used on mouseup/pointerup.
 * Clears the coalesce anchor so future pushActions create new entries.
 */
export function stopCoalescing(): void {
  coalescing = false;
  coalesceEntry = null;
}

/**
 * Clear the entire undo/redo stack.
 * Called on New Project / Open Project / Close Project for a fresh stack.
 */
export function resetHistory(): void {
  coalescing = false;
  coalesceEntry = null;
  batch(() => {
    historyStore.stack.value = [];
    historyStore.pointer.value = -1;
  });
}

/** Returns true when there are actions that can be undone. */
export function canUndo(): boolean {
  return historyStore.pointer.value >= 0;
}

/** Returns true when there are actions that can be redone. */
export function canRedo(): boolean {
  return historyStore.pointer.value < historyStore.stack.value.length - 1;
}
