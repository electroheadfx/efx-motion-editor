/**
 * 49-05 Task 2 (S4): the row-local Background clip rail drag gesture.
 *
 * Adapts the Phase 43 `usePhysicsPaintKeyRailDrag` machinery to the single
 * fixed Background row (D-05/D-06): a pointer-down on a Bg clip rail starts a
 * live preview that follows the pointer along the Bg row's 18px frame pitch
 * ONLY (row-fixed law — vertical movement is ignored for commit purposes), and
 * release commits through the injected store port exactly once. The document
 * is NEVER mutated during the gesture (release-time commit only, Phase 43
 * contract); the preview is paint/projection only and reads resolver facts via
 * the injected `prepareAtDestination` port — the hook never computes loop math
 * (capsule-never-math, Pitfall 10).
 *
 * Row-fixed boundary (Phase 47 D-15): the Bg row is fixed and drag is
 * row-local. This hook exposes NO cross-track signals (`destinationTrackId`,
 * `insertionFrame`, `isCrossing`) and never enters the cross-track machinery —
 * the structural contract test asserts the API surface. `onPointerDown`
 * stops propagation so the rows-region cross-track listener never sees the
 * gesture.
 *
 * Rejection law (BKG-03/D-04, symmetric with the import path): a landing frame
 * strictly inside another clip rejects through the injected `onRejected` port
 * with the store's `'start-collision'` reason; the strip maps it to the locked
 * drag copy. A net-zero move (release at the source's own start frame) never
 * calls the store port (gesture-level idempotence). A sub-threshold release
 * (a click) routes to the injected `onSelectClip` port — the clip-selection
 * signal consumed by 49-06's right panel — without any store call.
 */

import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

/** Horizontal travel in CSS pixels that must be exceeded before dragging starts. */
export const BACKGROUND_CLIP_DRAG_THRESHOLD_PX = 4;

/** The drag source resolved from a pressed Bg clip rail element. */
export interface BackgroundClipDragSource {
  readonly clipId: string;
  /** The clip's CURRENT start frame — the net-zero idempotence anchor. */
  readonly startFrame: number;
}

/** The prepared drag publication — the exact payload the commit port receives. */
export interface BackgroundClipDragPublication {
  readonly clipId: string;
  readonly landingFrame: number;
}

/** Presentation-only ghost geometry. Consumed for paint only; never for
 *  canonical revision, history, persistence, or commit authorization. */
export interface BackgroundClipDragGhostState {
  readonly active: boolean;
  readonly left: number;
  readonly width: number;
  readonly blockedEdge: 'left' | 'right' | null;
}

/** Presentation-only drag preview. The publication is retained exactly as
 *  prepared and is never recomputed by the commit path. */
export interface BackgroundClipDragPreviewState {
  readonly publication: BackgroundClipDragPublication;
}

