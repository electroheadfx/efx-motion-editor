import { useRef } from 'preact/hooks';
import type { PhysicPaintRotoKeyRailDragClampInput } from '../roto/physicsPaintRotoPhysicalResolver';
import { clampPhysicPaintKeyRailDragDestination } from '../roto/physicsPaintRotoPhysicalResolver';
import {
  usePhysicsPaintKeyRailDrag,
  type KeyRailDragPreviewState,
  type KeyRailDragWindowLike,
} from '../hooks/usePhysicsPaintKeyRailDrag';
import type {
  RotoKeyRailDragPreparationResult,
  RotoKeyRailDragPublication,
  RotoKeyRailSelection,
} from '../hooks/useRotoTimelineActions';
import { buildRailSetTooltipSentence } from '../hooks/useRotoTimelineActions';
import type { PhysicsPaintRotoSpacingSelectionGesture } from '../roto/physicsPaintRotoSpacingSelection';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import {
  buildKeyRailBaseCopy,
  buildSelectedKeyRailCopy,
  type KeyRailSegment,
  type SelectedKeyRailCopyAvailability,
} from './physicsPaintKeyRailPresentation';
import {
  dispatchRailTargetKeyDown,
  focusRailTargetOnPointerSelection,
  RAIL_LANE_SELECTOR,
  roveRailTargetFocus,
} from './physicsPaintRailKeyboardNavigation';

export interface PhysicsPaintKeyRailGeometry {
  readonly left: number;
  readonly width: number;
  readonly showStartBoundary: boolean;
  readonly showEndBoundary: boolean;
}

export function projectPhysicsPaintKeyRailGeometry(
  segment: KeyRailSegment,
  visibleFrameWindow: { readonly startFrame: number; readonly endFrameExclusive: number },
  framePitch: number,
): PhysicsPaintKeyRailGeometry | null {
  const segmentEndExclusive = segment.lastKeyFrame + 1;
  if (
    segmentEndExclusive <= visibleFrameWindow.startFrame
    || segment.firstKeyFrame >= visibleFrameWindow.endFrameExclusive
  ) return null;

  const clippedStart = Math.max(segment.firstKeyFrame, visibleFrameWindow.startFrame);
  const clippedEnd = Math.min(segmentEndExclusive, visibleFrameWindow.endFrameExclusive);
  return {
    left: (clippedStart - visibleFrameWindow.startFrame) * framePitch,
    width: Math.max(framePitch, (clippedEnd - clippedStart) * framePitch),
    showStartBoundary: segment.firstKeyFrame >= visibleFrameWindow.startFrame,
    showEndBoundary: segmentEndExclusive <= visibleFrameWindow.endFrameExclusive,
  };
}

export interface PhysicsPaintKeyRailProps extends SelectedKeyRailCopyAvailability {
  readonly segments: readonly KeyRailSegment[];
  readonly visibleFrameWindow: {
    readonly startFrame: number;
    readonly endFrameExclusive: number;
  };
  readonly framePitch: number;
  readonly selectedKeyRail: RotoKeyRailSelection | null;
  /** Key Rails that are members of the session rail-set (43.6 D-01); they
   *  paint the same orange selection line as single selection — no new color. */
  readonly railSetMemberKeyRailIds?: readonly string[];
  /** Key Rails that are MOVABLE set members (260820-lwd): derived from the
   *  explicit railSetMoveMembers in the strip. Only these hand their
   *  pointer-down (and trailing-click suppression) to the batch set-drag
   *  session; a plain-selected single rail is a paint member but NOT a move
   *  member, so it runs its own 43.3/43.4 drag. */
  readonly railSetMoveMemberKeyRailIds?: readonly string[];
  /** The set anchor Key Rail identity, if any — carries the anchor tick. */
  readonly railSetAnchorKeyRailId?: string | null;
  /** Total rail-set size (all kinds) for the M1 tooltip set sentence. */
  readonly railSetSize?: number;
  readonly onSelectKeyRail: (
    selection: RotoKeyRailSelection,
    gesture: PhysicsPaintRotoSpacingSelectionGesture,
  ) => void;
  readonly prepareKeyRailDrag?: (
    firstKeyId: string,
    destinationFirstKeyAppFrame: number,
  ) => RotoKeyRailDragPreparationResult;
  readonly commitKeyRailDrag?: (publication: RotoKeyRailDragPublication) => Promise<boolean>;
  readonly getClampInput?: (
    segment: KeyRailSegment,
  ) => Omit<PhysicPaintRotoKeyRailDragClampInput, 'proposedDestinationFirstKeyAppFrame'> | null;
  readonly onKeyRailDragRejected?: (reason?: string, detail?: string) => void;
  readonly onPreviewChange?: (
    preview: KeyRailDragPreviewState<RotoKeyRailDragPublication> | null,
  ) => void;
  readonly busy?: boolean;
  readonly windowLike?: KeyRailDragWindowLike;
  readonly onRailFocus?: (element: HTMLElement) => void;
  /** 43.6-03 D-08: batch rail-set session pointer-down routing for set
   *  members; absent means no batch session (pre-43.6 behavior). */
  readonly onRailSetDragPointerDown?: (event: PointerEvent) => void;
  /** 43.6-03 D-08: batch rail-set trailing-click suppression consumer. */
  readonly onRailSetDragClickSuppressed?: () => boolean;
}

