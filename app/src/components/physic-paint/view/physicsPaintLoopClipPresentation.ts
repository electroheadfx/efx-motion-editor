import type { PhysicPaintRotoLoopClip } from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoLoopRange } from '../roto/physicsPaintRotoPhysicalResolver';

export type PhysicsPaintGroupLifecycle =
  | 'synchronized'
  | 'modified'
  | 'detached'
  | 'unavailable'
  | 'unresolved';

export type PhysicsPaintGroupSynchronizationDot = Exclude<PhysicsPaintGroupLifecycle, 'unresolved'>;

export interface PhysicsPaintGroupFragmentContext {
  readonly index: number;
  readonly count: number;
  readonly start: number;
  readonly endExclusive: number;
}

export interface PhysicsPaintLoopClipPresentationOptions {
  readonly groupDisplayName?: string | null;
  readonly fragment?: PhysicsPaintGroupFragmentContext | null;
  readonly linkedActionName?: string | null;
}

export interface PhysicsPaintLoopClipPresentation {
  readonly loopId: string;
  readonly displayName: string;
  readonly sourceLabel: string;
  readonly placementLabel: string;
  readonly cycleLabel: string;
  readonly effectiveLabel: string;
  /** True when a next clip (or the parent/capacity bound) shortens the loop (D-12). */
  readonly shortened: boolean;
  /** True when the effective end lands mid-cycle rather than on a cycle boundary (D-21). */
  readonly partialCycle: boolean;
  /** 'Loop shortened by next clip' when shortened, else null (English, D-14). */
  readonly shortenedLabel: string | null;
  /** Number of fully completed source cycles within the effective range. */
  readonly repeatInstanceCount: number;
  /** 'next clip — interrupts the loop' when shortened, else null (D-14). */
  readonly interruptionTooltipLine: string | null;
  readonly mode: PhysicPaintRotoLoopClip['mode'];
  readonly modeLabel: 'Motion' | 'Static';
  readonly groupTypeLabel: 'Motion Rail' | 'Static Rail';
  readonly lifecycle: PhysicsPaintGroupLifecycle;
  readonly statusLabel: string;
  readonly synchronizationDot: PhysicsPaintGroupSynchronizationDot | null;
  readonly regenerateDisabledReason: string | null;
  readonly fragmentLabel: string | null;
  readonly linkedDescription: string | null;
  readonly tooltipLines: readonly string[];
  readonly accessibleName: string;
}

export type PhysicsPaintGroupProductReason = 'spacing-source-selected' | 'operation-failed';

export type PhysicsPaintGroupAcceptedFeedbackRequest =
  | { readonly operation: 'paint-frame'; readonly frame: number; readonly groupName: string }
  | { readonly operation: 'delete-frame'; readonly frame: number; readonly groupName: string }
  | { readonly operation: 'delete-group'; readonly groupName: string }
  | { readonly operation: 'regenerate-group'; readonly groupName: string }
  | { readonly operation: 'regenerate-shared'; readonly count: number }
  | { readonly operation: 'keep-groups'; readonly actionName: string; readonly count: number }
  | { readonly operation: 'delete-action-and-groups'; readonly actionName: string; readonly count: number };

export interface PhysicsPaintLoopClipGeometry {
  readonly left: number;
  readonly width: number;
}

