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
// 61-17 (G-6): the pen / path-edit / anchor-selection latches and their exit
// actions live in the dependency-free leaf `vectorPathLatches` so the Select
// and picker entry choke points can import them without a cycle. This module
// RE-EXPORTS every moved symbol, so the signals below are the same objects and
// every shipped import path keeps working unchanged.
//
// Preact reactivity: module-level signals with compare-then-write setters
// (`efx-preact-reactivity`), `.peek()` in handlers, never a render-body write.
import { signal } from '@preact/signals';
import { disarmAquarellePicker } from './aquarelleColorPicker';
import { setAquarelleSelectMode } from './aquarelleStrokeSelection';
import { clearVectorAnchorSelection, exitPathEdit, exitVectorPen, pathEditMutationId, vectorPenActive, writeIfChanged } from './vectorPathLatches';

export * from './vectorPathLatches';

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

/** The draw draft in progress; survives a tool toggle and clears only on Escape / finish / reset. */
export const vectorDrawDraft = signal<VectorDrawDraft | null>(null);

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

/** The rail button and the bare-V key share this one toggle. */
export function toggleVectorPen(): void {
  if (vectorPenActive.peek()) exitVectorPen();
  else enterVectorPen();
}

/**
 * Open path edit for one stroke. Clears the pen and the picker; never touches
 * Select mode or the paint tool.
 *
 * Path edit lives INSIDE Move/Select, not instead of it: the spline pointer
 * being pressed is a state of the open sheet (61-UI-SPEC §292, §296), and the
 * sheet is what hosts the anchor-width control. Leaving Select here would clear
 * the very selection `resolvePathEditGate` and `resolveAnchorWidthTarget`
 * resolve from — and close the sheet — so the edit would be entered and exited
 * in the same tick and no anchor could ever be grabbed.
 */
export function enterPathEdit(mutationId: string): void {
  writeIfChanged(pathEditMutationId, mutationId);
  exitVectorPen();
  disarmAquarellePicker();
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
  clearVectorAnchorSelection();
}
