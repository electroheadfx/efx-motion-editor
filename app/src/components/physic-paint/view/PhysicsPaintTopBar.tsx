import type { TargetedMouseEvent } from 'preact';
import { BRUSH_PRESETS } from '@efxlab/efx-watercolor';
import { ChevronDown, Eraser } from 'lucide-preact';
import { SliderStepper } from '../../shared/SliderStepper';
import { getPhysicsPaintEngineStatusTone } from './physicsPaintWorkflowPresentation';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import {
  aquarelleActiveTool,
  aquarelleBrushMenuOpen,
  aquarelleParams,
  aquarelleScriptRecordingEnabled,
  aquarelleSelectedTipId,
  setAquarelleBrushMenuOpen,
  setAquarelleParam,
  setAquarelleScriptRecordingEnabled,
} from './aquarelleRecordState';
import { WatercolorBrushThumb } from './WatercolorBrushLibrary';
import { LiftShapePicker } from './LiftShapePicker';

/**
 * 261017-vcn I-04 remainder: the top bar keeps status pill + brush trigger +
 * Brush size + Opacity in one row. Background / Grain strength / Grain scale
 * rows and those props left for the Paper tab (PaperPicker) — one home for
 * paper + background.
 *
 * 261018-f15 C1: Water / Edges / Grain follow the primary control in Water
 * color mode and write setAquarelleParam('water' | 'edge' | 'granulation') —
 * the same seam the Paint-tab globals use. Brush mode keeps Brush size +
 * Opacity only; Water color labels that slot Pigment because its value is the
 * canonical `load`, never an alpha.
 *
 * 261018-gqo move 5: Engine ready is pinned left alone; the brush trigger +
 * Brush size + Opacity (+ Water/Edges/Grain) form ONE centered group. DOM
 * grouping and CSS only — the write-through handlers are unchanged.
 *
 * 261027-gh9g: the module switcher left the Studio top bar entirely. The
 * active brush's larger painted thumbnail + name seat in the LEFT cluster
 * after the Engine ready pill and open the brush dropdown; center = sliders
 * only. Water / Edges / Grain are the optional watercolor knobs and hide as
 * the settings area narrows (container queries in physicsPaintStudio.css).
 *
 * 261027-k6j — the Script switch sits beside the brush trigger and gates
 * stroke recording only.
 */
export interface PhysicsPaintTopBarProps {
  /**
   * 261027-klx: kept on the props contract (the Studio's top-bar memo writes
   * them and the paper single-home pin names them) but never read — Water
   * color is the only module, so the live size/load always come from the
   * aquarelle signal below.
   */
  brushSize: number;
  opacity: number;
  ready: boolean;
  disabled?: boolean;
  onBrushSizeChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
  /**
   * 261028-k03b: select every recorded Lift stroke of the current edit frame
   * and enter move mode (the Lift tool's Select button).
   */
  onSelectLiftStrokes?: () => void;
}

/**
 * 261027-gh9g: the top bar's ONE brush surface. The retired module switcher
 * (Water color / Krita) is gone; the active brush's painted thumbnail and name
 * now sit here and open the brush dropdown. The thumb is deliberately larger
 * than the old switcher segment so the live brush reads at a glance.
 */
function TopBarBrushTrigger(props: {
  presetId: string | null;
  open: boolean;
  onToggle: (event: TargetedMouseEvent<HTMLButtonElement>) => void;
}) {
  const preset = props.presetId
    ? BRUSH_PRESETS.find((candidate) => candidate.id === props.presetId)
    : undefined;
  return (
    <button
      type="button"
      class={`physics-paint-brush-trigger${props.open ? ' open' : ''}`}
      data-watercolor-brush-trigger
      aria-haspopup="menu"
      aria-expanded={props.open}
      title="Choose a brush"
      aria-label={preset ? `Brush — ${preset.name}` : 'Choose a brush'}
      onClick={props.onToggle}
    >
      {preset ? (
        <WatercolorBrushThumb
          presetId={preset.id}
          class="physics-paint-brush-trigger-thumb"
        />
      ) : <span class="physics-paint-brush-trigger-thumb is-empty" aria-hidden="true" />}
      <span class="physics-paint-brush-trigger-name">{preset?.name ?? 'Brushes'}</span>
      <ChevronDown size={13} class="physics-paint-brush-trigger-chevron" aria-hidden="true" />
    </button>
  );
}

/**
 * 261027-k6j: the session "Script" switch. On (default) records finished
 * watercolor strokes into the current key's script; Off paints pixels without
 * writing any script entry. A native button: Enter/Space work for free.
 * Never disabled — recording mode is orthogonal to mutation/apply locks.
 */
