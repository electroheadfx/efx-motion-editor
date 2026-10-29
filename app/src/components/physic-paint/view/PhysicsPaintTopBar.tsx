import type { TargetedMouseEvent } from 'preact';
import type { ReadonlySignal } from '@preact/signals';
import { BRUSH_PRESETS } from '@efxlab/efx-watercolor';
import { ChevronDown, Eraser, Paintbrush } from 'lucide-preact';
import { SliderStepper } from '../../shared/SliderStepper';
import { getPhysicsPaintEngineStatusTone } from './physicsPaintWorkflowPresentation';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import {
  aquarelleActiveTool,
  aquarelleBrushMenuOpen,
  aquarelleLiftTipId,
  aquarelleParams,
  aquarelleScriptRecordingEnabled,
  aquarelleSelectedTipId,
  setAquarelleBrushMenuOpen,
  setAquarelleParam,
  setAquarelleScriptRecordingEnabled,
} from './aquarelleRecordState';
import { WatercolorBrushThumb } from './WatercolorBrushLibrary';
import {
  aquarelleSelectMode,
  aquarelleStrokeTypeFilter,
  setAquarelleSelectMode,
} from './aquarelleStrokeSelection';

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
 * 261018-gqo move 5: Engine ready is pinned left alone; the settings controls
 * (Brush size + Pigment/Opacity + Water/Edges/Grain) form ONE group.
 *
 * 261027-gh9g: the module switcher left the Studio top bar entirely. The
 * active brush's larger painted thumbnail + name seat in the LEFT cluster
 * after the Engine ready pill and open the brush dropdown. Water / Edges /
 * Grain are the optional watercolor knobs and hide as the settings area
 * narrows (container queries in physicsPaintStudio.css).
 *
 * 261029-hy2: the settings group is pinned to the RIGHT edge at every width,
 * and it renders ONLY for the tools that own settings — Brush (Brush size +
 * Pigment + Water + Edges + Grain) and Eraser (Size + Eraser strength + Edit).
 * Water and Pen remove the whole cluster from the DOM. The left slot is ONE
 * tool pill for both tools: tool icon + painted thumb + name + chevron.
 *
 * 261027-k6j — the Script switch sits beside the tool pill and gates stroke
 * recording only.
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
   * 261029-eur: the frame-scoped "is there anything to select" gate — the
   * same signal the rail's Select toggle reads. The Edit switch is disabled
   * without it; the leaf subscribes, never the Studio body.
   */
  moveAvailable: ReadonlySignal<boolean>;
}

/**
 * 261027-gh9g / 261029-hy2: the top bar's ONE tool pill — the retired module
 * switcher's slot. A leading tool icon (Paintbrush / Eraser), the tool's
 * painted thumbnail and name, and a chevron open that tool's dropdown. The
 * thumb is deliberately larger than the old switcher segment so the live tip
 * reads at a glance. `disabled` mirrors the bar's lock (the retired
 * LiftShapePicker carried the same contract — dropping it would silently
 * un-disable the eraser pill while the Studio is busy).
 */
