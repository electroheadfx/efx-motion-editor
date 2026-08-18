import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

/**
 * Horizontal travel in CSS pixels that must be exceeded before a push drag
 * session starts. Horizontal-only, like GROUP_RAIL_DRAG_THRESHOLD_PX (43.3
 * PATTERNS); the 6px Euclidean ROTO_DRAG_THRESHOLD_PX belongs to the locked
 * physical-cell drag path and stays untouched.
 */
export const PUSH_DRAG_THRESHOLD_PX = 4;

/**
 * Presentation-only push ghost state (D-11). Consumed for paint only — the
 * strip paints per-object ghosts from the retained publication plus this signed
 * clamped delta; never canonical revision, history, persistence, or commit
 * authorization (T-43.5-03).
 */
export interface PushDragGhostState {
  readonly active: boolean;
  /** Signed clamped frame delta — positive for Push Right, negative for Push Left. */
  readonly deltaFrames: number;
  /**
   * Which edge the clamp bound against (the red blocked-edge treatment, G4).
   * Null when the ghost is unclamped.
   */
  readonly blockedEdge: 'left' | 'right' | null;
}

/**
 * Presentation-only push preview. The publication is retained exactly as
 * prepared and is never recomputed by the commit path.
 */
export interface PushDragPreviewState<Publication> {
  readonly publication: Publication;
}

/** Minimal injectable window surface for node-testable pointer sessions. */
export interface PushDragWindowLike {
  addEventListener(
    type: string,
    listener: (event: any) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: any) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  setTimeout(handler: () => void, timeout?: number): number;
}

/**
 * Minimal injectable source-element surface. For push the anchor is any
 * non-empty cell frame OR rail band (D-07) — the caller resolves the anchor and
 * hands the hook the source element the pointer landed on; the hook never
 * derives canonical facts itself.
 */
export interface PushDragSourceElement {
  readonly style?: { cursor: string };
  setPointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
  releasePointerCapture(pointerId: number): void;
  addEventListener(
    type: string,
    listener: (event: any) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: any) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  focus(): void;
}

export interface PushDragProjectionInput {
  readonly originClientX: number;
  readonly clientX: number;
}

/**
 * Clamped push projection. The clamp authority is the resolver's exported pure
 * clamp (clampPhysicPaintPushDestination, 43.5-01) wired by the caller — this
 * hook never reimplements clamp math. The clamped signed delta is the ONLY value
 * forwarded to prepare (preview-is-the-commit, D-14).
 */
export interface PushDragClampResult {
  /** Signed clamped frame delta — positive for Push Right, negative for Push Left. */
  readonly deltaFrames: number;
  readonly blockedEdge: 'left' | 'right' | null;
}

export type PushDragPreparationResult<Publication> =
  | Readonly<{ ok: true; publication: Publication }>
  | Readonly<{ ok: false; reason?: string; detail?: string }>;

/** The push drag direction, chosen by the drag sign and locked on drag start. */
export type PushToolDirection = 'right' | 'left';

export interface PushDragSessionInput<Publication> {
  /** Projects horizontal pointer travel to a SIGNED frame delta (positive = right, negative = left). */
  readonly projectDestination: (input: PushDragProjectionInput) => number;
  /** Clamps the proposed signed delta for the locked drag direction; the result is consumed for paint AND forwarded to prepare. */
  readonly clampDestination: (proposedDeltaFrames: number, direction: PushToolDirection) => PushDragClampResult;
  /**
   * Prepares the retained publication for the clamped signed delta and the
   * locked drag direction. The caller binds the resolved anchor (the selected
   * Rail) into this closure (D-07) — the hook accepts the resolved anchor from
   * its caller and never derives canonical facts itself.
   */
  readonly prepareAtDestination: (deltaFrames: number, direction: PushToolDirection) => PushDragPreparationResult<Publication>;
  readonly onDropCommit: (publication: Publication) => Promise<boolean>;
  readonly onCancel?: () => void;
  readonly onRejected?: (reason?: string, detail?: string) => void;
  /** Called while the drag is live when prepare rejects (e.g. a blocked
   *  direction) — the caller shows the guarded tooltip for that direction. */
  readonly onBlocked?: (reason?: string, detail?: string) => void;
  readonly onPreviewChange?: (preview: PushDragPreviewState<Publication> | null) => void;
  /** Cancels any pending cell/rail click work when the pointer crosses the threshold. */
  readonly clearClickSequence: () => void;
  readonly windowLike?: PushDragWindowLike;
}

