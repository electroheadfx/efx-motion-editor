// ============================================================
//  261027-gh9g — the top-bar brush dropdown.
//
//  The Studio's single brush surface (the right sidebar's Brush tab
//  is retired): the large top-bar brush trigger opens this fixed
//  popover, anchored under the trigger. "Open modal" is the FIRST
//  action and hands off to the floating catalog; picking a brush
//  selects it (aquarelleSelectedTipId) and closes the menu.
//
//  Fixed positioning is deliberate: the top bar is an
//  overflow-x:auto scroller, so an absolutely positioned child
//  would be clipped.
// ============================================================

import { useEffect, useRef } from 'preact/hooks';
import { Maximize2 } from 'lucide-preact';
import { BRUSH_PRESETS } from '@efxlab/efx-watercolor';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';
import {
  aquarelleBrushMenuAnchor,
  aquarelleBrushMenuOpen,
  aquarelleSelectedTipId,
  selectAquarelleTip,
  setAquarelleBrushMenuOpen,
  setAquarelleBrushModalOpen,
} from './aquarelleRecordState';
import { WatercolorBrushThumb } from './WatercolorBrushLibrary';

export function PhysicsPaintBrushMenu() {
  const open = aquarelleBrushMenuOpen.value;
  const anchor = aquarelleBrushMenuAnchor.value;
  const selectedId = aquarelleSelectedTipId.value;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      // The trigger owns its own toggle — its click must not race this close.
      if (target instanceof Element && target.closest('[data-watercolor-brush-trigger]')) return;
      setAquarelleBrushMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAquarelleBrushMenuOpen(false);
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  if (!open || anchor === null) return null;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const left = Math.max(8, Math.min(anchor.left, viewportWidth - 308));
  // 261027-gh9h: the menu uses every pixel from the trigger down to the
  // viewport edge. With the enlarged rows the catalog overflows on most
  // windows; the custom EFX scrollbar (never the OS one) takes the rest.
  const availableHeight = Math.max(240, viewportHeight - anchor.top - 8);

  return (
    <div
      ref={menuRef}
      class="physics-paint-brush-menu"
      role="menu"
      aria-label="Brushes"
      data-testid="watercolor-brush-menu"
      style={{ left: `${left}px`, top: `${anchor.top}px`, maxHeight: `${availableHeight}px` }}
    >
      <button
        type="button"
        class="physics-paint-brush-menu-open-modal"
        data-testid="watercolor-brush-menu-open-modal"
        onClick={() => {
          setAquarelleBrushMenuOpen(false);
          setAquarelleBrushModalOpen(true);
        }}
      >
        <Maximize2 size={13} aria-hidden="true" />
        Open modal
      </button>
      <div class="physics-paint-brush-menu-separator" aria-hidden="true" />
      <SidebarScrollArea class="physics-paint-brush-menu-scroll" interactive>
        <div class="physics-paint-brush-menu-list">
          {BRUSH_PRESETS.map((preset) => {
            const selected = preset.id === selectedId;
            return (
              <button
                key={preset.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                class={`physics-paint-brush-menu-item${selected ? ' active' : ''}`}
                data-testid={`watercolor-brush-menu-item-${preset.id}`}
                title={preset.hint}
                onClick={() => {
                  selectAquarelleTip(preset.id);
                  setAquarelleBrushMenuOpen(false);
                }}
              >
                <WatercolorBrushThumb
                  presetId={preset.id}
                  class="physics-paint-brush-menu-thumb"
                />
                <span class="physics-paint-brush-menu-name">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </SidebarScrollArea>
    </div>
  );
}
