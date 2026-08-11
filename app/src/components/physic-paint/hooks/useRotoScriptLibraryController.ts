import { useEffect, useRef } from 'preact/hooks';
import { signal, type Signal } from '@preact/signals';
import type {
  PhysicPaintActionHistoryReleaseReason,
  PhysicPaintActionHistoryReleaseRequest,
  PhysicPaintActionTransactionPrepareRequest,
  PhysicPaintActionTransactionRecord,
  PhysicPaintActionTransactionResult,
  PhysicPaintScriptLibraryRequest,
  PhysicPaintScriptLibraryResult,
} from '../../../types/physicPaint';
import { physicPaintStore, type PhysicPaintRotoPhysicalOperationLeaseToken } from '../../../stores/physicPaintStore';
import {
  scriptLibraryAcknowledgeActionTransaction,
  scriptLibraryCommitActionTransaction,
  scriptLibraryDiscoverActionTransaction,
  scriptLibraryPrepareActionTransaction,
  scriptLibraryRecoverActionTransaction,
  scriptLibraryReleaseActionHistory,
} from '../../../lib/ipc';
import {
  applyCommittedReferencedActionDeletion,
  type ReferencedActionDeletionHistoryEntry,
} from '../../../lib/physicPaintBridge';
import {
  buildPhysicPaintRotoProjectEquality,
  type PhysicPaintRotoPhysicalDocument,
} from '../roto/physicsPaintRotoPhysicalModel';
import type {
  ReferencedActionHistoryCommand,
  ReferencedActionHistoryRoute,
} from './useRotoPhysicalEditHistory';
import { proposePhysicPaintRotoActionGroupLifecycle } from '../roto/physicsPaintRotoGroupLifecycle';
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

interface ReferencedActionHistoryReplayPorts {
  getPhysicalDocument: (layerId: string) => PhysicPaintRotoPhysicalDocument | null;
  getActionRevision: (actionId: string) => string | null | Promise<string | null>;
  getAuthority: () => string | null;
  acquireLease: (projectContextId: string, layerId: string) => string | null;
  releaseLease: (leaseToken: string) => boolean;
  transferLeaseToRecovery?: (leaseToken: string) => boolean;
  nextUuid: () => string;
  digest: (value: unknown) => Promise<string>;
  prepare: (
    authority: string,
    request: PhysicPaintActionTransactionPrepareRequest,
  ) => Promise<PhysicPaintActionTransactionResult>;
  commit: (
    authority: string,
    request: PhysicPaintActionTransactionPrepareRequest,
  ) => Promise<PhysicPaintActionTransactionResult>;
  settle: (input: Readonly<{
    command: ReferencedActionHistoryCommand;
    committed: PhysicPaintActionTransactionRecord;
    direction: 'undo' | 'redo';
    leaseToken: string;
  }>) => Readonly<{ ok: boolean; error?: string }>;
  acknowledge: (
    authority: string,
    request: Readonly<{
      token: string;
      commandId: string;
      generation: number;
      operationId: string;
      leaseToken: string;
      direction: 'undo' | 'redo';
    }>,
  ) => Promise<PhysicPaintActionTransactionResult>;
}

