/**
 * 56-02 (D-01, D-03): the shared top-bar module switcher — Brush | Water color | Krita.
 * One component, one active-module signal, mounted in both Toolbar and PhysicsPaintTopBar.
 *
 * Krita is display-only and inert (D-03): greyed, tooltip "Coming in v2.1.0",
 * click does nothing. Switching drains panels only — document and timeline stay
 * put (D-02). Visual family: physics-paint-segmented-button (one CSS language).
 */
import { activeModule, type ActiveModule } from './activeModule';
import { lockedModuleTooltip } from './frameModuleLock';

export interface ModuleSwitcherProps {
  /**
   * quick-261025-awl (D-03): the non-owning module for the selected key.
   * Only the Studio's top-bar mount passes it; the Toolbar mount stays bare.
   */
  lockedModule?: ActiveModule | null;
}

const MODULE_SLOTS = [
  { id: 'brush' as const, label: 'Brush' },
  { id: 'watercolor' as const, label: 'Water color' },
  { id: 'krita' as const, label: 'Krita' },
] as const;

function selectModule(id: 'brush' | 'watercolor'): void {
  activeModule.value = id;
}

export function ModuleSwitcher({ lockedModule = null }: ModuleSwitcherProps = {}) {
  const current: ActiveModule = activeModule.value;
  return (
    <div
      class="module-switcher physics-paint-segmented-row"
      role="group"
      aria-label="Module"
    >
      {MODULE_SLOTS.map((slot) => {
        const isInert = slot.id === 'krita';
        const isActive = !isInert && current === slot.id;
        const isLocked = !isInert && slot.id === lockedModule;
        const lockTitle = isLocked && lockedModule ? lockedModuleTooltip(lockedModule) : null;
        return (
          <button
            key={slot.id}
            type="button"
            class={`physics-paint-segmented-button module-switcher-slot${isActive ? ' active' : ''}${isInert ? ' module-switcher-slot-inert' : ''}${isLocked ? ' module-switcher-slot-locked' : ''}`}
            title={isInert ? 'Coming in v2.1.0' : lockTitle ?? slot.label}
            aria-label={slot.label}
            aria-pressed={isInert ? undefined : isActive}
            aria-disabled={isLocked ? 'true' : undefined}
            disabled={isInert}
            onClick={isInert || isLocked ? () => {} : () => selectModule(slot.id)}
            onKeyDown={
              isLocked
                ? (event: KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
                  }
                : undefined
            }
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}
