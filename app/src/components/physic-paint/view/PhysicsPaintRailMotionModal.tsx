// ============================================================
//  261107-qgj — the floating Motion modal.
//
//  The 59-16 Motion numeric values moved out of the right-sidebar
//  Scripts tab and into this fourth floating sheet. It opens on
//  the animate-mode property selection in the pinned channel
//  header (or on a Motion-key selection) and closes through ONE
//  path — the header X and the front-only Escape both call
//  `onClose`, which clears the property AND the key selection.
//
//  Props-driven by law: it imports no store, reads only its
//  `dialog` signal and renders only channels the rail carries.
// ============================================================

import { useEffect, useRef } from 'preact/hooks';
import type { CSSProperties, TargetedPointerEvent } from 'preact';
import { signal, type ReadonlySignal } from '@preact/signals';
import { Move, RotateCcw, X } from 'lucide-preact';
import { SliderStepper } from '../../shared/SliderStepper';
import {
  SHEET_ID_RAIL_MOTION,
  bringSheetToFront,
  closeSheetIfFront,
  releaseSheet,
  sheetZIndex,
} from './floatingSheetStack';
import type { RailMotionDialogBundle } from './physicsPaintKeyRailPresentation';
import { PhysicsPaintRailMotionEasingControl } from './PhysicsPaintRailMotionEasingControl';
import type {
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionEasing,
} from '../roto/railMotionModel';

const MODAL_TESTID = 'physics-rail-motion-modal';

const SURFACE_INSET_PX = 12;
/**
 * 261107-qgj: the fourth seat of the 12 / 28 / 44 / 60 cascade, so the
 * Settings header strip stays clickable when both sheets are open.
 */
const SURFACE_TOP_INSET_PX = 60;

