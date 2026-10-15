import { SectionLabel } from '../../shared/SectionLabel';
import { AquarelleParamsPanel } from './AquarelleParamsPanel';
import { AquarelleToolRow } from './AquarelleToolRow';
import { emitAquarelleDry } from './aquarelleRecordState';

/** UI-SPEC copy — exact string, pinned by AquarelleToolRow.test.tsx. */
const DRY_TOOLTIP = 'Flash-dry the sheet. Recorded in the script.';

/**
 * 56-02/56-07 (D-05): the Water color module-only block.
 * Order: tool row (D-13) → params (D-04) → BrushesDocker slot →
 * Dry action at the bottom (D-15). Never shows mode selectors (D-14).
 */
export function WatercolorModuleSection() {
  return (
    <div class="physics-paint-module-section" data-module="watercolor">
      <SectionLabel text="Water color" />
      <AquarelleToolRow />
      <AquarelleParamsPanel />
      <button
        type="button"
        data-testid="aquarelle-dry"
        title={DRY_TOOLTIP}
        onClick={() => {
          // D-15: fire-and-forget recorded Dry at the current host tick.
          // The tick source joins the Studio record clock in 56-08/09;
          // until then the seam records tick 0 (the script start).
          emitAquarelleDry(0);
        }}
        style={{
          height: '28px',
          width: '100%',
          marginTop: '8px',
          borderRadius: '3px',
          border: '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.55))',
          background: 'var(--sidebar-input-bg, rgba(127, 131, 138, 0.18))',
          color: 'var(--sidebar-text-primary, #eceff2)',
          fontSize: '10px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Dry
      </button>
    </div>
  );
}
