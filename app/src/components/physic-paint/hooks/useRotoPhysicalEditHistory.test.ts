import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => setup(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import { resolvePhysicPaintRotoPhysicalEdit } from '../roto/physicsPaintRotoPhysicalResolver';
import { getPhysicsPaintRotoSourceCycleId } from '../roto/physicsPaintRotoSpacingSelection';
import type {
  RotoPhysicalEditAcceptedOutput,
  RotoPhysicalEditExecuteInput,
  RotoPhysicalEditSnapshot,
} from '../roto/rotoCoordinatorPorts';
import {
  useRotoPhysicalEditHistory,
  type ReferencedActionHistoryCommand,
} from './useRotoPhysicalEditHistory';

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

const GROUP_FIELD_PARTICIPATION = [
  { field: 'syncState', value: 'modified' },
  { field: 'provenanceState', value: 'detached' },
  { field: 'phaseOrigin', value: 3 },
  { field: 'originalEndExclusive', value: 30 },
  { field: 'visibleRanges', value: [{ start: 3, endExclusive: 7 }, { start: 8, endExclusive: 20 }] },
  { field: 'frameOverrides', value: [{ appFrame: 7, keyId: 'override-7' }] },
] as const;

const baseLoopClip = () => ({
  loopId: 'loop-1',
  placementStart: 0,
  sourceKeyIds: ['A'],
  repeat: 2 as const,
  mode: 'progressive' as const,
});

const lifecycleLoopClip = () => ({
  ...baseLoopClip(),
  syncState: 'synchronized' as const,
  provenanceState: 'attached' as const,
  phaseOrigin: 0,
  originalEndExclusive: 20,
  visibleRanges: [{ start: 3, endExclusive: 20 }],
  frameOverrides: [] as { appFrame: number; keyId: string }[],
  scriptId: 'action-1',
  motion: { deformation: 0, position: 0 },
  overrideColor: null,
});

const GROUP_LIFECYCLE_OPERATION_KINDS = [
  'paint-group-frame',
  'delete-group-frame',
  'delete-group',
  'regenerate-group',
  'detach-action-groups',
  'delete-action-groups',
] as const;

function snapshot(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  selectedKeyId: string,
  selectedAppFrame: number,
  incomingInterpolationBreakKeyIds: readonly string[] = [],
): RotoPhysicalEditSnapshot<null> {
  const revision = buildPhysicPaintRotoPhysicalRevision(
    records,
    { enabled: false, mode: 'duplicate' },
    [],
    incomingInterpolationBreakKeyIds,
  );
  return {
    launchOperationId: 'launch-1',
    layerId: 'layer-1',
    projectContextId: 'project-1',
    records,
    groupOverrideRecords: [],
    interpolation: { enabled: false, mode: 'duplicate' },
    loopClips: [],
    incomingInterpolationBreakKeyIds: [...incomingInterpolationBreakKeyIds],
    capacity: 10,
    expectedRevision: revision,
    stagedRevision: revision,
    selectedKeyId,
    selectedAppFrame,
    currentAppFrame: selectedAppFrame,
    dirtyFrames: new Set(),
    editableFrames: records.map((entry) => entry.appFrame),
    liveOverlayActionCounts: new Map(),
    frameStates: new Map(),
    previewFrames: new Map(),
    capturedFrames: new Map(),
    confirmedFrames: new Map(),
    cachedReference: { url: null, cachedRepaintBase: null },
    engineState: null,
  };
}

function spacingSnapshot(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loopClips: readonly PhysicPaintRotoLoopClip[],
  selectedKeyId: string | null,
  selectedAppFrame: number | null,
): RotoPhysicalEditSnapshot<null> {
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const revision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips);
  return {
    ...snapshot(records, selectedKeyId ?? 'A', selectedAppFrame ?? 10),
    records,
    interpolation,
    loopClips,
    capacity: 100,
    expectedRevision: revision,
    stagedRevision: revision,
    selectedKeyId,
    selectedAppFrame,
    currentAppFrame: selectedAppFrame ?? 10,
  };
}

