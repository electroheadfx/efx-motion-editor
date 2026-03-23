import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { X, Sparkles, Image, ArrowRightLeft, LayoutGrid } from 'lucide-preact';
import { uiStore } from '../../stores/uiStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { layerStore } from '../../stores/layerStore';
import { totalFrames } from '../../lib/frameMap';
import { renderShaderPreview, renderGlslFxImage, renderGlslTransition } from '../../lib/glslRuntime';
import { getAllShaders, getShadersByCategory, getDefaultParams } from '../../lib/shaderLibrary';
import { getCapturedCanvas } from '../../lib/shaderPreviewCapture';
import { defaultTransform } from '../../types/layer';
import { ColorPickerModal } from '../shared/ColorPickerModal';
import type { ShaderDefinition, ShaderCategory } from '../../lib/shaderLibrary';
import type { Layer, LayerSourceData, BlendMode } from '../../types/layer';
import type { GlTransition } from '../../types/sequence';

const PREVIEW_WIDTH = 200;
const PREVIEW_HEIGHT = 140;

// ---- Transition preview images (per D-14) ----

let _previewImageA: HTMLCanvasElement | null = null;
let _previewImageB: HTMLCanvasElement | null = null;

function getTransitionPreviewImages(): { a: HTMLCanvasElement; b: HTMLCanvasElement } {
  if (!_previewImageA) {
    _previewImageA = document.createElement('canvas');
    _previewImageA.width = PREVIEW_WIDTH;
    _previewImageA.height = PREVIEW_HEIGHT;
    const ctx = _previewImageA.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    grad.addColorStop(0, '#FF6B35');
    grad.addColorStop(1, '#D62828');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  }
  if (!_previewImageB) {
    _previewImageB = document.createElement('canvas');
    _previewImageB.width = PREVIEW_WIDTH;
    _previewImageB.height = PREVIEW_HEIGHT;
    const ctx = _previewImageB.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    grad.addColorStop(0, '#1D3557');
    grad.addColorStop(1, '#457B9D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  }
  return { a: _previewImageA, b: _previewImageB };
}

// Higher-resolution transition preview images for detail view
let _previewDetailA: HTMLCanvasElement | null = null;
let _previewDetailB: HTMLCanvasElement | null = null;

function getTransitionDetailImages(): { a: HTMLCanvasElement; b: HTMLCanvasElement } {
  if (!_previewDetailA) {
    _previewDetailA = document.createElement('canvas');
    _previewDetailA.width = 640;
    _previewDetailA.height = 400;
    const ctx = _previewDetailA.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 640, 400);
    grad.addColorStop(0, '#FF6B35');
    grad.addColorStop(1, '#D62828');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 400);
  }
  if (!_previewDetailB) {
    _previewDetailB = document.createElement('canvas');
    _previewDetailB.width = 640;
    _previewDetailB.height = 400;
    const ctx = _previewDetailB.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 640, 400);
    grad.addColorStop(0, '#1D3557');
    grad.addColorStop(1, '#457B9D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 400);
  }
  return { a: _previewDetailA, b: _previewDetailB };
}

// ---- Tab definitions ----

type TabId = ShaderCategory | 'transition' | 'all';

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof Sparkles;
  disabled?: boolean;
}

const TABS: TabDef[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'generator', label: 'Generator', icon: Sparkles },
  { id: 'fx-image', label: 'FX Image', icon: Image },
  { id: 'transition', label: 'Transition', icon: ArrowRightLeft },
];

// ---- Animated Preview Card ----