interface RailMouseEvent {
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

interface PhysicsPaintKeyRailTargetProps extends SelectedKeyRailCopyAvailability {
  readonly segment: KeyRailSegment;
  readonly geometry: PhysicsPaintKeyRailGeometry;
  readonly visibleFrameWindow: PhysicsPaintKeyRailProps['visibleFrameWindow'];
  readonly framePitch: number;
  readonly selected: boolean;
  readonly isSetMember: boolean;
  readonly isSetAnchor: boolean;
  readonly railSetSize?: number;
  /** Movable set membership (260820-lwd): routes pointer-down / click
   *  suppression to the batch session; absent for plain-selected single rails. */
  readonly railSetMoveMemberKeyRailIds?: readonly string[];
  readonly onSelectKeyRail: PhysicsPaintKeyRailProps['onSelectKeyRail'];
  readonly prepareKeyRailDrag?: PhysicsPaintKeyRailProps['prepareKeyRailDrag'];
  readonly commitKeyRailDrag?: PhysicsPaintKeyRailProps['commitKeyRailDrag'];
  readonly getClampInput?: PhysicsPaintKeyRailProps['getClampInput'];
  readonly onKeyRailDragRejected?: PhysicsPaintKeyRailProps['onKeyRailDragRejected'];
  readonly onPreviewChange?: PhysicsPaintKeyRailProps['onPreviewChange'];
  readonly busy: boolean;
  readonly windowLike?: KeyRailDragWindowLike;
  readonly onRailFocus?: (element: HTMLElement) => void;
  readonly onRailSetDragPointerDown?: (event: PointerEvent) => void;
  readonly onRailSetDragClickSuppressed?: () => boolean;
}

function sameKeyRailSelection(
  selection: RotoKeyRailSelection | null,
  segment: KeyRailSegment,
): boolean {
  return selection?.firstKeyId === segment.firstKeyId
    && selection.keyIds.length === segment.keyIds.length
    && selection.keyIds.every((keyId, index) => keyId === segment.keyIds[index]);
}

function PhysicsPaintKeyRailTarget(props: PhysicsPaintKeyRailTargetProps) {
  const tooltip = useStyledTooltip();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const { segment, geometry } = props;
  // 260820-lwd: drag-routing membership (explicit movable set) is separate
  // from the paint/set-of-one classifier. A plain-selected single rail is a
  // paint member (isSetMember true) but NOT a move member.
  const isMoveMember = props.railSetMoveMemberKeyRailIds?.includes(segment.firstKeyId) ?? false;
  const spanFrames = segment.lastKeyFrame - segment.firstKeyFrame + 1;
  const selection = (): RotoKeyRailSelection => ({
    firstKeyId: segment.firstKeyId,
    keyIds: segment.keyIds,
  });
  const clearClickSequence = () => {};
  const drag = usePhysicsPaintKeyRailDrag<RotoKeyRailDragPublication>({
    projectDestination: ({ originClientX, clientX }) => (
      segment.firstKeyFrame + Math.round((clientX - originClientX) / props.framePitch)
    ),
    clampDestination: (proposedDestination) => {
      const clampInput = props.getClampInput?.(segment) ?? null;
      const result = clampInput
        ? clampPhysicPaintKeyRailDragDestination({
            ...clampInput,
            proposedDestinationFirstKeyAppFrame: proposedDestination,
          })
        : { ok: true as const, destinationFirstKeyAppFrame: proposedDestination };
      const destination = result.ok
        ? result.destinationFirstKeyAppFrame
        : segment.firstKeyFrame;
      return {
        destination,
        left: (destination - props.visibleFrameWindow.startFrame) * props.framePitch,
        width: Math.max(props.framePitch, spanFrames * props.framePitch),
        blockedEdge: destination === proposedDestination
          ? null
          : proposedDestination > destination ? 'right' : 'left',
      };
    },
    prepareAtDestination: (destination) => {
      if (props.busy) return { ok: false, reason: 'Key Rail move unavailable while another edit is in progress.' };
      return props.prepareKeyRailDrag?.(segment.firstKeyId, destination)
        ?? { ok: false, reason: props.dragUnavailableReason ?? 'Key Rail move unavailable.' };
    },
    onDropCommit: (publication) => props.commitKeyRailDrag?.(publication) ?? Promise.resolve(false),
    onRejected: props.onKeyRailDragRejected,
    onPreviewChange: props.onPreviewChange,
    clearClickSequence,
    windowLike: props.windowLike,
  });
  // 43.6 M1: a set member appends the set sentence (anchor form prefixed
  // ' Range anchor.') to its existing Selected form via the one mapper.
  const setSentence = props.isSetMember
    ? buildRailSetTooltipSentence(props.railSetSize ?? 0, props.isSetAnchor)
    : null;
  const copy = props.selected
    ? buildSelectedKeyRailCopy(segment, {
        dragUnavailableReason: props.dragUnavailableReason,
        deleteUnavailableReason: props.deleteUnavailableReason,
      }, setSentence)
    : buildKeyRailBaseCopy(segment);

  const handleClick = (event: RailMouseEvent) => {
    event.stopPropagation();
    // 43.6-03 D-08: a move member's trailing click after a batch drag is
    // suppressed by the batch session (never the own-drag suppression, which
    // is never armed for move members). Paint-only set-of-one members fall
    // through to their own suppression.
    if (isMoveMember && props.onRailSetDragClickSuppressed?.()) return;
    if (drag.consumeClickSuppression()) return;
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
    props.onSelectKeyRail(selection(), gesture);
  };
  const handleKeyDown = (event: RailKeyboardEvent) => {
    // 43.4 defect 9: the shared rail roving group owns ArrowLeft/ArrowRight/
    // Tab on every rail family; per-type Escape/Space handling continues below.
    const current = event.currentTarget as HTMLElement | null;
    const lane = current?.closest ? current.closest(RAIL_LANE_SELECTOR) : null;
    if (current && lane && dispatchRailTargetKeyDown(event, lane, current)) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      tooltip.hide();
      return;
    }
    if (event.key !== ' ') return;
    event.stopPropagation();
    event.preventDefault();
    tooltip.hide();
    // Space on a focused member plain-selects it and collapses the set (D-04).
    props.onSelectKeyRail(selection(), 'plain');
  };

