import { useCallback, type MutableRef } from 'preact/hooks';
import type { PhysicPaintApplyResult } from '../../../types/physicPaint';
import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';
import { usePhysicsPaintApplyResultBridge } from '../bridge/usePhysicsPaintParentBridge';
import type { RotoApplyResultTransition } from '../roto/rotoApplyTransactions';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type ApplyTransition = RotoApplyResultTransition;

interface GeneralResultPorts {
  matchApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => ApplyTransition;
  pendingKeyActionMessageRef: MutableRef<string | null>;
  setApplyStatus: (status: ApplyStatus) => void;
  setApplyMessage: (message: string | null | ((current: string | null) => string | null)) => void;
  setLastError: (message: string | null) => void;
}

export function usePhysicsPaintApplyResultController(input: {
  bridgeMode: PhysicsPaintBridgeMode;
  canvasSize: { width: number; height: number };
  general: GeneralResultPorts;
}) {
  const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined) => {
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
    } else if (detail.kind === 'update-play-render-options') {
      input.general.setApplyMessage(detail.appliedFrameCount > 0 ? 'Play options updated. Cached frames cleared; use Render play.' : 'Play options already up to date.');
    } else if (detail.kind === 'apply-play-canvas') {
      const endFrame = detail.startFrame + Math.max(0, detail.appliedFrameCount - 1);
      input.general.setApplyMessage(`Saved play range: ${detail.appliedFrameCount} frames from ${detail.startFrame} to ${endFrame} at ${input.canvasSize.width}×${input.canvasSize.height}.`);
    } else if (detail.kind === 'convert-play-to-roto') {
      input.general.setApplyMessage(`Converted ${detail.appliedFrameCount} Play frames to Roto frames.`);
    } else if (detail.kind === 'convert-roto-to-play') {
      const endFrame = detail.startFrame + Math.max(0, detail.appliedFrameCount - 1);
      input.general.setApplyMessage(`Converted Roto frames ${detail.startFrame}–${endFrame} to the current Play canvas source.`);
    }
  }, [input]);

  usePhysicsPaintApplyResultBridge(input.bridgeMode, handleApplyResult);
  return { handleApplyResult };
}
