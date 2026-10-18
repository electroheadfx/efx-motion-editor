import { AquarelleGlobalsPanel } from './AquarelleGlobalsPanel';

/**
 * 56-02/56-07 (D-05) / 261017-w4x I-06 (Q4) / 261017-wmw I-01/I-02:
 * the Water color module-only block. Paint-tab content is the 7
 * watercolor globals + Reset only. The brush picker (BrushesDocker)
 * and the Brush response block live in the Brush tab.
 * Settings only — the tool row (D-13) and the Dry action (D-15) live in
 * the left vertical tool rail (PhysicsPaintToolRail.tsx WatercolorRail),
 * which owns the record seam (`emitAquarelleDry(aquarelleRecordClock())`).
 * Never shows mode selectors (D-14).
 */
export function WatercolorModuleSection() {
  return (
    <div class="physics-paint-module-section" data-module="watercolor">
      <AquarelleGlobalsPanel />
    </div>
  );
}
