// ============================================================
//  261029-hy2 — the floating Settings sheet.
//
//  The retired right-sidebar Settings TAB moved here: the eight
//  per-brush response multipliers (Tip, Aspect, Rotation,
//  SizeCurve, Scatter, Capacity, Grain, Wet round) via
//  RightPanelSettingsTab -> BrushResponsePanel.
//
//  It reuses the brush catalog's (Move-edit) sheet mechanics:
//  top-right inset inside the canvas region, header drag, bottom
//  resize, Escape to close and a session-scoped layout. Opened
//  from ONE entry point: the Settings button at the top of the
//  right sidebar's Brush tab.
// ============================================================

import { useEffect, useRef } from 'preact/hooks';
import type { CSSProperties, TargetedPointerEvent } from 'preact';
import { signal } from '@preact/signals';
import { SlidersHorizontal, X } from 'lucide-preact';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';
import {
  aquarelleSettingsModalOpen,
  setAquarelleSettingsModalOpen,
} from './aquarelleRecordState';
import {
  SHEET_ID_SETTINGS,
  bringSheetToFront,
  closeSheetIfFront,
  releaseSheet,
  sheetZIndex,
} from './floatingSheetStack';
import { RightPanelSettingsTab } from './RightPanelSettingsTab';

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

/** Survives close/reopen for the Studio session, like the sibling sheets. */
const settingsModalDragOffset = signal<DragOffset | null>(null);
const settingsModalResizeHeight = signal<number | null>(null);

export function resetSettingsModalLayout(): void {
  settingsModalDragOffset.value = null;
  settingsModalResizeHeight.value = null;
}

const SURFACE_INSET_PX = 12;
/**
 * 261029-hy2 WR-01: the three sheet seats cascade (stroke-settings 12,
 * brushes 28, settings 44) so a covered sheet keeps a clickable header strip
 * instead of losing every pressable pixel to its pixel-identical sibling.
 */
const SURFACE_TOP_INSET_PX = 44;

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
  // This is a settings panel, not the transparent brush catalog.
  background: 'rgba(28, 30, 34, 0.9)',
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

export function PhysicsPaintSettingsModal() {
  const open = aquarelleSettingsModalOpen.value;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const resizeStartRef = useRef<{ pointerY: number; height: number; max: number } | null>(null);

  useEffect(() => {
    if (!open) {
      // A closed sheet must leave the order — a stale front id would make the
      // front-only Escape gate inert for every sheet that is still open.
      releaseSheet(SHEET_ID_SETTINGS);
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // 261029-hy2 WR-02: an input/textarea/contenteditable INSIDE the sheet
      // owns the key — the same guard the stroke dialog applies. Typing a
      // multiplier value must never dismiss the panel.
      const target = event.target as {
        closest?: (selector: string) => unknown;
      } | null;
      const editable = target?.closest?.('input, textarea, [contenteditable="true"]');
      if (editable) {
        const insideDialog = (editable as { closest?: (selector: string) => unknown })
          .closest?.('[data-testid="physics-settings-modal"]');
        if (insideDialog) return;
      }
      // 261029-hy2 WR-03: front-only dismissal — a background Settings sheet
      // must not swallow the Escape that belongs to the front sheet.
      if (!closeSheetIfFront(SHEET_ID_SETTINGS, () => setAquarelleSettingsModalOpen(false))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!open) return null;

  const close = () => setAquarelleSettingsModalOpen(false);

  const onHeaderPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    const base = settingsModalDragOffset.value;
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
    settingsModalDragOffset.value = { dxPx: nextX, dyPx: nextY };
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
    settingsModalResizeHeight.value = next;
  };

  const endResize = () => {
    resizeStartRef.current = null;
  };

  const applied = settingsModalDragOffset.value;
  const resizedHeight = settingsModalResizeHeight.value;

  return (
    <div
      ref={surfaceRef}
      class="physics-paint-brush-modal"
      data-testid="physics-settings-modal"
      role="dialog"
      aria-label="Settings"
      // Capture phase: the Close button stops pointerdown propagation, and a
      // press on it must still raise the sheet.
      onPointerDownCapture={() => bringSheetToFront(SHEET_ID_SETTINGS)}
      style={{
        ...SURFACE_STYLE,
        zIndex: sheetZIndex(SHEET_ID_SETTINGS),
        height: resizedHeight === null ? SURFACE_STYLE.height : `${resizedHeight}px`,
        transform: `translate(${applied?.dxPx ?? 0}px, ${applied?.dyPx ?? 0}px)`,
      }}
    >
      <div
        class="physics-paint-photo-reference-header"
        data-testid="physics-settings-modal-header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <SlidersHorizontal
          size={15}
          class="physics-paint-photo-reference-header-icon"
          aria-hidden="true"
        />
        <strong>Settings</strong>
        <span class="physics-paint-photo-reference-header-spacer" aria-hidden="true" />
        <button
          type="button"
          class="physics-paint-photo-reference-close"
          data-testid="physics-settings-modal-close"
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
          <RightPanelSettingsTab />
        </div>
      </SidebarScrollArea>

      <div
        data-testid="physics-settings-modal-resize"
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
