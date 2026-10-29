import { useCallback, useEffect, useRef } from 'preact/hooks';
import { signal, type Signal } from '@preact/signals';
import { memo } from 'preact/compat';
import type { CSSProperties, TargetedPointerEvent } from 'preact';
import { SlidersHorizontal, X } from 'lucide-preact';
import { SliderStepper } from '../../shared/SliderStepper';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';
import { hexToRgba } from '../../../lib/colorUtils';
import {
  FRESH_STROKE_GEOMETRY_SESSION,
  STROKE_POSITION_RANGE,
  STROKE_ROTATION_RANGE,
  STROKE_SCALE_RANGE,
  buildAppearancePatch,
  geometryMoveDelta,
  geometryTransform,
  readColorField,
  readNumericField,
  resolveStrokeSettingsOpen,
  shouldMarkSawEmpty,
  strokeSettingsFields,
  type StrokeGeometryControl,
  type StrokeGeometrySession,
  type StrokeSettingsDialogBundle,
} from './strokeSettingsModel';
import { scriptSelectedStrokeIds, scriptSelectMode } from './scriptStrokeEdition';
import { scriptStrokeSelectionBox } from './scriptStrokeTransform';
import { clampStackPosition } from './stackOrder';
import {
  SHEET_ID_STROKE_SETTINGS,
  bringSheetToFront,
  closeSheetIfFront,
  releaseSheet,
  sheetZIndex,
} from './floatingSheetStack';
import {
  aquarelleStrokeSettingsDismissed,
  aquarelleStrokeTypeFilter,
  setAquarelleStrokeTypeFilter,
  type AquarelleStrokeTypeFilter,
} from './aquarelleStrokeSelection';

/**
 * quick 261024-p5q: the Stroke Settings dialog — a selection-gated, movable
 * editing surface for the selected Studio strokes (Brush Move / Water color
 * Select). Patterned on the Photo Reference dialog: no backdrop, no focus
 * trap — the canvas and its transform handles stay interactive behind it.
 *
 * 261024-p5q UAT revision: the header reuses the Document sound modal's
 * chrome (icon + title + rounded-square close) and the internal scroll uses
 * the app's SidebarScrollArea thumb (never the OS scrollbar). The color is
 * not edited here: a read-only thumb shows the selected strokes' color and
 * the one shared picker in the sidebar Color tab commits the change.
 *
 * 261024-vga UAT revision: one pinned tab row (Geometry | Stack | Paint),
 * Geometry by default, all three on one row. The color readout moved into
 * Paint. The tabs hold no stroke data — a ref-held signal holds only the
 * active tab key.
 *
 * Dismissal (exact law): `dismissed` is a signal written ONLY by Escape and
 * the header close button. `sawEmptySinceDismiss` is a plain module flag
 * (NOT a signal) marking "the selection was empty at least once after the
 * dismissal", written idempotently in the render body. Open =
 * surfaceActive && size > 0 && (!dismissed || sawEmptySinceDismiss), so a
 * non-empty -> non-empty change never reopens it while empty -> non-empty
 * does. Escape passes through when a focused input/textarea/contenteditable
 * INSIDE the dialog owns the key.
 *
 * Geometry: every row is a release-commit, free-entry SliderStepper. X/Y type
 * an absolute target and commit `target - live centre` in integer px; Scale /
 * Scale X / Scale Y / Rotation apply the delta from that row's last APPLIED
 * value (a refused commit keeps the previous session value). The session is
 * keyed by the selection Set, so a membership change re-baselines to identity.
 * Transforms anchor at the union-box centre of the selected strokes; nothing
 * persists.
 *
 * Stack (261024-vga): for a single selected stroke whose bundle provides
 * `reorderStroke`, a position row states where the stroke sits in the paint
 * order (1 = topmost, the badge law) and places it exactly there through the
 * bundle. The section owns NO stroke-list state. SliderStepper writes its
 * input's DOM value directly on commit and a re-render with an unchanged
 * `value` prop cannot rewrite it, so a ref-held nonce is the row's Preact key:
 * after every commit the input remounts at the live position (a refused
 * placement must never leave the typed value on screen). A ref-held
 * last-emitted guard collapses SliderStepper's Enter + blur pair into ONE
 * reorder call.
 */