export function createReferencedActionHistoryReplayOrchestrator(
  ports: ReferencedActionHistoryReplayPorts,
): ReferencedActionHistoryRoute['replay'] {
  return async (command, direction) => {
    if (command.kind !== 'referenced-action'
      || !Number.isSafeInteger(command.generation)
      || command.generation < 1
      || command.retainedArtifact.commandId !== command.commandId
      || command.retainedArtifact.generation !== command.generation
      || command.retainedArtifact.actionId !== command.authority.actionId) return false;
    const source = direction === 'undo' ? command.after : command.before;
    const target = direction === 'undo' ? command.before : command.after;
    const current = ports.getPhysicalDocument(command.authority.layerId);
    if (!current
      || current.revision !== source.physicalRevision
      || buildPhysicPaintRotoProjectEquality(current) !== source.physicalHash) return false;
    const currentActionRevision = await ports.getActionRevision(command.authority.actionId);
    const expectedActionPresent = direction === 'redo';
    if ((expectedActionPresent && currentActionRevision !== command.authority.actionRevision)
      || (!expectedActionPresent && currentActionRevision !== null)) return false;
    const authority = ports.getAuthority();
    if (!authority || authority !== command.authority.scriptLibraryAuthority) return false;
    const leaseToken = ports.acquireLease(
      command.authority.projectContextId,
      command.authority.layerId,
    );
    if (!leaseToken) return false;

    let committed = false;
    let settled = false;
    try {
      const token = ports.nextUuid();
      const impactDigest = await ports.digest({
        commandId: command.commandId,
        generation: command.generation,
        direction,
        mode: command.mode,
        source,
        target,
      });
      const request: PhysicPaintActionTransactionPrepareRequest = Object.freeze({
        token,
        commandId: command.commandId,
        generation: command.generation,
        operationId: `${direction}-referenced-action-${command.commandId}-${token}`,
        leaseToken,
        direction,
        mode: command.mode,
        authority: Object.freeze({
          projectContextId: command.authority.projectContextId,
          layerId: command.authority.layerId,
          launchOperationId: command.authority.launchOperationId,
          actionId: command.authority.actionId,
          expectedActionPresent,
          expectedActionRevision: command.authority.actionRevision,
          expectedPhysicalRevision: source.physicalRevision,
          expectedPhysicalHash: source.physicalHash,
        }),
        impactDigest,
        retainedArtifact: command.retainedArtifact,
        target: Object.freeze({
          physicalRevision: target.physicalRevision,
          physicalHash: target.physicalHash,
          physicalDocument: target.document,
          selectedGroupId: target.selectedGroupId,
          cursorAppFrame: target.cursorAppFrame,
        }),
      });
      const prepared = await ports.prepare(authority, request);
      if (prepared.state !== 'prepared'
        || prepared.token !== token
        || prepared.commandId !== command.commandId
        || prepared.generation !== command.generation
        || prepared.direction !== direction) return false;
      const committedResult = await ports.commit(authority, request);
      if (committedResult.state !== 'committed'
        || committedResult.token !== token
        || committedResult.commandId !== command.commandId
        || committedResult.generation !== command.generation
        || committedResult.direction !== direction) return false;
      committed = true;
      const settlement = ports.settle({ command, committed: committedResult, direction, leaseToken });
      if (!settlement.ok) return false;
      settled = true;
      const acknowledged = await ports.acknowledge(authority, {
        token,
        commandId: command.commandId,
        generation: command.generation,
        operationId: request.operationId,
        leaseToken,
        direction,
      });
      return acknowledged.state === 'acknowledged'
        && acknowledged.token === token
        && acknowledged.commandId === command.commandId
        && acknowledged.generation === command.generation
        && acknowledged.direction === direction;
    } catch {
      return false;
    } finally {
      if (!committed || settled) ports.releaseLease(leaseToken);
      else ports.transferLeaseToRecovery?.(leaseToken);
    }
  };
}

interface ReferencedActionHistoryReleaseManagerPorts {
  release: (
    authority: string,
    request: PhysicPaintActionHistoryReleaseRequest,
  ) => Promise<PhysicPaintActionTransactionResult>;
}

export interface ReferencedActionHistoryReleaseManager {
  release: (
    command: ReferencedActionHistoryCommand,
    reason: PhysicPaintActionHistoryReleaseReason,
  ) => Promise<boolean>;
  retryDeferred: () => Promise<boolean>;
  pendingCount: () => number;
}

