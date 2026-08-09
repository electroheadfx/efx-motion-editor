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
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  getPhysicsPaintRotoSourceCycleId,
} from '../roto/physicsPaintRotoSpacingSelection';
import { resolvePhysicPaintRotoPhysicalEdit } from '../roto/physicsPaintRotoPhysicalResolver';
import type { RotoPhysicalEditCoordinatorPorts } from '../roto/rotoCoordinatorPorts';
import { useRotoPhysicalEditCoordinator } from './useRotoPhysicalEditCoordinator';

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
  const resolution = resolvePhysicPaintRotoPhysicalEdit({
    identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    records,
    intent: {
      kind: 'force-spacing',
      emptyFrames: 2,
      selectedKeyId: null,
      scopeKeyIds: ['A', 'B', 'C'],
      linkedSourceSpacingScopes: [{
        sourceCycleId: getPhysicsPaintRotoSourceCycleId(['A', 'B', 'C']),
        sourceKeyIds: ['A', 'B', 'C'],
        selectedSourceKeyIds: ['A', 'B', 'C'],
      }],
    },
    loopClips,
    capacity: 30,
    interpolationEnabled: false,
  });
  if (!resolution.ok) throw new Error(resolution.failure.text);
  return { records, loopClips, proposal: resolution.proposal };
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
  const emptyMap = new Map<number, unknown>();
  const emptySet = new Set<number>();
  const ports: RotoPhysicalEditCoordinatorPorts<null> = {
    engine: null,
    records: {
      getRecords: () => records,
      getInterpolation: () => interpolation,
      getCapacity: () => 30,
      getLoopClips: () => loopClips,
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
      setCachedReference: vi.fn(),
      reconcileCurrentFrame: vi.fn(),
    },
    engineState: {
      saveEngineState: () => null,
      loadEngineState: vi.fn(),
    },
    launch: {
      getLaunchContext: () => ({ operationId: 'launch-1', layerId: 'layer-1' }) as never,
      setLaunchContextStartFrame: (frame) => { currentFrame = frame; },
      setLaunchContextCachedFrames: vi.fn(),
    },
    paint: {
      flushPendingStrokeFinalizations: vi.fn(),
      flushLivePixels: vi.fn(async () => {}),
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
      setConciseMessage: vi.fn(),
      setLastError: vi.fn(),
      logDiagnostic: vi.fn(),
    },
  };
  Object.assign(ports.records, {
    getIncomingInterpolationBreakKeyIds: () => incomingInterpolationBreakKeyIds,
    replaceIncomingInterpolationBreakKeyIds: (_layerId: string, keyIds: readonly string[]) => {
      incomingInterpolationBreakKeyIds = keyIds;
      return { ok: true as const };
    },
  });
  const coordinator = useRotoPhysicalEditCoordinator(ports);
  const execute = () => coordinator.executePhysicalEdit({
    proposal: initial.proposal,
    expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
    operationKind: 'force-spacing',
    selectedKeyId: null,
    selectedAppFrame: null,
  });
  const executePlayScript = () => {
    const nextRecord = record('Z', 8);
    const nextRecords = [...records, nextRecord];
    return coordinator.executePhysicalEdit({
      operationKind: 'play-script',
      expectedLaunch: { operationId: 'launch-1', layerId: 'layer-1' },
      expectedRevision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips),
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
  const accept = () => {
    if (!payload) throw new Error('Expected a sent payload.');
    const stagedRevision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips);
    const result: PhysicPaintRotoPhysicalEditApplyResult = {
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
      loopClips: payload.loopClips,
      incomingInterpolationBreakKeyIds: payload.incomingInterpolationBreakKeyIds,
    };
    return coordinator.consumePhysicalEditResult(result);
  };
  return {
    coordinator,
    execute,
    executePlayScript,
    accept,
    initial,
    replaceRecords,
    replaceLoopClips,
    sendPhysicalEditPayload,
    getRecords: () => records,
    getLoopClips: () => loopClips,
    getIncomingInterpolationBreakKeyIds: () => incomingInterpolationBreakKeyIds,
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

describe('useRotoPhysicalEditCoordinator Loop Clip staging', () => {
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