describe('useRotoPhysicalEditHistory rigid group drag', () => {
  it('records one accepted move, then moves the same command through one Undo and one Redo', async () => {
    const before = snapshot([
      record('A', 0),
      record('B', 1),
      record('D', 7),
    ], 'B', 1);
    const after = snapshot([
      record('A', 5),
      record('B', 6),
      record('D', 7),
    ], 'B', 6);
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = after;
    let replayNumber = 0;

    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = current;
      current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
          target.records,
          target.interpolation,
          target.loopClips,
          target.incomingInterpolationBreakKeyIds,
        ),
        operationId: `replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });

    const history = useRotoPhysicalEditHistory({
      identity: {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 10,
      },
      availability,
      coordinator: {
        executePhysicalEdit: executePhysicalEdit as never,
        pendingOperationId,
        acceptedOutput,
      },
      recordsPort: {
        getRecords: () => current.records,
        getInterpolation: () => current.interpolation,
        getCapacity: () => current.capacity,
        getLoopClips: () => current.loopClips,
        getIncomingInterpolationBreakKeyIds: () => current.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => current,
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
        after.records,
        after.interpolation,
        after.loopClips,
        after.incomingInterpolationBreakKeyIds,
      ),
      operationId: 'move-group-1',
      operationKind: 'move-key-group',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    acceptedOutput.value = { ...acceptedOutput.value } as RotoPhysicalEditAcceptedOutput<null>;
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    expect(await history.undo()).toBe(true);
    expect(current.records.map(({ keyId, appFrame }) => ({ keyId, appFrame }))).toEqual([
      { keyId: 'A', appFrame: 0 },
      { keyId: 'B', appFrame: 1 },
      { keyId: 'D', appFrame: 7 },
    ]);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(current.records.map(({ keyId, appFrame }) => ({ keyId, appFrame }))).toEqual([
      { keyId: 'A', appFrame: 5 },
      { keyId: 'B', appFrame: 6 },
      { keyId: 'D', appFrame: 7 },
    ]);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(executePhysicalEdit).toHaveBeenCalledTimes(2);
    expect(executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
  });
});

describe('useRotoPhysicalEditHistory Group lifecycle participation', () => {
  it.each(GROUP_FIELD_PARTICIPATION)('records a $field-only canonical change', ({ field, value }) => {
    const base = snapshot([record('A', 0)], 'A', 0);
    const before = { ...base, loopClips: [lifecycleLoopClip()] } as RotoPhysicalEditSnapshot<null>;
    const after = {
      ...base,
      loopClips: [{ ...lifecycleLoopClip(), [field]: value }],
    } as RotoPhysicalEditSnapshot<null>;
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const availability = signal({ undo: 0, redo: 0 });

    useRotoPhysicalEditHistory({
      identity: {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 10,
      },
      availability,
      coordinator: {
        executePhysicalEdit: vi.fn() as never,
        pendingOperationId: signal<string | null>(null),
        acceptedOutput,
      },
      recordsPort: {
        getRecords: () => after.records,
        getInterpolation: () => after.interpolation,
        getCapacity: () => after.capacity,
        getLoopClips: () => after.loopClips,
        getIncomingInterpolationBreakKeyIds: () => after.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => after,
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
        after.records,
        after.interpolation,
        after.loopClips,
        after.incomingInterpolationBreakKeyIds,
      ),
      operationId: `group-field-${field}`,
      operationKind: 'move-key',
      historyProvenance: null,
    };

    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it.each(GROUP_LIFECYCLE_OPERATION_KINDS)('records %s exactly once', (operationKind) => {
    const base = snapshot([record('A', 0)], 'A', 0);
    const before = {
      ...base,
      loopClips: [lifecycleLoopClip()],
    } as RotoPhysicalEditSnapshot<null>;
    const after = {
      ...base,
      loopClips: [{ ...lifecycleLoopClip(), syncState: 'modified' as const }],
    } as RotoPhysicalEditSnapshot<null>;
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const availability = signal({ undo: 0, redo: 0 });

    useRotoPhysicalEditHistory({
      identity: {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 10,
      },
      availability,
      coordinator: {
        executePhysicalEdit: vi.fn() as never,
        pendingOperationId: signal<string | null>(null),
        acceptedOutput,
      },
      recordsPort: {
        getRecords: () => after.records,
        getInterpolation: () => after.interpolation,
        getCapacity: () => after.capacity,
        getLoopClips: () => after.loopClips,
        getIncomingInterpolationBreakKeyIds: () => after.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => after,
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
        after.records,
        after.interpolation,
        after.loopClips,
        after.incomingInterpolationBreakKeyIds,
      ),
      operationId: `lifecycle-${operationKind}`,
      operationKind,
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    acceptedOutput.value = { ...acceptedOutput.value };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('restores exact lifecycle provenance, phase, ranges, and overrides through Undo and Redo', async () => {
    const base = snapshot([record('A', 0), record('override-7', 7)], 'override-7', 7);
    const before = {
      ...base,
      loopClips: [lifecycleLoopClip()],
    } as RotoPhysicalEditSnapshot<null>;
    const after = {
      ...base,
      loopClips: [{
        ...lifecycleLoopClip(),
        syncState: 'modified' as const,
        provenanceState: 'detached' as const,
        phaseOrigin: 3,
        originalEndExclusive: 30,
        visibleRanges: [{ start: 3, endExclusive: 8 }, { start: 9, endExclusive: 30 }],
        frameOverrides: [{ appFrame: 7, keyId: 'override-7' }],
      }],
    } as RotoPhysicalEditSnapshot<null>;
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = after;
    let replayNumber = 0;
    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = current;
      current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
          target.records,
          target.interpolation,
          target.loopClips,
          target.incomingInterpolationBreakKeyIds,
        ),
        operationId: `lifecycle-replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });

    const history = useRotoPhysicalEditHistory({
      identity: {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 10,
      },
      availability,
      coordinator: {
        executePhysicalEdit: executePhysicalEdit as never,
        pendingOperationId,
        acceptedOutput,
      },
      recordsPort: {
        getRecords: () => current.records,
        getInterpolation: () => current.interpolation,
        getCapacity: () => current.capacity,
        getLoopClips: () => current.loopClips,
        getIncomingInterpolationBreakKeyIds: () => current.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => current,
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
        after.records,
        after.interpolation,
        after.loopClips,
        after.incomingInterpolationBreakKeyIds,
      ),
      operationId: 'detach-action-groups-1',
      operationKind: 'detach-action-groups',
      historyProvenance: null,
    };

    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(await history.undo()).toBe(true);
    expect(current.loopClips).toEqual(before.loopClips);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(current.loopClips).toEqual(after.loopClips);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('atomically restores and reapplies one deleted source phase across Repeat 3', async () => {
    const records = [record('A', 0), record('B', 1)];
    const override = record('override-phase-0', 0);
    const beforeLoop: PhysicPaintRotoLoopClip = {
      loopId: 'phase-group',
      placementStart: 0,
      sourceKeyIds: ['A', 'B'],
      repeat: 3,
      mode: 'progressive',
      scriptId: 'action-phase',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: 6,
      visibleRanges: [{ start: 0, endExclusive: 6 }],
      frameOverrides: [{ appFrame: 0, keyId: override.keyId }],
    };
    const afterLoop: PhysicPaintRotoLoopClip = {
      ...beforeLoop,
      visibleRanges: [
        { start: 1, endExclusive: 2 },
        { start: 3, endExclusive: 4 },
        { start: 5, endExclusive: 6 },
      ],
      frameOverrides: [],
    };
    const buildSnapshot = (
      loopClips: readonly PhysicPaintRotoLoopClip[],
      groupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[],
    ): RotoPhysicalEditSnapshot<null> => {
      const interpolation = { enabled: false, mode: 'duplicate' as const };
      const revision = buildPhysicPaintRotoPhysicalRevision(
        records,
        interpolation,
        loopClips,
        [],
        groupOverrideRecords,
      );
      return {
        ...snapshot(records, 'A', 0),
        records,
        groupOverrideRecords,
        interpolation,
        loopClips,
        capacity: 10,
        expectedRevision: revision,
        stagedRevision: revision,
      };
    };
    const before = buildSnapshot([beforeLoop], [override]);
    const after = buildSnapshot([afterLoop], []);
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = after;
    let replayNumber = 0;
    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = current;
      current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
          target.records,
          target.interpolation,
          target.loopClips,
          target.incomingInterpolationBreakKeyIds,
          target.groupOverrideRecords,
        ),
        operationId: `phase-replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 10,
      },
      availability,
      coordinator: { executePhysicalEdit: executePhysicalEdit as never, pendingOperationId, acceptedOutput },
      recordsPort: {
        getRecords: () => current.records,
        getInterpolation: () => current.interpolation,
        getCapacity: () => current.capacity,
        getLoopClips: () => current.loopClips,
        getIncomingInterpolationBreakKeyIds: () => current.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => current,
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: after.stagedRevision,
      operationId: 'delete-group-frame-phase-0',
      operationKind: 'delete-group-frame',
      historyProvenance: null,
    };

    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(await history.undo()).toBe(true);
    expect(current.loopClips[0]).toEqual(beforeLoop);
    expect(current.groupOverrideRecords).toEqual([override]);
    expect(await history.redo()).toBe(true);
    expect(current.loopClips[0]).toEqual(afterLoop);
    expect(current.groupOverrideRecords).toEqual([]);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('records resolver-complete force spacing once and restores exact Repeat 3 lifecycle through Undo and Redo', async () => {
    const beforeRecords = [record('A', 10), record('B', 11), record('C', 12)];
    const beforeLoop: PhysicPaintRotoLoopClip = {
      loopId: 'spacing-group',
      placementStart: 10,
      sourceKeyIds: ['A', 'B', 'C'],
      repeat: 3,
      mode: 'progressive',
      scriptId: 'action-spacing',
      motion: { deformation: 4, position: 2 },
      overrideColor: '#123456',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 19,
      visibleRanges: [{ start: 10, endExclusive: 19 }],
      frameOverrides: [],
    };
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: beforeRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records: beforeRecords,
      loopClips: [beforeLoop],
      capacity: 100,
      interpolationEnabled: false,
      intent: {
        kind: 'force-spacing',
        emptyFrames: 3,
        selectedKeyId: 'B',
        scopeKeyIds: ['A', 'B', 'C'],
        linkedSourceSpacingScopes: [{
          sourceCycleId: getPhysicsPaintRotoSourceCycleId(['A', 'B', 'C']),
          sourceKeyIds: ['A', 'B', 'C'],
          selectedSourceKeyIds: ['A', 'B', 'C'],
        }],
      },
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.failure.text);
    const afterRecords = beforeRecords.map((entry) => {
      const appFrame = resolution.proposal.mapping.get(entry.keyId) ?? entry.appFrame;
      return { ...entry, appFrame, payload: { ...entry.payload, appFrame } };
    });
    const before = spacingSnapshot(beforeRecords, [beforeLoop], 'B', 11);
    const after = spacingSnapshot(afterRecords, resolution.proposal.nextLoopClips ?? [beforeLoop], 'B', 14);
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = after;
    let replayNumber = 0;
    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = current;
      current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
          target.records,
          target.interpolation,
          target.loopClips,
          target.incomingInterpolationBreakKeyIds,
        ),
        operationId: `spacing-replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 100,
      },
      availability,
      coordinator: { executePhysicalEdit: executePhysicalEdit as never, pendingOperationId, acceptedOutput },
      recordsPort: {
        getRecords: () => current.records,
        getInterpolation: () => current.interpolation,
        getCapacity: () => current.capacity,
        getLoopClips: () => current.loopClips,
        getIncomingInterpolationBreakKeyIds: () => current.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => current,
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(after.records, after.interpolation, after.loopClips),
      operationId: 'force-spacing-accepted',
      operationKind: 'force-spacing',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    acceptedOutput.value = { ...acceptedOutput.value };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(current.loopClips).toEqual([{
      ...beforeLoop,
      phaseOrigin: 10,
      originalEndExclusive: 37,
      visibleRanges: [{ start: 10, endExclusive: 37 }],
    }]);

    expect(await history.undo()).toBe(true);
    expect(current).toEqual(before);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(current).toEqual(after);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
  });
});

