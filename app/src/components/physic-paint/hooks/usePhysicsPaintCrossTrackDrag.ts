/**
 * 47-05 cross-track drag gesture (TML-05, D-15/D-16/D-17/D-18).
 *
 * Any existing draggable — a real key, a Key Rail, a Loop Clip Rail, or a
 * rail-set member — can cross from its source row into a destination row with
 * NO modifier key. While the pointer is over another row the gesture exposes
 * read-only signals (`destinationTrackId`, `insertionFrame`, `isCrossing`)
 * that the strip renders as the destination highlight + live insertion
 * preview; the gesture NEVER mutates any document (D-16). Releasing over a
 * destination row fires the store port exactly once with the captured source,
 * destination, keys, and the PREVIEWED insertion frame — the strip wires that
 * to `physicPaintStore.moveTrackItems` (D-09 copy-paste-delete semantics,
 * D-17): the commit is preview-is-the-commit (47 close-out UAT round 2 — the
 * payload's anchor lands exactly at the insertion line the user saw, never at
 * the source frames). The result maps to the status-capsule message, success
 * through the move summary and rejection through the fixed English reason map
 * with the red warning triangle (identical to the Phase 46 paste rejection UX).
 *
 * Takeover mechanics: the gesture starts as a passive listener on the
 * rows-region pointerdown (the strip's capture listener calls `onPointerDown`).
 * While the pointer stays within the source row's bounds the gesture does
 * nothing — the existing same-row drag owns the interaction (plain-drag
 * preservation, D-16). The first move that crosses a row boundary sets pointer
 * capture on the rows-region; per the Pointer Events spec the previous capture
 * holder (the same-row drag's source element) receives `lostpointercapture`
 * and cancels non-committing, so no same-row drag can commit to a target on
 * another row. The gesture then owns the session until release/cancel.
 *
 * The header reorder grab area lives OUTSIDE the rows-region (the pinned
 * header column), so a grab-drag never reaches `onPointerDown` (D-18); the
 * strip's source resolver additionally only resolves content draggables.
 */

import { useRef } from 'preact/hooks';
import { useSignal, type Signal } from '@preact/signals';

/** One Paint-track row's viewport bounds (Bg row excluded by the strip). */
export interface CrossTrackRowBounds {
  readonly trackId: string;
  readonly top: number;
  readonly bottom: number;
}

/** The dragged items resolved from the pressed element (strip authority). */
export interface CrossTrackDragSource {
  readonly fromTrackId: string;
  readonly keyIds: readonly string[];
}

/** The status-capsule tone the strip's action bundle accepts. */
export type CrossTrackApplyStatus = 'idle' | 'applying' | 'success' | 'error';

/**
 * Minimal structural view of the store's commit result
 * (physicPaintStore.moveTrackItems → RotoTrackPasteResult): the hook never
 * computes move semantics — it forwards the result to the message mapping
 * (D-09/D-17).
 */
export type CrossTrackMoveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason?: string };

export interface CrossTrackDragWindowLike {
  addEventListener(type: string, listener: (event: unknown) => void, capture?: boolean): void;
  removeEventListener(type: string, listener: (event: unknown) => void, capture?: boolean): void;
}

/** The rows-region element that takes pointer capture on row-boundary crossing. */
export interface CrossTrackDragCaptureElement {
  setPointerCapture(pointerId: number): void;
  hasPointerCapture?(pointerId: number): boolean;
  releasePointerCapture(pointerId: number): void;
}

export interface CrossTrackDragInput {
  /** Test-injected event surface; defaults to `window` when available. */
  readonly windowLike?: CrossTrackDragWindowLike;
  /** Viewport bounds of the Paint-track rows in DOM order (Bg row excluded). */
  getRowBounds(): readonly CrossTrackRowBounds[];
  /** The rows-region element that takes capture when the drag crosses a row. */
  getCaptureElement(): CrossTrackDragCaptureElement | null;
  /** Viewport left edge of the rows' scroll content. */
  getContentLeft(): number;
  /** The horizontal scrollLeft of the rows' scroll container. */
  getScrollLeft(): number;
  /** The px-per-frame pitch of the timeline cells (18px). */
  readonly framePitch: number;
  readonly zoom?: number;
  /** The layer whose tracks the crossed release moves items between. */
  readonly layerId: string;
  /** The single commit path — the strip wires it to physicPaintStore.moveTrackItems.
   *  `destinationAppFrame` is the previewed insertion frame: the commit lands
   *  the payload's anchor exactly where the preview line was (47 close-out UAT
   *  round 2 — the rail lands where released, never at the source frames). */
  moveTrackItems(layerId: string, fromTrackId: string, toTrackId: string, keys: readonly string[], destinationAppFrame: number): CrossTrackMoveResult;
  /** The status-capsule publication the outcome maps to. */
  readonly publishStatus: (message: string) => void;
  /** Marks the capsule error tone for rejections (red warning triangle). */
  readonly setApplyStatus?: (status: CrossTrackApplyStatus) => void;
  /** Resolve the drag source from the pressed element; null ignores the press. */
  resolveSource(event: PointerEvent): CrossTrackDragSource | null;
}