export interface PushDragSessionApi<Publication> {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly ghost: PushDragGhostState;
  readonly preview: PushDragPreviewState<Publication> | null;
  /** Returns true exactly once for the browser click dispatched after a drop. */
  readonly consumeClickSuppression: () => boolean;
}

interface PushDragSession<Publication> {
  readonly pointerId: number;
  readonly sourceElement: PushDragSourceElement;
  readonly originX: number;
  latestX: number;
  started: boolean;
  /** Locked on drag start from the drag sign; null until the drag begins. */
  direction: PushToolDirection | null;
  publication: Publication | null;
  rejection: { readonly reason?: string; readonly detail?: string } | null;
  priorCursor: string | null;
  cleanup: () => void;
}

const PUSH_GHOST_INACTIVE: PushDragGhostState = Object.freeze({
  active: false,
  deltaFrames: 0,
  blockedEdge: null,
});

/**
 * Armed push drag gesture session (43.5-04). Structurally mirrors the
 * UAT-approved usePhysicsPaintKeyRailDrag session: arm on pointer-down with no
 * modifiers, track with window pointermove/pointerup/pointercancel plus
 * capture-phase Escape and lostpointercapture, start only after more than 4px
 * horizontal travel, retain the prepared publication, and commit it on drop.
 * Resolver, store, and model concerns enter only through injected projection,
 * clamp, prepare, and commit ports; the hook owns gesture lifecycle and
 * presentation state only (T-43.5-02).
 */
