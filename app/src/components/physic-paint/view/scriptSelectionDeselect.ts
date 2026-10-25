/**
 * 261025-d3r revision — the canvas-region background is a deselect target.
 *
 * When a canvas is full of strokes there may be no empty pixel left inside
 * it; a plain click on the dark workspace around the canvas sheet must drop
 * the Move/Select selection. The canvas itself keeps the overlay's own
 * click law; selection-scoped chrome (the Stroke Settings dialog, the
 * full-area gallery pickers) keeps the set too — those clicks operate ON
 * the selection.
 *
 * Additive clicks (Cmd/Ctrl/Shift) keep the set, mirroring the overlay's
 * additive-empty law. No DOM access beyond the target's closest().
 */

const KEEP_SELECTION_WITHIN = '.demo-canvas-shell, [role="dialog"], .physics-paint-background-picker';

type ClosestTarget = { closest?: (selector: string) => unknown };

export function shouldClearSelectionOnCanvasRegionPointerDown(
  event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  target: ClosestTarget | null,
): boolean {
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey) return false;
  if (!target || typeof target.closest !== 'function') return false;
  return target.closest(KEEP_SELECTION_WITHIN) == null;
}
