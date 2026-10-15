import { signal } from '@preact/signals';

/**
 * 56-02 (D-01, D-02): the one shared active-module signal. Both ModuleSwitcher
 * mounts (Toolbar + PhysicsPaintTopBar) read and write this single signal —
 * never a second local copy (UI-SPEC 2026-10-15).
 *
 * The Krita slot is display-only and must never write this signal (D-03).
 * Switching modules drains panels only — document and timeline stay put (D-02).
 */
export type ActiveModule = 'brush' | 'watercolor';

export const activeModule = signal<ActiveModule>('brush');
