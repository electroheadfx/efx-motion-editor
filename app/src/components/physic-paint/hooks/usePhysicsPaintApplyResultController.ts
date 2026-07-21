import { useCallback, type MutableRef } from 'preact/hooks';
import type { PhysicPaintApplyResult } from '../../../types/physicPaint';
import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';
import { usePhysicsPaintApplyResultBridge } from '../bridge/usePhysicsPaintParentBridge';
import type { RotoApplyResultTransition } from '../roto/rotoApplyTransactions';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type ApplyTransition = RotoApplyResultTransition;

/**
 * Coordinator handle subset used by the apply result controller to route
 * `replace-roto-physical-map` results to the generic acknowledged
 * physical-edit coordinator (Plan 36.14-04 Task 3).
 */
interface PhysicalEditCoordinatorRoute {
  consumeBridgeApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => 'ignore' | 'mismatch' | 'accepted';
}

interface GeneralResultPorts {
  matchApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => ApplyTransition;
  pendingKeyActionMessageRef: MutableRef<string | null>;
  setApplyStatus: (status: ApplyStatus) => void;
  setApplyMessage: (message: string | null | ((current: string | null) => string | null)) => void;
  setLastError: (message: string | null) => void;
}

export function usePhysicsPaintApplyResultController(input: {
  bridgeMode: PhysicsPaintBridgeMode;
  general: GeneralResultPorts;
  physicalEditCoordinator: PhysicalEditCoordinatorRoute;
}) {
  const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined) => {
    if (detail && detail.kind === 'replace-roto-physical-map') {
      const routed = input.physicalEditCoordinator.consumeBridgeApplyResult(detail);
      if (routed !== 'ignore') {
        // Coordinator owns the full pending/settle/restore lifecycle and
        // concise-vs-LOG routing for physical edits. Compact status is
        // driven by the coordinator's presentation Signal in Studio; here
        // we only surface mismatched-result diagnostics to LOG.
        if (routed === 'mismatch') {
          input.general.setLastError('Ignored mismatched physics paint physical edit result. Try the action again.');
        }
      }
      return;
    }

    const transition = input.general.matchApplyResult(detail);
    if (transition.type === 'ignore') return;
    if (transition.type === 'mismatch') {
      input.general.setApplyStatus('error');
      input.general.setApplyMessage(transition.message);
      input.general.setLastError(transition.message);
      return;
    }

    detail = transition.detail;
    if (!transition.ok) {
      const message = transition.message ?? 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
      const diagnostic = detail.error;
      const fullMessage = diagnostic ? `${message} ${diagnostic}` : message;
      input.general.pendingKeyActionMessageRef.current = null;
      input.general.setApplyStatus('error');
      input.general.setApplyMessage(fullMessage);
      input.general.setLastError(fullMessage);
      return;
    }

    input.general.setApplyStatus('success');
    input.general.setLastError(null);
    if (detail.kind === 'replace-roto-key-frames') {
      input.general.setApplyMessage(input.general.pendingKeyActionMessageRef.current ?? 'Roto key changes saved.');
      input.general.pendingKeyActionMessageRef.current = null;
    } else if (detail.kind === 'update-roto-interpolation-settings') {
      input.general.setApplyMessage((message) => message || 'Generated in-between settings synced.');
    }
  }, [input]);

  usePhysicsPaintApplyResultBridge(input.bridgeMode, handleApplyResult);
  return { handleApplyResult };
}