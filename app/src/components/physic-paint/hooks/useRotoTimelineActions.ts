import { useCallback, useMemo } from 'preact/hooks';
import { computed, signal, type ReadonlySignal } from '@preact/signals';
import type { PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings, RailSetDeleteMember } from '../../../types/physicPaint';
import { getSourceRotoFrameForDisplayFrame } from '../roto/physicsPaintRotoWorkflow';
import {
  updateRotoInterpolationSettingsTransaction,
  type RotoSourceDisplayModel,
} from '../roto/physicsPaintRotoKeyController';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
  buildPhysicPaintRotoPhysicalRevision,
  createPhysicPaintRotoKeyId,
  parsePhysicPaintRotoPhysicalDocument,
} from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import {
  createPhysicPaintRotoDuplicateKeyIntent,
  createPhysicPaintRotoPasteKeyGroupIntent,
  createPhysicPaintRotoPasteKeyIntent,
  derivePhysicPaintRotoLoopRanges,
  derivePhysicPaintPushSet,
  derivePhysicPaintRailSetMove,
  resolvePhysicPaintRotoGroupEffectiveEnd,
  resolvePhysicPaintRotoLoopFrame,
  resolvePhysicPaintRotoPhysicalEdit,
  type PhysicPaintRailSetMoveMember,
  type PhysicPaintRotoFrameResolution,
  type PhysicPaintRotoLinkedSourceSpacingScope,
  type PhysicPaintRotoPhysicalEditFailure,
  type PhysicPaintRotoPhysicalEditFailureCode,
  type PhysicPaintRotoPhysicalEditIntent,
  type PhysicPaintRotoPhysicalEditProposal,
  type PhysicPaintRotoPhysicalEditResolution,
  type PhysicPaintRotoPhysicalEditTarget,
} from '../roto/physicsPaintRotoPhysicalResolver';
import type { RotoSessionCopiedGroupEntry } from '../roto/physicsPaintRotoSession';
import { classifyPhysicPaintRotoGroupFrameTarget } from '../roto/physicsPaintRotoGroupLifecycle';
import { toEmptyKeyPayload } from './useRotoKeyUtilities';
import {
  getPhysicsPaintRotoSourceCycleId,
  type PhysicsPaintRotoSpacingSelection,
} from '../roto/physicsPaintRotoSpacingSelection';
import type {
  RotoPhysicalEditExecuteInput,
  RotoPhysicalKeyUtilityPort,
} from '../roto/rotoCoordinatorPorts';
import { deriveKeyRailSegments } from '../view/physicsPaintKeyRailPresentation';
import type { RailSetDragGapInterval } from './usePhysicsPaintRailSetDrag';
import type { RailSetIdentity } from '../roto/physicsPaintRotoRailSetSelection';
import {
  buildRotoRailSetCopyPayload,
  type RotoRailSetCopyPayload,
  type RotoRailSetCopyPlacementMode,
} from '../roto/physicsPaintRotoRailSetCopy';

/**
 * Stable physical timeline action bundle exposed by {@link useRotoTimelineActions}.
 *
 * Per D-01/D-05/D-06/D-09: one Preact-native bundle owns the semantic Insert
 * action (Delete follows in Task 2), direct pending/availability/status outputs,
 * and extension points for Plans 07-08 (Drag, Force Spacing). The resolver,
 * coordinator, and history remain private to this hook; Studio composes the
 * bundle once and passes it through to the workflow strip and keyboard
 * dispatcher.
 *
 * Availability is derived directly from current selected stable identity/
 * real-key status, launch readiness, and the coordinator's one pending
 * Signal/computed output — no copied hook state, no second busy mirror, no
 * effect-driven action synchronization.
 */
/**
 * Identity-based drag target for the single-key ripple Drag (D-07).
 *
 * Per D-23: empty and generated physical cells emit only `physical-cell`
 * whole-cell intents. Per D-07/D-21: occupied real-key cells emit only
 * `before-key` or `after-key` identity boundary intents. No view-side
 * destination frame calculation, no occupied-key overwrite.
 */
export type RotoDragTarget = PhysicPaintRotoPhysicalEditTarget;

export type RotoInsertTarget =
  | { readonly kind: 'occupied-real'; readonly keyId: string }
  | { readonly kind: 'genuinely-empty'; readonly appFrame: number }
  | { readonly kind: 'generated'; readonly appFrame: number }
  | { readonly kind: 'resolved-linked'; readonly appFrame: number }
  | { readonly kind: 'unresolved-linked'; readonly appFrame: number }
  | { readonly kind: 'occupied-empty-intent'; readonly appFrame: number }
  | { readonly kind: 'invalid-destination' }
  | { readonly kind: 'out-of-capacity'; readonly appFrame: number }
  | { readonly kind: 'edit-in-flight' };

export interface RotoInsertTargetClassificationInput {
  readonly launchReady: boolean;
  readonly pendingOperationId: string | null;
  readonly selectedKeyId: string | null;
  readonly currentAppFrame: number | null;
  readonly capacity: number | null;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly physicalCells: readonly RotoPhysicalTimelineCell[];
  readonly frameResolution: PhysicPaintRotoFrameResolution | null;
}

export function classifyRotoInsertTarget(
  input: RotoInsertTargetClassificationInput,
): RotoInsertTarget {
  if (input.pendingOperationId !== null) return { kind: 'edit-in-flight' };
  if (!input.launchReady || input.currentAppFrame === null || !Number.isInteger(input.currentAppFrame) || input.currentAppFrame < 0) {
    return { kind: 'invalid-destination' };
  }
  if (input.capacity === null || !Number.isInteger(input.capacity) || input.currentAppFrame >= input.capacity) {
    return { kind: 'out-of-capacity', appFrame: input.currentAppFrame };
  }
  if (isBoundedKeyId(input.selectedKeyId)) {
    const selectedMatches = input.records.filter((record) => record.keyId === input.selectedKeyId);
    if (selectedMatches.length === 1) return { kind: 'occupied-real', keyId: input.selectedKeyId };
  }
  if (input.records.some((record) => record.appFrame === input.currentAppFrame)) {
    return { kind: 'occupied-empty-intent', appFrame: input.currentAppFrame };
  }
  if (input.frameResolution?.kind === 'linked-unresolved') {
    return { kind: 'unresolved-linked', appFrame: input.currentAppFrame };
  }
  if (input.frameResolution !== null && (
    input.frameResolution.kind === 'linked'
    || input.frameResolution.kind === 'linked-generated'
    || input.frameResolution.kind === 'linked-gap'
  )) {
    return { kind: 'resolved-linked', appFrame: input.currentAppFrame };
  }
  if (input.physicalCells[input.currentAppFrame]?.kind === 'generated') {
    return { kind: 'generated', appFrame: input.currentAppFrame };
  }
  return { kind: 'genuinely-empty', appFrame: input.currentAppFrame };
}

export function mapRotoInsertProductReason(target: RotoInsertTarget): string | null {
  switch (target.kind) {
    case 'occupied-real':
    case 'genuinely-empty':
      return null;
    case 'generated':
      return 'Insert is unavailable on a generated render-only frame.';
    case 'resolved-linked':
      return 'Insert is unavailable on a resolved linked frame.';
    case 'unresolved-linked':
      return 'Insert is unavailable on an unresolved linked frame.';
    case 'occupied-empty-intent':
      return 'This frame already contains a real key.';
    case 'invalid-destination':
      return 'Choose a valid timeline frame before inserting.';
    case 'out-of-capacity':
      return 'This frame is outside the physical timeline capacity.';
    case 'edit-in-flight':
      return 'A Roto physical edit is already in flight.';
  }
}

export type RotoScissorTarget =
  | { readonly kind: 'ok'; readonly keyId: string; readonly appFrame: number }
  | { readonly kind: 'generated-ok'; readonly keyId: string; readonly appFrame: number }
  | { readonly kind: 'already-owns-break'; readonly keyId: string; readonly appFrame: number }
  | { readonly kind: 'generated'; readonly appFrame: number }
  | { readonly kind: 'empty'; readonly appFrame: number }
  | { readonly kind: 'group-or-linked'; readonly ownership: 'group' | 'linked'; readonly appFrame: number }
  | { readonly kind: 'edit-in-flight' }
  | { readonly kind: 'unavailable' };

export interface RotoScissorTargetClassificationInput {
  readonly launchReady: boolean;
  readonly pendingOperationId: string | null;
  readonly selectedKeyId: string | null;
  readonly selectedLoopClipIds: readonly string[];
  readonly currentAppFrame: number | null;
  readonly capacity: number | null;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly physicalCells: readonly RotoPhysicalTimelineCell[];
  readonly frameResolution: PhysicPaintRotoFrameResolution | null;
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}

export function classifyRotoScissorTarget(
  input: RotoScissorTargetClassificationInput,
): RotoScissorTarget {
  if (input.pendingOperationId !== null) return Object.freeze({ kind: 'edit-in-flight' });
  if (!input.launchReady
    || input.currentAppFrame === null
    || !Number.isSafeInteger(input.currentAppFrame)
    || input.currentAppFrame < 0
    || input.capacity === null
    || !Number.isSafeInteger(input.capacity)
    || input.currentAppFrame >= input.capacity) {
    return Object.freeze({ kind: 'unavailable' });
  }
  const appFrame = input.currentAppFrame;

  const groupOwnedKeyIds = new Set<string>();
  for (const loopClip of input.loopClips) {
    loopClip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
    (loopClip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
  }
  const breaks = new Set(input.incomingInterpolationBreakKeyIds);
  const classifyRecord = (record: PhysicPaintRotoRealKeyRecord): RotoScissorTarget => {
    if (groupOwnedKeyIds.has(record.keyId)) {
      return Object.freeze({ kind: 'group-or-linked', ownership: 'group', appFrame: record.appFrame });
    }
    if (breaks.has(record.keyId)) {
      return Object.freeze({ kind: 'already-owns-break', keyId: record.keyId, appFrame: record.appFrame });
    }
    return Object.freeze({ kind: 'ok', keyId: record.keyId, appFrame: record.appFrame });
  };

  if (isBoundedKeyId(input.selectedKeyId)) {
    const selectedMatches = input.records.filter((record) => record.keyId === input.selectedKeyId);
    if (selectedMatches.length === 1 && !groupOwnedKeyIds.has(selectedMatches[0].keyId)) {
      return classifyRecord(selectedMatches[0]);
    }
  }

  const cursorMatches = input.records.filter((record) => record.appFrame === appFrame);
  if (cursorMatches.length === 1) return classifyRecord(cursorMatches[0]);
  const generatedCell = input.physicalCells[appFrame];
  if (generatedCell?.kind === 'generated') {
    // quick 260820-0kg: a generated in-between is a split target only when it
    // is a genuine Key Rail in-between. Group/linked guards run AHEAD of
    // acceptance (RED 3): ownership of the following real key closes the frame
    // even when the cell also resolves through a linked lifecycle span.
    if (groupOwnedKeyIds.has(generatedCell.rightKeyId)) {
      return Object.freeze({ kind: 'group-or-linked', ownership: 'group', appFrame });
    }
    if (input.frameResolution !== null && (
      input.frameResolution.kind === 'linked'
      || input.frameResolution.kind === 'linked-generated'
      || input.frameResolution.kind === 'linked-gap'
      || input.frameResolution.kind === 'linked-unresolved'
    )) {
      return Object.freeze({ kind: 'group-or-linked', ownership: 'linked', appFrame });
    }
    if (breaks.has(generatedCell.rightKeyId)) {
      return Object.freeze({
        kind: 'already-owns-break',
        keyId: generatedCell.rightKeyId,
        appFrame,
      });
    }
    const segments = deriveKeyRailSegments({
      orderedRealKeys: [...input.records]
        .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId)),
      incomingInterpolationBreakKeyIds: new Set(input.incomingInterpolationBreakKeyIds),
      groupOwnedKeyIds,
    });
    const containingSegment = segments.find((segment) => (
      segment.keyIds.includes(generatedCell.rightKeyId)
      && segment.firstKeyFrame < appFrame
      && appFrame < segment.lastKeyFrame
    ));
    if (containingSegment !== undefined) {
      return Object.freeze({
        kind: 'generated-ok',
        keyId: generatedCell.rightKeyId,
        appFrame,
      });
    }
    return Object.freeze({ kind: 'generated', appFrame });
  }
  if (input.frameResolution !== null && (
    input.frameResolution.kind === 'linked'
    || input.frameResolution.kind === 'linked-generated'
    || input.frameResolution.kind === 'linked-gap'
    || input.frameResolution.kind === 'linked-unresolved'
  )) {
    return Object.freeze({ kind: 'group-or-linked', ownership: 'linked', appFrame });
  }
  return Object.freeze({ kind: 'empty', appFrame });
}

export function mapRotoScissorProductReason(target: RotoScissorTarget): string | null {
  switch (target.kind) {
    case 'ok':
    case 'generated-ok':
      return null;
    case 'already-owns-break':
      return 'This key already starts a Key Rail segment.';
    case 'generated':
      return 'Scissor is unavailable at the edge of a Key Rail segment.';
    case 'empty':
      return 'Scissor is unavailable on an empty frame. Select a real ordinary key.';
    case 'group-or-linked':
      return target.ownership === 'group'
        ? 'Scissor is unavailable on a Motion or Static Group frame.'
        : 'Scissor is unavailable on a linked Group frame.';
    case 'edit-in-flight':
      return 'A Roto physical edit is already in flight.';
    case 'unavailable':
      return 'Scissor is unavailable.';
  }
}

export type RotoScissorAcceptedTarget = Extract<
  RotoScissorTarget,
  { readonly kind: 'ok' } | { readonly kind: 'generated-ok' }
>;

/** Enabled Scissor tooltip: generated-frame targets use the split-at-point copy. */
export function mapRotoScissorTooltip(target: RotoScissorTarget): string {
  return target.kind === 'generated-ok'
    ? 'Split the Key Rail at this point.'
    : 'Split the Key Rail before this key.';
}

/** Accepted status copy: {N} is the cursor frame for a generated target, the real-key frame otherwise. */
export function mapRotoScissorAcceptedCopy(target: RotoScissorAcceptedTarget): string {
  return target.kind === 'generated-ok'
    ? `Split Key Rail at frame ${target.appFrame}.`
    : `Split Key Rail before frame ${target.appFrame}.`;
}

/**
 * Group-drag product-reason input (43.3-03 Task 2, D-06/D-07). One mapper owns
 * disabled preflight, rejection, and acceptance copy — the single copy owner
 * per the 43.1/43.2 precedent. Raw resolver diagnostics stay internal: the
 * zero-space failure code maps to the locked literal copy, and no raw resolver
 * text ever reaches the status line for the D-06 rejection (T-43.3-03-03).
 */
export type RotoGroupDragProductReasonInput =
  | { readonly kind: 'disabled'; readonly reason: string }
  | {
      readonly kind: 'rejected';
      readonly failureCode: PhysicPaintRotoPhysicalEditFailureCode;
      readonly failureText: string;
    }
  | {
      readonly kind: 'accepted';
      readonly mode: PhysicPaintRotoLoopClip['mode'];
      readonly destinationPlacementStart: number;
      /** The Group's original half-open interval when source-attached; null for duplicated placements (D-11). */
      readonly vacatedInterval: { readonly phaseOrigin: number; readonly effectiveEnd: number } | null;
    };

export function mapRotoGroupDragProductReason(input: RotoGroupDragProductReasonInput): string {
  switch (input.kind) {
    case 'disabled':
      return input.reason;
    case 'rejected':
      // D-06 locked copy: the plan-02 zero-space code maps to the literal
      // product reason; every other resolver failure keeps its existing
      // diagnostic text (preflight guards make those unreachable in practice).
      return input.failureCode === 'no-free-space-in-direction'
        ? 'No empty space in that direction.'
        : (input.failureText || 'The Group move is invalid.');
    case 'accepted': {
      const railType = input.mode === 'static' ? 'Static Rail' : 'Motion Rail';
      const moved = `Moved ${railType} to frame ${input.destinationPlacementStart}.`;
      if (input.vacatedInterval === null) return moved;
      // D-07: inclusive product range derived from the canonical half-open
      // vacated interval at presentation time only (43.2 presentation rule).
      const start = input.vacatedInterval.phaseOrigin;
      const end = input.vacatedInterval.effectiveEnd - 1;
      return `${moved} Gap left at frames ${start}–${end}.`;
    }
  }
}

export type RotoKeyRailDragProductReasonInput =
  | { readonly kind: 'disabled'; readonly reason: string }
  | {
      readonly kind: 'rejected';
      readonly failureCode: PhysicPaintRotoPhysicalEditFailureCode;
      readonly failureText: string;
    }
  | {
      readonly kind: 'accepted';
      readonly destinationFirstKeyAppFrame: number;
      readonly vacatedInterval: { readonly phaseOrigin: number; readonly effectiveEnd: number } | null;
    };

/**
 * Key Rail drag copy owner. Rejections reuse the existing Group-drag mapping so
 * the shared no-space sentence has one literal source; accepted copy retains
 * Key Rail terminology without changing the locked Group mapper arms.
 */
export function mapRotoKeyRailDragProductReason(input: RotoKeyRailDragProductReasonInput): string {
  if (input.kind === 'accepted') {
    const moved = `Moved Key Rail to frame ${input.destinationFirstKeyAppFrame}.`;
    if (input.vacatedInterval === null) return moved;
    return `${moved} Gap left at frames ${input.vacatedInterval.phaseOrigin}–${input.vacatedInterval.effectiveEnd - 1}.`;
  }
  if (input.kind === 'disabled') return input.reason;
  return mapRotoGroupDragProductReason(input);
}

/**
 * Push preparation descriptor: direction + exactly one anchor (keyId or loopId)
 * + nonnegative frame delta. The resolver owns set derivation, clamp, straddle,
 * and breaks; prepare validates well-formedness and freezes the publication.
 */
export type RotoPushIntentDescriptor = Readonly<{
  readonly direction: 'right' | 'left';
  readonly anchorKeyId?: string;
  readonly anchorLoopId?: string;
  readonly deltaFrames: number;
}>;

/**
 * Immutable versioned Push publication (43.5-03). Carries the exact resolver
 * proposal, the frozen intent, the break-aware proposalVersion (Pitfall 3), the
 * expected launch tuple, and the presentation facts the locked copy family
 * needs (D-15/D-17): moved Rail count, clamped signed delta, and the inclusive
 * product before/after ranges plus the opened-gap interval.
 *
 * The view retains this opaquely and submits it unchanged to
 * {@link RotoPhysicalTimelineActionBundle.commitRotoPush}. No cloning,
 * normalization, or recomputation is permitted.
 */
export interface RotoPushPublication {
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
  readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: 'push-rails' }>;
  readonly proposalVersion: string;
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  /** Number of Rails in the moved set — the shared set authority's count (D-17). */
  readonly movedRailCount: number;
  /** Signed clamped delta: positive for Push Right, negative for Push Left (D-14). */
  readonly clampedDeltaFrames: number;
  /** Inclusive product frame range of the moved set before the push (43.2 presentation rule). */
  readonly beforeRange: { readonly firstFrame: number; readonly lastFrame: number };
  /** Inclusive product frame range of the moved set after the push. */
  readonly afterRange: { readonly firstFrame: number; readonly lastFrame: number };
  /** Inclusive opened-gap interval, or null when no gap would open (D-15). */
  readonly gapInterval: { readonly firstFrame: number; readonly lastFrame: number } | null;
}

export type RotoPushPreparationResult =
  | { readonly ok: true; readonly publication: RotoPushPublication }
  | { readonly ok: false; readonly reason: string; readonly detail?: string };

export type RotoPushProductReasonInput =
  | { readonly kind: 'disabled'; readonly reason: string }
  | {
      readonly kind: 'rejected';
      readonly failureCode: PhysicPaintRotoPhysicalEditFailureCode;
      readonly failureText: string;
    }
  | {
      readonly kind: 'live';
      readonly direction: 'right' | 'left';
      /** Signed clamped delta: positive for Push Right, negative for Push Left. */
      readonly signedDeltaFrames: number;
      readonly beforeRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly afterRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly gapInterval: { readonly firstFrame: number; readonly lastFrame: number } | null;
    }
  | {
      readonly kind: 'accepted';
      readonly direction: 'right' | 'left';
      readonly movedRailCount: number;
      /** Signed clamped delta; the copy renders its absolute magnitude. */
      readonly signedDeltaFrames: number;
      readonly afterRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly gapInterval: { readonly firstFrame: number; readonly lastFrame: number } | null;
    };

/**
 * Single deterministic Push copy owner (D-15/D-16/D-17, UI-SPEC T6): live drag
 * readout, accepted status (singular/plural with the conditional gap sentence),
 * disabled pass-through, no-space delegated to the Group mapper so the sentence
 * has one literal source (43.4 precedent), the locked straddle sentence, and
 * the empty-anchor sentence. Raw resolver diagnostics never enter product copy —
 * the detail channel only (T-43.3-03-03 pattern).
 */
