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
import { proposePhysicPaintRotoRegenerateGroup } from '../roto/physicsPaintRotoGroupLifecycle';
import { createRotoLivePixelCacheTransactions } from '../roto/rotoLivePixelCacheTransactions';
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

function groupLifecycleDocument(options: {
  gapAt?: number;
  existingOverride?: boolean;
  selectedKeyId?: string | null;
  cursorAppFrame?: number;
  sharedSourceOwner?: boolean;
} = {}) {
  const records = [record('A', 0), record('B', 1)];
  const groupOverrideRecords = options.existingOverride ? [record('override-4', 0)] : [];
  const visibleRanges = options.gapAt === undefined
    ? [{ start: 0, endExclusive: 6 }]
    : [
        { start: 1, endExclusive: 2 },
        { start: 3, endExclusive: 4 },
        { start: 5, endExclusive: 6 },
      ];
  const primaryGroup: PhysicPaintRotoLoopClip = {
    loopId: 'group-1',
    placementStart: 0,
    sourceKeyIds: ['A', 'B'],
    repeat: 3,
    mode: 'progressive',
    scriptId: 'action-1',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: options.gapAt === undefined && !options.existingOverride ? 'synchronized' : 'modified',
    provenanceState: 'attached',
    phaseOrigin: 0,
    originalEndExclusive: 6,
    visibleRanges,
    frameOverrides: options.existingOverride ? [{ appFrame: 0, keyId: 'override-4' }] : [],
  };
  const loopClips: readonly PhysicPaintRotoLoopClip[] = options.sharedSourceOwner
    ? [
        primaryGroup,
        {
          loopId: 'group-shared',
          placementStart: 8,
          sourceKeyIds: ['A', 'B'],
          repeat: 1,
          mode: 'progressive',
          scriptId: 'action-1',
          motion: { deformation: 0, position: 0 },
          overrideColor: null,
          syncState: 'synchronized',
          provenanceState: 'attached',
          phaseOrigin: 8,
          originalEndExclusive: 10,
          visibleRanges: [{ start: 8, endExclusive: 10 }],
          frameOverrides: [],
        },
      ]
    : [primaryGroup];
  return parsePhysicPaintRotoPhysicalDocument({
    capacity: 30,
    realKeyRecords: records,
    groupOverrideRecords,
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: options.selectedKeyId ?? null,
    cursorAppFrame: options.cursorAppFrame ?? 4,
    revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, loopClips, ['B'], groupOverrideRecords),
    loopClips,
    incomingInterpolationBreakKeyIds: ['B'],
  });
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
      repeat: 3,
      mode: 'progressive',
      scriptId: 'action-spacing',
      motion: { deformation: 4, position: 2 },
      overrideColor: '#123456',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: 9,
      visibleRanges: [{ start: 0, endExclusive: 9 }],
      frameOverrides: [],
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

