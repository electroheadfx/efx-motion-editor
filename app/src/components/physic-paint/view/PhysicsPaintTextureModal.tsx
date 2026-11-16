// ============================================================
//  quick 261116-gcn — the floating Textures sheet.
//
//  Opened from the Textures popover's "Open modal" action. It
//  reuses the brush catalog's mechanics: header drag, bottom-edge
//  vertical resize, window-bounded positioning, and the shared
//  rounded-square close chrome.
//
//  D-1 law: the Size control is the SAME shared brush Size as the
//  top bar (aquarelleParams.size, clamped 1..80), never a
//  texture-pattern scale. A release commits one `size` patch to the
//  selected paint strokes through commitAquarelleSelectionParam —
//  engine, masks and unselected strokes stay untouched.
// ============================================================

import { useEffect, useRef } from 'preact/hooks';
import type { CSSProperties, TargetedPointerEvent } from 'preact';
import { signal } from '@preact/signals';
import { Grid2x2, X } from 'lucide-preact';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';
import { SliderStepper } from '../../shared/SliderStepper';
import {
  aquarelleParams,
  aquarelleTextureModalOpen,
  setAquarelleTextureModalOpen,
} from './aquarelleRecordState';
import { commitAquarelleSelectionParam } from './aquarellePaintControls';
import {
  SHEET_ID_TEXTURES,
  bringSheetToFront,
  closeSheetIfFront,
  releaseSheet,
  sheetZIndex,
} from './floatingSheetStack';
import { WatercolorTextureStrip } from './WatercolorTextureStrip';
import { WatercolorTextureImport } from './WatercolorBrushLibrary';

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

/** Survives close/reopen for the Studio session, like the brush catalog. */
const textureModalDragOffset = signal<DragOffset | null>(null);
const textureModalResizeHeight = signal<number | null>(null);

export function resetTextureModalLayout(): void {
  textureModalDragOffset.value = null;
  textureModalResizeHeight.value = null;
}

const SURFACE_INSET_PX = 12;
/**
 * quick 261116-gcn: the Textures sheet is the FIFTH seat of the 12 / 28 / 44 /
 * 60 sixteen-pixel cascade (stroke-settings, brushes, settings, rail-motion),
 * because it is appended last in the shared sheet order. 76 continues the
 * cascade so a covered sheet keeps a clickable header strip.
 */
const SURFACE_TOP_INSET_PX = 76;

const SURFACE_STYLE: CSSProperties = {
  position: 'absolute',
  top: `${SURFACE_TOP_INSET_PX}px`,
  right: `${SURFACE_INSET_PX}px`,
  width: '372px',
  maxWidth: 'calc(100vw - 24px)',
  // A definite height is required: the SidebarScrollArea scroller is
  // absolutely positioned, so an auto-height surface collapses its track.
  // The bottom inset stays SURFACE_INSET_PX whatever the top seat.
  height: `min(480px, calc(100% - ${SURFACE_TOP_INSET_PX + SURFACE_INSET_PX}px))`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxSizing: 'border-box',
  padding: '0',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.09)',
  // Same deliberately transparent glass panel as the brush catalog — the
  // canvas paint must read through the texture chips.
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

/**
 * D-1: the shared brush Size. ONE narrow read of the live aquarelle size; the
 * continuous path forwards straight to the top bar's handler (which writes the
 * live signal), while the release commits exactly one `size` patch to the
 * selected paint strokes. No signal write happens in this component.
 */
export function TextureSizeControl(props: {
  onBrushSizeChange: (value: number) => void;
  disabled?: boolean;
}) {
  const size = aquarelleParams.value.size;
  return (
    <div
      class="physics-paint-texture-size"
      data-testid="watercolor-texture-modal-size"
      title="Brush size — the same shared value as the top bar's Brush size"
    >
      <SliderStepper
        id="physics-texture-size"
        label="Brush size"
        value={size}
        onChange={props.onBrushSizeChange}
        onCommit={(value) => {
          void commitAquarelleSelectionParam('size', value);
        }}
        step={1}
        min={1}
        max={80}
        disabled={props.disabled}
        ariaLabel="Brush size — textures"
      />
    </div>
  );
}

export function PhysicsPaintTextureModal(props: {
  onBrushSizeChange: (value: number) => void;
  disabled?: boolean;
}) {
  const open = aquarelleTextureModalOpen.value;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const resizeStartRef = useRef<{ pointerY: number; height: number; max: number } | null>(null);

  useEffect(() => {
    if (!open) {
      // A closed sheet must leave the order — a stale front id would make the
      // front-only Escape gate inert for every sheet that is still open.
      releaseSheet(SHEET_ID_TEXTURES);
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Only the FRONT sheet consumes Escape. Closing stops its siblings with
      // stopImmediatePropagation (never stopPropagation).
      if (!closeSheetIfFront(SHEET_ID_TEXTURES, () => setAquarelleTextureModalOpen(false))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!open) return null;

  const close = () => setAquarelleTextureModalOpen(false);

  const onHeaderPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    const base = textureModalDragOffset.value;
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
    textureModalDragOffset.value = { dxPx: nextX, dyPx: nextY };
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
    textureModalResizeHeight.value = next;
  };

  const endResize = () => {
    resizeStartRef.current = null;
  };

  const applied = textureModalDragOffset.value;
  const resizedHeight = textureModalResizeHeight.value;

  return (
    <div
      ref={surfaceRef}
      class="physics-paint-texture-modal"
      data-testid="watercolor-texture-modal"
      role="dialog"
      aria-label="Textures"
      // Capture phase: the Close button stops pointerdown propagation, and a
      // press on it must still raise the sheet.
      onPointerDownCapture={() => bringSheetToFront(SHEET_ID_TEXTURES)}
      style={{
        ...SURFACE_STYLE,
        zIndex: sheetZIndex(SHEET_ID_TEXTURES),
        height: resizedHeight === null ? SURFACE_STYLE.height : `${resizedHeight}px`,
        transform: `translate(${applied?.dxPx ?? 0}px, ${applied?.dyPx ?? 0}px)`,
      }}
    >
      <div
        class="physics-paint-photo-reference-header"
        data-testid="watercolor-texture-modal-header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <Grid2x2
          size={15}
          class="physics-paint-photo-reference-header-icon"
          aria-hidden="true"
        />
        <strong>Textures</strong>
        <span class="physics-paint-photo-reference-header-spacer" aria-hidden="true" />
        <button
          type="button"
          class="physics-paint-photo-reference-close"
          data-testid="watercolor-texture-modal-close"
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

      <SidebarScrollArea class="physics-paint-texture-modal-scroll" interactive>
        <div style={CONTENT_STYLE}>
          <TextureSizeControl
            onBrushSizeChange={props.onBrushSizeChange}
            disabled={props.disabled}
          />
          {/* quick 261116-gcn: the SAME import control the brush catalog uses
              (one decode/register path), seated ABOVE the strip with breathing
              room on both sides. Its own testid prefix keeps the two mounted
              surfaces addressable. */}
          <div style={{ margin: '8px 0 12px' }}>
            <WatercolorTextureImport testIdPrefix="watercolor-texture-import" />
          </div>
          <WatercolorTextureStrip />
        </div>
      </SidebarScrollArea>

      <div
        data-testid="watercolor-texture-modal-resize"
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
