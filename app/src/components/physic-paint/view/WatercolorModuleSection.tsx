import { SectionLabel } from '../../shared/SectionLabel';
import { AquarelleParamsPanel } from './AquarelleParamsPanel';

/**
 * 56-02/56-07 (D-05): the Water color module-only block.
 * SectionLabel + tool row slot (56-07 Task 2) + AquarelleParamsPanel
 * + BrushesDocker slot (56-07 Task 3) + Dry action (Task 2).
 * The module block never shows mode selectors (D-14).
 */
export function WatercolorModuleSection() {
  return (
    <div class="physics-paint-module-section" data-module="watercolor">
      <SectionLabel text="Water color" />
      <AquarelleParamsPanel />
    </div>
  );
}
