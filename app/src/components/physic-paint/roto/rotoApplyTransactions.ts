import type { PhysicPaintApplyPayload, PhysicPaintApplyResult } from '../../../types/physicPaint';
import type {
  PhysicPaintRotoPhysicalEditApplyPayload,
  PhysicPaintRotoPhysicalEditApplyResult,
  PhysicPaintRotoPhysicalEditOperationKind,
} from '../../../types/physicPaint';

export type PendingPhysicPaintApply = Pick<PhysicPaintApplyPayload, 'operationId' | 'kind' | 'startFrame'>;

export interface RotoApplyLifecycleSnapshot {
  activeOperationId: string | null;
  pendingApply: PendingPhysicPaintApply | null;
}

export type RotoApplyResultTransition =
  | { type: 'ignore' }
  | { type: 'mismatch'; message: string }
  | {
    type: 'accepted';
    ok: boolean;
    message: string | null;
    detail: PhysicPaintApplyResult;
  };

export interface RotoApplyTimeoutTransition {
  message: string;
}

const MISMATCHED_RESULT_MESSAGE = 'Ignored mismatched physics paint apply result. Try the action again.';
const GENERIC_APPLY_FAILURE_MESSAGE = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';

export function createPendingPhysicPaintApply(payload: PhysicPaintApplyPayload): PendingPhysicPaintApply {
  return {
    operationId: payload.operationId,
    kind: payload.kind,
    startFrame: payload.startFrame,
  };
}

export function transitionRotoApplyResult(
  snapshot: RotoApplyLifecycleSnapshot,
  detail: PhysicPaintApplyResult | null | undefined,
): RotoApplyResultTransition {
  if (!detail || detail.operationId !== snapshot.activeOperationId) return { type: 'ignore' };
  const pendingApply = snapshot.pendingApply;
  if (!pendingApply || detail.kind !== pendingApply.kind || detail.startFrame !== pendingApply.startFrame) {
    return { type: 'mismatch', message: MISMATCHED_RESULT_MESSAGE };
  }
  return {
    type: 'accepted',
    ok: detail.ok,
    message: detail.ok ? null : GENERIC_APPLY_FAILURE_MESSAGE,
    detail,
  };
}

export function transitionRotoApplyTimeout(
  snapshot: RotoApplyLifecycleSnapshot,
  operationId: string,
): RotoApplyTimeoutTransition | null {
  if (snapshot.activeOperationId !== operationId) return null;
  return { message: GENERIC_APPLY_FAILURE_MESSAGE };
}

// ---------------------------------------------------------------------------
// Generic acknowledged physical-edit pending record, outcome, and transition
// interfaces (Plan 36.14-04 Task 1).
//
// These interfaces are INACTIVE additions: they are NOT imported by
// `useRotoApplyLifecycle` or any live consumer in Task 1. The current move
// settlement (`RotoMoveSettlementRecord` in `useRotoApplyLifecycle`) remains
// the only live pending record. Plan 36.14-04 Task 3 rewires every consumer
// to these generic transitions and removes the move-era settlement record
// in the same atomic cutover.
//
// Per D-09: the pending tuple includes operation ID, operation kind, layer,
// launch operation, project context, expected revision, and staged revision.
// Exact matching accepts only all tuple members; unknown/stale results
// ignore, an active operation with another mismatched tuple member returns
// a diagnostic mismatch without clearing pending ownership, and a matching
// terminal result can settle once. Timeout, transport failure, launch
// replacement, and disposal are modeled in the same generic outcome family.
// ---------------------------------------------------------------------------

/**
 * Immutable pending physical-edit settlement record. The pending tuple is
 * the complete set of identity members the parent echoes back on
 * acknowledgement; any mismatch means the result is not for this operation.
 *
 * Members:
 * - `operationId`: bounded unique operation ID allocated by the coordinator;
 * - `operationKind`: the generic physical-edit operation kind (insert-slot,
 *   delete-key, move-key, force-spacing);
 * - `layerId`: the affected Physics Paint layer;
 * - `launchOperationId`: the launch context identity at dispatch time;
 * - `projectContextId`: the project context identity at dispatch time
 *   (optional but echoed back when present);
 * - `expectedRevision`: the parent-confirmed authoritative revision the
 *   coordinator used for its pre-stage revalidation;
 * - `stagedRevision`: the deterministic content revision computed from the
 *   staged immutable complete records plus enabled interpolation state.
 */
export interface PendingPhysicPaintRotoPhysicalEdit {
  readonly operationId: string;
  readonly operationKind: PhysicPaintRotoPhysicalEditOperationKind;
  readonly layerId: string;
  readonly startFrame: number;
  readonly launchOperationId: string;
  readonly projectContextId: string | null;
  readonly expectedRevision: string;
  readonly stagedRevision: string;
}

/**
 * Generic physical-edit settlement outcome family. Per D-09/D-10: every
 * unsuccessful terminal path restores the complete immutable snapshot once
 * and clears resources once. The accepted outcome exposes immutable
 * before/after output for later history/status consumers (Plan 36.14-05).
 */