export function createReferencedActionHistoryReleaseManager(
  ports: ReferencedActionHistoryReleaseManagerPorts,
): ReferencedActionHistoryReleaseManager {
  const pending = new Map<string, Readonly<{
    command: ReferencedActionHistoryCommand;
    reason: PhysicPaintActionHistoryReleaseReason;
  }>>();
  const keyFor = (command: ReferencedActionHistoryCommand, reason: PhysicPaintActionHistoryReleaseReason) =>
    `${command.authority.projectContextId}:${command.authority.launchOperationId}:${command.commandId}:${command.generation}:${reason}`;

  const release = async (
    command: ReferencedActionHistoryCommand,
    reason: PhysicPaintActionHistoryReleaseReason,
  ): Promise<boolean> => {
    const key = keyFor(command, reason);
    const authority = command.authority.scriptLibraryAuthority;
    if (!authority) return false;
    const request: PhysicPaintActionHistoryReleaseRequest = Object.freeze({
      projectContextId: command.authority.projectContextId,
      launchOperationId: command.authority.launchOperationId,
      commandId: command.commandId,
      generation: command.generation,
      reason,
    });
    try {
      const result = await ports.release(authority, request);
      if (result.state === 'released'
        && result.projectContextId === request.projectContextId
        && result.launchOperationId === request.launchOperationId
        && result.commandId === request.commandId
        && result.generation === request.generation
        && result.reason === request.reason) {
        pending.delete(key);
        return true;
      }
    } catch {
      // Durable ownership remains queued for the next recovery-safe retry.
    }
    pending.set(key, Object.freeze({ command, reason }));
    return false;
  };

  return {
    release,
    retryDeferred: async () => {
      let releasedAll = true;
      for (const owned of [...pending.values()]) {
        if (!await release(owned.command, owned.reason)) releasedAll = false;
      }
      return releasedAll;
    },
    pendingCount: () => pending.size,
  };
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

interface NativeReferencedActionDeletionPorts extends ReferencedActionDeletionPorts {
  readonly acceptedHistory: Signal<ReferencedActionHistoryCommand | null>;
  readonly replayHistory: ReferencedActionHistoryRoute['replay'];
  readonly releaseHistory: NonNullable<ReferencedActionHistoryRoute['release']>;
}

function createNativeReferencedActionDeletionPorts(
  getPorts: () => RotoScriptLibraryControllerPorts,
): NativeReferencedActionDeletionPorts {
  const leases = new Map<string, PhysicPaintRotoPhysicalOperationLeaseToken>();
  const acceptedHistory = signal<ReferencedActionHistoryCommand | null>(null);
  const releaseManager = createReferencedActionHistoryReleaseManager({
    release: scriptLibraryReleaseActionHistory,
  });
  let transactionGeneration = 0;
  const encodeLease = (lease: PhysicPaintRotoPhysicalOperationLeaseToken) =>
    `${lease.projectContextId}:${lease.layerId}:${lease.generation}:${lease.owner}`;
  const deletionPorts: ReferencedActionDeletionPorts = {
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
      if (!result.ok) return { ok: false, error: `Committed Action settlement failed: ${result.reason}` };
      const authority = prepared.request.authority;
      const scriptLibraryAuthority = deletionPorts.getAuthority?.() ?? null;
      if (!scriptLibraryAuthority) return { ok: false, error: 'Script library history authority is unavailable.' };
      acceptedHistory.value = Object.freeze({
        kind: 'referenced-action' as const,
        commandId: result.history.commandId,
        generation: result.history.generation,
        mode: result.history.mode,
        retainedArtifact: result.history.retainedArtifact,
        authority: Object.freeze({
          projectContextId: authority.projectContextId,
          layerId: authority.layerId,
          launchOperationId: authority.launchOperationId,
          scriptLibraryAuthority,
          actionId: authority.actionId,
          actionRevision: authority.expectedActionRevision,
        }),
        before: Object.freeze({
          ...result.history.before,
          selectedGroupId: result.history.selection.beforeGroupId,
          cursorAppFrame: result.history.before.document.cursorAppFrame,
        }),
        after: Object.freeze({
          ...result.history.after,
          selectedGroupId: result.history.selection.afterGroupId,
          cursorAppFrame: result.history.after.document.cursorAppFrame,
        }),
      });
      return { ok: true };
    },
    acknowledge: scriptLibraryAcknowledgeActionTransaction,
    recoverBeforeAvailability: async (context) => {
      const authority = context.project?.scriptLibraryAuthority;
      if (!authority) return { ok: false, error: 'Script library recovery authority is unavailable.' };
      const discovered = await scriptLibraryDiscoverActionTransaction(authority);
      if (discovered === null) {
        await releaseManager.retryDeferred();
        return { ok: true };
      }
      if (discovered.state === 'failed') return { ok: false, error: discovered.error };
      if (discovered.state !== 'prepared' && discovered.state !== 'committed') {
        return { ok: false, error: 'Recovery discovery returned an invalid durable state.' };
      }
      const leaseParts = discovered.leaseToken.split(':');
      const generation = Number(leaseParts[leaseParts.length - 2]);
      if (!Number.isSafeInteger(generation) || generation < 1) {
        return { ok: false, error: 'Recovery lease identity is malformed.' };
      }
      const recoveryLease = physicPaintStore.acquireRotoPhysicalRecoveryLease({
        projectContextId: discovered.authority.projectContextId,
        layerId: discovered.authority.layerId,
        generation,
      });
      if (!recoveryLease) return { ok: false, error: 'Recovery lease is unavailable.' };
      const recovered = await scriptLibraryRecoverActionTransaction(authority, discovered);
      if (discovered.state === 'prepared') {
        const restored = recovered.state === 'recovered-prepared';
        if (restored) {
          physicPaintStore.releaseRotoPhysicalOperationLease(recoveryLease);
          await releaseManager.retryDeferred();
        }
        return restored ? { ok: true } : { ok: false, error: recovered.state === 'failed' ? recovered.error : 'Prepared Action recovery failed.' };
      }
      if (recovered.state !== 'recovery-required') {
        return { ok: false, error: recovered.state === 'failed' ? recovered.error : 'Committed Action recovery failed.' };
      }
      const current = physicPaintStore.getRotoPhysicalDocument(discovered.authority.layerId);
      if (!current) {
        return { ok: false, error: 'Recovery physical authority is unavailable.' };
      }
      const alreadySettled = current.revision === discovered.target.physicalRevision
        && buildPhysicPaintRotoProjectEquality(current) === discovered.target.physicalHash;
      if (!alreadySettled) {
        const proposed = proposePhysicPaintRotoActionGroupLifecycle({
          document: current,
          actionId: discovered.authority.actionId,
          expectedActionRevision: discovered.authority.expectedActionRevision,
          currentActionRevision: discovered.authority.expectedActionRevision,
          mode: discovered.mode === 'keep-groups' ? 'detach' : 'delete',
        });
        if (!proposed.ok) {
          return { ok: false, error: `Recovery candidate was rejected: ${proposed.reason}` };
        }
        const settled = applyCommittedReferencedActionDeletion({
          committed: { ...discovered, state: 'committed' },
          impact: proposed.impact,
          before: current,
          leaseToken: recoveryLease,
        });
        if (!settled.ok) {
          return { ok: false, error: `Committed recovery settlement failed: ${settled.reason}` };
        }
      }
      const acknowledged = await scriptLibraryAcknowledgeActionTransaction(authority, {
        token: discovered.token,
        commandId: discovered.commandId,
        generation: discovered.generation,
        operationId: discovered.operationId,
        leaseToken: discovered.leaseToken,
        direction: discovered.direction,
      });
      if (acknowledged.state !== 'acknowledged') {
        return { ok: false, error: acknowledged.state === 'failed' ? acknowledged.error : 'Recovery acknowledgement remains pending.' };
      }
      physicPaintStore.releaseRotoPhysicalOperationLease(recoveryLease);
      await releaseManager.retryDeferred();
      return { ok: true };
    },
  };
  const replayHistory = createReferencedActionHistoryReplayOrchestrator({
    getPhysicalDocument: deletionPorts.getPhysicalDocument,
    getActionRevision: async (actionId) => {
      const result = await getPorts().request({
        kind: 'scan',
        operationId: `history-preflight-${crypto.randomUUID()}`,
      });
      if (!result.ok) return null;
      return result.rows.find((row) => row.id === actionId)?.revision ?? null;
    },
    getAuthority: () => deletionPorts.getAuthority?.() ?? null,
    acquireLease: deletionPorts.acquireLease,
    releaseLease: deletionPorts.releaseLease,
    transferLeaseToRecovery: deletionPorts.transferLeaseToRecovery,
    nextUuid: deletionPorts.nextUuid,
    digest: deletionPorts.digest,
    prepare: deletionPorts.prepare,
    commit: deletionPorts.commit,
    settle: ({ command, committed, leaseToken }) => {
      const lease = leases.get(leaseToken);
      if (!lease) return { ok: false, error: 'Physical operation lease identity is unavailable.' };
      const history: ReferencedActionDeletionHistoryEntry = Object.freeze({
        commandId: command.commandId,
        generation: command.generation,
        direction: 'forward',
        mode: command.mode,
        retainedArtifact: command.retainedArtifact,
        authority: command.authority,
        before: Object.freeze({
          physicalRevision: command.before.physicalRevision,
          physicalHash: command.before.physicalHash,
          document: command.before.document,
        }),
        after: Object.freeze({
          physicalRevision: command.after.physicalRevision,
          physicalHash: command.after.physicalHash,
          document: command.after.document,
        }),
        selection: Object.freeze({
          beforeGroupId: command.before.selectedGroupId,
          afterGroupId: command.after.selectedGroupId,
          beforeCursorAppFrame: command.before.cursorAppFrame,
          afterCursorAppFrame: command.after.cursorAppFrame,
        }),
      });
      const result = applyCommittedReferencedActionDeletion({ committed, history, leaseToken: lease });
      return result.ok
        ? { ok: true }
        : { ok: false, error: `Committed Action history settlement failed: ${result.reason}` };
    },
    acknowledge: scriptLibraryAcknowledgeActionTransaction,
  });
  return Object.assign(deletionPorts, {
    acceptedHistory,
    replayHistory,
    releaseHistory: releaseManager.release,
  });
}

