import { useEffect, useRef, useState } from 'preact/hooks';
import type { PhysicPaintRotoLoopRange } from '../roto/physicsPaintRotoPhysicalResolver';
import type { PhysicsPaintLoopClipPresentation } from '../view/physicsPaintLoopClipPresentation';
import type {
  RotoGroupDragPreparationResult,
  RotoGroupDragPublication,
} from './useRotoTimelineActions';

/**
 * Horizontal-only travel (in CSS pixels) that must be exceeded before a rail
 * drag session starts. The 6px Euclidean `ROTO_DRAG_THRESHOLD_PX` belongs to
 * the locked physical-cell drag path and stays untouched (43.3 PATTERNS).
 */
export const GROUP_RAIL_DRAG_THRESHOLD_PX = 4;

/**
 * Presentation-only ghost geometry. Consumed for paint only; the commit path
 * consumes the immutable retained publication, never this state (D-01).
 */
export interface GroupRailDragGhostState {
  readonly active: boolean;
  readonly left: number;
  readonly width: number;
  readonly mode: 'progressive' | 'static';
  readonly effectiveZero: boolean;
}

/**
 * Minimal window surface the session needs. Injectable so the session state
 * machine is unit-testable in the node vitest environment (no real window).
 * The listener parameter is typed loosely so typed handlers (PointerEvent /
 * KeyboardEvent) are accepted; the real `window` satisfies this surface.
 */