export function mapRotoPushProductReason(input: RotoPushProductReasonInput): string {
  switch (input.kind) {
    case 'disabled':
      return input.reason;
    case 'rejected':
      // D-16 locked copy: a moved attached Group sharing its source cycle with
      // a fixed-side Group fails closed with the verbatim straddle sentence.
      if (input.failureCode === 'push-source-straddle') {
        return 'Can\'t push: a Group in the moved set shares its source with a fixed Group.';
      }
      // D-07/D-17: a bounded anchor that resolves to no Rail means the pointer
      // landed on an empty/gap frame — the dedicated empty-anchor sentence.
      if (input.failureCode === 'unknown-operation-identity') {
        return 'Push is unavailable on an empty frame. Drag from a key or rail.';
      }
      // D-14: the zero-space code delegates to the Group mapper (one literal
      // no-space sentence across all rail kinds). Any other resolver failure
      // keeps its diagnostic text (preflight guards make those unreachable).
      return mapRotoGroupDragProductReason(input);
    case 'live': {
      const sign = input.direction === 'right' ? '+' : '−';
      const magnitude = Math.abs(input.signedDeltaFrames);
      const directionLabel = input.direction === 'right' ? 'Right' : 'Left';
      const readout = `Push ${directionLabel} ${sign}${magnitude} — frames `
        + `${input.beforeRange.firstFrame}–${input.beforeRange.lastFrame} → `
        + `${input.afterRange.firstFrame}–${input.afterRange.lastFrame}`;
      if (input.gapInterval === null) return readout;
      return `${readout}, gap ${input.gapInterval.firstFrame}–${input.gapInterval.lastFrame}`;
    }
    case 'accepted': {
      const railLabel = input.movedRailCount === 1 ? '1 Rail' : `${input.movedRailCount} Rails`;
      const directionLabel = input.direction === 'right' ? 'right' : 'left';
      const magnitude = Math.abs(input.signedDeltaFrames);
      const accepted = `Pushed ${railLabel} ${directionLabel} by ${magnitude} frames — moved set now frames `
        + `${input.afterRange.firstFrame}–${input.afterRange.lastFrame}.`;
      if (input.gapInterval === null) return accepted;
      return `${accepted} Gap opened at frames ${input.gapInterval.firstFrame}–${input.gapInterval.lastFrame}.`;
    }
  }
}

/**
 * Batch Move preparation descriptor (43.6-03): the explicit set members in
 * Plan 01 canonical order plus a signed integer delta (positive moves right,
 * negative moves left). The resolver owns membership validation, the clamp,
 * the straddle verdict, and break travel; prepare validates well-formedness
 * and freezes the publication.
 */
export type RotoRailSetMoveIntentDescriptor = Readonly<{
  readonly members: readonly PhysicPaintRailSetMoveMember[];
  /** Signed integer delta: positive moves right, negative moves left. */
  readonly delta: number;
}>;

/**
 * Immutable versioned batch Move publication (43.6-03). Carries the exact
 * resolver proposal, the frozen intent, the break-aware proposalVersion
 * (Pitfall 3), the expected launch tuple, and the presentation facts the
 * locked copy family needs (D-15/D-17): moved Rail count, clamped signed
 * delta, the inclusive product before/after ranges, and the would-open gap
 * intervals. The gap intervals are half-open `{start, end}` — the exact
 * structural shape the drag hook's {@link RailSetDragPublication} requires —
 * and the mapper converts them to inclusive product ranges at presentation
 * time (43.2 presentation rule).
 *
 * The view retains this opaquely and submits it unchanged to
 * {@link RotoPhysicalTimelineActionBundle.commitRailSetMove}. No cloning,
 * normalization, or recomputation is permitted.
 */
export interface RotoRailSetMovePublication {
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
  readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: 'move-rails' }>;
  readonly proposalVersion: string;
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  /** Number of Rails in the explicit set — the shared set authority's count (D-17). */
  readonly movedRailCount: number;
  /** Signed clamped delta: positive moves right, negative moves left (D-17). */
  readonly clampedDeltaFrames: number;
  /** Inclusive product frame range of the set before the move (43.2 presentation rule). */
  readonly beforeRange: { readonly firstFrame: number; readonly lastFrame: number };
  /** Inclusive product frame range of the set after the move. */
  readonly afterRange: { readonly firstFrame: number; readonly lastFrame: number };
  /** Half-open would-open vacated intervals; empty when no gap would open (D-09/D-11). */
  readonly gapIntervals: readonly RailSetDragGapInterval[];
}

export type RotoRailSetMovePreparationResult =
  | { readonly ok: true; readonly publication: RotoRailSetMovePublication }
  | { readonly ok: false; readonly reason: string; readonly detail?: string };

export type RotoRailSetMoveProductReasonInput =
  | { readonly kind: 'disabled'; readonly reason: string }
  | {
      readonly kind: 'rejected';
      readonly failureCode: PhysicPaintRotoPhysicalEditFailureCode;
      readonly failureText: string;
    }
  | {
      readonly kind: 'live';
      /** Signed clamped delta: positive moves right, negative moves left. */
      readonly signedDeltaFrames: number;
      readonly beforeRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly afterRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly gapIntervals: readonly RailSetDragGapInterval[];
    }
  | {
      readonly kind: 'accepted';
      readonly movedRailCount: number;
      /** Signed clamped delta; the copy renders its absolute magnitude. */
      readonly signedDeltaFrames: number;
      readonly afterRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly gapIntervals: readonly RailSetDragGapInterval[];
    };

/**
 * Single deterministic batch Move copy owner (D-09/D-10/D-12, UI-SPEC M3/M6):
 * live drag readout (U+2212 MINUS SIGN for leftward), accepted status
 * (singular/plural with the conditional gap sentence), disabled pass-through,
 * no-space delegated to the Group mapper so the sentence has one literal
 * source (43.4 precedent), and the locked straddle sentence verbatim. Raw
 * resolver diagnostics never enter product copy — the detail channel only
 * (T-43.3-03-03 pattern). Gap intervals are half-open and converted to
 * inclusive product ranges here, at presentation time only.
 */
export function mapRotoRailSetMoveProductReason(input: RotoRailSetMoveProductReasonInput): string {
  switch (input.kind) {
    case 'disabled':
      return input.reason;
    case 'rejected':
      // D-10 locked copy: a source-attached selected Group sharing its source
      // cycle with an UNSELECTED Group fails closed with the verbatim
      // Group-domain sentence.
      if (input.failureCode === 'move-rails-source-straddle') {
        return 'Can\'t move the selected Rails: a selected Group shares its source with an unselected Group.';
      }
      // D-07/D-17: the zero-space code delegates to the Group mapper (one
      // literal no-space sentence across all rail kinds). Any other resolver
      // failure keeps its diagnostic text (preflight guards make those
      // unreachable).
      return mapRotoGroupDragProductReason(input);
    case 'live': {
      const sign = input.signedDeltaFrames >= 0 ? '+' : '−';
      const magnitude = Math.abs(input.signedDeltaFrames);
      const readout = `Move Rails ${sign}${magnitude} — set frames `
        + `${input.beforeRange.firstFrame}–${input.beforeRange.lastFrame} → `
        + `${input.afterRange.firstFrame}–${input.afterRange.lastFrame}`;
      if (input.gapIntervals.length === 0) return readout;
      const gap = input.gapIntervals.map((interval) => `${interval.start}–${interval.end - 1}`).join(', ');
      return `${readout}, gap ${gap}`;
    }
    case 'accepted': {
      const railLabel = input.movedRailCount === 1 ? '1 Rail' : `${input.movedRailCount} Rails`;
      const magnitude = Math.abs(input.signedDeltaFrames);
      const accepted = `Moved ${railLabel} by ${magnitude} frames — set now frames `
        + `${input.afterRange.firstFrame}–${input.afterRange.lastFrame}.`;
      if (input.gapIntervals.length === 0) return accepted;
      const gap = input.gapIntervals.map((interval) => `${interval.start}–${interval.end - 1}`).join(', ');
      return `${accepted} Gap left at frames ${gap}.`;
    }
  }
}

export interface RotoGroupLifecycleDeleteTarget {
  readonly groupId: string;
  readonly appFrame: number;
  readonly mode: PhysicPaintRotoLoopClip['mode'];
  readonly phaseOrigin: number;
  readonly onlyOccurrence: boolean;
}

export interface RotoKeyRailSelection {
  readonly firstKeyId: string;
  readonly keyIds: readonly string[];
}

export type RotoDeleteTarget =
  | Readonly<{ kind: 'ordinary-key'; keyId: string }>
  | Readonly<{ kind: 'ordinary-key-group'; keyIds: readonly string[] }>
  | Readonly<{
    kind: 'key-rail';
    firstKeyId: string;
    keyIds: readonly string[];
    firstKeyFrame: number;
    lastKeyFrame: number;
  }>
  | Readonly<{ kind: 'stale-key-rail' }>
  | Readonly<{
    kind: 'rail-set';
    members: readonly RailSetDeleteMember[];
    firstFrame: number;
    lastFrame: number;
  }>
  | Readonly<RotoGroupLifecycleDeleteTarget & { kind: 'group-frame' }>
  | Readonly<RotoGroupLifecycleDeleteTarget & { kind: 'group' }>
  | Readonly<{ kind: 'group-gap'; groupId: string; appFrame: number }>
  | Readonly<{ kind: 'unresolved-group'; groupId: string; appFrame: number }>
  | Readonly<{ kind: 'ambiguous-group'; appFrame: number }>
  | Readonly<{ kind: 'generated'; appFrame: number }>
  | Readonly<{ kind: 'no-target' }>
  | Readonly<{ kind: 'edit-in-flight' }>
  | Readonly<{ kind: 'unavailable' }>;

export interface RotoDeleteTargetClassificationInput {
  readonly launchReady: boolean;
  readonly pendingOperationId: string | null;
  readonly selectedKeyId: string | null;
  readonly selectedKeyIds: readonly string[];
  readonly selectedKeyRail?: RotoKeyRailSelection | null;
  readonly selectedLoopClipIds: readonly string[];
  /** Session rail-set identities (Plan 01 authority); the set branch runs FIRST. */
  readonly railSetMembers?: readonly RailSetIdentity[];
  readonly currentAppFrame: number | null;
  readonly capacity: number | null;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly incomingInterpolationBreakKeyIds?: readonly string[];
  readonly physicalCells: readonly RotoPhysicalTimelineCell[];
}

/**
 * One activation-time Delete authority shared by keyboard and visible actions.
 * Group ownership is classified from the complete accepted records/Group facts;
 * components only render the resulting choice and never infer ownership.
 */
export function classifyRotoDeleteTarget(
  input: RotoDeleteTargetClassificationInput,
): RotoDeleteTarget {
  if (input.pendingOperationId !== null) return Object.freeze({ kind: 'edit-in-flight' });
  if (!input.launchReady
    || input.currentAppFrame === null
    || !Number.isSafeInteger(input.currentAppFrame)
    || input.currentAppFrame < 0
    || input.capacity === null
    || !Number.isSafeInteger(input.capacity)
    || input.currentAppFrame >= input.capacity) {
    return Object.freeze({ kind: 'unavailable' });
  }

  // 43.6-04 D-21/D-22: the rail-set branch runs FIRST, before the loop/key-rail
  // branches it supersedes. An active non-empty set classifies as 'rail-set'
  // with every member validated against the current derivation (segments +
  // loopClips); a stale set fails closed on the existing stale mapping — never
  // delete on stale authority (T-43.6-02).
  if (input.railSetMembers !== undefined && input.railSetMembers.length > 0) {
    const derived = deriveRailSetDeleteMembers(input);
    if (derived === null) return Object.freeze({ kind: 'stale-key-rail' });
    return Object.freeze({
      kind: 'rail-set',
      members: derived.members,
      firstFrame: derived.firstFrame,
      lastFrame: derived.lastFrame,
    });
  }

  if (input.selectedLoopClipIds.length > 0) {
    if (input.selectedLoopClipIds.length !== 1 || !isBoundedKeyId(input.selectedLoopClipIds[0])) {
      return Object.freeze({ kind: 'no-target' });
    }
    const groupId = input.selectedLoopClipIds[0];
    const group = input.loopClips.find((candidate) => candidate.loopId === groupId);
    if (group?.phaseOrigin === undefined || group.visibleRanges === undefined) {
      return Object.freeze({ kind: 'no-target' });
    }
    const visibleCount = group.visibleRanges.reduce(
      (count, range) => count + range.endExclusive - range.start,
      0,
    );
    return Object.freeze({
      kind: 'group',
      groupId,
      appFrame: group.phaseOrigin,
      mode: group.mode,
      phaseOrigin: group.phaseOrigin,
      onlyOccurrence: visibleCount === 1,
    });
  }

  if (input.selectedKeyId === null && input.selectedKeyRail !== null && input.selectedKeyRail !== undefined) {
    const selection = input.selectedKeyRail;
    const selectionIsWellFormed = isBoundedKeyId(selection.firstKeyId)
      && selection.keyIds.length > 0
      && selection.keyIds[0] === selection.firstKeyId
      && selection.keyIds.every(isBoundedKeyId)
      && new Set(selection.keyIds).size === selection.keyIds.length;
    if (!selectionIsWellFormed) return Object.freeze({ kind: 'stale-key-rail' });

    const groupOwnedKeyIds = new Set<string>();
    for (const loopClip of input.loopClips) {
      loopClip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
      (loopClip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
    }
    const segments = deriveKeyRailSegments({
      orderedRealKeys: [...input.records]
        .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId))
        .map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
      incomingInterpolationBreakKeyIds: new Set(input.incomingInterpolationBreakKeyIds ?? []),
      groupOwnedKeyIds,
    });
    const matches = segments.filter((segment) => segment.firstKeyId === selection.firstKeyId
      && sameOrderedIds(segment.keyIds, selection.keyIds));
    if (matches.length !== 1) return Object.freeze({ kind: 'stale-key-rail' });
    const segment = matches[0];
    return Object.freeze({
      kind: 'key-rail',
      firstKeyId: segment.firstKeyId,
      keyIds: segment.keyIds,
      firstKeyFrame: segment.firstKeyFrame,
      lastKeyFrame: segment.lastKeyFrame,
    });
  }

  if (input.selectedKeyIds.length >= 2) {
    const uniqueIds = new Set(input.selectedKeyIds);
    const recordsById = new Map(input.records.map((record) => [record.keyId, record]));
    if (uniqueIds.size === input.selectedKeyIds.length
      && input.selectedKeyIds.every((keyId) => isBoundedKeyId(keyId) && recordsById.has(keyId))) {
      return Object.freeze({
        kind: 'ordinary-key-group',
        keyIds: Object.freeze([...input.selectedKeyIds]),
      });
    }
    return Object.freeze({ kind: 'no-target' });
  }

  const frameTarget = classifyPhysicPaintRotoGroupFrameTarget({
    appFrame: input.currentAppFrame,
    document: {
      realKeyRecords: input.records,
      interpolation: input.interpolation,
      scriptMotion: PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
      capacity: input.capacity,
      background: null,
      selectedKeyId: input.selectedKeyId,
      cursorAppFrame: input.currentAppFrame,
      revision: '',
      loopClips: input.loopClips,
      incomingInterpolationBreakKeyIds: [],
    },
  });
  switch (frameTarget.kind) {
    case 'source-occurrence':
    case 'generated-occurrence':
    case 'override': {
      const group = input.loopClips.find((candidate) => candidate.loopId === frameTarget.groupId);
      if (group?.phaseOrigin === undefined || group.visibleRanges === undefined) {
        return Object.freeze({ kind: 'unresolved-group', groupId: frameTarget.groupId, appFrame: input.currentAppFrame });
      }
      const visibleCount = group.visibleRanges.reduce(
        (count, range) => count + range.endExclusive - range.start,
        0,
      );
      return Object.freeze({
        kind: 'group-frame',
        groupId: frameTarget.groupId,
        appFrame: input.currentAppFrame,
        mode: group.mode,
        phaseOrigin: group.phaseOrigin,
        onlyOccurrence: visibleCount === 1,
      });
    }
    case 'group-gap':
      return Object.freeze({ kind: 'group-gap', groupId: frameTarget.groupId, appFrame: input.currentAppFrame });
    case 'unresolved-group':
      return Object.freeze({ kind: 'unresolved-group', groupId: frameTarget.groupId, appFrame: input.currentAppFrame });
    case 'ambiguous-group':
      return Object.freeze({ kind: 'ambiguous-group', appFrame: input.currentAppFrame });
    case 'ordinary-key':
    case 'empty':
      break;
  }

  if (isBoundedKeyId(input.selectedKeyId)
    && input.records.filter((record) => record.keyId === input.selectedKeyId).length === 1) {
    return Object.freeze({ kind: 'ordinary-key', keyId: input.selectedKeyId });
  }
  if (input.physicalCells[input.currentAppFrame]?.kind === 'generated') {
    return Object.freeze({ kind: 'generated', appFrame: input.currentAppFrame });
  }
  return Object.freeze({ kind: 'no-target' });
}

/**
 * 43.6-04 D-21: validate every session rail-set identity against the current
 * accepted derivation and produce the exact delete members. A key-rail member
 * must match exactly one derived segment (firstKeyId + ordered keyIds); a loop
 * member must resolve to a valid Group (phaseOrigin + visibleRanges). Any
 * mismatch makes the WHOLE set stale — fail closed, never delete on stale
 * authority. The inclusive product range {A}-{B} derives from canonical
 * half-open intervals only at presentation time (UI-SPEC M4).
 */
function deriveRailSetDeleteMembers(input: RotoDeleteTargetClassificationInput): Readonly<{
  readonly members: readonly RailSetDeleteMember[];
  readonly firstFrame: number;
  readonly lastFrame: number;
}> | null {
  const groupOwnedKeyIds = new Set<string>();
  for (const loopClip of input.loopClips) {
    loopClip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
    (loopClip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
  }
  const segments = deriveKeyRailSegments({
    orderedRealKeys: [...input.records]
      .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId))
      .map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
    incomingInterpolationBreakKeyIds: new Set(input.incomingInterpolationBreakKeyIds ?? []),
    groupOwnedKeyIds,
  });
  const members: RailSetDeleteMember[] = [];
  let firstFrame = Number.POSITIVE_INFINITY;
  let lastEndExclusive = Number.NEGATIVE_INFINITY;
  for (const identity of input.railSetMembers ?? []) {
    if (identity.kind === 'loop') {
      const group = input.loopClips.find((candidate) => candidate.loopId === identity.loopId);
      if (group?.phaseOrigin === undefined || group.visibleRanges === undefined) return null;
      members.push({ kind: 'loop', loopId: identity.loopId });
      firstFrame = Math.min(firstFrame, group.phaseOrigin);
      lastEndExclusive = Math.max(lastEndExclusive, ...group.visibleRanges.map((range) => range.endExclusive));
    } else {
      const matches = segments.filter((segment) => segment.firstKeyId === identity.firstKeyId);
      if (matches.length !== 1) return null;
      const segment = matches[0];
      members.push({ kind: 'key-rail', firstKeyId: segment.firstKeyId, keyIds: segment.keyIds });
      firstFrame = Math.min(firstFrame, segment.firstKeyFrame);
      lastEndExclusive = Math.max(lastEndExclusive, segment.lastKeyFrame + 1);
    }
  }
  return Object.freeze({
    members: Object.freeze(members),
    firstFrame,
    lastFrame: lastEndExclusive - 1,
  });
}

export function buildRotoDeleteScopeLabel(
  target: RotoDeleteTarget,
  groupDisplayName: string | null = null,
): string {
  if (target.kind === 'rail-set') {
    return target.members.length === 1 ? 'Delete 1 Rail' : `Delete ${target.members.length} Rails`;
  }
  if (target.kind === 'key-rail') {
    return target.keyIds.length === 1
      ? `Delete Key Rail — frame ${target.firstKeyFrame}, 1 key.`
      : `Delete Key Rail — frames ${target.firstKeyFrame}–${target.lastKeyFrame}, ${target.keyIds.length} keys.`;
  }
  if (target.kind === 'group') {
    const railType = target.mode === 'static' ? 'Static' : 'Motion';
    const displayName = groupDisplayName?.trim() || `${railType} Rail at F${target.phaseOrigin}`;
    return `Delete ${railType} Rail — ${displayName}`;
  }
  return 'Delete Frame';
}

export function buildDeleteKeyRailSuccessMessage(
  target: Extract<RotoDeleteTarget, { kind: 'key-rail' }>,
): string {
  return target.keyIds.length === 1
    ? `Deleted Key Rail — frame ${target.firstKeyFrame}, 1 key. The interval stays an intentional gap.`
    : `Deleted Key Rail — frames ${target.firstKeyFrame}–${target.lastKeyFrame}, ${target.keyIds.length} keys. The interval stays an intentional gap.`;
}

/** The locked M4 accepted Delete Rails copy (43.6-04). */
export function buildDeleteRailSetSuccessMessage(
  target: Extract<RotoDeleteTarget, { kind: 'rail-set' }>,
): string {
  const range = `frames ${target.firstFrame}-${target.lastFrame}`;
  return target.members.length === 1
    ? `Deleted 1 Rail - ${range}. The interval stays an intentional gap.`
    : `Deleted ${target.members.length} Rails - ${range}. The intervals stay intentional gaps.`;
}

