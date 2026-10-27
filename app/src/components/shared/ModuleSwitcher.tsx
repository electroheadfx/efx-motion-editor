/**
 * 56-02 (D-01, D-03): the shared top-bar module switcher.
 * One component, one active-module signal, mounted in both Toolbar and PhysicsPaintTopBar.
 *
 * 261027-klx: @efxlab/efx-watercolor is the only paint engine, so the Brush
 * slot is gone. Water color is the only selectable and active slot; Krita
 * stays a display-only, native-disabled placeholder that never writes the
 * signal. Switching modules drains panels only — document and timeline stay
 * put (D-02). Visual family: physics-paint-segmented-button (one CSS language).
 */
import {
  activeModule,
  setActiveModule,
  type ActiveModule,
} from './activeModule';

export interface ModuleSwitcherProps {
  /**
   * quick-261025-awl (D-03) kept the non-owning module for the selected key;
   * the single-engine world has no owner that can lock a slot, so the prop is
   * accepted for call-site compatibility and deliberately ignored. The Toolbar
   * mount stays bare; the Studio top bar does not mount this component
   * (261027-gh9g replaced it with the brush picker).
   */
  lockedModule?: ActiveModule | null;
}

const KRITA_TOOLTIP = 'Coming in v2.1.0';

const MODULE_SLOTS = [
  { id: 'watercolor', label: 'Water color' },
  { id: 'krita', label: 'Krita', inert: true },
] as const;

export function ModuleSwitcher({ lockedModule = null }: ModuleSwitcherProps = {}) {
  // 261027-klx: Water color is the only engine, so nothing can be locked away
  // from it — a passed lock is intentionally inert (Krita stays inert too).
  void lockedModule;
  const current: ActiveModule = activeModule.value;
  return (
    <div
      class="module-switcher physics-paint-segmented-row"
      role="group"
      aria-label="Module"
    >
      {MODULE_SLOTS.map((slot) => {
        const isInert = 'inert' in slot;
        const isActive = !isInert && current === slot.id;
        const title = isInert ? KRITA_TOOLTIP : slot.label;
        return (
          <button
            key={slot.id}
            type="button"
            class={`physics-paint-segmented-button module-switcher-slot${isActive ? ' active' : ''}${isInert ? ' module-switcher-slot-inert' : ''}`}
            title={title}
            aria-label={slot.label}
            aria-pressed={isInert ? undefined : isActive}
            disabled={isInert}
            onClick={isInert ? () => {} : () => setActiveModule(slot.id)}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}