/** Minimal injectable window surface for node-testable pointer sessions. */
export interface BackgroundClipDragWindowLike {
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

/** Minimal injectable source-element surface used by the Bg clip rail target. */
export interface BackgroundClipDragSourceElement {
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

/** Row-fixed projection input: horizontal geometry ONLY — vertical pointer
 *  movement can never influence the landing frame (row-fixed law). */
export interface BackgroundClipDragProjectionInput {
  readonly originClientX: number;
  readonly clientX: number;
}

export interface BackgroundClipDragClampResult {
  readonly destination: number;
  readonly left: number;
  readonly width: number;
  readonly blockedEdge: 'left' | 'right' | null;
}

export type BackgroundClipDragPreparationResult =
  | Readonly<{ ok: true; publication: BackgroundClipDragPublication }>
  | Readonly<{ ok: false; reason?: string; detail?: string }>;

/** Structural subset of the store's `BackgroundClipMutationResult` — the hook
 *  never computes move semantics; the store verdict is the single gate. */
export type BackgroundClipDragCommitResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason?: string }>;

export interface BackgroundClipDragInput {
  /** Test-injected event surface; defaults to `window` when available. */
  readonly windowLike?: BackgroundClipDragWindowLike;
  /** Resolve the drag source from the pressed element; null ignores the press. */
  readonly resolveSource: (event: PointerEvent) => BackgroundClipDragSource | null;
  /** Row-fixed landing-frame projection from horizontal pointer geometry. */
  readonly projectDestination: (input: BackgroundClipDragProjectionInput) => number;
  /** Clamp the proposed landing frame to the row's valid extent. */
  readonly clampDestination: (proposedDestination: number) => BackgroundClipDragClampResult;
  /** Prepare the preview publication at a destination — reads resolver facts,
   *  never computes loop math (capsule-never-math). */
  readonly prepareAtDestination: (destination: number) => BackgroundClipDragPreparationResult;
  /** The single commit path — the strip wires it to
   *  `efxPaintStore.moveBackgroundClip(layerId, clipId, landingFrame)`. Called
   *  exactly once per dragged release; never during the gesture. */
  readonly onDropCommit: (publication: BackgroundClipDragPublication) => BackgroundClipDragCommitResult;
  /** Rejection publisher — the strip maps `'start-collision'` to the locked
   *  drag copy through the status capsule. */
  readonly onRejected?: (reason?: string, detail?: string) => void;
  /** Live preview publication publisher (paint only). */
  readonly onPreviewChange?: (preview: BackgroundClipDragPreviewState | null) => void;
  /** Click routing — a sub-threshold release selects the clip (49-06's right
   *  panel) without any store call. */
  readonly onSelectClip?: (clipId: string) => void;
  /** Cancels any rail-host click timer when the pointer crosses the threshold. */
  readonly clearClickSequence: () => void;
  readonly onCancel?: () => void;
}

export interface BackgroundClipDragApi {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly ghost: BackgroundClipDragGhostState;
  readonly preview: BackgroundClipDragPreviewState | null;
  /** Returns true exactly once for the browser click dispatched after a drop. */
  readonly consumeClickSuppression: () => boolean;
}

interface BackgroundClipDragSession {
  readonly pointerId: number;
  readonly sourceElement: BackgroundClipDragSourceElement;
  readonly source: BackgroundClipDragSource;
  readonly originX: number;
  latestX: number;
  started: boolean;
  publication: BackgroundClipDragPublication | null;
  rejection: { readonly reason?: string; readonly detail?: string } | null;
  priorCursor: string | null;
  cleanup: () => void;
}

const GHOST_INACTIVE: BackgroundClipDragGhostState = Object.freeze({
  active: false,
  left: 0,
  width: 0,
  blockedEdge: null,
});

/**
 * Source-attached Bg clip rail pointer-session state machine. Resolver, store,
 * and model concerns enter only through injected projection, clamp, prepare,
 * and commit ports; the hook owns gesture lifecycle and presentation state
 * only. Row-fixed by construction: no cross-track signals, no vertical
 * projection, no document mutation before release.
 */
export function usePhysicsPaintBackgroundClipDrag(
  input: BackgroundClipDragInput,
): BackgroundClipDragApi {
  const sessionRef = useRef<BackgroundClipDragSession | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghost = useSignal<BackgroundClipDragGhostState>(GHOST_INACTIVE);
  const preview = useSignal<BackgroundClipDragPreviewState | null>(null);
  const win = input.windowLike ?? (typeof window !== 'undefined' ? window : undefined);

  const consumeClickSuppression = () => {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    return true;
  };

  const onPointerDown = (event: PointerEvent) => {
    // Row-fixed boundary: stop propagation so the rows-region cross-track
    // listener never sees a Bg rail gesture (Phase 47 D-15).
    event.stopPropagation();
    if (!event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (!win || sessionRef.current) return;
    const source = input.resolveSource(event);
    if (!source) return;

    const sourceElement = event.currentTarget as unknown as BackgroundClipDragSourceElement;
    let active = true;
    const session: BackgroundClipDragSession = {
      pointerId: event.pointerId,
      sourceElement,
      source,
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
      if (!session.started && Math.abs(session.latestX - session.originX) > BACKGROUND_CLIP_DRAG_THRESHOLD_PX) {
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
        // A sub-threshold release is a CLICK — route it to clip selection
        // (49-06's right panel) without any store call.
        cleanup();
        input.onSelectClip?.(session.source.clipId);
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
      // Net-zero move idempotence at the gesture level: a release at the
      // source's own start frame never calls the store port.
      if (retainedPublication.landingFrame === session.source.startFrame) {
        restoreSourceFocus();
        return;
      }
      let result: BackgroundClipDragCommitResult;
      try {
        result = input.onDropCommit(retainedPublication);
      } catch {
        // Transport or coordinator failures reject the commit port. The
        // accepted rail remains authoritative; restore keyboard focus and
        // leave no session paint behind.
        restoreSourceFocus();
        return;
      }
      if (!result.ok) {
        restoreSourceFocus();
        input.onRejected?.(result.reason);
      }
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
