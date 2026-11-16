// ============================================================
//  quick 261116-gcn — the Textures popover.
//
//  The TEXTURE axis' pick surface, opened by the second top-bar
//  trigger inside the brush pill. "Open modal" is the FIRST action
//  and hands off to the floating Textures sheet; below it sits the
//  compact WatercolorTextureStrip (moved here out of the brush
//  dropdown in the same quick).
//
//  The law: a chip pick writes aquarelleSelectedTextureId ONLY and
//  KEEPS the popover open — the user may pick a texture and then a
//  response. The response selection is untouched.
//
//  Fixed positioning is deliberate: the top bar is an
//  overflow-x:auto scroller, so an absolutely positioned child
//  would be clipped. No measured height here — the strip wraps and
//  the surface scrolls inside its viewport clamp.
// ============================================================

import { useEffect, useRef } from 'preact/hooks';
import { Maximize2 } from 'lucide-preact';
import {
  aquarelleTextureMenuAnchor,
  aquarelleTextureMenuOpen,
  setAquarelleTextureMenuOpen,
  setAquarelleTextureModalOpen,
} from './aquarelleRecordState';
// quick 261116-gcn: the sheet must be RAISED before it opens (event handler
// only) — the Textures seat can sit under a sibling sheet.
import { SHEET_ID_TEXTURES, bringSheetToFront } from './floatingSheetStack';
import { WatercolorTextureStrip } from './WatercolorTextureStrip';

export function PhysicsPaintTextureMenu() {
  // Narrow signal reads (efx-preact-reactivity rule 5): one read per signal
  // per render body, no writes here.
  const open = aquarelleTextureMenuOpen.value;
  const anchor = aquarelleTextureMenuAnchor.value;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      // The trigger owns its own toggle — its click must not race this close.
      if (target instanceof Element && target.closest('[data-watercolor-texture-trigger]')) return;
      setAquarelleTextureMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAquarelleTextureMenuOpen(false);
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
  // Same viewport clamp as the brush popover (212px wide + 8px gutter).
  const left = Math.max(8, Math.min(anchor.left, viewportWidth - 220));
  // The Open modal action plus at least two chip rows must stay reachable.
  const maxHeight = Math.max(120, viewportHeight - anchor.top - 8);

  return (
    <div
      ref={menuRef}
      class="physics-paint-texture-menu"
      role="menu"
      aria-label="Textures"
      data-testid="physics-texture-menu"
      style={{ left: `${left}px`, top: `${anchor.top}px`, maxHeight: `${maxHeight}px` }}
    >
      <button
        type="button"
        class="physics-paint-brush-menu-open-modal"
        data-testid="physics-texture-menu-open-modal"
        onClick={() => {
          setAquarelleTextureMenuOpen(false);
          // Raise BEFORE opening (event handler only). Unconditional, so an
          // already-open-but-covered sheet recovers.
          bringSheetToFront(SHEET_ID_TEXTURES);
          setAquarelleTextureModalOpen(true);
        }}
      >
        <Maximize2 size={13} aria-hidden="true" />
        Open modal
      </button>
      <div class="physics-paint-brush-menu-separator" aria-hidden="true" />
      <div class="physics-paint-texture-menu-strip">
        <WatercolorTextureStrip compact />
      </div>
    </div>
  );
}