const SURFACE_STYLE: CSSProperties = {
  position: 'absolute',
  top: `${SURFACE_TOP_INSET_PX}px`,
  right: `${SURFACE_INSET_PX}px`,
  width: '320px',
  maxWidth: 'calc(100vw - 24px)',
  // A definite height keeps the body scroller from collapsing; the bottom
  // inset stays SURFACE_INSET_PX whatever the top seat.
  height: `min(380px, calc(100% - ${SURFACE_TOP_INSET_PX + SURFACE_INSET_PX}px))`,
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

const BODY_STYLE: CSSProperties = {
  flex: '1 1 auto',
  overflowY: 'auto',
  padding: '10px 12px 12px',
  // 261108-gh0 UAT: the body stacks bordered SECTIONS, each owning a 15px
  // vertical margin. A block container collapses adjacent vertical margins to
  // one 15px gap; a flex column would add them into 30px.
  display: 'block',
};

/**
 * Track spans only — display units (px / percent / degrees). Typed commits
 * stay unclamped (`allowOutOfRangeEntry`), so an out-of-domain number still
 * reaches the command layer and is refused with a sentence, never silently
 * rounded here.
 */
const MOTION_SLIDER_RANGE: Readonly<
  Record<PhysicPaintRotoRailMotionChannelId, { readonly min: number; readonly max: number }>
> = Object.freeze({
  'position-x': { min: -1000, max: 1000 },
  'position-y': { min: -1000, max: 1000 },
  scale: { min: 10, max: 500 },
  rotation: { min: -360, max: 360 },
  opacity: { min: 0, max: 100 },
});

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
const railMotionModalDragOffset = signal<DragOffset | null>(null);
const railMotionModalResizeHeight = signal<number | null>(null);

export function resetRailMotionModalLayout(): void {
  railMotionModalDragOffset.value = null;
  railMotionModalResizeHeight.value = null;
}

interface MotionCommitState {
  readonly reason: string | null;
  readonly rejectionSeq: number;
}

export interface PhysicsPaintRailMotionModalProps {
  /** The Studio's dialog bundle signal, passed by reference (never read there). */
  readonly dialog: ReadonlySignal<RailMotionDialogBundle | null> | null;
  /** The ONE close path: clears the property and the Motion-key selection. */
  readonly onClose?: () => void;
}

export function PhysicsPaintRailMotionModal({
  dialog,
  onClose,
}: PhysicsPaintRailMotionModalProps) {
  // Narrow subscription: this component is the signal's only reader, so frame
  // ticks re-render the small modal and never the Studio view.
  const bundle = dialog?.value ?? null;
  const open = bundle !== null;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const resizeStartRef = useRef<{ pointerY: number; height: number; max: number } | null>(null);
  const commitStateRef = useRef(signal<MotionCommitState>({ reason: null, rejectionSeq: 0 }));
  const commitState = commitStateRef.current;

  const close = () => onClose?.();

  useEffect(() => {
    if (!open) {
      // A closed sheet must leave the order — a stale front id would make the
      // front-only Escape gate inert for every sheet that is still open.
      releaseSheet(SHEET_ID_RAIL_MOTION);
      return undefined;
    }
    bringSheetToFront(SHEET_ID_RAIL_MOTION);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // An editable INSIDE this sheet owns the key: typing a value must never
      // dismiss the modal (the same guard its sibling sheets apply).
      const target = event.target as {
        closest?: (selector: string) => unknown;
      } | null;
      const editable = target?.closest?.('input, textarea, [contenteditable="true"]');
      if (editable) {
        const insideDialog = (editable as { closest?: (selector: string) => unknown })
          .closest?.(`[data-testid="${MODAL_TESTID}"]`);
        if (insideDialog) return;
      }
      // Front-only dismissal — a background Motion modal must not swallow the
      // Escape that belongs to the front sheet.
      if (!closeSheetIfFront(SHEET_ID_RAIL_MOTION, close)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  // A new bundle (frame tick, selection change, rail replacement) shows its own
  // projected values: the last rejection no longer describes what is displayed.
  useEffect(() => {
    const current = commitState.value;
    if (current.reason !== null) {
      commitState.value = { reason: null, rejectionSeq: current.rejectionSeq };
    }
  }, [bundle]);

  if (bundle === null) return null;
  // 261108-d5o: the bundle's key-mode easing handle.
  const keyEasing = bundle.keyEasing;
  // 261108-gh0 UAT: property mode has no selected key, so it gets the
  // motion-wide handle instead — the easing row is ALWAYS reachable now. Key
  // mode still writes only the selected key.
  const rowEasing = keyEasing !== null
    ? { label: 'Easing', easing: keyEasing.easing, set: keyEasing.set }
    : bundle.motionEasing !== null
      ? {
        label: 'Easing (all keys)',
        easing: bundle.motionEasing.easing,
        set: bundle.motionEasing.set,
      }
      : null;
  // 261108-gh0: the explicit apply-all button stays key-mode-only; property
  // mode already applies to all keys through `rowEasing.set`.
  const applyToAllKeys = bundle.applyEasingToAllKeys;

  const onHeaderPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    const base = railMotionModalDragOffset.value;
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
    const next = { dxPx: nextX, dyPx: nextY };
    const current = railMotionModalDragOffset.value;
    if (current !== null && current.dxPx === next.dxPx && current.dyPx === next.dyPx) return;
    railMotionModalDragOffset.value = next;
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
    if (railMotionModalResizeHeight.value === next) return;
    railMotionModalResizeHeight.value = next;
  };

  const endResize = () => {
    resizeStartRef.current = null;
  };

  const applied = railMotionModalDragOffset.value;
  const resizedHeight = railMotionModalResizeHeight.value;

  const reportReason = (nextReason: string | null): void => {
    const current = commitState.value;
    if (nextReason === null) {
      if (current.reason !== null) {
        commitState.value = { reason: null, rejectionSeq: current.rejectionSeq };
      }
      return;
    }
    // Never a silent clamp: surface the command layer's sentence verbatim and
    // bump the sequence so the rejected field remounts at the projected value.
    commitState.value = { reason: nextReason, rejectionSeq: current.rejectionSeq + 1 };
  };

  const commitValue = (channelId: PhysicPaintRotoRailMotionChannelId, uiValue: number): void => {
    reportReason(bundle.commit(channelId, uiValue));
  };

  const resetValues = (): void => {
    reportReason(bundle.reset());
  };

  const { reason, rejectionSeq } = commitState.value;

  return (
    <div
      ref={surfaceRef}
      class="physics-paint-brush-modal"
      data-testid={MODAL_TESTID}
      role="dialog"
      aria-label="Motion"
      onPointerDownCapture={() => bringSheetToFront(SHEET_ID_RAIL_MOTION)}
      style={{
        ...SURFACE_STYLE,
        zIndex: sheetZIndex(SHEET_ID_RAIL_MOTION),
        // 261108-gh0 UAT: the FIRST open sizes itself to its sections; only a
        // drag on the grip pins a height, and that pinned height wins after.
        ...(resizedHeight === null
          ? {
            height: 'auto',
            maxHeight: `calc(100% - ${SURFACE_TOP_INSET_PX + SURFACE_INSET_PX}px)`,
          }
          : { height: `${resizedHeight}px` }),
        transform: `translate(${applied?.dxPx ?? 0}px, ${applied?.dyPx ?? 0}px)`,
      }}
    >
      <div
        class="physics-paint-photo-reference-header"
        data-testid="physics-rail-motion-modal-header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <Move
          size={15}
          class="physics-paint-photo-reference-header-icon"
          aria-hidden="true"
        />
        <strong>Motion</strong>
        <span class="physics-paint-photo-reference-header-spacer" aria-hidden="true" />
        <button
          type="button"
          class="physics-paint-stroke-settings-header-button physics-paint-stroke-settings-header-button--labelled"
          data-testid="physics-rail-motion-modal-reset"
          aria-label="Reset Motion values"
          title="Reset to default — Position 0, Scale 100%, Rotation 0°, Opacity 100% at this frame"
          // The header is the drag handle: stop the press so the click lands.
          onPointerDown={(event) => event.stopPropagation()}
          onClick={resetValues}
        >
          <RotateCcw size={12} aria-hidden="true" />
          <span>Reset</span>
        </button>
        <button
          type="button"
          class="physics-paint-photo-reference-close"
          data-testid="physics-rail-motion-modal-close"
          aria-label="Close"
          title="Close"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={close}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>

      <div style={BODY_STYLE}>
        <section class="physics-paint-motion-section" aria-label="Position">
          <span class="physics-paint-motion-section-title">Position</span>
          {bundle.presentation.fields
            .filter((field) => field.present)
            .map((field) => {
              const range = MOTION_SLIDER_RANGE[field.channelId];
              // The plain wrapper mirrors the Stroke settings rows: SliderStepper
              // carries `flex: 1 1 0`, so as a direct flex-column child it would
              // grow to fill the sheet instead of hugging its own two lines.
              return (
                <div key={field.channelId} class="physics-paint-motion-field">
                  <SliderStepper
                    key={`${field.channelId}:${rejectionSeq}`}
                    label={`${field.label} (${field.unit})`}
                    ariaLabel={field.label}
                    value={field.value}
                    min={range.min}
                    max={range.max}
                    step={1}
                    precision={3}
                    freeEntry
                    allowOutOfRangeEntry
                    commitOnRelease
                    onChange={(value) => commitValue(field.channelId, value)}
                  />
                </div>
              );
            })}
        </section>
        {rowEasing !== null ? (
          <section class="physics-paint-motion-section" aria-label="Keys">
            <span class="physics-paint-motion-section-title">Keys</span>
            <PhysicsPaintRailMotionEasingControl
              value={rowEasing.easing}
              keyFrame={keyEasing?.frame ?? null}
              onSelect={(
                easing: PhysicPaintRotoRailMotionEasing,
                target: 'key' | 'all',
              ) => {
                // One row, two targets: `key` writes the selected key, `all`
                // writes every key of the motion — same command authority.
                const rejection = target === 'key'
                  ? keyEasing?.set(easing) ?? null
                  : applyToAllKeys?.(easing) ?? bundle.motionEasing?.set(easing) ?? null;
                if (rejection !== null) reportReason(rejection);
              }}
            />
          </section>
        ) : null}
        {bundle.channels.length > 0 ? (
          <section class="physics-paint-motion-section" aria-label="Wiggle">
            <span class="physics-paint-motion-section-title">Wiggle</span>
            {bundle.channels.map((row) => (
              // The rejection sequence remounts the rejected row at the
              // projected value, exactly like the numeric fields above.
              <div
                key={`${row.channelId}:${rejectionSeq}`}
                class="physics-paint-motion-field physics-paint-motion-wiggle"
              >
                <div class="physics-paint-motion-wiggle-row">
                  <SliderStepper
                    label={`${row.label} wiggle`}
                    ariaLabel={`${row.label} wiggle`}
                    value={row.wiggle}
                    min={0}
                    // 261108-gh0 UAT: a gesture range, not the stored 0..1e6 cap.
                    max={row.wiggleMax}
                    sliderMax={row.wiggleMax}
                    step={1}
                    precision={0}
                    freeEntry
                    allowOutOfRangeEntry
                    commitOnRelease
                    onChange={(value) => reportReason(row.setWiggle(value))}
                  />
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button physics-paint-motion-wiggle-global"
                    data-motion-wiggle-global={row.channelId}
                    aria-pressed={row.wiggleGlobal ? 'true' : 'false'}
                    title={row.wiggleGlobal
                      ? 'Wiggle applies to the whole rail — click for the per-key span wiggle'
                      : 'Wiggle follows each key span — click to apply it to the whole rail'}
                    onClick={() => reportReason(row.setWiggleGlobal(!row.wiggleGlobal))}
                  >
                    Global
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}
        {reason !== null ? (
          <p class="physics-paint-motion-rejection" role="alert">{reason}</p>
        ) : null}
      </div>

      <div
        data-testid="physics-rail-motion-modal-resize"
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
