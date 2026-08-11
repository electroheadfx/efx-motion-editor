import { useEffect, useRef } from 'preact/hooks';
import type { PhysicPaintScriptLibraryRequest, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { physicPaintStore, type PhysicPaintRotoPhysicalOperationLeaseToken } from '../../../stores/physicPaintStore';
import {
  scriptLibraryAcknowledgeActionTransaction,
  scriptLibraryCommitActionTransaction,
  scriptLibraryPrepareActionTransaction,
} from '../../../lib/ipc';
import { applyCommittedReferencedActionDeletion } from '../../../lib/physicPaintBridge';
import { sendPhysicPaintScriptLibraryRequest } from '../bridge/physicsPaintBridgeTransport';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintScriptLibraryResultBridge, type PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';
import {
  createRotoScriptLibraryController,
  type ReferencedActionDeletionPorts,
  type RotoScriptLibraryController,
  type RotoScriptLibraryControllerPorts,
} from '../roto/physicsPaintRotoScriptLibrary';

type PendingScriptLibraryRequest = {
  request: PhysicPaintScriptLibraryRequest;
  resolve: (result: PhysicPaintScriptLibraryResult) => void;
  timeout: ReturnType<typeof setTimeout>;
};

interface RotoScriptLibraryRequestLifecyclePorts {
  getBridgeMode: () => PhysicsPaintBridgeMode;
  detectBridgeMode: () => Promise<PhysicsPaintBridgeMode>;
  sendRequest: (request: PhysicPaintScriptLibraryRequest, bridgeMode: PhysicsPaintBridgeMode) => Promise<void>;
  setRequestTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearRequestTimeout?: (timeout: ReturnType<typeof setTimeout>) => void;
}

export interface RotoScriptLibraryRequestLifecycle {
  request: (request: PhysicPaintScriptLibraryRequest) => Promise<PhysicPaintScriptLibraryResult>;
  handleResult: (result: PhysicPaintScriptLibraryResult) => void;
  dispose: () => void;
  pendingCount: () => number;
}

function failedResult(request: PhysicPaintScriptLibraryRequest, error: string): PhysicPaintScriptLibraryResult {
  return { operationId: request.operationId, kind: request.kind, ok: false, rows: [], skippedInvalidCount: 0, diagnostics: [], error };
}

export function createRotoScriptLibraryRequestLifecycle(ports: RotoScriptLibraryRequestLifecyclePorts): RotoScriptLibraryRequestLifecycle {
  const pending = new Map<string, PendingScriptLibraryRequest>();
  const setRequestTimeout = ports.setRequestTimeout ?? setTimeout;
  const clearRequestTimeout = ports.clearRequestTimeout ?? clearTimeout;
  let disposed = false;

  function settle(operationId: string, result: PhysicPaintScriptLibraryResult): void {
    const operation = pending.get(operationId);
    if (!operation) return;
    pending.delete(operationId);
    clearRequestTimeout(operation.timeout);
    operation.resolve(result);
  }

  function request(input: PhysicPaintScriptLibraryRequest): Promise<PhysicPaintScriptLibraryResult> {
    if (disposed) return Promise.resolve(failedResult(input, 'Script library request was disposed.'));
    return new Promise((resolve) => {
      const timeout = setRequestTimeout(() => settle(input.operationId, failedResult(input, 'Script library request timed out.')), 15_000);
      pending.set(input.operationId, { request: input, resolve, timeout });
      void (async () => {
        const configuredMode = ports.getBridgeMode();
        const currentBridgeMode = configuredMode === 'Unavailable' ? await ports.detectBridgeMode() : configuredMode;
        await ports.sendRequest(input, currentBridgeMode);
      })().catch((error) => settle(input.operationId, failedResult(input, String(error))));
    });
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const operation of [...pending.values()]) {
      settle(operation.request.operationId, failedResult(operation.request, 'Script library request was disposed.'));
    }
  }

  return {
    request,
    handleResult: (result) => settle(result.operationId, result),
    dispose,
    pendingCount: () => pending.size,
  };
}

