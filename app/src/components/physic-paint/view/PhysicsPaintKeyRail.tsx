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
  readonly onSelectKeyRail: PhysicsPaintKeyRailProps['onSelectKeyRail'];
  readonly prepareKeyRailDrag?: PhysicsPaintKeyRailProps['prepareKeyRailDrag'];
  readonly commitKeyRailDrag?: PhysicsPaintKeyRailProps['commitKeyRailDrag'];
  readonly getClampInput?: PhysicsPaintKeyRailProps['getClampInput'];
  readonly onKeyRailDragRejected?: PhysicsPaintKeyRailProps['onKeyRailDragRejected'];
  readonly onPreviewChange?: PhysicsPaintKeyRailProps['onPreviewChange'];
  readonly busy: boolean;
  readonly windowLike?: KeyRailDragWindowLike;
  readonly onRailFocus?: (element: HTMLElement) => void;
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
        onPointerDown={drag.onPointerDown}
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
        />
      ))}
    </div>
  );
}