export function mapRotoDeleteProductReason(target: RotoDeleteTarget): string | null {
  switch (target.kind) {
    case 'ordinary-key':
    case 'ordinary-key-group':
    case 'key-rail':
    case 'rail-set':
    case 'group-frame':
    case 'group':
      return null;
    case 'group-gap':
      return 'Delete is unavailable on an intentional Group gap.';
    case 'unresolved-group':
      return 'Delete is unavailable because this Group frame cannot be resolved.';
    case 'ambiguous-group':
      return 'Delete is unavailable because more than one Group owns this frame.';
    case 'generated':
      return 'Delete is unavailable on a generated render-only frame.';
    case 'stale-key-rail':
      return 'The selected Key Rail is no longer available.';
    case 'no-target':
      return 'Select a real Roto key or Group frame to delete.';
    case 'edit-in-flight':
      return 'A Roto physical edit is already in flight.';
    case 'unavailable':
      return 'Select a Physics Paint Roto timeline before deleting.';
  }
}

/**
 * 43.6 D-27 set-copy mapper family: ONE deterministic mapper owns ALL set copy
 * (capsule, tooltips, accessibility names) with locked UI-SPEC M6 wording.
 * No per-component string assembly anywhere.
 */

/** One ordered set member descriptor for the copy mapper (canonical order). */
export interface RailSetCopyMember {
  readonly kind: 'loop' | 'key-rail';
  /** Canonical first frame of the member's visible interval. */
  readonly firstFrame: number;
  /** Half-open effective end of the member's visible interval. */
  readonly effectiveEndExclusive: number;
  /** Loop members carry their rail type; key-rail members are always 'Key'. */
  readonly mode?: 'progressive' | 'static';
}

type RailSetCopyType = 'Motion' | 'Static' | 'Key';

function railSetCopyType(member: RailSetCopyMember): RailSetCopyType {
  if (member.kind === 'key-rail') return 'Key';
  return member.mode === 'static' ? 'Static' : 'Motion';
}

/**
 * The locked M6 set copy. {A}–{B} is the inclusive product frame range derived
 * from canonical half-open intervals only at presentation time (A = first
 * member first frame; B = last member effective end minus 1). Homogeneous sets
 * are type-named; mixed sets carry the type breakdown in canonical first-frame
 * order; a set of one omits the breakdown; the empty set produces no copy.
 */
export function buildRailSetCopy(members: readonly RailSetCopyMember[]): string | null {
  if (members.length === 0) return null;
  const ordered = [...members].sort((left, right) => left.firstFrame - right.firstFrame);
  const firstFrame = ordered[0].firstFrame;
  const lastFrame = Math.max(...ordered.map((member) => member.effectiveEndExclusive)) - 1;
  const range = `frames ${firstFrame}–${lastFrame}`;
  if (ordered.length === 1) {
    return `1 Rail selected — ${range}.`;
  }
  const counts: { type: RailSetCopyType; count: number }[] = [];
  for (const member of ordered) {
    const type = railSetCopyType(member);
    const existing = counts.find((entry) => entry.type === type);
    if (existing) existing.count += 1;
    else counts.push({ type, count: 1 });
  }
  if (counts.length === 1) {
    const { type, count } = counts[0];
    return `${count} ${type} Rails selected — ${range}.`;
  }
  const breakdown = counts.map(({ type, count }) => `${count} ${type}`).join(', ');
  return `${ordered.length} Rails selected — ${range} (${breakdown}).`;
}

/**
 * The locked M6 armed-solo capsule line (43.6-06, D-20/D-27): 'Solo - {N}
 * Rails, frames {A}-{B}.' (singular 'Solo - 1 Rail, ...'). Same canonical
 * half-open interval range derivation as the set copy (A = first member first
 * frame; B = last member effective end minus 1); the empty set produces no
 * line. ASCII hyphens per the plan acceptance criteria (43.6-04 precedent).
 */
export function buildRailSetSoloCopy(members: readonly RailSetCopyMember[]): string | null {
  if (members.length === 0) return null;
  const ordered = [...members].sort((left, right) => left.firstFrame - right.firstFrame);
  const firstFrame = ordered[0].firstFrame;
  const lastFrame = Math.max(...ordered.map((member) => member.effectiveEndExclusive)) - 1;
  const railWord = ordered.length === 1 ? 'Rail' : 'Rails';
  return `Solo - ${ordered.length} ${railWord}, frames ${firstFrame}-${lastFrame}.`;
}

/**
 * The M1 rail-tooltip set sentence appended to a member's existing Selected
 * form. The anchor member carries the ' Range anchor.' prefix; the empty set
 * produces no sentence. Leading space matches the "existing Selected form,
 * then:" append contract (UI-SPEC M1).
 */
export function buildRailSetTooltipSentence(
  setSize: number,
  isAnchor: boolean,
): string | null {
  if (!Number.isInteger(setSize) || setSize <= 0) return null;
  const memberSentence = `One of ${setSize} selected Rails — drag moves the set, Delete removes the set.`;
  return isAnchor ? ` Range anchor. ${memberSentence}` : ` ${memberSentence}`;
}

/**
 * Deterministic signature of a Drag target, captured at preparation time and
 * re-checked at pointer-up so a different release target cannot commit an
 * unseen proposal (D-09).
 */
export interface RotoDragTargetSignature {
  readonly kind: 'physical-cell' | 'before-key' | 'after-key';
  readonly appFrame: number | null;
  readonly targetKeyId: string | null;
}

/**
 * Immutable versioned Drag publication (D-09/D-22). Carries the exact resolver
 * proposal, the authoritative proposalVersion derived from the physical
 * content revision plus launch/layer context at preparation time, the expected
 * launch tuple, the moved identity, and the deterministic target signature.
 *
 * The view retains this opaquely and submits it unchanged to
 * {@link RotoPhysicalTimelineActionBundle.commitRotoKeyDrag}. No cloning,
 * normalization, or recomputation is permitted.
 */
export interface RotoDragPublication {
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
  readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: 'move-key' | 'move-key-group' }>;
  readonly proposalVersion: string;
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly movedKeyId: string;
  /**
   * Complete moved identity set (D-06/D-09). Present and frozen on group
   * publications; absent on single-key publications so existing consumers are
   * untouched.
   */
  readonly movedKeyIds?: readonly string[];
  readonly targetSignature: RotoDragTargetSignature;
}

/**
 * Preparation result. The failure branch carries no proposal; the success
 * branch carries one immutable publication. Group preparation failures also
 * carry the structured conflict frames (37-04 blocked-target preview) and the
 * full resolver failure text for release-time diagnostic routing (D-26).
 */
export type RotoDragPreparationResult =
  | { readonly ok: true; readonly publication: RotoDragPublication }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly conflictingAppFrames?: readonly number[];
      readonly detail?: string;
    };

/**
 * Immutable versioned Group-drag publication (GDRAG-07). Carries the exact
 * resolver proposal, the break-aware proposalVersion derived from the physical
 * content revision plus the incoming interpolation break collection and
 * launch/layer context at preparation time, the expected launch tuple, and the
 * moved Group identity.
 *
 * The view retains this opaquely and submits it unchanged to
 * {@link RotoPhysicalTimelineActionBundle.commitRotoGroupDrag}. No cloning,
 * normalization, or recomputation is permitted.
 */
export interface RotoGroupDragPublication {
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
  readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: 'move-group' }>;
  readonly proposalVersion: string;
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly loopId: string;
  /**
   * The accepted destination placementStart — the moved clip's new
   * placementStart in both the source-attached and duplicated arms (D-07 {N}).
   */
  readonly clampedDestinationPlacementStart: number;
  /**
   * The Group's original half-open interval when source-attached (the vacated
   * gap, D-07 {A}–{B}); null for duplicated shared-source placements whose
   * keys never move (D-11).
   */
  readonly vacatedInterval: { readonly phaseOrigin: number; readonly effectiveEnd: number } | null;
}

/**
 * Group-drag preparation result. The failure branch carries no proposal; the
 * success branch carries one immutable publication.
 */
export type RotoGroupDragPreparationResult =
  | { readonly ok: true; readonly publication: RotoGroupDragPublication }
  | { readonly ok: false; readonly reason: string; readonly detail?: string };

/**
 * Immutable Key Rail drag publication. The ordered member identities, resolver
 * proposal, intent, launch tuple, and break-aware proposal version are captured
 * once during prepare and forwarded unchanged during commit.
 */
export interface RotoKeyRailDragPublication {
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
  readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: 'move-key-rail' }>;
  readonly proposalVersion: string;
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly firstKeyId: string;
  readonly memberKeyIds: readonly string[];
  readonly destinationFirstKeyAppFrame: number;
  readonly vacatedInterval: { readonly phaseOrigin: number; readonly effectiveEnd: number } | null;
}

export type RotoKeyRailDragPreparationResult =
  | { readonly ok: true; readonly publication: RotoKeyRailDragPublication }
  | { readonly ok: false; readonly reason: string; readonly detail?: string };

export interface RotoPhysicalTimelineActionBundle {
  /** Insert one empty physical slot before the selected real key (D-05). */
  readonly insertRotoFrame: () => Promise<boolean>;
  /** Reactive Insert availability derived from selection + pending authority. */
  readonly canInsertFrame: ReadonlySignal<boolean>;
  /** Reactive Insert disabled reason, or null when eligible. */
  readonly insertDisabledReason: ReadonlySignal<string | null>;
  /** Contextual enabled Insert description; occupied behavior remains unchanged. */
  readonly insertTooltipDescription: ReadonlySignal<string>;
  /** Delete exactly the selected stable key and its slot (D-06). */
  readonly deleteRotoFrame: () => Promise<boolean>;
  /** Reactive Delete availability derived from selection + pending authority. */
  readonly canDeleteFrame: ReadonlySignal<boolean>;
  /** Reactive Delete disabled reason, or null when eligible. */
  readonly deleteDisabledReason: ReadonlySignal<string | null>;
  /** Live selection-owned Delete accessible name and tooltip heading. */
  readonly deleteScopeLabel: ReadonlySignal<string>;
  /** Split the current ordinary Key Rail immediately before its target key. */
  readonly scissorKeyRail: () => Promise<boolean>;
  /** Reactive Scissor availability derived from the current accepted target snapshot. */
  readonly canScissor: ReadonlySignal<boolean>;
  /** Reactive Scissor disabled reason, or null when eligible. */
  readonly scissorDisabledReason: ReadonlySignal<string | null>;
  /** Contextual enabled Scissor tooltip; generated-frame targets use the split-at-point copy. */
  readonly scissorTooltipDescription: ReadonlySignal<string>;
  /** Reactive pending physical operation id, or null when idle. */
  readonly pendingOperationId: ReadonlySignal<string | null>;
  /**
   * Prepare one versioned Drag publication for the single-key ripple Drag
   * (D-07/D-09/D-22). Reads one coherent current physical snapshot, invokes
   * the pure resolver with a `move-key` intent plus the supplied target,
   * rejects failure/self-target/no-change/stale/malformed results, and
   * returns one immutable publication carrying the exact proposal plus
   * authoritative proposalVersion/expected launch tuple. The view retains
   * the publication opaquely and submits it unchanged to
   * {@link commitRotoKeyDrag}.
   */
  readonly prepareRotoKeyDrag: (movedKeyId: string, target: RotoDragTarget) => RotoDragPreparationResult;
  /**
   * Submit the exact retained Drag publication to the acknowledged physical
   * coordinator (D-09). Verifies wrapper coherence and passes the same
   * proposal object plus captured expected launch tuple to
   * `executePhysicalEdit` without resolver or mapping recomputation. The
   * coordinator performs the authoritative post-barrier revalidation.
   */
  readonly commitRotoKeyDrag: (publication: RotoDragPublication) => Promise<boolean>;
  /**
   * Prepare one versioned Drag publication for the group Drag (D-06..D-09).
   * Mirrors the single-key preparation guard order exactly, reads the
   * controller-supplied selection set through the `getSelectedKeyIds` input
   * port (fail-closed: at least two bounded unique members containing the
   * grabbed key), invokes the pure resolver with a `move-key-group` intent,
   * and returns one immutable publication carrying the exact proposal, the
   * frozen moved set, and the authoritative proposalVersion/expected launch
   * tuple. Failure results carry the concise UI-SPEC copy, the structured
   * `conflictingAppFrames`, and the full resolver failure text as `detail`;
   * prepare never publishes to the capsule during the gesture (release-time
   * publication is 37-04's gesture-timing responsibility). The view retains
   * the publication opaquely and submits it unchanged to
   * {@link commitRotoKeyGroupDrag}.
   */
  readonly prepareRotoKeyGroupDrag: (grabbedKeyId: string, target: RotoDragTarget) => RotoDragPreparationResult;
  /**
   * Submit the exact retained group Drag publication to the acknowledged
   * physical coordinator (D-09). Verifies wrapper coherence (operation kind,
   * grabbed-key match, moved-set shallow equality, non-empty launch tuple)
   * and passes the same proposal object plus captured expected launch tuple
   * to `executePhysicalEdit` without resolver or mapping recomputation. The
   * coordinator performs the authoritative post-barrier revalidation.
   */
  readonly commitRotoKeyGroupDrag: (publication: RotoDragPublication) => Promise<boolean>;
  /**
   * Prepare one versioned Group-drag publication for the rail drag (GDRAG-07).
   * Mirrors the single-key/group guard order exactly, reads one coherent
   * current physical snapshot, builds the 'move-group' intent, invokes the
   * pure resolver with the incoming interpolation break collection threaded
   * into BOTH the resolver input and a break-aware revision fingerprint
   * (Pitfall 1), rejects no-change results, and returns one immutable
   * publication carrying the exact proposal plus authoritative
   * proposalVersion/expected launch tuple. The view retains the publication
   * opaquely and submits it unchanged to {@link commitRotoGroupDrag}.
   */
  readonly prepareRotoGroupDrag: (loopId: string, destinationPlacementStart: number) => RotoGroupDragPreparationResult;
  /**
   * Submit the exact retained Group-drag publication to the acknowledged
   * physical coordinator (GDRAG-07). Verifies wrapper coherence (operation
   * kind, intent kind, loopId match, non-empty launch tuple) and passes the
   * same proposal object plus captured expected launch tuple to
   * `executePhysicalEdit` without resolver or mapping recomputation. The
   * coordinator performs the authoritative post-barrier revalidation.
   */
  readonly commitRotoGroupDrag: (publication: RotoGroupDragPublication) => Promise<boolean>;
  /** Prepare one exact derived Key Rail for an atomic rigid drag commit. */
  readonly prepareKeyRailDrag: (
    firstKeyId: string,
    destinationFirstKeyAppFrame: number,
  ) => RotoKeyRailDragPreparationResult;
  /** Commit the exact retained Key Rail publication after coherence and staleness checks. */
  readonly commitKeyRailDrag: (publication: RotoKeyRailDragPublication) => Promise<boolean>;
  /**
   * Prepare one versioned directional Push publication (43.5-03). Mirrors the
   * Group-drag guard order (launch → ports → in-flight → well-formed identity),
   * reads one coherent current physical snapshot, builds the 'push-rails'
   * intent, invokes the pure resolver with the incoming interpolation break
   * collection threaded into BOTH the resolver input and a break-aware proposal
   * fingerprint (Pitfall 3), rejects no-change results, and returns one
   * immutable publication carrying the exact proposal, the break-aware
   * proposalVersion, the expected launch tuple, and the presentation facts the
   * locked copy family needs (moved Rail count, clamped delta, ranges, gap).
   */
  readonly prepareRotoPush: (descriptor: RotoPushIntentDescriptor) => RotoPushPreparationResult;
  /**
   * Submit the exact retained Push publication to the acknowledged physical
   * coordinator (T-43.5-01). Verifies wrapper coherence (operation kind, intent
   * kind, non-empty launch tuple) and the break-aware proposal version against
   * current state — stale authority fails closed with zero mutation — then
   * passes the same proposal object plus captured expected launch tuple to
   * `executePhysicalEdit` without resolver or mapping recomputation, publishing
   * the accepted copy from the .then continuation.
   */
  readonly commitRotoPush: (publication: RotoPushPublication) => Promise<boolean>;
  /**
   * Prepare one versioned batch Move publication (43.6-03). Mirrors the Push
   * guard order (launch → ports → in-flight → well-formed descriptor), reads
   * one coherent current physical snapshot, builds the 'move-rails' intent
   * from the explicit set members + signed delta, invokes the pure resolver
   * (the Plan 02 set authorities validate membership and clamp as one unit),
   * rejects no-change results, and returns one immutable publication carrying
   * the exact proposal, the break-aware proposalVersion, the expected launch
   * tuple, and the presentation facts the locked copy family needs (moved
   * Rail count, clamped signed delta, ranges, would-open gap intervals).
   */
  readonly prepareRailSetMove: (descriptor: RotoRailSetMoveIntentDescriptor) => RotoRailSetMovePreparationResult;
  /**
   * Submit the exact retained batch Move publication to the acknowledged
   * physical coordinator (T-43.6-02). Verifies wrapper coherence (operation
   * kind, intent kind, non-empty launch tuple) and the break-aware proposal
   * version against current state — stale authority fails closed with zero
   * mutation — then passes the same proposal object plus captured expected
   * launch tuple to `executePhysicalEdit` without resolver or mapping
   * recomputation, publishing the accepted copy from the .then continuation.
   */
  readonly commitRailSetMove: (publication: RotoRailSetMovePublication) => Promise<boolean>;
  /** Reactive Drag availability derived from selection + pending authority. */
  readonly canDragKey: ReadonlySignal<boolean>;
  /** Reactive Drag disabled reason, or null when eligible. */
  readonly dragDisabledReason: ReadonlySignal<string | null>;
  /** Session-local raw Force Spacing input, initialized to `1`. */
  readonly forceSpacingInput: ReadonlySignal<string>;
  /** Store the exact raw Force Spacing input text without coercion. */
  readonly setForceSpacingInput: (value: string) => void;
  /** Apply canonical Force Spacing through the shared resolver/coordinator path. */
  readonly applyForceSpacing: () => Promise<boolean>;
  /** Reactive Force Spacing availability from launch/readiness/pending authority. */
  readonly canApplyForceSpacing: ReadonlySignal<boolean>;
  /** Reactive Force Spacing disabled reason, or null when eligible. */
  readonly forceSpacingDisabledReason: ReadonlySignal<string | null>;
  /** Reactive + Key availability: launch ready, idle, and the current frame unoccupied. */
  readonly canAddEmptyKey: ReadonlySignal<boolean>;
  /** Reactive + Key disabled reason, or null when eligible. */
  readonly addEmptyKeyDisabledReason: ReadonlySignal<string | null>;
  /** Reactive Select All availability derived from launch presence, idle pending state, and at least one real key record (D-03). */
  readonly canSelectAllKeys: ReadonlySignal<boolean>;
  /** Reactive Select All disabled reason (verbatim controller reason for the 37-04 guarded icon), or null when eligible. */
  readonly selectAllKeysDisabledReason: ReadonlySignal<string | null>;
  /**
   * 43.6-08 rail-set Copy (quick 260820-bjw): builds the frozen multi-rail
   * copy payload from the current session rail-set identities and stores it on
   * the session rail-set clipboard slot (one slot contract).
   */
  readonly copyRailSet: () => Promise<boolean>;
  /** Reactive rail-set Copy availability from launch/readiness/selection authority. */
  readonly canCopyRailSet: ReadonlySignal<boolean>;
  /** Reactive rail-set Copy disabled reason, or null when eligible. */
  readonly copyRailSetDisabledReason: ReadonlySignal<string | null>;
  /**
   * 43.6-08 rail-set Paste: dispatches the FROZEN clipboard payload through the
   * acknowledged `executeRailSetPaste` seam, anchored at the cursor frame.
   */
  readonly pasteRailSet: () => Promise<boolean>;
  /** Reactive rail-set Paste readiness from clipboard + launch authority. */
  readonly canPasteRailSet: ReadonlySignal<boolean>;
  /** Reactive rail-set Paste disabled reason, or null when eligible. */
  readonly pasteRailSetDisabledReason: ReadonlySignal<string | null>;
  /**
   * 43.6-08 rail-set Duplicate (UAT-2): builds a FRESH payload from the current
   * effective rail set selection AT CLICK TIME (never the clipboard, never a
   * memoized set) and duplicates it immediately. A Copy never changes what a
   * later Duplicate does; a new selection fully re-targets the next Duplicate.
   */
  readonly duplicateRailSet: () => Promise<boolean>;
  /** Reactive rail-set Duplicate readiness from the effective selection scope. */
  readonly canDuplicateRailSet: ReadonlySignal<boolean>;
  /** Reactive rail-set Duplicate disabled reason, or null when eligible. */
  readonly duplicateRailSetDisabledReason: ReadonlySignal<string | null>;
}