function harness(options: {
  failFirstLoopReplace?: boolean;
  transportRejects?: boolean;
  flushLivePixels?: (appFrame?: number) => Promise<void>;
} = {}) {
  const initial = fixture();
  let records: readonly PhysicPaintRotoRealKeyRecord[] = initial.records;
  let groupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[] = [];
  let loopClips: readonly PhysicPaintRotoLoopClip[] = initial.loopClips;
  let incomingInterpolationBreakKeyIds: readonly string[] = ['C'];
  let interpolation = INTERPOLATION;
  let currentFrame = 0;
  let selectedKeyId: string | null = null;
  let canonicalCursorAppFrame = 0;
  let canonicalSelectedKeyId: string | null = null;
  let failNextDocumentReplace = options.failFirstLoopReplace ?? false;
  let payload: PhysicPaintRotoPhysicalEditApplyPayload | null = null;
  let structuralPublicationCount = 0;
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
  const recoveryLeaseToken = Object.freeze({ ...leaseToken, owner: 'recovery' as const });
  const transferLeaseToRecovery = vi.fn(() => {
    leaseOrder.push('transfer-recovery');
    return recoveryLeaseToken;
  });

  const replaceRecords = vi.fn((
    _layerId: string,
    nextRecords: readonly PhysicPaintRotoRealKeyRecord[],
    nextInterpolation: PhysicPaintRotoInterpolationState,
  ) => {
    records = nextRecords;
    interpolation = nextInterpolation;
    structuralPublicationCount += 1;
    return { ok: true as const };
  });
  const replaceLoopClips = vi.fn((
    _layerId: string,
    nextLoopClips: readonly PhysicPaintRotoLoopClip[],
  ) => {
    loopClips = nextLoopClips;
    structuralPublicationCount += 1;
    return { ok: true as const };
  });
  const sendPhysicalEditPayload = vi.fn(async (nextPayload: PhysicPaintRotoPhysicalEditApplyPayload) => {
    payload = nextPayload;
    if (options.transportRejects) throw new Error('transport failed');
  });
  const reconcileCurrentFrame = vi.fn();
  const setCachedReference = vi.fn();
  const setConciseMessage = vi.fn();
  const flushLivePixels = vi.fn(options.flushLivePixels ?? (async () => { leaseOrder.push('flush-live'); }));
  const sharedCacheFact = Object.freeze({ owner: 'shared-source', sourceKeyIds: ['A', 'B'] as const });
  const frameStates = new Map<number, unknown>([[0, sharedCacheFact]]);
  const previewFrames = new Map<number, unknown>([[1, sharedCacheFact]]);
  const capturedFrames = new Map<number, unknown>([[8, sharedCacheFact]]);
  const confirmedFrames = new Map<number, unknown>([[9, sharedCacheFact]]);
  const emptySet = new Set<number>();
  const seedCacheFrames = (frames: readonly number[]) => {
    for (const frame of frames) {
      frameStates.set(frame, sharedCacheFact);
      previewFrames.set(frame, sharedCacheFact);
      capturedFrames.set(frame, sharedCacheFact);
      confirmedFrames.set(frame, sharedCacheFact);
      emptySet.add(frame);
    }
  };
  const cachedReference = Object.freeze({
    url: 'blob:shared-source-reference',
    cachedRepaintBase: Object.freeze({
      frameIndex: 0,
      appFrame: 0,
      dataUrl: 'data:image/png;base64,U0hBUkVE',
      width: 2,
      height: 2,
    }),
  });
  const registerPendingSettlement = vi.fn();
  const clearPendingSettlement = vi.fn();
  const getCanonicalDocument = () => parsePhysicPaintRotoPhysicalDocument({
    capacity: 30,
    realKeyRecords: records,
    groupOverrideRecords,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: canonicalSelectedKeyId,
    cursorAppFrame: canonicalCursorAppFrame,
    revision: buildPhysicPaintRotoPhysicalRevision(
      records,
      interpolation,
      loopClips,
      incomingInterpolationBreakKeyIds,
      groupOverrideRecords,
    ),
    loopClips,
    incomingInterpolationBreakKeyIds,
  });
  const replaceDocument = vi.fn((
    _layerId: string,
    document: ReturnType<typeof parsePhysicPaintRotoPhysicalDocument>,
  ) => {
    if (failNextDocumentReplace) {
      failNextDocumentReplace = false;
      return { ok: false as const, error: 'document replacement failed' };
    }
    records = document.realKeyRecords;
    groupOverrideRecords = document.groupOverrideRecords ?? [];
    interpolation = document.interpolation;
    loopClips = document.loopClips;
    incomingInterpolationBreakKeyIds = document.incomingInterpolationBreakKeyIds;
    canonicalSelectedKeyId = document.selectedKeyId;
    canonicalCursorAppFrame = document.cursorAppFrame;
    structuralPublicationCount += 1;
    return { ok: true as const, document };
  });
  const ports: RotoPhysicalEditCoordinatorPorts<null> = {
    engine: null,
    records: {
      getRecords: () => {
        leaseOrder.push('records');
        return records;
      },
      getDocument: getCanonicalDocument,
      replaceDocument,
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
      frameStates,
      previewFrames,
      capturedFrames,
      confirmedFrames,
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
      evictAcceptedFrames: (frames) => {
        const affected = new Set(frames);
        for (const frame of affected) {
          frameStates.delete(frame);
          previewFrames.delete(frame);
          capturedFrames.delete(frame);
          confirmedFrames.delete(frame);
          emptySet.delete(frame);
        }
      },
    },
    selection: {
      getSelectedKeyId: () => selectedKeyId,
      setSelectedKeyId: (keyId) => { selectedKeyId = keyId; },
      getCurrentAppFrame: () => currentFrame,
      setCurrentAppFrame: (frame) => { currentFrame = frame; },
    },
    reference: {
      getCachedReference: () => cachedReference,
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
      flushLivePixels,
    },
    lease: {
      acquire: acquireLease,
      release: releaseLease,
      transferToRecovery: transferLeaseToRecovery,
    },
    bridge: {
      getBridgeMode: () => 'Browser fallback',
      sendPhysicalEditPayload,
    },
    settlement: {
      registerPendingSettlement,
      clearPendingSettlement,
    },
    status: {
      setApplyStatus: vi.fn(),
      setConciseMessage,
      setLastError: vi.fn(),
      logDiagnostic: vi.fn(),
    },
  };
  const coordinator = useRotoPhysicalEditCoordinator(ports);
  const acceptedEvents: Array<NonNullable<typeof coordinator.acceptedOutput.value>> = [];
  const versionEvents: number[] = [];
  const historyCommands: string[] = [];
  coordinator.acceptedOutput.subscribe((value) => {
    if (!value) return;
    acceptedEvents.push(value);
    versionEvents.push(versionEvents.length + 1);
    historyCommands.push(value.operationId);
  });
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
  const seedGroupDocument = (document: ReturnType<typeof parsePhysicPaintRotoPhysicalDocument>) => {
    records = document.realKeyRecords;
    groupOverrideRecords = document.groupOverrideRecords ?? [];
    loopClips = document.loopClips;
    incomingInterpolationBreakKeyIds = document.incomingInterpolationBreakKeyIds;
    interpolation = document.interpolation;
    currentFrame = document.cursorAppFrame;
    selectedKeyId = document.selectedKeyId;
    canonicalCursorAppFrame = document.cursorAppFrame;
    canonicalSelectedKeyId = document.selectedKeyId;
  };
  const setStudioSelection = (keyId: string | null, appFrame: number) => {
    selectedKeyId = keyId;
    currentFrame = appFrame;
  };
  const publishCanonicalGroupSelection = (appFrame: number) => {
    selectedKeyId = null;
    currentFrame = appFrame;
    canonicalSelectedKeyId = null;
    canonicalCursorAppFrame = appFrame;
  };
  const executeGroupPaint = (appFrame: number, overrideKeyId: string, dataUrl = 'data:image/png;base64,UEFJTlQ=') => coordinator.executePhysicalEdit({
    operationKind: 'paint-group-frame',
    expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
    groupId: 'group-1',
    appFrame,
    overrideKeyId,
    renderedPayload: { frameIndex: 0, appFrame, dataUrl },
  });
  const executeDeleteGroupFrame = (appFrame: number) => coordinator.executePhysicalEdit({
    operationKind: 'delete-group-frame',
    expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
    groupId: 'group-1',
    appFrame,
  });
  const executeDeleteGroup = () => coordinator.executePhysicalEdit({
    operationKind: 'delete-group',
    expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
    groupId: 'group-1',
    appFrame: currentFrame,
  });
  const executeRegenerateGroup = () => {
    const currentDocument = getCanonicalDocument();
    const regeneratedRecords = currentDocument.realKeyRecords.map((entry) => (
      entry.keyId === 'A' || entry.keyId === 'B'
        ? { ...entry, payload: { ...entry.payload, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' } }
        : entry
    ));
    const sourceUpdatedDocument = parsePhysicPaintRotoPhysicalDocument({
      ...currentDocument,
      realKeyRecords: regeneratedRecords,
      revision: buildPhysicPaintRotoPhysicalRevision(
        regeneratedRecords,
        currentDocument.interpolation,
        currentDocument.loopClips,
        currentDocument.incomingInterpolationBreakKeyIds,
        currentDocument.groupOverrideRecords,
      ),
    });
    const proposed = proposePhysicPaintRotoRegenerateGroup({
      document: sourceUpdatedDocument,
      groupId: 'group-1',
      expectedActionRevision: 'action-revision-1',
      currentActionRevision: 'action-revision-1',
    });
    if (!proposed.ok) throw new Error(proposed.reason);
    const retainedIds = new Set((proposed.proposal.groupOverrideRecords ?? []).map((entry) => entry.keyId));
    return coordinator.executePhysicalEdit({
      operationKind: 'regenerate-group',
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      expectedRevision: currentDocument.revision,
      records: proposed.proposal.realKeyRecords,
      groupOverrideRecords: proposed.proposal.groupOverrideRecords ?? [],
      interpolationEnabled: proposed.proposal.interpolation.enabled,
      interpolationMode: proposed.proposal.interpolation.mode,
      semanticDelta: {
        kind: 'regenerate-group',
        groupId: 'group-1',
        expectedActionRevision: 'action-revision-1',
        cleanupKeyIds: (currentDocument.groupOverrideRecords ?? [])
          .map((entry) => entry.keyId)
          .filter((keyId) => !retainedIds.has(keyId)),
        previousRevision: currentDocument.revision,
        nextRevision: proposed.proposal.revision,
      },
      selectedKeyId: proposed.proposal.selectedKeyId,
      selectedAppFrame: proposed.proposal.selectedKeyId === null ? null : proposed.proposal.cursorAppFrame,
      loopClips: proposed.proposal.loopClips,
    });
  };
  const executePlayScript = (revalidateAfterLease?: () => Promise<boolean>) => {
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
        groupOverrideRecords,
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
      ...(revalidateAfterLease ? { revalidateAfterLease } : {}),
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
      (payload.groupOverrideRecords ?? []).map((entry) => ({ kind: 'real-key' as const, ...entry })),
    );
    return {
      operationId: payload.operationId,
      kind: 'replace-roto-physical-map',
      operationKind: payload.operationKind,
      layerId: payload.layerId,
      startFrame: payload.startFrame,
      launchOperationId: payload.launchOperationId,
      projectContextId: payload.projectContextId,
      expectedRevision: payload.expectedRevision,
      stagedRevision,
      acceptedRevision: stagedRevision,
      interpolationMode: payload.interpolationMode,
      selectedKeyId: payload.selectedKeyId,
      selectedAppFrame: payload.selectedAppFrame,
      cursorAppFrame: payload.cursorAppFrame,
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
    executeGroupPaint,
    executeDeleteGroupFrame,
    executeDeleteGroup,
    executeRegenerateGroup,
    executePlayScript,
    seedGroupDocument,
    setStudioSelection,
    publishCanonicalGroupSelection,
    seedCacheFrames,
    accept,
    reject,
    mismatch,
    initial,
    replaceRecords,
    replaceLoopClips,
    replaceDocument,
    sendPhysicalEditPayload,
    reconcileCurrentFrame,
    setCachedReference,
    setConciseMessage,
    acquireLease,
    releaseLease,
    transferLeaseToRecovery,
    flushLivePixels,
    leaseOrder,
    leaseToken,
    recoveryLeaseToken,
    registerPendingSettlement,
    clearPendingSettlement,
    acceptedEvents,
    versionEvents,
    historyCommands,
    getCanonicalDocument,
    getCanonicalSelection: () => ({
      selectedKeyId: canonicalSelectedKeyId,
      cursorAppFrame: canonicalCursorAppFrame,
    }),
    getStudioSelection: () => ({ selectedKeyId, cursorAppFrame: currentFrame }),
    getCacheFacts: () => ({
      frameStates: [...frameStates],
      previewFrames: [...previewFrames],
      capturedFrames: [...capturedFrames],
      confirmedFrames: [...confirmedFrames],
      cachedReference,
    }),
    getRecords: () => records,
    getGroupOverrideRecords: () => groupOverrideRecords,
    getLoopClips: () => loopClips,
    getIncomingInterpolationBreakKeyIds: () => incomingInterpolationBreakKeyIds,
    getStructuralPublicationCount: () => structuralPublicationCount,
    resetStructuralPublicationCount: () => { structuralPublicationCount = 0; },
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
    expect(test.releaseLease).not.toHaveBeenCalled();
    expect(test.coordinator.acknowledgePhysicalEditSettlement(
      test.getPayload()!.operationId,
      'release',
    )).toBe(true);
    expect(test.releaseLease).toHaveBeenCalledWith(test.leaseToken);
  });

  it('transfers accepted cleanup failure to recovery ownership before releasing ordinary control', async () => {
    const test = harness();

    expect(await test.execute()).toBe(true);
    expect(test.accept()).toBe('accepted');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(
      test.getPayload()!.operationId,
      'cleanup-pending',
    )).toBe(true);
    expect(test.transferLeaseToRecovery).toHaveBeenCalledWith(test.leaseToken);
    expect(test.releaseLease).not.toHaveBeenCalled();
    expect(test.coordinator.recoveryLease.value).toBe(test.recoveryLeaseToken);

    expect(test.coordinator.releasePhysicalEditRecoveryLease()).toBe(true);
    expect(test.releaseLease).toHaveBeenCalledWith(test.recoveryLeaseToken);
    expect(test.coordinator.recoveryLease.value).toBeNull();
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

  it('runs Play Script external authority revalidation after lease acquisition and before physical preflight', async () => {
    const test = harness();
    const revalidateAfterLease = vi.fn(async () => {
      test.leaseOrder.push('external-authority');
      return true;
    });

    expect(await test.executePlayScript(revalidateAfterLease)).toBe(true);
    expect(revalidateAfterLease).toHaveBeenCalledOnce();
    expect(test.leaseOrder.indexOf('external-authority')).toBeGreaterThan(test.leaseOrder.indexOf('acquire'));
    expect(test.leaseOrder.indexOf('external-authority')).toBeLessThan(test.leaseOrder.indexOf('records'));
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

  it('keeps the child document unchanged until one accepted complete publication', async () => {
    const test = harness();

    expect(await test.execute()).toBe(true);
    expect(Object.fromEntries(test.getRecords().map((entry) => [entry.keyId, entry.appFrame]))).toEqual({
      A: 0,
      B: 1,
      C: 2,
      X: 6,
      Y: 7,
    });
    expect(test.getLoopClips()).toEqual(test.initial.loopClips);
    expect(test.replaceDocument).not.toHaveBeenCalled();
    expect(test.getPayload()?.loopClips?.find((clip) => clip.loopId === 'loop-a')).toEqual({
      ...test.initial.loopClips[0],
      phaseOrigin: 0,
      originalEndExclusive: 21,
      visibleRanges: [{ start: 0, endExclusive: 21 }],
    });
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
    expect(test.replaceDocument).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(test.getRecords().map((entry) => [entry.keyId, entry.appFrame]))).toEqual({
      A: 0,
      B: 3,
      C: 6,
      X: 10,
      Y: 11,
    });
    expect(test.getLoopClips().find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(10);
    expect(test.acceptedEvents).toHaveLength(1);
    expect(test.historyCommands).toEqual([test.getPayload()!.operationId]);
    expect(test.coordinator.acceptedOutput.value?.after.loopClips).toEqual(test.getPayload()?.loopClips);
    expect(test.coordinator.acceptedOutput.value?.after.loopClips.find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(10);
    expect(test.coordinator.acceptedOutput.value?.before.loopClips).toEqual([
      test.initial.loopClips[0],
      {
        ...test.initial.loopClips[1],
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 6,
        originalEndExclusive: 14,
        visibleRanges: [{ start: 6, endExclusive: 14 }],
        frameOverrides: [],
      },
    ]);
    expect(test.coordinator.acceptedOutput.value?.before.loopClips.find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(6);
    expect(test.coordinator.acceptedOutput.value?.before.incomingInterpolationBreakKeyIds).toEqual(['C']);
    expect(test.coordinator.acceptedOutput.value?.after.incomingInterpolationBreakKeyIds).toEqual(['C']);
    expect(test.coordinator.acceptedOutput.value?.before.incomingInterpolationBreakKeyIds).not.toBe(
      test.coordinator.acceptedOutput.value?.after.incomingInterpolationBreakKeyIds,
    );
  });

  it('does not call split record or Loop Clip publication before parent acceptance', async () => {
    const test = harness({ failFirstLoopReplace: true });

    expect(await test.execute()).toBe(true);
    expect(Object.fromEntries(test.getRecords().map((entry) => [entry.keyId, entry.appFrame]))).toEqual({
      A: 0,
      B: 1,
      C: 2,
      X: 6,
      Y: 7,
    });
    expect(test.getLoopClips()).toEqual(test.initial.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C']);
    expect(test.replaceRecords).not.toHaveBeenCalled();
    expect(test.replaceLoopClips).not.toHaveBeenCalled();
    expect(test.replaceDocument).not.toHaveBeenCalled();
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledOnce();
    expect(test.coordinator.failureOutput.value).toBeNull();
  });

  it('publishes zero child state when transport fails before parent acceptance', async () => {
    const test = harness({ transportRejects: true });

    expect(await test.execute()).toBe(false);
    expect(Object.fromEntries(test.getRecords().map((entry) => [entry.keyId, entry.appFrame]))).toEqual({
      A: 0,
      B: 1,
      C: 2,
      X: 6,
      Y: 7,
    });
    expect(test.getLoopClips()).toEqual(test.initial.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C']);
    expect(test.replaceDocument).not.toHaveBeenCalled();
    expect(test.coordinator.acceptedOutput.value).toBeNull();
    expect(test.acceptedEvents).toEqual([]);
    expect(test.historyCommands).toEqual([]);
    expect(test.coordinator.failureOutput.value?.reason).toBe('transport');
  });
});

describe('Phase 43.2 Group Regenerate atomic settlement', () => {
  it('reconciles the current frame from the accepted complete original extent', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ gapAt: 4, cursorAppFrame: 4 });
    test.seedGroupDocument(before);

    expect(await test.executeRegenerateGroup()).toBe(true);
    expect(test.reconcileCurrentFrame).not.toHaveBeenCalled();
    expect(test.accept()).toBe('accepted');

    expect(test.getLoopClips()[0]).toMatchObject({
      syncState: 'synchronized',
      visibleRanges: [{ start: 0, endExclusive: 6 }],
      frameOverrides: [],
    });
    expect(test.reconcileCurrentFrame).toHaveBeenCalledOnce();
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(4);
  });

  it('publishes zero child state when the parent rejects Regenerate', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ existingOverride: true });
    test.seedGroupDocument(before);

    expect(await test.executeRegenerateGroup()).toBe(true);
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.replaceDocument).not.toHaveBeenCalled();

    expect(test.reject()).toBe('accepted');
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.replaceDocument).not.toHaveBeenCalled();
    expect(test.coordinator.acceptedOutput.value).toBeNull();
    expect(test.coordinator.failureOutput.value).toMatchObject({
      operationKind: 'regenerate-group',
      reason: 'parent-rejection',
    });
  });

  it('publishes zero child state when Regenerate times out', async () => {
    vi.useFakeTimers();
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      writable: true,
      configurable: true,
    });
    try {
      const test = harness();
      const before = groupLifecycleDocument({ existingOverride: true });
      test.seedGroupDocument(before);

      expect(await test.executeRegenerateGroup()).toBe(true);
      await vi.advanceTimersByTimeAsync(5_000);

      expect(test.getRecords()).toEqual(before.realKeyRecords);
      expect(test.getLoopClips()).toEqual(before.loopClips);
      expect(test.replaceDocument).not.toHaveBeenCalled();
      expect(test.coordinator.acceptedOutput.value).toBeNull();
      expect(test.coordinator.failureOutput.value).toMatchObject({
        operationKind: 'regenerate-group',
        reason: 'timeout',
      });
    } finally {
      vi.useRealTimers();
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    }
  });
});