  return (
    <span
      ref={anchorRef}
      class="physics-paint-key-rail-anchor"
      style={{ left: `${geometry.left}px`, width: `${geometry.width}px` }}
      onPointerEnter={tooltip.onPointerEnter}
      onPointerLeave={tooltip.onPointerLeave}
    >
      <button
        type="button"
        role="button"
        tabIndex={0}
        class={`physics-paint-rail-target physics-paint-key-rail-target${props.selected ? ' selected' : ''}${geometry.showStartBoundary ? ' boundary-start boundary-cell-start' : ''}${geometry.showEndBoundary ? ' boundary-end boundary-cell-end' : ''}${drag.ghost.active ? ' dragging' : ''}${props.busy ? ' busy' : ''}`}
        aria-label={copy}
        aria-pressed={props.selected}
        aria-busy={props.busy ? 'true' : undefined}
        data-rail-first-frame={segment.firstKeyFrame}
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
          drag.onPointerDown(event);
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          tooltip.onFocus();
          const current = event?.currentTarget as HTMLElement | null;
          const lane = current?.closest ? current.closest(RAIL_LANE_SELECTOR) : null;
          if (current && lane) roveRailTargetFocus(lane, current);
          props.onRailFocus?.(event?.currentTarget as HTMLElement);
        }}
        onBlur={tooltip.onBlur}
      >
        <span class="physics-paint-rail-segment physics-paint-key-rail-segment" aria-hidden="true" />
        {props.isSetAnchor ? (
          <span class="physics-paint-rail-anchor-tick" aria-hidden="true" />
        ) : null}
      </button>
      {drag.ghost.active ? (
        <span
          class="physics-paint-key-rail-ghost"
          style={{
            left: `${drag.ghost.left - geometry.left}px`,
            width: `${drag.ghost.width}px`,
          }}
          aria-hidden="true"
        />
      ) : null}
      {drag.ghost.active && drag.ghost.blockedEdge !== null ? (
        <span
          class={`physics-paint-key-rail-ghost-blocked-edge edge-${drag.ghost.blockedEdge}`}
          style={{
            left: `${drag.ghost.left - geometry.left
              + (drag.ghost.blockedEdge === 'left' ? 0 : drag.ghost.width - 2)}px`,
          }}
          aria-hidden="true"
        />
      ) : null}
      <PhysicsPaintStyledTooltip visible={tooltip.visible} region="bottom" anchorRef={anchorRef} topmost>
        <span class="physics-paint-key-rail-tooltip-copy">{copy}</span>
      </PhysicsPaintStyledTooltip>
    </span>
  );
}

