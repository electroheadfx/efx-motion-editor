import {useState, useEffect, useRef} from 'preact/hooks';
import {Clapperboard} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
import {defaultTransform, createDefaultFxSource} from '../../types/layer';
import type {LayerType, BlendMode, Layer} from '../../types/layer';
import {totalFrames} from '../../lib/frameMap';

/** Popover menu for adding content overlay and FX sequences in the timeline area */
export function AddLayerMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleAddFxLayer = (type: LayerType, name: string, defaultBlend: BlendMode = 'normal') => {
    setMenuOpen(false);
    const layerId = crypto.randomUUID();
    const source = createDefaultFxSource(type);

    const fxLayer: Layer = {
      id: layerId,
      name,
      type,
      visible: true,
      opacity: 1,
      blendMode: defaultBlend,
      transform: defaultTransform(),
      source,
      isBase: false,
    };

    sequenceStore.createFxSequence(name, fxLayer, totalFrames.peek());
    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);
  };

  const handleAddContentLayer = (type: 'static-image' | 'image-sequence' | 'video') => {
    setMenuOpen(false);
    uiStore.setAddLayerIntent({ type, target: 'content-overlay' });
    uiStore.setEditorMode('imported');
  };

  return (
    <div class="relative" ref={menuRef}>
      <button
        class="rounded px-2 py-[5px] bg-(--color-bg-input) hover:bg-(--color-border-subtle) transition-colors"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span class="text-[10px] text-(--color-text-secondary) flex items-center gap-1"><Clapperboard size={11} /> Layer</span>
      </button>

      {menuOpen && (
        <div class="absolute right-0 bottom-8 z-50 bg-(--color-bg-menu) border border-(--color-border-subtle) rounded-md shadow-xl py-1 min-w-[160px]">
          {/* Content section */}
          <div class="px-3 py-1 text-[9px] text-(--color-text-dim) font-semibold">CONTENT</div>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={() => handleAddContentLayer('static-image')}
          >
            <span class="w-2 h-2 rounded-sm bg-(--sidebar-dot-green) shrink-0" />
            Static Image
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={() => handleAddContentLayer('image-sequence')}
          >
            <span class="w-2 h-2 rounded-sm bg-(--sidebar-dot-blue) shrink-0" />
            Image Sequence
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={() => handleAddContentLayer('video')}
          >
            <span class="w-2 h-2 rounded-sm" style="background-color: #8B5CF6" />
            Video
          </button>
          <div class="border-t border-(--color-border-subtle) my-1" />

          {/* Generators section */}
          <div class="px-3 py-1 text-[9px] text-(--color-text-dim) font-semibold">GENERATORS</div>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-grain', 'Film Grain', 'screen')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Film Grain
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-particles', 'Particles', 'screen')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Particles
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-lines', 'Lines', 'screen')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Lines
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-dots', 'Dots', 'screen')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Dots
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-vignette', 'Vignette')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Vignette
          </button>

          {/* Adjustments section */}
          <div class="border-t border-(--color-border-subtle) my-1" />
          <div class="px-3 py-1 text-[9px] text-(--color-text-dim) font-semibold">ADJUSTMENTS</div>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-(--color-text-button) hover:bg-(--color-hover-overlay) flex items-center gap-2"
            onClick={() => handleAddFxLayer('adjustment-blur', 'Blur')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#F97316] shrink-0" />
            Blur
          </button>
        </div>
      )}
    </div>
  );
}
