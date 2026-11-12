/**
 * 61-17 Task 1 (G-6) — the dependency-free vector latches.
 *
 * Laws pinned here:
 *   - one pen latch, one path-edit latch and one anchor selection exist in the
 *     codebase: the session module RE-EXPORTS the leaf's signals (identity,
 *     not equality), so no second copy can drift
 *   - `exitVectorPen` / `exitPathEdit` are compare-then-write — 1000 identical
 *     calls notify once (`efx-preact-reactivity` rule 3)
 *   - `exitPathEdit` drops the anchor selection with the edit
 */
import { describe, expect, it } from 'vitest';
import { effect } from '@preact/signals';
import {
  exitPathEdit,
  exitVectorPen,
  pathEditMutationId,
  vectorAnchorSelection,
  vectorPenActive,
} from './vectorPathLatches';
import {
  pathEditMutationId as sessionPathEditMutationId,
  vectorAnchorSelection as sessionVectorAnchorSelection,
  vectorPenActive as sessionVectorPenActive,
} from './vectorPathSession';

/** Count how many times a read runs — an `effect()` re-runs only on a REAL write. */
function countRuns(read: () => unknown): { runs: () => number; dispose: () => void } {
  let runs = 0;
  const dispose = effect(() => {
    void read();
    runs += 1;
  });
  return { runs: () => runs, dispose };
}

describe('vectorPathLatches — one copy of each latch (61-17)', () => {
  it('the session module re-exports the SAME signal objects, not copies', () => {
    expect(sessionVectorPenActive).toBe(vectorPenActive);
    expect(sessionPathEditMutationId).toBe(pathEditMutationId);
    expect(sessionVectorAnchorSelection).toBe(vectorAnchorSelection);
  });

  it('exitVectorPen and exitPathEdit are compare-then-write: 1000 calls notify once', () => {
    vectorPenActive.value = true;
    const penRuns = countRuns(() => vectorPenActive.value);
    try {
      for (let call = 0; call < 1000; call += 1) exitVectorPen();
      // One initial run + exactly one real write.
      expect(penRuns.runs()).toBe(2);
      expect(vectorPenActive.peek()).toBe(false);
    } finally {
      penRuns.dispose();
    }

    pathEditMutationId.value = 'm17';
    const editRuns = countRuns(() => pathEditMutationId.value);
    try {
      for (let call = 0; call < 1000; call += 1) exitPathEdit();
      expect(editRuns.runs()).toBe(2);
      expect(pathEditMutationId.peek()).toBeNull();
    } finally {
      editRuns.dispose();
      exitVectorPen();
      exitPathEdit();
    }
  });

  it('exitPathEdit drops the anchor selection with the edit', () => {
    pathEditMutationId.value = 'm17';
    vectorAnchorSelection.value = [0, 2];

    exitPathEdit();

    expect(pathEditMutationId.peek()).toBeNull();
    expect(vectorAnchorSelection.peek()).toEqual([]);
  });
});
