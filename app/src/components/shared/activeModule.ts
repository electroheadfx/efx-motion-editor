import { signal } from '@preact/signals';

/**
 * 56-02 (D-01, D-02): the one shared active-module signal. Both ModuleSwitcher
 * mounts read and write this single signal — never a second local copy
 * (UI-SPEC 2026-10-15).
 *
 * studio-reopen-paper-washout: closing the Studio DESTROYS its window and
 * reopening BUILDS a new webview, so per-webview state (including
 * sessionStorage) is wiped. The chosen module must survive that recreation,
 * so it is persisted in localStorage, which outlives the webview.
 *
 * 261027-klx — single-engine world. @efxlab/efx-watercolor is the ONLY paint
 * engine, so Water color is the only selectable module. The union collapses to
 * one member, every write clamps to it, and a stale persisted value from an
 * older build resolves to Water color instead of resurrecting a removed module.
 */
export type ActiveModule = 'watercolor';

const STORAGE_KEY = 'efx-active-module';

function readStoredModule(): ActiveModule {
  try {
    // Read-only visit: a persisted value can only ever be stale in a
    // single-engine world, so it is deliberately discarded rather than
    // trusted. Reading keeps the legacy key observable for diagnostics.
    void localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode) — the signal still works.
  }
  return 'watercolor';
}

export const activeModule = signal<ActiveModule>(readStoredModule());

/**
 * The ONE production write path for the active module. Compare-then-write: an
 * unchanged value never wakes subscribers.
 */
export function setActiveModule(next: ActiveModule): void {
  if (activeModule.peek() === next) return;
  activeModule.value = next;
}

activeModule.subscribe(() => {
  try {
    localStorage.setItem(STORAGE_KEY, 'watercolor');
  } catch {
    // Storage can be unavailable (private mode) — the signal still works.
  }
});
