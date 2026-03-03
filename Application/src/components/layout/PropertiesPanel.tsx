import { layerStore } from '../../stores/layerStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import type { Layer, BlendMode } from '../../types/layer';

const BLEND_MODES: BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];

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

/** Small numeric input with consistent styling */
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
  return (
    <div class="flex items-center gap-1">
      <span class="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={step < 1 ? value.toFixed(2) : String(value)}
        class="w-16 text-[11px] bg-[var(--color-bg-input)] text-[#CCCCCC] rounded px-2 py-[5px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onPointerDown={() => startCoalescing()}
        onPointerUp={() => stopCoalescing()}
        onInput={(e) => {
          const val = parseFloat((e.target as HTMLInputElement).value);
          if (!isNaN(val)) onChange(val);
        }}
      />
    </div>
  );
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
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">Rot</span>
        <input
          type="number"
          step={1}
          value={String(layer.transform.rotation)}
          class="w-16 text-[11px] bg-[var(--color-bg-input)] text-[#CCCCCC] rounded px-2 py-[5px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onPointerDown={() => startCoalescing()}
          onPointerUp={() => stopCoalescing()}
          onInput={(e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            if (!isNaN(val)) updateTransform('rotation', val);
          }}
        />
        <span class="text-[10px] text-[var(--color-text-muted)]">&deg;</span>
      </div>
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
  const layers = layerStore.layers.value;
  const selectedLayer = selectedId ? layers.find((l) => l.id === selectedId) : null;

  if (!selectedLayer) {
    return (
      <div class="flex items-center justify-center h-14 w-full bg-[#0F0F0F] px-4 shrink-0">
        <span class="text-[10px] text-[var(--color-text-dim)]">
          Select a layer to edit properties
        </span>
      </div>
    );
  }

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

      {/* FX stub for Phase 7 — video layers */}
      {selectedLayer.type === 'video' && !selectedLayer.isBase && (
        <>
          <div class="w-px h-8 bg-[#2A2A2A]" />
          <span class="text-[9px] text-[var(--color-text-dim)] italic whitespace-nowrap">
            FX parameters — Phase 7
          </span>
        </>
      )}

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