describe('Phase 43.2 accepted source-phase Group Paint settlement', () => {
  it('does not wait on the live-pixel transaction that is dispatching Group Paint', async () => {
    const test = harness();
    test.seedGroupDocument(groupLifecycleDocument({ gapAt: 4 }));

    expect(await test.executeGroupPaint(4, 'override-gap-4')).toBe(true);

    expect(test.flushLivePixels).not.toHaveBeenCalled();
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledOnce();
  });

  it('transports a first-cycle source-frame override without mutating the ordinary source record', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ sharedSourceOwner: true, cursorAppFrame: 0 });
    test.seedGroupDocument(before);

    expect(await test.executeGroupPaint(0, 'override-source-0', 'data:image/png;base64,U09VUkNFLUNPVw==')).toBe(true);

    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getPayload()).toMatchObject({
      groupOverrideRecords: [{
        keyId: 'override-source-0',
        appFrame: 0,
        payload: { appFrame: 0, dataUrl: 'data:image/png;base64,U09VUkNFLUNPVw==' },
      }],
    });
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledOnce();
  });

  it('does not self-flush an existing phase override while its live-pixel transaction is committing', async () => {
    const test = harness();
    test.seedGroupDocument(groupLifecycleDocument({ existingOverride: true }));

    expect(await test.executeGroupPaint(4, 'override-4')).toBe(true);

    expect(test.flushLivePixels).not.toHaveBeenCalled();
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledOnce();
  });

  it('settles when the live-pixel commit itself dispatches existing-override Group Paint', async () => {
    const transactions = createRotoLivePixelCacheTransactions();
    const identity = {
      launchId: 'launch-1',
      layerId: 'layer-1',
      keyId: 'group:group-1:phase:0',
      contentRevision: groupLifecycleDocument({ existingOverride: true }).revision,
      appFrame: 4,
    };
    const test = harness({
      flushLivePixels: () => transactions.flush(identity),
    });
    test.seedGroupDocument(groupLifecycleDocument({ existingOverride: true }));

    const capture = transactions.capture({
      identity,
      resolveCurrent: () => identity,
      produce: async () => 'data:image/png;base64,U0VDT05ELVNUUk9LRQ==',
      commit: (dataUrl) => test.executeGroupPaint(4, 'override-4', dataUrl),
    });

    await expect(Promise.race([
      capture,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Group Paint transaction deadlocked.')), 100)),
    ])).resolves.toBe(true);
    expect(test.flushLivePixels).not.toHaveBeenCalled();
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledOnce();
  });

  it('refills every deleted phase occurrence only after exact acknowledgement', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ gapAt: 4 });
    test.seedGroupDocument(before);
    test.seedCacheFrames([0, 2, 4]);
    const acceptedEvents: unknown[] = [];
    const unsubscribe = test.coordinator.acceptedOutput.subscribe((value) => {
      if (value) acceptedEvents.push(value);
    });

    expect(await test.executeGroupPaint(4, 'override-gap-4')).toBe(true);
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.reconcileCurrentFrame).not.toHaveBeenCalled();
    expect(test.getPayload()).toMatchObject({
      operationKind: 'paint-group-frame',
      startFrame: 4,
      selectedKeyId: null,
      selectedAppFrame: null,
      semanticDelta: {
        kind: 'paint-group-frame',
        groupId: 'group-1',
        appFrame: 4,
        phaseAppFrame: 0,
        affectedAppFrames: [0, 2, 4],
        overrideKeyId: 'override-gap-4',
        createdOverride: true,
        filledDeletedOccurrence: true,
      },
    });

    expect(test.accept()).toBe('accepted');
    expect(test.getGroupOverrideRecords().find((entry) => entry.keyId === 'override-gap-4')).toMatchObject({
      appFrame: 0,
      payload: { appFrame: 0, dataUrl: 'data:image/png;base64,UEFJTlQ=' },
    });
    expect(test.getLoopClips()[0]).toMatchObject({
      syncState: 'modified',
      visibleRanges: [{ start: 0, endExclusive: 6 }],
      frameOverrides: [{ appFrame: 0, keyId: 'override-gap-4' }],
    });
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.getCacheFacts()).toMatchObject({
      frameStates: [],
      previewFrames: [[1, expect.anything()]],
      capturedFrames: [[8, expect.anything()]],
      confirmedFrames: [[9, expect.anything()]],
    });
    expect(test.reconcileCurrentFrame).toHaveBeenCalledOnce();
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(4);
    expect(acceptedEvents).toHaveLength(1);
    expect(test.releaseLease).not.toHaveBeenCalled();
    expect(test.coordinator.acknowledgePhysicalEditSettlement(test.getPayload()!.operationId, 'release')).toBe(true);
    expect(test.releaseLease).toHaveBeenCalledWith(test.leaseToken);
    unsubscribe();
  });

  it('reuses one canonical phase override and remains Modified on repaint', async () => {
    const test = harness();
    test.seedGroupDocument(groupLifecycleDocument({ existingOverride: true }));

    expect(await test.executeGroupPaint(4, 'override-4', 'data:image/png;base64,UkVQQUlOVA==')).toBe(true);
    expect(test.accept()).toBe('accepted');
    expect(test.getGroupOverrideRecords().filter((entry) => entry.keyId === 'override-4')).toHaveLength(1);
    expect(test.getGroupOverrideRecords().find((entry) => entry.keyId === 'override-4')?.payload.dataUrl).toBe('data:image/png;base64,UkVQQUlOVA==');
    expect(test.getLoopClips()[0]).toMatchObject({
      syncState: 'modified',
      frameOverrides: [{ appFrame: 0, keyId: 'override-4' }],
    });
  });

  it('materializes one source phase without changing its source cycle or sharing Group', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ sharedSourceOwner: true, cursorAppFrame: 3 });
    test.seedGroupDocument(before);

    expect(await test.executeGroupPaint(3, 'override-3')).toBe(true);
    expect(test.accept()).toBe('accepted');

    expect(test.getGroupOverrideRecords().filter((entry) => entry.keyId === 'override-3')).toEqual([
      expect.objectContaining({ appFrame: 1, payload: expect.objectContaining({ appFrame: 1, dataUrl: 'data:image/png;base64,UEFJTlQ=' }) }),
    ]);
    expect(test.getRecords().find((entry) => entry.keyId === 'A')).toEqual(before.realKeyRecords.find((entry) => entry.keyId === 'A'));
    expect(test.getRecords().find((entry) => entry.keyId === 'B')).toEqual(before.realKeyRecords.find((entry) => entry.keyId === 'B'));
    expect(test.getLoopClips()).toEqual([
      expect.objectContaining({
        loopId: 'group-1',
        syncState: 'modified',
        frameOverrides: [{ appFrame: 1, keyId: 'override-3' }],
      }),
      before.loopClips[1],
    ]);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(3);
  });

  it('preserves existing Group content and reloads accepted authority on parent rejection', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ sharedSourceOwner: true, cursorAppFrame: 3 });
    test.seedGroupDocument(before);

    expect(await test.executeGroupPaint(3, 'override-3')).toBe(true);
    expect(test.reject()).toBe('accepted');

    expect(test.getCanonicalDocument()).toEqual(before);
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledOnce();
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(3);
  });

  it('publishes zero child/cache/history surfaces on parent rejection', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ gapAt: 4 });
    test.seedGroupDocument(before);
    test.seedCacheFrames([0, 2, 4]);
    const beforeCacheFacts = test.getCacheFacts();

    expect(await test.executeGroupPaint(4, 'override-gap-4')).toBe(true);
    expect(test.reject()).toBe('accepted');
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.replaceRecords).not.toHaveBeenCalled();
    expect(test.replaceLoopClips).not.toHaveBeenCalled();
    expect(test.getCacheFacts()).toEqual(beforeCacheFacts);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledOnce();
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(4);
    expect(test.coordinator.acceptedOutput.value).toBeNull();
    expect(test.coordinator.failureOutput.value?.reason).toBe('parent-rejection');
    expect(test.releaseLease).toHaveBeenCalledWith(test.leaseToken);
  });

  it('restores the accepted before snapshot and transfers ownership when deferred Group publication cannot finish', async () => {
    const test = harness({ failFirstLoopReplace: true });
    const before = groupLifecycleDocument({ gapAt: 4 });
    test.seedGroupDocument(before);

    expect(await test.executeGroupPaint(4, 'override-gap-4')).toBe(true);
    expect(test.accept()).toBe('accepted');
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.coordinator.acceptedOutput.value).toBeNull();
    expect(test.coordinator.failureOutput.value?.reason).toBe('exception');
    expect(test.transferLeaseToRecovery).toHaveBeenCalledWith(test.leaseToken);
    expect(test.releaseLease).not.toHaveBeenCalled();
    expect(test.coordinator.recoveryLease.value).toBe(test.recoveryLeaseToken);
  });
});

