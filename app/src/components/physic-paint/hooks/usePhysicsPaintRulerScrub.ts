import { useEffect, useRef } from 'preact/hooks';

/** Horizontal travel in CSS pixels that must be exceeded before scrub mode arms. */
export const RULER_SCRUB_THRESHOLD_PX = 4;

/** Minimal injectable window surface for node-testable ruler scrub sessions. */
export interface RulerScrubWindowLike {
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
}

/** Minimal injectable ruler-element surface used by the ruler scrub target. */
export interface RulerScrubRulerElement {
  getBoundingClientRect(): { readonly left: number };
  setPointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
  releasePointerCapture(pointerId: number): void;
}

export interface PhysicsPaintRulerScrubOptions {
  /** Live frame-count authority (the physical extent). Read at every seek. */
  readonly frameCount: () => number;
  /**
   * Cursor-only seek port — the strip routes this to onNavigateToSyncedFrame.
   * The hook never receives, references, or invokes any selection or
   * track-activation callback (the ruler gesture is selection-free by law).
   */
  readonly onSeek: (frame: number) => void;
  /**
   * D-02 amendment (audible scrub): fired once when horizontal travel crosses
   * the 4px threshold and scrub mode arms. A plain sub-threshold click never
   * fires it.
   */
  readonly onScrubStart?: () => void;
  /**
   * D-02 amendment: fired on release/cancel with the last emitted frame ONLY
   * when scrub mode had armed — the final position for the audio re-anchor.
   */
  readonly onScrubEnd?: (finalFrame: number) => void;
  /** Cell pitch in CSS pixels (the strip passes ROTO_CELL_WIDTH_PX = 18). */
  readonly cellWidthPx?: number;
  readonly windowLike?: RulerScrubWindowLike;
}

export interface PhysicsPaintRulerScrubApi {
  readonly onPointerDown: (event: PointerEvent) => void;
}

interface RulerScrubSession {
  readonly pointerId: number;
  readonly rulerElement: RulerScrubRulerElement;
  readonly originX: number;
  readonly rectLeft: number;
  scrubbing: boolean;
  pendingFrame: number | null;
  rafId: number | null;
  lastEmittedFrame: number;
  cleanup: () => void;
}

const DEFAULT_CELL_WIDTH_PX = 18;

/**
 * 260827-s52 Task 1: NLE-style ruler seek/scrub gesture session. A pointer-down
 * on the time ruler seeks the playhead synchronously (seek on press — NLE law);
 * horizontal travel past the 4px threshold arms scrub mode, where moves are
 * coalesced to at most ONE seek per animation frame with the latest frame
 * (never one per pointer event — T-s52-02). The frame derives from the ruler
 * element's OWN bounding-rect left edge, clamped to [0, frameCount-1] at the
 * hook boundary (T-s52-01). A plain sub-threshold click is exactly one seek —
 * never swallowed, never doubled. Cleanup on release/cancel/unmount is
 * idempotent: capture released, pending rAF cancelled, window listeners removed
 * (efx-preact-reactivity loop-termination rule).
 */
export function usePhysicsPaintRulerScrub(
  options: PhysicsPaintRulerScrubOptions,
): PhysicsPaintRulerScrubApi {
  const sessionRef = useRef<RulerScrubSession | null>(null);
  const win = options.windowLike ?? (typeof window !== 'undefined' ? window : undefined);
  const cellWidthPx = options.cellWidthPx ?? DEFAULT_CELL_WIDTH_PX;

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (!win || sessionRef.current) return;

    const rulerElement = event.currentTarget as unknown as RulerScrubRulerElement;
    const rectLeft = rulerElement.getBoundingClientRect().left;
    const frameAt = (clientX: number): number => {
      const count = options.frameCount();
      if (count <= 0) return 0;
      const raw = Math.floor((clientX - rectLeft) / cellWidthPx);
      return Math.max(0, Math.min(raw, count - 1));
    };

    // Seek on press: the down lands exactly one cursor-only navigation.
    const downFrame = frameAt(event.clientX);
    options.onSeek(downFrame);

    let active = true;
    const session: RulerScrubSession = {
      pointerId: event.pointerId,
      rulerElement,
      originX: event.clientX,
      rectLeft,
      scrubbing: false,
      pendingFrame: null,
      rafId: null,
      lastEmittedFrame: downFrame,
      cleanup: () => {},
    };

    const flushPendingSeek = () => {
      session.rafId = null;
      if (!active || sessionRef.current !== session) return;
      const frame = session.pendingFrame;
      session.pendingFrame = null;
      if (frame === null || frame === session.lastEmittedFrame) return;
      session.lastEmittedFrame = frame;
      options.onSeek(frame);
    };

    const cleanup = () => {
      if (!active) return;
      active = false;
      win.removeEventListener('pointermove', handlePointerMove);
      win.removeEventListener('pointerup', handlePointerUp);
      win.removeEventListener('pointercancel', handlePointerCancel);
      if (session.rafId !== null) {
        cancelAnimationFrame(session.rafId);
        session.rafId = null;
      }
      session.pendingFrame = null;
      if (session.rulerElement.hasPointerCapture(session.pointerId)) {
        session.rulerElement.releasePointerCapture(session.pointerId);
      }
      // D-02 amendment: report the final position ONLY when scrub mode had
      // armed — a plain click never fires onScrubEnd.
      if (session.scrubbing) options.onScrubEnd?.(session.lastEmittedFrame);
      if (sessionRef.current === session) sessionRef.current = null;
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      if (!session.scrubbing) {
        if (Math.abs(moveEvent.clientX - session.originX) <= RULER_SCRUB_THRESHOLD_PX) return;
        session.scrubbing = true;
        options.onScrubStart?.();
      }
      session.pendingFrame = frameAt(moveEvent.clientX);
      if (session.rafId === null) {
        session.rafId = requestAnimationFrame(flushPendingSeek);
      }
    };
    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      cleanup();
    };
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      cleanup();
    };

    session.cleanup = cleanup;
    sessionRef.current = session;

    try {
      rulerElement.setPointerCapture(session.pointerId);
    } catch {
      // A detached ruler cannot capture; the window listeners still own the
      // gesture for the session's remaining lifetime.
    }
    win.addEventListener('pointermove', handlePointerMove);
    win.addEventListener('pointerup', handlePointerUp);
    win.addEventListener('pointercancel', handlePointerCancel);
  };

  useEffect(() => () => {
    sessionRef.current?.cleanup();
  }, []);

  return { onPointerDown };
}