export interface RotoTimelineActionsInput {
  getModel: () => RotoSourceDisplayModel;
  getStoreRealKeyFrames?: () => number[];
  getCurrentSettings?: () => PhysicPaintRotoInterpolationSettings;
  getStoreRotoFrames?: () => PhysicPaintRotoCacheFrame[];
  getFailureStatus?: () => string | null;
  setInterpolationSettings?: (settings: PhysicPaintRotoInterpolationSettings) => PhysicPaintRotoInterpolationSettings;
  /** Physical real-key records from the store (D-01/D-10). */
  getRotoKeyRecords?: () => readonly PhysicPaintRotoRealKeyRecord[];
  /** Canonical interpolation state from the store (D-02). */
  getRotoInterpolationState?: () => PhysicPaintRotoInterpolationState;
  /** Durable Loop Clip collection from the store (Phase 43, Q1). */
  getRotoLoopClips?: () => readonly PhysicPaintRotoLoopClip[];
  /** Current physical projection cells (D-10). */
  getPhysicalCells?: () => readonly RotoPhysicalTimelineCell[];
  /** Current canonical linked-frame resolution, when Loop Clips are present. */
  getFrameResolution?: (appFrame: number) => PhysicPaintRotoFrameResolution;
  /** Selected stable keyId (D-01). */
  getSelectedKeyId?: () => string | null;
  /**
   * Controller-owned session selection set (37-02; D-05). Read-only here:
   * the hook never derives selection from frames, never mutates the set, and
   * never persists it or sends it across the bridge.
   */
  getSelectedKeyIds?: () => readonly string[];
  /** Session-local derived Key Rail selection; Plan 06 supplies the live signal. */
  getSelectedKeyRail?: () => RotoKeyRailSelection | null;
  /** Selected Loop Rail identities in canonical placement order. */
  getSelectedLoopClipIds?: () => readonly string[];
  /** Presentation-only selected Rail name; never participates in mutation authorization. */
  getSelectedLoopRailDisplayName?: (loopId: string) => string | null;
  /** Session rail-set identities (Plan 01 authority) for the shared Delete classifier. */
  getRailSetMembers?: () => readonly RailSetIdentity[];
  /** Reconciled session-only exact Loop Clip source-position selection. */
  getRotoSpacingSelection?: () => PhysicsPaintRotoSpacingSelection | null;
  /** Current direct physical navigation frame. */
  getCurrentAppFrame?: () => number;
  /** Launch context identity at action time (D-09). */
  getLaunchContext?: () => PhysicPaintLaunchContext | null;
  /** Bounded physical frame capacity (D-01/D-02). */
  getCapacity?: () => number;
  /** Required authoritative current parent/layer end, independent from physical capacity. */
  getParentEndExclusive: () => number;
  /** Complete stable-key-owned incoming interpolation break collection. */
  getIncomingInterpolationBreakKeyIds?: () => readonly string[];
  /** Existing transparent blank-frame builder shared with + Key. */
  buildBlankRotoFrame?: (appFrame: number) => PhysicPaintRotoCacheFrame;
  /** Generic acknowledged coordinator execute seam (Plan 36.14-04). */
  executePhysicalEdit?: (input: RotoPhysicalEditExecuteInput<PhysicPaintRotoPhysicalEditProposal>) => Promise<boolean>;
  /** Coordinator pending operation id Signal (Plan 36.14-04). */
  pendingOperationId?: ReadonlySignal<string | null>;
  /** Direct acknowledged Group lifecycle Delete seam. */
  executeGroupLifecycleDelete?: (target: Readonly<Omit<RotoGroupLifecycleDeleteTarget, 'mode'> & {
    operationKind: 'delete-group-frame' | 'delete-group';
  }>) => Promise<boolean>;
  /** Direct acknowledged rail-set Delete seam (43.6-04 D-23; parent-authority execute). */
  executeRailSetDelete?: (target: Readonly<{
    operationKind: 'delete-rails';
    members: readonly RailSetDeleteMember[];
  }>) => Promise<boolean>;
  /** Session rail-set copy clipboard reader (quick 260820-bjw, 43.6-08). */
  getRailSetClipboard?: () => RotoRailSetCopyPayload | null;
  /** Session rail-set copy clipboard writer (quick 260820-bjw, 43.6-08). */
  setRailSetClipboard?: (payload: RotoRailSetCopyPayload | null) => void;
  /** Direct acknowledged rail-set Paste/Duplicate seam (43.6-08; parent-authority execute). */
  executeRailSetPaste?: (input: Readonly<{
    operationKind: 'paste';
    placementMode: RotoRailSetCopyPlacementMode;
    destinationAppFrame?: number;
    payload: RotoRailSetCopyPayload;
  }>) => Promise<boolean>;
  /** Focused warning request for deleting a Group's sole visible occurrence. */
  requestSoleOccurrenceDeleteWarning?: (target: Readonly<Omit<RotoGroupLifecycleDeleteTarget, 'mode'> & {
    operationKind: 'delete-group-frame';
  }>) => void;
  /** Concise status/LOG publisher for resolver failures. */
  publishStatus?: (message: string | null) => void;
  /**
   * D-26 detail leg: full resolver failure detail (code + text) routed to the
   * surviving diagnostic channel. The Studio wires this to the same console
   * diagnostic style as the coordinator's logDiagnostic.
   */
  publishDiagnostic?: (message: string) => void;
}

type PhysicalActionRunnerKind = Extract<
  PhysicPaintRotoPhysicalEditIntent['kind'],
  'insert-slot' | 'insert-empty-segment' | 'delete-key' | 'delete-key-group' | 'delete-key-rail' | 'scissor-key-rail' | 'duplicate-key' | 'paste-key' | 'paste-key-group'
>;

type PhysicalActionRunnerInput = {
  [Kind in PhysicalActionRunnerKind]: {
    readonly intent: Extract<PhysicPaintRotoPhysicalEditIntent, { readonly kind: Kind }>;
    readonly operationKind: Kind;
    readonly requiredKeyId: string | null;
    readonly successMessage: string;
    /**
     * Optional failure-code → concise capsule copy mapping (UI-SPEC locked
     * lines). Absent: the resolver failure text publishes unchanged, preserving
     * byte-identical behavior for existing routes.
     */
    readonly rejectedCopy?: (failure: PhysicPaintRotoPhysicalEditFailure) => string;
  };
}[PhysicalActionRunnerKind];

function physicalActionAuthorization(input: PhysicalActionRunnerInput) {
  switch (input.operationKind) {
    case 'insert-slot':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'insert-empty-segment':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'delete-key':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'delete-key-group':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'delete-key-rail':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'scissor-key-rail':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'duplicate-key':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'paste-key':
      return { operationKind: input.operationKind, intent: input.intent };
    case 'paste-key-group':
      return { operationKind: input.operationKind, intent: input.intent };
  }
}

const INSERT_SUCCESS_MESSAGE = 'Inserted an empty Roto frame before the selected key.';
const DELETE_SUCCESS_MESSAGE = 'Deleted the selected Roto key.';
const GROUP_DELETE_SUCCESS_MESSAGE = 'Keys deleted';
const DUPLICATE_SUCCESS_MESSAGE = 'Duplicated the selected Roto key.';
const PASTE_SUCCESS_MESSAGE = 'Pasted the copied paint into the Roto timeline.';
const ADD_KEY_SUCCESS_MESSAGE = 'Added an empty Roto key.';
const INVALID_FORCE_SPACING_MESSAGE = 'Enter a whole number of empty frames (0 or more).';

interface ForceSpacingScopeSnapshot {
  readonly scopeKeyIds: readonly string[] | null;
  readonly linkedSourceSpacingScopes: readonly PhysicPaintRotoLinkedSourceSpacingScope[] | null;
  /** 43.6-05: per-rail member descriptors of the active rail set; null when no set is active. */
  readonly railSetMembers: readonly PhysicPaintRailSetMoveMember[] | null;
}

type ForceSpacingScopeResult =
  | { readonly ok: true; readonly value: ForceSpacingScopeSnapshot }
  | { readonly ok: false; readonly message: string };

function sameOrderedIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((keyId, index) => keyId === right[index]);
}

function isBoundedSelectionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function isBoundedRailSetIdentity(value: unknown): value is RailSetIdentity {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { readonly kind?: unknown; readonly loopId?: unknown; readonly firstKeyId?: unknown };
  if (candidate.kind === 'loop') {
    return isBoundedSelectionId(candidate.loopId);
  }
  if (candidate.kind === 'key-rail') {
    return isBoundedSelectionId(candidate.firstKeyId);
  }
  return false;
}

function railSetIdentityKey(identity: RailSetIdentity): string {
  return identity.kind === 'loop' ? `loop:${identity.loopId}` : `key-rail:${identity.firstKeyId}`;
}

function freezeLinkedSpacingScope(
  sourceKeyIds: readonly string[],
  selectedSourceKeyIds: readonly string[],
): PhysicPaintRotoLinkedSourceSpacingScope {
  const frozenSourceKeyIds = Object.freeze([...sourceKeyIds]);
  return Object.freeze({
    sourceCycleId: getPhysicsPaintRotoSourceCycleId(frozenSourceKeyIds),
    sourceKeyIds: frozenSourceKeyIds,
    selectedSourceKeyIds: Object.freeze([...selectedSourceKeyIds]),
  });
}

function deriveForceSpacingScope(input: {
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly selectedLoopClipIds: readonly string[];
  readonly selectedKeyIds: readonly string[];
  readonly spacingSelection: PhysicsPaintRotoSpacingSelection | null;
  readonly selectedKeyRail?: RotoKeyRailSelection | null;
  /** Session rail-set identities (Plan 01 authority); the set branch runs FIRST. */
  readonly railSetMembers?: readonly RailSetIdentity[] | null;
  readonly incomingInterpolationBreakKeyIds?: readonly string[];
}): ForceSpacingScopeResult {
  const currentKeyIds = new Set(input.records.map((record) => record.keyId));
  const orderedLoopClips = [...input.loopClips]
    .sort((left, right) => left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId));
  const currentCycle = (sourceKeyIds: readonly string[]) => sourceKeyIds.length >= 2
    && sourceKeyIds.every(isBoundedSelectionId)
    && new Set(sourceKeyIds).size === sourceKeyIds.length
    && sourceKeyIds.every((keyId) => currentKeyIds.has(keyId));

  // 43.6-05 D-26: the rail-set branch runs FIRST — an active non-empty set is
  // the session authority and yields per-rail member descriptors; a stale set
  // fails closed with the mapped stale message; the branch never invents
  // fallback scope. The resolver revalidates membership exactly against fresh
  // derivation, so the descriptors must match the current segments/ranges.
  if (input.railSetMembers !== undefined && input.railSetMembers !== null && input.railSetMembers.length > 0) {
    const members = input.railSetMembers;
    if (!members.every(isBoundedRailSetIdentity) || new Set(members.map(railSetIdentityKey)).size !== members.length) {
      return { ok: false, message: 'Rail set selection is stale. Select the Rails again.' };
    }
    const groupOwnedKeyIds = new Set<string>();
    for (const clip of input.loopClips) {
      clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
      (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
    }
    const segments = deriveKeyRailSegments({
      orderedRealKeys: [...input.records]
        .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId)),
      incomingInterpolationBreakKeyIds: new Set(input.incomingInterpolationBreakKeyIds ?? []),
      groupOwnedKeyIds,
    });
    const descriptors: PhysicPaintRailSetMoveMember[] = [];
    for (const identity of members) {
      if (identity.kind === 'key-rail') {
        const segment = segments.find((candidate) => candidate.firstKeyId === identity.firstKeyId);
        if (segment === undefined) {
          return { ok: false, message: 'Rail set selection is stale. Select the Rails again.' };
        }
        descriptors.push({ kind: 'key-rail', firstKeyId: segment.firstKeyId, keyIds: segment.keyIds });
      } else {
        if (!input.loopClips.some((clip) => clip.loopId === identity.loopId)) {
          return { ok: false, message: 'Rail set selection is stale. Select the Rails again.' };
        }
        descriptors.push({ kind: 'loop', loopId: identity.loopId });
      }
    }
    return {
      ok: true,
      value: Object.freeze({
        scopeKeyIds: null,
        linkedSourceSpacingScopes: null,
        railSetMembers: Object.freeze(descriptors),
      }),
    };
  }

  if (input.selectedLoopClipIds.length > 0) {
    if (input.selectedKeyIds.length > 0 || input.spacingSelection !== null) {
      return { ok: false, message: 'Rail and physical Key Spacing selections conflict. Select the Loop Rails again.' };
    }
    if (!input.selectedLoopClipIds.every(isBoundedSelectionId)
      || new Set(input.selectedLoopClipIds).size !== input.selectedLoopClipIds.length) {
      return { ok: false, message: 'Loop Rail selection is stale. Select the Loop Rails again.' };
    }
    const selectedIdSet = new Set(input.selectedLoopClipIds);
    const selectedClips = orderedLoopClips.filter((loopClip) => selectedIdSet.has(loopClip.loopId));
    if (selectedClips.length !== input.selectedLoopClipIds.length
      || !sameOrderedIds(selectedClips.map((loopClip) => loopClip.loopId), input.selectedLoopClipIds)) {
      return { ok: false, message: 'Loop Rail selection is stale. Select the Loop Rails again.' };
    }
    const seenCycles = new Set<string>();
    const seenSourceKeyIds = new Set<string>();
    const scopes: PhysicPaintRotoLinkedSourceSpacingScope[] = [];
    for (const loopClip of selectedClips) {
      if (!currentCycle(loopClip.sourceKeyIds)) {
        return { ok: false, message: 'Loop Rail source authorization is stale. Select the Loop Rails again.' };
      }
      const sourceCycleId = getPhysicsPaintRotoSourceCycleId(loopClip.sourceKeyIds);
      if (seenCycles.has(sourceCycleId)) continue;
      if (loopClip.sourceKeyIds.some((keyId) => seenSourceKeyIds.has(keyId))) {
        return { ok: false, message: 'Loop Rail source authorization is ambiguous. Select the Loop Rails again.' };
      }
      seenCycles.add(sourceCycleId);
      loopClip.sourceKeyIds.forEach((keyId) => seenSourceKeyIds.add(keyId));
      scopes.push(freezeLinkedSpacingScope(loopClip.sourceKeyIds, loopClip.sourceKeyIds));
    }
    if (scopes.length === 0) {
      return { ok: false, message: 'Loop Rail selection is stale. Select the Loop Rails again.' };
    }
    return {
      ok: true,
      value: Object.freeze({
        scopeKeyIds: Object.freeze(scopes.flatMap((scope) => scope.selectedSourceKeyIds)),
        linkedSourceSpacingScopes: Object.freeze(scopes),
        railSetMembers: null,
      }),
    };
  }

  if (input.selectedKeyRail !== null && input.selectedKeyRail !== undefined) {
    if (input.selectedKeyIds.length > 0 || input.spacingSelection !== null) {
      return { ok: false, message: 'Rail and physical Key Spacing selections conflict. Select the Loop Rails again.' };
    }
    const rail = input.selectedKeyRail;
    const railIsWellFormed = isBoundedKeyId(rail.firstKeyId)
      && rail.keyIds.length > 0
      && rail.keyIds[0] === rail.firstKeyId
      && rail.keyIds.every(isBoundedKeyId)
      && new Set(rail.keyIds).size === rail.keyIds.length
      && rail.keyIds.every((keyId) => currentKeyIds.has(keyId));
    if (!railIsWellFormed) {
      return { ok: false, message: 'Key Rail selection is stale. Select the Key Rail again.' };
    }
    return {
      ok: true,
      value: Object.freeze({
        scopeKeyIds: Object.freeze([...rail.keyIds]),
        linkedSourceSpacingScopes: null,
        railSetMembers: null,
      }),
    };
  }

  if (!input.selectedKeyIds.every(isBoundedSelectionId)
    || new Set(input.selectedKeyIds).size !== input.selectedKeyIds.length
    || input.selectedKeyIds.some((keyId) => !currentKeyIds.has(keyId))) {
    return { ok: false, message: 'Physical Key Spacing selection is stale. Select the keys again.' };
  }

  if (input.spacingSelection !== null) {
    const selection = input.spacingSelection;
    if (selection.selectedSourceKeyIds.length < 2) {
      return { ok: false, message: 'Select at least two Loop Clip source positions to apply Key Spacing.' };
    }
    const selectedSet = new Set(selection.selectedSourceKeyIds);
    const orderedSelected = selection.sourceKeyIds.filter((keyId) => selectedSet.has(keyId));
    const exactCycleExists = orderedLoopClips.some((loopClip) => sameOrderedIds(loopClip.sourceKeyIds, selection.sourceKeyIds));
    if (!currentCycle(selection.sourceKeyIds)
      || selection.sourceCycleId !== getPhysicsPaintRotoSourceCycleId(selection.sourceKeyIds)
      || !exactCycleExists
      || selection.selectedSourceKeyIds.length < 2
      || selectedSet.size !== selection.selectedSourceKeyIds.length
      || !sameOrderedIds(orderedSelected, selection.selectedSourceKeyIds)
      || !sameOrderedIds(input.selectedKeyIds, selection.selectedSourceKeyIds)) {
      return { ok: false, message: 'Physical Key Spacing selection is stale. Select the keys again.' };
    }
    const scope = freezeLinkedSpacingScope(selection.sourceKeyIds, selection.selectedSourceKeyIds);
    return {
      ok: true,
      value: Object.freeze({
        scopeKeyIds: scope.selectedSourceKeyIds,
        linkedSourceSpacingScopes: Object.freeze([scope]),
        railSetMembers: null,
      }),
    };
  }

  const selectedSet = new Set(input.selectedKeyIds);
  const matchingCycles = new Map<string, readonly string[]>();
  for (const loopClip of orderedLoopClips) {
    if (!currentCycle(loopClip.sourceKeyIds)) continue;
    if (!loopClip.sourceKeyIds.some((keyId) => selectedSet.has(keyId))) continue;
    matchingCycles.set(getPhysicsPaintRotoSourceCycleId(loopClip.sourceKeyIds), loopClip.sourceKeyIds);
  }
  if (matchingCycles.size > 1) {
    return { ok: false, message: 'Select Loop Rails to apply Key Spacing across multiple Loop Clips.' };
  }
  if (matchingCycles.size === 1) {
    if (input.selectedKeyIds.length < 2) {
      return { ok: false, message: 'Select at least two Loop Clip source positions to apply Key Spacing.' };
    }
    const sourceKeyIds = [...matchingCycles.values()][0];
    const orderedSelected = sourceKeyIds.filter((keyId) => selectedSet.has(keyId));
    if (orderedSelected.length !== input.selectedKeyIds.length
      || !sameOrderedIds(orderedSelected, input.selectedKeyIds)) {
      return { ok: false, message: 'Select only source positions from one Loop Clip cycle, or select Loop Rails.' };
    }
    const scope = freezeLinkedSpacingScope(sourceKeyIds, orderedSelected);
    return {
      ok: true,
      value: Object.freeze({
        scopeKeyIds: scope.selectedSourceKeyIds,
        linkedSourceSpacingScopes: Object.freeze([scope]),
        railSetMembers: null,
      }),
    };
  }

  if (input.selectedKeyIds.length < 2 && orderedLoopClips.length > 0) {
    return { ok: false, message: 'Select at least two physical keys, or select Loop Rails for Loop Clip Key Spacing.' };
  }
  return {
    ok: true,
    value: Object.freeze({
      scopeKeyIds: input.selectedKeyIds.length >= 2 ? Object.freeze([...input.selectedKeyIds]) : null,
      linkedSourceSpacingScopes: null,
      railSetMembers: null,
    }),
  };
}

