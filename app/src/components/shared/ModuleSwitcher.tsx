/**
 * 56-02 (D-01, D-03): the shared top-bar module switcher — Brush | Water color | Krita.
 * One component, one active-module signal, mounted in both Toolbar and PhysicsPaintTopBar.
 *
 * 261027-gh9: under the WATERCOLOR_ONLY gate Brush AND Krita are both inert —
 * greyed, native-disabled, click does nothing. Water color is the only
 * selectable and active slot and is never locked by a frame owner. Every
 * Brush/Krita component and the `lockedModule` prop stay for reversibility.
 *
 * Krita keeps its own display-only tooltip ("Coming in v2.1.0"). Switching
 * drains panels only — document and timeline stay put (D-02). Visual family:
 * physics-paint-segmented-button (one CSS language).
 */
import type { ComponentChildren } from 'preact';
import {
  activeModule,
  setActiveModule,
  WATERCOLOR_ONLY,
  type ActiveModule,
} from './activeModule';
import { lockedModuleTooltip } from './frameModuleLock';

export interface ModuleSwitcherProps {
  /**
   * quick-261025-awl (D-03): the non-owning module for the selected key.
   * Only the Studio's top-bar mount passes it; the Toolbar mount stays bare.
   * A locked slot is a NATIVE disabled button, exactly like Krita.
   */
  lockedModule?: ActiveModule | null;
  /**
   * 261027-gh9f: under WATERCOLOR_ONLY the inert Brush slot is replaced by
   * this leading slot — the Studio passes the active brush thumbnail so the
   * top bar shows what the pen will paint. The Toolbar mount passes nothing
   * and keeps the disabled Brush label.
   */
  leadingSlot?: ComponentChildren;
}

const MODULE_SLOTS = [
  { id: 'brush' as const, label: 'Brush' },
  { id: 'watercolor' as const, label: 'Water color' },
  { id: 'krita' as const, label: 'Krita' },
] as const;

export function ModuleSwitcher({ lockedModule = null, leadingSlot }: ModuleSwitcherProps = {}) {
  // Under the seam the active slot is a constant, so a raw signal write can
  // never render a dead active disabled slot (261027-gh9).
  const current: ActiveModule = WATERCOLOR_ONLY ? 'watercolor' : activeModule.value;
  // The seam outranks every ownership lock — Water color is never disabled.
  const effectiveLocked = WATERCOLOR_ONLY ? null : lockedModule;
  const showLeading = WATERCOLOR_ONLY && leadingSlot !== undefined && leadingSlot !== null;
  const slots = showLeading ? MODULE_SLOTS.filter((slot) => slot.id !== 'brush') : MODULE_SLOTS;
  return (
    <div
      class="module-switcher physics-paint-segmented-row"
      role="group"
      aria-label="Module"
    >
      {showLeading ? <div class="module-switcher-leading">{leadingSlot}</div> : null}
      {slots.map((slot) => {
        const isInert = slot.id === 'krita' || (WATERCOLOR_ONLY && slot.id === 'brush');
        const isActive = !isInert && current === slot.id;
        const isLocked = !isInert && slot.id === effectiveLocked;
        const lockTitle = isLocked && effectiveLocked ? lockedModuleTooltip(effectiveLocked) : null;
        const title = isInert
          ? slot.id === 'brush'
            ? 'Unavailable — Water color only'
            : 'Coming in v2.1.0'
          : lockTitle ?? slot.label;
        return (
          <button
            key={slot.id}
            type="button"
            class={`physics-paint-segmented-button module-switcher-slot${isActive ? ' active' : ''}${isInert ? ' module-switcher-slot-inert' : ''}${isLocked ? ' module-switcher-slot-locked' : ''}`}
            title={title}
            aria-label={slot.label}
            aria-pressed={isInert ? undefined : isActive}
            disabled={isInert || isLocked}
            onClick={isInert || isLocked ? () => {} : () => setActiveModule(slot.id)}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}
