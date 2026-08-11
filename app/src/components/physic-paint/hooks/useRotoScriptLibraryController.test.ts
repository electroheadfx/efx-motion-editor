import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintScriptLibraryRequest, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { createRotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import { RotoScriptClipboardReplacementOutcome, type PreparedRotoScriptLoadAndApply } from '../roto/physicsPaintRotoScriptClipboard';
import { createPersistedRotoScript } from '../roto/physicsPaintRotoScriptSchema';
import {
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  createReferencedActionHistoryReleaseManager,
  createReferencedActionHistoryReplayOrchestrator,
  createRotoScriptLibraryControllerAdapter,
  createRotoScriptLibraryRequestLifecycle,
} from './useRotoScriptLibraryController';
import type { ReferencedActionHistoryCommand } from './useRotoPhysicalEditHistory';

const launchContext = (): PhysicPaintLaunchContext => ({ operationId: 'launch', layerId: 'layer-1', layerName: 'Ink', startFrame: 4, width: 1600, height: 900, project: { name: 'Project', saved: true, contextId: 'context-1' } });
const row = { id: '123e4567-e89b-42d3-a456-426614174000', revision: 'rev-1', integritySha256: 'a'.repeat(64), name: 'Script', createdAt: '2026-07-16T12:00:00Z', updatedAt: '2026-07-16T12:00:00Z', source: { projectName: 'Project', layerId: 'layer-1', layerName: 'Ink', sourceFrame: 4, displayFrame: 4, width: 1600, height: 900, background: { background: 'white' as const, paperGrain: 'canvas1', grainStrength: 0 } }, thumbnail: { mimeType: 'image/webp' as const, width: 1, height: 1, quality: 0.8, dataUrl: 'data:image/webp;base64,UklGRgQAAABXRUJQ' }, brushCount: 1 };
const script = createPersistedRotoScript({ id: row.id, name: row.name, createdAt: row.createdAt, updatedAt: row.updatedAt, source: row.source, thumbnail: { ...row.thumbnail, dataUrl: 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAUAAAAvAAAAAAA=' }, brushes: [{ primary: { tool: 'paint', points: [{ x: 10, y: 2, p: 1, tx: 0, ty: 0, tw: 0, spd: 0 }], color: '#000000', params: { size: 1, opacity: 100, pressure: 100, waterAmount: 0, dryAmount: 0, edgeDetail: 0, pickup: 0, eraseStrength: 0, antiAlias: 0 }, timestamp: 1 }, continuations: [] }] });

function result(request: PhysicPaintScriptLibraryRequest, extra: Partial<PhysicPaintScriptLibraryResult> = {}): PhysicPaintScriptLibraryResult {
  return { operationId: request.operationId, kind: request.kind, ok: true, rows: [row], skippedInvalidCount: 0, diagnostics: [], ...extra };
}

describe('persistent Roto script library hook adapters', () => {
  it('redetects bridge mode at action time and settles timeout/send/result exactly once', async () => {
    const detectBridgeMode = vi.fn(async () => 'Browser fallback' as const);
    const sendRequest = vi.fn(async () => {});
    let timeoutCallback!: () => void;
    const clearRequestTimeout = vi.fn();
    const lifecycle = createRotoScriptLibraryRequestLifecycle({
      getBridgeMode: () => 'Unavailable', detectBridgeMode, sendRequest,
      setRequestTimeout: (callback) => { timeoutCallback = callback; return 17 as unknown as ReturnType<typeof setTimeout>; },
      clearRequestTimeout,
    });
    const request = { kind: 'scan', operationId: 'scan-1' } as const;
    const pending = lifecycle.request(request);
    await vi.waitFor(() => expect(sendRequest).toHaveBeenCalledWith(request, 'Browser fallback'));
    expect(detectBridgeMode).toHaveBeenCalledOnce();
    lifecycle.handleResult(result(request));
    await expect(pending).resolves.toMatchObject({ ok: true, operationId: 'scan-1' });
    timeoutCallback();
    expect(lifecycle.pendingCount()).toBe(0);
    expect(clearRequestTimeout).toHaveBeenCalledOnce();
  });

  it('forwards live referenced-Action transaction ports through the production adapter', () => {
    const referencedActionDeletion = {
      getPhysicalDocument: vi.fn(), acquireLease: vi.fn(), releaseLease: vi.fn(), nextUuid: vi.fn(), nextGeneration: vi.fn(),
      digest: vi.fn(), prepare: vi.fn(), commit: vi.fn(),
    };
    const ports = {
      request: vi.fn(), capturePersistence: vi.fn(), captureThumbnail: vi.fn(), replaceClipboard: vi.fn(),
      getLaunchContext: launchContext, log: vi.fn(), referencedActionDeletion,
    };
    const adapter = createRotoScriptLibraryControllerAdapter(() => ports, ports.request);
    expect(adapter.referencedActionDeletion).toBe(referencedActionDeletion);
    const replacement = { ...referencedActionDeletion, getPhysicalDocument: vi.fn() };
    ports.referencedActionDeletion = replacement;
    expect(adapter.referencedActionDeletion).toBe(replacement);
  });

  it('forwards the exact preparation token through the production adapter and composes one Apply', async () => {
    let settleLoad!: (value: PhysicPaintScriptLibraryResult) => void;
    const request = vi.fn(async (input: PhysicPaintScriptLibraryRequest) => input.kind === 'scan'
      ? result(input)
      : new Promise<PhysicPaintScriptLibraryResult>((resolve) => { settleLoad = resolve; }));
    const preparation: PreparedRotoScriptLoadAndApply = { preparationId: Symbol('prepared') };
    const replaceClipboard = vi.fn((_script, received?: PreparedRotoScriptLoadAndApply) => received === preparation
      ? RotoScriptClipboardReplacementOutcome.Replaced
      : RotoScriptClipboardReplacementOutcome.Rejected);
    const applyPreparedScript = vi.fn(async (received: PreparedRotoScriptLoadAndApply) => received === preparation);
    const log = vi.fn();
    const ports = { request, capturePersistence: vi.fn(async () => null), captureThumbnail: vi.fn(), replaceClipboard, getLaunchContext: launchContext, log };
    const controller = createRotoScriptLibraryController(createRotoScriptLibraryControllerAdapter(() => ports, request));
    await controller.refresh();
    const loading = controller.activateAndLoad(row.id, preparation);
    settleLoad(result(request.mock.calls[1][0], { script }));
    await expect(loading).resolves.toBe(true);
    expect(replaceClipboard).toHaveBeenCalledWith(expect.any(Object), preparation);
    await expect(applyPreparedScript(preparation)).resolves.toBe(true);
    expect(applyPreparedScript).toHaveBeenCalledOnce();
  });

  it.each(['source', 'engine', 'launch', 'dispose'] as const)('keeps stale prepared %s completion silent and immutable', async () => {
    let settleLoad!: (value: PhysicPaintScriptLibraryResult) => void;
    const request = vi.fn(async (input: PhysicPaintScriptLibraryRequest) => input.kind === 'scan'
      ? result(input)
      : new Promise<PhysicPaintScriptLibraryResult>((resolve) => { settleLoad = resolve; }));
    const preparation: PreparedRotoScriptLoadAndApply = { preparationId: Symbol('prepared') };
    let valid = true;
    const clipboard = { current: 'prior' };
    const applyPreparedScript = vi.fn(async () => false);
    const log = vi.fn();
    const ports = { request, capturePersistence: vi.fn(async () => null), captureThumbnail: vi.fn(), replaceClipboard: vi.fn(() => valid ? RotoScriptClipboardReplacementOutcome.Replaced : RotoScriptClipboardReplacementOutcome.Stale), getLaunchContext: launchContext, log };
    const controller = createRotoScriptLibraryController(createRotoScriptLibraryControllerAdapter(() => ports, request));
    await controller.refresh();
    controller.select(row.id);
    controller.status.value = 'Prior status';
    const previousRows = controller.rows.value;
    const loading = controller.activateAndLoad(row.id, preparation);
    valid = false;
    settleLoad(result(request.mock.calls[1][0], { script }));
    await expect(loading).resolves.toBe(false);
    expect(clipboard.current).toBe('prior');
    expect(controller.rows.value).toBe(previousRows);
    expect(controller.selectedId.value).toBe(row.id);
    expect(controller.status.value).toBe('Prior status');
    expect(log).not.toHaveBeenCalled();
    expect(applyPreparedScript).not.toHaveBeenCalled();
  });

  it('settles pending requests on cleanup, clears timeout, and ignores late bridge results', async () => {
    const clearRequestTimeout = vi.fn();
    const lifecycle = createRotoScriptLibraryRequestLifecycle({
      getBridgeMode: () => 'Tauri', detectBridgeMode: vi.fn(), sendRequest: vi.fn(async () => {}),
      setRequestTimeout: () => 29 as unknown as ReturnType<typeof setTimeout>, clearRequestTimeout,
    });
    const request = { kind: 'load', operationId: 'load-1', scriptId: row.id } as const;
    const pending = lifecycle.request(request);
    lifecycle.dispose();
    await expect(pending).resolves.toMatchObject({ operationId: 'load-1', kind: 'load', ok: false, error: 'Script library request was disposed.' });
    expect(lifecycle.pendingCount()).toBe(0);
    expect(clearRequestTimeout).toHaveBeenCalledOnce();
    lifecycle.handleResult(result(request, { script }));
    expect(clearRequestTimeout).toHaveBeenCalledOnce();
  });
});

interface RecoveredDeleteOperation {
  commandId: string;
  generation: number;
  token: string;
  direction: 'forward' | 'undo' | 'redo';
  expectedRevision: string;
}

class DeleteOperationCorrelationHarness {
  private active: RecoveredDeleteOperation | null = null;
  private completed = new Set<string>();

  begin(operation: RecoveredDeleteOperation) {
    const key = this.key(operation);
    if (this.active || this.completed.has(key)) return false;
    this.active = { ...operation };
    return true;
  }

  acceptCommitted(operation: RecoveredDeleteOperation, currentRevision: string) {
    if (!this.active || this.key(this.active) !== this.key(operation) || currentRevision !== operation.expectedRevision) return false;
    this.completed.add(this.key(operation));
    this.active = null;
    return true;
  }

  reconstruct(operation: RecoveredDeleteOperation) {
    if (this.active && this.key(this.active) !== this.key(operation)) return false;
    if (this.completed.has(this.key(operation))) return false;
    this.active = { ...operation };
    return true;
  }

  private key(operation: RecoveredDeleteOperation) {
    return `${operation.commandId}:${operation.generation}:${operation.token}:${operation.direction}`;
  }
}

describe('production referenced Action history direction orchestration', () => {
  it.each([
    { direction: 'undo' as const, expectedActionPresent: false },
    { direction: 'redo' as const, expectedActionPresent: true },
  ])('waits for matching Rust committed $direction before settlement and acknowledgement', async ({ direction, expectedActionPresent }) => {
    const document = (cursorAppFrame: number) => {
      const interpolation = { enabled: false as const, mode: 'duplicate' as const };
      const revision = buildPhysicPaintRotoPhysicalRevision([], interpolation, [], []);
      return {
        realKeyRecords: [],
        interpolation,
        scriptMotion: { deformation: 0, position: 0 },
        background: null,
        capacity: 10,
        selectedKeyId: null,
        cursorAppFrame,
        revision,
        loopClips: [],
        incomingInterpolationBreakKeyIds: [],
      };
    };
    const beforeDocument = document(4);
    const afterDocument = document(5);
    const command: ReferencedActionHistoryCommand = {
      kind: 'referenced-action',
      commandId: 'history-command-1',
      generation: 7,
      mode: 'delete-action-and-groups',
      retainedArtifact: {
        commandId: 'history-command-1', generation: 7, actionId: row.id,
        managedPath: `scripts/${row.id}.efx-roto-script.json`, originalRevision: row.revision,
        integritySha256: row.integritySha256,
      },
      authority: {
        projectContextId: 'context-1', layerId: 'layer-1', launchOperationId: 'launch',
        scriptLibraryAuthority: 'native-authority', actionId: row.id, actionRevision: row.revision,
      },
      before: {
        physicalRevision: beforeDocument.revision,
        physicalHash: buildPhysicPaintRotoProjectEquality(beforeDocument),
        document: beforeDocument,
        selectedGroupId: 'group-1',
        cursorAppFrame: beforeDocument.cursorAppFrame,
      },
      after: {
        physicalRevision: afterDocument.revision,
        physicalHash: buildPhysicPaintRotoProjectEquality(afterDocument),
        document: afterDocument,
        selectedGroupId: null,
        cursorAppFrame: afterDocument.cursorAppFrame,
      },
    };
    const source = direction === 'undo' ? command.after : command.before;
    const target = direction === 'undo' ? command.before : command.after;
    const events: string[] = [];
    const prepare = vi.fn(async (_authority, request) => {
      events.push('prepare');
      return { ...request, schemaVersion: 1 as const, state: 'prepared' as const };
    });
    const commit = vi.fn(async (_authority, request) => {
      events.push('commit');
      return { ...request, schemaVersion: 1 as const, state: 'committed' as const };
    });
    const settle = vi.fn(() => { events.push('settle'); return { ok: true as const }; });
    const acknowledge = vi.fn(async (_authority, request) => {
      events.push('acknowledge');
      return { ...request, state: 'acknowledged' as const, cleaned: true };
    });
    const releaseLease = vi.fn(() => { events.push('release-lease'); return true; });
    const replay = createReferencedActionHistoryReplayOrchestrator({
      getPhysicalDocument: () => source.document,
      getActionRevision: () => expectedActionPresent ? row.revision : null,
      getAuthority: () => 'native-authority',
      acquireLease: () => 'context-1:layer-1:8:history-replay',
      releaseLease,
      nextUuid: () => `${direction}-token`,
      digest: async () => 'impact-digest',
      prepare,
      commit,
      settle,
      acknowledge,
    });

    await expect(replay(command, direction)).resolves.toBe(true);
    expect(events).toEqual(['prepare', 'commit', 'settle', 'acknowledge', 'release-lease']);
    const request = prepare.mock.calls[0][1];
    expect(request).toMatchObject({
      token: `${direction}-token`,
      commandId: command.commandId,
      generation: command.generation,
      direction,
      mode: command.mode,
      authority: {
        projectContextId: command.authority.projectContextId,
        layerId: command.authority.layerId,
        launchOperationId: command.authority.launchOperationId,
        actionId: command.authority.actionId,
        expectedActionPresent,
        expectedActionRevision: command.authority.actionRevision,
        expectedPhysicalRevision: source.physicalRevision,
      },
      target: { physicalRevision: target.physicalRevision },
    });
    expect(commit.mock.calls[0][1]).toBe(request);
    expect(settle).toHaveBeenCalledWith({ command, committed: expect.objectContaining({ state: 'committed', direction }), direction, leaseToken: request.leaseToken });
  });

  it('rejects changed source authority before Rust prepare or lease acquisition', async () => {
    const acquireLease = vi.fn(() => 'lease');
    const prepare = vi.fn();
    const replay = createReferencedActionHistoryReplayOrchestrator({
      getPhysicalDocument: () => null,
      getActionRevision: () => null,
      getAuthority: () => 'native-authority',
      acquireLease,
      releaseLease: vi.fn(() => true),
      nextUuid: () => 'token',
      digest: async () => 'digest',
      prepare,
      commit: vi.fn(),
      settle: vi.fn(),
      acknowledge: vi.fn(),
    });
    const command = { commandId: 'history-command', generation: 1 } as ReferencedActionHistoryCommand;
    await expect(replay(command, 'undo')).resolves.toBe(false);
    expect(acquireLease).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });
});

describe('retained Action history release correlation', () => {
  it('defers active-recovery release and retries the exact owner without visible state', async () => {
    let attempt = 0;
    const release = vi.fn(async (_authority, request) => {
      attempt += 1;
      return attempt === 1
        ? { state: 'failed' as const, code: 'active-recovery-blocked' as const, error: 'Recovery is active.' }
        : { ...request, state: 'released' as const, released: true };
    });
    const manager = createReferencedActionHistoryReleaseManager({ release });
    const command = {
      kind: 'referenced-action',
      commandId: 'history-command-release',
      generation: 12,
      authority: {
        projectContextId: 'context-1', launchOperationId: 'launch', scriptLibraryAuthority: 'native-authority',
      },
    } as ReferencedActionHistoryCommand;

    await expect(manager.release(command, 'eviction')).resolves.toBe(false);
    expect(manager.pendingCount()).toBe(1);
    await expect(manager.retryDeferred()).resolves.toBe(true);
    expect(manager.pendingCount()).toBe(0);
    expect(release).toHaveBeenCalledTimes(2);
    expect(release.mock.calls[0]).toEqual(release.mock.calls[1]);
    expect(release).toHaveBeenCalledWith('native-authority', {
      projectContextId: 'context-1',
      launchOperationId: 'launch',
      commandId: 'history-command-release',
      generation: 12,
      reason: 'eviction',
    });
  });
});

describe('Wave 0 durable referenced-delete request correlation', () => {
  it('rejects stale or replayed direction, token, generation, and newer-document settlement', () => {
    const harness = new DeleteOperationCorrelationHarness();
    const operation: RecoveredDeleteOperation = {
      commandId: 'history-command-1',
      generation: 3,
      token: 'forward-token',
      direction: 'forward',
      expectedRevision: 'physical-before',
    };
    expect(harness.begin(operation)).toBe(true);
    expect(harness.acceptCommitted({ ...operation, token: 'stale-token' }, operation.expectedRevision)).toBe(false);
    expect(harness.acceptCommitted({ ...operation, generation: 4 }, operation.expectedRevision)).toBe(false);
    expect(harness.acceptCommitted({ ...operation, direction: 'redo' }, operation.expectedRevision)).toBe(false);
    expect(harness.acceptCommitted(operation, 'newer-document')).toBe(false);
    expect(harness.acceptCommitted(operation, operation.expectedRevision)).toBe(true);
    expect(harness.begin(operation)).toBe(false);
    expect(harness.reconstruct(operation)).toBe(false);
  });

  it('reconstructs an exact startup recovery lease and refuses changed-content identity reuse', () => {
    const harness = new DeleteOperationCorrelationHarness();
    const recovered: RecoveredDeleteOperation = {
      commandId: 'history-command-2',
      generation: 8,
      token: 'undo-token',
      direction: 'undo',
      expectedRevision: 'physical-after-forward',
    };
    expect(harness.reconstruct(recovered)).toBe(true);
    expect(harness.reconstruct({ ...recovered, direction: 'redo' })).toBe(false);
    expect(harness.acceptCommitted(recovered, recovered.expectedRevision)).toBe(true);
  });
});
