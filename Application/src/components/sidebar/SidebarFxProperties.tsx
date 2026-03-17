import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
import { layerStore } from '../../stores/layerStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { blurStore } from '../../stores/blurStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { isGeneratorLayer } from '../../types/layer';
import { COLOR_GRADE_PRESETS, PRESET_NAMES } from '../../lib/fxPresets';
import type { Layer, LayerSourceData, BlendMode } from '../../types/layer';

const BLEND_MODES: BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];
const FADE_BLEND_MODES = ['source-over', 'screen', 'multiply', 'overlay', 'color', 'soft-light', 'hard-light'];

// Track whether to restore blur after range slider drag
let _rangeBlurRestore = false;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- Helper: update source data preserving other fields ----

function updateSource(layerId: string, layer: Layer, updates: Record<string, unknown>) {
  layerStore.updateLayer(layerId, {
    source: { ...layer.source, ...updates } as LayerSourceData,
  });
}

// ---- Seed toggle + seed value shared across generator sections ----

function SeedControls({ layer }: { layer: Layer }) {
  const source = layer.source as { lockSeed: boolean; seed: number };
  return (
    <>
      <button
        class={`text-[10px] px-1.5 py-[3px] rounded ${
          source.lockSeed
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'
        }`}
        title={source.lockSeed ? 'Seed locked (reproducible)' : 'Seed unlocked (random each render)'}
        onClick={() => updateSource(layer.id, layer, { lockSeed: !source.lockSeed })}
      >
        {source.lockSeed ? '\u{1F512}' : '\u{1F513}'}
      </button>
      {source.lockSeed && (
        <NumericInput
          label="Seed"
          value={source.seed}
          step={1}
          min={0}
          onChange={(val) => updateSource(layer.id, layer, { seed: Math.round(val) })}
        />
      )}
    </>
  );
}

// ---- FX Section Sub-Components (vertical layout for sidebar) ----

function GrainSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-grain' }>;
  return (
    <div class="space-y-1.5">
      <SectionLabel text="GRAIN" />
      <NumericInput label="Density" value={source.density} step={0.01} min={0} max={1}
        onChange={(val) => updateSource(layer.id, layer, { density: val })} />
      <NumericInput label="Size" value={source.size} step={1} min={1} max={4}
        onChange={(val) => updateSource(layer.id, layer, { size: val })} />
      <NumericInput label="Intensity" value={source.intensity} step={0.01} min={0} max={1}
        onChange={(val) => updateSource(layer.id, layer, { intensity: val })} />
      <SeedControls layer={layer} />
    </div>
  );
}

function ParticlesSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-particles' }>;
  return (
    <div class="space-y-1.5">
      <SectionLabel text="PARTICLES" />
      <NumericInput label="Count" value={source.count} step={1} min={1} max={500}
        onChange={(val) => updateSource(layer.id, layer, { count: Math.round(val) })} />
      <NumericInput label="Speed" value={source.speed} step={0.1} min={0} max={5}
        onChange={(val) => updateSource(layer.id, layer, { speed: val })} />
      <NumericInput label="Min" value={source.sizeMin} step={0.5} min={0.5} max={20}
        onChange={(val) => updateSource(layer.id, layer, { sizeMin: val })} />
      <NumericInput label="Max" value={source.sizeMax} step={0.5} min={0.5} max={20}
        onChange={(val) => updateSource(layer.id, layer, { sizeMax: val })} />
      <SeedControls layer={layer} />
    </div>
  );
}

function LinesSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-lines' }>;
  return (
    <div class="space-y-1.5">
      <SectionLabel text="LINES" />
      <NumericInput label="Count" value={source.count} step={1} min={1} max={100}
        onChange={(val) => updateSource(layer.id, layer, { count: Math.round(val) })} />
      <NumericInput label="Thick" value={source.thickness} step={0.5} min={0.5} max={5}
        onChange={(val) => updateSource(layer.id, layer, { thickness: val })} />
      <NumericInput label="Min" value={source.lengthMin} step={0.01} min={0} max={1}
        onChange={(val) => updateSource(layer.id, layer, { lengthMin: val })} />
      <NumericInput label="Max" value={source.lengthMax} step={0.01} min={0} max={1}
        onChange={(val) => updateSource(layer.id, layer, { lengthMax: val })} />
      <SeedControls layer={layer} />
    </div>
  );
}

function DotsSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-dots' }>;
  return (
    <div class="space-y-1.5">
      <SectionLabel text="DOTS" />
      <NumericInput label="Count" value={source.count} step={1} min={1} max={200}
        onChange={(val) => updateSource(layer.id, layer, { count: Math.round(val) })} />
      <NumericInput label="Min" value={source.sizeMin} step={0.5} min={1} max={20}
        onChange={(val) => updateSource(layer.id, layer, { sizeMin: val })} />
      <NumericInput label="Max" value={source.sizeMax} step={0.5} min={1} max={20}
        onChange={(val) => updateSource(layer.id, layer, { sizeMax: val })} />
      <NumericInput label="Speed" value={source.speed} step={0.1} min={0} max={5}
        onChange={(val) => updateSource(layer.id, layer, { speed: val })} />
      <SeedControls layer={layer} />
    </div>
  );
}

function VignetteSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-vignette' }>;
  return (
    <div class="space-y-1.5">
      <SectionLabel text="VIGNETTE" />
      <NumericInput label="Size" value={source.size} step={0.01} min={0} max={1}
        onChange={(val) => updateSource(layer.id, layer, { size: val })} />
      <NumericInput label="Softness" value={source.softness} step={0.01} min={0} max={1}
        onChange={(val) => updateSource(layer.id, layer, { softness: val })} />
      <NumericInput label="Intensity" value={source.intensity} step={0.01} min={0} max={1}
        onChange={(val) => updateSource(layer.id, layer, { intensity: val })} />
    </div>
  );
}

function ColorGradeSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'adjustment-color-grade' }>;

  const handlePresetChange = (presetName: string) => {
    const preset = COLOR_GRADE_PRESETS[presetName];
    if (preset) {
      updateSource(layer.id, layer, { ...preset, preset: presetName });
    }
  };

  const handleParamChange = (field: string, value: number | string) => {
    // When user manually adjusts a parameter, set preset to 'none'
    updateSource(layer.id, layer, { [field]: value, preset: 'none' });
  };

  return (
    <div class="space-y-1.5">
      <SectionLabel text="COLOR GRADE" />

      {/* Preset dropdown */}
      <select
        class="w-full text-[11px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-2 py-[5px] outline-none cursor-pointer"
        value={source.preset}
        onChange={(e) => handlePresetChange((e.target as HTMLSelectElement).value)}
      >
        {PRESET_NAMES.map((name) => (
          <option key={name} value={name}>
            {capitalize(name)}
          </option>
        ))}
      </select>

      <NumericInput label="Bright" value={source.brightness} step={0.1} min={-1} max={1}
        onChange={(val) => handleParamChange('brightness', val)} />
      <NumericInput label="Contrast" value={source.contrast} step={0.1} min={-1} max={1}
        onChange={(val) => handleParamChange('contrast', val)} />
      <NumericInput label="Sat" value={source.saturation} step={0.1} min={-1} max={1}
        onChange={(val) => handleParamChange('saturation', val)} />
      <NumericInput label="Hue" value={source.hue} step={1} min={-180} max={180}
        onChange={(val) => handleParamChange('hue', val)} />
      <NumericInput label="Fade" value={source.fade} step={0.1} min={0} max={1}
        onChange={(val) => handleParamChange('fade', val)} />

      {/* Tint color picker */}
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">Tint</span>
        <input
          type="color"
          value={source.tintColor}
          class="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
          onInput={(e) => handleParamChange('tintColor', (e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Fade blend mode dropdown */}
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">Fade Blend</span>
        <select
          class="w-full text-[10px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-1 py-[3px] outline-none cursor-pointer"
          value={source.fadeBlend ?? 'source-over'}
          onChange={(e) => handleParamChange('fadeBlend', (e.target as HTMLSelectElement).value)}
        >
          {FADE_BLEND_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {capitalize(mode.replace('-', ' '))}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function BlurSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'adjustment-blur' }>;
  return (
    <div class="space-y-1.5">
      <SectionLabel text="BLUR" />
      <NumericInput label="Radius" value={source.radius} step={0.01} min={0} max={1}
        onChange={(val) => updateSource(layer.id, layer, { radius: val })} />
    </div>
  );
}

// ---- Dispatch: select the right FX section based on source type ----

function FxSection({ layer }: { layer: Layer }) {
  switch (layer.source.type) {
    case 'generator-grain':
      return <GrainSection layer={layer} />;
    case 'generator-particles':
      return <ParticlesSection layer={layer} />;
    case 'generator-lines':
      return <LinesSection layer={layer} />;
    case 'generator-dots':
      return <DotsSection layer={layer} />;
    case 'generator-vignette':
      return <VignetteSection layer={layer} />;
    case 'adjustment-color-grade':
      return <ColorGradeSection layer={layer} />;
    case 'adjustment-blur':
      return <BlurSection layer={layer} />;
    default:
      return null;
  }
}

export function SidebarFxProperties({ layer, fxSequenceId }: { layer: Layer; fxSequenceId: string | null }) {
  const fxOpacityPercent = Math.round(layer.opacity * 100);
  // For FX layers, read visibility from the sequence (single source of truth)
  const fxIsVisible = fxSequenceId
    ? sequenceStore.sequences.value.find((s) => s.id === fxSequenceId)?.visible !== false
    : layer.visible;

  return (
    <div class="px-3 py-2 space-y-3">
      {/* Opacity + Visibility */}
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <SectionLabel text="OPACITY" />
          {/* Visibility toggle */}
          <button
            class="text-[var(--color-text-muted)] hover:text-[var(--color-text-button)] transition-colors p-0.5"
            title={fxIsVisible ? 'Hide layer' : 'Show layer'}
            onClick={() => {
              if (fxSequenceId) {
                sequenceStore.toggleFxSequenceVisibility(fxSequenceId);
              } else {
                layerStore.updateLayer(layer.id, { visible: !layer.visible });
              }
            }}
          >
            {fxIsVisible ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
              </svg>
            )}
          </button>
        </div>

        {/* Opacity slider */}
        <div class="flex items-center gap-1.5">
          <input
            type="range"
            min="0"
            max="100"
            value={fxOpacityPercent}
            class="flex-1 h-1 accent-[var(--color-accent)] cursor-pointer"
            onPointerDown={() => {
              startCoalescing();
              if (!blurStore.isBypassed()) { blurStore.toggleBypass(); _rangeBlurRestore = true; }
            }}
            onPointerUp={() => {
              stopCoalescing();
              if (_rangeBlurRestore) { blurStore.toggleBypass(); _rangeBlurRestore = false; }
            }}
            onInput={(e) => {
              const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
              layerStore.updateLayer(layer.id, { opacity: val });
            }}
          />
          <span class="text-[11px] text-[var(--color-text-button)] w-8 text-right">{fxOpacityPercent}%</span>
        </div>
      </div>

      {/* Blend mode dropdown (only for adjustment-blur type) */}
      {layer.source.type === 'adjustment-blur' && (
        <div class="space-y-1.5">
          <SectionLabel text="BLEND" />
          <select
            class="w-full text-[11px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-2 py-[3px] outline-none cursor-pointer"
            value={layer.blendMode}
            onChange={(e) => {
              layerStore.updateLayer(layer.id, {
                blendMode: (e.target as HTMLSelectElement).value as BlendMode,
              });
            }}
          >
            {BLEND_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {capitalize(mode)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* FX-specific controls */}
      <FxSection layer={layer} />

      {/* Generator blur radius */}
      {isGeneratorLayer(layer) && (
        <div class="space-y-1.5">
          <SectionLabel text="BLUR" />
          <NumericInput
            label="Radius"
            value={layer.blur ?? 0}
            step={0.01}
            min={0}
            max={1}
            onChange={(val) => layerStore.updateLayer(layer.id, { blur: val })}
          />
        </div>
      )}
    </div>
  );
}
