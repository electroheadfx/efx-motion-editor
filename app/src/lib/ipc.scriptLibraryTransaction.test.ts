import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type {
  PhysicPaintActionHistoryReleaseRequest,
  PhysicPaintActionTransactionAcknowledgeRequest,
  PhysicPaintActionTransactionPrepareRequest,
} from '../types/physicPaint';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import {
  scriptLibraryAcknowledgeActionTransaction,
  scriptLibraryActionTransactionStatus,
  scriptLibraryCommitActionTransaction,
  scriptLibraryDiscoverActionTransaction,
  scriptLibraryPrepareActionTransaction,
  scriptLibraryRecoverActionTransaction,
  scriptLibraryReleaseActionHistory,
} from './ipc';

const authority = 'script-library-authority-1';

function prepareRequest(
  direction: 'forward' | 'undo' | 'redo' = 'forward',
): PhysicPaintActionTransactionPrepareRequest {
  const actionId = '11111111-1111-4111-8111-111111111111';
  const token = {
    forward: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    undo: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    redo: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  }[direction];
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const realKeyRecords: never[] = [];
  const loopClips: never[] = [];
  const physicalDocument = {
    capacity: 24,
    realKeyRecords,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 18,
    revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, loopClips),
    loopClips,
    incomingInterpolationBreakKeyIds: [],
  };
  return {
    token,
    commandId: 'history-command-10',
    generation: 10,
    operationId: `${direction}-operation-1`,
    leaseToken: `${direction}-lease-1`,
    direction,
    mode: 'keep-groups',
    authority: {
      projectContextId: 'project-context-1',
      layerId: 'layer-1',
      launchOperationId: 'launch-1',
      actionId,
      expectedActionPresent: direction !== 'undo',
      expectedActionRevision: 'action-revision-1',
      expectedPhysicalRevision: direction === 'undo' ? 'physical-after' : 'physical-before',
      expectedPhysicalHash: direction === 'undo' ? 'hash-after' : 'hash-before',
    },
    impactDigest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    retainedArtifact: {
      commandId: 'history-command-10',
      generation: 10,
      actionId,
      managedPath: `scripts/${actionId}.efx-roto-script.json`,
      originalRevision: 'action-revision-1',
      integritySha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    },
    target: {
      physicalRevision: physicalDocument.revision,
      physicalHash: 'target-hash-1',
      physicalDocument,
      selectedGroupId: null,
      cursorAppFrame: 18,
    },
  };
}

function transactionRecord(
  request: PhysicPaintActionTransactionPrepareRequest,
  state: 'prepared' | 'committed' | 'recovery-required',
) {
  return { schemaVersion: 1, state, ...request };
}

function acknowledgeRequest(
  request: PhysicPaintActionTransactionPrepareRequest,
): PhysicPaintActionTransactionAcknowledgeRequest {
  return {
    token: request.token,
    commandId: request.commandId,
    generation: request.generation,
    operationId: request.operationId,
    leaseToken: request.leaseToken,
    direction: request.direction,
  };
}

const releaseRequest: PhysicPaintActionHistoryReleaseRequest = {
  projectContextId: 'project-context-1',
  launchOperationId: 'launch-1',
  commandId: 'history-command-10',
  generation: 10,
  reason: 'eviction',
};

beforeEach(() => {
  invoke.mockReset();
});

