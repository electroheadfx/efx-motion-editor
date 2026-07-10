import type { PhysicPaintApplyPayload, PhysicPaintApplyResult } from '../../types/physicPaint';

export type PendingPhysicPaintApply = Pick<PhysicPaintApplyPayload, 'operationId' | 'kind' | 'startFrame'>;

export interface RotoApplyLifecycleSnapshot {
  activeOperationId: string | null;
  pendingApply: PendingPhysicPaintApply | null;
  saveOnLeaveSourceFrame: number | null;
  closeAfterApplyOperationId: string | null;
  closeAfterRotoSaveRequested: boolean;
}

export type RotoApplyResultTransition =
  | { type: 'ignore' }
  | { type: 'mismatch'; message: string }
  | {
    type: 'accepted';
    ok: boolean;
    shouldCloseAfterSave: boolean;
    saveOnLeaveSourceFrame: number | null;
    message: string | null;
    detail: PhysicPaintApplyResult;
  };

export interface RotoApplyTimeoutTransition {
  message: string;
  saveOnLeaveSourceFrame: number | null;
  closeFailed: boolean;
  closeMessage: string | null;
}

const MISMATCHED_RESULT_MESSAGE = 'Ignored mismatched physics paint apply result. Try saving again.';
const GENERIC_APPLY_FAILURE_MESSAGE = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';

export function createPendingPhysicPaintApply(payload: PhysicPaintApplyPayload): PendingPhysicPaintApply {
  return {
    operationId: payload.operationId,
    kind: payload.kind,
    startFrame: payload.startFrame,
  };
}

export function getRotoSaveFailureMessage(saveOnLeaveSourceFrame: number | null): string {
  return saveOnLeaveSourceFrame !== null
    ? `Could not save frame ${saveOnLeaveSourceFrame}. Stay on this frame and try navigating again to retry.`
    : GENERIC_APPLY_FAILURE_MESSAGE;
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
  const shouldCloseAfterSave = snapshot.closeAfterApplyOperationId === detail.operationId
    || (snapshot.closeAfterRotoSaveRequested && pendingApply.operationId === detail.operationId);
  const message = detail.ok
    ? null
    : getRotoSaveFailureMessage(snapshot.saveOnLeaveSourceFrame);
  return {
    type: 'accepted',
    ok: detail.ok,
    shouldCloseAfterSave,
    saveOnLeaveSourceFrame: snapshot.saveOnLeaveSourceFrame,
    message,
    detail,
  };
}

export function transitionRotoApplyTimeout(
  snapshot: RotoApplyLifecycleSnapshot,
  operationId: string,
): RotoApplyTimeoutTransition | null {
  if (snapshot.activeOperationId !== operationId) return null;
  const closeFailed = snapshot.closeAfterApplyOperationId === operationId;
  return {
    message: getRotoSaveFailureMessage(snapshot.saveOnLeaveSourceFrame),
    saveOnLeaveSourceFrame: snapshot.saveOnLeaveSourceFrame,
    closeFailed,
    closeMessage: closeFailed
      ? 'Could not save before closing. The main editor did not return an apply result.'
      : null,
  };
}