export function projectPhysicsPaintLoopClipPresentation(
  range: PhysicPaintRotoLoopRange,
  clip: PhysicPaintRotoLoopClip | undefined,
  sourceActionName: string | null,
  options: PhysicsPaintLoopClipPresentationOptions = {},
): PhysicsPaintLoopClipPresentation {
  const requestedDuration = range.repeat === 'infinity'
    ? null
    : range.cycleLength * range.repeat;
  const cycleLabel = range.repeat === 'infinity'
    ? `Cycle ${range.cycleLength}f × ∞`
    : `Cycle ${range.cycleLength}f × ${range.repeat} = ${requestedDuration}f`;
  // The effective duration reflects the frames that actually resolve: the
  // resolver truncates finite loops at the parent end (effectiveEnd <
  // requestedEnd when truncated), so use effectiveEnd for both finite and
  // infinity loops. requestedEnd stays in the cycle label, which correctly
  // describes the user's intent (WR-03).
  const effectiveEnd = range.effectiveEnd;
  const effectiveDuration = Math.max(0, effectiveEnd - range.phaseOrigin);
  const mode = clip?.mode ?? 'progressive';
  const modeLabel = mode === 'static' ? 'Static' : 'Motion';
  const groupTypeLabel = `${modeLabel} Rail` as const;
  const groupDisplayName = options.groupDisplayName?.trim();
  const displayName = groupDisplayName
    || (sourceActionName ? `${sourceActionName} Rail` : `${groupTypeLabel} at F${range.phaseOrigin}`);
  const lifecycle = resolveGroupLifecycle(range, clip, sourceActionName);
  const statusLabel = statusLabelFor(lifecycle);
  const synchronizationDot = lifecycle === 'unresolved' ? null : lifecycle;
  const regenerateDisabledReason = regenerateDisabledReasonFor(lifecycle);
  const fragment = options.fragment ?? null;
  const fragmentLabel = fragment && fragment.count > 1
    ? `Range F${fragment.start}–F${fragment.endExclusive - 1} · Fragment ${fragment.index} of ${fragment.count}`
    : null;
  const linkedActionName = options.linkedActionName?.trim();
  const linkedDescription = linkedActionName
    ? `Linked to selected Action ${linkedActionName}.`
    : null;
  // Shortened facts come straight from the resolver (D-32): truncated is
  // already true exactly when the effective end falls short of the natural
  // bound, and partialCycle distinguishes a mid-cycle truncation from one
  // landing on a cycle boundary. The badge (cycleLabel) never changes — it
  // always shows the REQUESTED duration (Pitfall m2); the shortened state is
  // a distinct visual + label (D-12).
  const shortened = Boolean(range.truncated);
  const partialCycle = range.partialCycle;
  const repeatInstanceCount = Math.floor(
    Math.max(0, effectiveEnd - range.phaseOrigin) / Math.max(1, range.cycleLength),
  );
  const shortenedLabel = shortened ? 'Loop shortened by next clip' : null;
  const interruptionTooltipLine = shortened ? 'next clip — interrupts the loop' : null;
  const tooltipLines = [
    displayName,
    `Type: ${modeLabel}`,
    cycleLabel,
    `Effective ${effectiveDuration}f`,
    `Status: ${statusLabel}`,
    ...(interruptionTooltipLine ? [interruptionTooltipLine] : []),
    ...(fragmentLabel ? [fragmentLabel] : []),
  ];
  const accessibleName = fragmentLabel && fragment
    ? `${displayName}. Fragment ${fragment.index} of ${fragment.count}, frames ${fragment.start} through ${fragment.endExclusive - 1}. ${groupTypeLabel}. ${statusLabel}${linkedDescription ? ` ${linkedDescription}` : ''}`
    : `${displayName}. ${groupTypeLabel}. ${cycleLabel}. Effective ${effectiveDuration} frames. ${statusLabel}${linkedDescription ? ` ${linkedDescription}` : ''}`;

  return {
    loopId: range.loopId,
    displayName,
    sourceLabel: sourceActionName ?? 'Source Action unavailable',
    placementLabel: `F${range.phaseOrigin}`,
    cycleLabel,
    effectiveLabel: `Effective ${effectiveDuration}f`,
    shortened,
    partialCycle,
    shortenedLabel,
    repeatInstanceCount,
    interruptionTooltipLine,
    mode,
    modeLabel,
    groupTypeLabel,
    lifecycle,
    statusLabel,
    synchronizationDot,
    regenerateDisabledReason,
    fragmentLabel,
    linkedDescription,
    tooltipLines,
    accessibleName,
  };
}

