import { useCallback } from 'preact/hooks';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { PhysicPaintRotoInterpolationState } from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';

/**
 * Physical interpolation controller (D-02/D-04).
 *
 * Sends only an enabled-state action to the physical store and then obtains
 * the newly derived current projection. Toggling interpolation must not
 * rewrite records, current navigation frame, selected identity, Script Motion,
 * or launch timing aliases.
 *
 * Locked decisions honored:
 * - D-02: enabled-only interpolation state; generated cells are runtime-derived.
 * - D-04: Script Motion remains a separate store/controller contract.
 * - D-10: one shared physical projection for all current-state consumers.
 * - D-11/D-12: production-only pre-UAT; no regression artifact or server process.
 */
export function useRotoInterpolationController(input: {
  launchContext: PhysicPaintLaunchContext | null;
  bridgeMode: PhysicsPaintBridgeMode;
  setApplyStatus: (status: 'success' | 'error') => void;
  setApplyMessage: (message: string) => void;
  setLastError: (message: string | null) => void;
  setPlaybackStatus: (message: string) => void;
  isMutationLocked?: () => boolean;
  setRotoPhysicalInterpolationState: (layerId: string, state: PhysicPaintRotoInterpolationState) => { ok: true } | { ok: false; error: string };
  getRotoPhysicalInterpolationState: (layerId: string) => PhysicPaintRotoInterpolationState;
  sendApplyPayload: (payload: PhysicPaintApplyPayload, bridgeMode: PhysicsPaintBridgeMode) => Promise<void>;
  /** Latest rotoKeyRecords from the store, for building the apply payload. */
  getRotoKeyRecords?: (layerId: string) => readonly { keyId: string; appFrame: number }[];
}) {
  const updateRotoInterpolationSettings = useCallback(async (patch: { enabled?: boolean }) => {
    if (input.isMutationLocked?.()) return;
    const launchContext = input.launchContext;
    if (!launchContext) return;

    const currentState = input.getRotoPhysicalInterpolationState(launchContext.layerId);
    const nextState: PhysicPaintRotoInterpolationState = {
      enabled: patch.enabled ?? !currentState.enabled,
    };

    // Send only an enabled-state action to the physical store. Per D-02, this
    // cannot move records, current navigation frame, selected identity, Script
    // Motion, or launch timing aliases.
    const result = input.setRotoPhysicalInterpolationState(launchContext.layerId, nextState);
    if (!result.ok) {
      input.setApplyStatus('error');
      input.setApplyMessage(result.error);
      input.setLastError(result.error);
      return;
    }

    const acceptedState = input.getRotoPhysicalInterpolationState(launchContext.layerId);
    const rotoKeyRecords = input.getRotoKeyRecords?.(launchContext.layerId) ?? [];
    const payload: PhysicPaintApplyPayload = {
      kind: 'update-roto-interpolation-settings',
      operationId: `${launchContext.operationId}:roto-interpolation:${Date.now()}`,
      layerId: launchContext.layerId,
      startFrame: launchContext.startFrame,
      settings: {
        enabled: acceptedState.enabled,
        inBetweenCount: 1,
        mode: 'duplicate',
        deform: 0,
        position: 0,
      },
    };
    void rotoKeyRecords; // rotoKeyRecords available for future apply-payload provenance
    try {
      await input.sendApplyPayload(payload, input.bridgeMode);
    } catch (error) {
      const message = `Could not sync interpolation settings to EFX Motion. ${error instanceof Error ? error.message : String(error)}`;
      input.setApplyStatus('error');
      input.setApplyMessage(message);
      input.setLastError(message);
      return;
    }
    const status = acceptedState.enabled
      ? 'Generated in-betweens on — runtime cells derived from adjacent real keys.'
      : 'Generated in-betweens off — real Roto keys only.';
    input.setApplyStatus('success');
    input.setApplyMessage(status);
    input.setLastError(null);
    input.setPlaybackStatus(status);
  }, [input]);

  return { updateRotoInterpolationSettings };
}