function ShaderCard({
  shader,
  isExpanded,
  onClick,
}: {
  shader: ShaderDefinition;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startTime = useRef(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let running = true;

    if (shader.category === 'generator') {
      const animate = () => {
        if (!running) return;
        const t = (performance.now() - startTime.current) / 1000;
        const params = getDefaultParams(shader);
        renderShaderPreview(shader, canvas, PREVIEW_WIDTH, PREVIEW_HEIGHT, params, t);
        animRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else if (shader.category === 'transition') {
      // Transition: animated ping-pong preview with dual gradient images (per D-14)
      const { a, b } = getTransitionPreviewImages();
      const animate = () => {
        if (!running) return;
        const elapsed = (performance.now() - startTime.current) / 1000;
        // Ping-pong: 0->1 in 1.5s, 1->0 in 1.5s (3s total cycle)
        const cycle = elapsed % 3;
        const progress = cycle < 1.5 ? cycle / 1.5 : 2 - cycle / 1.5;
        const defaultParams = getDefaultParams(shader);
        const result = renderGlslTransition(shader, a, b, progress, PREVIEW_WIDTH / PREVIEW_HEIGHT, defaultParams, PREVIEW_WIDTH, PREVIEW_HEIGHT);
        if (result) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = PREVIEW_WIDTH;
            canvas.height = PREVIEW_HEIGHT;
            ctx.drawImage(result, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
          }
        }
        animRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      // For FX image, render using captured preview canvas as input
      const capturedCanvas = getCapturedCanvas();
      if (capturedCanvas) {
        const renderFx = () => {
          if (!running) return;
          const params = getDefaultParams(shader);
          const glCanvas = renderGlslFxImage(shader, capturedCanvas, PREVIEW_WIDTH, PREVIEW_HEIGHT, params, 0, 0);
          if (glCanvas) {
            const ctx2d = canvas.getContext('2d');
            if (ctx2d) {
              canvas.width = PREVIEW_WIDTH;
              canvas.height = PREVIEW_HEIGHT;
              ctx2d.drawImage(glCanvas, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
            }
          }
        };
        renderFx(); // single render (no animation needed for static input)
      } else {
        // No captured canvas — show placeholder
        const ctx2d = canvas.getContext('2d');
        if (ctx2d) {
          canvas.width = PREVIEW_WIDTH;
          canvas.height = PREVIEW_HEIGHT;
          ctx2d.fillStyle = '#1a1a2e';
          ctx2d.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
          ctx2d.fillStyle = 'rgba(139, 92, 246, 0.5)';
          ctx2d.font = '11px system-ui';
          ctx2d.textAlign = 'center';
          ctx2d.fillText('No preview (scrub to a frame first)', PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2 + 4);
        }
      }
    }

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [shader]);

  return (
    <div
      class={`cursor-pointer rounded-lg overflow-hidden transition-all ${
        isExpanded
          ? 'ring-2 ring-[#8B5CF6] bg-[var(--color-bg-hover-item)]'
          : 'hover:ring-1 hover:ring-[var(--color-border-subtle)] bg-[var(--color-bg-input)]'
      }`}
      onClick={onClick}
    >
      <canvas
        ref={canvasRef}
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        class="w-full block"
        style={{ aspectRatio: `${PREVIEW_WIDTH}/${PREVIEW_HEIGHT}` }}
      />
      <div class="px-3 py-2">
        <div class="text-[13px] text-[var(--color-text-button)] font-semibold truncate">{shader.name}</div>
        <div class="text-[11px] text-[var(--color-text-dim)] leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{shader.description}</div>
      </div>
    </div>
  );
}

// ---- Expanded Shader Detail (params + apply) ----

function ShaderDetail({
  shader,
  onApply,
  onClose,
  applyDisabled,
}: {
  shader: ShaderDefinition;
  onApply: (params: Record<string, number>) => void;
  onClose: () => void;
  applyDisabled?: boolean;
}) {
  const [params, setParams] = useState<Record<string, number>>(() => getDefaultParams(shader));
  const [openColorGroup, setOpenColorGroup] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startTime = useRef(performance.now());

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;

    let running = true;
    if (shader.category === 'generator') {
      const animate = () => {
        if (!running) return;
        const t = (performance.now() - startTime.current) / 1000;
        renderShaderPreview(shader, canvas, 640, 400, params, t);
        animRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else if (shader.category === 'transition') {
      // Transition: animated ping-pong preview at higher resolution
      const { a, b } = getTransitionDetailImages();
      const animate = () => {
        if (!running) return;
        const elapsed = (performance.now() - startTime.current) / 1000;
        const cycle = elapsed % 3;
        const progress = cycle < 1.5 ? cycle / 1.5 : 2 - cycle / 1.5;
        const result = renderGlslTransition(shader, a, b, progress, 640 / 400, params, 640, 400);
        if (result) {
          canvas.width = 640;
          canvas.height = 400;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(result, 0, 0, 640, 400);
        }
        animRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      // FX Image: render with captured canvas as input (re-render when params change)
      const capturedCanvas = getCapturedCanvas();
      if (capturedCanvas) {
        const glCanvas = renderGlslFxImage(shader, capturedCanvas, 640, 400, params, 0, 0);
        if (glCanvas) {
          canvas.width = 640;
          canvas.height = 400;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(glCanvas, 0, 0, 640, 400);
        }
      }
    }

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [shader, params]);

  const updateParam = (key: string, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const updateParams = (updates: Record<string, number>) => {
    setParams(prev => ({ ...prev, ...updates }));
  };

  /** Convert RGB floats to hex */
  const rgbToHex = (r: number, g: number, b: number): string => {
    const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  /** Convert hex to RGB floats */
  const hexToRgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  };

  const currentMode = params.mode ?? 0;
  const renderedColorGroups = new Set<string>();

  return (
    <div class="bg-[var(--color-bg-section-header)] rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
      {/* Preview */}
      <div class="relative">
        <canvas
          ref={previewRef}
          width={640}
          height={400}
          class="w-full block"
          style={{ aspectRatio: '640/400' }}
        />
        <button
          class="absolute top-2 right-2 p-1 rounded bg-black/50 text-white hover:bg-black/70"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {/* Shader info */}
      <div class="px-5 py-3 border-b border-[var(--color-border-subtle)]">
        <div class="text-[15px] text-[var(--color-text-button)] font-semibold">{shader.name}</div>
        <div class="text-[12px] text-[var(--color-text-dim)] mt-0.5">{shader.description}</div>
        <div class="flex items-center gap-3 mt-1.5">
          {shader.author && (
            <span class="text-[11px] text-[var(--color-text-muted)]">Created by {shader.author}</span>
          )}
          {shader.url && (
            <a
              href={shader.url}
              target="_blank"
              rel="noopener noreferrer"
              class="text-[11px] text-[#8B5CF6] hover:underline cursor-pointer"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); import('@tauri-apps/api/core').then(m => m.invoke('export_open_in_finder', { path: shader.url! })); }}
            >
              Shadertoy
            </a>
          )}
        </div>
      </div>

      {/* Parameters */}
      {shader.params.length > 0 && (
        <div class="px-4 py-3 space-y-2">
          <div class="text-[9px] text-[var(--color-text-dim)] font-semibold">PARAMETERS</div>
          {shader.params.map((p) => {
            if (p.hidden) return null;

            // Color group: render color swatch
            if (p.colorGroup) {
              if (renderedColorGroups.has(p.colorGroup)) return null;
              renderedColorGroups.add(p.colorGroup);
              // Conditional visibility based on mode
              if (p.colorGroup === 'tint' && (currentMode < 0.5 || currentMode > 1.5)) return null;
              if ((p.colorGroup === 'shadow' || p.colorGroup === 'highlight') && currentMode < 1.5) return null;

              const groupParams = shader.params.filter(gp => gp.colorGroup === p.colorGroup);
              if (groupParams.length !== 3) return null;
              const hex = rgbToHex(
                params[groupParams[0].key] ?? groupParams[0].default,
                params[groupParams[1].key] ?? groupParams[1].default,
                params[groupParams[2].key] ?? groupParams[2].default,
              );
              return (
                <div key={p.colorGroup} class="flex items-center gap-2">
                  <span class="text-[10px] text-[var(--color-text-muted)] w-20 shrink-0">{p.label}</span>
                  <div
                    class="w-6 h-6 rounded cursor-pointer border border-[var(--color-border-subtle)]"
                    style={{ backgroundColor: hex }}
                    onClick={() => setOpenColorGroup(openColorGroup === p.colorGroup ? null : p.colorGroup!)}
                    title={`Pick ${p.label.toLowerCase()} color`}
                  />
                  {openColorGroup === p.colorGroup && (
                    <ColorPickerModal
                      color={hex}
                      onCommit={(c) => {
                        const [cr, cg, cb] = hexToRgb(c);
                        updateParams({ [groupParams[0].key]: cr, [groupParams[1].key]: cg, [groupParams[2].key]: cb });
                        setOpenColorGroup(null);
                      }}
                      onClose={() => setOpenColorGroup(null)}
                    />
                  )}
                </div>
              );
            }

            const val = params[p.key] ?? p.default;
            const isMode = p.key === 'mode';
            const modeLabel = isMode ? (val < 0.5 ? 'Grayscale' : val < 1.5 ? 'Monotone' : 'Duotone') : null;
            return (
              <div key={p.key} class="flex items-center gap-2">
                <span class="text-[10px] text-[var(--color-text-muted)] w-20 shrink-0 truncate">
                  {modeLabel ?? p.label}
                </span>
                <input
                  type="range"
                  min={p.min ?? 0}
                  max={p.max ?? 1}
                  step={p.step ?? 0.01}
                  value={val}
                  class="flex-1 h-1 accent-[#8B5CF6] cursor-pointer"
                  onInput={(e) => updateParam(p.key, parseFloat((e.target as HTMLInputElement).value))}
                />
                <span class="text-[10px] text-[var(--color-text-button)] w-12 text-right">
                  {isMode ? (modeLabel ?? '') : val.toFixed(p.step && p.step >= 1 ? 0 : p.step && p.step >= 0.1 ? 1 : p.step && p.step >= 0.01 ? 2 : 4)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply button */}
      <div class="px-4 py-3 border-t border-[var(--color-border-subtle)]">
        <button
          disabled={applyDisabled}
          class={`w-full py-2 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
            applyDisabled
              ? 'bg-[#8B5CF6]/30 text-white/40 cursor-not-allowed'
              : 'bg-[#8B5CF6] text-white hover:brightness-110'
          }`}
          onClick={() => !applyDisabled && onApply(params)}
          title={applyDisabled ? 'No next sequence to transition to' : undefined}
        >
          {applyDisabled ? 'Apply (no next sequence)' : 'Apply'}
        </button>
      </div>
    </div>
  );
}

// ---- Main Browser Component ----

export function ShaderBrowser() {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [expandedShader, setExpandedShader] = useState<ShaderDefinition | null>(null);

  const shaders = activeTab === 'all' ? getAllShaders() : getShadersByCategory(activeTab as ShaderCategory);

  // D-03: Compute whether Apply should be enabled for transition shaders
  const canApplyTransition = useMemo(() => {
    const activeId = sequenceStore.activeSequenceId.value;
    if (!activeId) return false;
    const contentSeqs = sequenceStore.sequences.value.filter(s => s.kind === 'content');
    const idx = contentSeqs.findIndex(s => s.id === activeId);
    return idx >= 0 && idx < contentSeqs.length - 1;
  }, [sequenceStore.activeSequenceId.value, sequenceStore.sequences.value]);

  const handleApply = useCallback((shader: ShaderDefinition, params: Record<string, number>) => {
    // D-01, D-03: Transition apply targets active sequence + next adjacent
    if (shader.category === 'transition') {
      const activeId = sequenceStore.activeSequenceId.peek();
      if (!activeId) return;
      const contentSeqs = sequenceStore.sequences.peek().filter(s => s.kind === 'content');
      const idx = contentSeqs.findIndex(s => s.id === activeId);
      if (idx < 0 || idx >= contentSeqs.length - 1) return; // D-03: disabled if no next sequence

      const glTransition: GlTransition = {
        shaderId: shader.id,
        params,
        duration: 8,  // default 8 frames overlap
        curve: 'ease-in-out',
      };
      sequenceStore.setGlTransition(activeId, glTransition);
      uiStore.selectTransition({ sequenceId: activeId, type: 'gl-transition' });
      uiStore.setEditorMode('editor');
      return;
    }

    // Existing generator/fx-image logic
    const layerId = crypto.randomUUID();
    const layerType = shader.category === 'generator' ? 'generator-glsl' : 'adjustment-glsl';
    const source: LayerSourceData = {
      type: layerType,
      shaderId: shader.id,
      params,
    } as LayerSourceData;

    const fxLayer: Layer = {
      id: layerId,
      name: shader.name,
      type: layerType,
      visible: true,
      opacity: 1,
      blendMode: (shader.defaultBlend ?? 'normal') as BlendMode,
      transform: defaultTransform(),
      source,
      isBase: false,
    };

    sequenceStore.createFxSequence(shader.name, fxLayer, totalFrames.peek());
    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);

    // Close browser (D-08)
    uiStore.setEditorMode('editor');
  }, []);

  return (
    <div class="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-root)]">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-section-header)]">
        <div class="flex items-center gap-2">
          <Sparkles size={16} class="text-[#8B5CF6]" />
          <span class="text-[13px] font-semibold text-[var(--color-text-button)]">GLSL Shaders</span>
        </div>
        <button
          class="p-1 rounded hover:bg-[var(--color-bg-hover-item)] transition-colors cursor-pointer"
          onClick={() => uiStore.setEditorMode('editor')}
        >
          <X size={16} class="text-[var(--color-text-secondary)]" />
        </button>
      </div>

      {/* Tab bar -- DaVinci Resolve-style pills */}
      <div class="flex items-center gap-1 px-4 py-2 bg-[var(--color-bg-section-header)] border-b border-[var(--color-border-subtle)]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              disabled={tab.disabled}
              class={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                tab.disabled
                  ? 'opacity-30 cursor-not-allowed text-[var(--color-text-dim)]'
                  : isActive
                    ? 'bg-[#8B5CF6] text-white'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover-item)] hover:text-[var(--color-text-button)]'
              }`}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div class="flex-1 overflow-y-auto p-4">
        {expandedShader ? (
          /* Expanded detail view */
          <div class="max-w-[680px] mx-auto">
            <ShaderDetail
              shader={expandedShader}
              onApply={(params) => handleApply(expandedShader, params)}
              onClose={() => setExpandedShader(null)}
              applyDisabled={expandedShader.category === 'transition' && !canApplyTransition}
            />
          </div>
        ) : (
          /* Grid view */
          <div class="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {shaders.map((shader) => (
              <ShaderCard
                key={shader.id}
                shader={shader}
                isExpanded={false}
                onClick={() => setExpandedShader(shader)}
              />
            ))}
            {shaders.length === 0 && (
              <div class="col-span-full text-center py-12 text-[var(--color-text-dim)] text-[12px]">
                No shaders in this category
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
