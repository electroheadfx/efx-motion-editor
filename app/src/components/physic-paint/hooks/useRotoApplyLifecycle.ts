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

export function useRotoApplyLifecycle(input: RotoApplyLifecycleInput) {
  const activeOperationIdRef = useRef<string | null>(null);
  const pendingApplyRef = useRef<PendingPhysicPaintApply | null>(null);
  const applyTimeoutRef = useRef<number | null>(null);

  const getSnapshot = useCallback(() => ({
    activeOperationId: activeOperationIdRef.current,
    pendingApply: pendingApplyRef.current,
  }), []);

  const clearApplyTimeout = useCallback(() => {
    if (!applyTimeoutRef.current) return;
    window.clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = null;
  }, []);

  const clearActiveApply = useCallback(() => {
    clearApplyTimeout();
    activeOperationIdRef.current = null;
    pendingApplyRef.current = null;
  }, [clearApplyTimeout]);

  const registerPendingApply = useCallback((payload: PhysicPaintApplyPayload) => {
    activeOperationIdRef.current = payload.operationId;
    pendingApplyRef.current = createPendingPhysicPaintApply(payload);
  }, []);

  const matchApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined): RotoApplyResultTransition => {
    const transition = transitionRotoApplyResult(getSnapshot(), detail);
    if (transition.type === 'accepted') clearActiveApply();
    return transition;
  }, [clearActiveApply, getSnapshot]);

  const startApplyTimeout = useCallback((operationId: string) => {
    clearApplyTimeout();
    applyTimeoutRef.current = window.setTimeout(() => {
      const transition = transitionRotoApplyTimeout(getSnapshot(), operationId);
      if (!transition) return;
      clearActiveApply();
      input.onTimeout(transition);
    }, 5000);
  }, [clearActiveApply, clearApplyTimeout, getSnapshot, input]);

  useEffect(() => clearApplyTimeout, [clearApplyTimeout]);

  return {
    activeOperationIdRef,
    pendingApplyRef,
    registerPendingApply,
    clearActiveApply,
    matchApplyResult,
    startApplyTimeout,
  };
}
