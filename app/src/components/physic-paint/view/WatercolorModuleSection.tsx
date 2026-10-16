import { SectionLabel } from '../../shared/SectionLabel';
import { AquarelleParamsPanel } from './AquarelleParamsPanel';
import { AquarelleToolRow } from './AquarelleToolRow';
import { BrushesDocker } from './BrushesDocker';
import { aquarelleRecordClock, emitAquarelleDry } from './aquarelleRecordState';

/** UI-SPEC copy — exact string, pinned by AquarelleToolRow.test.tsx. */
const DRY_TOOLTIP = 'Flash-dry the sheet. Recorded in the script.';

/**
 * 56-02/56-07 (D-05): the Water color module-only block.
 * Order: tool row (D-13) → params (D-04) → BrushesDocker (D-07) →
 * Dry action at the bottom (D-15). Never shows mode selectors (D-14).
 */
export function WatercolorModuleSection() {
  return (
    <div class="physics-paint-module-section" data-module="watercolor">
      <SectionLabel text="Water color" />
      <AquarelleToolRow />
      <AquarelleParamsPanel />
      <BrushesDocker />
      <button
        type="button"
        data-testid="aquarelle-dry"
        class="physics-paint-aquarelle-dry"
        title={DRY_TOOLTIP}
        onClick={() => {
          // D-15: one event, two ends. This fires the recorded Dry onto the
          // payload timeline at the Studio record clock's CURRENT host tick —
          // the live engine and the replay bake both re-apply it there.
          emitAquarelleDry(aquarelleRecordClock());
        }}
      >
        Dry
      </button>
    </div>
  );
}