interface DragOffset {
  readonly dxPx: number;
  readonly dyPx: number;
}

/**
 * 261024-vga UAT revision: the dialog's layout lives at module scope so it
 * survives selection changes, dismiss/reopen and module switches for the whole
 * Studio lifecycle. It resets only when this module unloads.
 */
const strokeSettingsDragOffset = signal<DragOffset | null>(null);
const strokeSettingsResizeHeight = signal<number | null>(null);

export function resetStrokeSettingsDialogLayout(): void {
  strokeSettingsDragOffset.value = null;
  strokeSettingsResizeHeight.value = null;
}

interface DragStart {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly baseX: number;
  readonly baseY: number;
  readonly rect: { left: number; top: number; width: number } | null;
}

type StrokeSettingsTab = 'geometry' | 'stack' | 'paint';

const STROKE_SETTINGS_TABS: ReadonlyArray<{ key: StrokeSettingsTab; label: string }> = [
  { key: 'geometry', label: 'Geometry' },
  { key: 'stack', label: 'Stack' },
  { key: 'paint', label: 'Paint' },
];

/**
 * 261029-eur: the watercolor stroke-type filter row (All | Eraser | Paint).
 * The setter owns the selection pruning and the compare-then-write law, so
 * the row is pure chrome.
 */
const STROKE_TYPE_FILTERS: ReadonlyArray<{
  key: 'paint' | 'eraser' | 'all';
  label: string;
  filter: AquarelleStrokeTypeFilter;
}> = [
  { key: 'paint', label: 'Paint', filter: 'paint' },
  { key: 'eraser', label: 'Eraser', filter: 'lift' },
  { key: 'all', label: 'All', filter: 'all' },
];

const FILTER_ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: '4px',
  padding: '8px 12px 10px',
};

export interface PhysicsPaintStrokeSettingsDialogProps {
  /** The view-supplied bundle for the ACTIVE module; absent means no dialog. */
  bundle?: StrokeSettingsDialogBundle | null;
}

let sawEmptySinceDismiss = false;

/** Distance from the canvas region's top/right edges. */
const SURFACE_INSET_PX = 12;

const SURFACE_STYLE: CSSProperties = {
  position: 'absolute',
  top: `${SURFACE_INSET_PX}px`,
  right: `${SURFACE_INSET_PX}px`,
  width: '320px',
  // A definite height is required: the SidebarScrollArea root is a flex child
  // whose inner scroller is absolutely positioned, so an auto-height surface
  // would collapse its track to zero.
  height: 'min(520px, calc(100% - 24px))',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxSizing: 'border-box',
  padding: '0',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.09)',
  background: 'rgba(28, 30, 34, 0.9)',
  color: 'var(--sidebar-text-primary, #eceff2)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  pointerEvents: 'auto',
};

const SCROLL_CONTENT_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  padding: '10px 12px 0',
};

/** One tab's content: 15px rhythm between its rows. */
const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '15px',
};

const PAINT_ROW_LABEL_STYLE: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
};

const SEGMENT_LABEL_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '4px',
};

/** 261024-p5q UAT: a mixed readout is red, never the quiet gray. */
const MIXED_CAPTION_STYLE: CSSProperties = {
  fontSize: '10px',
  fontStyle: 'italic',
  color: '#ef4444',
};

const SEGMENT_GROUP_STYLE: CSSProperties = {
  display: 'flex',
  gap: '4px',
};

