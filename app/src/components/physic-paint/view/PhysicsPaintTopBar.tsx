import { SliderStepper } from '../../shared/SliderStepper';
import { ModuleSwitcher } from '../../shared/ModuleSwitcher';
import { activeModule } from '../../shared/activeModule';
import { getPhysicsPaintEngineStatusTone } from './physicsPaintWorkflowPresentation';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { aquarelleParams } from './aquarelleRecordState';

/**
 * 261017-vcn I-04 remainder: the top bar keeps status pill + ModuleSwitcher +
 * Brush size + Opacity in one row. Background / Grain strength / Grain scale
 * rows and those props left for the Paper tab (PaperPicker) — one home for
 * paper + background.
 */
export interface PhysicsPaintTopBarProps {
  brushSize: number;
  opacity: number;
  ready: boolean;
  disabled?: boolean;
  onBrushSizeChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
}

function clampTopBarValue(value: unknown, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, Math.trunc(numeric)));
}

function TopBarSlider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const updateValue = (value: unknown) => props.onChange(clampTopBarValue(value, props.min, props.max));
  return (
    <div class="physics-paint-topbar-control physics-paint-topbar-slider">
      <SliderStepper
        id={props.id}
        label={props.label}
        value={props.value}
        onChange={(value) => updateValue(value)}
        step={1}
        min={props.min}
        max={props.max}
        disabled={props.disabled}
        ariaLabel={props.label}
      />
    </div>
  );
}

export function PhysicsPaintTopBar({
  brushSize,
  opacity,
  ready,
  disabled = false,
  onBrushSizeChange,
  onOpacityChange,
}: PhysicsPaintTopBarProps) {
  recordPhysicsPaintPerformanceCounter('render.topBar');
  const statusCopy = ready ? 'Engine ready' : 'Engine not ready';
  const statusTone = getPhysicsPaintEngineStatusTone({ ready });
  // UI checklist row 3: one shared Size slider — the displayed Brush size is
  // the live aquarelle size in Water color mode (signal read bypasses the memo).
  const liveBrushSize = activeModule.value === 'watercolor' ? aquarelleParams.value.size : brushSize;

  return (
    <header class="physics-paint-topbar" aria-label="Physics Paint controls">
      <div class="physics-paint-topbar-left">
        <div class="physics-paint-topbar-status" aria-live="polite">
          <span class={`physics-paint-status-pill ${statusTone}`}>{statusCopy}</span>
        </div>
        {/* 56-02 (D-01): module switcher — one shared component, one signal */}
        <ModuleSwitcher />
      </div>

      <div class="physics-paint-topbar-primary">
        <TopBarSlider id="physics-brush-size" label="Brush size" min={1} max={80} value={liveBrushSize} onChange={onBrushSizeChange} disabled={disabled} />
        <TopBarSlider id="physics-brush-opacity" label="Opacity" min={10} max={100} value={opacity} onChange={onOpacityChange} disabled={disabled} />
      </div>

      {/* Balanced right side so the primary cluster sits in the true middle. */}
      <div class="physics-paint-topbar-right" aria-hidden="true" />

    </header>
  );
}
