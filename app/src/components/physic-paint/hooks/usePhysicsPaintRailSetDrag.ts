import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

/** Horizontal travel in CSS pixels that must be exceeded before dragging starts. */
export const RAIL_SET_DRAG_THRESHOLD_PX = 4;

/** A would-open gap interval in frames, previewed as roto-fill-empty cells. */
export interface RailSetDragGapInterval {
  readonly start: number;
  readonly end: number;
}

/**
 * Presentation-only SET-level drag preview. Per-member ghost geometry is
 * derived by the strip from the member intervals + delta; the hook owns the
 * set-level result only. Consumed for paint only; never for canonical
 * revision, history, persistence, or commit authorization.
 */
export interface RailSetDragPreviewState {
  readonly delta: number;
  readonly blockedEdge: 'left' | 'right' | null;
  readonly collidingMemberId: string | null;
  readonly gapIntervals: readonly RailSetDragGapInterval[];
}

/** Minimal injectable window surface for node-testable pointer sessions. */
export interface RailSetDragWindowLike {
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

/** Minimal injectable source-element surface used by the rail targets. */
export interface RailSetDragSourceElement {
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

export interface RailSetDragProjectionInput {
  readonly originClientX: number;
  readonly clientX: number;
}

export interface RailSetDragClampResult {
  readonly delta: number;
  readonly blockedEdge: 'left' | 'right' | null;
  readonly collidingMemberId: string | null;
}

export type RailSetDragPreparationResult<Publication> =
  | Readonly<{ ok: true; publication: Publication }>
  | Readonly<{ ok: false; reason?: string; detail?: string }>;

/**
 * The prepared publication must carry the would-open gap intervals so the
 * hook can own the set-level preview state (D-09); the strip derives per-member
 * ghost geometry from the delta, never from the hook.
 */
export interface RailSetDragPublication {
  readonly gapIntervals: readonly RailSetDragGapInterval[];
}

export interface RailSetDragSessionInput<Publication extends RailSetDragPublication> {
  readonly projectDelta: (input: RailSetDragProjectionInput) => number;
  readonly clampDelta: (proposedDelta: number) => RailSetDragClampResult;
  readonly prepareAtDelta: (delta: number) => RailSetDragPreparationResult<Publication>;
  readonly onDropCommit: (publication: Publication) => Promise<boolean>;
  readonly onCancel?: () => void;
  readonly onRejected?: (reason?: string, detail?: string) => void;
  readonly onPreviewChange?: (preview: RailSetDragPreviewState | null) => void;
  /** Cancels any rail-host click timer when the pointer crosses the threshold. */
  readonly clearClickSequence: () => void;
  readonly windowLike?: RailSetDragWindowLike;
}

export interface RailSetDragSessionApi {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly preview: RailSetDragPreviewState | null;
  /** Returns true exactly once for the browser click dispatched after a drop. */
  readonly consumeClickSuppression: () => boolean;
}

interface RailSetDragSession<Publication extends RailSetDragPublication> {
  readonly pointerId: number;
  readonly sourceElement: RailSetDragSourceElement;
  readonly originX: number;
  latestX: number;
  started: boolean;
  publication: Publication | null;
  rejection: { readonly reason?: string; readonly detail?: string } | null;
  priorCursor: string | null;
  cleanup: () => void;
}

/**
 * Batch rail-set pointer-session state machine (D-08/D-09/D-13). Resolver,
 * store, and model concerns enter only through injected projection, clamp,
 * prepare, and commit ports; the hook owns gesture lifecycle and the set-level
 * preview state only. Preview-is-the-commit: the publication prepared during
 * the drag is retained exactly and committed at pointer-up, never recomputed.
 */
export function usePhysicsPaintRailSetDrag<Publication extends RailSetDragPublication>(
  input: RailSetDragSessionInput<Publication>,
): RailSetDragSessionApi {
  const sessionRef = useRef<RailSetDragSession<Publication> | null>(null);
  const suppressNextClickRef = useRef(false);
  const preview = useSignal<RailSetDragPreviewState | null>(null);
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

    const sourceElement = event.currentTarget as unknown as RailSetDragSourceElement;
    let active = true;
    const session: RailSetDragSession<Publication> = {
      pointerId: event.pointerId,
      sourceElement,
      originX: event.clientX,
      latestX: event.clientX,
      started: false,
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
      const proposedDelta = input.projectDelta({
        originClientX: session.originX,
        clientX: session.latestX,
      });
      const clamped = input.clampDelta(proposedDelta);
      if (clamped.delta === 0) {
        // D-13 zero-delta: no publication, no preview, no rejection — the drop
        // publishes nothing and reports neither rejection nor success.
        session.publication = null;
        session.rejection = null;
        clearPaint();
        return;
      }
      const preparation = input.prepareAtDelta(clamped.delta);
      if (!preparation.ok) {
        session.publication = null;
        session.rejection = { reason: preparation.reason, detail: preparation.detail };
        clearPaint();
        return;
      }
      session.publication = preparation.publication;
      session.rejection = null;
      const nextPreview = Object.freeze({
        delta: clamped.delta,
        blockedEdge: clamped.blockedEdge,
        collidingMemberId: clamped.collidingMemberId,
        gapIntervals: Object.freeze([...preparation.publication.gapIntervals]),
      });
      preview.value = nextPreview;
      input.onPreviewChange?.(nextPreview);
    };
    const beginDrag = () => {
      if (session.started) return false;
      session.started = true;
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
      suppressNextClickRef.current = true;
      input.clearClickSequence();
      return true;
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      session.latestX = moveEvent.clientX;
      if (!session.started && Math.abs(session.latestX - session.originX) > RAIL_SET_DRAG_THRESHOLD_PX) {
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
        if (retainedRejection !== null) {
          input.onRejected?.(retainedRejection.reason, retainedRejection.detail);
        }
        return;
      }
      void input.onDropCommit(retainedPublication)
        .then((accepted) => {
          if (!accepted) restoreSourceFocus();
        })
        .catch(() => {
          // Transport or coordinator failures reject the commit port. The
          // accepted document remains authoritative; restore keyboard focus
          // and leave no session paint behind.
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
    preview: preview.value,
    consumeClickSuppression,
  };
}
