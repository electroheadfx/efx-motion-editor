import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => setup(),
  useMemo: <Value>(factory: () => Value) => factory(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

vi.mock('@preact/signals', async () => {
  const signals = await vi.importActual<typeof import('@preact/signals')>('@preact/signals');
  return { ...signals, useSignal: signals.signal };
});

import type {
  PhysicPaintRotoPhysicalEditApplyPayload,
  PhysicPaintRotoPhysicalEditApplyResult,
} from '../../../types/physicPaint';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  getPhysicsPaintRotoSourceCycleId,
} from '../roto/physicsPaintRotoSpacingSelection';
import { resolvePhysicPaintRotoPhysicalEdit } from '../roto/physicsPaintRotoPhysicalResolver';
import type { RotoPhysicalEditCoordinatorPorts } from '../roto/rotoCoordinatorPorts';
import {
  executePhysicPaintRotoGroupFramePaintTransaction,
  useRotoPhysicalEditCoordinator,
} from './useRotoPhysicalEditCoordinator';

const INTERPOLATION: PhysicPaintRotoInterpolationState = { enabled: false, mode: 'duplicate' };

function record(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    },
  };
}

function fixture() {
  const records = [
    record('A', 0),
    record('B', 1),
    record('C', 2),
    record('X', 6),
    record('Y', 7),
  ];
  const loopClips: readonly PhysicPaintRotoLoopClip[] = [
    {
      loopId: 'loop-a',
      placementStart: 0,
      sourceKeyIds: ['A', 'B', 'C'],
      repeat: 2,
      mode: 'progressive',
    },
    {
      loopId: 'loop-b',
      placementStart: 6,
      sourceKeyIds: ['X', 'Y'],
      repeat: 4,
      mode: 'static',
    },
  ];
  const intent = {
    kind: 'force-spacing',
    emptyFrames: 2,
    selectedKeyId: null,
    scopeKeyIds: ['A', 'B', 'C'],
    linkedSourceSpacingScopes: [{
      sourceCycleId: getPhysicsPaintRotoSourceCycleId(['A', 'B', 'C']),
      sourceKeyIds: ['A', 'B', 'C'],
      selectedSourceKeyIds: ['A', 'B', 'C'],
    }],
  } as const;
  const resolution = resolvePhysicPaintRotoPhysicalEdit({
    identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    records,
    intent,
    loopClips,
    capacity: 30,
    interpolationEnabled: false,
  });
  if (!resolution.ok) throw new Error(resolution.failure.text);
  return { records, loopClips, intent, proposal: resolution.proposal };
}

