import { SectionLabel } from '../../shared/SectionLabel';
import { AquarelleParamsPanel } from './AquarelleParamsPanel';
import { BrushesDocker } from './BrushesDocker';

/**
 * 56-02/56-07 (D-05) / 261017-w4x I-06 (Q4): the Water color module-only block.
 * Order: params (D-04) → BrushesDocker (D-07). Settings only — the tool row
 * (D-13) and the Dry action (D-15) live in the left vertical tool rail
 * (PhysicsPaintToolRail.tsx WatercolorRail), which owns the record seam
 * (`emitAquarelleDry(aquarelleRecordClock())`). Never shows mode selectors (D-14).
 */
export function WatercolorModuleSection() {
  return (
    <div class="physics-paint-module-section" data-module="watercolor">
      <SectionLabel text="Water color" />
      <AquarelleParamsPanel />
      <BrushesDocker />
    </div>
  );
}
