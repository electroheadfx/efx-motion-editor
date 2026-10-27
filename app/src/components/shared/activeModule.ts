import { signal } from '@preact/signals';

/**
 * 56-02 (D-01, D-02): the one shared active-module signal. Both ModuleSwitcher
 * mounts (Toolbar + PhysicsPaintTopBar) read and write this single signal —
 * never a second local copy (UI-SPEC 2026-10-15).
 *
 * The Krita slot is display-only and must never write this signal (D-03).
 * Switching modules drains panels only — document and timeline stay put (D-02).
 *
 * studio-reopen-paper-washout: closing the Studio DESTROYS its window and
 * reopening BUILDS a new webview, so per-webview state (including
 * sessionStorage) is wiped. The chosen module must survive that recreation or
 * every reopen lands in Brush with engine-1 covering the document fond —
 * persist it in localStorage, which outlives the webview.
 *
 * 261027-gh9 — the reversible watercolor-only UI gate: Water color is the only
 * module the UI can select. One constant; set it to false to restore module
 * switching. No Brush/Krita code is removed by this gate.
 */
export type ActiveModule = 'brush' | 'watercolor';

export const WATERCOLOR_ONLY = true;

const STORAGE_KEY = 'efx-active-module';

function readStoredModule(): ActiveModule {
  // Under the seam the stored value is never read or trusted: a stale or
  // hand-edited 'brush' can never start the app in Brush.
  if (WATERCOLOR_ONLY) return 'watercolor';
  try {
    return localStorage.getItem(STORAGE_KEY) === 'watercolor' ? 'watercolor' : 'brush';
  } catch {
    return 'brush';
  }
}

export const activeModule = signal<ActiveModule>(readStoredModule());

/**
 * The ONE production write path for the active module. Compare-then-write: an
 * unchanged (or clamped) value never wakes subscribers.
 */
export function setActiveModule(next: ActiveModule): void {
  const clamped: ActiveModule = WATERCOLOR_ONLY ? 'watercolor' : next;
  if (activeModule.peek() === clamped) return;
  activeModule.value = clamped;
}

activeModule.subscribe((value) => {
  try {
    localStorage.setItem(STORAGE_KEY, WATERCOLOR_ONLY ? 'watercolor' : value);
  } catch {
    // Storage can be unavailable (private mode) — the signal still works.
  }
});
