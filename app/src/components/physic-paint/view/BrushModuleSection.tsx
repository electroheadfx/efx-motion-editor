import type { ToolType } from '@efxlab/efx-physic-paint';
import { SliderStepper } from '../../shared/SliderStepper';
import { PaintModeSelector } from '../../sidebar/PaintModeSelector';

/**
 * 56-02 (D-05, D-14): the Brush module-only block — the physics param bag
 * extracted from the panel stack, plus PaintModeSelector (D-14: mode selector
 * stays in the Brush module only; the watercolour branch never shows it).
 */

function PanelSlider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const clamped = Math.max(props.min, Math.min(props.max, props.value));
  return (
    <div class="physics-paint-option-row">
      <SliderStepper
        id={props.id}
        label={props.label}
        value={clamped}
        onChange={props.onChange}
        step={1}
        min={props.min}
        max={props.max}
        disabled={props.disabled}
        ariaLabel={props.label}
      />
    </div>
  );
}

function SmoothingButton(props: { label: string; value: number; active: boolean; disabled?: boolean; onSelect: (value: number) => void }) {
  return (
    <button
      type="button"
      class={`physics-paint-segmented-button${props.active ? ' active' : ''}`}
      disabled={props.disabled}
      onClick={() => props.onSelect(props.value)}
    >
      {props.label}
    </button>
  );
}

export interface BrushModuleSectionProps {
  activeTool: ToolType;
  edgeDetail: number;
  pickup: number;
  spread: number;
  smoothing: number;
  eraseStrength: number;
  physicsMode: 'local' | null;
  engineControlsDisabled?: boolean;
  onEdgeDetailChange: (value: number) => void;
  onPickupChange: (value: number) => void;
  onSpreadChange: (value: number) => void;
  onSmoothingChange: (value: number) => void;
  onEraseStrengthChange: (value: number) => void;
}

export function BrushModuleSection({
  activeTool,
  edgeDetail,
  pickup,
  spread,
  smoothing,
  eraseStrength,
  physicsMode,
  engineControlsDisabled,
  onEdgeDetailChange,
  onPickupChange,
  onSpreadChange,
  onSmoothingChange,
  onEraseStrengthChange,
}: BrushModuleSectionProps) {
  return (
    <div class="physics-paint-module-section" data-module="brush">
      <PaintModeSelector />
      <PanelSlider id="physics-edge-detail" label="Shape detail" min={0} max={100} value={edgeDetail} onChange={onEdgeDetailChange} disabled={engineControlsDisabled} />
      {activeTool === 'paint' ? <PanelSlider id="physics-pickup" label="Blending" min={0} max={100} value={pickup} onChange={onPickupChange} disabled={engineControlsDisabled} /> : null}
      {physicsMode === 'local' ? <PanelSlider id="physics-spread" label="Spread" min={0} max={100} value={spread} onChange={onSpreadChange} disabled={engineControlsDisabled} /> : null}
      {activeTool === 'erase' ? <PanelSlider id="physics-erase-strength" label="Erase" min={0} max={100} value={eraseStrength} onChange={onEraseStrengthChange} disabled={engineControlsDisabled} /> : null}

      <div class="physics-paint-option-group">
        <span class="physics-paint-right-label">Brush smoothing</span>
        <div class="physics-paint-segmented-row" role="group" aria-label="Brush smoothing">
          <SmoothingButton label="Off" value={0} disabled={engineControlsDisabled} active={smoothing === 0} onSelect={onSmoothingChange} />
          <SmoothingButton label="Soft" value={1} disabled={engineControlsDisabled} active={smoothing === 1} onSelect={onSmoothingChange} />
          <SmoothingButton label="Med" value={2} disabled={engineControlsDisabled} active={smoothing === 2} onSelect={onSmoothingChange} />
          <SmoothingButton label="High" value={3} disabled={engineControlsDisabled} active={smoothing === 3} onSelect={onSmoothingChange} />
        </div>
      </div>
    </div>
  );
}
