import { useEffect } from 'preact/hooks';
import { layerStore } from '../../stores/layerStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { blurStore } from '../../stores/blurStore';
import { keyframeStore } from '../../stores/keyframeStore';
import { timelineStore } from '../../stores/timelineStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { isFxLayer, isGeneratorLayer } from '../../types/layer';
import { COLOR_GRADE_PRESETS, PRESET_NAMES } from '../../lib/fxPresets';
import type { Layer, LayerSourceData, BlendMode, KeyframeValues } from '../../types/layer';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';

const BLEND_MODES: BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];

// Track whether to restore blur after range slider drag
let _rangeBlurRestore = false;

const FADE_BLEND_MODES = ['source-over', 'screen', 'multiply', 'overlay', 'color', 'soft-light', 'hard-light'];

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
        class="text-[11px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-2 py-[5px] outline-none cursor-pointer"
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
          class="text-[10px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-1 py-[3px] outline-none cursor-pointer"
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

/** Blur adjustment controls: Radius (no seed -- blur is deterministic) */
function BlurSection({ layer }: { layer: Layer }) {
  const source = layer.source as Extract<LayerSourceData, { type: 'adjustment-blur' }>;
  return (
    <div class="flex items-center gap-3 shrink-0">
      <SectionLabel text="BLUR" />
      <NumericInput label="Radius" value={source.radius} step={0.01} min={0} max={1}
        onChange={(val) => updateSource(layer.id, layer, { radius: val })} />
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
    case 'adjustment-blur':
      return <BlurSection layer={layer} />;
    default:
      return null;
  }
}

// BlendSection removed -- FX layers now use inline opacity+visibility in PropertiesPanel,
// and content layers use inline blend+opacity in LayerList sidebar rows.

