// ============================================================
//  RightPanelBrushTab — the restored Brush tab (UI checklist
//  row 6). Water color only.
//
//  261028-k03c D2: the sidebar Brush tab is BACK (261027-gh9g
//  had retired it). It is the second view over the SAME state as
//  the top bar and the floating brush modal — brush catalog +
//  Size + the seven globals + the eight response multipliers +
//  a Lift section (shape, strength, Select lifts). No local
//  state, no copied values: every control writes the existing
//  aquarelle signals through the existing setters.
//
//  The Settings tab keeps BrushResponsePanel unchanged — two
//  views, one state.
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
import { BrushResponsePanel } from './BrushResponsePanel';
import { LiftShapePicker } from './LiftShapePicker';
import { WatercolorBrushLibrary } from './WatercolorBrushLibrary';

export function RightPanelBrushTab(props: { onSelectLiftStrokes?: () => void }) {
  if (activeModule.value === 'watercolor') {
    // Narrow signal reads (efx-preact-reactivity rule 5).
    const size = aquarelleParams.value.size;
    const liftStrength = aquarelleParams.value.lift;
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
        <BrushResponsePanel />

        {/* 261028-k03c D2/D3: the Lift section — shape (the SAME picker the
            top-bar Lift cluster mounts), strength and Select lifts. */}
        <div class="physics-paint-option-group" data-testid="right-panel-lift-section">
          <span class="physics-paint-right-label">Lift</span>
          <LiftShapePicker testId="right-panel-lift-shape" />
          <div class="physics-paint-option-row">
            <SliderStepper
              id="right-panel-lift-strength"
              label="Lift strength"
              value={liftStrength}
              onChange={(value) => setAquarelleParam('lift', Math.max(5, Math.min(90, Math.round(value))))}
              step={1}
              min={5}
              max={90}
              ariaLabel="Lift strength"
            />
          </div>
          <button
            type="button"
            data-testid="right-panel-lift-select"
            class="physics-paint-segmented-button"
            onClick={props.onSelectLiftStrokes}
            disabled={props.onSelectLiftStrokes === undefined}
            title="Select every Lift stroke on this frame"
          >
            Select lifts
          </button>
        </div>
      </div>
    );
  }
  return null;
}
