import { useEffect, useRef } from 'preact/hooks';
import { signal, type Signal } from '@preact/signals';
import { memo } from 'preact/compat';
import type { CSSProperties, TargetedPointerEvent } from 'preact';
import { SliderStepper } from '../../shared/SliderStepper';
import {
  buildAppearancePatch,
  readNumericField,
  resolveStrokeSettingsOpen,
  shouldMarkSawEmpty,
  strokeSettingsFields,
  type StrokeSettingsDialogBundle,
} from './strokeSettingsModel';
import { scriptSelectedStrokeIds, scriptSelectMode } from './scriptStrokeEdition';

/**
 * quick 261024-p5q: the Stroke Settings dialog — a selection-gated, movable
 * editing surface for the selected Studio strokes (Brush Move / Water color
 * Select). Patterned on the Photo Reference dialog: no backdrop, no focus
 * trap — the canvas and its transform handles stay interactive behind it.
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
 * Signals only: ref-held signals, no React-style component state, no
 * render-body signal writes, all styling inline (no CSS file change). Task 1
 * ships the Brush Size row end-to-end; the remaining rows land in Task 2 and
 * geometry in Task 3.
 */

interface DragOffset {
  readonly selection: ReadonlySet<number>;
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

export interface PhysicsPaintStrokeSettingsDialogProps {
  /** The view-supplied bundle for the ACTIVE module; absent means no dialog. */
  bundle?: StrokeSettingsDialogBundle | null;
}

let sawEmptySinceDismiss = false;

const SURFACE_STYLE: CSSProperties = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  width: '320px',
  maxHeight: 'calc(100% - 24px)',
  overflowY: 'auto',
  zIndex: 50,
  boxSizing: 'border-box',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.35))',
  background: 'var(--sidebar-bg, #1f242b)',
  color: 'var(--sidebar-text-primary, #eceff2)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
  pointerEvents: 'auto',
};

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'move',
  userSelect: 'none',
  touchAction: 'none',
};

const CLOSE_STYLE: CSSProperties = {
  width: '18px',
  height: '18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0',
  border: 'none',
  borderRadius: '3px',
  background: 'transparent',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: '1',
};

const SECTION_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '8px',
};

const SECTION_TITLE_STYLE: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
};

export function PhysicsPaintStrokeSettingsDialog({
  bundle,
}: PhysicsPaintStrokeSettingsDialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dismissedRef = useRef<Signal<boolean> | null>(null);
  if (!dismissedRef.current) dismissedRef.current = signal(false);
  const dragOffsetRef = useRef<Signal<DragOffset | null> | null>(null);
  if (!dragOffsetRef.current) dragOffsetRef.current = signal(null);
  const dragStartRef = useRef<DragStart | null>(null);

  const selection = scriptSelectedStrokeIds.value;
  const engineModule = bundle?.module ?? 'brush';
  const surfaceActive = bundle !== null && bundle !== undefined
    ? (engineModule === 'watercolor' ? scriptSelectMode.value : bundle.brushMoveActive)
    : false;
  const dismissed = dismissedRef.current.value;

  // Plain (non-signal) render-body flag write — the dismissal edge marker.
  if (shouldMarkSawEmpty({ dismissed, surfaceActive, selectionSize: selection.size })) {
    sawEmptySinceDismiss = true;
  }

  const open = bundle !== null
    && bundle !== undefined
    && resolveStrokeSettingsOpen({
      surfaceActive,
      selectionSize: selection.size,
      dismissed,
      sawEmptySinceDismiss,
    });

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
      dismissedRef.current!.value = true;
      sawEmptySinceDismiss = false;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  if (!bundle || !open) return null;

  const ids = [...selection];
  const appearances = bundle.readAppearance(ids, bundle.playFrame);
  if (appearances.length === 0) return null;

  const fields = strokeSettingsFields(engineModule);
  const sizeField = fields[0]!;
  const sizeReading = readNumericField(appearances, ids, sizeField);

  const offset = dragOffsetRef.current.value;
  const applied = offset && offset.selection === selection ? offset : null;

  const dismiss = () => {
    dismissedRef.current!.value = true;
    sawEmptySinceDismiss = false;
  };

  const onHeaderPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    const current = dragOffsetRef.current!.value;
    const base = current && current.selection === selection ? current : null;
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
    dragOffsetRef.current!.value = { selection, dxPx: nextX, dyPx: nextY };
  };

  const endHeaderDrag = () => {
    dragStartRef.current = null;
  };

  return (
    <div
      ref={surfaceRef}
      data-testid="stroke-settings-dialog"
      role="dialog"
      aria-label="Stroke settings"
      style={{
        ...SURFACE_STYLE,
        transform: `translate(${applied?.dxPx ?? 0}px, ${applied?.dyPx ?? 0}px)`,
      }}
    >
      <div
        data-testid="stroke-settings-header"
        style={HEADER_STYLE}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <strong style={{ fontSize: '12px' }}>Stroke settings</strong>
        <span style={{ flex: '1 1 0' }} aria-hidden="true" />
        <button
          type="button"
          data-testid="stroke-settings-close"
          aria-label="Close stroke settings"
          title="Close"
          style={CLOSE_STYLE}
          onClick={dismiss}
        >
          ×
        </button>
      </div>

      <div style={SECTION_STYLE}>
        <div style={SECTION_TITLE_STYLE}>Paint</div>
        <div data-testid="stroke-settings-size">
          <SliderStepper
            label={sizeField.label}
            ariaLabel={sizeField.label}
            value={sizeReading.value}
            min={sizeField.min}
            max={sizeField.max}
            step={sizeField.step}
            commitOnRelease
            onChange={(value) => {
              void bundle.applyAppearance(ids, buildAppearancePatch(engineModule, sizeField.key, value));
            }}
          />
        </div>
      </div>
    </div>
  );
}

export const MemoizedPhysicsPaintStrokeSettingsDialog = memo(PhysicsPaintStrokeSettingsDialog);
