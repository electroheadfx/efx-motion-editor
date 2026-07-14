import type { PhysicPaintApplyPayload, PhysicPaintApplyResult } from '../../../types/physicPaint';

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
