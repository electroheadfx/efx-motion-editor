// 61-08 (D-05 / D-06): the vector pen and path-edit session.
//
// This module is SESSION STATE ONLY. It reads no document store and imports no
// payload, codec or save-path module — Phase 60's law is that view state never
// reaches the document, and a vector stroke does not exist yet (61-08 only puts
// the tool in reach). The law it enforces is a mutual-exclusion matrix: the
// vector pen and path edit are two distinct states (D-06), never one toggling
// button, and every entry clears the sibling input surfaces through their own
// setters so no component writes another module's signal directly.
//
// Draft policy (61-08 Task 3): a draw draft survives a tool toggle — it is
// cleared only by Escape, by finishing the path, and by resetForStudioOpen.
//
// Preact reactivity: module-level signals with compare-then-write setters
// (`efx-preact-reactivity`), `.peek()` in handlers, never a render-body write.
import { signal, type Signal } from '@preact/signals';
import { disarmAquarellePicker } from './aquarelleColorPicker';
import { setAquarelleSelectMode } from './aquarelleStrokeSelection';

/** One anchor of the in-progress draw session — structurally the 61-02 VectorAnchor. */
export interface VectorDraftAnchor {
  readonly x: number;
  readonly y: number;
  readonly kind: 'auto' | 'bezier';
  readonly in?: { readonly x: number; readonly y: number };
  readonly out?: { readonly x: number; readonly y: number };
  readonly width?: number;
}

/** The in-progress path: the anchors placed so far and the last cursor station. */
export interface VectorDrawDraft {
  readonly anchors: readonly VectorDraftAnchor[];
  readonly cursor: { readonly x: number; readonly y: number } | null;
}

/** The vector pen latch — a HOST tool: latching it never changes `aquarelleActiveTool`. */
export const vectorPenActive = signal(false);

/** The stroke being path-edited, or null while no path edit is open (D-06, distinct from draw). */
export const pathEditMutationId = signal<string | null>(null);

/** The draw draft in progress; survives a tool toggle and clears only on Escape / finish / reset. */
export const vectorDrawDraft = signal<VectorDrawDraft | null>(null);

/** Compare-then-write: an identical value notifies zero effects (idempotent setters). */
function writeIfChanged<T>(target: Signal<T>, next: T): boolean {
  if (target.peek() === next) return false;
  target.value = next;
  return true;
}

/**
 * Latch the vector pen. Clears the sibling input surfaces through their own
 * actions — Select mode, the armed picker and any open path edit — and leaves
 * the paint tool untouched in both directions (it is a host tool).
 */
export function enterVectorPen(): void {
  writeIfChanged(vectorPenActive, true);
  setAquarelleSelectMode(false);
  disarmAquarellePicker();
  exitPathEdit();
}

/** Release the vector pen. Arms nothing and leaves the paint tool and the draft alone. */
export function exitVectorPen(): void {
  writeIfChanged(vectorPenActive, false);
}

/** The rail button and the bare-V key share this one toggle. */
export function toggleVectorPen(): void {
  if (vectorPenActive.peek()) exitVectorPen();
  else enterVectorPen();
}

/** Open path edit for one stroke. Clears the pen, Select mode and the picker; never touches the paint tool. */
export function enterPathEdit(mutationId: string): void {
  writeIfChanged(pathEditMutationId, mutationId);
  exitVectorPen();
  setAquarelleSelectMode(false);
  disarmAquarellePicker();
}

/** Close path edit. Re-arms nothing. */
export function exitPathEdit(): void {
  writeIfChanged(pathEditMutationId, null);
}

/** Start a draft from its first anchor; the cursor starts at that anchor. */
export function beginVectorDraft(anchor: VectorDraftAnchor): void {
  vectorDrawDraft.value = {
    anchors: [anchor],
    cursor: { x: anchor.x, y: anchor.y },
  };
}

/** Append one anchor; an append to an empty session begins the draft instead. */
export function appendVectorDraftAnchor(anchor: VectorDraftAnchor): void {
  const draft = vectorDrawDraft.peek();
  if (draft === null) {
    beginVectorDraft(anchor);
    return;
  }
  vectorDrawDraft.value = {
    anchors: [...draft.anchors, anchor],
    cursor: { x: anchor.x, y: anchor.y },
  };
}

/** Drop the draft. Escape / finish call this; a tool toggle deliberately does not. */
export function clearVectorDraft(): void {
  writeIfChanged(vectorDrawDraft, null);
}

/** Studio open resets every session latch — one mount call, idempotent. */
export function resetForStudioOpen(): void {
  writeIfChanged(vectorPenActive, false);
  writeIfChanged(pathEditMutationId, null);
  writeIfChanged(vectorDrawDraft, null);
}