export function createRotoScriptLibraryControllerAdapter(
  getPorts: () => RotoScriptLibraryControllerPorts,
  request: RotoScriptLibraryControllerPorts['request'],
  nativeReferencedActionDeletion = createNativeReferencedActionDeletionPorts(getPorts),
): RotoScriptLibraryControllerPorts {
  return {
    request,
    capturePersistence: () => getPorts().capturePersistence(),
    captureThumbnail: (canvas) => getPorts().captureThumbnail(canvas),
    replaceClipboard: (script, preparation) => getPorts().replaceClipboard(script, preparation),
    getLaunchContext: () => getPorts().getLaunchContext(),
    log: (message, error) => getPorts().log(message, error),
    get referencedActionDeletion() {
      return getPorts().referencedActionDeletion
        ?? (getPorts().getLaunchContext()?.project?.scriptLibraryAuthority ? nativeReferencedActionDeletion : undefined);
    },
  };
}

export interface RotoScriptLibraryControllerWithHistory extends RotoScriptLibraryController {
  readonly referencedActionHistory: ReferencedActionHistoryRoute;
}

export function useRotoScriptLibraryController(
  ports: RotoScriptLibraryControllerPorts,
  bridgeMode: PhysicsPaintBridgeMode,
): RotoScriptLibraryControllerWithHistory {
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
  const nativePortsRef = useRef<NativeReferencedActionDeletionPorts | null>(null);
  if (!nativePortsRef.current) {
    nativePortsRef.current = createNativeReferencedActionDeletionPorts(() => portsRef.current);
  }
  const controllerRef = useRef<RotoScriptLibraryControllerWithHistory | null>(null);
  if (!controllerRef.current) {
    const nativePorts = nativePortsRef.current;
    const controller = createRotoScriptLibraryController(
      createRotoScriptLibraryControllerAdapter(
        () => portsRef.current,
        lifecycleRef.current.request,
        nativePorts,
      ),
    );
    controllerRef.current = Object.assign(controller, {
      referencedActionHistory: Object.freeze({
        accepted: nativePorts.acceptedHistory,
        replay: nativePorts.replayHistory,
        release: nativePorts.releaseHistory,
      }),
    });
  }
  useEffect(() => () => {
    lifecycleRef.current?.dispose();
    controllerRef.current?.dispose();
  }, []);
  return controllerRef.current;
}
