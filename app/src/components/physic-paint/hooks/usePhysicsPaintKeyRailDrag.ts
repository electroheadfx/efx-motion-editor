import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

/** Horizontal travel in CSS pixels that must be exceeded before dragging starts. */
export const KEY_RAIL_DRAG_THRESHOLD_PX = 4;

/**
 * Presentation-only Key Rail ghost geometry. Consumed for paint only; never for
 * canonical revision, history, persistence, or commit authorization.
 */
export interface KeyRailDragGhostState {
  readonly active: boolean;
  readonly left: number;
  readonly width: number;
  readonly blockedEdge: 'left' | 'right' | null;
}

/**
 * Presentation-only drag preview. The publication is retained exactly as
 * prepared and is never recomputed by the commit path.
 */
export interface KeyRailDragPreviewState<Publication> {
  readonly publication: Publication;
}

/** Minimal injectable window surface for node-testable pointer sessions. */
export interface KeyRailDragWindowLike {
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

/** Minimal injectable source-element surface used by the Key Rail target. */
export interface KeyRailDragSourceElement {
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

export interface KeyRailDragProjectionInput {
  readonly originClientX: number;
  readonly clientX: number;
}

export interface KeyRailDragClampResult {
  readonly destination: number;
  readonly left: number;
  readonly width: number;
  readonly blockedEdge: 'left' | 'right' | null;
}

export type KeyRailDragPreparationResult<Publication> =
  | Readonly<{ ok: true; publication: Publication }>
  | Readonly<{ ok: false; reason?: string; detail?: string }>;

export interface KeyRailDragSessionInput<Publication> {
  readonly projectDestination: (input: KeyRailDragProjectionInput) => number;
  readonly clampDestination: (proposedDestination: number) => KeyRailDragClampResult;
  readonly prepareAtDestination: (
    destination: number,
  ) => KeyRailDragPreparationResult<Publication>;
  readonly onDropCommit: (publication: Publication) => Promise<boolean>;
  readonly onCancel?: () => void;
  readonly onRejected?: (reason?: string, detail?: string) => void;
  readonly onPreviewChange?: (preview: KeyRailDragPreviewState<Publication> | null) => void;
  /** Cancels any rail-host click timer when the pointer crosses the threshold. */
  readonly clearClickSequence: () => void;
  readonly windowLike?: KeyRailDragWindowLike;
}

export interface KeyRailDragSessionApi<Publication> {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly ghost: KeyRailDragGhostState;
  readonly preview: KeyRailDragPreviewState<Publication> | null;
  /** Returns true exactly once for the browser click dispatched after a drop. */
  readonly consumeClickSuppression: () => boolean;
}

interface KeyRailDragSession<Publication> {
  readonly pointerId: number;
  readonly sourceElement: KeyRailDragSourceElement;
  readonly originX: number;
  latestX: number;
  started: boolean;
  publication: Publication | null;
  rejection: { readonly reason?: string; readonly detail?: string } | null;
  priorCursor: string | null;
  cleanup: () => void;
}

const GHOST_INACTIVE: KeyRailDragGhostState = Object.freeze({
  active: false,
  left: 0,
  width: 0,
  blockedEdge: null,
});

/**
 * Source-attached Key Rail pointer-session state machine. Resolver, store, and
 * model concerns enter only through injected projection, clamp, prepare, and
 * commit ports; the hook owns gesture lifecycle and presentation state only.
 */
export function usePhysicsPaintKeyRailDrag<Publication>(
  input: KeyRailDragSessionInput<Publication>,
): KeyRailDragSessionApi<Publication> {
  const sessionRef = useRef<KeyRailDragSession<Publication> | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghost = useSignal<KeyRailDragGhostState>(GHOST_INACTIVE);
  const preview = useSignal<KeyRailDragPreviewState<Publication> | null>(null);
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

    const sourceElement = event.currentTarget as unknown as KeyRailDragSourceElement;
    let active = true;
    const session: KeyRailDragSession<Publication> = {
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
      ghost.value = GHOST_INACTIVE;
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
      const proposedDestination = input.projectDestination({
        originClientX: session.originX,
        clientX: session.latestX,
      });
      const clamped = input.clampDestination(proposedDestination);
      const preparation = input.prepareAtDestination(clamped.destination);
      if (!preparation.ok) {
        session.publication = null;
        session.rejection = { reason: preparation.reason, detail: preparation.detail };
        clearPaint();
        return;
      }
      session.publication = preparation.publication;
      session.rejection = null;
      const nextPreview = Object.freeze({ publication: preparation.publication });
      ghost.value = Object.freeze({
        active: true,
        left: clamped.left,
        width: clamped.width,
        blockedEdge: clamped.blockedEdge,
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
      if (!session.started && Math.abs(session.latestX - session.originX) > KEY_RAIL_DRAG_THRESHOLD_PX) {
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