export function usePhysicsPaintPushDrag<Publication>(
  input: PushDragSessionInput<Publication>,
): PushDragSessionApi<Publication> {
  const sessionRef = useRef<PushDragSession<Publication> | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghost = useSignal<PushDragGhostState>(PUSH_GHOST_INACTIVE);
  const preview = useSignal<PushDragPreviewState<Publication> | null>(null);
  const win = input.windowLike ?? (typeof window !== 'undefined' ? window : undefined);

  const consumeClickSuppression = () => {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    return true;
  };

  const onPointerDown = (event: PointerEvent) => {
    event.stopPropagation();
    if (!event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (!win || sessionRef.current) return;

    const sourceElement = event.currentTarget as unknown as PushDragSourceElement;
    let active = true;
    const session: PushDragSession<Publication> = {
      pointerId: event.pointerId,
      sourceElement,
      originX: event.clientX,
      latestX: event.clientX,
      started: false,
      direction: null,
      publication: null,
      rejection: null,
      priorCursor: null,
      cleanup: () => {},
    };

    const clearSuppressionSoon = () => {
      win.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    };
    const restoreSourceFocus = () => {
      try {
        sourceElement.focus();
      } catch {
        // The source target may have unmounted while the session was active.
      }
    };
    const clearPaint = () => {
      ghost.value = PUSH_GHOST_INACTIVE;
      preview.value = null;
      input.onPreviewChange?.(null);
    };
    const cleanup = () => {
      if (!active) return;
      active = false;
      win.removeEventListener('pointermove', handlePointerMove);
      win.removeEventListener('pointerup', handlePointerUp);
      win.removeEventListener('pointercancel', handlePointerCancel);
      win.removeEventListener('keydown', handleEscape, true);
      sourceElement.removeEventListener('lostpointercapture', handleLostPointerCapture);
      if (sourceElement.hasPointerCapture(session.pointerId)) {
        sourceElement.releasePointerCapture(session.pointerId);
      }
      if (sourceElement.style && session.priorCursor !== null) {
        sourceElement.style.cursor = session.priorCursor;
      }
      if (sessionRef.current === session) sessionRef.current = null;
      if (session.started) clearPaint();
    };
    const prepareAtPointer = () => {
      const rawDelta = input.projectDestination({
        originClientX: session.originX,
        clientX: session.latestX,
      });
      const direction = session.direction ?? 'right';
      // Clamp the raw delta to the locked direction — reverse travel no-ops.
      const delta = direction === 'right' ? Math.max(0, rawDelta) : Math.min(0, rawDelta);
      const clamped = input.clampDestination(delta, direction);
      const preparation = input.prepareAtDestination(clamped.deltaFrames, direction);
      if (!preparation.ok) {
        session.publication = null;
        session.rejection = { reason: preparation.reason, detail: preparation.detail };
        clearPaint();
        input.onBlocked?.(preparation.reason, preparation.detail);
        return;
      }
      session.publication = preparation.publication;
      session.rejection = null;
      const nextPreview = Object.freeze({ publication: preparation.publication });
      ghost.value = Object.freeze({
        active: true,
        deltaFrames: clamped.deltaFrames,
        blockedEdge: clamped.blockedEdge,
      });
      preview.value = nextPreview;
      input.onPreviewChange?.(nextPreview);
    };
    const beginDrag = () => {
      if (session.started) return false;
      session.started = true;
      // Lock the direction from the drag sign (right if the pointer moved right).
      session.direction = session.latestX >= session.originX ? 'right' : 'left';
      try {
        sourceElement.setPointerCapture(session.pointerId);
      } catch {
        session.started = false;
        cleanup();
        return false;
      }
      if (sourceElement.style) {
        session.priorCursor = sourceElement.style.cursor;
        sourceElement.style.cursor = 'grabbing';
      }
      // Suppression arms only when a drag session actually started past the
      // threshold — a sub-threshold plain click never arms it, so the click
      // passes through unsuppressed and normal frame navigation proceeds (D-09).
      suppressNextClickRef.current = true;
      input.clearClickSequence();
      return true;
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      session.latestX = moveEvent.clientX;
      if (!session.started && Math.abs(session.latestX - session.originX) > PUSH_DRAG_THRESHOLD_PX) {
        if (!beginDrag()) return;
      }
      if (!session.started) return;
      moveEvent.preventDefault();
      prepareAtPointer();
    };
    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      session.latestX = upEvent.clientX;
      if (!session.started) {
        cleanup();
        return;
      }
      upEvent.preventDefault();
      const retainedPublication = session.publication;
      const retainedRejection = session.rejection;
      cleanup();
      clearSuppressionSoon();
      if (retainedPublication === null) {
        restoreSourceFocus();
        input.onRejected?.(retainedRejection?.reason, retainedRejection?.detail);
        return;
      }
      void input.onDropCommit(retainedPublication)
        .then((accepted) => {
          if (!accepted) restoreSourceFocus();
        })
        .catch(() => {
          // Transport or coordinator failures reject the commit port. The
          // accepted rail remains authoritative; restore keyboard focus and
          // leave no session paint behind.
          restoreSourceFocus();
        });
    };
    const cancelSession = () => {
      const started = session.started;
      cleanup();
      if (started) {
        clearSuppressionSoon();
        input.onCancel?.();
      }
      restoreSourceFocus();
    };
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      cancelSession();
    };
    const handleLostPointerCapture = () => {
      if (sessionRef.current !== session) return;
      cancelSession();
    };
    const handleEscape = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape' || sessionRef.current !== session) return;
      keyEvent.preventDefault();
      keyEvent.stopImmediatePropagation();
      cancelSession();
    };

    session.cleanup = cleanup;
    sessionRef.current = session;
    win.addEventListener('pointermove', handlePointerMove, { passive: false });
    win.addEventListener('pointerup', handlePointerUp);
    win.addEventListener('pointercancel', handlePointerCancel);
    win.addEventListener('keydown', handleEscape, true);
    sourceElement.addEventListener('lostpointercapture', handleLostPointerCapture);
  };

  useEffect(() => () => {
    sessionRef.current?.cleanup();
  }, []);

  return {
    onPointerDown,
    ghost: ghost.value,
    preview: preview.value,
    consumeClickSuppression,
  };
}
