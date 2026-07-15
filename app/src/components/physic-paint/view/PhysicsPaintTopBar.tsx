import type { BgMode } from '@efxlab/efx-physic-paint';
import { getPhysicsPaintEngineStatusTone } from './physicsPaintWorkflowPresentation';

export interface PhysicsPaintTopBarProps {
  brushSize: number;
  opacity: number;
  background: BgMode;
  paperGrain: string;
  grainStrength: number;
  ready: boolean;
  disabled?: boolean;
  onBrushSizeChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
  onBackgroundChange: (mode: BgMode) => void;
  onPaperGrainChange: (key: string) => void;
  onGrainStrengthChange: (value: number) => void;
}

const PAPER_TEXTURES = {
  canvas1: '/img/paper_1.jpg',
  canvas2: '/img/paper_2.jpg',
  canvas3: '/img/paper_3.jpg',
} as const;

const BACKGROUND_OPTIONS: { label: string; value: BgMode; swatch: string }[] = [
  { label: 'Transparent', value: 'transparent', swatch: 'repeating-conic-gradient(#777 0% 25%, #d8d8d8 0% 50%) 0 0 / 8px 8px' },
  { label: 'White', value: 'white', swatch: '#fff' },
  { label: 'Paper 1', value: 'canvas1', swatch: `url(${PAPER_TEXTURES.canvas1}) center / cover` },
  { label: 'Paper 2', value: 'canvas2', swatch: `url(${PAPER_TEXTURES.canvas2}) center / cover` },
  { label: 'Paper 3', value: 'canvas3', swatch: `url(${PAPER_TEXTURES.canvas3}) center / cover` },
];

const PAPER_GRAIN_OPTIONS = [
  { label: 'Paper 1', value: 'canvas1', swatch: `url(${PAPER_TEXTURES.canvas1}) center / cover` },
  { label: 'Paper 2', value: 'canvas2', swatch: `url(${PAPER_TEXTURES.canvas2}) center / cover` },
  { label: 'Paper 3', value: 'canvas3', swatch: `url(${PAPER_TEXTURES.canvas3}) center / cover` },
];

const GRAIN_STRENGTH_OPTIONS = [
  { label: 'None', value: 0 },
  { label: 'Soft', value: 0.35 },
  { label: 'Med', value: 0.65 },
  { label: 'Hard', value: 0.95 },
];

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
  numericInput?: boolean;
  disabled?: boolean;
}) {
  const updateValue = (value: unknown) => props.onChange(clampTopBarValue(value, props.min, props.max));
  return (
    <label class={`physics-paint-topbar-control physics-paint-topbar-slider${props.numericInput ? ' exact' : ''}`} for={props.id}>
      <span>{props.label}</span>
      <div class="physics-paint-topbar-slider-row">
        <input
          id={props.id}
          type="range"
          min={props.min}
          max={props.max}
          value={props.value}
          disabled={props.disabled}
          onInput={(event) => updateValue((event.target as HTMLInputElement).value)}
        />
        {props.numericInput ? (
          <input
            class="physics-paint-topbar-number"
            type="number"
            min={props.min}
            max={props.max}
            value={props.value}
            disabled={props.disabled}
            aria-label={`${props.label} exact value`}
            onInput={(event) => updateValue((event.target as HTMLInputElement).value)}
            onBlur={(event) => updateValue((event.target as HTMLInputElement).value)}
          />
        ) : <output>{props.value}</output>}
      </div>
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
  disabled = false,
  onBrushSizeChange,
  onOpacityChange,
  onBackgroundChange,
  onPaperGrainChange,
  onGrainStrengthChange,
}: PhysicsPaintTopBarProps) {
  const statusCopy = ready ? 'Engine ready' : 'Engine not ready';
  const statusTone = getPhysicsPaintEngineStatusTone({ ready });

  return (
    <header class="physics-paint-topbar" aria-label="Physics Paint controls">
      <div class="physics-paint-topbar-status" aria-live="polite">
        <span class={`physics-paint-status-pill ${statusTone}`}>{statusCopy}</span>
      </div>

      <div class="physics-paint-topbar-primary">
        <TopBarSlider id="physics-brush-size" label="Brush size" min={1} max={80} value={brushSize} onChange={onBrushSizeChange} numericInput disabled={disabled} />
        <TopBarSlider id="physics-brush-opacity" label="Opacity" min={10} max={100} value={opacity} onChange={onOpacityChange} disabled={disabled} />

        <div class="physics-paint-topbar-control">
          <span>Background</span>
          <div class="physics-paint-segmented-row" role="group" aria-label="Background">
            {BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                class={`${segmentedButtonClass(background === option.value)} physics-paint-swatch-button`}
                title={option.label}
                aria-label={option.label}
                onClick={() => onBackgroundChange(option.value)}
              >
                <span class="physics-paint-paper-swatch" style={{ background: option.swatch }} />
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
                disabled={disabled}
                class={`${segmentedButtonClass(paperGrain === option.value)} physics-paint-swatch-button`}
                title={option.label}
                aria-label={option.label}
                onClick={() => onPaperGrainChange(option.value)}
              >
                <span class="physics-paint-paper-swatch textured" style={{ background: option.swatch }} />
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
                disabled={disabled}
                class={segmentedButtonClass(grainStrength === option.value)}
                onClick={() => onGrainStrengthChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

    </header>
  );
}
