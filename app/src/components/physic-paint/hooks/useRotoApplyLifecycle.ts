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

/**
 * Generic apply lifecycle for non-physical-edit apply payloads
 * (`apply-canvas`, `delete-roto-frame`, `replace-roto-key-frames`,
 * `update-roto-interpolation-settings`). The acknowledged physical-edit
 * move transaction is owned by `useRotoPhysicalEditCoordinator`
 * (Plan 36.14-04 Task 3); this hook no longer registers move-specific
 * settlement, transport-failure, launch-replacement, or disposal
 * callbacks. The apply result controller routes `replace-roto-physical-map`
 * results directly to the coordinator and other results to
 * `matchApplyResult` below.
 */
export function useRotoApplyLifecycle(input: RotoApplyLifecycleInput) {
  const activeOperationIdRef = useRef<string | null>(null);
  const pendingApplyRef = useRef<PendingPhysicPaintApply | null>(null);
  const applyTimeoutRef = useRef<number | null>(null);

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

  const registerPendingApply = useCallback((payload: PhysicPaintApplyPayload) => {
    activeOperationIdRef.current = payload.operationId;
    pendingApplyRef.current = createPendingPhysicPaintApply(payload);
  }, []);

  const matchApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined): RotoApplyResultTransition => {
    if (detail && detail.kind === 'replace-roto-physical-map') {
      // Physical-edit results are owned by the coordinator. Ignore here so
      // the apply result controller can route them to the coordinator.
      return { type: 'ignore' };
    }
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

  useEffect(() => () => {
    clearActiveApply();
  }, [clearActiveApply]);

  return {
    activeOperationIdRef,
    pendingApplyRef,
    registerPendingApply,
    clearActiveApply,
    matchApplyResult,
    startApplyTimeout,
  };
}