/** Position X/Y, scale, rotation controls */
function TransformSection({
  layer,
  overrideValues,
  onKeyframeEdit,
}: {
  layer: Layer;
  overrideValues?: KeyframeValues | null;
  onKeyframeEdit?: (field: keyof KeyframeValues, value: number) => void;
}) {
  const vals = overrideValues;
  const updateTransform = (field: string, value: number) => {
    if (onKeyframeEdit) {
      // Route through keyframe edit handler (transient or keyframe update)
      onKeyframeEdit(field as keyof KeyframeValues, value);
    } else {
      layerStore.updateLayer(layer.id, {
        transform: { ...layer.transform, [field]: value },
      });
    }
  };

  return (
    <div class="flex items-center gap-3 shrink-0">
      <SectionLabel text="TRANSFORM" />

      <NumericInput
        label="X"
        value={vals ? vals.x : layer.transform.x}
        step={1}
        onChange={(val) => updateTransform('x', val)}
      />
      <NumericInput
        label="Y"
        value={vals ? vals.y : layer.transform.y}
        step={1}
        onChange={(val) => updateTransform('y', val)}
      />
      <NumericInput
        label="SX"
        value={vals ? vals.scaleX : layer.transform.scaleX}
        step={0.01}
        min={0.01}
        onChange={(val) => updateTransform('scaleX', val)}
      />
      <NumericInput
        label="SY"
        value={vals ? vals.scaleY : layer.transform.scaleY}
        step={0.01}
        min={0.01}
        onChange={(val) => updateTransform('scaleY', val)}
      />
      <NumericInput
        label="Rot"
        value={vals ? vals.rotation : layer.transform.rotation}
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

/** [+ Keyframe] / [Update] button for content layers with keyframe support */
function KeyframeButton({ layer }: { layer: Layer }) {
  // Only show for content layers (not FX, not base)
  if (isFxLayer(layer) || layer.isBase) return null;

  const isOnKf = keyframeStore.isOnKeyframe.value;

  return (
    <button
      class={`text-[10px] px-2 py-[3px] rounded font-medium transition-colors ${
        isOnKf
          ? 'bg-[#FFD700] text-black hover:bg-[#E5C000]'
          : 'bg-[var(--color-accent)] text-white hover:opacity-80'
      }`}
      title={isOnKf ? 'Update keyframe at this frame' : 'Add keyframe at this frame'}
      onClick={() => {
        const globalFrame = timelineStore.currentFrame.peek();
        keyframeStore.addKeyframe(layer.id, globalFrame);
      }}
    >
      {isOnKf ? '\u25C6 Update' : '+ Keyframe'}
    </button>
  );
}

export function PropertiesPanel() {
  const selectedId = layerStore.selectedLayerId.value;
  // Search all sequences for the selected layer (FX layers live in FX sequences, not the active content sequence)
  let selectedLayer: Layer | null = null;
  let fxSequenceId: string | null = null;
  if (selectedId) {
    for (const seq of sequenceStore.sequences.value) {
      const found = seq.layers.find((l) => l.id === selectedId);
      if (found) {
        selectedLayer = found;
        if (seq.kind === 'fx') fxSequenceId = seq.id;
        break;
      }
    }
  }

  if (!selectedLayer) {
    return (
      <div class="flex items-center justify-center h-14 w-full bg-[var(--color-bg-root)] px-4 shrink-0">
        <span class="text-[10px] text-[var(--color-text-dim)]">
          Select a layer to edit transform
        </span>
      </div>
    );
  }

  // FX layers: show opacity+visibility + FX-specific section (no blend mode dropdown, no Transform or Crop)
  if (isFxLayer(selectedLayer)) {
    const fxOpacityPercent = Math.round(selectedLayer.opacity * 100);
    // For FX layers, read visibility from the sequence (single source of truth)
    const fxIsVisible = fxSequenceId
      ? sequenceStore.sequences.value.find((s) => s.id === fxSequenceId)?.visible !== false
      : selectedLayer.visible;

    return (
      <div class="flex items-center gap-5 h-14 w-full bg-[var(--color-bg-root)] px-4 shrink-0 overflow-x-auto">
        {/* Opacity + Visibility (no blend mode dropdown) */}
        <div class="flex items-center gap-3 shrink-0">
          <SectionLabel text="OPACITY" />

          {/* Opacity slider */}
          <div class="flex items-center gap-1.5">
            <input
              type="range"
              min="0"
              max="100"
              value={fxOpacityPercent}
              class="w-20 h-1 accent-[var(--color-accent)] cursor-pointer"
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
                layerStore.updateLayer(selectedLayer.id, { opacity: val });
              }}
            />
            <span class="text-[11px] text-[var(--color-text-button)] w-8 text-right">{fxOpacityPercent}%</span>
          </div>

          {/* Visibility toggle */}
          <button
            class="text-[var(--color-text-muted)] hover:text-[var(--color-text-button)] transition-colors p-0.5"
            title={fxIsVisible ? 'Hide layer' : 'Show layer'}
            onClick={() => {
              if (fxSequenceId) {
                sequenceStore.toggleFxSequenceVisibility(fxSequenceId);
              } else {
                layerStore.updateLayer(selectedLayer.id, { visible: !selectedLayer.visible });
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
        {selectedLayer.source.type === 'adjustment-blur' && (
          <>
            <div class="w-px h-8 bg-[var(--color-bg-divider)]" />
            <div class="flex items-center gap-3 shrink-0">
              <SectionLabel text="BLEND" />
              <select
                class="text-[11px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-2 py-[3px] outline-none cursor-pointer"
                value={selectedLayer.blendMode}
                onChange={(e) => {
                  layerStore.updateLayer(selectedLayer.id, {
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
          </>
        )}
        <div class="w-px h-8 bg-[var(--color-bg-divider)]" />
        <FxSection layer={selectedLayer} />
        {isGeneratorLayer(selectedLayer) && (
          <>
            <div class="w-px h-8 bg-[var(--color-bg-divider)]" />
            <div class="flex items-center gap-3 shrink-0">
              <SectionLabel text="BLUR" />
              <NumericInput
                label="Radius"
                value={selectedLayer.blur ?? 0}
                step={0.01}
                min={0}
                max={1}
                onChange={(val) => layerStore.updateLayer(selectedLayer.id, { blur: val })}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // Non-FX layers: Blend + Opacity + Transform + Crop + Blur + Keyframe support

  // When layer has keyframes, show display values (transient overrides or interpolated)
  const kfDisplayValues = keyframeStore.displayValues.value;
  const hasKeyframes = selectedLayer && !isFxLayer(selectedLayer) && !selectedLayer.isBase
    && selectedLayer.keyframes && selectedLayer.keyframes.length > 0;
  const showKfValues = hasKeyframes && kfDisplayValues;
  const isOnKf = keyframeStore.isOnKeyframe.value;

  // Transient edit routing: when a layer has keyframes and the playhead is NOT on a keyframe,
  // edits write to transientOverrides; when ON a keyframe, edits update layerStore + keyframe.
  const handleKeyframeEdit = hasKeyframes ? (field: keyof KeyframeValues, value: number) => {
    if (isOnKf) {
      // ON a keyframe: update layer state AND update keyframe values
      if (field === 'opacity') {
        layerStore.updateLayer(selectedLayer!.id, { opacity: value });
      } else if (field === 'blur') {
        layerStore.updateLayer(selectedLayer!.id, { blur: value });
      } else {
        // Transform fields: x, y, scaleX, scaleY, rotation
        layerStore.updateLayer(selectedLayer!.id, {
          transform: { ...selectedLayer!.transform, [field]: value },
        });
      }
      // Also update the keyframe at this frame
      keyframeStore.addKeyframe(selectedLayer!.id, timelineStore.currentFrame.peek());
    } else {
      // BETWEEN keyframes: transient edit only -- does NOT touch layerStore
      keyframeStore.setTransientValue(field, value);
    }
  } : undefined;

  const contentOpacityPercent = Math.round(
    (showKfValues ? kfDisplayValues!.opacity : selectedLayer.opacity) * 100,
  );

  // Clear transient overrides when frame changes (scrub or playback advances)
  // Note: keyframeStore already has a frame-change effect, but this ensures React
  // re-renders pick up the cleared overrides immediately.
  useEffect(() => {
    void timelineStore.currentFrame.value;
    keyframeStore.clearTransientOverrides();
  }, [timelineStore.currentFrame.value]);

  return (
    <div class="flex items-center gap-5 h-14 w-full bg-[var(--color-bg-root)] px-4 shrink-0 overflow-x-auto">
      {/* KEYFRAME button (content layers only, not base) */}
      {!selectedLayer.isBase && (
        <>
          <KeyframeButton layer={selectedLayer} />
          {hasKeyframes && <div class="w-px h-8 bg-[var(--color-bg-divider)]" />}
        </>
      )}
      {/* BLEND + OPACITY section */}
      <div class="flex items-center gap-3 shrink-0">
        <SectionLabel text="BLEND" />
        {selectedLayer.isBase ? (
          <span class="text-[11px] text-[var(--color-text-dim)]">Normal</span>
        ) : (
          <select
            class="text-[11px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-2 py-[3px] outline-none cursor-pointer"
            value={selectedLayer.blendMode}
            onChange={(e) => {
              layerStore.updateLayer(selectedLayer.id, {
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
        )}

        <SectionLabel text="OPACITY" />
        <div class="flex items-center gap-1.5">
          <input
            type="range"
            min="0"
            max="100"
            value={contentOpacityPercent}
            class="w-20 h-1 accent-[var(--color-accent)] cursor-pointer"
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
              if (handleKeyframeEdit) {
                handleKeyframeEdit('opacity', val);
              } else {
                layerStore.updateLayer(selectedLayer.id, { opacity: val });
              }
            }}
          />
          <span class="text-[11px] text-[var(--color-text-button)] w-8 text-right">{contentOpacityPercent}%</span>
        </div>
      </div>
      <div class="w-px h-8 bg-[var(--color-bg-divider)]" />
      {/* TRANSFORM section */}
      <TransformSection
        layer={selectedLayer}
        overrideValues={showKfValues ? kfDisplayValues : null}
        onKeyframeEdit={handleKeyframeEdit}
      />
      <div class="w-px h-8 bg-[var(--color-bg-divider)]" />
      {/* CROP section */}
      <CropSection layer={selectedLayer} />
      <div class="w-px h-8 bg-[var(--color-bg-divider)]" />
      {/* BLUR section */}
      <div class="flex items-center gap-3 shrink-0">
        <SectionLabel text="BLUR" />
        <NumericInput
          label="Radius"
          value={showKfValues ? kfDisplayValues!.blur : (selectedLayer.blur ?? 0)}
          step={0.01}
          min={0}
          max={1}
          onChange={(val) => {
            if (handleKeyframeEdit) {
              handleKeyframeEdit('blur', val);
            } else {
              layerStore.updateLayer(selectedLayer.id, { blur: val });
            }
          }}
        />
      </div>

      {/* Source info for image layers */}
      {(selectedLayer.type === 'static-image' || selectedLayer.type === 'image-sequence') &&
        !selectedLayer.isBase && (
          <>
            <div class="w-px h-8 bg-[var(--color-bg-divider)]" />
            <span class="text-[9px] text-[var(--color-text-dim)] italic whitespace-nowrap">
              Source: {selectedLayer.source.type}
            </span>
          </>
        )}
    </div>
  );
}