const SEGMENT_STYLE: CSSProperties = {
  flex: '1 1 0',
  height: '20px',
  padding: '0',
  borderRadius: '3px',
  border: '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.55))',
  background: 'transparent',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontSize: '10px',
  cursor: 'pointer',
};

const SEGMENT_ACTIVE_STYLE: CSSProperties = {
  background: 'var(--color-accent, #2f67e8)',
  borderColor: 'var(--color-accent, #2f67e8)',
  color: '#ffffff',
};

const COLOR_BLOCK_STYLE: CSSProperties = {
  width: '100%',
  height: '48px',
  boxSizing: 'border-box',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.22)',
  boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.22)',
};

const COLOR_READOUT_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '10px',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontVariantNumeric: 'tabular-nums',
};

/** The Stack identity row: colour dot, serial, public position. */
const STACK_HEADER_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const STACK_DOT_STYLE: CSSProperties = {
  flex: '0 0 10px',
  width: '10px',
  height: '10px',
  borderRadius: '2px',
  border: '1px solid rgba(255, 255, 255, 0.25)',
};

const STACK_SERIAL_STYLE: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '10px',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontVariantNumeric: 'tabular-nums',
};

const STACK_NEIGHBOURS_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '10px',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontVariantNumeric: 'tabular-nums',
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

