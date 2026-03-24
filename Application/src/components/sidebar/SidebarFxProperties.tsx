import { useEffect, useState, useRef } from 'preact/hooks';
import { X } from 'lucide-preact';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
import { ColorPickerModal } from '../shared/ColorPickerModal';
import { KeyframeNavBar } from './KeyframeNavBar';
import { InlineInterpolation } from './InlineInterpolation';
import { layerStore } from '../../stores/layerStore';
import { keyframeStore } from '../../stores/keyframeStore';
import { timelineStore } from '../../stores/timelineStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { blurStore } from '../../stores/blurStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { isGeneratorLayer } from '../../types/layer';
import { COLOR_GRADE_PRESETS, PRESET_NAMES } from '../../lib/fxPresets';
import { getShaderById } from '../../lib/shaderLibrary';
import type { ShaderDefinition } from '../../lib/shaderLibrary';
import { renderShaderPreview, renderGlslFxImage } from '../../lib/glslRuntime';
import { capturePreviewCanvas, getCapturedCanvas } from '../../lib/shaderPreviewCapture';
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

// ---- Shared props for FX sections when keyframe-aware ----

interface FxSectionKfProps {
  onFxEdit?: (field: string, value: number) => void;
  fxValues?: Record<string, number>;
}

// ---- Seed toggle + seed value shared across generator sections ----