export function TopBarBrushTrigger(props: {
  tool: 'brush' | 'lift';
  presetId: string | null;
  open: boolean;
  onToggle: (event: TargetedMouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const preset = props.presetId
    ? BRUSH_PRESETS.find((candidate) => candidate.id === props.presetId)
    : undefined;
  const isLift = props.tool === 'lift';
  const Icon = isLift ? Eraser : Paintbrush;
  const title = isLift ? 'Choose an eraser shape' : 'Choose a brush';
  const name = preset?.name ?? (isLift ? 'Filbert' : 'Brushes');
  return (
    <button
      type="button"
      class={`physics-paint-brush-trigger${props.open ? ' open' : ''}`}
      data-watercolor-brush-trigger
      data-testid={props.testId}
      aria-haspopup="menu"
      aria-expanded={props.open}
      title={title}
      aria-label={preset ? `${isLift ? 'Eraser' : 'Brush'} — ${preset.name}` : title}
      disabled={props.disabled}
      onClick={props.onToggle}
    >
      <Icon size={15} class="physics-paint-brush-trigger-icon" aria-hidden="true" />
      {preset ? (
        <WatercolorBrushThumb
          presetId={preset.id}
          class="physics-paint-brush-trigger-thumb"
        />
      ) : <span class="physics-paint-brush-trigger-thumb is-empty" aria-hidden="true" />}
      <span class="physics-paint-brush-trigger-name">{name}</span>
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

/**
 * 261029-eur: the Eraser tool's "Edit" switch — the one control that enters
 * and leaves the lift-only editing surface. It replaces the retired one-shot
 * "Select lifts" button in place and shares the Script switch's markup/CSS.
 *
 * ON is DERIVED (`select mode AND filter === 'lift'`), never mirrored in a
 * second boolean: flipping the dialog filter to All/Paint turns it off for
 * free. Both signals are read in THIS leaf — never the Studio body.
 */
export function LiftEditSwitch(props: {
  disabled?: boolean;
  moveAvailable: ReadonlySignal<boolean>;
}) {
  const selectMode = aquarelleSelectMode.value;
  const filter = aquarelleStrokeTypeFilter.value;
  const active = selectMode && filter === 'lift';
  const unavailable = props.disabled === true || !props.moveAvailable.value;
  return (
    <button
      type="button"
      class={`physics-paint-script-switch${active ? ' is-on' : ''}`}
      role="switch"
      aria-checked={active ? 'true' : 'false'}
      data-testid="physics-lift-edit"
      disabled={unavailable}
      title={active
        ? 'Edit on — only Eraser strokes can be selected; turn off to paint again'
        : 'Edit — select and edit the Eraser strokes on this frame'}
      onClick={() => setAquarelleSelectMode(!active, 'lift')}
    >
      <span class="physics-paint-script-switch-track" aria-hidden="true">
        <span class="physics-paint-script-switch-knob" />
      </span>
      <span class="physics-paint-script-switch-label">Edit</span>
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
  moveAvailable,
}: PhysicsPaintTopBarProps) {
  recordPhysicsPaintPerformanceCounter('render.topBar');
  const statusCopy = ready ? 'Engine ready' : 'Engine not ready';
  const statusTone = getPhysicsPaintEngineStatusTone({ ready });
  // Narrow signal reads: picking a brush or opening the dropdown re-renders
  // only this bar.
  const selectedTipId = aquarelleSelectedTipId.value;
  // 261029-hy2: the Eraser pill shows its own shape selection (same Filbert
  // fallback the retired native picker used).
  const liftTipId = aquarelleLiftTipId.value ?? 'filbert';
  const brushMenuOpen = aquarelleBrushMenuOpen.value;
  // The tool is captured when the pill opens its dropdown, so the popover
  // always shows the content of the tool that was clicked.
  const toggleBrushMenu = (tool: 'brush' | 'lift') => (event: TargetedMouseEvent<HTMLButtonElement>) => {
    if (brushMenuOpen) {
      setAquarelleBrushMenuOpen(false);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setAquarelleBrushMenuOpen(true, { left: rect.left, top: rect.bottom + 6 }, tool);
  };
  // UI checklist row 3: one shared Size slider — the displayed Brush size is
  // the live aquarelle size (signal read bypasses the memo).
  const liveBrushSize = aquarelleParams.value.size;
  // Water color has no opacity — its canonical Pigment `load` rides this same
  // primary control, so the bar never shows Opacity and Pigment twice.
  const liveOpacity = aquarelleParams.value.load;
  // 261028-k03b / 261029-eur: the Eraser tool owns the primary cluster — Size
  // + Eraser strength + the Edit switch. The brush knobs (pigment/water/edges/
  // grain) do not describe an eraser stroke.
  const activeTool = aquarelleActiveTool.value;
  const liftStrength = aquarelleParams.value.lift;
  // 261029-hy2: only Brush and Eraser own top-bar settings. Water and Pen
  // REMOVE the cluster from the DOM (not merely disable it) — an empty
  // flex: 1 1 auto box would still eat the bar's remaining width.
  const toolOwnsSettings = activeTool === 'brush' || activeTool === 'lift';

  return (
    <header class="physics-paint-topbar" aria-label="Physics Paint controls">
      {/* Left slot: status pill + tool pill (261018-k1o / 261027-gh9g). */}
      <div class="physics-paint-topbar-left">
        <div class="physics-paint-topbar-status" aria-live="polite">
          <span class={`physics-paint-status-pill ${statusTone}`}>{statusCopy}</span>
        </div>
        {/* 261027-gh9g / 261029-hy2: the module switcher is gone from the
            Studio top bar — a single Water color mode. ONE pill for both
            tools: the Eraser tool shows its own icon + shape, every other
            tool (Brush, Water, Pen) shows the active brush. Clicking it opens
            that tool's dropdown. */}
        {activeTool === 'lift' ? (
          <TopBarBrushTrigger
            tool="lift"
            presetId={liftTipId}
            open={brushMenuOpen}
            onToggle={toggleBrushMenu('lift')}
            disabled={disabled}
            testId="physics-lift-shape"
          />
        ) : (
          <TopBarBrushTrigger
            tool="brush"
            presetId={selectedTipId}
            open={brushMenuOpen}
            onToggle={toggleBrushMenu('brush')}
            disabled={disabled}
          />
        )}
        <ScriptRecordingSwitch />
      </div>

      {/* Settings cluster: pinned to the right edge at every width. Renders
          ONLY for Brush and Eraser — Water and Pen have no settings to show.
          The last optional knobs hide via container queries.
          261028-k03b / 261029-eur: the Eraser tool swaps the whole cluster for
          its own controls — Size + Eraser strength (eraser icon) + Edit. */}
      {toolOwnsSettings ? (
        <div class="physics-paint-topbar-primary">
        {activeTool === 'lift' ? (
          <div class="physics-paint-topbar-lift" data-testid="physics-lift-controls">
            {/* 261028-k03d: the Eraser cluster keeps the shared Size (the erase
                radius runs through the same sizeMult) + Strength + Edit.
                The shape moved to the left slot, where the brush dropdown
                sits for every other tool. */}
            <TopBarSlider id="physics-lift-size" label="Size" min={1} max={80} value={liveBrushSize} onChange={onBrushSizeChange} disabled={disabled} />
            <div
              class="physics-paint-topbar-control physics-paint-topbar-slider physics-paint-topbar-lift-strength"
              data-testid="physics-lift-strength"
            >
              <Eraser size={15} aria-hidden="true" />
              <SliderStepper
                id="physics-lift-strength"
                label="Eraser strength"
                value={liftStrength}
                onChange={(value) => setAquarelleParam('lift', Math.max(5, Math.min(90, Math.round(value))))}
                step={1}
                min={5}
                max={90}
                disabled={disabled}
                ariaLabel="Eraser strength"
              />
            </div>
            <LiftEditSwitch disabled={disabled} moveAvailable={moveAvailable} />
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
      ) : null}

    </header>
  );
}