export function useRotoTimelineActions(input: RotoTimelineActionsInput) {
  const forceSpacingInput = useMemo(() => signal('1'), []);

  const updateInterpolationSettings = useCallback((currentFrame: number, patch: Partial<PhysicPaintRotoInterpolationSettings>) => {
    const currentSettings = input.getCurrentSettings?.() ?? toPhysicPaintRotoInterpolationSettings(input.getModel().settings);
    const sourceFrameBeforeUpdate = getSourceRotoFrameForDisplayFrame(
      currentFrame,
      input.getStoreRealKeyFrames?.() ?? input.getModel().realSourceFrames,
      currentSettings,
      'existing-only',
    );
    const nextSettings = updateRotoInterpolationSettingsTransaction({
      currentFrame,
      currentSettings,
      patch,
      sourceFrameBeforeUpdate,
      storeRotoFrames: [],
      refreshedSettings: { ...currentSettings, ...patch, mode: 'duplicate' },
      failureStatus: null,
    }).settings;
    const refreshedSettings = input.setInterpolationSettings?.(nextSettings) ?? nextSettings;
    const storeRotoFrames = input.getStoreRotoFrames?.() ?? [];
    return updateRotoInterpolationSettingsTransaction({
      currentFrame,
      currentSettings,
      patch,
      sourceFrameBeforeUpdate,
      storeRotoFrames,
      refreshedSettings,
      failureStatus: input.getFailureStatus?.() ?? null,
    });
  }, [input]);

  // One computed target authority drives Insert eligibility, product reason,
  // contextual description, and activation reclassification without mirrored state.
  const insertTarget = computed(() => classifyRotoInsertTarget(readRotoInsertTargetInput(input)));
  const canInsertFrame = computed(() => mapRotoInsertProductReason(insertTarget.value) === null);
  const insertDisabledReason = computed(() => mapRotoInsertProductReason(insertTarget.value));
  const insertTooltipDescription = computed(() => insertTarget.value.kind === 'genuinely-empty'
    ? 'Insert an empty key connected to the previous segment.'
    : 'Insert key before');
  const deleteTarget = computed(() => classifyRotoDeleteTarget(readRotoDeleteTargetInput(input)));
  const canDeleteFrame = computed(() => mapRotoDeleteProductReason(deleteTarget.value) === null);
  const deleteDisabledReason = computed(() => mapRotoDeleteProductReason(deleteTarget.value));
  const deleteScopeLabel = computed(() => {
    const target = deleteTarget.value;
    const groupDisplayName = target.kind === 'group'
      ? input.getSelectedLoopRailDisplayName?.(target.groupId) ?? null
      : null;
    return buildRotoDeleteScopeLabel(target, groupDisplayName);
  });
  const scissorTarget = computed(() => classifyRotoScissorTarget(readRotoScissorTargetInput(input)));
  const canScissor = computed(() => mapRotoScissorProductReason(scissorTarget.value) === null);
  const scissorDisabledReason = computed(() => mapRotoScissorProductReason(scissorTarget.value));
  const scissorTooltipDescription = computed(() => mapRotoScissorTooltip(scissorTarget.value));
  const canDragKey = computed(() => computeDragAvailability(input).eligible);
  const dragDisabledReason = computed(() => computeDragAvailability(input).reason);
  const canApplyForceSpacing = computed(() => computeForceSpacingAvailability(input).eligible);
  const forceSpacingDisabledReason = computed(() => computeForceSpacingAvailability(input).reason);
  const canAddEmptyKey = computed(() => computeAddEmptyKeyAvailability(input).eligible);
  const addEmptyKeyDisabledReason = computed(() => computeAddEmptyKeyAvailability(input).reason);
  const canSelectAllKeys = computed(() => computeSelectAllKeysAvailability(input).eligible);
  const selectAllKeysDisabledReason = computed(() => computeSelectAllKeysAvailability(input).reason);
  const canCopyRailSet = computed(() => computeRailSetCopyAvailability(input).eligible);
  const copyRailSetDisabledReason = computed(() => computeRailSetCopyAvailability(input).reason);
  const canPasteRailSet = computed(() => computeRailSetPasteAvailability(input).eligible);
  const pasteRailSetDisabledReason = computed(() => computeRailSetPasteAvailability(input).reason);
  // Duplicate availability derives from the EFFECTIVE rail set scope (the same
  // dynamic classifier as Copy/Delete), NOT the clipboard. A single selected rail
  // is a set of one (43.6 Solo), so Duplicate enables with any non-empty scope.
  const canDuplicateRailSet = computed(() => computeRailSetDuplicateAvailability(input).eligible);
  const duplicateRailSetDisabledReason = computed(() => computeRailSetDuplicateAvailability(input).reason);
  const pendingOperationIdSignal = input.pendingOperationId ?? signal<string | null>(null);

  const runPhysicalAction = useCallback(async (runnerInput: PhysicalActionRunnerInput): Promise<boolean> => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      input.publishStatus?.('Select a real Roto key before editing the timeline.');
      return false;
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      input.publishStatus?.('Timeline editing is unavailable.');
      return false;
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      input.publishStatus?.('A Roto physical edit is already in flight.');
      return false;
    }
    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    if (
      runnerInput.requiredKeyId !== null
      && records.filter((record) => record.keyId === runnerInput.requiredKeyId).length !== 1
    ) {
      input.publishStatus?.('The selected Roto key is no longer available.');
      return false;
    }
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      records,
      intent: runnerInput.intent,
      parentEndExclusive: input.getParentEndExclusive(),
      capacity,
      interpolationEnabled: interpolation.enabled,
      // Phase 43: loop-aware guards (D-07 source-key deletion) consult the
      // durable Loop Clip collection; absent port = pre-43 empty collection.
      loopClips: input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
      incomingInterpolationBreakKeyIds: input.getIncomingInterpolationBreakKeyIds?.() ?? [],
    });
    if (!resolution.ok) {
      input.publishStatus?.(runnerInput.rejectedCopy?.(resolution.failure) ?? (resolution.failure.text || 'The Roto timeline edit is invalid.'));
      if (
        runnerInput.operationKind === 'delete-key-group'
        || runnerInput.operationKind === 'paste-key-group'
        || runnerInput.operationKind === 'insert-empty-segment'
      ) {
        input.publishDiagnostic?.(runnerInput.operationKind + ' rejected: ' + resolution.failure.code + ' — ' + resolution.failure.text);
      }
      return false;
    }
    const proposal = resolution.proposal;
    const accepted = await input.executePhysicalEdit({
      proposal,
      expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
      ...physicalActionAuthorization(runnerInput),
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    });
    if (accepted) {
      input.publishStatus?.(runnerInput.successMessage);
    }
    return accepted;
  }, [input]);

  const insertRotoFrame = useCallback((): Promise<boolean> => {
    const target = classifyRotoInsertTarget(readRotoInsertTargetInput(input));
    const rejection = mapRotoInsertProductReason(target);
    if (rejection !== null) {
      input.publishStatus?.(rejection);
      return Promise.resolve(false);
    }
    if (target.kind === 'occupied-real') {
      return runPhysicalAction({
        intent: { kind: 'insert-slot', selectedKeyId: target.keyId },
        operationKind: 'insert-slot',
        requiredKeyId: target.keyId,
        successMessage: INSERT_SUCCESS_MESSAGE,
      });
    }
    if (target.kind !== 'genuinely-empty' || !input.buildBlankRotoFrame) {
      input.publishStatus?.('Choose a valid timeline frame before inserting.');
      return Promise.resolve(false);
    }
    const insertedKeyId = createPhysicPaintRotoKeyId();
    return runPhysicalAction({
      intent: {
        kind: 'insert-empty-segment',
        destinationAppFrame: target.appFrame,
        insertedKeyId,
        blankPayload: toEmptyKeyPayload(input.buildBlankRotoFrame(target.appFrame), target.appFrame),
      },
      operationKind: 'insert-empty-segment',
      requiredKeyId: null,
      successMessage: `Inserted empty key at frame ${target.appFrame}. Connected to the previous segment.`,
      rejectedCopy: (failure) => mapRotoInsertProductReason(mapRotoInsertFailureTarget(failure, input))
        ?? 'Choose a valid timeline frame before inserting.',
    });
  }, [runPhysicalAction, input]);

  const deleteRotoFrame = useCallback((): Promise<boolean> => {
    // Keyboard Delete/Backspace and the visible Delete icon converge here. Read
    // and classify one current accepted snapshot per activation; never trust a
    // previously rendered availability result for ownership.
    const target = classifyRotoDeleteTarget(readRotoDeleteTargetInput(input));
    const rejection = mapRotoDeleteProductReason(target);
    if (rejection !== null) {
      input.publishStatus?.(rejection);
      return Promise.resolve(false);
    }
    if (target.kind === 'group-frame' || target.kind === 'group') {
      if (target.kind === 'group-frame' && target.onlyOccurrence) {
        if (!input.requestSoleOccurrenceDeleteWarning) {
          input.publishStatus?.('Delete Frame confirmation is unavailable.');
          return Promise.resolve(false);
        }
        input.requestSoleOccurrenceDeleteWarning(Object.freeze({
          operationKind: 'delete-group-frame',
          groupId: target.groupId,
          appFrame: target.appFrame,
          phaseOrigin: target.phaseOrigin,
          onlyOccurrence: true,
        }));
        return Promise.resolve(false);
      }
      if (!input.executeGroupLifecycleDelete) {
        input.publishStatus?.('Group deletion is unavailable.');
        return Promise.resolve(false);
      }
      return input.executeGroupLifecycleDelete(Object.freeze({
        operationKind: target.kind === 'group' ? 'delete-group' : 'delete-group-frame',
        groupId: target.groupId,
        appFrame: target.appFrame,
        phaseOrigin: target.phaseOrigin,
        onlyOccurrence: target.onlyOccurrence,
      }));
    }
    if (target.kind === 'rail-set') {
      // 43.6-04 D-23: one direct parent-authority execute — no runPhysicalAction,
      // no confirmation modal at any set size. The accepted copy publishes
      // through the one mapper; a port rejection reclassifies and publishes the
      // mapped reason (never a success status on a rejected path).
      if (!input.executeRailSetDelete) {
        input.publishStatus?.('Rail set deletion is unavailable.');
        return Promise.resolve(false);
      }
      return input.executeRailSetDelete(Object.freeze({
        operationKind: 'delete-rails',
        members: target.members,
      })).then((accepted) => {
        if (accepted) {
          input.publishStatus?.(buildDeleteRailSetSuccessMessage(target));
          return true;
        }
        const rejection = mapRotoDeleteProductReason(
          classifyRotoDeleteTarget(readRotoDeleteTargetInput(input)),
        );
        if (rejection !== null) input.publishStatus?.(rejection);
        return false;
      });
    }
    if (target.kind === 'key-rail') {
      return runPhysicalAction({
        intent: { kind: 'delete-key-rail', keyIds: target.keyIds },
        operationKind: 'delete-key-rail',
        requiredKeyId: target.firstKeyId,
        successMessage: buildDeleteKeyRailSuccessMessage(target),
        rejectedCopy: (failure) => mapRotoDeleteProductReason(
          classifyRotoDeleteTarget(readRotoDeleteTargetInput(input)),
        ) ?? (failure.text || 'The selected Key Rail is no longer available.'),
      });
    }
    if (target.kind === 'ordinary-key-group') {
      return runPhysicalAction({
        intent: { kind: 'delete-key-group', keyIds: target.keyIds },
        operationKind: 'delete-key-group',
        requiredKeyId: null,
        successMessage: GROUP_DELETE_SUCCESS_MESSAGE,
      });
    }
    if (target.kind === 'ordinary-key') {
      return runPhysicalAction({
        intent: { kind: 'delete-key', selectedKeyId: target.keyId },
        operationKind: 'delete-key',
        requiredKeyId: target.keyId,
        successMessage: DELETE_SUCCESS_MESSAGE,
      });
    }
    return Promise.resolve(false);
  }, [runPhysicalAction, input]);

  const scissorKeyRail = useCallback((): Promise<boolean> => {
    const target = classifyRotoScissorTarget(readRotoScissorTargetInput(input));
    if (target.kind === 'already-owns-break') {
      return Promise.resolve(false);
    }
    const rejection = mapRotoScissorProductReason(target);
    if (rejection !== null) {
      input.publishStatus?.(rejection);
      return Promise.resolve(false);
    }
    if (target.kind !== 'ok' && target.kind !== 'generated-ok') return Promise.resolve(false);
    return runPhysicalAction({
      intent: { kind: 'scissor-key-rail', breakOwnerKeyId: target.keyId },
      operationKind: 'scissor-key-rail',
      requiredKeyId: target.keyId,
      successMessage: mapRotoScissorAcceptedCopy(target),
      rejectedCopy: () => mapRotoScissorProductReason(
        classifyRotoScissorTarget(readRotoScissorTargetInput(input)),
      ) ?? 'Scissor is unavailable.',
    });
  }, [input, runPhysicalAction]);

  const duplicateKey = useCallback((sourceKeyId: string): Promise<boolean> => {
    if (!isBoundedKeyId(sourceKeyId)) {
      input.publishStatus?.('The selected Roto key identity is malformed.');
      return Promise.resolve(false);
    }
    return runPhysicalAction({
      intent: createPhysicPaintRotoDuplicateKeyIntent(sourceKeyId),
      operationKind: 'duplicate-key',
      requiredKeyId: sourceKeyId,
      successMessage: DUPLICATE_SUCCESS_MESSAGE,
    });
  }, [input, runPhysicalAction]);

  const pasteKey = useCallback((
    destinationAppFrame: number,
    clipboardPayload: PhysicPaintRotoRealKeyPayload,
    destinationKeyId: string | null,
  ): Promise<boolean> => {
    if (!Number.isInteger(destinationAppFrame) || destinationAppFrame < 0) {
      input.publishStatus?.('Select a valid Roto frame before pasting.');
      return Promise.resolve(false);
    }
    if (destinationKeyId !== null && !isBoundedKeyId(destinationKeyId)) {
      input.publishStatus?.('The destination Roto key identity is malformed.');
      return Promise.resolve(false);
    }
    try {
      return runPhysicalAction({
        intent: createPhysicPaintRotoPasteKeyIntent(
          destinationAppFrame,
          clipboardPayload,
          destinationKeyId,
        ),
        operationKind: 'paste-key',
        requiredKeyId: destinationKeyId,
        successMessage: PASTE_SUCCESS_MESSAGE,
      });
    } catch {
      input.publishStatus?.('The copied Roto paint is unavailable.');
      return Promise.resolve(false);
    }
  }, [input, runPhysicalAction]);

  const pasteKeyGroup = useCallback((
    destinationAppFrame: number,
    entries: readonly RotoSessionCopiedGroupEntry[],
  ): Promise<boolean> => {
    if (!Number.isInteger(destinationAppFrame) || destinationAppFrame < 0) {
      input.publishStatus?.('Select a valid Roto frame before pasting.');
      return Promise.resolve(false);
    }
    let intent: Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'paste-key-group' }>;
    try {
      // The factory is the fail-closed gate: it throws on fewer than two
      // entries or malformed entry fields (T-38-01).
      intent = createPhysicPaintRotoPasteKeyGroupIntent(destinationAppFrame, entries);
    } catch {
      input.publishStatus?.('The copied Roto key group is unavailable.');
      return Promise.resolve(false);
    }
    // Busy line shows only while the acknowledged transaction is pending; the
    // success or reject line always overwrites it (UI-SPEC locked).
    input.publishStatus?.('Pasting keys…');
    return runPhysicalAction({
      intent,
      operationKind: 'paste-key-group',
      // requiredKeyId is null per the delete-key-group precedent: the resolver
      // is the destination-occupancy authority — every computed destination
      // must be empty, so no existing keyId is required.
      requiredKeyId: null,
      successMessage: `Pasted ${entries.length} keys`,
      rejectedCopy: (failure) => failure.code === 'duplicate-destination-frame'
        ? 'Paste rejected — key in the way'
        : failure.code === 'over-capacity' || failure.code === 'out-of-range-frame'
          ? 'Paste rejected — not enough room'
          : failure.text || 'The Roto key group paste is invalid.',
    });
  }, [input, runPhysicalAction]);

  // 43.6-08 rail-set Copy (quick 260820-bjw): the frozen multi-rail payload is
  // built from the session rail-set identities against one coherent current
  // document and stored on the session rail-set clipboard slot (one slot
  // contract). Stale/malformed members and stale documents fail closed with the
  // locked selection-stale voice — never a fallback scope.
  const copyRailSet = useCallback((): Promise<boolean> => {
    const members = input.getRailSetMembers?.() ?? [];
    if (members.length === 0) {
      input.publishStatus?.('Select the Rails to copy.');
      return Promise.resolve(false);
    }
    if (!members.every(isBoundedRailSetIdentity) || new Set(members.map(railSetIdentityKey)).size !== members.length) {
      input.publishStatus?.('Rail set selection is stale. Select the Rails again.');
      return Promise.resolve(false);
    }
    if (!input.setRailSetClipboard) {
      input.publishStatus?.('Rail set copying is unavailable.');
      return Promise.resolve(false);
    }
    const document = buildRailSetCopyDocument(input);
    if (document === null) {
      input.publishStatus?.('Timeline editing is unavailable.');
      return Promise.resolve(false);
    }
    const built = buildRotoRailSetCopyPayload({ document, members });
    if (!built.ok) {
      input.publishStatus?.(built.reason === 'empty-set'
        ? 'Select the Rails to copy.'
        : built.reason === 'malformed-member'
          ? 'Rail set selection is stale. Select the Rails again.'
          : 'The selected Rails are no longer available.');
      return Promise.resolve(false);
    }
    input.setRailSetClipboard(built.payload);
    input.publishStatus?.('Copied rail set.');
    return Promise.resolve(true);
  }, [input]);

  // Shared rail-set placement executor (43.6-08). Paste and Duplicate both supply
  // their own payload: Paste reads the frozen clipboard, Duplicate builds a FRESH
  // payload at click time. The executor never reads the clipboard itself, so a
  // stale clipboard can never leak into a Duplicate.
  const executeRailSetPastePlacement = useCallback((
    placementMode: RotoRailSetCopyPlacementMode,
    payload: RotoRailSetCopyPayload,
  ): Promise<boolean> => {
    if (!input.executeRailSetPaste) {
      input.publishStatus?.('Rail set pasting is unavailable.');
      return Promise.resolve(false);
    }
    const destinationAppFrame = placementMode === 'paste' ? input.getCurrentAppFrame?.() ?? null : null;
    if (placementMode === 'paste'
      && (destinationAppFrame === null || !Number.isInteger(destinationAppFrame) || destinationAppFrame < 0)) {
      input.publishStatus?.('Select a valid Roto frame before pasting.');
      return Promise.resolve(false);
    }
    // Guard validated: when placementMode is 'paste', destinationAppFrame is a
    // non-negative integer. TS does not carry the correlated narrowing into the
    // ternary below, so pin the non-null destination here.
    const pasteDestination = placementMode === 'paste' ? destinationAppFrame as number : null;
    input.publishStatus?.(placementMode === 'paste' ? 'Pasting Rails…' : 'Duplicating Rails…');
    const executeInput: Readonly<{
      operationKind: 'paste';
      placementMode: RotoRailSetCopyPlacementMode;
      destinationAppFrame?: number;
      payload: RotoRailSetCopyPayload;
    }> = placementMode === 'paste'
      ? Object.freeze({
          operationKind: 'paste',
          placementMode: 'paste',
          destinationAppFrame: pasteDestination as number,
          payload,
        })
      : Object.freeze({
          operationKind: 'paste',
          placementMode: 'duplicate',
          payload,
        });
    return input.executeRailSetPaste(executeInput).then((accepted) => {
      if (accepted) {
        input.publishStatus?.(placementMode === 'paste' ? 'Pasted the copied Rails.' : 'Duplicated the selected Rails.');
        return true;
      }
      input.publishStatus?.(placementMode === 'paste'
        ? 'Paste rejected — not enough room or the destination is occupied.'
        : 'Duplicate rejected — not enough room.');
      return false;
    });
  }, [input]);

  // Paste reuses the FROZEN rail-set clipboard payload (copy-on-write from the
  // copy moment). Stale/malformed members and stale documents fail closed.
  const pasteRailSet = useCallback((): Promise<boolean> => {
    const payload = input.getRailSetClipboard?.() ?? null;
    if (!payload) {
      input.publishStatus?.('Copy a rail set before pasting.');
      return Promise.resolve(false);
    }
    return executeRailSetPastePlacement('paste', payload);
  }, [input, executeRailSetPastePlacement]);

  // 43.6-08 Duplicate (UAT-2): Duplicate is NOT clipboard-backed. It builds a
  // FRESH payload from the current effective rail set selection AT CLICK TIME
  // (deriveEffectiveRailSetMembers via getRailSetMembers) and immediately
  // duplicates it. A Copy to the clipboard never changes what a later Duplicate
  // does, and a new selection fully re-targets the next Duplicate.
  const duplicateRailSet = useCallback((): Promise<boolean> => {
    const members = input.getRailSetMembers?.() ?? [];
    if (members.length === 0) {
      input.publishStatus?.('Select the Rails to duplicate.');
      return Promise.resolve(false);
    }
    if (!members.every(isBoundedRailSetIdentity) || new Set(members.map(railSetIdentityKey)).size !== members.length) {
      input.publishStatus?.('Rail set selection is stale. Select the Rails again.');
      return Promise.resolve(false);
    }
    const document = buildRailSetCopyDocument(input);
    if (document === null) {
      input.publishStatus?.('Timeline editing is unavailable.');
      return Promise.resolve(false);
    }
    const built = buildRotoRailSetCopyPayload({ document, members });
    if (!built.ok) {
      input.publishStatus?.(built.reason === 'empty-set'
        ? 'Select the Rails to duplicate.'
        : built.reason === 'malformed-member'
          ? 'Rail set selection is stale. Select the Rails again.'
          : 'The selected Rails are no longer available.');
      return Promise.resolve(false);
    }
    return executeRailSetPastePlacement('duplicate', built.payload);
  }, [input, executeRailSetPastePlacement]);

  const addEmptyKey = useCallback((
    destinationAppFrame: number,
    emptyPayload: PhysicPaintRotoRealKeyPayload,
  ): Promise<boolean> => {
    if (!Number.isInteger(destinationAppFrame) || destinationAppFrame < 0) {
      input.publishStatus?.('Select a valid Roto frame before adding a key.');
      return Promise.resolve(false);
    }
    try {
      // + Key promotion reuses the paste-to-empty physical edit machinery with
      // an empty payload — the same path the script-target promotion uses — so
      // the resolver, coordinator, settlement, and history stay unchanged.
      // Quick 260816-tv7: startsNewSegment makes the new key own a persistent
      // incoming interpolation break (broken-key contract), matching Paint on
      // an empty frame. Quick 260819-wzi: a destination strictly INSIDE a
      // derived Key Rail segment span instead joins the existing rail — the
      // rail re-derives over it (0/4/6/8) — while trailing-space, intentional
      // gap, and any position outside a span keep the own-one-key-rail break.
      const groupOwnedKeyIds = new Set<string>();
      for (const clip of input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY) {
        clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
        (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
      }
      const segments = deriveKeyRailSegments({
        orderedRealKeys: [...(input.getRotoKeyRecords?.() ?? [])]
          .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId)),
        incomingInterpolationBreakKeyIds: new Set(input.getIncomingInterpolationBreakKeyIds?.() ?? []),
        groupOwnedKeyIds,
      });
      const startsNewSegment = !segments.some(
        (segment) => segment.firstKeyFrame < destinationAppFrame && destinationAppFrame < segment.lastKeyFrame,
      );
      return runPhysicalAction({
        intent: createPhysicPaintRotoPasteKeyIntent(destinationAppFrame, emptyPayload, null, startsNewSegment),
        operationKind: 'paste-key',
        requiredKeyId: null,
        successMessage: ADD_KEY_SUCCESS_MESSAGE,
      });
    } catch {
      input.publishStatus?.('The empty Roto key payload is unavailable.');
      return Promise.resolve(false);
    }
  }, [input, runPhysicalAction]);

  const prepareRotoKeyDrag = useCallback((movedKeyId: string, target: RotoDragTarget): RotoDragPreparationResult => {    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      return { ok: false, reason: 'Select a real Roto key before editing the timeline.' };
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      return { ok: false, reason: 'Timeline editing is unavailable.' };
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      return { ok: false, reason: 'A Roto physical edit is already in flight.' };
    }
    if (!isBoundedKeyId(movedKeyId)) {
      return { ok: false, reason: 'The dragged Roto key identity is malformed.' };
    }
    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const movedMatches = records.filter((record) => record.keyId === movedKeyId);
    if (movedMatches.length === 0) {
      return { ok: false, reason: 'The dragged Roto key is no longer available.' };
    }
    if (movedMatches.length > 1) {
      return { ok: false, reason: 'The dragged Roto key identity is ambiguous.' };
    }
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const intent = Object.freeze({ kind: 'move-key', movedKeyId, target }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'move-key' }>;
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      parentEndExclusive: input.getParentEndExclusive(),
      capacity,
      interpolationEnabled: interpolation.enabled,
      // Phase 43: D-11 rejects single-key ripple drags on linked source keys.
      loopClips: input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
    });
    if (!resolution.ok) {
      return { ok: false, reason: resolution.failure.text || 'The Roto key move is invalid.' };
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // Valid no-change: never publish as a Drag preview or commit (D-09).
      return { ok: false, reason: 'This move would not change the timeline.' };
    }
    const targetSignature = targetSignatureOf(target);
    const proposalVersion = buildProposalVersion(records, interpolation, input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, launch);
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
        intent,
        proposalVersion,
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        movedKeyId,
        targetSignature,
      }) as RotoDragPublication,
    };
  }, [input]);

  const commitRotoKeyDrag = useCallback(async (publication: RotoDragPublication): Promise<boolean> => {
    if (!input.executePhysicalEdit) return false;
    // Wrapper coherence: the proposal must be a move-key whose drag movedKeyId
    // matches the publication's movedKeyId. No resolver or mapping recomputation.
    if (publication.proposal.status.operationKind !== 'move-key' || publication.intent.kind !== 'move-key') return false;
    const drag = publication.proposal.drag;
    if (!drag || drag.movedKeyId !== publication.movedKeyId || publication.intent.movedKeyId !== publication.movedKeyId) return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    return input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-key',
      intent: publication.intent,
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
  }, [input]);

  const prepareRotoKeyGroupDrag = useCallback((grabbedKeyId: string, target: RotoDragTarget): RotoDragPreparationResult => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      return { ok: false, reason: 'Select a real Roto key before editing the timeline.' };
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      return { ok: false, reason: 'Timeline editing is unavailable.' };
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      return { ok: false, reason: 'A Roto physical edit is already in flight.' };
    }
    if (!isBoundedKeyId(grabbedKeyId)) {
      return { ok: false, reason: 'The dragged Roto key identity is malformed.' };
    }
    // Fail-closed selection-set validation (T-37-03-01): the controller port
    // is the only selection source; the strip routes single-key grabs to
    // prepareRotoKeyDrag, so this guard is defense-in-depth — the resolver
    // remains the membership authority.
    const selectedKeyIds = input.getSelectedKeyIds?.() ?? [];
    const seenKeyIds = new Set<string>();
    let selectionSetValid = selectedKeyIds.length >= 2 && selectedKeyIds.includes(grabbedKeyId);
    if (selectionSetValid) {
      for (const keyId of selectedKeyIds) {
        if (!isBoundedKeyId(keyId) || seenKeyIds.has(keyId)) {
          selectionSetValid = false;
          break;
        }
        seenKeyIds.add(keyId);
      }
    }
    if (!selectionSetValid) {
      return { ok: false, reason: 'Select at least two real Roto keys to move as a group.' };
    }
    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const movedMatches = records.filter((record) => record.keyId === grabbedKeyId);
    if (movedMatches.length === 0) {
      return { ok: false, reason: 'The dragged Roto key is no longer available.' };
    }
    if (movedMatches.length > 1) {
      return { ok: false, reason: 'The dragged Roto key identity is ambiguous.' };
    }
    const movedKeyIds = Object.freeze([...selectedKeyIds]) as readonly string[];
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const intent = Object.freeze({
      kind: 'move-key-group',
      movedKeyIds,
      grabbedKeyId,
      target,
    }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'move-key-group' }>;
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      parentEndExclusive: input.getParentEndExclusive(),
      capacity,
      interpolationEnabled: interpolation.enabled,
      // Phase 43: rigid whole-cycle drags carry the original-loop
      // placementStart follow on the proposal (D-04).
      loopClips: input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
    });
    if (!resolution.ok) {
      // Concise UI-SPEC copy plus structured conflicts and full detail; the
      // capsule is NOT published here — during-gesture hovers re-run prepare,
      // and release-reject publication is 37-04's gesture-timing contract.
      const failureCode = resolution.failure.code;
      const reason = failureCode === 'duplicate-destination-frame'
        ? 'Move rejected — key in the way'
        : failureCode === 'over-capacity' || failureCode === 'out-of-range-frame'
          ? 'Move rejected — not enough room'
          : resolution.failure.text || 'The Roto key group move is invalid.';
      return {
        ok: false,
        reason,
        conflictingAppFrames: resolution.failure.conflictingAppFrames,
        detail: resolution.failure.text,
      };
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // Valid no-change: never publish as a Drag preview or commit (D-09).
      return { ok: false, reason: 'This move would not change the timeline.' };
    }
    const targetSignature = targetSignatureOf(target);
    const proposalVersion = buildProposalVersion(records, interpolation, input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, launch);
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
        intent,
        proposalVersion,
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        movedKeyId: grabbedKeyId,
        movedKeyIds,
        targetSignature,
      }) as RotoDragPublication,
    };
  }, [input]);

  const commitRotoKeyGroupDrag = useCallback(async (publication: RotoDragPublication): Promise<boolean> => {
    if (!input.executePhysicalEdit) return false;
    // Wrapper coherence (T-37-03-02): operation kind, grabbed-key match,
    // moved-set shallow equality (length plus index-wise identity), and a
    // non-empty launch tuple. No resolver or mapping recomputation — the
    // exact retained objects pass through (D-09).
    const intent = publication.intent;
    if (publication.proposal.status.operationKind !== 'move-key-group' || intent.kind !== 'move-key-group') return false;
    const drag = publication.proposal.drag;
    if (!drag || drag.movedKeyId !== publication.movedKeyId) return false;
    const movedKeyIds = publication.movedKeyIds;
    if (
      !movedKeyIds
      || movedKeyIds.length !== drag.movedKeyIds.length
      || movedKeyIds.length !== intent.movedKeyIds.length
      || movedKeyIds.some((keyId, index) => keyId !== drag.movedKeyIds[index])
      || movedKeyIds.some((keyId, index) => keyId !== intent.movedKeyIds[index])
      || intent.grabbedKeyId !== publication.movedKeyId
    ) return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    return input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-key-group',
      intent,
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
  }, [input]);

  const prepareRotoGroupDrag = useCallback((loopId: string, destinationPlacementStart: number): RotoGroupDragPreparationResult => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      return { ok: false, reason: mapRotoGroupDragProductReason({ kind: 'disabled', reason: 'Select a real Roto key before editing the timeline.' }) };
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      return { ok: false, reason: mapRotoGroupDragProductReason({ kind: 'disabled', reason: 'Timeline editing is unavailable.' }) };
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      return { ok: false, reason: mapRotoGroupDragProductReason({ kind: 'disabled', reason: 'A Roto physical edit is already in flight.' }) };
    }
    if (!isBoundedKeyId(loopId)) {
      return { ok: false, reason: mapRotoGroupDragProductReason({ kind: 'disabled', reason: 'The dragged Group identity is malformed.' }) };
    }
    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
    const incomingInterpolationBreakKeyIds = input.getIncomingInterpolationBreakKeyIds?.() ?? [];
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const intent = Object.freeze({
      kind: 'move-group',
      loopId,
      destinationPlacementStart,
    }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'move-group' }>;
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      parentEndExclusive: input.getParentEndExclusive(),
      capacity,
      interpolationEnabled: interpolation.enabled,
      loopClips,
      // GDRAG-07 / Pitfall 1: the incoming break collection reaches BOTH the
      // resolver input and the break-aware revision fingerprint below.
      incomingInterpolationBreakKeyIds,
    });
    if (!resolution.ok) {
      // D-06: the zero-space failure code maps to the locked literal copy via
      // the single mapper; the raw resolver text stays in the diagnostic
      // `detail` channel only (T-43.3-03-03).
      return {
        ok: false,
        reason: mapRotoGroupDragProductReason({
          kind: 'rejected',
          failureCode: resolution.failure.code,
          failureText: resolution.failure.text,
        }),
        detail: resolution.failure.text,
      };
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // Valid no-change: never publish as a Drag preview or commit (D-09).
      return { ok: false, reason: mapRotoGroupDragProductReason({ kind: 'disabled', reason: 'This move would not change the timeline.' }) };
    }
    // D-07 {N}: the accepted destination is the moved clip's new placementStart
    // in both the source-attached and duplicated arms.
    const movedClip = proposal.nextLoopClips?.find((candidate) => candidate.loopId === loopId);
    const clampedDestinationPlacementStart = movedClip?.placementStart ?? intent.destinationPlacementStart;
    // D-07 {A}–{B}: the vacated gap is the Group's original half-open interval,
    // reported only when source-attached (a duplicated placement never moves
    // its shared source keys, D-11). Derived from the same canonical range
    // projection the resolver and rail draw.
    const clip = loopClips.find((candidate) => candidate.loopId === loopId);
    const firstSourceFrame = records.find((record) => record.keyId === clip?.sourceKeyIds[0])?.appFrame;
    const attached = clip !== undefined && firstSourceFrame !== undefined && clip.placementStart === firstSourceFrame;
    let vacatedInterval: { phaseOrigin: number; effectiveEnd: number } | null = null;
    if (attached && clip) {
      const derivation = derivePhysicPaintRotoLoopRanges({
        identities: records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        loopClips,
        capacity,
        interpolationEnabled: interpolation.enabled,
      });
      const draggedRanges = derivation.ranges.filter((range) => range.loopId === loopId);
      const phaseOrigin = clip.phaseOrigin ?? clip.placementStart;
      const resolvedEffectiveEnd = resolvePhysicPaintRotoGroupEffectiveEnd(clip, draggedRanges);
      vacatedInterval = { phaseOrigin, effectiveEnd: resolvedEffectiveEnd };
    }
    const proposalVersion = buildGroupDragProposalVersion(records, interpolation, loopClips, incomingInterpolationBreakKeyIds, launch);
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
        intent,
        proposalVersion,
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        loopId,
        clampedDestinationPlacementStart,
        vacatedInterval,
      }) as RotoGroupDragPublication,
    };
  }, [input]);

  const commitRotoGroupDrag = useCallback(async (publication: RotoGroupDragPublication): Promise<boolean> => {
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState) return false;
    // Wrapper coherence (GDRAG-07): operation kind, intent kind, loopId match,
    // and a non-empty launch tuple. No resolver or mapping recomputation — the
    // exact retained objects pass through (D-09).
    const intent = publication.intent;
    if (publication.proposal.status.operationKind !== 'move-group' || intent.kind !== 'move-group') return false;
    if (intent.loopId !== publication.loopId) return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    const currentLaunch = input.getLaunchContext?.() ?? null;
    if (!currentLaunch) return false;
    try {
      const currentProposalVersion = buildGroupDragProposalVersion(
        input.getRotoKeyRecords(),
        input.getRotoInterpolationState(),
        input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
        input.getIncomingInterpolationBreakKeyIds?.() ?? [],
        currentLaunch,
      );
      if (currentProposalVersion !== publication.proposalVersion) return false;
    } catch {
      return false;
    }
    // D-07: publish the accepted destination-plus-gap facts through the single
    // mapper on acceptance — the same .then((accepted) => ...) continuation
    // pattern the strip drag uses, NOT runPhysicalAction (its kind union is a
    // bounded Extract that excludes move-group). Post-commit stability (D-17):
    // the moved Group stays selected and the cursor stays put because the
    // publication's selectedKeyId/selectedAppFrame are forwarded unchanged and
    // no navigation is triggered here.
    const accepted = await input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-group',
      intent,
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
    if (accepted) {
      const mode = input.getRotoLoopClips?.().find((clip) => clip.loopId === publication.loopId)?.mode
        ?? 'progressive';
      input.publishStatus?.(mapRotoGroupDragProductReason({
        kind: 'accepted',
        mode,
        destinationPlacementStart: publication.clampedDestinationPlacementStart,
        vacatedInterval: publication.vacatedInterval,
      }));
    }
    return accepted;
  }, [input]);

  const prepareKeyRailDrag = useCallback((
    firstKeyId: string,
    destinationFirstKeyAppFrame: number,
  ): RotoKeyRailDragPreparationResult => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      return { ok: false, reason: mapRotoKeyRailDragProductReason({ kind: 'disabled', reason: 'Select a real Roto key before editing the timeline.' }) };
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      return { ok: false, reason: mapRotoKeyRailDragProductReason({ kind: 'disabled', reason: 'Timeline editing is unavailable.' }) };
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      return { ok: false, reason: mapRotoKeyRailDragProductReason({ kind: 'disabled', reason: 'A Roto physical edit is already in flight.' }) };
    }
    if (!isBoundedKeyId(firstKeyId)) {
      return { ok: false, reason: mapRotoKeyRailDragProductReason({ kind: 'disabled', reason: 'The dragged Key Rail identity is malformed.' }) };
    }

    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
    const incomingInterpolationBreakKeyIds = input.getIncomingInterpolationBreakKeyIds?.() ?? [];
    const groupOwnedKeyIds = new Set<string>();
    for (const loopClip of loopClips) {
      loopClip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
      (loopClip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
    }
    const orderedRealKeys = [...records]
      .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId))
      .map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const matchingSegments = deriveKeyRailSegments({
      orderedRealKeys,
      incomingInterpolationBreakKeyIds: new Set(incomingInterpolationBreakKeyIds),
      groupOwnedKeyIds,
    }).filter((segment) => segment.firstKeyId === firstKeyId);
    if (matchingSegments.length !== 1) {
      return { ok: false, reason: mapRotoKeyRailDragProductReason({ kind: 'disabled', reason: 'The dragged Key Rail is no longer available.' }) };
    }

    const segment = matchingSegments[0];
    const memberKeyIds = Object.freeze([...segment.keyIds]) as readonly string[];
    const intent = Object.freeze({
      kind: 'move-key-rail',
      memberKeyIds,
      destinationFirstKeyAppFrame,
    }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'move-key-rail' }>;
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: orderedRealKeys,
      intent,
      parentEndExclusive: input.getParentEndExclusive(),
      capacity,
      interpolationEnabled: interpolation.enabled,
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
    if (!resolution.ok) {
      return {
        ok: false,
        reason: mapRotoKeyRailDragProductReason({
          kind: 'rejected',
          failureCode: resolution.failure.code,
          failureText: resolution.failure.text,
        }),
        detail: resolution.failure.text,
      };
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      return { ok: false, reason: 'This move would not change the timeline.' };
    }
    const acceptedDestination = proposal.mapping.get(firstKeyId);
    if (acceptedDestination === undefined) {
      return { ok: false, reason: 'The Key Rail move is invalid.' };
    }
    const delta = acceptedDestination - segment.firstKeyFrame;
    const destinationLastKeyFrame = segment.lastKeyFrame + delta;
    const vacatedStart = delta > 0
      ? segment.firstKeyFrame
      : Math.max(destinationLastKeyFrame + 1, segment.firstKeyFrame);
    const vacatedEnd = delta > 0
      ? Math.min(acceptedDestination, segment.lastKeyFrame + 1)
      : segment.lastKeyFrame + 1;
    const vacatedInterval = vacatedStart < vacatedEnd
      ? Object.freeze({ phaseOrigin: vacatedStart, effectiveEnd: vacatedEnd })
      : null;
    const expectedLaunch = Object.freeze({
      operationId: launch.operationId,
      layerId: launch.layerId,
    });
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
        intent,
        proposalVersion: buildKeyRailDragProposalVersion(
          records,
          interpolation,
          loopClips,
          incomingInterpolationBreakKeyIds,
          launch,
        ),
        expectedLaunch,
        firstKeyId,
        memberKeyIds,
        destinationFirstKeyAppFrame: acceptedDestination,
        vacatedInterval,
      }) as RotoKeyRailDragPublication,
    };
  }, [input]);

  const commitKeyRailDrag = useCallback(async (
    publication: RotoKeyRailDragPublication,
  ): Promise<boolean> => {
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState) return false;
    const intent = publication.intent;
    if (publication.proposal.status.operationKind !== 'move-key-rail' || intent.kind !== 'move-key-rail') return false;
    if (publication.firstKeyId !== publication.memberKeyIds[0]) return false;
    if (
      publication.memberKeyIds.length === 0
      || publication.memberKeyIds.length !== intent.memberKeyIds.length
      || publication.memberKeyIds.some((keyId, index) => keyId !== intent.memberKeyIds[index])
    ) return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    const currentLaunch = input.getLaunchContext?.() ?? null;
    if (!currentLaunch) return false;
    try {
      const currentProposalVersion = buildKeyRailDragProposalVersion(
        input.getRotoKeyRecords(),
        input.getRotoInterpolationState(),
        input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
        input.getIncomingInterpolationBreakKeyIds?.() ?? [],
        currentLaunch,
      );
      if (currentProposalVersion !== publication.proposalVersion) return false;
    } catch {
      return false;
    }
    const accepted = await input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-key-rail',
      intent,
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
    if (accepted) {
      input.publishStatus?.(mapRotoKeyRailDragProductReason({
        kind: 'accepted',
        destinationFirstKeyAppFrame: publication.destinationFirstKeyAppFrame,
        vacatedInterval: publication.vacatedInterval,
      }));
    }
    return accepted;
  }, [input]);

  const prepareRotoPush = useCallback((descriptor: RotoPushIntentDescriptor): RotoPushPreparationResult => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      return { ok: false, reason: mapRotoPushProductReason({ kind: 'disabled', reason: 'Select a real Roto key before editing the timeline.' }) };
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      return { ok: false, reason: mapRotoPushProductReason({ kind: 'disabled', reason: 'Timeline editing is unavailable.' }) };
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      return { ok: false, reason: mapRotoPushProductReason({ kind: 'disabled', reason: 'A Roto physical edit is already in flight.' }) };
    }
    // Identity well-formed: exactly one bounded anchor and a nonnegative delta.
    // Malformed descriptors fail closed here with clean product copy instead of
    // leaking raw resolver diagnostics into the status line.
    const hasAnchorKeyId = descriptor.anchorKeyId !== undefined;
    const hasAnchorLoopId = descriptor.anchorLoopId !== undefined;
    if (hasAnchorKeyId === hasAnchorLoopId) {
      return { ok: false, reason: mapRotoPushProductReason({ kind: 'disabled', reason: 'The push anchor identity is malformed.' }) };
    }
    if ((hasAnchorKeyId && !isBoundedKeyId(descriptor.anchorKeyId)) || (hasAnchorLoopId && !isBoundedKeyId(descriptor.anchorLoopId))) {
      return { ok: false, reason: mapRotoPushProductReason({ kind: 'disabled', reason: 'The push anchor identity is malformed.' }) };
    }
    if (!Number.isSafeInteger(descriptor.deltaFrames) || descriptor.deltaFrames < 0) {
      return { ok: false, reason: mapRotoPushProductReason({ kind: 'disabled', reason: 'The push delta is malformed.' }) };
    }

    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
    const incomingInterpolationBreakKeyIds = input.getIncomingInterpolationBreakKeyIds?.() ?? [];
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const intent = Object.freeze({
      kind: 'push-rails',
      direction: descriptor.direction,
      ...(descriptor.anchorKeyId !== undefined ? { anchorKeyId: descriptor.anchorKeyId } : {}),
      ...(descriptor.anchorLoopId !== undefined ? { anchorLoopId: descriptor.anchorLoopId } : {}),
      deltaFrames: descriptor.deltaFrames,
    }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'push-rails' }>;
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      parentEndExclusive: input.getParentEndExclusive(),
      capacity,
      interpolationEnabled: interpolation.enabled,
      loopClips,
      // Pitfall 3: the incoming break collection reaches BOTH the resolver input
      // and the break-aware proposal fingerprint below.
      incomingInterpolationBreakKeyIds,
    });
    if (!resolution.ok) {
      // D-14/D-16/D-17: straddle, no-space, and empty-anchor map to the locked
      // copy via the single mapper; the raw resolver text stays in `detail`.
      return {
        ok: false,
        reason: mapRotoPushProductReason({
          kind: 'rejected',
          failureCode: resolution.failure.code,
          failureText: resolution.failure.text,
        }),
        detail: resolution.failure.text,
      };
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // D-15: zero-delta push publishes nothing and creates no history entry.
      return { ok: false, reason: 'This move would not change the timeline.' };
    }
    // D-17: presentation facts come from the shared pure set authority — the
    // same export the resolver branch commits with, so movedRailCount and the
    // moved-set bounds always agree with the committed set (preflight and
    // commit can never disagree). Prepare does NO set math itself.
    const facts = deriveRotoPushPresentationFacts({
      descriptor,
      proposal,
      records,
      interpolation,
      loopClips,
      capacity,
      incomingInterpolationBreakKeyIds,
    });
    if (!facts.ok) {
      return {
        ok: false,
        reason: mapRotoPushProductReason({
          kind: 'rejected',
          failureCode: facts.code,
          failureText: facts.text,
        }),
        detail: facts.text,
      };
    }
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
        intent,
        proposalVersion: buildPushProposalVersion(records, interpolation, loopClips, incomingInterpolationBreakKeyIds, launch),
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        movedRailCount: facts.movedRailCount,
        clampedDeltaFrames: facts.clampedDeltaFrames,
        beforeRange: facts.beforeRange,
        afterRange: facts.afterRange,
        gapInterval: facts.gapInterval,
      }) as RotoPushPublication,
    };
  }, [input]);

  const commitRotoPush = useCallback(async (publication: RotoPushPublication): Promise<boolean> => {
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState) return false;
    // Wrapper coherence (T-43.5-01): operation kind, intent kind, and a
    // non-empty launch tuple. No resolver or mapping recomputation — the exact
    // retained objects pass through (D-09).
    const intent = publication.intent;
    if (publication.proposal.status.operationKind !== 'push-rails' || intent.kind !== 'push-rails') return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    const currentLaunch = input.getLaunchContext?.() ?? null;
    if (!currentLaunch) return false;
    try {
      const currentProposalVersion = buildPushProposalVersion(
        input.getRotoKeyRecords(),
        input.getRotoInterpolationState(),
        input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
        input.getIncomingInterpolationBreakKeyIds?.() ?? [],
        currentLaunch,
      );
      if (currentProposalVersion !== publication.proposalVersion) return false;
    } catch {
      return false;
    }
    // Publish the accepted copy through the single mapper from the .then
    // continuation — the same pattern the Group-drag commit uses, NOT
    // runPhysicalAction (its kind union is a bounded Extract that excludes
    // push-rails). Post-commit stability: the deterministic anchor selection
    // and the cursor are forwarded unchanged from the publication.
    const accepted = await input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'push-rails',
      intent,
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
    if (accepted) {
      input.publishStatus?.(mapRotoPushProductReason({
        kind: 'accepted',
        direction: publication.intent.direction,
        movedRailCount: publication.movedRailCount,
        signedDeltaFrames: publication.clampedDeltaFrames,
        afterRange: publication.afterRange,
        gapInterval: publication.gapInterval,
      }));
    }
    return accepted;
  }, [input]);

  const prepareRailSetMove = useCallback((descriptor: RotoRailSetMoveIntentDescriptor): RotoRailSetMovePreparationResult => {
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      return { ok: false, reason: mapRotoRailSetMoveProductReason({ kind: 'disabled', reason: 'Select a real Roto key before editing the timeline.' }) };
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      return { ok: false, reason: mapRotoRailSetMoveProductReason({ kind: 'disabled', reason: 'Timeline editing is unavailable.' }) };
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      return { ok: false, reason: mapRotoRailSetMoveProductReason({ kind: 'disabled', reason: 'A Roto physical edit is already in flight.' }) };
    }
    // Well-formed descriptor: a non-empty members array of bounded member
    // identities and a safe-integer signed delta. Malformed descriptors fail
    // closed here with clean product copy instead of leaking raw resolver
    // diagnostics into the status line.
    if (!Array.isArray(descriptor.members) || descriptor.members.length === 0) {
      return { ok: false, reason: mapRotoRailSetMoveProductReason({ kind: 'disabled', reason: 'The rail set move members are malformed.' }) };
    }
    for (const member of descriptor.members) {
      if (member.kind === 'key-rail') {
        if (!isBoundedKeyId(member.firstKeyId) || !Array.isArray(member.keyIds) || member.keyIds.length === 0) {
          return { ok: false, reason: mapRotoRailSetMoveProductReason({ kind: 'disabled', reason: 'The rail set move members are malformed.' }) };
        }
      } else if (!isBoundedKeyId(member.loopId)) {
        return { ok: false, reason: mapRotoRailSetMoveProductReason({ kind: 'disabled', reason: 'The rail set move members are malformed.' }) };
      }
    }
    if (!Number.isSafeInteger(descriptor.delta)) {
      return { ok: false, reason: mapRotoRailSetMoveProductReason({ kind: 'disabled', reason: 'The rail set move delta is malformed.' }) };
    }

    const records = input.getRotoKeyRecords();
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
    const incomingInterpolationBreakKeyIds = input.getIncomingInterpolationBreakKeyIds?.() ?? [];
    const identities = records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
    const intent = Object.freeze({
      kind: 'move-rails',
      members: Object.freeze(descriptor.members.map((member) => Object.freeze({ ...member }))),
      delta: descriptor.delta,
    }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'move-rails' }>;
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      parentEndExclusive: input.getParentEndExclusive(),
      capacity,
      interpolationEnabled: interpolation.enabled,
      loopClips,
      // Pitfall 3: the incoming break collection reaches BOTH the resolver input
      // and the break-aware proposal fingerprint below.
      incomingInterpolationBreakKeyIds,
    });
    if (!resolution.ok) {
      // D-10/D-17: straddle and no-space map to the locked copy via the single
      // mapper; the raw resolver text stays in `detail`.
      return {
        ok: false,
        reason: mapRotoRailSetMoveProductReason({
          kind: 'rejected',
          failureCode: resolution.failure.code,
          failureText: resolution.failure.text,
        }),
        detail: resolution.failure.text,
      };
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // D-13: a zero-delta (or no-change) move publishes nothing and creates
      // no history entry.
      return { ok: false, reason: 'This move would not change the timeline.' };
    }
    // D-17: presentation facts come from the shared pure set authority — the
    // same export the resolver branch commits with, so movedRailCount and the
    // moved-set bounds always agree with the committed set (preflight and
    // commit can never disagree). Prepare does NO set math itself.
    const facts = deriveRotoRailSetMovePresentationFacts({
      members: descriptor.members,
      proposal,
      records,
      interpolation,
      loopClips,
      capacity,
      incomingInterpolationBreakKeyIds,
    });
    if (!facts.ok) {
      return {
        ok: false,
        reason: mapRotoRailSetMoveProductReason({
          kind: 'rejected',
          failureCode: facts.code,
          failureText: facts.text,
        }),
        detail: facts.text,
      };
    }
    return {
      ok: true,
      publication: Object.freeze({
        proposal,
        intent,
        proposalVersion: buildRailSetMoveProposalVersion(records, interpolation, loopClips, incomingInterpolationBreakKeyIds, launch),
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        movedRailCount: facts.movedRailCount,
        clampedDeltaFrames: facts.clampedDeltaFrames,
        beforeRange: facts.beforeRange,
        afterRange: facts.afterRange,
        gapIntervals: facts.gapIntervals,
      }) as RotoRailSetMovePublication,
    };
  }, [input]);

  const commitRailSetMove = useCallback(async (publication: RotoRailSetMovePublication): Promise<boolean> => {
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState) return false;
    // Wrapper coherence (T-43.6-02): operation kind, intent kind, and a
    // non-empty launch tuple. No resolver or mapping recomputation — the exact
    // retained objects pass through (D-09).
    const intent = publication.intent;
    if (publication.proposal.status.operationKind !== 'move-rails' || intent.kind !== 'move-rails') return false;
    if (publication.expectedLaunch.operationId.length === 0 || publication.expectedLaunch.layerId.length === 0) return false;
    const currentLaunch = input.getLaunchContext?.() ?? null;
    if (!currentLaunch) return false;
    try {
      const currentProposalVersion = buildRailSetMoveProposalVersion(
        input.getRotoKeyRecords(),
        input.getRotoInterpolationState(),
        input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
        input.getIncomingInterpolationBreakKeyIds?.() ?? [],
        currentLaunch,
      );
      if (currentProposalVersion !== publication.proposalVersion) return false;
    } catch {
      return false;
    }
    // Publish the accepted copy through the single mapper from the .then
    // continuation — the same pattern the Group-drag and Push commits use,
    // NOT runPhysicalAction (its kind union is a bounded Extract that excludes
    // move-rails). Post-commit stability: the deterministic anchor selection
    // and the cursor are forwarded unchanged from the publication.
    const accepted = await input.executePhysicalEdit({
      proposal: publication.proposal,
      expectedLaunch: publication.expectedLaunch,
      operationKind: 'move-rails',
      intent,
      selectedKeyId: publication.proposal.selectedKeyId,
      selectedAppFrame: publication.proposal.selectedAppFrame,
    });
    if (accepted) {
      input.publishStatus?.(mapRotoRailSetMoveProductReason({
        kind: 'accepted',
        movedRailCount: publication.movedRailCount,
        signedDeltaFrames: publication.clampedDeltaFrames,
        afterRange: publication.afterRange,
        gapIntervals: publication.gapIntervals,
      }));
    }
    return accepted;
  }, [input]);

  const setForceSpacingInput = useCallback((value: string) => {
    forceSpacingInput.value = value;
  }, [forceSpacingInput]);

  const applyForceSpacing = useCallback(async (): Promise<boolean> => {
    const emptyFrames = parseCanonicalForceSpacing(forceSpacingInput.value);
    if (emptyFrames === null) {
      input.publishStatus?.(INVALID_FORCE_SPACING_MESSAGE);
      return false;
    }
    const launch = input.getLaunchContext?.() ?? null;
    if (!launch) {
      input.publishStatus?.('Select a Physics Paint Roto timeline before applying Force Spacing.');
      return false;
    }
    if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
      input.publishStatus?.('Timeline editing is unavailable.');
      return false;
    }
    if (input.pendingOperationId && input.pendingOperationId.value !== null) {
      input.publishStatus?.('A Roto physical edit is already in flight.');
      return false;
    }

    // Capture one action-time snapshot. The resolver alone validates identity
    // completeness/uniqueness, orders stable keys, anchors the first frame,
    // derives exact interiors, and rejects an over-capacity complete map.
    const records = input.getRotoKeyRecords();
    const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
    const selectedKeyId = input.getSelectedKeyId?.() ?? null;
    const scopeResult = deriveForceSpacingScope({
      records,
      loopClips,
      selectedLoopClipIds: input.getSelectedLoopClipIds?.() ?? [],
      selectedKeyIds: input.getSelectedKeyIds?.() ?? [],
      spacingSelection: input.getRotoSpacingSelection?.() ?? null,
      selectedKeyRail: input.getSelectedKeyRail?.() ?? null,
      railSetMembers: input.getRailSetMembers?.() ?? null,
      incomingInterpolationBreakKeyIds: input.getIncomingInterpolationBreakKeyIds?.(),
    });
    if (!scopeResult.ok) {
      input.publishStatus?.(scopeResult.message);
      return false;
    }
    const { scopeKeyIds, linkedSourceSpacingScopes, railSetMembers } = scopeResult.value;
    const interpolation = input.getRotoInterpolationState();
    const capacity = input.getCapacity();
    const expectedLaunch = {
      operationId: launch.operationId,
      layerId: launch.layerId,
    } as const;
    const identities = records.map((record) => ({
      keyId: record.keyId,
      appFrame: record.appFrame,
    }));

    // 43.6-05 D-24/D-25: an active rail set dispatches the spacing-on-set
    // intent — per-rail fixed anchors, whole-set all-or-nothing validation in
    // the resolver, ONE atomic history command. The set stays selected after
    // acceptance (resolveRailSetPostAcceptance 'spacing-on-set' keeps it).
    if (railSetMembers !== null) {
      const setIntent = Object.freeze({
        kind: 'spacing-on-set',
        members: railSetMembers,
        emptyFrames,
      }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'spacing-on-set' }>;
      const setResolution = resolvePhysicPaintRotoPhysicalEdit({
        identities,
        intent: setIntent,
        parentEndExclusive: input.getParentEndExclusive(),
        capacity,
        interpolationEnabled: interpolation.enabled,
        loopClips,
        // The set branch derives segments from the same break collection, so
        // the resolver must revalidate membership against the identical
        // authority — otherwise a break-split segment fails exact-match.
        incomingInterpolationBreakKeyIds: input.getIncomingInterpolationBreakKeyIds?.(),
      });
      if (!setResolution.ok) {
        input.publishStatus?.(
          `Can't apply Key Spacing to the selected Rails: ${mapSpacingOnSetProductReason(setResolution.failure.code, setResolution.failure.text)}.`,
        );
        input.publishDiagnostic?.('spacing-on-set rejected: ' + setResolution.failure.code + ' — ' + setResolution.failure.text);
        return false;
      }
      const setProposal = setResolution.proposal;
      if (!setProposal.status.changed) {
        // Already-exact spacing ends here without coordinator execution.
        input.publishStatus?.(setProposal.status.text);
        return false;
      }
      const setAccepted = await input.executePhysicalEdit({
        proposal: setProposal,
        expectedLaunch,
        operationKind: 'spacing-on-set',
        intent: setIntent,
        selectedKeyId: setProposal.selectedKeyId,
        selectedAppFrame: setProposal.selectedAppFrame,
      });
      if (setAccepted) {
        input.publishStatus?.(
          railSetMembers.length === 1
            ? 'Key Spacing applied to 1 Rail.'
            : `Key Spacing applied to ${railSetMembers.length} Rails.`,
        );
      }
      return setAccepted;
    }

    const intent = Object.freeze({
      kind: 'force-spacing',
      emptyFrames,
      selectedKeyId,
      scopeKeyIds,
      linkedSourceSpacingScopes,
    }) as Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'force-spacing' }>;
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      parentEndExclusive: input.getParentEndExclusive(),
      capacity,
      interpolationEnabled: interpolation.enabled,
      loopClips,
    });
    if (!resolution.ok) {
      if (scopeKeyIds !== null) {
        const failureCode = resolution.failure.code;
        input.publishStatus?.(
          failureCode === 'duplicate-destination-frame' || failureCode === 'over-capacity'
            ? 'Spacing rejected — not enough room'
            : resolution.failure.text || 'Force Spacing is invalid.',
        );
        input.publishDiagnostic?.('force-spacing rejected: ' + failureCode + ' — ' + resolution.failure.text);
      } else {
        input.publishStatus?.(resolution.failure.text || 'Force Spacing is invalid.');
      }
      return false;
    }
    const proposal = resolution.proposal;
    if (!proposal.status.changed) {
      // Zero-key failures are handled above; one key and already-exact spacing
      // end here without coordinator execution or accepted-history output.
      input.publishStatus?.(proposal.status.text);
      return false;
    }

    // Submit the exact resolver-owned proposal. The generic coordinator owns
    // post-barrier revision validation, staging, settlement, rollback, and the
    // accepted-only history handoff; this action does not recompute the map.
    const accepted = await input.executePhysicalEdit({
      proposal,
      expectedLaunch,
      operationKind: 'force-spacing',
      intent,
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    });
    if (accepted) input.publishStatus?.(proposal.status.text);
    return accepted;
  }, [forceSpacingInput, input]);

  const physicalActions: RotoPhysicalTimelineActionBundle = useMemo(() => ({
    insertRotoFrame,
    canInsertFrame,
    insertDisabledReason,
    insertTooltipDescription,
    deleteRotoFrame,
    canDeleteFrame,
    deleteDisabledReason,
    deleteScopeLabel,
    scissorKeyRail,
    canScissor,
    scissorDisabledReason,
    scissorTooltipDescription,
    pendingOperationId: pendingOperationIdSignal,
    prepareRotoKeyDrag,
    commitRotoKeyDrag,
    prepareRotoKeyGroupDrag,
    commitRotoKeyGroupDrag,
    prepareRotoGroupDrag,
    commitRotoGroupDrag,
    prepareKeyRailDrag,
    commitKeyRailDrag,
    prepareRotoPush,
    commitRotoPush,
    prepareRailSetMove,
    commitRailSetMove,
    canDragKey,
    dragDisabledReason,
    forceSpacingInput,
    setForceSpacingInput,
    applyForceSpacing,
    canApplyForceSpacing,
    forceSpacingDisabledReason,
    canAddEmptyKey,
    addEmptyKeyDisabledReason,
    canSelectAllKeys,
    selectAllKeysDisabledReason,
    copyRailSet,
    canCopyRailSet,
    copyRailSetDisabledReason,
    pasteRailSet,
    canPasteRailSet,
    pasteRailSetDisabledReason,
    duplicateRailSet,
    canDuplicateRailSet,
    duplicateRailSetDisabledReason,
  }), [insertRotoFrame, canInsertFrame, insertDisabledReason, insertTooltipDescription, deleteRotoFrame, canDeleteFrame, deleteDisabledReason, deleteScopeLabel, scissorKeyRail, canScissor, scissorDisabledReason, scissorTooltipDescription, pendingOperationIdSignal, prepareRotoKeyDrag, commitRotoKeyDrag, prepareRotoKeyGroupDrag, commitRotoKeyGroupDrag, prepareRotoGroupDrag, commitRotoGroupDrag, prepareKeyRailDrag, commitKeyRailDrag, prepareRotoPush, commitRotoPush, prepareRailSetMove, commitRailSetMove, canDragKey, dragDisabledReason, forceSpacingInput, setForceSpacingInput, applyForceSpacing, canApplyForceSpacing, forceSpacingDisabledReason, canAddEmptyKey, addEmptyKeyDisabledReason, canSelectAllKeys, selectAllKeysDisabledReason, copyRailSet, canCopyRailSet, copyRailSetDisabledReason, pasteRailSet, canPasteRailSet, pasteRailSetDisabledReason, duplicateRailSet, canDuplicateRailSet, duplicateRailSetDisabledReason]);

  const physicalKeyUtilities: RotoPhysicalKeyUtilityPort = useMemo(() => ({
    duplicateKey,
    pasteKey,
    pasteKeyGroup,
    addEmptyKey,
  }), [duplicateKey, pasteKey, pasteKeyGroup, addEmptyKey]);

  return {
    updateInterpolationSettings,
    physicalActions,
    physicalKeyUtilities,
  };
}

