import type { PhysicPaintRotoLoopClip } from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoLoopRange } from '../roto/physicsPaintRotoPhysicalResolver';

export interface PhysicsPaintLoopClipPresentation {
  readonly loopId: string;
  readonly displayName: string;
  readonly sourceLabel: string;
  readonly placementLabel: string;
  readonly cycleLabel: string;
  readonly effectiveLabel: string;
  readonly mode: PhysicPaintRotoLoopClip['mode'];
  readonly modeLabel: string;
  readonly statusLabel: string;
}

export interface PhysicsPaintLoopClipGeometry {
  readonly left: number;
  readonly width: number;
}

export function projectPhysicsPaintLoopClipPresentation(
  range: PhysicPaintRotoLoopRange,
  clip: PhysicPaintRotoLoopClip | undefined,
  sourceScriptName: string | null,
): PhysicsPaintLoopClipPresentation {
  const requestedDuration = range.repeat === 'infinity'
    ? null
    : range.cycleLength * range.repeat;
  const cycleLabel = range.repeat === 'infinity'
    ? `Cycle ${range.cycleLength}f × ∞`
    : `Cycle ${range.cycleLength}f × ${range.repeat} = ${requestedDuration}f`;
  const effectiveDuration = Math.max(0, range.effectiveEnd - range.placementStart);
  const statusLabel = range.unresolved
    ? 'Source missing'
    : range.truncated
      ? 'Loop shortened by next clip'
      : 'Linked';
  const displayName = `Loop Clip at F${range.placementStart}`;

  return {
    loopId: range.loopId,
    displayName,
    sourceLabel: sourceScriptName ?? 'Source unavailable',
    placementLabel: `F${range.placementStart}`,
    cycleLabel,
    effectiveLabel: `Effective ${effectiveDuration}f`,
    mode: clip?.mode ?? 'progressive',
    modeLabel: clip?.mode === 'static' ? 'Static/Hold' : 'Progressive',
    statusLabel,
  };
}

export function projectPhysicsPaintLoopClipGeometry(
  range: PhysicPaintRotoLoopRange,
  visibleFrameWindow: { readonly startFrame: number; readonly endFrameExclusive: number },
  framePitch: number,
): PhysicsPaintLoopClipGeometry | null {
  if (
    range.effectiveEnd <= visibleFrameWindow.startFrame
    || range.placementStart >= visibleFrameWindow.endFrameExclusive
  ) return null;

  const clippedStart = Math.max(range.placementStart, visibleFrameWindow.startFrame);
  const clippedEnd = Math.min(range.effectiveEnd, visibleFrameWindow.endFrameExclusive);
  return {
    left: (clippedStart - visibleFrameWindow.startFrame) * framePitch,
    width: Math.max(framePitch, (clippedEnd - clippedStart) * framePitch),
  };
}