export function PhysicsPaintKeyRail(props: PhysicsPaintKeyRailProps) {
  const visibleTargets = [...props.segments]
    .sort((left, right) => left.firstKeyFrame - right.firstKeyFrame)
    .flatMap((segment) => {
      const geometry = projectPhysicsPaintKeyRailGeometry(
        segment,
        props.visibleFrameWindow,
        props.framePitch,
      );
      return geometry ? [{ segment, geometry }] : [];
    });
  if (visibleTargets.length === 0) return null;

  return (
    <div class="physics-paint-key-rail" role="group" aria-label="Rails">
      {visibleTargets.map(({ segment, geometry }) => (
        <PhysicsPaintKeyRailTarget
          key={segment.firstKeyId}
          segment={segment}
          geometry={geometry}
          visibleFrameWindow={props.visibleFrameWindow}
          framePitch={props.framePitch}
          selected={sameKeyRailSelection(props.selectedKeyRail, segment)
            || (props.railSetMemberKeyRailIds?.includes(segment.firstKeyId) ?? false)}
          isSetMember={props.railSetMemberKeyRailIds?.includes(segment.firstKeyId) ?? false}
          railSetMoveMemberKeyRailIds={props.railSetMoveMemberKeyRailIds}
          isSetAnchor={props.railSetAnchorKeyRailId === segment.firstKeyId}
          railSetSize={props.railSetSize}
          onSelectKeyRail={props.onSelectKeyRail}
          prepareKeyRailDrag={props.prepareKeyRailDrag}
          commitKeyRailDrag={props.commitKeyRailDrag}
          getClampInput={props.getClampInput}
          onKeyRailDragRejected={props.onKeyRailDragRejected}
          onPreviewChange={props.onPreviewChange}
          dragUnavailableReason={props.dragUnavailableReason}
          deleteUnavailableReason={props.deleteUnavailableReason}
          busy={props.busy ?? false}
          windowLike={props.windowLike}
          onRailFocus={props.onRailFocus}
          onRailSetDragPointerDown={props.onRailSetDragPointerDown}
          onRailSetDragClickSuppressed={props.onRailSetDragClickSuppressed}
        />
      ))}
    </div>
  );
}