function parseCanonicalForceSpacing(rawValue: string): number | null {
  if (!/^(?:0|[1-9]\d*)$/.test(rawValue)) return null;
  const value = Number(rawValue);
  return Number.isSafeInteger(value) ? value : null;
}

function targetSignatureOf(target: RotoDragTarget): RotoDragTargetSignature {
  if (target.kind === 'physical-cell') {
    return { kind: 'physical-cell', appFrame: target.appFrame, targetKeyId: null };
  }
  return { kind: target.kind, appFrame: null, targetKeyId: target.targetKeyId };
}

function isBoundedKeyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

/**
 * 43.6-05 M5: maps a spacing-on-set resolver failure to the {reason} slot of
 * 'Can't apply Key Spacing to the selected Rails: {reason}.' — the existing
 * force-spacing reason family (duplicate-destination-frame / over-capacity
 * collapse to the not-enough-room voice; other codes carry the resolver text
 * with its trailing period stripped, since the locked copy adds the period).
 */
function mapSpacingOnSetProductReason(code: string, text: string): string {
  if (code === 'duplicate-destination-frame' || code === 'over-capacity') {
    return 'Spacing rejected — not enough room';
  }
  const reason = text.replace(/\.$/, '');
  return reason.length > 0 ? reason : 'Spacing rejected — not enough room';
}

