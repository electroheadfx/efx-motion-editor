import { useEffect, useRef } from 'preact/hooks';
import type { PhysicPaintRotoLoopRange } from '../roto/physicsPaintRotoPhysicalResolver';
import type { PhysicsPaintRotoSpacingSelectionGesture } from '../roto/physicsPaintRotoSpacingSelection';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import {
  projectPhysicsPaintLoopClipGeometry,
  type PhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';

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
  readonly onSelectLoopClip: (
    loopId: string,
    gesture: PhysicsPaintRotoSpacingSelectionGesture,
  ) => void;
  readonly onOpenLoopEdit: (loopId: string) => Promise<unknown>;
}

interface RailMouseEvent {
  readonly timeStamp: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  stopPropagation(): void;
  preventDefault(): void;
}

interface RailKeyboardEvent {
  readonly key: string;
  stopPropagation(): void;
  preventDefault(): void;
}

interface RailTargetProps {
  readonly range: PhysicPaintRotoLoopRange;
  readonly presentation: PhysicsPaintLoopClipPresentation;
  readonly left: number;
  readonly width: number;
  readonly selected: boolean;
  readonly showStartBoundary: boolean;
  readonly showEndBoundary: boolean;
  readonly onSelectLoopClip: (
    loopId: string,
    gesture: PhysicsPaintRotoSpacingSelectionGesture,
  ) => void;
  readonly onOpenLoopEdit: (loopId: string) => Promise<unknown>;
}

function PhysicsPaintLoopClipRailTarget(props: RailTargetProps) {
  const tooltip = useStyledTooltip();
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const pendingSingleClickRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickTimestampRef = useRef<number | null>(null);
  const { range, presentation } = props;

  const clearPendingSingleClick = () => {
    if (pendingSingleClickRef.current === null) return;
    clearTimeout(pendingSingleClickRef.current);
    pendingSingleClickRef.current = null;
  };
  const clearClickSequence = () => {
    clearPendingSingleClick();
    lastClickTimestampRef.current = null;
  };
  useEffect(() => clearClickSequence, []);

  const stopPointerEvent = (event: { stopPropagation(): void }) => {
    event.stopPropagation();
  };
  const handleClick = (event: RailMouseEvent) => {
    event.stopPropagation();
    tooltip.hide();
    const gesture: PhysicsPaintRotoSpacingSelectionGesture = event.shiftKey
      ? 'range'
      : event.metaKey || event.ctrlKey
        ? 'toggle'
        : 'plain';
    const previousTimestamp = lastClickTimestampRef.current;
    const elapsed = previousTimestamp === null
      ? Number.POSITIVE_INFINITY
      : event.timeStamp - previousTimestamp;
    if (elapsed >= 0 && elapsed <= LOOP_CLIP_FAST_DOUBLE_CLICK_MS) {
      event.preventDefault();
      clearClickSequence();
      props.onSelectLoopClip(range.loopId, 'plain');
      void props.onOpenLoopEdit(range.loopId);
      return;
    }
    clearPendingSingleClick();
    lastClickTimestampRef.current = event.timeStamp;
    pendingSingleClickRef.current = setTimeout(() => {
      pendingSingleClickRef.current = null;
      lastClickTimestampRef.current = null;
      props.onSelectLoopClip(range.loopId, gesture);
    }, LOOP_CLIP_SINGLE_CLICK_DELAY_MS);
  };
  const handleKeyDown = (event: RailKeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      tooltip.hide();
      clearClickSequence();
      props.onSelectLoopClip(range.loopId, 'plain');
      void props.onOpenLoopEdit(range.loopId);
    }
  };

  return (
    <span
      ref={anchorRef}
      class="physics-paint-loop-clip-rail-anchor"
      style={{ left: `${props.left}px`, width: `${props.width}px` }}
      onPointerEnter={tooltip.onPointerEnter}
      onPointerLeave={tooltip.onPointerLeave}
    >
      <button
        type="button"
        class={`physics-paint-loop-clip-rail-target mode-${presentation.mode}${props.selected ? ' selected' : ''}${props.showStartBoundary ? ' boundary-start' : ''}${props.showEndBoundary ? ' boundary-end' : ''}${range.truncated ? ' truncated' : ''}${range.unresolved ? ' unresolved' : ''}`}
        aria-label={`${presentation.displayName}. ${presentation.cycleLabel}. ${presentation.effectiveLabel}. ${presentation.modeLabel}. ${presentation.statusLabel}.`}
        aria-pressed={props.selected}
        onPointerDown={stopPointerEvent}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={tooltip.onFocus}
        onBlur={tooltip.onBlur}
      >
        <span class="physics-paint-loop-clip-rail-segment" aria-hidden="true" />
      </button>
      <PhysicsPaintStyledTooltip visible={tooltip.visible} region="bottom" anchorRef={anchorRef} topmost>
        <span class="physics-paint-loop-clip-tooltip-copy">
          <strong>{presentation.displayName}</strong>
          <span>{presentation.cycleLabel}</span>
          <span>{presentation.effectiveLabel}</span>
          <span>Mode: {presentation.modeLabel}</span>
          <span>Status: {presentation.statusLabel}</span>
        </span>
      </PhysicsPaintStyledTooltip>
    </span>
  );
}

export function PhysicsPaintLoopClipRail(props: PhysicsPaintLoopClipRailProps) {
  const visibleTargets = props.ranges.flatMap((range) => {
    const presentation = props.presentations.get(range.loopId);
    const geometry = projectPhysicsPaintLoopClipGeometry(
      range,
      props.visibleFrameWindow,
      props.framePitch,
    );
    return presentation && geometry ? [{
      range,
      presentation,
      geometry,
      showStartBoundary: range.placementStart >= props.visibleFrameWindow.startFrame,
      showEndBoundary: range.effectiveEnd <= props.visibleFrameWindow.endFrameExclusive,
    }] : [];
  });

  if (visibleTargets.length === 0) return null;

  return (
    <div class="physics-paint-loop-clip-rail" role="group" aria-label="Loop Clips">
      {visibleTargets.map(({ range, presentation, geometry, showStartBoundary, showEndBoundary }) => (
        <PhysicsPaintLoopClipRailTarget
          key={range.loopId}
          range={range}
          presentation={presentation}
          left={geometry.left}
          width={geometry.width}
          selected={props.selectedLoopClipIds.includes(range.loopId)}
          showStartBoundary={showStartBoundary}
          showEndBoundary={showEndBoundary}
          onSelectLoopClip={props.onSelectLoopClip}
          onOpenLoopEdit={props.onOpenLoopEdit}
        />
      ))}
    </div>
  );
}