export function ScriptRecordingSwitch() {
  // Narrow read (same idiom as aquarelleParams.value): only this switch
  // re-renders when the session flag flips.
  const enabled = aquarelleScriptRecordingEnabled.value;
  return (
    <button
      type="button"
      class={`physics-paint-script-switch${enabled ? ' is-on' : ''}`}
      role="switch"
      aria-checked={enabled ? 'true' : 'false'}
      title={enabled
        ? 'Script on — strokes are recorded into the key script'
        : 'Script off — strokes paint pixels without a script entry'}
      onClick={() => setAquarelleScriptRecordingEnabled(!aquarelleScriptRecordingEnabled.peek())}
    >
      <span class="physics-paint-script-switch-track" aria-hidden="true">
        <span class="physics-paint-script-switch-knob" />
      </span>
      <span class="physics-paint-script-switch-label">Script</span>
    </button>
  );
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
  ready,
  disabled = false,
  onBrushSizeChange,
  onOpacityChange,
  onSelectLiftStrokes,
}: PhysicsPaintTopBarProps) {
  recordPhysicsPaintPerformanceCounter('render.topBar');
  const statusCopy = ready ? 'Engine ready' : 'Engine not ready';
  const statusTone = getPhysicsPaintEngineStatusTone({ ready });
  // Narrow signal reads: picking a brush or opening the dropdown re-renders
  // only this bar.
  const selectedTipId = aquarelleSelectedTipId.value;
  const brushMenuOpen = aquarelleBrushMenuOpen.value;
  const toggleBrushMenu = (event: TargetedMouseEvent<HTMLButtonElement>) => {
    if (brushMenuOpen) {
      setAquarelleBrushMenuOpen(false);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setAquarelleBrushMenuOpen(true, { left: rect.left, top: rect.bottom + 6 });
  };
  // UI checklist row 3: one shared Size slider — the displayed Brush size is
  // the live aquarelle size (signal read bypasses the memo).
  const liveBrushSize = aquarelleParams.value.size;
  // Water color has no opacity — its canonical Pigment `load` rides this same
  // primary control, so the bar never shows Opacity and Pigment twice.
  const liveOpacity = aquarelleParams.value.load;
  // 261028-k03b: the Lift tool owns the primary cluster — a Lift-strength
  // slider (eraser icon) + Select. The brush knobs (size/pigment/water/edges/
  // grain) do not describe an eraser stroke.
  const activeTool = aquarelleActiveTool.value;
  const liftStrength = aquarelleParams.value.lift;

  return (
    <header class="physics-paint-topbar" aria-label="Physics Paint controls">
      {/* Left slot: status pill + brush trigger (261018-k1o / 261027-gh9g). */}
      <div class="physics-paint-topbar-left">
        <div class="physics-paint-topbar-status" aria-live="polite">
          <span class={`physics-paint-status-pill ${statusTone}`}>{statusCopy}</span>
        </div>
        {/* 261027-gh9g: the module switcher is gone from the Studio top bar —
            a single Water color mode. The active brush's larger painted thumb
            and name open the brush dropdown. */}
        <TopBarBrushTrigger
          presetId={selectedTipId}
          open={brushMenuOpen}
          onToggle={toggleBrushMenu}
        />
        <ScriptRecordingSwitch />
      </div>

      {/* Center: sliders only — Brush size + Opacity (+ Water/Edges/Grain/Pigment).
          I-11 follow-up: this cluster centers inside the remaining width after
          the left cluster; the last optional knobs hide via container queries.
          261028-k03b: the Lift tool swaps the whole cluster for its own two
          controls — Strength (eraser icon) + Select lifts. */}
      <div class="physics-paint-topbar-primary">
        {activeTool === 'lift' ? (
          <div class="physics-paint-topbar-lift" data-testid="physics-lift-controls">
            {/* 261028-k03c D3: one Lift shape control (thumb + native select)
                over the SAME aquarelleLiftTipId the Brush tab's Lift section
                writes. Shape first, Strength second, Select lifts last. */}
            <div class="physics-paint-topbar-control physics-paint-topbar-lift-shape">
              <LiftShapePicker testId="physics-lift-shape" disabled={disabled} />
            </div>
            <div
              class="physics-paint-topbar-control physics-paint-topbar-slider physics-paint-topbar-lift-strength"
              data-testid="physics-lift-strength"
            >
              <Eraser size={15} aria-hidden="true" />
              <SliderStepper
                id="physics-lift-strength"
                label="Lift strength"
                value={liftStrength}
                onChange={(value) => setAquarelleParam('lift', Math.max(5, Math.min(90, Math.round(value))))}
                step={1}
                min={5}
                max={90}
                disabled={disabled}
                ariaLabel="Lift strength"
              />
            </div>
            <button
              type="button"
              class="physics-paint-segmented-button physics-paint-topbar-lift-select"
              data-testid="physics-lift-select"
              onClick={onSelectLiftStrokes}
              disabled={disabled || onSelectLiftStrokes === undefined}
              title="Select every Lift stroke on this frame"
            >
              Select lifts
            </button>
          </div>
        ) : (
          <>
            <TopBarSlider id="physics-brush-size" label="Brush size" min={1} max={80} value={liveBrushSize} onChange={onBrushSizeChange} disabled={disabled} />
            <TopBarSlider
              id="physics-aquarelle-pigment"
              label="Pigment"
              min={0}
              max={100}
              value={liveOpacity}
              onChange={onOpacityChange}
              disabled={disabled}
            />
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
          </>
        )}
      </div>

    </header>
  );
}
