/**
 * 49-06 (UAT round 2): the row-local Background clip RESIZE gesture.
 *
 * The Bg clip renders as a group of individual cells; the FIRST and LAST cells
 * are resize handles. A pointer-down on a handle starts a live preview that
 * follows the pointer along the Bg row's 18px frame pitch ONLY (row-fixed law —
 * vertical movement is ignored for commit purposes), and release commits through
 * the injected store port exactly once. The document is NEVER mutated during
 * the gesture (release-time commit only, Phase 43 contract); the preview is
 * paint/projection only and reads resolver facts via the injected
 * `prepareAtFrame` port — the hook never computes loop math (capsule-never-math,
 * Pitfall 10).
 *
 * Edge semantics:
 * - `start` edge: the new START frame follows the pointer; the clip's end stays
 *   put. Commit routes to `moveBackgroundClip(layerId, clipId, newStartFrame)`.
 * - `end` edge: the new END frame follows the pointer; the clip's start stays
 *   put. Commit routes to `setBackgroundClipRepeat` with the repeat that makes
 *   the requested end reach the dragged frame (the strip computes it from the
 *   resolver's cycle length — never re-derived here).
 *
 * Rejection law (BKG-03/D-04, symmetric with the import path): a landing that
 * collides with another clip rejects through the injected `onRejected` port
 * with the store's `'start-collision'` reason; the strip maps it to the locked
 * copy. A net-zero resize (release at the source's own edge frame) never calls
 * the store port (gesture-level idempotence). A sub-threshold release (a click)
 * just cleans up — the rail's own `onClick` owns selection (the track-rail
 * pattern), so the gesture never double-fires selection.
 */

import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

/** Horizontal travel in CSS pixels that must be exceeded before resizing starts. */
export const BACKGROUND_CLIP_RESIZE_THRESHOLD_PX = 4;

/** The resize source resolved from a pressed Bg clip edge cell. */
export interface BackgroundClipResizeSource {
  readonly clipId: string;
  readonly edge: 'start' | 'end';
  /** The clip's CURRENT start frame — the net-zero idempotence anchor. */
  readonly startFrame: number;
  /** The clip's CURRENT effective end (exclusive) — the end-edge anchor. */
  readonly endFrame: number;
  /** The resolver's cycle length — the end-edge commit derives the repeat
   *  count from it (capsule-never-math: the strip reads it, never computes). */
  readonly cycleLength: number;
}

/** The prepared resize publication — the exact payload the commit port receives. */
export interface BackgroundClipResizePublication {
  readonly clipId: string;
  readonly edge: 'start' | 'end';
  /** The new start frame (start edge) or new end frame (end edge). */
  readonly frame: number;
}

/** Presentation-only ghost geometry. Consumed for paint only; never for
 *  canonical revision, history, persistence, or commit authorization. */
export interface BackgroundClipResizeGhostState {
  readonly active: boolean;
  readonly left: number;
  readonly width: number;
  readonly blockedEdge: 'left' | 'right' | null;
}