describe('Phase 43.2 accepted Group lifecycle delete settlement', () => {
  it('rejects stale split authority atomically and immediately reuses the same layer for Delete Group', async () => {
    const test = harness();
    const before = groupLifecycleDocument({
      existingOverride: true,
      selectedKeyId: 'A',
      cursorAppFrame: 0,
      sharedSourceOwner: true,
    });
    test.seedGroupDocument(before);
    test.setStudioSelection(null, 4);
    const beforeCacheFacts = test.getCacheFacts();
    const beforeRevision = test.getCanonicalDocument().revision;

    expect(await test.executeDeleteGroup()).toBe(false);
    expect(test.sendPhysicalEditPayload).not.toHaveBeenCalled();
    expect(test.getCanonicalDocument()).toEqual(before);
    expect(test.getCanonicalDocument().revision).toBe(beforeRevision);
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.getCanonicalSelection()).toEqual({ selectedKeyId: 'A', cursorAppFrame: 0 });
    expect(test.getStudioSelection()).toEqual({ selectedKeyId: null, cursorAppFrame: 4 });
    expect(test.getCacheFacts()).toEqual(beforeCacheFacts);
    expect(test.acceptedEvents).toEqual([]);
    expect(test.versionEvents).toEqual([]);
    expect(test.historyCommands).toEqual([]);
    expect(test.registerPendingSettlement).not.toHaveBeenCalled();
    expect(test.clearPendingSettlement).toHaveBeenCalledTimes(1);
    expect(test.acquireLease).toHaveBeenCalledTimes(1);
    expect(test.releaseLease).toHaveBeenCalledTimes(1);
    expect(test.coordinator.pendingOperationId.value).toBeNull();
    expect(test.coordinator.failureOutput.value).toBeNull();

    test.publishCanonicalGroupSelection(4);

    expect(await test.executeDeleteGroup()).toBe(true);
    expect(test.acquireLease).toHaveBeenCalledTimes(2);
    expect(test.releaseLease).toHaveBeenCalledTimes(1);
    expect(test.getPayload()).toMatchObject({
      operationKind: 'delete-group',
      startFrame: 4,
      expectedRevision: beforeRevision,
      selectedKeyId: null,
      selectedAppFrame: null,
      semanticDelta: {
        kind: 'delete-group',
        groupId: 'group-1',
        cleanupKeyIds: ['override-4'],
      },
    });
    expect(test.accept()).toBe('accepted');
    expect(test.getRecords().map((entry) => entry.keyId)).toEqual(['A', 'B']);
    expect(test.getLoopClips()).toEqual([
      expect.objectContaining({
        loopId: 'group-shared',
        scriptId: 'action-1',
        provenanceState: 'attached',
        sourceKeyIds: ['A', 'B'],
      }),
    ]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.getCacheFacts()).toEqual(beforeCacheFacts);
    expect(test.acceptedEvents).toHaveLength(1);
    expect(test.versionEvents).toEqual([1]);
    expect(test.historyCommands).toEqual([test.getPayload()!.operationId]);
    expect(test.registerPendingSettlement).toHaveBeenCalledTimes(1);
    expect(test.clearPendingSettlement).toHaveBeenCalledTimes(2);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(4);
    expect(test.coordinator.acknowledgePhysicalEditSettlement(test.getPayload()!.operationId, 'release')).toBe(true);
    expect(test.releaseLease).toHaveBeenCalledTimes(2);
  });

  it('accepts Delete Frame after Group selection republishes canonical null-key authority', async () => {
    const test = harness();
    const before = groupLifecycleDocument({
      selectedKeyId: 'A',
      cursorAppFrame: 0,
    });
    test.seedGroupDocument(before);
    test.setStudioSelection(null, 3);

    expect(await test.executeDeleteGroupFrame(3)).toBe(false);
    expect(test.sendPhysicalEditPayload).not.toHaveBeenCalled();
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.releaseLease).toHaveBeenCalledTimes(1);

    const acceptedEvents: unknown[] = [];
    const unsubscribe = test.coordinator.acceptedOutput.subscribe((value) => {
      if (value) acceptedEvents.push(value);
    });
    test.publishCanonicalGroupSelection(3);

    expect(await test.executeDeleteGroupFrame(3)).toBe(true);
    expect(test.getPayload()).toMatchObject({
      operationKind: 'delete-group-frame',
      startFrame: 3,
      selectedKeyId: null,
      selectedAppFrame: null,
      semanticDelta: {
        kind: 'delete-group-frame',
        groupId: 'group-1',
        appFrame: 3,
        phaseAppFrame: 1,
        affectedAppFrames: [1, 3, 5],
        cleanupKeyIds: [],
      },
    });
    expect(test.accept()).toBe('accepted');
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual([
      expect.objectContaining({
        loopId: 'group-1',
        provenanceState: 'attached',
        phaseOrigin: 0,
        syncState: 'modified',
        visibleRanges: [
          { start: 0, endExclusive: 1 },
          { start: 2, endExclusive: 3 },
          { start: 4, endExclusive: 5 },
        ],
      }),
    ]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(3);
    expect(acceptedEvents).toHaveLength(1);
    expect(test.coordinator.acknowledgePhysicalEditSettlement(test.getPayload()!.operationId, 'release')).toBe(true);
    expect(test.releaseLease).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('deletes one repeated source phase only after acknowledgement and holds the lease through settlement', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ existingOverride: true });
    test.seedGroupDocument(before);
    const acceptedEvents: unknown[] = [];
    const unsubscribe = test.coordinator.acceptedOutput.subscribe((value) => {
      if (value) acceptedEvents.push(value);
    });

    expect(await test.executeDeleteGroupFrame(4)).toBe(true);
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.getPayload()).toMatchObject({
      operationKind: 'delete-group-frame',
      startFrame: 4,
      semanticDelta: {
        kind: 'delete-group-frame',
        groupId: 'group-1',
        appFrame: 4,
        phaseAppFrame: 0,
        affectedAppFrames: [0, 2, 4],
        cleanupKeyIds: ['override-4'],
      },
    });

    expect(test.accept()).toBe('accepted');
    expect(test.getRecords().map((entry) => entry.keyId)).toEqual(['A', 'B']);
    expect(test.getLoopClips()).toEqual([
      expect.objectContaining({
        loopId: 'group-1',
        phaseOrigin: 0,
        syncState: 'modified',
        visibleRanges: [
          { start: 1, endExclusive: 2 },
          { start: 3, endExclusive: 4 },
          { start: 5, endExclusive: 6 },
        ],
        frameOverrides: [],
      }),
    ]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(4);
    expect(acceptedEvents).toHaveLength(1);
    expect(test.releaseLease).not.toHaveBeenCalled();
    expect(test.coordinator.acknowledgePhysicalEditSettlement(test.getPayload()!.operationId, 'release')).toBe(true);
    expect(test.releaseLease).toHaveBeenCalledWith(test.leaseToken);
    unsubscribe();
  });

  it('deletes the complete Group and uniquely owned physical facts while preserving the Action provenance contract', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ existingOverride: true });
    test.seedGroupDocument(before);

    expect(await test.executeDeleteGroup()).toBe(true);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.getPayload()).toMatchObject({
      operationKind: 'delete-group',
      startFrame: 4,
      semanticDelta: {
        kind: 'delete-group',
        groupId: 'group-1',
        cleanupKeyIds: ['A', 'B', 'override-4'],
      },
    });

    expect(test.accept()).toBe('accepted');
    expect(test.getRecords()).toEqual([]);
    expect(test.getLoopClips()).toEqual([]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual([]);
    expect(test.coordinator.acceptedOutput.value).toMatchObject({
      operationKind: 'delete-group',
      before: {
        loopClips: [expect.objectContaining({ provenanceState: 'attached' })],
      },
      after: { loopClips: [] },
    });
  });

  it('publishes one complete child document for an accepted Group frame deletion', async () => {
    const test = harness();
    const before = groupLifecycleDocument();
    test.seedGroupDocument(before);
    test.resetStructuralPublicationCount();

    expect(await test.executeDeleteGroupFrame(4)).toBe(true);
    expect(test.accept()).toBe('accepted');

    expect(test.getStructuralPublicationCount()).toBe(1);
    expect(test.getLoopClips()[0]).toMatchObject({
      syncState: 'modified',
      visibleRanges: [
        { start: 1, endExclusive: 2 },
        { start: 3, endExclusive: 4 },
        { start: 5, endExclusive: 6 },
      ],
    });
  });

  it('publishes no child state on rejection and transfers recovery ownership after partial accepted cleanup', async () => {
    const rejected = harness();
    const before = groupLifecycleDocument({ existingOverride: true });
    rejected.seedGroupDocument(before);

    expect(await rejected.executeDeleteGroupFrame(4)).toBe(true);
    expect(rejected.reject()).toBe('accepted');
    expect(rejected.getRecords()).toEqual(before.realKeyRecords);
    expect(rejected.getLoopClips()).toEqual(before.loopClips);
    expect(rejected.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(rejected.reconcileCurrentFrame).not.toHaveBeenCalled();
    expect(rejected.coordinator.acceptedOutput.value).toBeNull();

    const cleanupFailure = harness({ failFirstLoopReplace: true });
    cleanupFailure.seedGroupDocument(before);
    expect(await cleanupFailure.executeDeleteGroup()).toBe(true);
    expect(cleanupFailure.accept()).toBe('accepted');
    expect(cleanupFailure.getRecords()).toEqual(before.realKeyRecords);
    expect(cleanupFailure.getLoopClips()).toEqual(before.loopClips);
    expect(cleanupFailure.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(cleanupFailure.coordinator.acceptedOutput.value).toBeNull();
    expect(cleanupFailure.coordinator.failureOutput.value?.reason).toBe('exception');
    expect(cleanupFailure.transferLeaseToRecovery).toHaveBeenCalledWith(cleanupFailure.leaseToken);
    expect(cleanupFailure.releaseLease).not.toHaveBeenCalled();
  });
});

describe('Phase 43.2 leased source-phase Paint coordinator tracer', () => {
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
