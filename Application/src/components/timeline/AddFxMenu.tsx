import {useState, useEffect, useRef} from 'preact/hooks';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
import {defaultTransform, createDefaultFxSource} from '../../types/layer';
import type {LayerType, BlendMode, Layer} from '../../types/layer';
import {totalFrames} from '../../lib/frameMap';

/** Popover menu for adding FX sequences (Generators & Adjustments) in the timeline area */
export function AddFxMenu() {
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

  return (
    <div class="relative" ref={menuRef}>
      <button
        class="rounded px-2 py-[5px] bg-[var(--color-bg-input)] hover:bg-[#333] transition-colors"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span class="text-[10px] text-[var(--color-text-secondary)]">+ FX</span>
      </button>

      {menuOpen && (
        <div class="absolute right-0 bottom-8 z-50 bg-[#1E1E1E] border border-[#333] rounded-md shadow-xl py-1 min-w-[160px]">
          {/* Generators section */}
          <div class="px-3 py-1 text-[9px] text-[var(--color-text-dim)] font-semibold">GENERATORS</div>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-grain', 'Film Grain', 'screen')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Film Grain
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-particles', 'Particles', 'screen')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Particles
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-lines', 'Lines', 'screen')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Lines
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-dots', 'Dots', 'screen')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Dots
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] flex items-center gap-2"
            onClick={() => handleAddFxLayer('generator-vignette', 'Vignette')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#EC4899] shrink-0" />
            Vignette
          </button>

          {/* Adjustments section */}
          <div class="border-t border-[#333] my-1" />
          <div class="px-3 py-1 text-[9px] text-[var(--color-text-dim)] font-semibold">ADJUSTMENTS</div>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] flex items-center gap-2"
            onClick={() => handleAddFxLayer('adjustment-color-grade', 'Color Grade')}
          >
            <span class="w-2 h-2 rounded-sm bg-[#F97316] shrink-0" />
            Color Grade
          </button>
        </div>
      )}
    </div>
  );
}