export interface CrossTrackDragApi {
  /** The row under the pointer while crossing; null on the source row / outside rows. */
  readonly destinationTrackId: Signal<string | null>;
  /** The resolved frame where the dragged content would land (read-only preview). */
  readonly insertionFrame: Signal<number | null>;
  /** True only while the pointer is over a row different from the source. */
  readonly isCrossing: Signal<boolean>;
  /** Rows-region pointerdown entry point — the ONLY way a session starts. */
  onPointerDown(event: PointerEvent): void;
}

/**
 * The success capsule line for a committed cross-track move (D-17), mirroring
 * the Phase 46 paste summaries ('Pasted the copied Rails.') with a count.
 */
export function buildCrossTrackMoveSuccessMessage(keyCount: number): string {
  return keyCount === 1 ? 'Moved 1 key to another track.' : `Moved ${keyCount} keys to another track.`;
}

/** Fixed English reason map — every store rejection surfaces a specific line
 *  (D-14, T-47-05-03); unmapped or missing reasons never ship empty or French
 *  copy. */
const CROSS_TRACK_MOVE_REJECTION_MAP: Readonly<Record<string, string>> = {
  'track-missing': 'Track not found',
  'duplicate-destination-frame': 'Destination frame is occupied',
  'partial-loop-overlap': 'Loop would be partially moved',
  'empty-set': 'Nothing to move',
  'missing-key': 'Key not found',
};

export function mapCrossTrackMoveRejection(reason: string | undefined): string {
  return (reason && CROSS_TRACK_MOVE_REJECTION_MAP[reason]) || 'Move failed.';
}

interface CrossTrackDragSession {
  readonly pointerId: number;
  readonly source: CrossTrackDragSource;
  /** True once the rows-region holds pointer capture (crossing happened). */
  started: boolean;
}

/**
 * Resolve the Paint-track row under the pointer: a row different from the
 * source is a destination; the source row resolves to the source trackId (no
 * crossing); outside every row resolves to null. The hook maps the source-row
 * result to a null destination signal, so the highlight only ever renders over
 * a different row (D-16).
 */
export function computeCrossTrackDestination(
  rowBounds: readonly CrossTrackRowBounds[],
  pointerY: number,
  sourceTrackId: string,
): string | null {
  const hit = rowBounds.find((row) => pointerY >= row.top && pointerY < row.bottom);
  if (!hit) return null;
  // A position still on the source row resolves to the source trackId (no
  // crossing — the gesture maps it to a null destination signal); only a
  // different row resolves as a destination.
  return hit.trackId === sourceTrackId ? sourceTrackId : hit.trackId;
}

/**
 * Resolve the frame under the pointer against the frame pitch and the
 * horizontal scrollLeft: contentX = pointerX (relative to the scroll
 * container's left edge) + scrollLeft, then divide by the pitched cell width.
 * Never negative — the preview clamps at frame 0.
 */
export function computeInsertionFrame(
  pointerX: number,
  scrollLeft: number,
  zoom: number,
  framePitch: number,
): number {
  const pitch = framePitch * zoom;
  if (pitch <= 0) return 0;
  return Math.max(0, Math.floor((pointerX + scrollLeft) / pitch));
}

/**
 * 47-05 cross-track drag session. The hook is a pure gesture owner: it
 * computes destination + insertion frame from pointer geometry, exposes
 * read-only signals, and calls the injected store port exactly once on a
 * crossed release. It NEVER computes move semantics — moveTrackItems owns
 * copy-paste-delete (D-09/D-17) and the strip owns the source resolution.
 */