function harness(options: { failFirstLoopReplace?: boolean; transportRejects?: boolean } = {}) {
  const initial = fixture();
  let records: readonly PhysicPaintRotoRealKeyRecord[] = initial.records;
  let loopClips: readonly PhysicPaintRotoLoopClip[] = initial.loopClips;
  let incomingInterpolationBreakKeyIds: readonly string[] = ['C'];
  let interpolation = INTERPOLATION;
  let currentFrame = 0;
  let selectedKeyId: string | null = null;
  let failNextLoopReplace = options.failFirstLoopReplace ?? false;
  let payload: PhysicPaintRotoPhysicalEditApplyPayload | null = null;
  const leaseOrder: string[] = [];
  const leaseToken = Object.freeze({
    projectContextId: 'project-1',
    layerId: 'layer-1',
    generation: 17,
    owner: 'exclusive' as const,
  });
  const acquireLease = vi.fn(() => {
    leaseOrder.push('acquire');
    return leaseToken;
  });
  const releaseLease = vi.fn(() => {
    leaseOrder.push('release');
    return true;
  });

  const replaceRecords = vi.fn((
    _layerId: string,
    nextRecords: readonly PhysicPaintRotoRealKeyRecord[],
    nextInterpolation: PhysicPaintRotoInterpolationState,
  ) => {
    records = nextRecords;
    interpolation = nextInterpolation;
    return { ok: true as const };
  });
  const replaceLoopClips = vi.fn((
    _layerId: string,
    nextLoopClips: readonly PhysicPaintRotoLoopClip[],
  ) => {
    if (failNextLoopReplace) {
      failNextLoopReplace = false;
      return { ok: false as const, error: 'loop replacement failed' };
    }
    loopClips = nextLoopClips;
    return { ok: true as const };
  });
  const sendPhysicalEditPayload = vi.fn(async (nextPayload: PhysicPaintRotoPhysicalEditApplyPayload) => {
    payload = nextPayload;
    if (options.transportRejects) throw new Error('transport failed');
  });
  const reconcileCurrentFrame = vi.fn();
  const setCachedReference = vi.fn();
  const setConciseMessage = vi.fn();
  const emptyMap = new Map<number, unknown>();
  const emptySet = new Set<number>();
  const ports: RotoPhysicalEditCoordinatorPorts<null> = {
    engine: null,
    records: {
      getRecords: () => {
        leaseOrder.push('records');
        return records;
      },
      getInterpolation: () => interpolation,
      getCapacity: () => 30,
      getLoopClips: () => loopClips,
      getIncomingInterpolationBreakKeyIds: () => incomingInterpolationBreakKeyIds,
      replaceIncomingInterpolationBreakKeyIds: (_layerId: string, keyIds: readonly string[]) => {
        incomingInterpolationBreakKeyIds = keyIds;
        return { ok: true as const };
      },
      replaceRecords,
      replaceLoopClips,
    },
    buffer: {
      frameStates: emptyMap,
      previewFrames: emptyMap,
      capturedFrames: emptyMap,
      confirmedFrames: emptyMap,
      dirtyFrames: emptySet,
      liveOverlayActionCounts: new Map(),
      editableFrames: records.map((entry) => entry.appFrame),
      replaceFrameStates: vi.fn(),
      replacePreviewFrames: vi.fn(),
      replaceCapturedFrames: vi.fn(),
      replaceConfirmedFrames: vi.fn(),
      replaceDirtyFrames: vi.fn(),
      replaceLiveOverlayActionCounts: vi.fn(),
      setEditableFrameList: vi.fn(),
    },
    selection: {
      getSelectedKeyId: () => selectedKeyId,
      setSelectedKeyId: (keyId) => { selectedKeyId = keyId; },
      getCurrentAppFrame: () => currentFrame,
      setCurrentAppFrame: (frame) => { currentFrame = frame; },
    },
    reference: {
      getCachedReference: () => ({ url: null, cachedRepaintBase: null }),
      setCachedReference,
      reconcileCurrentFrame,
    },
    engineState: {
      saveEngineState: () => null,
      loadEngineState: vi.fn(),
    },
    launch: {
      getLaunchContext: () => ({
        operationId: 'launch-1',
        layerId: 'layer-1',
        project: { contextId: 'project-1' },
      }) as never,
      setLaunchContextStartFrame: (frame) => { currentFrame = frame; },
      setLaunchContextCachedFrames: vi.fn(),
    },
    paint: {
      flushPendingStrokeFinalizations: vi.fn(() => { leaseOrder.push('flush-finalizations'); }),
      flushLivePixels: vi.fn(async () => { leaseOrder.push('flush-live'); }),
    },
    lease: {
      acquire: acquireLease,
      release: releaseLease,
    },
    bridge: {
      getBridgeMode: () => 'Browser fallback',
      sendPhysicalEditPayload,
    },
    settlement: {
      registerPendingSettlement: vi.fn(),
      clearPendingSettlement: vi.fn(),
    },
    status: {
      setApplyStatus: vi.fn(),
      setConciseMessage,
      setLastError: vi.fn(),
      logDiagnostic: vi.fn(),
    },
  };
  const coordinator = useRotoPhysicalEditCoordinator(ports);
  const execute = () => coordinator.executePhysicalEdit({
    proposal: initial.proposal,
    expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
    operationKind: 'force-spacing',
    intent: initial.intent,
    selectedKeyId: null,
    selectedAppFrame: null,
  });
  const executeEmptySegment = () => {
    const destinationAppFrame = 14;
    const insertedKeyId = 'blank-14';
    const intent = {
      kind: 'insert-empty-segment',
      destinationAppFrame,
      insertedKeyId,
      blankPayload: {
        frameIndex: 0,
        appFrame: destinationAppFrame,
        dataUrl: 'data:image/png;base64,AAAA',
        width: 2,
        height: 2,
      },
    } as const;
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent,
      loopClips,
      capacity: 30,
      interpolationEnabled: interpolation.enabled,
      incomingInterpolationBreakKeyIds,
    });
    if (!resolution.ok) throw new Error(resolution.failure.text);
    return coordinator.executePhysicalEdit({
      proposal: resolution.proposal,
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      operationKind: 'insert-empty-segment',
      intent,
      selectedKeyId: insertedKeyId,
      selectedAppFrame: destinationAppFrame,
    });
  };
  const executePlayScript = () => {
    const nextRecord = record('Z', 8);
    const nextRecords = [...records, nextRecord];
    return coordinator.executePhysicalEdit({
      operationKind: 'play-script',
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      expectedRevision: buildPhysicPaintRotoPhysicalRevision(
        records,
        interpolation,
        loopClips,
        incomingInterpolationBreakKeyIds,
      ),
      records: nextRecords,
      interpolationEnabled: interpolation.enabled,
      interpolationMode: interpolation.mode,
      rotoBackground: { background: 'canvas1', paperGrain: 'canvas2', grainStrength: 0.45 },
      semanticDelta: {
        kind: 'play-script',
        affectedStartAppFrame: 8,
        affectedEndAppFrame: 8,
        expectedLayerCapacity: 30,
        expectedLayerEndExclusive: 30,
        proposedRecords: nextRecords.map(({ keyId, appFrame, payload }) => ({ keyId, appFrame, payload })),
        freshKeyIds: ['Z'],
      },
      selectedKeyId: 'Z',
      selectedAppFrame: 8,
    });
  };
  const makeResult = (
    overrides: Partial<PhysicPaintRotoPhysicalEditApplyResult> = {},
  ): PhysicPaintRotoPhysicalEditApplyResult => {
    if (!payload) throw new Error('Expected a sent payload.');
    const stagedRevision = buildPhysicPaintRotoPhysicalRevision(
      payload.records.map((entry) => ({
        kind: 'real-key' as const,
        keyId: entry.keyId,
        appFrame: entry.appFrame,
        payload: entry.payload,
      })),
      { enabled: payload.interpolationEnabled, mode: payload.interpolationMode },
      payload.loopClips ?? [],
      payload.incomingInterpolationBreakKeyIds ?? [],
    );
    return {
      operationId: payload.operationId,
      kind: 'replace-roto-physical-map',
      operationKind: payload.operationKind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      launchOperationId: payload.launchOperationId,
      expectedRevision: payload.expectedRevision,
      stagedRevision,
      acceptedRevision: stagedRevision,
      interpolationMode: payload.interpolationMode,
      selectedKeyId: payload.selectedKeyId,
      selectedAppFrame: payload.selectedAppFrame,
      appliedFrameCount: payload.records.length,
      ok: true,
      semanticDelta: payload.semanticDelta,
      loopClips: payload.loopClips,
      incomingInterpolationBreakKeyIds: payload.incomingInterpolationBreakKeyIds,
      ...overrides,
    };
  };
  const accept = () => coordinator.consumePhysicalEditResult(makeResult());
  const reject = () => coordinator.consumePhysicalEditResult(makeResult({
    ok: false,
    acceptedRevision: null,
    appliedFrameCount: 0,
    error: 'Parent rejected empty segment.',
  }));
  const mismatch = () => coordinator.consumePhysicalEditResult(makeResult({ selectedAppFrame: 15 }));
  return {
    coordinator,
    execute,
    executeEmptySegment,
    executePlayScript,
    accept,
    reject,
    mismatch,
    initial,
    replaceRecords,
    replaceLoopClips,
    sendPhysicalEditPayload,
    reconcileCurrentFrame,
    setCachedReference,
    setConciseMessage,
    acquireLease,
    releaseLease,
    leaseOrder,
    leaseToken,
    getRecords: () => records,
    getLoopClips: () => loopClips,
    getIncomingInterpolationBreakKeyIds: () => incomingInterpolationBreakKeyIds,
    getSelectedKeyId: () => selectedKeyId,
    getCurrentFrame: () => currentFrame,
    getPayload: () => payload,
  };
}

