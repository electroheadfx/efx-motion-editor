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
  /** Whether the photo reference is placed (reveal rails only, D-12/D-24). */
  readonly referencePlaced?: boolean;
  /** Whether the linked library script still exists (reveal rails only, D-13/D-24). */
  readonly scriptExists?: boolean;
}

// 52-03 (D-22): the reveal rail's green-family line colors. The variant color
// is the DEFAULT overrideColor — a reveal rail with `overrideColor: null`
// renders emerald (motion) / teal (static), overridable per rail via the
// existing 43-06 mechanism. Hover shades mirror the Loop Clip convention
// (500 base → 300 hover) per the UI-SPEC.
export const REVEAL_MOTION_COLOR = '#10b981';
export const REVEAL_STATIC_COLOR = '#14b8a6';
export const REVEAL_MOTION_HOVER_COLOR = '#6ee7b7';
export const REVEAL_STATIC_HOVER_COLOR = '#5eead4';

// 52-03 (D-23): the reveal rail's tooltip freshness line — the one line the
// Loop Clip tooltip does not have. Fresh when the bake matches the current
// script + reference; stale when either changed since the bake.
export const REVEAL_FRESH_LINE = 'baked from current script & reference';
export const REVEAL_STALE_LINE = 'stale — script or reference changed since bake, Replay to refresh';