function SeedControls({ layer }: { layer: Layer }) {
  const source = layer.source as { lockSeed: boolean; seed: number };
  return (
    <>
      <button
        class={`text-[10px] px-1.5 py-[3px] rounded cursor-pointer transition-colors ${
          source.lockSeed
            ? 'bg-(--color-accent) text-white hover:brightness-125'
            : 'bg-(--color-bg-input) text-(--color-text-muted) hover:bg-(--color-bg-hover-item) hover:text-white'
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

function GrainSection({ layer, onFxEdit, fxValues }: { layer: Layer } & FxSectionKfProps) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-grain' }>;
  const v = (field: string, fallback: number) => fxValues ? (fxValues[field] ?? fallback) : fallback;
  const edit = (field: string, val: number) => onFxEdit ? onFxEdit(field, val) : updateSource(layer.id, layer, { [field]: val });
  return (
    <div>
      <SectionLabel text="GRAIN" />
      <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Density" value={v('density', source.density)} step={0.01} min={0} max={1}
            onChange={(val) => edit('density', val)} />
          <NumericInput label="Size" value={v('size', source.size)} step={1} min={1} max={4}
            onChange={(val) => edit('size', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Intensity" value={v('intensity', source.intensity)} step={0.01} min={0} max={1}
            onChange={(val) => edit('intensity', val)} />
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <SeedControls layer={layer} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ParticlesSection({ layer, onFxEdit, fxValues }: { layer: Layer } & FxSectionKfProps) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-particles' }>;
  const v = (field: string, fallback: number) => fxValues ? (fxValues[field] ?? fallback) : fallback;
  const edit = (field: string, val: number) => onFxEdit ? onFxEdit(field, val) : updateSource(layer.id, layer, { [field]: val });
  return (
    <div>
      <SectionLabel text="PARTICLES" />
      <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Count" value={v('count', source.count)} step={1} min={1} max={500}
            onChange={(val) => edit('count', Math.round(val))} />
          <NumericInput label="Speed" value={v('speed', source.speed)} step={0.1} min={0} max={5}
            onChange={(val) => edit('speed', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Min" value={v('sizeMin', source.sizeMin)} step={0.5} min={0.5} max={20}
            onChange={(val) => edit('sizeMin', val)} />
          <NumericInput label="Max" value={v('sizeMax', source.sizeMax)} step={0.5} min={0.5} max={20}
            onChange={(val) => edit('sizeMax', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <SeedControls layer={layer} />
          </div>
          <div class="flex-1" />
        </div>
      </div>
    </div>
  );
}

function LinesSection({ layer, onFxEdit, fxValues }: { layer: Layer } & FxSectionKfProps) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-lines' }>;
  const v = (field: string, fallback: number) => fxValues ? (fxValues[field] ?? fallback) : fallback;
  const edit = (field: string, val: number) => onFxEdit ? onFxEdit(field, val) : updateSource(layer.id, layer, { [field]: val });
  return (
    <div>
      <SectionLabel text="LINES" />
      <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Count" value={v('count', source.count)} step={1} min={1} max={100}
            onChange={(val) => edit('count', Math.round(val))} />
          <NumericInput label="Thick" value={v('thickness', source.thickness)} step={0.5} min={0.5} max={5}
            onChange={(val) => edit('thickness', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Min" value={v('lengthMin', source.lengthMin)} step={0.01} min={0} max={1}
            onChange={(val) => edit('lengthMin', val)} />
          <NumericInput label="Max" value={v('lengthMax', source.lengthMax)} step={0.01} min={0} max={1}
            onChange={(val) => edit('lengthMax', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <SeedControls layer={layer} />
          </div>
          <div class="flex-1" />
        </div>
      </div>
    </div>
  );
}

function DotsSection({ layer, onFxEdit, fxValues }: { layer: Layer } & FxSectionKfProps) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-dots' }>;
  const v = (field: string, fallback: number) => fxValues ? (fxValues[field] ?? fallback) : fallback;
  const edit = (field: string, val: number) => onFxEdit ? onFxEdit(field, val) : updateSource(layer.id, layer, { [field]: val });
  return (
    <div>
      <SectionLabel text="DOTS" />
      <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Count" value={v('count', source.count)} step={1} min={1} max={200}
            onChange={(val) => edit('count', Math.round(val))} />
          <NumericInput label="Speed" value={v('speed', source.speed)} step={0.1} min={0} max={5}
            onChange={(val) => edit('speed', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Min" value={v('sizeMin', source.sizeMin)} step={0.5} min={1} max={20}
            onChange={(val) => edit('sizeMin', val)} />
          <NumericInput label="Max" value={v('sizeMax', source.sizeMax)} step={0.5} min={1} max={20}
            onChange={(val) => edit('sizeMax', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <SeedControls layer={layer} />
          </div>
          <div class="flex-1" />
        </div>
      </div>
    </div>
  );
}

function VignetteSection({ layer, onFxEdit, fxValues }: { layer: Layer } & FxSectionKfProps) {
  const source = layer.source as Extract<LayerSourceData, { type: 'generator-vignette' }>;
  const v = (field: string, fallback: number) => fxValues ? (fxValues[field] ?? fallback) : fallback;
  const edit = (field: string, val: number) => onFxEdit ? onFxEdit(field, val) : updateSource(layer.id, layer, { [field]: val });
  return (
    <div>
      <SectionLabel text="VIGNETTE" />
      <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Size" value={v('size', source.size)} step={0.01} min={0} max={1}
            onChange={(val) => edit('size', val)} />
          <NumericInput label="Softness" value={v('softness', source.softness)} step={0.01} min={0} max={1}
            onChange={(val) => edit('softness', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Intensity" value={v('intensity', source.intensity)} step={0.01} min={0} max={1}
            onChange={(val) => edit('intensity', val)} />
          <div class="flex-1" />
        </div>
      </div>
    </div>
  );
}

function ColorGradeSection({ layer, onFxEdit, fxValues }: { layer: Layer } & FxSectionKfProps) {
  const [tintPickerOpen, setTintPickerOpen] = useState(false);
  const source = layer.source as Extract<LayerSourceData, { type: 'adjustment-color-grade' }>;
  const v = (field: string, fallback: number) => fxValues ? (fxValues[field] ?? fallback) : fallback;

  const handlePresetChange = (presetName: string) => {
    const preset = COLOR_GRADE_PRESETS[presetName];
    if (preset) {
      updateSource(layer.id, layer, { ...preset, preset: presetName });
    }
  };

  const handleParamChange = (field: string, value: number | string) => {
    if (typeof value === 'number' && onFxEdit) {
      onFxEdit(field, value);
    } else {
      // When user manually adjusts a parameter, set preset to 'none'
      updateSource(layer.id, layer, { [field]: value, preset: 'none' });
    }
  };

  return (
    <div>
      <SectionLabel text="COLOR GRADE" />
      <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
        {/* Preset dropdown (full-width) */}
        <select
          class="w-full text-[11px] bg-(--color-bg-input) text-(--color-text-button) rounded px-2 py-[5px] outline-none cursor-pointer"
          value={source.preset}
          onChange={(e) => handlePresetChange((e.target as HTMLSelectElement).value)}
        >
          {PRESET_NAMES.map((name) => (
            <option key={name} value={name}>
              {capitalize(name)}
            </option>
          ))}
        </select>

        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Bright" value={v('brightness', source.brightness)} step={0.1} min={-1} max={1}
            onChange={(val) => handleParamChange('brightness', val)} />
          <NumericInput label="Contrast" value={v('contrast', source.contrast)} step={0.1} min={-1} max={1}
            onChange={(val) => handleParamChange('contrast', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Sat" value={v('saturation', source.saturation)} step={0.1} min={-1} max={1}
            onChange={(val) => handleParamChange('saturation', val)} />
          <NumericInput label="Hue" value={v('hue', source.hue)} step={1} min={-180} max={180}
            onChange={(val) => handleParamChange('hue', val)} />
        </div>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Fade" value={v('fade', source.fade)} step={0.1} min={0} max={1}
            onChange={(val) => handleParamChange('fade', val)} />
          <div class="flex-1" />
        </div>

        {/* Tint color picker (full-width) */}
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-(--color-text-muted) whitespace-nowrap">Tint</span>
          <div
            class="w-6 h-6 rounded cursor-pointer border border-(--color-border-subtle)"
            style={{ backgroundColor: source.tintColor || '#000000' }}
            onClick={() => setTintPickerOpen(true)}
            title="Pick tint color"
          />
          {tintPickerOpen && (
            <ColorPickerModal
              color={source.tintColor || '#000000'}
              onCommit={(c) => handleParamChange('tintColor', c)}
              onClose={() => setTintPickerOpen(false)}
            />
          )}
        </div>

        {/* Fade blend mode dropdown (full-width) */}
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-(--color-text-muted) whitespace-nowrap">Fade Blend</span>
          <select
            class="w-full text-[10px] bg-(--color-bg-input) text-(--color-text-button) rounded px-1 py-[3px] outline-none cursor-pointer"
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
    </div>
  );
}

function BlurSection({ layer, onFxEdit, fxValues }: { layer: Layer } & FxSectionKfProps) {
  const source = layer.source as Extract<LayerSourceData, { type: 'adjustment-blur' }>;
  const v = (field: string, fallback: number) => fxValues ? (fxValues[field] ?? fallback) : fallback;
  const edit = (field: string, val: number) => onFxEdit ? onFxEdit(field, val) : updateSource(layer.id, layer, { [field]: val });
  return (
    <div>
      <SectionLabel text="BLUR" />
      <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
        <div class="flex items-center" style={{ gap: '16px' }}>
          <NumericInput label="Radius" value={v('radius', source.radius)} step={0.01} min={0} max={1}
            onChange={(val) => edit('radius', val)} />
          <div class="flex-1" />
        </div>
      </div>
    </div>
  );
}

// ---- GLSL Shader Preview Modal ----

function GlslPreviewModal({
  shader,
  layer,
  onParamChange,
  onParamsChange,
  onClose,
}: {
  shader: ShaderDefinition;
  layer: Layer;
  onParamChange: (key: string, val: number) => void;
  onParamsChange: (updates: Record<string, number>) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startTime = useRef(performance.now());
  const source = layer.source as { params: Record<string, number> };
  const [modalColorGroup, setModalColorGroup] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let running = true;
    if (shader.category === 'generator') {
      const animate = () => {
        if (!running) return;
        const t = (performance.now() - startTime.current) / 1000;
        renderShaderPreview(shader, canvas, 640, 400, source.params, t);
        animRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      const captured = getCapturedCanvas();
      if (captured) {
        const glCanvas = renderGlslFxImage(shader, captured, 640, 400, source.params, 0, 0);
        if (glCanvas) {
          canvas.width = 640;
          canvas.height = 400;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(glCanvas, 0, 0, 640, 400);
        }
      }
    }

    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [shader, source.params]);

  const renderedColorGroups = new Set<string>();
  const modeParam = shader.params.find(p => p.key === 'mode');
  const currentMode = modeParam ? (source.params.mode ?? modeParam.default) : -1;

  return (
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div class="bg-(--color-bg-section-header) rounded-lg border border-(--color-border-subtle) shadow-2xl overflow-hidden" style={{ width: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Preview */}
        <div class="relative">
          <canvas
            ref={canvasRef}
            width={640}
            height={400}
            class="w-full block"
            style={{ aspectRatio: '640/400' }}
          />
          <button
            class="absolute top-2 right-2 p-1.5 rounded bg-black/50 text-white hover:bg-black/70 cursor-pointer"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Shader info */}
        <div class="px-5 py-3 border-b border-(--color-border-subtle)">
          <div class="text-[15px] text-(--color-text-button) font-semibold">{shader.name}</div>
          <div class="text-[12px] text-(--color-text-dim) mt-0.5">{shader.description}</div>
          <div class="flex items-center gap-3 mt-1">
            {shader.author && <span class="text-[11px] text-(--color-text-muted)">Created by {shader.author}</span>}
            {shader.url && (
              <a href={shader.url} target="_blank" rel="noopener noreferrer"
                class="text-[11px] text-[#8B5CF6] hover:underline cursor-pointer"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); import('@tauri-apps/api/core').then(m => m.invoke('export_open_in_finder', { path: shader.url! })); }}
              >Shadertoy</a>
            )}
          </div>
        </div>

        {/* Parameters — directly editing the layer */}
        {shader.params.length > 0 && (
          <div class="px-5 py-4 space-y-3">
            <div class="text-[9px] text-(--color-text-dim) font-semibold">PARAMETERS</div>
            {shader.params.map((p) => {
              if (p.hidden) return null;

              if (p.colorGroup) {
                if (renderedColorGroups.has(p.colorGroup)) return null;
                renderedColorGroups.add(p.colorGroup);
                if (p.colorGroup === 'tint' && (currentMode < 0.5 || currentMode > 1.5)) return null;
                if ((p.colorGroup === 'shadow' || p.colorGroup === 'highlight') && currentMode < 1.5) return null;
                const gp = shader.params.filter(g => g.colorGroup === p.colorGroup);
                if (gp.length !== 3) return null;
                const hex = rgbToHex(
                  source.params[gp[0].key] ?? gp[0].default,
                  source.params[gp[1].key] ?? gp[1].default,
                  source.params[gp[2].key] ?? gp[2].default,
                );
                return (
                  <div key={p.colorGroup} class="flex items-center gap-2">
                    <span class="text-[11px] text-(--color-text-muted) w-24 shrink-0">{p.label}</span>
                    <div
                      class="w-7 h-7 rounded cursor-pointer border border-(--color-border-subtle)"
                      style={{ backgroundColor: hex }}
                      onClick={() => setModalColorGroup(modalColorGroup === p.colorGroup ? null : p.colorGroup!)}
                    />
                    {modalColorGroup === p.colorGroup && (
                      <ColorPickerModal
                        color={hex}
                        onCommit={(c) => {
                          const [r, g, b] = hexToRgb(c);
                          onParamsChange({ [gp[0].key]: r, [gp[1].key]: g, [gp[2].key]: b });
                          setModalColorGroup(null);
                        }}
                        onClose={() => setModalColorGroup(null)}
                      />
                    )}
                  </div>
                );
              }

              const val = source.params[p.key] ?? p.default;
              const isMode = p.key === 'mode';
              const modeLabel = isMode ? modeLabelForValue(val) : null;
              return (
                <div key={p.key} class="flex items-center gap-3">
                  <span class="text-[11px] text-(--color-text-muted) w-24 shrink-0 truncate">
                    {modeLabel ?? p.label}
                  </span>
                  <input
                    type="range"
                    min={p.min ?? 0}
                    max={p.max ?? 1}
                    step={p.step ?? 0.01}
                    value={val}
                    class="flex-1 h-1 accent-[#8B5CF6] cursor-pointer"
                    onInput={(e) => onParamChange(p.key, parseFloat((e.target as HTMLInputElement).value))}
                  />
                  <span class="text-[11px] text-(--color-text-button) w-14 text-right">
                    {isMode ? (modeLabel ?? '') : val.toFixed(p.step && p.step >= 1 ? 0 : p.step && p.step >= 0.1 ? 1 : p.step && p.step >= 0.01 ? 2 : 4)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Close button */}
        <div class="px-5 py-3 border-t border-(--color-border-subtle)">
          <button
            class="w-full py-2 rounded-md bg-[#8B5CF6] text-white text-[12px] font-semibold hover:brightness-110 transition-colors cursor-pointer"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Convert RGB floats (0-1) to hex string */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convert hex string to RGB floats (0-1) */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

/** Mode label for the B&W filter */
function modeLabelForValue(val: number): string {
  if (val < 0.5) return 'Grayscale';
  if (val < 1.5) return 'Monotone';
  return 'Duotone';
}

function GlslSection({ layer, onFxEdit, fxValues }: { layer: Layer } & FxSectionKfProps) {
  const [openColorGroup, setOpenColorGroup] = useState<string | null>(null);
  const source = layer.source as { shaderId: string; params: Record<string, number> };
  const shaderDef = getShaderById(source.shaderId);
  if (!shaderDef) return <div class="text-[10px] text-(--color-text-muted)">Unknown shader: {source.shaderId}</div>;

  const v = (field: string, fallback: number) => fxValues ? (fxValues[field] ?? fallback) : fallback;

  const editGlslParam = (field: string, val: number) => {
    if (onFxEdit) {
      onFxEdit(field, val);
    } else {
      layerStore.updateLayer(layer.id, {
        source: { ...layer.source, params: { ...source.params, [field]: val } } as LayerSourceData,
      });
    }
  };

  const editGlslParams = (updates: Record<string, number>) => {
    layerStore.updateLayer(layer.id, {
      source: { ...layer.source, params: { ...source.params, ...updates } } as LayerSourceData,
    });
  };

  // Get current mode value for conditional rendering
  const modeParam = shaderDef.params.find(p => p.key === 'mode');
  const currentMode = modeParam ? v('mode', source.params.mode ?? modeParam.default) : -1;

  // Collect color groups (already seen)
  const renderedColorGroups = new Set<string>();

  // Build visible items: sliders and color pickers
  type VisibleItem =
    | { kind: 'slider'; key: string; label: string; value: number; min: number; max: number; step: number }
    | { kind: 'color'; group: string; label: string; hex: string; groupParams: typeof shaderDef.params };

  const items: VisibleItem[] = [];
  for (const p of shaderDef.params) {
    if (p.hidden) continue;
    if (p.colorGroup) {
      if (renderedColorGroups.has(p.colorGroup)) continue;
      renderedColorGroups.add(p.colorGroup);
      if (p.colorGroup === 'tint' && (currentMode < 0.5 || currentMode > 1.5)) continue;
      if ((p.colorGroup === 'shadow' || p.colorGroup === 'highlight') && currentMode < 1.5) continue;
      const gp = shaderDef.params.filter(g => g.colorGroup === p.colorGroup);
      if (gp.length !== 3) continue;
      const hex = rgbToHex(
        v(gp[0].key, source.params[gp[0].key] ?? gp[0].default),
        v(gp[1].key, source.params[gp[1].key] ?? gp[1].default),
        v(gp[2].key, source.params[gp[2].key] ?? gp[2].default),
      );
      items.push({ kind: 'color', group: p.colorGroup, label: p.label, hex, groupParams: gp });
    } else {
      const val = v(p.key, source.params[p.key] ?? p.default);
      const isMode = p.key === 'mode';
      items.push({ kind: 'slider', key: p.key, label: isMode ? modeLabelForValue(val) : p.label, value: val, min: p.min ?? 0, max: p.max ?? 1, step: p.step ?? 0.01 });
    }
  }

  // Pair items into 2-column rows
  const rows: VisibleItem[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div>
      <SectionLabel text={shaderDef.name.toUpperCase()} />
      <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
        {rows.map((row, ri) => (
          <div key={ri} class="flex items-center" style={{ gap: '16px' }}>
            {row.map((item) => {
              if (item.kind === 'slider') {
                return (
                  <NumericInput
                    key={item.key}
                    label={item.label}
                    value={item.value}
                    step={item.step}
                    min={item.min}
                    max={item.max}
                    onChange={(val) => editGlslParam(item.key, val)}
                  />
                );
              } else {
                return (
                  <div key={item.group} class="flex items-center gap-1 flex-1 min-w-0">
                    <span class="text-[10px] text-(--color-text-muted) whitespace-nowrap">{item.label}</span>
                    <div
                      class="w-6 h-6 rounded cursor-pointer border border-(--color-border-subtle)"
                      style={{ backgroundColor: item.hex }}
                      onClick={() => setOpenColorGroup(openColorGroup === item.group ? null : item.group)}
                      title={`Pick ${item.label.toLowerCase()} color`}
                    />
                    {openColorGroup === item.group && (
                      <ColorPickerModal
                        color={item.hex}
                        onCommit={(c) => {
                          const [r, g, b] = hexToRgb(c);
                          editGlslParams({ [item.groupParams[0].key]: r, [item.groupParams[1].key]: g, [item.groupParams[2].key]: b });
                          setOpenColorGroup(null);
                        }}
                        onClose={() => setOpenColorGroup(null)}
                      />
                    )}
                  </div>
                );
              }
            })}
            {row.length === 1 && <div class="flex-1" />}
          </div>
        ))}

        {/* Open Shader Preview button */}
        <button
          class="w-full py-1.5 rounded-md bg-[#8B5CF6] text-white text-[11px] font-semibold hover:brightness-110 transition-colors cursor-pointer mt-1"
          onClick={() => {
            capturePreviewCanvas();
            setPreviewOpen(true);
          }}
        >
          Open Shader Preview
        </button>
      </div>

      {/* Shader Preview Modal */}
      {previewOpen && (
        <GlslPreviewModal
          shader={shaderDef}
          layer={layer}
          onParamChange={editGlslParam}
          onParamsChange={editGlslParams}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

// ---- Dispatch: select the right FX section based on source type ----

function FxSection({ layer, onFxEdit, fxValues }: { layer: Layer } & FxSectionKfProps) {
  switch (layer.source.type) {
    case 'generator-grain':
      return <GrainSection layer={layer} onFxEdit={onFxEdit} fxValues={fxValues} />;
    case 'generator-particles':
      return <ParticlesSection layer={layer} onFxEdit={onFxEdit} fxValues={fxValues} />;
    case 'generator-lines':
      return <LinesSection layer={layer} onFxEdit={onFxEdit} fxValues={fxValues} />;
    case 'generator-dots':
      return <DotsSection layer={layer} onFxEdit={onFxEdit} fxValues={fxValues} />;
    case 'generator-vignette':
      return <VignetteSection layer={layer} onFxEdit={onFxEdit} fxValues={fxValues} />;
    case 'adjustment-color-grade':
      return <ColorGradeSection layer={layer} onFxEdit={onFxEdit} fxValues={fxValues} />;
    case 'adjustment-blur':
      return <BlurSection layer={layer} onFxEdit={onFxEdit} fxValues={fxValues} />;
    case 'generator-glsl':
    case 'adjustment-glsl':
      return <GlslSection layer={layer} onFxEdit={onFxEdit} fxValues={fxValues} />;
    default:
      return null;
  }
}

export function SidebarFxProperties({ layer, fxSequenceId }: { layer: Layer; fxSequenceId: string | null }) {
  // Keyframe display values logic (same pattern as SidebarProperties)
  const kfDisplayValues = keyframeStore.displayValues.value;
  const hasKeyframes = layer.keyframes && layer.keyframes.length > 0;
  const showKfValues = hasKeyframes && kfDisplayValues && kfDisplayValues.sourceOverrides;
  const isOnKf = keyframeStore.isOnKeyframe.value;

  // Keyframe-aware FX source property edit handler
  const isGlsl = layer.source.type === 'generator-glsl' || layer.source.type === 'adjustment-glsl';
  const handleFxKeyframeEdit = hasKeyframes ? (field: string, value: number) => {
    if (isOnKf) {
      // ON a keyframe: update layer source AND update keyframe values
      if (isGlsl) {
        const src = layer.source as { params: Record<string, number> };
        layerStore.updateLayer(layer.id, {
          source: { ...layer.source, params: { ...src.params, [field]: value } } as LayerSourceData,
        });
      } else {
        updateSource(layer.id, layer, { [field]: value });
      }
      keyframeStore.addKeyframe(layer.id, timelineStore.currentFrame.peek());
    } else {
      // BETWEEN keyframes: transient edit only
      keyframeStore.setTransientSourceValue(field, value);
    }
  } : undefined;

  // Keyframe-aware opacity edit handler
  const handleOpacityKeyframeEdit = hasKeyframes ? (value: number) => {
    if (isOnKf) {
      layerStore.updateLayer(layer.id, { opacity: value });
      keyframeStore.addKeyframe(layer.id, timelineStore.currentFrame.peek());
    } else {
      keyframeStore.setTransientValue('opacity', value);
    }
  } : undefined;

  const fxOpacityPercent = Math.round(
    (showKfValues && kfDisplayValues ? kfDisplayValues.opacity : layer.opacity) * 100,
  );

  // For FX layers, read visibility from the sequence (single source of truth)
  const fxIsVisible = fxSequenceId
    ? sequenceStore.sequences.value.find((s) => s.id === fxSequenceId)?.visible !== false
    : layer.visible;

  // Keyframe selection clearing on frame change (same pattern as SidebarProperties)
  useEffect(() => {
    void timelineStore.displayFrame.value;
    keyframeStore.clearSelection();
  }, [timelineStore.displayFrame.value]);

  // Check if any keyframe diamonds are selected (for interpolation swap)
  const hasSelectedDiamonds = keyframeStore.selectedKeyframeFrames.value.size > 0;

  return (
    <div class="px-3 py-2 space-y-3">
      {/* Keyframe nav bar (same layout as SidebarProperties) */}
      <div class="flex items-center gap-3">
        <span class="shrink-0" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sidebar-text-secondary)' }}>Key</span>
        <KeyframeNavBar layer={layer} />
      </div>

      {/* Opacity + Visibility (or InlineInterpolation when diamond selected) */}
      {hasSelectedDiamonds ? (
        <InlineInterpolation />
      ) : (
        <div>
          <div class="flex items-center justify-between">
            <SectionLabel text="OPACITY" />
            {/* Visibility toggle */}
            <button
              class="text-(--color-text-muted) hover:text-(--color-text-button) transition-colors p-0.5"
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
          <div class="flex items-center gap-1.5" style={{ marginTop: '6px' }}>
            <input
              type="range"
              min="0"
              max="100"
              value={fxOpacityPercent}
              class="flex-1 h-1 accent-(--color-accent) cursor-pointer"
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
                if (handleOpacityKeyframeEdit) {
                  handleOpacityKeyframeEdit(val);
                } else {
                  layerStore.updateLayer(layer.id, { opacity: val });
                }
              }}
            />
            <span class="text-[11px] text-(--color-text-button) w-8 text-right">{fxOpacityPercent}%</span>
          </div>
        </div>
      )}

      {/* Blend mode dropdown (for adjustment-blur and GLSL generator types — not FX image) */}
      {(layer.source.type === 'adjustment-blur' || layer.source.type === 'generator-glsl') && (
        <div>
          <SectionLabel text="BLEND" />
          <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
            <select
              class="w-full text-[11px] bg-(--color-bg-input) text-(--color-text-button) rounded px-2 py-[3px] outline-none cursor-pointer"
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
        </div>
      )}

      {/* FX-specific controls */}
      <FxSection
        layer={layer}
        onFxEdit={handleFxKeyframeEdit}
        fxValues={showKfValues ? kfDisplayValues!.sourceOverrides : undefined}
      />

      {/* Generator blur radius */}
      {isGeneratorLayer(layer) && (
        <div>
          <SectionLabel text="BLUR" />
          <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
            <div class="flex items-center" style={{ gap: '16px' }}>
              <NumericInput
                label="Radius"
                value={layer.blur ?? 0}
                step={0.01}
                min={0}
                max={1}
                onChange={(val) => layerStore.updateLayer(layer.id, { blur: val })}
              />
              <div class="flex-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
