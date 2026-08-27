import { useEffect, useRef } from 'preact/hooks';
import type {
  PhysicPaintRotoGroupDragClampInput,
  PhysicPaintRotoLoopRange,
} from '../roto/physicsPaintRotoPhysicalResolver';
import type { PhysicsPaintRotoSpacingSelectionGesture } from '../roto/physicsPaintRotoSpacingSelection';
import {
  usePhysicsPaintGroupRailDrag,
  type GroupRailDragPreviewState,
  type GroupRailDragWindowLike,
} from '../hooks/usePhysicsPaintGroupRailDrag';
import type {
  RotoGroupDragPreparationResult,
  RotoGroupDragPublication,
} from '../hooks/useRotoTimelineActions';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import {
  projectPhysicsPaintLoopClipGeometry,
  type PhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';
import {
  dispatchRailTargetKeyDown,
  focusRailTargetOnPointerSelection,
  RAIL_LANE_SELECTOR,
  roveRailTargetFocus,
} from './physicsPaintRailKeyboardNavigation';
import { buildRailSetTooltipSentence } from '../hooks/useRotoTimelineActions';

export const LOOP_CLIP_FAST_DOUBLE_CLICK_MS = 220;
export const LOOP_CLIP_SINGLE_CLICK_DELAY_MS = 250;

export interface PhysicsPaintLoopClipRailProps {
  readonly ranges: readonly PhysicPaintRotoLoopRange[];
  readonly presentations: ReadonlyMap<string, PhysicsPaintLoopClipPresentation>;
  readonly visibleFrameWindow: {
    readonly startFrame: number;
    readonly endFrameExclusive: number;
  };
  readonly framePitch: number;
  readonly selectedLoopClipIds: readonly string[];
  /** Loop Rails that are members of the session rail-set (43.6 D-01); they
   *  paint the same orange selection line as single selection — no new color. */
  readonly railSetMemberLoopIds?: readonly string[];
  /** Loop Rails that are MOVABLE set members (260820-lwd): derived from the
   *  explicit railSetMoveMembers in the strip. Only these hand their
   *  pointer-down (and trailing-click suppression) to the batch set-drag
   *  session; a plain-selected single rail is a paint member but NOT a move
   *  member, so it runs its own 43.3/43.4 drag. */
  readonly railSetMoveMemberLoopIds?: readonly string[];
  /** The set anchor Loop Rail identity, if any — carries the anchor tick. */
  readonly railSetAnchorLoopId?: string | null;
  /** Total rail-set size (all kinds) for the M1 tooltip set sentence. */
  readonly railSetSize?: number;
  readonly linkedLoopClipIds?: readonly string[];
  readonly linkedActionName?: string | null;
  readonly onSelectLoopClip: (
    loopId: string,
    gesture: PhysicsPaintRotoSpacingSelectionGesture,
  ) => void;
  readonly onOpenLoopEdit: (loopId: string) => Promise<unknown>;
  /**
   * Group-drag ports. Absent until the strip wires the bundle (plan 03); the
   * rail then behaves byte-identically to the pre-drag contract.
   */
  readonly prepareRotoGroupDrag?: (
    loopId: string,
    destinationPlacementStart: number,
  ) => RotoGroupDragPreparationResult;
  readonly commitRotoGroupDrag?: (publication: RotoGroupDragPublication) => Promise<boolean>;
  /** Supplies the static clamp inputs for the plan-02 pure clamp authority (D-05). */
  readonly getClampInput?: (
    loopId: string,
  ) => Omit<PhysicPaintRotoGroupDragClampInput, 'proposedDestinationPlacementStart'> | null;
  /** Publishes the mapped rejection reason on a zero-movement drop (D-06). */
  readonly onRotoGroupDragRejected?: (reason: string, detail?: string) => void;
  /** Surfaces the retained publication to the strip for the gap preview. */
  readonly onPreviewChange?: (preview: GroupRailDragPreviewState | null) => void;
  /** Injectable window surface for node-environment session tests. */
  readonly windowLike?: GroupRailDragWindowLike;
  /** 43.6-03 D-08: batch rail-set session pointer-down routing for set
   *  members; absent means no batch session (pre-43.6 behavior). */
  readonly onRailSetDragPointerDown?: (event: PointerEvent) => void;
  /** 43.6-03 D-08: batch rail-set trailing-click suppression consumer. */
  readonly onRailSetDragClickSuppressed?: () => boolean;
  /** 43.6 WR-01: registers this rail's click-sequence canceller so the batch
   *  drag session can clear the pending single-click timer on drag begin —
   *  a set-member click arms the timer, and dragging within the delay window
   *  must not collapse or mutate the set mid-drag. Returns the unregister
   *  function. */
  readonly registerClickSequenceCanceller?: (canceller: () => void) => () => void;
  /** 47 close-out UAT round 3: true while a cross-track drag session is
   *  crossing rows — the rail pill never pops mid-drag. */
  readonly suppressTooltip?: boolean;
}

interface RailMouseEvent {
  readonly timeStamp: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly currentTarget?: EventTarget | null;
  stopPropagation(): void;
  preventDefault(): void;
}

interface RailKeyboardEvent {
  readonly key: string;
  readonly shiftKey?: boolean;
  readonly currentTarget?: EventTarget | null;
  stopPropagation(): void;
  preventDefault(): void;
}

interface RailTargetProps {
  readonly range: PhysicPaintRotoLoopRange;
  readonly presentation: PhysicsPaintLoopClipPresentation;
  readonly left: number;
  readonly width: number;
  readonly selected: boolean;
  readonly isSetMember: boolean;
  readonly isSetAnchor: boolean;
  readonly railSetSize?: number;
  /** Movable set membership (260820-lwd): routes pointer-down / click
   *  suppression to the batch session; absent for plain-selected single rails. */
  readonly railSetMoveMemberLoopIds?: readonly string[];
  readonly actionLinked: boolean;
  readonly showStartBoundary: boolean;
  readonly showEndBoundary: boolean;
  readonly framePitch: number;
  readonly visibleFrameWindow: {
    readonly startFrame: number;
    readonly endFrameExclusive: number;
  };
  readonly onSelectLoopClip: (
    loopId: string,
    gesture: PhysicsPaintRotoSpacingSelectionGesture,
  ) => void;
  readonly onOpenLoopEdit: (loopId: string) => Promise<unknown>;
  readonly prepareRotoGroupDrag?: (
    loopId: string,
    destinationPlacementStart: number,
  ) => RotoGroupDragPreparationResult;
  readonly commitRotoGroupDrag?: (publication: RotoGroupDragPublication) => Promise<boolean>;
  readonly getClampInput?: (
    loopId: string,
  ) => Omit<PhysicPaintRotoGroupDragClampInput, 'proposedDestinationPlacementStart'> | null;
  readonly onRotoGroupDragRejected?: (reason: string, detail?: string) => void;
  readonly onPreviewChange?: (preview: GroupRailDragPreviewState | null) => void;
  readonly windowLike?: GroupRailDragWindowLike;
  readonly onRailSetDragPointerDown?: (event: PointerEvent) => void;
  readonly onRailSetDragClickSuppressed?: () => boolean;
  readonly registerClickSequenceCanceller?: (canceller: () => void) => () => void;
  /** 47 close-out UAT round 3: true while a cross-track drag session is
   *  crossing rows — the rail pill never pops mid-drag. */
  readonly suppressTooltip?: boolean;
}

function PhysicsPaintLoopClipRailTarget(props: RailTargetProps) {
  const tooltip = useStyledTooltip();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  // 47 close-out UAT round 3: a hover timer armed before the cross-track drag
  // took the pointer capture would pop the pill mid-drag (pointerleave never
  // fires under capture) — hide it the moment a session starts crossing.
  useEffect(() => {
    if (props.suppressTooltip) tooltip.hide();
  }, [props.suppressTooltip]);
  const pendingSingleClickRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickTimestampRef = useRef<number | null>(null);
  const { range, presentation } = props;
  // 260820-lwd: drag-routing membership (explicit movable set) is separate
  // from the paint/set-of-one classifier. A plain-selected single rail is a
  // paint member (isSetMember true) but NOT a move member.
  const isMoveMember = props.railSetMoveMemberLoopIds?.includes(range.loopId) ?? false;
  // 43.6 M1: a set member appends the set sentence (anchor form prefixed
  // ' Range anchor.') as a new tooltip line via the one mapper.
  const setSentence = props.isSetMember
    ? buildRailSetTooltipSentence(props.railSetSize ?? 0, props.isSetAnchor)
    : null;
  const tooltipLines = setSentence
    ? [...presentation.tooltipLines, setSentence.trim()]
    : presentation.tooltipLines;

  const clearPendingSingleClick = () => {
    if (pendingSingleClickRef.current === null) return;
    clearTimeout(pendingSingleClickRef.current);
    pendingSingleClickRef.current = null;
  };
  const clearClickSequence = () => {
    clearPendingSingleClick();
    lastClickTimestampRef.current = null;
  };
  // 43.6 WR-01: expose this rail's canceller to the strip-owned batch-drag
  // registry so a drag begin clears the pending single-click timer (a
  // set-member click arms the timer; dragging within the delay window must
  // not collapse or mutate the set mid-drag). Mount-once via a ref guard —
  // the closure only reads refs, so the first-render capture is safe; the
  // unmount effect below unregisters. The ref guard also makes the
  // registration idempotent under re-render.
  const registrationRef = useRef<(() => void) | null>(null);
  if (registrationRef.current === null && props.registerClickSequenceCanceller) {
    registrationRef.current = props.registerClickSequenceCanceller(clearClickSequence);
  }
  useEffect(() => {
    clearClickSequence();
    return () => registrationRef.current?.();
  }, []);

  const { onPointerDown, ghost, consumeClickSuppression } = usePhysicsPaintGroupRailDrag({
    loopId: range.loopId,
    range,
    presentation,
    framePitch: props.framePitch,
    visibleFrameWindow: props.visibleFrameWindow,
    prepareRotoGroupDrag: props.prepareRotoGroupDrag,
    commitRotoGroupDrag: props.commitRotoGroupDrag,
    getClampInput: props.getClampInput,
    onRejected: props.onRotoGroupDragRejected,
    onPreviewChange: props.onPreviewChange,
    clearClickSequence,
    windowLike: props.windowLike,
  });
  const handleClick = (event: RailMouseEvent) => {
    event.stopPropagation();
    // 43.6-03 D-08: a move member's trailing click after a batch drag is
    // suppressed by the batch session (never the own-drag suppression, which
    // is never armed for move members). Paint-only set-of-one members fall
    // through to their own suppression.
    if (isMoveMember && props.onRailSetDragClickSuppressed?.()) return;
    // A completed drag drops a trailing `click` event; consume the suppression
    // so it cannot re-fire selection or the Edit Group timer (Pitfall 2).
    if (consumeClickSuppression()) return;
    tooltip.hide();
    // 43.4 defect 10: an explicit click is a focus-worthy activation for every
    // rail family — move DOM focus to this target so the shared ring paints.
    focusRailTargetOnPointerSelection(event);
    // 43.6 Pitfall 1: the union combination (Cmd+Shift) is checked FIRST so it
    // cannot collapse into the plain Shift range branch.
    const gesture: PhysicsPaintRotoSpacingSelectionGesture = event.shiftKey && (event.metaKey || event.ctrlKey)
      ? 'union'
      : event.shiftKey
        ? 'range'
        : event.metaKey || event.ctrlKey
          ? 'toggle'
          : 'plain';
    const previousTimestamp = lastClickTimestampRef.current;
    const elapsed = previousTimestamp === null
      ? Number.POSITIVE_INFINITY
      : event.timeStamp - previousTimestamp;
    // A second PLAIN click while a single-click timer is still pending is a
    // double-click intent (open the editor) regardless of the exact elapsed
    // time — this closes the (FAST_DOUBLE_CLICK_MS, SINGLE_CLICK_DELAY_MS]
    // dead zone where a deliberate double-click was silently dropped.
    // 43.6-10 (WR-02): modifier clicks are never open-editor intent — they
    // fall through to the synchronous set-commit branch below even inside
    // the pending/220ms window.
    const hasPendingSingleClick = pendingSingleClickRef.current !== null;
    if (gesture === 'plain' && (hasPendingSingleClick || (elapsed >= 0 && elapsed <= LOOP_CLIP_FAST_DOUBLE_CLICK_MS))) {
      event.preventDefault();
      clearClickSequence();
      props.onSelectLoopClip(range.loopId, 'plain');
      void props.onOpenLoopEdit(range.loopId);
      return;
    }
    clearPendingSingleClick();
    // 43.6-08 (G-43.6-8): a modifier click is never an open-editor
    // double-click intent — commit set membership synchronously (no 250ms
    // timer) so the rail is .selected immediately and Delete/Backspace
    // pressed right after routes through isPhysicsPaintRotoDeleteTarget to
    // the Delete Rails classifier instead of being swallowed in the window.
    if (gesture !== 'plain') {
      lastClickTimestampRef.current = null;
      props.onSelectLoopClip(range.loopId, gesture);
      return;
    }
    lastClickTimestampRef.current = event.timeStamp;
    pendingSingleClickRef.current = setTimeout(() => {
      pendingSingleClickRef.current = null;
      lastClickTimestampRef.current = null;
      props.onSelectLoopClip(range.loopId, gesture);
    }, LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
  };
  const handleKeyDown = (event: RailKeyboardEvent) => {
    // 43.4 defect 9: the shared rail roving group owns ArrowLeft/ArrowRight/
    // Tab on every rail family; per-type Escape/Enter/Space handling continues.
    const current = event.currentTarget as HTMLElement | null;
    const lane = current?.closest ? current.closest(RAIL_LANE_SELECTOR) : null;
    if (current && lane && dispatchRailTargetKeyDown(event, lane, current)) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      tooltip.hide();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.stopPropagation();
    event.preventDefault();
    tooltip.hide();
    clearClickSequence();
    props.onSelectLoopClip(range.loopId, 'plain');
    if (event.key === 'Enter') void props.onOpenLoopEdit(range.loopId);
  };

  return (
    <span
      ref={anchorRef}
      class="physics-paint-loop-clip-rail-anchor"
      style={{ left: `${props.left}px`, width: `${props.width}px` }}
      onPointerEnter={props.suppressTooltip ? tooltip.hide : tooltip.onPointerEnter}
      onPointerLeave={tooltip.onPointerLeave}
    >
      <button
        type="button"
        class={`physics-paint-rail-target physics-paint-loop-clip-rail-target mode-${presentation.mode}${props.selected ? ' selected' : ''}${props.actionLinked ? ' action-linked' : ''}${props.showStartBoundary ? ' boundary-start boundary-cell-start' : ''}${props.showEndBoundary ? ' boundary-end boundary-cell-end' : ''}${range.truncated ? ' truncated' : ''}${range.unresolved ? ' unresolved' : ''}`}
        aria-label={presentation.accessibleName}
        aria-pressed={props.selected}
        data-rail-first-frame={range.placementStart}
        onPointerDown={(event) => {
          // 43.6-03 D-08: a move member hands the pointer-down to the batch
          // session; a non-move-member runs its own 43.3/43.4 drag unchanged
          // (the collapse-first selection side-effect happens at click time).
          // A plain-selected single rail is a paint member but NOT a move
          // member, so it keeps its own drag.
          if (isMoveMember && props.onRailSetDragPointerDown) {
            props.onRailSetDragPointerDown(event);
            return;
          }
          onPointerDown(event);
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          tooltip.onFocus();
          const current = event?.currentTarget as HTMLElement | null;
          const lane = current?.closest ? current.closest(RAIL_LANE_SELECTOR) : null;
          if (current && lane) roveRailTargetFocus(lane, current);
        }}
        onBlur={tooltip.onBlur}
      >
        <span class="physics-paint-rail-segment physics-paint-loop-clip-rail-segment" aria-hidden="true" />
        {props.isSetAnchor ? (
          <span class="physics-paint-rail-anchor-tick" aria-hidden="true" />
        ) : null}
        {presentation.synchronizationDot ? (
          <span class={`physics-paint-loop-clip-lifecycle-dot ${presentation.synchronizationDot}`} aria-hidden="true" />
        ) : null}
      </button>
      {ghost.active ? (
        <span
          class={`physics-paint-loop-clip-rail-ghost mode-${ghost.mode}${ghost.effectiveZero ? ' effective-zero' : ''}`}
          style={{ left: `${ghost.left - props.left}px`, width: `${ghost.width}px` }}
          aria-hidden="true"
        />
      ) : null}
      {ghost.active && ghost.blockedEdge !== null ? (
        <span
          class={`physics-paint-loop-clip-rail-ghost-blocked-edge edge-${ghost.blockedEdge}`}
          style={{ left: `${ghost.left - props.left + (ghost.blockedEdge === 'left' ? 0 : ghost.width - 2)}px` }}
          aria-hidden="true"
        />
      ) : null}
      <PhysicsPaintStyledTooltip visible={tooltip.visible} region="bottom" anchorRef={anchorRef} topmost>
        <span class="physics-paint-loop-clip-tooltip-copy">
          {tooltipLines.map((line, index) => index === 0
            ? <strong key={line}>{line}</strong>
            : <span key={`${index}:${line}`}>{line}</span>)}
        </span>
      </PhysicsPaintStyledTooltip>
    </span>
  );
}

export function PhysicsPaintLoopClipRail(props: PhysicsPaintLoopClipRailProps) {
  const rangeAuthorityByGroup = new Map<string, {
    range: PhysicPaintRotoLoopRange;
    resolvedEnd: number;
  }>();
  for (const range of props.ranges) {
    const current = rangeAuthorityByGroup.get(range.loopId);
    if (current) {
      current.resolvedEnd = Math.max(current.resolvedEnd, range.effectiveEnd);
    } else {
      rangeAuthorityByGroup.set(range.loopId, {
        range,
        resolvedEnd: range.effectiveEnd,
      });
    }
  }
  const visibleTargets = [...rangeAuthorityByGroup.values()].flatMap(({ range, resolvedEnd }) => {
    const presentation = props.presentations.get(range.loopId);
    const continuousRange = {
      ...range,
      placementStart: range.phaseOrigin,
      // Draw to the resolved (parent-truncated) end for finite loops too, so
      // the clip extent matches the frames that actually resolve (WR-03).
      // resolvedEnd is the max effectiveEnd across the loop's fragments.
      effectiveEnd: resolvedEnd,
    };
    const geometry = projectPhysicsPaintLoopClipGeometry(
      continuousRange,
      props.visibleFrameWindow,
      props.framePitch,
    );
    const actionLinked = props.linkedLoopClipIds?.includes(range.loopId) ?? false;
    const linkedActionName = actionLinked ? props.linkedActionName?.trim() : null;
    const linkedDescription = linkedActionName
      ? `Linked to selected Action ${linkedActionName}.`
      : null;
    const targetPresentation = presentation
      ? {
          ...presentation,
          linkedDescription,
          accessibleName: `${presentation.accessibleName}${linkedDescription ? ` ${linkedDescription}` : ''}`,
        }
      : null;
    return targetPresentation && geometry ? [{
      range: continuousRange,
      presentation: targetPresentation,
      geometry,
      actionLinked,
      showStartBoundary: continuousRange.placementStart >= props.visibleFrameWindow.startFrame,
      showEndBoundary: continuousRange.effectiveEnd <= props.visibleFrameWindow.endFrameExclusive,
    }] : [];
  });

  if (visibleTargets.length === 0) return null;

  return (
    <div class="physics-paint-loop-clip-rail" role="group" aria-label="Rails">
      {visibleTargets.map(({ range, presentation, geometry, actionLinked, showStartBoundary, showEndBoundary }) => (
        <PhysicsPaintLoopClipRailTarget
          key={range.loopId}
          range={range}
          presentation={presentation}
          left={geometry.left}
          width={geometry.width}
          selected={props.selectedLoopClipIds.includes(range.loopId)
            || (props.railSetMemberLoopIds?.includes(range.loopId) ?? false)}
          isSetMember={props.railSetMemberLoopIds?.includes(range.loopId) ?? false}
          railSetMoveMemberLoopIds={props.railSetMoveMemberLoopIds}
          isSetAnchor={props.railSetAnchorLoopId === range.loopId}
          railSetSize={props.railSetSize}
          actionLinked={actionLinked}
          showStartBoundary={showStartBoundary}
          showEndBoundary={showEndBoundary}
          framePitch={props.framePitch}
          visibleFrameWindow={props.visibleFrameWindow}
          onSelectLoopClip={props.onSelectLoopClip}
          onOpenLoopEdit={props.onOpenLoopEdit}
          prepareRotoGroupDrag={props.prepareRotoGroupDrag}
          commitRotoGroupDrag={props.commitRotoGroupDrag}
          getClampInput={props.getClampInput}
          onRotoGroupDragRejected={props.onRotoGroupDragRejected}
          onPreviewChange={props.onPreviewChange}
          windowLike={props.windowLike}
          onRailSetDragPointerDown={props.onRailSetDragPointerDown}
          onRailSetDragClickSuppressed={props.onRailSetDragClickSuppressed}
          suppressTooltip={props.suppressTooltip}
          registerClickSequenceCanceller={props.registerClickSequenceCanceller}
        />
      ))}
      {/* 47 UAT: the filmstrip capsule overlay is REMOVED — the Motion/
          Static rails keep the locked Phase 43 surface (no cells, no
          badge, no repetition band on the rail). All loop facts live in
          the tooltip only. */}
    </div>
  );
}