// 52-03 (D-24): the reveal rail's Replay disabled reasons, mirroring the Loop
// Clip `regenerateDisabledReason` pattern. The red unresolved state stays
// EXCLUSIVELY for these fail-closed cases — never for a normal pending state.
export const REVEAL_REPLAY_DISABLED_NO_REFERENCE = 'Replay unavailable — no reference placed.';
export const REVEAL_REPLAY_DISABLED_SCRIPT_DELETED = 'Replay unavailable — script deleted.';

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
  /** Rail-kind discriminator (52-01 D-03): 'reveal' marks a reveal rail. */
  readonly railKind: 'playscript' | 'reveal';
  /** The rail line color (D-22): the reveal rail's variant color is the
   *  DEFAULT overrideColor, overridable per rail via the 43-06 mechanism. */
  readonly overrideColor: string | null;
  /** The reveal rail's tooltip freshness line (D-23), null for playscript rails. */
  readonly freshnessLine: string | null;
  /** The reveal rail's Replay disabled reason (D-24), null when Replay can run. */
  readonly replayDisabledReason: string | null;
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
  const lifecycle = resolveGroupLifecycle(range, clip);
  const statusLabel = statusLabelFor(lifecycle);
  const synchronizationDot = lifecycle === 'unresolved' ? null : lifecycle;
  const regenerateDisabledReason = regenerateDisabledReasonFor(lifecycle);
  // 52-03 (D-22/D-23/D-24): the reveal rail surface. The variant color is the
  // DEFAULT overrideColor (emerald motion / teal static), overridable per rail
  // via the existing 43-06 mechanism. The freshness line honestly reflects
  // whether the script or reference changed since the bake (D-23 prohibition:
  // a stale bake is never presented as fresh). The Replay disabled reason
  // mirrors `regenerateDisabledReasonFor` (D-24).
  const railKind = clip?.railKind ?? 'playscript';
  const isReveal = railKind === 'reveal';
  const overrideColor = isReveal
    ? (clip?.overrideColor ?? (mode === 'static' ? REVEAL_STATIC_COLOR : REVEAL_MOTION_COLOR))
    : (clip?.overrideColor ?? null);
  const referencePlaced = options.referencePlaced;
  const scriptExists = options.scriptExists;
  const isFresh = lifecycle === 'synchronized' && scriptExists !== false && referencePlaced !== false;
  const freshnessLine = isReveal ? (isFresh ? REVEAL_FRESH_LINE : REVEAL_STALE_LINE) : null;
  const replayDisabledReason = isReveal
    ? replayDisabledReasonFor(lifecycle, referencePlaced, scriptExists)
    : null;
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
  // 47 UAT: the capsule carries at most one compact badge — the shortened
  // phrase moved from the capsule surface into the tooltip.
  // 52-03 (D-23): the freshness line is appended AFTER the Status line — same
  // tooltipLines array, no new rendering path. The Replay disabled reason
  // (D-24) rides the same array so the rail target surfaces it on hover.
  const tooltipLines = [
    displayName,
    `Type: ${modeLabel}`,
    cycleLabel,
    `Effective ${effectiveDuration}f`,
    `Status: ${statusLabel}`,
    ...(freshnessLine ? [freshnessLine] : []),
    ...(replayDisabledReason ? [replayDisabledReason] : []),
    ...(shortenedLabel ? [shortenedLabel] : []),
    ...(interruptionTooltipLine ? [interruptionTooltipLine] : []),
    ...(fragmentLabel ? [fragmentLabel] : []),
  ];
  const accessibleName = fragmentLabel && fragment
    ? `${displayName}. Fragment ${fragment.index} of ${fragment.count}, frames ${fragment.start} through ${fragment.endExclusive - 1}. ${groupTypeLabel}. ${statusLabel}${freshnessLine ? ` ${freshnessLine}.` : ''}${replayDisabledReason ? ` ${replayDisabledReason}` : ''}${linkedDescription ? ` ${linkedDescription}` : ''}`
    : `${displayName}. ${groupTypeLabel}. ${cycleLabel}. Effective ${effectiveDuration} frames. ${statusLabel}${freshnessLine ? ` ${freshnessLine}.` : ''}${replayDisabledReason ? ` ${replayDisabledReason}` : ''}${linkedDescription ? ` ${linkedDescription}` : ''}`;

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
    railKind,
    overrideColor,
    freshnessLine,
    replayDisabledReason,
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
): PhysicsPaintGroupLifecycle {
  if (range.unresolved) return 'unresolved';
  if (clip?.provenanceState === 'detached') return 'detached';
  // The lifecycle reads the clip's own scriptId — never the resolved library
  // name — so a rail linked to an Action stays Synchronized/Modified even when
  // the script library isn't loaded (the active lane and the non-active rows
  // must agree; the library state is not a lifecycle signal).
  if (!clip?.scriptId) return 'unavailable';
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

/**
 * 52-03 (D-24): the reveal rail's Replay disabled reason, mirroring
 * `regenerateDisabledReasonFor`. Replay cannot run when the reference was
 * removed after creation (D-12) or the library script was deleted (D-13) —
 * both fail closed with existing baked keys untouched. The red unresolved
 * state stays EXCLUSIVELY for these fail-closed cases, never for a normal
 * pending state.
 */
function replayDisabledReasonFor(
  lifecycle: PhysicsPaintGroupLifecycle,
  referencePlaced: boolean | undefined,
  scriptExists: boolean | undefined,
): string | null {
  if (referencePlaced === false) return REVEAL_REPLAY_DISABLED_NO_REFERENCE;
  if (scriptExists === false) return REVEAL_REPLAY_DISABLED_SCRIPT_DELETED;
  switch (lifecycle) {
    case 'modified': return null;
    case 'synchronized': return null;
    case 'detached': return REVEAL_REPLAY_DISABLED_SCRIPT_DELETED;
    case 'unavailable': return REVEAL_REPLAY_DISABLED_SCRIPT_DELETED;
    case 'unresolved': return REVEAL_REPLAY_DISABLED_NO_REFERENCE;
  }
}

export function projectPhysicsPaintLoopClipGeometry(
  loop: PhysicPaintRotoLoopRange,
  visibleFrameWindow: { readonly startFrame: number; readonly endFrameExclusive: number },
  framePitch: number,
): PhysicsPaintLoopClipGeometry | null {
  if (
    loop.effectiveEnd <= visibleFrameWindow.startFrame
    || loop.placementStart >= visibleFrameWindow.endFrameExclusive
  ) return null;

  const clippedStart = Math.max(loop.placementStart, visibleFrameWindow.startFrame);
  const clippedEnd = Math.min(loop.effectiveEnd, visibleFrameWindow.endFrameExclusive);
  return {
    left: (clippedStart - visibleFrameWindow.startFrame) * framePitch,
    width: Math.max(framePitch, (clippedEnd - clippedStart) * framePitch),
  };
}

/**
 * 49-05 (S4): the Background clip rail presentation. Bg clips have no
 * scriptId, so `projectPhysicsPaintLoopClipPresentation` would report the
 * wrong 'Source Action unavailable' lifecycle — this projection reads ONLY the
 * resolver facts (`range.truncated`/`partialCycle`/`effectiveEnd`/`repeat`/
 * `cycleLength`) and never computes loop math (capsule-never-math, Pitfall
 * 10/m2). The badge always shows the REQUESTED duration; the shortened state
 * is a distinct visual + label (D-12).
 */
export interface PhysicsPaintBackgroundClipPresentation {
  readonly clipId: string;
  /** `Cycle {N}f × {R} = {T}f` / `Cycle {N}f × ∞` — the requested badge
   *  (tooltip + accessible name only, never the lane surface). */
  readonly cycleLabel: string;
  /** True when a next clip (or the capacity bound) shortens the loop (D-12). */
  readonly shortened: boolean;
  /** True when the effective end lands mid-cycle rather than on a cycle boundary (D-21). */
  readonly partialCycle: boolean;
  /** 'Loop shortened by next clip' when shortened, else null (English, D-14). */
  readonly shortenedLabel: string | null;
  /** 'next clip — interrupts the loop' when shortened, else null (D-14). */
  readonly interruptionTooltipLine: string | null;
  readonly tooltipLines: readonly string[];
  readonly accessibleName: string;
}

export function projectPhysicsPaintBackgroundClipPresentation(
  range: PhysicPaintRotoLoopRange,
): PhysicsPaintBackgroundClipPresentation {
  const cycleLabel = range.repeat === 'infinity'
    ? `Cycle ${range.cycleLength}f × ∞`
    : `Cycle ${range.cycleLength}f × ${range.repeat} = ${range.cycleLength * range.repeat}f`;
  const shortened = Boolean(range.truncated);
  const partialCycle = range.partialCycle;
  const shortenedLabel = shortened ? 'Loop shortened by next clip' : null;
  const interruptionTooltipLine = shortened ? 'next clip — interrupts the loop' : null;
  const tooltipLines = [
    `Background clip at F${range.phaseOrigin}`,
    cycleLabel,
    ...(shortenedLabel ? [shortenedLabel] : []),
    ...(interruptionTooltipLine ? [interruptionTooltipLine] : []),
  ];
  const accessibleName = `Background clip at frame ${range.phaseOrigin}. ${cycleLabel}.${shortenedLabel ? ` ${shortenedLabel}.` : ''}`;
  return {
    clipId: range.loopId,
    cycleLabel,
    shortened,
    partialCycle,
    shortenedLabel,
    interruptionTooltipLine,
    tooltipLines,
    accessibleName,
  };
}

