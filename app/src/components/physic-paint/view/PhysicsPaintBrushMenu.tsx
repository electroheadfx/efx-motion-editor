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

import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { signal, type Signal } from '@preact/signals';
import { Maximize2 } from 'lucide-preact';
import { BRUSH_PRESETS } from '@efxlab/efx-watercolor';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';
import {
  aquarelleBrushMenuAnchor,
  aquarelleBrushMenuOpen,
  aquarelleBrushMenuTarget,
  aquarelleLiftTipId,
  aquarelleSelectedTipId,
  selectAquarelleTip,
  setAquarelleBrushMenuOpen,
  setAquarelleBrushModalOpen,
  setAquarelleLiftTipId,
} from './aquarelleRecordState';
// 261029-hy2 CR-01: the catalog's open path must raise its sheet — the seat
// sits UNDER the Settings sheet, so click-to-front alone can never reach it.
import { SHEET_ID_BRUSHES, bringSheetToFront } from './floatingSheetStack';
import { WatercolorBrushThumb } from './WatercolorBrushLibrary';

export function PhysicsPaintBrushMenu() {
  const open = aquarelleBrushMenuOpen.value;
  const anchor = aquarelleBrushMenuAnchor.value;
  const selectedId = aquarelleSelectedTipId.value;
  // 261029-hy2: one popover, two tools. Captured at open time by the trigger;
  // never written here. The lift tip is its own selection (Filbert fallback),
  // completely independent of the brush selection.
  const menuTarget = aquarelleBrushMenuTarget.value;
  const liftTipId = aquarelleLiftTipId.value ?? 'filbert';
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // The catalog's own height, measured once the menu has a definite box. Kept
  // in a ref-held signal (never written during render).
  const naturalHeightRef = useRef<Signal<number | null> | null>(null);
  if (naturalHeightRef.current === null) naturalHeightRef.current = signal<number | null>(null);
  const naturalHeight = naturalHeightRef.current.value;

  // 261027-gh9i: size to the catalog when it fits — the full available height
  // is only the ceiling for an overflowing list. Measuring (not constants)
  // keeps the chrome and row heights in CSS as the single source.
  useLayoutEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const menu = menuRef.current;
    const scroller = list?.parentElement ?? null;
    if (!list || !menu || !scroller) return;
    const chrome = menu.offsetHeight - scroller.clientHeight;
    const measured = Math.ceil(chrome + list.offsetHeight);
    const current = naturalHeightRef.current!;
    if (current.value !== measured) current.value = measured;
  }, [open, anchor?.top]);

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
  // viewport edge. A DEFINITE height is required: the SidebarScrollArea's
  // scroller is absolutely positioned, so with only a max-height the flex
  // child collapses to zero and the brush list disappears.
  const availableHeight = Math.max(240, viewportHeight - anchor.top - 8);
  // No empty sheet below the last brush: when every row fits, the menu is only
  // as tall as its content; the available height is the scroll ceiling.
  const menuHeight = naturalHeight === null
    ? availableHeight
    : Math.min(availableHeight, naturalHeight);

  return (
    <div
      ref={menuRef}
      class="physics-paint-brush-menu"
      role="menu"
      aria-label={menuTarget === 'lift' ? 'Eraser shapes' : 'Brushes'}
      data-testid="watercolor-brush-menu"
      style={{ left: `${left}px`, top: `${anchor.top}px`, height: `${menuHeight}px` }}
    >
      {menuTarget === 'lift' ? (
        // 261029-hy2 menu-branch:lift
        // The Eraser popover: the same 15 painted shapes, NO "Open modal" (the
        // catalog's cards route through the BRUSH pick path, which would flip
        // the tool back to Brush) and no separator. A pick writes the lift tip
        // through setAquarelleLiftTipId — never the brush seam.
        <SidebarScrollArea class="physics-paint-brush-menu-scroll" interactive>
          <div ref={listRef} class="physics-paint-brush-menu-list">
            {BRUSH_PRESETS.map((preset) => {
              const selected = preset.id === liftTipId;
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
                    setAquarelleLiftTipId(preset.id);
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
      ) : (
        // 261029-hy2 menu-branch:brush
        <>
          <button
            type="button"
            class="physics-paint-brush-menu-open-modal"
            data-testid="watercolor-brush-menu-open-modal"
            onClick={() => {
              setAquarelleBrushMenuOpen(false);
              // 261029-hy2 CR-01: raise BEFORE opening (event handler only).
              // Unconditional, so an already-open-but-covered catalog recovers.
              bringSheetToFront(SHEET_ID_BRUSHES);
              setAquarelleBrushModalOpen(true);
            }}
          >
            <Maximize2 size={13} aria-hidden="true" />
            Open modal
          </button>
          <div class="physics-paint-brush-menu-separator" aria-hidden="true" />
          <SidebarScrollArea class="physics-paint-brush-menu-scroll" interactive>
            <div ref={listRef} class="physics-paint-brush-menu-list">
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
        </>
      )}
    </div>
  );
}
