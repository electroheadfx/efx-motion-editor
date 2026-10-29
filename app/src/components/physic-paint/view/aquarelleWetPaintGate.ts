// ============================================================
//  aquarelleWetPaintGate — the ONE host-visible "the live sheet
//  holds standing water" store (261029-lel).
//
//  Water only blends live standing water: on a settled sheet, a
//  script key or a raster key the Water tool can do nothing, so
//  the rail, the four-tool row and the W shortcut all read this
//  gate and refuse the tool while it is closed.
//
//  Session/live-sheet state only — never persisted, never part
//  of the record payload. Published exclusively by the live
//  canvas layer's rAF tick while no stroke is in flight.
// ============================================================

import { signal } from '@preact/signals';
import { aquarelleActiveTool, setAquarelleTool } from './aquarelleRecordState';

/** True while the live sheet holds standing water the Water tool can act on. */
export const aquarelleHasWetPaint = signal(false);

/**
 * Publish the live sheet's wetness. Compare-then-write (efx-preact-reactivity
 * rule 3): a same-value publish must not wake subscribers. On the true -> false
 * transition the Water tool cannot stay active — there is nothing left to
 * blend — so it falls back to Brush (same precedent as the Select disarm).
 */
export function setAquarelleHasWetPaint(next: boolean): void {
  const current = aquarelleHasWetPaint.peek();
  if (current === next) return;
  aquarelleHasWetPaint.value = next;
  if (!next && aquarelleActiveTool.peek() === 'water') setAquarelleTool('brush');
}

/**
 * Engine teardown: the next mount starts on a blank sheet. Phrased as the gate
 * flipping, not as a tool change — a remount must not re-home the user's tool.
 */
export function clearAquarelleWetPaint(): void {
  if (!aquarelleHasWetPaint.peek()) return;
  aquarelleHasWetPaint.value = false;
}

/**
 * The stable dispatch-time probe the keyboard state holds. Never a captured
 * boolean: the keyboard state literal is rebuilt per Studio render and a
 * peeked value would be stale at keypress.
 */
export function aquarelleWaterAvailable(): boolean {
  return aquarelleHasWetPaint.peek();
}
