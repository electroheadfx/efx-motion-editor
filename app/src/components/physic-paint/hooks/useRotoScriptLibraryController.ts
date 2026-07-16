import { useEffect, useRef } from 'preact/hooks';
import type { PhysicPaintScriptLibraryRequest, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { sendPhysicPaintScriptLibraryRequest } from '../bridge/physicsPaintBridgeTransport';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintScriptLibraryResultBridge, type PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';
import { createRotoScriptLibraryController, type RotoScriptLibraryController, type RotoScriptLibraryControllerPorts } from '../roto/physicsPaintRotoScriptLibrary';

export function useRotoScriptLibraryController(ports: RotoScriptLibraryControllerPorts, bridgeMode: PhysicsPaintBridgeMode): RotoScriptLibraryController {
  const portsRef = useRef(ports); portsRef.current = ports;
  const bridgeModeRef = useRef(bridgeMode); bridgeModeRef.current = bridgeMode;
  const pending = useRef(new Map<string, { resolve: (result: PhysicPaintScriptLibraryResult) => void; timeout: ReturnType<typeof setTimeout> }>());
  usePhysicsPaintScriptLibraryResultBridge((result) => {
    const operation = pending.current.get(result.operationId);
    if (!operation) return;
    clearTimeout(operation.timeout); pending.current.delete(result.operationId); operation.resolve(result);
  });
  const controllerRef = useRef<RotoScriptLibraryController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createRotoScriptLibraryController({
      ...ports,
      request: (request: PhysicPaintScriptLibraryRequest) => new Promise((resolve) => {
        const timeout = setTimeout(() => { pending.current.delete(request.operationId); resolve({ operationId: request.operationId, kind: request.kind, ok: false, rows: [], skippedInvalidCount: 0, diagnostics: [], error: 'Script library request timed out.' }); }, 15_000);
        pending.current.set(request.operationId, { resolve, timeout });
        void (async () => {
          const currentBridgeMode = bridgeModeRef.current === 'Unavailable'
            ? await detectPhysicsPaintBridgeMode()
            : bridgeModeRef.current;
          await sendPhysicPaintScriptLibraryRequest(request, currentBridgeMode);
        })().catch((error) => {
          clearTimeout(timeout); pending.current.delete(request.operationId);
          resolve({ operationId: request.operationId, kind: request.kind, ok: false, rows: [], skippedInvalidCount: 0, diagnostics: [], error: String(error) });
        });
      }),
      capturePersistence: () => portsRef.current.capturePersistence(), captureThumbnail: (canvas) => portsRef.current.captureThumbnail(canvas),
      replaceClipboard: (script) => portsRef.current.replaceClipboard(script), getLaunchContext: () => portsRef.current.getLaunchContext(),
      log: (message, error) => portsRef.current.log(message, error),
    });
  }
  useEffect(() => () => { for (const operation of pending.current.values()) clearTimeout(operation.timeout); pending.current.clear(); controllerRef.current?.dispose(); }, []);
  return controllerRef.current;
}
