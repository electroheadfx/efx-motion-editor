// ============================================================
//  261027-gh9g — the floating brush catalog.
//
//  Opened from the top-bar dropdown's "Open modal" action. It
//  reuses the Move-edit (Stroke settings) dialog mechanics: header
//  drag, bottom-edge vertical resize, window-bounded positioning,
//  and the shared rounded-square close chrome. Picking a brush
//  only selects it — the modal stays open and movable.
//
//  The surface is deliberately more transparent than the Move-edit
//  sheet (liquid-glass ::before over a 0.55 panel) so the canvas
//  paint reads through it.
// ============================================================

import { useEffect, useRef } from 'preact/hooks';
import type { CSSProperties, TargetedPointerEvent } from 'preact';
import { signal } from '@preact/signals';
import { Paintbrush, X } from 'lucide-preact';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';
import {
  aquarelleBrushModalOpen,
  setAquarelleBrushModalOpen,
} from './aquarelleRecordState';
import {
  SHEET_ID_BRUSHES,
  bringSheetToFront,
  closeSheetIfFront,
  sheetZIndex,
} from './floatingSheetStack';
import { WatercolorBrushLibrary } from './WatercolorBrushLibrary';

interface DragOffset {
  readonly dxPx: number;
  readonly dyPx: number;
}

interface DragStart {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly baseX: number;
  readonly baseY: number;
  readonly rect: { left: number; top: number; width: number } | null;
}

/** Survives close/reopen for the Studio session, like the Move-edit sheet. */
const brushModalDragOffset = signal<DragOffset | null>(null);
const brushModalResizeHeight = signal<number | null>(null);

export function resetBrushModalLayout(): void {
  brushModalDragOffset.value = null;
  brushModalResizeHeight.value = null;
}

const SURFACE_INSET_PX = 12;
/**
 * 261029-hy2 WR-01: the three sheet seats cascade (stroke-settings 12,
 * brushes 28, settings 44) so a covered sheet keeps a clickable header strip
 * instead of losing every pressable pixel to its pixel-identical sibling.
 */
const SURFACE_TOP_INSET_PX = 28;

const SURFACE_STYLE: CSSProperties = {
  position: 'absolute',
  top: `${SURFACE_TOP_INSET_PX}px`,
  right: `${SURFACE_INSET_PX}px`,
  width: '372px',
  maxWidth: 'calc(100vw - 24px)',
  // A definite height is required: the SidebarScrollArea scroller is
  // absolutely positioned, so an auto-height surface collapses its track.
  // The bottom inset stays SURFACE_INSET_PX whatever the top seat.
  height: `min(560px, calc(100% - ${SURFACE_TOP_INSET_PX + SURFACE_INSET_PX}px))`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxSizing: 'border-box',
  padding: '0',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.09)',
  // 261027-gh9g: more transparent than the Move-edit sheet on purpose — the
  // canvas paint must read through the catalog.
  background: 'rgba(28, 30, 34, 0.55)',
  color: 'var(--sidebar-text-primary, #eceff2)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  pointerEvents: 'auto',
};

const RESIZE_HANDLE_STYLE: CSSProperties = {
  flex: '0 0 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'ns-resize',
  touchAction: 'none',
};

const RESIZE_GRIP_STYLE: CSSProperties = {
  width: '34px',
  height: '3px',
  borderRadius: '2px',
  background: 'rgba(255, 255, 255, 0.22)',
};

const CONTENT_STYLE: CSSProperties = {
  padding: '10px 12px 12px',
};

