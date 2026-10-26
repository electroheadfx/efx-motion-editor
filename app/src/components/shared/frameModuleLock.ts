/**
 * quick-261025-awl (D-01/D-02/D-03): the ONE frame script ownership signal.
 *
 * A frame is owned by a single module — Brush, Water color, both or none.
 * The Studio publishes the owner from its explicit-selection seams and the
 * top-bar ModuleSwitcher reads it to lock the non-owning slot. The Toolbar
 * mount never receives the lock, so the main window stays fully enabled.
 *
 * Writes are compare-then-write so per-seam refreshes never wake subscribers
 * with an unchanged value. This module holds the ONE FrameScriptOwner
 * declaration — frameScriptOwnership.ts re-exports it.
 */
import { computed, signal } from '@preact/signals';
import type { ActiveModule } from './activeModule';

export type FrameScriptOwner = 'brush' | 'watercolor' | 'both' | null;

export const frameScriptOwner = signal<FrameScriptOwner>(null);

export function setFrameScriptOwner(owner: FrameScriptOwner): void {
  if (frameScriptOwner.peek() === owner) return;
  frameScriptOwner.value = owner;
}

export function clearFrameScriptOwner(): void {
  setFrameScriptOwner(null);
}

/**
 * quick-261026-odd — the Move tool's ONE enable gate.
 *
 * Move translates a stroke script, so only a Brush-owned key can enter it; a
 * Water color-only key and a scriptless key (Motion/Static/Reveal rails bake
 * pixels only) have nothing to move. Derived from frameScriptOwner so the
 * rail, the Cmd tap, the held-Cmd arm and every programmatic activation read
 * the same truth.
 */
export const brushMoveAvailable = computed(
  () => frameScriptOwner.value === 'brush' || frameScriptOwner.value === 'both',
);

/** The non-owning module for a single-owner frame; both/none lock nothing. */
export function lockedModuleForOwner(owner: FrameScriptOwner): ActiveModule | null {
  if (owner === 'brush') return 'watercolor';
  if (owner === 'watercolor') return 'brush';
  return null;
}

/** Tooltip for the Studio's locked slot — names owner, lock and the remedy. */
export function lockedModuleTooltip(locked: ActiveModule): string {
  if (locked === 'watercolor') {
    return 'This key has a Brush script. Water color is unavailable until you raster it — Raster in the timeline header removes the script so either module can paint.';
  }
  return 'This key has a Water color script. Brush is unavailable until you raster it — Raster in the timeline header removes the script so either module can paint.';
}
