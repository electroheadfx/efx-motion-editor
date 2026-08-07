import type { PhysicPaintRotoLoopRange } from '../roto/physicsPaintRotoPhysicalResolver';

export interface PhysicsPaintLoopClipVisibleFrameWindow {
  startFrame: number;
  endFrameExclusive: number;
}

export interface PhysicsPaintLoopClipLaneProps {
  ranges: readonly PhysicPaintRotoLoopRange[];
  visibleFrameWindow: PhysicsPaintLoopClipVisibleFrameWindow;
  framePitch: number;
  selectedLoopClipId?: string | null;
  onSelectLoopClip?: (loopId: string) => void;
  onOpenLoopEdit: (loopId: string) => Promise<unknown>;
}

interface LoopClipActivationEvent {
  stopPropagation(): void;
  preventDefault(): void;
}

export function activatePhysicsPaintLoopClipBody(
  loopId: string,
  event: LoopClipActivationEvent,
  onSelectLoopClip?: (loopId: string) => void,
): void {
  event.stopPropagation();
  onSelectLoopClip?.(loopId);
}

export async function activatePhysicsPaintLoopClipBadge(
  loopId: string,
  event: LoopClipActivationEvent,
  onOpenLoopEdit: (loopId: string) => Promise<unknown>,
): Promise<void> {
  event.preventDefault();
  event.stopPropagation();
  await onOpenLoopEdit(loopId);
}

function getLoopClipBadgeText(range: PhysicPaintRotoLoopRange): string {
  return range.repeat === 'infinity'
    ? `Cycle ${range.cycleLength}f × ∞`
    : `Cycle ${range.cycleLength}f × ${range.repeat} = ${range.cycleLength * range.repeat}f`;
}

export function PhysicsPaintLoopClipLane(props: PhysicsPaintLoopClipLaneProps) {
  const visibleRanges = props.ranges.filter((range) => (
    range.effectiveEnd > props.visibleFrameWindow.startFrame
    && range.placementStart < props.visibleFrameWindow.endFrameExclusive
  ));

  return (
    <div
      class="physics-paint-loop-clip-lane"
      role="row"
      aria-label="Loop Clips"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span class="physics-paint-loop-clip-lane-label">Loop Clips</span>
      {visibleRanges.map((range) => {
        const clippedStart = Math.max(range.placementStart, props.visibleFrameWindow.startFrame);
        const clippedEnd = Math.min(range.effectiveEnd, props.visibleFrameWindow.endFrameExclusive);
        const left = (clippedStart - props.visibleFrameWindow.startFrame) * props.framePitch;
        const width = Math.max(props.framePitch, (clippedEnd - clippedStart) * props.framePitch);
        const selected = props.selectedLoopClipId === range.loopId;
        const badge = getLoopClipBadgeText(range);
        return (
          <div
            key={range.loopId}
            class={`physics-paint-loop-clip ${selected ? 'selected' : ''}`}
            style={{ left: `${left}px`, width: `${width}px` }}
          >
            <button
              type="button"
              class="physics-paint-loop-clip-body"
              aria-label={`Loop Clip — ${badge}`}
              aria-pressed={selected}
              onClick={(event) => activatePhysicsPaintLoopClipBody(range.loopId, event, props.onSelectLoopClip)}
            />
            <button
              type="button"
              class="physics-paint-loop-clip-badge"
              aria-label={`Edit Loop Clip — ${badge}`}
              onClick={async (event) => {
                await activatePhysicsPaintLoopClipBadge(range.loopId, event, props.onOpenLoopEdit);
              }}
            >
              {badge}
            </button>
          </div>
        );
      })}
    </div>
  );
}
