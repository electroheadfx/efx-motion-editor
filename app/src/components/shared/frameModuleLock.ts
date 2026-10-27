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
import { WATERCOLOR_ONLY, type ActiveModule } from './activeModule';

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
 * Move translates a Brush stroke script. A Water color key and a scriptless
 * key (Motion/Static/Reveal rails bake pixels only) have nothing to move.
 * 261027 (studio-strokes-lost-redraw): 'both' now OPENS the gate too. A
 * raster key's arrival-base capture is partial (not hydratable) while a
 * leftover aquarelle registry script survives, so the frame resolves 'both';
 * closing Move there made the freshly painted Brush stroke uneditable. The
 * composite `moveAvailable` still gates the dead case — a 'both' frame with
 * no hydratable stored row AND no engine-held strokes exposes no Move.
 * Derived from frameScriptOwner so the rail, the Cmd tap, the held-Cmd arm
 * and every programmatic activation read the same truth.
 */
export const brushMoveAvailable = computed(
  () => frameScriptOwner.value === 'brush' || frameScriptOwner.value === 'both',
);

/**
 * The non-owning module for a single-owner frame; both/none lock nothing.
 *
 * 261027-gh9 — under the watercolor-only gate no owner locks any slot (a
 * Brush-owned key must never lock Water color). The ungated branch stays for
 * reversibility and is exercised by tests through the explicit second
 * argument.
 */
export function lockedModuleForOwner(
  owner: FrameScriptOwner,
  watercolorOnly: boolean = WATERCOLOR_ONLY,
): ActiveModule | null {
  if (watercolorOnly) return null;
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