/** Minimal injectable window surface for node-testable pointer sessions. */
export interface BackgroundClipResizeWindowLike {
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

/** Minimal injectable source-element surface used by the Bg clip edge cell. */
export interface BackgroundClipResizeSourceElement {
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
export interface BackgroundClipResizeProjectionInput {
  readonly originClientX: number;
  readonly clientX: number;
}

export interface BackgroundClipResizeClampResult {
  readonly frame: number;
  readonly left: number;
  readonly width: number;
  readonly blockedEdge: 'left' | 'right' | null;
}

export type BackgroundClipResizePreparationResult =
  | Readonly<{ ok: true; publication: BackgroundClipResizePublication }>
  | Readonly<{ ok: false; reason?: string; detail?: string }>;

/** Structural subset of the store's `BackgroundClipMutationResult` — the hook
 *  never computes move/repeat semantics; the store verdict is the single gate. */
export type BackgroundClipResizeCommitResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason?: string }>;

export interface BackgroundClipResizeInput {
  /** Test-injected event surface; defaults to `window` when available. */
  readonly windowLike?: BackgroundClipResizeWindowLike;
  /** Resolve the resize source from the pressed element; null ignores the press. */
  readonly resolveSource: (event: PointerEvent) => BackgroundClipResizeSource | null;
  /** Row-fixed frame projection from horizontal pointer geometry. */
  readonly projectFrame: (input: BackgroundClipResizeProjectionInput) => number;
  /** Clamp the proposed frame to the row's valid extent. */
  readonly clampFrame: (proposedFrame: number) => BackgroundClipResizeClampResult;
  /** Prepare the preview publication at a frame — reads resolver facts, never
   *  computes loop math (capsule-never-math). */
  readonly prepareAtFrame: (frame: number) => BackgroundClipResizePreparationResult;
  /** The single commit path — the strip wires it to the store op (move for the
   *  start edge, setRepeat for the end edge). Called exactly once per dragged
   *  release; never during the gesture. */
  readonly onDropCommit: (publication: BackgroundClipResizePublication) => BackgroundClipResizeCommitResult;
  /** Rejection publisher — the strip maps `'start-collision'` to the locked
   *  copy through the status capsule. */
  readonly onRejected?: (reason?: string, detail?: string) => void;
  /** Live ghost publication (paint only) — the strip bumps its paint tick so
   *  the row re-renders the resize preview. */
  readonly onGhostChange?: (ghost: BackgroundClipResizeGhostState | null) => void;
  /** Cancels any rail-host click timer when the pointer crosses the threshold. */
  readonly clearClickSequence: () => void;
  readonly onCancel?: () => void;
}

export interface BackgroundClipResizeApi {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly ghost: BackgroundClipResizeGhostState;
  /** Returns true exactly once for the browser click dispatched after a drop. */
  readonly consumeClickSuppression: () => boolean;
}

interface BackgroundClipResizeSession {
  readonly pointerId: number;
  readonly sourceElement: BackgroundClipResizeSourceElement;
  readonly source: BackgroundClipResizeSource;
  readonly originX: number;
  latestX: number;
  started: boolean;
  publication: BackgroundClipResizePublication | null;
  rejection: { readonly reason?: string; readonly detail?: string } | null;
  priorCursor: string | null;
  cleanup: () => void;
}

const GHOST_INACTIVE: BackgroundClipResizeGhostState = Object.freeze({
  active: false,
  left: 0,
  width: 0,
  blockedEdge: null,
});

/**
 * Source-attached Bg clip edge-cell pointer-session state machine. Resolver,
 * store, and model concerns enter only through injected projection, clamp,
 * prepare, and commit ports; the hook owns gesture lifecycle and presentation
 * state only. Row-fixed by construction: no cross-track signals, no vertical
 * projection, no document mutation before release.
 */
export function usePhysicsPaintBackgroundClipResize(
  input: BackgroundClipResizeInput,
): BackgroundClipResizeApi {
  const sessionRef = useRef<BackgroundClipResizeSession | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghost = useSignal<BackgroundClipResizeGhostState>(GHOST_INACTIVE);
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

    const sourceElement = event.currentTarget as unknown as BackgroundClipResizeSourceElement;
    let active = true;
    const session: BackgroundClipResizeSession = {
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
      input.onGhostChange?.(null);
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
      const proposedFrame = input.projectFrame({
        originClientX: session.originX,
        clientX: session.latestX,
      });
      const clamped = input.clampFrame(proposedFrame);
      const preparation = input.prepareAtFrame(clamped.frame);
      if (!preparation.ok) {
        session.publication = null;
        session.rejection = { reason: preparation.reason, detail: preparation.detail };
        clearPaint();
        return;
      }
      session.publication = preparation.publication;
      session.rejection = null;
      const nextGhost = Object.freeze({
        active: true,
        left: clamped.left,
        width: clamped.width,
        blockedEdge: clamped.blockedEdge,
      });
      ghost.value = nextGhost;
      input.onGhostChange?.(nextGhost);
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
        sourceElement.style.cursor = 'ew-resize';
      }
      suppressNextClickRef.current = true;
      input.clearClickSequence();
      return true;
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      session.latestX = moveEvent.clientX;
      if (!session.started && Math.abs(session.latestX - session.originX) > BACKGROUND_CLIP_RESIZE_THRESHOLD_PX) {
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
        // A sub-threshold release is a CLICK — the rail's own onClick owns
        // selection (the track-rail pattern); the gesture just cleans up so
        // selection fires exactly once.
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
      // Net-zero resize idempotence at the gesture level: a release at the
      // source's own edge frame never calls the store port.
      const anchorFrame = retainedPublication.edge === 'start'
        ? session.source.startFrame
        : session.source.endFrame;
      if (retainedPublication.frame === anchorFrame) {
        restoreSourceFocus();
        return;
      }
      let result: BackgroundClipResizeCommitResult;
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
    consumeClickSuppression,
  };
}