export type PhysicPaintRotoPhysicalEditOutcome =
  | {
    readonly type: 'accepted';
    readonly detail: PhysicPaintRotoPhysicalEditApplyResult;
    readonly acceptedRevision: string;
  }
  | {
    readonly type: 'failed';
    readonly reason: 'transport' | 'parent-rejection' | 'timeout' | 'settlement-mismatch' | 'exception';
    readonly detail?: PhysicPaintRotoPhysicalEditApplyResult;
    readonly error?: unknown;
  }
  | {
    readonly type: 'cancelled';
    readonly reason: 'launch-replacement' | 'disposal';
  };

/**
 * Generic physical-edit result transition. Mirrors the move-era
 * `RotoApplyResultTransition` shape but matches against the complete pending
 * tuple (operation ID + kind + layer + launch + project + expectedRevision)
 * instead of only operation ID + kind + startFrame.
 */
export type PhysicPaintRotoPhysicalEditResultTransition =
  | { readonly type: 'ignore' }
  | { readonly type: 'mismatch'; readonly message: string }
  | {
    readonly type: 'accepted';
    readonly ok: boolean;
    readonly message: string | null;
    readonly detail: PhysicPaintRotoPhysicalEditApplyResult;
  };

/**
 * Generic physical-edit timeout transition.
 */
export interface PhysicPaintRotoPhysicalEditTimeoutTransition {
  readonly message: string;
}

const PHYSICAL_EDIT_MISMATCH_MESSAGE = 'Ignored mismatched physics paint physical edit result. Try the action again.';
const PHYSICAL_EDIT_GENERIC_FAILURE_MESSAGE = 'Apply failed — see LOG';

/**
 * Create a pending physical-edit settlement record from a validated apply
 * payload and the staged revision computed from the payload's complete
 * records. The expected revision is supplied by the caller (the coordinator
 * revalidates against the parent-confirmed authoritative revision).
 */
export function createPendingPhysicPaintRotoPhysicalEdit(
  payload: PhysicPaintRotoPhysicalEditApplyPayload,
  stagedRevision: string,
): PendingPhysicPaintRotoPhysicalEdit {
  return {
    operationId: payload.operationId,
    operationKind: payload.operationKind,
    layerId: payload.layerId,
    startFrame: payload.startFrame,
    launchOperationId: payload.launchOperationId,
    projectContextId: payload.projectContextId ?? null,
    expectedRevision: payload.expectedRevision,
    stagedRevision,
  };
}

/**
 * Transition a generic physical-edit apply result against the pending
 * settlement record.
 *
 * Per D-09:
 * - unknown/stale results (operation ID mismatch) ignore without changing
 *   pending ownership, timer, local state, or user success status;
 * - an active operation with another mismatched tuple member (kind, layer,
 *   launch, project, expectedRevision) returns a diagnostic mismatch
 *   without clearing pending ownership;
 * - a matching terminal result settles once and clears resources once.
 *
 * The staged-revision revalidation is owned by the coordinator (Task 2);
 * this transition only classifies the parent-returned result against the
 * pending tuple.
 */
export function transitionPhysicPaintRotoPhysicalEditResult(
  pending: PendingPhysicPaintRotoPhysicalEdit | null,
  detail: PhysicPaintRotoPhysicalEditApplyResult | null | undefined,
): PhysicPaintRotoPhysicalEditResultTransition {
  if (!detail || !pending) return { type: 'ignore' };
  if (detail.operationId !== pending.operationId) return { type: 'ignore' };
  if (
    detail.kind !== 'replace-roto-physical-map'
    || detail.operationKind !== pending.operationKind
    || detail.layerId !== pending.layerId
    || detail.startFrame !== pending.startFrame
    || detail.launchOperationId !== pending.launchOperationId
    || (pending.projectContextId === null ? detail.projectContextId !== undefined : detail.projectContextId !== pending.projectContextId)
    || detail.expectedRevision !== pending.expectedRevision
  ) {
    return { type: 'mismatch', message: PHYSICAL_EDIT_MISMATCH_MESSAGE };
  }
  return {
    type: 'accepted',
    ok: detail.ok,
    message: detail.ok ? null : PHYSICAL_EDIT_GENERIC_FAILURE_MESSAGE,
    detail,
  };
}

/**
 * Transition a generic physical-edit timeout against the pending record.
 * Returns null when the timeout does not match the pending operation ID;
 * otherwise returns the concise failure message.
 */
export function transitionPhysicPaintRotoPhysicalEditTimeout(
  pending: PendingPhysicPaintRotoPhysicalEdit | null,
  operationId: string,
): PhysicPaintRotoPhysicalEditTimeoutTransition | null {
  if (!pending || pending.operationId !== operationId) return null;
  return { message: PHYSICAL_EDIT_GENERIC_FAILURE_MESSAGE };
}