function buildProposalVersion(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  interpolation: PhysicPaintRotoInterpolationState,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  launch: PhysicPaintLaunchContext,
): string {
  const revision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips);
  return `${revision}:${launch.operationId}:${launch.layerId}`;
}

/**
 * Break-aware proposal-version fingerprint for the Group-drag publication
 * (GDRAG-07 / RESEARCH Pitfall 1). Unlike {@link buildProposalVersion}, the
 * incoming interpolation break collection is threaded as the 4th revision
 * parameter so stale break authority produces a different fingerprint and is
 * rejected before mutation. Existing call sites of buildProposalVersion are
 * intentionally untouched (regression boundary).
 */
function buildGroupDragProposalVersion(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  interpolation: PhysicPaintRotoInterpolationState,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  incomingInterpolationBreakKeyIds: readonly string[],
  launch: PhysicPaintLaunchContext,
): string {
  const revision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, incomingInterpolationBreakKeyIds);
  return `${revision}:${launch.operationId}:${launch.layerId}`;
}

/** Break-aware staleness fingerprint dedicated to Key Rail drag publications. */
export function buildKeyRailDragProposalVersion(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  interpolation: PhysicPaintRotoInterpolationState,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  incomingInterpolationBreakKeyIds: readonly string[],
  launch: PhysicPaintLaunchContext,
): string {
  const revision = buildPhysicPaintRotoPhysicalRevision(
    records,
    interpolation,
    loopClips,
    incomingInterpolationBreakKeyIds,
  );
  return `${revision}:${launch.operationId}:${launch.layerId}`;
}