export function projectPhysicsPaintLoopClipFragmentPresentation(
  presentation: PhysicsPaintLoopClipPresentation,
  fragment: PhysicsPaintGroupFragmentContext,
  linkedActionName: string | null = null,
): PhysicsPaintLoopClipPresentation {
  const fragmentLabel = fragment.count > 1
    ? `Range F${fragment.start}–F${fragment.endExclusive - 1} · Fragment ${fragment.index} of ${fragment.count}`
    : null;
  const normalizedLinkedActionName = linkedActionName?.trim();
  const linkedDescription = normalizedLinkedActionName
    ? `Linked to selected Action ${normalizedLinkedActionName}.`
    : null;
  const tooltipLines = [
    ...presentation.tooltipLines.slice(0, 5),
    ...(fragmentLabel ? [fragmentLabel] : []),
  ];
  const accessibleName = fragmentLabel
    ? `${presentation.displayName}. Fragment ${fragment.index} of ${fragment.count}, frames ${fragment.start} through ${fragment.endExclusive - 1}. ${presentation.groupTypeLabel}. ${presentation.statusLabel}${linkedDescription ? ` ${linkedDescription}` : ''}`
    : `${presentation.displayName}. ${presentation.groupTypeLabel}. ${presentation.cycleLabel}. Effective ${Math.max(0, fragment.endExclusive - fragment.start)} frames. ${presentation.statusLabel}${linkedDescription ? ` ${linkedDescription}` : ''}`;

  return {
    ...presentation,
    fragmentLabel,
    linkedDescription,
    tooltipLines,
    accessibleName,
  };
}

export function projectPhysicsPaintGroupProductReason(
  reason: PhysicsPaintGroupProductReason,
): string {
  switch (reason) {
    case 'spacing-source-selected':
      return 'Group source position selected for Key Spacing.';
    case 'operation-failed':
      return 'Couldn’t update this Group. Nothing changed. Review the reason and try again.';
  }
}

export function projectPhysicsPaintGroupAcceptedFeedback(
  request: PhysicsPaintGroupAcceptedFeedbackRequest,
): string {
  switch (request.operation) {
    case 'paint-frame':
      return `Updated F${request.frame}. ${request.groupName} is Modified.`;
    case 'delete-frame':
      return `Deleted F${request.frame} from ${request.groupName}.`;
    case 'delete-group':
      return `Deleted ${request.groupName}.`;
    case 'regenerate-group':
      return `Regenerated ${request.groupName}. Synchronized with Action.`;
    case 'regenerate-shared':
      return `Regenerated ${request.count} Groups. Synchronized with Action.`;
    case 'keep-groups':
      return `Deleted ${request.actionName}. Kept ${request.count} detached Groups.`;
    case 'delete-action-and-groups':
      return `Deleted ${request.actionName} and ${request.count} Groups.`;
  }
}

function resolveGroupLifecycle(
  range: PhysicPaintRotoLoopRange,
  clip: PhysicPaintRotoLoopClip | undefined,
  sourceActionName: string | null,
): PhysicsPaintGroupLifecycle {
  if (range.unresolved) return 'unresolved';
  if (clip?.provenanceState === 'detached') return 'detached';
  if (!sourceActionName) return 'unavailable';
  return clip?.syncState === 'modified' ? 'modified' : 'synchronized';
}

function statusLabelFor(lifecycle: PhysicsPaintGroupLifecycle): string {
  switch (lifecycle) {
    case 'synchronized': return 'Synchronized with Action.';
    case 'modified': return 'Modified locally — Regenerate to restore from Action.';
    case 'detached': return 'Action detached.';
    case 'unavailable': return 'Source Action unavailable.';
    case 'unresolved': return 'Source missing';
  }
}

function regenerateDisabledReasonFor(lifecycle: PhysicsPaintGroupLifecycle): string | null {
  switch (lifecycle) {
    case 'modified': return null;
    case 'synchronized': return 'Already synchronized with Action.';
    case 'detached': return 'Regenerate unavailable — Action detached.';
    case 'unavailable': return 'Regenerate unavailable — Source Action unavailable.';
    case 'unresolved': return 'Source missing';
  }
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
