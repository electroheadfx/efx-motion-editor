// ============================================================
//  61-17 (G-6) — the dependency-free vector session latches.
//
//  These signals and their exit actions are lifted out of
//  `vectorPathSession` so the two surface entry choke points
//  (`aquarelleStrokeSelection.setAquarelleSelectMode` and
//  `aquarelleColorPicker.setAquarellePickerLatched`) can release the
//  vector pen and an open path edit WITHOUT importing the session
//  module: the session already imports both, and a reverse import
//  would be an evaluation cycle over module-level signals (T-61-60).
//
//  This module imports ONLY the signals runtime. It reads no document
//  store, imports no payload / codec / save-path module, and never
//  touches the Studio. `vectorPathSession` re-exports every symbol
//  here, so module identity and every shipped import path are
//  preserved unchanged.
//
//  Preact reactivity: compare-then-write on every writer
//  (`efx-preact-reactivity` rule 3); handlers read with `.peek()`,
//  never a render-body write.
// ============================================================
import { signal, type Signal } from '@preact/signals';

/** The vector pen latch — a HOST tool: latching it never changes `aquarelleActiveTool`. */
export const vectorPenActive = signal(false);

/** The stroke being path-edited, or null while no path edit is open (D-06, distinct from draw). */
export const pathEditMutationId = signal<string | null>(null);

/**
 * 61-10: the open path edit's anchor selection — the ONE selection signal.
 * The overlay writes it through `selectAnchor`; the dialog plan (61-11) reads
 * it. Never a second copy.
 */
export const vectorAnchorSelection = signal<readonly number[]>([]);

/** Deduplicated, ascending selection; unknown indices are dropped. */
function normaliseAnchorSelection(indices: readonly number[]): readonly number[] {
  const kept = new Set<number>();
  for (const index of indices) {
    if (Number.isInteger(index) && index >= 0) kept.add(index);
  }
  return [...kept].sort((a, b) => a - b);
}

function sameAnchorSelection(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

/** Write the selection; an identical value notifies zero effects. */
export function setVectorAnchorSelection(indices: readonly number[]): void {
  const next = normaliseAnchorSelection(indices);
  if (sameAnchorSelection(vectorAnchorSelection.peek(), next)) return;
  vectorAnchorSelection.value = next;
}

/** Toggle one anchor in/out of the selection, keeping it ascending. */
export function toggleVectorAnchorSelection(index: number): void {
  if (!Number.isInteger(index) || index < 0) return;
  const current = vectorAnchorSelection.peek();
  const next = current.includes(index)
    ? current.filter((value) => value !== index)
    : [...current, index].sort((a, b) => a - b);
  if (sameAnchorSelection(current, next)) return;
  vectorAnchorSelection.value = next;
}

/** Drop the selection; an already-empty selection notifies nothing. */
export function clearVectorAnchorSelection(): void {
  if (vectorAnchorSelection.peek().length === 0) return;
  vectorAnchorSelection.value = [];
}

/** Compare-then-write: an identical value notifies zero effects (idempotent setters). */
export function writeIfChanged<T>(target: Signal<T>, next: T): boolean {
  if (target.peek() === next) return false;
  target.value = next;
  return true;
}

/** Release the vector pen. Arms nothing and leaves the paint tool and the draft alone. */
export function exitVectorPen(): void {
  writeIfChanged(vectorPenActive, false);
}

/** Close path edit. Re-arms nothing and drops the anchor selection with the edit. */
export function exitPathEdit(): void {
  writeIfChanged(pathEditMutationId, null);
  clearVectorAnchorSelection();
}