export function PhysicsPaintBrushModal() {
  const open = aquarelleBrushModalOpen.value;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const resizeStartRef = useRef<{ pointerY: number; height: number; max: number } | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // 261029-hy2 WR-03: only the FRONT sheet consumes Escape — same-node
      // listeners all run, so a background sheet must not close. Closing
      // stops its siblings with stopImmediatePropagation (not stopPropagation).
      if (!closeSheetIfFront(SHEET_ID_BRUSHES, () => setAquarelleBrushModalOpen(false))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!open) return null;

  const close = () => setAquarelleBrushModalOpen(false);

  const onHeaderPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    const base = brushModalDragOffset.value;
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      baseX: base?.dxPx ?? 0,
      baseY: base?.dyPx ?? 0,
      rect: rect ? { left: rect.left, top: rect.top, width: rect.width } : null,
    };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onHeaderPointerMove = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    let nextX = start.baseX + (event.clientX - start.pointerX);
    let nextY = start.baseY + (event.clientY - start.pointerY);
    // Keep at least 80px visible horizontally and the header reachable.
    if (start.rect && typeof window !== 'undefined') {
      nextX = start.baseX + Math.min(
        Math.max(nextX - start.baseX, 80 - start.rect.width - start.rect.left),
        window.innerWidth - 80 - start.rect.left,
      );
      nextY = start.baseY + Math.min(
        Math.max(nextY - start.baseY, -start.rect.top),
        window.innerHeight - 48 - start.rect.top,
      );
    }
    brushModalDragOffset.value = { dxPx: nextX, dyPx: nextY };
  };

  const endHeaderDrag = () => {
    dragStartRef.current = null;
  };

  const onResizePointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : rect.top + rect.height;
    resizeStartRef.current = {
      pointerY: event.clientY,
      height: rect.height,
      max: Math.max(240, viewportHeight - rect.top - SURFACE_INSET_PX),
    };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onResizePointerMove = (event: TargetedPointerEvent<HTMLDivElement>) => {
    const start = resizeStartRef.current;
    if (!start) return;
    const next = Math.min(start.max, Math.max(240, start.height + (event.clientY - start.pointerY)));
    brushModalResizeHeight.value = next;
  };

  const endResize = () => {
    resizeStartRef.current = null;
  };

  const applied = brushModalDragOffset.value;
  const resizedHeight = brushModalResizeHeight.value;

  return (
    <div
      ref={surfaceRef}
      class="physics-paint-brush-modal"
      data-testid="watercolor-brush-modal"
      role="dialog"
      aria-label="Brushes"
      // Capture phase: the Close button stops pointerdown propagation, and a
      // press on it must still raise the sheet.
      onPointerDownCapture={() => bringSheetToFront(SHEET_ID_BRUSHES)}
      style={{
        ...SURFACE_STYLE,
        zIndex: sheetZIndex(SHEET_ID_BRUSHES),
        height: resizedHeight === null ? SURFACE_STYLE.height : `${resizedHeight}px`,
        transform: `translate(${applied?.dxPx ?? 0}px, ${applied?.dyPx ?? 0}px)`,
      }}
    >
      <div
        class="physics-paint-photo-reference-header"
        data-testid="watercolor-brush-modal-header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <Paintbrush
          size={15}
          class="physics-paint-photo-reference-header-icon"
          aria-hidden="true"
        />
        <strong>Brushes</strong>
        <span class="physics-paint-photo-reference-header-spacer" aria-hidden="true" />
        <button
          type="button"
          class="physics-paint-photo-reference-close"
          data-testid="watercolor-brush-modal-close"
          aria-label="Close"
          title="Close"
          // The header is the drag handle: its pointerdown captures the
          // pointer and calls preventDefault, which suppresses this button's
          // click. Stop the press here so Close stays clickable.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={close}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>

      <SidebarScrollArea class="physics-paint-brush-modal-scroll" interactive>
        <div style={CONTENT_STYLE}>
          <WatercolorBrushLibrary />
        </div>
      </SidebarScrollArea>

      <div
        data-testid="watercolor-brush-modal-resize"
        aria-hidden="true"
        style={RESIZE_HANDLE_STYLE}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      >
        <span style={RESIZE_GRIP_STYLE} />
      </div>
    </div>
  );
}
