import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

const revealHarness = vi.hoisted(() => ({ renderReveal: vi.fn() }));

vi.mock('../roto/physicsPaintRotoPlayScriptRenderer', () => ({
  renderRotoRevealFrames: revealHarness.renderReveal,
}));

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => setup(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

// 46-03 Task 3: spy the efxPaintStore track-activation seam (D-04) while
// keeping the real document store behavior — setActiveTrackId must really
// write the document and bump documentRevision; the tests only observe the
// call order around the coordinator replay.
vi.mock('../../../stores/efxPaintStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../stores/efxPaintStore')>();
  return {
    ...actual,
    getActiveTrackId: vi.fn((layerId: string) => actual.getActiveTrackId(layerId)),
    setActiveTrackId: vi.fn((layerId: string, trackId: string) => actual.setActiveTrackId(layerId, trackId)),
  };
});

import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import { createEfxPaintDocument, type EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  _setEfxPaintMarkDirtyCallback,
  _setEfxPaintRevealScriptLoader,
  addBackgroundClip,
  createRevealRail,
  deleteBackgroundClip,
  getActiveTrackId,
  getDocument,
  registerDocument,
  reset as resetEfxPaintDocumentStore,
  setActiveTrackId,
  setPhotoReferenceOpacity,
  setPhotoReferenceSource,
} from '../../../stores/efxPaintStore';
import {
  _setPhysicPaintCompositorSizeProvider,
  _setPhysicPaintMarkDirtyCallback,
  physicPaintStore,
  registerReferenceSourceImage,
} from '../../../stores/physicPaintStore';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from '../roto/physicsPaintRotoPhysicalModel';
import { proposePhysicPaintRotoDeleteRails } from '../roto/physicsPaintRotoGroupLifecycle';
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

/** Push-command snapshot carrying records, Loop Clip placements, the incoming
 * break collection, selection, and cursor at the given physical capacity. */
function pushSnapshot(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loopClips: readonly PhysicPaintRotoLoopClip[],
  incomingInterpolationBreakKeyIds: readonly string[],
  selectedKeyId: string | null,
  selectedAppFrame: number | null,
  capacity: number,
): RotoPhysicalEditSnapshot<null> {
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const revision = buildPhysicPaintRotoPhysicalRevision(
    records,
    interpolation,
    loopClips,
    incomingInterpolationBreakKeyIds,
  );
  return {
    ...snapshot(records, selectedKeyId ?? 'A', selectedAppFrame ?? 0),
    records,
    interpolation,
    loopClips,
    incomingInterpolationBreakKeyIds: [...incomingInterpolationBreakKeyIds],
    capacity,
    expectedRevision: revision,
    stagedRevision: revision,
    selectedKeyId,
    selectedAppFrame,
    currentAppFrame: selectedAppFrame ?? 0,
  };
}

describe('useRotoPhysicalEditHistory ordinary-key delete beside Groups', () => {
  const deleteBesideGroupsClips = (): PhysicPaintRotoLoopClip[] => [{
    ...lifecycleLoopClip(),
    loopId: 'group-1',
    sourceKeyIds: ['G1A', 'G1B'],
    phaseOrigin: 0,
    originalEndExclusive: 4,
    visibleRanges: [{ start: 0, endExclusive: 4 }],
  }, {
    ...lifecycleLoopClip(),
    loopId: 'group-2',
    placementStart: 8,
    sourceKeyIds: ['G2A', 'G2B'],
    phaseOrigin: 8,
    originalEndExclusive: 12,
    visibleRanges: [{ start: 8, endExclusive: 12 }],
  }];

  it('restores the exact pre-delete document through Undo and removes only X again through Redo', async () => {
    const loopClips = deleteBesideGroupsClips();
    const records = [
      record('G1A', 0),
      record('G1B', 1),
      record('X', 5),
      record('G2A', 8),
      record('G2B', 9),
    ];
    const before = spacingSnapshot(records, loopClips, 'X', 5);
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: { kind: 'delete-key', selectedKeyId: 'X' },
      parentEndExclusive: 100,
      capacity: 100,
      interpolationEnabled: false,
      loopClips,
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Ordinary-key delete beside Groups must resolve');
    const afterRecords = resolution.proposal.assignments.map(({ keyId, appFrame }) => record(keyId, appFrame));
    const after = spacingSnapshot(
      afterRecords,
      loopClips,
      resolution.proposal.selectedKeyId,
      resolution.proposal.selectedAppFrame,
    );

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
        trackId: 'track-a',
        launchOperationId: 'launch-1',
        layerId: 'layer-1',
        projectContextId: 'project-1',
        capacity: 100,
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
      operationId: 'delete-x-1',
      operationKind: 'delete-key',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(after.records.map(({ keyId, appFrame }) => ({ keyId, appFrame }))).toEqual([
      { keyId: 'G1A', appFrame: 0 },
      { keyId: 'G1B', appFrame: 1 },
      { keyId: 'G2A', appFrame: 8 },
      { keyId: 'G2B', appFrame: 9 },
    ]);

    expect(await history.undo()).toBe(true);
    expect(current.records.map(({ keyId, appFrame }) => ({ keyId, appFrame }))).toEqual(
      before.records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    );
    expect(JSON.stringify(current.loopClips)).toBe(JSON.stringify(before.loopClips));
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(current.records.map(({ keyId, appFrame }) => ({ keyId, appFrame }))).toEqual([
      { keyId: 'G1A', appFrame: 0 },
      { keyId: 'G1B', appFrame: 1 },
      { keyId: 'G2A', appFrame: 8 },
      { keyId: 'G2B', appFrame: 9 },
    ]);
    expect(JSON.stringify(current.loopClips)).toBe(JSON.stringify(before.loopClips));
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(executePhysicalEdit).toHaveBeenCalledTimes(2);
  });
});

