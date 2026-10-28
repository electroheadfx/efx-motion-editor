// ============================================================
//  RightPanelBrushTab — the restored Brush tab (UI checklist
//  row 6). Water color only.
//
//  261028-k03d: the tab is the brush CATALOG plus the brush
//  response the top bar exposes (Size + the seven globals). The
//  Settings-tab clone (the eight response multipliers) and the
//  Lift section are gone — the Settings tab keeps the response
//  block and the top bar keeps the Lift controls, so no control
//  has two homes.
//
//  261018-0ox I-10: adopted into PhysicsPaintRightPanel.
//  The activeModule branch stays inside this tab component.
// ============================================================

import { activeModule } from '../../shared/activeModule';
import { SliderStepper } from '../../shared/SliderStepper';
import {
  aquarelleParams,
  setAquarelleParam,
} from './aquarelleRecordState';
import { AquarelleGlobalsPanel } from './AquarelleGlobalsPanel';
import { WatercolorBrushLibrary } from './WatercolorBrushLibrary';

export function RightPanelBrushTab() {
  if (activeModule.value === 'watercolor') {
    // Narrow signal read (efx-preact-reactivity rule 5).
    const size = aquarelleParams.value.size;
    return (
      <div data-testid="right-panel-brush-tab" data-module="watercolor">
        <WatercolorBrushLibrary />

        <div class="physics-paint-option-group">
          <div class="physics-paint-option-row">
            <SliderStepper
              id="brush-tab-brush-size"
              label="Brush size"
              value={size}
              onChange={(value) => setAquarelleParam('size', Math.max(1, Math.min(80, Math.round(value))))}
              step={1}
              min={1}
              max={80}
              ariaLabel="Brush size"
            />
          </div>
        </div>

        <AquarelleGlobalsPanel />
      </div>
    );
  }
  return null;
}