export function usePhysicsPaintCrossTrackDrag(input: CrossTrackDragInput): CrossTrackDragApi {
  const destinationTrackId = useSignal<string | null>(null);
  const insertionFrame = useSignal<number | null>(null);
  const isCrossing = useSignal(false);
  const sessionRef = useRef<CrossTrackDragSession | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  /** Test-injectable window surface; the strip mounts with `undefined` and
   *  the hook falls back to the real window (node-env contract tests render
   *  the strip without a global window — same pattern as the other drags). */
  const resolveWindowLike = (active: CrossTrackDragInput): CrossTrackDragWindowLike | null =>
    active.windowLike ?? (typeof window !== 'undefined' ? window : null);

  const clearSignals = () => {
    destinationTrackId.value = null;
    insertionFrame.value = null;
    isCrossing.value = false;
  };

  const cleanup = (session: CrossTrackDragSession) => {
    const active = inputRef.current;
    const win = resolveWindowLike(active);
    if (win) {
      win.removeEventListener('pointermove', handlePointerMove);
      win.removeEventListener('pointerup', handlePointerUp);
      win.removeEventListener('pointercancel', handlePointerCancel);
      win.removeEventListener('keydown', handleEscape, true);
    }
    if (session.started) {
      const captureElement = active.getCaptureElement();
      if (captureElement) {
        try {
          if (captureElement.hasPointerCapture?.(session.pointerId)) {
            captureElement.releasePointerCapture(session.pointerId);
          }
        } catch {
          // The pointer already ended — the capture was auto-released.
        }
      }
    }
    if (sessionRef.current === session) sessionRef.current = null;
    clearSignals();
  };

  const handlePointerMove = (event: unknown) => {
    const session = sessionRef.current;
    const moveEvent = event as PointerEvent;
    if (!session || moveEvent.pointerId !== session.pointerId) return;
    const active = inputRef.current;
    const destination = computeCrossTrackDestination(
      active.getRowBounds(),
      moveEvent.clientY,
      session.source.fromTrackId,
    );
    if (destination === null || destination === session.source.fromTrackId) {
      // On the source row (or outside the rows): the feedback clears, the
      // takeover capture stays (a re-cross re-arms the signals instantly).
      clearSignals();
      return;
    }
    if (!session.started) {
      // Row-boundary crossing: take capture on the rows-region. The same-row
      // drag's source element (the previous capture holder) receives
      // lostpointercapture and cancels non-committing — no same-row drag can
      // commit to a target on another row (D-15/D-16).
      const captureElement = active.getCaptureElement();
      if (!captureElement) {
        cleanup(session);
        return;
      }
      captureElement.setPointerCapture(moveEvent.pointerId);
      session.started = true;
    }
    destinationTrackId.value = destination;
    isCrossing.value = true;
    insertionFrame.value = computeInsertionFrame(
      moveEvent.clientX - active.getContentLeft(),
      active.getScrollLeft(),
      active.zoom ?? 1,
      active.framePitch,
    );
    moveEvent.preventDefault();
  };

  const handlePointerUp = (event: unknown) => {
    const session = sessionRef.current;
    const upEvent = event as PointerEvent;
    if (!session || upEvent.pointerId !== session.pointerId) return;
    const active = inputRef.current;
    if (session.started) {
      const destination = computeCrossTrackDestination(
        active.getRowBounds(),
        upEvent.clientY,
        session.source.fromTrackId,
      );
      if (destination !== null && destination !== session.source.fromTrackId) {
        // The single commit path (D-17): the store port runs exactly once per
        // crossed release with the captured destination — copy-paste-delete
        // semantics live in moveTrackItems, never here (D-09). The commit
        // lands the payload's anchor at the SAME frame the insertion preview
        // showed (preview-is-the-commit, 47 close-out UAT round 2): the rail
        // drops where released, not at the source frames.
        const result = active.moveTrackItems(
          active.layerId,
          session.source.fromTrackId,
          destination,
          session.source.keyIds,
          computeInsertionFrame(
            upEvent.clientX - active.getContentLeft(),
            active.getScrollLeft(),
            active.zoom ?? 1,
            active.framePitch,
          ),
        );
        if (result.ok) {
          active.publishStatus(buildCrossTrackMoveSuccessMessage(session.source.keyIds.length));
        } else {
          active.setApplyStatus?.('error');
          active.publishStatus(mapCrossTrackMoveRejection(result.reason));
        }
      }
    }
    cleanup(session);
  };

  const handlePointerCancel = (event: unknown) => {
    const session = sessionRef.current;
    const cancelEvent = event as PointerEvent;
    if (!session || cancelEvent.pointerId !== session.pointerId) return;
    cleanup(session);
  };

  const handleEscape = (event: unknown) => {
    const session = sessionRef.current;
    if (!session) return;
    if ((event as KeyboardEvent).key !== 'Escape') return;
    cleanup(session);
  };

  const onPointerDown = (event: PointerEvent) => {
    // Modifier presses are selection gestures — never a cross-track session.
    if (!event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (sessionRef.current) return;
    const active = inputRef.current;
    const source = active.resolveSource(event);
    if (!source) return;
    if (!active.getRowBounds().some((row) => row.trackId === source.fromTrackId)) return;
    const win = resolveWindowLike(active);
    if (!win) return;
    const session: CrossTrackDragSession = {
      pointerId: event.pointerId,
      source,
      started: false,
    };
    sessionRef.current = session;
    win.addEventListener('pointermove', handlePointerMove);
    win.addEventListener('pointerup', handlePointerUp);
    win.addEventListener('pointercancel', handlePointerCancel);
    win.addEventListener('keydown', handleEscape, true);
  };

  return {
    destinationTrackId,
    insertionFrame,
    isCrossing,
    onPointerDown,
  };
}
