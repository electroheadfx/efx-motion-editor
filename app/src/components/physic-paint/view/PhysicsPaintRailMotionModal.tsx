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
import type { CSSProperties } from 'preact';
import { signal, type ReadonlySignal } from '@preact/signals';
import { Move, X } from 'lucide-preact';
import { NumericStepper } from '../../shared/NumericStepper';
import {
  SHEET_ID_RAIL_MOTION,
  bringSheetToFront,
  closeSheetIfFront,
  releaseSheet,
  sheetZIndex,
} from './floatingSheetStack';
import type { RailMotionDialogBundle } from './physicsPaintKeyRailPresentation';
import type { PhysicPaintRotoRailMotionChannelId } from '../roto/railMotionModel';

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
  width: '300px',
  maxWidth: 'calc(100vw - 24px)',
  // A definite height keeps the body scroller from collapsing; the bottom
  // inset stays SURFACE_INSET_PX whatever the top seat.
  height: `min(260px, calc(100% - ${SURFACE_TOP_INSET_PX + SURFACE_INSET_PX}px))`,
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
};

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

  const commitValue = (channelId: PhysicPaintRotoRailMotionChannelId, uiValue: number): void => {
    const reason = bundle.commit(channelId, uiValue);
    const current = commitState.value;
    if (reason === null) {
      if (current.reason !== null) {
        commitState.value = { reason: null, rejectionSeq: current.rejectionSeq };
      }
      return;
    }
    // Never a silent clamp: surface the command layer's sentence verbatim and
    // bump the sequence so the rejected field remounts at the projected value.
    commitState.value = { reason, rejectionSeq: current.rejectionSeq + 1 };
  };

  const { reason, rejectionSeq } = commitState.value;

  return (
    <div
      class="physics-paint-brush-modal"
      data-testid={MODAL_TESTID}
      role="dialog"
      aria-label="Motion"
      onPointerDownCapture={() => bringSheetToFront(SHEET_ID_RAIL_MOTION)}
      style={{ ...SURFACE_STYLE, zIndex: sheetZIndex(SHEET_ID_RAIL_MOTION) }}
    >
      <div
        class="physics-paint-photo-reference-header"
        data-testid="physics-rail-motion-modal-header"
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
        {bundle.presentation.fields
          .filter((field) => field.present)
          .map((field) => (
            <div key={field.channelId} class="physics-paint-motion-field">
              <span class="physics-paint-motion-field-label">
                {field.label} ({field.unit})
              </span>
              <NumericStepper
                key={`${field.channelId}:${rejectionSeq}`}
                ariaLabel={field.label}
                value={field.value}
                freeEntry
                step={1}
                precision={3}
                onChange={(value) => commitValue(field.channelId, value)}
              />
            </div>
          ))}
        {reason !== null ? (
          <p class="physics-paint-motion-rejection" role="alert">{reason}</p>
        ) : null}
      </div>
    </div>
  );
}
