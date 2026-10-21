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
 *
 * 261018-k1o: ModuleSwitcher moved to the top bar LEFT cluster, immediately
 * after the Engine ready status pill (left = status pill + ModuleSwitcher;
 * center = sliders only; right = balanced spacer). Seating + CSS only — the
 * write-through handlers and the live aquarelle size read are unchanged.
 *
 * I-11 follow-up: the slider cluster now centers in the space AFTER the left
 * cluster (not the whole window), which stops the cluster colliding with the
 * ModuleSwitcher. Pigment joins Water / Edges / Grain, and the last optional
 * watercolor knobs hide as the settings area narrows (container queries in
 * physicsPaintStudio.css).
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
  class?: string;
}) {
  const updateValue = (value: unknown) => props.onChange(clampTopBarValue(value, props.min, props.max));
  const cls = `physics-paint-topbar-control physics-paint-topbar-slider${props.class ? ` ${props.class}` : ''}`;
  return (
    <div class={cls}>
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
  // Opacity routes to aquarelle load in Water color; display the live value
  // too, or the slider snaps back to engine-1's opacity (the setting looked
  // dead: the paint changed, the thumb did not).
  const liveOpacity = activeModule.value === 'watercolor' ? aquarelleParams.value.load : opacity;

  return (
    <header class="physics-paint-topbar" aria-label="Physics Paint controls">
      {/* Left slot: status pill + ModuleSwitcher (261018-k1o). */}
      <div class="physics-paint-topbar-left">
        <div class="physics-paint-topbar-status" aria-live="polite">
          <span class={`physics-paint-status-pill ${statusTone}`}>{statusCopy}</span>
        </div>
        {/* 56-02 (D-01): module switcher — one shared component, one signal */}
        <ModuleSwitcher />
      </div>

      {/* Center: sliders only — Brush size + Opacity (+ Water/Edges/Grain/Pigment).
          I-11 follow-up: this cluster centers inside the remaining width after
          the left cluster; the last optional knobs hide via container queries. */}
      <div class="physics-paint-topbar-primary">
        <TopBarSlider id="physics-brush-size" label="Brush size" min={1} max={80} value={liveBrushSize} onChange={onBrushSizeChange} disabled={disabled} />
        <TopBarSlider id="physics-brush-opacity" label="Opacity" min={10} max={100} value={liveOpacity} onChange={onOpacityChange} disabled={disabled} />
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
              class="physics-paint-topbar-optional-water"
            />
            <TopBarSlider
              id="physics-aquarelle-edges"
              label="Edges"
              min={0}
              max={100}
              value={aquarelleParams.value.edge}
              onChange={(value) => setAquarelleParam('edge', value)}
              disabled={disabled}
              class="physics-paint-topbar-optional-edges"
            />
            <TopBarSlider
              id="physics-aquarelle-grain"
              label="Grain"
              min={0}
              max={100}
              value={aquarelleParams.value.granulation}
              onChange={(value) => setAquarelleParam('granulation', value)}
              disabled={disabled}
              class="physics-paint-topbar-optional-grain"
            />
            <TopBarSlider
              id="physics-aquarelle-pigment"
              label="Pigment"
              min={0}
              max={100}
              value={aquarelleParams.value.load}
              onChange={(value) => setAquarelleParam('load', value)}
              disabled={disabled}
              class="physics-paint-topbar-optional-pigment"
            />
          </>
        ) : null}
      </div>

    </header>
  );
}
