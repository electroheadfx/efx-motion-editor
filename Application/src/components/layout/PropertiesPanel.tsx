import { useState, useCallback } from 'preact/hooks';
import { layerStore } from '../../stores/layerStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { isFxLayer } from '../../types/layer';
import { COLOR_GRADE_PRESETS, PRESET_NAMES } from '../../lib/fxPresets';
import type { Layer, BlendMode, LayerSourceData } from '../../types/layer';

const BLEND_MODES: BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];
const FADE_BLEND_MODES = ['source-over', 'screen', 'multiply', 'overlay', 'color', 'soft-light', 'hard-light'];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Section label styled consistently across all sections */
function SectionLabel({ text }: { text: string }) {
  return (
    <span class="text-[9px] font-semibold text-[var(--color-text-dimmer)] whitespace-nowrap">
      {text}
    </span>
  );
}

/** Small numeric input with local editing state -- commits on Enter/blur, reverts on Escape.
 *  Label is draggable: click-drag left/right on the label to scrub the value by step increments. */
function NumericInput({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const [isDraggingLabel, setIsDraggingLabel] = useState(false);

  const formatDisplay = useCallback(
    (v: number) => (step < 1 ? v.toFixed(2) : String(v)),
    [step],
  );

  const commitValue = useCallback(() => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      let clamped = parsed;
      if (min != null) clamped = Math.max(min, clamped);
      if (max != null) clamped = Math.min(max, clamped);
      if (clamped !== value) {
        onChange(clamped);
      }
    }
    setIsEditing(false);
    stopCoalescing();
  }, [localValue, min, max, value, onChange]);

  const revertValue = useCallback(() => {
    setIsEditing(false);
    stopCoalescing();
  }, []);

  // Label drag-to-scrub: drag left/right on label to change value
  const handleLabelPointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setIsDraggingLabel(true);
    startCoalescing();
    let startX = e.clientX;
    let currentVal = value;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      // Every 4px of movement = 1 step
      const steps = Math.trunc(dx / 4);
      if (steps !== 0) {
        startX += steps * 4;
        let newVal = currentVal + steps * step;
        // Round to avoid floating-point drift
        newVal = Math.round(newVal / step) * step;
        if (min != null) newVal = Math.max(min, newVal);
        if (max != null) newVal = Math.min(max, newVal);
        currentVal = newVal;
        onChange(newVal);
      }
    };

    const onUp = () => {
      setIsDraggingLabel(false);
      stopCoalescing();
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [value, step, min, max, onChange]);

  return (
    <div class="flex items-center gap-1">
      <span
        class={`text-[10px] text-[var(--color-text-muted)] whitespace-nowrap select-none ${isDraggingLabel ? 'cursor-ew-resize' : 'cursor-ew-resize'}`}
        onPointerDown={handleLabelPointerDown}
      >
        {label}
      </span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={isEditing ? localValue : formatDisplay(value)}
        class="w-16 text-[11px] bg-[var(--color-bg-input)] text-[#CCCCCC] rounded px-2 py-[5px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onFocus={() => {
          setIsEditing(true);
          setLocalValue(formatDisplay(value));
          startCoalescing();
        }}
        onInput={(e) => {
          setLocalValue((e.target as HTMLInputElement).value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitValue();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            revertValue();
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={commitValue}
      />
    </div>
  );
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

// ---- FX Section Sub-Components ----

/** Grain generator controls: Density, Size, Intensity, Seed */
function GrainSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-grain' }>;
  return (
    <div class="flex items-center gap-3 shrink-0">
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

/** Particles generator controls: Count, Speed, Min/Max Size, Seed */
function ParticlesSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-particles' }>;
  return (
    <div class="flex items-center gap-3 shrink-0">
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

/** Lines generator controls: Count, Thickness, Min/Max Length, Seed */
function LinesSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-lines' }>;
  return (
    <div class="flex items-center gap-3 shrink-0">
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

/** Dots generator controls: Count, Min/Max Size, Speed, Seed */
function DotsSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-dots' }>;
  return (
    <div class="flex items-center gap-3 shrink-0">
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

/** Vignette generator controls: Size, Softness, Intensity (no seed - deterministic) */
function VignetteSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-vignette' }>;
  return (
    <div class="flex items-center gap-3 shrink-0">
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

/** Color grade adjustment controls: Preset, Brightness, Contrast, Saturation, Hue, Fade, Tint */
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
    <div class="flex items-center gap-3 shrink-0">
      <SectionLabel text="COLOR GRADE" />

      {/* Preset dropdown */}
      <select
        class="text-[11px] bg-[var(--color-bg-input)] text-[#CCCCCC] rounded px-2 py-[5px] outline-none cursor-pointer"
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
          class="text-[10px] bg-[var(--color-bg-input)] text-[#CCCCCC] rounded px-1 py-[3px] outline-none cursor-pointer"
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

// In/Out range controls removed from layer level — FX sequences now own in/out frames (Plan 07-05).
// Sequence-level in/out controls will be added by a future plan.

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
    default:
      return null;
  }
}

/** Blend mode dropdown, opacity slider, and visibility toggle */
function BlendSection({ layer }: { layer: Layer }) {
  const opacityPercent = Math.round(layer.opacity * 100);

  return (
    <div class="flex items-center gap-3 shrink-0">
      <SectionLabel text="BLEND" />

      {/* Blend mode dropdown */}
      <select
        class="text-[11px] bg-[var(--color-bg-input)] text-[#CCCCCC] rounded px-2 py-[5px] outline-none cursor-pointer"
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

      {/* Opacity slider */}
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-[var(--color-text-muted)]">Opacity</span>
        <input
          type="range"
          min="0"
          max="100"
          value={opacityPercent}
          class="w-20 h-1 accent-[var(--color-accent)] cursor-pointer"
          onPointerDown={() => startCoalescing()}
          onPointerUp={() => stopCoalescing()}
          onInput={(e) => {
            const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
            layerStore.updateLayer(layer.id, { opacity: val });
          }}
        />
        <span class="text-[11px] text-[#CCCCCC] w-8 text-right">{opacityPercent}%</span>
      </div>

      {/* Visibility toggle */}
      <button
        class="text-[var(--color-text-muted)] hover:text-[#CCCCCC] transition-colors p-0.5"
        title={layer.visible ? 'Hide layer' : 'Show layer'}
        onClick={() => {
          layerStore.updateLayer(layer.id, { visible: !layer.visible });
        }}
      >
        {layer.visible ? (
          // Filled eye icon (visible)
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
          </svg>
        ) : (
          // Outline eye-off icon (hidden)
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
          </svg>
        )}
      </button>
    </div>
  );
}

/** Position X/Y, scale, rotation controls */
function TransformSection({ layer }: { layer: Layer }) {
  const updateTransform = (field: string, value: number) => {
    layerStore.updateLayer(layer.id, {
      transform: { ...layer.transform, [field]: value },
    });
  };

  return (
    <div class="flex items-center gap-3 shrink-0">
      <SectionLabel text="TRANSFORM" />

      <NumericInput
        label="X"
        value={layer.transform.x}
        step={1}
        onChange={(val) => updateTransform('x', val)}
      />
      <NumericInput
        label="Y"
        value={layer.transform.y}
        step={1}
        onChange={(val) => updateTransform('y', val)}
      />
      <NumericInput
        label="Scale"
        value={layer.transform.scale}
        step={0.01}
        min={0.01}
        onChange={(val) => updateTransform('scale', val)}
      />
      <NumericInput
        label="Rot"
        value={layer.transform.rotation}
        step={1}
        onChange={(val) => updateTransform('rotation', val)}
      />
      <span class="text-[10px] text-[var(--color-text-muted)]">&deg;</span>
    </div>
  );
}

/** Crop controls: T, R, B, L (0-1 fractions) */
function CropSection({ layer }: { layer: Layer }) {
  const updateCrop = (field: string, value: number) => {
    // Clamp to 0-1 range
    const clamped = Math.max(0, Math.min(1, value));
    layerStore.updateLayer(layer.id, {
      transform: { ...layer.transform, [field]: clamped },
    });
  };

  return (
    <div class="flex items-center gap-3 shrink-0">
      <SectionLabel text="CROP" />

      <NumericInput
        label="T"
        value={layer.transform.cropTop}
        step={0.01}
        min={0}
        max={1}
        onChange={(val) => updateCrop('cropTop', val)}
      />
      <NumericInput
        label="R"
        value={layer.transform.cropRight}
        step={0.01}
        min={0}
        max={1}
        onChange={(val) => updateCrop('cropRight', val)}
      />
      <NumericInput
        label="B"
        value={layer.transform.cropBottom}
        step={0.01}
        min={0}
        max={1}
        onChange={(val) => updateCrop('cropBottom', val)}
      />
      <NumericInput
        label="L"
        value={layer.transform.cropLeft}
        step={0.01}
        min={0}
        max={1}
        onChange={(val) => updateCrop('cropLeft', val)}
      />
    </div>
  );
}

export function PropertiesPanel() {
  const selectedId = layerStore.selectedLayerId.value;
  // Search all sequences for the selected layer (FX layers live in FX sequences, not the active content sequence)
  let selectedLayer: Layer | null = null;
  if (selectedId) {
    for (const seq of sequenceStore.sequences.value) {
      const found = seq.layers.find((l) => l.id === selectedId);
      if (found) {
        selectedLayer = found;
        break;
      }
    }
  }

  if (!selectedLayer) {
    return (
      <div class="flex items-center justify-center h-14 w-full bg-[#0F0F0F] px-4 shrink-0">
        <span class="text-[10px] text-[var(--color-text-dim)]">
          Select a layer to edit properties
        </span>
      </div>
    );
  }

  // FX layers: show Blend + FX-specific section + In/Out range (no Transform or Crop)
  if (isFxLayer(selectedLayer)) {
    return (
      <div class="flex items-center gap-5 h-14 w-full bg-[#0F0F0F] px-4 shrink-0 overflow-x-auto">
        <BlendSection layer={selectedLayer} />
        <div class="w-px h-8 bg-[#2A2A2A]" />
        <FxSection layer={selectedLayer} />
      </div>
    );
  }

  // Non-FX layers: existing layout (Blend, Transform, Crop, source info)
  return (
    <div class="flex items-center gap-5 h-14 w-full bg-[#0F0F0F] px-4 shrink-0 overflow-x-auto">
      {/* BLEND section */}
      <BlendSection layer={selectedLayer} />
      <div class="w-px h-8 bg-[#2A2A2A]" />
      {/* TRANSFORM section */}
      <TransformSection layer={selectedLayer} />
      <div class="w-px h-8 bg-[#2A2A2A]" />
      {/* CROP section */}
      <CropSection layer={selectedLayer} />

      {/* Source info for image layers */}
      {(selectedLayer.type === 'static-image' || selectedLayer.type === 'image-sequence') &&
        !selectedLayer.isBase && (
          <>
            <div class="w-px h-8 bg-[#2A2A2A]" />
            <span class="text-[9px] text-[var(--color-text-dim)] italic whitespace-nowrap">
              Source: {selectedLayer.source.type}
            </span>
          </>
        )}
    </div>
  );
}
