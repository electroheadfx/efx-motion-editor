import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

const { unmountCleanup } = vi.hoisted(() => ({ unmountCleanup: { current: null as (() => void) | null } }));

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => {
    const cleanup = setup();
    if (typeof cleanup === 'function') unmountCleanup.current = cleanup;
  },
  useMemo: <Value>(factory: () => Value) => factory(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

vi.mock('@preact/signals', async () => {
  const signals = await vi.importActual<typeof import('@preact/signals')>('@preact/signals');
  return { ...signals, useSignal: signals.signal };
});

import type {
  PhysicPaintRotoAuthorityResult,
  PhysicPaintRotoPhysicalEditApplyPayload,
  PhysicPaintRotoPhysicalEditApplyResult,
  PhysicPaintRotoPhysicalEditSemanticDelta,
  RailSetDeleteMember,
} from '../../../types/physicPaint';
import { createEfxPaintDocument, type EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
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
import {
  createRotoPlayScriptController,
  type RotoGeneratedPhysicalPublication,
  type RotoPlayScriptCommitResult,
  type RotoPlayScriptControllerPorts,
} from '../roto/physicsPaintRotoPlayScriptController';
import { resolvePostAcceptanceRotoStudioSelection } from '../roto/physicsPaintRotoMultiSelection';
import { createRotoLivePixelCacheTransactions } from '../roto/rotoLivePixelCacheTransactions';
import type { RotoRailSetCopyPayload } from '../roto/physicsPaintRotoRailSetCopy';
import type { RotoPhysicalEditCoordinatorPorts } from '../roto/rotoCoordinatorPorts';
import {
  executePhysicPaintRotoGroupFramePaintTransaction,
  useRotoPhysicalEditCoordinator,
} from './useRotoPhysicalEditCoordinator';
import { useRotoPhysicalEditHistory } from './useRotoPhysicalEditHistory';
import { useRotoTimelineActions } from './useRotoTimelineActions';

const INTERPOLATION: PhysicPaintRotoInterpolationState = { enabled: false, mode: 'duplicate' };

function makeLaunchDocument(launchRotoPhysical?: { selectedKeyId: string | null; cursorAppFrame: number }): EfxPaintDocument {
  const document = createEfxPaintDocument('layer-1');
  const rotoPhysical = {
    capacity: 30,
    realKeyRecords: [],
    groupOverrideRecords: [],
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: launchRotoPhysical?.selectedKeyId ?? null,
    cursorAppFrame: launchRotoPhysical?.cursorAppFrame ?? 0,
    revision: buildPhysicPaintRotoPhysicalRevision([], INTERPOLATION, []),
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
  };
  return {
    ...document,
    tracks: document.tracks.map((track) => track.id === document.activeTrackId
      ? { ...track, rotoPhysical }
      : track),
  };
}

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
  sharedOverrideReference?: boolean;
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
  const secondaryGroup: PhysicPaintRotoLoopClip = {
    loopId: 'group-shared',
    placementStart: options.sharedOverrideReference ? 0 : 8,
    sourceKeyIds: ['A', 'B'],
    repeat: options.sharedOverrideReference ? 3 : 1,
    mode: 'progressive',
    scriptId: 'action-1',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: options.sharedOverrideReference ? 'modified' : 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: options.sharedOverrideReference ? 0 : 8,
    originalEndExclusive: options.sharedOverrideReference ? 6 : 10,
    visibleRanges: [{
      start: options.sharedOverrideReference ? 0 : 8,
      endExclusive: options.sharedOverrideReference ? 6 : 10,
    }],
    frameOverrides: options.sharedOverrideReference
      ? [{ appFrame: 0, keyId: 'override-4' }]
      : [],
  };
  const loopClips: readonly PhysicPaintRotoLoopClip[] = options.sharedSourceOwner
      || options.sharedOverrideReference
    ? [primaryGroup, secondaryGroup]
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
    parentEndExclusive: 30,
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
  launchRotoPhysical?: { selectedKeyId: string | null; cursorAppFrame: number };
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
    trackId: 'track-1',
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
        document: makeLaunchDocument(options.launchRotoPhysical),
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
      parentEndExclusive: 30,
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
  const executePasteKey = (destinationAppFrame: number) => {
    const intent = {
      kind: 'paste-key',
      destinationAppFrame,
      destinationKeyId: null,
      newKeyId: 'hq9-6',
      clipboardPayload: {
        frameIndex: 0,
        appFrame: destinationAppFrame,
        dataUrl: 'data:image/png;base64,AAAA',
        width: 2,
        height: 2,
      },
      startsNewSegment: true,
    } as const;
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent,
      loopClips,
      parentEndExclusive: 30,
      capacity: 30,
      interpolationEnabled: interpolation.enabled,
      incomingInterpolationBreakKeyIds,
    });
    if (!resolution.ok) throw new Error(resolution.failure.text);
    return coordinator.executePhysicalEdit({
      proposal: resolution.proposal,
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      operationKind: 'paste-key',
      intent,
      selectedKeyId: 'hq9-6',
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
  // Simulates handleSelectRotoKeyRail's setRotoPhysicalSelection(layerId,
  // null, currentFrame): the child document's selection is cleared locally
  // while the parent document retains the last accepted selection (43.4
  // defect 4). The replay snapshot must use the last accepted selection, not
  // this locally-cleared document selection.
  const clearCanonicalSelection = (appFrame: number) => {
    canonicalSelectedKeyId = null;
    canonicalCursorAppFrame = appFrame;
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
  const executeDeleteRails = (members: readonly RailSetDeleteMember[]) => coordinator.executePhysicalEdit({
    operationKind: 'delete-rails',
    expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
    members,
  });
  const executePasteRails = (input: {
    payload: RotoRailSetCopyPayload;
    placementMode: 'paste' | 'duplicate';
    destinationAppFrame?: number;
  }) => coordinator.executePhysicalEdit({
    operationKind: 'paste',
    expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
    payload: input.payload,
    placementMode: input.placementMode,
    ...(input.destinationAppFrame !== undefined ? { destinationAppFrame: input.destinationAppFrame } : {}),
  });
  const executeMoveGroup = (loopId: string, destinationPlacementStart: number) => {
    const intent = { kind: 'move-group', loopId, destinationPlacementStart } as const;
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      intent,
      parentEndExclusive: 30,
      capacity: 30,
      interpolationEnabled: interpolation.enabled,
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
    if (!resolution.ok) throw new Error(resolution.failure.text);
    return coordinator.executePhysicalEdit({
      proposal: resolution.proposal,
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      operationKind: 'move-group',
      intent,
      selectedKeyId: resolution.proposal.selectedKeyId,
      selectedAppFrame: resolution.proposal.selectedAppFrame,
    });
  };
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
      historyProvenance: payload.historyProvenance,
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
  const mismatchDelta = (semanticDelta: unknown) => coordinator.consumePhysicalEditResult(makeResult({
    semanticDelta: semanticDelta as PhysicPaintRotoPhysicalEditSemanticDelta,
  }));
  return {
    coordinator,
    execute,
    executeEmptySegment,
    executePasteKey,
    executeGroupPaint,
    executeDeleteGroupFrame,
    executeDeleteGroup,
    executeDeleteRails,
    executePasteRails,
    executeMoveGroup,
    executeRegenerateGroup,
    executePlayScript,
    seedGroupDocument,
    setStudioSelection,
    clearCanonicalSelection,
    publishCanonicalGroupSelection,
    seedCacheFrames,
    accept,
    reject,
    mismatch,
    mismatchDelta,
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
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C']);
    expect(test.getSelectedKeyId()).toBe('blank-14');
    expect(test.getCurrentFrame()).toBe(14);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledTimes(1);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(14);
  });

  it('reconciles the accepted EMPTY real key when paste-key lands inside an interpolated span', async () => {
    const test = harness();
    const records = [record('A', 0), record('B', 4), record('C', 8)];
    const interpolationOn = { enabled: true as const, mode: 'duplicate' as const };
    const doc = parsePhysicPaintRotoPhysicalDocument({
      capacity: 30,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation: interpolationOn,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 6,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolationOn, [], [], []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    test.seedGroupDocument(doc);

    // 6 is strictly inside the B(4)–C(8) interpolated span; the destination is
    // genuinely empty, so the paste-to-empty physical edit is accepted.
    expect(await test.executePasteKey(6)).toBe(true);
    expect(test.getRecords().map(({ keyId, appFrame }) => [keyId, appFrame])).toEqual([
      ['A', 0],
      ['B', 4],
      ['C', 8],
    ]);
    expect(test.reconcileCurrentFrame).not.toHaveBeenCalled();
    expect(test.coordinator.acceptedOutput.value).toBeNull();

    expect(test.accept()).toBe('accepted');
    expect(test.getRecords().map(({ keyId, appFrame }) => [keyId, appFrame])).toContainEqual(['hq9-6', 6]);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledTimes(1);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(6);
    expect(test.getCanonicalSelection().cursorAppFrame).toBe(6);
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
    expect(test.getPayload()?.incomingInterpolationBreakKeyIds).toEqual(['C']);
    expect(test.getPayload()?.incomingInterpolationBreakKeyIds).not.toBe(
      test.getIncomingInterpolationBreakKeyIds(),
    );

    expect(test.accept()).toBe('accepted');
    expect(test.getRecords().map(({ keyId, appFrame }) => [keyId, appFrame])).toContainEqual(['blank-14', 14]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['C']);
    expect(test.coordinator.acceptedOutput.value?.before.incomingInterpolationBreakKeyIds).toEqual(['C']);
    expect(test.coordinator.acceptedOutput.value?.after.incomingInterpolationBreakKeyIds).toEqual(['C']);
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

  it('authorizes a matched move-rails intent and rejects a mismatched one before staging', async () => {
    const test = harness();
    const intent = {
      kind: 'move-rails',
      members: [{ kind: 'loop', loopId: 'loop-b' }],
      delta: 2,
    } as const;
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: test.initial.records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      intent,
      loopClips: test.initial.loopClips,
      parentEndExclusive: 30,
      capacity: 30,
      interpolationEnabled: false,
      incomingInterpolationBreakKeyIds: ['C'],
    });
    if (!resolution.ok) throw new Error(resolution.failure.text);

    expect(await test.coordinator.executePhysicalEdit({
      proposal: resolution.proposal,
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      operationKind: 'move-rails',
      intent,
      selectedKeyId: resolution.proposal.selectedKeyId,
      selectedAppFrame: resolution.proposal.selectedAppFrame,
    })).toBe(true);
    expect(test.getPayload()?.operationKind).toBe('move-rails');
    expect(test.getPayload()?.intent).toEqual(intent);
    expect(test.getPayload()?.loopClips?.find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(8);
    expect(test.getPayload()?.loopClips?.find((clip) => clip.loopId === 'loop-a')?.placementStart).toBe(0);

    // A mismatched intent for the same operation kind fails closed before staging.
    const mismatched = harness();
    expect(await mismatched.coordinator.executePhysicalEdit({
      proposal: mismatched.initial.proposal,
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      operationKind: 'move-rails',
      intent: { kind: 'delete-key', selectedKeyId: 'A' },
      selectedKeyId: null,
      selectedAppFrame: null,
    } as never)).toBe(false);
    expect(mismatched.sendPhysicalEditPayload).not.toHaveBeenCalled();
    expect(mismatched.coordinator.acceptedOutput.value).toBeNull();
    expect(mismatched.coordinator.failureOutput.value).toBeNull();
    mismatched.coordinator.cancelPhysicalEdit('disposal');
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

function freshFiniteGroupDragHistoryDocument(externalKeyFrame = 10) {
  const records = [record('A', 1), record('B', 2), record('C', 3), record('D', externalKeyFrame)];
  const loopClips: readonly PhysicPaintRotoLoopClip[] = [{
    loopId: 'group-history',
    placementStart: 1,
    sourceKeyIds: ['A', 'B', 'C'],
    repeat: 2,
    mode: 'progressive',
    scriptId: 'action-history',
    motion: { deformation: 3, position: 2 },
    overrideColor: '#336699',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 1,
    originalEndExclusive: 7,
    visibleRanges: [{ start: 1, endExclusive: 7 }],
    frameOverrides: [],
  }];
  return parsePhysicPaintRotoPhysicalDocument({
    capacity: 30,
    realKeyRecords: records,
    groupOverrideRecords: [],
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 6,
    revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, loopClips, [], []),
    loopClips,
    incomingInterpolationBreakKeyIds: [],
  });
}

async function settleGroupRepeatThroughPublicController(
  setupHarness: ReturnType<typeof harness>,
  repeat: number | 'infinity',
): Promise<Readonly<{
  document: ReturnType<typeof parsePhysicPaintRotoPhysicalDocument>;
  publication: RotoGeneratedPhysicalPublication;
  settlementAcknowledged: boolean;
}>> {
  const beforeTransition = setupHarness.getCanonicalDocument();
  const acceptedPublications: RotoGeneratedPhysicalPublication[] = [];
  const snapshotAuthorityRevisions: string[] = [];
  const loopAuthorityRepeats: Array<number | 'infinity' | null> = [];
  const library = {
    selectedId: signal<string | null>('action-history'),
    selected: signal<{ id: string } | null>({ id: 'action-history' }),
    busy: signal(false),
    loadSnapshot: vi.fn(),
  } as unknown as RotoPlayScriptControllerPorts['library'];
  const commit = vi.fn(async (publication: RotoGeneratedPhysicalPublication): Promise<RotoPlayScriptCommitResult> => {
    if (publication.semanticDelta.kind !== 'play-script') throw new Error('Expected Loop Edit Play Script publication.');
    acceptedPublications.push(publication);
    const currentDocument = setupHarness.getCanonicalDocument();
    expect(publication.expectedRevision).toBe(currentDocument.revision);
    const executed = await setupHarness.coordinator.executePhysicalEdit({
      operationKind: 'play-script',
      expectedLaunch: publication.expectedLaunch,
      expectedRevision: currentDocument.revision,
      records: publication.records,
      interpolationEnabled: publication.interpolationEnabled,
      interpolationMode: publication.interpolationMode,
      rotoBackground: publication.rotoBackground,
      semanticDelta: publication.semanticDelta,
      selectedKeyId: publication.selectedKeyId,
      selectedAppFrame: publication.selectedAppFrame,
      ...(publication.loopClips ? { loopClips: publication.loopClips } : {}),
    });
    if (!executed) throw new Error(`Coordinator rejected Loop Edit dispatch: ${JSON.stringify({ failure: setupHarness.coordinator.failureOutput.value, messages: setupHarness.setConciseMessage.mock.calls })}`);
    expect(executed).toBe(true);
    const acceptance = setupHarness.accept();
    if (acceptance !== 'accepted') throw new Error(`Coordinator returned ${acceptance} for Loop Edit settlement.`);
    expect(acceptance).toBe('accepted');
    const accepted = setupHarness.coordinator.acceptedOutput.value;
    if (!accepted) throw new Error('Expected accepted canonical Loop Edit settlement.');
    expect(accepted.operationKind).toBe('play-script');
    expect(setupHarness.coordinator.acknowledgePhysicalEditSettlement(accepted.operationId, 'release')).toBe(true);
    return {
      ok: true,
      operationId: accepted.operationId,
      acceptedRevision: accepted.acceptedRevision,
      records: accepted.after.records,
      interpolationMode: accepted.after.interpolation.mode,
      selectedKeyId: accepted.after.selectedKeyId,
      selectedAppFrame: accepted.after.selectedAppFrame,
      ...(publication.loopClips ? { loopClips: accepted.after.loopClips } : {}),
    };
  });
  const controller = createRotoPlayScriptController({
    library,
    getLaunchContext: () => ({
      operationId: 'launch-1',
      layerId: 'layer-1',
      startFrame: 1,
      width: 10,
      height: 10,
      project: { name: 'Project', saved: true, contextId: 'project-1' },
    }),
    getSelection: () => ({ kind: 'empty', keyId: null, appFrame: setupHarness.getStudioSelection().cursorAppFrame }),
    getMotion: () => ({ deformation: 3, position: 2 }),
    getBrushColor: () => '#336699',
    getBackgroundMetadata: () => ({ background: 'canvas1', paperGrain: 'canvas2', grainStrength: 0.45 }),
    getOperationLocked: () => false,
    getSize: () => ({ width: 10, height: 10 }),
    getRotoLoopClips: () => {
      const document = setupHarness.getCanonicalDocument();
      loopAuthorityRepeats.push(document.loopClips[0]?.repeat ?? null);
      return document.loopClips;
    },
    getLoopEditSnapshot: (placementStart) => {
      const document = setupHarness.getCanonicalDocument();
      snapshotAuthorityRevisions.push(document.revision);
      return {
        identities: document.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
        physicalCapacity: document.capacity,
        layerEndExclusive: 30,
        interpolationEnabled: document.interpolation.enabled,
        remainingCapacity: Math.max(0, 30 - placementStart),
      };
    },
    requestAuthority: async (operationId) => {
      const document = setupHarness.getCanonicalDocument();
      const authority: PhysicPaintRotoAuthorityResult = {
        operationId,
        ok: true,
        projectContextId: 'project-1',
        layerId: 'layer-1',
        canonicalStart: 1,
        layerEndExclusive: 30,
        capacity: 29,
        physicalCapacity: document.capacity,
        rotoRevision: document.revision,
        physicalRevision: document.revision,
        physicalRecords: document.realKeyRecords.map(({ keyId, appFrame, payload }) => ({ keyId, appFrame, payload })),
        interpolationEnabled: document.interpolation.enabled,
        interpolationMode: document.interpolation.mode,
        frames: [],
        interpolationSettings: {
          enabled: false,
          inBetweenCount: 0,
          mode: 'duplicate',
          deform: 0,
          position: 0,
        },
      };
      return authority;
    },
    commit,
    stopPlayback: vi.fn(),
    log: vi.fn(),
  });
  expect(await controller.openLoopEdit('group-history')).toEqual({ ok: true, reason: null });
  if (repeat === 'infinity') {
    controller.setInfinity(true);
  } else {
    controller.setInfinity(false);
    controller.repeatText.value = String(repeat);
  }
  const confirmed = await controller.confirm();
  if (!confirmed) throw new Error(controller.error.value ?? 'Expected Loop Edit confirmation to succeed.');
  expect(confirmed).toBe(true);
  expect(commit).toHaveBeenCalledTimes(1);
  const publication = acceptedPublications[0];
  if (!publication) throw new Error('Expected accepted Loop Edit publication.');
  expect(publication.loopClips).toBeDefined();
  expect(snapshotAuthorityRevisions).not.toHaveLength(0);
  expect(snapshotAuthorityRevisions.every((revision) => revision === beforeTransition.revision)).toBe(true);
  expect(loopAuthorityRepeats).toContain(beforeTransition.loopClips[0]?.repeat ?? null);
  const document = setupHarness.getCanonicalDocument();
  const accepted = setupHarness.coordinator.acceptedOutput.value;
  expect(accepted?.after.records).toEqual(document.realKeyRecords);
  expect(accepted?.after.incomingInterpolationBreakKeyIds).toEqual(document.incomingInterpolationBreakKeyIds);
  expect(accepted?.after.loopClips).toEqual(document.loopClips);
  expect(accepted?.acceptedRevision).toBe(document.revision);
  expect(document.revision).toBe(buildPhysicPaintRotoPhysicalRevision(
    document.realKeyRecords,
    document.interpolation,
    document.loopClips,
    document.incomingInterpolationBreakKeyIds,
    document.groupOverrideRecords,
  ));
  expect(document.loopClips[0]?.repeat).toBe(repeat);
  return { document, publication, settlementAcknowledged: setupHarness.releaseLease.mock.calls.length > 0 };
}

async function spacingInfinityFiniteGroupDragHistoryDocument(
  spacingHarness = harness(),
) {
  const fresh = freshFiniteGroupDragHistoryDocument(18);
  const spacingIntent = {
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
  const spacing = resolvePhysicPaintRotoPhysicalEdit({
    identities: fresh.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    records: fresh.realKeyRecords,
    intent: spacingIntent,
    parentEndExclusive: 30,
    capacity: 30,
    interpolationEnabled: false,
    loopClips: fresh.loopClips,
    incomingInterpolationBreakKeyIds: [],
  });
  if (!spacing.ok) throw new Error(spacing.failure.text);
  spacingHarness.seedGroupDocument(fresh);
  expect(await spacingHarness.coordinator.executePhysicalEdit({
    proposal: spacing.proposal,
    expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
    operationKind: 'force-spacing',
    intent: spacingIntent,
    selectedKeyId: spacing.proposal.selectedKeyId,
    selectedAppFrame: spacing.proposal.selectedAppFrame,
  })).toBe(true);
  expect(spacingHarness.accept()).toBe('accepted');
  const spacingAccepted = spacingHarness.coordinator.acceptedOutput.value;
  if (!spacingAccepted) throw new Error('Expected accepted force-spacing settlement.');
  const spacingOperationId = spacingHarness.getPayload()?.operationId;
  if (!spacingOperationId) throw new Error('Expected force-spacing operation ID.');
  expect(spacingHarness.coordinator.acknowledgePhysicalEditSettlement(spacingOperationId, 'release')).toBe(true);
  expect(spacingHarness.releaseLease).toHaveBeenCalledTimes(1);
  const spaced = spacingHarness.getCanonicalDocument();
  expect(spacingAccepted.operationKind).toBe('force-spacing');
  expect(spacingAccepted.after.records).toEqual(spaced.realKeyRecords);
  expect(spacingAccepted.after.groupOverrideRecords).toEqual(spaced.groupOverrideRecords);
  expect(spacingAccepted.after.interpolation).toEqual(spaced.interpolation);
  expect(spacingAccepted.after.loopClips).toEqual(spaced.loopClips);
  expect(spacingAccepted.after.incomingInterpolationBreakKeyIds).toEqual(spaced.incomingInterpolationBreakKeyIds);
  expect(spacingAccepted.after.capacity).toBe(spaced.capacity);
  expect(spacingAccepted.after.selectedKeyId).toBe(spaced.selectedKeyId);
  expect(spacingAccepted.after.currentAppFrame).toBe(spaced.cursorAppFrame);
  expect(spacingAccepted.acceptedRevision).toBe(spaced.revision);
  expect(spaced.revision).toBe(buildPhysicPaintRotoPhysicalRevision(
    spaced.realKeyRecords,
    spaced.interpolation,
    spaced.loopClips,
    spaced.incomingInterpolationBreakKeyIds,
    spaced.groupOverrideRecords,
  ));
  expect(spaced.loopClips[0]?.repeat).toBe(2);
  expect(spaced.incomingInterpolationBreakKeyIds).toEqual([]);

  const infinitySettlement = await settleGroupRepeatThroughPublicController(spacingHarness, 'infinity');
  expect(spacingHarness.releaseLease).toHaveBeenCalledTimes(2);
  expect(infinitySettlement.document.realKeyRecords).toEqual(spaced.realKeyRecords);
  expect(infinitySettlement.document.incomingInterpolationBreakKeyIds).toEqual(spaced.incomingInterpolationBreakKeyIds);
  const finiteSettlement = await settleGroupRepeatThroughPublicController(spacingHarness, 2);
  expect(spacingHarness.releaseLease).toHaveBeenCalledTimes(3);
  expect(finiteSettlement.document.realKeyRecords).toEqual(spaced.realKeyRecords);
  expect(finiteSettlement.document.incomingInterpolationBreakKeyIds).toEqual(spaced.incomingInterpolationBreakKeyIds);
  const document = spacingHarness.getCanonicalDocument();
  expect(document).toEqual(finiteSettlement.document);
  return {
    document,
    setupEvidence: {
      spacingAccepted: true,
      spacingSettlementAcknowledged: true,
      spacedSourceFrames: document.realKeyRecords.filter((entry) => entry.keyId !== 'D').map((entry) => entry.appFrame),
      infinityAccepted: infinitySettlement.publication.semanticDelta.kind === 'play-script',
      infinitySettlementAcknowledged: infinitySettlement.settlementAcknowledged,
      infinityRepeat: infinitySettlement.document.loopClips[0]?.repeat ?? null,
      finiteAccepted: finiteSettlement.publication.semanticDelta.kind === 'play-script',
      finiteSettlementAcknowledged: finiteSettlement.settlementAcknowledged,
      finiteRepeat: finiteSettlement.document.loopClips[0]?.repeat ?? null,
    },
  };
}

function expectedMovedGroupDragHistoryDocument(
  before: ReturnType<typeof freshFiniteGroupDragHistoryDocument>,
) {
  const movedRecords = before.realKeyRecords.map((entry) => (
    entry.keyId === 'D' ? entry : record(entry.keyId, entry.appFrame + 1)
  ));
  const movedGroupOverrideRecords = (before.groupOverrideRecords ?? []).map((entry) => record(entry.keyId, entry.appFrame + 1));
  const movedLoopClips = before.loopClips.map((clip) => ({
    ...clip,
    placementStart: clip.placementStart + 1,
    phaseOrigin: (clip.phaseOrigin ?? clip.placementStart) + 1,
    originalEndExclusive: (clip.originalEndExclusive ?? clip.placementStart) + 1,
    visibleRanges: clip.visibleRanges?.map((range) => ({
      start: range.start + 1,
      endExclusive: range.endExclusive + 1,
    })),
    frameOverrides: clip.frameOverrides?.map((override) => ({
      appFrame: override.appFrame + 1,
      keyId: override.keyId,
    })),
  }));
  return parsePhysicPaintRotoPhysicalDocument({
    ...before,
    realKeyRecords: movedRecords,
    groupOverrideRecords: movedGroupOverrideRecords,
    selectedKeyId: null,
    cursorAppFrame: before.cursorAppFrame,
    revision: buildPhysicPaintRotoPhysicalRevision(
      movedRecords,
      before.interpolation,
      movedLoopClips,
      ['D'],
      movedGroupOverrideRecords,
    ),
    loopClips: movedLoopClips,
    incomingInterpolationBreakKeyIds: ['D'],
  });
}

function attachGroupReplayHistory(test: ReturnType<typeof harness>) {
  const availability = signal({ undo: 0, redo: 0 });
  const history = useRotoPhysicalEditHistory({
    identity: {
      trackId: 'track-a',
      launchOperationId: 'launch-1',
      layerId: 'layer-1',
      projectContextId: 'project-1',
      capacity: 30,
    },
    availability,
    coordinator: test.coordinator,
    recordsPort: {
      getRecords: () => test.getRecords(),
      getInterpolation: () => test.getCanonicalDocument().interpolation,
      getCapacity: () => 30,
      getLoopClips: () => test.getLoopClips(),
      getIncomingInterpolationBreakKeyIds: () => test.getIncomingInterpolationBreakKeyIds(),
      replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
      replaceLoopClips: () => ({ ok: true }),
      replaceRecords: () => ({ ok: true }),
    },
    getLiveSourceSnapshot: () => {
      const document = test.getCanonicalDocument();
      const liveSelection = test.getStudioSelection();
      const selectedRecord = liveSelection.selectedKeyId === null
        ? null
        : document.realKeyRecords.find((entry) => entry.keyId === liveSelection.selectedKeyId) ?? null;
      return {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        records: document.realKeyRecords,
        groupOverrideRecords: document.groupOverrideRecords ?? [],
        interpolation: document.interpolation,
        loopClips: document.loopClips,
        incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
        capacity: document.capacity,
        selectedKeyId: selectedRecord?.keyId ?? null,
        selectedAppFrame: selectedRecord?.appFrame ?? null,
        currentAppFrame: liveSelection.cursorAppFrame,
      };
    },
    undoPaint: () => false,
    redoPaint: () => false,
  });
  return { history, availability };
}

describe('Phase 43.4 Key Rail coordinator/history integration', () => {
  const operations = [
    {
      operationKind: 'scissor-key-rail' as const,
      intent: { kind: 'scissor-key-rail' as const, breakOwnerKeyId: 'B' },
      // Scissor/Delete are triggered from a clicked Key Rail, which clears the
      // child document's selection locally (handleSelectRotoKeyRail) while the
      // parent document retains the last accepted selection (43.4 defect 4).
      clearsDocumentSelection: true,
    },
    {
      operationKind: 'move-key-rail' as const,
      intent: { kind: 'move-key-rail' as const, memberKeyIds: ['A', 'B'], destinationFirstKeyAppFrame: 1 },
      // A Key Rail drag starts on pointer-down without a prior click, so the
      // child document's selection is NOT locally cleared for move.
      clearsDocumentSelection: false,
    },
    {
      operationKind: 'delete-key-rail' as const,
      intent: { kind: 'delete-key-rail' as const, keyIds: ['A', 'B'] },
      clearsDocumentSelection: true,
    },
  ];

  it.each(operations)('settles $operationKind once through executePhysicalEdit and replays its complete document as one command', async ({ operationKind, intent, clearsDocumentSelection }) => {
    const test = harness({ launchRotoPhysical: { selectedKeyId: 'B', cursorAppFrame: 2 } });
    const records = [record('A', 0), record('B', 2), record('C', 6), record('D', 8)];
    const before = parsePhysicPaintRotoPhysicalDocument({
      capacity: 30,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation: INTERPOLATION,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'B',
      cursorAppFrame: 2,
      revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], ['C'], []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['C'],
    });
    test.seedGroupDocument(before);
    // Key Rail selection clears the live selection signal while the accepted
    // document still carries its pre-commit selection ('B'). The replay
    // snapshot must use the document's authority (43.4 defect 2), not the
    // cleared live signal.
    test.setStudioSelection(null, 2);
    // 43.4 defect 4: for click-triggered Scissor/Delete, handleSelectRotoKeyRail
    // ALSO clears the child document's selection locally. The replay snapshot
    // must use the last accepted selection ('B'), not this cleared document
    // selection, or the parent replay-target check rejects the Undo.
    if (clearsDocumentSelection) test.clearCanonicalSelection(2);
    const { history, availability } = attachGroupReplayHistory(test);
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: before.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records: before.realKeyRecords,
      intent,
      parentEndExclusive: 30,
      capacity: 30,
      interpolationEnabled: false,
      loopClips: [],
      incomingInterpolationBreakKeyIds: before.incomingInterpolationBreakKeyIds,
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.failure.text);

    expect(await test.coordinator.executePhysicalEdit({
      proposal: resolution.proposal,
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      operationKind,
      intent,
      selectedKeyId: resolution.proposal.selectedKeyId,
      selectedAppFrame: resolution.proposal.selectedAppFrame,
    } as never)).toBe(true);
    expect(test.accept()).toBe('accepted');
    const accepted = test.coordinator.acceptedOutput.value;
    if (!accepted) throw new Error('Expected accepted Key Rail operation.');
    const after = test.getCanonicalDocument();
    expect(accepted.operationKind).toBe(operationKind);
    // 43.4 defect 2: the replay snapshot must use the same authority as the
    // parent's accepted-command snapshot — the accepted document's selection,
    // not the live selection signal (which Key Rail selection clears to null).
    expect(accepted.before.selectedKeyId).toBe('B');
    expect(test.historyCommands).toEqual([accepted.operationId]);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(test.coordinator.acknowledgePhysicalEditSettlement(accepted.operationId, 'release')).toBe(true);

    expect(await history.undo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const undoOperationId = test.getPayload()?.operationId;
    if (!undoOperationId) throw new Error('Expected Key Rail Undo operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(undoOperationId, 'release')).toBe(true);
    expect(test.getCanonicalDocument()).toEqual(before);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const redoOperationId = test.getPayload()?.operationId;
    if (!redoOperationId) throw new Error('Expected Key Rail Redo operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(redoOperationId, 'release')).toBe(true);
    expect(test.getCanonicalDocument()).toEqual(after);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });
});

describe('Phase 43.4 Key Rail actions-hook → coordinator → history full path (43.4 defect 1)', () => {
  it('records one Scissor command through the real actions hook and restores/reapplies via Undo/Redo', async () => {
    const test = harness();
    const before = parsePhysicPaintRotoPhysicalDocument({
      capacity: 30,
      realKeyRecords: [record('A', 0), record('B', 1), record('C', 2)],
      groupOverrideRecords: [],
      interpolation: INTERPOLATION,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'B',
      cursorAppFrame: 1,
      revision: buildPhysicPaintRotoPhysicalRevision(
        [record('A', 0), record('B', 1), record('C', 2)],
        INTERPOLATION,
        [],
        [],
        [],
      ),
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    test.seedGroupDocument(before);

    const availability = signal({ undo: 0, redo: 0 });
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity: 30, trackId: 'track-a' },
      availability,
      coordinator: test.coordinator,
      recordsPort: {
        getRecords: () => test.getCanonicalDocument().realKeyRecords,
        getInterpolation: () => test.getCanonicalDocument().interpolation,
        getCapacity: () => 30,
        getLoopClips: () => test.getCanonicalDocument().loopClips,
        getIncomingInterpolationBreakKeyIds: () => test.getCanonicalDocument().incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => {
        const doc = test.getCanonicalDocument();
        const selectedRecord = doc.selectedKeyId === null
          ? null
          : doc.realKeyRecords.find((entry) => entry.keyId === doc.selectedKeyId) ?? null;
        return {
          launchOperationId: 'launch-1',
          layerId: 'layer-1',
          projectContextId: 'project-1',
          records: doc.realKeyRecords,
          groupOverrideRecords: doc.groupOverrideRecords ?? [],
          interpolation: doc.interpolation,
          loopClips: doc.loopClips,
          incomingInterpolationBreakKeyIds: doc.incomingInterpolationBreakKeyIds,
          capacity: doc.capacity,
          selectedKeyId: selectedRecord?.keyId ?? null,
          selectedAppFrame: selectedRecord?.appFrame ?? null,
          currentAppFrame: doc.cursorAppFrame,
        };
      },
      undoPaint: () => false,
      redoPaint: () => false,
    });

    const actions = useRotoTimelineActions({
      getModel: () => ({ settings: {}, realSourceFrames: [] }) as never,
      getRotoKeyRecords: () => test.getCanonicalDocument().realKeyRecords,
      getRotoInterpolationState: () => test.getCanonicalDocument().interpolation,
      getCapacity: () => 30,
      getParentEndExclusive: () => 30,
      getRotoLoopClips: () => test.getCanonicalDocument().loopClips,
      getIncomingInterpolationBreakKeyIds: () => test.getCanonicalDocument().incomingInterpolationBreakKeyIds,
      getSelectedKeyId: () => test.getCanonicalDocument().selectedKeyId,
      getSelectedKeyIds: () => [],
      getSelectedKeyRail: () => null,
      getSelectedLoopClipIds: () => [],
      getCurrentAppFrame: () => test.getCanonicalDocument().cursorAppFrame,
      getLaunchContext: () => ({ operationId: 'launch-1', layerId: 'layer-1' }) as never,
      getPhysicalCells: () => [],
      getFrameResolution: () => ({ kind: 'empty' }),
      executePhysicalEdit: test.coordinator.executePhysicalEdit as never,
      pendingOperationId: test.coordinator.pendingOperationId,
      publishStatus: () => {},
      publishDiagnostic: () => {},
    });

    expect(await actions.physicalActions.scissorKeyRail()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const scissorAccepted = test.coordinator.acceptedOutput.value;
    if (!scissorAccepted) throw new Error('Expected accepted Scissor operation.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(scissorAccepted.operationId, 'release')).toBe(true);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(test.getCanonicalDocument().incomingInterpolationBreakKeyIds).toEqual(['B']);

    expect(await history.undo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const undoAccepted = test.coordinator.acceptedOutput.value;
    if (!undoAccepted) throw new Error('Expected accepted Undo operation.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(undoAccepted.operationId, 'release')).toBe(true);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });
    expect(test.getCanonicalDocument().incomingInterpolationBreakKeyIds).toEqual([]);

    expect(await history.redo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const redoAccepted = test.coordinator.acceptedOutput.value;
    if (!redoAccepted) throw new Error('Expected accepted Redo operation.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(redoAccepted.operationId, 'release')).toBe(true);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(test.getCanonicalDocument().incomingInterpolationBreakKeyIds).toEqual(['B']);
  });
});

describe('Phase 43.3 Group Rail drag canonical history controls', () => {
  it('traverses the real spacing, Infinity, finite, and Group move commands in one durable ledger', async () => {
    const test = harness();
    const { history, availability } = attachGroupReplayHistory(test);
    const setup = await spacingInfinityFiniteGroupDragHistoryDocument(test);

    expect(availability.value).toEqual({ undo: 3, redo: 0 });
    expect(await test.executeMoveGroup('group-history', 2)).toBe(true);
    expect(test.accept()).toBe('accepted');
    const moveOperationId = test.getPayload()?.operationId;
    if (!moveOperationId) throw new Error('Expected accepted move operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(moveOperationId, 'release')).toBe(true);
    expect(availability.value).toEqual({ undo: 4, redo: 0 });

    const ordinaryCommands = test.acceptedEvents.filter((event) => event.operationKind !== 'undo' && event.operationKind !== 'redo');
    expect(ordinaryCommands.map((event) => event.operationKind)).toEqual([
      'force-spacing',
      'play-script',
      'play-script',
      'move-group',
    ]);
    expect(new Set(ordinaryCommands.map((event) => event.operationId)).size).toBe(4);

    for (let index = ordinaryCommands.length - 1; index >= 0; index -= 1) {
      const command = ordinaryCommands[index]!;
      const beforeDispatch = availability.value;
      expect(await history.undo(), `Undo command ${command.operationKind}:${command.operationId}`).toBe(true);
      const replayPayload = test.getPayload();
      expect(replayPayload?.historyProvenance).toEqual({
        historyCommandId: command.operationId,
        historyDirection: 'undo',
        sourceRevision: command.acceptedRevision,
        targetRevision: command.before.expectedRevision,
      });
      expect(replayPayload?.cursorAppFrame).toBe(command.before.currentAppFrame);
      expect(availability.value).toEqual(beforeDispatch);
      expect(test.accept()).toBe('accepted');
      expect(availability.value).toEqual({ undo: index, redo: ordinaryCommands.length - index });
      const replayOperationId = replayPayload?.operationId;
      if (!replayOperationId) throw new Error('Expected Undo replay operation ID.');
      expect(test.coordinator.acknowledgePhysicalEditSettlement(replayOperationId, 'release')).toBe(true);
      expect(availability.value).toEqual({ undo: index, redo: ordinaryCommands.length - index });
    }

    expect(test.getCanonicalDocument()).toEqual(freshFiniteGroupDragHistoryDocument(18));
    expect(await history.undo()).toBe(false);
    expect(availability.value).toEqual({ undo: 0, redo: 4 });
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledTimes(8);

    for (let index = 0; index < ordinaryCommands.length; index += 1) {
      const command = ordinaryCommands[index]!;
      expect(await history.redo(), `Redo command ${command.operationKind}:${command.operationId}`).toBe(true);
      const replayPayload = test.getPayload();
      expect(replayPayload?.historyProvenance).toEqual({
        historyCommandId: command.operationId,
        historyDirection: 'redo',
        sourceRevision: command.before.expectedRevision,
        targetRevision: command.acceptedRevision,
      });
      expect(test.accept()).toBe('accepted');
      const replayOperationId = replayPayload?.operationId;
      if (!replayOperationId) throw new Error('Expected Redo replay operation ID.');
      expect(test.coordinator.acknowledgePhysicalEditSettlement(replayOperationId, 'release')).toBe(true);
      expect(availability.value).toEqual({ undo: index + 1, redo: ordinaryCommands.length - index - 1 });
    }

    expect(test.getCanonicalDocument()).toEqual(expectedMovedGroupDragHistoryDocument(setup.document));
    expect(await history.redo()).toBe(false);
    expect(availability.value).toEqual({ undo: 4, redo: 0 });
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledTimes(12);
  });
  it('bounds Group move history at ten commands and exhausts Undo and Redo without dispatch', async () => {
    const test = harness();
    test.seedGroupDocument(freshFiniteGroupDragHistoryDocument(24));
    const { history, availability } = attachGroupReplayHistory(test);
    type BoundedHistoryState = Readonly<{
      document: ReturnType<typeof test.getCanonicalDocument>;
      canonicalSelection: ReturnType<typeof test.getCanonicalSelection>;
      studioSelection: ReturnType<typeof test.getStudioSelection>;
    }>;
    let retainedPostFirstMove: BoundedHistoryState | null = null;
    let finalEleventhMove: BoundedHistoryState | null = null;

    for (let index = 0; index < 11; index += 1) {
      expect(await test.executeMoveGroup('group-history', index + 2)).toBe(true);
      expect(test.accept()).toBe('accepted');
      const operationId = test.getPayload()?.operationId;
      if (!operationId) throw new Error('Expected accepted bounded move operation ID.');
      expect(test.coordinator.acknowledgePhysicalEditSettlement(operationId, 'release')).toBe(true);
      const acceptedState = {
        document: test.getCanonicalDocument(),
        canonicalSelection: test.getCanonicalSelection(),
        studioSelection: test.getStudioSelection(),
      };
      if (index === 0) retainedPostFirstMove = acceptedState;
      if (index === 10) finalEleventhMove = acceptedState;
    }
    if (!retainedPostFirstMove || !finalEleventhMove) throw new Error('Expected retained and final bounded history states.');
    expect(retainedPostFirstMove.document).not.toEqual(finalEleventhMove.document);
    expect(availability.value).toEqual({ undo: 10, redo: 0 });
    const ordinaryCommands = test.acceptedEvents.filter((event) => event.operationKind === 'move-group');
    expect(ordinaryCommands).toHaveLength(11);
    expect(new Set(ordinaryCommands.map((event) => event.operationId)).size).toBe(11);

    for (let index = 0; index < 10; index += 1) {
      const command = ordinaryCommands[10 - index]!;
      expect(await history.undo()).toBe(true);
      const replayPayload = test.getPayload();
      expect(replayPayload?.historyProvenance).toEqual({
        historyCommandId: command.operationId,
        historyDirection: 'undo',
        sourceRevision: command.acceptedRevision,
        targetRevision: command.before.expectedRevision,
      });
      expect(test.accept()).toBe('accepted');
      const operationId = replayPayload?.operationId;
      if (!operationId) throw new Error('Expected bounded Undo operation ID.');
      expect(test.coordinator.acknowledgePhysicalEditSettlement(operationId, 'release')).toBe(true);
      expect(availability.value).toEqual({ undo: 9 - index, redo: index + 1 });
    }
    expect(test.getCanonicalDocument()).toEqual(retainedPostFirstMove.document);
    expect(test.getCanonicalDocument().loopClips).toEqual(retainedPostFirstMove.document.loopClips);
    expect(test.getCanonicalDocument().incomingInterpolationBreakKeyIds).toEqual(retainedPostFirstMove.document.incomingInterpolationBreakKeyIds);
    expect(test.getCanonicalDocument().revision).toBe(retainedPostFirstMove.document.revision);
    expect(test.getCanonicalSelection()).toEqual(retainedPostFirstMove.canonicalSelection);
    expect(test.getStudioSelection()).toEqual(retainedPostFirstMove.studioSelection);
    expect(availability.value).toEqual({ undo: 0, redo: 10 });
    const retainedAfterUndo = test.getCanonicalDocument();
    const retainedCanonicalSelection = test.getCanonicalSelection();
    const retainedStudioSelection = test.getStudioSelection();
    const afterUndoDispatches = test.sendPhysicalEditPayload.mock.calls.length;
    expect(await history.undo()).toBe(false);
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledTimes(afterUndoDispatches);
    expect(test.getCanonicalDocument()).toEqual(retainedAfterUndo);
    expect(test.getCanonicalSelection()).toEqual(retainedCanonicalSelection);
    expect(test.getStudioSelection()).toEqual(retainedStudioSelection);
    expect(availability.value).toEqual({ undo: 0, redo: 10 });

    for (let index = 0; index < 10; index += 1) {
      const command = ordinaryCommands[index + 1]!;
      expect(await history.redo()).toBe(true);
      const replayPayload = test.getPayload();
      expect(replayPayload?.historyProvenance).toEqual({
        historyCommandId: command.operationId,
        historyDirection: 'redo',
        sourceRevision: command.before.expectedRevision,
        targetRevision: command.acceptedRevision,
      });
      expect(test.accept()).toBe('accepted');
      const operationId = replayPayload?.operationId;
      if (!operationId) throw new Error('Expected bounded Redo operation ID.');
      expect(test.coordinator.acknowledgePhysicalEditSettlement(operationId, 'release')).toBe(true);
      expect(availability.value).toEqual({ undo: index + 1, redo: 9 - index });
    }
    expect(test.getCanonicalDocument()).toEqual(finalEleventhMove.document);
    expect(test.getCanonicalDocument().loopClips).toEqual(finalEleventhMove.document.loopClips);
    expect(test.getCanonicalDocument().incomingInterpolationBreakKeyIds).toEqual(finalEleventhMove.document.incomingInterpolationBreakKeyIds);
    expect(test.getCanonicalDocument().revision).toBe(finalEleventhMove.document.revision);
    expect(test.getCanonicalSelection()).toEqual(finalEleventhMove.canonicalSelection);
    expect(test.getStudioSelection()).toEqual(finalEleventhMove.studioSelection);
    expect(availability.value).toEqual({ undo: 10, redo: 0 });
    const retainedAfterRedo = test.getCanonicalDocument();
    const finalCanonicalSelection = test.getCanonicalSelection();
    const finalStudioSelection = test.getStudioSelection();
    const afterRedoDispatches = test.sendPhysicalEditPayload.mock.calls.length;
    expect(await history.redo()).toBe(false);
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledTimes(afterRedoDispatches);
    expect(test.getCanonicalDocument()).toEqual(retainedAfterRedo);
    expect(test.getCanonicalSelection()).toEqual(finalCanonicalSelection);
    expect(test.getStudioSelection()).toEqual(finalStudioSelection);
    expect(availability.value).toEqual({ undo: 10, redo: 0 });
  });

  it('truncates the Redo branch after Undo followed by a newly accepted Group move', async () => {
    const test = harness();
    test.seedGroupDocument(freshFiniteGroupDragHistoryDocument());
    const { history, availability } = attachGroupReplayHistory(test);

    for (const destination of [2, 3]) {
      expect(await test.executeMoveGroup('group-history', destination)).toBe(true);
      expect(test.accept()).toBe('accepted');
      const operationId = test.getPayload()?.operationId;
      if (!operationId) throw new Error('Expected branch setup operation ID.');
      expect(test.coordinator.acknowledgePhysicalEditSettlement(operationId, 'release')).toBe(true);
    }
    expect(await history.undo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const undoOperationId = test.getPayload()?.operationId;
    if (!undoOperationId) throw new Error('Expected branch Undo operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(undoOperationId, 'release')).toBe(true);
    expect(availability.value).toEqual({ undo: 1, redo: 1 });

    expect(await test.executeMoveGroup('group-history', 4)).toBe(true);
    expect(test.accept()).toBe('accepted');
    const branchOperationId = test.getPayload()?.operationId;
    if (!branchOperationId) throw new Error('Expected new branch operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(branchOperationId, 'release')).toBe(true);
    expect(availability.value).toEqual({ undo: 2, redo: 0 });
    const dispatches = test.sendPhysicalEditPayload.mock.calls.length;
    expect(await history.redo()).toBe(false);
    expect(test.sendPhysicalEditPayload).toHaveBeenCalledTimes(dispatches);
  });

  it('keeps document, selection, caches, and history unchanged when replay is rejected', async () => {
    const test = harness();
    test.seedGroupDocument(freshFiniteGroupDragHistoryDocument());
    const { history, availability } = attachGroupReplayHistory(test);
    expect(await test.executeMoveGroup('group-history', 2)).toBe(true);
    expect(test.accept()).toBe('accepted');
    const moveOperationId = test.getPayload()?.operationId;
    if (!moveOperationId) throw new Error('Expected rejection setup operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(moveOperationId, 'release')).toBe(true);

    const beforeDocument = test.getCanonicalDocument();
    const beforeSelection = test.getStudioSelection();
    const beforeCaches = test.getCacheFacts();
    const beforeOrdinaryCount = test.acceptedEvents.filter((event) => event.operationKind !== 'undo' && event.operationKind !== 'redo').length;
    expect(await history.undo()).toBe(true);
    expect(test.reject()).toBe('accepted');

    expect(test.getCanonicalDocument()).toEqual(beforeDocument);
    expect(test.getStudioSelection()).toEqual(beforeSelection);
    expect(test.getCacheFacts()).toEqual(beforeCaches);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(test.acceptedEvents.filter((event) => event.operationKind !== 'undo' && event.operationKind !== 'redo')).toHaveLength(beforeOrdinaryCount);
  });

  it.each([
    { control: 'A', variant: 'finite', description: 'fresh finite Group without Infinity or Key Spacing' },
    { control: 'B', variant: 'spacing-infinity-finite', description: 'Key Spacing to Infinity to finite Group' },
  ] as const)('control $control restores and reapplies the complete $description move as one command', async ({ variant }) => {
    const test = harness();
    const setup = variant === 'finite'
      ? { document: freshFiniteGroupDragHistoryDocument(), setupEvidence: null }
      : await spacingInfinityFiniteGroupDragHistoryDocument();
    const before = setup.document;
    const expectedAfter = expectedMovedGroupDragHistoryDocument(before);
    test.seedGroupDocument(before);
    const selectedLoopClipIds = signal<readonly string[]>(['group-history']);
    const selectedLoopClipId = signal<string | null>('group-history');
    const selectedKeyIds = signal<readonly string[]>([]);
    const selectionAnchorKeyId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    const settleStudioSelection = () => {
      const accepted = test.coordinator.acceptedOutput.value;
      if (!accepted) throw new Error('Expected accepted settlement output.');
      const next = resolvePostAcceptanceRotoStudioSelection({
        selectedLoopClipIds: selectedLoopClipIds.peek(),
        selectedLoopClipId: selectedLoopClipId.peek(),
        operationKind: accepted.operationKind,
        acceptedSelectedKeyId: accepted.after.selectedKeyId,
        keySelection: { selectedKeyIds: selectedKeyIds.peek(), anchorKeyId: selectionAnchorKeyId.peek() },
        currentKeyId: accepted.after.selectedKeyId,
        acceptedAddedKeyIds: [],
      });
      selectedLoopClipIds.value = next.selectedLoopClipIds;
      selectedLoopClipId.value = next.selectedLoopClipId;
      selectedKeyIds.value = next.keySelection.selectedKeyIds;
      selectionAnchorKeyId.value = next.keySelection.anchorKeyId;
    };
    const history = useRotoPhysicalEditHistory({
      identity: {
        trackId: 'track-a',
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 30,
      },
      availability,
      coordinator: test.coordinator,
      recordsPort: {
        getRecords: () => test.getRecords(),
        getInterpolation: () => test.getCanonicalDocument().interpolation,
        getCapacity: () => 30,
        getLoopClips: () => test.getLoopClips(),
        getIncomingInterpolationBreakKeyIds: () => test.getIncomingInterpolationBreakKeyIds(),
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => {
        const document = test.getCanonicalDocument();
        const liveSelection = test.getStudioSelection();
        const selectedRecord = liveSelection.selectedKeyId === null
          ? null
          : document.realKeyRecords.find((entry) => entry.keyId === liveSelection.selectedKeyId) ?? null;
        return {
          launchOperationId: 'launch-1',
          layerId: 'layer-1',
          projectContextId: 'project-1',
          records: document.realKeyRecords,
          groupOverrideRecords: document.groupOverrideRecords ?? [],
          interpolation: document.interpolation,
          loopClips: document.loopClips,
          incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
          capacity: document.capacity,
          selectedKeyId: selectedRecord?.keyId ?? null,
          selectedAppFrame: selectedRecord?.appFrame ?? null,
          currentAppFrame: liveSelection.cursorAppFrame,
        };
      },
      undoPaint: () => false,
      redoPaint: () => false,
    });

    expect(test.getCanonicalDocument()).toEqual(before);
    expect(before.groupOverrideRecords).toEqual([]);
    expect(before.loopClips[0]?.frameOverrides).toEqual([]);
    expect(before.loopClips[0]?.repeat).toBe(2);
    expect(before.incomingInterpolationBreakKeyIds).toEqual([]);
    expect(availability.value).toEqual({ undo: 0, redo: 0 });
    if (variant === 'finite') {
      expect(before.realKeyRecords.filter((entry) => entry.keyId !== 'D').map((entry) => entry.appFrame)).toEqual([1, 2, 3]);
      expect(setup.setupEvidence).toBeNull();
    } else {
      expect(setup.setupEvidence).toEqual({
        spacingAccepted: true,
        spacingSettlementAcknowledged: true,
        spacedSourceFrames: [1, 4, 7],
        infinityAccepted: true,
        infinitySettlementAcknowledged: true,
        infinityRepeat: 'infinity',
        finiteAccepted: true,
        finiteSettlementAcknowledged: true,
        finiteRepeat: 2,
      });
    }
    expect(selectedLoopClipIds.value).toEqual(['group-history']);
    expect(selectedLoopClipId.value).toBe('group-history');
    expect(selectedKeyIds.value).toEqual([]);
    expect(selectionAnchorKeyId.value).toBeNull();
    expect(test.getCurrentFrame()).toBe(6);

    expect(await test.executeMoveGroup('group-history', 2)).toBe(true);
    expect(test.accept()).toBe('accepted');
    settleStudioSelection();
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(selectedLoopClipIds.value).toEqual(['group-history']);
    expect(selectedLoopClipId.value).toBe('group-history');
    expect(selectedKeyIds.value).toEqual([]);
    expect(selectionAnchorKeyId.value).toBeNull();
    expect(test.getCurrentFrame()).toBe(6);
    const moveOperationId = test.getPayload()?.operationId;
    if (!moveOperationId) throw new Error('Expected accepted move operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(moveOperationId, 'release')).toBe(true);
    const afterMove = test.getCanonicalDocument();

    expect(await history.undo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    settleStudioSelection();
    expect(availability.value).toEqual({ undo: 0, redo: 1 });
    expect(selectedLoopClipIds.value).toEqual(['group-history']);
    expect(selectedLoopClipId.value).toBe('group-history');
    expect(selectedKeyIds.value).toEqual([]);
    expect(selectionAnchorKeyId.value).toBeNull();
    expect(test.getCurrentFrame()).toBe(6);
    const undoOperationId = test.getPayload()?.operationId;
    if (!undoOperationId) throw new Error('Expected accepted Undo operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(undoOperationId, 'release')).toBe(true);
    const afterUndo = test.getCanonicalDocument();

    expect(await history.redo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    settleStudioSelection();
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(selectedLoopClipIds.value).toEqual(['group-history']);
    expect(selectedLoopClipId.value).toBe('group-history');
    expect(selectedKeyIds.value).toEqual([]);
    expect(selectionAnchorKeyId.value).toBeNull();
    expect(test.getCurrentFrame()).toBe(6);
    const redoOperationId = test.getPayload()?.operationId;
    if (!redoOperationId) throw new Error('Expected accepted Redo operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(redoOperationId, 'release')).toBe(true);
    const afterRedo = test.getCanonicalDocument();

    expect.soft(afterMove).toEqual(expectedAfter);
    expect.soft(afterUndo).toEqual(before);
    expect.soft(afterRedo).toEqual(expectedAfter);
    expect.soft(expectedAfter.incomingInterpolationBreakKeyIds).toEqual(['D']);
  });
});

describe('Phase 43.3 move-group override publication', () => {
  it('translates the canonical matching override record with its moved Group reference', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ existingOverride: true, cursorAppFrame: 4 });
    test.seedGroupDocument(before);
    const originalOverride = before.groupOverrideRecords?.[0];
    if (!originalOverride) throw new Error('Expected canonical Group override record.');

    expect(await test.executeMoveGroup('group-1', 3)).toBe(true);
    expect(test.getPayload()).toMatchObject({
      operationKind: 'move-group',
      groupOverrideRecords: [{
        keyId: originalOverride.keyId,
        appFrame: 3,
        payload: {
          ...originalOverride.payload,
          appFrame: 3,
        },
      }],
      loopClips: [expect.objectContaining({
        loopId: 'group-1',
        frameOverrides: [{ appFrame: 3, keyId: originalOverride.keyId }],
      })],
    });

    expect(test.accept()).toBe('accepted');
    expect(test.getGroupOverrideRecords()).toEqual([{
      ...originalOverride,
      appFrame: 3,
      payload: { ...originalOverride.payload, appFrame: 3 },
    }]);
  });

  it('fails closed before publication when another Group references the moved override payload', async () => {
    const test = harness();
    const before = groupLifecycleDocument({
      existingOverride: true,
      sharedOverrideReference: true,
      cursorAppFrame: 4,
    });
    test.seedGroupDocument(before);
    const intent = {
      kind: 'move-group',
      loopId: 'group-1',
      destinationPlacementStart: 3,
    } as const;
    const isolatedResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: before.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      intent,
      parentEndExclusive: before.capacity,
      capacity: before.capacity,
      interpolationEnabled: before.interpolation.enabled,
      loopClips: [before.loopClips[0]],
      incomingInterpolationBreakKeyIds: before.incomingInterpolationBreakKeyIds,
    });
    if (!isolatedResolution.ok) throw new Error(isolatedResolution.failure.text);
    const movedPrimary = isolatedResolution.proposal.nextLoopClips?.[0];
    if (!movedPrimary) throw new Error('Expected moved primary Group.');
    const proposal = {
      ...isolatedResolution.proposal,
      nextLoopClips: [movedPrimary, before.loopClips[1]],
    };

    expect(await test.coordinator.executePhysicalEdit({
      proposal,
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      operationKind: 'move-group',
      intent,
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    })).toBe(false);
    expect(test.sendPhysicalEditPayload).not.toHaveBeenCalled();
    expect(test.coordinator.acceptedOutput.value).toBeNull();
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getGroupOverrideRecords()).toEqual(before.groupOverrideRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
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

  it('self-heals a recovery lease left by a deferred Group publication failure so the next edit proceeds (G-43.6-2)', async () => {
    const test = harness({ failFirstLoopReplace: true });
    const before = groupLifecycleDocument({ gapAt: 4 });
    test.seedGroupDocument(before);

    expect(await test.executeGroupPaint(4, 'override-gap-4')).toBe(true);
    expect(test.accept()).toBe('accepted');
    expect(test.transferLeaseToRecovery).toHaveBeenCalledWith(test.leaseToken);
    expect(test.releaseLease).not.toHaveBeenCalled();
    expect(test.coordinator.recoveryLease.value).toBe(test.recoveryLeaseToken);

    expect(await test.executeGroupPaint(4, 'override-gap-4')).toBe(true);
    expect(test.releaseLease).toHaveBeenCalledWith(test.recoveryLeaseToken);
    expect(test.coordinator.recoveryLease.value).toBeNull();
  });

  it('releases a held recovery lease on unmount so a remount does not block edits (43.6 WR-03)', async () => {
    const test = harness({ failFirstLoopReplace: true });
    const before = groupLifecycleDocument({ gapAt: 4 });
    test.seedGroupDocument(before);

    expect(await test.executeGroupPaint(4, 'override-gap-4')).toBe(true);
    expect(test.accept()).toBe('accepted');
    expect(test.coordinator.recoveryLease.value).toBe(test.recoveryLeaseToken);
    expect(test.releaseLease).not.toHaveBeenCalledWith(test.recoveryLeaseToken);

    // Simulate Studio unmount (window close while a recovery lease is held).
    unmountCleanup.current?.();

    // The orphaned recovery token must be released so a fresh coordinator's
    // self-heal is not the only path out of the session-permanent block.
    expect(test.releaseLease).toHaveBeenCalledWith(test.recoveryLeaseToken);
    expect(test.coordinator.recoveryLease.value).toBeNull();
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

  it('accepts Delete Rails as one parent-authority command with no child intent', async () => {
    const test = harness();
    const before = groupLifecycleDocument({ sharedSourceOwner: true });
    test.seedGroupDocument(before);
    const acceptedEvents: unknown[] = [];
    const unsubscribe = test.coordinator.acceptedOutput.subscribe((value) => {
      if (value) acceptedEvents.push(value);
    });

    expect(await test.executeDeleteRails([{ kind: 'loop', loopId: 'group-1' }])).toBe(true);
    expect(test.getPayload()).toMatchObject({
      operationKind: 'delete-rails',
      startFrame: 4,
      expectedRevision: before.revision,
      selectedKeyId: null,
      selectedAppFrame: null,
      semanticDelta: {
        kind: 'delete-rails',
        members: [{ kind: 'loop', loopId: 'group-1' }],
        cleanupKeyIds: [],
      },
    });
    expect(test.accept()).toBe('accepted');
    expect(test.getRecords().map((entry) => entry.keyId)).toEqual(['A', 'B']);
    expect(test.getLoopClips()).toEqual([
      expect.objectContaining({ loopId: 'group-shared' }),
    ]);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(4);
    expect(acceptedEvents).toHaveLength(1);
    expect(test.coordinator.acknowledgePhysicalEditSettlement(test.getPayload()!.operationId, 'release')).toBe(true);
    expect(test.releaseLease).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('rejects a stale Delete Rails set fail-closed before staging or transport', async () => {
    const test = harness();
    const before = groupLifecycleDocument();
    test.seedGroupDocument(before);

    expect(await test.executeDeleteRails([{ kind: 'key-rail', firstKeyId: 'A', keyIds: ['A'] }])).toBe(false);
    expect(test.sendPhysicalEditPayload).not.toHaveBeenCalled();
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['B']);
    expect(test.getCanonicalSelection()).toEqual({ selectedKeyId: null, cursorAppFrame: 4 });
    expect(test.releaseLease).toHaveBeenCalledTimes(1);
    expect(test.coordinator.pendingOperationId.value).toBeNull();
    expect(test.coordinator.failureOutput.value).toBeNull();
  });

  it('leaves a Delete Rails settlement with a divergent semantic delta pending without success', async () => {
    const test = harness();
    const before = groupLifecycleDocument();
    test.seedGroupDocument(before);

    expect(await test.executeDeleteRails([{ kind: 'loop', loopId: 'group-1' }])).toBe(true);
    expect(test.mismatchDelta({
      kind: 'delete-rails',
      members: [
        { kind: 'loop', loopId: 'group-1' },
        { kind: 'loop', loopId: 'group-extra' },
      ],
      cleanupKeyIds: [],
      previousRevision: before.revision,
      nextRevision: 'revision-other',
    })).toBe('mismatch');
    expect(test.coordinator.acceptedOutput.value).toBeNull();
    expect(test.coordinator.failureOutput.value).toBeNull();
    expect(test.reconcileCurrentFrame).not.toHaveBeenCalled();
    test.coordinator.cancelPhysicalEdit('disposal');
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
    const token = Object.freeze({ projectContextId: 'project-1', layerId: 'layer-1', trackId: 'track-1', generation: 1, owner: 'exclusive' as const });
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
        acquireLease: () => Object.freeze({ projectContextId: 'project-1', layerId: 'layer-1', trackId: 'track-1', generation: 1, owner: 'exclusive' as const }),
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

describe('useRotoPhysicalEditCoordinator rail-set paste (quick 260820-bjw)', () => {
  const pastePng = (label: string) => `data:image/png;base64,${btoa(`paste-${label}`)}`;
  const pasteRecord = (keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord => ({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: { frameIndex: 0, appFrame, dataUrl: pastePng(keyId), width: 100, height: 80 },
  });

  function twoKeyRailDocument(capacity = 100) {
    const records = [pasteRecord('k0', 0), pasteRecord('k2', 2), pasteRecord('k6', 6), pasteRecord('k8', 8)];
    return parsePhysicPaintRotoPhysicalDocument({
      capacity,
      realKeyRecords: records,
      interpolation: INTERPOLATION,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 10,
      revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], ['k6']),
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['k6'],
    });
  }

  function copyPayload(): RotoRailSetCopyPayload {
    return Object.freeze({
      anchorAppFrame: 0,
      // '' = legacy payload with no track context (46-03).
      sourceTrackId: '',
      members: Object.freeze([
        Object.freeze({
          kind: 'key-rail' as const,
          firstKeyId: 'k0',
          firstKeyFrame: 0,
          firstKeyOwnsIncomingBreak: false,
          entries: Object.freeze([
            Object.freeze({
              sourceKeyId: 'k0',
              sourceAppFrame: 0,
              ownsIncomingBreak: false,
              payload: { frameIndex: 0, appFrame: 0, dataUrl: pastePng('k0'), width: 100, height: 80 },
            }),
            Object.freeze({
              sourceKeyId: 'k2',
              sourceAppFrame: 2,
              ownsIncomingBreak: false,
              payload: { frameIndex: 0, appFrame: 2, dataUrl: pastePng('k2'), width: 100, height: 80 },
            }),
          ]),
        }),
        Object.freeze({
          kind: 'key-rail' as const,
          firstKeyId: 'k6',
          firstKeyFrame: 6,
          firstKeyOwnsIncomingBreak: true,
          entries: Object.freeze([
            Object.freeze({
              sourceKeyId: 'k6',
              sourceAppFrame: 6,
              ownsIncomingBreak: true,
              payload: { frameIndex: 0, appFrame: 6, dataUrl: pastePng('k6'), width: 100, height: 80 },
            }),
            Object.freeze({
              sourceKeyId: 'k8',
              sourceAppFrame: 8,
              ownsIncomingBreak: false,
              payload: { frameIndex: 0, appFrame: 8, dataUrl: pastePng('k8'), width: 100, height: 80 },
            }),
          ]),
        }),
      ]),
    });
  }

  it('RED: accepts Paste Rails as one parent-authority command with no child intent', async () => {
    const test = harness();
    const before = twoKeyRailDocument();
    test.seedGroupDocument(before);
    const acceptedEvents: unknown[] = [];
    const unsubscribe = test.coordinator.acceptedOutput.subscribe((value) => {
      if (value) acceptedEvents.push(value);
    });

    expect(await test.executePasteRails({ payload: copyPayload(), placementMode: 'paste', destinationAppFrame: 10 })).toBe(true);
    expect(test.getPayload()).toMatchObject({
      operationKind: 'paste',
      startFrame: 10,
      selectedKeyId: null,
      selectedAppFrame: null,
    });
    expect(test.accept()).toBe('accepted');
    // Sources stay; four fresh identities land at the preserved relative layout.
    const sourceIds = new Set(['k0', 'k2', 'k6', 'k8']);
    const freshIds = test.getRecords()
      .map((entry) => entry.keyId)
      .filter((keyId) => !sourceIds.has(keyId));
    expect(freshIds).toHaveLength(4);
    expect(new Set(freshIds).size).toBe(4);
    const freshByFrame = new Map(test.getRecords().map((entry) => [entry.appFrame, entry.keyId]));
    const freshAFirst = freshByFrame.get(10);
    const freshBFirst = freshByFrame.get(16);
    expect(freshAFirst).toBeDefined();
    expect(freshBFirst).toBeDefined();
    // Source-owned break relocates onto the fresh B first key; the rail-boundary
    // rule also gives the fresh A first key a break (any existing content lies to
    // its left), so the pasted set never merges into the source run.
    expect(test.getIncomingInterpolationBreakKeyIds()).toContain(freshBFirst);
    expect(test.getIncomingInterpolationBreakKeyIds()).toContain(freshAFirst);
    expect(test.reconcileCurrentFrame).toHaveBeenCalledWith(10);
    expect(acceptedEvents).toHaveLength(1);
    expect(test.coordinator.acknowledgePhysicalEditSettlement(test.getPayload()!.operationId, 'release')).toBe(true);
    expect(test.releaseLease).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('RED: rejects an empty Paste Rails payload fail-closed before staging or transport', async () => {
    const test = harness();
    const before = twoKeyRailDocument();
    test.seedGroupDocument(before);

    expect(await test.executePasteRails({
      payload: Object.freeze({ anchorAppFrame: 0, sourceTrackId: '', members: Object.freeze([]) }) as RotoRailSetCopyPayload,
      placementMode: 'paste',
      destinationAppFrame: 10,
    })).toBe(false);
    expect(test.sendPhysicalEditPayload).not.toHaveBeenCalled();
    expect(test.getRecords()).toEqual(before.realKeyRecords);
    expect(test.getLoopClips()).toEqual(before.loopClips);
    expect(test.getIncomingInterpolationBreakKeyIds()).toEqual(['k6']);
    expect(test.releaseLease).toHaveBeenCalledTimes(1);
    expect(test.coordinator.pendingOperationId.value).toBeNull();
    expect(test.coordinator.failureOutput.value).toBeNull();
  });

  it('RED (UAT-2): a duplicate-set commit records ONE history command and round-trips Undo/Redo through the real coordinator→history path', async () => {
    const test = harness();
    const before = twoKeyRailDocument(30);
    test.seedGroupDocument(before);
    const { history, availability } = attachGroupReplayHistory(test);

    // Duplicate derives its destination from document facts (last set end 8 →
    // first fitting anchor 10), so no destinationAppFrame is supplied.
    expect(await test.executePasteRails({ payload: copyPayload(), placementMode: 'duplicate' })).toBe(true);
    expect(test.accept()).toBe('accepted');
    const accepted = test.coordinator.acceptedOutput.value;
    if (!accepted) throw new Error('Expected accepted duplicate-set operation.');
    const after = test.getCanonicalDocument();
    // The original set is unchanged; exactly four fresh identities land at 10/12/16/18.
    const sourceIds = new Set(['k0', 'k2', 'k6', 'k8']);
    const freshIds = after.realKeyRecords.map((entry) => entry.keyId).filter((keyId) => !sourceIds.has(keyId));
    expect(freshIds).toHaveLength(4);
    expect(accepted.operationKind).toBe('paste');
    expect(test.historyCommands).toEqual([accepted.operationId]);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(test.coordinator.acknowledgePhysicalEditSettlement(accepted.operationId, 'release')).toBe(true);

    // Undo restores the exact pre-state.
    expect(await history.undo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const undoOperationId = test.getPayload()?.operationId;
    if (!undoOperationId) throw new Error('Expected duplicate-set Undo operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(undoOperationId, 'release')).toBe(true);
    expect(test.getCanonicalDocument()).toEqual(before);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    // Redo re-applies the exact post-state (fresh identities preserved).
    expect(await history.redo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const redoOperationId = test.getPayload()?.operationId;
    if (!redoOperationId) throw new Error('Expected duplicate-set Redo operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(redoOperationId, 'release')).toBe(true);
    expect(test.getCanonicalDocument()).toEqual(after);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('RED (UAT-2): a Paste commit records as one command and round-trips Undo/Redo through the real coordinator→history path', async () => {
    const test = harness();
    const before = twoKeyRailDocument(30);
    test.seedGroupDocument(before);
    const { history, availability } = attachGroupReplayHistory(test);

    expect(await test.executePasteRails({ payload: copyPayload(), placementMode: 'paste', destinationAppFrame: 10 })).toBe(true);
    expect(test.accept()).toBe('accepted');
    const accepted = test.coordinator.acceptedOutput.value;
    if (!accepted) throw new Error('Expected accepted Paste operation.');
    const after = test.getCanonicalDocument();
    expect(accepted.operationKind).toBe('paste');
    expect(test.historyCommands).toEqual([accepted.operationId]);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(test.coordinator.acknowledgePhysicalEditSettlement(accepted.operationId, 'release')).toBe(true);

    expect(await history.undo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const undoOperationId = test.getPayload()?.operationId;
    if (!undoOperationId) throw new Error('Expected Paste Undo operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(undoOperationId, 'release')).toBe(true);
    expect(test.getCanonicalDocument()).toEqual(before);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const redoOperationId = test.getPayload()?.operationId;
    if (!redoOperationId) throw new Error('Expected Paste Redo operation ID.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(redoOperationId, 'release')).toBe(true);
    expect(test.getCanonicalDocument()).toEqual(after);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('RED (UAT-3): Duplicate-set Undo survives the operation’s own post-acceptance selection seeding — the first pasted rail becomes the live selection, yet Undo still removes the pasted set (selection/cursor excluded from replay authority)', async () => {
    const test = harness();
    const before = twoKeyRailDocument(30);
    test.seedGroupDocument(before);
    const { history, availability } = attachGroupReplayHistory(test);

    expect(await test.executePasteRails({ payload: copyPayload(), placementMode: 'duplicate' })).toBe(true);
    expect(test.accept()).toBe('accepted');
    const accepted = test.coordinator.acceptedOutput.value;
    if (!accepted) throw new Error('Expected accepted duplicate-set operation.');
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    // Native 43.6 aftermath: the pasted set becomes the active selection
    // (anchor = first pasted rail). This mutates the live Studio selection
    // AFTER the paste acceptance recorded its after snapshot (selectedKeyId
    // null). The 43.4 lesson: selection/cursor are not canonical, so Undo must
    // still proceed despite the live selection diverging from the recorded
    // after snapshot.
    const firstPasted = test.getRecords().find((entry) => entry.appFrame === 10);
    if (!firstPasted) throw new Error('Expected a fresh pasted key at frame 10.');
    test.setStudioSelection(firstPasted.keyId, 10);
    expect(test.coordinator.acknowledgePhysicalEditSettlement(accepted.operationId, 'release')).toBe(true);

    // Undo removes exactly the duplicated rails and restores the exact pre-state.
    expect(await history.undo()).toBe(true);
    expect(test.accept()).toBe('accepted');
    const undoOperationId = test.getPayload()?.operationId;
    if (!undoOperationId) throw new Error('Expected Duplicate Undo operation id.');
    expect(test.coordinator.acknowledgePhysicalEditSettlement(undoOperationId, 'release')).toBe(true);
    expect(test.getCanonicalDocument()).toEqual(before);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });
  });
});
