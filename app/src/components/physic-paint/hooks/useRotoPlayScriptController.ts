import { useEffect, useRef } from 'preact/hooks';
import type { PhysicPaintApplyResult, PhysicPaintRotoAuthorityResult } from '../../../types/physicPaint';
import { createRotoPlayScriptController, type RotoPlayScriptController, type RotoPlayScriptControllerPorts } from '../roto/physicsPaintRotoPlayScriptController';
import { sendPhysicPaintApplyPayload, sendPhysicPaintRotoAuthorityRequest } from '../bridge/physicsPaintBridgeTransport';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintApplyResultBridge, usePhysicsPaintRotoAuthorityResultBridge, type PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';

export function useRotoPlayScriptController(ports: Omit<RotoPlayScriptControllerPorts, 'requestAuthority' | 'commit'>, bridgeMode: PhysicsPaintBridgeMode): RotoPlayScriptController {
  const portsRef = useRef(ports); portsRef.current = ports;
  const modeRef = useRef(bridgeMode); modeRef.current = bridgeMode;
  const authorityPending = useRef(new Map<string, (result: PhysicPaintRotoAuthorityResult) => void>());
  const commitPending = useRef(new Map<string, (result: PhysicPaintApplyResult) => void>());
  usePhysicsPaintRotoAuthorityResultBridge((result) => { authorityPending.current.get(result.operationId)?.(result); authorityPending.current.delete(result.operationId); });
  usePhysicsPaintApplyResultBridge(bridgeMode, (result) => { commitPending.current.get(result.operationId)?.(result); commitPending.current.delete(result.operationId); });

  const controllerRef = useRef<RotoPlayScriptController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createRotoPlayScriptController({
      ...ports,
      requestAuthority: (operationId, start) => requestWithTimeout(authorityPending.current, operationId, async () => {
        const context = portsRef.current.getLaunchContext();
        if (!context?.project) throw new Error('Project authority is unavailable.');
        const mode = modeRef.current === 'Unavailable' ? await detectPhysicsPaintBridgeMode() : modeRef.current;
        await sendPhysicPaintRotoAuthorityRequest({ operationId, projectContextId: context.project.contextId, layerId: context.layerId, canonicalStart: start }, mode);
      }, authorityFailure(operationId, portsRef.current)),
      commit: (payload) => requestWithTimeout(commitPending.current, payload.operationId, async () => {
        const mode = modeRef.current === 'Unavailable' ? await detectPhysicsPaintBridgeMode() : modeRef.current;
        await sendPhysicPaintApplyPayload({ kind: 'replace-roto-key-frames', ...payload }, mode);
      }, commitFailure(payload)),
    });
  }
  useEffect(() => () => {
    controllerRef.current?.dispose();
    authorityPending.current.clear(); commitPending.current.clear();
  }, []);
  return controllerRef.current;
}

function requestWithTimeout<T>(pending: Map<string, (result: T) => void>, operationId: string, send: () => Promise<void>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => { pending.delete(operationId); resolve(fallback); }, 15_000);
    pending.set(operationId, (result) => { window.clearTimeout(timeout); resolve(result); });
    void send().catch(() => { window.clearTimeout(timeout); pending.delete(operationId); resolve(fallback); });
  });
}
function authorityFailure(operationId: string, ports: Pick<RotoPlayScriptControllerPorts, 'getLaunchContext' | 'getSelection'>): PhysicPaintRotoAuthorityResult {
  const context = ports.getLaunchContext(); const selection = ports.getSelection();
  return { operationId, ok: false, projectContextId: context?.project?.contextId ?? '', layerId: context?.layerId ?? '', canonicalStart: selection.sourceFrame, layerEndExclusive: selection.sourceFrame, capacity: 0, rotoRevision: '', frames: [], interpolationSettings: { enabled: false, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 }, error: 'Roto authority request timed out.' };
}
function commitFailure(payload: { operationId: string; layerId: string; startFrame: number }): PhysicPaintApplyResult {
  return { operationId: payload.operationId, kind: 'replace-roto-key-frames', layerId: payload.layerId, startFrame: payload.startFrame, appliedFrameCount: 0, ok: false, error: 'Play Script commit timed out.' };
}