function createNativeReferencedActionDeletionPorts(
  getPorts: () => RotoScriptLibraryControllerPorts,
): ReferencedActionDeletionPorts {
  const leases = new Map<string, PhysicPaintRotoPhysicalOperationLeaseToken>();
  let transactionGeneration = 0;
  const encodeLease = (lease: PhysicPaintRotoPhysicalOperationLeaseToken) =>
    `${lease.projectContextId}:${lease.layerId}:${lease.generation}:${lease.owner}`;
  return {
    getPhysicalDocument: (layerId) => physicPaintStore.getRotoPhysicalDocument(layerId),
    getAuthority: () => getPorts().getLaunchContext()?.project?.scriptLibraryAuthority ?? null,
    acquireLease: (projectContextId, layerId) => {
      const lease = physicPaintStore.acquireRotoPhysicalOperationLease(projectContextId, layerId);
      if (!lease) return null;
      const encoded = encodeLease(lease);
      leases.set(encoded, lease);
      return encoded;
    },
    releaseLease: (encoded) => {
      const lease = leases.get(encoded);
      if (!lease) return false;
      const released = physicPaintStore.releaseRotoPhysicalOperationLease(lease);
      if (released) leases.delete(encoded);
      return released;
    },
    transferLeaseToRecovery: (encoded) => {
      const lease = leases.get(encoded);
      if (!lease) return false;
      const recovery = physicPaintStore.transferRotoPhysicalOperationLeaseToRecovery(lease);
      if (!recovery) return false;
      leases.set(encoded, recovery);
      return true;
    },
    nextUuid: () => crypto.randomUUID(),
    nextGeneration: () => ++transactionGeneration,
    digest: async (value) => {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    },
    prepare: scriptLibraryPrepareActionTransaction,
    commit: scriptLibraryCommitActionTransaction,
    settle: (prepared) => {
      const lease = leases.get(prepared.request.leaseToken);
      if (!lease) return { ok: false, error: 'Physical operation lease identity is unavailable.' };
      const result = applyCommittedReferencedActionDeletion({
        committed: prepared.committed,
        impact: prepared.impact,
        before: prepared.before,
        leaseToken: lease,
      });
      return result.ok ? { ok: true } : { ok: false, error: `Committed Action settlement failed: ${result.reason}` };
    },
    acknowledge: scriptLibraryAcknowledgeActionTransaction,
  };
}

export function createRotoScriptLibraryControllerAdapter(
  getPorts: () => RotoScriptLibraryControllerPorts,
  request: RotoScriptLibraryControllerPorts['request'],
): RotoScriptLibraryControllerPorts {
  const nativeReferencedActionDeletion = createNativeReferencedActionDeletionPorts(getPorts);
  return {
    request,
    capturePersistence: () => getPorts().capturePersistence(),
    captureThumbnail: (canvas) => getPorts().captureThumbnail(canvas),
    replaceClipboard: (script, preparation) => getPorts().replaceClipboard(script, preparation),
    getLaunchContext: () => getPorts().getLaunchContext(),
    log: (message, error) => getPorts().log(message, error),
    get referencedActionDeletion() { return getPorts().referencedActionDeletion ?? nativeReferencedActionDeletion; },
  };
}

export function useRotoScriptLibraryController(ports: RotoScriptLibraryControllerPorts, bridgeMode: PhysicsPaintBridgeMode): RotoScriptLibraryController {
  const portsRef = useRef(ports); portsRef.current = ports;
  const bridgeModeRef = useRef(bridgeMode); bridgeModeRef.current = bridgeMode;
  const lifecycleRef = useRef<RotoScriptLibraryRequestLifecycle | null>(null);
  if (!lifecycleRef.current) {
    lifecycleRef.current = createRotoScriptLibraryRequestLifecycle({
      getBridgeMode: () => bridgeModeRef.current,
      detectBridgeMode: detectPhysicsPaintBridgeMode,
      sendRequest: sendPhysicPaintScriptLibraryRequest,
    });
  }
  usePhysicsPaintScriptLibraryResultBridge((result) => lifecycleRef.current?.handleResult(result));
  const controllerRef = useRef<RotoScriptLibraryController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createRotoScriptLibraryController(
      createRotoScriptLibraryControllerAdapter(() => portsRef.current, lifecycleRef.current.request),
    );
  }
  useEffect(() => () => {
    lifecycleRef.current?.dispose();
    controllerRef.current?.dispose();
  }, []);
  return controllerRef.current;
}
