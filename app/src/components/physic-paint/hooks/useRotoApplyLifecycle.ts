import { useCallback, useEffect, useRef } from 'preact/hooks';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult } from '../../../types/physicPaint';
import {
  createPendingPhysicPaintApply,
  transitionRotoApplyResult,
  transitionRotoApplyTimeout,
  type PendingPhysicPaintApply,
  type RotoApplyResultTransition,
} from '../roto/rotoApplyTransactions';

interface RotoApplyLifecycleInput {
  onTimeout: (transition: NonNullable<ReturnType<typeof transitionRotoApplyTimeout>>) => void;
}

export type RotoMoveSettlementOutcome =
  | { type: 'accepted'; detail: PhysicPaintApplyResult }
  | { type: 'failed'; reason: 'transport' | 'parent-rejection' | 'timeout'; detail?: PhysicPaintApplyResult; error?: unknown }
  | { type: 'cancelled'; reason: 'launch-replacement' | 'disposal' };

interface RotoMoveSettlementRecord {
  operationId: string;
  kind: 'replace-roto-key-frames';
  layerId: string;
  startFrame: number;
  settle: (outcome: RotoMoveSettlementOutcome) => void;
}

export function useRotoApplyLifecycle(input: RotoApplyLifecycleInput) {
  const activeOperationIdRef = useRef<string | null>(null);
  const pendingApplyRef = useRef<PendingPhysicPaintApply | null>(null);
  const applyTimeoutRef = useRef<number | null>(null);
  const moveSettlementRef = useRef<RotoMoveSettlementRecord | null>(null);

  const getSnapshot = useCallback(() => ({
    activeOperationId: activeOperationIdRef.current,
    pendingApply: pendingApplyRef.current,
  }), []);

  const clearApplyTimeout = useCallback(() => {
    if (applyTimeoutRef.current === null) return;
    window.clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = null;
  }, []);

  const clearActiveApply = useCallback(() => {
    clearApplyTimeout();
    activeOperationIdRef.current = null;
    pendingApplyRef.current = null;
  }, [clearApplyTimeout]);

  const settleMove = useCallback((operationId: string, outcome: RotoMoveSettlementOutcome): boolean => {
    const record = moveSettlementRef.current;
    if (!record || record.operationId !== operationId) return false;
    clearApplyTimeout();
    if (activeOperationIdRef.current === operationId) activeOperationIdRef.current = null;
    if (pendingApplyRef.current?.operationId === operationId) pendingApplyRef.current = null;
    moveSettlementRef.current = null;
    record.settle(outcome);
    return true;
  }, [clearApplyTimeout]);

  const registerPendingApply = useCallback((payload: PhysicPaintApplyPayload) => {
    activeOperationIdRef.current = payload.operationId;
    pendingApplyRef.current = createPendingPhysicPaintApply(payload);
  }, []);

  const registerMoveSettlement = useCallback((
    payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-key-frames' }>,
    settle: (outcome: RotoMoveSettlementOutcome) => void,
  ) => {
    if (moveSettlementRef.current) throw new Error('Finish the current Roto key move first.');
    moveSettlementRef.current = {
      operationId: payload.operationId,
      kind: payload.kind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      settle,
    };
    registerPendingApply(payload);
  }, [registerPendingApply]);

  const matchApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined): RotoApplyResultTransition => {
    const pendingMove = moveSettlementRef.current;
    if (pendingMove && detail?.operationId === pendingMove.operationId && (
      detail.kind !== pendingMove.kind
      || detail.layerId !== pendingMove.layerId
      || detail.startFrame !== pendingMove.startFrame
    )) return { type: 'ignore' };
    const transition = transitionRotoApplyResult(getSnapshot(), detail);
    if (transition.type !== 'accepted') return transition;
    const record = moveSettlementRef.current;
    const matchesMove = record !== null
      && transition.detail.operationId === record.operationId
      && transition.detail.kind === record.kind
      && transition.detail.layerId === record.layerId
      && transition.detail.startFrame === record.startFrame;
    if (matchesMove) {
      settleMove(record.operationId, transition.ok
        ? { type: 'accepted', detail: transition.detail }
        : { type: 'failed', reason: 'parent-rejection', detail: transition.detail });
    } else {
      clearActiveApply();
    }
    return transition;
  }, [clearActiveApply, getSnapshot, settleMove]);

  const startApplyTimeout = useCallback((operationId: string) => {
    clearApplyTimeout();
    applyTimeoutRef.current = window.setTimeout(() => {
      const transition = transitionRotoApplyTimeout(getSnapshot(), operationId);
      if (!transition) return;
      const moveSettled = settleMove(operationId, { type: 'failed', reason: 'timeout' });
      if (!moveSettled) clearActiveApply();
      input.onTimeout(transition);
    }, 5000);
  }, [clearActiveApply, clearApplyTimeout, getSnapshot, input, settleMove]);

  const settleMoveTransportFailure = useCallback((operationId: string, error: unknown) => (
    settleMove(operationId, { type: 'failed', reason: 'transport', error })
  ), [settleMove]);

  const cancelMoveForLaunchReplacement = useCallback(() => {
    const operationId = moveSettlementRef.current?.operationId;
    if (operationId) settleMove(operationId, { type: 'cancelled', reason: 'launch-replacement' });
  }, [settleMove]);

  const disposeMoveSettlement = useCallback(() => {
    const operationId = moveSettlementRef.current?.operationId;
    if (operationId) settleMove(operationId, { type: 'cancelled', reason: 'disposal' });
  }, [settleMove]);

  useEffect(() => () => {
    disposeMoveSettlement();
    clearActiveApply();
  }, [clearActiveApply, disposeMoveSettlement]);

  return {
    activeOperationIdRef,
    pendingApplyRef,
    moveSettlementRef,
    registerPendingApply,
    registerMoveSettlement,
    settleMoveTransportFailure,
    cancelMoveForLaunchReplacement,
    disposeMoveSettlement,
    clearActiveApply,
    matchApplyResult,
    startApplyTimeout,
  };
}
