import type { PhysicPaintRotoLoopRange } from '../roto/physicsPaintRotoPhysicalResolver';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import {
  projectPhysicsPaintLoopClipGeometry,
  type PhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';

export interface PhysicsPaintLoopClipRailProps {
  readonly ranges: readonly PhysicPaintRotoLoopRange[];
  readonly presentations: ReadonlyMap<string, PhysicsPaintLoopClipPresentation>;
  readonly visibleFrameWindow: {
    readonly startFrame: number;
    readonly endFrameExclusive: number;
  };
  readonly framePitch: number;
  readonly selectedLoopClipId: string | null;
  readonly onSelectLoopClip: (loopId: string) => void;
  readonly onOpenLoopEdit: (loopId: string) => Promise<unknown>;
}

interface RailMouseEvent {
  readonly detail: number;
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
  readonly onSelectLoopClip: (loopId: string) => void;
  readonly onOpenLoopEdit: (loopId: string) => Promise<unknown>;
}

function PhysicsPaintLoopClipRailTarget(props: RailTargetProps) {
  const tooltip = useStyledTooltip();
  const { range, presentation } = props;

  const stopPointerEvent = (event: { stopPropagation(): void }) => {
    event.stopPropagation();
  };
  const handleClick = (event: RailMouseEvent) => {
    event.stopPropagation();
    tooltip.hide();
    if (event.detail === 2) {
      event.preventDefault();
      void props.onOpenLoopEdit(range.loopId);
      return;
    }
    props.onSelectLoopClip(range.loopId);
  };
  const handleKeyDown = (event: RailKeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      tooltip.hide();
      void props.onOpenLoopEdit(range.loopId);
    }
  };

  return (
    <span
      class="physics-paint-loop-clip-rail-anchor"
      style={{ left: `${props.left}px`, width: `${props.width}px` }}
      onPointerEnter={tooltip.onPointerEnter}
      onPointerLeave={tooltip.onPointerLeave}
    >
      <button
        type="button"
        class={`physics-paint-loop-clip-rail-target${props.selected ? ' selected' : ''}${range.truncated ? ' truncated' : ''}${range.unresolved ? ' unresolved' : ''}`}
        aria-label={`${presentation.displayName}. ${presentation.cycleLabel}. ${presentation.effectiveLabel}. ${presentation.statusLabel}.`}
        aria-pressed={props.selected}
        onPointerDown={stopPointerEvent}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onFocus={tooltip.onFocus}
        onBlur={tooltip.onBlur}
      >
        <span class="physics-paint-loop-clip-rail-segment" aria-hidden="true" />
      </button>
      <PhysicsPaintStyledTooltip visible={tooltip.visible} region="bottom">
        <span class="physics-paint-loop-clip-tooltip-copy">
          <strong>{presentation.displayName}</strong>
          <span>{presentation.cycleLabel}</span>
          <span>{presentation.effectiveLabel}</span>
          <span>{presentation.statusLabel}</span>
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
    return presentation && geometry ? [{ range, presentation, geometry }] : [];
  });

  if (visibleTargets.length === 0) return null;

  return (
    <div class="physics-paint-loop-clip-rail" role="group" aria-label="Loop Clips">
      {visibleTargets.map(({ range, presentation, geometry }) => (
        <PhysicsPaintLoopClipRailTarget
          key={range.loopId}
          range={range}
          presentation={presentation}
          left={geometry.left}
          width={geometry.width}
          selected={props.selectedLoopClipId === range.loopId}
          onSelectLoopClip={props.onSelectLoopClip}
          onOpenLoopEdit={props.onOpenLoopEdit}
        />
      ))}
    </div>
  );
}