/**
 * Break-aware staleness fingerprint for Push publications (Pitfall 3). Shares
 * the Group-drag fingerprint's exact field set — records, interpolation,
 * loopClips, incomingInterpolationBreakKeyIds, launch — so a concurrent
 * Scissor/break edit invalidates a prepared push at commit (stale ⇒ fail
 * closed, zero mutation).
 */
function buildPushProposalVersion(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  interpolation: PhysicPaintRotoInterpolationState,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  incomingInterpolationBreakKeyIds: readonly string[],
  launch: PhysicPaintLaunchContext,
): string {
  return buildGroupDragProposalVersion(records, interpolation, loopClips, incomingInterpolationBreakKeyIds, launch);
}

/**
 * D-15/D-17 presentation facts for a Push publication: the moved Rail count,
 * the clamped signed delta, and the inclusive product before/after ranges plus
 * the opened-gap interval. The moved Rail count and set bounds come from the
 * shared pure set authority {@link derivePhysicPaintPushSet} — the same export
 * the resolver branch commits with — so prepare's presentation facts and the
 * committed set can never disagree. The clamped delta is read from the proposal
 * changes (every moved key translates identically); a moved set owning no
 * physical keys (duplicated-placement-only, Pitfall 5) falls back to the first
 * moved Group clip's placement delta. Ranges are derived from canonical
 * half-open intervals at presentation time only (43.2 presentation rule).
 */
function deriveRotoPushPresentationFacts(input: {
  readonly descriptor: RotoPushIntentDescriptor;
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly capacity: number;
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}):
  | {
      readonly ok: true;
      readonly movedRailCount: number;
      readonly clampedDeltaFrames: number;
      readonly beforeRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly afterRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly gapInterval: { readonly firstFrame: number; readonly lastFrame: number } | null;
    }
  | { readonly ok: false; readonly code: PhysicPaintRotoPhysicalEditFailureCode; readonly text: string } {
  const identities = input.records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
  const loopRangeContext = derivePhysicPaintRotoLoopRanges({
    identities,
    loopClips: input.loopClips,
    capacity: input.capacity,
    interpolationEnabled: input.interpolation.enabled,
  });
  const setResult = derivePhysicPaintPushSet({
    anchorKeyId: input.descriptor.anchorKeyId,
    anchorLoopId: input.descriptor.anchorLoopId,
    direction: input.descriptor.direction,
    identities,
    loopRanges: loopRangeContext.ranges,
    loopClips: input.loopClips,
    incomingInterpolationBreakKeyIds: input.incomingInterpolationBreakKeyIds,
  });
  if (!setResult.ok) return { ok: false, code: setResult.code, text: setResult.text };
  const { movedRails, movedSetBounds } = setResult;
  const movedRailCount = movedRails.length;
  const { firstFrame, lastEndExclusive } = movedSetBounds;

  let clampedDeltaFrames = 0;
  const movedChange = input.proposal.changes.find((change) => change.role === 'moved');
  if (movedChange !== undefined) {
    clampedDeltaFrames = movedChange.afterAppFrame - movedChange.beforeAppFrame;
  } else {
    const movedGroupClips = movedRails.flatMap((rail) => (
      rail.kind === 'group' && rail.clip !== undefined ? [rail.clip] : []
    ));
    const firstMovedClip = movedGroupClips[0];
    if (firstMovedClip !== undefined) {
      const nextMovedClip = input.proposal.nextLoopClips?.find((clip) => clip.loopId === firstMovedClip.loopId);
      if (nextMovedClip !== undefined) {
        clampedDeltaFrames = nextMovedClip.placementStart - firstMovedClip.placementStart;
      }
    }
  }

  const beforeRange = Object.freeze({ firstFrame, lastFrame: lastEndExclusive - 1 });
  const afterRange = Object.freeze({
    firstFrame: firstFrame + clampedDeltaFrames,
    lastFrame: lastEndExclusive - 1 + clampedDeltaFrames,
  });
  let gapInterval: { readonly firstFrame: number; readonly lastFrame: number } | null = null;
  if (clampedDeltaFrames > 0) {
    gapInterval = Object.freeze({ firstFrame, lastFrame: firstFrame + clampedDeltaFrames - 1 });
  } else if (clampedDeltaFrames < 0) {
    gapInterval = Object.freeze({
      firstFrame: lastEndExclusive + clampedDeltaFrames,
      lastFrame: lastEndExclusive - 1,
    });
  }
  return { ok: true, movedRailCount, clampedDeltaFrames, beforeRange, afterRange, gapInterval };
}

/**
 * Break-aware staleness fingerprint for batch Move publications (Pitfall 3).
 * Shares the Group-drag fingerprint's exact field set — records,
 * interpolation, loopClips, incomingInterpolationBreakKeyIds, launch — so a
 * concurrent Scissor/break edit invalidates a prepared move at commit
 * (stale ⇒ fail closed, zero mutation, T-43.6-02).
 */
function buildRailSetMoveProposalVersion(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  interpolation: PhysicPaintRotoInterpolationState,
  loopClips: readonly PhysicPaintRotoLoopClip[],
  incomingInterpolationBreakKeyIds: readonly string[],
  launch: PhysicPaintLaunchContext,
): string {
  return buildGroupDragProposalVersion(records, interpolation, loopClips, incomingInterpolationBreakKeyIds, launch);
}

/**
 * D-09/D-17 presentation facts for a batch Move publication: the moved Rail
 * count, the clamped signed delta, and the inclusive product before/after
 * ranges plus the would-open gap intervals. The moved Rail count and set
 * bounds come from the shared pure set authority
 * {@link derivePhysicPaintRailSetMove} — the same export the resolver branch
 * commits with — so prepare's presentation facts and the committed set can
 * never disagree. The clamped delta is read from the proposal changes (every
 * moved key translates identically); a moved set owning no physical keys
 * (duplicated-placement-only, D-11) falls back to the first moved Group
 * clip's placement delta. Ranges are derived from canonical half-open
 * intervals at presentation time only (43.2 presentation rule). Gap
 * intervals are the half-open vacated set-edge intervals, present ONLY when a
 * gap actually opens — a non-zero delta AND at least one moved physical key
 * (duplicated-placement-only sets open no gap: their source keys stay).
 */
function deriveRotoRailSetMovePresentationFacts(input: {
  readonly members: readonly PhysicPaintRailSetMoveMember[];
  readonly proposal: PhysicPaintRotoPhysicalEditProposal;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly capacity: number;
  readonly incomingInterpolationBreakKeyIds: readonly string[];
}):
  | {
      readonly ok: true;
      readonly movedRailCount: number;
      readonly clampedDeltaFrames: number;
      readonly beforeRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly afterRange: { readonly firstFrame: number; readonly lastFrame: number };
      readonly gapIntervals: readonly RailSetDragGapInterval[];
    }
  | { readonly ok: false; readonly code: PhysicPaintRotoPhysicalEditFailureCode; readonly text: string } {
  const identities = input.records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
  const loopRangeContext = derivePhysicPaintRotoLoopRanges({
    identities,
    loopClips: input.loopClips,
    capacity: input.capacity,
    interpolationEnabled: input.interpolation.enabled,
  });
  const setResult = derivePhysicPaintRailSetMove({
    members: input.members,
    identities,
    loopRanges: loopRangeContext.ranges,
    loopClips: input.loopClips,
    incomingInterpolationBreakKeyIds: input.incomingInterpolationBreakKeyIds,
  });
  if (!setResult.ok) return { ok: false, code: setResult.code, text: setResult.text };
  const movedRailCount = setResult.members.length;
  const { firstFrame, lastEndExclusive } = setResult.movedSetBounds;

  let clampedDeltaFrames = 0;
  const movedChange = input.proposal.changes.find((change) => change.role === 'moved');
  if (movedChange !== undefined) {
    clampedDeltaFrames = movedChange.afterAppFrame - movedChange.beforeAppFrame;
  } else {
    const movedGroupClips = input.loopClips.filter((clip) => (
      input.members.some((member) => member.kind === 'loop' && member.loopId === clip.loopId)
    ));
    const firstMovedClip = movedGroupClips[0];
    if (firstMovedClip !== undefined) {
      const nextMovedClip = input.proposal.nextLoopClips?.find((clip) => clip.loopId === firstMovedClip.loopId);
      if (nextMovedClip !== undefined) {
        clampedDeltaFrames = nextMovedClip.placementStart - firstMovedClip.placementStart;
      }
    }
  }

  const beforeRange = Object.freeze({ firstFrame, lastFrame: lastEndExclusive - 1 });
  const afterRange = Object.freeze({
    firstFrame: firstFrame + clampedDeltaFrames,
    lastFrame: lastEndExclusive - 1 + clampedDeltaFrames,
  });
  let gapIntervals: readonly RailSetDragGapInterval[] = Object.freeze([]);
  if (clampedDeltaFrames !== 0 && setResult.movedKeyIds.size > 0) {
    if (clampedDeltaFrames > 0) {
      gapIntervals = Object.freeze([Object.freeze({ start: firstFrame, end: firstFrame + clampedDeltaFrames })]);
    } else {
      gapIntervals = Object.freeze([Object.freeze({ start: lastEndExclusive + clampedDeltaFrames, end: lastEndExclusive })]);
    }
  }
  return { ok: true, movedRailCount, clampedDeltaFrames, beforeRange, afterRange, gapIntervals };
}

interface ActionAvailability {
  readonly eligible: boolean;
  readonly reason: string | null;
}

function readRotoInsertTargetInput(input: RotoTimelineActionsInput): RotoInsertTargetClassificationInput {
  const currentAppFrame = input.getCurrentAppFrame?.() ?? null;
  const capacity = input.getCapacity?.() ?? null;
  const records = input.getRotoKeyRecords?.() ?? [];
  const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  let frameResolution: PhysicPaintRotoFrameResolution | null = null;
  if (currentAppFrame !== null) {
    frameResolution = input.getFrameResolution?.(currentAppFrame) ?? null;
    if (frameResolution === null && capacity !== null && loopClips.length > 0) {
      frameResolution = resolvePhysicPaintRotoLoopFrame(derivePhysicPaintRotoLoopRanges({
        identities: records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        loopClips,
        capacity,
        interpolationEnabled: input.getRotoInterpolationState?.().enabled ?? false,
      }), currentAppFrame);
    }
  }
  return {
    launchReady: (input.getLaunchContext?.() ?? null) !== null,
    pendingOperationId: input.pendingOperationId?.value ?? null,
    selectedKeyId: input.getSelectedKeyId?.() ?? null,
    currentAppFrame,
    capacity,
    records,
    physicalCells: input.getPhysicalCells?.() ?? [],
    frameResolution,
  };
}

function mapRotoInsertFailureTarget(
  failure: PhysicPaintRotoPhysicalEditFailure,
  input: RotoTimelineActionsInput,
): RotoInsertTarget {
  const currentAppFrame = input.getCurrentAppFrame?.() ?? -1;
  if (failure.code === 'duplicate-destination-frame') {
    return { kind: 'occupied-empty-intent', appFrame: currentAppFrame };
  }
  if (failure.code === 'out-of-range-frame' || failure.code === 'over-capacity') {
    return { kind: 'out-of-capacity', appFrame: currentAppFrame };
  }
  return classifyRotoInsertTarget(readRotoInsertTargetInput(input));
}

function readRotoDeleteTargetInput(input: RotoTimelineActionsInput): RotoDeleteTargetClassificationInput {
  return {
    launchReady: (input.getLaunchContext?.() ?? null) !== null,
    pendingOperationId: input.pendingOperationId?.value ?? null,
    selectedKeyId: input.getSelectedKeyId?.() ?? null,
    selectedKeyIds: input.getSelectedKeyIds?.() ?? [],
    selectedKeyRail: input.getSelectedKeyRail?.() ?? null,
    selectedLoopClipIds: input.getSelectedLoopClipIds?.() ?? [],
    railSetMembers: input.getRailSetMembers?.() ?? [],
    currentAppFrame: input.getCurrentAppFrame?.() ?? null,
    capacity: input.getCapacity?.() ?? null,
    records: input.getRotoKeyRecords?.() ?? [],
    loopClips: input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
    interpolation: input.getRotoInterpolationState?.() ?? { enabled: false, mode: 'duplicate' },
    incomingInterpolationBreakKeyIds: input.getIncomingInterpolationBreakKeyIds?.() ?? [],
    physicalCells: input.getPhysicalCells?.() ?? [],
  };
}

function readRotoScissorTargetInput(input: RotoTimelineActionsInput): RotoScissorTargetClassificationInput {
  const currentAppFrame = input.getCurrentAppFrame?.() ?? null;
  const capacity = input.getCapacity?.() ?? null;
  const records = input.getRotoKeyRecords?.() ?? [];
  const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  let frameResolution: PhysicPaintRotoFrameResolution | null = null;
  if (currentAppFrame !== null) {
    frameResolution = input.getFrameResolution?.(currentAppFrame) ?? null;
    if (frameResolution === null && capacity !== null && loopClips.length > 0) {
      frameResolution = resolvePhysicPaintRotoLoopFrame(derivePhysicPaintRotoLoopRanges({
        identities: records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        loopClips,
        capacity,
        interpolationEnabled: input.getRotoInterpolationState?.().enabled ?? false,
      }), currentAppFrame);
    }
  }
  return {
    launchReady: (input.getLaunchContext?.() ?? null) !== null,
    pendingOperationId: input.pendingOperationId?.value ?? null,
    selectedKeyId: input.getSelectedKeyId?.() ?? null,
    selectedLoopClipIds: input.getSelectedLoopClipIds?.() ?? [],
    currentAppFrame,
    capacity,
    records,
    loopClips,
    physicalCells: input.getPhysicalCells?.() ?? [],
    frameResolution,
    incomingInterpolationBreakKeyIds: input.getIncomingInterpolationBreakKeyIds?.() ?? [],
  };
}

function computeDragAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a real Roto key before editing the timeline.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  const selectedKeyId = input.getSelectedKeyId?.() ?? null;
  if (!selectedKeyId) {
    return { eligible: false, reason: 'Select a real Roto key to drag.' };
  }
  const records = input.getRotoKeyRecords?.() ?? [];
  const selectedRecord = records.find((record) => record.keyId === selectedKeyId);
  if (!selectedRecord) {
    return { eligible: false, reason: 'The selected Roto key is no longer available.' };
  }
  return { eligible: true, reason: null };
}

function computeAddEmptyKeyAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a Physics Paint Roto timeline before adding a key.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  const currentAppFrame = input.getCurrentAppFrame?.() ?? null;
  if (currentAppFrame === null || !Number.isInteger(currentAppFrame) || currentAppFrame < 0) {
    return { eligible: false, reason: 'Select a valid Roto frame before adding a key.' };
  }
  const records = input.getRotoKeyRecords?.() ?? [];
  if (records.some((record) => record.appFrame === currentAppFrame)) {
    return { eligible: false, reason: 'The current frame already has a real Roto key.' };
  }
  return { eligible: true, reason: null };
}

function computeSelectAllKeysAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a Physics Paint Roto timeline before selecting keys.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  if ((input.getRotoKeyRecords?.() ?? []).length === 0) {
    return { eligible: false, reason: 'No real Roto keys to select.' };
  }
  // Select All is idempotent: eligible even when every key is already selected.
  return { eligible: true, reason: null };
}

/**
 * 43.6-08 copy/paste availability (quick 260820-bjw). Copy requires an active
 * non-empty session rail-set selection plus a clipboard writer; paste/duplicate
 * require a stored rail-set payload plus the acknowledged paste seam. Paste at
 * the cursor additionally requires a valid current frame.
 */
function computeRailSetCopyAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a Physics Paint Roto timeline before copying Rails.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  if (!input.setRailSetClipboard || !input.getRotoKeyRecords) {
    return { eligible: false, reason: 'Rail set copying is unavailable.' };
  }
  const members = input.getRailSetMembers?.() ?? [];
  if (members.length === 0) {
    return { eligible: false, reason: 'Select the Rails to copy.' };
  }
  if (!members.every(isBoundedRailSetIdentity) || new Set(members.map(railSetIdentityKey)).size !== members.length) {
    return { eligible: false, reason: 'Rail set selection is stale. Select the Rails again.' };
  }
  return { eligible: true, reason: null };
}

function computeRailSetPasteAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a Physics Paint Roto timeline before pasting Rails.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  if (!input.executeRailSetPaste) {
    return { eligible: false, reason: 'Rail set pasting is unavailable.' };
  }
  if (!input.getRailSetClipboard || !input.getRailSetClipboard()) {
    return { eligible: false, reason: 'Copy a rail set before pasting.' };
  }
  return { eligible: true, reason: null };
}

/**
 * Rail-set Duplicate availability (quick 260820-bjw UAT-2). Derives from the
 * EFFECTIVE rail set scope (the same dynamic classifier as Copy/Delete), NOT the
 * clipboard. A single selected rail is a set of one (43.6 Solo), so any non-empty
 * `getRailSetMembers()` makes Duplicate eligible — no Copy required first, and a
 * stale clipboard can never gate or target a Duplicate.
 */
function computeRailSetDuplicateAvailability(input: RotoTimelineActionsInput): ActionAvailability {
  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a Physics Paint Roto timeline before duplicating Rails.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  if (!input.executeRailSetPaste) {
    return { eligible: false, reason: 'Rail set duplicating is unavailable.' };
  }
  if (!input.getRailSetMembers || input.getRailSetMembers().length === 0) {
    return { eligible: false, reason: 'Select the Rails to duplicate.' };
  }
  return { eligible: true, reason: null };
}

function buildRailSetCopyDocument(input: RotoTimelineActionsInput): PhysicPaintRotoPhysicalDocument | null {
  const capacity = input.getCapacity?.() ?? null;
  if (capacity === null) return null;
  const records = input.getRotoKeyRecords?.() ?? [];
  const loopClips = input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  const interpolation = input.getRotoInterpolationState?.() ?? { enabled: false, mode: 'duplicate' };
  const incomingInterpolationBreakKeyIds = input.getIncomingInterpolationBreakKeyIds?.() ?? [];
  try {
    return parsePhysicPaintRotoPhysicalDocument({
      capacity,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: PHYSIC_PAINT_ROTO_SCRIPT_MOTION_ZERO,
      background: null,
      selectedKeyId: input.getSelectedKeyId?.() ?? null,
      cursorAppFrame: input.getCurrentAppFrame?.() ?? 0,
      revision: buildPhysicPaintRotoPhysicalRevision(
        records,
        interpolation,
        loopClips,
        incomingInterpolationBreakKeyIds,
      ),
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
  } catch {
    return null;
  }
}

function computeForceSpacingAvailability(input: RotoTimelineActionsInput): ActionAvailability {  if (!input.getLaunchContext || !input.getLaunchContext()) {
    return { eligible: false, reason: 'Select a Physics Paint Roto timeline before applying Force Spacing.' };
  }
  if (!input.executePhysicalEdit || !input.getRotoKeyRecords || !input.getRotoInterpolationState || !input.getCapacity) {
    return { eligible: false, reason: 'Timeline editing is unavailable.' };
  }
  if (input.pendingOperationId && input.pendingOperationId.value !== null) {
    return { eligible: false, reason: 'A Roto physical edit is already in flight.' };
  }
  return { eligible: true, reason: null };
}

function toPhysicPaintRotoInterpolationSettings(settings: RotoSourceDisplayModel['settings']): PhysicPaintRotoInterpolationSettings {
  return {
    enabled: settings.enabled === true,
    inBetweenCount: settings.inBetweenCount ?? 1,
    mode: settings.mode === 'blend' ? 'blend' : 'duplicate',
    deform: settings.deform ?? 0,
    position: settings.position ?? 0,
    ...(settings.segmentSpacingOverrides ? { segmentSpacingOverrides: settings.segmentSpacingOverrides.map((override) => ({ ...override })) } : {}),
  };
}