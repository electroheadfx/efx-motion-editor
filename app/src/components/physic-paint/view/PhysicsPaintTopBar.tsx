import { BRUSH_PRESETS } from '@efxlab/efx-watercolor';
import { SliderStepper } from '../../shared/SliderStepper';
import { ModuleSwitcher } from '../../shared/ModuleSwitcher';
import { activeModule } from '../../shared/activeModule';
import { frameScriptOwner, lockedModuleForOwner } from '../../shared/frameModuleLock';
import { getPhysicsPaintEngineStatusTone } from './physicsPaintWorkflowPresentation';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { aquarelleParams, aquarelleSelectedTipId, setAquarelleParam } from './aquarelleRecordState';
import { WatercolorBrushThumb } from './WatercolorBrushLibrary';

/**
 * 261017-vcn I-04 remainder: the top bar keeps status pill + ModuleSwitcher +
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
 * ModuleSwitcher. Water / Edges / Grain are the optional watercolor knobs and
 * hide as the settings area narrows (container queries in
 * physicsPaintStudio.css).
 */
export interface PhysicsPaintTopBarProps {
  brushSize: number;
  opacity: number;
  ready: boolean;
  disabled?: boolean;
  onBrushSizeChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
  /** 261027-gh9f: opens the Brush tab from the top-bar brush thumbnail. */
  onBrushPreviewClick?: () => void;
}

/**
 * 261027-gh9f: the inert Brush module slot becomes the active brush's painted
 * thumbnail — the top bar shows what the pen will paint. Clicking returns to
 * the Brush tab so the pick can be changed.
 */
function TopBarBrushPreview(props: { presetId: string | null; onClick?: () => void }) {
  const preset = props.presetId
    ? BRUSH_PRESETS.find((candidate) => candidate.id === props.presetId)
    : undefined;
  if (!preset) return null;
  const label = `Brush — ${preset.name}`;
  return (
    <button
      type="button"
      class="physics-paint-segmented-button module-switcher-slot module-switcher-brush-preview"
      title={label}
      aria-label={label}
      onClick={props.onClick}
    >
      <WatercolorBrushThumb
        presetId={preset.id}
        class="module-switcher-brush-preview-thumb"
      />
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
  brushSize,
  opacity,
  ready,
  disabled = false,
  onBrushSizeChange,
  onOpacityChange,
  onBrushPreviewClick,
}: PhysicsPaintTopBarProps) {
  recordPhysicsPaintPerformanceCounter('render.topBar');
  const statusCopy = ready ? 'Engine ready' : 'Engine not ready';
  const statusTone = getPhysicsPaintEngineStatusTone({ ready });
  const isWatercolor = activeModule.value === 'watercolor';
  // Narrow signal read: picking a brush re-renders only this bar. A legacy
  // tip id (not in BRUSH_PRESETS) falls back to the ordinary Brush slot
  // rather than an empty leading segment.
  const selectedTipId = aquarelleSelectedTipId.value;
  const hasBrushPreview = selectedTipId !== null
    && BRUSH_PRESETS.some((preset) => preset.id === selectedTipId);
  // UI checklist row 3: one shared Size slider — the displayed Brush size is
  // the live aquarelle size in Water color mode (signal read bypasses the memo).
  const liveBrushSize = isWatercolor ? aquarelleParams.value.size : brushSize;
  // Water color has no opacity — its canonical Pigment `load` rides this same
  // primary control, so the bar never shows Opacity and Pigment twice.
  const liveOpacity = isWatercolor ? aquarelleParams.value.load : opacity;

  return (
    <header class="physics-paint-topbar" aria-label="Physics Paint controls">
      {/* Left slot: status pill + ModuleSwitcher (261018-k1o). */}
      <div class="physics-paint-topbar-left">
        <div class="physics-paint-topbar-status" aria-live="polite">
          <span class={`physics-paint-status-pill ${statusTone}`}>{statusCopy}</span>
        </div>
        {/* 56-02 (D-01): module switcher — one shared component, one signal.
            261027-gh9f: under the watercolor-only gate the inert Brush slot is
            the active brush thumbnail (the same painted thumb as the Brush
            tab card). */}
        <ModuleSwitcher
          lockedModule={lockedModuleForOwner(frameScriptOwner.value)}
          leadingSlot={isWatercolor && hasBrushPreview
            ? <TopBarBrushPreview presetId={selectedTipId} onClick={onBrushPreviewClick} />
            : undefined}
        />
      </div>

      {/* Center: sliders only — Brush size + Opacity (+ Water/Edges/Grain/Pigment).
          I-11 follow-up: this cluster centers inside the remaining width after
          the left cluster; the last optional knobs hide via container queries. */}
      <div class="physics-paint-topbar-primary">
        <TopBarSlider id="physics-brush-size" label="Brush size" min={1} max={80} value={liveBrushSize} onChange={onBrushSizeChange} disabled={disabled} />
        <TopBarSlider
          id={isWatercolor ? 'physics-aquarelle-pigment' : 'physics-brush-opacity'}
          label={isWatercolor ? 'Pigment' : 'Opacity'}
          min={isWatercolor ? 0 : 10}
          max={100}
          value={liveOpacity}
          onChange={onOpacityChange}
          disabled={disabled}
        />
        {isWatercolor ? (
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
          </>
        ) : null}
      </div>

    </header>
  );
}
