/**
 * quick-261025-awl (D-01/D-02/D-03): the ONE frame script ownership signal.
 *
 * A frame is owned by at most ONE module — Water color or none. The Studio
 * publishes the owner from its explicit-selection seams and the top-bar
 * ModuleSwitcher reads it to lock a slot. The Toolbar mount never receives the
 * lock, so the main window stays fully enabled.
 *
 * Writes are compare-then-write so per-seam refreshes never wake subscribers
 * with an unchanged value. This module holds the ONE FrameScriptOwner
 * declaration — frameScriptOwnership.ts re-exports it.
 *
 * 261027-klx — the Brush module is gone. The union collapses to Water color or
 * none, no owner can lock a switchable slot (Water color is the only module),
 * and the Move gate reads the single-engine owner directly.
 */
import { computed, signal } from '@preact/signals';
import type { ActiveModule } from './activeModule';

export type FrameScriptOwner = 'watercolor' | null;

export const frameScriptOwner = signal<FrameScriptOwner>(null);

export function setFrameScriptOwner(owner: FrameScriptOwner): void {
  if (frameScriptOwner.peek() === owner) return;
  frameScriptOwner.value = owner;
}

export function clearFrameScriptOwner(): void {
  setFrameScriptOwner(null);
}

/**
 * The Move tool's ONE enable gate.
 *
 * Move translates a Water color stroke script. A scriptless key
 * (Motion/Static/Reveal rails bake pixels only) has nothing to move, so the
 * gate tracks the frame's single-engine owner. Derived from frameScriptOwner
 * so a Cmd tap, the held-Cmd arm and every programmatic activation read the
 * same truth.
 */
export const brushMoveAvailable = computed(
  () => frameScriptOwner.value === 'watercolor',
);

/**
 * The non-owning module for a single-owner frame. In a single-engine world no
 * owner locks any slot, so this always resolves none.
 */
export function lockedModuleForOwner(_owner: FrameScriptOwner): ActiveModule | null {
  return null;
}

/** Tooltip for a locked slot — names the lock and the remedy. Unreachable in
 * the single-engine world (no owner locks a slot), kept for the switcher API. */
export function lockedModuleTooltip(_locked: ActiveModule): string {
  return 'This key has a script from another module. Water color is unavailable until you raster it — Raster in the timeline header removes the script so the key can paint.';
}