describe('useRotoPhysicalEditHistory empty-segment ownership', () => {
  it('records one accepted key-plus-break command, replays both directions, and preserves redo for no-change or rejected edits', async () => {
    const before = snapshot([
      record('A', 0),
      record('B', 1),
    ], 'B', 1);
    const after = snapshot([
      record('A', 0),
      record('B', 1),
      record('empty-key-1', 2),
    ], 'empty-key-1', 2, ['empty-key-1']);
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = after;
    let replayNumber = 0;

    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = current;
      current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
          target.records,
          target.interpolation,
          target.loopClips,
          target.incomingInterpolationBreakKeyIds,
        ),
        operationId: `empty-replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });

    const history = useRotoPhysicalEditHistory({
      identity: {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 10,
      },
      availability,
      coordinator: {
        executePhysicalEdit: executePhysicalEdit as never,
        pendingOperationId,
        acceptedOutput,
      },
      recordsPort: {
        getRecords: () => current.records,
        getInterpolation: () => current.interpolation,
        getCapacity: () => current.capacity,
        getLoopClips: () => current.loopClips,
        getIncomingInterpolationBreakKeyIds: () => current.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => current,
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
        after.records,
        after.interpolation,
        after.loopClips,
        after.incomingInterpolationBreakKeyIds,
      ),
      operationId: 'insert-empty-1',
      operationKind: 'insert-empty-segment',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    expect(await history.undo()).toBe(true);
    expect(current.records.map(({ keyId, appFrame }) => [keyId, appFrame])).toEqual([
      ['A', 0],
      ['B', 1],
    ]);
    expect(current.incomingInterpolationBreakKeyIds).toEqual([]);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    acceptedOutput.value = {
      before: current,
      after: current,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(
        current.records,
        current.interpolation,
        current.loopClips,
        current.incomingInterpolationBreakKeyIds,
      ),
      operationId: 'no-change-empty-2',
      operationKind: 'insert-empty-segment',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 0, redo: 1 });
    acceptedOutput.value = null;
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(current.records.map(({ keyId, appFrame }) => [keyId, appFrame])).toEqual([
      ['A', 0],
      ['B', 1],
      ['empty-key-1', 2],
    ]);
    expect(current.incomingInterpolationBreakKeyIds).toEqual(['empty-key-1']);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });
});

describe('useRotoPhysicalEditHistory referenced Action replay', () => {
  it('routes Undo and Redo through durable direction settlement and moves the pointer only after acceptance', async () => {
    const before = snapshot([record('A', 0)], 'A', 0);
    const after = snapshot([record('A', 0)], 'A', 0);
    const toDocument = (source: RotoPhysicalEditSnapshot<null>) => ({
      realKeyRecords: source.records,
      interpolation: source.interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      capacity: source.capacity,
      selectedKeyId: source.selectedKeyId,
      cursorAppFrame: source.currentAppFrame,
      loopClips: source.loopClips,
      incomingInterpolationBreakKeyIds: source.incomingInterpolationBreakKeyIds,
      revision: source.stagedRevision,
    });
    const command: ReferencedActionHistoryCommand = {
      kind: 'referenced-action',
      commandId: 'history-command-1',
      generation: 4,
      mode: 'keep-groups',
      retainedArtifact: {
        commandId: 'history-command-1',
        generation: 4,
        actionId: 'action-1',
        managedPath: 'scripts/action-1.efx-roto-script.json',
        originalRevision: 'action-revision-1',
        integritySha256: 'a'.repeat(64),
      },
      authority: {
        projectContextId: 'project-1',
        layerId: 'layer-1',
        launchOperationId: 'launch-1',
        scriptLibraryAuthority: 'native-authority',
        actionId: 'action-1',
        actionRevision: 'action-revision-1',
      },
      before: {
        physicalRevision: before.stagedRevision,
        physicalHash: 'physical-before-hash',
        document: toDocument(before),
        selectedGroupId: 'group-1',
        cursorAppFrame: 0,
      },
      after: {
        physicalRevision: after.stagedRevision,
        physicalHash: 'physical-after-hash',
        document: toDocument(after),
        selectedGroupId: null,
        cursorAppFrame: 0,
      },
    };
    const acceptedReferencedAction = signal<ReferencedActionHistoryCommand | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = after;
    const replaySettlement: { current?: (accepted: boolean) => void } = {};
    const replay = vi.fn(async (_command: ReferencedActionHistoryCommand, direction: 'undo' | 'redo') => {
      const accepted = await new Promise<boolean>((resolve) => { replaySettlement.current = resolve; });
      if (accepted) current = direction === 'undo' ? before : after;
      return accepted;
    });
    const executePhysicalEdit = vi.fn(async () => true);
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity: 10 },
      availability,
      coordinator: { executePhysicalEdit: executePhysicalEdit as never, pendingOperationId: signal(null), acceptedOutput: signal(null) },
      recordsPort: {
        getRecords: () => current.records,
        getInterpolation: () => current.interpolation,
        getCapacity: () => current.capacity,
        getLoopClips: () => current.loopClips,
        getIncomingInterpolationBreakKeyIds: () => current.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => current,
      referencedActionHistory: { accepted: acceptedReferencedAction, replay },
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedReferencedAction.value = command;
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    const undoing = history.undo();
    await vi.waitFor(() => expect(replay).toHaveBeenCalledWith(command, 'undo'));
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    replaySettlement.current?.(false);
    await expect(undoing).resolves.toBe(false);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    const acceptedUndo = history.undo();
    await vi.waitFor(() => expect(replay).toHaveBeenCalledTimes(2));
    replaySettlement.current?.(true);
    await expect(acceptedUndo).resolves.toBe(true);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    const redoing = history.redo();
    await vi.waitFor(() => expect(replay).toHaveBeenLastCalledWith(command, 'redo'));
    expect(availability.value).toEqual({ undo: 0, redo: 1 });
    replaySettlement.current?.(true);
    await expect(redoing).resolves.toBe(true);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });
});

describe('useRotoPhysicalEditHistory retained Action ownership', () => {
  it('releases only referenced commands on eviction, redo truncation, and session clear', async () => {
    const base = snapshot([record('A', 0)], 'A', 0);
    const changed = snapshot([record('A', 1)], 'A', 1);
    const toDocument = (source: RotoPhysicalEditSnapshot<null>) => ({
      realKeyRecords: source.records,
      interpolation: source.interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      capacity: source.capacity,
      selectedKeyId: source.selectedKeyId,
      cursorAppFrame: source.currentAppFrame,
      loopClips: source.loopClips,
      incomingInterpolationBreakKeyIds: source.incomingInterpolationBreakKeyIds,
      revision: source.stagedRevision,
    });
    const command = (index: number): ReferencedActionHistoryCommand => ({
      kind: 'referenced-action',
      commandId: `history-command-${index}`,
      generation: index + 1,
      mode: 'keep-groups',
      retainedArtifact: {
        commandId: `history-command-${index}`, generation: index + 1, actionId: 'action-1',
        managedPath: 'scripts/action-1.efx-roto-script.json', originalRevision: 'action-revision-1', integritySha256: 'a'.repeat(64),
      },
      authority: {
        projectContextId: 'project-1', layerId: 'layer-1', launchOperationId: 'launch-1',
        scriptLibraryAuthority: 'native-authority',
        actionId: 'action-1', actionRevision: 'action-revision-1',
      },
      before: { physicalRevision: base.stagedRevision, physicalHash: 'before-hash', document: toDocument(base), selectedGroupId: 'group-1', cursorAppFrame: 0 },
      after: { physicalRevision: base.stagedRevision, physicalHash: 'after-hash', document: toDocument(base), selectedGroupId: null, cursorAppFrame: 0 },
    });
    const acceptedReferencedAction = signal<ReferencedActionHistoryCommand | null>(null);
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    const release = vi.fn(async () => true);
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity: 10 },
      availability,
      coordinator: { executePhysicalEdit: vi.fn() as never, pendingOperationId: signal(null), acceptedOutput },
      recordsPort: {
        getRecords: () => base.records,
        getInterpolation: () => base.interpolation,
        getCapacity: () => base.capacity,
        getLoopClips: () => base.loopClips,
        getIncomingInterpolationBreakKeyIds: () => base.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => base,
      referencedActionHistory: { accepted: acceptedReferencedAction, replay: vi.fn(async () => true), release },
      undoPaint: () => false,
      redoPaint: () => false,
    });

    for (let index = 0; index < 11; index += 1) acceptedReferencedAction.value = command(index);
    expect(availability.value).toEqual({ undo: 10, redo: 0 });
    await vi.waitFor(() => expect(release).toHaveBeenCalledWith(command(0), 'eviction'));

    expect(await history.undo()).toBe(true);
    expect(availability.value).toEqual({ undo: 9, redo: 1 });
    acceptedOutput.value = {
      before: base,
      after: changed,
      acceptedRevision: changed.stagedRevision,
      operationId: 'ordinary-after-undo',
      operationKind: 'move-key',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 10, redo: 0 });
    await vi.waitFor(() => expect(release).toHaveBeenCalledWith(command(10), 'redo-branch-truncation'));

    history.clear();
    expect(availability.value).toEqual({ undo: 0, redo: 0 });
    await vi.waitFor(() => {
      for (let index = 1; index < 10; index += 1) {
        expect(release).toHaveBeenCalledWith(command(index), 'session-history-clear');
      }
    });
    expect(release).toHaveBeenCalledTimes(11);
  });
});

describe('useRotoPhysicalEditHistory complete live replay preflight', () => {
  it.each([
    {
      name: 'selection',
      mutate: (source: RotoPhysicalEditSnapshot<null>) => ({
        ...source,
        selectedKeyId: 'A',
        selectedAppFrame: 0,
      }),
    },
    {
      name: 'cursor',
      mutate: (source: RotoPhysicalEditSnapshot<null>) => ({
        ...source,
        currentAppFrame: source.currentAppFrame + 1,
      }),
    },
  ])('retains the stack after an ordinary $name change but rejects replay before coordinator execution', async ({ mutate }) => {
    const before = snapshot([
      record('A', 0),
      record('B', 1),
    ], 'A', 0);
    const after = snapshot([
      record('A', 0),
      record('B', 2),
    ], 'B', 2);
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let liveSource = after;
    const executePhysicalEdit = vi.fn(async () => true);

    const history = useRotoPhysicalEditHistory({
      identity: {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 10,
      },
      availability,
      coordinator: {
        executePhysicalEdit: executePhysicalEdit as never,
        pendingOperationId,
        acceptedOutput,
      },
      recordsPort: {
        getRecords: () => liveSource.records,
        getInterpolation: () => liveSource.interpolation,
        getCapacity: () => liveSource.capacity,
        getLoopClips: () => liveSource.loopClips,
        getIncomingInterpolationBreakKeyIds: () => liveSource.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => liveSource,
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: after.stagedRevision,
      operationId: 'move-selection-cursor-command',
      operationKind: 'move-key',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    liveSource = mutate(after);

    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(await history.undo()).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('ignores an accepted command from a different project or capacity authority', () => {
    const before = snapshot([record('A', 0)], 'A', 0);
    const after = snapshot([record('A', 1)], 'A', 1);
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const availability = signal({ undo: 0, redo: 0 });

    useRotoPhysicalEditHistory({
      identity: {
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-2',
        capacity: 20,
      },
      availability,
      coordinator: {
        executePhysicalEdit: vi.fn() as never,
        pendingOperationId: signal<string | null>(null),
        acceptedOutput,
      },
      recordsPort: {
        getRecords: () => after.records,
        getInterpolation: () => after.interpolation,
        getCapacity: () => after.capacity,
        getLoopClips: () => after.loopClips,
        getIncomingInterpolationBreakKeyIds: () => after.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => after,
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: after.stagedRevision,
      operationId: 'foreign-authority-command',
      operationKind: 'move-key',
      historyProvenance: null,
    };

    expect(availability.value).toEqual({ undo: 0, redo: 0 });
  });
});