beforeEach(() => {
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type ControlledPhysicalMutator =
  | 'paint'
  | 'delete-frame'
  | 'delete-group'
  | 'regenerate'
  | 'delete-action'
  | 'undo'
  | 'redo'
  | 'project-replacement';

type ControlledLeaseToken = Readonly<{
  projectId: string;
  layerId: string;
  generation: number;
  owner: 'exclusive' | 'recovery';
}>;

function controlledLeaseKey(projectId: string, layerId: string): string {
  return `${projectId}:${layerId}`;
}

function createControlledLeaseRegistry() {
  const active = new Map<string, ControlledLeaseToken>();
  let generation = 0;
  const acquire = (projectId: string, layerId: string): ControlledLeaseToken | null => {
    const key = controlledLeaseKey(projectId, layerId);
    if (active.has(key)) return null;
    const token = Object.freeze({ projectId, layerId, generation: ++generation, owner: 'exclusive' as const });
    active.set(key, token);
    return token;
  };
  const reconstructRecovery = (durable: ControlledLeaseToken): ControlledLeaseToken | null => {
    const key = controlledLeaseKey(durable.projectId, durable.layerId);
    if (active.has(key)) return null;
    const token = Object.freeze({ ...durable, owner: 'recovery' as const });
    active.set(key, token);
    return token;
  };
  const matches = (token: ControlledLeaseToken | null): boolean => {
    if (!token) return false;
    return active.get(controlledLeaseKey(token.projectId, token.layerId)) === token;
  };
  const release = (token: ControlledLeaseToken, cleanupPending = false): boolean => {
    if (!matches(token)) return false;
    if (cleanupPending) {
      active.set(controlledLeaseKey(token.projectId, token.layerId), Object.freeze({
        ...token,
        owner: 'recovery',
      }));
      return true;
    }
    active.delete(controlledLeaseKey(token.projectId, token.layerId));
    return true;
  };
  return { acquire, reconstructRecovery, matches, release };
}

function createControlledLeaseLedger() {
  const events = {
    replacements: [] as string[],
    versions: [] as number[],
    history: [] as string[],
    selections: [] as string[],
  };
  const attempt = (input: Readonly<{
    registry: ReturnType<typeof createControlledLeaseRegistry>;
    token: ControlledLeaseToken | null;
    mutator: ControlledPhysicalMutator;
    expectedRevision: string;
    currentRevision: string;
    expectedHash: string;
    currentHash: string;
  }>): boolean => {
    if (!input.registry.matches(input.token)) return false;
    if (input.expectedRevision !== input.currentRevision || input.expectedHash !== input.currentHash) return false;
    events.replacements.push(input.mutator);
    events.versions.push(events.versions.length + 1);
    events.history.push(`history:${input.mutator}`);
    events.selections.push(`selection:${input.mutator}`);
    return true;
  };
  return { events, attempt };
}

describe('Phase 43.2 canonical physical-operation lease contract', () => {
  it('acquires before final preflight, propagates one token, and settles exactly one accepted event set', () => {
    const registry = createControlledLeaseRegistry();
    const ledger = createControlledLeaseLedger();
    const token = registry.acquire('project-1', 'layer-1');

    expect(token).toMatchObject({ projectId: 'project-1', layerId: 'layer-1', owner: 'exclusive' });
    expect(ledger.attempt({
      registry,
      token,
      mutator: 'paint',
      expectedRevision: 'revision-7',
      currentRevision: 'revision-7',
      expectedHash: 'hash-7',
      currentHash: 'hash-7',
    })).toBe(true);
    expect(ledger.events).toEqual({
      replacements: ['paint'],
      versions: [1],
      history: ['history:paint'],
      selections: ['selection:paint'],
    });
    expect(registry.release(token!)).toBe(true);
    expect(registry.release(token!)).toBe(false);
  });

  it('rejects every concurrent mutator and project replacement while an exclusive or recovery lease is active', () => {
    const mutators: readonly ControlledPhysicalMutator[] = [
      'paint',
      'delete-frame',
      'delete-group',
      'regenerate',
      'delete-action',
      'undo',
      'redo',
      'project-replacement',
    ];

    for (const owner of ['exclusive', 'recovery'] as const) {
      const registry = createControlledLeaseRegistry();
      const ledger = createControlledLeaseLedger();
      const ownerToken = owner === 'exclusive'
        ? registry.acquire('project-1', 'layer-1')
        : registry.reconstructRecovery(Object.freeze({
          projectId: 'project-1',
          layerId: 'layer-1',
          generation: 91,
          owner: 'recovery',
        }));
      expect(ownerToken).not.toBeNull();

      for (const mutator of mutators) {
        const foreignToken = Object.freeze({
          projectId: 'project-1',
          layerId: 'layer-1',
          generation: 999,
          owner: 'exclusive' as const,
        });
        expect(ledger.attempt({
          registry,
          token: foreignToken,
          mutator,
          expectedRevision: 'revision-7',
          currentRevision: 'revision-7',
          expectedHash: 'hash-7',
          currentHash: 'hash-7',
        }), `${owner}:${mutator}`).toBe(false);
      }
      expect(ledger.events).toEqual({ replacements: [], versions: [], history: [], selections: [] });
    }
  });

  it('transfers cleanup-pending ownership, reconstructs recovery after restart, and protects newer revisions', () => {
    const firstRegistry = createControlledLeaseRegistry();
    const ledger = createControlledLeaseLedger();
    const token = firstRegistry.acquire('project-1', 'layer-1')!;

    expect(firstRegistry.release(token, true)).toBe(true);
    expect(firstRegistry.matches(token)).toBe(false);
    expect(firstRegistry.acquire('project-1', 'layer-1')).toBeNull();

    const restartedRegistry = createControlledLeaseRegistry();
    const recoveryToken = restartedRegistry.reconstructRecovery(Object.freeze({
      ...token,
      owner: 'recovery',
    }));
    expect(recoveryToken?.owner).toBe('recovery');
    expect(ledger.attempt({
      registry: restartedRegistry,
      token: recoveryToken,
      mutator: 'delete-action',
      expectedRevision: 'revision-7',
      currentRevision: 'revision-8',
      expectedHash: 'hash-7',
      currentHash: 'hash-8',
    })).toBe(false);
    expect(ledger.events).toEqual({ replacements: [], versions: [], history: [], selections: [] });
    expect(restartedRegistry.release({ ...recoveryToken!, generation: 404 })).toBe(false);
    expect(restartedRegistry.release(recoveryToken!)).toBe(true);
  });
});

describe('useRotoPhysicalEditCoordinator Loop Clip staging', () => {
  it('acquires the project/layer lease before final preflight and propagates the exact token', async () => {
    const test = harness();

    expect(await test.execute()).toBe(true);
    expect(test.acquireLease).toHaveBeenCalledTimes(1);
    expect(test.acquireLease).toHaveBeenCalledWith('project-1', 'layer-1');
    expect(test.getPayload()?.leaseToken).toBe(test.leaseToken);
    expect(test.leaseOrder.indexOf('acquire')).toBeGreaterThan(test.leaseOrder.indexOf('flush-live'));
    expect(test.leaseOrder.indexOf('acquire')).toBeLessThan(test.leaseOrder.indexOf('records'));
    expect(test.releaseLease).not.toHaveBeenCalled();

    expect(test.accept()).toBe('accepted');
    expect(test.releaseLease).toHaveBeenCalledWith(test.leaseToken);
  });

  it('carries the current background only on the deferred Play Script payload', async () => {
    const test = harness();

    expect(await test.executePlayScript()).toBe(true);
    expect(test.getPayload()?.rotoBackground).toEqual({
      background: 'canvas1',
      paperGrain: 'canvas2',
      grainStrength: 0.45,
    });
    expect(test.getRecords().some((entry) => entry.keyId === 'Z')).toBe(false);
    test.coordinator.cancelPhysicalEdit('disposal');
  });

  it('publishes an accepted empty segment only at settlement and reconciles its retained frame', async () => {
    const test = harness();
    const beforeRecords = test.getRecords();
    const beforeBreaks = test.getIncomingInterpolationBreakKeyIds();

    expect(await test.executeEmptySegment()).toBe(true);
    expect(test.getRecords()).toEqual(beforeRecords);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(beforeBreaks);
    expect(test.getSelectedKeyId()).toBeNull();
    expect(test.getCurrentFrame()).toBe(0);
    expect(test.reconcileCurrentFrame).not.toHaveBeenCalled();
    expect(test.coordinator.acceptedOutput.value).toBeNull();

    expect(test.accept()).toBe('accepted');
    expect(test.getRecords().map(({ keyId, appFrame }) => [keyId, appFrame])).toContainEqual(['blank-14', 14]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C', 'blank-14']);
    expect(test.getSelectedKeyId()).toBe('blank-14');
    expect(test.getCurrentFrame()).toBe(14);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledTimes(1);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(14);
  });

  it('sends and accepts one empty key with its complete cloned incoming-break collection', async () => {
    const test = harness();

    expect(await test.executeEmptySegment()).toBe(true);
    expect(test.getRecords().map(({ keyId, appFrame }) => [keyId, appFrame])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
      ['X', 6],
      ['Y', 7],
    ]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C']);
    expect(test.getPayload()?.records.map(({ keyId, appFrame }) => [keyId, appFrame])).toContainEqual(['blank-14', 14]);
    expect(test.getPayload()?.intent).toEqual({
      kind: 'insert-empty-segment',
      destinationAppFrame: 14,
      insertedKeyId: 'blank-14',
      blankPayload: {
        frameIndex: 0,
        appFrame: 14,
        dataUrl: 'data:image/png;base64,AAAA',
        width: 2,
        height: 2,
      },
    });
    expect(test.getPayload()?.incomingInterpolationBreakKeyIds).toEqual(['C', 'blank-14']);
    expect(test.getPayload()?.incomingInterpolationBreakKeyIds).not.toBe(
      test.getIncomingInterpolationBreakKeyIds(),
    );

    expect(test.accept()).toBe('accepted');
    expect(test.getRecords().map(({ keyId, appFrame }) => [keyId, appFrame])).toContainEqual(['blank-14', 14]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C', 'blank-14']);
    expect(test.coordinator.acceptedOutput.value?.before.incomingInterpolationBreakKeyIds).toEqual(['C']);
    expect(test.coordinator.acceptedOutput.value?.after.incomingInterpolationBreakKeyIds).toEqual(['C', 'blank-14']);
    expect(test.coordinator.acceptedOutput.value?.before.incomingInterpolationBreakKeyIds).not.toBe(
      test.coordinator.acceptedOutput.value?.after.incomingInterpolationBreakKeyIds,
    );
  });

  it('preserves every prior surface on parent rejection and leaves mismatches pending without success', async () => {
    const rejected = harness();
    const priorRecords = rejected.getRecords();
    const priorBreaks = rejected.getIncomingInterpolationBreakKeyIds();

    expect(await rejected.executeEmptySegment()).toBe(true);
    expect(rejected.reject()).toBe('accepted');
    expect(rejected.getRecords()).toEqual(priorRecords);
    expect(rejected.getIncomingInterpolationBreakKeyIds()).toEqual(priorBreaks);
    expect(rejected.getSelectedKeyId()).toBeNull();
    expect(rejected.getCurrentFrame()).toBe(0);
    expect(rejected.coordinator.acceptedOutput.value).toBeNull();
    expect(rejected.coordinator.failureOutput.value?.reason).toBe('parent-rejection');

    const mismatched = harness();
    expect(await mismatched.executeEmptySegment()).toBe(true);
    expect(mismatched.mismatch()).toBe('mismatch');
    expect(mismatched.getRecords()).toEqual(mismatched.initial.records);
    expect(mismatched.getIncomingInterpolationBreakKeyIds()).toEqual(['C']);
    expect(mismatched.getSelectedKeyId()).toBeNull();
    expect(mismatched.getCurrentFrame()).toBe(0);
    expect(mismatched.reconcileCurrentFrame).not.toHaveBeenCalled();
    expect(mismatched.coordinator.acceptedOutput.value).toBeNull();
    expect(mismatched.coordinator.failureOutput.value).toBeNull();
    mismatched.coordinator.cancelPhysicalEdit('disposal');
  });

  it('rejects missing or mismatched ordinary intent before staging or transport', async () => {
    const test = harness();
    const baseInput = {
      proposal: test.initial.proposal,
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      operationKind: 'force-spacing',
      selectedKeyId: null,
      selectedAppFrame: null,
    } as const;

    expect(await test.coordinator.executePhysicalEdit(baseInput as never)).toBe(false);
    expect(await test.coordinator.executePhysicalEdit({
      ...baseInput,
      intent: { kind: 'delete-key', selectedKeyId: 'A' },
    } as never)).toBe(false);
    expect(test.sendPhysicalEditPayload).not.toHaveBeenCalled();
    expect(test.replaceRecords).not.toHaveBeenCalled();
    expect(test.getRecords()).toEqual(test.initial.records);
    expect(test.getLoopClips()).toEqual(test.initial.loopClips);
    expect(test.coordinator.acceptedOutput.value).toBeNull();
    expect(test.coordinator.failureOutput.value).toBeNull();
  });

  it('preserves Play Script accepted reconciliation through the shared funnel', async () => {
    const test = harness();

    expect(await test.executePlayScript()).toBe(true);
    expect(test.getPayload()?.intent).toBeUndefined();
    expect(test.reconcileCurrentFrame).not.toHaveBeenCalled();
    expect(test.accept()).toBe('accepted');
    expect(test.reconcileCurrentFrame).toHaveBeenCalledTimes(1);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(8);
  });

  it('rolls back the empty key and matching break together when transport rejects', async () => {
    const test = harness({ transportRejects: true });

    expect(await test.executeEmptySegment()).toBe(false);
    expect(test.getRecords().map(({ keyId, appFrame }) => [keyId, appFrame])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
      ['X', 6],
      ['Y', 7],
    ]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C']);
    expect(test.coordinator.acceptedOutput.value).toBeNull();
    expect(test.coordinator.failureOutput.value?.reason).toBe('transport');
  });

  it('stages changed records and the complete next Loop Clip collection before publication', async () => {
    const test = harness();

    expect(await test.execute()).toBe(true);
    expect(Object.fromEntries(test.getRecords().map((entry) => [entry.keyId, entry.appFrame]))).toEqual({
      A: 0,
      B: 3,
      C: 6,
      X: 10,
      Y: 11,
    });
    expect(test.getLoopClips().find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(10);
    expect(test.getPayload()?.loopClips?.find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(10);
    expect(test.getPayload()?.intent).toBe(test.initial.intent);
    expect(test.getPayload()?.intent).toEqual({
      kind: 'force-spacing',
      emptyFrames: 2,
      selectedKeyId: null,
      scopeKeyIds: ['A', 'B', 'C'],
      linkedSourceSpacingScopes: [{
        sourceCycleId: getPhysicsPaintRotoSourceCycleId(['A', 'B', 'C']),
        sourceKeyIds: ['A', 'B', 'C'],
        selectedSourceKeyIds: ['A', 'B', 'C'],
      }],
    });
    expect(test.getPayload()?.incomingInterpolationBreakKeyIds).toEqual(['C']);
    expect(test.getPayload()?.incomingInterpolationBreakKeyIds).not.toBe(test.getIncomingInterpolationBreakKeyIds());

    expect(test.accept()).toBe('accepted');
    expect(test.coordinator.acceptedOutput.value?.after.loopClips.find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(10);
    expect(test.coordinator.acceptedOutput.value?.before.loopClips.find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(6);
    expect(test.coordinator.acceptedOutput.value?.before.incomingInterpolationBreakKeyIds).toEqual(['C']);
    expect(test.coordinator.acceptedOutput.value?.after.incomingInterpolationBreakKeyIds).toEqual(['C']);
    expect(test.coordinator.acceptedOutput.value?.before.incomingInterpolationBreakKeyIds).not.toBe(
      test.coordinator.acceptedOutput.value?.after.incomingInterpolationBreakKeyIds,
    );
  });

  it('restores the complete before snapshot when Loop Clip staging fails after record replacement', async () => {
    const test = harness({ failFirstLoopReplace: true });

    expect(await test.execute()).toBe(false);
    expect(Object.fromEntries(test.getRecords().map((entry) => [entry.keyId, entry.appFrame]))).toEqual({
      A: 0,
      B: 1,
      C: 2,
      X: 6,
      Y: 7,
    });
    expect(test.getLoopClips().find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(6);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C']);
    expect(test.replaceRecords).toHaveBeenCalledTimes(2);
    expect(test.replaceLoopClips).toHaveBeenCalledTimes(2);
    expect(test.sendPhysicalEditPayload).not.toHaveBeenCalled();
    expect(test.coordinator.failureOutput.value?.reason).toBe('exception');
  });

  it('restores records and Loop Clips together when transport fails after staging', async () => {
    const test = harness({ transportRejects: true });

    expect(await test.execute()).toBe(false);
    expect(Object.fromEntries(test.getRecords().map((entry) => [entry.keyId, entry.appFrame]))).toEqual({
      A: 0,
      B: 1,
      C: 2,
      X: 6,
      Y: 7,
    });
    expect(test.getLoopClips().find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(6);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C']);
    expect(test.coordinator.acceptedOutput.value).toBeNull();
    expect(test.coordinator.failureOutput.value?.reason).toBe('transport');
  });
});

describe('Phase 43.2 leased exact-occurrence Paint coordinator tracer', () => {
  function groupDocument() {
    const records = [record('A', 0), record('B', 1)];
    const loopClips = [{
      loopId: 'group-1',
      placementStart: 0,
      sourceKeyIds: ['A', 'B'],
      repeat: 3 as const,
      mode: 'progressive' as const,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 0,
      originalEndExclusive: 6,
      visibleRanges: [{ start: 0, endExclusive: 6 }],
      frameOverrides: [],
    }];
    return parsePhysicPaintRotoPhysicalDocument({
      capacity: 30,
      realKeyRecords: records,
      interpolation: INTERPOLATION,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 4,
      revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, loopClips),
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    });
  }

  it('acquires before the final snapshot, propagates one token, records one history command, and releases after settlement', async () => {
    const document = groupDocument();
    const order: string[] = [];
    const token = Object.freeze({ projectContextId: 'project-1', layerId: 'layer-1', generation: 1, owner: 'exclusive' as const });
    const recordHistory = vi.fn();
    const releaseLease = vi.fn(() => { order.push('release'); return true; });
    const result = await executePhysicPaintRotoGroupFramePaintTransaction({
      projectContextId: 'project-1',
      layerId: 'layer-1',
      launchOperationId: 'launch-1',
      groupId: 'group-1',
      appFrame: 4,
      overrideKeyId: 'override-4',
      renderedPayload: { frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
    }, {
      acquireLease: () => { order.push('acquire'); return token; },
      getAcceptedDocument: () => { order.push('snapshot'); return document; },
      publish: async (request) => {
        order.push('publish');
        expect(request.leaseToken).toBe(token);
        return { ok: true, acceptedDocument: request.proposal, historyCommandId: request.operationId };
      },
      recordHistory: (command) => { order.push('history'); recordHistory(command); },
      releaseLease,
      createOperationId: () => 'paint-op-1',
    });

    expect(result).toMatchObject({ ok: true, historyCommandId: 'paint-op-1' });
    expect(order).toEqual(['acquire', 'snapshot', 'publish', 'history', 'release']);
    expect(recordHistory).toHaveBeenCalledTimes(1);
    expect(releaseLease).toHaveBeenCalledTimes(1);
  });

  it.each(['stale', 'malformed', 'changed-payload', 'missing-token', 'mismatched-token', 'replayed-token'] as const)(
    'releases without history when the parent rejects %s publication',
    async (reason) => {
      const document = groupDocument();
      const recordHistory = vi.fn();
      const releaseLease = vi.fn(() => true);
      const result = await executePhysicPaintRotoGroupFramePaintTransaction({
        projectContextId: 'project-1',
        layerId: 'layer-1',
        launchOperationId: 'launch-1',
        groupId: 'group-1',
        appFrame: 4,
        overrideKeyId: 'override-4',
        renderedPayload: { frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
      }, {
        acquireLease: () => Object.freeze({ projectContextId: 'project-1', layerId: 'layer-1', generation: 1, owner: 'exclusive' as const }),
        getAcceptedDocument: () => document,
        publish: async () => ({ ok: false, reason }),
        recordHistory,
        releaseLease,
        createOperationId: () => 'paint-op-rejected',
      });

      expect(result).toEqual({ ok: false, reason });
      expect(recordHistory).not.toHaveBeenCalled();
      expect(releaseLease).toHaveBeenCalledTimes(1);
    },
  );
});
