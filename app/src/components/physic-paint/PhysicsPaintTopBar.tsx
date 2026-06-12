import type { BgMode } from '@efxlab/efx-physic-paint';

export type PhysicsPaintApplyStatus = 'idle' | 'applying' | 'success' | 'error';

export interface PhysicsPaintTopBarProps {
  brushSize: number;
  opacity: number;
  background: BgMode;
  paperGrain: string;
  grainStrength: number;
  ready: boolean;
  error?: string | null;
  applyStatus?: PhysicsPaintApplyStatus;
  applyMessage?: string | null;
  devExportEnabled?: boolean;
  devExportBusy?: boolean;
  onBrushSizeChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
  onBackgroundChange: (mode: BgMode) => void;
  onPaperGrainChange: (key: string) => void;
  onGrainStrengthChange: (value: number) => void;
  onSaveState: () => void;
  onLoadState: () => void;
  onExportDebugProof?: () => void;
}

const BACKGROUND_OPTIONS: { label: string; value: BgMode }[] = [
  { label: 'Transparent', value: 'transparent' },
  { label: 'White', value: 'white' },
  { label: 'Paper 1', value: 'canvas1' },
  { label: 'Paper 2', value: 'canvas2' },
  { label: 'Paper 3', value: 'canvas3' },
];

const PAPER_GRAIN_OPTIONS = [
  { label: 'Paper 1', value: 'canvas1' },
  { label: 'Paper 2', value: 'canvas2' },
  { label: 'Paper 3', value: 'canvas3' },
];

const GRAIN_STRENGTH_OPTIONS = [
  { label: 'None', value: 0 },
  { label: 'Soft', value: 0.45 },
  { label: 'Med', value: 0.7 },
  { label: 'Hard', value: 0.95 },
];

function TopBarSlider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label class="physics-paint-topbar-control physics-paint-topbar-slider" for={props.id}>
      <span>{props.label}</span>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        onInput={(event) => props.onChange(Number((event.target as HTMLInputElement).value))}
      />
      <output>{props.value}</output>
    </label>
  );
}

function segmentedButtonClass(active: boolean) {
  return `physics-paint-segmented-button${active ? ' active' : ''}`;
}

export function PhysicsPaintTopBar({
  brushSize,
  opacity,
  background,
  paperGrain,
  grainStrength,
  ready,
  error,
  applyStatus = 'idle',
  applyMessage,
  devExportEnabled = false,
  devExportBusy = false,
  onBrushSizeChange,
  onOpacityChange,
  onBackgroundChange,
  onPaperGrainChange,
  onGrainStrengthChange,
  onSaveState,
  onLoadState,
  onExportDebugProof,
}: PhysicsPaintTopBarProps) {
  const statusCopy = ready ? 'Engine ready' : 'Engine not ready';
  const statusTone = error || applyStatus === 'error' ? 'error' : ready ? 'ready' : 'not-ready';

  return (
    <header class="physics-paint-topbar" aria-label="Physics Paint controls">
      <div class="physics-paint-topbar-primary">
        <TopBarSlider id="physics-brush-size" label="Brush size" min={1} max={80} value={brushSize} onChange={onBrushSizeChange} />
        <TopBarSlider id="physics-brush-opacity" label="Opacity" min={10} max={100} value={opacity} onChange={onOpacityChange} />

        <div class="physics-paint-topbar-control">
          <span>Background</span>
          <div class="physics-paint-segmented-row" role="group" aria-label="Background">
            {BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                class={segmentedButtonClass(background === option.value)}
                onClick={() => onBackgroundChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div class="physics-paint-topbar-control">
          <span>Paper grain</span>
          <div class="physics-paint-segmented-row" role="group" aria-label="Paper grain">
            {PAPER_GRAIN_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                class={segmentedButtonClass(paperGrain === option.value)}
                onClick={() => onPaperGrainChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div class="physics-paint-topbar-control">
          <span>Grain strength</span>
          <div class="physics-paint-segmented-row" role="group" aria-label="Grain strength">
            {GRAIN_STRENGTH_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                class={segmentedButtonClass(grainStrength === option.value)}
                onClick={() => onGrainStrengthChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div class="physics-paint-topbar-status" aria-live="polite">
        <span class={`physics-paint-status-pill ${statusTone}`}>{statusCopy}</span>
        {applyStatus === 'applying' ? <span class="physics-paint-apply-copy applying">Applying physics paint output...</span> : null}
        {applyMessage ? <span class={`physics-paint-apply-copy ${applyStatus}`}>{applyMessage}</span> : null}
        {error ? <span class="physics-paint-apply-copy error">{error}</span> : null}
        <div class="physics-paint-topbar-actions">
          <button type="button" class="physics-paint-text-button" onClick={onSaveState}>Save state</button>
          <button type="button" class="physics-paint-text-button" onClick={onLoadState}>Load state</button>
        </div>
        {devExportEnabled ? (
          <details class="physics-paint-dev-export">
            <summary>Dev export</summary>
            <button type="button" class="physics-paint-text-button" disabled={devExportBusy || !onExportDebugProof} onClick={onExportDebugProof}>
              Export PNGs + manifest
            </button>
          </details>
        ) : null}
      </div>
    </header>
  );
}