export interface GroupRailDragWindowLike {
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
 * Minimal source-element surface the session needs (the rail target button).
 */
export interface GroupRailDragSourceElement {
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

export interface GroupRailDragSessionInput {
  readonly loopId: string;
  readonly range: PhysicPaintRotoLoopRange;
  readonly presentation: PhysicsPaintLoopClipPresentation;
  readonly framePitch: number;
  readonly visibleFrameWindow: {
    readonly startFrame: number;
    readonly endFrameExclusive: number;
  };
  /**
   * Absent until the strip wires the bundle (plan 03). Without both ports the
   * session never arms and the rail behaves byte-identically to today.
   */
  readonly prepareRotoGroupDrag?: (
    loopId: string,
    destinationPlacementStart: number,
  ) => RotoGroupDragPreparationResult;
  readonly commitRotoGroupDrag?: (publication: RotoGroupDragPublication) => Promise<boolean>;
  /** Cancels the rail's pending single-click timer on threshold crossing. */
  readonly clearClickSequence: () => void;
  readonly windowLike?: GroupRailDragWindowLike;
}

export interface GroupRailDragSessionApi {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly ghost: GroupRailDragGhostState;
  /**
   * Consumes the post-drop click suppression. Returns true exactly once when a
   * completed drag dropped, so the trailing `click` event cannot re-fire rail
   * selection or the Edit Group timer (Pitfall 2).
   */
  readonly consumeClickSuppression: () => boolean;
}

interface GroupRailDragSession {
  readonly pointerId: number;
  readonly sourceElement: GroupRailDragSourceElement;
  readonly originX: number;
  readonly originY: number;
  latestX: number;
  latestY: number;
  started: boolean;
  publication: RotoGroupDragPublication | null;
  cleanup: () => void;
}

const GHOST_INACTIVE: GroupRailDragGhostState = Object.freeze({
  active: false,
  left: 0,
  width: 0,
  mode: 'progressive',
  effectiveZero: false,
});

/**
 * Rail drag session state machine (43.3 plan 01 Task 3). Structurally mirrors
 * the strip's `handleRotoCellPointerDownCurrent` session idiom: arm on
 * rail-target pointer-down with no modifiers, track with window
 * pointermove/pointerup/pointercancel plus capture-phase Escape and
 * lostpointercapture, start only after more than 4px horizontal travel, retain
 * the prepared publication, and commit it on drop. All preview state is
 * session-only and consumed for paint only (T-43.3-01-03).
 */
export function usePhysicsPaintGroupRailDrag(
  input: GroupRailDragSessionInput,
): GroupRailDragSessionApi {
  const sessionRef = useRef<GroupRailDragSession | null>(null);
  const suppressNextClickRef = useRef(false);
  const [ghost, setGhost] = useState<GroupRailDragGhostState>(GHOST_INACTIVE);
  const win = input.windowLike ?? (typeof window !== 'undefined' ? window : undefined);

  const consumeClickSuppression = () => {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    return true;
  };

  const onPointerDown = (event: PointerEvent) => {
    // 43 D-42 isolation: the rail target always stops pointerdown propagation
    // so the physical-cell handlers below never see it.
    event.stopPropagation();
    // Modifier presses never arm a drag session (Pitfall 6): Cmd/Ctrl/Shift
    // clicks are selection gestures handled by the rail click machinery.
    if (!event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (!input.prepareRotoGroupDrag || !input.commitRotoGroupDrag || !win) return;
    if (sessionRef.current) return;
    const sourceElement = event.currentTarget as unknown as GroupRailDragSourceElement;
    let active = true;
    const session: GroupRailDragSession = {
      pointerId: event.pointerId,
      sourceElement,
      originX: event.clientX,
      originY: event.clientY,
      latestX: event.clientX,
      latestY: event.clientY,
      started: false,
      publication: null,
      cleanup: () => {},
    };
    const clearSuppressionSoon = () => {
      win.setTimeout(() => { suppressNextClickRef.current = false; }, 0);
    };
    const restoreSourceFocus = () => {
      try {
        sourceElement.focus();
      } catch {
        // Source identity no longer mounted; nothing to restore.
      }
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
      if (sessionRef.current === session) sessionRef.current = null;
      setGhost(GHOST_INACTIVE);
    };
    const computeDestination = () => {
      const deltaFrames = Math.round((session.latestX - session.originX) / input.framePitch);
      return input.range.placementStart + deltaFrames;
    };
    const updateGhost = () => {
      const destination = computeDestination();
      const effectiveZero = input.range.effectiveEnd <= input.range.placementStart;
      const left = (destination - input.visibleFrameWindow.startFrame) * input.framePitch;
      const width = effectiveZero
        ? 8
        : Math.max(1, (input.range.effectiveEnd - destination) * input.framePitch);
      setGhost({ active: true, left, width, mode: input.presentation.mode, effectiveZero });
    };
    const prepareAt = () => {
      const destination = computeDestination();
      const preparation = input.prepareRotoGroupDrag!(input.loopId, destination);
      if (preparation.ok) {
        session.publication = preparation.publication;
        updateGhost();
      } else {
        session.publication = null;
        setGhost(GHOST_INACTIVE);
      }
    };
    const beginDrag = () => {
      if (session.started) return;
      session.started = true;
      try {
        sourceElement.setPointerCapture(session.pointerId);
      } catch {
        session.started = false;
        cleanup();
        return;
      }
      suppressNextClickRef.current = true;
      input.clearClickSequence();
      // The move handler that crossed the threshold calls prepareAt() right
      // after beginDrag, so the publication is prepared exactly once per
      // destination change.
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      session.latestX = moveEvent.clientX;
      session.latestY = moveEvent.clientY;
      if (!session.started && Math.abs(session.latestX - session.originX) > GROUP_RAIL_DRAG_THRESHOLD_PX) {
        beginDrag();
      }
      if (session.started) {
        moveEvent.preventDefault();
        prepareAt();
      }
    };
    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== session.pointerId || sessionRef.current !== session) return;
      session.latestX = upEvent.clientX;
      session.latestY = upEvent.clientY;
      if (!session.started) {
        cleanup();
        return;
      }
      upEvent.preventDefault();
      const retainedPublication = session.publication;
      cleanup();
      clearSuppressionSoon();
      if (retainedPublication === null) {
        restoreSourceFocus();
        return;
      }
      void input.commitRotoGroupDrag!(retainedPublication).then((accepted) => {
        if (!accepted) restoreSourceFocus();
      });
    };
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== session.pointerId) return;
      cleanup();
      clearSuppressionSoon();
      restoreSourceFocus();
    };
    const handleLostPointerCapture = () => {
      if (sessionRef.current !== session) return;
      cleanup();
      clearSuppressionSoon();
      restoreSourceFocus();
    };
    const handleEscape = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape' || sessionRef.current !== session || !session.started) return;
      keyEvent.preventDefault();
      keyEvent.stopImmediatePropagation();
      cleanup();
      clearSuppressionSoon();
      restoreSourceFocus();
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

  return { onPointerDown, ghost, consumeClickSuppression };
}
