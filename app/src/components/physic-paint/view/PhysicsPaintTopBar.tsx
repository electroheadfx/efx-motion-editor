import { SliderStepper } from '../../shared/SliderStepper';
import { ModuleSwitcher } from '../../shared/ModuleSwitcher';
import { activeModule } from '../../shared/activeModule';
import { getPhysicsPaintEngineStatusTone } from './physicsPaintWorkflowPresentation';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { aquarelleParams, setAquarelleParam } from './aquarelleRecordState';

/**
 * 261017-vcn I-04 remainder: the top bar keeps status pill + ModuleSwitcher +
 * Brush size + Opacity in one row. Background / Grain strength / Grain scale
 * rows and those props left for the Paper tab (PaperPicker) — one home for
 * paper + background.
 *
 * 261018-f15 C1: Water / Edges / Grain follow Opacity in Water color mode and
 * write setAquarelleParam('water' | 'edge' | 'granulation') — the same seam
 * the Paint-tab globals use. Brush mode keeps Brush size + Opacity only.
 *
 * 261018-gqo move 5: Engine ready is pinned left alone; Modes + Brush size +
 * Opacity (+ Water/Edges/Grain) form ONE centered group. DOM grouping and CSS
 * only — the write-through handlers are unchanged.
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
      {/* Left slot: the status pill alone (261018-gqo move 5). */}
      <div class="physics-paint-topbar-left">
        <div class="physics-paint-topbar-status" aria-live="polite">
          <span class={`physics-paint-status-pill ${statusTone}`}>{statusCopy}</span>
        </div>
      </div>

      {/* Center: ONE group = Modes + Brush size + Opacity (+ Water/Edges/Grain). */}
      <div class="physics-paint-topbar-primary">
        {/* 56-02 (D-01): module switcher — one shared component, one signal */}
        <ModuleSwitcher />
        <TopBarSlider id="physics-brush-size" label="Brush size" min={1} max={80} value={liveBrushSize} onChange={onBrushSizeChange} disabled={disabled} />
        <TopBarSlider id="physics-brush-opacity" label="Opacity" min={10} max={100} value={opacity} onChange={onOpacityChange} disabled={disabled} />
        {activeModule.value === 'watercolor' ? (
          <>
            <TopBarSlider
              id="physics-aquarelle-water"
              label="Water"
              min={0}
              max={100}
              value={aquarelleParams.value.water}
              onChange={(value) => setAquarelleParam('water', value)}
              disabled={disabled}
            />
            <TopBarSlider
              id="physics-aquarelle-edges"
              label="Edges"
              min={0}
              max={100}
              value={aquarelleParams.value.edge}
              onChange={(value) => setAquarelleParam('edge', value)}
              disabled={disabled}
            />
            <TopBarSlider
              id="physics-aquarelle-grain"
              label="Grain"
              min={0}
              max={100}
              value={aquarelleParams.value.granulation}
              onChange={(value) => setAquarelleParam('granulation', value)}
              disabled={disabled}
            />
          </>
        ) : null}
      </div>

      {/* Balanced right side so the primary cluster sits in the true middle. */}
      <div class="physics-paint-topbar-right" aria-hidden="true" />

    </header>
  );
}
