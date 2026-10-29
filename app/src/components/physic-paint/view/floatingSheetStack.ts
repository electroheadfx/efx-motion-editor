// ============================================================
//  261029-hy2 — the shared floating-sheet stack.
//
//  Three Studio sheets overlap inside the canvas region: the
//  Move-edit (Stroke settings) sheet, the brush catalog and the
//  Settings sheet. They share ONE bottom-to-top order so pressing
//  anywhere inside a sheet brings it to the front.
//
//  This module is UI layering only — never confuse it with
//  stackOrder (the paint-layer ordering law).
// ============================================================

import { signal } from '@preact/signals';

export type FloatingSheetId = 'stroke-settings' | 'brushes' | 'settings';

/**
 * Per-sheet ids: a sheet imports ITS id and never spells the string inline,
 * so the stack stays the single spelling site.
 */
export const SHEET_ID_STROKE_SETTINGS: FloatingSheetId = 'stroke-settings';
export const SHEET_ID_BRUSHES: FloatingSheetId = 'brushes';
export const SHEET_ID_SETTINGS: FloatingSheetId = 'settings';

const INITIAL_ORDER: readonly FloatingSheetId[] = [
  SHEET_ID_STROKE_SETTINGS,
  SHEET_ID_BRUSHES,
  SHEET_ID_SETTINGS,
];

/** Bottom-to-top. Components read it through sheetZIndex only (narrow read). */
export const floatingSheetOrder = signal<readonly FloatingSheetId[]>(INITIAL_ORDER);

const BASE_Z_INDEX = 50;

/** The sheet's stacking level — base 50 plus its position; 50 for an unknown id. */
export function sheetZIndex(id: FloatingSheetId): number {
  const index = floatingSheetOrder.value.indexOf(id);
  return index === -1 ? BASE_Z_INDEX : BASE_Z_INDEX + index;
}

/**
 * Raise one sheet above the other two. Event handlers only — never call it
 * from a render body (efx-preact-reactivity rule 6). Compare-then-write: an
 * already-front id keeps the SAME array reference, so nothing re-renders.
 */
const KNOWN_SHEET_IDS: ReadonlySet<FloatingSheetId> = new Set(INITIAL_ORDER);

export function bringSheetToFront(id: FloatingSheetId): void {
  if (!KNOWN_SHEET_IDS.has(id)) return;
  const order = floatingSheetOrder.value;
  if (order[order.length - 1] === id) return;
  // A released (closed) sheet rejoins at the top when it opens again.
  floatingSheetOrder.value = [...order.filter((entry) => entry !== id), id];
}

/**
 * Remove a CLOSED sheet from the order. Without this the front id outlives its
 * sheet, and the front-only Escape gate then ignores the key for every sheet
 * that is actually open. Compare-then-write; unknown ids are a no-op.
 */
export function releaseSheet(id: FloatingSheetId): void {
  const order = floatingSheetOrder.value;
  if (!order.includes(id)) return;
  floatingSheetOrder.value = order.filter((entry) => entry !== id);
}

/**
 * True when `id` is the FRONT (top-most) sheet. Every sheet registers its own
 * window keydown listener, and listeners on the same node all run — only
 * `stopImmediatePropagation()` suppresses siblings, never `stopPropagation()`.
 * Escape dismissal is therefore front-only.
 */
export function isFrontSheet(id: FloatingSheetId): boolean {
  const order = floatingSheetOrder.peek();
  return order[order.length - 1] === id;
}

/**
 * Front-only dismissal shared by the three sheet Escape handlers. Closes and
 * returns true when this sheet is front; a background sheet returns false and
 * leaves the key to the front one. Event handlers only — never a render body.
 */
export function closeSheetIfFront(id: FloatingSheetId, close: () => void): boolean {
  if (!isFrontSheet(id)) return false;
  close();
  releaseSheet(id);
  return true;
}

/** Restore the initial order (test hygiene; not a user-facing action). */
export function resetFloatingSheetStack(): void {
  if (floatingSheetOrder.value === INITIAL_ORDER) return;
  floatingSheetOrder.value = INITIAL_ORDER;
}