describe('script-library Action transaction IPC', () => {
  it('prepares through exactly one command and parses the correlated record', async () => {
    const request = prepareRequest();
    invoke.mockResolvedValueOnce(transactionRecord(request, 'prepared'));

    await expect(scriptLibraryPrepareActionTransaction(authority, request)).resolves.toEqual(
      transactionRecord(request, 'prepared'),
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('script_library_prepare_action_transaction', {
      authority,
      request,
    });
  });

  it('discovers no journal or one exact recoverable durable record without a token guess', async () => {
    const request = prepareRequest();
    invoke.mockResolvedValueOnce(null).mockResolvedValueOnce(transactionRecord(request, 'committed'));
    await expect(scriptLibraryDiscoverActionTransaction(authority)).resolves.toBeNull();
    await expect(scriptLibraryDiscoverActionTransaction(authority)).resolves.toEqual(transactionRecord(request, 'committed'));
    expect(invoke).toHaveBeenNthCalledWith(1, 'script_library_discover_action_transaction', { authority });
    expect(invoke).toHaveBeenNthCalledWith(2, 'script_library_discover_action_transaction', { authority });
  });

  it.each([
    ['commit', scriptLibraryCommitActionTransaction, 'script_library_commit_action_transaction', 'committed'],
    ['status', scriptLibraryActionTransactionStatus, 'script_library_action_transaction_status', 'prepared'],
    ['recover', scriptLibraryRecoverActionTransaction, 'script_library_recover_action_transaction', 'recovery-required'],
  ] as const)('%s invokes only the token command and correlates the durable identity', async (
    _name,
    wrapper,
    command,
    state,
  ) => {
    const request = prepareRequest('redo');
    invoke.mockResolvedValueOnce(transactionRecord(request, state));

    await expect(wrapper(authority, request)).resolves.toEqual(transactionRecord(request, state));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(command, {
      authority,
      request: { token: request.token },
    });
  });

  it('accepts prepared recovery and durable acknowledged status only for the requested token', async () => {
    const request = prepareRequest();
    invoke
      .mockResolvedValueOnce({ state: 'recovered-prepared', token: request.token, actionPresent: true })
      .mockResolvedValueOnce({
        schemaVersion: 1,
        state: 'acknowledged',
        ...acknowledgeRequest(request),
      });

    await expect(scriptLibraryRecoverActionTransaction(authority, request)).resolves.toEqual({
      state: 'recovered-prepared', token: request.token, actionPresent: true,
    });
    await expect(scriptLibraryActionTransactionStatus(authority, request)).resolves.toEqual({
      schemaVersion: 1,
      state: 'acknowledged',
      ...acknowledgeRequest(request),
    });
  });

  it('acknowledges and releases through exact closed requests', async () => {
    const request = prepareRequest();
    const acknowledge = acknowledgeRequest(request);
    invoke
      .mockResolvedValueOnce({ state: 'acknowledged', ...acknowledge, cleaned: true })
      .mockResolvedValueOnce({ state: 'released', ...releaseRequest, released: true });

    await expect(scriptLibraryAcknowledgeActionTransaction(authority, acknowledge)).resolves.toEqual({
      state: 'acknowledged', ...acknowledge, cleaned: true,
    });
    expect(invoke).toHaveBeenNthCalledWith(1, 'script_library_acknowledge_action_transaction', {
      authority,
      request: acknowledge,
    });

    await expect(scriptLibraryReleaseActionHistory(authority, releaseRequest)).resolves.toEqual({
      state: 'released', ...releaseRequest, released: true,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'script_library_release_action_history', {
      authority,
      request: releaseRequest,
    });
  });

  it.each(['token', 'operation', 'lease', 'direction', 'command', 'generation'] as const)(
    'rejects a stale %s response as a typed correlation failure',
    async (field) => {
      const request = prepareRequest();
      const stale = transactionRecord(request, 'committed');
      const response = field === 'token'
        ? { ...stale, token: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }
        : field === 'operation'
          ? { ...stale, operationId: 'stale-operation' }
          : field === 'lease'
            ? { ...stale, leaseToken: 'stale-lease' }
            : field === 'direction'
              ? { ...stale, direction: 'undo', authority: { ...stale.authority, expectedActionPresent: false } }
              : field === 'command'
                ? { ...stale, commandId: 'stale-command', retainedArtifact: { ...stale.retainedArtifact, commandId: 'stale-command' } }
                : { ...stale, generation: 11, retainedArtifact: { ...stale.retainedArtifact, generation: 11 } };
      invoke.mockResolvedValueOnce(response);

      await expect(scriptLibraryCommitActionTransaction(authority, request)).resolves.toMatchObject({
        state: 'failed',
        code: 'correlation-mismatch',
      });
    },
  );

  it('maps malformed replies and invocation failures to closed typed failures', async () => {
    const request = prepareRequest();
    invoke
      .mockResolvedValueOnce({ state: 'committed', token: request.token, unexpected: true })
      .mockRejectedValueOnce(new Error('Action transaction recovery is already required'))
      .mockRejectedValueOnce(new Error('disk unavailable'));

    await expect(scriptLibraryCommitActionTransaction(authority, request)).resolves.toMatchObject({
      state: 'failed', code: 'malformed-response',
    });
    await expect(scriptLibraryPrepareActionTransaction(authority, request)).resolves.toMatchObject({
      state: 'failed', code: 'active-recovery-blocked',
    });
    await expect(scriptLibraryPrepareActionTransaction(authority, request)).resolves.toMatchObject({
      state: 'failed', code: 'invoke-failed',
    });
  });
});