export function PhysicsPaintStrokeSettingsDialog({
  bundle,
}: PhysicsPaintStrokeSettingsDialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const resizeStartRef = useRef<{ pointerY: number; height: number; max: number } | null>(null);
  /**
   * The geometry session, keyed by the selection Set instance. A different
   * selection simply resolves FRESH — no render-body signal write, and a new
   * membership always re-baselines to 100% / 0 degrees.
   */
  const geometrySessionRef = useRef<Signal<{ selection: ReadonlySet<number>; session: StrokeGeometrySession } | null> | null>(null);
  if (!geometrySessionRef.current) geometrySessionRef.current = signal(null);
  /**
   * 261024-vga: the Stack row's remount nonce (ref-held signal, read in the
   * render body). Bumped after every attempted placement so the keyed input
   * remounts and rewrites its DOM value from the live position.
   */
  const stackSyncRef = useRef<Signal<number> | null>(null);
  if (!stackSyncRef.current) stackSyncRef.current = signal(0);
  /** Collapses SliderStepper's Enter + blur pair into ONE reorder call. */
  const lastStackEmitRef = useRef<number | null>(null);
  /** 261024-vga UAT revision: the active section tab (ref-held, Geometry default). */
  const settingsTabRef = useRef<Signal<StrokeSettingsTab> | null>(null);
  if (!settingsTabRef.current) settingsTabRef.current = signal<StrokeSettingsTab>('geometry');

  const selection = scriptSelectedStrokeIds.value;
  const engineModule = bundle?.module ?? 'brush';
  const surfaceActive = bundle !== null && bundle !== undefined
    ? (engineModule === 'watercolor' ? scriptSelectMode.value : bundle.brushMoveActive)
    : false;
  // 261029-eur: the dismissal flag is module-level so the select-mode choke
  // point can re-arm it on a genuine off -> on edge. Watercolor Edit mode
  // keeps the sheet open on an empty selection (filter row + caption).
  const dismissed = aquarelleStrokeSettingsDismissed.value;
  const strokeTypeFilter = aquarelleStrokeTypeFilter.value;
  const keepOpenOnEmpty = bundle?.keepOpenOnEmpty ?? engineModule === 'watercolor';
  const stackSyncNonce = stackSyncRef.current.value;

  // Plain (non-signal) render-body flag write — the dismissal edge marker.
  // Inert under keepOpenOnEmpty (shouldMarkSawEmpty returns false there).
  if (
    shouldMarkSawEmpty({
      dismissed,
      surfaceActive,
      selectionSize: selection.size,
      keepOpenOnEmpty,
    })
  ) {
    sawEmptySinceDismiss = true;
  }

  const open = bundle !== null
    && bundle !== undefined
    && resolveStrokeSettingsOpen({
      surfaceActive,
      selectionSize: selection.size,
      dismissed,
      sawEmptySinceDismiss,
      keepOpenOnEmpty,
    });

  /**
   * 261024-vga UAT: close = LEAVE Move/Select (restore the previous tool) so
   * the next stroke selection re-opens the sheet. The legacy sticky dismissal
   * remains only for a bundle without `closeMoveMode`.
   */
  const closeMoveMode = bundle?.closeMoveMode;
  const closeSurface = useCallback(() => {
    if (closeMoveMode) {
      closeMoveMode();
      return;
    }
    // EVENT-handler write (never a render body). The ONLY reset site is the
    // setAquarelleSelectMode off -> on choke point.
    aquarelleStrokeSettingsDismissed.value = true;
    sawEmptySinceDismiss = false;
  }, [closeMoveMode]);

  // 261029-hy2 CR-01: this sheet opens from the SELECTION — there is no open
  // handler to raise from — so the open transition itself is the raise seam.
  // A lifecycle effect, never a render body (efx-preact-reactivity rule 6).
  useEffect(() => {
    if (!open) {
      // A closed sheet must leave the order — a stale front id would make the
      // front-only Escape gate inert for every sheet that is still open.
      releaseSheet(SHEET_ID_STROKE_SETTINGS);
      return;
    }
    bringSheetToFront(SHEET_ID_STROKE_SETTINGS);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target as {
        closest?: (selector: string) => unknown;
      } | null;
      const editable = target?.closest?.('input, textarea, [contenteditable="true"]');
      if (editable) {
        const insideDialog = (editable as { closest?: (selector: string) => unknown })
          .closest?.('[data-testid="stroke-settings-dialog"]');
        if (insideDialog) return;
      }
      // 261029-hy2 WR-03: front-only dismissal — a background stroke sheet
      // must not swallow the Escape that belongs to the front sheet.
      if (!closeSheetIfFront(SHEET_ID_STROKE_SETTINGS, closeSurface)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, closeSurface]);

  if (!bundle || !open) return null;

  const requestedSettingsTab = settingsTabRef.current.value;
  const stackTabAvailable = Boolean(bundle.reorderStroke);
  const strokes = bundle.listStrokes(bundle.playFrame, bundle.canvasSize);
  // 261029-eur: the Paint tab hides whenever an ERASER stroke is in play —
  // either the filter is Eraser, or a lift sits in the selection (a lift has
  // no paint rows). A requested Paint falls back to Geometry while hidden.
  const selectionHasLift = strokes.some(
    (stroke) => selection.has(stroke.mutationId) && stroke.kind === 'lift',
  );
  const paintTabAvailable = strokeTypeFilter !== 'lift' && !selectionHasLift;
  const activeSettingsTab: StrokeSettingsTab = requestedSettingsTab === 'stack' && !stackTabAvailable
    ? 'geometry'
    : requestedSettingsTab === 'paint' && !paintTabAvailable
      ? 'geometry'
      : requestedSettingsTab;

  const ids = [...selection];
  const appearances = bundle.readAppearance(ids, bundle.playFrame);

  const fields = strokeSettingsFields(engineModule);
  /**
   * Brush only: Opacity is a real composited alpha and leads Geometry.
   * Water color has no global opacity — its canonical Pigment (`load`) is
   * already a Paint row, so Geometry does not mirror it under the name Opacity.
   */
  const opacityField = engineModule === 'watercolor'
    ? undefined
    : fields.find((field) => field.key === 'opacity');
  const numericFields = fields.filter((field) => field.kind === 'numeric');
  const segmentedFields = fields.filter((field) => field.kind === 'segmented');
  const opacityReading = opacityField ? readNumericField(appearances, ids, opacityField) : null;

  const colorReading = readColorField(appearances, ids);
  const colorRgb = hexToRgba(colorReading.color);

  const applied = strokeSettingsDragOffset.value;

  /**
   * Geometry is session-relative: the display states what the strokes LAST
   * received, so a refused commit (watercolor re-bake) never advances it.
   * The union box is computed from the SELECTED strokes of this frame only;
   * every transform anchors at its centre.
   */
  const geometryState = geometrySessionRef.current.value;
  const geometrySession = geometryState && geometryState.selection === selection
    ? geometryState.session
    : FRESH_STROKE_GEOMETRY_SESSION;
  const selectionBox = scriptStrokeSelectionBox(
    strokes.filter((stroke) => selection.has(stroke.mutationId)),
  );
  const liveCenter = selectionBox
    ? { x: selectionBox.x + selectionBox.width / 2, y: selectionBox.y + selectionBox.height / 2 }
    : null;

  /**
   * Stack placement is single-stroke only. Neighbours are derived from the
   * public position (1 = topmost), never from the listing order.
   */
  const stackStroke = selection.size === 1
    ? strokes.find((stroke) => stroke.mutationId === ids[0])
    : undefined;
  const stackAbove = stackStroke
    ? strokes.find((stroke) => stroke.stackPosition === stackStroke.stackPosition - 1)
    : undefined;
  const stackBelow = stackStroke
    ? strokes.find((stroke) => stroke.stackPosition === stackStroke.stackPosition + 1)
    : undefined;

  const commitStackPosition = (positionFromTop: number) => {
    const reorderStroke = bundle.reorderStroke;
    if (!reorderStroke || !stackStroke) return;
    const clamped = clampStackPosition(positionFromTop, stackStroke.stackTotal);
    // The live slot is not a commit — and it must never re-key the input.
    if (clamped === stackStroke.stackPosition) return;
    // Enter commits, then the blur it triggers commits again in the same tick.
    if (lastStackEmitRef.current === clamped) return;
    lastStackEmitRef.current = clamped;
    queueMicrotask(() => {
      if (lastStackEmitRef.current === clamped) lastStackEmitRef.current = null;
    });
    // Remount the position input at the LIVE position, even when the commit
    // was refused and the `value` prop is unchanged.
    stackSyncRef.current!.value += 1;
    void reorderStroke(stackStroke.mutationId, clamped);
  };

  const commitGeometryTransform = (control: StrokeGeometryControl, nextValue: number) => {
    if (!liveCenter) return;
    const result = geometryTransform(control, nextValue, geometrySession, liveCenter);
    if (!result) return;
    // Keyed by the captured selection: a membership change mid-flight leaves
    // the NEW selection on its fresh baseline instead of inheriting this one.
    const commitSelection = selection;
    void Promise.resolve(bundle.transformStrokes([...commitSelection], result.transform))
      .then((ok) => {
        if (!ok) return;
        geometrySessionRef.current!.value = {
          selection: commitSelection,
          session: result.nextSession,
        };
      });
  };

  const commitGeometryMove = (axis: 'x' | 'y', nextValue: number) => {
    if (!liveCenter) return;
    const target = axis === 'x'
      ? { x: nextValue, y: liveCenter.y }
      : { x: liveCenter.x, y: nextValue };
    const delta = geometryMoveDelta(target, liveCenter);
    if (!delta) return;
    void Promise.resolve(bundle.moveStrokes(ids, delta.dxPx, delta.dyPx));
  };

  const onHeaderPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    const base = strokeSettingsDragOffset.value;
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
    strokeSettingsDragOffset.value = { dxPx: nextX, dyPx: nextY };
  };

  const endHeaderDrag = () => {
    dragStartRef.current = null;
  };

  const onResizePointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    // Grow to the APP bottom, not the canvas region's: the sheet overlays the
    // region without being clipped by it.
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
    strokeSettingsResizeHeight.value = next;
  };

  const endResize = () => {
    resizeStartRef.current = null;
  };

  const resizedHeight = strokeSettingsResizeHeight.value;

  return (
    <div
      ref={surfaceRef}
      data-testid="stroke-settings-dialog"
      role="dialog"
      aria-label="Stroke settings"
      // Capture phase: the Close button stops pointerdown propagation, and a
      // press on it must still raise the sheet.
      onPointerDownCapture={() => bringSheetToFront(SHEET_ID_STROKE_SETTINGS)}
      style={{
        ...SURFACE_STYLE,
        zIndex: sheetZIndex(SHEET_ID_STROKE_SETTINGS),
        height: resizedHeight === null ? SURFACE_STYLE.height : `${resizedHeight}px`,
        transform: `translate(${applied?.dxPx ?? 0}px, ${applied?.dyPx ?? 0}px)`,
      }}
    >
      <div
        class="physics-paint-photo-reference-header"
        data-testid="stroke-settings-header"
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
        <strong>Stroke settings</strong>
        <span class="physics-paint-photo-reference-header-spacer" aria-hidden="true" />
        <button
          type="button"
          class="physics-paint-photo-reference-close"
          data-testid="stroke-settings-close"
          aria-label="Close"
          title="Close"
          // The header is the drag handle: its pointerdown captures the
          // pointer and calls preventDefault, which suppresses this button's
          // click. Stop the press here so Close stays clickable.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={closeSurface}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>

      {engineModule === 'watercolor' ? (
        <div
          role="group"
          aria-label="Stroke type"
          data-testid="stroke-settings-filter"
          style={FILTER_ROW_STYLE}
        >
          {STROKE_TYPE_FILTERS.map((option) => {
            const active = strokeTypeFilter === option.filter;
            return (
              <button
                key={option.key}
                type="button"
                data-testid={`stroke-settings-filter-${option.key}`}
                aria-pressed={active}
                style={active ? { ...SEGMENT_STYLE, ...SEGMENT_ACTIVE_STYLE } : SEGMENT_STYLE}
                onClick={() => setAquarelleStrokeTypeFilter(option.filter)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        class="physics-paint-options-tabs physics-paint-stroke-settings-tabs"
        role="tablist"
        aria-label="Stroke settings sections"
        data-testid="stroke-settings-tabs"
      >
        {STROKE_SETTINGS_TABS.map((tab) => {
          if (tab.key === 'stack' && !stackTabAvailable) return null;
          if (tab.key === 'paint' && !paintTabAvailable) return null;
          const active = activeSettingsTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              data-testid={`stroke-settings-tab-${tab.key}`}
              aria-selected={active}
              class={`physics-paint-options-tab${active ? ' active' : ''}`}
              onClick={() => {
                settingsTabRef.current!.value = tab.key;
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <SidebarScrollArea class="physics-paint-stroke-settings-scroll" interactive>
        <div style={SCROLL_CONTENT_STYLE}>
          {appearances.length === 0 ? (
            <span data-testid="stroke-settings-empty" style={PAINT_ROW_LABEL_STYLE}>
              Select a stroke to edit.
            </span>
          ) : (
            <>
          {activeSettingsTab === 'geometry' ? (
            liveCenter ? (
              <div style={SECTION_STYLE} data-testid="stroke-settings-geometry">
              {opacityField && opacityReading ? (
                <div data-testid="stroke-settings-geometry-opacity">
                  <SliderStepper
                    label="Opacity"
                    ariaLabel="Opacity"
                    value={opacityReading.value}
                    min={opacityField.min}
                    max={opacityField.max}
                    step={opacityField.step}
                    mixed={opacityReading.mixed}
                    commitOnRelease
                    allowOutOfRangeEntry
                    onChange={(value) => {
                      void bundle.applyAppearance(
                        ids,
                        buildAppearancePatch(engineModule, opacityField.key, value),
                      );
                    }}
                  />
                </div>
              ) : null}
              <div data-testid="stroke-settings-geometry-x">
                <SliderStepper
                  label="X"
                  ariaLabel="X"
                  value={Math.round(liveCenter.x)}
                  min={STROKE_POSITION_RANGE.min}
                  max={STROKE_POSITION_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryMove('x', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-y">
                <SliderStepper
                  label="Y"
                  ariaLabel="Y"
                  value={Math.round(liveCenter.y)}
                  min={STROKE_POSITION_RANGE.min}
                  max={STROKE_POSITION_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryMove('y', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-scale">
                <SliderStepper
                  label="Scale"
                  ariaLabel="Scale"
                  value={geometrySession.uniformPct}
                  min={STROKE_SCALE_RANGE.min}
                  max={STROKE_SCALE_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryTransform('uniform', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-scale-x">
                <SliderStepper
                  label="Scale X"
                  ariaLabel="Scale X"
                  value={geometrySession.scaleXPct}
                  min={STROKE_SCALE_RANGE.min}
                  max={STROKE_SCALE_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryTransform('scaleX', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-scale-y">
                <SliderStepper
                  label="Scale Y"
                  ariaLabel="Scale Y"
                  value={geometrySession.scaleYPct}
                  min={STROKE_SCALE_RANGE.min}
                  max={STROKE_SCALE_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryTransform('scaleY', value)}
                />
              </div>
              <div data-testid="stroke-settings-geometry-rotation">
                <SliderStepper
                  label="Rotation"
                  ariaLabel="Rotation"
                  value={geometrySession.rotationDeg}
                  min={STROKE_ROTATION_RANGE.min}
                  max={STROKE_ROTATION_RANGE.max}
                  step={1}
                  freeEntry
                  commitOnRelease
                  allowOutOfRangeEntry
                  onChange={(value) => commitGeometryTransform('rotation', value)}
                />
              </div>
              </div>
            ) : (
              <span data-testid="stroke-settings-geometry-empty" style={PAINT_ROW_LABEL_STYLE}>
                No stroke geometry available
              </span>
            )
          ) : null}

          {activeSettingsTab === 'stack' && bundle.reorderStroke ? (
            <div style={SECTION_STYLE} data-testid="stroke-settings-stack">
              {stackStroke ? (
                <>
                  <div style={STACK_HEADER_ROW_STYLE}>
                    <span
                      data-testid="stroke-settings-stack-dot"
                      style={{ ...STACK_DOT_STYLE, backgroundColor: stackStroke.color }}
                    />
                    <span data-testid="stroke-settings-stack-serial" style={STACK_SERIAL_STYLE}>
                      {`#${stackStroke.serial}`}
                    </span>
                    <span
                      data-testid="stroke-settings-stack-position"
                      style={{ ...STACK_SERIAL_STYLE, marginLeft: 'auto' }}
                    >
                      {`${stackStroke.stackPosition}/${stackStroke.stackTotal}`}
                    </span>
                  </div>
                  <div data-testid="stroke-settings-stack-stepper">
                    <SliderStepper
                      key={`stack-position-${stackSyncNonce}`}
                      label="Position (1 = top)"
                      ariaLabel="Stack position"
                      value={stackStroke.stackPosition}
                      min={1}
                      max={stackStroke.stackTotal}
                      step={1}
                      freeEntry
                      commitOnRelease
                      onChange={(value) => commitStackPosition(value)}
                    />
                  </div>
                  <div style={STACK_NEIGHBOURS_STYLE}>
                    <span data-testid="stroke-settings-stack-above">
                      {stackAbove ? `Above #${stackAbove.serial}` : 'Above —'}
                    </span>
                    <span data-testid="stroke-settings-stack-below">
                      {stackBelow ? `Below #${stackBelow.serial}` : 'Below —'}
                    </span>
                  </div>
                </>
              ) : (
                <span data-testid="stroke-settings-stack-disabled" style={PAINT_ROW_LABEL_STYLE}>
                  Select one stroke to change stack order
                </span>
              )}
              <div style={SEGMENT_GROUP_STYLE}>
                <button
                  type="button"
                  data-testid="stroke-settings-stack-top"
                  aria-label="Move stroke to top"
                  disabled={!stackStroke}
                  style={SEGMENT_STYLE}
                  onClick={() => commitStackPosition(1)}
                >
                  Top
                </button>
                <button
                  type="button"
                  data-testid="stroke-settings-stack-bottom"
                  aria-label="Move stroke to bottom"
                  disabled={!stackStroke}
                  style={SEGMENT_STYLE}
                  onClick={() => {
                    if (!stackStroke) return;
                    commitStackPosition(stackStroke.stackTotal);
                  }}
                >
                  Bottom
                </button>
              </div>
            </div>
          ) : null}

          {activeSettingsTab === 'paint' ? (
            <div style={SECTION_STYLE} data-testid="stroke-settings-paint">
              <span style={PAINT_ROW_LABEL_STYLE}>Color</span>
              <div
                data-testid="stroke-settings-color"
                style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              >
                <div
                  data-testid="stroke-settings-color-thumb"
                  title={colorReading.color}
                  style={{ ...COLOR_BLOCK_STYLE, backgroundColor: colorReading.color }}
                />
                <div style={COLOR_READOUT_ROW_STYLE}>
                  <span data-testid="stroke-settings-color-hex">{colorReading.color.toUpperCase()}</span>
                  <span data-testid="stroke-settings-color-rgb">
                    {`rgb(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b})`}
                  </span>
                  {colorReading.mixed ? (
                    <span data-testid="stroke-settings-color-mixed" style={MIXED_CAPTION_STYLE}>
                      Mixed
                    </span>
                  ) : null}
                </div>
              </div>
              {numericFields.map((field) => {
              const reading = readNumericField(appearances, ids, field);
              return (
                <div key={field.key} data-testid={`stroke-settings-${field.key}`}>
                  <SliderStepper
                    label={field.label}
                    ariaLabel={field.label}
                    value={reading.value}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    mixed={reading.mixed}
                    commitOnRelease
                    allowOutOfRangeEntry
                    onChange={(value) => {
                      void bundle.applyAppearance(
                        ids,
                        buildAppearancePatch(engineModule, field.key, value),
                      );
                    }}
                  />
                </div>
              );
            })}
            {segmentedFields.map((field) => {
              const reading = readNumericField(appearances, ids, field);
              return (
                <div key={field.key} data-testid={`stroke-settings-${field.key}`}>
                  <div style={SEGMENT_LABEL_ROW_STYLE}>
                    <span style={PAINT_ROW_LABEL_STYLE}>{field.label}</span>
                    {reading.mixed ? (
                      <span
                        data-testid={`stroke-settings-${field.key}-mixed`}
                        style={MIXED_CAPTION_STYLE}
                      >
                        Mixed
                      </span>
                    ) : null}
                  </div>
                  <div role="group" aria-label={field.label} style={SEGMENT_GROUP_STYLE}>
                    {(field.options ?? []).map((option) => {
                      const active = !reading.mixed && reading.value === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          data-testid={`stroke-settings-${field.key}-option-${option.value}`}
                          aria-pressed={active}
                          style={active ? { ...SEGMENT_STYLE, ...SEGMENT_ACTIVE_STYLE } : SEGMENT_STYLE}
                          onClick={() => {
                            void bundle.applyAppearance(
                              ids,
                              buildAppearancePatch(engineModule, field.key, option.value),
                            );
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </div>
          ) : null}
            </>
          )}
        </div>
      </SidebarScrollArea>

      <div
        data-testid="stroke-settings-resize"
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

export const MemoizedPhysicsPaintStrokeSettingsDialog = memo(PhysicsPaintStrokeSettingsDialog);