describe('useRotoPhysicalEditHistory Background clip delete (49-06 UAT)', () => {
  it('records a Bg clip delete as one unified-ledger undo step and restores/re-applies the document by reference', async () => {
    const layerId = 'layer-bg-undo';
    registerDocument(createEfxPaintDocument(layerId));
    const added = addBackgroundClip(layerId, { startFrame: 0, sourceFrameRefs: ['asset-a'], repeat: { mode: 'finite', count: 1 } });
    expect(added.ok).toBe(true);
    if (!added.ok) throw new Error('add must succeed');
    const deleted = deleteBackgroundClip(layerId, added.clipId);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) throw new Error('delete must succeed');
    const descriptor = deleted.descriptor;
    expect(descriptor).not.toBeNull();
    if (!descriptor) throw new Error('delete must emit a descriptor');

    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    const history = useRotoPhysicalEditHistory({
      identity: { trackId: 'track-a', launchOperationId: 'launch-1', layerId, projectContextId: 'project-1', capacity: 100 },
      availability,
      coordinator: { executePhysicalEdit: (async () => false) as never, pendingOperationId, acceptedOutput },
      recordsPort: {
        getRecords: () => [],
        getInterpolation: () => ({ enabled: false, mode: 'duplicate' }),
        getCapacity: () => 100,
        getLoopClips: () => [],
        getIncomingInterpolationBreakKeyIds: () => [],
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => spacingSnapshot([], [], null, null),
      undoPaint: () => false,
      redoPaint: () => false,
    });

    history.recordBackgroundEdit(descriptor);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    // after the delete, the clip is gone
    expect(getDocument(layerId)!.background.clips).toHaveLength(0);

    // Undo restores the exact pre-delete document by reference (BKG-08, D-08).
    expect(await history.undo()).toBe(true);
    expect(getDocument(layerId)!.background.clips).toHaveLength(1);
    expect(getDocument(layerId)!.background.clips[0]!.id).toBe(added.clipId);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    // Redo re-applies the post-delete document.
    expect(await history.redo()).toBe(true);
    expect(getDocument(layerId)!.background.clips).toHaveLength(0);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('fails closed on Undo when an unrecorded edit diverged the live document (CR-01)', async () => {
    const layerId = 'layer-bg-guard';
    registerDocument(createEfxPaintDocument(layerId));
    const added = addBackgroundClip(layerId, { startFrame: 0, sourceFrameRefs: ['asset-a'], repeat: { mode: 'finite', count: 1 } });
    expect(added.ok).toBe(true);
    if (!added.ok) throw new Error('add must succeed');
    const deleted = deleteBackgroundClip(layerId, added.clipId);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) throw new Error('delete must succeed');
    const descriptor = deleted.descriptor;
    if (!descriptor) throw new Error('delete must emit a descriptor');

    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    const history = useRotoPhysicalEditHistory({
      identity: { trackId: 'track-a', launchOperationId: 'launch-1', layerId, projectContextId: 'project-1', capacity: 100 },
      availability,
      coordinator: { executePhysicalEdit: (async () => false) as never, pendingOperationId, acceptedOutput },
      recordsPort: {
        getRecords: () => [],
        getInterpolation: () => ({ enabled: false, mode: 'duplicate' }),
        getCapacity: () => 100,
        getLoopClips: () => [],
        getIncomingInterpolationBreakKeyIds: () => [],
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => spacingSnapshot([], [], null, null),
      undoPaint: () => false,
      redoPaint: () => false,
    });

    history.recordBackgroundEdit(descriptor);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    // An UNRECORDED add after the delete diverges the live document from the
    // recorded `after` object — Undo must fail closed (stack untouched, the
    // added clip survives) instead of clobbering it with the snapshot restore.
    const unrecorded = addBackgroundClip(layerId, { startFrame: 5, sourceFrameRefs: ['asset-b'], repeat: { mode: 'finite', count: 1 } });
    expect(unrecorded.ok).toBe(true);
    expect(getDocument(layerId)!.background.clips).toHaveLength(1);

    expect(await history.undo()).toBe(false);
    expect(getDocument(layerId)!.background.clips).toHaveLength(1);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });
});

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
        trackId: 'track-a',
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
        trackId: 'track-a',
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
        trackId: 'track-a',
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
        trackId: 'track-a',
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
        trackId: 'track-a',
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

  it('restores and reapplies an actual Infinity Group move through Undo and Redo', async () => {
    const beforeRecords = [
      record('A', 10),
      record('B', 12),
      record('N', 30),
      record('O', 31),
    ];
    const beforeLoop: PhysicPaintRotoLoopClip = {
      loopId: 'infinity-move-history',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity',
      mode: 'static',
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 10, endExclusive: 25 }],
      frameOverrides: [],
    };
    const nextLoop: PhysicPaintRotoLoopClip = {
      loopId: 'infinity-move-history-next',
      placementStart: 30,
      sourceKeyIds: ['N', 'O'],
      repeat: 2,
      mode: 'static',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 30,
      originalEndExclusive: 34,
      visibleRanges: [{ start: 30, endExclusive: 34 }],
      frameOverrides: [],
    };
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: beforeRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records: beforeRecords,
      loopClips: [beforeLoop, nextLoop],
      parentEndExclusive: 40,
      capacity: 100,
      interpolationEnabled: false,
      intent: {
        kind: 'move-group',
        loopId: beforeLoop.loopId,
        destinationPlacementStart: 8,
      },
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.failure.text);

    const afterRecords = beforeRecords.map((entry) => {
      const appFrame = resolution.proposal.mapping.get(entry.keyId) ?? entry.appFrame;
      return { ...entry, appFrame, payload: { ...entry.payload, appFrame } };
    });
    const afterLoopClips = resolution.proposal.nextLoopClips ?? [beforeLoop, nextLoop];
    const before = spacingSnapshot(beforeRecords, [beforeLoop, nextLoop], 'A', 10);
    const after = spacingSnapshot(
      afterRecords,
      afterLoopClips,
      resolution.proposal.selectedKeyId,
      resolution.proposal.selectedAppFrame,
    );
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
        operationId: `infinity-move-replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: {
        trackId: 'track-a',
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
      acceptedRevision: after.stagedRevision,
      operationId: 'move-group-infinity-accepted',
      operationKind: 'move-group',
      historyProvenance: null,
    };

    expect(current.records).toEqual(afterRecords);
    expect(current.loopClips).toEqual(afterLoopClips);
    expect(await history.undo()).toBe(true);
    expect(current).toEqual(before);
    expect(await history.redo()).toBe(true);
    expect(current).toEqual(after);
    expect(executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
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
      parentEndExclusive: 100,
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
        trackId: 'track-a',
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
        trackId: 'track-a',
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
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity: 10, trackId: 'track-a' },
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
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity: 10, trackId: 'track-a' },
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

describe('useRotoPhysicalEditHistory Key Rail atomic commands (43.4-08)', () => {
  const cases = [
    {
      operationKind: 'scissor-key-rail' as const,
      operationId: 'scissor-key-rail-accepted',
      before: snapshot([record('A', 0), record('B', 2), record('C', 4)], 'B', 2, []),
      after: snapshot([record('A', 0), record('B', 2), record('C', 4)], 'B', 2, ['B']),
    },
    {
      operationKind: 'move-key-rail' as const,
      operationId: 'move-key-rail-accepted',
      before: snapshot([record('A', 0), record('B', 2), record('C', 6)], 'A', 0, ['C']),
      after: snapshot([record('A', 2), record('B', 4), record('C', 6)], 'A', 2, ['C']),
    },
    {
      operationKind: 'delete-key-rail' as const,
      operationId: 'delete-key-rail-accepted',
      before: snapshot([record('A', 0), record('B', 2), record('C', 6), record('D', 8)], 'B', 2, ['C']),
      after: snapshot([record('C', 6), record('D', 8)], 'C', 6, ['C']),
    },
    {
      // quick 260820-0kg: a generated-origin scissor (keys 0/2/6/8, cursor 4)
      // stores the same break-ownership byte parity as the real-key scissor.
      operationKind: 'scissor-key-rail' as const,
      operationId: 'scissor-key-rail-generated-accepted',
      before: snapshot([record('k0', 0), record('k2', 2), record('k6', 6), record('k8', 8)], 'k6', 4, []),
      after: snapshot([record('k0', 0), record('k2', 2), record('k6', 6), record('k8', 8)], 'k6', 4, ['k6']),
    },
  ];

  it.each(cases)('records one accepted $operationKind command and restores exact keys, breaks, selection, and cursor through Undo/Redo', async ({ operationKind, operationId, before, after }) => {
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
        acceptedRevision: target.stagedRevision,
        operationId: `${operationKind}-replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity: 10, trackId: 'track-a' },
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
      operationId,
      operationKind,
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    acceptedOutput.value = { ...acceptedOutput.value };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    expect(await history.undo()).toBe(true);
    expect(current).toEqual(before);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(current).toEqual(after);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
  });

  it('truncates Redo after Undo followed by a new accepted Key Rail edit', async () => {
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    let current = cases[0].after;
    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = current;
      current = target;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: target.stagedRevision,
        operationId: 'branch-undo-replay',
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity: 10, trackId: 'track-a' },
      availability,
      coordinator: { executePhysicalEdit: executePhysicalEdit as never, pendingOperationId: signal(null), acceptedOutput },
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
      before: cases[0].before,
      after: cases[0].after,
      acceptedRevision: cases[0].after.stagedRevision,
      operationId: cases[0].operationId,
      operationKind: cases[0].operationKind,
      historyProvenance: null,
    };
    expect(await history.undo()).toBe(true);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    const branchAfter = snapshot([record('A', 0), record('B', 2), record('C', 4)], 'C', 4, ['C']);
    current = branchAfter;
    acceptedOutput.value = {
      before: cases[0].before,
      after: branchAfter,
      acceptedRevision: branchAfter.stagedRevision,
      operationId: 'branch-delete-key-rail',
      operationKind: 'delete-key-rail',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(await history.redo()).toBe(false);
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
  ])('allows replay after an ordinary $name-only change — selection/cursor are not canonical (43.4)', async ({ mutate }) => {
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
        trackId: 'track-a',
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
    // A selection/cursor-only live divergence must NOT fail closed: the stack
    // is retained (no replay acceptance yet) but Undo proceeds to coordinator
    // execution with the replay proposal (43.4 — selection/cursor are absent
    // from the canonical revision).
    expect(await history.undo()).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('ignores an accepted command from a different project or capacity authority', () => {
    const before = snapshot([record('A', 0)], 'A', 0);
    const after = snapshot([record('A', 1)], 'A', 1);
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const availability = signal({ undo: 0, redo: 0 });

    useRotoPhysicalEditHistory({
      identity: {
        trackId: 'track-a',
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

describe('useRotoPhysicalEditHistory push atomic command (43.5-03 Task 2)', () => {
  const pushLoopClip = (placementStart: number): PhysicPaintRotoLoopClip => ({
    loopId: 'loop-1',
    placementStart,
    sourceKeyIds: ['D'],
    repeat: 2,
    mode: 'progressive',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: placementStart,
    originalEndExclusive: placementStart + 7,
    visibleRanges: [{ start: placementStart, endExclusive: placementStart + 7 }],
    frameOverrides: [],
  });

  it('restores the complete pre-push state — records, Loop Clip placement, break collection, selection, and cursor — through one Undo and one Redo (PUSH-06, 43.4 D-24)', async () => {
    // Compute the committed push outcome through the pure resolver so the
    // history round-trips exactly what a push commit publishes: an opened gap
    // with its movement-created break, the translated Loop Clip placement, and
    // the deterministic selection on the anchor Rail's first key.
    const beforeRecords = [record('A', 0), record('B', 1), record('D', 7)];
    const beforeLoopClips = [pushLoopClip(7)];
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: beforeRecords.map((entry) => ({ keyId: entry.keyId, appFrame: entry.appFrame })),
      intent: { kind: 'push-rails', direction: 'right', anchorKeyId: 'A', deltaFrames: 2 },
      parentEndExclusive: 30,
      capacity: 30,
      interpolationEnabled: false,
      loopClips: beforeLoopClips,
      incomingInterpolationBreakKeyIds: [],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Push fixture must resolve');
    const proposal = resolution.proposal;
    expect(proposal.status.changed).toBe(true);
    expect(proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['A']);
    expect(proposal.selectedKeyId).toBe('A');
    expect(proposal.selectedAppFrame).toBe(2);
    const afterRecords = [...proposal.mapping.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([keyId, appFrame]) => record(keyId, appFrame));
    const afterLoopClips = proposal.nextLoopClips ?? [];
    const afterBreaks = proposal.nextIncomingInterpolationBreakKeyIds ?? [];
    expect(afterLoopClips[0]?.placementStart).toBe(9);

    const before = pushSnapshot(beforeRecords, beforeLoopClips, [], 'A', 0, 30);
    const after = pushSnapshot(afterRecords, afterLoopClips, afterBreaks, 'A', 2, 30);

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
        acceptedRevision: target.stagedRevision,
        operationId: `push-rails-replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity: 30, trackId: 'track-a' },
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
      operationId: 'push-rails-accepted',
      operationKind: 'push-rails',
      historyProvenance: null,
    };
    expect(availability.value).toEqual({ undo: 1, redo: 0 });

    // One Undo restores the complete pre-push state.
    expect(await history.undo()).toBe(true);
    expect(current).toEqual(before);
    expect(current.records).toEqual(beforeRecords);
    expect(current.loopClips[0]?.placementStart).toBe(7);
    expect(current.incomingInterpolationBreakKeyIds).toEqual([]);
    expect(current.selectedKeyId).toBe('A');
    expect(current.selectedAppFrame).toBe(0);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    // One Redo reapplies it exactly — including the movement-created break.
    expect(await history.redo()).toBe(true);
    expect(current).toEqual(after);
    expect(current.records).toEqual(afterRecords);
    expect(current.loopClips[0]?.placementStart).toBe(9);
    expect(current.incomingInterpolationBreakKeyIds).toEqual(['A']);
    expect(current.selectedKeyId).toBe('A');
    expect(current.selectedAppFrame).toBe(2);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
  });
});

describe('useRotoPhysicalEditHistory batch operations on a rail set (43.6 gap closure)', () => {
  // Lifecycle-complete Group fixture idiom shared with the 43.6-04 parity suite
  // (physicsPaintRotoGroupParity.test.ts): the delete-rails proposer validates
  // lifecycle facts through isLifecycleGroup, so Group members must carry all
  // six durable lifecycle fields.
  const batchPngDataUrl = (label: string) => `data:image/png;base64,${btoa(`batch-${label}`)}`;
  const batchRealKey = (keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord => ({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: { frameIndex: 0, appFrame, dataUrl: batchPngDataUrl(keyId), width: 10, height: 10 },
  });
  const batchLifecycleGroup = (
    loopId: string,
    placementStart: number,
    sourceKeyIds: readonly string[],
    repeat: number,
  ): PhysicPaintRotoLoopClip => {
    const endExclusive = placementStart + sourceKeyIds.length * repeat;
    return {
      loopId,
      placementStart,
      sourceKeyIds: Object.freeze([...sourceKeyIds]),
      repeat,
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: placementStart,
      originalEndExclusive: endExclusive,
      visibleRanges: Object.freeze([Object.freeze({ start: placementStart, endExclusive })]),
      frameOverrides: Object.freeze([]),
    };
  };

  /** Project a parsed delete-rails document onto the history snapshot shape. */
  const snapshotFromDocument = (
    document: PhysicPaintRotoPhysicalDocument,
  ): RotoPhysicalEditSnapshot<null> => pushSnapshot(
    document.realKeyRecords,
    document.loopClips,
    document.incomingInterpolationBreakKeyIds,
    document.selectedKeyId,
    document.selectedKeyId === null ? 0 : document.cursorAppFrame,
    document.capacity,
  );

  /**
   * The same push-rails harness shape (43.5-03 Task 2): the replay seam swaps
   * `current` to the exact target snapshot and publishes the accepted output
   * carrying the replay provenance.
   */
  const createBatchHarness = (capacity: number, after: RotoPhysicalEditSnapshot<null>) => {
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    const state = { current: after };
    let replayNumber = 0;
    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = state.current;
      state.current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: target.stagedRevision,
        operationId: `batch-replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity, trackId: 'track-a' },
      availability,
      coordinator: { executePhysicalEdit: executePhysicalEdit as never, pendingOperationId, acceptedOutput },
      recordsPort: {
        getRecords: () => state.current.records,
        getInterpolation: () => state.current.interpolation,
        getCapacity: () => state.current.capacity,
        getLoopClips: () => state.current.loopClips,
        getIncomingInterpolationBreakKeyIds: () => state.current.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => state.current,
      undoPaint: () => false,
      redoPaint: () => false,
    });
    return { acceptedOutput, availability, executePhysicalEdit, history, state };
  };

  const expectBatchUndoRedoRoundTrip = async (input: {
    readonly operationKind: 'delete-rails' | 'move-rails' | 'spacing-on-set';
    readonly operationId: string;
    readonly before: RotoPhysicalEditSnapshot<null>;
    readonly after: RotoPhysicalEditSnapshot<null>;
  }) => {
    const { operationKind, operationId, before, after } = input;
    const harness = createBatchHarness(after.capacity, after);

    // One coordinator acceptance of the batch kind appends exactly one applied
    // history command.
    harness.acceptedOutput.value = {
      before,
      after,
      acceptedRevision: after.stagedRevision,
      operationId,
      operationKind,
      historyProvenance: null,
    };
    expect(harness.availability.value).toEqual({ undo: 1, redo: 0 });

    // Undo replays the exact pre-operation document snapshot.
    expect(await harness.history.undo()).toBe(true);
    expect(harness.state.current).toEqual(before);
    expect(harness.availability.value).toEqual({ undo: 0, redo: 1 });

    // Redo reapplies the exact post-operation document snapshot.
    expect(await harness.history.redo()).toBe(true);
    expect(harness.state.current).toEqual(after);
    expect(harness.availability.value).toEqual({ undo: 1, redo: 0 });
    expect(harness.executePhysicalEdit.mock.calls.map(([call]) => call.operationKind)).toEqual(['undo', 'redo']);
  };

  it("records one accepted 'delete-rails' command on a mixed set and replays the exact before/after documents", async () => {
    // TRUE multi-member mixed set: Key Rail [F,G] (segment opened by the break
    // on F) + Group Rail group-sibling, with Group Rail group-main surviving.
    const beforeRecords = [
      batchRealKey('A', 0), batchRealKey('B', 1),
      batchRealKey('D', 10), batchRealKey('E', 11),
      batchRealKey('F', 20), batchRealKey('G', 21),
    ];
    const beforeLoopClips = [
      batchLifecycleGroup('group-main', 0, ['A', 'B'], 1),
      batchLifecycleGroup('group-sibling', 10, ['D', 'E'], 1),
    ];
    const beforeBreaks = ['F'];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const beforeDocument = parsePhysicPaintRotoPhysicalDocument({
      capacity: 600,
      realKeyRecords: beforeRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(beforeRecords, interpolation, beforeLoopClips, beforeBreaks),
      loopClips: beforeLoopClips,
      incomingInterpolationBreakKeyIds: beforeBreaks,
    });

    // The shared pure proposer (43.6-04) computes the complete next document —
    // the exact post-delete state the coordinator publishes.
    const result = proposePhysicPaintRotoDeleteRails({
      document: beforeDocument,
      members: [
        { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
        { kind: 'loop', loopId: 'group-sibling' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Mixed-set delete must resolve');
    expect(result.proposal.realKeyRecords.map((entry) => entry.keyId)).toEqual(['A', 'B']);
    expect(result.proposal.loopClips.map((clip) => clip.loopId)).toEqual(['group-main']);
    expect(result.proposal.incomingInterpolationBreakKeyIds).toEqual([]);

    await expectBatchUndoRedoRoundTrip({
      operationKind: 'delete-rails',
      operationId: 'delete-rails-accepted',
      before: snapshotFromDocument(beforeDocument),
      after: snapshotFromDocument(result.proposal),
    });
  });

  it("records one accepted delete-rails command restoring the exact pre-delete selection set (G-43.6-2)", async () => {
    // Same mixed set as the null-selection round-trip above, but the pre-delete
    // selection is NON-NULL and lives INSIDE the deleted Key Rail [F,G] — the
    // coordinator's captureSnapshot authority must carry 'F' into the before
    // snapshot and the undo replay must submit it (never the post-delete
    // selection).
    const beforeRecords = [
      batchRealKey('A', 0), batchRealKey('B', 1),
      batchRealKey('D', 10), batchRealKey('E', 11),
      batchRealKey('F', 20), batchRealKey('G', 21),
    ];
    const beforeLoopClips = [
      batchLifecycleGroup('group-main', 0, ['A', 'B'], 1),
      batchLifecycleGroup('group-sibling', 10, ['D', 'E'], 1),
    ];
    const beforeBreaks = ['F'];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const beforeDocument = parsePhysicPaintRotoPhysicalDocument({
      capacity: 600,
      realKeyRecords: beforeRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'F',
      cursorAppFrame: 20,
      revision: buildPhysicPaintRotoPhysicalRevision(beforeRecords, interpolation, beforeLoopClips, beforeBreaks),
      loopClips: beforeLoopClips,
      incomingInterpolationBreakKeyIds: beforeBreaks,
    });

    const result = proposePhysicPaintRotoDeleteRails({
      document: beforeDocument,
      members: [
        { kind: 'key-rail', firstKeyId: 'F', keyIds: ['F', 'G'] },
        { kind: 'loop', loopId: 'group-sibling' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Mixed-set delete must resolve');
    // The post-delete selection differs from the pre-delete selection 'F'.
    expect(result.proposal.selectedKeyId).not.toBe('F');

    // The round-trip helper asserts the undo-restored state equals the before
    // snapshot INCLUDING selectedKeyId 'F' (snapshots carry the selection
    // fields), and the redo-restored state equals the after snapshot.
    await expectBatchUndoRedoRoundTrip({
      operationKind: 'delete-rails',
      operationId: 'delete-rails-set-selection-accepted',
      before: snapshotFromDocument(beforeDocument),
      after: snapshotFromDocument(result.proposal),
    });
  });

  it("records one accepted 'move-rails' command on a two-member set and replays the exact before/after documents", async () => {
    // Two Key Rails — A [0,3) and D [10,12) (segment split by the break on D) —
    // translate rigidly by one unit through the REAL resolver intent.
    const beforeRecords = [
      record('A', 0), record('B', 1), record('C', 2),
      record('D', 10), record('E', 11),
    ];
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: beforeRecords.map((entry) => ({ keyId: entry.keyId, appFrame: entry.appFrame })),
      intent: {
        kind: 'move-rails',
        members: [
          { kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B', 'C'] },
          { kind: 'key-rail', firstKeyId: 'D', keyIds: ['D', 'E'] },
        ],
        delta: 1,
      },
      parentEndExclusive: 40,
      capacity: 40,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['D'],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Two-rail move must resolve');
    const { proposal } = resolution;
    expect(proposal.status.operationKind).toBe('move-rails');
    expect(proposal.status.changed).toBe(true);
    const afterRecords = [...proposal.mapping.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([keyId, appFrame]) => record(keyId, appFrame));
    const afterBreaks = proposal.nextIncomingInterpolationBreakKeyIds ?? ['D'];
    expect(afterRecords.map((entry) => entry.appFrame)).toEqual([1, 2, 3, 11, 12]);

    await expectBatchUndoRedoRoundTrip({
      operationKind: 'move-rails',
      operationId: 'move-rails-accepted',
      before: pushSnapshot(beforeRecords, [], ['D'], 'A', 0, 40),
      after: pushSnapshot(afterRecords, [], afterBreaks, proposal.selectedKeyId, proposal.selectedAppFrame, 40),
    });
  });

  it("records one accepted 'spacing-on-set' command on a two-member set and replays the exact before/after documents", async () => {
    // The plan's two-Key-Rail spacing example (43.6-05): Rail A at 0,3,6 and
    // Rail B at 20,23 respace with one empty frame through the REAL resolver
    // intent — each rail keeps its own first key as anchor.
    const beforeRecords = [
      record('a0', 0), record('a1', 3), record('a2', 6),
      record('b0', 20), record('b1', 23),
    ];
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: beforeRecords.map((entry) => ({ keyId: entry.keyId, appFrame: entry.appFrame })),
      intent: {
        kind: 'spacing-on-set',
        members: [
          { kind: 'key-rail', firstKeyId: 'a0', keyIds: ['a0', 'a1', 'a2'] },
          { kind: 'key-rail', firstKeyId: 'b0', keyIds: ['b0', 'b1'] },
        ],
        emptyFrames: 1,
      },
      parentEndExclusive: 40,
      capacity: 40,
      interpolationEnabled: true,
      incomingInterpolationBreakKeyIds: ['b0'],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error('Two-rail spacing must resolve');
    const { proposal } = resolution;
    expect(proposal.status.operationKind).toBe('spacing-on-set');
    expect(proposal.status.changed).toBe(true);
    const afterRecords = [...proposal.mapping.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([keyId, appFrame]) => record(keyId, appFrame));
    const afterBreaks = proposal.nextIncomingInterpolationBreakKeyIds ?? ['b0'];
    expect(Object.fromEntries(proposal.mapping)).toEqual({
      a0: 0, a1: 2, a2: 4,
      b0: 20, b1: 22,
    });

    await expectBatchUndoRedoRoundTrip({
      operationKind: 'spacing-on-set',
      operationId: 'spacing-on-set-accepted',
      before: pushSnapshot(beforeRecords, [], ['b0'], 'a0', 0, 40),
      after: pushSnapshot(afterRecords, [], afterBreaks, proposal.selectedKeyId, proposal.selectedAppFrame, 40),
    });
  });

  it("RED: records one accepted 'paste' command on a copied rail set and replays the exact before/after documents", async () => {
    // Copy of rail A [0,2] + rail B [6,8] (break on k6) pasted at frame 10:
    // fresh keys land 10/12 and 16/18 with the relocated break on the fresh
    // B first key. The history module must treat 'paste' as an ordinary
    // history-bearing command (like 'delete-rails') so the batch round-trip
    // above works unchanged.
    const beforeRecords = [
      record('k0', 0), record('k2', 2),
      record('k6', 6), record('k8', 8),
    ];
    const afterRecords = [
      record('k0', 0), record('k2', 2),
      record('k6', 6), record('k8', 8),
      record('k10', 10), record('k12', 12),
      record('k16', 16), record('k18', 18),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const beforeDocument = parsePhysicPaintRotoPhysicalDocument({
      capacity: 100,
      realKeyRecords: beforeRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 10,
      revision: buildPhysicPaintRotoPhysicalRevision(beforeRecords, interpolation, [], ['k6']),
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['k6'],
    });
    const afterDocument = parsePhysicPaintRotoPhysicalDocument({
      capacity: 100,
      realKeyRecords: afterRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 10,
      revision: buildPhysicPaintRotoPhysicalRevision(afterRecords, interpolation, [], ['k6', 'k10', 'k16']),
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['k6', 'k10', 'k16'],
    });

    await expectBatchUndoRedoRoundTrip({
      operationKind: 'paste' as never,
      operationId: 'paste-accepted',
      before: snapshotFromDocument(beforeDocument),
      after: snapshotFromDocument(afterDocument),
    });
  });
});

describe('useRotoPhysicalEditHistory track-tagged undo/redo (46-03 Task 3 — D-01..D-04)', () => {
  const TRACK_A = 'track-a';
  const TRACK_B = 'track-b';

  /** Two-track v1.0 document: A (with optional seeded records) and B. */
  function registerTwoTrackDocument(activeTrackId: string, aRecords: readonly PhysicPaintRotoRealKeyRecord[] = []): void {
    const base = createEfxPaintDocument('layer-1');
    const trackA: EfxPaintDocument['tracks'][number] = Object.freeze({
      ...base.tracks[0],
      id: TRACK_A,
      name: 'Track A',
      order: 0,
      rotoPhysical: Object.freeze({
        capacity: 100,
        realKeyRecords: Object.freeze([...aRecords]),
        interpolation: Object.freeze({ enabled: false, mode: 'duplicate' as const }),
        scriptMotion: Object.freeze({ deformation: 0, position: 0 }),
        background: null,
        selectedKeyId: null,
        cursorAppFrame: 0,
        // Canonical revision of the seeded records — the 45-01 docrev
        // builders re-parse fail-closed, so a non-canonical fixture revision
        // (like a bare 'seed-a') is rejected by setActiveTrackId.
        revision: buildPhysicPaintRotoPhysicalRevision(aRecords, { enabled: false, mode: 'duplicate' }, [], []),
        loopClips: Object.freeze([]),
        incomingInterpolationBreakKeyIds: Object.freeze([]),
      }) as PhysicPaintRotoPhysicalDocument,
    });
    const trackB: EfxPaintDocument['tracks'][number] = Object.freeze({
      ...base.tracks[0],
      id: TRACK_B,
      name: 'Track B',
      order: 1,
    });
    registerDocument(Object.freeze({
      ...base,
      activeTrackId,
      tracks: Object.freeze([trackA, trackB]),
    }));
  }

  /**
   * Track-aware history harness: one identity whose trackId is LIVE (the test
   * mutates it between acceptances), a coordinator replay seam that swaps
   * `state.current` to the exact replay target, and the efxPaintStore
   * document store behind the real setActiveTrackId/getActiveTrackId.
   */
  function createTrackHarness(options: { trackId: string; current?: RotoPhysicalEditSnapshot<null> }) {
    const { trackId } = options;
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    const state = { current: options.current ?? snapshot([record('B', 0)], 'B', 0) };
    const identity = { launchOperationId: 'launch-1', layerId: 'layer-1', projectContextId: 'project-1', capacity: 10, trackId };
    let replayNumber = 0;
    const executePhysicalEdit = vi.fn(async (input: RotoPhysicalEditExecuteInput<never, null>) => {
      const target = input.replayTargetSnapshot;
      if (!target || !input.historyProvenance) return false;
      const source = state.current;
      state.current = target;
      replayNumber += 1;
      acceptedOutput.value = {
        before: source,
        after: target,
        acceptedRevision: target.stagedRevision,
        operationId: `replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });
    const history = useRotoPhysicalEditHistory({
      identity,
      availability,
      coordinator: { executePhysicalEdit: executePhysicalEdit as never, pendingOperationId, acceptedOutput },
      recordsPort: {
        getRecords: () => state.current.records,
        getInterpolation: () => state.current.interpolation,
        getCapacity: () => state.current.capacity,
        getLoopClips: () => state.current.loopClips,
        getIncomingInterpolationBreakKeyIds: () => state.current.incomingInterpolationBreakKeyIds,
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => state.current,
      undoPaint: () => false,
      redoPaint: () => false,
    });
    return { acceptedOutput, availability, executePhysicalEdit, history, identity, state };
  }

  /** Collect every path whose value is a data:image/png raster (deep walk, Maps included). */
  function collectRasterPaths(value: unknown, path = 'snapshot', out: string[] = []): string[] {
    if (typeof value === 'string') {
      if (value.startsWith('data:image/png')) out.push(path);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => collectRasterPaths(item, `${path}[${index}]`, out));
    } else if (value && typeof value === 'object') {
      if (value instanceof Map) {
        for (const [key, entry] of value) collectRasterPaths(entry, `${path}.map(${String(key)})`, out);
      } else if (value instanceof Set) {
        for (const entry of value) collectRasterPaths(entry, `${path}.set`, out);
      } else {
        for (const [key, entry] of Object.entries(value)) collectRasterPaths(entry, `${path}.${key}`, out);
      }
    }
    return out;
  }

  beforeEach(() => {
    _setEfxPaintMarkDirtyCallback(() => {});
    resetEfxPaintDocumentStore();
    vi.mocked(setActiveTrackId).mockClear();
    vi.mocked(getActiveTrackId).mockClear();
  });

  it('RED: the applied-stack top entry carries trackId B; undoing it replays B\'s before-state and leaves A\'s records untouched', async () => {
    registerTwoTrackDocument(TRACK_A, [record('A', 0)]);
    const beforeB = snapshot([record('B', 1)], 'B', 1);
    const afterB = snapshot([record('B', 1), record('B2', 2)], 'B', 1);
    const harness = createTrackHarness({ trackId: TRACK_B, current: afterB });

    // One accepted edit on track B.
    harness.acceptedOutput.value = {
      before: beforeB,
      after: afterB,
      acceptedRevision: afterB.stagedRevision,
      operationId: 'op-b',
      operationKind: 'insert-slot',
      historyProvenance: null,
    };
    expect(harness.availability.value).toEqual({ undo: 1, redo: 0 });

    // Undo auto-activates the entry's track BEFORE the coordinator replay —
    // the observable proof that the entry was tagged with trackId B.
    expect(await harness.history.undo()).toBe(true);
    expect(vi.mocked(setActiveTrackId)).toHaveBeenCalledWith('layer-1', TRACK_B);
    expect(vi.mocked(setActiveTrackId).mock.invocationCallOrder[0])
      .toBeLessThan(harness.executePhysicalEdit.mock.invocationCallOrder[0]);
    // B's before-state was replayed.
    expect(harness.state.current).toEqual(beforeB);
    // A's records in the document store are untouched.
    const trackA = getDocument('layer-1')!.tracks.find((track) => track.id === TRACK_A)!;
    expect(trackA.rotoPhysical!.realKeyRecords.map((entry) => entry.keyId)).toEqual(['A']);
  });

  it('RED: 12 ordinary edits (6 cross-track operations) on mixed tracks trim to the 10-level cap', () => {
    const harness = createTrackHarness({ trackId: TRACK_A });
    let records: readonly PhysicPaintRotoRealKeyRecord[] = [];
    for (let operation = 0; operation < 6; operation += 1) {
      // One cross-track operation emits one acceptance PER track with the
      // same operationId (the 46-03 move primitive's paste+delete halves).
      for (const trackId of [TRACK_A, TRACK_B]) {
        harness.identity.trackId = trackId;
        const before = snapshot(records, 'A', 0);
        records = [...records, record(`k${operation}-${trackId === TRACK_A ? 'a' : 'b'}`, records.length)];
        const after = snapshot(records, 'A', 0);
        harness.acceptedOutput.value = {
          before,
          after,
          acceptedRevision: after.stagedRevision,
          operationId: `op-${operation}`,
          operationKind: 'insert-slot',
          historyProvenance: null,
        };
      }
    }
    // 12 track-tagged acceptances recorded (trackId breaks the same-op
    // dedupe), then the existing 10-level trim holds.
    expect(harness.availability.value).toEqual({ undo: 10, redo: 0 });
  });

  it('RED: undoing a B-tagged entry with track A active sets the document activeTrackId to B and bumps documentRevision', async () => {
    registerTwoTrackDocument(TRACK_A);
    const beforeRevision = getDocument('layer-1')!.documentRevision;
    const before = snapshot([record('B', 1)], 'B', 1);
    const after = snapshot([record('B', 1), record('B2', 2)], 'B', 1);
    const harness = createTrackHarness({ trackId: TRACK_B, current: after });
    harness.acceptedOutput.value = {
      before,
      after,
      acceptedRevision: after.stagedRevision,
      operationId: 'op-b',
      operationKind: 'insert-slot',
      historyProvenance: null,
    };

    expect(await harness.history.undo()).toBe(true);

    expect(getActiveTrackId('layer-1')).toBe(TRACK_B);
    const document = getDocument('layer-1')!;
    expect(document.activeTrackId).toBe(TRACK_B);
    expect(document.documentRevision).toBe(beforeRevision + 1);
  });

  it('RED: two accepted edits with the same operationId on different tracks both record; same track still dedupes', () => {
    const harness = createTrackHarness({ trackId: TRACK_A });
    harness.identity.trackId = TRACK_A;
    harness.acceptedOutput.value = {
      before: snapshot([], 'A', 0),
      after: snapshot([record('k0', 0)], 'A', 0),
      acceptedRevision: 'rev-1',
      operationId: 'op-shared',
      operationKind: 'insert-slot',
      historyProvenance: null,
    };
    harness.identity.trackId = TRACK_B;
    harness.acceptedOutput.value = {
      before: snapshot([], 'B', 0),
      after: snapshot([record('b0', 0)], 'B', 0),
      acceptedRevision: 'rev-2',
      operationId: 'op-shared',
      operationKind: 'insert-slot',
      historyProvenance: null,
    };
    expect(harness.availability.value).toEqual({ undo: 2, redo: 0 });
    // Same operationId on the SAME track is still one command (dedupe key
    // includes the track).
    harness.acceptedOutput.value = {
      before: snapshot([], 'B', 0),
      after: snapshot([record('b0', 0)], 'B', 0),
      acceptedRevision: 'rev-2',
      operationId: 'op-shared',
      operationKind: 'insert-slot',
      historyProvenance: null,
    };
    expect(harness.availability.value).toEqual({ undo: 2, redo: 0 });
  });

  it('RED: no stored snapshot field holds a dataUrl raster (D-03 — records + refs + revision hash only)', async () => {
    // A pre-D-03-style snapshot carrying a raster in the cached repaint base —
    // the coordinator captures it, the HISTORY ENTRY must not.
    const raster = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const after: RotoPhysicalEditSnapshot<null> = {
      ...snapshot([record('k0', 0)], 'k0', 0),
      cachedReference: {
        url: '/cache/track-a/frame-0.png',
        cachedRepaintBase: { dataUrl: raster } as never,
      },
    };
    const harness = createTrackHarness({ trackId: TRACK_A, current: after });
    const before = snapshot([], 'k0', 0);
    harness.acceptedOutput.value = {
      before,
      after,
      acceptedRevision: after.stagedRevision,
      operationId: 'op-bytes',
      operationKind: 'insert-slot',
      historyProvenance: null,
    };

    // Undo then Redo so the STORED after entry (not just the fixture) crosses
    // the replay seam as the redo target.
    expect(await harness.history.undo()).toBe(true);
    expect(await harness.history.redo()).toBe(true);
    const storedAfter = harness.executePhysicalEdit.mock.calls[1][0].replayTargetSnapshot as unknown;
    const rasterPaths = collectRasterPaths(storedAfter);
    // The canonical record dataUrls (reference to the cached sidecar) are the
    // only data: rasters allowed in the entry — never a frame-map or repaint base.
    const outsideRecords = rasterPaths.filter((path) => (
      !path.startsWith('snapshot.records[') && !path.startsWith('snapshot.groupOverrideRecords[')
    ));
    expect(outsideRecords).toEqual([]);
  });
});

describe('useRotoPhysicalEditHistory reveal rail entries (G-52-5)', () => {
  const REVEAL_TRACK_ID = 'track-1';
  const REVEAL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const revealScript = {
    provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 },
    sourceFrame: 0,
    sourceDisplayFrame: 0,
    sourceRevision: 1,
    brushes: [],
  };

  function registerRevealTrackDocument(layerId: string): void {
    const base = createEfxPaintDocument(layerId);
    const track = base.tracks[0]!;
    registerDocument({
      ...base,
      activeTrackId: REVEAL_TRACK_ID,
      tracks: [{ ...track, id: REVEAL_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
    });
  }

  async function createRevealDescriptor(layerId: string) {
    revealHarness.renderReveal.mockResolvedValue([
      { frameIndex: 0, appFrame: 10, dataUrl: REVEAL_PNG, width: 4, height: 3, source: 'real-key' },
      { frameIndex: 1, appFrame: 11, dataUrl: REVEAL_PNG, width: 4, height: 3, source: 'real-key' },
    ]);
    const result = await createRevealRail(layerId, {
      trackId: REVEAL_TRACK_ID,
      scriptId: 'script-1',
      variant: 'progressive',
      startFrame: 10,
      frameCount: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('reveal create must succeed');
    expect(result.descriptor).not.toBeNull();
    return result.descriptor!;
  }

  function createRevealHistory(layerId: string) {
    const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
    const pendingOperationId = signal<string | null>(null);
    const availability = signal({ undo: 0, redo: 0 });
    const history = useRotoPhysicalEditHistory({
      identity: { trackId: REVEAL_TRACK_ID, launchOperationId: 'launch-1', layerId, projectContextId: 'project-1', capacity: 100 },
      availability,
      coordinator: { executePhysicalEdit: (async () => false) as never, pendingOperationId, acceptedOutput },
      recordsPort: {
        getRecords: () => [],
        getInterpolation: () => ({ enabled: false, mode: 'duplicate' }),
        getCapacity: () => 100,
        getLoopClips: () => [],
        getIncomingInterpolationBreakKeyIds: () => [],
        replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true }),
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      getLiveSourceSnapshot: () => spacingSnapshot([], [], null, null),
      undoPaint: () => false,
      redoPaint: () => false,
    });
    return { history, availability };
  }

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintDocumentStore();
    _setEfxPaintMarkDirtyCallback(() => {});
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
    _setEfxPaintRevealScriptLoader(async () => revealScript);
    revealHarness.renderReveal.mockReset();
  });

  it('undoes and redoes a reveal-create entry by reference, resyncing the runtime (G-52-5)', async () => {
    const layerId = 'layer-reveal-undo';
    registerRevealTrackDocument(layerId);
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    const descriptor = await createRevealDescriptor(layerId);

    const { history, availability } = createRevealHistory(layerId);
    history.recordBackgroundEdit(descriptor);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, REVEAL_TRACK_ID)).toHaveLength(1);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, REVEAL_TRACK_ID)).toHaveLength(2);

    expect(await history.undo()).toBe(true);
    expect(getDocument(layerId)).toBe(descriptor.before);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, REVEAL_TRACK_ID)).toHaveLength(0);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, REVEAL_TRACK_ID)).toHaveLength(0);
    expect(availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await history.redo()).toBe(true);
    expect(getDocument(layerId)).toBe(descriptor.after);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, REVEAL_TRACK_ID)).toHaveLength(1);
    expect(physicPaintStore.getRotoRealKeyRecords(layerId, REVEAL_TRACK_ID)).toHaveLength(2);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('survives an unrecorded reference display-preference write after the record (G-52-5)', async () => {
    const layerId = 'layer-reveal-display';
    registerRevealTrackDocument(layerId);
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    const descriptor = await createRevealDescriptor(layerId);

    const { history } = createRevealHistory(layerId);
    history.recordBackgroundEdit(descriptor);

    // An unrecorded DISPLAY-PREFERENCE write (opacity/visibility/lock/transform):
    // replaces the document OBJECT without touching the content fingerprint
    // (the D-07 split excludes display fields and never bumps documentRevision).
    // The bare identity guard failed closed forever here — undo/redo died the
    // moment any reference display control was touched after a recorded entry.
    expect(setPhotoReferenceOpacity(layerId, 0.9).ok).toBe(true);
    expect(getDocument(layerId)).not.toBe(descriptor.after);

    expect(await history.undo()).toBe(true);
    expect(getDocument(layerId)).toBe(descriptor.before);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, REVEAL_TRACK_ID)).toHaveLength(0);

    expect(await history.redo()).toBe(true);
    expect(getDocument(layerId)).toBe(descriptor.after);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, REVEAL_TRACK_ID)).toHaveLength(1);
  });

  it('still fails closed on an unrecorded CONTENT write after the record (G-52-5: CR-01 unchanged)', async () => {
    const layerId = 'layer-reveal-content-guard';
    registerRevealTrackDocument(layerId);
    setPhotoReferenceSource(layerId, ['ref-a']);
    registerReferenceSourceImage('ref-a', 'data:ref-a');
    const descriptor = await createRevealDescriptor(layerId);

    const { history, availability } = createRevealHistory(layerId);
    history.recordBackgroundEdit(descriptor);

    // An unrecorded CONTENT replacement (the reference SOURCE set bumps the
    // content fingerprint — docrev + source refs): the guard must keep failing
    // closed so the snapshot restore never clobbers the newer source.
    expect(setPhotoReferenceSource(layerId, ['ref-b']).ok).toBe(true);
    expect(await history.undo()).toBe(false);
    expect(getDocument(layerId)).not.toBe(descriptor.before);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, REVEAL_TRACK_ID)).toHaveLength(1);
    expect(availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('chains a recorded reference-set entry below a reveal-create entry (G-52-5)', async () => {
    const layerId = 'layer-reveal-chain';
    registerRevealTrackDocument(layerId);

    const { history, availability } = createRevealHistory(layerId);

    // The Studio reference-confirm path now records the source-set descriptor
    // (50-03's "one undoable operation" contract — previously dropped, which
    // broke the ledger chain for every entry recorded before a placement).
    const setResult = setPhotoReferenceSource(layerId, ['ref-a']);
    expect(setResult.ok).toBe(true);
    if (!setResult.ok || !setResult.descriptor) throw new Error('reference set must emit a descriptor');
    history.recordBackgroundEdit(setResult.descriptor);
    registerReferenceSourceImage('ref-a', 'data:ref-a');

    const descriptor = await createRevealDescriptor(layerId);
    history.recordBackgroundEdit(descriptor);
    expect(availability.value).toEqual({ undo: 2, redo: 0 });

    expect(await history.undo()).toBe(true);
    expect(getDocument(layerId)).toBe(descriptor.before);
    expect(getDocument(layerId)).toBe(setResult.descriptor.after);

    expect(await history.undo()).toBe(true);
    expect(getDocument(layerId)).toBe(setResult.descriptor.before);
    expect(getDocument(layerId)!.photoReference).toBeNull();
    expect(availability.value).toEqual({ undo: 0, redo: 2 });

    expect(await history.redo()).toBe(true);
    expect(getDocument(layerId)).toBe(setResult.descriptor.after);
    expect(await history.redo()).toBe(true);
    expect(getDocument(layerId)).toBe(descriptor.after);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layerId, REVEAL_TRACK_ID)).toHaveLength(1);
    expect(availability.value).toEqual({ undo: 2, redo: 0 });
  });
});
