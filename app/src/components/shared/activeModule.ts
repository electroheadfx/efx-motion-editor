import { signal } from '@preact/signals';

/**
 * 56-02 (D-01, D-02): the one shared active-module signal. Both ModuleSwitcher
 * mounts (Toolbar + PhysicsPaintTopBar) read and write this single signal —
 * never a second local copy (UI-SPEC 2026-10-15).
 *
 * The Krita slot is display-only and must never write this signal (D-03).
 * Switching modules drains panels only — document and timeline stay put (D-02).
 *
 * studio-reopen-paper-washout: the Studio window is NAVIGATED on every open,
 * which resets JS state. The chosen module must survive that navigation or
 * reopen lands in Brush with engine-1 covering the document fond.
 */
export type ActiveModule = 'brush' | 'watercolor';

const STORAGE_KEY = 'efx-active-module';

function readStoredModule(): ActiveModule {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'watercolor' ? 'watercolor' : 'brush';
  } catch {
    return 'brush';
  }
}

export const activeModule = signal<ActiveModule>(readStoredModule());

activeModule.subscribe((value) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable (private mode) — the signal still works.
  }
});
